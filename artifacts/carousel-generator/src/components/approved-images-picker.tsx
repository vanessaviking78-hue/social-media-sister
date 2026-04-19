import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApprovedImages } from "@/lib/use-approval";
import { toast } from "sonner";

interface ApprovedImagesPickerProps {
  clientName?: string;
  onAddImages: (files: File[]) => void;
  mode?: "multi" | "single";
  label?: string;
}

async function urlToFile(url: string, index: number): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `approved-${index + 1}.${ext}`, { type: blob.type });
}

export default function ApprovedImagesPicker({ clientName, onAddImages, mode = "multi", label }: ApprovedImagesPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>(clientName || "");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const { data: allImages = [] } = useApprovedImages("");

  const clients = Array.from(new Set(allImages.map((img) => img.clientName))).sort();

  useEffect(() => {
    if (clientName && clients.includes(clientName)) {
      setSelectedClient(clientName);
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
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setLoading(true);
    try {
      const selectedImages = allImages.filter((img) => selected.has(img.id));
      const files = await Promise.all(selectedImages.map((img, i) => urlToFile(img.imageUrl, i)));
      onAddImages(files);
      toast.success(`Added ${files.length} approved image${files.length > 1 ? "s" : ""}`);
      setSelected(new Set());
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

  return (
    <div className="rounded-2xl border border-green-500/30 bg-card/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-lg">Approved Photos</h3>
        </div>
        <button onClick={() => { setOpen(false); setSelected(new Set()); }} className="p-1 hover:bg-accent rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>

      {clients.length > 0 && (
        <div className="relative">
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
              onClick={() => { setSelectedClient(""); setSelected(new Set()); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedClient === "" ? "bg-green-600 text-white" : "bg-accent text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            {clients.map((name) => (
              <button
                key={name}
                onClick={() => { setSelectedClient(name); setSelected(new Set()); }}
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
        <p className="text-muted-foreground text-center py-6">
          {selectedClient ? `No approved photos for ${selectedClient}.` : "No approved photos available."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => toggle(img.id)}
                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selected.has(img.id)
                    ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-green-500/50"
                }`}
              >
                <img src={img.imageUrl} alt={`Approved ${img.id}`} className="w-full h-full object-cover" />
                {selected.has(img.id) && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400 drop-shadow-lg" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                  <p className="text-[10px] text-white truncate">{img.clientName} · {img.batchName}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">{selected.size} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSelected(new Set()); }}>
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
}
