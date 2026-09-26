import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, ImageIcon,
  Sparkles, Palette, RotateCcw, Wand2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { readFileAsText } from "@/lib/csv-format";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

loadGoogleFonts();
if (typeof document !== "undefined" && !document.getElementById("stylish-fonts")) {
  const link = document.createElement("link");
  link.id = "stylish-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800;900&family=Jost:wght@300;400;500;600&family=Poppins:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&display=swap";
  document.head.appendChild(link);
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SIDE_PAD = 90;
const STYLE_STORAGE_KEY = "stylish-style-v4";

// ---------------------------------------------------------------------------
// Types and defaults
// ---------------------------------------------------------------------------

type CoverLayout = "band" | "centred" | "block" | "split" | "serif" | "plain" | "behind"
  | "fullbleed" | "blur" | "strip" | "diagonal" | "behind2" | "polaroid" | "sidebar" | "frame" | "layered";

type Style = {
  // Slide 1 (cover)
  coverLayout: CoverLayout;
  cvFont: string;
  cvSubFont: string;
  plainFont: string;    // cover option 6: its own headline and subheading fonts
  plainSubFont: string;
  behindFont: string;   // cover option 7: heading sits behind the person
  behindSubFont: string;
  lf: Record<string, { h: string; s: string }>; // fonts for cover options 8 to 16
  cvBlur: number;   // motion blur, option 9
  cvAngle: number;  // heading angle, option 11
  cvAll: boolean;   // one pair of text colours on every cover
  cvAllColour: string;
  cvAllSubColour: string;
  cvWeight: number;
  cvSubWeight: number;
  cvCaps: boolean;
  cvSubCaps: boolean;
  cvTracking: number;
  cvSubTracking: number;
  cvScrim: number;
  cvSize: number;
  cvSubSize: number;
  cvColour: string;
  cvSubColour: string;
  cvBlock: string;
  cvBand: string;
  cvBandOn: boolean;
  cvPhoto: number;   // photo share of the slide, in percent
  cvFocus: number;   // where the photo is cropped, in percent
  cvY: number;       // vertical position, centred cover only
  // Slides 2 onwards (photo with text over)
  layout: "editorial" | "classic";
  fontFamily: string;   // small labels
  displayFont: string;  // slide text
  textWeight: number;
  textItalic: boolean;
  bodySize: number;
  ctaSize: number;
  bodyColour: string;
  ctaColour: string;
  lineColour: string;
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "centre";
  bodyY: number;
  overlay: number;
  scrim: number;
  shadow: boolean;
  background: string;
  frame: boolean;
  counter: boolean;
  brandMark: boolean;
  arrow: boolean;
  rule: boolean;
  showLogo: boolean;
};

const INTER_TIGHT = "'Inter Tight', sans-serif";
const F_BREUL = "'Breul Grotesk', 'Inter Tight', sans-serif";
const F_HELV = "'Helvetica Now Display', 'Inter Tight', sans-serif";
const F_NOW = "'Now', 'Poppins', sans-serif";
const F_EVOLVENTA = "'Evolventa', 'Montserrat', sans-serif";
const F_INSTRUMENT = "'Instrument Serif', serif";

// Fonts each cover is designed around. If a font is not free to bundle, the person adds their own copy.
const COVER_WANTS: Record<CoverLayout, string[]> = {
  band: ["Breul Grotesk"],
  centred: ["Evolventa"],
  block: ["Helvetica Now Display"],
  split: ["Now"],
  serif: [],
  plain: [],
  behind: [],
  fullbleed: [], blur: [], strip: [], diagonal: [], behind2: [], polaroid: [], sidebar: [], frame: [], layered: [],
};

// Each cover layout brings its own type, colours and proportions. Everything can be changed afterwards.
const COVER_PRESETS: Record<CoverLayout, Partial<Style>> = {
  band: {
    coverLayout: "band", cvFont: F_BREUL, cvSubFont: F_BREUL, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: -2, cvSubTracking: 4, cvSize: 150, cvSubSize: 30, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#faf9f5", cvBandOn: false, cvPhoto: 74, cvFocus: 30,
  },
  centred: {
    coverLayout: "centred", cvFont: F_EVOLVENTA, cvSubFont: "'Montserrat', sans-serif", cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: 1, cvSubTracking: 2, cvSize: 170, cvSubSize: 46, cvScrim: 0,
    cvColour: "#38b6ff", cvSubColour: "#ffffff", cvPhoto: 100, cvFocus: 50, cvY: 58,
  },
  block: {
    coverLayout: "block", cvFont: F_HELV, cvSubFont: F_HELV, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: -6, cvSubTracking: 1, cvSize: 300, cvSubSize: 32, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#e4e2dd", cvBandOn: false, cvPhoto: 38, cvFocus: 35,
  },
  split: {
    coverLayout: "split", cvFont: F_NOW, cvSubFont: F_NOW, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0, cvSize: 120, cvSubSize: 46, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#ffffff", cvBand: "#666666", cvBandOn: true, cvPhoto: 47.5, cvFocus: 50,
  },
  plain: {
    coverLayout: "plain", cvWeight: 700, cvSubWeight: 400,
    cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0, cvSize: 150, cvSubSize: 56, cvScrim: 0,
    cvColour: "#ffffff", cvSubColour: "#ffffff", cvBlock: "#1f2a44",
  },
  fullbleed: {
    coverLayout: "fullbleed", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0,
    cvSize: 300, cvSubSize: 54, cvScrim: 12, cvColour: "#f5f5f5", cvSubColour: "#f5f5f5", cvY: 16,
  },
  blur: {
    coverLayout: "blur", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: -3, cvSubTracking: 0,
    cvSize: 190, cvSubSize: 40, cvScrim: 0, cvBlur: 90, cvColour: "#ffffff", cvSubColour: "#ffffff", cvY: 42,
  },
  strip: {
    coverLayout: "strip", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 1, cvSubTracking: 0,
    cvSize: 120, cvSubSize: 46, cvScrim: 0, cvColour: "#0d0d0d", cvSubColour: "#0d0d0d", cvBlock: "#fff9e8",
  },
  diagonal: {
    coverLayout: "diagonal", cvWeight: 300, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 3, cvSubTracking: 1,
    cvSize: 150, cvSubSize: 50, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff", cvAngle: 24, cvY: 31,
  },
  behind2: {
    coverLayout: "behind2", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 0,
    cvSize: 420, cvSubSize: 40, cvScrim: 0, cvColour: "#274585", cvSubColour: "#274585", cvBlock: "#ffffff", cvY: 34,
  },
  polaroid: {
    coverLayout: "polaroid", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0,
    cvSize: 96, cvSubSize: 44, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff",
  },
  sidebar: {
    coverLayout: "sidebar", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 1,
    cvSize: 150, cvSubSize: 34, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff", cvPhoto: 50, cvY: 29,
  },
  frame: {
    coverLayout: "frame", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: -2, cvSubTracking: 0,
    cvSize: 100, cvSubSize: 44, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff",
  },
  layered: {
    coverLayout: "layered", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 1,
    cvSize: 92, cvSubSize: 30, cvScrim: 8, cvColour: "#1c1c1c", cvSubColour: "#1c1c1c", cvBlock: "#ececec",
  },
  behind: {
    coverLayout: "behind", cvWeight: 400, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 0, cvSize: 420, cvSubSize: 36, cvScrim: 0,
    cvColour: "#1c1c1c", cvSubColour: "#1c1c1c", cvBlock: "#efefef", cvY: 31,
  },
  serif: {
    coverLayout: "serif", cvFont: F_INSTRUMENT, cvSubFont: F_INSTRUMENT, cvWeight: 400, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: false, cvTracking: -4, cvSubTracking: -2, cvSize: 170, cvSubSize: 66, cvScrim: 62,
    cvColour: "#ffffff", cvSubColour: "#ffffff", cvPhoto: 100, cvFocus: 50, cvY: 90,
  },
};

const LOOK_EDITORIAL: Partial<Style> = {
  layout: "editorial",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Cormorant Garamond', serif",
  textWeight: 400,
  textItalic: false,
  bodySize: 78,
  ctaSize: 82,
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: false,
  letterSpacing: 0,
  lineHeight: 1.14,
  align: "left",
  bodyY: 86,
  overlay: 0,
  scrim: 64,
  shadow: false,
  frame: true,
  counter: true,
  brandMark: true,
  arrow: true,
  rule: true,
};

const LOOK_CLASSIC: Partial<Style> = {
  layout: "classic",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Montserrat', sans-serif",
  textWeight: 300,
  textItalic: false,
  bodySize: 62,
  ctaSize: 66,
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: true,
  letterSpacing: 1,
  lineHeight: 1.25,
  align: "centre",
  bodyY: 50,
  overlay: 12,
  scrim: 0,
  shadow: true,
  frame: false,
  counter: false,
  brandMark: false,
  arrow: false,
  rule: false,
};

const DEFAULT_STYLE: Style = {
  ...COVER_PRESETS.band,
  ...LOOK_EDITORIAL,
  plainFont: "'Cormorant Garamond', serif",
  plainSubFont: "'Montserrat', sans-serif",
  behindFont: "'Anton', sans-serif",
  behindSubFont: "'Inter Tight', sans-serif",
  lf: {
    fullbleed: { h: "'Bebas Neue', sans-serif", s: "'Playfair Display', serif" },
    blur: { h: "'Instrument Serif', serif", s: "'Inter Tight', sans-serif" },
    strip: { h: "'Bebas Neue', sans-serif", s: "'Poppins', sans-serif" },
    diagonal: { h: "'Jost', sans-serif", s: "'Jost', sans-serif" },
    behind2: { h: "'Anton', sans-serif", s: "'Montserrat', sans-serif" },
    polaroid: { h: "'DM Serif Display', serif", s: "'Inter Tight', sans-serif" },
    sidebar: { h: "'DM Serif Display', serif", s: "'Inter Tight', sans-serif" },
    frame: { h: "'Playfair Display', serif", s: "'Playfair Display', serif" },
    layered: { h: "'Anton', sans-serif", s: "'Inter Tight', sans-serif" },
  },
  cvBlur: 90,
  cvAngle: 24,
  cvAll: false,
  cvAllColour: "#ffffff",
  cvAllSubColour: "#ffffff",
  cvBand: "#666666",
  cvY: 58,
  cvScrim: 0,
  background: "#8a8a8a",
  showLogo: false,
} as Style;

// Vanessa never wants em dashes (or spaced en dashes) in captions.
const noDashes = (t: string) =>
  t.replace(/(\d)\u2013(\d)/g, "$1-$2").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/,\s*,/g, ",");

type Post = {
  id: string;
  texts: string[]; // headline, subtitle, ...text columns, cta
  caption: string;
  captionBusy: boolean;
  selected: boolean;
  cover?: CoverLayout; // this post's own cover option. Empty means it follows the main choice.
  coverColour?: string;    // this post's own headline colour on slide 1. Empty means the option's colour.
  coverSubColour?: string; // and its subtitle colour
  coverBlockColour?: string; // its band or block colour (band, block and split covers)
  coverBandColour?: string;  // and the split cover's bottom band
};

type SlideKind = "cover" | "body" | "cta";
type SlideSpec = { kind: SlideKind; text: string; sub: string };

const COVER_FONTS = [
  { label: "Inter Tight", value: INTER_TIGHT },
  { label: "Instrument Serif", value: F_INSTRUMENT },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Jost", value: "'Jost', sans-serif" },
  { label: "Anton", value: "'Anton', sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Barlow Condensed", value: "'Barlow Condensed', sans-serif" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', serif" },
];

const COVER_WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi bold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra bold", value: 800 },
  { label: "Black", value: 900 },
];

const WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Semi bold", value: 600 },
  { label: "Bold", value: 700 },
];

const TONES = [
  { value: "1", label: "Northern grit" },
  { value: "2", label: "Storyteller, whimsical" },
  { value: "3", label: "Funny and blunt" },
  { value: "4", label: "Professional with personality" },
  { value: "5", label: "Feral, savage, sarcastic" },
];

const SAMPLE_CSV = [
  "headline,subtitle,text 1,text 2,text 3,cta",
  `"5 reasons","to always wear SPF","Your future skin will thank you","It keeps skin care at the forefront of your mind","You're teaching the youth how to grow old properly.","Book a skin consultation"`,
].join("\n");

// ---------------------------------------------------------------------------
// CSV to slides
// ---------------------------------------------------------------------------

