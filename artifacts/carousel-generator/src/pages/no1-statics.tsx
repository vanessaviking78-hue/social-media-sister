import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withAboutTab } from "@/lib/with-about-tab";
import { Link } from "wouter";
import { ArrowLeft, CalendarCheck, CalendarClock, Download, Eye, ImagePlus, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { loadBitmap } from "@/pages/universal";
import { usePresets } from "@/lib/use-presets";
import { uploadPngs } from "@/lib/month-engine";
import { STATIC_CLINIC, STATIC_GROUPS, STATIC_POST_TYPES, uniDesignId, type StaticPostType } from "@/lib/no1-statics";
import { UNIQUE_BY_ID, drawUnique, resolveUniText, type UniId } from "@/lib/unique-designs";
import { DEFAULT_FOCUS, type Fill } from "@/lib/basic-covers";
import { loadGoogleFonts } from "@/lib/slide-utils";

// NO 1 BODY SCULPTING, her static page. One image per post, 18 sections of 6.
// Hatcher on the headline, Merriweather for the supporting line, her logo top right.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
const HEAD = "Hatcher";
const BODY = "Merriweather";
const SCHED_KEY = "no1-statics-scheduled-v1";
const LOGO_SRC = `${BASE}/no1-logo.png`;

const FONT_CSS = `
@font-face { font-family: "Hatcher"; src: url("${BASE}/fonts/no1/Hatcher.woff2") format("woff2"), url("${BASE}/fonts/no1/Hatcher.woff") format("woff"); font-weight: 400; font-style: normal; font-display: swap; }
`;

type Photo = { id: string; bmp: ImageBitmap; url: string };
type Post = {
  id: string;
  typeId: string;
  hook: string;
  line: string;
  caption: string;
  hashtags: string[];
  photo: number;
  note: string;
  when: string;
  busy: boolean;
  scheduling: boolean;
  px: number; // photo offset, canvas pixels
  py: number;
  pz: number; // photo zoom, 1 or more
  tx: number; // text offset, canvas pixels
  ty: number;
  ts: number; // text size multiplier
  uni?: Record<string, string>; // Unique posts: the words on each part of the template
  block?: boolean; // a solid block along the bottom instead of the gradient
  finish?: "" | "gold" | "silver"; // metallic finish for the block or the gradient
};
const UNI_FILL: Fill = { owner: "Lizzie", clinic: STATIC_CLINIC, area: "Birmingham", role: "Owner" };
const UNI_HEAD = "'Anton', sans-serif";
const UNI_BODY = "'Poppins', sans-serif";
const uniOf = (typeId: string) => {
  const id = uniDesignId(typeId);
  return id && UNIQUE_BY_ID[id as UniId] ? UNIQUE_BY_ID[id as UniId] : null;
};
const mkPost = (t: StaticPostType, photo: number, when: string, busy: boolean): Post => {
  const d = uniOf(t.id);
  return { id: uid(), typeId: t.id, hook: t.label, line: "", caption: "", hashtags: [], photo, note: "", when, busy, scheduling: false, ...LAYOUT0, ...(d ? { uni: resolveUniText(d, {}, UNI_FILL) } : {}) };
};
const briefFor = (post: Post, t: StaticPostType): string => {
  const d = uniOf(t.id);
  if (!d || !post.uni) return t.brief;
  return `${t.brief}. The picture already carries these words, so the caption must carry on from them without repeating them: ${d.fields.map((f) => post.uni?.[f.key] ?? "").filter(Boolean).join(" / ")}`;
};
const LAYOUT0 = { px: 0, py: 0, pz: 1, tx: 0, ty: 0, ts: 1 };
type Box = { x: number; y: number; w: number; h: number };

const uid = () => Math.random().toString(36).slice(2, 10);
// Photos already in the Universal tool that belong to a No 1 treatment section. Anything else is uploaded
// straight to its own section below (saved in the same library as "no1-<section>").
const FROM_UNIVERSAL: Record<string, string[]> = {
  "t-rf": ["radiofrequency"],
  "t-poly": ["polynucleotides"],
  "t-needle": ["microneedling"],
  "t-derma": ["dermaplaning"],
  "t-peel": ["chemical-peels"],
  "t-led": ["led"],
};
type LibImage = { id: number; treatmentId: string; name: string; url: string };

const TYPE_BY_ID = new Map(STATIC_POST_TYPES.map((t) => [t.id, t]));
const isTweet = (t: StaticPostType) => t.group === "tweets";

let fontsReady: Promise<void> | null = null;
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      if (!document.getElementById("no1-statics-fonts")) {
        const st = document.createElement("style");
        st.id = "no1-statics-fonts";
        st.textContent = FONT_CSS;
        document.head.appendChild(st);
      }
      if (!document.getElementById("no1-statics-merri")) {
        const l = document.createElement("link");
        l.id = "no1-statics-merri";
        l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap";
        document.head.appendChild(l);
      }
      loadGoogleFonts();
      try {
        await Promise.all([document.fonts.load("400 60px Anton"), document.fonts.load("400 30px Poppins"), document.fonts.load("700 30px Poppins"), document.fonts.load(`400 60px "${HEAD}"`), document.fonts.load(`400 30px "${BODY}"`), document.fonts.load(`700 30px "${BODY}"`)]);
      } catch {
        /* falls back to a serif */
      }
    })();
  }
  return fontsReady;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image would not load"));
    img.src = src;
  });
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

