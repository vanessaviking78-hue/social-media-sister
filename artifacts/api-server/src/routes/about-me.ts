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

function darkenHex(hex: string, amount = 0.22): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function starPath5(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI / 5) - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

function topperRainbowSvg(cx: number, ty: number, size: number): string {
  const r1 = size * 0.5, r2 = size * 0.33, r3 = size * 0.18, sw = size * 0.15;
  return [
    `<path d="M ${(cx - r1).toFixed(1)},${ty.toFixed(1)} A ${r1.toFixed(1)},${r1.toFixed(1)} 0 0 1 ${(cx + r1).toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="#E91976" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`,
    `<path d="M ${(cx - r2).toFixed(1)},${ty.toFixed(1)} A ${r2.toFixed(1)},${r2.toFixed(1)} 0 0 1 ${(cx + r2).toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="#7BA7C7" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`,
    `<path d="M ${(cx - r3).toFixed(1)},${ty.toFixed(1)} A ${r3.toFixed(1)},${r3.toFixed(1)} 0 0 1 ${(cx + r3).toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="#f8d97a" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`,
  ].join("");
}

function topperHeartSvg(cx: number, ty: number, size: number): string {
  return `<path d="${heartPath(cx, ty + size * 0.1, size * 0.55)}" fill="#E91976" opacity="0.95"/>`;
}

function topperStarSvg(cx: number, ty: number, size: number, accentColor: string): string {
  return `<path d="${starPath5(cx, ty, size * 0.52, size * 0.22)}" fill="white" stroke="${accentColor}" stroke-width="${(size * 0.12).toFixed(1)}"/>`;
}

function topperMirrorSvg(cx: number, ty: number, size: number): string {
  const r = size * 0.42;
  const cy_ = ty - r * 0.05;
  const handleW = r * 0.2, handleH = r * 0.55;
  const baseW = r * 0.7, baseH = r * 0.14;
  return [
    `<rect x="${(cx - handleW / 2).toFixed(1)}" y="${(cy_ + r * 0.85).toFixed(1)}" width="${handleW.toFixed(1)}" height="${handleH.toFixed(1)}" rx="${(handleW * 0.3).toFixed(1)}" fill="#b8860b"/>`,
    `<rect x="${(cx - baseW / 2).toFixed(1)}" y="${(cy_ + r * 0.85 + handleH).toFixed(1)}" width="${baseW.toFixed(1)}" height="${baseH.toFixed(1)}" rx="${(baseH * 0.3).toFixed(1)}" fill="#b8860b"/>`,
    `<circle cx="${cx.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${r.toFixed(1)}" fill="#f5c842" stroke="#b8860b" stroke-width="${(r * 0.1).toFixed(1)}"/>`,
    `<circle cx="${cx.toFixed(1)}" cy="${cy_.toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="#ddf0fa" opacity="0.7"/>`,
    `<ellipse cx="${(cx - r * 0.22).toFixed(1)}" cy="${(cy_ - r * 0.28).toFixed(1)}" rx="${(r * 0.12).toFixed(1)}" ry="${(r * 0.18).toFixed(1)}" fill="white" opacity="0.65" transform="rotate(-25 ${(cx - r * 0.22).toFixed(1)} ${(cy_ - r * 0.28).toFixed(1)})"/>`,
  ].join("");
}

