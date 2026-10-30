import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// Content Day ticks live in the existing content-ticklist table. Keys look like "12:shot".
const STORE_ID = "dashboard";

const URGENT_DAYS = 7; // under a week of posts scheduled
const SOON_DAYS = 30; // under a month of posts scheduled

const STEPS = [
  { key: "booked", label: "Booked", full: "Content Day booked" },
  { key: "shot", label: "Shot", full: "Content Day shot" },
  { key: "edited", label: "Edited", full: "Content Day edited" },
  { key: "delivered", label: "Delivered", full: "Content Day delivered" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
type Level = "urgent" | "soon" | "ok";

type FocusClient = { presetId: number; clientName: string; daysCovered: number };
type FocusResponse = { monthlyClients?: FocusClient[] };

const LEVEL = {
  urgent: { label: "Do first", bar: "border-l-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/50", dot: "bg-red-500" },
  soon: { label: "Do soon", bar: "border-l-amber-500", chip: "bg-amber-500/15 text-amber-300 border-amber-500/50", dot: "bg-amber-500" },
  ok: { label: "On track", bar: "border-l-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/50", dot: "bg-emerald-500" },
} as const;

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
}

function daysUntilNewYear(now: Date): number {
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

function levelFor(days: number, toNewYear: number): Level {
  if (days >= toNewYear) return "ok";
  if (days < URGENT_DAYS) return "urgent";
  if (days < SOON_DAYS) return "soon";
  return "ok";
}

function coverText(days: number): string {
  if (days <= 0) return "Nothing scheduled";
  if (days === 1) return "1 day scheduled";
  return `${days} days scheduled`;
}

export function Dashboard() {
  const [clients, setClients] = useState<FocusClient[]>([]);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"all" | "urgent" | "soon" | "ok">("all");

  const toNewYear = useMemo(() => daysUntilNewYear(new Date()), []);

  const load = useCallback(async () => {
    try {
      const [focusRes, tickRes] = await Promise.all([
        fetch(`${BASE}/api/daily-focus`, { headers: authHeaders() }),
        fetch(`${BASE}/api/content-ticklist/${STORE_ID}`, { headers: authHeaders() }),
      ]);
      const focus: FocusResponse = focusRes.ok ? await focusRes.json() : {};
      const tickJson = tickRes.ok ? await tickRes.json() : { state: {} };
      setClients(Array.isArray(focus.monthlyClients) ? focus.monthlyClients : []);
      setTicks(tickJson.state && typeof tickJson.state === "object" ? tickJson.state : {});
      setError(focusRes.ok ? "" : "Could not load your clients.");
    } catch {
      setError("Could not load your clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 120000);
    return () => clearInterval(id);
  }, [load]);

  const toggle = async (presetId: number, step: StepKey) => {
    const key = `${presetId}:${step}`;
    const next = !ticks[key];
    setTicks((t) => {
      const copy = { ...t };
      if (next) copy[key] = true;
      else delete copy[key];
      return copy;
    });
    try {
      const res = await fetch(`${BASE}/api/content-ticklist/${STORE_ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ key, value: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setError("That tick did not save. Try again.");
      load();
    }
  };

  // Priority order: least scheduled first. Content Days in progress are shown on the client, not used to rank.
  const rows = useMemo(() => {
    return clients
      .map((c) => {
        const level = levelFor(c.daysCovered, toNewYear);
        const ticked = STEPS.filter((s) => ticks[`${c.presetId}:${s.key}`]);
        const inProgress = ticked.length > 0 && !ticks[`${c.presetId}:delivered`];
        const nextStep = STEPS.find((s) => !ticks[`${c.presetId}:${s.key}`]);
        return { ...c, level, inProgress, nextStep, gap: Math.max(0, toNewYear - c.daysCovered) };
      })
      .sort((a, b) => a.daysCovered - b.daysCovered || a.clientName.localeCompare(b.clientName));
  }, [clients, ticks, toNewYear]);

  const n = rows.length;
  const urgent = rows.filter((r) => r.level === "urgent");
  const soon = rows.filter((r) => r.level === "soon");
  const okRows = rows.filter((r) => r.level === "ok");
  const inProgress = rows.filter((r) => r.inProgress);
  const topPriority = [...urgent, ...soon].slice(0, 5);

  const shown = rows.filter((r) => view === "all" || r.level === view);
  const visible = expanded ? shown : shown.slice(0, 10);

  return (
    <section aria-label="Dashboard" className="mb-12">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {toNewYear} days until 1 Jan
          </p>
        </div>
        <Link href="/daily-focus" className="text-sm text-pink-400 hover:text-pink-300">
          Open Daily Focus
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your clients
        </div>
      ) : n === 0 ? (
        <p className="text-sm text-muted-foreground">No clients found yet. Add clients in Presets and they will show here.</p>
      ) : (
        <>
          {/* Traffic lights: the whole picture in four boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Light level="urgent" count={urgent.length} label={`under ${URGENT_DAYS} days of posts`} active={view === "urgent"} onClick={() => setView(view === "urgent" ? "all" : "urgent")} />
            <Light level="soon" count={soon.length} label={`under ${SOON_DAYS} days of posts`} active={view === "soon"} onClick={() => setView(view === "soon" ? "all" : "soon")} />
            <Light level="ok" count={okRows.length} label="on track" active={view === "ok"} onClick={() => setView(view === "ok" ? "all" : "ok")} />
            <div className="rounded-xl border border-border/30 bg-card/40 px-4 py-3 min-w-0">
              <div className="text-3xl font-bold text-foreground tabular-nums">{inProgress.length}</div>
              <div className="text-xs text-muted-foreground">Content Days in progress</div>
            </div>
          </div>

          {/* Priority list */}
          <h3 className="text-base font-semibold text-foreground mb-2">Do these first</h3>
          {topPriority.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 mb-6">
              Nobody is running low. Every client has at least {SOON_DAYS} days of posts scheduled.
            </div>
          ) : (
            <ol className="flex flex-col gap-2 mb-6">
              {topPriority.map((r, i) => (
                <li key={r.presetId} className={`rounded-xl border border-border/30 border-l-4 ${LEVEL[r.level].bar} bg-card/40 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1`}>
                  <span className="text-lg font-bold text-muted-foreground tabular-nums w-5">{i + 1}</span>
                  <div className="flex-1 min-w-[10rem]">
                    <div className="font-semibold text-foreground break-words">{r.clientName}</div>
                    <div className="text-sm text-muted-foreground">
                      {coverText(r.daysCovered)}. Needs {r.gap} more days to reach 1 Jan.
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${LEVEL[r.level].chip}`}>{LEVEL[r.level].label}</span>
                  <Link href="/four-weeks" className="text-sm font-medium text-pink-400 hover:text-pink-300">
                    Make posts
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {/* Content Days in progress */}
          {inProgress.length > 0 && (
            <>
              <h3 className="text-base font-semibold text-foreground mb-2">Content Days in progress</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
                {inProgress.map((r) => (
                  <div key={r.presetId} className="rounded-xl border border-border/30 bg-card/40 px-3 py-2.5 min-w-0">
                    <div className="font-medium text-sm text-foreground break-words">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground mb-2">Next: {r.nextStep ? r.nextStep.full : "all done"}</div>
                    {r.nextStep && (
                      <button type="button" onClick={() => toggle(r.presetId, r.nextStep!.key)} className="text-xs px-3 py-1 rounded-md bg-pink-500 text-white font-semibold hover:bg-pink-400">
                        Tick {r.nextStep.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Every client */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-base font-semibold text-foreground">
              All clients{view !== "all" ? `: ${LEVEL[view].label}` : ""} ({shown.length})
            </h3>
            {view !== "all" && (
              <button type="button" onClick={() => setView("all")} className="text-xs text-muted-foreground underline hover:text-foreground">
                Show everyone
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {visible.map((r) => (
              <div key={r.presetId} className={`rounded-xl border border-border/30 border-l-4 ${LEVEL[r.level].bar} bg-card/40 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2`}>
                <div className="min-w-[9rem] flex-1">
                  <div className="font-medium text-sm text-foreground break-words">{r.clientName}</div>
                  <div className="text-xs text-muted-foreground">{r.daysCovered >= toNewYear ? "Posts covered to 1 Jan" : coverText(r.daysCovered)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5" aria-label={`Content Day steps for ${r.clientName}`}>
                  <span className="text-xs text-muted-foreground mr-1">Content Day</span>
                  {STEPS.map((s) => {
                    const on = !!ticks[`${r.presetId}:${s.key}`];
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggle(r.presetId, s.key)}
                        aria-pressed={on}
                        title={s.full}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          on ? "bg-emerald-500 border-emerald-500 text-white font-semibold" : "border-border/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {on ? <Check className="w-3 h-3" /> : null}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="text-sm text-muted-foreground">Nobody in this group.</p>}
          </div>

          {shown.length > 10 && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? "Show fewer" : `Show all ${shown.length}`}
            </button>
          )}
          {error && (
            <p className="mt-3 text-sm text-pink-400" role="status">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Colours and the order come from the posts you have scheduled, so they update on their own. The Content Day ticks are yours to tick.
          </p>
        </>
      )}
    </section>
  );
}

function Light({ level, count, label, active, onClick }: { level: Level; count: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-4 py-3 text-left min-w-0 transition-colors ${LEVEL[level].chip} ${active ? "ring-2 ring-foreground/60" : "hover:brightness-125"}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${LEVEL[level].dot}`} aria-hidden="true" />
        <span className="text-xs font-semibold">{LEVEL[level].label}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums">{count}</div>
      <div className="text-xs opacity-80">{label}</div>
    </button>
  );
}

export default Dashboard;
