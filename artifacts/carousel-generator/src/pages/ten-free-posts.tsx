import { useEffect, useMemo, useRef, useState } from "react";
import { U_GROUPS, U_TREATMENTS } from "@/lib/universal-treatments";
import { TENFREE_WHATSAPP } from "@/lib/tenfree-config";
import { canvasToPng, makeClearLogo } from "@/lib/logo-clear";

// cybersuite.com/10freeposts : the public form. League Spartan Black everywhere, white page, hot pink accents.

const PINK = "#ff1f8e";
const INK = "#111111";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.tf, .tf * { font-family: 'League Spartan', sans-serif !important; font-weight: 900 !important; box-sizing: border-box; }
.tf { background: #fff; color: ${INK}; min-height: 100vh; -webkit-font-smoothing: antialiased; }
.tf ::placeholder { color: #b9b9b9; font-weight: 900; }
.tf-wrap { max-width: 880px; margin: 0 auto; padding: 0 24px; }
.tf-top { display:flex; justify-content:space-between; align-items:center; padding: 28px 0; letter-spacing: .28em; font-size: 12px; text-transform: uppercase; }
.tf-top i { display:block; width:36px; height:3px; background:${PINK}; }
.tf-hero { padding: 56px 0 40px; }
.tf-kicker { color:${PINK}; letter-spacing:.32em; font-size:12px; text-transform:uppercase; }
.tf-h1 { font-size: clamp(54px, 11vw, 124px); line-height: .9; letter-spacing: -.02em; text-transform: uppercase; margin: 18px 0 22px; }
.tf-h1 span { color:${PINK}; }
.tf-lede { font-size: clamp(18px, 2.4vw, 24px); line-height:1.3; max-width: 620px; }
.tf-list { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px,1fr)); gap: 0; margin: 40px 0 8px; border-top: 3px solid ${INK}; }
.tf-list div { padding: 18px 16px 18px 0; border-bottom: 1px solid #e7e7e7; font-size: 15px; letter-spacing:.04em; text-transform: uppercase; }
.tf-list b { color:${PINK}; margin-right:8px; }
.tf-sec { padding: 54px 0 4px; }
.tf-sec h2 { font-size: clamp(30px, 5vw, 46px); text-transform: uppercase; letter-spacing:-.01em; line-height:1; margin: 0 0 6px; }
.tf-sec p.sub { font-size: 16px; color:#666; margin: 0 0 22px; max-width: 560px; line-height:1.35; }
.tf-num { color:${PINK}; letter-spacing:.3em; font-size:12px; }
.tf-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 18px 22px; }
@media (max-width: 640px) { .tf-grid { grid-template-columns: 1fr; } }
.tf-f { display:flex; flex-direction:column; gap:6px; }
.tf-f.full { grid-column: 1 / -1; }
.tf-l { font-size: 12px; letter-spacing:.2em; text-transform: uppercase; }
.tf-in, .tf-ta { border:0; border-bottom: 2px solid ${INK}; padding: 12px 0; font-size: 20px; background: transparent; outline: none; border-radius:0; width:100%; color:${INK}; }
.tf-ta { min-height: 84px; resize: vertical; line-height:1.3; }
.tf-in:focus, .tf-ta:focus { border-bottom-color:${PINK}; }
.tf-drop { border: 2px dashed ${INK}; padding: 26px; display:flex; align-items:center; gap: 22px; cursor:pointer; transition: border-color .2s, background .2s; }
.tf-drop:hover { border-color:${PINK}; background:#fff5fa; }
.tf-chk { width: 150px; height: 110px; flex: none; background-image: linear-gradient(45deg,#e9e9e9 25%,transparent 25%),linear-gradient(-45deg,#e9e9e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9e9e9 75%),linear-gradient(-45deg,transparent 75%,#e9e9e9 75%); background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; display:flex; align-items:center; justify-content:center; border:1px solid #ddd; }
.tf-chk img { max-width: 88%; max-height: 88%; }
.tf-note { font-size: 13px; letter-spacing:.06em; color:#777; margin-top:8px; text-transform: uppercase; }
.tf-pink { color:${PINK}; }
.tf-colours { display:flex; gap: 26px; align-items:center; flex-wrap: wrap; }
.tf-col { display:flex; align-items:center; gap:12px; font-size:12px; letter-spacing:.2em; text-transform:uppercase; }
.tf-col input { width:54px; height:54px; border:0; padding:0; background:none; cursor:pointer; }
.tf-grp { margin-top: 26px; }
.tf-grp h3 { font-size: 13px; letter-spacing:.28em; text-transform: uppercase; color:${PINK}; margin: 0 0 12px; }
.tf-chips { display:flex; flex-wrap:wrap; gap: 10px; }
.tf-chip { border: 2px solid ${INK}; padding: 10px 16px; font-size: 14px; letter-spacing:.06em; text-transform: uppercase; background:#fff; cursor:pointer; transition: all .15s; color:${INK}; }
.tf-chip:hover { border-color:${PINK}; }
.tf-chip.on { background:${PINK}; border-color:${PINK}; color:#fff; }
.tf-mum { display:flex; gap:10px; flex-wrap:wrap; }
.tf-consent { display:flex; gap:14px; align-items:flex-start; margin-top: 40px; font-size: 15px; line-height:1.35; cursor:pointer; }
.tf-consent input { width: 24px; height:24px; accent-color:${PINK}; flex:none; margin-top:2px; }
.tf-go { margin: 30px 0 10px; background:${PINK}; color:#fff; border:0; padding: 24px 40px; font-size: 22px; letter-spacing:.18em; text-transform: uppercase; cursor:pointer; width:100%; transition: transform .15s, box-shadow .15s; }
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

export default function TenFreePosts() {
  const [f, setF] = useState({ clinicianName: "", clinicName: "", email: "", handle: "", area: "", website: "", whatsapp: "", bizType: "", age: "", hobbies: "", mum: "", pets: "", why: "", threeWords: "", passion: "" });
  const [cols, setCols] = useState<Colours>({ main: "#c2185b", accent: "#1a1a1a" });
  const [ticked, setTicked] = useState<string[]>([]);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [tips, setTips] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "10 free posts";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    return () => {
      m.remove();
    };
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const groups = useMemo(() => U_GROUPS.map((g) => ({ ...g, items: U_TREATMENTS.filter((t) => t.group === g.id) })), []);

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

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await toUsable(file));
    } catch {
      setErr("I could not read that photo, a JPG or PNG will work.");
    }
  }

  const toggle = (name: string) => setTicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 3 ? p : [...p, name]));

  async function submit() {
    setErr("");
    if (!consent) return setErr("Please tick the box at the bottom so I know you are happy.");
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      fd.append("mainHex", cols.main);
      fd.append("accentHex", cols.accent);
      fd.append("treatments", JSON.stringify(ticked));
      fd.append("consent", "yes");
      if (logoBlob) fd.append("logo", new File([logoBlob], "logo.png", { type: "image/png" }));
      if (photo) fd.append("photo", photo);
      const r = await fetch("/api/ten-free/intake", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) setRepeat(true);
      if (!r.ok) throw new Error(j.error || "Something went wrong, please try again");
      if (tips && /^\S+@\S+\.\S+$/.test(f.email.trim())) {
        try {
          const body = new URLSearchParams({ EMAIL: f.email.trim(), FNAME: f.clinicianName.split(" ")[0] || "", b_0c0c86040f98ca351fa2dffbe_fc00c528ad: "" });
          await fetch("https://store.us10.list-manage.com/subscribe/post?u=0c0c86040f98ca351fa2dffbe&id=fc00c528ad", { method: "POST", mode: "no-cors", body });
        } catch { /* the free posts still go ahead */ }
      }
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
          <span>Social Media Sister</span>
          <i />
        </div>

        {done ? (
          <div className="tf-done">
            <div className="tf-kicker">Got it</div>
            <h1 className="tf-h1">
              Lovely.<br />
              <span>Sit tight.</span>
            </h1>
            <p className="tf-lede">Your details have landed with me. I check every one by hand, then build your posts and send you a private link. Keep an eye on your inbox, and your junk folder just in case.</p>
          </div>
        ) : (
          <>
            <div className="tf-hero">
              <div className="tf-kicker">One free turn per email</div>
              <h1 className="tf-h1">
                Your <span>10 free</span> posts
              </h1>
              <p className="tf-lede">Tell me a little about you and your clinic. I build ten posts in your colours with your logo, plus matching stories, reel hooks and a surprise at the end.</p>
              <div className="tf-list">
                <div><b>3</b>Treatment carousels</div>
                <div><b>2</b>About you</div>
                <div><b>1</b>Empowering post</div>
                <div><b>1</b>Safety post</div>
                <div><b>2</b>Just for fun</div>
                <div><b>1</b>This month</div>
                <div><b>10</b>Matching stories</div>
                <div><b>10</b>Reel hooks to film</div>
              </div>
            </div>

            <div className="tf-sec">
              <div className="tf-num">01</div>
              <h2>The basics</h2>
              <p className="sub">The emails come straight to me, so please use the one you check.</p>
              <div className="tf-grid">
                {field("Your name", "clinicianName", { ph: "Jane Smith" })}
                {field("Clinic name", "clinicName", { ph: "Glow Aesthetics" })}
                {field("Email", "email", { type: "email", ph: "you@clinic.co.uk" })}
                {field("Instagram handle", "handle", { ph: "@yourclinic" })}
                {field("Where are you based?", "area", { ph: "Leeds" })}
                {field("Website", "website", { ph: "www.yourclinic.co.uk" })}
                {field("WhatsApp number (I send your link here)", "whatsapp", { ph: "07700 900123" })}
              </div>
            </div>

            <div className="tf-sec">
              <div className="tf-num">02</div>
              <h2>Your look</h2>
              <p className="sub">Add your logo and I take the background off for you, right here.</p>
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
              <div className="tf-drop" style={{ marginTop: 26 }} onClick={() => photoRef.current?.click()}>
                <div className="tf-l" style={{ width: 150, flex: "none" }}>{photo ? "Photo added" : "Your photo"}</div>
                <div>
                  <div style={{ fontSize: 22, textTransform: "uppercase" }}>{photo ? photo.name : "Add a photo of you (optional)"}</div>
                  <div className="tf-note">A clear one with good light works best.</div>
                </div>
                <input ref={photoRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
              </div>
            </div>

            <div className="tf-sec">
              <div className="tf-num">03</div>
              <h2>Choose which 3 treatments you want to feature</h2>
              <p className="sub">Pick your three. They become your three treatment carousels. {ticked.length} of 3 chosen.</p>
              {groups.map((g) => (
                <div className="tf-grp" key={g.id}>
                  <h3>{g.label}</h3>
                  <div className="tf-chips">
                    {g.items.map((t) => (
                      <button type="button" key={t.id} className={`tf-chip${ticked.includes(t.name) ? " on" : ""}`} disabled={!ticked.includes(t.name) && ticked.length >= 3} style={!ticked.includes(t.name) && ticked.length >= 3 ? { opacity: 0.4, cursor: "not-allowed" } : undefined} onClick={() => toggle(t.name)}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="tf-sec">
              <div className="tf-num">04</div>
              <h2>A bit about you</h2>
              <p className="sub">This is where the personality comes from, so be yourself.</p>
              <div className="tf-grid">
                <div className="tf-f full">
                  <span className="tf-l">Are you a clinic or an academy? (tick one)</span>
                  <div className="tf-mum">
                    {["Clinic", "Academy"].map((o) => (
                      <button type="button" key={o} className={`tf-chip${f.bizType === o ? " on" : ""}`} onClick={() => setF((p) => ({ ...p, bizType: o }))}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tf-f full">
                  <span className="tf-l">How old are you?</span>
                  <div className="tf-mum">
                    {["Under 30", "30 to 37", "38 to 44", "45 to 54", "55 or over"].map((o) => (
                      <button type="button" key={o} className={`tf-chip${f.age === o ? " on" : ""}`} onClick={() => setF((p) => ({ ...p, age: o }))}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                {field("What are your hobbies?", "hobbies", { area: true, full: true, ph: "Wild swimming, bad reality TV, baking" })}
                <div className="tf-f full">
                  <span className="tf-l">Are you a mum?</span>
                  <div className="tf-mum">
                    {["Yes", "No", "Nearly a mum", "Grandma"].map((o) => (
                      <button type="button" key={o} className={`tf-chip${f.mum === o ? " on" : ""}`} onClick={() => setF((p) => ({ ...p, mum: o }))}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                {field("Any pets?", "pets", { ph: "A very bossy spaniel called Gerald", full: true })}
                {field("What made you get into aesthetics?", "why", { area: true, full: true })}
                {field("Describe yourself in 3 words", "threeWords", { ph: "Warm, honest, nosy" })}
                {field("What is your passion in life?", "passion", { area: true, full: true })}
              </div>
            </div>

            <label className="tf-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I am happy for Social Media Sister to use my logo, photo and details to build my free posts and to email me about them.</span>
            </label>
            <label className="tf-consent" style={{ marginTop: 18 }}>
              <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
              <span>Optional: send me Vanessa's social media tips and offers by email. You can unsubscribe any time.</span>
            </label>
            {err && <div className="tf-err">{err}</div>}
            {repeat && TENFREE_WHATSAPP && <a className="tf-go" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={`https://wa.me/${TENFREE_WHATSAPP}?text=${encodeURIComponent("Hi Vanessa, I would like my discount for a monthly membership")}`}>Claim my discount on WhatsApp</a>}
            <button className="tf-go" disabled={busy || logoBusy} onClick={submit}>
              {busy ? "Sending..." : "Send me my 10 free posts"}
            </button>
            <div className="tf-note">I review every request by hand. One free turn per email.</div>
          </>
        )}
        <div className="tf-foot">Social Media Sister</div>
      </div>
    </div>
  );
}
