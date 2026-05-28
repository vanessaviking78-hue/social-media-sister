import { Router, type IRouter, type Request, type Response } from "express";
import { lookup as dnsLookup } from "node:dns/promises";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { db } from "@workspace/db";
import {
  aiSourcePhotosTable,
  aiGeneratedPortraitsTable,
  approvalBatchesTable,
  approvalImagesTable,
  contentLibraryTable,
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
import {
  createMotionJob,
  getMotionJob,
  processMotionJob,
  type CameraMotion,
} from "../lib/motionReelWorker";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function uploadBuf(buffer: Buffer, filename: string, folder: string, mime = "image/jpeg"): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const key = `${folder}/${uuid()}/${filename}`;
  await objectStorageClient.bucket(bucketId).file(key).save(buffer, {
    contentType: mime,
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return `/api/media/${key}`;
}

async function fetchBufFromStorage(urlOrPath: string): Promise<Buffer> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  // Accepts /api/media/<key>, legacy /api/ai-portrait/images/<key>, or GCS https:// URLs
  let key: string;
  if (urlOrPath.startsWith("/api/media/")) {
    key = urlOrPath.slice("/api/media/".length);
  } else if (urlOrPath.startsWith("/api/ai-portrait/images/")) {
    key = urlOrPath.slice("/api/ai-portrait/images/".length);
  } else if (urlOrPath.startsWith("https://storage.googleapis.com/")) {
    const u = new URL(urlOrPath);
    key = u.pathname.slice(1).replace(`${bucketId}/`, "");
  } else {
    throw new Error(`Cannot resolve portrait image path: ${urlOrPath}`);
  }
  const [buffer] = await objectStorageClient.bucket(bucketId).file(key).download();
  return buffer;
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

async function validateHost(host: string): Promise<void> {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "metadata.google.internal") {
    throw new Error("URL points to a private or reserved address");
  }
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(h)) throw new Error("URL points to a private or reserved address");
  }
  try {
    const resolved = await dnsLookup(h, { all: true });
    for (const { address } of resolved) {
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(address)) throw new Error("URL resolves to a private or reserved address");
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("private") || msg.includes("reserved")) throw e;
    throw new Error("Could not resolve URL hostname");
  }
}

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
  await validateHost(parsed.hostname);

  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_REDIRECTS = 5;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");

      const r = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "CyberSuite/1.0 (image-ingestion)" },
      });

      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get("location");
        if (!location) throw new Error("Redirect with no Location header");
        const redirectParsed = new URL(location, currentUrl);
        if (redirectParsed.protocol !== "https:") throw new Error("Redirect must use HTTPS");
        await validateHost(redirectParsed.hostname);
        currentUrl = redirectParsed.href;
        continue;
      }

      if (!r.ok) throw new Error(`Remote server returned ${r.status}`);
      const contentType = r.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error("URL must point to an image (got: " + contentType + ")");
      }
      const rawLength = parseInt(r.headers.get("content-length") ?? "0", 10);
      if (rawLength > MAX_BYTES) throw new Error("Image exceeds 20 MB limit");
      const arrayBuf = await r.arrayBuffer();
      if (arrayBuf.byteLength > MAX_BYTES) throw new Error("Image exceeds 20 MB limit");
      return Buffer.from(arrayBuf);
    }
    throw new Error("Too many redirects");
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

router.post("/ai-portrait/background-image", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "image file required" });
      return;
    }
    const imageUrl = await uploadBuf(file.buffer, "background.jpg", "ai-portraits/background", file.mimetype);
    res.json({ url: imageUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "ai-portrait/background-image upload failed");
    res.status(500).json({ error: msg });
  }
});

// Legacy image URL redirect — forwards old /api/ai-portrait/images/<key> URLs
// to the working /api/media/<key> handler which uses the same bucket and key
router.get("/ai-portrait/images/*key", (req: Request, res: Response) => {
  const rawKey = (req.params as Record<string, string | string[]>).key;
  const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
  if (!key) { res.status(400).json({ error: "No key specified" }); return; }
  res.redirect(301, `/api/media/${key}`);
});

