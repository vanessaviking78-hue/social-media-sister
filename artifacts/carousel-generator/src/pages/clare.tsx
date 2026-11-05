import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Archive, ArrowLeft, CalendarCheck, CalendarClock, Download, FolderUp, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets } from "@/lib/use-presets";
import { uploadPngs } from "@/lib/month-engine";
import { SUITE_FONTS, injectSuiteFontCss, drawTitle, layoutTitle, titleHeight, type LoadedFont, type TitleStyle } from "@/lib/suite-fonts";
import { hatcherCss, loadHatcherTitle } from "@/lib/hatcher-title";
import { CLARE_SECTIONS, CLARE_SECTION_POSTS, CLARE_SECTION_CLINIC, type ClareSectionPost } from "@/lib/clare-sections";

// CLARE CONNOLLY AESTHETICS, Wakefield. Her own page, a copy of the Castle Clinic / Ryder page. Photo first, a soft wash over the bottom third.
// Black and gold. Hatcher on the cover with a curly first letter only. One section per treatment plus Keeping fit over 40 and GLP1 volume loss, 6 posts each.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
const INK = "#1b1b1b";
const GREY = "#6a6a6a";
const CLINIC_KEY = "clare";
const CLINIC_NAME = CLARE_SECTION_CLINIC.name;
const LOOK_KEY = "clare-look-v1";

type Look = { wash: string; opacity: number; text: string; titleSize: number; bodySize: number; logoSize: number; logoWhite: boolean; headline: string };
const DEFAULT_LOOK: Look = { wash: "#0d0d0d", opacity: 100, text: "#ffffff", titleSize: 100, bodySize: 100, logoSize: 100, logoWhite: false, headline: "metal:gold" };

// "Doctor" always has a capital D, wherever it appears in the writing.
const fixDoctor = (t: string) => (t || "").replace(/\bdoctors?\b/gi, (m) => "D" + m.slice(1).toLowerCase());

// The clinic logo, top right of every slide.
function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, look: Look) {
  if (!logo || !logo.naturalWidth) return;
  const k = look.logoSize / 100;
  const maxW = 210 * k;
  const maxH = 100 * k;
  const sc = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
  const w = logo.naturalWidth * sc;
  const h = logo.naturalHeight * sc;
  const x = W - 60 - w;
  const y = 60;
  if (look.logoWhite) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext("2d")!;
    g.drawImage(logo, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(c, x, y);
  } else {
    ctx.drawImage(logo, x, y, w, h);
  }
}

function loadLogoImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo would not load"));
    img.src = src;
  });
}
// Colours are a hex, or "metal:name" (a classic metal), or "metal:#rrggbb" (any colour in a shiny metallic finish).
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const METALS: { id: string; name: string; stops: string[] }[] = [
  { id: "gold", name: "Gold", stops: ["#7a5a14", "#d4a93c", "#fff1a8", "#c9962b", "#7a5a14"] },
  { id: "rosegold", name: "Rose gold", stops: ["#8a4f45", "#d9a08f", "#ffe3d6", "#c98a79", "#8a4f45"] },
  { id: "silver", name: "Silver", stops: ["#6d6f73", "#c9ccd1", "#ffffff", "#a9adb3", "#6d6f73"] },
  { id: "champagne", name: "Champagne", stops: ["#9c8458", "#e6d2a8", "#fff8e6", "#d2bb8c", "#9c8458"] },
  { id: "bronze", name: "Bronze", stops: ["#5c3a1a", "#a8713a", "#e0ac72", "#8a5a2a", "#5c3a1a"] },
  { id: "copper", name: "Copper", stops: ["#6e2f1a", "#c0683f", "#f0a984", "#b05a35", "#6e2f1a"] },
  { id: "gunmetal", name: "Gunmetal", stops: ["#1c1f24", "#4a5059", "#8b929c", "#3a3f47", "#1c1f24"] },
];
const hexParts = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (h: string, to: number, t: number) => {
  const p = hexParts(h).map((v) => Math.round(v + (to - v) * t));
  return "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");
};
const lumOf = (h: string) => { const [r, g, b] = hexParts(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const metalOf = (v: string): { stops: string[]; base: string } | undefined => {
  if (typeof v !== "string" || !v.startsWith("metal:")) return undefined;
  const rest = v.slice(6);
  if (isHex(rest)) return { base: rest, stops: [mixHex(rest, 0, 0.5), rest, mixHex(rest, 255, 0.65), mixHex(rest, 0, 0.12), mixHex(rest, 0, 0.5)] };
  const m = METALS.find((x) => x.id === rest);
  return m ? { stops: m.stops, base: m.stops[2] } : undefined;
};
const metalCss = (m: { stops: string[] }) => `linear-gradient(135deg, ${m.stops.map((c, i) => `${c} ${Math.round((i / (m.stops.length - 1)) * 100)}%`).join(", ")})`;
const metalFill = (ctx: CanvasRenderingContext2D, m: { stops: string[] }, x0: number, y0: number, x1: number, y1: number) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  m.stops.forEach((c, i) => g.addColorStop(i / (m.stops.length - 1), c));
  return g;
};
const rgbOf = (hex: string) => { const [r, g, b] = hexParts(isHex(hex) ? hex : "#0d0d0d"); return `${r},${g},${b}`; };
// Older saved looks used names. Turn them into colours.
const OLD_WASH: Record<string, string> = { white: "#ffffff", black: "#0d0d0d", brown: "#4a3426", beige: "#e8dcc8" };
function normLook(l: Look): Look {
  const wash = OLD_WASH[l.wash] || l.wash || "#ffffff";
  const text = l.text === "black" ? "#0d0d0d" : l.text === "white" ? "#ffffff" : l.text || "auto";
  const headline = l.headline === "silver" ? "metal:silver" : l.headline || "auto";
  return { ...l, wash, text, headline };
}
// Is the background dark enough to want light writing?
function washIsDark(wash: string) {
  const m = metalOf(wash);
  if (m) return lumOf(m.base) < 0.5 || ["metal:bronze", "metal:copper", "metal:gunmetal"].includes(wash);
  return lumOf(isHex(wash) ? wash : "#ffffff") < 0.5;
}
function inks(look: Look) {
  const l = normLook(look);
  const dark = washIsDark(l.wash);
  const ink = l.text === "auto" ? (dark ? "#ffffff" : INK) : l.text;
  const grey = l.text === "auto" ? (dark ? "#cfcfcf" : GREY) : l.text;
  return { ink, grey, bg: l.wash };
}
// Turn a colour into something a canvas can paint with, shining across the band it covers.
function paintOf(ctx: CanvasRenderingContext2D, v: string, y0: number, y1: number): string | CanvasGradient {
  const m = metalOf(v);
  return m ? metalFill(ctx, m, 100, y0, W - 100, y0 + Math.max(y1 - y0, 80)) : v;
}

const SOLIDS: { name: string; hex: string }[] = [
  { name: "White", hex: "#ffffff" }, { name: "Black", hex: "#0d0d0d" }, { name: "Cream", hex: "#f5efe6" }, { name: "Beige", hex: "#e8dcc8" },
  { name: "Blush", hex: "#f2d4d0" }, { name: "Sage", hex: "#9caf88" }, { name: "Teal", hex: "#2a7f8a" }, { name: "Navy", hex: "#14213d" },
  { name: "Plum", hex: "#5b2a4a" }, { name: "Burgundy", hex: "#6d1a2b" }, { name: "Brown", hex: "#4a3426" }, { name: "Grey", hex: "#8a8a8a" },
];
function ColourPicker({ label, value, onChange, extra = [], small = false }: { label: string; value: string; onChange: (v: string) => void; extra?: { name: string; hex: string }[]; small?: boolean }) {
  const isMetal = value.startsWith("metal:");
  const baseHex = isMetal ? (isHex(value.slice(6)) ? value.slice(6) : "#0d0d0d") : isHex(value) ? value : "#0d0d0d";
  const btn = (s: { name: string; hex: string }, shiny: boolean) => {
    const v = shiny ? s.hex : s.hex;
    const m = metalOf(v);
    const on = value.toLowerCase() === v.toLowerCase();
    return (
      <button key={`${shiny}-${s.name}-${v}`} onClick={() => onChange(v)} title={s.name}
        className={`keep-colour ${small ? "h-6 w-6" : "h-8 w-8"} rounded-md border ${on ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-white/25 hover:border-white/60"}`}
        style={{ background: m ? metalCss(m) : isHex(v) ? v : "transparent" }}>
        {!m && !isHex(v) ? <span className="text-[10px] text-white/70">{s.name.slice(0, 1)}</span> : null}
      </button>
    );
  };
  return (
    <div className="space-y-1 text-sm">
      <span className="text-white/60">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {extra.map((s) => (
          <button key={s.name} onClick={() => onChange(s.hex)} className={`h-8 px-2 rounded-md border text-xs ${value === s.hex ? "border-emerald-400 bg-emerald-400/15" : "border-white/25 hover:border-white/60"}`}>{s.name}</button>
        ))}
        {SOLIDS.map((s) => btn(s, false))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-white/40 text-xs w-14">Metallic</span>
        {METALS.map((m) => btn({ name: m.name, hex: `metal:${m.id}` }, true))}
        {SOLIDS.filter((s) => !["#ffffff", "#f5efe6", "#e8dcc8"].includes(s.hex)).map((s) => btn({ name: `Metallic ${s.name.toLowerCase()}`, hex: `metal:${s.hex}` }, true))}
      </div>
      <div className="flex items-center gap-3 text-white/70">
        <label className="flex items-center gap-2">
          <input type="color" value={baseHex} onChange={(e) => onChange(isMetal ? `metal:${e.target.value}` : e.target.value)} className="h-8 w-10 rounded bg-transparent border border-white/25 p-0.5 cursor-pointer" />
          Any colour
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isMetal} onChange={(e) => onChange(e.target.checked ? `metal:${baseHex}` : baseHex)} />
          Metallic finish
        </label>
      </div>
    </div>
  );
}

const FONT_KEY = "clare-fonts-v1";
const AREA_KEY = "clare-area-v1";
const SCHED_KEY = "clare-scheduled-v1";

type Photo = { id: string; bmp: ImageBitmap; url: string };
type Fonts = { head: string; body: string };
type TitleFont = { lf: LoadedFont; style: TitleStyle } | null;

async function loadTitleFont(): Promise<TitleFont> {
  return loadHatcherTitle();
}

type Post = {
  id: string;
  typeId: string;
  hook: string;
  slides: string[];
  cta: string;
  caption: string;
  hashtags: string[];
  photos: number[];
  note: string;
  when: string;
  banked?: boolean;
  busy: boolean;
  scheduling: boolean;
  rejected?: string;
  look?: Partial<Pick<Look, "wash" | "opacity" | "text" | "headline">>; // this post only; empty means the page setting
};

type LibImage = { id: number; groupId: string; name: string; url: string };
const localUrl = (u: string) => {
  const i = u.indexOf("/api/content/images/");
  return i >= 0 ? `${BASE}${u.slice(i)}` : u;
};
const bitmapCache = new Map<string, Promise<ImageBitmap>>();
function loadBitmap(url: string): Promise<ImageBitmap> {
  let p = bitmapCache.get(url);
  if (!p) {
    p = fetch(localUrl(url)).then((r) => { if (!r.ok) throw new Error("image missing"); return r.blob(); }).then((b) => createImageBitmap(b));
    bitmapCache.set(url, p);
    p.catch(() => bitmapCache.delete(url));
  }
  return p;
}
async function resizeToDataUrl(file: File, max = 1600): Promise<string> {
  const raw = await createImageBitmap(file);
  const sc = Math.min(1, max / Math.max(raw.width, raw.height));
  const c = document.createElement("canvas");
  c.width = Math.round(raw.width * sc);
  c.height = Math.round(raw.height * sc);
  c.getContext("2d")!.drawImage(raw, 0, 0, c.width, c.height);
  raw.close();
  return c.toDataURL("image/jpeg", 0.85);
}

// Which section a folder name belongs to. Order matters, the more specific names come first.
const FOLDER_ALIASES: [string, string[]][] = [
  ["glp1", ["glp", "volume"]], ["boosters", ["booster"]], ["poly", ["polynucleotide", "poly"]], ["peels", ["peel"]],
  ["filler", ["filler"]], ["fit", ["fit", "gym", "yoga"]],
];
const folderToGroup = (name: string): string | undefined => {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return undefined;
  return FOLDER_ALIASES.find(([, list]) => list.some((a) => n.includes(a)))?.[0];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const TYPE_BY_ID = new Map(CLARE_SECTION_POSTS.map((t) => [t.id, t]));

async function ensureFonts(f: Fonts) {
  loadGoogleFonts();
  injectSuiteFontCss();
  if (!document.getElementById("hatcher-face")) {
    const el = document.createElement("style");
    el.id = "hatcher-face";
    el.textContent = hatcherCss();
    document.head.appendChild(el);
  }
  try {
    await Promise.all([document.fonts.load('400 60px "Hatcher"'), document.fonts.load(`400 60px "${f.head}"`), document.fonts.load(`600 60px "${f.head}"`), document.fonts.load(`400 30px "${f.body}"`), document.fonts.load(`600 30px "${f.body}"`)]);
  } catch {
    /* falls back to a serif */
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, start: number, min: number, lh: number) {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines };
  }
  ctx.font = font(min);
  return { px: min, lines: wrap(ctx, text, maxW) };
}

function coverFit(ctx: CanvasRenderingContext2D, bmp: ImageBitmap) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * s;
  const h = bmp.height * s;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) * 0.2, w, h);
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

