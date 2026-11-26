import { useState } from "react";
import { Link } from "wouter";
import { ForcedClientContext } from "@/lib/forced-client";
import { usePresets } from "@/lib/use-presets";
import DecemberNewTab from "./decembernew-tab";

// DECEMBER-NEW as its own tool, for clinics I sell it to. It asks which client every time, then opens the 20 ready written Christmas carousels
// on that client: their colours, logo, fonts, photos and area hashtags. Never keeps the previous client.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function DecemberNew() {
  const { presets, loading } = usePresets();
  const [id, setId] = useState("");
  const [q, setQ] = useState("");
  const chosen = presets.find((p) => String(p.id) === id);
  if (chosen) {
    return (
      <div className="min-h-screen bg-[#161616] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-white/60">DECEMBER-NEW for {chosen.name}</span>
          <button onClick={() => setId("")} className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">Change client</button>
        </div>
        <ForcedClientContext.Provider value={{ pattern: new RegExp(`^${esc(chosen.name)}$`, "i") }}>
          <DecemberNewTab key={chosen.id} />
        </ForcedClientContext.Provider>
      </div>
    );
  }
  const list = presets.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Link href="/hub" className="text-sm text-white/60 hover:text-white">Back to the hub</Link>
        <h1 className="text-3xl font-black">DECEMBER-NEW</h1>
        <p className="text-white/60 text-sm">20 ready written Christmas carousels with captions. Choose the client first and everything opens in their colours, logo and area.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" className="w-full rounded border border-white/20 bg-transparent px-3 py-2" />
        {loading && <p className="text-white/60 text-sm">Loading...</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {list.map((p) => (
            <button key={p.id} onClick={() => setId(String(p.id))} className="rounded-lg border border-white/15 hover:bg-white/10 px-3 py-3 text-sm text-left">{p.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
