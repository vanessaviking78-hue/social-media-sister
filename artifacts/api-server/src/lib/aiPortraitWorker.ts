import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { db } from "@workspace/db";
import { aiGeneratedPortraitsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { logger } from "./logger";
import { buildPrompt, buildCustomPrompt, buildPhotoStudioPrompt, AI_PORTRAIT_SCENARIOS, PHOTO_STUDIO_PRESETS } from "./aiPortraitScenarios";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const REQUEST_GAP_MS = 4_000;
const RATE_LIMIT_BACKOFF_MS = 30_000;

export type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";

export interface CardState {
  portraitId?: number;
  scenarioId: string;
  status: CardStatus;
  outputImageUrl?: string;
  failureReason?: string;
  retryAfter?: number;
}

export interface PortraitJob {
  cards: CardState[];
  startedAt: number;
}

const jobs = new Map<string, PortraitJob>();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id);
  }
}, 10 * 60_000).unref();

export function getJob(jobId: string): PortraitJob | undefined {
  return jobs.get(jobId);
}

export function createJob(jobId: string, scenarioIds: string[]): void {
  jobs.set(jobId, {
    cards: scenarioIds.map((id) => ({ scenarioId: id, status: "idle" })),
    startedAt: Date.now(),
  });
}

async function uploadBuf(buffer: Buffer, filename: string, folder: string, mime = "image/png"): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const key = `${folder}/${uuid()}/${filename}`;
  await objectStorageClient.bucket(bucketId).file(key).save(buffer, {
    contentType: mime,
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return `/api/media/${key}`;
}

async function fetchBufFromStorageLocal(urlOrPath: string): Promise<Buffer> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  let key: string;
  if (urlOrPath.startsWith("/api/media/")) {
    key = urlOrPath.slice("/api/media/".length);
  } else if (urlOrPath.startsWith("/api/ai-portrait/images/")) {
    key = urlOrPath.slice("/api/ai-portrait/images/".length);
  } else if (urlOrPath.startsWith("https://storage.googleapis.com/")) {
    const u = new URL(urlOrPath);
    key = u.pathname.slice(1).replace(`${bucketId}/`, "");
  } else {
    throw new Error(`Cannot resolve image path: ${urlOrPath}`);
  }
  const [buffer] = await objectStorageClient.bucket(bucketId).file(key).download();
  return buffer;
}

async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const fontSize = Math.round(w * 0.022);
  const padding = Math.round(w * 0.012);
  const text = "AI portrait by The CyberSuite";
  const svgWatermark = `
    <svg width="${w}" height="${h}">
      <style>
        .wm { fill: rgba(255,255,255,0.55); font-family: sans-serif; font-size: ${fontSize}px; }
      </style>
      <text class="wm" x="${w - padding}" y="${h - padding}" text-anchor="end">${text}</text>
    </svg>`.trim();
  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svgWatermark), blend: "over" }])
    .png()
    .toBuffer();
}

interface ScenarioConfig {
  id: string;
  scrubColor?: string;
  outfitStyle?: string;
  outfitType?: string;
  backgroundType?: string;
  backdropColor?: string;
  backgroundImageUrl?: string;
  aspectRatio: string;
}

