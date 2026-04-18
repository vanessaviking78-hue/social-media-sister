import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Layers, Loader2, Download, X, Sparkles, Wand2,
  BookOpen, ImagePlus, CalendarDays, BarChart3, ShieldCheck,
  MessageSquareText, PenTool, ChevronLeft, ChevronRight,
  CloudUpload, FileText, Plus, Palette, Check, Copy,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  FONT_OPTIONS, LOGO_POSITIONS, STORY_BACKGROUNDS,
  STORY_WIDTH, STORY_HEIGHT, drawStory, loadGoogleFonts,
} from "@/lib/slide-utils";
import { authHeaders } from "@/lib/use-approval";
import { usePresets, type ClientPreset, type PresetStyleFields } from "@/lib/use-presets";
import PresetSelector from "@/components/preset-selector";

const BASE = import.meta.env.BASE_URL || "/";
const api = (p: string) => `${BASE}api${p}`;

const OVERLAY_BASE_COLORS = [
  { label: "Pink", r: 236, g: 72, b: 153 },
  { label: "Purple", r: 139, g: 92, b: 246 },
  { label: "Blue", r: 59, g: 130, b: 246 },
  { label: "Teal", r: 20, g: 184, b: 166 },
  { label: "Rose", r: 244, g: 63, b: 94 },
  { label: "Amber", r: 245, g: 158, b: 11 },
  { label: "Emerald", r: 16, g: 185, b: 129 },
  { label: "Black", r: 0, g: 0, b: 0 },
  { label: "White", r: 255, g: 255, b: 255 },
];

function makeOverlayRgba(color: { r: number; g: number; b: number }, opacity: number) {
  return `rgba(${color.r},${color.g},${color.b},${opacity.toFixed(2)})`;
}

type Step = "content" | "design" | "generate";

