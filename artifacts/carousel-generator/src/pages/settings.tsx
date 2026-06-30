import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Settings as SettingsIcon, CheckCircle2, Unlink, ExternalLink, Loader2, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { invalidateCanvaStatusCache } from "@/components/export-to-canva";

const BASE = import.meta.env.BASE_URL || "/";

interface CanvaStatus {
  connected: boolean;
  canvaUserId?: string | null;
}

export default function Settings() {
  const [canva, setCanva] = useState<CanvaStatus | null>(null);
  const [canvaLoading, setCanvaLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const sendTestEmail = useCallback(async () => {
    setTestingEmail(true);
    try {
      const pw = localStorage.getItem("cybersuite-pw") || "";
      const r = await fetch(`${BASE}api/notify/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` },
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) toast.success(`Test email sent to ${data.to || "your notification address"}. Check your inbox.`);
      else toast.error(data.error || "Could not send test email.");
    } catch (e) {
      toast.error("Could not reach the server to send the test email.");
    } finally {
      setTestingEmail(false);
    }
  }, []);

  const fetchCanvaStatus = useCallback(async () => {
    setCanvaLoading(true);
    try {
      const r = await fetch(`${BASE}api/canva/status`);
      const d = (await r.json()) as CanvaStatus;
      setCanva(d);
    } catch {
      setCanva({ connected: false });
    } finally {
      setCanvaLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCanvaStatus(); }, [fetchCanvaStatus]);

  const openCanvaOAuth = () => {
    const popup = window.open(
      `${BASE}api/canva/auth/start`,
      "canva-oauth",
      "width=540,height=700,scrollbars=yes,resizable=yes"
    );

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "canva-oauth-result") return;
      window.removeEventListener("message", handler);
      popup?.close();
      if (e.data.success) {
        invalidateCanvaStatusCache();
        void fetchCanvaStatus();
        toast.success("Canva connected");
      } else {
        toast.error(`Canva connection failed: ${e.data.error || "Unknown error"}`);
      }
    };

    window.addEventListener("message", handler);

    const poll = setInterval(() => {
      if (popup?.closed) {
        clearInterval(poll);
        window.removeEventListener("message", handler);
      }
    }, 500);
  };

  const disconnectCanva = async () => {
    setDisconnecting(true);
    try {
      const r = await fetch(`${BASE}api/canva/disconnect`, { method: "POST" });
      if (!r.ok) throw new Error("Disconnect failed");
      invalidateCanvaStatusCache();
      setCanva({ connected: false });
      toast.success("Canva disconnected");
    } catch (err: any) {
      toast.error(err?.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <button className="text-gray-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Integrations</h2>
            <p className="text-sm text-gray-500 mt-0.5">Connect third-party tools to extend your workflow.</p>
          </div>

          <div className="border border-violet-500/20 rounded-xl p-5 bg-violet-950/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <span className="text-violet-300 font-bold text-sm">C</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">Canva</p>
                  <p className="text-xs text-gray-500">Export images directly to your Canva media library</p>
                </div>
              </div>
              {canvaLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              ) : canva?.connected ? (
                <span className="text-xs bg-green-900/40 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Not connected
                </span>
              )}
            </div>

            {!canvaLoading && canva?.connected && canva.canvaUserId && (
              <div className="text-xs text-gray-400 bg-gray-800/60 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                Connected as <span className="text-white font-medium">{canva.canvaUserId}</span>
              </div>
            )}

            <div className="text-xs text-gray-500 leading-relaxed">
              Once connected, an "Export to Canva" button will appear on Stories, Carousels, About Me,
              AI Photo Studio, and the Media Library. Images go straight to your Canva uploads.
            </div>

            <div className="flex gap-2">
              <Button
                onClick={openCanvaOAuth}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm h-9"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {canva?.connected ? "Reconnect Canva" : "Connect Canva"}
              </Button>
              {canva?.connected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnectCanva}
                  disabled={disconnecting}
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 h-9"
                >
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Unlink className="w-3.5 h-3.5 mr-1" />}
                  Disconnect
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-600">
              Canva Connect API — your token is stored securely on the server and never shared.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">Email alerts when a post publishes or fails.</p>
          </div>

          <div className="border border-violet-500/20 rounded-xl p-5 bg-violet-950/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <Mail className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <p className="font-semibold text-sm text-white">Post notifications</p>
                <p className="text-xs text-gray-500">You get an email the moment a post publishes or fails.</p>
              </div>
            </div>

            <div className="text-xs text-gray-500 leading-relaxed">
              Send yourself a test to confirm everything is wired up, without waiting for a real post.
            </div>

            <Button
              onClick={sendTestEmail}
              disabled={testingEmail}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm h-9"
            >
              {testingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send test email
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
