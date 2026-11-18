import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PS_CSS } from "@/pages/photoshoot";

// Vanessa's inbox for the CYBERSUITE CHRISTMAS SHOOT. Check Monzo, tick payment seen, press Create images, send the link.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const H = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};
type Row = {
  id: string; name: string; email: string; phone: string; colour: string; code: string; label: string;
  pay_state: string; status: string; note: string; slug: string | null; link: string; selfie_url: string; done: number; created_at: string; expires_at: string | null;
};
type Img = { n: number; label: string; url: string };

const wa = (phone: string) => {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  return d;
};
const PAY: Record<string, string> = { unpaid: "not paid yet", claimed: "says paid, check Monzo", seen: "payment seen", free: "free code" };

export default function XmasShootAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(10);
  const [sisterLeft, setSisterLeft] = useState(5);
  const [open, setOpen] = useState("");
  const [imgs, setImgs] = useState<Img[]>([]);
  const loadList = useCallback(() => fetch(`${API}/xmasshoot/orders`, { headers: H() }).then((r) => r.json()).then((j) => { setRows(j.orders || []); setTotal(j.total || 10); setSisterLeft(j.sisterLeft ?? 0); }).catch(() => undefined), []);
  const loadOne = useCallback((id: string) => fetch(`${API}/xmasshoot/orders/${id}`, { headers: H() }).then((r) => r.json()).then((j) => setImgs(j.order?.images || [])).catch(() => undefined), []);
  useEffect(() => { loadList(); const t = setInterval(() => { loadList(); if (open) loadOne(open); }, 10000); return () => clearInterval(t); }, [loadList, loadOne, open]);
  const act = async (url: string, method = "POST", body?: unknown) => {
    const r = await fetch(`${API}${url}`, { method, headers: H(), body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, ...(await r.json().catch(() => ({}))) } as { ok: boolean; link?: string; error?: string };
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Link copied")).catch(() => toast.error("Could not copy"));
  const msgFor = (r: Row, link: string) => `Hi ${r.name.split(" ")[0]}, your CYBERSUITE CHRISTMAS SHOOT is ready! Your private link is ${link} and it stays live for 30 days, so download them all. I hope you love them.`;

  return (
    <div className="ps"><style>{PS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">CYBERSUITE CHRISTMAS SHOOT</div>
        <h1 className="ps-h1">Christmas shoot <span>inbox</span></h1>
        <p className="ps-p">SISTER spaces left: {sisterLeft} of 5</p>
        {rows.length === 0 && <p className="ps-p">Nobody yet. The first selfie will land here and in your email.</p>}
        {rows.map((r) => {
          const canCreate = r.pay_state === "free" || r.pay_state === "seen";
          const link = r.link;
          const isOpen = open === r.id;
          return (
            <div key={r.id} className="ps-card" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                {r.selfie_url && <img src={`${BASE}${r.selfie_url}`} alt={r.name} style={{ width: 96, height: 128, objectFit: "cover", border: "2px solid #000" }} />}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 24 }}>{r.name} <span style={{ color: "#ff1f8e" }}>{r.status}</span></div>
                  <div style={{ color: "#555", fontSize: 15, marginTop: 4 }}>
                    {r.label}{r.code ? ` (code ${r.code})` : ""}, {PAY[r.pay_state] || r.pay_state}. Colour: {r.colour || "red"}. {r.done} of {total} made. {r.note}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15 }}>
                    <a href={`https://wa.me/${wa(r.phone)}`} target="_blank" rel="noreferrer" style={{ color: "#000" }}>WhatsApp {r.phone}</a>{"  "}
                    <a href={`mailto:${r.email}`} style={{ color: "#000" }}>{r.email}</a>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {r.pay_state !== "free" && (
                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginRight: 16, fontSize: 15 }}>
                    <input type="checkbox" checked={r.pay_state === "seen"} onChange={async (e) => { await act(`/xmasshoot/orders/${r.id}/payment-seen`, "POST", { seen: e.target.checked }); loadList(); }} style={{ width: 22, height: 22 }} />
                    Payment seen in Monzo
                  </label>
                )}
                {r.status === "waiting" || r.status === "failed" ? (
                  <button className="ps-btn" disabled={!canCreate} onClick={async () => { const x = await act(`/xmasshoot/orders/${r.id}/create`); if (!x.ok) { toast.error(x.error || "Could not start"); return; } toast.success("Making the ten images"); setOpen(r.id); loadList(); }}>Create images</button>
                ) : (
                  <button className="ps-btn alt" onClick={() => { setOpen(isOpen ? "" : r.id); if (!isOpen) loadOne(r.id); }}>{isOpen ? "Hide images" : "See images"}</button>
                )}
                {link && <>
                  <button className="ps-btn alt" onClick={() => copy(link)}>Copy link</button>
                  <a className="ps-btn alt" href={`https://wa.me/${wa(r.phone)}?text=${encodeURIComponent(msgFor(r, link))}`} target="_blank" rel="noreferrer">WhatsApp it</a>
                  <a className="ps-btn alt" href={`mailto:${r.email}?subject=${encodeURIComponent("Your CYBERSUITE CHRISTMAS SHOOT")}&body=${encodeURIComponent(msgFor(r, link))}`}>Email it</a>
                </>}
                {link && <div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>{link}{r.expires_at ? `, live until ${new Date(r.expires_at).toLocaleDateString("en-GB")}` : ""}</div>}
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <button className="ps-btn alt" onClick={async () => { await act(`/xmasshoot/orders/${r.id}/make`); toast.success("Making the missing ones"); }}>Make missing</button>
                  <div className="ps-grid">
                    {imgs.map((im) => (
                      <div key={im.n}>
                        <img src={`${BASE}${im.url}`} alt={im.label} />
                        <div style={{ fontSize: 13, color: "#555" }}>{im.n}. {im.label}</div>
                        <button className="ps-btn alt" style={{ padding: "6px 10px", fontSize: 11 }} onClick={async () => { await act(`/xmasshoot/orders/${r.id}/images/${im.n}`, "DELETE"); await act(`/xmasshoot/orders/${r.id}/make`, "POST", { only: [im.n] }); toast.success("Redoing that one"); }}>Redo</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
