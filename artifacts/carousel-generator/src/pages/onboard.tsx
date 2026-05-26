import { useEffect, useState, useRef } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2, Instagram, AlertCircle, Facebook } from "lucide-react";
import { BRAND } from "@/config/brand";

const BASE = import.meta.env.BASE_URL || "/";

type State = "loading" | "default" | "already-connected" | "connecting" | "success" | "error";

export default function Onboard() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
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
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="px-8 py-6">
        <img src="/sms-logo.png" alt="Social Media Sister" style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover" }} />
      </div>

      <div className="flex items-center justify-center px-4 pb-16" style={{ minHeight: "calc(100vh - 152px)" }}>
        <div className="w-full max-w-xl space-y-8">

          {pageState === "loading" && (
            <div className="flex justify-center pt-20">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: BRAND.primaryColor }} />
            </div>
          )}

          {(pageState === "default" || pageState === "connecting") && (
            <>
              <div>
                <h1
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                    lineHeight: 1,
                    color: BRAND.primaryColor,
                    letterSpacing: "0.02em",
                  }}
                >
                  Connect your socials
                </h1>
                <p className="mt-4 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {BRAND.welcomeGreeting}{clinicName ? `, ${clinicName}` : ""}.
                </p>
                <p className="mt-2 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {BRAND.welcomeBody}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={pageState === "connecting"}
                  style={{
                    background: pageState === "connecting" ? "rgba(233,25,118,0.5)" : BRAND.primaryColor,
                    color: "#fff",
                    border: "none",
                    borderRadius: "0.75rem",
                    padding: "1rem 2rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: pageState === "connecting" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    width: "100%",
                    justifyContent: "center",
                    transition: "opacity 0.15s",
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
                  <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                    A Facebook window has opened. Complete the steps there and this page will update automatically.
                  </p>
                )}
              </div>
            </>
          )}

          {pageState === "already-connected" && (
            <div className="space-y-6">
              <h1
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                  lineHeight: 1,
                  color: BRAND.primaryColor,
                }}
              >
                Already connected
              </h1>
              <div
                className="flex items-start gap-4 rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                <div>
                  <p className="font-semibold text-white">Your account is linked.</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {clinicName} is already connected to Social Media Sister. Nothing more to do here.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Instagram className="w-4 h-4" />
                Facebook &amp; Instagram access confirmed
              </div>
            </div>
          )}

          {pageState === "success" && (
            <div className="space-y-6">
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
            </div>
          )}

          {pageState === "error" && (
            <div className="space-y-6">
              <h1
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                  lineHeight: 1,
                  color: BRAND.primaryColor,
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
