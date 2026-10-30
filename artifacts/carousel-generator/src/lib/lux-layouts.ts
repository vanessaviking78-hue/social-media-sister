// LUX layouts, one per Canva page (the ten slides of the carousel). All coordinates are in a 400 x 500
// space (the Canva page size) and scaled up onto the 1080 x 1350 canvas by drawLux.
// Words: *asterisks* make a word the highlight colour (or italic on the question line of slide 8).
import {
  W, H, S, card, circle, crosshair, k, photoPoly, photoRect, poly, polyPath, rand, rect, rich, rgba, tone, tx, upright,
  type EG, type P,
} from "./empower-kit";
import { drawPhoto } from "./xmas-designs";

export type LuxLayout = (g: EG) => void;

const fill = (g: EG, key: "page" | "dark" | "accent" | "soft" | "ink" | "light") => rect(g, 0, 0, W, H, k(g, key));

// A little paper grain so the cream never looks flat
function grain(g: EG, seed: number, n = 700) {
  const r = rand(seed);
  g.ctx.save();
  for (let i = 0; i < n; i++) {
    g.ctx.fillStyle = `rgba(110,90,60,${0.015 + r() * 0.03})`;
    g.ctx.fillRect(r() * W, r() * H, 0.6 + r() * 1.2, 0.5 + r() * 0.9);
  }
  g.ctx.restore();
}

// Small spaced out capitals, the magazine labels
function label(g: EG, text: string, x: number, y: number, size: number, colour: string, o?: { align?: CanvasTextAlign; spacing?: number; weight?: number }) {
  const { ctx } = g;
  ctx.save();
  ctx.font = `${o?.weight ?? 600} ${size}px ${g.body}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${o?.spacing ?? size * 0.16}px`;
  ctx.fillStyle = colour;
  ctx.textBaseline = "top";
  ctx.textAlign = o?.align ?? "left";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

// "THE SKIN EDIT / 01"
const tag = (g: EG, n: number) => `${tx(g, "tag")} / ${String(n).padStart(2, "0")}`;

// Head words in the headline font, regular weight
type HO = { max: number; min?: number; colour: string; hi?: string; align?: CanvasTextAlign; lh?: number };
const head = (g: EG, x: number, y: number, w: number, h: number, o: HO) =>
  rich(g, "head", x, y, w, h, { max: o.max, min: o.min ?? 12, weight: 400, colour: o.colour, hi: o.hi, align: o.align, lh: o.lh ?? 1.04 });

// The tall, narrow headline of slides 5, 6 and 10: the same face squeezed across
function headCond(g: EG, x: number, y: number, w: number, h: number, o: HO, sx = 0.72) {
  g.ctx.save();
  g.ctx.translate(x, 0);
  g.ctx.scale(sx, 1);
  rich(g, "head", 0, y, w / sx, h, { max: o.max, min: o.min ?? 14, weight: 400, colour: o.colour, align: o.align, lh: o.lh ?? 0.98 });
  g.ctx.restore();
}

const sub = (g: EG, x: number, y: number, w: number, h: number, size: number, colour: string, align?: CanvasTextAlign) =>
  rich(g, "sub", x, y, w, h, { font: "body", max: size, min: 6, weight: 400, colour, align, lh: 1.32 });

function frame(g: EG, x: number, y: number, w: number, h: number, colour: string, lw = 0.9) {
  g.ctx.save();
  g.ctx.strokeStyle = colour;
  g.ctx.lineWidth = lw;
  g.ctx.strokeRect(x, y, w, h);
  g.ctx.restore();
}

// The circle with a cross through it
function target(g: EG, x: number, y: number, r: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  crosshair(g, x, y, r + 5, colour);
}

// A photo drawn inside any rotated, shifted box. Records the right drag area.
function photoAt(g: EG, cx: number, cy: number, w: number, h: number, deg: number, clip?: (ctx: EG["ctx"]) => void) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.beginPath();
  if (clip) clip(ctx); else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  drawPhoto(g, w, h);
  ctx.restore();
  g.slots.push({ i: 0, x: (cx - w / 2) * S, y: (cy - h / 2) * S, w: w * S, h: h * S, rot: deg });
}

