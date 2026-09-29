import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Play, X, Loader2, Plus, CalendarClock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MagazineIcon } from "@/components/magazine-icon";
import { takeFlipHandoff } from "@/lib/flip-handoff";
import { ScheduleModal } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import { nthPostingSlot } from "@/lib/schedule";
import { coverToCanvas, loadImageFromFile } from "@/lib/advent-door";
import {
  MAG_W,
  MAG_H,
  MAG_MIN_PAGES,
  MAG_MAX_PAGES,
  magSecondsFor,
  magLabelsFor,
  magHintsFor,
  drawMagazineFrame,
  exportMagazineMp4,
} from "@/lib/magazine-flip";

type Slot = { canvas: HTMLCanvasElement; thumb: string; name: string };

function UploadSlot({
  step,
  title,
  hint,
  slot,
  onFile,
  onClear,
}: {
  step: number;
  title: string;
  hint: string;
  slot: Slot | null;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        {step}. {title}
      </p>
      {slot ? (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
          <img src={slot.thumb} alt={title} className="w-full aspect-[3/4] object-cover" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-zinc-200 hover:text-white"
            aria-label={`Remove ${title}`}
          >
            <X size={14} />
          </button>
          <p className="absolute bottom-0 inset-x-0 px-3 py-1.5 text-[11px] text-zinc-300 bg-black/55 truncate">{slot.name}</p>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center aspect-[3/4] border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
            over ? "border-fuchsia-500 bg-fuchsia-500/5" : "border-zinc-800 hover:border-fuchsia-500/60"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
          <Upload className="mb-2 text-zinc-600" size={24} />
          <p className="font-medium text-sm">Drop an image or click</p>
          <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>
        </label>
      )}
    </div>
  );
}

