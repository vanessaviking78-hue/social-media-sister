import { useEffect, useState, useCallback } from "react";
import { Archive, CalendarClock, Send, Trash2, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { SendForApprovalModal } from "@/components/send-for-approval-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type BankContent = {
  imageUrls?: string[];
  videoUrl?: string;
  caption?: string;
  title?: string;
  platforms?: string[];
  sourceTool?: string;
  musicTrack?: SchedulePostPayload["musicTrack"];
  firstComment?: string;
};

type BankPost = {
  id: number;
  presetId: number;
  clientName: string;
  postType: string;
  content: BankContent;
  createdAt: string;
};

export default function ClientBank() {
  const { presets } = usePresets();
  const [posts, setPosts] = useState<BankPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<number | "all">("all");
  const [scheduleTarget, setScheduleTarget] = useState<BankPost | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<BankPost | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/api/scheduler/posts?status=draft`)
      .then((r) => r.json())
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => toast.error("Could not load the Client Bank"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function discard(post: BankPost) {
    if (!confirm(`Remove "${post.content.title || post.content.caption?.slice(0, 40) || "this item"}" from the Bank? This can't be undone.`)) return;
    setBusyId(post.id);
    try {
      const r = await fetch(`${BASE}/api/scheduler/posts/${post.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Removed from the Bank");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    } finally {
      setBusyId(null);
    }
  }

  async function afterScheduled(post: BankPost) {
    try {
      await fetch(`${BASE}/api/scheduler/posts/${post.id}`, { method: "DELETE" });
    } catch {
      // The new scheduled post was created either way — the draft copy failing
      // to clean up just means it sits in the Bank a little longer than ideal.
    }
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }

  const filtered = posts.filter((p) => clientFilter === "all" || p.presetId === clientFilter);
  const schedulePosts: SchedulePostPayload[] = scheduleTarget
    ? [{
        title: scheduleTarget.content.title || "",
        caption: scheduleTarget.content.caption || "",
        imageUrls: scheduleTarget.content.imageUrls,
        videoUrl: scheduleTarget.content.videoUrl,
        musicTrack: scheduleTarget.content.musicTrack || null,
        firstComment: scheduleTarget.content.firstComment,
        platforms: scheduleTarget.content.platforms,
        sourceTool: scheduleTarget.content.sourceTool,
      }]
    : [];

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <div className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-pink-400" />
          <h1 className="text-2xl font-bold">Client Bank</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Everything you've parked without a date. Clients never see these until you schedule them or send them for approval.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={clientFilter === "all" ? "all" : String(clientFilter)}
            onChange={(e) => setClientFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="bg-white/5 border border-border/50 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All clients</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={load} className="px-3 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} item{filtered.length !== 1 ? "s" : ""} in the Bank</span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">Nothing parked yet</p>
            <p className="text-sm">Use "Add to Client Bank" from Bulk Carousel Creator, Seamless Carousels or Single Image to park content here without a date.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((post) => {
            const c = post.content || {};
            const thumb = c.imageUrls?.[0];
            return (
              <div key={post.id} className="flex items-center gap-4 rounded-xl border border-border/40 p-3">
                {thumb ? (
                  <img src={thumb} alt="" className="w-14 h-14 rounded-lg object-cover bg-black/30 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{post.clientName || "No client"}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">
                    {c.title || c.caption || "No caption yet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {post.postType}{c.imageUrls ? ` · ${c.imageUrls.length} slide${c.imageUrls.length !== 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setScheduleTarget(post)}
                    className="px-3 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-pink-400"
                  >
                    <CalendarClock className="w-3.5 h-3.5" /> Schedule
                  </button>
                  {(c.imageUrls?.length ?? 0) > 0 && (
                    <button
                      onClick={() => setApprovalTarget(post)}
                      className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-green-500/60 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Send for approval
                    </button>
                  )}
                  <button
                    onClick={() => discard(post)}
                    disabled={busyId === post.id}
                    className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-red-500/60 text-xs font-semibold text-red-300 flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {scheduleTarget && (
        <ScheduleModal
          presetId={scheduleTarget.presetId}
          presetName={scheduleTarget.clientName}
          postType={scheduleTarget.postType}
          posts={schedulePosts}
          presets={presets}
          sourceTool={scheduleTarget.content.sourceTool || "Client Bank"}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => { const t = scheduleTarget; setScheduleTarget(null); if (t) afterScheduled(t); }}
        />
      )}

      {approvalTarget && (
        <SendForApprovalModal
          defaultClientName={approvalTarget.clientName}
          defaultBundleName={approvalTarget.content.title || approvalTarget.clientName}
          onGetImageGroups={async () => [{
            imageUrls: approvalTarget.content.imageUrls || [],
            caption: approvalTarget.content.caption || "",
          }]}
          onClose={() => setApprovalTarget(null)}
        />
      )}
    </div>
  );
}
