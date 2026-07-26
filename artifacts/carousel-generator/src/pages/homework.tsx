import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, RotateCcw, Send, MessageSquareText, Search, CheckCircle2, Circle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type QuestionSet = {
  id: number;
  weekLabel: string;
  question1: string;
  question2: string;
  question3: string;
  question4?: string;
  question5?: string;
  question6?: string;
  question7?: string;
  question8?: string;
  question9?: string;
  question10?: string;
  status: string;
  createdAt: string;
};

type Reply = {
  id: number;
  setId: number;
  clientName: string;
  answer1: string;
  answer2: string;
  answer3: string;
  answer4?: string;
  answer5?: string;
  answer6?: string;
  answer7?: string;
  answer8?: string;
  answer9?: string;
  answer10?: string;
  actioned?: boolean;
  submittedAt: string;
  set: QuestionSet | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Homework() {
  const [current, setCurrent] = useState<QuestionSet | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"set" | "replies">("replies");

  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");
  const [q6, setQ6] = useState("");
  const [q7, setQ7] = useState("");
  const [q8, setQ8] = useState("");
  const [q9, setQ9] = useState("");
  const [q10, setQ10] = useState("");
  const [extraCount, setExtraCount] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState("");

  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [curRes, repRes] = await Promise.all([
        fetch(`${BASE}/api/homework/current`),
        fetch(`${BASE}/api/homework/replies`),
      ]);
      const curData = await curRes.json();
      const repData = await repRes.json();
      setCurrent(curData.set || null);
      setReplies(Array.isArray(repData.replies) ? repData.replies : []);
    } catch {
      setCurrent(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    setPublishErr("");
    if (!q1.trim() || !q2.trim() || !q3.trim()) {
      setPublishErr("All three questions are needed before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const r = await fetch(`${BASE}/api/homework/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question1: q1, question2: q2, question3: q3,
          question4: q4, question5: q5, question6: q6, question7: q7,
          question8: q8, question9: q9, question10: q10,
          weekLabel,
        }),
      });
      if (!r.ok) throw new Error("Failed to publish");
      setQ1(""); setQ2(""); setQ3(""); setWeekLabel("");
      setQ4(""); setQ5(""); setQ6(""); setQ7(""); setQ8(""); setQ9(""); setQ10(""); setExtraCount(0);
      await load();
      setTab("replies");
    } catch {
      setPublishErr("Something went wrong, please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const toggleActioned = async (r: Reply) => {
    const next = !r.actioned;
    setReplies((prev) => prev.map((x) => (x.id === r.id ? { ...x, actioned: next } : x)));
    try {
      const res = await fetch(`${BASE}/api/homework/replies/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actioned: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setReplies((prev) => prev.map((x) => (x.id === r.id ? { ...x, actioned: !next } : x)));
    }
  };

  const filteredReplies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return replies;
    return replies.filter((r) => r.clientName.toLowerCase().includes(term));
  }, [replies, search]);

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Homework</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loading\u2026" : `${replies.length} repl${replies.length === 1 ? "y" : "ies"} so far`}
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

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setTab("replies")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "replies" ? "bg-pink-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}
          >
            Replies
          </button>
          <button
            onClick={() => setTab("set")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "set" ? "bg-pink-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}
          >
            This weeks questions
          </button>
        </div>

        {tab === "set" && (
          <div className="space-y-6">
            {current && (
              <div className="rounded-2xl border border-border/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Currently live</p>
                <p className="mb-1">1. {current.question1}</p>
                <p className="mb-1">2. {current.question2}</p>
                <p className={[current.question4, current.question5, current.question6, current.question7, current.question8, current.question9, current.question10].some(Boolean) ? "mb-1" : ""}>3. {current.question3}</p>
                {[current.question4, current.question5, current.question6, current.question7, current.question8, current.question9, current.question10]
                  .map((q, i) => (q ? <p key={i} className={i < 6 ? "mb-1" : ""}>{i + 4}. {q}</p> : null))}
              </div>
            )}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Publishing new questions closes off the current set and sends these three to every client instead.</p>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Question 1</label><textarea value={q1} onChange={(e) => setQ1(e.target.value)} rows={2} className={inputCls + " resize-none"} /></div>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Question 2</label><textarea value={q2} onChange={(e) => setQ2(e.target.value)} rows={2} className={inputCls + " resize-none"} /></div>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Question 3</label><textarea value={q3} onChange={(e) => setQ3(e.target.value)} rows={2} className={inputCls + " resize-none"} /></div>
              {[q4, q5, q6, q7, q8, q9, q10].slice(0, extraCount).map((qv, i) => {
                const setters = [setQ4, setQ5, setQ6, setQ7, setQ8, setQ9, setQ10];
                return (
                  <div key={i}>
                    <label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Question {i + 4}</label>
                    <textarea value={qv} onChange={(e) => setters[i](e.target.value)} rows={2} className={inputCls + " resize-none"} />
                  </div>
                );
              })}
              {extraCount < 7 && (
                <button onClick={() => setExtraCount((c) => Math.min(c + 1, 7))} className="text-xs text-pink-400 underline">
                  + Add another question ({3 + extraCount}/10)
                </button>
              )}
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Week label (optional)</label><input value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} placeholder="e.g. 14 July" className={inputCls} /></div>
              {publishErr && <p className="text-sm text-red-400">{publishErr}</p>}
              <button onClick={publish} disabled={publishing} className="w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2">
                {publishing ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4" /> Publish to all clients</>}
              </button>
            </div>
          </div>
        )}

        {tab === "replies" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by client name" className={inputCls + " pl-9"} />
            </div>

            {loading && replies.length === 0 && (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading replies\u2026
              </div>
            )}

            {!loading && filteredReplies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-16">No replies yet.</p>
            )}

            {filteredReplies.map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 ${r.actioned ? "border-green-800/30 bg-green-950/10" : "border-border/50"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4 text-pink-400" />
                    <span className="font-semibold text-sm">{r.clientName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{timeAgo(r.submittedAt)}</span>
                    <button onClick={() => toggleActioned(r)} className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border ${r.actioned ? "border-green-700/40 bg-green-900/20 text-green-400" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                      {r.actioned ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      {r.actioned ? "Actioned" : "Mark as done"}
                    </button>
                  </div>
                </div>
                {r.set && (
                  <div className="space-y-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">{r.set.question1}</p><p>{r.answer1 || "\u2014"}</p></div>
                    <div><p className="text-xs text-muted-foreground">{r.set.question2}</p><p>{r.answer2 || "\u2014"}</p></div>
                    <div><p className="text-xs text-muted-foreground">{r.set.question3}</p><p>{r.answer3 || "\u2014"}</p></div>
                    {([["question4","answer4"],["question5","answer5"],["question6","answer6"],["question7","answer7"],["question8","answer8"],["question9","answer9"],["question10","answer10"]] as const)
                      .map(([qk, ak]) => (r.set as any)[qk] ? (
                        <div key={qk}><p className="text-xs text-muted-foreground">{(r.set as any)[qk]}</p><p>{(r as any)[ak] || "\u2014"}</p></div>
                      ) : null)}
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