// The wash: clear where the photo shows, solid where the writing sits. Solid colour or a metallic sheen.
function wash(ctx: CanvasRenderingContext2D, from: number, look: Look) {
  const l = normLook(look);
  const o = Math.max(0, Math.min(100, l.opacity)) / 100;
  const metal = metalOf(l.wash);
  const c = metal ? "0,0,0" : rgbOf(l.wash);
  const g = ctx.createLinearGradient(0, H * from, 0, H);
  g.addColorStop(0, `rgba(${c},0)`);
  g.addColorStop(0.45, `rgba(${c},${0.88 * o})`);
  g.addColorStop(0.7, `rgba(${c},${0.98 * o})`);
  g.addColorStop(1, `rgba(${c},${o})`);
  if (!metal) {
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const t = tmp.getContext("2d")!;
  t.fillStyle = metalFill(t, metal, 0, 0, W, H);
  t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = "destination-in";
  t.fillStyle = g;
  t.fillRect(0, 0, W, H);
  ctx.drawImage(tmp, 0, 0);
}

function clinicName(ctx: CanvasRenderingContext2D, f: Fonts, y: number, align: "left" | "center" = "center", color: string | CanvasGradient = GREY) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 22px "${f.body}", sans-serif`;
  spaced(ctx, 6);
  ctx.textAlign = align;
  ctx.fillText(CLINIC_NAME.toUpperCase(), align === "left" ? 100 : W / 2, y);
  ctx.restore();
}

function drawSlide(ctx: CanvasRenderingContext2D, post: Post, n: number, photo: Photo | null, f: Fonts, tf: TitleFont = null, look: Look = DEFAULT_LOOK, logo: HTMLImageElement | null = null) {
  const fixed: Post = { ...post, hook: fixDoctor(post.hook), cta: fixDoctor(post.cta), slides: post.slides.map(fixDoctor) };
  drawSlideBody(ctx, fixed, n, photo, f, tf, look);
  drawLogo(ctx, logo, look);
}

function drawSlideBody(ctx: CanvasRenderingContext2D, post: Post, n: number, photo: Photo | null, f: Fonts, tf: TitleFont = null, look: Look = DEFAULT_LOOK) {
  const ts = (look.titleSize || 100) / 100;
  const bs = (look.bodySize || 100) / 100;
  look = normLook(look);
  const { ink, grey, bg } = inks(look);
  const INKC = paintOf(ctx, ink, H * 0.35, H);
  const GREYC = paintOf(ctx, grey, H - 120, H);
  const BGC = metalOf(bg) ? metalFill(ctx, metalOf(bg)!, 0, 0, W, H) : bg;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "top";
  const head = (px: number, w = 400) => `${w} ${px}px "${f.head}", serif`;
  const body = (px: number, w = 400) => `${w} ${px}px "${f.body}", sans-serif`;

  const LEFT = 100;
  if (n === 4) {
    ctx.fillStyle = BGC;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INKC;
    ctx.textAlign = "left";
    const fit = fitText(ctx, post.cta || "", (px) => head(px), W - LEFT * 2, 520 * Math.max(1, ts), Math.round(84 * ts), Math.round(44 * ts), 1.2);
    const total = fit.lines.length * fit.px * 1.2;
    let y = (H - total) / 2 - 30;
    if (look.headline !== "auto") ctx.fillStyle = paintOf(ctx, look.headline, y, y + total);
    ctx.font = head(fit.px);
    for (const l of fit.lines) { ctx.fillText(l, LEFT, y); y += fit.px * 1.2; }
    ctx.fillStyle = INKC;
    ctx.strokeStyle = INKC; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(LEFT, y + 40); ctx.lineTo(LEFT + 120, y + 40); ctx.stroke(); ctx.globalAlpha = 1;
    return;
  }

  if (photo) coverFit(ctx, photo.bmp);
  else { ctx.fillStyle = "#e9e6e1"; ctx.fillRect(0, 0, W, H); }

  if (n === 0) {
    wash(ctx, 0.52, look);
    if (tf) {
      // the title font: drawn glyph by glyph so wide spacing and curly letters work
      let size = Math.round(120 * ts);
      let layout = layoutTitle(tf.lf, post.hook || "", tf.style, size, W - 200, 1.12);
      while (size > Math.round(50 * ts) && titleHeight(layout) > 330 * Math.max(1, ts)) {
        size -= 4;
        layout = layoutTitle(tf.lf, post.hook || "", tf.style, size, W - 200, 1.12);
      }
      const ty = H - 175 - titleHeight(layout);
      drawTitle(ctx, tf.lf, layout, tf.style, 100, ty, "center", W - 200, look.headline !== "auto" ? paintOf(ctx, look.headline, ty, ty + titleHeight(layout)) : INKC);
    } else {
      ctx.fillStyle = INKC;
      ctx.textAlign = "center";
      const fit = fitText(ctx, post.hook || "", (px) => head(px), W - 200, 330 * Math.max(1, ts), Math.round(92 * ts), Math.round(46 * ts), 1.1);
      const total = fit.lines.length * fit.px * 1.1;
      let y = H - 175 - total;
      if (look.headline !== "auto") ctx.fillStyle = paintOf(ctx, look.headline, y, y + total);
      ctx.font = head(fit.px);
      for (const l of fit.lines) { ctx.fillText(l, W / 2, y); y += fit.px * 1.1; }
    }
    clinicName(ctx, f, H - 100, "center", GREYC);
    return;
  }

  wash(ctx, 0.3, look);
  const text = post.slides[n - 1] || "";
  ctx.fillStyle = INKC;
  ctx.textAlign = "left";
  const fit = fitText(ctx, text, (px) => body(px), W - LEFT * 2, 520 * Math.max(1, bs), Math.round(40 * bs), Math.round(26 * bs), 1.55);
  const total = fit.lines.length * fit.px * 1.55;
  let y = H - 170 - total;
  ctx.font = body(fit.px);
  for (const l of fit.lines) { ctx.fillText(l, LEFT, y); y += fit.px * 1.55; }
}

function SlideCanvas({ post, n, photo, fonts, tf, look, logo, onClick }: { post: Post; n: number; photo: Photo | null; fonts: Fonts; tf: TitleFont; look: Look; logo: HTMLImageElement | null; onClick?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      await ensureFonts(fonts);
      const c = ref.current;
      if (!c || !live) return;
      const ctx = c.getContext("2d");
      if (ctx) drawSlide(ctx, post, n, photo, fonts, tf, look, logo);
    })();
    return () => { live = false; };
  }, [post, n, photo, fonts, tf, look, logo]);
  return <canvas ref={ref} width={W} height={H} onClick={onClick} className="w-[150px] h-auto rounded-md border border-white/10 cursor-pointer" title={n < 4 && onClick ? "Click to swap the photo" : undefined} />;
}

const nextDay = (hhmm: string) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hhmm || "09:00"}`;
};

