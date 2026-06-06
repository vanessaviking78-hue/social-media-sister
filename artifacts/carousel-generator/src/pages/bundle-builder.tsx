import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Package, ArrowLeft, Sparkles, Loader2, Copy, Check, ExternalLink,
  Shuffle, BookOpen, Inbox, ImagePlus, X, Upload, RefreshCw, Dices,
  ChevronRight, ChevronLeft, Image as ImageIcon, User, Film, Grid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VoiceStyleSelector from "@/components/voice-style-selector";
import { toast } from "sonner";
import { authHeaders } from "@/lib/use-approval";
import { usePresets } from "@/lib/use-presets";
import type { ClientPreset } from "@/lib/use-presets";
import {
  loadGoogleFonts, drawSlide, drawStory,
  CANVAS_WIDTH, CANVAS_HEIGHT, STORY_WIDTH, STORY_HEIGHT,
} from "@/lib/slide-utils";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL || "/";
function api(path: string) { return `${BASE}api/${path}`; }

// ─── types ──────────────────────────────────────────────────────────────────

interface Topic { id: number; topic: string; }
interface BundleSlide { heading: string; body?: string; }
interface BundleContent {
  carousel: { slides: BundleSlide[]; caption: string };
  aboutMe: { intro: string; caption: string };
  reel: { script: string; caption: string };
  seamless: { tagline: string; caption: string };
}
interface PieceSource { topic: string; captionUsed: boolean; }
interface PickAndMixSources {
  carousel: PieceSource; aboutMe: PieceSource; reel: PieceSource; seamless: PieceSource;
}
type TextPos = "top" | "center" | "bottom";

