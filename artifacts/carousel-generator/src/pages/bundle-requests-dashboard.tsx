import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Copy, Check, ExternalLink, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authHeaders } from "@/lib/use-approval";

const BASE = import.meta.env.BASE_URL || "/";
function api(path: string) { return `${BASE}api/${path}`; }

interface BundleRequest {
  id: number;
  clinicName: string;
  igHandle: string | null;
  email: string;
  treatmentFocus: string;
  status: string;
  bundleToken: string | null;
  createdAt: string;
}

type ActionState = { generating: boolean; declining: boolean; bundleUrl: string | null; copied: boolean };

function StatusBadge({ status }: { status: string }) {
  if (status === "pending_review") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-300 bg-pink-950/40 border border-pink-500/30 rounded-full px-2.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
        Pending review
      </span>
    );
  }
  if (status === "generated") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Generated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50 border border-zinc-700/40 rounded-full px-2.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      Declined
    </span>
  );
}

export default function BundleRequestsDashboard() {
  const [requests, setRequests] = useState<BundleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<Record<number, ActionState>>({});

  const getAction = (id: number): ActionState =>
    actionState[id] ?? { generating: false, declining: false, bundleUrl: null, copied: false };

  const patchAction = (id: number, patch: Partial<ActionState>) =>
    setActionState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { generating: false, declining: false, bundleUrl: null, copied: false }), ...patch } }));

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(api("bundle-requests"), { headers: authHeaders() });
      const data = await resp.json();
      if (Array.isArray(data)) setRequests(data);
    } catch {
      toast.error("Could not load bundle requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const generate = async (req: BundleRequest) => {
    patchAction(req.id, { generating: true });
    try {
      const resp = await fetch(api(`bundle-requests/${req.id}/generate`), {
        method: "POST",
        headers: authHeaders(),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }
      const data = await resp.json();

      const bundleUrl = data.bundleUrl || `${window.location.origin}${BASE.replace(/\/$/, "")}/bundle/${data.token}`;
      patchAction(req.id, { generating: false, bundleUrl });
      setRequests((prev) =>
        prev.map((r) => r.id === req.id ? { ...r, status: "generated", bundleToken: data.token } : r)
      );
      if (data.emailed) {
        toast.success(`Bundle generated and emailed to ${req.email}`);
      } else {
        toast.success("Bundle generated. Copy the link below to send manually.");
      }
    } catch (err: any) {
      patchAction(req.id, { generating: false });
      toast.error(err.message || "Generation failed");
    }
  };

  const decline = async (id: number) => {
    patchAction(id, { declining: true });
    try {
      const resp = await fetch(api(`bundle-requests/${id}/decline`), {
        method: "POST",
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error("Decline failed");
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "declined" } : r));
      toast("Request declined.");
    } catch {
      toast.error("Could not decline request");
    } finally {
      patchAction(id, { declining: false });
    }
  };

  const copyLink = async (id: number, url: string) => {
    await navigator.clipboard.writeText(url);
    patchAction(id, { copied: true });
    setTimeout(() => patchAction(id, { copied: false }), 2000);
  };

  const pendingCount = requests.filter((r) => r.status === "pending_review").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={fetchRequests} className="gap-1.5 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h1 className="font-sans text-3xl font-semibold tracking-tight">Bundle Requests</h1>
              {pendingCount > 0 && (
                <p className="text-sm text-pink-400 font-medium">{pendingCount} pending review</p>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 py-16 text-center space-y-2">
            <Inbox className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No requests yet.</p>
            <p className="text-sm text-muted-foreground/60">
              Share <span className="font-mono text-xs">/trialbundle</span> to start collecting inbound leads.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const action = getAction(req.id);
              const existingBundleUrl = req.bundleToken
                ? `${window.location.origin}${BASE.replace(/\/$/, "")}/bundle/${req.bundleToken}`
                : null;
              const displayUrl = action.bundleUrl || existingBundleUrl;

              return (
                <div key={req.id} className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base text-foreground">{req.clinicName}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      {req.igHandle && (
                        <p className="text-sm text-muted-foreground">{req.igHandle}</p>
                      )}
                      <p className="text-sm text-muted-foreground">{req.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground/60 flex-shrink-0 pt-0.5">
                      {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <div className="rounded-lg bg-accent/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Treatment focus</p>
                    <p className="text-sm text-foreground">{req.treatmentFocus}</p>
                  </div>

                  {/* Bundle link if generated */}
                  {displayUrl && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-accent/30 border border-border/40 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground truncate">
                        {displayUrl}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(req.id, displayUrl)}
                        className="flex-shrink-0"
                      >
                        {action.copied ? (
                          <><Check className="w-3.5 h-3.5 text-green-400 mr-1" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5 mr-1" />Copy</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(displayUrl, "_blank")}
                        className="flex-shrink-0 text-muted-foreground"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Actions for pending */}
                  {req.status === "pending_review" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => generate(req)}
                        disabled={action.generating}
                        className="flex-1 bg-pink-500 hover:bg-pink-400 text-white"
                      >
                        {action.generating ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                        ) : (
                          "Generate bundle"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decline(req.id)}
                        disabled={action.declining}
                        className="text-muted-foreground"
                      >
                        {action.declining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Decline"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
