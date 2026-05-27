import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { seamlessCarouselsTable, type SeamlessSlide } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { v4 as uuid } from "uuid";
import sharp from "sharp";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router: IRouter = Router();

const SLIDE_SIZE = 1080;

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

async function fetchBuf(urlOrPath: string): Promise<Buffer> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  let key: string;
  if (urlOrPath.startsWith("/api/media/")) {
    key = urlOrPath.slice("/api/media/".length);
  } else if (urlOrPath.startsWith("https://storage.googleapis.com/")) {
    const u = new URL(urlOrPath);
    key = u.pathname.slice(1).replace(`${bucketId}/`, "");
  } else {
    const r = await fetch(urlOrPath);
    if (!r.ok) throw new Error(`Failed to fetch ${urlOrPath}: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const [buffer] = await objectStorageClient.bucket(bucketId).file(key).download();
  return buffer;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function doodlePath(type: string, cx: number, cy: number, size: number): string {
  if (type === "heart") {
    return `<path d="M ${cx} ${cy + size * 0.3} C ${cx} ${cy} ${cx - size * 0.5} ${cy - size * 0.3} ${cx - size * 0.5} ${cy - size * 0.1} C ${cx - size * 0.5} ${cy - size * 0.5} ${cx} ${cy - size * 0.6} ${cx} ${cy - size * 0.3} C ${cx} ${cy - size * 0.6} ${cx + size * 0.5} ${cy - size * 0.5} ${cx + size * 0.5} ${cy - size * 0.1} C ${cx + size * 0.5} ${cy - size * 0.3} ${cx} ${cy} ${cx} ${cy + size * 0.3} Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (type === "star") {
    return `<text x="${cx}" y="${cy}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">✦</text>`;
  }
  if (type === "arrow") {
    return `<path d="M ${cx - size * 0.5} ${cy} Q ${cx} ${cy - size * 0.6} ${cx + size * 0.5} ${cy} M ${cx + size * 0.1} ${cy - size * 0.25} L ${cx + size * 0.5} ${cy} L ${cx + size * 0.1} ${cy + size * 0.25}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<text x="${cx}" y="${cy}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">✦</text>`;
}

function getAnchor(position: string): { tx: number; ty: number; anchor: string } {
  const map: Record<string, { tx: number; ty: number; anchor: string }> = {
    "top-left":    { tx: 60, ty: 80, anchor: "start" },
    "top-right":   { tx: SLIDE_SIZE - 60, ty: 80, anchor: "end" },
    "center":      { tx: SLIDE_SIZE / 2, ty: SLIDE_SIZE / 2, anchor: "middle" },
    "bottom-left": { tx: 60, ty: SLIDE_SIZE - 80, anchor: "start" },
    "bottom-right":{ tx: SLIDE_SIZE - 60, ty: SLIDE_SIZE - 80, anchor: "end" },
  };
  return map[position] ?? { tx: SLIDE_SIZE / 2, ty: SLIDE_SIZE - 120, anchor: "middle" };
}

function buildSlideTextSvg(slide: SeamlessSlide, scriptFont: string, textColor: string, watermark: string): string {
  if (!slide.hasText && !watermark) return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_SIZE}" height="${SLIDE_SIZE}"/>`;

  const { tx, ty, anchor } = getAnchor(slide.position ?? "bottom-left");
  const lineH = 54;
  const doodleY = ty - (slide.leadIn ? lineH * 2.5 : lineH * 1.5) - 40;

  const doodle = slide.doodle && slide.doodle !== "none"
    ? doodlePath(slide.doodle, tx, doodleY, 36).replace("currentColor", textColor)
    : "";

  const shadow = `<filter id="ts"><feDropShadow dx="1" dy="1" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/></filter>`;

  const leadInSvg = slide.leadIn
    ? `<text x="${tx}" y="${ty - (slide.title ? lineH * 1.1 : 0)}" font-family="'${scriptFont}', cursive" font-size="40" fill="${textColor}" text-anchor="${anchor}" filter="url(#ts)" opacity="0.9">${escXml(slide.leadIn)}</text>`
    : "";

  const titleSvg = slide.title
    ? `<text x="${tx}" y="${ty}" font-family="'${scriptFont}', 'Great Vibes', cursive" font-size="68" fill="${textColor}" text-anchor="${anchor}" filter="url(#ts)">${escXml(slide.title)}</text>`
    : "";

  const tagSvg = slide.tagLine
    ? `<text x="${tx}" y="${ty + lineH}" font-family="'${scriptFont}', cursive" font-size="36" fill="${textColor}" text-anchor="${anchor}" filter="url(#ts)" opacity="0.85">${escXml(slide.tagLine)}</text>`
    : "";

  const wmSvg = watermark
    ? `<text x="${(SLIDE_SIZE / 2).toFixed(0)}" y="${(SLIDE_SIZE - 30).toFixed(0)}" font-family="'${scriptFont}', cursive" font-size="30" fill="${textColor}" text-anchor="middle" opacity="0.7" filter="url(#ts)">${escXml(watermark)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_SIZE}" height="${SLIDE_SIZE}">
  <defs>${shadow}<style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(scriptFont)}');</style></defs>
  ${doodle}
  ${leadInSvg}
  ${titleSvg}
  ${tagSvg}
  ${wmSvg}
</svg>`;
}

