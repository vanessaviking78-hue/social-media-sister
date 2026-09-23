import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2,
  CheckCircle2, X, CalendarDays, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// How it works now:
//   1. Pick a client
//   2. Upload a CSV with one row: the hook
//   3. Upload the story images
//   -> one story per image, one per day, at 7pm, starting tomorrow.
// Instagram does not display captions or stickers on stories published via the
// Graph API, so the hook is printed onto each 1080x1920 image before upload.

const MAX_IMAGES = 31;
const DEFAULT_TIME = "19:00";
const STORY_W = 1080;
const STORY_H = 1920;

// --- CSV ---

function downloadTemplate() {
  const csv = `"hook"\n"The one question every patient asks me before their first treatment"`;
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "story-hook-template.csv");
}

/** Pull the hook out of a one-row CSV. A "hook" header row is optional. */
function extractHook(rows: string[][]): string {
  const cells = rows
    .map((r) => r.map((c) => (c ?? "").trim()).filter(Boolean))
    .filter((r) => r.length > 0);
  if (!cells.length) return "";
  const first = cells[0];
  const headerIdx = first.findIndex((c) => c.toLowerCase() === "hook");
  if (headerIdx >= 0) {
    const next = cells[1];
    if (!next) return "";
    return (next[headerIdx] ?? next[0] ?? "").trim();
  }
  return first[0];
}

// --- Dates ---

function toYmd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tomorrowYmd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toYmd(d);
}

/** Local date/time for story i (handles the clocks changing). */
function slotFor(startYmd: string, time: string, i: number): Date {
  const [y, m, d] = startYmd.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d + i, hh, mm, 0, 0);
}

function niceDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function niceTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "");
}

// --- Rendering ---

type TextPos = "top" | "middle" | "bottom";

type RenderOpts = {
  hook: string;
  showHook: boolean;
  fontSize: number;
  position: TextPos;
  boxColour: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function drawStory(canvas: HTMLCanvasElement, imgUrl: string, opts: RenderOpts) {
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(imgUrl);

  // Cover-fit the photo into 9:16
  const scale = Math.max(STORY_W / img.width, STORY_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.drawImage(img, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);

  if (!opts.showHook || !opts.hook.trim()) return;

  try { await document.fonts.load(`${opts.fontSize}px "Bebas Neue"`); } catch { /* fallback font */ }

  const maxTextW = STORY_W * 0.78;
  let fs = opts.fontSize;
  let lines: string[] = [];
  const measure = () => {
    ctx.font = `${fs}px "Bebas Neue", Impact, sans-serif`;
    lines = wrapLines(ctx, opts.hook.trim().toUpperCase(), maxTextW);
  };
  measure();
  while (lines.length > 6 && fs > 48) { fs -= 6; measure(); }

  const lh = fs * 1.08;
  const padX = 48;
  const padY = 36;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = Math.min(STORY_W - 80, textW + padX * 2);
  const boxH = lines.length * lh + padY * 2;

  // Keep clear of Instagram's own UI at the top (profile bar) and bottom (reply box)
  const centreY =
    opts.position === "top" ? 330 + boxH / 2
    : opts.position === "bottom" ? STORY_H - 380 - boxH / 2
    : STORY_H / 2;
  const boxX = (STORY_W - boxW) / 2;
  const boxY = centreY - boxH / 2;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = opts.boxColour;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 28);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    ctx.fillText(line, STORY_W / 2, boxY + padY + lh * i + lh / 2);
  });
}

async function renderStoryFile(imgUrl: string, opts: RenderOpts, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  await drawStory(canvas, imgUrl, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(new File([blob], name, { type: "image/jpeg" })) : reject(new Error("Render failed")),
      "image/jpeg",
      0.88,
    );
  });
}

