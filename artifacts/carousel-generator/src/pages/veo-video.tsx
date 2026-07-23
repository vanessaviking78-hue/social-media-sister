import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, Send, Loader2, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { nameBucketOffsetMinutes } from "@/lib/broadcast-stagger";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AspectRatio = "9:16" | "16:9";
type JobStatus = "queued" | "submitting" | "processing" | "saving" | "done" | "failed";

interface VeoJobResponse {
  status: JobStatus;
  progress: number;
  message: string;
  videoUrl?: string;
  error?: string;
}

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
}

export default function VeoVideo() {
  const { presets, loading: presetsLoading } = usePresets();

  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<VeoJobResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Broadcast section state — only relevant once a video exists.
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<number>>(new Set());
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [platforms, setPlatforms] = useState<Set<"instagram" | "facebook">>(new Set(["instagram", "facebook"]));
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pollJob = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/veo/jobs/${id}/status`, { headers: authHeaders() });
        if (!res.ok) return;
        const data: VeoJobResponse = await res.json();
        setJob(data);
        if (data.status === "done" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setGenerating(false);
          if (data.status === "failed") toast.error(data.error || "Video generation failed");
          else toast.success("Video ready.");
        }
      } catch {
        // transient network hiccup — next tick will retry
      }
    }, 5000);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Describe the video you want first."); return; }
    setGenerating(true);
    setJob({ status: "queued", progress: 0, message: "Queued" });
    try {
      const res = await fetch(`${BASE}/api/veo/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, tier: "lite" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start generation");
      setJobId(data.jobId);
      pollJob(data.jobId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
      setGenerating(false);
    }
  };

  const handleBroadcast = async () => {
    if (!job?.videoUrl) return;
    if (selectedPresetIds.size === 0) { toast.error("Select at least one client."); return; }
    if (!caption.trim()) { toast.error("Write a caption first."); return; }
    if (!date) { toast.error("Pick a date."); return; }

    setBroadcasting(true);
    const toastId = toast.loading(`Queuing video for ${selectedPresetIds.size} clients...`);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const targetIds = Array.from(selectedPresetIds);
      for (const presetId of targetIds) {
        const offsetMin = nameBucketOffsetMinutes(presets.find((p) => p.id === presetId)?.name ?? "");
        const finalScheduledAt = new Date(new Date(scheduledAt).getTime() + offsetMin * 60000).toISOString();
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            presetId,
            postType: "reel",
            content: {
              videoUrl: job.videoUrl,
              caption: caption.trim(),
              title: `AI Video Broadcast — ${targetIds.length} clients ${date}`,
              platforms: Array.from(platforms),
            },
            scheduledAt: finalScheduledAt,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Scheduling failed" }));
          throw new Error(data.error || "Scheduling failed");
        }
      }
      toast.success(`Queued for ${targetIds.length} clients.`, { id: toastId });
      setSelectedPresetIds(new Set());
      setCaption("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", { id: toastId });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <Link href="/hub" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm mb-4">
          <ArrowLeft size={15} /> Back to hub
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <VideoIcon size={20} className="text-orange-400" />
          <h1 className="text-xl font-semibold">AI Video Generator</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          Describe a video and Veo generates it from scratch, then send it straight out to every client.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-zinc-500 mb-1.5 block">Describe the video</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A close-up of a hand applying serum to glowing skin, soft natural light, calm and clean aesthetic clinic feel."
              className="bg-zinc-900 border-white/10 text-sm min-h-24"
              disabled={generating}
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-500 mb-1.5 block">Shape</Label>
            <div className="flex gap-2">
              {(["9:16", "16:9"] as AspectRatio[]).map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  disabled={generating}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    aspectRatio === ar
                      ? "bg-orange-600/20 border-orange-500/50 text-orange-300"
                      : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                  }`}
                >
                  {ar === "9:16" ? "9:16 — Reels / Stories" : "16:9 — Feed / Wide"}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white gap-2"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Generating..." : "Generate video"}
          </Button>

          {job && job.status !== "done" && (
            <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${Math.round((job.progress || 0) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">{job.message}</p>
            </div>
          )}

          {job?.status === "done" && job.videoUrl && (
            <div className="space-y-4">
              <video
                src={`${BASE}${job.videoUrl}`}
                className="w-full rounded-xl border border-white/10 bg-zinc-900"
                controls
                playsInline
              />

              <div className="border-t border-white/10 pt-4">
                <h2 className="text-sm font-semibold text-zinc-200 mb-3">Broadcast this video</h2>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs text-zinc-500">Clients</Label>
                      <span className="text-[11px] text-zinc-500">{selectedPresetIds.size} of {presets.length} selected</span>
                    </div>
                    <div className="border border-white/10 rounded-md bg-zinc-900">
                      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-white/10">
                        <button type="button" onClick={() => setSelectedPresetIds(new Set(presets.map((p) => p.id)))} className="text-[11px] text-orange-400 hover:text-orange-300">Select all</button>
                        <button type="button" onClick={() => setSelectedPresetIds(new Set())} className="text-[11px] text-zinc-500 hover:text-zinc-300">Clear</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                        {presetsLoading && <p className="text-xs text-zinc-500 px-3 py-2">Loading clients...</p>}
                        {presets.map((p) => (
                          <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={selectedPresetIds.has(p.id)}
                              onChange={() => setSelectedPresetIds((prev) => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; })}
                              className="w-3.5 h-3.5 accent-orange-500"
                            />
                            <span className="text-sm text-zinc-200">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">Caption</Label>
                    <Textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Caption for this video..."
                      className="bg-zinc-900 border-white/10 text-sm min-h-20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1.5 block">Date</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-zinc-900 border-white/10 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1.5 block">Time</Label>
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-zinc-900 border-white/10 text-sm" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(["instagram", "facebook"] as const).map((plat) => (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => setPlatforms((prev) => { const next = new Set(prev); next.has(plat) ? next.delete(plat) : next.add(plat); return next; })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-all ${
                          platforms.has(plat)
                            ? "bg-orange-600/20 border-orange-500/50 text-orange-300"
                            : "bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20"
                        }`}
                      >
                        {plat}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    Sent to every client ticked above, each lands in its own Scheduler queue, staggered a few minutes apart by client name so they don't all post at once.
                  </p>

                  <Button
                    onClick={handleBroadcast}
                    disabled={broadcasting || selectedPresetIds.size === 0 || !caption.trim() || !date}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white gap-2"
                  >
                    {broadcasting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {broadcasting ? "Queuing..." : `Broadcast to ${selectedPresetIds.size || ""} client${selectedPresetIds.size === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
