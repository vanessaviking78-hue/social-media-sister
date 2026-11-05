import { useEffect, useState } from "react";

// cybersuite.com/yearpass/:token : the private portal for a Year Pass buyer. Months open one at a time, a library holds the Stan Store extras.
// cybersuite.com/yearpass/start?session_id=... : where Stripe sends them after paying, which claims their portal.

const PINK = "#ff1f8e";
import { shrinkPhoto } from "@/lib/shrink-photo";
const INK = "#111";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Post = { n: number; day: string; label: string; images: string[]; caption: string; tags: string };
type Result = { posts: Post[]; stories: { n: number; image: string; question: string }[]; reels: { hook: string; script: string; onScreen: string }[] };
type Month = { n: number; status: "locked" | "open" | "submitted" | "published"; opens: string; monthName: string; result: Result | null; answers: { treatments: string[] } | null };
type Portal = { clinicName: string; prefill: { clinicName: string; handle: string; area: string; mainHex: string } | null; months: Month[]; library: { id: number; title: string; description: string; url: string; kind: string }[] };

const TREATMENTS = ["Dermal filler", "Lip filler", "Skin boosters", "Polynucleotides", "Profhilo", "Microneedling", "Chemical peels", "HydraFacial", "PRP", "LED light therapy", "Dermaplaning", "Facials", "HIFU", "Body contouring", "Laser hair removal", "Skin consultations", "Teeth whitening", "Skincare range"];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.yp, .yp * { font-family:'League Spartan',sans-serif !important; font-weight:900 !important; box-sizing:border-box; }
.yp { background:#fff; color:${INK}; min-height:100vh; }
.yp-w { max-width:1000px; margin:0 auto; padding:0 24px 80px; }
.yp-top { display:flex; justify-content:space-between; padding:28px 0; letter-spacing:.28em; font-size:12px; text-transform:uppercase; }
.yp-pink { color:${PINK}; }
.yp-h1 { font-size:clamp(44px,9vw,96px); line-height:.9; text-transform:uppercase; margin:14px 0 16px; letter-spacing:-.02em; }
.yp-h1 span { color:${PINK}; }
.yp-lede { font-size:clamp(17px,2.2vw,22px); line-height:1.3; max-width:640px; }
.yp-tabs { display:flex; margin-top:34px; border-bottom:3px solid ${INK}; }
.yp-tab { flex:1; background:#fff; color:${INK}; border:0; padding:18px 8px; font-size:clamp(14px,3vw,22px); letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
.yp-tab.on { background:${PINK}; color:#fff; }
.yp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:16px; margin-top:28px; }
.yp-card { border:2px solid ${INK}; padding:18px; background:#fff; text-align:left; cursor:pointer; color:${INK}; }
.yp-card.locked { opacity:.45; cursor:default; }
.yp-card.pub { background:${PINK}; color:#fff; border-color:${PINK}; }
.yp-card b { display:block; font-size:34px; line-height:1; }
.yp-card small { display:block; font-size:13px; letter-spacing:.12em; text-transform:uppercase; margin-top:8px; }
.yp-btn { background:${PINK}; color:#fff; border:0; padding:12px 18px; font-size:13px; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; margin:0 8px 8px 0; text-decoration:none; display:inline-block; }
.yp-btn.k { background:${INK}; }
.yp-btn:disabled { opacity:.5; cursor:default; }
.yp-box { border:2px solid ${INK}; padding:22px; margin-top:24px; }
.yp-l { display:block; font-size:12px; letter-spacing:.2em; text-transform:uppercase; margin:16px 0 6px; }
.yp-in, .yp-ta { width:100%; border:2px solid ${INK}; background:#fff; color:${INK}; padding:12px; font-size:17px; }
.yp-chips { display:flex; flex-wrap:wrap; gap:8px; }
.yp-chip { border:2px solid ${INK}; background:#fff; color:${INK}; padding:8px 12px; font-size:14px; cursor:pointer; }
.yp-chip.on { background:${PINK}; border-color:${PINK}; color:#fff; }
.yp-err { color:#c4004f; margin-top:12px; }
.yp-post { padding:36px 0 28px; border-bottom:1px solid #e7e7e7; }
.yp-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; margin-bottom:12px; }
.yp-strip { display:flex; gap:14px; overflow-x:auto; padding-bottom:10px; }
.yp-strip img { height:min(70vh,760px); width:auto; max-width:90vw; flex:none; display:block; box-shadow:0 18px 40px -22px rgba(0,0,0,.45); }
.yp-cap { white-space:pre-wrap; font-size:15px; line-height:1.4; margin:12px 0; font-weight:700 !important; }
.yp-stories { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:26px; margin-top:24px; }
.yp-lib { display:flex; justify-content:space-between; gap:16px; align-items:center; border-bottom:1px solid #e7e7e7; padding:18px 0; }
.yp-lib small { display:block; color:#666; font-size:14px; margin-top:4px; font-weight:700 !important; }
`;

const dl = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};
const fileOf = async (url: string) => (await fetch(url)).blob();

function MonthForm({ token, month, prefill, onDone }: { token: string; month: Month; prefill: Portal["prefill"]; onDone: () => void }) {
  const [clinic, setClinic] = useState(prefill?.clinicName || "");
  const [handle, setHandle] = useState(prefill?.handle || "");
  const [area, setArea] = useState(prefill?.area || "");
  const [hexc, setHexc] = useState(prefill?.mainHex || "#d6006f");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 6 ? [...p, t] : p));
  const submit = async () => {
    setErr("");
    const list = [...picked, ...other.split(",").map((x) => x.trim()).filter(Boolean)].slice(0, 8);
    if (!clinic.trim()) return setErr("Please add your clinic name");
    if (!list.length) return setErr("Please pick at least one treatment to promote");
    const fd = new FormData();
    fd.append("clinicName", clinic); fd.append("handle", handle); fd.append("area", area); fd.append("mainHex", hexc);
    fd.append("treatments", JSON.stringify(list)); fd.append("notes", notes);
    if (photo) fd.append("photo", photo);
    if (logo) fd.append("logo", logo);
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/yearpass/${token}/month/${month.n}`, { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Something went wrong");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  };
  return (
    <div className="yp-box">
      <div className="yp-k">Month {month.n} · {month.monthName}</div>
      <p className="yp-lede" style={{ fontSize: 18 }}>Tell me what you would like to promote this month and send me a photo of you. I build your 20 posts, check every one by hand, then they appear here.</p>
      <label><span className="yp-l">Clinic name</span><input className="yp-in" value={clinic} onChange={(e) => setClinic(e.target.value)} /></label>
      <label><span className="yp-l">Instagram handle</span><input className="yp-in" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourclinic" /></label>
      <label><span className="yp-l">Town or area (for your hashtags)</span><input className="yp-in" value={area} onChange={(e) => setArea(e.target.value)} /></label>
      <label><span className="yp-l">Your brand colour</span><input type="color" value={hexc} onChange={(e) => setHexc(e.target.value)} style={{ width: 90, height: 48, border: 0, background: "none" }} /></label>
      <span className="yp-l">Treatments to promote this month (pick up to 6)</span>
      <div className="yp-chips">{TREATMENTS.map((t) => <button type="button" key={t} className={`yp-chip${picked.includes(t) ? " on" : ""}`} onClick={() => toggle(t)}>{t}</button>)}</div>
      <label><span className="yp-l">Anything else? Type it here, separated by commas</span><input className="yp-in" value={other} onChange={(e) => setOther(e.target.value)} /></label>
      <label><span className="yp-l">Offers, dates or news I should know about</span><textarea className="yp-ta" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label><span className="yp-l">A clear photo of you {month.n > 1 ? "(optional, I will reuse your last one)" : ""}</span><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; setPhoto(f ? await shrinkPhoto(f) : null); }} /></label>
      <label><span className="yp-l">Your logo, a PNG with a see through background is best {month.n > 1 ? "(optional)" : ""}</span><input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></label>
      {err && <div className="yp-err">{err}</div>}
      <p style={{ marginTop: 20 }}><button className="yp-btn" disabled={busy} onClick={submit}>{busy ? "Sending..." : "Send to Vanessa"}</button></p>
    </div>
  );
}

function MonthView({ month }: { month: Month }) {
  const [tab, setTab] = useState<"posts" | "stories" | "reels">("posts");
  const [zipping, setZipping] = useState(false);
  const r = month.result!;
  const slides = async (p: Post) => {
    if (p.images.length === 1) return dl(await fileOf(p.images[0]), `post-${p.n}.jpg`);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [i, u] of p.images.entries()) zip.file(`post-${p.n}-slide-${i + 1}.jpg`, await fileOf(u));
    dl(await zip.generateAsync({ type: "blob" }), `post-${p.n}-slides.zip`);
  };
  const caption = (p: Post) => dl(new Blob([`${p.caption}\n\n${p.tags}`], { type: "text/plain" }), `post-${p.n}-caption.txt`);
  const all = async () => {
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of r.posts) {
        for (const [i, u] of p.images.entries()) zip.file(`posts/post-${p.n}-${i + 1}.jpg`, await fileOf(u));
        zip.file(`posts/post-${p.n}-caption.txt`, `${p.caption}\n\n${p.tags}`);
      }
      for (const s of r.stories) if (s.image) { zip.file(`stories/story-${s.n}.jpg`, await fileOf(s.image)); if (s.question) zip.file(`stories/story-${s.n}-question.txt`, s.question); }
      if (r.reels.length) zip.file("reel-scripts.txt", r.reels.map((h, i) => `${i + 1}. ${h.hook}\nScript: ${h.script}\nOn screen: ${h.onScreen}`).join("\n\n"));
      dl(await zip.generateAsync({ type: "blob" }), `${month.monthName.replace(/\s+/g, "-").toLowerCase()}-content.zip`);
    } finally { setZipping(false); }
  };
  return (
    <div>
      <p style={{ marginTop: 24 }}><button className="yp-btn k" disabled={zipping} onClick={all}>{zipping ? "Packing it up..." : "Save the whole month in one go"}</button></p>
      <div className="yp-tabs" style={{ marginTop: 10 }}>
        {(["posts", "stories", "reels"] as const).map((t) => <button key={t} className={`yp-tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>{t === "reels" ? "Reel scripts" : t}</button>)}
      </div>
      {tab === "posts" && r.posts.map((p) => (
        <div className="yp-post" key={p.n}>
          <div className="yp-k">Post {p.n}{p.day ? ` · ${p.day}` : ""}{p.label ? ` · ${p.label}` : ""}</div>
          <div className="yp-strip">{p.images.map((u, i) => <img key={u + i} src={u} alt={`Post ${p.n} slide ${i + 1}`} loading="lazy" />)}</div>
          <div className="yp-cap">{p.caption}{p.tags ? `\n\n${p.tags}` : ""}</div>
          <button className="yp-btn" onClick={() => slides(p)}>{p.images.length > 1 ? "Download slides" : "Download image"}</button>
          <button className="yp-btn k" onClick={() => caption(p)}>Download caption</button>
          <button className="yp-btn k" onClick={() => navigator.clipboard.writeText(`${p.caption}\n\n${p.tags}`).catch(() => undefined)}>Copy caption</button>
        </div>
      ))}
      {tab === "stories" && (
        <div className="yp-stories">
          {r.stories.map((s) => (
            <div key={s.n}>
              {s.image && <img src={s.image} alt={`Story ${s.n}`} style={{ width: "100%", display: "block" }} loading="lazy" />}
              {s.question && <div className="yp-cap">{s.question}</div>}
              {s.image && <button className="yp-btn k" onClick={async () => dl(await fileOf(s.image), `story-${s.n}.jpg`)}>Download story</button>}
            </div>
          ))}
        </div>
      )}
      {tab === "reels" && r.reels.map((h, i) => (
        <div key={i} style={{ padding: "18px 0", borderBottom: "1px solid #e7e7e7" }}>
          <div className="yp-k">Reel {i + 1}</div>
          <div style={{ fontSize: 20, lineHeight: 1.25 }}>{h.hook}</div>
          {h.script && <div className="yp-cap"><span className="yp-pink">Script: </span>{h.script}</div>}
          {h.onScreen && <div className="yp-cap"><span className="yp-pink">On screen: </span>{h.onScreen}</div>}
        </div>
      ))}
    </div>
  );
}

function Claim() {
  const [err, setErr] = useState("");
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session_id") || "";
    if (!sid) { setErr("I could not see a payment reference. Please open the link from your payment email."); return; }
    fetch(`${BASE}/api/yearpass/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid }) })
      .then(async (r) => { const d = (await r.json()) as { token?: string; error?: string }; if (!r.ok || !d.token) throw new Error(d.error || "Something went wrong"); try { localStorage.setItem("yp-token", d.token); } catch { /* ignore */ } window.location.replace(`${BASE}/yearpass/${d.token}?welcome=1`); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Something went wrong"));
  }, []);
  return <div className="yp"><style>{CSS}</style><div className="yp-w"><div className="yp-top"><span>Social Media Sister</span></div><h1 className="yp-h1">{err ? <>Hmm.<br /><span>One moment.</span></> : <>Setting up<br /><span>your portal</span></>}</h1><p className="yp-lede">{err || "Hold tight, this takes a few seconds."}</p></div></div>;
}

export default function YearPass({ token }: { token: string }) {
  if (token === "start") return <Claim />;
  return <Portal token={token} />;
}

function Portal({ token }: { token: string }) {
  const [data, setData] = useState<Portal | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<"months" | "library">("months");
  const [open, setOpen] = useState<number | null>(null);
  const welcome = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1";
  const load = () => fetch(`${BASE}/api/yearpass/${encodeURIComponent(token)}`).then(async (r) => (r.ok ? setData(await r.json()) : setMissing(true))).catch(() => setMissing(true));
  useEffect(() => {
    document.title = "Your Year Pass";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    void load();
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (missing) return <div className="yp"><style>{CSS}</style><div className="yp-w"><div className="yp-top"><span>Social Media Sister</span></div><h1 className="yp-h1">Hmm.<br /><span>Not found.</span></h1><p className="yp-lede">That link does not look right. Please message me and I will send it again.</p></div></div>;
  if (!data) return <div className="yp"><style>{CSS}</style></div>;
  const sel = open ? data.months.find((m) => m.n === open) : null;

  return (
    <div className="yp">
      <style>{CSS}</style>
      <div className="yp-w">
        <div className="yp-top"><span>Social Media Sister</span><span className="yp-pink">{data.clinicName}</span></div>
        <h1 className="yp-h1">Your <span>year</span> of content</h1>
        <p className="yp-lede">Twelve months, twenty posts a month, with stories and reel scripts to match. Each month opens here. Bookmark this page, it is yours for the year.</p>
        {welcome && <div className="yp-box" style={{ background: PINK, color: "#fff", borderColor: PINK }}>Thank you, you are in. Bookmark this page now. Month 1 is open, so pick it below and tell me what to promote.</div>}

        <div className="yp-tabs">
          <button className={`yp-tab${tab === "months" ? " on" : ""}`} onClick={() => { setTab("months"); setOpen(null); }}>My months</button>
          <button className={`yp-tab${tab === "library" ? " on" : ""}`} onClick={() => setTab("library")}>Library</button>
        </div>

        {tab === "months" && !sel && (
          <div className="yp-grid">
            {data.months.map((m) => (
              <button key={m.n} className={`yp-card${m.status === "locked" ? " locked" : ""}${m.status === "published" ? " pub" : ""}`} disabled={m.status === "locked"} onClick={() => setOpen(m.n)}>
                <b>{m.n}</b>
                <small>{m.monthName}</small>
                <small>{m.status === "locked" ? "Opens soon" : m.status === "open" ? "Ready for your answers" : m.status === "submitted" ? "I am building it" : "Ready to download"}</small>
              </button>
            ))}
          </div>
        )}

        {tab === "months" && sel && (
          <div style={{ marginTop: 28 }}>
            <button className="yp-btn k" onClick={() => setOpen(null)}>All months</button>
            {sel.status === "open" && <MonthForm token={token} month={sel} prefill={data.prefill} onDone={() => { void load(); }} />}
            {sel.status === "submitted" && <div className="yp-box"><div className="yp-k">Month {sel.n} · {sel.monthName}</div><p className="yp-lede">Thank you, I have your answers{sel.answers?.treatments?.length ? ` for ${sel.answers.treatments.join(", ")}` : ""}. I am building your 20 posts and checking each one by hand. I will message you the moment they are here.</p></div>}
            {sel.status === "published" && sel.result && <MonthView month={sel} />}
          </div>
        )}

        {tab === "library" && (
          <div style={{ marginTop: 28 }}>
            {data.library.length === 0 && <p className="yp-lede">Your library is being filled. Check back soon.</p>}
            {data.library.map((l) => (
              <div className="yp-lib" key={l.id}>
                <div><div style={{ fontSize: 22 }}>{l.title}</div>{l.description && <small>{l.description}</small>}</div>
                <a className="yp-btn" href={l.url} target="_blank" rel="noreferrer">{l.kind === "file" ? "Download" : "Open"}</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
