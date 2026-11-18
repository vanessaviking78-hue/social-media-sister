import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PS_CSS } from "@/pages/photoshoot";

// cybersuite.com/xmasshoot : CYBERSUITE CHRISTMAS SHOOT. One selfie in, ten realistic Christmas images out.
// Monzo cannot tell the site when someone pays, so after sending the form they pay on Monzo and tap "I have paid".
// Black, hot pink and white, League Spartan 900, same look as /photoshoot.
const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

const XS_CSS = `
.xs-video { position:relative; max-width: 360px; margin: 26px 0 0; border:2px solid #000; background:#000; }
.xs-video video { width:100%; display:block; aspect-ratio:3/4; object-fit:cover; }
.xs-snd { position:absolute; right:10px; bottom:10px; background:${PINK}; color:#fff; border:0; padding:10px 14px; font-size:12px; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
.xs-cap { font-size:13px; letter-spacing:.22em; text-transform:uppercase; color:${PINK}; margin-top:10px; }
.xs-sw { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.xs-sw button { border:2px solid #000; background:#fff; color:#000; padding:8px 12px; font-size:13px; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:8px; }
.xs-sw button.on { border-color:${PINK}; box-shadow: 0 0 0 2px ${PINK}; }
.xs-sw i { width:16px; height:16px; border:1px solid #000; display:inline-block; }
.xs-price { font-size: clamp(34px,7vw,56px); line-height:1; color:${PINK}; margin:6px 0 0; }
.xs-ok { color:#0a7a3d; margin-top:10px; font-weight:700; }
`;

const COLOURS: { name: string; hex: string }[] = [
  { name: "red", hex: "#c8102e" },
  { name: "blush pink", hex: "#f4c2c2" },
  { name: "hot pink", hex: "#ff1f8e" },
  { name: "gold", hex: "#d4af37" },
  { name: "silver", hex: "#c0c0c0" },
  { name: "emerald green", hex: "#0b6b46" },
  { name: "navy", hex: "#14213d" },
  { name: "burgundy", hex: "#6d0f2a" },
  { name: "white", hex: "#ffffff" },
  { name: "black", hex: "#000000" },
  { name: "teal", hex: "#0e7c86" },
  { name: "purple", hex: "#5b2a86" },
];

const j = async (r: Response) => ({ ok: r.ok, status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> });

function Demo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  return (
    <div>
      <div className="xs-video">
        <video ref={ref} src={`${BASE}/xmas-shoot-media/demo.mp4`} poster={`${BASE}/xmas-shoot-media/poster.jpg`} autoPlay loop muted={muted} playsInline preload="auto" />
        <button
          className="xs-snd"
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            const next = !muted;
            v.muted = next;
            setMuted(next);
            if (!next) void v.play().catch(() => undefined);
          }}
        >
          {muted ? "Tap for Christmas music" : "Music off"}
        </button>
      </div>
      <div className="xs-cap">These are the results to expect</div>
    </div>
  );
}

