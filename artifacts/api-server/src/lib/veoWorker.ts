import { v4 as uuid } from "uuid";
import { objectStorageClient } from "./objectStorage";
import { logger } from "./logger";

// Generates video from a text prompt using Google's Veo 3.1 model, through
// the same Gemini API key already used elsewhere in this app (GEMINI_API_KEY).
// Runs the exact same async job pattern as processMotionJob in
// motionReelWorker.ts — submit, poll, download, store — since video
// generation is a long-running operation (Google quotes 11 seconds to 6
// minutes) that can't be held open on a single request.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type VeoTier = "lite" | "fast" | "standard";

const MODEL_BY_TIER: Record<VeoTier, string> = {
  lite: "veo-3.1-lite-generate-preview",
  fast: "veo-3.1-fast-generate-preview",
  standard: "veo-3.1-generate-preview",
};

export type VeoJobStatus = "queued" | "submitting" | "processing" | "saving" | "done" | "failed";

export interface VeoJob {
  status: VeoJobStatus;
  progress: number;
  message: string;
  videoUrl?: string;
  error?: string;
  startedAt: number;
  prompt: string;
  clientName?: string;
}

const veoJobs = new Map<string, VeoJob>();

// Same cleanup pattern as motionJobs — jobs older than 20 minutes are
// dropped, the finished videoUrl is already saved to permanent storage by
// then so nothing is lost, just the in-memory progress tracker.
setInterval(() => {
  const cutoff = Date.now() - 20 * 60_000;
  for (const [id, job] of veoJobs) {
    if (job.startedAt < cutoff) veoJobs.delete(id);
  }
}, 5 * 60_000).unref();

export function createVeoJob(jobId: string, prompt: string, clientName?: string): void {
  veoJobs.set(jobId, { status: "queued", progress: 0, message: "Queued", startedAt: Date.now(), prompt, clientName });
}

export function getVeoJob(jobId: string): VeoJob | undefined {
  return veoJobs.get(jobId);
}

function patch(jobId: string, update: Partial<VeoJob>): void {
  const job = veoJobs.get(jobId);
  if (job) veoJobs.set(jobId, { ...job, ...update });
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

interface StartOperationResponse {
  name?: string;
  error?: { message?: string };
}

async function submitVeoJob(prompt: string, aspectRatio: "16:9" | "9:16", model: string, durationSeconds: "4" | "6" | "8"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set — add it in Railway > Variables.");
  const res = await fetch(`${GEMINI_BASE}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio, durationSeconds: Number(durationSeconds) },
    }),
  });
  const data = await safeJson<StartOperationResponse>(res, "Veo submission");
  if (!res.ok || !data.name) {
    throw new Error(`Veo submission failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data.name;
}

interface OperationStatusResponse {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
    };
  };
}

async function pollVeoOperation(operationName: string, jobId: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  let attempts = 0;
  const pollIntervalMs = 10_000;
  const maxAttempts = 60; // 10 minutes — Veo's own quoted max latency is 6 minutes
  while (true) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    attempts++;
    const elapsedSec = attempts * (pollIntervalMs / 1000);
    const progress = Math.min(0.15 + (attempts / 36) * 0.65, 0.80);
    patch(jobId, { progress, message: `Generating your video… (${elapsedSec}s elapsed, usually 1-3 minutes)` });

    const res = await fetch(`${GEMINI_BASE}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    const data = await safeJson<OperationStatusResponse>(res, "Veo status check");

    if (data.error) {
      throw new Error(`Veo video generation failed: ${data.error.message || "unknown error"}`);
    }
    if (data.done) {
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error("Veo finished but returned no video URI.");
      return uri;
    }
    if (attempts >= maxAttempts) {
      throw new Error("Veo video generation did not complete within 10 minutes. It may still finish on Google's side — try again shortly.");
    }
  }
}

async function downloadVeoVideo(uri: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const res = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) throw new Error(`Failed to download generated video: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadVideoToStorage(buf: Buffer): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const key = `veo-videos/${uuid()}/veo-video.mp4`;
  await objectStorageClient.bucket(bucketId).file(key).save(buf, {
    contentType: "video/mp4",
    metadata: { cacheControl: "public, max-age=86400" },
  });
  return `/api/media/${key}`;
}

export async function processVeoJob(
  jobId: string,
  prompt: string,
  aspectRatio: "16:9" | "9:16",
  tier: VeoTier,
  durationSeconds: "4" | "6" | "8" = "8",
): Promise<void> {
  try {
    patch(jobId, { status: "submitting", progress: 0.05, message: "Sending your prompt to Veo…" });
    const model = MODEL_BY_TIER[tier];
    const operationName = await submitVeoJob(prompt, aspectRatio, model, durationSeconds);

    patch(jobId, { status: "processing", progress: 0.15, message: "Generating your video…" });
    const videoUri = await pollVeoOperation(operationName, jobId);

    patch(jobId, { status: "saving", progress: 0.9, message: "Saving video…" });
    const videoBuf = await downloadVeoVideo(videoUri);
    const storedUrl = await uploadVideoToStorage(videoBuf);

    patch(jobId, { status: "done", progress: 1, message: "Ready", videoUrl: storedUrl });
  } catch (err: any) {
    const msg = err?.message || "Video generation failed";
    logger.error({ err, jobId }, "processVeoJob failed");
    patch(jobId, { status: "failed", progress: 0, message: msg, error: msg });
  }
}