function coverFit(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, px = 0, py = 0, pz = 1) {
  const s = Math.max(W / bmp.width, H / bmp.height) * Math.max(1, pz);
  const w = bmp.width * s;
  const h = bmp.height * s;
  const mx = (w - W) / 2;
  const my = (h - H) / 2;
  const ox = Math.max(-mx, Math.min(mx, px));
  const oy = Math.max(-my, Math.min(my, py));
  ctx.drawImage(bmp, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  if (!logo || !logo.naturalWidth) return;
  const w = 300;
  const h = (logo.naturalHeight / logo.naturalWidth) * w;
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext("2d")!;
  g.drawImage(logo, 0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(c, W - 60 - w, 60);
}

function drawPost(ctx: CanvasRenderingContext2D, post: Post, tweet: boolean, photo: Photo | null, logo: HTMLImageElement | null): Box {
  ctx.clearRect(0, 0, W, H);
  const ud = post.uni ? uniOf(post.typeId) : null;
  if (ud && post.uni) {
    drawUnique(ctx, { design: ud.id, text: post.uni, palette: ud.palette, headFont: UNI_HEAD, bodyFont: UNI_BODY, upper: true, photo: photo?.bmp ?? null, focus: DEFAULT_FOCUS });
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  ctx.textBaseline = "top";
  if (photo) coverFit(ctx, photo.bmp, post.px, post.py, post.pz);
  else {
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, W, H);
  }
  const fin = post.finish === "gold" || post.finish === "silver" ? post.finish : "";
  const INK = fin ? "#1b1b1b" : "#ffffff";
  const SHEEN = { gold: ["#7a5a14", "#d4a93c", "#fff1a8", "#c9962b", "#7a5a14"], silver: ["#6d6f73", "#c9ccd1", "#ffffff", "#a9adb3", "#6d6f73"] };
  const sheen = (c: CanvasRenderingContext2D, y0: number) => {
    const sg = c.createLinearGradient(0, y0, W, H);
    SHEEN[fin || "gold"].forEach((col, i, a) => sg.addColorStop(i / (a.length - 1), col));
    return sg;
  };
  if (post.block) {
    // how tall the words are, so the block is always big enough to hold them
    let need = 110 + 70;
    const lt = (post.line || "").trim();
    if (lt && !tweet) {
      const lf0 = fitText(ctx, lt, (px) => `400 ${px}px "${BODY}", serif`, W - 160, 200, 34, 24, 1.5);
      need += lf0.lines.length * lf0.px * 1.5 + 36;
    }
    const hf0 = tweet
      ? fitText(ctx, post.hook || "", (px) => `700 ${px}px "${BODY}", serif`, W - 160, 760, 64, 36, 1.3)
      : fitText(ctx, post.hook || "", (px) => `400 ${px}px "${HEAD}", serif`, W - 160, 560, 124, 52, 1.08);
    need += hf0.lines.length * hf0.px * (tweet ? 1.3 : 1.08);
    need *= Math.max(0.4, post.ts || 1);
    const top = Math.max(Math.round(H * 0.3), Math.min(Math.round(H * 0.75), Math.round(H - Math.max(H * 0.25, need) + Math.min(0, post.ty || 0))));
    ctx.fillStyle = fin ? sheen(ctx, top) : "#1e1e1e";
    ctx.fillRect(0, top, W, H - top);
  } else if (fin) {
    // metallic gradient: paint the shine on a spare canvas, fade it in with the same ramp, then lay it over the photo
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    const t = tmp.getContext("2d")!;
    t.fillStyle = sheen(t, 0);
    t.fillRect(0, 0, W, H);
    t.globalCompositeOperation = "destination-in";
    const m = t.createLinearGradient(0, H * (tweet ? 0.1 : 0.3), 0, H);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(0.55, "rgba(0,0,0,0.9)");
    m.addColorStop(1, "rgba(0,0,0,1)");
    t.fillStyle = m;
    t.fillRect(0, 0, W, H);
    ctx.drawImage(tmp, 0, 0);
  } else {
    const g = ctx.createLinearGradient(0, H * (tweet ? 0.1 : 0.3), 0, H);
    g.addColorStop(0, "rgba(30,30,30,0)");
    g.addColorStop(1, `rgba(30,30,30,${tweet ? 0.9 : 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  const ANCHOR_Y = H - 110;
  const ts = Math.max(0.4, post.ts || 1);
  ctx.save();
  ctx.translate(80 + (post.tx || 0), ANCHOR_Y + (post.ty || 0));
  ctx.scale(ts, ts);
  ctx.translate(-80, -ANCHOR_Y);
  const lineText = (post.line || "").trim();
  let bottom = H - 110;

  if (lineText && !tweet) {
    const lf = fitText(ctx, lineText, (px) => `400 ${px}px "${BODY}", serif`, W - 160, 200, 34, 24, 1.5);
    const total = lf.lines.length * lf.px * 1.5;
    ctx.font = `400 ${lf.px}px "${BODY}", serif`;
    ctx.fillStyle = fin ? "rgba(27,27,27,0.92)" : "rgba(255,255,255,0.92)";
    let y = bottom - total;
    for (const l of lf.lines) {
      ctx.fillText(l, 80, y);
      y += lf.px * 1.5;
    }
    bottom = bottom - total - 36;
  }

  const hf = tweet
    ? fitText(ctx, post.hook || "", (px) => `700 ${px}px "${BODY}", serif`, W - 160, 760, 64, 36, 1.3)
    : fitText(ctx, post.hook || "", (px) => `400 ${px}px "${HEAD}", serif`, W - 160, 560, 124, 52, 1.08);
  const lh = tweet ? 1.3 : 1.08;
  ctx.font = tweet ? `700 ${hf.px}px "${BODY}", serif` : `400 ${hf.px}px "${HEAD}", serif`;
  ctx.fillStyle = INK;
  let y = bottom - hf.lines.length * hf.px * lh;
  for (const l of hf.lines) {
    ctx.fillText(l, 80, y);
    y += hf.px * lh;
  }

  const topY = y - hf.lines.length * hf.px * lh;
  ctx.restore();
  const box: Box = {
    x: 80 + (post.tx || 0),
    y: ANCHOR_Y + (post.ty || 0) + (topY - ANCHOR_Y) * ts,
    w: (W - 160) * ts,
    h: (ANCHOR_Y - topY) * ts,
  };

  ctx.font = `700 24px "${BODY}", serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(STATIC_CLINIC, 80, 70);
  drawLogo(ctx, logo);
  return box;
}

function PostCanvas({ post, tweet, photo, logo, onChange }: { post: Post; tweet: boolean; photo: Photo | null; logo: HTMLImageElement | null; onChange: (c: Partial<Post>) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<{ mode: "text" | "photo"; sx: number; sy: number; ox: number; oy: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      await ensureFonts();
      const c = ref.current;
      if (!c || !live) return;
      const ctx = c.getContext("2d");
      if (ctx) box.current = drawPost(ctx, post, tweet, photo, logo);
    })();
    return () => {
      live = false;
    };
  }, [post, tweet, photo, logo]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, k: W / r.width };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (post.uni) return;
    const pt = toCanvas(e);
    const b = box.current;
    const inText = pt.x >= b.x - 20 && pt.x <= b.x + b.w + 20 && pt.y >= b.y - 20 && pt.y <= b.y + b.h + 20;
    drag.current = inText ? { mode: "text", sx: pt.x, sy: pt.y, ox: post.tx, oy: post.ty } : { mode: "photo", sx: pt.x, sy: pt.y, ox: post.px, oy: post.py };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const pt = toCanvas(e);
    const dx = pt.x - d.sx;
    const dy = pt.y - d.sy;
    onChange(d.mode === "text" ? { tx: d.ox + dx, ty: d.oy + dy } : { px: d.ox + dx, py: d.oy + dy });
  };
  const up = () => {
    drag.current = null;
  };
  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="w-[260px] max-w-full h-auto rounded-md border border-white/10 cursor-move touch-none"
      title="Drag the words to move them. Drag anywhere else to move the photo."
    />
  );
}

