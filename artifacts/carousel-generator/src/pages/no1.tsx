import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Download, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { NO1_CLINIC, NO1_COLOURS, NO1_GROUPS, NO1_POST_TYPES, type No1PostType } from "@/lib/no1-posts";

// NO 1 BODY SCULPTING, her own page. Hatcher on the front slide, Merriweather for everything else.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
const HEAD = "Hatcher";
const BODY = "Merriweather";
const DONE_KEY = "no1-done-v1";

const FONT_CSS = `
@font-face { font-family: "Hatcher"; src: url("${BASE}/fonts/no1/Hatcher.woff2") format("woff2"), url("${BASE}/fonts/no1/Hatcher.woff") format("woff"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Hatcher"; src: url("${BASE}/fonts/no1/Hatcher-Italic.woff2") format("woff2"), url("${BASE}/fonts/no1/Hatcher-Italic.woff") format("woff"); font-weight: 400; font-style: italic; font-display: swap; }
`;

type Photo = { id: string; bmp: ImageBitmap; url: string };

// Her logo sits on every slide of a post. x and y are the centre as a share of the slide, w is the width as a share of the slide.
type LogoPlace = { on: boolean; x: number; y: number; w: number; white: boolean };
const DEFAULT_LOGO: LogoPlace = { on: true, x: 0.76, y: 0.075, w: 0.3, white: false };
const LOGO_RATIO = 234 / 1112;
const LOGO_SRC = `${BASE}/no1-logo.png`;

let LOGO: HTMLImageElement | null = null;
let LOGO_WHITE: HTMLCanvasElement | null = null;
let logoLoading: Promise<void> | null = null;

function ensureLogo(): Promise<void> {
  if (LOGO) return Promise.resolve();
  if (!logoLoading) {
    logoLoading = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        LOGO = img;
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0);
        x.globalCompositeOperation = "source-in";
        x.fillStyle = "#ffffff";
        x.fillRect(0, 0, c.width, c.height);
        LOGO_WHITE = c;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = LOGO_SRC;
    });
  }
  return logoLoading;
}

function drawLogo(ctx: CanvasRenderingContext2D, place: LogoPlace) {
  if (!place.on || !LOGO) return;
  const lw = place.w * W;
  const lh = lw * LOGO_RATIO;
  const src = place.white && LOGO_WHITE ? LOGO_WHITE : LOGO;
  ctx.drawImage(src, place.x * W - lw / 2, place.y * H - lh / 2, lw, lh);
}

