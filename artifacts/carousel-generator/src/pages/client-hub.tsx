import { lazy, Suspense, useEffect, useState } from "react";
import { ForcedClientContext, type ForcedClient } from "@/lib/forced-client";
import { U_TREATMENTS } from "@/lib/universal-treatments";

// A CLIENT'S OWN PAGE, the same set of tools as Clare's page, every one opened on that client.
// Universal is limited to the treatments the client ticked on the treatments form.
const lazyTab = (load: () => Promise<{ default: React.ComponentType }>) => lazy(load);
const TABS: { id: string; label: string; Comp: React.ComponentType }[] = [
  { id: "universal", label: "Universal treatments", Comp: lazyTab(() => import("./universal")) },
  { id: "treatments", label: "Treatment carousels", Comp: lazyTab(() => import("./treatments")) },
  { id: "about", label: "About me", Comp: lazyTab(() => import("./client-about")) },
  { id: "unique", label: "Unique", Comp: lazyTab(() => import("./unique")) },
  { id: "empower", label: "Empower", Comp: lazyTab(() => import("./empower")) },
  { id: "mens", label: "Men", Comp: lazyTab(() => import("./mens")) },
  { id: "november", label: "November", Comp: lazyTab(() => import("./november-posts")) },
  { id: "xmas", label: "December", Comp: lazyTab(() => import("./xmas-posts")) },
  { id: "lux", label: "LUX", Comp: lazyTab(() => import("./lux")) },
  { id: "basic", label: "Basic posts", Comp: lazyTab(() => import("./basic-posts")) },
  { id: "halloween", label: "Halloween", Comp: lazyTab(() => import("./halloween-posts")) },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ClientHub({ label, pattern }: { label: string; pattern: RegExp }) {
  const [tab, setTab] = useState("universal");
  const [ids, setIds] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/api/client-treatments`)
      .then((r) => r.json())
      .then((d: { clients?: { clientName: string; typedName: string; treatments: string[] }[] }) => {
        if (!live) return;
        const row = (d.clients ?? []).find((c) => pattern.test(c.clientName) || pattern.test(c.typedName));
        const known = new Set(U_TREATMENTS.map((x) => x.id));
        const mine = (row?.treatments ?? []).filter((t) => known.has(t));
        setIds(mine.length ? mine : undefined);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [pattern]);
  const forced: ForcedClient = { pattern, treatmentIds: ids };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 pt-2 text-xs text-white/50">{label}</div>
        <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${tab === t.id ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <ForcedClientContext.Provider value={forced}>
        <div className="[&_a[href='/hub']]:hidden">
          <Suspense fallback={<div className="p-10 text-center text-white/60">Loading...</div>}>
            <current.Comp key={`${current.id}-${ids?.join(",") ?? "all"}`} />
          </Suspense>
        </div>
      </ForcedClientContext.Provider>
    </div>
  );
}

export const DrVPage = () => <ClientHub label="Dr V, Fresher Faces" pattern={/dr\.?\s*v\b|fresher/i} />;
export const PuraPage = () => <ClientHub label="Pura Aesthetics" pattern={/pura/i} />;
export const AnnorlundaPage = () => <ClientHub label="Annorlunda" pattern={/annorlunda/i} />;
export const TeviotPage = () => <ClientHub label="Teviot" pattern={/teviot/i} />;
