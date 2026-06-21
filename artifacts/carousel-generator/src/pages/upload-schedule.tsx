import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, X, GripVertical, Wand2, ChevronDown, ChevronUp, CheckCircle2, Sparkles, Send, Film } from "lucide-react";
import { SendForApprovalModal } from "@/components/send-for-approval-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { compressImage } from "@/lib/slide-utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MAX_IMAGES = 12;
const MAX_VIDEO_MB = 300;

type MediaItem = { file: File; localUrl: string; isVideo: boolean };
type Platform = "instagram" | "facebook";
type PostTypeOption = "carousel" | "story" | "reel";
type DimensionOption = "1080x1440" | "1080x1920";
type StickerType = "none" | "poll" | "quiz" | "question";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImages(files: File[]): Promise<string[]> {
  const BATCH = 5;
  const urls: string[] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const images = await Promise.all(
      batch.map(async (f) => {
        const compressed = await compressImage(f);
        return { name: compressed.name, base64: await toBase64(compressed) };
      })
    );
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "Images too large — try smaller files" : `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

async function uploadVideo(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("video", file);
  const res = await fetch(`${BASE}/api/content/upload-video`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Video upload failed (${res.status})` }));
    throw new Error(data.error || "Video upload failed");
  }
  const data = await res.json();
  return (data.url ?? data.proxyUrl) as string;
}

async function stitchImagesToVideo(items: MediaItem[], dim: DimensionOption): Promise<File> {
  const [w, h] = dim === "1080x1440" ? [1080, 1440] : [1080, 1920];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const mimeType =
    ["video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

  const stream = canvas.captureStream(25);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // Load all images
  const imgEls = await Promise.all(
    items.map(
      (item) =>
        new Promise<HTMLImageElement>((res, rek) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = item.localUrl;
        })
    )
  );

  recorder.start(250);

  const SLIDE_MS = 3000;
  const FADE_MS = 400;
  const FRAME_MS = 40; // ~25fps

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const drawImg = (img: HTMLImageElement, alpha = 1) => {
    // cover-fit: fill canvas without distortion
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
    ctx.globalAlpha = 1;
  };

  for (let i = 0; i < imgEls.length; i++) {
    const cur = imgEls[i];
    const nxt = imgEls[i + 1] ?? null;

    // Hold slide
    for (let t = 0; t < SLIDE_MS; t += FRAME_MS) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawImg(cur);
      await sleep(FRAME_MS);
    }

    // Crossfade to next
    if (nxt) {
      for (let t = 0; t <= FADE_MS; t += FRAME_MS) {
        const a = t / FADE_MS;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        drawImg(cur, 1 - a);
        drawImg(nxt, a);
        await sleep(FRAME_MS);
      }
    }
  }

  return new Promise((res, rei) => {
    recorder.onstop = () => {
      if (!chunks.length) {
        rej(new Error("No video captured — please use Chrome or Firefox"));
        return;
      }
      res(new File([new Blob(chunks, { type: mimeType })], "animated-slides.webm", { type: mimeType }));
    };
    recorder.stop();
  });
}

