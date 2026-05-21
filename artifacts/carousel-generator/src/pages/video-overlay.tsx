import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Upload,
  Loader2,
  Wand2,
  Play,
  Square,
  Download,
  ArrowLeft,
  Send,
  Film,
} from "lucide-react";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  FONT_OPTIONS,
  loadGoogleFonts,
  drawTypewriterOnVideo,
  recordVideoWithOverlay,
} from "@/lib/slide-utils";
import { saveAs } from "file-saver";

loadGoogleFonts();

const PREVIEW_SCALE = 0.25;
const PREVIEW_W = Math.round(VIDEO_WIDTH * PREVIEW_SCALE);
const PREVIEW_H = Math.round(VIDEO_HEIGHT * PREVIEW_SCALE);

export default function VideoOverlay() {
  const [, setLocation] = useLocation();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [topic, setTopic] = useState("");
  const [segmentCount, setSegmentCount] = useState(4);
  const [segments, setSegments] = useState<string[]>(["", "", "", ""]);
  const [generating, setGenerating] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const [igPresets, setIgPresets] = useState<Array<{ id: number; name: string }>>([]);
  const [igPresetId, setIgPresetId] = useState("");
  const [igCaption, setIgCaption] = useState("");
  const [igPushing, setIgPushing] = useState(false);
  const [igPushProgress, setIgPushProgress] = useState("");

  const [textColor, setTextColor] = useState("#ffffff");
  const [fontFamily, setFontFamily] = useState("'Playfair Display', serif");
  const [fontSize, setFontSize] = useState(72);
  const [lineSpacing, setLineSpacing] = useState(1.3);
  const [overlayPosition, setOverlayPosition] = useState<"top" | "center" | "bottom">("center");
  const [typewriterFill, setTypewriterFill] = useState(0.7);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/presets`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setIgPresets(d.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!videoFile || !videoRef.current) return;
    const url = URL.createObjectURL(videoFile);
    videoRef.current.src = url;
    videoRef.current.load();
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const drawStaticPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    if (video && video.readyState >= 2) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(VIDEO_WIDTH / vw, VIDEO_HEIGHT / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (VIDEO_WIDTH - dw) / 2;
      const dy = (VIDEO_HEIGHT - dh) / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.drawImage(video, dx, dy, dw, dh);
      const text = segments[0] || "";
      if (text.trim()) {
        drawTypewriterOnVideo(ctx, text, 1, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
      }
    } else {
      ctx.fillStyle = "#111118";
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = `${Math.round(VIDEO_HEIGHT * 0.03)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Upload a video to preview", VIDEO_WIDTH / 2, VIDEO_HEIGHT / 2);
    }
  }, [segments, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill]);

  useEffect(() => {
    if (!isPlaying) drawStaticPreview();
  }, [drawStaticPreview, isPlaying]);

  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) drawStaticPreview();
  }, [isPlaying, drawStaticPreview]);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !videoFile) {
      toast.error("Upload a video first");
      return;
    }
    if (!video.duration) {
      toast.error("Video not loaded yet — wait a moment");
      return;
    }

    const ctx = canvas.getContext("2d")!;
    const segDurationS = video.duration / segmentCount;

    setIsPlaying(true);
    video.currentTime = 0;

    const drawFrame = () => {
      if (video.ended || video.paused) {
        setIsPlaying(false);
        return;
      }
      const elapsed = video.currentTime;
      const segIdx = Math.min(segmentCount - 1, Math.floor(elapsed / segDurationS));
      const segProgress = (elapsed - segIdx * segDurationS) / segDurationS;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(VIDEO_WIDTH / vw, VIDEO_HEIGHT / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (VIDEO_WIDTH - dw) / 2;
      const dy = (VIDEO_HEIGHT - dh) / 2;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.drawImage(video, dx, dy, dw, dh);

      const text = segments[segIdx] || "";
      if (text.trim()) {
        drawTypewriterOnVideo(ctx, text, segProgress, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
      }

      animFrameRef.current = requestAnimationFrame(drawFrame);
    };

    video.onended = () => {
      setIsPlaying(false);
      drawStaticPreview();
    };

    video.play().then(() => {
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }).catch((e: Error) => {
      toast.error("Could not play video: " + e.message);
      setIsPlaying(false);
    });
  }, [videoFile, segmentCount, segments, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill, drawStaticPreview]);

  const handleExport = async () => {
    if (!videoFile || !videoRef.current) {
      toast.error("Upload a video first");
      return;
    }
    const video = videoRef.current;
    if (!video.duration) {
      toast.error("Video not loaded yet");
      return;
    }

    stopPlayback();
    setExporting(true);
    setExportProgress("Preparing…");

    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(VIDEO_WIDTH / vw, VIDEO_HEIGHT / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (VIDEO_WIDTH - dw) / 2;
      const dy = (VIDEO_HEIGHT - dh) / 2;

      setExportProgress("Recording… (plays in real time)");

      const animateFn = (segIdx: number, segProgress: number) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        ctx.drawImage(video, dx, dy, dw, dh);
        const text = segments[segIdx] || "";
        if (text.trim()) {
          drawTypewriterOnVideo(ctx, text, segProgress, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        }
      };

      const blob = await recordVideoWithOverlay(video, canvas, segmentCount, animateFn);
      setExportProgress("Saving…");
      saveAs(blob, `video-overlay-${Date.now()}.webm`);
      toast.success("Video exported! Upload the .webm file to Instagram as a Reel.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Export failed";
      toast.error(msg);
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const handlePushToIG = async (trial: boolean) => {
    if (!igPresetId) { toast.error("Select a client preset first"); return; }
    if (!videoFile || !videoRef.current) { toast.error("Upload a video first"); return; }
    const video = videoRef.current;
    if (!video.duration) { toast.error("Video not loaded yet"); return; }

    stopPlayback();
    setIgPushing(true);
    setIgPushProgress("Recording overlay…");

    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(VIDEO_WIDTH / vw, VIDEO_HEIGHT / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (VIDEO_WIDTH - dw) / 2;
      const dy = (VIDEO_HEIGHT - dh) / 2;

      const animateFn = (segIdx: number, segProgress: number) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        ctx.drawImage(video, dx, dy, dw, dh);
        const text = segments[segIdx] || "";
        if (text.trim()) {
          drawTypewriterOnVideo(ctx, text, segProgress, textColor, fontFamily, fontSize, lineSpacing, overlayPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        }
      };

      const blob = await recordVideoWithOverlay(video, canvas, segmentCount, animateFn);

      setIgPushProgress("Uploading video…");
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("video", blob, `video-overlay-${Date.now()}.${ext}`);
      const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      const { url } = await uploadRes.json();

      setIgPushProgress(trial ? "Posting Trial Reel… (up to 2 min)" : "Posting Reel…");
      const pushRes = await fetch(`${import.meta.env.BASE_URL}api/meta/push-reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url, caption: igCaption, presetId: Number(igPresetId), trial, graduationStrategy: "MANUAL" }),
      });
      const pushData = await pushRes.json();
      if (!pushRes.ok) throw new Error(pushData.error || "Push failed");
      toast.success(trial
        ? "Trial Reel posted! Open your Instagram app to review before graduating."
        : "Reel posted to Instagram!");
      setIgCaption("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push failed");
    } finally {
      setIgPushing(false);
      setIgPushProgress("");
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/video-overlay/generate-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), segmentCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newSegs: string[] = [...(data.segments ?? [])];
      while (newSegs.length < segmentCount) newSegs.push("");
      setSegments(newSegs.slice(0, segmentCount));
      toast.success("Text generated!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h1 className="font-sans text-xl font-bold tracking-tight">
            <span className="text-white">The</span>{" "}
            <span className="text-pink-400">CyberSuite™</span>
            <span className="text-white/30 font-normal text-sm ml-3">/ Video Overlay</span>
          </h1>
        </div>
        <button
          onClick={() => setLocation("/")}
          className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Home
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: controls ── */}
        <div className="w-72 border-r border-white/10 flex flex-col overflow-y-auto p-4 gap-5 shrink-0">

          {/* Video upload */}
          <div className="space-y-2">
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Video</h2>
            <label className="flex flex-col items-center justify-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/70 border border-dashed border-white/20 rounded-xl p-5 transition-colors hover:border-pink-500/40">
              <Upload className="w-5 h-5" />
              <span className="text-center leading-snug">
                {videoFile
                  ? videoFile.name.length > 28 ? videoFile.name.slice(0, 28) + "…" : videoFile.name
                  : "Click to upload video"}
              </span>
              <span className="text-[10px] text-white/20">MP4 · MOV · WebM</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setVideoFile(f);
                }}
              />
            </label>
          </div>

          {/* AI generate */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">AI Text</h2>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Segments</Label>
              <div className="flex gap-1">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setSegmentCount(n);
                      setSegments((prev) => {
                        const s = [...prev];
                        while (s.length < n) s.push("");
                        return s.slice(0, n);
                      });
                    }}
                    className={`flex-1 h-7 text-xs rounded transition-colors ${segmentCount === n ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 hover:border-white/40"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Topic / brief</Label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 5 morning habits that changed my life"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-pink-500/50 resize-none"
              />
            </div>

            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white h-8 text-xs"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5 mr-2" />Generate Text</>
              )}
            </Button>
          </div>

          {/* Text segments */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Text Segments</h2>
            {segments.slice(0, segmentCount).map((seg, i) => (
              <div key={i} className="space-y-0.5">
                <Label className="text-[10px] text-white/25">Segment {i + 1}</Label>
                <textarea
                  value={seg}
                  onChange={(e) => setSegments((prev) => prev.map((s, idx) => idx === i ? e.target.value : s))}
                  placeholder="Short punchy text…"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-pink-500/40 resize-none"
                />
              </div>
            ))}
          </div>

          {/* Export */}
          <div className="border-t border-white/10 pt-4 space-y-2">
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || igPushing || !videoFile}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white h-8 text-xs"
            >
              {exporting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{exportProgress}</>
              ) : (
                <><Download className="w-3.5 h-3.5 mr-2" />Export Video</>
              )}
            </Button>
            <p className="text-[10px] text-white/20 text-center">
              Exports as WebM · plays in real time during recording
            </p>
          </div>

          {/* Instagram posting */}
          {igPresets.length > 0 && (
            <div className="border-t border-white/10 pt-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                <Film className="w-3.5 h-3.5" /> Post to Instagram
              </div>
              <Select value={igPresetId} onValueChange={setIgPresetId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-7 text-xs">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {igPresets.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                value={igCaption}
                onChange={(e) => setIgCaption(e.target.value)}
                placeholder="Caption (optional)…"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-pink-500/50 resize-none"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  onClick={() => handlePushToIG(false)}
                  disabled={igPushing || exporting || !videoFile || !igPresetId}
                  className="flex-1 bg-pink-700 hover:bg-pink-600 text-white h-8 text-xs"
                >
                  {igPushing
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><Send className="w-3 h-3 mr-1.5" />Post Reel</>}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePushToIG(true)}
                  disabled={igPushing || exporting || !videoFile || !igPresetId}
                  className="flex-1 border border-pink-700/60 text-pink-300 bg-transparent hover:bg-pink-700/20 h-8 text-xs"
                >
                  {igPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Trial Reel"}
                </Button>
              </div>
              {igPushing && <p className="text-[10px] text-white/40 text-center">{igPushProgress}</p>}
              <p className="text-[10px] text-white/20 text-center">Trial = private test · graduate when ready</p>
            </div>
          )}
        </div>

        {/* ── CENTER: preview ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 bg-[#08080d]">
          <div
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
            className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black"
          >
            <canvas
              ref={previewCanvasRef}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              style={{ width: PREVIEW_W, height: PREVIEW_H, display: "block" }}
            />
          </div>

          <div className="flex gap-2">
            {isPlaying ? (
              <Button
                size="sm"
                onClick={stopPlayback}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 h-8 text-xs px-5"
              >
                <Square className="w-3 h-3 mr-2 fill-white" /> Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={startPlayback}
                disabled={!videoFile}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 h-8 text-xs px-5"
              >
                <Play className="w-3 h-3 mr-2 fill-white" /> Preview
              </Button>
            )}
          </div>

          <p className="text-[10px] text-white/20 text-center max-w-[200px]">
            Preview plays live with the typewriter effect over your video
          </p>

          <canvas ref={exportCanvasRef} className="hidden" />
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
            crossOrigin="anonymous"
            preload="auto"
            onLoadedData={() => drawStaticPreview()}
          />
        </div>

        {/* ── RIGHT: style ── */}
        <div className="w-64 border-l border-white/10 flex flex-col overflow-y-auto p-4 gap-4 shrink-0">
          <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Style</h2>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Font</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white/70 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Font size — {fontSize}px</Label>
            <Slider
              min={36}
              max={120}
              step={4}
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Text color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-8 h-7 rounded border border-white/10 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-white/30">{textColor}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Line spacing — {lineSpacing.toFixed(1)}</Label>
            <Slider
              min={10}
              max={22}
              step={1}
              value={[Math.round(lineSpacing * 10)]}
              onValueChange={([v]) => setLineSpacing(v / 10)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Text position</Label>
            <div className="flex gap-1">
              {(["top", "center", "bottom"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setOverlayPosition(p)}
                  className={`flex-1 h-7 text-xs rounded capitalize transition-colors ${overlayPosition === p ? "bg-pink-600 text-white" : "border border-white/20 text-white/50 hover:border-white/40"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">
              Reveal speed — {Math.round(typewriterFill * 100)}%
            </Label>
            <Slider
              min={20}
              max={95}
              step={5}
              value={[Math.round(typewriterFill * 100)]}
              onValueChange={([v]) => setTypewriterFill(v / 100)}
            />
            <p className="text-[10px] text-white/20">Lower = text types out faster</p>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2 mt-auto">
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">How it works</h2>
            <ol className="space-y-1.5 text-[11px] text-white/30 list-decimal list-inside leading-relaxed">
              <li>Upload your video</li>
              <li>Enter a topic, generate text</li>
              <li>Edit segments if needed</li>
              <li>Preview with the play button</li>
              <li>Export and post as a Reel</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
