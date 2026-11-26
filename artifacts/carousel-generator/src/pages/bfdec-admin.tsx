import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PS_CSS } from "@/pages/photoshoot";

// Vanessa's inbox for the DECEMBER BUNDLE. Check Monzo, tick payment seen, upload the 20 posts and 10 photos, publish, send the portal link.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const H = (json = true): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  const h: Record<string, string> = { "x-app-password": pw, Authorization: "Bearer " + pw };
  if (json) h["Content-Type"] = "application/json";
  return h;
};
type Item = { id: string; kind: "post" | "photo"; label: string; url: string };
type Row = {
  id: string; name: string; email: string; phone: string; insta: string; area: string; colours: string; label: string;
  pay_state: string; status: string; note: string; slug: string | null; link: string; photo_url: string; logo_url: string;
  items: Item[]; created_at: string; expires_at: string | null;
};

// Opens a new Gmail message in the vanessa@thecybersuite.com account (not whichever Gmail is signed in first).
const gmail = (to: string, subject = "", body = "") =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent("vanessa@thecybersuite.com")}&view=cm&fs=1&to=${encodeURIComponent(to)}${subject ? `&su=${encodeURIComponent(subject)}` : ""}${body ? `&body=${encodeURIComponent(body)}` : ""}`;

const wa = (phone: string) => {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  return d;
};
const PAY: Record<string, string> = { unpaid: "not paid yet", claimed: "says paid, check Monzo", seen: "payment seen" };

export default function BfDecAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [postsTarget, setPostsTarget] = useState(20);
  const [photosTarget, setPhotosTarget] = useState(10);
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState("");
  const [loadErr, setLoadErr] = useState("");

  const loadList = useCallback(() => fetch(`${API}/bfdec/orders`, { headers: H() }).then(async (r) => {
    if (!r.ok) { setLoadErr(r.status === 401 ? "Your login has expired on this browser, so the list cannot load. Log out from the Hub and log back in with the tools password. Your orders are safe." : `The list could not load (error ${r.status}). Your orders are safe, try again in a minute.`); throw new Error("load"); }
    setLoadErr(""); return r.json();
  }).then((j) => { setRows(j.orders || []); setPostsTarget(j.postsTarget || 20); setPhotosTarget(j.photosTarget || 10); }).catch(() => undefined), []);
  useEffect(() => { loadList(); const t = setInterval(loadList, 10000); return () => clearInterval(t); }, [loadList]);

  const act = async (url: string, method = "POST", body?: unknown) => {
    const r = await fetch(`${API}${url}`, { method, headers: H(), body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, ...(await r.json().catch(() => ({}))) } as { ok: boolean; link?: string; error?: string };
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Link copied")).catch(() => toast.error("Could not copy"));
  const msgFor = (r: Row, link: string) => `Hi ${r.name.split(" ")[0]}, your DECEMBER BUNDLE is ready! Your private portal is ${link} and everything stays there for 90 days, so download it all. I hope you love it.`;

  const addFiles = async (r: Row, kind: "post" | "photo", files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(`${r.id}${kind}`);
    const fd = new FormData();
    fd.append("kind", kind);
    Array.from(files).forEach((f) => fd.append("files", f));
    try {
      const res = await fetch(`${API}/bfdec/orders/${r.id}/items`, { method: "POST", headers: H(false), body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(j.error || "Those did not upload");
      else toast.success(`Added ${files.length} ${kind === "post" ? "post" : "photo"}${files.length === 1 ? "" : "s"}`);
    } catch { toast.error("Those did not upload"); }
    setBusy(""); loadList();
  };

  return (
    <div className="ps"><style>{PS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">DECEMBER BUNDLE</div>
        <h1 className="ps-h1">December Bundle <span>inbox</span></h1>
        <p className="ps-p">Check Monzo, tick payment seen, upload their {postsTarget} posts and {photosTarget} photos, press Publish, then send them their portal link.</p>
        {loadErr && <p className="ps-p" style={{ color: "#e6007e", fontWeight: 800 }}>{loadErr}</p>}
        {!loadErr && rows.length === 0 && <p className="ps-p">Nobody yet. The first request will land here and in your email.</p>}
        {rows.map((r) => {
          const posts = r.items.filter((i) => i.kind === "post");
          const photos = r.items.filter((i) => i.kind === "photo");
          const isOpen = open === r.id;
          const canPublish = r.pay_state === "seen" && r.items.length > 0;
          return (
            <div key={r.id} className="ps-card" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                {r.photo_url && <a href={`${BASE}${r.photo_url}`} target="_blank" rel="noreferrer"><img src={`${BASE}${r.photo_url}`} alt={r.name} style={{ width: 96, height: 128, objectFit: "cover", border: "2px solid #000" }} /></a>}
                {r.logo_url && <a href={`${BASE}${r.logo_url}`} target="_blank" rel="noreferrer"><img src={`${BASE}${r.logo_url}`} alt="logo" style={{ width: 96, height: 96, objectFit: "contain", border: "2px solid #000", background: "#eee" }} /></a>}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 24 }}>{r.name} <span style={{ color: "#ff1f8e" }}>{r.status}</span></div>
                  <div style={{ color: "#555", fontSize: 15, marginTop: 4 }}>
                    {r.label}, {PAY[r.pay_state] || r.pay_state}. Area: {r.area}. Colours: {r.colours}. {posts.length} of {postsTarget} posts, {photos.length} of {photosTarget} photos. {r.note}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15 }}>
                    <a href={`https://wa.me/${wa(r.phone)}`} target="_blank" rel="noreferrer" style={{ color: "#000" }}>WhatsApp {r.phone}</a>{"  "}
                    <a href={gmail(r.email)} target="_blank" rel="noreferrer" style={{ color: "#000" }}>{r.email}</a>{"  "}
                    <a href={`https://instagram.com/${r.insta}`} target="_blank" rel="noreferrer" style={{ color: "#000" }}>@{r.insta}</a>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginRight: 16, fontSize: 15 }}>
                  <input type="checkbox" checked={r.pay_state === "seen"} onChange={async (e) => { await act(`/bfdec/orders/${r.id}/payment-seen`, "POST", { seen: e.target.checked }); loadList(); }} style={{ width: 22, height: 22 }} />
                  Payment seen in Monzo
                </label>
                <button className="ps-btn alt" onClick={() => { setOpen(isOpen ? "" : r.id); }}>{isOpen ? "Hide files" : "Posts and photos"}</button>
                {r.status !== "ready" ? (
                  <button className="ps-btn" disabled={!canPublish} onClick={async () => { const x = await act(`/bfdec/orders/${r.id}/publish`); if (!x.ok) { toast.error(x.error || "Could not publish"); return; } toast.success("Portal is live"); loadList(); }}>Publish portal</button>
                ) : (
                  <button className="ps-btn alt" onClick={async () => { await act(`/bfdec/orders/${r.id}/unpublish`); toast.success("Portal hidden"); loadList(); }}>Hide portal</button>
                )}
                {!r.link && <button className="ps-btn alt" onClick={async () => { const x = await act(`/bfdec/orders/${r.id}/link`); if (!x.ok) { toast.error(x.error || "Could not do that"); return; } loadList(); }}>Make link</button>}
                {r.link && <>
                  <button className="ps-btn alt" onClick={() => copy(r.link)}>Copy link</button>
                  <a className="ps-btn alt" href={`https://wa.me/${wa(r.phone)}?text=${encodeURIComponent(msgFor(r, r.link))}`} target="_blank" rel="noreferrer">WhatsApp it</a>
                  <a className="ps-btn alt" href={gmail(r.email, "Your DECEMBER BUNDLE", msgFor(r, r.link))} target="_blank" rel="noreferrer">Email it</a>
                </>}
                {r.link && <div style={{ fontSize: 14, color: "#555", marginTop: 8 }}>{r.link}{r.expires_at ? `, live until ${new Date(r.expires_at).toLocaleDateString("en-GB")}` : ""}</div>}
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <label className="ps-l">Add posts ({posts.length} of {postsTarget}). Pick as many images as you like, they go in file name order.</label>
                  <input className="ps-in" type="file" accept="image/*" multiple disabled={busy === `${r.id}post`} onChange={(e) => { void addFiles(r, "post", e.target.files); e.target.value = ""; }} />
                  <label className="ps-l">Add photos ({photos.length} of {photosTarget})</label>
                  <input className="ps-in" type="file" accept="image/*" multiple disabled={busy === `${r.id}photo`} onChange={(e) => { void addFiles(r, "photo", e.target.files); e.target.value = ""; }} />
                  {busy.startsWith(r.id) && <p className="ps-p">Uploading</p>}
                  <div className="ps-grid">
                    {r.items.map((im) => (
                      <div key={im.id}>
                        <img src={`${BASE}${im.url}`} alt={im.label} />
                        <div style={{ fontSize: 13, color: "#555" }}>{im.kind}: {im.label}</div>
                        <button className="ps-btn alt" style={{ padding: "6px 10px", fontSize: 11 }} onClick={async () => { await act(`/bfdec/orders/${r.id}/items/${im.id}`, "DELETE"); loadList(); }}>Remove</button>
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
