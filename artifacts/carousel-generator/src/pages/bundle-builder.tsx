import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Package, ArrowLeft, Sparkles, Loader2, Copy, Check, ExternalLink,
  Shuffle, BookOpen, Inbox, ImagePlus, X, Upload, ChevronRight, ChevronLeft,
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

function api(path: string) {
  return `${BASE}api/${path}`;
}

interface Topic {
  id: number;
  topic: string;
}

interface BundleSlide { heading: string; body?: string; }

interface BundleContent {
  carousel: { slides: BundleSlide[]; caption: string };
  aboutMe: { intro: string; caption: string };
  reel: { script: string; caption: string };
  seamless: { tagline: string; caption: string };
}

type TextPos = "top" | "center" | "bottom";

interface RenderStyles {
  pageColor: string;
  overlayColor: string;
  fontFamily: string;
  subheadingFont: string;
  fontSize: number;
  contentFontSize: number;
  textColor: string;
  lineSpacing: number;
  cornerStyle: string;
  cornerColor: string;
  logoPosition: string;
  logoSize: number;
  textAlign: string;
  textBoxOutline: boolean;
  textBoxOutlineColor: string;
}

function getStyles(preset: ClientPreset | null): RenderStyles {
  if (preset) {
    return {
      pageColor: preset.pageColor,
      overlayColor: preset.overlayColor,
      fontFamily: preset.fontFamily,
      subheadingFont: preset.subheadingFont ?? preset.fontFamily,
      fontSize: preset.fontSize,
      contentFontSize: preset.contentFontSize ?? 48,
      textColor: preset.textColor,
      lineSpacing: parseFloat(preset.lineSpacing),
      cornerStyle: preset.cornerStyle,
      cornerColor: preset.cornerColor,
      logoPosition: preset.logoPosition,
      logoSize: preset.logoSize,
      textAlign: preset.textAlign ?? "center",
      textBoxOutline: preset.textBoxOutline ?? false,
      textBoxOutlineColor: preset.textBoxOutlineColor ?? "#ffffff",
    };
  }
  return {
    pageColor: "#0a0a0a",
    overlayColor: "rgba(0,0,0,0.62)",
    fontFamily: "'Playfair Display', serif",
    subheadingFont: "'Raleway', sans-serif",
    fontSize: 64,
    contentFontSize: 48,
    textColor: "#ffffff",
    lineSpacing: 0.9,
    cornerStyle: "none",
    cornerColor: "#d4af37",
    logoPosition: "top-right",
    logoSize: 120,
    textAlign: "center",
    textBoxOutline: false,
    textBoxOutlineColor: "#ffffff",
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
  img: HTMLImageElement | null,
  text: string,
  isCover: boolean,
  pos: number,
  total: number,
  tp: TextPos,
  styles: RenderStyles,
  logoEl: HTMLImageElement | null,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawSlide(
    ctx, img, text,
    styles.fontFamily,
    isCover ? styles.fontSize : styles.contentFontSize,
    isCover,
    styles.textColor, styles.lineSpacing, styles.overlayColor,
    logoEl, styles.logoPosition, styles.logoSize,
    styles.pageColor, styles.cornerStyle, styles.cornerColor,
    pos, total, tp,
    true,
    styles.subheadingFont, styles.textAlign,
    styles.textBoxOutline, styles.textBoxOutlineColor,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}

function renderStoryFrame(
  img: HTMLImageElement,
  text: string,
  styles: RenderStyles,
  logoEl: HTMLImageElement | null,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawStory(
    ctx, img, text,
    styles.fontFamily, styles.fontSize,
    styles.textColor, styles.overlayColor,
    "Leave a comment below",
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

interface PreviewRowProps {
  label: string;
  frames: string[];
  imageCount: number;
  imageIndex: number;
  onImageChange: (i: number) => void;
  textPosition?: TextPos;
  onTextPositionChange?: (tp: TextPos) => void;
  isStory?: boolean;
}

function PreviewRow({
  label, frames, imageCount, imageIndex, onImageChange,
  textPosition, onTextPositionChange, isStory,
}: PreviewRowProps) {
  const thumbW = isStory ? 80 : 110;
  const thumbH = isStory ? 142 : 147;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {imageCount > 1 && (
            <div className="flex items-center gap-1 bg-accent/20 rounded-lg px-1.5 py-1">
              <button
                onClick={() => onImageChange((imageIndex - 1 + imageCount) % imageCount)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[2.5ch] text-center tabular-nums">
                {imageIndex + 1}/{imageCount}
              </span>
              <button
                onClick={() => onImageChange((imageIndex + 1) % imageCount)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
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
      <div className="flex gap-2 pb-1 overflow-x-auto">
        {frames.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${label} ${i + 1}`}
            style={{ width: thumbW, height: thumbH, objectFit: "cover", flexShrink: 0 }}
            className="rounded-lg border border-border/20 shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}

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

  const [saving, setSaving] = useState(false);
  const [savedUrls, setSavedUrls] = useState<Record<string, string[]> | null>(null);

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
    setUploadedImages((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, 5);
    });
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

      const carouselImg = safe(renderControls.carousel.imageIndex);
      const cSlides = content.carousel?.slides ?? [];
      const carouselUrls = cSlides.slice(0, 5).map((slide, i) =>
        renderSlideFrame(carouselImg, slide.heading, i === 0, i + 1, cSlides.length, renderControls.carousel.textPosition, styles, logoEl),
      );

      const aboutMeImg = safe(renderControls.aboutMe.imageIndex);
      const aboutMeUrls = [
        renderSlideFrame(aboutMeImg, content.aboutMe?.intro ?? "", true, 1, 1, renderControls.aboutMe.textPosition, styles, logoEl),
      ];

      const storyImg = safe(renderControls.stories.imageIndex);
      const storyText1 = content.seamless?.tagline ?? "";
      const storyText2 = (content.aboutMe?.intro ?? "").split(".")[0].trim();
      const storiesUrls = [
        renderStoryFrame(storyImg, storyText1, styles, logoEl),
        renderStoryFrame(storyImg, storyText2, styles, logoEl),
      ];

      const reelImg = safe(renderControls.reel.imageIndex);
      const reelLines = (content.reel?.script ?? "")
        .split("|")
        .map((l) => l.trim())
        .filter(Boolean);
      const reelUrls = reelLines.slice(0, 4).map((line, i) =>
        renderSlideFrame(reelImg, line, i === 0, i + 1, reelLines.length, renderControls.reel.textPosition, styles, logoEl),
      );

      setPreviews({ carousel: carouselUrls, aboutMe: aboutMeUrls, stories: storiesUrls, reel: reelUrls });
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
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
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
    try {
      const activeTopics = selectedTopics.filter(Boolean);
      const resp = await fetch(api("bundle/generate"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          igHandle: igHandle.trim(),
          treatmentFocus: treatmentFocus.trim(),
          brandColour,
          voiceStyle,
          topics: activeTopics.length === 4 ? activeTopics : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      toast.success("Bundle ready.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!bundleUrl) return;
    await navigator.clipboard.writeText(bundleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAll = () => {
    setResult(null);
    setPreviews(null);
    setSavedUrls(null);
    setClinicName("");
    setIgHandle("");
    setTreatmentFocus("");
    setBrandColour("#ec4899");
    setSelectedPreset(null);
    applyRandomTopics(allTopics);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/bundle-requests">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <Inbox className="w-3.5 h-3.5" />
                Requests
              </Button>
            </Link>
            <Link href="/strategy-library">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Strategy Library
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
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
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
                        <img
                          src={imagePreviewUrls[i]}
                          alt=""
                          className="w-16 h-16 object-cover rounded-lg border border-border/20"
                        />
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
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Bloom Aesthetics"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="igHandle" className="text-base font-medium">
                  Instagram handle <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="igHandle"
                  value={igHandle}
                  onChange={(e) => setIgHandle(e.target.value)}
                  placeholder="@bloom_aesthetics"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="treatmentFocus" className="text-base font-medium">Treatment focus</Label>
                <Input
                  id="treatmentFocus"
                  value={treatmentFocus}
                  onChange={(e) => setTreatmentFocus(e.target.value)}
                  placeholder="e.g. lip filler, skin boosters, facial aesthetics"
                  className="h-12 text-base"
                />
                <p className="text-sm text-muted-foreground">The more specific, the better the content.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Brand colour</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={brandColour}
                      onChange={(e) => setBrandColour(e.target.value)}
                      className="w-14 h-12 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={brandColour}
                      onChange={(e) => setBrandColour(e.target.value)}
                      className="flex-1 h-12 font-mono text-sm"
                    />
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
                    Visual style preset{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
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
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">Default style</span>
                      </SelectItem>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPreset && (
                    <p className="text-xs text-muted-foreground">
                      Previews will use {selectedPreset.name}'s colours and fonts.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Content Angles */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium">Content angles</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {allTopics.length > 0
                      ? "4 topics picked at random from your Strategy Library. Override any slot below."
                      : "No topics in Strategy Library yet."}
                  </p>
                </div>
                {allTopics.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => applyRandomTopics(allTopics)} className="flex-shrink-0 gap-1.5">
                    <Shuffle className="w-3.5 h-3.5" />
                    Randomise
                  </Button>
                )}
              </div>

              {allTopics.length === 0 && topicsLoaded ? (
                <div className="rounded-xl border border-dashed border-border/40 py-5 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Topics will be picked once you add some to the Strategy Library.</p>
                  <Link href="/strategy-library">
                    <Button variant="outline" size="sm">
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                      Open Strategy Library
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {FORMAT_LABELS.map((label, idx) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-medium w-20 flex-shrink-0">{label}</span>
                      <Select
                        value={selectedTopics[idx] || "__none__"}
                        onValueChange={(v) =>
                          setSelectedTopics((prev) => prev.map((t, i) => i === idx ? (v === "__none__" ? "" : v) : t))
                        }
                      >
                        <SelectTrigger className="flex-1 h-10 text-sm">
                          <SelectValue placeholder="No topic selected" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">No topic</span>
                          </SelectItem>
                          {allTopics.map((t) => (
                            <SelectItem key={t.id} value={t.topic}>{t.topic}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={generating || !clinicName.trim() || !treatmentFocus.trim()}
              className="w-full py-6 text-lg font-semibold btn-shimmer"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating content...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Generate Bundle</>
              )}
            </Button>

            {generating && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Creating carousel, about me, reel, and seamless content. This takes about 20 seconds.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Bundle ready */}
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                <Package className="w-5 h-5" />
                Bundle ready for {clinicName}
              </div>
              <p className="text-muted-foreground text-base">
                Share this link. They can view everything without logging in.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-accent/30 border border-border/40 rounded-xl px-4 py-3 font-mono text-sm text-muted-foreground truncate">
                  {bundleUrl}
                </div>
                <Button variant="outline" size="default" onClick={copy} className="flex-shrink-0 h-11">
                  {copied ? (
                    <><Check className="w-4 h-4 mr-2 text-green-400" />Copied</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" />Copy link</>
                  )}
                </Button>
              </div>
              <div className="flex gap-3 pt-1">
                <Button size="lg" onClick={() => navigate(`/bundle/${result.token}`)} className="flex-1">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview Bundle
                </Button>
                <Button variant="outline" size="lg" onClick={resetAll} className="flex-1">
                  New Bundle
                </Button>
              </div>
            </div>

            {/* Visual Previews */}
            {uploadedImages.length > 0 && (
              <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Visual previews</h2>
                  {rendering && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Rendering
                    </span>
                  )}
                </div>

                {!previews && !rendering && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Preparing previews...
                  </p>
                )}

                {!previews && rendering && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                  </div>
                )}

                {previews && (
                  <div className="space-y-5">
                    <PreviewRow
                      label="Carousel"
                      frames={previews.carousel}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.carousel.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, carousel: { ...p.carousel, imageIndex: i } }))}
                      textPosition={renderControls.carousel.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, carousel: { ...p.carousel, textPosition: tp } }))}
                    />
                    <PreviewRow
                      label="About Me"
                      frames={previews.aboutMe}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.aboutMe.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, aboutMe: { ...p.aboutMe, imageIndex: i } }))}
                      textPosition={renderControls.aboutMe.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, aboutMe: { ...p.aboutMe, textPosition: tp } }))}
                    />
                    <PreviewRow
                      label="Stories"
                      frames={previews.stories}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.stories.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, stories: { imageIndex: i } }))}
                      isStory
                    />
                    <PreviewRow
                      label="Reel"
                      frames={previews.reel}
                      imageCount={uploadedImages.length}
                      imageIndex={renderControls.reel.imageIndex}
                      onImageChange={(i) => setRenderControls((p) => ({ ...p, reel: { ...p.reel, imageIndex: i } }))}
                      textPosition={renderControls.reel.textPosition}
                      onTextPositionChange={(tp) => setRenderControls((p) => ({ ...p, reel: { ...p.reel, textPosition: tp } }))}
                    />

                    <Button
                      onClick={saveVisuals}
                      disabled={saving || !!savedUrls}
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
                    {savedUrls && (
                      <p className="text-xs text-muted-foreground text-center">
                        Images are now visible on the public bundle page.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
