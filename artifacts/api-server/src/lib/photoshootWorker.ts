import { GoogleGenAI } from "@google/genai";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";
import { geminiOk, geminiFailed } from "./aiCreditAlert";
import { logger } from "./logger";

// AI PHOTO STUDIO. 20 images per paid order: 10 in scrubs, 5 lifestyle, 5 seasonal. The client's 3 face photos (and the clinic
// interior when she sent one) go to Gemini with every prompt. Results are saved on the order and wait for Vanessa to approve them.

const MODEL = "gemini-2.5-flash-image";
const GAP_MS = 4000;
const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const bucketId = () => {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
};

export async function readObject(key: string): Promise<Buffer> {
  const [buf] = await objectStorageClient.bucket(bucketId()).file(key).download();
  return buf;
}

export async function saveObject(buf: Buffer, mime: string, name: string): Promise<string> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const key = `photoshoot/${uuid()}/${name}.${ext}`;
  await objectStorageClient.bucket(bucketId()).file(key).save(buf, { contentType: mime, metadata: { cacheControl: "private, max-age=3600" } });
  return key;
}

export type Shot = { n: number; kind: "scrubs" | "lifestyle" | "seasonal"; label: string; prompt: string; useInterior: boolean };

/** The seasonal five follow the calendar month the order is placed in. */
export function seasonalThemes(d = new Date()): { season: string; themes: string[] } {
  const m = d.getMonth() + 1;
  if (m === 12 || m === 1) {
    return {
      season: "Christmas and winter",
      themes: [
        "standing beside a decorated Christmas tree with warm fairy lights, wearing a cosy festive knit",
        "wrapping presents at a table with ribbon and paper, soft festive glow, cosy jumper",
        "holding a hot chocolate in a snowy street at dusk, wool coat, scarf and hat, twinkling lights behind",
        "sitting by a fireplace with a mug, stockings on the mantel, relaxed and smiling",
        "smart party outfit at a festive gathering, candles and greenery, warm golden light",
      ],
    };
  }
  if (m === 2 || m === 3) {
    return {
      season: "late winter into spring",
      themes: [
        "holding a bunch of fresh tulips in a bright kitchen, soft spring light, light knit",
        "walking a frosty park path at golden hour in a camel coat and scarf",
        "reading a magazine in a sunny window seat with daffodils on the sill",
        "laughing in a cafe window with a latte, early spring light, trench coat",
        "gardening gloves on, planting spring bulbs, natural daylight, relaxed and happy",
      ],
    };
  }
  if (m >= 4 && m <= 5) {
    return {
      season: "spring",
      themes: [
        "standing among blossom trees in a park, floral dress, soft spring sunshine",
        "holding a bunch of peonies at a flower market, light cardigan",
        "picnic blanket on fresh grass, basket and strawberries, relaxed smile",
        "walking along a country lane with bluebells, light jacket, golden hour",
        "brunch on a sunny terrace with a spring salad and a sparkling water, linen shirt",
      ],
    };
  }
  if (m >= 6 && m <= 8) {
    return {
      season: "summer",
      themes: [
        "on a sunny terrace with an iced coffee, sunglasses pushed up in hair, summer dress",
        "walking on a British seaside promenade with an ice cream, breezy and smiling",
        "garden party with fairy lights and a jug of Pimm's with fruit, linen outfit",
        "sitting on a beach blanket with a straw hat and a book, soft sea light",
        "holding a bunch of sunflowers at a farm shop, golden evening sun",
      ],
    };
  }
  if (m >= 9 && m <= 11) {
    return {
      season: m === 11 ? "late autumn and bonfire season" : "autumn",
      themes: [
        "walking through a woodland of golden leaves, chunky knit and scarf, golden hour",
        "holding a pumpkin spice latte in a cosy cafe window, oversized cardigan, rain on the glass",
        "standing in a pumpkin patch or farm shop with a basket of apples, warm light",
        m === 11 ? "wrapped up at a bonfire night gathering with sparklers glowing behind, hat, scarf and gloves, night time warm glow" : "wrapped in a blanket on a sofa with a candle and a book, warm autumn evening light",
        "wearing a camel coat on a city street with leaves on the pavement, holding a takeaway coffee",
      ],
    };
  }
  return { season: "seasonal", themes: [] };
}

