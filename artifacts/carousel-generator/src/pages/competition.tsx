import { useEffect } from "react";

export default function Competition() {
  useEffect(() => {
    document.title = "The Magical Mystery Tour · Social Media Sister";
  }, []);

  return (
    <div style={{
      background: "#0a0a0a",
      color: "#ffffff",
      fontFamily: "'Montserrat', sans-serif",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;600;700&display=swap');

        .prize-item {
          background: #ff2d78;
          font-family: 'Montserrat', sans-serif;
          font-weight: 700;
          font-size: 14px;
          line-height: 1.5;
          color: #000000;
          padding: 10px 14px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .enter-box {
          background: #ff2d78;
          padding: 18px 20px;
          margin-bottom: 20px;
        }
        .enter-box p {
          font-family: 'Montserrat', sans-serif;
          font-weight: 700;
          font-size: 13px;
          line-height: 1.7;
          color: #000000;
        }
        .enter-step {
          font-size: 13px;
          font-weight: 700;
          color: #000000;
          padding: 3px 0;
        }
        .enter-step::before { content: "→  "; }

        .photo-wrap { position: relative; display: inline-block; }
        .photo-wrap::after {
          content: "";
          position: absolute;
          bottom: -6px;
          left: -6px;
          right: 6px;
          top: 6px;
          border: 2px solid #ff2d78;
          opacity: 0.5;
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .comp-content-row { flex-direction: column !important; align-items: center !important; }
          .comp-photo-col   { width: 220px !important; }
          .comp-text-col    { width: 100% !important; }
          .comp-title       { font-size: 18vw !important; }
        }
      `}</style>

      <div style={{
        width: "100%",
        maxWidth: "900px",
        minHeight: "100vh",
        padding: "40px 30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>

        {/* Top pink line */}
        <div style={{ width: "100%", height: "4px", background: "#ff2d78", marginBottom: "40px" }} />

        {/* Brand */}
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: "11px",
          letterSpacing: "6px",
          color: "#ff2d78",
          textTransform: "uppercase",
          marginBottom: "18px",
        }}>
          Social Media Sister
        </div>

        {/* Main title */}
        <h1 className="comp-title" style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(68px, 14vw, 130px)",
          lineHeight: 0.88,
          textAlign: "center",
          letterSpacing: "2px",
          marginBottom: 0,
        }}>
          <span style={{ display: "block", color: "#ffffff" }}>The Magical</span>
          <span style={{ display: "block", color: "#ff2d78" }}>Mystery Tour</span>
        </h1>

        {/* Pink rule */}
        <div style={{
          width: "100%",
          height: "3px",
          background: "#ff2d78",
          margin: "20px 0 30px",
        }} />

        {/* Content row */}
        <div className="comp-content-row" style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "40px",
          width: "100%",
        }}>

          {/* Photo */}
          <div className="comp-photo-col" style={{ flexShrink: 0, width: "260px" }}>
            <div className="photo-wrap">
              <img
                src="/podcast-host.png"
                alt="Social Media Sister"
                style={{
                  width: "260px",
                  display: "block",
                  filter: "contrast(1.05) brightness(0.95)",
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>
          </div>

          {/* Text */}
          <div className="comp-text-col" style={{ flex: 1, paddingBottom: "8px" }}>

            {/* Prize headline */}
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(52px, 9vw, 90px)",
              lineHeight: 1,
              color: "#ffffff",
              marginBottom: "4px",
            }}>
              £5K
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "32px",
              letterSpacing: "2px",
              color: "#ff2d78",
              marginBottom: "20px",
            }}>
              For Your Clinic
            </div>

            {/* Prize items */}
            <ul style={{ listStyle: "none", marginBottom: "28px", padding: 0 }}>
              <li className="prize-item">
                <span>Full Content Day + Podcast Capture</span>
                <span style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>worth £1,500</span>
              </li>
              <li className="prize-item">
                <span>6 Month Done-For-You Social Media</span>
                <span style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>worth £3,500</span>
              </li>
            </ul>

            {/* Enter box */}
            <div className="enter-box">
              <p>
                This year I'm hitting the road, touring the entire country bringing my Content Days and Podcast experience to aesthetic clinics from Yorkshire to Scotland and everywhere in between.
              </p>
              <p style={{ marginTop: "10px" }}>
                One very lucky clinic wins the whole thing. For free.
              </p>
              <p style={{
                fontWeight: 700,
                fontSize: "12px",
                letterSpacing: "1px",
                color: "#000000",
                marginTop: "14px",
                textTransform: "uppercase",
              }}>
                To enter, drop in the comments:
              </p>
              <ul style={{ listStyle: "none", marginTop: "8px", padding: 0 }}>
                <li className="enter-step">Your name</li>
                <li className="enter-step">Your clinic name</li>
                <li className="enter-step">Your Instagram handle</li>
              </ul>
            </div>

            {/* T&Cs */}
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: "10px",
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.6,
              letterSpacing: "0.3px",
            }}>
              T&amp;Cs apply. Open to new enquiries only. Not available to existing or previous clients of Social Media Sister. Winner must be located more than 5&ndash;10 miles from any existing client. Winner selected at random and contacted via Instagram DM.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          width: "100%",
          marginTop: "40px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "22px",
            letterSpacing: "2px",
            color: "#ffffff",
            opacity: 0.6,
          }}>
            Social Media Sister
          </div>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: "11px",
            letterSpacing: "3px",
            color: "#ff2d78",
            textTransform: "uppercase",
          }}>
            @socialmediasister
          </div>
        </div>

      </div>
    </div>
  );
}
