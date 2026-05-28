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

// ─── TEMPLATE STYLES ────────────────────────────────────────────────────────

const TEMPLATE_STYLES = new Set([
  "full_fade", "notecard", "torn_scrapbook", "bold_editorial",
  "dark_doodle", "numbered_steps", "split_panel", "polaroid_scrapbook",
  "editorial_minimal", "paper_cutout", "textured_graphic", "dark_photo_steps",
]);

function wrapLines(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function resizeWithPlacement(buf: Buffer, el: CollageElement): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const tw = Math.max(el.width || S, S);
  const th = Math.max(el.height || S, S);
  const resized = await sharp(buf).resize(tw, th, { fit: "fill" }).png().toBuffer();
  const px = Math.max(0, Math.min(Math.round(-el.x), tw - S));
  const py = Math.max(0, Math.min(Math.round(-el.y), th - S));
  if (px === 0 && py === 0 && tw === S && th === S) return resized;
  return sharp(resized).extract({ left: px, top: py, width: S, height: S }).png().toBuffer();
}

// ── Full Frame Fade ──────────────────────────────────────────────────────────
async function renderFullFade(buf: Buffer, el: CollageElement, slide: SeamlessSlide, font: string, textColor: string, watermark: string): Promise<Buffer> {
  const S = SLIDE_SIZE;
  let bg = await resizeWithPlacement(buf, el);
  bg = await sharp(bg).modulate({ brightness: 0.52, saturation: 0.85 }).png().toBuffer();
  const vignette = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><radialGradient id="v" cx="50%" cy="55%" r="68%">
      <stop offset="20%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.65"/>
    </radialGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#v)"/>
  </svg>`;
  bg = await sharp(bg).composite([{ input: Buffer.from(vignette), blend: "over" }]).png().toBuffer();
  const textSvg = buildSlideTextSvg(slide, font, textColor, watermark);
  return sharp(bg).composite([{ input: Buffer.from(textSvg), blend: "over" }]).png().toBuffer();
}

// ── Notecard ─────────────────────────────────────────────────────────────────
async function renderNotecard(buf: Buffer, el: CollageElement, slide: SeamlessSlide, font: string): Promise<Buffer> {
  const S = SLIDE_SIZE;
  let bg = await resizeWithPlacement(buf, el);
  bg = await sharp(bg).modulate({ brightness: 0.62, saturation: 0.7 }).png().toBuffer();
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const cardW = 740, cardH = 660;
  const cx = (S - cardW) / 2, cy = (S - cardH) / 2;
  const titleLines = wrapLines(title, 22);
  const bodyLines = wrapLines(body, 38);
  const titleFs = title.length > 20 ? 56 : 68;
  let ty = cy + 125;
  let titleSvg = "";
  for (const line of titleLines) {
    titleSvg += `<text x="${S / 2}" y="${ty}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" text-anchor="middle" fill="#1A1A1A">${escXml(line)}</text>`;
    ty += titleFs * 1.2;
  }
  const divY = ty + 15;
  let bY = divY + 55;
  let bodySvg = "";
  for (const line of bodyLines) {
    bodySvg += `<text x="${S / 2}" y="${bY}" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#444">${escXml(line)}</text>`;
    bY += 48;
  }
  const subSvg = sub ? `<text x="${S / 2}" y="${cy + cardH - 55}" font-family="Georgia, serif" font-size="30" font-style="italic" text-anchor="middle" fill="#888">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="26" flood-color="#000" flood-opacity="0.4"/></filter></defs>
    <rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" fill="white" rx="3" filter="url(#sh)" opacity="0.97"/>
    <ellipse cx="${S / 2}" cy="${cy + 2}" rx="20" ry="13" fill="#B8A898" opacity="0.75"/>
    <circle cx="${S / 2}" cy="${cy - 6}" r="14" fill="#8B7355" opacity="0.9"/>
    <circle cx="${S / 2}" cy="${cy - 6}" r="6" fill="#6A5240"/>
    ${titleSvg}
    <line x1="${cx + 55}" y1="${divY - 8}" x2="${cx + cardW - 55}" y2="${divY - 8}" stroke="#E0D8D0" stroke-width="1.5"/>
    ${bodySvg}
    ${subSvg}
  </svg>`;
  return sharp(bg).composite([{ input: Buffer.from(svg), blend: "over" }]).png().toBuffer();
}