function buildSlides(texts: string[]): SlideSpec[] {
  const t = texts.map(x => (x ?? "").trim());
  const out: SlideSpec[] = [];
  if (t[0]) out.push({ kind: "cover", text: t[0], sub: t[1] ?? "" });
  const last = t.length >= 3 ? t.length - 1 : -1;
  for (let i = 2; i < t.length; i++) {
    if (!t[i]) continue;
    out.push({ kind: i === last ? "cta" : "body", text: t[i], sub: "" });
  }
  return out;
}

const COVER_ORDER: CoverLayout[] = ["band", "centred", "block", "split", "serif", "plain", "behind", "fullbleed", "blur", "strip", "diagonal", "behind2", "polaroid", "sidebar", "frame", "layered"];

// The name of each cover's colour block, for the colour picker. Covers not listed have no block.
const BLOCK_LABEL: Partial<Record<CoverLayout, string>> = {
  band: "Band colour", block: "Block colour", split: "Block colour", plain: "Background colour", behind: "Background colour",
  behind2: "Background colour", strip: "Band colour", polaroid: "Background colour", sidebar: "Band colour", frame: "Panel colour", layered: "Card colour",
};

// Each cover's headline and subtitle fonts.
function faces(style: Style, layout: CoverLayout): [string, string] {
  if (layout === "plain") return [style.plainFont, style.plainSubFont];
  if (layout === "behind") return [style.behindFont, style.behindSubFont];
  const f = style.lf?.[layout];
  return f ? [f.h, f.s] : [style.cvFont, style.cvSubFont];
}
// "Give each post a different cover" goes round the five photo covers only. Option 6 is chosen by hand.
const MIX_ORDER: CoverLayout[] = ["band", "centred", "block", "split", "serif"];

// The look of a slide. A post that has its own cover option gets that option's designed fonts, colours and
// proportions on slide 1. Every other slide, and every post on the main choice, uses the settings as they are.
function styleForSlide(style: Style, post: Post, kind: SlideKind): Style {
  if (kind !== "cover") return style;
  let out = style;
  if (post.cover && post.cover !== style.coverLayout) out = { ...style, ...COVER_PRESETS[post.cover] } as Style;
  if (style.cvAll) out = { ...out, cvColour: style.cvAllColour, cvSubColour: style.cvAllSubColour };
  if (post.coverColour) out = { ...out, cvColour: post.coverColour };
  if (post.coverSubColour) out = { ...out, cvSubColour: post.coverSubColour };
  if (post.coverBlockColour) out = { ...out, cvBlock: post.coverBlockColour };
  if (post.coverBandColour) out = { ...out, cvBand: post.coverBandColour };
  return out;
}

function naturalSort(a: File, b: File) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

// Fills every slide by cycling through the photos. Slide 1 of each post is taken from the pool in turn,
// so covers do not repeat until every photo has been a cover. The other slides carry on round the pool
// without ever repeating the cover, or each other, inside the same post (as far as the pool allows).
function planReusedPhotos(pool: File[], slideCounts: number[]): File[][] {
  const n = pool.length;
  if (!n) return slideCounts.map(() => []);
  let body = 1;
  return slideCounts.map((count, p) => {
    if (count <= 0) return [];
    const cover = p % n;
    const picked = [cover];
    let guard = 0;
    while (picked.length < count && guard++ < n * count + 10) {
      const idx = body % n;
      body++;
      if (n > 1 && picked.length < n && picked.includes(idx)) continue;
      // Pool smaller than the slides: allow repeats, but never the cover or the slide just before.
      if (n > 1 && picked.length >= n && (idx === cover || idx === picked[picked.length - 1])) continue;
      picked.push(idx);
    }
    while (picked.length < count) picked.push(cover);
    return picked.map(i => pool[i]);
  });
}

// ---------------------------------------------------------------------------
// Image preparation. Each photo is shrunk once (never cropped, so it can be dragged
// around later) and kept as a compressed blob so a large batch does not hold
// gigabytes of pixels in memory.
// ---------------------------------------------------------------------------

const MAX_PHOTO_SIDE = 2400;
const prepared = new Map<File, Promise<Blob | null>>();
const photoDims = new Map<File, { w: number; h: number }>();

function prepareImage(file: File): Promise<Blob | null> {
  const existing = prepared.get(file);
  if (existing) return existing;
  const p = (async () => {
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, MAX_PHOTO_SIDE / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * s));
      const h = Math.max(1, Math.round(bmp.height * s));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      photoDims.set(file, { w, h });
      return await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), "image/jpeg", 0.93));
    } catch {
      return null;
    }
  })();
  prepared.set(file, p);
  return p;
}

// Where a photo sits inside its frame, in percent (50, 50 is centred). Dragging changes it per slide.
type PhotoPos = { x: number; y: number };

// The frame a slide's photo fills, so a drag can be turned into a shift of the photo.
function photoArea(kind: SlideKind, style: Style): { w: number; h: number } {
  if (kind !== "cover") return { w: W, h: H };
  if (style.coverLayout === "band" || style.coverLayout === "block") return { w: W, h: Math.round(H * (style.cvPhoto / 100)) };
  if (style.coverLayout === "split") return { w: Math.round(W * (style.cvPhoto / 100)), h: H };
  return { w: W, h: H };
}

