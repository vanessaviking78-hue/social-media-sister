// The new slide 1 cover templates, drawn on canvas like the About me ones so the clinic's photos, colours and words drop straight in.
// Every piece of text or shape is drawn through piece(), so it can be dragged anywhere and sized on its own.
// Two fonts: a heading font (the client's own) and a subheading font (Playfair Display unless changed).
import { ABOUT_FONTS, aboutFontById, loadAboutFonts, type AboutFont, type AboutView } from "./about-designs";
import { paintFor, isHexColour, metalOfValue } from "./metal-colours";

const W = 1080;
const H = 1350;

const hx = (h: string) => { const v = parseInt((isHexColour(h) ? h : "#d6006f").replace("#", "").padEnd(6, "0").slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (h: string, to: number, t: number) => "#" + hx(h).map((x) => Math.round(x + (to - x) * t).toString(16).padStart(2, "0")).join("");
const lumOf = (h: string) => { const [r, g, b] = hx(h).map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const flat = (v: string | undefined, fb: string) => (isHexColour(v) ? v : metalOfValue(v)?.stops[1] ?? fb);
const rgba = (h: string, a: number) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };

export type CoverLayout =
  | "curved3" | "stack3" | "pills" | "scatter" | "scatter8" | "stack4" | "boxes" | "strip" | "pinknote" | "collage" | "card"
  | "circle" | "tag" | "notebook" | "fade" | "labels" | "grid" | "notes" | "paperclip" | "tape" | "bold" | "clip" | "tag2";

/** How each template wants its words, so the builder can offer the right boxes. */
export type CoverNeeds = { lines?: number; sub?: boolean; body?: boolean; subs?: number[]; points?: boolean; name?: boolean; quote?: boolean };
export type CoverInfo = { id: CoverLayout; n: number; label: string; needs: CoverNeeds; statik?: boolean; cutout?: boolean; photos: number; deco?: string };
export const COVER_LAYOUTS: CoverInfo[] = [
  { id: "curved3", n: 1, label: "Curved heading, three parts", needs: { lines: 3 }, photos: 1 },
  { id: "stack3", n: 2, label: "Three stacked lines, faded middle", needs: { lines: 3, sub: true }, photos: 1 },
  { id: "pills", n: 3, label: "About me with pills", needs: { lines: 1, subs: [4, 5] }, photos: 1 },
  { id: "scatter", n: 4, label: "Heading, count and scattered subtitles", needs: { lines: 1, sub: true, subs: [5, 7, 9] }, photos: 1 },
  { id: "scatter8", n: 5, label: "One heading, up to 8 subtitles", needs: { lines: 1, subs: [8] }, photos: 1 },
  { id: "stack4", n: 6, label: "Hook over four lines", needs: { lines: 4 }, photos: 1 },
  { id: "boxes", n: 7, label: "Heading and three boxes", needs: { lines: 1, points: true }, photos: 1 },
  { id: "strip", n: 8, label: "Torn strip and cut out clinician", needs: { lines: 1, sub: true, name: true }, cutout: true, photos: 1 },
  { id: "pinknote", n: 9, label: "Treatment with a pink note", needs: { lines: 1, sub: true }, photos: 1, deco: "Doodles" },
  { id: "collage", n: 10, label: "Four photo collage", needs: { lines: 1 }, photos: 4, deco: "Stars" },
  { id: "card", n: 11, label: "Cream card with a clip", needs: { lines: 1, sub: true }, photos: 1 },
  { id: "circle", n: 12, label: "Circle photo of the clinician", needs: { lines: 1, sub: true }, cutout: true, photos: 1 },
  { id: "tag", n: 13, label: "Gift tag with a quote", needs: { quote: true }, statik: true, photos: 0 },
  { id: "notebook", n: 14, label: "Notebook page", needs: { lines: 1, body: true }, statik: true, photos: 1 },
  { id: "fade", n: 15, label: "Photo fading into colour", needs: { lines: 1, sub: true, body: true }, statik: true, photos: 1 },
  { id: "labels", n: 16, label: "Three labels", needs: { lines: 3 }, photos: 1 },
  { id: "grid", n: 17, label: "Grid with three photos", needs: { lines: 1, sub: true }, photos: 3 },
  { id: "notes", n: 18, label: "Notes box on stripes", needs: { lines: 1 }, photos: 0 },
  { id: "paperclip", n: 19, label: "Notepaper with a clip", needs: { lines: 1 }, photos: 1, deco: "Clip, strip and stars" },
  { id: "tape", n: 20, label: "Taped note on a blurred photo", needs: { lines: 1, body: true }, photos: 1 },
  { id: "bold", n: 21, label: "Bold heading and subheading", needs: { lines: 1, sub: true }, photos: 1 },
  { id: "clip", n: 22, label: "Paper with a silver clip", needs: { quote: true }, statik: true, photos: 0 },
  { id: "tag2", n: 23, label: "Gift tag with heading and subheading", needs: { lines: 1, sub: true }, photos: 0 },
];
export const coverInfo = (id: CoverLayout) => COVER_LAYOUTS.find((l) => l.id === id)!;

export type CoverColours = { main: string; accent: string; bg?: string; head?: string; text?: string; box?: string };

// ---------- fonts ----------
const EXTRA: AboutFont[] = [
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", weight: 400, group: "Google fonts" },
  { id: "playfair-i", label: "Playfair Display italic", family: "Playfair Display", weight: 400, italic: true, group: "Google fonts" },
  { id: "roboto", label: "Roboto", family: "Roboto", weight: 400, group: "Google fonts" },
  { id: "roboto-i", label: "Roboto italic", family: "Roboto", weight: 400, italic: true, group: "Google fonts" },
  { id: "special", label: "Special Elite (typewriter)", family: "Special Elite", weight: 400, group: "Google fonts" },
  { id: "inter", label: "Inter", family: "Inter", weight: 600, group: "Google fonts" },
  { id: "instrument", label: "Instrument Serif", family: "Instrument Serif", weight: 400, group: "Google fonts" },
];
export const COVER_FONTS: AboutFont[] = [...EXTRA, ...ABOUT_FONTS.filter((f) => !EXTRA.some((e) => e.id === f.id))];
export const coverFont = (id: string | undefined, fb: string): AboutFont => COVER_FONTS.find((f) => f.id === id) ?? COVER_FONTS.find((f) => f.id === fb) ?? aboutFontById("gilda", "gilda");
const fcss = (f: AboutFont, size: number) => `${f.italic ? "italic " : ""}${f.weight ?? 400} ${size}px "${f.family}", sans-serif`;
let cssAdded = false;
async function loadFonts(fonts: AboutFont[]) {
  if (!cssAdded && typeof document !== "undefined") {
    cssAdded = true;
    const l = document.createElement("link");
    l.id = "cover-fonts-v2"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&family=Special+Elite&family=Inter:wght@400;600;700&family=Instrument+Serif:ital@0;1&display=swap";
    document.head.appendChild(l);
  }
  await loadAboutFonts(fonts);
  await Promise.all(fonts.map((f) => document.fonts.load(fcss(f, 40)).catch(() => []))).catch(() => undefined);
}

// ---------- options ----------
export type CoverMove = Record<string, [number, number]>;
export type CoverOptions = {
  layout: CoverLayout;
  /** The photos to draw, first one is the main picture. */
  photos: ImageBitmap[];
  /** The clinician cut out of their photo, for the strip and circle templates. */
  cutout?: ImageBitmap | null;
  colours: CoverColours;
  /** The heading, split into the lines this template wants. */
  lines: string[];
  sub?: string;
  body?: string;
  subs?: string[];
  points?: { t: string; b: string }[];
  name?: string;
  fonts?: { head?: string; body?: string };
  move?: CoverMove;
  /** Size of each piece, 1 is normal. */
  size?: Record<string, number>;
  /** Zoom and pan for each photo, in the order the template uses them. */
  views?: AboutView[];
  /** 0 to 1: how faded the middle line, the photo or the page overlay is. */
  fade?: number;
  blur?: number;
  deco?: boolean;
  mono?: boolean;
  /** Grid template: what each of the nine squares holds, p for a photo, c for a colour, t for the text. */
  cells?: string[];
};

type C = { ctx: CanvasRenderingContext2D; o: CoverOptions; hf: AboutFont; bf: AboutFont; sf: AboutFont };

const newCanvas = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return { c, ctx: c.getContext("2d")! }; };

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number, v?: AboutView, focusY = 0.35) {
  const s = Math.max(w / img.width, h / img.height) * Math.max(1, v?.z ?? 1);
  const dw = img.width * s, dh = img.height * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2 + (v?.x ?? 0) * Math.max(0, dw - w) / 2, y - (dh - h) * focusY + (v?.y ?? 0) * Math.max(0, dh - h) / 2, dw, dh);
  ctx.restore();
}
const photoAt = (c: C, i: number, x: number, y: number, w: number, h: number, focusY = 0.35) => {
  const p = c.o.photos[i % Math.max(1, c.o.photos.length)];
  if (p) cover(c.ctx, p, x, y, w, h, c.o.views?.[i], focusY);
  else { c.ctx.fillStyle = mix(flat(c.o.colours.main, "#d6006f"), 255, 0.8); c.ctx.fillRect(x, y, w, h); }
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/** A movable and sizable piece: everything inside fn is drawn around (0, 0), which sits at (cx, cy). */
function piece(c: C, key: string, cx: number, cy: number, fn: () => void, rot = 0) {
  const m = c.o.move?.[key] ?? [0, 0];
  const k = c.o.size?.[key] ?? 1;
  c.ctx.save();
  c.ctx.translate(cx + m[0], cy + m[1]);
  if (rot) c.ctx.rotate(rot);
  c.ctx.scale(k, k);
  fn();
  c.ctx.restore();
}

type TextOpt = { align?: CanvasTextAlign; maxW?: number; wrapW?: number; lh?: number; alpha?: number; rot?: number; upper?: boolean; font?: AboutFont; italic?: boolean; spacing?: number };
/** Draws text as a piece. Returns the height drawn. Shrinks to fit maxW; wraps to wrapW. */
function put(c: C, key: string, text: string, x: number, y: number, size: number, fill: string, o: TextOpt = {}): number {
  const { ctx } = c;
  const f0 = o.font ?? c.hf;
  const f = o.italic ? { ...f0, italic: true } : f0;
  const t = o.upper ? text.toUpperCase() : text;
  let h = 0;
  piece(c, key, x, y, () => {
    let s = size;
    ctx.textBaseline = "alphabetic"; ctx.textAlign = o.align ?? "center";
    if (o.maxW && !o.wrapW) { ctx.font = fcss(f, s); const w = ctx.measureText(t).width; if (w > o.maxW) s = Math.max(18, Math.floor(s * (o.maxW / w))); }
    ctx.font = fcss(f, s);
    const lines = o.wrapW ? wrapLines(ctx, t, o.wrapW) : [t];
    const lh = o.lh ?? s * 1.15;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.spacing) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${o.spacing}px`;
    ctx.fillStyle = paintFor(ctx, fill, -300, -s, 600, lines.length * lh + s);
    lines.forEach((ln, i) => ctx.fillText(ln, 0, i * lh));
    h = lines.length * lh;
  }, o.rot ?? 0);
  return h;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pts = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = rot + (i * Math.PI) / pts; const rad = i % 2 ? r * inner : r; ctx[i ? "lineTo" : "moveTo"](cx + rad * Math.cos(a), cy + rad * Math.sin(a)); }
  ctx.closePath();
}
function shade(ctx: CanvasRenderingContext2D, a = 0.28) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.5})`); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, centreAngle: number, spacing = 0) {
  const chars = [...text]; const ws = chars.map((ch) => ctx.measureText(ch).width + spacing); const total = ws.reduce((a, b) => a + b, 0);
  let a = centreAngle - total / r / 2; ctx.textAlign = "center";
  chars.forEach((ch, i) => { const ang = a + ws[i] / r / 2; ctx.save(); ctx.translate(cx + r * Math.cos(ang), cy + r * Math.sin(ang)); ctx.rotate(ang + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); a += ws[i] / r; });
}
/** A cut out drawn with a white outline round it. */
function outlined(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, x: number, y: number, w: number, h: number, ow = 12) {
  const sil = document.createElement("canvas"); sil.width = Math.ceil(w); sil.height = Math.ceil(h);
  const sc = sil.getContext("2d")!; sc.drawImage(bmp, 0, 0, w, h); sc.globalCompositeOperation = "source-in"; sc.fillStyle = "#fff"; sc.fillRect(0, 0, w, h);
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; ctx.drawImage(sil, x + Math.cos(a) * ow, y + Math.sin(a) * ow, w, h); }
  ctx.drawImage(bmp, x, y, w, h);
}
const torn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 0; i <= 40; i++) ctx.lineTo(x + (w * i) / 40, y + Math.sin(i * 12.9898) * 4);
  for (let i = 0; i <= 8; i++) ctx.lineTo(x + w + Math.sin(i * 7.3) * 4, y + (h * i) / 8);
  for (let i = 40; i >= 0; i--) ctx.lineTo(x + (w * i) / 40, y + h + Math.sin(i * 4.1) * 4);
  for (let i = 8; i >= 0; i--) ctx.lineTo(x + Math.sin(i * 9.7) * 4, y + (h * i) / 8);
  ctx.closePath();
};

