import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2, CalendarClock,
  CheckCircle2, X, ChevronDown, Instagram, Facebook,
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
import { usePresets } from "@/lib/use-presets";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1350;
const SCALE = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

type CsvRow = {
  clinic_name: string;
  background_hex: string;
  font_colour_hex: string;
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
  image_filename: string;
  logo_filename: string;
};

type CarouselItem = {
  row: CsvRow;
  imageFile: File | null;
  logoFile: File | null;
  slides: string[];
};

type ScheduleEntry = {
  date: string;
  time: string;
  platforms: ("instagram" | "facebook")[];
  presetId: number | null;
  caption: string;
};

type Phase = "upload" | "preview" | "schedule" | "done";

const CSV_COLUMNS = [
  "clinic_name", "background_hex", "font_colour_hex",
  "slide1_hook", "slide1_subtitle", "slide2_body",
  "slide3_body", "slide4_cta", "image_filename", "logo_filename",
];

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function ensureHash(hex: string): string {
  if (!hex) return "#000000";
  const s = hex.trim();
  return s.startsWith("#") ? s : "#" + s;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = ensureHash(hex).replace("#", "").padEnd(6, "0");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
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

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  alpha: number
) {
  const scale = Math.max(W / img.width, H / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  const ix = (W - iw) / 2;
  const iy = (H - ih) / 2;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, ix, iy, iw, ih);
  ctx.globalAlpha = 1;
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const MAX = 110;
  const PAD = 44;
  const aspect = logo.width / logo.height;
  const lw = aspect >= 1 ? MAX : MAX * aspect;
  const lh = aspect >= 1 ? MAX / aspect : MAX;
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logo, W - lw - PAD, H - lh - PAD, lw, lh);
  ctx.globalAlpha = 1;
}

