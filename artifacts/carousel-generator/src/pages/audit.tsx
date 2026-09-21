import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, ClipboardCheck, Copy, ExternalLink, Loader2, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
}

type Breakdown = { key: string; label: string; score: number; max: number; note: string };
type Flag = { severity: "high" | "medium"; category: string; matched: string; permalink: string | null; snippet: string };
type PostBit = { permalink: string | null; format: string; likes: number | null; comments: number; date: string | null; caption: string };
type Metrics = {
  postsAnalysed: number;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  engagementRate: number;
  avgEngagementPerPost: number;
  likesHidden: boolean;
  formatStats: { format: string; count: number; avgEngagement: number; engagementRate: number }[];
  bestDays: { day: string; posts: number; avgEngagement: number }[];
  topPosts: PostBit[];
  bottomPosts: PostBit[];
};
type ListItem = { id: number; handle: string; display_name: string; followers: number; score: number; tag: string; created_at: string };
type Audit = ListItem & {
  notes: string;
  style: string;
  contact_name: string;
  profile: { biography: string; website: string; following: number; mediaCount: number };
  breakdown: Breakdown[];
  metrics: Metrics;
  flags: Flag[];
  sales_html: string;
  salesFailed?: boolean;
};
type Insights = {
  accounts: number;
  avgScore?: number;
  avgEngagementRate?: number;
  avgPostsPerWeek?: number;
  weakestAreas?: { key: string; label: string; avgPercent: number }[];
  strongestAreas?: { key: string; label: string; avgPercent: number }[];
  formats?: { format: string; accounts: number; avgEngagementRate: number }[];
};

const STYLES: { value: string; label: string }[] = [
  { value: "northern", label: "Northern grit Vanessa" },
  { value: "springsteen", label: "Storyteller, whimsical" },
  { value: "dawn", label: "Funny and blunt" },
  { value: "professional", label: "Professional with personality" },
  { value: "feral", label: "Feral, savage, sarcastic" },
];

const TAGS = ["prospect", "client", "won", "lost"];

function scoreLabel(s: number) {
  if (s >= 80) return "Flying";
  if (s >= 60) return "Solid, with gaps";
  if (s >= 40) return "Room to grow";
  return "Needs a proper look";
}

function scoreColour(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  if (s >= 40) return "text-orange-400";
  return "text-red-400";
}