/** Splits one phrase into n lines of near equal length without breaking words. */
export function splitIntoLines(text: string, n: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (n <= 1 || words.length <= 1) return [text.trim()];
  const total = text.trim().length; const out: string[] = []; let cur = "";
  for (const w of words) {
    const left = n - out.length - 1;
    if (cur && left > 0 && (cur + " " + w).length > total / n + 3) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  while (out.length < n) out.push("");
  return out.slice(0, n);
}

// ---------- the templates ----------
const brandMain = (o: CoverOptions) => flat(o.colours.main, "#d6006f");
const brandAcc = (o: CoverOptions) => flat(o.colours.accent, "#111111");
const headCol = (o: CoverOptions, fb: string) => o.colours.head || fb;
const textCol = (o: CoverOptions, fb: string) => o.colours.text || fb;

function drawCurved3(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.3);
  const hc = headCol(o, "#ffffff");
  const top = o.lines[0] ?? ""; const l1 = o.lines[1] ?? ""; const l2 = o.lines[2] ?? "";
  piece(c, "l0", W / 2, 360, () => { ctx.font = fcss(c.sf, 44); ctx.fillStyle = paintFor(ctx, textCol(o, "#ffffff"), -400, -400, 800, 400); ctx.textBaseline = "alphabetic"; arcText(ctx, top.toLowerCase(), 0, 560, 560, -Math.PI / 2, 3); });
  put(c, "l1", l1, W / 2, 650, 190, hc, { maxW: 940, upper: true });
  put(c, "l2", l2, W / 2, 850, 190, hc, { maxW: 940, upper: true });
}

