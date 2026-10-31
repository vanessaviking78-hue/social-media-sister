import { useEffect, useState } from "react";
import { ALL_TREATMENTS, TREAT_GROUP, TREAT_GROUP_ORDER } from "@/lib/treatment-designs";
import { PACK_PRICE, type PackSize } from "@/lib/pack-plan";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const CSS = `
.po-root { --bg:#fde9ef; --card:#fff6f9; --ink:#2a1e1a; --muted:#6e5d56; --line:#f1c9d6; --accent:#9a5a49; --accent-ink:#ffffff; --soft:#fad7e2;
  --display:"League Spartan", system-ui, sans-serif; --body:"League Spartan", system-ui, sans-serif;
  background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; min-height:100vh; box-sizing:border-box;
  padding:40px 16px 56px; }
.po-root * { box-sizing:border-box; }
.po-root, .po-root * { font-family:"League Spartan", system-ui, sans-serif !important; font-weight:700 !important; }
.po-wrap { max-width:620px; margin:0 auto; display:flex; flex-direction:column; gap:22px; }
.po-from { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:700; }
.po-h1 { font-family:var(--display); font-weight:400; font-size:clamp(36px,8vw,56px); line-height:1.05; margin:0; text-wrap:balance; }
.po-lede { margin:0; font-size:17px; }
.po-form { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:20px; display:flex; flex-direction:column; gap:18px; }
.po-field { display:flex; flex-direction:column; gap:6px; border:0; padding:0; margin:0; min-width:0; }
.po-field > label, .po-field > legend, .po-lab { font-weight:700; font-size:14px; padding:0; }
.po-field small { color:var(--muted); font-size:13px; }
.po-input { font:inherit; color:inherit; background:transparent; border:1.5px solid var(--line); border-radius:10px; padding:11px 12px; min-height:46px; width:100%; }
.po-input:focus-visible, .po-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.po-sizes { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.po-size { position:relative; border:1.5px solid var(--line); border-radius:14px; padding:14px 10px; text-align:center; cursor:pointer; display:flex; flex-direction:column; gap:2px; background:transparent; }
.po-size input { position:absolute; opacity:0; inset:0; cursor:pointer; }
.po-size:has(input:checked) { border-color:var(--accent); background:var(--soft); }
.po-size:has(input:focus-visible) { outline:3px solid var(--accent); outline-offset:2px; }
.po-size b { font-family:var(--display); font-weight:400; font-size:34px; line-height:1; }
.po-size span { font-size:13px; color:var(--muted); }
.po-size em { font-style:normal; font-weight:700; font-size:18px; }
.po-colours { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
.po-colour { display:flex; align-items:center; gap:10px; border:1.5px solid var(--line); border-radius:10px; padding:8px 10px; font-size:14px; }
.po-colour input { width:44px; height:36px; border:0; padding:0; background:transparent; cursor:pointer; }
.po-ticks { display:flex; flex-direction:column; gap:18px; }
.po-group { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:6px 12px; }
.po-group > .po-lab { grid-column:1 / -1; color:var(--accent); }
.po-check { display:flex; gap:10px; align-items:flex-start; font-size:15px; }
.po-check input { margin-top:4px; width:20px; height:20px; flex:none; }
.po-btn { font:inherit; cursor:pointer; border:0; background:var(--accent); color:var(--accent-ink); padding:12px 18px; border-radius:10px; font-weight:700; font-size:16px; min-height:48px; }
.po-btn[disabled] { opacity:.6; cursor:default; }
.po-error { color:#b3261e; font-size:15px; margin:0; }
@media (prefers-color-scheme: dark) { .po-error { color:#ff9c93; } }
.po-sig { color:var(--muted); font-size:14px; margin:0; }
@media (max-width:520px) { .po-group { grid-template-columns:minmax(0,1fr); } }
`;

const ROLES = ["Nurse", "Injector", "Dentist", "Doctor", "Pharmacist", "Other"];
const SIZES: { size: PackSize; note: string }[] = [
  { size: 12, note: "a good start" },
  { size: 20, note: "a fuller feed" },
  { size: 30, note: "a month done" },
];

// iPhone photos are often HEIC, which most browsers and the server cannot read, so turn them into JPEGs here.
async function toUsable(file: File): Promise<File> {
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, "") + ".jpg", { type: "image/jpeg" });
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

