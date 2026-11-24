import { Router, type IRouter } from "express";
import multer from "multer";
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import {
  SPARKLE_AMOUNTS, SPARKLE_STYLES, SPARKLE_H, SPARKLE_SECONDS, SPARKLE_W,
  sparkleOverlayFile, type SparkleAmount, type SparkleStyle,
} from "../lib/sparkleOverlay";

// Sparkle: takes the finished slides of a Christmas post and gives back one short looping MP4 per slide,
// with falling snow, gold glitter or twinkling stars over the top. Instagram will not play a GIF in a carousel,
// but it plays video slides happily, and they can sit next to ordinary still slides.
const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 8 } });

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

// What the buttons offer, so the page and the server always agree.
router.get("/sparkle/options", (_req, res) => {
  res.json({ styles: SPARKLE_STYLES, amounts: SPARKLE_AMOUNTS, seconds: SPARKLE_SECONDS });
});

router.post("/sparkle", upload.array("slides", 8), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) { res.status(400).json({ error: "No slides received" }); return; }
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }

  const style = (SPARKLE_STYLES as string[]).includes(req.body?.style) ? (req.body.style as SparkleStyle) : "gold";
  const amount = (SPARKLE_AMOUNTS as string[]).includes(req.body?.amount) ? (req.body.amount as SparkleAmount) : "medium";
  // Slides the person wants to keep still (for example the cover) can be named by position, starting at 0.
  const dir = await mkdtemp(join(tmpdir(), "sparkle-"));
  try {
    const overlay = await sparkleOverlayFile(style, amount);
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const slide = join(dir, `s${i}.png`);
      const out = join(dir, `s${i}.mp4`);
      await writeFile(slide, files[i].buffer);
      await runFfmpeg([
        "-loop", "1", "-framerate", "30", "-t", String(SPARKLE_SECONDS), "-i", slide,
        "-stream_loop", "-1", "-i", overlay,
        "-f", "lavfi", "-t", String(SPARKLE_SECONDS), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-filter_complex",
        `[0:v]scale=${SPARKLE_W}:${SPARKLE_H}:force_original_aspect_ratio=decrease,pad=${SPARKLE_W}:${SPARKLE_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=rgba[bg];` +
        `[bg][1:v]overlay=shortest=1:format=auto,fps=30,format=yuv420p[v]`,
        "-map", "[v]", "-map", "2:a",
        "-t", String(SPARKLE_SECONDS),
        "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "veryfast", "-crf", "19",
        "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-shortest", "-y", out,
      ]);
      const buf = await readFile(out);
      const objectPath = `sparkle/${uuidv4()}.mp4`;
      await objectStorageClient.bucket(bucketId).file(objectPath).save(buf, {
        contentType: "video/mp4",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      urls.push(`/api/media/${objectPath}`);
    }
    res.json({ videoUrls: urls, seconds: SPARKLE_SECONDS, style, amount });
  } catch (err) {
    logger.error({ err }, "sparkle failed");
    res.status(500).json({ error: "Could not add the sparkle" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
