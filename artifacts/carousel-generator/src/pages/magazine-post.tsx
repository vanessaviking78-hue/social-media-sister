import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Sparkles, X, Loader2, Move, CalendarClock, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MagazineIcon } from "@/components/magazine-icon";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import { loadImageFromFile } from "@/lib/advent-door";
import { getPhotoHits, DEFAULT_ADJUST, PAGE_W, PAGE_H, type PhotoAdjust, type MagazineBrand } from "@/lib/magazine-pages";
import {
  EMPTY_POST_COPY,
  PAGE_NAMES,
  MIN_PHOTOS,
  MAX_PHOTOS,
  drawAllPostPages,
  photoRole,
  photoShape,
  type MagazinePostCopy,
  type ListPage,
} from "@/lib/magazine-post-pages";
import { scanText, applySwap, isBlocking } from "@/lib/newsletter-compliance";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Photo = { canvas: HTMLCanvasElement; thumb: string; name: string; adjust: PhotoAdjust; shape: "H" | "V" };

// Keeps the whole photo, just capped in size. The pages crop it to each frame, so a horizontal photo
// stays horizontal for the wide frames instead of being cut down to a portrait strip first.
function fitPhoto(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function thumbOf(c: HTMLCanvasElement): string {
  const t = document.createElement("canvas");
  const k = 360 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * k);
  t.height = Math.round(c.height * k);
  t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.7);
}

const STYLES = [
  { key: "1", label: "Northern grit", hint: "Straight talking, warm, dry" },
  { key: "2", label: "Springsteen storyteller", hint: "Little scenes, big heart, whimsical" },
  { key: "3", label: "Dawn French", hint: "Funny and blunt" },
  { key: "4", label: "Professional with personality", hint: "Polished, still very you" },
  { key: "5", label: "Feral and sarcastic", hint: "Savage, cheeky, affable underneath" },
];

const PAGE_TABS = ["Cover", "Fun facts", "For you if", "Helps most with", "Last page"];

function monthYear() {
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim());

// Small path helpers so every piece of copy can be edited and swapped by its address, e.g. "pages.0.facts.1.text".
function getAt(obj: any, path: string): string {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj) ?? "";
}
function setAt(copy: MagazinePostCopy, path: string, value: string): MagazinePostCopy {
  const next: any = structuredClone(copy);
  const keys = path.split(".");
  let o = next;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
  return next;
}

