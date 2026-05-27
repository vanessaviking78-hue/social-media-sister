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

const BASE = import.meta.env.BASE_URL;

type ScenarioCategory = "clinical" | "lifestyle" | "brand";
type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";
type AspectRatio = "1:1" | "3:4" | "9:16";

interface AiScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  hasScrubColor: boolean;
  hasOutfitStyle: boolean;
}

interface ScenarioConfig {
  id: string;
  scrubColor?: string;
  outfitStyle?: string;
  aspectRatio: AspectRatio;
}

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

const CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  clinical: "Clinical",
  lifestyle: "Lifestyle",
  brand: "Brand",
};

const CATEGORY_COLORS: Record<ScenarioCategory, string> = {
  clinical: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 hover:border-cyan-500/60",
  lifestyle: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
  brand: "from-violet-500/20 to-violet-500/5 border-violet-500/30 hover:border-violet-500/60",
};

const CATEGORY_BADGE: Record<ScenarioCategory, string> = {
  clinical: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  lifestyle: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  brand: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

const ASPECT_OPTIONS: AspectRatio[] = ["1:1", "3:4", "9:16"];

const OUTFIT_OPTIONS = [
  "smart casual", "business professional", "athleisure / activewear",
  "casual everyday", "elegant / formal", "creative / artistic",
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

export default function AiPortraitStudio() {
  const [scenarios, setScenarios] = useState<AiScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);

  const [sourcePhoto, setSourcePhoto] = useState<AiSourcePhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Map<string, ScenarioConfig>>(new Map());
  const [configs, setConfigs] = useState<Map<string, ScenarioConfig>>(new Map());

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

  useEffect(() => {
    fetch(`${BASE}api/ai-portrait/scenarios`)
      .then((r) => r.json())
      .then((data: AiScenario[]) => { setScenarios(data); setLoadingScenarios(false); })
      .catch(() => { toast.error("Failed to load scenarios"); setLoadingScenarios(false); });
  }, []);

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

  const toggleScenario = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= 6) { toast.warning("Maximum 6 scenarios per generation run"); return prev; }
      const existing = configs.get(id) ?? { id, aspectRatio: "3:4" };
      next.set(id, existing);
      return next;
    });
  };

  const updateConfig = (scenarioId: string, patch: Partial<ScenarioConfig>) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(scenarioId);
      if (!cur) return prev;
      next.set(scenarioId, { ...cur, ...patch });
      return next;
    });
    setConfigs((prev) => {
      const next = new Map(prev);
      const cur = next.get(scenarioId) ?? { id: scenarioId, aspectRatio: "3:4" };
      next.set(scenarioId, { ...cur, ...patch });
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!sourcePhoto) { toast.error("Upload a reference photo first"); return; }
    if (selected.size === 0) { toast.error("Select at least one scenario"); return; }
    setGenerating(true);
    setCards([...selected.values()].map((cfg) => ({ scenarioId: cfg.id, status: "idle" })));
    try {
      const r = await fetch(`${BASE}api/ai-portrait/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePhotoId: sourcePhoto.id,
          clientName,
          scenarios: [...selected.values()],
        }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(data.error || "Failed to start generation");
      setJobId(data.jobId!);
      toast.success("Generation started — results appear as each portrait finishes.");
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
    const cfg = selected.get(card.scenarioId) ?? { id: card.scenarioId, aspectRatio: "3:4" as const };
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
        const sc = scenarioById(card.scenarioId);
        const name = (sc?.name ?? card.scenarioId).toLowerCase().replace(/\s+/g, "-");
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

  const scenarioById = (id: string) => scenarios.find((s) => s.id === id);
  const categorised = (["clinical", "lifestyle", "brand"] as ScenarioCategory[])
    .map((cat) => ({ cat, items: scenarios.filter((s) => s.category === cat) }))
    .filter((g) => g.items.length > 0);

  const allDone = cards.length > 0 && cards.every((c) => c.status === "success" || c.status === "failed");

  return (
    <div className="min-h-[100dvh] w-full bg-background">
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

          {/* Summary */}
          {selected.size > 0 && (
            <div className="rounded-xl border border-border/30 bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected</p>
              {[...selected.values()].map((cfg) => {
                const sc = scenarioById(cfg.id);
                return sc ? (
                  <div key={cfg.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{sc.name}</span>
                    <button onClick={() => toggleScenario(cfg.id)}><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                  </div>
                ) : null;
              })}
              <p className="text-xs text-muted-foreground mt-1">{selected.size}/6 selected</p>
            </div>
          )}

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!sourcePhoto || selected.size === 0 || generating}
            onClick={handleGenerate}
          >
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate {selected.size > 0 ? `${selected.size} Portrait${selected.size > 1 ? "s" : ""}` : "Portraits"}</>}
          </Button>
          {!sourcePhoto && <p className="text-xs text-muted-foreground text-center">Upload a photo to get started</p>}
        </div>

        {/* MIDDLE: Scenario selector */}
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-base mb-1">Choose Scenarios</h2>
            <p className="text-sm text-muted-foreground">Pick up to 6. Each generates one portrait.</p>
          </div>
          {loadingScenarios ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-5">
              {categorised.map(({ cat, items }) => (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{CATEGORY_LABELS[cat]}</p>
                  <div className="space-y-2">
                    {items.map((sc) => {
                      const isSelected = selected.has(sc.id);
                      const cfg = selected.get(sc.id);
                      return (
                        <div key={sc.id} className={`rounded-xl border bg-gradient-to-br ${CATEGORY_COLORS[cat]} transition-all`}>
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => toggleScenario(sc.id)}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-violet-500 border-violet-500" : "border-border/50"}`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm font-medium flex-1">{sc.name}</span>
                            <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE[cat]}`}>{CATEGORY_LABELS[cat]}</Badge>
                          </div>

                          {isSelected && cfg && (
                            <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/20 mt-0 pt-2" onClick={(e) => e.stopPropagation()}>
                              {sc.hasScrubColor && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Scrub colour</Label>
                                  <select
                                    className="flex-1 rounded-md border border-border/40 bg-background text-xs px-2 py-1"
                                    value={cfg.scrubColor ?? "navy blue"}
                                    onChange={(e) => updateConfig(sc.id, { scrubColor: e.target.value })}
                                  >
                                    {SCRUB_COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                  </select>
                                </div>
                              )}
                              {sc.hasOutfitStyle && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Outfit style</Label>
                                  <select
                                    className="flex-1 rounded-md border border-border/40 bg-background text-xs px-2 py-1"
                                    value={cfg.outfitStyle ?? "smart casual"}
                                    onChange={(e) => updateConfig(sc.id, { outfitStyle: e.target.value })}
                                  >
                                    {OUTFIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Aspect ratio</Label>
                                <div className="flex gap-1">
                                  {ASPECT_OPTIONS.map((ar) => (
                                    <button
                                      key={ar}
                                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${cfg.aspectRatio === ar ? "bg-violet-500 border-violet-500 text-white" : "border-border/40 text-muted-foreground hover:border-border"}`}
                                      onClick={() => updateConfig(sc.id, { aspectRatio: ar })}
                                    >{ar}</button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              const sc = scenarioById(card.scenarioId);
              const name = sc?.name ?? card.scenarioId;
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
