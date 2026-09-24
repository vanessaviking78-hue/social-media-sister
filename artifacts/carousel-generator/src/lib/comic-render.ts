// Canvas renderer for the Comic Strip tool. The artwork comes from the AI
// (characters only, drawn on plain white). Everything else, the cover, the panels,
// the speech bubbles and the lettering, is drawn here so the words are always crisp
// and can be edited without regenerating any art.
//
// Two slides: a comic book cover, then one page with all six panels (2 x 3).
import type { ComicConversation, ComicLine, Expr } from "./comic-conversations";

export const COMIC_W = 1080;
export const COMIC_H = 1440;

const INK = "#111114";
const SHOUT = '"Bangers", "Impact", "Arial Black", sans-serif';
const TALK = '"Comic Neue", "Comic Sans MS", "Chalkboard SE", sans-serif';

// Page layout: black page like a pop-art comic, six panels, footer strip along the bottom.
const PAGE_MARGIN = 24;
const PAGE_FOOTER = 44;
const PANEL_GAP = 16;
const COLS = 2;
const ROWS = 3;

// [light, dark] pairs. Light is the panel colour, dark is the halftone dot colour.
const PANEL_COLOURS: Array<[string, string]> = [
  ["#ffd6e0", "#f08aa8"],
  ["#d6ecff", "#7fb9ef"],
  ["#fff0b8", "#f0cc50"],
  ["#d9f5d3", "#8fd882"],
  ["#e6dcff", "#b39af2"],
  ["#ffe1c7", "#f5a866"],
];

export type SpriteSet = Partial<Record<Expr, HTMLImageElement>>;
export interface ComicSprites { inj: SpriteSet; pat: SpriteSet }
export interface ComicRenderOptions { footer?: string }
export interface ComicCoverOptions {
  title: string;
  strapline: string;
  issue: string;
  footer?: string;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

interface Bubble { who: "I" | "P"; text: string }

// Consecutive lines from the same speaker share one bubble.
export function groupBubbles(lines: ComicLine[]): Bubble[] {
  const out: Bubble[] = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && last.who === l.who) last.text += " " + l.text;
    else out.push({ who: l.who, text: l.text });
  }
  return out;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function talkFont(size: number) { return `800 ${size}px ${TALK}`; }
function shoutFont(size: number) { return `400 ${size}px ${SHOUT}`; }

