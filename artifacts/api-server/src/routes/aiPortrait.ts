import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { db } from "@workspace/db";
import {
  aiSourcePhotosTable,
  aiGeneratedPortraitsTable,
  approvalBatchesTable,
  approvalImagesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { AI_PORTRAIT_SCENARIOS } from "../lib/aiPortraitScenarios";
import {
  createJob,
  getJob,
  processPortraitJob,
  regenerateSingleCard,
} from "../lib/aiPortraitWorker";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function uploadBuf(buffer: Buffer, filename: string, folder: string, mime = "image/jpeg"): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const key = `${folder}/${uuid()}/${filename}`;
  await objectStorageClient.bucket(bucketId).file(key).save(buffer, {
    public: true,
    contentType: mime,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `https://storage.googleapis.com/${bucketId}/${key}`;
}

async function fetchBuf(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch source photo: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

async function fetchBufSecure(rawUrl: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are accepted");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "metadata.google.internal") {
    throw new Error("URL points to a private or reserved address");
  }
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error("URL points to a private or reserved address");
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CyberSuite/1.0 (image-ingestion)" },
    });
    if (!r.ok) throw new Error(`Remote server returned ${r.status}`);
    const contentType = r.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error("URL must point to an image (got: " + contentType + ")");
    }
    const MAX_BYTES = 20 * 1024 * 1024;
    const rawLength = parseInt(r.headers.get("content-length") ?? "0", 10);
    if (rawLength > MAX_BYTES) throw new Error("Image exceeds 20 MB limit");
    const arrayBuf = await r.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) throw new Error("Image exceeds 20 MB limit");
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timer);
  }
}

router.post("/ai-portrait/source", upload.single("photo"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "photo file required" });
      return;
    }
    const { clientName = "", notes = "" } = req.body as { clientName?: string; notes?: string };
    const photoUrl = await uploadBuf(file.buffer, "source.jpg", "ai-portraits/source", file.mimetype);
    const [row] = await db
      .insert(aiSourcePhotosTable)
      .values({ clientName, photoUrl, notes })
      .returning();
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "ai-portrait/source upload failed");
    res.status(500).json({ error: msg });
  }
});

router.get("/ai-portrait/scenarios", (_req: Request, res: Response) => {
  res.json(AI_PORTRAIT_SCENARIOS);
});

router.post("/ai-portrait/generate", async (req: Request, res: Response) => {
  try {
    const { sourcePhotoId, clientName = "", scenarios } = req.body as {
      sourcePhotoId: number;
      clientName?: string;
      scenarios: Array<{ id: string; scrubColor?: string; outfitStyle?: string; aspectRatio: string }>;
    };

    if (!sourcePhotoId) { res.status(400).json({ error: "sourcePhotoId required" }); return; }
    if (!Array.isArray(scenarios) || scenarios.length === 0) { res.status(400).json({ error: "scenarios array required" }); return; }
    if (scenarios.length > 6) { res.status(400).json({ error: "Maximum 6 scenarios per job" }); return; }

    const [source] = await db.select().from(aiSourcePhotosTable).where(eq(aiSourcePhotosTable.id, sourcePhotoId));
    if (!source) { res.status(404).json({ error: "Source photo not found" }); return; }

    const jobId = `ap_${Date.now()}_${uuid().slice(0, 8)}`;
    createJob(jobId, scenarios.map((s) => s.id));

    setImmediate(async () => {
      try {
        const buf = await fetchBuf(source.photoUrl);
        await processPortraitJob(jobId, buf, sourcePhotoId, clientName, scenarios);
      } catch (err) {
        logger.error({ err, jobId }, "Portrait job failed at top level");
      }
    });

    res.status(202).json({ jobId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generate failed";
    req.log.error({ err }, "ai-portrait/generate failed");
    res.status(500).json({ error: msg });
  }
});

router.get("/ai-portrait/jobs/:jobId/status", (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }
  res.json({ cards: job.cards });
});

router.post("/ai-portrait/:portraitId/save-to-library", async (req: Request, res: Response) => {
  try {
    const portraitId = Number(req.params.portraitId);
    const { applyWatermark = true } = req.body as { applyWatermark?: boolean };

    const [portrait] = await db.select().from(aiGeneratedPortraitsTable).where(eq(aiGeneratedPortraitsTable.id, portraitId));
    if (!portrait) { res.status(404).json({ error: "Portrait not found" }); return; }

    const imageUrl = applyWatermark
      ? (portrait.outputImageUrl ?? portrait.originalImageUrl)
      : (portrait.originalImageUrl ?? portrait.outputImageUrl);

    if (!imageUrl) { res.status(400).json({ error: "Portrait has no output image yet" }); return; }

    await db.update(aiGeneratedPortraitsTable).set({ savedToLibrary: true }).where(eq(aiGeneratedPortraitsTable.id, portraitId));

    const batchName = `AI Portrait — ${portrait.clientName || "Unknown"} — ${new Date().toLocaleDateString("en-GB")}`;
    const token = uuid();
    const [batch] = await db
      .insert(approvalBatchesTable)
      .values({ name: batchName, clientName: portrait.clientName, token, status: "pending" })
      .returning();

    const complianceNote = "This image was generated using artificial intelligence. It does not represent a real photograph. Created in accordance with ASA/CAP guidelines — AI-generated content.";
    await db
      .insert(approvalImagesTable)
      .values({ batchId: batch.id, imageUrl, status: "pending", clientNote: complianceNote });

    res.json({ success: true, batchId: batch.id, approvalToken: token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Save failed";
    req.log.error({ err }, "ai-portrait/save-to-library failed");
    res.status(500).json({ error: msg });
  }
});

router.post("/ai-portrait/source-from-url", async (req: Request, res: Response) => {
  try {
    const { photoUrl, clientName = "", notes = "" } = req.body as { photoUrl: string; clientName?: string; notes?: string };
    if (!photoUrl) { res.status(400).json({ error: "photoUrl required" }); return; }

    const imageBuf = await fetchBufSecure(photoUrl);
    const uploadedUrl = await uploadBuf(imageBuf, "source.jpg", "ai-portraits/source", "image/jpeg");

    const [row] = await db
      .insert(aiSourcePhotosTable)
      .values({ clientName, photoUrl: uploadedUrl, notes })
      .returning();

    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "URL ingestion failed";
    req.log.error({ err }, "ai-portrait/source-from-url failed");
    res.status(500).json({ error: msg });
  }
});

router.post("/ai-portrait/:portraitId/regenerate", async (req: Request, res: Response) => {
  try {
    const portraitId = Number(req.params.portraitId);
    const [portrait] = await db.select().from(aiGeneratedPortraitsTable).where(eq(aiGeneratedPortraitsTable.id, portraitId));
    if (!portrait) { res.status(404).json({ error: "Portrait not found" }); return; }

    const [source] = await db.select().from(aiSourcePhotosTable).where(eq(aiSourcePhotosTable.id, portrait.sourcePhotoId));
    if (!source) { res.status(404).json({ error: "Source photo not found" }); return; }

    const jobId = `ap_regen_${Date.now()}_${uuid().slice(0, 8)}`;

    setImmediate(async () => {
      try {
        const buf = await fetchBuf(source.photoUrl);
        await regenerateSingleCard(jobId, portraitId, buf);
      } catch (err) {
        logger.error({ err, jobId, portraitId }, "Regen failed");
      }
    });

    res.status(202).json({ jobId, portraitId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Regen failed";
    req.log.error({ err }, "ai-portrait/regenerate failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
