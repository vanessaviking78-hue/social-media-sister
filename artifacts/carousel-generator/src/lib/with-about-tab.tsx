import { lazy, Suspense, useState, type ComponentType } from "react";
import { TabBoundary } from "@/components/tab-boundary";
import { ForcedClientContext } from "@/lib/forced-client";

// Wraps a client's own page with a second tab, "About me", the two About me templates from the free tools opened on that client.
const About = lazy(() => import("@/pages/client-about"));
const Hooks = lazy(() => import("@/pages/hooks-tab"));
const Fillers = lazy(() => import("@/pages/client-extras").then((m) => ({ default: m.FillersTab })));
const Xmas = lazy(() => import("@/pages/xmas-tab"));
const NewXmas = lazy(() => import("@/pages/newxmas-tab"));
const XmasFeels = lazy(() => import("@/pages/xmasfeels-tab"));
const StaticQuotes = lazy(() => import("@/pages/staticq-tab"));
const NewCovers = lazy(() => import("@/pages/new-covers"));
const Info = lazy(() => import("@/pages/client-extras").then((m) => ({ default: m.ClientInfoByPattern })));

export function withAboutTab(Own: ComponentType, pattern: RegExp, ownLabel: string): ComponentType {
  return function PageWithAbout() {
    const [tab, setTab] = useState<"own" | "hooks" | "fillers" | "xmas" | "newxmas" | "xmasfeels" | "staticq" | "new" | "about">("new");
    return (
      <div className="min-h-screen bg-[#161616] text-white">
        <div className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            {([["new", "NEW"], ["own", ownLabel], ["hooks", "My first hooks"], ["fillers", "Fillers"], ["newxmas", "NEWXMAS"], ["xmasfeels", "XMAS FEELS"], ["staticq", "STATIC - quotes"], ["xmas", "Xmas"], ["about", "About me"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${tab === id ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{label}</button>
            ))}
          </div>
        </div>
        <Suspense fallback={null}><Info pattern={pattern} /></Suspense>
        {tab === "own" ? <Own /> : (
          <ForcedClientContext.Provider value={{ pattern }}>
            <Suspense fallback={<div className="p-10 text-center text-white/60">Loading...</div>}><TabBoundary key={tab}>{tab === "hooks" ? <Hooks /> : tab === "fillers" ? <Fillers /> : tab === "xmas" ? <Xmas /> : tab === "newxmas" ? <NewXmas /> : tab === "xmasfeels" ? <XmasFeels /> : tab === "staticq" ? <StaticQuotes /> : tab === "new" ? <NewCovers /> : <About />}</TabBoundary></Suspense>
          </ForcedClientContext.Provider>
        )}
      </div>
    );
  };
}