interface RenderStyles {
  pageColor: string; overlayColor: string;
  fontFamily: string; subheadingFont: string;
  fontSize: number; contentFontSize: number;
  textColor: string; lineSpacing: number;
  cornerStyle: string; cornerColor: string;
  logoPosition: string; logoSize: number;
  textAlign: string; textBoxOutline: boolean; textBoxOutlineColor: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getStyles(preset: ClientPreset | null): RenderStyles {
  if (preset) {
    return {
      pageColor: preset.pageColor, overlayColor: preset.overlayColor,
      fontFamily: preset.fontFamily,
      subheadingFont: preset.subheadingFont ?? preset.fontFamily,
      fontSize: preset.fontSize, contentFontSize: preset.contentFontSize ?? 48,
      textColor: preset.textColor, lineSpacing: parseFloat(preset.lineSpacing),
      cornerStyle: preset.cornerStyle, cornerColor: preset.cornerColor,
      logoPosition: preset.logoPosition, logoSize: preset.logoSize,
      textAlign: preset.textAlign ?? "center",
      textBoxOutline: preset.textBoxOutline ?? false,
      textBoxOutlineColor: preset.textBoxOutlineColor ?? "#ffffff",
    };
  }
  return {
    pageColor: "#0a0a0a", overlayColor: "rgba(0,0,0,0.62)",
    fontFamily: "'Playfair Display', serif",
    subheadingFont: "'Raleway', sans-serif",
    fontSize: 64, contentFontSize: 48,
    textColor: "#ffffff", lineSpacing: 0.9,
    cornerStyle: "none", cornerColor: "#d4af37",
    logoPosition: "top-right", logoSize: 120,
    textAlign: "center", textBoxOutline: false, textBoxOutlineColor: "#ffffff",
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

function renderSlideFrame(
  img: HTMLImageElement | null, text: string, isCover: boolean,
  pos: number, total: number, tp: TextPos,
  styles: RenderStyles, logoEl: HTMLImageElement | null,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawSlide(
    ctx, img, text, styles.fontFamily,
    isCover ? styles.fontSize : styles.contentFontSize, isCover,
    styles.textColor, styles.lineSpacing, styles.overlayColor,
    logoEl, styles.logoPosition, styles.logoSize,
    styles.pageColor, styles.cornerStyle, styles.cornerColor,
    pos, total, tp, true,
    styles.subheadingFont, styles.textAlign,
    styles.textBoxOutline, styles.textBoxOutlineColor,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}

function renderStoryFrame(
  img: HTMLImageElement, text: string,
  styles: RenderStyles, logoEl: HTMLImageElement | null,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawStory(
    ctx, img, text, styles.fontFamily, styles.fontSize,
    styles.textColor, styles.overlayColor, "Leave a comment below",
    logoEl, styles.logoPosition, styles.logoSize,
    0.65, styles.subheadingFont, "center",
    styles.textBoxOutline, styles.textBoxOutlineColor,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}

const FORMAT_LABELS = ["Carousel", "About Me", "Reel", "Seamless"];
function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── FrameStrip ─────────────────────────────────────────────────────────────

function FrameStrip({
  frames, selected, onSelect,
  imageCount, imageIndex, onImageChange,
  textPosition, onTextPositionChange,
  isStory = false, rendering = false,
}: {
  frames: string[]; selected: number; onSelect: (i: number) => void;
  imageCount: number; imageIndex: number; onImageChange: (i: number) => void;
  textPosition?: TextPos; onTextPositionChange?: (tp: TextPos) => void;
  isStory?: boolean; rendering?: boolean;
}) {
  const bigW = isStory ? 100 : 120;
  const bigH = isStory ? 178 : 160;
  const thumbW = isStory ? 52 : 60;
  const thumbH = isStory ? 92 : 80;

  if (rendering && frames.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering previews...
      </div>
    );
  }
  if (!frames.length) return null;

  return (
    <div className="space-y-3">
      {/* Large selected frame */}
      <div className="flex gap-3 items-start">
        <img
          src={frames[selected]}
          alt="Preview"
          style={{ width: bigW, height: bigH, objectFit: "cover", flexShrink: 0 }}
          className="rounded-xl border border-border/20 shadow-md"
        />
        {/* Thumbnail strip */}
        {frames.length > 1 && (
          <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: bigH }}>
            {frames.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Frame ${i + 1}`}
                onClick={() => onSelect(i)}
                style={{ width: thumbW, height: thumbH, objectFit: "cover", flexShrink: 0 }}
                className={`rounded-lg cursor-pointer transition-all border ${
                  i === selected
                    ? "border-primary/60 ring-1 ring-primary/40 opacity-100"
                    : "border-border/20 opacity-50 hover:opacity-80"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {imageCount > 1 && (
          <div className="flex items-center gap-1 bg-accent/20 rounded-lg px-1.5 py-1">
            <button onClick={() => onImageChange((imageIndex - 1 + imageCount) % imageCount)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[2.5ch] text-center">
              {imageIndex + 1}/{imageCount}
            </span>
            <button onClick={() => onImageChange((imageIndex + 1) % imageCount)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!isStory && textPosition && onTextPositionChange && (
          <div className="flex rounded-lg overflow-hidden border border-border/30">
            {(["top", "center", "bottom"] as TextPos[]).map((tp) => (
              <button
                key={tp}
                onClick={() => onTextPositionChange(tp)}
                className={`px-2.5 py-1 text-xs transition-colors capitalize ${
                  textPosition === tp
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
              >
                {tp[0].toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="flex-shrink-0 h-8">
      {copied
        ? <><Check className="w-3.5 h-3.5 mr-1.5 text-green-400" />Copied</>
        : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>}
    </Button>
  );
}

// ─── CaptionBlock ────────────────────────────────────────────────────────────

function CaptionBlock({ caption }: { caption: string }) {
  return (
    <div className="px-5 py-4 border-t border-border/30 bg-accent/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Caption</span>
        <CopyButton text={caption} />
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{caption}</p>
    </div>
  );
}

// ─── BundleBuilder ────────────────────────────────────────────────────────────

export default function BundleBuilder() {
  const [, navigate] = useLocation();

  const [clinicName, setClinicName] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [treatmentFocus, setTreatmentFocus] = useState("");
  const [brandColour, setBrandColour] = useState("#ec4899");
  const [voiceStyle, setVoiceStyle] = useState("northern-grit");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ token: string; content?: BundleContent } | null>(null);
  const [copied, setCopied] = useState(false);

  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["", "", "", ""]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);

  const { presets } = usePresets();
  const [selectedPreset, setSelectedPreset] = useState<ClientPreset | null>(null);

  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [previews, setPreviews] = useState<{
    carousel: string[];
    aboutMe: string[];
    stories: string[];
    reel: string[];
  } | null>(null);
  const [rendering, setRendering] = useState(false);
  const renderingRef = useRef(false);

  const [renderControls, setRenderControls] = useState<{
    carousel: { imageIndex: number; textPosition: TextPos };
    aboutMe: { imageIndex: number; textPosition: TextPos };
    stories: { imageIndex: number };
    reel: { imageIndex: number; textPosition: TextPos };
  }>({
    carousel: { imageIndex: 0, textPosition: "bottom" },
    aboutMe: { imageIndex: 0, textPosition: "bottom" },
    stories: { imageIndex: 0 },
    reel: { imageIndex: 0, textPosition: "bottom" },
  });

  const [selectedFrameIdx, setSelectedFrameIdx] = useState({
    carousel: 0, aboutMe: 0, stories: 0, reel: 0,
  });

  const [saving, setSaving] = useState(false);
  const [savedUrls, setSavedUrls] = useState<Record<string, string[]> | null>(null);

  const [pickAndMix, setPickAndMix] = useState(false);
  const [sources, setSources] = useState<PickAndMixSources | null>(null);
  const [rerolling, setRerolling] = useState<string | null>(null);

  const bundleUrl = result
    ? `${window.location.origin}${BASE.replace(/\/$/, "")}/bundle/${result.token}`
    : null;

  const applyRandomTopics = useCallback((pool: Topic[]) => {
    if (!pool.length) return;
    const picks = pickRandom(pool, Math.min(4, pool.length));
    setSelectedTopics(["", "", "", ""].map((_, i) => picks[i]?.topic ?? ""));
  }, []);

  useEffect(() => {
    fetch(api("strategy-topics"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data: Topic[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAllTopics(data);
          applyRandomTopics(data);
        }
      })
      .catch(() => {})
      .finally(() => setTopicsLoaded(true));
  }, [applyRandomTopics]);

  useEffect(() => {
    const urls = uploadedImages.map((f) => URL.createObjectURL(f));
    setImagePreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [uploadedImages]);

  const addImages = (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    setUploadedImages((prev) => [...prev, ...valid].slice(0, 5));
  };

  const removeImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addImages(Array.from(e.dataTransfer.files));
  };

  const renderAllPreviews = useCallback(async () => {
    if (!result?.content || !uploadedImages.length) return;
    if (renderingRef.current) return;
    renderingRef.current = true;
    setRendering(true);

    const blobUrls: string[] = [];
    try {
      await document.fonts.ready;

      const imgEls = await Promise.all(
        uploadedImages.map((file) => {
          const url = URL.createObjectURL(file);
          blobUrls.push(url);
          return loadImg(url);
        }),
      );

      let logoEl: HTMLImageElement | null = null;
      if (selectedPreset?.logoUrl) {
        try { logoEl = await loadImg(selectedPreset.logoUrl); } catch { logoEl = null; }
      }

      const styles = getStyles(selectedPreset);
      const safe = (idx: number) => imgEls[idx % imgEls.length];
      const content = result.content!;

      // Carousel
      const cImg = safe(renderControls.carousel.imageIndex);
      const cSlides = content.carousel?.slides ?? [];
      const carouselUrls = cSlides.slice(0, 5).map((slide, i) =>
        renderSlideFrame(cImg, slide.heading, i === 0, i + 1, cSlides.length, renderControls.carousel.textPosition, styles, logoEl),
      );

      // About Me
      const aImg = safe(renderControls.aboutMe.imageIndex);
      const aboutMeUrls = [
        renderSlideFrame(aImg, content.aboutMe?.intro ?? "", true, 1, 1, renderControls.aboutMe.textPosition, styles, logoEl),
      ];

      // Stories: reel hook (first line) + seamless tagline
      const sImg = safe(renderControls.stories.imageIndex);
      const reelLines = (content.reel?.script ?? "").split("|").map((l) => l.trim()).filter(Boolean);
      const storyText1 = reelLines[0] ?? "";
      const storyText2 = content.seamless?.tagline ?? "";
      const storiesUrls = [
        renderStoryFrame(sImg, storyText1, styles, logoEl),
        renderStoryFrame(sImg, storyText2, styles, logoEl),
      ];

      // Reel
      const rImg = safe(renderControls.reel.imageIndex);
      const reelUrls = reelLines.slice(0, 4).map((line, i) =>
        renderSlideFrame(rImg, line, i === 0, i + 1, reelLines.length, renderControls.reel.textPosition, styles, logoEl),
      );

      setPreviews({ carousel: carouselUrls, aboutMe: aboutMeUrls, stories: storiesUrls, reel: reelUrls });
      setSelectedFrameIdx({ carousel: 0, aboutMe: 0, stories: 0, reel: 0 });
    } catch (err) {
      console.error("Render error:", err);
    } finally {
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      setRendering(false);
      renderingRef.current = false;
    }
  }, [result, uploadedImages, selectedPreset, renderControls]);

  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!result?.content || !uploadedImages.length) return;
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(() => renderAllPreviews(), 200);
    return () => { if (renderTimerRef.current) clearTimeout(renderTimerRef.current); };
  }, [renderAllPreviews]);

  const saveVisuals = useCallback(async () => {
    if (!previews || !result) return;
    setSaving(true);
    try {
      const uploadOne = async (dataUrl: string): Promise<string> => {
        const blob = await (await fetch(dataUrl)).blob();
        const resp = await fetch(api("storage/uploads/request-url"), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ name: "bundle-render.jpg", size: blob.size, contentType: "image/jpeg" }),
        });
        if (!resp.ok) throw new Error("Upload URL request failed");
        const { uploadURL, objectPath } = await resp.json();
        await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        return `${BASE}api/storage${objectPath as string}`;
      };

      const [carousel, aboutMe, stories, reel] = await Promise.all([
        Promise.all(previews.carousel.map(uploadOne)),
        Promise.all(previews.aboutMe.map(uploadOne)),
        Promise.all(previews.stories.map(uploadOne)),
        Promise.all(previews.reel.map(uploadOne)),
      ]);

      const renderedImageUrls = { carousel, aboutMe, stories, reel };
      const patchResp = await fetch(api(`bundle/${result.token}/images`), {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ renderedImageUrls }),
      });
      if (!patchResp.ok) throw new Error("Failed to save to bundle");

      setSavedUrls(renderedImageUrls);
      toast.success("Visuals saved to bundle.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save visuals");
    } finally {
      setSaving(false);
    }
  }, [previews, result]);

  const handleGenerate = async () => {
    if (!clinicName.trim() || !treatmentFocus.trim()) {
      toast.error("Clinic name and treatment focus are required");
      return;
    }
    setGenerating(true);
    setPreviews(null);
    setSavedUrls(null);
    setSources(null);
    try {
      let resp: Response;
      if (pickAndMix) {
        resp = await fetch(api("bundle/pick-and-mix"), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            clinicName: clinicName.trim(), igHandle: igHandle.trim(),
            treatmentFocus: treatmentFocus.trim(), brandColour, voiceStyle,
            presetId: selectedPreset?.id,
          }),
        });
      } else {
        const activeTopics = selectedTopics.filter(Boolean);
        resp = await fetch(api("bundle/generate"), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            clinicName: clinicName.trim(), igHandle: igHandle.trim(),
            treatmentFocus: treatmentFocus.trim(), brandColour, voiceStyle,
            topics: activeTopics.length === 4 ? activeTopics : undefined,
          }),
        });
      }
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      if (data.sources) setSources(data.sources);
      toast.success("Bundle ready.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const handleReroll = async (piece: "carousel" | "aboutMe" | "reel" | "seamless") => {
    if (!result?.token) return;
    setRerolling(piece);
    try {
      const resp = await fetch(api(`bundle/${result.token}/regenerate-piece`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ piece, voiceStyle, presetId: selectedPreset?.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Re-roll failed");
      setResult((prev) => {
        if (!prev?.content) return prev;
        return { ...prev, content: { ...prev.content, [piece]: data.data } as BundleContent };
      });
      setSources((prev) => prev ? { ...prev, [piece]: data.source } : prev);
      toast.success("Re-rolled.");
    } catch (err: any) {
      toast.error(err.message || "Re-roll failed");
    } finally {
      setRerolling(null);
    }
  };

  const copy = async () => {
    if (!bundleUrl) return;
    await navigator.clipboard.writeText(bundleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAll = () => {
    setResult(null); setPreviews(null); setSavedUrls(null); setSources(null);
    setClinicName(""); setIgHandle(""); setTreatmentFocus("");
    setBrandColour("#ec4899"); setSelectedPreset(null);
    applyRandomTopics(allTopics);
  };

  const content = result?.content;
  const hasImages = uploadedImages.length > 0;
  const reelLines = content ? (content.reel?.script ?? "").split("|").map((l) => l.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/bundle-requests">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <Inbox className="w-3.5 h-3.5" /> Requests
              </Button>
            </Link>
            <Link href="/strategy-library">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Strategy Library
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-400" />
            </div>
            <h1 className="font-sans text-4xl font-semibold tracking-tight">Trial Bundle Builder</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Enter a prospect clinic's details and generate four pieces of content in their voice. Send them one link and let the work speak for itself.
          </p>
        </div>

        {/* ── FORM ─────────────────────────────────────────────────────── */}
        {!result ? (
          <div className="space-y-6">

            {/* Photos */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <div>
                <h2 className="text-base font-medium">Clinic photos</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Up to 5 photos. They'll be used to render visual previews after generation.
                </p>
              </div>
              <div
                className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                  isDragging ? "border-primary/50 bg-primary/5" : "border-border/40 hover:border-border/60"
                } ${uploadedImages.length > 0 ? "p-4" : "p-8"}`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => imageInputRef.current?.click()}
              >
                <input
                  ref={imageInputRef}
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => addImages(Array.from(e.target.files ?? []))}
                  onClick={(e) => e.stopPropagation()}
                />
                {uploadedImages.length === 0 ? (
                  <div className="text-center space-y-2">
                    <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Drop photos here or click to upload</p>
                    <p className="text-xs text-muted-foreground/50">Optional — enables visual previews</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {uploadedImages.map((_, i) => (
                      <div key={i} className="relative group" onClick={(e) => e.stopPropagation()}>
                        <img src={imagePreviewUrls[i]} alt="" className="w-16 h-16 object-cover rounded-lg border border-border/20" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full items-center justify-center hidden group-hover:flex z-10"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {uploadedImages.length < 5 && (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border/30 flex items-center justify-center text-muted-foreground/30">
                        <ImagePlus className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Clinic Details */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="clinicName" className="text-base font-medium">Clinic name</Label>
                <Input id="clinicName" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Bloom Aesthetics" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="igHandle" className="text-base font-medium">
                  Instagram handle <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="igHandle" value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="@bloom_aesthetics" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatmentFocus" className="text-base font-medium">Treatment focus</Label>
                <Input id="treatmentFocus" value={treatmentFocus} onChange={(e) => setTreatmentFocus(e.target.value)} placeholder="e.g. lip filler, skin boosters, facial aesthetics" className="h-12 text-base" />
                <p className="text-sm text-muted-foreground">The more specific, the better the content.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Brand colour</Label>
                  <div className="flex items-center gap-3">
                    <Input type="color" value={brandColour} onChange={(e) => setBrandColour(e.target.value)} className="w-14 h-12 p-1 cursor-pointer flex-shrink-0" />
                    <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} className="flex-1 h-12 font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">Caption voice</Label>
                  <VoiceStyleSelector value={voiceStyle} onChange={setVoiceStyle} />
                </div>
              </div>

              {/* Preset picker */}
              {presets.length > 0 && (
                <div className="space-y-2 pt-1">
                  <Label className="text-base font-medium">
                    Visual style preset <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={selectedPreset ? String(selectedPreset.id) : "__none__"}
                    onValueChange={(v) => {
                      if (v === "__none__") { setSelectedPreset(null); return; }
                      const p = presets.find((pr) => String(pr.id) === v);
                      if (p) setSelectedPreset(p);
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Default style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__"><span className="text-muted-foreground">Default style</span></SelectItem>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPreset && (
                    <p className="text-xs text-muted-foreground">Previews will use {selectedPreset.name}'s colours and fonts.</p>
                  )}
                </div>
              )}
            </div>

            {/* Pick and Mix toggle */}
            <div
              className={`rounded-2xl border p-5 cursor-pointer transition-colors ${
                pickAndMix
                  ? "border-violet-500/40 bg-violet-950/20"
                  : "border-border/30 bg-card/50 hover:border-border/50"
              }`}
              onClick={() => setPickAndMix((v) => !v)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${pickAndMix ? "bg-violet-500/20" : "bg-accent/30"}`}>
                    <Dices className={`w-4 h-4 ${pickAndMix ? "text-violet-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${pickAndMix ? "text-violet-300" : ""}`}>Pick and Mix mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {pickAndMix
                        ? "Topics are drawn randomly from your Strategy Library, filtered by treatment focus and any brand rules in the selected preset."
                        : "Let the AI draft everything from scratch, or switch this on to pull angles from your Strategy Library."}
                    </p>
                  </div>
                </div>
                <div
                  className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${pickAndMix ? "bg-violet-500" : "bg-accent/40"}`}
                  role="switch"
                  aria-checked={pickAndMix}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pickAndMix ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </div>
              </div>
            </div>

            {/* Content Angles — hidden when Pick and Mix is on */}
            {!pickAndMix && (
              <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium">Content angles</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {allTopics.length > 0 ? "4 topics picked at random from your Strategy Library. Override any slot below." : "No topics in Strategy Library yet."}
                    </p>
                  </div>
                  {allTopics.length > 0 && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); applyRandomTopics(allTopics); }} className="flex-shrink-0 gap-1.5">
                      <Shuffle className="w-3.5 h-3.5" /> Randomise
                    </Button>
                  )}
                </div>
                {allTopics.length === 0 && topicsLoaded ? (
                  <div className="rounded-xl border border-dashed border-border/40 py-5 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Topics will be picked once you add some to the Strategy Library.</p>
                    <Link href="/strategy-library">
                      <Button variant="outline" size="sm"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Open Strategy Library</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {FORMAT_LABELS.map((label, idx) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-medium w-20 flex-shrink-0">{label}</span>
                        <Select
                          value={selectedTopics[idx] || "__none__"}
                          onValueChange={(v) => setSelectedTopics((prev) => prev.map((t, i) => i === idx ? (v === "__none__" ? "" : v) : t))}
                        >
                          <SelectTrigger className="flex-1 h-10 text-sm"><SelectValue placeholder="No topic selected" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__"><span className="text-muted-foreground">No topic</span></SelectItem>
                            {allTopics.map((t) => (<SelectItem key={t.id} value={t.topic}>{t.topic}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              size="lg" onClick={handleGenerate}
              disabled={generating || !clinicName.trim() || !treatmentFocus.trim()}
              className={`w-full py-6 text-lg font-semibold btn-shimmer ${pickAndMix ? "bg-violet-600 hover:bg-violet-500" : ""}`}
            >
              {generating
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{pickAndMix ? "Mixing content..." : "Generating content..."}</>
                : pickAndMix
                  ? <><Dices className="w-5 h-5 mr-2" />Pick and Mix</>
                  : <><Sparkles className="w-5 h-5 mr-2" />Generate Bundle</>}
            </Button>
            {generating && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                {pickAndMix
                  ? "Drawing topics from your library and writing each piece. Takes about 20 seconds."
                  : "Creating carousel, about me, reel, and seamless content. This takes about 20 seconds."}
              </p>
            )}
          </div>
        ) : (

        /* ── RESULT ──────────────────────────────────────────────────────── */
          <div className="space-y-5">

            {/* Bundle ready card */}
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                <Package className="w-5 h-5" /> Bundle ready for {clinicName}
              </div>
              <p className="text-muted-foreground text-base">Share this link. They can view everything without logging in.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-accent/30 border border-border/40 rounded-xl px-4 py-3 font-mono text-sm text-muted-foreground truncate">
                  {bundleUrl}
                </div>
                <Button variant="outline" size="default" onClick={copy} className="flex-shrink-0 h-11">
                  {copied ? <><Check className="w-4 h-4 mr-2 text-green-400" />Copied</> : <><Copy className="w-4 h-4 mr-2" />Copy link</>}
                </Button>
              </div>
              <div className="flex gap-3 pt-1">
                <Button size="lg" onClick={() => navigate(`/bundle/${result.token}`)} className="flex-1">
                  <ExternalLink className="w-4 h-4 mr-2" /> Preview Bundle
                </Button>
                <Button variant="outline" size="lg" onClick={resetAll} className="flex-1">New Bundle</Button>
              </div>
            </div>

            {/* Carousel section */}
            {content?.carousel && (
              <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  <span className="font-semibold text-base">Carousel</span>
                  <span className="text-xs text-muted-foreground bg-accent/30 px-2 py-0.5 rounded-full ml-1">
                    {content.carousel.slides.length} slides
                  </span>
                  {sources?.carousel?.topic && (
                    <span className="ml-auto text-xs text-violet-400/80 bg-violet-950/30 border border-violet-500/20 px-2.5 py-0.5 rounded-full truncate max-w-[200px]" title={sources.carousel.topic}>
                      ↗ {sources.carousel.topic}
                    </span>
                  )}
                  {sources && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleReroll("carousel")} disabled={!!rerolling} title="Re-roll this piece">
                      {rerolling === "carousel" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
                {hasImages && (
                  <div className="px-5 pt-4 pb-1">
                    <FrameStrip
                      frames={previews?.carousel ?? []}
                      selected={selectedFrameIdx.carousel}
                      onSelect={(i) => setSelectedFrameIdx((p) => ({ ...p, carousel: i }))}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.carousel.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, carousel: { ...p.carousel, imageIndex: i } }))}
                      textPosition={renderControls.carousel.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, carousel: { ...p.carousel, textPosition: tp } }))}
                      rendering={rendering && !previews}
                    />
                  </div>
                )}
                <div className="divide-y divide-border/20 mt-3">
                  {content.carousel.slides.map((slide, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-4">
                      <span className="text-primary font-mono text-sm font-bold flex-shrink-0 w-5 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base">{slide.heading}</p>
                        {slide.body && <p className="text-muted-foreground text-sm mt-0.5 leading-relaxed">{slide.body}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <CaptionBlock caption={content.carousel.caption} />
              </div>
            )}

            {/* About Me section */}
            {content?.aboutMe && (
              <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-base">About Me Post</span>
                  {sources?.aboutMe?.topic && (
                    <span className="ml-auto text-xs text-violet-400/80 bg-violet-950/30 border border-violet-500/20 px-2.5 py-0.5 rounded-full truncate max-w-[200px]" title={sources.aboutMe.topic}>
                      ↗ {sources.aboutMe.topic}
                    </span>
                  )}
                  {sources && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleReroll("aboutMe")} disabled={!!rerolling} title="Re-roll this piece">
                      {rerolling === "aboutMe" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
                {hasImages && (
                  <div className="px-5 pt-4 pb-1">
                    <FrameStrip
                      frames={previews?.aboutMe ?? []}
                      selected={selectedFrameIdx.aboutMe}
                      onSelect={(i) => setSelectedFrameIdx((p) => ({ ...p, aboutMe: i }))}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.aboutMe.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, aboutMe: { ...p.aboutMe, imageIndex: i } }))}
                      textPosition={renderControls.aboutMe.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, aboutMe: { ...p.aboutMe, textPosition: tp } }))}
                      rendering={rendering && !previews}
                    />
                  </div>
                )}
                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Intro text</p>
                  <p className="text-base leading-relaxed">{content.aboutMe.intro}</p>
                </div>
                <CaptionBlock caption={content.aboutMe.caption} />
              </div>
            )}

            {/* Reel section */}
            {content?.reel && (
              <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                  <Film className="w-4 h-4 text-teal-400" />
                  <span className="font-semibold text-base">Reel</span>
                  {sources?.reel?.topic && (
                    <span className="ml-auto text-xs text-violet-400/80 bg-violet-950/30 border border-violet-500/20 px-2.5 py-0.5 rounded-full truncate max-w-[200px]" title={sources.reel.topic}>
                      ↗ {sources.reel.topic}
                    </span>
                  )}
                  {sources && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleReroll("reel")} disabled={!!rerolling} title="Re-roll this piece">
                      {rerolling === "reel" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
                {hasImages && (
                  <div className="px-5 pt-4 pb-1">
                    <FrameStrip
                      frames={previews?.reel ?? []}
                      selected={selectedFrameIdx.reel}
                      onSelect={(i) => setSelectedFrameIdx((p) => ({ ...p, reel: i }))}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.reel.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, reel: { ...p.reel, imageIndex: i } }))}
                      textPosition={renderControls.reel.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, reel: { ...p.reel, textPosition: tp } }))}
                      rendering={rendering && !previews}
                    />
                  </div>
                )}
                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-4">Overlay text lines</p>
                  <div className="space-y-3">
                    {reelLines.map((line, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${brandColour}20`, color: brandColour }}
                        >
                          {i + 1}
                        </span>
                        <p className="font-semibold text-base leading-snug">{line}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <CaptionBlock caption={content.reel.caption} />
              </div>
            )}

            {/* Stories section — only when images uploaded */}
            {hasImages && (
              <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-base">Story Frames</span>
                  <span className="text-xs text-muted-foreground ml-1">from reel hook + seamless tagline</span>
                </div>
                <div className="px-5 py-4">
                  <FrameStrip
                    frames={previews?.stories ?? []}
                    selected={selectedFrameIdx.stories}
                    onSelect={(i) => setSelectedFrameIdx((p) => ({ ...p, stories: i }))}
                    imageCount={uploadedImages.length}
                    imageIndex={renderControls.stories.imageIndex}
                    onImageChange={(i) => setRenderControls((p) => ({ ...p, stories: { imageIndex: i } }))}
                    isStory
                    rendering={rendering && !previews}
                  />
                </div>
              </div>
            )}

            {/* Seamless section */}
            {content?.seamless && (
              <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-base">Seamless Carousel</span>
                  {sources?.seamless?.topic && (
                    <span className="ml-auto text-xs text-violet-400/80 bg-violet-950/30 border border-violet-500/20 px-2.5 py-0.5 rounded-full truncate max-w-[200px]" title={sources.seamless.topic}>
                      ↗ {sources.seamless.topic}
                    </span>
                  )}
                  {sources && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleReroll("seamless")} disabled={!!rerolling} title="Re-roll this piece">
                      {rerolling === "seamless" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
                <div className="px-5 py-6">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-4">Tagline</p>
                  <div
                    className="rounded-xl p-6 text-center"
                    style={{ background: `linear-gradient(135deg, ${brandColour}20, ${brandColour}08)`, border: `1px solid ${brandColour}30` }}
                  >
                    <p className="text-2xl font-bold tracking-tight" style={{ color: brandColour }}>
                      {content.seamless.tagline}
                    </p>
                  </div>
                </div>
                <CaptionBlock caption={content.seamless.caption} />
              </div>
            )}

            {/* Save visuals */}
            {hasImages && (previews || rendering) && (
              <Button
                onClick={saveVisuals}
                disabled={saving || !previews || !!savedUrls}
                className="w-full"
                variant={savedUrls ? "outline" : "default"}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading images...</>
                ) : savedUrls ? (
                  <><Check className="w-4 h-4 mr-2 text-green-400" />Visuals saved to bundle</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Save visuals to bundle</>
                )}
              </Button>
            )}
            {savedUrls && (
              <p className="text-xs text-muted-foreground text-center">
                Images are now visible on the public bundle page.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
