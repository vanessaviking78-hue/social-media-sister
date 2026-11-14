import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/ryderdashboard : engagement dashboard for The Ryder Clinic. Shows what is being done for them on Instagram: new followers,
// new following, comments, DMs in and out, story responses and a page health score. Comments and DMs come from the client inbox, followers from a
// daily Instagram snapshot, and anything Instagram will not hand over (story responses, or a day the snapshot missed) is typed in below.
// White background, black text, hot pink accent, League Spartan Black. "Clinic view" hides the entry form so it can be shown or printed for them.

const PINK = "#ff2d95";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Day = {
  day: string; newFollowers: number | null; newFollowing: number | null; commentsIn: number; commentsOut: number;
  dmsIn: number; dmsOut: number; storyResponses: number | null; note: string; followersAuto: boolean; minutes: number;
};
type Totals = {
  newFollowers: number | null; newFollowing: number | null; commentsIn: number; commentsOut: number;
  dmsIn: number; dmsOut: number; storyResponses: number | null; minutes: number;
};
type Part = { key: string; label: string; weight: number; value: number | null; target: number | null; points: number | null; detail: string };
type Data = {
  clinic: string; connected: boolean; username: string | null; days: number; from: string; to: string;
  totals: Totals; prevTotals: Totals;
  health: { score: number | null; band: string; measured: number; of: number; parts: Part[]; previous: number | null };
  series: Day[]; unanswered: number; timer: { startedAt: string } | null; targets: { comments: number; dms: number; newFollowers: number; storyResponses: number };
  followers: { now: number; following: number; asOf: string; since: { day: string; count: number } | null } | null;
  lastSnapshot: { at: string; error: string } | null;
};

type Lead = { handle: string; comments: number; dms: number; storyViews: number; lastAt: string | null; status: string; note: string; warmth: number; heat: "hot" | "warm" | "new" };

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

const hm = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);
const clock = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const num = (v: number | null | undefined) => (v == null ? "-" : v.toLocaleString("en-GB"));
const niceDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const longDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function change(now: number | null, before: number | null, days: number): string {
  if (now == null) return "Not tracked yet";
  if (before == null) return "No earlier period to compare";
  const d = now - before;
  if (d === 0) return `Same as the previous ${days} days`;
  return `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} on the previous ${days} days`;
}

function Bars({ days, series, title }: { days: Day[]; series: { name: string; get: (d: Day) => number | null; colour: string }[]; title: string }) {
  const W = 640, H = 150, pad = 18;
  const max = Math.max(1, ...days.flatMap((d) => series.map((s) => s.get(d) ?? 0)));
  const slot = (W - pad * 2) / days.length;
  const bw = Math.max(1.5, Math.min(14, (slot - 2) / series.length));
  const empty = days.every((d) => series.every((s) => (s.get(d) ?? 0) === 0));
  return (
    <div className="chart">
      <div className="ctitle">
        <span>{title}</span>
        <span className="legend">{series.map((s) => (<i key={s.name}><b style={{ background: s.colour }} />{s.name}</i>))}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={title}>
        <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="#000" strokeWidth="3" />
        {days.map((d, i) => {
          const x0 = pad + i * slot + (slot - bw * series.length) / 2;
          return series.map((s, j) => {
            const v = s.get(d) ?? 0;
            const h = (v / max) * (H - 14);
            return <rect key={`${d.day}${s.name}`} x={x0 + j * bw} y={H - h} width={bw} height={h} fill={s.colour}><title>{`${niceDay(d.day)}: ${s.name} ${s.get(d) == null ? "not logged" : v}`}</title></rect>;
          });
        })}
        <text x={pad} y={H + 17} fontSize="11" fill="#000">{niceDay(days[0].day)}</text>
        <text x={W - pad} y={H + 17} fontSize="11" fill="#000" textAnchor="end">{niceDay(days[days.length - 1].day)}</text>
        <text x={W - pad} y={11} fontSize="11" fill="#000" textAnchor="end">top: {max}</text>
        {empty && <text x={W / 2} y={H / 2} fontSize="14" textAnchor="middle" fill="#000">Nothing to show for these days yet</text>}
      </svg>
    </div>
  );
}

