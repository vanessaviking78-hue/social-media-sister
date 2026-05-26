import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, CheckCircle2, Instagram } from "lucide-react";
import { BRAND } from "@/config/brand";

const BASE = import.meta.env.BASE_URL || "/";

interface PageOption {
  id: string;
  name: string;
  hasInstagram: boolean;
}

export default function OnboardChoosePage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const key = searchParams.get("key") || "";

  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!key) { setError("Missing session key."); setLoading(false); return; }
    fetch(`${BASE}api/meta/auth/pages?key=${key}`)
      .then((r) => r.json())
      .then((d: { pages?: PageOption[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setPages(d.pages || []);
      })
      .catch((e: unknown) => setError((e as Error).message || "Session expired."))
      .finally(() => setLoading(false));
  }, [key]);

  async function selectPage(pageId: string) {
    if (selecting) return;
    setSelecting(true);
    try {
      const r = await fetch(`${BASE}api/onboarding/${token}/save-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, pageId }),
      });
      const d = (await r.json()) as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error || "Failed to save");
      setDone(true);
      setTimeout(() => navigate(`/onboard/${token}/success`), 1200);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to save page");
      setSelecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="px-8 py-6">
        <img src="/sms-logo.png" alt="Social Media Sister" style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover" }} />
      </div>

      <div className="flex items-center justify-center px-4 pb-16" style={{ minHeight: "calc(100vh - 152px)" }}>
        <div className="w-full max-w-xl space-y-8">
          <div>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                lineHeight: 1,
                color: BRAND.primaryColor,
              }}
            >
              Choose your page
            </h1>
            <p className="mt-3 text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
              We found multiple Facebook Pages on your account. Pick the one for this clinic.
            </p>
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND.primaryColor }} />
            </div>
          )}

          {error && (
            <div className="rounded-xl p-4 text-sm text-red-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }}>
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <span className="text-sm text-green-300">Connected. Redirecting…</span>
            </div>
          )}

          {!loading && !error && !done && pages.length > 0 && (
            <div className="space-y-3">
              {pages.map((page) => (
                <button
                  key={page.id}
                  disabled={selecting}
                  onClick={() => selectPage(page.id)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "0.875rem",
                    padding: "1rem 1.25rem",
                    textAlign: "left",
                    cursor: selecting ? "not-allowed" : "pointer",
                    opacity: selecting ? 0.6 : 1,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!selecting) (e.currentTarget as HTMLButtonElement).style.borderColor = BRAND.primaryColor; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                >
                  <p className="font-semibold text-white">{page.name}</p>
                  {page.hasInstagram && (
                    <span className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "rgba(167,139,250,0.9)" }}>
                      <Instagram className="w-3 h-3" /> Instagram linked
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            {BRAND.productName} &middot; {BRAND.supportEmail}
          </p>
        </div>
      </div>
    </div>
  );
}
