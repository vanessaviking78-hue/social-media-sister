import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, ClipboardCheck, Copy, Download, ExternalLink, Loader2, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";

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
  if (s >= 80) return "text-primary";
  if (s >= 60) return "text-fuchsia-300";
  return "text-white";
}

function barColour(ratio: number) {
  if (ratio >= 0.8) return "bg-primary";
  if (ratio >= 0.55) return "bg-fuchsia-400/80";
  return "bg-white/45";
}

function clientDisplayScore(score: number) {
  return Math.min(96, Math.round(score + (100 - score) * 0.5));
}

function displayScoreFor(row: { score: number; tag: string }) {
  return row.tag === "client" ? clientDisplayScore(row.score) : row.score;
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
  const exportRef = useRef<HTMLDivElement>(null);

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

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load a required library, check your connection and try again."));
      document.head.appendChild(s);
    });
  }

  async function saveAsDoc() {
    if (!current?.sales_html || !exportRef.current) return;
    const tid = toast.loading("Putting your document together…");
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.7/dist/html2canvas-pro.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
      const h2c = (window as any).html2canvas;
      const html2canvas = h2c?.default ?? h2c;
      const jsPDFLib = (window as any).jspdf?.jsPDF;
      if (typeof html2canvas !== "function" || !jsPDFLib) throw new Error("Couldn't load the save tools, try again in a moment.");
      const bg = "#000000";
      const scale = 2;
      const canvas = await html2canvas(exportRef.current, { backgroundColor: bg, scale, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const w = canvas.width / scale;
      const h = canvas.height / scale;
      const pdf = new jsPDFLib({ unit: "px", format: [w, h] });
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`${current.handle}-audit.pdf`);
      toast.success("Saved to your downloads.", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save that, try again.", { id: tid });
    }
  }

  // Previous audit of the same handle, for the trend badge
  const previousScore = useMemo(() => {
    if (!current) return null;
    const older = history
      .filter((h) => h.handle === current.handle && new Date(h.created_at) < new Date(current.created_at))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
    return older ? displayScoreFor(older) : null;
  }, [current, history]);

  const headlineScore = current ? displayScoreFor(current) : 0;

  const filteredHistory = history.filter((h) => tagFilter === "all" || h.tag === tagFilter);

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white overflow-x-hidden">
      <header className="border-b border-white/15 px-4 sm:px-6 py-4 sm:py-5 flex items-start gap-3">
        <Link href="/hub" className="p-2.5 rounded-full hover:bg-white/10 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-primary" /> Page Audit</h1>
          <p className="text-sm text-white/60 mt-1">Private to you. Type in an Instagram handle, get a scored mini audit, a compliance check and a ready-to-send write-up. Every audit is saved so you can see what's working and what isn't.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Run form */}
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Instagram handle</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !running && run()}
                placeholder="@clinicname or the profile link"
                className="w-full mt-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Owner's first name (optional)</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Makes the write-up personal"
                className="w-full mt-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Write-up style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full mt-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm">
                {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/60">Save as</label>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full mt-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm capitalize">
                {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={run}
            disabled={running}
            className="w-full sm:w-auto justify-center px-5 py-3 sm:py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:bg-primary/85 flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {running ? "Auditing…" : "Run the audit"}
          </button>
          <p className="text-xs text-white/60">Works on public Business and Creator accounts. It reads the latest 50 posts, so a personal account won't come back.</p>
        </section>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 border-b border-white/15 overflow-x-auto">
          {([["audit", "Audit"], ["history", `History (${history.length})`], ["insights", "What's working"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 ${tab === k ? "border-primary text-primary" : "border-transparent text-white/60 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* AUDIT TAB */}
        {tab === "audit" && !current && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-8 text-center">
            <p className="text-white/60 text-sm">Run your first audit above, or open one from History.</p>
          </div>
        )}

        {tab === "audit" && current && (
          <div className="space-y-6 sm:space-y-8">
            <div ref={exportRef} className="space-y-6 sm:space-y-8 bg-black -mx-3 px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4">
            {/* Score */}
            <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 sm:p-6 flex flex-col sm:flex-row sm:flex-wrap items-center gap-4 sm:gap-6 text-center sm:text-left">
              <div className="text-center">
                <div className={`text-6xl font-bold ${scoreColour(headlineScore)}`}>{headlineScore}</div>
                <div className="text-xs text-white/60">out of 100</div>
              </div>
              <div className="flex-1 min-w-0 sm:min-w-[200px] w-full sm:w-auto">
                <p className="text-lg font-semibold break-words">{current.display_name || `@${current.handle}`}</p>
                <a href={`https://instagram.com/${current.handle}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  @{current.handle} <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-sm text-white/60 mt-1">
                  {current.followers.toLocaleString("en-GB")} followers · {scoreLabel(headlineScore)} · audited {fmtDate(current.created_at)}
                </p>
                {previousScore !== null && (
                  <p className={`text-sm mt-1 inline-flex items-center gap-1 ${headlineScore >= previousScore ? "text-primary" : "text-white/70"}`}>
                    {headlineScore >= previousScore ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {headlineScore - previousScore >= 0 ? "+" : ""}{headlineScore - previousScore} since the last audit ({previousScore})
                  </p>
                )}
              </div>
              <div data-html2canvas-ignore="true" className="w-full sm:w-auto">
                <label className="text-xs text-white/60 block">Status</label>
                <select value={current.tag} onChange={(e) => patch({ tag: e.target.value })} className="w-full sm:w-auto mt-1 px-3 py-2.5 sm:py-1.5 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm capitalize">
                  {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </section>

            {/* Sales write-up */}
            <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xs uppercase tracking-wide text-primary font-semibold">Ready to send</h2>
                <div data-html2canvas-ignore="true" className="flex flex-wrap items-center gap-2">
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full sm:w-auto px-3 py-2.5 sm:py-1.5 rounded-lg bg-white/5 border border-white/15 text-base sm:text-xs">
                    {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={rewrite} disabled={rewriting} className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full justify-center flex-1 sm:flex-none border border-primary/50 text-primary text-xs font-medium hover:bg-primary/10 flex items-center gap-1.5 disabled:opacity-40">
                    {rewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Write it again
                  </button>
                  {current.sales_html && (
                    <button onClick={saveAsDoc} className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full justify-center flex-1 sm:flex-none border border-primary/50 text-primary text-xs font-medium hover:bg-primary/10 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Save
                    </button>
                  )}
                  {current.sales_html && (
                    <button onClick={copySales} className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full justify-center flex-1 sm:flex-none bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/85 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  )}
                </div>
              </div>
              {current.sales_html ? (
                <div
                  ref={salesRef}
                  className="prose prose-invert max-w-none break-words prose-headings:text-white prose-a:text-primary prose-strong:text-white prose-p:text-white/90 prose-li:text-white/90 prose-h2:text-base prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-1"
                  dangerouslySetInnerHTML={{ __html: current.sales_html }}
                />
              ) : (
                <p className="text-sm text-white/60">No write-up yet. Pick a style and hit "Write it again".</p>
              )}
            </section>
            </div>

            {/* Breakdown */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-white/60 font-semibold">Score breakdown</h2>
              <div className="space-y-2">
                {current.breakdown.map((b) => (
                  <div key={b.key} className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{b.label}</span>
                      <span className="whitespace-nowrap">{b.score} / {b.max}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/15 mt-2 overflow-hidden">
                      <div className={`h-full ${barColour(b.score / b.max)}`} style={{ width: `${Math.round((b.score / b.max) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-white/60 mt-2">{b.note}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Compliance */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-white/60 font-semibold">Compliance flags (private, captions only)</h2>
              {current.flags.length === 0 ? (
                <div className="rounded-xl border border-white/20 bg-white/[0.04] p-4 text-sm text-white">Nothing obvious in the captions. Worth a look at the images and video text too, this can't see those.</div>
              ) : (
                <div className="space-y-2">
                  {current.flags.map((f, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${f.severity === "high" ? "border-primary/60 bg-primary/10" : "border-white/20 bg-white/[0.04]"}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">{f.category}</span>
                        <span className={`text-xs uppercase font-semibold ${f.severity === "high" ? "text-primary" : "text-white/70"}`}>{f.severity}</span>
                      </div>
                      <p className="text-xs text-white/60 mt-1 break-words">Matched: <span className="text-white">"{f.matched}"</span></p>
                      <p className="text-xs text-white/60 mt-1 italic break-words">{f.snippet}{f.snippet.length >= 140 ? "…" : ""}</p>
                      {f.permalink && <a href={f.permalink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">View post <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-white/60">An indicator to help you spot things, not a legal ruling. Always check against the current CAP Code and ASA guidance.</p>
            </section>

            {/* What's working */}
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-white/60 font-semibold">What's working and what isn't on this page</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold mb-2">By format</p>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/60 text-left"><th className="pb-1 font-medium">Format</th><th className="pb-1 font-medium">Posts</th><th className="pb-1 font-medium">Avg likes + comments</th></tr></thead>
                    <tbody>
                      {current.metrics.formatStats.map((f) => (
                        <tr key={f.format} className="border-t border-white/10"><td className="py-1 capitalize">{f.format}</td><td>{f.count}</td><td>{f.avgEngagement}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {current.metrics.bestDays.length > 0 && (
                    <p className="text-xs text-white/60 mt-3">Best days: {current.metrics.bestDays.map((d) => `${d.day} (${d.avgEngagement} avg)`).join(", ")}</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-xs space-y-1 text-white/60">
                  <p className="text-sm font-semibold text-white mb-2">The numbers</p>
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
              <h2 className="text-xs uppercase tracking-wide text-white/60 font-semibold">Your notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (current.notes || "") && patch({ notes })}
                rows={3}
                placeholder="Call notes, who you sent it to, what they said…"
                className="w-full px-3 py-2.5 sm:py-2 rounded-lg bg-white/5 border border-white/15 text-base sm:text-sm"
              />
            </section>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <section className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["all", ...TAGS].map((t) => (
                <button key={t} onClick={() => setTagFilter(t)} className={`px-3.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-xs capitalize border ${tagFilter === t ? "border-primary text-primary" : "border-white/15 text-white/60"}`}>{t}</button>
              ))}
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredHistory.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-8 text-center"><p className="text-white/60 text-sm">Nothing here yet.</p></div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((h) => (
                  <div key={h.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-3 sm:p-4 flex items-center justify-between gap-3">
                    <button onClick={() => open(h.id)} className="text-left flex-1 min-w-0 flex items-center gap-3 sm:gap-4">
                      <span className={`text-2xl font-bold w-10 sm:w-12 shrink-0 ${scoreColour(displayScoreFor(h))}`}>{displayScoreFor(h)}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-sm truncate">{h.display_name || `@${h.handle}`}</span>
                        <span className="block text-xs text-white/60">@{h.handle} · {h.followers.toLocaleString("en-GB")} followers · {fmtDate(h.created_at)}<span className="sm:hidden capitalize"> · {h.tag}</span></span>
                      </span>
                    </button>
                    <span className="hidden sm:inline-block shrink-0 text-xs capitalize px-2 py-0.5 rounded-full border border-white/15 text-white/60">{h.tag}</span>
                    <button onClick={() => remove(h.id)} className="p-2.5 shrink-0 rounded-full hover:bg-primary/10 text-white/60 hover:text-primary">
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
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-8 text-center"><p className="text-white/60 text-sm">Run a few audits and the patterns show up here.</p></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Accounts audited" value={String(insights.accounts)} />
                  <Stat label="Average score" value={`${insights.avgScore}`} />
                  <Stat label="Avg engagement" value={`${insights.avgEngagementRate}%`} />
                  <Stat label="Posts a week" value={`${insights.avgPostsPerWeek}`} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                    <p className="text-sm font-semibold mb-2">Where accounts are weakest</p>
                    {insights.weakestAreas?.map((a) => <p key={a.key} className="text-sm text-white/60 flex justify-between gap-3"><span>{a.label}</span><span>{a.avgPercent}%</span></p>)}
                    <p className="text-xs text-white/60 mt-3">These are your best selling points. This is where prospects are losing out.</p>
                  </div>
                  <div className="rounded-xl border border-white/20 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold mb-2">Where accounts are strongest</p>
                    {insights.strongestAreas?.map((a) => <p key={a.key} className="text-sm text-white/60 flex justify-between gap-3"><span>{a.label}</span><span>{a.avgPercent}%</span></p>)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold mb-2">Which formats earn the most engagement, across every audited account</p>
                  {insights.formats?.map((f) => (
                    <p key={f.format} className="text-sm text-white/60 flex justify-between gap-3 capitalize"><span>{f.format} <span className="text-xs">({f.accounts} accounts)</span></span><span>{f.avgEngagementRate}% avg engagement rate</span></p>
                  ))}
                </div>
                <p className="text-xs text-white/60">Uses the latest audit for each handle so repeat audits don't skew it.</p>
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
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/60 mt-1">{label}</p>
    </div>
  );
}

function PostList({ title, posts }: { title: string; posts: PostBit[] }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      {posts.length === 0 ? (
        <p className="text-xs text-white/60">Not enough posts to say.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p, i) => (
            <div key={i} className="text-xs text-white/60">
              <p className="text-white break-words">{p.caption || "(no caption)"}{p.caption.length >= 120 ? "…" : ""}</p>
              <p className="mt-0.5 capitalize">{p.format} · {p.likes ?? "?"} likes · {p.comments} comments {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">view</a>}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
