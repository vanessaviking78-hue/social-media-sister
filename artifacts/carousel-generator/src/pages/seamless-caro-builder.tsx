import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, TrendingUp, Plus, X, Download, Send, GripVertical } from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import ApprovedImagesPicker from "@/components/approved-images-picker";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

type Background = {
  id: number;
  presetId: number;
  imageUrl: string;
  slideCount: number;
  anchorX: number;
  anchorY: number;
  anchorW: number;
};

async function compress(du: string, q = 0.9): Promise<string> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => {
      const s = Math.min(1, 1600 / Math.max(i.width, i.height));
      const c = document.createElement("canvas");
      c.width = Math.round(i.width * s);
      c.height = Math.round(i.height * s);
      c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q));
    };
    i.onerror = () => res(du);
    i.src = du;
  });
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((r, j) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result as string);
    fr.onerror = j;
    fr.readAsDataURL(f);
  });
}

// Drag handle for adjusting where the cut-out person lands on the
// background — expressed as fractions of a single panel, so the same
// registration point repeats identically once it's sliced elsewhere.
function AnchorEditor({ bg, onChange }: { bg: Background; onChange: (patch: Partial<Background>) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const panelIndex = 0; // always edit against the first panel; it repeats identically

  function posFromEvent(e: React.MouseEvent | MouseEvent) {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const panelW = rect.width / bg.slideCount;
    const x = e.clientX - rect.left - panelIndex * panelW;
    const y = e.clientY - rect.top;
    return { x: Math.max(0, Math.min(panelW, x)) / panelW, y: Math.max(0, Math.min(rect.height, y)) / rect.height };
  }

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const p = posFromEvent(e);
      if (p) onChange({ anchorX: p.x, anchorY: p.y });
    };
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Drag the marker to where her feet / base should sit — it repeats the same on every panel</p>
      <div ref={wrapRef} className="relative rounded-xl overflow-hidden border border-emerald-500/30 select-none" style={{ cursor: dragging ? "grabbing" : "grab" }}>
        <img src={bg.imageUrl} alt="background" className="w-full block" draggable={false} />
        {Array.from({ length: bg.slideCount }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 border-l border-white/20 pointer-events-none" style={{ left: `${(i / bg.slideCount) * 100}%` }} />
        ))}
        <div
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
          className="absolute w-6 h-6 -ml-3 -mt-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center"
          style={{ left: `${(bg.anchorX / bg.slideCount) * 100}%`, top: `${bg.anchorY * 100}%` }}
        >
          <GripVertical className="w-3 h-3 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground shrink-0">Width</label>
        <input type="range" min={0.15} max={0.6} step={0.01} value={bg.anchorW} onChange={(e) => onChange({ anchorW: Number(e.target.value) })} className="flex-1" />
      </div>
    </div>
  );
}

