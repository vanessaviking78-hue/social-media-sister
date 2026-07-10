import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, AlertTriangle, Inbox, Unplug, RotateCcw } from "lucide-react";

type Item = { name: string; note?: string };
type Section = { key: string; title: string; blurb: string; icon: "fire" | "inbox" | "unplug"; items: Item[] };

const SECTIONS: Section[] = [
  {
    key: "fires",
    title: "Put the fires out first",
    blurb: "Already had a rhythm going, now gone quiet. Most likely to notice and message you.",
    icon: "fire",
    items: [
      { name: "CT", note: "8 days since last Facebook post" },
      { name: "DR KATHRYN", note: "9 days since last Facebook and Instagram post" },
      { name: "DR V", note: "11 days since last Instagram post" },
    ],
  },
  {
    key: "never-posted",
    title: "Never had a single post go out",
    blurb: "All onboarded 24 June, connected to Meta, zero posts ever. One sitting, ten minutes each, clears the whole batch.",
    icon: "inbox",
    items: [
      { name: "Cantik Aesthetics" },
      { name: "Castle Clinic" },
      { name: "Craig Hobson Aesthetics" },
      { name: "Digital Dentists" },
      { name: "Equilibrium" },
      { name: "Eva Garcia Aesthetics" },
      { name: "Forever Young" },
      { name: "Kahlo Skin & Soul" },
      { name: "LOTUS ROOMS" },
      { name: "pip" },
      { name: "PJP Academy" },
      { name: "pura" },
      { name: "Rebecca Gledhill" },
      { name: "Samantha Grant Aesthetics" },
      { name: "The Ryder Clinic" },
    ],
  },
  {
    key: "not-connected",
    title: "Not connected to Meta at all",
    blurb: "Check each is still an active, paying client before spending time connecting or building content.",
    icon: "unplug",
    items: [
      { name: "A D Aesthetics Pharmacist Ltd" },
      { name: "CK" },
      { name: "EVA GARCIA ACADEMY" },
      { name: "Madame Wax" },
      { name: "Teviot" },
      { name: "The Compliance Clinic" },
      { name: "The Glow Getter" },
    ],
  },
];

const STORAGE_KEY = "catchUpPlan-v1";

function loadDone(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function CatchUpPlan() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDone(loadDone());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  }, [done]);

  const totalItems = useMemo(() => SECTIONS.reduce((n, s) => n + s.items.length, 0), []);
  const totalDone = useMemo(() => Object.values(done).filter(Boolean).length, [done]);

  function toggle(name: string) {
    setDone((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function resetPlan() {
    if (!window.confirm("Clear all ticks on this catch-up plan?")) return;
    setDone({});
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Catch-Up Plan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalDone}/{totalItems} sorted
          </p>
        </div>
        <button
          type="button"
          onClick={resetPlan}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {SECTIONS.map((section, sIdx) => {
          const sectionDone = section.items.filter((it) => done[it.name]).length;
          const Icon = section.icon === "fire" ? AlertTriangle : section.icon === "inbox" ? Inbox : Unplug;
          const accent =
            section.icon === "fire"
              ? "text-red-400 border-red-500/30"
              : section.icon === "inbox"
              ? "text-amber-400 border-amber-500/30"
              : "text-zinc-400 border-zinc-500/30";
          return (
            <section key={section.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full border ${accent} text-xs font-semibold shrink-0`}>
                  {sIdx + 1}
                </span>
                <Icon className={`w-4 h-4 ${accent.split(" ")[0]} shrink-0`} />
                <h2 className="font-semibold text-base">{section.title}</h2>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {sectionDone}/{section.items.length}
                </span>
              </div>
              <p className="text-sm text-muted-foreground -mt-1">{section.blurb}</p>
              <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                {section.items.map((item) => (
                  <label
                    key={item.name}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-card/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!done[item.name]}
                      onChange={() => toggle(item.name)}
                      className="w-4 h-4 accent-pink-500 shrink-0"
                    />
                    <span className={`text-sm font-medium ${done[item.name] ? "line-through text-muted-foreground" : ""}`}>
                      {item.name}
                    </span>
                    {item.note && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.note}</span>
                    )}
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