type Post = {
  id: string;
  typeId: string;
  logo: LogoPlace;
  hook: string;
  slides: string[]; // slides 2 to 4
  cta: string;
  caption: string;
  hashtags: string[];
  photos: number[]; // pool index for each of the 5 slides
  note: string;
  busy: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const TYPE_BY_ID = new Map(NO1_POST_TYPES.map((t) => [t.id, t]));

async function ensureFonts() {
  loadGoogleFonts();
  try {
    await Promise.all([
      document.fonts.load(`120px "${HEAD}"`),
      document.fonts.load(`400 40px "${BODY}"`),
      document.fonts.load(`700 40px "${BODY}"`),
    ]);
  } catch {
    /* the browser falls back to a serif, which is fine for a preview */
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

function coverFit(ctx: CanvasRenderingContext2D, bmp: ImageBitmap) {
  const s = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * s;
  const h = bmp.height * s;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fit text into a box by stepping the size down until it fits.
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, start: number, min: number, lh: number) {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines };
  }
  ctx.font = font(min);
  return { px: min, lines: wrap(ctx, text, maxW) };
}

function drawSlide(ctx: CanvasRenderingContext2D, post: Post, n: number, photo: Photo | null) {
  drawSlideBase(ctx, post, n, photo);
  drawLogo(ctx, post.logo);
}

function drawSlideBase(ctx: CanvasRenderingContext2D, post: Post, n: number, photo: Photo | null) {
  const C = NO1_COLOURS;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "top";

  if (n === 4) {
    // Last slide: the comment line, on soft grey
    ctx.fillStyle = C.soft;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    const f = fitText(ctx, post.cta || "", (px) => `700 ${px}px "${BODY}", serif`, 820, 520, 72, 40, 1.35);
    const total = f.lines.length * f.px * 1.35;
    let y = (H - total) / 2 - 40;
    ctx.font = `700 ${f.px}px "${BODY}", serif`;
    for (const l of f.lines) {
      ctx.fillText(l, W / 2, y);
      y += f.px * 1.35;
    }
    ctx.fillStyle = C.grey;
    ctx.font = `400 30px "${BODY}", serif`;
    ctx.fillText(NO1_CLINIC, W / 2, H - 150);
    return;
  }

  // photo or plain background
  if (photo) coverFit(ctx, photo.bmp);
  else {
    ctx.fillStyle = n === 0 ? C.ink : C.soft;
    ctx.fillRect(0, 0, W, H);
  }

  if (n === 0) {
    // Front slide: Hatcher on a soft grey scrim
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, "rgba(30,30,30,0)");
    g.addColorStop(1, "rgba(30,30,30,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.white;
    ctx.textAlign = "left";
    const f = fitText(ctx, post.hook || "", (px) => `400 ${px}px "${HEAD}", serif`, W - 160, 640, 132, 56, 1.08);
    ctx.font = `400 ${f.px}px "${HEAD}", serif`;
    let y = H - 130 - f.lines.length * f.px * 1.08;
    for (const l of f.lines) {
      ctx.fillText(l, 80, y);
      y += f.px * 1.08;
    }
    ctx.font = `700 26px "${BODY}", serif`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(NO1_CLINIC, 80, 70);
    return;
  }

  // Slides 2 to 4: a white card over the photo with Merriweather text
  const text = post.slides[n - 1] || "";
  const cardW = W - 160;
  const f = fitText(ctx, text, (px) => `400 ${px}px "${BODY}", serif`, cardW - 120, 700, 46, 28, 1.55);
  const textH = f.lines.length * f.px * 1.55;
  const cardH = textH + 150;
  const cardY = (H - cardH) / 2;
  ctx.fillStyle = "rgba(255,255,255,0.93)";
  roundRect(ctx, 80, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textAlign = "left";
  ctx.font = `400 ${f.px}px "${BODY}", serif`;
  let y = cardY + 75;
  for (const l of f.lines) {
    ctx.fillText(l, 140, y);
    y += f.px * 1.55;
  }
  ctx.fillStyle = C.grey;
  ctx.font = `700 24px "${BODY}", serif`;
  ctx.textAlign = "right";
  ctx.fillText(`${n + 1} / 5`, W - 120, cardY + cardH - 52);
}

function SlideCanvas({ post, n, photo, onClick, width = 150 }: { post: Post; n: number; photo: Photo | null; onClick?: () => void; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      await ensureFonts();
      await ensureLogo();
      const c = ref.current;
      if (!c || !live) return;
      const ctx = c.getContext("2d");
      if (ctx) drawSlide(ctx, post, n, photo);
    })();
    return () => {
      live = false;
    };
  }, [post, n, photo]);
  return <canvas ref={ref} width={W} height={H} onClick={onClick} style={{ width }} className="h-auto rounded-md border border-white/10 cursor-pointer" title={n < 4 && onClick ? "Click to swap the photo" : undefined} />;
}

