import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL || "/";

interface PageOption {
  id: string;
  name: string;
  hasInstagram: boolean;
}

export default function MetaOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "1";
  const isSelect = params.get("select") === "1";
  const errorMsg = params.get("error");
  const presetId = Number(params.get("presetId")) || 0;
  const pageName = params.get("pageName") || "";
  const hasInstagram = params.get("hasInstagram") === "1";
  const key = params.get("key") || "";

  const [pages, setPages] = useState<PageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isSuccess) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "meta-oauth-result", success: true, presetId, pageName, hasInstagram },
          window.location.origin
        );
      }
      timer = setTimeout(() => window.close(), 2000);
    } else if (errorMsg) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "meta-oauth-result", success: false, presetId, error: errorMsg },
          window.location.origin
        );
      }
    } else if (isSelect && key) {
      setLoadingPages(true);
      fetch(`${BASE}api/meta/auth/pages?key=${key}`)
        .then((r) => r.json())
        .then((d: { pages?: PageOption[] }) => setPages(d.pages || []))
        .catch(() => setSelectError("Failed to load pages. This window may have expired — please try connecting again."))
        .finally(() => setLoadingPages(false));
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  const selectPage = async (pageId: string) => {
    if (!key || selecting) return;
    setSelecting(true);
    setSelectError(null);
    try {
      const res = await fetch(`${BASE}api/meta/auth/select-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, pageId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Failed to connect page" })) as { error?: string };
        throw new Error(d.error || "Failed to connect page");
      }
      const d = (await res.json()) as {
        success?: boolean;
        pageName?: string;
        presetId?: number;
        hasInstagram?: boolean;
        error?: string;
      };
      setDone(true);
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "meta-oauth-result",
            success: true,
            presetId: d.presetId ?? presetId,
            pageName: d.pageName ?? "",
            hasInstagram: !!d.hasInstagram,
          },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 2000);
    } catch (err: unknown) {
      setSelectError(err instanceof Error ? err.message : "Unknown error");
      setSelecting(false);
    }
  };

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
            <h2 className="text-xl font-bold">Connected!</h2>
            <p className="text-gray-400 text-sm">
              <span className="text-white font-semibold">{pageName}</span> is now linked.
            </p>
            {hasInstagram && (
              <div className="flex items-center justify-center gap-1.5 text-purple-400 text-xs">
                <Instagram className="w-3.5 h-3.5" />
                Instagram account detected
              </div>
            )}
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

        {isSelect && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold">Choose a Page</h2>
              <p className="text-gray-400 text-sm">
                Multiple Facebook Pages found — pick the one to link to this preset.
              </p>
            </div>

            {loadingPages && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
              </div>
            )}

            {selectError && (
              <p className="text-red-400 text-xs text-center">{selectError}</p>
            )}

            {done && (
              <div className="text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-sm text-gray-300">Connected! Closing…</p>
              </div>
            )}

            {!done && pages.length > 0 && (
              <div className="space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    disabled={selecting}
                    onClick={() => selectPage(page.id)}
                    className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-pink-500/40 rounded-xl p-3.5 text-left flex items-center justify-between gap-3 transition-all disabled:opacity-50"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{page.name}</p>
                      {page.hasInstagram && (
                        <span className="text-xs text-purple-400 flex items-center gap-1 mt-0.5">
                          <Instagram className="w-3 h-3" /> Instagram linked
                        </span>
                      )}
                    </div>
                    {selecting && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