function defaultPos(kind: SlideKind, style: Style): PhotoPos {
  if (kind !== "cover") return { x: 50, y: 50 };
  if (style.coverLayout === "band" || style.coverLayout === "block") return { x: 50, y: style.cvFocus };
  if (style.coverLayout === "split") return { x: style.cvFocus, y: 50 };
  return { x: 50, y: 50 };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function loadLogo(preset: ClientPreset | null): Promise<HTMLImageElement | null> {
  if (!preset?.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px}px`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}

function widest(ctx: CanvasRenderingContext2D, lines: string[]) {
  return lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
}

// Wraps text, then narrows the line width as far as it can without adding a line,
// so the last line is never a lonely word.
function balancedWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const base = wrapText(ctx, text, maxW);
  if (base.length < 2) return base;
  let best = base;
  for (let w = maxW - 12; w >= maxW * 0.5; w -= 12) {
    const l = wrapText(ctx, text, w);
    if (l.length > base.length || widest(ctx, l) > maxW) break;
    best = l;
  }
  return best;
}

type Block = { lines: string[]; font: string; lineH: number; colour: string; gapBefore: number; spacing: number };

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, position: string, size: number) {
  if (!position || position === "none") return;
  const pad = 44;
  const asp = logo.naturalWidth / logo.naturalHeight;
  const lw = asp >= 1 ? size : size * asp;
  const lh = asp >= 1 ? size / asp : size;
  let x = pad, y = pad;
  if (position === "top-right") x = W - lw - pad;
  else if (position === "bottom-left") y = H - lh - pad;
  else if (position === "bottom-right") { x = W - lw - pad; y = H - lh - pad; }
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logo, x, y, lw, lh);
  ctx.globalAlpha = 1;
}

type RenderMeta = { index: number; total: number; extras?: (File | null)[] };

function drawPhotoIn(
  ctx: CanvasRenderingContext2D, bmp: ImageBitmap,
  x: number, y: number, w: number, h: number, pos: PhotoPos,
) {
  const sc = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * sc;
  const dh = bmp.height * sc;
  const dx = x + (w - dw) * (pos.x / 100);
  const dy = y + (h - dh) * (pos.y / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(bmp, dx, dy, dw, dh);
  ctx.restore();
}

// Shrinks a heading to fit: one line if it can stay above 55% of the size, otherwise wrapped and balanced.
function fitHeading(
  ctx: CanvasRenderingContext2D, text: string, fontAt: (size: number) => string,
  maxW: number, maxSize: number, maxLines = 3,
): { size: number; lines: string[] } {
  if (!text.includes("\n")) {
    for (let sz = maxSize; sz >= maxSize * 0.55; sz -= 4) {
      ctx.font = fontAt(sz);
      if (ctx.measureText(text).width <= maxW) return { size: sz, lines: [text] };
    }
  }
  let lines: string[] = [text];
  let size = maxSize;
  for (let sz = maxSize; sz >= 30; sz -= 4) {
    ctx.font = fontAt(sz);
    lines = balancedWrap(ctx, text, maxW);
    size = sz;
    if (lines.length <= maxLines && widest(ctx, lines) <= maxW) break;
  }
  return { size, lines };
}

// Cuts the person out of a photo, in this browser (nothing is uploaded). Done one at a time and remembered,
// because it takes several seconds the first time.
const cutoutBlobs = new WeakMap<File, Promise<Blob | null>>();
let cutoutQueue: Promise<unknown> = Promise.resolve();
let cutoutsWaiting = 0;

function cutoutBlob(file: File): Promise<Blob | null> {
  const existing = cutoutBlobs.get(file);
  if (existing) return existing;
  cutoutsWaiting++;
  const job = cutoutQueue.then(async () => {
    const toastId = "stylish-cutout";
    toast.loading("Cutting the person out of the photo (the first time takes a little while)", { id: toastId });
    try {
      const src = await prepareImage(file);
      if (!src) return null;
      const { removeBackground } = await import("@imgly/background-removal");
      return await removeBackground(src, { model: "isnet", output: { format: "image/png", quality: 0.95 } });
    } catch {
      toast.error("Could not cut the person out of a photo, so I kept the whole photo");
      return null;
    } finally {
      cutoutsWaiting--;
      if (cutoutsWaiting <= 0) toast.dismiss(toastId);
    }
  });
  cutoutQueue = job.catch(() => null);
  cutoutBlobs.set(file, job);
  return job;
}

async function getCutout(file: File): Promise<ImageBitmap | null> {
  const blob = await cutoutBlob(file);
  return blob ? createImageBitmap(blob) : null;
}


// ---------------------------------------------------------------------------
// Cover options 8 to 16
// ---------------------------------------------------------------------------

const MORE_LAYOUTS = new Set<CoverLayout>(["fullbleed", "blur", "strip", "diagonal", "behind2", "polaroid", "sidebar", "frame", "layered"]);

// A small print style card, drawn tilted around its centre. Anything passed as inner is drawn in the tilted space.
function drawPolaroid(
  ctx: CanvasRenderingContext2D, bmp: ImageBitmap | null, cx: number, cy: number, w: number, h: number, rot: number,
  card: string, pad: number, capH: number, inner?: () => void,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = card;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (bmp) drawPhotoIn(ctx, bmp, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad - capH, { x: 50, y: 50 });
  inner?.();
  ctx.restore();
}

function drawBinderClip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#c9c9c9"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-32, 10); ctx.lineTo(-32, -70); ctx.arc(0, -70, 32, Math.PI, 0); ctx.lineTo(32, 10); ctx.stroke();
  ctx.fillStyle = "#141414";
  ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.lineTo(62, 86); ctx.lineTo(-62, 86); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPaperclip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#d9998a"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, -50); ctx.arc(18, -50, 18, Math.PI, 0); ctx.lineTo(36, 66); ctx.arc(24, 66, 12, 0, Math.PI); ctx.lineTo(12, -30); ctx.stroke();
  ctx.restore();
}

async function drawCoverMore(
  ctx: CanvasRenderingContext2D, spec: SlideSpec, photo: File | null, extras: (File | null)[],
  style: Style, layout: CoverLayout, at: PhotoPos,
) {
  const [hf, sf] = faces(style, layout);
  const head = style.cvCaps ? spec.text.toUpperCase() : spec.text;
  const sub = spec.sub ? (style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub) : "";
  const headFont = (sz: number) => `${style.cvWeight} ${sz}px ${hf}`;
  const subLineH = Math.round(style.cvSubSize * 1.3);
  ctx.textBaseline = "top";
  const drawLines = (ls: string[], x: number, y: number, lh: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    for (const l of ls) { ctx.fillText(l, x, y); y += lh; }
    return y;
  };
  const setHead = (sz: number) => { ctx.font = headFont(sz); setSpacing(ctx, style.cvTracking); ctx.fillStyle = style.cvColour; };
  const setSub = () => { ctx.font = `${style.cvSubWeight} ${style.cvSubSize}px ${sf}`; setSpacing(ctx, style.cvSubTracking); ctx.fillStyle = style.cvSubColour; };
  const opened: ImageBitmap[] = [];
  const open = async (f: File | null) => {
    if (!f) return null;
    const blob = await prepareImage(f);
    const b = blob ? await createImageBitmap(blob) : null;
    if (b) opened.push(b);
    return b;
  };
  const fill = (c: string) => { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); };
  const scrim = () => { if (style.cvScrim > 0) { ctx.fillStyle = `rgba(0,0,0,${style.cvScrim / 100})`; ctx.fillRect(0, 0, W, H); } };
  // Headline: from a top edge, or centred on a height.
  const heading = (x: number, where: { top?: number; centre?: number }, maxW: number, maxLines: number, align: CanvasTextAlign, factor = 0.96) => {
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, head, headFont, maxW, style.cvSize, maxLines);
    const lh = Math.round(fit.size * factor);
    const top = where.top ?? Math.round((where.centre ?? H / 2) - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    return { bottom: drawLines(fit.lines, x, top, lh, align), size: fit.size };
  };
  const subtitle = (x: number, y: number, maxW: number, align: CanvasTextAlign) => {
    if (!sub) return y;
    setSub();
    return drawLines(balancedWrap(ctx, sub, maxW), x, y, subLineH, align);
  };
  const shadowOn = () => { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12; };
  const shadowOff = () => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

  try {
    if (layout === "fullbleed") {
      // Option 8: full photo, big stacked headline top left, subtitle low down.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      scrim();
      heading(110, { top: Math.round((style.cvY / 100) * H) }, Math.round(W * 0.6), 4, "left");
      subtitle(110, Math.round(H * 0.77), Math.round(W * 0.7), "left");
    } else if (layout === "blur") {
      // Option 9: the photo smeared sideways like a long exposure, headline and subtitle in the middle.
      fill("#9a9a9a");
      const b = await open(photo);
      if (b) {
        const n = 30, span = Math.max(0, style.cvBlur);
        for (let i = 0; i < n; i++) {
          ctx.globalAlpha = 1 / (i + 1);
          const off = span ? (i / (n - 1) - 0.5) * span : 0;
          drawPhotoIn(ctx, b, off - span, 0, W + span * 2, H, at);
        }
        ctx.globalAlpha = 1;
      }
      scrim();
      const r = heading(W / 2, { centre: Math.round((style.cvY / 100) * H) }, W - 160, 3, "center", 1);
      subtitle(W / 2, r.bottom + 50, Math.round(W * 0.7), "center");
    } else if (layout === "strip") {
      // Option 10: big photo, a dark strip of three small photos, and a colour band with the words.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      const sx = Math.round(W * 0.1), sw = Math.round(W * 0.31);
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(sx, 0, sw, H);
      const gap = 30, ph = Math.round((H - gap * 4) / 3);
      for (let i = 0; i < 3; i++) {
        const e = await open(extras[i] ?? photo);
        if (e) drawPhotoIn(ctx, e, sx + 22, gap + i * (ph + gap), sw - 44, ph, { x: 50, y: 50 });
      }
      const bx = sx + sw, by = Math.round(H * 0.68), bh = Math.round(H * 0.26);
      ctx.fillStyle = style.cvBlock;
      ctx.fillRect(bx, by, W - bx, bh);
      const r = heading(bx + 50, { top: by + 44 }, W - bx - 100, 2, "left");
      subtitle(bx + 50, r.bottom + 14, W - bx - 100, "left");
    } else if (layout === "diagonal") {
      // Option 11: headline set on a slant across the photo.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      scrim();
      ctx.save();
      ctx.translate(Math.round(W * 0.4), Math.round((style.cvY / 100) * H));
      ctx.rotate((style.cvAngle * Math.PI) / 180);
      heading(0, { centre: 0 }, Math.round(W * 0.7), 2, "center", 1);
      ctx.restore();
      subtitle(80, Math.round(H * 0.56), Math.round(W * 0.5), "left");
    } else if (layout === "behind2") {
      // Option 12: like option 7, with the subtitle on the left.
      fill(style.cvBlock);
      const cut = photo ? await getCutout(photo) : null;
      const r = heading(W / 2, { centre: Math.round((style.cvY / 100) * H) }, W - 60, 2, "center");
      subtitle(52, r.bottom + 50, Math.round(W * 0.5), "left");
      if (cut) {
        drawPhotoIn(ctx, cut, 0, 0, W, H, at);
        cut.close();
      } else {
        const whole = await open(photo);
        if (whole) drawPhotoIn(ctx, whole, 0, 0, W, H, at);
      }
    } else if (layout === "polaroid") {
      // Option 13: your photo in a print in the middle, a second card behind with the subtitle, held by a clip.
      fill(style.cvBlock);
      const b = await open(photo);
      ctx.save();
      ctx.translate(Math.round(W * 0.55), Math.round(H * 0.56));
      ctx.rotate(-0.1);
      shadowOn();
      ctx.fillStyle = "#f3f1ed";
      ctx.fillRect(-W * 0.23, -H * 0.31, W * 0.46, H * 0.62);
      shadowOff();
      ctx.restore();
      if (sub) {
        ctx.save();
        ctx.translate(Math.round(W * 0.42), Math.round(H * 0.79));
        ctx.rotate(-0.1);
        setSub();
        drawLines(balancedWrap(ctx, sub, Math.round(W * 0.36)), 0, 0, subLineH, "left");
        ctx.restore();
      }
      const pw = Math.round(W * 0.51), phh = Math.round(H * 0.47), capH = Math.round(phh * 0.2);
      drawPolaroid(ctx, b, Math.round(W * 0.44), Math.round(H * 0.48), pw, phh, 0, "#f2f0ec", Math.round(W * 0.022), capH, () => {
        setSpacing(ctx, style.cvTracking);
        // One line in the print's caption strip, shrunk until the whole headline fits.
        let size = Math.min(style.cvSize, Math.round(capH * 0.8));
        setSpacing(ctx, style.cvTracking);
        while (size > 24) {
          ctx.font = headFont(size);
          if (ctx.measureText(head).width <= pw * 0.86) break;
          size -= 4;
        }
        setHead(size);
        ctx.textAlign = "center";
        ctx.fillText(head, 0, phh / 2 - capH + Math.round((capH - size) / 2));
      });
      drawBinderClip(ctx, Math.round(W * 0.44), Math.round(H * 0.48 - phh / 2 - 60));
    } else if (layout === "sidebar") {
      // Option 14: full photo with a colour band down the side carrying the words.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      const bx = Math.round(W * 0.07), bw = Math.round(W * (style.cvPhoto / 100));
      ctx.fillStyle = style.cvBlock;
      ctx.fillRect(bx, 0, bw, H);
      const r = heading(bx + 34, { top: Math.round((style.cvY / 100) * H) }, bw - 68, 3, "left");
      subtitle(bx + 50, r.bottom + 50, bw - 100, "left");
    } else if (layout === "frame") {
      // Option 15: photo behind, a white panel on top with two photos and two blocks of words on the diagonal.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      const px = Math.round(W * 0.1), py = Math.round(H * 0.1), pw = Math.round(W * 0.8), ph = Math.round(H * 0.8);
      ctx.fillStyle = style.cvBlock;
      ctx.fillRect(px, py, pw, ph);
      const cw = Math.round(pw / 2), ch = Math.round(ph / 2), m = 18;
      const e0 = await open(extras[0] ?? photo), e1 = await open(extras[1] ?? photo);
      if (e0) drawPhotoIn(ctx, e0, px + m, py + m, cw - m, ch - m, { x: 50, y: 50 });
      if (e1) drawPhotoIn(ctx, e1, px + cw, py + ch, cw - m, ch - m, { x: 50, y: 50 });
      heading(px + cw + cw / 2, { centre: py + ch / 2 }, cw - 40, 2, "center", 1);
      if (sub) {
        setSub();
        const ls = balancedWrap(ctx, sub, cw - 60);
        drawLines(ls, px + cw / 2, Math.round(py + ch + ch / 2 - (ls.length * subLineH) / 2), subLineH, "center");
      }
    } else if (layout === "layered") {
      // Option 16: photo at the back, a second photo in a print at the front, words on a card below it.
      fill("#777777");
      const back = await open(photo);
      if (back) drawPhotoIn(ctx, back, 0, 0, W, H, at);
      scrim();
      const front = await open(extras[0] ?? photo);
      const cardX = Math.round(W * 0.283), cardW = Math.round(W * 0.4), cardY = Math.round(H * 0.235), cardH = Math.round(H * 0.545);
      shadowOn();
      ctx.fillStyle = style.cvBlock;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      shadowOff();
      drawPolaroid(ctx, front, Math.round(W * 0.485), Math.round(H * 0.415), Math.round(W * 0.505), Math.round(H * 0.4), 0.03, "#f4f3f0", Math.round(W * 0.02), Math.round(H * 0.03));
      drawPaperclip(ctx, Math.round(W * 0.335), Math.round(H * 0.225));
      const r = heading(cardX + 26, { top: Math.round(H * 0.655) }, cardW - 52, 2, "left");
      subtitle(cardX + 26, r.bottom + 12, cardW - 52, "left");
    }
  } finally {
    for (const b of opened) b.close();
    setSpacing(ctx, 0);
  }
}

async function drawCover(
  ctx: CanvasRenderingContext2D, spec: SlideSpec, photo: File | null, style: Style,
  logo: HTMLImageElement | null, preset: ClientPreset | null, pos?: PhotoPos, extras: (File | null)[] = [],
) {
  const layout = style.coverLayout;
  const at = pos ?? defaultPos("cover", style);
  if (MORE_LAYOUTS.has(layout)) {
    await drawCoverMore(ctx, spec, photo, extras, style, layout, at);
    if (logo && style.showLogo && preset) drawLogo(ctx, logo, preset.logoPosition || "top-left", preset.logoSize || 110);
    return;
  }
  const bmp = photo && layout !== "plain" && layout !== "behind" ? await (async () => {
    const blob = await prepareImage(photo);
    return blob ? createImageBitmap(blob) : null;
  })() : null;

  const heading = style.cvCaps ? spec.text.toUpperCase() : spec.text;
  const subtitle = spec.sub ? (style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub) : "";
  const [headFace, subFace] = faces(style, layout);
  const headFont = (sz: number) => `${style.cvWeight} ${sz}px ${headFace}`;
  const subFont = `${style.cvSubWeight} ${style.cvSubSize}px ${subFace}`;
  const lineH = (sz: number) => Math.round(sz * (layout === "centred" ? 1.05 : layout === "serif" ? 0.9 : 0.94));
  const subLineH = Math.round(style.cvSubSize * (layout === "serif" ? 1.05 : 1.3));
  ctx.textBaseline = "top";

  const drawLines = (lines: string[], x: number, y: number, lh: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
    return y;
  };
  const setHead = (sz: number) => { ctx.font = headFont(sz); setSpacing(ctx, style.cvTracking); ctx.fillStyle = style.cvColour; };
  const setSub = () => { ctx.font = subFont; setSpacing(ctx, style.cvSubTracking); ctx.fillStyle = style.cvSubColour; };

  if (layout === "band") {
    const photoH = Math.round(H * (style.cvPhoto / 100));
    const bandH = H - photoH;
    ctx.fillStyle = style.cvBlock;
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, photoH, at);
    const x = 96, maxW = W - x * 2;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, 2);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? 26 + subLines.length * subLineH : 0);
    let y = photoH + Math.round((bandH - total) / 2);
    setHead(fit.size);
    y = drawLines(fit.lines, x, y, lh, "left") + 26;
    if (subLines.length) { setSub(); drawLines(subLines, x, y, subLineH, "left"); }
  } else if (layout === "block") {
    const photoH = Math.round(H * (style.cvPhoto / 100));
    ctx.fillStyle = style.cvBlock;
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, photoH, at);
    const x = 50, maxW = W - x * 2;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, 2);
    const lh = lineH(fit.size);
    const blockH = H - photoH;
    const top = photoH + Math.round(blockH * 0.42 - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    drawLines(fit.lines, x, top, lh, "left");
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, maxW);
      drawLines(subLines, x + 12, H - 130 - subLines.length * subLineH, subLineH, "left");
    }
  } else if (layout === "split") {
    const photoW = Math.round(W * (style.cvPhoto / 100));
    ctx.fillStyle = style.cvBlock;
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, photoW, H, at);
    if (style.cvBandOn) {
      ctx.fillStyle = style.cvBand;
      ctx.fillRect(photoW, H - 133, W - photoW, 133);
    }
    const x0 = photoW + 50, x1 = W - 60, maxW = x1 - x0;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, 4);
    const lh = lineH(fit.size);
    const top = Math.round(H * 0.255 - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    const bottom = drawLines(fit.lines, x0, top, lh, "left");
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, maxW);
      drawLines(subLines, x1, bottom + 110, subLineH, "right");
    }
  } else if (layout === "plain") {
    // Option 6: no photo. A flat colour with the headline and subheading centred.
    ctx.fillStyle = style.cvBlock;
    ctx.fillRect(0, 0, W, H);
    const maxW = W - 180;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, 4);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? 40 + subLines.length * subLineH : 0);
    let y = Math.round(H / 2 - total / 2);
    setHead(fit.size);
    y = drawLines(fit.lines, W / 2, y, lh, "center") + 40;
    if (subLines.length) { setSub(); drawLines(subLines, W / 2, y, subLineH, "center"); }
  } else if (layout === "behind") {
    // Option 7: flat colour, big heading, then the person cut out of their photo drawn on top so the heading sits behind them.
    ctx.fillStyle = style.cvBlock;
    ctx.fillRect(0, 0, W, H);
    const cut = photo ? await getCutout(photo) : null;
    const maxW = W - 100;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, 2);
    const lh = lineH(fit.size);
    const top = Math.round((style.cvY / 100) * H - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    const bottom = drawLines(fit.lines, W / 2, top, lh, "center");
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, Math.round(W * 0.4));
      drawLines(subLines, Math.round(W * 0.69), bottom + 100, subLineH, "center");
    }
    if (cut) {
      drawPhotoIn(ctx, cut, 0, 0, W, H, at);
      cut.close();
    } else {
      // The cut out did not work, so keep the photo whole rather than losing it.
      const whole = photo ? await (async () => { const b = await prepareImage(photo); return b ? createImageBitmap(b) : null; })() : null;
      if (whole) { drawPhotoIn(ctx, whole, 0, 0, W, H, at); whole.close(); }
    }
  } else {
    // centred and serif: full bleed photo. Centred sits in the middle; serif hangs from a bottom edge on a soft gradient.
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, H, at);
    if (style.overlay > 0 && layout === "centred") {
      ctx.fillStyle = `rgba(0,0,0,${style.overlay / 100})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (layout === "serif" && style.cvScrim > 0) {
      const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${style.cvScrim / 100})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const maxW = layout === "serif" ? W - 90 : W - 180;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, style.cvSize, layout === "serif" ? 4 : 3);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? (layout === "serif" ? 22 : 30) + subLines.length * subLineH : 0);
    const anchor = (style.cvY / 100) * H;
    let y = Math.round(layout === "serif" ? anchor - total : anchor - total / 2);
    if (style.shadow && layout === "centred") { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; }
    setHead(fit.size);
    y = drawLines(fit.lines, W / 2, y, lh, "center") + (layout === "serif" ? 22 : 30);
    if (subLines.length) { setSub(); drawLines(subLines, W / 2, y, subLineH, "center"); }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  bmp?.close();
  setSpacing(ctx, 0);
  if (logo && style.showLogo && preset) {
    drawLogo(ctx, logo, preset.logoPosition || "top-left", preset.logoSize || 110);
  }
}

