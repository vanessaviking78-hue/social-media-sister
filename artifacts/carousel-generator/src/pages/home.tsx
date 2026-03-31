import React, { useState, useCallback, useRef, useEffect } from "react";
import { Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, Palette, ChevronUp, ChevronDown } from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import type { CarouselResult, CarouselSlide } from "@workspace/api-client-react/src/generated/api.schemas";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Lato", value: "'Lato', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Source Sans Pro", value: "'Source Sans Pro', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
];

const LOGO_POSITIONS = [
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
];

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Playfair+Display&family=Montserrat&family=Lato&family=Oswald&family=Merriweather&family=Raleway&family=Source+Sans+Pro&family=Roboto&display=swap";
  document.head.appendChild(link);
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  text: string,
  font: string,
  size: number,
  isCoverSlide: boolean,
  textColor: string = "#ffffff",
  lineSpacing: number = 0.9,
  overlayColor: string = "rgba(0,0,0,0.5)",
  logoImg: HTMLImageElement | null = null,
  logoPosition: string = "top-right",
  logoSize: number = 140
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const scale = Math.max(W / img.width, H / img.height);
  const x = (W - img.width * scale) / 2;
  const y = (H - img.height * scale) / 2;
  ctx.globalAlpha = isCoverSlide ? 1.0 : 0.5;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  ctx.globalAlpha = 1.0;

  const overlayW = Math.round(W * 0.35);
  const grad = ctx.createLinearGradient(overlayW, 0, 0, 0);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, overlayW, H);

  ctx.fillStyle = textColor;
  ctx.font = `600 ${size}px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const maxW = overlayW - 60;
  const lineH = Math.round(size * lineSpacing);
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);

  const totalH = lines.length * lineH;
  const startY = Math.round(H - totalH - 60);
  const startX = 40;

  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  ctx.fillStyle = overlayColor;
  ctx.fillRect(startX - 15, startY - 15, maxLineWidth + 30, totalH + 30);

  ctx.fillStyle = textColor;
  lines.forEach((line, i) => ctx.fillText(line, startX, startY + i * lineH));

  if (logoImg) {
    const margin = 40;
    const aspectRatio = logoImg.width / logoImg.height;
    const logoW = Math.round(logoSize * aspectRatio);
    const logoH = logoSize;
    let lx = margin, ly = margin;
    if (logoPosition === "top-right") { lx = W - logoW - margin; ly = margin; }
    else if (logoPosition === "bottom-left") { lx = margin; ly = H - logoH - margin; }
    else if (logoPosition === "bottom-right") { lx = W - logoW - margin; ly = H - logoH - margin; }
    ctx.drawImage(logoImg, lx, ly, logoW, logoH);
  }
}

async function compressImage(file: File, maxPx = 1080, quality = 0.72): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [result, setResult] = useState<CarouselResult | null>(null);

  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const [fontSize, setFontSize] = useState(52);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textColor, setTextColor] = useState("#ffffff");
  const [lineSpacing, setLineSpacing] = useState(0.9);
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.5)");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [logoSize, setLogoSize] = useState(140);

  const [barExpanded, setBarExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!logoFile) { setLogoImg(null); setLogoPreviewUrl(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    const el = new Image();
    el.onload = () => setLogoImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const addPhotos = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const compressed = await Promise.all(images.map((f) => compressImage(f)));
    setPhotos((prev) => [...prev, ...compressed]);
  };

  const handlePhotosDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingPhotos(false);
    if (e.dataTransfer.files?.length) addPhotos(Array.from(e.dataTransfer.files));
  }, []);

  const handlePhotosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addPhotos(Array.from(e.target.files));
  }, []);

  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const processCsv = (file: File) => {
    setCsvFile(file);
    Papa.parse<string[]>(file, {
      header: false, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data as string[][];
        if (rows.length === 0) return;
        const first = rows[0]?.[0]?.toLowerCase() ?? "";
        const isHeader = /^(slide|hook|col|column|text|caption|header)\d*$/i.test(first);
        const headers = isHeader ? rows[0] : rows[0].map((_, i) => `Slide ${i + 1}`);
        const dataRows = isHeader ? rows.slice(1) : rows;
        setCsvPreview({ headers, rows: dataRows.slice(0, 3) });
      },
      error: (err: { message: string }) => toast.error("CSV parse error: " + err.message),
    });
  };

  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCsv(file);
  }, []);

  const handleCsvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processCsv(e.target.files[0]);
  }, []);

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setLogoFile(file);
  }, []);

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
  }, []);

  const handleGenerate = async () => {
    if (!photos.length) { toast.error("Please upload at least one photo"); return; }
    if (!csvFile) { toast.error("Please upload a CSV file"); return; }

    setIsGenerating(true);
    const toastId = toast.loading("Generating slides…");

    try {
      const csvText = await csvFile.text();
      const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true });
      let rows = parsed.data as string[][];
      if (rows.length === 0) throw new Error("CSV has no data rows");

      const first = rows[0]?.[0]?.toLowerCase() ?? "";
      if (/^(slide|hook|col|column|text|caption|header)\d*$/i.test(first)) rows = rows.slice(1);
      rows = rows.map((r) => r.filter((c) => c.trim())).filter((r) => r.length > 0);
      if (rows.length === 0) throw new Error("CSV has no data rows");

      const MAX_CAROUSELS = 60;
      const postRows = rows.slice(0, MAX_CAROUSELS);
      const slidesPerCarousel = postRows[0].length;

      const photoUrls = photos.map((f) => URL.createObjectURL(f));

      const slides: CarouselSlide[] = [];
      let idx = 1;
      for (let pi = 0; pi < postRows.length; pi++) {
        const photoUrl = photoUrls[pi % photoUrls.length];
        for (let si = 0; si < postRows[pi].length; si++) {
          slides.push({
            slideIndex: idx++,
            groupIndex: pi + 1,
            groupPosition: si + 1,
            text: postRows[pi][si],
            imageUrl: photoUrl,
            imageName: photos[pi % photos.length].name,
          });
        }
      }

      setResult({ slides, totalSlides: slides.length, slidesPerCarousel, totalCarousels: postRows.length, sessionId: "local" });
      toast.success(`${slides.length} slides generated — ready to download`, { id: toastId });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate slides", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    setPhotos([]); setCsvFile(null);
    setCsvPreview({ headers: [], rows: [] }); setResult(null);
  };

  const downloadZip = async () => {
    if (!result?.slides.length) return;
    const id = toast.loading("Building ZIP…");
    try {
      await document.fonts.ready;
      const zip = new JSZip();
      for (const slide of result.slides) {
        const isCover = slide.groupPosition === 1;
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, slide.text, fontFamily, fontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize);
        URL.revokeObjectURL(img.src);
        const outBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (outBlob) {
          zip.file(`carousel-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`, outBlob);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      toast.success("Download started", { id });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP", { id });
    }
  };

  const selectedFontLabel = FONT_OPTIONS.find((f) => f.value === fontFamily)?.label ?? "Inter";
  const previewLogoScale = 0.18;
  const previewLogoH = Math.round(logoSize * previewLogoScale);

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-sans text-xl font-bold tracking-tight">Social Media Sister</h1>
        </div>
        {result && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleStartOver} className="text-muted-foreground border-muted-foreground/20 hover:text-foreground">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button size="sm" onClick={downloadZip} data-testid="button-download-zip">
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 mt-12">
        {!result ? (
          <div className="flex flex-col gap-10">
            {/* Heading */}
            <div>
              <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Upload Assets</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Add your photos and a CSV — <strong className="text-foreground font-medium">one row per carousel</strong>, one column per slide. Up to 60 rows = 60 carousels.
              </p>
            </div>

            {/* Drop zones — stacked, tall, full-width */}
            <div className="flex flex-col gap-4">
              {/* Photos */}
              <div
                data-testid="drop-zone-photos"
                className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingPhotos ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                onDragLeave={() => setIsDraggingPhotos(false)}
                onDrop={handlePhotosDrop}
                onClick={() => photoInputRef.current?.click()}
              >
                <input ref={photoInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handlePhotosChange} data-testid="input-photos" />
                <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Photos</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {photos.length > 0 ? `${photos.length} selected — click to add more` : "Drag & drop or click to upload"}
                  </p>
                </div>
              </div>

              {/* CSV */}
              <div
                data-testid="drop-zone-csv"
                className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingCsv ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                onDragLeave={() => setIsDraggingCsv(false)}
                onDrop={handleCsvDrop}
                onClick={() => csvInputRef.current?.click()}
              >
                <input ref={csvInputRef} type="file" className="hidden" accept=".csv,text/csv" onChange={handleCsvChange} data-testid="input-csv" />
                <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">CSV File</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">
                    {csvFile ? csvFile.name : "Drag & drop or click to upload"}
                  </p>
                </div>
              </div>

              {/* Logo */}
              <div
                data-testid="drop-zone-logo"
                className={`drop-zone-idle rounded-2xl min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingLogo ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                onDragLeave={() => setIsDraggingLogo(false)}
                onDrop={handleLogoDrop}
                onClick={() => logoInputRef.current?.click()}
              >
                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} data-testid="input-logo" />
                {logoPreviewUrl ? (
                  <>
                    <div className="relative">
                      <img src={logoPreviewUrl} alt="Logo preview" className="h-10 max-w-[120px] object-contain" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setLogoFile(null); }}
                        className="absolute -top-2 -right-2 p-0.5 bg-black/70 hover:bg-black/90 text-white rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[240px]">{logoFile?.name}</p>
                  </>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Logo <span className="text-muted-foreground font-normal">(optional)</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click to upload</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Photo thumbnails */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">Selected Photos</h3>
                  <Badge variant="secondary" className="bg-accent text-xs">{photos.length}</Badge>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
                  {photos.map((file, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-accent cursor-pointer hover:shadow-[0_0_0_2px_hsl(var(--primary)/0.5),0_0_16px_hsl(var(--primary)/0.15)] transition-shadow duration-200">
                      <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CSV preview — spacing only, no harsh borders */}
            {csvPreview.rows.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm">CSV Preview</h3>
                <div className="rounded-xl overflow-hidden text-sm bg-accent/30">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-8">#</th>
                          {csvPreview.headers.map((h, i) => (
                            <th key={i} className={`text-left px-4 py-3 text-xs font-semibold whitespace-nowrap ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                              {i === 0 ? `🪝 ${h}` : h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-accent/40 transition-colors">
                            <td className="px-4 py-3 text-primary font-mono text-xs">{String(ri + 1).padStart(2, "0")}</td>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-4 py-3 text-muted-foreground max-w-[180px] truncate text-xs">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 text-xs text-muted-foreground/70 italic">
                    Showing first 3 rows — each row = one carousel · column 1 = vivid cover · columns 2–5 = faded slides
                  </div>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* Results — gallery style */
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            <div>
              <h2 className="font-serif text-4xl font-semibold mb-2 tracking-tight">Your Carousels are Ready</h2>
              <p className="text-muted-foreground">
                {result.totalCarousels} carousels &times; {result.slidesPerCarousel} slides at 1080 × 1350 px —{" "}
                <span style={{ fontFamily }} className="text-foreground font-medium">{selectedFontLabel}</span>, {fontSize}px
              </p>
            </div>

            {Array.from({ length: result.totalCarousels }, (_, gi) => {
              const groupSlides = result.slides.filter((s) => s.groupIndex === gi + 1);
              return (
                <div key={gi} className="space-y-4">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                    Carousel {String(gi + 1).padStart(2, "0")}
                  </p>
                  <div className="grid grid-cols-5 gap-4">
                    {groupSlides.map((slide) => {
                      const isCover = slide.groupPosition === 1;
                      return (
                        <div
                          key={slide.slideIndex}
                          className="relative rounded-2xl overflow-hidden shadow-md hover:shadow-[0_0_24px_hsl(var(--primary)/0.15)] transition-shadow duration-300"
                          style={{ aspectRatio: "4/5" }}
                          data-testid={`slide-card-${slide.slideIndex}`}
                        >
                          <img
                            src={slide.imageUrl}
                            alt={`Carousel ${slide.groupIndex} slide ${slide.groupPosition}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ opacity: isCover ? 1 : 0.5 }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                          {/* Logo preview */}
                          {logoPreviewUrl && (() => {
                            const posStyle: React.CSSProperties = { position: "absolute" };
                            if (logoPosition === "top-left") { posStyle.top = 4; posStyle.left = 4; }
                            else if (logoPosition === "top-right") { posStyle.top = 4; posStyle.right = 4; }
                            else if (logoPosition === "bottom-left") { posStyle.bottom = 24; posStyle.left = 4; }
                            else { posStyle.bottom = 24; posStyle.right = 4; }
                            return (
                              <img src={logoPreviewUrl} alt="Logo" style={{ ...posStyle, height: previewLogoH, maxWidth: 60, objectFit: "contain" }} />
                            );
                          })()}
                          {/* Text overlay box */}
                          <div
                            className="absolute bottom-4 left-3 px-2 py-1.5 rounded-sm"
                            style={{ backgroundColor: overlayColor }}
                          >
                            <p
                              className="font-semibold line-clamp-4"
                              style={{ fontFamily, fontSize: Math.max(7, Math.round(fontSize * 0.15)) + "px", color: textColor, lineHeight: lineSpacing }}
                            >
                              {slide.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ——— Floating Bottom Bar ——— */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Expanded panel */}
        {barExpanded && (
          <div className="bg-card/98 backdrop-blur border-t border-border/30 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-5">
              {/* Text Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Text Size</Label>
                  <span className="text-xs font-semibold tabular-nums">{fontSize}px</span>
                </div>
                <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" />
              </div>

              {/* Text Colour */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> Text Colour
                </Label>
                <div className="flex gap-2">
                  <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                  <Input type="text" value={textColor.toUpperCase()} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-8 text-xs font-mono" placeholder="#ffffff" />
                </div>
              </div>

              {/* Line Spacing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Line Spacing</Label>
                  <span className="text-xs font-semibold tabular-nums">{lineSpacing.toFixed(2)}</span>
                </div>
                <Slider min={0.7} max={2} step={0.05} value={[lineSpacing]} onValueChange={([v]) => setLineSpacing(v)} className="w-full" />
              </div>

              {/* Overlay Colour */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> Overlay Colour
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={overlayColor.startsWith("#") ? overlayColor : "#000000"}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const a = overlayColor.includes(",") ? overlayColor.match(/[\d.]+\)$/)?.[0]?.slice(0, -1) || "0.5" : "0.5";
                      setOverlayColor(`rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`);
                    }}
                    className="w-10 h-8 p-0.5 cursor-pointer"
                  />
                  <Input type="text" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className="flex-1 h-8 text-xs font-mono" placeholder="rgba(0,0,0,0.5)" />
                </div>
              </div>

              {/* Logo controls */}
              {logoFile && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Logo Position</Label>
                    <Select value={logoPosition} onValueChange={setLogoPosition}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOGO_POSITIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Logo Size</Label>
                      <span className="text-xs font-semibold tabular-nums">{logoSize}px</span>
                    </div>
                    <Slider min={40} max={300} step={10} value={[logoSize]} onValueChange={([v]) => setLogoSize(v)} className="w-full" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main bar */}
        <div className="bg-card/98 backdrop-blur border-t border-border/20 shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Font */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Label className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">Font</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="h-8 text-xs w-[120px]" data-testid="select-font">
                  <SelectValue>
                    <span style={{ fontFamily }}>{selectedFontLabel}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span style={{ fontFamily: f.value }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font size compact display */}
            <div className="hidden md:flex items-center gap-2 min-w-[120px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fontSize}px</span>
              <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" />
            </div>

            {/* Text color compact */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Label className="text-xs text-muted-foreground hidden sm:block">T</Label>
              <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 p-0.5 cursor-pointer flex-shrink-0" data-testid="input-text-color" />
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setBarExpanded((v) => !v)}
              className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 px-2 py-1 rounded-md hover:bg-accent"
            >
              {barExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{barExpanded ? "Less" : "More"}</span>
            </button>

            <div className="flex-1" />

            {/* Generate button — pill, gradient, shimmer */}
            {!result ? (
              <button
                className="btn-shimmer h-10 px-6 rounded-full text-sm font-semibold flex items-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                ) : "Generate Carousel Posts"}
              </button>
            ) : (
              <button
                className="btn-shimmer h-10 px-6 rounded-full text-sm font-semibold flex items-center gap-2 flex-shrink-0"
                onClick={downloadZip}
                data-testid="button-download-zip-bar"
              >
                <Download className="w-4 h-4" />
                Download ZIP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
