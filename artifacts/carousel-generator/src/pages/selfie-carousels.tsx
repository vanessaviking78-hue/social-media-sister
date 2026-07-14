import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, Send, Check, X, Camera } from "lucide-react";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

// Twelve scenario ids from the AI Portrait Studio's built-in library — a
// deliberately varied set (clinical / lifestyle / brand-headshot) so the
// twelve carousels this tool produces don't all look the same. These are the
// same scenario ids the AI Portrait Studio page already knows how to
// generate; no new AI logic lives here, this just calls the same endpoints
// it does with a fixed, sensible selection instead of asking Vanessa (or the
// client) to pick from 300+ options.
const DEFAULT_SCENARIO_IDS = [
  "clinical-white-coat",
  "clinical-blue-scrubs",
  "clinical-treatment-room",
  "clinical-reception",
  "lifestyle-coffee",
  "lifestyle-outdoors",
  "lifestyle-coworking",
  "lifestyle-home-office",
  "brand-headshot-plain",
  "brand-headshot-branded",
  "brand-speaking",
  "brand-arms-crossed",
];

type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";
type CardState = { scenarioId: string; status: CardStatus; outputImageUrl?: string; failureReason?: string };

type Background = { id: number; imageUrl: string; slideCount: number };

type CompositeRow = {
  scenarioId: string;
  portraitUrl: string;
  backgroundId: number;
  backgroundThumb: string;
  status: "pending" | "working" | "done" | "error";
  resultUrl?: string;
  slideCount?: number;
  error?: string;
};

