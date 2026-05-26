import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, Instagram, AlertCircle, Facebook } from "lucide-react";
import { BRAND } from "@/config/brand";

const BASE = import.meta.env.BASE_URL || "/";

type State = "loading" | "default" | "already-connected" | "connecting" | "success" | "error";

export default function Onboard({ token }: { token: string }) {
  const searchParams = new URLSearchParams(window.location.search);
  const urlError = searchParams.get("error");

  const [pageState, setPageState] = useState<State>("loading");
  const [clinicName, setClinicName] = useState("");
  const [errorMsg, setErrorMsg] = useState(urlError ? decodeURIComponent(urlError) : "");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    const r = await fetch(`${BASE}api/onboarding/${token}`);
    const d = (await r.json()) as { clinicName?: string; alreadyConnected?: boolean; error?: string };
    if (!r.ok || d.error) throw new Error(d.error || "Not found");
    return d;
  }

  useEffect(() => {
    if (!token) { setPageState("error"); setErrorMsg("Invalid link."); return; }
    if (urlError) { setPageState("error"); return; }
    fetchStatus()
      .then((d) => {
        setClinicName(d.clinicName || "");
        setPageState(d.alreadyConnected ? "already-connected" : "default");
      })
      .catch(() => {
        setPageState("error");
        setErrorMsg("This link is invalid or has expired.");
      });
  }, [token]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const d = await fetchStatus();
        if (d.alreadyConnected) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPageState("success");
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleConnect() {
    setPageState("connecting");
    try {
      const r = await fetch(`${BASE}api/onboarding/${token}/start`);
      const d = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !d.url) throw new Error(d.error || "Failed to start connection");
      window.open(d.url, "_blank", "noopener");
      startPolling();
    } catch (e: unknown) {
      setErrorMsg((e as Error).message || "Failed to start connection");
      setPageState("error");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <img
          src="/sms-logo.png"
          alt="Social Media Sister"
          style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }}
        />
      </div>

      {/* Content */}
      <div className="px-5 pb-10 pt-6" style={{ maxWidth: 560 }}>

        {pageState === "loading" && (
          <div className="flex justify-center pt-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND.primaryColor }} />
          </div>
        )}

        {(pageState === "default" || pageState === "connecting") && (
          <>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2.8rem, 12vw, 4.5rem)",
                lineHeight: 1,
                color: BRAND.primaryColor,
                letterSpacing: "0.02em",
                marginBottom: "1.25rem",
              }}
            >
              Connect your socials
            </h1>

            <p className="text-lg font-medium text-white mb-2">
              {BRAND.welcomeGreeting}{clinicName ? `, ${clinicName}` : ""}.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
              {BRAND.welcomeBody}
            </p>

            <button
              onClick={handleConnect}
              disabled={pageState === "connecting"}
              style={{
                background: pageState === "connecting" ? "rgba(233,25,118,0.5)" : BRAND.primaryColor,
                color: "#fff",
                border: "none",
                borderRadius: "0.875rem",
                padding: "1rem 1.5rem",
                fontSize: "1.0625rem",
                fontWeight: 600,
                cursor: pageState === "connecting" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                width: "100%",
                justifyContent: "center",
              }}
            >
              {pageState === "connecting" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Waiting for Facebook…
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  Connect Facebook &amp; Instagram
                </>
              )}
            </button>

            {pageState === "connecting" && (
              <p className="text-sm text-center mt-4" style={{ color: "rgba(255,255,255,0.45)" }}>
                A Facebook window has opened. Complete the steps there and this page will update automatically.
              </p>
            )}
          </>
        )}

        {pageState === "already-connected" && (
          <>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2.8rem, 12vw, 4.5rem)",
                lineHeight: 1,
                color: BRAND.primaryColor,
                marginBottom: "1.5rem",
              }}
            >
              Already connected
            </h1>
            <div
              className="flex items-start gap-4 rounded-2xl p-5 mb-5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
              <div>
                <p className="font-semibold text-white">{clinicName} is already linked.</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Nothing more to do here. Your social media manager has everything they need.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Instagram className="w-4 h-4" />
              Facebook &amp; Instagram access confirmed
            </div>
          </>
        )}

        {pageState === "success" && (
          <>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2.8rem, 12vw, 4.5rem)",
                lineHeight: 1,
                color: BRAND.primaryColor,
                marginBottom: "1.5rem",
              }}
            >
              You&apos;re connected
            </h1>
            <div
              className="flex items-start gap-4 rounded-2xl p-5 mb-5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
              <div>
                <p className="font-semibold text-white">All done, {clinicName || "friend"}.</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Your Facebook Page and Instagram are now linked. Your social media manager will take it from here.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Instagram className="w-4 h-4" />
              Facebook &amp; Instagram access confirmed
            </div>
          </>
        )}

        {pageState === "error" && (
          <>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2.8rem, 12vw, 4.5rem)",
                lineHeight: 1,
                color: BRAND.primaryColor,
                marginBottom: "1.5rem",
              }}
            >
              Something went wrong
            </h1>
            <div
              className="flex items-start gap-4 rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-400" />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                {errorMsg || "This link is invalid or has expired. Please ask your social media manager for a new link."}
              </p>
            </div>
          </>
        )}

        <p className="text-xs mt-10" style={{ color: "rgba(255,255,255,0.2)" }}>
          {BRAND.productName} &middot; {BRAND.supportEmail}
        </p>
      </div>
    </div>
  );
}
