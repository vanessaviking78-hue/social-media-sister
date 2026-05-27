import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { aboutMePostsTable, type AboutMeWord } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { v4 as uuid } from "uuid";
import sharp from "sharp";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router: IRouter = Router();

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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function buildArrowPath(sx: number, sy: number, ex: number, ey: number, style: string): string {
  const cx = (sx + ex) / 2 + (ey - sy) * 0.25;
  const cy = (sy + ey) / 2 - (ex - sx) * 0.25;
  const angle = Math.atan2(ey - cy, ex - cx);
  const ah = 14;
  const ax1 = ex - ah * Math.cos(angle - 0.45);
  const ay1 = ey - ah * Math.sin(angle - 0.45);
  const ax2 = ex - ah * Math.cos(angle + 0.45);
  const ay2 = ey - ah * Math.sin(angle + 0.45);
  const head = `M ${ax1.toFixed(1)} ${ay1.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} L ${ax2.toFixed(1)} ${ay2.toFixed(1)}`;

  if (style === "straight") {
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
  }
  if (style === "dashed") {
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
  }
  if (style === "loop") {
    const lx = cx + (ey - sy) * 0.15;
    const ly = cy - (ex - sx) * 0.15;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx.toFixed(1)} ${cy.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
  }
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
}

function buildSvgOverlay(
  canvasW: number,
  canvasH: number,
  title: string,
  titleFont: string,
  accentColor: string,
  words: AboutMeWord[],
  arrowStyle: string,
  overlayOpacity: number,
  photoCenterX: number,
  photoCenterY: number,
  cutoutW: number,
  cutoutH: number,
): string {
  const tint = overlayOpacity > 0
    ? `<rect width="${canvasW}" height="${canvasH}" fill="${accentColor}" opacity="${overlayOpacity}"/>`
    : "";

  const wordsSvg = words.map((w, i) => {
    const wx = w.x * canvasW;
    const wy = w.y * canvasH;
    const seed = i * 137.5;
    const tx = photoCenterX + Math.cos(seed) * cutoutW * 0.28;
    const ty = photoCenterY + Math.sin(seed) * cutoutH * 0.28;
    const path = buildArrowPath(wx, wy + 4, tx, ty, w.arrowStyle || arrowStyle);
    const dashAttr = (w.arrowStyle || arrowStyle) === "dashed" ? 'stroke-dasharray="8 5"' : "";
    const underline = i % 3 === 0 ? 'text-decoration="underline"' : "";
    return `<text x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" font-family="Georgia, 'Times New Roman', serif" font-size="38" fill="${accentColor}" text-anchor="middle" ${underline}>${escXml(w.text)}</text>
<path d="${path}" stroke="${accentColor}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.88" ${dashAttr}/>`;
  }).join("\n");

  const sparkles = [
    [0.1, 0.14, 30, 0.55],
    [0.88, 0.52, 22, 0.42],
    [0.18, 0.82, 18, 0.38],
    [0.82, 0.15, 26, 0.48],
    [0.5, 0.93, 20, 0.35],
  ].map(([rx, ry, size, op]) =>
    `<text x="${(rx as number * canvasW).toFixed(0)}" y="${(ry as number * canvasH).toFixed(0)}" font-size="${size}" fill="${accentColor}" text-anchor="middle" opacity="${op}">✦</text>`
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(titleFont)}');</style>
  </defs>
  ${tint}
  <text x="${(canvasW / 2).toFixed(0)}" y="100" font-family="'${titleFont}', 'Allura', cursive" font-size="90" fill="${accentColor}" text-anchor="middle">${escXml(title)}</text>
  ${wordsSvg}
  ${sparkles}
</svg>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// POST /api/about-me/upload-photo
router.post("/about-me/upload-photo", upload.fields([
  { name: "original", maxCount: 1 },
  { name: "cutout", maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (!files) return res.status(400).json({ error: "No files uploaded" });

    const result: { originalUrl?: string; cutoutUrl?: string } = {};
    if (files.original?.[0]) {
      const f = files.original[0];
      result.originalUrl = await uploadBuf(f.buffer, `original-${Date.now()}.jpg`, "about-me/originals", f.mimetype);
    }
    if (files.cutout?.[0]) {
      const f = files.cutout[0];
      result.cutoutUrl = await uploadBuf(f.buffer, `cutout-${Date.now()}.png`, "about-me/cutouts", "image/png");
    }
    res.json(result);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/about-me
router.get("/about-me", async (req, res) => {
  try {
    const { clientName } = req.query;
    let q = db.select().from(aboutMePostsTable).$dynamic();
    if (clientName && typeof clientName === "string") {
      q = q.where(eq(aboutMePostsTable.clientName, clientName));
    }
    const posts = await q.orderBy(desc(aboutMePostsTable.createdAt));
    res.json(posts);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/about-me/:id
router.get("/about-me/:id", async (req, res) => {
  try {
    const [post] = await db.select().from(aboutMePostsTable).where(eq(aboutMePostsTable.id, parseInt(req.params.id)));
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/about-me
router.post("/about-me", async (req, res) => {
  try {
    const body = req.body;
    const [inserted] = await db.insert(aboutMePostsTable).values({
      clientName: body.clientName ?? "",
      originalPhotoUrl: body.originalPhotoUrl,
      cutoutPhotoUrl: body.cutoutPhotoUrl,
      backgroundPhotoUrl: body.backgroundPhotoUrl ?? null,
      backgroundBlurAmount: body.backgroundBlurAmount ?? 25,
      backgroundOverlayOpacity: body.backgroundOverlayOpacity ?? 0,
      title: body.title ?? "About me",
      words: body.words ?? [],
      arrowStyle: body.arrowStyle ?? "curly",
      accentColor: body.accentColor ?? "#F5EEE3",
      titleFont: body.titleFont ?? "Allura",
      aspectRatio: body.aspectRatio ?? "1080x1350",
    }).returning();
    res.json(inserted);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/about-me/:id
router.put("/about-me/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [updated] = await db.update(aboutMePostsTable).set({
      clientName: body.clientName,
      backgroundPhotoUrl: body.backgroundPhotoUrl ?? null,
      backgroundBlurAmount: body.backgroundBlurAmount,
      backgroundOverlayOpacity: body.backgroundOverlayOpacity,
      title: body.title,
      words: body.words,
      arrowStyle: body.arrowStyle,
      accentColor: body.accentColor,
      titleFont: body.titleFont,
      aspectRatio: body.aspectRatio,
      updatedAt: new Date(),
    }).where(eq(aboutMePostsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/about-me/:id
router.delete("/about-me/:id", async (req, res) => {
  try {
    await db.delete(aboutMePostsTable).where(eq(aboutMePostsTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/about-me/:id/render
router.post("/about-me/:id/render", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [post] = await db.select().from(aboutMePostsTable).where(eq(aboutMePostsTable.id, id));
    if (!post) return res.status(404).json({ error: "Not found" });

    const [canvasW, canvasH] = post.aspectRatio === "1080x1920" ? [1080, 1920] : [1080, 1350];

    const bgBuf = await fetchBuf(post.backgroundPhotoUrl ?? post.originalPhotoUrl);
    const blurAmt = Math.max(0.3, post.backgroundBlurAmount ?? 25);
    const blurredBg = await sharp(bgBuf)
      .resize(canvasW, canvasH, { fit: "cover", position: "centre" })
      .blur(blurAmt)
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .png()
      .toBuffer();

    const cutoutBuf = await fetchBuf(post.cutoutPhotoUrl);
    const cutoutH = Math.round(canvasH * 0.54);
    const meta = await sharp(cutoutBuf).metadata();
    const ar = (meta.width ?? 800) / (meta.height ?? 1000);
    const cutoutW = Math.min(canvasW - 40, Math.round(cutoutH * ar));
    const cutoutResized = await sharp(cutoutBuf)
      .resize(cutoutW, cutoutH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const cutoutLeft = Math.round((canvasW - cutoutW) / 2);
    const cutoutTop = Math.round(canvasH * 0.21);
    const photoCX = canvasW / 2;
    const photoCY = cutoutTop + cutoutH / 2;

    const overlayOp = (post.backgroundOverlayOpacity ?? 0) / 100;
    const words = (post.words ?? []) as AboutMeWord[];
    const svgStr = buildSvgOverlay(canvasW, canvasH, post.title, post.titleFont ?? "Allura", post.accentColor ?? "#F5EEE3", words, post.arrowStyle ?? "curly", overlayOp, photoCX, photoCY, cutoutW, cutoutH);

    const composed = await sharp(blurredBg)
      .composite([
        { input: cutoutResized, left: cutoutLeft, top: cutoutTop, blend: "over" },
        { input: Buffer.from(svgStr), left: 0, top: 0, blend: "over" },
      ])
      .png()
      .toBuffer();

    const renderedUrl = await uploadBuf(composed, `about-me-${Date.now()}.png`, "about-me/rendered");
    await db.update(aboutMePostsTable).set({ renderedImageUrl: renderedUrl, updatedAt: new Date() }).where(eq(aboutMePostsTable.id, id));

    res.json({ renderedUrl });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
