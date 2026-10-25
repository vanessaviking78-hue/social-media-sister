import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Download, ImagePlus, Loader2, Plus, Sparkles, Sparkle, Trash2, Type, X } from "lucide-react";
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
import type { Fill, Focus, Slot } from "@/lib/basic-covers";
import {
  H, UNIQUE, UNIQUE_BY_ID, W, drawUniPhotoSlide, drawUnique, resolveUniText,
  type UniId,
} from "@/lib/unique-designs";
import { fillTokens } from "@/lib/basic-covers";
import { DEFAULT_FOCUS } from "@/lib/basic-covers";
import { PALETTE_LABELS } from "@/lib/unique-designs";
import type { Palette } from "@/lib/xmas-designs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SETTINGS_KEY = "unique-posts-client-v1";
const DEFAULT_HEAD = "'Anton', sans-serif";
const DEFAULT_BODY = "'Poppins', sans-serif";
const SLIDES = 3;

type PoolPhoto = { id: string; file: File; url: string };

type Post = {
  id: string;
  design: UniId;
  text: Record<string, string>;
  photos: (number | null)[];
  focus: Record<string, Focus>;
  slides: string[];
  cta: string;
  caption: string;
  hashtags: string[];
  selected: boolean;
  busy: boolean;
  fresh: boolean;
  pal?: Palette;
};

type ClientSettings = { owner: string; role: string; area: string; headFont: string; bodyFont: string; upper: boolean; scrim: number };

const uid = () => Math.random().toString(36).slice(2, 10);
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");

