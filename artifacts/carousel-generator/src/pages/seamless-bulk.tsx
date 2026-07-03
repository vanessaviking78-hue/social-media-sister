import { useState } from "react";
import { usePresets } from "@/lib/use-presets";
import { MusicPickerModal, type MusicTrack } from "@/components/music-picker-modal";
import JSZip from "jszip";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SLIDE_W = 1080;
const SLIDE_H = 1440;

type Strip = { id: string; file: File; url: string; width: number; height: number; slides: number };
type Carousel = {
  id: string;
  name: string;
  slideUrls: string[];
  presetId: number | null;
  caption: string;
  date: string;
  time: string;
  track: MusicTrack | null;
};

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function cutStrip(img: HTMLImageElement, n: number): string[] {
  const W = img.naturalWidth, H = img.naturalHeight;
  const sliceW = W / n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("canvas");
    c.width = SLIDE_W; c.height = SLIDE_H;
    const ctx = c.getContext("2d")!;
    // draw the i-th slice, scaled to fill a 1080x1440 slide
    ctx.drawImage(img, i * sliceW, 0, sliceW, H, 0, 0, SLIDE_W, SLIDE_H);
    out.push(c.toDataURL("image/png"));
  }
  return out;
}

async function compressDataUrl(dataUrl: string, maxPx = 1080, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = await Promise.all(
      dataUrls.slice(i, i + BATCH).map(async (du, j) => ({ name: names[i + j], base64: await compressDataUrl(du) }))
    );
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) throw new Error("Image upload failed");
    const d = await res.json();
    (d.results || []).forEach((r: { url: string }) => urls.push(r.url));
  }
  return urls;
}

