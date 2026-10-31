import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Gem, Download, ImagePlus, Loader2, Sparkles, Type, X } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import { FONT_OPTIONS, loadGoogleFonts } from "@/lib/slide-utils";
import { addSharedFonts, syncSharedFonts, FONTS_CHANGED_EVENT, type SharedFontOption } from "@/lib/shared-fonts";
import { fillTokens, type Fill } from "@/lib/basic-covers";
import { DEFAULT_FOCUS, LOGO_POSITIONS, type Focus, type LogoPos, type Slot } from "@/lib/xmas-designs";
import {
  FOILS, LUX_COVERS, LUX_FIELDS, LUX_LABELS, LUX_PALETTE, LUX_SLIDES, LUX_SLIDE_DEFS, XH, XW, drawLux, drawLuxPhotoSlide, leftoverPlaceholders, luxDefaults, resolveLuxText,
  type EKey, type EMetal, type EPalette,
} from "@/lib/lux-designs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SETTINGS_KEY = "lux-client-v1";
const DEFAULT_HEAD = "'Playfair Display', serif";
const DEFAULT_BODY = "'Poppins', sans-serif";

type PoolPhoto = { id: string; file: File; url: string };

type Post = {
  id: string;
  cover: number; // which of the ten cover designs this carousel opens with
  fresh: boolean;
  text: Record<string, string>; // the words on the cover
  slides: string[]; // the words on photo slides 2 and 3
  cta: string; // the question on the last slide
  photos: (number | null)[];
  focus: Record<string, Focus>;
  caption: string;
  hashtags: string[];
  selected: boolean;
  busy: boolean;
  palette?: Partial<EPalette>;
  metal?: EMetal;
  logoPos?: LogoPos;
};

