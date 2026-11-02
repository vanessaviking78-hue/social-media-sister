import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BRAND } from "@/config/brand";

// Mailchimp embedded form: "30 Day Content Calendar Lead Magnet"
// Audience: Social Media Sister. The form posts into a hidden iframe so the
// visitor never leaves the page and we show our own thank you message.
const MC_ACTION =
  "https://store.us10.list-manage.com/subscribe/post?u=0c0c86040f98ca351fa2dffbe&id=fc00c528ad";
const MC_HONEYPOT = "b_0c0c86040f98ca351fa2dffbe_fc00c528ad";
const MC_TAG_ID = "14565652"; // Lead magnet: 30 day calendar

const PINK = BRAND.primaryColor;
const FONT = "'League Spartan', sans-serif";

const WHO_FOR = [
  "You're brilliant at your treatments and a bit less keen on the posting side",
  "You open Instagram, stare at it, and close it again",
  "You'd love to stay on the right side of the ASA without needing a law degree",
];

const INSIDE = [
  "A hook for every single day, so you never start from scratch",
  "Caption starters in a warm, human voice",
  "A question to end each post on, because comments are what the algorithm loves",
  "A printable tick sheet, because watching a month fill up is oddly satisfying",
];

export default function Landing() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submittedRef = useRef(false);

  useEffect(() => {
    document.title = "30 days of clinic posts, already planned";
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    if (!emailOk) {
      e.preventDefault();
      setError("That email looks a bit off. Have another go?");
      return;
    }
    setError("");
    submittedRef.current = true;
    setSubmitting(true);
    // The native form post carries on into the hidden iframe.
  };

  // Mailchimp answers inside the hidden iframe; its load event is our cue.
  const handleIframeLoad = () => {
    if (!submittedRef.current) return;
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div
        className="min-h-screen bg-black text-white flex items-center justify-center px-6"
        style={{ fontFamily: FONT }}
      >
        <div className="max-w-md text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: PINK }} />
          <h1 style={{ fontSize: "clamp(2.2rem, 9vw, 3rem)", lineHeight: 1.05 }}>
            You're in{firstName.trim() ? `, ${firstName.trim()}` : ""}.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.05rem", lineHeight: 1.5 }}>
            Your 30 days is heading to your inbox. Give it a few minutes, and
            have a peek in your junk folder if it's feeling shy.
          </p>
          <div
            className="rounded-2xl p-5 text-left space-y-2"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p style={{ color: PINK, fontSize: "0.8rem", letterSpacing: "0.08em" }}>WHILE YOU WAIT</p>
            <p style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              Five tiny social media jobs a day, a tick list, and confetti when
              you finish them. It's £7 a month and it keeps your posting habit
              alive.
            </p>
            <a
              href="/dailytasks"
              className="inline-block pt-1 font-semibold"
              style={{ color: PINK }}
            >
              Peek at the Daily Five
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: FONT }}>
      <iframe
        name="mc-hidden-frame"
        title="mailchimp-response"
        onLoad={handleIframeLoad}
        style={{ display: "none" }}
      />

      <div className="max-w-lg mx-auto px-5 pt-12 pb-16 space-y-10">
        {/* Hero */}
        <header className="space-y-4">
          <p style={{ color: PINK, fontSize: "0.8rem", letterSpacing: "0.1em" }}>
            FREE FOR CLINIC OWNERS
          </p>
          <h1
            style={{
              fontSize: "clamp(2.4rem, 10vw, 3.6rem)",
              lineHeight: 1.02,
              color: "#fff",
            }}
          >
            Posting for your clinic shouldn't eat your evenings.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.1rem", lineHeight: 1.5 }}>
            Grab 30 days of posts, already planned. Hooks, captions and
            questions, ready to use today.
          </p>
        </header>

        {/* Form, above the fold on a phone */}
        <form
          action={MC_ACTION}
          method="post"
          target="mc-hidden-frame"
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="space-y-1.5">
            <label htmlFor="FNAME" className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              First name
            </label>
            <input
              id="FNAME"
              name="FNAME"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              className="w-full h-12 rounded-lg px-3 text-white placeholder:text-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="EMAIL" className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              Email address
            </label>
            <input
              id="EMAIL"
              name="EMAIL"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourclinic.com"
              className="w-full h-12 rounded-lg px-3 text-white placeholder:text-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>

          {/* Mailchimp plumbing: tag and honeypot */}
          <input type="hidden" name="tags" value={MC_TAG_ID} />
          <div style={{ position: "absolute", left: "-5000px" }} aria-hidden="true">
            <input type="text" name={MC_HONEYPOT} tabIndex={-1} defaultValue="" />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#ff8fb8" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            name="subscribe"
            disabled={submitting}
            className="w-full h-14 rounded-xl text-lg font-semibold flex items-center justify-center gap-2"
            style={{ background: PINK, color: "#fff", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Sending
              </>
            ) : (
              "Send me my 30 days"
            )}
          </button>

          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            Free and instant. I'll also pop the odd daily hook in your inbox
            that might make you giggle. Unsubscribe whenever you like.
          </p>
        </form>

        {/* Who it's for */}
        <section className="space-y-4">
          <h2 style={{ fontSize: "1.6rem", lineHeight: 1.1, color: PINK }}>Sound like you?</h2>
          <ul className="space-y-3">
            {WHO_FOR.map((t) => (
              <li key={t} className="flex gap-3" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: PINK }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What's inside */}
        <section className="space-y-4">
          <h2 style={{ fontSize: "1.6rem", lineHeight: 1.1, color: PINK }}>What's inside</h2>
          <ul className="space-y-3">
            {INSIDE.map((t) => (
              <li key={t} className="flex gap-3" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: PINK }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Meet me */}
        <section className="space-y-3">
          <h2 style={{ fontSize: "1.6rem", lineHeight: 1.1, color: PINK }}>Meet me</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.55 }}>
            I'm Vanessa. I've spent 20 years in social media and 7 in
            aesthetics, and I've looked after over 300 clinics. I'm known for
            being honest, funny and a bit blunt, and I want your clinic to
            sound like a real person wrote it, because one did.
          </p>
        </section>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          Social Media Sister &middot; {BRAND.supportEmail}
        </p>
      </div>
    </div>
  );
}
