import smsLogo from "@/assets/sms-logo.png";

const TICKER_TEXT = "AESTHETIC SOCIAL MEDIA";
const REPEAT = 8;

export default function About() {
  const items = Array.from({ length: REPEAT }, (_, i) => (
    <span key={i} className="ticker-item">
      {TICKER_TEXT}
      <span className="ticker-dot">✦</span>
    </span>
  ));

  return (
    <div className="about-root">
      <div className="about-logo-wrap">
        <img src={smsLogo} alt="Social Media Sister" className="about-logo" draggable={false} />
      </div>

      <div className="ticker-outer" aria-label={TICKER_TEXT}>
        <div className="ticker-track">
          {items}
          {items}
        </div>
      </div>

      <style>{`
        .about-root {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          user-select: none;
        }

        .about-logo-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          width: 100%;
        }

        .about-logo {
          max-width: min(90vw, 90vh);
          max-height: min(75vw, 75vh);
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .ticker-outer {
          width: 100%;
          overflow: hidden;
          padding: 24px 0;
          flex-shrink: 0;
        }

        .ticker-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
          animation: ticker-scroll 22s linear infinite;
          will-change: transform;
        }

        .ticker-item {
          font-family: 'League Spartan', sans-serif;
          font-size: clamp(3rem, 8vw, 7rem);
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #fff;
          padding: 0 0.6em;
          line-height: 1;
        }

        .ticker-dot {
          margin: 0 0.4em;
          opacity: 0.4;
          font-size: 0.55em;
          vertical-align: middle;
        }

        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
