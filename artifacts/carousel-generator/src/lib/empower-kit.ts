// Empower: the drawing kit. Every Empower layout is written in a 400 x 500 space (the size of the Canva
// preview) and scaled up by 2.7 onto the real 1080 x 1350 canvas, so the preview, the download and the
// scheduled image are always identical. No React in here.
//
// Metallic: any colour can be switched to a foil. The colour picked is turned into a brushed metal
// gradient made from lighter and darker shades of that same colour, so a gold picker gives gold foil,
// a silver picker gives silver foil, and any brand colour gives a foil in that colour.

import {
  XW, XH, HU, drawPhoto, rand, shade, rgba, textBox,
  type Ctx, type Focus, type G, type P, type Slot,
} from "./xmas-designs";

export { XW, XH, HU, rgba, shade, rand };
export type { Ctx, Focus, P, Slot };

export const S = 2.7;
export const W = 400;
export const H = 500;

export type EKey = "page" | "dark" | "accent" | "soft" | "ink" | "light";
export type EPalette = Record<EKey, string>;
export type EMetal = Partial<Record<EKey, boolean>>;

export type EG = G & { p: EPalette; metal: EMetal; foils: Map<string, CanvasGradient> };

// Quick foil colours for the buttons beside the colour pickers
export const FOILS: { label: string; hex: string }[] = [
  { label: "Gold", hex: "#c9a24a" },
  { label: "Rose gold", hex: "#d79d8b" },
  { label: "Silver", hex: "#b8bec7" },
  { label: "Bronze", hex: "#a8743f" },
];

// ---------------------------------------------------------------------------
// Colour: flat, or a foil made from the same colour
// ---------------------------------------------------------------------------

const BANDS = [0.34, 0.1, -0.16, 0.12, -0.08, 0.3, 0.04, -0.2, 0.16, 0.36, -0.02, -0.14, 0.22];

function foil(g: EG, hex: string): CanvasGradient {
  const got = g.foils.get(hex);
  if (got) return got;
  const gr = g.ctx.createLinearGradient(-60, -40, 460, 540);
  BANDS.forEach((b, i) => gr.addColorStop(i / (BANDS.length - 1), shade(hex, b)));
  g.foils.set(hex, gr);
  return gr;
}

// The fill for a palette colour. Returns a string type so it can go anywhere a colour goes.
export function k(g: EG, key: EKey): string {
  return g.metal[key] ? (foil(g, g.p[key]) as unknown as string) : g.p[key];
}

// A darker or lighter version of a colour (stays flat, used for folds and shadows)
export const tone = (g: EG, key: EKey, amt: number) => shade(g.p[key], amt);

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export function rect(g: EG, x: number, y: number, w: number, h: number, style: string) {
  g.ctx.fillStyle = style;
  g.ctx.fillRect(x, y, w, h);
}

export function polyPath(ctx: Ctx, pts: P[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export function poly(g: EG, pts: P[], style: string, o?: { alpha?: number; shadow?: boolean }) {
  const { ctx } = g;
  ctx.save();
  if (o?.alpha != null) ctx.globalAlpha = o.alpha;
  if (o?.shadow) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6; }
  polyPath(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
  ctx.restore();
}

// Rough, torn edges: every edge is cut into short steps and nudged. Keep points just outside the canvas
// where the shape meets the edge so the nudging never shows a gap.
export function jag(pts: P[], amp: number, seed: number, step = 7): P[] {
  const r = rand(seed);
  const out: P[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push([a[0] + (b[0] - a[0]) * t + (r() - 0.5) * amp * 2, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * amp * 2]);
    }
  });
  return out;
}

export function torn(g: EG, pts: P[], style: string, seed: number, amp = 2.4, o?: { alpha?: number; shadow?: boolean }) {
  poly(g, jag(pts, amp, seed), style, o);
}

// A thick painted stroke with rough ends
export function brush(g: EG, x1: number, y1: number, x2: number, y2: number, w: number, style: string, seed: number) {
  const r = rand(seed);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const steps = Math.max(2, Math.ceil(len / 9));
  const a: P[] = [], b: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ww = (w / 2) * (0.78 + 0.3 * r());
    const cx = x1 + dx * t, cy = y1 + dy * t;
    a.push([cx + nx * ww, cy + ny * ww]);
    b.push([cx - nx * (w / 2) * (0.78 + 0.3 * r()), cy - ny * (w / 2) * (0.78 + 0.3 * r())]);
  }
  poly(g, [...a, ...b.reverse()], style);
}

export function dashed(g: EG, x1: number, y1: number, x2: number, y2: number, colour: string, lw = 1, dash: [number, number] = [4, 4]) {
  const { ctx } = g;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = colour; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

export function bracket(g: EG, x: number, y: number, dx: number, dy: number, len: number, colour: string, lw = 1.1) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x + dx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * len); ctx.stroke();
  ctx.restore();
}

