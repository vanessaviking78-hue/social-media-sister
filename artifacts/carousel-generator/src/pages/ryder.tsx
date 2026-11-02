import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarCheck, Download, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets } from "@/lib/use-presets";
import { uploadPngs } from "@/lib/month-engine";
import { SUITE_FONTS, clientSlug, fontById, injectSuiteFontCss, drawTitle, layoutTitle, loadSuiteFont, readTitleStyle, titleHeight, type LoadedFont, type TitleStyle } from "@/lib/suite-fonts";
import { RYDER_CLINIC, RYDER_GROUPS, RYDER_POST_TYPES, type RyderPostType } from "@/lib/ryder-posts";

// THE RYDER CLINIC, her own page. Photo first, a soft white wash over the bottom third.
// Template 1 is built. The other five will be added here as she brings them.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
const INK = "#1b1b1b";
const GREY = "#6a6a6a";
const LOOK_KEY = "ryder-look-v1";

// How the wash and the writing look. Wash is white or black with an opacity slider; writing is auto, black or white.
type WashColour = "white" | "black" | "brown" | "beige";
const WASHES: Record<WashColour, { rgb: string; bg: string; light: boolean }> = {
  white: { rgb: "255,255,255", bg: "#ffffff", light: false },
  black: { rgb: "13,13,13", bg: "#0d0d0d", light: true },
  brown: { rgb: "74,52,38", bg: "#4a3426", light: true },
  beige: { rgb: "232,220,200", bg: "#e8dcc8", light: false },
};
type Look = { wash: WashColour; opacity: number; text: "auto" | "black" | "white"; titleSize: number; bodySize: number; logoSize: number; logoWhite: boolean; headline: "auto" | "silver" };
const DEFAULT_LOOK: Look = { wash: "white", opacity: 100, text: "auto", titleSize: 100, bodySize: 100, logoSize: 100, logoWhite: false, headline: "auto" };

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
function inks(look: Look) {
  const w = WASHES[look.wash] || WASHES.white;
  const light = look.text === "white" || (look.text === "auto" && w.light);
  return { ink: light ? "#ffffff" : INK, grey: light ? "#cfcfcf" : GREY, bg: w.bg };
}

