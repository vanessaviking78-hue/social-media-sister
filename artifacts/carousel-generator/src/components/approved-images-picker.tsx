import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, X, CheckCircle2, Maximize2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useApprovedImages, sameClientName, authHeaders } from "@/lib/use-approval";
import { toast } from "sonner";
import ExportToCanvaButton from "@/components/export-to-canva";

interface ApprovedImagesPickerProps {
  clientName?: string;
  onAddImages: (files: File[]) => void;
  mode?: "multi" | "single";
  label?: string;
  /** Skip auto background-removal -- use when the photo is meant to be a plain full-bleed background, not a cutout overlay. Defaults to false (removal on). */
  skipBackgroundRemoval?: boolean;
  /** Opens the picker as a big pop-up with whole, uncropped photos and a full size preview, instead of small square tiles. */
  large?: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Every approved photo pulled into a builder gets its background stripped
// automatically via Photoroom, no toggle needed. Falls back to the original
// image if the removal call fails for any reason, so a Photoroom hiccup never
// blocks someone from adding a photo.
async function removeBackground(url: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/api/ai-portrait/remove-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url }),
    });
    if (!res.ok) return url;
    const data = await res.json();
    return data.url || url;
  } catch {
    return url;
  }
}

// Some AI photos come back with black bars across the top and bottom (or down both sides). When an
// image has bars on BOTH opposite edges, they are trimmed off as it is pulled through, so posts never
// show a black strip. A black studio backdrop is left alone because the subject touches one of the edges.
async function trimBlackBars(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return blob;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const dark = (x: number, y: number) => { const i = (y * w + x) * 4; return d[i + 3] > 200 && d[i] <= 14 && d[i + 1] <= 14 && d[i + 2] <= 14; };
    // A line counts as bar when at least 98% of its pixels are near black.
    const rowBar = (y: number) => { let n = 0; for (let x = 0; x < w; x += 2) if (dark(x, y)) n++; return n >= Math.ceil(w / 2) * 0.98; };
    const colBar = (x: number) => { let n = 0; for (let y = 0; y < h; y += 2) if (dark(x, y)) n++; return n >= Math.ceil(h / 2) * 0.98; };
    let top = 0; while (top < h * 0.4 && rowBar(top)) top++;
    let bottom = 0; while (bottom < h * 0.4 && rowBar(h - 1 - bottom)) bottom++;
    let left = 0; while (left < w * 0.4 && colBar(left)) left++;
    let right = 0; while (right < w * 0.4 && colBar(w - 1 - right)) right++;
    const vertical = top >= h * 0.02 && bottom >= h * 0.02;
    const horizontal = left >= w * 0.02 && right >= w * 0.02;
    if (!vertical && !horizontal) return blob;
    const sx = horizontal ? left : 0, sy = vertical ? top : 0;
    const sw = w - (horizontal ? left + right : 0), sh = h - (vertical ? top + bottom : 0);
    if (sw < w * 0.3 || sh < h * 0.3) return blob;
    const out = document.createElement("canvas");
    out.width = sw; out.height = sh;
    out.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const type = blob.type.includes("png") ? "image/png" : "image/jpeg";
    const trimmed = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.95));
    return trimmed ?? blob;
  } catch {
    return blob;
  }
}

async function urlToFile(url: string, index: number): Promise<File> {
  const res = await fetch(url);
  const blob = await trimBlackBars(await res.blob());
  const ext = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `approved-${index + 1}.${ext}`, { type: blob.type });
}

// Builds the Canva asset name as clientname+topic, no spaces (e.g. "HarwoodAestheticsbathroom"),
// so exports are easy to find and tell apart inside Canva.
function canvaAssetName(clientName: string, topic: string): string {
  const client = (clientName || "Client").replace(/\s+/g, "");
  const cleanTopic = (topic || "photo").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  return `${client}${cleanTopic}`;
}