function drawStack3(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.12);
  const hc = headCol(o, "#fff8e6");
  const f = o.fade ?? 0.45;
  const ls = [o.lines[0] ?? "", o.lines[1] ?? "", o.lines[2] ?? ""];
  put(c, "l0", ls[0], 70, 250, 150, hc, { align: "left", maxW: 940 });
  put(c, "l1", ls[1], 70, 410, 150, hc, { align: "left", maxW: 940, alpha: f });
  put(c, "l2", ls[2], 1010, 570, 150, hc, { align: "right", maxW: 940 });
  if (o.sub) put(c, "sub", o.sub, 840, 800, 52, textCol(o, "#ffffff"), { font: c.sf, rot: -0.12 });
  void ctx;
}

function drawPills(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.18);
  put(c, "head", (o.lines[0] || "about me").toLowerCase(), W / 2, 280, 250, headCol(o, mix(brandMain(o), 255, 0.72)), { maxW: 980 });
  const pills = (o.subs ?? []).filter((s) => s.trim()).slice(0, 5);
  const ys = [455, 640, 825, 1010, 1195]; const xs = [60, 90, 70, 170, 100];
  pills.forEach((t, i) => {
    piece(c, `pill${i}`, 0, 0, () => {
      ctx.font = fcss(c.sf, 44); const w = Math.min(ctx.measureText(t).width + 100, 960);
      const x = xs[i % 5]; const y = ys[i];
      ctx.fillStyle = paintFor(ctx, o.colours.box || mix(brandMain(o), 255, 0.72), x, y, w, 90); rr(ctx, x, y, w, 92, 46); ctx.fill();
      ctx.fillStyle = textCol(o, "#222222"); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      let s = 44; while (ctx.measureText(t).width > w - 80 && s > 24) { s -= 2; ctx.font = fcss(c.sf, s); }
      ctx.fillText(t, x + 50, y + 48);
    });
  });
}

