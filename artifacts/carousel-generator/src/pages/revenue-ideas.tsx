import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, XCircle, RotateCcw, Users, Trash2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Idea = {
  id: number;
  preset_id: number;
  client_name: string;
  week_of: string;
  title: string;
  instructions: string;
  draft_content: string;
  status: "draft" | "approved" | "rejected";
};

type PoolIdea = {
  id: number;
  week_of: string;
  title: string;
  instructions: string;
  draft_content: string;
  status: "draft" | "approved" | "rejected";
};

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

export default function RevenueIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [weekOf, setWeekOf] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, { title: string; instructions: string; draft_content: string }>>({});

  const [poolIdeas, setPoolIdeas] = useState<PoolIdea[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolGenerating, setPoolGenerating] = useState(false);
  const [poolSavingId, setPoolSavingId] = useState<number | null>(null);
  const [poolEdits, setPoolEdits] = useState<Record<number, { title: string; instructions: string; draft_content: string }>>({});

  function load() {
    setLoading(true);
    fetch(`${BASE}/api/revenue-ideas`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setWeekOf(d.weekOf || "");
        const list: Idea[] = d.ideas || [];
        setIdeas(list);
        const e: Record<number, { title: string; instructions: string; draft_content: string }> = {};
        list.forEach((i) => { e[i.id] = { title: i.title, instructions: i.instructions, draft_content: i.draft_content }; });
        setEdits(e);
      })
      .catch(() => toast.error("Could not load this week's ideas."))
      .finally(() => setLoading(false));
  }

  function loadPool() {
    setPoolLoading(true);
    fetch(`${BASE}/api/revenue-ideas/pool`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const list: PoolIdea[] = d.ideas || [];
        setPoolIdeas(list);
        const e: Record<number, { title: string; instructions: string; draft_content: string }> = {};
        list.forEach((i) => { e[i.id] = { title: i.title, instructions: i.instructions, draft_content: i.draft_content }; });
        setPoolEdits(e);
      })
      .catch(() => toast.error("Could not load the idea pool."))
      .finally(() => setPoolLoading(false));
  }

  useEffect(load, []);
  useEffect(loadPool, []);

  async function generate() {
    setGenerating(true);
    const tid = toast.loading("Writing this week's revenue ideasâ¦");
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/generate`, { method: "POST", headers: authHeaders(), body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      toast.success(`${d.created} new idea${d.created === 1 ? "" : "s"} written, ${d.skipped} already had one this week.`, { id: tid });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Generation failed", { id: tid });
    } finally {
      setGenerating(false);
    }
  }

  async function save(id: number) {
    const e = edits[id];
    if (!e) return;
    setSavingId(id);
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ title: e.title, instructions: e.instructions, draftContent: e.draft_content }) });
      if (!r.ok) throw new Error("Save failed");
      toast.success("Saved.");
      load();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setSavingId(null);
    }
  }

  async function setStatus(id: number, status: "approved" | "rejected" | "draft") {
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("Update failed");
      toast.success(status === "approved" ? "Approved. It'll show on their portal now." : status === "rejected" ? "Rejected." : "Moved back to draft.");
      load();
    } catch {
      toast.error("Could not update status.");
    }
  }

  const update = (id: number, field: "title" | "instructions" | "draft_content", value: string) => {
    setEdits((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  };

  async function generatePool() {
    setPoolGenerating(true);
    const tid = toast.loading("Writing a fresh batch for the poolâ¦");
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/pool/generate`, { method: "POST", headers: authHeaders(), body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      toast.success(`${d.created} new pool idea${d.created === 1 ? "" : "s"} written.`, { id: tid });
      loadPool();
    } catch (e: any) {
      toast.error(e?.message || "Generation failed", { id: tid });
    } finally {
      setPoolGenerating(false);
    }
  }

  async function savePool(id: number) {
    const e = poolEdits[id];
    if (!e) return;
    setPoolSavingId(id);
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/pool/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ title: e.title, instructions: e.instructions, draftContent: e.draft_content }) });
      if (!r.ok) throw new Error("Save failed");
      toast.success("Saved.");
      loadPool();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setPoolSavingId(null);
    }
  }

  async function setPoolStatus(id: number, status: "approved" | "rejected" | "draft") {
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/pool/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("Update failed");
      toast.success(status === "approved" ? "Approved. Every client will see it on their portal now." : status === "rejected" ? "Rejected." : "Moved back to draft.");
      loadPool();
    } catch {
      toast.error("Could not update status.");
    }
  }

  async function deletePool(id: number) {
    try {
      const r = await fetch(`${BASE}/api/revenue-ideas/pool/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Delete failed");
      toast.success("Removed from the pool.");
      loadPool();
    } catch {
      toast.error("Could not remove this idea.");
    }
  }

  const updatePool = (id: number, field: "title" | "instructions" | "draft_content", value: string) => {
    setPoolEdits((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Revenue Ideas</h1>
          <p className="text-sm text-muted-foreground mt-1">One fresh revenue idea per client, every week. Review, tweak, approve, then it shows on their portal.{weekOf && ` Week of ${weekOf}.`}</p>
        </div>
        <button onClick={generate} disabled={generating} className="px-5 py-2.5 rounded-full bg-pink-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-pink-400 flex items-center gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Writingâ¦" : "Generate this week's ideas"}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        <section className="space-y-4">
          <div className="rounded-2xl border border-indigo-600/40 bg-indigo-950/10 p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                <Users className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-bold text-base">Generic Ideas Pool</h2>
                  <p className="text-sm text-muted-foreground mt-1">One shared batch, not tied to any single clinic. Approve one here and it goes straight onto every client's portal at once, no need to approve it per client.</p>
                </div>
              </div>
              <button onClick={generatePool} disabled={poolGenerating} className="px-4 py-2 rounded-full bg-indigo-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-indigo-400 flex items-center gap-2 shrink-0">
                {poolGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {poolGenerating ? "Writingâ¦" : "Generate pool ideas"}
              </button>
            </div>
          </div>

          {poolLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : poolIdeas.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center">
              <p className="text-muted-foreground text-sm">No pool ideas yet. Generate a batch above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {poolIdeas.map((idea) => {
                const e = poolEdits[idea.id] || { title: idea.title, instructions: idea.instructions, draft_content: idea.draft_content };
                return (
                  <div key={idea.id} className={`rounded-2xl border p-5 space-y-3 ${idea.status === "approved" ? "border-green-600/40" : idea.status === "rejected" ? "border-red-600/30 opacity-60" : "border-indigo-700/30"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-900/30 text-indigo-300 border-indigo-700/40">Week of {idea.week_of}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${idea.status === "approved" ? "bg-green-900/30 text-green-400 border-green-700/40" : idea.status === "rejected" ? "bg-red-900/20 text-red-400 border-red-700/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{idea.status}</span>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Idea title</label>
                      <input value={e.title} onChange={(ev) => updatePool(idea.id, "title", ev.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Instructions (why and what to run)</label>
                      <textarea value={e.instructions} onChange={(ev) => updatePool(idea.id, "instructions", ev.target.value)} rows={3} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Ready-to-use copy</label>
                      <textarea value={e.draft_content} onChange={(ev) => updatePool(idea.id, "draft_content", ev.target.value)} rows={4} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => savePool(idea.id)} disabled={poolSavingId === idea.id} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40">{poolSavingId === idea.id ? "Savingâ¦" : "Save edits"}</button>
                      {idea.status !== "approved" && (
                        <button onClick={() => setPoolStatus(idea.id, "approved")} className="px-4 py-2 rounded-lg border border-green-600/50 text-green-400 hover:bg-green-950/20 text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve for all clients</button>
                      )}
                      {idea.status !== "rejected" && (
                        <button onClick={() => setPoolStatus(idea.id, "rejected")} className="px-4 py-2 rounded-lg border border-red-600/40 text-red-400 hover:bg-red-950/10 text-sm font-semibold flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
                      )}
                      {idea.status !== "draft" && (
                        <button onClick={() => setPoolStatus(idea.id, "draft")} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Back to draft</button>
                      )}
                      <button onClick={() => deletePool(idea.id)} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold flex items-center gap-1.5 ml-auto text-muted-foreground hover:text-red-400 hover:border-red-600/40"><Trash2 className="w-4 h-4" /> Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="font-bold text-base">Per-Client Ideas</h2>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-pink-500" /></div>
          ) : ideas.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/30 p-10 text-center">
              <p className="text-muted-foreground mb-4">No ideas generated for this week yet.</p>
              <button onClick={generate} disabled={generating} className="px-5 py-2.5 rounded-full bg-pink-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-pink-400">Generate now</button>
            </div>
          ) : (
            ideas.map((idea) => {
              const e = edits[idea.id] || { title: idea.title, instructions: idea.instructions, draft_content: idea.draft_content };
              return (
                <div key={idea.id} className={`rounded-2xl border p-5 space-y-3 ${idea.status === "approved" ? "border-green-600/40" : idea.status === "rejected" ? "border-red-600/30 opacity-60" : "border-border/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{idea.client_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${idea.status === "approved" ? "bg-green-900/30 text-green-400 border-green-700/40" : idea.status === "rejected" ? "bg-red-900/20 text-red-400 border-red-700/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{idea.status}</span>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Idea title</label>
                    <input value={e.title} onChange={(ev) => update(idea.id, "title", ev.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Instructions (why and what to run)</label>
                    <textarea value={e.instructions} onChange={(ev) => update(idea.id, "instructions", ev.target.value)} rows={3} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Ready-to-use copy</label>
                    <textarea value={e.draft_content} onChange={(ev) => update(idea.id, "draft_content", ev.target.value)} rows={4} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => save(idea.id)} disabled={savingId === idea.id} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40">{savingId === idea.id ? "Savingâ¦" : "Save edits"}</button>
                    {idea.status !== "approved" && (
                      <button onClick={() => setStatus(idea.id, "approved")} className="px-4 py-2 rounded-lg border border-green-600/50 text-green-400 hover:bg-green-950/20 text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve for portal</button>
                    )}
                    {idea.status !== "rejected" && (
                      <button onClick={() => setStatus(idea.id, "rejected")} className="px-4 py-2 rounded-lg border border-red-600/40 text-red-400 hover:bg-red-950/10 text-sm font-semibold flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
                    )}
                    {idea.status !== "draft" && (
                      <button onClick={() => setStatus(idea.id, "draft")} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold flex items-center gap-1.5 ml-auto"><RotateCcw className="w-4 h-4" /> Back to draft</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
