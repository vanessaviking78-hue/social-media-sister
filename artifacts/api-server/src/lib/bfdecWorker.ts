import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { REALISTIC_XMAS_PRESETS, buildPhotoStudioPrompt } from "./aiPortraitScenarios";
import { readObject, saveObject } from "./photoshootWorker";
import { genOne } from "./xmasshootWorker";
import { logger } from "./logger";

// DECEMBER BUNDLE. Makes the ten REALISTIC XMAS photos from the photo the person uploaded, in the colours they chose.
// Each photo is saved on the order as it finishes, so a half finished order never loses what it has made.

const GAP_MS = 4000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const BFDEC_PHOTO_COUNT = REALISTIC_XMAS_PRESETS.length;

type Item = { id: string; kind: "post" | "photo"; label: string; url: string; n?: number };
type OrderRow = { id: string; colours: string; photo_key: string; items: Item[] };

const mimeOf = (k: string) => (k.endsWith(".png") ? "image/png" : k.endsWith(".webp") ? "image/webp" : "image/jpeg");
const running = new Set<string>();

/** "navy, gold" becomes "navy and gold" so the prompt reads naturally. */
const colourPhrase = (c: string) => {
  const parts = c.split(/,|\band\b|&|\//i).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts.join(" and ") : "red";
};

/** Makes whichever of the ten photos are missing (or just `only` when given). */
export async function runBfdecPhotos(id: string, only?: number[]): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const o = ((await db.execute(sql`SELECT id, colours, photo_key, items FROM bfdec_orders WHERE id = ${id}`)).rows as unknown as OrderRow[])[0];
    if (!o) return;
    if (!o.photo_key) {
      await db.execute(sql`UPDATE bfdec_orders SET photo_state = 'failed', note = 'No photo to work from', updated_at = now() WHERE id = ${id}`);
      return;
    }
    if (!apiKey) {
      await db.execute(sql`UPDATE bfdec_orders SET photo_state = 'failed', note = 'GEMINI_API_KEY is not set', updated_at = now() WHERE id = ${id}`);
      return;
    }
    await db.execute(sql`UPDATE bfdec_orders SET photo_state = 'working', note = '', updated_at = now() WHERE id = ${id}`);
    const ai = new GoogleGenAI({ apiKey });
    const buf = await readObject(o.photo_key);
    const ref = { mimeType: mimeOf(o.photo_key), data: buf.toString("base64") };
    const colour = colourPhrase(o.colours);
    let failed = 0;
    for (let i = 0; i < REALISTIC_XMAS_PRESETS.length; i++) {
      const n = i + 1;
      // Re-read the items each time, because Vanessa may be uploading or removing files while this runs.
      let items = (((await db.execute(sql`SELECT items FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { items: Item[] } | undefined)?.items ?? []) as Item[];
      const have = items.some((x) => x.kind === "photo" && x.n === n);
      if (only ? !only.includes(n) : have) continue;
      const preset = REALISTIC_XMAS_PRESETS[i];
      try {
        const prompt = buildPhotoStudioPrompt(preset, undefined, "3:4", { xmasColour: colour });
        const out = await genOne(ai, ref, prompt);
        const key = await saveObject(out, "image/png", `bfdec-xmas-${n}`);
        items = (((await db.execute(sql`SELECT items FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { items: Item[] } | undefined)?.items ?? []) as Item[];
        items = items.filter((x) => !(x.kind === "photo" && x.n === n));
        items.push({ id: `photo-${n}-${Date.now()}`, kind: "photo", n, label: preset.name, url: `/api/media/${key}` });
        await db.execute(sql`UPDATE bfdec_orders SET items = ${JSON.stringify(items)}::jsonb, updated_at = now() WHERE id = ${id}`);
      } catch (e) {
        failed++;
        logger.warn({ err: e, id, n }, "bfdec photo failed");
      }
      await sleep(GAP_MS);
    }
    const final = (((await db.execute(sql`SELECT items FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { items: Item[] } | undefined)?.items ?? []) as Item[];
    const done = final.filter((x) => x.kind === "photo").length >= BFDEC_PHOTO_COUNT;
    await db.execute(sql`UPDATE bfdec_orders SET photo_state = ${done ? "done" : "partial"}, note = ${failed ? `${failed} photo(s) failed, press Make missing photos` : ""}, updated_at = now() WHERE id = ${id}`);
  } catch (e) {
    logger.error({ err: e, id }, "bfdec photos failed");
    await db.execute(sql`UPDATE bfdec_orders SET photo_state = 'failed', note = ${String(e instanceof Error ? e.message : e).slice(0, 300)}, updated_at = now() WHERE id = ${id}`).catch(() => undefined);
  } finally {
    running.delete(id);
  }
}