export default function ApprovedImagesPicker({ clientName, onAddImages, mode = "multi", label, skipBackgroundRemoval = false, large = false }: ApprovedImagesPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>(clientName || "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Tracks the order photos were tapped in, since Bulk Carousel maps each photo
  // to a row by position. A Set alone doesn't guarantee click order survives.
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: allImages = [] } = useApprovedImages("");
  const qc = useQueryClient();
  // Two taps to delete a photo for good: the first asks, the second does it.
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const deleteImage = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/approval/images/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error();
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setSelectedOrder((prev) => prev.filter((x) => x !== id));
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ["approved-images"] });
      toast.success("Photo deleted");
    } catch {
      toast.error("Could not delete that photo");
    }
  };

  const clients = Array.from(new Set(allImages.map((img) => img.clientName))).sort();

  useEffect(() => {
    if (clientName) {
      const match = clients.includes(clientName) ? clientName : clients.find((c) => sameClientName(c, clientName));
      if (match) setSelectedClient(match);
    }
  }, [clientName, clients.join(",")]);

  const images = selectedClient
    ? allImages.filter((img) => img.clientName === selectedClient)
    : allImages;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "single") {
        if (next.has(id)) { next.delete(id); } else { next.clear(); next.add(id); }
      } else {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      return next;
    });
    setSelectedOrder((prev) => {
      if (mode === "single") {
        return prev.includes(id) ? [] : [id];
      }
      if (prev.includes(id)) return prev.filter((existingId) => existingId !== id);
      return [...prev, id];
    });
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setLoading(true);
    try {
      // Build the list in the exact order photos were tapped, not the order
      // the server happens to return them in, so each photo lands on the
      // row the person meant it for.
      const byId = new Map(allImages.map((img) => [img.id, img]));
      const selectedImages = selectedOrder.map((id) => byId.get(id)).filter((img): img is NonNullable<typeof img> => Boolean(img));

      const results = await Promise.allSettled(selectedImages.map(async (img, i) => {
        const cleanUrl = skipBackgroundRemoval ? img.imageUrl : await removeBackground(img.imageUrl);
        return urlToFile(cleanUrl, i);
      }));
      const files = results
        .filter((r): r is PromiseFulfilledResult<File> => r.status === "fulfilled")
        .map((r) => r.value);
      const failedCount = results.length - files.length;

      onAddImages(files);

      if (failedCount > 0) {
        toast.error(`${failedCount} photo${failedCount > 1 ? "s" : ""} couldn't be loaded and ${failedCount > 1 ? "were" : "was"} skipped, the rest came through fine.`);
      }
      if (files.length > 0) {
        toast.success(`Added ${files.length} approved image${files.length > 1 ? "s" : ""}`);
      }
      setSelected(new Set());
      setSelectedOrder([]);
      setOpen(false);
    } catch {
      toast.error("Failed to load approved images");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-colors min-h-[80px] flex items-center justify-center gap-3 px-8 cursor-pointer"
      >
        <ShieldCheck className="w-6 h-6 text-green-400" />
        <div className="text-left">
          <p className="font-semibold text-base text-green-400">{label || "Use Approved Photos"}</p>
          <p className="text-sm text-muted-foreground">
            {allImages.length > 0
              ? `${allImages.length} photo${allImages.length !== 1 ? "s" : ""} across ${clients.length} client${clients.length !== 1 ? "s" : ""} — scroll to pick a person`
              : "No approved photos available yet"}
          </p>
        </div>
      </button>
    );
  }

  const panel = (
    <div className={large
      ? "rounded-2xl border border-green-500/30 bg-card w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
      : "rounded-2xl border border-green-500/30 bg-card/80 p-5 space-y-4"}
    >
      <div className={large ? "flex items-center justify-between shrink-0 px-5 pt-5 pb-3" : "flex items-center justify-between"}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-lg">Approved Photos</h3>
        </div>
        <button onClick={() => { setOpen(false); setSelected(new Set()); setSelectedOrder([]); }} className="p-1 hover:bg-accent rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>

      {clients.length > 0 && (
        <div className={large ? "relative shrink-0 px-5 pb-3" : "relative"}>
          <div
            className="flex gap-2 overflow-x-auto pb-2 pr-8"
            style={{
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",
              overscrollBehaviorX: "contain",
            }}
          >
            <button
              onClick={() => { setSelectedClient(""); setSelected(new Set()); setSelectedOrder([]); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedClient === "" ? "bg-green-600 text-white" : "bg-accent text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            {clients.map((name) => (
              <button
                key={name}
                onClick={() => { setSelectedClient(name); setSelected(new Set()); setSelectedOrder([]); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedClient === name ? "bg-green-600 text-white" : "bg-accent text-muted-foreground hover:text-foreground"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-card/90 to-transparent" />
        </div>
      )}

      {images.length === 0 ? (
        <p className={`text-muted-foreground text-center py-6 ${large ? "px-5 pb-8" : ""}`}>
          {selectedClient ? `No approved photos for ${selectedClient}.` : "No approved photos available."}
        </p>
      ) : (
        <>
          <div className={large ? "flex-1 min-h-0 overflow-y-auto px-5 pb-3" : undefined}>
          <div className={large ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" : "grid grid-cols-4 md:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto"}>
            {images.map((img) => {
              const orderIndex = selectedOrder.indexOf(img.id);
              return (
                <div
                  key={img.id}
                  onClick={() => toggle(img.id)}
                  className={`relative ${large ? "aspect-[3/4] bg-muted/40" : "aspect-square"} rounded-xl overflow-hidden cursor-pointer transition-all ${
                    selected.has(img.id)
                      ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
                      : "hover:ring-1 hover:ring-green-500/50"
                  }`}
                >
                  <img src={img.imageUrl} alt={`Approved ${img.id}`} className={`w-full h-full ${large ? "object-contain" : "object-cover"}`} />
                  {selected.has(img.id) && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      {mode === "multi" && orderIndex >= 0 ? (
                        <span className="w-7 h-7 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center drop-shadow-lg">
                          {orderIndex + 1}
                        </span>
                      ) : (
                        <CheckCircle2 className="w-8 h-8 text-green-400 drop-shadow-lg" />
                      )}
                    </div>
                  )}
                  {large && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPreview(img.imageUrl); }}
                      className="absolute top-1 left-1 z-10 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
                      aria-label="View this photo full size"
                      title="View full size"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                  <div
                    className="absolute top-1 right-1 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExportToCanvaButton
                      imageUrl={img.imageUrl}
                      name={canvaAssetName(img.clientName, img.batchName)}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-black/60 hover:bg-black/80 rounded-full p-0"
                      label=""
                    />
                  </div>
                  <div className="absolute bottom-5 right-1 z-10" onClick={(e) => e.stopPropagation()}>
                    {confirmDelete === img.id ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => deleteImage(img.id)} className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white" aria-label="Confirm delete this photo">Delete?</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white" aria-label="Keep this photo">Keep</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(img.id)} className="h-6 w-6 rounded-full bg-black/60 hover:bg-red-600 flex items-center justify-center" aria-label="Delete this photo" title="Delete this photo">
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                    <p className="text-[10px] text-white truncate">{img.clientName} · {img.batchName}</p>
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          <div className={large ? "flex items-center justify-between shrink-0 px-5 py-4 border-t border-border/30" : "flex items-center justify-between pt-2"}>
            <p className="text-sm text-muted-foreground">{selected.size} selected{selected.size > 1 ? ", in tap order" : ""}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSelected(new Set()); setSelectedOrder([]); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!selected.size || loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {loading ? "Loading..." : `Add ${selected.size} Photo${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (!large) return panel;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-6"
        onClick={() => { setOpen(false); setSelected(new Set()); setSelectedOrder([]); }}
      >
        <div className="w-full max-w-6xl flex justify-center" onClick={(e) => e.stopPropagation()}>
          {panel}
        </div>
      </div>
      {preview && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="Approved photo, full size" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
            aria-label="Close preview"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}
