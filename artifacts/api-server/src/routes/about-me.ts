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

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function heartPath(hx: number, hy: number, s: number): string {
  return `M ${hx} ${hy + s * 0.28} C ${hx - s * 0.5} ${hy + s * 0.05} ${hx - s * 0.5} ${hy - s * 0.55} ${hx} ${hy - s * 0.28} C ${hx + s * 0.5} ${hy - s * 0.55} ${hx + s * 0.5} ${hy + s * 0.05} ${hx} ${hy + s * 0.28} Z`;
}

function buildSvgOverlay(
  canvasW: number,
  canvasH: number,
  title: string,
  subtitle: string,
  titleFont: string,
  accentColor: string,
  words: AboutMeWord[],
  overlayOpacity: number,
  heartSize: number,
): string {
  const tint = overlayOpacity > 0
    ? `<rect width="${canvasW}" height="${canvasH}" fill="${accentColor}" opacity="${overlayOpacity}"/>`
    : "";

  // Heart size: server-side scale (heartSize is design unit, scale to canvas)
  const hs = Math.round(heartSize * 2.2);
  // Gap between heart and word text (scales with heart size)
  const heartWordGap = Math.round(hs * 1.6 + 18);

  const wordsSvg = words.map((w) => {
    const wx = w.x * canvasW;
    const wy = w.y * canvasH;
    const hy = wy - heartWordGap;
    return `<path d="${heartPath(wx, hy, hs)}" fill="${accentColor}" opacity="0.9"/>
<text x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="${accentColor}" text-anchor="middle" letter-spacing="1">${escXml(w.text)}</text>`;
  }).join("\n");

  const sparkles = [
    [0.08, 0.11, 32, 0.5],
    [0.9, 0.5, 22, 0.4],
    [0.16, 0.84, 20, 0.38],
    [0.84, 0.13, 28, 0.45],
    [0.5, 0.95, 22, 0.35],
  ].map(([rx, ry, size, op]) =>
    `<text x="${(rx as number * canvasW).toFixed(0)}" y="${(ry as number * canvasH).toFixed(0)}" font-size="${size}" fill="${accentColor}" text-anchor="middle" opacity="${op}">✦</text>`
  ).join("\n");

  // Title font Google import
  const fontParam = encodeURIComponent(titleFont.replace(/ /g, "+"));
  const titleFontSize = title.length > 16 ? 72 : 90;
  const subtitleSvg = subtitle
    ? `<text x="${(canvasW / 2).toFixed(0)}" y="${(titleFontSize + 120).toFixed(0)}" font-family="Georgia, serif" font-size="42" fill="${accentColor}" text-anchor="middle" opacity="0.85" letter-spacing="2">${escXml(subtitle.toUpperCase())}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@400');</style>
    <filter id="shadow"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter>
  </defs>
  ${tint}
  <text x="${(canvasW / 2).toFixed(0)}" y="${titleFontSize + 30}" font-family="'${titleFont}', 'Allura', cursive" font-size="${titleFontSize}" fill="${accentColor}" text-anchor="middle" filter="url(#shadow)">${escXml(title)}</text>
  ${subtitleSvg}
  ${wordsSvg}
  ${sparkles}
</svg>`;
}

// POST /api/about-me/upload-photo
router.post("/about-me/upload-photo", upload.fields([
  { name: "original", maxCount: 1 },
  { name: "cutout", maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (!files) { res.status(400).json({ error: "No files uploaded" }); return; }

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
    res.json(await q.orderBy(desc(aboutMePostsTable.createdAt)));
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/about-me/:id
router.get("/about-me/:id", async (req, res) => {
  try {
    const [post] = await db.select().from(aboutMePostsTable).where(eq(aboutMePostsTable.id, parseInt(req.params.id)));
    if (!post) { res.status(404).json({ error: "Not found" }); return; }
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
      subtitle: body.subtitle ?? "",
      heartSize: body.heartSize ?? 20,
      words: body.words ?? [],
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
      subtitle: body.subtitle ?? "",
      heartSize: body.heartSize ?? 20,
      words: body.words,
      accentColor: body.accentColor,
      titleFont: body.titleFont,
      aspectRatio: body.aspectRatio,
      updatedAt: new Date(),
    }).where(eq(aboutMePostsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
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
    if (!post) { res.status(404).json({ error: "Not found" }); return; }

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

    const overlayOp = (post.backgroundOverlayOpacity ?? 0) / 100;
    const words = (post.words ?? []) as AboutMeWord[];
    const heartSize = post.heartSize ?? 20;
    const subtitle = post.subtitle ?? "";

    const svgStr = buildSvgOverlay(canvasW, canvasH, post.title, subtitle, post.titleFont ?? "Allura", post.accentColor ?? "#F5EEE3", words, overlayOp, heartSize);

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
