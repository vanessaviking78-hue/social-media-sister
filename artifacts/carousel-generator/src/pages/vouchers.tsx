import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ForcedClientContext } from "@/lib/forced-client";
import { usePresets } from "@/lib/use-presets";
import { TabBoundary } from "@/components/tab-boundary";
import VouchersTab from "./vouchers-tab";
import VoucherStoriesTab from "./vstories-tab";

// VOUCHERS in Content Creation: pick a client, then make their gift voucher posts (1080 x 1440) or the same hooks as 3 story sequences (1080 x 1920).
// It is the same tool as the Vouchers tabs on each client's own page, opened on the client picked here.
const KEY = "vouchers-client-v1";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function VouchersPage() {
  const { presets, loading } = usePresets();
  const [name, setName] = useState(() => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } });
  const [kind, setKind] = useState<"posts" | "stories">("posts");
  useEffect(() => { try { localStorage.setItem(KEY, name); } catch { /* ignore */ } }, [name]);
  const sorted = useMemo(() => [...presets].sort((a, b) => a.name.localeCompare(b.name)), [presets]);
  const forced = useMemo(() => (name ? { pattern: new RegExp(`^${esc(name)}$`, "i") } : null), [name]);
  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-3xl">Vouchers</h1>
            <p className="text-white/60 text-sm">Gift voucher posts with the 3D bow and a floating text box. Pick a client, then make static posts or 3 story sequences.</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-center text-sm">
          <select className="bg-white/5 rounded p-2 min-w-[240px]" value={name} onChange={(e) => setName(e.target.value)}>
            <option value="" className="text-black">{loading ? "Loading clients..." : "Pick a client"}</option>
            {sorted.map((p) => <option key={p.id} value={p.name} className="text-black">{p.name}</option>)}
          </select>
          {([["posts", "Static posts"], ["stories", "Voucher stories"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setKind(id)} className={`px-3 py-1.5 rounded-full border ${kind === id ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{label}</button>
          ))}
        </div>
      </div>
      {forced ? (
        <ForcedClientContext.Provider value={forced}>
          <TabBoundary key={`${name}-${kind}`}>{kind === "posts" ? <VouchersTab /> : <VoucherStoriesTab />}</TabBoundary>
        </ForcedClientContext.Provider>
      ) : <div className="p-10 text-center text-white/60">Pick a client to start.</div>}
    </div>
  );
}
