import { useState } from "react";
import { PS_CSS } from "@/pages/photoshoot";

// cybersuite.com/voucher-order : a clinic types in its name, area, colours and the voucher offers it wants. Vanessa gets an email and makes the designs in her Vouchers tool.
// Same look as /bfdec and /xmasshoot (black, hot pink and white).
const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const COLOURS: { name: string; hex: string }[] = [
  { name: "red", hex: "#c8102e" }, { name: "blush pink", hex: "#f4c2c2" }, { name: "hot pink", hex: "#ff1f8e" }, { name: "gold", hex: "#d4af37" },
  { name: "silver", hex: "#c0c0c0" }, { name: "emerald green", hex: "#0b6b46" }, { name: "navy", hex: "#14213d" }, { name: "burgundy", hex: "#6d0f2a" },
  { name: "white", hex: "#ffffff" }, { name: "black", hex: "#000000" }, { name: "teal", hex: "#0e7c86" }, { name: "purple", hex: "#5b2a86" },
];
const SW_CSS = `
.vo-sw { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.vo-sw button { border:2px solid #000; background:#fff; color:#000; padding:8px 12px; font-size:13px; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:8px; }
.vo-sw button.on { border-color:${PINK}; box-shadow: 0 0 0 2px ${PINK}; }
.vo-sw i { width:16px; height:16px; border:1px solid #000; display:inline-block; }
.vo-ok { color:#0a7a3d; font-weight:700; margin-top:12px; }
.vo-err { color:#c00; font-weight:700; margin-top:12px; }
`;

const DEALS = ["10% extra free", "Spend £50, get £60", "Spend £100, get £120", "Spend £200, get £250"];

export default function VoucherOrder() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [insta, setInsta] = useState("");
  const [area, setArea] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [offers, setOffers] = useState("");
  const [deal, setDeal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const send = async () => {
    setErr("");
    setBusy(true);
    try {
      const colours = [...picked, other.trim()].filter(Boolean).join(", ");
      const r = await fetch(`${BASE}/api/voucher-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, insta, area, colours, offers, deal, note }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || "Something went wrong, please try again");
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong, please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ps"><style>{PS_CSS}{SW_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">Social Media Sister</div>
        <h1 className="ps-h1">GIFT <span>VOUCHERS</span></h1>
        <p className="ps-p">Beautiful gift voucher posts for your clinic, with a satin bow in your colours and your own offers on them, ready to post in time for Christmas. Tell me about your clinic below and I will design them for you.</p>
        {done ? (
          <div className="ps-card">
            <div className="ps-k">Thank you</div>
            <p className="ps-p">Your details are with me. I will make your vouchers and send them over to {email}.</p>
          </div>
        ) : (
          <div className="ps-card">
            <label className="ps-l">Your name or clinic name</label>
            <input className="ps-in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
            <label className="ps-l">Your email, so I can send your vouchers</label>
            <input className="ps-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label className="ps-l">Your WhatsApp number</label>
            <input className="ps-in" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07..." />
            <label className="ps-l">Your Instagram @</label>
            <input className="ps-in" value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@yourclinic" autoCapitalize="none" />
            <label className="ps-l">Your area (so your hashtags feel local)</label>
            <input className="ps-in" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Harrogate, North Yorkshire" />
            <label className="ps-l">Your colours (pick as many as you like)</label>
            <div className="vo-sw">{COLOURS.map((c) => <button key={c.name} type="button" className={picked.includes(c.name) ? "on" : ""} onClick={() => toggle(c.name)}><i style={{ background: c.hex }} />{c.name}</button>)}</div>
            <input className="ps-in" style={{ marginTop: 8 }} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Or type your brand colours, for example #7a1f3d" />
            <label className="ps-l">Your voucher offers (one per line, for example: £50 towards any facial)</label>
            <textarea className="ps-in" rows={5} value={offers} onChange={(e) => setOffers(e.target.value)} />
            <label className="ps-l">Your discount or bonus deal (optional)</label>
            <div className="vo-sw">{DEALS.map((d) => <button key={d} type="button" className={deal === d ? "on" : ""} onClick={() => setDeal(deal === d ? "" : d)}>{d}</button>)}</div>
            <input className="ps-in" style={{ marginTop: 8 }} value={deal} onChange={(e) => setDeal(e.target.value)} placeholder="Or type your own, for example: Spend £100, get £120 to spend" />
            <label className="ps-l">Anything else I should know?</label>
            <textarea className="ps-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            {err && <div className="vo-err">{err}</div>}
            <button className="ps-btn" disabled={busy} onClick={send} style={{ marginTop: 16 }}>{busy ? "Sending..." : "Send to Vanessa"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
