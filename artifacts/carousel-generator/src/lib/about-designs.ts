// The About me poster templates, drawn on canvas so each clinic's own photo, logo and words drop straight in.
// Five single 1080 x 1350 posts: the cream editorial and peach vertical ones, plus pill notes, "allow me to introduce"
// and fact arrows. Every colour can be a plain colour or a metallic finish, every template has a headline and a body font
// that can be changed, and the clinic logo sits in the top right corner.
import { SUITE_FONTS, injectSuiteFontCss } from "./suite-fonts";
import { paintFor, isHexColour, metalOfValue } from "./metal-colours";

const W = 1080;
const H = 1350;

const hx = (h: string) => { const v = parseInt((isHexColour(h) ? h : "#d6006f").replace("#", "").padEnd(6, "0").slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (h: string, to: number, t: number) => "#" + hx(h).map((x) => Math.round(x + (to - x) * t).toString(16).padStart(2, "0")).join("");
const lumOf = (h: string) => { const [r, g, b] = hx(h).map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** A plain hex for the maths, even when the colour chosen is metallic. */
const flat = (v: string | undefined, fb: string) => (isHexColour(v) ? v : metalOfValue(v)?.stops[1] ?? fb);

export type AboutLayout = "cream" | "peach" | "pills" | "intro" | "facts";
export const ABOUT_LAYOUTS: { id: AboutLayout; label: string; needsFacts?: boolean }[] = [
  { id: "cream", label: "Cream editorial" },
  { id: "peach", label: "Peach vertical" },
  { id: "pills", label: "Pill notes", needsFacts: true },
  { id: "intro", label: "Allow me to introduce" },
  { id: "facts", label: "Fact arrows", needsFacts: true },
];

/** Colour values are a hex or "metal:id". Anything left empty falls back to the template's own default. */
export type AboutColours = { main: string; accent: string; bg?: string; head?: string; text?: string; box?: string };

/** The colours each template uses unless she picks her own. */
export function aboutDefaults(layout: AboutLayout, col: AboutColours): { bg: string; head: string; text: string; box: string } {
  const main = flat(col.main, "#d6006f");
  const accent = flat(col.accent, "#111111");
  if (layout === "cream") return { bg: mix(main, 255, 0.94), head: lumOf(accent) > 0.6 ? mix(accent, 0, 0.1) : mix(accent, 255, 0.3), text: mix(main, 0, 0.8), box: mix(main, 255, 0.7) };
  if (layout === "peach") return { bg: mix(accent, 255, 0.62), head: lumOf(main) > 0.35 ? mix(main, 0, 0.35) : main, text: mix(main, 0, 0.8), box: mix(main, 255, 0.7) };
  if (layout === "pills") return { bg: "#000000", head: mix(main, 255, 0.72), text: mix(main, 0, 0.85), box: mix(main, 255, 0.72) };
  return { bg: "#000000", head: "#ffffff", text: "#ffffff", box: mix(main, 255, 0.72) };
}

// ---------- fonts ----------

export type AboutFont = { id: string; label: string; family: string; weight?: number; italic?: boolean; group: string };
const g = (id: string, label: string, family: string, weight = 400, italic = false): AboutFont => ({ id, label, family, weight, italic, group: "Google fonts" });
export const ABOUT_FONTS: AboutFont[] = [
  g("gilda", "Gilda Display (elegant)", "Gilda Display"),
  g("playfair", "Playfair Display", "Playfair Display", 400),
  g("dmserif", "DM Serif Display", "DM Serif Display"),
  g("cormorant", "Cormorant Garamond", "Cormorant Garamond", 400),
  g("anton", "Anton", "Anton"),
  g("spartan", "League Spartan", "League Spartan", 400),
  g("fredoka", "Fredoka (bubbly)", "Fredoka", 700),
  g("pacifico", "Pacifico", "Pacifico"),
  g("josefin-i", "Josefin Sans italic", "Josefin Sans", 400, true),
  g("quicksand", "Quicksand", "Quicksand", 500),
  g("poppins", "Poppins", "Poppins", 500),
  g("montserrat", "Montserrat", "Montserrat", 500),
  g("nunito", "Nunito", "Nunito", 600),
  g("gaegu", "Gaegu (handwritten)", "Gaegu", 700),
  g("caveat", "Caveat (handwritten)", "Caveat", 600),
  g("patrick", "Patrick Hand", "Patrick Hand"),
  g("delafield", "Mrs Saint Delafield (signature)", "Mrs Saint Delafield"),
  ...SUITE_FONTS.map((f): AboutFont => ({ id: `s:${f.id}`, label: f.name, family: f.family, italic: f.italic, group: "Your fonts" })),
];
export const aboutFontById = (id: string | undefined, fallback: string): AboutFont => ABOUT_FONTS.find((f) => f.id === id) ?? ABOUT_FONTS.find((f) => f.id === fallback)!;
export type AboutFonts = { head?: string; body?: string };
/** What each template uses for its headline and body until a font is picked. */
export const ABOUT_DEFAULT_FONTS: Record<AboutLayout, { head: string; body: string }> = {
  cream: { head: "anton", body: "spartan" },
  peach: { head: "anton", body: "quicksand" },
  pills: { head: "gilda", body: "josefin-i" },
  intro: { head: "fredoka", body: "gaegu" },
  facts: { head: "gaegu", body: "gaegu" },
};
const fcss = (f: AboutFont, size: number) => `${f.italic ? "italic " : ""}${f.weight ?? 400} ${size}px "${f.family}", sans-serif`;

const GOOGLE_CSS = "https://fonts.googleapis.com/css2?family=Gilda+Display&family=Playfair+Display:wght@400;700&family=DM+Serif+Display&family=Cormorant+Garamond:wght@300;400;500;600&family=Anton&family=League+Spartan:wght@400;500;700&family=Fredoka:wght@400;500;600;700&family=Pacifico&family=Josefin+Sans:ital,wght@0,400;0,600;1,400;1,600&family=Quicksand:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Gaegu:wght@300;400;700&family=Caveat:wght@400;600;700&family=Patrick+Hand&family=Mrs+Saint+Delafield&display=swap";
let cssAdded = false;
function addFontCss() {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  if (!document.getElementById("about-fonts-v2")) {
    const l = document.createElement("link");
    l.id = "about-fonts-v2"; l.rel = "stylesheet"; l.href = GOOGLE_CSS;
    document.head.appendChild(l);
  }
  injectSuiteFontCss();
}
/** Loads just the fonts a post is about to use, so the canvas never draws in a fallback. */
export async function loadAboutFonts(fonts: AboutFont[] = []): Promise<void> {
  addFontCss();
  const need = fonts.length ? fonts : [aboutFontById("anton", "anton"), aboutFontById("quicksand", "quicksand")];
  await Promise.all(need.map((f) => document.fonts.load(fcss(f, 40)).catch(() => []))).catch(() => undefined);
}

// ---------- small drawing helpers ----------

export type AboutView = { z?: number; x?: number; y?: number };
type Img = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number, focusY = 0.35, v?: AboutView) {
  const s = Math.max(w / img.width, h / img.height) * Math.max(1, v?.z ?? 1);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2 + (v?.x ?? 0) * Math.max(0, dw - w) / 2, y - (dh - h) * focusY + (v?.y ?? 0) * Math.max(0, dh - h) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function justified(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, w: number, lh: number) {
  lines.forEach((ln, i) => {
    const words = ln.split(" ");
    if (i === lines.length - 1 || words.length < 2) { ctx.textAlign = "left"; ctx.fillText(ln, x, y + i * lh); return; }
    const gap = (w - words.reduce((a, b) => a + ctx.measureText(b).width, 0)) / (words.length - 1);
    let cx = x;
    for (const wd of words) { ctx.fillText(wd, cx, y + i * lh); cx += ctx.measureText(wd).width + gap; }
  });
}

function newCanvas(): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  return { c, ctx: c.getContext("2d")! };
}

/** The clinic logo, sitting in the top right corner (or another corner), kept inside a small box. */
function drawLogo(ctx: CanvasRenderingContext2D, logo: Img | null | undefined, pos: LogoPos = "tr") {
  if (!logo) return;
  const lw = (logo as { width: number }).width, lh = (logo as { height: number }).height;
  if (!lw || !lh) return;
  const maxW = 210, maxH = 120, m = 36;
  const s = Math.min(maxW / lw, maxH / lh);
  const dw = lw * s, dh = lh * s;
  const x = pos === "tl" || pos === "bl" ? m : W - m - dw;
  const y = pos === "tl" || pos === "tr" ? m : H - m - dh;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 10;
  ctx.drawImage(logo as CanvasImageSource, x, y, dw, dh);
  ctx.restore();
}
export type LogoPos = "tr" | "tl" | "br" | "bl";

/** Text bent along a circle, letters standing upright on it. centreAngle -PI/2 is the very top. */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, centreAngle: number, spacing = 0) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = centreAngle - total / r / 2;
  ctx.textAlign = "center";
  chars.forEach((ch, i) => {
    const w = widths[i];
    const ang = a + w / r / 2;
    ctx.save();
    ctx.translate(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / r;
  });
}
const arcWidth = (ctx: CanvasRenderingContext2D, text: string, spacing = 0) => [...text].reduce((a, c) => a + ctx.measureText(c).width + spacing, 0);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Soft darkening so light writing stays readable on any photo. */
function shade(ctx: CanvasRenderingContext2D, strength = 0.16) {
  const g2 = ctx.createLinearGradient(0, 0, 0, H);
  g2.addColorStop(0, `rgba(0,0,0,${strength + 0.06})`); g2.addColorStop(0.5, `rgba(0,0,0,${strength * 0.4})`); g2.addColorStop(1, `rgba(0,0,0,${strength + 0.06})`);
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
}

type Ctx = { photo: ImageBitmap; bio: string; name: string; headline: string; col: AboutColours; view?: AboutView; logo?: Img | null; logoPos?: LogoPos; hf: AboutFont; bf: AboutFont; facts: string[]; intro: string };

// ---------- template 1: cream page, huge headline over a tall photo, italic justified bio beside it ----------
function templateCream(o: Ctx): HTMLCanvasElement {
  const { c, ctx } = newCanvas();
  const d = aboutDefaults("cream", o.col);
  ctx.fillStyle = paintFor(ctx, o.col.bg || d.bg, 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  cover(ctx, o.photo, 108, 418, 448, 824, 0.3, o.view);
  ctx.textBaseline = "alphabetic";
  ctx.font = fcss(o.hf, 400);
  const m = ctx.measureText(o.headline);
  const capH = m.actualBoundingBoxAscent;
  const tw = 900, th = 235;
  ctx.save();
  ctx.translate(12, 475);
  ctx.scale(tw / m.width, th / capH);
  ctx.fillStyle = paintFor(ctx, o.col.head || d.head, 0, -capH, m.width, capH);
  ctx.fillText(o.headline, 0, 0);
  ctx.restore();
  let size = 29, lines: string[] = [];
  for (; size >= 20; size -= 1) {
    ctx.font = fcss({ ...o.bf, italic: true }, size);
    lines = wrap(ctx, o.bio, 387);
    if (lines.length * size * 1.3 <= 640) break;
  }
  ctx.fillStyle = paintFor(ctx, o.col.text || d.text, 585, 620, 387, 640);
  ctx.textAlign = "left";
  lines.forEach((ln, i) => ctx.fillText(ln, 585, 620 + i * size * 1.3));
  drawLogo(ctx, o.logo, o.logoPos);
  return c;
}

// ---------- template 2: peach page, tall headline up the left, short bio top right, photo bottom right with the name signed across it ----------
function templatePeach(o: Ctx, cutout?: ImageBitmap | null): HTMLCanvasElement {
  const { c, ctx } = newCanvas();
  const d = aboutDefaults("peach", o.col);
  ctx.fillStyle = paintFor(ctx, o.col.bg || d.bg, 0, 0, W, H); ctx.fillRect(0, 0, W, H);
  ctx.font = fcss(o.hf, 400);
  const m = ctx.measureText(o.headline);
  const capH = m.actualBoundingBoxAscent;
  ctx.save();
  ctx.translate(440, H - 40);
  ctx.rotate(-Math.PI / 2);
  ctx.scale((H - 100) / m.width, 345 / capH);
  ctx.fillStyle = paintFor(ctx, o.col.head || d.head, 0, -capH, m.width, capH);
  ctx.fillText(o.headline, 0, 0);
  ctx.restore();
  if (cutout) {
    const s2 = Math.min(1000 / cutout.height, 700 / cutout.width * 1.15) * Math.max(1, o.view?.z ?? 1);
    const dw = cutout.width * s2, dh = cutout.height * s2;
    ctx.save();
    ctx.shadowColor = "rgba(60,20,10,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetX = -12; ctx.shadowOffsetY = 12;
    ctx.drawImage(cutout, W - dw + 40 + (o.view?.x ?? 0) * 120, H - dh + (o.view?.y ?? 0) * 120, dw, dh);
    ctx.restore();
  } else {
    const px = 410, py = 340, pw = W - px, ph = H - py, r = 220;
    const shape = () => { ctx.beginPath(); ctx.moveTo(px + r, py); ctx.lineTo(W, py); ctx.lineTo(W, H); ctx.lineTo(px, H); ctx.lineTo(px, py + r); ctx.quadraticCurveTo(px, py, px + r, py); ctx.closePath(); };
    ctx.save();
    ctx.shadowColor = "rgba(60,20,10,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetX = -10; ctx.shadowOffsetY = 10;
    shape(); ctx.fillStyle = "#000"; ctx.fill();
    ctx.restore();
    ctx.save();
    shape(); ctx.clip();
    cover(ctx, o.photo, px, py, pw, ph, 0.25, o.view);
    ctx.restore();
  }
  // the logo sits top right, so the bio drops a little to leave it room
  const bioTop = o.logo ? 165 : 90, bioMax = o.logo ? 175 : 250;
  ctx.textBaseline = "alphabetic";
  let size = 31, lines: string[] = [];
  for (; size >= 20; size -= 1) {
    ctx.font = fcss(o.bf, size);
    lines = wrap(ctx, o.bio, 560);
    if (lines.length * size * 1.25 <= bioMax) break;
  }
  ctx.fillStyle = paintFor(ctx, o.col.text || d.text, 483, bioTop, 560, bioMax);
  ctx.textAlign = "left";
  lines.forEach((ln, i) => ctx.fillText(ln, 483, bioTop + i * size * 1.25));
  if (o.name) {
    ctx.save();
    ctx.fillStyle = "#F4F0EC";
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 8;
    const sig = aboutFontById("delafield", "delafield");
    let fs = 130;
    ctx.font = fcss(sig, fs);
    while (ctx.measureText(o.name).width > 560 && fs > 60) { fs -= 4; ctx.font = fcss(sig, fs); }
    ctx.fillText(o.name, 520, H - 170);
    ctx.restore();
  }
  drawLogo(ctx, o.logo, o.logoPos);
  return c;
}

// ---------- template 3: full photo, big thin headline, notes in rounded pill boxes ----------
const PILL_SLOTS: { x: number; y: number; right?: boolean }[] = [
  { x: 1017, y: 67, right: true },
  { x: 53, y: 567 },
  { x: 53, y: 768 },
  { x: 1027, y: 969, right: true },
  { x: 85, y: 1165 },
];
function templatePills(o: Ctx): HTMLCanvasElement {
  const { c, ctx } = newCanvas();
  const d = aboutDefaults("pills", o.col);
  cover(ctx, o.photo, 0, 0, W, H, 0.3, o.view);
  shade(ctx, 0.1);
  ctx.textBaseline = "alphabetic";
  // headline, lower case, fitted to the page width
  let size = 330;
  ctx.font = fcss(o.hf, size);
  while (ctx.measureText(o.headline).width > 940 && size > 90) { size -= 6; ctx.font = fcss(o.hf, size); }
  const hw = ctx.measureText(o.headline).width;
  ctx.fillStyle = paintFor(ctx, o.col.head || d.head, (W - hw) / 2, 410 - size * 0.7, hw, size * 0.8);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 14;
  ctx.textAlign = "center"; ctx.fillText(o.headline, W / 2, 410);
  ctx.restore();
  // pills
  const h = 82;
  const notes = o.facts.filter((f) => f.trim()).slice(0, PILL_SLOTS.length);
  notes.forEach((txt, i) => {
    let slot = PILL_SLOTS[i];
    if (i === 0 && o.logo) slot = { x: 53, y: 67 };
    let fs = 38;
    ctx.font = fcss({ ...o.bf }, fs);
    while (ctx.measureText(txt).width + 96 > 760 && fs > 22) { fs -= 1; ctx.font = fcss({ ...o.bf }, fs); }
    const w = ctx.measureText(txt).width + 96;
    const x = slot.right ? slot.x - w : slot.x;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    roundRect(ctx, x, slot.y, w, h, h / 2);
    ctx.fillStyle = paintFor(ctx, o.col.box || d.box, x, slot.y, w, h); ctx.fill();
    ctx.restore();
    ctx.fillStyle = paintFor(ctx, o.col.text || d.text, x, slot.y, w, h);
    ctx.textAlign = "left";
    ctx.fillText(txt, x + 48, slot.y + h / 2 + fs * 0.34);
  });
  drawLogo(ctx, o.logo, o.logoPos);
  return c;
}

// ---------- template 4: allow me to introduce myself ----------
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, stroke: string | CanvasGradient) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = stroke; ctx.lineWidth = 8; ctx.lineCap = "round";
  // three short dashes fanning out from a point, like the little shine marks on the template
  for (const a of [-0.6, 0, 0.6]) {
    const dx = Math.sin(a), dy = -Math.cos(a);
    ctx.beginPath(); ctx.moveTo(dx * 22, dy * 22); ctx.lineTo(dx * 62, dy * 62); ctx.stroke();
  }
  ctx.restore();
}
function curlArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stroke: string | CanvasGradient) {
  ctx.save();
  ctx.strokeStyle = stroke; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(mx - 60, my + 80, mx + 30, my - 110, x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - (my - 55), x1 - (mx + 30));
  ctx.beginPath(); ctx.moveTo(x1 - 34 * Math.cos(a - 0.5), y1 - 34 * Math.sin(a - 0.5)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 34 * Math.cos(a + 0.5), y1 - 34 * Math.sin(a + 0.5)); ctx.stroke();
  ctx.restore();
}
function templateIntro(o: Ctx): HTMLCanvasElement {
  const { c, ctx } = newCanvas();
  const d = aboutDefaults("intro", o.col);
  cover(ctx, o.photo, 0, 0, W, H, 0.3, o.view);
  shade(ctx, 0.08);
  const ink = paintFor(ctx, o.col.head || d.head, 0, 0, W, H, "#ffffff");
  ctx.textBaseline = "alphabetic";
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 14;
  ctx.fillStyle = ink;
  const cx = 530, cy = 810;
  // INTRODUCE on a big arc
  let big = 200;
  ctx.font = fcss(o.hf, big);
  while (arcWidth(ctx, "INTRODUCE", 4) > 840 && big > 80) { big -= 4; ctx.font = fcss(o.hf, big); }
  arcText(ctx, "INTRODUCE", cx, cy, 510, -Math.PI / 2, 4);
  // allow me to, smaller and higher
  ctx.font = fcss({ ...o.hf, weight: 500 }, 64);
  arcText(ctx, "allow me to", cx + 14, cy, 670, -Math.PI / 2, 8);
  // MYSELF, tilted
  let my = 230;
  ctx.font = fcss(o.hf, my);
  while (ctx.measureText("MYSELF").width > 560 && my > 90) { my -= 4; ctx.font = fcss(o.hf, my); }
  ctx.translate(540, 1150); ctx.rotate(-0.1); ctx.textAlign = "center";
  ctx.fillText("MYSELF", 0, 0);
  ctx.restore();
  // doodles
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 8;
  sparkle(ctx, 175, 235, 0.5, ink); sparkle(ctx, 910, 545, -0.9, ink); sparkle(ctx, 880, 990, -0.4, ink);
  curlArrow(ctx, 200, 780, 360, 690, ink);
  // the hello line
  const intro = o.intro || `Hi! I'm ${o.name.split(" ")[0] || "me"} and this is me...`;
  ctx.fillStyle = ink; ctx.textAlign = "left";
  ctx.font = fcss(o.bf, 44);
  wrap(ctx, intro, 200).forEach((ln, i) => ctx.fillText(ln, 100, 835 + i * 46));
  ctx.restore();
  drawLogo(ctx, o.logo, o.logoPos);
  return c;
}

