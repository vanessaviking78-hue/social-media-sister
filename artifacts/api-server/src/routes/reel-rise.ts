import { Router, type IRouter } from "express";
import multer from "multer";
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

// Rising text reel: the page sends three flat pictures of one post, the background, the text box on its own (transparent) and the bow on its own (transparent).
// This lays the text over the background and slides it up from the bottom of the frame, with the bow staying still on top, as a silent 8 second 1080 x 1920 MP4.
const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 4 } });

const RW = 1080, RH = 1920;
const SECONDS = 8;
const START = 1; // seconds before the box starts to rise
const RISE = 4.2; // seconds it takes to rise (slow and smooth)
const TOP_GAP = 220; // where the top of the box stops, measured from the top of the reel (clear of the Instagram name bar)

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

export async function makeRiseReel(bg: Buffer, text: Buffer, bow: Buffer | null, w: number, h: number, boxTop = 0, logo: Buffer | null = null): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "rise-"));
  try {
    const bgF = join(dir, "bg.png"), txF = join(dir, "tx.png"), bwF = join(dir, "bw.png"), lgF = join(dir, "lg.png"), out = join(dir, "out.mp4");
    await writeFile(bgF, bg); await writeFile(txF, text);
    if (bow) await writeFile(bwF, bow);
    if (logo) await writeFile(lgF, logo);
    // The post is scaled to the width of the reel and centred; the empty bands above and below are the same picture, blurred.
    const ph = Math.round((RW / w) * h / 2) * 2;
    const top = Math.round((RH - ph) / 2 / 2) * 2;
    // The box rises from below the frame and stops with its top edge TOP_GAP from the top of the reel. boxTop is where the box starts inside the post picture.
    const scale = RW / w;
    const endShift = Math.round(TOP_GAP - top - boxTop * scale); // how far the text layer ends up moved, up is negative
    const startShift = RH - top + 40; // fully below the frame
    const travel = startShift - endShift;
    const p = `min(max((t-${START})/${RISE}\\,0)\\,1)`;
    // Pass 1 (one frame, so it is quick): the blurred fill and the post become one still picture, and the layers are sized to the reel.
    const basePng = join(dir, "base.png");
    await runFfmpeg([
      "-i", bgF, "-filter_complex",
      `[0:v]split[a][b];[a]scale=${RW}:${RH}:force_original_aspect_ratio=increase,crop=${RW}:${RH},boxblur=40:6[fill];[b]scale=${RW}:${ph},setsar=1[post];[fill][post]overlay=0:${top}`,
      "-frames:v", "1", "-y", basePng,
    ]);
    // Pass 2: only the text layer moves. The bow and logo stay still on top.
    const rise = `overlay=x=0:y='${top + endShift}+${travel}*pow(1-${p}\\,3)':format=auto`;
    const bowIdx = 2, logoIdx = bow ? 3 : 2;
    // Only the text box moves. The bow and the logo are laid on top afterwards and stay exactly where they are.
    const filter =
      `[1:v]scale=${RW}:${ph},format=rgba[tx];` +
      `[0:v][tx]${rise}[withtext]` +
      (bow ? `;[${bowIdx}:v]scale=${RW}:${ph},format=rgba[bw];[withtext][bw]overlay=0:${top}:format=auto[withbow]` : `;[withtext]null[withbow]`) +
      (logo ? `;[${logoIdx}:v]scale=${RW}:${ph},format=rgba[lg];[withbow][lg]overlay=0:${top}:format=auto[v]` : `;[withbow]null[v]`);
    const args = [
      "-loop", "1", "-framerate", "30", "-t", String(SECONDS), "-i", basePng,
      "-loop", "1", "-framerate", "30", "-t", String(SECONDS), "-i", txF,
      ...(bow ? ["-loop", "1", "-framerate", "30", "-t", String(SECONDS), "-i", bwF] : []),
      ...(logo ? ["-loop", "1", "-framerate", "30", "-t", String(SECONDS), "-i", lgF] : []),
      "-filter_complex", filter, "-map", "[v]", "-an",
      "-t", String(SECONDS),
      "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "ultrafast", "-crf", "21",
      "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "-y", out,
    ];
    await runFfmpeg(args);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// The video takes longer than a browser or proxy will wait on one request, so the page gets a job number straight away and asks for it again until it is done.
type Job = { state: "working" | "done" | "failed"; url?: string; error?: string; at: number };
const jobs = new Map<string, Job>();
const sweep = () => { const cut = Date.now() - 30 * 60 * 1000; for (const [k, v] of jobs) if (v.at < cut) jobs.delete(k); };

router.post("/reel-rise", upload.fields([{ name: "bg", maxCount: 1 }, { name: "text", maxCount: 1 }, { name: "bow", maxCount: 1 }, { name: "logo", maxCount: 1 }]), async (req, res) => {
  const f = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
  const bg = f.bg?.[0], text = f.text?.[0], bow = f.bow?.[0] ?? null, logo = f.logo?.[0] ?? null;
  if (!bg || !text) { res.status(400).json({ error: "The background and the text box are both needed" }); return; }
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
  const w = Math.max(100, Math.min(4000, Number(req.body?.w) || 1080));
  const h = Math.max(100, Math.min(4000, Number(req.body?.h) || 1440));
  const boxTop = Math.max(0, Math.min(h, Number(req.body?.boxTop) || 0));
  sweep();
  const id = uuidv4();
  jobs.set(id, { state: "working", at: Date.now() });
  res.json({ jobId: id });
  try {
    const buf = await makeRiseReel(bg.buffer, text.buffer, bow?.buffer ?? null, w, h, boxTop, logo?.buffer ?? null);
    const objectPath = `reels/${uuidv4()}.mp4`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(buf, { contentType: "video/mp4", metadata: { cacheControl: "public, max-age=31536000" } });
    jobs.set(id, { state: "done", url: `/api/media/${objectPath}`, at: Date.now() });
  } catch (err) {
    logger.error({ err }, "rise reel failed");
    jobs.set(id, { state: "failed", error: "Could not make the reel", at: Date.now() });
  }
});

router.get("/reel-rise/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) { res.status(404).json({ error: "That reel is no longer there, try again" }); return; }
  res.json({ state: j.state, videoUrl: j.url, error: j.error, seconds: SECONDS });
});

export default router;
