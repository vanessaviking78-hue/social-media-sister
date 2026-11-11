import { PREMIUM_FONTS } from "@/lib/tenfree-fonts";
import { injectSuiteFontCss } from "@/lib/suite-fonts";
import { useEffect, useRef, useState } from "react";
import { TENFREE_WHATSAPP } from "@/lib/tenfree-config";
import { canvasToPng, makeClearLogo } from "@/lib/logo-clear";
import { shrinkPhoto } from "@/lib/shrink-photo";

// cybersuite.com/hammeredfreeies : the Hammered (construction) freebies form. A copy of the premium freebies page: same fonts and layout, bright yellow in place of hot pink.

const PINK = "#ffd60a"; // Hammered bright yellow (not hi-vis). Named PINK only so the copied CSS below stays identical.
const INK = "#111111";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.tf, .tf * { font-family: 'League Spartan', sans-serif !important; font-weight: 900 !important; box-sizing: border-box; }
${PREMIUM_FONTS.map((ft) => `.tf .ff-${ft.id}, .tf .ff-${ft.id} * { font-family: "${ft.family}", serif !important; font-weight: 400 !important; }`).join("\n")}
.tf { background: #fff; color: ${INK}; min-height: 100vh; -webkit-font-smoothing: antialiased; }
.tf ::placeholder { color: #b9b9b9; font-weight: 900; }
.tf-wrap { max-width: 880px; margin: 0 auto; padding: 0 24px; }
.tf-top { display:flex; justify-content:space-between; align-items:center; padding: 28px 0; letter-spacing: .28em; font-size: 12px; text-transform: uppercase; }
.tf-top i { display:block; width:56px; height:6px; background:${PINK}; }
.tf-hero { padding: 56px 0 40px; }
.tf-kicker { color:${INK}; background:${PINK}; display:inline-block; padding:4px 10px; letter-spacing:.32em; font-size:12px; text-transform:uppercase; }
.tf-h1 { font-size: clamp(54px, 11vw, 124px); line-height: .9; letter-spacing: -.02em; text-transform: uppercase; margin: 18px 0 22px; }
.tf-h1 span { color:${INK}; background:${PINK}; padding:0 .1em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.tf-lede { font-size: clamp(18px, 2.4vw, 24px); line-height:1.3; max-width: 620px; }
.tf-list { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px,1fr)); gap: 0; margin: 40px 0 8px; border-top: 3px solid ${INK}; }
.tf-list div { padding: 18px 16px 18px 0; border-bottom: 1px solid #e7e7e7; font-size: 15px; letter-spacing:.04em; text-transform: uppercase; }
.tf-list b { color:${INK}; background:${PINK}; padding:0 6px; margin-right:8px; }
.tf-sec { padding: 54px 0 4px; }
.tf-sec h2 { font-size: clamp(30px, 5vw, 46px); text-transform: uppercase; letter-spacing:-.01em; line-height:1; margin: 0 0 6px; }
.tf-sec p.sub { font-size: 16px; color:#666; margin: 0 0 22px; max-width: 560px; line-height:1.35; }
.tf-num { color:${INK}; background:${PINK}; display:inline-block; padding:2px 8px; letter-spacing:.3em; font-size:12px; }
.tf-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 18px 22px; }
@media (max-width: 640px) { .tf-grid { grid-template-columns: 1fr; } }
.tf-f { display:flex; flex-direction:column; gap:6px; }
.tf-f.full { grid-column: 1 / -1; }
.tf-l { font-size: 12px; letter-spacing:.2em; text-transform: uppercase; }
.tf-in, .tf-ta { border:0; border-bottom: 2px solid ${INK}; padding: 12px 0; font-size: 20px; background: transparent; outline: none; border-radius:0; width:100%; color:${INK}; }
.tf-ta { min-height: 84px; resize: vertical; line-height:1.3; }
.tf-in:focus, .tf-ta:focus { border-bottom-color:${PINK}; box-shadow: 0 3px 0 0 ${PINK}; }
.tf-drop { border: 2px dashed ${INK}; padding: 26px; display:flex; align-items:center; gap: 22px; cursor:pointer; transition: border-color .2s, background .2s; }
.tf-drop:hover { border-color:${INK}; background:#fffbe0; }
.tf-chk { width: 150px; height: 110px; flex: none; background-image: linear-gradient(45deg,#e9e9e9 25%,transparent 25%),linear-gradient(-45deg,#e9e9e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9e9e9 75%),linear-gradient(-45deg,transparent 75%,#e9e9e9 75%); background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; display:flex; align-items:center; justify-content:center; border:1px solid #ddd; }
.tf-chk img { max-width: 88%; max-height: 88%; }
.tf-note { font-size: 13px; letter-spacing:.06em; color:#777; margin-top:8px; text-transform: uppercase; }
.tf-pink { color:${INK}; background:${PINK}; padding:0 6px; }
.tf-colours { display:flex; gap: 26px; align-items:center; flex-wrap: wrap; }
.tf-col { display:flex; align-items:center; gap:12px; font-size:12px; letter-spacing:.2em; text-transform:uppercase; }
.tf-col input { width:54px; height:54px; border:0; padding:0; background:none; cursor:pointer; }
.tf-grp { margin-top: 26px; }
.tf-grp h3 { font-size: 13px; letter-spacing:.28em; text-transform: uppercase; color:${INK}; background:${PINK}; display:inline-block; padding:3px 9px; margin: 0 0 12px; }
.tf-chips { display:flex; flex-wrap:wrap; gap: 10px; }
.tf-chip { border: 2px solid ${INK}; padding: 10px 16px; font-size: 14px; letter-spacing:.06em; text-transform: uppercase; background:#fff; cursor:pointer; transition: all .15s; color:${INK}; }
.tf-chip:hover { background:#fffbe0; }
.tf-chip.on { background:${PINK}; border-color:${INK}; color:${INK}; }
.tf-mum { display:flex; gap:10px; flex-wrap:wrap; }
.tf-consent { display:flex; gap:14px; align-items:flex-start; margin-top: 40px; font-size: 15px; line-height:1.35; cursor:pointer; }
.tf-consent input { width: 24px; height:24px; accent-color:#111; flex:none; margin-top:2px; }
.tf-go { margin: 30px 0 10px; background:${PINK}; color:${INK}; border:3px solid ${INK}; padding: 24px 40px; font-size: 22px; letter-spacing:.18em; text-transform: uppercase; cursor:pointer; width:100%; transition: transform .15s, box-shadow .15s; }
.tf-go:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 30px -12px ${PINK}; }
.tf-go:disabled { opacity:.55; cursor: default; }
.tf-err { color:#c00020; font-size:16px; margin-top: 14px; line-height:1.3; }
.tf-foot { padding: 70px 0 60px; font-size: 12px; letter-spacing:.24em; text-transform: uppercase; color:#999; }
.tf-done { padding: 120px 0; }
`;

type Colours = { main: string; accent: string };
const hx = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

async function coloursFromCanvas(c: HTMLCanvasElement): Promise<Colours | null> {
  try {
    const s = 64;
    const t = document.createElement("canvas");
    t.width = s;
    t.height = s;
    const ctx = t.getContext("2d")!;
    ctx.drawImage(c, 0, 0, s, s);
    const px = ctx.getImageData(0, 0, s, s).data;
    const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
      if (a < 200) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx > 235 && mn > 225) continue;
      if (mx - mn < 24) continue;
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      bins.set(key, e);
    }
    const top = [...bins.values()].sort((x, y) => y.n - x.n);
    if (!top.length) return null;
    const one = (e: { n: number; r: number; g: number; b: number }) => hx(e.r / e.n, e.g / e.n, e.b / e.n);
    const d = (x: (typeof top)[number], y: (typeof top)[number]) => Math.abs(x.r / x.n - y.r / y.n) + Math.abs(x.g / x.n - y.g / y.n) + Math.abs(x.b / x.n - y.b / y.n);
    const second = top.slice(1).find((e) => d(top[0], e) > 90) ?? top[1] ?? top[0];
    return { main: one(top[0]), accent: one(second) };
  } catch {
    return null;
  }
}

async function toUsable(file: File): Promise<File> {
  const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!heic) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, "") + ".jpg", { type: "image/jpeg" });
}

// How many of each post the 5 day trial gives. Change these numbers and the page wording follows.
const TRIAL = { work: 2, about: 2, fun: 2 };
const TRIAL_TOTAL = TRIAL.work + TRIAL.about + TRIAL.fun;

const TRADES = ["Builder", "Plumber", "Electrician", "Roofer", "Joiner or carpenter", "Plasterer", "Landscaper", "Kitchen or bathroom fitter", "Decorator", "Heating engineer", "Groundworker", "Other trade"];

// The jobs a tradesperson can pick to feature in their work posts.
const JOB_GROUPS: { id: string; label: string; items: string[] }[] = [
  { id: "build", label: "Building and structure", items: ["Extensions", "Loft conversions", "New builds", "Renovations", "Garage conversions", "Brickwork", "Groundworks", "Roofing"] },
  { id: "inside", label: "Inside the home", items: ["Kitchens", "Bathrooms", "Plastering", "Decorating", "Flooring", "Carpentry and joinery", "Fitted wardrobes"] },
  { id: "systems", label: "Plumbing, heating and electrics", items: ["Boilers and heating", "Plumbing repairs", "Rewires", "Fuse boards", "EV chargers", "Lighting"] },
  { id: "outside", label: "Outside", items: ["Driveways", "Patios and paving", "Fencing", "Decking", "Garden landscaping", "Gutters"] },
];

export default function HammeredFreebies() {
  const [f, setF] = useState({ clinicianName: "", clinicName: "", email: "", handle: "", area: "", website: "", whatsapp: "", bizType: "", years: "", hobbies: "", pets: "", why: "", threeWords: "", personality: "", font: "hatcher", passion: "", funny: "" });
  useEffect(() => { injectSuiteFontCss(); }, []);
  const [cols, setCols] = useState<Colours>({ main: "#ffd60a", accent: "#111111" });
  const [ticked, setTicked] = useState<string[]>([]);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const photosRef = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Hammered freebies";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    return () => {
      m.remove();
    };
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setErr("");
    try {
      const usable = await toUsable(file);
      const clear = await makeClearLogo(usable);
      const blob = await canvasToPng(clear);
      setLogoBlob(blob);
      setLogoPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const c = await coloursFromCanvas(clear);
      if (c) setCols(c);
    } catch {
      setErr("I could not read that logo. A PNG or JPG works best.");
    } finally {
      setLogoBusy(false);
    }
  }

  // Up to three photos in one go: you, the van, a job you are proud of. Each one is shrunk so a big phone photo uploads easily.
  async function onPhotos(list: FileList | null) {
    if (!list || !list.length) return;
    try {
      setErr("");
      const made: File[] = [];
      for (const file of Array.from(list).slice(0, 3)) made.push(await shrinkPhoto(await toUsable(file)));
      setPhotos((old) => [...old, ...made].slice(0, 3));
    } catch {
      setErr("I could not read one of those photos, a JPG or PNG will work.");
    }
  }

  const toggle = (name: string) => setTicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 3 ? [...p.slice(1), name] : [...p, name]));

  async function submit() {
    setErr("");
    if (photos.length < 1) return setErr("Please add at least 1 photo. You on a job, you with the van or a job you are proud of all work.");
    if (!f.bizType) return setErr("Please tell me which trade you are.");
    if (!consent) return setErr("Please tick the box at the bottom so I know you are happy.");
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      fd.append("mainHex", cols.main);
      fd.append("accentHex", cols.accent);
      fd.append("treatments", JSON.stringify(ticked));
      fd.append("consent", "yes");
      fd.append("kind", "hammered");
      if (logoBlob) fd.append("logo", new File([logoBlob], "logo.png", { type: "image/png" }));
      photos.forEach((ph) => fd.append("photos", ph));
      const r = await fetch("/api/ten-free/intake", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) setRepeat(true);
      if (!r.ok) throw new Error(j.error || "Something went wrong, please try again");
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong, please try again");
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, k: keyof typeof f, o: { ph?: string; type?: string; full?: boolean; area?: boolean } = {}) => (
    <label className={`tf-f${o.full ? " full" : ""}`}>
      <span className="tf-l">{label}</span>
      {o.area ? <textarea className="tf-ta" placeholder={o.ph} value={f[k]} onChange={set(k)} /> : <input className="tf-in" type={o.type || "text"} placeholder={o.ph} value={f[k]} onChange={set(k)} />}
    </label>
  );

  return (
    <div className="tf">
      <style>{CSS}</style>
      <div className="tf-wrap">
        <div className="tf-top">
          {/* The Hammered logo goes here once it is supplied. */}
          <span>Hammered</span>
          <i />
        </div>

        {done ? (
          <div className="tf-done">
            <div className="tf-kicker">Got it</div>
            <h1 className="tf-h1">
              Right then.<br />
              <span>I have got your stuff.</span>
            </h1>
            <p className="tf-lede">I will get your posts made and over to you as soon as I can. I will send you a WhatsApp and an email. Have a look, and tell me what to change. Thanks for giving it a go.</p>
            <p className="tf-lede" style={{ marginTop: 28 }}>Know another tradesperson who could do with some decent posts? Send them this.</p>
            <a className="tf-go" style={{ display: "inline-block", textDecoration: "none" }} href={`https://wa.me/?text=${encodeURIComponent("I have just asked Hammered for a free 5 day trial of posts made from my own work and photos. Grab yours here: https://www.thecybersuite.com/hammeredfreeies")}`}>Share with another tradesperson</a>
          </div>
        ) : (
          <>
            <div className="tf-hero">
              <div className="tf-kicker">Free 5 day trial</div>
              <h1 className="tf-h1">
                Hammered <span>freebies</span>
              </h1>
              <p className="tf-lede">Proper posts that show people you are the trustworthy one to call. Tell me a little about you and your work. I build your posts in your colours with your logo and your own photos, plus matching stories and reel scripts, and you tell me what to tweak.</p>
              <div className="tf-list">
                <div><b>{TRIAL.work}</b>Work posts</div>
                <div><b>{TRIAL.about}</b>About you posts</div>
                <div><b>{TRIAL.fun}</b>Fun posts</div>
                <div><b>{TRIAL_TOTAL}</b>Matching stories</div>
                <div><b>{TRIAL_TOTAL}</b>Reel scripts</div>
                <div><b>3</b>Photos of you and your work</div>
              </div>
            </div>

            <div style={{ border: "3px solid #111", borderRadius: 12, padding: "16px 18px", margin: "0 0 22px", background: "rgba(255,214,10,.22)" }}>
              <div style={{ fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: ".03em", color: "#111" }}>The more you tell me, the better your posts get</div>
              <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.5 }}>The more detail you give me, the more personal your posts will be. Chatty answers, little stories and daft facts all help. Take your time with the boxes below.</p>
            </div>

            <div className="tf-sec">
              <div className="tf-num">01</div>
              <h2>The basics</h2>
              <p className="sub">These come straight to me, so please use the email you check.</p>
              <div className="tf-grid">
                {field("Your name", "clinicianName", { ph: "Dave Smith" })}
                {field("Business name", "clinicName", { ph: "Smith and Son Roofing" })}
                {field("Email", "email", { type: "email", ph: "you@yourbusiness.co.uk" })}
                {field("Instagram or Facebook page name", "handle", { ph: "@yourbusiness" })}
                {field("Where do you work?", "area", { ph: "Leeds and surrounding areas" })}
                {field("Website (if you have one)", "website", { ph: "www.yourbusiness.co.uk" })}
                {field("WhatsApp number (I send your link here)", "whatsapp", { ph: "07700 900123" })}
              </div>
            </div>

            <div className="tf-sec">
              <div className="tf-num">02</div>
              <h2>Your look</h2>
              <p className="sub">Add your logo if you have one and I take the background off for you, right here.</p>
              <div className="tf-drop" onClick={() => logoRef.current?.click()}>
                <div className="tf-chk">{logoPreview ? <img src={logoPreview} alt="Your logo with a see through background" /> : <span className="tf-l tf-pink">Logo</span>}</div>
                <div>
                  <div style={{ fontSize: 22, textTransform: "uppercase" }}>{logoBusy ? "Taking the background off..." : logoPreview ? "Background gone. Tap to change" : "Tap to add your logo"}</div>
                  <div className="tf-note">PNG or JPG. The chequered squares mean it is see through.</div>
                </div>
                <input ref={logoRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              </div>
              <div className="tf-l" style={{ marginTop: 26 }}>What are your 2 main branding colours?</div>
              <div className="tf-colours" style={{ marginTop: 10 }}>
                <label className="tf-col">
                  <input type="color" value={cols.main} onChange={(e) => setCols((c) => ({ ...c, main: e.target.value }))} />
                  Main colour
                </label>
                <label className="tf-col">
                  <input type="color" value={cols.accent} onChange={(e) => setCols((c) => ({ ...c, accent: e.target.value }))} />
                  Second colour
                </label>
              </div>
              <div className="tf-note">I picked these from your logo. Change them if I missed.</div>
              <div className="tf-drop" style={{ marginTop: 26 }} onClick={() => photosRef.current?.click()}>
                <div className="tf-l" style={{ width: 150, flex: "none" }}>{photos.length >= 3 ? "3 photos added" : `${photos.length} of 3 photos`}</div>
                <div>
                  <div style={{ fontSize: 22, textTransform: "uppercase" }}>{photos.length >= 3 ? "Tap to add more or start again" : "Add up to 3 photos (at least 1 needed)"}</div>
                  <div className="tf-note">You on a job, you with the van, a job you are proud of. No filter needed, nice and clear, in good light.</div>
                </div>
                <input ref={photosRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { onPhotos(e.target.files); e.target.value = ""; }} />
              </div>
              {photos.length > 0 && (
                <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                  {photos.map((ph, i) => (
                    <img key={i} src={URL.createObjectURL(ph)} alt={`Photo ${i + 1}`} style={{ height: 120, width: "auto", objectFit: "cover", border: `2px solid ${INK}` }} />
                  ))}
                  <button type="button" className="tf-chip" onClick={() => setPhotos([])}>Start again</button>
                </div>
              )}
            </div>

            <div className="tf-sec">
              <div className="tf-num">03</div>
              <h2>Which jobs do you want to show off?</h2>
              <p className="sub">Pick up to three. They become the work posts. Changed your mind? Tap a different one and it swaps in. {ticked.length} of 3 chosen.</p>
              {JOB_GROUPS.map((g) => (
                <div className="tf-grp" key={g.id}>
                  <h3>{g.label}</h3>
                  <div className="tf-chips">
                    {g.items.map((t) => (
                      <button type="button" key={t} className={`tf-chip${ticked.includes(t) ? " on" : ""}`} onClick={() => toggle(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="tf-sec">
              <div className="tf-num">04</div>
              <h2>A bit about you</h2>
              <p className="sub">This is where the personality comes from, so be yourself. People hire people they like.</p>
              <div className="tf-grid">
                <div className="tf-f full">
                  <span className="tf-l">Which trade are you? (tick one)</span>
                  <div className="tf-mum">
                    {TRADES.map((o) => (
                      <button type="button" key={o} className={`tf-chip${f.bizType === o ? " on" : ""}`} onClick={() => setF((p) => ({ ...p, bizType: o }))}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                {field("How many years have you been in the trade?", "years", { ph: "18 years, started as an apprentice" })}
                {field("Any pets?", "pets", { ph: "A very bossy spaniel called Gerald who rides in the van" })}
                {field("What are your hobbies?", "hobbies", { area: true, full: true, ph: "Fishing, football, restoring an old Land Rover" })}
                {field("How did you get into the trade?", "why", { area: true, full: true })}
                {field("Describe yourself in 3 words", "threeWords", { ph: "Reliable, tidy, chatty" })}
                {field("What do you love most about the job?", "passion", { area: true, full: true })}
                {field("What is the funniest thing that has happened on a job?", "funny", { area: true, full: true, ph: "The customer who made us a brew in a cup older than the apprentice" })}
                <div className="tf-f full">
                  <span className="tf-l">Pick the font for your headlines</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PREMIUM_FONTS.map((ft) => (
                      <button type="button" key={ft.id} onClick={() => setF((x) => ({ ...x, font: ft.id }))} className={`tf-in ff-${ft.id}`} style={{ width: "auto", cursor: "pointer", fontSize: 26, outline: f.font === ft.id ? `3px solid ${PINK}` : "none" }}>{ft.name}</button>
                    ))}
                  </div>
                </div>
                {field("Describe your personality, this is the voice your posts will be written in", "personality", { area: true, full: true, ph: "Straight talking, professional and polished, banter merchant, friendly local... or say it your own way" })}
                <div className="tf-f full" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Straight talking", "Professional and polished", "Banter merchant", "Friendly local", "Cheeky"].map((v) => (
                    <button type="button" key={v} className="tf-in" style={{ width: "auto", cursor: "pointer" }} onClick={() => setF((x) => ({ ...x, personality: v }))}>{v}</button>
                  ))}
                </div>
              </div>
            </div>

            <label className="tf-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I am happy for Hammered to use my logo, photos and details to build my free trial posts and to contact me about them.</span>
            </label>
            {err && <div className="tf-err">{err}</div>}
            {repeat && TENFREE_WHATSAPP && <a className="tf-go" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={`https://wa.me/${TENFREE_WHATSAPP}?text=${encodeURIComponent("Hi Vanessa, I have had my Hammered trial and would like to hear about the special rate")}`}>Ask about the special rate on WhatsApp</a>}
            <button className="tf-go" disabled={busy || logoBusy} onClick={submit}>
              {busy ? "Sending..." : "Send me my free trial posts"}
            </button>
            <div className="tf-note">I look at every request by hand. After your 5 days you can post them yourself, or I can post for you at a special rate.</div>
          </>
        )}
        <div className="tf-foot">Hammered</div>
      </div>
    </div>
  );
}