// ── Torn Scrapbook ────────────────────────────────────────────────────────────
async function renderTornScrapbook(buf: Buffer, el: CollageElement, slide: SeamlessSlide, font: string): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const bgBuf = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 240, g: 230, b: 211, alpha: 1 } } }).png().toBuffer();
  const photoW = 700, photoH = 710, photoX = (S - photoW) / 2 + 20, photoY = 50;
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(photoW, photoH, { fit: "cover" }).png().toBuffer();
  const tornY = photoY + photoH - 100;
  const titleLines = wrapLines(title, 20);
  const bodyLines = wrapLines(body, 30);
  let tY = tornY + 110;
  let titleSvg = "";
  const titleFs = title.length > 22 ? 60 : 72;
  for (const l of titleLines) {
    titleSvg += `<text x="${S / 2}" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" text-anchor="middle" fill="#2A1F10">${escXml(l)}</text>`;
    tY += titleFs * 1.15;
  }
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="${S / 2}" y="${tY}" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#5A4A35">${escXml(l)}</text>`;
    tY += 50;
  }
  const subSvg = sub ? `<text x="${S / 2}" y="${S - 68}" font-family="Georgia, serif" font-size="38" font-style="italic" text-anchor="middle" fill="#8A6A45">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="sh"><feDropShadow dx="4" dy="10" stdDeviation="18" flood-color="#000" flood-opacity="0.3"/></filter></defs>
    <ellipse cx="88" cy="88" rx="48" ry="22" fill="#8BA888" opacity="0.45" transform="rotate(-35 88 88)"/>
    <ellipse cx="72" cy="112" rx="40" ry="18" fill="#6A8A68" opacity="0.35" transform="rotate(-50 72 112)"/>
    <ellipse cx="${S - 85}" cy="${S - 90}" rx="44" ry="20" fill="#C8A97E" opacity="0.4" transform="rotate(25 ${S - 85} ${S - 90})"/>
    <g transform="rotate(-3 ${S / 2} ${photoY + photoH / 2})">
      <rect x="${photoX - 14}" y="${photoY - 14}" width="${photoW + 28}" height="${photoH + 28}" fill="white" filter="url(#sh)"/>
      <image href="data:image/png;base64,${photoResized.toString("base64")}" x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}"/>
    </g>
    <path d="M 0 ${tornY} L 42 ${tornY - 36} L 95 ${tornY + 18} L 148 ${tornY - 28} L 205 ${tornY + 16} L 265 ${tornY - 32} L 328 ${tornY + 18} L 388 ${tornY - 26} L 450 ${tornY + 22} L 514 ${tornY - 30} L 575 ${tornY + 16} L 636 ${tornY - 28} L 696 ${tornY + 20} L 756 ${tornY - 24} L 818 ${tornY + 18} L 878 ${tornY - 30} L 938 ${tornY + 14} L 1000 ${tornY - 22} L ${S} ${tornY + 12} L ${S} ${S} L 0 ${S} Z" fill="white" opacity="0.96"/>
    ${titleSvg}${bodySvg}${subSvg}
  </svg>`;
  return sharp(bgBuf).composite([{ input: Buffer.from(svg), blend: "over" }]).png().toBuffer();
}

