// Month Start: turns one newsletter issue into a five page magazine.
//
// Page 1 is the cover, page 2 the lead story, page 3 Ask the Clinician above
// Myth vs Truth, page 4 Behind the Scenes and page 5 Something for You with the
// button. Every page is a 1080 x 1440 canvas, ready to post as a carousel or to
// feed into the page turning video.
//
// Photos arrive as canvases already cropped to 1080 x 1440. Each photo can be
// zoomed and slid about inside its frame, and every frame is remembered in
// `hits` so the page can tell which photo you are dragging.

import type { NewsletterContent, NewsletterSection } from "./newsletter-pdf";

export const MS_W = 1080;
export const MS_H = 1440;

export type MonthBrand = {
  clinicName: string;
  newsletterName: string;
  monthLabel: string;
  accent: string;
  logo: HTMLImageElement | null;
  bookingUrl: string;
  address: string;
};

export type PhotoAdjust = { zoom: number; panX: number; panY: number };
export const DEFAULT_ADJUST: PhotoAdjust = { zoom: 1, panX: 0, panY: 0 };

export type PhotoHit = {
  page: number;
  slot: number;
  inv: DOMMatrix;
  w: number;
  h: number;
  x: number;
  y: number;
  slackX: number;
  slackY: number;
};

export const PHOTO_LABELS = [
  "Cover photo",
  "Lead story photo",
  "Ask the clinician portrait",
  "Behind the scenes photo",
  "Something for you photo",
];
export const PAGE_LABELS = ["Cover", "Lead story", "Ask and myth", "Behind the scenes", "Something for you"];
export const PAGE_FILES = ["cover", "lead-story", "ask-and-myth", "behind-the-scenes", "something-for-you"];

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const CREAM = "#f6f0e6";
const INK = "#1d1a1a";

let hits: PhotoHit[] = [];
let curPage = 0;
let adjusts: (PhotoAdjust | undefined)[] = [];
export function getPhotoHits(): PhotoHit[] {
  return hits;
}

