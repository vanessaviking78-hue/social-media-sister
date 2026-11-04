import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Archive, ArrowLeft, CalendarCheck, CalendarClock, Download, FolderUp, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets } from "@/lib/use-presets";
import { uploadPngs } from "@/lib/month-engine";
import { drawTitle, hasClientStyle, injectSuiteFontCss, layoutTitle, loadSuiteFont, readTitleStyle, titleHeight, type LoadedFont, type SwapRate, type TitleStyle } from "@/lib/suite-fonts";
import { POSTS_PER_TREATMENT, U_BY_ID, U_GROUPS, U_TREATMENTS, postTypesFor, type UGroupId, type UPostType, type UTreatment } from "@/lib/universal-treatments";

// UNIVERSAL: any client, every non prescription treatment, six posts each.
// Photo first with a gradient wash. Headline in Blue Mirage, subtitle and every page after in Montserrat.
// Writing is white unless she says otherwise. Fixed luxury photos live in the tool, one set per treatment.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
const LOOK_KEY = "universal-look-v1";
const SCHED_KEY = "universal-scheduled-v1";
const BODY_FONT = "Montserrat";

// The headline font is the same for every client. The curly, joined-up letters are the font's own alternates,
// so they only appear when a swap is chosen. Use the look saved in Font Lab if it is for Blue Mirage.
export const BASE_TITLE: TitleStyle = { fontId: "blue-mirage", tracking: 40, upper: false, ligatures: true, swaps: {}, rate: "some" };
const RATES: { id: SwapRate; label: string }[] = [
  { id: "off", label: "None" },
  { id: "starts", label: "First letters" },
  { id: "some", label: "Some" },
  { id: "all", label: "All" },
];

type Dir = "bottom" | "top";
// grad is optional: when it is set, the closing slide is a soft diagonal gradient from wash to grad instead of one flat colour.
export type Look = { wash: string; opacity: number; dir: Dir; text: string; titleSize: number; bodySize: number; logoSize: number; logoWhite: boolean; bw: boolean; grad?: string; bodyFont?: string };
export const DEFAULT_LOOK: Look = { wash: "#0d0d0d", opacity: 100, dir: "bottom", text: "#ffffff", titleSize: 100, bodySize: 100, logoSize: 100, logoWhite: false, bw: false };

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
// Metallic finishes. A colour value is either a hex, or "metal:name" for a shiny multi stop gradient.
export const METALS: { id: string; name: string; stops: string[] }[] = [
  { id: "gold", name: "Gold", stops: ["#7a5a14", "#d4a93c", "#fff1a8", "#c9962b", "#7a5a14"] },
  { id: "rosegold", name: "Rose gold", stops: ["#8a4f45", "#d9a08f", "#ffe3d6", "#c98a79", "#8a4f45"] },
  { id: "silver", name: "Silver", stops: ["#6d6f73", "#c9ccd1", "#ffffff", "#a9adb3", "#6d6f73"] },
  { id: "champagne", name: "Champagne", stops: ["#9c8458", "#e6d2a8", "#fff8e6", "#d2bb8c", "#9c8458"] },
  { id: "bronze", name: "Bronze", stops: ["#5c3a1a", "#a8713a", "#e0ac72", "#8a5a2a", "#5c3a1a"] },
  { id: "copper", name: "Copper", stops: ["#6e2f1a", "#c0683f", "#f0a984", "#b05a35", "#6e2f1a"] },
  { id: "gunmetal", name: "Gunmetal", stops: ["#1c1f24", "#4a5059", "#8b929c", "#3a3f47", "#1c1f24"] },
];
const metalOf = (v: string) => (v.startsWith("metal:") ? METALS.find((m) => m.id === v.slice(6)) : undefined);
const metalCss = (m: { stops: string[] }) => `linear-gradient(135deg, ${m.stops.map((c, i) => `${c} ${Math.round((i / (m.stops.length - 1)) * 100)}%`).join(", ")})`;
const metalFill = (ctx: CanvasRenderingContext2D, m: { stops: string[] }, x0: number, y0: number, x1: number, y1: number) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  m.stops.forEach((c, i) => g.addColorStop(i / (m.stops.length - 1), c));
  return g;
};

const rgbOf = (hex: string) => {
  const h = isHex(hex) ? hex : "#0d0d0d";
  return `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
};

export type Photo = { url: string; bmp: ImageBitmap };
type LibImage = { id: number; treatmentId: string; name: string; url: string };

export type Post = {
  id: string;
  key: string; // treatment id : post number
  treatmentId: string;
  index: number;
  headline: string;
  subtitle: string;
  slides: string[];
  cta: string;
  caption: string;
  hashtags: string[];
  photos: number[];
  note: string;
  when: string;
  busy: boolean;
  scheduling: boolean;
  banked?: boolean;
  rejected?: string;
  look?: Partial<Pick<Look, "wash" | "opacity" | "dir" | "text" | "bw">>;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const nextDay = (hhmm: string) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hhmm || "09:00"}`;
};

// The picture URLs come back as full addresses. Keep only the path so they load from this site.
const localUrl = (u: string) => {
  const i = u.indexOf("/api/content/images/");
  return i >= 0 ? `${BASE}${u.slice(i)}` : u;
};

