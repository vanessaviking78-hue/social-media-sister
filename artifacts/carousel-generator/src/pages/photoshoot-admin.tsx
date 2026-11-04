import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PS_CSS } from "@/pages/photoshoot";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const H = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};
type Row = { id: string; clinic_name: string; email: string; scrub_colour: string; status: string; note: string; done: number; created_at: string };
type Img = { n: number; kind: string; label: string; url: string };

export default function PhotoshootAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string>("");
  const [order, setOrder] = useState<{ images: Img[]; token: string; status: string; email: string; clinic_name: string } | null>(null);
  const loadList = useCallback(() => fetch(`${API}/photoshoot/orders`, { headers: H() }).then((r) => r.json()).then((j) => setRows(j.orders || [])), []);
  const loadOne = useCallback((id: string) => fetch(`${API}/photoshoot/orders/${id}`, { headers: H() }).then((r) => r.json()).then((j) => setOrder(j.order || null)), []);
  useEffect(() => { loadList(); const t = setInterval(() => { loadList(); if (open) loadOne(open); }, 15000); return () => clearInterval(t); }, [loadList, loadOne, open]);
  const link = (t: string) => `${window.location.origin}${BASE}/photos/${t}`;
  const act = async (url: string, method = "POST", body?: unknown) => {
    const r = await fetch(`${API}${url}`, { method, headers: H(), body: body ? JSON.stringify(body) : undefined });
    return r.json().catch(() => ({}));
  };
  return (
    <div className="ps"><style>{PS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">AI Photo Studio</div>
        <h1 className="ps-h1">Orders to <span>review</span></h1>
        {rows.map((r) => (
          <div key={r.id} className="ps-card" style={{ marginTop: 12, cursor: "pointer" }} onClick={() => { setOpen(r.id); loadOne(r.id); }}>
            <div style={{ fontSize: 22 }}>{r.clinic_name} <span style={{ color: "#ff1f8e" }}>{r.status}</span></div>
            <div style={{ color: "#555", fontSize: 15 }}>{r.done} of 20 made, {r.scrub_colour} scrubs, {r.email} {r.note && `(${r.note})`}</div>
          </div>
        ))}
        {order && open && (
          <div className="ps-card">
            <div style={{ fontSize: 22 }}>{order.clinic_name}</div>
            <button className="ps-btn alt" onClick={async () => { await act(`/photoshoot/orders/${open}/make`); toast.success("Making the missing ones"); }}>Make missing</button>
            <button className="ps-btn" onClick={async () => { const r = await act(`/photoshoot/orders/${open}/approve`); await navigator.clipboard.writeText(link(order.token)).catch(() => undefined); toast.success(`Approved. Link copied. Email it to ${r.email || "them"}`); loadOne(open); loadList(); }}>Approve and copy link</button>
            <div className="ps-grid">
              {(order.images || []).map((im) => (
                <div key={im.n}>
                  <img src={`${BASE}${im.url}`} alt={im.label} />
                  <div style={{ fontSize: 13, color: "#555" }}>{im.n}. {im.label}</div>
                  <button className="ps-btn alt" style={{ padding: "6px 10px", fontSize: 11 }} onClick={async () => { await act(`/photoshoot/orders/${open}/images/${im.n}`, "DELETE"); await act(`/photoshoot/orders/${open}/make`, "POST", { only: [im.n] }); toast.success("Redoing that one"); }}>Redo</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
