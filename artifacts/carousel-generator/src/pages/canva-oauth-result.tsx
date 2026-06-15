import { useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CanvaOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "1";
  const errorMsg = params.get("error");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isSuccess) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "canva-oauth-result", success: true },
          window.location.origin
        );
      }
      timer = setTimeout(() => window.close(), 2000);
    } else if (errorMsg) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "canva-oauth-result", success: false, error: errorMsg },
          window.location.origin
        );
      }
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-gray-900 rounded-2xl p-8 space-y-5 border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-semibold text-gray-300 text-sm">Social Media Sis CyberSuite</span>
        </div>

        {isSuccess && (
          <div className="text-center space-y-3">
            <CheckCircle className="w-14 h-14 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold">Canva Connected</h2>
            <p className="text-gray-400 text-sm">
              You can now export images directly to your Canva account.
            </p>
            <p className="text-xs text-gray-600">Closing automatically…</p>
          </div>
        )}

        {errorMsg && (
          <div className="text-center space-y-3">
            <XCircle className="w-14 h-14 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold">Connection failed</h2>
            <p className="text-gray-400 text-sm break-words">{decodeURIComponent(errorMsg)}</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              onClick={() => window.close()}
            >
              Close
            </Button>
          </div>
        )}

        {!isSuccess && !errorMsg && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
          </div>
        )}
      </div>
    </div>
  );
}
