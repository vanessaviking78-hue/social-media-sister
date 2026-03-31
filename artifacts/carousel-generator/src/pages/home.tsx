import React, { useState, useCallback, useRef } from "react";
import { Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X } from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { useGenerateCarousel } from "@workspace/api-client-react";
import type { CarouselResult } from "@workspace/api-client-react/src/generated/api.schemas";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

const FONT_GOOGLE_NAMES = [
  "Playfair+Display",
  "Montserrat",
  "Lato",
  "Oswald",
  "Merriweather",
  "Raleway",
  "Source+Sans+Pro",
  "Roboto",
];

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${FONT_GOOGLE_NAMES.join("&family=")}&display=swap`;
  document.head.appendChild(link);
}

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [generatedResult, setGeneratedResult] = useState<CarouselResult | null>(null);

  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  const [fontSize, setFontSize] = useState(52);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const generateCarousel = useGenerateCarousel();

  const handlePhotosDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhotos(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setPhotos((prev) => [...prev, ...Array.from(e.dataTransfer.files)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const handlePhotosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const processCsvFile = (file: File) => {
    setCsvFile(file);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvPreview(results.data.slice(0, 5));
      },
      error: (error: { message: string }) => {
        toast.error("Failed to parse CSV file: " + error.message);
      },
    });
  };

  const handleCsvDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        processCsvFile(file);
      } else {
        toast.error("Please upload a valid CSV file");
      }
    }
  }, []);

  const handleCsvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  }, []);

  const handleGenerate = () => {
    if (photos.length === 0) { toast.error("Please upload at least one photo"); return; }
    if (!csvFile) { toast.error("Please upload a CSV file"); return; }

    generateCarousel.mutate(
      { data: { photos, csv: csvFile } },
      {
        onSuccess: (data) => {
          setGeneratedResult(data);
          toast.success(`Generated ${data.totalSlides} slides successfully`);
        },
        onError: (err: { error?: { error?: string } }) => {
          toast.error(err.error?.error || "Failed to generate carousel posts");
        },
      }
    );
  };

  const handleStartOver = () => {
    setPhotos([]);
    setCsvFile(null);
    setCsvPreview([]);
    setGeneratedResult(null);
  };

  const drawTextOnCanvas = (
    ctx: CanvasRenderingContext2D,
    text: string,
    canvasWidth: number,
    canvasHeight: number,
    font: string,
    size: number
  ) => {
    const barHeight = Math.round(canvasHeight * 0.32);
    const barY = canvasHeight - barHeight;

    const gradient = ctx.createLinearGradient(0, barY - 40, 0, canvasHeight);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.2, "rgba(0,0,0,0.75)");
    gradient.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, barY - 40, canvasWidth, barHeight + 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const maxWidth = canvasWidth - 120;
    const lineHeight = Math.round(size * 1.4);
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    const totalTextHeight = lines.length * lineHeight;
    const startY = barY + Math.round((barHeight - totalTextHeight) / 2);

    lines.forEach((line, i) => {
      ctx.fillText(line, canvasWidth / 2, startY + i * lineHeight);
    });

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `500 ${Math.round(size * 0.42)}px ${font}`;
    ctx.textBaseline = "bottom";
  };

  const downloadAllAsZip = async () => {
    if (!generatedResult || generatedResult.slides.length === 0) return;

    const toastId = toast.loading("Preparing ZIP — this may take a moment...");

    try {
      await document.fonts.ready;

      const zip = new JSZip();

      for (const slide of generatedResult.slides) {
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();

        const img = new Image();
        const imgLoadPromise = new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
        await imgLoadPromise;

        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const scale = Math.max(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height);
        const x = (CANVAS_WIDTH - img.width * scale) / 2;
        const y = (CANVAS_HEIGHT - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        drawTextOnCanvas(ctx, slide.text, CANVAS_WIDTH, CANVAS_HEIGHT, fontFamily, fontSize);

        const outBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        if (outBlob) {
          zip.file(`slide-${String(slide.index).padStart(2, "0")}.png`, outBlob);
        }

        URL.revokeObjectURL(img.src);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      toast.success("Download started", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP file", { id: toastId });
    }
  };

  const selectedFontLabel = FONT_OPTIONS.find(f => f.value === fontFamily)?.label ?? "Inter";

  return (
    <div className="min-h-[100dvh] w-full pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Carousel Studio</h1>
        </div>
        {generatedResult && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleStartOver} className="text-muted-foreground border-muted-foreground/30 hover:text-foreground">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button size="sm" onClick={downloadAllAsZip}>
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 mt-10">
        {!generatedResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">Upload Assets</h2>
                <p className="text-muted-foreground">Add your photos and CSV text to generate up to 30 slides.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Photos Upload */}
                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    data-testid="drop-zone-photos"
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDraggingPhotos ? "bg-primary/10 border-primary" : "hover:bg-muted/50"} border-2 border-dashed border-transparent`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                    onDragLeave={() => setIsDraggingPhotos(false)}
                    onDrop={handlePhotosDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handlePhotosChange} data-testid="input-photos" />
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4 text-primary">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Photos</h3>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                  </div>
                </Card>

                {/* CSV Upload */}
                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    data-testid="drop-zone-csv"
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDraggingCsv ? "bg-primary/10 border-primary" : "hover:bg-muted/50"} border-2 border-dashed border-transparent`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                    onDragLeave={() => setIsDraggingCsv(false)}
                    onDrop={handleCsvDrop}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <input type="file" ref={csvInputRef} className="hidden" accept=".csv,text/csv" onChange={handleCsvChange} data-testid="input-csv" />
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4 text-primary">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold mb-1">CSV File</h3>
                    <p className="text-sm text-muted-foreground">{csvFile ? csvFile.name : "Drag & drop or click to upload"}</p>
                  </div>
                </Card>
              </div>

              {photos.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Selected Photos</h3>
                    <Badge variant="secondary" className="bg-accent">{photos.length}</Badge>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {photos.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-md overflow-hidden group bg-accent" data-testid={`photo-preview-${i}`}>
                        <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-photo-${i}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="bg-card border-border/50 sticky top-24">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="font-semibold border-b border-border/50 pb-4 mb-4">Configuration</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Photos</span>
                        <span className="font-medium">{photos.length} uploaded</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">CSV Text</span>
                        <span className="font-medium">{csvFile ? "Ready" : "Missing"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Output size</span>
                        <span className="font-medium text-primary">1080 × 1350 px</span>
                      </div>
                    </div>
                  </div>

                  {/* Font family */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Font</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="w-full" data-testid="select-font">
                        <SelectValue placeholder="Choose font">
                          <span style={{ fontFamily }}>{selectedFontLabel}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value} data-testid={`font-option-${f.label}`}>
                            <span style={{ fontFamily: f.value }}>{f.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font size */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Text Size</Label>
                      <span className="text-sm font-semibold tabular-nums" data-testid="text-font-size">{fontSize}px</span>
                    </div>
                    <Slider
                      min={28}
                      max={96}
                      step={2}
                      value={[fontSize]}
                      onValueChange={([v]) => setFontSize(v)}
                      className="w-full"
                      data-testid="slider-font-size"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Small</span>
                      <span>Large</span>
                    </div>
                  </div>

                  {/* Text preview */}
                  <div className="rounded-md bg-background/50 border border-border/50 p-3">
                    <p
                      className="text-center text-foreground leading-snug"
                      style={{ fontFamily, fontSize: Math.round(fontSize * 0.25) + "px" }}
                      data-testid="text-preview-sample"
                    >
                      Your caption text will look like this on each slide.
                    </p>
                  </div>

                  <Button
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
                    onClick={handleGenerate}
                    disabled={generateCarousel.isPending}
                    data-testid="button-generate"
                  >
                    {generateCarousel.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Carousel Posts"
                    )}
                  </Button>

                  {csvPreview.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">CSV Preview</h4>
                      <ScrollArea className="h-40 rounded-md border border-border/50 bg-background/50">
                        <div className="p-3 space-y-2">
                          {csvPreview.map((row, i) => (
                            <div key={i} className="text-xs bg-accent/50 p-2 rounded text-muted-foreground">
                              {Object.entries(row).map(([k, v]) => (
                                <div key={k} className="line-clamp-2">
                                  <span className="font-medium text-foreground">{k}:</span> {String(v)}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Your Carousel is Ready</h2>
                <p className="text-muted-foreground">
                  {generatedResult.totalSlides} slides at 1080 × 1350 px — font: <span style={{ fontFamily }} className="text-foreground font-medium">{selectedFontLabel}</span>, {fontSize}px
                </p>
              </div>
            </div>

            {/* Slides grid — 4:5 aspect ratio (1080:1350) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {generatedResult.slides.map((slide) => (
                <div
                  key={slide.index}
                  className="relative group rounded-xl overflow-hidden shadow-md border border-border/50 bg-card"
                  style={{ aspectRatio: "4/5" }}
                  data-testid={`slide-card-${slide.index}`}
                >
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${slide.index}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                  {/* Text */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end">
                    <p
                      className="text-white leading-snug line-clamp-4 font-semibold"
                      style={{ fontFamily, fontSize: Math.max(9, Math.round(fontSize * 0.19)) + "px" }}
                      data-testid={`slide-text-${slide.index}`}
                    >
                      {slide.text}
                    </p>
                  </div>
                  {/* Slide number */}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-semibold text-white" data-testid={`slide-number-${slide.index}`}>
                    {slide.index}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