// Metallic silver for the headline: a soft diagonal sheen from shadow grey to bright highlight.
function silver(ctx: CanvasRenderingContext2D, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(100, y0, W - 100, y1);
  const stops = ["#7d838a", "#e9ecef", "#9ba1a8", "#ffffff", "#858b92", "#d5d9dd", "#8a9097"];
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
const FONT_KEY = "ryder-fonts-v2";
const AREA_KEY = "ryder-area-v1";
const SCHED_KEY = "ryder-scheduled-v1";

type Photo = { id: string; bmp: ImageBitmap; url: string };
type Fonts = { head: string; body: string };
type TitleFont = { lf: LoadedFont; style: TitleStyle } | null;

async function loadTitleFont(client?: string): Promise<TitleFont> {
  const style = readTitleStyle(client);
  try {
    return { lf: await loadSuiteFont(style.fontId), style };
  } catch {
    return null;
  }
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
  busy: boolean;
  scheduling: boolean;
};

const TEMPLATES = [{ id: "t1", name: "1. Photo with white wash" }];

const uid = () => Math.random().toString(36).slice(2, 10);
const TYPE_BY_ID = new Map(RYDER_POST_TYPES.map((t) => [t.id, t]));

async function ensureFonts(f: Fonts) {
  loadGoogleFonts();
  injectSuiteFontCss();
  try {
    await Promise.all([document.fonts.load(`400 60px "${f.head}"`), document.fonts.load(`600 60px "${f.head}"`), document.fonts.load(`400 30px "${f.body}"`), document.fonts.load(`600 30px "${f.body}"`)]);
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

// The white wash: clear at the top, solid white by the bottom third.
function wash(ctx: CanvasRenderingContext2D, from: number, look: Look) {
  const o = Math.max(0, Math.min(100, look.opacity)) / 100;
  const c = (WASHES[look.wash] || WASHES.white).rgb;
  const g = ctx.createLinearGradient(0, H * from, 0, H);
  g.addColorStop(0, `rgba(${c},0)`);
  g.addColorStop(0.45, `rgba(${c},${0.88 * o})`);
  g.addColorStop(0.7, `rgba(${c},${0.98 * o})`);
  g.addColorStop(1, `rgba(${c},${o})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function clinicName(ctx: CanvasRenderingContext2D, f: Fonts, y: number, align: "left" | "center" = "center", color = GREY) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 22px "${f.body}", sans-serif`;
  spaced(ctx, 6);
  ctx.textAlign = align;
  ctx.fillText(RYDER_CLINIC.toUpperCase(), align === "left" ? 100 : W / 2, y);
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
  const { ink: INKC, grey: GREYC, bg: BGC } = inks(look);
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
    if (look.headline === "silver") ctx.fillStyle = silver(ctx, y, y + total);
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
      drawTitle(ctx, tf.lf, layout, tf.style, 100, ty, "center", W - 200, look.headline === "silver" ? silver(ctx, ty, ty + titleHeight(layout)) : INKC);
    } else {
      ctx.fillStyle = INKC;
      ctx.textAlign = "center";
      const fit = fitText(ctx, post.hook || "", (px) => head(px), W - 200, 330 * Math.max(1, ts), Math.round(92 * ts), Math.round(46 * ts), 1.1);
      const total = fit.lines.length * fit.px * 1.1;
      let y = H - 175 - total;
      if (look.headline === "silver") ctx.fillStyle = silver(ctx, y, y + total);
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

export default function RyderPage() {
  const { presets } = usePresets();
  const preset = useMemo(() => presets.find((p) => /ryder/i.test(p.name)) ?? null, [presets]);

  const [pool, setPool] = useState<Photo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [group, setGroup] = useState(RYDER_GROUPS[0].id);
  const [typeId, setTypeId] = useState(RYDER_POST_TYPES[0].id);
  const [scheduled, setScheduled] = useState<Record<string, string>>({}); // post type id -> date it goes out
  const [fonts, setFonts] = useState<Fonts>({ head: "SuiteMofllig", body: "Montserrat" });
  const [tf, setTf] = useState<TitleFont>(null);
  const [look, setLook] = useState<Look>(() => { try { const r = localStorage.getItem(LOOK_KEY); if (r) return { ...DEFAULT_LOOK, ...JSON.parse(r) }; } catch { /* ignore */ } return DEFAULT_LOOK; });
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
  // the title look is saved in Font Lab; pick it up now and whenever she comes back to this tab
  useEffect(() => {
    let live = true;
    const load = () => { loadTitleFont(preset ? clientSlug(preset.name) : undefined).then((t) => live && setTf(t)); };
    load();
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, [preset]);
  const [area, setArea] = useState("Bedford");
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
        const t = RYDER_POST_TYPES.find((x) => title.startsWith(`${x.label} · `));
        if (t && sp.status !== "failed") found[t.id] = sp.scheduledAt ?? "";
      }
      setScheduled((cur) => ({ ...cur, ...found }));
    } catch { /* ignore */ }
  }, [preset]);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useEffect(() => { try { localStorage.setItem(SCHED_KEY, JSON.stringify(scheduled)); } catch { /* ignore */ } }, [scheduled]);

  const typesInGroup = useMemo(() => RYDER_POST_TYPES.filter((t) => t.group === group), [group]);

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

  const photoFor = (post: Post, n: number): Photo | null => (pool.length ? pool[post.photos[n] % pool.length] ?? null : null);

  const addPost = (t: RyderPostType) => {
    const start = posts.length * 5;
    setPosts((l) => [{ id: uid(), typeId: t.id, hook: t.label, slides: ["", "", ""], cta: "", caption: "", hashtags: [], photos: [0, 1, 2, 3, 4].map((i) => start + i), note: "", when: nextDay(preset?.defaultPostTime ?? "09:00"), busy: false, scheduling: false }, ...l]);
    setTypeId(t.id);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const patch = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const write = async (post: Post) => {
    if (!area.trim()) { toast.error("Type her area first, so the hashtags are local"); return; }
    const t = TYPE_BY_ID.get(post.typeId)!;
    patch(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/ryder/copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: t.label, brief: t.brief, kind: t.kind, avoid: posts.filter((x) => x.id !== post.id).map((x) => x.cta).filter(Boolean), note: post.note, area }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      patch(post.id, { busy: false, hook: data.hook, slides: data.slides, cta: data.cta, caption: fixDoctor(data.caption), hashtags: data.hashtags });
    } catch (e) {
      patch(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const render = async (post: Post): Promise<HTMLCanvasElement[]> => {
    await ensureFonts(fonts);
    const tfNow = await loadTitleFont(preset ? clientSlug(preset.name) : undefined);
    const out: HTMLCanvasElement[] = [];
    for (let n = 0; n < 5; n++) {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      drawSlide(c.getContext("2d")!, post, n, photoFor(post, n), fonts, tfNow, look, logo);
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
    zip.file("caption.txt", `${post.caption}\n\n${post.hashtags.join(" ")}\n`);
    saveAs(await zip.generateAsync({ type: "blob" }), `ryder-${t.id}.zip`);
  };

  const schedule = async (post: Post) => {
    if (!preset) { toast.error("I cannot find her client preset. It needs a name with Ryder in it"); return; }
    const t = TYPE_BY_ID.get(post.typeId)!;
    if (!pool.length) { toast.error("Add her photo first"); return; }
    patch(post.id, { scheduling: true });
    try {
      const cs = await render(post);
      const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `ryder-${t.id}-${i + 1}-${Date.now()}.png`));
      const body = {
        postType: "carousel",
        content: { caption: `${post.caption.trim()}\n\n${post.hashtags.join(" ")}`.trim(), title: `${t.label} · ${RYDER_CLINIC}`, platforms: ["instagram"], imageUrls: urls, sourceTool: "ryder" },
        scheduledAt: new Date(post.when).toISOString(),
        isTrial: false,
        notes: "",
        presetId: preset.id,
      };
      const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error || "Failed to schedule"); }
      setScheduled((s) => ({ ...s, [t.id]: new Date(post.when).toISOString() }));
      patch(post.id, { scheduling: false });
      toast.success("Scheduled, and crossed off her list");
    } catch (e) {
      patch(post.id, { scheduling: false });
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    }
  };

  const doneIn = (g: string) => RYDER_POST_TYPES.filter((t) => t.group === g && scheduled[t.id]).length;
  const totalIn = (g: string) => RYDER_POST_TYPES.filter((t) => t.group === g).length;
  const dateLabel = (iso: string) => { try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return ""; } };

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-3xl" style={{ fontFamily: `"${fonts.head}", serif` }}>{RYDER_CLINIC}</h1>
            <p className="text-white/60 text-sm">Her own page. Photo first with a soft white wash. Names cross out once scheduled.{!preset && " (I cannot see her client preset yet, so scheduling is off.)"}</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">1. Set up</h2>
          <p className="text-white/60 text-sm">Cover title: {tf ? fontById(tf.style.fontId).name : "loading"}, spacing {tf ? tf.style.tracking : ""}, set in <Link href="/font-lab" className="underline">Font Lab</Link>. Subtitle and body fonts are still to be confirmed.</p>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <label className="space-y-1 block"><span className="text-white/60">Heading font (last slide and page heading)</span>
              <select className="w-full bg-white/5 rounded p-2" value={fonts.head} onChange={(e) => setFonts((f) => ({ ...f, head: e.target.value }))}>
                {SUITE_FONTS.map((f) => <option key={f.id} value={f.family} className="text-black">{f.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 block"><span className="text-white/60">Body font</span><input className="w-full bg-white/5 rounded p-2" value={fonts.body} onChange={(e) => setFonts((f) => ({ ...f, body: e.target.value }))} /></label>
            <label className="space-y-1 block"><span className="text-white/60">Her area (for the hashtags)</span><input className="w-full bg-white/5 rounded p-2" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Bedford" /></label>
          </div>
          <p className="text-white/40 text-xs">Body font is a plain name for now, until you confirm it.</p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-white/60">Gradient colour</span>
              <div className="flex gap-2">
                {(["white", "black", "brown", "beige"] as const).map((c) => (
                  <button key={c} onClick={() => setLook((l) => ({ ...l, wash: c }))} className={`flex-1 rounded-md border px-2 py-2 capitalize ${look.wash === c ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{c}</button>
                ))}
              </div>
            </div>
            <label className="space-y-1 block">
              <span className="text-white/60">Gradient strength: {look.opacity}%</span>
              <input type="range" min={0} max={100} step={5} value={look.opacity} onChange={(e) => setLook((l) => ({ ...l, opacity: Number(e.target.value) }))} className="w-full" />
            </label>
            <div className="space-y-1">
              <span className="text-white/60">Writing colour</span>
              <div className="flex gap-2">
                {([["auto", "Match gradient"], ["black", "Black"], ["white", "White"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setLook((l) => ({ ...l, text: v }))} className={`flex-1 rounded-md border px-2 py-2 ${look.text === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <span className="text-white/60">Headline colour</span>
            <div className="flex gap-2 max-w-sm">
              {([["auto", "Same as writing"], ["silver", "Metallic silver"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setLook((l) => ({ ...l, headline: v }))} className={`flex-1 rounded-md border px-2 py-2 ${look.headline === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{label}</button>
              ))}
            </div>
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
            <h3 className="font-medium">Her photos</h3>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.currentTarget.value = ""; }} />
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => fileRef.current?.click()} variant="secondary"><ImagePlus className="w-4 h-4 mr-2" />Upload photos</Button>
              <ApprovedImagesPicker
                clientName={preset?.name || RYDER_CLINIC}
                mode="multi"
                skipBackgroundRemoval
                large
                label="Use approved photos"
                onAddImages={(files) => { if (files.length) addPhotos(files); }}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pool.length === 0 && <p className="text-white/50 text-sm">Add the doctor's photos once. They go on every carousel exactly as they are, with the white wash over the bottom third.</p>}
            {pool.map((p, i) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="" className="w-16 h-20 object-cover rounded" />
                <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => setPool((l) => l.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${i + 1}`}><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="text-sm text-white/60">Template: {TEMPLATES.map((t) => t.name).join(", ")}. Five more to come.</div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">2. Pick a post</h2>
          <div className="flex gap-2 flex-wrap">
            {RYDER_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} className={`px-3 py-1.5 rounded-full text-sm border ${group === g.id ? "bg-white text-black border-white" : "border-white/20 text-white/80"}`}>
                {g.label} <span className="opacity-60">{doneIn(g.id)}/{totalIn(g.id)}</span>
              </button>
            ))}
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
                    <Button size="sm" variant="secondary" onClick={() => download(post)} disabled={!post.caption}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((p) => p.id !== post.id))} aria-label="Remove post"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <SlideCanvas key={n} post={post} n={n} photo={photoFor(post, n)} fonts={fonts} tf={tf} look={look} logo={logo} onClick={n < 4 && pool.length > 1 ? () => patch(post.id, { photos: post.photos.map((v, i) => (i === n ? v + 1 : v)) }) : undefined} />
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