export default function XmasShoot() {
  const resume = new URLSearchParams(window.location.search).get("order") || "";
  const [stage, setStage] = useState<"form" | "sending" | "pay" | "claimed" | "free" | "ready">(resume ? "pay" : "form");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [colour, setColour] = useState("");
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [label, setLabel] = useState("£49");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [token, setToken] = useState(resume);
  const [payUrl, setPayUrl] = useState("");
  const [owed, setOwed] = useState("");
  const [slug, setSlug] = useState("");
  const [who, setWho] = useState("");

  useEffect(() => { document.title = "CYBERSUITE CHRISTMAS SHOOT"; }, []);

  const refresh = (t: string) =>
    fetch(`${API}/xmasshoot/order/${t}`).then(j).then((r) => {
      if (!r.ok) { setMsg("That link does not look right. Message me and I will sort it."); setStage("form"); return; }
      setWho(String(r.body.name || ""));
      setOwed(String(r.body.label || ""));
      setPayUrl(String(r.body.payUrl || ""));
      if (r.body.slug) { setSlug(String(r.body.slug)); setStage("ready"); return; }
      setStage(r.body.payState === "free" ? "free" : r.body.payState === "claimed" || r.body.payState === "seen" ? "claimed" : "pay");
    }).catch(() => undefined);

  useEffect(() => {
    if (!resume) return;
    refresh(resume);
    const t = setInterval(() => refresh(resume), 20000);
    return () => clearInterval(t);
  }, [resume]);

  const checkCode = async () => {
    setCodeNote("");
    const c = code.trim();
    if (!c) { setLabel("£49"); return; }
    const r = await j(await fetch(`${API}/xmasshoot/check-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) }));
    const k = r.body.kind;
    if (k === "half") { setLabel(String(r.body.label)); setCodeNote(`Code applied. Your price is ${r.body.label}.`); }
    else if (k === "free") { setLabel("free"); setCodeNote(`Code applied. This one is on me. ${r.body.slotsLeft} space${r.body.slotsLeft === 1 ? "" : "s"} left.`); }
    else if (k === "gone") { setLabel("£49"); setCodeNote("All the SISTER spaces have gone. Clear the box to carry on at the usual price."); }
    else { setLabel("£49"); setCodeNote("I do not recognise that code. Check the spelling."); }
  };

  const send = async () => {
    setMsg("");
    if (!name.trim()) return setMsg("Please add your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMsg("Please add your email so I can send your images");
    if (phone.replace(/\D/g, "").length < 10) return setMsg("Please add your WhatsApp number");
    if (!selfie) return setMsg("Please add your selfie");
    if (!consent) return setMsg("Please tick the box so I know you are happy for me to make your images");
    setStage("sending");
    const fd = new FormData();
    fd.append("name", name); fd.append("email", email); fd.append("phone", phone);
    fd.append("colour", typed.trim() || colour); fd.append("code", code.trim());
    fd.append("consent", "yes"); fd.append("marketing", marketing ? "yes" : "no"); fd.append("selfie", selfie);
    try {
      const r = await j(await fetch(`${API}/xmasshoot/start`, { method: "POST", body: fd }));
      if (!r.ok) { setMsg(String(r.body.error || "Something went wrong")); setStage("form"); return; }
      setToken(String(r.body.token)); setWho(name); setOwed(String(r.body.label)); setPayUrl(String(r.body.payUrl || ""));
      setStage(r.body.free ? "free" : "pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setMsg("That did not send, please try again"); setStage("form"); }
  };

  const paid = async () => {
    await fetch(`${API}/xmasshoot/order/${token}/paid`, { method: "POST" }).catch(() => undefined);
    setStage("claimed");
  };

  return (
    <div className="ps"><style>{PS_CSS}{XS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">Social Media Sister</div>
        {(stage === "form" || stage === "sending") && (<>
          <h1 className="ps-h1">CYBERSUITE <span>CHRISTMAS</span> SHOOT</h1>
          <p className="ps-p">One selfie. Ten Christmas photos that look like you on a very good day. No photographer, no hat hair, and nobody asking you to hold a bauble for forty minutes.</p>
          <Demo />
          <div className="ps-card">
            <div className="ps-k">The price</div>
            <div className="xs-price">{label === "free" ? "Free" : label}</div>
            <p className="ps-p" style={{ marginTop: 10 }}>Ten photos in your colour: tinsel, bauble, hat and scarf. Got a code? Pop it in the box and the price changes before you pay anything.</p>
          </div>
          <div className="ps-card">
            <label className="ps-l">Your name</label>
            <input className="ps-in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <label className="ps-l">Your email, so I can send your images</label>
            <input className="ps-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label className="ps-l">Your WhatsApp number</label>
            <input className="ps-in" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07..." />
            <label className="ps-l">Your Christmas colour (tinsel, bauble, hat and scarf all match)</label>
            <div className="xs-sw">
              {COLOURS.map((c) => (
                <button key={c.name} type="button" className={!typed.trim() && colour === c.name ? "on" : ""} onClick={() => { setColour(c.name); setTyped(""); }}>
                  <i style={{ background: c.hex }} />{c.name}
                </button>
              ))}
            </div>
            <label className="ps-l">Or type your own colour (this wins if you fill it in). Leave both empty for red</label>
            <input className="ps-in" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="dusky rose" />
            <label className="ps-l">Your selfie</label>
            <input className="ps-in" type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
            <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>Face on, good light, no filter, no sunglasses. The better the selfie, the more it looks like you.</div>
            <label className="ps-l">Got a code?</label>
            <input className="ps-in" value={code} onChange={(e) => setCode(e.target.value)} onBlur={checkCode} placeholder="Optional" autoCapitalize="characters" />
            {codeNote && <div className={codeNote.startsWith("Code applied") ? "xs-ok" : "ps-err"}>{codeNote}</div>}
            <label style={{ display: "flex", gap: 10, marginTop: 18, fontSize: 16, fontWeight: 700, color: "#222" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
              <span>This selfie is of me. I know the images are made by AI, so they may not be a perfect likeness. I am happy for them to be made, and for you to contact me about them on WhatsApp and email. I understand my selfie and images are deleted after 30 days.</span>
            </label>
            <label style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 16, fontWeight: 700, color: "#222" }}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
              <span>Optional: I would like to hear about other things Social Media Sister makes.</span>
            </label>
            {msg && <div className="ps-err">{msg}</div>}
            <button className="ps-btn" disabled={stage === "sending"} onClick={send}>{stage === "sending" ? "Sending your selfie" : "Make my Christmas shoot"}</button>
          </div>
        </>)}

        {stage === "pay" && (<>
          <h1 className="ps-h1">{who ? `${who.split(" ")[0]}, ` : ""}one last <span>step</span></h1>
          <p className="ps-p">Your selfie is safe with me. Pay {owed || "the price"} on Monzo, then tap the pink button underneath so I know to look. Please use your name as the payment reference so I can find you.</p>
          <div className="ps-card">
            {payUrl && <a className="ps-btn" href={payUrl} target="_blank" rel="noreferrer">Pay {owed} on Monzo</a>}
            <button className="ps-btn alt" onClick={paid}>I have paid</button>
            <p style={{ fontSize: 14, color: "#555", marginTop: 14 }}>Keep this page. If you close it, the link in your browser history brings you back.</p>
          </div>
        </>)}

        {stage === "claimed" && (<>
          <h1 className="ps-h1">Thank <span>you</span>. I am on it</h1>
          <p className="ps-p">I will check my Monzo, make your ten photos and WhatsApp you your own private link. This page updates by itself, so pop back when you like.</p>
        </>)}

        {stage === "free" && (<>
          <h1 className="ps-h1">You are <span>in</span>. This one is on me</h1>
          <p className="ps-p">I will make your ten photos and WhatsApp you your own private link. This page updates by itself, so pop back when you like.</p>
        </>)}

        {stage === "ready" && (<>
          <h1 className="ps-h1">Your photos are <span>ready</span></h1>
          <p className="ps-p">Tap the button and they are all yours.</p>
          <a className="ps-btn" href={`${BASE}/${slug}`}>Open my photos</a>
        </>)}
      </div>
    </div>
  );
}

export function XmasShootView({ slug }: { slug: string }) {
  const [d, setD] = useState<{ name: string; ready: boolean; expired: boolean; images: { n: number; label: string; url: string }[]; expiresAt?: string } | null | "none">(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = "Your Christmas shoot";
    const load = () => fetch(`${API}/xmasshoot/view/${slug}`).then((r) => (r.ok ? r.json() : "none")).then(setD).catch(() => undefined);
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [slug]);
  const zip = async () => {
    if (!d || d === "none") return;
    setBusy(true);
    const z = new JSZip();
    for (const im of d.images) z.file(`christmas-${String(im.n).padStart(2, "0")}.png`, await (await fetch(`${BASE}${im.url}`)).blob());
    saveAs(await z.generateAsync({ type: "blob" }), "my-christmas-shoot.zip");
    setBusy(false);
  };
  const days = d && d !== "none" && d.expiresAt ? Math.max(0, Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000)) : null;
  return (
    <div className="ps"><style>{PS_CSS}{XS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">CYBERSUITE CHRISTMAS SHOOT</div>
        {d === null && <h1 className="ps-h1">Loading</h1>}
        {d === "none" && (<><h1 className="ps-h1">Hmm, <span>I cannot</span> find that</h1><p className="ps-p">Check the link I sent you, or message me and I will pop it over again.</p></>)}
        {d && d !== "none" && d.expired && (<><h1 className="ps-h1">This link has <span>expired</span></h1><p className="ps-p">Your photos stay for 30 days and then they are deleted. Message me if you would like another shoot.</p></>)}
        {d && d !== "none" && !d.expired && !d.ready && (<><h1 className="ps-h1">Your photos are <span>cooking</span></h1><p className="ps-p">I am making your ten Christmas photos now. Keep this page open, it refreshes by itself when they are ready.</p></>)}
        {d && d !== "none" && !d.expired && d.ready && (<>
          <h1 className="ps-h1">{d.name.split(" ")[0]}, <span>here you go</span></h1>
          <p className="ps-p">Tap a photo to open it, or take the lot in one go. They stay here for {days ?? 30} more day{days === 1 ? "" : "s"}, so download them today and put them to work.</p>
          <button className="ps-btn" disabled={busy} onClick={zip}>{busy ? "Zipping" : `Download all ${d.images.length}`}</button>
          <div className="ps-grid">
            {d.images.map((im) => (
              <div key={im.n}>
                <a href={`${BASE}${im.url}`} target="_blank" rel="noreferrer"><img src={`${BASE}${im.url}`} alt={im.label} loading="lazy" /></a>
                <a className="ps-btn alt" style={{ padding: "8px 12px", fontSize: 11 }} href={`${BASE}${im.url}`} download={`christmas-${im.n}.png`}>Download</a>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}
