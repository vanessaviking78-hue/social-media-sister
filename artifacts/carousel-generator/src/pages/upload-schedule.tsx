import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, X, GripVertical, Wand2, ChevronDown, ChevronUp, CheckCircle2, Sparkles, Send } from "lucide-react";
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

type ImageItem = { file: File; localUrl: string };
type Platform = "instagram" | "facebook";
type PostTypeOption = "carousel" | "story";
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

  const [images, setImages] = useState<ImageItem[]>([]);
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
  const [stickerType, setStickerType] = useState<StickerType>("none");
  const [stickerQuestion, setStickerQuestion] = useState("");
  const [stickerOptions, setStickerOptions] = useState(["", "", "", ""]);
  const [stickerCorrectIndex, setStickerCorrectIndex] = useState(0);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const showSticker = postType === "story" && platforms.has("instagram");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragFromIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    setImages((prev) => {
      const available = MAX_IMAGES - prev.length;
      if (available <= 0) {
        toast.error("You have 12 images already — remove one to add more.");
        return prev;
      }
      const toAdd = incoming.slice(0, available);
      if (incoming.length > available) {
        toast.info(`Added ${toAdd.length} of ${incoming.length} images — limit is 12.`);
      }
      return [...prev, ...toAdd.map((f) => ({ file: f, localUrl: URL.createObjectURL(f) }))];
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
    if (!images.length) { toast.error("Upload at least one image."); return; }
    if (!caption.trim()) { toast.error("Write a caption first."); return; }
    if (!presetId) { toast.error("Pick a client."); return; }
    if (!date) { toast.error("Pick a date."); return; }

    const selectedPreset = presets.find((p) => String(p.id) === presetId);

    setScheduling(true);
    const id = toast.loading("Uploading images...");
    try {
      const imageUrls = await uploadImages(images.map((i) => i.file));
      toast.loading("Queuing post...", { id });

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

      let stickerConfig: object | null = null;
      if (postType === "story" && platforms.has("instagram") && stickerType !== "none" && stickerQuestion.trim()) {
        if (stickerType === "poll" && stickerOptions[0].trim() && stickerOptions[1].trim()) {
          stickerConfig = { type: "poll", question: stickerQuestion.trim(), options: [stickerOptions[0].trim(), stickerOptions[1].trim()] };
        } else if (stickerType === "quiz") {
          const validOpts = stickerOptions.map(o => o.trim()).filter(Boolean);
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
          content: {
            imageUrls,
            caption: caption.trim(),
            title: `Upload & Schedule — ${selectedPreset?.name ?? "Client"} ${date}`,
            platforms: Array.from(platforms),
          },
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", { id });
    } finally {
      setScheduling(false);
    }
  };

  const selectedPresetForApproval = presets.find((p) => String(p.id) === presetId);

  const handleGetApprovalGroups = useCallback(async () => {
    const imageUrls = await uploadImages(images.map((i) => i.file));
    return [{ imageUrls, caption: caption.trim() }];
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
      {/* Header — outside scroll container so it never moves */}
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

        {/* LEFT — Images */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <Label className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
              Images
            </Label>
            <span className="text-xs text-zinc-500">{images.length} / {MAX_IMAGES}</span>
          </div>

          {images.length < MAX_IMAGES && (
            <div
              ref={dropZoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleZoneDragOver}
              onDrop={handleZoneDrop}
              className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 py-8 cursor-pointer hover:border-pink-500/40 hover:bg-white/[0.02] transition-colors mb-4"
            >
              <Upload size={22} className="text-zinc-500" />
              <p className="text-sm text-zinc-400">Drop images here or click to browse</p>
              <p className="text-xs text-zinc-600">PNG, JPG, WebP — up to 12 images</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
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
                    dragOverIdx === idx ? "border-pink-500 scale-105" : "border-transparent"
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

          {images.length === 0 && (
            <p className="text-xs text-zinc-600 mt-1">
              Drag thumbnails to reorder after uploading.
            </p>
          )}

          {images.length > 0 && images.length < MAX_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 text-xs text-zinc-500 hover:text-pink-400 transition-colors"
            >
              + Add more images
            </button>
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

            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">Post type</Label>
              <div className="flex gap-2">
                {(["carousel", "story"] as PostTypeOption[]).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => setPostType(pt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      postType === pt
                        ? "bg-pink-600/20 border-pink-500/50 text-pink-300"
                        : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                    }`}
                  >
                    {pt === "carousel" ? "Carousel / Image" : "Story"}
                  </button>
                ))}
              </div>
            </div>

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
              {scheduling ? "Scheduling..." : "Schedule Post"}
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