export default function Stories() {
  const [step, setStep] = useState<Step>("content");
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedBgs, setSelectedBgs] = useState<Set<string>>(new Set([STORY_BACKGROUNDS[0].file]));
  const [font, setFont] = useState(FONT_OPTIONS[0].value);
  const [subheadingFont, setSubheadingFont] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(54);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlayBaseColor, setOverlayBaseColor] = useState(OVERLAY_BASE_COLORS[0]);
  const [overlayOpacity, setOverlayOpacity] = useState(0.75);
  const [footerText, setFooterText] = useState("Type your answer in the comments");
  const [bgOpacity, setBgOpacity] = useState(0.7);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [logoSize, setLogoSize] = useState(120);
  const [textAlign, setTextAlign] = useState("left");
  const [textBoxOutline, setTextBoxOutline] = useState(false);
  const [textBoxOutlineColor, setTextBoxOutlineColor] = useState("#ffffff");

  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("aesthetics");
  const [tone, setTone] = useState("warm & professional");
  const [topics, setTopics] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const [csvText, setCsvText] = useState("");
  const [manualQuestion, setManualQuestion] = useState("");

  const [previews, setPreviews] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [ccWorkspaces, setCcWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedCcWorkspace, setSelectedCcWorkspace] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgCache = useRef<Record<string, HTMLImageElement>>({});
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const { presets, loading: presetsLoading, savePreset, updatePreset, deletePreset, uploadLogo } = usePresets();

  useEffect(() => { loadGoogleFonts(); }, []);

  useEffect(() => {
    fetch(api("/cloud-campaign/workspaces"), { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.workspaces) setCcWorkspaces(d.workspaces); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoUrl(url);
      const img = new Image();
      img.onload = () => { logoImgRef.current = img; };
      img.src = url;
      return () => URL.revokeObjectURL(url);
    } else {
      logoImgRef.current = null;
      setLogoUrl("");
    }
  }, [logoFile]);

  const applyPreset = useCallback((preset: ClientPreset) => {
    setSelectedPresetId(preset.id);
    setFont(preset.fontFamily);
    setSubheadingFont(preset.subheadingFont || preset.fontFamily);
    setFontSize(preset.fontSize);
    setTextColor(preset.textColor);
    setLogoPosition(preset.logoPosition);
    setLogoSize(preset.logoSize);
    if (preset.overlayColor) {
      const match = preset.overlayColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 0.75;
        const found = OVERLAY_BASE_COLORS.find((c) => c.r === r && c.g === g && c.b === b);
        if (found) setOverlayBaseColor(found);
        else setOverlayBaseColor({ label: "Custom", r, g, b });
        setOverlayOpacity(a);
      }
    }
    if (preset.logoUrl) {
      setCurrentLogoUrl(preset.logoUrl);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { logoImgRef.current = img; setLogoUrl(preset.logoUrl!); };
      img.src = preset.logoUrl;
    } else {
      setCurrentLogoUrl(null);
      setLogoUrl("");
      logoImgRef.current = null;
    }
    if (preset.ccWorkspaceId) {
      setSelectedCcWorkspace(preset.ccWorkspaceId);
    }
    setTextAlign(preset.textAlign || "left");
    setTextBoxOutline(preset.textBoxOutline ?? false);
    setTextBoxOutlineColor(preset.textBoxOutlineColor || "#ffffff");
    toast.success(`Loaded preset: ${preset.name}`);
  }, []);

  const getCurrentStyles = useCallback((): PresetStyleFields => ({
    pageColor: "#000000",
    overlayColor: makeOverlayRgba(overlayBaseColor, overlayOpacity),
    fontFamily: font,
    subheadingFont,
    fontSize,
    textColor,
    lineSpacing: 1.15,
    cornerStyle: "none",
    cornerColor: "#d4af37",
    textPosition: "center-center",
    textAlign,
    textBoxOutline,
    textBoxOutlineColor,
    logoPosition,
    logoSize,
  }), [overlayBaseColor, overlayOpacity, font, subheadingFont, fontSize, textColor, textAlign, textBoxOutline, textBoxOutlineColor, logoPosition, logoSize]);

  const loadBgImg = useCallback((file: string): Promise<HTMLImageElement> => {
    if (bgImgCache.current[file]) return Promise.resolve(bgImgCache.current[file]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { bgImgCache.current[file] = img; resolve(img); };
      img.onerror = reject;
      img.src = `${BASE}story-backgrounds/${file}`;
    });
  }, []);

  const toggleBg = useCallback((file: string) => {
    setSelectedBgs((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        if (next.size > 1) next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  const selectAllBgs = useCallback(() => {
    setSelectedBgs(new Set(STORY_BACKGROUNDS.map((b) => b.file)));
  }, []);

  const selectOneBg = useCallback((file: string) => {
    setSelectedBgs(new Set([file]));
  }, []);

  const generateAI = useCallback(async () => {
    if (!topics.trim()) { toast.error("Enter at least one topic"); return; }
    if (questionCount < 1) { toast.error("Question count must be at least 1"); return; }
    setGenerating(true);
    setProgress("Starting...");
    try {
      const res = await fetch(api("/content/generate-story-questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          clientName, industry, tone,
          topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
          questionCount, extraInstructions,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `AI generation failed (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") setProgress(`Generating ${data.generated}/${data.total}...`);
            if (data.type === "complete" && data.questions) {
              setQuestions((prev) => [...prev, ...data.questions]);
              toast.success(`${data.questions.length} questions generated`);
            }
            if (data.type === "error") toast.error(data.message);
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [clientName, industry, tone, topics, questionCount, extraInstructions]);

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (results) => {
        const parsed = results.data.flat().filter((v: any) => typeof v === "string" && v.trim());
        setQuestions((prev) => [...prev, ...parsed as string[]]);
        toast.success(`${parsed.length} questions imported from CSV`);
      },
    });
    e.target.value = "";
  }, []);

  const handleCsvPaste = useCallback(() => {
    if (!csvText.trim()) return;
    const results = Papa.parse(csvText);
    const parsed = results.data.flat().filter((v: any) => typeof v === "string" && v.trim());
    setQuestions((prev) => [...prev, ...parsed as string[]]);
    toast.success(`${parsed.length} questions added`);
    setCsvText("");
  }, [csvText]);

  const addManual = useCallback(() => {
    if (!manualQuestion.trim()) return;
    const lines = manualQuestion.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setQuestions((prev) => [...prev, ...lines]);
    setManualQuestion("");
    toast.success(`${lines.length} question${lines.length > 1 ? "s" : ""} added`);
  }, [manualQuestion]);

  const removeQuestion = useCallback((idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const overlayColor = makeOverlayRgba(overlayBaseColor, overlayOpacity);
  const bgFilesKey = Array.from(selectedBgs).sort().join(",");
  const bgFiles = React.useMemo(() => Array.from(selectedBgs), [bgFilesKey]);

  const renderPreviews = useCallback(async () => {
    if (questions.length === 0) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = STORY_WIDTH;
      canvas.height = STORY_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      const bgImgs = await Promise.all(bgFiles.map((f) => loadBgImg(f)));
      const shuffled = [...bgImgs];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      const urls: string[] = [];
      for (let i = 0; i < questions.length; i++) {
        const bgImg = shuffled[i % shuffled.length];
        drawStory(ctx, bgImg, questions[i], font, fontSize, textColor, overlayColor, footerText, logoImgRef.current, logoPosition, logoSize, bgOpacity, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor);
        urls.push(canvas.toDataURL("image/png"));
      }
      setPreviews(urls);
      setPreviewIdx(0);
    } catch (err: any) {
      toast.error("Failed to render previews. Check your background image.");
    }
  }, [questions, bgFiles, font, subheadingFont, fontSize, textColor, overlayColor, footerText, logoPosition, logoSize, bgOpacity, loadBgImg, textAlign, textBoxOutline, textBoxOutlineColor]);

  useEffect(() => {
    if (step === "design" && questions.length > 0) {
      const timer = setTimeout(renderPreviews, 200);
      return () => clearTimeout(timer);
    }
  }, [step, renderPreviews, questions.length]);

  useEffect(() => {
    if (step === "generate" && questions.length > 0) {
      renderPreviews();
    }
  }, [step]);

  const downloadZip = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to download"); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("stories")!;
      for (let i = 0; i < previews.length; i++) {
        const data = previews[i].split(",")[1];
        folder.file(`story-${String(i + 1).padStart(2, "0")}.png`, data, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `stories-${clientName || "export"}-${Date.now()}.zip`);
      toast.success("ZIP downloaded");
      try {
        await fetch(api("/analytics/log"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "downloaded", postType: "story", clientName, postCount: previews.length }),
        });
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [previews, clientName]);

  const pushToCC = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to push"); return; }
    if (!selectedCcWorkspace) { toast.error("Please select a Cloud Campaign workspace first"); return; }
    setPushing(true);
    try {
      const allUploadResults: { name: string; url: string }[] = [];
      const batchSize = 5;
      for (let i = 0; i < previews.length; i += batchSize) {
        const batch = previews.slice(i, i + batchSize);
        const uploadRes = await fetch(api("/content/upload-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            images: batch.map((p, j) => ({ name: `story-${i + j + 1}.png`, base64: p })),
          }),
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { results } = await uploadRes.json();
        allUploadResults.push(...results);
      }

      const posts = previews.map((_, i) => ({
        title: `Story: ${questions[i]?.slice(0, 50) || `Story ${i + 1}`}`,
        caption: questions[i] || "",
        imageUrls: [allUploadResults[i]?.url].filter(Boolean),
      }));

      const pushRes = await fetch(api("/cloud-campaign/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ posts, workspaceIds: [selectedCcWorkspace], postType: "story" }),
      });
      if (!pushRes.ok) throw new Error("Push failed");
      const pushData = await pushRes.json();
      const wsName = ccWorkspaces.find((w) => w.id === selectedCcWorkspace)?.name || "selected workspace";
      toast.success(`Pushed ${pushData.summary?.succeeded || 0} stories to ${wsName}`);
    } catch (err: any) {
      toast.error(err.message || "Push failed");
    } finally {
      setPushing(false);
    }
  }, [previews, questions, selectedCcWorkspace, ccWorkspaces]);

  const exportCsv = useCallback(() => {
    if (questions.length === 0) return;
    const csv = Papa.unparse(questions.map((q) => [q]));
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, `story-questions-${Date.now()}.csv`);
    toast.success("CSV exported");
  }, [questions]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="w-5 h-5" />
          </div>
          <h1 className="font-sans text-3xl font-bold tracking-tight">
            <span className="text-white">Social Media Sister's</span>{" "}
            <span className="text-pink-400">CyberSuite</span>
          </h1>
          <Badge variant="secondary" className="bg-accent text-xs">Stories</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="sm" className="text-muted-foreground"><Layers className="w-4 h-4 mr-2" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-2" />Single Image</Button></Link>
          <Link href="/stories"><Button variant="ghost" size="sm" className="text-pink-400 bg-pink-500/10"><BookOpen className="w-4 h-4 mr-2" />Stories</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-2" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-2" />Captions</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-2" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-2" />Analytics</Button></Link>
          <Link href="/approval"><Button variant="ghost" size="sm" className="text-muted-foreground"><ShieldCheck className="w-4 h-4 mr-2" />Approvals</Button></Link>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          {(["content", "design", "generate"] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => {
                if (s === "design" && questions.length === 0) { toast.error("Add some questions first"); return; }
                if (s === "generate" && questions.length === 0) { toast.error("Add some questions first"); return; }
                setStep(s);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                step === s ? "bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/30" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</span>
              {s === "content" ? "Content" : s === "design" ? "Design" : "Generate"}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
        </div>

        {step === "content" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  AI Question Generator
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Client Name</Label>
                      <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Skin Clinic London" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Industry</Label>
                      <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Tone</Label>
                      <Input value={tone} onChange={(e) => setTone(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Number of Questions</Label>
                      <Input type="number" min={1} max={60} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Topics (comma-separated)</Label>
                    <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="skincare, treatments, wellness tips" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Extra Instructions (optional)</Label>
                    <Textarea value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} rows={2} placeholder="Any specific style or requirements..." />
                  </div>
                  <Button onClick={generateAI} disabled={generating} className="w-full">
                    {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Questions</>}
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Import from CSV
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm mb-1.5 block">Upload CSV File</Label>
                    <Input type="file" accept=".csv" onChange={handleCsvUpload} />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">or paste CSV text below</div>
                  <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={3} placeholder="Question 1&#10;Question 2&#10;Question 3" />
                  <Button variant="outline" onClick={handleCsvPaste} disabled={!csvText.trim()} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />Import Pasted Questions
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-cyan-400" />
                  Add Manually
                </h2>
                <div className="space-y-2">
                  <Textarea
                    value={manualQuestion}
                    onChange={(e) => setManualQuestion(e.target.value)}
                    placeholder="Type one question per line..."
                    rows={4}
                  />
                  <Button onClick={addManual} disabled={!manualQuestion.trim()} className="w-full" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />Add Questions
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/40 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
                {questions.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setQuestions([])}>
                    Clear All
                  </Button>
                )}
              </div>
              {questions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No questions yet. Use AI, CSV, or add manually.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-background/50 border border-border/20 group">
                      <span className="text-xs text-muted-foreground w-6 text-center flex-shrink-0">{i + 1}</span>
                      <span className="text-sm flex-1">{q}</span>
                      <button onClick={() => removeQuestion(i)} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {questions.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => setStep("design")} className="flex-1">
                    Next: Design <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "design" && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
            <div className="space-y-5">
              <div className="bg-card border border-border/40 rounded-xl p-5">
                <PresetSelector
                  presets={presets}
                  loading={presetsLoading}
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={applyPreset}
                  onSavePreset={async (name, styles, ccWs, logoUrl, footnote) => { await savePreset(name, styles, ccWs, logoUrl, footnote); }}
                  onUpdatePreset={async (id, name, styles, ccWs, logoUrl, footnote) => { await updatePreset(id, name, styles, ccWs, logoUrl, footnote); }}
                  onDeletePreset={async (id) => { await deletePreset(id); if (selectedPresetId === id) setSelectedPresetId(null); }}
                  getCurrentStyles={getCurrentStyles}
                  logoFile={logoFile}
                  uploadLogo={uploadLogo}
                  currentLogoUrl={currentLogoUrl}
                />
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Backgrounds ({selectedBgs.size} selected)</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={selectAllBgs}>Use All</Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">Click to toggle. Multiple backgrounds rotate across stories.</p>
                <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
                  {STORY_BACKGROUNDS.map((bg) => {
                    const isSelected = selectedBgs.has(bg.file);
                    return (
                      <button
                        key={bg.file}
                        onClick={() => toggleBg(bg.file)}
                        onDoubleClick={() => selectOneBg(bg.file)}
                        className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected ? "border-pink-500 ring-2 ring-pink-500/30" : "border-border/30 hover:border-white/30 opacity-50"
                        }`}
                      >
                        <img src={`${BASE}story-backgrounds/${bg.file}`} alt={bg.label} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">Background Opacity</h3>
                <Slider value={[bgOpacity * 100]} onValueChange={(v) => setBgOpacity(v[0] / 100)} min={20} max={100} step={5} />
                <span className="text-xs text-muted-foreground mt-1 block">{Math.round(bgOpacity * 100)}%</span>
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">Overlay Colour</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {OVERLAY_BASE_COLORS.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setOverlayBaseColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        overlayBaseColor.label === c.label ? "border-white scale-110" : "border-transparent hover:border-white/40"
                      }`}
                      style={{ background: `rgb(${c.r},${c.g},${c.b})` }}
                      title={c.label}
                    />
                  ))}
                </div>
                <h3 className="text-sm font-semibold mb-2">Overlay Opacity: {Math.round(overlayOpacity * 100)}%</h3>
                <Slider value={[overlayOpacity * 100]} onValueChange={(v) => setOverlayOpacity(v[0] / 100)} min={20} max={100} step={5} />
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Heading Font</h3>
                  <Select value={font} onValueChange={setFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: f.value }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Subheading Font</h3>
                  <Select value={subheadingFont} onValueChange={setSubheadingFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: f.value }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Font Size: {fontSize}px</h3>
                  <Slider value={[fontSize]} onValueChange={(v) => setFontSize(v[0])} min={28} max={80} step={2} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Text Colour</h3>
                  <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-12 h-8 p-0 border-0" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Text Alignment</h3>
                  <div className="grid grid-cols-3 gap-1">
                    {[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }].map((opt) => (
                      <button key={opt.value} onClick={() => setTextAlign(opt.value)}
                        className={`px-2 py-2 rounded text-xs font-semibold transition-all ${textAlign === opt.value ? "bg-pink-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold">Box Outline</h3>
                    <button
                      onClick={() => setTextBoxOutline((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${textBoxOutline ? "bg-pink-500" : "bg-gray-600"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${textBoxOutline ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  {textBoxOutline && (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                      <Input value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="flex-1 bg-gray-900 border-gray-700 text-white font-mono text-xs" />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-2">Footer Text</h3>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Type your answer in the comments" />
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold">Logo (optional)</h3>
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                {logoUrl && (
                  <div className="flex items-center gap-3">
                    <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded" />
                    <Select value={logoPosition} onValueChange={setLogoPosition}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOGO_POSITIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Slider value={[logoSize]} onValueChange={(v) => setLogoSize(v[0])} min={40} max={200} step={10} className="w-20" />
                  </div>
                )}
              </div>

              <Button onClick={() => { renderPreviews(); }} className="w-full" variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />Refresh Preview
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("content")} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-1" />Back
                </Button>
                <Button onClick={() => { renderPreviews(); setStep("generate"); }} className="flex-1">
                  Next: Generate <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              {previews.length > 0 ? (
                <>
                  <div className="relative">
                    <img src={previews[previewIdx]} alt={`Story ${previewIdx + 1}`} className="rounded-xl shadow-2xl max-h-[700px]" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur rounded-full px-4 py-2">
                      <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))} disabled={previewIdx === 0} className="text-white disabled:opacity-30">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-white font-medium">{previewIdx + 1} / {previews.length}</span>
                      <button onClick={() => setPreviewIdx(Math.min(previews.length - 1, previewIdx + 1))} disabled={previewIdx >= previews.length - 1} className="text-white disabled:opacity-30">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 text-center max-w-md">{questions[previewIdx]}</p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                  <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">Preview will appear when settings are applied</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "generate" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setStep("design")}>
                <ChevronLeft className="w-4 h-4 mr-1" />Back to Design
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={exportCsv}>
                <FileText className="w-4 h-4 mr-2" />Export CSV
              </Button>
              <Button onClick={downloadZip} disabled={downloading || previews.length === 0}>
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Download ZIP ({previews.length} stories)
              </Button>
              {ccWorkspaces.length > 0 && (
                <Select value={selectedCcWorkspace || "__none__"} onValueChange={(v) => setSelectedCcWorkspace(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">Select workspace</SelectItem>
                    {ccWorkspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={pushToCC} disabled={pushing || previews.length === 0 || !selectedCcWorkspace} variant="secondary">
                {pushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                Push to Cloud Campaign
              </Button>
            </div>

            {previews.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {previews.map((p, i) => (
                  <div key={i} className="group relative rounded-xl overflow-hidden border border-border/30 bg-card">
                    <img src={p} alt={`Story ${i + 1}`} className="w-full aspect-[9/16] object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-[11px] text-white/80 line-clamp-2">{questions[i]}</p>
                    </div>
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                <p>Rendering previews...</p>
              </div>
            )}
          </div>
        )}
      </main>
      <canvas ref={canvasRef} width={STORY_WIDTH} height={STORY_HEIGHT} className="hidden" />
    </div>
  );
}
