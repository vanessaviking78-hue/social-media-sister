import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2, CalendarClock,
  CheckCircle2, X, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;

const CSV_COLS = [
  "slide1_hook", "slide1_subtitle", "slide2_body", "slide3_body",
  "slide4_cta", "image_filename", "logo_filename",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type CsvRow = {
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
  image_filename: string;
  logo_filename: string;
};

type BlockId = "hook" | "subtitle" | "body2" | "body3" | "cta";

type Block = {
  id: BlockId;
  text: string;
  x: number;
  y: number;
};

type CarouselItem = {
  id: string;
  rowNum: number;
  hook: string;
  isHero: boolean;
  imageFilename: string;
  logoFilename: string;
  blocks: Block[];
  image: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  thumbs: string[];
};

type ScheduleEntry = {
  date: string;
  time: string;
  platforms: ("instagram" | "facebook")[];
  presetId: number | null;
  caption: string;
};

type Phase = "upload" | "preview" | "schedule" | "done";

// ── Hero helpers ──────────────────────────────────────────────────────────────

const detectHero = (hook: string) => hook.trimStart().startsWith("|");
const stripPipe = (hook: string) => hook.trimStart().replace(/^\|/, "").trim();

// ── Block config ──────────────────────────────────────────────────────────────

const SLIDE_BLOCK_IDS: Record<number, BlockId[]> = {
  1: ["hook", "subtitle"],
  2: ["body2"],
  3: ["body3"],
  4: ["cta"],
};

type BlockStyle = { font: string; size: number; lineH: number; maxW: number; label: string };

function resolveBlockStyle(id: BlockId, isHero: boolean, preset: ClientPreset): BlockStyle {
  const hookFont = isHero ? '"Bebas Neue"' : (preset.fontFamily || '"DM Serif Display", serif');
  const hookSize = isHero ? 140 : 96;
  switch (id) {
    case "hook":     return { font: hookFont, size: hookSize, lineH: isHero ? 1.0 : 1.15, maxW: W - (isHero ? 60 : 120), label: isHero ? "Hero Hook" : "Hook" };
    case "subtitle": return { font: 'italic "Prata"',        size:  44, lineH: 1.40, maxW: W - 180, label: "Subtitle" };
    case "body2":    return { font: '"Prata"',               size:  50, lineH: 1.50, maxW: W - 160, label: "Body"     };
    case "body3":    return { font: '"Prata"',               size:  50, lineH: 1.50, maxW: W - 160, label: "Body"     };
    case "cta":      return { font: preset.fontFamily || '"DM Serif Display", serif', size: 76, lineH: 1.35, maxW: W - 140, label: "CTA" };
  }
}

const DEFAULT_POSITIONS: Record<BlockId, { x: number; y: number }> = {
  hook:     { x: 0.5, y: 0.53 },
  subtitle: { x: 0.5, y: 0.68 },
  body2:    { x: 0.5, y: 0.50 },
  body3:    { x: 0.5, y: 0.50 },
  cta:      { x: 0.5, y: 0.50 },
};

function makeBlocks(row: CsvRow): Block[] {
  const hookText = stripPipe(row.slide1_hook);
  return [
    { id: "hook",     text: hookText,           ...DEFAULT_POSITIONS.hook     },
    { id: "subtitle", text: row.slide1_subtitle, ...DEFAULT_POSITIONS.subtitle },
    { id: "body2",    text: row.slide2_body,     ...DEFAULT_POSITIONS.body2    },
    { id: "body3",    text: row.slide3_body,     ...DEFAULT_POSITIONS.body3    },
    { id: "cta",      text: row.slide4_cta,      ...DEFAULT_POSITIONS.cta      },
  ];
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex.startsWith("#") ? hex.slice(1) : hex).padEnd(6, "0");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else { cur = t; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, alpha: number) {
  const s = Math.max(W / img.width, H / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  ctx.globalAlpha = 1;
}

function renderSlide(
  slideNum: 1 | 2 | 3 | 4,
  blocks: Block[],
  image: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  preset: ClientPreset,
  isHero: boolean,
  scale = SCALE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const pageColor   = preset.pageColor   || "#1a1a2e";
  const overlayColor = preset.overlayColor || "rgba(0,0,0,0.55)";
  const textColor   = preset.textColor   || "#ffffff";

  // Background
  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  // Image — same image used for all 4 slides (cover treatment on slide 1)
  if (image) {
    if (slideNum === 1) {
      drawCover(ctx, image, 0.42);
      const [r, g, b] = hexToRgb(pageColor);
      ctx.fillStyle = `rgba(${r},${g},${b},0.50)`;
      ctx.fillRect(0, 0, W, H);
    } else {
      drawCover(ctx, image, 1.0);
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 3;

  const activeIds = SLIDE_BLOCK_IDS[slideNum];
  for (const block of blocks.filter(b => activeIds.includes(b.id))) {
    if (!block.text.trim()) continue;
    const st = resolveBlockStyle(block.id, isHero, preset);
    ctx.font = `${st.size}px ${st.font}`;
    const raw = block.id === "hook" ? block.text.toUpperCase() : block.text;
    const lines = wrapCanvas(ctx, raw, st.maxW);
    const totalH = lines.length * st.size * st.lineH;
    const cx = block.x * W;
    let y = block.y * H - totalH / 2 + (st.size * st.lineH) / 2;
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += st.size * st.lineH;
    }
  }

  // Logo
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  if (logoImg) {
    const MAX = 110, PAD = 44;
    const asp = logoImg.width / logoImg.height;
    const lw = asp >= 1 ? MAX : MAX * asp;
    const lh = asp >= 1 ? MAX / asp : MAX;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logoImg, W - lw - PAD, H - lh - PAD, lw, lh);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL("image/png");
}

function renderAllThumbs(
  item: Pick<CarouselItem, "blocks" | "image" | "logo" | "isHero">,
  preset: ClientPreset,
): string[] {
  return ([1, 2, 3, 4] as const).map(n =>
    renderSlide(n, item.blocks, item.image, item.logo, preset, item.isHero),
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function normName(name: string) {
  return name.trim().toLowerCase();
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((du, j) => ({ name: names[i + j], base64: du }));
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

function makeSampleCsv(): string {
  return [
    CSV_COLS.join(","),
    "|Five things ageing your skin overnight,A short supporting subtitle,Body copy for slide two goes here.,Body copy for slide three goes here.,Book your consultation today,clinic-photo.jpg,clinic-logo.png",
    "Collagen starts declining at 25 and most people don't know it,Did you know this?,More detail for slide two.,Even more for slide three.,Call us to find out more.,another-photo.jpg,clinic-logo.png",
    "",
  ].join("\n");
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  label, hint, fileCount, accept, multiple = true, active, color,
  onDragOver, onDragLeave, onDrop, onClick,
}: {
  label: string; hint: string; fileCount: number; accept: string; multiple?: boolean;
  active: boolean; color: string;
  onDragOver: () => void; onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void; onClick: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2.5 cursor-pointer transition-colors ${
        active ? "border-primary/60 bg-primary/5" :
        fileCount ? `border-${color}-500/40 bg-${color}-500/5` :
        "border-border/40 hover:border-border/70"
      }`}
    >
      {fileCount ? (
        <>
          <CheckCircle2 className={`w-7 h-7 text-${color}-400`} />
          <p className={`text-sm font-medium text-${color}-400`}>{fileCount} file{fileCount !== 1 ? "s" : ""} ready</p>
          <p className="text-xs text-muted-foreground">Click or drop to add more</p>
        </>
      ) : (
        <>
          <Upload className="w-7 h-7 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CsvSlideCarousel() {
  const [phase, setPhase] = useState<Phase>("upload");

  // Upload state
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [logoFiles, setLogoFiles] = useState<Map<string, File>>(new Map());
  const [csvDrag, setCsvDrag] = useState(false);
  const [imgDrag, setImgDrag] = useState(false);
  const [logoDrag, setLogoDrag] = useState(false);

  // Preview state
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // Schedule state
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduling, setScheduling] = useState(false);

  const csvInputRef  = useRef<HTMLInputElement>(null);
  const imgInputRef  = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { presets } = usePresets();
  const selectedPreset = useMemo(() => presets.find(p => p.id === selectedPresetId) ?? null, [presets, selectedPresetId]);

  // ── CSV ──────────────────────────────────────────────────────────────────────

  const parseCsv = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) { setCsvError("CSV is empty."); return; }
        const missing = CSV_COLS.filter(k => !(k in result.data[0]));
        if (missing.length) { setCsvError(`Missing columns: ${missing.join(", ")}`); return; }
        setCsvError(null);
        setCsvRows(result.data as unknown as CsvRow[]);
      },
      error: e => setCsvError(e.message),
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault(); setCsvDrag(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith(".csv"));
    if (file) parseCsv(file); else toast.error("Drop a CSV file.");
  };

  // ── File maps ─────────────────────────────────────────────────────────────────

  const addFiles = (setter: React.Dispatch<React.SetStateAction<Map<string, File>>>, files: File[]) => {
    setter(prev => {
      const next = new Map(prev);
      for (const f of files.filter(f => f.type.startsWith("image/"))) {
        next.set(normName(f.name), f);
      }
      return next;
    });
  };

  const handleImgDrop  = (e: React.DragEvent) => { e.preventDefault(); setImgDrag(false);  addFiles(setImageFiles, Array.from(e.dataTransfer.files)); };
  const handleLogoDrop = (e: React.DragEvent) => { e.preventDefault(); setLogoDrag(false); addFiles(setLogoFiles,  Array.from(e.dataTransfer.files)); };

  // ── Generate ──────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!csvRows.length || !selectedPreset) return;
    setRendering(true);
    setRenderProgress(0);
    try {
      await document.fonts.ready;

      const rendered: CarouselItem[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        const isHero = detectHero(row.slide1_hook);

        // Load image (from uploaded files, fallback null)
        let image: HTMLImageElement | null = null;
        const imgFile = imageFiles.get(normName(row.image_filename));
        if (imgFile) {
          try { image = await loadImg(URL.createObjectURL(imgFile)); } catch {}
        }

        // Load logo (per-row file, fallback to preset logo url)
        let logo: HTMLImageElement | null = null;
        const logoFile = logoFiles.get(normName(row.logo_filename));
        if (logoFile) {
          try { logo = await loadImg(URL.createObjectURL(logoFile)); } catch {}
        } else if (selectedPreset.logoUrl) {
          try { logo = await loadImg(selectedPreset.logoUrl); } catch {}
        }

        const blocks = makeBlocks(row);
        const thumbs = renderAllThumbs({ blocks, image, logo, isHero }, selectedPreset);
        rendered.push({
          id: `item-${i}`,
          rowNum: i + 1,
          hook: stripPipe(row.slide1_hook),
          isHero,
          imageFilename: row.image_filename,
          logoFilename: row.logo_filename,
          blocks,
          image,
          logo,
          thumbs,
        });
        setRenderProgress(Math.round(((i + 1) / csvRows.length) * 100));
      }

      setItems(rendered);
      setPhase("preview");
    } catch (e: any) {
      toast.error("Render failed: " + e.message);
    } finally {
      setRendering(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────────

  const downloadSingle = async (item: CarouselItem) => {
    const zip = new JSZip();
    item.thumbs.forEach((du, i) => zip.file(`slide${i + 1}.png`, du.split(",")[1], { base64: true }));
    const blob = await zip.generateAsync({ type: "blob" });
    const label = item.hook.slice(0, 30).replace(/[^a-z0-9]/gi, "-") || `carousel-${item.rowNum}`;
    saveAs(blob, `${label}.zip`);
  };

  const downloadAll = async () => {
    const tid = toast.loading("Building ZIP...");
    try {
      const zip = new JSZip();
      items.forEach((item, i) => {
        const folder = zip.folder(`carousel-${i + 1}`) ?? zip;
        item.thumbs.forEach((du, j) => folder.file(`slide${j + 1}.png`, du.split(",")[1], { base64: true }));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "carousels.zip");
      toast.success("Download started.", { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    }
  };

  // ── Schedule ──────────────────────────────────────────────────────────────────

  const goToSchedule = () => {
    const today = new Date().toISOString().slice(0, 10);
    setScheduleEntries(items.map(() => ({
      date: today, time: "09:00",
      platforms: ["instagram"],
      presetId: selectedPresetId,
      caption: "",
    })));
    setPhase("schedule");
  };

  const updateEntry = <K extends keyof ScheduleEntry>(i: number, k: K, v: ScheduleEntry[K]) =>
    setScheduleEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const togglePlatform = (i: number, p: "instagram" | "facebook") =>
    setScheduleEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      const has = e.platforms.includes(p);
      if (has && e.platforms.length === 1) return e;
      return { ...e, platforms: has ? e.platforms.filter(x => x !== p) : [...e.platforms, p] };
    }));

  const handleScheduleAll = async () => {
    const bad = scheduleEntries.findIndex(e => !e.presetId);
    if (bad !== -1) { toast.error(`Row ${bad + 1}: select a client account.`); return; }
    setScheduling(true);
    const tid = toast.loading("Uploading and queueing...");
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = scheduleEntries[i];
        toast.loading(`Scheduling ${i + 1} / ${items.length}...`, { id: tid });
        const names = item.thumbs.map((_, j) => `carousel-${i + 1}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(item.thumbs, names);
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: entry.presetId,
            postType: "carousel",
            content: {
              imageUrls, caption: entry.caption || "",
              title: item.hook.slice(0, 80) || `Carousel ${item.rowNum}`,
              platforms: entry.platforms,
            },
            scheduledAt: new Date(`${entry.date}T${entry.time}`).toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(`Row ${i + 1}: ${err.error}`);
        }
      }
      toast.success(`${items.length} carousels queued.`, { id: tid });
      setPhase("done");
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setScheduling(false);
    }
  };

  const resetAll = () => {
    setCsvRows([]); setCsvError(null);
    setImageFiles(new Map()); setLogoFiles(new Map());
    setItems([]); setSelectedPresetId(null);
    setPhase("upload");
  };

  // ── Done ──────────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
        <CheckCircle2 className="w-14 h-14 text-emerald-400" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">All queued</h2>
          <p className="text-muted-foreground">{items.length} carousel{items.length !== 1 ? "s" : ""} added to the scheduler.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild><Link href="/scheduler">View queue</Link></Button>
          <Button onClick={resetAll}>Start again</Button>
        </div>
      </div>
    );
  }

  // ── Schedule phase ────────────────────────────────────────────────────────────

  if (phase === "schedule") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button onClick={() => setPhase("preview")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Schedule Carousels</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} posts</span>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-muted-foreground mb-6">
            Set a date, time and platform for each carousel. Client account defaults to your selected preset.
          </p>

          <div className="space-y-3">
            {items.map((item, i) => {
              const entry = scheduleEntries[i];
              if (!entry) return null;
              return (
                <div key={item.id} className="border border-border/40 rounded-xl p-4 bg-card/40">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Row {item.rowNum}</p>
                          {item.isHero && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">Hero</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{item.hook}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {item.thumbs.map((du, si) => (
                          <img key={si} src={du} alt="" className="w-10 rounded" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Client</Label>
                        <Select value={entry.presetId?.toString() ?? ""} onValueChange={v => updateEntry(i, "presetId", v ? parseInt(v) : null)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick client" /></SelectTrigger>
                          <SelectContent>
                            {presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input type="date" value={entry.date} onChange={e => updateEntry(i, "date", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input type="time" value={entry.time} onChange={e => updateEntry(i, "time", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Platforms</Label>
                        <div className="flex gap-1.5 h-8">
                          {(["instagram", "facebook"] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => togglePlatform(i, p)}
                              className={`flex-1 rounded text-xs font-medium border transition-colors ${
                                entry.platforms.includes(p)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "text-muted-foreground border-border/40 hover:border-border"
                              }`}
                            >
                              {p === "instagram" ? "IG" : "FB"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
                      <Input
                        placeholder="Leave blank to fill in later..."
                        value={entry.caption}
                        onChange={e => updateEntry(i, "caption", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPhase("preview")} disabled={scheduling}>Back</Button>
            <Button onClick={handleScheduleAll} disabled={scheduling} className="min-w-40">
              {scheduling
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
                : `Schedule All (${items.length})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview phase ─────────────────────────────────────────────────────────────

  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button onClick={() => setPhase("upload")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Preview</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} carousel{items.length !== 1 ? "s" : ""}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <Download className="w-4 h-4 mr-2" />Download All
            </Button>
            <Button size="sm" onClick={goToSchedule}>
              <CalendarClock className="w-4 h-4 mr-2" />Send to Scheduler
            </Button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map(item => (
            <div key={item.id} className="border border-border/40 rounded-xl overflow-hidden bg-card/40">
              <div className="flex gap-1 p-3 bg-black/20">
                {item.thumbs.map((du, si) => (
                  <img key={si} src={du} alt={`slide ${si + 1}`} className="flex-1 rounded object-cover" style={{ aspectRatio: "4/5" }} />
                ))}
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-muted-foreground">Row {item.rowNum}</p>
                    {item.isHero && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5" />Hero
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate mt-0.5">{item.hook}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadSingle(item)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />ZIP
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Upload phase ──────────────────────────────────────────────────────────────

  const canGenerate = csvRows.length > 0 && selectedPresetId !== null;

  // Compute match stats for review table
  const rowStats = csvRows.map(row => ({
    ...row,
    hookText: stripPipe(row.slide1_hook),
    isHero: detectHero(row.slide1_hook),
    hasImage: imageFiles.has(normName(row.image_filename)),
    hasLogo: logoFiles.has(normName(row.logo_filename)),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">CSV Slide Carousel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">One CSV row per carousel. Images and logos matched by filename.</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Step 1: Preset */}
        <section className="space-y-3">
          <h2 className="font-semibold text-base">1. Choose a client</h2>
          <p className="text-sm text-muted-foreground">Brand colours and fallback logo come from the preset. Per-row logos override it.</p>
          <Select value={selectedPresetId?.toString() ?? ""} onValueChange={v => setSelectedPresetId(v ? parseInt(v) : null)}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select a client preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedPreset && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 max-w-sm">
              {selectedPreset.logoUrl && (
                <img src={selectedPreset.logoUrl} alt="logo" className="h-8 w-8 object-contain rounded" />
              )}
              <div className="flex gap-2 items-center">
                <div className="w-5 h-5 rounded" style={{ background: selectedPreset.pageColor || "#1a1a2e" }} />
                <div className="w-5 h-5 rounded border border-border/20" style={{ background: selectedPreset.textColor || "#fff" }} />
                <span className="text-xs text-muted-foreground ml-1">{selectedPreset.name}</span>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: CSV */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">2. Upload your CSV</h2>
            <button
              onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "csv-carousel-template.csv")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Download template
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Columns: {CSV_COLS.join(", ")}. Prefix <code className="bg-muted/40 px-1 rounded">|</code> on <code className="bg-muted/40 px-1 rounded">slide1_hook</code> for a Bebas Neue hero headline.
          </p>

          <div
            onDrop={handleCsvDrop}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
            onDragLeave={() => setCsvDrag(false)}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              csvDrag ? "border-primary/60 bg-primary/5" :
              csvRows.length ? "border-emerald-500/40 bg-emerald-500/5" :
              "border-border/40 hover:border-border/70"
            }`}
          >
            {csvRows.length ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{csvRows.length} row{csvRows.length !== 1 ? "s" : ""} loaded</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop CSV here or click to browse</p>
              </>
            )}
          </div>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { if (e.target.files?.[0]) parseCsv(e.target.files[0]); e.target.value = ""; }} />
          {csvError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{csvError}</p>}
        </section>

        {/* Step 3: Images + Logos */}
        <section className="space-y-4">
          <h2 className="font-semibold text-base">3. Upload images &amp; logos</h2>
          <p className="text-sm text-muted-foreground">
            Files are matched by filename to the <code className="bg-muted/40 px-1 rounded">image_filename</code> and <code className="bg-muted/40 px-1 rounded">logo_filename</code> columns. Names are case-insensitive.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Carousel images</Label>
              <p className="text-xs text-muted-foreground">One image per row, matched by filename.</p>
              <DropZone
                label="Drop images" hint="Matched by image_filename column"
                fileCount={imageFiles.size} accept="image/*" active={imgDrag} color="violet"
                onDragOver={() => setImgDrag(true)} onDragLeave={() => setImgDrag(false)}
                onDrop={handleImgDrop} onClick={() => imgInputRef.current?.click()}
              />
              <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) addFiles(setImageFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              {imageFiles.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[...imageFiles.values()].map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1">
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setImageFiles(prev => { const n = new Map(prev); n.delete(normName(f.name)); return n; })} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Logo files</Label>
              <p className="text-xs text-muted-foreground">One per client, matched by logo_filename. Falls back to preset logo.</p>
              <DropZone
                label="Drop logos" hint="Matched by logo_filename column"
                fileCount={logoFiles.size} accept="image/*" active={logoDrag} color="indigo"
                onDragOver={() => setLogoDrag(true)} onDragLeave={() => setLogoDrag(false)}
                onDrop={handleLogoDrop} onClick={() => logoInputRef.current?.click()}
              />
              <input ref={logoInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) addFiles(setLogoFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              {logoFiles.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[...logoFiles.values()].map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1">
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setLogoFiles(prev => { const n = new Map(prev); n.delete(normName(f.name)); return n; })} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 4: Review table */}
        {csvRows.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-base">4. Review rows</h2>
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 font-medium">Hook</th>
                      <th className="text-left px-3 py-2 font-medium">Subtitle</th>
                      <th className="text-left px-3 py-2 font-medium">CTA</th>
                      <th className="text-center px-3 py-2 font-medium">Image</th>
                      <th className="text-center px-3 py-2 font-medium">Logo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {rowStats.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 max-w-[160px]">
                          <div className="flex items-center gap-1.5">
                            {row.isHero && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                            <span className="font-medium truncate">{row.hookText}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.slide1_subtitle}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.slide4_cta}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {row.hasImage
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              : <X className="w-3.5 h-3.5 text-amber-400/60" />}
                            <span className="text-muted-foreground/60 text-[10px] truncate max-w-16">{row.image_filename}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {row.hasLogo
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              : <span className="text-amber-400/60 text-[10px]">preset</span>}
                            <span className="text-muted-foreground/60 text-[10px] truncate max-w-16">{row.logo_filename}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {rowStats.some(r => !r.hasImage) && (
              <p className="text-xs text-amber-400">Rows without a matched image will render with a solid brand colour background.</p>
            )}
            {rowStats.some(r => !r.hasLogo) && (
              <p className="text-xs text-muted-foreground">Rows without a matched logo will use the preset logo (if set).</p>
            )}
          </section>
        )}

        {/* Generate */}
        {canGenerate && (
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={rendering} size="lg" className="min-w-52">
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering... {renderProgress}%</>
                : `Generate ${csvRows.length} carousel${csvRows.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        {!canGenerate && csvRows.length > 0 && !selectedPresetId && (
          <p className="text-sm text-amber-400 text-right">Select a client preset to continue.</p>
        )}
      </div>
    </div>
  );
}
