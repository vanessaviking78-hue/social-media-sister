import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Upload, ImagePlus, BookOpen, Film, Palette, MessageSquareText,
  CalendarDays, BarChart3, Loader2, Download, Grid, User,
  X, ZoomIn, Send, Music, Check, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";
import { CAROUSEL_TEMPLATES, TEMPLATE_STYLE_IDS } from "@/lib/carousel-templates";

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

type PhotoPlacement = { panX: number; panY: number; zoom: number };
type DragState = { slideIdx: number; startX: number; startY: number; startPanX: number; startPanY: number };
type Step = "template" | "upload" | "arrange" | "text" | "result";

function defaultSlide(i: number): SlideConfig {
  return { hasText: i === 0, title: "", leadIn: "", tagLine: "", doodle: "none", position: "bottom-left" };
}

function defaultPlacement(): PhotoPlacement {
  return { panX: 0.5, panY: 0.5, zoom: 1.0 };
}

const PREVIEW_TILE = 300;

export default function SeamlessCarouselPage() {
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [slideCount, setSlideCount] = useState(3);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [collageElements, setCollageElements] = useState<CollageElement[]>([]);
  const [placements, setPlacements] = useState<PhotoPlacement[]>([defaultPlacement(), defaultPlacement(), defaultPlacement()]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slides, setSlides] = useState<SlideConfig[]>([defaultSlide(0), defaultSlide(1), defaultSlide(2)]);
  const [scriptFont, setScriptFont] = useState("Allura");
  const [textColor, setTextColor] = useState("#ffffff");
  const [watermark, setWatermark] = useState("");
  const [carouselId, setCarouselId] = useState<number | null>(null);
  const [renderedUrls, setRenderedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [logo, setLogo] = useState<LogoState | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [firstComment, setFirstComment] = useState("");
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [presets, setPresets] = useState<{ id: number; name: string }[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const [logoDragStart, setLogoDragStart] = useState<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const arrangePanelRef = useRef<HTMLDivElement>(null);

  const isTemplateStyle = TEMPLATE_STYLE_IDS.has(selectedTemplate);
  const currentTemplate = CAROUSEL_TEMPLATES.find(t => t.id === selectedTemplate);
  const needsPhoto = currentTemplate?.needsPhoto ?? true;

  useEffect(() => {
    fetch(`${BASE}/api/presets`).then(r => r.json()).then(d => {
      const list = Array.isArray(d?.presets) ? d.presets : Array.isArray(d) ? d : [];
      setPresets(list.map((p: any) => ({ id: p.id, name: p.name })));
      if (list.length === 1) setSelectedPresetId(list[0].id);
    }).catch(() => {});
  }, []);

  const handleSlideCountChange = (n: number) => {
    setSlideCount(n);
    setSlides(prev => {
      const next = [...prev];
      while (next.length < n) next.push(defaultSlide(next.length));
      return next.slice(0, n);
    });
    setPlacements(prev => {
      const next = [...prev];
      while (next.length < n) next.push(defaultPlacement());
      return next.slice(0, n);
    });
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter(f => f.type.startsWith("image/"));
    const max = isTemplateStyle ? slideCount : 10;
    const combined = [...files, ...imgs].slice(0, max);
    setFiles(combined);
    setPreviewUrls(combined.map(f => URL.createObjectURL(f)));
    setUploadedUrls([]);
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviewUrls(next.map(f => URL.createObjectURL(f)));
    setUploadedUrls([]);
    setCollageElements([]);
    setRenderedUrls([]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (dropped.length) addFiles(dropped);
  }, [files, isTemplateStyle, slideCount]);

  const setSlideField = (i: number, field: keyof SlideConfig, val: string | boolean | number) => {
    setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const handleLogoFile = async (file: File) => {
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.onload = () => setLogo({ dataUrl, storedUrl: "", ar: img.naturalWidth / img.naturalHeight, x: 0.5, y: 0.88, scale: 1, rotation: 0 });
    img.src = dataUrl;
  };

  const uploadLogoToServer = async (dataUrl: string): Promise<string> => {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const fd = new FormData(); fd.append("logo", blob, "logo.png");
    const r = await fetch(`${BASE}/api/seamless/upload-logo`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("Logo upload failed");
    const { logoUrl } = await r.json() as { logoUrl: string };
    return logoUrl;
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplate(id);
    setFiles([]);
    setPreviewUrls([]);
    setUploadedUrls([]);
    setCollageElements([]);
    setRenderedUrls([]);
    setCarouselId(null);
    setStep("upload");
  };

  // Upload and arrange (upload step → arrange step)
  const handleUploadAndArrange = async () => {
    if (!needsPhoto) {
      const elements = Array.from({ length: slideCount }, (_, i) => ({
        imageUrl: "", x: 0, y: 0, width: 1080, height: 1080,
        rotation: 0, zIndex: i, hasBorder: false, isBackground: false,
      }));
      setCollageElements(elements);
      setPlacements(Array.from({ length: slideCount }, defaultPlacement));
      setStep("arrange");
      return;
    }
    const minFiles = isTemplateStyle ? 1 : 2;
    if (files.length < minFiles) {
      toast.error(isTemplateStyle ? "Upload at least one photo" : "Upload at least 2 photos");
      return;
    }
    setUploading(true);
    const toastId = toast.loading("Uploading photos…");
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("images", f, f.name));
      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/upload`, { method: "POST", body: fd });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { urls } = await uploadResp.json() as { urls: string[] };
      setUploadedUrls(urls);

      if (isTemplateStyle) {
        const elements = Array.from({ length: slideCount }, (_, i) => ({
          imageUrl: urls[i % urls.length],
          x: 0, y: 0, width: 1080, height: 1080,
          rotation: 0, zIndex: i, hasBorder: false, isBackground: true,
        }));
        setCollageElements(elements);
        setPlacements(Array.from({ length: slideCount }, defaultPlacement));
        toast.success("Photos uploaded — now adjust framing", { id: toastId });
        setStep("arrange");
      } else {
        toast.loading("Arranging collage…", { id: toastId });
        const arrResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/auto-arrange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideCount, layoutStyle: selectedTemplate, imageUrls: urls }),
        });
        if (!arrResp.ok) throw new Error("Auto-arrange failed");
        const { elements } = await arrResp.json() as { elements: CollageElement[] };
        setCollageElements(elements);
        toast.success("Images arranged — check the preview", { id: toastId });
        setStep("arrange");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Arrange step → Text step: bake placement state into collage elements
  const handleArrangeContinue = () => {
    if (isTemplateStyle && uploadedUrls.length > 0) {
      const S = 1080;
      const elements = Array.from({ length: slideCount }, (_, i) => {
        const p = placements[i] ?? defaultPlacement();
        const photoW = Math.round(S * p.zoom);
        const photoH = Math.round(S * p.zoom);
        const x = Math.round(540 - p.panX * photoW);
        const y = Math.round(540 - p.panY * photoH);
        return {
          imageUrl: uploadedUrls[i % uploadedUrls.length],
          x, y, width: photoW, height: photoH,
          rotation: 0, zIndex: i, hasBorder: false, isBackground: true,
        };
      });
      setCollageElements(elements);
    }
    setStep("text");
  };

  // Drag handlers for per-slide photo pan
  const handleSlidePointerDown = (e: React.PointerEvent, slideIdx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = placements[slideIdx] ?? defaultPlacement();
    setDragState({ slideIdx, startX: e.clientX, startY: e.clientY, startPanX: p.panX, startPanY: p.panY });
  };

  const handleArrangePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const p = placements[dragState.slideIdx] ?? defaultPlacement();
    const panScale = PREVIEW_TILE * p.zoom;
    const dx = (e.clientX - dragState.startX) / panScale;
    const dy = (e.clientY - dragState.startY) / panScale;
    const newPanX = Math.max(0, Math.min(1, dragState.startPanX - dx));
    const newPanY = Math.max(0, Math.min(1, dragState.startPanY - dy));
    setPlacements(prev => prev.map((pl, i) => i === dragState.slideIdx ? { ...pl, panX: newPanX, panY: newPanY } : pl));
  };

  const handleArrangePointerUp = () => setDragState(null);

  const setPlacementZoom = (slideIdx: number, zoom: number) => {
    setPlacements(prev => prev.map((p, i) => i === slideIdx ? { ...p, zoom } : p));
  };

  const resetPlacement = (slideIdx: number) => {
    setPlacements(prev => prev.map((p, i) => i === slideIdx ? defaultPlacement() : p));
  };

  // Final render
  const handleGenerate = async () => {
    setGenerating(true);
    const toastId = toast.loading("Saving & rendering slides…");
    try {
      let logoStoredUrl = logo?.storedUrl ?? "";
      if (logo && logo.dataUrl && !logo.storedUrl) {
        try {
          logoStoredUrl = await uploadLogoToServer(logo.dataUrl);
          setLogo(l => l ? { ...l, storedUrl: logoStoredUrl } : l);
        } catch {
          toast.error("Logo upload failed — continuing without logo");
        }
      }
      const saveBody = {
        slideCount,
        layoutStyle: selectedTemplate,
        uploadedImageUrls: uploadedUrls,
        collageElements,
        slides,
        scriptFont,
        textColor,
        watermark,
        logoConfig: logo ? { logoUrl: logoStoredUrl, x: logo.x, y: logo.y, scale: logo.scale, rotation: logo.rotation } : null,
        musicTrack: musicTrack || null,
      };
      let id = carouselId;
      if (id) {
        const r = await fetch(`${import.meta.env.BASE_URL}api/seamless/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saveBody) });
        if (!r.ok) throw new Error("Update failed");
      } else {
        const r = await fetch(`${import.meta.env.BASE_URL}api/seamless`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saveBody) });
        if (!r.ok) throw new Error("Create failed");
        const created = await r.json() as { id: number };
        id = created.id;
        setCarouselId(id);
      }
      toast.loading("Rendering slides — hang on a moment…", { id: toastId });
      const renderResp = await fetch(`${import.meta.env.BASE_URL}api/seamless/${id}/render`, { method: "POST" });
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
      saveAs(content, "carousel.zip");
      toast.success("Download started", { id });
    } catch { toast.error("Download failed", { id }); }
  };

  const handleSchedule = () => {
    if (!renderedUrls.length) { toast.error("Generate slides first"); return; }
    setSchedulePosts([{ title: slides[0]?.title || "Seamless Carousel", caption: "", imageUrls: renderedUrls, musicTrack: musicTrack || undefined, firstComment: firstComment || undefined }]);
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
    setLogo(l => l ? { ...l, x: Math.max(0, Math.min(1, logoDragStart.ox + dx)), y: Math.max(0, Math.min(1, logoDragStart.oy + dy)) } : l);
  };

  const onPreviewPointerUp = () => { setLogoDragging(false); setLogoDragStart(null); };

  // Collage preview scale (for seamless layout preview)
  const PREVIEW_W = 320;
  const TOTAL_CANVAS_W = 1080 * slideCount;
  const scale = PREVIEW_W / TOTAL_CANVAS_W;
  const PREVIEW_H = Math.round(1080 * scale);

  const STEP_LABELS = ["1. Style", "2. Upload", "3. Arrange", "4. Text", "5. Result"];
  const STEPS: Step[] = ["template", "upload", "arrange", "text", "result"];

  const templateCategories = [
    { key: "template" as const, label: "Slide Templates" },
    { key: "seamless" as const, label: "Seamless Bridging" },
  ];

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      <MusicPickerModal open={musicPickerOpen} onClose={() => setMusicPickerOpen(false)} selectedTrack={musicTrack} onSelect={t => setMusicTrack(t)} />
      {scheduleOpen && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={presets.find(p => p.id === selectedPresetId)?.name ?? ""}
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
              <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 1) - 1); }} className="text-white/60 hover:text-white text-3xl px-3">‹</button>
            )}
            <img src={renderedUrls[lightboxIdx]} alt={`Slide ${lightboxIdx + 1}`} className="max-h-[85vh] max-w-[80vw] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
            {lightboxIdx < renderedUrls.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 0) + 1); }} className="text-white/60 hover:text-white text-3xl px-3">›</button>
            )}
          </div>
          <p className="absolute bottom-6 text-white/50 text-sm">{lightboxIdx + 1} / {renderedUrls.length} — click outside to close</p>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/hub"><Button variant="ghost" size="sm" className="text-muted-foreground">← Home</Button></Link>
          <Link href="/carousel"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Carousel</Button></Link>
          <Link href="/reels"><Button variant="ghost" size="sm" className="text-muted-foreground"><Film className="w-4 h-4 mr-1" />Reels</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-1" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-1" />Captions</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-1" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-1" />Analytics</Button></Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className="mb-8">
          <h1 className="font-sans font-bold text-4xl tracking-tight mb-2 flex items-center gap-3">
            <Grid className="w-9 h-9 text-pink-400" /> Carousel Creator
          </h1>
          <p className="text-lg text-muted-foreground">
            {step === "template"
              ? "Pick a style and the tool builds your slides around it."
              : `${currentTemplate?.name ?? "Carousel"} — ${currentTemplate?.desc ?? ""}`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const active = step === s;
            const done = STEPS.indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${active ? "bg-pink-500 text-white" : done ? "bg-pink-500/20 text-pink-400" : "bg-muted/40 text-muted-foreground"}`}>
                  {STEP_LABELS[i]}
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border/30" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── STEP 0: TEMPLATE PICKER (full width) ── */}
        {step === "template" && (
          <div className="space-y-10">
            {templateCategories.map(cat => (
              <div key={cat.key}>
                <h2 className="text-xl font-semibold mb-1">{cat.label}</h2>
                {cat.key === "seamless" && (
                  <p className="text-sm text-muted-foreground mb-4">One continuous image bridge across all slide seams — upload 5-10 photos and they flow together.</p>
                )}
                {cat.key === "template" && (
                  <p className="text-sm text-muted-foreground mb-4">Each slide is styled individually. Upload one photo per slide.</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {CAROUSEL_TEMPLATES.filter(t => t.category === cat.key).map(tpl => {
                    const selected = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={`group relative rounded-2xl overflow-hidden text-left transition-all duration-200 focus:outline-none ${selected ? "ring-4 ring-pink-500 shadow-lg shadow-pink-500/25" : "ring-1 ring-border/20 hover:ring-2 hover:ring-pink-400/50 hover:shadow-md"}`}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-48 w-full overflow-hidden">
                          <img
                            src={import.meta.env.BASE_URL.replace(/\/$/, "") + tpl.thumb}
                            alt={tpl.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                          {selected && (
                            <div className="absolute top-3 right-3 w-7 h-7 bg-pink-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="bg-card p-3">
                          <p className="font-semibold text-sm leading-tight">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{tpl.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedTemplate && (
              <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/30 p-4 flex justify-center z-40">
                <Button size="lg" className="bg-pink-500 hover:bg-pink-600 text-white px-10" onClick={() => setStep("upload")}>
                  Continue with {currentTemplate?.name} →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEPS 1-4: Upload / Arrange / Text / Result (left + right panel) ── */}
        {step !== "template" && (
          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0 space-y-6">

              {/* ── STEP 1: Upload ── */}
              {step === "upload" && (
                <>
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Number of slides</Label>
                      <button onClick={() => setStep("template")} className="text-xs text-muted-foreground hover:text-pink-400 transition-colors">
                        ← Change style
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[3, 4, 5, 6, 7].map(n => (
                        <button key={n} onClick={() => handleSlideCountChange(n)}
                          className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${slideCount === n ? "bg-pink-500 text-white border-pink-500" : "bg-card border-border/30 hover:border-pink-400/50"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {isTemplateStyle && (
                      <p className="text-xs text-muted-foreground">
                        {needsPhoto
                          ? `Upload up to ${slideCount} photos — one per slide. If you upload fewer, photos repeat across slides.`
                          : "This style uses text only — no photos needed."}
                      </p>
                    )}
                    {!isTemplateStyle && (
                      <p className="text-xs text-muted-foreground">Upload 5-10 photos — they'll flow together across slide seams.</p>
                    )}
                  </div>

                  {needsPhoto && (
                    <div
                      ref={dropRef}
                      onDrop={handleDrop}
                      onDragOver={e => e.preventDefault()}
                      className="rounded-2xl border-2 border-dashed border-border/40 bg-card/30 p-8 text-center hover:border-pink-400/50 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                      <p className="font-semibold mb-1">Drop photos here or click to browse</p>
                      <p className="text-sm text-muted-foreground">
                        {isTemplateStyle ? `Up to ${slideCount} photos` : "5-10 photos recommended"}
                      </p>
                    </div>
                  )}

                  {previewUrls.length > 0 && (
                    <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
                      <p className="font-semibold text-sm mb-3">{previewUrls.length} photo{previewUrls.length !== 1 ? "s" : ""} selected</p>
                      <div className="flex flex-wrap gap-3">
                        {previewUrls.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                            {isTemplateStyle && (
                              <div className="absolute top-1 left-1 bg-black/60 text-white text-xs rounded px-1 py-0.5">
                                {i < slideCount ? `Slide ${i + 1}` : "Extra"}
                              </div>
                            )}
                            <button onClick={() => removeFile(i)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {needsPhoto && (
                          <button onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center hover:border-pink-400/50 transition-colors">
                            <ImagePlus className="w-5 h-5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <Button size="lg" className="w-full bg-pink-500 hover:bg-pink-600 text-white" onClick={handleUploadAndArrange} disabled={uploading || (needsPhoto && files.length === 0)}>
                    {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : needsPhoto ? "Upload & Continue →" : "Continue to Text →"}
                  </Button>
                </>
              )}

              {/* ── STEP 2: Arrange ── */}
              {step === "arrange" && (
                <>
                  {isTemplateStyle && needsPhoto ? (
                    <div
                      ref={arrangePanelRef}
                      onPointerMove={handleArrangePointerMove}
                      onPointerUp={handleArrangePointerUp}
                    >
                      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
                        <div>
                          <h2 className="text-lg font-semibold mb-1">Adjust your photos</h2>
                          <p className="text-sm text-muted-foreground">Drag each photo to reposition it within the frame. Use the zoom slider to crop in tighter.</p>
                        </div>

                        {/* Slide selector tabs */}
                        <div className="flex gap-2 flex-wrap">
                          {Array.from({ length: slideCount }, (_, i) => (
                            <button key={i} onClick={() => setActiveSlide(i)}
                              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${activeSlide === i ? "bg-pink-500 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                              Slide {i + 1}
                            </button>
                          ))}
                        </div>

                        {/* Active slide photo crop editor */}
                        {Array.from({ length: slideCount }, (_, slideIdx) => {
                          if (slideIdx !== activeSlide) return null;
                          const p = placements[slideIdx] ?? defaultPlacement();
                          const photoUrl = previewUrls[slideIdx % previewUrls.length] ?? previewUrls[0];
                          const photoW = PREVIEW_TILE * p.zoom;
                          const photoH = PREVIEW_TILE * p.zoom;
                          const photoLeft = 150 - p.panX * photoW;
                          const photoTop = 150 - p.panY * photoH;

                          return (
                            <div key={slideIdx} className="space-y-4">
                              <div className="flex justify-center">
                                <div
                                  className="relative bg-muted rounded-xl overflow-hidden cursor-move select-none"
                                  style={{ width: PREVIEW_TILE, height: PREVIEW_TILE }}
                                >
                                  {photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={`Slide ${slideIdx + 1}`}
                                      className="absolute pointer-events-none"
                                      style={{ width: photoW, height: photoH, left: photoLeft, top: photoTop, objectFit: "cover" }}
                                      onPointerDown={e => handleSlidePointerDown(e, slideIdx)}
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No photo</div>
                                  )}

                                  {/* Template style label overlay */}
                                  <div className="absolute bottom-2 left-2 right-2 bg-black/50 rounded-lg p-2 pointer-events-none">
                                    <p className="text-white text-xs text-center font-medium">{currentTemplate?.name}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Zoom slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Zoom</Label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{Math.round(p.zoom * 100)}%</span>
                                    <button onClick={() => resetPlacement(slideIdx)} className="text-xs text-muted-foreground hover:text-pink-400 flex items-center gap-1 transition-colors">
                                      <RotateCcw className="w-3 h-3" /> Reset
                                    </button>
                                  </div>
                                </div>
                                <Slider
                                  min={100} max={300} step={5}
                                  value={[Math.round(p.zoom * 100)]}
                                  onValueChange={([v]) => setPlacementZoom(slideIdx, v / 100)}
                                />
                              </div>

                              {/* Photo source selector (which uploaded photo for this slide) */}
                              {previewUrls.length > 1 && (
                                <div className="space-y-2">
                                  <Label className="text-sm">Photo for this slide</Label>
                                  <div className="flex gap-2 flex-wrap">
                                    {previewUrls.slice(0, slideCount).map((url, pi) => (
                                      <button key={pi} onClick={() => {
                                        setCollageElements(prev => prev.map((el, i) => i === slideIdx ? { ...el, imageUrl: uploadedUrls[pi] ?? el.imageUrl } : el));
                                        setPlacements(prev => prev.map((pl, i) => i === slideIdx ? defaultPlacement() : pl));
                                      }}
                                        className={`relative rounded-lg overflow-hidden ${collageElements[slideIdx]?.imageUrl === (uploadedUrls[pi] ?? "") ? "ring-2 ring-pink-500" : "opacity-60 hover:opacity-100"}`}>
                                        <img src={url} alt="" className="w-14 h-14 object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Navigation between slides */}
                        <div className="flex justify-between pt-2">
                          <Button variant="outline" size="sm" onClick={() => setActiveSlide(i => Math.max(0, i - 1))} disabled={activeSlide === 0}>
                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                          </Button>
                          {activeSlide < slideCount - 1 ? (
                            <Button variant="outline" size="sm" onClick={() => setActiveSlide(i => Math.min(slideCount - 1, i + 1))}>
                              Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          ) : (
                            <Button size="sm" className="bg-pink-500 hover:bg-pink-600 text-white" onClick={handleArrangeContinue}>
                              Add text →
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* All slides at a glance */}
                      <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
                        <p className="font-semibold text-sm mb-3">All slides</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {Array.from({ length: slideCount }, (_, i) => {
                            const p = placements[i] ?? defaultPlacement();
                            const url = previewUrls[i % previewUrls.length] ?? previewUrls[0];
                            const sz = 90;
                            const photoW = sz * p.zoom;
                            const photoLeft = sz / 2 - p.panX * photoW;
                            const photoTop = sz / 2 - p.panY * photoW;
                            return (
                              <button key={i} onClick={() => setActiveSlide(i)}
                                className={`relative flex-shrink-0 rounded-xl overflow-hidden transition-all ${activeSlide === i ? "ring-2 ring-pink-500" : "ring-1 ring-border/20 opacity-70 hover:opacity-100"}`}
                                style={{ width: sz, height: sz }}>
                                {url && <img src={url} alt="" className="absolute pointer-events-none" style={{ width: photoW, height: photoW, left: photoLeft, top: photoTop, objectFit: "cover" }} />}
                                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs rounded px-1">{i + 1}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Button size="lg" className="w-full bg-pink-500 hover:bg-pink-600 text-white" onClick={handleArrangeContinue}>
                        Looks good, add text →
                      </Button>
                    </div>
                  ) : (
                    /* Seamless layout arrange view */
                    <>
                      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Collage preview</h2>
                        <p className="text-sm text-muted-foreground">Your photos are arranged across the canvas. The preview below shows how they bridge across slide seams.</p>
                        <div
                          ref={previewRef}
                          className="relative overflow-hidden rounded-xl bg-muted select-none"
                          style={{ width: PREVIEW_W, height: PREVIEW_H }}
                          onPointerMove={onPreviewPointerMove}
                          onPointerUp={onPreviewPointerUp}
                        >
                          {collageElements.map((el, i) => {
                            const elLeft = el.x * scale;
                            const elTop = el.y * scale;
                            const elW = el.width * scale;
                            const elH = el.height * scale;
                            return (
                              <div key={i} className="absolute" style={{ left: elLeft, top: elTop, width: elW, height: elH, transform: `rotate(${el.rotation}deg)`, zIndex: el.zIndex }}>
                                <img src={el.imageUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: el.hasBorder ? 4 : 0, border: el.hasBorder ? "2px solid white" : "none" }} />
                              </div>
                            );
                          })}
                          {logo && (
                            <img src={logo.dataUrl} alt="Logo"
                              className="absolute cursor-move"
                              style={{ left: `${logo.x * 100}%`, top: `${logo.y * 100}%`, height: `${logo.scale * 8}%`, transform: "translate(-50%, -50%)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))", zIndex: 99 }}
                              onPointerDown={startLogoDrag}
                            />
                          )}
                        </div>
                      </div>
                      <Button size="lg" className="w-full bg-pink-500 hover:bg-pink-600 text-white" onClick={() => setStep("text")}>
                        Add text →
                      </Button>
                    </>
                  )}
                </>
              )}

              {/* ── STEP 3: Text ── */}
              {step === "text" && (
                <>
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Global settings</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm">Font</Label>
                        <Select value={scriptFont} onValueChange={setScriptFont}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Script", "Serif", "Sans"].map(cat => (
                              <React.Fragment key={cat}>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-semibold uppercase tracking-wide">{cat}</div>
                                {SCRIPT_FONTS.filter(f => f.cat === cat).map(f => (
                                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Text colour</Label>
                        <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-9 w-full rounded-md border border-border/30 bg-card cursor-pointer" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Watermark (optional)</Label>
                      <Input placeholder="e.g. @yourbrand" value={watermark} onChange={e => setWatermark(e.target.value)} />
                    </div>
                  </div>

                  {/* Per-slide text */}
                  <div className="space-y-4">
                    {slides.map((slide, i) => (
                      <div key={i} className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Slide {i + 1}</h3>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-muted-foreground">Add text</span>
                            <div className={`w-10 h-5 rounded-full transition-colors relative ${slide.hasText ? "bg-pink-500" : "bg-muted"}`}
                              onClick={() => setSlideField(i, "hasText", !slide.hasText)}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${slide.hasText ? "translate-x-5" : "translate-x-0.5"}`} />
                            </div>
                          </label>
                        </div>
                        {slide.hasText && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Heading</Label>
                              <Input placeholder="Main heading…" value={slide.title} onChange={e => setSlideField(i, "title", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Body text</Label>
                              <Input placeholder="Supporting text…" value={slide.tagLine} onChange={e => setSlideField(i, "tagLine", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Sub-text (smaller, below)</Label>
                              <Input placeholder="Optional sub-text…" value={slide.leadIn} onChange={e => setSlideField(i, "leadIn", e.target.value)} />
                            </div>
                            {!isTemplateStyle && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Position</Label>
                                  <Select value={slide.position} onValueChange={v => setSlideField(i, "position", v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Doodle</Label>
                                  <Select value={slide.doodle} onValueChange={v => setSlideField(i, "doodle", v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{DOODLES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Logo */}
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                    <h3 className="font-semibold text-sm">Logo (optional)</h3>
                    <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoFile(e.target.files[0]); }} />
                    {logo ? (
                      <div className="flex items-center gap-3">
                        <img src={logo.dataUrl} alt="Logo" className="h-10 object-contain rounded" />
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs text-muted-foreground">Scale</Label>
                          <Slider min={30} max={200} step={5} value={[Math.round(logo.scale * 100)]} onValueChange={([v]) => setLogo(l => l ? { ...l, scale: v / 100 } : l)} />
                        </div>
                        <button onClick={() => setLogo(null)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => logoFileRef.current?.click()}>
                        <ImagePlus className="w-4 h-4 mr-2" /> Add logo
                      </Button>
                    )}
                  </div>

                  {/* Music */}
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                    <h3 className="font-semibold text-sm">Music (optional)</h3>
                    {musicTrack ? (
                      <div className="flex items-center gap-2">
                        <MusicTrackBadge track={musicTrack} onRemove={() => setMusicTrack(null)} />
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setMusicPickerOpen(true)}>
                        <Music className="w-4 h-4 mr-2" /> Pick music
                      </Button>
                    )}
                  </div>

                  <Button size="lg" className="w-full bg-pink-500 hover:bg-pink-600 text-white" onClick={handleGenerate} disabled={generating}>
                    {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering slides…</> : "Generate slides →"}
                  </Button>
                </>
              )}

              {/* ── STEP 4: Result ── */}
              {step === "result" && (
                <>
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
                    <h2 className="text-lg font-semibold mb-4">Your slides are ready</h2>
                    <div className="grid grid-cols-3 gap-3">
                      {renderedUrls.map((url, i) => (
                        <button key={i} onClick={() => setLightboxIdx(i)} className="relative rounded-xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                          <img src={url} alt={`Slide ${i + 1}`} className="w-full aspect-square object-cover" />
                          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs rounded px-1">{i + 1}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                    <h3 className="font-semibold text-sm">First comment (optional)</h3>
                    <Input placeholder="Caption or first comment…" value={firstComment} onChange={e => setFirstComment(e.target.value)} />
                  </div>

                  {/* Preset */}
                  {presets.length > 0 && (
                    <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                      <h3 className="font-semibold text-sm">Post as</h3>
                      <Select value={selectedPresetId?.toString() ?? ""} onValueChange={v => setSelectedPresetId(Number(v))}>
                        <SelectTrigger><SelectValue placeholder="Select account…" /></SelectTrigger>
                        <SelectContent>{presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    <Button variant="outline" className="flex-1" onClick={downloadZip}>
                      <Download className="w-4 h-4 mr-2" /> Download ZIP
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setMusicPickerOpen(true)}>
                      <Music className="w-4 h-4 mr-2" /> {musicTrack ? "Change music" : "Add music"}
                    </Button>
                    <Button className="flex-1 bg-pink-500 hover:bg-pink-600 text-white" onClick={handleSchedule}>
                      <Send className="w-4 h-4 mr-2" /> Schedule / Post
                    </Button>
                  </div>

                  <button onClick={() => { setStep("template"); setSelectedTemplate(""); setFiles([]); setPreviewUrls([]); setUploadedUrls([]); setCollageElements([]); setRenderedUrls([]); setCarouselId(null); }}
                    className="text-sm text-muted-foreground hover:text-pink-400 transition-colors w-full text-center pt-2">
                    Start a new carousel
                  </button>
                </>
              )}
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="w-72 flex-shrink-0 space-y-4 sticky top-24">
              <div className="rounded-2xl border border-border/30 bg-card/50 p-4 space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Style</p>
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={import.meta.env.BASE_URL.replace(/\/$/, "") + (currentTemplate?.thumb ?? "/carousel-templates/full-fade.jpg")}
                    alt={currentTemplate?.name ?? ""}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <p className="absolute bottom-3 left-3 text-white font-semibold text-sm">{currentTemplate?.name}</p>
                </div>
                <button onClick={() => setStep("template")} className="text-xs text-muted-foreground hover:text-pink-400 transition-colors w-full text-center">
                  ← Change style
                </button>
              </div>

              {step === "result" && renderedUrls.length > 0 && (
                <div className="rounded-2xl border border-border/30 bg-card/50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Preview</p>
                  <div className="space-y-2">
                    {renderedUrls.slice(0, 4).map((url, i) => (
                      <button key={i} onClick={() => setLightboxIdx(i)} className="block w-full rounded-lg overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                        <img src={url} alt="" className="w-full aspect-square object-cover" />
                      </button>
                    ))}
                    {renderedUrls.length > 4 && (
                      <p className="text-xs text-muted-foreground text-center">+{renderedUrls.length - 4} more — click a slide to view all</p>
                    )}
                  </div>
                </div>
              )}

              {step !== "result" && previewUrls.length > 0 && (
                <div className="rounded-2xl border border-border/30 bg-card/50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Photos uploaded</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {previewUrls.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