async function generateCaptionFromBrief(
  brief: string,
  clientName: string,
  voiceStyle: string
): Promise<string> {
  const res = await fetch(`${BASE}/api/content/captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      posts: [[brief]],
      postType: "single-image",
      clientName,
      voiceStyle,
    }),
  });
  if (!res.ok || !res.body) throw new Error("Caption generation failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let caption = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "complete" && data.captions?.[0]) {
          caption = data.captions[0];
        }
      } catch {
        // malformed line — skip
      }
    }
  }
  return caption;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function UploadSchedule() {
  useEffect(() => {
    document.title = "Upload & Schedule · The CyberSuite";
  }, []);

  const { presets, loading: presetsLoading } = usePresets();

  const [images, setImages] = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState("");
  const [brief, setBrief] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [presetId, setPresetId] = useState<string>("");
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState("18:00");
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    new Set(["instagram", "facebook"])
  );
  const [postType, setPostType] = useState<PostTypeOption>("carousel");
  const [dimension, setDimension] = useState<DimensionOption>("1080x1440");
  const [animateSlides, setAnimateSlides] = useState(false);
  const [stickerType, setStickerType] = useState<StickerType>("none");
  const [stickerQuestion, setStickerQuestion] = useState("");
  const [stickerOptions, setStickerOptions] = useState(["", "", "", ""]);
  const [stickerCorrectIndex, setStickerCorrectIndex] = useState(0);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Auto-switch to Reel when a video is added or animate mode is on
  useEffect(() => {
    if ((images.some((i) => i.isVideo) || animateSlides) && postType !== "reel") {
      setPostType("reel");
    }
  }, [images, animateSlides]);

  // Reset animate mode if images drop below 2
  useEffect(() => {
    if (images.length < 2) setAnimateSlides(false);
  }, [images.length]);

  const showSticker = postType === "story" && platforms.has("instagram");
  const hasVideo = images.some((i) => i.isVideo);
  const showDimensionPicker = hasVideo || animateSlides;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragFromIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    const videos = incoming.filter((f) => f.type.startsWith("video/"));
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    if (!videos.length && !imgs.length) {
      toast.error("Only image or video files are supported.");
      return;
    }
    setImages((prev) => {
      const hasExistingVideo = prev.some((i) => i.isVideo);
      const hasExistingImages = prev.some((i) => !i.isVideo);
      if (videos.length) {
        if (hasExistingImages) { toast.error("Remove your images before adding a video."); return prev; }
        if (prev.length > 0) { toast.error("Only one video at a time."); return prev; }
        const video = videos[0];
        if (video.size > MAX_VIDEO_MB * 1024 * 1024) {
          toast.error(`Video must be under ${MAX_VIDEO_MB} MB.`);
          return prev;
        }
        return [{ file: video, localUrl: URL.createObjectURL(video), isVideo: true }];
      }
      // Images
      if (hasExistingVideo) { toast.error("Remove your video before adding images."); return prev; }
      const available = MAX_IMAGES - prev.length;
      if (available <= 0) { toast.error("You have 12 images already — remove one to add more."); return prev; }
      const toAdd = imgs.slice(0, available);
      if (imgs.length > available) toast.info(`Added ${toAdd.length} of ${imgs.length} images — limit is 12.`);
      return [...prev, ...toAdd.map((f) => ({ file: f, localUrl: URL.createObjectURL(f), isVideo: false }))];
    });
  }, []);

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].localUrl);
      next.splice(idx, 1);
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleThumbDragStart = (idx: number, e: React.DragEvent) => {
    dragFromIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleThumbDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };

  const handleThumbDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragFromIdx.current === null || dragFromIdx.current === idx) {
      setDragOverIdx(null);
      return;
    }
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragFromIdx.current!, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragFromIdx.current = null;
    setDragOverIdx(null);
  };

  const handleThumbDragEnd = () => {
    dragFromIdx.current = null;
    setDragOverIdx(null);
  };

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size === 1) return prev;
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  const handleGenerateCaption = async () => {
    if (!brief.trim()) {
      toast.error("Write a brief first — what is this post about?");
      return;
    }
    const selectedPreset = presets.find((p) => String(p.id) === presetId);
    setGenerating(true);
    try {
      const result = await generateCaptionFromBrief(
        brief,
        selectedPreset?.name ?? "",
        selectedPreset?.voiceStyle ?? "northern-grit"
      );
      if (result) {
        setCaption(result);
        setBriefOpen(false);
        toast.success("Caption generated.");
      } else {
        toast.error("Nothing came back — try again.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!images.length) { toast.error("Upload at least one image or video."); return; }
    if (!caption.trim()) { toast.error("Write a caption first."); return; }
    if (!presetId) { toast.error("Pick a client."); return; }
    if (!date) { toast.error("Pick a date."); return; }

    const selectedPreset = presets.find((p) => String(p.id) === presetId);
    const isVideoPost = images.some((i) => i.isVideo);
    const isAnimated = animateSlides && !isVideoPost && images.length >= 2;

    setScheduling(true);
    const id = toast.loading(
      isAnimated
        ? `Stitching ${images.length} slides into animated reel...`
        : isVideoPost
        ? "Uploading video..."
        : "Uploading images..."
    );

    try {
      let postContent: Record<string, unknown>;

      if (isVideoPost || isAnimated) {
        let videoFile: File;
        if (isAnimated) {
          videoFile = await stitchImagesToVideo(images, dimension);
          toast.loading("Uploading animated reel...", { id });
        } else {
          videoFile = images[0].file;
        }
        const url = await uploadVideo(videoFile);
        postContent = {
          videoUrl: url,
          caption: caption.trim(),
          title: `Upload & Schedule — ${selectedPreset?.name ?? "Client"} ${date}`,
          platforms: Array.from(platforms),
        };
      } else {
        const mediaUrls = await uploadImages(images.map((i) => i.file));
        postContent = {
          imageUrls: mediaUrls,
          caption: caption.trim(),
          title: `Upload & Schedule — ${selectedPreset?.name ?? "Client"} ${date}`,
          platforms: Array.from(platforms),
        };
      }

      toast.loading("Queuing post...", { id });

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

      let stickerConfig: object | null = null;
      if (postType === "story" && platforms.has("instagram") && stickerType !== "none" && stickerQuestion.trim()) {
        if (stickerType === "poll" && stickerOptions[0].trim() && stickerOptions[1].trim()) {
          stickerConfig = { type: "poll", question: stickerQuestion.trim(), options: [stickerOptions[0].trim(), stickerOptions[1].trim()] };
        } else if (stickerType === "quiz") {
          const validOpts = stickerOptions.map((o) => o.trim()).filter(Boolean);
          if (validOpts.length >= 2) {
            stickerConfig = { type: "quiz", question: stickerQuestion.trim(), options: validOpts, correctIndex: Math.min(stickerCorrectIndex, validOpts.length - 1) };
          }
        } else if (stickerType === "question") {
          stickerConfig = { type: "question", question: stickerQuestion.trim() };
        }
      }

      const res = await fetch(`${BASE}/api/scheduler/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: Number(presetId),
          postType,
          content: postContent,
          scheduledAt,
          stickerConfig,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Scheduling failed" }));
        throw new Error(data.error || "Scheduling failed");
      }

      toast.success("Post queued.", { id });
      setScheduled(true);
      setImages([]);
      setCaption("");
      setBrief("");
      setAnimateSlides(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", { id });
    } finally {
      setScheduling(false);
    }
  };

  const selectedPresetForApproval = presets.find((p) => String(p.id) === presetId);

  const handleGetApprovalGroups = useCallback(async () => {
    let mediaUrls: string[];
    if (images.some((i) => i.isVideo)) {
      const url = await uploadVideo(images[0].file);
      mediaUrls = [url];
    } else {
      mediaUrls = await uploadImages(images.map((i) => i.file));
    }
    return [{ imageUrls: mediaUrls, caption: caption.trim() }];
  }, [images, caption]);

  if (scheduled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="text-emerald-400" size={32} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-white mb-1">Post queued.</p>
          <p className="text-zinc-400 text-sm">It will fire at the time you set.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setScheduled(false)}>
            Schedule another
          </Button>
          <Link href="/scheduler">
            <Button>View queue</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-background text-foreground flex flex-col"
      style={{ height: "100vh" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href="/hub">
          <button className="text-zinc-400 hover:text-white transition-colors p-1">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <h1 className="font-semibold text-white tracking-tight text-lg">Upload &amp; Schedule</h1>
        <span className="text-zinc-500 text-sm">Schedule content you made in Canva or anywhere else.</span>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* LEFT — Media */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <Label className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
                {hasVideo ? "Video" : animateSlides ? "Slides (animating as reel)" : "Images"}
              </Label>
              {!hasVideo && <span className="text-xs text-zinc-500">{images.length} / {MAX_IMAGES}</span>}
            </div>

            {images.length === 0 && (
              <div
                ref={dropZoneRef}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleZoneDragOver}
                onDrop={handleZoneDrop}
                className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 py-8 cursor-pointer hover:border-pink-500/40 hover:bg-white/[0.02] transition-colors mb-4"
              >
                <Upload size={22} className="text-zinc-500" />
                <p className="text-sm text-zinc-400">Drop images or a video here</p>
                <p className="text-xs text-zinc-600">
                  Images: PNG, JPG, WebP up to 12 &nbsp;·&nbsp; Video: MP4 / MOV up to 300 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {images.length > 0 && !hasVideo && images.length < MAX_IMAGES && (
              <div
                ref={dropZoneRef}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleZoneDragOver}
                onDrop={handleZoneDrop}
                className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 py-6 cursor-pointer hover:border-pink-500/40 hover:bg-white/[0.02] transition-colors mb-4"
              >
                <Upload size={18} className="text-zinc-500" />
                <p className="text-sm text-zinc-400">Drop more images here or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Video preview */}
            {hasVideo && images[0] && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/10 mb-4">
                <video
                  src={images[0].localUrl}
                  className="w-full max-h-64 object-contain"
                  controls
                  playsInline
                />
                <div className="absolute top-2 left-2 bg-black/70 rounded-full px-2 py-1 flex items-center gap-1">
                  <Film size={11} className="text-pink-400" />
                  <span className="text-[11px] text-white font-medium">{images[0].file.name.slice(0, 24)}</span>
                </div>
                <button
                  onClick={() => removeImage(0)}
                  className="absolute top-2 right-2 bg-black/70 rounded-full p-1 hover:bg-red-600/80 transition-colors"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}

            {/* Image grid */}
            {!hasVideo && images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {images.map((img, idx) => (
                  <div
                    key={img.localUrl}
                    draggable
                    onDragStart={(e) => handleThumbDragStart(idx, e)}
                    onDragOver={(e) => handleThumbDragOver(idx, e)}
                    onDrop={(e) => handleThumbDrop(idx, e)}
                    onDragEnd={handleThumbDragEnd}
                    style={{ touchAction: "pan-y" }}
                    className={`relative rounded-lg overflow-hidden aspect-square bg-zinc-900 cursor-grab active:cursor-grabbing border-2 transition-all ${
                      dragOverIdx === idx ? "border-pink-500 scale-105" : animateSlides ? "border-pink-500/20" : "border-transparent"
                    }`}
                  >
                    <img
                      src={img.localUrl}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute top-1 left-1 bg-black/60 rounded p-0.5">
                      <GripVertical size={12} className="text-white/60" />
                    </div>
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 hover:bg-red-600/80 transition-colors"
                    >
                      <X size={12} className="text-white" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white font-medium">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Animate as Reel button */}
            {!hasVideo && images.length >= 2 && (
              <button
                onClick={() => setAnimateSlides((v) => !v)}
                className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 mb-2 ${
                  animateSlides
                    ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                    : "bg-zinc-900 border-white/10 text-zinc-400 hover:border-pink-500/30 hover:text-pink-300"
                }`}
              >
                <Film size={15} />
                {animateSlides ? "Animated Reel: On — slides will crossfade" : "Animate slides into a Reel"}
              </button>
            )}

            {animateSlides && (
              <p className="text-[11px] text-zinc-500 mb-2">
                Slides will crossfade at 3s each and be stitched into a single video reel.
                Drag thumbnails to reorder.
              </p>
            )}

            {images.length === 0 && (
              <p className="text-xs text-zinc-600 mt-1">
                Drag thumbnails to reorder after uploading.
              </p>
            )}
          </div>

          {/* RIGHT — Caption + Schedule */}
          <div className="flex flex-col gap-6">

            {/* Caption */}
            <div>
              <Label className="text-xs font-semibold tracking-widest uppercase text-zinc-400 mb-3 block">
                Caption
              </Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption, or generate one from a brief below."
                className="min-h-[140px] resize-y text-sm bg-zinc-900 border-white/10 placeholder:text-zinc-600"
              />

              <button
                onClick={() => setBriefOpen((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-pink-400 transition-colors"
              >
                <Wand2 size={13} />
                Generate from a brief
                {briefOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {briefOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Describe what this post is about — the treatment, the offer, the feeling you want to capture."
                    className="min-h-[80px] resize-none text-sm bg-zinc-900 border-white/10 placeholder:text-zinc-600"
                  />
                  <Button
                    onClick={handleGenerateCaption}
                    disabled={generating || !brief.trim()}
                    size="sm"
                    className="self-start"
                  >
                    {generating ? "Generating..." : "Generate Caption"}
                  </Button>
                </div>
              )}
            </div>

            {/* Schedule */}
            <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
                Schedule
              </p>

              {/* Post type */}
              <div>
                <Label className="text-xs text-zinc-500 mb-1.5 block">Post type</Label>
                <div className="flex gap-2">
                  {(["carousel", "reel", "story"] as PostTypeOption[]).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setPostType(pt)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        postType === pt
                          ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                          : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                      }`}
                    >
                      {pt === "carousel" ? "Carousel" : pt === "reel" ? "Reel" : "Story"}
                    </button>
                  ))}
                </div>
                {hasVideo && postType !== "reel" && (
                  <p className="text-[11px] text-amber-400/80 mt-1.5">Video posts are best scheduled as Reels.</p>
                )}
              </div>

              {/* Dimension picker — shown when video or animate mode */}
              {showDimensionPicker && (
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Dimensions</Label>
                  <div className="flex gap-2">
                    {(["1080x1440", "1080x1920"] as DimensionOption[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDimension(d)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          dimension === d
                            ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                            : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                        }`}
                      >
                        {d === "1080x1440" ? "1080 × 1440" : "1080 × 1920"}
                        <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                          {d === "1080x1440" ? "Portrait Feed" : "Story / Reel"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Export your Canva design at this size before uploading.
                  </p>
                </div>
              )}

              {/* Client */}
              <div>
                <Label className="text-xs text-zinc-500 mb-1.5 block">Client</Label>
                <Select
                  value={presetId}
                  onValueChange={setPresetId}
                  disabled={presetsLoading}
                >
                  <SelectTrigger className="bg-zinc-900 border-white/10 text-sm">
                    <SelectValue placeholder={presetsLoading ? "Loading..." : "Pick a client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Date</Label>
                  <Input
                    type="date"
                    value={date}
                    min={todayStr()}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-zinc-900 border-white/10 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Time</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-zinc-900 border-white/10 text-sm"
                  />
                </div>
              </div>

              {/* Platforms */}
              <div>
                <Label className="text-xs text-zinc-500 mb-1.5 block">Platforms</Label>
                <div className="flex gap-2">
                  {(["instagram", "facebook"] as Platform[]).map((p) => {
                    const active = platforms.has(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          active
                            ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                            : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                        }`}
                                        >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-600 mt-1.5">
                  Posting fires via the client's connected Meta account.
                </p>
              </div>

              {/* Sticker (stories only) */}
              {showSticker && (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setStickerOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-pink-400" />
                      <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">Interactive Sticker</p>
                      {stickerType !== "none" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-600/20 text-pink-300 border border-pink-500/30">
                          {stickerType === "poll" ? "Poll" : stickerType === "quiz" ? "Quiz" : "Q&A"}
                        </span>
                      )}
                    </div>
                    {stickerOpen ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                  </button>

                  {stickerOpen && (
                    <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/8 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {(["none", "poll", "quiz", "question"] as StickerType[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => setStickerType(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              stickerType === st
                                ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                                : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                            }`}
                          >
                            {st === "none" ? "None" : st === "poll" ? "Poll" : st === "quiz" ? "Quiz" : "Question box"}
                          </button>
                        ))}
                      </div>

                      {stickerType !== "none" && (
                        <div className="flex flex-col gap-3">
                          <div>
                            <Label className="text-xs text-zinc-500 mb-1.5 block">
                              {stickerType === "question" ? "Prompt" : "Question"}
                            </Label>
                            <Input
                              value={stickerQuestion}
                              onChange={(e) => setStickerQuestion(e.target.value)}
                              placeholder={
                                stickerType === "poll"
                                  ? "Would you rather...?"
                                  : stickerType === "quiz"
                                  ? "How many treatments does it take...?"
                                  : "Ask me anything about..."
                              }
                              className="bg-zinc-900 border-white/10 text-sm placeholder:text-zinc-600"
                            />
                          </div>

                          {stickerType === "poll" && (
                            <div>
                              <Label className="text-xs text-zinc-500 mb-1.5 block">Options</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {[0, 1].map((i) => (
                                  <Input
                                    key={i}
                                    value={stickerOptions[i]}
                                    onChange={(e) => {
                                      const next = [...stickerOptions];
                                      next[i] = e.target.value;
                                      setStickerOptions(next);
                                    }}
                                    placeholder={i === 0 ? "Yes" : "No"}
                                    className="bg-zinc-900 border-white/10 text-sm placeholder:text-zinc-600"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {stickerType === "quiz" && (
                            <div>
                              <Label className="text-xs text-zinc-500 mb-1.5 block">
                                Options — tap the circle to mark the correct answer
                              </Label>
                              <div className="flex flex-col gap-2">
                                {[0, 1, 2, 3].map((i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <button
                                      onClick={() => setStickerCorrectIndex(i)}
                                      className={`w-4 h-4 rounded-full border flex-shrink-0 transition-all ${
                                        stickerCorrectIndex === i
                                          ? "bg-emerald-500 border-emerald-400"
                                          : "border-white/20 hover:border-white/40"
                                      }`}
                                    />
                                    <Input
                                      value={stickerOptions[i]}
                                      onChange={(e) => {
                                        const next = [...stickerOptions];
                                        next[i] = e.target.value;
                                        setStickerOptions(next);
                                      }}
                                      placeholder={`Option ${i + 1}${i >= 2 ? " (optional)" : ""}`}
                                      className="bg-zinc-900 border-white/10 text-sm placeholder:text-zinc-600"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-zinc-600">
                        Instagram applies the sticker at publish time. It cannot be previewed in the app.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={() => setShowApprovalModal(true)}
                disabled={!images.length}
                variant="outline"
                className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 font-semibold"
                size="lg"
              >
                <Send className="w-4 h-4 mr-2" />Send for Client Approval
              </Button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-800" />
                <span className="text-xs text-zinc-600 shrink-0">or schedule directly</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>

              <Button
                onClick={handleSchedule}
                disabled={scheduling || !images.length || !caption.trim() || !presetId || !date}
                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold"
                size="lg"
              >
                {scheduling
                  ? animateSlides
                    ? "Creating animated reel..."
                    : hasVideo
                    ? "Uploading video..."
                    : "Scheduling..."
                  : "Schedule Post"}
              </Button>

              <Link href="/scheduler">
                <p className="text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">
                  View the queue
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showApprovalModal && (
        <SendForApprovalModal
          defaultClientName={selectedPresetForApproval?.name ?? ""}
          defaultBundleName={
            selectedPresetForApproval
              ? `${selectedPresetForApproval.name} — ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
              : ""
          }
          onGetImageGroups={handleGetApprovalGroups}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
