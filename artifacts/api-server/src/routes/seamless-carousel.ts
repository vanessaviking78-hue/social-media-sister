import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { seamlessCarouselsTable, type SeamlessSlide, type CollageElement, type SeamlessLogoConfig } from "@workspace/db/schema";
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

function doodlePath(type: string, cx: number, cy: number, size: number, color: string): string {
  if (type === "heart") {
    return `<path d="M ${cx} ${cy + size * 0.3} C ${cx} ${cy} ${cx - size * 0.5} ${cy - size * 0.3} ${cx - size * 0.5} ${cy - size * 0.1} C ${cx - size * 0.5} ${cy - size * 0.5} ${cx} ${cy - size * 0.6} ${cx} ${cy - size * 0.3} C ${cx} ${cy - size * 0.6} ${cx + size * 0.5} ${cy - size * 0.5} ${cx + size * 0.5} ${cy - size * 0.1} C ${cx + size * 0.5} ${cy - size * 0.3} ${cx} ${cy} ${cx} ${cy + size * 0.3} Z" fill="${color}" stroke="${color}" stroke-width="1"/>`;
  }
  if (type === "star") {
    return `<text x="${cx}" y="${cy}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${color}">✦</text>`;
  }
  if (type === "arrow") {
    return `<path d="M ${cx - size * 0.5} ${cy} Q ${cx} ${cy - size * 0.6} ${cx + size * 0.5} ${cy} M ${cx + size * 0.1} ${cy - size * 0.25} L ${cx + size * 0.5} ${cy} L ${cx + size * 0.1} ${cy + size * 0.25}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return "";
}

function getAnchor(position: string): { tx: number; ty: number; anchor: string } {
  const map: Record<string, { tx: number; ty: number; anchor: string }> = {
    "top-left":    { tx: 80, ty: 120, anchor: "start" },
    "top-right":   { tx: SLIDE_SIZE - 80, ty: 120, anchor: "end" },
    "center":      { tx: SLIDE_SIZE / 2, ty: SLIDE_SIZE / 2, anchor: "middle" },
    "bottom-left": { tx: 80, ty: SLIDE_SIZE - 120, anchor: "start" },
    "bottom-right":{ tx: SLIDE_SIZE - 80, ty: SLIDE_SIZE - 120, anchor: "end" },
  };
  return map[position] ?? { tx: 80, ty: SLIDE_SIZE - 120, anchor: "start" };
}

function buildSlideTextSvg(slide: SeamlessSlide, scriptFont: string, textColor: string, watermark: string): string {
  if (!slide.hasText && !watermark) return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_SIZE}" height="${SLIDE_SIZE}"/>`;

  const { tx, ty, anchor } = getAnchor(slide.position ?? "bottom-left");

  const titleColor = slide.titleColor ?? textColor;
  const titleFontSize = slide.titleFontSize ?? 76;
  const titleLetterSpacing = slide.titleLetterSpacing ?? 0;
  const titleLineHeight = slide.titleLineHeight ?? 0.88;
  const leadInColor = slide.leadInColor ?? textColor;
  const leadInFontSize = slide.leadInFontSize ?? 44;
  const leadInLetterSpacing = slide.leadInLetterSpacing ?? 0;
  const tagLineColor = slide.tagLineColor ?? textColor;
  const tagLineFontSize = slide.tagLineFontSize ?? 40;
  const tagLineLetterSpacing = slide.tagLineLetterSpacing ?? 0;
  const tagLineLineHeight = slide.tagLineLineHeight ?? 1.1;

  const lineH = titleFontSize * titleLineHeight;
  const leadInGap = leadInFontSize * (slide.leadInLineHeight ?? 1.1);
  const doodleY = ty - (slide.leadIn ? leadInGap + lineH * 0.6 : lineH * 1.4) - 44;

  const doodle = slide.doodle && slide.doodle !== "none"
    ? doodlePath(slide.doodle, tx, doodleY, 40, titleColor)
    : "";

  const shadow = `<filter id="ts" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.5"/></filter>`;

  const leadInSvg = slide.leadIn
    ? `<text x="${tx}" y="${ty - (slide.title ? lineH * 1.05 : 0)}" font-family="'${scriptFont}', cursive" font-size="${leadInFontSize}" fill="${leadInColor}" text-anchor="${anchor}" filter="url(#ts)" opacity="0.9" letter-spacing="${leadInLetterSpacing}">${escXml(slide.leadIn)}</text>`
    : "";

  const titleSvg = slide.title
    ? `<text x="${tx}" y="${ty}" font-family="'${scriptFont}', cursive" font-size="${titleFontSize}" fill="${titleColor}" text-anchor="${anchor}" filter="url(#ts)" letter-spacing="${titleLetterSpacing}">${escXml(slide.title)}</text>`
    : "";

  const tagSvg = slide.tagLine
    ? `<text x="${tx}" y="${ty + lineH * tagLineLineHeight}" font-family="'${scriptFont}', cursive" font-size="${tagLineFontSize}" fill="${tagLineColor}" text-anchor="${anchor}" filter="url(#ts)" opacity="0.85" letter-spacing="${tagLineLetterSpacing}">${escXml(slide.tagLine)}</text>`
    : "";

  const wmSvg = watermark
    ? `<text x="${(SLIDE_SIZE / 2).toFixed(0)}" y="${(SLIDE_SIZE - 36).toFixed(0)}" font-family="'${scriptFont}', cursive" font-size="32" fill="${textColor}" text-anchor="middle" opacity="0.7" filter="url(#ts)">${escXml(watermark)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_SIZE}" height="${SLIDE_SIZE}">
  <defs>${shadow}<style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(scriptFont.replace(/ /g, "+"))}:wght@400');</style></defs>
  ${doodle}
  ${leadInSvg}
  ${titleSvg}
  ${tagSvg}
  ${wmSvg}
</svg>`;
}

// Auto-arrange algorithm — returns CollageElement[] for the "background_overlays" layout
function autoArrangeBackgroundOverlays(
  imageUrls: string[],
  slideCount: number,
): CollageElement[] {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;
  const elements: CollageElement[] = [];

  if (!imageUrls.length) return elements;

  elements.push({
    imageUrl: imageUrls[0],
    x: 0,
    y: 0,
    width: totalW,
    height: totalH,
    rotation: 0,
    zIndex: 0,
    hasBorder: false,
    isBackground: true,
  });

  const overlays = imageUrls.slice(1);
  if (!overlays.length) return elements;

  const baseTile = Math.round(totalH * 0.32);

  const slots: { cx: number; cy: number; scale: number; rot: number }[] = [];

  if (slideCount === 3) {
    slots.push(
      { cx: SLIDE_SIZE * 0.28, cy: totalH * 0.30, scale: 0.95, rot: -3 },
      { cx: SLIDE_SIZE * 0.82, cy: totalH * 0.65, scale: 1.05, rot: 4 },
      { cx: SLIDE_SIZE * 1.0,  cy: totalH * 0.25, scale: 1.0,  rot: -2 },
      { cx: SLIDE_SIZE * 1.55, cy: totalH * 0.70, scale: 0.9,  rot: 5 },
      { cx: SLIDE_SIZE * 2.0,  cy: totalH * 0.35, scale: 1.0,  rot: -4 },
      { cx: SLIDE_SIZE * 2.55, cy: totalH * 0.65, scale: 1.05, rot: 3 },
      { cx: SLIDE_SIZE * 2.75, cy: totalH * 0.20, scale: 0.9,  rot: -5 },
    );
  } else if (slideCount === 4) {
    slots.push(
      { cx: SLIDE_SIZE * 0.25, cy: totalH * 0.28, scale: 0.95, rot: -3 },
      { cx: SLIDE_SIZE * 0.78, cy: totalH * 0.67, scale: 1.0,  rot: 4 },
      { cx: SLIDE_SIZE * 1.0,  cy: totalH * 0.22, scale: 1.05, rot: -2 },
      { cx: SLIDE_SIZE * 1.5,  cy: totalH * 0.72, scale: 0.9,  rot: 5 },
      { cx: SLIDE_SIZE * 2.0,  cy: totalH * 0.28, scale: 1.0,  rot: -4 },
      { cx: SLIDE_SIZE * 2.55, cy: totalH * 0.68, scale: 1.05, rot: 3 },
      { cx: SLIDE_SIZE * 3.0,  cy: totalH * 0.32, scale: 0.95, rot: -5 },
      { cx: SLIDE_SIZE * 3.7,  cy: totalH * 0.65, scale: 1.0,  rot: 4 },
    );
  } else {
    slots.push(
      { cx: SLIDE_SIZE * 0.25, cy: totalH * 0.30, scale: 0.95, rot: -3 },
      { cx: SLIDE_SIZE * 0.85, cy: totalH * 0.65, scale: 1.0,  rot: 4 },
      { cx: SLIDE_SIZE * 1.0,  cy: totalH * 0.22, scale: 1.05, rot: -2 },
      { cx: SLIDE_SIZE * 1.6,  cy: totalH * 0.70, scale: 0.9,  rot: 5 },
      { cx: SLIDE_SIZE * 2.0,  cy: totalH * 0.30, scale: 1.0,  rot: -4 },
      { cx: SLIDE_SIZE * 2.55, cy: totalH * 0.68, scale: 1.05, rot: 3 },
      { cx: SLIDE_SIZE * 3.0,  cy: totalH * 0.25, scale: 0.95, rot: -3 },
      { cx: SLIDE_SIZE * 3.6,  cy: totalH * 0.70, scale: 1.0,  rot: 4 },
      { cx: SLIDE_SIZE * 4.0,  cy: totalH * 0.30, scale: 1.05, rot: -2 },
      { cx: SLIDE_SIZE * 4.7,  cy: totalH * 0.65, scale: 0.9,  rot: 5 },
    );
  }

  overlays.forEach((url, i) => {
    if (i >= slots.length) return;
    const { cx, cy, scale, rot } = slots[i];
    const tileW = Math.round(baseTile * scale * 1.1);
    const tileH = Math.round(baseTile * scale);
    elements.push({
      imageUrl: url,
      x: Math.round(cx - tileW / 2),
      y: Math.round(cy - tileH / 2),
      width: tileW,
      height: tileH,
      rotation: rot,
      zIndex: i + 1,
      hasBorder: true,
      isBackground: false,
    });
  });

  return elements;
}

function autoArrangeMosaic(imageUrls: string[], slideCount: number): CollageElement[] {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;
  const elements: CollageElement[] = [];
  const count = Math.min(imageUrls.length, slideCount * 2);
  const cols = slideCount * 2;
  const rows = 2;
  const cellW = Math.round(totalW / cols);
  const cellH = Math.round(totalH / rows);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    elements.push({
      imageUrl: imageUrls[i],
      x: col * cellW,
      y: row * cellH,
      width: cellW,
      height: cellH,
      rotation: 0,
      zIndex: i,
      hasBorder: false,
      isBackground: false,
    });
  }
  return elements;
}

