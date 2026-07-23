import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, Plus, BarChart3, Calendar, Film, Layers, ChevronDown, ChevronUp, Edit2, ExternalLink, ChevronLeft, ChevronRight, Image as ImageIcon, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";

type PostContent = { imageUrls?: string[]; videoUrl?: string; videoUrls?: string[]; caption: string; title: string };

type ScheduledPost = {
  id: number;
  presetId: number;
  clientName: string;
  postType: "carousel" | "reel" | string;
  content: PostContent;
  scheduledAt: string;
  status: "draft" | "pending" | "processing" | "published" | "failed" | "cancelled";
  metaStatus: "pending" | "success" | "failed" | "skipped";
  metaResult: { igPostId?: string; fbPostId?: string; error?: string } | null;
  metaPostedAt: string | null;
  isTrial: boolean;
  notes: string;
  createdAt: string;
};

type Stats = {
  totals: { total: number; metaSuccess: number; metaFail: number };
  byClient: Record<string, { total: number; metaSuccess: number; metaFail: number }>;
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
    draft: "bg-purple-900/40 text-purple-300 border-purple-700",
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

// ── Preview Feed month grid helpers ─────────────────────────────────────────
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: fmtISO(d), day: d.getDate(), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: fmtISO(new Date(year, month, d)), day: d, isCurrentMonth: true });
  }
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startDow - lastDay.getDate() + 1);
    days.push({ date: fmtISO(d), day: d.getDate(), isCurrentMonth: false });
  }
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function postThumb(post: ScheduledPost): string | null {
  if (post.content?.imageUrls?.length) return post.content.imageUrls[0];
  return null;
}

// A single draggable/droppable card in the Preview Feed grid and the Client
// Grid. onDelete is optional so other, non-interactive uses of this card
// (there are none right now, but might be later) don't have to wire one up.
function FeedCard({ post, draggable, onDragStart, onDelete }: { post: ScheduledPost; draggable: boolean; onDragStart: (e: React.DragEvent) => void; onDelete?: () => void }) {
  const thumb = postThumb(post);
  const isVideo = post.postType === "reel" || post.postType === "video_carousel";
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      title={`${post.clientName} — ${post.content.title || "Untitled"}${draggable ? "" : " (already posted or in progress)"}`}
      className={`group relative rounded-md overflow-hidden border border-zinc-700/60 aspect-square ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-80"}`}
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
          {isVideo ? <Film size={14} className="text-zinc-500" /> : <ImageIcon size={14} className="text-zinc-500" />}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 py-0.5">
        <p className="text-[9px] text-white/90 truncate leading-tight">{post.clientName}</p>
      </div>
      {post.status === "published" && (
        <span className="absolute top-0.5 right-0.5 bg-emerald-500/90 rounded-full p-0.5 group-hover:opacity-0 transition-opacity">
          <CheckCircle2 size={9} className="text-white" />
        </span>
      )}
      {post.status === "failed" && (
        <span className="absolute top-0.5 right-0.5 bg-red-500/90 rounded-full p-0.5 group-hover:opacity-0 transition-opacity">
          <XCircle size={9} className="text-white" />
        </span>
      )}
      {draggable && (
        <span className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={11} className="text-white/70" />
        </span>
      )}
      {onDelete && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.confirm(`Delete "${post.content.title || "this post"}"? This can't be undone.`)) onDelete();
          }}
          title="Delete this post"
          className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Trash2 size={9} className="text-white" />
        </button>
      )}
    </div>
  );
}

type ScheduleDialogProps = {
  presets: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  editing?: ScheduledPost | null;
};

