import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, RotateCcw, Trophy, Search, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClientProgress = {
  id: number;
  name: string;
  completedIndexes: number[];
  done: number;
  total: number;
};

export default function ReelsChallengeAdmin() {
  const [progress, setProgress] = useState<ClientProgress[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/presets/reels-challenge-progress`);
      const d = await r.json();
      setProgress(Array.isArray(d.progress) ? d.progress : []);
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      setProgress([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = progress.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const started = progress.filter((p) => p.done > 0).length;
  const finished = progress.filter((p) => p.done >= (p.total || 30)).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Reels Challenge</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loadingâ¦" : `${started} of ${progress.length} started Â· ${finished} finished all 30`}
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by client name"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-4 py-3 text-sm text-white outline-none focus:border-pink-600"
          />
        </div>

        {loading && progress.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading progressâ¦
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">No clients found.</p>
        )}

        <div className="space-y-3">
          {filtered.map((p, i) => {
            const isExpanded = expandedId === p.id;
            const isTop3 = i < 3 && p.done > 0;
            return (
              <div key={p.id} className="rounded-2xl border border-border/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isTop3 ? (
                        <Trophy className={`w-4 h-4 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : "text-amber-600"}`} />
                      ) : (
                        <Trophy className="w-4 h-4 text-pink-400/40" />
                      )}
                      <span className="font-semibold text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{p.done}/{p.total} done</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 transition-all"
                      style={{ width: `${Math.round((p.done / (p.total || 1)) * 100)}%` }}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-900/40 p-4 space-y-1.5">
                    {items.map((item, idx) => {
                      const done = p.completedIndexes.includes(idx);
                      return (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-pink-400 mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-zinc-700 mt-0.5 shrink-0" />
                          )}
                          <span className={done ? "text-zinc-500 line-through" : "text-zinc-300"}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