// Ben-Day dots that grow from top to bottom, the classic pop-art shading.
function halftone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string, spacing: number, maxR: number) {
  ctx.fillStyle = colour;
  let row = 0;
  for (let py = y; py < y + h + spacing; py += spacing * 0.86, row++) {
    const t = Math.min(1, Math.max(0, (py - y) / h));
    const r = maxR * t;
    if (r < 0.6) continue;
    for (let px = x + (row % 2 ? spacing / 2 : 0); px < x + w + spacing; px += spacing) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The artwork is drawn on white, so multiply lets the panel colour show through it.
function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, role: "I" | "P", expr: Expr, x: number, bottom: number, w: number, h: number) {
  // Simple stand-in shown until the AI characters have been made.
  const cx = x + w / 2;
  ctx.fillStyle = role === "I" ? "#7fb6e8" : "#f0a8c0";
  roundRect(ctx, x + w * 0.12, bottom - h * 0.5, w * 0.76, h * 0.62, 30);
  ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = "#ffe0c2";
  ctx.beginPath();
  ctx.arc(cx, bottom - h * 0.62, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - w * 0.1, bottom - h * 0.65, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.1, bottom - h * 0.65, 5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath();
  const my = bottom - h * 0.54;
  if (expr === "happy") ctx.arc(cx, my - 6, w * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (expr === "angry" || expr === "horrified") ctx.arc(cx, my + 14, w * 0.1, 1.15 * Math.PI, 1.85 * Math.PI);
  else { ctx.moveTo(cx - w * 0.1, my); ctx.lineTo(cx + w * 0.1, expr === "smug" ? my - 8 : my); }
  ctx.stroke();
}

interface BubbleBox { lines: string[]; w: number; h: number; lineH: number }

function measureBubble(ctx: CanvasRenderingContext2D, bubble: Bubble, maxW: number, fontSize: number): BubbleBox {
  ctx.font = talkFont(fontSize);
  const padX = 20;
  const padY = 14;
  const lineH = fontSize * 1.15;
  const lines = wrap(ctx, bubble.text, maxW - padX * 2);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  return { lines, w: Math.min(maxW, textW + padX * 2), h: lines.length * lineH + padY * 2, lineH };
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: Bubble,
  box: BubbleBox,
  x: number,
  y: number,
  fontSize: number,
  tailToX: number,
  tailToY: number,
) {
  const { w, h, lines, lineH } = box;
  ctx.font = talkFont(fontSize);

  // Tail first, so the bubble outline sits over its base. Kept short whatever the panel height.
  const ty = Math.max(y + h + 18, Math.min(tailToY, y + h + 34));
  const tx = Math.min(Math.max(tailToX, x + 26), x + w - 26);
  const baseX = Math.min(Math.max(tx, x + 40), x + w - 40);
  ctx.beginPath();
  ctx.moveTo(baseX - 16, y + h - 3);
  ctx.lineTo(tx, ty);
  ctx.lineTo(baseX + 16, y + h - 3);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();

  roundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Cover the tail's inner join line so it reads as one shape.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(baseX - 13, y + h - 6, 26, 8);

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let cy = y + 14 + (lineH - fontSize) / 2;
  for (const ln of lines) {
    ctx.fillText(ln, x + 20, cy);
    cy += lineH;
  }
}

function pageLayout() {
  const pw = Math.floor((COMIC_W - PAGE_MARGIN * 2 - PANEL_GAP * (COLS - 1)) / COLS);
  const ph = Math.floor((COMIC_H - PAGE_MARGIN - PAGE_FOOTER - PANEL_GAP * (ROWS - 1)) / ROWS);
  return { pw, ph };
}

// The six-panel page.
export function renderComicPage(
  canvas: HTMLCanvasElement,
  conv: ComicConversation,
  sprites: ComicSprites,
  opts: ComicRenderOptions = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = COMIC_W;
  canvas.height = COMIC_H;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, COMIC_W, COMIC_H);

  const { pw, ph } = pageLayout();
  const seed = hash(conv.id);

  for (let i = 0; i < 6; i++) {
    const panel = conv.panels[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const px = PAGE_MARGIN + col * (pw + PANEL_GAP);
    const py = PAGE_MARGIN + row * (ph + PANEL_GAP);
    const isPunch = i === 5;
    const [light, dark] = isPunch ? ["#fff06a", "#f2b800"] : PANEL_COLOURS[(seed + i) % PANEL_COLOURS.length];

    ctx.save();
    roundRect(ctx, px, py, pw, ph, 8);
    ctx.clip();

    ctx.fillStyle = light;
    ctx.fillRect(px, py, pw, ph);
    halftone(ctx, px, py, pw, ph, dark, 13, 4.6);

    // Characters, patient on the left, clinician on the right, both standing on the panel floor.
    const spriteH = 196;
    const spriteW = spriteH * 0.75;
    const bottom = py + ph;
    const patX = px + 6;
    const injX = px + pw - 6 - spriteW;
    const patImg = sprites.pat[panel.pat];
    const injImg = sprites.inj[panel.inj];
    if (patImg) drawSprite(ctx, patImg, patX, bottom - spriteH, spriteW, spriteH);
    else drawPlaceholder(ctx, "P", panel.pat, patX, bottom, spriteW, spriteH);
    if (injImg) drawSprite(ctx, injImg, injX, bottom - spriteH, spriteW, spriteH);
    else drawPlaceholder(ctx, "I", panel.inj, injX, bottom, spriteW, spriteH);

    // Bubbles fill the space above the characters, stacked, each on its speaker's side.
    const bubbles = groupBubbles(panel.lines);
    const zoneTop = py + 14;
    const zoneH = ph - spriteH + 8 - 14;
    const zoneX = px + 16;
    const zoneW = pw - 32;
    const maxW = bubbles.length > 1 ? Math.floor(zoneW * 0.88) : zoneW;
    const gap = bubbles.length > 1 ? 20 : 0;

    let fontSize = isPunch ? 32 : 30;
    const measure = (fs: number) => bubbles.map((b) => measureBubble(ctx, b, maxW, fs));
    const total = (boxes: BubbleBox[]) => boxes.reduce((s, b) => s + b.h, 0) + gap * (boxes.length - 1);
    let boxes = measure(fontSize);
    while (fontSize > 16 && total(boxes) > zoneH) { fontSize -= 2; boxes = measure(fontSize); }

    let by = zoneTop + Math.max(0, (zoneH - total(boxes)) / 2 - 4);
    bubbles.forEach((b, bi) => {
      const box = boxes[bi];
      const bx = b.who === "P" ? zoneX : zoneX + zoneW - box.w;
      const speakerX = b.who === "P" ? patX + spriteW * 0.5 : injX + spriteW * 0.5;
      const speakerY = bottom - spriteH + 14;
      drawBubble(ctx, b, box, bx, by, fontSize, speakerX, speakerY);
      by += box.h + gap;
    });

    ctx.restore();

    roundRect(ctx, px, py, pw, ph, 8);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  if (opts.footer) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 22px ${TALK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.footer, COMIC_W / 2, COMIC_H - PAGE_FOOTER / 2 - 2);
  }
}

// Wraps a masthead title to the widest size that fits the box.
function fitShout(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, maxSize: number, minSize: number, maxLines: number) {
  for (let size = maxSize; size >= minSize; size -= 4) {
    ctx.font = shoutFont(size);
    const lines = wrap(ctx, text.toUpperCase(), maxW);
    const lineH = size * 1.0;
    if (lines.length <= maxLines && lines.length * lineH <= maxH) return { size, lines, lineH };
  }
  ctx.font = shoutFont(minSize);
  const lines = wrap(ctx, text.toUpperCase(), maxW);
  return { size: minSize, lines, lineH: minSize };
}

// The comic book cover: sunburst, masthead, the clinician, and a strapline banner.
export function renderComicCover(
  canvas: HTMLCanvasElement,
  conv: ComicConversation,
  sprites: ComicSprites,
  opts: ComicCoverOptions,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = COMIC_W;
  canvas.height = COMIC_H;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, COMIC_W, COMIC_H);

  const fx = PAGE_MARGIN;
  const fy = PAGE_MARGIN;
  const fw = COMIC_W - PAGE_MARGIN * 2;
  const fh = COMIC_H - PAGE_MARGIN * 2;
  const seed = hash(conv.id + opts.title);
  const [light, dark] = PANEL_COLOURS[seed % PANEL_COLOURS.length];

  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, 10);
  ctx.clip();

  // Sunburst rays from behind the clinician.
  const cx = fx + fw * 0.58;
  const cy = fy + fh * 0.62;
  ctx.fillStyle = light;
  ctx.fillRect(fx, fy, fw, fh);
  const rays = 28;
  ctx.fillStyle = dark;
  for (let r = 0; r < rays; r += 2) {
    const a0 = (r / rays) * Math.PI * 2;
    const a1 = ((r + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 2000, cy + Math.sin(a0) * 2000);
    ctx.lineTo(cx + Math.cos(a1) * 2000, cy + Math.sin(a1) * 2000);
    ctx.closePath();
    ctx.fill();
  }
  halftone(ctx, fx, fy, fw, fh, "rgba(255,255,255,0.35)", 16, 5);

  // A soft white glow behind the clinician keeps the artwork colours true.
  const glow = ctx.createRadialGradient(cx, cy + 60, 40, cx, cy + 60, 520);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(fx, fy, fw, fh);

  // Characters: clinician big, patient small and appalled.
  const bandH = opts.footer ? 130 : 108;
  const floor = fy + fh - bandH;
  const injH = 820;
  const injW = injH * 0.75;
  const patH = 400;
  const patW = patH * 0.75;
  const injImg = sprites.inj.smug ?? sprites.inj.neutral;
  const patImg = sprites.pat.horrified ?? sprites.pat.neutral;
  const patX = fx + 8;
  const injX = fx + fw - injW - 10;
  if (patImg) drawSprite(ctx, patImg, patX, floor - patH + 10, patW, patH);
  else drawPlaceholder(ctx, "P", "horrified", patX, floor + 10, patW, patH);
  if (injImg) drawSprite(ctx, injImg, injX, floor - injH + 10, injW, injH);
  else drawPlaceholder(ctx, "I", "smug", injX, floor + 10, injW, injH);

  // Masthead.
  const mastW = fw - 100;
  const fit = fitShout(ctx, opts.title, mastW, 330, 150, 64, 3);
  ctx.font = shoutFont(fit.size);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let ty = fy + 96;
  for (const ln of fit.lines) {
    const tx = fx + fw / 2;
    ctx.lineJoin = "round";
    ctx.lineWidth = fit.size * 0.22;
    ctx.strokeStyle = INK;
    ctx.strokeText(ln, tx + 6, ty + 7);
    ctx.fillStyle = INK;
    ctx.fillText(ln, tx + 6, ty + 7);
    ctx.strokeText(ln, tx, ty);
    ctx.fillStyle = "#ffe600";
    ctx.fillText(ln, tx, ty);
    ty += fit.lineH;
  }

  // Issue badge, top left.
  ctx.font = shoutFont(38);
  const badgeText = `ISSUE No. ${opts.issue}`;
  const badgeW = Math.ceil(ctx.measureText(badgeText).width) + 40;
  const badgeH = 58;
  const bx = fx + 26;
  const by = fy + 24;
  roundRect(ctx, bx, by, badgeW, badgeH, 10);
  ctx.fillStyle = "#e5252a";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = shoutFont(38);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, bx + badgeW / 2, by + badgeH / 2 + 2);

  // Strapline banner along the bottom.
  const bandY = fy + fh - bandH;
  ctx.fillStyle = INK;
  ctx.fillRect(fx, bandY, fw, bandH);
  const sfit = fitShout(ctx, opts.strapline, fw - 80, 64, 52, 30, 2);
  ctx.font = shoutFont(sfit.size);
  ctx.fillStyle = "#ffe600";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const blockH = sfit.lines.length * sfit.lineH;
  let sy = bandY + (opts.footer ? 14 : (bandH - blockH) / 2 + 2);
  for (const ln of sfit.lines) {
    ctx.fillText(ln, fx + fw / 2, sy);
    sy += sfit.lineH;
  }
  if (opts.footer) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 24px ${TALK}`;
    ctx.textBaseline = "middle";
    ctx.fillText(opts.footer, fx + fw / 2, bandY + bandH - 26);
  }

  ctx.restore();

  roundRect(ctx, fx, fy, fw, fh, 10);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  roundRect(ctx, fx + 4, fy + 4, fw - 8, fh - 8, 8);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// Plain-text summary for the caption writer.
export function comicSummary(conv: ComicConversation): string {
  const lines: string[] = [];
  for (const p of conv.panels) for (const l of p.lines) lines.push(`${l.who === "I" ? "Clinician" : "Patient"}: ${l.text}`);
  return lines.join("\n");
}
