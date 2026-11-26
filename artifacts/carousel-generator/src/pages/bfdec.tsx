import { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PS_CSS } from "@/pages/photoshoot";

// cybersuite.com/bfdec : the DECEMBER BUNDLE Black Friday offer. 20 Christmas posts and 10 Christmas photos, delivered in the person's own portal.
// Same look as /xmasshoot (black, hot pink and white, League Spartan 900). The offer runs 8pm Thu 26 Nov to 8pm Fri 27 Nov 2026 with code BFDEC.
// Monzo cannot tell the site when someone pays, so after sending the form they pay on Monzo and tap "I have paid".
const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

// Drop the results pictures into public/bfdec-media and list the file names here. The gallery stays hidden until there is at least one.
const RESULTS: string[] = [];
const RESULTS_VIDEO = ""; // e.g. "demo.mp4" inside public/bfdec-media

const XS_CSS = `
.xs-video { position:relative; max-width: 360px; margin: 26px 0 0; border:2px solid #000; background:#000; }
.xs-video video { width:100%; display:block; aspect-ratio:3/4; object-fit:cover; }
.xs-cap { font-size:13px; letter-spacing:.22em; text-transform:uppercase; color:${PINK}; margin-top:10px; }
.xs-sw { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.xs-sw button { border:2px solid #000; background:#fff; color:#000; padding:8px 12px; font-size:13px; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:8px; }
.xs-sw button.on { border-color:${PINK}; box-shadow: 0 0 0 2px ${PINK}; }
.xs-sw i { width:16px; height:16px; border:1px solid #000; display:inline-block; }
.xs-price { font-size: clamp(34px,7vw,56px); line-height:1; color:${PINK}; margin:6px 0 0; }
.xs-was { font-size: clamp(20px,4vw,28px); color:#555; text-decoration: line-through; margin-top:4px; }
.xs-ok { color:#0a7a3d; margin-top:10px; font-weight:700; }
.xs-list { margin:12px 0 0; padding-left:22px; font-size:18px; line-height:1.5; color:#222; font-weight:700; }
.xs-clock { font-size: clamp(26px,6vw,44px); margin-top:8px; color:#000; }
.xs-gal { display:grid; grid-template-columns: repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-top:18px; }
.xs-gal img { width:100%; display:block; aspect-ratio:4/5; object-fit:cover; border:2px solid #000; background:#eee; }
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

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function Results() {
  if (!RESULTS.length && !RESULTS_VIDEO) return null;
  return (
    <div>
      {RESULTS_VIDEO && (
        <div className="xs-video">
          <video src={`${BASE}/bfdec-media/${RESULTS_VIDEO}`} autoPlay loop muted playsInline preload="auto" />
        </div>
      )}
      {RESULTS.length > 0 && (
        <div className="xs-gal">
          {RESULTS.map((f) => <img key={f} src={`${BASE}/bfdec-media/${f}`} alt="December Bundle example" loading="lazy" />)}
        </div>
      )}
      <div className="xs-cap">These are the results to expect</div>
    </div>
  );
}

export default function BfDec() {
  const resume = new URLSearchParams(window.location.search).get("order") || "";
  const [stage, setStage] = useState<"form" | "sending" | "pay" | "claimed" | "free" | "ready">(resume ? "pay" : "form");
  const preCode = (new URLSearchParams(window.location.search).get("code") || "").trim().toUpperCase();
  const [offer, setOffer] = useState<{ state: "before" | "open" | "closed"; opensAt: string; closesAt: string; fullLabel: string; dealLabel: string; skew: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [insta, setInsta] = useState("");
  const [area, setArea] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState(preCode === "LEDZEP" ? "LEDZEP" : "");
  const [codeNote, setCodeNote] = useState("");
  const [applied, setApplied] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [token, setToken] = useState(resume);
  const [payUrl, setPayUrl] = useState("");
  const [owed, setOwed] = useState("");
  const [slug, setSlug] = useState("");
  const [who, setWho] = useState("");

  useEffect(() => { document.title = "DECEMBER BUNDLE"; }, []);

  const loadOffer = () =>
    fetch(`${API}/bfdec/offer`).then(j).then((r) => {
      if (!r.ok) return;
      setOffer({ state: r.body.state, opensAt: r.body.opensAt, closesAt: r.body.closesAt, fullLabel: r.body.fullLabel, dealLabel: r.body.dealLabel, skew: new Date(r.body.serverNow).getTime() - Date.now() });
    }).catch(() => undefined);
  useEffect(() => { loadOffer(); const t = setInterval(loadOffer, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const refresh = (t: string) =>
    fetch(`${API}/bfdec/order/${t}`).then(j).then((r) => {
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
    setCodeNote(""); setApplied(false); setIsFree(false);
    const c = code.trim();
    if (!c) return;
    const r = await j(await fetch(`${API}/bfdec/check-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) }));
    const k = r.body.kind;
    if (k === "free") { setApplied(true); setIsFree(true); setCodeNote("Code applied. This one is on me."); return; }
    setIsFree(false);
    if (k === "deal") { setApplied(true); setCodeNote(`Code applied. Your price is ${r.body.label}.`); loadOffer(); }
    else if (k === "early") setCodeNote("That code wakes up at 8pm tonight. Pop back then.");
    else if (k === "ended") setCodeNote("That code has finished. Message me and I will see what I can do.");
    else setCodeNote("I do not recognise that code. Check the spelling.");
  };

  const colours = [...picked, typed.trim().toLowerCase()].filter(Boolean).join(", ");

  const send = async () => {
    setMsg("");
    if (!name.trim()) return setMsg("Please add your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMsg("Please add your email so I can send your portal");
    if (phone.replace(/\D/g, "").length < 10) return setMsg("Please add your WhatsApp number");
    if (!insta.trim().replace(/^@+/, "")) return setMsg("Please add your Instagram @");
    if (!area.trim()) return setMsg("Please tell me your area");
    if (!colours) return setMsg("Please pick or type your colour scheme");
    if (!photo) return setMsg("Please add your photo");
    if (!applied) return setMsg("Pop the code BFDEC in the code box and tap out of it to unlock the price");
    if (!consent) return setMsg("Please tick the box so I know you are happy for me to make your content");
    setStage("sending");
    const fd = new FormData();
    fd.append("name", name); fd.append("email", email); fd.append("phone", phone); fd.append("insta", insta);
    fd.append("area", area); fd.append("colours", colours); fd.append("code", code.trim());
    fd.append("consent", "yes"); fd.append("marketing", marketing ? "yes" : "no");
    fd.append("photo", photo); if (logo) fd.append("logo", logo);
    try {
      const r = await j(await fetch(`${API}/bfdec/start`, { method: "POST", body: fd }));
      if (!r.ok) { setMsg(String(r.body.error || "Something went wrong")); setStage("form"); loadOffer(); return; }
      setToken(String(r.body.token)); setWho(name); setOwed(String(r.body.label)); setPayUrl(String(r.body.payUrl || ""));
      setStage(r.body.free ? "free" : "pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setMsg("That did not send, please try again"); setStage("form"); }
  };

  const paid = async () => {
    await fetch(`${API}/bfdec/order/${token}/paid`, { method: "POST" }).catch(() => undefined);
    setStage("claimed");
  };

  const serverNow = now + (offer?.skew || 0);
  const toOpen = offer ? new Date(offer.opensAt).getTime() - serverNow : 0;
  const toClose = offer ? new Date(offer.closesAt).getTime() - serverNow : 0;
  const windowState = offer ? (toOpen > 0 ? "before" : toClose <= 0 ? "closed" : "open") : null;
  // The LEDZEP link (/bfdec?code=LEDZEP) opens the form at any time.
  const state = preCode === "LEDZEP" && windowState !== "open" ? "open" : windowState;

  return (
    <div className="ps"><style>{PS_CSS}{XS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">Social Media Sister</div>
        {(stage === "form" || stage === "sending") && (<>
          <h1 className="ps-h1">DECEMBER <span>BUNDLE</span></h1>
          <p className="ps-p">Your whole month of socials, covered, so you can relax for December. Twenty Christmas posts and ten Christmas photos, made for your clinic and delivered to your own private portal, which leaves you free for a very large glass of something fizzy.</p>
          <Results />
          <div className="ps-card">
            <div className="ps-k">Black Friday price</div>
            <div className="xs-was">{offer?.fullLabel || "£699"}</div>
            <div className="xs-price">{isFree ? "Free" : offer?.dealLabel || "£149"}</div>
            <p className="ps-p" style={{ marginTop: 10 }}>Use code BFDEC. It covers the whole of your December content: 20 Christmas pieces of content and 10 Christmas photos, in your colours, for your area.</p>
            {state === "before" && <><div className="ps-k" style={{ marginTop: 16 }}>Opens at 8pm tonight</div><div className="xs-clock">{clock(toOpen)}</div></>}
            {state === "open" && <><div className="ps-k" style={{ marginTop: 16 }}>Ends 8pm tomorrow, Friday 27 November</div><div className="xs-clock">{clock(toClose)}</div></>}
            {state === "closed" && <p className="ps-p" style={{ marginTop: 16 }}>This Black Friday offer has now ended. Message me and I will tell you what I can do.</p>}
            <ul className="xs-list">
              <li>Your whole December of socials covered, so you can properly relax</li>
              <li>20 Christmas posts, written for your clinic</li>
              <li>10 Christmas photos of you, made from the photo you upload, in your colours</li>
              <li>Your colours, your area and your logo throughout</li>
              <li>Everything delivered in your own private portal, ready to download</li>
            </ul>
          </div>
          {state === "open" && (
            <div className="ps-card">
              <label className="ps-l">Your name</label>
              <input className="ps-in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <label className="ps-l">Your email, so I can send your portal</label>
              <input className="ps-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <label className="ps-l">Your WhatsApp number</label>
              <input className="ps-in" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07..." />
              <label className="ps-l">Your Instagram @</label>
              <input className="ps-in" value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@yourclinic" autoCapitalize="none" />
              <label className="ps-l">Your area (so your posts and hashtags feel local)</label>
              <input className="ps-in" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Harrogate, North Yorkshire" />
              <label className="ps-l">Your colour scheme (pick as many as you like)</label>
              <div className="xs-sw">
                {COLOURS.map((c) => (
                  <button key={c.name} type="button" className={picked.includes(c.name) ? "on" : ""} onClick={() => setPicked((p) => (p.includes(c.name) ? p.filter((x) => x !== c.name) : [...p, c.name]))}>
                    <i style={{ background: c.hex }} />{c.name}
                  </button>
                ))}
              </div>
              <label className="ps-l">Or type your own colours, such as dusky rose and cream</label>
              <input className="ps-in" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="dusky rose and cream" />
              <label className="ps-l">Your photo of you</label>
              <input className="ps-in" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>Face on, good light, no filter, no sunglasses. The better the photo, the more it looks like you.</div>
              <label className="ps-l">Your logo (a PNG with a clear background works best)</label>
              <input className="ps-in" type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
              <label className="ps-l">Your code</label>
              <input className="ps-in" value={code} onChange={(e) => { setCode(e.target.value); setApplied(false); }} onBlur={checkCode} placeholder="BFDEC" autoCapitalize="characters" />
              {codeNote && <div className={codeNote.startsWith("Code applied") ? "xs-ok" : "ps-err"}>{codeNote}</div>}
              <label style={{ display: "flex", gap: 10, marginTop: 18, fontSize: 16, fontWeight: 700, color: "#222" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
                <span>This photo is of me. I know the images are made by AI, so they may not be a perfect likeness. I am happy for my content to be made, and for you to contact me about it on WhatsApp, Instagram and email. I understand my files are deleted from the portal after 90 days.</span>
              </label>
              <label style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 16, fontWeight: 700, color: "#222" }}>
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
                <span>Optional: I would like to hear about other things Social Media Sister makes.</span>
              </label>
              {msg && <div className="ps-err">{msg}</div>}
              <button className="ps-btn" disabled={stage === "sending"} onClick={send}>{stage === "sending" ? "Sending your details" : "Get my December Bundle"}</button>
            </div>
          )}
        </>)}

        {stage === "pay" && (<>
          <h1 className="ps-h1">{who ? `${who.split(" ")[0]}, ` : ""}one last <span>step</span></h1>
          <p className="ps-p">Your details are safe with me. Pay {owed || "the price"} on Monzo, then tap the pink button underneath so I know to look. Please use your name as the payment reference so I can find you.</p>
          <div className="ps-card">
            {payUrl && <a className="ps-btn" href={payUrl} target="_blank" rel="noreferrer">Pay {owed} on Monzo</a>}
            <button className="ps-btn alt" onClick={paid}>I have paid</button>
            <p style={{ fontSize: 14, color: "#555", marginTop: 14 }}>Keep this page. If you close it, the link in your browser history brings you back.</p>
          </div>
        </>)}

        {stage === "free" && (<>
          <h1 className="ps-h1">You are <span>in</span>. This one is on me</h1>
          <p className="ps-p">I will make your 20 Christmas posts and 10 Christmas photos and send you your own private portal link. This page updates by itself, so pop back when you like.</p>
        </>)}

        {stage === "claimed" && (<>
          <h1 className="ps-h1">Thank <span>you</span>. I am on it</h1>
          <p className="ps-p">I will check my Monzo, make your 20 Christmas posts and 10 Christmas photos and send you your own private portal link. This page updates by itself, so pop back when you like.</p>
        </>)}

        {stage === "ready" && (<>
          <h1 className="ps-h1">Your December Bundle is <span>ready</span></h1>
          <p className="ps-p">Tap the button and it is all yours.</p>
          <a className="ps-btn" href={`${BASE}/${slug}`}>Open my portal</a>
        </>)}
      </div>
    </div>
  );
}

type PortalItem = { id: string; kind: "post" | "photo"; label: string; url: string; n?: number };

export function BfDecView({ slug }: { slug: string }) {
  const [d, setD] = useState<{ name: string; ready: boolean; expired: boolean; items: PortalItem[]; expiresAt?: string } | null | "none">(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = "Your December Bundle";
    const load = () => fetch(`${API}/bfdec/view/${slug}`).then((r) => (r.ok ? r.json() : "none")).then(setD).catch(() => undefined);
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [slug]);
  const ext = (u: string) => (/\.jpe?g$/i.test(u) ? "jpg" : /\.webp$/i.test(u) ? "webp" : "png");
  const zip = async () => {
    if (!d || d === "none") return;
    setBusy(true);
    const z = new JSZip();
    let p = 0, f = 0;
    for (const it of d.items) {
      const blob = await (await fetch(`${BASE}${it.url}`)).blob();
      const n = it.kind === "post" ? ++p : ++f;
      z.file(`${it.kind === "post" ? "posts" : "photos"}/${it.kind}-${String(n).padStart(2, "0")}.${ext(it.url)}`, blob);
    }
    saveAs(await z.generateAsync({ type: "blob" }), "my-december-bundle.zip");
    setBusy(false);
  };
  const days = d && d !== "none" && d.expiresAt ? Math.max(0, Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000)) : null;
  const posts = d && d !== "none" ? d.items.filter((i) => i.kind === "post") : [];
  const photos = d && d !== "none" ? d.items.filter((i) => i.kind === "photo").sort((a, b) => (a.n ?? 99) - (b.n ?? 99)) : [];
  const grid = (list: PortalItem[], word: string) => (
    <div className="ps-grid">
      {list.map((im, i) => (
        <div key={im.id}>
          <a href={`${BASE}${im.url}`} target="_blank" rel="noreferrer"><img src={`${BASE}${im.url}`} alt={`${word} ${i + 1}`} loading="lazy" /></a>
          <a className="ps-btn alt" style={{ padding: "8px 12px", fontSize: 11 }} href={`${BASE}${im.url}`} download={`${word}-${i + 1}.${ext(im.url)}`}>Download</a>
        </div>
      ))}
    </div>
  );
  return (
    <div className="ps"><style>{PS_CSS}{XS_CSS}</style>
      <div className="ps-w">
        <div className="ps-k">DECEMBER BUNDLE</div>
        {d === null && <h1 className="ps-h1">Loading</h1>}
        {d === "none" && (<><h1 className="ps-h1">Hmm, <span>I cannot</span> find that</h1><p className="ps-p">Check the link I sent you, or message me and I will pop it over again.</p></>)}
        {d && d !== "none" && d.expired && (<><h1 className="ps-h1">This portal has <span>expired</span></h1><p className="ps-p">Your files stay for 90 days and then they are deleted. Message me if you would like another bundle.</p></>)}
        {d && d !== "none" && !d.expired && !d.ready && (<><h1 className="ps-h1">Your bundle is <span>cooking</span></h1><p className="ps-p">I am making your December content now. Keep this page open, it refreshes by itself when it is ready.</p></>)}
        {d && d !== "none" && !d.expired && d.ready && (<>
          <h1 className="ps-h1">{d.name.split(" ")[0]}, <span>here you go</span></h1>
          <p className="ps-p">Tap any piece to open it, or take the lot in one go. Everything stays here for {days ?? 90} more day{days === 1 ? "" : "s"}, so download it all and get December scheduled.</p>
          <button className="ps-btn" disabled={busy} onClick={zip}>{busy ? "Zipping" : `Download all ${d.items.length}`}</button>
          {posts.length > 0 && (<><div className="ps-k" style={{ marginTop: 30 }}>Your {posts.length} Christmas posts</div>{grid(posts, "post")}</>)}
          {photos.length > 0 && (<><div className="ps-k" style={{ marginTop: 30 }}>Your {photos.length} Christmas photos</div>{grid(photos, "photo")}</>)}
        </>)}
      </div>
    </div>
  );
}
