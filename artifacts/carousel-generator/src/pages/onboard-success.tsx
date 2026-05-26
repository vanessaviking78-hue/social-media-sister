import { useParams } from "wouter";
import { CheckCircle2, Instagram } from "lucide-react";
import { BRAND } from "@/config/brand";

export default function OnboardSuccess() {
  const params = useParams<{ token: string }>();
  void params;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="px-8 py-6">
        <img src="/sms-logo.png" alt="Social Media Sister" style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover" }} />
      </div>

      <div className="flex items-center justify-center px-4 pb-16" style={{ minHeight: "calc(100vh - 152px)" }}>
        <div className="w-full max-w-xl space-y-8">
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
              lineHeight: 1,
              color: BRAND.primaryColor,
            }}
          >
            You&apos;re connected
          </h1>
          <div
            className="flex items-start gap-4 rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
            <div>
              <p className="font-semibold text-white">All done.</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                Your Facebook Page and Instagram are now linked. Your social media manager will take it from here.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Instagram className="w-4 h-4" />
            Facebook &amp; Instagram access confirmed
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {BRAND.productName} &middot; {BRAND.supportEmail}
          </p>
        </div>
      </div>
    </div>
  );
}
