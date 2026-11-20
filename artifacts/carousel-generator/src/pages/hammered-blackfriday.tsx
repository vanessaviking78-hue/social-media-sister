import { useEffect, useMemo, useRef, useState } from "react";

// /hammeredblackfriday: the Hammered Black Friday page. Public. Black and yellow, League Spartan. Same four offers and prices as the
// Social Media Sister Black Friday page (/blackfriday26). Opens, offers looked at and WhatsApp taps go to the same counter,
// tagged src "hammered" (or whatever ?src= is on the link), so they show up in /blackfriday26/stats.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const YELLOW = "#ffd600";
const WHATSAPP = "447301059304";
const ENDS = new Date("2026-11-30T23:59:59Z").getTime();

type Offer = { key: string; title: string; price: string; unit: string; saving: string; body: string; ask: string; big?: boolean };

const OFFERS: Offer[] = [
  {
    key: "h-12for6",
    title: "12 months for the price of 6",
    price: "£3000",
    unit: "one payment, which is £250 a month",
    saving: "Saves you £3000",
    body: "Pay once and the second six months are on the house. A full year of content and management, usually £6000. One payment, one invoice, then I get on with it while you're up a roof.",
    ask: "12 months for the price of 6",
    big: true,
  },
  {
    key: "h-monthly",
    title: "Monthly, tied in for a year",
    price: "£350",
    unit: "a month for 12 months",
    saving: "Saves you £1800",
    body: "Not up for one payment? Spread it. It's £350 a month instead of my usual £500, and you're tied in for the year so we can build something properly.",
    ask: "the £350 a month, tied in for a year",
  },
  {
    key: "h-6for3",
    title: "6 months for the price of 3",
    price: "£1500",
    unit: "upfront for 6 months",
    saving: "Saves you £1500",
    body: "Half a year of content and management, usually £3000. A lovely way in if a full year feels like a lot to commit to.",
    ask: "6 months for the price of 3",
  },
  {
    key: "h-diy",
    title: "DIY from the portal",
    price: "£275",
    unit: "a month, or £2000 upfront for the year",
    saving: "Saves you £1300 if you pay for the year",
    body: "You grab your content from the portal and upload it yourself, reels hub included. The year upfront is £2000, down from £3300.",
    ask: "the DIY portal option",
  },
];

const wa = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