const STYLE =
  "Photorealistic, natural skin texture with no smoothing or beauty filter, true to life, shot on a modern full frame camera, shallow depth of field, flattering natural light, portrait orientation 4:5. No text, no logos, no watermarks, no extra fingers, no distorted hands.";

const IDENTITY =
  "The reference photos show one real woman. Keep her face, age, skin tone, hair colour, hair length and features EXACTLY as in the references so she is instantly recognisable. Do not make her younger, slimmer or more airbrushed, and do not change her features. Her expression is warm, natural and confident.";

export function buildShots(scrubColour: string, hasInterior: boolean, now = new Date()): Shot[] {
  const sc = `${scrubColour} scrubs`;
  const clinical: [string, string][] = [
    ["Arms folded", `standing with arms loosely folded, smiling at the camera, in a clean bright aesthetics treatment room, wearing smart ${sc}, a treatment couch softly out of focus behind`],
    ["Headshot", `a close professional head and shoulders headshot, soft smile, wearing ${sc}, soft clinic background blurred`],
    ["Laughing", `a candid moment mid laugh, looking just off camera, wearing ${sc}, in a bright clinic room`],
    ["Consultation", `sitting at a consultation desk with a tablet in her hands, looking up and smiling warmly at the camera, wearing ${sc}`],
    ["Walking", `walking confidently down a bright clinic corridor towards the camera, wearing ${sc}, clean and calm`],
    ["Treatment room", `standing beside the treatment couch with one hand resting on it, relaxed, wearing ${sc}`],
    ["Window light", `standing by a large window with soft daylight on her face, wearing ${sc}, calm and confident, three quarter angle`],
    ["Reception", `leaning gently on a clinic reception desk, welcoming smile, wearing ${sc}`],
    ["Hands clasped", `standing with hands clasped in front, kind welcoming expression, wearing ${sc}, tidy clinic setting`],
    ["Over the shoulder", `looking back over her shoulder with a friendly smile, wearing ${sc}, clinic hallway with soft light`],
  ];
  const life: [string, string][] = [
    ["Coffee shop", "sitting in a cosy independent coffee shop holding a latte, relaxed and smiling, natural window light, casual stylish outfit"],
    ["Sofa", "curled up on a comfy sofa with a soft throw and a cup of tea, relaxed and happy, warm lamp light, casual lounge outfit"],
    ["Laptop", "sitting at a tidy desk working on a laptop, glancing up at the camera with a smile, bright home office, smart casual outfit"],
    ["Reading", "reading a book in an armchair by a window, soft daylight, calm and content, casual knit"],
    ["Texting", "standing in a bright space holding an iPhone in both hands, looking down at it with a smile as she sends a text message, natural light, casual smart outfit"],
  ];
  const { themes, season } = seasonalThemes(now);
  const shots: Shot[] = [];
  clinical.forEach(([label, text], i) =>
    shots.push({
      n: i + 1,
      kind: "scrubs",
      label,
      useInterior: hasInterior,
      prompt: `${IDENTITY} Create a photograph of her ${text}.${hasInterior ? " The final reference photo shows her real clinic interior, so use that room and its look as the setting." : ""} ${STYLE}`,
    }),
  );
  life.forEach(([label, text], i) =>
    shots.push({ n: 11 + i, kind: "lifestyle", label, useInterior: false, prompt: `${IDENTITY} Create a photograph of her ${text}. ${STYLE}` }),
  );
  themes.forEach((t, i) =>
    shots.push({ n: 16 + i, kind: "seasonal", label: `${season} ${i + 1}`, useInterior: false, prompt: `${IDENTITY} Create a photograph of her ${t}. ${STYLE}` }),
  );
  return shots;
}

