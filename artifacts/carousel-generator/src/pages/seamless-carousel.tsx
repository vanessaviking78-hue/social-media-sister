import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, ImagePlus, BookOpen, Film, Palette, MessageSquareText,
  CalendarDays, BarChart3, Loader2, Download, Grid, User,
  Wand2, X, ZoomIn, Send,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SCRIPT_FONTS = [
  { label: "Allura", value: "Allura", cat: "Script" },
  { label: "Great Vibes", value: "Great Vibes", cat: "Script" },
  { label: "Pinyon Script", value: "Pinyon Script", cat: "Script" },
  { label: "Sacramento", value: "Sacramento", cat: "Script" },
  { label: "Dancing Script", value: "Dancing Script", cat: "Script" },
  { label: "Pacifico", value: "Pacifico", cat: "Script" },
  { label: "Alex Brush", value: "Alex Brush", cat: "Script" },
  { label: "Kaushan Script", value: "Kaushan Script", cat: "Script" },
  { label: "Playfair Display", value: "Playfair Display", cat: "Serif" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond", cat: "Serif" },
  { label: "Lora", value: "Lora", cat: "Serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville", cat: "Serif" },
  { label: "Poppins", value: "Poppins", cat: "Sans" },
  { label: "Montserrat", value: "Montserrat", cat: "Sans" },
  { label: "Raleway", value: "Raleway", cat: "Sans" },
  { label: "Nunito", value: "Nunito", cat: "Sans" },
  { label: "Quicksand", value: "Quicksand", cat: "Sans" },
];

const DOODLES = [
  { label: "None", value: "none" },
  { label: "Heart", value: "heart" },
  { label: "Arrow", value: "arrow" },
  { label: "Sparkle", value: "star" },
];

const POSITIONS = [
  { label: "Top left", value: "top-left" },
  { label: "Top right", value: "top-right" },
  { label: "Centre", value: "center" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom right", value: "bottom-right" },
];

const LAYOUTS = [
  {
    value: "background_overlays",
    label: "Background + Overlays",
    desc: "One wide background image with scattered polaroid overlays, some bridging slide seams",
    emoji: "🖼",
  },
  {
    value: "mosaic",
    label: "Mosaic Flow",
    desc: "All images in a flowing grid — great for product carousels or treatment overviews",
    emoji: "⬛",
  },
  {
    value: "magazine",
    label: "Magazine Spread",
    desc: "Two dominant images with accent shots — the most editorial look",
    emoji: "📰",
  },
];

type SlideConfig = {
  hasText: boolean;
  title: string;
  leadIn: string;
  tagLine: string;
  doodle: string;
  position: string;
  titleColor?: string;
  titleFontSize?: number;
  titleLetterSpacing?: number;
  titleLineHeight?: number;
  leadInColor?: string;
  leadInFontSize?: number;
  leadInLetterSpacing?: number;
  leadInLineHeight?: number;
  tagLineColor?: string;
  tagLineFontSize?: number;
  tagLineLetterSpacing?: number;
  tagLineLineHeight?: number;
};

type LogoState = {
  dataUrl: string;
  storedUrl: string;
  ar: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

function defaultSlide(i: number): SlideConfig {
  return {
    hasText: i === 0,
    title: i === 0 ? "" : "",
    leadIn: "",
    tagLine: "",
    doodle: "none",
    position: "bottom-left",
  };
}

type CollageElement = {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  hasBorder: boolean;
  isBackground: boolean;
};

type Step = "upload" | "layout" | "text" | "result";

export default function SeamlessCarouselPage() {
  const [step, setStep] = useState<Step>("upload");
  const [slideCount, setSlideCount] = useState(3);
  const [layout, setLayout] = useState("background_overlays");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [collageElements, setCollageElements] = useState<CollageElement[]>([]);
  const [slides, setSlides] = useState<SlideConfig[]>([defaultSlide(0), defaultSlide(1), defaultSlide(2)]);
  const [scriptFont, setScriptFont] = useState("Allura");
  const [textColor, setTextColor] = useState("#ffffff");
  const [watermark, setWatermark] = useState("");
  const [carouselId, setCarouselId] = useState<number | null>(null);
  const [renderedUrls, setRenderedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [logo, setLogo] = useState<LogoState | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [presets, setPresets] = useState<{ id: number; name: string }[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const [logoDragStart, setLogoDragStart] = useState<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleSlideCountChange = (n: number) => {
    setSlideCount(n);
    setSlides((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(defaultSlide(next.length));
      return next.slice(0, n);
    });
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    const combined = [...files, ...imgs].slice(0, 10);
    setFiles(combined);
    setPreviewUrls(combined.map((f) => URL.createObjectURL(f)));
    setUploadedUrls([]);
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
    setUploadedUrls([]);
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (dropped.length) addFiles(dropped);
  }, [files]);

  const setSlideField = (i: number, field: keyof SlideConfig, val: string | boolean | number) => {
    setSlides((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  // Load presets
  useEffect(() => {
    fetch(`${BASE}/api/presets`).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d?.presets) ? d.presets : Array.isArray(d) ? d : [];
      setPresets(list.map((p: any) => ({ id: p.id, name: p.name })));
      if (list.length === 1) setSelectedPresetId(list[0].id);
    }).catch(() => {});
  }, []);

  const handleLogoFile = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.onload = () => setLogo({ dataUrl, storedUrl: "", ar: img.naturalWidth / img.naturalHeight, x: 0.5, y: 0.88, scale: 1, rotation: 0 });
    img.src = dataUrl;
  };

  const uploadLogoToServer = async (dataUrl: string): Promise<string> => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const fd = new FormData(); fd.append("logo", blob, "logo.png");
    const r = await fetch(`${BASE}/api/seamless/upload-logo`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("Logo upload failed");
    const { logoUrl } = await r.json() as { logoUrl: string };
    return logoUrl;
  };

  const handleSchedule = () => {
    if (!renderedUrls.length) { toast.error("Generate slides first"); return; }
    const posts: SchedulePostPayload[] = [{
      title: slides[0]?.title || "Seamless Carousel",
      caption: "",
      imageUrls: renderedUrls,
    }];
    setSchedulePosts(posts);
    setScheduleOpen(true);
  };

  const startLogoDrag = (e: React.PointerEvent) => {
    if (!logo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setLogoDragging(true);
    setLogoDragStart({ px: e.clientX, py: e.clientY, ox: logo.x, oy: logo.y });
  };

  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (!logoDragging || !logoDragStart || !logo || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const slideW = rect.width / slideCount;
    const dx = (e.clientX - logoDragStart.px) / slideW;
    const dy = (e.clientY - logoDragStart.py) / rect.height;
    setLogo((l) => l ? { ...l, x: Math.max(0, Math.min(1, logoDragStart.ox + dx)), y: Math.max(0, Math.min(1, logoDragStart.oy + dy)) } : l);
  };

  const onPreviewPointerUp = () => {
    setLogoDragging(false);
    setLogoDragStart(null);
  };

  // Step 1 → Step 2: upload images, run auto-arrange
  const handleUploadAndArrange = async () => {
    if (files.length < 2) { toast.error("Upload at least 2 images (one background + overlays)"); return; }
    setUploading(true);
    const toastId = toast.loading("Uploading images…");
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("images", f, f.name));
      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { urls } = await uploadResp.json() as { urls: string[] };
      setUploadedUrls(urls);
      toast.loading("Arranging collage…", { id: toastId });

      const arrResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/auto-arrange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideCount, layoutStyle: layout, imageUrls: urls }),
      });
      if (!arrResp.ok) throw new Error("Auto-arrange failed");
      const { elements } = await arrResp.json() as { elements: CollageElement[] };
      setCollageElements(elements);
      toast.success("Images arranged — check the preview", { id: toastId });
      setStep("layout");
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Step 2 → Step 3: change layout + re-arrange if needed
  const handleReArrange = async () => {
    if (!uploadedUrls.length) return;
    setArranging(true);
    const id = toast.loading("Re-arranging…");
    try {
      const arrResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/auto-arrange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideCount, layoutStyle: layout, imageUrls: uploadedUrls }),
      });
      if (!arrResp.ok) throw new Error("Auto-arrange failed");
      const { elements } = await arrResp.json() as { elements: CollageElement[] };
      setCollageElements(elements);
      toast.success("Layout updated", { id });
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong", { id });
    } finally {
      setArranging(false);
    }
  };

  // Final render
  const handleGenerate = async () => {
    if (!collageElements.length) { toast.error("Run auto-arrange first"); return; }
    setGenerating(true);
    const toastId = toast.loading("Saving & rendering slides…");
    try {
      // Upsert the carousel record
      // Upload logo if needed
      let logoStoredUrl = logo?.storedUrl ?? "";
      if (logo && logo.dataUrl && !logo.storedUrl) {
        try {
          logoStoredUrl = await uploadLogoToServer(logo.dataUrl);
          setLogo((l) => l ? { ...l, storedUrl: logoStoredUrl } : l);
        } catch {
          toast.error("Logo upload failed — continuing without logo");
        }
      }

      const saveBody = {
        slideCount,
        layoutStyle: layout,
        uploadedImageUrls: uploadedUrls,
        collageElements,
        slides,
        scriptFont,
        textColor,
        watermark,
        logoConfig: logo ? { logoUrl: logoStoredUrl, x: logo.x, y: logo.y, scale: logo.scale, rotation: logo.rotation } : null,
      };

      let id = carouselId;
      if (id) {
        const putResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (!putResp.ok) throw new Error("Update failed");
      } else {
        const postResp = await fetch(`${import.meta.env.BASE_URL}api/seamless`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (!postResp.ok) throw new Error("Create failed");
        const created = await postResp.json() as { id: number };
        id = created.id;
        setCarouselId(id);
      }

      toast.loading("Rendering slides — this takes a moment…", { id: toastId });
      const renderResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/${id}/render`, {
        method: "POST",
      });
      if (!renderResp.ok) throw new Error("Render failed");
      const { slideUrls } = await renderResp.json() as { slideUrls: string[] };
      setRenderedUrls(slideUrls);
      setStep("result");
      toast.success(`${slideUrls.length} slides ready`, { id: toastId });
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const downloadZip = async () => {
    const id = toast.loading("Building ZIP…");
    try {
      const zip = new JSZip();
      for (let i = 0; i < renderedUrls.length; i++) {
        const res = await fetch(renderedUrls[i]);
        const blob = await res.blob();
        zip.file(`slide-${i + 1}.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "seamless-carousel.zip");
      toast.success("Download started", { id });
    } catch {
      toast.error("Download failed", { id });
    }
  };

  // Collage preview (CSS-based, scaled to fit the right panel)
  const PREVIEW_W = 320;
  const TOTAL_CANVAS_W = 1080 * slideCount;
  const TOTAL_CANVAS_H = 1080;
  const scale = PREVIEW_W / TOTAL_CANVAS_W;
  const PREVIEW_H = Math.round(TOTAL_CANVAS_H * scale);

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      {scheduleOpen && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={presets.find((p) => p.id === selectedPresetId)?.name ?? ""}
          postType="seamless"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); toast.success("Scheduled"); }}
        />
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && renderedUrls[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
          <div className="flex items-center gap-2 px-4">
            {lightboxIdx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 1) - 1); }}
                className="text-white/60 hover:text-white text-2xl px-3">‹</button>
            )}
            <img src={renderedUrls[lightboxIdx]} alt={`Slide ${lightboxIdx + 1}`}
              className="max-h-[85vh] max-w-[80vw] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()} />
            {lightboxIdx < renderedUrls.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 0) + 1); }}
                className="text-white/60 hover:text-white text-2xl px-3">›</button>
            )}
          </div>
          <p className="absolute bottom-6 text-white/50 text-sm">{lightboxIdx + 1} / {renderedUrls.length} — click outside to close</p>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/"><Button variant="ghost" size="sm" className="text-muted-foreground">← Home</Button></Link>
          <Link href="/carousel"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Carousel</Button></Link>
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
          <p className="text-lg text-muted-foreground">Upload 5-10 photos and the system arranges them across slides as a continuous collage — images bridge the seams so the scroll feels editorial and intentional.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(["upload", "layout", "text", "result"] as Step[]).map((s, i) => {
            const labels = ["1. Upload", "2. Layout", "3. Text", "4. Result"];
            const active = step === s;
            const done = (["upload", "layout", "text", "result"] as Step[]).indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${active ? "bg-pink-500 text-white" : done ? "bg-pink-500/20 text-pink-400" : "bg-muted/40 text-muted-foreground"}`}>
                  {labels[i]}
                </div>
                {i < 3 && <div className="flex-1 h-px bg-border/30" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex gap-8 items-start">
          {/* Controls */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ── STEP 1: Upload ── */}
            {step === "upload" && (
              <>
                {/* Slide count */}
                <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                  <Label className="text-base font-semibold">Number of slides</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[3, 4, 5].map((n) => (
                      <button key={n} onClick={() => handleSlideCountChange(n)}
                        className={`py-4 rounded-xl text-sm font-semibold border transition-all ${slideCount === n ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30 hover:border-pink-500/40"}`}>
                        {n} slides
                        <span className="block text-xs font-normal opacity-70 mt-0.5">{n * 1080}×1080px total</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image upload */}
                <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Upload photos</Label>
                    <span className={`text-sm ${files.length < 2 ? "text-muted-foreground" : "text-pink-400 font-semibold"}`}>
                      {files.length} / 10 selected
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    For "Background + Overlays": the <strong>first image</strong> becomes the background — make it your widest or most atmospheric shot. The rest become polaroid overlays.
                  </p>

                  <div
                    ref={dropRef}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-pink-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-pink-500/60 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                    <p className="text-xs text-pink-400/70 mt-1">Add up to 10 photos — portrait or landscape both work</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />

                  {files.length > 0 && (
                    <div className="grid grid-cols-5 gap-2">
                      {files.map((f, i) => (
                        <div key={i} className="relative group">
                          <img src={previewUrls[i]} alt="" className="w-full aspect-square object-cover rounded-lg" />
                          {i === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5 rounded-b-lg">BG</div>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUploadAndArrange}
                  disabled={uploading || files.length < 2}
                  className="btn-shimmer w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading & arranging…</> : <><Wand2 className="w-5 h-5" /> Upload & Auto-Arrange</>}
                </button>
              </>
            )}

            {/* ── STEP 2: Layout ── */}
            {step === "layout" && (
              <>
                <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                  <Label className="text-base font-semibold">Layout style</Label>
                  <div className="space-y-3">
                    {LAYOUTS.map((l) => (
                      <button key={l.value} onClick={() => setLayout(l.value)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${layout === l.value ? "border-pink-500 bg-pink-500/10" : "border-border/30 bg-accent/20 hover:border-pink-500/40"}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{l.emoji}</span>
                          <div>
                            <p className="font-semibold text-sm">{l.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" onClick={handleReArrange} disabled={arranging} className="w-full gap-2">
                    {arranging ? <><Loader2 className="w-4 h-4 animate-spin" />Re-arranging…</> : <><Wand2 className="w-4 h-4" />Apply Layout</>}
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">← Back</Button>
                  <button onClick={() => setStep("text")}
                    className="btn-shimmer flex-1 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2">
                    Next: Add Text →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3: Text overlays + Global style ── */}
            {step === "text" && (
              <>
                {/* Per-slide text */}
                <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                  <Label className="text-base font-semibold">Text overlays per slide</Label>
                  <p className="text-sm text-muted-foreground">Slide 1 and the last slide have text on by default. Middle slides start clean.</p>
                  {slides.map((slide, i) => (
                    <div key={i} className="border border-border/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Slide {i + 1}</p>
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
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Tagline</Label>
                              <Input value={slide.tagLine} onChange={(e) => setSlideField(i, "tagLine", e.target.value)} placeholder="inspiration" className="h-9 text-sm mt-1" />
                            </div>
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
                          {/* Per-element colour + size overrides */}
                          <details className="group">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">Colour, size &amp; spacing overrides ▸</summary>
                            <div className="mt-2 space-y-3 pl-1">
                              {slide.leadIn && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-muted-foreground/80">Lead-in</Label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input type="color" value={slide.leadInColor ?? textColor} onChange={(e) => setSlideField(i, "leadInColor", e.target.value)} className="w-8 h-6 p-0.5 cursor-pointer rounded border border-border/40 bg-transparent shrink-0" />
                                    {["#ffffff","#000000","#F5EEE3","#E91976","#ffd700"].map(c => (
                                      <button key={c} onClick={() => setSlideField(i, "leadInColor", c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" title={c} />
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Size</Label><span className="text-xs font-mono text-muted-foreground">{slide.leadInFontSize ?? 44}</span></div>
                                      <input type="range" min={20} max={80} step={2} value={slide.leadInFontSize ?? 44} onChange={(e) => setSlideField(i, "leadInFontSize", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Spacing</Label><span className="text-xs font-mono text-muted-foreground">{slide.leadInLetterSpacing ?? 0}</span></div>
                                      <input type="range" min={0} max={10} step={0.5} value={slide.leadInLetterSpacing ?? 0} onChange={(e) => setSlideField(i, "leadInLetterSpacing", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Line height</Label><span className="text-xs font-mono text-muted-foreground">{(slide.leadInLineHeight ?? 1.2).toFixed(1)}</span></div>
                                      <input type="range" min={0.8} max={2.5} step={0.1} value={slide.leadInLineHeight ?? 1.2} onChange={(e) => setSlideField(i, "leadInLineHeight", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {slide.title && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-muted-foreground/80">Title</Label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input type="color" value={slide.titleColor ?? textColor} onChange={(e) => setSlideField(i, "titleColor", e.target.value)} className="w-8 h-6 p-0.5 cursor-pointer rounded border border-border/40 bg-transparent shrink-0" />
                                    {["#ffffff","#000000","#F5EEE3","#E91976","#ffd700"].map(c => (
                                      <button key={c} onClick={() => setSlideField(i, "titleColor", c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" title={c} />
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Size</Label><span className="text-xs font-mono text-muted-foreground">{slide.titleFontSize ?? 76}</span></div>
                                      <input type="range" min={32} max={120} step={2} value={slide.titleFontSize ?? 76} onChange={(e) => setSlideField(i, "titleFontSize", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Spacing</Label><span className="text-xs font-mono text-muted-foreground">{slide.titleLetterSpacing ?? 0}</span></div>
                                      <input type="range" min={0} max={10} step={0.5} value={slide.titleLetterSpacing ?? 0} onChange={(e) => setSlideField(i, "titleLetterSpacing", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Line height</Label><span className="text-xs font-mono text-muted-foreground">{(slide.titleLineHeight ?? 0.88).toFixed(2)}</span></div>
                                      <input type="range" min={0.6} max={2.0} step={0.05} value={slide.titleLineHeight ?? 0.88} onChange={(e) => setSlideField(i, "titleLineHeight", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {slide.tagLine && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-muted-foreground/80">Tagline</Label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input type="color" value={slide.tagLineColor ?? textColor} onChange={(e) => setSlideField(i, "tagLineColor", e.target.value)} className="w-8 h-6 p-0.5 cursor-pointer rounded border border-border/40 bg-transparent shrink-0" />
                                    {["#ffffff","#000000","#F5EEE3","#E91976","#ffd700"].map(c => (
                                      <button key={c} onClick={() => setSlideField(i, "tagLineColor", c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" title={c} />
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Size</Label><span className="text-xs font-mono text-muted-foreground">{slide.tagLineFontSize ?? 40}</span></div>
                                      <input type="range" min={20} max={80} step={2} value={slide.tagLineFontSize ?? 40} onChange={(e) => setSlideField(i, "tagLineFontSize", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Spacing</Label><span className="text-xs font-mono text-muted-foreground">{slide.tagLineLetterSpacing ?? 0}</span></div>
                                      <input type="range" min={0} max={10} step={0.5} value={slide.tagLineLetterSpacing ?? 0} onChange={(e) => setSlideField(i, "tagLineLetterSpacing", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground/70">Line height</Label><span className="text-xs font-mono text-muted-foreground">{(slide.tagLineLineHeight ?? 1.1).toFixed(1)}</span></div>
                                      <input type="range" min={0.8} max={2.5} step={0.1} value={slide.tagLineLineHeight ?? 1.1} onChange={(e) => setSlideField(i, "tagLineLineHeight", Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
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
                    <Label className="text-sm text-muted-foreground">Watermark — e.g. @youraccount</Label>
                    <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="@youraccount" className="h-10" />
                  </div>
                  {/* Logo */}
                  <div className="space-y-2 pt-2 border-t border-border/20">
                    <Label className="text-sm text-muted-foreground">Logo (optional)</Label>
                    {logo ? (
                      <div className="flex items-center gap-3">
                        <img src={logo.dataUrl} alt="Logo" className="h-12 object-contain rounded bg-white/5 p-1" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Size</Label>
                            <span className="text-xs font-mono text-muted-foreground">{Math.round(logo.scale * 100)}%</span>
                          </div>
                          <input type="range" min={0.3} max={3} step={0.05} value={logo.scale} onChange={(e) => setLogo((l) => l ? { ...l, scale: Number(e.target.value) } : l)} className="w-full accent-pink-500 h-1.5" />
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <label>X <input type="range" min={0} max={1} step={0.01} value={logo.x} onChange={(e) => setLogo((l) => l ? { ...l, x: Number(e.target.value) } : l)} className="w-full accent-pink-500 h-1.5 mt-0.5" /></label>
                            <label>Y <input type="range" min={0} max={1} step={0.01} value={logo.y} onChange={(e) => setLogo((l) => l ? { ...l, y: Number(e.target.value) } : l)} className="w-full accent-pink-500 h-1.5 mt-0.5" /></label>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-muted-foreground shrink-0"><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <button onClick={() => logoFileRef.current?.click()}
                        className="w-full border border-dashed border-border/40 rounded-xl py-3 text-sm text-muted-foreground hover:border-pink-500/40 transition-colors flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4" /> Upload logo (PNG with transparency)
                      </button>
                    )}
                    <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("layout")} className="flex-1">← Back</Button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="btn-shimmer flex-1 py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {generating ? <><Loader2 className="w-5 h-5 animate-spin" />Rendering slides…</> : <><Wand2 className="w-5 h-5" />Generate Slides</>}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 4: Result ── */}
            {step === "result" && renderedUrls.length > 0 && (
              <>
                <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{renderedUrls.length} slides ready</Label>
                    <Button variant="outline" size="sm" onClick={() => setStep("text")}>← Edit text</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderedUrls.map((url, i) => (
                      <div key={i} className="relative group cursor-pointer" onClick={() => setLightboxIdx(i)}>
                        <img src={url} alt={`Slide ${i + 1}`} className="w-full aspect-square object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">Slide {i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={downloadZip} className="w-full py-5 text-base font-bold gap-2 rounded-2xl">
                  <Download className="w-5 h-5" /> Download all slides as ZIP
                </Button>

                {presets.length > 1 && (
                  <Select value={selectedPresetId?.toString() ?? ""} onValueChange={(v) => setSelectedPresetId(Number(v))}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select client preset" /></SelectTrigger>
                    <SelectContent>{presets.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleSchedule} className="flex-1 gap-2">
                    <CalendarDays className="w-4 h-4" /> Schedule
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={async () => {
                      if (!renderedUrls.length) { toast.error("Generate slides first"); return; }
                      if (!selectedPresetId) { toast.error("Select a client preset first"); return; }
                      try {
                        const posts = [{
                          title: slides[0]?.title || "Seamless Carousel",
                          imageUrls: renderedUrls,
                          caption: "Seamless carousel",
                        }];
                        const r = await fetch(`${BASE}/api/meta/push`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ posts, presetId: selectedPresetId, postType: "carousel" }),
                        });
                        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || "Post failed"); }
                        toast.success("Posted to Instagram");
                      } catch (e: any) { toast.error(e.message || "Post failed"); }
                    }}
                  >
                    <Send className="w-4 h-4" /> Post to IG
                  </Button>
                </div>

                <Button variant="outline" onClick={() => {
                  setStep("upload");
                  setFiles([]); setPreviewUrls([]); setUploadedUrls([]);
                  setCollageElements([]); setRenderedUrls([]); setCarouselId(null);
                  setSlides([defaultSlide(0), defaultSlide(1), defaultSlide(2)]);
                  setSlideCount(3);
                }} className="w-full">
                  Start over
                </Button>
              </>
            )}
          </div>

          {/* Right panel: live preview */}
          <div className="hidden lg:flex flex-col gap-3 shrink-0 sticky top-24 self-start" style={{ width: PREVIEW_W }}>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground text-center">Preview</p>

            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-muted/20"
              style={{ width: PREVIEW_W, height: PREVIEW_H }}>
              {collageElements.length > 0 ? (
                <div
                  ref={previewRef}
                  className="relative w-full h-full"
                  onPointerMove={onPreviewPointerMove}
                  onPointerUp={onPreviewPointerUp}
                  onPointerLeave={onPreviewPointerUp}
                  style={{ cursor: logoDragging ? "grabbing" : undefined }}
                >
                  {/* CSS-based collage preview — shows the layout at scale */}
                  {[...collageElements].sort((a, b) => a.zIndex - b.zIndex).map((el, i) => {
                    const scaledX = el.x * scale;
                    const scaledY = el.y * scale;
                    const scaledW = el.width * scale;
                    const scaledH = el.height * scale;
                    return (
                      <div key={i} style={{
                        position: "absolute",
                        left: scaledX,
                        top: scaledY,
                        width: scaledW,
                        height: scaledH,
                        transform: `rotate(${el.rotation}deg)`,
                        transformOrigin: "center center",
                        zIndex: el.zIndex,
                        boxShadow: el.hasBorder ? "0 2px 8px rgba(0,0,0,0.4)" : undefined,
                        border: el.hasBorder ? "2px solid white" : undefined,
                        overflow: "hidden",
                        borderRadius: 2,
                        filter: el.isBackground ? "brightness(0.75)" : undefined,
                      }}>
                        <img src={previewUrls[uploadedUrls.indexOf(el.imageUrl)] ?? el.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous" />
                      </div>
                    );
                  })}
                  {/* Slide seam lines */}
                  {Array.from({ length: slideCount - 1 }).map((_, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      left: Math.round((i + 1) * (PREVIEW_W / slideCount)),
                      top: 0,
                      width: 1,
                      height: PREVIEW_H,
                      background: "rgba(255,255,255,0.25)",
                      zIndex: 100,
                    }} />
                  ))}

                  {/* Text overlays per slide */}
                  {slides.map((slide, i) => {
                    if (!slide.hasText || (!slide.title && !slide.leadIn && !slide.tagLine)) return null;
                    const slideW = PREVIEW_W / slideCount;
                    const slideLeft = i * slideW;
                    const pos = slide.position ?? "bottom-left";
                    const isLeft = pos.includes("left") || pos === "center";
                    const isTop = pos.includes("top");
                    const isCenter = pos === "center";
                    const titleFs = Math.round((slide.titleFontSize ?? 76) * scale);
                    const leadFs = Math.round((slide.leadInFontSize ?? 44) * scale);
                    const tagFs = Math.round((slide.tagLineFontSize ?? 40) * scale);
                    return (
                      <div key={i} style={{
                        position: "absolute",
                        left: slideLeft + (isCenter ? 0 : isLeft ? slideW * 0.07 : undefined as any),
                        right: !isLeft && !isCenter ? (PREVIEW_W - slideLeft - slideW) + slideW * 0.07 : undefined,
                        width: isCenter ? slideW : undefined,
                        top: isTop ? PREVIEW_H * 0.09 : undefined,
                        bottom: !isTop ? PREVIEW_H * 0.11 : undefined,
                        zIndex: 200,
                        textAlign: isCenter ? "center" : isLeft ? "left" : "right",
                        pointerEvents: "none",
                      }}>
                        {slide.leadIn && (
                          <div style={{ fontFamily: `'${scriptFont}', cursive`, fontSize: leadFs, color: slide.leadInColor ?? textColor, textShadow: "0 1px 3px rgba(0,0,0,0.6)", lineHeight: slide.leadInLineHeight ?? 1.2, letterSpacing: slide.leadInLetterSpacing ?? 0, whiteSpace: "nowrap" }}>
                            {slide.leadIn}
                          </div>
                        )}
                        {slide.title && (
                          <div style={{ fontFamily: `'${scriptFont}', cursive`, fontSize: titleFs, color: slide.titleColor ?? textColor, textShadow: "0 1px 4px rgba(0,0,0,0.7)", lineHeight: slide.titleLineHeight ?? 1.1, letterSpacing: slide.titleLetterSpacing ?? 0, whiteSpace: "nowrap" }}>
                            {slide.title}
                          </div>
                        )}
                        {slide.tagLine && (
                          <div style={{ fontFamily: `'${scriptFont}', cursive`, fontSize: tagFs, color: slide.tagLineColor ?? textColor, textShadow: "0 1px 3px rgba(0,0,0,0.6)", lineHeight: slide.tagLineLineHeight ?? 1.2, letterSpacing: slide.tagLineLetterSpacing ?? 0, whiteSpace: "nowrap", opacity: 0.85 }}>
                            {slide.tagLine}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Logo overlay in preview — draggable */}
                  {logo && Array.from({ length: slideCount }).map((_, i) => {
                    const slideW = PREVIEW_W / slideCount;
                    const logoH = Math.round(PREVIEW_H * 0.12 * logo.scale);
                    const logoW = Math.round(logoH * logo.ar);
                    return (
                      <img
                        key={i}
                        src={logo.dataUrl}
                        alt="logo"
                        onPointerDown={i === 0 ? startLogoDrag : undefined}
                        style={{
                          position: "absolute",
                          left: i * slideW + logo.x * slideW - logoW / 2,
                          top: logo.y * PREVIEW_H - logoH / 2,
                          width: logoW,
                          height: logoH,
                          objectFit: "contain",
                          opacity: 0.85,
                          zIndex: 210,
                          cursor: i === 0 ? (logoDragging ? "grabbing" : "grab") : "default",
                          userSelect: "none",
                          touchAction: "none",
                        }}
                      />
                    );
                  })}
                </div>
              ) : previewUrls.length > 0 ? (
                <div className="flex h-full">
                  {previewUrls.slice(0, Math.min(previewUrls.length, 3)).map((url, i) => (
                    <div key={i} className="flex-1 relative overflow-hidden border-r border-white/10 last:border-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full">
                  {Array.from({ length: slideCount }).map((_, i) => (
                    <div key={i} className="flex-1 bg-muted/30 border-r border-white/10 last:border-0 flex items-center justify-center">
                      <span className="text-muted-foreground/40 text-sm font-bold">{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center leading-snug">
              {collageElements.length > 0
                ? `${collageElements.length} elements arranged — white lines show slide seams`
                : "Upload photos to see the collage preview"}
            </p>

            {renderedUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-center text-pink-400">Rendered slides</p>
                <div className="flex gap-1 rounded-xl overflow-hidden ring-1 ring-white/10">
                  {renderedUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Slide ${i + 1}`}
                      className="flex-1 aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxIdx(i)} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">Click to view full size</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