// ---------------------------------------------------------------------------
// Photos
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
      fonts.flatMap((f) => [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px ${f}`).catch(() => [] as FontFace[]))),
    );
  } catch { /* draw with whatever has arrived */ }
}


// ---------------------------------------------------------------------------
// Drawing a whole post
// ---------------------------------------------------------------------------

type Look = {
  fill: Fill;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  scrim: number;
  logo: HTMLImageElement | null;
  pool: PoolPhoto[];
};

const focusKeys = ["c0", "s2", "s3"];

function resolvedText(post: Post, fill: Fill): Record<string, string> {
  return resolveUniText(UNIQUE_BY_ID[post.design], post.text, fill);
}

async function renderSlide(post: Post, n: number, look: Look, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pal = post.pal ?? UNIQUE_BY_ID[post.design].palette;
  const bmpOf = async (i: number | null | undefined) => {
    const p = i == null ? null : look.pool[i] ?? null;
    return p ? await getBitmap(p) : null;
  };
  if (n === 0) {
    return drawUnique(ctx, {
      design: post.design,
      text: resolvedText(post, look.fill),
      palette: pal,
      headFont: look.headFont,
      bodyFont: look.bodyFont,
      upper: look.upper,
      photo: await bmpOf(post.photos[0]),
      focus: post.focus.c0 ?? DEFAULT_FOCUS,
      logo: look.logo,
    });
  }
  const last = n === SLIDES - 1;
  return drawUniPhotoSlide(ctx, {
    text: fillTokens(post.slides[n - 1] ?? "", look.fill),
    cta: last ? fillTokens(post.cta, look.fill) : "",
    palette: pal,
    bodyFont: look.bodyFont,
    photo: await bmpOf(post.photos[n]),
    focus: post.focus[focusKeys[n]] ?? DEFAULT_FOCUS,
    scrim: look.scrim,
    logo: look.logo,
    arrow: !last,
  });
}

// ---------------------------------------------------------------------------
// One preview canvas, draggable
// ---------------------------------------------------------------------------

function SlidePreview({ post, n, look, onFocus }: { post: Post; n: number; look: Look; onFocus: (key: string, f: Focus) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slots = useRef<Slot[]>([]);
  const drag = useRef<{ slot: Slot; key: string; x: number; y: number; f: Focus; ox: number; oy: number } | null>(null);
  const run = useRef(0);

  useEffect(() => {
    const my = ++run.current;
    const t = setTimeout(async () => {
      await ensureFonts(look.headFont, look.bodyFont);
      if (my !== run.current || !ref.current) return;
      const c = document.createElement("canvas");
      const s = await renderSlide(post, n, look, c, 0.4);
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

  const keyFor = (_slot: Slot) => focusKeys[n];
  const photoIdx = (_slot: Slot) => post.photos[n];

  const hit = (px: number, py: number): Slot | null => {
    for (let k = slots.current.length - 1; k >= 0; k--) {
      const s = slots.current[k];
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
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = async (e: React.PointerEvent) => {
    const p = toCanvas(e);
    const slot = hit(p.x, p.y);
    const pi = slot ? photoIdx(slot) : null;
    if (!slot || pi == null) return;
    const bmp = look.pool[pi] ? await getBitmap(look.pool[pi]) : null;
    if (!bmp) return;
    const sc = Math.max(slot.w / bmp.width, slot.h / bmp.height);
    const key = keyFor(slot);
    drag.current = { slot, key, x: p.x, y: p.y, f: post.focus[key] ?? DEFAULT_FOCUS, ox: bmp.width * sc - slot.w, oy: bmp.height * sc - slot.h };
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
    const nx = d.ox > 1 ? Math.max(0, Math.min(1, d.f[0] - dx / d.ox)) : d.f[0];
    const ny = d.oy > 1 ? Math.max(0, Math.min(1, d.f[1] - dy / d.oy)) : d.f[1];
    onFocus(d.key, [nx, ny]);
  };
  const onUp = () => { drag.current = null; };

  return (
    <canvas
      ref={ref}
      width={Math.round(W * 0.4)}
      height={Math.round(H * 0.4)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={(e) => {
        const p = toCanvas(e as unknown as React.PointerEvent);
        const slot = hit(p.x, p.y);
        if (slot) onFocus(keyFor(slot), DEFAULT_FOCUS);
      }}
      className="w-full rounded-lg border border-border/30 bg-muted/20 touch-none cursor-grab active:cursor-grabbing"
      style={{ aspectRatio: "4 / 5" }}
    />
  );
}
// ---------------------------------------------------------------------------
// Fonts list
// ---------------------------------------------------------------------------

type FontOpt = { label: string; value: string };

function FontList({ yours, library }: { yours: FontOpt[]; library: FontOpt[] }) {
  return (
    <SelectContent className="max-h-72">
      {yours.length > 0 && (
        <SelectGroup>
          <SelectLabel>Your fonts</SelectLabel>
          {yours.map((f) => (
            <SelectItem key={`y-${f.value}`} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
          ))}
        </SelectGroup>
      )}
      <SelectGroup>
        <SelectLabel>Library fonts</SelectLabel>
        {library.map((f) => (
          <SelectItem key={`l-${f.value}`} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function startSlot(hhmm: string, extraDays: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const [hh, mm] = (hhmm || "18:15").split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(hh) ? hh : 18, Number.isFinite(mm) ? mm : 15, 0, 0);
  d.setDate(d.getDate() + extraDays);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

export default function UniquePosts() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) ?? null, [presets, presetId]);

  const [clinic, setClinic] = useState("");
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [headFont, setHeadFont] = useState(DEFAULT_HEAD);
  const [bodyFont, setBodyFont] = useState(DEFAULT_BODY);
  const [upper, setUpper] = useState(true);
  const [scrim, setScrim] = useState(35);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  const [pool, setPool] = useState<PoolPhoto[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newDesign, setNewDesign] = useState<UniId>("book");
  const [chooser, setChooser] = useState<{ postId: string; slot: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleIds, setScheduleIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoogleFonts();
    const bump = () => setFontsTick((n) => n + 1);
    window.addEventListener(FONTS_CHANGED_EVENT, bump);
    void syncSharedFonts();
    return () => window.removeEventListener(FONTS_CHANGED_EVENT, bump);
  }, []);

  const chooseClient = (id: number) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    let saved: Partial<ClientSettings> = {};
    try { saved = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, Partial<ClientSettings>>)[String(id)] ?? {}; } catch { /* none */ }
    setClinic(p?.name ?? "");
    setOwner(saved.owner ?? "");
    setRole(saved.role ?? "Owner");
    setArea(saved.area ?? p?.seoArea ?? "");
    setHeadFont(saved.headFont ?? p?.stylishCoverHeadlineFont ?? DEFAULT_HEAD);
    setBodyFont(saved.bodyFont ?? p?.stylishCoverSubtitleFont ?? DEFAULT_BODY);
    setUpper(saved.upper ?? true);
    setScrim(saved.scrim ?? 35);
    setPosts([]);
  };

  useEffect(() => {
    if (!presetId) return;
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, ClientSettings>;
      all[String(presetId)] = { owner, role, area, headFont, bodyFont, upper, scrim };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [presetId, owner, role, area, headFont, bodyFont, upper, scrim]);

  useEffect(() => {
    let live = true;
    setLogo(null);
    if (preset?.logoUrl) loadImg(preset.logoUrl).then((i) => { if (live) setLogo(i); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.id, preset?.logoUrl]);

  // -- fonts ---------------------------------------------------------------
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
    if (added.length) {
      toast.success(`Added ${added.join(", ")}. They are in every font list now.`);
      setFontsTick((n) => n + 1);
    } else toast.error("Those files were not fonts I could read. Try .otf, .ttf or .woff");
  };

  // -- photos --------------------------------------------------------------
  const addToPool = useCallback((files: File[]) => {
    setPool((old) => [...old, ...files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
  }, []);

  const removeFromPool = (i: number) => {
    setPool((old) => old.filter((_, k) => k !== i));
    setPosts((list) => list.map((p) => ({ ...p, photos: p.photos.map((x) => (x == null ? null : x === i ? null : x > i ? x - 1 : x)) })));
  };

  // -- posts ---------------------------------------------------------------
  const fill: Fill = useMemo(() => ({ owner: owner.trim(), clinic: clinic.trim(), area: area.trim(), role: role.trim() }), [owner, clinic, area, role]);
  const look: Look = useMemo(() => ({ fill, headFont, bodyFont, upper, scrim, logo, pool }), [fill, headFont, bodyFont, upper, scrim, logo, pool]);

  const makePost = (design: UniId, cursor: number): Post => {
    const n = pool.length;
    return {
      id: uid(), design,
      text: { ...UNIQUE_BY_ID[design].defaults },
      photos: [0, 1, 2].map((k) => (n ? (cursor + k) % n : null)),
      focus: {}, slides: ["", ""], cta: "", caption: "", hashtags: [], selected: true, busy: false, fresh: false,
    };
  };

  const planAll = () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const start = (preset.id ?? 0) % UNIQUE.length;
    const list: Post[] = [];
    for (let k = 0; k < UNIQUE.length; k++) list.push(makePost(UNIQUE[(start + k) % UNIQUE.length].id, k * SLIDES));
    setPosts(list);
    toast.success(`${UNIQUE.length} Unique posts planned. Now write the words.`);
  };

  const addPost = () => setPosts((l) => [...l, makePost(newDesign, l.length * SLIDES)]);

  const patchPost = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const setText = (id: string, key: string, value: string) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, text: { ...p.text, [key]: value } } : p)));
  const setSlide = (id: string, i: number, value: string) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, slides: p.slides.map((s, k) => (k === i ? value : s)) } : p)));
  const setFocus = (id: string, key: string, f: Focus) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, focus: { ...p.focus, [key]: f } } : p)));

  // -- copy ----------------------------------------------------------------
  const writeCopy = async (post: Post) => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const def = UNIQUE_BY_ID[post.design];
    const t = resolvedText(post, fill);
    patchPost(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/unique/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: clinic.trim() || preset.name,
          ownerName: owner.trim(),
          role: role.trim(),
          area: area.trim(),
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          idea: def.idea,
          cover: def.fields.map((fd) => `${fd.label}: ${t[fd.key] ?? ""}`).join("\n"),
          fresh: post.fresh,
          fields: post.fresh ? def.fields.map((fd) => ({ key: fd.key, label: fd.label, words: fd.words, current: t[fd.key] ?? "" })) : [],
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      const foot = preset.captionFootnote?.trim();
      let caption: string = noDashes(data.caption ?? "");
      if (foot && !caption.includes(foot)) caption += `\n\n${foot}`;
      const cover: Record<string, string> = {};
      if (post.fresh && data.cover && typeof data.cover === "object") {
        for (const fd of def.fields) {
          const v = (data.cover as Record<string, unknown>)[fd.key];
          if (typeof v === "string" && v.trim()) cover[fd.key] = noDashes(v);
        }
      }
      setPosts((l) => l.map((p) => p.id === post.id ? {
        ...p, busy: false, text: { ...p.text, ...cover },
        slides: [data.slide2, data.slide3].map((x) => noDashes(x ?? "")),
        cta: noDashes(data.cta ?? ""), caption,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      } : p));
    } catch (e) {
      patchPost(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const writeAll = async () => {
    const targets = posts.filter((p) => p.selected);
    if (!targets.length) { toast.error("Tick at least one post first"); return; }
    setBusy("copy");
    const toastId = toast.loading(`Writing 0 of ${targets.length}`);
    let done = 0;
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift()!;
        await writeCopy(p);
        done++;
        toast.loading(`Writing ${done} of ${targets.length}`, { id: toastId });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    toast.success("All written. Have a read and tweak anything you like.", { id: toastId });
    setBusy(null);
  };

  // -- export and schedule --------------------------------------------------
  const renderPost = async (post: Post): Promise<HTMLCanvasElement[]> => {
    await ensureFonts(headFont, bodyFont);
    const out: HTMLCanvasElement[] = [];
    for (let n = 0; n < SLIDES; n++) {
      const c = document.createElement("canvas");
      await renderSlide(post, n, look, c, 1);
      out.push(c);
      await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  };

  const fullCaption = (p: Post) => `${p.caption.trim()}\n\n${p.hashtags.join(" ")}`.trim();
  const selected = posts.filter((p) => p.selected);

  const download = async () => {
    if (!selected.length) { toast.error("Tick at least one post first"); return; }
    setBusy("zip");
    try {
      const zip = new JSZip();
      for (const post of selected) {
        const folder = `unique-${String(posts.indexOf(post) + 1).padStart(2, "0")}-${post.design}`;
        const cs = await renderPost(post);
        for (let i = 0; i < cs.length; i++) {
          const blob = await new Promise<Blob | null>((res) => cs[i].toBlob((b) => res(b), "image/png"));
          if (blob) zip.file(`${folder}/slide-${i + 1}.png`, blob);
        }
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, fullCaption(post));
      }
      saveAs(await zip.generateAsync({ type: "blob" }), `unique-${(clinic || "client").replace(/\s+/g, "")}-${Date.now()}.zip`);
      toast.success(`${selected.length} post${selected.length !== 1 ? "s" : ""} downloaded at 1080 x 1350`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    if (!selected.length) { toast.error("Tick at least one post first"); return; }
    if (!clinic.trim() || !owner.trim() || !area.trim()) { toast.error("Fill in the business name, owner first name and area first, so no placeholder goes out."); return; }
    const missing = selected.filter((p) => !p.caption.trim() || p.slides.some((s) => !s.trim()));
    if (missing.length) { toast.error(`${missing.length} ticked post${missing.length > 1 ? "s have" : " has"} no words yet. Press Write first.`); return; }
    setBusy("schedule");
    const toastId = toast.loading("Getting the pictures ready");
    try {
      const items: SchedulePostPayload[] = [];
      for (const [k, post] of selected.entries()) {
        toast.loading(`Getting post ${k + 1} of ${selected.length} ready`, { id: toastId });
        const cs = await renderPost(post);
        const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `unique-${post.design}-${i + 1}-${Date.now()}.png`));
        items.push({ title: `${UNIQUE_BY_ID[post.design].name} · ${clinic}`, caption: fullCaption(post), imageUrls: urls });
      }
      toast.dismiss(toastId);
      setScheduleItems(items);
      setScheduleIds(selected.map((p) => p.id));
      setScheduleStart(startSlot((preset as unknown as { defaultPostTime?: string }).defaultPostTime ?? "18:15", 2));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get those ready", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  const chooserPost = chooser ? posts.find((p) => p.id === chooser.postId) : null;
  const colourInput = (value: string, onChange: (v: string) => void) => (
    <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border/40 bg-transparent" />
  );

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Sparkle className="w-5 h-5 text-rose-400" />
        <h1 className="font-bold text-lg">Treatments</h1>
        <span className="text-sm text-muted-foreground">Three slide Unique carousels, floating through the month</span>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border/30 p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Client</span>
              <Select value={presetId ? String(presetId) : ""} onValueChange={(v) => chooseClient(Number(v))}>
                <SelectTrigger className="bg-muted/30 border-border/40">
                  <SelectValue placeholder={presetsLoading ? "Loading…" : "Choose a client"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {presets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
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

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              Headlines in capitals
            </label>
            <label className="flex items-center gap-2">
              Photo dimming on slides 2 and 3
              <input type="range" min={0} max={70} value={scrim} onChange={(e) => setScrim(Number(e.target.value))} />
              <span className="text-muted-foreground w-8">{scrim}%</span>
            </label>
            <Button variant="outline" size="sm" onClick={() => fontFileRef.current?.click()}>
              <Type className="w-4 h-4 mr-1.5" /> Upload fonts
            </Button>
            <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void addFonts(fs); }} />
            <span className="text-muted-foreground">Fonts you upload here appear in every tool.</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/30 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Approved photos</h2>
            <span className="text-sm text-muted-foreground">Each post uses three: one on the cover and two full bleed behind the words. Photos are shared out so none repeats while there are enough to go round.</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <ApprovedImagesPicker clientName={preset?.name} onAddImages={addToPool} skipBackgroundRemoval large label="Add approved photos" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-4 h-4 mr-1.5" /> Upload from my device
              </Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) addToPool(fs); }} />
            </div>
          </div>
          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet. Add some and every slide fills itself in. Drag a photo inside any preview to move it, double click to put it back.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pool.map((p, i) => (
                <div key={p.id} className="relative group">
                  <img src={p.url} alt="" className="h-20 w-16 object-cover rounded-md border border-border/30" />
                  <button type="button" onClick={() => removeFromPool(i)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border/50">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button onClick={planAll} disabled={!preset}>
            <CalendarClock className="w-4 h-4 mr-1.5" /> Plan all 23
          </Button>
          <div className="flex items-center gap-2">
            <Select value={newDesign} onValueChange={(v) => setNewDesign(v as UniId)}>
              <SelectTrigger className="w-56 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {UNIQUE.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addPost} disabled={!preset}><Plus className="w-4 h-4 mr-1.5" /> Add one</Button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setPosts((l) => l.map((p) => ({ ...p, selected: !l.every((x) => x.selected) })))} disabled={!posts.length}>
              Tick / untick all
            </Button>
            <Button onClick={writeAll} disabled={!!busy || !selected.length}>
              {busy === "copy" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />} Write ticked
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
          <p className="text-muted-foreground text-sm">
            Choose a client, add their approved photos and press Plan all 23. Each client starts on a different design. The cover wording is from the Canva files and you can change any of it, or tick fresh cover words on a post and I will write new ones. {"{owner}"}, {"{clinic}"}, {"{area}"} and {"{role}"} fill in from the boxes above. Unique posts float, so scheduling starts two days from now with a three day gap you can change.
          </p>
        )}

        <div className="space-y-5">
          {posts.map((post, pi) => {
            const def = UNIQUE_BY_ID[post.design];
            const slotLabels = ["Cover photo", "Slide 2 photo", "Slide 3 photo"];
            const pal = post.pal ?? def.palette;
            return (
              <article key={post.id} className="rounded-2xl border border-border/30 p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={post.selected} onChange={(e) => patchPost(post.id, { selected: e.target.checked })} />
                  <h2 className="font-semibold">Post {pi + 1}</h2>
                  <Select value={post.design} onValueChange={(v) => { const d = v as UniId; patchPost(post.id, { design: d, text: { ...UNIQUE_BY_ID[d].defaults }, pal: undefined }); }}>
                    <SelectTrigger className="w-72 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {UNIQUE.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={post.fresh} onChange={(e) => patchPost(post.id, { fresh: e.target.checked })} />
                    Write fresh cover words too
                  </label>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" disabled={post.busy || !!busy} onClick={() => writeCopy(post)}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      {post.slides[0] ? "Rewrite" : "Write"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((x) => x.id !== post.id))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {PALETTE_LABELS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input type="color" value={pal[key]} onChange={(e) => patchPost(post.id, { pal: { ...pal, [key]: e.target.value } })} className="h-6 w-8 rounded border border-border/40 bg-transparent" />
                      {label}
                    </label>
                  ))}
                  {post.pal && <button type="button" className="underline" onClick={() => patchPost(post.id, { pal: undefined })}>reset colours</button>}
                </div>

                <div className="grid grid-cols-3 gap-3 items-start max-w-3xl">
                  {[0, 1, 2].map((n) => (
                    <div key={n} className="space-y-1.5">
                      <SlidePreview post={post} n={n} look={look} onFocus={(key, f) => setFocus(post.id, key, f)} />
                      <button type="button" onClick={() => setChooser({ postId: post.id, slot: n })} className="flex items-center gap-2 text-xs rounded-lg border border-border/40 px-2 py-1 hover:border-border w-full">
                        {post.photos[n] != null && pool[post.photos[n]!] ? <img src={pool[post.photos[n]!].url} alt="" className="h-9 w-7 object-cover rounded" /> : <span className="h-9 w-7 rounded bg-muted/40" />}
                        {slotLabels[n]}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-2 content-start">
                    {def.fields.map((fd) => (
                      <label key={fd.key} className={`block ${(fd.rows ?? 1) > 1 ? "sm:col-span-2" : ""}`}>
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{fd.label}</span>
                        {(fd.rows ?? 1) > 1 ? (
                          <Textarea rows={2} value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                        ) : (
                          <Input value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <label key={i} className="block">
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide {i + 2} words</span>
                        <Textarea rows={3} value={post.slides[i]} onChange={(e) => setSlide(post.id, i, e.target.value)} placeholder={i === 0 ? "Press Write and I will carry on from the cover" : undefined} />
                      </label>
                    ))}
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide 5 question (the engagement CTA)</span>
                      <Input value={post.cta} onChange={(e) => patchPost(post.id, { cta: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                      <Textarea rows={6} value={post.caption} onChange={(e) => patchPost(post.id, { caption: e.target.value })} />
                    </label>
                    {post.hashtags.length > 0 && <p className="text-sm text-rose-300 break-words">{post.hashtags.join(" ")}</p>}
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
              <h3 className="font-semibold">Choose a photo</h3>
              <button type="button" className="ml-auto" onClick={() => setChooser(null)}><X className="w-5 h-5" /></button>
            </div>
            {pool.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add approved photos first.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {pool.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => {
                    const photos = [...chooserPost.photos];
                    photos[chooser.slot] = i;
                    patchPost(chooserPost.id, { photos, focus: { ...chooserPost.focus, [focusKeys[chooser.slot]]: DEFAULT_FOCUS } });
                    setChooser(null);
                  }}>
                    <img src={p.url} alt="" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-rose-400" />
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
          initialGapMinutes={3 * 1440}
          keepClockTime
          sourceTool="unique"
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