const SCATTER: Record<number, [number, number][]> = {
  5: [[260, 470], [800, 560], [260, 760], [800, 880], [420, 1100]],
  7: [[260, 440], [800, 500], [260, 680], [800, 760], [280, 930], [800, 1020], [440, 1180]],
  9: [[800, 470], [260, 540], [350, 690], [800, 760], [260, 860], [780, 930], [440, 1010], [280, 1160], [800, 1110]],
  8: [[260, 250], [800, 330], [260, 440], [700, 520], [260, 880], [780, 930], [440, 1100], [800, 1230]],
};
function drawScatter(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.3);
  const subs = (o.subs ?? []).filter((s) => s.trim());
  if (c.o.layout === "scatter") {
    put(c, "head", o.lines[0] ?? "", W / 2, 190, 140, headCol(o, mix(brandMain(o), 255, 0.8)), { maxW: 960 });
    put(c, "sub", o.sub ?? "", W / 2, 320, 84, "#ffffff", { font: c.sf, maxW: 960 });
  } else {
    put(c, "head", o.lines[0] ?? "", W / 2, 700, 190, headCol(o, "#ffffff"), { maxW: 960 });
  }
  const pos = SCATTER[c.o.layout === "scatter8" ? 8 : subs.length <= 5 ? 5 : subs.length <= 7 ? 7 : 9];
  subs.slice(0, pos.length).forEach((t, i) => put(c, `s${i}`, t, pos[i][0], pos[i][1], 42, textCol(o, "#ffffff"), { font: c.sf, maxW: 400, wrapW: 400, lh: 48 }));
}

function drawStack4(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.2);
  const hc = headCol(o, "#fff3d6");
  const ys = [330, 520, 710, 900]; const xs = [60, 300, 120, 340];
  ys.forEach((y, i) => put(c, `l${i}`, o.lines[i] ?? "", xs[i], y, 140, hc, { align: "left", maxW: 1000 - xs[i] }));
  void ctx;
}

