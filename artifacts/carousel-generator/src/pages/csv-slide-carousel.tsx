import { useState, useCallback, useRef, useEffect } from "react";
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

const CAROUSEL_SIZE = 4;

const BODY_SIZE   = 50;
const BODY_LINE_H = Math.round(BODY_SIZE * 1.55);
const PAD         = 90;

// Slide 1 hero layout
const S1_HERO_SIZE   = Math.round(H * 0.19);        // ~274 px — large hero word
const S1_SUB_SIZE    = Math.round(H * 0.045);       // ~65 px  — subtitle above hero
const S1_HERO_LINE_H = Math.round(S1_HERO_SIZE * 1.05);
const S1_SUB_LINE_H  = Math.round(S1_SUB_SIZE  * 1.2);
const S1_BOTTOM_PAD  = 80;
const S1_BASE_GAP    = 32;

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

function renderSlide(slide: SlideData, preset: ClientPreset, logoImg: HTMLImageElement | null, scale = SCALE, bgImg: HTMLImageElement | null = null, lineSpacing = 1.2): string {
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

  if (slide.isHero) {
    // bottom gradient: transparent at mid-canvas → black 60% at bottom
    const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    const overlay = parseOverlayColor(preset.overlayColor || "rgba(0,0,0,0.5)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  }

  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");

  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor  = "rgba(0,0,0,0.75)";
  ctx.shadowBlur   = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  if (slide.isHero) {
    const segments = parseSegments(slide.rawText);

    // Separate piped (hero) words from surrounding (subtitle) text
    // If no pipes present, treat the whole text as the hero word
    const rawHero = segments.filter(s => s.isHero).map(s => s.text.toUpperCase()).join(" ").trim();
    const rawSub  = segments.filter(s => !s.isHero).map(s => s.text.trim()).filter(Boolean).join(" ").trim();
    const heroText = rawHero || rawSub.toUpperCase();
    const subText  = rawHero ? rawSub : "";

    ctx.font = `700 ${S1_HERO_SIZE}px 'Bebas Neue', sans-serif`;
    const heroLines = heroText ? wrapText(ctx, heroText, W - PAD * 2) : [];

    ctx.font = `400 ${S1_SUB_SIZE}px 'Bebas Neue', sans-serif`;
    const subLines  = subText  ? wrapText(ctx, subText,  W - PAD * 2) : [];

    const heroH = heroLines.length * S1_HERO_LINE_H;
    const subH  = subLines.length  * S1_SUB_LINE_H;
    const gap   = Math.round(lineSpacing * S1_BASE_GAP);

    // Anchor from bottom: hero word at very bottom, subtitle sits above it
    const heroStartY = H - S1_BOTTOM_PAD - heroH;
    const subStartY  = heroStartY - gap - subH;

    // Draw subtitle — smaller Bebas Neue in accent/brand colour
    if (subLines.length > 0) {
      ctx.font      = `400 ${S1_SUB_SIZE}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = preset.cornerColor || "#d4af37";
      let y = subStartY;
      for (const line of subLines) {
        ctx.fillText(line, W / 2, y);
        y += S1_SUB_LINE_H;
      }
    }

    // Draw hero word — large Bebas Neue, always white
    if (heroLines.length > 0) {
      ctx.font      = `700 ${S1_HERO_SIZE}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = "#ffffff";
      let y = heroStartY;
      for (const line of heroLines) {
        ctx.fillText(line, W / 2, y);
        y += S1_HERO_LINE_H;
      }
    }

  } else {
    ctx.fillStyle = preset.textColor || "#ffffff";
    ctx.font = `400 ${BODY_SIZE}px 'Prata', serif`;
    const lines  = wrapText(ctx, slide.text, W - PAD * 2);
    const totalH = lines.length * BODY_LINE_H;
    let y = Math.round(H / 2 - totalH / 2);
    for (const line of lines) { ctx.fillText(line, W / 2, y); y += BODY_LINE_H; }
  }

  if (logoImg) {
    drawLogo(ctx, logoImg, preset.logoPosition || "top-left", preset.logoSize || 110);
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "Images too large — try smaller files" : `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

async function warmFonts() {
  await Promise.allSettled([
    document.fonts.load(`700 ${S1_HERO_SIZE}px 'Bebas Neue', sans-serif`),
    document.fonts.load(`400 ${S1_SUB_SIZE}px 'Bebas Neue', sans-serif`),
    document.fonts.load(`400 ${BODY_SIZE}px 'Prata', serif`),
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

  const [lineSpacing, setLineSpacing] = useState(1.2);
  const lineSpacingRef = useRef(lineSpacing);
  useEffect(() => { lineSpacingRef.current = lineSpacing; }, [lineSpacing]);

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
          const cols = Array.isArray(row)
            ? [row[0] ?? "", row[1] ?? "", row[2] ?? "", row[3] ?? ""].map(c => String(c).trim())
            : [String(row).trim(), "", "", ""];
          if (!cols[0]) return [];
          const slides: SlideData[] = [];
          // Slide 1 — hook: pipe markers parsed into hero/body segments
          const hook = cols[0];
          slides.push({
            rawText: hook,
            text:    hook.replace(/\|([^|]+)\|/g, "$1"),
            isHero:  /\|[^|]+\|/.test(hook),
          });
          // Slides 2-4 — body / cta: plain Prata, no pipe parsing
          for (let c = 1; c <= 3; c++) {
            if (cols[c]) {
              slides.push({ rawText: cols[c], text: cols[c], isHero: false });
            }
          }
          return slides;
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

  const renderThumbs = useCallback(async (preset: ClientPreset, slideList: SlideData[], bgImgs: HTMLImageElement[] = [], ls = 1.2) => {
    setRendering(true);
    try {
      await warmFonts();
      const logoImg = await loadPresetLogo(preset);
      setThumbs(slideList.map((s, i) => renderSlide(s, preset, logoImg, 1, bgImgs[i] ?? bgImgs[0] ?? null, ls)));
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
    await renderThumbs(selectedPreset, slides, bgImgs, lineSpacing);
    setPhase("preview");
  };

  const handlePresetSwitch = async (id: number) => {
    setSelectedPresetId(id);
    const p = presets.find(x => x.id === id);
    if (p && slides.length) {
      const bgImgs = await loadBgImgs();
      await renderThumbs(p, slides, bgImgs, lineSpacing);
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
          const png = renderSlide(slide, selectedPreset, logoImg, SCALE, bgImgs[globalIdx] ?? bgImgs[bgImgs.length - 1] ?? null, lineSpacing);
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
        const dataUrls = group.map((s, si) => renderSlide(s, selectedPreset, logoImg, SCALE, bgImgs[globalIdx + si] ?? bgImgs[bgImgs.length - 1] ?? null, lineSpacing));
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

  // Live re-render when line spacing changes (preview phase only)
  useEffect(() => {
    if (phase !== "preview" || !selectedPreset || !slides.length) return;
    const id = setTimeout(async () => {
      const bgImgs = await loadBgImgs();
      renderThumbs(selectedPreset, slides, bgImgs, lineSpacingRef.current);
    }, 180);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSpacing]);

  // Auto re-render after any Vite HMR update (so code fixes take effect without manual clicks)
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = async () => {
      if (phase !== "preview" || !selectedPreset || !slides.length || rendering) return;
      const bgImgs = await loadBgImgs();
      renderThumbs(selectedPreset, slides, bgImgs, lineSpacingRef.current);
    };
    import.meta.hot.on("vite:afterUpdate", handler);
    return () => { import.meta.hot!.off("vite:afterUpdate", handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, slides, selectedPreset, rendering]);

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
                Each row in your CSV becomes one carousel of 4 slides. 4 columns per row:{" "}
                <span className="text-foreground/70 font-medium">hook, body, body, CTA</span>.
                Wrap words in{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">|pipes|</code>{" "}
                on the hook column — piped words render big in Bebas Neue, everything else in Prata.
              </p>
              <div className="mt-3 bg-muted/30 border border-border/30 rounded-lg px-4 py-3 text-xs font-mono text-muted-foreground space-y-2 max-w-lg">
                <div className="text-muted-foreground/60">slide1_hook,slide2_body,slide3_body,slide4_cta</div>
                <div>
                  <span className="text-sky-400">|HEAL|</span> your skin,Your skin repairs naturally,This treatment supports that process,Book your appointment
                </div>
                <div>
                  Say <span className="text-sky-400">|YES|</span> to yourself,Small changes add up,You deserve to feel good,Book a free consultation
                </div>
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
                  size="sm"
                  onClick={async () => { if (selectedPreset) { const bg = await loadBgImgs(); renderThumbs(selectedPreset, slides, bg, lineSpacing); } }}
                  disabled={rendering || !selectedPreset}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {rendering
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Rendering…</>
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

            <div className="flex items-center gap-4 bg-muted/20 border border-border/30 rounded-xl px-5 py-3">
              <Label className="text-xs font-medium text-muted-foreground shrink-0 w-28">
                Line spacing
                <span className="ml-2 font-mono text-foreground/70">{lineSpacing.toFixed(1)}</span>
              </Label>
              <input
                type="range"
                min={0.8}
                max={2.0}
                step={0.1}
                value={lineSpacing}
                onChange={e => setLineSpacing(Number(e.target.value))}
                className="flex-1 accent-sky-500"
              />
              <span className="text-[11px] text-muted-foreground/60 shrink-0">Slide 1 only</span>
            </div>

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
