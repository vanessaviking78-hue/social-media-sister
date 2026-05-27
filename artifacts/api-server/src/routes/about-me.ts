import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  aboutMePostsTable,
  type AboutMeWord,
  type AboutMeDoodle,
  type AboutMeCanvasConfig,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { v4 as uuid } from "uuid";
import sharp from "sharp";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router: IRouter = Router();

const DEFAULT_CANVAS_CONFIG: AboutMeCanvasConfig = {
  cutoutX: 0.5,
  cutoutY: 0.55,
  cutoutScale: 1.0,
  glowEnabled: false,
  glowColor: "#ffffff",
  shadowEnabled: false,
  shadowOpacity: 0.4,
  shadowBlur: 15,
  shadowOffsetX: 5,
  shadowOffsetY: 8,
  logoUrl: "",
  logoX: 0.85,
  logoY: 0.88,
  logoScale: 1.0,
  logoRotation: 0,
  doodles: [],
  titleFontSize: 90,
  titleLetterSpacing: 0,
  subtitleFontSize: 40,
  subtitleLetterSpacing: 3,
  wordFontSize: 40,
};

async function uploadBuf(
  buffer: Buffer,
  filename: string,
  folder: string,
  mime = "image/png",
): Promise<string> {
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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function heartPath(hx: number, hy: number, s: number): string {
  return `M ${hx} ${hy + s * 0.28} C ${hx - s * 0.5} ${hy + s * 0.05} ${hx - s * 0.5} ${hy - s * 0.55} ${hx} ${hy - s * 0.28} C ${hx + s * 0.5} ${hy - s * 0.55} ${hx + s * 0.5} ${hy + s * 0.05} ${hx} ${hy + s * 0.28} Z`;
}

function heartOutlinePath(cx: number, cy: number, s: number): string {
  return `M ${cx + 0.05 * s},${cy + 0.65 * s} C ${cx - 0.55 * s},${cy + 0.18 * s} ${cx - 1.05 * s},${cy - 0.22 * s} ${cx - 0.98 * s},${cy - 0.72 * s} C ${cx - 0.92 * s},${cy - 1.12 * s} ${cx - 0.55 * s},${cy - 1.3 * s} ${cx - 0.28 * s},${cy - 1.18 * s} C ${cx - 0.08 * s},${cy - 1.08 * s} ${cx},${cy - 0.78 * s} ${cx},${cy - 0.78 * s} C ${cx},${cy - 0.78 * s} ${cx + 0.1 * s},${cy - 1.1 * s} ${cx + 0.32 * s},${cy - 1.2 * s} C ${cx + 0.62 * s},${cy - 1.35 * s} ${cx + 1.02 * s},${cy - 1.1 * s} ${cx + 0.98 * s},${cy - 0.68 * s} C ${cx + 0.95 * s},${cy - 0.2 * s} ${cx + 0.5 * s},${cy + 0.17 * s} ${cx + 0.05 * s},${cy + 0.65 * s} Z`;
}

function arrowPath(cx: number, cy: number, s: number): string {
  const x0 = cx - s * 0.88, y0 = cy + s * 0.08;
  const c1x = cx - s * 0.3, c1y = cy - s * 0.5;
  const c2x = cx + s * 0.15, c2y = cy - s * 0.6;
  const x3 = cx + s * 0.78, y3 = cy - s * 0.08;
  const ah1x = cx + s * 0.48, ah1y = cy - s * 0.55;
  const ah2x = cx + s * 0.78, ah2y = cy - s * 0.08;
  const ah3x = cx + s * 0.58, ah3y = cy + s * 0.22;
  return `M ${x0},${y0} C ${c1x},${c1y} ${c2x},${c2y} ${x3},${y3} M ${ah1x},${ah1y} L ${ah2x},${ah2y} L ${ah3x},${ah3y}`;
}

function doodleSvg(d: AboutMeDoodle, canvasW: number, canvasH: number, color: string): string {
  const cx = d.x * canvasW;
  const cy = d.y * canvasH;
  const s = d.size * 2.2;
  const rot = d.rotation ?? 0;
  const transform = rot !== 0 ? ` transform="rotate(${rot} ${cx} ${cy})"` : "";

  if (d.shape === "heart-outline") {
    return `<path d="${heartOutlinePath(cx, cy, s)}" fill="none" stroke="${color}" stroke-width="${Math.max(2, s * 0.06)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"${transform}/>`;
  }
  if (d.shape === "arrow") {
    return `<path d="${arrowPath(cx, cy, s)}" fill="none" stroke="${color}" stroke-width="${Math.max(2, s * 0.07)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"${transform}/>`;
  }
  return `<text x="${cx}" y="${cy}" font-size="${s * 0.7}" fill="${color}" text-anchor="middle" opacity="0.85"${transform}>✦</text>`;
}

async function buildFullSvg(
  canvasW: number,
  canvasH: number,
  title: string,
  subtitle: string,
  titleFont: string,
  accentColor: string,
  heartSize: number,
  words: AboutMeWord[],
  cfg: AboutMeCanvasConfig,
  overlayOpacity: number,
  cutoutDataUri: string,
  cutoutNaturalW: number,
  cutoutNaturalH: number,
  logoDataUri: string,
): Promise<string> {
  const cc = { ...DEFAULT_CANVAS_CONFIG, ...cfg };

  const titleColor = cc.titleColor ?? accentColor;
  const titleFontSize = cc.titleFontSize ?? (title.length > 16 ? 72 : 90);
  const titleLetterSpacing = cc.titleLetterSpacing ?? 0;
  const titleLineHeight = cc.titleLineHeight ?? 1.1;
  const subtitleColor = cc.subtitleColor ?? accentColor;
  const subtitleFontSize = cc.subtitleFontSize ?? 40;
  const subtitleLetterSpacing = cc.subtitleLetterSpacing ?? 3;
  const subtitleLineHeight = cc.subtitleLineHeight ?? 1.2;
  const wordFontSize = cc.wordFontSize ?? 40;

  // Cutout dimensions
  const cutoutBaseH = canvasH * 0.54;
  const cutoutDisplayH = cutoutBaseH * cc.cutoutScale;
  const ar = cutoutNaturalW / cutoutNaturalH;
  const cutoutDisplayW = Math.min(canvasW - 40, cutoutDisplayH * ar);
  const cutoutCx = cc.cutoutX * canvasW;
  const cutoutCy = cc.cutoutY * canvasH;
  const cutoutLeft = cutoutCx - cutoutDisplayW / 2;
  const cutoutTop = cutoutCy - cutoutDisplayH / 2;

  // Logo dimensions
  const logoBaseH = canvasH * 0.12;
  const logoDisplayH = logoBaseH * cc.logoScale;
  const logoCx = cc.logoX * canvasW;
  const logoCy = cc.logoY * canvasH;

  // Heart word gap
  const hs = Math.round(heartSize * 2.2);
  const hwg = Math.round(hs * 1.6 + 18);

  // Defs
  const defsContent: string[] = [];
  const fontParam = encodeURIComponent(titleFont.replace(/ /g, "+"));
  defsContent.push(`<style>@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@400');</style>`);
  defsContent.push(`<filter id="txtshadow"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter>`);

  if (cc.glowEnabled) {
    defsContent.push(`<radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${cc.glowColor}" stop-opacity="0.65"/>
      <stop offset="55%" stop-color="${cc.glowColor}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${cc.glowColor}" stop-opacity="0"/>
    </radialGradient>`);
  }
  if (cc.shadowEnabled) {
    const stdDev = Math.max(1, cc.shadowBlur / 3);
    defsContent.push(`<filter id="cshadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="${cc.shadowOffsetX}" dy="${cc.shadowOffsetY}" stdDeviation="${stdDev}" flood-color="#000000" flood-opacity="${cc.shadowOpacity}"/></filter>`);
  }

  const layers: string[] = [];

  // Tint overlay
  if (overlayOpacity > 0) {
    layers.push(`<rect width="${canvasW}" height="${canvasH}" fill="${accentColor}" opacity="${overlayOpacity}"/>`);
  }

  // Glow behind cutout
  if (cc.glowEnabled) {
    const rx = cutoutDisplayW * 0.65;
    const ry = cutoutDisplayH * 0.5;
    layers.push(`<ellipse cx="${cutoutCx.toFixed(1)}" cy="${cutoutCy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#glow)"/>`);
  }

  // Cutout image
  const shadowFilter = cc.shadowEnabled ? ` filter="url(#cshadow)"` : "";
  layers.push(`<image href="${cutoutDataUri}" x="${cutoutLeft.toFixed(1)}" y="${cutoutTop.toFixed(1)}" width="${cutoutDisplayW.toFixed(1)}" height="${cutoutDisplayH.toFixed(1)}" preserveAspectRatio="xMidYMid meet"${shadowFilter}/>`);

  // Title
  const titleY = titleFontSize + 28;
  const lsAttr = titleLetterSpacing > 0 ? ` letter-spacing="${titleLetterSpacing}"` : "";
  layers.push(`<text x="${(canvasW / 2).toFixed(0)}" y="${titleY}" font-family="'${titleFont}', 'Allura', cursive" font-size="${titleFontSize}" fill="${titleColor}" text-anchor="middle" filter="url(#txtshadow)"${lsAttr}>${escXml(title)}</text>`);

  // Subtitle
  if (subtitle) {
    const subY = Math.round(titleFontSize * titleLineHeight) + 28 + subtitleFontSize * subtitleLineHeight;
    layers.push(`<text x="${(canvasW / 2).toFixed(0)}" y="${subY.toFixed(0)}" font-family="Georgia, serif" font-size="${subtitleFontSize}" fill="${subtitleColor}" text-anchor="middle" opacity="0.85" letter-spacing="${subtitleLetterSpacing}">${escXml(subtitle.toUpperCase())}</text>`);
  }

  // Words with hearts
  words.forEach((w) => {
    const wx = w.x * canvasW;
    const wy = w.y * canvasH;
    const hy = wy - hwg;
    const wColor = w.color ?? accentColor;
    const wSize = w.fontSize ?? wordFontSize;
    const wLetterSpacing = w.letterSpacing ?? 1;
    const wLineHeight = w.lineHeight ?? 1.2;
    const wHs = Math.round(heartSize * 2.2 * wLineHeight);
    const wHy = wy - Math.round(hwg * wLineHeight);
    layers.push(`<path d="${heartPath(wx, wHy, wHs)}" fill="${wColor}" opacity="0.9"/>`);
    layers.push(`<text x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" font-family="Georgia, serif" font-size="${wSize}" fill="${wColor}" text-anchor="middle" letter-spacing="${wLetterSpacing}">${escXml(w.text)}</text>`);
  });

  // Doodles
  cc.doodles.forEach((d) => {
    layers.push(doodleSvg(d, canvasW, canvasH, accentColor));
  });

  // Logo
  if (logoDataUri && cc.logoUrl) {
    try {
      const logoMeta = await sharp(Buffer.from(logoDataUri.split(",")[1] ?? "", "base64")).metadata();
      const logoAr = (logoMeta.width ?? 1) / (logoMeta.height ?? 1);
      const logoDisplayW = logoDisplayH * logoAr;
      const logoLeft = logoCx - logoDisplayW / 2;
      const logoTop = logoCy - logoDisplayH / 2;
      const logoRot = cc.logoRotation ?? 0;
      const rotAttr = logoRot !== 0 ? ` transform="rotate(${logoRot} ${logoCx.toFixed(1)} ${logoCy.toFixed(1)})"` : "";
      layers.push(`<image href="${logoDataUri}" x="${logoLeft.toFixed(1)}" y="${logoTop.toFixed(1)}" width="${logoDisplayW.toFixed(1)}" height="${logoDisplayH.toFixed(1)}" preserveAspectRatio="xMidYMid meet"${rotAttr}/>`);
    } catch {
      // skip logo if metadata fails
    }
  }

  // Accent sparkles
  [
    [0.08, 0.10, 30, 0.5],
    [0.9, 0.5, 22, 0.4],
    [0.16, 0.84, 20, 0.38],
    [0.84, 0.12, 26, 0.45],
  ].forEach(([rx, ry, size, op]) => {
    layers.push(`<text x="${(rx as number * canvasW).toFixed(0)}" y="${(ry as number * canvasH).toFixed(0)}" font-size="${size}" fill="${accentColor}" text-anchor="middle" opacity="${op}">✦</text>`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}">
  <defs>${defsContent.join("\n")}</defs>
  ${layers.join("\n  ")}
</svg>`;
}

// POST /api/about-me/upload-photo
router.post(
  "/about-me/upload-photo",
  upload.fields([
    { name: "original", maxCount: 1 },
    { name: "cutout", maxCount: 1 },
  ]),
  async (req, res) => {
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
  },
);

// POST /api/about-me/upload-logo
router.post("/about-me/upload-logo", upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const url = await uploadBuf(req.file.buffer, `logo-${Date.now()}.png`, "about-me/logos", req.file.mimetype);
    res.json({ logoUrl: url });
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
    const [post] = await db
      .select()
      .from(aboutMePostsTable)
      .where(eq(aboutMePostsTable.id, parseInt(req.params.id)));
    if (!post) { res.status(404).json({ error: "Not found" }); return; }
    res.json(post);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

function extractCanvasConfig(body: any): AboutMeCanvasConfig {
  const src = body.canvasConfig ?? {};
  return { ...DEFAULT_CANVAS_CONFIG, ...src };
}

// POST /api/about-me
router.post("/about-me", async (req, res) => {
  try {
    const body = req.body;
    const [inserted] = await db
      .insert(aboutMePostsTable)
      .values({
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
        canvasConfig: extractCanvasConfig(body),
        accentColor: body.accentColor ?? "#F5EEE3",
        titleFont: body.titleFont ?? "Allura",
        aspectRatio: body.aspectRatio ?? "1080x1350",
        musicTrack: body.musicTrack ?? null,
      })
      .returning();
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
    const [updated] = await db
      .update(aboutMePostsTable)
      .set({
        clientName: body.clientName,
        backgroundPhotoUrl: body.backgroundPhotoUrl ?? null,
        backgroundBlurAmount: body.backgroundBlurAmount,
        backgroundOverlayOpacity: body.backgroundOverlayOpacity,
        title: body.title,
        subtitle: body.subtitle ?? "",
        heartSize: body.heartSize ?? 20,
        words: body.words,
        canvasConfig: extractCanvasConfig(body),
        accentColor: body.accentColor,
        titleFont: body.titleFont,
        aspectRatio: body.aspectRatio,
        musicTrack: body.musicTrack ?? null,
        updatedAt: new Date(),
      })
      .where(eq(aboutMePostsTable.id, id))
      .returning();
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
    const [post] = await db
      .select()
      .from(aboutMePostsTable)
      .where(eq(aboutMePostsTable.id, id));
    if (!post) { res.status(404).json({ error: "Not found" }); return; }

    const [canvasW, canvasH] =
      post.aspectRatio === "1080x1920" ? [1080, 1920] : [1080, 1350];

    const cc: AboutMeCanvasConfig = { ...DEFAULT_CANVAS_CONFIG, ...(post.canvasConfig ?? {}) };

    // 1. Blurred background
    const bgBuf = await fetchBuf(post.backgroundPhotoUrl ?? post.originalPhotoUrl);
    const blurAmt = Math.max(0.3, post.backgroundBlurAmount ?? 25);
    const blurredBg = await sharp(bgBuf)
      .resize(canvasW, canvasH, { fit: "cover", position: "centre" })
      .blur(blurAmt)
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .png()
      .toBuffer();

    // 2. Fetch cutout and encode as data URI
    const cutoutRaw = await fetchBuf(post.cutoutPhotoUrl);
    const cutoutMeta = await sharp(cutoutRaw).metadata();
    const cutoutNaturalW = cutoutMeta.width ?? 800;
    const cutoutNaturalH = cutoutMeta.height ?? 1000;
    const cutoutB64 = `data:image/png;base64,${cutoutRaw.toString("base64")}`;

    // 3. Logo data URI (if any)
    let logoB64 = "";
    if (cc.logoUrl) {
      try {
        const logoBuf = await fetchBuf(cc.logoUrl);
        const logoMime = cc.logoUrl.endsWith(".jpg") || cc.logoUrl.endsWith(".jpeg") ? "image/jpeg" : "image/png";
        logoB64 = `data:${logoMime};base64,${logoBuf.toString("base64")}`;
      } catch {
        req.log.warn("Failed to fetch logo, skipping");
      }
    }

    // 4. Build SVG overlay (text, doodles, logo as data URI)
    const words = (post.words ?? []) as AboutMeWord[];
    const svgStr = await buildFullSvg(
      canvasW,
      canvasH,
      post.title,
      post.subtitle ?? "",
      post.titleFont ?? "Allura",
      post.accentColor ?? "#F5EEE3",
      post.heartSize ?? 20,
      words,
      cc,
      (post.backgroundOverlayOpacity ?? 0) / 100,
      cutoutB64,
      cutoutNaturalW,
      cutoutNaturalH,
      logoB64,
    );

    // 5. Composite SVG onto background
    const composed = await sharp(blurredBg)
      .composite([{ input: Buffer.from(svgStr), left: 0, top: 0, blend: "over" }])
      .png()
      .toBuffer();

    const renderedUrl = await uploadBuf(
      composed,
      `about-me-${Date.now()}.png`,
      "about-me/rendered",
    );
    await db
      .update(aboutMePostsTable)
      .set({ renderedImageUrl: renderedUrl, updatedAt: new Date() })
      .where(eq(aboutMePostsTable.id, id));

    res.json({ renderedUrl });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
