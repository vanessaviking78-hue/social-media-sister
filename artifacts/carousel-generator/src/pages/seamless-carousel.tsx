import React, { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ImagePlus, BookOpen, Film, Palette, MessageSquareText, CalendarDays, BarChart3, Loader2, Download, Grid, User, Scissors } from "lucide-react";

const SCRIPT_FONTS = [
  { label: "Allura", value: "Allura" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Pinyon Script", value: "Pinyon Script" },
  { label: "Sacramento", value: "Sacramento" },
];

const DOODLES = [
  { label: "None", value: "none" },
  { label: "Arrow", value: "arrow" },
  { label: "Heart", value: "heart" },
  { label: "Sparkle", value: "star" },
];

const POSITIONS = [
  { label: "Top left", value: "top-left" },
  { label: "Top right", value: "top-right" },
  { label: "Centre", value: "center" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom right", value: "bottom-right" },
];

type UploadMode = "single" | "multiple";

type SlideConfig = {
  hasText: boolean;
  title: string;
  leadIn: string;
  tagLine: string;
  doodle: string;
  position: string;
};

function defaultSlide(i: number): SlideConfig {
  return {
    hasText: i === 0,
    title: i === 0 ? "Slide title" : "",
    leadIn: "",
    tagLine: "",
    doodle: "none",
    position: "bottom-left",
  };
}

const SLIDE_SIZE = 1080;

export default function SeamlessCarouselPage() {
  const [slideCount, setSlideCount] = useState(3);
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [multiUrls, setMultiUrls] = useState<string[]>([]);
  const [slides, setSlides] = useState<SlideConfig[]>([defaultSlide(0), defaultSlide(1), defaultSlide(2)]);
  const [scriptFont, setScriptFont] = useState("Allura");
  const [textColor, setTextColor] = useState("#ffffff");
  const [watermark, setWatermark] = useState("");

  const [generating, setGenerating] = useState(false);
  const [renderedUrls, setRenderedUrls] = useState<string[]>([]);

  const singleInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const handleSlideCountChange = (n: number) => {
    setSlideCount(n);
    setSlides((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(defaultSlide(next.length));
      return next.slice(0, n);
    });
    setRenderedUrls([]);
  };

  const handleSingleFile = (file: File) => {
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setRenderedUrls([]);
  };

  const handleMultiFiles = (files: FileList) => {
    const arr = Array.from(files).slice(0, slideCount);
    setMultiFiles(arr);
    setMultiUrls(arr.map((f) => URL.createObjectURL(f)));
    setRenderedUrls([]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    if (uploadMode === "single") {
      if (files[0].type.startsWith("image/")) handleSingleFile(files[0]);
    } else {
      const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imgs.length) handleMultiFiles({ ...imgs, length: imgs.length, item: (i: number) => imgs[i] } as unknown as FileList);
    }
  }, [uploadMode]);

  const setSlideField = (i: number, field: keyof SlideConfig, val: string | boolean) => {
    setSlides((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const handleGenerate = async () => {
    const hasSource = uploadMode === "single" ? !!sourceFile : multiFiles.length > 0;
    if (!hasSource) { toast.error("Please upload an image first"); return; }

    setGenerating(true);
    try {
      const formData = new FormData();
      if (uploadMode === "single" && sourceFile) {
        formData.append("images", sourceFile, sourceFile.name);
      } else {
        multiFiles.forEach((f) => formData.append("images", f, f.name));
      }

      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { urls } = await uploadResp.json() as { urls: string[] };

      const createBody = {
        slideCount,
        sourceImageUrl: uploadMode === "single" ? urls[0] : null,
        sourceImageUrls: uploadMode === "multiple" ? urls : null,
        slides,
        scriptFont,
        textColor,
        watermark,
      };

      const createResp = await fetch(`${import.meta.env.BASE_URL}api/seamless`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      if (!createResp.ok) throw new Error("Save failed");
      const created = await createResp.json() as { id: number };

      const renderResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/${created.id}/render`, {
        method: "POST",
      });
      if (!renderResp.ok) throw new Error("Render failed");
      const { slideUrls } = await renderResp.json() as { slideUrls: string[] };
      setRenderedUrls(slideUrls);
      toast.success(`${slideUrls.length} slides rendered`);
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const previewSliceW = Math.floor(320 / slideCount);
  const previewH = previewSliceW;
  const totalPreviewW = previewSliceW * slideCount;

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Single Image</Button></Link>
          <Link href="/stories"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-1" />Stories</Button></Link>
          <Link href="/reels"><Button variant="ghost" size="sm" className="text-muted-foreground"><Film className="w-4 h-4 mr-1" />Reels</Button></Link>
          <Link href="/about-me"><Button variant="ghost" size="sm" className="text-muted-foreground"><User className="w-4 h-4 mr-1" />About Me</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-1" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-1" />Captions</Button></Link>
          <Link href="/library"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-1" />Library</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-1" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-1" />Analytics</Button></Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className="mb-8">
          <h1 className="font-sans font-bold text-4xl tracking-tight mb-2 flex items-center gap-3">
            <Grid className="w-9 h-9 text-pink-400" /> Seamless Carousel
          </h1>
          <p className="text-lg text-muted-foreground">Slice one wide image into perfectly aligned carousel slides that connect edge to edge.</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Controls */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Slide count + mode */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Number of slides</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 4, 5].map((n) => (
                    <button key={n} onClick={() => handleSlideCountChange(n)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${slideCount === n ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30"}`}
                    >{n} slides</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Upload mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["single", "multiple"] as const).map((m) => (
                    <button key={m} onClick={() => { setUploadMode(m); setSourceFile(null); setSourceUrl(""); setMultiFiles([]); setMultiUrls([]); setRenderedUrls([]); }}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${uploadMode === m ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30"}`}
                    >{m === "single" ? `One wide image (${slideCount}:1 ratio)` : `${slideCount} separate images`}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Image upload */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <Label className="text-base font-semibold">
                {uploadMode === "single" ? "Upload wide image" : `Upload ${slideCount} images`}
              </Label>
              {uploadMode === "single" ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => singleInputRef.current?.click()}
                  className="border-2 border-dashed border-pink-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-pink-500/60 transition-colors"
                >
                  {sourceUrl ? (
                    <div className="space-y-2">
                      <img src={sourceUrl} alt="Source" className="w-full h-32 object-cover rounded-lg" />
                      <p className="text-xs text-muted-foreground">Click to change — ideal ratio {slideCount}:1</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-7 h-7 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                      <p className="text-xs text-pink-400/70">Ideal: {slideCount * 1080}×1080px ({slideCount}:1 ratio)</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => multiInputRef.current?.click()}
                  className="border-2 border-dashed border-pink-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-pink-500/60 transition-colors"
                >
                  {multiUrls.length > 0 ? (
                    <div className="flex gap-2 justify-center">
                      {multiUrls.map((url, i) => (
                        <img key={i} src={url} alt={`Slide ${i + 1}`} className="h-20 w-20 object-cover rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-7 h-7 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload {slideCount} images — they'll be stitched together</p>
                    </div>
                  )}
                </div>
              )}
              <input ref={singleInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSingleFile(f); }} />
              <input ref={multiInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleMultiFiles(e.target.files); }} />
            </div>

            {/* Per-slide text overlays */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <Label className="text-base font-semibold">Text overlays</Label>
              {slides.map((slide, i) => (
                <div key={i} className="border border-border/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-muted-foreground">Slide {i + 1}</p>
                    <button onClick={() => setSlideField(i, "hasText", !slide.hasText)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${slide.hasText ? "bg-pink-500" : "bg-gray-600"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${slide.hasText ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  {slide.hasText && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Lead-in</Label>
                          <Input value={slide.leadIn} onChange={(e) => setSlideField(i, "leadIn", e.target.value)} placeholder="My favourite" className="h-9 text-sm mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Title</Label>
                          <Input value={slide.title} onChange={(e) => setSlideField(i, "title", e.target.value)} placeholder="Beachwear" className="h-9 text-sm mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tagline</Label>
                          <Input value={slide.tagLine} onChange={(e) => setSlideField(i, "tagLine", e.target.value)} placeholder="inspiration" className="h-9 text-sm mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Doodle</Label>
                            <Select value={slide.doodle} onValueChange={(v) => setSlideField(i, "doodle", v)}>
                              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{DOODLES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Position</Label>
                            <Select value={slide.position} onValueChange={(v) => setSlideField(i, "position", v)}>
                              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Global style */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <Label className="text-base font-semibold">Global style</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Script font</Label>
                  <Select value={scriptFont} onValueChange={setScriptFont}>
                    <SelectTrigger className="h-10">
                      <SelectValue><span style={{ fontFamily: `'${scriptFont}', cursive` }}>{scriptFont}</span></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SCRIPT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: `'${f.value}', cursive` }}>{f.label}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Text colour</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-10 p-0.5 cursor-pointer" />
                    <Input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-10 font-mono text-sm" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Watermark (optional — e.g. @youraccount)</Label>
                <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="@youraccount" className="h-10" />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || (uploadMode === "single" ? !sourceFile : multiFiles.length === 0)}
              className="btn-shimmer w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Slicing &amp; rendering...</> : <><Scissors className="w-5 h-5" /> Generate Slides</>}
            </button>
          </div>

          {/* Preview */}
          <div className="hidden lg:flex flex-col gap-3 shrink-0 sticky top-24 self-start" style={{ width: Math.min(totalPreviewW, 340) }}>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground text-center">Preview</p>

            {renderedUrls.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-0.5 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  {renderedUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Slide ${i + 1}`} className="flex-1 object-cover" style={{ aspectRatio: "1/1" }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {renderedUrls.map((url, i) => (
                    <a key={i} href={url} download={`slide-${i + 1}.png`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="w-full gap-1 text-xs"><Download className="w-3 h-3" /> Slide {i + 1}</Button>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                {(uploadMode === "single" && sourceUrl) ? (
                  <div className="flex" style={{ height: previewH }}>
                    {Array.from({ length: slideCount }).map((_, i) => (
                      <div key={i} className="flex-1 relative overflow-hidden border-r border-white/10 last:border-0">
                        <img src={sourceUrl} alt="" className="absolute inset-0 h-full object-cover"
                          style={{ width: `${slideCount * 100}%`, left: `${-i * 100}%` }} />
                        <div className="absolute inset-0 flex items-end justify-center pb-2">
                          <span className="text-white/60 text-xs font-semibold">{i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : multiUrls.length > 0 ? (
                  <div className="flex" style={{ height: previewH }}>
                    {multiUrls.slice(0, slideCount).map((url, i) => (
                      <div key={i} className="flex-1 relative overflow-hidden border-r border-white/10 last:border-0">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex" style={{ height: previewH }}>
                    {Array.from({ length: slideCount }).map((_, i) => (
                      <div key={i} className="flex-1 bg-muted/30 border-r border-white/10 last:border-0 flex items-center justify-center">
                        <span className="text-muted-foreground/40 text-sm font-bold">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center leading-snug">
              {renderedUrls.length > 0
                ? "Click each slide to download"
                : uploadMode === "single"
                  ? `Upload a ${slideCount}:1 wide image — the system will slice it`
                  : `Upload ${slideCount} images to stitch together`}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
