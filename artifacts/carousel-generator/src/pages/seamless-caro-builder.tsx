import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, TrendingUp, Plus, X, Download, Send, Check } from "lucide-react";
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

type ApprovedPhoto = { file: File; url: string; aspect: number };

type Placement = { anchorX: number; anchorY: number; anchorW: number };

type Piece = {
  key: string;
  bgId: number;
  photos: ApprovedPhoto[];
  placements: Placement[];
};

type BatchResult = {
  id: string;
  backgroundId: number;
  backgroundThumb: string;
  status: "pending" | "working" | "done" | "error";
  resultUrl?: string;
  slideCount?: number;
  error?: string;
};

const MAX_PHOTOS = 100;
const PIECE_SIZE = 4;
const DEFAULT_PLACEMENT: Placement = { anchorX: 0.5, anchorY: 0.94, anchorW: 0.34 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle-bag photo picker: draws from a freshly shuffled copy of the whole
// approved-photo pool and only reshuffles once that copy runs out. So every
// photo gets used once before anything repeats, and when a photo does repeat
// across carousels it lands in a different spot each time rather than the
// same order over and over.
function makePhotoDrawer(pool: ApprovedPhoto[]) {
  let deck: ApprovedPhoto[] = [];
  return function draw(count: number): ApprovedPhoto[] {
    const out: ApprovedPhoto[] = [];
    while (out.length < count && pool.length > 0) {
      if (deck.length === 0) deck = shuffle(pool);
      out.push(deck.shift()!);
    }
    return out;
  };
}

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

function loadAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i.naturalHeight / Math.max(1, i.naturalWidth));
    i.onerror = () => resolve(1);
    i.src = url;
  });
}