// A bigger preview where the logo can be dragged and resized. It changes every slide of the post.
function LogoEditor({ post, photoFor, onChange }: { post: Post; photoFor: (n: number) => Photo | null; onChange: (l: LogoPlace) => void }) {
  const [slide, setSlide] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "size"; sx: number; sy: number; start: LogoPlace } | null>(null);
  const VIEW = 300;
  const L = post.logo;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  const begin = (mode: "move" | "size") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...L } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / r.width;
    const dy = (e.clientY - d.sy) / r.height;
    if (d.mode === "move") onChange({ ...d.start, x: clamp(d.start.x + dx, 0, 1), y: clamp(d.start.y + dy, 0, 1) });
    else onChange({ ...d.start, w: clamp(d.start.w + dx * 2, 0.08, 0.95) });
  };
  const end = () => {
    drag.current = null;
  };

  const lwPct = L.w * 100;
  const lhPct = L.w * W * LOGO_RATIO / H * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-white/60 text-sm">Logo</span>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={L.on} onChange={(e) => onChange({ ...L, on: e.target.checked })} />Show</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={L.white} onChange={(e) => onChange({ ...L, white: e.target.checked })} />White version</label>
        <label className="flex items-center gap-2 text-sm">Size
          <input type="range" min={8} max={95} value={Math.round(L.w * 100)} onChange={(e) => onChange({ ...L, w: Number(e.target.value) / 100 })} />
        </label>
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_LOGO })}>Reset</Button>
        <div className="flex gap-1 ml-auto">
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => setSlide(n)} className={`w-7 h-7 rounded text-xs border ${slide === n ? "bg-white text-black border-white" : "border-white/20"}`}>{n + 1}</button>
          ))}
        </div>
      </div>
      <p className="text-white/50 text-xs">Drag the logo to move it. Drag the round handle to make it bigger or smaller. It applies to all five slides.</p>
      <div ref={box} className="relative select-none touch-none" style={{ width: VIEW }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <SlideCanvas post={post} n={slide} photo={photoFor(slide)} width={VIEW} />
        {L.on && (
          <div
            onPointerDown={begin("move")}
            className="absolute border border-dashed border-pink-400/80 cursor-move"
            style={{ left: `${L.x * 100 - lwPct / 2}%`, top: `${L.y * 100 - lhPct / 2}%`, width: `${lwPct}%`, height: `${lhPct}%` }}
          >
            <div
              onPointerDown={begin("size")}
              className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-pink-500 border-2 border-white cursor-nwse-resize"
              aria-label="Resize logo"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function No1Page({ client = false }: { client?: boolean }) {
  const [pool, setPool] = useState<Photo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [group, setGroup] = useState(NO1_GROUPS[0].id);
  const [typeId, setTypeId] = useState(NO1_POST_TYPES[0].id);
  const [done, setDone] = useState<Set<string>>(new Set());
  // The last logo placement she chose, so every new post starts where she likes it.
  const [logoDefault, setLogoDefault] = useState<LogoPlace>({ ...DEFAULT_LOGO });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!client) return;
    // Her private link should not turn up in search results.
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    document.head.appendChild(m);
    return () => {
      m.remove();
    };
  }, [client]);

  useEffect(() => {
    ensureLogo();
    try {
      const raw = localStorage.getItem(DONE_KEY);
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    ensureFonts();
  }, []);

  const markDone = (id: string) =>
    setDone((s) => {
      const next = new Set(s);
      next.add(id);
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });

  const typesInGroup = useMemo(() => NO1_POST_TYPES.filter((t) => t.group === group), [group]);
  useEffect(() => {
    if (!typesInGroup.some((t) => t.id === typeId)) setTypeId(typesInGroup[0].id);
  }, [typesInGroup, typeId]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Photo[] = [];
    for (const f of Array.from(files)) {
      try {
        const raw = await createImageBitmap(f);
        const max = 2200;
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

  const addPost = () => {
    const t = TYPE_BY_ID.get(typeId)!;
    const start = posts.length * 5;
    setPosts((l) => [
      {
        id: uid(),
        typeId: t.id,
        logo: logoDefault,
        hook: t.label,
        slides: ["", "", ""],
        cta: "",
        caption: "",
        hashtags: [],
        photos: [0, 1, 2, 3, 4].map((i) => start + i),
        note: "",
        busy: false,
      },
      ...l,
    ]);
  };

  const patch = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const write = async (post: Post) => {
    const t = TYPE_BY_ID.get(post.typeId)!;
    patch(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/no1/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: t.label, brief: t.brief, word: t.word, note: post.note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      patch(post.id, {
        busy: false,
        hook: data.hook,
        slides: data.slides,
        cta: data.cta,
        caption: data.caption,
        hashtags: data.hashtags,
      });
    } catch (e) {
      patch(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const download = async (post: Post) => {
    const t = TYPE_BY_ID.get(post.typeId)!;
    await ensureFonts();
    await ensureLogo();
    const zip = new JSZip();
    for (let n = 0; n < 5; n++) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      drawSlide(c.getContext("2d")!, post, n, photoFor(post, n));
      const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
      if (blob) zip.file(`slide-${n + 1}.png`, blob);
    }
    zip.file("caption.txt", `${post.caption}\n\n${post.hashtags.join(" ")}\n`);
    saveAs(await zip.generateAsync({ type: "blob" }), `${t.id}.zip`);
    markDone(t.id);
    toast.success("Downloaded");
  };

  const doneCount = (g: string) => NO1_POST_TYPES.filter((t) => t.group === g && done.has(t.id)).length;
  const totalIn = (g: string) => NO1_POST_TYPES.filter((t) => t.group === g).length;

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <style>{FONT_CSS}</style>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          {!client && <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>}
          <div>
            <h1 className="text-3xl" style={{ fontFamily: `"${HEAD}", serif` }}>{NO1_CLINIC}</h1>
            <p className="text-white/60 text-sm">{client ? "Add your photos, pick a post, press Write it, then download your carousel and caption." : "Her own page. 44 carousel types, Hatcher on the front, Merriweather inside, no prices."}</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">1. Her photos</h2>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.currentTarget.value = ""; }} />
            <Button onClick={() => fileRef.current?.click()} variant="secondary"><ImagePlus className="w-4 h-4 mr-2" />Add photos</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pool.length === 0 && <p className="text-white/50 text-sm">Add her photos once. They go on every carousel and stay exactly as they are.</p>}
            {pool.map((p, i) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="" className="w-16 h-20 object-cover rounded" />
                <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => setPool((l) => l.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${i + 1}`}><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">2. Pick a post</h2>
          <div className="flex gap-2 flex-wrap">
            {NO1_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} className={`px-3 py-1.5 rounded-full text-sm border ${group === g.id ? "bg-white text-black border-white" : "border-white/20 text-white/80"}`}>
                {g.label} <span className="opacity-60">{doneCount(g.id)}/{totalIn(g.id)}</span>
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {typesInGroup.map((t: No1PostType) => (
              <button key={t.id} onClick={() => setTypeId(t.id)} className={`text-left px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${typeId === t.id ? "border-white bg-white/10" : "border-white/15"}`}>
                {done.has(t.id) ? <Check className="w-4 h-4 text-green-400 shrink-0" /> : <span className="w-4 h-4 shrink-0" />}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <Button onClick={addPost}><Plus className="w-4 h-4 mr-2" />Add this post</Button>
        </section>

        <section className="space-y-6">
          {posts.length === 0 && <p className="text-white/50 text-sm">Your posts will appear here.</p>}
          {posts.map((post) => {
            const t = TYPE_BY_ID.get(post.typeId)!;
            return (
              <div key={post.id} className="rounded-xl border border-white/10 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{t.label}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => write(post)} disabled={post.busy}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Write it
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => download(post)} disabled={!post.caption}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((p) => p.id !== post.id))} aria-label="Remove post"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <SlideCanvas key={n} post={post} n={n} photo={photoFor(post, n)} onClick={n < 4 && pool.length > 1 ? () => patch(post.id, { photos: post.photos.map((v, i) => (i === n ? v + 1 : v)) }) : undefined} />
                  ))}
                </div>
                <LogoEditor post={post} photoFor={(n) => photoFor(post, n)} onChange={(l) => { setLogoDefault(l); patch(post.id, { logo: l }); }} />
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
                    <input className="w-full bg-white/5 rounded p-2" value={post.note} onChange={(e) => patch(post.id, { note: e.target.value })} placeholder="A line from her, a detail to include" />
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