type OrderRow = {
  id: string;
  clinic_name: string;
  scrub_colour: string;
  photo_keys: string[];
  interior_key: string;
  images: { n: number; kind: string; label: string; url: string }[];
  created_at: string;
};

async function genOne(ai: GoogleGenAI, refs: { mimeType: string; data: string }[], shot: Shot): Promise<Buffer> {
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [...refs.map((x) => ({ inlineData: x })), { text: shot.prompt }] }],
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
      const retry = m.includes("429") || m.includes("quota") || m.includes("rate") || m.includes("503") || m.includes("unavailable") || m.includes("overloaded") || m.includes("no image");
      if (!retry || attempt === MAX_ATTEMPTS - 1) break;
      await sleep(m.includes("429") || m.includes("quota") || m.includes("rate") ? 30000 : 8000);
    }
  }
  throw new Error(lastErr || "failed");
}

const running = new Set<string>();

/** Makes whichever of the 20 images are missing (or just `only` when given), saving after each one so nothing is lost. */
export async function runOrder(id: string, only?: number[]): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const rows = (await db.execute(sql`SELECT * FROM photoshoot_orders WHERE id = ${id}`)).rows as unknown as OrderRow[];
    const o = rows[0];
    if (!o) return;
    if (!apiKey) {
      await db.execute(sql`UPDATE photoshoot_orders SET status = 'failed', note = 'GEMINI_API_KEY is not set' WHERE id = ${id}`);
      return;
    }
    await db.execute(sql`UPDATE photoshoot_orders SET status = 'working', updated_at = now() WHERE id = ${id}`);
    const ai = new GoogleGenAI({ apiKey });
    const faces = [];
    for (const k of o.photo_keys) {
      const buf = await readObject(k);
      faces.push({ mimeType: k.endsWith(".png") ? "image/png" : k.endsWith(".webp") ? "image/webp" : "image/jpeg", data: buf.toString("base64") });
    }
    let interior: { mimeType: string; data: string } | null = null;
    if (o.interior_key) {
      const buf = await readObject(o.interior_key);
      interior = { mimeType: o.interior_key.endsWith(".png") ? "image/png" : o.interior_key.endsWith(".webp") ? "image/webp" : "image/jpeg", data: buf.toString("base64") };
    }
    const shots = buildShots(o.scrub_colour, !!interior, new Date(o.created_at));
    let images = [...(o.images ?? [])];
    let failed = 0;
    for (const shot of shots) {
      if (only ? !only.includes(shot.n) : images.some((x) => x.n === shot.n)) continue;
      try {
        const buf = await genOne(ai, shot.useInterior && interior ? [...faces, interior] : faces, shot);
        const key = await saveObject(buf, "image/png", `shot-${shot.n}`);
        images = images.filter((x) => x.n !== shot.n);
        images.push({ n: shot.n, kind: shot.kind, label: shot.label, url: `/api/media/${key}` });
        images.sort((a, b) => a.n - b.n);
        await db.execute(sql`UPDATE photoshoot_orders SET images = ${JSON.stringify(images)}::jsonb, updated_at = now() WHERE id = ${id}`);
      } catch (e) {
        failed++;
        logger.warn({ err: e, id, n: shot.n }, "photoshoot shot failed");
      }
      await sleep(GAP_MS);
    }
    const status = images.length >= shots.length ? "review" : "partial";
    await db.execute(sql`UPDATE photoshoot_orders SET status = ${status}, note = ${failed ? `${failed} image(s) failed, press Make missing` : ""}, updated_at = now() WHERE id = ${id}`);
  } catch (e) {
    logger.error({ err: e, id }, "photoshoot order failed");
    await db.execute(sql`UPDATE photoshoot_orders SET status = 'failed', note = ${String(e instanceof Error ? e.message : e).slice(0, 300)}, updated_at = now() WHERE id = ${id}`).catch(() => undefined);
  } finally {
    running.delete(id);
  }
}
