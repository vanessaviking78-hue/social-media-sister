import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, Download, History, Loader2, Move, Play, Sparkles, Upload, Video, X } from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import { coverToCanvas, loadImageFromFile } from "@/lib/advent-door";
import type { NewsletterContent, NewsletterSection } from "@/lib/newsletter-pdf";
import { applySwap, isBlocking, scanOffer, scanText, type ComplianceFlag } from "@/lib/newsletter-compliance";
import {
  DEFAULT_ADJUST,
  EMPTY_MONTH,
  MS_H,
  MS_W,
  PAGE_FILES,
  PAGE_LABELS,
  PHOTO_LABELS,
  drawMonthPages,
  getPhotoHits,
  type MonthBrand,
  type PhotoAdjust,
} from "@/lib/month-start-pages";
import { MONTH_SECONDS, drawMonthFrame, exportMonthMp4 } from "@/lib/month-start-flip";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
}

const SLOT_META = [
  { label: "The Lead Story", hint: "The main read, e.g. October skin prep" },
  { label: "Ask the Clinician", hint: "A question patients ask, e.g. how long does filler last" },
  { label: "Myth vs Truth", hint: "A myth to bust, e.g. lip filler always looks obvious" },
  { label: "Behind the Scenes", hint: "Team news, new kit, the kettle drama" },
  { label: "Something for You", hint: "The seasonal nudge, e.g. party season skin" },
];

function monthOptions() {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 4; i++) {
    out.push(d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

// Logo URLs are stored absolute (sometimes with the API host), so pull just the path and fetch it same origin.
async function loadLogo(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    let src = url;
    try {
      const u = new URL(url, window.location.href);
      if (u.pathname.includes("/api/")) src = `${BASE}${u.pathname.slice(u.pathname.indexOf("/api/"))}`;
    } catch {
      /* keep as is */
    }
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("logo"));
      img.src = c.toDataURL("image/png");
    });
    return img;
  } catch {
    return null;
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

type Photo = { canvas: HTMLCanvasElement; thumb: string; name: string };
type Issue = { id: number; month_label: string; topics: string[]; content: NewsletterContent; created_at: string };

function PhotoSlot({
  label,
  n,
  photo,
  onFile,
  onClear,
}: {
  label: string;
  n: number;
  photo: Photo | null;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return photo ? (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
      <img src={photo.thumb} alt={label} className="w-full aspect-[3/4] object-cover" />
      <button
        onClick={onClear}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-zinc-200 hover:text-white"
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
      <p className="absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] text-zinc-300 bg-black/60 truncate">
        {n}. {label}
      </p>
    </div>
  ) : (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer.files?.[0]);
      }}
      className="flex flex-col items-center justify-center aspect-[3/4] border-2 border-dashed border-zinc-800 hover:border-amber-500/60 rounded-xl p-2 text-center cursor-pointer transition-colors"
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <Upload className="mb-1.5 text-zinc-600" size={18} />
      <p className="text-[11px] font-medium text-zinc-300">
        {n}. {label}
      </p>
    </label>
  );
}

