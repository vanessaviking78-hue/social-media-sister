import { useEffect, useMemo, useState } from "react";

// /freehousesales : the 4 commission only Freehouse sales partners, every lead they log, where each one is, and the 20% commission.
// Commission is 20% of the first 3 months' fee at the price agreed (£49 a month, no discount).

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const YEL = "#00e5ff";
// The dashboard has its own password. It is remembered in this browser tab until it is closed.
let PW = "";
const authHeaders = () => ({ "x-sales-password": PW, "Content-Type": "application/json" });
const PW_KEY = "freehouse-sales-pw";

const STAGES = ["Chatting", "Trial sent", "Followed up", "Call booked", "Signed"];
const SHORT = ["Chat", "Trial", "Follow", "Call", "Signed"];
const MONTHS = 3;
const RATE = 0.2;
const FLOOR = 49;
const SLOTS = [1, 2, 3, 4];
const LINK = "https://www.thecybersuite.com/freehousefreebies?ref=";
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Partner = { slot: number; name: string };
type Lead = { id: string; partner: number; lead: string; business: string; handle: string; months: number; price: number; stage: string; paid: boolean; created: string };

const money = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const value = (l: Lead) => l.price * (l.months || MONTHS);
const comm = (l: Lead) => value(l) * RATE;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

