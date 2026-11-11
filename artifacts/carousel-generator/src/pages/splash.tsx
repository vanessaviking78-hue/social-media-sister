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

// The front page. Just the name, huge, black on white, with a full height hot pink panel that is the button to the page where she picks which business she is working in.
const PINK = "#ff1493";
const INK = "#000";

export default function Splash() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("enter") === PASSWORD || localStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="cs-front">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
        .cs-front, .cs-front * { box-sizing: border-box; font-family: 'League Spartan', 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
        .cs-front { position: fixed; inset: 0; background: #fff; color: ${INK}; display: grid; grid-template-columns: 1fr 24vw; overflow: hidden; }
        .cs-front .name { display: flex; flex-direction: column; justify-content: center; padding: 2vh 3vw; min-width: 0; position: relative; }
        .cs-front h1 { margin: 0; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.8; font-size: min(21vw, 29vh); color: ${INK}; }
        .cs-front h1 span { display: block; }
        .cs-front .legal { position: absolute; left: 3vw; bottom: 2vh; display: flex; gap: 20px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; }
        .cs-front .legal a { color: ${INK}; text-decoration: none; opacity: 0.55; }
        .cs-front .legal a:hover { opacity: 1; color: ${PINK}; }
        .cs-front a.enter { background: ${PINK}; color: ${INK}; text-decoration: none; text-transform: uppercase; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: 4vh 2vw; font-size: min(5.4vw, 9vh); letter-spacing: -0.02em; line-height: 0.85; transition: background 150ms, color 150ms; }
        .cs-front a.enter small { font-size: clamp(11px, 1.1vw, 16px); letter-spacing: 0.3em; margin-bottom: 1.6vh; }
        .cs-front a.enter:hover { background: ${INK}; color: ${PINK}; }
        @media (max-width: 760px) {
          .cs-front { grid-template-columns: 1fr; grid-template-rows: 1fr 22vh; }
          .cs-front h1 { font-size: min(22vw, 17vh); }
          .cs-front .legal { display: none; }
          .cs-front a.enter { font-size: min(14vw, 10vh); padding: 2vh 5vw; }
        }
      `}</style>
      <div className="name">
        <h1>
          <span>The</span>
          <span>Cyber</span>
          <span>Suite<span style={{ display: "inline", color: PINK }}>.</span></span>
        </h1>
        <div className="legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data Deletion</Link>
        </div>
      </div>
      <Link href="/choose" className="enter">
        <small>Pick your business</small>
        Enter
      </Link>
    </div>
  );
}
