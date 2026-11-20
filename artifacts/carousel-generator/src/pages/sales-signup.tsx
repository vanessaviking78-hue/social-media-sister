import { useEffect, useRef, useState } from "react";

// cybersuite.com/signup?ref=kelly : the sign up page each sales partner sends their leads to. The ref is the partner's first name.
// It reports an "open" when the link is opened and a "start" when the person first types, then logs the sign up on the sales dashboard.

const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

try {
  const r0 = new URLSearchParams(window.location.search).get("ref");
  if (r0) sessionStorage.setItem("sales-ref", r0);
} catch { /* ignore */ }

const getRef = () => {
  try { return new URLSearchParams(window.location.search).get("ref") || sessionStorage.getItem("sales-ref") || ""; } catch { return ""; }
};
const visitorId = () => {
  try {
    let v = localStorage.getItem("sales-visitor");
    if (!v) { v = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); localStorage.setItem("sales-visitor", v); }
    return v;
  } catch { return ""; }
};

export default function SalesSignup() {
  const [f, setF] = useState({ name: "", clinic: "", handle: "", contact: "", package: "12" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const track = (kind: "open" | "start") => {
    fetch(`${BASE}/api/sales/hit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ref: getRef(), visitor: visitorId() }) }).catch(() => undefined);
  };
  useEffect(() => { document.title = "Sign up | Social Media Sister"; track("open"); }, []);

  const set = (k: keyof typeof f, v: string) => {
    if (!started.current) { started.current = true; track("start"); }
    setF((p) => ({ ...p, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/sales/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, package: Number(f.package), ref: getRef() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = "border-2 border-black p-3 bg-white w-full text-base";
  const lab = "flex flex-col gap-1 text-sm text-neutral-700 font-bold";

  return (
    <div className="min-h-screen bg-white text-black flex items-start justify-center p-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');`}</style>
      <div className="w-full max-w-lg mt-6">
        <h1 style={{ fontFamily: "'League Spartan', sans-serif", fontWeight: 900, color: PINK, lineHeight: 0.95 }} className="text-5xl uppercase mb-3">Sign up</h1>
        <p className="mb-5 text-neutral-700">Social Media Sister. Choose your package and pop your details in. Vanessa will be in touch with your contract and payment details.</p>
        {done ? (
          <div className="border-2 border-black p-5" role="status">
            <div className="text-2xl font-black uppercase mb-2" style={{ color: PINK }}>You are in</div>
            <p>Thank you. Vanessa has your details and will message you very soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 border-2 border-black p-5">
            <label className={lab}>Your name<input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></label>
            <label className={lab}>Clinic name<input className={input} value={f.clinic} onChange={(e) => set("clinic", e.target.value)} /></label>
            <label className={lab}>Instagram handle<input className={input} placeholder="@yourclinic" value={f.handle} onChange={(e) => set("handle", e.target.value)} /></label>
            <label className={lab}>Email or WhatsApp number<input className={input} value={f.contact} onChange={(e) => set("contact", e.target.value)} autoComplete="email" /></label>
            <label className={lab}>Package
              <select className={input} value={f.package} onChange={(e) => set("package", e.target.value)}>
                <option value="12">12 months (pay for 6)</option>
                <option value="6">6 months (pay for 4)</option>
              </select>
            </label>
            {err && <div className="text-sm" style={{ color: "#b3261e" }} role="alert">{err}</div>}
            <button type="submit" disabled={busy} className="px-4 py-3 text-white font-bold uppercase" style={{ background: PINK }}>{busy ? "Sending" : "Sign me up"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