function drawBoxes(c: C) {
  const { ctx, o } = c;
  if (o.photos[0]) { photoAt(c, 0, 0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = o.colours.bg || mix(brandMain(o), 255, 0.6); ctx.fillRect(0, 0, W, H); }
  put(c, "head", o.lines[0] ?? "", W / 2, 200, 92, headCol(o, mix(brandMain(o), 255, 0.85)), { wrapW: 900, lh: 100 });
  const pts = (o.points ?? []).slice(0, 3);
  pts.forEach((p, i) => {
    const y = 470 + i * 270;
    piece(c, `box${i}`, W / 2, y + 100, () => {
      ctx.fillStyle = paintFor(ctx, o.colours.box || "#fff3c4", -440, -100, 880, 200); rr(ctx, -440, -100, 880, 210, 32); ctx.fill();
      ctx.strokeStyle = "#222"; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#222";
      ctx.font = fcss({ ...c.bf, weight: 700 }, 46); let s = 46; while (ctx.measureText(p.t).width > 800 && s > 24) { s -= 2; ctx.font = fcss({ ...c.bf, weight: 700 }, s); }
      ctx.fillText(p.t, 0, -20);
      ctx.font = fcss(c.bf, 36); const ls = wrapLines(ctx, p.b, 800).slice(0, 2); ls.forEach((ln, j) => ctx.fillText(ln, 0, 40 + j * 44));
    });
  });
}

function drawStrip(c: C) {
  const { ctx, o } = c;
  const bg = o.colours.bg || "#0d0d0d";
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = o.fade ?? 0.45; photoAt(c, 0, 0, 0, W, H); ctx.restore();
  const acc = o.colours.box || "#f4efe3";
  piece(c, "strip", W / 2, 470, () => { ctx.fillStyle = paintFor(ctx, acc, -460, -80, 920, 200); torn(ctx, -460, -90, 920, 190); ctx.fill(); ctx.fillStyle = textCol(o, "#222222"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = fcss(c.sf, 58); let s = 58; while (ctx.measureText(o.sub ?? "").width > 840 && s > 26) { s -= 2; ctx.font = fcss(c.sf, s); } ctx.fillText(o.sub ?? "", 0, 4); });
  put(c, "head", o.lines[0] ?? "", W / 2, 250, 80, headCol(o, "#ffffff"), { wrapW: 940, lh: 88 });
  const cut = o.cutout;
  piece(c, "photo", W / 2, 940, () => {
    if (cut) { const h = 760; const w = (cut.width / cut.height) * h; outlined(ctx, cut, -w / 2, -h / 2 + 90, w, h, 14); }
    else if (o.photos[0]) { ctx.save(); rr(ctx, -300, -330, 600, 760, 30); ctx.clip(); cover(ctx, o.photos[0], -300, -330, 600, 760, o.views?.[0]); ctx.restore(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 12; rr(ctx, -300, -330, 600, 760, 30); ctx.stroke(); }
  });
  if (o.name) put(c, "name", o.name, 830, 1210, 76, headCol(o, "#ffffff"), { rot: -0.1 });
}

function drawPinknote(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H); shade(ctx, 0.18);
  put(c, "head", o.lines[0] ?? "", W / 2, 640, 230, headCol(o, "#ffffff"), { maxW: 980 });
  const note = o.colours.box || mix(brandMain(o), 255, 0.7);
  piece(c, "note", 320, 930, () => {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(-250 + 8, -190 + 12, 500, 380);
    ctx.fillStyle = paintFor(ctx, note, -250, -190, 500, 380); ctx.fillRect(-250, -190, 500, 380);
    ctx.fillStyle = paintFor(ctx, mix(brandMain(o), 0, 0.12), -90, -230, 180, 60); ctx.save(); ctx.translate(0, -190); ctx.rotate(0.03); ctx.fillRect(-90, -30, 180, 60); ctx.restore();
    ctx.fillStyle = textCol(o, "#222222"); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.font = fcss(c.sf, 42); let s = 42; let ls = wrapLines(ctx, o.sub ?? "", 440);
    while (ls.length * s * 1.25 > 270 && s > 22) { s -= 2; ctx.font = fcss(c.sf, s); ls = wrapLines(ctx, o.sub ?? "", 440); }
    ls.forEach((ln, i) => ctx.fillText(ln, -220, -90 + i * s * 1.25));
  });
  if (o.deco !== false) {
    piece(c, "doodle", 0, 0, () => {
      const dc = mix(brandMain(o), 255, 0.45); ctx.strokeStyle = dc; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(730, 890); ctx.lineTo(730, 960); ctx.moveTo(790, 890); ctx.lineTo(790, 960); ctx.stroke();
      ctx.beginPath(); ctx.arc(730, 1000, 9, 0, 7); ctx.arc(790, 1000, 9, 0, 7); ctx.stroke();
      for (const [x, y] of [[140, 790], [190, 840]]) { star(ctx, x, y, 28, 4, 0.2); ctx.fillStyle = dc; ctx.fill(); }
    });
  }
}

function drawCollage(c: C) {
  const { ctx, o } = c;
  photoAt(c, 0, 0, 0, W / 2, H / 2); photoAt(c, 1, W / 2, 0, W / 2, H / 2); photoAt(c, 2, 0, H / 2, W / 2, H / 2); photoAt(c, 3, W / 2, H / 2, W / 2, H / 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(0, 0, W, H);
  if (o.deco !== false) {
    const sc = brandMain(o);
    piece(c, "stars", 0, 0, () => { for (const [x, y, r, op] of [[260, 400, 120, 0.9], [730, 450, 90, 0.9], [380, 1000, 150, 0.95], [660, 760, 70, 0.9]] as number[][]) { ctx.globalAlpha = op; star(ctx, x, y, r, 5, 0.42); ctx.fillStyle = paintFor(ctx, sc, x - r, y - r, r * 2, r * 2); ctx.fill(); } ctx.globalAlpha = 1; });
  }
  put(c, "head", o.lines[0] ?? "", W / 2, 700, 170, headCol(o, "#111111"), { maxW: 960 });
}

function drawCard(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H);
  piece(c, "card", 400, 760, () => {
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(-340 + 8, -250 + 12, 700, 500);
    ctx.fillStyle = "#fbf9f2"; ctx.fillRect(-340, -250, 700, 500);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  });
  const hh = put(c, "head", o.lines[0] ?? "", 90, 690, 84, headCol(o, "#111111"), { align: "left", wrapW: 560, lh: 92 });
  if (o.sub) put(c, "sub", o.sub, 90, 690 + hh + 30, 44, textCol(o, "#333333"), { align: "left", font: c.sf, wrapW: 560, lh: 52 });
  const clip = brandMain(o);
  piece(c, "clip", 140, 520, () => { ctx.strokeStyle = paintFor(ctx, clip, -20, -60, 40, 120); ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-14, 40); ctx.lineTo(-14, -40); ctx.arc(0, -40, 14, Math.PI, 0); ctx.lineTo(14, 60); ctx.arc(0, 60, 14, 0, Math.PI); ctx.lineTo(-14, 10); ctx.stroke(); }, 0.12);
}

function drawCircle(c: C) {
  const { ctx, o } = c;
  ctx.fillStyle = paintFor(ctx, o.colours.bg || mix(brandMain(o), 0, 0.78), 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  piece(c, "circle", W / 2, 560, () => {
    ctx.fillStyle = paintFor(ctx, o.colours.box || brandMain(o), -330, -330, 660, 660); ctx.beginPath(); ctx.arc(0, 0, 330, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 330, 0, Math.PI * 2); ctx.clip();
    if (o.cutout) { const h = 760; const w = (o.cutout.width / o.cutout.height) * h; ctx.drawImage(o.cutout, -w / 2, -330 + 40, w, h); }
    else if (o.photos[0]) cover(ctx, o.photos[0], -330, -330, 660, 660, o.views?.[0]);
    ctx.restore();
  });
  put(c, "head", o.lines[0] ?? "", W / 2, 1040, 110, headCol(o, "#ffffff"), { maxW: 940 });
  if (o.sub) put(c, "sub", o.sub, W / 2, 1150, 60, textCol(o, mix(brandMain(o), 255, 0.8)), { font: c.sf, maxW: 940 });
}

function tagPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.62, y - 24); ctx.lineTo(x + w, y + 60); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 60); ctx.closePath();
}
function drawTagBack(c: C) {
  const { ctx, o } = c;
  ctx.fillStyle = paintFor(ctx, o.colours.bg || brandMain(o), 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.05)"; for (let i = 0; i < 900; i++) ctx.fillRect((i * 97.3) % W, (i * 53.7) % H, 3, 3);
  piece(c, "tag", W / 2, 760, () => {
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff"; tagPath(ctx, -310, -360, 620, 760); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = paintFor(ctx, o.colours.bg || brandMain(o), -20, -330, 40, 40); ctx.beginPath(); ctx.arc(-50, -300, 24, 0, 7); ctx.fill();
    ctx.strokeStyle = "#b99863"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-50, -300); ctx.bezierCurveTo(-120, -440, -330, -470, -480, -330); ctx.moveTo(-50, -300); ctx.bezierCurveTo(60, -450, 260, -450, 480, -310); ctx.moveTo(-50, -300); ctx.bezierCurveTo(-30, -420, 120, -420, 100, -330); ctx.stroke();
  });
}
function drawTag(c: C) {
  const { ctx, o } = c; drawTagBack(c);
  const q = o.body || o.lines[0] || ""; let s = 52; ctx.font = fcss(c.hf, s); let ls = wrapLines(ctx, q, 460);
  while (ls.length * s * 1.3 > 560 && s > 26) { s -= 2; ctx.font = fcss(c.hf, s); ls = wrapLines(ctx, q, 460); }
  put(c, "quote", q, W / 2, 760 - (ls.length * s * 1.3) / 2 + s * 0.2, s, headCol(o, "#222222"), { font: c.hf, wrapW: 460, lh: s * 1.3 });
}
function drawTag2(c: C) {
  const { o, ctx } = c; drawTagBack(c);
  const hh = put(c, "head", o.lines[0] ?? "", W / 2, 640, 66, headCol(o, "#222222"), { wrapW: 500, lh: 74, upper: true });
  if (o.sub) { put(c, "sub", o.sub, W / 2, 640 + hh + 50, 56, textCol(o, brandMain(o)), { font: c.sf, maxW: 500, italic: true }); piece(c, "rule", W / 2, 640 + hh + 90, () => { ctx.fillStyle = "#555"; ctx.fillRect(-100, 0, 200, 3); }); }
}

