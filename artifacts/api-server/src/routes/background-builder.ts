import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Same auth pattern as seamless-caro-builder.ts and the other admin-only tools.
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

router.use("/background-builder", requireAuth);

const GEMINI_MODEL = "gemini-2.5-flash-image";

// The final canvas Seamless Carousels expects a background strip to be:
// 4320x1440, a 3:1 ratio, cut into 4 equal 1080x1440 panels. Gemini's widest
// native aspect ratio is 21:9 (roughly 2.33:1), so we generate there and let
// sharp crop-to-fill the rest. For an abstract colour/pattern background a
// touch of cropping on generation makes no visible difference, and it means
// every image handed off to Seamless Carousels is guaranteed to be exactly
// the right size without Vanessa ever having to think about it.
const TARGET_WIDTH = 4320;
const TARGET_HEIGHT = 1440;

const MAX_BATCH = 12;
const DEFAULT_BATCH = 10;
const BATCH_CONCURRENCY = 4;

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Pulls a small handful of representative brand colours out of a logo image.
// No external colour-extraction service, just sharp reading raw pixels (sharp
// is already a dependency, so this adds no new subscription or package).
// Pixels are bucketed into a coarse grid so near-identical shades collapse
// into one swatch, then buckets are scored by how "colourful" they are
// (their spread between the highest and lowest channel) so vivid brand
// colours win over anti-aliasing greys, near-white backgrounds, or near-black
// outlines. Falls back to plain frequency if the logo turns out to be
// genuinely monochrome. If a logo is too rough for this to give a clean
// read, Vanessa can just overtype the hex boxes on the frontend.
async function extractLogoColours(logoBuffer: Buffer, maxColours = 3): Promise<string[]> {
  const { data, info } = await sharp(logoBuffer)
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  type Bucket = { rSum: number; gSum: number; bSum: number; count: number };
  const buckets = new Map<string, Bucket>();
  const STEP = 24;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = channels >= 4 ? (data[i + 3] ?? 255) : 255;
    if (a < 128) continue; // skip transparent pixels
    const key = `${Math.round(r / STEP)}-${Math.round(g / STEP)}-${Math.round(b / STEP)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.rSum += r; existing.gSum += g; existing.bSum += b; existing.count += 1;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
  }

  if (buckets.size === 0) return [];

  const scored = Array.from(buckets.values()).map((bkt) => {
    const r = bkt.rSum / bkt.count, g = bkt.gSum / bkt.count, b = bkt.bSum / bkt.count;
    const spread = Math.max(r, g, b) - Math.min(r, g, b); // colourfulness
    const nearWhite = r > 235 && g > 235 && b > 235;
    const nearBlack = r < 18 && g < 18 && b < 18;
    return { r, g, b, count: bkt.count, spread, nearWhite, nearBlack };
  });

  const vivid = scored.filter((s) => !s.nearWhite && !s.nearBlack && s.spread > 18);
  const pool = vivid.length > 0 ? vivid : scored.filter((s) => !s.nearWhite && !s.nearBlack);
  const finalPool = pool.length > 0 ? pool : scored;

  finalPool.sort((a, b) => b.count * (1 + b.spread / 100) - a.count * (1 + a.spread / 100));

  const picked: { r: number; g: number; b: number }[] = [];
  for (const c of finalPool) {
    if (picked.length >= maxColours) break;
    const tooClose = picked.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 60);
    if (!tooClose) picked.push(c);
  }

  return picked.map((c) => toHex(c.r, c.g, c.b));
}

router.get("/background-builder/logo-colours/:presetId", async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.params.presetId);
    if (!presetId) { res.status(400).json({ error: "Invalid client" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Client not found" }); return; }
    if (!preset.logoUrl) { res.json({ colours: [] }); return; }
    const logoBuffer = await fetchBuffer(preset.logoUrl);
    const colours = await extractLogoColours(logoBuffer, 3);
    res.json({ colours });
  } catch (err: any) {
    logger.error({ err }, "Background Builder logo colour extraction failed");
    res.json({ colours: [] }); // never block the flow, just fall back to blank hex boxes Vanessa can fill in herself
  }
});

// Nine curated looks. Each one is a Gemini prompt fragment with a {COLOURS}
// placeholder swapped for whatever hex codes Vanessa confirms (either pulled
// from the client's logo or typed in by hand when a logo is too rough to
// read colour from).
const STYLE_TEMPLATES: Record<string, string> = {
  "botanical-border": "a continuous botanical border of layered leaves, delicate florals and fine stems wrapping across the bottom edge and flowing gently up the sides, using this colour palette: {COLOURS}. The upper two thirds stays soft, airy and uncluttered.",
  "soft-gradient-wash": "a smooth, soft gradient wash flowing gently between these colours: {COLOURS}. No hard edges, no visible bands, a calm and minimal blended wash across the full width.",
  "geometric-accent": "modern abstract geometric shapes, fine lines and angular accents using this colour palette: {COLOURS}. Clean composition with generous negative space, contemporary and sharp.",
  "marble-texture": "a luxe polished marble texture with soft natural veining running through it, using this colour palette: {COLOURS}. High-end, tactile stone surface look.",
  "scrapbook-style": "a playful scrapbook-style collage of layered paper textures, torn paper edges and washi-tape style strips, using this colour palette: {COLOURS}. Warm, handmade, personal feel.",
  "editorial": "a clean editorial magazine-style layout background with structured colour blocking and generous whitespace, using this colour palette: {COLOURS}. Sophisticated, considered, minimal.",
  "high-end-clinical": "a premium, crisp, high-end clinical aesthetic, soft colour blocking and subtle light gradients using this colour palette: {COLOURS}. Sterile, polished, medical-grade feel without looking cold.",
  "art-deco": "a symmetrical art deco pattern with fan and sunburst motifs and fine linear detailing, using this colour palette: {COLOURS}. Elegant, geometric, glamorous.",
  "simple-doodle-stickers": "a light scattering of simple hand-drawn doodle sticker-style shapes and icons across the space, using this colour palette: {COLOURS}. Playful, light-touch, lots of clean white space between them.",
};

router.get("/background-builder/styles", (_req: Request, res: Response) => {
  res.json({ styles: Object.keys(STYLE_TEMPLATES) });
});

function buildBriefLine(body: { prompt?: string; style?: string; colours?: string[]; extra?: string }): { briefLine: string } | { error: string } {
  if (body.style) {
    const template = STYLE_TEMPLATES[body.style];
    if (!template) return { error: "Unknown style" };
    const colours = (body.colours || []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    const colourText = colours.length > 0 ? colours.join(", ") : "the client's natural brand tones";
    let briefLine = template.replace("{COLOURS}", colourText);
    if (body.extra && body.extra.trim()) briefLine += ` Also include: ${body.extra.trim()}.`;
    return { briefLine };
  }
  if (!body.prompt || !body.prompt.trim()) return { error: "A prompt is required" };
  return { briefLine: body.prompt.trim() };
}

// Small set of layout/mood nudges rotated across a batch so ten backgrounds
// built from the same brief still land as ten genuinely different images
// rather than ten near-identical renders.
const VARIATION_NUDGES = [
  "a looser, more open arrangement with plenty of breathing room",
  "a denser, more layered arrangement",
  "the composition weighted more towards the left",
  "the composition weighted more towards the right",
  "a more symmetrical, balanced arrangement",
  "a more organic, asymmetrical arrangement",
  "larger scale elements",
  "smaller, more delicate scale elements",
  "a warmer overall light and mood",
  "a cooler overall light and mood",
  "elements clustered more towards the top",
  "elements clustered more towards the bottom",
];

async function generateOneImage(briefLine: string, proto: string, host: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Image generation is not configured (GEMINI_API_KEY missing)");

  const fullPrompt = `Create a seamless, edge-to-edge background image for social media carousel slides, based on this brief: "${briefLine}".

Strict rules: absolutely no people, no faces, no hands, no bodies. No text, no words, no letters, no numbers, no logos, no watermarks. The design should read as one continuous wide strip, not four separate panels, since it will later be cut into equal vertical slices. Wide panoramic landscape composition, colours and elements should flow naturally across the full width with no obvious seams or repeats.`;

  const genAI = new GoogleGenAI({ apiKey });
  const result = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: "21:9", imageSize: "2K" },
    },
  });

  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imagePart?.inlineData?.data) throw new Error("The image model returned no image");

  const rawBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  const outBuffer = await sharp(rawBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("Object storage not configured");
  // Saved under carousel-images/ so it's served straight back by the existing
  // GET /content/images/carousel-images/:filename route, same as every other
  // generated/composited image in the app.
  const objectPath = `carousel-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-background-builder.png`;
  const bucket = objectStorageClient.bucket(bucketId);
  await bucket.file(objectPath).save(outBuffer, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });

  return `${proto}://${host}/api/content/images/${objectPath}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      try {
        results[current] = await fn(items[current], current);
      } catch (err) {
        logger.error({ err, index: current }, "Background Builder batch item failed");
        results[current] = null;
      }
    }
  }
  const workerCount = Math.min(limit, items.length) || 1;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