export default function Magazine() {
  const [slots, setSlots] = useState<(Slot | null)[]>(Array.from({ length: MAG_MIN_PAGES }, () => null));
  const [progress, setProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const { presets } = usePresets();
  const blobRef = useRef<Blob | null>(null);
  const [clientName, setClientName] = useState("");
  const [caption, setCaption] = useState("");
  const [area, setArea] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [captionBusy, setCaptionBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleVideo, setScheduleVideo] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState<string | undefined>(undefined);
  const matchedPreset = presets.find((p) => clientName.trim() && p.name.trim().toLowerCase() === clientName.trim().toLowerCase()) ?? null;
  const previewRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number>(performance.now());

  const pageCount = slots.length;
  const labels = magLabelsFor(pageCount);
  const hints = magHintsFor(pageCount);
  const ready = slots.every(Boolean);
  const filled = slots.filter(Boolean).length;

  // Extra pages (beyond the front cover, one middle page and the CTA) go in
  // just before the call to action, which always stays the last slot.
  const addPage = () => {
    if (slots.length >= MAG_MAX_PAGES) return;
    setSlots((prev) => [...prev.slice(0, -1), null, prev[prev.length - 1]]);
    setVideoUrl(null);
  };
  const removePage = () => {
    if (slots.length <= MAG_MIN_PAGES) return;
    setSlots((prev) => [...prev.slice(0, -2), prev[prev.length - 1]]);
    setVideoUrl(null);
  };

  const load = useCallback(async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      const canvas = coverToCanvas(img);
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { canvas, thumb: canvas.toDataURL("image/jpeg", 0.7), name: file.name };
        return next;
      });
      setVideoUrl(null);
      startRef.current = performance.now();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read that image, try another file");
    }
  }, []);

  // Pick up to 16 images in one go. They fill the empty pages in order and the
  // magazine grows (before the call to action) if there are more images than gaps.
  const loadMany = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      const empties = slots.filter((s) => !s).length;
      const grow = Math.max(0, Math.min(files.length - empties, MAG_MAX_PAGES - slots.length));
      const room = empties + grow;
      const use = files.slice(0, room);
      if (files.length > room) {
        toast.message(`${MAG_MAX_PAGES} pages is the most, so I've used the first ${room} images`);
      }
      const loaded: Slot[] = [];
      for (const f of use) {
        try {
          const img = await loadImageFromFile(f);
          const canvas = coverToCanvas(img);
          loaded.push({ canvas, thumb: canvas.toDataURL("image/jpeg", 0.7), name: f.name });
        } catch {
          toast.error(`Couldn't read ${f.name}, so I skipped it`);
        }
      }
      if (!loaded.length) return;
      setSlots((prev) => {
        const g = Math.max(0, Math.min(loaded.length - prev.filter((s) => !s).length, MAG_MAX_PAGES - prev.length));
        const next: (Slot | null)[] = [...prev.slice(0, -1), ...Array.from({ length: g }, () => null), prev[prev.length - 1]];
        let k = 0;
        for (let i = 0; i < next.length && k < loaded.length; i++) {
          if (!next[i]) next[i] = loaded[k++];
        }
        return next;
      });
      setVideoUrl(null);
      startRef.current = performance.now();
    },
    [slots]
  );

  const clear = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setVideoUrl(null);
  };

  // Covers sent over from Stylish (in its own tab, so Stylish itself stays open) fill the pages
  // in order and name the file Clientname-Preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const h = await takeFlipHandoff();
      if (cancelled || !h || !h.images.length) return;
      const n = Math.min(MAG_MAX_PAGES, Math.max(MAG_MIN_PAGES, h.images.length));
      setSlots(Array.from({ length: n }, (_, i) => {
        const img = h.images[i];
        if (!img) return null;
        const canvas = coverToCanvas(img);
        return { canvas, thumb: canvas.toDataURL("image/jpeg", 0.7), name: `Cover ${i + 1}` };
      }));
      const clean = h.clientName.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
      setFileName(`${clean || "Client"}-Preview`);
      setClientName(h.clientName || "");
      if (h.caption) setCaption(h.caption);
      if (h.location) setArea(h.location);
      if (h.title) setPostTitle(h.title);
      startRef.current = performance.now();
      if (h.images.length < MAG_MIN_PAGES) toast.message(`Only ${h.images.length} cover${h.images.length === 1 ? "" : "s"} came across. Magazine Flip needs at least ${MAG_MIN_PAGES}, so add the rest here.`);
    })();
    return () => { cancelled = true; };
  }, []);

  // Live preview: plays the same frames the MP4 will use, then loops after a pause.
  useEffect(() => {
    if (!ready) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pages = slots.map((s) => s!.canvas);
    const seconds = magSecondsFor(pages.length);
    let raf = 0;
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      const t = elapsed % (seconds + 1.2);
      drawMagazineFrame(ctx, pages, Math.min(t, seconds - 0.01));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, slots]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  async function makeVideo() {
    if (!ready) return;
    setProgress(0);
    try {
      const blob = await exportMagazineMp4(
        slots.map((s) => s!.canvas),
        setProgress
      );
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName.trim() || `magazine-flip-${new Date().toISOString().slice(0, 10)}`}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Your magazine is ready and downloading");
    } catch (e: any) {
      toast.error(e?.message || "The video would not build, try again");
    } finally {
      setProgress(null);
    }
  }

  async function writeCaption() {
    setCaptionBusy(true);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/caption-generator/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: "1",
          context: `An Instagram reel that plays a magazine style page turn through ${slots.length} pages${postTitle ? `, opening with "${postTitle}"` : ""}. Write the caption in the first person, as the clinician or clinic owner. Use UK spelling. Never use em dashes or en dashes.`,
          clinicName: clientName || undefined,
          location: area.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.caption) throw new Error(d.error || "Caption failed");
      setCaption(String(d.caption).replace(/[\u2013\u2014]/g, ","));
    } catch (e: any) {
      toast.error(e?.message || "Caption failed");
    } finally {
      setCaptionBusy(false);
    }
  }

  async function prepareSchedule() {
    if (!blobRef.current) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("video", blobRef.current, "magazine-flip.mp4");
      const r = await fetch(`${import.meta.env.BASE_URL}api/stylish-reel/upload`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.videoUrl) throw new Error(d.error || "Could not upload the video");
      const start = new Date();
      start.setHours(18, 15, 0, 0);
      if (start.getTime() <= Date.now() + 5 * 60000) start.setDate(start.getDate() + 1);
      const first = nthPostingSlot(start, 0);
      first.setMinutes(first.getMinutes() - first.getTimezoneOffset());
      setScheduleStart(first.toISOString().slice(0, 16));
      setScheduleVideo(d.videoUrl as string);
    } catch (e: any) {
      toast.error(e?.message || "Could not upload the video");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors" aria-label="Back to the hub">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MagazineIcon className="w-6 h-6 text-fuchsia-400" /> Magazine Flip
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Add the front cover, up to fourteen middle pages and a call to action, {MAG_MAX_PAGES} images at the most. The pages turn one by one and the last page stays on screen. 1080 x 1440, {magSecondsFor(pageCount)} seconds, MP4.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {labels.map((label, i) => (
                <UploadSlot
                  key={i}
                  step={i + 1}
                  title={label}
                  hint={hints[i]}
                  slot={slots[i]}
                  onFile={(f) => load(i, f)}
                  onClear={() => clear(i)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white cursor-pointer">
                <Upload size={14} /> Add several images at once (up to {MAG_MAX_PAGES})
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    e.currentTarget.value = "";
                    loadMany(picked);
                  }}
                />
              </label>
              {pageCount < MAG_MAX_PAGES && (
                <button
                  onClick={addPage}
                  className="flex items-center gap-1.5 text-xs text-fuchsia-400 hover:text-fuchsia-300"
                >
                  <Plus size={14} /> Add a page ({pageCount} of {MAG_MAX_PAGES})
                </button>
              )}
              {pageCount > MAG_MIN_PAGES && (
                <button onClick={removePage} className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
                  Remove last page
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 lg:sticky lg:top-6">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{pageCount + 1}. Preview</p>
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[3/4] max-w-sm mx-auto lg:max-w-none">
              {ready ? (
                <canvas ref={previewRef} width={MAG_W} height={MAG_H} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center text-sm text-zinc-500 px-6">
                  {filled} of {pageCount} pages added. Add them all and your magazine will start turning here.
                </div>
              )}
            </div>
            <div className="max-w-sm mx-auto lg:max-w-none space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-zinc-500">File name</label>
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="magazine-flip"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex gap-2 max-w-sm mx-auto lg:max-w-none">
              <button
                onClick={() => (startRef.current = performance.now())}
                disabled={!ready}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-sm disabled:opacity-40"
              >
                <Play size={14} /> Replay
              </button>
              <button
                onClick={makeVideo}
                disabled={!ready || progress !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold disabled:opacity-40"
              >
                {progress !== null ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Building {Math.round(progress * 100)}%
                  </>
                ) : (
                  <>
                    <Download size={14} /> Make my MP4
                  </>
                )}
              </button>
            </div>
            {videoUrl && (
              <div className="max-w-sm mx-auto lg:max-w-none space-y-2 rounded-lg border border-zinc-800 p-3">
                <p className="text-sm text-zinc-200 font-medium">Share it as a reel or a trial reel</p>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Clinic area for local SEO, e.g. Harrogate"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={5}
                  placeholder="Caption"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white"
                />
                <div className="flex gap-2">
                  <button onClick={writeCaption} disabled={captionBusy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-sm disabled:opacity-40">
                    {captionBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Write caption
                  </button>
                  <button onClick={prepareSchedule} disabled={uploading} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold disabled:opacity-40">
                    {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading</> : <><CalendarClock size={14} /> Schedule as reel</>}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">Goes out on Monday, Wednesday, Friday or Sunday. Tick trial reel on the next screen if you want it as a trial.</p>
              </div>
            )}
            {videoUrl && (
              <p className="text-xs text-zinc-500 max-w-sm mx-auto lg:max-w-none">
                Didn't download?{" "}
                <a href={videoUrl} download={`${fileName.trim() || "magazine-flip"}.mp4`} className="text-fuchsia-400 underline">
                  Save it again
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          The video is built in your browser and only uploaded if you choose to schedule it. Chrome or Edge gives the quickest export.
        </p>
      </div>
      {scheduleVideo && (
        <ScheduleModal
          presetId={matchedPreset?.id ?? null}
          presetName={matchedPreset?.name}
          postType="reel"
          posts={[{ title: `${postTitle || fileName || "Magazine Flip"}${clientName ? ` · ${clientName}` : ""}`, caption: caption.trim(), videoUrl: scheduleVideo }]}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          postingDays
          sourceTool="magazine-flip"
          onClose={() => setScheduleVideo(null)}
          onSaved={() => setScheduleVideo(null)}
          presets={presets.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
