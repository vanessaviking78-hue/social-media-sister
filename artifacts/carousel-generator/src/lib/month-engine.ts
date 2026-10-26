// The Month engine: one place that can draw and write every kind of post the Month tool makes, by calling the same
// drawing modules and copy routes the individual tools use. No React in here.

import * as BC from "./basic-covers";
import * as TD from "./treatment-designs";
import * as UD from "./unique-designs";
import { HALLOWEEN_BY_ID, HALLOWEEN_DESIGNS, HALLOWEEN_PALETTE, HALLOWEEN_PALETTE_LABELS, drawHalloween, resolveHalText } from "./halloween-designs";
import { NOVEMBER_BY_ID, NOVEMBER_DESIGNS, NOVEMBER_PALETTE, NOVEMBER_PALETTE_LABELS, drawNovember, resolveNovText } from "./november-designs";
import { DEFAULT_PALETTES, DESIGNS as XMAS_DESIGNS, DESIGN_BY_ID as XMAS_BY_ID, drawXmas, resolveText as resolveXmasText } from "./xmas-designs";
import type { Fill, Focus, Slot } from "./basic-covers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const W = 1080;
export const H = 1350;
export const DEFAULT_FOCUS: Focus = [0.5, 0.32];

export type PoolPhoto = { id: string; file: File; url: string };
export type ToolId = "unique" | "treatments" | "basic" | "halloween" | "november" | "xmas";

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
};

export const TOOL_LABEL: Record<ToolId, string> = {
  unique: "Unique", treatments: "Treatment", basic: "BASIC", halloween: "Halloween", november: "November", xmas: "Christmas",
};

export const uid = () => Math.random().toString(36).slice(2, 10);
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");

// How many images each kind of post makes, and how many photos it takes.
export const slideCount = (tool: ToolId, design: string): number =>
  tool === "unique" ? 3 : tool === "basic" ? 3 : tool === "treatments" ? 5 : 1;
export const photoCount = (tool: ToolId, design: string): number =>
  tool === "unique" ? 3 : tool === "treatments" ? 5 : tool === "basic" ? 2 + BC.COVER_BY_ID[design as BC.CoverId].photos : 1;

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
  } else {
    text = { ...XMAS_BY_ID[design as keyof typeof XMAS_BY_ID].defaults };
    photos = [take(0)];
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
    : XMAS_BY_ID[p.design as keyof typeof XMAS_BY_ID].name;

// The designs each tool can offer, in the order they rotate. Black Friday style posts are never included.
export const designsFor = (tool: ToolId, group?: "xmas" | "newyear"): string[] =>
  tool === "unique" ? UD.UNIQUE.map((d) => d.id)
    : tool === "treatments" ? TD.TREATMENTS.map((d) => d.id)
    : tool === "basic" ? BC.COVERS.map((d) => d.id)
    : tool === "halloween" ? HALLOWEEN_DESIGNS.map((d) => d.id)
    : tool === "november" ? NOVEMBER_DESIGNS.map((d) => d.id)
    : XMAS_DESIGNS.filter((d) => d.group === (group ?? "xmas")).map((d) => d.id);

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

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
  if (tool === "basic") return { bg: dark };
  if (tool === "halloween") return { ...base, paper: mixHex(main, "#000000", 0.86), green: mixHex(main, "#000000", 0.74), tag: mixHex(main, "#ffffff", 0.8), frame: mixHex(main, "#ffffff", 0.88), ink: mixHex(main, "#000000", 0.88) };
  return base;
}

export function colourFields(post: MPost, brand?: { main: string; accent: string } | null): { key: string; label: string; value: string }[] {
  let base: Record<string, string>; let labels: { key: string; label: string }[];
  if (post.tool === "unique") { base = { ...UD.UNIQUE_BY_ID[post.design as UD.UniId].palette }; labels = UD.PALETTE_LABELS; }
  else if (post.tool === "treatments") { base = { ...TD.T_PALETTE }; labels = (Object.keys(TD.T_PALETTE_LABELS) as (keyof typeof TD.T_PALETTE_LABELS)[]).map((k) => ({ key: k, label: TD.T_PALETTE_LABELS[k] })); }
  else if (post.tool === "basic") { base = { bg: BASIC_BG }; labels = [{ key: "bg", label: "Background" }]; }
  else if (post.tool === "halloween") { base = { ...HALLOWEEN_PALETTE }; labels = HALLOWEEN_PALETTE_LABELS; }
  else if (post.tool === "november") { base = { ...NOVEMBER_PALETTE }; labels = NOVEMBER_PALETTE_LABELS; }
  else { base = { ...DEFAULT_PALETTES[post.group ?? "xmas"] }; labels = UD.PALETTE_LABELS; }
  if (brand) base = { ...base, ...brandPalette(post.tool, brand) };
  return labels.map(({ key, label }) => ({ key, label, value: post.pal?.[key] ?? base[key] }));
}
const palOf = <T,>(post: MPost, brand?: Client["brand"]): T => Object.fromEntries(colourFields(post, brand).map((f) => [f.key, f.value])) as T;