// ---------- template 5: handwritten facts with arrows pointing at her ----------
const FACT_SLOTS: { x: number; y: number; w: number; a: CanvasTextAlign }[] = [
  { x: 815, y: 215, w: 260, a: "left" },
  { x: 60, y: 510, w: 290, a: "left" },
  { x: 745, y: 772, w: 290, a: "left" },
  { x: 130, y: 990, w: 300, a: "left" },
  { x: 722, y: 1150, w: 330, a: "center" },
  { x: 320, y: 150, w: 330, a: "center" },
];
function templateFacts(o: Ctx): HTMLCanvasElement {
  const { c, ctx } = newCanvas();
  const d = aboutDefaults("facts", o.col);
  cover(ctx, o.photo, 0, 0, W, H, 0.3, o.view);
  shade(ctx, 0.07);
  ctx.textBaseline = "alphabetic";
  const facts = o.facts.filter((f) => f.trim()).slice(0, FACT_SLOTS.length);
  const ink = paintFor(ctx, o.col.head || d.head, 0, 0, W, H, "#ffffff");
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 10;
  facts.forEach((txt, i) => {
    const s = FACT_SLOTS[i];
    const size = 46;
    ctx.font = fcss(o.hf, size);
    const lines = wrap(ctx, txt, s.w);
    const lh = size * 1.12;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.fillStyle = ink; ctx.textAlign = s.a;
    lines.forEach((ln, k) => ctx.fillText(ln, s.x, s.y + k * lh));
    // arrow from the nearest edge of the writing towards the middle of the photo
    const bx0 = s.a === "center" ? s.x - widest / 2 : s.x, bx1 = bx0 + widest;
    const by0 = s.y - size * 0.8, by1 = s.y + (lines.length - 1) * lh + size * 0.2;
    const tx = 540, ty = 640;
    const sx = Math.min(Math.max(tx, bx0), bx1), sy = Math.min(Math.max(ty, by0), by1);
    let dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const x0 = sx + dx * 26, y0 = sy + dy * 26;
    const x1 = x0 + dx * 120, y1 = y0 + dy * 120;
    const bend = i % 2 ? 55 : -55;
    const qx = (x0 + x1) / 2 - dy * bend, qy = (y0 + y1) / 2 + dx * bend;
    ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(qx, qy, x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - qy, x1 - qx);
    ctx.beginPath(); ctx.moveTo(x1 - 30 * Math.cos(a - 0.5), y1 - 30 * Math.sin(a - 0.5)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 30 * Math.cos(a + 0.5), y1 - 30 * Math.sin(a + 0.5)); ctx.stroke();
  });
  ctx.restore();
  drawLogo(ctx, o.logo, o.logoPos);
  return c;
}

