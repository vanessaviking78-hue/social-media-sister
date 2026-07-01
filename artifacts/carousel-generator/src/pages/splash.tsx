import React, { useState, useEffect } from "react";
import { Link } from "wouter";

const PASSWORD = "ILOVEBOTOX78";
const STORAGE_KEY = "tcs_unlocked";

// ââ Password Gate ââââââââââââââââââââââââââââââââââââââââââ
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (!showInput) setShowInput(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().toUpperCase() === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      onUnlock();
    } else {
      setShake(true);
      setError(true);
      setValue("");
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div
      onClick={!showInput ? handleClick : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        cursor: showInput ? "default" : "pointer",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      {/* Full-screen image */}
      <img
        src="/TCSLOGOIMAGE.png"
        alt="The CyberSuite"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: showInput
            ? "rgba(0,0,0,0.6)"
            : "rgba(0,0,0,0.25)",
          transition: "background 400ms ease",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        {!showInput ? (
          <>
            <p
              style={{
                fontFamily: "'League Spartan', 'Impact', 'Arial Black', sans-serif",
                fontSize: "clamp(14px, 2vw, 18px)",
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                marginBottom: "20px",
                textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              }}
            >
              Click anywhere to enter
            </p>
            <h1
              style={{
                fontFamily: "'League Spartan', 'Impact', 'Arial Black', sans-serif",
                fontSize: "clamp(42px, 8vw, 96px)",
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1,
                textShadow: "0 4px 24px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)",
                margin: 0,
              }}
            >
              ENTER
            </h1>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={shake ? "shake" : ""}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}
          >
            <p
              style={{
                fontFamily: "'League Spartan', 'Arial Black', sans-serif",
                fontSize: "clamp(18px, 3vw, 28px)",
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textShadow: "0 2px 12px rgba(0,0,0,0.9)",
                margin: 0,
              }}
            >
              Enter password
            </p>
            <input
              autoFocus
              type="password"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false); }}
              placeholder="â¢â¢â¢â¢â¢â¢â¢â¢â¢â¢â¢â¢"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: error ? "2px solid #ff6b6b" : "2px solid rgba(255,255,255,0.6)",
                borderRadius: "8px",
                padding: "14px 20px",
                fontSize: "20px",
                color: "#fff",
                fontFamily: "inherit",
                textAlign: "center",
                outline: "none",
                width: "260px",
                letterSpacing: "0.2em",
                backdropFilter: "blur(4px)",
                transition: "border-color 200ms",
              }}
            />
            {error && (
              <p style={{ color: "#ff6b6b", fontSize: "14px", margin: 0, fontFamily: "inherit", fontWeight: 700 }}>
                Wrong password. Try again.
              </p>
            )}
            <button
              type="submit"
              style={{
                background: "#fff",
                color: "#111",
                border: "none",
                borderRadius: "8px",
                padding: "12px 36px",
                fontSize: "15px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'League Spartan', 'Arial Black', sans-serif",
                cursor: "pointer",
              }}
            >
              Enter
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-10px); }
          40%,80% { transform: translateX(10px); }
        }
        .shake { animation: shake 0.5s ease; }
      `}</style>
    </div>
  );
}

// ââ Colour tokens ââââââââââââââââââââââââââââââââââââââââââ
const RG = "#c4937f";
const RG_LIGHT = "#d4a898";
const BG = "#131313";
const BG_CARD = "#1c1c1c";
const BG_STRIP = "#181818";
const TEXT = "#f0ebe5";
const TEXT_MUTED = "#877870";
const TEXT_FAINT = "rgba(240,235,229,0.38)";
const BORDER = "rgba(255,255,255,0.07)";
const BORDER_RG = "rgba(196,147,127,0.22)";

function IconGrid() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="2" stroke={RG} strokeWidth="1.6"/>
      <rect x="16" y="2" width="10" height="10" rx="2" stroke={RG} strokeWidth="1.6"/>
      <rect x="2" y="16" width="10" height="10" rx="2" stroke={RG} strokeWidth="1.6"/>
      <rect x="16" y="16" width="10" height="10" rx="2" stroke={RG} strokeWidth="1.6"/>
    </svg>
  );
}
function IconSliders() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <line x1="4" y1="8" x2="24" y2="8" stroke={RG} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="10" cy="8" r="3" fill={BG_CARD} stroke={RG} strokeWidth="1.6"/>
      <line x1="4" y1="14" x2="24" y2="14" stroke={RG} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="18" cy="14" r="3" fill={BG_CARD} stroke={RG} strokeWidth="1.6"/>
      <line x1="4" y1="20" x2="24" y2="20" stroke={RG} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="13" cy="20" r="3" fill={BG_CARD} stroke={RG} strokeWidth="1.6"/>
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 3 L15.6 10.4 L23 12 L15.6 13.6 L14 21 L12.4 13.6 L5 12 L12.4 10.4 Z" stroke={RG} strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <path d="M22 20 L22.7 22.3 L25 23 L22.7 23.7 L22 26 L21.3 23.7 L19 23 L21.3 22.3 Z" stroke={RG} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="6" width="22" height="19" rx="2.5" stroke={RG} strokeWidth="1.6"/>
      <line x1="3" y1="12" x2="25" y2="12" stroke={RG} strokeWidth="1.6"/>
      <line x1="9" y1="3" x2="9" y2="9" stroke={RG} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="19" y1="3" x2="19" y2="9" stroke={RG} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="10" cy="18" r="1.2" fill={RG}/>
      <circle cx="14" cy="18" r="1.2" fill={RG}/>
      <circle cx="18" cy="18" r="1.2" fill={RG}/>
    </svg>
  );
}

const FEATURES = [
  { Icon: IconGrid, title: "Bulk carousel generation", desc: "Upload one photo, pick your style, and generate 60 fully-branded posts in the time it used to take you to make one." },
  { Icon: IconSliders, title: "Client brand presets", desc: "Every clinic's colours, fonts, and logo locked in once. Switch between accounts in seconds. No rebriefing yourself every Monday." },
  { Icon: IconSparkle, title: "AI portrait studio", desc: "Professional headshots without booking a photographer. On-brand portraits for any scenario, ready when you need them." },
  { Icon: IconCalendar, title: "Plan and schedule", desc: "A content calendar built for social media managers. Map out months in advance and publish directly to Instagram." },
];

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ clinic: "", email: "", note: "" });
  const [status, setStatus] = useState<"idle"|"loading"|"done"|"error">("idle");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clinic.trim() || !form.email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setStatus(res.ok ? "done" : "error");
    } catch { setStatus("error"); }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px" }}>
      <div style={{ background:BG_CARD,border:`1px solid ${BORDER_RG}`,borderRadius:"16px",padding:"40px 36px",maxWidth:"440px",width:"100%",position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute",top:"16px",right:"16px",background:"none",border:"none",cursor:"pointer",color:TEXT_MUTED,fontSize:"20px",lineHeight:1,padding:"4px 8px" }}>â</button>
        {status === "done" ? (
          <div style={{ textAlign:"center",padding:"16px 0" }}>
            <div style={{ fontSize:"32px",marginBottom:"16px" }}>â</div>
            <h3 style={{ color:TEXT,fontSize:"22px",fontWeight:700,marginBottom:"10px" }}>You're on the list.</h3>
            <p style={{ color:TEXT_MUTED,fontSize:"15px",lineHeight:1.6 }}>We'll be in touch. Good things take a moment.</p>
            <button onClick={onClose} style={{ marginTop:"28px",background:BORDER,color:TEXT,border:"none",borderRadius:"8px",padding:"12px 28px",fontSize:"14px",cursor:"pointer",fontFamily:"inherit" }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ color:TEXT,fontSize:"22px",fontWeight:700,marginBottom:"6px" }}>Join the waitlist</h3>
            <p style={{ color:TEXT_MUTED,fontSize:"14px",lineHeight:1.6,marginBottom:"28px" }}>We're onboarding practices one by one. Tell us a bit about your clinic and we'll reach out when we're ready for you.</p>
            <form onSubmit={submit} style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
              <div>
                <label style={{ display:"block",fontSize:"12px",color:TEXT_MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px" }}>Clinic name</label>
                <input type="text" required placeholder="Your clinic or practice name" value={form.clinic} onChange={(e) => setForm(f => ({...f,clinic:e.target.value}))} style={{ width:"100%",background:BG,border:`1px solid ${BORDER}`,borderRadius:"8px",padding:"12px 14px",color:TEXT,fontSize:"15px",fontFamily:"inherit",outline:"none",boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ display:"block",fontSize:"12px",color:TEXT_MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px" }}>Email address</label>
                <input type="email" required placeholder="you@yourclinic.com" value={form.email} onChange={(e) => setForm(f => ({...f,email:e.target.value}))} style={{ width:"100%",background:BG,border:`1px solid ${BORDER}`,borderRadius:"8px",padding:"12px 14px",color:TEXT,fontSize:"15px",fontFamily:"inherit",outline:"none",boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ display:"block",fontSize:"12px",color:TEXT_MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px" }}>Anything else? <span style={{ textTransform:"none",opacity:0.6 }}>(optional)</span></label>
                <textarea rows={3} placeholder="How many clients do you manage?" value={form.note} onChange={(e) => setForm(f => ({...f,note:e.target.value}))} style={{ width:"100%",background:BG,border:`1px solid ${BORDER}`,borderRadius:"8px",padding:"12px 14px",color:TEXT,fontSize:"14px",fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box" }} />
              </div>
              {status === "error" && <p style={{ color:"#e07070",fontSize:"13px" }}>Something went wrong. Try again.</p>}
              <button type="submit" disabled={status === "loading"} style={{ background:RG,color:"#fff",border:"none",borderRadius:"8px",padding:"14px",fontSize:"15px",fontWeight:700,cursor:status==="loading"?"not-allowed":"pointer",fontFamily:"inherit",opacity:status==="loading"?0.7:1,letterSpacing:"0.02em" }}>
                {status === "loading" ? "Sendingâ¦" : "Join the waitlist"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ââ Main Splash ââââââââââââââââââââââââââââââââââââââââââââ
export default function Splash() {
  const [unlocked, setUnlocked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Check URL bypass or localStorage
    const params = new URLSearchParams(window.location.search);
    if (params.get("enter") === PASSWORD || localStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div style={{ background:BG,color:TEXT,fontFamily:"'League Spartan','Helvetica Neue',sans-serif",overflowX:"hidden" }}>
      <style>{`
        * { box-sizing:border-box;margin:0;padding:0; }
        ::selection { background:rgba(196,147,127,0.3); }
        .rg-btn { background:${RG};color:#fff;border:none;border-radius:8px;padding:14px 32px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:0.02em;transition:background 200ms,transform 150ms;display:inline-block;text-decoration:none; }
        .rg-btn:hover { background:${RG_LIGHT};transform:translateY(-1px); }
        .ghost-btn { background:transparent;color:${TEXT};border:1px solid ${BORDER};border-radius:8px;padding:13px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;letter-spacing:0.02em;transition:border-color 200ms,color 200ms;display:inline-block;text-decoration:none; }
        .ghost-btn:hover { border-color:${BORDER_RG};color:${RG_LIGHT}; }
        .feature-card { background:${BG_CARD};border:1px solid ${BORDER};border-radius:14px;padding:32px 28px;transition:border-color 250ms,transform 250ms; }
        .feature-card:hover { border-color:${BORDER_RG};transform:translateY(-2px); }
        @media (max-width:768px) {
          .hero-h1 { font-size:clamp(32px,8vw,56px) !important; }
          .features-grid { grid-template-columns:1fr !important; }
          .nav-inner { padding:0 20px !important; }
          .hero-inner { padding:0 24px !important; }
          .section-inner { padding:0 24px !important; }
        }
      `}</style>

      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(19,19,19,0.92)":"transparent",backdropFilter:scrolled?"blur(12px)":"none",borderBottom:scrolled?`1px solid ${BORDER}`:"1px solid transparent",transition:"background 300ms,border-color 300ms" }}>
        <div className="nav-inner" style={{ maxWidth:"1100px",margin:"0 auto",padding:"0 40px",height:"64px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <img src="/sms-logo.png" alt="The CyberSuite" style={{ height:"32px",width:"auto",objectFit:"contain" }} />
          <div style={{ display:"flex",alignItems:"center",gap:"16px" }}>
            <button onClick={() => setModalOpen(true)} style={{ background:"none",border:"none",cursor:"pointer",color:TEXT_MUTED,fontSize:"14px",fontFamily:"inherit",fontWeight:500,padding:"8px 0",transition:"color 200ms" }} onMouseEnter={e=>(e.currentTarget.style.color=TEXT)} onMouseLeave={e=>(e.currentTarget.style.color=TEXT_MUTED)}>Join waitlist</button>
            <Link href="/hub" className="ghost-btn" style={{ fontSize:"14px",padding:"9px 22px" }}>Log in</Link>
          </div>
        </div>
      </nav>

      <section style={{ position:"relative",minHeight:"100vh",display:"flex",alignItems:"center",paddingTop:"64px" }}>
        <div style={{ position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:"800px",height:"400px",background:"radial-gradient(ellipse at center,rgba(196,147,127,0.08) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div className="hero-inner" style={{ maxWidth:"1100px",margin:"0 auto",padding:"0 40px",width:"100%",textAlign:"center" }}>
          <h1 className="hero-h1" style={{ fontSize:"clamp(56px,11vw,150px)",fontWeight:800,lineHeight:1.02,color:"#ff1493",letterSpacing:"-0.02em",maxWidth:"1000px",margin:"0 auto" }}>Fight til the last gasp - Never ever stop trying</h1>
        </div>
      </section>

      <div style={{ borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`,background:BG_STRIP }}>
        <div style={{ maxWidth:"1100px",margin:"0 auto",padding:"36px 40px",textAlign:"center" }}>
          <p style={{ fontSize:"clamp(18px,3vw,26px)",fontWeight:700,color:TEXT,letterSpacing:"-0.01em",lineHeight:1.4 }}>43 clinics. 100 hours saved per week. Built by someone who lived the job.</p>
        </div>
      </div>

      <section style={{ padding:"100px 0 80px" }}>
        <div className="section-inner" style={{ maxWidth:"1100px",margin:"0 auto",padding:"0 40px" }}>
          <div style={{ marginBottom:"64px" }}>
            <p style={{ fontSize:"12px",letterSpacing:"0.16em",textTransform:"uppercase",color:RG,fontWeight:600,marginBottom:"16px" }}>How it works</p>
            <h2 style={{ fontSize:"clamp(28px,4vw,42px)",fontWeight:800,color:TEXT,letterSpacing:"-0.02em",lineHeight:1.15,maxWidth:"500px" }}>Everything in one place. Nothing left out.</h2>
          </div>
          <div className="features-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"20px" }}>
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div style={{ marginBottom:"20px" }}><Icon /></div>
                <h3 style={{ fontSize:"18px",fontWeight:700,color:TEXT,marginBottom:"10px",letterSpacing:"-0.01em" }}>{title}</h3>
                <p style={{ fontSize:"15px",color:TEXT_MUTED,lineHeight:1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:"80px 0",background:BG_STRIP,borderTop:`1px solid ${BORDER}` }}>
        <div className="section-inner" style={{ maxWidth:"780px",margin:"0 auto",padding:"0 40px",textAlign:"center" }}>
          <div style={{ width:"40px",height:"2px",background:RG,margin:"0 auto 36px",borderRadius:"2px" }} />
          <blockquote style={{ fontSize:"clamp(20px,3vw,28px)",fontWeight:700,color:TEXT,lineHeight:1.45,letterSpacing:"-0.01em",marginBottom:"32px" }}>"I used to spend an entire day every week just making content. Now I do it in 90 minutes and it looks better than anything I made by hand."</blockquote>
          <p style={{ fontSize:"14px",color:TEXT_MUTED,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:600 }}>Social media manager, aesthetic clinic group</p>
        </div>
      </section>

      <section style={{ padding:"100px 0 120px" }}>
        <div className="section-inner" style={{ maxWidth:"1100px",margin:"0 auto",padding:"0 40px",textAlign:"center" }}>
          <div style={{ background:BG_CARD,border:`1px solid ${BORDER_RG}`,borderRadius:"20px",padding:"72px 40px",position:"relative",overflow:"hidden" }}>
            <div style={{ position:"absolute",top:"-60px",left:"50%",transform:"translateX(-50%)",width:"600px",height:"300px",background:"radial-gradient(ellipse at center,rgba(196,147,127,0.07) 0%,transparent 70%)",pointerEvents:"none" }} />
            <p style={{ fontSize:"12px",letterSpacing:"0.16em",textTransform:"uppercase",color:RG,fontWeight:600,marginBottom:"20px" }}>Get early access</p>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)",fontWeight:800,color:TEXT,letterSpacing:"-0.02em",lineHeight:1.15,marginBottom:"18px" }}>Ready to get your Sundays back?</h2>
            <p style={{ fontSize:"17px",color:TEXT_MUTED,marginBottom:"40px",lineHeight:1.6,maxWidth:"460px",margin:"0 auto 40px" }}>We're onboarding practices one at a time. Join the list and we'll reach out when we're ready for you.</p>
            <button onClick={() => setModalOpen(true)} className="rg-btn" style={{ fontSize:"16px",padding:"16px 40px" }}>Join the waitlist</button>
          </div>
        </div>
      </section>

      <footer style={{ borderTop:`1px solid ${BORDER}`,padding:"36px 0" }}>
        <div className="section-inner" style={{ maxWidth:"1100px",margin:"0 auto",padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"16px" }}>
          <p style={{ fontSize:"13px",color:TEXT_FAINT }}>Â© {new Date().getFullYear()} Social Media Sister Â· The CyberSuite</p>
          <div style={{ display:"flex",gap:"24px",alignItems:"center" }}>
            <Link href="/privacy" style={{ fontSize:"13px",color:TEXT_FAINT,textDecoration:"none" }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize:"13px",color:TEXT_FAINT,textDecoration:"none" }}>Terms</Link>
            <Link href="/data-deletion" style={{ fontSize:"13px",color:TEXT_FAINT,textDecoration:"none" }}>Data Deletion</Link>
            <Link href="/hub" style={{ fontSize:"13px",color:TEXT_MUTED,textDecoration:"none" }}>Log in</Link>
          </div>
        </div>
      </footer>

      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
