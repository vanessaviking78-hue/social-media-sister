// Canvas renderer for the Comic Strip tool. The artwork comes from the AI
// (characters only). Everything else, the panels, speech bubbles and lettering,
// is drawn here so the words are always crisp and can be edited without
// regenerating any art.
import type { ComicConversation, ComicLine, Expr } from "./comic-conversations";

export const COMIC_W = 1080;
export const COMIC_H = 1440;

const MARGIN = 30;
const GAP = 24;
const INK = "#1b1b1f";
const PAPER = "#fff8ee";

// Page one is three equal panels. Page two gives the punchline panel most of the page.
const PAGE_HEIGHTS: number[][] = [
  [444, 444, 444],
  [380, 380, 572],
];

const PANEL_COLOURS: Array<[string, string]> = [
  ["#ffd6e0", "#f4a7bd"],
  ["#d6ecff", "#9fcdf5"],
  ["#fff0b8", "#f2d675"],
  ["#d9f5d3", "#9fd995"],
  ["#e6dcff", "#bfa8f5"],
  ["#ffe1c7", "#f5b985"],
];

export type SpriteSet = Partial<Record<Expr, HTMLImageElement>>;
export interface ComicSprites { inj: SpriteSet; pat: SpriteSet }
export interface ComicRenderOptions { footer?: string }

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

function fontFor(size: number) {
  return `800 ${size}px "Comic Neue", "Comic Sans MS", "Chalkboard SE", sans-serif`;
}

// Draws a speech bubble in the zone, returns nothing. `side` decides where the tail points.
function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: Bubble,
  zone: { x: number; y: number; w: number; h: number },
  fontSize: number,
  tailToX: number,
  tailToY: number,
) {
  ctx.font = fontFor(fontSize);
  const padX = 26;
  const padY = 20;
  const lineH = fontSize * 1.18;
  const maxTextW = zone.w - padX * 2;
  const lines = wrap(ctx, bubble.text, maxTextW);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const w = Math.min(zone.w, textW + padX * 2);
  const h = lines.length * lineH + padY * 2;
  // Anchor toward the speaker's side of the zone.
  const x = bubble.who === "P" ? zone.x : zone.x + zone.w - w;
  const y = zone.y;

  // Tail first, so the bubble outline sits over its base. Keep it short, whatever the panel height.
  tailToY = Math.min(tailToY, y + h + 46);
  tailToX = Math.min(Math.max(tailToX, x + 30), x + w - 30);
  const baseX = Math.min(Math.max(tailToX, x + 50), x + w - 50);
  ctx.beginPath();
  ctx.moveTo(baseX - 22, y + h - 3);
  ctx.lineTo(tailToX, tailToY);
  ctx.lineTo(baseX + 22, y + h - 3);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();

  roundRect(ctx, x, y, w, h, 30);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Cover the tail's inner join line so it reads as one shape.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(baseX - 19, y + h - 7, 38, 9);

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let ty = y + padY + (lineH - fontSize) / 2;
  for (const ln of lines) {
    ctx.fillText(ln, x + padX, ty);
    ty += lineH;
  }
}

