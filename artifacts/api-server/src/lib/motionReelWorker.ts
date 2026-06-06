import { v4 as uuid } from "uuid";
import { db } from "@workspace/db";
import { contentLibraryTable } from "@workspace/db/schema";
import { objectStorageClient } from "./objectStorage";
import { logger } from "./logger";

const FAL_BASE = "https://queue.fal.run/fal-ai/wan/v2.5/image-to-video";
const IMGBB_BASE = "https://api.imgbb.com/1/upload";

const NEGATIVE_PROMPT =
  "movement, expression change, blinking, mouth movement, talking, body motion, head turn, hands moving, hair blowing, animated, cartoon, distortion, AI artifacts, glitch, warping, morphing";

export type CameraMotion =
  | "slow-pan-left"
  | "slow-pan-right"
  | "dolly-in"
  | "dolly-out"
  | "tilt-up"
  | "cinematic-drift";

export const CAMERA_MOTION_LABELS: Record<CameraMotion, string> = {
  "slow-pan-left": "Slow pan — left to right",
  "slow-pan-right": "Slow pan — right to left",
  "dolly-in": "Slow dolly in (zoom toward subject)",
  "dolly-out": "Slow dolly out (pull back)",
  "tilt-up": "Slow tilt up",
  "cinematic-drift": "Cinematic drift (micro-pan and dolly)",
};

function buildPrompt(motion: CameraMotion): string {
  const base =
    "Cinematic portrait video. The person remains completely still. No facial movement. No expression change. No mouth movement. No eye movement. No body movement. No hair movement. High quality. Editorial photography aesthetic. Soft natural lighting unchanged. Smooth, stable footage. No AI artifacts.";
  const motionClause: Record<CameraMotion, string> = {
    "slow-pan-left":
      "Subtle slow camera pan from left to right, approximately 2-3 percent of frame width over the entire clip.",
    "slow-pan-right":
      "Subtle slow camera pan from right to left, approximately 2-3 percent of frame width over the entire clip.",
    "dolly-in":
      "Gentle slow camera dolly in, a subtle zoom toward the subject — approximately 3 percent scale increase over the entire clip.",
    "dolly-out":
      "Gentle slow camera dolly out, a subtle pull-back from the subject — approximately 3 percent scale decrease over the entire clip.",
    "tilt-up":
      "Slow subtle camera tilt upward over the entire clip, revealing the upper frame gradually.",
    "cinematic-drift":
      "Combined micro-pan left and gentle dolly in — a dreamy editorial camera drift. Slow, smooth, barely perceptible movement.",
  };
  return `${base} ${motionClause[motion]}`;
}

export type MotionJobStatus = "queued" | "uploading" | "submitting" | "processing" | "saving" | "done" | "failed";

export interface MotionJob {
  status: MotionJobStatus;
  progress: number;
  message: string;
  videoUrl?: string;
  libraryId?: number;
  error?: string;
  startedAt: number;
}

const motionJobs = new Map<string, MotionJob>();

setInterval(() => {
  const cutoff = Date.now() - 20 * 60_000;
  for (const [id, job] of motionJobs) {
    if (job.startedAt < cutoff) motionJobs.delete(id);
  }
}, 5 * 60_000).unref();

export function createMotionJob(jobId: string): void {
  motionJobs.set(jobId, { status: "queued", progress: 0, message: "Queued", startedAt: Date.now() });
}

export function getMotionJob(jobId: string): MotionJob | undefined {
  return motionJobs.get(jobId);
}

function patch(jobId: string, update: Partial<MotionJob>): void {
  const job = motionJobs.get(jobId);
  if (job) motionJobs.set(jobId, { ...job, ...update });
}

async function safeJson<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`${context} returned an empty response (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${context} returned an unexpected response (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

async function uploadToImgBB(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error("IMGBB_API_KEY not set — needed to create public image URL for video AI");
  const b64 = imageBuffer.toString("base64");
  const form = new URLSearchParams();
  form.set("key", apiKey);
  form.set("image", b64);
  const res = await fetch(`${IMGBB_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await safeJson<{ data?: { url?: string }; error?: { message?: string } }>(res, "ImgBB upload");
  if (!res.ok || !data?.data?.url) {
    throw new Error(`ImgBB upload failed (${res.status}): ${data?.error?.message || "no image URL returned"}`);
  }
  return data.data.url as string;
}

