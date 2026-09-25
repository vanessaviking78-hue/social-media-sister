import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, ImageIcon,
  Sparkles, Palette, RotateCcw, Wand2,
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
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SIDE_PAD = 90;
const STYLE_STORAGE_KEY = "stylish-style-v2";

// ---------------------------------------------------------------------------
// Types and defaults
// ---------------------------------------------------------------------------

type Style = {
  layout: "editorial" | "classic";
  fontFamily: string;      // small labels and subtitle
  displayFont: string;     // headline and slide text
  headlineWeight: number;
  textWeight: number;
  headlineItalic: boolean;
  textItalic: boolean;
  headlineSize: number;
  subtitleSize: number;
  bodySize: number;
  ctaSize: number;
  headlineColour: string;
  subtitleColour: string;
  bodyColour: string;
  ctaColour: string;
  lineColour: string;
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "centre";
  coverY: number;
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

const EDITORIAL_STYLE: Style = {
  layout: "editorial",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Cormorant Garamond', serif",
  headlineWeight: 400,
  textWeight: 400,
  headlineItalic: false,
  textItalic: false,
  headlineSize: 176,
  subtitleSize: 28,
  bodySize: 78,
  ctaSize: 82,
  headlineColour: "#ffffff",
  subtitleColour: "#ffffff",
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: false,
  letterSpacing: 0,
  lineHeight: 1.14,
  align: "left",
  coverY: 88,
  bodyY: 86,
  overlay: 0,
  scrim: 64,
  shadow: false,
  background: "#8a8a8a",
  frame: true,
  counter: true,
  brandMark: true,
  arrow: true,
  rule: true,
  showLogo: false,
};

const CLASSIC_STYLE: Style = {
  layout: "classic",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Montserrat', sans-serif",
  headlineWeight: 300,
  textWeight: 300,
  headlineItalic: false,
  textItalic: false,
  headlineSize: 170,
  subtitleSize: 52,
  bodySize: 62,
  ctaSize: 66,
  headlineColour: "#38b6ff",
  subtitleColour: "#ffffff",
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: true,
  letterSpacing: 1,
  lineHeight: 1.25,
  align: "centre",
  coverY: 58,
  bodyY: 50,
  overlay: 12,
  scrim: 0,
  shadow: true,
  background: "#8a8a8a",
  frame: false,
  counter: false,
  brandMark: false,
  arrow: false,
  rule: false,
  showLogo: false,
};

const DEFAULT_STYLE = EDITORIAL_STYLE;

type Post = {
  id: string;
  texts: string[]; // headline, subtitle, ...text columns, cta
  caption: string;
  captionBusy: boolean;
  selected: boolean;
};

type SlideKind = "cover" | "body" | "cta";
type SlideSpec = { kind: SlideKind; text: string; sub: string };

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

function naturalSort(a: File, b: File) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

// ---------------------------------------------------------------------------
// Image preparation. Each photo is cropped once to fill 1080x1440 and kept as a
// compressed blob so a large batch does not hold gigabytes of pixels in memory.
// ---------------------------------------------------------------------------

const prepared = new Map<File, Promise<Blob | null>>();

function prepareImage(file: File): Promise<Blob | null> {
  const existing = prepared.get(file);
  if (existing) return existing;
  const p = (async () => {
    try {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const s = Math.max(W / bmp.width, H / bmp.height);
      const dw = bmp.width * s;
      const dh = bmp.height * s;
      ctx.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
      bmp.close();
      return await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), "image/jpeg", 0.93));
    } catch {
      return null;
    }
  })();
  prepared.set(file, p);
  return p;
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

type RenderMeta = { index: number; total: number };

