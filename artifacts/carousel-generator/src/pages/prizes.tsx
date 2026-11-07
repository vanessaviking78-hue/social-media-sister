import { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

type Prize = { name: string; price: string; worth?: string; until?: string; localOnly?: boolean };

// Change a price here and it changes on the wheel.
// A prize with an "until" date drops off the wheel once that date has passed.
const ALL_PRIZES: Prize[] = [
  { name: "1 Month Socials: You Post Yourself", price: "£187" },
  { name: "1 Month Socials: I Post For You", price: "£387", worth: "£650" },
  { name: "Free Strategy Call", price: "FREE" },
  { name: "Quarter Full Socials", price: "£950", worth: "£1,950" },
  { name: "Bundle of Business Tools", price: "£97", worth: "£997" },
  { name: "10 Free Posts", price: "FREE" },
  { name: "Half Price Podcast Episode", price: "£397", worth: "£999" },
  { name: "Whole Year of Social Media: One Off Payment", price: "£2,400", worth: "£7,800", until: "2026-12-01T00:00:00Z" },
  { name: "10 Free Carousel Posts", price: "FREE", worth: "£399" },
  { name: "Masterclass", price: "£199", worth: "£399" },
  { name: "6 Months Content Calendar", price: "£99" },
  { name: "1 Month Socials", price: "£250", worth: "£650" },
  { name: "Free 30 Minute Call", price: "FREE" },
  { name: "Quarter Socials", price: "£750", worth: "£1,950" },
  { name: "Rebrand", price: "£99", worth: "£400" },
  { name: "Half Price Content Day (Within 40 Miles of BD13)", price: "£750", worth: "£1,500", localOnly: true },
  { name: "AI Photo Shoot", price: "£99", worth: "£399" },
  { name: "Free Coaching Session", price: "FREE", worth: "£400" },
];

const PINK = "#ff1493";
const INK = "#111";

// Content Day is only offered within this many miles of BD13.
const HOME_OUTCODE = "BD13";
const HOME_FALLBACK = { lat: 53.7625, lon: -1.8467 };
const MAX_MILES = 40;

function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Returns true only when we can confirm the postcode is within range.
async function isNearHome(postcode: string): Promise<boolean> {
  try {
    const pc = encodeURIComponent(postcode.replace(/\s+/g, "").toUpperCase());
    const [mine, home] = await Promise.all([
      fetch(`https://api.postcodes.io/postcodes/${pc}`).then((r) => r.json()),
      fetch(`https://api.postcodes.io/outcodes/${HOME_OUTCODE}`).then((r) => r.json()).catch(() => null),
    ]);
    if (!mine?.result) return false;
    const from = { lat: mine.result.latitude, lon: mine.result.longitude };
    const to = home?.result ? { lat: home.result.latitude, lon: home.result.longitude } : HOME_FALLBACK;
    return miles(from, to) <= MAX_MILES;
  } catch {
    return false;
  }
}

async function sendToVanessa(email: string, prize: Prize, claimed: boolean, postcode?: string) {
  try {
    await fetch(`${BASE}api/prize-spins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, postcode, prize: prize.name, price: prize.price, claimed }),
    });
  } catch {
    /* never block the wheel */
  }
}

export default function Prizes() {
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [nearby, setNearby] = useState(true);
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Prize | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    document.title = "Prizes · The CyberSuite";
  }, []);

  const PRIZES = useMemo(
    () => ALL_PRIZES.filter((p) => (!p.until || Date.now() < new Date(p.until).getTime()) && (nearby || !p.localOnly)),
    [nearby],
  );
  const n = PRIZES.length;
  const slice = 360 / n;

  const gradient = useMemo(
    () =>
      "conic-gradient(" +
      PRIZES.map((_, i) => `${i % 2 ? INK : PINK} ${i * slice}deg ${(i + 1) * slice}deg`).join(", ") +
      ")",
    [slice, PRIZES],
  );

  function spin() {
    if (spinning) return;
    setWon(null);
    setClaimed(false);
    setSpinning(true);
    const index = Math.floor(Math.random() * n);
    const centre = index * slice + slice / 2;
    const target = rotation + 360 * 6 + ((360 - centre - (rotation % 360)) % 360);
    setRotation(target);
    window.setTimeout(() => {
      setSpinning(false);
      setWon(PRIZES[index]);
      void sendToVanessa(email, PRIZES[index], false, postcode);
    }, 5200);
  }

  function claim() {
    if (!won || claimed) return;
    setClaimed(true);
    void sendToVanessa(email, won, true, postcode);
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const validPostcode = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(postcode.trim());

  async function unlock() {
    setChecking(true);
    setNearby(await isNearHome(postcode));
    setChecking(false);
    setUnlocked(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        color: INK,
        fontFamily: "system-ui, sans-serif",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <p style={{ color: PINK, fontWeight: 700, letterSpacing: 2, margin: 0 }}>LAUNCH SPECIAL</p>
      <h1 style={{ fontSize: 34, margin: "8px 0" }}>The Cybersuite™ Launch Prizes</h1>
      <p style={{ maxWidth: 480, margin: "0 auto 24px" }}>
        Exclusive prizes to celebrate the launch. One spin, real savings.
      </p>

      {!unlocked ? (
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <p>Enter your email and postcode to unlock the wheel.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourclinic.com"
            style={{ width: "100%", padding: 12, fontSize: 16, border: `2px solid ${INK}`, borderRadius: 8, boxSizing: "border-box" }}
          />
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Postcode"
            style={{ width: "100%", padding: 12, fontSize: 16, border: `2px solid ${INK}`, borderRadius: 8, boxSizing: "border-box", marginTop: 10 }}
          />
          <button
            disabled={!validEmail || !validPostcode || checking}
            onClick={unlock}
            style={{ marginTop: 12, width: "100%", padding: 14, fontSize: 16, fontWeight: 700, background: validEmail && validPostcode ? PINK : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: validEmail && validPostcode ? "pointer" : "default" }}
          >
            {checking ? "Checking..." : "Unlock the Wheel"}
          </button>
          <p style={{ fontSize: 13, opacity: 0.7 }}>No spam. Just prizes.</p>
        </div>
      ) : (
        <>
          <div style={{ position: "relative", width: 320, height: 320, margin: "0 auto" }}>
            <div
              style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderTop: `28px solid ${INK}`,
                zIndex: 2,
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: gradient,
                border: `6px solid ${INK}`,
                boxSizing: "border-box",
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 5s cubic-bezier(0.15, 0.7, 0.1, 1)" : "none",
                position: "relative",
              }}
            >
              {PRIZES.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 0,
                    height: 0,
                    transform: `rotate(${i * slice + slice / 2}deg)`,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: -50,
                      top: -138,
                      width: 100,
                      fontSize: 8,
                      fontWeight: 700,
                      lineHeight: 1.1,
                      color: "#fff",
                    }}
                  >
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={spin}
            disabled={spinning}
            style={{ marginTop: 28, padding: "14px 36px", fontSize: 18, fontWeight: 800, background: INK, color: "#fff", border: `3px solid ${PINK}`, borderRadius: 999, cursor: spinning ? "default" : "pointer" }}
          >
            {spinning ? "Spinning..." : won ? "Spin Again" : "SPIN THE WHEEL"}
          </button>

          {won && (
            <div style={{ margin: "28px auto 0", maxWidth: 380, border: `3px solid ${PINK}`, borderRadius: 16, padding: 20 }}>
              <p style={{ color: PINK, fontWeight: 800, margin: 0 }}>You won!</p>
              <h2 style={{ margin: "8px 0" }}>{won.name}</h2>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                {won.price}
                {won.worth && <span style={{ textDecoration: "line-through", opacity: 0.5, marginLeft: 10, fontWeight: 400 }}>{won.worth}</span>}
              </p>
              <button
                onClick={claim}
                disabled={claimed}
                style={{ marginTop: 16, padding: "12px 24px", fontSize: 16, fontWeight: 700, background: PINK, color: "#fff", border: "none", borderRadius: 8, cursor: claimed ? "default" : "pointer" }}
              >
                {claimed ? "Claimed, Vanessa will be in touch" : "Claim My Prize"}
              </button>
            </div>
          )}
        </>
      )}

      <h3 style={{ marginTop: 48 }}>Prizes up for grabs</h3>
      <ul style={{ listStyle: "none", padding: 0, maxWidth: 420, margin: "0 auto" }}>
        {PRIZES.map((p, i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <span>{p.name}</span>
            <strong style={{ color: PINK }}>{p.price}</strong>
          </li>
        ))}
      </ul>

      <h4 style={{ marginTop: 40 }}>Terms &amp; Conditions</h4>
      <p style={{ fontSize: 13, maxWidth: 420, margin: "0 auto" }}>
        1. Prize winner must not be in conflict with an existing Cybersuite client.
        <br />
        2. Must not be an arsehole to work for.
        <br />
        3. The Half Price Content Day is only available to winners within 40 miles of BD13.
      </p>
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 24 }}>The Cybersuite™ • vanessa@thecybersuite.com • Launch 2026</p>
    </div>
  );
}
