import { useEffect, useState } from "react";

// /blackfriday26/stats: how many people are opening the Black Friday page. Behind the tools login.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const MAGENTA = "#e6007e";

type Stats = {
  totals: { opens?: number; visitors?: number; clicks?: number; clickers?: number; visitors_24h?: number };
  byOffer: { offer: string; looked: number; clicks: number }[];
  bySrc: { src: string; visitors: number; clicks: number }[];
  byDay: { day: string; opens: number; visitors: number; clicks: number }[];
};

const OFFER_NAMES: Record<string, string> = {
  "12for6": "12 months for the price of 6",
  monthly: "Monthly, tied in for a year",
  "6for3": "6 months for the price of 3",
  diy: "DIY from the portal",
  general: "Bottom button (general question)",
};
const SRC_NAMES: Record<string, string> = {
  warm: "1. Hand-raisers",
  inbound: "2. Clinic followers",
  mutual: "3. Mutual followers",
  nudge: "4. Black Friday nudge",
  last: "5. Last chance",
  dm: "Instagram DM (untagged)",
  direct: "No tag (direct)",
};

const th = { textAlign: "left" as const, padding: "8px 10px", borderBottom: "2px solid #000", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const td = { padding: "9px 10px", borderBottom: "1px solid #e4e4e4", fontSize: 15 };

export default function BlackFriday26Stats() {
  const [data, setData] = useState<Stats | null>(null);
  const [msg, setMsg] = useState("Loading your numbers...");
  const [stamp, setStamp] = useState("");

  const load = async () => {
    const pw = localStorage.getItem("cybersuite-pw") || "";
    try {
      const r = await fetch(`${BASE}/api/bf26/stats`, { headers: { "x-app-password": pw } });
      if (!r.ok) throw new Error(r.status === 401 ? "Please log in to your tools first." : "Could not load the stats.");
      setData((await r.json()) as Stats);
      setStamp(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  useEffect(() => {
    document.title = "Black Friday stats";
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, []);

  const font = "'League Spartan', sans-serif";
  if (!data) return <div style={{ padding: 40, fontFamily: font, fontWeight: 900, fontSize: 24 }}>{msg}</div>;

  const t = data.totals;
  const rate = t.visitors ? Math.round(((t.clickers || 0) / t.visitors) * 100) : 0;
  const tiles: [string, string | number][] = [
    ["Page opens", t.opens ?? 0],
    ["People who opened it", t.visitors ?? 0],
    ["Opened in the last 24 hours", t.visitors_24h ?? 0],
    ["WhatsApp taps", t.clicks ?? 0],
    ["People who tapped", t.clickers ?? 0],
    ["Tapped out of opened", `${rate}%`],
  ];
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.visitors));

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", fontFamily: font, padding: "28px 20px 70px" }}>
      <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(2.2rem, 6vw, 3.6rem)", lineHeight: 1, margin: 0, textTransform: "uppercase" }}>Black Friday stats</h1>
        <div style={{ height: 8, width: 100, background: MAGENTA, margin: "10px 0 8px" }} />
        <p style={{ fontSize: 15, color: "#555", fontWeight: 500, margin: "0 0 20px" }}>
          Updated {stamp}, and it refreshes itself every minute. Your own visits while you are logged in are not counted.{" "}
          <button onClick={() => void load()} style={{ fontFamily: font, fontWeight: 800, background: "#000", color: MAGENTA, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Refresh</button>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 28 }}>
          {tiles.map(([l, v], i) => (
            <div key={l} style={{ background: i % 2 === 0 ? "#000" : MAGENTA, color: i % 2 === 0 ? MAGENTA : "#000", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 1 }}>{v}</div>
              <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontWeight: 900, fontSize: 26, textTransform: "uppercase", margin: "0 0 8px" }}>Which offer they looked at</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
          <thead><tr><th style={th}>Offer</th><th style={th}>People who looked</th><th style={th}>WhatsApp taps</th></tr></thead>
          <tbody>
            {data.byOffer.length === 0 && <tr><td style={td} colSpan={3}>Nothing yet.</td></tr>}
            {data.byOffer.sort((a, b) => b.looked - a.looked).map((o) => (
              <tr key={o.offer}><td style={td}>{OFFER_NAMES[o.offer] || o.offer}</td><td style={td}>{o.looked}</td><td style={td}>{o.clicks}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontWeight: 900, fontSize: 26, textTransform: "uppercase", margin: "0 0 8px" }}>Where they came from</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
          <thead><tr><th style={th}>Group</th><th style={th}>People who opened it</th><th style={th}>WhatsApp taps</th></tr></thead>
          <tbody>
            {data.bySrc.length === 0 && <tr><td style={td} colSpan={3}>Nothing yet.</td></tr>}
            {data.bySrc.map((s) => (
              <tr key={s.src}><td style={td}>{SRC_NAMES[s.src] || s.src}</td><td style={td}>{s.visitors}</td><td style={td}>{s.clicks}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontWeight: 900, fontSize: 26, textTransform: "uppercase", margin: "0 0 8px" }}>Day by day</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Day</th><th style={th}>People</th><th style={th}></th><th style={th}>Opens</th><th style={th}>WhatsApp taps</th></tr></thead>
          <tbody>
            {data.byDay.length === 0 && <tr><td style={td} colSpan={5}>Nothing yet.</td></tr>}
            {data.byDay.map((d) => (
              <tr key={d.day}>
                <td style={td}>{new Date(d.day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                <td style={td}>{d.visitors}</td>
                <td style={{ ...td, width: "35%" }}><div style={{ background: MAGENTA, height: 14, borderRadius: 7, width: `${(d.visitors / maxDay) * 100}%` }} /></td>
                <td style={td}>{d.opens}</td>
                <td style={td}>{d.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
