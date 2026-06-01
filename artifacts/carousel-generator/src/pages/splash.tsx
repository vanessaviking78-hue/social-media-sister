import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";

export default function Splash() {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={() => navigate("/hub")}
      style={{
        background: "#000",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .splash-logo-wrap {
          animation: ${visible ? "fadeIn 800ms ease forwards" : "none"};
          opacity: ${visible ? 1 : 0};
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }
        .splash-logo-wrap:hover .splash-logo {
          transform: scale(1.025);
        }
        .splash-logo {
          transition: transform 300ms ease;
          width: min(58vw, 600px);
          height: min(58vw, 600px);
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .splash-tap {
          font-family: 'League Spartan', sans-serif;
          font-size: 24px;
          color: #E91976;
          letter-spacing: 0.2em;
          text-align: center;
        }
        .splash-footer {
          position: absolute;
          bottom: 24px;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          font-family: 'League Spartan', sans-serif;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }
        .splash-footer a {
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: color 200ms;
        }
        .splash-footer a:hover {
          color: rgba(255,255,255,0.8);
        }
        .splash-footer-links {
          display: flex;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .splash-logo {
            width: min(80vw, 600px);
            height: min(80vw, 600px);
          }
          .splash-tap {
            font-size: 18px;
          }
          .splash-footer {
            flex-direction: column;
            gap: 10px;
            text-align: center;
            padding: 0 16px;
          }
        }
      `}</style>

      <div className="splash-logo-wrap">
        <img
          src="/sms-logo.png"
          alt="Social Media Sister"
          className="splash-logo"
          draggable={false}
        />
        <p className="splash-tap">TAP TO ENTER</p>
      </div>

      <footer className="splash-footer" onClick={(e) => e.stopPropagation()}>
        <span>Social Media Sister · The CyberSuite</span>
        <div className="splash-footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data Deletion</Link>
        </div>
      </footer>
    </div>
  );
}