const bitmapCache = new Map<string, Promise<ImageBitmap>>();
export function loadBitmap(url: string): Promise<ImageBitmap> {
  let p = bitmapCache.get(url);
  if (!p) {
    p = fetch(localUrl(url)).then((r) => {
      if (!r.ok) throw new Error("image missing");
      return r.blob();
    }).then((b) => createImageBitmap(b));
    bitmapCache.set(url, p);
    p.catch(() => bitmapCache.delete(url));
  }
  return p;
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

export async function ensureFonts() {
  loadGoogleFonts();
  injectSuiteFontCss();
  try {
    await Promise.all([document.fonts.load(`400 40px "${BODY_FONT}"`), document.fonts.load(`600 40px "${BODY_FONT}"`)]);
  } catch {
    /* falls back to sans serif */
  }
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

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, start: number, min: number, lh: number) {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines };
  }
  ctx.font = font(min);
  return { px: min, lines: wrap(ctx, text, maxW) };
}

// Black and white, done pixel by pixel so it works in every browser.
function toGrey(ctx: CanvasRenderingContext2D) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
}

function coverFit(ctx: CanvasRenderingContext2D, bmp: ImageBitmap) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * s;
  const h = bmp.height * s;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) * 0.3, w, h);
}

// The wash: clear where the picture shows, solid where the writing sits. It grows from the bottom or from the top.
function wash(ctx: CanvasRenderingContext2D, from: number, look: Look) {
  const o = Math.max(0, Math.min(100, look.opacity)) / 100;
  const bottom = look.dir === "bottom";
  const metal = metalOf(look.wash);
  const c = metal ? "0,0,0" : rgbOf(look.wash);
  const g = bottom ? ctx.createLinearGradient(0, H * from, 0, H) : ctx.createLinearGradient(0, H * (1 - from), 0, 0);
  g.addColorStop(0, `rgba(${c},0)`);
  g.addColorStop(0.45, `rgba(${c},${0.88 * o})`);
  g.addColorStop(0.7, `rgba(${c},${0.98 * o})`);
  g.addColorStop(1, `rgba(${c},${o})`);
  if (!metal) {
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // metallic: paint the shine on a spare canvas, fade it with the same ramp, then lay it over the photo
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

// Solid fill for the last slide: a hex or a metallic sheen.
function solidFill(ctx: CanvasRenderingContext2D, v: string): string | CanvasGradient {
  const m = metalOf(v);
  return m ? metalFill(ctx, m, 0, 0, W, H) : v;
}

// Writing colour: a hex, or a metallic sheen across the band the writing sits in.
function inkPaint(ctx: CanvasRenderingContext2D, v: string, y: number, h: number): string | CanvasGradient {
  const m = metalOf(v);
  return m ? metalFill(ctx, m, 100, y, W - 100, y + Math.max(h, 60)) : v;
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, look: Look) {
  if (!logo || !logo.naturalWidth) return;
  const k = look.logoSize / 100;
  const sc = Math.min((210 * k) / logo.naturalWidth, (100 * k) / logo.naturalHeight);
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

export type TitleFont = { lf: LoadedFont; style: TitleStyle } | null;

// Slide 0 is the cover, 1 to 3 are the writing, 4 is the call to action.
export function drawSlide(ctx: CanvasRenderingContext2D, post: Post, n: number, photo: Photo | null, tf: TitleFont, look: Look, logo: HTMLImageElement | null) {
  const ts = (look.titleSize || 100) / 100;
  const bs = (look.bodySize || 100) / 100;
  const ink = look.text;
  const body = (px: number, w = 400) => `${w} ${px}px "${look.bodyFont || BODY_FONT}", serif`;
  const LEFT = 100;
  const top = look.dir === "top";
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "top";

  if (n === 4) {
    if (look.grad && isHex(look.grad) && isHex(look.wash)) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, look.wash);
      g.addColorStop(1, look.grad);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = solidFill(ctx, look.wash);
    }
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = inkPaint(ctx, ink, H / 2 - 200, 400);
    ctx.textAlign = "left";
    const fit = fitText(ctx, post.cta || "", (px) => body(px, 600), W - LEFT * 2, 520 * Math.max(1, bs), Math.round(76 * bs), Math.round(40 * bs), 1.25);
    const total = fit.lines.length * fit.px * 1.25;
    let y = (H - total) / 2 - 20;
    ctx.font = body(fit.px, 600);
    for (const l of fit.lines) {
      ctx.fillText(l, LEFT, y);
      y += fit.px * 1.25;
    }
    ctx.strokeStyle = inkPaint(ctx, ink, y, 60);
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(LEFT, y + 36);
    ctx.lineTo(LEFT + 120, y + 36);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawLogo(ctx, logo, look);
    return;
  }

  if (photo) {
    coverFit(ctx, photo.bmp);
    if (look.bw) toGrey(ctx);
  } else {
    ctx.fillStyle = "#3a3633";
    ctx.fillRect(0, 0, W, H);
  }

  if (n === 0) {
    wash(ctx, 0.5, look);
    ctx.textAlign = "center";
    // subtitle first, so the headline can sit above it (or below it when the wash is at the top)
    const sub = fitText(ctx, post.subtitle || "", (px) => body(px), W - 220, 170, Math.round(36 * bs), Math.round(24 * bs), 1.45);
    const subH = sub.lines.length * sub.px * 1.45;
    let size = Math.round(120 * ts);
    const make = (s: number) => (tf ? layoutTitle(tf.lf, post.headline || "", tf.style, s, W - 200, 1.12) : null);
    let layout = make(size);
    while (layout && size > Math.round(50 * ts) && titleHeight(layout) > 330 * Math.max(1, ts)) {
      size -= 4;
      layout = make(size);
    }
    const headH = layout ? titleHeight(layout) : 110;
    const gap = 30;
    const startY = top ? 190 : H - 110 - subH - gap - headH;
    if (tf && layout) {
      drawTitle(ctx, tf.lf, layout, tf.style, 100, startY, "center", W - 200, inkPaint(ctx, ink, startY, headH + subH + gap));
    } else {
      ctx.fillStyle = inkPaint(ctx, ink, startY, 120);
      ctx.font = `400 90px "${BODY_FONT}", sans-serif`;
      ctx.fillText(post.headline || "", W / 2, startY);
    }
    ctx.fillStyle = inkPaint(ctx, ink, startY, headH + subH + gap);
    ctx.globalAlpha = 0.92;
    ctx.font = body(sub.px);
    let y = startY + headH + gap;
    for (const l of sub.lines) {
      ctx.fillText(l, W / 2, y);
      y += sub.px * 1.45;
    }
    ctx.globalAlpha = 1;
    drawLogo(ctx, logo, look);
    return;
  }

  wash(ctx, 0.3, look);
  ctx.textAlign = "left";
  const text = post.slides[n - 1] || "";
  const fit = fitText(ctx, text, (px) => body(px), W - LEFT * 2, 520 * Math.max(1, bs), Math.round(40 * bs), Math.round(26 * bs), 1.55);
  const total = fit.lines.length * fit.px * 1.55;
  let y = top ? 190 : H - 170 - total;
  ctx.fillStyle = inkPaint(ctx, ink, y, total);
  ctx.font = body(fit.px);
  for (const l of fit.lines) {
    ctx.fillText(l, LEFT, y);
    y += fit.px * 1.55;
  }
  drawLogo(ctx, logo, look);
}

function SlideCanvas({ post, n, photo, tf, look, logo, onClick }: { post: Post; n: number; photo: Photo | null; tf: TitleFont; look: Look; logo: HTMLImageElement | null; onClick?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      await ensureFonts();
      const c = ref.current;
      if (!c || !live) return;
      const ctx = c.getContext("2d");
      if (ctx) drawSlide(ctx, post, n, photo, tf, look, logo);
    })();
    return () => {
      live = false;
    };
  }, [post, n, photo, tf, look, logo]);
  return <canvas ref={ref} width={W} height={H} onClick={onClick} className="w-[150px] h-auto rounded-md border border-white/10 cursor-pointer" title={onClick ? "Click to swap the photo" : undefined} />;
}

