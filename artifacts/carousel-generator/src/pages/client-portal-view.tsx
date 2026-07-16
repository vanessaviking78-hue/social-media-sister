import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Search, ExternalLink, Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Preset = { id: number; name: string; clientPortalToken: string };

export default function ClientPortalView() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Preset | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/presets`)
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d.presets) ? d.presets : []))
      .catch(() => setPresets([]));
  }, []);

  const filteredPresets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(term));
  }, [presets, search]);

  const portalUrl = selected ? `${window.location.origin}/portal/${selected.clientPortalToken}` : "";

  const copyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast.success("Link copied.");
  };

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Client Portal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selected ? `Viewing as ${selected.name}` : "Pick a client to see exactly what they see"}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {!selected && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className={inputCls + " pl-9"} />
            </div>
            <div className="grid gap-2">
              {filteredPresets.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)} className="text-left rounded-xl border border-zinc-800 hover:border-pink-600 px-4 py-3 text-sm">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-6">
            <button onClick={() => setSelected(null)} className="text-xs text-pink-400 underline">Change client</button>

            <div className="rounded-2xl border border-border/50 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-pink-400" />
                <h2 className="font-semibold text-sm">{selected.name} portal</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={portalUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-semibold py-3 flex items-center justify-center gap-2 text-sm">
                  <ExternalLink className="w-4 h-4" /> Open their portal
                </a>
                <button onClick={copyLink} className="flex-1 rounded-full border border-zinc-700 hover:border-pink-600 text-white font-semibold py-3 flex items-center justify-center gap-2 text-sm">
                  <Copy className="w-4 h-4" /> Copy link
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 overflow-hidden" style={{ height: "80vh" }}>
              <iframe src={portalUrl} title="Client portal preview" className="w-full h-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
