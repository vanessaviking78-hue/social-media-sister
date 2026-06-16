import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Send, Plus, Trash2, Copy, Check, ExternalLink, Loader2, ChevronDown, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertCircle, CalendarDays, Star, RotateCcw, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL;

interface LibraryItem {
  id: number;
  clientName: string;
  postType: string;
  caption: string;
  mediaUrl: string | null;
  mediaUrls: string[] | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface BundleSummary {
  id: number;
  bundleName: string;
  clientName: string;
  clientEmail: string;
  token: string;
  status: string;
  itemCount: number;
  approved: number;
  rejected: number;
  expiresAt: string;
  createdAt: string;
  queuedAt: string | null;
}

interface BundleDetail {
  bundle: BundleSummary;
  items: { id: number; bundleId: number; libraryItemId: number; position: number }[];
  libraryItems: LibraryItem[];
  responses: {
    id: number;
    libraryItemId: number;
    status: string;
    feedback: string;
    bundleRating: number | null;
    overallComments: string;
    submittedAt: string | null;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "Pending",   color: "bg-zinc-500/20 text-zinc-300",  icon: Clock },
  partial:   { label: "Partial",   color: "bg-amber-500/20 text-amber-300", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-300", icon: CheckCircle2 },
  expired:   { label: "Expired",   color: "bg-red-500/20 text-red-400",    icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  return `${days} days left`;
}

function thumb(item: LibraryItem): string | null {
  return item.thumbnailUrl ?? item.mediaUrls?.[0] ?? item.mediaUrl ?? null;
}

export default function ApprovalBundles() {
  const [, navigate] = useLocation();
  const [bundles, setBundles] = useState<BundleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BundleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [libSearch, setLibSearch] = useState("");
  const [libFilter, setLibFilter] = useState<string>("carousel");

  const [bundleName, setBundleName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const [queuingId, setQueuingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/approval-bundles`);
      const d = await r.json() as { bundles: BundleSummary[] };
      setBundles(d.bundles ?? []);
    } catch { toast.error("Failed to load bundles"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  const fetchLibrary = useCallback(async () => {
    setLibLoading(true);
    try {
      const params = new URLSearchParams();
      if (libFilter !== "all") params.set("postType", libFilter);
      const r = await fetch(`${BASE}api/library?${params}`);
      const d = await r.json() as { items: LibraryItem[] };
      setLibraryItems(d.items ?? []);
    } catch { toast.error("Failed to load library"); }
    finally { setLibLoading(false); }
  }, [libFilter]);

  useEffect(() => { if (view === "create") fetchLibrary(); }, [view, fetchLibrary]);

  const loadDetail = useCallback(async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const r = await fetch(`${BASE}api/approval-bundles/${id}`);
      const d = await r.json() as BundleDetail;
      setDetail(d);
    } catch { toast.error("Failed to load bundle detail"); }
    finally { setDetailLoading(false); }
  }, [expandedId]);

  const copyLink = useCallback((token: string) => {
    const url = `${window.location.origin}${BASE}client-approval/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!bundleName.trim()) { toast.error("Bundle name is required"); return; }
    if (selected.size === 0) { toast.error("Select at least one item"); return; }
    setCreating(true);
    try {
      const r = await fetch(`${BASE}api/approval-bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleName: bundleName.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          libraryItemIds: Array.from(selected),
        }),
      });
      const d = await r.json() as { bundle?: BundleSummary; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Create failed");
      toast.success("Approval bundle created");
      setView("list");
      setBundleName(""); setClientName(""); setClientEmail("");
      setSelected(new Set());
      fetchBundles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally { setCreating(false); }
  }, [bundleName, clientName, clientEmail, selected, fetchBundles]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Delete this approval bundle? The client link will stop working.")) return;
    setDeletingId(id);
    try {
      await fetch(`${BASE}api/approval-bundles/${id}`, { method: "DELETE" });
      toast.success("Bundle deleted");
      fetchBundles();
    } catch { toast.error("Delete failed"); }
    finally { setDeletingId(null); }
  }, [fetchBundles]);

  const handleQueue = useCallback(async (id: number) => {
    setQueuingId(id);
    try {
      const r = await fetch(`${BASE}api/approval-bundles/${id}/queue-approved`, { method: "POST" });
      const d = await r.json() as { queued: number; message?: string };
      if (!r.ok) throw new Error(d.message ?? "Queue failed");
      if (d.queued > 0) {
        toast.success(`${d.queued} post${d.queued > 1 ? "s" : ""} added to Scheduler`);
      } else {
        toast.info(d.message ?? "Nothing to queue");
      }
      fetchBundles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Queue failed");
    } finally { setQueuingId(null); }
  }, [fetchBundles]);

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else {
        if (next.size >= 50) { toast.error("Maximum 50 items per bundle"); return prev; }
        next.add(id);
      }
      return next;
    });
  };

  const filteredLib = libraryItems.filter(item => {
    const q = libSearch.toLowerCase();
    return !q || item.clientName.toLowerCase().includes(q) || item.caption.toLowerCase().includes(q);
  });

  if (view === "create") {
    return (
      <div className="min-h-[100dvh] w-full bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setView("list"); setSelected(new Set()); }} className="text-xs">
              Cancel
            </Button>
            <h1 className="font-semibold text-sm">New Approval Bundle</h1>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating || selected.size === 0}>
            {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Create Bundle ({selected.size})
          </Button>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-5">
            <div className="rounded-xl border border-border/30 bg-card/30 p-5 space-y-4">
              <h2 className="font-semibold text-sm">Bundle Details</h2>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bundle name</Label>
                <Input value={bundleName} onChange={e => setBundleName(e.target.value)}
                  placeholder="e.g. Glow Clinic — July 2026" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client name</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Glow Clinic" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client email</Label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder="client@example.com" type="email" className="h-9 text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">The link expires 7 days after creation. The client needs no login.</p>
            </div>

            {selected.size > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/30 p-4">
                <p className="text-sm font-medium mb-2">{selected.size} selected</p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {Array.from(selected).map(id => {
                    const item = libraryItems.find(i => i.id === id);
                    return item ? (
                      <button key={id} onClick={() => toggleItem(id)}
                        className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <span className="truncate max-w-28">{item.caption?.slice(0, 30) || item.clientName}</span>
                        <XCircle className="w-3 h-3 shrink-0" />
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                  placeholder="Search by client or caption" className="h-9 pl-8 text-sm" />
              </div>
              <div className="flex gap-1">
                {["carousel", "single", "all"].map(f => (
                  <button key={f} onClick={() => setLibFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      libFilter === f ? "bg-primary text-primary-foreground" : "bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {libLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filteredLib.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No library items found. Save some content to your library first.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredLib.map(item => {
                  const isSelected = selected.has(item.id);
                  const t = thumb(item);
                  return (
                    <button key={item.id} onClick={() => toggleItem(item.id)}
                      className={`relative rounded-xl border overflow-hidden text-left transition-all ${
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/30 hover:border-border/60"
                      }`}>
                      <div className="aspect-square bg-zinc-900 relative">
                        {t ? (
                          <img src={t} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-primary" />
                          </div>
                        )}
                        {(item.mediaUrls?.length ?? 0) > 1 && (
                          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-xs rounded px-1.5 py-0.5">
                            {item.mediaUrls!.length} slides
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground truncate">{item.clientName}</p>
                        <p className="text-xs truncate mt-0.5">{item.caption?.slice(0, 50) || "No caption"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <Button variant="outline" size="sm" className="text-xs text-muted-foreground">← Hub</Button>
          </Link>
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">Client Approvals</span>
          </div>
        </div>
        <Button size="sm" onClick={() => setView("create")} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Bundle
        </Button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : bundles.length === 0 ? (
          <div className="text-center py-24">
            <Send className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium mb-1">No approval bundles yet</p>
            <p className="text-sm text-muted-foreground mb-6">Select carousels from your library, create a bundle, and send the link to your client.</p>
            <Button onClick={() => setView("create")}><Plus className="w-4 h-4 mr-1.5" /> New Bundle</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bundles.map(bundle => {
              const isExpanded = expandedId === bundle.id;
              const link = `${window.location.origin}${BASE}client-approval/${bundle.token}`;
              return (
                <div key={bundle.id} className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
                  <div className="p-4 flex items-start gap-4">
                    <button onClick={() => loadDetail(bundle.id)} className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{bundle.bundleName}</span>
                        <StatusBadge status={bundle.status} />
                        {(bundle.status === "partial" || bundle.status === "completed") && !bundle.queuedAt && (
                          <span className="text-xs text-amber-400 font-medium">New responses</span>
                        )}
                        {bundle.queuedAt && (
                          <span className="text-xs text-green-500/70">Queued to scheduler</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {bundle.clientName && <span>{bundle.clientName}</span>}
                        {bundle.clientEmail && <span>{bundle.clientEmail}</span>}
                        <span>{bundle.itemCount} items</span>
                        {bundle.status !== "expired" && <span>{daysUntil(bundle.expiresAt)}</span>}
                        {bundle.approved > 0 && <span className="text-green-400">{bundle.approved} approved</span>}
                        {bundle.rejected > 0 && <span className="text-red-400">{bundle.rejected} rejected</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { copyLink(bundle.token); }}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy link">
                        {copied === bundle.token ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Open client link">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {(bundle.approved > 0) && bundle.status !== "expired" && (
                        <button onClick={() => handleQueue(bundle.id)} disabled={queuingId === bundle.id}
                          title="Send approved items to Scheduler"
                          className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-green-400 transition-colors">
                          {queuingId === bundle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(bundle.id)} disabled={deletingId === bundle.id}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Delete bundle">
                        {deletingId === bundle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/20 px-4 pb-4 pt-3">
                      {detailLoading && !detail ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                      ) : detail && detail.bundle.id === bundle.id ? (
                        <div>
                          {detail.responses.find(r => r.bundleRating) && (
                            <div className="mb-4 flex items-center gap-2 text-sm">
                              <Star className="w-4 h-4 text-amber-400" />
                              <span className="font-medium">Overall rating: {detail.responses.find(r => r.bundleRating)?.bundleRating}/10</span>
                              {detail.responses.find(r => r.overallComments) && (
                                <span className="text-muted-foreground truncate max-w-sm">
                                  — "{detail.responses.find(r => r.overallComments)?.overallComments}"
                                </span>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {detail.items.map(item => {
                              const libItem = detail.libraryItems.find(l => l.id === item.libraryItemId);
                              const response = detail.responses.find(r => r.libraryItemId === item.libraryItemId);
                              const t = libItem ? thumb(libItem) : null;
                              return (
                                <div key={item.id} className="rounded-lg border border-border/20 overflow-hidden bg-black/20">
                                  <div className="aspect-square relative bg-zinc-900">
                                    {t ? <img src={t} alt="" className="w-full h-full object-cover" /> : (
                                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                                    )}
                                    {response && (
                                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${
                                        response.status === "approved" ? "bg-green-500" :
                                        response.status === "rejected" ? "bg-red-500" : "bg-zinc-500"
                                      }`}>
                                        {response.status === "approved" ? <Check className="w-3 h-3 text-white" /> :
                                         response.status === "rejected" ? <XCircle className="w-3 h-3 text-white" /> :
                                         <Clock className="w-3 h-3 text-white" />}
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs truncate text-muted-foreground">{libItem?.clientName}</p>
                                    {response?.feedback && (
                                      <p className="text-xs text-amber-300 mt-0.5 truncate" title={response.feedback}>
                                        "{response.feedback}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
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