function Dashboard() {
  const [partners, setPartners] = useState<Partner[]>(SLOTS.map((slot) => ({ slot, name: "" })));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [tableMsg, setTableMsg] = useState("");
  const [fPartner, setFPartner] = useState("");
  const [fStage, setFStage] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [names, setNames] = useState<Record<number, string>>({});

  const [form, setForm] = useState({ partner: "", lead: "", business: "", handle: "", price: "49", stage: STAGES[0] });
  const [copied, setCopied] = useState(0);

  const load = async () => {
    const r = await fetch(`${BASE}/api/freehousesales/admin/data`, { headers: authHeaders() });
    if (!r.ok) { setTableMsg(r.status === 401 ? "Please log in to your tools first." : "Could not load."); setLoaded(true); return; }
    const d = (await r.json()) as { partners: Partner[]; leads: Lead[] };
    const full = SLOTS.map((slot) => d.partners.find((p) => p.slot === slot) || { slot, name: "" });
    setPartners(full);
    setNames(Object.fromEntries(full.map((p) => [p.slot, p.name])));
    setLeads(d.leads);
    setLoaded(true);
  };
  useEffect(() => { void load(); }, []);

  const nameOf = (slot: number) => partners.find((p) => p.slot === slot)?.name || "";
  const named = partners.filter((p) => p.name);

  useEffect(() => {
    if (!form.partner && named.length) setForm((f) => ({ ...f, partner: String(named[0].slot) }));
  }, [named.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const signed = leads.filter((l) => l.stage === "Signed");
  const totalValue = signed.reduce((s, l) => s + value(l), 0);
  const earned = signed.reduce((s, l) => s + comm(l), 0);
  const paid = signed.filter((l) => l.paid).reduce((s, l) => s + comm(l), 0);
  const inPlay = leads.length - signed.length;

  const stageCounts = STAGES.map((st) => leads.filter((l) => l.stage === st).length);
  const maxCount = Math.max(1, ...stageCounts);

  const shown = useMemo(
    () => leads.filter((l) => (!fPartner || String(l.partner) === fPartner) && (!fStage || l.stage === fStage)),
    [leads, fPartner, fStage],
  );

  const saveName = async (slot: number) => {
    const name = (names[slot] || "").trim();
    if (name === nameOf(slot)) return;
    const r = await fetch(`${BASE}/api/freehousesales/admin/partners/${slot}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ name }) });
    if (!r.ok) setTableMsg("That did not save."); else void load();
  };

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner) { setMsg({ text: "Add a partner name in the cards above first.", bad: true }); return; }
    if (!form.lead.trim() || !form.business.trim()) { setMsg({ text: "Add their name and their business.", bad: true }); return; }
    if (!(Number(form.price) > 0)) { setMsg({ text: "Add the price a month.", bad: true }); return; }
    const r = await fetch(`${BASE}/api/freehousesales/admin/leads`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ partner: Number(form.partner), lead: form.lead, business: form.business, handle: form.handle, months: MONTHS, price: Number(form.price), stage: form.stage }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; by?: string; at?: string };
    if (r.status === 409) { setMsg({ text: `Already logged by ${d.by} on ${shortDate(d.at || "")}. The first person to log a lead keeps it.`, bad: true }); return; }
    if (!r.ok) { setMsg({ text: d.error || "That did not save.", bad: true }); return; }
    setMsg({ text: `${form.lead} added for ${nameOf(Number(form.partner))}.`, bad: false });
    setForm((f) => ({ ...f, lead: "", business: "", handle: "" }));
    void load();
  };

  const patch = async (id: string, body: object) => {
    const r = await fetch(`${BASE}/api/freehousesales/admin/leads/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
    if (!r.ok) setTableMsg("That did not save.");
    void load();
  };
  const remove = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId("");
    await fetch(`${BASE}/api/freehousesales/admin/leads/${id}`, { method: "DELETE", headers: authHeaders() });
    void load();
  };
  const copyLink = async (slot: number, name: string) => {
    try { await navigator.clipboard.writeText(LINK + slug(name)); setCopied(slot); setTimeout(() => setCopied(0), 1800); } catch { /* ignore */ }
  };

  const input = "border-2 border-black p-2 bg-white w-full";
  const lab = "flex flex-col gap-1 text-sm text-neutral-600";

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-3xl font-black uppercase px-3 py-1" style={{ background: YEL }}>Freehouse Socials Sales</h1>
      </div>
      <p className="text-neutral-600 mb-3">Every lead, every stage and every pound of commission, per partner.</p>
      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        {["Sell at £49 a month", "Free 5 day trial first", "Commission 20% of the first 3 months", "Paid the day I am paid"].map((t) => (
          <span key={t} className="px-3 py-1 rounded-full" style={{ background: YEL }}>{t}</span>
        ))}
      </div>

      <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {[
          { lab: "First 3 months signed", num: money(totalValue), hint: `${signed.length} sign up${signed.length === 1 ? "" : "s"}` },
          { lab: "Commission earned", num: money(earned), hint: "20% of the first 3 months", hot: true },
          { lab: "Commission still to pay", num: money(earned - paid), hint: `${money(paid)} already paid` },
          { lab: "Leads in play", num: String(inPlay), hint: "Not signed yet" },
        ].map((t) => (
          <div key={t.lab} className="border-2 border-black p-4" style={t.hot ? { background: "#000", color: "#fff" } : undefined}>
            <div className="text-sm" style={{ color: t.hot ? "#ddd" : "#666" }}>{t.lab}</div>
            <div className="text-3xl font-black" style={{ color: t.hot ? YEL : "#000" }}>{t.num}</div>
            <div className="text-xs" style={{ color: t.hot ? "#ccc" : "#666" }}>{t.hint}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-black uppercase mb-2">Partners</h2>
      <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {SLOTS.map((slot) => {
          const name = nameOf(slot);
          const mine = leads.filter((l) => l.partner === slot);
          const sg = mine.filter((l) => l.stage === "Signed");
          const e = sg.reduce((s, l) => s + comm(l), 0);
          const p = sg.filter((l) => l.paid).reduce((s, l) => s + comm(l), 0);
          return (
            <div key={slot} className="border-2 border-black p-3 flex flex-col gap-3" style={name ? undefined : { borderStyle: "dashed", background: "#fafafa" }}>
              <input
                className="font-black text-lg border-b-2 border-transparent focus:border-black outline-none bg-transparent"
                placeholder={`Partner ${slot} name`}
                aria-label={`Name of partner ${slot}`}
                value={names[slot] ?? ""}
                onChange={(ev) => setNames((n) => ({ ...n, [slot]: ev.target.value }))}
                onBlur={() => void saveName(slot)}
              />
              {!name ? (
                <div className="text-sm text-neutral-500">Open slot. Type a name to add a partner.</div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {STAGES.map((st, i) => (
                      <div key={st} className="py-1" style={{ background: st === "Signed" ? YEL : "#f3f3f3" }}>
                        <div className="font-bold">{mine.filter((l) => l.stage === st).length}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>{SHORT[i]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-baseline text-sm"><span>Commission earned</span><b className="text-lg">{money(e)}</b></div>
                  <div className="flex justify-between items-baseline text-sm"><span>Still to pay</span><b className="text-lg">{money(e - p)}</b></div>
                  <button type="button" className="px-2 py-1 border-2 border-black text-xs font-bold" style={{ background: copied === slot ? YEL : "#fff" }} onClick={() => void copyLink(slot, name)}>
                    {copied === slot ? "Link copied" : "Copy their trial link"}
                  </button>
                  <div className="text-xs text-neutral-500 break-all">...freehousefreebies?ref={slug(name)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="text-xl font-black uppercase mb-2">Where every lead is right now</h2>
      <div className="flex flex-col gap-2 mb-8">
        {STAGES.map((st, i) => (
          <div key={st} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: "110px 1fr 34px" }}>
            <span>{st}</span>
            <div style={{ background: "#f3f3f3", height: 18 }}>
              <div style={{ width: `${(stageCounts[i] / maxCount) * 100}%`, minWidth: 2, height: "100%", background: st === "Signed" ? YEL : "#000" }} />
            </div>
            <b className="text-right">{stageCounts[i]}</b>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-black uppercase mb-2">Log a lead</h2>
      <form onSubmit={addLead} className="grid gap-3 border-2 border-black p-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end" }}>
        <label className={lab}>Partner
          <select className={input} value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })}>
            {named.length === 0 && <option value="">Add a partner name first</option>}
            {named.map((p) => <option key={p.slot} value={p.slot}>{p.name}</option>)}
          </select>
        </label>
        <label className={lab}>Their name<input className={input} placeholder="Dave Smith" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} /></label>
        <label className={lab}>Business<input className={input} placeholder="The Red Lion" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} /></label>
        <label className={lab}>Instagram handle<input className={input} placeholder="@theredlionpub" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} /></label>
        <label className={lab}>Price a month (£)<input className={input} type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label className={lab}>Stage
          <select className={input} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button type="submit" className="px-4 py-2 font-bold border-2 border-black" style={{ background: YEL, minHeight: 42 }}>Add lead</button>
      </form>
      {msg && <div className="mt-2 text-sm" style={{ color: msg.bad ? "#b3261e" : "#14804a" }} role="status">{msg.text}</div>}

      <h2 className="text-xl font-black uppercase mt-8 mb-2">All leads</h2>
      <div className="flex flex-wrap gap-3 items-end mb-3">
        <label className={lab}>Partner
          <select className={input} value={fPartner} onChange={(e) => setFPartner(e.target.value)}>
            <option value="">All partners</option>
            {named.map((p) => <option key={p.slot} value={p.slot}>{p.name}</option>)}
          </select>
        </label>
        <label className={lab}>Stage
          <select className={input} value={fStage} onChange={(e) => setFStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div style={{ overflowX: "auto" }} className="border-2 border-black">
        <table className="w-full text-sm" style={{ minWidth: 780 }}>
          <thead>
            <tr className="bg-black text-white text-left">
              <th className="p-2">Partner</th><th className="p-2">Lead</th>
              <th className="p-2 text-right">Per month</th><th className="p-2 text-right">First 3 months</th><th className="p-2 text-right">Commission</th>
              <th className="p-2">Stage</th><th className="p-2">Paid</th><th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const isSigned = l.stage === "Signed";
              return (
                <tr key={l.id} className="border-t border-black align-top">
                  <td className="p-2">{nameOf(l.partner) || "Unassigned"}</td>
                  <td className="p-2 font-bold">{l.lead}<div className="font-normal text-xs text-neutral-500">{[l.business, l.handle, shortDate(l.created)].filter(Boolean).join(" · ")}</div></td>
                  <td className="p-2 text-right">{money(l.price)}{l.price < FLOOR && <div><span className="px-2 rounded-full text-xs" style={{ background: "#fff1dc", color: "#a85d00" }}>Needs approval</span></div>}</td>
                  <td className="p-2 text-right">{money(value(l))}</td>
                  <td className="p-2 text-right">{isSigned ? <b>{money(comm(l))}</b> : <span className="text-neutral-500">{money(comm(l))} if signed</span>}</td>
                  <td className="p-2">
                    <select className="border-2 border-black p-1 bg-white" value={l.stage} aria-label={`Stage for ${l.lead}`} onChange={(e) => void patch(l.id, { stage: e.target.value })}>
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input type="checkbox" checked={l.paid} disabled={!isSigned} aria-label={`Commission paid for ${l.lead}`} onChange={(e) => void patch(l.id, { paid: e.target.checked })} /></td>
                  <td className="p-2"><button className="px-2 py-1 border-2 border-black text-xs" onClick={() => void remove(l.id)}>{confirmId === l.id ? "Sure?" : "Remove"}</button></td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td className="p-4 text-neutral-500 text-center" colSpan={8}>{loaded ? "No leads here yet. Log the first one above." : "Loading leads"}</td></tr>}
          </tbody>
        </table>
      </div>
      {tableMsg && <div className="mt-2 text-sm" style={{ color: "#b3261e" }} role="status">{tableMsg}</div>}
    </div>
  );
}

export default function FreehouseSalesGate() {
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const verify = async (candidate: string) => {
    try {
      const r = await fetch(`${BASE}/api/freehousesales/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: candidate }) });
      return r.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      let saved = "";
      try { saved = sessionStorage.getItem(PW_KEY) || localStorage.getItem("cybersuite-pw") || ""; } catch { /* ignore */ }
      if (saved && (await verify(saved))) { PW = saved; setOk(true); }
      setChecking(false);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verify(pw)) {
      PW = pw.trim();
      try { sessionStorage.setItem(PW_KEY, PW); } catch { /* ignore */ }
      setOk(true);
    } else {
      setErr("That password is not right. Try again.");
    }
  };

  if (ok) return <Dashboard />;
  if (checking) return <div className="min-h-screen bg-white" />;
  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4 border-2 border-black p-6">
        <h1 className="text-3xl font-black uppercase px-3 py-1 self-start" style={{ background: YEL }}>Freehouse Socials Sales</h1>
        <label className="flex flex-col gap-1 text-sm text-neutral-600" htmlFor="freehouse-pw">
          Password
          <input id="freehouse-pw" type="password" autoFocus className="border-2 border-black p-2 bg-white text-black" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
        </label>
        {err && <div className="text-sm" style={{ color: "#b3261e" }} role="alert">{err}</div>}
        <button type="submit" className="px-4 py-2 font-bold border-2 border-black" style={{ background: YEL, minHeight: 42 }}>Open dashboard</button>
      </form>
    </div>
  );
}
