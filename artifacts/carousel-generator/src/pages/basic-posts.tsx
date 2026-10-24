import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Download, ImagePlus, LayoutTemplate, Loader2, Plus, Sparkles, Trash2, Type, X } from "lucide-react";
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
import {
  COVERS, COVER_BY_ID, DEFAULT_FOCUS, H, W, drawCover, drawPhotoSlide, fillTokens, makeColours,
  type CoverId, type Fill, type Focus, type Slot,
} from "@/lib/basic-covers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SETTINGS_KEY = "basic-posts-client-v1";
const DEFAULT_HEAD = "'Anton', sans-serif";
const DEFAULT_BODY = "'Poppins', sans-serif";

type PoolPhoto = { id: string; file: File; url: string };

type Post = {
  id: string;
  cover: CoverId;
  text: Record<string, string>;
  photos: (number | null)[]; // pool index for [cover photo 1, cover photo 2, slide 2, slide 3]
  focus: Record<string, Focus>; // c0, c1, s2, s3
  slide2: string;
  slide3: string;
  cta: string;
  caption: string;
  hashtags: string[];
  selected: boolean;
  busy: boolean;
  bg?: string;
};

type ClientSettings = { owner: string; role: string; area: string; bg: string; headFont: string; bodyFont: string; upper: boolean; scrim: number };

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
  bg: string;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  scrim: number;
  logo: HTMLImageElement | null;
  pool: PoolPhoto[];
};

const focusKeys = ["c0", "c1", "s2", "s3"];

function resolvedText(post: Post, fill: Fill): Record<string, string> {
  const def = COVER_BY_ID[post.cover];
  return Object.fromEntries(def.fields.map((fd) => [fd.key, fillTokens(post.text[fd.key] ?? def.defaults[fd.key] ?? "", fill)]));
}

