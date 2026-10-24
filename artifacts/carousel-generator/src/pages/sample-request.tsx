import { useEffect, useState } from "react";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const CSS = `
.sr-root { --bg:#faf5f2; --card:#fffdfc; --ink:#2a1e1a; --muted:#6e5d56; --line:#ead9d0; --accent:#9a5a49; --accent-ink:#ffffff;
  --display:"DM Serif Display", Georgia, serif; --body:"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; min-height:100vh; box-sizing:border-box;
  padding:40px 16px 56px; }
@media (prefers-color-scheme: dark) {
  .sr-root { --bg:#181210; --card:#221915; --ink:#f6ebe6; --muted:#bba8a0; --line:#3d2f29; --accent:#e0a48f; --accent-ink:#1d0f0a; color-scheme:dark; }
}
.sr-root * { box-sizing:border-box; }
.sr-wrap { max-width:560px; margin:0 auto; display:flex; flex-direction:column; gap:22px; }
.sr-from { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:700; }
.sr-h1 { font-family:var(--display); font-weight:400; font-size:clamp(32px,7vw,46px); line-height:1.08; margin:0; text-wrap:balance; }
.sr-lede { margin:0; font-size:17px; }
.sr-form { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:20px; display:flex; flex-direction:column; gap:16px; }
.sr-field { display:flex; flex-direction:column; gap:6px; }
.sr-field label, .sr-field .sr-lab { font-weight:700; font-size:14px; }
.sr-field small { color:var(--muted); font-size:13px; }
.sr-input { font:inherit; color:inherit; background:transparent; border:1.5px solid var(--line); border-radius:10px; padding:11px 12px; min-height:46px; width:100%; }
.sr-input:focus-visible, .sr-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.sr-check { display:flex; gap:10px; align-items:flex-start; font-size:15px; }
.sr-check input { margin-top:5px; width:20px; height:20px; flex:none; }
.sr-btn { font:inherit; cursor:pointer; border:0; background:var(--accent); color:var(--accent-ink); padding:12px 18px; border-radius:10px; font-weight:700; font-size:16px; min-height:48px; }
.sr-btn[disabled] { opacity:.6; cursor:default; }
.sr-error { color:#b3261e; font-size:15px; margin:0; }
@media (prefers-color-scheme: dark) { .sr-error { color:#ff9c93; } }
.sr-sig { color:var(--muted); font-size:14px; margin:0; }
`;

// iPhone photos are often HEIC, which most browsers and the server cannot read, so turn them into JPEGs here.
async function toUsable(file: File): Promise<File> {
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, "") + ".jpg", { type: "image/jpeg" });
}

export default function SampleRequest() {
  const [clinicName, setClinicName] = useState("");
  const [handle, setHandle] = useState("");
  const [area, setArea] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pick = async (file: File | undefined, set: (f: File | null) => void) => {
    if (!file) return set(null);
    try {
      set(await toUsable(file));
      setError("");
    } catch {
      set(null);
      setError("I could not read that photo. Please choose a JPG or PNG instead.");
    }
  };

  useEffect(() => {
    document.title = "Your free sample posts";
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex,nofollow";
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!clinicName.trim() || !handle.trim() || !area.trim() || !photo) {
      setError("Please add your clinic name, Instagram handle, town and a photo.");
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
      fd.append("handle", handle.trim());
      fd.append("area", area.trim());
      fd.append("email", email.trim());
      fd.append("consent", "yes");
      fd.append("photo", photo);
      if (logo) fd.append("logo", logo);
      const r = await fetch(`${BASE}/api/free-samples/intake`, { method: "POST", body: fd });
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

  if (done) {
    return (
      <div className="sr-root">
        <style>{CSS}</style>
        <div className="sr-wrap">
          <span className="sr-from">Social Media Sister</span>
          <h1 className="sr-h1">Got it, thank you.</h1>
          <p className="sr-lede">
            I have your photo and details. I will put your sample posts together and send it over to you myself, so keep an eye on your messages. It can take a little while, so no need to wait around.
          </p>
          <p className="sr-sig">Vanessa Wormald, Social Media Sister</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sr-root">
      <style>{CSS}</style>
      <div className="sr-wrap">
        <span className="sr-from">A free sample from Social Media Sister</span>
        <h1 className="sr-h1">Let me make you 8 posts to try.</h1>
        <p className="sr-lede">
          Tell me about your clinic and send me one photo of you. I will turn it into eight posts with the captions and hashtags already written, so you can see how your page could look.
        </p>
        <form className="sr-form" onSubmit={submit} noValidate>
          <div className="sr-field">
            <label htmlFor="sr-clinic">Clinic name</label>
            <input id="sr-clinic" className="sr-input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} autoComplete="organization" maxLength={120} required />
          </div>
          <div className="sr-field">
            <label htmlFor="sr-handle">Instagram handle</label>
            <input id="sr-handle" className="sr-input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourclinic" autoCapitalize="none" autoCorrect="off" maxLength={80} required />
          </div>
          <div className="sr-field">
            <label htmlFor="sr-area">Town or area</label>
            <input id="sr-area" className="sr-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Milton Keynes" maxLength={120} required />
          </div>
          <div className="sr-field">
            <label htmlFor="sr-photo">A photo of you</label>
            <small>A clear, well lit photo of your face and shoulders works best.</small>
            <input id="sr-photo" className="sr-input" type="file" accept="image/*,.heic,.heif" onChange={(e) => void pick(e.target.files?.[0], setPhoto)} required />
          </div>
          <div className="sr-field">
            <label htmlFor="sr-logo">Your logo (optional)</label>
            <input id="sr-logo" className="sr-input" type="file" accept="image/*,.heic,.heif" onChange={(e) => void pick(e.target.files?.[0], setLogo)} />
          </div>
          <div className="sr-field">
            <label htmlFor="sr-email">Email (optional)</label>
            <small>Only if you would like me to send your link there.</small>
            <input id="sr-email" className="sr-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={160} />
          </div>
          <label className="sr-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I am happy for Social Media Sister to use my photo to make my sample posts.</span>
          </label>
          {error && <p className="sr-error" role="alert">{error}</p>}
          <button className="sr-btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Send it to Vanessa"}</button>
        </form>
        <p className="sr-sig">Vanessa Wormald, Social Media Sister</p>
      </div>
    </div>
  );
}
