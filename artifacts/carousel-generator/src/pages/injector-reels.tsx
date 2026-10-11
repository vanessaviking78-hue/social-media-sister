import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, Copy, Check } from "lucide-react";
import data from "@/data/injector-reels.json";

type Item = { n: number; hook: string; script: string; pillar: string; rep: string };
type Section = { id: string; title: string; description: string; items: Item[] };
type Status = "todo" | "filmed" | "posted";

const SECTIONS = data as Section[];
const STORAGE_KEY = "injector-reels-status-v1";
const STATUS_LABEL: Record<Status, string> = { todo: "To film", filmed: "Filmed", posted: "Posted" };

function loadState(): Record<string, Status> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function InjectorReels() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, Status>>({});

  useEffect(() => {
    setState(loadState());
  }, []);

  function setStatus(key: string, status: Status) {
    const next = { ...state, [key]: status };
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode, carry on */
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const section = SECTIONS[tab];
  const keyOf = (n: number) => `${section.id}:${n}`;
  const statusOf = (n: number): Status => state[keyOf(n)] || "todo";

  const counts = useMemo(() => {
    let filmed = 0;
    let posted = 0;
    let total = 0;
    for (const s of SECTIONS) {
      for (const it of s.items) {
        total++;
        const st = state[`${s.id}:${it.n}`];
        if (st === "filmed") filmed++;
        if (st === "posted") posted++;
      }
    }
    return { total, filmed, posted };
  }, [state]);

  const shown = section.items.filter((it) => filter === "all" || statusOf(it.n) === filter);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Injector Reel Tracker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.posted} posted, {counts.filmed} filmed, {counts.total} in total
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setTab(i);
                setFilter("all");
                setOpen(null);
              }}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                i === tab
                  ? "border-pink-500/60 bg-pink-500/10 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{section.description}</p>
        <p className="text-xs text-muted-foreground/80 rounded-lg border border-border/40 px-3 py-2">
          <b>How to read the tags:</b> Seen, Handy, Giggle and Glimpse are the four Social Media Sister pillars. S, K and M stand
          for Same (relatable), Know (expertise) and Me (personal), and every hook uses at least two. Each hook also passes the
          Sister Test: Simple, Specific, Shareable.
        </p>

        <div className="flex flex-wrap gap-2">
          {(["all", "todo", "filmed", "posted"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f
                  ? "border-pink-500/60 bg-pink-500/10 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? `All ${section.items.length}` : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Nothing in this filter yet.</p>
          )}
          {shown.map((it) => {
            const key = keyOf(it.n);
            const isOpen = open === key;
            const st = statusOf(it.n);
            return (
              <div key={key} className="rounded-xl border border-border/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-card/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-pink-400 font-mono">
                      {section.title} {it.n} · {it.pillar} · {it.rep}
                    </p>
                    <p className="font-semibold mt-1">{it.hook}</p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${
                      st === "posted"
                        ? "border-emerald-500/50 text-emerald-400"
                        : st === "filmed"
                          ? "border-amber-500/50 text-amber-400"
                          : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[st]}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/30 space-y-4">
                    <p className="text-[11px] uppercase tracking-wider text-pink-400 font-mono mt-4">Script</p>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line -mt-2">{it.script}</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(["todo", "filmed", "posted"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(key, s)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            st === s
                              ? "border-pink-500/60 bg-pink-500/10 text-foreground"
                              : "border-border/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => copy(key, `${it.hook}\n\n${it.script}`)}
                        className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground"
                      >
                        {copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === key ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Progress saves in this browser. Clearing site data resets it.
        </p>
      </div>
    </div>
  );
}
