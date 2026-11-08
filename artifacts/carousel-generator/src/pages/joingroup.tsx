import React, { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const PINK = "#ff1493";
const BLACK = "#0a0a0a";

const CSS = `
.jg-wrap{font-family:'League Spartan',sans-serif;background:#fff;color:${BLACK};min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem;line-height:1.45}
.jg-wrap *{box-sizing:border-box;margin:0;padding:0}
.jg-card{width:100%;max-width:520px;background:#fff;border:3px solid ${BLACK};padding:2.75rem 2.25rem;position:relative}
.jg-card::before{content:'';position:absolute;top:8px;left:8px;right:-8px;bottom:-8px;border:3px solid ${PINK};z-index:-1}
.jg-h1{font-size:clamp(1.65rem,5vw,2.1rem);font-weight:800;letter-spacing:-0.03em;margin-bottom:.85rem}
.jg-accent{color:${PINK}}
.jg-intro{font-size:1.05rem;font-weight:500;margin-bottom:2rem;line-height:1.5}
.jg-form{display:flex;flex-direction:column;gap:1.15rem}
.jg-field{display:flex;flex-direction:column}
.jg-label{font-size:.85rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.35rem;display:block}
.jg-input{width:100%;padding:.85rem 1rem;font-family:'League Spartan',sans-serif;font-size:1rem;font-weight:500;border:2px solid ${BLACK};background:#fff;color:${BLACK};outline:none;border-radius:0}
.jg-input:focus{border-color:${PINK};background:#fff5fa}
.jg-input::placeholder{color:#999;font-weight:400}
.jg-btn{margin-top:.75rem;padding:1rem 1.5rem;font-family:'League Spartan',sans-serif;font-size:1.1rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;background:${PINK};color:#fff;border:3px solid ${BLACK};cursor:pointer;transition:transform .12s ease,background .12s ease;border-radius:0}
.jg-btn:hover{background:${BLACK};transform:translate(-2px,-2px)}
.jg-btn:disabled{opacity:.6;cursor:wait}
.jg-note{margin-top:1.5rem;font-size:.8rem;font-weight:500;color:#666;text-align:center}
.jg-error{color:#c00;font-size:.9rem;font-weight:600}
.jg-success{text-align:center;padding:1.5rem 0}
.jg-success h2{font-size:1.6rem;font-weight:800;color:${PINK};margin-bottom:.5rem}
.jg-success p{font-size:1.05rem;font-weight:500}
.jg-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
@media (max-width:480px){.jg-card{padding:2rem 1.4rem}}
`;

export default function JoinGroup() {
  const [fullName, setFullName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Join the Madhouse | The Cyber Suite";
    if (!document.getElementById("jg-font")) {
      const link = document.createElement("link");
      link.id = "jg-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE}api/join-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, businessType, phone, instagram, website }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="jg-wrap">
      <style>{CSS}</style>
      <div className="jg-card">
        {done ? (
          <div className="jg-success">
            <h2>You're in.</h2>
            <p>Details received. I'll add you to the group ASAP. Keep an eye on WhatsApp.</p>
          </div>
        ) : (
          <div>
            <h1 className="jg-h1">
              thanks for reaching out.<br />
              <span className="jg-accent">welcome to the madhouse.</span>
            </h1>
            <p className="jg-intro">
              in these groups i post free tips, free downloads, give advice on how to get new clients and i provide discounted services for members.
            </p>
            <form className="jg-form" onSubmit={submit}>
              <div className="jg-hp" aria-hidden="true">
                <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>
              <div className="jg-field">
                <label className="jg-label" htmlFor="fullName">Full Name</label>
                <input className="jg-input" id="fullName" required placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="jg-field">
                <label className="jg-label" htmlFor="businessType">Business Type</label>
                <input className="jg-input" id="businessType" required placeholder="e.g. clinic, salon, freelance, agency" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
              </div>
              <div className="jg-field">
                <label className="jg-label" htmlFor="phone">Phone Number</label>
                <input className="jg-input" id="phone" type="tel" required placeholder="+44 7xxx xxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="jg-field">
                <label className="jg-label" htmlFor="instagram">Instagram @</label>
                <input className="jg-input" id="instagram" required placeholder="@yourhandle" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
              </div>
              {error && <p className="jg-error">{error}</p>}
              <button className="jg-btn" type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Join the Group"}
              </button>
            </form>
            <p className="jg-note">You'll be added to the WhatsApp group shortly. No spam. Just the good stuff.</p>
          </div>
        )}
      </div>
    </div>
  );
}
