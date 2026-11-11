import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/hammeredlinks : the Hammered links dashboard. One tracking link per person (rob, isaac, vanessa, and any she adds),
// with opens, people who started the form, and finished entries. Black and yellow, same as the Hammered home.

const YELLOW = "#ffd60a";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const SITE = "https://www.thecybersuite.com/hammeredfreebies";
const DEFAULT_NAMES = ["rob", "isaac", "vanessa"];
const EXTRA_KEY = "hammered-link-names";

type LinkRow = { ref: string; opens: number; started: number; entries: number; lastOpen: string | null; lastEntry: string | null };
type Recent = { id: string; business: string; name: string; trade: string; ref: string; status: string; at: string };

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw };
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const cleanName = (v: string) => v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

export default function HammeredLinks() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [newName, setNewName] = useState("");
  const [extra, setExtra] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(EXTRA_KEY) || "[]"); } catch { return []; }
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/hammered/links`, { headers: authHeaders() });
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      setRows(d.links || []);
      setRecent(d.recent || []);
      setErr("");
    } catch {
      setErr("I could not load the numbers. Refresh the page and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Hammered links";
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Rob, Isaac and Vanessa always show, then anyone she adds, then any other name that has been used on a link.
  const list = useMemo(() => {
    const byRef = new Map(rows.map((r) => [r.ref, r]));
    const names = [...DEFAULT_NAMES, ...extra.filter((n) => !DEFAULT_NAMES.includes(n))];
    for (const r of rows) if (r.ref && !names.includes(r.ref)) names.push(r.ref);
    const out: LinkRow[] = names.map((n) => byRef.get(n) || { ref: n, opens: 0, started: 0, entries: 0, lastOpen: null, lastEntry: null });
    const plain = byRef.get("");
    if (plain) out.push(plain);
    return out;
  }, [rows, extra]);

  const totals = list.reduce((a, r) => ({ opens: a.opens + r.opens, started: a.started + r.started, entries: a.entries + r.entries }), { opens: 0, started: 0, entries: 0 });

  const linkFor = (ref: string) => (ref ? `${SITE}?ref=${ref}` : SITE);
  const copy = async (ref: string) => {
    try { await navigator.clipboard.writeText(linkFor(ref)); setCopied(ref || "plain"); setTimeout(() => setCopied(""), 1800); } catch { window.prompt("Copy this link", linkFor(ref)); }
  };
  const addName = () => {
    const n = cleanName(newName);
    if (!n || DEFAULT_NAMES.includes(n) || extra.includes(n)) { setNewName(""); return; }
    const next = [...extra, n];
    setExtra(next);
    try { localStorage.setItem(EXTRA_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setNewName("");
  };

  return (
    <div className="hl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
        .hl, .hl * { box-sizing: border-box; font-family: 'League Spartan', 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
        .hl { position: fixed; inset: 0; overflow-y: auto; background: #000; color: #fff; padding: 4vh 5vw 8vh; }
        .hl .top { display: flex; justify-content: space-between; margin-bottom: 3vh; }
        .hl .top a { color: #000; background: ${YELLOW}; text-decoration: none; text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; padding: 9px 16px; }
        .hl .top a:hover { background: #fff; }
        .hl h1 { margin: 0 0 6px; text-transform: uppercase; letter-spacing: -0.02em; font-size: clamp(36px, 7vw, 80px); line-height: 0.9; color: ${YELLOW}; }
        .hl .sub { font-size: 16px; max-width: 700px; line-height: 1.25; margin-bottom: 3vh; }
        .hl .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 4vh; }
        .hl .stat { background: ${YELLOW}; color: #000; padding: 16px 20px; }
        .hl .stat b { display: block; font-size: 44px; line-height: 1; }
        .hl .stat span { font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; }
        .hl table { width: 100%; border-collapse: collapse; }
        .hl th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: ${YELLOW}; padding: 10px 12px; border-bottom: 3px solid ${YELLOW}; }
        .hl td { padding: 14px 12px; border-bottom: 1px solid #333; font-size: 17px; vertical-align: middle; }
        .hl td.num { font-size: 26px; }
        .hl td.who { text-transform: capitalize; font-size: 24px; color: ${YELLOW}; }
        .hl td.who small { display: block; text-transform: none; color: #aaa; font-size: 12px; font-weight: 700; word-break: break-all; margin-top: 2px; }
        .hl .zero { color: #666; }
        .hl button { cursor: pointer; border: 0; background: ${YELLOW}; color: #000; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; padding: 9px 14px; }
        .hl button:hover { background: #fff; }
        .hl .add { display: flex; gap: 10px; margin: 4vh 0 2vh; max-width: 520px; }
        .hl .add input { flex: 1; background: #111; border: 2px solid ${YELLOW}; color: #fff; padding: 10px 12px; font-size: 16px; }
        .hl h2 { margin: 5vh 0 10px; text-transform: uppercase; color: ${YELLOW}; font-size: 28px; letter-spacing: -0.01em; }
        .hl .err { background: #400; padding: 12px 16px; margin-bottom: 20px; }
        .hl .tip { font-size: 14px; color: #bbb; max-width: 700px; line-height: 1.3; margin-top: 18px; font-weight: 700; }
        .hl .scroll { overflow-x: auto; }
        @media (max-width: 700px) { .hl td, .hl th { padding: 10px 6px; } .hl td.num { font-size: 22px; } .hl td.who { font-size: 19px; } }
      `}</style>
      <div className="top">
        <Link href="/hammered">Back to Hammered</Link>
        <button onClick={load}>Refresh</button>
      </div>
      <h1>Hammered links</h1>
      <div className="sub">One link each. Opens count each person once per link. Started means they typed into the form. Entries are finished requests for a free trial.</div>
      {err && <div className="err">{err}</div>}
      <div className="stats">
        <div className="stat"><b>{totals.opens}</b><span>Opened</span></div>
        <div className="stat"><b>{totals.started}</b><span>Started</span></div>
        <div className="stat"><b>{totals.entries}</b><span>Entries</span></div>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Who</th><th>Opened</th><th>Started</th><th>Entries</th><th>Last opened</th><th>Last entry</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.ref || "plain"}>
                <td className="who">{r.ref || "No name"}<small>{linkFor(r.ref)}</small></td>
                <td className={`num ${r.opens ? "" : "zero"}`}>{r.opens}</td>
                <td className={`num ${r.started ? "" : "zero"}`}>{r.started}</td>
                <td className={`num ${r.entries ? "" : "zero"}`}>{r.entries}</td>
                <td>{ago(r.lastOpen)}</td>
                <td>{ago(r.lastEntry)}</td>
                <td><button onClick={() => copy(r.ref)}>{copied === (r.ref || "plain") ? "Copied" : "Copy link"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div className="tip">Loading the numbers...</div>}
      <div className="add">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addName(); }} placeholder="Add another name, like dave" />
        <button onClick={addName}>Add link</button>
      </div>
      <div className="tip">Names saved here only show on this device. The link works for any name though, so it will turn up in the table as soon as someone opens it.</div>
      <h2>Latest entries</h2>
      {recent.length === 0 ? (
        <div className="tip">No entries yet.</div>
      ) : (
        <div className="scroll">
          <table>
            <thead><tr><th>Business</th><th>Name</th><th>Trade</th><th>From</th><th>When</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.business}</td><td>{r.name}</td><td>{r.trade || "Not said"}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.ref || "No name"}</td><td>{ago(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