async function renderSlide(
  spec: SlideSpec,
  photo: File | null,
  style: Style,
  logo: HTMLImageElement | null,
  preset: ClientPreset | null,
  scale: number,
  meta: RenderMeta = { index: 0, total: 1 },
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    const blob = await prepareImage(photo);
    if (blob) {
      const bmp = await createImageBitmap(blob);
      ctx.drawImage(bmp, 0, 0, W, H);
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
  const italic = (on: boolean) => (on ? "italic " : "");
  const display = style.displayFont;
  const sans = style.fontFamily;
  const blocks: Block[] = [];

  ctx.textAlign = left ? "left" : "center";
  ctx.textBaseline = "top";
  setSpacing(ctx, style.letterSpacing);

  if (spec.kind === "cover") {
    const text = up(spec.text);
    const fontAt = (s: number) => `${italic(style.headlineItalic)}${style.headlineWeight} ${s}px ${display}`;
    let size = style.headlineSize;
    let lines: string[] = [text];
    let fitted = false;
    // Keep short headlines on a single line by shrinking a little, otherwise wrap and balance.
    if (!text.includes("\n")) {
      for (let s = style.headlineSize; s >= style.headlineSize * 0.6; s -= 4) {
        ctx.font = fontAt(s);
        if (ctx.measureText(text).width <= maxW) { size = s; lines = [text]; fitted = true; break; }
      }
    }
    if (!fitted) {
      for (let s = style.headlineSize; s >= 40; s -= 4) {
        ctx.font = fontAt(s);
        lines = balancedWrap(ctx, text, maxW);
        size = s;
        if (lines.length <= 3 && widest(ctx, lines) <= maxW) break;
      }
    }
    blocks.push({
      lines, font: fontAt(size),
      lineH: Math.round(size * (editorial ? 1.0 : 1.05)), colour: style.headlineColour, gapBefore: 0, spacing: style.letterSpacing,
    });
    if (spec.sub) {
      const f = `${style.textWeight} ${style.subtitleSize}px ${sans}`;
      const sp = editorial ? 7 : style.letterSpacing;
      ctx.font = f;
      setSpacing(ctx, sp);
      const subText = editorial || style.uppercase ? spec.sub.toUpperCase() : spec.sub;
      blocks.push({
        lines: balancedWrap(ctx, subText, maxW), font: f,
        lineH: Math.round(style.subtitleSize * (editorial ? 1.5 : style.lineHeight)),
        colour: style.subtitleColour, gapBefore: editorial ? 34 : 30, spacing: sp,
      });
    }
  } else {
    const isCta = spec.kind === "cta";
    const size = isCta ? style.ctaSize : style.bodySize;
    const f = `${italic(isCta && editorial ? true : style.textItalic)}${style.textWeight} ${size}px ${display}`;
    ctx.font = f;
    blocks.push({
      lines: balancedWrap(ctx, up(spec.text), maxW - (left ? 40 : 30)), font: f,
      lineH: Math.round(size * style.lineHeight),
      colour: isCta ? style.ctaColour : style.bodyColour, gapBefore: 0, spacing: style.letterSpacing,
    });
  }

  const total = blocks.reduce((sum, b) => sum + b.gapBefore + b.lines.length * b.lineH, 0);
  const anchor = ((spec.kind === "cover" ? style.coverY : style.bodyY) / 100) * H;
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
    ctx.font = `400 22px ${sans}`;
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
    document.fonts.load(`${style.headlineItalic ? "italic " : ""}${style.headlineWeight} ${style.headlineSize}px ${style.displayFont}`),
    document.fonts.load(`${style.textItalic ? "italic " : ""}${style.textWeight} ${style.bodySize}px ${style.displayFont}`),
    document.fonts.load(`italic ${style.textWeight} ${style.ctaSize}px ${style.displayFont}`),
    document.fonts.load(`${style.textWeight} ${style.subtitleSize}px ${style.fontFamily}`),
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
// Small UI pieces
// ---------------------------------------------------------------------------

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

  useEffect(() => {
    try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style)); } catch { /* ignore */ }
  }, [style]);

  const [images, setImages] = useState<File[]>([]);
  const [perPost, setPerPost] = useState(5);
  const [overrides, setOverrides] = useState<Record<string, File>>({});
  const [csvName, setCsvName] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imgDrag, setImgDrag] = useState(false);
  const [csvDrag, setCsvDrag] = useState(false);

  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = presets.find(p => p.id === presetId) ?? null;

  const [tone, setTone] = useState("1");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [captionAllBusy, setCaptionAllBusy] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  // -- which photo belongs to which slide ----------------------------------

  const photoFor = useCallback((postIndex: number, post: Post, slideIndex: number): File | null => {
    const o = overrides[`${post.id}:${slideIndex}`];
    if (o) return o;
    const start = postIndex * perPost;
    const idx = start + Math.min(slideIndex, perPost - 1);
    return images[idx] ?? (images[start + slideIndex] ?? null);
  }, [images, perPost, overrides]);

  // -- inputs ----------------------------------------------------------------

  const handleImages = (incoming: File[]) => {
    const files = incoming.filter(f => f.type.startsWith("image/")).sort(naturalSort);
    if (!files.length) { toast.error("No images found in that selection"); return; }
    setImages(files);
    setOverrides({});
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
      posts.map(p => [p.id, p.texts]), style, images.map(f => f.name + f.size), perPost,
      Object.entries(overrides).map(([k, f]) => k + f.name + f.size), preset?.id, preset?.logoUrl,
    ]),
    [posts, style, images, perPost, overrides, preset],
  );

  const postsRef = useRef(posts);
  postsRef.current = posts;
  const photoForRef = useRef(photoFor);
  photoForRef.current = photoFor;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!postsRef.current.length) { setThumbs({}); return; }
      setRendering(true);
      try {
        await warmFonts(style);
        const logo = style.showLogo ? await loadLogo(preset) : null;
        for (let pi = 0; pi < postsRef.current.length; pi++) {
          if (cancelled) return;
          const post = postsRef.current[pi];
          const specs = buildSlides(post.texts);
          const batch: Record<string, string> = {};
          for (let si = 0; si < specs.length; si++) {
            const canvas = await renderSlide(specs[si], photoForRef.current(pi, post, si), style, logo, preset, 0.3, { index: si, total: specs.length });
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

  // -- post helpers ----------------------------------------------------------

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
      `and finish with a friendly, low pressure invitation that fits the last slide.`;
    const res = await fetch(`${BASE}/api/caption-generator/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone, context, clinicName: preset?.name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.caption) throw new Error(data.error || "Caption generation failed");
    let caption: string = data.caption;
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
      out.push(await renderSlide(specs[si], photoFor(postIndex, post, si), style, logo, preset, 1, { index: si, total: specs.length }));
    }
    return out;
  };

  const handleDownload = async () => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    setExporting("Starting");
    try {
      await warmFonts(style);
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
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, post.caption.trim());
        captionRows.push([folder, post.caption.trim()]);
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
      await warmFonts(style);
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const items: SchedulePostPayload[] = [];
      let n = 0;
      for (const post of selectedPosts) {
        n++;
        const pi = posts.indexOf(post);
        setScheduling(`Uploading post ${n} of ${selectedPosts.length}`);
        const canvases = await renderPostCanvases(pi, post, logo);
        const urls = await uploadPngs(
          canvases.map(c => c.toDataURL("image/png")),
          canvases.map((_, si) => `stylish-${pi + 1}-slide-${si + 1}.png`),
        );
        items.push({
          title: `${buildSlides(post.texts)[0]?.text ?? `Post ${pi + 1}`} · ${preset.name}`,
          caption: post.caption.trim(),
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
      headlineColour: style.layout === "editorial" ? (preset.textColor || style.headlineColour) : (preset.accentColor || style.headlineColour),
      lineColour: preset.accentColor || style.lineColour,
      bodyColour: preset.textColor || style.bodyColour,
      subtitleColour: preset.textColor || style.subtitleColour,
      ctaColour: preset.textColor || style.ctaColour,
      showLogo: !!preset.logoUrl,
    });
    toast.success(`Style matched to ${preset.name}`);
  };

  // -- checks shown to the user ------------------------------------------------

  const expectedImages = posts.length * perPost;
  const slideCounts = posts.map(p => buildSlides(p.texts).length);
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
                  <p className="text-xs text-muted-foreground">Click to replace them all</p>
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
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-muted-foreground">Photos per post</Label>
              <input
                type="number" min={1} max={10} value={perPost}
                onChange={e => setPerPost(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 h-8 rounded bg-muted/30 border border-border/40 px-2 text-sm"
              />
            </div>
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
            <h3 className="text-sm font-semibold">Look</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm" variant={style.layout === "editorial" ? "default" : "outline"}
                className={style.layout === "editorial" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => setStyle(EDITORIAL_STYLE)}
              >Editorial</Button>
              <Button
                size="sm" variant={style.layout === "classic" ? "default" : "outline"}
                className={style.layout === "classic" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => setStyle(CLASSIC_STYLE)}
              >Classic centred</Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Picking a look resets the settings below to that look. Change anything after that and it sticks.
            </p>
          </section>

          <section className="space-y-4 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Text</h3>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Headline and slide font</Label>
              <Select value={style.displayFont} onValueChange={v => patch({ displayFont: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Small text font (subtitle, counter)</Label>
              <Select value={style.fontFamily} onValueChange={v => patch({ fontFamily: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Headline weight</Label>
                <Select value={String(style.headlineWeight)} onValueChange={v => patch({ headlineWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Text weight</Label>
                <Select value={String(style.textWeight)} onValueChange={v => patch({ textWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
            <SliderField label="Headline size (shrinks to fit)" value={style.headlineSize} min={80} max={260} step={2} suffix="px" onChange={v => patch({ headlineSize: v })} />
            <SliderField label="Subtitle size" value={style.subtitleSize} min={20} max={100} suffix="px" onChange={v => patch({ subtitleSize: v })} />
            <SliderField label="Slide text size" value={style.bodySize} min={36} max={120} suffix="px" onChange={v => patch({ bodySize: v })} />
            <SliderField label="CTA size" value={style.ctaSize} min={36} max={120} suffix="px" onChange={v => patch({ ctaSize: v })} />
            <SliderField label="Letter spacing" value={style.letterSpacing} min={0} max={10} step={0.5} suffix="px" onChange={v => patch({ letterSpacing: v })} />
            <SliderField label="Line height" value={style.lineHeight} min={1} max={1.8} step={0.02} onChange={v => patch({ lineHeight: v })} />
            <SliderField label={style.layout === "editorial" ? "Cover text bottom edge" : "Cover text height"} value={style.coverY} min={15} max={95} suffix="%" onChange={v => patch({ coverY: v })} />
            <SliderField label={style.layout === "editorial" ? "Slide text bottom edge" : "Slide text height"} value={style.bodyY} min={15} max={95} suffix="%" onChange={v => patch({ bodyY: v })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.uppercase} onChange={e => patch({ uppercase: e.target.checked })} className="accent-sky-500" />
              Capital letters
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.headlineItalic} onChange={e => patch({ headlineItalic: e.target.checked })} className="accent-sky-500" />
              Italic headline
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
              Client logo
            </label>
          </section>

          <section className="space-y-3 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Colours</h3>
            <ColourField label="Cover headline" value={style.headlineColour} onChange={v => patch({ headlineColour: v })} />
            <ColourField label="Cover subtitle" value={style.subtitleColour} onChange={v => patch({ subtitleColour: v })} />
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
                    Slides export at 1080 x 1440.{rendering && " Refreshing previews…"}
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
              </div>

              {images.length > 0 && images.length !== expectedImages && (
                <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
                  You have {images.length} photo{images.length !== 1 ? "s" : ""} for {posts.length} post{posts.length !== 1 ? "s" : ""} at {perPost} each, which needs {expectedImages}.
                  {images.length < expectedImages ? " Posts without photos get a plain background." : " The extra photos are ignored."}
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
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {specs.map((spec, si) => {
                          const thumb = thumbs[`${post.id}:${si}`];
                          return (
                            <button
                              key={si} type="button"
                              onClick={() => { replaceTarget.current = `${post.id}:${si}`; replaceInputRef.current?.click(); }}
                              title="Click to swap this photo"
                              className="relative rounded-lg overflow-hidden border border-border/30 shrink-0 group"
                              style={{ width: 170 }}
                            >
                              {thumb ? (
                                <img src={thumb} alt={`Post ${pi + 1}, slide ${si + 1}`} className="w-full block" style={{ aspectRatio: `${W}/${H}` }} draggable={false} />
                              ) : (
                                <div className="w-full bg-muted/30 flex items-center justify-center" style={{ aspectRatio: `${W}/${H}` }}>
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                                <span className="text-[10px] text-white/80 font-medium">{si + 1}</span>
                                <span className="text-[8px] text-white/70 uppercase tracking-wider opacity-0 group-hover:opacity-100">swap photo</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

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
          if (f && key) setOverrides(o => ({ ...o, [key]: f }));
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
