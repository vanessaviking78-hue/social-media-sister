import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, ImagePlus, BookOpen, Film, Palette, MessageSquareText,
  CalendarDays, BarChart3, Loader2, Download, User, Grid, X, GripVertical,
} from "lucide-react";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const ALL_FONTS = [
  // Script / handwritten
  { label: "Allura", value: "Allura", category: "Script" },
  { label: "Great Vibes", value: "Great Vibes", category: "Script" },
  { label: "Pinyon Script", value: "Pinyon Script", category: "Script" },
  { label: "Sacramento", value: "Sacramento", category: "Script" },
  { label: "Dancing Script", value: "Dancing Script", category: "Script" },
  { label: "Pacifico", value: "Pacifico", category: "Script" },
  { label: "Alex Brush", value: "Alex Brush", category: "Script" },
  { label: "Kaushan Script", value: "Kaushan Script", category: "Script" },
  // Serif
  { label: "Playfair Display", value: "Playfair Display", category: "Serif" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond", category: "Serif" },
  { label: "EB Garamond", value: "EB Garamond", category: "Serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville", category: "Serif" },
  { label: "Lora", value: "Lora", category: "Serif" },
  // Sans
  { label: "Poppins", value: "Poppins", category: "Sans" },
  { label: "Montserrat", value: "Montserrat", category: "Sans" },
  { label: "Raleway", value: "Raleway", category: "Sans" },
  { label: "Nunito", value: "Nunito", category: "Sans" },
  { label: "Quicksand", value: "Quicksand", category: "Sans" },
];

const ACCENT_PRESETS = [
  { label: "Warm cream", value: "#F5EEE3" },
  { label: "White", value: "#ffffff" },
  { label: "Hot pink", value: "#E91976" },
  { label: "Warm grey", value: "#B8AFA6" },
  { label: "Deep brown", value: "#5C3D2E" },
];

// ─── Scattered initial positions (avoids center where photo sits) ──────────────
const SCATTERED_COORDS: { x: number; y: number }[] = [
  { x: 0.10, y: 0.15 }, // top far-left
  { x: 0.84, y: 0.12 }, // top far-right
  { x: 0.06, y: 0.36 }, // mid-left upper
  { x: 0.90, y: 0.34 }, // mid-right upper
  { x: 0.20, y: 0.60 }, // mid-left lower
  { x: 0.80, y: 0.62 }, // mid-right lower
  { x: 0.08, y: 0.80 }, // bottom left
  { x: 0.88, y: 0.80 }, // bottom right
  { x: 0.30, y: 0.08 }, // top centre-left
  { x: 0.70, y: 0.09 }, // top centre-right
];

type Word = { text: string; x: number; y: number };

const PREVIEW_W = 340;
const PREVIEW_H_PORTRAIT = 425;
const PREVIEW_H_STORY = 604;

function heartPath(hx: number, hy: number, s: number): string {
  return `M ${hx} ${hy + s * 0.28} C ${hx - s * 0.5} ${hy + s * 0.05} ${hx - s * 0.5} ${hy - s * 0.55} ${hx} ${hy - s * 0.28} C ${hx + s * 0.5} ${hy - s * 0.55} ${hx + s * 0.5} ${hy + s * 0.05} ${hx} ${hy + s * 0.28} Z`;
}

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/ /g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  document.head.appendChild(link);
}

