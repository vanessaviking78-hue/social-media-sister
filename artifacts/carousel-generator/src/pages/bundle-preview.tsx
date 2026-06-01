import React, { useEffect, useState } from "react";
import { Copy, Check, Package, Grid, User, Film, Image as ImageIcon, Loader2, Star, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";

const CALENDLY_URL = "https://calendly.com/socialmediasister/15min";
const FOUNDER_TOTAL = 20;

const BASE = import.meta.env.BASE_URL || "/";

const VOICE_LABELS: Record<string, string> = {
  "northern-grit": "Northern Grit",
  "whimsical": "Whimsical",
  "professional-warmth": "Professional with Warmth",
  "girly-sweet": "Girly and Sweet",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="flex-shrink-0 h-8">
      {copied ? (
        <><Check className="w-3.5 h-3.5 mr-1.5 text-green-400" />Copied</>
      ) : (
        <><Copy className="w-3.5 h-3.5 mr-1.5" />{label}</>
      )}
    </Button>
  );
}

interface BundleSlide {
  heading: string;
  body?: string;
}

interface BundleContent {
  carousel: { slides: BundleSlide[]; caption: string };
  aboutMe: { intro: string; caption: string };
  reel: { script: string; caption: string };
  seamless: { tagline: string; caption: string };
}

interface Bundle {
  clinicName: string;
  igHandle: string;
  treatmentFocus: string;
  brandColour: string;
  voiceStyle: string;
  content: BundleContent;
}

export default function BundlePreview({ token }: { token: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spotsRemaining, setSpotsRemaining] = useState<number>(FOUNDER_TOTAL);

  useEffect(() => {
    fetch(`${BASE}api/bundle/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setBundle(data);
      })
      .catch(() => setError("Failed to load bundle"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetch(`${BASE}api/bundle/founder-spots`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.remaining === "number") setSpotsRemaining(d.remaining); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-xl text-muted-foreground">{error || "Bundle not found"}</p>
      </div>
    );
  }

  const { content, clinicName, treatmentFocus, brandColour, voiceStyle } = bundle;

  return (
    <div className="min-h-screen bg-background">
      <div
        className="border-b border-border/20"
        style={{ background: `linear-gradient(135deg, ${brandColour}18 0%, transparent 60%)` }}
      >
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-3">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{ backgroundColor: `${brandColour}25` }}
            >
              <Package className="w-6 h-6" style={{ color: brandColour }} />
            </div>
            <div>
              <h1 className="font-sans text-3xl font-semibold tracking-tight">{clinicName}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {treatmentFocus} · {VOICE_LABELS[voiceStyle] || voiceStyle} voice
              </p>
            </div>
          </div>
          <p className="text-base text-muted-foreground pt-1 max-w-xl">
            Four pieces of content, one voice, built for your clinic. Each piece is ready to copy, adapt, and post.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Carousel */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-pink-400" />
            <h2 className="font-semibold text-lg">Standard Carousel</h2>
            {content.carousel.slides.length > 0 && (
              <span className="text-xs text-muted-foreground bg-accent/30 px-2 py-0.5 rounded-full">
                {content.carousel.slides.length} slides
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="divide-y divide-border/20">
              {content.carousel.slides.map((slide, i) => (
                <div key={i} className="px-5 py-4 flex items-start gap-4">
                  <span className="text-primary font-mono text-sm font-bold flex-shrink-0 w-5 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">{slide.heading}</p>
                    {slide.body && (
                      <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{slide.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border/30 bg-accent/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Caption</span>
                <CopyButton text={content.carousel.caption} />
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {content.carousel.caption}
              </p>
            </div>
          </div>
        </section>

        {/* About Me */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-rose-400" />
            <h2 className="font-semibold text-lg">About Me Post</h2>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="px-5 py-5 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Intro text</p>
              <p className="text-base leading-relaxed">{content.aboutMe.intro}</p>
            </div>
            <div className="px-5 py-4 border-t border-border/30 bg-accent/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Caption</span>
                <CopyButton text={content.aboutMe.caption} />
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {content.aboutMe.caption}
              </p>
            </div>
          </div>
        </section>

        {/* Reel */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-teal-400" />
            <h2 className="font-semibold text-lg">Reel</h2>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="px-5 py-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-4">Overlay text lines</p>
              <div className="space-y-3">
                {(content.reel.script || "").split("|").filter(Boolean).map((line, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: `${brandColour}20`, color: brandColour }}
                    >
                      {i + 1}
                    </span>
                    <p className="font-semibold text-base">{line.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border/30 bg-accent/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Caption</span>
                <CopyButton text={content.reel.caption} />
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {content.reel.caption}
              </p>
            </div>
          </div>
        </section>

        {/* Seamless Carousel */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-lg">Seamless Carousel</h2>
          </div>
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="px-5 py-6">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-4">Tagline</p>
              <div
                className="rounded-xl p-6 text-center"
                style={{
                  background: `linear-gradient(135deg, ${brandColour}20, ${brandColour}08)`,
                  border: `1px solid ${brandColour}30`,
                }}
              >
                <p className="text-2xl font-bold tracking-tight" style={{ color: brandColour }}>
                  {content.seamless.tagline}
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border/30 bg-accent/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Caption</span>
                <CopyButton text={content.seamless.caption} />
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {content.seamless.caption}
              </p>
            </div>
          </div>
        </section>

        {/* Founder Rate CTA */}
        <section className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(233,25,118,0.12) 0%, rgba(233,25,118,0.04) 100%)", border: "1px solid rgba(233,25,118,0.25)" }}>
          <div className="px-7 py-8 space-y-5">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.primaryColor }}>Founder Rate</span>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight">This content, every week. £97/month — locked for life.</h2>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-lg">
                Everything you just saw, built for your clinic, posted consistently. The CyberSuite handles the content. You focus on the clinic.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: FOUNDER_TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{
                      background: i < (FOUNDER_TOTAL - spotsRemaining)
                        ? BRAND.primaryColor
                        : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold" style={{ color: spotsRemaining > 5 ? "rgba(255,255,255,0.6)" : BRAND.primaryColor }}>
                {spotsRemaining > 0
                  ? `${spotsRemaining} of ${FOUNDER_TOTAL} founder spots remaining`
                  : "All founder spots claimed"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href={`/founder-signup?clinic=${encodeURIComponent(bundle.clinicName)}&bundle=${token}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: BRAND.primaryColor, color: "#fff" }}
              >
                <Star className="w-4 h-4" />
                Claim my founder spot — £97/mo
              </a>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold border transition-colors hover:bg-accent/30"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
              >
                <Calendar className="w-4 h-4" />
                Book a 15-min call with Vanessa
              </a>
            </div>
          </div>
        </section>

        <div className="text-center pb-8">
          <p className="text-sm text-muted-foreground/40">Powered by The CyberSuite</p>
        </div>
      </div>
    </div>
  );
}