// POST /api/seamless/upload
router.post("/seamless/upload", upload.array("images", 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: "No images uploaded" });

    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadBuf(f.buffer, `source-${Date.now()}.${f.mimetype.includes("png") ? "png" : "jpg"}`, "seamless/source", f.mimetype);
      urls.push(url);
    }
    res.json({ urls });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/seamless
router.get("/seamless", async (req, res) => {
  try {
    const { clientName } = req.query;
    let q = db.select().from(seamlessCarouselsTable).$dynamic();
    if (clientName && typeof clientName === "string") {
      q = q.where(eq(seamlessCarouselsTable.clientName, clientName));
    }
    res.json(await q.orderBy(desc(seamlessCarouselsTable.createdAt)));
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/seamless/:id
router.get("/seamless/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(seamlessCarouselsTable).where(eq(seamlessCarouselsTable.id, parseInt(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/seamless
router.post("/seamless", async (req, res) => {
  try {
    const body = req.body;
    const [inserted] = await db.insert(seamlessCarouselsTable).values({
      clientName: body.clientName ?? "",
      slideCount: body.slideCount ?? 3,
      sourceImageUrl: body.sourceImageUrl ?? null,
      sourceImageUrls: body.sourceImageUrls ?? null,
      slides: body.slides ?? [],
      scriptFont: body.scriptFont ?? "Allura",
      textColor: body.textColor ?? "#ffffff",
      watermark: body.watermark ?? "",
    }).returning();
    res.json(inserted);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/seamless/:id
router.put("/seamless/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [updated] = await db.update(seamlessCarouselsTable).set({
      clientName: body.clientName,
      slideCount: body.slideCount,
      sourceImageUrl: body.sourceImageUrl ?? null,
      sourceImageUrls: body.sourceImageUrls ?? null,
      slides: body.slides,
      scriptFont: body.scriptFont,
      textColor: body.textColor,
      watermark: body.watermark,
      updatedAt: new Date(),
    }).where(eq(seamlessCarouselsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/seamless/:id
router.delete("/seamless/:id", async (req, res) => {
  try {
    await db.delete(seamlessCarouselsTable).where(eq(seamlessCarouselsTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/seamless/:id/render — slice wide image into N slides + apply text overlays
router.post("/seamless/:id/render", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [carousel] = await db.select().from(seamlessCarouselsTable).where(eq(seamlessCarouselsTable.id, id));
    if (!carousel) return res.status(404).json({ error: "Not found" });

    const n = carousel.slideCount;
    const slides = (carousel.slides ?? []) as SeamlessSlide[];
    const scriptFont = carousel.scriptFont ?? "Allura";
    const textColor = carousel.textColor ?? "#ffffff";
    const watermark = carousel.watermark ?? "";

    let wideBuffer: Buffer;

    if (carousel.sourceImageUrl) {
      wideBuffer = await fetchBuf(carousel.sourceImageUrl);
    } else if (carousel.sourceImageUrls?.length) {
      const bufs = await Promise.all((carousel.sourceImageUrls as string[]).map(fetchBuf));
      const resized = await Promise.all(bufs.map((b) =>
        sharp(b).resize(SLIDE_SIZE, SLIDE_SIZE, { fit: "cover", position: "centre" }).png().toBuffer()
      ));
      wideBuffer = await sharp({
        create: { width: SLIDE_SIZE * n, height: SLIDE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).composite(resized.map((r, i) => ({ input: r, left: i * SLIDE_SIZE, top: 0 }))).png().toBuffer();
    } else {
      return res.status(400).json({ error: "No source image" });
    }

    const meta = await sharp(wideBuffer).metadata();
    const imgW = meta.width ?? n * SLIDE_SIZE;
    const imgH = meta.height ?? SLIDE_SIZE;

    const normalized = await sharp(wideBuffer)
      .resize(n * SLIDE_SIZE, SLIDE_SIZE, { fit: "fill" })
      .png()
      .toBuffer();

    const slideUrls: string[] = [];
    for (let i = 0; i < n; i++) {
      const slide = slides[i] ?? { hasText: false, title: "", leadIn: "", tagLine: "", doodle: "none", position: "bottom-left" };
      const cropped = await sharp(normalized)
        .extract({ left: i * SLIDE_SIZE, top: 0, width: SLIDE_SIZE, height: SLIDE_SIZE })
        .png()
        .toBuffer();

      const textSvg = buildSlideTextSvg(slide, scriptFont, textColor, watermark);
      const withText = await sharp(cropped)
        .composite([{ input: Buffer.from(textSvg), left: 0, top: 0, blend: "over" }])
        .png()
        .toBuffer();

      const url = await uploadBuf(withText, `seamless-slide-${i + 1}-${Date.now()}.png`, "seamless/rendered");
      slideUrls.push(url);
    }

    await db.update(seamlessCarouselsTable).set({ updatedAt: new Date() }).where(eq(seamlessCarouselsTable.id, id));

    res.json({ slideUrls });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