export default function AboutMePage() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [cutoutDataUrl, setCutoutDataUrl] = useState<string>("");
  const [bgRemoving, setBgRemoving] = useState(false);

  const [title, setTitle] = useState("About me");
  const [subtitle, setSubtitle] = useState("");
  const [words, setWords] = useState<Word[]>([
    { text: "Wife", ...SCATTERED_COORDS[0] },
    { text: "Mum", ...SCATTERED_COORDS[1] },
    { text: "Nurse", ...SCATTERED_COORDS[2] },
    { text: "Loyal", ...SCATTERED_COORDS[3] },
    { text: "Fun", ...SCATTERED_COORDS[4] },
  ]);
  const [accentColor, setAccentColor] = useState("#F5EEE3");
  const [titleFont, setTitleFont] = useState("Allura");
  const [heartSize, setHeartSize] = useState(14); // preview units (scaled up for server)
  const [aspectRatio, setAspectRatio] = useState<"1080x1350" | "1080x1920">("1080x1350");
  const [blurAmount, setBlurAmount] = useState(25);
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  const [saving, setSaving] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string>("");
  const [storedOriginalUrl, setStoredOriginalUrl] = useState<string>("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [postId, setPostId] = useState<number | null>(null);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewH = aspectRatio === "1080x1920" ? PREVIEW_H_STORY : PREVIEW_H_PORTRAIT;
  const previewW = PREVIEW_W;

  // Load all available fonts eagerly
  useEffect(() => {
    ALL_FONTS.forEach((f) => loadGoogleFont(f.value));
  }, []);

  // Load the selected title font whenever it changes
  useEffect(() => { loadGoogleFont(titleFont); }, [titleFont]);

  const removeBackground = useCallback(async (file: File) => {
    setBgRemoving(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, {
        model: "isnet",
        output: { format: "image/png", quality: 0.95 },
      });
      setCutoutDataUrl(URL.createObjectURL(blob));
      toast.success("Background removed");
    } catch {
      toast.error("Background removal failed — photo uploaded as-is");
    } finally {
      setBgRemoving(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setCutoutDataUrl("");
    setRenderedUrl("");
    setPostId(null);
    await removeBackground(file);
  }, [removeBackground]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFileSelect(file);
  }, [handleFileSelect]);

  const setWordText = (i: number, text: string) =>
    setWords((prev) => prev.map((w, idx) => idx === i ? { ...w, text } : w));

  const addWord = () => {
    if (words.length >= 10) return;
    const coord = SCATTERED_COORDS[words.length] ?? { x: 0.5, y: 0.5 };
    setWords((prev) => [...prev, { text: "", ...coord }]);
  };

  const removeWord = (i: number) => setWords((prev) => prev.filter((_, idx) => idx !== i));

  // ─── Drag-to-position on the SVG canvas ────────────────────────────────────
  const getSvgPoint = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.04, Math.min(0.97, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onWordPointerDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIdx(i);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    setWords((prev) => prev.map((w, i) => i === dragIdx ? { ...w, x: pt.x, y: pt.y } : w));
  };

  const onSvgPointerUp = () => setDragIdx(null);

  // ─── Generate + Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!originalFile) { toast.error("Please upload a photo first"); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("original", originalFile, originalFile.name);

      if (cutoutDataUrl) {
        const blob = await fetch(cutoutDataUrl).then((r) => r.blob());
        formData.append("cutout", blob, "cutout.png");
      }

      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/about-me/upload-photo`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { originalUrl: storedOrig, cutoutUrl } = await uploadResp.json() as { originalUrl: string; cutoutUrl?: string };
      setStoredOriginalUrl(storedOrig);

      const apiWords = words
        .filter((w) => w.text.trim())
        .map((w) => ({ text: w.text, x: w.x, y: w.y, arrowStyle: "heart" }));

      const saveBody = {
        originalPhotoUrl: storedOrig,
        cutoutPhotoUrl: cutoutUrl ?? storedOrig,
        backgroundBlurAmount: blurAmount,
        backgroundOverlayOpacity: overlayOpacity,
        title,
        subtitle,
        heartSize,
        words: apiWords,
        accentColor,
        titleFont,
        aspectRatio,
      };

      let id = postId;
      if (id) {
        await fetch(`${import.meta.env.BASE_URL}api/about-me/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
      } else {
        const createResp = await fetch(`${import.meta.env.BASE_URL}api/about-me`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (!createResp.ok) throw new Error("Save failed");
        const created = await createResp.json() as { id: number };
        id = created.id;
        setPostId(id);
      }

      toast.loading("Rendering image…");
      const renderResp = await fetch(`${import.meta.env.BASE_URL}api/about-me/${id}/render`, { method: "POST" });
      if (!renderResp.ok) throw new Error("Render failed");
      const { renderedUrl: url } = await renderResp.json() as { renderedUrl: string };
      setRenderedUrl(url);
      toast.dismiss();
      toast.success("About Me post ready");
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ─── Schedule flow ───────────────────────────────────────────────────────────
  const handleSchedule = async () => {
    if (!renderedUrl) { toast.error("Generate your post first"); return; }
    // Upload the rendered image to get a storable URL for scheduling
    const uploadUrl = renderedUrl.startsWith("/api/media/") ? renderedUrl : renderedUrl;
    setSchedulePosts([{
      title: title || "About Me",
      caption: "",
      imageUrls: [uploadUrl],
    }]);
    setScheduleOpen(true);
  };

  const photoSrc = cutoutDataUrl || originalUrl;
  // Heart preview size — slightly scaled for the preview canvas
  const previewHeartSize = heartSize * 0.85;
  const previewWordFontSize = 13;
  const heartWordGap = previewHeartSize * 1.6 + 10;

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      {scheduleOpen && (
        <ScheduleModal
          presetId={null}
          presetName=""
          postType="about-me"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); toast.success("Scheduled"); }}
        />
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
          <Link href="/seamless-carousel"><Button variant="ghost" size="sm" className="text-muted-foreground"><Grid className="w-4 h-4 mr-1" />Seamless</Button></Link>
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
            <User className="w-9 h-9 text-pink-400" /> About Me
          </h1>
          <p className="text-lg text-muted-foreground">Upload your photo, scatter your words, and get a beautifully designed About Me post.</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Controls */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Photo upload */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <Label className="text-base font-semibold">Your Photo</Label>
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-pink-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-pink-500/60 transition-colors"
              >
                {bgRemoving ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                    <p className="text-sm text-muted-foreground">Removing background — takes about 15–30 seconds…</p>
                  </div>
                ) : photoSrc ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={photoSrc} alt="Preview" className="h-28 object-contain rounded-lg" />
                    <p className="text-xs text-muted-foreground">{cutoutDataUrl ? "Background removed" : "Original photo"} — click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload your photo</p>
                    <p className="text-xs text-pink-400">Background removed automatically in your browser</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Title + subtitle + font */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <Label className="text-base font-semibold">Title & Font</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About me" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subtitle (optional)</Label>
                  <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Wife. Mum. Nurse." className="h-10" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Title font</Label>
                <Select value={titleFont} onValueChange={setTitleFont}>
                  <SelectTrigger className="h-10">
                    <SelectValue>
                      <span style={{ fontFamily: `'${titleFont}', cursive, serif, sans-serif` }}>{titleFont}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {["Script", "Serif", "Sans"].map((cat) => (
                      <React.Fragment key={cat}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                        {ALL_FONTS.filter((f) => f.category === cat).map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            <span style={{ fontFamily: `'${f.value}', cursive, serif, sans-serif` }}>{f.label}</span>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Words — draggable on preview */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Words ({words.length}/10)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag any word on the preview to reposition it</p>
                </div>
                {words.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addWord} className="text-pink-400 border-pink-500/30 shrink-0">+ Add word</Button>
                )}
              </div>
              <div className="space-y-2">
                {words.map((w, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <Input
                      value={w.text}
                      onChange={(e) => setWordText(i, e.target.value)}
                      placeholder={`Word ${i + 1}`}
                      className="flex-1 h-10"
                    />
                    <span className="text-xs text-muted-foreground/60 font-mono shrink-0 w-20 text-right">
                      {Math.round(w.x * 100)}%, {Math.round(w.y * 100)}%
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeWord(i)} className="text-muted-foreground h-10 w-10 p-0 shrink-0"><X className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <Label className="text-base font-semibold">Style</Label>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Accent colour — title, words, hearts</Label>
                <div className="flex gap-2 flex-wrap items-center">
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.value} onClick={() => setAccentColor(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${accentColor === p.value ? "border-pink-500 ring-1 ring-pink-500" : "border-border/40"}`}
                      style={{ backgroundColor: p.value, color: p.value === "#ffffff" || p.value === "#F5EEE3" ? "#333" : "#fff" }}
                    >{p.label}</button>
                  ))}
                  <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                  <span className="text-xs text-muted-foreground font-mono">{accentColor}</span>
                </div>
              </div>

              {/* Heart size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Heart size</Label>
                  <span className="text-sm font-semibold tabular-nums">{heartSize}</span>
                </div>
                <Slider min={6} max={28} step={1} value={[heartSize]} onValueChange={([v]) => setHeartSize(v)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Background blur</Label>
                    <span className="text-sm font-semibold tabular-nums">{blurAmount}px</span>
                  </div>
                  <Slider min={2} max={50} step={1} value={[blurAmount]} onValueChange={([v]) => setBlurAmount(v)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Colour tint overlay</Label>
                    <span className="text-sm font-semibold tabular-nums">{overlayOpacity}%</span>
                  </div>
                  <Slider min={0} max={50} step={1} value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["1080x1350", "1080x1920"] as const).map((r) => (
                    <button key={r} onClick={() => setAspectRatio(r)}
                      className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${aspectRatio === r ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30 hover:border-pink-500/40"}`}
                    >{r === "1080x1350" ? "Post (4:5)" : "Story (9:16)"}</button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !originalFile || bgRemoving}
              className="btn-shimmer w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Rendering…</> : "Generate & Save"}
            </button>

            {renderedUrl && (
              <div className="flex gap-3">
                <a href={renderedUrl} download="about-me.png" target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"><Download className="w-4 h-4" /> Download PNG</Button>
                </a>
                <Button variant="outline" onClick={handleSchedule} className="flex-1 gap-2">
                  <CalendarDays className="w-4 h-4" /> Schedule
                </Button>
              </div>
            )}
          </div>

          {/* ── Live Preview (draggable canvas) ── */}
          <div className="hidden lg:flex flex-col gap-3 shrink-0 sticky top-24 self-start">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground text-center">Live Preview</p>
            <p className="text-xs text-muted-foreground text-center -mt-1">Drag words to reposition</p>

            <div
              className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative select-none"
              style={{ width: previewW, height: previewH }}
            >
              {photoSrc ? (
                <>
                  {/* Blurred background */}
                  <img
                    src={originalUrl || photoSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={{ filter: `blur(${blurAmount * 0.4}px)`, transform: "scale(1.1)" }}
                  />
                  {/* Accent tint */}
                  {overlayOpacity > 0 && (
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: accentColor, opacity: overlayOpacity / 100 }} />
                  )}
                  {/* Cutout photo */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: "20%", bottom: "15%" }}>
                    <img src={photoSrc} alt="Cutout" className="h-full object-contain drop-shadow-2xl" />
                  </div>
                  {/* SVG overlay — draggable words */}
                  <svg
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${previewW} ${previewH}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ cursor: dragIdx !== null ? "grabbing" : "default" }}
                    onPointerMove={onSvgPointerMove}
                    onPointerUp={onSvgPointerUp}
                    onPointerLeave={onSvgPointerUp}
                  >
                    {/* Title */}
                    <text x={previewW / 2} y={38} fontFamily={`'${titleFont}', cursive, serif`} fontSize={32} fill={accentColor} textAnchor="middle"
                      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
                      {title}
                    </text>
                    {/* Subtitle */}
                    {subtitle && (
                      <text x={previewW / 2} y={56} fontFamily="Georgia, serif" fontSize={11} fill={accentColor} textAnchor="middle" opacity={0.85} letterSpacing={1}>
                        {subtitle.toUpperCase()}
                      </text>
                    )}
                    {/* Draggable words */}
                    {words.filter((w) => w.text).map((w, i) => {
                      const wx = w.x * previewW;
                      const wy = w.y * previewH;
                      const hy = wy - heartWordGap;
                      const isDragging = dragIdx === i;
                      return (
                        <g
                          key={i}
                          style={{ cursor: isDragging ? "grabbing" : "grab" }}
                          onPointerDown={(e) => onWordPointerDown(e, i)}
                        >
                          {/* Invisible larger hit area */}
                          <rect
                            x={wx - 30} y={hy - previewHeartSize}
                            width={60} height={previewHeartSize * 2 + previewWordFontSize + 12}
                            fill="transparent"
                          />
                          {/* Heart doodle — SVG path, not emoji */}
                          <path
                            d={heartPath(wx, hy, previewHeartSize)}
                            fill={accentColor}
                            opacity={isDragging ? 1 : 0.9}
                            style={{ filter: isDragging ? "drop-shadow(0 0 4px rgba(255,255,255,0.4))" : undefined }}
                          />
                          {/* Word text */}
                          <text
                            x={wx} y={wy}
                            fontFamily="Georgia, serif"
                            fontSize={previewWordFontSize}
                            fill={accentColor}
                            textAnchor="middle"
                          >{w.text}</text>
                        </g>
                      );
                    })}
                    {/* Sparkles */}
                    {[[0.08, 0.11, 13, 0.45], [0.88, 0.50, 10, 0.38], [0.16, 0.84, 9, 0.35]].map(([rx, ry, fs, op], i) => (
                      <text key={i} x={rx as number * previewW} y={ry as number * previewH} fontSize={fs} fill={accentColor} textAnchor="middle" opacity={op}>✦</text>
                    ))}
                  </svg>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 gap-3">
                  <User className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Upload a photo to see your preview</p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center leading-snug">
              {bgRemoving ? "Removing background…" : cutoutDataUrl ? "Background removed" : photoSrc ? "Using original photo" : "Upload a photo to begin"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
