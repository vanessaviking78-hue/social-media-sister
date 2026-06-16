import { useState, useCallback, useRef } from "react";
import { Send, X, Copy, Check, Loader2, ExternalLink, GripVertical, Image } from "lucide-react";
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
  const [step, setStep] = useState<"form" | "loading" | "preview" | "submitting" | "done">("form");
  const [carousels, setCarousels] = useState<ApprovalCarousel[]>([]);
  const [progress, setProgress] = useState<string>("Uploading images...");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const handleLoadCarousels = useCallback(async () => {
    if (!bundleName.trim()) {
      toast.error("Bundle name is required");
      return;
    }
    setStep("loading");
    try {
      const groups = await onGetImageGroups();
      if (!groups.length) {
        toast.error("No carousels to send — generate some slides first");
        setStep("form");
        return;
      }
      setCarousels(groups);
      setStep("preview");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load carousels");
      setStep("form");
    }
  }, [bundleName, onGetImageGroups]);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverIdx.current = idx;
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setCarousels((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  const handleSubmit = useCallback(async () => {
    setStep("submitting");
    setProgress("Creating approval bundle...");
    try {
      const res = await fetch(`${BASE}/api/approval-bundles/from-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleName: bundleName.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          carousels,
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
      setStep("preview");
    }
  }, [bundleName, clientName, clientEmail, carousels]);

  const copyLink = useCallback(() => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-sm">Send for Client Approval</span>
          </div>
          {step !== "submitting" && step !== "loading" && (
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">
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
                    onKeyDown={(e) => { if (e.key === "Enter") handleLoadCarousels(); }}
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
              <Button onClick={handleLoadCarousels} className="w-full gap-2 bg-green-700 hover:bg-green-600 text-white">
                <Send className="w-4 h-4" />
                Next — Review Order
              </Button>
            </>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-400" />
              <p className="text-sm text-zinc-400">Loading carousels…</p>
            </div>
          )}

          {step === "preview" && (
            <>
              <div>
                <p className="text-sm font-medium text-white mb-0.5">Arrange order</p>
                <p className="text-xs text-zinc-400">Drag to reorder. Your client sees them in this sequence.</p>
              </div>
              <div className="space-y-2">
                {carousels.map((c, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-colors hover:border-zinc-600"
                  >
                    <GripVertical className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-400 w-5 shrink-0">{idx + 1}</span>
                    {c.imageUrls[0] ? (
                      <img
                        src={c.imageUrls[0]}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-zinc-700"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                        <Image className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 truncate">
                        {c.caption ? c.caption.slice(0, 60) + (c.caption.length > 60 ? "…" : "") : "No caption"}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{c.imageUrls.length} slide{c.imageUrls.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1 border-zinc-700 text-zinc-300">
                  Back
                </Button>
                <Button onClick={handleSubmit} className="flex-1 gap-2 bg-green-700 hover:bg-green-600 text-white">
                  <Send className="w-4 h-4" />
                  Send {carousels.length} carousel{carousels.length !== 1 ? "s" : ""}
                </Button>
              </div>
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
                <Button size="sm" onClick={copyLink} variant="outline" className="shrink-0 px-2.5" title="Copy link">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="shrink-0 px-2.5" title="Open in new tab">
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
