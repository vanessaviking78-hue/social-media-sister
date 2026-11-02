import opentype from "opentype.js";

// The Cyber Suite font shelf. Every font Vanessa has bought lives in public/fonts/suite.
// Each has an .otf (drawn glyph by glyph on the canvas so curly alternates and wide spacing work),
// a .woff2 (for normal page text), and an .alts.json listing the alternate letters in the font.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type SuiteFont = { id: string; name: string; family: string; italic?: boolean; weight?: number; note?: string };

export const SUITE_FONTS: SuiteFont[] = [
  { id: "mofllig", name: "Mofllig", family: "SuiteMofllig", note: "Ligatures join by themselves" },
  { id: "blushade-regular", name: "Blushade", family: "SuiteBlushade" },
  { id: "blushade-italic", name: "Blushade Italic", family: "SuiteBlushadeItalic", italic: true },
  { id: "glowgirl", name: "Glowgirl", family: "SuiteGlowgirl" },
  { id: "slightly-moon-regular", name: "Slightly Moon", family: "SuiteSlightlyMoon" },
  { id: "slightly-moon-italic", name: "Slightly Moon Italic", family: "SuiteSlightlyMoonItalic", italic: true },
  { id: "claudia", name: "Claudia", family: "SuiteClaudia" },
  { id: "clovenia", name: "Clovenia", family: "SuiteClovenia" },
  { id: "behind", name: "Behind", family: "SuiteBehind" },
  { id: "mitchaella-modern-unique", name: "Mitchaella", family: "SuiteMitchaella" },
  { id: "rolive", name: "Rolive", family: "SuiteRolive" },
  { id: "miera", name: "Miera", family: "SuiteMiera" },
  { id: "graze", name: "Graze", family: "SuiteGraze" },
  { id: "avoraty", name: "Avoraty", family: "SuiteAvoraty" },
  { id: "annyra", name: "Annyra", family: "SuiteAnnyra" },
  { id: "geonnix", name: "Geonnix", family: "SuiteGeonnix" },
  { id: "syora", name: "Syora", family: "SuiteSyora" },
  { id: "syora-italic", name: "Syora Italic", family: "SuiteSyoraItalic", italic: true },
  { id: "enchantedlove-sans", name: "Enchanted Love Sans", family: "SuiteEnchantedLove" },
  { id: "kgbrylliant-regular", name: "KG Brylliant", family: "SuiteBrylliant" },
  { id: "cfragitras-regular", name: "CF Ragitras", family: "SuiteRagitras" },
  { id: "cfragitras-italic", name: "CF Ragitras Italic", family: "SuiteRagitrasItalic", italic: true },
  { id: "cfragitras-bold", name: "CF Ragitras Bold", family: "SuiteRagitrasBold" },
  { id: "cfragitras-bolditalic", name: "CF Ragitras Bold Italic", family: "SuiteRagitrasBoldItalic", italic: true },
  { id: "just-sans-exlight", name: "JUST Sans ExLight", family: "SuiteJustExLight" },
  { id: "just-sans-light", name: "JUST Sans Light", family: "SuiteJustLight" },
  { id: "just-sans-regular", name: "JUST Sans", family: "SuiteJustRegular" },
  { id: "just-sans-medium", name: "JUST Sans Medium", family: "SuiteJustMedium" },
  { id: "just-sans-semibold", name: "JUST Sans SemiBold", family: "SuiteJustSemiBold" },
  { id: "just-sans-bold", name: "JUST Sans Bold", family: "SuiteJustBold" },
  { id: "just-sans-exbold", name: "JUST Sans ExBold", family: "SuiteJustExBold" },
];

export const fontById = (id: string) => SUITE_FONTS.find((f) => f.id === id) || SUITE_FONTS[0];

let cssDone = false;
/** Adds @font-face rules so the fonts also work for ordinary page text. */
export function injectSuiteFontCss() {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const css = SUITE_FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${BASE}/fonts/suite/${f.id}.woff2") format("woff2"),url("${BASE}/fonts/suite/${f.id}.otf") format("opentype");font-display:swap;}`,
  ).join("\n");
  const el = document.createElement("style");
  el.setAttribute("data-suite-fonts", "1");
  el.textContent = css;
  document.head.appendChild(el);
}

