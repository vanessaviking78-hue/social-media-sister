import { lazy, Suspense, useState, type ComponentType } from "react";
import { ForcedClientContext } from "@/lib/forced-client";

// Wraps a client's own page with a second tab, "About me", the two About me templates from the free tools opened on that client.
const About = lazy(() => import("@/pages/client-about"));
const Hooks = lazy(() => import("@/pages/client-extras").then((m) => ({ default: m.ClientFirstHooks })));
const Info = lazy(() => import("@/pages/client-extras").then((m) => ({ default: m.ClientInfoByPattern })));

export function withAboutTab(Own: ComponentType, pattern: RegExp, ownLabel: string): ComponentType {
  return function PageWithAbout() {
    const [tab, setTab] = useState<"own" | "hooks" | "about">("own");
    return (
      <div className="min-h-screen bg-[#161616] text-white">
        <div className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            {([["own", ownLabel], ["hooks", "My first hooks"], ["about", "About me"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${tab === id ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{label}</button>
            ))}
          </div>
        </div>
        <Suspense fallback={null}><Info pattern={pattern} /></Suspense>
        {tab === "own" ? <Own /> : (
          <ForcedClientContext.Provider value={{ pattern }}>
            <Suspense fallback={<div className="p-10 text-center text-white/60">Loading...</div>}>{tab === "hooks" ? <Hooks /> : <About />}</Suspense>
          </ForcedClientContext.Provider>
        )}
      </div>
    );
  };
}
