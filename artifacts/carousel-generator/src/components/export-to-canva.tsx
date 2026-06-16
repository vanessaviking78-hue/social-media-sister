import React, { useState, useEffect } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL || "/";

interface ExportToCanvaButtonProps {
  imageUrl?: string;
  getImage?: () => Promise<string>;
  name?: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

let cachedStatus: boolean | null = null;
let cacheExpiry = 0;

async function checkCanvaStatus(): Promise<boolean> {
  if (cachedStatus !== null && Date.now() < cacheExpiry) return cachedStatus;
  try {
    const r = await fetch(`${BASE}api/canva/status`);
    if (!r.ok) return false;
    const d = (await r.json()) as { connected: boolean };
    cachedStatus = d.connected;
    cacheExpiry = Date.now() + 30000;
    return d.connected;
  } catch {
    return false;
  }
}

export function invalidateCanvaStatusCache() {
  cachedStatus = null;
  cacheExpiry = 0;
}

export default function ExportToCanvaButton({
  imageUrl,
  getImage,
  name,
  variant = "ghost",
  size = "sm",
  className = "",
  label = "Export to Canva",
}: ExportToCanvaButtonProps) {
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkCanvaStatus().then((ok) => { if (!cancelled) setConnected(ok); });
    return () => { cancelled = true; };
  }, []);

  if (!connected) return null;

  const handleClick = async () => {
    if (uploading) return;
    setUploading(true);
    setDone(false);
    const toastId = toast.loading("Uploading to Canva…");
    try {
      let body: Record<string, string>;

      if (imageUrl) {
        const absoluteUrl = imageUrl.startsWith("http") ? imageUrl : `${window.location.origin}${imageUrl}`;
        body = { imageUrl: absoluteUrl, name: name ?? "Social Media Sister Export" };
      } else if (getImage) {
        const dataUrl = await getImage();
        body = { imageBase64: dataUrl, name: name ?? "Social Media Sister Export" };
      } else {
        throw new Error("No image source provided");
      }

      const r = await fetch(`${BASE}api/canva/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const d = (await r.json()) as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Upload failed");

      toast.success("Sent to Canva — check your media uploads.", { id: toastId });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={uploading}
      className={`text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 ${className}`}
      title="Export to Canva"
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : done ? (
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
      ) : (
        <Upload className="w-3.5 h-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  );
}