function drawNotebook(c: C) {
  const { ctx, o } = c;
  ctx.fillStyle = paintFor(ctx, o.colours.bg || "#111111", 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f6f6f4"; ctx.fillRect(90, 120, 900, 1110);
  ctx.save(); ctx.beginPath(); ctx.rect(660, 140, 330, 1070); ctx.clip(); if (o.mono !== false) ctx.filter = "grayscale(1)"; photoAt(c, 0, 660, 140, 330, 1070); ctx.restore();
  for (let y = 190; y < 1200; y += 52) { ctx.strokeStyle = "#999"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(650, y, 26, 11, 0, 0, Math.PI * 2); ctx.stroke(); }
  const hh = put(c, "head", o.lines[0] ?? "", 150, 470, 56, headCol(o, "#111111"), { align: "left", upper: true, wrapW: 440, lh: 62 });
  put(c, "body", o.body ?? "", 150, 470 + hh + 24, 34, textCol(o, "#222222"), { align: "left", font: c.sf, wrapW: 440, lh: 40 });
}

function drawFade(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H);
  const col = o.colours.bg || "#ffffff";
  const g = ctx.createLinearGradient(0, 0, W * 0.75, 0); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(1, rgba(flat(col, "#ffffff"), 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const h1 = put(c, "head", o.lines[0] ?? "", 80, 200, 90, headCol(o, "#111111"), { align: "left", wrapW: 560, lh: 98 });
  const h2 = put(c, "sub", o.sub ?? "", 80, 200 + h1 + 40, 76, textCol(o, brandMain(o)), { align: "left", font: c.hf, wrapW: 560, lh: 84 });
  put(c, "body", o.body ?? "", 80, 200 + h1 + h2 + 80, 34, "#222222", { align: "left", font: c.sf, wrapW: 480, lh: 42 });
}

function drawLabels(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H);
  const fills = [o.colours.box || mix(brandMain(o), 255, 0.45), mix(brandAcc(o), 255, 0.8), brandAcc(o)];
  const ys = [330, 520, 710]; const xs = [90, 130, 120];
  [0, 1, 2].forEach((i) => {
    const t = o.lines[i] ?? ""; if (!t) return;
    piece(c, `l${i}`, xs[i], ys[i], () => {
      ctx.font = fcss(c.hf, 96); let s = 96; while (ctx.measureText(t).width > 840 && s > 36) { s -= 2; ctx.font = fcss(c.hf, s); }
      const w = ctx.measureText(t).width + 80;
      ctx.fillStyle = paintFor(ctx, fills[i], 0, -s, w, s * 1.6); rr(ctx, 0, -s * 0.95, w, s * 1.5, 18); ctx.fill();
      ctx.fillStyle = lumOf(fills[i]) > 0.45 ? "#111" : "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(t, 40, 0);
    });
  });
}

function drawGrid(c: C) {
  const { ctx, o } = c;
  const cells = o.cells && o.cells.length === 9 ? o.cells : ["c", "p", "c", "t", "c", "p", "p", "c", "c"];
  const cw = W / 3, ch = H / 3; let pi = 0;
  const tones = [brandMain(o), mix(brandMain(o), 255, 0.45), mix(brandAcc(o), 255, 0.2), mix(brandMain(o), 0, 0.3), mix(brandMain(o), 255, 0.75)];
  cells.forEach((k, i) => {
    const x = (i % 3) * cw, y = Math.floor(i / 3) * ch;
    if (k === "p") { photoAt(c, pi++, x, y, cw, ch); }
    else if (k === "t") { ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, cw, ch); }
    else { ctx.fillStyle = paintFor(ctx, tones[i % tones.length], x, y, cw, ch); ctx.fillRect(x, y, cw, ch); }
  });
  const ti = cells.indexOf("t"); if (ti >= 0) {
    const x = (ti % 3) * cw + 40, y = Math.floor(ti / 3) * ch;
    put(c, "head", o.lines[0] ?? "", x, y + 150, 46, headCol(o, "#111111"), { align: "left", upper: true, wrapW: cw - 70, lh: 52 });
    put(c, "sub", o.sub ?? "", x, y + 360, 34, textCol(o, "#111111"), { align: "left", font: c.sf, wrapW: cw - 70, lh: 40 });
  }
}