const p2 = (x: number) => String(x).padStart(2, "0");
const localStamp = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const nextDay = (hhmm: string) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${hhmm || "09:00"}`;
};

// One post every 2 days, starting tomorrow.
function slotFor(index: number, hhmm: string, startDate: string): string {
  const [h, m] = (/^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm : "19:00").split(":").map(Number);
  const d = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
  if (!startDate) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + index * 2);
  d.setHours(h, m, 0, 0);
  return localStamp(d);
}

function No1StaticsPage() {
  const { presets } = usePresets();
  const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
  const no1Presets = useMemo(() => presets.filter((p) => /no\s*1|no1/i.test(p.name)), [presets]);
  const preset = useMemo(() => no1Presets.find((p) => norm(p.name).startsWith("no1bodysculpt")) ?? no1Presets[0] ?? null, [no1Presets]);

  const [slotTime, setSlotTime] = useState(() => {
    try { return localStorage.getItem("no1-statics-time") || "19:00"; } catch { return "19:00"; }
  });
  const [slotStart, setSlotStart] = useState(""); // blank means tomorrow
  useEffect(() => {
    try { localStorage.setItem("no1-statics-time", slotTime); } catch { /* fine */ }
  }, [slotTime]);
  const [pool, setPool] = useState<Photo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [group, setGroup] = useState(STATIC_GROUPS[0].id);
  const [scheduled, setScheduled] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState<LibImage[]>([]);
  const [secBmps, setSecBmps] = useState<Record<string, Photo>>({});
  const [secBusy, setSecBusy] = useState("");

  const loadLib = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/universal/images`);
      const d = await r.json();
      setLib((d.images ?? []) as LibImage[]);
    } catch {
      /* the page still works with her own photos */
    }
  }, []);
  useEffect(() => {
    loadLib();
  }, [loadLib]);

  const libFor = useCallback(
    (g: string) => lib.filter((i) => i.treatmentId === `no1-${g}` || (FROM_UNIVERSAL[g] ?? []).includes(i.treatmentId)),
    [lib],
  );

  useEffect(() => {
    let live = true;
    const wanted = STATIC_GROUPS.flatMap((g) => libFor(g.id)).filter((i) => !secBmps[i.url]);
    if (!wanted.length) return;
    (async () => {
      const got: Record<string, Photo> = {};
      for (const i of wanted) {
        try {
          const bmp = await loadBitmap(i.url);
          got[i.url] = { id: i.url, bmp, url: i.url };
        } catch {
          /* a missing picture is skipped */
        }
      }
      if (live && Object.keys(got).length) setSecBmps((m) => ({ ...m, ...got }));
    })();
    return () => {
      live = false;
    };
  }, [libFor, secBmps]);

  const sectionPhotos = (g: string): Photo[] => libFor(g).map((i) => secBmps[i.url]).filter(Boolean);

  const uploadSection = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setSecBusy(`0 of ${list.length}`);
    let done = 0;
    for (let i = 0; i < list.length; i += 3) {
      const batch = list.slice(i, i + 3);
      try {
        const urlsIn: string[] = [];
        for (const f of batch) {
          const raw = await createImageBitmap(f);
          const sc = Math.min(1, 1600 / Math.max(raw.width, raw.height));
          const c = document.createElement("canvas");
          c.width = Math.round(raw.width * sc);
          c.height = Math.round(raw.height * sc);
          c.getContext("2d")!.drawImage(raw, 0, 0, c.width, c.height);
          raw.close();
          urlsIn.push(c.toDataURL("image/jpeg", 0.85));
        }
        const urls = await uploadPngs(urlsIn, batch.map((f) => f.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg"));
        const items = batch.map((f, k) => ({ treatmentId: `no1-${group}`, name: f.name, url: urls[k] })).filter((x) => x.url);
        await fetch(`${BASE}/api/universal/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
        done += items.length;
      } catch {
        toast.error("Some photos would not upload, try again");
      }
      setSecBusy(`${Math.min(i + 3, list.length)} of ${list.length}`);
    }
    await loadLib();
    setSecBusy("");
    if (done) toast.success(`${done} photo${done === 1 ? "" : "s"} saved to this section`);
  };

  useEffect(() => {
    ensureFonts();
    loadImg(LOGO_SRC).then(setLogo).catch(() => undefined);
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

  // Anything already in the scheduler for her is crossed out too, on any device.
  const loadScheduled = useCallback(async () => {
    if (!preset) return;
    try {
      const lists = await Promise.all(
        (no1Presets.length ? no1Presets : [preset]).map(async (pr) => {
          const r = await fetch(`${BASE}/api/scheduler/posts?presetId=${pr.id}`);
          return r.ok ? ((await r.json()).posts ?? []) : [];
        }),
      );
      const data = { posts: lists.flat() };
      const found: Record<string, string> = {};
      const detail: Record<string, { image: string; caption: string }> = {};
      for (const sp of (data.posts ?? []) as { content?: { title?: string; caption?: string; imageUrls?: string[] }; scheduledAt?: string; status?: string }[]) {
        const title = sp.content?.title ?? "";
        const t = STATIC_POST_TYPES.find((x) => title.startsWith(`${x.label} · static`));
        if (t && sp.status !== "failed") {
          found[t.id] = sp.scheduledAt ?? "";
          const image = sp.content?.imageUrls?.[0];
          if (image) detail[t.id] = { image, caption: sp.content?.caption ?? "" };
        }
      }
      setScheduled((cur) => ({ ...cur, ...found }));
      setSchedDetail(detail);
    } catch {
      /* ignore */
    }
  }, [preset, no1Presets]);
  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const [schedDetail, setSchedDetail] = useState<Record<string, { image: string; caption: string }>>({});
  const typesInGroup = useMemo(() => STATIC_POST_TYPES.filter((t) => t.group === group), [group]);
  const doneIn = (g: string) => STATIC_POST_TYPES.filter((t) => t.group === g && scheduled[t.id]).length;
  const totalIn = (g: string) => STATIC_POST_TYPES.filter((t) => t.group === g).length;
  const dateLabel = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

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

  const photosFor = (post: Post): Photo[] => {
    const own = sectionPhotos(TYPE_BY_ID.get(post.typeId)?.group ?? "");
    return own.length ? own : pool;
  };
  const photoFor = (post: Post): Photo | null => {
    const l = photosFor(post);
    return l.length ? l[post.photo % l.length] ?? null : null;
  };

  const addPost = (t: StaticPostType) => {
    setPosts((l) => [{ ...mkPost(t, l.length, nextDay(preset?.defaultPostTime ?? "09:00"), false), block: dflt.block, finish: dflt.finish }, ...l]);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const patch = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const foot = (preset?.captionFootnote || "").trim();
  const noFoot = (c: string) => (foot ? c.split(foot).join("").trim() : c.trim());
  const fullCaption = (post: Post) => [noFoot(post.caption), post.hashtags.join(" "), foot].filter(Boolean).join("\n\n");

  const write = async (post: Post) => {
    const t = TYPE_BY_ID.get(post.typeId)!;
    if (t.fixed) {
      patch(post.id, { busy: false, hook: t.fixed.hook, line: t.fixed.line, caption: t.fixed.caption, hashtags: t.fixed.hashtags });
      return;
    }
    patch(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/no1/static-copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: t.label, brief: briefFor(post, t), word: t.word, tweet: isTweet(t), note: post.note }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      patch(post.id, post.uni ? { busy: false, caption: data.caption, hashtags: data.hashtags } : { busy: false, hook: data.hook, line: data.line ?? "", caption: data.caption, hashtags: data.hashtags });
    } catch (e) {
      patch(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const render = async (post: Post): Promise<HTMLCanvasElement> => {
    await ensureFonts();
    const t = TYPE_BY_ID.get(post.typeId)!;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    drawPost(c.getContext("2d")!, post, isTweet(t), photoFor(post), logo);
    return c;
  };

  const feedLink = `${window.location.origin}${BASE}/no1feed`;
  const pw = () => {
    try {
      return localStorage.getItem("cybersuite-pw") || "";
    } catch {
      return "";
    }
  };
  const feedHeaders = () => ({ "Content-Type": "application/json", "x-app-password": pw(), Authorization: `Bearer ${pw()}` });

  const previewFeed = async () => {
    const written = posts.filter((p) => p.caption);
    const openIds = new Set(written.map((p) => p.typeId));
    const already = Object.entries(schedDetail).filter(([id]) => !openIds.has(id));
    if (written.length === 0 && already.length === 0) {
      toast.error("Write at least one post first, then press Preview feed");
      return;
    }
    setFeedBusy(true);
    try {
      const canvases: HTMLCanvasElement[] = [];
      for (const p of written) canvases.push(await render(p));
      const urls = written.length === 0 ? [] : await uploadPngs(
        canvases.map((c) => c.toDataURL("image/png")),
        written.map((p) => `no1-feed-${p.typeId}-${Date.now()}.png`),
      );
      const body = {
        posts: [
          ...written.map((p, i) => ({ id: p.typeId, label: TYPE_BY_ID.get(p.typeId)?.label ?? "", image: urls[i], caption: noFoot(p.caption), tags: p.hashtags.join(" ") })),
          ...already.map(([id, d]) => ({ id, label: TYPE_BY_ID.get(id)?.label ?? "", image: d.image, caption: d.caption, tags: "" })),
        ],
      };
      const r = await fetch(`${BASE}/api/no1/feed`, { method: "POST", headers: feedHeaders(), body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The feed would not save, try again");
      try {
        await navigator.clipboard.writeText(feedLink);
      } catch {
        /* the link is shown anyway */
      }
      toast.success(`Feed updated with ${data.total} posts. The link is copied: ${feedLink}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The feed would not save, try again");
    } finally {
      setFeedBusy(false);
    }
  };

  const clearFeed = async () => {
    if (!window.confirm("Take every post off Lizzie's feed preview?")) return;
    try {
      const r = await fetch(`${BASE}/api/no1/feed/clear`, { method: "POST", headers: feedHeaders(), body: "{}" });
      if (!r.ok) throw new Error("That did not clear, try again");
      toast.success("Her feed preview is empty again");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not clear, try again");
    }
  };

  const download = async (post: Post) => {
    const t = TYPE_BY_ID.get(post.typeId)!;
    const c = await render(post);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
    if (blob) saveAs(blob, `no1-${t.id}.png`);
  };

  // Sends one post to the scheduler as a single image. Returns when it is in.
  const send = async (post: Post, when: string) => {
    if (!preset) throw new Error("I cannot find her client preset. It needs No 1 in its name");
    const t = TYPE_BY_ID.get(post.typeId)!;
    const c = await render(post);
    const [url] = await uploadPngs([c.toDataURL("image/png")], [`no1-${t.id}-${Date.now()}.png`]);
    const body = {
      postType: "single-image",
      content: { caption: fullCaption(post), title: `${t.label} · static`, platforms: ["instagram"], imageUrls: [url], sourceTool: "no1-statics" },
      scheduledAt: new Date(when).toISOString(),
      isTrial: false,
      notes: "",
      presetId: preset.id,
    };
    const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Failed" }));
      throw new Error(err.error || "Failed to schedule");
    }
    setScheduled((s) => ({ ...s, [t.id]: new Date(when).toISOString() }));
  };

  const lacksPhoto = (post: Post) => (post.uni ? !!uniOf(post.typeId)?.photo : true) && photosFor(post).length === 0;
  const schedule = async (post: Post) => {
    if (lacksPhoto(post)) {
      toast.error("Add her photos first");
      return;
    }
    patch(post.id, { scheduling: true });
    try {
      await send(post, post.when);
      patch(post.id, { scheduling: false });
      toast.success("Scheduled, and crossed off her list");
    } catch (e) {
      patch(post.id, { scheduling: false });
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    }
  };

  // Every written post that is not yet scheduled, oldest first, one a night at 7pm from tomorrow.
  const ready = useMemo(() => [...posts].reverse().filter((p) => p.caption && !scheduled[p.typeId]), [posts, scheduled]);
  const scheduleAll = async () => {
    if (ready.some(lacksPhoto)) {
      toast.error("Add her photos first");
      return;
    }
    if (!ready.length) {
      toast.error("Nothing written and waiting yet");
      return;
    }
    setBulkBusy(true);
    let done = 0;
    try {
      for (let i = 0; i < ready.length; i++) {
        const when = slotFor(i, slotTime, slotStart);
        patch(ready[i].id, { scheduling: true, when });
        await send(ready[i], when);
        patch(ready[i].id, { scheduling: false });
        done++;
      }
      toast.success(`${done} posts scheduled, one every 2 days at ${slotTime}, from ${slotStart || "tomorrow"}`);
    } catch (e) {
      toast.error(`${done} scheduled, then it stopped: ${e instanceof Error ? e.message : "could not schedule"}`);
      setPosts((l) => l.map((p) => ({ ...p, scheduling: false })));
    } finally {
      setBulkBusy(false);
    }
  };

  // The page default for new posts, then Make 40: half with a block along the bottom, half with the gradient.
  const [dflt, setDflt] = useState<{ block: boolean; finish: "" | "gold" | "silver" }>({ block: false, finish: "" });
  const [making, setMaking] = useState("");
  const make40 = async () => {
    const usable = STATIC_POST_TYPES.filter((t) => !uniOf(t.id));
    const byGroup = new Map<string, StaticPostType[]>();
    for (const t of usable) byGroup.set(t.group, [...(byGroup.get(t.group) ?? []), t]);
    const order: StaticPostType[] = [];
    for (let r = 0; order.length < 40 && r < 40; r++) for (const g of byGroup.values()) { if (order.length >= 40) break; order.push(g[r % g.length]); }
    const fresh: Post[] = order.map((t, i) => ({ ...mkPost(t, posts.length + i, nextDay(preset?.defaultPostTime ?? "09:00"), true), block: i % 2 === 1, finish: dflt.finish }));
    setPosts((l) => [...fresh.slice().reverse(), ...l]);
    for (let i = 0; i < fresh.length; i++) {
      setMaking(`Writing post ${i + 1} of ${fresh.length}`);
      await write(fresh[i]);
    }
    setMaking("");
    toast.success("40 posts made: 20 with a block, 20 with the gradient");
  };

  const writeAllInSection = async () => {
    const wanted = typesInGroup.filter((t) => !scheduled[t.id] && !posts.some((p) => p.typeId === t.id));
    if (!wanted.length) {
      toast.error("Every post in this section is already open or scheduled");
      return;
    }
    const fresh: Post[] = wanted.map((t, i) => ({ ...mkPost(t, posts.length + i, nextDay(preset?.defaultPostTime ?? "09:00"), true), block: dflt.block, finish: dflt.finish }));
    setPosts((l) => [...fresh.slice().reverse(), ...l]);
    for (const post of fresh) {
      const t = TYPE_BY_ID.get(post.typeId)!;
      if (t.fixed) {
        patch(post.id, { busy: false, hook: t.fixed.hook, line: t.fixed.line, caption: t.fixed.caption, hashtags: t.fixed.hashtags });
        continue;
      }
      try {
        const r = await fetch(`${BASE}/api/no1/static-copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: t.label, brief: briefFor(post, t), word: t.word, tweet: isTweet(t), note: "" }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "failed");
        patch(post.id, post.uni ? { busy: false, caption: data.caption, hashtags: data.hashtags } : { busy: false, hook: data.hook, line: data.line ?? "", caption: data.caption, hashtags: data.hashtags });
      } catch {
        patch(post.id, { busy: false });
        toast.error(`"${t.label}" would not write, press Write it on it`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl" style={{ fontFamily: `"${HEAD}", serif` }}>{STATIC_CLINIC} statics</h1>
            <p className="text-white/60 text-sm">One image per post. 18 sections of 6. Names cross out once scheduled.{!preset && " (I cannot see her client preset yet, so scheduling is off.)"}</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">1. Set up</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <label className="space-y-1 block">
              <span className="text-white/60">Post time each night</span>
              <input type="time" className="w-full bg-white/5 rounded p-2" value={slotTime} onChange={(e) => setSlotTime(e.target.value || "19:00")} />
            </label>
            <label className="space-y-1 block">
              <span className="text-white/60">First night (blank is tomorrow)</span>
              <input type="date" className="w-full bg-white/5 rounded p-2" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
            </label>
            <p className="text-white/50 self-end">Schedule all puts one post out every 2 days at the time you pick. Caption footnote from her preset: {foot ? `"${foot}"` : "none saved yet"}.</p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <h3 className="font-medium">Her photos</h3>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.currentTarget.value = ""; }} />
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => fileRef.current?.click()} variant="secondary"><ImagePlus className="w-4 h-4 mr-2" />Upload photos</Button>
              <ApprovedImagesPicker clientName={preset?.name || STATIC_CLINIC} mode="multi" skipBackgroundRemoval large label="Use approved photos" onAddImages={(files) => { if (files.length) addPhotos(files); }} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pool.length === 0 && <p className="text-white/50 text-sm">Add her photos once. They go behind every post with a soft dark wash at the bottom, and rotate through the posts.</p>}
            {pool.map((p, i) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="" className="w-16 h-20 object-cover rounded" />
                <button className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5" onClick={() => setPool((l) => l.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${i + 1}`}><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">2. Pick a post</h2>
            <Button size="sm" variant="secondary" disabled={!!making} onClick={() => void make40()}>{making ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{making}</> : <><Sparkles className="w-4 h-4 mr-2" />Make 40 posts (20 block, 20 gradient)</>}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="text-white/60">New posts get</span>
              {([[false, "Gradient"], [true, "Block"]] as const).map(([v, label]) => (
                <button key={label} onClick={() => setDflt((d) => ({ ...d, block: v }))} className={`rounded border px-2 py-1 ${dflt.block === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20"}`}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2"><span className="text-white/60">Finish</span>
              {([["", "Dark"], ["gold", "Metallic gold"], ["silver", "Metallic silver"]] as const).map(([v, label]) => (
                <button key={label} onClick={() => setDflt((d) => ({ ...d, finish: v }))} className={`rounded border px-2 py-1 ${dflt.finish === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATIC_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} className={`px-3 py-1.5 rounded-full text-sm border ${group === g.id ? "bg-white text-black border-white" : "border-white/20 text-white/80"}`}>
                {g.label} <span className="opacity-60">{doneIn(g.id)}/{totalIn(g.id)}</span>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-white/15 p-3 text-sm space-y-2">
            {(() => {
              const n = sectionPhotos(group).length;
              const fromU = (FROM_UNIVERSAL[group] ?? []).join(", ");
              return (
                <>
                  <p>
                    <strong>Photos for this section: {n}</strong>
                    {n > 0 ? (fromU ? ` (from Universal: ${fromU}, plus any you add here)` : " (uploaded here)") : pool.length ? ". None of its own yet, so your general photos are used." : ". None yet. Upload some for this section."}
                  </p>
                  <input ref={sectionRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadSection(e.target.files); e.currentTarget.value = ""; }} />
                  <Button size="sm" variant="secondary" disabled={!!secBusy} onClick={() => sectionRef.current?.click()}>
                    {secBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                    {secBusy ? `Uploading ${secBusy}` : "Upload photos for this section"}
                  </Button>
                  {(() => {
                    const need = STATIC_GROUPS.filter((g) => sectionPhotos(g.id).length === 0).map((g) => g.label);
                    return need.length ? <p className="text-white/60">Still needs photos: {need.join(", ")}.</p> : <p className="text-white/60">Every section has photos.</p>;
                  })()}
                </>
              );
            })()}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {typesInGroup.map((t) => {
              const when = scheduled[t.id];
              return (
                <button key={t.id} onClick={() => addPost(t)} className="text-left px-3 py-2 rounded-lg border border-white/15 text-sm flex items-center gap-2">
                  {when ? <CalendarCheck className="w-4 h-4 text-green-400 shrink-0" /> : <Plus className="w-4 h-4 text-white/40 shrink-0" />}
                  <span className={when ? "line-through decoration-2 opacity-50" : ""}>{t.label}</span>
                  {when && <span className="ml-auto text-xs text-green-300/80 whitespace-nowrap">{dateLabel(when)}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={previewFeed} disabled={feedBusy}>
              {feedBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}Preview feed (link for Lizzie)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(feedLink); toast.success(`Link copied: ${feedLink}`); }}>Copy feed link</Button>
            <Button size="sm" variant="ghost" onClick={clearFeed}>Clear feed</Button>
            <Button size="sm" variant="secondary" onClick={writeAllInSection}><Sparkles className="w-4 h-4 mr-2" />Open and write all 6 in this section</Button>
            <Button size="sm" onClick={scheduleAll} disabled={bulkBusy || ready.length === 0}>
              {bulkBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}Schedule all written ({ready.length}), one a night at {slotTime}
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          {posts.length === 0 && <p className="text-white/50 text-sm">Press a post name above and it opens here.</p>}
          {posts.map((post) => {
            const t = TYPE_BY_ID.get(post.typeId)!;
            const tweet = isTweet(t);
            return (
              <div key={post.id} className="rounded-xl border border-white/10 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{t.label}</h3>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button size="sm" onClick={() => write(post)} disabled={post.busy}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Write it
                    </Button>
                    <input type="datetime-local" className="bg-white/5 rounded p-1.5 text-sm" value={post.when} onChange={(e) => patch(post.id, { when: e.target.value })} />
                    <Button size="sm" onClick={() => schedule(post)} disabled={!post.caption || post.scheduling || bulkBusy}>
                      {post.scheduling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck className="w-4 h-4 mr-2" />}Schedule
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => download(post)} disabled={!post.caption}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((p) => p.id !== post.id))} aria-label="Remove post"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="grid md:grid-cols-[260px_1fr] gap-4">
                  <div className="space-y-3">
                    <PostCanvas post={post} tweet={tweet} photo={photoFor(post)} logo={logo} onChange={(c) => patch(post.id, c)} />
                    {!post.uni && <p className="text-xs text-white/50 w-[260px] max-w-full">Drag the words to move them. Drag anywhere else to move the photo.</p>}
                    {post.uni && <p className="text-xs text-white/50 w-[260px] max-w-full">Change the words on the right and the picture redraws.</p>}
                    {!post.uni && <label className="block text-xs text-white/60 w-[260px] max-w-full">Photo zoom
                      <input type="range" min={1} max={3} step={0.01} value={post.pz} onChange={(e) => patch(post.id, { pz: Number(e.target.value) })} className="w-full" />
                    </label>}
                    {!post.uni && <label className="block text-xs text-white/60 w-[260px] max-w-full">Text size
                      <input type="range" min={0.5} max={1.6} step={0.01} value={post.ts} onChange={(e) => patch(post.id, { ts: Number(e.target.value) })} className="w-full" />
                    </label>}
                    <div className="flex gap-2 flex-wrap">
                      {photosFor(post).length > 1 && <Button size="sm" variant="secondary" onClick={() => patch(post.id, { photo: post.photo + 1, px: 0, py: 0, pz: 1 })}>Swap photo</Button>}
                      <Button size="sm" variant="ghost" onClick={() => patch(post.id, { ...LAYOUT0 })}>Reset</Button>
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm content-start">
                    {post.uni && uniOf(post.typeId)?.fields.map((f) => (
                      <label key={f.key} className="space-y-1 block">
                        <span className="text-white/60">{f.label}</span>
                        <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.uni?.[f.key] ?? ""} onChange={(e) => patch(post.id, { uni: { ...post.uni, [f.key]: e.target.value } })} />
                      </label>
                    ))}
                    {!post.uni && (
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="flex items-center gap-2"><span className="text-white/60">Bottom of the page</span>
                            {([[false, "Gradient"], [true, "Block"]] as const).map(([v, label]) => (
                              <button key={label} onClick={() => patch(post.id, { block: v })} className={`rounded border px-2 py-1 ${!!post.block === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20"}`}>{label}</button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2"><span className="text-white/60">Finish</span>
                            {([["", "Dark"], ["gold", "Metallic gold"], ["silver", "Metallic silver"]] as const).map(([v, label]) => (
                              <button key={label} onClick={() => patch(post.id, { finish: v })} className={`rounded border px-2 py-1 ${(post.finish || "") === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20"}`}>{label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {!post.uni && <label className="space-y-1 block">
                      <span className="text-white/60">{tweet ? "The tweet on the picture" : "Words on the picture"}</span>
                      <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.hook} onChange={(e) => patch(post.id, { hook: e.target.value })} />
                    </label>}
                    {!tweet && !post.uni && (
                      <label className="space-y-1 block">
                        <span className="text-white/60">Supporting line</span>
                        <textarea className="w-full bg-white/5 rounded p-2" rows={2} value={post.line} onChange={(e) => patch(post.id, { line: e.target.value })} />
                      </label>
                    )}
                    <label className="space-y-1 block">
                      <span className="text-white/60">Caption</span>
                      <textarea className="w-full bg-white/5 rounded p-2" rows={6} value={post.caption} onChange={(e) => patch(post.id, { caption: e.target.value })} />
                    </label>
                    <p className="text-white/50">{post.hashtags.join(" ")}</p>
                    <label className="space-y-1 block">
                      <span className="text-white/60">Anything extra for this one (optional)</span>
                      <input className="w-full bg-white/5 rounded p-2" value={post.note} onChange={(e) => patch(post.id, { note: e.target.value })} placeholder="A detail to include" />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export default withAboutTab(No1StaticsPage, /no ?1|no1/i, "NO 1 static posts");
