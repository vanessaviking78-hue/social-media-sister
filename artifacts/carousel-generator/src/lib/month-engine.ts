// The Month engine: one place that can draw and write every kind of post the Month tool makes, by calling the same
// drawing modules and copy routes the individual tools use. No React in here.

import * as BC from "./basic-covers";
import * as TD from "./treatment-designs";
import * as UD from "./unique-designs";
import { HALLOWEEN_BY_ID, HALLOWEEN_DESIGNS, HALLOWEEN_PALETTE, HALLOWEEN_PALETTE_LABELS, drawHalloween, resolveHalText } from "./halloween-designs";
import { NOVEMBER_BY_ID, NOVEMBER_DESIGNS, NOVEMBER_PALETTE, NOVEMBER_PALETTE_LABELS, drawNovember, resolveNovText } from "./november-designs";
import { DEFAULT_PALETTES, DESIGNS as XMAS_DESIGNS, DESIGN_BY_ID as XMAS_BY_ID, drawXmas, resolveText as resolveXmasText } from "./xmas-designs";
import { LUX_SLIDE_DEFS, LUX_PALETTE, LUX_LABELS, LUX_COVERS, LUX_SLIDES, luxDefaults, resolveLuxText, drawLux, drawLuxPhotoSlide } from "./lux-designs";
import { EMPOWER, EMPOWER_BY_ID, resolveEmpowerText, drawEmpower } from "./empower-designs";
import { MENS_SETS, MENS_PHOTO_COUNT, MENS_STATIC_READY } from "./mens-sets";
import { drawAllPostPages, MIN_PHOTOS, type MagazinePostCopy } from "./magazine-post-pages";
import { setMagazineFonts, setMagazineSize, getPhotoHits, PAGE_W as MAG_W, PAGE_H as MAG_H, type PhotoAdjust } from "./magazine-pages";
import { setFlipHandoff } from "./flip-handoff";
import { drawTweetCard, TW, TH } from "./tweet-card";
import { tweetStats } from "./pack-engine";
import type { Fill, Focus, Slot } from "./basic-covers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const W = 1080;
export const H = 1350;
export const DEFAULT_FOCUS: Focus = [0.5, 0.32];

export type PoolPhoto = { id: string; file: File; url: string };
export type ToolId = "unique" | "treatments" | "basic" | "halloween" | "november" | "xmas" | "lux" | "empower" | "mens" | "magazine" | "tweet" | "stylish" | "bulk";

export type Client = {
  businessName: string;
  ownerName: string;
  role: string;
  area: string;
  audience: string;
  brandNotes: string;
  footnote: string;
  fill: Fill;
  headFont: string;
  bodyFont: string;
  align?: "left" | "center" | "right" | "justify"; // words on slides 2 to 5
  spacing?: number; // line spacing on slides 2 to 5
  logoPos?: "auto" | "off" | "tl" | "tr" | "bl" | "br"; // auto: top right on photo slides, none on most covers
  brand?: { main: string; accent: string } | null; // her brand colours, laid over every design's own colours
  logo: HTMLImageElement | null;
  pool: PoolPhoto[];
  preset?: unknown; // the client's saved preset, for the tools that read its fonts and colours
  mensPool?: PoolPhoto[]; // the shared photos of men, for Men photo posts
};

export type MPost = {
  id: string;
  n: number; // slot number in the month, 1 to 20
  when: string; // local "YYYY-MM-DDTHH:mm"
  tool: ToolId;
  design: string;
  text: Record<string, string>;
  photos: (number | null)[];
  focus: Record<string, Focus>;
  spacing?: number; // line spacing for this post, over the page setting
  textScale?: number; // size of the words on photo slides, 1 is as drawn
  slides: string[]; // words for the photo slides that follow the cover
  cta: string;
  caption: string;
  hashtags: string[];
  busy: boolean;
  selected: boolean;
  scheduled: boolean;
  group?: "xmas" | "newyear";
  pal?: Record<string, string>; // her own colour changes for this post
  textPos?: Record<string, [number, number]>; // where she has dragged the words on slides 2 onwards
  hook?: string; // a hook from the hook bank, used word for word
  hookCode?: string; // its code, so it can be crossed off once the post is scheduled
  fonts?: { head?: string; body?: string }; // her own fonts for this post
  topic?: string; // her own topic or angle for this post, typed or picked in the planner
  story?: { q: string; on: boolean; dx: number; dy: number }; // the story that goes out 5 minutes before: its question, whether it is on, and where the picture sits
};

export const TOOL_LABEL: Record<ToolId, string> = {
  unique: "Unique", treatments: "Treatment", basic: "BASIC", halloween: "Halloween", november: "November", xmas: "Christmas", lux: "Lux", empower: "Empower", mens: "Men", magazine: "Magazine", tweet: "Tweet", stylish: "Stylish", bulk: "Bulk Carousel",
};

export const uid = () => Math.random().toString(36).slice(2, 10);
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");

// Stylish cover options, each with the editorial or the classic look on the photo slides. The block cover is left out.
export const STYLISH_COVERS = ["band", "centred", "split", "plain", "paper", "dimmed", "stacked", "collage"];

const MENS_BY_ID: Record<string, (typeof MENS_SETS)[number]> = Object.fromEntries(MENS_SETS.map((m) => [m.id, m]));

// A Men post is either a finished set of slides, or a Unique design filled with the shared photos of men (design "u:<unique id>").
export const isMenPhoto = (design: string) => design.startsWith("u:");
const asUnique = (p: MPost): MPost => ({ ...p, tool: "unique", design: p.design.slice(2) });

// How many images each kind of post makes, and how many photos it takes.
export const slideCount = (tool: ToolId, design: string): number =>
  tool === "unique" ? 3 : tool === "basic" ? 3 : tool === "treatments" ? 5 : tool === "lux" ? LUX_SLIDES : tool === "magazine" ? 5 : tool === "stylish" || tool === "bulk" ? 4 : tool === "xmas" ? 3 : tool === "mens" ? (isMenPhoto(design) ? 3 : MENS_BY_ID[design]?.slides ?? 8) : 1;
export const photoCount = (tool: ToolId, design: string): number =>
  tool === "unique" ? 3 : tool === "treatments" ? 5 : tool === "lux" ? LUX_SLIDES : tool === "magazine" ? MIN_PHOTOS : tool === "stylish" ? 4 : tool === "bulk" ? 2 : tool === "xmas" ? 3 : tool === "mens" ? (isMenPhoto(design) ? 3 : 0) : tool === "basic" ? 2 + BC.COVER_BY_ID[design as BC.CoverId].photos : 1;

// ---------------------------------------------------------------------------
// Photos and fonts
// ---------------------------------------------------------------------------

const bitmaps = new Map<string, Promise<ImageBitmap | null>>();
export function getBitmap(p: PoolPhoto): Promise<ImageBitmap | null> {
  let got = bitmaps.get(p.id);
  if (!got) {
    got = (async () => {
      try {
        const raw = await createImageBitmap(p.file);
        const max = 2200;
        if (Math.max(raw.width, raw.height) <= max) return raw;
        const s = max / Math.max(raw.width, raw.height);
        const c = document.createElement("canvas");
        c.width = Math.round(raw.width * s);
        c.height = Math.round(raw.height * s);
        c.getContext("2d")!.drawImage(raw, 0, 0, c.width, c.height);
        raw.close();
        return await createImageBitmap(c);
      } catch {
        return null;
      }
    })();
    bitmaps.set(p.id, got);
  }
  return got;
}