async function renderSlide(
  spec: SlideSpec,
  photo: File | null,
  style: Style,
  logo: HTMLImageElement | null,
  preset: ClientPreset | null,
  scale: number,
  meta: RenderMeta = { index: 0, total: 1 },
  pos?: PhotoPos,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  if (spec.kind === "cover") {
    await drawCover(ctx, spec, photo, style, logo, preset, pos, meta.extras ?? []);
    return canvas;
  }

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    const blob = await prepareImage(photo);
    if (blob) {
      const bmp = await createImageBitmap(blob);
      drawPhotoIn(ctx, bmp, 0, 0, W, H, pos ?? defaultPos(spec.kind, style));
      bmp.close();
    }
  }

  if (style.overlay > 0) {
    ctx.fillStyle = `rgba(0,0,0,${style.overlay / 100})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (style.scrim > 0) {
    // Soft gradient rising from the bottom keeps the photo bright and the words readable.
    const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${style.scrim / 100})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const t = ctx.createLinearGradient(0, 0, 0, H * 0.16);
    t.addColorStop(0, `rgba(0,0,0,${(style.scrim * 0.45) / 100})`);
    t.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, W, H * 0.16);
  }

  const editorial = style.layout === "editorial";
  const left = style.align === "left";
  const M = 92;
  const x = left ? M : W / 2;
  const maxW = W - M * 2;
  const up = (t: string) => (style.uppercase ? t.toUpperCase() : t);
  const display = style.displayFont;
  const blocks: Block[] = [];

  ctx.textAlign = left ? "left" : "center";
  ctx.textBaseline = "top";
  setSpacing(ctx, style.letterSpacing);

  const isCta = spec.kind === "cta";
  const size = isCta ? style.ctaSize : style.bodySize;
  const f = `${isCta && editorial ? "italic " : style.textItalic ? "italic " : ""}${style.textWeight} ${size}px ${display}`;
  ctx.font = f;
  blocks.push({
    lines: balancedWrap(ctx, up(spec.text), maxW - (left ? 40 : 30)), font: f,
    lineH: Math.round(size * style.lineHeight),
    colour: isCta ? style.ctaColour : style.bodyColour, gapBefore: 0, spacing: style.letterSpacing,
  });

  const total = blocks.reduce((sum, b) => sum + b.gapBefore + b.lines.length * b.lineH, 0);
  const anchor = (style.bodyY / 100) * H;
  // Editorial text hangs from a fixed bottom edge; classic text is centred on the anchor.
  let y = Math.round(editorial ? anchor - total : anchor - total / 2);
  const blockTop = y;

  if (style.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
  }
  for (const b of blocks) {
    y += b.gapBefore;
    ctx.font = b.font;
    setSpacing(ctx, b.spacing);
    ctx.fillStyle = b.colour;
    for (const line of b.lines) { ctx.fillText(line, x, y); y += b.lineH; }
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  setSpacing(ctx, 0);

  // Fine details: rule above the words, frame, counter, brand and swipe arrow.
  ctx.strokeStyle = style.lineColour;
  if (style.rule) {
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const ry = blockTop - 40;
    if (left) { ctx.moveTo(M, ry); ctx.lineTo(M + 96, ry); }
    else { ctx.moveTo(W / 2 - 48, ry); ctx.lineTo(W / 2 + 48, ry); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (style.frame) {
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.globalAlpha = 1;
  }
  if (style.counter || (style.brandMark && preset)) {
    ctx.font = `400 22px ${style.fontFamily}`;
    setSpacing(ctx, 6);
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.lineColour;
    ctx.globalAlpha = 0.92;
    if (style.counter) {
      ctx.textAlign = "left";
      const n = (v: number) => String(v).padStart(2, "0");
      ctx.fillText(`${n(meta.index + 1)} / ${n(meta.total)}`, M, 96);
    }
    if (style.brandMark && preset) {
      ctx.textAlign = "right";
      ctx.fillText(preset.name.toUpperCase(), W - M + 6, 96);
    }
    ctx.globalAlpha = 1;
    setSpacing(ctx, 0);
    ctx.textBaseline = "top";
  }
  if (style.arrow && meta.index < meta.total - 1) {
    const ay = H - 100;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(W - M - 76, ay); ctx.lineTo(W - M, ay);
    ctx.moveTo(W - M - 14, ay - 11); ctx.lineTo(W - M, ay); ctx.lineTo(W - M - 14, ay + 11);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (logo && style.showLogo && preset) {
    drawLogo(ctx, logo, preset.logoPosition || "top-left", preset.logoSize || 110);
  }
  return canvas;
}

async function warmFonts(style: Style) {
  await Promise.allSettled([
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.cvFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.cvSubFont}`),
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.plainFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.plainSubFont}`),
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.behindFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.behindSubFont}`),
    ...Object.values(style.lf ?? {}).flatMap(f => [
      document.fonts.load(`${style.cvWeight} 100px ${f.h}`),
      document.fonts.load(`${style.cvSubWeight} 40px ${f.s}`),
    ]),
    document.fonts.load(`${style.textItalic ? "italic " : ""}${style.textWeight} ${style.bodySize}px ${style.displayFont}`),
    document.fonts.load(`italic ${style.textWeight} ${style.ctaSize}px ${style.displayFont}`),
    document.fonts.load(`400 22px ${style.fontFamily}`),
  ]);
}

// ---------------------------------------------------------------------------
// Upload helper for scheduling
// ---------------------------------------------------------------------------

async function uploadPngs(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 3;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((base64, j) => ({ name: names[i + j], base64 }));
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

const tick = () => new Promise<void>(r => setTimeout(r, 0));

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Your own fonts. Files stay in this browser only (IndexedDB) and are never uploaded anywhere.
// ---------------------------------------------------------------------------

type FontInfo = { family: string; compact: string; weight: number; italic: boolean };

function parseFontFile(fileName: string): FontInfo {
  let base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();
  const italic = /italic|oblique/.test(lower);
  const weights: [RegExp, number][] = [
    [/extra[-_ ]?black|ultra/, 950], [/black|heavy/, 900], [/extra[-_ ]?bold|ultra[-_ ]?bold/, 800],
    [/semi[-_ ]?bold|demi/, 600], [/bold/, 700], [/medium/, 500], [/extra[-_ ]?light|ultra[-_ ]?light/, 200],
    [/thin|hairline/, 100], [/light/, 300],
  ];
  let weight = 400;
  for (const [re, w] of weights) if (re.test(lower)) { weight = Math.min(w, 900); break; }
  base = base.replace(/([-_ ]?(extra|ultra|semi|demi)?[-_ ]?(black|heavy|bold|medium|light|thin|hairline|regular|italic|oblique|book|roman))+$/i, "");
  const spaced = base.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim() || "My font";
  return { family: spaced, compact: spaced.replace(/\s+/g, ""), weight, italic };
}

const fontFaceRegistry = new Map<string, FontFace[]>();

async function registerFont(fileName: string, data: ArrayBuffer): Promise<string | null> {
  try {
    const info = parseFontFile(fileName);
    const faces: FontFace[] = [];
    for (const fam of new Set([info.family, info.compact])) {
      const face = new FontFace(fam, data.slice(0), { weight: String(info.weight), style: info.italic ? "italic" : "normal" });
      await face.load();
      document.fonts.add(face);
      faces.push(face);
    }
    fontFaceRegistry.set(fileName, faces);
    return info.family;
  } catch {
    return null;
  }
}

function openFontDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open("stylish-fonts", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("fonts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function fontDbAll(): Promise<{ name: string; data: ArrayBuffer }[]> {
  const db = await openFontDb();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const out: { name: string; data: ArrayBuffer }[] = [];
      const cur = db.transaction("fonts").objectStore("fonts").openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push({ name: String(c.key), data: c.value as ArrayBuffer }); c.continue(); } else resolve(out);
      };
      cur.onerror = () => resolve(out);
    } catch { resolve([]); }
  });
}

async function fontDbPut(name: string, data: ArrayBuffer) {
  const db = await openFontDb();
  if (!db) return;
  try { db.transaction("fonts", "readwrite").objectStore("fonts").put(data, name); } catch { /* not saved, still usable this visit */ }
}