// Pulls the two most common non white, non grey colours out of a logo so the colour boxes start in the right place.
async function coloursFromLogo(file: File): Promise<{ main: string; accent: string } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const s = 64;
    const c = document.createElement("canvas");
    c.width = s;
    c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, s, s);
    const px = ctx.getImageData(0, 0, s, s).data;
    const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
      if (a < 200) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx > 235 && mn > 225) continue; // white
      if (mx - mn < 24) continue; // grey and black
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      bins.set(key, e);
    }
    const top = [...bins.values()].sort((x, y) => y.n - x.n);
    if (!top.length) return null;
    const one = (e: { n: number; r: number; g: number; b: number }) => hex(e.r / e.n, e.g / e.n, e.b / e.n);
    const dist = (x: typeof top[number], y: typeof top[number]) => Math.abs(x.r / x.n - y.r / y.n) + Math.abs(x.g / x.n - y.g / y.n) + Math.abs(x.b / x.n - y.b / y.n);
    const second = top.slice(1).find((e) => dist(top[0], e) > 90) ?? top[1] ?? top[0];
    return { main: one(top[0]), accent: one(second) };
  } catch {
    return null;
  }
}

export default function PackOrder() {
  const [clinicName, setClinicName] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [handle, setHandle] = useState("");
  const [area, setArea] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [roleOther, setRoleOther] = useState("");
  const [size, setSize] = useState<PackSize>(12);
  const [mainHex, setMainHex] = useState("#1f3a5f");
  const [accentHex, setAccentHex] = useState("#c9a27a");
  const [treatments, setTreatments] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Order your posts";
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex,nofollow";
    // The two fonts the pack uses.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Montserrat:wght@400;600;700&family=League+Spartan:wght@700;800&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return setPhoto(null);
    try {
      setPhoto(await toUsable(file));
      setError("");
    } catch {
      setPhoto(null);
      setError("I could not read that photo. Please choose a JPG or PNG instead.");
    }
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return setLogo(null);
    try {
      const usable = await toUsable(file);
      setLogo(usable);
      setError("");
      const found = await coloursFromLogo(usable);
      if (found) {
        setMainHex(found.main);
        setAccentHex(found.accent);
      }
    } catch {
      setLogo(null);
      setError("I could not read that logo. Please choose a JPG or PNG instead.");
    }
  };

  const pickExtras = async (list: FileList | null) => {
    try {
      const files = Array.from(list ?? []).slice(0, 3);
      setExtras(await Promise.all(files.map(toUsable)));
      setError("");
    } catch {
      setExtras([]);
      setError("I could not read one of those photos. Please choose JPG or PNG images.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const finalRole = role === "Other" ? roleOther.trim() : role;
    if (!clinicName.trim() || !handle.trim() || !area.trim() || !email.trim() || !photo) {
      setError("Please add your clinic name, Instagram handle, area, email and a photo of you.");
      return;
    }
    if (!finalRole) {
      setError("Please tell me your role, for example nurse or injector.");
      return;
    }
    if (!consent) {
      setError("Please tick the box so I know you are happy for me to use your photo.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("clinicName", clinicName.trim());
      fd.append("clinicianName", clinicianName.trim());
      fd.append("handle", handle.trim());
      fd.append("area", area.trim());
      fd.append("website", website.trim());
      fd.append("email", email.trim());
      fd.append("role", finalRole);
      fd.append("size", String(size));
      fd.append("mainHex", mainHex);
      fd.append("accentHex", accentHex);
      fd.append("treatments", JSON.stringify(treatments));
      fd.append("consent", "yes");
      fd.append("photo", photo);
      if (logo) fd.append("logo", logo);
      for (const f of extras) fd.append("extra", f);
      const r = await fetch(`${BASE}/api/post-packs/intake`, { method: "POST", body: fd });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Something went wrong, please try again.");
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (name: string) => setTreatments((t) => (t.includes(name) ? t.filter((x) => x !== name) : [...t, name]));

  if (done) {
    return (
      <div className="po-root">
        <style>{CSS}</style>
        <div className="po-wrap">
          <span className="po-from">Social Media Sister</span>
          <h1 className="po-h1">Got it, thank you.</h1>
          <p className="po-lede">
            I have your details and your photo. I will put your {size} posts together, check them myself, and email you a link where you can save every image with its caption and hashtags. It can take a little while, so no need to wait around.
          </p>
          <p className="po-sig">Vanessa Wormald, Social Media Sister</p>
        </div>
      </div>
    );
  }

  return (
    <div className="po-root">
      <style>{CSS}</style>
      <div className="po-wrap">
        <span className="po-from">Social Media Sister</span>
        <h1 className="po-h1">Your posts, ready to go.</h1>
        <p className="po-lede">
          Tell me about your clinic and send me one photo of you. I turn it into a pack of posts in your colours, with the captions and hashtags already written, so all you do is save them and post.
        </p>
        <form className="po-form" onSubmit={submit} noValidate>
          <fieldset className="po-field">
            <legend>How many posts?</legend>
            <div className="po-sizes">
              {SIZES.map((s) => (
                <label className="po-size" key={s.size}>
                  <input type="radio" name="size" checked={size === s.size} onChange={() => setSize(s.size)} />
                  <b>{s.size}</b>
                  <span>{s.note}</span>
                  <em>£{PACK_PRICE[s.size]}</em>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="po-field">
            <label htmlFor="po-clinic">Clinic name</label>
            <input id="po-clinic" className="po-input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} autoComplete="organization" maxLength={120} required />
          </div>
          <div className="po-field">
            <label htmlFor="po-name">Your name</label>
            <input id="po-name" className="po-input" value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} autoComplete="name" maxLength={80} />
          </div>
          <div className="po-field">
            <label htmlFor="po-role">Your role</label>
            <small>For example nurse or injector. I write your posts to match it.</small>
            <select id="po-role" className="po-input" value={role} onChange={(e) => setRole(e.target.value)} required>
              <option value="">Choose your role</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {role === "Other" && (
              <input className="po-input" value={roleOther} onChange={(e) => setRoleOther(e.target.value)} placeholder="Type your role" aria-label="Your role" maxLength={60} required />
            )}
          </div>
          <div className="po-field">
            <label htmlFor="po-handle">Instagram handle</label>
            <input id="po-handle" className="po-input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourclinic" autoCapitalize="none" autoCorrect="off" maxLength={80} required />
          </div>
          <div className="po-field">
            <label htmlFor="po-area">Town or area</label>
            <small>Your hashtags are built from this.</small>
            <input id="po-area" className="po-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Milton Keynes" maxLength={120} required />
          </div>
          <div className="po-field">
            <label htmlFor="po-site">Your website</label>
            <input id="po-site" className="po-input" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={200} />
          </div>
          <div className="po-field">
            <label htmlFor="po-email">Email</label>
            <small>This is where I send your link.</small>
            <input id="po-email" className="po-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={160} required />
          </div>

          <div className="po-field">
            <label htmlFor="po-logo">Your logo</label>
            <small>I will pick your colours from it, and you can change them below.</small>
            <input id="po-logo" className="po-input" type="file" accept="image/*,.heic,.heif" onChange={(e) => void pickLogo(e.target.files?.[0])} />
          </div>
          <div className="po-field">
            <span className="po-lab">Your brand colours</span>
            <div className="po-colours">
              <label className="po-colour"><input type="color" value={mainHex} onChange={(e) => setMainHex(e.target.value)} aria-label="Main colour" />Main</label>
              <label className="po-colour"><input type="color" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} aria-label="Accent colour" />Accent</label>
            </div>
          </div>

          <fieldset className="po-field">
            <legend>The treatments you offer</legend>
            <small>Tick any that apply. Your treatment posts only use these.</small>
            <div className="po-ticks">
              {TREAT_GROUP_ORDER.map((g) => (
                <div key={g} className="po-group">
                  <div className="po-lab">{g}</div>
                  {ALL_TREATMENTS.filter((t) => TREAT_GROUP[t.id] === g).map((t) => (
                    <label className="po-check" key={t.id}>
                      <input type="checkbox" checked={treatments.includes(t.name)} onChange={() => toggle(t.name)} />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="po-field">
            <label htmlFor="po-photo">A photo of you</label>
            <small>A clear, well lit photo of your face and shoulders works best.</small>
            <input id="po-photo" className="po-input" type="file" accept="image/*,.heic,.heif" onChange={(e) => void pickPhoto(e.target.files?.[0])} required />
          </div>
          <div className="po-field">
            <label htmlFor="po-extra">More of your own photos (optional, up to 3)</label>
            <input id="po-extra" className="po-input" type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => void pickExtras(e.target.files)} />
          </div>

          <label className="po-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I am happy for Social Media Sister to use my photos to make my posts.</span>
          </label>
          {error && <p className="po-error" role="alert">{error}</p>}
          <button className="po-btn" type="submit" disabled={busy}>{busy ? "Sending..." : `Order my ${size} posts`}</button>
        </form>
        <p className="po-sig">Vanessa Wormald, Social Media Sister</p>
      </div>
    </div>
  );
}