function measureBubbleHeight(ctx: CanvasRenderingContext2D, bubble: Bubble, w: number, fontSize: number) {
  ctx.font = fontFor(fontSize);
  const lines = wrap(ctx, bubble.text, w - 52);
  return lines.length * fontSize * 1.18 + 40;
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, role: "I" | "P", expr: Expr, x: number, bottom: number, w: number, h: number) {
  // Simple stand-in shown until the AI characters have been made.
  const cx = x + w / 2;
  ctx.fillStyle = role === "I" ? "#7fb6e8" : "#f0a8c0";
  roundRect(ctx, x + w * 0.12, bottom - h * 0.5, w * 0.76, h * 0.62, 40);
  ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = "#ffe0c2";
  ctx.beginPath();
  ctx.arc(cx, bottom - h * 0.62, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx - w * 0.1, bottom - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.1, bottom - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath();
  const my = bottom - h * 0.54;
  if (expr === "happy") ctx.arc(cx, my - 6, w * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (expr === "angry" || expr === "horrified") ctx.arc(cx, my + 14, w * 0.1, 1.15 * Math.PI, 1.85 * Math.PI);
  else { ctx.moveTo(cx - w * 0.1, my); ctx.lineTo(cx + w * 0.1, expr === "smug" ? my - 8 : my); }
  ctx.stroke();
}

export function renderComicPage(
  canvas: HTMLCanvasElement,
  conv: ComicConversation,
  page: 0 | 1,
  sprites: ComicSprites,
  opts: ComicRenderOptions = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = COMIC_W;
  canvas.height = COMIC_H;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, COMIC_W, COMIC_H);

  const [light, dark] = PANEL_COLOURS[hash(conv.id) % PANEL_COLOURS.length];
  const heights = PAGE_HEIGHTS[page];
  let y = MARGIN;

  for (let i = 0; i < 3; i++) {
    const panel = conv.panels[page * 3 + i];
    const ph = heights[i];
    const px = MARGIN;
    const pw = COMIC_W - MARGIN * 2;

    ctx.save();
    roundRect(ctx, px, y, pw, ph, 18);
    ctx.clip();

    // Backdrop and floor
    ctx.fillStyle = light;
    ctx.fillRect(px, y, pw, ph);
    ctx.fillStyle = dark;
    ctx.fillRect(px, y + ph - ph * 0.12, pw, ph * 0.12);

    // Characters
    const spriteH = Math.min(ph * 0.62, 400);
    const spriteW = spriteH * 0.75;
    const bottom = y + ph;
    const patX = px + 14;
    const injX = px + pw - 14 - spriteW;
    const patImg = sprites.pat[panel.pat];
    const injImg = sprites.inj[panel.inj];
    if (patImg) ctx.drawImage(patImg, patX, bottom - spriteH, spriteW, spriteH);
    else drawPlaceholder(ctx, "P", panel.pat, patX, bottom, spriteW, spriteH);
    if (injImg) ctx.drawImage(injImg, injX, bottom - spriteH, spriteW, spriteH);
    else drawPlaceholder(ctx, "I", panel.inj, injX, bottom, spriteW, spriteH);

    // Bubbles sit above the characters' heads
    const bubbles = groupBubbles(panel.lines);
    const zoneTop = y + 18;
    const zoneH = ph - spriteH + 22 - 18;
    const zoneX = px + 24;
    const zoneW = pw - 48;
    const dual = bubbles.length > 1;
    const bubbleZoneW = dual ? zoneW / 2 - 10 : Math.min(zoneW, 700);

    // Largest font that fits
    let fontSize = page === 1 && i === 2 ? 46 : 36;
    const fits = (fs: number) => bubbles.every((b) => measureBubbleHeight(ctx, b, bubbleZoneW, fs) <= zoneH);
    while (fontSize > 20 && !fits(fontSize)) fontSize -= 2;

    bubbles.forEach((b, bi) => {
      const zx = dual ? (b.who === "P" ? zoneX : zoneX + zoneW / 2 + 10) : (b.who === "P" ? zoneX : zoneX + zoneW - bubbleZoneW);
      const speakerX = b.who === "P" ? patX + spriteW * 0.5 : injX + spriteW * 0.5;
      const speakerY = bottom - spriteH + 16;
      drawBubble(ctx, b, { x: zx, y: zoneTop + (dual ? 0 : 0) + bi * 0, w: bubbleZoneW, h: zoneH }, fontSize, speakerX, speakerY);
    });

    ctx.restore();

    // Panel border
    roundRect(ctx, px, y, pw, ph, 18);
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.stroke();

    y += ph + GAP;
  }

  if (opts.footer) {
    ctx.fillStyle = INK;
    ctx.font = `700 18px "Comic Neue", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.footer, COMIC_W / 2, COMIC_H - MARGIN / 2 - 2);
  }
}

// Plain-text summary for the caption writer.
export function comicSummary(conv: ComicConversation): string {
  const lines: string[] = [];
  for (const p of conv.panels) for (const l of p.lines) lines.push(`${l.who === "I" ? "Clinician" : "Patient"}: ${l.text}`);
  return lines.join("\n");
}