export default function SeamlessCaroBuilder() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compositing, setCompositing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSlideCount, setResultSlideCount] = useState(3);

  const client = presets.find((p) => p.id === presetId) || null;
  const selectedBg = backgrounds.find((b) => b.id === selectedBgId) || null;

  useEffect(() => {
    if (!presetId) { setBackgrounds([]); setSelectedBgId(null); return; }
    fetch(`${BASE}/api/seamless-caro/backgrounds?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Background[]) => { setBackgrounds(rows); setSelectedBgId(rows[0]?.id ?? null); })
      .catch(() => toast.error("Couldn't load backgrounds for this client"));
  }, [presetId]);

  useEffect(() => { setPhotoUrl(null); setResultUrl(null); }, [selectedBgId]);

  async function onUploadBackgrounds(files: FileList | null) {
    if (!files || !presetId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const du = await fileToDataUrl(file);
        const compressed = await compress(du);
        const r = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ images: [{ name: file.name, base64: compressed }] }),
        });
        if (!r.ok) throw new Error("Upload failed");
        const d = await r.json();
        const imageUrl = d.results?.[0]?.url;
        if (!imageUrl) continue;
        const reg = await fetch(`${BASE}/api/seamless-caro/backgrounds`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ presetId, imageUrl, slideCount: 3 }),
        });
        const regData = await reg.json();
        setBackgrounds((prev) => [{ id: regData.id, presetId, imageUrl, slideCount: 3, anchorX: 0.32, anchorY: 0.95, anchorW: 0.34 }, ...prev]);
      }
      toast.success("Background(s) added");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function patchAnchor(bg: Background, patch: Partial<Background>) {
    const updated = { ...bg, ...patch };
    setBackgrounds((prev) => prev.map((b) => (b.id === bg.id ? updated : b)));
  }

  const anchorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function saveAnchorDebounced(bg: Background) {
    if (anchorSaveTimer.current) clearTimeout(anchorSaveTimer.current);
    anchorSaveTimer.current = setTimeout(() => {
      fetch(`${BASE}/api/seamless-caro/backgrounds/${bg.id}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ anchorX: bg.anchorX, anchorY: bg.anchorY, anchorW: bg.anchorW }),
      }).catch(() => {});
    }, 400);
  }

  async function deleteBackground(id: number) {
    if (!confirm("Remove this background?")) return;
    await fetch(`${BASE}/api/seamless-caro/backgrounds/${id}`, { method: "DELETE", headers: authHeaders() });
    setBackgrounds((prev) => prev.filter((b) => b.id !== id));
    if (selectedBgId === id) setSelectedBgId(null);
  }

  function changeSlideCount(bg: Background, n: number) {
    const updated = { ...bg, slideCount: n };
    setBackgrounds((prev) => prev.map((b) => (b.id === bg.id ? updated : b)));
    fetch(`${BASE}/api/seamless-caro/backgrounds/${bg.id}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ anchorX: bg.anchorX, anchorY: bg.anchorY, anchorW: bg.anchorW }),
    }).catch(() => {});
  }

  async function generate() {
    if (!selectedBg || !photoUrl) { toast.error("Pick a background and an approved photo first."); return; }
    setCompositing(true);
    const tid = toast.loading("Removing background and compositing…");
    try {
      const r = await fetch(`${BASE}/api/seamless-caro/composite`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ backgroundId: selectedBg.id, photoUrl }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error); }
      const d = await r.json();
      setResultUrl(d.imageUrl);
      setResultSlideCount(d.slideCount || selectedBg.slideCount);
      toast.success("Done", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Composite failed", { id: tid });
    } finally {
      setCompositing(false);
    }
  }

  function downloadResult() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "seamless-caro.png";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Hands the wide composite straight to Seamless Carousels, which already
  // does the slicing + CSV flow, via sessionStorage so no re-upload is needed.
  function sendToSeamlessCarousels() {
    if (!resultUrl) return;
    sessionStorage.setItem("seamless-caro-handoff", JSON.stringify({ imageUrl: resultUrl, slideCount: resultSlideCount }));
    window.location.href = `${BASE}/seamless-bulk`;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-emerald-400" />Seamless Caro Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">Preload a client's backgrounds, pick an approved photo, and it strips the background and drops them in, same spot on every slide.</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client</label>
          <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full sm:w-80 bg-white/5 border border-emerald-500/40 rounded-md px-3 py-2">
            <option value="">Select a client…</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {presetId && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{client?.name}'s backgrounds</p>
                <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add background(s)
                  <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => { onUploadBackgrounds(e.target.files); e.currentTarget.value = ""; }} />
                </label>
              </div>
              {backgrounds.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No backgrounds loaded for this client yet.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {backgrounds.map((b) => (
                    <div key={b.id} onClick={() => setSelectedBgId(b.id)} className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${selectedBgId === b.id ? "border-emerald-500" : "border-transparent hover:border-emerald-500/40"}`}>
                      <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); deleteBackground(b.id); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedBg && (
              <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Slides in this carousel</label>
                  <select value={selectedBg.slideCount} onChange={(e) => changeSlideCount(selectedBg, Number(e.target.value))} className="bg-white/5 border border-border/50 rounded-md px-2 py-1 text-sm">
                    {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <AnchorEditor bg={selectedBg} onChange={(patch) => { const updated = { ...selectedBg, ...patch }; patchAnchor(selectedBg, patch); saveAnchorDebounced(updated); }} />

                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Pick her approved photo</p>
                  <ApprovedImagesPicker
                    clientName={client?.name}
                    mode="single"
                    label="Choose approved photo"
                    onAddImages={async (files) => {
                      if (!files.length) return;
                      const du = await fileToDataUrl(files[0]);
                      const compressed = await compress(du);
                      const r = await fetch(`${BASE}/api/content/upload-image`, {
                        method: "POST", headers: authHeaders(),
                        body: JSON.stringify({ images: [{ name: "photo.jpg", base64: compressed }] }),
                      });
                      const d = await r.json();
                      setPhotoUrl(d.results?.[0]?.url || null);
                    }}
                  />
                  {photoUrl && <img src={photoUrl} alt="selected" className="mt-3 h-24 rounded-lg border border-emerald-500/40" />}
                </div>

                <button onClick={generate} disabled={compositing || !photoUrl} className="px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold disabled:opacity-40 hover:bg-emerald-400 transition-colors">
                  {compositing ? "Working…" : "Remove background & composite"}
                </button>
              </div>
            )}

            {resultUrl && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-4">
                <p className="text-sm font-semibold text-emerald-300">Ready</p>
                <img src={resultUrl} alt="result" className="w-full rounded-lg border border-white/10" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadResult} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/50 hover:border-emerald-500/60 text-sm"><Download className="w-4 h-4" />Download</button>
                  <button onClick={sendToSeamlessCarousels} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400"><Send className="w-4 h-4" />Send to Seamless Carousels</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