async function fontDbDelete(name: string) {
  const db = await openFontDb();
  if (!db) return;
  try { db.transaction("fonts", "readwrite").objectStore("fonts").delete(name); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function CoverIcon({ k }: { k: CoverLayout }) {
  return (
    <div className="relative w-9 h-12 rounded-sm overflow-hidden bg-neutral-100 border border-border/30 shrink-0">
      {k === "band" && (<><div className="absolute inset-x-0 top-0 h-[74%] bg-amber-700/70" /><div className="absolute left-1 bottom-1.5 w-5 h-1 bg-black" /></>)}
      {k === "centred" && (<><div className="absolute inset-0 bg-amber-700/70" /><div className="absolute left-1.5 right-1.5 top-[42%] h-1 bg-sky-400" /><div className="absolute left-2.5 right-2.5 top-[58%] h-0.5 bg-white" /></>)}
      {k === "block" && (<><div className="absolute inset-x-0 top-0 h-[38%] bg-amber-700/70" /><div className="absolute left-1 right-1 top-[58%] h-2 bg-black" /><div className="absolute left-1 bottom-1.5 w-3 h-0.5 bg-black" /></>)}
      {k === "serif" && (<><div className="absolute inset-0 bg-amber-700/70" /><div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute left-1 right-1 bottom-4 h-1.5 bg-white" /><div className="absolute left-2 right-2 bottom-2 h-0.5 bg-white/80" /></>)}
      {k === "behind" && (<><div className="absolute inset-0 bg-neutral-200" /><div className="absolute left-0.5 right-0.5 top-[14%] h-3 bg-neutral-800" /><div className="absolute left-2 right-2 bottom-0 top-[22%] bg-amber-700/80 rounded-t-full" /></>)}
      {k === "plain" && (<><div className="absolute inset-0 bg-indigo-900" /><div className="absolute left-1.5 right-1.5 top-[40%] h-1.5 bg-white" /><div className="absolute left-2.5 right-2.5 top-[56%] h-0.5 bg-white/80" /></>)}
      {k === "fullbleed" && (<><div className="absolute inset-0 bg-amber-800/70" /><div className="absolute left-1 top-[18%] w-4 h-1.5 bg-white" /><div className="absolute left-1 top-[30%] w-4 h-1.5 bg-white" /><div className="absolute left-1 bottom-2 w-3 h-0.5 bg-white/80" /></>)}
      {k === "blur" && (<><div className="absolute inset-0 bg-gradient-to-r from-neutral-300 via-amber-800/60 to-neutral-800/80 blur-[1px]" /><div className="absolute left-2 right-2 top-[42%] h-1 bg-white" /><div className="absolute left-3 right-3 top-[58%] h-0.5 bg-white/80" /></>)}
      {k === "strip" && (<><div className="absolute inset-0 bg-amber-800/60" /><div className="absolute inset-y-0 left-1 w-3 bg-black" /><div className="absolute left-4 right-0 bottom-[6%] h-[26%] bg-amber-50" /><div className="absolute left-5 bottom-[16%] w-4 h-1 bg-black" /></>)}
      {k === "diagonal" && (<><div className="absolute inset-0 bg-amber-800/70" /><div className="absolute left-1 right-1 top-[28%] h-1 bg-white rotate-[24deg]" /><div className="absolute left-1 bottom-3 w-3 h-0.5 bg-white/80" /></>)}
      {k === "behind2" && (<><div className="absolute inset-0 bg-white" /><div className="absolute left-0.5 right-0.5 top-[16%] h-3 bg-blue-800" /><div className="absolute left-2 right-0 bottom-0 top-[30%] bg-amber-700/80 rounded-t-full" /></>)}
      {k === "polaroid" && (<><div className="absolute inset-0 bg-white" /><div className="absolute left-2 right-1 top-[20%] bottom-[22%] bg-stone-200 rotate-[-6deg]" /><div className="absolute left-1 right-2 top-[26%] bottom-[30%] bg-amber-700/70 border-2 border-white" /></>)}
      {k === "sidebar" && (<><div className="absolute inset-0 bg-amber-800/60" /><div className="absolute left-1 top-0 bottom-0 w-[50%] bg-white" /><div className="absolute left-1.5 top-[30%] w-3 h-1.5 bg-black" /></>)}
      {k === "frame" && (<><div className="absolute inset-0 bg-amber-900/70" /><div className="absolute inset-1 bg-white" /><div className="absolute left-1.5 top-1.5 w-[42%] h-[42%] bg-amber-700/70" /><div className="absolute right-1.5 bottom-1.5 w-[42%] h-[42%] bg-amber-700/70" /></>)}
      {k === "layered" && (<><div className="absolute inset-0 bg-amber-900/60" /><div className="absolute left-2 right-2 top-[20%] bottom-[18%] bg-stone-200" /><div className="absolute left-2.5 right-2.5 top-[24%] h-[32%] bg-amber-700/70" /></>)}
      {k === "split" && (<><div className="absolute inset-y-0 left-0 w-[47%] bg-amber-700/70" /><div className="absolute left-[54%] right-1 top-[24%] h-1.5 bg-black" /><div className="absolute right-1 bottom-0 left-[47%] h-1.5 bg-neutral-500" /></>)}
    </div>
  );
}

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          className="w-20 h-7 rounded bg-muted/30 border border-border/40 px-1.5 text-xs font-mono"
        />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-7 rounded border border-border/40 bg-transparent cursor-pointer p-0"
          aria-label={`${label} picker`}
        />
      </div>
    </div>
  );
}

function SliderField({
  label, value, min, max, step = 1, suffix = "", onChange,
}: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-foreground/70">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Stylish() {
  const { presets, loading: presetsLoading } = usePresets();

  const [style, setStyle] = useState<Style>(() => {
    try {
      const raw = localStorage.getItem(STYLE_STORAGE_KEY);
      if (raw) return { ...DEFAULT_STYLE, ...JSON.parse(raw) };
    } catch { /* storage can be blocked, defaults are fine */ }
    return DEFAULT_STYLE;
  });
  const patch = useCallback((p: Partial<Style>) => setStyle(s => ({ ...s, ...p })), []);
  const coverNo = COVER_ORDER.indexOf(style.coverLayout) + 1;
  // Sets the headline (0) or subtitle (1) font of the cover that is showing.
  const setFace = (which: 0 | 1, v: string) => {
    const l = style.coverLayout;
    if (l === "plain") patch(which === 0 ? { plainFont: v } : { plainSubFont: v });
    else if (l === "behind") patch(which === 0 ? { behindFont: v } : { behindSubFont: v });
    else if (MORE_LAYOUTS.has(l)) {
      const cur = faces(style, l);
      patch({ lf: { ...style.lf, [l]: { h: which === 0 ? v : cur[0], s: which === 1 ? v : cur[1] } } });
    } else patch(which === 0 ? { cvFont: v } : { cvSubFont: v });
  };

  useEffect(() => {
    try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style)); } catch { /* ignore */ }
  }, [style]);

  const [images, setImages] = useState<File[]>([]);
  const [perPost, setPerPost] = useState(5);
  const [reusePhotos, setReusePhotos] = useState(true);
  const [coverVersion, setCoverVersion] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, File>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imgDrag, setImgDrag] = useState(false);
  const [csvDrag, setCsvDrag] = useState(false);

  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = presets.find(p => p.id === presetId) ?? null;

  const [tone, setTone] = useState("1");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [customFonts, setCustomFonts] = useState<{ file: string; family: string }[]>([]);
  const [fontVersion, setFontVersion] = useState(0);
  const fontInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const saved = await fontDbAll();
      const loaded: { file: string; family: string }[] = [];
      for (const f of saved) {
        const fam = await registerFont(f.name, f.data);
        if (fam) loaded.push({ file: f.name, family: fam });
      }
      if (!dead && loaded.length) { setCustomFonts(loaded); setFontVersion(v => v + 1); }
    })();
    return () => { dead = true; };
  }, []);

  const addFonts = async (files: File[]) => {
    const added: { file: string; family: string }[] = [];
    for (const f of files) {
      if (!/\.(otf|ttf|woff2?|)$/i.test(f.name)) continue;
      const data = await f.arrayBuffer();
      const fam = await registerFont(f.name, data);
      if (fam) { added.push({ file: f.name, family: fam }); await fontDbPut(f.name, data); }
      else toast.error(`Could not read ${f.name}`);
    }
    if (added.length) {
      setCustomFonts(list => [...list.filter(x => !added.some(a => a.file === x.file)), ...added]);
      setFontVersion(v => v + 1);
      toast.success(`Added ${[...new Set(added.map(a => a.family))].join(", ")}`);
    }
  };

  const removeFont = async (file: string) => {
    for (const face of fontFaceRegistry.get(file) ?? []) document.fonts.delete(face);
    fontFaceRegistry.delete(file);
    await fontDbDelete(file);
    setCustomFonts(list => list.filter(x => x.file !== file));
    setFontVersion(v => v + 1);
  };

  const customFamilies = [...new Set(customFonts.map(f => f.family))];
  const customOptions = customFamilies.map(fam => ({ label: `${fam} (yours)`, value: `'${fam}', sans-serif` }));
  const coverFontOptions = [...customOptions, ...COVER_FONTS];
  const slideFontOptions = [...customOptions, { label: "Instrument Serif", value: F_INSTRUMENT }, ...FONT_OPTIONS];
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "");
  const missingFonts = COVER_WANTS[style.coverLayout].filter(w => !customFamilies.some(c => norm(c) === norm(w)));
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [captionAllBusy, setCaptionAllBusy] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  // Where each photo has been dragged to, keyed by "postId:slideIndex". A ref so a drag is smooth,
  // with a counter to refresh the buttons that depend on it.
  const focusRef = useRef<Record<string, PhotoPos>>({});
  const [, bumpFocus] = useState(0);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const redrawSeq = useRef<Record<string, number>>({});
  const dragRef = useRef<{
    key: string; pi: number; si: number; startX: number; startY: number;
    start: PhotoPos; ox: number; oy: number; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);

  // -- which photo belongs to which slide ----------------------------------

  const slideCounts = useMemo(() => posts.map(p => buildSlides(p.texts).length), [posts]);
  const shortOfPhotos = images.length > 0 && images.length < posts.reduce((sum, _p, i) => sum + Math.max(perPost, slideCounts[i] ?? 0), 0);
  const reusing = reusePhotos && shortOfPhotos;
  const reusePlan = useMemo(
    () => (reusing ? planReusedPhotos(images, slideCounts) : null),
    [reusing, images, slideCounts],
  );

  const photoFor = useCallback((postIndex: number, post: Post, slideIndex: number): File | null => {
    const o = overrides[`${post.id}:${slideIndex}`];
    if (o) return o;
    if (reusePlan) return reusePlan[postIndex]?.[slideIndex] ?? null;
    const start = postIndex * perPost;
    const idx = start + Math.min(slideIndex, perPost - 1);
    return images[idx] ?? (images[start + slideIndex] ?? null);
  }, [images, perPost, overrides, reusePlan]);

  // -- inputs ----------------------------------------------------------------

  const handleImages = (incoming: File[]) => {
    const files = incoming.filter(f => f.type.startsWith("image/")).sort(naturalSort);
    if (!files.length) { toast.error("No images found in that selection"); return; }
    setImages(files);
    setOverrides({});
    focusRef.current = {};
  };

  const addApproved = (files: File[]) => {
    if (!files.length) return;
    setImages(prev => [
      ...prev,
      ...files.map((f, i) => new File([f], `approved-${String(prev.length + i + 1).padStart(3, "0")}-${f.name}`, { type: f.type })),
    ]);
  };

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    readFileAsText(file).then(raw => {
      Papa.parse<string[]>(raw, {
        skipEmptyLines: "greedy",
        complete: result => {
          let rows = result.data.map(r => (Array.isArray(r) ? r.map(c => String(c ?? "")) : [String(r)]));
          if (!rows.length) { setCsvError("That CSV is empty"); return; }
          const first = (rows[0][0] ?? "").trim().toLowerCase();
          const hasHeader = /^(headline|hook|title|heading|column ?1)/.test(first);
          const cols = Math.max(hasHeader ? rows[0].length : 0, ...rows.slice(hasHeader ? 1 : 0).map(r => r.length));
          if (hasHeader) rows = rows.slice(1);
          if (cols < 3) { setCsvError("The CSV needs at least 3 columns: headline, subtitle and CTA (with any number of text columns between)."); return; }
          const parsed: Post[] = rows
            .map(r => Array.from({ length: cols }, (_, i) => (r[i] ?? "").trim()))
            .filter(t => t.some(Boolean))
            .map(texts => ({ id: makeId(), texts, caption: "", captionBusy: false, selected: true }));
          if (!parsed.length) { setCsvError("No rows with text were found"); return; }
          setPosts(parsed);
          setCsvName(file.name);
          setOverrides({});
          focusRef.current = {};
        },
        error: (err: Error) => setCsvError(err.message),
      });
    });
  }, []);

  const downloadSample = () => {
    saveAs(new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" }), "stylish-sample.csv");
  };

  // -- live thumbnails -------------------------------------------------------

  const renderKey = useMemo(
    () => JSON.stringify([
      posts.map(p => [p.id, p.texts]), style, images.map((f, i) => i + f.name + f.size), perPost, reusing, coverVersion,
      Object.entries(overrides).map(([k, f]) => k + f.name + f.size), preset?.id, preset?.logoUrl, fontVersion,
    ]),
    [posts, style, images, perPost, reusing, coverVersion, overrides, preset, fontVersion],
  );

  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Loads the fonts for the main cover and for any cover option a post has picked for itself.
  const warmAll = async () => {
    await warmFonts(style);
    const own = new Set(postsRef.current.map(p => p.cover).filter((c): c is CoverLayout => !!c && c !== style.coverLayout));
    for (const c of own) await warmFonts({ ...style, ...COVER_PRESETS[c] } as Style);
  };
  const photoForRef = useRef(photoFor);
  photoForRef.current = photoFor;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!postsRef.current.length) { setThumbs({}); return; }
      setRendering(true);
      try {
        await warmAll();
        const logo = style.showLogo ? await loadLogo(preset) : null;
        logoRef.current = logo;
        for (let pi = 0; pi < postsRef.current.length; pi++) {
          if (cancelled) return;
          const post = postsRef.current[pi];
          const specs = buildSlides(post.texts);
          const batch: Record<string, string> = {};
          for (let si = 0; si < specs.length; si++) {
            const canvas = await renderSlide(specs[si], photoForRef.current(pi, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 0.3, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoForRef.current(pi, post, k)) : undefined }, focusRef.current[`${post.id}:${si}`]);
            batch[`${post.id}:${si}`] = canvas.toDataURL("image/jpeg", 0.75);
          }
          if (cancelled) return;
          setThumbs(prev => ({ ...prev, ...batch }));
          await tick();
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Preview failed");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  // -- dragging a photo to the right spot -----------------------------------------

  // Redraws just the slide being dragged, so the preview follows the pointer without waiting for every post.
  const redrawOne = useCallback(async (post: Post, pi: number, si: number) => {
    const d = dragRef.current;
    const key = `${post.id}:${si}`;
    const run = async () => {
      const specs = buildSlides(post.texts);
      if (!specs[si]) return;
      const seq = (redrawSeq.current[key] = (redrawSeq.current[key] ?? 0) + 1);
      const canvas = await renderSlide(
        specs[si], photoFor(pi, post, si), styleForSlide(style, post, specs[si].kind), logoRef.current, preset, 0.3,
        { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(pi, post, k)) : undefined }, focusRef.current[key],
      );
      if (redrawSeq.current[key] !== seq) return; // a newer change has been drawn since, keep that one
      setThumbs(prev => ({ ...prev, [key]: canvas.toDataURL("image/jpeg", 0.75) }));
    };
    if (d && d.key === key) {
      if (d.busy) { d.pending = true; return; }
      d.busy = true;
      try {
        do { d.pending = false; await run(); } while (d.pending);
      } finally { d.busy = false; }
    } else {
      await run();
    }
  }, [photoFor, style, preset]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number, spec: SlideSpec) => {
    if (e.button !== 0) return;
    const photo = photoFor(pi, post, si);
    const dims = photo ? photoDims.get(photo) : undefined;
    if (!photo || !dims) return;
    const slideStyle = styleForSlide(style, post, spec.kind);
    const area = photoArea(spec.kind, slideStyle);
    const sc = Math.max(area.w / dims.w, area.h / dims.h);
    const key = `${post.id}:${si}`;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      key, pi, si, startX: e.clientX, startY: e.clientY,
      start: focusRef.current[key] ?? defaultPos(spec.kind, slideStyle),
      ox: dims.w * sc - area.w, oy: dims.h * sc - area.h,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = dragRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    const dx = (e.clientX - d.startX) / d.thumbScale;
    const dy = (e.clientY - d.startY) / d.thumbScale;
    // Dragging the photo right shows more of its left side, so the focus moves the other way.
    const x = d.ox > 1 ? clamp(d.start.x - (dx / d.ox) * 100) : d.start.x;
    const y = d.oy > 1 ? clamp(d.start.y - (dy / d.oy) * 100) : d.start.y;
    if (x === d.start.x && y === d.start.y && !focusRef.current[d.key]) return;
    focusRef.current = { ...focusRef.current, [d.key]: { x, y } };
    redrawOne(post, d.pi, d.si);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    dragRef.current = null;
    bumpFocus(n => n + 1);
  };

  const resetPos = (post: Post, pi: number, si: number) => {
    const next = { ...focusRef.current };
    delete next[`${post.id}:${si}`];
    focusRef.current = next;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // -- choosing a cover for each post ----------------------------------------------

  const setCover = (post: Post, pi: number, cover: CoverLayout | undefined) => {
    if (post.cover === cover) return;
    updatePost(post.id, { cover });
    warmFonts({ ...style, ...COVER_PRESETS[cover ?? style.coverLayout] } as Style).then(() => redrawOne({ ...post, cover }, pi, 0));
  };

  // Gives every post a different cover option, going round the five in turn.
  const mixCovers = () => {
    setPosts(list => list.map((p, i) => ({ ...p, cover: MIX_ORDER[i % MIX_ORDER.length] })));
    setCoverVersion(v => v + 1);
  };

  // Colour picked for one post's cover text. Empty puts it back to the option's own colour.
  const setCoverColours = (post: Post, pi: number, patchColours: Partial<Pick<Post, "coverColour" | "coverSubColour" | "coverBlockColour" | "coverBandColour">>) => {
    updatePost(post.id, patchColours);
    redrawOne({ ...post, ...patchColours }, pi, 0);
  };

  // Puts one pair of text colours on every post's cover, and clears any colours set on single posts.
  const changeAllText = (head: string, subtitleColour: string) => {
    patch({ cvAll: true, cvAllColour: head, cvAllSubColour: subtitleColour });
    setPosts(list => list.map(p => ({ ...p, coverColour: undefined, coverSubColour: undefined })));
    setCoverVersion(v => v + 1);
    toast.success("Text colours changed on every cover");
  };

  const sameCovers = () => {
    setPosts(list => list.map(p => ({ ...p, cover: undefined, coverColour: undefined, coverSubColour: undefined, coverBlockColour: undefined, coverBandColour: undefined })));
    setCoverVersion(v => v + 1);
  };

  // -- post helpers ----------------------------------------------------------

  const deletePost = (id: string) => {
    setPosts(list => list.filter(x => x.id !== id));
    setOverrides(o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${id}:`))));
    delete focusRef.current[id];
    for (const k of Object.keys(focusRef.current)) if (k.startsWith(`${id}:`)) delete focusRef.current[k];
    setConfirmDelete(null);
    toast.success("Post deleted");
  };

  const updatePost = (id: string, p: Partial<Post>) =>
    setPosts(list => list.map(x => (x.id === id ? { ...x, ...p } : x)));

  const setText = (id: string, col: number, value: string) =>
    setPosts(list => list.map(x => (x.id === id ? { ...x, texts: x.texts.map((t, i) => (i === col ? value : t)) } : x)));

  const selectedPosts = posts.filter(p => p.selected);

  // -- captions ----------------------------------------------------------------

  const generateCaption = useCallback(async (post: Post): Promise<string | null> => {
    const specs = buildSlides(post.texts);
    const context =
      `An Instagram carousel of ${specs.length} slides. The slide text, in order:\n` +
      specs.map((s, i) => `${i + 1}. ${s.text}${s.sub ? ` (${s.sub})` : ""}`).join("\n") +
      `\nThe last slide is the call to action. Write a caption that adds something the slides do not already say, ` +
      `and finish with a friendly, low pressure invitation that fits the last slide. ` +
      `Never use em dashes or en dashes anywhere in the caption.`;
    const res = await fetch(`${BASE}/api/caption-generator/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone, context, clinicName: preset?.name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.caption) throw new Error(data.error || "Caption generation failed");
    let caption: string = noDashes(data.caption);
    const footnote = preset?.captionFootnote?.trim();
    if (footnote && !caption.includes(footnote)) caption += `\n\n${footnote}`;
    return caption;
  }, [tone, preset]);

  const handleCaptionOne = async (post: Post) => {
    updatePost(post.id, { captionBusy: true });
    try {
      const caption = await generateCaption(post);
      if (caption) updatePost(post.id, { caption });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Caption generation failed");
    } finally {
      updatePost(post.id, { captionBusy: false });
    }
  };

  const handleCaptionAll = async () => {
    const targets = postsRef.current.filter(p => p.selected);
    if (!targets.length) { toast.error("Tick at least one post first"); return; }
    setCaptionAllBusy(true);
    let done = 0;
    const toastId = toast.loading(`Writing captions 0/${targets.length}`);
    try {
      const queue = [...targets];
      const worker = async () => {
        while (queue.length) {
          const post = queue.shift()!;
          try {
            const caption = await generateCaption(post);
            if (caption) updatePost(post.id, { caption });
          } catch { /* one failure should not stop the rest */ }
          done++;
          toast.loading(`Writing captions ${done}/${targets.length}`, { id: toastId });
        }
      };
      await Promise.all([worker(), worker()]);
      toast.success(`Captions written for ${targets.length} post${targets.length !== 1 ? "s" : ""}`, { id: toastId });
    } finally {
      setCaptionAllBusy(false);
    }
  };

  // -- export ------------------------------------------------------------------

  const renderPostCanvases = async (postIndex: number, post: Post, logo: HTMLImageElement | null) => {
    const specs = buildSlides(post.texts);
    const out: HTMLCanvasElement[] = [];
    for (let si = 0; si < specs.length; si++) {
      out.push(await renderSlide(specs[si], photoFor(postIndex, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 1, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(postIndex, post, k)) : undefined }, focusRef.current[`${post.id}:${si}`]));
    }
    return out;
  };

  const handleDownload = async () => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    setExporting("Starting");
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const zip = new JSZip();
      const captionRows: string[][] = [["post", "caption"]];
      let n = 0;
      for (const post of selectedPosts) {
        n++;
        const pi = posts.indexOf(post);
        setExporting(`Rendering post ${n} of ${selectedPosts.length}`);
        const canvases = await renderPostCanvases(pi, post, logo);
        const folder = `post-${String(pi + 1).padStart(2, "0")}`;
        for (let si = 0; si < canvases.length; si++) {
          const blob = await new Promise<Blob | null>(res => canvases[si].toBlob(b => res(b), "image/png"));
          if (blob) zip.file(`${folder}/slide-${si + 1}.png`, blob);
        }
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, noDashes(post.caption.trim()));
        captionRows.push([folder, noDashes(post.caption.trim())]);
        await tick();
      }
      zip.file("captions.csv", Papa.unparse(captionRows));
      setExporting("Zipping");
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `stylish-${Date.now()}.zip`);
      toast.success(`${selectedPosts.length} post${selectedPosts.length !== 1 ? "s" : ""} downloaded at 1080 x 1440`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  // -- scheduling --------------------------------------------------------------

  const handleSchedule = async () => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    if (!preset) { toast.error("Choose a client first so I know whose account to schedule to"); return; }
    setScheduling("Starting");
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const items: SchedulePostPayload[] = [];
      let n = 0;
      for (const post of selectedPosts) {
        n++;
        const pi = posts.indexOf(post);
        setScheduling(`Uploading post ${n} of ${selectedPosts.length}`);
        // One slide at a time: render, upload, then free the canvas straight away so the tab never
        // holds a whole post (or several posts) of full size images in memory.
        const specs = buildSlides(post.texts);
        const urls: string[] = [];
        for (let si = 0; si < specs.length; si++) {
          setScheduling(`Uploading post ${n} of ${selectedPosts.length} (slide ${si + 1} of ${specs.length})`);
          const canvas = await renderSlide(specs[si], photoFor(pi, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 1, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(pi, post, k)) : undefined }, focusRef.current[`${post.id}:${si}`]);
          let dataUrl: string | null = canvas.toDataURL("image/png");
          canvas.width = 0; canvas.height = 0;
          const name = `stylish-${pi + 1}-slide-${si + 1}.png`;
          let got: string[] | null = null;
          for (let attempt = 0; attempt < 3 && !got; attempt++) {
            try { got = await uploadPngs([dataUrl], [name]); }
            catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
          }
          dataUrl = null;
          urls.push(...(got ?? []));
          await tick();
        }
        items.push({
          title: `${buildSlides(post.texts)[0]?.text ?? `Post ${pi + 1}`} · ${preset.name}`,
          caption: noDashes(post.caption.trim()),
          imageUrls: urls,
        });
      }
      setScheduleItems(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScheduling(null);
    }
  };

  const useClientLook = () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    patch({
      displayFont: preset.fontFamily || style.displayFont,
      lineColour: preset.accentColor || style.lineColour,
      cvBand: preset.accentColor || style.cvBand,
      cvColour: style.coverLayout === "centred" ? (preset.accentColor || style.cvColour) : style.cvColour,
      bodyColour: preset.textColor || style.bodyColour,
      ctaColour: preset.textColor || style.ctaColour,
      showLogo: !!preset.logoUrl,
    });
    toast.success(`Style matched to ${preset.name}`);
  };

  // -- checks shown to the user ------------------------------------------------

  const expectedImages = posts.length * perPost;
  const maxSlides = slideCounts.length ? Math.max(...slideCounts) : 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">Stylish</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[340px_1fr]">

        {/* ------------------------------ left: setup and style ------------------------------ */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto pr-1">
          <div>
            <h2 className="text-2xl font-bold mb-1">Stylish</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Full bleed photo carousels. One CSV row is one post, and each post takes its photos in order.
            </p>
          </div>

          <section className="space-y-2">
            <Label className="text-sm font-medium">Photos</Label>
            <div
              onDrop={e => { e.preventDefault(); setImgDrag(false); handleImages(Array.from(e.dataTransfer.files)); }}
              onDragOver={e => { e.preventDefault(); setImgDrag(true); }}
              onDragLeave={() => setImgDrag(false)}
              onClick={() => imgInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none text-center",
                imgDrag ? "border-amber-500/60 bg-amber-500/5" : images.length ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 hover:border-border/60",
              ].join(" ")}
            >
              {images.length ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-amber-400" />
                  <p className="text-sm font-medium text-amber-400">{images.length} photo{images.length !== 1 ? "s" : ""} loaded</p>
                  <p className="text-xs text-muted-foreground">Click to replace them all, or add approved photos below</p>
                </>
              ) : (
                <>
                  <ImageIcon className="w-7 h-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop photos here or click to browse</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Put them in order by file name. Photos 1 to {perPost} go to post 1, the next {perPost} to post 2, and so on.
                  </p>
                </>
              )}
            </div>
            <input
              ref={imgInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) handleImages(f); e.target.value = ""; }}
            />
            <ApprovedImagesPicker
              clientName={preset?.name || ""}
              mode="multi"
              skipBackgroundRemoval
              large
              label="Add approved photos"
              onAddImages={addApproved}
            />
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => { setImages([]); setOverrides({}); focusRef.current = {}; }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear all photos
              </button>
            )}
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-muted-foreground">Photos per post</Label>
              <input
                type="number" min={1} max={10} value={perPost}
                onChange={e => setPerPost(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 h-8 rounded bg-muted/30 border border-border/40 px-2 text-sm"
              />
            </div>
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox" checked={reusePhotos}
                onChange={e => { setReusePhotos(e.target.checked); focusRef.current = {}; }}
                className="accent-sky-500 mt-0.5"
              />
              <span>
                Reuse my photos to fill every slide
                <span className="block text-xs text-muted-foreground">
                  Only kicks in when you have fewer photos than slides. Each post gets different photos, and slide 1 is a new photo each time until they have all been used.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-2">
            <Label className="text-sm font-medium">CSV</Label>
            <div
              onDrop={e => { e.preventDefault(); setCsvDrag(false); const f = e.dataTransfer.files[0]; if (f) parseCsv(f); }}
              onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
              onDragLeave={() => setCsvDrag(false)}
              onClick={() => csvInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none text-center",
                csvDrag ? "border-sky-500/60 bg-sky-500/5" : csvName ? "border-sky-500/40 bg-sky-500/5" : "border-border/40 hover:border-border/60",
              ].join(" ")}
            >
              {csvName ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-sky-400" />
                  <p className="text-sm font-medium text-sky-400 break-all">{csvName}</p>
                  <p className="text-xs text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}. Click to replace.</p>
                </>
              ) : (
                <>
                  <FileText className="w-7 h-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Columns: headline, subtitle, then as many text columns as you need. The last column is always the CTA.
                  </p>
                </>
              )}
            </div>
            <input
              ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseCsv(f); e.target.value = ""; }}
            />
            {csvError && <p className="text-xs text-destructive">{csvError}</p>}
            <button onClick={downloadSample} className="text-xs text-sky-400 hover:underline">Download a sample CSV</button>
          </section>

          <section className="space-y-2">
            <Label className="text-sm font-medium">Client</Label>
            <Select value={presetId ? String(presetId) : ""} onValueChange={v => setPresetId(Number(v))}>
              <SelectTrigger className="bg-muted/30 border-border/40">
                <SelectValue placeholder={presetsLoading ? "Loading…" : "Choose a client"} />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Needed for captions in their name, the logo and scheduling. Not needed to preview or download.
            </p>
            <Button variant="outline" size="sm" onClick={useClientLook} disabled={!preset} className="w-full">
              <Palette className="w-4 h-4 mr-1.5" />Match this client's fonts and colours
            </Button>
          </section>

          <section className="space-y-4 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Slide 1: cover</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {COVER_ORDER.map((k, i) => (
                <button
                  key={k} type="button"
                  onClick={() => patch(COVER_PRESETS[k])}
                  className={["rounded-lg border p-1.5 flex flex-col items-center gap-1 transition-colors", style.coverLayout === k ? "border-sky-500 bg-sky-500/10" : "border-border/40 hover:border-border/70"].join(" ")}
                  aria-label={`Cover option ${i + 1}`}
                >
                  <CoverIcon k={k} />
                  <span className="text-[10px] text-muted-foreground">Option {i + 1}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {style.coverLayout === "band" && "Photo fills the slide with a thick colour band along the bottom."}
              {style.coverLayout === "centred" && "Full photo with the headline and subtitle centred in the middle."}
              {style.coverLayout === "block" && "Photo across the top with a big bold headline on a colour block."}
              {style.coverLayout === "split" && "Photo on the left, colour block on the right with the headline."}
              {style.coverLayout === "serif" && "Full photo with a big serif headline and subtitle along the bottom."}
              {style.coverLayout === "behind" && "Big heading behind the person in your photo. The person is cut out of the photo automatically, in your browser, the first time."}
              {style.coverLayout === "fullbleed" && "Full photo with a big stacked headline top left and the subtitle low down."}
              {style.coverLayout === "blur" && "Your photo smeared sideways like a long exposure, with the headline and subtitle in the middle."}
              {style.coverLayout === "strip" && "A big photo, a dark strip of three small photos, and a colour band with the words. Uses this post's next three photos."}
              {style.coverLayout === "diagonal" && "Full photo with the headline set on a slant."}
              {style.coverLayout === "behind2" && "Heading behind a cut out person, with the subtitle on the left."}
              {style.coverLayout === "polaroid" && "Your photo in a print in the middle of a colour background, held by a clip, with a second card behind."}
              {style.coverLayout === "sidebar" && "Full photo with a colour band down the side carrying the words."}
              {style.coverLayout === "frame" && "Photo behind, a panel on top with two photos and two blocks of words on the diagonal. Uses this post's next two photos."}
              {style.coverLayout === "layered" && "One photo at the back, a print at the front and a card below with the words."}
              {style.coverLayout === "plain" && "No photo. A flat colour of your choice with your own headline and subheading fonts."}
              {" "}Picking one loads its fonts and colours, then change whatever you like.
            </p>
            {missingFonts.length > 0 && (
              <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
                This cover is designed around {missingFonts.join(" and ")}. Add your copy of the font below and it takes over.
                Until then I use a close match.
              </p>
            )}
            <div className="space-y-2 rounded-lg border border-border/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium">Your fonts</Label>
                <button type="button" onClick={() => fontInputRef.current?.click()} className="text-xs text-sky-400 hover:underline">Add font files</button>
              </div>
              <input
                ref={fontInputRef} type="file" multiple accept=".otf,.ttf,.woff,.woff2" className="hidden"
                onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFonts(f); e.target.value = ""; }}
              />
              {customFonts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Add .otf, .ttf or .woff2 files, for example Helvetica Now Display, Breul Grotesk, Now or Evolventa. Add each weight you use (regular and bold).
                  They stay in this browser on this computer and are not uploaded anywhere.
                </p>
              ) : (
                <ul className="space-y-1">
                  {customFonts.map(f => (
                    <li key={f.file} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate" style={{ fontFamily: `'${f.family}', sans-serif` }}>{f.file}</span>
                      <button type="button" onClick={() => removeFont(f.file)} className="text-muted-foreground hover:text-destructive shrink-0">remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{coverNo > 5 ? `Headline font (option ${coverNo})` : "Headline font"}</Label>
              <Select value={faces(style, style.coverLayout)[0]} onValueChange={v => setFace(0, v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {coverFontOptions.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{coverNo > 5 ? `Subheading font (option ${coverNo})` : "Subtitle font"}</Label>
              <Select value={faces(style, style.coverLayout)[1]} onValueChange={v => setFace(1, v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {coverFontOptions.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Headline weight</Label>
                <Select value={String(style.cvWeight)} onValueChange={v => patch({ cvWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{COVER_WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subtitle weight</Label>
                <Select value={String(style.cvSubWeight)} onValueChange={v => patch({ cvSubWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{COVER_WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <SliderField label="Headline size (shrinks to fit)" value={style.cvSize} min={60} max={380} step={2} suffix="px" onChange={v => patch({ cvSize: v })} />
            <SliderField label="Subtitle size" value={style.cvSubSize} min={20} max={100} suffix="px" onChange={v => patch({ cvSubSize: v })} />
            <SliderField label="Headline letter spacing" value={style.cvTracking} min={-12} max={12} step={0.5} suffix="px" onChange={v => patch({ cvTracking: v })} />
            <SliderField label="Subtitle letter spacing" value={style.cvSubTracking} min={-8} max={12} step={0.5} suffix="px" onChange={v => patch({ cvSubTracking: v })} />
            {(style.coverLayout === "band" || style.coverLayout === "block" || style.coverLayout === "split") && (
              <>
                <SliderField
                  label={style.coverLayout === "split" ? "Photo width" : "Photo height"}
                  value={style.cvPhoto} min={style.coverLayout === "split" ? 25 : 20} max={style.coverLayout === "split" ? 75 : 85} step={0.5} suffix="%"
                  onChange={v => patch({ cvPhoto: v })}
                />
                <SliderField
                  label={style.coverLayout === "split" ? "Photo focus (left to right)" : "Photo focus (top to bottom)"}
                  value={style.cvFocus} min={0} max={100} suffix="%" onChange={v => patch({ cvFocus: v })}
                />
              </>
            )}
            {["centred", "serif", "behind", "behind2", "fullbleed", "blur", "diagonal", "sidebar"].includes(style.coverLayout) && (
              <SliderField label={style.coverLayout === "serif" ? "Text bottom edge" : "Text height"} value={style.cvY} min={5} max={96} suffix="%" onChange={v => patch({ cvY: v })} />
            )}
            {style.coverLayout === "blur" && (
              <SliderField label="Motion blur" value={style.cvBlur} min={0} max={240} suffix="px" onChange={v => patch({ cvBlur: v })} />
            )}
            {style.coverLayout === "diagonal" && (
              <SliderField label="Headline angle" value={style.cvAngle} min={-60} max={60} suffix="°" onChange={v => patch({ cvAngle: v })} />
            )}
            {style.coverLayout === "sidebar" && (
              <SliderField label="Band width" value={style.cvPhoto} min={25} max={80} suffix="%" onChange={v => patch({ cvPhoto: v })} />
            )}
            {["fullbleed", "blur", "diagonal", "layered"].includes(style.coverLayout) && (
              <SliderField label="Darken the photo" value={style.cvScrim} min={0} max={70} suffix="%" onChange={v => patch({ cvScrim: v })} />
            )}
            {style.coverLayout === "serif" && (
              <SliderField label="Bottom gradient" value={style.cvScrim} min={0} max={90} suffix="%" onChange={v => patch({ cvScrim: v })} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.cvCaps} onChange={e => patch({ cvCaps: e.target.checked })} className="accent-sky-500" />
              Capital letters on the headline
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.cvSubCaps} onChange={e => patch({ cvSubCaps: e.target.checked })} className="accent-sky-500" />
              Capital letters on the subtitle
            </label>
            {style.coverLayout === "split" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={style.cvBandOn} onChange={e => patch({ cvBandOn: e.target.checked })} className="accent-sky-500" />
                Band along the bottom
              </label>
            )}
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={style.cvAll} onChange={e => patch({ cvAll: e.target.checked })} className="accent-sky-500" />
                Same text colours on every cover
              </label>
              {style.cvAll ? (
                <>
                  <ColourField label="Headline colour (all covers)" value={style.cvAllColour} onChange={v => patch({ cvAllColour: v })} />
                  <ColourField label="Subtitle colour (all covers)" value={style.cvAllSubColour} onChange={v => patch({ cvAllSubColour: v })} />
                </>
              ) : (
                <>
                  <ColourField label="Headline colour" value={style.cvColour} onChange={v => patch({ cvColour: v })} />
                  <ColourField label="Subtitle colour" value={style.cvSubColour} onChange={v => patch({ cvSubColour: v })} />
                </>
              )}
              {BLOCK_LABEL[style.coverLayout] && (
                <ColourField label={BLOCK_LABEL[style.coverLayout]!} value={style.cvBlock} onChange={v => patch({ cvBlock: v })} />
              )}
              {style.coverLayout === "split" && style.cvBandOn && (
                <ColourField label="Bottom band colour" value={style.cvBand} onChange={v => patch({ cvBand: v })} />
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Slides 2 onwards: photo with text</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm" variant={style.layout === "editorial" ? "default" : "outline"}
                className={style.layout === "editorial" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => patch(LOOK_EDITORIAL)}
              >Editorial</Button>
              <Button
                size="sm" variant={style.layout === "classic" ? "default" : "outline"}
                className={style.layout === "classic" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => patch(LOOK_CLASSIC)}
              >Classic centred</Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Picking a look resets the settings below to that look. Change anything after that and it sticks.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slide text font</Label>
              <Select value={style.displayFont} onValueChange={v => patch({ displayFont: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {slideFontOptions.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Small text font (counter)</Label>
              <Select value={style.fontFamily} onValueChange={v => patch({ fontFamily: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {slideFontOptions.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Text weight</Label>
                <Select value={String(style.textWeight)} onValueChange={v => patch({ textWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alignment</Label>
                <Select value={style.align} onValueChange={v => patch({ align: v as Style["align"] })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="centre">Centre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SliderField label="Slide text size" value={style.bodySize} min={36} max={120} suffix="px" onChange={v => patch({ bodySize: v })} />
            <SliderField label="CTA size" value={style.ctaSize} min={36} max={120} suffix="px" onChange={v => patch({ ctaSize: v })} />
            <SliderField label="Letter spacing" value={style.letterSpacing} min={0} max={10} step={0.5} suffix="px" onChange={v => patch({ letterSpacing: v })} />
            <SliderField label="Line height" value={style.lineHeight} min={1} max={1.8} step={0.02} onChange={v => patch({ lineHeight: v })} />
            <SliderField label={style.layout === "editorial" ? "Text bottom edge" : "Text height"} value={style.bodyY} min={15} max={95} suffix="%" onChange={v => patch({ bodyY: v })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.uppercase} onChange={e => patch({ uppercase: e.target.checked })} className="accent-sky-500" />
              Capital letters
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.textItalic} onChange={e => patch({ textItalic: e.target.checked })} className="accent-sky-500" />
              Italic slide text
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.shadow} onChange={e => patch({ shadow: e.target.checked })} className="accent-sky-500" />
              Soft shadow behind text
            </label>
          </section>

          <section className="space-y-3 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Details</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.frame} onChange={e => patch({ frame: e.target.checked })} className="accent-sky-500" />
              Fine frame
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.rule} onChange={e => patch({ rule: e.target.checked })} className="accent-sky-500" />
              Short line above the words
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.counter} onChange={e => patch({ counter: e.target.checked })} className="accent-sky-500" />
              Slide counter (01 / 05)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.brandMark} onChange={e => patch({ brandMark: e.target.checked })} className="accent-sky-500" />
              Client name in the corner
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.arrow} onChange={e => patch({ arrow: e.target.checked })} className="accent-sky-500" />
              Swipe arrow
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.showLogo} onChange={e => patch({ showLogo: e.target.checked })} className="accent-sky-500" />
              Client logo (all slides)
            </label>
          </section>

          <section className="space-y-3 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Colours for slides 2 onwards</h3>
            <ColourField label="Slide text" value={style.bodyColour} onChange={v => patch({ bodyColour: v })} />
            <ColourField label="CTA" value={style.ctaColour} onChange={v => patch({ ctaColour: v })} />
            <ColourField label="Lines, frame, counter" value={style.lineColour} onChange={v => patch({ lineColour: v })} />
            <ColourField label="Behind photos" value={style.background} onChange={v => patch({ background: v })} />
            <SliderField label="Bottom gradient" value={style.scrim} min={0} max={90} suffix="%" onChange={v => patch({ scrim: v })} />
            <SliderField label="Darken whole photo" value={style.overlay} min={0} max={80} suffix="%" onChange={v => patch({ overlay: v })} />
          </section>
        </aside>

        {/* ------------------------------ right: posts ------------------------------ */}
        <section className="space-y-6 min-w-0">
          {!posts.length ? (
            <div className="border border-dashed border-border/40 rounded-xl p-10 text-center text-sm text-muted-foreground leading-relaxed">
              Add your photos and your CSV on the left and your posts appear here, ready to style, caption, download or schedule.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold">{posts.length} post{posts.length !== 1 ? "s" : ""}, {selectedPosts.length} ticked</h2>
                  <p className="text-xs text-muted-foreground">
                    Slides export at 1080 x 1440. Drag any photo to move it, double click to put it back.{rendering && " Refreshing previews…"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/40 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleCaptionAll} disabled={captionAllBusy}>
                    {captionAllBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                    Write all captions
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload} disabled={!!exporting}>
                    {exporting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{exporting}</> : <><Download className="w-4 h-4 mr-1.5" />Download ZIP</>}
                  </Button>
                  <Button size="sm" onClick={handleSchedule} disabled={!!scheduling} className="bg-pink-600 hover:bg-pink-700 text-white">
                    {scheduling ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{scheduling}</> : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <button className="text-sky-400 hover:underline" onClick={() => setPosts(l => l.map(p => ({ ...p, selected: true })))}>Tick all</button>
                <button className="text-sky-400 hover:underline" onClick={() => setPosts(l => l.map(p => ({ ...p, selected: false })))}>Untick all</button>
                <span className="text-border/60">|</span>
                <button className="text-sky-400 hover:underline" onClick={mixCovers}>Give each post a different cover</button>
                <button className="text-sky-400 hover:underline" onClick={sameCovers}>Same cover on every post</button>
              </div>

              {images.length > 0 && images.length !== expectedImages && (
                <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
                  You have {images.length} photo{images.length !== 1 ? "s" : ""} for {posts.length} post{posts.length !== 1 ? "s" : ""} at {perPost} each, which needs {expectedImages}.
                  {images.length < expectedImages
                    ? (reusing
                      ? " I am reusing your photos to fill every slide. Slide 1 gets a different photo each time, and no post shows the same photo twice unless you have fewer photos than slides."
                      : " Posts without photos get a plain background. Tick 'Reuse my photos' on the left to fill them.")
                    : " The extra photos are ignored."}
                </p>
              )}
              {maxSlides > perPost && (
                <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
                  Your CSV makes up to {maxSlides} slides per post but you are using {perPost} photos per post. The last photo repeats for the extra slides.
                </p>
              )}

              <div className="space-y-5">
                {posts.map((post, pi) => {
                  const specs = buildSlides(post.texts);
                  return (
                    <div key={post.id} className={["rounded-xl border p-4 space-y-4", post.selected ? "border-border/50 bg-muted/10" : "border-border/20 opacity-60"].join(" ")}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox" checked={post.selected}
                          onChange={e => updatePost(post.id, { selected: e.target.checked })}
                          className="accent-sky-500 w-4 h-4" aria-label={`Include post ${pi + 1}`}
                        />
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Post {pi + 1}</span>
                        <span className="text-sm text-foreground/80 truncate">{post.texts[0]}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">{specs.length} slides</span>
                        {confirmDelete === post.id ? (
                          <span className="flex items-center gap-2 text-xs shrink-0">
                            <span className="text-muted-foreground">Delete post {pi + 1}?</span>
                            <button type="button" className="text-red-400 font-medium hover:underline" onClick={() => deletePost(post.id)}>Yes, delete</button>
                            <button type="button" className="text-muted-foreground hover:underline" onClick={() => setConfirmDelete(null)}>Keep</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(post.id)}
                            className="text-muted-foreground hover:text-red-400 shrink-0"
                            title="Delete this post"
                            aria-label={`Delete post ${pi + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {specs.map((spec, si) => {
                          const thumb = thumbs[`${post.id}:${si}`];
                          const hasPhoto = !!photoFor(pi, post, si);
                          const moved = !!focusRef.current[`${post.id}:${si}`];
                          return (
                            <div
                              key={si}
                              onPointerDown={e => startDrag(e, post, pi, si, spec)}
                              onPointerMove={e => moveDrag(e, post)}
                              onPointerUp={endDrag}
                              onPointerCancel={endDrag}
                              onDoubleClick={() => resetPos(post, pi, si)}
                              title={hasPhoto ? "Drag to move the photo. Double click to put it back." : undefined}
                              className={["relative rounded-lg overflow-hidden border border-border/30 shrink-0 group select-none", hasPhoto ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
                              style={{ width: 170, touchAction: hasPhoto ? "none" : undefined }}
                            >
                              {thumb ? (
                                <img src={thumb} alt={`Post ${pi + 1}, slide ${si + 1}`} className="w-full block pointer-events-none" style={{ aspectRatio: `${W}/${H}` }} draggable={false} />
                              ) : (
                                <div className="w-full bg-muted/30 flex items-center justify-center" style={{ aspectRatio: `${W}/${H}` }}>
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                                <span className="text-[10px] text-white/80 font-medium">{si + 1}</span>
                                <span className="flex items-center gap-1.5">
                                  {moved && (
                                    <button
                                      type="button"
                                      onPointerDown={e => e.stopPropagation()}
                                      onDoubleClick={e => e.stopPropagation()}
                                      onClick={() => resetPos(post, pi, si)}
                                      className="text-[9px] text-white/80 uppercase tracking-wider hover:text-white"
                                    >reset</button>
                                  )}
                                  <button
                                    type="button"
                                    onPointerDown={e => e.stopPropagation()}
                                    onDoubleClick={e => e.stopPropagation()}
                                    onClick={() => { replaceTarget.current = `${post.id}:${si}`; replaceInputRef.current?.click(); }}
                                    className="text-[9px] text-white/80 uppercase tracking-wider hover:text-white"
                                  >swap</button>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1">Cover</span>
                        <button
                          type="button" onClick={() => setCover(post, pi, undefined)}
                          className={["rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors", !post.cover ? "border-sky-500 bg-sky-500/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border/70"].join(" ")}
                        >Main choice</button>
                        {COVER_ORDER.map((k, ci) => (
                          <button
                            key={k} type="button" onClick={() => setCover(post, pi, k)}
                            title={`Cover option ${ci + 1}`}
                            aria-label={`Cover option ${ci + 1} for post ${pi + 1}`}
                            className={["rounded-lg border p-1 flex items-center gap-1.5 transition-colors", post.cover === k ? "border-sky-500 bg-sky-500/10" : "border-border/40 hover:border-border/70"].join(" ")}
                          >
                            <span className="scale-[0.6] origin-left -mr-3.5"><CoverIcon k={k} /></span>
                            <span className="text-[11px] text-muted-foreground pr-1">{ci + 1}</span>
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const eff = styleForSlide(style, post, "cover");
                        return (
                          <div className="flex items-end gap-x-6 gap-y-2 flex-wrap">
                            <div className="w-56"><ColourField label="Cover headline" value={eff.cvColour} onChange={v => setCoverColours(post, pi, { coverColour: v })} /></div>
                            <div className="w-56"><ColourField label="Cover subtitle" value={eff.cvSubColour} onChange={v => setCoverColours(post, pi, { coverSubColour: v })} /></div>
                            {BLOCK_LABEL[eff.coverLayout] && (
                              <div className="w-56"><ColourField label={BLOCK_LABEL[eff.coverLayout]!} value={eff.cvBlock} onChange={v => setCoverColours(post, pi, { coverBlockColour: v })} /></div>
                            )}
                            {eff.coverLayout === "split" && eff.cvBandOn && (
                              <div className="w-56"><ColourField label="Bottom band colour" value={eff.cvBand} onChange={v => setCoverColours(post, pi, { coverBandColour: v })} /></div>
                            )}
                            <button
                              type="button"
                              onClick={() => changeAllText(eff.cvColour, eff.cvSubColour)}
                              className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2.5 py-1.5"
                              title="Use this post's headline and subtitle colours on every cover"
                            >Change all</button>
                            {(post.coverColour || post.coverSubColour || post.coverBlockColour || post.coverBandColour) && (
                              <button
                                type="button"
                                onClick={() => setCoverColours(post, pi, { coverColour: undefined, coverSubColour: undefined, coverBlockColour: undefined, coverBandColour: undefined })}
                                className="text-xs text-muted-foreground underline hover:text-foreground pb-1"
                              >Put the colours back</button>
                            )}
                          </div>
                        );
                      })()}

                      <details className="text-sm">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Edit the words on this post</summary>
                        <div className="grid gap-2 mt-3 md:grid-cols-2">
                          {post.texts.map((t, ci) => {
                            const label = ci === 0 ? "Headline" : ci === 1 ? "Subtitle" : ci === post.texts.length - 1 ? "CTA" : `Text ${ci - 1}`;
                            return (
                              <div key={ci} className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                                <textarea
                                  value={t} rows={2}
                                  onChange={e => setText(post.id, ci, e.target.value)}
                                  className="w-full bg-muted/30 border border-border/40 rounded-md px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </details>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Caption</Label>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCaptionOne(post)} disabled={post.captionBusy}>
                            {post.captionBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                            {post.caption ? "Write another" : "Write caption"}
                          </Button>
                        </div>
                        <textarea
                          value={post.caption} rows={5}
                          onChange={e => updatePost(post.id, { caption: e.target.value })}
                          placeholder="Write your own, or let me draft one in the tone you chose above."
                          className="w-full bg-muted/30 border border-border/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      <input
        ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          const key = replaceTarget.current;
          if (f && key) {
            setOverrides(o => ({ ...o, [key]: f }));
            const next = { ...focusRef.current };
            delete next[key];
            focusRef.current = next;
          }
          e.target.value = "";
        }}
      />

      {scheduleItems && preset && (
        <ScheduleModal
          presetId={preset.id}
          presetName={preset.name}
          postType="carousel"
          posts={scheduleItems}
          perPostCaptions
          sourceTool="stylish"
          onClose={() => setScheduleItems(null)}
          onSaved={() => setScheduleItems(null)}
          presets={presets.map(p => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