// ── Bold Editorial ────────────────────────────────────────────────────────────
async function renderBoldEditorial(slide: SeamlessSlide): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const titleLines = wrapLines(title, 14);
  const bodyLines = wrapLines(body, 28);
  const titleFs = 118;
  let tY = 260;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="80" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" fill="#1A1A1A" letter-spacing="-2">${escXml(l)}</text>`;
    tY += titleFs * 1.05;
  }
  let bY = tY + 40;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="80" y="${bY}" font-family="Arial, sans-serif" font-size="40" fill="#1A1A1A" opacity="0.65">${escXml(l)}</text>`;
    bY += 56;
  }
  const subSvg = sub ? `<text x="80" y="${S - 80}" font-family="Arial, sans-serif" font-size="30" fill="#1A1A1A" opacity="0.45">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="#F5F0E8"/>
    <text x="80" y="72" font-family="Arial, sans-serif" font-size="24" fill="#1A1A1A" opacity="0.35" letter-spacing="5">STUDIO</text>
    <line x1="80" y1="90" x2="${S - 80}" y2="90" stroke="#1A1A1A" stroke-width="1" opacity="0.12"/>
    <rect x="80" y="155" width="85" height="8" fill="#2563EB" rx="2"/>
    ${titleSvg}${bodySvg}${subSvg}
    <text x="${S - 80}" y="${S - 58}" font-family="Arial, sans-serif" font-size="28" fill="#1A1A1A" opacity="0.28" text-anchor="end">&#8594;</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Dark Doodle ───────────────────────────────────────────────────────────────