function Field({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const cls =
    "w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-fuchsia-500 outline-none px-3 py-2 text-sm text-white placeholder:text-zinc-600";
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

export default function MagazinePost() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [colour, setColour] = useState("#4a1942");
  const [accent, setAccent] = useState("#f0b8a4");
  const [contact, setContact] = useState("");
  const [treatment, setTreatment] = useState("");
  const [replyWord, setReplyWord] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [copy, setCopy] = useState<MagazinePostCopy>(EMPTY_POST_COPY);
  const [writing, setWriting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null, null]);
  const pagesRef = useRef<HTMLCanvasElement[]>([]);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ slot: number; x: number; y: number; inv: DOMMatrix; slackX: number; slackY: number } | null>(null);

  const brand: MagazineBrand = {
    clinicName: clinicName.trim() || "Your clinic",
    colour,
    accent,
    ctaButton: "",
    contact: contact.trim(),
    issue: monthYear(),
  };

  function pickClient(id: number | null) {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setClinicName(p.name);
    if (isHex(p.pageColor)) setColour(p.pageColor.trim());
    if (isHex(p.accentColor)) setAccent(p.accentColor.trim());
    setContact((p.bookingLink ?? "").toString());
  }

  function updateAdjust(slot: number, fn: (a: PhotoAdjust) => PhotoAdjust) {
    setPhotos((prev) => prev.map((p, i) => (i === slot ? { ...p, adjust: fn(p.adjust) } : p)));
  }

  const addPhotos = useCallback(async (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const loaded: Photo[] = [];
    for (const file of list) {
      try {
        const img = await loadImageFromFile(file);
        const canvas = fitPhoto(img);
        loaded.push({
          canvas,
          thumb: thumbOf(canvas),
          name: file.name,
          adjust: { ...DEFAULT_ADJUST },
          shape: img.naturalWidth > img.naturalHeight * 1.05 ? "H" : "V",
        });
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message || "couldn't read that image"}`);
      }
    }
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (loaded.length > room) toast.message(`Ten photos is the most, so I've kept the first ${MAX_PHOTOS}`);
      return [...prev, ...loaded.slice(0, Math.max(0, room))];
    });
  }, []);

  function movePhoto(i: number, dir: -1 | 1) {
    setPhotos((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelected(null);
  }

  // Redraw the five pages a moment after anything changes.
  useEffect(() => {
    const id = setTimeout(() => {
      const canvases: (CanvasImageSource | null)[] = photos.map((p) => p.canvas);
      while (canvases.length < MIN_PHOTOS) canvases.push(null);
      const drawCopy: MagazinePostCopy = {
        ...copy,
        cover: { ...copy.cover, title: copy.cover.title || treatment.trim() },
        cta: { ...copy.cta, word: copy.cta.word || replyWord.trim() },
      };
      const pages = drawAllPostPages(brand, drawCopy, canvases, photos.map((p) => p.adjust));
      pagesRef.current = pages;
      const big = bigRef.current;
      if (big && pages[activePage]) {
        const bctx = big.getContext("2d")!;
        bctx.clearRect(0, 0, big.width, big.height);
        bctx.drawImage(pages[activePage], 0, 0, big.width, big.height);
      }
      pages.forEach((page, i) => {
        const target = canvasRefs.current[i];
        if (!target) return;
        const ctx = target.getContext("2d")!;
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(page, 0, 0, target.width, target.height);
      });
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicName, colour, accent, contact, copy, photos, activePage, treatment, replyWord]);

  function hitAt(e: { clientX: number; clientY: number }) {
    const big = bigRef.current;
    if (!big) return null;
    const r = big.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * PAGE_W;
    const py = ((e.clientY - r.top) / r.height) * PAGE_H;
    const list = getPhotoHits().filter((h) => h.page === activePage);
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      const lp = h.inv.transformPoint(new DOMPoint(px, py));
      if (lp.x >= h.x && lp.x <= h.x + h.w && lp.y >= h.y && lp.y <= h.y + h.h) return { h, px, py };
    }
    return null;
  }

  function onBigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const hit = hitAt(e);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(hit.h.slot);
    dragRef.current = { slot: hit.h.slot, x: hit.px, y: hit.py, inv: hit.h.inv, slackX: hit.h.slackX, slackY: hit.h.slackY };
  }

  function onBigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const big = bigRef.current;
    const d = dragRef.current;
    if (!big) return;
    if (!d) {
      big.style.cursor = hitAt(e) ? "grab" : "default";
      return;
    }
    big.style.cursor = "grabbing";
    const r = big.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * PAGE_W;
    const py = ((e.clientY - r.top) / r.height) * PAGE_H;
    const dx = px - d.x;
    const dy = py - d.y;
    const ldx = d.inv.a * dx + d.inv.c * dy;
    const ldy = d.inv.b * dx + d.inv.d * dy;
    d.x = px;
    d.y = py;
    updateAdjust(d.slot, (a) => ({
      ...a,
      panX: d.slackX > 0 ? Math.max(-1, Math.min(1, a.panX + ldx / (d.slackX / 2))) : 0,
      panY: d.slackY > 0 ? Math.max(-1, Math.min(1, a.panY + ldy / (d.slackY / 2))) : 0,
    }));
  }

  function onBigUp() {
    dragRef.current = null;
    if (bigRef.current) bigRef.current.style.cursor = "grab";
  }

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const hit = hitAt(e);
    if (!hit) return;
    e.preventDefault();
    setSelected(hit.h.slot);
    updateAdjust(hit.h.slot, (a) => ({ ...a, zoom: Math.max(1, Math.min(4, a.zoom * (1 - e.deltaY * 0.0015))) }));
  };
  useEffect(() => {
    const el = bigRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  async function writeCopy() {
    if (!treatment.trim()) {
      toast.error("Add the treatment first");
      return;
    }
    if (!replyWord.trim()) {
      toast.error("Add the reply word first, the one people comment");
      return;
    }
    if (!style) {
      toast.error("Pick a voice first");
      return;
    }
    setWriting(true);
    try {
      const r = await fetch(`${BASE}/api/magazine-post/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: clinicName.trim(), treatment: treatment.trim(), replyWord: replyWord.trim(), style }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The copy would not write, try again");
      setCopy(data as MagazinePostCopy);
      toast.success("Written. Have a read and change anything you like");
    } catch (e: any) {
      toast.error(e?.message || "The copy would not write, try again");
    } finally {
      setWriting(false);
    }
  }

  // Every piece of copy, so the compliance check can look at all of it.
  const fields = useMemo(() => {
    const out: { path: string; where: string }[] = [
      { path: "cover.title", where: "Cover title" },
      { path: "cover.kicker", where: "Cover small heading" },
      { path: "cover.tagline", where: "Cover tagline" },
    ];
    const names = ["Fun facts", "For you if", "Helps most with"];
    for (let p = 0; p < 3; p++) {
      out.push({ path: `pages.${p}.kicker`, where: `${names[p]} small heading` });
      out.push({ path: `pages.${p}.headline`, where: `${names[p]} headline` });
      out.push({ path: `pages.${p}.intro`, where: `${names[p]} intro` });
    }
    for (let f = 0; f < 3; f++) {
      out.push({ path: `pages.0.facts.${f}.label`, where: `Fun fact ${f + 1} label` });
      out.push({ path: `pages.0.facts.${f}.text`, where: `Fun fact ${f + 1}` });
    }
    for (let p = 1; p < 3; p++) {
      for (let i = 0; i < 5; i++) out.push({ path: `pages.${p}.items.${i}`, where: `${names[p]}, line ${i + 1}` });
    }
    out.push({ path: "cta.line", where: "Last page line" });
    out.push({ path: "caption", where: "Caption" });
    return out;
  }, []);

  const flags = useMemo(() => fields.flatMap((f) => scanText(getAt(copy, f.path), f.where, f.path)), [copy, fields]);
  const blocking = flags.filter(isBlocking);

  const hasCopy = !!copy.cover.title && !!copy.pages[0].headline;
  const enoughPhotos = photos.length >= MIN_PHOTOS;

  function slugName() {
    return (treatment.trim() || "magazine-post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function guardReady(): boolean {
    if (!enoughPhotos) {
      toast.error(`Add at least ${MIN_PHOTOS} photos first`);
      return false;
    }
    if (!hasCopy) {
      toast.error("Write the pages first");
      return false;
    }
    if (blocking.length) {
      toast.error("There are compliance flags to sort out first, they're listed under the pages");
      return false;
    }
    return true;
  }

  async function downloadAll() {
    if (!guardReady()) return;
    const pages = pagesRef.current;
    const slug = slugName();
    for (let i = 0; i < pages.length; i++) {
      const blob: Blob | null = await new Promise((res) => pages[i].toBlob(res, "image/png"));
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${i + 1}-${PAGE_NAMES[i]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await new Promise((r) => setTimeout(r, 350));
    }
    toast.success("5 pages downloaded, in order");
  }

  async function uploadPage(canvas: HTMLCanvasElement, name: string): Promise<string> {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const resp = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name, base64: dataUrl.split(",")[1] }] }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data?.error || `Upload failed (${resp.status})`);
    }
    const data = await resp.json();
    const url = data.results?.[0]?.url;
    if (!url) throw new Error("Upload came back without a link");
    return url;
  }

  async function scheduleToClient() {
    if (!guardReady()) return;
    if (presetId === null) {
      toast.error("Choose the client first");
      return;
    }
    setPreparing(true);
    const tid = toast.loading("Getting the 5 pages ready");
    try {
      const pages = pagesRef.current;
      const slug = slugName();
      const urls: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        toast.loading(`Uploading page ${i + 1} of ${pages.length}`, { id: tid });
        urls.push(await uploadPage(pages[i], `${slug}-${i + 1}-${PAGE_NAMES[i]}-${Date.now()}.jpg`));
      }
      toast.dismiss(tid);
      setSchedulePosts([
        { title: `${treatment.trim()} magazine post`, caption: copy.caption, imageUrls: urls, sourceTool: "Magazine Post" },
      ]);
      setScheduleOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't prepare the pages", { id: tid });
    } finally {
      setPreparing(false);
    }
  }

  const set = (path: string) => (v: string) => setCopy((c) => setAt(c, path, v));
  const selectedClient = presets.find((p) => p.id === presetId);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors" aria-label="Back to the hub">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MagazineIcon className="w-6 h-6 text-fuchsia-400" /> Magazine Post
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Add 5 to 10 photos and a treatment. The treatment becomes the title, then come a page of fun facts, a page headed This is for you if, a page headed Helps most with, and the last page is a full photo asking people to comment your reply word.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-8 items-start">
          {/* LEFT: the inputs */}
          <div className="space-y-7">
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">1. The client</p>
              <label className="block">
                <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Choose a client (fills in their name and colours)</span>
                <select
                  value={presetId ?? ""}
                  onChange={(e) => pickClient(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-fuchsia-500 outline-none px-3 py-2 text-sm text-white"
                >
                  <option value="">Pick a client</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Clinic name" value={clinicName} onChange={setClinicName} placeholder="e.g. Aspyre Aesthetics" />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Brand colour</span>
                  <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="w-full h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer" />
                </label>
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Highlight colour</span>
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer" />
                </label>
              </div>
              <Field label="Website, phone or handle (last page footer, optional)" value={contact} onChange={setContact} placeholder="www.yourclinic.co.uk" />
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                2. Photos ({photos.length} of {MAX_PHOTOS}, at least {MIN_PHOTOS})
              </p>
              {photos.length < MAX_PHOTOS && (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addPhotos(e.dataTransfer.files);
                  }}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-fuchsia-500/60 rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <Upload className="mb-1.5 text-zinc-600" size={20} />
                  <p className="text-sm font-medium text-zinc-300">Drop your photos here, or tap to choose</p>
                  <p className="text-[11px] text-zinc-500 mt-1">The first is the cover and the last is the full photo page. The rest are shared across the inside pages.</p>
                </label>
              )}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                  Photo shapes needed <span className="normal-case tracking-normal text-zinc-600">(V = vertical, H = horizontal)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.max(photos.length, MIN_PHOTOS) }, (_, i) => {
                    const need = photoShape(i, Math.max(photos.length, MIN_PHOTOS));
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                          need === "V" ? "border-fuchsia-500/50 text-fuchsia-300" : "border-sky-500/50 text-sky-300"
                        }`}
                      >
                        <span className="text-zinc-500 font-normal">{i + 1}</span> {need}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  With more photos the order shifts a little, so this updates as you add them. Squarish photos work as either.
                </p>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {photos.map((p, i) => (
                    <div key={`${p.name}-${i}`} className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                      <img src={p.thumb} alt={p.name} className="w-full aspect-[3/4] object-cover" />
                      {(() => {
                        const need = photoShape(i, Math.max(photos.length, MIN_PHOTOS));
                        const ok = p.shape === need;
                        return (
                          <span
                            className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              ok ? "bg-black/65 text-white" : "bg-amber-500 text-black"
                            }`}
                            title={ok ? `Right shape (${need})` : `This one is ${p.shape === "H" ? "horizontal" : "vertical"} but this spot wants ${need === "H" ? "horizontal" : "vertical"}`}
                          >
                            {ok ? need : `Needs ${need}`}
                          </span>
                        );
                      })()}
                      <button
                        onClick={() => {
                          setPhotos((prev) => prev.filter((_, j) => j !== i));
                          setSelected(null);
                        }}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-zinc-200 hover:text-white"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1 py-1 text-[10px] text-zinc-200 bg-black/65">
                        <button onClick={() => movePhoto(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-30" aria-label="Move earlier">
                          <ChevronLeft size={12} />
                        </button>
                        <span className="truncate px-1">
                          {i + 1}. {photoRole(i, photos.length)}
                        </span>
                        <button onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1} className="p-0.5 disabled:opacity-30" aria-label="Move later">
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && !enoughPhotos && <p className="text-xs text-amber-400">Add {MIN_PHOTOS - photos.length} more to get going.</p>}
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">3. The treatment and reply word</p>
              <Field label="Treatment (becomes the magazine title)" value={treatment} onChange={setTreatment} placeholder="e.g. Polynucleotides" />
              <Field label="Reply word people comment" value={replyWord} onChange={setReplyWord} placeholder="e.g. GLOW" />
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">4. How should it sound</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStyle(s.key)}
                    aria-pressed={style === s.key}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      style === s.key ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-zinc-800 bg-zinc-900 hover:border-fuchsia-500/50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="block text-xs text-zinc-500 mt-0.5">{s.hint}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={writeCopy}
                disabled={writing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {writing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Writing your pages
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> {hasCopy ? "Write it again" : "Write my pages"}
                  </>
                )}
              </button>
            </section>
          </div>

          {/* RIGHT: preview, checks, editable copy */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <Move size={12} /> Move and resize your photos
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PAGE_TABS.map((t, i) => (
                  <button
                    key={t}
                    onClick={() => {
                      setActivePage(i);
                      setSelected(null);
                    }}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      activePage === i ? "bg-fuchsia-600 border-fuchsia-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <canvas
                ref={bigRef}
                width={540}
                height={720}
                onPointerDown={onBigDown}
                onPointerMove={onBigMove}
                onPointerUp={onBigUp}
                onPointerCancel={onBigUp}
                style={{ touchAction: "none" }}
                className="w-full max-w-sm aspect-[3/4] rounded-lg border border-zinc-800 bg-zinc-900"
                aria-label="Large page preview. Drag a photo to move it, scroll to zoom."
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">Drag a photo to slide it about inside its frame. Scroll over it, or use the slider, to zoom in.</p>
              {selected !== null && photos[selected] && (
                <div className="mt-2 flex items-center gap-3 max-w-sm">
                  <span className="text-[11px] text-zinc-400 shrink-0">Photo {selected + 1}</span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.01}
                    value={photos[selected].adjust.zoom}
                    onChange={(e) => updateAdjust(selected, (a) => ({ ...a, zoom: Number(e.target.value) }))}
                    className="flex-1 accent-fuchsia-500"
                    aria-label="Zoom"
                  />
                  <button onClick={() => updateAdjust(selected, () => ({ ...DEFAULT_ADJUST }))} className="text-[11px] text-fuchsia-400 underline shrink-0">
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Your 5 pages</p>
              <div className="grid grid-cols-5 gap-2">
                {PAGE_NAMES.map((name, i) => (
                  <canvas
                    key={name}
                    ref={(el) => {
                      canvasRefs.current[i] = el;
                    }}
                    width={432}
                    height={576}
                    className="w-full aspect-[3/4] rounded-md border border-zinc-800 bg-zinc-900"
                    aria-label={name}
                  />
                ))}
              </div>

              {blocking.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> {blocking.length} compliance {blocking.length === 1 ? "flag" : "flags"} to sort before you download or schedule
                  </p>
                  {blocking.map((f) => (
                    <div key={f.id} className="text-xs text-amber-100/90 flex items-start justify-between gap-3">
                      <span>
                        <strong>{f.where}:</strong> "{f.matched}". {f.reason}
                      </span>
                      {f.swap !== undefined && (
                        <button
                          onClick={() => setCopy((c) => setAt(c, f.field, applySwap(getAt(c, f.field), f.matched, f.swap as string)))}
                          className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
                        >
                          Swap
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={scheduleToClient}
                  disabled={preparing}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {preparing ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
                  {selectedClient ? `Schedule to ${selectedClient.name}` : "Schedule to a client"}
                </button>
                <button
                  onClick={downloadAll}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 hover:text-white text-sm font-semibold"
                >
                  <Download size={15} /> Download all 5 pages
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Scheduling sends the 5 pages as one carousel with the caption below, and you choose the day and time next. Downloads come in order, 1 to 5.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Change any words you like</p>
              <Field label="Cover title (the treatment)" value={copy.cover.title || treatment} onChange={set("cover.title")} />
              <Field label="Cover small heading" value={copy.cover.kicker} onChange={set("cover.kicker")} />
              <Field label="Cover tagline" value={copy.cover.tagline} onChange={set("cover.tagline")} />
              <div className="h-px bg-zinc-800" />
              <Field label="Fun facts page: small heading" value={copy.pages[0].kicker} onChange={set("pages.0.kicker")} />
              <Field label="Fun facts page: headline" value={copy.pages[0].headline} onChange={set("pages.0.headline")} />
              <Field label="Fun facts page: intro" value={copy.pages[0].intro} onChange={set("pages.0.intro")} rows={2} />
              {[0, 1, 2].map((f) => (
                <div key={f} className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-zinc-800">
                  <Field label={`Fun fact ${f + 1} label`} value={copy.pages[0].facts[f].label} onChange={set(`pages.0.facts.${f}.label`)} />
                  <Field label={`Fun fact ${f + 1} text`} value={copy.pages[0].facts[f].text} onChange={set(`pages.0.facts.${f}.text`)} rows={2} />
                </div>
              ))}
              {([1, 2] as const).map((p) => (
                <div key={p} className="space-y-3">
                  <div className="h-px bg-zinc-800" />
                  <Field label={`${p === 1 ? "This is for you if" : "Helps most with"}: small heading`} value={copy.pages[p].kicker} onChange={set(`pages.${p}.kicker`)} />
                  <Field label={`${p === 1 ? "This is for you if" : "Helps most with"}: headline`} value={copy.pages[p].headline} onChange={set(`pages.${p}.headline`)} />
                  <Field label={`${p === 1 ? "This is for you if" : "Helps most with"}: intro`} value={copy.pages[p].intro} onChange={set(`pages.${p}.intro`)} rows={2} />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Field key={i} label={`Line ${i + 1}`} value={(copy.pages[p] as ListPage).items[i]} onChange={set(`pages.${p}.items.${i}`)} />
                  ))}
                </div>
              ))}
              <div className="h-px bg-zinc-800" />
              <Field label="Last page top line" value={copy.cta.lead} onChange={set("cta.lead")} />
              <Field label="Last page reply word" value={copy.cta.word || replyWord} onChange={(v) => set("cta.word")(v.replace(/[^a-zA-Z0-9]/g, ""))} />
              <Field label="Last page line under the word" value={copy.cta.line} onChange={set("cta.line")} />
              <div className="h-px bg-zinc-800" />
              <Field label="Caption for the post" value={copy.caption} onChange={set("caption")} rows={5} />
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          Your photos stay in your browser until you schedule. Only the clinic name, the treatment and the reply word are sent off to write the words.
        </p>
      </div>

      {scheduleOpen && (
        <ScheduleModal
          presetId={presetId}
          presetName={selectedClient?.name}
          postType="carousel"
          posts={schedulePosts}
          presets={presets}
          sourceTool="Magazine Post"
          onClose={() => setScheduleOpen(false)}
          onSaved={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}
