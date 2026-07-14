import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, CalendarClock, X, Film, Scissors, Sparkles, FileText, Download, Music, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";
import { nextWeekday, WEEKDAY, POST_TIME } from "@/lib/schedule";
import { toast } from "sonner";
import Papa from "papaparse";
import { normalizeSlideCsvForHeaders, readFileAsText } from "@/lib/csv-format";
import { saveAs } from "file-saver";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";

const BASE = import.meta.env.BASE_URL || "/";

// Same column shape as the other bulk carousel tools, so the CSVs you already
// know how to build work here too. Slide 1 gets the hook + subtitle, slides 2
// and 3 get their body line, slide 4 gets the CTA — always 4 slides.
const CSV_COLS = ["slide1_hook", "slide1_subtitle", "slide2_body", "slide3_body", "slide4_cta"] as const;

type SlideBlocks = {
  hook: string;
  subtitle: string;
  body2: string;
  body3: string;
  cta: string;
};

function emptyBlocks(): SlideBlocks {
  return { hook: "", subtitle: "", body2: "", body3: "", cta: "" };
}

type Item = {
  id: string;
  file: File;
  url: string;
  caption: string;
  date: string;
  time: string;
  slices: number;
  slideBlocks: SlideBlocks | null;
  musicTrack: MusicTrack | null;
  status: "" | "splitting" | "captioning" | "uploading" | "scheduling" | "done" | "error";
  note?: string;
};

