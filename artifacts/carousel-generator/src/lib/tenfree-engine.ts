import { BASE_TITLE, DEFAULT_LOOK, drawSlide, ensureFonts, type Look, type Photo, type Post, type TitleFont } from "@/pages/universal";
import opentype from "opentype.js";
import { drawTitle, layoutTitle, titleHeight, loadSuiteFont, type LoadedFont } from "./suite-fonts";
import { loadImage } from "./sample-post";
import { logoLuma, makeClearLogo, recolourLogo } from "./logo-clear";

// 10 FREE POSTS drawing. The three treatment posts are drawn by Universal's own slide drawer, so they match her Universal tool.
// The six others (about me, empowering, your face your rules, seasonal, men, why I do this) are drawn here in the same language:
// a gradient in the clinic's colours, Hatcher headlines on the treatment posts, Montserrat underneath, a see-through logo.
// Stories are the cover of each post on a tall canvas with room left for the poll sticker.

export const W = 1080;
export const H = 1350;
export const SH = 1920;
const BODY = "Montserrat";
// A delicate serif for subtitles and body lines on the six personal posts.
const SOFT = "Cormorant Garamond";
export function loadPlayfair(): Promise<unknown> {
  if (!document.getElementById("tf-playfair")) {
    const l = document.createElement("link");
    l.id = "tf-playfair";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Instrument+Serif:ital@0;1&display=swap";
    document.head.appendChild(l);
  }
  return Promise.all(["400 40px", "500 40px", "600 40px", "700 40px", "italic 400 40px"].map((f) => document.fonts.load(`${f} "Playfair Display"`).catch(() => []))).catch(() => undefined);
}
function loadSoft(): Promise<unknown> {
  if (!document.getElementById("tf-soft")) {
    const l = document.createElement("link");
    l.id = "tf-soft";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@300;400;500&display=swap";
    document.head.appendChild(l);
  }
  return Promise.all(["300 40px", "italic 400 40px", "500 40px"].map((f) => document.fonts.load(`${f} "${SOFT}"`).catch(() => []))).catch(() => undefined);
}

// ---------- colour ----------

const toRgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a: string, b: string, t: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v * (1 - t) + y[i] * t));
};
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const lum = (h: string) => {
  const [r, g, b] = toRgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const dist = (a: string, b: string) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
};
function darkenTo(h: string, max: number): string {
  let c = h;
  for (let i = 0; i < 24 && lum(c) > max; i++) c = mixHex(c, "#000000", 0.12);
  return c;
}
function lightenTo(h: string, min: number): string {
  let c = h;
  for (let i = 0; i < 24 && lum(c) < min; i++) c = mixHex(c, "#ffffff", 0.12);
  return c;
}

export type Brand = { deep: string; mid: string; glow: string };

/** Dark, rich gradient colours taken from the clinic's own two brand colours, so white writing always reads. */
export function makeBrand(mainHex: string, accentHex: string): Brand {
  const deep = darkenTo(mainHex, 0.06);
  let mid = darkenTo(mixHex(mainHex, accentHex, 0.4), 0.16);
  if (dist(deep, mid) < 48) mid = mixHex(deep, "#ffffff", 0.14);
  const glow = lightenTo(accentHex, 0.5);
  return { deep, mid, glow };
}

// ---------- assets ----------

export type Assets = {
  brand: Brand;
  /** the logo, already see-through and coloured to sit on the dark gradient */
  logo: HTMLCanvasElement | null;
  logoImg: HTMLImageElement | null;
  photo: ImageBitmap | null;
  handle: string;
  /** shown on the closing slide when it is set */
  whatsapp: string;
  tf: TitleFont;
  /** premium freebies: Montserrat, everything left aligned */
  premium?: boolean;
  /** the clinic's own two brand colours, for the alternate look */
  colours?: { main: string; accent: string };
};

// The headline font on the three treatment carousels is Hatcher, loaded from the same files her NO 1 page uses. It has no curly
// alternates, so there is nothing to swap and the headline is drawn exactly as typed.
let hatcherP: Promise<LoadedFont> | null = null;
function loadHatcher(): Promise<LoadedFont> {
  if (!hatcherP) {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    hatcherP = fetch(`${base}/fonts/no1/Hatcher.woff`).then(async (r) => {
      if (!r.ok) throw new Error("Hatcher font missing");
      const font = opentype.parse(await r.arrayBuffer());
      const byName = new Map<string, opentype.Glyph>();
      for (let i = 0; i < font.glyphs.length; i++) { const g = font.glyphs.get(i); if (g.name) byName.set(g.name, g); }
      return { id: "hatcher", font, byName, data: { alts: {}, chars: {} } } as LoadedFont;
    });
    hatcherP.catch(() => { hatcherP = null; });
  }
  return hatcherP;
}
export async function buildTitleFont(fontId = "hatcher"): Promise<TitleFont> {
  if (fontId !== "hatcher") {
    try {
      const lf = await loadSuiteFont(fontId);
      return { lf, style: { ...BASE_TITLE, fontId, tracking: 10, swaps: {}, rate: "off" } };
    } catch { /* falls back to Hatcher */ }
  }
  const lf = await loadHatcher();
  return { lf, style: { ...BASE_TITLE, fontId: "hatcher", tracking: 10, swaps: {}, rate: "off" } };
}