function drawNotes(c: C) {
  const { ctx, o } = c;
  const main = brandMain(o);
  ctx.fillStyle = paintFor(ctx, o.colours.bg || mix(main, 255, 0.6), 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = mix(main, 255, 0.82); for (let x = 0; x < W; x += 110) ctx.fillRect(x + 40, 0, 56, H);
  piece(c, "notes", W / 2, 640, () => {
    const t = (o.lines[0] ?? "").toUpperCase(); ctx.font = fcss(c.hf, 56); const ls = wrapLines(ctx, t, 780); const bh = 150 + ls.length * 84;
    ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,0.15)"; ctx.shadowBlur = 20; rr(ctx, -460, -bh / 2, 920, bh, 40); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = mix(main, 255, 0.45); ctx.font = fcss(c.sf, 38); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("‹ Notes", -410, -bh / 2 + 52);
    ctx.fillStyle = paintFor(ctx, o.colours.head || mix(main, 255, 0.55), -420, -bh / 2 + 100, 840, ls.length * 84 + 20); ctx.fillRect(-420, -bh / 2 + 100, 840, ls.length * 84 + 14);
    ctx.fillStyle = textCol(o, "#111111"); ctx.font = fcss(c.hf, 56); ctx.textBaseline = "alphabetic";
    ls.forEach((ln, i) => ctx.fillText(ln, -400, -bh / 2 + 172 + i * 84));
  });
}

function drawPaperclip(c: C) {
  const { ctx, o } = c; photoAt(c, 0, 0, 0, W, H);
  const main = brandMain(o);
  if (o.deco !== false) {
    piece(c, "strip", 250, 880, () => { ctx.fillStyle = mix(main, 255, 0.55); ctx.fillRect(-250, -150, 520, 300); ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i < 9; i++) ctx.fillRect(-230, -120 + i * 32, 480, 3); }, -0.08);
    piece(c, "stars", 0, 0, () => { star(ctx, 240, 1000, 62, 4, 0.3); ctx.fillStyle = "#9ea3aa"; ctx.fill(); star(ctx, 760, 980, 66, 8, 0.4); ctx.fillStyle = main; ctx.fill(); });
  }
  piece(c, "paper", 540, 640, () => {
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(-390 + 8, -420 + 12, 780, 780);
    ctx.fillStyle = "#f8f4e6"; ctx.fillRect(-390, -420, 780, 780);
    ctx.strokeStyle = "rgba(60,90,160,0.25)"; ctx.lineWidth = 2; for (let y = -340; y < 340; y += 62) { ctx.beginPath(); ctx.moveTo(-390, y); ctx.lineTo(390, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(220,80,80,0.4)"; ctx.beginPath(); ctx.moveTo(-320, -420); ctx.lineTo(-320, 360); ctx.stroke();
  }, 0.02);
  put(c, "head", o.lines[0] ?? "", 580, 560, 90, headCol(o, "#222222"), { wrapW: 600, lh: 100, maxW: 600 });
  if (o.deco !== false) piece(c, "clip", 820, 260, () => { ctx.strokeStyle = paintFor(ctx, main, -20, -80, 40, 160); ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-18, 60); ctx.lineTo(-18, -50); ctx.arc(0, -50, 18, Math.PI, 0); ctx.lineTo(18, 80); ctx.arc(0, 80, 18, 0, Math.PI); ctx.lineTo(-18, 20); ctx.stroke(); }, 0.35);
}

function drawTape(c: C) {
  const { ctx, o } = c;
  const p = o.photos[0];
  if (p) { ctx.save(); ctx.filter = `blur(${Math.round(o.blur ?? 26)}px)`; cover(ctx, p, -60, -60, W + 120, H + 120, o.views?.[0]); ctx.restore(); }
  piece(c, "note", W / 2, 640, () => {
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = "#ffffff"; ctx.fillRect(-380, -420, 760, 780); ctx.shadowColor = "transparent";
    ctx.fillStyle = paintFor(ctx, o.colours.box || mix(brandMain(o), 255, 0.5), -90, -460, 180, 70); ctx.globalAlpha = 0.92; ctx.save(); ctx.translate(0, -420); ctx.rotate(-0.02); ctx.fillRect(-100, -36, 200, 72); ctx.restore(); ctx.globalAlpha = 1;
  });
  put(c, "head", o.lines[0] ?? "", W / 2, 330, 70, headCol(o, "#111111"), { maxW: 640, wrapW: 640, lh: 76 });
  const body = o.body ?? ""; let s = 52; ctx.font = fcss(c.sf, s); let ls = wrapLines(ctx, body, 620);
  while (ls.length * s * 1.3 > 400 && s > 22) { s -= 2; ctx.font = fcss(c.sf, s); ls = wrapLines(ctx, body, 620); }
  put(c, "body", body, W / 2, 520, s, textCol(o, "#222222"), { font: c.sf, wrapW: 620, lh: s * 1.3 });
}

function drawBold(c: C) {
  const { o } = c; photoAt(c, 0, 0, 0, W, H); shade(c.ctx, 0.2);
  put(c, "head", o.lines[0] ?? "", W / 2, 420, 200, headCol(o, "#ffffff"), { maxW: 980, upper: true });
  if (o.sub) put(c, "sub", o.sub, W / 2, 560, 90, textCol(o, "#ffffff"), { font: c.sf, italic: true, maxW: 980 });
}