export async function ensureFonts(...fonts: string[]) {
  try {
    await Promise.all(fonts.flatMap((f) => [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px ${f}`).catch(() => [] as FontFace[]))));
  } catch { /* draw with whatever has arrived */ }
}

// ---------------------------------------------------------------------------
// Making a post
// ---------------------------------------------------------------------------

const BASIC_BG = "#14195c";

export function makePost(tool: ToolId, design: string, n: number, when: string, cursor: number, poolLen: number, group?: "xmas" | "newyear"): MPost {
  const take = (k: number) => (poolLen ? (cursor + k) % poolLen : null);
  let text: Record<string, string> = {};
  let photos: (number | null)[] = [];
  if (tool === "unique") {
    text = { ...UD.UNIQUE_BY_ID[design as UD.UniId].defaults };
    photos = [take(0), take(1), take(2)];
  } else if (tool === "treatments") {
    text = { ...TD.TREAT_BY_ID[design as TD.TreatId].defaults };
    photos = [0, 1, 2, 3, 4].map(take);
  } else if (tool === "basic") {
    const def = BC.COVER_BY_ID[design as BC.CoverId];
    text = { ...def.defaults };
    photos = [take(0), def.photos > 1 ? take(1) : null, take(def.photos), take(def.photos + 1)];
  } else if (tool === "halloween") {
    text = { ...HALLOWEEN_BY_ID[design as keyof typeof HALLOWEEN_BY_ID].defaults };
    photos = [take(0)];
  } else if (tool === "november") {
    text = { ...NOVEMBER_BY_ID[design as keyof typeof NOVEMBER_BY_ID].defaults };
    photos = [take(0)];
  } else if (tool === "lux") {
    text = { ...luxDefaults(Number(design)) };
    photos = [take(0), take(1), take(2)];
  } else if (tool === "empower") {
    text = { ...EMPOWER_BY_ID[design].defaults };
    photos = [take(0)];
  } else if (tool === "mens") {
    text = isMenPhoto(design) ? { ...UD.UNIQUE_BY_ID[design.slice(2) as UD.UniId].defaults } : {};
    photos = isMenPhoto(design) ? [0, 1, 2].map((k) => (cursor + k) % MENS_PHOTO_COUNT) : [];
  } else if (tool === "magazine") {
    text = { copy: "" };
    photos = Array.from({ length: MIN_PHOTOS }, (_, k) => take(k));
  } else if (tool === "stylish") {
    text = { head: "", sub: "" };
    photos = [0, 1, 2, 3].map(take);
  } else if (tool === "bulk") {
    text = { hook: "" };
    photos = [take(0), take(1)];
  } else if (tool === "tweet") {
    text = { quote: "" };
    photos = [take(0)];
  } else {
    text = { ...XMAS_BY_ID[design as keyof typeof XMAS_BY_ID].defaults };
    photos = [take(0), take(1), take(2)];
  }
  return {
    id: uid(), n, when, tool, design, text, photos, focus: {}, slides: [], cta: "", caption: "", hashtags: [],
    busy: false, selected: true, scheduled: false, group,
  };
}

export const designName = (p: MPost): string =>
  p.tool === "unique" ? UD.UNIQUE_BY_ID[p.design as UD.UniId].name
    : p.tool === "treatments" ? TD.TREAT_BY_ID[p.design as TD.TreatId].name
    : p.tool === "basic" ? BC.COVER_BY_ID[p.design as BC.CoverId].name
    : p.tool === "halloween" ? HALLOWEEN_BY_ID[p.design as keyof typeof HALLOWEEN_BY_ID].name
    : p.tool === "november" ? NOVEMBER_BY_ID[p.design as keyof typeof NOVEMBER_BY_ID].name
    : p.tool === "lux" ? LUX_SLIDE_DEFS[Number(p.design)].name
    : p.tool === "empower" ? EMPOWER_BY_ID[p.design].name
    : p.tool === "mens" ? (isMenPhoto(p.design) ? `${UD.UNIQUE_BY_ID[p.design.slice(2) as UD.UniId].name} (men photos)` : MENS_BY_ID[p.design]?.name ?? "Men")
    : p.tool === "tweet" ? "Tweet"
    : p.tool === "stylish" ? `Stylish option ${STYLISH_COVERS.indexOf(p.design.split(":")[0]) + 1} (${p.design.split(":")[1] === "classic" ? "classic" : "editorial"})`
    : p.tool === "bulk" ? (p.design === "cover" ? "Bulk, photo on slide 1 only" : "Bulk, photo behind every slide")
    : p.tool === "magazine" ? (p.design === "reel" ? "Magazine reel (9:16)" : "Magazine post (3:4)")
    : XMAS_BY_ID[p.design as keyof typeof XMAS_BY_ID].name;

// The designs each tool can offer, in the order they rotate. Black Friday style posts are never included.
export const designsFor = (tool: ToolId, group?: "xmas" | "newyear"): string[] =>
  tool === "unique" ? UD.UNIQUE.map((d) => d.id)
    : tool === "treatments" ? TD.TREATMENTS.map((d) => d.id)
    : tool === "basic" ? BC.COVERS.map((d) => d.id)
    : tool === "halloween" ? HALLOWEEN_DESIGNS.map((d) => d.id)
    : tool === "november" ? NOVEMBER_DESIGNS.map((d) => d.id)
    : tool === "lux" ? Array.from({ length: LUX_COVERS }, (_, i) => String(i))
    : tool === "empower" ? EMPOWER.map((d) => d.id)
    : tool === "mens" ? [...(MENS_STATIC_READY ? MENS_SETS.map((m) => m.id) : []), ...UD.UNIQUE.map((d) => `u:${d.id}`)]
    : tool === "magazine" ? ["post", "reel"]
    : tool === "tweet" ? ["tweet"]
    : tool === "stylish" ? [...STYLISH_COVERS.map((c) => `${c}:editorial`), ...STYLISH_COVERS.map((c) => `${c}:classic`)]
    : tool === "bulk" ? ["photo", "cover"]
    : XMAS_DESIGNS.filter((d) => d.group === (group ?? "xmas")).map((d) => d.id);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// A photo cropped to a slide's shape at the spot she dragged it to. The tools that draw their own pictures are handed this, so dragging works in all of them.
function panCanvas(src: { width: number; height: number } & CanvasImageSource, f: Focus, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const k = Math.max(w / src.width, h / src.height);
  const dw = src.width * k, dh = src.height * k;
  cv.getContext("2d")!.drawImage(src, -(dw - w) * f[0], -(dh - h) * f[1], dw, dh);
  return cv;
}

const bmp = async (c: Client, i: number | null | undefined) => {
  const p = i == null ? null : c.pool[i] ?? null;
  return p ? await getBitmap(p) : null;
};

// The colours a post uses: the design's own, with any she has changed laid on top.
const hexRgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const v = m ? parseInt(m[1], 16) : 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgbHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const mixHex = (a: string, b: string, t: number) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
const lumOf = (h: string) => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// Turns two brand colours into the roles each design uses (page, dark panels, accent, light text, ink).
export function brandPalette(tool: ToolId, brand: { main: string; accent: string }): Record<string, string> {
  const { main, accent } = brand;
  const dark = lumOf(main) < 0.4 ? main : mixHex(main, "#000000", 0.62);
  const tint = mixHex(main, "#ffffff", 0.88);
  const base = { paper: tint, red: accent, green: dark, tag: mixHex(accent, "#ffffff", 0.6), frame: mixHex(main, "#ffffff", 0.95), light: mixHex(main, "#ffffff", 0.94), ink: mixHex(dark, "#000000", 0.5) };
  if (tool === "treatments") return { navy: dark, coral: accent, lime: mixHex(accent, "#ffffff", 0.5), cream: tint };
  if (tool === "lux" || tool === "empower") return { page: tint, dark, accent, soft: mixHex(main, "#ffffff", 0.8), ink: mixHex(dark, "#000000", 0.5), light: mixHex(main, "#ffffff", 0.94) };
  if (tool === "mens" || tool === "magazine" || tool === "tweet" || tool === "stylish" || tool === "bulk") return {};
  if (tool === "basic") return { bg: dark };
  if (tool === "halloween") return { ...base, paper: mixHex(main, "#000000", 0.86), green: mixHex(main, "#000000", 0.74), tag: mixHex(main, "#ffffff", 0.8), frame: mixHex(main, "#ffffff", 0.88), ink: mixHex(main, "#000000", 0.88) };
  return base;
}

export function colourFields(post: MPost, brand?: { main: string; accent: string } | null): { key: string; label: string; value: string }[] {
  if (post.tool === "mens" && isMenPhoto(post.design)) return colourFields(asUnique(post), brand);
  let base: Record<string, string>; let labels: { key: string; label: string }[];
  if (post.tool === "unique") { base = { ...UD.UNIQUE_BY_ID[post.design as UD.UniId].palette }; labels = UD.PALETTE_LABELS; }
  else if (post.tool === "treatments") { base = { ...TD.T_PALETTE }; labels = (Object.keys(TD.T_PALETTE_LABELS) as (keyof typeof TD.T_PALETTE_LABELS)[]).map((k) => ({ key: k, label: TD.T_PALETTE_LABELS[k] })); }
  else if (post.tool === "basic") { base = { bg: BASIC_BG }; labels = [{ key: "bg", label: "Background" }]; }
  else if (post.tool === "halloween") { base = { ...HALLOWEEN_PALETTE }; labels = HALLOWEEN_PALETTE_LABELS; }
  else if (post.tool === "november") { base = { ...NOVEMBER_PALETTE }; labels = NOVEMBER_PALETTE_LABELS; }
  else if (post.tool === "lux") { base = { ...LUX_PALETTE }; labels = LUX_LABELS; }
  else if (post.tool === "empower") { const d = EMPOWER_BY_ID[post.design]; base = { ...d.palette }; labels = d.labels; }
  else if (post.tool === "magazine") { base = { main: brand?.main ?? "#14195c", accent: brand?.accent ?? "#c8553d" }; labels = [{ key: "main", label: "Page colour" }, { key: "accent", label: "Accent colour" }]; }
  else if (post.tool === "stylish") { base = { block: brand?.main ?? "#111111", text: "#ffffff" }; labels = [{ key: "block", label: "Cover colour" }, { key: "text", label: "Cover words" }]; }
  else if (post.tool === "mens" || post.tool === "tweet" || post.tool === "bulk") { base = {}; labels = []; }
  else { base = { ...DEFAULT_PALETTES[post.group ?? "xmas"] }; labels = UD.PALETTE_LABELS; }
  if (brand) base = { ...base, ...brandPalette(post.tool, brand) };
  if (["unique", "treatments", "basic", "lux", "xmas"].includes(post.tool)) {
    base = { ...base, slideTint: "#000000", slideText: "#ffffff" };
    labels = [...labels, { key: "slideTint", label: "Photo slides colour wash" }, { key: "slideText", label: "Photo slides words" }];
  }
  return labels.map(({ key, label }) => ({ key, label, value: post.pal?.[key] ?? base[key] }));
}
// What each photo slide shows besides the picture: the colour wash, the colour and size of the words.
const slideLook = (post: MPost, c: Client) => ({ tint: post.pal?.slideTint, textColour: post.pal?.slideText, textScale: post.textScale, spacing: post.spacing ?? c.spacing });
const palOf = <T,>(post: MPost, brand?: Client["brand"]): T => Object.fromEntries(colourFields(post, brand).map((f) => [f.key, f.value])) as T;

// Draws slide n (0 is the cover) of a post onto the canvas at the given scale.
// The men's slides are finished pictures kept in public/mens, so they are drawn as they are.
const mensImages = new Map<string, Promise<HTMLImageElement | null>>();
function mensImage(url: string): Promise<HTMLImageElement | null> {
  let got = mensImages.get(url);
  if (!got) {
    got = new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = url; });
    mensImages.set(url, got);
  }
  return got;
}
async function renderMens(post: MPost, n: number, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const set = MENS_BY_ID[post.design];
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, W, H);
  const im = set ? await mensImage(`${BASE}/mens/${set.folder}/slide-${n + 1}.png`) : null;
  if (im) ctx.drawImage(im, 0, 0, W, H);
  else {
    ctx.fillStyle = "#ffffff"; ctx.font = "600 44px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Men's slide not found", W / 2, H / 2);
  }
  return [];
}

// Magazine Post pages are made in one go (five pages from one set of words), so the last set is kept while the thumbnails draw.
let magCache: { key: string; pages: HTMLCanvasElement[]; hits: Slot[][] } | null = null;
export const emptyMagCopy = (): MagazinePostCopy => ({ cover: { kicker: "", title: "", tagline: "" }, pages: [{ kicker: "", headline: "", intro: "", facts: [{ label: "", text: "" }, { label: "", text: "" }, { label: "", text: "" }] }, { kicker: "", headline: "This is for you if...", intro: "", items: ["", "", "", "", ""] }, { kicker: "", headline: "Helps most with...", intro: "", items: ["", "", "", "", ""] }], cta: { lead: "Is this for you?", word: "DM", line: "", dm: true }, caption: "" });
export function magazineCopyOf(post: MPost): MagazinePostCopy {
  try { if (post.text.copy) return JSON.parse(post.text.copy) as MagazinePostCopy; } catch { /* fall through */ }
  const e = emptyMagCopy();
  e.cover.title = post.topic?.trim() ?? "";
  return e;
}
async function magazinePages(post: MPost, c: Client): Promise<{ pages: HTMLCanvasElement[]; hits: Slot[][] }> {
  const mainCol = post.pal?.main ?? c.brand?.main ?? "#14195c";
  const accent = post.pal?.accent ?? c.brand?.accent ?? "#c8553d";
  const copy = magazineCopyOf(post);
  const key = JSON.stringify([post.id, post.design, post.text.copy, post.topic, post.photos, mainCol, accent, c.headFont, c.bodyFont, c.businessName, c.pool.length, Object.entries(post.focus).filter(([k]) => k[0] === "m")]);
  if (magCache?.key === key) return magCache;
  const photos: (CanvasImageSource | null)[] = [];
  for (let k = 0; k < MIN_PHOTOS; k++) photos.push(await bmp(c, post.photos[k]));
  const d = new Date(post.when);
  const issue = d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  setMagazineFonts(c.headFont, c.bodyFont);
  setMagazineSize(post.design === "reel" ? "reel" : "post");
  let pages: HTMLCanvasElement[] = [];
  let hits: Slot[][] = [];
  // A photo she has dragged is panned: the focus she set becomes the pan the magazine pages use.
  const adjusts: (PhotoAdjust | undefined)[] = Array.from({ length: MIN_PHOTOS }, (_, k) => { const f = post.focus[`m${k}`]; return f ? { zoom: 1, panX: 1 - 2 * f[0], panY: 1 - 2 * f[1] } : undefined; });
  try {
    pages = drawAllPostPages({ clinicName: c.businessName || "Your clinic", colour: mainCol, accent, ctaButton: "", contact: "", issue, qrUrl: "" } as never,
      { ...copy, cover: { ...copy.cover, title: copy.cover.title || post.topic?.trim() || "" } }, photos, adjusts);
    for (const h of getPhotoHits()) (hits[h.page] ??= []).push({ i: h.slot, x: h.x, y: h.y, w: h.w, h: h.h, rot: 0 });
  } finally { setMagazineSize("post"); setMagazineFonts(); }
  magCache = { key, pages, hits };
  return magCache;
}
async function renderMagazine(post: MPost, n: number, c: Client, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const { pages, hits } = await magazinePages(post, c);
  const src = pages[Math.min(n, pages.length - 1)];
  canvas.width = Math.round(src.width * scale);
  canvas.height = Math.round(src.height * scale);
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return post.design === "reel" ? [] : (hits[Math.min(n, pages.length - 1)] ?? []);
}

// Stylish covers and slides are drawn by the Stylish tool itself, loaded only when a post needs it.
async function renderStylish(post: MPost, n: number, c: Client, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const m = await import("../pages/stylish");
  const [cover, look] = post.design.split(":");
  const style = {
    ...m.STYLISH_DEFAULT_STYLE, ...m.STYLISH_COVER_PRESETS[cover as keyof typeof m.STYLISH_COVER_PRESETS],
    ...(look === "classic" ? m.STYLISH_LOOK_CLASSIC : m.STYLISH_LOOK_EDITORIAL),
    // The words follow the block they sit on: white on a dark brand colour, black on a light one. Covers with words over the photo are white.
    ...(c.brand ? (() => {
      const onBlock = lumOf(c.brand.main) < 0.55 ? "#ffffff" : "#000000";
      return cover === "centred"
        ? { cvBlock: c.brand.main, cvBand: c.brand.main, cvColour: "#ffffff", cvSubColour: "#ffffff" }
        : { cvBlock: c.brand.main, cvBand: c.brand.main, cvColour: onBlock, cvSubColour: onBlock };
    })() : {}),
    arrow: false,
    showLogo: !!c.logo && c.logoPos !== "off",
    ...(post.pal?.block ? { cvBlock: post.pal.block, cvBand: post.pal.block } : {}),
    ...(post.pal?.text ? { cvColour: post.pal.text, cvSubColour: post.pal.text } : {}),
  } as typeof m.STYLISH_DEFAULT_STYLE;
  await ensureFonts(style.cvFont, style.cvSubFont, style.displayFont);
  const head = BC.fillTokens(post.text.head || post.topic?.trim() || "Your headline", c.fill);
  const spec = n === 0 ? { kind: "cover" as const, text: head, sub: BC.fillTokens(post.text.sub ?? "", c.fill) }
    : n === 3 ? { kind: "cta" as const, text: BC.fillTokens(post.cta, c.fill), sub: "" }
    : { kind: "body" as const, text: BC.fillTokens(post.slides[n - 1] ?? "", c.fill), sub: "" };
  const idx = post.photos[n];
  let file = idx != null ? c.pool[idx]?.file ?? null : null;
  const fk = n === 0 ? "c0" : `s${n + 1}`;
  if (file && post.focus[fk]) {
    const b = await bmp(c, idx);
    if (b) {
      const blob = await new Promise<Blob | null>((r) => panCanvas(b, post.focus[fk], W, H).toBlob(r, "image/jpeg", 0.92));
      if (blob) file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    }
  }
  const out = await m.stylishRenderSlide(spec, file, style, c.logo, (c.preset ?? { logoSize: 110 }) as never, scale, { index: n, total: 4 });
  canvas.width = out.width; canvas.height = out.height;
  canvas.getContext("2d")!.drawImage(out, 0, 0);
  return file ? [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }] : [];
}

// Bulk Carousel slides come from the Bulk Carousel Creator's own drawing: a hook, two body slides and the question.
async function renderBulk(post: MPost, n: number, c: Client, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const m = await import("../pages/bulk-carousel");
  const blocks = m.makeBlocks({ hook: BC.fillTokens(post.text.hook || post.topic?.trim() || "Your hook", c.fill), body1: post.slides[0] ?? "", body2: post.slides[1] ?? "", cta: BC.fillTokens(post.cta, c.fill) });
  const load = async (i: number | null | undefined): Promise<HTMLImageElement | null> => {
    const p = i == null ? null : c.pool[i] ?? null;
    return p ? await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = p.url; }) : null;
  };
  const loadPanned = async (i: number | null | undefined, key: string): Promise<HTMLImageElement | null> => {
    const f = post.focus[key];
    const b = f ? await bmp(c, i) : null;
    if (!b) return load(i);
    const url = panCanvas(b, f, W, H).toDataURL("image/jpeg", 0.92);
    return await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  };
  const cover = await loadPanned(post.photos[0], "c0");
  const body = post.design === "cover" ? null : await loadPanned(post.photos[1], "s2") ?? cover;
  const url = m.renderSlideCanvas(n + 1, blocks, cover, body ?? (post.design === "cover" ? null : cover), c.logo, (c.preset ?? {}) as never, scale, false, post.spacing);
  const im = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  if (im) { canvas.width = im.width; canvas.height = im.height; canvas.getContext("2d")!.drawImage(im, 0, 0); }
  const has = n === 0 ? cover : body;
  return has ? [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }] : [];
}

// Reels go through Magazine Flip, which turns the pages into a video.
export async function sendToFlip(post: MPost, c: Client): Promise<void> {
  const cs = await renderPostImages(post, c, 1);
  await setFlipHandoff({ canvases: cs, clientName: c.businessName, caption: post.caption, title: `${designName(post)} · ${c.businessName}`, size: post.design === "reel" ? "reel" : "post" });
  window.open(`${BASE}/magazine`, "_blank");
}

export async function renderSlide(post: MPost, n: number, c: Client, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  installMetal();
  if (post.fonts?.head || post.fonts?.body) { c = { ...c, headFont: post.fonts.head || c.headFont, bodyFont: post.fonts.body || c.bodyFont }; await ensureFonts(c.headFont, c.bodyFont); }
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const last = n === slideCount(post.tool, post.design) - 1;
  if (post.tool === "mens" && isMenPhoto(post.design)) return renderSlide(asUnique(post), n, { ...c, pool: c.mensPool ?? [] }, canvas, scale);
  if (post.tool === "mens") return renderMens(post, n, canvas, scale);
  if (post.tool === "magazine") return renderMagazine(post, n, c, canvas, scale);
  if (post.tool === "stylish") return renderStylish(post, n, c, canvas, scale);
  if (post.tool === "bulk") return renderBulk(post, n, c, canvas, scale);
  if (post.tool === "tweet") {
    canvas.width = Math.round(TW * scale); canvas.height = Math.round(TH * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    let photo = await bmp(c, post.photos[0]);
    if (photo && post.focus.c0) photo = await createImageBitmap(panCanvas(photo, post.focus.c0, TW, TH));
    drawTweetCard(ctx, { name: c.businessName, handle: "@" + c.businessName.toLowerCase().replace(/[^a-z0-9]/g, ""), quote: post.text.quote || post.topic?.trim() || "Write the tweet with Rewrite words", stats: tweetStats(post.n), background: photo, profilePhoto: c.logo ?? photo, logo: null });
    return photo ? [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }] : [];
  }
  const logo = c.logoPos === "off" ? null : c.logo;
  const corner = c.logoPos && c.logoPos !== "auto" && c.logoPos !== "off" ? c.logoPos : undefined;

  if (post.tool === "unique") {
    const def = UD.UNIQUE_BY_ID[post.design as UD.UniId];
    if (n === 0) {
      return UD.drawUnique(ctx, {
        design: def.id, text: UD.resolveUniText(def, post.text, c.fill), palette: palOf<never>(post, c.brand), headFont: c.headFont, bodyFont: c.bodyFont,
        upper: true, photo: await bmp(c, post.photos[0]), focus: post.focus.c0 ?? DEFAULT_FOCUS, logo, logoPos: corner,
      });
    }
    return UD.drawUniPhotoSlide(ctx, {
      text: BC.fillTokens(post.slides[n - 1] ?? "", c.fill), cta: last ? BC.fillTokens(post.cta, c.fill) : "", palette: palOf<never>(post, c.brand), bodyFont: c.bodyFont,
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, ...slideLook(post, c), logo, logoCorner: corner, arrow: false, align: c.align, spacing: post.spacing ?? c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
    });
  }

  if (post.tool === "treatments") {
    const def = TD.TREAT_BY_ID[post.design as TD.TreatId];
    if (n === 0) {
      return TD.drawCover(ctx, {
        treat: def.id, layout: def.layout,
        text: Object.fromEntries(TD.FIELDS.map((fd) => [fd.key, TD.fillTreat(post.text[fd.key] ?? "", c.fill)])) as never,
        pal: palOf<never>(post, c.brand), headFont: c.headFont, bodyFont: c.bodyFont, upper: true,
        photo: await bmp(c, post.photos[0]), focus: post.focus.c0 ?? DEFAULT_FOCUS, logo,
      } as never);
    }
    return TD.drawPhotoSlide(ctx, {
      text: TD.fillTreat(post.slides[n - 1] ?? "", c.fill), cta: last ? TD.fillTreat(post.cta, c.fill) : "",
      small: last ? TD.fillTreat(post.text.small ?? "", c.fill) : "", pal: palOf<never>(post, c.brand), bodyFont: c.bodyFont, headFont: c.headFont,
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, ...slideLook(post, c), logo, logoCorner: corner, arrow: false, align: c.align, spacing: post.spacing ?? c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
    } as never);
  }

  if (post.tool === "basic") {
    const def = BC.COVER_BY_ID[post.design as BC.CoverId];
    const colours = BC.makeColours(palOf<{ bg: string }>(post, c.brand).bg);
    if (n === 0) {
      return BC.drawCover(ctx, {
        cover: def.id,
        text: Object.fromEntries(def.fields.map((fd) => [fd.key, BC.fillTokens(post.text[fd.key] ?? def.defaults[fd.key] ?? "", c.fill)])),
        colours, headFont: c.headFont, bodyFont: c.bodyFont, upper: true,
        photos: [await bmp(c, post.photos[0]), def.photos > 1 ? await bmp(c, post.photos[1]) : null],
        focus: [post.focus.c0 ?? DEFAULT_FOCUS, post.focus.c1 ?? DEFAULT_FOCUS], logo,
      } as never);
    }
    const idx = n === 1 ? 2 : 3;
    return BC.drawPhotoSlide(ctx, {
      text: BC.fillTokens(post.slides[n - 1] ?? "", c.fill), cta: n === 2 ? BC.fillTokens(post.cta, c.fill) : "", colours,
      bodyFont: c.bodyFont, headFont: c.headFont, photo: await bmp(c, post.photos[idx]),
      focus: post.focus[idx === 2 ? "s2" : "s3"] ?? DEFAULT_FOCUS, scrim: 35, ...slideLook(post, c), logo, logoCorner: corner, arrow: false, align: c.align, spacing: post.spacing ?? c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
    } as never);
  }

  if (post.tool === "lux") {
    const palette = palOf<never>(post, c.brand);
    if (n === 0) {
      return drawLux(ctx, {
        cover: Number(post.design), text: resolveLuxText(Number(post.design), post.text, c.fill), palette, metal: {},
        headFont: c.headFont, bodyFont: c.bodyFont, photo: await bmp(c, post.photos[0]), focus: post.focus.c0 ?? DEFAULT_FOCUS, logo, logoPos: corner,
      });
    }
    return drawLuxPhotoSlide(ctx, {
      text: BC.fillTokens(post.slides[n - 1] ?? "", c.fill), cta: last ? BC.fillTokens(post.cta, c.fill) : "", palette, bodyFont: c.bodyFont,
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, ...slideLook(post, c), logo, logoPos: corner, arrow: false, align: c.align, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
    });
  }
  if (post.tool === "empower") {
    const d = EMPOWER_BY_ID[post.design];
    return drawEmpower(ctx, {
      design: d.id, text: resolveEmpowerText(d, post.text, c.fill), palette: palOf<never>(post, c.brand), metal: {},
      headFont: c.headFont, bodyFont: c.bodyFont, upper: true, photo: await bmp(c, post.photos[0]), focus: post.focus.c0 ?? DEFAULT_FOCUS, logo, logoPos: corner ?? "off",
    });
  }

  if (post.tool === "xmas" && n > 0) {
    return UD.drawUniPhotoSlide(ctx, {
      text: BC.fillTokens(post.slides[n - 1] ?? "", c.fill), cta: last ? BC.fillTokens(post.cta, c.fill) : "", palette: palOf<never>(post, c.brand), bodyFont: c.bodyFont,
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, ...slideLook(post, c), logo, logoCorner: corner, arrow: false, align: c.align, spacing: post.spacing ?? c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
    } as never);
  }
  const photo = await bmp(c, post.photos[0]);
  const common = { headFont: c.headFont, bodyFont: c.bodyFont, upper: true, photo, focus: post.focus.c0 ?? DEFAULT_FOCUS, logo, logoPos: corner ?? ("off" as const) };
  if (post.tool === "halloween") {
    const d = HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID];
    return drawHalloween(ctx, { design: d.id, text: resolveHalText(d, post.text, c.fill), palette: palOf<never>(post, c.brand), mono: false, ...common } as never);
  }
  if (post.tool === "november") {
    const d = NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID];
    return drawNovember(ctx, { design: d.id, text: resolveNovText(d, post.text, c.fill), palette: palOf<never>(post, c.brand), ...common } as never);
  }
  const d = XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
  return drawXmas(ctx, { design: d.id, text: resolveXmasText(d, post.text, c.fill), palette: palOf<never>(post, c.brand), ...common } as never);
}

// ---------------------------------------------------------------------------
// Metallic colours. A metallic colour is stored as a plain hex, so every design keeps working, and drawn as
// a shimmering gradient wherever that exact hex is used for text or a shape.
// ---------------------------------------------------------------------------
export const METALS: { id: string; label: string; hex: string; stops: [number, string][] }[] = [
  { id: "gold", label: "Gold", hex: "#d4af36", stops: [[0, "#8a6a12"], [0.28, "#f6e08a"], [0.5, "#d4af36"], [0.72, "#fff0b0"], [1, "#9c7a1a"]] },
  { id: "silver", label: "Silver", hex: "#c0c0c1", stops: [[0, "#7d7f84"], [0.28, "#f4f5f7"], [0.5, "#c0c0c1"], [0.72, "#ffffff"], [1, "#868990"]] },
  { id: "rosegold", label: "Rose gold", hex: "#b76e7a", stops: [[0, "#8a4a54"], [0.28, "#f1c1c4"], [0.5, "#b76e7a"], [0.72, "#f9d9d5"], [1, "#94505b"]] },
  { id: "bronze", label: "Bronze", hex: "#cd7f33", stops: [[0, "#7a4515"], [0.28, "#efb26b"], [0.5, "#cd7f33"], [0.72, "#f6c58a"], [1, "#82481a"]] },
  { id: "copper", label: "Copper", hex: "#b87334", stops: [[0, "#6f3f17"], [0.28, "#e3a06b"], [0.5, "#b87334"], [0.72, "#efb88a"], [1, "#78431b"]] },
  { id: "champagne", label: "Champagne", hex: "#f7e7ce", stops: [[0, "#cdb79a"], [0.28, "#fffaf0"], [0.5, "#f7e7ce"], [0.72, "#ffffff"], [1, "#d3bfa2"]] },
  { id: "green", label: "Metallic green", hex: "#2e8b58", stops: [[0, "#14522f"], [0.28, "#7fd6a2"], [0.5, "#2e8b58"], [0.72, "#a6e8c1"], [1, "#17582f"]] },
  { id: "blue", label: "Metallic blue", hex: "#2f6fbe", stops: [[0, "#143d78"], [0.28, "#8bb9ee"], [0.5, "#2f6fbe"], [0.72, "#b3d2f6"], [1, "#16417f"]] },
  { id: "red", label: "Metallic red", hex: "#b3262b", stops: [[0, "#6e1014"], [0.28, "#ea7a7e"], [0.5, "#b3262b"], [0.72, "#f3a1a4"], [1, "#721218"]] },
];
const METAL_BY_HEX = new Map(METALS.map((m) => [m.hex, m]));
export const metalOf = (hex: string | undefined) => METAL_BY_HEX.get((hex ?? "").toLowerCase());
let metalInstalled = false;
export function installMetal() {
  if (metalInstalled || typeof CanvasRenderingContext2D === "undefined") return;
  metalInstalled = true;
  const proto = CanvasRenderingContext2D.prototype;
  for (const prop of ["fillStyle", "strokeStyle"] as const) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d?.set || !d.get) continue;
    const set = d.set;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set(this: CanvasRenderingContext2D, v: unknown) {
        const m = typeof v === "string" ? METAL_BY_HEX.get(v.toLowerCase()) : undefined;
        if (!m) { set.call(this, v); return; }
        const k = this.getTransform().a || 1;
        const w = this.canvas.width / k, h = this.canvas.height / k;
        const g = this.createLinearGradient(0, 0, w, h);
        m.stops.forEach(([o, col]) => g.addColorStop(o, col));
        set.call(this, g);
      },
    });
  }
}

// ---------------------------------------------------------------------------
// The story that goes out 5 minutes before a post: a fun question and the words "Answer below",
// with the post's cover tucked in beside it. She can drag the picture and change the words.
// ---------------------------------------------------------------------------
export const STORY_W = 1080, STORY_H = 1920;
export async function renderStory(post: MPost, c: Client, canvas: HTMLCanvasElement, scale = 1): Promise<void> {
  installMetal();
  if (post.fonts?.head || post.fonts?.body) c = { ...c, headFont: post.fonts.head || c.headFont, bodyFont: post.fonts.body || c.bodyFont };
  await ensureFonts(c.headFont, c.bodyFont);
  const bg = c.brand?.main ?? "#2b2230";
  const accent = c.brand?.accent ?? "#e8b4c0";
  const dark = lumOf(bg) < 0.55;
  const ink = dark ? "#ffffff" : "#1d1a1f";
  canvas.width = Math.round(STORY_W * scale);
  canvas.height = Math.round(STORY_H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.fillStyle = accent; ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(STORY_W, 0, 520, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, STORY_H, 460, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  // The cover, a little tilted like a card dropped on the table.
  const cv = document.createElement("canvas");
  await renderSlide(post, 0, c, cv, 0.62);
  const cw = 670, chh = (cv.height / cv.width) * cw;
  const st = post.story ?? { q: "", on: true, dx: 0, dy: 0 };
  ctx.save();
  ctx.translate(STORY_W / 2 + st.dx, 190 + chh / 2 + st.dy);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.drawImage(cv, -cw / 2, -chh / 2, cw, chh);
  ctx.restore();
  // The question.
  const q = (st.q || "Go on, tell me your answer").trim();
  ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  let size = 80;
  let lines: string[] = [];
  for (; size >= 50; size -= 4) {
    ctx.font = `700 ${size}px "${c.headFont}", serif`;
    lines = []; let cur = "";
    for (const w of q.split(/\s+/)) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > 880 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length <= 4) break;
  }
  const lh = size * 1.18;
  let y = 1340;
  for (const l of lines) { ctx.fillText(l, STORY_W / 2, y); y += lh; }
  // Answer below.
  const label = "ANSWER BELOW";
  ctx.font = `700 40px "${c.bodyFont}", sans-serif`;
  const pw = ctx.measureText(label).width + 110, py = Math.max(y + 30, 1640);
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.roundRect(STORY_W / 2 - pw / 2, py, pw, 96, 48); ctx.fill();
  ctx.fillStyle = lumOf(accent) < 0.55 ? "#ffffff" : "#1d1a1f";
  ctx.textBaseline = "middle"; ctx.fillText(`${label}  ↓`, STORY_W / 2, py + 50);
}

// The cover words a post can have changed on the cover, with what each says now.
export function coverEditFields(post: MPost): { key: string; label: string; value: string }[] {
  if (post.tool === "mens" && isMenPhoto(post.design)) return coverEditFields(asUnique(post));
  let fields: { key: string; label: string }[] = []; let defaults: Record<string, string> = {};
  try {
    if (post.tool === "unique") { const d = UD.UNIQUE_BY_ID[post.design as UD.UniId]; fields = d.fields; defaults = d.defaults; }
    else if (post.tool === "treatments") { fields = TD.FIELDS; defaults = TD.TREAT_BY_ID[post.design as TD.TreatId].defaults as Record<string, string>; }
    else if (post.tool === "basic") { const d = BC.COVER_BY_ID[post.design as BC.CoverId]; fields = d.fields; defaults = d.defaults; }
    else if (post.tool === "halloween") { const d = HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID]; fields = d.fields; defaults = d.defaults as Record<string, string>; }
    else if (post.tool === "november") { const d = NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID]; fields = d.fields; defaults = d.defaults as Record<string, string>; }
    else if (post.tool === "xmas") { const d = XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID]; fields = d.fields; defaults = d.defaults as Record<string, string>; }
    else if (post.tool === "empower") { const d = EMPOWER_BY_ID[post.design]; fields = d.fields; defaults = d.defaults as Record<string, string>; }
    else if (post.tool === "stylish") fields = [{ key: "head", label: "Cover headline" }, { key: "sub", label: "Cover subtitle" }];
    else if (post.tool === "bulk") fields = [{ key: "hook", label: "Slide 1 hook" }];
  } catch { fields = []; }
  return fields.map((f) => ({ key: f.key, label: f.label, value: post.text[f.key] ?? defaults[f.key] ?? "" }));
}

export async function renderPostImages(post: MPost, c: Client, scale = 1): Promise<HTMLCanvasElement[]> {
  if (post.fonts?.head || post.fonts?.body) c = { ...c, headFont: post.fonts.head || c.headFont, bodyFont: post.fonts.body || c.bodyFont };
  await ensureFonts(c.headFont, c.bodyFont);
  const out: HTMLCanvasElement[] = [];
  for (let n = 0; n < slideCount(post.tool, post.design); n++) {
    const cv = document.createElement("canvas");
    await renderSlide(post, n, c, cv, scale);
    out.push(cv);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const onImageText = (post: MPost, c: Client): string => {
  if (post.tool === "tweet" || post.tool === "stylish" || post.tool === "bulk") return "";
  if (post.tool === "mens" || post.tool === "magazine") return "";
  if (post.tool === "lux") { const r = resolveLuxText(Number(post.design), post.text, c.fill); return [r.head, r.sub].filter(Boolean).join(" / "); }
  if (post.tool === "empower") { const d = EMPOWER_BY_ID[post.design]; const r = resolveEmpowerText(d, post.text, c.fill); return d.fields.map((f) => r[f.key]).filter(Boolean).join("\n"); }
  const rows = (fields: { key: string }[], r: Record<string, string>) => fields.map((f) => r[f.key]).filter(Boolean).join("\n");
  if (post.tool === "halloween") { const d = HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID]; return rows(d.fields, resolveHalText(d, post.text, c.fill)); }
  if (post.tool === "november") { const d = NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID]; return rows(d.fields, resolveNovText(d, post.text, c.fill)); }
  const d = XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
  return rows(d.fields, resolveXmasText(d, post.text, c.fill));
};

async function postJson(path: string, body: unknown): Promise<Record<string, any>> {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
  return data;
}

// Her own topic for a post, folded into the idea the writer is given.
const withTopic = (idea: string, post: MPost): string => {
  const topic = post.topic?.trim() ? `${idea}. The topic for this post, in my own words: "${post.topic.trim()}". Keep the whole post on this topic` : idea;
  return post.hook?.trim() ? `${topic}. The post opens with this hook, which I wrote: "${post.hook.trim()}". Start the caption with it word for word and carry on from it` : topic;
};

// A training academy uses the same designs as a clinic, so its cover words are rewritten from the academy's point of view.
export const isAcademyClient = (c: Client): boolean => /academy/i.test(c.businessName);
// Every academy post is about one of these, in rotation, so the whole month is about training with her.
const ACADEMY_TOPICS: { title: string; angle: string }[] = [
  { title: "What happens when you train with me", angle: "a day in my training room, small groups, hands on, nobody left at the back, what it feels like when it clicks" },
  { title: "Choosing a trainer who has been doing this a long time", angle: "why experience in the room matters, what a trainer who has seen it all can teach that a textbook cannot, questions to ask before choosing" },
  { title: "Why aesthetics is a great career choice", angle: "my honest reasons I love this career, the variety, the people, being able to build something of your own, no promises about money" },
  { title: "The empowerment of working in aesthetics", angle: "what it does for your confidence and sense of self to learn a skill and use it, the women I have watched grow" },
  { title: "The benefits of training in aesthetics", angle: "what you gain from proper training: skills, confidence, community, a new direction" },
  { title: "Learning something new at 35, 40, 50 and beyond", angle: "it is never too late to change direction, what life experience brings to the training room" },
  { title: "Nervous about your first day of training", angle: "what I say to every nervous woman, imposter syndrome, it is normal and I will look after you" },
  { title: "What good training looks like", angle: "how to tell a trainer who will look after you from one who will not, safety and consent as real skills, small groups, support afterwards" },
  { title: "Being your own boss", angle: "the independence of building your own practice, fitting work around family and the school run, no promises about earnings" },
  { title: "The support you get after the course ends", angle: "why I stay in touch, the questions that come at 9pm, never being left on your own" },
  { title: "Meet your trainer", angle: "who I am, what I love about teaching, a small honest detail about me, never an invented story or number of years" },
  { title: "The questions I get asked most about training", angle: "am I too old, do I need a medical background, will I be good at it, answered honestly and kindly" },
  { title: "The friendships and community in aesthetics", angle: "the women you meet in the training room, the group chats, the support of people who get it" },
  { title: "Confidence is the real skill", angle: "technique can be taught, confidence is built, how my training builds it step by step" },
  { title: "What to look for before you choose a course", angle: "a friendly checklist of questions every woman should ask any trainer, including me" },
  { title: "Why I still love training people", angle: "the moment I see it click for someone, why teaching is my favourite part" },
  { title: "Doing it properly", angle: "why safety, consent and standards matter and how I teach them so they feel natural, not scary" },
  { title: "From nervous to hands on", angle: "the journey over a training day, what changes between the morning and the afternoon, no invented delegates" },
  { title: "A career that fits your life", angle: "flexible hours, work that can fit around family, why so many women choose aesthetics, no promises" },
  { title: "Thinking about training with me", angle: "an honest invitation, what to ask, how to find out if it is right for you, no pressure" },
];
const academyTopic = (post: MPost) => ACADEMY_TOPICS[((post.n || 1) - 1) % ACADEMY_TOPICS.length];
const academyIdea = (post: MPost) => { const t = academyTopic(post); return `an academy post whose whole subject is "${t.title}": ${t.angle}. Everything on the cover and in the words must be about this topic`; };

async function academyCover(post: MPost, c: Client): Promise<Record<string, string>> {
  type Fd = { key: string; label: string; words?: number };
  let defaults: Record<string, string> = {};
  let fields: Fd[] = [];
  let designIdea = "";
  if (post.tool === "unique") { const d = UD.UNIQUE_BY_ID[post.design as UD.UniId]; fields = d.fields; defaults = d.defaults; designIdea = d.idea; }
  else if (post.tool === "treatments") { const d = TD.TREAT_BY_ID[post.design as TD.TreatId]; fields = TD.FIELDS; defaults = d.defaults as Record<string, string>; designIdea = d.idea; }
  else if (post.tool === "basic") { const d = BC.COVER_BY_ID[post.design as BC.CoverId]; fields = d.fields; defaults = d.defaults; designIdea = d.idea; }
  else {
    const d = post.tool === "halloween" ? HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID]
      : post.tool === "november" ? NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID]
      : XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
    fields = d.fields; defaults = d.defaults as Record<string, string>; designIdea = d.idea;
  }
  const req = fields.map((fd) => {
    const current = post.text[fd.key] ?? defaults[fd.key] ?? "";
    const n = current.trim() ? current.trim().split(/\s+/).length : 0;
    return { key: fd.key, label: fd.label, words: fd.words ?? Math.max(3, Math.ceil(n * 1.4)), current };
  });
  const data = await postJson("/api/academy/cover", {
    businessName: c.businessName, ownerName: c.ownerName, role: c.role, area: c.area,
    designName: designName(post), idea: designIdea, topic: `${academyTopic(post).title}: ${academyTopic(post).angle}`, fields: req,
  });
  return (data.cover ?? {}) as Record<string, string>;
}

// Writes the slide words, question and caption for one post. Returns what to merge into the post.
// Writes the post, then a fun question for the story that goes out 5 minutes before it.
// No emojis in any caption, slide or story, whatever the writer returns.
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const noEmoji = <T,>(v: T): T =>
  typeof v === "string" ? (v.replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").replace(/ +([.,!?])/g, "$1").trim() as unknown as T)
  : Array.isArray(v) ? (v.map(noEmoji) as unknown as T)
  : v && typeof v === "object" ? (Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, noEmoji(x)])) as T)
  : v;

export async function writeCopy(post: MPost, c: Client): Promise<Partial<MPost>> {
  return noEmoji(await writeCopyWithStory(post, c));
}

async function writeCopyWithStory(post: MPost, c: Client): Promise<Partial<MPost>> {
  const out = await writeCopyInner(post, c);
  try {
    const words = [out.text?.hook ?? post.text.hook ?? post.hook ?? "", ...(out.slides ?? post.slides), out.caption ?? ""].filter(Boolean).join("\n");
    const sq = await postJson("/api/story-question/copy", { businessName: c.businessName, topic: post.topic ?? "", post: words });
    const q = noDashes(String(sq.question ?? "")).trim();
    if (q) return { ...out, story: { on: post.story?.on ?? true, dx: post.story?.dx ?? 0, dy: post.story?.dy ?? 0, q } };
  } catch { /* no question, she can type her own */ }
  return out;
}

async function writeCopyInner(post: MPost, c: Client): Promise<Partial<MPost>> {
  const base = {
    businessName: c.businessName, ownerName: c.ownerName, role: c.role, area: c.area, audience: c.audience, brandNotes: c.brandNotes,
    // The last slide: Comment TREATMENT for more info on a treatment post, Tag a friend on anything else.
    ctaTreatment: post.topic?.trim() ?? "",
  };
  const academy = isAcademyClient(c);
  // First write only: the cover words come from the academy. A Rewrite later keeps whatever the cover says now.
  let coverText: Record<string, string> | null = null;
  if (academy && !post.caption.trim() && post.tool !== "lux" && post.tool !== "empower" && post.tool !== "mens" && post.tool !== "magazine" && post.tool !== "tweet" && post.tool !== "xmas" && post.tool !== "stylish" && post.tool !== "bulk") {
    const fresh = await academyCover(post, c);
    if (Object.keys(fresh).length) { coverText = { ...post.text, ...fresh }; post = { ...post, text: coverText }; }
  }
  let data: Record<string, any>;
  let slides: string[] = [];
  if (post.tool === "unique") {
    const def = UD.UNIQUE_BY_ID[post.design as UD.UniId];
    const t = UD.resolveUniText(def, post.text, c.fill);
    data = await postJson("/api/unique/copy", { ...base, idea: academy ? academyIdea(post) : withTopic(def.idea, post), cover: def.fields.map((fd) => `${fd.label}: ${t[fd.key] ?? ""}`).join("\n"), fresh: false, fields: [] });
    slides = [data.slide2, data.slide3];
  } else if (post.tool === "treatments") {
    const def = TD.TREAT_BY_ID[post.design as TD.TreatId];
    const t = Object.fromEntries(TD.FIELDS.map((fd) => [fd.key, TD.fillTreat(post.text[fd.key] ?? "", c.fill)])) as Record<string, string>;
    data = await postJson("/api/treatments/copy", { ...base, treatment: academy ? academyIdea(post) : withTopic(def.idea, post), headline: t.head, bullets: [t.b1, t.b2, t.b3, t.b4], callout: t.callout });
    slides = [data.slide2, data.slide3, data.slide4, data.slide5];
  } else if (post.tool === "basic") {
    const def = BC.COVER_BY_ID[post.design as BC.CoverId];
    const t = Object.fromEntries(def.fields.map((fd) => [fd.key, BC.fillTokens(post.text[fd.key] ?? def.defaults[fd.key] ?? "", c.fill)]));
    data = await postJson("/api/basic-posts/copy", { ...base, coverName: academy ? "Academy post" : def.name, coverIdea: academy ? academyIdea(post) : withTopic(def.idea, post), cover: t, fields: def.fields.map((fd) => ({ key: fd.key, label: fd.label, words: fd.words })), writeCover: false });
    slides = [data.slide2, data.slide3];
  } else if (post.tool === "stylish" || post.tool === "bulk") {
    const key = post.tool === "stylish" ? "head" : "hook";
    const fields = post.tool === "stylish"
      ? [{ key: "head", label: "Cover headline", words: 5, current: post.text.head || post.topic?.trim() || "A headline" }, { key: "sub", label: "Cover subtitle", words: 6, current: post.text.sub ?? "" }]
      : [{ key: "hook", label: "Slide 1 hook", words: 9, current: post.text.hook || post.topic?.trim() || "A hook" }];
    data = await postJson("/api/unique/copy", { ...base, idea: withTopic(post.tool === "stylish" ? "a stylish editorial carousel with a short punchy cover headline" : "a swipe carousel that opens on one strong hook", post), cover: "", fresh: true, fields });
    slides = [data.slide2, data.slide3];
    const fresh: Record<string, string> = { ...post.text };
    for (const f of fields) { const v = (data.cover as Record<string, unknown> | undefined)?.[f.key]; if (typeof v === "string" && v.trim()) fresh[f.key] = noDashes(v); }
    if (post.hook?.trim()) fresh[key] = post.hook.trim();
    coverText = fresh;
  } else if (post.tool === "tweet") {
    data = await postJson("/api/tweet-post/copy", { ...base, designName: "Tweet", idea: post.topic?.trim() ?? "", onImage: "" });
    return { text: { ...post.text, quote: noDashes(data.quote ?? "") }, slides: [], cta: "", caption: noDashes(data.caption ?? "") + (c.footnote && !String(data.caption ?? "").includes(c.footnote) ? `\n\n${c.footnote}` : ""), hashtags: Array.isArray(data.hashtags) ? data.hashtags : [] };
  } else if (post.tool === "xmas") {
    const def = XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
    data = await postJson("/api/unique/copy", { ...base, idea: `Christmas and the festive season, a funny honest carousel. ${academy ? academyIdea(post) : withTopic(def.idea, post)}`, cover: onImageText(post, c), fresh: false, fields: [] });
    slides = [data.slide2, data.slide3];
  } else if (post.tool === "mens" && isMenPhoto(post.design)) {
    return writeCopyInner({ ...asUnique(post), topic: ["men's aesthetics, written for men who think it is not for them", post.topic?.trim() ?? ""].filter(Boolean).join(": ") }, c);
  } else if (post.tool === "mens") {
    const set = MENS_BY_ID[post.design];
    data = await postJson("/api/mens/copy", { ...base, topic: [set?.topic ?? "", post.topic?.trim() ?? ""].filter(Boolean).join(". "), slides: set?.summary ?? "" });
  } else if (post.tool === "magazine") {
    const treatment = post.topic?.trim() ?? "";
    if (!treatment) throw new Error("Add the treatment for the Magazine post in the plan first");
    const word = treatment.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16) || "INFO";
    data = await postJson("/api/magazine-post/copy", { clinicName: c.businessName, treatment, replyWord: word, style: "4", hook: post.hook?.trim() || undefined });
    const copy: MagazinePostCopy = { ...(data as unknown as MagazinePostCopy), cta: { lead: "Want to know more?", word, line: `Comment ${word} for more info` } };
    copy.caption = noDashes(copy.caption ?? "");
    if (!copy.caption.includes(copy.cta.line)) copy.caption = `${copy.caption.trimEnd()}\n\n${copy.cta.line}`;
    return { text: { ...post.text, copy: JSON.stringify(copy) }, slides: [], cta: "", caption: copy.caption + (c.footnote && !copy.caption.includes(c.footnote) ? `\n\n${c.footnote}` : ""), hashtags: [] };
  } else if (post.tool === "lux") {
    data = await postJson("/api/lux/copy", { ...base, theme: post.topic?.trim() ?? "", fresh: false, onImage: onImageText(post, c) });
    slides = [data.slide2, data.slide3];
  } else if (post.tool === "empower") {
    const def = EMPOWER_BY_ID[post.design];
    data = await postJson("/api/empower/copy", { ...base, designName: def.name, idea: withTopic(def.idea, post), onImage: onImageText(post, c) });
  } else {
    const def = post.tool === "halloween" ? HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID]
      : post.tool === "november" ? NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID]
      : XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
    const path = post.tool === "halloween" ? "/api/halloween-posts/copy" : post.tool === "november" ? "/api/november-posts/copy" : "/api/xmas-posts/copy";
    data = await postJson(path, { ...base, designName: academy ? "Academy post" : def.name, idea: academy ? academyIdea(post) : withTopic(def.idea, post), onImage: onImageText(post, c) });
  }
  let caption = noDashes(data.caption ?? "");
  // A treatment post's caption closes on the same line as the last slide.
  if (/^Comment /.test(String(data.cta ?? "")) && !caption.includes(String(data.cta))) caption = `${caption.trimEnd()}\n\n${data.cta}`;
  if (c.footnote && !caption.includes(c.footnote)) caption += `\n\n${c.footnote}`;
  return {
    ...(coverText ? { text: coverText } : {}),
    slides: slides.map((s) => noDashes(s ?? "")),
    cta: noDashes(data.cta ?? ""),
    caption,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
  };
}

// ---------------------------------------------------------------------------
// Uploading and scheduling
// ---------------------------------------------------------------------------

export async function uploadPngs(dataUrls: string[], names: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += 3) {
    const images = dataUrls.slice(i, i + 3).map((base64, j) => ({ name: names[i + j], base64 }));
    const res = await fetch(`${BASE}/api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

export async function schedulePost(post: MPost, c: Client, presetId: number): Promise<void> {
  if (post.tool === "magazine" && post.design === "reel") throw new Error("A Magazine reel is made into a video in Magazine Flip. Press Open in Magazine Flip on that post, then untick it here");
  const cs = await renderPostImages(post, c, 1);
  const urls = await uploadPngs(cs.map((x) => x.toDataURL("image/png")), cs.map((_, i) => `month-${post.tool}-${post.design}-${i + 1}-${Date.now()}.png`));
  const body = {
    postType: urls.length > 1 ? "carousel" : "single-image",
    content: {
      caption: noEmoji(`${post.caption.trim()}\n\n${post.hashtags.join(" ")}`.trim()),
      title: `${designName(post)} · ${c.businessName}`,
      platforms: ["instagram"],
      imageUrls: urls,
      sourceTool: `month-${post.tool}`,
    },
    scheduledAt: new Date(post.when).toISOString(),
    isTrial: false,
    notes: "",
    presetId,
  };
  const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || "Failed to schedule post");
  }
  // The story goes out 5 minutes before the post.
  if (post.story?.on !== false && post.story?.q.trim()) {
    const sc = document.createElement("canvas");
    await renderStory(post, c, sc, 1);
    const [storyUrl] = await uploadPngs([sc.toDataURL("image/png")], [`month-story-${post.tool}-${post.design}-${Date.now()}.png`]);
    const sr = await fetch(`${BASE}/api/scheduler/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "story",
        content: { caption: "", title: `${designName(post)} (story) · ${c.businessName}`, platforms: ["instagram"], imageUrls: [storyUrl], sourceTool: `month-${post.tool}-story` },
        scheduledAt: new Date(new Date(post.when).getTime() - 5 * 60 * 1000).toISOString(),
        isTrial: false,
        notes: "",
        presetId,
      }),
    });
    if (!sr.ok) {
      const err = await sr.json().catch(() => ({ error: "Failed" }));
      throw new Error(`The post is booked but its story was not: ${err.error || "Failed to schedule story"}`);
    }
  }
}

export async function urlToFile(url: string, i: number): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], `approved-${i + 1}.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type });
}

// Sends a checked month to a Year Pass buyer's portal. Every slide of every post is drawn and uploaded, then each post's story, then it is published.
export async function publishToYearPass(posts: MPost[], c: Client, monthId: number, onProgress?: (done: number, total: number) => void): Promise<void> {
  const pw = (() => { try { return localStorage.getItem("cybersuite-pw") || ""; } catch { return ""; } })();
  const headers = { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
  const out: { n: number; day: string; label: string; images: string[]; caption: string; tags: string }[] = [];
  const stories: { n: number; image: string; question: string }[] = [];
  const ordered = [...posts].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  for (let i = 0; i < ordered.length; i++) {
    const post = ordered[i];
    onProgress?.(i, ordered.length);
    const cs = await renderPostImages(post, c, 1);
    const urls = await uploadPngs(cs.map((x) => x.toDataURL("image/png")), cs.map((_, k) => `yp-${post.tool}-${post.design}-${k + 1}-${Date.now()}.png`));
    out.push({
      n: i + 1,
      day: new Date(post.when).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
      label: designName(post),
      images: urls,
      caption: noEmoji(post.caption.trim()),
      tags: post.hashtags.join(" "),
    });
    if (post.story?.on !== false && post.story?.q.trim()) {
      const sc = document.createElement("canvas");
      await renderStory(post, c, sc, 1);
      const [storyUrl] = await uploadPngs([sc.toDataURL("image/png")], [`yp-story-${post.tool}-${post.design}-${Date.now()}.png`]);
      stories.push({ n: stories.length + 1, image: storyUrl, question: post.story.q.trim() });
    }
  }
  onProgress?.(ordered.length, ordered.length);
  const r = await fetch(`${BASE}/api/yearpass/admin/months/${monthId}/publish`, { method: "POST", headers, body: JSON.stringify({ posts: out, stories }) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || "Could not publish to the portal");
  }
}