// One draggable, resizable photo sitting over its own panel guideline. Drag
// anywhere on the photo to move it; drag the little corner handle to resize
// it. Position is stored as fractions (anchorX/anchorY relative to its own
// panel, anchorW relative to panel width) — the same maths the backend uses
// to place the real cut-out, so what you see here is what you get.
function PlacementOverlay({
  photo, placement, panelIndex, panelCount, containerRef, onChange,
}: {
  photo: ApprovedPhoto; placement: Placement; panelIndex: number; panelCount: number;
  containerRef: React.RefObject<HTMLDivElement>; onChange: (p: Placement) => void;
}) {
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const startRef = useRef<{ mouseX: number; mouseY: number; placement: Placement } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const el = containerRef.current;
      const start = startRef.current;
      if (!el || !start) return;
      const rect = el.getBoundingClientRect();
      const panelW = rect.width / panelCount;
      const dxFracPanel = (e.clientX - start.mouseX) / panelW;
      const dyFracFull = (e.clientY - start.mouseY) / rect.height;
      if (dragging === "move") {
        onChange({
          ...start.placement,
          anchorX: Math.max(0, Math.min(1, start.placement.anchorX + dxFracPanel)),
          anchorY: Math.max(0.08, Math.min(1, start.placement.anchorY + dyFracFull)),
        });
      } else {
        onChange({ ...start.placement, anchorW: Math.max(0.12, Math.min(0.95, start.placement.anchorW + dxFracPanel)) });
      }
    }
    function onUp() { setDragging(null); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, panelCount]);

  const panelPct = 100 / panelCount;
  const leftPct = panelIndex * panelPct + placement.anchorX * panelPct;
  const widthPct = placement.anchorW * panelPct;
  const topPct = placement.anchorY * 100;

  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); startRef.current = { mouseX: e.clientX, mouseY: e.clientY, placement }; setDragging("move"); }}
      className="absolute cursor-move"
      style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${widthPct}%`, aspectRatio: `1 / ${photo.aspect}`, transform: "translate(-50%, -100%)" }}
    >
      <img src={photo.url} alt="" draggable={false} className="w-full h-full object-cover rounded-md border-2 border-emerald-400 shadow-lg select-none" />
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startRef.current = { mouseX: e.clientX, mouseY: e.clientY, placement }; setDragging("resize"); }}
        className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white cursor-nwse-resize"
      />
    </div>
  );
}

// Shows one background sliced into guideline panels, one photo dragged onto
// each — the "arrange" step for a single piece of content before it gets
// composited for real.
function PieceEditor({ background, piece, onChangePlacement }: {
  background: Background; piece: Piece; onChangePlacement: (photoIndex: number, p: Placement) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const n = piece.photos.length;
  return (
    <div ref={wrapRef} className="relative rounded-xl overflow-hidden border border-emerald-500/30 select-none">
      <img src={background.imageUrl} alt="background" className="w-full block" draggable={false} />
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="absolute top-0 bottom-0 border-l border-white/20 pointer-events-none" style={{ left: `${(i / n) * 100}%` }} />
      ))}
      {piece.photos.map((photo, i) => (
        <PlacementOverlay
          key={photo.url + i}
          photo={photo}
          placement={piece.placements[i]}
          panelIndex={i}
          panelCount={n}
          containerRef={wrapRef}
          onChange={(p) => onChangePlacement(i, p)}
        />
      ))}
    </div>
  );
}

export default function SeamlessCaroBuilder() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [selectedBgIds, setSelectedBgIds] = useState<number[]>([]);
  const [photos, setPhotos] = useState<ApprovedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<"select" | "arrange">("select");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [batch, setBatch] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);

  const client = presets.find((p) => p.id === presetId) || null;
  const pairCount = selectedBgIds.length;

  useEffect(() => {
    if (!presetId) { setBackgrounds([]); setSelectedBgIds([]); return; }
    fetch(`${BASE}/api/seamless-caro/backgrounds?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Background[]) => { setBackgrounds(rows); setSelectedBgIds([]); })
      .catch(() => toast.error("Couldn't load backgrounds for this client"));
  }, [presetId]);

  useEffect(() => { setBatch([]); setPhase("select"); setPieces([]); }, [presetId]);

  function toggleBg(id: number) {
    setSelectedBgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
          body: JSON.stringify({ presetId, imageUrl, slideCount: 4 }),
        });
        const regData = await reg.json();
        const newBg: Background = { id: regData.id, presetId, imageUrl, slideCount: 4, anchorX: 0.32, anchorY: 0.95, anchorW: 0.34 };
        setBackgrounds((prev) => [newBg, ...prev]);
      }
      toast.success("Background(s) added");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteBackground(id: number) {
    if (!confirm("Remove this background?")) return;
    await fetch(`${BASE}/api/seamless-caro/backgrounds/${id}`, { method: "DELETE", headers: authHeaders() });
    setBackgrounds((prev) => prev.filter((b) => b.id !== id));
    setSelectedBgIds((prev) => prev.filter((x) => x !== id));
  }

  async function addApprovedPhotos(files: File[]) {
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`${MAX_PHOTOS} approved photos is the most one batch can take.`); return; }
    const toAdd = files.slice(0, room);
    if (toAdd.length < files.length) toast.error(`Only added ${toAdd.length} — ${MAX_PHOTOS} is the most one batch can take.`);
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
        if (url) {
          const aspect = await loadAspect(url);
          added.push({ file, url, aspect });
        }
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

  // Builds one "piece" per selected background — every background gets its
  // own carousel of exactly PIECE_SIZE photos. Photos are pulled from a
  // shuffle-bag over the whole approved pool, so if there aren't enough
  // unique photos to give every background a fresh set, photos repeat to
  // fill the quota but never in the same order twice.
  function buildPieces() {
    if (selectedBgIds.length === 0 || photos.length === 0) { toast.error("Pick at least one background and at least one approved photo."); return; }
    const draw = makePhotoDrawer(photos);
    const nextPieces: Piece[] = selectedBgIds.map((bgId, i) => {
      const group = draw(PIECE_SIZE);
      return {
        key: `${bgId}-${i}`,
        bgId,
        photos: group,
        placements: group.map(() => ({ ...DEFAULT_PLACEMENT })),
      };
    });
    setPieces(nextPieces);
    setPhase("arrange");
  }

  function updatePlacement(pieceKey: string, photoIndex: number, p: Placement) {
    setPieces((prev) => prev.map((piece) => (piece.key !== pieceKey ? piece : {
      ...piece,
      placements: piece.placements.map((old, i) => (i === photoIndex ? p : old)),
    })));
  }

  async function generateBatch() {
    const rows: BatchResult[] = pieces.map((piece) => {
      const bg = backgrounds.find((b) => b.id === piece.bgId)!;
      return { id: piece.key, backgroundId: piece.bgId, backgroundThumb: bg.imageUrl, status: "pending" };
    });
    setBatch(rows);
    setRunning(true);
    try {
      for (const piece of pieces) {
        setBatch((prev) => prev.map((r) => (r.id === piece.key ? { ...r, status: "working" } : r)));
        try {
          const r = await fetch(`${BASE}/api/seamless-caro/composite-multi`, {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify({
              backgroundId: piece.bgId,
              photos: piece.photos.map((photo, i) => ({ photoUrl: photo.url, ...piece.placements[i] })),
            }),
          });
          if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error); }
          const d = await r.json();
          setBatch((prev) => prev.map((x) => (x.id === piece.key ? { ...x, status: "done", resultUrl: d.imageUrl, slideCount: d.slideCount } : x)));
        } catch (e: any) {
          setBatch((prev) => prev.map((x) => (x.id === piece.key ? { ...x, status: "error", error: e?.message || "Composite failed" } : x)));
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
      JSON.stringify(done.map((r) => ({ imageUrl: r.resultUrl, slideCount: r.slideCount || 4 })))
    );
    window.location.href = `${BASE}/seamless-bulk`;
  }

  const doneCount = batch.filter((r) => r.status === "done").length;
  const erroredCount = batch.filter((r) => r.status === "error").length;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-emerald-400" />Seamless Caro Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick as many backgrounds as you like and add as many approved photos as you like — every background gets its own carousel of four photos, repeating where needed but never in the same order twice. Drag each one onto its guideline before you composite.</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client</label>
          <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full sm:w-80 bg-white/5 border border-emerald-500/40 rounded-md px-3 py-2">
            <option value="">Select a client…</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {presetId && phase === "select" && (
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
                        className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${selected ? "border-emerald-500" : "border-transparent hover:border-emerald-500/40"}`}
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

            <div className="rounded-2xl border border-green-500/30 bg-card/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Approved photos for this batch — add as many as you like</p>
                {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}</p>}
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
              {photos.length < MAX_PHOTOS && (
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
                {pairCount > 0 && photos.length > 0
                  ? `Every one of your ${pairCount} selected background${pairCount > 1 ? "s" : ""} gets its own carousel of 4 photos, drawn from your ${photos.length} approved photo${photos.length !== 1 ? "s" : ""}. If there aren't enough to go round, photos repeat to fill the quota — just in a different order on each carousel.`
                  : "Select as many backgrounds and approved photos as you like to line up a batch."}
              </p>
              <button onClick={buildPieces} disabled={pairCount === 0 || photos.length === 0} className="px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold disabled:opacity-40 hover:bg-emerald-400 transition-colors">
                Arrange placements ({pairCount || 0})
              </button>
            </div>
          </>
        )}

        {phase === "arrange" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => setPhase("select")} className="text-sm text-muted-foreground hover:text-foreground">← Back to selection</button>
              <p className="text-xs text-muted-foreground">Drag a photo to reposition it, drag its corner handle to resize it.</p>
            </div>
            {pieces.map((piece) => {
              const bg = backgrounds.find((b) => b.id === piece.bgId)!;
              return (
                <div key={piece.key} className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5 space-y-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{piece.photos.length} photos on this background</p>
                  <PieceEditor background={bg} piece={piece} onChangePlacement={(photoIndex, p) => updatePlacement(piece.key, photoIndex, p)} />
                </div>
              );
            })}
            <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-5">
              <button onClick={generateBatch} disabled={running} className="px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold disabled:opacity-40 hover:bg-emerald-400 transition-colors">
                {running ? "Working through the batch…" : `Composite (${pieces.length})`}
              </button>
            </div>
          </div>
        )}

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
      </main>
    </div>
  );
}