export const LUX_LAYOUTS: LuxLayout[] = [
  // 1 When did you start looking at yourself so critically?
  (g) => {
    fill(g, "page");
    grain(g, 11);
    photoRect(g, 214, 8, 178, 484);
    // a soft diagonal of light across the cream
    const lg = g.ctx.createLinearGradient(0, 0, 150, 190);
    lg.addColorStop(0, "rgba(255,255,255,0.55)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    poly(g, [[0, 0], [150, 0], [0, 210]], lg as unknown as string);
    frame(g, 8, 8, 384, 484, rgba(g.p.ink, 0.35));
    target(g, 200, 8, 3.5, rgba(g.p.ink, 0.7));
    target(g, 8, 252, 3.5, rgba(g.p.ink, 0.7));
    target(g, 392, 252, 3.5, rgba(g.p.ink, 0.7));
    target(g, 200, 492, 3.5, rgba(g.p.ink, 0.7));
    head(g, 32, 120, 176, 230, { max: 35, colour: k(g, "ink") });
    rect(g, 33, 354, 109, 1.2, k(g, "accent"));
    sub(g, 33, 372, 150, 40, 9.5, k(g, "ink"));
    label(g, tag(g, 1), 32, 453, 7.5, k(g, "ink"), { weight: 800, spacing: 1.6 });
  },

  // 2 You deserve to be in the photograph (film frame)
  (g) => {
    fill(g, "page");
    grain(g, 12);
    // paper folds
    rect(g, 0, 249, W, 1, "rgba(0,0,0,0.07)");
    rect(g, 0, 250, W, 1, "rgba(255,255,255,0.5)");
    rect(g, 199, 0, 1, H, "rgba(0,0,0,0.05)");
    label(g, tag(g, 2), 200, 28, 7, k(g, "ink"), { align: "center", spacing: 1.2 });
    crosshair(g, 380, 20, 8, rgba(g.p.ink, 0.7));
    card(g, 75, 58, 250, 280, k(g, "soft"), true);
    photoRect(g, 90, 74, 218, 254);
    // film edge printing
    const { ctx } = g;
    ctx.save();
    ctx.fillStyle = rgba(g.p.ink, 0.75);
    upright(g, tx(g, "film"), 87, 198, 6.2, rgba(g.p.ink, 0.8), 700);
    upright(g, tx(g, "film"), 321, 224, 6.2, rgba(g.p.ink, 0.8), 700);
    upright(g, "43", 87, 90, 5.6, rgba(g.p.ink, 0.8), 700);
    ctx.restore();
    head(g, 30, 350, 340, 92, { max: 38, colour: k(g, "ink"), align: "center", lh: 1.02 });
    sub(g, 30, 452, 340, 22, 9.5, k(g, "ink"), "center");
  },

  // 3 A good consultation is allowed to end with no treatment
  (g) => {
    fill(g, "page");
    grain(g, 13);
    photoRect(g, 293, 32, 91, 442);
    rect(g, 289, 8, 1.1, 484, rgba(g.p.ink, 0.8));
    rect(g, 36, 38, 1, 430, rgba(g.p.ink, 0.75));
    rect(g, 0, 474, W, 26, tone(g, "page", -0.06));
    upright(g, `${tx(g, "tag")} / 03`.toUpperCase(), 20, 196, 6.6, k(g, "ink"), 700);
    head(g, 62, 88, 224, 215, { max: 36, colour: k(g, "ink"), lh: 1.04 });
    rect(g, 62, 318, 42, 1.2, k(g, "ink"));
    sub(g, 62, 340, 160, 40, 10, k(g, "ink"));
    frame(g, 52, 427, 214, 36, rgba(g.p.ink, 0.8), 1);
    rich(g, "box", 58, 433, 202, 26, { font: "body", max: 6.8, min: 5, weight: 700, colour: k(g, "ink"), caps: true, lh: 1.5 });
  },

  // 4 Your life is happening now
  (g) => {
    fill(g, "page");
    grain(g, 14);
    photoRect(g, 55, 0, 337, 272);
    // dark block with a rough edge
    const r = rand(44);
    const edge: P[] = [];
    for (let x = 3; x <= 393; x += 6) edge.push([x, 275 + (r() - 0.5) * 3]);
    poly(g, [...edge, [393, 497], [3, 497]], k(g, "dark"), { shadow: false });
    crosshair(g, 28, 30, 9, rgba(g.p.ink, 0.75));
    target(g, 28, 30, 5, rgba(g.p.ink, 0.75));
    upright(g, tag(g, 4).toUpperCase(), 24, 232, 6.8, k(g, "ink"), 700);
    head(g, 44, 288, 340, 112, { max: 30, colour: k(g, "light"), lh: 1.05 });
    rect(g, 45, 427, 110, 1.1, k(g, "accent"));
    sub(g, 45, 440, 200, 40, 9.5, k(g, "light"));
  },

  // 5 You see one detail. Your practitioner sees the whole picture.
  (g) => {
    fill(g, "soft");
    photoRect(g, 232, 0, 168, H);
    rect(g, 12, 0, 1, H, rgba(g.p.ink, 0.28));
    rect(g, 0, 46, 232, 1, rgba(g.p.ink, 0.35));
    rect(g, 0, 480, 232, 1, rgba(g.p.ink, 0.35));
    label(g, tag(g, 5), 26, 28, 7, k(g, "ink"), { spacing: 1 });
    headCond(g, 26, 118, 200, 250, { max: 40, colour: k(g, "ink"), lh: 0.98 }, 0.74);
    rect(g, 26, 391, 114, 1.1, k(g, "ink"));
    sub(g, 26, 404, 190, 34, 9, k(g, "ink"));
    label(g, tx(g, "foot"), 26, 464, 6, k(g, "ink"), { spacing: 1 });
  },

  // 6 What if the question isn't how to look younger?
  (g) => {
    fill(g, "page");
    grain(g, 16);
    label(g, tag(g, 6), 20, 20, 7, k(g, "ink"), { spacing: 1 });
    rect(g, 20, 40, 360, 1, rgba(g.p.ink, 0.35));
    headCond(g, 20, 78, 210, 235, { max: 44, colour: k(g, "ink"), lh: 0.98 }, 0.7);
    // photo with a hard shadow
    rect(g, 231, 139, 162, 254, "rgba(0,0,0,0.28)");
    photoRect(g, 226, 134, 162, 254);
    sub(g, 20, 424, 215, 44, 11, k(g, "ink"));
  },

  // 7 This face has been there for all of it
  (g) => {
    fill(g, "page");
    grain(g, 17);
    photoRect(g, 38, 26, 324, 346);
    frame(g, 8, 8, 384, 484, rgba(g.p.ink, 0.28));
    crosshair(g, 22, 22, 6, rgba(g.p.ink, 0.8));
    rect(g, 8, 331, 238, 146, k(g, "dark"));
    head(g, 34, 345, 200, 118, { max: 29, colour: k(g, "light"), lh: 1.05 });
    sub(g, 258, 396, 120, 44, 9.5, k(g, "ink"));
    rect(g, 258, 449, 114, 1, rgba(g.p.ink, 0.5));
    label(g, tag(g, 7), 260, 458, 6, k(g, "ink"), { spacing: 1 });
  },

  // 8 Before we discuss what could change, tell me what you want to keep
  (g) => {
    fill(g, "page");
    grain(g, 18);
    frame(g, 10, 10, 380, 480, rgba(g.p.ink, 0.5));
    rect(g, 199.5, 8, 1, 38, rgba(g.p.ink, 0.6));
    rect(g, 140, 42, 120, 1, rgba(g.p.ink, 0.45));
    label(g, tag(g, 8), 200, 31, 6.4, k(g, "ink"), { align: "center", spacing: 1 });
    head(g, 40, 62, 320, 146, { max: 36, colour: k(g, "ink"), align: "center", lh: 1.03 });
    // taped corner and an L of ink on the left
    rect(g, 36, 322, 86, 132, rgba(g.p.ink, 0.07));
    rect(g, 46, 318, 1, 144, rgba(g.p.ink, 0.5));
    rect(g, 32, 441, 94, 1, rgba(g.p.ink, 0.5));
    // the photograph, a little crooked, on a cream card
    const { ctx } = g;
    ctx.save();
    ctx.translate(220, 328);
    ctx.rotate((-0.4 * Math.PI) / 180);
    card(g, -152, -115, 304, 230, "#f4efe3", true);
    ctx.restore();
    photoAt(g, 221, 326, 286, 208, -0.4);
    // the question, with the one word in italics
    const q = tx(g, "sub");
    const parts = q.split("*");
    ctx.save();
    ctx.textBaseline = "top";
    ctx.fillStyle = k(g, "ink");
    const size = 9.5;
    const meas = parts.map((p, i) => { ctx.font = `${i % 2 ? "italic " : ""}400 ${size}px ${g.body}`; return ctx.measureText(p).width; });
    let x = 200 - meas.reduce((a, b) => a + b, 0) / 2;
    ctx.textAlign = "left";
    parts.forEach((p, i) => { ctx.font = `${i % 2 ? "italic " : ""}400 ${size}px ${g.body}`; ctx.fillText(p, x, 457); x += meas[i]; });
    ctx.restore();
  },

  // 9 You were never meant to look like somebody else's photograph
  (g) => {
    fill(g, "page");
    grain(g, 19);
    // taupe card, a touch crooked
    const { ctx } = g;
    ctx.save();
    ctx.translate(293, 240);
    ctx.rotate((1.2 * Math.PI) / 180);
    card(g, -102, -202, 204, 404, k(g, "soft"), true);
    ctx.restore();
    // the print: white border, tilted, bleeding off the left edge
    ctx.save();
    ctx.translate(98, 215);
    ctx.rotate((-3 * Math.PI) / 180);
    card(g, -128, -204, 256, 408, "#f6f1e6", true);
    ctx.restore();
    photoAt(g, 98, 215, 240, 390, -3);
    // headline sloping up to the right
    ctx.save();
    ctx.translate(300, 215);
    ctx.rotate((-9 * Math.PI) / 180);
    head(g, -92, -108, 184, 214, { max: 31, colour: k(g, "ink"), lh: 1.08 });
    rect(g, -42, 126, 36, 1.2, k(g, "ink"));
    ctx.restore();
    sub(g, 254, 366, 124, 44, 8.6, k(g, "ink"));
    rect(g, 22, 455, 358, 1, rgba(g.p.ink, 0.45));
    label(g, tag(g, 9), 22, 466, 6.6, k(g, "ink"), { spacing: 1 });
  },

  // 10 What makes you feel most like yourself?
  (g) => {
    fill(g, "page");
    grain(g, 20);
    frame(g, 10, 10, 380, 480, rgba(g.p.ink, 0.65));
    target(g, 200, 30, 6, rgba(g.p.ink, 0.8));
    // the oval portrait
    const { ctx } = g;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.ellipse(200, 170, 75, 105, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d0c2"; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(200, 170, 75, 105, 0, 0, Math.PI * 2); ctx.clip();
    ctx.translate(200, 170);
    drawPhoto(g, 150, 210);
    ctx.restore();
    g.slots.push({ i: 0, x: 125 * S, y: 65 * S, w: 150 * S, h: 210 * S, rot: 0 });
    headCond(g, 40, 288, 320, 112, { max: 50, colour: k(g, "ink"), align: "center", lh: 1.0 }, 0.7);
    sub(g, 40, 414, 320, 26, 12.5, k(g, "ink"), "center");
    label(g, tag(g, 10), 200, 463, 6.4, k(g, "ink"), { align: "center", spacing: 1.2 });
  },
];

// keeps the compiler honest about helpers used in some layouts only
void circle; void polyPath; void photoPoly; void H;