export type AltData = { alts: Record<string, string[]>; chars: Record<string, string> };
export type LoadedFont = { id: string; font: opentype.Font; byName: Map<string, opentype.Glyph>; data: AltData };

const cache = new Map<string, Promise<LoadedFont>>();

export function loadSuiteFont(id: string): Promise<LoadedFont> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const [buf, data] = await Promise.all([
        fetch(`${BASE}/fonts/suite/${id}.otf`).then((r) => {
          if (!r.ok) throw new Error("font missing");
          return r.arrayBuffer();
        }),
        fetch(`${BASE}/fonts/suite/${id}.alts.json`).then((r) => (r.ok ? r.json() : { alts: {}, chars: {} })) as Promise<AltData>,
      ]);
      const font = opentype.parse(buf);
      const byName = new Map<string, opentype.Glyph>();
      for (let i = 0; i < font.glyphs.length; i++) {
        const g = font.glyphs.get(i);
        if (g.name) byName.set(g.name, g);
      }
      return { id, font, byName, data };
    })();
    cache.set(id, p);
    p.catch(() => cache.delete(id));
  }
  return p;
}

export type SwapRate = "off" | "starts" | "some" | "all";

/** Everything that makes the title look the way it does. Saved once, used by every post. */
export type TitleStyle = {
  fontId: string;
  tracking: number; // thousandths of an em between letters
  upper: boolean;
  ligatures: boolean;
  swaps: Record<string, string>; // plain letter -> chosen alternate glyph name
  rate: SwapRate; // how often the chosen curly letters appear
};

export const DEFAULT_TITLE_STYLE: TitleStyle = {
  fontId: "mofllig",
  tracking: 120,
  upper: false,
  ligatures: true,
  swaps: {},
  rate: "some",
};

export const TITLE_STYLE_KEY = "suite-title-style-v1"; // the "everyone" look
const clientKey = (slug: string) => `suite-title-style-client-${slug}`;

/** A short, steady key for a client name, so each client keeps their own look. */
export const clientSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function readKey(key: string): TitleStyle | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...DEFAULT_TITLE_STYLE, ...JSON.parse(raw) };
  } catch {
    /* private window */
  }
  return null;
}

/** The look saved for this client, else the one saved for everyone, else the default. */
export function readTitleStyle(client?: string): TitleStyle {
  return (client ? readKey(clientKey(client)) : null) || readKey(TITLE_STYLE_KEY) || { ...DEFAULT_TITLE_STYLE };
}

export function hasClientStyle(client: string): boolean {
  return readKey(clientKey(client)) !== null;
}

