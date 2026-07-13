import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, TrendingUp, Plus, X, Download, Send, GripVertical, Check } from "lucide-react";
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

type ApprovedPhoto = { file: File; url: string };

type BatchResult = {
  id: string;
  backgroundId: number;
  backgroundThumb: string;
  photoUrl: string;
  status: "pending" | "working" | "done" | "error";
  resultUrl?: string;
  slideCount?: number;
  error?: string;
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
  // Bulk mode: as many backgrounds and as many approved photos (1-5) as she likes,
  // paired up by position to build a batch of composites in one pass.
  const [selectedBgIds, setSelectedBgIds] = useState<number[]>([]);
  const [editingBgId, setEditingBgId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<ApprovedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);

  const client = presets.find((p) => p.id === presetId) || null;
  const editingBg = backgrounds.find((b) => b.id === editingBgId) || null;
  const pairCount = Math.min(selectedBgIds.length, photos.length);

  useEffect(() => {
    if (!presetId) { setBackgrounds([]); setSelectedBgIds([]); setEditingBgId(null); return; }
    fetch(`${BASE}/api/seamless-caro/backgrounds?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Background[]) => { setBackgrounds(rows); setSelectedBgIds([]); setEditingBgId(rows[0]?.id ?? null); })
      .catch(() => toast.error("Couldn't load backgrounds for this client"));
  }, [presetId]);

  useEffect(() => { setBatch([]); }, [presetId]);

  function toggleBg(id: number) {
    setSelectedBgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setEditingBgId(id);
  }

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
        const newBg: Background = { id: regData.id, presetId, imageUrl, slideCount: 3, anchorX: 0.32, anchorY: 0.95, anchorW: 0.34 };
        setBackgrounds((prev) => [newBg, ...prev]);
        setEditingBgId(newBg.id);
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
    setSelectedBgIds((prev) => prev.filter((x) => x !== id));
    if (editingBgId === id) setEditingBgId(null);
  }

  function changeSlideCount(bg: Background, n: number) {
    const updated = { ...bg, slideCount: n };
    setBackgrounds((prev) => prev.map((b) => (b.id === bg.id ? updated : b)));
    fetch(`${BASE}/api/seamless-caro/backgrounds/${bg.id}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ anchorX: bg.anchorX, anchorY: bg.anchorY, anchorW: bg.anchorW }),
    }).catch(() => {});
  }

  async function addApprovedPhotos(files: File[]) {
    if (!files.length) return;
    const room = 5 - photos.length;
    if (room <= 0) { toast.error("Five approved photos is the most one batch can take."); return; }
    const toAdd = files.slice(0, room);
    if (toAdd.length < files.length) toast.error(`Only added ${toAdd.length} — five is the most one batch can take.`);
    setUploading(true);
    try {
      const added: ApprovedPhoto[] = [];
      for (const file of toAdd) {
        const du = await fileToDataUrl(file);
        const compressed = await compress(du);
        const r = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ images: [{ name: file.name, base64: compressed }] }),
        });
        const d = await r.json();
        const url = d.results?.[0]?.url;
        if (url) added.push({ file, url });
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch {
      toast.error("Couldn't load one of those photos");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  async function generateBatch() {
    if (pairCount === 0) { toast.error("Pick at least one background and one approved photo."); return; }
    const pairs = Array.from({ length: pairCount }, (_, i) => ({ bgId: selectedBgIds[i], photo: photos[i] }));
    const rows: BatchResult[] = pairs.map(({ bgId, photo }) => {
      const bg = backgrounds.find((b) => b.id === bgId)!;
      return { id: `${bgId}-${photo.url}`, backgroundId: bgId, backgroundThumb: bg.imageUrl, photoUrl: photo.url, status: "pending" };
    });
    setBatch(rows);
    setRunning(true);
    try {
      for (const row of rows) {
        setBatch((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "working" } : r)));
        try {
          const r = await fetch(`${BASE}/api/seamless-caro/composite`, {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify({ backgroundId: row.backgroundId, photoUrl: row.photoUrl }),
          });
          if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error); }
          const d = await r.json();
          setBatch((prev) => prev.map((x) => (x.id === row.id ? { ...x, status: "done", resultUrl: d.imageUrl, slideCount: d.slideCount } : x)));
        } catch (e: any) {
          setBatch((prev) => prev.map((x) => (x.id === row.id ? { ...x, status: "error", error: e?.message || "Composite failed" } : x)));
        }
      }
      toast.success("Batch finished");
    } finally {
      setRunning(false);
    }
  }

  function downloadOne(row: BatchResult) {
    if (!row.resultUrl) return;
    const a = document.createElement("a");
    a.href = row.resultUrl;
    a.download = "seamless-caro.png";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Hands the whole batch of composites straight to Seamless Carousels, which
  // already does the slicing + CSV flow, via sessionStorage so nothing needs
  // downloading and re-uploading.
  function sendBatchToSeamlessCarousels() {
    const done = batch.filter((r) => r.status === "done" && r.resultUrl);
    if (!done.length) { toast.error("Nothing finished yet to send."); return; }
    sessionStorage.setItem(
      "seamless-caro-handoff",
      JSON.stringify(done.map((r) => ({ imageUrl: r.resultUrl, slideCount: r.slideCount || 3 })))
    );
    window.location.href = `${BASE}/seamless-bulk`;
  }

  const doneCount = batch.filter((r) => r.status === "done").length;
  const erroredCount = batch.filter((r) => r.status === "error").length;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-emerald-400" />Seamless Caro Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick as many of a client's backgrounds as you like, add up to five approved photos, and it batches through every pairing — same registration point repeated on every slide.</p>
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
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{client?.name}'s backgrounds — tap to select as many as you like</p>
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
                  {backgrounds.map((b) => {
                    const selected = selectedBgIds.includes(b.id);
                    const order = selectedBgIds.indexOf(b.id);
                    return (
                      <div
                        key={b.id}
                        onClick={() => toggleBg(b.id)}
                        className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${selected ? "border-emerald-500" : editingBgId === b.id ? "border-emerald-500/50" : "border-transparent hover:border-emerald-500/40"}`}
                      >
                        <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                        {selected && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center drop-shadow-lg">{order + 1}</span>
                          </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); deleteBackground(b.id); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedBgIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedBgIds.length} background{selectedBgIds.length > 1 ? "s" : ""} selected, in tap order.</p>
              )}
            </div>

            {editingBg && (
              <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Registration point — set once per background, reused every time it's picked</p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">Slides</label>
                    <select value={editingBg.slideCount} onChange={(e) => changeSlideCount(editingBg, Number(e.target.value))} className="bg-white/5 border border-border/50 rounded-md px-2 py-1 text-sm">
                      {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <AnchorEditor bg={editingBg} onChange={(patch) => { const updated = { ...editingBg, ...patch }; patchAnchor(editingBg, patch); saveAnchorDebounced(updated); }} />
              </div>
            )}

            <div className="rounded-2xl border border-green-500/30 bg-card/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Approved photos for this batch — up to five</p>
                {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length}/5</p>}
              </div>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={p.url} className="relative">
                      <img src={p.url} alt="" className="h-20 w-20 object-cover rounded-lg border border-emerald-500/40" />
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <button onClick={() => removePhoto(p.url)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <ApprovedImagesPicker
                  clientName={client?.name}
                  mode="multi"
                  label="Choose approved photos"
                  onAddImages={addApprovedPhotos}
                />
              )}
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5 space-y-3">
              <p className="text-sm">
                {pairCount > 0
                  ? `Ready to batch ${pairCount} composite${pairCount > 1 ? "s" : ""} — background 1 pairs with photo 1, background 2 with photo 2, and so on.`
                  : "Select backgrounds and approved photos above to line up a batch."}
              </p>
              {selectedBgIds.length !== photos.length && selectedBgIds.length > 0 && photos.length > 0 && (
                <p className="text-xs text-amber-400">
                  {selectedBgIds.length} background{selectedBgIds.length > 1 ? "s" : ""} vs {photos.length} photo{photos.length > 1 ? "s" : ""} selected — only the first {pairCount} pairing{pairCount > 1 ? "s" : ""} will run.
                </p>
              )}
              <button onClick={generateBatch} disabled={running || pairCount === 0} className="px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold disabled:opacity-40 hover:bg-emerald-400 transition-colors">
                {running ? "Working through the batch…" : `Remove backgrounds & composite (${pairCount || 0})`}
              </button>
            </div>

            {batch.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-300">
                    {running ? `Working — ${doneCount}/${batch.length} done` : `${doneCount} of ${batch.length} ready${erroredCount ? `, ${erroredCount} failed` : ""}`}
                  </p>
                  {doneCount > 0 && !running && (
                    <button onClick={sendBatchToSeamlessCarousels} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400"><Send className="w-4 h-4" />Send all to Seamless Carousels</button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {batch.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border/40 overflow-hidden bg-card/40">
                      <div className="aspect-video bg-black/20 flex items-center justify-center relative">
                        {row.status === "done" && row.resultUrl ? (
                          <img src={row.resultUrl} alt="" className="w-full h-full object-cover" />
                        ) : row.status === "working" ? (
                          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                        ) : row.status === "error" ? (
                          <X className="w-5 h-5 text-red-400" />
                        ) : (
                          <img src={row.backgroundThumb} alt="" className="w-full h-full object-cover opacity-40" />
                        )}
                        {row.status === "done" && (
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground truncate">{row.status === "error" ? (row.error || "Failed") : row.status}</span>
                        {row.status === "done" && (
                          <button onClick={() => downloadOne(row)} className="p-1 hover:bg-white/10 rounded"><Download className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
