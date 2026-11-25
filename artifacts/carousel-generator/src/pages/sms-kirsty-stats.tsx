import { useEffect, useState } from "react";

// /smskirsty/stats: how many people are opening Kirsty's Aesthetic Shift page and applying. Behind the tools login.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const PINK = "#ff1f8e";

type Stats = {
  totals: { opens?: number; visitors?: number; started?: number; applied?: number; visitors_24h?: number };
  bySrc: { src: string; visitors: number; applied: number }[];
  byDay: { day: string; opens: number; visitors: number; applied: number }[];
};

const th = { textAlign: "left" as const, padding: "8px 10px", borderBottom: "2px solid #000", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const td = { padding: "9px 10px", borderBottom: "1px solid #e4e4e4", fontSize: 15 };

export default function SmsKirstyStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("Loading your numbers...");
  const [stamp, setStamp] = useState("");

  const load = async () => {
    const pw = localStorage.getItem("cybersuite-pw") || "";
    try {
      const r = await fetch(`${BASE}/api/page-track/stats?page=smskirsty`, { headers: { "x-app-password": pw } });
      if (!r.ok) throw new Error(r.status === 401 ? "Please log in to your tools first." : "Could not load the stats.");
      setData((await r.json()) as Stats);
      setStamp(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  useEffect(() => {
    document.title = "Kirsty page stats";
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, []);

  const font = "'League Spartan', sans-serif";
  if (!data) return <div style={{ padding: 40, fontFamily: font, fontWeight: 900, fontSize: 24 }}>{msg}</div>;

  const t = data.totals;
  const rate = t.visitors ? Math.round(((t.applied || 0) / t.visitors) * 100) : 0;
  const tiles: [string, string | number][] = [
    ["Page opens", t.opens ?? 0],
    ["People who opened it", t.visitors ?? 0],
    ["Opened in the last 24 hours", t.visitors_24h ?? 0],
    ["Started the form", t.started ?? 0],
    ["Applications sent", t.applied ?? 0],
    ["Applied out of opened", `${rate}%`],
  ];

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", fontFamily: font, padding: "28px 20px 70px" }}>
      <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(2.2rem, 6vw, 3.6rem)", lineHeight: 1, margin: 0, textTransform: "uppercase" }}>Kirsty page stats</h1>
        <div style={{ height: 8, width: 100, background: PINK, margin: "10px 0 8px" }} />
        <p style={{ fontSize: 15, color: "#555", fontWeight: 500, margin: "0 0 20px" }}>
          The Aesthetic Shift page at /smskirsty. Updated {stamp}, and it refreshes itself every minute. Your own visits while you are logged in are not counted.{" "}
          <button onClick={() => void load()} style={{ fontFamily: font, fontWeight: 800, background: "#000", color: PINK, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Refresh</button>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 28 }}>
          {tiles.map(([l, v], i) => (
            <div key={l} style={{ background: i % 2 === 0 ? "#000" : PINK, color: i % 2 === 0 ? PINK : "#000", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 1 }}>{v}</div>
              <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontWeight: 900, fontSize: 26, textTransform: "uppercase", margin: "0 0 8px" }}>Where they came from</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
          <thead><tr><th style={th}>Link tag</th><th style={th}>People who opened it</th><th style={th}>Applications</th></tr></thead>
          <tbody>
            {data.bySrc.length === 0 && <tr><td style={td} colSpan={3}>Nothing yet.</td></tr>}
            {data.bySrc.map((s) => (
              <tr key={s.src}><td style={td}>{s.src === "direct" ? "No tag (direct)" : s.src}</td><td style={td}>{s.visitors}</td><td style={td}>{s.applied}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontWeight: 900, fontSize: 26, textTransform: "uppercase", margin: "0 0 8px" }}>Day by day</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Day</th><th style={th}>People</th><th style={th}>Opens</th><th style={th}>Applications</th></tr></thead>
          <tbody>
            {data.byDay.length === 0 && <tr><td style={td} colSpan={4}>Nothing yet.</td></tr>}
            {data.byDay.map((d) => (
              <tr key={d.day}>
                <td style={td}>{new Date(d.day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                <td style={td}>{d.visitors}</td><td style={td}>{d.opens}</td><td style={td}>{d.applied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