function getVisitor(): string {
  try {
    let v = localStorage.getItem("bf26-v");
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("bf26-v", v);
    }
    return v;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function useCountdown() {
  const [left, setLeft] = useState(() => Math.max(0, ENDS - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, ENDS - Date.now())), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor(left / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, over: left <= 0 };
}

export default function HammeredBlackFriday() {
  const visitor = useMemo(getVisitor, []);
  const src = useMemo(() => {
    try {
      return (new URLSearchParams(window.location.search).get("src") || "hammered").slice(0, 30);
    } catch {
      return "hammered";
    }
  }, []);
  // Vanessa's own visits (signed in to the tools) are not counted.
  const mine = useMemo(() => {
    try { return localStorage.getItem("cybersuite-auth") === "true"; } catch { return false; }
  }, []);
  const seen = useRef<Set<string>>(new Set());
  const cd = useCountdown();

  const track = (event: string, offer?: string) => {
    if (mine) return;
    try {
      const body = JSON.stringify({ visitor, event, offer, src });
      fetch(`${BASE}/api/bf26/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* tracking must never break the page */ }
  };

  useEffect(() => {
    document.title = "Black Friday | Hammered";
    track("view", "h-page");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const key = (e.target as HTMLElement).dataset.offer;
        if (e.isIntersecting && key && !seen.current.has(key)) {
          seen.current.add(key);
          track("offer_view", key);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-offer]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const font = "'League Spartan', sans-serif";
  // Alternating boxes: yellow with black writing, then black with yellow writing and a yellow edge.
  const box = (dark: boolean) => (dark ? { background: "#000", color: YELLOW, border: `3px solid ${YELLOW}` } : { background: YELLOW, color: "#000", border: `3px solid ${YELLOW}` });

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: YELLOW }}>Hammered &middot; Black Friday</div>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(2.8rem, 9vw, 6rem)", lineHeight: 0.95, margin: "10px 0 6px", textTransform: "uppercase", letterSpacing: "-0.02em", color: YELLOW }}>
          Down tools. I'll do the posting.
        </h1>
        <div style={{ height: 10, width: 120, background: YELLOW, marginBottom: 20 }} />
        <p style={{ fontSize: "clamp(1.2rem, 3vw, 1.7rem)", fontWeight: 600, lineHeight: 1.25, maxWidth: 760, margin: 0 }}>
          Black Friday tradespeople only. Four ways to have me look after your socials, at prices only Black Friday clients get. Live until the end of Monday 30th November, and slots are limited.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "26px 0 8px" }}>
          {cd.over ? (
            <div style={{ ...box(true), borderRadius: 14, padding: "14px 20px", fontWeight: 900, fontSize: 26 }}>Black Friday places have closed</div>
          ) : (
            [["days", cd.d], ["hours", cd.h], ["mins", cd.m], ["secs", cd.s]].map(([l, n], i) => (
              <div key={String(l)} style={{ ...box(i % 2 === 0), borderRadius: 14, padding: "10px 18px", minWidth: 92 }}>
                <div style={{ fontWeight: 900, fontSize: 40, lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>
                <div style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 36 }}>until the Black Friday places close</div>

        <div style={{ border: `3px solid ${YELLOW}`, borderRadius: 18, padding: "22px 24px", marginBottom: 40 }}>
          <h2 style={{ fontWeight: 900, fontSize: "clamp(1.7rem, 4vw, 2.4rem)", margin: "0 0 8px", textTransform: "uppercase", lineHeight: 1, color: YELLOW }}>Why me?</h2>
          <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
            I've worked with over 500 businesses, and I've done a stint on a building site myself, so I know what a working day looks like. Posts and stories that make you look like the trustworthy tradesperson you are, made from your own work and your own photos, with my honest opinion thrown in for free.
          </p>
        </div>

        <h2 style={{ fontWeight: 900, fontSize: "clamp(1.7rem, 4vw, 2.6rem)", margin: "0 0 6px", textTransform: "uppercase", lineHeight: 1, color: YELLOW }}>Every management place includes</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0 40px" }}>
          {[["12", "posts a month"], ["12", "stories a month"], ["1", "reels hub to choose your reels from"]].map(([n, t], i) => (
            <div key={t} style={{ ...box(i % 2 === 0), borderRadius: 14, padding: "14px 20px", flex: "1 1 200px" }}>
              <div style={{ fontWeight: 900, fontSize: 46, lineHeight: 1 }}>{n}</div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{t}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontWeight: 900, fontSize: "clamp(1.7rem, 4vw, 2.6rem)", margin: "0 0 14px", textTransform: "uppercase", lineHeight: 1, color: YELLOW }}>The offers</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {OFFERS.map((o, i) => (
            <div key={o.key} data-offer={o.key} style={{ border: `3px solid ${YELLOW}`, borderRadius: 18, overflow: "hidden" }}>
              {o.big && <div style={{ background: YELLOW, color: "#000", fontWeight: 900, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 22px" }}>The biggest saving</div>}
              <div style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 340px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: YELLOW, textTransform: "uppercase", letterSpacing: "0.1em" }}>Option {i + 1}</div>
                    <h3 style={{ fontWeight: 900, fontSize: "clamp(1.6rem, 3.6vw, 2.2rem)", lineHeight: 1, margin: "4px 0 10px", textTransform: "uppercase" }}>{o.title}</h3>
                    <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.4, margin: 0 }}>{o.body}</p>
                  </div>
                  <div style={{ background: YELLOW, color: "#000", borderRadius: 14, padding: "14px 20px", minWidth: 210 }}>
                    <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 1 }}>{o.price}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{o.unit}</div>
                    <div style={{ fontWeight: 900, fontSize: 15, marginTop: 8 }}>{o.saving}</div>
                  </div>
                </div>
                <a
                  href={wa(`Hi Vanessa, I've seen your Hammered Black Friday offers and I'm interested in ${o.ask}. Can you tell me more?`)}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => track("wa_click", o.key)}
                  style={{ display: "inline-block", marginTop: 16, background: YELLOW, color: "#000", fontWeight: 900, fontSize: 17, textTransform: "uppercase", textDecoration: "none", padding: "12px 22px", borderRadius: 12, border: `3px solid ${YELLOW}` }}
                >
                  Ask me about this one
                </a>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...box(false), borderRadius: 20, padding: "34px 26px", marginTop: 44, textAlign: "center" }}>
          <h2 style={{ fontWeight: 900, fontSize: "clamp(2rem, 6vw, 3.4rem)", lineHeight: 1, margin: "0 0 10px", textTransform: "uppercase" }}>No hard sell.</h2>
          <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.35, maxWidth: 640, margin: "0 auto 22px" }}>
            Message me, ask whatever you like, and we'll see if we're a good fit. If we're not, I'll tell you.
          </p>
          <a
            href={wa("Hi Vanessa, I've seen your Hammered Black Friday offers and I've got a question.")}
            target="_blank" rel="noopener noreferrer"
            onClick={() => track("wa_click", "h-general")}
            style={{ display: "inline-block", background: "#000", color: YELLOW, fontWeight: 900, fontSize: 20, textTransform: "uppercase", textDecoration: "none", padding: "16px 30px", borderRadius: 14 }}
          >
            Message me to ask any questions
          </a>
        </div>

        <p style={{ fontSize: 13, fontWeight: 500, color: "#aaa", marginTop: 28, lineHeight: 1.5 }}>
          Black Friday places are open until the end of Monday 30 November 2026. Slots are limited. The prices shown are for places taken in that time.
        </p>
      </div>
    </div>
  );
}