function barColour(ratio: number) {
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.55) return "bg-amber-500";
  return "bg-red-500";
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function AuditPage() {
  const [tab, setTab] = useState<"audit" | "history" | "insights">("audit");
  const [handle, setHandle] = useState("");
  const [contactName, setContactName] = useState("");
  const [style, setStyle] = useState("northern");
  const [tag, setTag] = useState("prospect");
  const [running, setRunning] = useState(false);

  const [current, setCurrent] = useState<Audit | null>(null);
  const [history, setHistory] = useState<ListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("all");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [notes, setNotes] = useState("");
  const salesRef = useRef<HTMLDivElement>(null);

  function loadHistory() {
    setHistoryLoading(true);
    fetch(`${BASE}/api/ig-audit`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setHistory(d.audits || []))
      .catch(() => toast.error("Could not load your audit history."))
      .finally(() => setHistoryLoading(false));
  }

  function loadInsights() {
    fetch(`${BASE}/api/ig-audit/insights`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setInsights(d))
      .catch(() => setInsights({ accounts: 0 }));
  }

  useEffect(() => {
    loadHistory();
    loadInsights();
  }, []);

  useEffect(() => {
    if (current) setNotes(current.notes || "");
  }, [current?.id]);

  async function run() {
    if (!handle.trim()) {
      toast.error("Pop a handle in first.");
      return;
    }
    setRunning(true);
    const tid = toast.loading("Having a nosy through their page…");
    try {
      const r = await fetch(`${BASE}/api/ig-audit/run`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ handle, style, contactName, tag }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Audit failed");
      setCurrent(d);
      setTab("audit");
      if (d.salesFailed) toast.warning("Audit's done but the write-up didn't come back. Hit 'Write it again'.", { id: tid });
      else toast.success("Audit's ready.", { id: tid });
      loadHistory();
      loadInsights();
    } catch (e: any) {
      toast.error(e?.message || "Audit failed", { id: tid });
    } finally {
      setRunning(false);
    }
  }

  async function open(id: number) {
    try {
      const r = await fetch(`${BASE}/api/ig-audit/${id}`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not open");
      setCurrent(d);
      setStyle(d.style || "northern");
      setTab("audit");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e?.message || "Could not open that audit");
    }
  }

  async function remove(id: number) {
    try {
      const r = await fetch(`${BASE}/api/ig-audit/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error();
      toast.success("Removed.");
      if (current?.id === id) setCurrent(null);
      loadHistory();
      loadInsights();
    } catch {
      toast.error("Could not remove that one.");
    }
  }

  async function rewrite() {
    if (!current) return;
    setRewriting(true);
    const tid = toast.loading("Writing it again…");
    try {
      const r = await fetch(`${BASE}/api/ig-audit/${current.id}/sales`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ style, contactName: current.contact_name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Rewrite failed");
      setCurrent({ ...current, sales_html: d.sales_html, style: d.style, salesFailed: false });
      toast.success("New version's in.", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Rewrite failed", { id: tid });
    } finally {
      setRewriting(false);
    }
  }

  async function patch(body: { tag?: string; notes?: string }) {
    if (!current) return;
    try {
      const r = await fetch(`${BASE}/api/ig-audit/${current.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      setCurrent({ ...current, ...body });
      if (body.tag) loadHistory();
    } catch {
      toast.error("Could not save that.");
    }
  }

  async function copySales() {
    const el = salesRef.current;
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.innerText);
      toast.success("Copied. Ready to paste into a message.");
    } catch {
      toast.error("Copy didn't work, select the text and copy it by hand.");
    }
  }

  // Previous audit of the same handle, for the trend badge
  const previousScore = useMemo(() => {
    if (!current) return null;
    const older = history
      .filter((h) => h.handle === current.handle && new Date(h.created_at) < new Date(current.created_at))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
    return older ? older.score : null;
  }, [current, history]);

  const filteredHistory = history.filter((h) => tagFilter === "all" || h.tag === tagFilter);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5 flex items-start gap-3">
        <Link href="/hub" className="p-2 rounded-full hover:bg-card/60 mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-amber-400" /> Page Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">Private to you. Type in an Instagram handle, get a scored mini audit, a compliance check and a ready-to-send write-up. Every audit is saved so you can see what's working and what isn't.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Run form */}
        <section className="rounded-2xl border border-amber-600/40 bg-amber-950/10 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Instagram handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !running && run()}
                placeholder="@clinicname or the profile link"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Owner's first name (optional)</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Makes the write-up personal"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Write-up style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm">
                {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Save as</label>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm capitalize">
                {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={run}
            disabled={running}
            className="px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {running ? "Auditing…" : "Run the audit"}
          </button>
          <p className="text-xs text-muted-foreground">Works on public Business and Creator accounts. It reads the latest 50 posts, so a personal account won't come back.</p>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/40">
          {([["audit", "Audit"], ["history", `History (${history.length})`], ["insights", "What's working"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-amber-400 text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* AUDIT TAB */}
        {tab === "audit" && !current && (
          <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center">
            <p className="text-muted-foreground text-sm">Run your first audit above, or open one from History.</p>
          </div>
        )}

        {tab === "audit" && current && (
          <div className="space-y-8">
            {/* Score */}
            <section className="rounded-2xl border border-border/40 bg-card/30 p-6 flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-bold ${scoreColour(current.score)}`}>{current.score}</div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-lg font-semibold">{current.display_name || `@${current.handle}`}</p>
                <a href={`https://instagram.com/${current.handle}`} target="_blank" rel="noreferrer" className="text-sm text-amber-400 hover:underline inline-flex items-center gap-1">
                  @{current.handle} <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-sm text-muted-foreground mt-1">
                  {current.followers.toLocaleString("en-GB")} followers · {scoreLabel(current.score)} · audited {fmtDate(current.created_at)}
                </p>
                {previousScore !== null && (
                  <p className={`text-sm mt-1 inline-flex items-center gap-1 ${current.score >= previousScore ? "text-emerald-400" : "text-red-400"}`}>
                    {current.score >= previousScore ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {current.score - previousScore >= 0 ? "+" : ""}{current.score - previousScore} since the last audit ({previousScore})
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground block">Status</label>
                <select value={current.tag} onChange={(e) => patch({ tag: e.target.value })} className="mt-1 px-3 py-1.5 rounded-lg bg-card border border-border/40 text-sm capitalize">
                  {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </section>

            {/* Sales write-up */}
            <section className="rounded-2xl border border-amber-600/40 bg-amber-950/10 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs uppercase tracking-wide text-amber-400 font-semibold">Ready to send</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="px-3 py-1.5 rounded-lg bg-card border border-border/40 text-xs">
                    {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={rewrite} disabled={rewriting} className="px-3 py-1.5 rounded-full border border-amber-500/50 text-amber-300 text-xs font-medium hover:bg-amber-500/10 flex items-center gap-1.5 disabled:opacity-40">
                    {rewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Write it again
                  </button>
                  {current.sales_html && (
                    <button onClick={copySales} className="px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  )}
                </div>
              </div>
              {current.sales_html ? (
                <div
                  ref={salesRef}
                  className="prose prose-invert max-w-none prose-h2:text-base prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-1"
                  dangerouslySetInnerHTML={{ __html: current.sales_html }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No write-up yet. Pick a style and hit "Write it again".</p>
              )}
            </section>

            {/* Breakdown */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Score breakdown</h2>
              <div className="space-y-2">
                {current.breakdown.map((b) => (
                  <div key={b.key} className="rounded-xl border border-border/40 bg-card/30 p-4">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{b.label}</span>
                      <span>{b.score} / {b.max}</span>
                    </div>
                    <div className="h-2 rounded-full bg-border/40 mt-2 overflow-hidden">
                      <div className={`h-full ${barColour(b.score / b.max)}`} style={{ width: `${Math.round((b.score / b.max) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{b.note}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Compliance */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Compliance flags (private, captions only)</h2>
              {current.flags.length === 0 ? (
                <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/10 p-4 text-sm text-emerald-300">Nothing obvious in the captions. Worth a look at the images and video text too, this can't see those.</div>
              ) : (
                <div className="space-y-2">
                  {current.flags.map((f, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${f.severity === "high" ? "border-red-600/40 bg-red-950/10" : "border-amber-600/40 bg-amber-950/10"}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">{f.category}</span>
                        <span className={`text-xs uppercase font-semibold ${f.severity === "high" ? "text-red-400" : "text-amber-400"}`}>{f.severity}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Matched: <span className="text-foreground">"{f.matched}"</span></p>
                      <p className="text-xs text-muted-foreground mt-1 italic">{f.snippet}{f.snippet.length >= 140 ? "…" : ""}</p>
                      {f.permalink && <a href={f.permalink} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 mt-1">View post <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">An indicator to help you spot things, not a legal ruling. Always check against the current CAP Code and ASA guidance.</p>
            </section>

            {/* What's working */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">What's working and what isn't on this page</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                  <p className="text-sm font-semibold mb-2">By format</p>
                  <table className="w-full text-xs">
                    <thead><tr className="text-muted-foreground text-left"><th className="pb-1 font-medium">Format</th><th className="pb-1 font-medium">Posts</th><th className="pb-1 font-medium">Avg likes + comments</th></tr></thead>
                    <tbody>
                      {current.metrics.formatStats.map((f) => (
                        <tr key={f.format} className="border-t border-border/30"><td className="py-1 capitalize">{f.format}</td><td>{f.count}</td><td>{f.avgEngagement}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {current.metrics.bestDays.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">Best days: {current.metrics.bestDays.map((d) => `${d.day} (${d.avgEngagement} avg)`).join(", ")}</p>
                  )}
                </div>
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-xs space-y-1 text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground mb-2">The numbers</p>
                  <p>{current.metrics.postsAnalysed} posts analysed</p>
                  <p>{current.metrics.postsPerWeek} posts a week (last 60 days)</p>
                  <p>{current.metrics.likesHidden ? "Likes hidden" : `${current.metrics.engagementRate}% engagement rate`}</p>
                  <p>{current.metrics.avgEngagementPerPost} average likes + comments a post</p>
                  {current.profile?.biography && <p className="pt-2 italic">Bio: {current.profile.biography}</p>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <PostList title="Top posts" posts={current.metrics.topPosts} />
                <PostList title="Weakest posts" posts={current.metrics.bottomPosts} />
              </div>
            </section>

            {/* Notes */}
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Your notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (current.notes || "") && patch({ notes })}
                rows={3}
                placeholder="Call notes, who you sent it to, what they said…"
                className="w-full px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
              />
            </section>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <section className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["all", ...TAGS].map((t) => (
                <button key={t} onClick={() => setTagFilter(t)} className={`px-3 py-1 rounded-full text-xs capitalize border ${tagFilter === t ? "border-amber-400 text-amber-400" : "border-border/40 text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
            ) : filteredHistory.length === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center"><p className="text-muted-foreground text-sm">Nothing here yet.</p></div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((h) => (
                  <div key={h.id} className="rounded-xl border border-border/40 bg-card/30 p-4 flex items-center justify-between gap-3">
                    <button onClick={() => open(h.id)} className="text-left flex-1 flex items-center gap-4">
                      <span className={`text-2xl font-bold w-12 ${scoreColour(h.score)}`}>{h.score}</span>
                      <span>
                        <span className="block font-semibold text-sm">{h.display_name || `@${h.handle}`}</span>
                        <span className="block text-xs text-muted-foreground">@{h.handle} · {h.followers.toLocaleString("en-GB")} followers · {fmtDate(h.created_at)}</span>
                      </span>
                    </button>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground">{h.tag}</span>
                    <button onClick={() => remove(h.id)} className="p-2 rounded-full hover:bg-red-950/30 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* INSIGHTS TAB */}
        {tab === "insights" && (
          <section className="space-y-4">
            {!insights || insights.accounts === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center"><p className="text-muted-foreground text-sm">Run a few audits and the patterns show up here.</p></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Accounts audited" value={String(insights.accounts)} />
                  <Stat label="Average score" value={`${insights.avgScore}`} />
                  <Stat label="Avg engagement" value={`${insights.avgEngagementRate}%`} />
                  <Stat label="Posts a week" value={`${insights.avgPostsPerWeek}`} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-red-600/30 bg-red-950/10 p-4">
                    <p className="text-sm font-semibold mb-2">Where accounts are weakest</p>
                    {insights.weakestAreas?.map((a) => <p key={a.key} className="text-sm text-muted-foreground flex justify-between"><span>{a.label}</span><span>{a.avgPercent}%</span></p>)}
                    <p className="text-xs text-muted-foreground mt-3">These are your best selling points. This is where prospects are losing out.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/10 p-4">
                    <p className="text-sm font-semibold mb-2">Where accounts are strongest</p>
                    {insights.strongestAreas?.map((a) => <p key={a.key} className="text-sm text-muted-foreground flex justify-between"><span>{a.label}</span><span>{a.avgPercent}%</span></p>)}
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/30 p-4">
                  <p className="text-sm font-semibold mb-2">Which formats earn the most engagement, across every audited account</p>
                  {insights.formats?.map((f) => (
                    <p key={f.format} className="text-sm text-muted-foreground flex justify-between capitalize"><span>{f.format} <span className="text-xs">({f.accounts} accounts)</span></span><span>{f.avgEngagementRate}% avg engagement rate</span></p>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Uses the latest audit for each handle so repeat audits don't skew it.</p>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function PostList({ title, posts }: { title: string; posts: PostBit[] }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      {posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not enough posts to say.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <p className="text-foreground">{p.caption || "(no caption)"}{p.caption.length >= 120 ? "…" : ""}</p>
              <p className="mt-0.5 capitalize">{p.format} · {p.likes ?? "?"} likes · {p.comments} comments {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline ml-1">view</a>}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