function topperWineGlassSvg(cx: number, ty: number, size: number): string {
  const bW = size * 0.46, bBW = size * 0.16, bH = size * 0.48;
  const stemW = size * 0.05, stemH = size * 0.22;
  const baseW = size * 0.36, baseH = size * 0.09;
  const bowlTop = ty - size * 0.35;
  const bowlBot = bowlTop + bH;
  const stemBot = bowlBot + stemH;
  const wineTop = bowlTop + bH * 0.22;
  const wineTopW = bW - (bW - bBW) * 0.22;
  const bowl = `M ${(cx - bW).toFixed(1)},${bowlTop.toFixed(1)} L ${(cx + bW).toFixed(1)},${bowlTop.toFixed(1)} L ${(cx + bBW).toFixed(1)},${bowlBot.toFixed(1)} L ${(cx - bBW).toFixed(1)},${bowlBot.toFixed(1)} Z`;
  const wine = `M ${(cx - wineTopW).toFixed(1)},${wineTop.toFixed(1)} L ${(cx + wineTopW).toFixed(1)},${wineTop.toFixed(1)} L ${(cx + bBW).toFixed(1)},${bowlBot.toFixed(1)} L ${(cx - bBW).toFixed(1)},${bowlBot.toFixed(1)} Z`;
  return [
    `<path d="${wine}" fill="#7B1C42" opacity="0.9"/>`,
    `<path d="${bowl}" fill="none" stroke="#aaa" stroke-width="${(size * 0.05).toFixed(1)}"/>`,
    `<rect x="${(cx - stemW).toFixed(1)}" y="${bowlBot.toFixed(1)}" width="${(stemW * 2).toFixed(1)}" height="${stemH.toFixed(1)}" fill="#aaa"/>`,
    `<rect x="${(cx - baseW).toFixed(1)}" y="${stemBot.toFixed(1)}" width="${(baseW * 2).toFixed(1)}" height="${baseH.toFixed(1)}" rx="${(baseH * 0.3).toFixed(1)}" fill="#aaa"/>`,
  ].join("");
}

function topperLipstickSvg(cx: number, ty: number, size: number): string {
  const tw = size * 0.26, tubeH = size * 0.46, tipH = size * 0.3, caseH = size * 0.2;
  const baseY = ty + size * 0.22;
  const caseTop = baseY - caseH;
  const tubeTop = caseTop - tubeH;
  const tip = `M ${(cx - tw / 2).toFixed(1)},${tubeTop.toFixed(1)} L ${(cx - tw / 2).toFixed(1)},${(tubeTop - tipH * 0.65).toFixed(1)} L ${(cx + tw / 2).toFixed(1)},${(tubeTop - tipH).toFixed(1)} L ${(cx + tw / 2).toFixed(1)},${tubeTop.toFixed(1)} Z`;
  return [
    `<rect x="${(cx - tw / 2).toFixed(1)}" y="${caseTop.toFixed(1)}" width="${tw.toFixed(1)}" height="${caseH.toFixed(1)}" rx="${(tw * 0.15).toFixed(1)}" fill="#888"/>`,
    `<rect x="${(cx - tw / 2).toFixed(1)}" y="${(caseTop - tubeH * 0.07).toFixed(1)}" width="${tw.toFixed(1)}" height="${(tubeH * 0.07).toFixed(1)}" fill="#c0c0c0"/>`,
    `<rect x="${(cx - tw / 2).toFixed(1)}" y="${tubeTop.toFixed(1)}" width="${tw.toFixed(1)}" height="${tubeH.toFixed(1)}" fill="#CC1155"/>`,
    `<path d="${tip}" fill="#E91976"/>`,
    `<line x1="${(cx - tw * 0.12).toFixed(1)}" y1="${(tubeTop - tipH * 0.8).toFixed(1)}" x2="${(cx - tw * 0.12).toFixed(1)}" y2="${tubeTop.toFixed(1)}" stroke="white" stroke-width="${(size * 0.03).toFixed(1)}" opacity="0.55" stroke-linecap="round"/>`,
  ].join("");
}

