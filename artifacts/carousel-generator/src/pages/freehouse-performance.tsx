import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/freehouseperformance : which Freehouse posts are performing. Pulls likes, comments, saves, shares and reach from Instagram,
// scores each post and flags the top quarter as high performing. Black and yellow, same as the Freehouse home.

const BLUE = "#00e5ff";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Post = {
  id: number; title: string; caption: string; postedAt: string; permalink: string | null;
  likes: number | null; comments: number | null; saved: number | null; shares: number | null; reach: number | null;
  score: number | null; rate: number | null; insightsError: string; hasData: boolean; tier: "high" | "steady" | "slow" | "none";
};
type Data = {
  posts: Post[];
  totals: { published: number; tracked: number; likes: number; comments: number; saved: number; shares: number; reach: number };
  lastSync: { at: string; checked: number; error: string } | null;
};

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw };
};

const num = (v: number | null) => (v == null ? "-" : v.toLocaleString("en-GB"));
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function FreehousePerformance() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "high">("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/freehouse/performance`, { headers: authHeaders() });
      if (!r.ok) throw new Error("bad");
      setData(await r.json());
      setErr("");
    } catch {
      setErr("I could not load the numbers. Refresh the page and try again.");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const refresh = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${BASE}/api/freehouse/performance/sync`, { method: "POST", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (d.error) setErr(`Instagram said: ${d.error}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const posts = (data?.posts || []).filter((p) => filter === "all" || p.tier === "high");
  const insightsMissing = (data?.posts || []).some((p) => p.hasData && p.insightsError);

  return (
    <div className="hp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
        .hp, .hp * { box-sizing: border-box; font-family: 'League Spartan', 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
        .hp { position: fixed; inset: 0; overflow-y: auto; background: #000; color: #fff; padding: 4vh 5vw 8vh; }
        .hp .top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 3vh; }
        .hp a.back, .hp button { color: #000; background: ${BLUE}; border: 0; text-decoration: none; text-transform: uppercase; letter-spacing: 0.15em; font-size: 12px; padding: 9px 16px; cursor: pointer; }
        .hp a.back:hover, .hp button:hover { background: #fff; }
        .hp button.ghost { background: transparent; color: ${BLUE}; border: 2px solid ${BLUE}; }
        .hp button.ghost.on { background: ${BLUE}; color: #000; }
        .hp h1 { margin: 0 0 10px; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.85; font-size: min(11vw, 14vh); color: ${BLUE}; }
        .hp .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 3vh 0; }
        .hp .stat { border: 3px solid ${BLUE}; padding: 12px 14px; }
        .hp .stat b { display: block; font-size: 32px; color: ${BLUE}; }
        .hp .stat span { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
        .hp .note { border-left: 8px solid ${BLUE}; padding: 8px 14px; margin: 0 0 16px; font-size: 15px; font-weight: 700; text-transform: none; line-height: 1.25; }
        .hp table { width: 100%; border-collapse: collapse; }
        .hp th { text-align: left; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${BLUE}; padding: 8px 10px; border-bottom: 3px solid ${BLUE}; white-space: nowrap; }
        .hp td { padding: 11px 10px; border-bottom: 1px solid #333; font-size: 16px; vertical-align: top; }
        .hp td.t { max-width: 420px; text-transform: none; font-weight: 700; line-height: 1.2; }
        .hp td.t small { display: block; color: #aaa; font-weight: 600; margin-top: 3px; }
        .hp .tag { display: inline-block; padding: 3px 9px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
        .hp .tag.high { background: ${BLUE}; color: #000; }
        .hp .tag.steady { border: 2px solid #777; color: #ccc; }
        .hp .tag.slow { border: 2px solid #444; color: #888; }
        .hp .tablewrap { overflow-x: auto; }
        .hp a { color: ${BLUE}; }
      `}</style>

      <div className="top">
        <Link href="/freehouse" className="back">Freehouse</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={`ghost${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All posts</button>
          <button className={`ghost${filter === "high" ? " on" : ""}`} onClick={() => setFilter("high")}>High performing</button>
          <button onClick={refresh} disabled={busy}>{busy ? "Checking Instagram..." : "Refresh numbers"}</button>
        </div>
      </div>

      <h1>What is working</h1>
      {err && <p className="note">{err}</p>}
      {insightsMissing && (
        <p className="note">
          Likes and comments are coming through. Saves, shares and reach are not, because Freehouse was connected without the insights permission.{" "}
          <a href={`${BASE}/api/meta/auth/bulk-start?extended=1`}>Reconnect with insights</a> and they will fill in.
        </p>
      )}

      {data && (
        <>
          <div className="stats">
            <div className="stat"><b>{data.totals.tracked}/{data.totals.published}</b><span>Posts tracked</span></div>
            <div className="stat"><b>{num(data.totals.likes)}</b><span>Likes</span></div>
            <div className="stat"><b>{num(data.totals.comments)}</b><span>Comments</span></div>
            <div className="stat"><b>{num(data.totals.saved)}</b><span>Saves</span></div>
            <div className="stat"><b>{num(data.totals.shares)}</b><span>Shares</span></div>
            <div className="stat"><b>{num(data.totals.reach)}</b><span>Reach</span></div>
          </div>

          {data.totals.published === 0 && <p className="note">No Freehouse posts have gone out yet. Once they are published they appear here.</p>}
          {data.totals.published > 0 && data.totals.tracked === 0 && <p className="note">Posts are published but the numbers have not been fetched yet. Press Refresh numbers.</p>}

          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Rank</th><th>Post</th><th>Posted</th><th>Likes</th><th>Comments</th><th>Saves</th><th>Shares</th><th>Reach</th><th>Score</th><th></th></tr>
              </thead>
              <tbody>
                {posts.map((p, i) => (
                  <tr key={p.id}>
                    <td>{p.hasData ? i + 1 : "-"}</td>
                    <td className="t">
                      {p.permalink ? <a href={p.permalink} target="_blank" rel="noopener noreferrer">{p.title || p.caption.slice(0, 80)}</a> : (p.title || p.caption.slice(0, 80))}
                      <small>{p.caption.slice(0, 90)}</small>
                    </td>
                    <td>{day(p.postedAt)}</td>
                    <td>{num(p.likes)}</td>
                    <td>{num(p.comments)}</td>
                    <td>{num(p.saved)}</td>
                    <td>{num(p.shares)}</td>
                    <td>{num(p.reach)}</td>
                    <td>{p.score == null ? "-" : p.score}{p.rate != null ? ` (${p.rate}%)` : ""}</td>
                    <td>{p.tier !== "none" && <span className={`tag ${p.tier}`}>{p.tier === "high" ? "High performing" : p.tier === "steady" ? "Steady" : "Slow"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, marginTop: 18, textTransform: "none", fontWeight: 600, color: "#aaa", lineHeight: 1.3 }}>
            Score = likes + 2 x comments + 3 x saves + 4 x shares. Where reach is known, posts are ranked by score as a share of reach, so a post is not judged on luck alone. The top quarter are marked high performing.
            {data.lastSync ? ` Last checked ${new Date(data.lastSync.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : ""}
          </p>
        </>
      )}
    </div>
  );
}
