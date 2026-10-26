import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarRange, ExternalLink, ImageIcon, Loader2, RefreshCw, Sparkles, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_FOCUS, type Focus, type Slot } from "@/lib/basic-covers";
import { getBitmap } from "@/lib/month-engine";
import { ALIGNS, type Align } from "@/lib/text-layout";
import { MonthPhotoMaker } from "@/components/month-photo-maker";
import { usePresets } from "@/lib/use-presets";
import { useApprovedImages, sameClientName } from "@/lib/use-approval";
import { FONT_OPTIONS, loadGoogleFonts } from "@/lib/slide-utils";
import { addSharedFonts, syncSharedFonts, FONTS_CHANGED_EVENT, type SharedFontOption } from "@/lib/shared-fonts";
import {
  TOOL_LABEL, colourFields, designName, designsFor, ensureFonts, makePost, photoCount, renderSlide, schedulePost, slideCount, uid, urlToFile, writeCopy,
  type Client, type MPost, type PoolPhoto, type ToolId,
} from "@/lib/month-engine";

const SETTINGS_KEY = "month-client-v1";
const DONE_KEY = "month-scheduled-v1";
const LOGO_KEY = "month-logo-v1";
const OTHER_KEYS = ["unique-posts-client-v1", "treatments-client-v1", "basic-posts-client-v1", "halloween-posts-client-v1", "november-posts-client-v1", "xmas-posts-client-v1"];
const DEFAULT_HEAD = "'Anton', sans-serif";
const DEFAULT_BODY = "'Poppins', sans-serif";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// The seasonal pack that fits each month. Months with nothing seasonal ready use Unique for those slots.
const SEASONAL: Record<number, { tool: ToolId; group?: "xmas" | "newyear"; name: string } | undefined> = {
  9: { tool: "halloween", name: "Halloween" },
  10: { tool: "november", name: "November" },
  11: { tool: "xmas", group: "xmas", name: "Christmas" },
  0: { tool: "xmas", group: "newyear", name: "New Year" },
};

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

type Item = { kind: "post"; post: MPost } | { kind: "friday"; n: number; when: string };