// Spread items across upcoming days starting from the next Wednesday, one per week.
function defaultDate(i: number): string {
  const first = new Date(`${nextWeekday(WEEKDAY.WED, POST_TIME)}T${POST_TIME}`);
  const d = new Date(first);
  d.setDate(d.getDate() + i * 7);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeSampleCsv(): string {
  return [
    CSV_COLS.join(","),
    "Your headline hook here,A short supporting subtitle,Body copy for slide two goes here.,Body copy for slide three goes here.,Book your consultation today",
  ].join("\n");
}

// Builds the four per-slice text layers ffmpeg will burn onto the split clips.
// Slide 1 carries two lines (hook, bigger; subtitle, smaller) stacked together.
// Also used to drive the live canvas preview, so what you see matches what gets burned in.
function buildTextLayers(sb: SlideBlocks | null): Array<Array<{ text: string; fontSize: number; yFrac: number }>> {
  if (!sb) return [[], [], [], []];
  const slide1 = [
    { text: sb.hook, fontSize: 64, yFrac: 0.64 },
    { text: sb.subtitle, fontSize: 34, yFrac: 0.75 },
  ].filter((l) => l.text.trim());
  const slide2 = sb.body2.trim() ? [{ text: sb.body2, fontSize: 42, yFrac: 0.85 }] : [];
  const slide3 = sb.body3.trim() ? [{ text: sb.body3, fontSize: 42, yFrac: 0.85 }] : [];
  const slide4 = sb.cta.trim() ? [{ text: sb.cta, fontSize: 46, yFrac: 0.85 }] : [];
  return [slide1, slide2, slide3, slide4];
}

// Consumes the /api/content/captions SSE stream and returns the finished array
// of captions once the "complete" event lands.
async function fetchCaptions(payload: Record<string, unknown>): Promise<string[]> {
  const resp = await fetch(`${BASE}api/content/captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok || !resp.body) throw new Error("Caption generation failed");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let captions: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      const line = part.replace(/^data:\s*/, "").trim();
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.type === "complete" && Array.isArray(evt.captions)) captions = evt.captions;
      if (evt.type === "error") throw new Error(evt.message || "Caption generation failed");
    }
  }
  return captions;
}

// Short label for a CSV row, used in the per-video title picker.
function rowLabel(sb: SlideBlocks, i: number): string {
  const hook = sb.hook.trim();
  return hook ? `${i + 1}. ${hook.slice(0, 60)}${hook.length > 60 ? "…" : ""}` : `Row ${i + 1} (no hook)`;
}

const SLIDE_LABELS = ["Slide 1 · Hook", "Slide 2 · Body", "Slide 3 · Body", "Slide 4 · CTA"];

// Live preview of the 4 slides: draws the matching horizontal strip of the
// source video onto a canvas per slide, then overlays the same text layers
// ffmpeg will burn in server-side, at the same relative size and position.
// Also doubles as the editor — the text fields underneath write straight
// back into the video's slideBlocks.
function SlidePreviewModal({ item, onClose, onUpdateBlocks }: { item: Item; onClose: () => void; onUpdateBlocks: (blocks: SlideBlocks) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const [scrub, setScrub] = useState(0.5);
  const blocks = item.slideBlocks || emptyBlocks();

  const draw = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const sliceW = vw / 4;
    const layers = buildTextLayers(item.slideBlocks);
    canvasRefs.forEach((ref, i) => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      try {
        ctx.drawImage(video, i * sliceW, 0, sliceW, vh, 0, 0, cw, ch);
      } catch {
        // frame not ready yet, skip
      }
      const scale = cw / sliceW;
      for (const line of layers[i] || []) {
        if (!line.text.trim()) continue;
        const fontSize = Math.max(8, line.fontSize * scale);
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        const maxWidth = cw * 0.86;
        const words = line.text.trim().split(/\s+/);
        const wrapped: string[] = [];
        let cur = "";
        for (const w of words) {
          const t = cur ? `${cur} ${w}` : w;
          if (ctx.measureText(t).width > maxWidth && cur) { wrapped.push(cur); cur = w; } else cur = t;
        }
        if (cur) wrapped.push(cur);
        const lineH = fontSize * 1.15;
        const totalH = wrapped.length * lineH;
        const topY = ch * line.yFrac - totalH / 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, topY - 6, cw, totalH + 12);
        ctx.fillStyle = "#fff";
        let y = topY + fontSize * 0.8;
        for (const l of wrapped) {
          ctx.fillText(l, cw / 2, y);
          y += lineH;
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slideBlocks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => { video.currentTime = video.duration * scrub; };
    const onSeeked = () => draw();
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    if (video.readyState >= 1 && video.duration) video.currentTime = video.duration * scrub;
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { draw(); }, [item.slideBlocks, draw]);

  function handleScrub(v: number) {
    setScrub(v);
    const video = videoRef.current;
    if (video && video.duration) video.currentTime = video.duration * v;
  }

  function setField(field: keyof SlideBlocks, value: string) {
    onUpdateBlocks({ ...blocks, [field]: value });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2"><Eye className="w-5 h-5 text-pink-400" /> Preview &amp; edit slides</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <video ref={videoRef} src={item.url} muted playsInline className="hidden" />
        <div>
          <label className="text-xs text-muted-foreground">Preview frame (scrub through the video)</label>
          <input type="range" min={0} max={1} step={0.01} value={scrub} onChange={(e) => handleScrub(Number(e.target.value))} className="w-full accent-pink-500" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <canvas ref={canvasRefs[i]} width={162} height={216} className="w-full rounded-lg border border-white/10 bg-black" />
              <p className="text-[11px] text-muted-foreground text-center">{SLIDE_LABELS[i]}</p>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/20">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Hook (slide 1, big)</label>
            <input value={blocks.hook} onChange={(e) => setField("hook", e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subtitle (slide 1, small)</label>
            <input value={blocks.subtitle} onChange={(e) => setField("subtitle", e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Slide 2 body</label>
            <input value={blocks.body2} onChange={(e) => setField("body2", e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Slide 3 body</label>
            <input value={blocks.body3} onChange={(e) => setField("body3", e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Slide 4 CTA</label>
            <input value={blocks.cta} onChange={(e) => setField("cta", e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">This is a close preview, not pixel-perfect — actual burn-in happens when you cut and schedule.</p>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

export default function AnimatedCarousels() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  // Every row parsed from the last slide-text CSV, kept around so each video
  // can pick which title/row to use from a dropdown, same as the other tools.
  const [csvRows, setCsvRows] = useState<SlideBlocks[]>([]);
  const [musicPickerId, setMusicPickerId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) || null, [presets, presetId]);
  const previewItem = items.find((it) => it.id === previewId) || null;

  function addFiles(files: FileList | null) {
    if (!files) return;
    const vids = Array.from(files).filter((f) => f.type.startsWith("video/") || f.name.toLowerCase().endsWith(".mp4"));
    if (!vids.length) { toast.error("Please choose MP4 video files."); return; }
    setItems((prev) => {
      const start = prev.length;
      const next = vids.map((f, k) => ({
        id: `v-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        url: URL.createObjectURL(f),
        caption: "",
        date: defaultDate(start + k),
        time: POST_TIME,
        slices: 4,
        slideBlocks: null,
        musicTrack: null,
        status: "" as const,
      }));
      return [...prev, ...next];
    });
    toast.success(`${vids.length} video${vids.length !== 1 ? "s" : ""} added.`);
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Optional CSV: columns caption,date,time — applied to items by row order.
  function importCsv(file: File) {
    const rd = new FileReader();
    rd.onload = () => {
      const lines = String(rd.result).split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) return;
      const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const ci = head.indexOf("caption"), di = head.indexOf("date"), ti = head.indexOf("time");
      const rows = lines.slice(1).map((l) => l.split(","));
      setItems((prev) => prev.map((it, k) => {
        const r = rows[k]; if (!r) return it;
        return {
          ...it,
          caption: ci >= 0 ? (r[ci] || it.caption).trim() : it.caption,
          date: di >= 0 && r[di] ? r[di].trim() : it.date,
          time: ti >= 0 && r[ti] ? r[ti].trim() : it.time,
        };
      }));
      toast.success("Captions and dates applied from CSV.");
    };
    rd.readAsText(file);
  }

  // Slide-text CSV: same 5-column shape as the bulk carousel tool. Every row
  // is kept in csvRows so you can pick which title/row goes on which video
  // from a dropdown — it isn't silently matched by order. As a starting
  // point rows are still assigned to videos in order, but you can change any
  // of them afterwards.
  function importSlideTextCsv(file: File) {
    readFileAsText(file).then((raw) => {
    const normalized = normalizeSlideCsvForHeaders(raw, [...CSV_COLS]);
    Papa.parse<Record<string, string>>(normalized, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const missing = CSV_COLS.filter((c) => !fields.includes(c));
        if (missing.length) {
          toast.error(`Missing columns: ${missing.join(", ")}`);
          return;
        }
        const rows: SlideBlocks[] = results.data.map((r) => ({
          hook: (r.slide1_hook || "").trim(),
          subtitle: (r.slide1_subtitle || "").trim(),
          body2: (r.slide2_body || "").trim(),
          body3: (r.slide3_body || "").trim(),
          cta: (r.slide4_cta || "").trim(),
        }));
        if (!rows.length) { toast.error("No rows found in that CSV."); return; }
        setCsvRows(rows);
        setItems((prev) => prev.map((it, k) => (rows[k] ? { ...it, slideBlocks: rows[k] } : it)));
        toast.success(`${rows.length} title${rows.length !== 1 ? "s" : ""} loaded. Pick which one goes on each video below.`);
      },
      error: (err) => toast.error(err.message),
    });
    });
  }

  // Assign a specific CSV row (by index into csvRows) to a video, or clear it.
  function assignSlideText(id: string, rowIndex: number) {
    const sb = rowIndex >= 0 ? csvRows[rowIndex] : null;
    update(id, { slideBlocks: sb });
  }

  async function generateCaption(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (!preset) { toast.error("Pick a client first."); return; }
    update(id, { status: "captioning" });
    try {
      const context = it.slideBlocks
        ? [it.slideBlocks.hook, it.slideBlocks.subtitle, it.slideBlocks.body2, it.slideBlocks.body3, it.slideBlocks.cta].filter((s) => s.trim())
        : [it.file.name.replace(/\.[^.]+$/, "")];
      const captions = await fetchCaptions({
        posts: [context.length ? context : ["Animated video carousel"]],
        clientName: preset.name,
        industry: "aesthetics",
        postType: "carousel",
        voiceStyle: preset.voiceStyle,
        targetAudience: preset.targetAudience,
        contentPillars: preset.contentPillars,
        brandNotes: preset.brandNotes,
      });
      if (captions[0]) {
        update(id, { caption: captions[0], status: "" });
        toast.success("Caption generated.");
      } else {
        update(id, { status: "" });
        toast.error("No caption came back, try again.");
      }
    } catch (e: any) {
      update(id, { status: "" });
      toast.error(e?.message || "Caption generation failed.");
    }
  }

  async function generateAllCaptions() {
    if (!preset) { toast.error("Pick a client first."); return; }
    if (!items.length) return;
    setBusy(true);
    try {
      const posts = items.map((it) => {
        const context = it.slideBlocks
          ? [it.slideBlocks.hook, it.slideBlocks.subtitle, it.slideBlocks.body2, it.slideBlocks.body3, it.slideBlocks.cta].filter((s) => s.trim())
          : [it.file.name.replace(/\.[^.]+$/, "")];
        return context.length ? context : ["Animated video carousel"];
      });
      const captions = await fetchCaptions({
        posts,
        clientName: preset.name,
        industry: "aesthetics",
        postType: "carousel",
        voiceStyle: preset.voiceStyle,
        targetAudience: preset.targetAudience,
        contentPillars: preset.contentPillars,
        brandNotes: preset.brandNotes,
      });
      setItems((prev) => prev.map((it, i) => (captions[i] ? { ...it, caption: captions[i] } : it)));
      toast.success(`${captions.length} caption${captions.length !== 1 ? "s" : ""} generated.`);
    } catch (e: any) {
      toast.error(e?.message || "Caption generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function scheduleAll() {
    if (!preset) { toast.error("Pick a client first."); return; }
    if (!items.length) { toast.error("Add some wide videos first."); return; }
    setBusy(true);
    let ok = 0;
    for (const it of items) {
      try {
        update(it.id, { status: "splitting", note: "" });
        const fd = new FormData();
        fd.append("video", it.file);
        fd.append("slices", String(it.slices));
        if (it.slideBlocks) {
          fd.append("textLayers", JSON.stringify(buildTextLayers(it.slideBlocks)));
        }
        const split = await fetch(`${BASE}api/content/split-video`, { method: "POST", body: fd });
        const splitData = await split.json();
        if (!split.ok || !splitData.clips?.length) throw new Error(splitData.error || "Video split failed");
        const videoUrls: string[] = splitData.clips.map((c: { url: string }) => c.url);

        update(it.id, { status: "scheduling" });
        const r = await fetch(`${BASE}api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: preset.id,
            postType: "video_carousel",
            content: {
              videoUrls,
              caption: it.caption || "",
              title: it.file.name.replace(/\.[^.]+$/, "").slice(0, 60),
              platforms: ["instagram", "facebook"],
              ...(it.musicTrack ? { musicTrack: { name: it.musicTrack.name, artist: it.musicTrack.artist } } : {}),
            },
            scheduledAt: new Date(`${it.date}T${it.time}`).toISOString(),
          }),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Schedule failed"); }
        update(it.id, { status: "done" });
        ok++;
      } catch (e: any) {
        update(it.id, { status: "error", note: e?.message || "Failed" });
      }
    }
    setBusy(false);
    toast[ok === items.length ? "success" : "message"](`${ok} of ${items.length} animated carousels split and scheduled.`);
  }

  return (
    <div className="min-h-screen">
      {previewItem && (
        <SlidePreviewModal
          item={previewItem}
          onClose={() => setPreviewId(null)}
          onUpdateBlocks={(blocks) => update(previewItem.id, { slideBlocks: blocks })}
        />
      )}
      {musicPickerId && (
        <MusicPickerModal
          open={!!musicPickerId}
          onClose={() => setMusicPickerId(null)}
          selectedTrack={items.find((it) => it.id === musicPickerId)?.musicTrack ?? null}
          onSelect={(track) => { if (musicPickerId) update(musicPickerId, { musicTrack: track }); }}
        />
      )}

      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <Link href="/hub"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
        <div>
          <h1 className="font-semibold text-lg">Animated Carousels</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Upload as many wide MP4s as you like at once (e.g. 4320x1440). Each one is cut into 4 slides, kept as MP4, and posted as a proper video carousel, same idea as the Seamless Carousel tool but for video.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-2">
          <h2 className="font-semibold text-base">1. Choose a client</h2>
          <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">
            <option value="">Select a client...</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">2. Upload wide animated videos (MP4) in bulk</h2>
          <label className="block border-2 border-dashed border-border/50 rounded-2xl p-10 text-center cursor-pointer hover:border-pink-500/60 transition-colors">
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Drop as many wide MP4s (4320x1440) as you like in one go, or click to browse. Each one becomes its own 4-slide carousel.</span>
            <input type="file" accept="video/mp4,video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm cursor-pointer">
              Import captions + dates (CSV)
              <input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.currentTarget.value = ""; }} />
            </label>
            <span className="text-xs text-muted-foreground">Columns: caption, date, time. Matched by order.</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/20 mt-1">
            <label className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm cursor-pointer flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Import slide text (CSV)
              <input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importSlideTextCsv(e.target.files[0]); e.currentTarget.value = ""; }} />
            </label>
            <button
              type="button"
              onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "animated-carousel-slide-text-template.csv")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Download template
            </button>
            <span className="text-xs text-muted-foreground w-full sm:w-auto">Columns: {CSV_COLS.join(", ")}. Loads as a list of titles, pick which one goes on each video below.</span>
          </div>
        </section>

        {items.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-base">3. Slides, captions and schedule</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{items.length} video{items.length !== 1 ? "s" : ""} queued</span>
                <Button variant="outline" size="sm" onClick={generateAllCaptions} disabled={busy || !preset}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate all captions
                </Button>
              </div>
            </div>
            {items.map((it, i) => (
              <div key={it.id} className="rounded-xl p-4 bg-card/40 border border-border/30">
                <div className="flex gap-4">
                  <video src={it.url} className="w-40 rounded-lg border border-white/10 shrink-0" style={{ aspectRatio: "3/1", objectFit: "cover" }} muted controls />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {it.file.name}</span>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Scissors className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Cut into 4 slides (4320x1440 source)</span>
                      <button
                        type="button"
                        onClick={() => setPreviewId(it.id)}
                        className="ml-auto text-xs font-medium text-pink-400 hover:text-pink-300 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview &amp; edit slides
                      </button>
                    </div>
                    {csvRows.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Slide text title
                        </label>
                        <select
                          value={it.slideBlocks ? csvRows.indexOf(it.slideBlocks) : -1}
                          onChange={(e) => assignSlideText(it.id, Number(e.target.value))}
                          className="w-full bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm"
                        >
                          <option value={-1}>No slide text (video posts plain)</option>
                          {csvRows.map((row, ri) => (
                            <option key={ri} value={ri}>{rowLabel(row, ri)}</option>
                          ))}
                        </select>
                        {it.slideBlocks && (
                          <p className="text-xs text-emerald-400">Will be burned onto the 4 slides when you cut and schedule.</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <textarea value={it.caption} onChange={(e) => update(it.id, { caption: e.target.value })} placeholder="Caption..." rows={2} className="flex-1 bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                      <button
                        type="button"
                        onClick={() => generateCaption(it.id)}
                        disabled={busy || it.status === "captioning" || !preset}
                        title="Generate caption"
                        className="shrink-0 mt-0.5 p-2 rounded-md border border-border/50 hover:border-pink-500/60 text-pink-400 disabled:opacity-40"
                      >
                        {it.status === "captioning" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                    </div>
                    {it.musicTrack ? (
                      <MusicTrackBadge track={it.musicTrack} onRemove={() => update(it.id, { musicTrack: null })} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMusicPickerId(it.id)}
                        className="text-xs font-medium text-muted-foreground hover:text-pink-400 flex items-center gap-1.5 rounded-lg border border-border/50 hover:border-pink-500/40 px-3 py-1.5 w-fit"
                      >
                        <Music className="w-3.5 h-3.5" /> Add music
                      </button>
                    )}
                    <div className="flex gap-2">
                      <input type="date" value={it.date} onChange={(e) => update(it.id, { date: e.target.value })} className="flex-1 bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
                      <input type="time" value={it.time} onChange={(e) => update(it.id, { time: e.target.value })} className="flex-1 bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
                    </div>
                    {it.status && (
                      <p className={`text-xs ${it.status === "done" ? "text-emerald-400" : it.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                        {it.status === "splitting" ? "Cutting into slides..." : it.status === "captioning" ? "Writing caption..." : it.status === "uploading" ? "Uploading..." : it.status === "scheduling" ? "Scheduling..." : it.status === "done" ? `Scheduled for ${it.date} at ${it.time}` : it.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Each wide video is cut into 4 equal MP4 slides (with any slide text burned in) and posted as a video carousel to Instagram and Facebook. Music is saved as a note, Instagram doesn't support auto-attaching a track to a video carousel, add it manually in-app if you want it to actually play.</p>
              <Button onClick={scheduleAll} disabled={busy || !preset} className="bg-pink-600 hover:bg-pink-700">
                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />}
                Cut and schedule {items.length} carousel{items.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
