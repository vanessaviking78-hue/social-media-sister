import { useEffect, useState, useCallback } from "react";
import { Archive, CalendarClock, CalendarCheck, Send, Trash2, Loader2, RefreshCcw, Copy, Check } from "lucide-react";
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

// Monday, Wednesday, Friday and Sunday are the posting days. The first date she gives is moved forward to the next one of those if it is not already.
const POST_DAYS = [0, 1, 3, 5];
const sameDayAt = (d: Date, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const x = new Date(d); x.setHours(h || 9, m || 0, 0, 0); return x; };
function postingDates(first: string, count: number, hhmm: string, days: number[] = POST_DAYS): Date[] {
  const [y, m, d] = first.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const out: Date[] = [];
  while (out.length < count) {
    if (days.includes(cur.getDay())) out.push(sameDayAt(cur, hhmm));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function ClientBank() {
  const { presets } = usePresets();
  const [posts, setPosts] = useState<BankPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<number | "all">("all");
  const [scheduleTarget, setScheduleTarget] = useState<BankPost | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<BankPost | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [firstDate, setFirstDate] = useState("");
  const [postTime, setPostTime] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

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

  function safeClientSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const selectedPreset = clientFilter !== "all" ? presets.find((p) => p.id === clientFilter) : null;
  const bankLink = selectedPreset
    ? `${window.location.origin}${BASE}/bank/${safeClientSlug(selectedPreset.name)}`
    : "";

  // Everything waiting for this client goes out oldest first, on Monday, Wednesday, Friday and Sunday from the date she gives.
  const allQueue = selectedPreset ? [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];
  const chosen = allQueue.filter((p) => picked.has(p.id));
  const queue = chosen.length ? chosen : allQueue; // nothing ticked means every waiting post for this client
  const timeFor = postTime || selectedPreset?.defaultPostTime || "09:00";
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
  const startFrom = firstDate || tomorrowStr;
  const togglePick = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function scheduleOn(days: number[], label: string) {
    if (!selectedPreset || !queue.length) return;
    const plan = postingDates(startFrom, queue.length, timeFor, days);
    if (!confirm(`Schedule ${queue.length} post${queue.length !== 1 ? "s" : ""} for ${selectedPreset.name} on ${label}, from ${fmtDay(plan[0])} to ${fmtDay(plan[plan.length - 1])}?`)) return;
    setBulkBusy(true);
    let done = 0;
    for (const [n, post] of queue.entries()) {
      try {
        const r = await fetch(`${BASE}/api/scheduler/posts/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "pending", scheduledAt: plan[n].toISOString() }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not schedule it");
        done++;
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setPicked((s) => { const x = new Set(s); x.delete(post.id); return x; });
      } catch (e) {
        toast.error(`Stopped after ${done}: ${e instanceof Error ? e.message : "something failed"}`);
        break;
      }
    }
    setBulkBusy(false);
    if (done) toast.success(`${done} scheduled, ${fmtDay(plan[0])} to ${fmtDay(plan[done - 1])}. They are in the scheduler now.`);
  }

  function copyBankLink() {
    if (!bankLink) return;
    navigator.clipboard.writeText(bankLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

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
          {selectedPreset && (
            <button
              onClick={copyBankLink}
              className="px-3 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm flex items-center gap-1.5"
              title={`Copy ${selectedPreset.name}'s Bank link`}
            >
              {linkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {linkCopied ? "Copied!" : "Copy Bank link"}
            </button>
          )}
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} item{filtered.length !== 1 ? "s" : ""} in the Bank</span>
        </div>

        {selectedPreset && allQueue.length > 0 && (
          <div className="rounded-xl border border-pink-500/40 bg-pink-500/5 p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-pink-400" /> Schedule posts for {selectedPreset.name}</p>
            <p className="text-xs text-muted-foreground">Tick the posts you want, or tick none to use all {allQueue.length}. Pick the date of the first post, then press a day button to put them on that day only, or the last button to spread them over Monday, Wednesday, Friday and Sunday. Oldest goes first and they land in the scheduler.</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs space-y-1 block"><span className="text-muted-foreground">First post date</span>
                <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} className="block bg-white/5 border border-border/50 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs space-y-1 block"><span className="text-muted-foreground">Time</span>
                <input type="time" value={timeFor} onChange={(e) => setPostTime(e.target.value)} className="block bg-white/5 border border-border/50 rounded-lg px-3 py-2 text-sm" /></label>
              <button onClick={() => setPicked(chosen.length === allQueue.length ? new Set() : new Set(allQueue.map((p) => p.id)))} className="px-3 py-2 rounded-lg border border-border/50 text-sm">{chosen.length === allQueue.length ? "Untick all" : "Tick all"}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {([["Mondays", [1]], ["Wednesdays", [3]], ["Fridays", [5]], ["Sundays", [0]]] as [string, number[]][]).map(([label, d]) => (
                <button key={label} disabled={bulkBusy} onClick={() => void scheduleOn(d, label)} className="px-4 py-2 rounded-lg bg-pink-500 text-white text-sm font-semibold hover:bg-pink-400 disabled:opacity-40">{label}</button>
              ))}
              <button disabled={bulkBusy} onClick={() => void scheduleOn(POST_DAYS, "Monday, Wednesday, Friday and Sunday")} className="px-4 py-2 rounded-lg border border-pink-500/60 text-sm font-semibold hover:bg-pink-500/10 disabled:opacity-40 flex items-center gap-1.5">
                {bulkBusy && <Loader2 className="w-4 h-4 animate-spin" />} Mon, Wed, Fri, Sun
              </button>
            </div>
            <p className="text-xs text-white/70">{queue.length} post{queue.length !== 1 ? "s" : ""} selected{chosen.length ? "" : " (all of them)"}, starting from {fmtDay(new Date(startFrom + "T00:00:00"))}{firstDate ? "" : " because no date is picked yet"}.</p>
          </div>
        )}
        {!selectedPreset && !loading && filtered.length > 0 && <p className="text-xs text-muted-foreground">Choose a client above to schedule all of their waiting posts in one go.</p>}

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
                {selectedPreset && <input type="checkbox" checked={picked.has(post.id)} onChange={() => togglePick(post.id)} className="w-4 h-4 shrink-0 accent-pink-500" aria-label="Select this post" />}
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
          allowBank={false}
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