// --- Upload ---

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadOne(file: File): Promise<string> {
  const res = await fetch(`${BASE}/api/content/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: [{ name: file.name, base64: await toBase64(file) }] }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
    throw new Error(data.error || "Upload failed");
  }
  const data = await res.json();
  const url = data.results?.[0]?.url;
  if (!url) throw new Error("Upload returned no URL");
  return url;
}

// --- Live preview thumbnail ---

function StoryThumb({ imgUrl, opts, className }: { imgUrl: string; opts: RenderOpts; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawStory(ref.current, imgUrl, opts).catch(() => {});
  }, [imgUrl, opts]);
  return <canvas ref={ref} className={className} style={{ aspectRatio: "9 / 16" }} />;
}

// --- Main ---

type ImageItem = { file: File; localUrl: string; status: "idle" | "working" | "done" | "error"; error?: string };
type Phase = "setup" | "scheduling" | "done";

export default function BulkStories() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState("");
  const [hook, setHook] = useState("");
  const [csvName, setCsvName] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [startDate, setStartDate] = useState(tomorrowYmd());
  const [time, setTime] = useState(DEFAULT_TIME);
  const [showHook, setShowHook] = useState(true);
  const [fontSize, setFontSize] = useState(96);
  const [position, setPosition] = useState<TextPos>("top");
  const [phase, setPhase] = useState<Phase>("setup");
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [imgDragOver, setImgDragOver] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find((p) => String(p.id) === presetId);

  const renderOpts: RenderOpts = useMemo(() => ({
    hook,
    showHook,
    fontSize,
    position,
    boxColour: selectedPreset?.accentColor || "#e91976",
  }), [hook, showHook, fontSize, position, selectedPreset?.accentColor]);

  const slots = useMemo(
    () => images.map((_, i) => slotFor(startDate, time, i)),
    [images, startDate, time],
  );

  const handleCsv = useCallback((file: File) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const h = extractHook(result.data as string[][]);
        if (!h) { toast.error("Couldn't find a hook in that CSV"); return; }
        setHook(h);
        setCsvName(file.name);
        toast.success("Hook loaded");
      },
      error: () => toast.error("Could not read that CSV"),
    });
  }, []);

  const handleImages = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (valid.length > room) toast.error(`Only ${MAX_IMAGES} images at a time, extras skipped`);
      const add = valid.slice(0, Math.max(0, room)).map((f) => ({
        file: f, localUrl: URL.createObjectURL(f), status: "idle" as const,
      }));
      return [...prev, ...add];
    });
  }, []);

  const moveImage = useCallback((from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }, []);

  const firstSlotInPast = slots.length > 0 && slots[0].getTime() <= Date.now();
  const ready = !!presetId && !!hook.trim() && images.length > 0 && !firstSlotInPast;

  const handleSchedule = useCallback(async () => {
    if (!selectedPreset) { toast.error("Pick a client first"); return; }
    if (!hook.trim()) { toast.error("Upload your hook CSV first"); return; }
    if (!images.length) { toast.error("Add at least one image"); return; }
    if (firstSlotInPast) { toast.error("The first story would be in the past, pick a later start date"); return; }

    setPhase("scheduling");
    setImages((prev) => prev.map((im) => ({ ...im, status: "idle", error: undefined })));

    for (let i = 0; i < images.length; i++) {
      const when = slotFor(startDate, time, i);
      setImages((prev) => prev.map((im, j) => j === i ? { ...im, status: "working" } : im));
      try {
        const file = await renderStoryFile(images[i].localUrl, renderOpts, `story-${toYmd(when)}-${i + 1}.jpg`);
        const imageUrl = await uploadOne(file);
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: Number(presetId),
            postType: "story",
            content: {
              imageUrls: [imageUrl],
              caption: hook.trim(),
              title: `Story — ${selectedPreset.name} ${toYmd(when)}`,
            },
            scheduledAt: when.toISOString(),
            stickerConfig: null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Scheduling failed" }));
          throw new Error(data.error || "Scheduling failed");
        }
        setImages((prev) => prev.map((im, j) => j === i ? { ...im, status: "done" } : im));
      } catch (err: any) {
        setImages((prev) => prev.map((im, j) => j === i ? { ...im, status: "error", error: err.message } : im));
      }
    }
    setPhase("done");
  }, [selectedPreset, hook, images, firstSlotInPast, startDate, time, renderOpts, presetId]);

  const resetAll = () => {
    setImages([]);
    setHook("");
    setCsvName("");
    setStartDate(tomorrowYmd());
    setPhase("setup");
  };

  // --- Scheduling / done ---

  if (phase !== "setup") {
    const done = images.filter((i) => i.status === "done").length;
    const failed = images.filter((i) => i.status === "error");
    const finished = done + failed.length;
    const pct = images.length ? Math.round((finished / images.length) * 100) : 0;

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white">
        <div className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
          <Link href="/hub">
            <button className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <h1 className="font-semibold text-base">Bulk Story Scheduler</h1>
        </div>

        <div className="max-w-lg mx-auto px-6 py-12 flex flex-col items-center gap-6 text-center">
          {phase === "scheduling" ? (
            <>
              <Loader2 size={36} className="text-pink-400 animate-spin" />
              <div>
                <p className="text-lg font-semibold">Scheduling stories...</p>
                <p className="text-sm text-zinc-500 mt-1">{finished} of {images.length} done</p>
              </div>
              <div className="w-56 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{done} {done === 1 ? "story" : "stories"} scheduled</p>
                {slots.length > 0 && done > 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    {niceTime(slots[0])} daily, {niceDate(slots[0])} to {niceDate(slots[slots.length - 1])}
                  </p>
                )}
                {failed.length > 0 && <p className="text-sm text-red-400 mt-1">{failed.length} failed</p>}
              </div>

              {failed.length > 0 && (
                <div className="w-full border border-red-500/20 rounded-xl overflow-hidden text-left">
                  {images.map((im, i) => im.status === "error" && (
                    <div key={i} className="px-4 py-2.5 border-b border-white/5 last:border-0 flex items-start gap-3">
                      <X size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-zinc-300">Story {i + 1} ({niceDate(slots[i])})</p>
                        <p className="text-xs text-zinc-600">{im.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Link href="/scheduler">
                  <Button variant="secondary">View Scheduler Queue</Button>
                </Link>
                <Button onClick={resetAll} className="bg-pink-600 hover:bg-pink-500 text-white">
                  Schedule Another Batch
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Setup ---

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      <div className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
        <Link href="/hub">
          <button className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-base leading-none">Bulk Story Scheduler</h1>
          <p className="text-xs text-zinc-500 mt-1">One hook, a pile of images, one story a day at 7pm.</p>
        </div>
        {(images.length > 0 || hook) && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-white/8"
          >
            <X size={12} /> Clear All
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* 1. Client */}
        <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">1. Client</p>
          <Select value={presetId} onValueChange={setPresetId} disabled={presetsLoading}>
            <SelectTrigger className="bg-zinc-900 border-white/10 text-sm">
              <SelectValue placeholder={presetsLoading ? "Loading..." : "Pick a client"} />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Hook CSV */}
        <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">2. Hook CSV</p>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-pink-400 transition-colors">
              <Download size={12} /> Download template
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
            onDragLeave={() => setCsvDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setCsvDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleCsv(f);
            }}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
              csvDragOver ? "border-pink-500/60 bg-pink-500/5" : "border-white/10 hover:border-white/20"
            }`}
          >
            <FileText size={24} className="text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">{csvName || "Drop your one-row CSV here or click to browse"}</p>
            <p className="text-xs text-zinc-600">Just the hook in the first cell. A "hook" header row is optional.</p>
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); e.target.value = ""; }}
          />

          {hook && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] text-zinc-500">Hook (tweak it here if you like)</p>
              <textarea
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-pink-500/50"
              />
            </div>
          )}
        </div>

        {/* 3. Images */}
        <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
              3. Story Images
              <span className="ml-2 text-zinc-600 normal-case font-normal">{images.length} / {MAX_IMAGES}</span>
            </p>
            {images.length > 0 && (
              <button onClick={() => setImages([])} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">Clear</button>
            )}
          </div>

          {images.length < MAX_IMAGES && (
            <div
              onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
              onDragLeave={() => setImgDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImgDragOver(false);
                handleImages(Array.from(e.dataTransfer.files));
              }}
              onClick={() => imgInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                imgDragOver ? "border-pink-500/60 bg-pink-500/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <Upload size={24} className="text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Drop images here or click to browse</p>
              <p className="text-xs text-zinc-600">One image = one day. They go out in the order shown below.</p>
            </div>
          )}
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { handleImages(Array.from(e.target.files || [])); e.target.value = ""; }}
          />
        </div>

        {/* 4. When + look */}
        <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">4. When and how it looks</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1"><CalendarDays size={11} /> First story</span>
              <input
                type="date"
                value={startDate}
                min={toYmd(new Date())}
                onChange={(e) => e.target.value && setStartDate(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 [color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Clock size={11} /> Time each day</span>
              <input
                type="time"
                value={time}
                onChange={(e) => e.target.value && setTime(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 [color-scheme:dark]"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={showHook} onChange={(e) => setShowHook(e.target.checked)} className="h-4 w-4 accent-pink-500" />
            Print the hook on each story (Instagram won't show it otherwise)
          </label>

          {showHook && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-500">Text size ({fontSize})</span>
                <input type="range" min={56} max={160} step={4} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="accent-pink-500" />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-500">Position</span>
                <div className="flex gap-1">
                  {(["top", "middle", "bottom"] as TextPos[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPosition(p)}
                      className={`flex-1 text-xs capitalize py-1.5 rounded-md border transition-colors ${
                        position === p ? "bg-pink-600 border-pink-500 text-white" : "border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {images.length > 0 && (
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">Preview</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((im, i) => (
                <div key={im.localUrl} className="flex flex-col gap-1.5 group">
                  <div className="relative">
                    <StoryThumb imgUrl={im.localUrl} opts={renderOpts} className="w-full rounded-lg border border-white/10 bg-zinc-900" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-1 left-1 right-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveImage(i, i - 1)} disabled={i === 0} className="px-2 py-0.5 text-xs rounded bg-black/70 disabled:opacity-30">←</button>
                      <button onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} className="px-2 py-0.5 text-xs rounded bg-black/70 disabled:opacity-30">→</button>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 text-center leading-tight">
                    {niceDate(slots[i])}<br /><span className="text-zinc-600">{niceTime(slots[i])}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {firstSlotInPast && (
          <p className="text-xs text-amber-300">The first slot has already passed today, pick a later start date.</p>
        )}

        <Button
          onClick={handleSchedule}
          disabled={!ready}
          className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold"
          size="lg"
        >
          <CalendarDays size={15} className="mr-1.5" />
          {images.length
            ? `Schedule ${images.length} ${images.length === 1 ? "story" : "stories"}, ${niceTime(slotFor(startDate, time, 0))} daily`
            : "Schedule stories"}
        </Button>
      </div>
    </div>
  );
}