function autoArrangeMagazine(imageUrls: string[], slideCount: number): CollageElement[] {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;
  const elements: CollageElement[] = [];
  if (!imageUrls.length) return elements;

  const domW = Math.round(totalW * 0.42);
  const domH = totalH;
  elements.push({ imageUrl: imageUrls[0], x: 0, y: 0, width: domW, height: domH, rotation: 0, zIndex: 0, hasBorder: false, isBackground: false });
  if (imageUrls[1]) {
    elements.push({ imageUrl: imageUrls[1], x: Math.round(totalW * 0.55), y: 0, width: domW, height: domH, rotation: 0, zIndex: 1, hasBorder: false, isBackground: false });
  }

  const accents = imageUrls.slice(2);
  const accentSize = Math.round(totalH * 0.28);
  accents.forEach((url, i) => {
    elements.push({
      imageUrl: url,
      x: Math.round(totalW * 0.45) + (i % 2) * (accentSize + 20),
      y: i < 2 ? 40 : Math.round(totalH * 0.55),
      width: accentSize,
      height: accentSize,
      rotation: (i % 2 === 0 ? -2 : 3),
      zIndex: i + 2,
      hasBorder: true,
      isBackground: false,
    });
  });

  return elements;
}

function autoArrangeSingleFeature(imageUrls: string[], slideCount: number): CollageElement[] {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;
  const elements: CollageElement[] = [];
  if (!imageUrls.length) return elements;

  // Hero image takes ~60% of canvas width, centered
  const heroW = Math.round(totalW * 0.60);
  const heroX = Math.round((totalW - heroW) / 2);
  elements.push({
    imageUrl: imageUrls[0],
    x: heroX, y: 0, width: heroW, height: totalH,
    rotation: 0, zIndex: 0, hasBorder: false, isBackground: false,
  });

  // Accent images fill left + right margins
  const accentW = Math.round(totalW * 0.18);
  const accentH = Math.round(totalH * 0.42);
  const accents = imageUrls.slice(1, 7);
  const accentSlots = [
    { x: Math.round(heroX * 0.1), y: Math.round(totalH * 0.08), rot: -3 },
    { x: Math.round(heroX * 0.05), y: Math.round(totalH * 0.55), rot: 4 },
    { x: Math.round(totalW - heroX * 0.1 - accentW), y: Math.round(totalH * 0.10), rot: 3 },
    { x: Math.round(totalW - heroX * 0.05 - accentW), y: Math.round(totalH * 0.57), rot: -4 },
    { x: Math.round(heroX * 0.5 - accentW / 2), y: Math.round(totalH * 0.30), rot: 5 },
    { x: Math.round(totalW - heroX * 0.5 - accentW / 2), y: Math.round(totalH * 0.30), rot: -5 },
  ];
  accents.forEach((url, i) => {
    if (i >= accentSlots.length) return;
    const s = accentSlots[i];
    elements.push({
      imageUrl: url, x: s.x, y: s.y, width: accentW, height: accentH,
      rotation: s.rot, zIndex: i + 1, hasBorder: true, isBackground: false,
    });
  });
  return elements;
}