export default function ClarePage() {
  const { presets } = usePresets();
  const preset = useMemo(() => presets.find((p) => /clare/i.test(p.name)) ?? null, [presets]);

  const [pool, setPool] = useState<Photo[]>([]);
  // The saved photos for each section. Uploaded once, kept for every post in that section.
  const [lib, setLib] = useState<LibImage[]>([]);
  const [libBusy, setLibBusy] = useState("");
  const [bitmaps, setBitmaps] = useState<Record<string, ImageBitmap>>({});
  const libFileRef = useRef<HTMLInputElement>(null);
  const libFolderRef = useRef<HTMLInputElement>(null);
  const loadLib = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/dental/images?clinic=${CLINIC_KEY}`);
      if (!r.ok) return;
      const data = await r.json();
      setLib((data.images ?? []) as LibImage[]);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadLib(); }, [loadLib]);
  const libBy = useMemo(() => {
    const m = new Map<string, LibImage[]>();
    for (const i of lib) m.set(i.groupId, [...(m.get(i.groupId) ?? []), i]);
    return m;
  }, [lib]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [group, setGroup] = useState(CLARE_SECTIONS[0].id);
  const [typeId, setTypeId] = useState(CLARE_SECTION_POSTS[0].id);
  const [scheduled, setScheduled] = useState<Record<string, string>>({}); // post type id -> date it goes out
  const [fonts, setFonts] = useState<Fonts>({ head: "Hatcher", body: "Montserrat" });
  const [tf, setTf] = useState<TitleFont>(null);
  const [look, setLook] = useState<Look>(() => { try { const r = localStorage.getItem(LOOK_KEY); if (r) return normLook({ ...DEFAULT_LOOK, ...JSON.parse(r) }); } catch { /* ignore */ } return DEFAULT_LOOK; });
  useEffect(() => { try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* ignore */ } }, [look]);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    if (preset?.logoUrl) loadLogoImg(preset.logoUrl).then((i) => { if (live) setLogo(i); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.id, preset?.logoUrl]);
  const uploadLogo = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadLogoImg(url).then(setLogo).catch(() => toast.error("That logo could not be read. Try a PNG."));
  };
  // the cover title is always Hatcher with a curly first letter
  useEffect(() => {
    let live = true;
    loadTitleFont().then((t) => live && setTf(t));
    return () => { live = false; };
  }, []);
  const [area, setArea] = useState("Wakefield");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const f = localStorage.getItem(FONT_KEY);
      if (f) setFonts(JSON.parse(f));
      const a = localStorage.getItem(AREA_KEY);
      if (a) setArea(a);
      const s = localStorage.getItem(SCHED_KEY);
      if (s) setScheduled(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(FONT_KEY, JSON.stringify(fonts)); } catch { /* ignore */ } }, [fonts]);
  useEffect(() => { try { localStorage.setItem(AREA_KEY, area); } catch { /* ignore */ } }, [area]);

  // Anything already in the scheduler for this clinic is crossed out too, on any device.
  const loadScheduled = useCallback(async () => {
    if (!preset) return;
    try {
      const r = await fetch(`${BASE}/api/scheduler/posts?presetId=${preset.id}`);
      if (!r.ok) return;
      const data = await r.json();
      const found: Record<string, string> = {};
      for (const sp of (data.posts ?? []) as { content?: { title?: string }; scheduledAt?: string; status?: string }[]) {
        const title = sp.content?.title ?? "";
        const t = CLARE_SECTION_POSTS.find((x) => title.startsWith(`${x.label} · `));
        if (t && sp.status !== "failed") found[t.id] = sp.scheduledAt ?? "";
      }
      setScheduled((cur) => ({ ...cur, ...found }));
    } catch { /* ignore */ }
  }, [preset]);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useEffect(() => { try { localStorage.setItem(SCHED_KEY, JSON.stringify(scheduled)); } catch { /* ignore */ } }, [scheduled]);

  const typesInGroup = useMemo(() => CLARE_SECTION_POSTS.filter((t) => t.group === group), [group]);

  const addPhotos = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const added: Photo[] = [];
    for (const f of Array.from(files)) {
      try {
        const raw = await createImageBitmap(f);
        const max = 2400;
        let bmp = raw;
        if (Math.max(raw.width, raw.height) > max) {
          const s = max / Math.max(raw.width, raw.height);
          const c = document.createElement("canvas");
          c.width = Math.round(raw.width * s);
          c.height = Math.round(raw.height * s);
          c.getContext("2d")!.drawImage(raw, 0, 0, c.width, c.height);
          bmp = await createImageBitmap(c);
        }
        added.push({ id: uid(), bmp, url: URL.createObjectURL(f) });
      } catch {
        toast.error(`${f.name} could not be read. Try a JPG or PNG.`);
      }
    }
    if (added.length) setPool((p) => [...p, ...added]);
  };

  // Every photo a post can use: its section's saved photos first, then anything added for this session.
  const photosOf = (post: Post): Photo[] => {
    const gid = TYPE_BY_ID.get(post.typeId)?.group ?? "";
    const saved: Photo[] = [];
    for (const i of libBy.get(gid) ?? []) { const bmp = bitmaps[i.url]; if (bmp) saved.push({ id: `lib-${i.id}`, bmp, url: localUrl(i.url) }); }
    return [...saved, ...pool];
  };
  const photoCount = (post: Post) => (libBy.get(TYPE_BY_ID.get(post.typeId)?.group ?? "") ?? []).length + pool.length;
  const photoFor = (post: Post, n: number): Photo | null => { const all = photosOf(post); return all.length ? all[post.photos[n] % all.length] ?? null : null; };

  // Load the saved pictures any open post needs
  useEffect(() => {
    let live = true;
    const need = new Set<string>();
    for (const p of posts) for (const i of libBy.get(TYPE_BY_ID.get(p.typeId)?.group ?? "") ?? []) need.add(i.url);
    need.forEach((url) => {
      if (bitmaps[url]) return;
      loadBitmap(url).then((b) => live && setBitmaps((cur) => (cur[url] ? cur : { ...cur, [url]: b }))).catch(() => undefined);
    });
    return () => { live = false; };
  }, [posts, libBy, bitmaps]);

  const uploadItems = async (items0: { file: File; groupId: string }[]) => {
    if (!items0.length) return;
    setLibBusy(`0 of ${items0.length}`);
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < items0.length; i += 3) {
        const batch = items0.slice(i, i + 3);
        try {
          const dataUrls = await Promise.all(batch.map((b) => resizeToDataUrl(b.file)));
          const urls = await uploadPngs(dataUrls, batch.map((b) => b.file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg"));
          const items = batch.map((b, k) => ({ groupId: b.groupId, name: b.file.name, url: urls[k] })).filter((x) => x.url);
          const r = await fetch(`${BASE}/api/dental/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinic: CLINIC_KEY, items }) });
          if (!r.ok) throw new Error("save failed");
          done += items.length;
        } catch { failed += batch.length; }
        setLibBusy(`${done + failed} of ${items0.length}`);
      }
      await loadLib();
      toast.success(`${done} photo${done === 1 ? "" : "s"} saved${failed ? `, ${failed} would not upload` : ""}`);
    } finally { setLibBusy(""); }
  };
  const uploadToSection = (fl: FileList | null) => {
    uploadItems(Array.from(fl ?? []).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, groupId: group })));
  };
  // Her whole "Clare" folder at once. Each photo goes to the section whose subfolder name matches.
  const uploadFolder = (fl: FileList | null) => {
    if (!fl?.length) return;
    const have = new Set(lib.map((i) => `${i.groupId}|${i.name}`));
    const picked: { file: File; groupId: string }[] = [];
    let skipped = 0;
    for (const f of Array.from(fl)) {
      const path = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/");
      if (!/\.(jpe?g|png|webp)$/i.test(f.name) || path.some((p) => p.startsWith("_") || p.startsWith("."))) continue;
      const id = [...path].slice(0, -1).reverse().map(folderToGroup).find(Boolean);
      if (!id || have.has(`${id}|${f.name}`)) { skipped++; continue; }
      have.add(`${id}|${f.name}`);
      picked.push({ file: f, groupId: id });
    }
    if (!picked.length) { toast.error("Nothing new to upload. Put the photos in subfolders named after the sections, like Skin boosters or Polynucleotides"); return; }
    if (skipped) toast.info(`${skipped} skipped, already uploaded or not inside a section folder`);
    uploadItems(picked);
  };
  const removeLibImage = async (img: LibImage) => {
    try {
      const r = await fetch(`${BASE}/api/dental/images/${img.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("no");
      setLib((l) => l.filter((x) => x.id !== img.id));
    } catch { toast.error("Could not remove it"); }
  };

  const addPost = (t: ClareSectionPost) => {
    const start = posts.length * 5;
    setPosts((l) => [{ id: uid(), typeId: t.id, hook: t.label, slides: ["", "", ""], cta: "", caption: "", hashtags: [], photos: [0, 1, 2, 3, 4].map((i) => start + i), note: "", when: nextDay(preset?.defaultPostTime ?? "09:00"), busy: false, scheduling: false }, ...l]);
    setTypeId(t.id);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const patch = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));

  // Her preset's caption footnote goes at the very end of every post, under the hashtags.
  const foot = (preset?.captionFootnote || "").trim();
  const noFoot = (c: string) => (foot ? c.split(foot).join("").trim() : c.trim());
  const fullCaption = (post: Post) => [noFoot(post.caption), post.hashtags.join(" "), foot].filter(Boolean).join("\n\n");

  const write = async (post: Post, fix?: string) => {
    if (!area.trim()) { toast.error("Type her area first, so the hashtags are local"); return; }
    const t = TYPE_BY_ID.get(post.typeId)!;
    patch(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/clare/copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: t.label, brief: t.brief, word: t.word, note: [post.note, fix ? `The last version was rejected, so put this right: ${fix.slice(0, 200)}` : ""].filter(Boolean).join(" ") }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      patch(post.id, { busy: false, hook: data.hook, slides: data.slides, cta: data.cta, caption: fixDoctor(data.caption), hashtags: data.hashtags, rejected: undefined });
    } catch (e) {
      patch(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const render = async (post: Post): Promise<HTMLCanvasElement[]> => {
    await ensureFonts(fonts);
    const tfNow = await loadTitleFont();
    const out: HTMLCanvasElement[] = [];
    for (let n = 0; n < 5; n++) {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      drawSlide(c.getContext("2d")!, post, n, photoFor(post, n), fonts, tfNow, lookFor(post), logo);
      out.push(c);
    }
    return out;
  };

  const download = async (post: Post) => {
    const t = TYPE_BY_ID.get(post.typeId)!;
    const zip = new JSZip();
    const cs = await render(post);
    for (let i = 0; i < cs.length; i++) {
      const blob: Blob | null = await new Promise((res) => cs[i].toBlob(res, "image/png"));
      if (blob) zip.file(`slide-${i + 1}.png`, blob);
    }
    zip.file("caption.txt", `${fullCaption(post)}\n`);
    saveAs(await zip.generateAsync({ type: "blob" }), `clare-${t.id}.zip`);
  };

  const lookFor = (post: Post): Look => normLook({ ...look, ...(post.look || {}) });

  // Pressing Schedule first asks: schedule it, or reject it with a reason.
  const [review, setReview] = useState<{ id: string; reason: string; rejecting: boolean } | null>(null);
  const REASONS = ["Wording is too long", "Tone is not right", "Not clinical enough", "Wrong photo", "Not suitable for her page", "Compliance concern"];
  const reject = (post: Post, rewrite: boolean) => {
    const reason = (review?.reason || "").trim();
    if (!reason) { toast.error("Add a reason first"); return; }
    patch(post.id, { rejected: reason });
    try {
      const log = JSON.parse(localStorage.getItem("clare-rejected-v1") || "[]");
      log.push({ typeId: post.typeId, hook: post.hook, reason, at: new Date().toISOString() });
      localStorage.setItem("clare-rejected-v1", JSON.stringify(log.slice(-200)));
    } catch { /* ignore */ }
    setReview(null);
    if (rewrite) write(post, reason);
    else toast.success("Rejected, with your reason saved on the post");
  };

  // Draws the slides, uploads them and sends the post to the scheduler. A bank post has no date.
  const send = async (post: Post, mode: "schedule" | "bank", whenIso?: string) => {
    if (!preset) throw new Error("I cannot find her client preset. It needs a name with Clare in it");
    const t = TYPE_BY_ID.get(post.typeId)!;
    if (!photoCount(post)) throw new Error("Add photos for this section first");
    const cs = await render(post);
    const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `clare-${t.id}-${i + 1}-${Date.now()}.png`));
    const content = { caption: fullCaption(post), title: `${t.label} · ${CLINIC_NAME}`, platforms: ["instagram"], imageUrls: urls, sourceTool: "clare" };
    const body = mode === "bank"
      ? { postType: "carousel", content, status: "draft", presetId: preset.id }
      : { postType: "carousel", content, scheduledAt: new Date(whenIso || post.when).toISOString(), isTrial: false, notes: "", presetId: preset.id };
    const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error || (mode === "bank" ? "Failed to save to the Client Bank" : "Failed to schedule")); }
    if (mode === "schedule") setScheduled((s) => ({ ...s, [t.id]: new Date(whenIso || post.when).toISOString() }));
  };

  const schedule = async (post: Post) => {
    patch(post.id, { scheduling: true });
    try {
      await send(post, "schedule");
      toast.success("Scheduled, and crossed off her list");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    }
    patch(post.id, { scheduling: false });
  };

  const bank = async (post: Post) => {
    patch(post.id, { scheduling: true });
    try {
      await send(post, "bank");
      patch(post.id, { banked: true });
      toast.success(`Added to ${preset?.name || CLINIC_NAME}'s Client Bank, no date`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to the bank");
    }
    patch(post.id, { scheduling: false });
  };

  // Every open post that has its words written and is not already scheduled, one every 2 days from the earliest date.
  const [bulkBusy, setBulkBusy] = useState("");
  const ready = posts.filter((p) => p.caption && !scheduled[p.typeId]);
  const bulk = async (mode: "schedule" | "bank") => {
    if (!preset) { toast.error("I cannot find her client preset"); return; }
    const list = mode === "bank" ? ready.filter((p) => !p.banked) : ready;
    if (!list.length) { toast.error("Nothing written and waiting. Press Write it on the posts first"); return; }
    const first = new Date([...list].sort((a, b) => a.when.localeCompare(b.when))[0].when);
    let done = 0;
    let failed = "";
    for (const [i, post] of list.entries()) {
      setBulkBusy(`${done + 1} of ${list.length}`);
      patch(post.id, { scheduling: true });
      try {
        const d = new Date(first);
        d.setDate(d.getDate() + i * 2);
        await send(post, mode, d.toISOString());
        if (mode === "bank") patch(post.id, { banked: true });
        done++;
      } catch (e) {
        failed = e instanceof Error ? e.message : "Something failed";
        patch(post.id, { scheduling: false });
        break;
      }
      patch(post.id, { scheduling: false });
    }
    setBulkBusy("");
    if (done) toast.success(mode === "bank" ? `${done} added to the Client Bank` : `${done} scheduled, one every 2 days from ${first.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    if (failed) toast.error(`Stopped after ${done}: ${failed}`);
  };

  const doneIn = (g: string) => CLARE_SECTION_POSTS.filter((t) => t.group === g && scheduled[t.id]).length;
  const totalIn = (g: string) => CLARE_SECTION_POSTS.filter((t) => t.group === g).length;
  const dateLabel = (iso: string) => { try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return ""; } };

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-3xl" style={{ fontFamily: `"${fonts.head}", serif` }}>{CLINIC_NAME}</h1>
            <p className="text-white/60 text-sm">Her own page. Photo first with a soft black wash and gold. 6 sections of 6 posts, names cross out once scheduled.{!preset && " (I cannot see her client preset yet, so scheduling is off.)"}</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">1. Set up</h2>
          <p className="text-white/60 text-sm">Cover title: Hatcher, with a curly first letter only (letters Hatcher has no curl for stay plain). Body font is still to be confirmed.</p>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <label className="space-y-1 block"><span className="text-white/60">Heading font (last slide and page heading)</span>
              <select className="w-full bg-white/5 rounded p-2" value={fonts.head} onChange={(e) => setFonts((f) => ({ ...f, head: e.target.value }))}>
                <option value="Hatcher" className="text-black">Hatcher</option>
                {SUITE_FONTS.map((f) => <option key={f.id} value={f.family} className="text-black">{f.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 block"><span className="text-white/60">Body font</span><input className="w-full bg-white/5 rounded p-2" value={fonts.body} onChange={(e) => setFonts((f) => ({ ...f, body: e.target.value }))} /></label>
            <label className="space-y-1 block"><span className="text-white/60">Her area (for the hashtags)</span><input className="w-full bg-white/5 rounded p-2" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Wakefield" /></label>
          </div>
          <p className="text-white/40 text-xs">Body font is a plain name for now, until you confirm it. Caption footnote from her preset: {foot ? `"${foot}"` : "none saved yet"}. It goes at the very end of every post, under the 5 hashtags.</p>
          <div className="space-y-4 text-sm">
            <ColourPicker label="Gradient colour (the default for every post)" value={normLook(look).wash} onChange={(v) => setLook((l) => ({ ...l, wash: v }))} />
            <label className="space-y-1 block max-w-sm">
              <span className="text-white/60">Gradient strength: {look.opacity}%</span>
              <input type="range" min={0} max={100} step={5} value={look.opacity} onChange={(e) => setLook((l) => ({ ...l, opacity: Number(e.target.value) }))} className="w-full" />
            </label>
            <ColourPicker label="Writing colour" value={normLook(look).text} onChange={(v) => setLook((l) => ({ ...l, text: v }))} extra={[{ name: "Match gradient", hex: "auto" }]} />
            <ColourPicker label="Headline colour" value={normLook(look).headline} onChange={(v) => setLook((l) => ({ ...l, headline: v }))} extra={[{ name: "Same as writing", hex: "auto" }]} />
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1 block">
              <span className="text-white/60">Title size: {look.titleSize}%</span>
              <input type="range" min={60} max={160} step={5} value={look.titleSize} onChange={(e) => setLook((l) => ({ ...l, titleSize: Number(e.target.value) }))} className="w-full" />
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">Writing size (slides 2 to 5): {look.bodySize}%</span>
              <input type="range" min={60} max={160} step={5} value={look.bodySize} onChange={(e) => setLook((l) => ({ ...l, bodySize: Number(e.target.value) }))} className="w-full" />
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">Logo size: {look.logoSize}%</span>
              <input type="range" min={40} max={200} step={5} value={look.logoSize} onChange={(e) => setLook((l) => ({ ...l, logoSize: Number(e.target.value) }))} className="w-full" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white/60">Logo (top right): {logo ? "loaded" : "none found on her client preset"}</span>
            <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadLogo(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <Button size="sm" variant="secondary" onClick={() => logoFileRef.current?.click()}>{logo ? "Change logo" : "Upload logo"}</Button>
            {logo && <Button size="sm" variant="outline" onClick={() => setLogo(null)}>Hide logo</Button>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={look.logoWhite} onChange={(e) => setLook((l) => ({ ...l, logoWhite: e.target.checked }))} /> Make the logo white</label>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <h3 className="font-medium">Extra photos for this session only</h3>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.currentTarget.value = ""; }} />
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => fileRef.current?.click()} variant="secondary"><ImagePlus className="w-4 h-4 mr-2" />Upload photos</Button>
              <ApprovedImagesPicker
                clientName={preset?.name || CLINIC_NAME}
                mode="multi"
                skipBackgroundRemoval
                large
                label="Use approved photos"
                onAddImages={(files) => { if (files.length) addPhotos(files); }}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pool.length === 0 && <p className="text-white/50 text-sm">Optional. Photos added here are used on every post this session, after the section's saved photos. Photos that should stay saved go in the saved photos box under step 2.</p>}
            {pool.map((p, i) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="" className="w-16 h-20 object-cover rounded" />
                <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => setPool((l) => l.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${i + 1}`}><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="text-sm text-white/60">Template: 1. Photo with gradient wash.</div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">2. Pick a post</h2>
          <div className="flex gap-2 flex-wrap">
            {CLARE_SECTIONS.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} className={`px-3 py-1.5 rounded-full text-sm border ${group === g.id ? "bg-white text-black border-white" : "border-white/20 text-white/80"}`}>
                {g.label} <span className="opacity-60">{doneIn(g.id)}/{totalIn(g.id)} · {(libBy.get(g.id) ?? []).length} photo{(libBy.get(g.id) ?? []).length === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-white/10 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-medium">{CLARE_SECTIONS.find((g) => g.id === group)?.label}: saved photos</h3>
              <div className="flex items-center gap-2">
                {libBusy && <span className="text-sm text-white/70 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Uploading {libBusy}</span>}
                <input ref={libFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadToSection(e.target.files); e.currentTarget.value = ""; }} />
                <input ref={libFolderRef} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { uploadFolder(e.target.files); e.currentTarget.value = ""; }} />
                <Button size="sm" variant="secondary" disabled={!!libBusy} onClick={() => libFolderRef.current?.click()}><FolderUp className="w-4 h-4 mr-2" />Upload my Clare folder</Button>
                <Button size="sm" variant="secondary" disabled={!!libBusy} onClick={() => libFileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-2" />Upload photos for this section</Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(libBy.get(group) ?? []).length === 0 && <p className="text-white/50 text-sm">No saved photos for this section yet. Upload them once and they stay here for every post in this section.</p>}
              {(libBy.get(group) ?? []).map((i) => (
                <div key={i.id} className="relative">
                  <img src={localUrl(i.url)} alt="" className="w-16 h-20 object-cover rounded" />
                  <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => removeLibImage(i)} aria-label="Remove photo"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {typesInGroup.map((t) => {
              const when = scheduled[t.id];
              return (
                <button key={t.id} onClick={() => addPost(t)} className={`text-left px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${typeId === t.id ? "border-white bg-white/10" : "border-white/15"}`}>
                  {when ? <CalendarCheck className="w-4 h-4 text-green-400 shrink-0" /> : <Plus className="w-4 h-4 text-white/40 shrink-0" />}
                  <span className={when ? "line-through decoration-2 opacity-50" : ""}>{t.label}</span>
                  {when && <span className="ml-auto text-xs text-green-300/80 whitespace-nowrap">{dateLabel(when)}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          {posts.length === 0 && <p className="text-white/50 text-sm">Press a post name above and it opens here.</p>}
          {posts.length > 0 && (
            <div className="rounded-xl border border-white/10 p-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-white/70">{ready.length} written and waiting</span>
              {bulkBusy && <span className="text-sm text-white/70 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{bulkBusy}</span>}
              <div className="ml-auto flex gap-2 flex-wrap">
                <Button size="sm" disabled={!!bulkBusy || !ready.length} onClick={() => bulk("schedule")}><CalendarClock className="w-4 h-4 mr-2" />Schedule all, one every 2 days</Button>
                <Button size="sm" variant="secondary" disabled={!!bulkBusy || !ready.length} onClick={() => bulk("bank")}><Archive className="w-4 h-4 mr-2" />Add all to Client Bank</Button>
              </div>
            </div>
          )}
          {posts.map((post) => {
            const t = TYPE_BY_ID.get(post.typeId)!;
            return (
              <div key={post.id} className="rounded-xl border border-white/10 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{t.label}</h3>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button size="sm" onClick={() => write(post)} disabled={post.busy}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Write it
                    </Button>
                    <input type="datetime-local" className="bg-white/5 rounded p-1.5 text-sm" value={post.when} onChange={(e) => patch(post.id, { when: e.target.value })} />
                    <Button size="sm" onClick={() => schedule(post)} disabled={!post.caption || post.scheduling}>
                      {post.scheduling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-2" />}Schedule
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => bank(post)} disabled={!post.caption || post.scheduling}><Archive className="w-4 h-4 mr-2" />{post.banked ? "In the bank" : "Client Bank"}</Button>
                    <Button size="sm" variant="secondary" onClick={() => download(post)} disabled={!post.caption}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((p) => p.id !== post.id))} aria-label="Remove post"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {post.rejected && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm flex items-start justify-between gap-3">
                    <div><span className="font-semibold text-red-300">Rejected.</span> {post.rejected}</div>
                    <button className="underline text-white/70 shrink-0" onClick={() => patch(post.id, { rejected: undefined })}>Clear</button>
                  </div>
                )}
                {review && review.id === post.id && (
                  <div className="rounded-lg border border-white/20 bg-white/5 p-4 space-y-3 text-sm">
                    {!review.rejecting ? (
                      <>
                        <p className="font-medium">Happy with this post?</p>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" className="border-red-400/50 text-red-300" onClick={() => setReview({ ...review, rejecting: true })}>Reject it with a reason</Button>
                          <Button size="sm" variant="ghost" onClick={() => setReview(null)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Why are you rejecting it?</p>
                        <div className="flex gap-2 flex-wrap">
                          {REASONS.map((r) => (
                            <button key={r} onClick={() => setReview({ ...review, reason: r })} className={`rounded-full border px-3 py-1 ${review.reason === r ? "border-red-400 bg-red-400/15" : "border-white/20 hover:border-white/50"}`}>{r}</button>
                          ))}
                        </div>
                        <textarea rows={2} className="w-full bg-white/5 border border-white/15 rounded-md p-2" placeholder="Or type your own reason" value={review.reason} onChange={(e) => setReview({ ...review, reason: e.target.value })} />
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" onClick={() => reject(post, true)} disabled={post.busy}><Sparkles className="w-4 h-4 mr-2" />Reject and rewrite it</Button>
                          <Button size="sm" variant="secondary" onClick={() => reject(post, false)}>Reject only</Button>
                          <Button size="sm" variant="ghost" onClick={() => setReview(null)}>Cancel</Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-white/10 p-3 grid md:grid-cols-2 gap-3 text-xs items-start">
                  <ColourPicker small label="This post: gradient" value={lookFor(post).wash} onChange={(v) => patch(post.id, { look: { ...post.look, wash: v } })} />
                  <label className="space-y-1 block">
                    <span className="text-white/60">Strength: {lookFor(post).opacity}%</span>
                    <input type="range" min={0} max={100} step={5} value={lookFor(post).opacity} onChange={(e) => patch(post.id, { look: { ...post.look, opacity: Number(e.target.value) } })} className="w-full" />
                  </label>
                  <ColourPicker small label="Writing" value={lookFor(post).text} onChange={(v) => patch(post.id, { look: { ...post.look, text: v } })} extra={[{ name: "Match", hex: "auto" }]} />
                  <div className="space-y-1">
                    <ColourPicker small label="Headline" value={lookFor(post).headline} onChange={(v) => patch(post.id, { look: { ...post.look, headline: v } })} extra={[{ name: "Writing colour", hex: "auto" }]} />
                    {post.look && Object.keys(post.look).length > 0 && <button className="underline text-white/50" onClick={() => patch(post.id, { look: undefined })}>Back to the page setting</button>}
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <SlideCanvas key={n} post={post} n={n} photo={photoFor(post, n)} fonts={fonts} tf={tf} look={lookFor(post)} logo={logo} onClick={n < 4 && photoCount(post) > 1 ? () => patch(post.id, { photos: post.photos.map((v, i) => (i === n ? v + 1 : v)) }) : undefined} />
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1 block">
                    <span className="text-white/60">Front slide</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.hook} onChange={(e) => patch(post.id, { hook: e.target.value })} />
                  </label>
                  {[0, 1, 2].map((i) => (
                    <label key={i} className="space-y-1 block">
                      <span className="text-white/60">Slide {i + 2}</span>
                      <textarea className="w-full bg-white/5 rounded p-2" rows={3} value={post.slides[i]} onChange={(e) => patch(post.id, { slides: post.slides.map((s, k) => (k === i ? e.target.value : s)) })} />
                    </label>
                  ))}
                  <label className="space-y-1 block md:col-span-2">
                    <span className="text-white/60">Caption</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={6} value={post.caption} onChange={(e) => patch(post.id, { caption: e.target.value })} />
                  </label>
                  <p className="md:col-span-2 text-white/50">{post.hashtags.join(" ")}</p>
                  <label className="space-y-1 block md:col-span-2">
                    <span className="text-white/60">Anything extra for this one (optional)</span>
                    <input className="w-full bg-white/5 rounded p-2" value={post.note} onChange={(e) => patch(post.id, { note: e.target.value })} placeholder="A detail to include" />
                  </label>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
