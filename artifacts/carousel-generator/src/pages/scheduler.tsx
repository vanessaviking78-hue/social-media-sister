import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, Plus, BarChart3, Calendar, Film, Layers, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";

type PostContent = { imageUrls?: string[]; videoUrl?: string; caption: string; title: string };

type ScheduledPost = {
  id: number;
  presetId: number;
  clientName: string;
  postType: "carousel" | "reel";
  content: PostContent;
  scheduledAt: string;
  status: "pending" | "processing" | "published" | "failed" | "cancelled";
  metaStatus: "pending" | "success" | "failed" | "skipped";
  metaResult: { igPostId?: string; fbPostId?: string; error?: string } | null;
  metaPostedAt: string | null;
  ccStatus: "pending" | "success" | "failed" | "skipped";
  ccResult: { postId?: string; error?: string } | null;
  ccPostedAt: string | null;
  isTrial: boolean;
  notes: string;
  createdAt: string;
};

type Stats = {
  totals: { total: number; metaSuccess: number; metaFail: number; ccSuccess: number; ccFail: number };
  byClient: Record<string, { total: number; metaSuccess: number; metaFail: number; ccSuccess: number; ccFail: number }>;
  pendingCount: number;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function railBadge(status: string) {
  if (status === "success") return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> OK</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Fail</span>;
  if (status === "skipped") return <span className="inline-flex items-center gap-1 text-xs text-zinc-500">—</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><Clock size={12} /> —</span>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-blue-900/40 text-blue-300 border-blue-700",
    processing: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    published: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
    failed: "bg-red-900/40 text-red-300 border-red-700",
    cancelled: "bg-zinc-800 text-zinc-400 border-zinc-600",
  };
  return <span className={`text-xs px-2 py-0.5 rounded border font-medium ${map[status] || "bg-zinc-800 text-zinc-400"}`}>{status}</span>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function pct(n: number, d: number) {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

type ScheduleDialogProps = {
  presets: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  editing?: ScheduledPost | null;
};

function ScheduleDialog({ presets, onClose, onSaved, editing }: ScheduleDialogProps) {
  const [presetId, setPresetId] = useState<string>(editing ? String(editing.presetId) : "");
  const [postType, setPostType] = useState<"carousel" | "reel">(editing?.postType ?? "carousel");
  const [title, setTitle] = useState(editing?.content.title ?? "");
  const [caption, setCaption] = useState(editing?.content.caption ?? "");
  const [imageUrls, setImageUrls] = useState(editing?.content.imageUrls?.join("\n") ?? "");
  const [videoUrl, setVideoUrl] = useState(editing?.content.videoUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (editing?.scheduledAt) {
      const d = new Date(editing.scheduledAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }
    const d = new Date();
    d.setHours(18, 45, 0, 0);
    d.setDate(d.getDate() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [isTrial, setIsTrial] = useState(editing?.isTrial ?? false);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!presetId) { toast.error("Select a client"); return; }
    if (!caption.trim()) { toast.error("Caption is required"); return; }
    if (postType === "reel" && !videoUrl.trim()) { toast.error("Video URL is required for reels"); return; }
    if (postType === "carousel" && !imageUrls.trim()) { toast.error("At least one image URL is required for carousels"); return; }

    setSaving(true);
    try {
      const content: PostContent = {
        caption: caption.trim(),
        title: title.trim() || "Untitled",
        ...(postType === "reel" ? { videoUrl: videoUrl.trim() } : {
          imageUrls: imageUrls.split("\n").map((u) => u.trim()).filter(Boolean),
        }),
      };

      if (editing) {
        await apiFetch(`/api/scheduler/posts/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ content, scheduledAt: new Date(scheduledAt).toISOString(), notes }),
        });
        toast.success("Post updated");
      } else {
        await apiFetch("/api/scheduler/posts", {
          method: "POST",
          body: JSON.stringify({ presetId: Number(presetId), postType, content, scheduledAt: new Date(scheduledAt).toISOString(), isTrial, notes }),
        });
        toast.success("Post scheduled");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">{editing ? "Edit Scheduled Post" : "Schedule a Post"}</h2>
          <p className="text-sm text-zinc-400 mt-1">Posts will go to both Meta direct and Cloud Campaign simultaneously.</p>
        </div>
        <div className="p-6 space-y-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Client</Label>
                <Select value={presetId} onValueChange={setPresetId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-zinc-700">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300 text-sm mb-1.5 block">Post Type</Label>
                <Select value={postType} onValueChange={(v) => setPostType(v as "carousel" | "reel")}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="carousel" className="text-white hover:bg-zinc-700">Carousel</SelectItem>
                    <SelectItem value="reel" className="text-white hover:bg-zinc-700">Reel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Title (internal)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kelly Rafique — Carousel 1" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
          </div>

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Caption</Label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Instagram caption..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
            />
          </div>

          {postType === "reel" ? (
            <div>
              <Label className="text-zinc-300 text-sm mb-1.5 block">Video URL (object storage URL)</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="trial" checked={isTrial} onChange={(e) => setIsTrial(e.target.checked)} className="accent-pink-500" />
                <label htmlFor="trial" className="text-sm text-zinc-300">Trial reel (manual graduation)</label>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-zinc-300 text-sm mb-1.5 block">Image URLs (one per line)</Label>
              <textarea
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder={"https://storage.../image1.jpg\nhttps://storage.../image2.jpg"}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none font-mono text-xs"
              />
            </div>
          )}

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Schedule date & time</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white [color-scheme:dark]"
            />
          </div>

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white">
            {saving ? "Saving..." : editing ? "Save Changes" : "Schedule Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Scheduler() {
  const { presets } = usePresets();
  const [tab, setTab] = useState<"upcoming" | "published" | "failed" | "dashboard">("upcoming");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ScheduledPost | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postsData, statsData] = await Promise.all([
        apiFetch("/api/scheduler/posts"),
        apiFetch("/api/scheduler/stats"),
      ]);
      setPosts(postsData.posts);
      setStats(statsData);
    } catch (e: any) {
      toast.error("Failed to load scheduler: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: number) {
    try {
      await apiFetch(`/api/scheduler/posts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      toast.success("Post cancelled");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/scheduler/posts/${id}`, { method: "DELETE" });
      toast.success("Post deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleRetry(id: number) {
    try {
      await apiFetch(`/api/scheduler/posts/${id}/retry`, { method: "POST" });
      toast.success("Queued for retry");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  const clientNames = Array.from(new Set(posts.map((p) => p.clientName))).sort();

  const filtered = posts.filter((p) => {
    if (filterClient !== "all" && p.clientName !== filterClient) return false;
    if (tab === "upcoming") return p.status === "pending" || p.status === "processing";
    if (tab === "published") return p.status === "published";
    if (tab === "failed") return p.status === "failed";
    return false;
  });

  const upcoming = posts.filter((p) => p.status === "pending" || p.status === "processing").length;
  const published = posts.filter((p) => p.status === "published").length;
  const failed = posts.filter((p) => p.status === "failed").length;

  const metaPct = stats ? pct(stats.totals.metaSuccess, stats.totals.metaSuccess + stats.totals.metaFail) : "—";
  const ccPct = stats ? pct(stats.totals.ccSuccess, stats.totals.ccSuccess + stats.totals.ccFail) : "—";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {(showDialog || editing) && (
        <ScheduleDialog
          presets={(presets || []).map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => { setShowDialog(false); setEditing(null); }}
          onSaved={load}
          editing={editing}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Posting Scheduler</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Dual-rail posting — Meta Direct + Cloud Campaign in parallel</p>
          </div>
          <Button onClick={() => setShowDialog(true)} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
            <Plus size={16} /> Schedule Post
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-300">{stats?.pendingCount ?? upcoming}</div>
            <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><Clock size={12} /> Queued</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-300">{published}</div>
            <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Published</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{metaPct}</div>
            <div className="text-xs text-zinc-400 mt-1">Meta success rate</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{ccPct}</div>
            <div className="text-xs text-zinc-400 mt-1">CC success rate</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
            {(["upcoming", "published", "failed", "dashboard"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  tab === t ? "bg-pink-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {t === "upcoming" && `Upcoming ${upcoming > 0 ? `(${upcoming})` : ""}`}
                {t === "published" && `Published ${published > 0 ? `(${published})` : ""}`}
                {t === "failed" && `Failed ${failed > 0 ? `(${failed})` : ""}`}
                {t === "dashboard" && "Comparison"}
              </button>
            ))}
          </div>

          {tab !== "dashboard" && (
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white w-48">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all" className="text-white hover:bg-zinc-700">All clients</SelectItem>
                {clientNames.map((n) => (
                  <SelectItem key={n} value={n} className="text-white hover:bg-zinc-700">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <button onClick={load} className="ml-auto p-2 text-zinc-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {tab === "dashboard" ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-1">Meta Direct vs Cloud Campaign — Reliability Trial</h2>
              <p className="text-sm text-zinc-400 mb-4">Both rails fire simultaneously for every post. Use this data to decide whether to cancel CC.</p>

              {stats && stats.totals.total > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-800/60 rounded-lg p-4">
                      <div className="text-xs text-zinc-400 mb-1">Meta Direct</div>
                      <div className="text-3xl font-bold text-white mb-1">{metaPct}</div>
                      <div className="text-xs text-zinc-400">{stats.totals.metaSuccess} ok / {stats.totals.metaFail} failed</div>
                      <div className="mt-2 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${stats.totals.metaSuccess + stats.totals.metaFail > 0 ? (stats.totals.metaSuccess / (stats.totals.metaSuccess + stats.totals.metaFail)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="bg-zinc-800/60 rounded-lg p-4">
                      <div className="text-xs text-zinc-400 mb-1">Cloud Campaign</div>
                      <div className="text-3xl font-bold text-white mb-1">{ccPct}</div>
                      <div className="text-xs text-zinc-400">{stats.totals.ccSuccess} ok / {stats.totals.ccFail} failed</div>
                      <div className="mt-2 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${stats.totals.ccSuccess + stats.totals.ccFail > 0 ? (stats.totals.ccSuccess / (stats.totals.ccSuccess + stats.totals.ccFail)) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {stats.totals.metaSuccess + stats.totals.metaFail >= 10 && (
                    <div className={`rounded-lg p-4 text-sm mb-4 ${
                      stats.totals.metaSuccess / Math.max(1, stats.totals.metaSuccess + stats.totals.metaFail) >= 0.95
                        ? "bg-emerald-900/30 border border-emerald-700 text-emerald-300"
                        : "bg-yellow-900/30 border border-yellow-700 text-yellow-300"
                    }`}>
                      {stats.totals.metaSuccess / Math.max(1, stats.totals.metaSuccess + stats.totals.metaFail) >= 0.95
                        ? "✓ Meta Direct is performing at 95%+. You have the data to confidently cancel Cloud Campaign."
                        : "Meta Direct is below 95%. Keep running the trial before making a decision on CC."}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-400 border-b border-zinc-800">
                          <th className="pb-2 pr-4 font-medium">Client</th>
                          <th className="pb-2 pr-4 font-medium text-right">Posts</th>
                          <th className="pb-2 pr-4 font-medium text-right">Meta ✓</th>
                          <th className="pb-2 pr-4 font-medium text-right">Meta %</th>
                          <th className="pb-2 pr-4 font-medium text-right">CC ✓</th>
                          <th className="pb-2 font-medium text-right">CC %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.byClient).sort((a, b) => b[1].total - a[1].total).map(([name, s]) => (
                          <tr key={name} className="border-b border-zinc-800/50">
                            <td className="py-2 pr-4 text-white">{name}</td>
                            <td className="py-2 pr-4 text-right text-zinc-300">{s.total}</td>
                            <td className="py-2 pr-4 text-right text-emerald-400">{s.metaSuccess}</td>
                            <td className="py-2 pr-4 text-right text-zinc-300">{pct(s.metaSuccess, s.metaSuccess + s.metaFail)}</td>
                            <td className="py-2 pr-4 text-right text-blue-400">{s.ccSuccess}</td>
                            <td className="py-2 text-right text-zinc-300">{pct(s.ccSuccess, s.ccSuccess + s.ccFail)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No completed posts yet. Stats will appear here once posts are published.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {loading && (
              <div className="text-center py-16 text-zinc-500">
                <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                <p>Loading...</p>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
                {tab === "upcoming" ? <Clock size={40} className="mx-auto mb-3 opacity-30" /> : tab === "failed" ? <XCircle size={40} className="mx-auto mb-3 opacity-30" /> : <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />}
                <p className="text-sm">
                  {tab === "upcoming" ? "No upcoming posts. Schedule one using the button above." : tab === "failed" ? "No failed posts." : "No published posts yet."}
                </p>
              </div>
            )}
            {!loading && filtered.map((post) => (
              <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {post.postType === "reel"
                      ? <Film size={16} className="text-purple-400" />
                      : <Layers size={16} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{post.clientName}</span>
                      {post.isTrial && <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded">trial</span>}
                      {statusBadge(post.status)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 truncate">{post.content.title || "Untitled"}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{post.content.caption?.slice(0, 80)}{(post.content.caption?.length ?? 0) > 80 ? "…" : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-zinc-300 flex items-center gap-1 justify-end"><Calendar size={11} />{fmtDate(post.scheduledAt)}</div>
                    {post.status === "published" && (
                      <div className="flex items-center gap-3 mt-1 justify-end">
                        <span className="text-xs text-zinc-500">Meta: {railBadge(post.metaStatus)}</span>
                        <span className="text-xs text-zinc-500">CC: {railBadge(post.ccStatus)}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                    className="shrink-0 p-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    {expandedId === post.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {expandedId === post.id && (
                  <div className="border-t border-zinc-800 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-zinc-400 mb-1 font-medium">Meta Direct</div>
                        <div className="flex items-center gap-1 mb-1">{railBadge(post.metaStatus)}</div>
                        {post.metaResult?.igPostId && <div className="text-zinc-400">IG: {post.metaResult.igPostId}</div>}
                        {post.metaResult?.fbPostId && <div className="text-zinc-400">FB: {post.metaResult.fbPostId}</div>}
                        {post.metaResult?.error && <div className="text-red-400">{post.metaResult.error}</div>}
                        {post.metaPostedAt && <div className="text-zinc-500 mt-1">Posted {fmtDate(post.metaPostedAt)}</div>}
                      </div>
                      <div>
                        <div className="text-zinc-400 mb-1 font-medium">Cloud Campaign</div>
                        <div className="flex items-center gap-1 mb-1">{railBadge(post.ccStatus)}</div>
                        {post.ccResult?.postId && <div className="text-zinc-400">ID: {post.ccResult.postId}</div>}
                        {post.ccResult?.error && <div className="text-red-400">{post.ccResult.error}</div>}
                        {post.ccPostedAt && <div className="text-zinc-500 mt-1">Posted {fmtDate(post.ccPostedAt)}</div>}
                      </div>
                    </div>
                    {post.notes && <div className="text-xs text-zinc-400 bg-zinc-800/50 rounded px-3 py-2">{post.notes}</div>}
                    <div className="flex gap-2 justify-end pt-1">
                      {post.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(post)} className="text-zinc-400 hover:text-white gap-1 h-7 text-xs">
                            <Edit2 size={12} /> Reschedule
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(post.id)} className="text-yellow-400 hover:text-yellow-300 gap-1 h-7 text-xs">
                            <XCircle size={12} /> Cancel
                          </Button>
                        </>
                      )}
                      {post.status === "failed" && (
                        <Button size="sm" variant="ghost" onClick={() => handleRetry(post.id)} className="text-blue-400 hover:text-blue-300 gap-1 h-7 text-xs">
                          <RefreshCw size={12} /> Retry now
                        </Button>
                      )}
                      {(post.status === "cancelled" || post.status === "failed" || post.status === "published") && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(post.id)} className="text-red-400 hover:text-red-300 gap-1 h-7 text-xs">
                          <Trash2 size={12} /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
