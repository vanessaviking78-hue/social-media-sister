import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Play, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdventCalendarIcon } from "@/components/advent-icon";
import {
  DOOR_STYLES,
  type DoorStyle,
  DOOR_W,
  DOOR_H,
  DOOR_SECONDS,
  coverToCanvas,
  drawDoorFrame,
  exportDoorMp4,
  loadImageFromFile,
} from "@/lib/advent-door";

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
          className={`flex flex-col items-center justify-center aspect-[3/4] border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
            over ? "border-red-500 bg-red-500/5" : "border-zinc-800 hover:border-red-500/60"
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
          <Upload className="mb-3 text-zinc-600" size={28} />
          <p className="font-medium">Drop an image or click</p>
          <p className="text-xs text-zinc-500 mt-1">{hint}</p>
        </label>
      )}
    </div>
  );
}

export default function AdventCalendar() {
  const [door, setDoor] = useState<Slot | null>(null);
  const [reveal, setReveal] = useState<Slot | null>(null);
  const [style, setStyle] = useState<DoorStyle>("swing");
  const [progress, setProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number>(performance.now());

  const ready = !!door && !!reveal;

  const load = useCallback(async (file: File | undefined, set: (s: Slot | null) => void) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      const canvas = coverToCanvas(img);
      set({ canvas, thumb: canvas.toDataURL("image/jpeg", 0.7), name: file.name });
      setVideoUrl(null);
      startRef.current = performance.now();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read that image, try another file");
    }
  }, []);

  // Live preview: plays the same frames the MP4 will use, then loops after a pause.
  useEffect(() => {
    if (!door || !reveal) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      const t = elapsed % (DOOR_SECONDS + 1.2);
      drawDoorFrame(ctx, door.canvas, reveal.canvas, Math.min(t, DOOR_SECONDS), style);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [door, reveal, style]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  async function makeVideo() {
    if (!door || !reveal) return;
    setProgress(0);
    try {
      const blob = await exportDoorMp4(door.canvas, reveal.canvas, setProgress, style);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `advent-${style === "pageturn" ? "page-turn" : "door"}-${new Date().toISOString().slice(0, 10)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Your door is ready and downloading");
    } catch (e: any) {
      toast.error(e?.message || "The video would not build, try again");
    } finally {
      setProgress(null);
    }
  }

  function replay() {
    startRef.current = performance.now();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors" aria-label="Back to the hub">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <AdventCalendarIcon className="w-6 h-6 text-red-400" /> Advent Calendar Door
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Add a closed door and the picture that hides behind it. The door opens and the reveal stays on screen. Choose a door swing or a page turn. 1080 x 1440, 5 seconds, MP4.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">How it opens</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DOOR_STYLES.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setStyle(opt.key);
                  setVideoUrl(null);
                  startRef.current = performance.now();
                }}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  style === opt.key
                    ? "border-red-500 bg-red-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-red-500/50"
                }`}
                aria-pressed={style === opt.key}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-zinc-500 mt-0.5">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-5 items-start">
          <UploadSlot
            step={1}
            title="The door"
            hint="The closed door, any size, it gets centred and cropped to 1080 x 1440"
            slot={door}
            onFile={(f) => load(f, setDoor)}
            onClear={() => {
              setDoor(null);
              setVideoUrl(null);
            }}
          />
          <UploadSlot
            step={2}
            title="Behind the door"
            hint="The reveal, any size, it gets centred and cropped to 1080 x 1440"
            slot={reveal}
            onFile={(f) => load(f, setReveal)}
            onClear={() => {
              setReveal(null);
              setVideoUrl(null);
            }}
          />

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-zinc-500">3. Preview</p>
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[3/4]">
              {ready ? (
                <canvas ref={previewRef} width={DOOR_W} height={DOOR_H} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center text-sm text-zinc-500 px-6">
                  Add both images and your door will start opening here.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={replay}
                disabled={!ready}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-sm disabled:opacity-40"
              >
                <Play size={14} /> Replay
              </button>
              <button
                onClick={makeVideo}
                disabled={!ready || progress !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-40"
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
              <p className="text-xs text-zinc-500">
                Didn't download?{" "}
                <a href={videoUrl} download="advent-door.mp4" className="text-red-400 underline">
                  Save it again
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          Everything happens in your browser, so nothing is uploaded. Chrome or Edge gives the quickest export.
        </p>
      </div>
    </div>
  );
}