export function crosshair(g: EG, x: number, y: number, size: number, colour: string) {
  rect(g, x - size, y - 0.4, size * 2, 0.8, colour);
  rect(g, x - 0.4, y - size, 0.8, size * 2, colour);
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

function slotFor(g: EG, x: number, y: number, w: number, h: number) {
  g.slots.push({ i: 0, x: x * S, y: y * S, w: w * S, h: h * S, rot: 0 });
}

// The main photo, cut to any shape. The box is what drags.
export function photoPoly(g: EG, pts: P[], bx: number, by: number, bw: number, bh: number) {
  const { ctx } = g;
  ctx.save();
  polyPath(ctx, pts);
  ctx.clip();
  ctx.translate(bx + bw / 2, by + bh / 2);
  drawPhoto(g, bw, bh);
  ctx.restore();
  slotFor(g, bx, by, bw, bh);
}

export function photoRect(g: EG, x: number, y: number, w: number, h: number) {
  photoPoly(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], x, y, w, h);
}

export function photoCircle(g: EG, cx: number, cy: number, r: number) {
  const { ctx } = g;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  drawPhoto(g, r * 2, r * 2);
  ctx.restore();
  slotFor(g, cx - r, cy - r, r * 2, r * 2);
}

// A small crop of the same photo, used for film strips and contact sheets. fx and fy pick the part shown.
export function crop(g: EG, x: number, y: number, w: number, h: number, zoom: number, fx: number, fy: number, o?: { grey?: boolean }) {
  const { ctx, photo: b } = g;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (!b) {
    ctx.fillStyle = "#cdcac3"; ctx.fillRect(x, y, w, h);
  } else {
    const s = Math.max(w / b.width, h / b.height) * zoom;
    const dw = b.width * s, dh = b.height * s;
    if (o?.grey || g.mono) ctx.filter = "grayscale(1) contrast(1.1) brightness(0.95)";
    ctx.drawImage(b, x - (dw - w) * fx, y - (dh - h) * fy, dw, dh);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export type TO = { max: number; min?: number; weight?: number; colour: string; align?: CanvasTextAlign; lh?: number; upper?: boolean; font?: "head" | "body" | "script" | "hand" };

export const tx = (g: EG, key: string) => g.t[key] ?? "";

// Body words
export function T(g: EG, key: string, x: number, y: number, w: number, h: number, o: TO) {
  const text = o.upper ? HU({ ...g, upper: true } as G, tx(g, key)) : tx(g, key);
  return textBox(g, text, x, y, w, h, { font: o.font ?? "body", max: o.max, min: o.min ?? 5, weight: o.weight, colour: o.colour, align: o.align, lh: o.lh });
}

// Headline words in the headline font (capitals if the capitals box is ticked)
export function Hd(g: EG, key: string, x: number, y: number, w: number, h: number, o: TO) {
  return textBox(g, HU(g, tx(g, key)), x, y, w, h, { font: "head", max: o.max, min: o.min ?? 6, weight: o.weight, colour: o.colour, align: o.align, lh: o.lh ?? 1.0 });
}

// One line of big type that shrinks to fit a width
export function big(g: EG, text: string, x: number, y: number, maxW: number, size: number, colour: string, align: CanvasTextAlign = "left") {
  const { ctx } = g;
  let s = size;
  for (; s > 8; s -= 1) {
    ctx.font = `${g.headW} ${s}px ${g.head}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${g.headW} ${s}px ${g.head}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text, align === "center" ? x + maxW / 2 : align === "right" ? x + maxW : x, y);
}

export const split = (g: EG, key: string): string[] => tx(g, key).split("\n").map((s) => s.trim()).filter(Boolean);

// Text standing on its side (reads bottom to top)
export function upright(g: EG, text: string, x: number, y: number, size: number, colour: string, weight = 700) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `${weight} ${size}px ${g.body}`;
  ctx.fillStyle = colour;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------

export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 40): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// A rectangle with a round top, like a window or an arch
export function archPts(x: number, y: number, w: number, h: number): P[] {
  const r = w / 2;
  return [...arcPts(x + r, y + r, r, Math.PI, Math.PI * 2, 32), [x + w, y + h], [x, y + h]];
}

// A zigzag bottom edge for receipts and tickets
export function zigPts(x: number, y: number, w: number, h: number, teeth = 12): P[] {
  const pts: P[] = [[x, y], [x + w, y], [x + w, y + h]];
  const tw = w / teeth;
  for (let i = teeth - 1; i >= 0; i--) {
    pts.push([x + i * tw + tw / 2, y + h - 5]);
    pts.push([x + i * tw, y + h]);
  }
  return pts;
}

// Film sprocket holes along a strip
export function sprockets(g: EG, x: number, y: number, len: number, horizontal: boolean, colour: string, size = 5, gap = 11) {
  for (let d = 4; d < len - size; d += gap) {
    if (horizontal) rect(g, x + d, y, size, size * 0.8, colour);
    else rect(g, x, y + d, size * 0.8, size, colour);
  }
}

// Soft drop shadow for a card, then the card
export function card(g: EG, x: number, y: number, w: number, h: number, style: string, shadow = true) {
  const { ctx } = g;
  ctx.save();
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; }
  ctx.fillStyle = style;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function circle(g: EG, cx: number, cy: number, r: number, style: string) {
  const { ctx } = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = style; ctx.fill();
}

// Lines of text, one per row, each shrunk to fit its width
export function rows(g: EG, items: string[], x: number, y: number, w: number, lh: number, size: number, colour: string, o?: { align?: CanvasTextAlign; weight?: number; bullet?: string }) {
  items.forEach((s, i) => {
    if (o?.bullet) circle(g, x + 3, y + i * lh + lh / 2 - 3, 2.6, o.bullet);
    T2(g, s, x + (o?.bullet ? 11 : 0), y + i * lh, w - (o?.bullet ? 11 : 0), lh, size, colour, o?.align, o?.weight);
  });
}

export function T2(g: EG, text: string, x: number, y: number, w: number, h: number, size: number, colour: string, align: CanvasTextAlign = "left", weight = 600) {
  return textBox(g, text, x, y, w, h, { font: "body", max: size, min: 5, weight, colour, align, lh: 1.15 });
}

// ---------------------------------------------------------------------------
// Rich words: *asterisks* turn words into the highlight colour, \n starts a new line.
// The text shrinks until it fits the box.
// ---------------------------------------------------------------------------

type RO = { font?: "head" | "body"; max: number; min?: number; weight?: number; colour: string; hi?: string; align?: CanvasTextAlign; lh?: number; caps?: boolean; italic?: boolean };
type Wd = { t: string; hi: boolean };

export function rich(g: EG, key: string, x: number, y: number, w: number, h: number, o: RO) {
  const { ctx } = g;
  const raw = tx(g, key);
  const text = o.caps ? raw.toUpperCase() : raw;
  const fam = o.font === "body" ? g.body : g.head;
  const wt = o.weight ?? (o.font === "body" ? 600 : g.headW);
  const lhm = o.lh ?? (o.font === "body" ? 1.25 : 0.98);
  let on = false;
  const paras: Wd[][] = text.split("\n").map((p) => {
    const words: Wd[] = [];
    p.split("*").forEach((seg, i) => {
      if (i > 0) on = !on;
      seg.split(/\s+/).filter(Boolean).forEach((t) => words.push({ t, hi: on }));
    });
    return words;
  });
  const build = (s: number) => {
    ctx.font = `${o.italic ? "italic " : ""}${wt} ${s}px ${fam}`;
    const sp = ctx.measureText(" ").width;
    let widest = 0;
    const lines: { ws: Wd[]; w: number; blank: boolean }[] = [];
    for (const p of paras) {
      if (!p.length) { lines.push({ ws: [], w: 0, blank: true }); continue; }
      let cur: Wd[] = [], cw = 0;
      for (const wd of p) {
        const ww = ctx.measureText(wd.t).width;
        widest = Math.max(widest, ww);
        if (cur.length && cw + sp + ww > w) { lines.push({ ws: cur, w: cw, blank: false }); cur = []; cw = 0; }
        cw += (cur.length ? sp : 0) + ww;
        cur.push(wd);
      }
      lines.push({ ws: cur, w: cw, blank: false });
    }
    const height = lines.reduce((a, l) => a + s * lhm * (l.blank ? 0.55 : 1), 0);
    return { lines, sp, height, widest };
  };
  let s = o.max;
  let b = build(s);
  const min = o.min ?? 5;
  while ((b.height > h || b.widest > w) && s > min) { s -= 0.5; b = build(s); }
  ctx.save();
  ctx.font = `${o.italic ? "italic " : ""}${wt} ${s}px ${fam}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let yy = y;
  for (const l of b.lines) {
    if (!l.blank) {
      let xx = o.align === "center" ? x + (w - l.w) / 2 : o.align === "right" ? x + w - l.w : x;
      l.ws.forEach((wd, i) => {
        ctx.fillStyle = wd.hi && o.hi ? o.hi : o.colour;
        ctx.fillText(wd.t, xx, yy);
        xx += ctx.measureText(wd.t).width + (i < l.ws.length - 1 ? b.sp : 0);
      });
    }
    yy += s * lhm * (l.blank ? 0.55 : 1);
  }
  ctx.restore();
}

// Small barcode, for tickets
export function barcode(g: EG, x: number, y: number, w: number, h: number, colour: string, seed = 4) {
  const r = rand(seed);
  let xx = x;
  while (xx < x + w) {
    const bw = 0.8 + r() * 2.4;
    rect(g, xx, y, Math.min(bw, x + w - xx), h, colour);
    xx += bw + 0.8 + r() * 1.8;
  }
}
