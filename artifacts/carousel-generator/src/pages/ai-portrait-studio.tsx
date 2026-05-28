import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import JSZip from "jszip";
import {
  Sparkles, Upload, X, Check, Download, RefreshCcw, Loader2, AlertCircle,
  ChevronRight, Clock, BookImage, Palette, Film, Play, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL;

type OutfitType = "white-shirt-jeans" | "black-tee-trousers" | "floral-boho" | "scrubs";
type BackgroundType = "clinic-bokeh" | "white-studio" | "black-studio" | "custom-color" | "upload-own";
type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";
type AspectRatio = "1:1" | "3:4" | "9:16";

interface CardState {
  scenarioId: string;
  status: CardStatus;
  portraitId?: number;
  outputImageUrl?: string;
  failureReason?: string;
  retryAfter?: number;
}

interface AiSourcePhoto {
  id: number;
  clientName: string;
  photoUrl: string;
  notes: string;
  uploadedAt: string;
}

const ASPECT_OPTIONS: AspectRatio[] = ["1:1", "3:4", "9:16"];

const OUTFIT_OPTIONS: { value: OutfitType; label: string }[] = [
  { value: "white-shirt-jeans", label: "White sharp shirt with jeans" },
  { value: "black-tee-trousers", label: "Black long-sleeved tee with black trousers" },
  { value: "floral-boho", label: "Floral boho dress with cardigan" },
  { value: "scrubs", label: "Scrubs" },
];

const BACKGROUND_OPTIONS: { value: BackgroundType; label: string }[] = [
  { value: "clinic-bokeh", label: "Clinic — bokeh, unrecognisable" },
  { value: "white-studio", label: "White studio backdrop" },
  { value: "black-studio", label: "Black studio backdrop" },
  { value: "custom-color", label: "Custom colour backdrop" },
  { value: "upload-own", label: "Upload your own studio/clinic" },
];

const SCRUB_COLORS = [
  { label: "Navy Blue", value: "navy blue" },
  { label: "Royal Blue", value: "royal blue" },
  { label: "Ceil Blue", value: "ceil blue" },
  { label: "Hunter Green", value: "hunter green" },
  { label: "Sage Green", value: "sage green" },
  { label: "Burgundy", value: "burgundy" },
  { label: "Plum / Purple", value: "plum purple" },
  { label: "Charcoal", value: "charcoal" },
  { label: "Black", value: "black" },
  { label: "White", value: "white" },
  { label: "Dusty Pink", value: "dusty pink" },
  { label: "Teal", value: "teal" },
];

function cardDisplayName(scenarioId: string): string {
  if (scenarioId.startsWith("custom")) {
    const parts = scenarioId.split("|");
    if (parts.length >= 3) {
      const outfitLabel = OUTFIT_OPTIONS.find((o) => o.value === parts[1])?.label ?? parts[1];
      const bgLabel = BACKGROUND_OPTIONS.find((b) => b.value === parts[2])?.label ?? parts[2];
      return `${outfitLabel} — ${bgLabel}`;
    }
    if (parts.length === 2) return OUTFIT_OPTIONS.find((o) => o.value === parts[1])?.label ?? parts[1];
    return "Custom portrait";
  }
  return scenarioId;
}

export default function AiPortraitStudio() {
  const [outfitType, setOutfitType] = useState<OutfitType>("white-shirt-jeans");
  const [scrubColor, setScrubColor] = useState("navy blue");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("clinic-bokeh");
  const [backdropColor, setBackdropColor] = useState("#ffffff");
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [backgroundUploadedUrl, setBackgroundUploadedUrl] = useState<string | null>(null);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);

  const [sourcePhoto, setSourcePhoto] = useState<AiSourcePhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const [saveClientName, setSaveClientName] = useState("");
  const [savePopoverOpen, setSavePopoverOpen] = useState<number | null>(null);
  const [savingPortrait, setSavingPortrait] = useState<number | null>(null);
  const [regenJobIds, setRegenJobIds] = useState<Map<number, string>>(new Map());

  const [animatePortraitId, setAnimatePortraitId] = useState<number | null>(null);
  const [animateCameraMotion, setAnimateCameraMotion] = useState<string>("cinematic-drift");
  const [animateJobId, setAnimateJobId] = useState<string | null>(null);
  const [animateStatus, setAnimateStatus] = useState<string>("");
  const [animateProgress, setAnimateProgress] = useState(0);
  const [animateVideoUrl, setAnimateVideoUrl] = useState<string | null>(null);
  const animatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}api/ai-portrait/jobs/${jobId}/status`);
        if (!r.ok) return;
        const data = await r.json() as { cards: CardState[] };
        setCards(data.cards);
        const done = data.cards.every((c) => c.status === "success" || c.status === "failed");
        if (done) {
          clearInterval(pollRef.current!);
          setGenerating(false);
          const failed = data.cards.filter((c) => c.status === "failed").length;
          const ok = data.cards.filter((c) => c.status === "success").length;
          if (failed === 0) toast.success(`All ${ok} portraits generated.`);
          else toast.warning(`${ok} succeeded, ${failed} failed.`);
        }
      } catch {}
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const handleUrlIngest = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/source-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: urlInput.trim(), clientName }),
      });
      const data = await r.json() as AiSourcePhoto & { error?: string };
      if (!r.ok) throw new Error(data.error || "URL ingestion failed");
      setSourcePhoto(data);
      setPhotoPreview(data.photoUrl);
      setShowUrlInput(false);
      toast.success("Reference photo loaded from URL");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load photo from URL");
    } finally {
      setUrlLoading(false);
    }
  };

  const handleFileDrop = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("clientName", clientName);
      const r = await fetch(`${BASE}api/ai-portrait/source`, { method: "POST", body: fd });
      const data = await r.json() as AiSourcePhoto & { error?: string };
      if (!r.ok) throw new Error(data.error || "Upload failed");
      setSourcePhoto(data);
      toast.success("Reference photo uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }, [clientName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  const handleBackgroundFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setBackgroundPreviewUrl(URL.createObjectURL(file));
    setBackgroundUploadedUrl(null);
    setBackgroundUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${BASE}api/ai-portrait/background-image`, { method: "POST", body: fd });
      const data = await r.json() as { url?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Upload failed");
      setBackgroundUploadedUrl(data.url!);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setBackgroundPreviewUrl(null);
    } finally {
      setBackgroundUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!sourcePhoto) { toast.error("Upload a reference photo first"); return; }
    if (backgroundType === "upload-own" && !backgroundUploadedUrl) { toast.error("Upload a background image first"); return; }
    const scenarioId = `custom|${outfitType}|${backgroundType}`;
    setGenerating(true);
    setCards([{ scenarioId, status: "idle" }]);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePhotoId: sourcePhoto.id,
          clientName,
          scenarios: [{
            id: scenarioId,
            outfitType,
            backgroundType,
            scrubColor: outfitType === "scrubs" ? scrubColor : undefined,
            backdropColor: backgroundType === "custom-color" ? backdropColor : undefined,
            backgroundImageUrl: backgroundType === "upload-own" ? backgroundUploadedUrl : undefined,
            aspectRatio,
          }],
        }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Failed to start generation");
      setJobId(data.jobId!);
      toast.success("Generation started — your portrait will appear in around 15 seconds.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
      setGenerating(false);
    }
  };

  const handleSave = async (card: CardState, applyWatermark: boolean) => {
    if (!card.portraitId) return;
    setSavingPortrait(card.portraitId);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/${card.portraitId}/save-to-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyWatermark, clientName: saveClientName || clientName }),
      });
      const data = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(data.error || "Save failed");
      toast.success("Saved to Approvals for client review");
      setSavePopoverOpen(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingPortrait(null);
    }
  };

  const handleRateLimitedRetry = async (card: CardState) => {
    if (!sourcePhoto) { toast.error("Reference photo is no longer available — please re-upload and regenerate"); return; }
    const cfg = {
      id: card.scenarioId,
      outfitType,
      backgroundType,
      scrubColor: outfitType === "scrubs" ? scrubColor : undefined,
      backdropColor: backgroundType === "custom-color" ? backdropColor : undefined,
      backgroundImageUrl: backgroundType === "upload-own" ? backgroundUploadedUrl ?? undefined : undefined,
      aspectRatio,
    };
    try {
      const r = await fetch(`${BASE}api/ai-portrait/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePhotoId: sourcePhoto.id, clientName, scenarios: [cfg] }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Retry failed");
      const newJobId = data.jobId!;
      setCards((prev) => prev.map((c) => c.scenarioId === card.scenarioId ? { ...c, status: "generating" } : c));
      toast.success("Retrying portrait generation...");
      const retryPoll = setInterval(async () => {
        try {
          const sr = await fetch(`${BASE}api/ai-portrait/jobs/${newJobId}/status`);
          if (!sr.ok) { clearInterval(retryPoll); return; }
          const sd = await sr.json() as { cards: CardState[] };
          const updated = sd.cards.find((c) => c.scenarioId === card.scenarioId);
          if (updated && (updated.status === "success" || updated.status === "failed")) {
            clearInterval(retryPoll);
            setCards((prev) => prev.map((c) => c.scenarioId === card.scenarioId ? { ...c, ...updated } : c));
            if (updated.status === "success") toast.success("Portrait generated.");
            else toast.error("Generation failed again.");
          }
        } catch {}
      }, 500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    }
  };

  const CAMERA_MOTION_LABELS: Record<string, string> = {
    "slow-pan-left": "Slow pan — left to right",
    "slow-pan-right": "Slow pan — right to left",
    "dolly-in": "Slow dolly in (zoom toward subject)",
    "dolly-out": "Slow dolly out (pull back)",
    "tilt-up": "Slow tilt up",
    "cinematic-drift": "Cinematic drift (micro-pan and dolly)",
  };

  const openAnimateModal = (portraitId: number) => {
    setAnimatePortraitId(portraitId);
    setAnimateJobId(null);
    setAnimateStatus("");
    setAnimateProgress(0);
    setAnimateVideoUrl(null);
    if (animatePollRef.current) clearInterval(animatePollRef.current);
  };

  const closeAnimateModal = () => {
    setAnimatePortraitId(null);
    setAnimateJobId(null);
    setAnimateStatus("");
    setAnimateProgress(0);
    setAnimateVideoUrl(null);
    if (animatePollRef.current) { clearInterval(animatePollRef.current); animatePollRef.current = null; }
  };

  const handleAnimate = async () => {
    if (!animatePortraitId) return;
    setAnimateStatus("Submitting…");
    setAnimateProgress(0.03);
    setAnimateVideoUrl(null);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/${animatePortraitId}/animate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraMotion: animateCameraMotion, clientName }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Failed to start animation");
      const jid = data.jobId!;
      setAnimateJobId(jid);
      setAnimateStatus("Queued…");
      animatePollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`${BASE}api/ai-portrait/animate/${jid}/status`);
          if (!sr.ok) return;
          const sd = await sr.json() as { status: string; progress: number; message: string; videoUrl?: string; error?: string };
          setAnimateStatus(sd.message);
          setAnimateProgress(sd.progress);
          if (sd.status === "done") {
            clearInterval(animatePollRef.current!); animatePollRef.current = null;
            setAnimateVideoUrl(`${BASE}${sd.videoUrl?.replace(/^\//, "")}`);
            toast.success("Motion reel saved to library!");
          } else if (sd.status === "failed") {
            clearInterval(animatePollRef.current!); animatePollRef.current = null;
            toast.error(sd.error || "Motion reel generation failed");
            setAnimateStatus(sd.error || "Failed");
          }
        } catch {}
      }, 2000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Animation failed");
      setAnimateStatus("");
      setAnimateProgress(0);
    }
  };

  const handleDownload = (card: CardState, scenarioName: string) => {
    if (!card.outputImageUrl) return;
    const a = document.createElement("a");
    a.href = card.outputImageUrl;
    a.download = `portrait-${scenarioName.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.target = "_blank";
    a.click();
  };

  const [savingAll, setSavingAll] = useState(false);
  const handleSaveAll = async (applyWatermark: boolean) => {
    const successful = cards.filter((c) => c.status === "success" && c.portraitId);
    if (!successful.length) return;
    setSavingAll(true);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/save-batch-to-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portraitIds: successful.map((c) => c.portraitId!),
          applyWatermark,
          clientName: clientName,
        }),
      });
      const data = await r.json() as { success?: boolean; count?: number; error?: string };
      if (!r.ok) throw new Error(data.error || "Save failed");
      toast.success(`${data.count} portrait${data.count !== 1 ? "s" : ""} saved to ${clientName ? `${clientName}'s` : "the"} Library`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingAll(false);
    }
  };

  const [downloadingAll, setDownloadingAll] = useState(false);
  const handleDownloadAll = async () => {
    const successful = cards.filter((c) => c.status === "success" && c.outputImageUrl);
    if (!successful.length) return;
    setDownloadingAll(true);
    const toastId = toast.loading(`Packing ${successful.length} portrait${successful.length > 1 ? "s" : ""}…`);
    try {
      const zip = new JSZip();
      await Promise.all(successful.map(async (card) => {
        const name = cardDisplayName(card.scenarioId).toLowerCase().replace(/\s+/g, "-");
        const resp = await fetch(card.outputImageUrl!);
        const blob = await resp.blob();
        zip.file(`portrait-${name}.png`, blob);
      }));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${clientName ? clientName.replace(/\s+/g, "-") + "-" : ""}portraits.zip`;
      a.click();
      toast.dismiss(toastId);
      toast.success("All portraits downloaded");
    } catch {
      toast.dismiss(toastId);
      toast.error("Download failed — try individual downloads instead");
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleRegenerate = async (card: CardState) => {
    if (!card.portraitId) return;
    try {
      const r = await fetch(`${BASE}api/ai-portrait/${card.portraitId}/regenerate`, { method: "POST" });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Regen failed");
      setRegenJobIds((prev) => { const n = new Map(prev); n.set(card.portraitId!, data.jobId!); return n; });
      setCards((prev) => prev.map((c) => c.portraitId === card.portraitId ? { ...c, status: "generating" } : c));
      toast.success("Retrying portrait generation...");
      const regenPoll = setInterval(async () => {
        const sr = await fetch(`${BASE}api/ai-portrait/jobs/${data.jobId}/status`);
        if (!sr.ok) { clearInterval(regenPoll); return; }
        const sd = await sr.json() as { cards: CardState[] };
        const updated = sd.cards.find((c) => c.scenarioId === card.scenarioId);
        if (updated && (updated.status === "success" || updated.status === "failed")) {
          clearInterval(regenPoll);
          setCards((prev) => prev.map((c) => c.portraitId === card.portraitId ? { ...c, ...updated } : c));
          if (updated.status === "success") toast.success("Portrait regenerated.");
          else toast.error("Portrait generation failed again.");
        }
      }, 1500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Regen failed");
    }
  };

  const allDone = cards.length > 0 && cards.every((c) => c.status === "success" || c.status === "failed");

  return (
    <div className="min-h-[100dvh] w-full bg-background relative">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub"><img src="/sms-logo.png" alt="Social Media Sister" className="h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" /></Link>
          <Link href="/hub"><Button variant="outline" size="sm" className="text-muted-foreground border-border/40 text-xs">← All Tools</Button></Link>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-sm hidden sm:inline">AI Portrait Studio</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* LEFT: Upload + reference */}
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold text-base mb-1">Reference Photo</h2>
            <p className="text-sm text-muted-foreground mb-3">Upload one clear photo of the person. Gemini will use their likeness to generate portraits in each chosen scenario.</p>
            <div className="space-y-2 mb-3">
              <Label htmlFor="clientName" className="text-xs">Client name (optional)</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Dr Sarah Smith" className="h-8 text-sm" />
            </div>
            <div
              className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-violet-400 bg-violet-500/10" : "border-border/40 hover:border-border/70"} ${photoPreview ? "border-solid" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !photoPreview && fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Reference" className="w-full rounded-xl object-cover max-h-72" />
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                  {!uploading && (
                    <button
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                      onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setSourcePhoto(null); }}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                  {!uploading && sourcePhoto && (
                    <div className="absolute bottom-2 left-2">
                      <Badge className="bg-green-500/80 text-white text-xs border-0"><Check className="w-3 h-3 mr-1" />Uploaded</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8 mb-1 opacity-50" />
                  <p className="text-sm font-medium">Drag a photo here or click to browse</p>
                  <p className="text-xs opacity-60">JPG, PNG, WEBP — max 20 MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />
            </div>

            {!photoPreview && (
              <div className="mt-2">
                {!showUrlInput ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() => setShowUrlInput(true)}
                  >
                    Or use a photo URL instead
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Photo URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="h-8 text-xs flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") handleUrlIngest(); }}
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={handleUrlIngest} disabled={urlLoading || !urlInput.trim()}>
                        {urlLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      onClick={() => setShowUrlInput(false)}
                    >
                      Upload a file instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!sourcePhoto || generating || (backgroundType === "upload-own" && !backgroundUploadedUrl)}
            onClick={handleGenerate}
          >
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Portrait</>}
          </Button>
          {!sourcePhoto && <p className="text-xs text-muted-foreground text-center">Upload a photo to get started</p>}
          {backgroundType === "upload-own" && !backgroundUploadedUrl && sourcePhoto && (
            <p className="text-xs text-muted-foreground text-center">Upload a background image in the options panel</p>
          )}
        </div>

        {/* MIDDLE: Look configuration */}
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-base mb-1">Choose Your Look</h2>
            <p className="text-sm text-muted-foreground">Pick an outfit and a background. One portrait per run — regenerate as many times as you like.</p>
          </div>

          {/* Outfit */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Outfit</Label>
            <Select value={outfitType} onValueChange={(v) => setOutfitType(v as OutfitType)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTFIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {outfitType === "scrubs" && (
              <div className="flex items-center gap-2 pl-1">
                <Label className="text-xs text-muted-foreground w-24 flex-shrink-0">Scrub colour</Label>
                <select
                  className="flex-1 rounded-md border border-border/40 bg-background text-xs px-2 py-1.5"
                  value={scrubColor}
                  onChange={(e) => setScrubColor(e.target.value)}
                >
                  {SCRUB_COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Background */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Background</Label>
            <Select value={backgroundType} onValueChange={(v) => {
              setBackgroundType(v as BackgroundType);
              if (v !== "upload-own") {
                setBackgroundPreviewUrl(null);
                setBackgroundUploadedUrl(null);
              }
            }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BACKGROUND_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {backgroundType === "custom-color" && (
              <div className="flex items-center gap-3 pl-1">
                <Label className="text-xs text-muted-foreground w-24 flex-shrink-0">Backdrop colour</Label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={backdropColor}
                    onChange={(e) => setBackdropColor(e.target.value)}
                    className="w-8 h-7 rounded border border-border/40 cursor-pointer bg-transparent"
                  />
                  <Input
                    value={backdropColor}
                    onChange={(e) => setBackdropColor(e.target.value)}
                    placeholder="#ffffff"
                    className="h-7 text-xs font-mono flex-1"
                    maxLength={7}
                  />
                </div>
              </div>
            )}

            {backgroundType === "upload-own" && (
              <div className="space-y-2 pl-1">
                <p className="text-xs text-muted-foreground">Upload a photo of your actual studio or clinic. The AI will place the person naturally within it.</p>
                {backgroundPreviewUrl ? (
                  <div className="relative">
                    <img src={backgroundPreviewUrl} alt="Background" className="w-full rounded-lg object-cover max-h-40 border border-border/30" />
                    {backgroundUploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                    {!backgroundUploading && (
                      <button
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                        onClick={() => { setBackgroundPreviewUrl(null); setBackgroundUploadedUrl(null); }}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                    {backgroundUploadedUrl && (
                      <div className="absolute bottom-2 left-2">
                        <Badge className="bg-green-500/80 text-white text-xs border-0"><Check className="w-3 h-3 mr-1" />Uploaded</Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="rounded-lg border-2 border-dashed border-border/40 hover:border-border/70 cursor-pointer flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground transition-colors"
                    onClick={() => backgroundFileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 opacity-50" />
                    <p className="text-xs">Click to upload background image</p>
                  </div>
                )}
                <input
                  ref={backgroundFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBackgroundFileSelect(f); e.target.value = ""; }}
                />
              </div>
            )}
          </div>

          {/* Aspect ratio */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Aspect ratio</Label>
            <div className="flex gap-2">
              {ASPECT_OPTIONS.map((ar) => (
                <button
                  key={ar}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${aspectRatio === ar ? "bg-violet-500 border-violet-500 text-white" : "border-border/40 text-muted-foreground hover:border-border"}`}
                  onClick={() => setAspectRatio(ar)}
                >{ar}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base mb-1">Results</h2>
              <p className="text-sm text-muted-foreground">
                {cards.length === 0
                  ? "Your generated portraits will appear here."
                  : allDone
                  ? "Generation complete."
                  : "Generating portraits — each takes around 15 seconds."}
              </p>
            </div>
            {cards.some((c) => c.status === "success" && c.outputImageUrl) && (
              <div className="flex gap-2 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" disabled={savingAll}>
                      {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookImage className="w-3.5 h-3.5" />}
                      Save All to Library
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 space-y-3">
                    <p className="text-sm font-medium">Save all portraits</p>
                    <p className="text-xs text-muted-foreground">Saves each portrait as a separate item in the Content Library, tagged with its scenario name.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleSaveAll(false)} disabled={savingAll}>
                        No watermark
                      </Button>
                      <Button size="sm" className="flex-1 text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={() => handleSaveAll(true)} disabled={savingAll}>
                        <Palette className="w-3 h-3 mr-1" />With watermark
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="gap-1.5"
                >
                  {downloadingAll
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  Download All
                </Button>
              </div>
            )}
          </div>

          {cards.length === 0 && !generating && (
            <div className="rounded-xl border border-dashed border-border/30 flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Sparkles className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nothing generated yet</p>
            </div>
          )}

          <div className="space-y-4">
            {cards.map((card) => {
              const name = cardDisplayName(card.scenarioId);
              return (
                <div key={card.scenarioId} className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border/20">
                    <span className="text-sm font-medium truncate">{name}</span>
                    <StatusBadge status={card.status} retryAfter={card.retryAfter} />
                  </div>

                  {card.status === "success" && card.outputImageUrl && (
                    <div>
                      <img src={card.outputImageUrl} alt={name} className="w-full object-cover max-h-64" />
                      <div className="p-3 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleDownload(card, name)}>
                          <Download className="w-3.5 h-3.5 mr-1.5" />Download
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-950/30" onClick={() => card.portraitId && openAnimateModal(card.portraitId)}>
                          <Film className="w-3.5 h-3.5 mr-1.5" />Animate
                        </Button>
                        <Popover open={savePopoverOpen === card.portraitId} onOpenChange={(o) => setSavePopoverOpen(o ? card.portraitId! : null)}>
                          <PopoverTrigger asChild>
                            <Button size="sm" className="flex-1 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                              <BookImage className="w-3.5 h-3.5 mr-1.5" />Save to Library
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-4 space-y-3">
                            <p className="text-sm font-medium">Save to Approval Library</p>
                            <p className="text-xs text-muted-foreground">Adds the portrait to an approval batch with the ASA compliance note pre-filled.</p>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Client name</Label>
                              <Input
                                value={saveClientName || clientName}
                                onChange={(e) => setSaveClientName(e.target.value)}
                                placeholder="e.g. Dr Sarah Smith"
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleSave(card, false)} disabled={savingPortrait === card.portraitId}>
                                {savingPortrait === card.portraitId ? <Loader2 className="w-3 h-3 animate-spin" /> : "No watermark"}
                              </Button>
                              <Button size="sm" className="flex-1 text-xs bg-violet-600 hover:bg-violet-700 text-white" onClick={() => handleSave(card, true)} disabled={savingPortrait === card.portraitId}>
                                {savingPortrait === card.portraitId ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Palette className="w-3 h-3 mr-1" />With watermark</>}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {card.status === "generating" && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                      <p className="text-xs">Generating portrait...</p>
                    </div>
                  )}

                  {card.status === "idle" && (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-xs">Waiting...</p>
                    </div>
                  )}

                  {card.status === "rate-limited" && (
                    <div className="p-4 space-y-3">
                      <div className="flex flex-col items-center gap-2 text-amber-400">
                        <Clock className="w-5 h-5" />
                        <p className="text-xs text-center">Rate limited. Retrying automatically in 30s.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs border-amber-500/40 text-amber-300 hover:text-amber-100"
                        onClick={() => card.portraitId ? handleRegenerate(card) : handleRateLimitedRetry(card)}
                      >
                        <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />Retry now
                      </Button>
                    </div>
                  )}

                  {card.status === "failed" && (
                    <div className="p-4 space-y-2">
                      <div className="flex items-start gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-xs">{card.failureReason || "Generation failed."}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => card.portraitId ? handleRegenerate(card) : handleRateLimitedRetry(card)}
                      >
                        <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />Retry
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Animate as Reel Modal ── */}
      {animatePortraitId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) closeAnimateModal(); }}>
          <div className="bg-zinc-900 border border-border/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-violet-400" />
                <h3 className="font-semibold text-base">Animate as Reel</h3>
              </div>
              <button onClick={closeAnimateModal} className="text-muted-foreground hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Generates a 6-second seamless video clip from this still portrait using subtle camera motion. The person stays completely still — the camera does the work. Saved directly to your Reel Library on completion.
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Camera motion</Label>
              <Select value={animateCameraMotion} onValueChange={setAnimateCameraMotion} disabled={!!animateJobId && !animateVideoUrl && !animateStatus.startsWith("Failed")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMERA_MOTION_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {animateJobId && !animateVideoUrl && !animateStatus.startsWith("Failed") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />{animateStatus}</span>
                  <span>{Math.round(animateProgress * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${animateProgress * 100}%` }} />
                </div>
                <p className="text-xs text-zinc-600">AI video generation takes 30–90 seconds. You can close this modal — the reel will save automatically.</p>
              </div>
            )}

            {animateVideoUrl && (
              <div className="space-y-3">
                <video src={animateVideoUrl} autoPlay loop muted playsInline className="w-full rounded-xl border border-border/30 aspect-[9/16] object-cover max-h-64" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { const a = document.createElement("a"); a.href = animateVideoUrl; a.download = "motion-reel.mp4"; a.click(); }}>
                    <Download className="w-3.5 h-3.5" />Download MP4
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={closeAnimateModal}>
                    <Check className="w-3.5 h-3.5" />Done
                  </Button>
                </div>
              </div>
            )}

            {!animateJobId && (
              <Button onClick={handleAnimate} className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                <Play className="w-4 h-4" />Generate Motion Reel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, retryAfter }: { status: CardStatus; retryAfter?: number }) {
  if (status === "idle") return <Badge variant="outline" className="text-xs text-muted-foreground">Waiting</Badge>;
  if (status === "generating") return <Badge className="text-xs bg-violet-500/20 text-violet-300 border-violet-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
  if (status === "success") return <Badge className="text-xs bg-green-500/20 text-green-300 border-green-500/30"><Check className="w-3 h-3 mr-1" />Done</Badge>;
  if (status === "rate-limited") return <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Rate limited</Badge>;
  if (status === "failed") return <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
  return null;
}
