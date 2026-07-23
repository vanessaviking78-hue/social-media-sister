import React, { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";

const BASE = import.meta.env.BASE_URL || "/";

export default function Coffee() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email please");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE}api/coffee-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          clinicName: clinicName.trim(),
          phone: phone.trim(),
          note: note.trim(),
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Request failed");
      }
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Something's gone wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6" style={{ fontFamily: "'League Spartan', sans-serif" }}>
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: BRAND.primaryColor }} />
          <h1 style={{ fontSize: "clamp(2rem, 8vw, 2.75rem)", lineHeight: 1.1 }}>Kettle's on.</h1>
          <p style={{ color: "rgba(255,255,255,0.6)" }}>
            Got your details. I'll ring you myself to sort a time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-lg mx-auto px-6 py-14 space-y-8">
        <div className="space-y-3">
          <h1
            style={{
              fontFamily: "'League Spartan', sans-serif",
              fontSize: "clamp(2.6rem, 10vw, 4rem)",
              lineHeight: 1,
              color: BRAND.primaryColor,
            }}
          >
            Let's have a coffee
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            No calendars, no faff. Tell me who you are and what's on your mind, and I'll ring you myself to sort a time.
          </p>
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
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Phone number</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 000000"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>What's on your mind? (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A line or two so I know what we're talking about"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 min-h-24"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-13 text-base font-semibold rounded-xl"
            style={{ background: BRAND.primaryColor, color: "#fff" }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
            ) : (
              "Get me booked in"
            )}
          </Button>
        </form>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          {BRAND.productName} &middot; {BRAND.supportEmail}
        </p>
      </div>
    </div>
  );
}
