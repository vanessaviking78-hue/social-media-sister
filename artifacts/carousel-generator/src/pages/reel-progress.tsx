import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, RotateCcw, Clapperboard, Search } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClientReelProgress = { id: number; name: string; done: number; total: number };

export default function ReelProgress() {
  const [progress, setProgress] = useState<ClientReelProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/presets/reel-progress`);
      const d = await r.json();
      const rows = Array.isArray(d.progress) ? d.progress : [];
      rows.sort((a: ClientReelProgress, b: ClientReelProgress) => b.done - a.done);
      setProgress(rows);
    } catch {
      setProgress([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = progress.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const started = progress.filter((p) => p.done > 0).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">100 Reels Progress</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${started} of ${progress.length} client${progress.length === 1 ? "" : "s"} have started`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by client name" className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-4 py-3 text-sm text-white outline-none focus:border-pink-600" />
        </div>

        {loading && progress.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading progress…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">No clients found.</p>
        )}

        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-pink-400" />
                  <span className="font-semibold text-sm">{p.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{p.done}/{p.total} filmed</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 transition-all" style={{ width: `${Math.round((p.done / (p.total || 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
