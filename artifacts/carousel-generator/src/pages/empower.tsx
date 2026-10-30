import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Crown, Download, ImagePlus, Loader2, Plus, Sparkles, Type, X } from "lucide-react";
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
import { type Fill } from "@/lib/basic-covers";
import { DEFAULT_FOCUS, LOGO_POSITIONS, type Focus, type LogoPos, type Slot } from "@/lib/xmas-designs";
import {
  EMPOWER, EMPOWER_BY_ID, FOILS, XH, XW, drawEmpower, leftoverPlaceholders, resolveEmpowerText,
  type EKey, type EMetal, type EPalette,
} from "@/lib/empower-designs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SETTINGS_KEY = "empower-client-v1";
const DEFAULT_HEAD = "'Anton', sans-serif";
const DEFAULT_BODY = "'Poppins', sans-serif";

type PoolPhoto = { id: string; file: File; url: string };

type Post = {
  id: string;
  design: string;
  text: Record<string, string>;
  photo: number | null;
  focus: Focus;
  caption: string;
  hashtags: string[];
  selected: boolean;
  busy: boolean;
  palette?: Partial<EPalette>;
  metal?: EMetal;
  logoPos?: LogoPos;
};

type ClientSettings = {
  owner: string; role: string; area: string; headFont: string; bodyFont: string; upper: boolean; logoPos: LogoPos;
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
// Drawing a whole post
// ---------------------------------------------------------------------------

type Look = {
  fill: Fill;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  logoPos: LogoPos;
  logo: HTMLImageElement | null;
  pool: PoolPhoto[];
};

async function renderPost(post: Post, look: Look, canvas: HTMLCanvasElement, scale: number): Promise<Slot[]> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.round(XW * scale);
  canvas.height = Math.round(XH * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const p = post.photo != null ? look.pool[post.photo] ?? null : null;
  const def = EMPOWER_BY_ID[post.design];
  return drawEmpower(ctx, {
    design: post.design,
    text: resolveEmpowerText(def, post.text, look.fill),
    palette: { ...def.palette, ...(post.palette ?? {}) },
    metal: post.metal ?? {},
    headFont: look.headFont,
    bodyFont: look.bodyFont,
    upper: look.upper,
    photo: p ? await getBitmap(p) : null,
    focus: post.focus,
    logo: look.logo,
    logoPos: post.logoPos ?? look.logoPos,
  });
}

// ---------------------------------------------------------------------------
// One preview canvas, draggable
// ---------------------------------------------------------------------------

function Preview({ post, look, onFocus }: { post: Post; look: Look; onFocus: (f: Focus) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slots = useRef<Slot[]>([]);
  const drag = useRef<{ slot: Slot; x: number; y: number; f: Focus; ox: number; oy: number } | null>(null);
  const run = useRef(0);

  useEffect(() => {
    const my = ++run.current;
    const t = setTimeout(async () => {
      await ensureFonts(look.headFont, look.bodyFont);
      if (my !== run.current || !ref.current) return;
      const c = document.createElement("canvas");
      const s = await renderPost(post, look, c, 0.45);
      if (my !== run.current || !ref.current) return;
      slots.current = s;
      const out = ref.current;
      out.width = c.width;
      out.height = c.height;
      out.getContext("2d")!.drawImage(c, 0, 0);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, look]);

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

  const onDown = async (e: React.PointerEvent) => {
    const p = toCanvas(e);
    const slot = hit(p.x, p.y);
    if (!slot || post.photo == null) return;
    const ph = look.pool[post.photo];
    const bmp = ph ? await getBitmap(ph) : null;
    if (!bmp) return;
    const sc = Math.max(slot.w / bmp.width, slot.h / bmp.height);
    drag.current = { slot, x: p.x, y: p.y, f: post.focus, ox: bmp.width * sc - slot.w, oy: bmp.height * sc - slot.h };
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
    <canvas
      ref={ref}
      width={Math.round(XW * 0.45)}
      height={Math.round(XH * 0.45)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={() => { drag.current = null; }}
      onDoubleClick={(e) => {
        const p = toCanvas(e as unknown as React.PointerEvent);
        if (hit(p.x, p.y)) onFocus(DEFAULT_FOCUS);
      }}
      className="w-full rounded-lg border border-border/30 bg-muted/20 touch-none cursor-grab active:cursor-grabbing"
      style={{ aspectRatio: `${XW} / ${XH}` }}
    />
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

// Empower goes out every Tuesday at 8pm. The first one is the next Tuesday that is still ahead of us.
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

export default function Empower() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) ?? null, [presets, presetId]);

  const [clinic, setClinic] = useState("");
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [headFont, setHeadFont] = useState(DEFAULT_HEAD);
  const [bodyFont, setBodyFont] = useState(DEFAULT_BODY);
  const [upper, setUpper] = useState(false);
  const [logoPos, setLogoPos] = useState<LogoPos>("off");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  const [pool, setPool] = useState<PoolPhoto[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newDesign, setNewDesign] = useState<string>(EMPOWER[0].id);
  const [chooser, setChooser] = useState<string | null>(null);
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
      if (!document.getElementById("empower-extra-fonts")) {
        const l = document.createElement("link");
        l.id = "november-extra-fonts";
        l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap";
        document.head.appendChild(l);
      }
    } catch { /* fonts only affect how it looks */ }
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
    setUpper(saved.upper ?? false);
    setLogoPos(saved.logoPos ?? "off");
    setPosts([]);
  };

  useEffect(() => {
    if (!presetId) return;
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Record<string, ClientSettings>;
      all[String(presetId)] = { owner, role, area, headFont, bodyFont, upper, logoPos };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [presetId, owner, role, area, headFont, bodyFont, upper, logoPos]);

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

  // photos: every empty post picks up the next photo, so dropping photos in fills the lot
  const addToPool = useCallback((files: File[]) => {
    setPool((old) => [...old, ...files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
  }, []);
  useEffect(() => {
    if (!pool.length) return;
    setPosts((list) => {
      let next = 0;
      const used = new Set(list.map((p) => p.photo).filter((v): v is number => v != null));
      return list.map((p) => {
        if (p.photo != null && p.photo < pool.length) return p;
        while (used.has(next) && next < pool.length) next++;
        const pick = next < pool.length ? next : list.indexOf(p) % pool.length;
        used.add(pick);
        return { ...p, photo: pick, focus: DEFAULT_FOCUS };
      });
    });
  }, [pool.length]);
  const removeFromPool = (i: number) => {
    setPool((old) => old.filter((_, k) => k !== i));
    setPosts((list) => list.map((p) => ({ ...p, photo: p.photo == null || p.photo === i ? null : p.photo > i ? p.photo - 1 : p.photo })));
  };

  const fill: Fill = useMemo(() => ({ owner: owner.trim(), clinic: clinic.trim(), area: area.trim(), role: role.trim() }), [owner, clinic, area, role]);
  const look: Look = useMemo(() => ({ fill, headFont, bodyFont, upper, logoPos, logo, pool }), [fill, headFont, bodyFont, upper, logoPos, logo, pool]);

  const patchPost = (id: string, change: Partial<Post>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const setText = (id: string, key: string, value: string) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, text: { ...p.text, [key]: value } } : p)));
  const setPostColour = (id: string, key: EKey, value: string) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, palette: { ...(p.palette ?? {}), [key]: value } } : p)));
  const setPostMetal = (id: string, key: EKey, on: boolean) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, metal: { ...(p.metal ?? {}), [key]: on } } : p)));
  const setPostFoil = (id: string, key: EKey, hex: string) =>
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, palette: { ...(p.palette ?? {}), [key]: hex }, metal: { ...(p.metal ?? {}), [key]: true } } : p)));

  const makePost = (design: string, cursor: number): Post => ({
    id: uid(), design, text: { ...EMPOWER_BY_ID[design].defaults },
    photo: pool.length ? cursor % pool.length : null, focus: DEFAULT_FOCUS, caption: "", hashtags: [], selected: true, busy: false,
  });
  const planAll = () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const start = (preset.id ?? 0) % EMPOWER.length;
    setPosts(EMPOWER.map((_, k) => makePost(EMPOWER[(start + k) % EMPOWER.length].id, k)));
    toast.success(`${EMPOWER.length} Empower posts planned. Now write the words.`);
  };
  const addPost = () => setPosts((l) => [...l, makePost(newDesign, l.length)]);

  // captions
  const onImageText = (post: Post) => {
    const def = EMPOWER_BY_ID[post.design];
    const r = resolveEmpowerText(def, post.text, fill);
    return def.fields.map((fd) => r[fd.key]).filter(Boolean).join("\n");
  };

  const writeCopy = async (post: Post) => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const def = EMPOWER_BY_ID[post.design];
    patchPost(post.id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/empower/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: clinic.trim() || preset.name,
          ownerName: owner.trim(),
          role: role.trim(),
          area: area.trim(),
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          designName: def.name,
          idea: def.idea,
          onImage: onImageText(post),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The caption would not write, try again");
      const foot = preset.captionFootnote?.trim();
      let caption: string = noDashes(data.caption ?? "");
      if (foot && !caption.includes(foot)) caption += `\n\n${foot}`;
      patchPost(post.id, { busy: false, caption, hashtags: Array.isArray(data.hashtags) ? data.hashtags : [] });
    } catch (e) {
      patchPost(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The caption would not write, try again");
    }
  };

  const shown = posts;
  const selected = shown.filter((p) => p.selected);

  const writeAll = async () => {
    if (!selected.length) { toast.error("Tick at least one post first"); return; }
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
    await Promise.all([worker(), worker(), worker()]);
    toast.success("All written. Have a read and tweak anything you like.", { id: toastId });
    setBusy(null);
  };

  const renderFull = async (post: Post): Promise<HTMLCanvasElement> => {
    await ensureFonts(headFont, bodyFont);
    const c = document.createElement("canvas");
    await renderPost(post, look, c, 1);
    return c;
  };

  const fullCaption = (p: Post) => `${p.caption.trim()}\n\n${p.hashtags.join(" ")}`.trim();
  const placeholdersIn = (p: Post) => leftoverPlaceholders(resolveEmpowerText(EMPOWER_BY_ID[p.design], p.text, fill));

  const download = async () => {
    if (!selected.length) { toast.error("Tick at least one post first"); return; }
    setBusy("zip");
    try {
      const zip = new JSZip();
      for (const post of selected) {
        const name = `${String(posts.indexOf(post) + 1).padStart(2, "0")}-${post.design}`;
        const c = await renderFull(post);
        const blob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/png"));
        if (blob) zip.file(`${name}.png`, blob);
        if (post.caption.trim()) zip.file(`${name}-caption.txt`, fullCaption(post));
      }
      saveAs(await zip.generateAsync({ type: "blob" }), `empower-posts-${(clinic || "client").replace(/\s+/g, "")}-${Date.now()}.zip`);
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
    if (!clinic.trim() || !area.trim()) { toast.error("Fill in the business name and area first, so no placeholder goes out."); return; }
    const noWords = selected.filter((p) => !p.caption.trim());
    if (noWords.length) { toast.error(`${noWords.length} ticked post${noWords.length > 1 ? "s have" : " has"} no caption yet. Press Write first.`); return; }
    const noPhoto = selected.filter((p) => EMPOWER_BY_ID[p.design].usesPhoto && p.photo == null);
    if (noPhoto.length) { toast.error(`${noPhoto.length} ticked post${noPhoto.length > 1 ? "s have" : " has"} no photo yet. Add approved photos first.`); return; }
    const left = selected.filter((p) => placeholdersIn(p).length);
    if (left.length) {
      const n = EMPOWER_BY_ID[left[0].design].name;
      toast.error(`"${n}" still has ${placeholdersIn(left[0]).join(" ")} to fill in. Change it in the boxes first.`);
      return;
    }
    setBusy("schedule");
    const toastId = toast.loading("Getting the pictures ready");
    try {
      const items: SchedulePostPayload[] = [];
      for (const [k, post] of selected.entries()) {
        toast.loading(`Getting post ${k + 1} of ${selected.length} ready`, { id: toastId });
        const c = await renderFull(post);
        const [url] = await uploadPngs([c.toDataURL("image/png")], [`empower-${post.design}-${Date.now()}.png`]);
        items.push({ title: `${EMPOWER_BY_ID[post.design].name} · ${clinic}`, caption: fullCaption(post), imageUrls: [url] });
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

  const chooserPost = chooser ? posts.find((p) => p.id === chooser) : null;
  const cardFont = { fontFamily: "inherit" };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground" style={cardFont}>
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <Crown className="w-5 h-5 text-amber-400" />
        <h1 className="font-bold text-lg">Empower</h1>
        <span className="text-sm text-muted-foreground">Thirty static posts, one image each, 1080 x 1350</span>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
        {/* set up */}
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

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              Headlines in capitals
            </label>
            <label className="flex items-center gap-2">
              Logo
              <Select value={logoPos} onValueChange={(v) => setLogoPos(v as LogoPos)}>
                <SelectTrigger className="w-36 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>{LOGO_POSITIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-muted-foreground">{preset?.logoUrl ? "uses this client's logo" : "this client has no logo saved"}</span>
            </label>
            <Button variant="outline" size="sm" onClick={() => fontFileRef.current?.click()}><Type className="w-4 h-4 mr-1.5" /> Upload fonts</Button>
            <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void addFonts(fs); }} />
          </div>
        </section>

        {/* photos */}
        <section className="rounded-2xl border border-border/30 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Photos</h2>
            <span className="text-sm text-muted-foreground">Add approved photos and any post without one picks one up. Drag a photo inside a preview to move it, double click to put it back.</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <ApprovedImagesPicker clientName={preset?.name} onAddImages={addToPool} skipBackgroundRemoval large label="Add approved photos" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-1.5" /> Upload from my device</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) addToPool(fs); }} />
            </div>
          </div>
          {pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet. Add approved photos and the posts pick them up. Your photos stay exactly as they are.</p>
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

        {/* toolbar */}
        <section className="flex flex-wrap items-center gap-3">
          <Button onClick={planAll} disabled={!preset}><CalendarClock className="w-4 h-4 mr-1.5" /> Plan all {EMPOWER.length}</Button>
          <div className="flex items-center gap-2">
            <Select value={newDesign} onValueChange={setNewDesign}>
              <SelectTrigger className="w-56 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{EMPOWER.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={addPost} disabled={!preset}><Plus className="w-4 h-4 mr-1.5" /> Add one</Button>
          </div>
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

        {/* posts */}
        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">Choose a client, add their approved photos and press Plan all. Each client starts on a different design. Static posts, one image each. Every colour has a Metallic box beside it for a foil finish. {"{owner}"}, {"{clinic}"}, {"{area}"} and {"{role}"} fill in from the boxes above. Scheduling puts them on every Tuesday at 8pm, starting with the next one, and you can move any date.</p>
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          {shown.map((post, pi) => {
            const def = EMPOWER_BY_ID[post.design];
            const ph = post.photo != null ? pool[post.photo] : null;
            const mine = { ...def.palette, ...(post.palette ?? {}) };
            return (
              <article key={post.id} className="rounded-2xl border border-border/30 p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={post.selected} onChange={(e) => patchPost(post.id, { selected: e.target.checked })} />
                  <h2 className="font-semibold">{pi + 1}.</h2>
                  <Select value={post.design} onValueChange={(v) => patchPost(post.id, { design: v, text: { ...EMPOWER_BY_ID[v].defaults }, palette: undefined, metal: undefined })}>
                    <SelectTrigger className="w-52 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">{EMPOWER.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="ml-auto">
                    <Button size="sm" variant="ghost" onClick={() => setPosts((l) => l.filter((x) => x.id !== post.id))}><X className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" disabled={post.busy || !!busy} onClick={() => writeCopy(post)}>
                      {post.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      {post.caption ? "Rewrite caption" : "Write caption"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Preview post={post} look={look} onFocus={(f) => patchPost(post.id, { focus: f })} />
                    <button type="button" onClick={() => setChooser(post.id)} className="flex w-full items-center gap-2 text-xs rounded-lg border border-border/40 px-2 py-1 hover:border-border">
                      {ph ? <img src={ph.url} alt="" className="h-9 w-7 object-cover rounded" /> : <span className="h-9 w-7 rounded bg-muted/40" />}
                      Change photo
                    </button>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Colours and logo for this post only</summary>
                      <div className="mt-2 space-y-2">
                        <div className="space-y-2">
                          {def.labels.map((c) => (
                            <div key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <Swatch label={c.label} value={mine[c.key]} onChange={(v) => setPostColour(post.id, c.key, v)} />
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" checked={!!post.metal?.[c.key]} onChange={(e) => setPostMetal(post.id, c.key, e.target.checked)} />
                                Metallic
                              </label>
                              {FOILS.map((f) => (
                                <button key={f.label} type="button" title={f.label} onClick={() => setPostFoil(post.id, c.key, f.hex)}
                                  className="h-5 w-5 rounded-full border border-border/50" style={{ background: `linear-gradient(135deg, ${f.hex}, #ffffff 45%, ${f.hex} 60%, #00000040)` }} />
                              ))}
                            </div>
                          ))}
                        </div>
                        <Select value={post.logoPos ?? "__client"} onValueChange={(v) => patchPost(post.id, { logoPos: v === "__client" ? undefined : (v as LogoPos) })}>
                          <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__client">Logo: same as every post</SelectItem>
                            {LOGO_POSITIONS.map((o) => <SelectItem key={o.value} value={o.value}>Logo: {o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {(post.palette || post.metal) && <button type="button" className="underline" onClick={() => patchPost(post.id, { palette: undefined, metal: undefined })}>back to the original colours</button>}
                      </div>
                    </details>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {def.fields.map((fd) => (
                        <label key={fd.key} className={`block ${(fd.rows ?? 1) > 1 ? "sm:col-span-2" : ""}`}>
                          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{fd.label}</span>
                          {(fd.rows ?? 1) > 1 ? (
                            <Textarea rows={Math.min(fd.rows ?? 2, 4)} value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                          ) : (
                            <Input value={post.text[fd.key] ?? ""} onChange={(e) => setText(post.id, fd.key, e.target.value)} />
                          )}
                        </label>
                      ))}
                    </div>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                      <Textarea rows={6} value={post.caption} onChange={(e) => patchPost(post.id, { caption: e.target.value })} placeholder="Press Write caption" />
                    </label>
                    {post.hashtags.length > 0 && <p className="text-sm text-amber-300 break-words">{post.hashtags.join(" ")}</p>}
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
              <p className="text-sm text-muted-foreground">Add photos first.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {pool.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => { patchPost(chooserPost.id, { photo: i, focus: DEFAULT_FOCUS }); setChooser(null); }}>
                    <img src={p.url} alt="" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-amber-400" />
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
          postType="single-image"
          posts={scheduleItems}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          initialGapMinutes={7 * 1440}
          keepClockTime
          sourceTool="empower"
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
