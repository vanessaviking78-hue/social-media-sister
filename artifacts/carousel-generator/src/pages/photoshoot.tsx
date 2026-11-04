import { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PHOTOSHOOT_PAY_URL, PHOTOSHOOT_PRICE, PHOTOSHOOT_GROUP_PRICE } from "@/lib/photoshoot-config";

// cybersuite.com/photoshoot : AI Photo Studio. Pay, send 3 photos, get 20 images. Black, hot pink and white, League Spartan 900.
const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

export const PS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.ps { background:#000; color:#fff; min-height:100vh; font-family:'League Spartan',sans-serif; font-weight:900; }
.ps * { box-sizing:border-box; font-family:inherit; }
.ps-w { max-width: 980px; margin:0 auto; padding: 48px 20px 90px; }
.ps-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; }
.ps-h1 { font-size: clamp(40px,9vw,84px); line-height:.95; text-transform:uppercase; margin:10px 0 18px; }
.ps-h1 span { color:${PINK}; }
.ps-p { font-size: 19px; line-height:1.4; max-width: 640px; font-weight:700; color:#ddd; }
.ps-card { background:#111; border:1px solid #2a2a2a; padding: 24px; margin-top: 28px; }
.ps-l { font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:#aaa; display:block; margin:14px 0 6px; }
.ps-in { width:100%; background:#000; border:2px solid #333; color:#fff; padding:13px 14px; font-size:18px; font-weight:700; }
.ps-in:focus { outline:none; border-color:${PINK}; }
.ps-btn { background:${PINK}; color:#fff; border:0; padding:16px 26px; font-size:15px; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; text-decoration:none; display:inline-block; margin: 6px 10px 0 0; }
.ps-btn.alt { background:transparent; border:2px solid ${PINK}; }
.ps-btn[disabled] { opacity:.4; cursor:default; }
.ps-err { color:#ff8fb8; margin-top:14px; font-weight:700; }
.ps-grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-top:20px; }
.ps-grid img { width:100%; display:block; aspect-ratio:4/5; object-fit:cover; background:#222; }
.ps-ul { font-size:18px; line-height:1.5; font-weight:700; color:#ddd; padding-left:20px; }
`;

const j = async (r: Response) => ({ ok: r.ok, status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> });

export default function Photoshoot() {
  const sid = new URLSearchParams(window.location.search).get("session_id") || "";
  const [state, setState] = useState<"pay" | "checking" | "form" | "sending" | "done" | "error">(sid ? "checking" : "pay");
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [clinic, setClinic] = useState("");
  const [scrub, setScrub] = useState("");
  const [faces, setFaces] = useState<File[]>([]);
  const [interior, setInterior] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    document.title = "AI Photo Studio";
    if (!sid) return;
    fetch(`${API}/photoshoot/session/${encodeURIComponent(sid)}`).then(j).then((r) => {
      if (!r.ok) { setMsg(String(r.body.error || "Something went wrong")); setState("error"); return; }
      if (r.body.used) { setToken(String(r.body.token)); setState("done"); return; }
      setEmail(String(r.body.email || "")); setState("form");
    }).catch(() => { setMsg("I could not check your payment, please refresh"); setState("error"); });
  }, [sid]);

  const send = async () => {
    setMsg("");
    if (!clinic.trim() || !scrub.trim()) return setMsg("Please add your clinic name and the colour of your scrubs");
    if (faces.length !== 3) return setMsg("Please add exactly 3 photos of you");
    if (!consent) return setMsg("Please tick the box so I know you are happy with this");
    setState("sending");
    const fd = new FormData();
    fd.append("sessionId", sid); fd.append("clinicName", clinic); fd.append("scrubColour", scrub); fd.append("email", email); fd.append("consent", "yes");
    faces.forEach((f) => fd.append("photos", f));
    if (interior) fd.append("interior", interior);
    try {
      const r = await j(await fetch(`${API}/photoshoot/start`, { method: "POST", body: fd }));
      if (!r.ok) { setMsg(String(r.body.error || "Something went wrong")); setState("form"); return; }
      setToken(String(r.body.token)); setState("done");
    } catch { setMsg("That did not send, please try again"); setState("form"); }
  };

  return (
    <div className="ps"><style>{PS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">AI Photo Studio</div>
        {state === "pay" && (<>
          <h1 className="ps-h1">20 photos of <span>you</span>, without the photographer</h1>
          <p className="ps-p">Send me 3 photos of you with no filter on. I make 20 images that look like you on your best day: 10 in your scrubs, 5 living your life, and 5 for the season.</p>
          <div className="ps-card">
            <ul className="ps-ul">
              <li>10 in your scrubs, in a clinic setting (yours if you send me a photo of it)</li>
              <li>5 lifestyle: coffee shop, sofa, laptop, reading, and sending a text on your iPhone</li>
              <li>5 seasonal, so your feed always looks current</li>
              <li>I look over every set myself before it reaches you</li>
            </ul>
            <p className="ps-p" style={{ marginTop: 18 }}>{PHOTOSHOOT_PRICE} for the full set. In my group? Pop the code GROUP in at checkout for {PHOTOSHOOT_GROUP_PRICE}. The group price is for the first 20 members only, then it goes back to full price.</p>
            <a className="ps-btn" href={PHOTOSHOOT_PAY_URL}>Get my 20 photos</a>
          </div>
        </>)}
        {state === "checking" && <h1 className="ps-h1">One moment, <span>checking</span> your payment</h1>}
        {state === "error" && (<><h1 className="ps-h1">Hmm, <span>that</span> did not work</h1><p className="ps-p">{msg}</p><a className="ps-btn alt" href={`mailto:hello@thecybersuite.com`}>Message me</a></>)}
        {(state === "form" || state === "sending") && (<>
          <h1 className="ps-h1">Payment <span>received</span>. Now the fun bit</h1>
          <p className="ps-p">Three photos of you, then a couple of quick details.</p>
          <div className="ps-card">
            <label className="ps-l">Your clinic name</label>
            <input className="ps-in" value={clinic} onChange={(e) => setClinic(e.target.value)} />
            <label className="ps-l">Your email, so I can send your link</label>
            <input className="ps-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="ps-l">The colour of your scrubs (just a word, like navy, teal or black)</label>
            <input className="ps-in" value={scrub} onChange={(e) => setScrub(e.target.value)} placeholder="navy" />
            <label className="ps-l">3 photos of you (needed). No filter. Full face, head and shoulders, different angles if you can</label>
            <input className="ps-in" type="file" accept="image/*" multiple onChange={(e) => setFaces(Array.from(e.target.files || []).slice(0, 3))} />
            <div style={{ fontSize: 14, color: "#aaa", marginTop: 6 }}>{faces.length} of 3 added</div>
            <label className="ps-l">A photo of the inside of your clinic (optional, but it makes the scrubs shots look like you)</label>
            <input className="ps-in" type="file" accept="image/*" onChange={(e) => setInterior(e.target.files?.[0] || null)} />
            <label style={{ display: "flex", gap: 10, marginTop: 18, fontSize: 16, fontWeight: 700, color: "#ddd" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
              <span>The photos are of me, and I know the images will be made by AI and may not be a perfect likeness.</span>
            </label>
            {msg && <div className="ps-err">{msg}</div>}
            <button className="ps-btn" disabled={state === "sending"} onClick={send}>{state === "sending" ? "Sending your photos" : "Make my 20 photos"}</button>
          </div>
        </>)}
        {state === "done" && (<>
          <h1 className="ps-h1">Thank <span>you</span>. I am on it</h1>
          <p className="ps-p">Your 20 photos are being made and I will look every one over before they reach you. This page is your private link, so keep it. Pop back in a little while and your photos will be waiting.</p>
          <a className="ps-btn" href={`${BASE}/photos/${token}`}>Open my photos page</a>
        </>)}
      </div>
    </div>
  );
}

export function PhotosView({ token }: { token: string }) {
  const [d, setD] = useState<{ clinicName: string; ready: boolean; images: { n: number; label: string; kind: string; url: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = "Your photos";
    const load = () => fetch(`${API}/photoshoot/order/${token}`).then((r) => r.json()).then(setD).catch(() => undefined);
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [token]);
  const zip = async () => {
    if (!d) return;
    setBusy(true);
    const z = new JSZip();
    for (const im of d.images) {
      const b = await (await fetch(`${BASE}${im.url}`)).blob();
      z.file(`${String(im.n).padStart(2, "0")}-${im.kind}-${im.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, b);
    }
    saveAs(await z.generateAsync({ type: "blob" }), "my-photos.zip");
    setBusy(false);
  };
  return (
    <div className="ps"><style>{PS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">AI Photo Studio</div>
        {!d && <h1 className="ps-h1">Loading</h1>}
        {d && !d.ready && (<><h1 className="ps-h1">Your photos are <span>cooking</span></h1><p className="ps-p">I am making and checking your 20 images. Keep this page, it refreshes by itself when they are ready.</p></>)}
        {d && d.ready && (<>
          <h1 className="ps-h1">{d.clinicName}, <span>here you go</span></h1>
          <p className="ps-p">Tap an image to open it, or grab the lot in one go.</p>
          <button className="ps-btn" disabled={busy} onClick={zip}>{busy ? "Zipping" : "Download all 20"}</button>
          <div className="ps-grid">{d.images.map((im) => <a key={im.n} href={`${BASE}${im.url}`} target="_blank" rel="noreferrer"><img src={`${BASE}${im.url}`} alt={im.label} loading="lazy" /></a>)}</div>
        </>)}
      </div>
    </div>
  );
}
