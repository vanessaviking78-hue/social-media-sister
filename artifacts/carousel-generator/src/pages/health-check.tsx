import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, RotateCcw, Instagram, Facebook } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Status = "not_connected" | "no_posts_yet" | "needs_attention" | "healthy";

type Account = {
  presetId: number;
  clientName: string;
  hasToken: boolean;
  igConfigured: boolean;
  fbConfigured: boolean;
  status: Status;
  lastPublishedAt: string | null;
  lastFailedAt: string | null;
  lastFailedError: string | null;
  pendingCount: number;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STATUS_META: Record<Status, { label: string; pill: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Posting fine", pill: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", icon: CheckCircle2 },
  needs_attention: { label: "Needs attention", pill: "bg-red-500/10 border-red-500/30 text-red-300", icon: XCircle },
  no_posts_yet: { label: "No posts yet", pill: "bg-amber-500/10 border-amber-500/30 text-amber-300", icon: Clock },
  not_connected: { label: "Not connected", pill: "bg-zinc-500/10 border-zinc-500/30 text-zinc-400", icon: AlertTriangle },
};

export default function HealthCheck() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/account-health`);
      const data = await r.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setCheckedAt(data.checkedAt || new Date().toISOString());
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needsAttentionCount = useMemo(
    () => accounts.filter((a) => a.status === "needs_attention" || a.status === "not_connected").length,
    [accounts]
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Health Check</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading
              ? "Pulling posting history for every client\u2026"
              : needsAttentionCount === 0
              ? `All ${accounts.length} clients look healthy`
              : `${needsAttentionCount} of ${accounts.length} clients need a look`}
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
          Status is based on real posting outcomes from the scheduler, not a live Facebook check, since Facebook\u2019s own read permissions are unreliable even on accounts posting fine. A client only shows Needs attention when their most recent post attempt actually failed.
        </p>

        {loading && accounts.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking every client\u2019s posting history\u2026
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">No clients found.</p>
        )}

        {accounts.length > 0 && (
          <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
            {accounts.map((a) => {
              const meta = STATUS_META[a.status];
              const StatusIcon = meta.icon;
              return (
                <div key={a.presetId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center hover:bg-card/40 transition-colors">
                  <div className="sm:w-48 shrink-0">
                    <p className="text-sm font-semibold">{a.clientName}</p>
                    {a.pendingCount > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.pendingCount} queued</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium sm:w-44 shrink-0 ${meta.pill}`}>
                    <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                    {meta.label}
                  </div>
                  <div className="flex items-center gap-1.5 sm:w-24 shrink-0 text-muted-foreground">
                    <Instagram className={`w-3.5 h-3.5 ${a.igConfigured ? "text-emerald-400" : "text-zinc-600"}`} />
                    <Facebook className={`w-3.5 h-3.5 ${a.fbConfigured ? "text-emerald-400" : "text-zinc-600"}`} />
                  </div>
                  <div className="flex-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>Last posted: <span className="text-foreground/80">{timeAgo(a.lastPublishedAt)}</span></span>
                    {a.lastFailedAt && (
                      <span className="text-amber-400/90" title={a.lastFailedError || ""}>
                        Last failure: {timeAgo(a.lastFailedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {checkedAt && !loading && (
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Checked {new Date(checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