function autoArrangeFree(imageUrls: string[], slideCount: number): CollageElement[] {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;
  const elements: CollageElement[] = [];
  const count = Math.min(imageUrls.length, 10);
  const baseSize = Math.round(totalH * 0.38);
  const rots = [-5, 4, -3, 5, -4, 3, -2, 5, -5, 3];
  const xs = [0.05, 0.22, 0.40, 0.58, 0.75, 0.12, 0.30, 0.50, 0.68, 0.85];
  const ys = [0.05, 0.50, 0.08, 0.52, 0.04, 0.55, 0.10, 0.48, 0.06, 0.52];
  for (let i = 0; i < count; i++) {
    const scale = 0.85 + (i % 3) * 0.1;
    const w = Math.round(baseSize * scale * 1.05);
    const h = Math.round(baseSize * scale);
    elements.push({
      imageUrl: imageUrls[i],
      x: Math.round(xs[i] * totalW),
      y: Math.round(ys[i] * totalH),
      width: w, height: h,
      rotation: rots[i],
      zIndex: i,
      hasBorder: i % 3 !== 0,
      isBackground: false,
    });
  }
  return elements;
}

function buildAutoArrange(layout: string, imageUrls: string[], slideCount: number): CollageElement[] {
  if (layout === "mosaic") return autoArrangeMosaic(imageUrls, slideCount);
  if (layout === "magazine") return autoArrangeMagazine(imageUrls, slideCount);
  if (layout === "single_feature") return autoArrangeSingleFeature(imageUrls, slideCount);
  if (layout === "free") return autoArrangeFree(imageUrls, slideCount);
  return autoArrangeBackgroundOverlays(imageUrls, slideCount);
}