function textLogoCanvas(name: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 220;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 110;
  ctx.font = `600 ${size}px "${BODY}", sans-serif`;
  while (ctx.measureText(name).width > 840 && size > 30) {
    size -= 4;
    ctx.font = `600 ${size}px "${BODY}", sans-serif`;
  }
  ctx.fillText(name, 450, 112);
  return c;
}

export async function buildAssets(o: { main: string; accent: string; clinicName: string; handle: string; whatsapp: string; logoBlob: Blob | null; photoBlob: Blob | null; titleFont?: string; premium?: boolean }): Promise<Assets> {
  await ensureFonts();
  await loadSoft();
  await loadPlayfair();
  if (o.premium) {
    if (!document.getElementById("mont-font")) {
      const l = document.createElement("link");
      l.id = "mont-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }
    await Promise.all(["400 40px Montserrat", "600 40px Montserrat"].map((f) => document.fonts.load(f).catch(() => [])));
  }
  const tf = await buildTitleFont(o.titleFont);
  let logo: HTMLCanvasElement | null = null;
  if (o.logoBlob) {
    try {
      logo = await makeClearLogo(o.logoBlob);
    } catch {
      logo = null;
    }
  }
  if (!logo) logo = textLogoCanvas(o.clinicName);
  // A dark or mid tone logo is knocked out to white so it reads on the gradient. A logo that is already light is kept as it is.
  const forDark = logoLuma(logo) < 0.75 ? recolourLogo(logo, "#ffffff") : logo;
  const logoImg = await loadImage(forDark.toDataURL("image/png")).catch(() => null);
  const photo = o.photoBlob ? await createImageBitmap(o.photoBlob).catch(() => null) : null;
  return { brand: makeBrand(o.main, o.accent), logo: forDark, logoImg, photo, handle: o.handle.replace(/^@/, ""), whatsapp: o.whatsapp.trim(), tf, premium: o.premium, colours: { main: o.main, accent: o.accent } };
}

// ---------- drawing helpers ----------

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, maxW: number, maxH: number, start: number, min: number, lh: number) {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = `${weight} ${px}px "${BODY}", sans-serif`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines };
  }
  ctx.font = `${weight} ${min}px "${BODY}", sans-serif`;
  return { px: min, lines: wrap(ctx, text, maxW) };
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "center" | "left" | "right" = "center") {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
}

const rgba = (h: string, a: number) => {
  const [r, g, b] = toRgb(h);
  return `rgba(${r},${g},${b},${a})`;
};

function whatsappStamp(ctx: CanvasRenderingContext2D, a: Assets, y: number) {
  if (!a.whatsapp) return;
  ctx.textBaseline = "top";
  ctx.fillStyle = rgba(a.brand.glow, 0.95);
  ctx.font = `700 22px "${BODY}", sans-serif`;
  tracked(ctx, "MESSAGE ME ON WHATSAPP", W / 2, y, 6);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 40px "${BODY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(a.whatsapp, W / 2, y + 40);
}

function handleStamp(ctx: CanvasRenderingContext2D, a: Assets, y: number) {
  if (!a.handle) return;
  ctx.textBaseline = "top";
  ctx.fillStyle = rgba("#ffffff", 0.75);
  ctx.font = `600 22px "${BODY}", sans-serif`;
  tracked(ctx, `@${a.handle.toUpperCase()}`, W / 2, y, 6);
}

// ---------- Universal (the three treatment posts) ----------

export type UniversalCopy = { subtitle: string; slides: string[]; cta: string };

export function universalLook(a: Assets): Look {
  return { ...DEFAULT_LOOK, wash: a.brand.deep, grad: a.brand.mid, text: "#ffffff", dir: "bottom", opacity: 60, logoWhite: false, bw: false, bodyFont: a.premium ? "Montserrat" : "Playfair Display", left: !!a.premium };
}

