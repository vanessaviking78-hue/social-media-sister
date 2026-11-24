import { useState } from "react";

// cybersuite.com/smskirsty: the page Kirsty hands to her clinics. They apply for Vanessa's £222 a month development rate (fixed for a year).
// Submitting saves the application and emails Vanessa.

const PINK = "#ff1f8e";
const INK = "#111";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');
.sk, .sk * { font-family:'League Spartan',sans-serif; box-sizing:border-box; }
.sk { background:#fff; color:${INK}; min-height:100vh; }
.sk-w { max-width:760px; margin:0 auto; padding:0 20px 90px; }
.sk-top { display:flex; justify-content:space-between; gap:12px; padding:26px 0 8px; letter-spacing:.26em; font-size:12px; text-transform:uppercase; font-weight:900; }
.sk h1 { font-weight:900; text-transform:uppercase; font-size:clamp(50px,12vw,106px); line-height:.9; margin:26px 0 18px; letter-spacing:-.02em; }
.sk h1 span { color:${PINK}; display:block; }
.sk h2 { font-weight:900; text-transform:uppercase; font-size:clamp(24px,5vw,32px); border-top:3px solid ${INK}; padding-top:16px; margin:44px 0 10px; line-height:1; }
.sk p, .sk li, .sk label { font-size:18px; line-height:1.45; }
.sk-lead { font-size:clamp(19px,3.4vw,22px) !important; max-width:620px; }
.sk-price { background:${INK}; color:${PINK}; padding:26px 24px; margin:26px 0 0; }
.sk-price b { display:block; font-weight:900; font-size:clamp(56px,13vw,110px); line-height:.9; }
.sk-price p { color:${PINK}; margin:8px 0 0; font-weight:700; }
.sk-ask { background:${PINK}; color:${INK}; padding:22px 24px; margin:26px 0; font-weight:700; }
.sk-ask p { margin:0; }
.sk-field { display:block; margin:14px 0; }
.sk-field > span { display:block; font-weight:700; font-size:14px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:5px; }
.sk input[type=text], .sk input[type=email], .sk input[type=tel], .sk textarea { width:100%; border:2px solid ${INK}; padding:12px; font-size:17px; font-family:inherit; background:#fff; color:${INK}; border-radius:0; }
.sk textarea { min-height:100px; resize:vertical; }
.sk-q { border:3px solid ${INK}; padding:18px 20px; margin:14px 0; }
.sk-q.on { border-color:${PINK}; }
.sk-q b { display:block; font-weight:900; font-size:20px; line-height:1.25; margin-bottom:12px; }
.sk-q b i { font-style:normal; color:${PINK}; margin-right:8px; }
.sk-yn { display:flex; gap:10px; }
.sk-yn button { flex:1; padding:13px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; font-size:15px; border:3px solid ${INK}; background:#fff; color:${INK}; cursor:pointer; }
.sk-yn button.sel { background:${INK}; color:${PINK}; }
.sk-btn { background:${PINK}; color:#fff; border:0; padding:18px 26px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; font-size:16px; cursor:pointer; width:100%; margin-top:10px; }
.sk-btn[disabled] { opacity:.45; cursor:default; }
.sk-err { background:#fff0f0; border:2px solid #c00; color:#900; padding:12px 14px; margin:12px 0; font-size:16px; }
.sk-done { border:3px solid ${INK}; background:#fff5fa; padding:30px 26px; margin-top:30px; }
.sk-done h2 { border:0; padding:0; margin:0 0 10px; }
.sk-sm { font-size:15px !important; color:#555; }
`;

const QUESTIONS: { key: "reels" | "selfies" | "hourCall" | "trustMe"; q: string; extra?: string }[] = [
  { key: "reels", q: "Are you willing to do 8 reels a month?" },
  { key: "selfies", q: "Will you take selfies?" },
  { key: "hourCall", q: "Can you commit to a one hour conversation with me every month?" },
  {
    key: "trustMe",
    q: "I will not tell you how to inject, so will you promise not to tell me how to do social?",
    extra: "You are the mum, I am the babysitter. Seven years in aesthetics and around 400 clinics means I know what works.",
  },
];

type Key = (typeof QUESTIONS)[number]["key"];

export default function SmsKirsty() {
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [ans, setAns] = useState<Partial<Record<Key, "yes" | "no">>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const ready = name.trim() && clinic.trim() && email.trim() && QUESTIONS.every((q) => ans[q.key]);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/sms-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, clinic, email, phone, notes, ...ans }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sk">
      <style>{CSS}</style>
      <div className="sk-w">
        <div className="sk-top">
          <span>The Aesthetic Shift Community</span>
          <span>By application</span>
        </div>

        <h1>
          The development <span>rate</span>
        </h1>
        <p className="sk-lead">
          Kirsty thought you and I should meet. I am Vanessa, and I look after the social media for aesthetic clinics. Seven years in the industry and around 400 clinics later, I would love to work with you.
        </p>

        <div className="sk-price">
          <b>£222</b>
          <p>a month for a whole year. The price is fixed, so it will not go up while you are with me. My full price is £650 a month, so you save £428 every month.</p>
        </div>

        <div className="sk-ask">
          <p>
            If you would like to apply for the development rate of £222 a month with me, the aesthetic angel, digital demon and compliance queen, fill this form in and let's talk.
          </p>
        </div>

        <div className="sk-price" style={{ background: "#fff", border: `3px solid ${INK}`, color: INK }}>
          <b style={{ color: PINK, fontSize: "clamp(34px,8vw,58px)" }}>Half price content day</b>
          <p style={{ color: INK }}>
            In West Yorkshire? You also get 50% off one of my in-person content days. The full price is £1,500, so for you it is £750, and you can take it at any time in your 12 months.
          </p>
        </div>

        {done ? (
          <div className="sk-done">
            <h2>Got it, thank you</h2>
            <p>Your application is with me. I will read it properly and be in touch very soon to arrange our chat.</p>
            <p className="sk-sm">If you do not hear from me within a couple of days, message me on Instagram @social_media_sister.</p>
          </div>
        ) : (
          <>
            <h2>Four quick questions</h2>
            {QUESTIONS.map((q, i) => (
              <div key={q.key} className={`sk-q ${ans[q.key] ? "on" : ""}`}>
                <b>
                  <i>{i + 1}</i>
                  {q.q}
                </b>
                {q.extra && <p style={{ marginTop: -4, marginBottom: 12 }}>{q.extra}</p>}
                <div className="sk-yn">
                  <button type="button" className={ans[q.key] === "yes" ? "sel" : ""} onClick={() => setAns({ ...ans, [q.key]: "yes" })}>
                    Yes
                  </button>
                  <button type="button" className={ans[q.key] === "no" ? "sel" : ""} onClick={() => setAns({ ...ans, [q.key]: "no" })}>
                    Not sure yet
                  </button>
                </div>
              </div>
            ))}

            <h2>About you</h2>
            <label className="sk-field">
              <span>Your name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="sk-field">
              <span>Clinic name</span>
              <input type="text" value={clinic} onChange={(e) => setClinic(e.target.value)} />
            </label>
            <label className="sk-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="sk-field">
              <span>Phone or WhatsApp (optional)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>
            <label className="sk-field">
              <span>Anything you would like me to know (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            {err && <div className="sk-err">{err}</div>}
            <button className="sk-btn" disabled={!ready || busy} onClick={submit}>
              {busy ? "Sending..." : "Apply for the development rate"}
            </button>
            <p className="sk-sm" style={{ marginTop: 14 }}>
              Applying does not commit you to anything. It simply starts the conversation.
            </p>
          </>
        )}
        <p className="sk-sm" style={{ marginTop: 40, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
          Social Media Sister, part of the Very Vanessa Media Group
        </p>
      </div>
    </div>
  );
}
