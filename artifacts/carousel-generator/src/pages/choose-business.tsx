import { Link } from "wouter";

// cybersuite.com/choose : where she picks which leg of the business she is working in today.
// Social Media Sister (white, black and hot pink) goes to the hub. Hammered (black and yellow) goes to its own home.

const PINK = "#ff1493";
const YELLOW = "#ffd60a";

export default function ChooseBusiness() {
  return (
    <div className="cb">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
        .cb, .cb * { box-sizing: border-box; font-family: 'League Spartan', 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
        .cb { position: fixed; inset: 0; display: grid; grid-template-columns: 1fr 1fr; }
        .cb a.half { display: flex; flex-direction: column; justify-content: center; padding: 6vh 5vw; text-decoration: none; position: relative; overflow: hidden; transition: filter 200ms; }
        .cb a.half:hover { filter: brightness(1.06); }
        .cb .kicker { font-size: clamp(12px, 1.3vw, 18px); letter-spacing: 0.32em; text-transform: uppercase; margin-bottom: 2vh; }
        .cb h2 { margin: 0; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.84; font-size: min(11vw, 17vh); }
        .cb .line { height: min(1.6vw, 1.6vh); width: 38%; margin: 3vh 0; }
        .cb .go { display: inline-block; align-self: flex-start; text-transform: uppercase; letter-spacing: 0.2em; font-size: clamp(14px, 1.6vw, 22px); padding: 1.8vh 2.4vw; border: 3px solid; transition: transform 150ms; }
        .cb a.half:hover .go { transform: translateX(6px); }
        .cb .sms { background: #fff; color: #000; }
        .cb .sms .kicker { color: ${PINK}; }
        .cb .sms .line { background: ${PINK}; }
        .cb .sms .go { background: #000; color: ${PINK}; border-color: #000; }
        .cb .ham { background: #000; color: #fff; }
        .cb .ham .kicker { color: ${YELLOW}; }
        .cb .ham h2 { color: ${YELLOW}; }
        .cb .ham .line { background: ${YELLOW}; }
        .cb .ham .go { background: ${YELLOW}; color: #000; border-color: ${YELLOW}; }
        .cb .back { position: absolute; top: 2.4vh; left: 50%; transform: translateX(-50%); z-index: 5; background: #000; color: #fff; padding: 8px 16px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; text-decoration: none; border: 2px solid #fff; }
        .cb .back:hover { background: ${PINK}; color: #000; }
        @media (max-width: 760px) { .cb { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } .cb h2 { font-size: min(15vw, 12vh); } .cb .back { top: auto; bottom: 2vh; } }
      `}</style>
      <Link href="/" className="back">The Cyber Suite</Link>
      <Link href="/hub" className="half sms">
        <div className="kicker">Business one</div>
        <h2>Social<br />Media<br />Sister</h2>
        <div className="line" />
        <span className="go">Go to the hub</span>
      </Link>
      <Link href="/hammered" className="half ham">
        <div className="kicker">Business two</div>
        <h2>Ham<br />mered</h2>
        <div className="line" />
        <span className="go">Go to Hammered</span>
      </Link>
    </div>
  );
}