export type AboutRenderOptions = {
  layout: AboutLayout;
  photo: ImageBitmap;
  colours: AboutColours;
  cutout?: ImageBitmap | null;
  bio: string;
  name: string;
  headline?: string;
  view?: AboutView;
  logo?: Img | null;
  logoPos?: LogoPos;
  fonts?: AboutFonts;
  /** Short facts about her, used by the pill notes and fact arrows templates. */
  facts?: string[];
  /** The hello line on "allow me to introduce", e.g. "Hi! I'm Bea and this is me..." */
  intro?: string;
};

export async function renderAboutPost(o: AboutRenderOptions): Promise<HTMLCanvasElement> {
  const def = ABOUT_DEFAULT_FONTS[o.layout];
  const hf = aboutFontById(o.fonts?.head, def.head);
  const bf = aboutFontById(o.fonts?.body, def.body);
  await loadAboutFonts([hf, bf, aboutFontById("delafield", "delafield")]);
  const lower = o.layout === "pills";
  const raw = (o.headline || "ABOUT ME").trim();
  const ctx: Ctx = {
    photo: o.photo, bio: o.bio, name: o.name, headline: lower ? raw.toLowerCase() : raw, col: o.colours, view: o.view, logo: o.logo, logoPos: o.logoPos, hf, bf,
    facts: o.facts ?? [], intro: o.intro ?? "",
  };
  switch (o.layout) {
    case "cream": return templateCream(ctx);
    case "peach": return templatePeach(ctx, o.cutout);
    case "pills": return templatePills(ctx);
    case "intro": return templateIntro(ctx);
    default: return templateFacts(ctx);
  }
}