function AutoText({ value, onChange, className, rows = 2 }: { value: string; onChange: (v: string) => void; className?: string; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none bg-zinc-950 border border-zinc-800 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm text-white ${className ?? ""}`}
    />
  );
}

const inputCls =
  "mt-1 w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600";

export default function MonthStart() {
  const { presets } = usePresets();
  const months = useMemo(monthOptions, []);
  const [presetId, setPresetId] = useState<number | "">("");
  const [monthLabel, setMonthLabel] = useState(months[1]);
  const [topics, setTopics] = useState<string[]>(["", "", "", "", ""]);
  const [offer, setOffer] = useState("");
  const [linkOverride, setLinkOverride] = useState("");
  const [content, setContent] = useState<NewsletterContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Issue[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null, null, null, null]);
  const [adjusts, setAdjusts] = useState<PhotoAdjust[]>(() => Array.from({ length: 5 }, () => ({ ...DEFAULT_ADJUST })));
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null, null]);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const flipRef = useRef<HTMLCanvasElement>(null);
  const pagesRef = useRef<HTMLCanvasElement[]>([]);
  const startRef = useRef<number>(performance.now());
  const dragRef = useRef<{ slot: number; x: number; y: number; inv: DOMMatrix; slackX: number; slackY: number } | null>(null);

  const preset = presets.find((p) => p.id === presetId);
  const bookingUrl = (linkOverride.trim() || preset?.bookingLink || "").trim();

  const brand: MonthBrand = {
    clinicName: preset?.name || "Your clinic",
    newsletterName: preset?.newsletterName?.trim() || "Catch Up from the Clinic",
    monthLabel,
    accent: preset?.accentColor || "#b76e79",
    logo,
    bookingUrl,
    address: preset?.clinicAddress?.trim() || "",
  };
  const shown = content ?? EMPTY_MONTH;

  // Clinic change: logo and past issues
  useEffect(() => {
    setLogo(null);
    setHistory([]);
    if (!preset) return;
    loadLogo(preset.logoUrl).then(setLogo);
    fetch(`${BASE}/api/newsletter/history/${preset.id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setHistory(d.issues ?? []))
      .catch(() => {});
  }, [preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateAdjust(slot: number, fn: (a: PhotoAdjust) => PhotoAdjust) {
    setAdjusts((prev) => {
      const next = [...prev];
      next[slot] = fn(prev[slot]);
      return next;
    });
  }

  const loadPhoto = useCallback(async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      const canvas = coverToCanvas(img);
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = { canvas, thumb: canvas.toDataURL("image/jpeg", 0.6), name: file.name };
        return next;
      });
      setAdjusts((prev) => {
        const next = [...prev];
        next[index] = { ...DEFAULT_ADJUST };
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read that image, try another file");
    }
  }, []);

  // Redraw the five pages a moment after anything changes.
  useEffect(() => {
    const id = setTimeout(() => {
      const pages = drawMonthPages(
        brand,
        shown,
        photos.map((p) => p?.canvas ?? null),
        adjusts
      );
      pagesRef.current = pages;
      pages.forEach((page, i) => {
        const t = thumbRefs.current[i];
        if (t) {
          const tctx = t.getContext("2d")!;
          tctx.clearRect(0, 0, t.width, t.height);
          tctx.drawImage(page, 0, 0, t.width, t.height);
        }
      });
      const big = bigRef.current;
      if (big && pages[activePage]) {
        const bctx = big.getContext("2d")!;
        bctx.clearRect(0, 0, big.width, big.height);
        bctx.drawImage(pages[activePage], 0, 0, big.width, big.height);
      }
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, photos, adjusts, activePage, preset?.id, monthLabel, logo, bookingUrl]);

  // Live preview of the page turning video.
  useEffect(() => {
    const canvas = flipRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const loop = () => {
      const pages = pagesRef.current;
      if (pages.length === 5) {
        const elapsed = (performance.now() - startRef.current) / 1000;
        const t = elapsed % (MONTH_SECONDS + 1.2);
        drawMonthFrame(ctx, pages, Math.min(t, MONTH_SECONDS - 0.01));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ----- dragging and zooming on the big page -----
  function hitAt(e: { clientX: number; clientY: number }) {
    const big = bigRef.current;
    if (!big) return null;
    const r = big.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * MS_W;
    const py = ((e.clientY - r.top) / r.height) * MS_H;
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
    const px = ((e.clientX - r.left) / r.width) * MS_W;
    const py = ((e.clientY - r.top) / r.height) * MS_H;
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

  // ----- writing the content -----
  async function generate() {
    if (!preset) {
      toast.error("Pick a clinic first");
      return;
    }
    if (topics.some((t) => !t.trim())) {
      toast.error("Add all five topics first");
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/newsletter/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ presetId: preset.id, topics, monthLabel, offer }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Writing failed");
      setContent(d.content);
      setHistory((h) => [{ id: d.id, month_label: d.monthLabel, topics, content: d.content, created_at: new Date().toISOString() }, ...h]);
      toast.success("Written and compliance checked. Have a read, then add your photos.");
    } catch (e: any) {
      toast.error(e?.message || "Writing failed");
    } finally {
      setGenerating(false);
    }
  }

  function loadIssue(issue: Issue) {
    setContent(issue.content);
    setMonthLabel(issue.month_label);
    setTopics(issue.content.sections?.map((s) => s.topic ?? "") ?? issue.topics);
    setShowHistory(false);
    toast.success(`Loaded ${issue.month_label}. Add your photos and it's ready.`);
  }

  // ----- compliance -----
  const flags: ComplianceFlag[] = useMemo(() => {
    const out: ComplianceFlag[] = [...scanOffer(offer)];
    if (!content) return out;
    content.sections.forEach((s, i) => {
      out.push(...scanText(s.heading, `${s.label} heading`, `s${i}.heading`));
      out.push(...scanText(s.body, s.label, `s${i}.body`));
    });
    out.push(...scanText(content.ctaText, "Button", "ctaText"));
    return out;
  }, [content, offer]);
  const blocking = flags.filter(isBlocking).length;

  const updateSection = (i: number, patch: Partial<NewsletterSection>) =>
    setContent((c) => (c ? { ...c, sections: c.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : c));

  function getField(c: NewsletterContent, field: string): string {
    if (field === "ctaText") return c.ctaText;
    const [si, key] = field.slice(1).split(".");
    return (c.sections[+si] as any)[key];
  }
  function setField(c: NewsletterContent, field: string, v: string): NewsletterContent {
    if (field === "ctaText") return { ...c, ctaText: v };
    const [si, key] = field.slice(1).split(".");
    return { ...c, sections: c.sections.map((s, i) => (i === +si ? { ...s, [key]: v } : s)) };
  }
  function fixFlag(f: ComplianceFlag) {
    if (!f.swap || f.field === "offer") return;
    setContent((c) => (c ? setField(c, f.field, applySwap(getField(c, f.field), f.matched, f.swap!)) : c));
  }
  function fixAll() {
    setContent((c) => {
      if (!c) return c;
      let next = c;
      flags
        .filter((f) => f.swap && f.field !== "offer")
        .forEach((f) => {
          next = setField(next, f.field, applySwap(getField(next, f.field), f.matched, f.swap!));
        });
      return next;
    });
  }

  function okToDownload() {
    if (!content) {
      toast.error("Write the content or load a saved newsletter first");
      return false;
    }
    if (blocking > 0) {
      toast.error(`${blocking} compliance flag${blocking > 1 ? "s" : ""} still showing. Sort ${blocking > 1 ? "them" : "it"} before this goes out.`);
      return false;
    }
    return true;
  }

  // ----- downloads -----
  async function downloadPages() {
    if (!okToDownload()) return;
    const pages = pagesRef.current;
    const base = `${slug(brand.clinicName)}-${slug(monthLabel)}`;
    for (let i = 0; i < pages.length; i++) {
      const blob: Blob | null = await new Promise((res) => pages[i].toBlob(res, "image/png"));
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      download(url, `${base}-${i + 1}-${PAGE_FILES[i]}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      await new Promise((r) => setTimeout(r, 400));
    }
    toast.success("5 pages downloaded, in order.");
  }

  async function downloadVideo() {
    if (!okToDownload()) return;
    setProgress(0);
    try {
      const blob = await exportMonthMp4(pagesRef.current, setProgress);
      const url = URL.createObjectURL(blob);
      download(url, `${slug(brand.clinicName)}-${slug(monthLabel)}-month-start.mp4`);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      toast.success("Your video is ready and downloading");
    } catch (e: any) {
      toast.error(e?.message || "The video would not build, try again");
    } finally {
      setProgress(null);
    }
  }

  const sevStyle = (s: ComplianceFlag["severity"]) =>
    s === "high" ? "border-red-500/50 bg-red-500/10 text-red-200" : s === "medium" ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-zinc-700 bg-zinc-800/60 text-zinc-300";

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
              <Sparkles className="w-6 h-6 text-amber-400" /> Month Start
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Same details as the Newsletter Maker, but you get a five page magazine. Post the pages as a carousel or download the page turning video.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-8 items-start">
          {/* LEFT: inputs */}
          <div className="space-y-7">
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">1. The clinic and the issue</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500">Clinic</span>
                  <select
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : "")}
                    className={inputCls}
                  >
                    <option value="">Choose a clinic...</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500">Issue</span>
                  <select value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} className={inputCls}>
                    {[...new Set([monthLabel, ...months])].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              {preset && history.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
                  >
                    <History size={13} /> Use a saved newsletter ({history.length})
                  </button>
                  {showHistory && (
                    <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 max-h-56 overflow-auto">
                      {history.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => loadIssue(h)}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-sm flex justify-between gap-3"
                        >
                          <span className="font-semibold">{h.month_label}</span>
                          <span className="text-zinc-500 text-xs truncate">
                            {h.content?.sections?.[0]?.heading ?? ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">2. Five things to talk about</p>
              {SLOT_META.map((m, i) => (
                <div key={m.label}>
                  <p className="text-xs text-zinc-300 mb-1">
                    <span className="text-amber-400 font-semibold">{i + 1}.</span> {m.label}
                  </p>
                  <input
                    value={topics[i]}
                    onChange={(e) => setTopics((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={m.hint}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 outline-none rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600"
                  />
                </div>
              ))}
              <label className="block">
                <span className="block text-[11px] uppercase tracking-widest text-zinc-500">Offer (optional)</span>
                <textarea
                  rows={2}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="e.g. Complimentary skin consultation with any facial booked in November"
                  className={`${inputCls} resize-none`}
                />
              </label>
              <label className="block">
                <span className="block text-[11px] uppercase tracking-widest text-zinc-500">Link for this issue (optional)</span>
                <input
                  value={linkOverride}
                  onChange={(e) => setLinkOverride(e.target.value)}
                  placeholder={preset?.bookingLink || "Overrides the booking link just for this one"}
                  className={inputCls}
                />
              </label>
              <button
                onClick={generate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Writing your month...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Write my month
                  </>
                )}
              </button>
              <p className="text-[11px] text-zinc-500">
                It writes in the clinic's saved voice and runs the same compliance check as the newsletter. The issue is also saved to that clinic's newsletter history.
              </p>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">3. Photos (all optional)</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PHOTO_LABELS.map((label, i) => (
                  <PhotoSlot
                    key={label}
                    label={label}
                    n={i + 1}
                    photo={photos[i]}
                    onFile={(f) => loadPhoto(i, f)}
                    onClear={() =>
                      setPhotos((prev) => {
                        const next = [...prev];
                        next[i] = null;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </section>

            {content && (
              <section className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">4. Change any words you like</p>

                <div
                  className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                    flags.length === 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {flags.length === 0 ? <Check size={14} /> : <AlertTriangle size={14} />}
                  <span className="flex-1">
                    {flags.length === 0
                      ? "Compliance check: all clear"
                      : `${flags.length} thing${flags.length > 1 ? "s" : ""} to look at${blocking ? `, ${blocking} must be fixed before you download` : ""}`}
                  </span>
                  {flags.some((f) => f.swap && f.field !== "offer") && (
                    <button onClick={fixAll} className="underline hover:no-underline">
                      Fix all
                    </button>
                  )}
                </div>
                {flags.length > 0 && (
                  <div className="space-y-1.5">
                    {flags.map((f, i) => (
                      <div key={i} className={`rounded-md border px-2.5 py-1.5 text-xs flex gap-2 ${sevStyle(f.severity)}`}>
                        <span className="flex-1">
                          <span className="font-semibold">{f.where}:</span> &ldquo;{f.matched.trim()}&rdquo; {f.reason}
                        </span>
                        {f.swap && f.field !== "offer" && (
                          <button onClick={() => fixFlag(f)} className="shrink-0 underline hover:no-underline">
                            {"→"} {f.swap.trim() || "remove"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {content.sections.map((s, i) => (
                  <div key={s.slot} className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">
                      {i + 1}. {s.label}
                    </p>
                    <AutoText value={s.heading} onChange={(v) => updateSection(i, { heading: v })} rows={1} className="font-semibold" />
                    <AutoText value={s.body} onChange={(v) => updateSection(i, { body: v })} rows={4} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">Button words</p>
                  <AutoText value={content.ctaText} onChange={(v) => setContent((c) => (c ? { ...c, ctaText: v } : c))} rows={1} />
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: pages, adjust, video */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <Move size={12} /> Your 5 pages
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PAGE_LABELS.map((t, i) => (
                  <button
                    key={t}
                    onClick={() => {
                      setActivePage(i);
                      setSelected(null);
                    }}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      activePage === i
                        ? "bg-amber-600 border-amber-500 text-white"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {i + 1}. {t}
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
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Drag a photo to slide it about inside its frame. Scroll over it, or use the slider, to zoom in.
              </p>
              {selected !== null && photos[selected] && (
                <div className="mt-2 flex items-center gap-3 max-w-sm">
                  <span className="text-[11px] text-zinc-400 shrink-0">{PHOTO_LABELS[selected]}</span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.01}
                    value={adjusts[selected].zoom}
                    onChange={(e) => updateAdjust(selected, (a) => ({ ...a, zoom: Number(e.target.value) }))}
                    className="flex-1 accent-amber-500"
                    aria-label="Zoom"
                  />
                  <button
                    onClick={() => updateAdjust(selected, () => ({ ...DEFAULT_ADJUST }))}
                    className="text-[11px] text-amber-400 underline shrink-0"
                  >
                    Reset
                  </button>
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                {PAGE_LABELS.map((name, i) => (
                  <button key={name} onClick={() => setActivePage(i)} aria-label={`Show page ${i + 1}`}>
                    <canvas
                      ref={(el) => {
                        thumbRefs.current[i] = el;
                      }}
                      width={216}
                      height={288}
                      className={`w-full aspect-[3/4] rounded border ${activePage === i ? "border-amber-500" : "border-zinc-800"} bg-zinc-900`}
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={downloadPages}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 hover:text-white text-sm font-semibold"
              >
                <Download size={15} /> Download all 5 pages (PNG, carousel ready)
              </button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <Video size={12} /> The page turning video
              </p>
              <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[3/4] max-w-xs">
                <canvas ref={flipRef} width={MS_W} height={MS_H} className="w-full h-full" />
              </div>
              <div className="flex gap-2 max-w-xs mt-2">
                <button
                  onClick={() => (startRef.current = performance.now())}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-sm"
                >
                  <Play size={14} /> Replay
                </button>
                <button
                  onClick={downloadVideo}
                  disabled={progress !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {progress !== null ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Building {Math.round(progress * 100)}%
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Make my MP4
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 max-w-xs">1080 x 1440, 12 seconds. Chrome or Edge gives the quickest export.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">Your photos stay in your browser. Only the clinic, the month, the five topics and the offer are sent off to write the words.</p>
      </div>
    </div>
  );
}
