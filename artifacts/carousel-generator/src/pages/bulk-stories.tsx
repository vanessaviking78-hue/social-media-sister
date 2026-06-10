import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2,
  CheckCircle2, X, CalendarDays, Sparkles, RefreshCcw, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "date", "time", "sticker_type", "question",
  "option_a", "option_b", "option_c", "option_d",
  "correct_option", "caption",
];

const CSV_EXAMPLE_ROWS = [
  ["2026-07-01", "10:00", "poll",     "Would you try this treatment?",           "Yes",        "Not yet",    "",           "",        "",  ""],
  ["2026-07-02", "11:00", "question", "Ask me anything about skincare!",          "",           "",           "",           "",        "",  ""],
  ["2026-07-03", "09:00", "quiz",     "How long does Botox last?",                "2-4 months", "4-6 months", "6-12 months","1 year",  "1", ""],
  ["2026-07-04", "14:00", "",         "",                                          "",           "",           "",           "",        "",  "Just a regular story — no sticker"],
];

function downloadTemplate() {
  const rows = [CSV_HEADERS, ...CSV_EXAMPLE_ROWS];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, "bulk-stories-template.csv");
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StickerType = "none" | "poll" | "quiz" | "question";

type StoryEntry = {
  id: string;
  rowNum: number;
  date: string;
  time: string;
  stickerType: StickerType;
  question: string;
  options: string[];
  correctIndex: number;
  caption: string;
  fontSize: number;
  imageFile: File | null;
  imageLocalUrl: string | null;
  status: "idle" | "scheduling" | "done" | "error";
  error?: string;
};

type ImageItem = { file: File; localUrl: string };
type Phase = "upload" | "preview" | "scheduling" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadBatch(files: File[]): Promise<string[]> {
  const BATCH = 5;
  const urls: string[] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const chunk = files.slice(i, i + BATCH);
    const images = await Promise.all(
      chunk.map(async (f) => ({ name: f.name, base64: await toBase64(f) }))
    );
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

function parseStickerType(raw: string): StickerType {
  const s = raw.trim().toLowerCase();
  if (s === "poll") return "poll";
  if (s === "quiz") return "quiz";
  if (s === "question") return "question";
  return "none";
}

function parseCsvRows(rows: Record<string, string>[]): StoryEntry[] {
  return rows
    .filter((r) => r["date"]?.trim())
    .map((r, i) => {
      const stickerType = parseStickerType(r["sticker_type"] || "");
      const options = ["option_a", "option_b", "option_c", "option_d"]
        .map((k) => (r[k] || "").trim())
        .filter(Boolean);
      const correctIndex = Math.max(0, parseInt(r["correct_option"] || "0", 10));
      return {
        id: `row-${i}`,
        rowNum: i + 1,
        date: r["date"]?.trim() || "",
        time: r["time"]?.trim() || "09:00",
        stickerType,
        question: (r["question"] || "").trim(),
        options,
        correctIndex,
        caption: (r["caption"] || "").trim(),
        fontSize: 64,
        imageFile: null,
        imageLocalUrl: null,
        status: "idle" as const,
      };
    });
}

const MAX_IMAGES = 10;

// ── AI Question card rendering ────────────────────────────────────────────────

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function renderQuestionCard(question: string, bgColour: string): Promise<File> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  try { await document.fonts.load(`140px "Bebas Neue"`); } catch { /* fallback to sans-serif */ }

  ctx.fillStyle = bgColour;
  ctx.fillRect(0, 0, W, H);

  const maxTextW = W * 0.80;
  let fontSize = 148;

  const getLines = (fs: number) => {
    ctx.font = `${fs}px "Bebas Neue", Impact, sans-serif`;
    return wrapCanvasText(ctx, question, maxTextW);
  };

  let lines = getLines(fontSize);
  while (lines.length > 5 && fontSize > 64) {
    fontSize -= 10;
    lines = getLines(fontSize);
  }

  const lh = fontSize * 1.22;
  const totalH = lines.length * lh;
  const startY = (H - totalH) / 2 + fontSize * 0.85;

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.40)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;

  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * lh);
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], `q-card-${Date.now()}-${Math.random().toString(36).slice(2)}.png`, { type: "image/png" })),
      "image/png",
    );
  });
}