function Ring({ score, band }: { score: number | null; band: string }) {
  const r = 78, c = 2 * Math.PI * r;
  const v = score == null ? 0 : score;
  return (
    <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: 260 }} role="img" aria-label={`Page health score ${score ?? "not available"} out of 100`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#000" strokeWidth="16" opacity="0.1" />
      <circle cx="100" cy="100" r={r} fill="none" stroke={PINK} strokeWidth="16" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 100 100)" strokeLinecap="butt" />
      <text x="100" y="112" textAnchor="middle" fontSize="64" fill="#000">{score == null ? "-" : score}</text>
      <text x="100" y="140" textAnchor="middle" fontSize="13" fill="#000" letterSpacing="2">{score == null ? "NO DATA" : band.toUpperCase()}</text>
    </svg>
  );
}

export default function RyderDashboard() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [clinicView, setClinicView] = useState(false);
  const [form, setForm] = useState({ day: "", newFollowers: "", newFollowing: "", storyResponses: "", note: "" });
  const [saved, setSaved] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["new", "contacted", "booked", "not interested"]);
  const [leadFilter, setLeadFilter] = useState<"all" | "hot" | "open">("all");
  const [viewers, setViewers] = useState({ day: "", handles: "" });
  const [viewerMsg, setViewerMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [timeForm, setTimeForm] = useState({ day: "", minutes: "", note: "" });
  const [timeMsg, setTimeMsg] = useState("");
  const [stopMinutes, setStopMinutes] = useState("");
  const [stopNote, setStopNote] = useState("");

  const timerStart = data?.timer ? new Date(data.timer.startedAt).getTime() : null;
  useEffect(() => {
    if (!timerStart) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerStart]);

  const timeCall = async (path: string, body: object = {}) => {
    setTimeMsg("");
    const r = await fetch(`${BASE}/api/ryder/time/${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setTimeMsg(d?.error || "Could not save that"); return null; }
    await load();
    return d;
  };
  const stopTimer = async () => {
    const d = await timeCall("stop", { minutes: stopMinutes, note: stopNote });
    if (d) { setTimeMsg(`Logged ${hm(d.minutes)}`); setStopMinutes(""); setStopNote(""); }
  };
  const addTime = async () => {
    const d = await timeCall("add", { day: timeForm.day || data?.to, minutes: timeForm.minutes, note: timeForm.note });
    if (d) { setTimeMsg(`Logged ${hm(Number(timeForm.minutes))}`); setTimeForm({ ...timeForm, minutes: "", note: "" }); }
  };

  const loadLeads = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/ryder/leads`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setLeads(d.leads || []); if (d.statuses) setStatuses(d.statuses); }
    } catch { /* the leads list just stays as it was */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/ryder/dashboard?days=${days}`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "bad");
      setData(d);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error && e.message !== "bad" ? e.message : "I could not load the numbers. Refresh the page and try again.");
    }
  }, [days]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (data && !form.day) setForm((f) => ({ ...f, day: data.to }));
  }, [data, form.day]);

  const refresh = async () => {
    setBusy(true);
    setErr("");
    try {
      await fetch(`${BASE}/api/inbox/sync`, { method: "POST", headers: authHeaders() }).catch(() => undefined);
      const r = await fetch(`${BASE}/api/ryder/dashboard/refresh`, { method: "POST", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (d.error) setErr(`Instagram said: ${d.error}. You can still type the follower numbers in below.`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaved("");
    const r = await fetch(`${BASE}/api/ryder/dashboard/log`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d?.error || "Could not save that"); return; }
    setSaved(`Saved for ${niceDay(form.day)}`);
    setForm((f) => ({ ...f, newFollowers: "", newFollowing: "", storyResponses: "", note: "" }));
    await load();
  };

  const addViewers = async () => {
    setViewerMsg("");
    const r = await fetch(`${BASE}/api/ryder/leads/story-viewers`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ day: viewers.day || data?.to, handles: viewers.handles }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setViewerMsg(d?.error || "Could not save those"); return; }
    setViewerMsg(`${d.found} usernames found, ${d.added} new for that day`);
    setViewers((v) => ({ ...v, handles: "" }));
    await loadLeads();
  };

  const setStatus = async (l: Lead, status: string) => {
    setLeads((all) => all.map((x) => (x.handle === l.handle ? { ...x, status } : x)));
    await fetch(`${BASE}/api/ryder/leads/status`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ handle: l.handle, status, note: l.note }) });
  };

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Username", "Heat", "Story views", "Comments", "DMs", "Status", "Last seen"], ...visibleLeads.map((l) => [l.handle, l.heat, l.storyViews, l.comments, l.dms, l.status, l.lastAt ? l.lastAt.slice(0, 10) : ""])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ryder-leads.csv";
    a.click();
  };

  const visibleLeads = useMemo(() => leads.filter((l) => leadFilter === "all" || (leadFilter === "hot" ? l.heat === "hot" : l.status === "new" || l.status === "contacted")), [leads, leadFilter]);

  const pick = (d: Day) => setForm({
    day: d.day, newFollowers: d.followersAuto || d.newFollowers == null ? "" : String(d.newFollowers),
    newFollowing: d.followersAuto || d.newFollowing == null ? "" : String(d.newFollowing),
    storyResponses: d.storyResponses == null ? "" : String(d.storyResponses), note: d.note,
  });

  const recent = useMemo(() => (data ? [...data.series].reverse().slice(0, 14) : []), [data]);
  const t = data?.totals;
  const p = data?.prevTotals;

  const tiles: { label: string; now: number | null; before: number | null; sub?: string; text?: string }[] = t && p ? [
    { label: "New followers", now: t.newFollowers, before: p.newFollowers },
    { label: "New following", now: t.newFollowing, before: p.newFollowing },
    { label: "Comments received", now: t.commentsIn, before: p.commentsIn, sub: `${t.commentsOut} replies sent` },
    { label: "DMs incoming", now: t.dmsIn, before: p.dmsIn },
    { label: "DMs outgoing", now: t.dmsOut, before: p.dmsOut },
    { label: "Story responses", now: t.storyResponses, before: p.storyResponses },
    { label: "Time engaging", now: t.minutes, before: p.minutes, text: hm(t.minutes) },
  ] : [];

  return (
    <div className={`rd${clinicView ? " clinic" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@700;900&display=swap');
        .rd, .rd * { box-sizing: border-box; font-family: 'League Spartan', 'Arial Black', sans-serif; font-weight: 900; }
        .rd { position: fixed; inset: 0; overflow-y: auto; background: #fff; color: #000; padding: 4vh 5vw 8vh; }
        .rd .top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 3vh; }
        .rd a.back, .rd button { color: #fff; background: #000; border: 2px solid #000; text-decoration: none; text-transform: uppercase; letter-spacing: 0.15em; font-size: 12px; padding: 9px 16px; cursor: pointer; }
        .rd a.back:hover, .rd button:hover { background: ${PINK}; border-color: ${PINK}; color: #000; }
        .rd button.ghost { background: #fff; color: #000; }
        .rd button.ghost.on { background: ${PINK}; border-color: ${PINK}; color: #000; }
        .rd h1 { margin: 0 0 6px; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.85; font-size: min(11vw, 13vh); }
        .rd h1 em { font-style: normal; color: ${PINK}; }
        .rd h2 { margin: 5vh 0 14px; text-transform: uppercase; letter-spacing: -0.01em; font-size: 28px; }
        .rd .sub { font-size: 15px; font-weight: 700; margin: 0 0 3vh; }
        .rd .note { border-left: 8px solid ${PINK}; padding: 8px 14px; margin: 0 0 16px; font-size: 15px; font-weight: 700; line-height: 1.25; }
        .rd .hero { display: grid; grid-template-columns: minmax(200px, 280px) 1fr; gap: 28px; align-items: center; border: 4px solid #000; padding: 22px; }
        @media (max-width: 720px) { .rd .hero { grid-template-columns: 1fr; justify-items: center; } }
        .rd .hero .vs { font-size: 15px; font-weight: 700; margin: 6px 0 14px; }
        .rd .part { display: grid; grid-template-columns: 150px 1fr 54px; gap: 10px; align-items: center; margin: 7px 0; font-size: 14px; }
        .rd .part .bar { height: 14px; background: #eee; position: relative; }
        .rd .part .bar i { position: absolute; inset: 0 auto 0 0; background: ${PINK}; }
        .rd .part small { grid-column: 2 / 4; font-weight: 700; font-size: 12px; margin-top: -4px; }
        .rd .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 3vh; }
        .rd .tile { padding: 16px; border: 4px solid #000; background: #000; color: ${PINK}; }
        .rd .tile:nth-child(even) { background: ${PINK}; color: #000; border-color: ${PINK}; }
        .rd .tile b { display: block; font-size: 52px; line-height: 1; }
        .rd .tile span { display: block; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 6px; }
        .rd .tile small { display: block; font-size: 12px; font-weight: 700; margin-top: 8px; }
        .rd .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 18px; }
        @media (max-width: 480px) { .rd .charts { grid-template-columns: 1fr; } }
        .rd .chart { border: 3px solid #000; padding: 12px 14px 6px; }
        .rd .ctitle { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; text-transform: uppercase; font-size: 14px; letter-spacing: 0.08em; }
        .rd .legend i { font-style: normal; font-size: 11px; margin-left: 10px; letter-spacing: 0.06em; }
        .rd .legend b { display: inline-block; width: 10px; height: 10px; margin-right: 5px; }
        .rd .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; align-items: end; border: 4px solid ${PINK}; padding: 16px; }
        .rd label { display: block; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
        .rd input { width: 100%; margin-top: 5px; padding: 9px 10px; border: 3px solid #000; font-size: 16px; background: #fff; color: #000; }
        .rd .tablewrap { overflow-x: auto; margin-top: 14px; }
        .rd table { width: 100%; border-collapse: collapse; }
        .rd th { text-align: left; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 10px; border-bottom: 4px solid #000; white-space: nowrap; }
        .rd td { padding: 9px 10px; border-bottom: 1px solid #ccc; font-size: 15px; }
        .rd tr.click { cursor: pointer; }
        .rd tr.click:hover td { background: #fff0f7; }
        .rd .tag { display: inline-block; padding: 3px 9px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; border: 2px solid #000; }
        .rd .tag.hot { background: ${PINK}; border-color: ${PINK}; }
        .rd .tag.warm { background: #000; color: #fff; }
        .rd select { font-size: 14px; padding: 5px 6px; border: 2px solid #000; background: #fff; color: #000; }
        .rd textarea { width: 100%; margin-top: 5px; padding: 9px 10px; border: 3px solid #000; font-size: 16px; min-height: 90px; font-family: inherit; font-weight: 700; }
        .rd .foot { font-size: 12px; font-weight: 600; line-height: 1.35; margin-top: 18px; }
        .rd.clinic .noclinic { display: none; }
        @media print {
          .rd { position: static; overflow: visible; padding: 0; }
          .rd .noprint, .rd .noclinic { display: none !important; }
          .rd .tile, .rd .hero, .rd .chart { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="top noprint">
        <Link href="/" className="back">Back</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([7, 30, 90] as const).map((n) => (
            <button key={n} className={`ghost${days === n ? " on" : ""}`} onClick={() => setDays(n)}>{n} days</button>
          ))}
          <button className={`ghost${clinicView ? " on" : ""}`} onClick={() => setClinicView((v) => !v)}>{clinicView ? "Exit clinic view" : "Clinic view"}</button>
          <button className="ghost" onClick={() => window.print()}>Print or save PDF</button>
          <button onClick={refresh} disabled={busy}>{busy ? "Checking..." : "Refresh numbers"}</button>
        </div>
      </div>

      <h1>Ryder <em>engagement</em></h1>
      <p className="sub">
        The Ryder Clinic{data?.username ? ` (@${data.username})` : ""}. {data ? `${niceDay(data.from)} to ${niceDay(data.to)}, the last ${data.days} days.` : ""}
      </p>

      {err && <p className="note noprint">{err}</p>}
      {data && !data.connected && (
        <p className="note noprint">The Ryder Clinic is not connected to Instagram yet, so comments, DMs and followers cannot come in by themselves. You can still type numbers in below.</p>
      )}

      {data && t && p && (
        <>
          <div className="hero">
            <Ring score={data.health.score} band={data.health.band} />
            <div>
              <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Page health score</div>
              <div className="vs">
                {data.health.score == null
                  ? "Nothing measured yet. Once comments, DMs or follower numbers arrive the score appears."
                  : data.health.previous == null
                    ? `Based on ${data.health.measured} of ${data.health.of} measures.`
                    : `${data.health.score === data.health.previous ? "Same as" : data.health.score > data.health.previous ? `Up ${data.health.score - data.health.previous} on` : `Down ${data.health.previous - data.health.score} on`} the previous ${data.days} days (${data.health.previous}). Based on ${data.health.measured} of ${data.health.of} measures.`}
              </div>
              {data.health.parts.map((x) => (
                <div className="part" key={x.key}>
                  <span>{x.label}</span>
                  <div className="bar"><i style={{ width: `${x.points == null ? 0 : Math.round((x.points / x.weight) * 100)}%` }} /></div>
                  <span>{x.points == null ? "n/a" : `${Math.round(x.points)}/${x.weight}`}</span>
                  <small>{x.detail}{x.target != null && x.key !== "replyRate" ? `. Target ${x.target}` : ""}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="tiles">
            {tiles.map((x) => (
              <div className="tile" key={x.label}>
                <b>{x.text ?? num(x.now)}</b>
                <span>{x.label}</span>
                <small>{x.text && x.before != null ? `${hm(x.before)} in the previous ${data.days} days` : change(x.now, x.before, data.days)}{x.sub ? `. ${x.sub}` : ""}</small>
              </div>
            ))}
          </div>

          {data.followers && (
            <p className="sub" style={{ marginTop: 18 }}>
              {num(data.followers.now)} followers and following {num(data.followers.following)} as of {niceDay(data.followers.asOf)}.
              {data.followers.since && data.followers.since.day !== data.followers.asOf
                ? ` Since ${niceDay(data.followers.since.day)} that is ${data.followers.now - data.followers.since.count >= 0 ? "up" : "down"} ${Math.abs(data.followers.now - data.followers.since.count)}.`
                : ""}
            </p>
          )}
          {data.unanswered > 0 && (
            <p className="note noprint">{data.unanswered} unread {data.unanswered === 1 ? "message is" : "messages are"} waiting in the <Link href="/inbox">inbox</Link>.</p>
          )}

          <h2>Day by day</h2>
          <div className="charts">
            <Bars title="DMs" days={data.series} series={[
              { name: "Incoming", get: (d) => d.dmsIn, colour: "#000" },
              { name: "Outgoing", get: (d) => d.dmsOut, colour: PINK },
            ]} />
            <Bars title="Comments" days={data.series} series={[
              { name: "Received", get: (d) => d.commentsIn, colour: "#000" },
              { name: "Replies", get: (d) => d.commentsOut, colour: PINK },
            ]} />
            <Bars title="Followers" days={data.series} series={[
              { name: "New followers", get: (d) => d.newFollowers, colour: PINK },
              { name: "New following", get: (d) => d.newFollowing, colour: "#000" },
            ]} />
            <Bars title="Minutes engaging" days={data.series} series={[
              { name: "Minutes", get: (d) => d.minutes, colour: PINK },
            ]} />
            <Bars title="Story responses" days={data.series} series={[
              { name: "Responses", get: (d) => d.storyResponses, colour: PINK },
            ]} />
          </div>

          <div className="noclinic noprint">
            <h2>Add or correct a day</h2>
            <div className="form">
              <label>Day<input type="date" value={form.day} max={data.to} onChange={(e) => setForm({ ...form, day: e.target.value })} /></label>
              <label>New followers<input inputMode="numeric" value={form.newFollowers} onChange={(e) => setForm({ ...form, newFollowers: e.target.value })} placeholder="auto" /></label>
              <label>New following<input inputMode="numeric" value={form.newFollowing} onChange={(e) => setForm({ ...form, newFollowing: e.target.value })} placeholder="auto" /></label>
              <label>Story responses<input inputMode="numeric" value={form.storyResponses} onChange={(e) => setForm({ ...form, storyResponses: e.target.value })} /></label>
              <label style={{ gridColumn: "1 / -1" }}>What I did that day<input value={form.note} maxLength={400} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional, for example: replied to 6 enquiries about consultations" /></label>
              <div><button onClick={save} disabled={!form.day}>Save day</button> {saved && <span style={{ marginLeft: 10, fontSize: 13 }}>{saved}</span>}</div>
            </div>
            <p className="foot">
              Comments, DMs in and DMs out come from the inbox by themselves. New followers and new following are worked out from a daily Instagram check, and anything you type here for a day replaces it.
              Story responses are always typed in.
            </p>
          </div>

          <div className="noclinic noprint">
            <h2>Time engaging</h2>
            <div className="form">
              {timerStart ? (
                <>
                  <div style={{ gridColumn: "1 / -1", fontSize: 44, lineHeight: 1 }}>{clock(now - timerStart)}</div>
                  <label>Correct the minutes (only if you forgot to stop it)<input inputMode="numeric" value={stopMinutes} onChange={(e) => setStopMinutes(e.target.value)} placeholder="leave blank to use the timer" /></label>
                  <label style={{ gridColumn: "span 2" }}>What I did<input value={stopNote} maxLength={300} onChange={(e) => setStopNote(e.target.value)} placeholder="Optional, for example: replied to enquiries and commented on local posts" /></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={stopTimer}>Stop and log</button>
                    <button className="ghost" onClick={() => timeCall("cancel")}>Discard</button>
                  </div>
                </>
              ) : (
                <div><button onClick={() => timeCall("start")}>Start timer</button></div>
              )}
            </div>
            <div className="form" style={{ marginTop: 12, borderColor: "#000" }}>
              <label>Day<input type="date" value={timeForm.day || data.to} max={data.to} onChange={(e) => setTimeForm({ ...timeForm, day: e.target.value })} /></label>
              <label>Minutes<input inputMode="numeric" value={timeForm.minutes} onChange={(e) => setTimeForm({ ...timeForm, minutes: e.target.value })} placeholder="e.g. 25" /></label>
              <label style={{ gridColumn: "span 2" }}>What I did<input value={timeForm.note} maxLength={300} onChange={(e) => setTimeForm({ ...timeForm, note: e.target.value })} /></label>
              <div><button onClick={addTime} disabled={!timeForm.minutes}>Add time</button></div>
            </div>
            {timeMsg && <p className="foot">{timeMsg}</p>}
            <p className="foot">The timer keeps running if you close the page. Instagram does not report time spent in the app, so this is the time you log.</p>
          </div>

          <h2>The last 14 days</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Day</th><th>New followers</th><th>New following</th><th>Comments in</th><th>Replies</th><th>DMs in</th><th>DMs out</th><th>Story responses</th><th>Time</th><th>What I did</th></tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.day} className="click" onClick={() => { pick(d); window.scrollTo?.(0, 0); }} title="Tap to edit this day">
                    <td>{longDay(d.day)}</td>
                    <td>{num(d.newFollowers)}</td><td>{num(d.newFollowing)}</td>
                    <td>{d.commentsIn}</td><td>{d.commentsOut}</td><td>{d.dmsIn}</td><td>{d.dmsOut}</td>
                    <td>{num(d.storyResponses)}</td>
                    <td>{d.minutes ? hm(d.minutes) : "-"}</td>
                    <td style={{ fontWeight: 600, maxWidth: 320 }}>{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="noclinic noprint">
            <h2>Leads</h2>
            <p className="sub">Everyone who has commented, messaged or viewed a story, warmest first. Heat score: 1 for each story view, 2 for each comment, 4 for each DM. Hot is 6 or more, warm is 3 or more.</p>
            <div className="form">
              <label>Story day<input type="date" value={viewers.day || data.to} max={data.to} onChange={(e) => setViewers({ ...viewers, day: e.target.value })} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Paste story viewers (one username per line)
                <textarea value={viewers.handles} onChange={(e) => setViewers({ ...viewers, handles: e.target.value })} placeholder={"Open the story in Instagram, swipe up for the viewer list, copy the usernames and paste them here.\nInstagram only keeps the list for 48 hours."} />
              </label>
              <div><button onClick={addViewers} disabled={!viewers.handles.trim()}>Add viewers</button> {viewerMsg && <span style={{ marginLeft: 10, fontSize: 13 }}>{viewerMsg}</span>}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 0" }}>
              {([["all", "Everyone"], ["hot", "Hot leads"], ["open", "To follow up"]] as const).map(([k, label]) => (
                <button key={k} className={`ghost${leadFilter === k ? " on" : ""}`} onClick={() => setLeadFilter(k)}>{label}</button>
              ))}
              <button onClick={exportCsv} disabled={visibleLeads.length === 0}>Download CSV</button>
            </div>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Username</th><th>Heat</th><th>Story views</th><th>Comments</th><th>DMs</th><th>Last seen</th><th>Status</th></tr></thead>
                <tbody>
                  {visibleLeads.length === 0 && <tr><td colSpan={7} style={{ fontWeight: 600 }}>No leads yet. They appear as people comment, message or are pasted in from a story.</td></tr>}
                  {visibleLeads.slice(0, 300).map((l) => (
                    <tr key={l.handle}>
                      <td><a href={`https://www.instagram.com/${l.handle}/`} target="_blank" rel="noopener noreferrer" style={{ color: "#000" }}>@{l.handle}</a></td>
                      <td><span className={`tag ${l.heat}`}>{l.heat}</span></td>
                      <td>{l.storyViews}</td><td>{l.comments}</td><td>{l.dms}</td>
                      <td>{l.lastAt ? niceDay(l.lastAt.slice(0, 10)) : "-"}</td>
                      <td><select value={l.status} onChange={(e) => setStatus(l, e.target.value)}>{statuses.map((x) => <option key={x} value={x}>{x}</option>)}</select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleLeads.length > 300 && <p className="foot">Showing the warmest 300 of {visibleLeads.length}. The CSV has them all.</p>}
          </div>

          <p className="foot">
            How the score works: out of 100, from reply rate (30), DM conversations (20), new followers (20), comments (15) and story responses (15).
            Each is measured against a target of {data.targets.dms} DMs, {data.targets.comments} comments, {data.targets.newFollowers} new followers and {data.targets.storyResponses} story responses a week.
            A measure with no numbers yet is left out rather than counted as zero.
            {data.lastSnapshot ? ` Followers last checked ${new Date(data.lastSnapshot.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : ""}
          </p>
        </>
      )}
    </div>
  );
}