// Draws slide n (0 is the cover) of a post onto the canvas at the given scale.
export async function renderSlide(post: MPost, n: number, c: Client, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const last = n === slideCount(post.tool, post.design) - 1;
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
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, logo, logoCorner: corner, arrow: !last, align: c.align, spacing: c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
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
      photo: await bmp(c, post.photos[n]), focus: post.focus[`s${n + 1}`] ?? DEFAULT_FOCUS, scrim: 35, logo, logoCorner: corner, arrow: !last, align: c.align, spacing: c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
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
      focus: post.focus[idx === 2 ? "s2" : "s3"] ?? DEFAULT_FOCUS, scrim: 35, logo, logoCorner: corner, arrow: n === 1, align: c.align, spacing: c.spacing, textDx: post.textPos?.[`t${n + 1}`]?.[0], textDy: post.textPos?.[`t${n + 1}`]?.[1],
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

export async function renderPostImages(post: MPost, c: Client, scale = 1): Promise<HTMLCanvasElement[]> {
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

// Writes the slide words, question and caption for one post. Returns what to merge into the post.
export async function writeCopy(post: MPost, c: Client): Promise<Partial<MPost>> {
  const base = {
    businessName: c.businessName, ownerName: c.ownerName, role: c.role, area: c.area, audience: c.audience, brandNotes: c.brandNotes,
  };
  let data: Record<string, any>;
  let slides: string[] = [];
  if (post.tool === "unique") {
    const def = UD.UNIQUE_BY_ID[post.design as UD.UniId];
    const t = UD.resolveUniText(def, post.text, c.fill);
    data = await postJson("/api/unique/copy", { ...base, idea: def.idea, cover: def.fields.map((fd) => `${fd.label}: ${t[fd.key] ?? ""}`).join("\n"), fresh: false, fields: [] });
    slides = [data.slide2, data.slide3];
  } else if (post.tool === "treatments") {
    const def = TD.TREAT_BY_ID[post.design as TD.TreatId];
    const t = Object.fromEntries(TD.FIELDS.map((fd) => [fd.key, TD.fillTreat(post.text[fd.key] ?? "", c.fill)])) as Record<string, string>;
    data = await postJson("/api/treatments/copy", { ...base, treatment: def.idea, headline: t.head, bullets: [t.b1, t.b2, t.b3, t.b4], callout: t.callout });
    slides = [data.slide2, data.slide3, data.slide4, data.slide5];
  } else if (post.tool === "basic") {
    const def = BC.COVER_BY_ID[post.design as BC.CoverId];
    const t = Object.fromEntries(def.fields.map((fd) => [fd.key, BC.fillTokens(post.text[fd.key] ?? def.defaults[fd.key] ?? "", c.fill)]));
    data = await postJson("/api/basic-posts/copy", { ...base, coverName: def.name, coverIdea: def.idea, cover: t, fields: def.fields.map((fd) => ({ key: fd.key, label: fd.label, words: fd.words })), writeCover: false });
    slides = [data.slide2, data.slide3];
  } else {
    const def = post.tool === "halloween" ? HALLOWEEN_BY_ID[post.design as keyof typeof HALLOWEEN_BY_ID]
      : post.tool === "november" ? NOVEMBER_BY_ID[post.design as keyof typeof NOVEMBER_BY_ID]
      : XMAS_BY_ID[post.design as keyof typeof XMAS_BY_ID];
    const path = post.tool === "halloween" ? "/api/halloween-posts/copy" : post.tool === "november" ? "/api/november-posts/copy" : "/api/xmas-posts/copy";
    data = await postJson(path, { ...base, designName: def.name, idea: def.idea, onImage: onImageText(post, c) });
  }
  let caption = noDashes(data.caption ?? "");
  if (c.footnote && !caption.includes(c.footnote)) caption += `\n\n${c.footnote}`;
  return {
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
  const cs = await renderPostImages(post, c, 1);
  const urls = await uploadPngs(cs.map((x) => x.toDataURL("image/png")), cs.map((_, i) => `month-${post.tool}-${post.design}-${i + 1}-${Date.now()}.png`));
  const body = {
    postType: urls.length > 1 ? "carousel" : "single-image",
    content: {
      caption: `${post.caption.trim()}\n\n${post.hashtags.join(" ")}`.trim(),
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
}

export async function urlToFile(url: string, i: number): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], `approved-${i + 1}.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type });
}
