import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, RefreshCw, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import { readFileAsText, stripSlideCsvTitleRow } from "@/lib/csv-format";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { ScheduleModal } from "@/components/schedule-modal";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;
const SLIDES_PER_POST = 3;
const LIST_MAX = 8;

// ── CSV columns (positional, 15 total) ───────────────────────────────────────
// Slide1Text1, Slide1Text2, Slide1Text3, Slide2Title, Slide2Text,
// Slide2List1..8, Slide3Text, Slide3CTA
const TEMPLATE_HEADER = [
  "Slide 1 Text 1", "Slide 1 Text 2", "Slide 1 Text 3",
  "Slide 2 Title", "Slide 2 Text",
  "Slide 2 List 1", "Slide 2 List 2", "Slide 2 List 3", "Slide 2 List 4",
  "Slide 2 List 5", "Slide 2 List 6", "Slide 2 List 7", "Slide 2 List 8",
  "Slide 3 Text", "Slide 3 CTA",
];

type EditorialRow = {
  s1t1: string; s1t2: string; s1t3: string;
  s2title: string; s2text: string; s2list: string[];
  s3t1: string; s3cta: string;
};

type Phase = "upload" | "preview";
type SlideFonts = { s1: string; s2: string; s3: string };

function makeSampleCsv(): string {
  return [
    TEMPLATE_HEADER.join(","),
    [
      "New in clinic", "Skin that glows from within", "",
      "Why this treatment works", "Collagen stimulation starts from the first session.",
      "Boosts hydration", "Smooths fine lines", "Improves tone", "Minimal downtime",
      "Results build over weeks", "Safe for all skin types", "Quick 30 minute session", "",
      "Ready to feel confident in your skin?", "Book your consultation today",
    ].join(","),
    "",
  ].join("\n");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function parseOverlayColor(color: string): string {
  if (color.startsWith("rgba") || color.startsWith("rgb")) return color;
  if (color.startsWith("#")) {
    const h = color.slice(1).padEnd(6, "0");
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},0.5)`;
  }
  return color;
}

function drawCornerDecoration(ctx: CanvasRenderingContext2D, style: string, color: string) {
  if (!style || style === "none") return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const S = 180;
  if (style === "triangle") {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W - S, H); ctx.lineTo(W, H - S); ctx.closePath(); ctx.fill();
  } else if (style === "arc") {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, S, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, H, S, Math.PI, 1.5 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, 0, S, 0.5 * Math.PI, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, H, S, 1.5 * Math.PI, 2 * Math.PI); ctx.stroke();
  } else if (style === "double-line") {
    ctx.lineWidth = 4;
    [0, 12].forEach(off => { ctx.strokeRect(30 + off, 30 + off, W - 2 * (30 + off), H - 2 * (30 + off)); });
  } else if (style === "frame") {
    ctx.lineWidth = 5;
    const L = 120, M = 40;
    ctx.beginPath();
    ctx.moveTo(M, M + L); ctx.lineTo(M, M); ctx.lineTo(M + L, M);
    ctx.moveTo(W - M - L, M); ctx.lineTo(W - M, M); ctx.lineTo(W - M, M + L);
    ctx.moveTo(W - M, H - M - L); ctx.lineTo(W - M, H - M); ctx.lineTo(W - M - L, H - M);
    ctx.moveTo(M + L, H - M); ctx.lineTo(M, H - M); ctx.lineTo(M, H - M - L);
    ctx.stroke();
  }
}

function drawLogo(ctx: CanvasRenderingContext2D, logoImg: HTMLImageElement, position: string, size: number) {
  if (!position || position === "none") return;
  const PAD_L = 44;
  const asp = logoImg.naturalWidth / logoImg.naturalHeight;
  const lw = asp >= 1 ? size : size * asp;
  const lh = asp >= 1 ? size / asp : size;
  let x = 0, y = 0;
  if (position === "top-left")        { x = PAD_L;          y = PAD_L; }
  else if (position === "top-right")  { x = W - lw - PAD_L; y = PAD_L; }
  else if (position === "bottom-left"){ x = PAD_L;          y = H - lh - PAD_L; }
  else                                { x = W - lw - PAD_L; y = H - lh - PAD_L; }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logoImg, x, y, lw, lh);
  ctx.globalAlpha = 1;
}

function drawBg(ctx: CanvasRenderingContext2D, preset: ClientPreset, bgImg: HTMLImageElement | null) {
  ctx.fillStyle = preset.pageColor || "#000000";
  ctx.fillRect(0, 0, W, H);
  if (bgImg) {
    const s = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const dw = bgImg.naturalWidth * s;
    const dh = bgImg.naturalHeight * s;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(bgImg, dx, dy, dw, dh);
  }
  const overlay = parseOverlayColor(preset.overlayColor || "rgba(0,0,0,0.45)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);
}

function renderSlide(
  slideNum: 1 | 2 | 3,
  row: EditorialRow,
  preset: ClientPreset,
  fonts: SlideFonts,
  textColor: string,
  logoImg: HTMLImageElement | null,
  bgImg: HTMLImageElement | null,
  scale = SCALE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  drawBg(ctx, preset, bgImg);
  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = textColor;

  const PAD = 90;
  const maxW = W - PAD * 2;

  if (slideNum === 1) {
    const font = fonts.s1;
    const blocks: { text: string; size: number; weight: string; style: string; gapAfter: number }[] = [];
    if (row.s1t1) blocks.push({ text: row.s1t1, size: 44, weight: "400", style: "normal", gapAfter: 14 });
    if (row.s1t2) blocks.push({ text: row.s1t2, size: 58, weight: "700", style: "italic", gapAfter: 14 });
    if (row.s1t3) blocks.push({ text: row.s1t3, size: 36, weight: "400", style: "normal", gapAfter: 0 });

    const measured = blocks.map(b => {
      ctx.font = `${b.style} ${b.weight} ${b.size}px ${font}`;
      const lines = wrapText(ctx, b.text, maxW);
      const lineH = Math.round(b.size * 1.25);
      return { ...b, lines, lineH, blockH: lines.length * lineH };
    });
    const totalH = measured.reduce((sum, b) => sum + b.blockH + b.gapAfter, 0);
    let y = Math.round(H * 0.42 - totalH / 2);
    for (const b of measured) {
      ctx.font = `${b.style} ${b.weight} ${b.size}px ${font}`;
      for (const line of b.lines) { ctx.fillText(line, W / 2, y); y += b.lineH; }
      y += b.gapAfter;
    }
  }

  if (slideNum === 2) {
    const font = fonts.s2;
    let y = Math.round(H * 0.14);

    if (row.s2title) {
      ctx.font = `700 56px ${font}`;
      const lines = wrapText(ctx, row.s2title, maxW);
      const lineH = Math.round(56 * 1.2);
      for (const line of lines) { ctx.fillText(line, W / 2, y); y += lineH; }
      y += 26;
    }
    if (row.s2text) {
      ctx.font = `400 40px ${font}`;
      const lines = wrapText(ctx, row.s2text, maxW);
      const lineH = Math.round(40 * 1.35);
      for (const line of lines) { ctx.fillText(line, W / 2, y); y += lineH; }
      y += 34;
    }

    const items = row.s2list.filter(t => t.trim().length > 0);
    if (items.length) {
      ctx.font = `400 34px ${font}`;
      const itemLineH = Math.round(34 * 1.3);
      const bulletMaxW = maxW - 60;
      const savedAlign = ctx.textAlign;
      ctx.textAlign = "left";
      for (const item of items) {
        const lines = wrapText(ctx, item, bulletMaxW);
        ctx.fillText("✦", PAD, y);
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], PAD + 54, y + i * itemLineH);
        }
        y += lines.length * itemLineH + 12;
      }
      ctx.textAlign = savedAlign;
    }
  }

  if (slideNum === 3) {
    const font = fonts.s3;
    const blocks: { text: string; size: number; weight: string; style: string; gapAfter: number }[] = [];
    if (row.s3t1) blocks.push({ text: row.s3t1, size: 46, weight: "400", style: "normal", gapAfter: 20 });
    if (row.s3cta) blocks.push({ text: row.s3cta, size: 60, weight: "700", style: "italic", gapAfter: 0 });

    const measured = blocks.map(b => {
      ctx.font = `${b.style} ${b.weight} ${b.size}px ${font}`;
      const lines = wrapText(ctx, b.text, maxW);
      const lineH = Math.round(b.size * 1.25);
      return { ...b, lines, lineH, blockH: lines.length * lineH };
    });
    const totalH = measured.reduce((sum, b) => sum + b.blockH + b.gapAfter, 0);
    let y = Math.round(H * 0.58 - totalH / 2);
    for (const b of measured) {
      ctx.font = `${b.style} ${b.weight} ${b.size}px ${font}`;
      for (const line of b.lines) { ctx.fillText(line, W / 2, y); y += b.lineH; }
      y += b.gapAfter;
    }
  }

  if (logoImg) drawLogo(ctx, logoImg, preset.logoPosition || "top-left", preset.logoSize || 110);

  return canvas.toDataURL("image/png");
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

async function compressDataUrl(dataUrl: string, maxPx = 1080, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = await Promise.all(
      dataUrls.slice(i, i + BATCH).map(async (du, j) => ({ name: names[i + j], base64: await compressDataUrl(du) }))
    );
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "Images too large — try smaller files" : `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

async function warmFonts(fonts: SlideFonts) {
  const unique = Array.from(new Set([fonts.s1, fonts.s2, fonts.s3]));
  await Promise.allSettled(
    unique.flatMap(f => [
      document.fonts.load(`400 40px ${f}`),
      document.fonts.load(`700 italic 56px ${f}`),
    ])
  );
}

async function loadPresetLogo(preset: ClientPreset): Promise<HTMLImageElement | null> {
  if (!preset.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|avif)$/i;
function naturalFileCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export default function EditorialPosts() {
  const { presets, loading: presetsLoading } = usePresets();
  const [phase, setPhase] = useState<Phase>("upload");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<EditorialRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvDrag, setCsvDrag] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoDrag, setPhotoDrag] = useState(false);

  const [fonts, setFonts] = useState<SlideFonts>({
    s1: "'Bebas Neue', sans-serif",
    s2: "'Poppins', sans-serif",
    s3: "'Bebas Neue', sans-serif",
  });
  const [textColor, setTextColor] = useState("#ffffff");

  const [thumbs, setThumbs] = useState<string[][]>([]); // per row: 3 data URLs
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleUrls, setScheduleUrls] = useState<string[][]>([]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? null;

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    readFileAsText(file).then((raw) => {
      const normalized = stripSlideCsvTitleRow(raw, true);
      Papa.parse<string[]>(normalized, {
        skipEmptyLines: true,
        complete: (result) => {
          const allRows = result.data;
          if (!allRows.length) { setCsvError("CSV is empty"); return; }
          const dataRows = allRows.slice(1); // skip header row
          if (!dataRows.length) { setCsvError("No data rows after the header"); return; }
          const parsed: EditorialRow[] = dataRows
            .map(r => (Array.isArray(r) ? r : [String(r)]).map(c => String(c ?? "").trim()))
            .filter(cols => cols.some(c => c.length > 0))
            .map(cols => ({
              s1t1: cols[0] ?? "", s1t2: cols[1] ?? "", s1t3: cols[2] ?? "",
              s2title: cols[3] ?? "", s2text: cols[4] ?? "",
              s2list: [cols[5], cols[6], cols[7], cols[8], cols[9], cols[10], cols[11], cols[12]].map(c => c ?? ""),
              s3t1: cols[13] ?? "", s3cta: cols[14] ?? "",
            }));
          if (!parsed.length) { setCsvError("No valid rows found"); return; }
          setRows(parsed);
          setCsvFile(file);
        },
        error: (err: Error) => setCsvError(err.message),
      });
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) parseCsv(file);
  };

  const handlePhotos = useCallback((incoming: File[]) => {
    setPhotoUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
    const sorted = [...incoming].sort((a, b) => naturalFileCompare(a.name, b.name));
    setPhotoFiles(sorted);
    setPhotoUrls(sorted.map(f => URL.createObjectURL(f)));
  }, []);

  const loadPhotoImgs = useCallback(async (): Promise<HTMLImageElement[]> => {
    if (!photoUrls.length) return [];
    const results = await Promise.allSettled(photoUrls.map(u => loadImg(u)));
    return results.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
  }, [photoUrls]);

  const renderThumbs = useCallback(async (preset: ClientPreset, rowList: EditorialRow[], photoImgs: HTMLImageElement[]) => {
    setRendering(true);
    try {
      await warmFonts(fonts);
      const logoImg = await loadPresetLogo(preset);
      const out = rowList.map((row, i) => {
        const img = photoImgs[i] ?? photoImgs[photoImgs.length - 1] ?? null;
        return [1, 2, 3].map(n => renderSlide(n as 1 | 2 | 3, row, preset, fonts, textColor, logoImg, img, 1));
      });
      setThumbs(out);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }, [fonts, textColor]);

  const handleGenerate = async () => {
    if (!selectedPreset) { toast.error("Select a client preset first"); return; }
    if (!rows.length) { toast.error("Upload a CSV first"); return; }
    if (!photoFiles.length) { toast.error("Upload your photos first"); return; }
    const photoImgs = await loadPhotoImgs();
    await renderThumbs(selectedPreset, rows, photoImgs);
    setPhase("preview");
  };

  const handleReRender = async () => {
    if (!selectedPreset) return;
    const photoImgs = await loadPhotoImgs();
    await renderThumbs(selectedPreset, rows, photoImgs);
  };

  const handlePresetSwitch = async (id: number) => {
    setSelectedPresetId(id);
    const p = presets.find(x => x.id === id);
    if (p && rows.length && phase === "preview") {
      const photoImgs = await loadPhotoImgs();
      await renderThumbs(p, rows, photoImgs);
    }
  };

  const handleDownload = async () => {
    if (!selectedPreset) return;
    setExporting(true);
    try {
      await warmFonts(fonts);
      const [logoImg, photoImgs] = await Promise.all([loadPresetLogo(selectedPreset), loadPhotoImgs()]);
      const zip = new JSZip();
      rows.forEach((row, ri) => {
        const folder = `post-${String(ri + 1).padStart(2, "0")}`;
        const img = photoImgs[ri] ?? photoImgs[photoImgs.length - 1] ?? null;
        [1, 2, 3].forEach((n) => {
          const png = renderSlide(n as 1 | 2 | 3, row, selectedPreset, fonts, textColor, logoImg, img, SCALE);
          const b64 = png.split(",")[1];
          zip.file(`${folder}/slide-${n}.png`, b64, { base64: true });
        });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `editorial-posts-${Date.now()}.zip`);
      toast.success(`${rows.length} post${rows.length !== 1 ? "s" : ""} downloaded`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedPreset) return;
    setScheduling(true);
    try {
      await warmFonts(fonts);
      const [logoImg, photoImgs] = await Promise.all([loadPresetLogo(selectedPreset), loadPhotoImgs()]);
      const toastId = toast.loading(`Uploading ${rows.length * SLIDES_PER_POST} image${rows.length !== 1 ? "s" : ""}…`);
      const grouped: string[][] = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const img = photoImgs[ri] ?? photoImgs[photoImgs.length - 1] ?? null;
        const dataUrls = [1, 2, 3].map(n => renderSlide(n as 1 | 2 | 3, rows[ri], selectedPreset, fonts, textColor, logoImg, img, SCALE));
        const names = [1, 2, 3].map(n => `${String(ri + 1).padStart(3, "0")}-slide-${n}.png`);
        const urls = await uploadDataUrls(dataUrls, names);
        grouped.push(urls);
      }
      toast.dismiss(toastId);
      setScheduleUrls(grouped);
      setShowSchedule(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScheduling(false);
    }
  };

  // Re-render when fonts/colour change during preview
  useEffect(() => {
    if (phase !== "preview" || !selectedPreset || !rows.length) return;
    const id = setTimeout(() => { handleReRender(); }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, textColor]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">Editorial Posts</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {phase === "upload" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Editorial Posts</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                Each row in your CSV becomes one 3-slide carousel, using the same photo across all three slides.
                Slide 1 is your opener (3 text lines), Slide 2 is a title, intro text and up to 8 list points, Slide 3 is a closing line and your call to action.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Photos <span className="text-muted-foreground font-normal">(one per row, matched by filename order — e.g. 12 photos for 12 rows)</span>
                </Label>
                <div
                  onDrop={e => {
                    e.preventDefault(); setPhotoDrag(false);
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || IMAGE_EXT_RE.test(f.name));
                    if (files.length) handlePhotos(files);
                  }}
                  onDragOver={e => { e.preventDefault(); setPhotoDrag(true); }}
                  onDragLeave={() => setPhotoDrag(false)}
                  onClick={() => photoInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    photoDrag ? "border-amber-500/60 bg-amber-500/5" :
                    photoFiles.length ? "border-amber-500/40 bg-amber-500/5" :
                                   "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {photoFiles.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-amber-400 shrink-0" />
                      <p className="text-sm font-medium text-amber-400">
                        {photoFiles.length} photo{photoFiles.length !== 1 ? "s" : ""} loaded
                      </p>
                      <div className="w-full max-h-28 overflow-y-auto space-y-0.5 text-left">
                        {photoFiles.map((f, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground truncate px-1">
                            <span className="text-amber-500/70 font-mono mr-1">{String(i + 1).padStart(2, "0")}.</span>
                            {f.name}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Click to replace all</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop photos here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Photo 1 → row 1, photo 2 → row 2, and so on.<br />
                        Fewer photos than rows? The last photo repeats.
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) handlePhotos(files);
                    e.target.value = "";
                  }}
                />
                {photoFiles.length > 0 && rows.length > 0 && photoFiles.length < rows.length && (
                  <p className="text-xs text-amber-500/80">
                    {photoFiles.length} photo{photoFiles.length !== 1 ? "s" : ""} for {rows.length} rows — last photo repeats for the remaining {rows.length - photoFiles.length}.
                  </p>
                )}
                {photoFiles.length > 0 && rows.length > 0 && photoFiles.length === rows.length && (
                  <p className="text-xs text-green-500/80">Perfect — {photoFiles.length} photos matched to {rows.length} rows.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">CSV File</Label>
                <div
                  onDrop={handleCsvDrop}
                  onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                  onDragLeave={() => setCsvDrag(false)}
                  onClick={() => csvInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    csvDrag  ? "border-sky-500/60 bg-sky-500/5" :
                    csvFile  ? "border-sky-500/40 bg-sky-500/5" :
                               "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {csvFile ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-sky-400" />
                      <p className="text-sm font-medium text-sky-400">{csvFile.name}</p>
                      <p className="text-xs text-muted-foreground">{rows.length} row{rows.length !== 1 ? "s" : ""} — click to replace</p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">15 columns — see template</p>
                    </>
                  )}
                </div>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) parseCsv(f);
                    e.target.value = "";
                  }}
                />
                {csvError && <p className="text-xs text-destructive">{csvError}</p>}
                <button
                  onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "editorial-posts-template.csv")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />Download template
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Client Preset</Label>
                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => setSelectedPresetId(Number(v))}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40">
                    <SelectValue placeholder={presetsLoading ? "Loading…" : "Select a client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreset && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <div className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0" style={{ background: selectedPreset.pageColor }} />
                    {selectedPreset.logoUrl && <span className="text-xs text-muted-foreground">logo attached</span>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Background, overlay, corners and logo come from the preset. Fonts and text colour are set below.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Fonts &amp; Colour</Label>
                <div className="space-y-2 bg-muted/20 border border-border/30 rounded-xl p-3">
                  {([
                    ["s1", "Slide 1 font"],
                    ["s2", "Slide 2 font"],
                    ["s3", "Slide 3 font"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="text-xs text-muted-foreground whitespace-nowrap w-24">{label}</label>
                      <select
                        value={fonts[key]}
                        onChange={e => setFonts(f => ({ ...f, [key]: e.target.value }))}
                        className="h-8 flex-1 rounded border border-border/40 bg-background px-2 text-sm"
                      >
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap w-24">Text colour</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={e => setTextColor(e.target.value)}
                      className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!rows.length || !photoFiles.length || !selectedPreset || rendering}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering…</>
                : "Generate Posts"}
            </Button>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-1">Preview</h2>
                <p className="text-muted-foreground text-sm">
                  {rows.length} post{rows.length !== 1 ? "s" : ""} · {rows.length * SLIDES_PER_POST} slides · {selectedPreset?.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setPhase("upload")}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />Back
                </Button>

                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => handlePresetSwitch(Number(v))}
                  disabled={rendering}
                >
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/40 w-44">
                    <SelectValue placeholder="Switch preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="sm" onClick={handleReRender} disabled={rendering || !selectedPreset} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {rendering
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Rendering…</>
                    : <><RefreshCw className="w-4 h-4 mr-1.5" />Re-render</>}
                </Button>

                <Button variant="outline" size="sm" onClick={handleDownload} disabled={exporting || rendering}>
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1.5" />ZIP</>}
                </Button>

                <Button size="sm" onClick={handleSchedule} disabled={scheduling || rendering} className="bg-pink-600 hover:bg-pink-700 text-white">
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                </Button>
              </div>
            </div>

            {rendering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering thumbnails…
              </div>
            )}

            <div className="space-y-8">
              {rows.map((row, ri) => (
                <div key={ri} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Post {ri + 1} of {rows.length}
                    </span>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {[0, 1, 2].map(si => {
                      const thumb = thumbs[ri]?.[si];
                      return (
                        <div key={si} className="relative rounded-lg overflow-hidden border border-border/30 shrink-0" style={{ width: 120 }}>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={`Post ${ri + 1}, slide ${si + 1}`}
                              className="w-full object-cover"
                              style={{ aspectRatio: `${W}/${H}` }}
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full bg-muted/30 flex items-center justify-center" style={{ aspectRatio: `${W}/${H}` }}>
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                            <span className="text-[10px] text-white/70 font-medium">{si + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showSchedule && selectedPreset && (
        <ScheduleModal
          presetId={selectedPreset.id}
          presetName={selectedPreset.name}
          postType="carousel"
          posts={scheduleUrls.map((urls, i) => ({
            title: `Post ${i + 1} of ${scheduleUrls.length} · ${selectedPreset.name}`,
            caption: "",
            imageUrls: urls,
          }))}
          onClose={() => setShowSchedule(false)}
          onSaved={() => setShowSchedule(false)}
          presets={presets.map(p => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
