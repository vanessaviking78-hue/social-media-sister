import { CheckCircle2, Calendar, Grid, Film, Image, User, Sparkles, MessageSquare } from "lucide-react";
import { BRAND } from "@/config/brand";

const CALENDLY_URL = "https://calendly.com/socialmediasister/15min";

const DIY_FEATURES = [
  { icon: Grid, label: "Carousel Generator", desc: "Up to 60 AI-assisted carousel posts per session, with custom branding and ZIP export." },
  { icon: Film, label: "Reels Builder", desc: "Multi-slide reel text overlays with image, typewriter, cover, and hero modes." },
  { icon: Image, label: "Single Image Posts", desc: "AI-generated overlay text for single photo posts, ready to download." },
  { icon: User, label: "About Me Posts", desc: "Branded about-me carousels with background removal and doodle overlays." },
  { icon: MessageSquare, label: "Caption Library", desc: "Save, organise, and reuse captions by client and category." },
  { icon: Sparkles, label: "AI Content Generation", desc: "Generate slide text, captions, and story questions in your clinic's voice." },
  { icon: Calendar, label: "Content Calendar", desc: "Plan posts by month with drag-and-drop scheduling." },
];

export default function FounderWelcome() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name") || "there";
  const clinic = params.get("clinic") || "";

  const firstName = name.split(" ")[0];

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-14 space-y-12">

        <div className="space-y-4">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{ background: `${BRAND.primaryColor}20`, color: BRAND.primaryColor, border: `1px solid ${BRAND.primaryColor}40` }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Spot reserved
          </div>

          <h1
            style={{
              fontFamily: "'League Spartan', sans-serif",
              fontSize: "clamp(2.8rem, 11vw, 4.5rem)",
              lineHeight: 1,
              color: "#ffffff",
            }}
          >
            Welcome,<br />
            <span style={{ color: BRAND.primaryColor }}>{firstName}.</span>
          </h1>

          {clinic && (
            <p className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
              {clinic}
            </p>
          )}

          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            You have reserved your Founder Rate spot. Vanessa will be in touch within 24 hours to complete your sign-up and get you started.
          </p>
        </div>

        <div
          className="rounded-2xl p-6 space-y-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            In the meantime
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            Book a quick 15-minute call with Vanessa. She will walk you through the tool, answer your questions, and make sure the setup fits your clinic from day one.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
          >
            <Calendar className="w-4 h-4" />
            Book 15-min call with Vanessa
          </a>
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Your DIY tier includes
          </h2>
          <div className="space-y-3">
            {DIY_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-4 rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${BRAND.primaryColor}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: BRAND.primaryColor }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{label}</p>
                  <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          {BRAND.productName} &middot; {BRAND.supportEmail}
        </p>
      </div>
    </div>
  );
}