// A colour picker: quick swatches plus any colour she likes.
function ColourPicker({ label, value, onChange, swatches }: { label: string; value: string; onChange: (hex: string) => void; swatches: { name: string; hex: string }[] }) {
  return (
    <div className="space-y-1 text-sm">
      <span className="text-white/60">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        {swatches.map((s) => (
          <button
            key={`${s.name}-${s.hex}`}
            onClick={() => onChange(s.hex)}
            title={s.name}
            className={`h-8 min-w-8 px-2 rounded-md border text-xs ${value.toLowerCase() === s.hex.toLowerCase() ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-white/25 hover:border-white/60"}`}
            style={{ background: metalOf(s.hex) ? metalCss(metalOf(s.hex)!) : s.hex, color: s.hex.toLowerCase() === "#ffffff" || (metalOf(s.hex) && !["bronze", "copper", "gunmetal"].includes(s.hex.slice(6))) ? "#111" : "#fff", textShadow: metalOf(s.hex) ? "0 0 3px rgba(255,255,255,.35)" : undefined }}
          >
            {s.name}
          </button>
        ))}
        <label className="flex items-center gap-2 text-white/70">
          <input type="color" value={isHex(value) ? value : "#0d0d0d"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded bg-transparent border border-white/25 p-0.5 cursor-pointer" />
          Any colour
        </label>
      </div>
    </div>
  );
}

async function resizeToDataUrl(file: File, max = 1600): Promise<string> {
  const raw = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(raw.width, raw.height));
  const c = document.createElement("canvas");
  c.width = Math.round(raw.width * s);
  c.height = Math.round(raw.height * s);
  c.getContext("2d")!.drawImage(raw, 0, 0, c.width, c.height);
  raw.close();
  return c.toDataURL("image/jpeg", 0.85);
}