router.post("/background-builder/generate", async (req: Request, res: Response) => {
  try {
    const body = req.body as { prompt?: string; style?: string; colours?: string[]; extra?: string };
    const brief = buildBriefLine(body);
    if ("error" in brief) { res.status(400).json({ error: brief.error }); return; }

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const imageUrl = await generateOneImage(brief.briefLine, proto, host);
    res.json({ imageUrl, width: TARGET_WIDTH, height: TARGET_HEIGHT });
  } catch (err: any) {
    logger.error({ err }, "Background Builder generate failed");
    res.status(500).json({ error: err?.message || "Background generation failed" });
  }
});

// Builds a full batch of variations from one brief in one go, so Vanessa can
// pick a style, confirm colours, and come back to a set of ten to choose
// from instead of generating one at a time.
router.post("/background-builder/generate-batch", async (req: Request, res: Response) => {
  try {
    const body = req.body as { prompt?: string; style?: string; colours?: string[]; extra?: string; count?: number };
    const brief = buildBriefLine(body);
    if ("error" in brief) { res.status(400).json({ error: brief.error }); return; }

    const requested = Math.round(body.count ?? DEFAULT_BATCH);
    const count = Math.max(1, Math.min(MAX_BATCH, isNaN(requested) ? DEFAULT_BATCH : requested));

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";

    const briefs = Array.from({ length: count }, (_, i) => {
      const nudge = VARIATION_NUDGES[i % VARIATION_NUDGES.length];
      return `${brief.briefLine} Variation ${i + 1} of ${count} in this set: ${nudge}. Keep the same colours and overall style as the brief, but make the layout and composition clearly distinct from the other variations in the set.`;
    });

    const results = await mapWithConcurrency(briefs, BATCH_CONCURRENCY, (line) => generateOneImage(line, proto, host));
    const images = results.filter((url): url is string => !!url).map((imageUrl) => ({ imageUrl }));

    if (images.length === 0) { res.status(502).json({ error: "None of the variations generated successfully, please try again" }); return; }

    res.json({ images, width: TARGET_WIDTH, height: TARGET_HEIGHT, requested: count, succeeded: images.length });
  } catch (err: any) {
    logger.error({ err }, "Background Builder batch generate failed");
    res.status(500).json({ error: err?.message || "Batch generation failed" });
  }
});

export default router;