// POST /api/seamless/upload
router.post("/seamless/upload", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) { res.status(400).json({ error: "No images uploaded" }); return; }

    const urls: string[] = [];
    for (const f of files) {
      const ext = f.mimetype.includes("png") ? "png" : "jpg";
      const url = await uploadBuf(f.buffer, `source-${Date.now()}.${ext}`, "seamless/source", f.mimetype);
      urls.push(url);
    }
    res.json({ urls });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/seamless/upload-logo
router.post("/seamless/upload-logo", upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const url = await uploadBuf(req.file.buffer, `logo-${Date.now()}.png`, "seamless/logos", req.file.mimetype);
    res.json({ logoUrl: url });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/seamless/auto-arrange
router.post("/seamless/auto-arrange", async (req, res) => {
  try {
    const { slideCount, layoutStyle, imageUrls } = req.body as { slideCount: number; layoutStyle: string; imageUrls: string[] };
    if (!imageUrls?.length) { res.status(400).json({ error: "No imageUrls provided" }); return; }
    const elements = buildAutoArrange(layoutStyle, imageUrls, slideCount);
    res.json({ elements });
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
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
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
      layoutStyle: body.layoutStyle ?? "background_overlays",
      uploadedImageUrls: body.uploadedImageUrls ?? [],
      collageElements: body.collageElements ?? [],
      slides: body.slides ?? [],
      scriptFont: body.scriptFont ?? "Allura",
      textColor: body.textColor ?? "#ffffff",
      watermark: body.watermark ?? "",
      renderedSlideUrls: [],
      logoConfig: body.logoConfig ?? null,
      musicTrack: body.musicTrack ?? null,
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
      layoutStyle: body.layoutStyle,
      uploadedImageUrls: body.uploadedImageUrls ?? [],
      collageElements: body.collageElements ?? [],
      slides: body.slides,
      scriptFont: body.scriptFont,
      textColor: body.textColor,
      watermark: body.watermark,
      logoConfig: body.logoConfig ?? null,
      musicTrack: body.musicTrack ?? null,
      updatedAt: new Date(),
    }).where(eq(seamlessCarouselsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
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

// Render collage element onto the wide canvas buffer using sharp
async function renderCollage(elements: CollageElement[], slideCount: number): Promise<Buffer> {
  const totalW = SLIDE_SIZE * slideCount;
  const totalH = SLIDE_SIZE;

  const BORDER = 12;

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const composites: sharp.OverlayOptions[] = [];

  for (let el of sorted) {
    let buf = await fetchBuf(el.imageUrl);

    if (el.isBackground) {
      buf = await sharp(buf)
        .resize(totalW, totalH, { fit: "cover", position: "centre" })
        .modulate({ brightness: 0.75 })
        .png()
        .toBuffer();
      composites.push({ input: buf, left: 0, top: 0, blend: "over" });
    } else {
      const innerW = el.hasBorder ? el.width - BORDER * 2 : el.width;
      const innerH = el.hasBorder ? el.height - BORDER * 2 : el.height;

      let imgBuf = await sharp(buf)
        .resize(innerW, innerH, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();

      if (el.hasBorder) {
        // White polaroid border + soft drop shadow via SVG filter
        const shadowPad = 18;
        const frameW = el.width + shadowPad * 2;
        const frameH = el.height + shadowPad * 2;
        const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}">
          <defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/></filter></defs>
          <rect x="${shadowPad}" y="${shadowPad}" width="${el.width}" height="${el.height}" fill="white" filter="url(#sh)" rx="2"/>
          <image href="data:image/png;base64,${imgBuf.toString("base64")}" x="${shadowPad + BORDER}" y="${shadowPad + BORDER}" width="${innerW}" height="${innerH}"/>
        </svg>`;
        imgBuf = await sharp(Buffer.from(frameSvg)).png().toBuffer();
        // Adjust x,y to account for shadow padding
        el = { ...el, x: el.x - shadowPad, y: el.y - shadowPad, width: frameW, height: frameH };
      }

      if (el.rotation !== 0) {
        const rad = (el.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rotW = Math.ceil(el.width * cos + el.height * sin);
        const rotH = Math.ceil(el.width * sin + el.height * cos);

        const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${rotW}" height="${rotH}">
          <image href="data:image/png;base64,${imgBuf.toString("base64")}" 
            width="${el.width}" height="${el.height}"
            transform="rotate(${el.rotation} ${rotW / 2} ${rotH / 2}) translate(${(rotW - el.width) / 2} ${(rotH - el.height) / 2})"/>
        </svg>`;

        imgBuf = await sharp(Buffer.from(svgWrapper)).png().toBuffer();

        const elCx = el.x + el.width / 2;
        const elCy = el.y + el.height / 2;
        const left = Math.round(elCx - rotW / 2);
        const top = Math.round(elCy - rotH / 2);

        const cl = Math.max(0, Math.min(left, totalW - 1));
        const ct = Math.max(0, Math.min(top, totalH - 1));
        composites.push({ input: imgBuf, left: cl, top: ct, blend: "over" });
      } else {
        const left = Math.max(0, Math.min(el.x, totalW - 1));
        const top = Math.max(0, Math.min(el.y, totalH - 1));
        composites.push({ input: imgBuf, left, top, blend: "over" });
      }
    }
  }

  const base = await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return base;
}

// Composite logo onto a slide buffer
async function compositeLogoOnSlide(
  slideBuf: Buffer,
  logoBuf: Buffer,
  logoConfig: SeamlessLogoConfig,
): Promise<Buffer> {
  const logoMeta = await sharp(logoBuf).metadata();
  const logoAr = (logoMeta.width ?? 1) / (logoMeta.height ?? 1);
  const logoBaseH = Math.round(SLIDE_SIZE * 0.12 * logoConfig.scale);
  const logoW = Math.round(logoBaseH * logoAr);
  const logoH = logoBaseH;

  let resizedLogo = await sharp(logoBuf)
    .resize(logoW, logoH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Apply rotation if needed
  if (logoConfig.rotation !== 0) {
    const rad = (logoConfig.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotW = Math.ceil(logoW * cos + logoH * sin);
    const rotH = Math.ceil(logoW * sin + logoH * cos);
    const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${rotW}" height="${rotH}">
      <image href="data:image/png;base64,${resizedLogo.toString("base64")}"
        width="${logoW}" height="${logoH}"
        transform="rotate(${logoConfig.rotation} ${rotW / 2} ${rotH / 2}) translate(${(rotW - logoW) / 2} ${(rotH - logoH) / 2})"/>
    </svg>`;
    resizedLogo = await sharp(Buffer.from(svgWrapper)).png().toBuffer();
    const rotMeta = await sharp(resizedLogo).metadata();
    const left = Math.max(0, Math.round(logoConfig.x * SLIDE_SIZE - (rotMeta.width ?? rotW) / 2));
    const top = Math.max(0, Math.round(logoConfig.y * SLIDE_SIZE - (rotMeta.height ?? rotH) / 2));
    return sharp(slideBuf).composite([{ input: resizedLogo, left, top, blend: "over" }]).png().toBuffer();
  }

  const left = Math.max(0, Math.round(logoConfig.x * SLIDE_SIZE - logoW / 2));
  const top = Math.max(0, Math.round(logoConfig.y * SLIDE_SIZE - logoH / 2));
  return sharp(slideBuf).composite([{ input: resizedLogo, left, top, blend: "over" }]).png().toBuffer();
}

// POST /api/seamless/:id/render
router.post("/seamless/:id/render", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [carousel] = await db.select().from(seamlessCarouselsTable).where(eq(seamlessCarouselsTable.id, id));
    if (!carousel) { res.status(404).json({ error: "Not found" }); return; }

    const n = carousel.slideCount;
    const slides = (carousel.slides ?? []) as SeamlessSlide[];
    const elements = (carousel.collageElements ?? []) as CollageElement[];
    const scriptFont = carousel.scriptFont ?? "Allura";
    const textColor = carousel.textColor ?? "#ffffff";
    const watermark = carousel.watermark ?? "";
    const logoConfig = carousel.logoConfig as SeamlessLogoConfig | null;

    if (!elements.length) { res.status(400).json({ error: "No collage elements — run auto-arrange first" }); return; }

    // Fetch logo buffer once if needed
    let logoBuf: Buffer | null = null;
    if (logoConfig?.logoUrl) {
      try {
        logoBuf = await fetchBuf(logoConfig.logoUrl);
      } catch {
        req.log.warn("Failed to fetch seamless logo, skipping");
      }
    }

    // Render the full collage canvas
    const wideBuffer = await renderCollage(elements, n);

    // Slice into N 1080×1080 slides and apply text overlays + logo
    const slideUrls: string[] = [];
    for (let i = 0; i < n; i++) {
      const slide = slides[i] ?? { hasText: false, title: "", leadIn: "", tagLine: "", doodle: "none", position: "bottom-left" };
      let cropped = await sharp(wideBuffer)
        .extract({ left: i * SLIDE_SIZE, top: 0, width: SLIDE_SIZE, height: SLIDE_SIZE })
        .png()
        .toBuffer();

      const textSvg = buildSlideTextSvg(slide, scriptFont, textColor, watermark);
      cropped = await sharp(cropped)
        .composite([{ input: Buffer.from(textSvg), left: 0, top: 0, blend: "over" }])
        .png()
        .toBuffer();

      // Composite logo if present
      if (logoBuf && logoConfig) {
        try {
          cropped = await compositeLogoOnSlide(cropped, logoBuf, logoConfig);
        } catch {
          req.log.warn(`Logo composite failed for slide ${i + 1}, skipping`);
        }
      }

      const url = await uploadBuf(cropped, `seamless-slide-${i + 1}-${Date.now()}.png`, "seamless/rendered");
      slideUrls.push(url);
    }

    await db.update(seamlessCarouselsTable)
      .set({ renderedSlideUrls: slideUrls, updatedAt: new Date() })
      .where(eq(seamlessCarouselsTable.id, id));

    res.json({ slideUrls });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
