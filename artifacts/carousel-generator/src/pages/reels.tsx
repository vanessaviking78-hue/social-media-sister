import React, { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Layers, Plus, Trash2, Download, Play, Square, Upload, Loader2,
  ImagePlus, BookOpen, Palette, MessageSquareText, CalendarDays,
  BarChart3, ShieldCheck, Film, Image as ImageIcon,
  Music, Search, X, Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  VIDEO_WIDTH, VIDEO_HEIGHT, FONT_OPTIONS, loadGoogleFonts,
  drawSlide, recordReelVideo, recordReelVideoMp4, drawTypewriterSlide,
} from "@/lib/slide-utils";
import type { LogoPosition } from "@workspace/db/schema";
import { saveAs } from "file-saver";

loadGoogleFonts();

type ReelSlide = {
  id: string;
  mode: "cover" | "typewriter";
  text: string;
  imageFile: File | null;
  imageElement: HTMLImageElement | null;
};

const PREVIEW_SCALE = 0.25;
const PREVIEW_W = Math.round(VIDEO_WIDTH * PREVIEW_SCALE);
const PREVIEW_H = Math.round(VIDEO_HEIGHT * PREVIEW_SCALE);

export default function Reels() {
  const [slides, setSlides] = useState<ReelSlide[]>([
    { id: crypto.randomUUID(), mode: "cover", text: "", imageFile: null, imageElement: null },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);

  const [fontFamily, setFontFamily] = useState("'Playfair Display', serif");
  const [fontSize, setFontSize] = useState(90);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlayOpacity, setOverlayOpacity] = useState(40);
  const [pageColor, setPageColor] = useState("#0d0d0d");
  const [lineSpacing, setLineSpacing] = useState(1.3);
  const [textPosition, setTextPosition] = useState<"top" | "center" | "bottom">("center");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
  const [logoSize, setLogoSize] = useState(80);

  const [coverSplit, setCoverSplit] = useState(false);
  const [coverEyebrowFont, setCoverEyebrowFont] = useState("Inter, sans-serif");
  const [coverEyebrowColor, setCoverEyebrowColor] = useState("#ff69b4");
  const [coverEyebrowSizeRatio, setCoverEyebrowSizeRatio] = useState(0.38);
  const [coverEyebrowItalic, setCoverEyebrowItalic] = useState(false);
  const [coverEyebrowUppercase, setCoverEyebrowUppercase] = useState(true);
  const [coverEyebrowWeight, setCoverEyebrowWeight] = useState(700);
  const [coverEyebrowLetterSpacing, setCoverEyebrowLetterSpacing] = useState(4);
  const [coverHeadlineItalic, setCoverHeadlineItalic] = useState(false);
  const [coverHeadlineWeight, setCoverHeadlineWeight] = useState(700);
  const [coverEyebrowArch, setCoverEyebrowArch] = useState(0.4);

  const [slideDurationSec, setSlideDurationSec] = useState(3);
  const [fadeDurationMs, setFadeDurationMs] = useState(400);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const [musicQuery, setMusicQuery] = useState("");
  const [musicGenre, setMusicGenre] = useState("");
  const [musicTracks, setMusicTracks] = useState<Array<{ id: number; title: string; duration: number; artist: string; previewUrl: string }>>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{ id: number; title: string; artist: string; previewUrl: string } | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [ccWorkspaces, setCcWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [ccWorkspaceId, setCcWorkspaceId] = useState("");
  const [ccCaption, setCcCaption] = useState("");
  const [ccPushing, setCcPushing] = useState(false);
  const [ccPushProgress, setCcPushProgress] = useState("");

  const [typewriterBgColor, setTypewriterBgColor] = useState("#0d0d0d");
  const [typewriterFill, setTypewriterFill] = useState(0.7);

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const overlayColor = `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})`;

  function drawCurrentSlide(idx: number, progress: number = 1) {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const slide = slides[idx] ?? slides[0];
    if (slide.mode === "typewriter") {
      drawTypewriterSlide(
        ctx, slide.text, progress,
        typewriterBgColor, textColor,
        fontFamily, fontSize, lineSpacing,
        logoImg, logoPosition, logoSize,
        typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT,
      );
    } else {
      drawSlide(
        ctx, slide.imageElement, slide.text,
        fontFamily, fontSize, true,
        textColor, lineSpacing, overlayColor,
        logoImg, logoPosition, logoSize,
        pageColor, "none", "#ffffff",
        1, 1, textPosition, true, fontFamily, textAlign,
        false, "#ffffff", "", 0, false,
        false, "'Great Vibes', cursive",
        coverSplit, coverEyebrowFont, coverEyebrowColor,
        coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
        coverEyebrowWeight, coverEyebrowLetterSpacing,
        coverHeadlineItalic, coverHeadlineWeight, coverEyebrowArch,
      );
    }
  }

  useEffect(() => {
    drawCurrentSlide(isPlaying ? previewIdx : activeIdx, 1);
  }, [
    slides, activeIdx, previewIdx, isPlaying,
    fontFamily, fontSize, textColor, overlayOpacity, pageColor,
    lineSpacing, textPosition, textAlign,
    logoImg, logoPosition, logoSize,
    coverSplit, coverEyebrowFont, coverEyebrowColor, coverEyebrowSizeRatio,
    coverEyebrowItalic, coverEyebrowUppercase, coverEyebrowWeight,
    coverEyebrowLetterSpacing, coverHeadlineItalic, coverHeadlineWeight, coverEyebrowArch,
    typewriterBgColor, typewriterFill,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const msPerSlide = slideDurationSec * 1000;
    const total = slides.length * msPerSlide;
    const startTime = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= total) {
        setIsPlaying(false);
        setPreviewIdx(0);
        return;
      }
      const idx = Math.min(slides.length - 1, Math.floor(elapsed / msPerSlide));
      const slideProgress = (elapsed - idx * msPerSlide) / msPerSlide;
      setPreviewIdx(idx);
      drawCurrentSlide(idx, slideProgress);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, slides.length, slideDurationSec]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspaces`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.workspaces)) setCcWorkspaces(d.workspaces); })
      .catch(() => {});
  }, []);

  const toggleSlideMode = (idx: number, mode: "cover" | "typewriter") => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, mode } : s)));
  };

  const addSlide = () => {
    if (slides.length >= 10) return;
    const newSlide = { id: crypto.randomUUID(), mode: "typewriter" as const, text: "", imageFile: null, imageElement: null };
    setSlides((prev) => [...prev, newSlide]);
    setActiveIdx(slides.length);
  };

  const removeSlide = (idx: number) => {
    if (slides.length === 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.min(prev, slides.length - 2));
  };

  const updateText = (idx: number, text: string) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, text } : s)));
  };

  const handleSlideImage = (idx: number, file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, imageFile: file, imageElement: img } : s)));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const handleLogoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setLogoFile(file); setLogoImg(img); };
    img.src = url;
  };

  const handleExport = async () => {
    const hasContent = slides.some((s) => s.text.trim() || s.imageElement);
    if (!hasContent) { toast.error("Add some text or images first"); return; }
    setExporting(true);
    setExportProgress("Setting up…");
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      setExportProgress("Recording…");
      if (selectedTrack?.previewUrl) setExportProgress("Fetching audio…");
      const blob = await recordReelVideo(canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, (slideIndex, slideProgress) => {
        const slide = slides[slideIndex];
        if (slide.mode === "typewriter") {
          drawTypewriterSlide(ctx, slide.text, slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else {
          drawSlide(
            ctx, slide.imageElement, slide.text,
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, true, fontFamily, textAlign,
            false, "#ffffff", "", 0, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverHeadlineWeight, coverEyebrowArch,
          );
        }
      }, 30, selectedTrack?.previewUrl);
      setExportProgress("Saving…");
      saveAs(blob, `reel-${Date.now()}.webm`);
      toast.success(selectedTrack ? `Exported with "${selectedTrack.title}"!` : "Reel exported!");
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const fetchMusic = async () => {
    setMusicLoading(true);
    setMusicTracks([]);
    try {
      const params = new URLSearchParams();
      if (musicQuery.trim()) params.set("q", musicQuery.trim());
      if (musicGenre) params.set("genre", musicGenre);
      const res = await fetch(`${import.meta.env.BASE_URL}api/music/search?${params}`);
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setMusicTracks(data.tracks || []);
      if ((data.tracks || []).length === 0) toast.info("No tracks found — try different keywords");
    } catch {
      toast.error("Music search failed");
    } finally {
      setMusicLoading(false);
    }
  };

  const handlePushToCC = async () => {
    if (!ccWorkspaceId) { toast.error("Select a Cloud Campaign workspace first"); return; }
    const hasContent = slides.some((s) => s.text.trim() || s.imageElement);
    if (!hasContent) { toast.error("Add some content to your slides first"); return; }
    setCcPushing(true);
    setCcPushProgress("Setting up…");
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      const animateFn = (slideIndex: number, slideProgress: number = 1) => {
        const slide = slides[slideIndex];
        if (slide.mode === "typewriter") {
          drawTypewriterSlide(ctx, slide.text, slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else {
          drawSlide(
            ctx, slide.imageElement, slide.text,
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, true, fontFamily, textAlign,
            false, "#ffffff", "", 0, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverHeadlineWeight, coverEyebrowArch,
          );
        }
      };
      let audioArrayBuffer: ArrayBuffer | undefined;
      if (selectedTrack?.previewUrl) {
        setCcPushProgress("Fetching audio…");
        try {
          const r = await fetch(selectedTrack.previewUrl);
          audioArrayBuffer = await r.arrayBuffer();
        } catch { /* skip audio on error */ }
      }
      setCcPushProgress("Encoding MP4…");
      let videoBlob: Blob;
      try {
        videoBlob = await recordReelVideoMp4(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          (pct) => setCcPushProgress(`Encoding ${Math.round(pct * 100)}%…`),
          audioArrayBuffer,
        );
      } catch {
        setCcPushProgress("Encoding WebM…");
        videoBlob = await recordReelVideo(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          selectedTrack?.previewUrl,
        );
      }
      setCcPushProgress("Uploading video…");
      const form = new FormData();
      const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
      form.append("video", videoBlob, `reel-${Date.now()}.${ext}`);
      const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      const { url } = await uploadRes.json();
      setCcPushProgress("Pushing to Cloud Campaign…");
      const pushRes = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: [{ title: `Reel – ${new Date().toLocaleDateString()}`, caption: ccCaption, videoUrl: url }],
          workspaceIds: [ccWorkspaceId],
          postType: "reel",
        }),
      });
      if (!pushRes.ok) throw new Error("Cloud Campaign push failed");
      toast.success("Reel pushed to Cloud Campaign!");
      setCcCaption("");
    } catch (e: any) {
      toast.error(e?.message || "Push failed");
    } finally {
      setCcPushing(false);
      setCcPushProgress("");
    }
  };

  const displayIdx = isPlaying ? previewIdx : activeIdx;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h1 className="font-sans text-2xl font-bold tracking-tight">
            <span className="text-white">Social Media Sister's</span>{" "}
            <span className="text-pink-400">CyberSuite</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-wrap">
          <Link href="/"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-2" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImageIcon className="w-4 h-4 mr-2" />Single Image</Button></Link>
          <Link href="/stories"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-2" />Stories</Button></Link>
          <Button variant="ghost" size="sm" className="text-pink-400 bg-pink-400/10 pointer-events-none"><Film className="w-4 h-4 mr-2" />Reels</Button>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-2" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-2" />Captions</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-2" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-2" />Analytics</Button></Link>
          <Link href="/approval"><Button variant="ghost" size="sm" className="text-muted-foreground"><ShieldCheck className="w-4 h-4 mr-2" />Approvals</Button></Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-white/10 flex flex-col overflow-y-auto p-4 gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Slides</h2>
            <Button size="sm" variant="outline" onClick={addSlide} disabled={slides.length >= 10}
              className="border-white/20 text-white/60 hover:text-white h-7 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" />Add
            </Button>
          </div>

          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              onClick={() => { setActiveIdx(idx); setIsPlaying(false); }}
              className={`rounded-lg border p-3 cursor-pointer transition-all space-y-2 ${
                activeIdx === idx && !isPlaying
                  ? "border-pink-500 bg-pink-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">Slide {idx + 1}</span>
                <div className="flex items-center gap-1">
                  {(["cover", "typewriter"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={(e) => { e.stopPropagation(); toggleSlideMode(idx, m); }}
                      title={m === "cover" ? "Image + text overlay" : "Text-only typewriter"}
                      className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${slide.mode === m ? "bg-pink-600/80 text-white" : "text-white/30 border border-white/15"}`}
                    >
                      {m === "cover" ? "Img" : "Aa"}
                    </button>
                  ))}
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSlide(idx); }}
                      className="text-white/30 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={slide.text}
                onChange={(e) => updateText(idx, e.target.value)}
                placeholder={slide.mode === "cover" && coverSplit ? "Eyebrow|Headline" : "Slide text…"}
                rows={3}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none border border-white/10 rounded p-2 focus:border-pink-500/50"
              />
              {slide.mode === "cover" ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors">
                  <Upload className="w-3 h-3" />
                  {slide.imageFile
                    ? slide.imageFile.name.length > 18
                      ? slide.imageFile.name.slice(0, 18) + "…"
                      : slide.imageFile.name
                    : "Upload background image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlideImage(idx, f); }}
                  />
                </label>
              ) : (
                <p className="text-[10px] text-white/20 italic">Typewriter reveal on playback</p>
              )}
            </div>
          ))}

          <p className="text-xs text-white/20 text-center">{slides.length} / 10 slides</p>
        </div>

        <div className="flex-1 flex flex-col items-center overflow-y-auto gap-5 p-6 pt-8 bg-[#08080d]">
          <div className="relative" style={{ width: PREVIEW_W, height: PREVIEW_H }}>
            <canvas
              ref={previewCanvasRef}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              style={{ width: PREVIEW_W, height: PREVIEW_H, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "block" }}
            />
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${displayIdx === i ? "bg-pink-400" : "bg-white/25"}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/70 hover:text-white"
              onClick={() => { setIsPlaying((p) => !p); setPreviewIdx(0); }}
            >
              {isPlaying
                ? <><Square className="w-4 h-4 mr-2" />Stop</>
                : <><Play className="w-4 h-4 mr-2" />Preview</>}
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="bg-pink-600 hover:bg-pink-500 text-white"
            >
              {exporting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{exportProgress}</>
                : <><Download className="w-4 h-4 mr-2" />Export Reel</>}
            </Button>
          </div>

          <p className="text-xs text-white/30">
            9:16 · 1080×1920 · {(slides.length * slideDurationSec).toFixed(0)}s
            {selectedTrack ? ` · 🎵 ${selectedTrack.title}` : ""}
          </p>

          {/* Music picker */}
          <div className="w-full max-w-xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs text-white/40 font-semibold uppercase tracking-wider">
              <Music className="w-3.5 h-3.5" /> Music
            </div>
            {selectedTrack ? (
              <div className="flex items-center gap-2 bg-pink-500/10 border border-pink-500/30 rounded-lg px-3 py-2.5">
                <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{selectedTrack.title}</p>
                  <p className="text-xs text-white/40 truncate">{selectedTrack.artist}</p>
                </div>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input
                    value={musicQuery}
                    onChange={(e) => setMusicQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchMusic()}
                    placeholder="Search tracks by mood, genre…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-pink-500/50"
                  />
                  <Button
                    size="sm"
                    onClick={fetchMusic}
                    disabled={musicLoading}
                    className="bg-pink-600 hover:bg-pink-500 text-white h-7 px-2.5 shrink-0"
                  >
                    {musicLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Select value={musicGenre} onValueChange={setMusicGenre}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-7 text-xs">
                    <SelectValue placeholder="All genres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All genres</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="jazz">Jazz</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                    <SelectItem value="r-b-soul">R&amp;B / Soul</SelectItem>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                  </SelectContent>
                </Select>
                {musicTracks.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-0.5 border border-white/10 rounded-lg p-1.5 bg-black/20">
                    {musicTracks.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-2 hover:bg-white/5 rounded px-2 py-1.5 group cursor-default"
                      >
                        <button
                          onClick={() => {
                            if (previewingTrackId === track.id) {
                              audioPreviewRef.current?.pause();
                              setPreviewingTrackId(null);
                            } else {
                              if (audioPreviewRef.current) audioPreviewRef.current.pause();
                              audioPreviewRef.current = new Audio(track.previewUrl);
                              audioPreviewRef.current.play();
                              setPreviewingTrackId(track.id);
                              audioPreviewRef.current.onended = () => setPreviewingTrackId(null);
                            }
                          }}
                          className="text-white/30 hover:text-pink-400 transition-colors shrink-0"
                        >
                          {previewingTrackId === track.id
                            ? <Square className="w-3 h-3" />
                            : <Play className="w-3 h-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{track.title}</p>
                          <p className="text-xs text-white/30 truncate">
                            {track.artist} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTrack(track);
                            if (audioPreviewRef.current) { audioPreviewRef.current.pause(); setPreviewingTrackId(null); }
                          }}
                          className="text-white/30 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Use this track"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cloud Campaign push */}
          {ccWorkspaces.length > 0 && (
            <div className="w-full max-w-xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-white/40 font-semibold uppercase tracking-wider">
                <Send className="w-3.5 h-3.5" /> Push to Cloud Campaign
              </div>
              <Select value={ccWorkspaceId} onValueChange={setCcWorkspaceId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-7 text-xs">
                  <SelectValue placeholder="Select workspace…" />
                </SelectTrigger>
                <SelectContent>
                  {ccWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                value={ccCaption}
                onChange={(e) => setCcCaption(e.target.value)}
                placeholder="Caption (optional)…"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 outline-none focus:border-pink-500/50 resize-none"
              />
              <Button
                size="sm"
                onClick={handlePushToCC}
                disabled={ccPushing || !ccWorkspaceId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs"
              >
                {ccPushing
                  ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{ccPushProgress}</>
                  : <><Send className="w-3.5 h-3.5 mr-2" />Push Reel as MP4</>}
              </Button>
              <p className="text-xs text-white/20 text-center">Encodes MP4 → uploads → posts as video</p>
            </div>
          )}

          <canvas ref={exportCanvasRef} className="hidden" />
        </div>

        <div className="w-72 border-l border-white/10 flex flex-col overflow-y-auto p-4 gap-5 shrink-0">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Style</h2>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Font</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger className="bg-white/5 border-white/10 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Font size — {fontSize}px</Label>
            <Slider min={30} max={180} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-white/50 flex-1">Text colour</Label>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
              className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Overlay darkness — {overlayOpacity}%</Label>
            <Slider min={0} max={90} step={5} value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-white/50 flex-1">Background colour</Label>
            <input type="color" value={pageColor} onChange={(e) => setPageColor(e.target.value)}
              className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Line spacing — {lineSpacing.toFixed(1)}</Label>
            <Slider min={0.8} max={2.2} step={0.1} value={[lineSpacing]} onValueChange={([v]) => setLineSpacing(v)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Text position</Label>
            <div className="flex gap-1">
              {(["top", "center", "bottom"] as const).map((p) => (
                <Button key={p} size="sm" onClick={() => setTextPosition(p)}
                  className={`flex-1 h-7 text-xs capitalize ${textPosition === p ? "bg-pink-600 border-pink-600 text-white" : "border-white/20 text-white/50 bg-transparent border"}`}>
                  {p}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Alignment</Label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <Button key={a} size="sm" onClick={() => setTextAlign(a)}
                  className={`flex-1 h-7 text-xs capitalize ${textAlign === a ? "bg-pink-600 border-pink-600 text-white" : "border-white/20 text-white/50 bg-transparent border"}`}>
                  {a}
                </Button>
              ))}
            </div>
          </div>

          <div className="border border-white/10 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-white/50">Split text mode</Label>
              <button
                onClick={() => setCoverSplit((p) => !p)}
                className={`w-9 h-5 rounded-full transition-colors relative ${coverSplit ? "bg-pink-600" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${coverSplit ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            {coverSplit && (
              <div className="space-y-3">
                <p className="text-xs text-white/30">Type "Eyebrow|Headline" in slide text</p>
                <div className="space-y-1">
                  <Label className="text-xs text-white/40">Eyebrow font</Label>
                  <Select value={coverEyebrowFont} onValueChange={setCoverEyebrowFont}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-white/40 flex-1">Eyebrow colour</Label>
                  <input type="color" value={coverEyebrowColor} onChange={(e) => setCoverEyebrowColor(e.target.value)}
                    className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/40">Eyebrow size — {coverEyebrowSizeRatio.toFixed(2)}×</Label>
                  <Slider min={0.2} max={0.7} step={0.01} value={[coverEyebrowSizeRatio]} onValueChange={([v]) => setCoverEyebrowSizeRatio(v)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/40">Eyebrow letter spacing — {coverEyebrowLetterSpacing}px</Label>
                  <Slider min={0} max={20} step={1} value={[coverEyebrowLetterSpacing]} onValueChange={([v]) => setCoverEyebrowLetterSpacing(v)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/40">Eyebrow arch — {Math.round(coverEyebrowArch * 100)}%</Label>
                  <Slider min={0} max={1} step={0.05} value={[coverEyebrowArch]} onValueChange={([v]) => setCoverEyebrowArch(v)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCoverEyebrowItalic((p) => !p)}
                    className={`flex-1 h-7 text-xs italic ${coverEyebrowItalic ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 bg-transparent"}`}>
                    Italic
                  </Button>
                  <Button size="sm" onClick={() => setCoverEyebrowUppercase((p) => !p)}
                    className={`flex-1 h-7 text-xs ${coverEyebrowUppercase ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 bg-transparent"}`}>
                    ALL CAPS
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-white/40">Headline weight</Label>
                  <div className="flex gap-1 flex-wrap">
                    {[300, 400, 600, 700, 900].map((w) => (
                      <Button key={w} size="sm" onClick={() => setCoverHeadlineWeight(w)}
                        className={`flex-1 h-7 text-xs ${coverHeadlineWeight === w ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 bg-transparent"}`}>
                        {w}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={() => setCoverHeadlineItalic((p) => !p)}
                  className={`w-full h-7 text-xs italic ${coverHeadlineItalic ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 bg-transparent"}`}>
                  Headline Italic
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-white/50">Logo</Label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/60 border border-white/10 rounded p-2 transition-colors">
              <Upload className="w-3 h-3" />
              {logoFile
                ? logoFile.name.length > 20 ? logoFile.name.slice(0, 20) + "…" : logoFile.name
                : "Upload logo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </label>
            {logoImg && (
              <div className="flex gap-1 flex-wrap">
                {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((p) => (
                  <Button key={p} size="sm" onClick={() => setLogoPosition(p)}
                    className={`flex-1 h-6 text-[9px] px-1 ${logoPosition === p ? "bg-pink-600 text-white" : "border border-white/20 text-white/40 bg-transparent"}`}>
                    {p.replace("top-left", "TL").replace("top-right", "TR").replace("bottom-left", "BL").replace("bottom-right", "BR")}
                  </Button>
                ))}
              </div>
            )}
            {logoImg && (
              <div className="space-y-1">
                <Label className="text-xs text-white/40">Logo size — {logoSize}px</Label>
                <Slider min={40} max={200} step={10} value={[logoSize]} onValueChange={([v]) => setLogoSize(v)} />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest">Text slides</h3>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Background color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={typewriterBgColor}
                  onChange={(e) => setTypewriterBgColor(e.target.value)}
                  className="w-8 h-7 rounded border border-white/10 bg-transparent cursor-pointer"
                />
                <span className="text-xs text-white/30">{typewriterBgColor}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Reveal speed — {Math.round(typewriterFill * 100)}% of slide</Label>
              <Slider min={25} max={95} step={5} value={[Math.round(typewriterFill * 100)]} onValueChange={([v]) => setTypewriterFill(v / 100)} />
              <p className="text-[10px] text-white/25">Lower = text appears faster</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Slide duration — {slideDurationSec}s</Label>
              <Slider min={2} max={8} step={1} value={[slideDurationSec]} onValueChange={([v]) => setSlideDurationSec(v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Fade duration — {fadeDurationMs}ms</Label>
              <Slider min={100} max={800} step={50} value={[fadeDurationMs]} onValueChange={([v]) => setFadeDurationMs(v)} />
            </div>
            <p className="text-xs text-white/25 text-center">
              Total: {(slides.length * slideDurationSec).toFixed(0)}s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
