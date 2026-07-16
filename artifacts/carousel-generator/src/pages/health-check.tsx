import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, RotateCcw, Instagram, Facebook } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PlatformStatus = { connected: boolean; username?: string; name?: string; error?: string };

type Account = {
  presetId: number;
  clientName: string;
  hasToken: boolean;
  ig: PlatformStatus;
  fb: PlatformStatus;
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

function StatusPill({ status, platform }: { status: PlatformStatus; platform: "instagram" | "facebook" }) {
  const Icon = platform === "instagram" ? Instagram : Facebook;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
        status.connected
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-red-500/10 border-red-500/30 text-red-300"
      }`}
      title={status.error || status.username || status.name || ""}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {status.connected ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate max-w-[140px]">
        {status.connected ? (status.username ? `@${status.username}` : status.name || "Connected") : (status.error || "Not connected")}
      </span>
    </div>
  );
}

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

  const sorted = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aBroken = !a.ig.connected || !a.fb.connected;
      const bBroken = !b.ig.connected || !b.fb.connected;
      if (aBroken !== bBroken) return aBroken ? -1 : 1;
      return a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" });
    });
  }, [accounts]);

  const brokenCount = useMemo(
    () => accounts.filter((a) => !a.ig.connected || !a.fb.connected).length,
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
              ? "Testing every connection live…"
              : brokenCount === 0
              ? `All ${accounts.length} clients connected`
              : `${brokenCount} of ${accounts.length} clients need attention`}
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
        {loading && accounts.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking Instagram and Facebook for every client…
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">No clients found.</p>
        )}

        {accounts.length > 0 && (
          <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
            {sorted.map((a) => (
              <div key={a.presetId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center hover:bg-card/40 transition-colors">
                <div className="sm:w-48 shrink-0">
                  <p className="text-sm font-semibold">{a.clientName}</p>
                  {a.pendingCount > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.pendingCount} queued</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:w-72 shrink-0">
                  <StatusPill status={a.ig} platform="instagram" />
                  <StatusPill status={a.fb} platform="facebook" />
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
            ))}
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