async function submitFalJob(imageUrl: string, motion: CameraMotion): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not set — add it in Settings to enable motion reel generation");
  const body = {
    image_url: imageUrl,
    prompt: buildPrompt(motion),
    negative_prompt: NEGATIVE_PROMPT,
    num_frames: 81,
    frames_per_second: 16,
    resolution: "720p",
    aspect_ratio: "9:16",
  };
  const res = await fetch(FAL_BASE, {
    method: "POST",
    headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await safeJson<{ request_id?: string; error?: string }>(res, "Fal.ai submission");
  if (!res.ok || !data?.request_id) {
    throw new Error(`Fal.ai submission failed (${res.status}): ${data?.error ?? JSON.stringify(data)}`);
  }
  return data.request_id as string;
}

async function pollFalJob(requestId: string, jobId: string): Promise<string> {
  const falKey = process.env.FAL_KEY!;
  const statusUrl = `${FAL_BASE}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/requests/${requestId}`;
  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000));
    attempts++;
    const progress = Math.min(0.2 + (attempts / maxAttempts) * 0.65, 0.85);
    patch(jobId, { progress, message: `AI processing… (${Math.round(progress * 100)}%)` });
    let sd: { status?: string; error?: string } = {};
    try {
      const sr = await fetch(statusUrl, { headers: { "Authorization": `Key ${falKey}` } });
      sd = await safeJson<typeof sd>(sr, "Fal.ai status");
    } catch (err: unknown) {
      logger.warn({ err, requestId, attempts }, "Fal status poll error — retrying");
      continue;
    }
    if (sd?.status === "COMPLETED") {
      const rr = await fetch(resultUrl, { headers: { "Authorization": `Key ${falKey}` } });
      const rd = await safeJson<{ video?: { url?: string } }>(rr, "Fal.ai result");
      const url = rd?.video?.url;
      if (!url) throw new Error("Fal.ai completed but returned no video URL");
      return url as string;
    }
    if (sd?.status === "FAILED") {
      throw new Error(`Fal.ai processing failed: ${sd?.error || "Unknown error"}`);
    }
  }
  throw new Error("Timed out waiting for Fal.ai video generation (5 minutes)");
}

async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download generated video: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadVideoToStorage(buf: Buffer): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const key = `motion-reels/${uuid()}/motion-reel.mp4`;
  await objectStorageClient.bucket(bucketId).file(key).save(buf, {
    contentType: "video/mp4",
    metadata: { cacheControl: "public, max-age=86400" },
  });
  return `/api/media/${key}`;
}

export async function processMotionJob(
  jobId: string,
  imageBuffer: Buffer,
  imageMime: string,
  cameraMotion: CameraMotion,
  clientName: string,
  scenarioName: string,
): Promise<void> {
  try {
    patch(jobId, { status: "uploading", progress: 0.05, message: "Uploading source image…" });
    const publicImageUrl = await uploadToImgBB(imageBuffer, imageMime);

    patch(jobId, { status: "submitting", progress: 0.12, message: "Submitting to AI model…" });
    const requestId = await submitFalJob(publicImageUrl, cameraMotion);

    patch(jobId, { status: "processing", progress: 0.2, message: "AI generating video…" });
    const videoUrl = await pollFalJob(requestId, jobId);

    patch(jobId, { status: "saving", progress: 0.88, message: "Saving video…" });
    const videoBuf = await downloadVideo(videoUrl);
    const storedUrl = await uploadVideoToStorage(videoBuf);

    const motionLabel = CAMERA_MOTION_LABELS[cameraMotion] || cameraMotion;
    const [libraryRow] = await db.insert(contentLibraryTable).values({
      clientName,
      postType: "reel",
      caption: `Motion Portrait — ${scenarioName} (${motionLabel})`,
      mediaUrl: storedUrl,
      metadata: {
        source: "motion-reel",
        scenarioName,
        cameraMotion,
        tag: "Motion Portrait",
      } as Record<string, unknown>,
    }).returning();

    patch(jobId, { status: "done", progress: 1, message: "Done", videoUrl: storedUrl, libraryId: libraryRow?.id });
  } catch (err: any) {
    const msg = err?.message || "Motion reel generation failed";
    logger.error({ err, jobId }, "processMotionJob failed");
    patch(jobId, { status: "failed", progress: 0, message: msg, error: msg });
  }
}