async function renderDarkDoodle(buf: Buffer, el: CollageElement, slide: SeamlessSlide, font: string, textColor: string): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const photoSize = 700;
  const photoX = (S - photoSize) / 2, photoY = (S - photoSize) / 2 + 30;
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(photoSize, photoSize, { fit: "cover" }).png().toBuffer();
  const titleLines = wrapLines(title, 24);
  const bodyLines = wrapLines(body, 34);
  const titleFs = title.length > 20 ? 56 : 68;
  let tY = 105;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="${S / 2}" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" fill="${escXml(textColor)}" text-anchor="middle" filter="url(#ts)">${escXml(l)}</text>`;
    tY += titleFs * 1.1;
  }
  const bodyRev = [...bodyLines].reverse();
  let bY = S - 185;
  let bodySvg = "";
  for (const l of bodyRev) {
    bodySvg = `<text x="${S / 2}" y="${bY}" font-family="Arial, sans-serif" font-size="34" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escXml(l)}</text>` + bodySvg;
    bY -= 48;
  }
  const subSvg = sub ? `<text x="${S / 2}" y="${S - 68}" font-family="Georgia, serif" font-size="30" fill="rgba(255,255,255,0.5)" text-anchor="middle" font-style="italic">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs>
      <filter id="sh"><feDropShadow dx="0" dy="10" stdDeviation="22" flood-color="#000" flood-opacity="0.5"/></filter>
      <filter id="ts"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter>
    </defs>
    <rect width="${S}" height="${S}" fill="#17120A"/>
    <rect x="${photoX - 14}" y="${photoY - 14}" width="${photoSize + 28}" height="${photoSize + 28}" fill="white" filter="url(#sh)"/>
    <image href="data:image/png;base64,${photoResized.toString("base64")}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}"/>
    <text x="92" y="192" font-family="Arial, sans-serif" font-size="52" fill="rgba(255,255,255,0.22)" transform="rotate(-15 92 192)">&#9733;</text>
    <text x="${S - 98}" y="208" font-family="Arial, sans-serif" font-size="44" fill="rgba(255,255,255,0.18)" transform="rotate(10 ${S - 98} 208)">&#9825;</text>
    <text x="88" y="${S - 138}" font-family="Arial, sans-serif" font-size="46" fill="rgba(255,255,255,0.16)" transform="rotate(5 88 ${S - 138})">&#10022;</text>
    <text x="${S - 102}" y="${S - 115}" font-family="Arial, sans-serif" font-size="42" fill="rgba(255,255,255,0.18)" transform="rotate(-8 ${S - 102} ${S - 115})">&#10053;</text>
    ${titleSvg}${bodySvg}${subSvg}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Numbered Steps ────────────────────────────────────────────────────────────
async function renderNumberedSteps(buf: Buffer, el: CollageElement, slide: SeamlessSlide, stepNum: number): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const photoW = 350, photoH = 330, photoX = S - photoW - 58, photoY = S - photoH - 60;
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(photoW, photoH, { fit: "cover" }).png().toBuffer();
  const titleLines = wrapLines(title, 18);
  const bodyLines = wrapLines(body, 28);
  const titleFs = title.length > 20 ? 72 : 86;
  let tY = 330;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="72" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" fill="#1A1A1A">${escXml(l)}</text>`;
    tY += titleFs * 1.1;
  }
  let bY = tY + 32;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="72" y="${bY}" font-family="Arial, sans-serif" font-size="36" fill="#1A1A1A" opacity="0.62">${escXml(l)}</text>`;
    bY += 52;
  }
  const subSvg = sub ? `<text x="72" y="${S - 75}" font-family="Arial, sans-serif" font-size="28" fill="#1A1A1A" opacity="0.42">${escXml(sub)}</text>` : "";
  const numStr = String(stepNum).padStart(2, "0");
  const circR = 90, circX = S - circR - 58, circY = circR + 52;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="sh"><feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.16"/></filter></defs>
    <rect width="${S}" height="${S}" fill="#F8F5F0"/>
    <line x1="72" y1="80" x2="${S - 72}" y2="80" stroke="#1A1A1A" stroke-width="1" opacity="0.12"/>
    <text x="72" y="64" font-family="Arial, sans-serif" font-size="22" fill="#1A1A1A" opacity="0.32" letter-spacing="4">YOUR BRAND</text>
    <circle cx="${circX}" cy="${circY}" r="${circR}" fill="#1C1C1C" opacity="0.07"/>
    <circle cx="${circX}" cy="${circY}" r="${circR - 10}" fill="#1C1C1C" opacity="0.1"/>
    <text x="${circX}" y="${circY + 38}" font-family="Georgia, serif" font-size="100" font-weight="bold" text-anchor="middle" fill="#1C1C1C">${escXml(numStr)}</text>
    <rect x="72" y="178" width="65" height="6" fill="#1C1C1C" rx="3" opacity="0.7"/>
    ${titleSvg}${bodySvg}${subSvg}
    <rect x="${photoX - 10}" y="${photoY - 10}" width="${photoW + 20}" height="${photoH + 20}" fill="white" filter="url(#sh)"/>
    <image href="data:image/png;base64,${photoResized.toString("base64")}" x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}"/>
    <text x="${S - 72}" y="${S - 60}" font-family="Arial, sans-serif" font-size="34" fill="#1A1A1A" opacity="0.28" text-anchor="end">&#8594;</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Split Panel ───────────────────────────────────────────────────────────────
async function renderSplitPanel(buf: Buffer, el: CollageElement, slide: SeamlessSlide): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const photoW = 510;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(photoW, S, { fit: "cover" }).png().toBuffer();
  const panelX = photoW;
  const titleLines = wrapLines(title, 16);
  const bodyLines = wrapLines(body, 22);
  const titleFs = title.length > 18 ? 62 : 72;
  let tY = 235;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="${panelX + 58}" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" fill="white" letter-spacing="-1">${escXml(l)}</text>`;
    tY += titleFs * 1.15;
  }
  let bY = tY + 28;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="${panelX + 58}" y="${bY}" font-family="Arial, sans-serif" font-size="33" fill="rgba(255,255,255,0.72)">${escXml(l)}</text>`;
    bY += 46;
  }
  const subSvg = sub ? `<text x="${panelX + 58}" y="${S - 80}" font-family="Georgia, serif" font-size="36" fill="rgba(255,255,255,0.55)" font-style="italic">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <image href="data:image/png;base64,${photoResized.toString("base64")}" x="0" y="0" width="${photoW}" height="${S}"/>
    <rect x="${panelX}" y="0" width="${S - panelX}" height="${S}" fill="#1E1414"/>
    <line x1="${panelX + 58}" y1="152" x2="${S - 58}" y2="152" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
    <text x="${panelX + 58}" y="68" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.42)" letter-spacing="3">YOUR BRAND</text>
    ${titleSvg}${bodySvg}${subSvg}
    <text x="${S - 58}" y="${S - 58}" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.3)" text-anchor="end">&#8594;</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Polaroid Scrapbook ────────────────────────────────────────────────────────