// ---------- colour helpers ----------
function rgbOf(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return [183, 110, 121];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(hex: string): number {
  const ch = rgbOf(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const onColour = (hex: string) => (luminance(hex) > 0.42 ? INK : "#ffffff");

type Palette = { deep: string; hi: string; text: string; tint: string };
function palette(accent: string): Palette {
  const a = toHex(rgbOf(accent));
  const lum = luminance(a);
  return {
    deep: lum < 0.12 ? a : mix(a, "#000000", 0.62), // dark background
    hi: lum > 0.2 ? a : mix(a, "#ffffff", 0.55), // highlight on the dark background
    text: lum > 0.3 ? mix(a, "#000000", 0.45) : a, // accent text on a light page
    tint: mix(a, CREAM, 0.86), // soft wash for the light page
  };
}

// ---------- drawing helpers ----------
function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = MS_W;
  c.height = MS_H;
  return [c, c.getContext("2d")!];
}

// Draws a photo into the frame like object-fit: cover, with zoom and pan. Frames without a photo draw nothing.
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource | null,
  slot: number,
  x: number,
  y: number,
  w: number,
  h: number,
  circle = false
) {
  if (!src) return;
  const adj = adjusts[slot] ?? DEFAULT_ADJUST;
  ctx.save();
  ctx.beginPath();
  if (circle) ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  else ctx.rect(x, y, w, h);
  ctx.clip();
  const sw = (src as HTMLCanvasElement).width;
  const sh = (src as HTMLCanvasElement).height;
  const scale = Math.max(w / sw, h / sh) * Math.max(1, adj.zoom);
  const dw = sw * scale;
  const dh = sh * scale;
  const slackX = Math.max(0, dw - w);
  const slackY = Math.max(0, dh - h);
  const px = Math.max(-1, Math.min(1, adj.panX));
  const py = Math.max(-1, Math.min(1, adj.panY));
  ctx.drawImage(src, x + (w - dw) / 2 + (px * slackX) / 2, y + (h - dh) / 2 + (py * slackY) / 2, dw, dh);
  hits.push({ page: curPage, slot, inv: ctx.getTransform().inverse(), w, h, x, y, slackX, slackY });
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// One block of text that shrinks until it fits in maxLines. Returns the y just below it.
function block(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: {
    x: number;
    y: number;
    maxW: number;
    maxLines: number;
    size: number;
    minSize: number;
    family: string;
    weight?: string;
    style?: string;
    colour: string;
    lineHeight?: number;
    align?: CanvasTextAlign;
    upper?: boolean;
    tracking?: number;
  }
): number {
  const t = o.upper ? text.toUpperCase() : text;
  if (!t) return o.y;
  let size = o.size;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${o.style ?? "normal"} ${o.weight ?? "normal"} ${size}px ${o.family}`;
    (ctx as any).letterSpacing = o.tracking ? `${o.tracking}px` : "0px";
    lines = wrapLines(ctx, t, o.maxW);
    if (lines.length <= o.maxLines || size <= o.minSize) break;
    size -= 2;
  }
  const lh = size * (o.lineHeight ?? 1.16);
  ctx.fillStyle = o.colour;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  let y = o.y + size;
  for (const l of lines.slice(0, o.maxLines)) {
    ctx.fillText(l, o.x, y);
    y += lh;
  }
  (ctx as any).letterSpacing = "0px";
  return y - lh + size * 0.3;
}

// Paragraphs (split on blank lines) that shrink together until they all fit above maxY. Returns the end y.
function paragraphs(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: { x: number; y: number; maxW: number; maxY: number; size: number; minSize: number; colour: string; family?: string; lineHeight?: number }
): number {
  const paras = (text || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
  if (!paras.length) return o.y;
  const family = o.family ?? SANS;
  let size = o.size;
  let laid: string[][] = [];
  const gapOf = (s: number) => s * 0.6;
  for (;;) {
    ctx.font = `normal ${size}px ${family}`;
    laid = paras.map((p) => wrapLines(ctx, p, o.maxW));
    const lh = size * (o.lineHeight ?? 1.5);
    const total = laid.reduce((n, l) => n + l.length * lh, 0) + gapOf(size) * (laid.length - 1);
    if (o.y + total <= o.maxY || size <= o.minSize) break;
    size -= 1;
  }
  const lh = size * (o.lineHeight ?? 1.5);
  ctx.fillStyle = o.colour;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = o.y + size;
  laid.forEach((lines, i) => {
    for (const l of lines) {
      ctx.fillText(l, o.x, y);
      y += lh;
    }
    if (i < laid.length - 1) y += gapOf(size);
  });
  return y - lh + size * 0.3;
}

function kicker(ctx: CanvasRenderingContext2D, text: string, y: number, colour: string, bar: string, x = 80, align: CanvasTextAlign = "left") {
  ctx.fillStyle = bar;
  ctx.fillRect(align === "center" ? MS_W / 2 - 35 : x, y - 40, 70, 8);
  ctx.font = `700 24px ${SANS}`;
  (ctx as any).letterSpacing = "5px";
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text.toUpperCase(), align === "center" ? MS_W / 2 : x, y);
  (ctx as any).letterSpacing = "0px";
}

function footer(ctx: CanvasRenderingContext2D, brand: MonthBrand, page: number, colour: string) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.6;
  ctx.font = `600 22px ${SANS}`;
  (ctx as any).letterSpacing = "3px";
  ctx.textAlign = "left";
  ctx.fillText(brand.clinicName.toUpperCase().slice(0, 34), 80, MS_H - 56);
  ctx.textAlign = "right";
  ctx.fillText(`${brand.monthLabel.toUpperCase()}   ${page}`, MS_W - 80, MS_H - 56);
  (ctx as any).letterSpacing = "0px";
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, bg: string, fg: string) {
  ctx.font = `700 40px ${SANS}`;
  const w = Math.min(880, ctx.measureText(text).width + 120);
  const h = 104;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 2);
  ctx.textBaseline = "alphabetic";
}

// ---------- content ----------
function pick(content: NewsletterContent, slot: string, index: number): NewsletterSection {
  const found = content.sections?.find((s) => s.slot === slot) ?? content.sections?.[index];
  return found ?? { slot, label: "", topic: "", heading: "", body: "" };
}

export const EMPTY_MONTH: NewsletterContent = {
  subjectLines: [],
  previewTexts: [],
  intro: "",
  sections: [
    { slot: "lead", label: "The Lead Story", topic: "", heading: "Your lead story headline", body: "" },
    { slot: "ask", label: "Ask the Clinician", topic: "", heading: "A question your patients ask", body: "" },
    { slot: "myth", label: "Myth vs Truth", topic: "", heading: "A myth worth busting", body: "" },
    { slot: "bts", label: "Behind the Scenes", topic: "", heading: "What goes on behind the door", body: "" },
    { slot: "sell", label: "Something for You", topic: "", heading: "Something just for you", body: "" },
  ],
  ctaText: "Come and have a chat",
  signOff: "",
};

// ---------- the five pages ----------
function coverPage(brand: MonthBrand, content: NewsletterContent, photos: (CanvasImageSource | null)[]) {
  const pal = palette(brand.accent);
  const [c, ctx] = newCanvas();
  const lead = pick(content, "lead", 0);
  const teasers = [pick(content, "ask", 1), pick(content, "myth", 2), pick(content, "bts", 3), pick(content, "sell", 4)];

  const bg = ctx.createLinearGradient(0, 0, MS_W, MS_H);
  bg.addColorStop(0, pal.deep);
  bg.addColorStop(1, mix(pal.deep, pal.hi, 0.35));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, MS_W, MS_H);
  drawPhoto(ctx, photos[0], 0, 0, 0, MS_W, MS_H);

  const top = ctx.createLinearGradient(0, 0, 0, 440);
  top.addColorStop(0, "rgba(0,0,0,0.66)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, MS_W, 440);
  const bottom = ctx.createLinearGradient(0, 520, 0, MS_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(0.55, "rgba(0,0,0,0.72)");
  bottom.addColorStop(1, "rgba(0,0,0,0.86)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 520, MS_W, MS_H - 520);

  const nameEnd = block(ctx, brand.newsletterName || brand.clinicName, {
    x: MS_W / 2,
    y: 80,
    maxW: 920,
    maxLines: 2,
    size: 76,
    minSize: 44,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 3,
  });
  ctx.fillStyle = pal.hi;
  ctx.fillRect(MS_W / 2 - 60, nameEnd + 22, 120, 5);
  block(ctx, `${brand.monthLabel}   ${brand.clinicName}`, {
    x: MS_W / 2,
    y: nameEnd + 46,
    maxW: 920,
    maxLines: 1,
    size: 26,
    minSize: 18,
    family: SANS,
    weight: "600",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 5,
  });

  kicker(ctx, "The lead story", 668, pal.hi, pal.hi);
  const hy = block(ctx, lead.heading || "Your lead story headline", {
    x: 80,
    y: 700,
    maxW: 920,
    maxLines: 3,
    size: 96,
    minSize: 56,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    lineHeight: 1.08,
  });

  let y = Math.max(hy + 44, 1010);
  for (const t of teasers) {
    ctx.fillStyle = pal.hi;
    ctx.fillRect(80, y + 2, 8, 40);
    block(ctx, t.heading, { x: 108, y, maxW: 890, maxLines: 1, size: 36, minSize: 22, family: SANS, weight: "600", colour: "#ffffff" });
    y += 76;
  }
  return c;
}

function leadPage(brand: MonthBrand, content: NewsletterContent, photos: (CanvasImageSource | null)[]) {
  const pal = palette(brand.accent);
  const [c, ctx] = newCanvas();
  const s = pick(content, "lead", 0);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, MS_W, MS_H);
  kicker(ctx, "The lead story", 130, pal.text, brand.accent);
  const hy = block(ctx, s.heading, { x: 80, y: 168, maxW: 920, maxLines: 3, size: 76, minSize: 46, family: SERIF, weight: "bold", colour: INK, lineHeight: 1.08 });
  let y = hy + 30;
  if (photos[1]) {
    drawPhoto(ctx, photos[1], 1, 80, y, 920, 340);
    ctx.fillStyle = brand.accent;
    ctx.fillRect(80, y + 340 - 14, 90, 14);
    y += 340 + 38;
  }
  paragraphs(ctx, s.body, { x: 80, y, maxW: 920, maxY: 1340, size: photos[1] ? 32 : 38, minSize: 22, colour: INK });
  footer(ctx, brand, 2, INK);
  return c;
}

function askMythPage(brand: MonthBrand, content: NewsletterContent, photos: (CanvasImageSource | null)[]) {
  const pal = palette(brand.accent);
  const [c, ctx] = newCanvas();
  const ask = pick(content, "ask", 1);
  const myth = pick(content, "myth", 2);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, MS_W, MS_H);

  // top: Ask the Clinician
  kicker(ctx, "Ask the clinician", 130, pal.text, brand.accent);
  const D = 220;
  const hasPortrait = !!photos[2];
  const headW = hasPortrait ? 920 - D - 30 : 920;
  const hy = block(ctx, ask.heading, { x: 80, y: 166, maxW: headW, maxLines: 4, size: 58, minSize: 36, family: SERIF, weight: "bold", style: "italic", colour: INK, lineHeight: 1.1 });
  let y = hy + 26;
  if (hasPortrait) {
    const px = MS_W - 80 - D;
    ctx.fillStyle = brand.accent;
    ctx.beginPath();
    ctx.arc(px + D / 2 + 8, 166 + D / 2 + 8, D / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
    drawPhoto(ctx, photos[2], 2, px, 166, D, D, true);
    y = Math.max(y, 166 + D + 30);
  }
  paragraphs(ctx, ask.body, { x: 80, y, maxW: 920, maxY: 770, size: 30, minSize: 21, colour: INK });

  // bottom: Myth vs Truth on the deep panel
  const panelY = 800;
  ctx.fillStyle = pal.deep;
  ctx.fillRect(0, panelY, MS_W, MS_H - panelY);
  kicker(ctx, "Myth vs truth", panelY + 78, pal.hi, pal.hi);
  const my = block(ctx, `“${myth.heading}”`, { x: 80, y: panelY + 110, maxW: 920, maxLines: 3, size: 54, minSize: 34, family: SERIF, weight: "bold", colour: "#ffffff", lineHeight: 1.1 });
  ctx.font = `700 22px ${SANS}`;
  (ctx as any).letterSpacing = "5px";
  ctx.fillStyle = pal.hi;
  ctx.textAlign = "left";
  ctx.fillText("THE TRUTH", 80, my + 46);
  (ctx as any).letterSpacing = "0px";
  paragraphs(ctx, myth.body, { x: 80, y: my + 64, maxW: 920, maxY: 1370, size: 30, minSize: 21, colour: "#ffffff" });
  footer(ctx, brand, 3, "#ffffff");
  return c;
}

function behindPage(brand: MonthBrand, content: NewsletterContent, photos: (CanvasImageSource | null)[]) {
  const pal = palette(brand.accent);
  const [c, ctx] = newCanvas();
  const s = pick(content, "bts", 3);
  ctx.fillStyle = pal.tint;
  ctx.fillRect(0, 0, MS_W, MS_H);
  kicker(ctx, "Behind the scenes", 130, pal.text, brand.accent);

  if (photos[3]) {
    // a taped polaroid
    ctx.save();
    ctx.translate(MS_W / 2, 500);
    ctx.rotate((-2.5 * Math.PI) / 180);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-380 + 12, -330 + 18, 760, 660);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-380, -330, 760, 660);
    ctx.translate(-350, -300);
    drawPhoto(ctx, photos[3], 3, 0, 0, 700, 540);
    ctx.restore();
    ctx.save();
    ctx.translate(MS_W / 2 - 20, 178);
    ctx.rotate((3 * Math.PI) / 180);
    ctx.fillStyle = mix(brand.accent, "#ffffff", 0.35);
    ctx.globalAlpha = 0.72;
    ctx.fillRect(-100, -28, 200, 56);
    ctx.restore();
    const hy = block(ctx, s.heading, { x: 80, y: 866, maxW: 920, maxLines: 2, size: 62, minSize: 40, family: SERIF, weight: "bold", colour: INK, lineHeight: 1.08 });
    paragraphs(ctx, s.body, { x: 80, y: hy + 24, maxW: 920, maxY: 1350, size: 32, minSize: 22, colour: INK });
  } else {
    const hy = block(ctx, s.heading, { x: 80, y: 176, maxW: 920, maxLines: 4, size: 84, minSize: 48, family: SERIF, weight: "bold", colour: INK, lineHeight: 1.08 });
    paragraphs(ctx, s.body, { x: 80, y: hy + 40, maxW: 920, maxY: 1350, size: 38, minSize: 24, colour: INK });
  }
  footer(ctx, brand, 4, INK);
  return c;
}

function sellPage(brand: MonthBrand, content: NewsletterContent, photos: (CanvasImageSource | null)[]) {
  const pal = palette(brand.accent);
  const [c, ctx] = newCanvas();
  const s = pick(content, "sell", 4);
  ctx.fillStyle = pal.deep;
  ctx.fillRect(0, 0, MS_W, MS_H);
  kicker(ctx, "Something for you", 130, pal.hi, pal.hi);

  let y = 166;
  if (photos[4]) {
    drawPhoto(ctx, photos[4], 4, 80, y, 920, 330);
    ctx.fillStyle = pal.hi;
    ctx.fillRect(80, y + 330 - 14, 90, 14);
    y += 330 + 36;
  }
  const hy = block(ctx, s.heading, { x: 80, y, maxW: 920, maxLines: 3, size: photos[4] ? 62 : 80, minSize: 40, family: SERIF, weight: "bold", colour: "#ffffff", lineHeight: 1.08 });
  const bodyEnd = paragraphs(ctx, s.body, { x: 80, y: hy + 26, maxW: 920, maxY: 960, size: 32, minSize: 22, colour: "#ffffff" });

  const btnY = Math.max(bodyEnd + 90, 1010);
  const hi = pal.hi;
  pill(ctx, content.ctaText || "Come and have a chat", MS_W / 2, btnY, hi, onColour(hi));
  let ty = btnY + 88;
  const link = (brand.bookingUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (link) {
    ty = block(ctx, link, { x: MS_W / 2, y: ty, maxW: 900, maxLines: 1, size: 32, minSize: 20, family: SANS, weight: "600", colour: "#ffffff", align: "center", tracking: 1 }) + 18;
  }
  if (brand.address) {
    ty = block(ctx, brand.address, { x: MS_W / 2, y: ty, maxW: 800, maxLines: 2, size: 24, minSize: 18, family: SANS, colour: "rgba(255,255,255,0.72)", align: "center" }) + 18;
  }
  const logoY = Math.min(Math.max(ty + 6, 1260), 1300);
  if (brand.logo && brand.logo.width) {
    const maxW = 300;
    const maxH = 90;
    const k = Math.min(maxW / brand.logo.width, maxH / brand.logo.height, 1.6);
    const lw = brand.logo.width * k;
    const lh = brand.logo.height * k;
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.roundRect(MS_W / 2 - lw / 2 - 24, logoY - 12, lw + 48, lh + 24, 18);
    ctx.fill();
    ctx.drawImage(brand.logo, MS_W / 2 - lw / 2, logoY, lw, lh);
  } else {
    block(ctx, brand.clinicName, { x: MS_W / 2, y: logoY, maxW: 880, maxLines: 1, size: 40, minSize: 24, family: SERIF, style: "italic", colour: "#ffffff", align: "center" });
  }
  return c;
}

export function drawMonthPages(
  brand: MonthBrand,
  content: NewsletterContent,
  photos: (CanvasImageSource | null)[],
  photoAdjusts: (PhotoAdjust | undefined)[] = []
): HTMLCanvasElement[] {
  hits = [];
  adjusts = photoAdjusts;
  const out: HTMLCanvasElement[] = [];
  const makers = [coverPage, leadPage, askMythPage, behindPage, sellPage];
  makers.forEach((fn, i) => {
    curPage = i;
    out.push(fn(brand, content, photos));
  });
  return out;
}