/** Draws a treatment post with Universal's own drawer: the cover, three writing slides and the closing slide. */
export function renderUniversalPost(o: { treatmentId: string; headline: string; copy: UniversalCopy; photos: ImageBitmap[]; offset: number; angle: number; shift?: number[]; blockY?: number; variant?: number; textColour?: string; coverY?: number; coverScale?: number; gradOpacity?: number; gradColour?: string; bgColour?: string; block?: string; zoom?: number[]; panX?: number[]; panY?: number[]; custom?: (ImageBitmap | null)[] }, a: Assets): HTMLCanvasElement[] {
  const post: Post = {
    id: `${o.treatmentId}-${o.angle}`,
    key: `${o.treatmentId}:${o.angle + 1}`,
    treatmentId: o.treatmentId,
    index: o.angle,
    headline: o.headline,
    subtitle: o.copy.subtitle,
    slides: o.copy.slides,
    cta: o.copy.cta,
    caption: "",
    hashtags: [],
    photos: [0, 1, 2, 3].map((i) => o.angle * 4 + i + o.offset + (o.shift?.[i] ?? 0)),
    note: "",
    when: "",
    busy: false,
    scheduling: false,
  };
  let look: Look = { ...universalLook(a), blockY: o.blockY || 0 };
  // Alternate look: a bright gradient in the clinic's own accent colour with text that contrasts with it, so a run of posts swaps between dark and bright.
  if (o.variant === 1 && a.colours) {
    let wash = a.colours.accent;
    if (lum(wash) > 0.5) wash = darkenTo(wash, 0.45);
    if (lum(wash) < 0.08) wash = lightenTo(wash, 0.1);
    let grad = darkenTo(a.colours.main, 0.3);
    if (dist(wash, grad) < 60) grad = mixHex(wash, "#000000", 0.35);
    look = { ...look, wash, grad, text: lum(wash) > 0.3 ? a.brand.deep : "#ffffff", noShade: true };
  }
  if (o.block && /^#[0-9a-f]{6}$/i.test(o.block)) look = { ...look, block: o.block, noShade: true, text: lum(o.block) > 0.45 ? a.brand.deep : "#ffffff" };
  if (o.textColour && /^#[0-9a-f]{6}$/i.test(o.textColour)) look = { ...look, text: o.textColour };
  if (o.gradColour && /^#[0-9a-f]{6}$/i.test(o.gradColour)) look = { ...look, wash: o.gradColour, grad: mixHex(o.gradColour, "#000000", 0.35) };
  if (typeof o.gradOpacity === "number") look = { ...look, opacity: o.gradOpacity };
  if (o.bgColour && /^#[0-9a-f]{6}$/i.test(o.bgColour)) {
    // A plain colour page instead of the photo. The writing flips to dark or white to suit unless she chose a text colour.
    look = { ...look, bgColour: o.bgColour, noShade: true, text: o.textColour ? look.text : lum(o.bgColour) > 0.4 ? a.brand.deep : "#ffffff" };
  }
  look = { ...look, coverY: o.coverY || 0, coverScale: o.coverScale || 1 };
  const out: HTMLCanvasElement[] = [];
  for (let n = 0; n < 5; n++) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const bmp = n <= 3 ? (o.custom?.[n] ?? (o.photos.length ? o.photos[post.photos[n] % o.photos.length] : null)) : null;
    const photo: Photo | null = bmp ? { url: "", bmp, zoom: o.zoom?.[n], px: o.panX?.[n], py: o.panY?.[n] } : null;
    drawSlide(ctx, post, n, photo, a.tf, look, a.logoImg);
    if (n === 4) whatsappStamp(ctx, a, H - 250);
    out.push(c);
  }
  return out;
}

// ---------- stories ----------

/** The cover of a post on a tall 1080 x 1920 story canvas. The cover sits in the middle at full width, and its top and bottom edges are
 *  stretched into the bands above and below so it looks intended. The lower band is left clear for the poll sticker. */
export function renderStory(cover: HTMLCanvasElement, a: Pick<Assets, "brand">): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = SH;
  const ctx = c.getContext("2d")!;
  const h = Math.round((cover.height / cover.width) * W);
  const top = Math.max(0, Math.round((SH - h) / 2));
  const b = a.brand;
  ctx.fillStyle = b.deep;
  ctx.fillRect(0, 0, W, SH);
  const edge = Math.max(2, Math.round(cover.height * 0.004));
  ctx.drawImage(cover, 0, 0, cover.width, edge, 0, 0, W, top + 2);
  ctx.drawImage(cover, 0, cover.height - edge, cover.width, edge, 0, top + h - 2, W, SH - top - h + 2);
  const t = ctx.createLinearGradient(0, 0, 0, top);
  t.addColorStop(0, rgba(b.deep, 0.9));
  t.addColorStop(1, rgba(b.deep, 0.4));
  ctx.fillStyle = t;
  ctx.fillRect(0, 0, W, top);
  const bt = ctx.createLinearGradient(0, top + h, 0, SH);
  bt.addColorStop(0, rgba(b.deep, 0.4));
  bt.addColorStop(1, rgba(b.deep, 0.9));
  ctx.fillStyle = bt;
  ctx.fillRect(0, top + h, W, SH - top - h);
  ctx.drawImage(cover, 0, top, W, h);
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `700 28px "${BODY}", sans-serif`;
  tracked(ctx, "NEW POST", W / 2, Math.max(40, top / 2 - 18), 10);
  return c;
}
