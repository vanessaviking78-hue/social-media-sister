import { useEffect, useState } from "react";
import { Link } from "wouter";

// /yearpass-admin : Year Pass buyers, the answers they send each month, and the library of extras.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const authHeaders = () => {
  let pw = "";
  try { pw = localStorage.getItem("cybersuite-pw") || ""; } catch { /* ignore */ }
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

type Member = { id: string; token: string; email: string; clinic_name: string; created_at: string };
type MonthRow = { id: number; member_id: string; month_no: number; status: string; clinic_name: string; submitted_at: string | null };
type Detail = { id: number; month_no: number; clinic_name: string; handle: string; area: string; main_hex: string; treatments: string[]; notes: string; photo_url: string; logo_url: string; email: string; token: string; status: string };
type Lib = { id: number; title: string; description: string; url: string; kind: string };

export default function YearPassAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [lib, setLib] = useState<Lib[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [email, setEmail] = useState("");
  const [clinic, setClinic] = useState("");
  const [lt, setLt] = useState("");
  const [ld, setLd] = useState("");
  const [lu, setLu] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await fetch(`${BASE}/api/yearpass/admin/members`, { headers: authHeaders() });
    if (!r.ok) { setMsg(r.status === 401 ? "Please log in to your tools first." : "Could not load."); return; }
    const d = (await r.json()) as { members: Member[]; months: MonthRow[] };
    setMembers(d.members);
    setMonths(d.months);
    const l = await fetch(`${BASE}/api/yearpass/admin/library`, { headers: authHeaders() });
    if (l.ok) setLib(((await l.json()) as { library: Lib[] }).library);
  };
  useEffect(() => { void load(); }, []);

  const link = (t: string) => `${window.location.origin}/yearpass/${t}`;
  const copy = (t: string) => { void navigator.clipboard.writeText(t); setMsg("Copied."); };

  const open = async (id: number) => {
    const r = await fetch(`${BASE}/api/yearpass/admin/months/${id}`, { headers: authHeaders() });
    if (r.ok) setDetail((await r.json()) as Detail);
  };

  const addMember = async () => {
    const r = await fetch(`${BASE}/api/yearpass/admin/members`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, clinicName: clinic }) });
    const d = (await r.json()) as { link?: string; error?: string };
    if (!r.ok) { setMsg(d.error || "Could not add"); return; }
    setEmail(""); setClinic("");
    if (d.link) { copy(d.link); setMsg("Added. Their portal link is copied."); }
    void load();
  };

  const addLib = async () => {
    const r = await fetch(`${BASE}/api/yearpass/admin/library`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ title: lt, description: ld, url: lu }) });
    const d = (await r.json()) as { error?: string };
    if (!r.ok) { setMsg(d.error || "Could not add"); return; }
    setLt(""); setLd(""); setLu("");
    void load();
  };
  const delLib = async (id: number) => { await fetch(`${BASE}/api/yearpass/admin/library/${id}`, { method: "DELETE", headers: authHeaders() }); void load(); };

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/hub" className="underline">Hub</Link>
        <h1 className="text-3xl font-black uppercase" style={{ color: "#ff1f8e" }}>Year Pass</h1>
      </div>
      {msg && <div className="mb-4 p-3 border-2 border-black">{msg}</div>}

      <h2 className="text-xl font-black uppercase mt-4 mb-2">Buyers</h2>
      <table className="w-full text-sm border-2 border-black">
        <thead><tr className="bg-black text-white text-left"><th className="p-2">Clinic</th><th className="p-2">Email</th><th className="p-2">Months</th><th className="p-2">Portal link</th></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-black align-top">
              <td className="p-2 font-bold">{m.clinic_name || "Not told me yet"}</td>
              <td className="p-2">{m.email}</td>
              <td className="p-2">
                {months.filter((x) => x.member_id === m.id).length === 0 && <span className="text-neutral-500">None sent</span>}
                {months.filter((x) => x.member_id === m.id).map((x) => (
                  <button key={x.id} onClick={() => open(x.id)} className="mr-2 mb-1 px-2 py-1 border-2" style={{ borderColor: x.status === "published" ? "#000" : "#ff1f8e", background: x.status === "published" ? "#fff" : "#ff1f8e", color: x.status === "published" ? "#000" : "#fff" }}>
                    Month {x.month_no}{x.status === "published" ? " done" : " to build"}
                  </button>
                ))}
              </td>
              <td className="p-2"><button className="underline" onClick={() => copy(link(m.token))}>Copy link</button></td>
            </tr>
          ))}
          {members.length === 0 && <tr><td className="p-3 text-neutral-500" colSpan={4}>No buyers yet.</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="mt-6 border-2 border-black p-4">
          <div className="flex justify-between">
            <h3 className="text-lg font-black uppercase">{detail.clinic_name} · month {detail.month_no} ({detail.status})</h3>
            <button className="underline" onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1 text-sm">
              <div><b>Email:</b> {detail.email}</div>
              <div><b>Instagram:</b> {detail.handle ? `@${detail.handle}` : "none given"}</div>
              <div><b>Area:</b> {detail.area || "none given"}</div>
              <div><b>Brand colour:</b> <span style={{ background: detail.main_hex, display: "inline-block", width: 18, height: 18, verticalAlign: "middle", border: "1px solid #000" }} /> {detail.main_hex}</div>
              <div><b>Treatments:</b> {detail.treatments.join(", ")}</div>
              <div><b>Notes:</b> {detail.notes || "none"}</div>
              <div className="pt-2">
                <a className="inline-block px-3 py-2 text-white font-bold" style={{ background: "#ff1f8e" }} href={`${BASE}/month-planner?yp=${detail.id}`}>Open in the Month tool</a>
              </div>
              <p className="text-neutral-600 pt-2">Set them up as a client with their photo and logo, build and check the 20 posts in Month, tick them, choose this month in the Year Pass box at the bottom and press Send to Year Pass portal.</p>
            </div>
            <div className="flex gap-3">
              {detail.photo_url && <a href={detail.photo_url} target="_blank" rel="noreferrer" download><img src={detail.photo_url} alt="Their photo" className="h-56 w-auto border-2 border-black" /></a>}
              {detail.logo_url && <a href={detail.logo_url} target="_blank" rel="noreferrer" download><img src={detail.logo_url} alt="Their logo" className="h-24 w-auto border-2 border-black bg-neutral-200 p-1" /></a>}
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-black uppercase mt-8 mb-2">Add a buyer by hand</h2>
      <p className="text-sm text-neutral-600 mb-2">For bank transfer buyers, or anyone who paid outside Stripe.</p>
      <div className="flex flex-wrap gap-2">
        <input className="border-2 border-black p-2" placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border-2 border-black p-2" placeholder="Clinic name" value={clinic} onChange={(e) => setClinic(e.target.value)} />
        <button className="px-4 py-2 text-white font-bold" style={{ background: "#ff1f8e" }} onClick={addMember}>Make their portal link</button>
      </div>

      <h2 className="text-xl font-black uppercase mt-8 mb-2">Library (shown to every buyer)</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <input className="border-2 border-black p-2" placeholder="Title" value={lt} onChange={(e) => setLt(e.target.value)} />
        <input className="border-2 border-black p-2" placeholder="Short line about it" value={ld} onChange={(e) => setLd(e.target.value)} />
        <input className="border-2 border-black p-2" placeholder="Link or file address" value={lu} onChange={(e) => setLu(e.target.value)} />
        <button className="px-4 py-2 text-white font-bold" style={{ background: "#ff1f8e" }} onClick={addLib}>Add</button>
      </div>
      {lib.map((l) => (
        <div key={l.id} className="flex justify-between border-b border-neutral-300 py-2">
          <div><b>{l.title}</b> <span className="text-neutral-500">{l.description}</span><div className="text-xs text-neutral-500">{l.url}</div></div>
          <button className="underline" onClick={() => delLib(l.id)}>Remove</button>
        </div>
      ))}
      {lib.length === 0 && <p className="text-neutral-500">Nothing in the library yet. Add your Stan Store items above.</p>}
    </div>
  );
}