export async function processPortraitJob(
  jobId: string,
  sourcePhotoBuffer: Buffer,
  sourcePhotoId: number,
  clientName: string,
  scenarios: ScenarioConfig[],
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("GEMINI_API_KEY not set — portrait generation disabled");
    const job = jobs.get(jobId);
    if (job) {
      job.cards = job.cards.map((c) => ({
        ...c,
        status: "failed",
        failureReason: "GEMINI_API_KEY is not configured.",
      }));
    }
    return;
  }

  const genAI = new GoogleGenAI({ apiKey });

  for (let i = 0; i < scenarios.length; i++) {
    const cfg = scenarios[i];
    const job = jobs.get(jobId);
    if (!job) return;

    const cardIdx = job.cards.findIndex((c) => c.scenarioId === cfg.id);
    if (cardIdx === -1) continue;

    const patchCard = (update: Partial<CardState>) => {
      const j = jobs.get(jobId);
      if (!j) return;
      j.cards[cardIdx] = { ...j.cards[cardIdx], ...update };
    };

    patchCard({ status: "generating" });

    // Build prompt — photo studio presets take priority, then custom outfit/background, then legacy scenarios
    let prompt: string;
    let backgroundImageUrl = cfg.backgroundImageUrl;

    const photoStudioPreset = PHOTO_STUDIO_PRESETS.find((p) => p.id === cfg.id);

    if (photoStudioPreset) {
      prompt = buildPhotoStudioPrompt(photoStudioPreset, cfg.scrubColor, cfg.aspectRatio);
    } else if (cfg.outfitType) {
      prompt = buildCustomPrompt({
        outfitType: cfg.outfitType as Parameters<typeof buildCustomPrompt>[0]["outfitType"],
        backgroundType: (cfg.backgroundType ?? "white-studio") as Parameters<typeof buildCustomPrompt>[0]["backgroundType"],
        scrubColor: cfg.scrubColor,
        backdropColor: cfg.backdropColor,
        aspectRatio: cfg.aspectRatio,
      });
    } else if (cfg.outfitStyle?.startsWith("{")) {
      // Regen of a custom portrait — outfitStyle stores the original config as JSON
      try {
        const parsed = JSON.parse(cfg.outfitStyle) as {
          outfitType?: string; backgroundType?: string;
          scrubColor?: string; backdropColor?: string; backgroundImageUrl?: string;
        };
        if (parsed.backgroundImageUrl && !backgroundImageUrl) backgroundImageUrl = parsed.backgroundImageUrl;
        prompt = buildCustomPrompt({
          outfitType: (parsed.outfitType ?? "white-shirt-jeans") as Parameters<typeof buildCustomPrompt>[0]["outfitType"],
          backgroundType: (parsed.backgroundType ?? "white-studio") as Parameters<typeof buildCustomPrompt>[0]["backgroundType"],
          scrubColor: cfg.scrubColor ?? parsed.scrubColor,
          backdropColor: parsed.backdropColor,
          aspectRatio: cfg.aspectRatio,
        });
      } catch {
        prompt = buildCustomPrompt({ outfitType: "white-shirt-jeans", backgroundType: "white-studio", aspectRatio: cfg.aspectRatio });
      }
    } else {
      const scenario = AI_PORTRAIT_SCENARIOS.find((s) => s.id === cfg.id);
      if (!scenario) {
        patchCard({ status: "failed", failureReason: "Unknown scenario id." });
        continue;
      }
      prompt = buildPrompt(scenario, cfg.scrubColor, cfg.outfitStyle, cfg.aspectRatio);
    }

    // Detect actual MIME type from buffer bytes so non-JPEG uploads work correctly
    const sharpMeta = await sharp(sourcePhotoBuffer).metadata();
    const formatToMime: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const sourceMime = formatToMime[sharpMeta.format ?? ""] ?? "image/jpeg";
    const base64Photo = sourcePhotoBuffer.toString("base64");

    // Fetch uploaded background image when "upload-own" background type is used
    let backgroundImagePart: { inlineData: { mimeType: string; data: string } } | null = null;
    if (backgroundImageUrl) {
      try {
        const bgBuf = await fetchBufFromStorageLocal(backgroundImageUrl);
        const bgMeta = await sharp(bgBuf).metadata();
        const bgMime = formatToMime[bgMeta.format ?? ""] ?? "image/jpeg";
        backgroundImagePart = { inlineData: { mimeType: bgMime, data: bgBuf.toString("base64") } };
      } catch (e) {
        logger.warn({ err: e, backgroundImageUrl }, "Failed to fetch background image — generating without it");
      }
    }

    let attempt = 0;
    let succeeded = false;

    while (attempt < 2 && !succeeded) {
      try {
        const result = await genAI.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: sourceMime, data: base64Photo } },
                ...(backgroundImagePart ? [backgroundImagePart] : []),
                { text: prompt },
              ],
            },
          ],
          config: { responseModalities: ["IMAGE", "TEXT"] },
        });

        const parts = result.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));

        if (!imagePart?.inlineData?.data) {
          throw new Error("Gemini returned no image in response.");
        }

        const imgBuffer = Buffer.from(imagePart.inlineData.data, "base64");

        const [originalUrl, watermarkedBuffer] = await Promise.all([
          uploadBuf(imgBuffer, `portrait-${cfg.id}-original.png`, "ai-portraits/original"),
          applyWatermark(imgBuffer),
        ]);
        const outputUrl = await uploadBuf(
          watermarkedBuffer,
          `portrait-${cfg.id}-wm.png`,
          "ai-portraits/watermarked",
        );

        const storedOutfitStyle = cfg.outfitType
          ? JSON.stringify({ outfitType: cfg.outfitType, backgroundType: cfg.backgroundType, backdropColor: cfg.backdropColor, backgroundImageUrl })
          : cfg.outfitStyle;

        const [row] = await db
          .insert(aiGeneratedPortraitsTable)
          .values({
            clientName,
            sourcePhotoId,
            scenarioId: cfg.id,
            prompt,
            scrubColor: cfg.scrubColor,
            outfitStyle: storedOutfitStyle,
            aspectRatio: cfg.aspectRatio,
            originalImageUrl: originalUrl,
            outputImageUrl: outputUrl,
            hasWatermark: true,
            status: "success",
          })
          .returning();

        patchCard({ status: "success", outputImageUrl: outputUrl, portraitId: row.id });
        succeeded = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");

        if (is429 && attempt === 0) {
          patchCard({ status: "rate-limited", retryAfter: Date.now() + RATE_LIMIT_BACKOFF_MS });
          logger.warn({ jobId, scenarioId: cfg.id }, "Rate limited — waiting 30s");
          await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
          patchCard({ status: "generating", retryAfter: undefined });
          attempt++;
        } else {
          logger.error({ jobId, scenarioId: cfg.id, err: msg }, "Portrait generation failed");

          const [failedRow] = await db
            .insert(aiGeneratedPortraitsTable)
            .values({
              clientName,
              sourcePhotoId,
              scenarioId: cfg.id,
              prompt,
              scrubColor: cfg.scrubColor,
              outfitStyle: cfg.outfitType ? JSON.stringify({ outfitType: cfg.outfitType, backgroundType: cfg.backgroundType, backdropColor: cfg.backdropColor, backgroundImageUrl }) : cfg.outfitStyle,
              aspectRatio: cfg.aspectRatio,
              status: "failed",
              failureReason: msg,
            })
            .returning()
            .catch(() => [] as typeof aiGeneratedPortraitsTable.$inferSelect[]);

          patchCard({ status: "failed", failureReason: msg, portraitId: failedRow?.id });
          break;
        }
      }
    }

    if (i < scenarios.length - 1) {
      await new Promise((r) => setTimeout(r, REQUEST_GAP_MS));
    }
  }
}

