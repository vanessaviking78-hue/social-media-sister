import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";

const BASE = import.meta.env.BASE_URL || "/";
const FOUNDER_TOTAL = 20;

export default function FounderSignup() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const prefillClinic = params.get("clinic") || "";
  const bundleToken = params.get("bundle") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState(prefillClinic);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE}api/bundle/founder-spots`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.remaining === "number") setRemaining(d.remaining); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (remaining !== null && remaining <= 0) {
      toast.error("All founder spots have been claimed");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE}api/bundle/founder-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), clinicName: clinicName.trim(), phone: phone.trim(), bundleToken }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Sign-up failed" }));
        throw new Error(data.error || "Sign-up failed");
      }
      const data = await resp.json();
      navigate(`/founder-welcome?name=${encodeURIComponent(name.trim())}&clinic=${encodeURIComponent(clinicName.trim())}`);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const spotsLeft = remaining ?? FOUNDER_TOTAL;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-lg mx-auto px-6 py-14 space-y-10">

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-yellow-400">Founder Rate</span>
          </div>
          <h1
            style={{
              fontFamily: "'League Spartan', sans-serif",
              fontSize: "clamp(2.6rem, 10vw, 4rem)",
              lineHeight: 1,
              color: BRAND.primaryColor,
            }}
          >
            Lock in £97/month.<br />For life.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            The CyberSuite is built for clinic owners who want to show up consistently without burning out. The Founder Rate is the lowest this will ever be. Once it's gone, it's gone.
          </p>
        </div>

        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
            {spotsLeft > 0 ? `${spotsLeft} of ${FOUNDER_TOTAL} spots remaining` : "All spots claimed"}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: FOUNDER_TOTAL }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: i < (FOUNDER_TOTAL - spotsLeft)
                    ? BRAND.primaryColor
                    : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Your name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@yourclinic.com"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Clinic name</Label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Your clinic name"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Phone (optional)</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 000000"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || spotsLeft <= 0}
            className="w-full h-13 text-base font-semibold rounded-xl"
            style={{ background: BRAND.primaryColor, color: "#fff" }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reserving your spot…</>
            ) : (
              "Claim my founder spot"
            )}
          </Button>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            No payment taken here. Vanessa will be in touch to complete your sign-up.
          </p>
        </form>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          {BRAND.productName} &middot; {BRAND.supportEmail}
        </p>
      </div>
    </div>
  );
}