export default function SeamlessBulk() {
  const { presets } = usePresets();
  const [strips, setStrips] = useState<Strip[]>([]);
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [phase, setPhase] = useState<"upload" | "preview">("upload");
  const [busy, setBusy] = useState(false);
  const [musicCarouselId, setMusicCarouselId] = useState<string | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const added: Strip[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) continue;
      const img = await fileToImage(file);
      const guess = Math.max(2, Math.min(5, Math.round(img.naturalWidth / SLIDE_W)));
      added.push({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, url: img.src, width: img.naturalWidth, height: img.naturalHeight, slides: guess });
    }
    setStrips((prev) => [...prev, ...added]);
  }

  function setStripSlides(id: string, n: number) {
    setStrips((prev) => prev.map((s) => (s.id === id ? { ...s, slides: n } : s)));
  }
  function removeStrip(id: string) {
    setStrips((prev) => prev.filter((s) => s.id !== id));
  }

  async function cutAll() {
    if (!strips.length) { toast.error("Add at least one strip."); return; }
    setBusy(true);
    try {
      const out: Carousel[] = [];
      for (let i = 0; i < strips.length; i++) {
        const s = strips[i];
        const img = await fileToImage(s.file);
        const slideUrls = cutStrip(img, s.slides);
        out.push({
          id: `c-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: s.file.name.replace(/\.[^.]+$/, ""),
          slideUrls,
          presetId: null,
          caption: "",
          date: "",
          time: "",
          track: null,
        });
      }
      setCarousels(out);
      setPhase("preview");
    } catch (e: any) {
      toast.error(e?.message || "Cutting failed");
    } finally {
      setBusy(false);
    }
  }

  function updateCarousel(id: string, patch: Partial<Carousel>) {
    setCarousels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCarousel(id: string) {
    setCarousels((prev) => prev.filter((c) => c.id !== id));
  }

  async function downloadZip() {
    const tid = toast.loading("Building ZIP…");
    try {
      const zip = new JSZip();
      carousels.forEach((c, ci) => {
        const folder = zip.folder(`${ci + 1}-${c.name}`.slice(0, 40))!;
        c.slideUrls.forEach((du, si) => {
          folder.file(`slide-${si + 1}.png`, du.split(",")[1], { base64: true });
        });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "seamless-carousels.zip";
      a.click();
      toast.success("ZIP downloaded.", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "ZIP failed", { id: tid });
    }
  }

  async function scheduleAll() {
    const ready = carousels.filter((c) => c.presetId && c.date && c.time);
    if (!ready.length) { toast.error("Give at least one carousel a client, date and time."); return; }
    setBusy(true);
    const tid = toast.loading("Uploading and scheduling…");
    try {
      for (let i = 0; i < ready.length; i++) {
        const c = ready[i];
        toast.loading(`Scheduling ${i + 1} / ${ready.length}…`, { id: tid });
        const names = c.slideUrls.map((_, j) => `seamless-${i + 1}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(c.slideUrls, names);
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: c.presetId,
            postType: "carousel",
            content: {
              imageUrls,
              caption: c.caption || "",
              title: c.name.slice(0, 80) || `Seamless ${i + 1}`,
              platforms: ["instagram", "facebook"],
              musicTrack: c.track || undefined,
            },
            scheduledAt: new Date(`${c.date}T${c.time}`).toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(`${c.name}: ${err.error}`);
        }
      }
      toast.success(`${ready.length} seamless carousel${ready.length !== 1 ? "s" : ""} queued.`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Scheduling failed", { id: tid });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold">Seamless Carousels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop your wide strips, choose 2 to 5 slides each, and it cuts them into perfect seamless slides ready to schedule.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {phase === "upload" && (
          <div className="space-y-6">
            <label className="block border-2 border-dashed border-border/50 rounded-2xl p-10 text-center cursor-pointer hover:border-pink-500/60 transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
              <p className="text-lg font-medium">Drop your wide strips here</p>
              <p className="text-sm text-muted-foreground mt-1">Each strip is one carousel. e.g. 4320 x 1440 for 4 slides.</p>
            </label>

            {strips.length > 0 && (
              <div className="space-y-3">
                {strips.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 rounded-xl border border-border/40 p-3">
                    <img src={s.url} alt="" className="h-16 w-40 object-cover rounded-md bg-black/30" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.file.name}</p>
                      <p className="text-xs text-muted-foreground">{s.width} x {s.height} px</p>
                    </div>
                    <label className="text-sm flex items-center gap-2">
                      Slides
                      <select value={s.slides} onChange={(e) => setStripSlides(s.id, Number(e.target.value))} className="bg-white/5 border border-border/50 rounded-md px-2 py-1">
                        {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <button onClick={() => removeStrip(s.id)} className="text-muted-foreground hover:text-foreground px-2">✕</button>
                  </div>
                ))}
                <button onClick={cutAll} disabled={busy} className="px-6 py-3 rounded-full bg-pink-500 text-white font-semibold disabled:opacity-40 hover:bg-pink-400 transition-colors">
                  {busy ? "Cutting…" : `Cut ${strips.length} strip${strips.length !== 1 ? "s" : ""} into slides`}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <button onClick={() => setPhase("upload")} className="text-sm text-muted-foreground hover:text-foreground">← Back to strips</button>
              <div className="flex gap-3">
                <button onClick={downloadZip} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Download all (ZIP)</button>
                <button onClick={scheduleAll} disabled={busy} className="px-5 py-2 rounded-lg bg-pink-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-pink-400">
                  {busy ? "Working…" : "Send to scheduler"}
                </button>
              </div>
            </div>

            {carousels.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border/40 p-4 space-y-3">
                <div className="flex gap-1 overflow-x-auto">
                  {c.slideUrls.map((du, si) => (
                    <img key={si} src={du} alt={`slide ${si + 1}`} className="h-40 rounded object-cover shrink-0" style={{ aspectRatio: "3/4" }} />
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client</label>
                    <select value={c.presetId ?? ""} onChange={(e) => updateCarousel(c.id, { presetId: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">
                      <option value="">Select a client…</option>
                      {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Date</label>
                      <input type="date" value={c.date} onChange={(e) => updateCarousel(c.id, { date: e.target.value })} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Time</label>
                      <input type="time" value={c.time} onChange={(e) => updateCarousel(c.id, { time: e.target.value })} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Caption</label>
                    <textarea value={c.caption} onChange={(e) => updateCarousel(c.id, { caption: e.target.value })} rows={2} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" placeholder="Write the caption…" />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => setMusicCarouselId(c.id)} className={`px-3 py-1.5 rounded-lg border text-sm ${c.track ? "border-green-500/50 text-green-300" : "border-border/50 hover:border-pink-500/60"}`}>
                    🎵 {c.track ? c.track.name.slice(0, 24) : "Add music"}
                  </button>
                  <button onClick={() => removeCarousel(c.id)} className="text-sm text-red-300 hover:text-red-200 ml-auto">Delete this carousel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <MusicPickerModal
        open={musicCarouselId !== null}
        onClose={() => setMusicCarouselId(null)}
        selectedTrack={musicCarouselId ? (carousels.find((c) => c.id === musicCarouselId)?.track ?? null) : null}
        onSelect={(t) => { if (musicCarouselId) updateCarousel(musicCarouselId, { track: t }); setMusicCarouselId(null); }}
      />
    </div>
  );
}