router.post("/ai-portrait/generate", async (req: Request, res: Response) => {
  try {
    const { sourcePhotoId, clientName = "", scenarios } = req.body as {
      sourcePhotoId: number;
      clientName?: string;
      scenarios: Array<{
        id: string;
        scrubColor?: string;
        outfitStyle?: string;
        outfitType?: string;
        backgroundType?: string;
        backdropColor?: string;
        backgroundImageUrl?: string;
        aspectRatio: string;
      }>;
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
        const buf = await fetchBufFromStorage(source.photoUrl);
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
    const { applyWatermark = true, clientName: bodyClientName } = req.body as { applyWatermark?: boolean; clientName?: string };

    const [portrait] = await db.select().from(aiGeneratedPortraitsTable).where(eq(aiGeneratedPortraitsTable.id, portraitId));
    if (!portrait) { res.status(404).json({ error: "Portrait not found" }); return; }

    const imageUrl = applyWatermark
      ? (portrait.outputImageUrl ?? portrait.originalImageUrl)
      : (portrait.originalImageUrl ?? portrait.outputImageUrl);

    if (!imageUrl) { res.status(400).json({ error: "Portrait has no output image yet" }); return; }

    const effectiveClientName = bodyClientName?.trim() || portrait.clientName || "Unknown";

    await db.update(aiGeneratedPortraitsTable).set({ savedToLibrary: true }).where(eq(aiGeneratedPortraitsTable.id, portraitId));

    const batchName = `AI Portrait — ${effectiveClientName} — ${new Date().toLocaleDateString("en-GB")}`;
    const token = uuid();
    const [batch] = await db
      .insert(approvalBatchesTable)
      .values({ name: batchName, clientName: effectiveClientName, token, status: "pending" })
      .returning();

    const complianceNote = "This image was generated using artificial intelligence. It does not represent a real photograph. Created in accordance with ASA/CAP guidelines — AI-generated content.";
    await db
      .insert(approvalImagesTable)
      .values({ batchId: batch.id, imageUrl, status: "pending", clientNote: complianceNote });

    res.json({ success: true, batchId: batch.id, approvalToken: token, clientName: effectiveClientName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Save failed";
    req.log.error({ err }, "ai-portrait/save-to-library failed");
    res.status(500).json({ error: msg });
  }
});

router.post("/ai-portrait/save-batch-to-library", async (req: Request, res: Response) => {
  try {
    const { portraitIds, applyWatermark = true, clientName: bodyClientName } = req.body as {
      portraitIds: number[];
      applyWatermark?: boolean;
      clientName?: string;
    };
    if (!Array.isArray(portraitIds) || portraitIds.length === 0) {
      res.status(400).json({ error: "portraitIds must be a non-empty array" }); return;
    }

    const portraits = await db.select().from(aiGeneratedPortraitsTable)
      .where(eq(aiGeneratedPortraitsTable.status, "success"));
    const matching = portraits.filter((p) => portraitIds.includes(p.id));
    if (matching.length === 0) { res.status(404).json({ error: "No matching portraits found" }); return; }

    const effectiveClientName = bodyClientName?.trim() || matching[0].clientName || "Unknown";

    const toInsert = [];
    for (const portrait of matching) {
      const imageUrl = applyWatermark
        ? (portrait.outputImageUrl ?? portrait.originalImageUrl)
        : (portrait.originalImageUrl ?? portrait.outputImageUrl);
      if (!imageUrl) continue;

      const scenario = AI_PORTRAIT_SCENARIOS.find((s) => s.id === portrait.scenarioId);
      const scenarioName = scenario?.name ?? portrait.scenarioId;

      toInsert.push({
        clientName: effectiveClientName,
        postType: "single",
        caption: scenarioName,
        mediaUrl: imageUrl,
        metadata: {
          source: "ai-portrait",
          scenarioId: portrait.scenarioId,
          scenarioName,
          portraitId: portrait.id,
          hasWatermark: applyWatermark,
        } as Record<string, unknown>,
      });
    }

    if (!toInsert.length) {
      res.status(400).json({ error: "No portraits had a valid image URL" }); return;
    }

    await db.insert(contentLibraryTable).values(toInsert);
    await Promise.all(
      matching.map((p) =>
        db.update(aiGeneratedPortraitsTable).set({ savedToLibrary: true }).where(eq(aiGeneratedPortraitsTable.id, p.id))
      )
    );

    res.json({ success: true, clientName: effectiveClientName, count: toInsert.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Batch save failed";
    req.log.error({ err }, "ai-portrait/save-batch-to-library failed");
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

router.post("/ai-portrait/:portraitId/animate", async (req: Request, res: Response) => {
  try {
    const portraitId = Number(req.params.portraitId);
    const { cameraMotion = "cinematic-drift", clientName: reqClientName } = req.body as {
      cameraMotion?: CameraMotion;
      clientName?: string;
    };

    const [portrait] = await db
      .select()
      .from(aiGeneratedPortraitsTable)
      .where(eq(aiGeneratedPortraitsTable.id, portraitId));
    if (!portrait) { res.status(404).json({ error: "Portrait not found" }); return; }

    const imageUrl = portrait.originalImageUrl ?? portrait.outputImageUrl;
    if (!imageUrl) { res.status(400).json({ error: "Portrait has no image URL" }); return; }

    const [source] = await db
      .select()
      .from(aiSourcePhotosTable)
      .where(eq(aiSourcePhotosTable.id, portrait.sourcePhotoId));

    const clientName = reqClientName || source?.clientName || "";
    const scenarioName = portrait.scenarioId;

    const imageBuf = await fetchBufFromStorage(imageUrl);
    const imageMime = "image/jpeg";

    const jobId = `mr_${Date.now()}_${uuid().slice(0, 8)}`;
    createMotionJob(jobId);

    setImmediate(async () => {
      try {
        await processMotionJob(jobId, imageBuf, imageMime, cameraMotion, clientName, scenarioName);
      } catch (err) {
        logger.error({ err, jobId }, "processMotionJob wrapper failed");
      }
    });

    res.status(202).json({ jobId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Animate failed";
    req.log.error({ err }, "ai-portrait/animate failed");
    res.status(500).json({ error: msg });
  }
});

router.get("/ai-portrait/animate/:jobId/status", (req: Request, res: Response) => {
  const job = getMotionJob(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

router.post("/ai-portrait/:portraitId/regenerate", async (req: Request, res: Response) => {
  try {
    const portraitId = Number(req.params.portraitId);
    const [portrait] = await db.select().from(aiGeneratedPortraitsTable).where(eq(aiGeneratedPortraitsTable.id, portraitId));
    if (!portrait) { res.status(404).json({ error: "Portrait not found" }); return; }

    const [source] = await db.select().from(aiSourcePhotosTable).where(eq(aiSourcePhotosTable.id, portrait.sourcePhotoId));
    if (!source) { res.status(404).json({ error: "Source photo not found" }); return; }

    const jobId = `ap_regen_${Date.now()}_${uuid().slice(0, 8)}`;

    // Create job entry before dispatching async work so polling never races to a 404
    createJob(jobId, [portrait.scenarioId]);
    const _seedJob = getJob(jobId);
    if (_seedJob?.cards[0]) _seedJob.cards[0].portraitId = portraitId;

    setImmediate(async () => {
      try {
        const buf = await fetchBufFromStorage(source.photoUrl);
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
