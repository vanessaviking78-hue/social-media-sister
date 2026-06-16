import { useState, useCallback } from "react";
import { Send, X, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ApprovalCarousel {
  imageUrls: string[];
  caption: string;
}

interface Props {
  onGetImageGroups: () => Promise<ApprovalCarousel[]>;
  defaultClientName?: string;
  defaultBundleName?: string;
  onClose: () => void;
}

export function SendForApprovalModal({
  onGetImageGroups,
  defaultClientName = "",
  defaultBundleName = "",
  onClose,
}: Props) {
  const [bundleName, setBundleName] = useState(defaultBundleName);
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientEmail, setClientEmail] = useState("");
  const [step, setStep] = useState<"form" | "submitting" | "done">("form");
  const [progress, setProgress] = useState<string>("Uploading images...");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!bundleName.trim()) {
      toast.error("Bundle name is required");
      return;
    }
    setStep("submitting");
    setProgress("Uploading images...");
    try {
      const groups = await onGetImageGroups();
      setProgress("Creating approval bundle...");

      const res = await fetch(`${BASE}/api/approval-bundles/from-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleName: bundleName.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          carousels: groups,
        }),
      });

      const data = await res.json() as { bundle?: { token: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create bundle");

      const token = data.bundle?.token;
      if (!token) throw new Error("No token returned from server");

      const url = `${window.location.origin}${import.meta.env.BASE_URL}client-approval/${token}`;
      setLink(url);
      setStep("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setStep("form");
    }
  }, [bundleName, clientName, clientEmail, onGetImageGroups]);

  const copyLink = useCallback(() => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">Send for Client Approval</span>
          </div>
          {step !== "submitting" && (
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {step === "form" && (
            <>
              <p className="text-sm text-zinc-400">
                Creates a shareable link for your client to approve or reject each post. The link is live for 7 days.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Bundle name</Label>
                  <Input
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                    placeholder="e.g. Glow Clinic — July 2026"
                    className="h-9 text-sm bg-zinc-950 border-zinc-700"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Client name</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Glow Clinic"
                    className="h-9 text-sm bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Client email (optional)</Label>
                  <Input
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    type="email"
                    className="h-9 text-sm bg-zinc-950 border-zinc-700"
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full gap-2 bg-green-700 hover:bg-green-600 text-white">
                <Send className="w-4 h-4" />
                Create Approval Bundle
              </Button>
            </>
          )}

          {step === "submitting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-400" />
              <p className="text-sm text-zinc-400">{progress}</p>
            </div>
          )}

          {step === "done" && link && (
            <>
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="font-semibold">Bundle ready</p>
                <p className="text-xs text-zinc-400">
                  Share this link with your client. It expires in 7 days.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={link}
                  readOnly
                  className="h-9 text-xs bg-zinc-950 border-zinc-700 flex-1"
                />
                <Button
                  size="sm"
                  onClick={copyLink}
                  variant="outline"
                  className="shrink-0 px-2.5"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 px-2.5"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Done
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/approval-bundles">View all bundles</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
