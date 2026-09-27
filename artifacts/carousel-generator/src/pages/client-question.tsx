import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, MessageCircleQuestion, Loader2, Send, CheckCircle2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL || "/";

type Answer = { id: number; answer: string; respondentName: string; createdAt: string };
type QuestionWithAnswers = { id: number; question: string; active: boolean; createdAt: string; answers: Answer[] };
type LiveQuestion = { id: number; question: string; createdAt: string } | null;

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

export default function ClientQuestion() {
  // null = still checking, true = this browser is Vanessa's, false = a client
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<QuestionWithAnswers[]>([]);
  const [live, setLive] = useState<LiveQuestion>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}api/client-questions`, { headers: authHeaders() })
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error("not admin");
      })
      .then((d) => {
        setIsAdmin(true);
        setQuestions(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setIsAdmin(false);
        fetch(`${BASE}api/client-question`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setLive(d))
          .finally(() => setLoading(false));
      });
  }, []);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return isAdmin ? (
    <AdminView questions={questions} setQuestions={setQuestions} />
  ) : (
    <ClientView live={live} />
  );
}

function AdminView({
  questions,
  setQuestions,
}: {
  questions: QuestionWithAnswers[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionWithAnswers[]>>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}${BASE}clientquestion` : "";

  const ask = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const r = await fetch(`${BASE}api/client-questions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ question: trimmed }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save that question.");
      setQuestions((prev) => [
        { ...d, answers: [] },
        ...prev.map((q) => ({ ...q, active: false })),
      ]);
      setDraft("");
      toast.success("That's live now — send the link if you haven't already.");
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub"><button className="text-zinc-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></button></Link>
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5 text-pink-400" />
            <h1 className="text-xl font-bold">Client Question</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500">Ask something new</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="e.g. How many new patients did you have this month?"
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50 resize-none"
            />
          </div>
          <button
            onClick={ask}
            disabled={sending || !draft.trim()}
            className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-60 py-2.5 font-semibold text-sm flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Make this the live question"}
          </button>

          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-1.5">This is the one link — send it once, reuse it every time you've got a new question.</p>
            <div className="flex items-center gap-2">
              <input readOnly value={link} className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-300" />
              <button onClick={copyLink} className="shrink-0 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:border-pink-500/50 flex items-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {questions.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">Nothing asked yet — ask your first question above.</p>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-sm">{q.question}</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {q.active && <span className="ml-2 text-pink-400">● live now</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">{q.answers.length} {q.answers.length === 1 ? "reply" : "replies"}</span>
                </div>
                {q.answers.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-zinc-600">No replies yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {q.answers.map((a) => (
                      <div key={a.id} className="px-4 py-3">
                        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{a.answer}</p>
                        <p className="text-xs text-zinc-500 mt-1">{a.respondentName || "Anonymous"} · {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ClientView({ live }: { live: LiveQuestion }) {
  const [answer, setAnswer] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!live) return;
    setErr("");
    if (!answer.trim()) { setErr("Type your answer first."); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}api/client-question/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: live.id, answer, name }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Could not send, please try again.");
      }
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!live) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <MessageCircleQuestion className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">No question is live right now, check back soon.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-xl font-bold mb-2">Thank you</h1>
          <p className="text-zinc-400">Your answer has been sent. You can close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="max-w-xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Quick question</p>
          <h1 className="text-lg font-semibold leading-snug">{live.question}</h1>
        </div>

        <div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="Type your answer here…"
            autoFocus
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50 resize-none"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">Your name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="So we know who answered"
            className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50"
          />
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-60 py-3 font-semibold text-sm flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? "Sending…" : "Send my answer"}
        </button>
      </main>
    </div>
  );
}