async function renderSlides(
  row: CsvRow,
  imageEl: HTMLImageElement | null,
  logoEl: HTMLImageElement | null
): Promise<string[]> {
  const bg = ensureHash(row.background_hex);
  const fg = ensureHash(row.font_colour_hex);
  const [br, bg_g, bb] = hexToRgb(bg);
  const slides: string[] = [];

  for (let slideNum = 1; slideNum <= 4; slideNum++) {
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Image
    if (imageEl) {
      if (slideNum === 1 || slideNum === 4) {
        drawCoverImage(ctx, imageEl, 0.42);
        ctx.fillStyle = `rgba(${br},${bg_g},${bb},0.48)`;
        ctx.fillRect(0, 0, W, H);
      } else {
        drawCoverImage(ctx, imageEl, 1.0);
        ctx.fillStyle = "rgba(0,0,0,0.58)";
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Text shadow for readability
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    if (slideNum === 1) {
      // Hook: Bebas Neue large, centred
      const hookSize = 108;
      const subSize = 44;
      ctx.font = `${hookSize}px "Bebas Neue"`;
      const hookLines = wrapText(ctx, (row.slide1_hook || "").toUpperCase(), W - 120);
      const subLines = row.slide1_subtitle
        ? (() => {
            ctx.font = `italic ${subSize}px "Prata"`;
            return wrapText(ctx, row.slide1_subtitle, W - 180);
          })()
        : [];
      const totalH =
        hookLines.length * hookSize * 1.1 +
        (subLines.length ? subSize * 1.5 * subLines.length + 20 : 0);
      let y = (H - totalH) / 2 + hookSize * 0.85;
      y = Math.max(y, H * 0.3);

      ctx.font = `${hookSize}px "Bebas Neue"`;
      for (const line of hookLines) {
        ctx.fillText(line, W / 2, y);
        y += hookSize * 1.1;
      }
      if (subLines.length) {
        y += 20;
        ctx.font = `italic ${subSize}px "Prata"`;
        for (const line of subLines) {
          ctx.fillText(line, W / 2, y);
          y += subSize * 1.5;
        }
      }
    } else if (slideNum === 2 || slideNum === 3) {
      // Body: Prata, centred vertically
      const bodyText = slideNum === 2 ? row.slide2_body : row.slide3_body;
      const fontSize = 50;
      const lineH = fontSize * 1.55;
      ctx.font = `${fontSize}px "Prata"`;
      const lines = wrapText(ctx, bodyText || "", W - 160);
      const totalH = lines.length * lineH;
      let y = (H - totalH) / 2 + fontSize * 0.85;
      for (const line of lines) {
        ctx.fillText(line, W / 2, y);
        y += lineH;
      }
    } else {
      // CTA: DM Serif Display, centred
      const fontSize = 76;
      const lineH = fontSize * 1.35;
      ctx.font = `${fontSize}px "DM Serif Display"`;
      const lines = wrapText(ctx, row.slide4_cta || "", W - 140);
      const totalH = lines.length * lineH;
      let y = (H - totalH) / 2 + fontSize * 0.85;
      for (const line of lines) {
        ctx.fillText(line, W / 2, y);
        y += lineH;
      }
    }

    // Logo
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    if (logoEl) drawLogo(ctx, logoEl);

    slides.push(canvas.toDataURL("image/png"));
  }

  return slides;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const batchDu = dataUrls.slice(i, i + BATCH);
    const batchNames = names.slice(i, i + BATCH);
    const images = batchDu.map((du, j) => ({ name: batchNames[j], base64: du }));
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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

function makeSampleCsv(): string {
  const header = CSV_COLUMNS.join(",");
  const row = [
    "Example Clinic",
    "1a1a2e",
    "ffffff",
    "Your headline hook goes here",
    "A short supporting subtitle",
    "Body copy for slide two goes here. Keep it concise and useful.",
    "Body copy for slide three. Another point worth making.",
    "Book your consultation today",
    "photo.jpg",
    "logo.png",
  ].join(",");
  return `${header}\n${row}\n`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BulkCarousel() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [imgDragOver, setImgDragOver] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { presets } = usePresets();

  // ── CSV ──

  const parseCsv = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) { setCsvError("CSV is empty."); return; }
        const missing = CSV_COLUMNS.filter((k) => !(k in result.data[0]));
        if (missing.length) { setCsvError(`Missing columns: ${missing.join(", ")}`); return; }
        setCsvError(null);
        setCsvRows(result.data as unknown as CsvRow[]);
      },
      error: (e) => setCsvError(e.message),
    });
  }, []);

  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragOver(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.name.endsWith(".csv")
    );
    if (file) parseCsv(file);
    else toast.error("Please drop a CSV file.");
  }, [parseCsv]);

  const handleCsvInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseCsv(file);
    e.target.value = "";
  };

  // ── Images ──

  const addImageFiles = useCallback((files: File[]) => {
    setImageFiles((prev) => {
      const next = new Map(prev);
      files.forEach((f) => next.set(f.name.toLowerCase(), f));
      return next;
    });
  }, []);

  const handleImgDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImgDragOver(false);
    addImageFiles(Array.from(e.dataTransfer.files));
  }, [addImageFiles]);

  const handleImgInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImageFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  // ── Render ──

  const matchFiles = () =>
    csvRows.map((row) => ({
      row,
      imageFile: imageFiles.get(row.image_filename?.toLowerCase()) ?? null,
      logoFile: imageFiles.get(row.logo_filename?.toLowerCase()) ?? null,
      slides: [],
    }));

  const handleGenerate = async () => {
    const built = matchFiles();
    if (!built.length) return;
    setRendering(true);
    setRenderProgress(0);
    try {
      await document.fonts.ready;
      const rendered: CarouselItem[] = [];
      for (let i = 0; i < built.length; i++) {
        const item = built[i];
        let imageEl: HTMLImageElement | null = null;
        let logoEl: HTMLImageElement | null = null;
        if (item.imageFile) {
          try { imageEl = await loadImg(URL.createObjectURL(item.imageFile)); } catch {}
        }
        if (item.logoFile) {
          try { logoEl = await loadImg(URL.createObjectURL(item.logoFile)); } catch {}
        }
        const slides = await renderSlides(item.row, imageEl, logoEl);
        rendered.push({ ...item, slides });
        setRenderProgress(Math.round(((i + 1) / built.length) * 100));
      }
      setItems(rendered);
      setPhase("preview");
    } catch (e: any) {
      toast.error("Render failed: " + e.message);
    } finally {
      setRendering(false);
    }
  };

  // ── Export ──

  const downloadSingle = async (item: CarouselItem) => {
    const zip = new JSZip();
    item.slides.forEach((du, i) => zip.file(`slide${i + 1}.png`, du.split(",")[1], { base64: true }));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${item.row.clinic_name.replace(/[^a-z0-9]/gi, "-")}-carousel.zip`);
  };

  const downloadAll = async () => {
    const toastId = toast.loading("Building master ZIP...");
    try {
      const zip = new JSZip();
      items.forEach((item) => {
        const folder = zip.folder(item.row.clinic_name.replace(/[^a-z0-9_-]/gi, "-")) ?? zip;
        item.slides.forEach((du, i) => folder.file(`slide${i + 1}.png`, du.split(",")[1], { base64: true }));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "bulk-carousels.zip");
      toast.success("Download started.", { id: toastId });
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  // ── Schedule ──

  const goToSchedule = () => {
    const today = new Date().toISOString().slice(0, 10);
    const entries: ScheduleEntry[] = items.map((item) => {
      const matched = presets.find(
        (p) => p.name.toLowerCase().trim() === item.row.clinic_name.toLowerCase().trim()
      );
      return {
        date: today,
        time: "09:00",
        platforms: ["instagram"],
        presetId: matched?.id ?? null,
        caption: "",
      };
    });
    setScheduleEntries(entries);
    setPhase("schedule");
  };

  const updateEntry = <K extends keyof ScheduleEntry>(
    idx: number,
    key: K,
    val: ScheduleEntry[K]
  ) => {
    setScheduleEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: val } : e)));
  };

  const togglePlatform = (idx: number, plat: "instagram" | "facebook") => {
    setScheduleEntries((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        const has = e.platforms.includes(plat);
        if (has && e.platforms.length === 1) return e;
        return { ...e, platforms: has ? e.platforms.filter((p) => p !== plat) : [...e.platforms, plat] };
      })
    );
  };

  const handleScheduleAll = async () => {
    const bad = scheduleEntries.findIndex((e) => !e.presetId);
    if (bad !== -1) {
      toast.error(`Row ${bad + 1}: select a client account.`);
      return;
    }
    setScheduling(true);
    const toastId = toast.loading("Uploading and queueing posts...");
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = scheduleEntries[i];
        toast.loading(`Scheduling ${i + 1} / ${items.length}: ${item.row.clinic_name}...`, { id: toastId });
        const names = item.slides.map((_, j) => `${item.row.clinic_name.replace(/\s+/g, "-")}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(item.slides, names);
        const scheduledAt = new Date(`${entry.date}T${entry.time}`).toISOString();
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: entry.presetId,
            postType: "carousel",
            content: {
              imageUrls,
              caption: entry.caption || "",
              title: item.row.clinic_name,
              platforms: entry.platforms,
            },
            scheduledAt,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(`${item.row.clinic_name}: ${err.error || "Failed"}`);
        }
      }
      toast.success(`${items.length} carousels queued.`, { id: toastId });
      setPhase("done");
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setScheduling(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
        <CheckCircle2 className="w-14 h-14 text-emerald-400" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">All carousels queued</h2>
          <p className="text-muted-foreground">
            {items.length} {items.length === 1 ? "post" : "posts"} added to the scheduler.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/scheduler">View the queue</Link>
          </Button>
          <Button onClick={() => {
            setCsvRows([]); setImageFiles(new Map()); setItems([]); setScheduleEntries([]); setPhase("upload");
          }}>
            Start again
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "schedule") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
          <button onClick={() => setPhase("preview")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Schedule Carousels</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} posts</span>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-muted-foreground text-sm mb-6">
            Set a date, time and platform for each carousel. Posts go to the client account matched to the clinic name, or pick one from the dropdown.
          </p>

          <div className="space-y-3">
            {items.map((item, i) => {
              const entry = scheduleEntries[i];
              if (!entry) return null;
              return (
                <div key={i} className="border border-border/40 rounded-xl p-4 bg-card/40">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm">{item.row.clinic_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">4 slides</p>
                      </div>
                      <div className="flex gap-1">
                        {item.slides.slice(0, 4).map((du, si) => (
                          <img key={si} src={du} alt={`slide ${si + 1}`} className="w-10 h-12 object-cover rounded" />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Client</Label>
                        <Select
                          value={entry.presetId?.toString() ?? ""}
                          onValueChange={(v) => updateEntry(i, "presetId", v ? parseInt(v) : null)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pick client" />
                          </SelectTrigger>
                          <SelectContent>
                            {presets.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={entry.date}
                          onChange={(e) => updateEntry(i, "date", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          type="time"
                          value={entry.time}
                          onChange={(e) => updateEntry(i, "time", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Platforms</Label>
                        <div className="flex gap-1.5">
                          {(["instagram", "facebook"] as const).map((plat) => (
                            <button
                              key={plat}
                              onClick={() => togglePlatform(i, plat)}
                              className={`flex-1 py-1 rounded text-xs font-medium transition-colors border ${
                                entry.platforms.includes(plat)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-transparent text-muted-foreground border-border/40 hover:border-border"
                              }`}
                            >
                              {plat === "instagram" ? "IG" : "FB"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
                      <Input
                        placeholder="Leave blank to add later in the scheduler..."
                        value={entry.caption}
                        onChange={(e) => updateEntry(i, "caption", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPhase("preview")} disabled={scheduling}>
              Back
            </Button>
            <Button onClick={handleScheduleAll} disabled={scheduling} className="min-w-36">
              {scheduling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</> : `Schedule All (${items.length})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button onClick={() => setPhase("upload")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Preview</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} carousels</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
            <Button size="sm" onClick={goToSchedule}>
              <CalendarClock className="w-4 h-4 mr-2" />
              Send to Scheduler
            </Button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((item, i) => (
              <div key={i} className="border border-border/40 rounded-xl overflow-hidden bg-card/40">
                <div className="flex gap-1 p-3 bg-black/20">
                  {item.slides.map((du, si) => (
                    <img key={si} src={du} alt={`slide ${si + 1}`} className="flex-1 object-cover rounded" style={{ aspectRatio: "4/5" }} />
                  ))}
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{item.row.clinic_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-56">{item.row.slide1_hook}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadSingle(item)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    ZIP
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Upload phase ─────────────────────────────────────────────────────────

  const missingImages = csvRows.filter(
    (r) => r.image_filename && !imageFiles.has(r.image_filename.toLowerCase())
  );
  const canGenerate = csvRows.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Bulk Carousel Creator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">One CSV, one folder of images, one master ZIP.</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Step 1: CSV */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">1. Upload your CSV</h2>
            <button
              onClick={() => {
                const blob = new Blob([makeSampleCsv()], { type: "text/csv" });
                saveAs(blob, "bulk-carousel-template.csv");
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download template
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Required columns: {CSV_COLUMNS.join(", ")}.
          </p>

          <div
            onDrop={handleCsvDrop}
            onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
            onDragLeave={() => setCsvDragOver(false)}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              csvDragOver
                ? "border-primary/60 bg-primary/5"
                : csvRows.length
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border/40 hover:border-border/70"
            }`}
          >
            {csvRows.length ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{csvRows.length} rows loaded</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop CSV here or click to browse</p>
              </>
            )}
          </div>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvInput} />

          {csvError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{csvError}</p>
          )}
        </section>

        {/* Step 2: Images */}
        <section className="space-y-3">
          <h2 className="font-semibold text-base">2. Upload images and logos</h2>
          <p className="text-sm text-muted-foreground">
            Upload all image and logo files referenced in your CSV. Filenames must match exactly.
          </p>

          <div
            onDrop={handleImgDrop}
            onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
            onDragLeave={() => setImgDragOver(false)}
            onClick={() => imgInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              imgDragOver
                ? "border-primary/60 bg-primary/5"
                : imageFiles.size
                ? "border-indigo-500/40 bg-indigo-500/5"
                : "border-border/40 hover:border-border/70"
            }`}
          >
            {imageFiles.size ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-indigo-400" />
                <p className="text-sm font-medium text-indigo-400">{imageFiles.size} file{imageFiles.size !== 1 ? "s" : ""} loaded</p>
                <p className="text-xs text-muted-foreground">Click or drop to add more</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop images and logos here or click to browse</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP</p>
              </>
            )}
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgInput} />

          {imageFiles.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(imageFiles.keys()).map((name) => (
                <span key={name} className="text-xs bg-muted/40 px-2 py-1 rounded-full text-muted-foreground flex items-center gap-1.5">
                  {name}
                  <button onClick={(e) => { e.stopPropagation(); setImageFiles(prev => { const n = new Map(prev); n.delete(name); return n; }); }}>
                    <X className="w-3 h-3 hover:text-foreground" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Step 3: CSV preview table */}
        {csvRows.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-base">3. Review rows</h2>
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Clinic</th>
                      <th className="text-left px-3 py-2 font-medium">Hook</th>
                      <th className="text-left px-3 py-2 font-medium">Image</th>
                      <th className="text-left px-3 py-2 font-medium">Logo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {csvRows.map((row, i) => {
                      const hasImg = imageFiles.has(row.image_filename?.toLowerCase());
                      const hasLogo = imageFiles.has(row.logo_filename?.toLowerCase());
                      return (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-medium max-w-32 truncate">{row.clinic_name}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-48 truncate">{row.slide1_hook}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 ${hasImg ? "text-emerald-400" : "text-amber-400"}`}>
                              {hasImg ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              <span className="truncate max-w-24">{row.image_filename || "—"}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 ${hasLogo ? "text-emerald-400" : row.logo_filename ? "text-amber-400" : "text-muted-foreground"}`}>
                              {hasLogo ? <CheckCircle2 className="w-3 h-3" /> : row.logo_filename ? <X className="w-3 h-3" /> : null}
                              <span className="truncate max-w-24">{row.logo_filename || "—"}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {missingImages.length > 0 && (
              <p className="text-sm text-amber-400">
                {missingImages.length} image file{missingImages.length !== 1 ? "s" : ""} not yet uploaded. Slides will render with a solid background colour instead.
              </p>
            )}
          </section>
        )}

        {/* Generate button */}
        {canGenerate && (
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={rendering}
              size="lg"
              className="min-w-48"
            >
              {rendering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rendering... {renderProgress}%
                </>
              ) : (
                `Generate ${csvRows.length} carousel${csvRows.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
