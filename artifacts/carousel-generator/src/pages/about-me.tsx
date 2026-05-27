import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ImagePlus, BookOpen, Film, Play, Palette, MessageSquareText, CalendarDays, BarChart3, ShieldCheck, Clock, Loader2, Download, RefreshCcw, User, Scissors, Grid } from "lucide-react";

const SCRIPT_FONTS = [
  { label: "Allura", value: "Allura" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Pinyon Script", value: "Pinyon Script" },
  { label: "Sacramento", value: "Sacramento" },
];

const ARROW_STYLES = [
  { label: "Curly", value: "curly" },
  { label: "Straight", value: "straight" },
  { label: "Looped", value: "loop" },
  { label: "Dashed Arc", value: "dashed" },
];

const WORD_POSITIONS = [
  { label: "Top left", value: "tl" },
  { label: "Top right", value: "tr" },
  { label: "Mid left", value: "ml" },
  { label: "Mid right", value: "mr" },
  { label: "Bottom left", value: "bl" },
  { label: "Bottom right", value: "br" },
];

const DEFAULT_POSITION_COORDS: Record<string, { x: number; y: number }> = {
  tl: { x: 0.12, y: 0.18 },
  tr: { x: 0.88, y: 0.18 },
  ml: { x: 0.08, y: 0.48 },
  mr: { x: 0.92, y: 0.48 },
  bl: { x: 0.14, y: 0.78 },
  br: { x: 0.86, y: 0.78 },
};

const ACCENT_PRESETS = [
  { label: "Warm cream", value: "#F5EEE3" },
  { label: "White", value: "#ffffff" },
  { label: "Hot pink", value: "#E91976" },
  { label: "Warm grey", value: "#B8AFA6" },
  { label: "Deep brown", value: "#5C3D2E" },
];

type Word = { text: string; pos: string };

const PREVIEW_W = 360;
const PREVIEW_H_PORTRAIT = 450;
const PREVIEW_H_STORY = 640;

function buildArrowSvgPath(sx: number, sy: number, ex: number, ey: number, style: string): string {
  const cx = (sx + ex) / 2 + (ey - sy) * 0.25;
  const cy = (sy + ey) / 2 - (ex - sx) * 0.25;
  const angle = Math.atan2(ey - cy, ex - cx);
  const ah = 8;
  const ax1 = ex - ah * Math.cos(angle - 0.45);
  const ay1 = ey - ah * Math.sin(angle - 0.45);
  const ax2 = ex - ah * Math.cos(angle + 0.45);
  const ay2 = ey - ah * Math.sin(angle + 0.45);
  const head = `M ${ax1.toFixed(1)} ${ay1.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} L ${ax2.toFixed(1)} ${ay2.toFixed(1)}`;
  if (style === "straight") return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} ${head}`;
}

export default function AboutMePage() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [cutoutDataUrl, setCutoutDataUrl] = useState<string>("");
  const [bgRemoving, setBgRemoving] = useState(false);

  const [title, setTitle] = useState("About me");
  const [words, setWords] = useState<Word[]>([
    { text: "Wife", pos: "tl" },
    { text: "Mum", pos: "tr" },
    { text: "Nurse", pos: "ml" },
    { text: "Loyal", pos: "mr" },
    { text: "Fun", pos: "bl" },
  ]);
  const [arrowStyle, setArrowStyle] = useState("curly");
  const [accentColor, setAccentColor] = useState("#F5EEE3");
  const [titleFont, setTitleFont] = useState("Allura");
  const [aspectRatio, setAspectRatio] = useState<"1080x1350" | "1080x1920">("1080x1350");
  const [blurAmount, setBlurAmount] = useState(25);
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  const [saving, setSaving] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string>("");

  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewH = aspectRatio === "1080x1920" ? PREVIEW_H_STORY : PREVIEW_H_PORTRAIT;
  const previewW = PREVIEW_W;

  const removeBackground = useCallback(async (file: File) => {
    setBgRemoving(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, {
        model: "small",
        output: { format: "image/png", quality: 0.9 },
      });
      const url = URL.createObjectURL(blob);
      setCutoutDataUrl(url);
      toast.success("Background removed");
    } catch (e: any) {
      toast.error("Background removal failed — photo uploaded as-is");
      setOriginalUrl(URL.createObjectURL(file));
    } finally {
      setBgRemoving(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setOriginalFile(file);
    const objUrl = URL.createObjectURL(file);
    setOriginalUrl(objUrl);
    setCutoutDataUrl("");
    setRenderedUrl("");
    await removeBackground(file);
  }, [removeBackground]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  }, [handleFileSelect]);

  const setWord = (i: number, field: keyof Word, val: string) => {
    setWords((prev) => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w));
  };

  const addWord = () => {
    if (words.length >= 10) return;
    const positions = Object.keys(DEFAULT_POSITION_COORDS);
    const pos = positions[words.length % positions.length];
    setWords((prev) => [...prev, { text: "", pos }]);
  };

  const removeWord = (i: number) => setWords((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!originalFile) { toast.error("Please upload a photo first"); return; }
    if (!cutoutDataUrl && !originalUrl) { toast.error("Photo not ready yet"); return; }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("original", originalFile, originalFile.name);

      if (cutoutDataUrl) {
        const resp = await fetch(cutoutDataUrl);
        const blob = await resp.blob();
        formData.append("cutout", blob, "cutout.png");
      }

      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/about-me/upload-photo`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { originalUrl: storedOriginalUrl, cutoutUrl } = await uploadResp.json() as { originalUrl: string; cutoutUrl?: string };

      const apiWords = words
        .filter((w) => w.text.trim())
        .map((w) => {
          const coords = DEFAULT_POSITION_COORDS[w.pos] ?? { x: 0.5, y: 0.5 };
          return { text: w.text, x: coords.x, y: coords.y, arrowStyle };
        });

      const createResp = await fetch(`${import.meta.env.BASE_URL}api/about-me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPhotoUrl: storedOriginalUrl,
          cutoutPhotoUrl: cutoutUrl ?? storedOriginalUrl,
          backgroundBlurAmount: blurAmount,
          backgroundOverlayOpacity: overlayOpacity,
          title,
          words: apiWords,
          arrowStyle,
          accentColor,
          titleFont,
          aspectRatio,
        }),
      });
      if (!createResp.ok) throw new Error("Save failed");
      const created = await createResp.json() as { id: number };

      const renderResp = await fetch(`${import.meta.env.BASE_URL}api/about-me/${created.id}/render`, {
        method: "POST",
      });
      if (!renderResp.ok) throw new Error("Render failed");
      const { renderedUrl: url } = await renderResp.json() as { renderedUrl: string };
      setRenderedUrl(url);
      toast.success("About Me post rendered and saved");
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const photoSrc = cutoutDataUrl || originalUrl;

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
          <p className="text-lg text-muted-foreground">Upload your photo, type your words, and get a beautifully designed About Me post.</p>
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
                    <p className="text-sm text-muted-foreground">Removing background — this takes about 10–20 seconds...</p>
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
                    <p className="text-xs text-pink-400">Background will be removed automatically in your browser</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Title */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-3">
              <Label className="text-base font-semibold">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About me" className="h-12 text-lg" />
              <div className="flex gap-3 items-center">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm text-muted-foreground">Title font</Label>
                  <Select value={titleFont} onValueChange={setTitleFont}>
                    <SelectTrigger className="h-10">
                      <SelectValue><span style={{ fontFamily: `'${titleFont}', cursive` }}>{titleFont}</span></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SCRIPT_FONTS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: `'${f.value}', cursive` }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Words */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Words ({words.length}/10)</Label>
                {words.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addWord} className="text-pink-400 border-pink-500/30">+ Add word</Button>
                )}
              </div>
              <div className="space-y-2">
                {words.map((w, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={w.text}
                      onChange={(e) => setWord(i, "text", e.target.value)}
                      placeholder={`Word ${i + 1}`}
                      className="flex-1 h-10"
                    />
                    <Select value={w.pos} onValueChange={(v) => setWord(i, "pos", v)}>
                      <SelectTrigger className="w-32 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORD_POSITIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeWord(i)} className="text-muted-foreground h-10 w-10 p-0">×</Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <Label className="text-base font-semibold">Style</Label>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Arrow style</Label>
                <Select value={arrowStyle} onValueChange={setArrowStyle}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ARROW_STYLES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Accent colour (title, words, arrows)</Label>
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.value} onClick={() => setAccentColor(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${accentColor === p.value ? "border-pink-500 ring-1 ring-pink-500" : "border-border/40"}`}
                      style={{ backgroundColor: p.value, color: p.value === "#ffffff" || p.value === "#F5EEE3" ? "#333" : "#fff" }}
                    >{p.label}</button>
                  ))}
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                    <span className="text-xs text-muted-foreground font-mono">{accentColor}</span>
                  </div>
                </div>
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
                      className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${aspectRatio === r ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30"}`}
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
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Rendering...</> : <><Scissors className="w-5 h-5" /> Generate &amp; Save</>}
            </button>
          </div>

          {/* Preview */}
          <div className="hidden lg:flex flex-col gap-3 shrink-0 sticky top-24 self-start">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground text-center">Live Preview</p>
            <div
              className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative"
              style={{ width: previewW, height: previewH }}
            >
              {photoSrc ? (
                <>
                  {/* Blurred background */}
                  <img
                    src={originalUrl || photoSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: `blur(${blurAmount * 0.4}px)`, transform: "scale(1.1)" }}
                  />
                  {/* Accent tint */}
                  {overlayOpacity > 0 && (
                    <div className="absolute inset-0" style={{ backgroundColor: accentColor, opacity: overlayOpacity / 100 }} />
                  )}
                  {/* Cutout */}
                  <div className="absolute inset-0 flex items-center justify-center" style={{ top: "20%", bottom: "20%" }}>
                    <img src={photoSrc} alt="Cutout" className="h-full object-contain drop-shadow-2xl" />
                  </div>
                  {/* SVG overlay: title + words + arrows */}
                  <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${previewW} ${previewH}`} xmlns="http://www.w3.org/2000/svg">
                    <text x={previewW / 2} y={44} fontFamily={`'${titleFont}', cursive`} fontSize={36} fill={accentColor} textAnchor="middle">{title}</text>
                    {words.filter((w) => w.text).map((w, i) => {
                      const coords = DEFAULT_POSITION_COORDS[w.pos] ?? { x: 0.5, y: 0.5 };
                      const wx = coords.x * previewW;
                      const wy = coords.y * previewH;
                      const cx = previewW / 2;
                      const cy = previewH * 0.52;
                      const seed = i * 137.5;
                      const tx = cx + Math.cos(seed) * previewW * 0.15;
                      const ty = cy + Math.sin(seed) * previewH * 0.15;
                      const path = buildArrowSvgPath(wx, wy + 4, tx, ty, arrowStyle);
                      const dash = arrowStyle === "dashed" ? "6 4" : undefined;
                      return (
                        <g key={i}>
                          <text x={wx} y={wy} fontFamily="Georgia, serif" fontSize={15} fill={accentColor} textAnchor="middle">{w.text}</text>
                          <path d={path} stroke={accentColor} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} strokeDasharray={dash} />
                        </g>
                      );
                    })}
                    {/* Sparkles */}
                    {[[0.1, 0.12, 14], [0.88, 0.5, 10], [0.18, 0.85, 9]].map(([rx, ry, fs], i) => (
                      <text key={i} x={rx * previewW} y={ry * previewH} fontSize={fs} fill={accentColor} textAnchor="middle" opacity={0.45}>✦</text>
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
            {renderedUrl && (
              <a href={renderedUrl} download="about-me.png" target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"><Download className="w-4 h-4" /> Download PNG</Button>
              </a>
            )}
            <p className="text-xs text-muted-foreground text-center leading-snug">
              {cutoutDataUrl ? "Background removed in your browser" : photoSrc ? "Original photo (removing background...)" : "Upload a photo to begin"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