async function renderPolaroidScrapbook(buf: Buffer, el: CollageElement, slide: SeamlessSlide, font: string): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const polW = 600, polH = 640;
  const polX = (S - polW) / 2 - 55, polY = (S - polH) / 2 - 95;
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(polW - 28, polH - 88, { fit: "cover" }).png().toBuffer();
  const titleLines = wrapLines(title, 22);
  const bodyLines = wrapLines(body, 30);
  let tY = polY + polH + 58;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="${S / 2 + 38}" y="${tY}" font-family="Georgia, serif" font-size="66" fill="white" text-anchor="middle" filter="url(#ts)">${escXml(l)}</text>`;
    tY += 80;
  }
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="${S / 2 + 38}" y="${tY}" font-family="Arial, sans-serif" font-size="34" fill="rgba(255,255,255,0.72)" text-anchor="middle">${escXml(l)}</text>`;
    tY += 50;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs>
      <filter id="sh"><feDropShadow dx="2" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.45"/></filter>
      <filter id="ts"><feDropShadow dx="1" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.5"/></filter>
    </defs>
    <rect width="${S}" height="${S}" fill="#2D5A1B"/>
    <circle cx="90" cy="120" r="55" fill="rgba(255,255,255,0.08)"/>
    <circle cx="${S - 95}" cy="${S - 110}" r="45" fill="rgba(255,255,255,0.06)"/>
    <g transform="rotate(-5 ${polX + polW / 2} ${polY + polH / 2})">
      <rect x="${polX}" y="${polY}" width="${polW}" height="${polH}" fill="white" filter="url(#sh)"/>
      <image href="data:image/png;base64,${photoResized.toString("base64")}" x="${polX + 14}" y="${polY + 14}" width="${polW - 28}" height="${polH - 88}"/>
    </g>
    ${titleSvg}${bodySvg}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Editorial Minimal ─────────────────────────────────────────────────────────
async function renderEditorialMinimal(buf: Buffer, el: CollageElement, slide: SeamlessSlide, stepNum: number): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  let bg = await resizeWithPlacement(buf, el);
  bg = await sharp(bg).greyscale().png().toBuffer();
  const panelW = 475;
  const titleLines = wrapLines(title, 16);
  const bodyLines = wrapLines(body, 22);
  const titleFs = title.length > 18 ? 60 : 72;
  let tY = 248;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="56" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" fill="#1A1A1A">${escXml(l)}</text>`;
    tY += titleFs * 1.1;
  }
  let bY = tY + 28;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="56" y="${bY}" font-family="Arial, sans-serif" font-size="32" fill="#333">${escXml(l)}</text>`;
    bY += 46;
  }
  const subSvg = sub ? `<text x="56" y="${S - 75}" font-family="Arial, sans-serif" font-size="26" fill="#555" font-style="italic">${escXml(sub)}</text>` : "";
  const numStr = String(stepNum).padStart(2, "0");
  const panel = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect x="0" y="0" width="${panelW}" height="${S}" fill="white" opacity="0.93"/>
    <text x="${panelW + 22}" y="195" font-family="Georgia, serif" font-size="155" font-weight="bold" fill="white" opacity="0.14">${escXml(numStr)}</text>
    <text x="56" y="72" font-family="Arial, sans-serif" font-size="22" fill="#1A1A1A" opacity="0.38" letter-spacing="4">YOUR BRAND</text>
    <line x1="56" y1="90" x2="${panelW - 56}" y2="90" stroke="#1A1A1A" stroke-width="1" opacity="0.14"/>
    ${titleSvg}${bodySvg}${subSvg}
    <text x="${panelW - 56}" y="${S - 58}" font-family="Arial, sans-serif" font-size="28" fill="#1A1A1A" opacity="0.32" text-anchor="end">&#8594;</text>
  </svg>`;
  return sharp(bg).composite([{ input: Buffer.from(panel), blend: "over" }]).png().toBuffer();
}

