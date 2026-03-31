import React, { useState, useCallback, useRef } from "react";
import { Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, ChevronLeft, ChevronRight } from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { useGenerateCarousel } from "@workspace/api-client-react";
import type { CarouselResult, CarouselPost } from "@workspace/api-client-react/src/generated/api.schemas";

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

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display&family=Montserrat&family=Lato&family=Oswald&family=Merriweather&family=Raleway&family=Source+Sans+Pro&family=Roboto&display=swap";
  document.head.appendChild(link);
}

function drawSlideOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  text: string,
  font: string,
  size: number
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  // Cover-fit the image
  const scale = Math.max(W / img.width, H / img.height);
  const x = (W - img.width * scale) / 2;
  const y = (H - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  // Gradient overlay at bottom
  const barH = Math.round(H * 0.38);
  const barY = H - barH;
  const grad = ctx.createLinearGradient(0, barY - 60, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.25, "rgba(0,0,0,0.72)");
  grad.addColorStop(1, "rgba(0,0,0,0.93)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY - 60, W, barH + 60);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxW = W - 120;
  const lineH = Math.round(size * 1.38);
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const totalH = lines.length * lineH;
  const startY = barY + Math.round((barH - totalH) / 2);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineH));
}

/** Mini carousel post card for the preview grid */
function PostCard({
  post,
  font,
  fontSize,
}: {
  post: CarouselPost;
  font: string;
  fontSize: number;
}) {
  const [active, setActive] = useState(0);
  const slide = post.slides[active];

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 shadow-md bg-card" style={{ aspectRatio: "4/5" }}>
      <div className="relative w-full h-full group" data-testid={`post-card-${post.postIndex}`}>
        <img
          src={slide.imageUrl}
          alt={`Post ${post.postIndex} slide ${slide.slideIndex}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

        {/* Text */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-6">
          <p
            className="text-white font-semibold leading-snug line-clamp-4"
            style={{ fontFamily: font, fontSize: Math.max(9, Math.round(fontSize * 0.18)) + "px" }}
            data-testid={`post-text-${post.postIndex}-${slide.slideIndex}`}
          >
            {slide.text}
          </p>
        </div>

        {/* Post number */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white">
          Post {post.postIndex}
        </div>

        {/* Slide dots + arrows */}
        {post.slides.length > 1 && (
          <>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {post.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === active ? "bg-white scale-125" : "bg-white/40"}`}
                  data-testid={`dot-${post.postIndex}-${i}`}
                />
              ))}
            </div>
            <button
              onClick={() => setActive((a) => Math.max(0, a - 1))}
              disabled={active === 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-0.5 text-white disabled:opacity-20 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setActive((a) => Math.min(post.slides.length - 1, a + 1))}
              disabled={active === post.slides.length - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-0.5 text-white disabled:opacity-20 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
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
    if (e.dataTransfer.files?.length) {
      setPhotos((prev) => [...prev, ...Array.from(e.dataTransfer.files)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const handlePhotosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const processCsvFile = (file: File) => {
    setCsvFile(file);
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        if (rows.length === 0) return;
        const first = rows[0];
        const looksLikeHeader = first.every((c) => /^[a-z][a-z0-9_\s]*$/i.test(c.trim()));
        const headers = looksLikeHeader ? first : first.map((_, i) => `Slide ${i + 1}`);
        const dataRows = looksLikeHeader ? rows.slice(1) : rows;
        setCsvPreview({ headers, rows: dataRows.slice(0, 3) });
      },
      error: (err: { message: string }) => toast.error("Failed to parse CSV: " + err.message),
    });
  };

  const handleCsvDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    if (e.dataTransfer.files?.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
        processCsvFile(file);
      } else {
        toast.error("Please upload a CSV file");
      }
    }
  }, []);

  const handleCsvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processCsvFile(e.target.files[0]);
  }, []);

  const handleGenerate = () => {
    if (!photos.length) { toast.error("Please upload at least one photo"); return; }
    if (!csvFile) { toast.error("Please upload a CSV file"); return; }

    generateCarousel.mutate(
      { data: { photos, csv: csvFile } },
      {
        onSuccess: (data) => {
          setGeneratedResult(data);
          toast.success(`Generated ${data.totalPosts} carousel posts (${data.slidesPerPost} slides each)`);
        },
        onError: () => toast.error("Failed to generate carousel posts"),
      }
    );
  };

  const handleStartOver = () => {
    setPhotos([]);
    setCsvFile(null);
    setCsvPreview({ headers: [], rows: [] });
    setGeneratedResult(null);
  };

  const downloadAllAsZip = async () => {
    if (!generatedResult?.posts.length) return;
    const toastId = toast.loading("Building ZIP — this may take a moment...");

    try {
      await document.fonts.ready;
      const zip = new JSZip();

      for (const post of generatedResult.posts) {
        const folder = zip.folder(`carousel-${String(post.postIndex).padStart(2, "0")}`);
        if (!folder) continue;

        for (const slide of post.slides) {
          const res = await fetch(slide.imageUrl);
          const blob = await res.blob();

          const img = new Image();
          const loaded = new Promise<void>((ok, fail) => {
            img.onload = () => ok();
            img.onerror = fail;
            img.src = URL.createObjectURL(blob);
          });
          await loaded;

          const canvas = document.createElement("canvas");
          canvas.width = CANVAS_WIDTH;
          canvas.height = CANVAS_HEIGHT;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          drawSlideOnCanvas(ctx, img, slide.text, fontFamily, fontSize);
          URL.revokeObjectURL(img.src);

          const outBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
          if (outBlob) {
            folder.file(`slide-${String(slide.slideIndex).padStart(2, "0")}.png`, outBlob);
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      toast.success("Download started", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP", { id: toastId });
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
            <Button size="sm" onClick={downloadAllAsZip} data-testid="button-download-zip">
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
                <p className="text-muted-foreground">Add photos and a CSV where each row is one carousel post.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    data-testid="drop-zone-photos"
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer border-2 border-dashed border-transparent ${isDraggingPhotos ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
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

                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    data-testid="drop-zone-csv"
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer border-2 border-dashed border-transparent ${isDraggingCsv ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
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

              {/* CSV preview table */}
              {csvPreview.rows.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">CSV Preview</h3>
                  <div className="rounded-md border border-border/50 overflow-hidden text-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-accent/60">
                          <tr>
                            {csvPreview.headers.map((h, i) => (
                              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.map((row, ri) => (
                            <tr key={ri} className="border-t border-border/30">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 bg-accent/20 text-xs text-muted-foreground border-t border-border/30">
                      Showing first 3 rows — each row = one carousel post, each column = one slide
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-4">
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
                        <span className="text-muted-foreground">CSV</span>
                        <span className="font-medium">{csvFile ? csvFile.name : "Missing"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Output size</span>
                        <span className="font-medium text-primary">1080 × 1350 px</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Font</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="w-full" data-testid="select-font">
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Text Size</Label>
                      <span className="text-sm font-semibold tabular-nums" data-testid="text-font-size">{fontSize}px</span>
                    </div>
                    <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" data-testid="slider-font-size" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Small</span>
                      <span>Large</span>
                    </div>
                  </div>

                  <div className="rounded-md bg-background/50 border border-border/50 p-3">
                    <p className="text-center text-foreground leading-snug" style={{ fontFamily, fontSize: Math.round(fontSize * 0.25) + "px" }}>
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
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                    ) : "Generate Carousel Posts"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-bold mb-2">Your Carousel Posts are Ready</h2>
              <p className="text-muted-foreground">
                {generatedResult.totalPosts} posts &times; {generatedResult.slidesPerPost} slides &mdash; 1080 &times; 1350 px &mdash;{" "}
                <span style={{ fontFamily }} className="text-foreground font-medium">{selectedFontLabel}</span>, {fontSize}px
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ZIP will contain <strong className="text-foreground">carousel-01/</strong> … <strong className="text-foreground">carousel-{String(generatedResult.totalPosts).padStart(2, "0")}/</strong>, each with slide-01.png … slide-{String(generatedResult.slidesPerPost).padStart(2, "0")}.png
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {generatedResult.posts.map((post) => (
                <PostCard key={post.postIndex} post={post} font={fontFamily} fontSize={fontSize} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