export default function SelfieCarousels() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sourcePhotoId, setSourcePhotoId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [compositing, setCompositing] = useState(false);
  const [rows, setRows] = useState<CompositeRow[]>([]);

  const client = presets.find((p) => p.id === presetId) || null;

  useEffect(() => {
    setBackgrounds([]);
    setPhotoPreview(null);
    setSourcePhotoId(null);
    setJobId(null);
    setCards([]);
    setRows([]);
    if (!presetId) return;
    fetch(`${BASE}/api/seamless-caro/backgrounds?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Background[]) => setBackgrounds(data))
      .catch(() => toast.error("Couldn't load this client's Seamless Caro backgrounds"));
  }, [presetId]);

  // ── Poll the AI Portrait job until every card is done ──────────────────
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/api/ai-portrait/jobs/${jobId}/status`);
        if (!r.ok) return;
        const data = (await r.json()) as { cards: CardState[] };
        setCards(data.cards);
        const done = data.cards.every((c) => c.status === "success" || c.status === "failed");
        if (done) {
          clearInterval(pollRef.current!);
          setGenerating(false);
          const ok = data.cards.filter((c) => c.status === "success").length;
          const failed = data.cards.filter((c) => c.status === "failed").length;
          if (failed === 0) toast.success(`All ${ok} photoshoot images ready.`);
          else toast.warning(`${ok} ready, ${failed} failed — carrying on with the ones that worked.`);
        }
      } catch {
        /* keep polling */
      }
    }, 900);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  async function handleSelfieUpload(file: File) {
    if (!presetId) { toast.error("Pick a client first"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("clientName", client?.name || "");
      const r = await fetch(`${BASE}/api/ai-portrait/source`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Upload failed");
      setSourcePhotoId(data.id);
      toast.success("Selfie uploaded — ready to generate the photoshoot.");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function generatePortraits() {
    if (!sourcePhotoId) { toast.error("Upload a selfie first"); return; }
    setGenerating(true);
    setRows([]);
    const scenarios = DEFAULT_SCENARIO_IDS.map((id) => ({ id, aspectRatio: "3:4" }));
    setCards(scenarios.map((s) => ({ scenarioId: s.id, status: "idle" as CardStatus })));
    try {
      const r = await fetch(`${BASE}/api/ai-portrait/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePhotoId, clientName: client?.name || "", scenarios }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to start generation");
      setJobId(data.jobId);
      toast.success("Generating 12 photoshoot images. Takes a few minutes — feel free to wait or come back.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to start generation");
      setGenerating(false);
    }
  }

  // ── Composite each finished portrait onto one of this client's Seamless
  // Caro backgrounds (repeating backgrounds if there are fewer than 12), one
  // composite per portrait so each becomes its own carousel. Reuses the
  // exact /seamless-caro/composite endpoint the Seamless Caro Builder tool
  // already uses for a single photo. ──────────────────────────────────────
  async function compositeAll() {
    const ready = cards.filter((c) => c.status === "success" && c.outputImageUrl);
    if (!ready.length) { toast.error("Nothing generated yet."); return; }
    if (!backgrounds.length) { toast.error("This client has no Seamless Caro backgrounds yet. Add at least one in Seamless Caro Builder first."); return; }

    const initialRows: CompositeRow[] = ready.map((c, i) => {
      const bg = backgrounds[i % backgrounds.length];
      return {
        scenarioId: c.scenarioId,
        portraitUrl: c.outputImageUrl!,
        backgroundId: bg.id,
        backgroundThumb: bg.imageUrl,
        status: "pending",
      };
    });
    setRows(initialRows);
    setCompositing(true);
    try {
      for (const row of initialRows) {
        setRows((prev) => prev.map((r) => (r.scenarioId === row.scenarioId ? { ...r, status: "working" } : r)));
        try {
          const r = await fetch(`${BASE}/api/seamless-caro/composite`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ backgroundId: row.backgroundId, photoUrl: row.portraitUrl }),
          });
          if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error); }
          const d = await r.json();
          setRows((prev) => prev.map((x) => (x.scenarioId === row.scenarioId ? { ...x, status: "done", resultUrl: d.imageUrl, slideCount: d.slideCount } : x)));
        } catch (e: any) {
          setRows((prev) => prev.map((x) => (x.scenarioId === row.scenarioId ? { ...x, status: "error", error: e?.message || "Composite failed" } : x)));
        }
      }
      toast.success("Carousels built.");
    } finally {
      setCompositing(false);
    }
  }

  // Hands the finished carousels to Seamless Carousels (seamless-bulk), the
  // same handoff Seamless Caro Builder already uses. Captions are written
  // there with the existing "Generate captions" button — no new caption
  // logic needed, it's the same engine every other tool already uses.
  function sendToSeamlessCarousels() {
    const done = rows.filter((r) => r.status === "done" && r.resultUrl);
    if (!done.length) { toast.error("Nothing finished yet to send."); return; }
    sessionStorage.setItem(
      "seamless-caro-handoff",
      JSON.stringify(done.map((r) => ({ imageUrl: r.resultUrl, slideCount: r.slideCount || 4 })))
    );
    window.location.href = `${BASE}/seamless-bulk`;
  }

  const doneCount = rows.filter((r) => r.status === "done").length;
  const erroredCount = rows.filter((r) => r.status === "error").length;
  const readyCount = cards.filter((c) => c.status === "success").length;
  const allCardsSettled = cards.length > 0 && cards.every((c) => c.status === "success" || c.status === "failed");

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Camera className="w-6 h-6 text-violet-400" />Selfie to Carousels</h1>
        <p className="text-sm text-muted-foreground mt-1">One make-up-free, filterless selfie in. Twelve AI photoshoot images out, each turned into its own carousel on this client's background. Captions get written on the next screen with the same tool every other carousel uses.</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client</label>
          <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full sm:w-80 bg-white/5 border border-violet-500/40 rounded-md px-3 py-2">
            <option value="">Select a client…</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {presetId && (
          <>
            <div className="rounded-2xl border border-violet-500/30 bg-card/60 p-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1 — one selfie</p>
              {backgrounds.length === 0 && (
                <p className="text-xs text-amber-400">This client has no Seamless Caro backgrounds saved yet. Add at least one in Seamless Caro Builder before compositing (you can still generate the photoshoot images now).</p>
              )}
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-violet-500/40 rounded-xl py-8 cursor-pointer hover:border-violet-500/70 transition-colors">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="h-28 w-28 object-cover rounded-full" />
                ) : uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                ) : (
                  <Upload className="w-6 h-6 text-violet-400" />
                )}
                <span className="text-sm text-muted-foreground">{photoPreview ? "Selfie uploaded — tap to replace" : "Upload one make-up-free, filterless selfie"}</span>
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelfieUpload(f); e.currentTarget.value = ""; }} />
              </label>
            </div>

            {sourcePhotoId && (
              <div className="rounded-2xl border border-violet-500/30 bg-card/60 p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 2 — generate the photoshoot</p>
                <button onClick={generatePortraits} disabled={generating} className="flex items-center gap-2 px-6 py-3 rounded-full bg-violet-500 text-white font-semibold disabled:opacity-40 hover:bg-violet-400 transition-colors">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? `Generating (${readyCount}/${DEFAULT_SCENARIO_IDS.length} done)` : "Generate 12 photoshoot images"}
                </button>
                {cards.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {cards.map((c) => (
                      <div key={c.scenarioId} className="aspect-square rounded-lg overflow-hidden bg-black/20 flex items-center justify-center relative border border-border/40">
                        {c.status === "success" && c.outputImageUrl ? (
                          <img src={c.outputImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : c.status === "failed" ? (
                          <X className="w-4 h-4 text-red-400" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {allCardsSettled && readyCount > 0 && rows.length === 0 && (
              <div className="rounded-2xl border border-violet-500/30 bg-card/60 p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 3 — build the carousels</p>
                <p className="text-sm text-muted-foreground">Each of the {readyCount} photoshoot images gets composited onto one of {client?.name}'s Seamless Caro backgrounds{backgrounds.length > 0 && backgrounds.length < readyCount ? ` (${backgrounds.length} background${backgrounds.length > 1 ? "s" : ""}, repeating to cover all ${readyCount})` : ""}.</p>
                <button onClick={compositeAll} disabled={compositing || !backgrounds.length} className="px-6 py-3 rounded-full bg-violet-500 text-white font-semibold disabled:opacity-40 hover:bg-violet-400 transition-colors">
                  {compositing ? "Building…" : `Build ${readyCount} carousels`}
                </button>
              </div>
            )}

            {rows.length > 0 && (
              <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-violet-300">
                    {compositing ? `Working — ${doneCount}/${rows.length} done` : `${doneCount} of ${rows.length} ready${erroredCount ? `, ${erroredCount} failed` : ""}`}
                  </p>
                  {doneCount > 0 && !compositing && (
                    <button onClick={sendToSeamlessCarousels} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500 text-white font-semibold text-sm hover:bg-violet-400">
                      <Send className="w-4 h-4" />Send {doneCount} to Seamless Carousels
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rows.map((row) => (
                    <div key={row.scenarioId} className="rounded-lg border border-border/40 overflow-hidden bg-card/40">
                      <div className="aspect-video bg-black/20 flex items-center justify-center relative">
                        {row.status === "done" && row.resultUrl ? (
                          <img src={row.resultUrl} alt="" className="w-full h-full object-cover" />
                        ) : row.status === "working" ? (
                          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                        ) : row.status === "error" ? (
                          <X className="w-5 h-5 text-red-400" />
                        ) : (
                          <img src={row.backgroundThumb} alt="" className="w-full h-full object-cover opacity-40" />
                        )}
                        {row.status === "done" && (
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>
                        )}
                      </div>
                      <div className="p-2">
                        <span className="text-[11px] text-muted-foreground truncate">{row.status === "error" ? (row.error || "Failed") : row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Next: on the Seamless Carousels screen, hit "Cut all" then "Generate captions" — same caption tool as everywhere else — then schedule as normal.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
