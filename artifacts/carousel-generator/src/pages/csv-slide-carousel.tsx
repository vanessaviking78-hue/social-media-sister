import { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, RefreshCw, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { ScheduleModal } from "@/components/schedule-modal";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;

const CAROUSEL_SIZE = 5;

const HERO_SIZE  = 110;
const BODY_SIZE  = 50;
const SUB_SIZE   = 36;
const HERO_LINE_H = Math.round(HERO_SIZE * 1.08);
const BODY_LINE_H = Math.round(BODY_SIZE * 1.55);
const SUB_LINE_H  = Math.round(SUB_SIZE * 1.45);
const SEG_GAP    = 28;
const PAD        = 90;

type Segment = { text: string; isHero: boolean };
type SlideData = { rawText: string; text: string; isHero: boolean; subtitle?: string };
type Phase = "upload" | "preview";

function parseSegments(raw: string): Segment[] {
  const parts = raw.split(/\|([^|]+)\|/);
  return parts
    .map((p, i) => ({ text: p.trim(), isHero: i % 2 === 1 }))
    .filter(s => s.text.length > 0);
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

function renderSlide(slide: SlideData, preset: ClientPreset, logoImg: HTMLImageElement | null, scale = SCALE, bgImg: HTMLImageElement | null = null): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

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

  const overlay = parseOverlayColor(preset.overlayColor || "rgba(0,0,0,0.5)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");

  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle    = preset.textColor || "#ffffff";
  ctx.shadowColor  = "rgba(0,0,0,0.7)";
  ctx.shadowBlur   = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  if (slide.isHero) {
    const segments = parseSegments(slide.rawText);

    type RenderedSeg = { lines: string[]; isHero: boolean; lineH: number; size: number; font: string };
    const renderedSegs: RenderedSeg[] = segments.map(seg => {
      if (seg.isHero) {
        ctx.font = `700 ${HERO_SIZE}px 'Bebas Neue', sans-serif`;
        return {
          lines: wrapText(ctx, seg.text.toUpperCase(), W - PAD * 2),
          isHero: true,
          lineH: HERO_LINE_H,
          size: HERO_SIZE,
          font: `700 ${HERO_SIZE}px 'Bebas Neue', sans-serif`,
        };
      } else {
        ctx.font = `400 ${BODY_SIZE}px 'Prata', serif`;
        return {
          lines: wrapText(ctx, seg.text, W - PAD * 2),
          isHero: false,
          lineH: BODY_LINE_H,
          size: BODY_SIZE,
          font: `400 ${BODY_SIZE}px 'Prata', serif`,
        };
      }
    });

    let totalH = renderedSegs.reduce((acc, s, i) => {
      return acc + s.lines.length * s.lineH + (i < renderedSegs.length - 1 ? SEG_GAP : 0);
    }, 0);

    const sub = slide.subtitle?.trim() ?? "";
    let subLines: string[] = [];
    if (sub) {
      ctx.font = `400 ${SUB_SIZE}px 'Prata', serif`;
      subLines = wrapText(ctx, sub, W - PAD * 2);
      totalH += SEG_GAP + subLines.length * SUB_LINE_H;
    }

    let y = Math.round(H / 2 - totalH / 2);

    for (let i = 0; i < renderedSegs.length; i++) {
      const seg = renderedSegs[i];
      ctx.font = seg.font;
      for (const line of seg.lines) {
        ctx.fillText(line, W / 2, y);
        y += seg.lineH;
      }
      if (i < renderedSegs.length - 1) y += SEG_GAP;
    }

    if (subLines.length > 0) {
      y += SEG_GAP;
      ctx.font = `400 ${SUB_SIZE}px 'Prata', serif`;
      ctx.globalAlpha = 0.82;
      for (const line of subLines) {
        ctx.fillText(line, W / 2, y);
        y += SUB_LINE_H;
      }
      ctx.globalAlpha = 1;
    }

  } else {
    ctx.font = `400 ${BODY_SIZE}px 'Prata', serif`;
    const lines  = wrapText(ctx, slide.text, W - PAD * 2);
    const totalH = lines.length * BODY_LINE_H;
    let y = Math.round(H / 2 - totalH / 2);
    for (const line of lines) { ctx.fillText(line, W / 2, y); y += BODY_LINE_H; }
  }

  if (logoImg) {
    drawLogo(ctx, logoImg, preset.logoPosition || "bottom-right", preset.logoSize || 110);
  }

  return canvas.toDataURL("image/png");
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((du, j) => ({ name: names[i + j], base64: du }));
    const res  = await fetch(`${BASE}/api/content/upload-image`, {
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

async function warmFonts() {
  await Promise.allSettled([
    document.fonts.load(`700 ${HERO_SIZE}px 'Bebas Neue', sans-serif`),
    document.fonts.load(`400 ${BODY_SIZE}px 'Prata', serif`),
    document.fonts.load(`400 ${SUB_SIZE}px 'Prata', serif`),
  ]);
}

async function loadPresetLogo(preset: ClientPreset): Promise<HTMLImageElement | null> {
  if (!preset.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

function chunkSlides(arr: SlideData[], size: number): SlideData[][] {
  const out: SlideData[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function SlideListRow({ slide, index }: { slide: SlideData; index: number }) {
  const parts = slide.rawText.split(/\|([^|]+)\|/);
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="text-xs text-muted-foreground w-5 shrink-0 text-right pt-0.5">{index + 1}</span>
      {slide.isHero ? (
        <span className="text-[9px] font-semibold uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
          Hero
        </span>
      ) : (
        <span className="text-[9px] font-semibold uppercase tracking-widest bg-muted/40 text-muted-foreground rounded px-1.5 py-0.5 shrink-0 mt-0.5">
          Body
        </span>
      )}
      <div className="min-w-0">
        <span className="text-sm text-foreground/80 leading-snug block">
          {slide.isHero
            ? parts.map((p, i) =>
                i % 2 === 1
                  ? <strong key={i} className="text-sky-300 font-bold">{p}</strong>
                  : <span key={i}>{p}</span>
              )
            : slide.text
          }
        </span>
        {slide.subtitle && (
          <span className="text-xs text-muted-foreground block mt-0.5 italic">{slide.subtitle}</span>
        )}
      </div>
    </div>
  );
}

export default function CsvSlideCarousel() {
  const { presets, loading: presetsLoading } = usePresets();
  const [phase, setPhase] = useState<Phase>("upload");

  const [csvFile,          setCsvFile]          = useState<File | null>(null);
  const [slides,           setSlides]           = useState<SlideData[]>([]);
  const [csvError,         setCsvError]         = useState<string | null>(null);
  const [csvDrag,          setCsvDrag]          = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  const [thumbs,           setThumbs]           = useState<string[]>([]);
  const [rendering,        setRendering]        = useState(false);
  const [exporting,        setExporting]        = useState(false);
  const [scheduling,       setScheduling]       = useState(false);
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [scheduleUrls,     setScheduleUrls]     = useState<string[][]>([]);

  const [bgPhotoFiles, setBgPhotoFiles] = useState<File[]>([]);
  const [bgPhotoUrls,  setBgPhotoUrls]  = useState<string[]>([]);
  const [bgPhotoDrag,  setBgPhotoDrag]  = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const bgPhotoInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? null;

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;
        if (!rows.length) { setCsvError("CSV is empty"); return; }
        const dataRows = rows.slice(1);
        if (!dataRows.length) { setCsvError("No data rows after the header"); return; }
        const parsed: SlideData[] = dataRows.flatMap(row => {
          const rawText = (Array.isArray(row) ? row[0] : String(row)).trim();
          if (!rawText) return [];
          const col1    = Array.isArray(row) ? (row[1] ?? "").trim() : "";
          const isHero  = /\|[^|]+\|/.test(rawText);
          return [{
            rawText,
            text:     rawText.replace(/\|([^|]+)\|/g, "$1"),
            isHero,
            subtitle: col1 || undefined,
          }];
        });
        if (!parsed.length) { setCsvError("No valid text rows found"); return; }
        setSlides(parsed);
        setCsvFile(file);
      },
      error: (err: Error) => setCsvError(err.message),
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) parseCsv(file);
  };

  const handleBgPhotos = useCallback((incoming: File[]) => {
    setBgPhotoUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
    const sorted = [...incoming].sort((a, b) => a.name.localeCompare(b.name));
    setBgPhotoFiles(sorted);
    setBgPhotoUrls(sorted.map(f => URL.createObjectURL(f)));
  }, []);

  const loadBgImgs = useCallback(async (): Promise<HTMLImageElement[]> => {
    if (!bgPhotoUrls.length) return [];
    const results = await Promise.allSettled(bgPhotoUrls.map(u => loadImg(u)));
    return results.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
  }, [bgPhotoUrls]);

  const renderThumbs = useCallback(async (preset: ClientPreset, slideList: SlideData[], bgImgs: HTMLImageElement[] = []) => {
    setRendering(true);
    try {
      await warmFonts();
      const logoImg = await loadPresetLogo(preset);
      setThumbs(slideList.map((s, i) => renderSlide(s, preset, logoImg, 1, bgImgs[i] ?? bgImgs[0] ?? null)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedPreset) { toast.error("Select a client preset first"); return; }
    if (!slides.length)  { toast.error("Upload a CSV first"); return; }
    const bgImgs = await loadBgImgs();
    await renderThumbs(selectedPreset, slides, bgImgs);
    setPhase("preview");
  };

  const handlePresetSwitch = async (id: number) => {
    setSelectedPresetId(id);
    const p = presets.find(x => x.id === id);
    if (p && slides.length) {
      const bgImgs = await loadBgImgs();
      await renderThumbs(p, slides, bgImgs);
    }
  };

  const handleDownload = async () => {
    if (!selectedPreset) return;
    setExporting(true);
    try {
      await warmFonts();
      const [logoImg, bgImgs] = await Promise.all([loadPresetLogo(selectedPreset), loadBgImgs()]);
      const zip = new JSZip();
      const carousels = chunkSlides(slides, CAROUSEL_SIZE);
      let globalIdx = 0;
      carousels.forEach((group, ci) => {
        const folder = `carousel-${String(ci + 1).padStart(2, "0")}`;
        group.forEach((slide, si) => {
          const png = renderSlide(slide, selectedPreset, logoImg, SCALE, bgImgs[globalIdx] ?? bgImgs[bgImgs.length - 1] ?? null);
          const b64 = png.split(",")[1];
          const tag = slide.isHero ? "hero" : "slide";
          zip.file(`${folder}/${String(si + 1).padStart(3, "0")}-${tag}.png`, b64, { base64: true });
          globalIdx++;
        });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `csv-slides-${Date.now()}.zip`);
      toast.success(`${carousels.length} carousel${carousels.length !== 1 ? "s" : ""} downloaded`);
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
      await warmFonts();
      const [logoImg, bgImgs] = await Promise.all([loadPresetLogo(selectedPreset), loadBgImgs()]);
      const carousels = chunkSlides(slides, CAROUSEL_SIZE);
      const toastId = toast.loading(`Uploading ${slides.length} image${slides.length !== 1 ? "s" : ""}…`);
      let globalIdx = 0;
      const grouped: string[][] = [];
      for (const group of carousels) {
        const dataUrls = group.map((s, si) => renderSlide(s, selectedPreset, logoImg, SCALE, bgImgs[globalIdx + si] ?? bgImgs[bgImgs.length - 1] ?? null));
        const names = group.map((s, si) => `${String(si + 1).padStart(3, "0")}-${s.isHero ? "hero" : "slide"}.png`);
        const urls = await uploadDataUrls(dataUrls, names);
        grouped.push(urls);
        globalIdx += group.length;
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
        <h1 className="font-semibold text-sm">CSV Slide Carousel</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {phase === "upload" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">CSV Slide Carousel</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                Upload a CSV and photos — every 5 rows become one carousel. 30 rows gives you 6 carousels of 5 slides each. Wrap a word or phrase in{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">|pipes|</code>{" "}
                to make it big Bebas Neue. Everything else is smaller Prata. Add a second column for a subtitle.
              </p>
              <div className="mt-3 bg-muted/30 border border-border/30 rounded-lg px-4 py-3 text-xs font-mono text-muted-foreground space-y-1 max-w-md">
                <div>text,subtitle</div>
                <div>She said <span className="text-sky-400">|YES|</span> to the treatment,optional subtitle here</div>
                <div>This is a plain body slide,</div>
                <div>Your skin can <span className="text-sky-400">|HEAL|</span>,given the right conditions</div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Background Photos{" "}
                  <span className="text-muted-foreground font-normal">(optional — one per slide, matched by filename order)</span>
                </Label>
                <div
                  onDrop={e => {
                    e.preventDefault(); setBgPhotoDrag(false);
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                    if (files.length) handleBgPhotos(files);
                  }}
                  onDragOver={e => { e.preventDefault(); setBgPhotoDrag(true); }}
                  onDragLeave={() => setBgPhotoDrag(false)}
                  onClick={() => bgPhotoInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    bgPhotoDrag    ? "border-amber-500/60 bg-amber-500/5" :
                    bgPhotoFiles.length ? "border-amber-500/40 bg-amber-500/5" :
                                   "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {bgPhotoFiles.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-amber-400 shrink-0" />
                      <p className="text-sm font-medium text-amber-400">
                        {bgPhotoFiles.length} photo{bgPhotoFiles.length !== 1 ? "s" : ""} loaded
                      </p>
                      <div className="w-full max-h-28 overflow-y-auto space-y-0.5 text-left">
                        {bgPhotoFiles.map((f, i) => (
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
                        Select multiple JPG / PNG files.<br />
                        Photo 1 → slide 1, photo 2 → slide 2, and so on.<br />
                        If you upload fewer photos than slides, the last photo repeats.
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={bgPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) handleBgPhotos(files);
                    e.target.value = "";
                  }}
                />
                {bgPhotoFiles.length > 0 && slides.length > 0 && bgPhotoFiles.length < slides.length && (
                  <p className="text-xs text-amber-500/80">
                    {bgPhotoFiles.length} photo{bgPhotoFiles.length !== 1 ? "s" : ""} for {slides.length} slides — last photo repeats for the remaining {slides.length - bgPhotoFiles.length}.
                  </p>
                )}
                {bgPhotoFiles.length > 0 && slides.length > 0 && bgPhotoFiles.length === slides.length && (
                  <p className="text-xs text-green-500/80">
                    Perfect — {bgPhotoFiles.length} photos matched to {slides.length} slides.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">CSV File</Label>
                <div
                  onDrop={handleCsvDrop}
                  onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                  onDragLeave={() => setCsvDrag(false)}
                  onClick={() => fileInputRef.current?.click()}
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
                      <p className="text-xs text-muted-foreground">{slides.length} slide{slides.length !== 1 ? "s" : ""} — click to replace</p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Column 1 = slide text. Wrap words in <code className="font-mono">|pipes|</code> for Bebas Neue.<br />
                        Column 2 = optional subtitle.
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
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
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0"
                      style={{ background: selectedPreset.pageColor }}
                    />
                    <span className="text-xs text-muted-foreground truncate">{selectedPreset.fontFamily}</span>
                    {selectedPreset.logoUrl && (
                      <span className="text-xs text-muted-foreground">· logo attached</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Background, overlay, text colour, corners and logo all come from the preset.
                </p>
              </div>
            </div>

            {slides.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {slides.length} slide{slides.length !== 1 ? "s" : ""} parsed
                </p>
                <div className="bg-muted/20 border border-border/30 rounded-xl divide-y divide-border/20 max-h-64 overflow-y-auto">
                  {slides.slice(0, 30).map((s, i) => (
                    <SlideListRow key={i} slide={s} index={i} />
                  ))}
                  {slides.length > 30 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      …and {slides.length - 30} more
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!slides.length || !selectedPreset || rendering}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering…</>
                : "Generate Slides"}
            </Button>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-1">Preview</h2>
                <p className="text-muted-foreground text-sm">
                  {chunkSlides(slides, CAROUSEL_SIZE).length} carousel{chunkSlides(slides, CAROUSEL_SIZE).length !== 1 ? "s" : ""} · {slides.length} slides · {selectedPreset?.name}
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

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => { if (selectedPreset) { const bg = await loadBgImgs(); renderThumbs(selectedPreset, slides, bg); } }}
                  disabled={rendering || !selectedPreset}
                >
                  {rendering
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><RefreshCw className="w-4 h-4 mr-1.5" />Re-render</>}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={exporting || rendering}
                >
                  {exporting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Download className="w-4 h-4 mr-1.5" />ZIP</>}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSchedule}
                  disabled={scheduling || rendering}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  {scheduling
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
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
              {chunkSlides(slides, CAROUSEL_SIZE).map((group, ci) => {
                const totalCarousels = chunkSlides(slides, CAROUSEL_SIZE).length;
                const globalStart = ci * CAROUSEL_SIZE;
                return (
                  <div key={ci} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Carousel {ci + 1} of {totalCarousels}
                      </span>
                      <div className="h-px flex-1 bg-border/30" />
                      <span className="text-[11px] text-muted-foreground/60">
                        {group.length} slide{group.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {group.map((slide, si) => {
                        const globalI = globalStart + si;
                        const thumb = thumbs[globalI];
                        return (
                          <div
                            key={si}
                            className="relative rounded-lg overflow-hidden border border-border/30 shrink-0"
                            style={{ width: 120 }}
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={`Carousel ${ci + 1}, slide ${si + 1}`}
                                className="w-full object-cover"
                                style={{ aspectRatio: `${W}/${H}` }}
                                draggable={false}
                              />
                            ) : (
                              <div
                                className="w-full bg-muted/30 flex items-center justify-center"
                                style={{ aspectRatio: `${W}/${H}` }}
                              >
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                              <span className="text-[10px] text-white/70 font-medium">{si + 1}</span>
                              {slide.isHero && (
                                <span className="text-[8px] bg-sky-600 text-white px-1 py-0.5 rounded font-semibold uppercase tracking-wider">
                                  Hero
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
            title:     `Carousel ${i + 1} of ${scheduleUrls.length} · ${selectedPreset.name}`,
            caption:   "",
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