export default function UniversalPage() {
  const { presets } = usePresets();
  // Always starts with no client chosen, so it asks every time and never carries the last client over.
  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) ?? null, [presets, presetId]);

  const [look, setLook] = useState<Look>(() => {
    try {
      const r = localStorage.getItem(LOOK_KEY);
      if (r) return { ...DEFAULT_LOOK, ...JSON.parse(r) };
    } catch {
      /* ignore */
    }
    return DEFAULT_LOOK;
  });
  useEffect(() => {
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify(look));
    } catch {
      /* ignore */
    }
  }, [look]);

  const [area, setArea] = useState("");
  useEffect(() => {
    if (!preset) return;
    let saved = "";
    try {
      saved = localStorage.getItem(`universal-area-${preset.id}`) || "";
    } catch {
      /* ignore */
    }
    setArea(saved || preset.seoArea || "");
  }, [preset?.id, preset?.seoArea]);
  useEffect(() => {
    if (!preset) return;
    try {
      localStorage.setItem(`universal-area-${preset.id}`, area);
    } catch {
      /* ignore */
    }
  }, [area, preset?.id]);

  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let live = true;
    setLogo(null);
    if (preset?.logoUrl) loadLogoImg(preset.logoUrl).then((i) => live && setLogo(i)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [preset?.id, preset?.logoUrl]);

  const [lfont, setLfont] = useState<LoadedFont | null>(null);
  const [rate, setRate] = useState<SwapRate>(() => {
    try {
      return (localStorage.getItem("universal-curly-v1") as SwapRate) || "some";
    } catch {
      return "some";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("universal-curly-v1", rate);
    } catch {
      /* ignore */
    }
  }, [rate]);
  // A look saved for this client in Font Lab replaces Blue Mirage for them.
  const clientStyle = useMemo(() => (preset && hasClientStyle(preset.name) ? readTitleStyle(preset.name) : null), [preset]);
  const fontId = clientStyle?.fontId ?? BASE_TITLE.fontId;
  useEffect(() => {
    let live = true;
    setLfont(null);
    loadSuiteFont(fontId).then((lf) => live && setLfont(lf)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [fontId]);
  const tf: TitleFont = useMemo(() => {
    if (!lfont) return null;
    if (clientStyle) return { lf: lfont, style: clientStyle };
    const saved = readTitleStyle();
    const mine = saved.fontId === BASE_TITLE.fontId && Object.keys(saved.swaps).length > 0;
    // Her Font Lab choices win. Otherwise every letter that has one gets the font's first curly version.
    const swaps: Record<string, string> = mine ? saved.swaps : {};
    if (!mine) for (const [ch, list] of Object.entries(lfont.data.alts)) if (list.length) swaps[ch] = list[0];
    return { lf: lfont, style: { ...BASE_TITLE, tracking: mine ? saved.tracking : BASE_TITLE.tracking, swaps, rate } };
  }, [lfont, rate, clientStyle]);

  // The fixed photos for every treatment
  const [lib, setLib] = useState<LibImage[]>([]);
  const [libBusy, setLibBusy] = useState<string>("");
  const loadLib = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/universal/images`);
      if (!r.ok) return;
      const data = await r.json();
      setLib((data.images ?? []) as LibImage[]);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    loadLib();
  }, [loadLib]);
  const libBy = useMemo(() => {
    const m = new Map<string, LibImage[]>();
    for (const i of lib) m.set(i.treatmentId, [...(m.get(i.treatmentId) ?? []), i]);
    return m;
  }, [lib]);

  const [groupId, setGroupId] = useState<UGroupId>(U_GROUPS[0].id);
  const [treatmentId, setTreatmentId] = useState<string>(U_TREATMENTS[0].id);
  const treatment = U_BY_ID.get(treatmentId) as UTreatment;
  const [posts, setPosts] = useState<Post[]>([]);
  const [bitmaps, setBitmaps] = useState<Record<string, ImageBitmap>>({});
  const [scheduled, setScheduled] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // Load the pictures any open post needs
  useEffect(() => {
    let live = true;
    const need = new Set<string>();
    for (const p of posts) for (const i of libBy.get(p.treatmentId) ?? []) need.add(i.url);
    need.forEach((url) => {
      if (bitmaps[url]) return;
      loadBitmap(url).then((b) => live && setBitmaps((cur) => (cur[url] ? cur : { ...cur, [url]: b }))).catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, [posts, libBy, bitmaps]);

  const photoFor = (post: Post, n: number): Photo | null => {
    const imgs = libBy.get(post.treatmentId) ?? [];
    if (!imgs.length || n > 3) return null;
    const img = imgs[post.photos[n] % imgs.length];
    const bmp = img ? bitmaps[img.url] : undefined;
    return img && bmp ? { url: img.url, bmp } : null;
  };

  const uploadFiles = async (files: { file: File; treatmentId: string }[]) => {
    if (!files.length) return;
    setLibBusy(`0 of ${files.length}`);
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i += 3) {
        const batch = files.slice(i, i + 3);
        try {
          const dataUrls = await Promise.all(batch.map((b) => resizeToDataUrl(b.file)));
          const urls = await uploadPngs(dataUrls, batch.map((b) => b.file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg"));
          const items = batch.map((b, k) => ({ treatmentId: b.treatmentId, name: b.file.name, url: urls[k] })).filter((x) => x.url);
          await fetch(`${BASE}/api/universal/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
          done += items.length;
        } catch {
          failed += batch.length;
        }
        setLibBusy(`${done + failed} of ${files.length}`);
      }
      await loadLib();
      toast.success(`${done} photo${done === 1 ? "" : "s"} saved${failed ? `, ${failed} would not upload` : ""}`);
    } finally {
      setLibBusy("");
    }
  };

  const uploadToTreatment = (fl: FileList | null) => {
    if (!fl?.length) return;
    uploadFiles(Array.from(fl).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, treatmentId })));
  };

  // Her whole "Universal images" folder at once. Each photo goes to the treatment whose folder it sits in.
  const uploadFolder = (fl: FileList | null) => {
    if (!fl?.length) return;
    const byName = new Map(U_TREATMENTS.map((x) => [x.name.toLowerCase(), x.id]));
    const have = new Set(lib.map((i) => `${i.treatmentId}|${i.name}`));
    const picked: { file: File; treatmentId: string }[] = [];
    let skipped = 0;
    for (const f of Array.from(fl)) {
      const path = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/");
      if (!/\.(jpe?g|png|webp)$/i.test(f.name) || path.some((p) => p.startsWith("_"))) continue;
      const id = [...path].reverse().map((p) => byName.get(p.toLowerCase())).find(Boolean);
      if (!id || have.has(`${id}|${f.name}`)) {
        skipped++;
        continue;
      }
      have.add(`${id}|${f.name}`);
      picked.push({ file: f, treatmentId: id });
    }
    if (!picked.length) {
      toast.error("Nothing new to upload. Choose the Universal images folder itself");
      return;
    }
    if (skipped) toast.info(`${skipped} skipped, already uploaded or not in a treatment folder`);
    uploadFiles(picked);
  };

  const removeImage = async (img: LibImage) => {
    try {
      await fetch(`${BASE}/api/universal/images/${img.id}`, { method: "DELETE" });
      setLib((l) => l.filter((x) => x.id !== img.id));
    } catch {
      toast.error("Could not remove it");
    }
  };

  // Clears the whole photo library so a fresh set can go in. She presses it herself and confirms first.
  const removeAllImages = async () => {
    if (!lib.length) {
      toast.info("There are no photos to remove");
      return;
    }
    if (!window.confirm(`Remove all ${lib.length} photos from every treatment? This cannot be undone. The 10 free posts tool uses these photos too, so it will have none until you add new ones.`)) {
      return;
    }
    setLibBusy(`Removing ${lib.length} photos`);
    let failed = 0;
    for (const img of lib) {
      try {
        const r = await fetch(`${BASE}/api/universal/images/${img.id}`, { method: "DELETE" });
        if (!r.ok) failed++;
      } catch {
        failed++;
      }
    }
    setLibBusy("");
    await loadLib();
    if (failed) toast.error(`${failed} photos could not be removed. Press the button again to retry`);
    else toast.success("All photos removed. Add your new ones with the upload buttons");
  };

  // What has already gone into the scheduler for this client
  const keyOf = (postKey: string) => `${preset?.id ?? 0}|${postKey}`;
  useEffect(() => {
    try {
      const s = localStorage.getItem(SCHED_KEY);
      if (s) setScheduled(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SCHED_KEY, JSON.stringify(scheduled));
    } catch {
      /* ignore */
    }
  }, [scheduled]);
  const loadScheduled = useCallback(async () => {
    if (!preset) return;
    try {
      const r = await fetch(`${BASE}/api/scheduler/posts?presetId=${preset.id}`);
      if (!r.ok) return;
      const data = await r.json();
      const found: Record<string, string> = {};
      for (const sp of (data.posts ?? []) as { content?: { universalKey?: string }; scheduledAt?: string; status?: string }[]) {
        const k = sp.content?.universalKey;
        if (k && sp.status !== "failed") found[`${preset.id}|${k}`] = sp.scheduledAt ?? "";
      }
      setScheduled((cur) => ({ ...cur, ...found }));
    } catch {
      /* ignore */
    }
  }, [preset]);
  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const types = useMemo(() => postTypesFor(treatment), [treatment]);

  const addPost = (t: UPostType) => {
    setPosts((l) => [
      { id: uid(), key: t.key, treatmentId: t.treatment.id, index: t.index, headline: t.headline, subtitle: "", slides: ["", "", ""], cta: "", caption: "", hashtags: [], photos: [0, 1, 2, 3].map((i) => t.index * 4 + i), note: "", when: nextDay(preset?.defaultPostTime ?? "09:00"), busy: false, scheduling: false },
      ...l,
    ]);
    setTimeout(() => window.scrollTo({ top: document.getElementById("posts")?.offsetTop ?? 0, behavior: "smooth" }), 50);
  };
  const addAllSix = () => [...types].reverse().forEach(addPost);

  const patch = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const lookFor = (post: Post): Look => ({ ...look, ...(post.look || {}) });

  const foot = (preset?.captionFootnote || "").trim();
  const noFoot = (c: string) => (foot ? c.split(foot).join("").trim() : c.trim());
  const fullCaption = (post: Post) => [noFoot(post.caption), post.hashtags.join(" "), foot].filter(Boolean).join("\n\n");

  const write = async (post: Post, fix?: string) => {
    if (!preset) {
      toast.error("Pick the client first");
      return;
    }
    if (!area.trim()) {
      toast.error("Type the clinic's area first, so the hashtags are local");
      return;
    }
    const x = U_BY_ID.get(post.treatmentId) as UTreatment;
    const t = postTypesFor(x)[post.index];
    patch(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/universal/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: preset.name, area, treatment: x.name, headline: post.headline, brief: t.brief, intro: post.index === 0, note: [post.note, fix ? `The last version was rejected, so put this right: ${fix.slice(0, 200)}` : ""].filter(Boolean).join(" ") }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      patch(post.id, { busy: false, subtitle: data.subtitle, slides: data.slides, cta: data.cta, caption: data.caption, hashtags: data.hashtags, rejected: undefined });
    } catch (e) {
      patch(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const render = async (post: Post): Promise<HTMLCanvasElement[]> => {
    await ensureFonts();
    const out: HTMLCanvasElement[] = [];
    for (let n = 0; n < 5; n++) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      drawSlide(c.getContext("2d")!, post, n, photoFor(post, n), tf, lookFor(post), logo);
      out.push(c);
    }
    return out;
  };

  const fileStem = (post: Post) => `${(preset?.name || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${post.key.replace(":", "-")}`;

  const download = async (post: Post) => {
    const zip = new JSZip();
    const cs = await render(post);
    for (let i = 0; i < cs.length; i++) {
      const blob: Blob | null = await new Promise((res) => cs[i].toBlob(res, "image/png"));
      if (blob) zip.file(`slide-${i + 1}.png`, blob);
    }
    zip.file("caption.txt", `${fullCaption(post)}\n`);
    saveAs(await zip.generateAsync({ type: "blob" }), `${fileStem(post)}.zip`);
  };

  const [review, setReview] = useState<{ id: string; reason: string; rejecting: boolean } | null>(null);
  const REASONS = ["Wording is too long", "Tone is not right", "Not their voice", "Wrong photo", "Not suitable for their page", "Compliance concern"];
  const reject = (post: Post, rewrite: boolean) => {
    const reason = (review?.reason || "").trim();
    if (!reason) {
      toast.error("Add a reason first");
      return;
    }
    patch(post.id, { rejected: reason });
    setReview(null);
    if (rewrite) write(post, reason);
    else toast.success("Rejected, with your reason saved on the post");
  };

  // Draws the five slides, uploads them and sends the post to the scheduler. A bank post has no date.
  const send = async (post: Post, mode: "schedule" | "bank", whenIso?: string) => {
    if (!preset) throw new Error("Pick the client first");
    if (!(libBy.get(post.treatmentId) ?? []).length) throw new Error(`${(U_BY_ID.get(post.treatmentId) as UTreatment).name} has no photos yet`);
    const cs = await render(post);
    const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `universal-${post.key.replace(":", "-")}-${i + 1}-${Date.now()}.png`));
    const x = U_BY_ID.get(post.treatmentId) as UTreatment;
    const content = { caption: fullCaption(post), title: `${x.name} ${post.index + 1} · ${preset.name}`, platforms: ["instagram"], imageUrls: urls, sourceTool: "universal", universalKey: post.key };
    const body = mode === "bank"
      ? { postType: "carousel", content, status: "draft", presetId: preset.id }
      : { postType: "carousel", content, scheduledAt: new Date(whenIso || post.when).toISOString(), isTrial: false, notes: "", presetId: preset.id };
    const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Failed" }));
      throw new Error(err.error || (mode === "bank" ? "Failed to save to the Client Bank" : "Failed to schedule"));
    }
    if (mode === "schedule") setScheduled((s) => ({ ...s, [keyOf(post.key)]: new Date(whenIso || post.when).toISOString() }));
  };

  const schedule = async (post: Post) => {
    patch(post.id, { scheduling: true });
    try {
      await send(post, "schedule");
      toast.success("Scheduled, and crossed off the list");
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
      toast.success(`Added to ${preset?.name}'s Client Bank, no date`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to the bank");
    }
    patch(post.id, { scheduling: false });
  };

  // Every open post that has its words written and is not already scheduled, one per day from the first date.
  const [bulkBusy, setBulkBusy] = useState("");
  const ready = posts.filter((p) => p.caption && !scheduled[keyOf(p.key)]);
  const bulk = async (mode: "schedule" | "bank") => {
    if (!preset) {
      toast.error("Pick the client first");
      return;
    }
    const list = mode === "bank" ? ready.filter((p) => !p.banked) : ready;
    if (!list.length) {
      toast.error("Nothing written and waiting. Press Write it on the posts first");
      return;
    }
    const first = new Date([...list].sort((a, b) => a.when.localeCompare(b.when))[0].when);
    let done = 0;
    let failed = "";
    for (const [i, post] of list.entries()) {
      setBulkBusy(`${done + 1} of ${list.length}`);
      patch(post.id, { scheduling: true });
      try {
        const d = new Date(first);
        d.setDate(d.getDate() + i);
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
    if (done) toast.success(mode === "bank" ? `${done} added to ${preset.name}'s Client Bank` : `${done} scheduled, one a day from ${first.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    if (failed) toast.error(`Stopped after ${done}: ${failed}`);
  };

  const doneFor = (x: UTreatment) => postTypesFor(x).filter((t) => scheduled[keyOf(t.key)]).length;
  const dateLabel = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  const brand = useMemo(() => {
    const list: { name: string; hex: string }[] = [];
    const add = (name: string, hex: unknown) => {
      if (isHex(hex) && !list.some((s) => s.hex.toLowerCase() === hex.toLowerCase())) list.push({ name, hex });
    };
    if (preset) {
      add("Brand 1", preset.accentColor);
      add("Brand 2", preset.pageColor);
      add("Brand 3", preset.overlayColor);
      add("Brand 4", preset.textColor);
    }
    return list;
  }, [preset]);
  const metalSwatches = METALS.map((m) => ({ name: m.name, hex: `metal:${m.id}` }));
  const washSwatches = [{ name: "Black", hex: "#0d0d0d" }, { name: "White", hex: "#ffffff" }, ...brand, ...metalSwatches];
  const textSwatches = [{ name: "White", hex: "#ffffff" }, { name: "Black", hex: "#0d0d0d" }, ...brand, ...metalSwatches];

  const groupTreatments = U_TREATMENTS.filter((x) => x.group === groupId);
  const imgs = libBy.get(treatmentId) ?? [];

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-3xl">Universal</h1>
            <p className="text-white/60 text-sm">Every non prescription treatment, six slide posts each, for any client. Headline in Blue Mirage, everything else in Montserrat, writing in white unless you choose another colour.</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">1. Set up</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1 block">
              <span className={preset ? "text-white/60" : "text-pink-400 font-semibold"}>{preset ? "Client (their voice, Getting to know you, homework, logo and footnote all come from here)" : "Which client is this for? Choose one to start"}</span>
              <select className={`w-full bg-white/5 rounded p-2 ${preset ? "" : "ring-2 ring-pink-500"}`} value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)}>
                <option value="" className="text-black">Choose a client</option>
                {[...presets].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">Their area (for the 5 hashtags)</span>
              <input className="w-full bg-white/5 rounded p-2" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Town, City" />
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ColourPicker label="Gradient colour" value={look.wash} onChange={(hex) => setLook((l) => ({ ...l, wash: hex }))} swatches={washSwatches} />
            <ColourPicker label="Writing colour" value={look.text} onChange={(hex) => setLook((l) => ({ ...l, text: hex }))} swatches={textSwatches} />
          </div>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <label className="space-y-1 block">
              <span className="text-white/60">Gradient strength: {look.opacity}%</span>
              <input type="range" min={0} max={100} step={5} value={look.opacity} onChange={(e) => setLook((l) => ({ ...l, opacity: Number(e.target.value) }))} className="w-full" />
            </label>
            <div className="space-y-1">
              <span className="text-white/60">Where the gradient sits</span>
              <div className="flex gap-2">
                {(["bottom", "top"] as const).map((d) => (
                  <button key={d} onClick={() => setLook((l) => ({ ...l, dir: d }))} className={`flex-1 rounded-md border px-2 py-2 capitalize ${look.dir === d ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-white/60">Curly headline letters</span>
              <div className="flex gap-1 flex-wrap">
                {RATES.map((r) => (
                  <button key={r.id} onClick={() => setRate(r.id)} className={`rounded-md border px-2 py-1.5 text-xs ${rate === r.id ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{r.label}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={look.bw} onChange={(e) => setLook((l) => ({ ...l, bw: e.target.checked }))} /> Black and white photos</label>
            <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={look.logoWhite} onChange={(e) => setLook((l) => ({ ...l, logoWhite: e.target.checked }))} /> Make the logo white</label>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1 block">
              <span className="text-white/60">Headline size: {look.titleSize}%</span>
              <input type="range" min={60} max={160} step={5} value={look.titleSize} onChange={(e) => setLook((l) => ({ ...l, titleSize: Number(e.target.value) }))} className="w-full" />
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">Writing size: {look.bodySize}%</span>
              <input type="range" min={60} max={160} step={5} value={look.bodySize} onChange={(e) => setLook((l) => ({ ...l, bodySize: Number(e.target.value) }))} className="w-full" />
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">Logo size: {look.logoSize}%</span>
              <input type="range" min={40} max={200} step={5} value={look.logoSize} onChange={(e) => setLook((l) => ({ ...l, logoSize: Number(e.target.value) }))} className="w-full" />
            </label>
          </div>
          <p className="text-white/40 text-xs">Headline font: {clientStyle ? `${preset?.name}'s own look from Font Lab` : "Blue Mirage"} {tf ? "" : "(loading)"}. Curly letters follow whichever ones you picked in Font Lab, otherwise the font's first curly version of each letter. Subtitle and every page after the first: Montserrat. Caption footnote from the client preset: {foot ? `"${foot}"` : "none saved"}. It goes at the very end, under the 5 hashtags.</p>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">2. Pick a treatment</h2>
            <div className="flex items-center gap-2">
              {libBusy && <span className="text-sm text-white/70 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Uploading {libBusy}</span>}
              <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { uploadFolder(e.target.files); e.currentTarget.value = ""; }} />
              <Button variant="secondary" disabled={!!libBusy} onClick={() => folderRef.current?.click()}><FolderUp className="w-4 h-4 mr-2" />Upload my Universal images folder</Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {U_GROUPS.map((g) => (
              <button key={g.id} onClick={() => { setGroupId(g.id); setTreatmentId(U_TREATMENTS.find((x) => x.group === g.id)!.id); }} className={`px-3 py-1.5 rounded-full text-sm border ${groupId === g.id ? "bg-white text-black border-white" : "border-white/20 text-white/80"}`}>{g.label}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {groupTreatments.map((x) => {
              const n = (libBy.get(x.id) ?? []).length;
              const done = doneFor(x);
              return (
                <button key={x.id} onClick={() => setTreatmentId(x.id)} className={`text-left px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${treatmentId === x.id ? "border-white bg-white/10" : "border-white/15"}`}>
                  <span className={done === POSTS_PER_TREATMENT ? "line-through opacity-50" : ""}>{x.name}</span>
                  <span className="ml-auto text-xs text-white/50 whitespace-nowrap">{n} photo{n === 1 ? "" : "s"} · {done}/{POSTS_PER_TREATMENT}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-white/10 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-medium">{treatment.name}: fixed photos</h3>
              <div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadToTreatment(e.target.files); e.currentTarget.value = ""; }} />
                <Button size="sm" variant="secondary" disabled={!!libBusy} onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-2" />Add photos to {treatment.name}</Button>
                <Button size="sm" variant="destructive" className="ml-2" disabled={!!libBusy || !lib.length} onClick={removeAllImages}><Trash2 className="w-4 h-4 mr-2" />Remove ALL photos ({lib.length})</Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {imgs.length === 0 && <p className="text-white/50 text-sm">No photos here yet. Add some, or upload your whole Universal images folder above and each photo lands in its own treatment.</p>}
              {imgs.map((i) => (
                <div key={i.id} className="relative">
                  <img src={localUrl(i.url)} alt="" className="w-16 h-20 object-cover rounded" />
                  <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => removeImage(i)} aria-label="Remove photo"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-medium">The six posts</h3>
              <Button size="sm" variant="secondary" onClick={addAllSix}><Plus className="w-4 h-4 mr-2" />Open all six</Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {types.map((t) => {
                const when = scheduled[keyOf(t.key)];
                return (
                  <button key={t.key} onClick={() => addPost(t)} className="text-left px-3 py-2 rounded-lg border border-white/15 text-sm flex items-center gap-2">
                    {when ? <CalendarCheck className="w-4 h-4 text-green-400 shrink-0" /> : <Plus className="w-4 h-4 text-white/40 shrink-0" />}
                    <span className={when ? "line-through decoration-2 opacity-50" : ""}>{t.index + 1}. {t.headline}</span>
                    {when && <span className="ml-auto text-xs text-green-300/80 whitespace-nowrap">{dateLabel(when)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section id="posts" className="space-y-6">
          {posts.length === 0 && <p className="text-white/50 text-sm">Press a post above and it opens here.</p>}
          {posts.length > 0 && (
            <div className="rounded-xl border border-white/10 p-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-white/70">{ready.length} written and waiting{preset ? ` for ${preset.name}` : ""}</span>
              {bulkBusy && <span className="text-sm text-white/70 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{bulkBusy}</span>}
              <div className="ml-auto flex gap-2 flex-wrap">
                <Button size="sm" disabled={!!bulkBusy || !ready.length} onClick={() => bulk("schedule")}><CalendarClock className="w-4 h-4 mr-2" />Schedule all, one a day</Button>
                <Button size="sm" variant="secondary" disabled={!!bulkBusy || !ready.length} onClick={() => bulk("bank")}><Archive className="w-4 h-4 mr-2" />Add all to Client Bank</Button>
              </div>
            </div>
          )}
          {posts.map((post) => {
            const x = U_BY_ID.get(post.treatmentId) as UTreatment;
            const lk = lookFor(post);
            const hasPhotos = (libBy.get(post.treatmentId) ?? []).length > 0;
            return (
              <div key={post.id} className="rounded-xl border border-white/10 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{x.name} {post.index + 1}. {post.headline}{preset ? ` · ${preset.name}` : ""}</h3>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button size="sm" onClick={() => write(post)} disabled={post.busy}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Write it
                    </Button>
                    <input type="datetime-local" className="bg-white/5 rounded p-1.5 text-sm" value={post.when} onChange={(e) => patch(post.id, { when: e.target.value })} />
                    <Button size="sm" onClick={() => setReview({ id: post.id, reason: "", rejecting: false })} disabled={!post.caption || post.scheduling}>
                      {post.scheduling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-2" />}Schedule
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => bank(post)} disabled={!post.caption || post.scheduling}>
                      <Archive className="w-4 h-4 mr-2" />{post.banked ? "In the bank" : "Add to bank"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => download(post)} disabled={!post.caption}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((p) => p.id !== post.id))} aria-label="Remove post"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {!hasPhotos && <p className="text-amber-300/90 text-sm">No photos for {x.name} yet, so the slides show a plain background. Add some in step 2.</p>}
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
                          <Button size="sm" onClick={() => { setReview(null); schedule(post); }}><CalendarCheck className="w-4 h-4 mr-2" />Yes, schedule it</Button>
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
                <div className="rounded-lg border border-white/10 p-3 grid md:grid-cols-2 gap-4 text-xs">
                  <ColourPicker label="This post: gradient colour" value={lk.wash} onChange={(hex) => patch(post.id, { look: { ...post.look, wash: hex } })} swatches={washSwatches} />
                  <ColourPicker label="This post: writing colour" value={lk.text} onChange={(hex) => patch(post.id, { look: { ...post.look, text: hex } })} swatches={textSwatches} />
                  <label className="space-y-1 block">
                    <span className="text-white/60">Strength: {lk.opacity}%</span>
                    <input type="range" min={0} max={100} step={5} value={lk.opacity} onChange={(e) => patch(post.id, { look: { ...post.look, opacity: Number(e.target.value) } })} className="w-full" />
                  </label>
                  <div className="space-y-1">
                    <span className="text-white/60">Gradient sits</span>
                    <div className="flex gap-1 max-w-xs">
                      {(["bottom", "top"] as const).map((d) => (
                        <button key={d} onClick={() => patch(post.id, { look: { ...post.look, dir: d } })} className={`flex-1 rounded border px-1 py-1 capitalize ${lk.dir === d ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{d}</button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 pt-1"><input type="checkbox" checked={lk.bw} onChange={(e) => patch(post.id, { look: { ...post.look, bw: e.target.checked } })} /> Black and white photos</label>
                    {post.look && Object.keys(post.look).length > 0 && <button className="underline text-white/50" onClick={() => patch(post.id, { look: undefined })}>Back to the page setting</button>}
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <SlideCanvas key={n} post={post} n={n} photo={photoFor(post, n)} tf={tf} look={lk} logo={logo} onClick={n < 4 && (libBy.get(post.treatmentId) ?? []).length > 1 ? () => patch(post.id, { photos: post.photos.map((v, i) => (i === n ? v + 1 : v)) }) : undefined} />
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1 block">
                    <span className="text-white/60">Headline</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.headline} onChange={(e) => patch(post.id, { headline: e.target.value })} />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-white/60">Subtitle (one quirky sentence)</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.subtitle} onChange={(e) => patch(post.id, { subtitle: e.target.value })} />
                  </label>
                  {[0, 1, 2].map((i) => (
                    <label key={i} className="space-y-1 block">
                      <span className="text-white/60">Slide {i + 2}</span>
                      <textarea className="w-full bg-white/5 rounded p-2" rows={3} value={post.slides[i]} onChange={(e) => patch(post.id, { slides: post.slides.map((s, k) => (k === i ? e.target.value : s)) })} />
                    </label>
                  ))}
                  <label className="space-y-1 block">
                    <span className="text-white/60">Last slide</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={3} value={post.cta} onChange={(e) => patch(post.id, { cta: e.target.value })} />
                  </label>
                  <label className="space-y-1 block md:col-span-2">
                    <span className="text-white/60">Caption</span>
                    <textarea className="w-full bg-white/5 rounded p-2" rows={6} value={post.caption} onChange={(e) => patch(post.id, { caption: e.target.value })} />
                  </label>
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-white/60">Exactly as it will post (caption, 5 hashtags, then {preset ? `${preset.name}'s` : "the client's"} footnote)</span>
                    <pre className="whitespace-pre-wrap rounded bg-white/5 p-2 text-white/70 font-sans">{post.caption ? fullCaption(post) : ""}</pre>
                    {post.caption && preset && !foot && <p className="text-amber-300/90">{preset.name} has no footnote saved on their preset, so none is added.</p>}
                  </div>
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
