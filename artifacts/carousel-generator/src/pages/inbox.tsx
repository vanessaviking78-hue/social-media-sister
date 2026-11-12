import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/inbox : every Instagram comment and DM for every connected client, with reply, unread counts and phone notifications.
// White background, black text, hot pink accent.

const PINK = "#ff2d95";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Sync = { at: string; comments: string; dms: string } | null;
type ClientRow = { presetId: number; clientName: string; unread: number; unreadComments: number; unreadDms: number; lastAt: string | null; sync: Sync };
type Item = { id: number; kind: "comment" | "dm"; direction: "in" | "out"; threadId: string; permalink: string | null; caption: string | null; author: string; body: string; isRead: boolean; replied: boolean; at: string };

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export default function InboxPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsSync, setItemsSync] = useState<Sync>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notif, setNotif] = useState<"unknown" | "on" | "off" | "unsupported">("unknown");

  const loadSummary = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/inbox/summary`, { headers: authHeaders() });
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      setClients(d.clients || []);
    } catch {
      setMsg("I could not load the inbox. Refresh the page and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (presetId: number) => {
    const r = await fetch(`${BASE}/api/inbox/items?presetId=${presetId}`, { headers: authHeaders() });
    if (!r.ok) return;
    const d = await r.json();
    setItems(d.items || []);
    setItemsSync(d.sync || null);
  }, []);

  useEffect(() => {
    loadSummary();
    const id = setInterval(loadSummary, 30000);
    return () => clearInterval(id);
  }, [loadSummary]);

  useEffect(() => {
    if (selected != null) loadItems(selected);
  }, [selected, loadItems]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setNotif("unsupported"); return; }
    navigator.serviceWorker.register(`${BASE}/sw.js`).then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setNotif(sub && Notification.permission === "granted" ? "on" : "off");
    }).catch(() => setNotif("off"));
  }, []);

  const enableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotif("off"); setMsg("Notifications are blocked in your browser settings for this site."); return; }
      const keyRes = await fetch(`${BASE}/api/inbox/push/public-key`, { headers: authHeaders() });
      const key = await keyRes.json().catch(() => ({}));
      if (!key.publicKey) { setMsg("Phone notifications are not set up on the server yet (the VAPID keys are missing)."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.publicKey) as unknown as BufferSource });
      const j = sub.toJSON();
      const r = await fetch(`${BASE}/api/inbox/push-subscribe`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }) });
      if (!r.ok) throw new Error("save");
      setNotif("on");
      setMsg("Done. This device will now ping you when a new comment or DM arrives.");
    } catch {
      setMsg("I could not turn notifications on. Try again, and on an iPhone add this page to your home screen first.");
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setMsg("");
    try {
      await fetch(`${BASE}/api/inbox/sync`, { method: "POST", headers: authHeaders() });
      await loadSummary();
      if (selected != null) await loadItems(selected);
    } finally {
      setSyncing(false);
    }
  };

  const markRead = async (presetId: number, threadId?: string) => {
    await fetch(`${BASE}/api/inbox/read`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ presetId, threadId }) });
    await loadSummary();
    await loadItems(presetId);
  };

  const reply = async (target: Item, key: string) => {
    const text = (drafts[key] || "").trim();
    if (!text || selected == null) return;
    setSending(key);
    setMsg("");
    try {
      const r = await fetch(`${BASE}/api/inbox/${target.id}/reply`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Instagram would not take that reply");
      setDrafts((p) => ({ ...p, [key]: "" }));
      await loadItems(selected);
      await loadSummary();
    } catch (e) {
      setMsg(`Reply not sent: ${e instanceof Error ? e.message : "something went wrong"}`);
    } finally {
      setSending("");
    }
  };

  const threads = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) map.set(it.threadId, [...(map.get(it.threadId) || []), it]);
    return [...map.entries()]
      .map(([threadId, list]) => {
        const sorted = [...list].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        const lastIn = [...sorted].reverse().find((x) => x.direction === "in") || null;
        return { threadId, list: sorted, kind: sorted[0].kind, unread: sorted.some((x) => x.direction === "in" && !x.isRead), lastAt: sorted[sorted.length - 1].at, lastIn };
      })
      .sort((a, b) => (a.unread === b.unread ? new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime() : a.unread ? -1 : 1));
  }, [items]);

  const totalUnread = clients.reduce((a, c) => a + c.unread, 0);
  const current = clients.find((c) => c.presetId === selected) || null;
  const dmProblem = clients.some((c) => c.sync && c.sync.dms);
  const connectUrl = `${BASE}/api/meta/auth/bulk-start?extended=1`;

  return (
    <div className="ib">
      <style>{`
        .ib, .ib * { box-sizing: border-box; font-family: 'League Spartan', 'Helvetica Neue', Arial, sans-serif; }
        .ib { min-height: 100vh; background: #fff; color: #000; padding: 28px 5vw 60px; }
        .ib a { color: #000; }
        .ib .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .ib h1 { margin: 0; font-weight: 900; font-size: clamp(34px, 6vw, 64px); text-transform: uppercase; letter-spacing: -0.02em; line-height: 0.9; }
        .ib h1 span { color: ${PINK}; }
        .ib .btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .ib button, .ib .btn { border: 2px solid #000; background: #fff; color: #000; font-weight: 800; font-size: 14px; padding: 9px 14px; cursor: pointer; text-decoration: none; display: inline-block; }
        .ib button:hover, .ib .btn:hover { background: #000; color: #fff; }
        .ib .pink { background: ${PINK}; border-color: ${PINK}; color: #fff; }
        .ib .pink:hover { background: #000; border-color: #000; }
        .ib .note { border-left: 6px solid ${PINK}; background: #fff0f7; padding: 10px 14px; margin: 0 0 16px; font-size: 15px; font-weight: 600; line-height: 1.3; }
        .ib .grid { display: grid; grid-template-columns: minmax(230px, 300px) 1fr; gap: 20px; align-items: start; }
        @media (max-width: 760px) { .ib .grid { grid-template-columns: 1fr; } }
        .ib .clients { border: 2px solid #000; }
        .ib .crow { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid #ddd; cursor: pointer; font-weight: 700; }
        .ib .crow:last-child { border-bottom: 0; }
        .ib .crow:hover { background: #f4f4f4; }
        .ib .crow.on { background: #000; color: #fff; }
        .ib .badge { background: ${PINK}; color: #fff; border-radius: 999px; font-size: 13px; min-width: 24px; text-align: center; padding: 2px 8px; font-weight: 900; }
        .ib .thread { border: 2px solid #000; margin-bottom: 16px; }
        .ib .thread.unread { border-color: ${PINK}; box-shadow: 4px 4px 0 ${PINK}; }
        .ib .thead { background: #f4f4f4; padding: 8px 14px; font-size: 13px; font-weight: 700; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .ib .m { padding: 9px 14px; border-top: 1px solid #eee; font-size: 16px; line-height: 1.3; font-weight: 500; }
        .ib .m.out { background: #fff0f7; }
        .ib .m b { font-weight: 900; }
        .ib .m small { color: #666; font-weight: 600; margin-left: 6px; }
        .ib .rbox { display: flex; gap: 8px; padding: 10px 14px; border-top: 2px solid #000; }
        .ib textarea { flex: 1; border: 2px solid #000; padding: 8px 10px; font-size: 15px; min-height: 46px; resize: vertical; font-family: inherit; }
        .ib .empty { padding: 30px 14px; color: #555; font-weight: 600; }
        .ib .err { color: #b00020; font-size: 13px; font-weight: 700; padding: 6px 14px; }
      `}</style>

      <div className="top">
        <h1>Client <span>inbox</span>{totalUnread > 0 ? ` (${totalUnread})` : ""}</h1>
        <div className="btns">
          <button className="pink" onClick={syncNow} disabled={syncing}>{syncing ? "Checking Instagram..." : "Check for new messages"}</button>
          {notif === "off" && <button onClick={enableNotifications}>Turn on phone notifications</button>}
          {notif === "on" && <span className="btn" style={{ cursor: "default" }}>Notifications on</span>}
          <Link href="/hub" className="btn">Hub</Link>
        </div>
      </div>

      {msg && <p className="note">{msg}</p>}
      {dmProblem && (
        <p className="note">
          Comments are coming through. Some clients are not sending DMs yet, because they were connected without the inbox permission.{" "}
          <a href={connectUrl}>Reconnect everyone with inbox and insights</a> and the DMs will start to appear.
        </p>
      )}

      <div className="grid">
        <div className="clients">
          {loading && <div className="empty">Loading...</div>}
          {!loading && clients.length === 0 && <div className="empty">No clients are connected to Instagram yet.</div>}
          {clients.map((c) => (
            <div key={c.presetId} className={`crow${selected === c.presetId ? " on" : ""}`} onClick={() => setSelected(c.presetId)}>
              <span>{c.clientName}</span>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </div>
          ))}
        </div>

        <div>
          {!current && <div className="empty">Pick a client on the left to see their comments and DMs.</div>}
          {current && (
            <>
              <div className="top" style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 22, fontWeight: 900 }}>{current.clientName}</strong>
                {current.unread > 0 && <button onClick={() => markRead(current.presetId)}>Mark all read</button>}
              </div>
              {itemsSync && (itemsSync.comments || itemsSync.dms) && (
                <p className="note">
                  {itemsSync.comments ? `Comments: ${itemsSync.comments}. ` : ""}
                  {itemsSync.dms ? `DMs: ${itemsSync.dms}.` : ""}
                </p>
              )}
              {threads.length === 0 && <div className="empty">Nothing yet. New comments and DMs will appear here within five minutes of arriving.</div>}
              {threads.map((t) => {
                const key = t.threadId;
                const first = t.list[0];
                return (
                  <div key={key} className={`thread${t.unread ? " unread" : ""}`}>
                    <div className="thead">
                      <span>
                        {t.kind === "dm" ? "Direct message" : `On the post: ${first.caption ? first.caption.slice(0, 70) : "(no caption)"}`}
                      </span>
                      <span>
                        {first.permalink && <a href={first.permalink} target="_blank" rel="noopener noreferrer">Open on Instagram</a>}
                        {t.unread && <> {" "}<a href="#" onClick={(e) => { e.preventDefault(); markRead(current.presetId, t.threadId); }}>mark read</a></>}
                      </span>
                    </div>
                    {t.list.map((m) => (
                      <div key={m.id} className={`m${m.direction === "out" ? " out" : ""}`}>
                        <b>{m.direction === "out" ? "You" : m.author || "Someone"}</b>
                        <small>{ago(m.at)}</small>
                        <div>{m.body}</div>
                      </div>
                    ))}
                    {t.lastIn && (
                      <div className="rbox">
                        <textarea
                          placeholder={`Reply to ${t.lastIn.author || "them"}`}
                          value={drafts[key] || ""}
                          onChange={(e) => setDrafts((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <button className="pink" disabled={sending === key || !(drafts[key] || "").trim()} onClick={() => reply(t.lastIn as Item, key)}>
                          {sending === key ? "Sending..." : "Reply"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
