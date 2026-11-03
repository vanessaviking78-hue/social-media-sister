import { BASE_TITLE, DEFAULT_LOOK, drawSlide, ensureFonts, type Look, type Photo, type Post, type TitleFont } from "@/pages/universal";
import { drawTitle, layoutTitle, loadSuiteFont, readTitleStyle, titleHeight } from "./suite-fonts";
import { loadImage } from "./sample-post";
import { logoLuma, makeClearLogo, recolourLogo } from "./logo-clear";
import type { TenKind } from "./tenfree-content";

// 10 FREE POSTS drawing. The three treatment posts are drawn by Universal's own slide drawer, so they match her Universal tool.
// The six others (about me, empowering, your face your rules, seasonal, men, why I do this) are drawn here in the same language:
// a gradient in the clinic's colours, Blue Mirage headlines with the odd curly letter, Montserrat underneath, a see-through logo.
// Stories are the cover of each post on a tall canvas with room left for the poll sticker.

export const W = 1080;
export const H = 1350;
export const SH = 1920;
const BODY = "Montserrat";

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
};

// The headline font is Blue Mirage for everyone. Her Font Lab choices for it win, otherwise each letter that has one gets its first curly version.
export async function buildTitleFont(): Promise<TitleFont> {
  const lf = await loadSuiteFont("blue-mirage");
  const saved = readTitleStyle();
  const mine = saved.fontId === BASE_TITLE.fontId && Object.keys(saved.swaps).length > 0;
  const swaps: Record<string, string> = mine ? { ...saved.swaps } : {};
  if (!mine) for (const [ch, list] of Object.entries(lf.data.alts)) if (list.length) swaps[ch] = list[0];
  return { lf, style: { ...BASE_TITLE, tracking: mine ? saved.tracking : BASE_TITLE.tracking, swaps, rate: "some" } };
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

export async function buildAssets(o: { main: string; accent: string; clinicName: string; handle: string; whatsapp: string; logoBlob: Blob | null; photoBlob: Blob | null }): Promise<Assets> {
  await ensureFonts();
  const tf = await buildTitleFont();
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
  return { brand: makeBrand(o.main, o.accent), logo: forDark, logoImg, photo, handle: o.handle.replace(/^@/, ""), whatsapp: o.whatsapp.trim(), tf };
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

function background(ctx: CanvasRenderingContext2D, b: Brand, variant: number) {
  const runs: [number, number, number, number][] = [
    [0, 0, W, H],
    [W, 0, 0, H],
    [0, H, W, 0],
    [W * 0.5, 0, W * 0.5, H],
  ];
  const [x0, y0, x1, y1] = runs[variant % runs.length];
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, b.deep);
  g.addColorStop(0.55, b.mid);
  g.addColorStop(1, mixHex(b.deep, "#000000", 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // a soft pool of light, so the gradient feels lit rather than flat
  const spot = ctx.createRadialGradient(variant % 2 ? W * 0.2 : W * 0.82, H * 0.14, 20, variant % 2 ? W * 0.2 : W * 0.82, H * 0.14, 760);
  spot.addColorStop(0, rgba(b.glow, 0.2));
  spot.addColorStop(1, rgba(b.glow, 0));
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  // a whisper of grain
  const r = seeded(7 + variant * 101);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(r() * W, r() * H, 1.6, 1.6);
  }
}

function frame(ctx: CanvasRenderingContext2D, b: Brand) {
  ctx.strokeStyle = rgba(b.glow, 0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, W - 108, H - 108);
}

function logoAt(ctx: CanvasRenderingContext2D, a: Assets, cx: number, y: number, maxW: number, maxH: number) {
  if (!a.logo) return;
  const s = Math.min(maxW / a.logo.width, maxH / a.logo.height);
  const w = a.logo.width * s;
  const h = a.logo.height * s;
  ctx.drawImage(a.logo, cx - w / 2, y, w, h);
}

function rule(ctx: CanvasRenderingContext2D, b: Brand, cx: number, y: number, w = 90) {
  ctx.fillStyle = rgba(b.glow, 0.8);
  ctx.fillRect(cx - w / 2, y, w, 2);
}

function headline(ctx: CanvasRenderingContext2D, a: Assets, text: string, y: number, maxH: number, start = 150): number {
  const maxW = W - 240;
  let size = start;
  const make = (s: number) => layoutTitle(a.tf!.lf, text, a.tf!.style, s, maxW, 1.1);
  let layout = make(size);
  while (size > 64 && titleHeight(layout) > maxH) {
    size -= 4;
    layout = make(size);
  }
  drawTitle(ctx, a.tf!.lf, layout, a.tf!.style, 120, y, "center", maxW, "#ffffff");
  return titleHeight(layout);
}

function archPhoto(ctx: CanvasRenderingContext2D, a: Assets, b: Brand, x: number, y: number, w: number, h: number) {
  const bmp = a.photo;
  if (!bmp) return;
  const r = w / 2;
  const path = (px: number, py: number, pw: number, ph: number) => {
    const pr = pw / 2;
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.lineTo(px, py + pr);
    ctx.arc(px + pr, py + pr, pr, Math.PI, 0);
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
  };
  ctx.save();
  path(x, y, w, h);
  ctx.clip();
  const s = Math.max(w / bmp.width, h / bmp.height);
  const bw = bmp.width * s;
  const bh = bmp.height * s;
  ctx.drawImage(bmp, x + (w - bw) / 2, y + (h - bh) * 0.12, bw, bh);
  // a gentle wash at the foot of the arch so it settles into the gradient
  const fade = ctx.createLinearGradient(0, y + h * 0.7, 0, y + h);
  fade.addColorStop(0, rgba(b.deep, 0));
  fade.addColorStop(1, rgba(b.deep, 0.55));
  ctx.fillStyle = fade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = rgba(b.glow, 0.6);
  ctx.lineWidth = 2;
  path(x - 18, y - 18, w + 36, h + 18);
  ctx.stroke();
  void r;
}

const LABEL: Record<TenKind, string> = {
  treatment: "",
  "about-me": "A LITTLE ABOUT ME",
  empower: "THIS ONE IS FOR YOU",
  ageing: "YOUR FACE, YOUR RULES",
  seasonal: "",
  men: "FOR THE GENTLEMEN",
  "about-why": "WHY I DO THIS",
};

export type BespokeSpec = { kind: TenKind; carousel: boolean; headline: string; subtitle: string; slides: string[]; body: string; cta: string; month: string };

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

function drawCover(ctx: CanvasRenderingContext2D, a: Assets, s: BespokeSpec, variant: number, single: boolean) {
  const b = a.brand;
  background(ctx, b, variant);
  frame(ctx, b);
  ctx.textBaseline = "top";
  const label = s.kind === "seasonal" ? `${s.month.toUpperCase()} NOTES` : LABEL[s.kind];
  const withPhoto = !!a.photo && (s.kind === "about-me" || s.kind === "about-why");
  const secondary = single ? s.body : s.subtitle;

  if (withPhoto) {
    archPhoto(ctx, a, b, 230, 150, 620, 690);
    ctx.fillStyle = rgba(b.glow, 0.95);
    ctx.font = `700 22px "${BODY}", sans-serif`;
    tracked(ctx, label, W / 2, 884, 7);
    const hh = headline(ctx, a, s.headline, 926, single ? 190 : 230, single ? 100 : 110);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const sub = fit(ctx, secondary, 500, W - 260, 120, 32, 24, 1.4);
    ctx.font = `500 ${sub.px}px "${BODY}", sans-serif`;
    ctx.textAlign = "center";
    let y = 926 + hh + 14;
    for (const l of sub.lines) {
      ctx.fillText(l, W / 2, y);
      y += sub.px * 1.4;
    }
    logoAt(ctx, a, W / 2, H - 150, 260, 62);
    return;
  }

  logoAt(ctx, a, W / 2, 112, 340, 84);
  ctx.fillStyle = rgba(b.glow, 0.95);
  ctx.font = `700 24px "${BODY}", sans-serif`;
  tracked(ctx, label, W / 2, 340, 8);
  rule(ctx, b, W / 2, 392);
  const hh = headline(ctx, a, s.headline, 440, single ? 400 : 420, single ? 140 : 150);
  const body = fit(ctx, secondary, 500, W - 260, 220, single ? 42 : 38, 28, 1.5);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `500 ${body.px}px "${BODY}", sans-serif`;
  ctx.textAlign = "center";
  let y = 440 + hh + 46;
  for (const l of body.lines) {
    ctx.fillText(l, W / 2, y);
    y += body.px * 1.5;
  }
  handleStamp(ctx, a, H - 150);
}

function drawBodySlide(ctx: CanvasRenderingContext2D, a: Assets, text: string, i: number, total: number) {
  const b = a.brand;
  background(ctx, b, i + 1);
  frame(ctx, b);
  ctx.textBaseline = "top";
  ctx.fillStyle = rgba(b.glow, 0.2);
  ctx.font = `800 300px "${BODY}", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(String(i), 110, 130);
  rule(ctx, b, 165, 520, 90);
  const body = fit(ctx, text, 600, W - 250, 560, 50, 32, 1.55);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${body.px}px "${BODY}", sans-serif`;
  ctx.textAlign = "left";
  let y = 566;
  for (const l of body.lines) {
    ctx.fillText(l, 120, y);
    y += body.px * 1.55;
  }
  ctx.fillStyle = rgba("#ffffff", 0.7);
  ctx.font = `600 22px "${BODY}", sans-serif`;
  tracked(ctx, `${i + 1} / ${total}`, W - 120, H - 140, 5, "right");
  logoAt(ctx, a, 120 + 100, H - 150, 220, 54);
}

function drawCtaSlide(ctx: CanvasRenderingContext2D, a: Assets, text: string) {
  const b = a.brand;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, b.deep);
  g.addColorStop(1, b.mid);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const spot = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.35, 700);
  spot.addColorStop(0, rgba(b.glow, 0.18));
  spot.addColorStop(1, rgba(b.glow, 0));
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  frame(ctx, b);
  ctx.textBaseline = "top";
  const fitted = fit(ctx, text, 700, W - 260, 400, 78, 44, 1.25);
  const total = fitted.lines.length * fitted.px * 1.25;
  let y = 400 - total / 2 + 80;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${fitted.px}px "${BODY}", sans-serif`;
  ctx.textAlign = "center";
  for (const l of fitted.lines) {
    ctx.fillText(l, W / 2, y);
    y += fitted.px * 1.25;
  }
  rule(ctx, b, W / 2, y + 30);
  logoAt(ctx, a, W / 2, y + 96, 420, 120);
  handleStamp(ctx, a, a.whatsapp ? H - 330 : H - 170);
  whatsappStamp(ctx, a, H - 250);
}

/** Draws one of the six bespoke posts: five slides for a carousel, one image for the rest. */
export function renderBespoke(spec: BespokeSpec, a: Assets, variant: number): HTMLCanvasElement[] {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const out: HTMLCanvasElement[] = [];
  const cover = make();
  drawCover(cover.getContext("2d")!, a, spec, variant, !spec.carousel);
  out.push(cover);
  if (!spec.carousel) return out;
  for (let i = 0; i < 3; i++) {
    const c = make();
    drawBodySlide(c.getContext("2d")!, a, spec.slides[i] || "", i + 1, 5);
    out.push(c);
  }
  const last = make();
  drawCtaSlide(last.getContext("2d")!, a, spec.cta || "Tag a friend who will get it");
  out.push(last);
  return out;
}

// ---------- Universal (the three treatment posts) ----------

export type UniversalCopy = { subtitle: string; slides: string[]; cta: string };

export function universalLook(a: Assets): Look {
  return { ...DEFAULT_LOOK, wash: a.brand.deep, grad: a.brand.mid, text: "#ffffff", dir: "bottom", opacity: 100, logoWhite: false, bw: false };
}

/** Draws a treatment post with Universal's own drawer: the cover, three writing slides and the closing slide. */
export function renderUniversalPost(o: { treatmentId: string; headline: string; copy: UniversalCopy; photos: ImageBitmap[]; offset: number; angle: number }, a: Assets): HTMLCanvasElement[] {
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
    photos: [0, 1, 2, 3].map((i) => o.angle * 4 + i + o.offset),
    note: "",
    when: "",
    busy: false,
    scheduling: false,
  };
  const look = universalLook(a);
  const out: HTMLCanvasElement[] = [];
  for (let n = 0; n < 5; n++) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const bmp = n <= 3 && o.photos.length ? o.photos[post.photos[n] % o.photos.length] : null;
    const photo: Photo | null = bmp ? { url: "", bmp } : null;
    drawSlide(ctx, post, n, photo, a.tf, look, a.logoImg);
    if (n === 4) whatsappStamp(ctx, a, H - 250);
    out.push(c);
  }
  return out;
}

// ---------- stories ----------

/** The cover of a post on a tall story canvas. The edges of the cover are stretched into the bands above and below, and the
 *  lower band is left clear for the poll sticker. */
export function renderStory(cover: HTMLCanvasElement, a: Assets): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = SH;
  const ctx = c.getContext("2d")!;
  const gap = (SH - H) / 2;
  const b = a.brand;
  ctx.fillStyle = b.deep;
  ctx.fillRect(0, 0, W, SH);
  // stretch the top and bottom edge of the cover into the bands, then dim them with the brand colour so they feel intended
  ctx.drawImage(cover, 0, 0, W, 6, 0, 0, W, gap + 2);
  ctx.drawImage(cover, 0, H - 6, W, 6, 0, gap + H - 2, W, gap + 2);
  const top = ctx.createLinearGradient(0, 0, 0, gap);
  top.addColorStop(0, rgba(b.deep, 0.92));
  top.addColorStop(1, rgba(b.deep, 0.35));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, gap);
  const bottom = ctx.createLinearGradient(0, gap + H, 0, SH);
  bottom.addColorStop(0, rgba(b.deep, 0.35));
  bottom.addColorStop(1, rgba(b.deep, 0.92));
  ctx.fillStyle = bottom;
  ctx.fillRect(0, gap + H, W, gap);
  ctx.drawImage(cover, 0, gap);
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `700 28px "${BODY}", sans-serif`;
  tracked(ctx, "NEW POST", W / 2, gap / 2 - 18, 10);
  return c;
}
