import { Router, type IRouter } from "express";
import multer from "multer";
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

// Turns the slides of one Stylish post into a 1080x1440 reel: each slide holds on screen for a
// beat, with a short crossfade between them, and a silent audio track so Instagram accepts it.
const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 12 } });

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", d => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

router.post("/stylish-reel", upload.array("slides", 12), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) { res.status(400).json({ error: "No slides received" }); return; }
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }

  const secondsPer = Math.min(6, Math.max(1.5, Number(req.body?.secondsPerSlide) || 2.5));
  const fade = 0.4;
  const dir = await mkdtemp(join(tmpdir(), "stylish-reel-"));
  try {
    const inputs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const p = join(dir, `s${i}.png`);
      await writeFile(p, files[i].buffer);
      inputs.push("-loop", "1", "-t", String(secondsPer + fade), "-i", p);
    }
    const n = files.length;
    const scale = (i: number) => `[${i}:v]scale=1080:1440:force_original_aspect_ratio=decrease,pad=1080:1440:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`;
    const parts = Array.from({ length: n }, (_, i) => scale(i));
    let last = "v0";
    if (n > 1) {
      for (let i = 1; i < n; i++) {
        const out = i === n - 1 ? "vout" : `x${i}`;
                parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(secondsPer * i).toFixed(2)}[${out}]`);
        last = out;
      }
    } else {
      parts.push("[v0]null[vout]");
    }
    const total = secondsPer * n + fade;
    const outPath = join(dir, "reel.mp4");
    await runFfmpeg([
      ...inputs,
      "-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex", parts.join(";"),
      "-map", "[vout]", "-map", `${n}:a`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "96k", "-shortest", "-y", outPath,
    ]);
    const buf = await readFile(outPath);
    const objectPath = `stylish-reels/${uuidv4()}.mp4`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(buf, {
      contentType: "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    res.json({ videoUrl: `/api/media/${objectPath}`, seconds: Number(total.toFixed(1)) });
  } catch (err) {
    logger.error({ err }, "stylish-reel failed");
    res.status(500).json({ error: "Could not make the reel" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

// Stores a finished MP4 made in the browser (Magazine Flip) so it can be scheduled as a reel.
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });
router.post("/stylish-reel/upload", uploadVideo.single("video"), async (req, res) => {
  const f = req.file;
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!f) { res.status(400).json({ error: "No video received" }); return; }
  if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
  try {
    const objectPath = `stylish-reels/${uuidv4()}.mp4`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(f.buffer, {
      contentType: "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    res.json({ videoUrl: `/api/media/${objectPath}` });
  } catch (err) {
    logger.error({ err }, "stylish-reel upload failed");
    res.status(500).json({ error: "Could not store the video" });
  }
});

// Turns a short clip recorded in the browser (WebM from MediaRecorder) into a proper H.264 MP4
// with a silent audio track, and sends it straight back for download. Nothing is stored.
router.post("/stylish-reel/convert", uploadVideo.single("video"), async (req, res) => {
  const f = req.file;
  if (!f) { res.status(400).json({ error: "No video received" }); return; }
  const dir = await mkdtemp(join(tmpdir(), "stylish-convert-"));
  try {
    const inPath = join(dir, "in.webm");
    const outPath = join(dir, "out.mp4");
    await writeFile(inPath, f.buffer);
    // 1440 is the grid shape, 1920 is full screen reel / story shape.
    const outH = req.body?.height === "1920" ? 1920 : 1440;
    await runFfmpeg([
      "-i", inPath,
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-vf", `scale=1080:${outH}:force_original_aspect_ratio=decrease,pad=1080:${outH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "96k", "-shortest", "-y", outPath,
    ]);
    const buf = await readFile(outPath);
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (req.body?.store === "1" && bucketId) {
      const objectPath = `stylish-reels/${uuidv4()}.mp4`;
      await objectStorageClient.bucket(bucketId).file(objectPath).save(buf, {
        contentType: "video/mp4",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      res.json({ videoUrl: `/api/media/${objectPath}` });
      return;
    }
    res.setHeader("Content-Type", "video/mp4");
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "stylish-reel convert failed");
    res.status(500).json({ error: "Could not convert the clip" });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