export function saveTitleStyle(s: TitleStyle, client?: string) {
  try {
    localStorage.setItem(client ? clientKey(client) : TITLE_STYLE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clearClientStyle(client: string) {
  try {
    localStorage.removeItem(clientKey(client));
  } catch {
    /* ignore */
  }
}

type Placed = { g: opentype.Glyph; x: number };

function shapeWord(lf: LoadedFont, word: string, style: TitleStyle, counts: Map<string, number>): opentype.Glyph[] {
  const { font, byName, data } = lf;
  const chars = Array.from(word);
  let glyphs: opentype.Glyph[];
  if (style.ligatures) {
    glyphs = font.stringToGlyphs(word);
    if (glyphs.length !== chars.length) {
      // a ligature formed, so letters no longer line up one to one; keep it as the font drew it
      return glyphs;
    }
  } else {
    glyphs = chars.map((c) => font.charToGlyph(c));
  }
  if (style.rate === "off") return glyphs;
  return glyphs.map((g, i) => {
    const ch = chars[i];
    const swapName = style.swaps[ch];
    if (!swapName || !data.chars[ch]) return g;
    const n = counts.get(ch) || 0;
    counts.set(ch, n + 1);
    const use = style.rate === "all" || (style.rate === "starts" && i === 0) || (style.rate === "some" && n % 3 === 0);
    const alt = use ? byName.get(swapName) : undefined;
    return alt || g;
  });
}

function placeWord(lf: LoadedFont, glyphs: opentype.Glyph[], size: number, trackPx: number): { items: Placed[]; width: number } {
  const scale = size / lf.font.unitsPerEm;
  const items: Placed[] = [];
  let x = 0;
  for (let i = 0; i < glyphs.length; i++) {
    items.push({ g: glyphs[i], x });
    let adv = (glyphs[i].advanceWidth || 0) * scale;
    if (i < glyphs.length - 1) {
      let kern = 0;
      try {
        kern = lf.font.getKerningValue(glyphs[i], glyphs[i + 1]) * scale;
      } catch {
        kern = 0;
      }
      adv += kern + trackPx;
    }
    x += adv;
  }
  return { items, width: x };
}

export type TitleLayout = { lines: { words: { items: Placed[]; width: number }[]; width: number }[]; lineHeight: number; size: number };

/** Lays the text out in lines no wider than maxW. */
export function layoutTitle(lf: LoadedFont, text: string, style: TitleStyle, size: number, maxW: number, lineHeight = 1.15): TitleLayout {
  const trackPx = (style.tracking / 1000) * size;
  const scale = size / lf.font.unitsPerEm;
  const space = (lf.font.charToGlyph(" ").advanceWidth || lf.font.unitsPerEm * 0.3) * scale + trackPx;
  const src = style.upper ? text.toUpperCase() : text;
  const counts = new Map<string, number>();
  const lines: TitleLayout["lines"] = [];
  for (const para of src.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean).map((w) => placeWord(lf, shapeWord(lf, w, style, counts), size, trackPx));
    let cur: { words: typeof words; width: number } = { words: [], width: 0 };
    for (const w of words) {
      const next = cur.words.length ? cur.width + space + w.width : w.width;
      if (cur.words.length && next > maxW) {
        lines.push(cur);
        cur = { words: [w], width: w.width };
      } else {
        cur = { words: [...cur.words, w], width: next };
      }
    }
    lines.push(cur);
  }
  return { lines, lineHeight, size };
}

export function titleHeight(l: TitleLayout) {
  return l.lines.length * l.size * l.lineHeight;
}

/** Draws the layout. y is the top of the first line. */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  lf: LoadedFont,
  layout: TitleLayout,
  style: TitleStyle,
  x: number,
  y: number,
  align: "left" | "center",
  boxW: number,
  color: string | CanvasGradient,
) {
  const { size, lineHeight } = layout;
  const scale = size / lf.font.unitsPerEm;
  const asc = (lf.font.ascender || lf.font.unitsPerEm * 0.8) * scale;
  const trackPx = (style.tracking / 1000) * size;
  const space = (lf.font.charToGlyph(" ").advanceWidth || lf.font.unitsPerEm * 0.3) * scale + trackPx;
  ctx.save();
  ctx.fillStyle = color;
  layout.lines.forEach((line, li) => {
    const base = y + li * size * lineHeight + asc * 0.92;
    let cx = align === "center" ? x + (boxW - line.width) / 2 : x;
    for (const w of line.words) {
      for (const it of w.items) {
        const p = it.g.getPath(cx + it.x, base, size);
        p.fill = color as string;
        p.draw(ctx);
      }
      cx += w.width + space;
    }
  });
  ctx.restore();
}

/** A single glyph on a small canvas, used for the alternate pickers. */
export function drawGlyphTo(canvas: HTMLCanvasElement, lf: LoadedFont, g: opentype.Glyph, color = "#1b1b1b") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const size = h * 0.62;
  const scale = size / lf.font.unitsPerEm;
  const adv = (g.advanceWidth || 0) * scale;
  const x = (w - adv) / 2;
  const base = h * 0.7;
  const p = g.getPath(x, base, size);
  p.fill = color;
  p.draw(ctx);
}