const p2 = (n: number) => String(n).padStart(2, "0");
const toLocal = (d: Date, hhmm: string) => {
  const [h, m] = (hhmm || "18:15").split(":").map((x) => parseInt(x, 10));
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(Number.isFinite(h) ? h : 18)}:${p2(Number.isFinite(m) ? m : 15)}`;
};

// A future month runs from the 1st. The current month starts from now (today if the post time is still ahead, otherwise tomorrow)
// and carries on for 20 weekdays, spilling into the next month if it has to.
function weekdays(year: number, month: number, hhmm: string): Date[] {
  const out: Date[] = [];
  const now = new Date();
  const d = new Date(year, month, 1);
  const current = year === now.getFullYear() && month === now.getMonth();
  if (current) {
    d.setTime(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
    if (new Date(toLocal(d, hhmm)).getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  }
  while (out.length < 20 && (current || d.getMonth() === month)) {
    if (d.getDay() >= 1 && d.getDay() <= 5) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Mon and Tue seasonal, Wed BASIC or Treatment alternately, Thu Unique, Fri educational. That is 8 + 4 + 2 + 2 + 4 = 20.
function buildPlan(year: number, month: number, seed: number, hhmm: string, poolLen: number, done: number[]): Item[] {
  const days = weekdays(year, month, hhmm);
  let halloweenLeft = 2;
  const used: Record<string, number> = {};
  const pick = (tool: ToolId, group?: "xmas" | "newyear") => {
    const list = designsFor(tool, group);
    const key = `${tool}${group ?? ""}`;
    const k = used[key] ?? 0;
    used[key] = k + 1;
    return list[(seed + k) % list.length];
  };
  let cursor = seed * 3;
  const items: Item[] = [];
  days.forEach((date, i) => {
    const week = Math.floor(i / 5);
    const dow = date.getDay() - 1;
    const season = SEASONAL[date.getMonth()];
    const n = i + 1;
    const when = toLocal(date, hhmm);
    if (dow === 4) { items.push({ kind: "friday", n, when }); return; }
    let tool: ToolId; let group: "xmas" | "newyear" | undefined;
    if (dow === 0 || dow === 1) {
      tool = season?.tool ?? "unique"; group = season?.group;
      if (tool === "halloween") { if (halloweenLeft > 0) halloweenLeft--; else tool = "unique"; }
    }
    else if (dow === 2) tool = week % 2 === 0 ? "basic" : "treatments";
    else tool = "unique";
    const design = pick(tool, group);
    const post = makePost(tool, design, n, when, cursor, poolLen, group);
    cursor += photoCount(tool, design);
    post.scheduled = done.includes(n);
    post.selected = !post.scheduled && new Date(when).getTime() > Date.now();
    items.push({ kind: "post", post });
  });
  return items;
}

const photoIdxFor = (p: MPost, n: number): number =>
  p.tool === "basic" ? (n === 0 ? 0 : n === 1 ? 2 : 3) : p.tool === "unique" || p.tool === "treatments" ? n : 0;

const SW = 1080, SH = 1350;
const PROSPECT = "prospect";
const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

// Which photo and focus key a picture on slide n belongs to, so dragging it moves the right one.
function slotTarget(post: MPost, n: number, slot: Slot): { key: string; photo: number | null } {
  if (post.tool === "basic") {
    if (n === 0) return { key: `c${slot.i}`, photo: post.photos[slot.i] ?? null };
    return { key: `s${n + 1}`, photo: post.photos[n === 1 ? 2 : 3] ?? null };
  }
  if (n === 0) return { key: "c0", photo: post.photos[0] ?? null };
  return { key: `s${n + 1}`, photo: post.photos[n] ?? null };
}

function Thumb({ post, n, client, onSwap, onFocus, onText }: { post: MPost; n: number; client: Client; onSwap: () => void; onFocus: (key: string, f: Focus) => void; onText: (key: string, v: [number, number] | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slots = useRef<Slot[]>([]);
  const drag = useRef<{ slot: Slot; key: string; x: number; y: number; f: Focus; ox: number; oy: number } | null>(null);
  const tdrag = useRef<{ key: string; x: number; y: number; v: [number, number] } | null>(null);
  const run = useRef(0);
  useEffect(() => {
    const my = ++run.current;
    const t = setTimeout(async () => {
      await ensureFonts(client.headFont, client.bodyFont);
      if (my !== run.current || !ref.current) return;
      const c = document.createElement("canvas");
      const got = await renderSlide(post, n, client, c, 0.3);
      if (my !== run.current || !ref.current) return;
      slots.current = got;
      ref.current.width = c.width;
      ref.current.height = c.height;
      ref.current.getContext("2d")!.drawImage(c, 0, 0);
    }, 40 + n * 30);
    return () => clearTimeout(t);
  }, [post, n, client]);

  const toCanvas = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SW, y: ((e.clientY - r.top) / r.height) * SH };
  };
  const hit = (px: number, py: number): Slot | null => {
    for (let k = slots.current.length - 1; k >= 0; k--) {
      const sl = slots.current[k];
      const cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2;
      const a = (-sl.rot * Math.PI) / 180;
      const dx = px - cx, dy = py - cy;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(rx) <= sl.w / 2 && Math.abs(ry) <= sl.h / 2) return sl;
    }
    return null;
  };
  const onDown = async (e: React.PointerEvent) => {
    const p = toCanvas(e);
    const slot = hit(p.x, p.y);
    if (!slot) return;
    if (slot.i === -1) {
      const key = `t${n + 1}`;
      tdrag.current = { key, x: p.x, y: p.y, v: post.textPos?.[key] ?? [0, 0] };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const tg = slotTarget(post, n, slot);
    const ph = tg.photo != null ? client.pool[tg.photo] : null;
    const bmp = ph ? await getBitmap(ph) : null;
    if (!bmp) return;
    const sc = Math.max(slot.w / bmp.width, slot.h / bmp.height);
    drag.current = { slot, key: tg.key, x: p.x, y: p.y, f: post.focus[tg.key] ?? DEFAULT_FOCUS, ox: bmp.width * sc - slot.w, oy: bmp.height * sc - slot.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const td = tdrag.current;
    if (td) {
      const q = toCanvas(e);
      const nx = Math.max(-120, Math.min(120, td.v[0] + q.x - td.x));
      const ny = Math.max(-600, Math.min(600, td.v[1] + q.y - td.y));
      onText(td.key, [Math.round(nx), Math.round(ny)]);
      return;
    }
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
  const onUp = () => { drag.current = null; tdrag.current = null; };
  return (
    <div className="space-y-1">
      <canvas ref={ref} width={324} height={405} className="w-full rounded-lg border border-border/30 bg-muted/20 cursor-grab active:cursor-grabbing"
        style={{ aspectRatio: "4 / 5", touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      <button type="button" onClick={onSwap} className="w-full flex items-center justify-center gap-1 text-[11px] rounded-md border border-border/40 py-1 hover:border-border">
        <ImageIcon className="w-3 h-3" /> Swap photo
      </button>
      {n > 0 && post.textPos?.[`t${n + 1}`] && (
        <button type="button" onClick={() => onText(`t${n + 1}`, null)} className="w-full text-[11px] rounded-md border border-border/40 py-1 hover:border-border">
          Reset words
        </button>
      )}
    </div>
  );
}

export default function MonthPlanner() {
  const { presets, loading } = usePresets();
  const now = new Date();
  const [clientId, setClientId] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [sampleLink, setSampleLink] = useState("");
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [ym, setYm] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [approvedPool, setPool] = useState<PoolPhoto[]>([]);
  const [extras, setExtras] = useState<PoolPhoto[]>([]);
  const pool = useMemo(() => [...approvedPool, ...extras], [approvedPool, extras]);
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolFail, setPoolFail] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ postId: string; slide: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [headFont, setHeadFont] = useState(DEFAULT_HEAD);
  const [bodyFont, setBodyFont] = useState(DEFAULT_BODY);
  const [align, setAlign] = useState<Align>("center");
  const [spacing, setSpacing] = useState(1.3);
  const [brandOn, setBrandOn] = useState(true);
  const [brandMain, setBrandMain] = useState("#14195c");
  const [brandAccent, setBrandAccent] = useState("#c8553d");
  const [logoPos, setLogoPos] = useState<NonNullable<Client["logoPos"]>>("auto");
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [fontsTick, setFontsTick] = useState(0);
  const fontFileRef = useRef<HTMLInputElement>(null);

  const [year, month] = ym.split("-").map(Number);
  const isProspect = clientId === PROSPECT;
  // Someone who isn't a client yet: a stand-in client with just a name, so the whole tool works for them.
  const preset = useMemo(
    () => (isProspect
      ? ({ id: -1, name: prospectName.trim() || "Your clinic", seoArea: "", defaultPostTime: "18:15", logoUrl: null, targetAudience: "", brandNotes: "", captionFootnote: null } as unknown as (typeof presets)[number])
      : presets.find((p) => String(p.id) === clientId)),
    [isProspect, prospectName, presets, clientId],
  );
  const { data: approvedData } = useApprovedImages("");
  const allApproved = useMemo(() => approvedData ?? [], [approvedData]);

  useEffect(() => {
    loadGoogleFonts();
    const bump = () => setFontsTick((n) => n + 1);
    window.addEventListener(FONTS_CHANGED_EVENT, bump);
    void syncSharedFonts();
    return () => window.removeEventListener(FONTS_CHANGED_EVENT, bump);
  }, []);

  // Choosing a client fills in their owner name and area from anything already saved in the other tools.
  useEffect(() => {
    if (!preset) return;
    let saved: { owner?: string; role?: string; area?: string; headFont?: string; bodyFont?: string; align?: Align; spacing?: number; logoPos?: NonNullable<Client["logoPos"]>; brandOn?: boolean; brandMain?: string; brandAccent?: string } = {};
    const grab = (k: string) => { if (isProspect) return undefined; try { return (JSON.parse(localStorage.getItem(k) || "{}") as Record<string, typeof saved>)[String(preset.id)]; } catch { return undefined; } };
    saved = grab(SETTINGS_KEY) ?? OTHER_KEYS.map(grab).find((s) => s?.owner) ?? {};
    setOwner(saved.owner ?? "");
    setRole(saved.role ?? "Owner");
    setArea(saved.area || preset.seoArea || "");
    setHeadFont(saved.headFont || preset.stylishCoverHeadlineFont || DEFAULT_HEAD);
    setBodyFont(saved.bodyFont || preset.stylishCoverSubtitleFont || DEFAULT_BODY);
    setAlign(saved.align ?? "center");
    setSpacing(saved.spacing ?? 1.3);
    setLogoPos(saved.logoPos ?? "auto");
    const hex = (v?: string | null) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
    setBrandOn(saved.brandOn ?? true);
    setBrandMain(saved.brandMain ?? hex(preset.pageColor) ?? "#14195c");
    setBrandAccent(saved.brandAccent ?? hex(preset.accentColor) ?? hex(preset.cornerColor) ?? "#c8553d");
    setItems([]);
    setExtras([]);
    setLogo(null);
    let custom = "";
    if (!isProspect) { try { custom = (JSON.parse(localStorage.getItem(LOGO_KEY) || "{}") as Record<string, string>)[String(preset.id)] ?? ""; } catch { /* ignore */ } }
    const src = custom || preset.logoUrl;
    if (src) {
      const img = new Image();
      if (!custom) img.crossOrigin = "anonymous";
      img.onload = () => setLogo(img);
      img.src = src;
    }
  }, [preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!preset || isProspect) return;
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      all[String(preset.id)] = { owner, role, area, headFont, bodyFont, align, spacing, logoPos, brandOn, brandMain, brandAccent };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [preset?.id, owner, role, area, headFont, bodyFont, align, spacing, logoPos, brandOn, brandMain, brandAccent]); // eslint-disable-line react-hooks/exhaustive-deps

  // The client's approved photos become the pool every post draws from.
  const approvedForClient = useMemo(() => (preset && !isProspect ? allApproved.filter((i) => i.presetId === preset.id || sameClientName(i.clientName, preset.name)) : []), [allApproved, preset?.name, isProspect]); // eslint-disable-line react-hooks/exhaustive-deps
  const approvedKey = approvedForClient.map((i) => i.id).join(",");
  useEffect(() => {
    let live = true;
    setPool([]);
    setPoolFail(0);
    if (!approvedForClient.length) return;
    setPoolBusy(true);
    (async () => {
      const files: PoolPhoto[] = [];
      let failed = 0;
      const list = approvedForClient;
      for (let i = 0; i < list.length; i += 6) {
        const got = await Promise.all(list.slice(i, i + 6).map(async (img, k) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try { const file = await urlToFile(img.imageUrl, i + k); return { id: uid(), file, url: URL.createObjectURL(file) }; } catch { await new Promise((r) => setTimeout(r, 400)); }
          }
          return null;
        }));
        failed += got.filter((x) => !x).length;
        files.push(...got.filter((x): x is PoolPhoto => !!x));
        if (!live) return;
      }
      if (live) { setPool(files); setPoolFail(failed); setPoolBusy(false); }
    })();
    return () => { live = false; };
  }, [approvedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const client: Client = useMemo(() => ({
    businessName: preset?.name ?? "",
    ownerName: owner.trim(),
    role: role.trim(),
    area: area.trim(),
    audience: preset?.targetAudience ?? "",
    brandNotes: preset?.brandNotes ?? "",
    footnote: preset?.captionFootnote?.trim() ?? "",
    fill: { owner: owner.trim(), clinic: preset?.name ?? "", area: area.trim(), role: role.trim() },
    headFont,
    bodyFont,
    align,
    spacing,
    logoPos,
    brand: brandOn ? { main: brandMain, accent: brandAccent } : null,
    logo,
    pool,
  }), [preset, owner, role, area, logo, pool, headFont, bodyFont, align, spacing, logoPos, brandOn, brandMain, brandAccent]);

  const shared = useMemo(() => FONT_OPTIONS as SharedFontOption[], [fontsTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const clientFonts: FontOpt[] = useMemo(
    () => [preset?.stylishCoverHeadlineFont, preset?.stylishCoverSubtitleFont]
      .filter((v): v is string => !!v && !shared.some((x) => x.value === v))
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((v) => ({ label: `${v.split(",")[0].replace(/['"]/g, "").trim()} (this client)`, value: v })),
    [preset?.stylishCoverHeadlineFont, preset?.stylishCoverSubtitleFont, shared],
  );
  const yourFonts: FontOpt[] = useMemo(() => [...clientFonts, ...shared.filter((f) => f.custom)], [clientFonts, shared]);
  const libraryFonts: FontOpt[] = useMemo(() => shared.filter((f) => !f.custom && /,|['"]/.test(f.value) && !/^(top|bottom)-/.test(f.value)), [shared]);
  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      const img = new Image();
      img.onload = () => {
        setLogo(img);
        if (preset && !isProspect) { try { const all = JSON.parse(localStorage.getItem(LOGO_KEY) || "{}"); all[String(preset.id)] = data; localStorage.setItem(LOGO_KEY, JSON.stringify(all)); } catch { /* too big to remember, still used this time */ } }
        toast.success("Logo changed. Press Start this month again to see it on the posts.");
      };
      img.src = data;
    };
    reader.readAsDataURL(file);
  };
  const addFonts = async (files: File[]) => {
    const added = await addSharedFonts(files);
    if (added.length) { toast.success(`Added ${added.join(", ")}. They are in every font list now.`); setFontsTick((n) => n + 1); }
    else toast.error("Those files were not fonts I could read. Try .otf, .ttf or .woff");
  };

  const bucket = `${clientId}:${year}-${month}`;
  const doneList = (): number[] => { try { return (JSON.parse(localStorage.getItem(DONE_KEY) || "{}") as Record<string, number[]>)[bucket] ?? []; } catch { return []; } };
  const markDone = (n: number) => {
    try {
      const all = JSON.parse(localStorage.getItem(DONE_KEY) || "{}") as Record<string, number[]>;
      all[bucket] = [...new Set([...(all[bucket] ?? []), n])];
      localStorage.setItem(DONE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  };

  const patchPost = (id: string, change: Partial<MPost>) =>
    setItems((l) => l.map((it) => (it.kind === "post" && it.post.id === id ? { kind: "post", post: { ...it.post, ...change } } : it)));
  const posts = items.filter((i): i is { kind: "post"; post: MPost } => i.kind === "post").map((i) => i.post);

  const rewrite = async (post: MPost) => {
    patchPost(post.id, { busy: true });
    try {
      patchPost(post.id, { ...(await writeCopy(post, client)), busy: false });
    } catch (e) {
      patchPost(post.id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The words would not write, try again");
    }
  };

  const create = async () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    if (!owner.trim() || !area.trim()) { toast.error("Add the owner's first name and the area first, so no placeholder goes out."); return; }
    if (!area.trim()) { toast.error("Add the clinic's town and city in the Area box first, so every hashtag matches where they are."); return; }
    if (isProspect && !prospectName.trim()) { toast.error("Add their clinic name first."); return; }
    if (!pool.length) { toast.error(isProspect ? "Add some of their photos first." : "This client has no approved photos yet. Approve some first."); return; }
    setSampleLink("");
    let plan = buildPlan(year, month, isProspect ? 1 + Math.floor(Math.random() * 40) : preset.id, (preset as unknown as { defaultPostTime?: string }).defaultPostTime ?? "18:15", pool.length, doneList());
    if (isProspect) {
      // A free sample is 8 posts, shown on the page I hand over.
      const only = plan.filter((i) => i.kind === "post").slice(0, 8);
      plan = only.map((i) => (i.kind === "post" ? { kind: "post" as const, post: { ...i.post, selected: true } } : i));
    }
    setItems(plan);
    setBusy("write");
    const targets = plan.filter((i): i is { kind: "post"; post: MPost } => i.kind === "post").map((i) => i.post).filter((p) => !p.scheduled);
    const toastId = toast.loading(`Writing 0 of ${targets.length}`);
    let done = 0;
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift()!;
        try {
          const copy = await writeCopy(p, client);
          setItems((l) => l.map((it) => (it.kind === "post" && it.post.id === p.id ? { kind: "post", post: { ...it.post, ...copy } } : it)));
        } catch { /* leave blank, she can press Rewrite */ }
        done++;
        toast.loading(`Writing ${done} of ${targets.length}`, { id: toastId });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    toast.success("The month is ready. Have a look through, nothing is scheduled.", { id: toastId });
    setBusy(null);
  };

  const ready = posts.filter((p) => p.selected && !p.scheduled);
  const scheduleAll = async () => {
    setConfirm(false);
    if (!preset) return;
    const missing = ready.filter((p) => !p.caption.trim());
    if (missing.length) { toast.error(`${missing.length} ticked post${missing.length > 1 ? "s have" : " has"} no caption yet. Press Rewrite on them first.`); return; }
    setBusy("schedule");
    const toastId = toast.loading("Scheduling 0 of " + ready.length);
    let ok = 0;
    try {
      for (const p of ready) {
        await schedulePost(p, client, preset.id);
        patchPost(p.id, { scheduled: true, selected: false });
        markDone(p.n);
        ok++;
        toast.loading(`Scheduling ${ok} of ${ready.length}`, { id: toastId });
      }
      toast.success(`${ok} posts scheduled. Go and put the kettle on.`, { id: toastId });
    } catch (e) {
      toast.error(`${ok} scheduled, then it stopped: ${e instanceof Error ? e.message : "failed"}`, { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  // Puts the 8 sample posts on a public page and gives back the link to send them.
  const makeSampleLink = async () => {
    if (posts.length !== 8) return;
    const missing = posts.filter((p) => !p.caption.trim());
    if (missing.length) { toast.error(`${missing.length} post${missing.length > 1 ? "s have" : " has"} no caption yet. Press Rewrite on them first.`); return; }
    setBusy("link");
    const toastId = toast.loading("Making their page…");
    try {
      await ensureFonts(client.headFont, client.bodyFont);
      const up = async (blob: Blob, name: string) => {
        const fd = new FormData(); fd.append("image", blob, name);
        const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
        const d = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
        return d.url;
      };
      const out: { n: number; week: number; day: string; imageUrl: string; caption: string; tags: string }[] = [];
      for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        toast.loading(`Uploading ${i + 1} of 8`, { id: toastId });
        const cv = document.createElement("canvas");
        await renderSlide(p, 0, client, cv, 1);
        const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the picture"))), "image/jpeg", 0.92));
        const day = new Date(p.when).toLocaleDateString("en-GB", { weekday: "long" });
        out.push({ n: i + 1, week: i < 4 ? 1 : 2, day, imageUrl: await up(blob, `post-${i + 1}.jpg`), caption: p.caption, tags: p.hashtags.join(" ") });
      }
      let logoUrl = "";
      if (logo) {
        const lc = document.createElement("canvas"); lc.width = logo.naturalWidth || 400; lc.height = logo.naturalHeight || 200;
        lc.getContext("2d")!.drawImage(logo, 0, 0, lc.width, lc.height);
        const lb = await new Promise<Blob | null>((res) => lc.toBlob(res, "image/png"));
        if (lb) logoUrl = await up(lb, "logo.png");
      }
      const r = await fetch(`${API}/free-samples`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: prospectName.trim(), logoUrl, accent: brandAccent, posts: out }),
      });
      const d = (await r.json()) as { slug?: string; error?: string };
      if (!r.ok || !d.slug) throw new Error(d.error || "Could not save the page");
      const url = `${window.location.origin}/sample/${d.slug}`;
      setSampleLink(url);
      try { await navigator.clipboard.writeText(url); toast.success("Their link is ready and copied.", { id: toastId }); } catch { toast.success("Their link is ready.", { id: toastId }); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the link", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  const swapPost = swap ? posts.find((p) => p.id === swap.postId) : null;
  const options = Array.from({ length: 14 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return { v: `${d.getFullYear()}-${d.getMonth()}`, l: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }; });
  const fmt = (when: string) => new Date(when).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const season = SEASONAL[month];

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground pb-24">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <CalendarRange className="w-5 h-5 text-violet-400" />
        <h1 className="font-bold text-lg">Month</h1>
        <span className="text-sm text-muted-foreground">One client, one calendar month, 20 posts made for you, starting from now</span>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border/30 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Client</span>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue placeholder={loading ? "Loading…" : "Choose a client"} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={PROSPECT}>Not a client yet (free sample)</SelectItem>
                  {presets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isProspect && (
              <label className="space-y-1.5 block lg:col-span-5">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Their clinic name</span>
                <Input value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="e.g. Glow Aesthetics" />
              </label>
            )}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Month</span>
              <Select value={ym} onValueChange={(v) => { setYm(v); setItems([]); }}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Owner first name</span>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Their role</span>
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label className="space-y-1.5 block lg:col-span-2">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Area (also used for the 5 hashtags)</span>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Town, City (the hashtags use this)" className={!area.trim() && preset ? "border-red-500/60" : ""} />
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
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Words on slides 2 to 5</span>
              <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>{ALIGNS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="space-y-1.5 block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Line spacing {spacing.toFixed(2)}</span>
              <input type="range" min={1} max={1.8} step={0.05} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="w-full" />
            </label>
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Logo</span>
              <Select value={logoPos} onValueChange={(v) => setLogoPos(v as NonNullable<Client["logoPos"]>)}>
                <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  <SelectItem value="off">No logo</SelectItem>
                  <SelectItem value="tl">Top left</SelectItem>
                  <SelectItem value="tr">Top right</SelectItem>
                  <SelectItem value="bl">Bottom left</SelectItem>
                  <SelectItem value="br">Bottom right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Brand colours</span>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={brandOn} onChange={(e) => setBrandOn(e.target.checked)} /> Use this client's brand colours on every post</label>
                <label className="flex items-center gap-1.5">Main <input type="color" value={brandMain} onChange={(e) => setBrandMain(e.target.value)} className="h-7 w-9 rounded border border-border/40 bg-transparent" /></label>
                <label className="flex items-center gap-1.5">Accent <input type="color" value={brandAccent} onChange={(e) => setBrandAccent(e.target.value)} className="h-7 w-9 rounded border border-border/40 bg-transparent" /></label>
              </div>
            </div>
            <div className="flex items-end gap-3 lg:col-span-3">
              <Button variant="outline" onClick={() => logoFileRef.current?.click()} disabled={!preset}>{logo ? "Change logo" : "Upload logo"}</Button>
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLogo(f); }} />
              {logo && <img src={logo.src} alt="" className="h-9 max-w-[120px] object-contain rounded bg-white/90 p-1" />}
              <Button variant="outline" onClick={() => fontFileRef.current?.click()}><Type className="w-4 h-4 mr-1.5" /> Upload fonts</Button>
              <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" multiple className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void addFonts(fs); }} />
              <Button onClick={create} disabled={!preset || !!busy || poolBusy}>
                {busy === "write" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                {items.length ? "Start this month again" : "Create the month"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {!preset ? "Choose a client to begin." : poolBusy ? "Getting their approved photos…" : `${pool.length} photo${pool.length === 1 ? "" : "s"} ready${approvedForClient.length > approvedPool.length ? ` of ${approvedForClient.length} approved` : ""}${poolFail ? `, ${poolFail} would not load` : ""}.`}
                {preset && !season ? ` No seasonal pack for ${MONTHS[month]} yet, so those slots use Unique.` : ""}
              </span>
            </div>
          </div>
        </section>
        {isProspect && (
          <section className="rounded-2xl border border-border/30 p-5 space-y-2">
            <h2 className="font-semibold">Their photos</h2>
            <p className="text-sm text-muted-foreground">Add their photos (the more the better, I use them across the 8 posts) and their logo above, then press Create.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => photoFileRef.current?.click()}><ImageIcon className="w-4 h-4 mr-1.5" /> Add photos</Button>
              <input ref={photoFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files ?? []); e.target.value = "";
                if (files.length) setExtras((l) => [...l, ...files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
              }} />
              <span className="text-sm text-muted-foreground">{extras.length} photo{extras.length === 1 ? "" : "s"} added</span>
              {extras.length > 0 && <Button variant="ghost" size="sm" onClick={() => setExtras([])}>Clear photos</Button>}
            </div>
          </section>
        )}
        {preset && !isProspect && (
          <MonthPhotoMaker
            clientName={preset.name}
            monthName={MONTHS[month]}
            refs={approvedForClient.map((a) => ({ id: a.id, imageUrl: a.imageUrl }))}
            disabled={!!busy || poolBusy}
            onAdd={async (urls) => {
              const files: PoolPhoto[] = [];
              for (let k = 0; k < urls.length; k++) {
                const file = await urlToFile(urls[k], 1000 + extras.length + k);
                files.push({ id: uid(), file, url: URL.createObjectURL(file) });
              }
              setExtras((l) => [...l, ...files]);
            }}
          />
        )}

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Pick a client and a month and press Create the month. I make every post, picture and caption from their approved photos and put them on screen for you to check. Nothing is scheduled until you press the schedule button at the bottom.
          </p>
        )}

        <div className="space-y-5">
          {items.map((it) => {
            if (it.kind === "friday") {
              return (
                <article key={`f${it.n}`} className="rounded-2xl border border-dashed border-border/40 p-4 flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold">{it.n}. {fmt(it.when)}</h2>
                  <span className="text-xs rounded-full border px-2.5 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Friday educational</span>
                  <span className="text-sm text-muted-foreground">Comes from the ready made content in Stylish. I will build these in the next step.</span>
                  <Link href="/stylish" className="ml-auto"><Button size="sm" variant="outline"><ExternalLink className="w-4 h-4 mr-1.5" /> Open Stylish</Button></Link>
                </article>
              );
            }
            const p = it.post;
            const count = slideCount(p.tool, p.design);
            return (
              <article key={p.id} className={`rounded-2xl border p-4 space-y-4 ${p.scheduled ? "border-emerald-500/40 opacity-70" : "border-border/30"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <input type="checkbox" checked={p.selected} disabled={p.scheduled} onChange={(e) => patchPost(p.id, { selected: e.target.checked })} />
                  <h2 className="font-semibold">{p.n}. {fmt(p.when)}</h2>
                  <input type="datetime-local" value={p.when} onChange={(e) => patchPost(p.id, { when: e.target.value })} className="rounded-md border border-border/40 bg-transparent px-2 py-1 text-sm" />
                  <span className="text-xs rounded-full border px-2.5 py-0.5 border-border/50">{TOOL_LABEL[p.tool]}</span>
                  <span className="text-sm text-muted-foreground">{designName(p)}</span>
                  {p.scheduled && <span className="text-xs text-emerald-400">Scheduled</span>}
                  {!p.scheduled && new Date(p.when).getTime() <= Date.now() && <span className="text-xs text-amber-400">This date has passed</span>}
                  <Button size="sm" variant="outline" className="ml-auto" disabled={p.busy || !!busy} onClick={() => rewrite(p)}>
                    {p.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />} Rewrite words
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {colourFields(p, client.brand).map((f) => (
                    <label key={f.key} className="flex items-center gap-1.5">
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.value) ? f.value : "#000000"} onChange={(e) => patchPost(p.id, { pal: { ...(p.pal ?? {}), [f.key]: e.target.value } })} className="h-6 w-8 rounded border border-border/40 bg-transparent" />
                      {f.label}
                    </label>
                  ))}
                  {p.pal && <button type="button" className="underline" onClick={() => patchPost(p.id, { pal: undefined })}>reset colours</button>}
                </div>
                <div className={`grid gap-3 ${count === 1 ? "grid-cols-1 max-w-[220px]" : count === 3 ? "grid-cols-3 max-w-3xl" : "grid-cols-5"}`}>
                  {Array.from({ length: count }, (_, n) => (
                    <Thumb key={n} post={p} n={n} client={client} onSwap={() => setSwap({ postId: p.id, slide: n })} onFocus={(key, f) => patchPost(p.id, { focus: { ...p.focus, [key]: f } })} onText={(key, v) => { const tp = { ...(p.textPos ?? {}) }; if (v) tp[key] = v; else delete tp[key]; patchPost(p.id, { textPos: tp }); }} />
                  ))}
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    {p.slides.map((s, i) => (
                      <label key={i} className="block">
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Slide {i + 2} words</span>
                        <Textarea rows={2} value={s} onChange={(e) => patchPost(p.id, { slides: p.slides.map((x, k) => (k === i ? e.target.value : x)) })} />
                      </label>
                    ))}
                    {p.slides.length > 0 && (
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Last slide question</span>
                        <Input value={p.cta} onChange={(e) => patchPost(p.id, { cta: e.target.value })} />
                      </label>
                    )}
                  </div>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                    <Textarea rows={7} value={p.caption} onChange={(e) => patchPost(p.id, { caption: e.target.value })} placeholder="Writing…" />
                    {p.hashtags.length > 0 && <p className="text-sm text-violet-300 break-words mt-1">{p.hashtags.join(" ")}</p>}
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {posts.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border/40 bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-3">
          {isProspect ? (
            <>
              <span className="text-sm text-muted-foreground truncate">{sampleLink ? <a href={sampleLink} target="_blank" rel="noreferrer" className="text-violet-300 underline">{sampleLink}</a> : "When you are happy with the 8 posts, make their link."}</span>
              {sampleLink && <Button variant="outline" className="ml-auto" onClick={() => { void navigator.clipboard?.writeText(sampleLink); toast.success("Link copied"); }}>Copy link</Button>}
              <Button className={sampleLink ? "" : "ml-auto"} disabled={!!busy || posts.length !== 8} onClick={makeSampleLink}>{busy === "link" ? "Making the link…" : sampleLink ? "Make the link again" : "Make their link"}</Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">{ready.length} ticked, nothing is scheduled until you press the button.</span>
              <Button className="ml-auto" disabled={!!busy || !ready.length} onClick={() => setConfirm(true)}>Schedule the ticked posts</Button>
            </>
          )}
        </div>
      )}

      {swap && swapPost && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSwap(null)}>
          <div className="bg-background rounded-2xl border border-border/40 p-5 max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-3">
              <h3 className="font-semibold">Choose from {preset?.name}'s approved photos</h3>
              <button type="button" className="ml-auto" onClick={() => setSwap(null)}><X className="w-5 h-5" /></button>
            </div>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show every approved photo, from all clients and batches ({allApproved.length})
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {pool.map((ph, i) => (
                <button key={ph.id} type="button" onClick={() => {
                  const photos = [...swapPost.photos];
                  photos[photoIdxFor(swapPost, swap.slide)] = i;
                  patchPost(swapPost.id, { photos });
                  setSwap(null);
                }}>
                  <img src={ph.url} alt="" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-violet-400" />
                </button>
              ))}
            </div>
            {showAll && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">{pickBusy ? "Getting that photo…" : "All approved photos. Tap one to use it."}</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {allApproved.map((a) => (
                    <button key={a.id} type="button" disabled={pickBusy} title={`${a.clientName} · ${a.batchName}`} onClick={async () => {
                      setPickBusy(true);
                      try {
                        const file = await urlToFile(a.imageUrl, 5000 + a.id);
                        const pf: PoolPhoto = { id: uid(), file, url: URL.createObjectURL(file) };
                        const idx = pool.length;
                        setExtras((x) => [...x, pf]);
                        const photos = [...swapPost.photos];
                        photos[photoIdxFor(swapPost, swap.slide)] = idx;
                        patchPost(swapPost.id, { photos });
                        setSwap(null);
                      } catch { toast.error("That photo would not load, try another"); }
                      setPickBusy(false);
                    }}>
                      <img src={a.imageUrl} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover rounded-md border border-border/30 hover:border-violet-400" />
                      <span className="block text-[10px] text-muted-foreground truncate">{a.clientName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirm(false)}>
          <div className="bg-background rounded-2xl border border-border/40 p-5 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Schedule {ready.length} posts for {preset?.name}?</h3>
            <ul className="text-sm text-muted-foreground max-h-60 overflow-y-auto space-y-0.5">
              {ready.map((p) => <li key={p.id}>{fmt(p.when)}: {designName(p)}</li>)}
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button>
              <Button onClick={scheduleAll}>Yes, schedule them</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
