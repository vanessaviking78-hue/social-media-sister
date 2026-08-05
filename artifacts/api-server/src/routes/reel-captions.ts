import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { reelSubmissionsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai, toFile } from "@workspace/integrations-openai-ai-server";
import { convertToWav } from "@workspace/integrations-openai-ai-server/audio";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { spawn } from "child_process";
import { writeFile, unlink, readFile, access } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

router.use("/reel-captions", requireAuth);

const reelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVu-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
];

type FontEntry = { label: string; url: string };

// Bold, caption-friendly Google Fonts, downloaded once and cached on disk —
// keeps the repo free of binary font files while still giving Vanessa a
// real dropdown of fonts to pick from when rendering.
const FONT_LIBRARY: Record<string, FontEntry> = {
  "montserrat-bold": {
    label: "Montserrat Bold",
    url: "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf",
  },
};
const DEFAULT_FONT_KEY = "montserrat-bold";

async function resolveFontPath(fontKey?: string): Promise<string | null> {
  const key = fontKey && FONT_LIBRARY[fontKey] ? fontKey : DEFAULT_FONT_KEY;
  const entry = FONT_LIBRARY[key];
  const cachePath = join(tmpdir(), `reel-caption-font-${key}.ttf`);
  try {
    await access(cachePath);
    return cachePath;
  } catch {
    // not cached yet — download it below
  }
  try {
    const r = await fetch(entry.url);
    if (!r.ok) throw new Error(`Font download failed: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(cachePath, buf);
    return cachePath;
  } catch (err) {
    logger.error({ err }, "Failed to download caption font, falling back to system font");
    for (const candidate of FONT_CANDIDATES) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        // try next
      }
    }
    return null;
  }
}

function escapeDrawtextPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function hexToFfmpegColor(hex: string | null | undefined, fallback = "0x000000"): string {
  if (!hex) return fallback;
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  return `0x${clean}`;
}

type Word = { word: string; start: number; end: number };
type Chunk = { text: string; start: number; end: number };

// Groups individual Whisper words into short on-screen caption bursts (a
// few words at a time, synced to speech) rather than one word literally
// flashing at a time — far more reliable to burn in with ffmpeg drawtext,
// and reads the same way most reel captions actually work in practice.
function chunkWords(words: Word[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Word[] = [];
  for (const w of words) {
    if (current.length === 0) { current.push(w); continue; }
    const gap = w.start - current[current.length - 1].end;
    if (current.length >= 5 || gap > 0.6) {
      chunks.push({ text: current.map((x) => x.word).join(" "), start: current[0].start, end: current[current.length - 1].end });
      current = [w];
    } else {
      current.push(w);
    }
  }
  if (current.length) {
    chunks.push({ text: current.map((x) => x.word).join(" "), start: current[0].start, end: current[current.length - 1].end });
  }
  return chunks;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const isAbsolute = /^https?:\/\//i.test(url);
  const fetchUrl = isAbsolute ? url : `http://localhost:${process.env.PORT}${url}`;
  const r = await fetch(fetchUrl);
  if (!r.ok) throw new Error(`Could not fetch ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// The font choices available in the caption render dropdown.
router.get("/reel-captions/fonts", async (req: Request, res: Response) => {
  const fonts = Object.entries(FONT_LIBRARY).map(([key, entry]) => ({ key, label: entry.label }));
  res.json({ fonts, defaultFontKey: DEFAULT_FONT_KEY });
});

// Lets Vanessa push a video straight into a client's portal from this end —
// same reel_submissions row a client's own upload would create, so it shows
// up in both this queue and the client's Upload Reel tab.
router.post("/reel-captions/submissions", reelUpload.single("video"), async (req: Request, res: Response) => {
  try {
    const { clientName } = req.body as { clientName?: string };
    if (!clientName) { res.status(400).json({ error: "clientName is required" }); return; }
    if (!req.file) { res.status(400).json({ error: "No video file provided" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.name, clientName));
    if (!preset) { res.status(404).json({ error: "Client not found" }); return; }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `reel-submissions/${uuidv4()}-${(req.file.originalname || "reel.mp4").replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(req.file.buffer, {
      contentType: req.file.mimetype || "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    const videoUrl = `/api/media/${objectPath}`;
    const [row] = await db.insert(reelSubmissionsTable).values({ clientName, videoUrl, status: "pending" }).returning();
    res.json({ ok: true, id: row?.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to upload video" });
  }
});

// List every submission, most recent first, with the client's brand colour
// alongside so the captioning tool can default to it.
router.get("/reel-captions/submissions", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(reelSubmissionsTable).orderBy(desc(reelSubmissionsTable.createdAt));
    const presets = await db.select().from(clientPresetsTable);
    const byName = new Map(presets.map((p) => [p.name, p]));
    const enriched = rows.map((r) => ({ ...r, accentColor: byName.get(r.clientName)?.accentColor || "#ffffff" }));
    res.json({ submissions: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load submissions" });
  }
});

// Transcribes the raw video's audio with word-level timestamps (Whisper),
// groups them into short caption bursts, and saves the result for review —
// nothing gets burned onto the video until it's rendered separately, so
// Vanessa can fix any misheard words first.
router.post("/reel-captions/submissions/:id/transcribe", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [sub] = await db.select().from(reelSubmissionsTable).where(eq(reelSubmissionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }

    const videoBuf = await fetchBuffer(sub.videoUrl);
    const wavBuf = await convertToWav(videoBuf);
    const file = await toFile(wavBuf, "audio.wav");
    const transcription: any = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });
    const words: Word[] = (transcription.words || []).map((w: any) => ({ word: w.word, start: w.start, end: w.end }));
    const chunks = chunkWords(words);

    await db.update(reelSubmissionsTable)
      .set({ transcript: chunks as any, status: "transcribed" })
      .where(eq(reelSubmissionsTable.id, id));
    res.json({ chunks });
  } catch (err: any) {
    logger.error({ err }, "Reel transcription failed");
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

// Save Vanessa's corrections to the transcript text (typo fixes etc) before
// rendering — timing stays as Whisper produced it.
router.patch("/reel-captions/submissions/:id/transcript", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { chunks } = req.body as { chunks?: Chunk[] };
    if (!Array.isArray(chunks)) { res.status(400).json({ error: "chunks array required" }); return; }
    const [sub] = await db.select().from(reelSubmissionsTable).where(eq(reelSubmissionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
    await db.update(reelSubmissionsTable).set({ transcript: chunks as any }).where(eq(reelSubmissionsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save transcript" });
  }
});

// Burns the (possibly edited) caption chunks onto the original video in the
// client's brand colour, uploads the result, and marks the submission done.
router.post("/reel-captions/submissions/:id/render", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const inputPath = join(tmpdir(), `reel-in-${randomUUID()}.mp4`);
  const outputPath = join(tmpdir(), `reel-out-${randomUUID()}.mp4`);
  const tmpTextFiles: string[] = [];
  try {
    const [sub] = await db.select().from(reelSubmissionsTable).where(eq(reelSubmissionsTable.id, id));
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
    const chunks = (sub.transcript as unknown as Chunk[]) || [];
    if (!chunks.length) { res.status(400).json({ error: "No transcript yet — transcribe first" }); return; }

    const { fontKey, boxColor: requestedBoxColor } = (req.body || {}) as { fontKey?: string; boxColor?: string };
    const boxColor = hexToFfmpegColor(requestedBoxColor) || "0x000000";

    const fontPath = await resolveFontPath(fontKey);
    if (!fontPath) { res.status(500).json({ error: "No system font available for captioning" }); return; }

    const videoBuf = await fetchBuffer(sub.videoUrl);
    await writeFile(inputPath, videoBuf);

    const filters: string[] = [];
    for (const chunk of chunks) {
      const text = (chunk.text || "").trim();
      if (!text) continue;
      const txtPath = join(tmpdir(), `caption-${randomUUID()}.txt`);
      await writeFile(txtPath, text, "utf8");
      tmpTextFiles.push(txtPath);
      const safePath = escapeDrawtextPath(txtPath);
      const safeFont = escapeDrawtextPath(fontPath);
      filters.push(
        `drawtext=fontfile='${safeFont}':textfile='${safePath}':fontsize=54:fontcolor=white:box=1:boxcolor=${boxColor}@0.85:boxborderw=20:x=(w-text_w)/2:y=(h*2/3)-(text_h/2):enable='between(t,${chunk.start},${chunk.end})'`
      );
    }

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ["-i", inputPath, "-vf", filters.join(","), "-c:a", "copy", "-y", outputPath]);
      let stderr = "";
      ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))));
      ffmpeg.on("error", reject);
    });

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `reel-captioned/${randomUUID()}.mp4`;
    const outBuf = await readFile(outputPath);
    await objectStorageClient.bucket(bucketId).file(objectPath).save(outBuf, {
      contentType: "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    const captionedVideoUrl = `/api/media/${objectPath}`;

    await db.update(reelSubmissionsTable)
      .set({ captionedVideoUrl, status: "done" })
      .where(eq(reelSubmissionsTable.id, id));

    res.json({ captionedVideoUrl });
  } catch (err: any) {
    logger.error({ err }, "Reel caption render failed");
    res.status(500).json({ error: err.message || "Render failed" });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await Promise.all(tmpTextFiles.map((f) => unlink(f).catch(() => {})));
  }
});

router.delete("/reel-captions/submissions/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(reelSubmissionsTable).where(eq(reelSubmissionsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete submission" });
  }
});

export default router;
