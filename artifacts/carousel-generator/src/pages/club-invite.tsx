import { useEffect, useState } from "react";

// cybersuite.com/youreinvited: the invitation Vanessa hands to the people she wants in the £69 club.
// The price is deliberately never shown here. Accepting makes a pending member, who lands on her private portal link to fill in the details form.

const PINK = "#ff1f8e";
const INK = "#111";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const KEY = "sms-club-invite-token";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');
.ci, .ci * { font-family:'League Spartan',sans-serif; box-sizing:border-box; }
.ci { background:#fff; color:${INK}; min-height:100vh; }
.ci-w { max-width:760px; margin:0 auto; padding:0 20px 90px; }
.ci-top { display:flex; justify-content:space-between; gap:12px; padding:26px 0 8px; letter-spacing:.26em; font-size:12px; text-transform:uppercase; font-weight:900; }
.ci h1 { font-weight:900; text-transform:uppercase; font-size:clamp(52px,13vw,112px); line-height:.9; margin:26px 0 18px; letter-spacing:-.02em; }
.ci h1 span { color:${PINK}; display:block; }
.ci h2 { font-weight:900; text-transform:uppercase; font-size:clamp(24px,5vw,32px); border-top:3px solid ${INK}; padding-top:16px; margin:46px 0 10px; line-height:1; }
.ci p, .ci li, .ci label { font-size:18px; line-height:1.4; }
.ci-lead { font-size:clamp(19px,3.4vw,22px) !important; max-width:600px; }
.ci-places { border:3px solid ${INK}; padding:18px 20px; margin:26px 0 0; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px; background:#fff5fa; }
.ci-places b { font-size:26px; font-weight:900; text-transform:uppercase; line-height:1; }
.ci-places b span { color:${PINK}; }
.ci-dots { display:flex; gap:7px; }
.ci-dot { width:20px; height:20px; border-radius:50%; border:3px solid ${INK}; background:#fff; }
.ci-dot.gone { background:${INK}; }
.ci ul.ci-list { list-style:none; padding:0; margin:12px 0; }
.ci ul.ci-list li { padding:11px 0 11px 36px; border-bottom:1px solid #e8e8e8; position:relative; }
.ci ul.ci-list li::before { content:""; position:absolute; left:4px; top:17px; width:15px; height:15px; background:${PINK}; border-radius:50%; }
.ci ol.ci-steps { counter-reset:s; list-style:none; padding:0; margin:12px 0; }
.ci ol.ci-steps li { counter-increment:s; padding:12px 0 12px 56px; position:relative; border-bottom:1px solid #e8e8e8; }
.ci ol.ci-steps li::before { content:counter(s); position:absolute; left:0; top:8px; width:38px; height:38px; background:${INK}; color:#fff; font-weight:900; font-size:20px; display:flex; align-items:center; justify-content:center; }
.ci-promise { border:3px solid ${INK}; padding:22px 22px 8px; margin:14px 0 22px; position:relative; }
.ci-promise::before { content:"My promise"; position:absolute; top:-15px; left:16px; background:${PINK}; color:#fff; font-weight:900; text-transform:uppercase; letter-spacing:.16em; font-size:13px; padding:5px 12px; }
.ci-promise ol { padding-left:22px; margin:8px 0 14px; }
.ci-promise li { padding:4px 0; }
.ci-field { display:block; margin:14px 0; }
.ci-field > span { display:block; font-weight:700; font-size:14px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:5px; }
.ci input[type=text], .ci input[type=email], .ci input[type=tel] { width:100%; border:2px solid ${INK}; padding:12px; font-size:17px; font-family:inherit; background:#fff; color:${INK}; border-radius:0; }
.ci-tick { display:flex; gap:12px; align-items:flex-start; margin:18px 0; cursor:pointer; }
.ci-tick input { width:24px; height:24px; margin-top:3px; accent-color:${PINK}; flex:none; }
.ci-btn { background:${PINK}; color:#fff; border:0; padding:18px 26px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; font-size:16px; cursor:pointer; text-decoration:none; display:inline-block; width:100%; }
.ci-btn[disabled] { opacity:.45; cursor:default; }
.ci-btn.k { background:${INK}; }
.ci-err { background:#fff0f0; border:2px solid #c00; color:#900; padding:12px 14px; margin:12px 0; font-size:16px; }
.ci-sig { display:flex; gap:12px; flex-wrap:wrap; }
.ci-sig label { flex:1 1 240px; }
.ci-sm { font-size:15px !important; color:#555; }
`;

type Info = { total: number; left: number; open: boolean };

export default function ClubInvite() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signed, setSigned] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [back, setBack] = useState("");

  useEffect(() => {
    try { setBack(localStorage.getItem(KEY) || ""); } catch { /* private window */ }
    fetch(`${API}/club/invite/69`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setInfo(j))
      .catch(() => setLoadErr(true));
  }, []);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/club/invite/69`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, agreed, agreedName: signed, website }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "Something went wrong, please try again");
        if (j.full) setInfo({ total: info?.total ?? 10, left: 0, open: false });
        return;
      }
      if (!j.token) return;
      try { localStorage.setItem(KEY, j.token); } catch { /* fine */ }
      window.location.assign(`${BASE}/club/${j.token}`);
    } catch {
      setErr("I could not send that, please check your connection and try again");
    } finally {
      setBusy(false);
    }
  };

  const total = info?.total ?? 10;
  const left = info?.left ?? total;
  const open = info ? info.open : true;

  return (
    <div className="ci">
      <style>{CSS}</style>
      <div className="ci-w">
        <div className="ci-top"><span>Social Media Sister</span><span>By invitation</span></div>
        <h1>You are <span>invited</span></h1>
        <p className="ci-lead">I have kept a place for you in my monthly content club for aesthetic injectors. There are only {total} places, and I am handing them out one at a time to people I would genuinely love to work with. Yours is waiting.</p>

        {info && (
          <div className="ci-places">
            <b>{open ? <><span>{left}</span> of {total} places left</> : <>All {total} places <span>taken</span></>}</b>
            <div className="ci-dots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={`ci-dot ${i < total - left ? "gone" : ""}`} />)}</div>
          </div>
        )}
        {loadErr && <div className="ci-err">I could not check the places just now. You can still say yes below.</div>}

        <h2>What lands in your portal every month</h2>
        <ul className="ci-list">
          <li><b>12 posts</b> written and designed for your clinic, in your voice</li>
          <li><b>10 reel hooks and scripts</b>, four of them tailored to your treatments</li>
          <li><b>12 stories</b> with a poll idea for each, so your followers actually tap</li>
          <li><b>4 studio photos</b> of you, ready to use</li>
          <li><b>Me on WhatsApp</b>, a big sister in the background you can ask anything</li>
        </ul>

        <h2>How it works</h2>
        <ol className="ci-steps">
          <li><b>Say yes below.</b> It takes a minute.</li>
          <li><b>Tell me all about you.</b> A questionnaire, once only. Chatty answers, little stories and odd facts all make your content sound more like you.</li>
          <li><b>I say hello on WhatsApp</b> and your first month begins.</li>
        </ol>

        {back && (
          <div className="ci-promise" style={{ marginTop: 34 }}>
            <p><b>You have already said yes.</b> Pick up where you left off.</p>
            <a className="ci-btn k" href={`${BASE}/club/${back}`} style={{ marginBottom: 18, textAlign: "center" }}>Carry on with my details</a>
          </div>
        )}

        {open ? (
          <form onSubmit={submit}>
            <h2>Say yes</h2>
            <p>This club is a little bit special, and so is the rate I am offering you. The one thing I ask in return is below.</p>
            <div className="ci-promise">
              <p style={{ marginTop: 6 }}>I am joining Vanessa's monthly content club at a special introductory rate. In return, I promise to:</p>
              <ol>
                <li>Keep the price of the club between me and Vanessa.</li>
                <li>Keep any message or link that shows the price to myself, so no forwarding, screenshots or posting.</li>
                <li>Tell people how much I love being in the club, and point them to Vanessa for the details.</li>
              </ol>
            </div>

            <label className="ci-field"><span>Your name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            <label className="ci-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label className="ci-field"><span>Your WhatsApp number</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required /></label>
            <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true"><input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></div>

            <label className="ci-tick"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>Yes, I make this promise.</span></label>
            <div className="ci-sig">
              <label className="ci-field"><span>Type your full name to sign</span><input type="text" value={signed} onChange={(e) => setSigned(e.target.value)} required /></label>
              <label className="ci-field"><span>Date</span><input type="text" value={today} readOnly /></label>
            </div>

            {err && <div className="ci-err">{err}</div>}
            <button className="ci-btn" type="submit" disabled={busy || !agreed}>{busy ? "Saving your place..." : "Accept my invitation"}</button>
            <p className="ci-sm" style={{ marginTop: 14 }}>Next you will fill in the questionnaire. Your place is held while I check everything over, and I will message you on WhatsApp once you are in.</p>
          </form>
        ) : (
          <>
            <h2>All the places have gone</h2>
            <p>This round is full. Message me on Instagram @social_media_sister and I will add you to the list for the next one.</p>
          </>
        )}
      </div>
    </div>
  );
}