export async function regenerateSingleCard(
  jobId: string,
  portraitId: number,
  sourcePhotoBuffer: Buffer,
): Promise<void> {
  const portrait = await db.query.aiGeneratedPortraitsTable.findFirst({
    where: eq(aiGeneratedPortraitsTable.id, portraitId),
  });
  if (!portrait) return;

  const job = jobs.get(jobId) ?? ({ cards: [], startedAt: Date.now() } as PortraitJob);
  if (!jobs.has(jobId)) jobs.set(jobId, job);

  let card = job.cards.find((c) => c.portraitId === portraitId || c.scenarioId === portrait.scenarioId);
  if (!card) {
    job.cards.push({ scenarioId: portrait.scenarioId, status: "idle", portraitId });
    card = job.cards[job.cards.length - 1];
  }

  await processPortraitJob(
    jobId,
    sourcePhotoBuffer,
    portrait.sourcePhotoId,
    portrait.clientName,
    [{ id: portrait.scenarioId, scrubColor: portrait.scrubColor ?? undefined, outfitStyle: portrait.outfitStyle ?? undefined, aspectRatio: portrait.aspectRatio }],
  );

  const updatedJob = jobs.get(jobId);
  const updatedCard = updatedJob?.cards.find((c) => c.scenarioId === portrait.scenarioId);

  if (updatedCard?.status === "success" && updatedCard.portraitId && updatedCard.portraitId !== portraitId) {
    const newRow = await db.query.aiGeneratedPortraitsTable.findFirst({
      where: eq(aiGeneratedPortraitsTable.id, updatedCard.portraitId),
    });
    if (newRow) {
      await db
        .update(aiGeneratedPortraitsTable)
        .set({
          status: "success",
          outputImageUrl: newRow.outputImageUrl,
          originalImageUrl: newRow.originalImageUrl,
          failureReason: null,
        })
        .where(eq(aiGeneratedPortraitsTable.id, portraitId))
        .catch(() => {});
      await db
        .delete(aiGeneratedPortraitsTable)
        .where(eq(aiGeneratedPortraitsTable.id, updatedCard.portraitId))
        .catch(() => {});
      const jobRef = jobs.get(jobId);
      if (jobRef) {
        const cardIdx = jobRef.cards.findIndex((c) => c.scenarioId === portrait.scenarioId);
        if (cardIdx !== -1) jobRef.cards[cardIdx].portraitId = portraitId;
      }
    }
  } else if (updatedCard?.status === "failed") {
    await db
      .update(aiGeneratedPortraitsTable)
      .set({ status: "failed", failureReason: updatedCard.failureReason ?? "Unknown error" })
      .where(eq(aiGeneratedPortraitsTable.id, portraitId))
      .catch(() => {});
  }
}
