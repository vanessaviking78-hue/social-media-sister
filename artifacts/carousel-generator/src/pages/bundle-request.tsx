import { useState } from "react";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

function api(path: string) {
  return `${BASE}api/${path}`;
}

export default function BundleRequest() {
  const [clinicName, setClinicName] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [email, setEmail] = useState("");
  const [treatmentFocus, setTreatmentFocus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!clinicName.trim() || !email.trim() || !treatmentFocus.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(api("bundle-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          igHandle: igHandle.trim() || undefined,
          email: email.trim(),
          treatmentFocus: treatmentFocus.trim(),
        }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error((d as any).error || "Something went wrong");
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-500/15 mb-4">
            <Sparkles className="w-7 h-7 text-pink-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Social Media Sister</h1>
          <p className="text-pink-400 text-sm font-medium mt-1 tracking-wide uppercase">Trial Bundle</p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-pink-500/30 bg-pink-950/20 p-10 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-pink-400 mx-auto" />
            <h2 className="text-2xl font-bold text-white">You're in.</h2>
            <p className="text-zinc-300 leading-relaxed">
              We've got your details. If it's a good fit, we'll put together four pieces of content written specifically for <span className="text-white font-semibold">{clinicName}</span> and send you the link.
            </p>
            <p className="text-zinc-500 text-sm">No spam. No pitch. Just the work.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Request a free content sample</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Four pieces of social content, written for your clinic, at no cost. We review every request personally.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200">
                  Clinic name <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Bloom Aesthetics"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200">
                  Instagram handle <span className="text-zinc-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={igHandle}
                  onChange={(e) => setIgHandle(e.target.value)}
                  placeholder="@bloom_aesthetics"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200">
                  Email address <span className="text-pink-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@bloomaesthetics.co.uk"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-200">
                  Top treatment focus <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  value={treatmentFocus}
                  onChange={(e) => setTreatmentFocus(e.target.value)}
                  placeholder="e.g. lip filler, skin boosters, anti-wrinkle"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors"
                />
                <p className="text-zinc-500 text-xs mt-1">The treatment you're most known for, or most want to grow.</p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                ) : (
                  "Request my free sample"
                )}
              </button>

              <p className="text-center text-zinc-600 text-xs">
                We review every request. Not everyone gets one. That's the point.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