function ScheduleDialog({ presets, onClose, onSaved, editing }: ScheduleDialogProps) {
  const [presetId, setPresetId] = useState<string>(editing ? String(editing.presetId) : "");
  const [postType, setPostType] = useState<"carousel" | "reel">(editing?.postType === "reel" ? "reel" : "carousel");
  const [title, setTitle] = useState(editing?.content.title ?? "");
  const [caption, setCaption] = useState(editing?.content.caption ?? "");
  const [imageUrls, setImageUrls] = useState(editing?.content.imageUrls?.join("\n") ?? "");
  const [videoUrl, setVideoUrl] = useState(editing?.content.videoUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState(() => {
    // A draft's scheduledAt is just a placeholder (set to "now" when it was
    // parked in the waiting room), not a real date, ignore it here and fall
    // through to the normal tomorrow-evening default instead.
    if (editing?.scheduledAt && editing.status !== "draft") {
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

  function buildContent(): PostContent {
    return {
      caption: caption.trim(),
      title: title.trim() || "Untitled",
      ...(postType === "reel" ? { videoUrl: videoUrl.trim() } : {
        imageUrls: imageUrls.split("\n").map((u) => u.trim()).filter(Boolean),
      }),
    };
  }

  function validate(): boolean {
    if (!presetId) { toast.error("Select a client"); return false; }
    if (!caption.trim()) { toast.error("Caption is required"); return false; }
    if (postType === "reel" && !videoUrl.trim()) { toast.error("Video URL is required for reels"); return false; }
    if (postType === "carousel" && !imageUrls.trim()) { toast.error("At least one image URL is required for carousels"); return false; }
    return true;
  }

  // Releasing a draft: editing.status === "draft" means this dialog opened
  // from the Waiting Room. Saving here picks a real date and flips the post
  // to "pending" so it enters the normal posting queue.
  const releasingDraft = editing?.status === "draft";

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    try {
      const content = buildContent();

      if (editing) {
        await apiFetch(`/api/scheduler/posts/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            content,
            scheduledAt: new Date(scheduledAt).toISOString(),
            notes,
            ...(releasingDraft ? { status: "pending" } : {}),
          }),
        });
        toast.success(releasingDraft ? "Scheduled" : "Post updated");
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

  // Save to the waiting room: no date is committed yet, so this skips
  // straight past the scheduled-date field and stores the idea against the
  // client for later. Only available when creating fresh (not while editing
  // or releasing an existing post).
  async function handleSaveDraft() {
    if (!validate()) return;

    setSaving(true);
    try {
      const content = buildContent();
      await apiFetch("/api/scheduler/posts", {
        method: "POST",
        body: JSON.stringify({ presetId: Number(presetId), postType, content, status: "draft", isTrial, notes }),
      });
      toast.success("Saved to waiting room");
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
          <h2 className="text-lg font-semibold text-white">{editing ? (releasingDraft ? "Schedule from Waiting Room" : "Edit Scheduled Post") : "Schedule a Post"}</h2>
          <p className="text-sm text-zinc-400 mt-1">Schedule posts to go live via Meta.</p>
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
          {!editing && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving}
              className="border-purple-700 text-purple-300 hover:text-purple-200 hover:bg-purple-900/20"
            >
              Save to Waiting Room
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white">
            {saving ? "Saving..." : editing ? (releasingDraft ? "Schedule" : "Save Changes") : "Schedule Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Scheduler() {
  const { presets } = usePresets();
  const [tab, setTab] = useState<"upcoming" | "published" | "failed" | "dashboard" | "feed" | "grid" | "waitingroom" | "doubleposting">("upcoming");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ScheduledPost | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Preview Feed month grid state
  const today = new Date();
  const [feedYear, setFeedYear] = useState(today.getFullYear());
  const [feedMonth, setFeedMonth] = useState(today.getMonth());
  const dragPostRef = React.useRef<ScheduledPost | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

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

  // Clears out everything not yet posted for the selected client (draft,
  // pending and processing), leaving published history and the failed log
  // untouched. This is the self-serve version of what used to mean asking
  // for a batch to be pulled by hand, e.g. when captions never got uploaded
  // before a run went into the queue.
  async function handleDeleteAllUpcoming() {
    if (filterClient === "all") return;
    const count = posts.filter(
      (p) => p.clientName === filterClient && (p.status === "pending" || p.status === "processing" || p.status === "draft")
    ).length;
    if (count === 0) { toast.info(`Nothing upcoming to delete for ${filterClient}`); return; }
    if (!window.confirm(`Delete all ${count} upcoming post${count === 1 ? "" : "s"} for ${filterClient}? This can't be undone.`)) return;
    setBulkDeleting(true);
    try {
      const result = await apiFetch(`/api/scheduler/posts?clientName=${encodeURIComponent(filterClient)}`, { method: "DELETE" });
      toast.success(`Deleted ${result.deletedCount} upcoming post${result.deletedCount === 1 ? "" : "s"} for ${filterClient}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  // Waiting room drafts have no date yet. Editing one via ScheduleDialog and
  // saving flips it to "pending" with a real date, see ScheduleDialog's
  // handleSave, which checks editing?.status === "draft" to send that flag.

  async function handleRetry(id: number) {
    try {
      await apiFetch(`/api/scheduler/posts/${id}/retry`, { method: "POST" });
      toast.success("Queued for retry");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  // Reschedule a post to a new calendar date, keeping its original time of day.
  async function handleReschedule(post: ScheduledPost, newDate: string) {
    const [y, m, d] = newDate.split("-").map(Number);
    const updated = new Date(post.scheduledAt);
    updated.setFullYear(y, m - 1, d);
    if (fmtISO(updated) === fmtISO(new Date(post.scheduledAt))) return; // dropped on its own day
    setRescheduling(true);
    try {
      await apiFetch(`/api/scheduler/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: updated.toISOString() }),
      });
      toast.success(`Moved to ${updated.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not reschedule");
    } finally {
      setRescheduling(false);
    }
  }

  const handleFeedDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    dragPostRef.current = post;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(post.id));
  };
  const handleFeedDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date);
  };
  const handleFeedDragLeave = () => setDragOverDate(null);
  const handleFeedDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const post = dragPostRef.current;
    dragPostRef.current = null;
    if (!post) return;
    handleReschedule(post, date);
  };

  // Client Grid: dragging one tile onto another swaps their scheduled
  // date/time, so the two posts trade places in the grid. This is the same
  // mental model as Instagram grid planner apps — you're not renumbering
  // the whole queue, just moving a tile to where another one was.
  const gridDragPostRef = React.useRef<ScheduledPost | null>(null);
  const [gridDragOverId, setGridDragOverId] = useState<number | null>(null);
  const handleGridDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    gridDragPostRef.current = post;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(post.id));
  };
  const handleGridDragOver = (e: React.DragEvent, post: ScheduledPost) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setGridDragOverId(post.id);
  };
  const handleGridDragLeave = () => setGridDragOverId(null);
  const handleGridDrop = async (e: React.DragEvent, target: ScheduledPost) => {
    e.preventDefault();
    setGridDragOverId(null);
    const dragged = gridDragPostRef.current;
    gridDragPostRef.current = null;
    if (!dragged || dragged.id === target.id) return;
    setRescheduling(true);
    try {
      await Promise.all([
        apiFetch(`/api/scheduler/posts/${dragged.id}`, {
          method: "PATCH",
          body: JSON.stringify({ scheduledAt: target.scheduledAt }),
        }),
        apiFetch(`/api/scheduler/posts/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({ scheduledAt: dragged.scheduledAt }),
        }),
      ]);
      toast.success("Swapped");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not reorder");
    } finally {
      setRescheduling(false);
    }
  };

  const clientNames = Array.from(new Set(posts.map((p) => p.clientName))).sort();

  const filtered = posts.filter((p) => {
    if (filterClient !== "all" && p.clientName !== filterClient) return false;
    if (tab === "upcoming") return p.status === "pending" || p.status === "processing";
    if (tab === "published") return p.status === "published";
    if (tab === "failed") return p.status === "failed";
    return false;
  });

  // Waiting room: content parked against a client with no committed date yet.
  const waitingRoomPosts = posts.filter((p) => {
    if (p.status !== "draft") return false;
    if (filterClient !== "all" && p.clientName !== filterClient) return false;
    return true;
  });

  // Double Posting: any client with more than one post due on the same
  // calendar day. Easy to end up with by accident when scheduling in
  // batches, this groups pending/processing posts by client + date and
  // keeps only the groups with a clash, so they jump out immediately.
  const doublePostingGroups = (() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of posts) {
      if (p.status !== "pending" && p.status !== "processing") continue;
      if (filterClient !== "all" && p.clientName !== filterClient) continue;
      const key = `${p.clientName}|${p.scheduledAt.slice(0, 10)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .filter(([, group]) => group.length >= 2)
      .map(([key, group]) => [key, group.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))] as [string, ScheduledPost[]])
      .sort((a, b) => a[1][0].scheduledAt.localeCompare(b[1][0].scheduledAt));
  })();

  const upcoming = posts.filter((p) => p.status === "pending" || p.status === "processing").length;
  const published = posts.filter((p) => p.status === "published").length;
  const failed = posts.filter((p) => p.status === "failed").length;

  const metaPct = stats ? pct(stats.totals.metaSuccess, stats.totals.metaSuccess + stats.totals.metaFail) : "—";

  // Posts shown on the Preview Feed grid: anything not cancelled, filtered by client.
  const feedPosts = posts.filter((p) => {
    if (p.status === "cancelled" || p.status === "draft") return false;
    if (filterClient !== "all" && p.clientName !== filterClient) return false;
    return true;
  });
  const feedDays = getMonthDays(feedYear, feedMonth);
  const prevFeedMonth = () => { if (feedMonth === 0) { setFeedMonth(11); setFeedYear(feedYear - 1); } else setFeedMonth(feedMonth - 1); };
  const nextFeedMonth = () => { if (feedMonth === 11) { setFeedMonth(0); setFeedYear(feedYear + 1); } else setFeedMonth(feedMonth + 1); };
  const feedToday = () => { setFeedYear(today.getFullYear()); setFeedMonth(today.getMonth()); };
  const todayISO = fmtISO(today);

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
            <p className="text-zinc-400 text-sm mt-0.5">Schedule and post directly via Meta</p>
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
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
            {(["upcoming", "published", "failed", "feed", "waitingroom", "doubleposting", "grid", "dashboard"] as const).map((t) => (
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
                {t === "feed" && "Preview Feed"}
                {t === "waitingroom" && `Waiting Room ${posts.filter((p) => p.status === "draft").length > 0 ? `(${posts.filter((p) => p.status === "draft").length})` : ""}`}
                {t === "doubleposting" && `Double Posting ${doublePostingGroups.length > 0 ? `(${doublePostingGroups.length})` : ""}`}
                {t === "grid" && "Client Grid"}
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

          {filterClient !== "all" && tab !== "dashboard" && tab !== "feed" && tab !== "grid" && (
            <a
              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/preview/${filterClient.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-pink-400 transition-colors px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-pink-500/40 whitespace-nowrap"
              title="Open the public client-facing preview"
            >
              <ExternalLink size={12} />
              Client Preview
            </a>
          )}

          {filterClient !== "all" && (tab === "upcoming" || tab === "waitingroom") && (
            <button
              onClick={handleDeleteAllUpcoming}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg border border-red-900/60 hover:border-red-500/60 whitespace-nowrap disabled:opacity-50"
              title={`Delete every upcoming post for ${filterClient}`}
            >
              <Trash2 size={12} />
              {bulkDeleting ? "Deleting..." : `Delete all upcoming for ${filterClient}`}
            </button>
          )}

          <button onClick={load} className="ml-auto p-2 text-zinc-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {tab === "feed" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={prevFeedMonth} className="h-9 w-9 border-zinc-700 text-zinc-300 hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-base font-semibold min-w-[170px] text-center">{MONTH_NAMES[feedMonth]} {feedYear}</h2>
                <Button variant="outline" size="icon" onClick={nextFeedMonth} className="h-9 w-9 border-zinc-700 text-zinc-300 hover:text-white">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={feedToday} className="text-zinc-400 hover:text-white">Today</Button>
              </div>
              <p className="text-xs text-zinc-500">Drag a post onto another day to reschedule it. Days with nothing queued show blank.</p>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-7 bg-zinc-900">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-[11px] font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {feedDays.map((day, i) => {
                  const dayPosts = feedPosts.filter((p) => p.scheduledAt.slice(0, 10) === day.date);
                  const isToday = day.date === todayISO;
                  const isDragTarget = dragOverDate === day.date;
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => handleFeedDragOver(e, day.date)}
                      onDragLeave={handleFeedDragLeave}
                      onDrop={(e) => handleFeedDrop(e, day.date)}
                      className={`min-h-[104px] border-b border-r border-zinc-800/70 p-1.5 transition-colors ${
                        !day.isCurrentMonth ? "bg-zinc-950/60 opacity-40" : "bg-zinc-950"
                      } ${isDragTarget ? "bg-pink-500/10 ring-1 ring-pink-500/40 ring-inset" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1 px-0.5">
                        <span className={`text-[11px] font-medium ${isToday ? "bg-pink-600 text-white w-5 h-5 rounded-full flex items-center justify-center" : "text-zinc-500"}`}>
                          {day.day}
                        </span>
                        {dayPosts.length > 0 && <span className="text-[9px] text-zinc-500">{dayPosts.length}</span>}
                      </div>
                      {/* Blank when nothing is queued for this day — that's the point, so gaps are obvious at a glance. */}
                      {dayPosts.length > 0 && (
                        <div className="grid grid-cols-3 gap-1">
                          {dayPosts.slice(0, 6).map((post) => (
                            <FeedCard
                              key={post.id}
                              post={post}
                              draggable={post.status === "pending"}
                              onDragStart={(e) => handleFeedDragStart(e, post)}
                              onDelete={() => handleDelete(post.id)}
                            />
                          ))}
                        </div>
                      )}
                      {dayPosts.length > 6 && (
                        <p className="text-[9px] text-zinc-500 mt-1">+{dayPosts.length - 6} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {rescheduling && (
              <p className="text-xs text-zinc-500 flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Saving new date…</p>
            )}
          </div>
        ) : tab === "grid" ? (
          <div className="space-y-4">
            {filterClient === "all" ? (
              <div className="text-center py-16 text-zinc-500">
                <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
                <p>Pick a client above to see their grid and drag posts into place.</p>
              </div>
            ) : (() => {
              const gridPosts = posts
                .filter((p) => p.clientName === filterClient && p.status !== "cancelled" && p.status !== "failed")
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
              if (!gridPosts.length) {
                return (
                  <div className="text-center py-16 text-zinc-500">
                    <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No posts queued for {filterClient} yet.</p>
                  </div>
                );
              }
              return (
                <>
                  <p className="text-xs text-zinc-500">
                    Drag a tile onto another to swap their dates and rearrange the grid. Already-published posts are shown but can't be moved.
                  </p>
                  <div className="grid grid-cols-3 gap-1 max-w-xl border border-zinc-800 rounded-xl overflow-hidden p-1 bg-zinc-950">
                    {gridPosts.map((post) => (
                      <div
                        key={post.id}
                        onDragOver={post.status === "pending" ? (e) => handleGridDragOver(e, post) : undefined}
                        onDragLeave={handleGridDragLeave}
                        onDrop={post.status === "pending" ? (e) => handleGridDrop(e, post) : undefined}
                        className={gridDragOverId === post.id ? "ring-1 ring-pink-500/60 rounded-md" : ""}
                      >
                        <FeedCard
                          post={post}
                          draggable={post.status === "pending"}
                          onDragStart={(e) => handleGridDragStart(e, post)}
                          onDelete={() => handleDelete(post.id)}
                        />
                      </div>
                    ))}
                  </div>
                  {rescheduling && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Saving…</p>
                  )}
                </>
              );
            })()}
          </div>
        ) : tab === "dashboard" ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-1">Meta Direct — Posting Stats</h2>

              {stats && stats.totals.total > 0 ? (
                <>
                  <div className="bg-zinc-800/60 rounded-lg p-4 mb-6 max-w-xs">
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

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-400 border-b border-zinc-800">
                          <th className="pb-2 pr-4 font-medium">Client</th>
                          <th className="pb-2 pr-4 font-medium text-right">Posts</th>
                          <th className="pb-2 pr-4 font-medium text-right">Meta ✓</th>
                          <th className="pb-2 font-medium text-right">Meta %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.byClient).sort((a, b) => b[1].total - a[1].total).map(([name, s]) => (
                          <tr key={name} className="border-b border-zinc-800/50">
                            <td className="py-2 pr-4 text-white">{name}</td>
                            <td className="py-2 pr-4 text-right text-zinc-300">{s.total}</td>
                            <td className="py-2 pr-4 text-right text-emerald-400">{s.metaSuccess}</td>
                            <td className="py-2 text-right text-zinc-300">{pct(s.metaSuccess, s.metaSuccess + s.metaFail)}</td>
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
        ) : tab === "waitingroom" ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Park a piece of content here with no date attached, good for when you've built something you're not ready to commit to a slot yet.
              When you're ready, hit Schedule and give it a real date. Nothing in here will ever post on its own.
            </p>
            {!loading && waitingRoomPosts.length === 0 && (
              <div className="text-center py-16 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
                <Layers size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nothing waiting. Save a piece of content here from the Schedule dialog when you're not ready to commit to a date.</p>
              </div>
            )}
            {!loading && waitingRoomPosts.map((post) => (
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
                      {statusBadge(post.status)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 truncate">{post.content.title || "Untitled"}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{post.content.caption?.slice(0, 80)}{(post.content.caption?.length ?? 0) > 80 ? "…" : ""}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(post)} className="text-pink-400 hover:text-pink-300 gap-1 h-7 text-xs">
                      <Calendar size={12} /> Schedule
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(post.id)} className="text-red-400 hover:text-red-300 gap-1 h-7 text-xs">
                      <Trash2 size={12} /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "doubleposting" ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Flags any client with more than one post due on the same calendar day, easy to end up with two by accident when scheduling in batches. Reschedule one from here to clear it.
            </p>
            {!loading && doublePostingGroups.length === 0 && (
              <div className="text-center py-16 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
                <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No clashes. Every client has at most one post due per day.</p>
              </div>
            )}
            {!loading && doublePostingGroups.map(([key, group]) => {
              const [clientName, date] = key.split("|");
              return (
                <div key={key} className="bg-zinc-900 border border-amber-700/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-amber-900/20 border-b border-amber-800/40 flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-400" />
                      <span className="font-medium text-sm text-white">{clientName}</span>
                      <span className="text-xs text-zinc-400">{new Date(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                    </div>
                    <span className="text-xs text-amber-300">{group.length} posts due</span>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {group.map((post) => (
                      <div key={post.id} className="p-3 flex items-center gap-3">
                        <div className="shrink-0">
                          {post.postType === "reel"
                            ? <Film size={16} className="text-purple-400" />
                            : <Layers size={16} className="text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-200 truncate">{post.content.title || "Untitled"}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5"><Clock size={11} />{fmtDate(post.scheduledAt)}</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(post)} className="text-pink-400 hover:text-pink-300 gap-1 h-7 text-xs shrink-0">
                          <Edit2 size={12} /> Reschedule
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
                    <div className="text-xs">
                      <div>
                        <div className="text-zinc-400 mb-1 font-medium">Meta Direct</div>
                        <div className="flex items-center gap-1 mb-1">{railBadge(post.metaStatus)}</div>
                        {post.metaResult?.igPostId && <div className="text-zinc-400">IG: {post.metaResult.igPostId}</div>}
                        {post.metaResult?.fbPostId && <div className="text-zinc-400">FB: {post.metaResult.fbPostId}</div>}
                        {post.metaResult?.error && <div className="text-red-400">{post.metaResult.error}</div>}
                        {post.metaPostedAt && <div className="text-zinc-500 mt-1">Posted {fmtDate(post.metaPostedAt)}</div>}
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
                      {(post.status === "pending" || post.status === "processing") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete "${post.content.title || "this post"}"? This can't be undone.`)) handleDelete(post.id);
                          }}
                          className="text-red-400 hover:text-red-300 gap-1 h-7 text-xs"
                        >
                          <Trash2 size={12} /> Delete
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
