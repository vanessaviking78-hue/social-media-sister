import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

type Row = {
  id: string; email: string; status: string; clinicName: string; clinicianName: string; handle: string; area: string; whatsapp: string;
  answers?: { bizType?: string }; notes: string; slug: string; code: string; createdAt: string; sentAt: string | null;
};

const link = (slug: string) => `${window.location.origin}${BASE}/10free/${slug}`;
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS: Record<string, string> = { new: "Waiting to build", published: "Built", declined: "Declined" };

export default function TenFreeTracker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const load = useCallback(async () => {
    const r = await fetch(`${API}/ten-free/requests`, { headers: authHeaders() });
    const j = await r.json().catch(() => ({}));
    setRows(j.requests ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { document.title = "10 free posts tracker"; load(); }, [load]);

  const setSent = async (id: string, sent: boolean) => {
    await fetch(`${API}/ten-free/requests/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ sent }) });
    load();
  };
  const saveNote = async (id: string, notes: string) => {
    await fetch(`${API}/ten-free/requests/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ notes }) });
    toast.success("Note saved");
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Could not copy"); }
  };

  const counts = useMemo(() => ({
    all: rows.length,
    waiting: rows.filter((r) => r.status === "new").length,
    built: rows.filter((r) => r.status === "published" && !r.sentAt).length,
    sent: rows.filter((r) => !!r.sentAt).length,
  }), [rows]);

  const shown = rows.filter((r) => {
    if (show === "waiting" && r.status !== "new") return false;
    if (show === "built" && !(r.status === "published" && !r.sentAt)) return false;
    if (show === "sent" && !r.sentAt) return false;
    const t = `${r.clinicName} ${r.clinicianName} ${r.email} ${r.area} ${r.handle}`.toLowerCase();
    return !q || t.includes(q.toLowerCase());
  });

  const waLink = (r: Row) => {
    const num = r.whatsapp.replace(/[^0-9]/g, "").replace(/^0/, "44");
    if (!num) return "";
    const msg = `Hi ${r.clinicianName.split(" ")[0]}, your 10 free posts are ready: ${link(r.slug)}  Your code is ${r.code}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">10 free posts tracker</h1>
        <Link href="/10free-admin" className="text-sm underline">Back to the requests</Link>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {([["all", `All ${counts.all}`], ["waiting", `Waiting to build ${counts.waiting}`], ["built", `Built, not sent ${counts.built}`], ["sent", `Sent ${counts.sent}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setShow(k)} className={`px-3 py-1 rounded-full border ${show === k ? "bg-pink-500 text-white border-pink-500" : ""}`}>{label}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clinic, name, email, area" className="flex-1 min-w-[200px] border rounded px-3 py-1" />
      </div>
      {loading && <p>Loading...</p>}
      {!loading && shown.length === 0 && <p>Nothing here yet.</p>}
      <div className="space-y-3">
        {shown.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{r.clinicName}{r.answers?.bizType === "Academy" ? " (Academy)" : ""} <span className="text-xs uppercase text-pink-500">{r.sentAt ? "Sent" : STATUS[r.status] ?? r.status}</span></div>
                <div className="text-sm text-muted-foreground">{r.clinicianName} · {r.area} · asked {day(r.createdAt)}{r.sentAt ? ` · sent ${day(r.sentAt)}` : ""}</div>
                <div className="text-sm text-muted-foreground">{r.email}{r.whatsapp ? ` · ${r.whatsapp}` : ""}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href={`/10free-admin?id=${r.id}`} className="px-3 py-1 rounded bg-pink-500 text-white">{r.status === "published" ? "Open" : "Build"}</Link>
                {r.status === "published" && r.slug && (
                  <>
                    <button className="px-3 py-1 rounded border" onClick={() => copy(link(r.slug), "Link")}>Copy link</button>
                    <button className="px-3 py-1 rounded border" onClick={() => copy(r.code, "Code")}>Copy code {r.code}</button>
                    {waLink(r) && <a className="px-3 py-1 rounded border" href={waLink(r)} target="_blank" rel="noreferrer">WhatsApp</a>}
                    <button className="px-3 py-1 rounded border" onClick={() => setSent(r.id, !r.sentAt)}>{r.sentAt ? "Mark as not sent" : "Mark as sent"}</button>
                  </>
                )}
              </div>
            </div>
            <input defaultValue={r.notes} placeholder="Notes" onBlur={(e) => e.target.value !== r.notes && saveNote(r.id, e.target.value)} className="w-full border rounded px-3 py-1 text-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