// ── Paper Cutout ──────────────────────────────────────────────────────────────
async function renderPaperCutout(buf: Buffer, el: CollageElement, slide: SeamlessSlide): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const photoW = 680, photoH = 660;
  const photoX = (S - photoW) / 2 + 28, photoY = (S - photoH) / 2 - 55;
  const photoCrop = await resizeWithPlacement(buf, el);
  const photoResized = await sharp(photoCrop).resize(photoW, photoH, { fit: "cover" }).png().toBuffer();
  const bgBuf = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 244, g: 239, b: 230, alpha: 1 } } }).png().toBuffer();
  const titleLines = wrapLines(title, 24);
  const bodyLines = wrapLines(body, 34);
  let tY = photoY + photoH + 55;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="${S / 2}" y="${tY}" font-family="Georgia, serif" font-size="64" font-weight="bold" text-anchor="middle" fill="#1A1A1A">${escXml(l)}</text>`;
    tY += 76;
  }
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="${S / 2}" y="${tY}" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#555">${escXml(l)}</text>`;
    tY += 50;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="sh"><feDropShadow dx="3" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.26"/></filter></defs>
    <text x="72" y="132" font-family="Arial, sans-serif" font-size="64" fill="rgba(26,26,26,0.11)" transform="rotate(-15 72 132)">&#10051;</text>
    <text x="${S - 92}" y="162" font-family="Arial, sans-serif" font-size="56" fill="rgba(26,26,26,0.09)" transform="rotate(10 ${S - 92} 162)">&#10044;</text>
    <text x="98" y="${S - 122}" font-family="Arial, sans-serif" font-size="50" fill="rgba(26,26,26,0.08)" transform="rotate(5 98 ${S - 122})">&#10052;</text>
    <text x="${S - 88}" y="${S - 97}" font-family="Arial, sans-serif" font-size="58" fill="rgba(26,26,26,0.1)" transform="rotate(-8 ${S - 88} ${S - 97})">&#10056;</text>
    <g transform="rotate(-2 ${S / 2} ${S / 2})">
      <rect x="${photoX - 13}" y="${photoY - 13}" width="${photoW + 26}" height="${photoH + 26}" fill="white" filter="url(#sh)"/>
      <image href="data:image/png;base64,${photoResized.toString("base64")}" x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}"/>
    </g>
    ${titleSvg}${bodySvg}
  </svg>`;
  return sharp(bgBuf).composite([{ input: Buffer.from(svg), blend: "over" }]).png().toBuffer();
}

// ── Textured Graphic ──────────────────────────────────────────────────────────
async function renderTexturedGraphic(slide: SeamlessSlide): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  const titleLines = wrapLines(title, 12);
  const bodyLines = wrapLines(body, 28);
  const titleFs = 122;
  let tY = 168;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="72" y="${tY}" font-family="Impact, Arial, sans-serif" font-size="${titleFs}" font-weight="900" fill="#1A1A1A" letter-spacing="-2">${escXml(l)}</text>`;
    tY += titleFs * 0.94;
  }
  const boxPad = 22, boxH = bodyLines.length * 54 + boxPad * 2;
  const boxSvg = bodyLines.length ? `<rect x="72" y="${tY + 32}" width="720" height="${boxH}" fill="#EA580C" rx="4"/>` : "";
  let bY = tY + 32 + boxPad + 40;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="${72 + boxPad}" y="${bY}" font-family="Arial, sans-serif" font-size="38" fill="white" font-weight="bold">${escXml(l)}</text>`;
    bY += 54;
  }
  const subSvg = sub ? `<text x="72" y="${S - 75}" font-family="Arial, sans-serif" font-size="28" fill="#1A1A1A" opacity="0.48">${escXml(sub)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#EA580C"/></marker></defs>
    <rect width="${S}" height="${S}" fill="#E8DDD0"/>
    <text x="72" y="66" font-family="Arial, sans-serif" font-size="24" fill="#1A1A1A" opacity="0.38" letter-spacing="4">HARPER RUSSO</text>
    <text x="${S - 72}" y="66" font-family="Arial, sans-serif" font-size="24" fill="#1A1A1A" opacity="0.38" text-anchor="end">#content</text>
    <line x1="72" y1="82" x2="${S - 72}" y2="82" stroke="#1A1A1A" stroke-width="1" opacity="0.1"/>
    ${titleSvg}${boxSvg}${bodySvg}${subSvg}
    <path d="M 680 ${tY - 28} Q 820 ${tY - 98} 890 ${tY + 38}" fill="none" stroke="#EA580C" stroke-width="4.5" stroke-dasharray="13,8" marker-end="url(#arr)"/>
    <text x="${S - 72}" y="${S - 55}" font-family="Arial, sans-serif" font-size="26" fill="#1A1A1A" opacity="0.32" text-anchor="end">2025</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Dark Photo Steps ──────────────────────────────────────────────────────────
async function renderDarkPhotoSteps(buf: Buffer, el: CollageElement, slide: SeamlessSlide, stepNum: number): Promise<Buffer> {
  const S = SLIDE_SIZE;
  const title = slide.title || "";
  const body = slide.tagLine || "";
  const sub = slide.leadIn || "";
  let bg = await resizeWithPlacement(buf, el);
  bg = await sharp(bg).modulate({ brightness: 0.44, saturation: 0.72 }).png().toBuffer();
  const grad = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0.18"/>
      <stop offset="45%" stop-color="black" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.82"/>
    </linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
  </svg>`;
  bg = await sharp(bg).composite([{ input: Buffer.from(grad), blend: "over" }]).png().toBuffer();
  const numStr = String(stepNum).padStart(2, "0");
  const titleLines = wrapLines(title, 20);
  const bodyLines = wrapLines(body, 30);
  const titleFs = title.length > 22 ? 66 : 80;
  let tY = S - 490;
  let titleSvg = "";
  for (const l of titleLines) {
    titleSvg += `<text x="72" y="${tY}" font-family="Georgia, serif" font-size="${titleFs}" font-weight="bold" fill="white" filter="url(#ts)">${escXml(l)}</text>`;
    tY += titleFs * 1.1;
  }
  let bY = tY + 18;
  let bodySvg = "";
  for (const l of bodyLines) {
    bodySvg += `<text x="72" y="${bY}" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.72)">${escXml(l)}</text>`;
    bY += 50;
  }
  const subSvg = sub ? `<text x="72" y="${S - 75}" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.48)">${escXml(sub)}</text>` : "";
  const dots = Array.from({ length: 5 }, (_, i) => `<circle cx="${72 + i * 30}" cy="${S - 60}" r="${i === (stepNum - 1) % 5 ? 8 : 4.5}" fill="${i === (stepNum - 1) % 5 ? "white" : "rgba(255,255,255,0.3)"}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="ts"><feDropShadow dx="1" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/></filter></defs>
    <text x="72" y="70" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.48)" letter-spacing="3">YOUR BRAND</text>
    <rect x="${S - 152}" y="33" width="112" height="56" rx="28" fill="rgba(255,255,255,0.14)"/>
    <text x="${S - 96}" y="74" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${escXml(numStr)}</text>
    <text x="72" y="${tY - titleFs * titleLines.length - 28}" font-family="Arial, sans-serif" font-size="25" fill="rgba(255,255,255,0.52)" letter-spacing="4">STEP ${stepNum}</text>
    ${titleSvg}${bodySvg}${subSvg}${dots}
    <text x="${S - 72}" y="${S - 58}" font-family="Arial, sans-serif" font-size="38" fill="rgba(255,255,255,0.42)" text-anchor="end">&#8594;</text>
  </svg>`;
  return sharp(bg).composite([{ input: Buffer.from(svg), blend: "over" }]).png().toBuffer();
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function dispatchTemplateRender(
  buf: Buffer, el: CollageElement, slide: SeamlessSlide,
  slideIdx: number, layout: string, font: string, textColor: string, watermark: string,
): Promise<Buffer> {
  const step = slideIdx + 1;
  switch (layout) {
    case "full_fade":          return renderFullFade(buf, el, slide, font, textColor, watermark);
    case "notecard":           return renderNotecard(buf, el, slide, font);
    case "torn_scrapbook":     return renderTornScrapbook(buf, el, slide, font);
    case "bold_editorial":     return renderBoldEditorial(slide);
    case "dark_doodle":        return renderDarkDoodle(buf, el, slide, font, textColor);
    case "numbered_steps":     return renderNumberedSteps(buf, el, slide, step);
    case "split_panel":        return renderSplitPanel(buf, el, slide);
    case "polaroid_scrapbook": return renderPolaroidScrapbook(buf, el, slide, font);
    case "editorial_minimal":  return renderEditorialMinimal(buf, el, slide, step);
    case "paper_cutout":       return renderPaperCutout(buf, el, slide);
    case "textured_graphic":   return renderTexturedGraphic(slide);
    case "dark_photo_steps":   return renderDarkPhotoSteps(buf, el, slide, step);
    default:                   return renderFullFade(buf, el, slide, font, textColor, watermark);
  }
}

function autoArrangeTemplate(imageUrls: string[], slideCount: number): CollageElement[] {
  return Array.from({ length: slideCount }, (_, i) => ({
    imageUrl: imageUrls[i % Math.max(imageUrls.length, 1)] ?? "",
    x: 0, y: 0, width: SLIDE_SIZE, height: SLIDE_SIZE,
    rotation: 0, zIndex: 0, hasBorder: false, isBackground: true,
  }));
}

function buildAutoArrange(layout: string, imageUrls: string[], slideCount: number): CollageElement[] {
  if (TEMPLATE_STYLES.has(layout)) return autoArrangeTemplate(imageUrls, slideCount);
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

    if (!TEMPLATE_STYLES.has(carousel.layoutStyle) && !elements.length) {
      res.status(400).json({ error: "No collage elements — run auto-arrange first" }); return;
    }

    // Fetch logo buffer once if needed
    let logoBuf: Buffer | null = null;
    if (logoConfig?.logoUrl) {
      try {
        logoBuf = await fetchBuf(logoConfig.logoUrl);
      } catch {
        req.log.warn("Failed to fetch seamless logo, skipping");
      }
    }

    // Template-based per-slide rendering
    if (TEMPLATE_STYLES.has(carousel.layoutStyle)) {
      const uploadedUrls = (carousel.uploadedImageUrls ?? []) as string[];
      const slideUrls: string[] = [];
      for (let i = 0; i < n; i++) {
        const slide = slides[i] ?? { hasText: false, title: "", leadIn: "", tagLine: "", doodle: "none", position: "bottom-left" };
        const fallbackUrl = uploadedUrls[i % Math.max(uploadedUrls.length, 1)] ?? "";
        const el = (elements[i] ?? {
          imageUrl: fallbackUrl,
          x: 0, y: 0, width: SLIDE_SIZE, height: SLIDE_SIZE,
          rotation: 0, zIndex: 0, hasBorder: false, isBackground: true,
        }) as CollageElement;
        const photoUrl = el.imageUrl || fallbackUrl;
        let photoBuf: Buffer;
        try {
          photoBuf = photoUrl
            ? await fetchBuf(photoUrl)
            : await sharp({ create: { width: SLIDE_SIZE, height: SLIDE_SIZE, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
        } catch {
          photoBuf = await sharp({ create: { width: SLIDE_SIZE, height: SLIDE_SIZE, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
        }
        let slideBuf = await dispatchTemplateRender(photoBuf, el, slide, i, carousel.layoutStyle, scriptFont, textColor, watermark);
        if (logoBuf && logoConfig) {
          try { slideBuf = await compositeLogoOnSlide(slideBuf, logoBuf, logoConfig); } catch { req.log.warn(`Logo composite failed for slide ${i + 1}, skipping`); }
        }
        const url = await uploadBuf(slideBuf, `seamless-slide-${i + 1}-${Date.now()}.png`, "seamless/rendered");
        slideUrls.push(url);
      }
      await db.update(seamlessCarouselsTable).set({ renderedSlideUrls: slideUrls, updatedAt: new Date() }).where(eq(seamlessCarouselsTable.id, id));
      res.json({ slideUrls });
      return;
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
