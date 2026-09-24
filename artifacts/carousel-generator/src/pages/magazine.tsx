import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Play, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MagazineIcon } from "@/components/magazine-icon";
import { coverToCanvas, loadImageFromFile } from "@/lib/advent-door";
import {
  MAG_W,
  MAG_H,
  MAG_SECONDS,
  MAG_PAGE_LABELS,
  MAG_PAGE_HINTS,
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
  const [slots, setSlots] = useState<(Slot | null)[]>([null, null, null, null]);
  const [progress, setProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number>(performance.now());

  const ready = slots.every(Boolean);
  const filled = slots.filter(Boolean).length;

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

  const clear = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setVideoUrl(null);
  };

  // Live preview: plays the same frames the MP4 will use, then loops after a pause.
  useEffect(() => {
    if (!ready) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pages = slots.map((s) => s!.canvas);
    let raf = 0;
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      const t = elapsed % (MAG_SECONDS + 1.2);
      drawMagazineFrame(ctx, pages, Math.min(t, MAG_SECONDS - 0.01));
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
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `magazine-flip-${new Date().toISOString().slice(0, 10)}.mp4`;
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
              Add the front cover, page two, page three and a call to action. The pages turn one by one and the last page stays on screen. 1080 x 1440, 10 seconds, MP4.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <div className="grid grid-cols-2 gap-4">
            {MAG_PAGE_LABELS.map((label, i) => (
              <UploadSlot
                key={label}
                step={i + 1}
                title={label}
                hint={MAG_PAGE_HINTS[i]}
                slot={slots[i]}
                onFile={(f) => load(i, f)}
                onClear={() => clear(i)}
              />
            ))}
          </div>

          <div className="space-y-2 lg:sticky lg:top-6">
            <p className="text-xs uppercase tracking-widest text-zinc-500">5. Preview</p>
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[3/4] max-w-sm mx-auto lg:max-w-none">
              {ready ? (
                <canvas ref={previewRef} width={MAG_W} height={MAG_H} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center text-sm text-zinc-500 px-6">
                  {filled} of 4 pages added. Add all four and your magazine will start turning here.
                </div>
              )}
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
              <p className="text-xs text-zinc-500 max-w-sm mx-auto lg:max-w-none">
                Didn't download?{" "}
                <a href={videoUrl} download="magazine-flip.mp4" className="text-fuchsia-400 underline">
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