function wrapSvgTextBE(text: string, maxW: number, fs: number, ls = 0): string[] {
  if (!text) return [];
  const cw = Math.max(1, fs * 0.58 + ls * 0.4);
  const maxChars = Math.max(1, Math.floor(maxW / cw));
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (test.length <= maxChars || !cur) { cur = test; }
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function stickerSvg(
  w: { text: string; x: number; y: number; topper?: string },
  idx: number,
  canvasW: number,
  canvasH: number,
  accentColor: string,
  topperDefault: string,
  baseFontSize = 36,
): string {
  const cx = w.x * canvasW;
  const cy = w.y * canvasH;
  const text = w.text.toUpperCase();
  const fontSize = baseFontSize;
  const sizeRatio = baseFontSize / 36;
  const charW = Math.round(23 * sizeRatio);
  const padH = Math.round(28 * sizeRatio);
  const padV = Math.round(18 * sizeRatio);
  const bR = Math.round(22 * sizeRatio);
  const sW = Math.max(Math.round(170 * sizeRatio), text.length * charW + padH * 2);
  const sH = fontSize + padV * 2;
  const sLeft = cx - sW / 2;
  const sTop = cy - sH / 2;
  const outerPad = 5;

  const ROTS = [-7, 5, -3, 8, -6, 4, -8, 6, -2, 7];
  const rot = ROTS[idx % ROTS.length];

  const effective = (w.topper as string | undefined) || (topperDefault === "mixed" ? ["rainbow", "heart", "star"][idx % 3] : topperDefault);
  const topperSize = sH * 0.7;
  const topperY = sTop - topperSize * 0.15;

  const outerColor = darkenHex(accentColor, 0.22);
  const rotAttr = rot !== 0 ? ` transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"` : "";

  if (effective === "box-solid" || effective === "circle-solid" || effective === "heart-solid") {
    let shape = "";
    if (effective === "box-solid") {
      shape =
        `<rect x="${(sLeft - outerPad).toFixed(1)}" y="${(sTop - outerPad).toFixed(1)}" width="${(sW + outerPad * 2).toFixed(1)}" height="${(sH + outerPad * 2).toFixed(1)}" rx="${bR + 2}" ry="${bR + 2}" fill="${outerColor}"/>` +
        `<rect x="${sLeft.toFixed(1)}" y="${sTop.toFixed(1)}" width="${sW.toFixed(1)}" height="${sH.toFixed(1)}" rx="${bR}" ry="${bR}" fill="${accentColor}"/>`;
    } else if (effective === "circle-solid") {
      shape = `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(sW / 2 + outerPad).toFixed(1)}" ry="${(sH / 2 + outerPad).toFixed(1)}" fill="${accentColor}"/>`;
    } else if (effective === "heart-solid") {
      const hs = sW + outerPad * 2;
      shape = `<path d="${heartPath(cx, cy + hs * 0.135, hs)}" fill="${accentColor}"/>`;
    }
    return `<g${rotAttr} filter="url(#stickshadow)">` +
      shape +
      `<text x="${cx.toFixed(1)}" y="${(cy + fontSize * 0.36).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="white" text-anchor="middle" letter-spacing="1" stroke="rgba(0,0,0,0.22)" stroke-width="1.5" paint-order="stroke">${escXml(text)}</text>` +
      `</g>`;
  }

  let topper = "";
  if (effective === "rainbow") topper = topperRainbowSvg(cx, topperY, topperSize);
  else if (effective === "heart") topper = topperHeartSvg(cx, topperY, topperSize);
  else if (effective === "star") topper = topperStarSvg(cx, topperY, topperSize, accentColor);
  else if (effective === "mirror") topper = topperMirrorSvg(cx, topperY, topperSize);
  else if (effective === "wine") topper = topperWineGlassSvg(cx, topperY, topperSize);
  else if (effective === "lipstick") topper = topperLipstickSvg(cx, topperY, topperSize);

  return `<g${rotAttr} filter="url(#stickshadow)">` +
    `<rect x="${(sLeft - outerPad).toFixed(1)}" y="${(sTop - outerPad).toFixed(1)}" width="${(sW + outerPad * 2).toFixed(1)}" height="${(sH + outerPad * 2).toFixed(1)}" rx="${bR + 2}" ry="${bR + 2}" fill="${outerColor}"/>` +
    `<rect x="${(sLeft - 2).toFixed(1)}" y="${(sTop - 2).toFixed(1)}" width="${(sW + 4).toFixed(1)}" height="${(sH + 4).toFixed(1)}" rx="${bR}" ry="${bR}" fill="${accentColor}"/>` +
    `<rect x="${sLeft.toFixed(1)}" y="${sTop.toFixed(1)}" width="${sW.toFixed(1)}" height="${sH.toFixed(1)}" rx="${bR - 2}" ry="${bR - 2}" fill="white"/>` +
    `<text x="${cx.toFixed(1)}" y="${(cy + fontSize * 0.36).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#1a1a1a" text-anchor="middle" letter-spacing="1">${escXml(text)}</text>` +
    topper +
    `</g>`;
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
  words: AboutMeWord[],
  cfg: AboutMeCanvasConfig,
  overlayOpacity: number,
  cutoutDataUri: string,
  cutoutNaturalW: number,
  cutoutNaturalH: number,
  logoDataUri: string,
  stickerTopperDefault = "mixed",
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

  // Defs
  const defsContent: string[] = [];
  const fontParam = encodeURIComponent(titleFont.replace(/ /g, "+"));
  defsContent.push(`<style>@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@400');</style>`);
  defsContent.push(`<filter id="txtshadow"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter>`);
  defsContent.push(`<filter id="stickshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.28"/></filter>`);

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

  // Text alignment + background panel settings from canvasConfig
  const titleAlign = (cc as Record<string, unknown>).titleAlign as string ?? "center";
  const subtitleAlign = (cc as Record<string, unknown>).subtitleAlign as string ?? "center";
  const titleBgEnabled = Boolean((cc as Record<string, unknown>).titleBgEnabled);
  const titleBgColor = (cc as Record<string, unknown>).titleBgColor as string ?? "#000000";
  const titleBgOpacity = Number((cc as Record<string, unknown>).titleBgOpacity ?? 50);
  const titleBgRadius = Number((cc as Record<string, unknown>).titleBgRadius ?? 12);
  const titleBgPadding = Number((cc as Record<string, unknown>).titleBgPadding ?? 16);
  const subtitleBgEnabled = Boolean((cc as Record<string, unknown>).subtitleBgEnabled);
  const subtitleBgColor = (cc as Record<string, unknown>).subtitleBgColor as string ?? "#000000";
  const subtitleBgOpacity = Number((cc as Record<string, unknown>).subtitleBgOpacity ?? 50);
  const subtitleBgRadius = Number((cc as Record<string, unknown>).subtitleBgRadius ?? 12);
  const subtitleBgPadding = Number((cc as Record<string, unknown>).subtitleBgPadding ?? 16);

  // Title — wrapped + aligned + optional bg panel
  const maxTextW = canvasW * 0.82;
  let titleFsEff = titleFontSize;
  let titleLines = wrapSvgTextBE(title, maxTextW, titleFsEff, titleLetterSpacing);
  if (titleLines.length > 1 && titleLines.some(l => l.length * titleFsEff * 0.58 > maxTextW)) {
    titleFsEff = Math.round(titleFsEff * 0.88);
    titleLines = wrapSvgTextBE(title, maxTextW, titleFsEff, titleLetterSpacing);
  }
  const titleLineH = titleFsEff * titleLineHeight;
  const titleTopY = titleFsEff + 28;
  const titleXA = titleAlign === "left" ? canvasW * 0.09 : titleAlign === "right" ? canvasW * 0.91 : canvasW / 2;
  const titleAnchor = titleAlign === "left" ? "start" : titleAlign === "right" ? "end" : "middle";
  const lsAttr = titleLetterSpacing > 0 ? ` letter-spacing="${titleLetterSpacing}"` : "";
  if (titleBgEnabled) {
    const estimW = Math.max(...titleLines.map(l => l.length)) * titleFsEff * 0.58;
    const bgW = Math.min(canvasW - 4, estimW + titleBgPadding * 2);
    const bgH = titleLines.length * titleLineH + titleBgPadding * 2;
    const bgX = titleAlign === "center" ? canvasW / 2 - bgW / 2 : titleAlign === "left" ? titleXA - titleBgPadding : titleXA - bgW + titleBgPadding;
    const bgY = titleTopY - titleFsEff - titleBgPadding;
    layers.push(`<rect x="${bgX.toFixed(1)}" y="${bgY.toFixed(1)}" width="${bgW.toFixed(1)}" height="${bgH.toFixed(1)}" rx="${titleBgRadius}" fill="${titleBgColor}" opacity="${titleBgOpacity / 100}"/>`);
  }
  titleLines.forEach((line, li) => {
    layers.push(`<text x="${titleXA.toFixed(0)}" y="${(titleTopY + li * titleLineH).toFixed(0)}" font-family="'${titleFont}', 'Allura', cursive" font-size="${titleFsEff}" fill="${titleColor}" text-anchor="${titleAnchor}" filter="url(#txtshadow)"${lsAttr}>${escXml(line)}</text>`);
  });

  // Subtitle — wrapped + aligned + optional bg panel
  if (subtitle) {
    const titleTotalH = titleLines.length * titleLineH;
    const subFsEff = subtitleFontSize;
    const subLines = wrapSvgTextBE(subtitle.toUpperCase(), maxTextW, subFsEff, subtitleLetterSpacing);
    const subLineH = subFsEff * subtitleLineHeight;
    const subTopY = titleFsEff + 28 + titleTotalH + subFsEff + 4;
    const subXA = subtitleAlign === "left" ? canvasW * 0.09 : subtitleAlign === "right" ? canvasW * 0.91 : canvasW / 2;
    const subAnchor = subtitleAlign === "left" ? "start" : subtitleAlign === "right" ? "end" : "middle";
    if (subtitleBgEnabled) {
      const estimW = Math.max(...subLines.map(l => l.length)) * subFsEff * 0.58;
      const bgW = Math.min(canvasW - 4, estimW + subtitleBgPadding * 2);
      const bgH = subLines.length * subLineH + subtitleBgPadding * 2;
      const bgX = subtitleAlign === "center" ? canvasW / 2 - bgW / 2 : subtitleAlign === "left" ? subXA - subtitleBgPadding : subXA - bgW + subtitleBgPadding;
      const bgY = subTopY - subFsEff - subtitleBgPadding;
      layers.push(`<rect x="${bgX.toFixed(1)}" y="${bgY.toFixed(1)}" width="${bgW.toFixed(1)}" height="${bgH.toFixed(1)}" rx="${subtitleBgRadius}" fill="${subtitleBgColor}" opacity="${subtitleBgOpacity / 100}"/>`);
    }
    subLines.forEach((line, li) => {
      layers.push(`<text x="${subXA.toFixed(0)}" y="${(subTopY + li * subLineH).toFixed(0)}" font-family="Georgia, serif" font-size="${subFsEff}" fill="${subtitleColor}" text-anchor="${subAnchor}" opacity="0.85" letter-spacing="${subtitleLetterSpacing}">${escXml(line)}</text>`);
    });
  }

  // Words — puffy sticker labels
  const wordFontSize = cc.wordFontSize ?? 36;
  words.forEach((w, idx) => {
    layers.push(stickerSvg(w, idx, canvasW, canvasH, accentColor, stickerTopperDefault, wordFontSize));
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
      words,
      cc,
      (post.backgroundOverlayOpacity ?? 0) / 100,
      cutoutB64,
      cutoutNaturalW,
      cutoutNaturalH,
      logoB64,
      cc.stickerTopperDefault ?? "mixed",
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

router.post("/about-me/generate-caption", async (req, res) => {
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const { title = "", subtitle = "", words = [] } = req.body as {
      title?: string; subtitle?: string; words?: { text: string }[];
    };
    const wordList = (words as { text: string }[]).map((w) => w.text).filter(Boolean).join(", ");
    const context = [
      title && `Title: "${title}"`,
      subtitle && `Subtitle: "${subtitle}"`,
      wordList && `Words on the image: ${wordList}`,
    ].filter(Boolean).join(". ");
    const prompt = `Write a warm, personal Instagram caption for an About Me post. ${context}. Write 3 to 5 sentences that feel honest and grounded. No hashtags. No em dashes. End with a gentle question to invite comments. Max 180 words.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 280,
    });
    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ caption });
  } catch (e: unknown) {
    req.log.error(e, "generate-caption failed");
    res.status(500).json({ error: "Caption generation failed" });
  }
});

export default router;
