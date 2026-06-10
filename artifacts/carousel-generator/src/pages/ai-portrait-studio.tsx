import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import JSZip from "jszip";
import {
  Sparkles, Upload, X, Check, Download, RefreshCcw, Loader2, AlertCircle,
  Clock, BookImage, ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL;

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

interface PhotoStudioPreset {
  id: string;
  name: string;
  hasColour: boolean;
}

const PHOTO_STUDIO_PRESETS: PhotoStudioPreset[] = [
  { id: "ps-01", name: "Clean Skin Realism Enhancer",          hasColour: false },
  { id: "ps-02", name: "Textured Skin Realism Enhancer",       hasColour: false },
  { id: "ps-03", name: "Creative Director Office",             hasColour: true  },
  { id: "ps-04", name: "Black Blazer Director Editorial",      hasColour: false },
  { id: "ps-05", name: "Bathroom Vanity Skincare",             hasColour: false },
  { id: "ps-06", name: "Kitchen Island Lifestyle",             hasColour: true  },
  { id: "ps-07", name: "Patient Reassurance Clinical",         hasColour: true  },
  { id: "ps-08", name: "Luxury Clinic Injector",               hasColour: true  },
  { id: "ps-09", name: "White Shirt Sofa Casual",              hasColour: false },
  { id: "ps-10", name: "Black and White Studio Portrait",      hasColour: false },
  { id: "ps-11", name: "Consultation Space Head and Shoulders",hasColour: true  },
  { id: "ps-12", name: "Clinic Arms Crossed Confident",        hasColour: true  },
  { id: "ps-13", name: "B&W Camera Editorial",                 hasColour: false },
  { id: "ps-14", name: "Side-Lit Vintage Texture",             hasColour: false },
  { id: "ps-15", name: "Intense Eyes Close Crop",              hasColour: true  },
];

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "3:4",  label: "3:4 — Portrait" },
  { value: "1:1",  label: "1:1 — Square"   },
  { value: "9:16", label: "9:16 — Story"   },
];

