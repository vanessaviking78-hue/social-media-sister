import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

// /salesdashboard : the commission only sales partners, every lead they log, where each one is, and the 25% commission.
// Room for 5 partners. A 6 month package is the price of 4 months, a 12 month package is the price of 6 months.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const PINK = "#ff1f8e";
const authHeaders = () => {
  let pw = "";
  try { pw = localStorage.getItem("cybersuite-pw") || ""; } catch { /* ignore */ }
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

const STAGES = ["Chatting", "Freebies sent", "Followed up", "Call booked", "Signed"];
const SHORT = ["Chat", "Free", "Follow", "Call", "Signed"];
const MONTHS_PAID: Record<number, number> = { 6: 4, 12: 6 };
const RATE = 0.25;
const FLOOR = 350;
const SLOTS = [1, 2, 3, 4, 5];

type Partner = { slot: number; name: string };
type Lead = { id: string; partner: number; lead: string; clinic: string; handle: string; package: number; price: number; stage: string; test: boolean; paid: boolean; created: string };

const money = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const value = (l: Lead) => l.price * (MONTHS_PAID[l.package] || 0);
const comm = (l: Lead) => value(l) * RATE;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function SalesDashboard() {
  const [partners, setPartners] = useState<Partner[]>(SLOTS.map((slot) => ({ slot, name: "" })));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [tableMsg, setTableMsg] = useState("");
  const [fPartner, setFPartner] = useState("");
  const [fStage, setFStage] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [names, setNames] = useState<Record<number, string>>({});

  const [form, setForm] = useState({ partner: "", lead: "", clinic: "", handle: "", package: "6", price: "500", stage: STAGES[0] });

  const load = async () => {
    const r = await fetch(`${BASE}/api/sales/admin/data`, { headers: authHeaders() });
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
    const r = await fetch(`${BASE}/api/sales/admin/partners/${slot}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ name }) });
    if (!r.ok) setTableMsg("That did not save."); else void load();
  };

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner) { setMsg({ text: "Add a partner name in the cards above first.", bad: true }); return; }
    if (!form.lead.trim() || !form.clinic.trim()) { setMsg({ text: "Add their name and their clinic.", bad: true }); return; }
    if (!(Number(form.price) > 0)) { setMsg({ text: "Add the price a month.", bad: true }); return; }
    const r = await fetch(`${BASE}/api/sales/admin/leads`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ partner: Number(form.partner), lead: form.lead, clinic: form.clinic, handle: form.handle, package: Number(form.package), price: Number(form.price), stage: form.stage }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; by?: string; at?: string };
    if (r.status === 409) { setMsg({ text: `Already logged by ${d.by} on ${shortDate(d.at || "")}. The first person to log a lead keeps it.`, bad: true }); return; }
    if (!r.ok) { setMsg({ text: d.error || "That did not save.", bad: true }); return; }
    setMsg({ text: `${form.lead} added for ${nameOf(Number(form.partner))}.`, bad: false });
    setForm((f) => ({ ...f, lead: "", clinic: "", handle: "" }));
    void load();
  };

  const patch = async (id: string, body: object) => {
    const r = await fetch(`${BASE}/api/sales/admin/leads/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
    if (!r.ok) setTableMsg("That did not save.");
    void load();
  };
  const remove = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId("");
    await fetch(`${BASE}/api/sales/admin/leads/${id}`, { method: "DELETE", headers: authHeaders() });
    void load();
  };
  const removeTests = async () => {
    await fetch(`${BASE}/api/sales/admin/test-leads`, { method: "DELETE", headers: authHeaders() });
    void load();
  };

  const input = "border-2 border-black p-2 bg-white w-full";
  const lab = "flex flex-col gap-1 text-sm text-neutral-600";

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/hub" className="underline">Hub</Link>
        <h1 className="text-3xl font-black uppercase" style={{ color: PINK }}>Sales Dashboard</h1>
      </div>
      <p className="text-neutral-600 mb-3">Every lead, every stage and every pound of commission, per partner.</p>
      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        {["Sell at £500 a month", "Down to £350 to win the deal", "6 months for the price of 4", "12 months for the price of 6", "Commission 25%, paid the day I am paid"].map((t) => (
          <span key={t} className="px-3 py-1 rounded-full" style={{ background: "#ffe3f1" }}>{t}</span>
        ))}
      </div>

      <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {[
          { lab: "Package value signed", num: money(totalValue), hint: `${signed.length} sign up${signed.length === 1 ? "" : "s"}` },
          { lab: "Commission earned", num: money(earned), hint: "25% of package value", hot: true },
          { lab: "Commission still to pay", num: money(earned - paid), hint: `${money(paid)} already paid` },
          { lab: "Leads in play", num: String(inPlay), hint: "Not signed yet" },
        ].map((t) => (
          <div key={t.lab} className="border-2 border-black p-4" style={t.hot ? { background: "#000", color: "#fff" } : undefined}>
            <div className="text-sm" style={{ color: t.hot ? "#ddd" : "#666" }}>{t.lab}</div>
            <div className="text-3xl font-black" style={{ color: t.hot ? PINK : "#000" }}>{t.num}</div>
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
                      <div key={st} className="py-1" style={{ background: st === "Signed" ? "#ffe3f1" : "#f3f3f3" }}>
                        <div className="font-bold">{mine.filter((l) => l.stage === st).length}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>{SHORT[i]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-baseline text-sm"><span>Commission earned</span><b className="text-lg" style={{ color: PINK }}>{money(e)}</b></div>
                  <div className="flex justify-between items-baseline text-sm"><span>Still to pay</span><b className="text-lg">{money(e - p)}</b></div>
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
              <div style={{ width: `${(stageCounts[i] / maxCount) * 100}%`, minWidth: 2, height: "100%", background: st === "Signed" ? PINK : "#000" }} />
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
        <label className={lab}>Their name<input className={input} placeholder="Jo Smith" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} /></label>
        <label className={lab}>Clinic<input className={input} placeholder="Glow Aesthetics" value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} /></label>
        <label className={lab}>Instagram handle<input className={input} placeholder="@glowaesthetics" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} /></label>
        <label className={lab}>Package
          <select className={input} value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })}>
            <option value="6">6 months (price of 4)</option>
            <option value="12">12 months (price of 6)</option>
          </select>
        </label>
        <label className={lab}>Price a month (£)<input className={input} type="number" min="0" step="10" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label className={lab}>Stage
          <select className={input} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button type="submit" className="px-4 py-2 text-white font-bold" style={{ background: PINK, minHeight: 42 }}>Add lead</button>
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
        {leads.some((l) => l.test) && <button type="button" className="px-3 py-2 border-2 border-black text-sm" onClick={() => void removeTests()}>Remove test leads</button>}
      </div>
      <div style={{ overflowX: "auto" }} className="border-2 border-black">
        <table className="w-full text-sm" style={{ minWidth: 860 }}>
          <thead>
            <tr className="bg-black text-white text-left">
              <th className="p-2">Partner</th><th className="p-2">Lead</th><th className="p-2">Package</th>
              <th className="p-2 text-right">Per month</th><th className="p-2 text-right">Package value</th><th className="p-2 text-right">Commission</th>
              <th className="p-2">Stage</th><th className="p-2">Paid</th><th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const isSigned = l.stage === "Signed";
              return (
                <tr key={l.id} className="border-t border-black align-top">
                  <td className="p-2">{nameOf(l.partner) || "Unassigned"}{l.test && <span className="ml-2 px-2 rounded-full text-xs" style={{ background: "#eee", color: "#666" }}>Test</span>}</td>
                  <td className="p-2 font-bold">{l.lead}<div className="font-normal text-xs text-neutral-500">{[l.clinic, l.handle, shortDate(l.created)].filter(Boolean).join(" · ")}</div></td>
                  <td className="p-2">{l.package} months</td>
                  <td className="p-2 text-right">{money(l.price)}{l.price < FLOOR && <div><span className="px-2 rounded-full text-xs" style={{ background: "#fff1dc", color: "#a85d00" }}>Needs approval</span></div>}</td>
                  <td className="p-2 text-right">{money(value(l))}</td>
                  <td className="p-2 text-right">{isSigned ? <b style={{ color: PINK }}>{money(comm(l))}</b> : <span className="text-neutral-500">{money(comm(l))} if signed</span>}</td>
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
            {shown.length === 0 && <tr><td className="p-4 text-neutral-500 text-center" colSpan={9}>{loaded ? "No leads here yet. Log the first one above." : "Loading leads"}</td></tr>}
          </tbody>
        </table>
      </div>
      {tableMsg && <div className="mt-2 text-sm" style={{ color: "#b3261e" }} role="status">{tableMsg}</div>}
    </div>
  );
}
