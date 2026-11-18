import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { REALISTIC_XMAS_PRESETS, buildPhotoStudioPrompt } from "./aiPortraitScenarios";
import { readObject, saveObject } from "./photoshootWorker";
import { fileIntoApprovedPhotos } from "./aiPortraitWorker";
import { objectStorageClient } from "./objectStorage";
import { geminiOk, geminiFailed } from "./aiCreditAlert";
import { logger } from "./logger";

// CYBERSUITE CHRISTMAS SHOOT. One selfie in, the ten REALISTIC XMAS portraits out, in the colour the person chose.
// Images are saved on the order as they finish, so a half finished order never loses what it has made.

const MODEL = "gemini-2.5-flash-image";
const GAP_MS = 4000;
const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const XMAS_SHOT_COUNT = REALISTIC_XMAS_PRESETS.length;

type OrderRow = {
  id: string;
  colour: string;
  selfie_key: string;
  images: { n: number; label: string; url: string }[];
  client_name?: string;
};

const mimeOf = (k: string) => (k.endsWith(".png") ? "image/png" : k.endsWith(".webp") ? "image/webp" : "image/jpeg");

async function genOne(ai: GoogleGenAI, ref: { mimeType: string; data: string }, prompt: string): Promise<Buffer> {
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ inlineData: ref }, { text: prompt }] }],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });
      const parts = r.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
      if (!img?.inlineData?.data) throw new Error("Gemini returned no image");
      void geminiOk();
      return Buffer.from(img.inlineData.data, "base64");
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      void geminiFailed(lastErr);
      const m = lastErr.toLowerCase();
      const quota = m.includes("429") || m.includes("quota") || m.includes("rate");
      const retry = quota || m.includes("503") || m.includes("unavailable") || m.includes("overloaded") || m.includes("no image");
      if (!retry || attempt === MAX_ATTEMPTS - 1) break;
      await sleep(quota ? 30000 : 8000);
    }
  }
  throw new Error(lastErr || "failed");
}

const running = new Set<string>();

/** Makes whichever of the ten images are missing (or just `only` when given). */
export async function runXmasOrder(id: string, only?: number[]): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const o = ((await db.execute(sql`SELECT id, colour, selfie_key, images, client_name FROM xmasshoot_orders WHERE id = ${id}`)).rows as unknown as OrderRow[])[0];
    if (!o) return;
    if (!apiKey) {
      await db.execute(sql`UPDATE xmasshoot_orders SET status = 'failed', note = 'GEMINI_API_KEY is not set', updated_at = now() WHERE id = ${id}`);
      return;
    }
    await db.execute(sql`UPDATE xmasshoot_orders SET status = 'working', updated_at = now() WHERE id = ${id}`);
    const ai = new GoogleGenAI({ apiKey });
    const buf = await readObject(o.selfie_key);
    const ref = { mimeType: mimeOf(o.selfie_key), data: buf.toString("base64") };
    let images = [...(o.images ?? [])];
    let failed = 0;
    for (let i = 0; i < REALISTIC_XMAS_PRESETS.length; i++) {
      const n = i + 1;
      if (only ? !only.includes(n) : images.some((x) => x.n === n)) continue;
      const preset = REALISTIC_XMAS_PRESETS[i];
      try {
        const prompt = buildPhotoStudioPrompt(preset, undefined, "3:4", { xmasColour: o.colour || "red" });
        const out = await genOne(ai, ref, prompt);
        const key = await saveObject(out, "image/png", `xmas-${n}`);
        images = images.filter((x) => x.n !== n);
        images.push({ n, label: preset.name, url: `/api/media/${key}` });
        images.sort((a, b) => a.n - b.n);
        await db.execute(sql`UPDATE xmasshoot_orders SET images = ${JSON.stringify(images)}::jsonb, updated_at = now() WHERE id = ${id}`);
        // A client's images go straight into their approved photos as each one lands (re-read in case Vanessa picked the client part way through).
        const cl = (((await db.execute(sql`SELECT client_name FROM xmasshoot_orders WHERE id = ${id}`)).rows[0] as { client_name?: string } | undefined)?.client_name || "").trim();
        if (cl) await fileIntoApprovedPhotos(cl, `/api/media/${key}`);
      } catch (e) {
        failed++;
        logger.warn({ err: e, id, n }, "xmasshoot image failed");
      }
      await sleep(GAP_MS);
    }
    const done = images.length >= XMAS_SHOT_COUNT;
    await db.execute(sql`UPDATE xmasshoot_orders SET status = ${done ? "ready" : "partial"},
      ready_at = CASE WHEN ${done} THEN COALESCE(ready_at, now()) ELSE ready_at END,
      expires_at = CASE WHEN ${done} AND client_name = '' THEN COALESCE(expires_at, now() + interval '30 days') ELSE expires_at END,
      note = ${failed ? `${failed} image(s) failed, press Make missing` : ""}, updated_at = now() WHERE id = ${id}`);
  } catch (e) {
    logger.error({ err: e, id }, "xmasshoot order failed");
    await db.execute(sql`UPDATE xmasshoot_orders SET status = 'failed', note = ${String(e instanceof Error ? e.message : e).slice(0, 300)}, updated_at = now() WHERE id = ${id}`).catch(() => undefined);
  } finally {
    running.delete(id);
  }
}

const keyOf = (url: string) => url.replace(/^\/api\/media\//, "");

/** Deletes the selfie and every image once the 30 days are up, and marks the order expired. Runs hourly. */
export async function sweepExpiredXmas(): Promise<void> {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const rows = (await db.execute(sql`SELECT id, selfie_key, images FROM xmasshoot_orders WHERE expires_at IS NOT NULL AND client_name = '' AND expires_at < now() AND status <> 'expired'`)).rows as unknown as OrderRow[];
    for (const r of rows) {
      if (bucketId) {
        const keys = [r.selfie_key, ...(r.images ?? []).map((i) => keyOf(i.url))].filter(Boolean);
        for (const k of keys) await objectStorageClient.bucket(bucketId).file(k).delete({ ignoreNotFound: true }).catch(() => undefined);
      }
      await db.execute(sql`UPDATE xmasshoot_orders SET status = 'expired', images = '[]'::jsonb, selfie_key = '', updated_at = now() WHERE id = ${r.id}`);
    }
  } catch (e) {
    logger.warn({ err: e }, "xmasshoot expiry sweep failed");
  }
}
