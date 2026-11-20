import { useCallback, useEffect, useState } from "react";

// /linkstats : one page showing what has been opened across Social Media Sister, Hammered and Freehold. White, black and hot pink.
// Needs the tools password (the same one used on the other admin pages).

const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Bf = { visitors: number; taps: number; visitors24: number; taps24: number; lastView: string | null; bySrc: Array<{ src: string; visitors: number; taps: number }>; byOffer: Array<{ offer: string; looked: number; taps: number }> };
type Free = { ref: string; opens: number; started: number; entries: number; lastOpen: string | null; lastEntry: string | null };
type Signup = { name: string; ref: string; opens: number; started: number; signups: number; lastOpen: string | null };
type Data = { sms: Bf; ham: Bf; hamFree: Free[]; freeFree: Free[]; signup: Signup[] };

const OFFER_NAMES: Record<string, string> = {
  "12for6": "12 months for the price of 6", monthly: "£350 a month, tied in", "6for3": "6 months for the price of 3", diy: "DIY from the portal", general: "General question",
  "h-12for6": "12 months for the price of 6", "h-monthly": "£350 a month, tied in", "h-6for3": "6 months for the price of 3", "h-diy": "DIY from the portal", "h-general": "General question",
};

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

const th = "p-2 text-left";
const td = "p-2 border-t border-black";

function Stat({ n, label, dark }: { n: number | string; label: string; dark?: boolean }) {
  return (
    <div className="p-4 flex-1" style={{ minWidth: 140, background: dark ? "#000" : PINK, color: dark ? PINK : "#000" }}>
      <div className="text-4xl font-black leading-none">{n}</div>
      <div className="text-xs uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="border-2 border-black mb-6" style={{ overflowX: "auto" }}>
      <table className="w-full text-sm" style={{ minWidth: 520 }}>
        <thead><tr className="bg-black text-white">{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <div className="p-3 text-neutral-500 text-sm">{empty}</div>}
    </div>
  );
}

function BfBlock({ bf, who }: { bf: Bf; who: string }) {
  return (
    <>
      <h3 className="text-lg font-black uppercase mb-2">{who} Black Friday page</h3>
      <div className="flex gap-3 flex-wrap mb-3">
        <Stat n={bf.visitors} label="People opened it" />
        <Stat n={bf.taps} label="WhatsApp taps" dark />
        <Stat n={bf.visitors24} label="Opened, last 24 hours" />
        <Stat n={bf.taps24} label="Taps, last 24 hours" dark />
      </div>
      <div className="text-xs text-neutral-500 mb-2">Last opened {ago(bf.lastView)}</div>
      <Table head={["Link tag (?src=)", "Opened", "WhatsApp taps"]} empty={bf.bySrc.length ? undefined : "No opens yet."}>
        {bf.bySrc.map((r) => <tr key={r.src}><td className={`${td} font-bold`}>{r.src}</td><td className={td}>{r.visitors}</td><td className={td}>{r.taps}</td></tr>)}
      </Table>
      <Table head={["Offer", "People who looked", "WhatsApp taps"]} empty={bf.byOffer.length ? undefined : "No offers looked at yet."}>
        {bf.byOffer.map((r) => <tr key={r.offer}><td className={`${td} font-bold`}>{OFFER_NAMES[r.offer] || r.offer}</td><td className={td}>{r.looked}</td><td className={td}>{r.taps}</td></tr>)}
      </Table>
    </>
  );
}

function FreeBlock({ rows, who }: { rows: Free[]; who: string }) {
  return (
    <>
      <h3 className="text-lg font-black uppercase mb-2">{who} freebies links</h3>
      <Table head={["Who (?ref=)", "Opened", "Started", "Finished", "Last opened", "Last finished"]} empty={rows.length ? undefined : "Nothing yet."}>
        {rows.map((r) => (
          <tr key={r.ref || "plain"}>
            <td className={`${td} font-bold capitalize`}>{r.ref || "No name"}</td><td className={td}>{r.opens}</td><td className={td}>{r.started}</td><td className={td}>{r.entries}</td>
            <td className={td}>{ago(r.lastOpen)}</td><td className={td}>{ago(r.lastEntry)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

export default function LinkStats() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/linkstats/data`, { headers: authHeaders() });
      if (!r.ok) throw new Error("bad");
      setD(await r.json());
      setErr("");
    } catch {
      setErr("I could not load the numbers. Log in to your tools, then refresh this page.");
    }
  }, []);

  useEffect(() => {
    document.title = "Link stats";
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-5xl mx-auto" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');`}</style>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-4xl font-black uppercase" style={{ color: PINK }}>Link stats</h1>
        <button className="px-3 py-2 border-2 border-black text-sm font-bold" onClick={() => void load()}>Refresh</button>
      </div>
      <p className="text-neutral-600 mb-6">What has been opened across Social Media Sister, Hammered and Freehold. Each person counts once per link, and your own visits when you are logged in are left out of the Black Friday pages.</p>
      {err && <div className="mb-4 p-3" style={{ background: "#fde7e7", color: "#b3261e" }}>{err}</div>}
      {!d && !err && <div className="text-neutral-500">Loading the numbers...</div>}
      {d && (
        <>
          <h2 className="text-2xl font-black uppercase mb-3 px-2 py-1 inline-block" style={{ background: PINK }}>Social Media Sister</h2>
          <BfBlock bf={d.sms} who="Social Media Sister" />
          <h3 className="text-lg font-black uppercase mb-2">Sales partner sign up links</h3>
          <Table head={["Partner", "Opened", "Started", "Signed up", "Last opened"]} empty={d.signup.length ? undefined : "No partners yet."}>
            {d.signup.map((r) => <tr key={r.ref}><td className={`${td} font-bold`}>{r.name}</td><td className={td}>{r.opens}</td><td className={td}>{r.started}</td><td className={td}>{r.signups}</td><td className={td}>{ago(r.lastOpen)}</td></tr>)}
          </Table>

          <h2 className="text-2xl font-black uppercase mb-3 mt-10 px-2 py-1 inline-block" style={{ background: "#ffd600" }}>Hammered</h2>
          <div className="block" />
          <BfBlock bf={d.ham} who="Hammered" />
          <FreeBlock rows={d.hamFree} who="Hammered" />

          <h2 className="text-2xl font-black uppercase mb-3 mt-10 px-2 py-1 inline-block text-white" style={{ background: "#1f6feb" }}>Freehold</h2>
          <div className="block" />
          <FreeBlock rows={d.freeFree} who="Freehold" />
        </>
      )}
    </div>
  );
}
