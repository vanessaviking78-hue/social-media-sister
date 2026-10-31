// The Post Pack engine: draws every kind of post a pack can hold (portrait, tweet, treatment, Unique, Empower, LUX)
// from one description. No React in here. Unique and Treatment posts are drawn by the Month engine, the others by
// their own drawing modules, all using the pack's two fonts: Instrument Serif for titles and Montserrat for subtitles.

import { DEFAULT_FOCUS, getBitmap, makePost, renderSlide as renderMonthSlide, slideCount as monthSlideCount, type Client, type PoolPhoto } from "./month-engine";
import { EMPOWER_BY_ID, drawEmpower, resolveEmpowerText, XH, XW, type EPalette } from "./empower-designs";
import { LUX_PALETTE, LUX_SLIDES, drawLux, drawLuxPhotoSlide, resolveLuxText } from "./lux-designs";
import { fillTokens, type Focus } from "./basic-covers";
import { drawTweetCard, TH, TW, type TweetStats } from "./tweet-card";
import { renderPost as renderPortrait, type Palette as PortraitPalette } from "./sample-post";
import type { PackKind } from "./pack-plan";

export const PACK_HEAD_FONT = "'Instrument Serif', serif";
export const PACK_BODY_FONT = "'Montserrat', sans-serif";

export type PackPost = {
  n: number;
  kind: PackKind;
  design: string;
  text: Record<string, string>; // the words on the cover or card, by field key
  slides: string[]; // the words on the photo slides that follow a cover
  cta: string;
  headline: string; // portrait posts
  subtitle: string; // portrait posts
  quote: string; // tweet posts
  look: "stylish" | "magazine"; // portrait posts
  caption: string;
  hashtags: string;
  photos: (number | null)[]; // positions in the pool
  focus?: Record<string, Focus>; // where each slide's photo sits in its box, by slide number as "f0", "f1"...
};

export type PackClient = Client & {
  handle: string;
  portraitLogo: HTMLCanvasElement; // the logo prepared for the portrait look
  portraitPalette: PortraitPalette;
};

export const PHOTOS_NEEDED: Record<PackKind, number> = { portrait: 1, tweet: 1, treatment: 5, unique: 3, empower: 1, lux: 3 };
export const SLIDES: Record<PackKind, number> = { portrait: 1, tweet: 1, treatment: 5, unique: 3, empower: 1, lux: LUX_SLIDES };

// The Month engine calls the treatment posts "treatments".
const monthTool = (kind: "treatment" | "unique") => (kind === "treatment" ? "treatments" : "unique") as "treatments" | "unique";

export function slidesOf(post: Pick<PackPost, "kind" | "design">): number {
  return post.kind === "treatment" || post.kind === "unique" ? monthSlideCount(monthTool(post.kind), post.design) : SLIDES[post.kind];
}

// Canvas size for each kind. Tweets keep the Tweet Maker's 1080 x 1440, Empower and LUX use their own, the rest 1080 x 1350.
export function sizeOf(kind: PackKind): { w: number; h: number } {
  if (kind === "tweet") return { w: TW, h: TH };
  if (kind === "empower" || kind === "lux") return { w: XW, h: XH };
  return { w: 1080, h: 1350 };
}

// ---------------------------------------------------------------------------
// Colour helpers: turn the clinic's two brand colours into the roles Empower and LUX use
// ---------------------------------------------------------------------------

const hexRgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const v = m ? parseInt(m[1], 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => {
  const x = hexRgb(a), y = hexRgb(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
};
const lum = (h: string) => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

export function brandRoles(brand: { main: string; accent: string }): EPalette {
  const dark = lum(brand.main) < 0.4 ? brand.main : mix(brand.main, "#000000", 0.62);
  return {
    page: mix(brand.main, "#ffffff", 0.9),
    dark,
    accent: brand.accent,
    soft: mix(brand.accent, "#ffffff", 0.6),
    ink: mix(dark, "#000000", 0.5),
    light: mix(brand.main, "#ffffff", 0.95),
  } as EPalette;
}

// A repeatable set of tweet numbers so a post redraws the same every time.
export function tweetStats(seed: number): TweetStats {
  const r = (k: number) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { comments: Math.floor(80 + r(1) * 300), likes: Math.floor(4000 + r(2) * 22000), shares: Math.floor(30 + r(3) * 250) };
}

const bmp = async (pool: PoolPhoto[], i: number | null | undefined) => {
  const p = i == null ? null : pool[i] ?? null;
  return p ? await getBitmap(p) : null;
};

function imageFromDataUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not draw the portrait post"));
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// Draws slide n (0 is the cover) of a pack post onto the canvas at the given scale.
export async function renderPackSlide(post: PackPost, n: number, c: PackClient, canvas: HTMLCanvasElement, scale: number): Promise<void> {
  const { w, h } = sizeOf(post.kind);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  const client: Client = { ...c, headFont: PACK_HEAD_FONT, bodyFont: PACK_BODY_FONT };

  if (post.kind === "unique" || post.kind === "treatment") {
    const mp = makePost(monthTool(post.kind), post.design, post.n, "", 0, c.pool.length);
    mp.text = { ...mp.text, ...post.text };
    mp.slides = post.slides;
    mp.cta = post.cta;
    mp.photos = post.photos;
    mp.focus = {};
    for (const [k, v] of Object.entries(post.focus ?? {})) {
      const i = Number(k.slice(1));
      mp.focus[i === 0 ? "c0" : `s${i + 1}`] = v;
      if (i === 0) mp.focus.c1 = v;
    }
    await renderMonthSlide(mp, n, client, canvas, scale);
    return;
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const focusFor = (i: number): Focus => post.focus?.[`f${i}`] ?? DEFAULT_FOCUS;
  const focus: Focus = focusFor(n);

  if (post.kind === "portrait") {
    const photo = await imageFromDataUrl(c.pool[post.photos[0] ?? 0]?.url);
    const url = renderPortrait({ look: post.look, headline: post.headline, subtitle: post.subtitle, zoom: false, photo, focus: post.focus?.f0 }, c.portraitLogo, c.portraitPalette, c.area.split(",")[0].trim());
    ctx.drawImage(await imageFromDataUrl(url), 0, 0, w, h);
    return;
  }

  if (post.kind === "tweet") {
    drawTweetCard(ctx, {
      name: c.businessName,
      handle: c.handle,
      quote: post.quote,
      stats: tweetStats(post.n),
      background: await bmp(c.pool, post.photos[0]),
      profilePhoto: await bmp(c.pool, post.photos[0]),
      logo: c.logoPos === "off" ? null : c.logo,
    });
    return;
  }

  const roles = c.brand ? brandRoles(c.brand) : null;
  if (post.kind === "empower") {
    const def = EMPOWER_BY_ID[post.design];
    drawEmpower(ctx, {
      design: post.design,
      text: resolveEmpowerText(def, post.text, c.fill),
      palette: { ...def.palette, ...(roles ?? {}) },
      metal: {},
      headFont: PACK_HEAD_FONT,
      bodyFont: PACK_BODY_FONT,
      upper: false,
      photo: await bmp(c.pool, post.photos[0]),
      focus,
      logo: c.logo,
      logoPos: "off",
    });
    return;
  }

  // LUX
  const palette = { ...LUX_PALETTE, ...(roles ?? {}) };
  const cover = Number(post.design) || 0;
  if (n === 0) {
    drawLux(ctx, {
      cover, text: resolveLuxText(cover, post.text, c.fill), palette, metal: {}, headFont: PACK_HEAD_FONT, bodyFont: PACK_BODY_FONT,
      photo: await bmp(c.pool, post.photos[0]), focus, logo: c.logo, logoPos: "off",
    });
    return;
  }
  const last = n === LUX_SLIDES - 1;
  drawLuxPhotoSlide(ctx, {
    text: fillTokens(post.slides[n - 1] ?? "", c.fill), cta: last ? fillTokens(post.cta, c.fill) : "", palette, bodyFont: PACK_BODY_FONT,
    photo: await bmp(c.pool, post.photos[n]), focus, scrim: 35, logo: c.logo, logoPos: "tr", arrow: !last,
  });
}

export async function renderPackPost(post: PackPost, c: PackClient, scale = 1): Promise<HTMLCanvasElement[]> {
  try {
    await Promise.all([PACK_HEAD_FONT, PACK_BODY_FONT].flatMap((f) => [400, 500, 600, 700].map((wt) => document.fonts.load(`${wt} 40px ${f}`).catch(() => []))));
  } catch { /* draw with whatever has arrived */ }
  const out: HTMLCanvasElement[] = [];
  for (let n = 0; n < slidesOf(post); n++) {
    const cv = document.createElement("canvas");
    await renderPackSlide(post, n, c, cv, scale);
    out.push(cv);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}
