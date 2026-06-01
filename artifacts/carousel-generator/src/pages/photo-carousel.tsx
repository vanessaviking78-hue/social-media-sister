import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, Upload, Image as ImageIcon,
  ImagePlus, FileText, Download, X, Loader2,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, RENDER_SCALE, FONT_OPTIONS,
  loadGoogleFonts, drawSlide,
} from "@/lib/slide-utils";
import type { TextPosition } from "@/lib/use-presets";
import { getBrandDefaults } from "@/lib/brand-defaults";

loadGoogleFonts();

const MAX_SLIDES = 12;
const LOGO_SIZE = 120;

interface Slide {
  id: string;
  file: File;
  objectUrl: string;
  imgEl: HTMLImageElement | null;
  text: string;
  loaded: boolean;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeSlide(file: File): Slide {
  return {
    id: makeId(),
    file,
    objectUrl: URL.createObjectURL(file),
    imgEl: null,
    text: "",
    loaded: false,
  };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function PhotoCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Global style controls
  const [fontFamily, setFontFamily] = useState(() => getBrandDefaults().fontFamily);
  const [fontSize, setFontSize] = useState(52);
  const [textColor, setTextColor] = useState(() => getBrandDefaults().secondaryColor);
  const [textPosition, setTextPosition] = useState<TextPosition>("center");
  const [overlayOpacity, setOverlayOpacity] = useState(40);

  // Logo — fixed to bottom-left at LOGO_SIZE
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const bd = getBrandDefaults();
    if (bd.logoDataUrl) {
      setLogoObjectUrl(bd.logoDataUrl);
      loadImg(bd.logoDataUrl).then(setLogoImg).catch(() => {});
    }
  }, []);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const safeIdx = Math.min(selectedIdx, Math.max(0, slides.length - 1));
  const selectedSlide = slides[safeIdx] ?? null;
  const overlayColor = `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})`;

  // Load HTMLImageElement for each slide when it's first added
  const slideIdsKey = slides.map((s) => s.id).join(",");
  useEffect(() => {
    slides.forEach((slide) => {
      if (slide.loaded) return;
      loadImg(slide.objectUrl)
        .then((imgEl) => {
          setSlides((prev) => {
            const i = prev.findIndex((s) => s.id === slide.id);
            if (i === -1) return prev;
            const next = [...prev];
            next[i] = { ...next[i], imgEl, loaded: true };
            return next;
          });
        })
        .catch(() => {});
    });
  }, [slideIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  // Draw preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    if (!selectedSlide?.imgEl) {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "400 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        slides.length === 0 ? "Upload images to get started" : "Loading…",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
      );
      return;
    }

    drawSlide(
      ctx,
      selectedSlide.imgEl,
      selectedSlide.text,
      fontFamily,
      fontSize,
      false,
      textColor,
      1.2,
      overlayColor,
      logoImg,
      "bottom-left",
      LOGO_SIZE,
      "#000000",
      "none",
      "#000000",
      undefined,
      undefined,
      textPosition,
      true,
    );
  }, [selectedSlide, fontFamily, fontSize, textColor, overlayColor, textPosition, logoImg, safeIdx, slides.length]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const remaining = MAX_SLIDES - slides.length;
      if (remaining <= 0) {
        toast.error("12 slides is the maximum.");
        return;
      }
      const toAdd = valid.slice(0, remaining).map(makeSlide);
      if (toAdd.length === 0) return;
      if (valid.length > remaining) {
        toast.info(`Added ${toAdd.length} images. ${remaining < valid.length ? `${valid.length - remaining} skipped — 12 slide limit reached.` : ""}`);
      }
      setSlides((prev) => [...prev, ...toAdd]);
    },
    [slides.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles],
  );

  const removeSlide = useCallback((id: string) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      setSelectedIdx((cur) => {
        if (idx < cur) return cur - 1;
        if (idx === cur) return Math.min(cur, next.length - 1);
        return cur;
      });
      URL.revokeObjectURL(prev[idx]?.objectUrl ?? "");
      return next;
    });
  }, []);

  const updateText = useCallback((id: string, text: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }, []);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      const url = URL.createObjectURL(file);
      setLogoObjectUrl(url);
      loadImg(url).then((img) => setLogoImg(img)).catch(() => toast.error("Could not load logo."));
      e.target.value = "";
    },
    [logoObjectUrl],
  );

  const clearLogo = useCallback(() => {
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    setLogoObjectUrl(null);
    setLogoImg(null);
  }, [logoObjectUrl]);

  const handleCsvImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data;
          let populated = 0;
          setSlides((prev) =>
            prev.map((slide, i) => {
              const row = rows[i];
              if (!row) return slide;
              const text = row.find((c) => c.trim()) ?? "";
              if (text) populated++;
              return { ...slide, text };
            }),
          );
          toast.success(`Text filled for ${populated} slide${populated !== 1 ? "s" : ""}.`);
        },
        error: () => toast.error("Could not read that CSV."),
      });
      e.target.value = "";
    },
    [],
  );

  const handleExport = useCallback(async () => {
    if (slides.length === 0) {
      toast.error("Add some images first.");
      return;
    }
    const unloaded = slides.filter((s) => !s.imgEl);
    if (unloaded.length > 0) {
      toast.error("Images are still loading. Give it a moment and try again.");
      return;
    }
    setIsExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide.imgEl) continue;
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH * RENDER_SCALE;
        canvas.height = CANVAS_HEIGHT * RENDER_SCALE;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(RENDER_SCALE, RENDER_SCALE);
        drawSlide(
          ctx,
          slide.imgEl,
          slide.text,
          fontFamily,
          fontSize,
          false,
          textColor,
          1.2,
          overlayColor,
          logoImg,
          "bottom-left",
          LOGO_SIZE,
          "#000000",
          "none",
          "#000000",
          undefined,
          undefined,
          textPosition,
          true,
        );
        const blob = await new Promise<Blob>((res) =>
          canvas.toBlob((b) => res(b!), "image/png"),
        );
        const name = `slide-${String(i + 1).padStart(2, "0")}${i === 0 ? "-cover" : ""}.png`;
        zip.file(name, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `carousel-${Date.now()}.zip`);
      toast.success("ZIP downloaded.");
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setIsExporting(false);
    }
  }, [slides, fontFamily, fontSize, textColor, overlayColor, logoImg, textPosition]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/50 shrink-0">
        <Link href="/hub" className="text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-semibold tracking-widest uppercase text-white/80">
          Photo Carousel
        </h1>
        {slides.length > 0 && (
          <span className="ml-1 text-xs text-white/30">
            {slides.length} / {MAX_SLIDES} slides
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT RAIL ───────────────────────────────────── */}
        <aside className="w-56 shrink-0 flex flex-col gap-5 px-4 py-5 border-r border-white/10 bg-black/30 overflow-y-auto">

          {/* Font family */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Font</Label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500/50 transition-colors"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value} className="bg-zinc-900">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">
              Font Size <span className="text-white/60 normal-case tracking-normal">{fontSize}px</span>
            </Label>
            <Slider
              min={24}
              max={120}
              step={2}
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
            />
          </div>

          {/* Text colour */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Text Colour</Label>
            <div className="flex items-center gap-2.5">
              <label className="relative w-8 h-8 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span
                  className="absolute inset-0 rounded-md"
                  style={{ background: textColor }}
                />
              </label>
              <span className="text-xs font-mono text-white/50">{textColor.toUpperCase()}</span>
            </div>
          </div>

          {/* Text position */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Text Position</Label>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["top", "center", "bottom"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setTextPosition(pos)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${
                    textPosition === pos
                      ? "bg-pink-600 text-white"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  {pos === "center" ? "Mid" : pos.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay strength */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">
              Overlay <span className="text-white/60 normal-case tracking-normal">{overlayOpacity}%</span>
            </Label>
            <Slider
              min={0}
              max={90}
              step={5}
              value={[overlayOpacity]}
              onValueChange={([v]) => setOverlayOpacity(v)}
            />
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Logo</Label>
            {logoObjectUrl ? (
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                <img src={logoObjectUrl} className="h-7 object-contain flex-1 min-w-0" alt="logo" />
                <button
                  onClick={clearLogo}
                  className="text-white/30 hover:text-red-400 transition-colors shrink-0"
                  title="Remove logo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 w-full py-2 bg-white/5 hover:bg-white/8 border border-dashed border-white/15 hover:border-white/30 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Upload logo
              </button>
            )}
            <p className="text-[9px] text-white/25 leading-tight">
              Pins to bottom-left on every slide
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-white/8 pt-4 space-y-2.5">
            {/* CSV import */}
            <button
              onClick={() => slides.length > 0 && csvInputRef.current?.click()}
              disabled={slides.length === 0}
              className="flex items-center gap-2 w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-white/50 hover:text-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              Import CSV text
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />

            {/* Export */}
            <Button
              onClick={handleExport}
              disabled={slides.length === 0 || isExporting}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-medium h-8"
              size="sm"
            >
              {isExporting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Exporting…</>
              ) : (
                <><Download className="w-3.5 h-3.5 mr-1.5" />Export ZIP</>
              )}
            </Button>
          </div>
        </aside>

        {/* ── CENTER — Slide list ──────────────────────────── */}
        <main
          className="flex-1 overflow-y-auto p-4"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
          }}
        >
          {slides.length === 0 ? (
            /* Empty state drop zone */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center h-full min-h-[360px] rounded-2xl border-2 border-dashed cursor-pointer select-none transition-all ${
                isDragging
                  ? "border-pink-500 bg-pink-500/8"
                  : "border-white/15 hover:border-white/30 bg-white/3 hover:bg-white/5"
              }`}
            >
              <Upload className={`w-10 h-10 mb-4 transition-colors ${isDragging ? "text-pink-400" : "text-white/25"}`} />
              <p className="text-sm text-white/50">Drop up to 12 images here</p>
              <p className="text-xs text-white/25 mt-1">or click to browse</p>
              <p className="text-[10px] text-white/15 mt-3 uppercase tracking-widest">JPEG · PNG · WebP</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-w-2xl">
              {/* Add more button */}
              {slides.length < MAX_SLIDES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-2 text-[11px] text-white/40 hover:text-white/70 bg-white/3 hover:bg-white/6 border border-dashed border-white/10 hover:border-white/20 rounded-xl transition-all"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add images
                  <span className="text-white/25">{MAX_SLIDES - slides.length} remaining</span>
                </button>
              )}

              {/* Drag-over overlay hint */}
              {isDragging && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-pink-500/5 border-2 border-pink-500/40">
                  <p className="text-pink-400 text-sm font-medium bg-black/60 px-4 py-2 rounded-xl">Drop to add images</p>
                </div>
              )}

              {/* Slide rows */}
              {slides.map((slide, idx) => (
                <SlideRow
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  isSelected={safeIdx === idx}
                  onSelect={() => setSelectedIdx(idx)}
                  onTextChange={(text) => {
                    updateText(slide.id, text);
                    setSelectedIdx(idx);
                  }}
                  onRemove={() => removeSlide(slide.id)}
                />
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </main>

        {/* ── RIGHT — Preview ──────────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col gap-3 p-4 border-l border-white/10 bg-black/30 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Preview</span>
            {slides.length > 0 && (
              <span className="text-[10px] text-white/25">
                {safeIdx + 1} / {slides.length}
              </span>
            )}
          </div>

          {/* Canvas */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
            <canvas
              ref={previewCanvasRef}
              className="w-full"
              style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
            />
          </div>

          {/* Text preview */}
          {selectedSlide && (
            <p className="text-[10px] text-white/30 text-center leading-snug min-h-[2.5rem] px-2">
              {selectedSlide.text
                ? `"${selectedSlide.text.slice(0, 80)}${selectedSlide.text.length > 80 ? "…" : ""}"`
                : <span className="text-white/15 italic">No text on this slide</span>}
            </p>
          )}

          {/* Prev / Next navigation */}
          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-1">
              <button
                onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
                disabled={safeIdx === 0}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-1">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === safeIdx ? "bg-pink-500 scale-125" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setSelectedIdx((i) => Math.min(slides.length - 1, i + 1))}
                disabled={safeIdx === slides.length - 1}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CSV format hint */}
          <div className="mt-auto pt-4 border-t border-white/8">
            <p className="text-[9px] text-white/20 leading-relaxed">
              <span className="text-white/35 font-medium">CSV format:</span> one row per slide,
              text in the first column. Row 1 maps to slide 1.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Slide row component ──────────────────────────────────────────────────────

interface SlideRowProps {
  slide: Slide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
}

function SlideRow({ slide, index, isSelected, onSelect, onTextChange, onRemove }: SlideRowProps) {
  return (
    <div
      onClick={onSelect}
      className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? "border-pink-500/50 bg-pink-500/8 shadow-lg shadow-pink-500/5"
          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 self-start">
        <img
          src={slide.objectUrl}
          className="w-[72px] h-[90px] object-cover rounded-lg"
          alt={`Slide ${index + 1}`}
          draggable={false}
        />
        {/* Slide number badge */}
        <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-white/20 text-[9px] text-white/60 flex items-center justify-center font-mono font-semibold">
          {index + 1}
        </span>
        {/* Cover badge */}
        {index === 0 && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-600 text-white text-[8px] px-1.5 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wide font-semibold">
            Cover
          </span>
        )}
        {/* Loading indicator */}
        {!slide.loaded && (
          <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
          </div>
        )}
      </div>

      {/* Text area */}
      <div
        className="flex-1 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          value={slide.text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={onSelect}
          placeholder={
            index === 0
              ? "Hook — make them stop scrolling…"
              : "Slide text…"
          }
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-pink-500/40 transition-colors leading-relaxed"
        />
        <span className="mt-1 text-[9px] text-white/20 text-right">
          {slide.text.length > 0 ? `${slide.text.length} chars` : ""}
        </span>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="self-start p-1 text-white/20 hover:text-red-400 transition-colors shrink-0"
        title="Remove slide"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
