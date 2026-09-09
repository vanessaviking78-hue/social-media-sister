import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { engagingReelsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { spawn } from "child_process";
import { writeFile, unlink, readFile, access } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { parse as csvParse } from "csv-parse/sync";
import { BASE_RULES, CAPTION_TONE_PROMPTS } from "./caption-generator";

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

router.use("/engaging-reels", requireAuth);

// Up to 20 B-roll clips plus one CSV per batch, matched in upload order —
// row 1 of the CSV goes with video 1, and so on.
const batchUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024, files: 21 } }).fields([
  { name: "videos", maxCount: 20 },
  { name: "csv", maxCount: 1 },
]);

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVu-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
];

// Hard-coded to Inter Bold
const INTER_BOLD_URL = "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLteQiYUEtPgJgvHuG6aEQzunL_4qFfJU.ttf";

async function resolveFont(): Promise<string | null> {
  const cachePath = join(tmpdir(), "engaging-reel-font-inter-bold.ttf");
  try {
    await access(cachePath);
    return cachePath;
  } catch {
    // not cached yet
  }
  try {
    const r = await fetch(INTER_BOLD_URL);
    if (!r.ok) throw new Error(`Font download failed: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(cachePath, buf);
    return cachePath;
  } catch (err) {
    logger.error({ err }, "Failed to download Inter Bold font, falling back to system font");
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

async function fetchBuffer(url: string): Promise<Buffer> {
  const isAbsolute = /^https?:\/\//i.test(url);
  const fetchUrl = isAbsolute ? url : `http://localhost:${process.env.PORT}${url}`;
  const r = await fetch(fetchUrl);
  if (!r.ok) throw new Error(`Could not fetch ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function getDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
    let out = "";
    let err = "";
    ffprobe.stdout.on("data", (d) => { out += d.toString(); });
    ffprobe.stderr.on("data", (d) => { err += d.toString(); });
    ffprobe.on("close", (code) => {
      const val = parseFloat(out.trim());
      if (code === 0 && !isNaN(val)) resolve(val);
      else reject(new Error(`ffprobe failed: ${err.slice(-300)}`));
    });
    ffprobe.on("error", reject);
  });
}

function getVideoWidth(path: string): Promise<number> {
 return new Promise((resolve) => {
 const ffprobe = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "default=noprint_wrappers=1:nokey=1", path]);
 let out = "";
 ffprobe.stdout.on("data", (d) => { out += d.toString(); });
 ffprobe.on("close", (code) => {
 const val = parseInt(out.trim(), 10);
 if (code === 0 && !isNaN(val) && val > 0) resolve(val);
 else resolve(1920);
 });
 ffprobe.on("error", () => resolve(1920));
 });
}

type TextLayout = {
  hook?: { x: number; y: number; w: number; fontSize: number };
  secondHook?: { x: number; y: number; w: number; fontSize: number };
  cta?: { x: number; y: number; w: number; fontSize: number };
};

type CsvRow = { index: number; text1: string; text2: string; text3: string };

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The three CSV sentences arrive in no particular order, so a single OpenAI
// call assigns each one a role for every row in the batch at once — which
// sentence lands best as the scroll-stopping opening hook, which keeps the
// viewer watching as a second hook, and which closes as the call to action.
// The wording is never rewritten, only assigned.
async function assignRoles(rows: CsvRow[]): Promise<{ hook: string; secondHook: string; cta: string }[]> {
  const system = `You label short lines of on-screen text for silent B-roll Instagram Reels for a UK aesthetics clinic. These reels have no spoken audio and no captions synced to speech — the only words on screen are the three lines you are given per row, shown one at a time over the footage.

For each row you get three unordered sentences. Decide:
- "hook": whichever sentence works best as the opening line that stops someone scrolling in the first second.
- "secondHook": whichever sentence works best as the follow-up line that keeps them watching, builds curiosity or context.
- "cta": whichever sentence works best as the closing call to action, telling the viewer what to do next.

Never rewrite, shorten or reword the sentences. Only assign the exact given text to a role. Every row must use all three of its own sentences exactly once, one per role.

Return strict JSON only, in this shape: {"rows":[{"index":0,"hook":"...","secondHook":"...","cta":"..."}]}, one entry per input row, in the same order, using the same index values you were given.`;

  const user = `Rows (JSON):\n${JSON.stringify(rows)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch {
    parsed = {};
  }
  const out: any[] = Array.isArray(parsed.rows) ? parsed.rows : [];

  return rows.map((r, i) => {
    const match = out.find((o) => o?.index === i) || out[i];
    return {
      hook: (match?.hook || "").toString().trim() || r.text1,
      secondHook: (match?.secondHook || "").toString().trim() || r.text2,
      cta: (match?.cta || "").toString().trim() || r.text3,
    };
  });
}

router.get("/engaging-reels", async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(engagingReelsTable).orderBy(desc(engagingReelsTable.createdAt));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load Engaging Reels" });
  }
});

// One video, one CSV row, up to twenty of each per batch, matched in upload
// order. The CSV needs a header row with text1/text2/text3 columns (spacing
// and capitalisation don't matter).
router.post("/engaging-reels/batches", batchUpload, async (req: Request, res: Response) => {
  try {
    const files = req.files as { videos?: Express.Multer.File[]; csv?: Express.Multer.File[] } | undefined;
    const videos = files?.videos || [];
    const csvFile = files?.csv?.[0];

    if (!videos.length) { res.status(400).json({ error: "Upload at least one video" }); return; }
    if (!csvFile) { res.status(400).json({ error: "A CSV file is required" }); return; }

    let records: Record<string, unknown>[];
    try {
      records = csvParse(csvFile.buffer.toString("utf8"), { columns: true, skip_empty_lines: true, trim: true });
    } catch (e: any) {
      res.status(400).json({ error: `Could not read the CSV: ${e.message || "invalid format"}` });
      return;
    }

    if (records.length !== videos.length) {
      res.status(400).json({
        error: `The CSV has ${records.length} row${records.length === 1 ? "" : "s"} but ${videos.length} video${videos.length === 1 ? "" : "s"} were uploaded — these need to match, one row per video, in the same order.`,
      });
      return;
    }

    const rows: CsvRow[] = records.map((r, i) => {
      const norm: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) norm[normalizeKey(k)] = String(v ?? "").trim();
      return {
        index: i,
        text1: norm["text1"] || norm["texta"] || "",
        text2: norm["text2"] || norm["textb"] || "",
        text3: norm["text3"] || norm["textc"] || "",
      };
    });

    const missing = rows.findIndex((r) => !r.text1 || !r.text2 || !r.text3);
    if (missing !== -1) {
      res.status(400).json({ error: `Row ${missing + 1} of the CSV is missing one of text1, text2 or text3 — every row needs all three sentences.` });
      return;
    }

    const assignments = await assignRoles(rows);

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }

    const batchId = uuidv4();
    const inserted = [];
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const objectPath = `engaging-reels/${batchId}-${i}-${(v.originalname || "reel.mp4").replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
      await objectStorageClient.bucket(bucketId).file(objectPath).save(v.buffer, {
        contentType: v.mimetype || "video/mp4",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const videoUrl = `/api/media/${objectPath}`;
      const a = assignments[i];
      const [row] = await db.insert(engagingReelsTable).values({
        batchId,
        videoUrl,
        text1: rows[i].text1,
        text2: rows[i].text2,
        text3: rows[i].text3,
        hook: a.hook,
        secondHook: a.secondHook,
        cta: a.cta,
        status: "assigned",
      }).returning();
      inserted.push(row);
    }

    res.json({ batchId, items: inserted });
  } catch (err: any) {
    logger.error({ err }, "Engaging Reels batch upload failed");
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// Lets Vanessa fix the AI's role assignment, or just rewrite a line, before
// it gets burned onto the video. Also accepts textLayout for custom positioning.
router.patch("/engaging-reels/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { hook, secondHook, cta, textLayout } = (req.body || {}) as { 
      hook?: string; 
      secondHook?: string; 
      cta?: string;
      textLayout?: TextLayout;
    };
    const updates: Record<string, any> = {};
    if (hook !== undefined) updates.hook = hook;
    if (secondHook !== undefined) updates.secondHook = secondHook;
    if (cta !== undefined) updates.cta = cta;
    if (textLayout !== undefined) updates.textLayout = textLayout;
    if (!Object.keys(updates).length) { res.status(400).json({ error: "Nothing to update" }); return; }
    await db.update(engagingReelsTable).set(updates).where(eq(engagingReelsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save changes" });
  }
});

// Burns the hook, second hook and CTA onto the (silent) video, spaced across
// the clip's own length in thirds — no transcription, nothing synced to
// speech, since these clips don't have any.
router.post("/engaging-reels/:id/render", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const inputPath = join(tmpdir(), `engaging-reel-in-${randomUUID()}.mp4`);
  const outputPath = join(tmpdir(), `engaging-reel-out-${randomUUID()}.mp4`);
  const tmpTextFiles: string[] = [];
  try {
    const [item] = await db.select().from(engagingReelsTable).where(eq(engagingReelsTable.id, id));
    if (!item) { res.status(404).json({ error: "Not found" }); return; }

    const { textLayout: layoutFromBody, boxColor: boxColorFromBody } = (req.body || {}) as { textLayout?: TextLayout; boxColor?: string };

    const fontPath = await resolveFont();
    if (!fontPath) { res.status(500).json({ error: "No system font available for text overlay" }); return; }

    const videoBuf = await fetchBuffer(item.videoUrl);
    await writeFile(inputPath, videoBuf);
    const duration = await getDuration(inputPath);
 const videoWidth = await getVideoWidth(inputPath);

    const hookEnd = Math.min(3, duration * 0.3);
    const ctaLen = Math.min(3.5, duration * 0.35);
    const ctaStart = Math.max(hookEnd, duration - ctaLen);

    // Default segment positions (0-1 fractions of video dimensions)
    const defaultLayout: TextLayout = {
      hook: { x: 0.5, y: 0.12, w: 0.33, fontSize: 54 },
      secondHook: { x: 0.5, y: 0.45, w: 0.42, fontSize: 54 },
      cta: { x: 0.5, y: 0.81, w: 0.42, fontSize: 54 },
    };
    const layout = layoutFromBody || defaultLayout;

    const segments: { 
      text: string; 
      key: "hook" | "secondHook" | "cta";
      start: number; 
      end: number; 
      config: { x: number; y: number; w: number; fontSize: number };
    }[] = [
      { 
        text: item.hook, 
        key: "hook",
        start: 0, 
        end: hookEnd,
        config: layout.hook || defaultLayout.hook!
      },
      { 
        text: item.secondHook, 
        key: "secondHook",
        start: hookEnd, 
        end: ctaStart,
        config: layout.secondHook || defaultLayout.secondHook!
      },
      { 
        text: item.cta, 
        key: "cta",
        start: ctaStart, 
        end: duration,
        config: layout.cta || defaultLayout.cta!
      },
    ];

    const resolvedBoxColor = hexToFfmpegColor(boxColorFromBody, "0xffffff");
    const filters: string[] = [];
    for (const seg of segments) {
      const text = (seg.text || "").trim();
      if (!text || seg.end <= seg.start) continue;
      
      // Word-wrap text to fit within the box width
      const wrappedText = wrapText(text, seg.config.w, seg.config.fontSize, videoWidth);
      
      const txtPath = join(tmpdir(), `engaging-reel-text-${randomUUID()}.txt`);
      await writeFile(txtPath, wrappedText, "utf8");
      tmpTextFiles.push(txtPath);
      const safePath = escapeDrawtextPath(txtPath);
      const safeFont = escapeDrawtextPath(fontPath);
      
      // x/y are 0-1 fractions; convert to pixel offsets
      // x is center point, so subtract half of text_w
      // y is also center-based for secondHook, or top-based for hook/cta depending on config
      const xPos = `w*${seg.config.x}-text_w/2`;
      const yPos = `h*${seg.config.y}-text_h/2`;
      
      filters.push(
        `drawtext=fontfile='${safeFont}':textfile='${safePath}':fontsize=${seg.config.fontSize}:fontcolor=black:box=1:boxcolor=${resolvedBoxColor}@0.85:boxborderw=20:x=${xPos}:y=${yPos}:enable='between(t,${seg.start},${seg.end})'`
      );
    }
    if (!filters.length) { res.status(400).json({ error: "No text to burn in — add a hook, second hook or CTA first" }); return; }

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ["-i", inputPath, "-vf", filters.join(","), "-c:a", "copy", "-y", outputPath]);
      let stderr = "";
      ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))));
      ffmpeg.on("error", reject);
    });

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `engaging-reels-rendered/${randomUUID()}.mp4`;
    const outBuf = await readFile(outputPath);
    await objectStorageClient.bucket(bucketId).file(objectPath).save(outBuf, {
      contentType: "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    const renderedVideoUrl = `/api/media/${objectPath}`;

    await db.update(engagingReelsTable).set({ renderedVideoUrl, status: "rendered", textLayout: layoutFromBody || null }).where(eq(engagingReelsTable.id, id));
    res.json({ renderedVideoUrl });
  } catch (err: any) {
    logger.error({ err }, "Engaging Reels render failed");
    res.status(500).json({ error: err.message || "Render failed" });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await Promise.all(tmpTextFiles.map((f) => unlink(f).catch(() => {})));
  }
});

// Simple word-wrap function to fit text within a box width (as fraction of video)
function wrapText(text: string, widthFraction: number, fontSize: number, videoWidth: number): string {
  // Rough estimate: average character width is ~0.5 * fontSize in pixels
  // Assume 1920px video width, so width in pixels = 1920 * widthFraction
  // Chars per line ≈ (1920 * widthFraction) / (0.5 * fontSize)
  const pixelWidth = videoWidth * widthFraction;
  const avgCharWidth = 0.5 * fontSize;
  const charsPerLine = Math.floor(pixelWidth / avgCharWidth);
  
  if (charsPerLine <= 0) return text; // fallback if config is weird
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= charsPerLine) {
      currentLine = currentLine ? currentLine + " " + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

 if (lines.length > 2) {
 const rest = lines.slice(1).join(" ");
 return [lines[0], rest].join("\n");
 }
  
  return lines.join("\n");
}

// Generates a postable caption from the hook/second hook/CTA, in one of the
// site's four house tones, same compliance rules as every other caption tool.
router.post("/engaging-reels/:id/caption", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { tone, clinicName } = (req.body || {}) as { tone?: string; clinicName?: string };
    const [item] = await db.select().from(engagingReelsTable).where(eq(engagingReelsTable.id, id));
    if (!item) { res.status(404).json({ error: "Not found" }); return; }

    const toneKey = String(tone ?? "1");
    const tonePrompt = CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["1"];

    const systemPrompt = `You write a single Instagram/Facebook caption to go under a silent B-roll reel for an aesthetics clinic. The reel has no spoken audio, just three lines of on-screen text shown in turn: an opening hook, a second line, and a closing call to action. Write a caption that sits underneath and adds to those on-screen lines rather than just repeating them.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}

On-screen text:
Hook: ${item.hook}
Second line: ${item.secondHook}
CTA: ${item.cta}

Return plain text only, no JSON, no quote marks around it, no title.
${BASE_RULES}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.9,
      max_tokens: 400,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!caption) { res.status(500).json({ error: "No caption returned" }); return; }

    await db.update(engagingReelsTable).set({ caption }).where(eq(engagingReelsTable.id, id));
    res.json({ caption });
  } catch (err: any) {
    logger.error({ err }, "Engaging Reels caption generation failed");
    res.status(500).json({ error: err.message || "Caption generation failed" });
  }
});

router.delete("/engaging-reels/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(engagingReelsTable).where(eq(engagingReelsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete" });
  }
});

export default router;