// Draws slide n (0 cover, 1, 2) of a post onto a canvas at the given scale. Returns where the photos landed.
async function renderSlide(post: Post, n: number, look: Look, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const colours = makeColours(post.bg || look.bg);
  const poolAt = (i: number | null | undefined) => (i == null ? null : look.pool[i] ?? null);
  const bmpOf = async (i: number | null | undefined) => {
    const p = poolAt(i);
    return p ? await getBitmap(p) : null;
  };
  if (n === 0) {
    const def = COVER_BY_ID[post.cover];
    const photos = [await bmpOf(post.photos[0]), def.photos > 1 ? await bmpOf(post.photos[1]) : null];
    return drawCover(ctx, {
      cover: post.cover,
      text: resolvedText(post, look.fill),
      colours,
      headFont: look.headFont,
      bodyFont: look.bodyFont,
      upper: look.upper,
      photos,
      focus: [post.focus.c0 ?? DEFAULT_FOCUS, post.focus.c1 ?? DEFAULT_FOCUS],
      logo: look.logo,
    });
  }
  const idx = n === 1 ? 2 : 3;
  return drawPhotoSlide(ctx, {
    text: fillTokens(n === 1 ? post.slide2 : post.slide3, look.fill),
    cta: n === 2 ? fillTokens(post.cta, look.fill) : "",
    colours,
    bodyFont: look.bodyFont,
    headFont: look.headFont,
    photo: await bmpOf(post.photos[idx]),
    focus: post.focus[focusKeys[idx]] ?? DEFAULT_FOCUS,
    scrim: look.scrim,
    logo: look.logo,
    arrow: n === 1,
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

  const keyFor = (slot: Slot) => (n === 0 ? `c${slot.i}` : n === 1 ? "s2" : "s3");
  const photoIdx = (slot: Slot) => (n === 0 ? post.photos[slot.i] : n === 1 ? post.photos[2] : post.photos[3]);

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
      style={{ aspectRatio: "3 / 4" }}
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

function nextWednesday(hhmm: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const [hh, mm] = (hhmm || "18:15").split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(hh) ? hh : 18, Number.isFinite(mm) ? mm : 15, 0, 0);
  while (d.getDay() !== 3 || d.getTime() <= Date.now() + 5 * 60000) d.setDate(d.getDate() + 1);
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

export default function BasicPosts() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) ?? null, [presets, presetId]);

  // Client details, remembered per client in this browser
  const [clinic, setClinic] = useState("");
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [bg, setBg] = useState("#14195c");
  const [headFont, setHeadFont] = useState(DEFAULT_HEAD);
  const [bodyFont, setBodyFont] = useState(DEFAULT_BODY);
  const [upper, setUpper] = useState(true);
  const [scrim, setScrim] = useState(35);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  const [pool, setPool] = useState<PoolPhoto[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [writeCover, setWriteCover] = useState(false);
  const [newCover, setNewCover] = useState<CoverId>("starthere");
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

  // Choosing a client loads what was saved for them, otherwise their own colour, area and fonts.
  const chooseClient = (id: number) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    let saved: Partial<ClientSettings> = {};
    try { saved = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, Partial<ClientSettings>>)[String(id)] ?? {}; } catch { /* none */ }
    setClinic(p?.name ?? "");
    setOwner(saved.owner ?? "");
    setRole(saved.role ?? "Owner");
    setArea(saved.area ?? p?.seoArea ?? "");
    setBg(saved.bg ?? p?.accentColor ?? p?.pageColor ?? "#14195c");
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
      all[String(presetId)] = { owner, role, area, bg, headFont, bodyFont, upper, scrim };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [presetId, owner, role, area, bg, headFont, bodyFont, upper, scrim]);

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
    // photos after the removed one slide down a place, and any post that used it goes back to empty
    setPosts((list) => list.map((p) => ({ ...p, photos: p.photos.map((x) => (x == null ? null : x === i ? null : x > i ? x - 1 : x)) })));
  };

  // -- posts ---------------------------------------------------------------
  const fill: Fill = useMemo(() => ({ owner: owner.trim(), clinic: clinic.trim(), area: area.trim(), role: role.trim() }), [owner, clinic, area, role]);
  const look: Look = useMemo(() => ({ fill, bg, headFont, bodyFont, upper, scrim, logo, pool }), [fill, bg, headFont, bodyFont, upper, scrim, logo, pool]);

  const makePost = (cover: CoverId, cursor: number): Post => {
    const def = COVER_BY_ID[cover];
    const n = pool.length;
    const take = (k: number) => (n ? (cursor + k) % n : null);
    return {
      id: uid(),
      cover,
      text: { ...def.defaults },
      photos: [take(0), def.photos > 1 ? take(1) : null, take(def.photos), take(def.photos + 1)],
      focus: {},
      slide2: "",
      slide3: "",
      cta: "",
      caption: "",
      hashtags: [],
      selected: true,
      busy: false,
    };
  };

  const planWeeks = () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const start = (preset.id ?? 0) % COVERS.length; // each client starts on a different cover
    let cursor = 0;
    const list: Post[] = [];
    for (let k = 0; k < COVERS.length; k++) {
      const def = COVERS[(start + k) % COVERS.length];
      list.push(makePost(def.id, cursor));
      cursor += def.photos + 2;
    }
    setPosts(list);
    toast.success("12 weeks planned, one every other Wednesday. Now write the words.");
  };

  const addPost = () => {
    const def = COVER_BY_ID[newCover];
    const cursor = posts.reduce((n, p) => n + COVER_BY_ID[p.cover].photos + 2, 0);
    setPosts((l) => [...l, makePost(def.id, cursor)]);
  };

  const patchPost = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const setText = (id: string, key: string, value: string) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, text: { ...p.text, [key]: value } } : p)));
  const setFocus = (id: string, key: string, f: Focus) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, focus: { ...p.focus, [key]: f } } : p)));

  const changeCover = (post: Post, cover: CoverId) => {
    const def = COVER_BY_ID[cover];
    const spare = post.photos[2] ?? post.photos[0] ?? null;
    patchPost(post.id, {
      cover,
      text: { ...def.defaults },
      photos: [post.photos[0] ?? spare, def.photos > 1 ? post.photos[1] ?? spare : null, post.photos[2], post.photos[3]],
    });
  };

  // -- copy ----------------------------------------------------------------
  const writeCopy = async (post: Post) => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const def = COVER_BY_ID[post.cover];
    patchPost(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/basic-posts/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: clinic.trim() || preset.name,
          ownerName: owner.trim(),
          role: role.trim(),
          area: area.trim(),
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          coverName: def.name,
          coverIdea: def.idea,
          cover: resolvedText(post, fill),
          fields: def.fields.map((fd) => ({ key: fd.key, label: fd.label, words: fd.words })),
          writeCover,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The words would not write, try again");
      const foot = preset.captionFootnote?.trim();
      let caption: string = noDashes(data.caption ?? "");
      if (foot && !caption.includes(foot)) caption += `\n\n${foot}`;
      setPosts((l) =>
        l.map((p) =>
          p.id === post.id
            ? {
                ...p,
                busy: false,
                slide2: noDashes(data.slide2 ?? ""),
                slide3: noDashes(data.slide3 ?? ""),
                cta: noDashes(data.cta ?? ""),
                caption,
                hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
                text: data.cover ? { ...p.text, ...data.cover } : p.text,
              }
            : p,
        ),
      );
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
    for (let n = 0; n < 3; n++) {
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
        const folder = `week-${String(posts.indexOf(post) + 1).padStart(2, "0")}-${COVER_BY_ID[post.cover].id}`;
        const cs = await renderPost(post);
        for (let i = 0; i < cs.length; i++) {
          const blob = await new Promise<Blob | null>((res) => cs[i].toBlob((b) => res(b), "image/png"));
          if (blob) zip.file(`${folder}/slide-${i + 1}.png`, blob);
        }
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, fullCaption(post));
      }
      saveAs(await zip.generateAsync({ type: "blob" }), `basic-posts-${(clinic || "client").replace(/\s+/g, "")}-${Date.now()}.zip`);
      toast.success(`${selected.length} post${selected.length !== 1 ? "s" : ""} downloaded at 1080 x 1440`);
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
    const missing = selected.filter((p) => !p.caption.trim() || !p.slide2.trim() || !p.slide3.trim());
    if (missing.length) { toast.error(`${missing.length} ticked post${missing.length > 1 ? "s have" : " has"} no words yet. Press Write first.`); return; }
    setBusy("schedule");
    const toastId = toast.loading("Getting the pictures ready");
    try {
      const items: SchedulePostPayload[] = [];
      for (const [k, post] of selected.entries()) {
        toast.loading(`Getting post ${k + 1} of ${selected.length} ready`, { id: toastId });
        const cs = await renderPost(post);
        const urls = await uploadPngs(cs.map((c) => c.toDataURL("image/png")), cs.map((_, i) => `basic-${post.cover}-${i + 1}-${Date.now()}.png`));
        items.push({ title: `${COVER_BY_ID[post.cover].name} · ${clinic}`, caption: fullCaption(post), imageUrls: urls });
      }
      toast.dismiss(toastId);
      setScheduleItems(items);
      setScheduleIds(selected.map((p) => p.id));
      setScheduleStart(nextWednesday((preset as unknown as { defaultPostTime?: string }).defaultPostTime ?? "18:15"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get those ready", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  const chooserPost = chooser ? posts.find((p) => p.id === chooser.postId) : null;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <LayoutTemplate className="w-5 h-5 text-sky-400" />
        <h1 className="font-bold text-lg">BASIC posts</h1>
        <span className="text-sm text-muted-foreground">Three slide trust carousels, one every other Wednesday</span>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
        {/* ------------------------------- set up ------------------------------- */}
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
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Background colour</span>
              <div className="flex items-center gap-2">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(bg) ? bg : "#14195c"} onChange={(e) => setBg(e.target.value)} className="h-9 w-12 rounded border border-border/40 bg-transparent" />
                <Input value={bg} onChange={(e) => setBg(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
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

        {/* ------------------------------- photos ------------------------------- */}
        <section className="rounded-2xl border border-border/30 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Approved photos</h2>
            <span className="text-sm text-muted-foreground">Slides 2 and 3 are full bleed photos. Slide 1 never repeats a photo while there are enough to go round.</span>
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

        {/* ------------------------------ toolbar ------------------------------ */}
        <section className="flex flex-wrap items-center gap-3">
          <Button onClick={planWeeks} disabled={!preset}>
            <CalendarClock className="w-4 h-4 mr-1.5" /> Plan 12 weeks
          </Button>
          <div className="flex items-center gap-2">
            <Select value={newCover} onValueChange={(v) => setNewCover(v as CoverId)}>
              <SelectTrigger className="w-56 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {COVERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addPost} disabled={!preset}><Plus className="w-4 h-4 mr-1.5" /> Add one</Button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={writeCover} onChange={(e) => setWriteCover(e.target.checked)} />
              Write fresh cover words too
            </label>
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
              {busy === "schedule" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />} Schedule ticked, alternate Wednesdays
            </Button>
          </div>
        </section>

        {posts.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Choose a client, add their approved photos and press Plan 12 weeks. Each client starts on a different cover so no two feeds match. In the words, {"{owner}"}, {"{clinic}"}, {"{area}"} and {"{role}"} fill in from the boxes above.
          </p>
        )}

        {/* -------------------------------- posts -------------------------------- */}
        <div className="space-y-5">
          {posts.map((post, pi) => {
            const def = COVER_BY_ID[post.cover];
            const slotLabels = [...Array(def.photos).keys()].map((k) => `Cover photo${def.photos > 1 ? ` ${k + 1}` : ""}`).concat(["Slide 2 photo", "Slide 3 photo"]);
            const slotIndex = [...Array(def.photos).keys()].concat([2, 3]);
            return (
              <article key={post.id} className="rounded-2xl border border-border/30 p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={post.selected} onChange={(e) => patchPost(post.id, { selected: e.target.checked })} />
                  <h2 className="font-semibold">Post {pi + 1}</h2>
                  <Select value={post.cover} onValueChange={(v) => changeCover(post, v as CoverId)}>
                    <SelectTrigger className="w-60 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COVERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Colour for this post
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(post.bg || bg) ? post.bg || bg : "#14195c"} onChange={(e) => patchPost(post.id, { bg: e.target.value })} className="h-7 w-9 rounded border border-border/40 bg-transparent" />
                    {post.bg && <button type="button" className="underline" onClick={() => patchPost(post.id, { bg: undefined })}>reset</button>}
                  </label>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" disabled={post.busy || !!busy} onClick={() => writeCopy(post)}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      {post.slide2 ? "Rewrite" : "Write"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((x) => x.id !== post.id))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid grid-cols-3 gap-3 content-start items-start">
                    {[0, 1, 2].map((n) => (
                      <SlidePreview key={n} post={post} n={n} look={look} onFocus={(key, f) => setFocus(post.id, key, f)} />
                    ))}
                    <div className="col-span-3 flex flex-wrap gap-3">
                      {slotLabels.map((label, k) => {
                        const pidx = post.photos[slotIndex[k]];
                        const p = pidx != null ? pool[pidx] : null;
                        return (
                          <button key={label} type="button" onClick={() => setChooser({ postId: post.id, slot: slotIndex[k] })} className="flex items-center gap-2 text-xs rounded-lg border border-border/40 px-2 py-1 hover:border-border">
                            {p ? <img src={p.url} alt="" className="h-9 w-7 object-cover rounded" /> : <span className="h-9 w-7 rounded bg-muted/40" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {def.fields.map((fd) => (
                        <label key={fd.key} className={`block ${(fd.rows ?? 1) > 1 ? "sm:col-span-2" : ""}`}>
                          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{fd.label}</span>
                          {(fd.rows ?? 1) > 1 ? (
                            <Textarea rows={fd.rows} value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                          ) : (
                            <Input value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                          )}
                        </label>
                      ))}
                    </div>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide 2 words</span>
                      <Textarea rows={3} value={post.slide2} onChange={(e) => patchPost(post.id, { slide2: e.target.value })} placeholder="Press Write and I will carry on from the cover" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide 3 words</span>
                      <Textarea rows={3} value={post.slide3} onChange={(e) => patchPost(post.id, { slide3: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide 3 question (the engagement CTA)</span>
                      <Input value={post.cta} onChange={(e) => patchPost(post.id, { cta: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                      <Textarea rows={6} value={post.caption} onChange={(e) => patchPost(post.id, { caption: e.target.value })} />
                    </label>
                    {post.hashtags.length > 0 && <p className="text-sm text-sky-300 break-words">{post.hashtags.join(" ")}</p>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* photo chooser */}
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
                    const key = focusKeys[chooser.slot];
                    patchPost(chooserPost.id, { photos, focus: { ...chooserPost.focus, [key]: DEFAULT_FOCUS } });
                    setChooser(null);
                  }}>
                    <img src={p.url} alt="" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-sky-400" />
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
          initialGapMinutes={14 * 1440}
          keepClockTime
          sourceTool="basic-posts"
          presets={presets.map((x) => ({ id: x.id, name: x.name }))}
          onClose={() => setScheduleItems(null)}
          onSaved={() => {
            setPosts((l) => l.filter((p) => !scheduleIds.includes(p.id)));
            setScheduleItems(null);
            toast.success("Scheduled on alternate Wednesdays. Go and put the kettle on.");
          }}
        />
      )}
    </div>
  );
}