function buildStickerConfig(entry: StoryEntry): object | null {
  if (entry.stickerType === "none" || !entry.question) return null;
  if (entry.stickerType === "poll" && entry.options.length >= 2) {
    return { type: "poll", question: entry.question, options: [entry.options[0], entry.options[1]] };
  }
  if (entry.stickerType === "quiz" && entry.options.length >= 2) {
    return {
      type: "quiz",
      question: entry.question,
      options: entry.options,
      correctIndex: Math.min(entry.correctIndex, entry.options.length - 1),
    };
  }
  if (entry.stickerType === "question") {
    return { type: "question", question: entry.question };
  }
  return null;
}

// ── Sticker badge ─────────────────────────────────────────────────────────────

function StickerBadge({ type }: { type: StickerType }) {
  if (type === "none") return <span className="text-xs text-zinc-600">None</span>;
  const label = type === "poll" ? "Poll" : type === "quiz" ? "Quiz" : "Q&A";
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-600/20 text-pink-300 border border-pink-500/30">
      {label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BulkStories() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [entries, setEntries] = useState<StoryEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("upload");
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [imgDragOver, setImgDragOver] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [selectedQs, setSelectedQs] = useState<Set<number>>(new Set());
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [renderingCards, setRenderingCards] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Clear uploads on every page visit so previous session images don't persist
  useEffect(() => {
    setImages([]);
    setEntries([]);
    setPhase("upload");
  }, []);

  const selectedPreset = presets.find((p) => String(p.id) === presetId);

  const handleImages = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    setImages((prev) => {
      const slots = MAX_IMAGES - prev.length;
      if (slots <= 0) { return prev; }
      const toAdd = valid.slice(0, slots).map((f) => ({ file: f, localUrl: URL.createObjectURL(f) }));
      return [...prev, ...toAdd];
    });
  }, []);

  const updateEntryFontSize = useCallback((id: string, size: number) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, fontSize: Math.max(12, Math.min(200, size)) } : e));
  }, []);

  const handleCsv = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, string>[];
        if (!rows.length) { toast.error("CSV appears to be empty"); return; }
        const parsed = parseCsvRows(rows);
        if (!parsed.length) { toast.error("No valid rows found — make sure the date column is filled in."); return; }
        setEntries(parsed);
        toast.success(`${parsed.length} ${parsed.length === 1 ? "story" : "stories"} parsed`);
      },
      error: () => toast.error("Could not parse CSV"),
    });
  }, []);

  const handlePreview = useCallback(() => {
    if (!presetId) { toast.error("Pick a client first"); return; }
    if (!entries.length) { toast.error("Upload a CSV first"); return; }
    if (!images.length) { toast.error("Upload at least one story image"); return; }
    const updated = entries.map((e, i) => {
      const img = images[Math.min(i, images.length - 1)];
      return { ...e, imageFile: img.file, imageLocalUrl: img.localUrl };
    });
    setEntries(updated);
    setPhase("preview");
  }, [presetId, entries, images]);

  const handleGenerateQuestions = useCallback(async () => {
    if (!presetId) { toast.error("Pick a client first"); return; }
    setGeneratingQuestions(true);
    try {
      const res = await fetch(`${BASE}/api/stories/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: selectedPreset?.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setGeneratedQuestions(data.questions ?? []);
      setSelectedQs(new Set());
    } catch (err: any) {
      toast.error("Could not generate questions: " + err.message);
    } finally {
      setGeneratingQuestions(false);
    }
  }, [presetId, selectedPreset]);

  const handleAddSelectedToStories = useCallback(async () => {
    if (!selectedPreset) { toast.error("Pick a client first"); return; }
    const indices = [...selectedQs].sort((a, b) => a - b);
    if (!indices.length) { toast.error("Select at least one question"); return; }

    setRenderingCards(true);
    try {
      const bgColour = selectedPreset.accentColor || "#e91976";
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const newImages: ImageItem[] = [];
      const newEntries: StoryEntry[] = [];

      for (let i = 0; i < indices.length; i++) {
        const qi = indices[i];
        const question = generatedQuestions[qi];
        const file = await renderQuestionCard(question, bgColour);
        const localUrl = URL.createObjectURL(file);
        newImages.push({ file, localUrl });

        const d = new Date(tomorrow);
        d.setDate(d.getDate() + i);
        const date = d.toISOString().slice(0, 10);

        newEntries.push({
          id: `ai-q-${qi}-${Date.now()}-${i}`,
          rowNum: i + 1,
          date,
          time: "09:00",
          stickerType: "none",
          question,
          options: [],
          correctIndex: 0,
          caption: "",
          fontSize: 64,
          imageFile: file,
          imageLocalUrl: localUrl,
          status: "idle",
        });
      }

      setImages((prev) => {
        const merged = [...newImages, ...prev];
        return merged.slice(0, MAX_IMAGES);
      });
      setEntries((prev) => {
        const merged = [...newEntries, ...prev].map((e, i) => ({ ...e, rowNum: i + 1 }));
        return merged;
      });

      toast.success(
        `${newEntries.length} question ${newEntries.length === 1 ? "card" : "cards"} added to your stories`,
      );
    } catch (err: any) {
      toast.error("Failed to render cards: " + err.message);
    } finally {
      setRenderingCards(false);
    }
  }, [selectedPreset, selectedQs, generatedQuestions]);

  const handleScheduleAll = useCallback(async () => {
    if (!presetId || !selectedPreset) return;
    setPhase("scheduling");

    const imageFiles = entries
      .map((e) => e.imageFile)
      .filter((f): f is File => !!f);

    let uploadedUrls: string[] = [];
    try {
      uploadedUrls = await uploadBatch(imageFiles);
    } catch (err: any) {
      toast.error("Image upload failed: " + err.message);
      setPhase("preview");
      return;
    }

    let done = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const imageUrl = uploadedUrls[i];

      setEntries((prev) => prev.map((e, j) => j === i ? { ...e, status: "scheduling" } : e));

      if (!imageUrl) {
        errors++;
        setErrorCount(errors);
        setEntries((prev) => prev.map((e, j) => j === i ? { ...e, status: "error", error: "No image URL" } : e));
        continue;
      }

      try {
        const scheduledAt = new Date(`${entry.date}T${entry.time}:00`).toISOString();
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: Number(presetId),
            postType: "story",
            content: {
              imageUrls: [imageUrl],
              caption: entry.caption || "",
              title: `Story — ${selectedPreset.name} ${entry.date}`,
              fontSize: entry.fontSize,
            },
            scheduledAt,
            stickerConfig: buildStickerConfig(entry),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Scheduling failed");
        done++;
        setDoneCount(done);
        setEntries((prev) => prev.map((e, j) => j === i ? { ...e, status: "done" } : e));
      } catch (err: any) {
        errors++;
        setErrorCount(errors);
        setEntries((prev) => prev.map((e, j) => j === i ? { ...e, status: "error", error: err.message } : e));
      }
    }

    setPhase("done");
    if (done > 0) toast.success(`${done} ${done === 1 ? "story" : "stories"} queued`);
    if (errors > 0) toast.error(`${errors} failed — check the summary`);
  }, [presetId, selectedPreset, entries]);

  // ── Upload phase ──────────────────────────────────────────────────────────────

  if (phase === "upload") {
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
            <p className="text-xs text-zinc-500 mt-1">Upload images and a CSV to queue a month of story sticker posts at once.</p>
          </div>
          {(images.length > 0 || entries.length > 0) && (
            <button
              onClick={() => { setImages([]); setEntries([]); }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-white/8"
            >
              <X size={12} />
              Clear All
            </button>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {/* Client */}
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">Client</p>
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

          {/* Generate Questions */}
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">AI Question Generator</p>
                <p className="text-xs text-zinc-600 mt-0.5">Generate engagement questions and render them as story cards</p>
              </div>
              <div className="flex items-center gap-2">
                {generatedQuestions.length > 0 && (
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={generatingQuestions || !presetId}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-pink-400 transition-colors disabled:opacity-40 px-2.5 py-1.5 rounded-lg hover:bg-white/5 border border-white/8"
                  >
                    <RefreshCcw size={12} className={generatingQuestions ? "animate-spin" : ""} />
                    Regenerate
                  </button>
                )}
                <Button
                  onClick={handleGenerateQuestions}
                  disabled={!presetId || generatingQuestions}
                  size="sm"
                  className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10"
                >
                  {generatingQuestions ? (
                    <><Loader2 size={13} className="mr-1.5 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles size={13} className="mr-1.5 text-pink-400" />Generate Questions</>
                  )}
                </Button>
              </div>
            </div>

            {!presetId && (
              <p className="text-xs text-zinc-600 italic">Pick a client above to enable question generation.</p>
            )}

            {generatedQuestions.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    {selectedQs.size} of {generatedQuestions.length} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedQs(new Set(generatedQuestions.map((_, i) => i)))}
                      className="text-xs text-zinc-500 hover:text-pink-400 transition-colors"
                    >
                      Select all
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => setSelectedQs(new Set())}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-col divide-y divide-white/5 rounded-xl overflow-hidden border border-white/8">
                  {generatedQuestions.map((q, i) => (
                    <label
                      key={i}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQs.has(i)}
                        onChange={(e) =>
                          setSelectedQs((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(i); else next.delete(i);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 accent-pink-500 flex-shrink-0"
                      />
                      <span
                        className="text-sm text-zinc-200 leading-snug"
                        style={{ fontFamily: "'Bebas Neue', cursive", fontSize: "18px", letterSpacing: "0.5px" }}
                      >
                        {q}
                      </span>
                    </label>
                  ))}
                </div>

                {selectedQs.size > 0 && (
                  <Button
                    onClick={handleAddSelectedToStories}
                    disabled={renderingCards}
                    className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold"
                  >
                    {renderingCards ? (
                      <><Loader2 size={14} className="mr-2 animate-spin" />Rendering cards...</>
                    ) : (
                      <><Plus size={14} className="mr-2" />Add {selectedQs.size} Selected to Stories</>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Images */}
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
                Story Images
                <span className="ml-2 text-zinc-600 normal-case font-normal">
                  {images.length} / {MAX_IMAGES}
                </span>
              </p>
              {images.length > 0 && (
                <button onClick={() => setImages([])} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                  Clear
                </button>
              )}
            </div>

            {images.length < MAX_IMAGES ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
                onDragLeave={() => setImgDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setImgDragOver(false);
                  handleImages(Array.from(e.dataTransfer.files));
                }}
                onClick={() => imgInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                  imgDragOver ? "border-pink-500/60 bg-pink-500/5" : "border-white/10 hover:border-white/20"
                }`}
              >
                <Upload size={28} className="text-zinc-600" />
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">Drop images here or click to browse</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Images are added to your selection (up to {MAX_IMAGES}). They match CSV rows in order.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/5 rounded-xl p-5 flex items-center justify-center gap-2 text-xs text-zinc-600">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Maximum {MAX_IMAGES} images reached. Clear some to add more.
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

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 items-end">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.localUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover border border-white/10"
                    />
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center text-[9px] text-zinc-400 font-medium">
                      {i + 1}
                    </div>
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
                <p className="w-full text-xs text-zinc-600 mt-1">
                  {images.length} {images.length === 1 ? "image" : "images"} loaded
                </p>
              </div>
            )}
          </div>

          {/* CSV */}
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">Story Schedule CSV</p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-pink-400 transition-colors"
              >
                <Download size={12} />
                Download template
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
              onDragLeave={() => setCsvDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCsvDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleCsv(file);
              }}
              onClick={() => csvInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                csvDragOver ? "border-pink-500/60 bg-pink-500/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <FileText size={28} className="text-zinc-600" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">Drop CSV here or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">
                  One row per story. Download the template above to get the column format.
                </p>
              </div>
            </div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); }}
            />

            {entries.length > 0 && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-300">
                  {entries.length} {entries.length === 1 ? "story" : "stories"} parsed from CSV
                </p>
              </div>
            )}

            {/* Format guide */}
            <div className="bg-zinc-900/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-pink-400" />
                <p className="text-xs font-semibold text-zinc-400">CSV column guide</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ["date", "YYYY-MM-DD (required)"],
                  ["time", "HH:MM — defaults to 09:00"],
                  ["sticker_type", "poll, quiz, question, or blank"],
                  ["question", "Your sticker question or prompt"],
                  ["option_a / option_b", "Poll options (exactly 2) or quiz options"],
                  ["option_c / option_d", "Extra quiz options (optional)"],
                  ["correct_option", "Quiz only: 0 for option_a, 1 for option_b…"],
                  ["caption", "Internal note or Cloud Campaign caption"],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-1.5">
                    <span className="text-[11px] text-zinc-500 font-medium flex-shrink-0">{col}</span>
                    <span className="text-[11px] text-zinc-700">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handlePreview}
            disabled={!presetId || !entries.length || !images.length}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold"
            size="lg"
          >
            Preview {entries.length > 0 ? `${entries.length} Stories` : "Stories"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Preview phase ─────────────────────────────────────────────────────────────

  if (phase === "preview") {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white">
        <div className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => setPhase("upload")}
            className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base leading-none">
              Preview — {entries.length} {entries.length === 1 ? "Story" : "Stories"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Client: {selectedPreset?.name}</p>
          </div>
          <Button
            onClick={handleScheduleAll}
            className="bg-pink-600 hover:bg-pink-500 text-white font-semibold"
          >
            <CalendarDays size={15} className="mr-1.5" />
            Schedule All
          </Button>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
          {images.length < entries.length && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>
                You have {images.length} {images.length === 1 ? "image" : "images"} for {entries.length} stories.
                Image #{images.length} will repeat for the remaining rows.
              </span>
            </div>
          )}

          <div className="border border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-zinc-900/40 text-[11px] text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-medium w-16">Image</th>
                  <th className="text-left px-4 py-2.5 font-medium">Date &amp; Time</th>
                  <th className="text-left px-4 py-2.5 font-medium">Sticker</th>
                  <th className="text-left px-4 py-2.5 font-medium">Question / Caption</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">Size</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-zinc-600 text-xs">{entry.rowNum}</td>
                    <td className="px-4 py-2.5">
                      {entry.imageLocalUrl ? (
                        <img
                          src={entry.imageLocalUrl}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center">
                          <Upload size={13} className="text-zinc-600" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-white">{entry.date}</p>
                      <p className="text-xs text-zinc-500">{entry.time}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <StickerBadge type={entry.stickerType} />
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      {entry.question ? (
                        <>
                          <p className="truncate text-zinc-200" style={{ fontFamily: "'Bebas Neue', cursive", fontSize: `${Math.round(entry.fontSize * 0.25)}px`, lineHeight: 1.2 }}>
                            {entry.question}
                          </p>
                          {entry.stickerType === "poll" && entry.options.length >= 2 && (
                            <p className="text-xs text-zinc-600 mt-0.5 truncate">{entry.options[0]} / {entry.options[1]}</p>
                          )}
                          {entry.stickerType === "quiz" && entry.options.length >= 2 && (
                            <p className="text-xs text-zinc-600 mt-0.5 truncate">
                              {entry.options.join(" / ")} · correct: option {entry.correctIndex + 1}
                            </p>
                          )}
                        </>
                      ) : entry.caption ? (
                        <p className="text-sm text-zinc-500 truncate" style={{ fontFamily: "'Bebas Neue', cursive" }}>{entry.caption}</p>
                      ) : (
                        <p className="text-xs text-zinc-700">No sticker or caption</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={12}
                        max={200}
                        value={entry.fontSize}
                        onChange={(e) => updateEntryFontSize(entry.id, parseInt(e.target.value, 10) || 64)}
                        className="w-16 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 text-center focus:outline-none focus:border-pink-500/50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setPhase("upload")}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Back to upload
            </button>
            <Button
              onClick={handleScheduleAll}
              className="bg-pink-600 hover:bg-pink-500 text-white font-semibold"
            >
              <CalendarDays size={15} className="mr-1.5" />
              Schedule {entries.length} {entries.length === 1 ? "Story" : "Stories"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scheduling phase ──────────────────────────────────────────────────────────

  if (phase === "scheduling") {
    const total = entries.length;
    const completed = entries.filter((e) => e.status === "done" || e.status === "error").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-5">
          <Loader2 size={36} className="text-pink-400 animate-spin" />
          <div>
            <p className="text-lg font-semibold text-white">Scheduling stories...</p>
            <p className="text-sm text-zinc-500 mt-1">{completed} of {total} queued</p>
          </div>
          <div className="w-56 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Done phase ────────────────────────────────────────────────────────────────

  const failedEntries = entries.filter((e) => e.status === "error");

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
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">
            {doneCount} {doneCount === 1 ? "story" : "stories"} queued
          </p>
          {errorCount > 0 && (
            <p className="text-sm text-red-400 mt-1">{errorCount} failed</p>
          )}
          <p className="text-sm text-zinc-500 mt-2">
            Head to the scheduler to review dates and fire when ready.
          </p>
        </div>

        {failedEntries.length > 0 && (
          <div className="w-full border border-red-500/20 rounded-xl overflow-hidden text-left">
            <div className="px-4 py-2.5 bg-red-950/30 border-b border-red-500/20">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Failed rows</p>
            </div>
            {failedEntries.map((e) => (
              <div key={e.id} className="px-4 py-2.5 border-b border-white/5 last:border-0 flex items-start gap-3">
                <X size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-zinc-300">Row {e.rowNum} — {e.date}</p>
                  <p className="text-xs text-zinc-600">{e.error}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/scheduler">
            <Button variant="secondary">View Scheduler Queue</Button>
          </Link>
          <Button
            onClick={() => {
              setPhase("upload");
              setEntries([]);
              setImages([]);
              setDoneCount(0);
              setErrorCount(0);
            }}
            className="bg-pink-600 hover:bg-pink-500 text-white"
          >
            Schedule Another Batch
          </Button>
        </div>
      </div>
    </div>
  );
}