type ClientSettings = {
  owner: string; role: string; area: string; headFont: string; bodyFont: string; logoPos: LogoPos; gpal?: Partial<EPalette>; gmetal?: EMetal; scrim?: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");

// ---------------------------------------------------------------------------
// Photos and fonts
// ---------------------------------------------------------------------------

const bitmaps = new Map<string, Promise<ImageBitmap | null>>();
function getBitmap(p: PoolPhoto): Promise<ImageBitmap | null> {
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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function ensureFonts(...fonts: string[]) {
  try {
    await Promise.all(
      [...fonts, "'Playfair Display', Georgia, serif"].flatMap((f) =>
        [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px ${f}`).catch(() => [] as FontFace[])),
      ),
    );
  } catch { /* draw with whatever has arrived */ }
}

// ---------------------------------------------------------------------------
// Drawing one slide
// ---------------------------------------------------------------------------

type Look = {
  gpal: Partial<EPalette>;
  gmetal: EMetal;
  fill: Fill;
  headFont: string;
  bodyFont: string;
  logoPos: LogoPos;
  logo: HTMLImageElement | null;
  pool: PoolPhoto[];
  scrim: number;
};

const fk = (n: number) => `s${n}`;

async function renderSlide(post: Post, n: number, look: Look, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(XW * scale);
  canvas.height = Math.round(XH * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pi = post.photos[n];
  const p = pi != null ? look.pool[pi] ?? null : null;
  const palette = { ...LUX_PALETTE, ...look.gpal, ...(post.palette ?? {}) };
  const photo = p ? await getBitmap(p) : null;
  const focus = post.focus[fk(n)] ?? DEFAULT_FOCUS;
  const logoPos = post.logoPos ?? look.logoPos;
  if (n === 0) {
    return drawLux(ctx, {
      cover: post.cover,
      text: resolveLuxText(post.cover, post.text, look.fill),
      palette,
      metal: { ...look.gmetal, ...(post.metal ?? {}) },
      headFont: look.headFont,
      bodyFont: look.bodyFont,
      photo,
      focus,
      logo: look.logo,
      logoPos,
    });
  }
  const last = n === LUX_SLIDES - 1;
  return drawLuxPhotoSlide(ctx, {
    text: fillTokens(post.slides[n - 1] ?? "", look.fill),
    cta: last ? fillTokens(post.cta, look.fill) : "",
    palette,
    bodyFont: look.bodyFont,
    photo,
    focus,
    scrim: look.scrim,
    logo: look.logo,
    logoPos,
    arrow: !last,
  });
}

function SlidePreview({ post, n, look, onFocus, onPick }: { post: Post; n: number; look: Look; onFocus: (f: Focus) => void; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slots = useRef<Slot[]>([]);
  const drag = useRef<{ slot: Slot; x: number; y: number; f: Focus; ox: number; oy: number } | null>(null);
  const run = useRef(0);
  const SC = 0.3;

  useEffect(() => {
    const my = ++run.current;
    const t = setTimeout(async () => {
      await ensureFonts(look.headFont, look.bodyFont);
      if (my !== run.current || !ref.current) return;
      const c = document.createElement("canvas");
      const s = await renderSlide(post, n, look, c, SC);
      if (my !== run.current || !ref.current) return;
      slots.current = s;
      const out = ref.current;
      out.width = c.width;
      out.height = c.height;
      out.getContext("2d")!.drawImage(c, 0, 0);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, n, look]);

  const hit = (px: number, py: number): Slot | null => {
    for (const s of slots.current) {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const a = (-s.rot * Math.PI) / 180;
      const dx = px - cx, dy = py - cy;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(rx) <= s.w / 2 && Math.abs(ry) <= s.h / 2) return s;
    }
    return null;
  };
  const toCanvas = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * XW, y: ((e.clientY - r.top) / r.height) * XH };
  };
  const focus = post.focus[fk(n)] ?? DEFAULT_FOCUS;
  const onDown = async (e: React.PointerEvent) => {
    const p = toCanvas(e);
    const slot = hit(p.x, p.y);
    const pi = post.photos[n];
    if (!slot || pi == null) return;
    const ph = look.pool[pi];
    const bmp = ph ? await getBitmap(ph) : null;
    if (!bmp) return;
    const sc = Math.max(slot.w / bmp.width, slot.h / bmp.height);
    drag.current = { slot, x: p.x, y: p.y, f: focus, ox: bmp.width * sc - slot.w, oy: bmp.height * sc - slot.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    const a = (-d.slot.rot * Math.PI) / 180;
    const dx0 = p.x - d.x, dy0 = p.y - d.y;
    const dx = dx0 * Math.cos(a) - dy0 * Math.sin(a);
    const dy = dx0 * Math.sin(a) + dy0 * Math.cos(a);
    onFocus([
      d.ox > 1 ? Math.max(0, Math.min(1, d.f[0] - dx / d.ox)) : d.f[0],
      d.oy > 1 ? Math.max(0, Math.min(1, d.f[1] - dy / d.oy)) : d.f[1],
    ]);
  };

  return (
    <div className="w-[150px] shrink-0 space-y-1">
      <canvas
        ref={ref}
        width={Math.round(XW * SC)}
        height={Math.round(XH * SC)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => { drag.current = null; }}
        onDoubleClick={(e) => { const p = toCanvas(e as unknown as React.PointerEvent); if (hit(p.x, p.y)) onFocus(DEFAULT_FOCUS); }}
        className="w-full rounded-md border border-border/30 bg-muted/20 touch-none cursor-grab active:cursor-grabbing"
        style={{ aspectRatio: `${XW} / ${XH}` }}
      />
      <button type="button" onClick={onPick} className="w-full text-[11px] rounded border border-border/40 py-0.5 hover:border-border">
        {n + 1}. Change photo
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fonts list and colour box
// ---------------------------------------------------------------------------

type FontOpt = { label: string; value: string };

function FontList({ yours, library }: { yours: FontOpt[]; library: FontOpt[] }) {
  return (
    <SelectContent className="max-h-72">
      {yours.length > 0 && (
        <SelectGroup>
          <SelectLabel>Your fonts</SelectLabel>
          {yours.map((f) => <SelectItem key={`y-${f.value}`} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}
        </SelectGroup>
      )}
      <SelectGroup>
        <SelectLabel>Library fonts</SelectLabel>
        {library.map((f) => <SelectItem key={`l-${f.value}`} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}
      </SelectGroup>
    </SelectContent>
  );
}

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="color" value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 rounded border border-border/40 bg-transparent" />
      <span className="space-y-0.5">
        <span className="block text-[11px] uppercase tracking-widest">{label}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-20 rounded border border-border/40 bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-foreground" />
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Dates and uploads
// ---------------------------------------------------------------------------

// LUX goes out every Tuesday at 8pm. The first one is the next Tuesday that is still ahead of us.
function nextTuesday8pm(): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  let add = (2 - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= Date.now()) add = 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T20:00`;
}

async function uploadPngs(dataUrls: string[], names: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += 3) {
    const images = dataUrls.slice(i, i + 3).map((base64, j) => ({ name: names[i + j], base64 }));
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


// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export default function Lux() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) ?? null, [presets, presetId]);

  const [clinic, setClinic] = useState("");
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [headFont, setHeadFont] = useState(DEFAULT_HEAD);
  const [bodyFont, setBodyFont] = useState(DEFAULT_BODY);
  const [logoPos, setLogoPos] = useState<LogoPos>("off");
  const [gpal, setGpal] = useState<Partial<EPalette>>({});
  const [gmetal, setGmetal] = useState<EMetal>({});
  const [scrim, setScrim] = useState(35);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  const [pool, setPool] = useState<PoolPhoto[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chooser, setChooser] = useState<{ id: string; n: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleIds, setScheduleIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoogleFonts();
    const bump = () => setFontsTick((n) => n + 1);
    try {
      if (!document.getElementById("lux-extra-fonts")) {
        const l = document.createElement("link");
        l.id = "lux-extra-fonts";
        l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Poppins:wght@400;500;600;700&display=swap";
        document.head.appendChild(l);
      }
    } catch { /* fonts only affect how it looks */ }
    window.addEventListener(FONTS_CHANGED_EVENT, bump);
    void syncSharedFonts();
    return () => window.removeEventListener(FONTS_CHANGED_EVENT, bump);
  }, []);

  const makePost = (cover: number): Post => ({
    id: uid(), cover, fresh: false, text: luxDefaults(cover), slides: ["", ""], cta: "",
    photos: Array(LUX_SLIDES).fill(null), focus: {}, caption: "", hashtags: [], selected: true, busy: false,
  });

  // every empty slide picks up the next photo, so dropping photos in fills the lot
  const spread = (list: Post[], size: number): Post[] => {
    if (!size) return list;
    let next = 0;
    const used = new Set(list.flatMap((p) => p.photos).filter((v): v is number => v != null && v < size));
    return list.map((p) => ({
      ...p,
      photos: p.photos.map((ph, i) => {
        if (ph != null && ph < size) return ph;
        while (used.has(next) && next < size) next++;
        const pick = next < size ? next : i % size;
        used.add(pick);
        return pick;
      }),
    }));
  };

  const chooseClient = (id: number) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    let saved: Partial<ClientSettings> = {};
    try { saved = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, Partial<ClientSettings>>)[String(id)] ?? {}; } catch { /* none */ }
    setClinic(p?.name ?? "");
    setOwner(saved.owner ?? "");
    setRole(saved.role ?? "Owner");
    setArea(saved.area ?? p?.seoArea ?? "");
    setHeadFont(saved.headFont ?? DEFAULT_HEAD);
    setBodyFont(saved.bodyFont ?? DEFAULT_BODY);
    setGpal(saved.gpal ?? {});
    setGmetal(saved.gmetal ?? {});
    setLogoPos(saved.logoPos ?? "off");
    setScrim(saved.scrim ?? 35);
    setPosts(spread(Array.from({ length: LUX_COVERS }, (_, i) => makePost(i)), pool.length));
  };

  useEffect(() => {
    if (!presetId) return;
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, ClientSettings>;
      all[String(presetId)] = { owner, role, area, headFont, bodyFont, logoPos, gpal, gmetal, scrim };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [presetId, owner, role, area, headFont, bodyFont, logoPos, gpal, gmetal, scrim]);

  useEffect(() => {
    let live = true;
    setLogo(null);
    if (preset?.logoUrl) loadImg(preset.logoUrl).then((i) => { if (live) setLogo(i); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.id, preset?.logoUrl]);

  // fonts
  const shared = useMemo(() => FONT_OPTIONS as SharedFontOption[], [fontsTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const clientFonts: FontOpt[] = useMemo(
    () =>
      [preset?.stylishCoverHeadlineFont, preset?.stylishCoverSubtitleFont]
        .filter((v): v is string => !!v && !shared.some((x) => x.value === v))
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((v) => ({ label: `${v.split(",")[0].replace(/['"]/g, "").trim()} (this client)`, value: v })),
    [preset?.stylishCoverHeadlineFont, preset?.stylishCoverSubtitleFont, shared],
  );
  const yourFonts: FontOpt[] = useMemo(() => [...clientFonts, ...shared.filter((f) => f.custom)], [clientFonts, shared]);
  const libraryFonts: FontOpt[] = useMemo(
    () => shared.filter((f) => !f.custom && /,|['"]/.test(f.value) && !/^(top|bottom)-/.test(f.value)),
    [shared],
  );
  const addFonts = async (files: File[]) => {
    const added = await addSharedFonts(files);
    if (added.length) { toast.success(`Added ${added.join(", ")}. They are in every font list now.`); setFontsTick((n) => n + 1); }
    else toast.error("Those files were not fonts I could read. Try .otf, .ttf or .woff");
  };

  const addToPool = useCallback((files: File[]) => {
    setPool((old) => [...old, ...files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
  }, []);
  useEffect(() => {
    if (!pool.length) return;
    setPosts((list) => spread(list, pool.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);
  const removeFromPool = (i: number) => {
    setPool((old) => old.filter((_, k) => k !== i));
    setPosts((list) => list.map((p) => ({ ...p, photos: p.photos.map((v) => (v == null || v === i ? null : v > i ? v - 1 : v)) })));
  };

  const fill: Fill = useMemo(() => ({ owner: owner.trim(), clinic: clinic.trim(), area: area.trim(), role: role.trim() }), [owner, clinic, area, role]);
  const look: Look = useMemo(() => ({ fill, gpal, gmetal, headFont, bodyFont, logoPos, logo, pool, scrim }), [fill, gpal, gmetal, headFont, bodyFont, logoPos, logo, pool, scrim]);

  const patchPost = (id: string, change: Partial<Post> | ((p: Post) => Partial<Post>)) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...(typeof change === "function" ? change(p) : change) } : p)));
  const setText = (id: string, key: string, value: string) => patchPost(id, (p) => ({ text: { ...p.text, [key]: value } }));
  const setSlide = (id: string, i: number, value: string) => patchPost(id, (p) => ({ slides: p.slides.map((s, k) => (k === i ? value : s)) }));
  const setPostColour = (id: string, key: EKey, value: string) => patchPost(id, (p) => ({ palette: { ...(p.palette ?? {}), [key]: value } }));
  const setPostMetal = (id: string, key: EKey, on: boolean) => patchPost(id, (p) => ({ metal: { ...(p.metal ?? {}), [key]: on } }));
  const setPostFoil = (id: string, key: EKey, hex: string) =>
    patchPost(id, (p) => ({ palette: { ...(p.palette ?? {}), [key]: hex }, metal: { ...(p.metal ?? {}), [key]: true } }));

  // words and captions
  const onCover = (post: Post) => { const r = resolveLuxText(post.cover, post.text, fill); return [r.head, r.sub].filter(Boolean).join(" / "); };

  const writeCopy = async (post: Post) => {
    if (!preset) { toast.error("Choose a client first"); return; }
    patchPost(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/lux/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: clinic.trim() || preset.name,
          ownerName: owner.trim(),
          role: role.trim(),
          area: area.trim(),
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          theme: "",
          fresh: post.fresh,
          onImage: onCover(post),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      const foot = preset.captionFootnote?.trim();
      let caption: string = noDashes(data.caption ?? "");
      if (foot && !caption.includes(foot)) caption += `\n\n${foot}`;
      const cover = post.fresh && data.cover && typeof data.cover === "object" ? (data.cover as { head?: string; sub?: string }) : null;
      patchPost(post.id, (p) => ({
        busy: false, caption, hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
        text: cover ? { ...p.text, head: noDashes(cover.head ?? p.text.head), sub: noDashes(cover.sub ?? p.text.sub) } : p.text,
        slides: [data.slide2, data.slide3].map((x) => noDashes(x ?? "")),
        cta: noDashes(data.cta ?? ""),
        // the cover words are now written, so a rewrite keeps them
        fresh: false,
      }));
    } catch (e) {
      patchPost(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const selected = posts.filter((p) => p.selected);

  const writeAll = async () => {
    if (!selected.length) { toast.error("Tick at least one carousel first"); return; }
    setBusy("copy");
    const toastId = toast.loading(`Writing 0 of ${selected.length}`);
    let done = 0;
    const queue = [...selected];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift()!;
        await writeCopy(p);
        done++;
        toast.loading(`Writing ${done} of ${selected.length}`, { id: toastId });
      }
    };
    await Promise.all([worker(), worker()]);
    toast.success("All written. Have a read and tweak anything you like.", { id: toastId });
    setBusy(null);
  };

  const renderAll = async (post: Post): Promise<HTMLCanvasElement[]> => {
    await ensureFonts(headFont, bodyFont);
    const out: HTMLCanvasElement[] = [];
    for (let n = 0; n < LUX_SLIDES; n++) {
      const c = document.createElement("canvas");
      await renderSlide(post, n, look, c, 1);
      out.push(c);
    }
    return out;
  };

  const fullCaption = (p: Post) => `${p.caption.trim()}\n\n${p.hashtags.join(" ")}`.trim();
  const placeholdersIn = (p: Post) => [...new Set([
    ...leftoverPlaceholders(resolveLuxText(p.cover, p.text, fill)),
    ...leftoverPlaceholders({ s2: fillTokens(p.slides[0] ?? "", fill), s3: fillTokens(p.slides[1] ?? "", fill), cta: fillTokens(p.cta, fill) }),
  ])];

  const download = async () => {
    if (!selected.length) { toast.error("Tick at least one carousel first"); return; }
    setBusy("zip");
    try {
      const zip = new JSZip();
      for (const post of selected) {
        const folder = `lux-${String(posts.indexOf(post) + 1).padStart(2, "0")}`;
        const cs = await renderAll(post);
        for (let i = 0; i < cs.length; i++) {
          const blob = await new Promise<Blob | null>((res) => cs[i].toBlob((b) => res(b), "image/png"));
          if (blob) zip.file(`${folder}/slide-${String(i + 1).padStart(2, "0")}.png`, blob);
        }
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, fullCaption(post));
      }
      saveAs(await zip.generateAsync({ type: "blob" }), `lux-${(clinic || "client").replace(/\s+/g, "")}-${Date.now()}.zip`);
      toast.success(`${selected.length} carousel${selected.length !== 1 ? "s" : ""} downloaded at 1080 x 1350`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    if (!selected.length) { toast.error("Tick at least one carousel first"); return; }
    if (!clinic.trim() || !area.trim()) { toast.error("Fill in the business name and area first, so no placeholder goes out."); return; }
    const noWords = selected.filter((p) => !p.caption.trim() || p.slides.some((t) => !t.trim()) || !p.cta.trim());
    if (noWords.length) { toast.error(`${noWords.length} ticked carousel${noWords.length > 1 ? "s have" : " has"} no words yet. Press Write first.`); return; }
    const noPhoto = selected.filter((p) => p.photos.some((v) => v == null));
    if (noPhoto.length) { toast.error(`${noPhoto.length} ticked carousel${noPhoto.length > 1 ? "s have" : " has"} slides with no photo yet. Add approved photos first.`); return; }
    const left = selected.filter((p) => placeholdersIn(p).length);
    if (left.length) { toast.error(`A carousel still has ${placeholdersIn(left[0]).join(" ")} to fill in. Change it in the boxes first.`); return; }
    setBusy("schedule");
    const toastId = toast.loading("Getting the pictures ready");
    try {
      const items: SchedulePostPayload[] = [];
      for (const [k, post] of selected.entries()) {
        toast.loading(`Getting carousel ${k + 1} of ${selected.length} ready`, { id: toastId });
        const cs = await renderAll(post);
        const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `lux-${i + 1}-${Date.now()}.png`));
        items.push({ title: `LUX ${posts.indexOf(post) + 1} · ${clinic}`, caption: fullCaption(post), imageUrls: urls });
      }
      toast.dismiss(toastId);
      setScheduleItems(items);
      setScheduleIds(selected.map((p) => p.id));
      setScheduleStart(nextTuesday8pm());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get those ready", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  const chooserPost = chooser ? posts.find((p) => p.id === chooser.id) : null;
  const swatchNames = Object.fromEntries(LUX_LABELS.map((l) => [l.key, l.label])) as Record<EKey, string>;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <Gem className="w-5 h-5 text-stone-300" />
        <h1 className="font-bold text-lg">LUX</h1>
        <span className="text-sm text-muted-foreground">Ten covers, each opening its own carousel, 1080 x 1350</span>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border/30 p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Client</span>
              <Select value={presetId ? String(presetId) : ""} onValueChange={(v) => chooseClient(Number(v))}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue placeholder={presetsLoading ? "Loading…" : "Choose a client"} /></SelectTrigger>
                <SelectContent className="max-h-72">{presets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Business name</span>
              <Input value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="{clinic}" />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Owner first name</span>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="{owner}" />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Their role</span>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Owner and nurse" />
            </label>
            <label className="space-y-1.5 block lg:col-span-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Area (also used for the 5 hashtags)</span>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Town, City" />
            </label>
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Headline font</span>
              <Select value={headFont} onValueChange={setHeadFont}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <FontList yours={yourFonts} library={libraryFonts} />
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Body font</span>
              <Select value={bodyFont} onValueChange={setBodyFont}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <FontList yours={yourFonts} library={libraryFonts} />
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/30 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Colour picker for every carousel</span>
              <span className="text-xs text-muted-foreground">Pick a colour and it replaces that colour on every slide. Tick Metallic for a foil in the same colour, or press a metal.</span>
              {(Object.keys(gpal).length > 0 || Object.values(gmetal).some(Boolean)) && (
                <button type="button" onClick={() => { setGpal({}); setGmetal({}); }} className="text-xs text-muted-foreground underline hover:text-foreground">back to the template colours</button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(["page", "dark", "accent", "soft", "ink", "light"] as EKey[]).map((key) => {
                const on = gpal[key] != null;
                return (
                  <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Swatch label={swatchNames[key] + (on ? "" : " (template's own)")} value={gpal[key] ?? LUX_PALETTE[key]} onChange={(v) => setGpal((p) => ({ ...p, [key]: v }))} />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={!!gmetal[key]} onChange={(e) => setGmetal((m) => ({ ...m, [key]: e.target.checked }))} />
                      Metallic
                    </label>
                    {FOILS.map((f) => (
                      <button key={f.label} type="button" title={f.label}
                        onClick={() => { setGpal((p) => ({ ...p, [key]: f.hex })); setGmetal((m) => ({ ...m, [key]: true })); }}
                        className="h-5 w-5 rounded-full border border-border/50" style={{ background: `linear-gradient(135deg, ${f.hex}, #ffffff 45%, ${f.hex} 60%, #00000040)` }} />
                    ))}
                    {(on || gmetal[key]) && (
                      <button type="button" className="text-xs underline text-muted-foreground" onClick={() => {
                        setGpal((p) => { const n = { ...p }; delete n[key]; return n; });
                        setGmetal((m) => ({ ...m, [key]: false }));
                      }}>clear</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              Logo
              <Select value={logoPos} onValueChange={(v) => setLogoPos(v as LogoPos)}>
                <SelectTrigger className="w-36 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>{LOGO_POSITIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-muted-foreground">{preset?.logoUrl ? "uses this client's logo" : "this client has no logo saved"}</span>
            </label>
            <label className="flex items-center gap-2">
              Photo dimming on slides 2 and 3
              <input type="range" min={0} max={70} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} />
              <span className="text-muted-foreground w-8">{scrim}%</span>
            </label>
            <Button variant="outline" size="sm" onClick={() => fontFileRef.current?.click()}><Type className="w-4 h-4 mr-1.5" /> Upload fonts</Button>
            <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void addFonts(fs); }} />
          </div>
        </section>

        <section className="rounded-2xl border border-border/30 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Photos</h2>
            <span className="text-sm text-muted-foreground">Add approved photos and every slide without one picks one up. Each carousel has three photos, the cover and two full photo slides. Drag a photo inside a slide to move it, double click to put it back.</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <ApprovedImagesPicker clientName={preset?.name} onAddImages={addToPool} skipBackgroundRemoval large label="Add approved photos" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-1.5" /> Upload from my device</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) addToPool(fs); }} />
            </div>
          </div>
          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet. Every slide has a photo, so thirty photos make all ten carousels with no repeats. Your photos stay exactly as they are.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pool.map((p, i) => (
                <div key={p.id} className="relative group">
                  <img src={p.url} alt="" className="h-20 w-16 object-cover rounded-md border border-border/30" />
                  <button type="button" onClick={() => removeFromPool(i)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border/50"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">All {LUX_COVERS} carousels are made when you choose a client, one for each cover. Untick any you do not want.</p>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setPosts((l) => { const all = l.every((x) => x.selected); return l.map((p) => ({ ...p, selected: !all })); })}>Tick / untick all</Button>
            <Button onClick={writeAll} disabled={!!busy || !selected.length}>
              {busy === "copy" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />} Write captions for ticked
            </Button>
            <Button variant="outline" onClick={download} disabled={!!busy || !selected.length}>
              {busy === "zip" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download ticked
            </Button>
            <Button onClick={schedule} disabled={!!busy || !selected.length}>
              {busy === "schedule" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />} Schedule ticked
            </Button>
          </div>
        </section>

        {posts.length === 0 && (
          <p className="text-muted-foreground text-sm">Choose a client and {LUX_COVERS} carousels are made for you, one for each LUX cover, then add their approved photos. Each is the cover plus two full photo slides with the words laid over them, the last one ending on a question. Press Write and slides 2 and 3, the question and the caption are written to carry on from the cover. Tick Write fresh cover words if you want new words on the cover too. {"{owner}"}, {"{clinic}"}, {"{area}"} and {"{role}"} fill in from the boxes above. Scheduling puts them on every Tuesday at 8pm, starting with the next one, and you can move any date.</p>
        )}
        <div className="space-y-6">
          {posts.map((post, pi) => {
            const mine = { ...LUX_PALETTE, ...gpal, ...(post.palette ?? {}) };
            const fields = LUX_FIELDS[post.cover];
            return (
              <article key={post.id} className="rounded-2xl border border-border/30 p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={post.selected} onChange={(e) => patchPost(post.id, { selected: e.target.checked })} />
                  <h2 className="font-semibold">{pi + 1}.</h2>
                  <span className="font-semibold">{LUX_SLIDE_DEFS[post.cover].name}</span>
                  <span className="text-xs text-muted-foreground">Cover, then two photo slides</span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={post.fresh} onChange={(e) => patchPost(post.id, { fresh: e.target.checked })} />
                    Write fresh cover words
                  </label>
                  <div className="ml-auto">
                    <Button size="sm" variant="outline" disabled={post.busy || !!busy} onClick={() => writeCopy(post)}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      {post.caption ? "Rewrite" : "Write"}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {Array.from({ length: LUX_SLIDES }, (_, n) => (
                    <SlidePreview key={n} post={post} n={n} look={look}
                      onFocus={(f) => patchPost(post.id, (p) => ({ focus: { ...p.focus, [fk(n)]: f } }))}
                      onPick={() => setChooser({ id: post.id, n })} />
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <label key={i} className="block">
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide {i + 2} words</span>
                        <Textarea rows={3} value={post.slides[i]} onChange={(e) => setSlide(post.id, i, e.target.value)} placeholder={i === 0 ? "Press Write and I will carry on from the cover" : undefined} />
                      </label>
                    ))}
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide 3 question (the engagement CTA)</span>
                      <Input value={post.cta} onChange={(e) => patchPost(post.id, { cta: e.target.value })} />
                    </label>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Change the words on the cover</summary>
                      <div className="mt-3 grid gap-2">
                        {fields.map((fd) => (
                          <label key={fd.key} className="block">
                            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{fd.label}</span>
                            {(fd.rows ?? 1) > 1 ? (
                              <Textarea rows={Math.min(fd.rows ?? 2, 3)} value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                            ) : (
                              <Input value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                            )}
                          </label>
                        ))}
                        {post.cover === 2 && <p className="text-[11px] text-muted-foreground">The boxed note on this cover says consultations are complimentary. Change it if that is not true for this clinic.</p>}
                      </div>
                    </details>
                  </div>

                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                      <Textarea rows={7} value={post.caption} onChange={(e) => patchPost(post.id, { caption: e.target.value })} placeholder="Press Write" />
                    </label>
                    {post.hashtags.length > 0 && <p className="text-sm text-stone-300 break-words">{post.hashtags.join(" ")}</p>}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Colours and logo for this carousel only</summary>
                      <div className="mt-2 space-y-2">
                        {LUX_LABELS.map((c) => (
                          <div key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Swatch label={c.label} value={mine[c.key]} onChange={(v) => setPostColour(post.id, c.key, v)} />
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" checked={!!(post.metal?.[c.key] ?? gmetal[c.key])} onChange={(e) => setPostMetal(post.id, c.key, e.target.checked)} />
                              Metallic
                            </label>
                            {FOILS.map((f) => (
                              <button key={f.label} type="button" title={f.label} onClick={() => setPostFoil(post.id, c.key, f.hex)}
                                className="h-5 w-5 rounded-full border border-border/50" style={{ background: `linear-gradient(135deg, ${f.hex}, #ffffff 45%, ${f.hex} 60%, #00000040)` }} />
                            ))}
                          </div>
                        ))}
                        <Select value={post.logoPos ?? "__client"} onValueChange={(v) => patchPost(post.id, { logoPos: v === "__client" ? undefined : (v as LogoPos) })}>
                          <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__client">Logo: same as every carousel</SelectItem>
                            {LOGO_POSITIONS.map((o) => <SelectItem key={o.value} value={o.value}>Logo: {o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {(post.palette || post.metal) && <button type="button" className="underline" onClick={() => patchPost(post.id, { palette: undefined, metal: undefined })}>back to the template colours</button>}
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {chooser && chooserPost && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setChooser(null)}>
          <div className="bg-background rounded-2xl border border-border/40 p-5 max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-3">
              <h3 className="font-semibold">Choose a photo for slide {chooser.n + 1}</h3>
              <button type="button" className="ml-auto" onClick={() => setChooser(null)}><X className="w-5 h-5" /></button>
            </div>
            {pool.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add photos first.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {pool.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => {
                    patchPost(chooserPost.id, (cp) => ({ photos: cp.photos.map((v, k) => (k === chooser.n ? i : v)), focus: { ...cp.focus, [fk(chooser.n)]: DEFAULT_FOCUS } }));
                    setChooser(null);
                  }}>
                    <img src={p.url} alt="" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-stone-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {scheduleItems && preset && (
        <ScheduleModal
          presetId={preset.id}
          presetName={preset.name}
          postType="carousel"
          posts={scheduleItems}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          initialGapMinutes={7 * 1440}
          keepClockTime
          sourceTool="lux"
          presets={presets.map((x) => ({ id: x.id, name: x.name }))}
          onClose={() => setScheduleItems(null)}
          onSaved={() => {
            setPosts((l) => l.filter((p) => !scheduleIds.includes(p.id)));
            setScheduleItems(null);
            toast.success("Scheduled. Go and put the kettle on.");
          }}
        />
      )}
    </div>
  );
}