function drawClip(c: C) {
  const { ctx, o } = c;
  const main = brandMain(o);
  ctx.fillStyle = paintFor(ctx, o.colours.bg || main, 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = mix(main, 255, 0.88); for (let x = 0; x < W; x += 112) ctx.fillRect(x + 56, 0, 56, H);
  piece(c, "paper", W / 2, 700, () => { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = "#ffffff"; ctx.fillRect(-440, -560, 880, 1120); ctx.shadowColor = "transparent"; });
  piece(c, "clip", 280, 230, () => { const g = ctx.createLinearGradient(-20, -80, 20, 80); g.addColorStop(0, "#f2f2f2"); g.addColorStop(0.5, "#8d9299"); g.addColorStop(1, "#d9dce0"); ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-20, 80); ctx.lineTo(-20, -60); ctx.arc(0, -60, 20, Math.PI, 0); ctx.lineTo(20, 100); ctx.arc(0, 100, 20, 0, Math.PI); ctx.lineTo(-20, 30); ctx.stroke(); });
  const q = o.body || o.lines[0] || ""; let s = 52; ctx.font = fcss(c.sf, s); let ls = wrapLines(ctx, q, 680);
  while (ls.length * s * 1.35 > 800 && s > 26) { s -= 2; ctx.font = fcss(c.sf, s); ls = wrapLines(ctx, q, 680); }
  put(c, "quote", q, W / 2, 700 - (ls.length * s * 1.35) / 2 + s * 0.4, s, textCol(o, mix(main, 0, 0.35)), { font: c.sf, wrapW: 680, lh: s * 1.35 });
}

const DRAW: Record<CoverLayout, (c: C) => void> = {
  curved3: drawCurved3, stack3: drawStack3, pills: drawPills, scatter: drawScatter, scatter8: drawScatter, stack4: drawStack4, boxes: drawBoxes, strip: drawStrip,
  pinknote: drawPinknote, collage: drawCollage, card: drawCard, circle: drawCircle, tag: drawTag, notebook: drawNotebook, fade: drawFade, labels: drawLabels,
  grid: drawGrid, notes: drawNotes, paperclip: drawPaperclip, tape: drawTape, bold: drawBold, clip: drawClip, tag2: drawTag2,
};

/** The pieces she can drag and size on each template. */
export function coverMovable(layout: CoverLayout, o?: Pick<CoverOptions, "subs" | "lines">): { key: string; label: string }[] {
  const n = (p: string, label: string, k: number) => Array.from({ length: Math.max(0, k) }, (_, i) => ({ key: `${p}${i}`, label: `${label} ${i + 1}` }));
  const nSubs = Math.min(9, (o?.subs ?? []).filter((s) => s.trim()).length);
  switch (layout) {
    case "curved3": return [{ key: "l0", label: "Top line" }, { key: "l1", label: "Line 2" }, { key: "l2", label: "Line 3" }];
    case "stack3": return [{ key: "l0", label: "Line 1" }, { key: "l1", label: "Line 2" }, { key: "l2", label: "Line 3" }, { key: "sub", label: "Subheading" }];
    case "pills": return [{ key: "head", label: "Heading" }, ...n("pill", "Pill", Math.min(5, nSubs))];
    case "scatter": return [{ key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }, ...n("s", "Subtitle", nSubs)];
    case "scatter8": return [{ key: "head", label: "Heading" }, ...n("s", "Subtitle", Math.min(8, nSubs))];
    case "stack4": return n("l", "Line", 4);
    case "boxes": return [{ key: "head", label: "Heading" }, ...n("box", "Box", 3)];
    case "strip": return [{ key: "head", label: "Heading" }, { key: "strip", label: "Strip" }, { key: "photo", label: "Clinician" }, { key: "name", label: "Name" }];
    case "pinknote": return [{ key: "head", label: "Heading" }, { key: "note", label: "Note" }, { key: "doodle", label: "Doodles" }];
    case "collage": return [{ key: "head", label: "Heading" }, { key: "stars", label: "Stars" }];
    case "card": return [{ key: "card", label: "Card" }, { key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }, { key: "clip", label: "Clip" }];
    case "circle": return [{ key: "circle", label: "Circle" }, { key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }];
    case "tag": return [{ key: "tag", label: "Tag" }, { key: "quote", label: "Quote" }];
    case "notebook": return [{ key: "head", label: "Heading" }, { key: "body", label: "Paragraph" }];
    case "fade": return [{ key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }, { key: "body", label: "Paragraph" }];
    case "labels": return n("l", "Label", 3);
    case "grid": return [{ key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }];
    case "notes": return [{ key: "notes", label: "Notes box" }];
    case "paperclip": return [{ key: "paper", label: "Paper" }, { key: "head", label: "Heading" }, { key: "strip", label: "Strip" }, { key: "stars", label: "Stars" }, { key: "clip", label: "Clip" }];
    case "tape": return [{ key: "note", label: "Note" }, { key: "head", label: "Heading" }, { key: "body", label: "Hook text" }];
    case "bold": return [{ key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }];
    case "clip": return [{ key: "paper", label: "Paper" }, { key: "clip", label: "Clip" }, { key: "quote", label: "Quote" }];
    case "tag2": return [{ key: "tag", label: "Tag" }, { key: "head", label: "Heading" }, { key: "sub", label: "Subheading" }, { key: "rule", label: "Line" }];
    default: return [];
  }
}

/** The client's own heading font if they picked one, otherwise a safe serif. */
export const clientHeadFont = (fontId?: string): string => (fontId && COVER_FONTS.some((f) => f.id === `s:${fontId}`) ? `s:${fontId}` : "gilda");

export async function renderCoverPost(o: CoverOptions): Promise<HTMLCanvasElement> {
  const hf = coverFont(o.fonts?.head, "gilda");
  const bf = coverFont(o.fonts?.body, "playfair");
  const sf = bf;
  await loadFonts([hf, bf]);
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  DRAW[o.layout]({ ctx, o, hf, bf, sf });
  return c;
}
