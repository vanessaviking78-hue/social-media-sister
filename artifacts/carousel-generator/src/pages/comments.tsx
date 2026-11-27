import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/comments : every Instagram comment waiting for you, from every connected account, in one list.
// Reply, mark done, or open the comment on Instagram to like it (Instagram does not let tools like comments).

const PINK = "#ff2d95";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Comment = { id: number; presetId: number; clientName: string; threadId: string; permalink: string | null; caption: string | null; author: string; body: string; isRead: boolean; replied: boolean; at: string };

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function CommentsPage() {
  const [items, setItems] = useState<Comment[]>([]);
  const [filter, setFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/inbox/comments${showDone ? "?done=1" : ""}`, { headers: authHeaders() });
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      setItems(d.items || []);
    } catch {
      setMsg("I could not load the comments. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [showDone]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setMsg("");
    try {
      await fetch(`${BASE}/api/inbox/sync`, { method: "POST", headers: authHeaders() });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const reply = async (c: Comment) => {
    const text = (drafts[c.id] || "").trim();
    if (!text) return;
    setSending(c.id);
    setMsg("");
    try {
      const r = await fetch(`${BASE}/api/inbox/${c.id}/reply`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Instagram would not take that reply");
      setDrafts((p) => ({ ...p, [c.id]: "" }));
      await load();
    } catch (e) {
      setMsg(`Reply not sent: ${e instanceof Error ? e.message : "something went wrong"}`);
    } finally {
      setSending(0);
    }
  };

  const done = async (c: Comment) => {
    await fetch(`${BASE}/api/inbox/${c.id}/done`, { method: "POST", headers: authHeaders() });
    await load();
  };

  const accounts = [...new Set(items.map((i) => i.clientName))].sort();
  const shown = items.filter((i) => filter === "all" || i.clientName === filter);

  return (
    <div className="cm">
      <style>{`
        .cm, .cm * { box-sizing: border-box; font-family: 'League Spartan', 'Helvetica Neue', Arial, sans-serif; }
        .cm { min-height: 100vh; background: #fff; color: #000; padding: 28px 5vw 60px; }
        .cm a { color: #000; }
        .cm .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .cm h1 { margin: 0; font-weight: 900; font-size: clamp(34px, 6vw, 64px); text-transform: uppercase; letter-spacing: -0.02em; line-height: 0.9; }
        .cm h1 span { color: ${PINK}; }
        .cm .btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .cm button, .cm .btn { border: 2px solid #000; background: #fff; color: #000; font-weight: 800; font-size: 14px; padding: 9px 14px; cursor: pointer; text-decoration: none; display: inline-block; }
        .cm button:hover, .cm .btn:hover { background: #000; color: #fff; }
        .cm .pink { background: ${PINK}; border-color: ${PINK}; color: #fff; }
        .cm .pink:hover { background: #000; border-color: #000; }
        .cm .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .cm .chip.on { background: #000; color: #fff; }
        .cm .note { border-left: 6px solid ${PINK}; background: #fff0f7; padding: 10px 14px; margin: 0 0 16px; font-size: 15px; font-weight: 600; }
        .cm .card { border: 2px solid #000; margin-bottom: 14px; }
        .cm .card.new { border-color: ${PINK}; box-shadow: 4px 4px 0 ${PINK}; }
        .cm .head { background: #f4f4f4; padding: 8px 14px; font-size: 13px; font-weight: 700; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .cm .body { padding: 12px 14px; font-size: 17px; line-height: 1.3; font-weight: 500; }
        .cm .body b { font-weight: 900; }
        .cm .body small { color: #666; font-weight: 600; margin-left: 6px; }
        .cm .acts { display: flex; gap: 8px; padding: 10px 14px; border-top: 2px solid #000; flex-wrap: wrap; align-items: flex-start; }
        .cm textarea { flex: 1; min-width: 200px; border: 2px solid #000; padding: 8px 10px; font-size: 15px; min-height: 46px; resize: vertical; font-family: inherit; }
        .cm .empty { padding: 30px 14px; color: #555; font-weight: 600; }
      `}</style>

      <div className="top">
        <h1>Comments <span>{shown.filter((i) => !i.isRead).length > 0 ? `(${shown.filter((i) => !i.isRead).length})` : ""}</span></h1>
        <div className="btns">
          <button className="pink" onClick={syncNow} disabled={syncing}>{syncing ? "Checking Instagram..." : "Check for new comments"}</button>
          <button onClick={() => setShowDone(!showDone)}>{showDone ? "Hide done" : "Show done"}</button>
          <Link href="/inbox" className="btn">Client inbox</Link>
          <Link href="/hub" className="btn">Hub</Link>
        </div>
      </div>

      {msg && <p className="note">{msg}</p>}

      {accounts.length > 1 && (
        <div className="chips">
          <button className={`chip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All</button>
          {accounts.map((a) => (
            <button key={a} className={`chip${filter === a ? " on" : ""}`} onClick={() => setFilter(a)}>{a}</button>
          ))}
        </div>
      )}

      {loading && <div className="empty">Loading...</div>}
      {!loading && shown.length === 0 && <div className="empty">All caught up. New comments appear here within five minutes of arriving.</div>}

      {shown.map((c) => (
        <div key={c.id} className={`card${!c.isRead ? " new" : ""}`}>
          <div className="head">
            <span>{c.clientName} on: {c.caption ? c.caption.slice(0, 70) : "(no caption)"}</span>
            {c.permalink && <a href={c.permalink} target="_blank" rel="noopener noreferrer">Open on Instagram to like</a>}
          </div>
          <div className="body">
            <b>{c.author || "Someone"}</b>
            <small>{ago(c.at)}{c.replied ? " (replied)" : ""}</small>
            <div>{c.body}</div>
          </div>
          <div className="acts">
            <textarea placeholder={`Reply to ${c.author || "them"}`} value={drafts[c.id] || ""} onChange={(e) => setDrafts((p) => ({ ...p, [c.id]: e.target.value }))} />
            <button className="pink" disabled={sending === c.id || !(drafts[c.id] || "").trim()} onClick={() => reply(c)}>{sending === c.id ? "Sending..." : "Reply"}</button>
            {!c.isRead && <button onClick={() => done(c)}>Mark done</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