export default function AiPortraitStudio() {
  // ── Upload state ───────────────────────────────────────────────────────────
  const [sourcePhoto, setSourcePhoto]       = useState<AiSourcePhoto | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [photoPreview, setPhotoPreview]     = useState<string | null>(null);
  const [clientName, setClientName]         = useState("");
  const [isDragging, setIsDragging]         = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput]             = useState("");
  const [urlLoading, setUrlLoading]         = useState(false);
  const [showUrlInput, setShowUrlInput]     = useState(false);

  // ── Preset selection ───────────────────────────────────────────────────────
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [presetColours, setPresetColours]     = useState<Record<string, string>>({});
  const [aspectRatio, setAspectRatio]         = useState<AspectRatio>("3:4");

  // ── Generation state ───────────────────────────────────────────────────────
  const [jobId, setJobId]         = useState<string | null>(null);
  const [cards, setCards]         = useState<CardState[]>([]);
  const [generating, setGenerating] = useState(false);
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saveClientName, setSaveClientName]   = useState("");
  const [savePopoverOpen, setSavePopoverOpen] = useState<number | null>(null);
  const [savingPortrait, setSavingPortrait]   = useState<number | null>(null);
  const [savingAll, setSavingAll]             = useState(false);
  const [downloadingAll, setDownloadingAll]   = useState(false);

  // ── Polling ────────────────────────────────────────────────────────────────
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
          const ok     = data.cards.filter((c) => c.status === "success").length;
          if (failed === 0) toast.success(`All ${ok} portraits generated.`);
          else              toast.warning(`${ok} generated, ${failed} failed.`);
        }
      } catch { /* silent */ }
    }, 800);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileDrop = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setPhotoPreview(URL.createObjectURL(file));
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
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
      if (!r.ok) throw new Error(data.error || "Failed");
      setSourcePhoto(data);
      setPhotoPreview(data.photoUrl);
      setShowUrlInput(false);
      toast.success("Reference photo loaded from URL");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load from URL");
    } finally {
      setUrlLoading(false);
    }
  };

  // ── Preset toggle ──────────────────────────────────────────────────────────
  const togglePreset = (id: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  };

  const selectAll   = () => setSelectedPresets(new Set(PHOTO_STUDIO_PRESETS.map((p) => p.id)));
  const selectNone  = () => setSelectedPresets(new Set());

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!sourcePhoto)          { toast.error("Upload a reference photo first"); return; }
    if (selectedPresets.size === 0) { toast.error("Select at least one preset"); return; }

    const scenarios = Array.from(selectedPresets).map((id) => {
      const preset = PHOTO_STUDIO_PRESETS.find((p) => p.id === id)!;
      return {
        id,
        scrubColor: preset.hasColour ? (presetColours[id]?.trim() || "navy blue") : undefined,
        aspectRatio,
      };
    });

    setGenerating(true);
    setCards(scenarios.map((s) => ({ scenarioId: s.id, status: "idle" })));

    try {
      const r = await fetch(`${BASE}api/ai-portrait/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePhotoId: sourcePhoto.id, clientName, scenarios }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Failed to start generation");
      setJobId(data.jobId!);
      toast.success(`Generating ${scenarios.length} portrait${scenarios.length > 1 ? "s" : ""}. Each takes around 15 seconds.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setGenerating(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
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

  const handleSaveAll = async (applyWatermark: boolean) => {
    const successful = cards.filter((c) => c.status === "success" && c.portraitId);
    if (!successful.length) return;
    setSavingAll(true);
    try {
      const r = await fetch(`${BASE}api/ai-portrait/save-batch-to-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portraitIds: successful.map((c) => c.portraitId!), applyWatermark, clientName }),
      });
      const data = await r.json() as { success?: boolean; count?: number; error?: string };
      if (!r.ok) throw new Error(data.error || "Save failed");
      toast.success(`${data.count} portrait${data.count !== 1 ? "s" : ""} saved to Library`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingAll(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = (card: CardState) => {
    if (!card.outputImageUrl) return;
    const preset = PHOTO_STUDIO_PRESETS.find((p) => p.id === card.scenarioId);
    const name = (preset?.name ?? card.scenarioId).toLowerCase().replace(/\s+/g, "-");
    const a = document.createElement("a");
    a.href = card.outputImageUrl;
    a.download = `portrait-${name}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleDownloadAll = async () => {
    const successful = cards.filter((c) => c.status === "success" && c.outputImageUrl);
    if (!successful.length) return;
    setDownloadingAll(true);
    const tid = toast.loading(`Packing ${successful.length} portrait${successful.length > 1 ? "s" : ""}…`);
    try {
      const zip = new JSZip();
      await Promise.all(successful.map(async (card) => {
        const preset = PHOTO_STUDIO_PRESETS.find((p) => p.id === card.scenarioId);
        const name = (preset?.name ?? card.scenarioId).toLowerCase().replace(/\s+/g, "-");
        const resp = await fetch(card.outputImageUrl!);
        zip.file(`portrait-${name}.png`, await resp.blob());
      }));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${clientName ? clientName.replace(/\s+/g, "-") + "-" : ""}portraits.zip`;
      a.click();
      toast.dismiss(tid);
      toast.success("All portraits downloaded");
    } catch {
      toast.dismiss(tid);
      toast.error("Download failed — try individual downloads");
    } finally {
      setDownloadingAll(false);
    }
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const doneCount    = cards.filter((c) => c.status === "success" || c.status === "failed").length;
  const successCount = cards.filter((c) => c.status === "success").length;
  const failedCount  = cards.filter((c) => c.status === "failed").length;
  const allDone      = cards.length > 0 && doneCount === cards.length;

  const progressLabel = generating
    ? `Generating ${doneCount} of ${cards.length}…`
    : allDone
      ? `Done — ${successCount} generated${failedCount > 0 ? `, ${failedCount} failed` : ""}`
      : null;

  const presetName = (id: string) => PHOTO_STUDIO_PRESETS.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <img src="/sms-logo.png" alt="Social Media Sister" className="h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <Link href="/hub">
            <Button variant="outline" size="sm" className="text-muted-foreground border-border/40 text-xs">← All Tools</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-sm hidden sm:inline">AI Photo Studio</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── LEFT: Reference photo ── */}
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold text-base mb-1">Reference Photo</h2>
            <p className="text-xs text-muted-foreground mb-3">
              One clear photo of the person. Gemini will use their likeness for every selected preset.
            </p>

            <div className="space-y-2 mb-3">
              <Label htmlFor="clientName" className="text-xs">Client name (optional)</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Dr Sarah Smith"
                className="h-8 text-sm"
              />
            </div>

            <div
              className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                isDragging ? "border-violet-400 bg-violet-500/10" : "border-border/40 hover:border-border/70"
              } ${photoPreview ? "border-solid border-border/40" : ""}`}
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
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setSourcePhoto(null); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Upload className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Drop photo here or click to browse</p>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />

            <button
              className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              <Link2 className="w-3 h-3" />
              {showUrlInput ? "Hide URL input" : "Or load from URL"}
            </button>

            {showUrlInput && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-xs flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleUrlIngest()}
                />
                <Button size="sm" onClick={handleUrlIngest} disabled={urlLoading} className="h-8 text-xs">
                  {urlLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load"}
                </Button>
              </div>
            )}
          </div>

          {/* Aspect ratio */}
          <div className="space-y-2">
            <Label className="text-xs">Output format</Label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save client name override */}
          {cards.some((c) => c.status === "success") && (
            <div className="space-y-2 pt-2 border-t border-border/20">
              <Label className="text-xs text-muted-foreground">Save-to-library client name override</Label>
              <Input
                value={saveClientName}
                onChange={(e) => setSaveClientName(e.target.value)}
                placeholder={clientName || "Client name"}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: Presets + results ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Preset cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Choose Presets</h2>
              <div className="flex gap-2">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={selectAll}>All</button>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={selectNone}>None</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {PHOTO_STUDIO_PRESETS.map((preset) => {
                const isSelected = selectedPresets.has(preset.id);
                return (
                  <div
                    key={preset.id}
                    className={`rounded-lg border p-3 cursor-pointer select-none transition-all ${
                      isSelected
                        ? "border-violet-500/70 bg-violet-500/10"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/20"
                    }`}
                    onClick={() => togglePreset(preset.id)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-violet-500 border-violet-500" : "border-border/50"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{preset.name}</p>
                        {preset.hasColour && (
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 border-violet-500/30 text-violet-400">
                            scrubs colour
                          </Badge>
                        )}
                        {preset.hasColour && isSelected && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={presetColours[preset.id] ?? ""}
                              onChange={(e) => setPresetColours((prev) => ({ ...prev, [preset.id]: e.target.value }))}
                              placeholder="e.g. navy blue"
                              className="w-full text-xs bg-background border border-border/50 rounded px-2 py-1 focus:outline-none focus:border-violet-500/50"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Generate button */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleGenerate}
                disabled={generating || selectedPresets.size === 0 || !sourcePhoto}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {progressLabel}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate {selectedPresets.size > 0 ? selectedPresets.size : ""} Selected
                  </>
                )}
              </Button>
              {!sourcePhoto && (
                <p className="text-xs text-muted-foreground">Upload a reference photo to continue</p>
              )}
            </div>
          </div>

          {/* ── Results ── */}
          {cards.length > 0 && (
            <div className="border-t border-border/20 pt-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Results</h3>
                  {progressLabel && (
                    <Badge variant="outline" className={`text-xs ${allDone && failedCount === 0 ? "border-green-500/40 text-green-400" : allDone && failedCount > 0 ? "border-amber-500/40 text-amber-400" : "border-violet-500/40 text-violet-400"}`}>
                      {progressLabel}
                    </Badge>
                  )}
                </div>
                {allDone && successCount > 1 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleDownloadAll} disabled={downloadingAll}>
                      {downloadingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                      Download All
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7" disabled={savingAll}>
                          {savingAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BookImage className="w-3 h-3 mr-1" />}
                          Save All
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3 space-y-2">
                        <p className="text-xs font-medium">Save all {successCount} portraits</p>
                        <Button size="sm" className="w-full text-xs h-7" onClick={() => handleSaveAll(true)}>With watermark</Button>
                        <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => handleSaveAll(false)}>Without watermark</Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {cards.map((card) => {
                  const name = presetName(card.scenarioId);
                  return (
                    <div key={card.scenarioId} className="rounded-lg border border-border/30 overflow-hidden bg-muted/10 flex flex-col">
                      {/* Image area */}
                      <div className="aspect-square relative bg-muted/30 flex items-center justify-center">
                        {card.status === "success" && card.outputImageUrl ? (
                          <img src={card.outputImageUrl} alt={name} className="w-full h-full object-cover" />
                        ) : card.status === "generating" || card.status === "idle" ? (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-[10px]">Generating…</span>
                          </div>
                        ) : card.status === "rate-limited" ? (
                          <div className="flex flex-col items-center gap-2 text-amber-400/70">
                            <Clock className="w-6 h-6" />
                            <span className="text-[10px]">Rate limited — waiting</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-red-400/70 px-3 text-center">
                            <AlertCircle className="w-6 h-6" />
                            <span className="text-[10px] leading-snug">{card.failureReason ?? "Generation failed"}</span>
                          </div>
                        )}
                      </div>

                      {/* Card footer */}
                      <div className="p-2 flex flex-col gap-1.5">
                        <p className="text-xs font-medium leading-snug truncate" title={name}>{name}</p>
                        {card.status === "success" && card.portraitId && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-[10px] h-6 px-1"
                              onClick={() => handleDownload(card)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                            <Popover
                              open={savePopoverOpen === card.portraitId}
                              onOpenChange={(o) => setSavePopoverOpen(o ? card.portraitId! : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 px-1">
                                  <BookImage className="w-3 h-3 mr-1" />
                                  Save
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-3 space-y-2">
                                <p className="text-xs font-medium">Save to Approvals</p>
                                <Button
                                  size="sm"
                                  className="w-full text-xs h-7"
                                  disabled={savingPortrait === card.portraitId}
                                  onClick={() => handleSave(card, true)}
                                >
                                  {savingPortrait === card.portraitId ? <Loader2 className="w-3 h-3 animate-spin" /> : "With watermark"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full text-xs h-7"
                                  disabled={savingPortrait === card.portraitId}
                                  onClick={() => handleSave(card, false)}
                                >
                                  Without watermark
                                </Button>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
