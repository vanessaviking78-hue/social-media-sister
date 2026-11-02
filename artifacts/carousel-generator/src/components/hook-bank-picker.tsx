import { useEffect, useId, useMemo, useState } from "react";
import { getUsedHooks, syncUsedHooks, setHookUsed, clearUsedHooks } from "@/lib/hook-used";
import { ChevronDown, Undo2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  HOOKS, HOOK_DAYS, SEASON_WINDOWS, PACK_DAYS, packStarts, addDays, fmtDate, isoDate, parseIso, hookTiming, seasonRange,
  type Hook,
} from "@/lib/hook-bank";

type Props = {
  picked: string[];
  onChange: (codes: string[]) => void;
  startDate: string;
  onStartDate: (iso: string) => void;
  // For tools that write one post at a time: only one hook can be picked, and only the listed days are shown.
  single?: boolean;
  days?: string[];
  // The client these hooks are for. Hooks already used for them are crossed out so nothing is posted twice.
  client?: string;
  // Raise the number of hooks that can be picked for each day (Month needs enough for every ticked day).
  maxPer?: number;
};

const SEASON_STYLE: Record<string, string> = {
  Halloween: "text-orange-400",
  Bonfire: "text-red-400",
  Christmas: "text-emerald-400",
};

// The slot in a hook, [treatment], is shown highlighted so it is clear it fills in per clinic.
function HookText({ text }: { text: string }) {
  const parts = text.split(/(\[[Tt]reatment\])/g);
  return (
    <>
      {parts.map((p, i) => (/^\[[Tt]reatment\]$/.test(p)
        ? <span key={i} className="rounded bg-yellow-500/20 px-1 text-yellow-200">{p}</span>
        : <span key={i}>{p}</span>))}
    </>
  );
}

// Every hook is a box in one big grid. Boxes already used for this client are removed from the list, and
// can be shown again (crossed out) with the Show used switch, or put back with the arrow.
export default function HookBankPicker({ picked, onChange, startDate, onStartDate, single, days, client = "", maxPer }: Props) {
  const uid = useId();
  const [used, setUsed] = useState<string[]>([]);
  const dayRows = days ? HOOK_DAYS.filter(d => days.includes(d.day)) : HOOK_DAYS;
  const [open, setOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("All");
  const [showUsed, setShowUsed] = useState(false);
  const [search, setSearch] = useState("");

  // Show what this browser knows straight away, then bring in the list from the database.
  useEffect(() => {
    setUsed(getUsedHooks(client));
    let live = true;
    void syncUsedHooks(client).then(list => { if (live) setUsed(list); });
    return () => { live = false; };
  }, [client, picked]);

  const starts = useMemo(() => packStarts(), []);
  const start = parseIso(startDate) ?? starts[0];

  const toggle = (h: Hook) => {
    if (single) { onChange(picked.includes(h.code) ? [] : [h.code]); return; }
    onChange(picked.includes(h.code) ? picked.filter(c => c !== h.code) : [...picked, h.code]);
  };
  const flipUsed = (h: Hook, nowUsed: boolean) => {
    if (!client.trim()) return;
    setUsed(setHookUsed(client, h.code, nowUsed));
    if (nowUsed && picked.includes(h.code)) onChange(picked.filter(c => c !== h.code));
  };

  const q = search.trim().toLowerCase();
  const visibleDays = dayRows.filter(d => dayFilter === "All" || dayFilter === d.day || dayRows.length === 1);
  const usedInView = visibleDays.reduce((n, d) => n + HOOKS.filter(h => h.day === d.day && used.includes(h.code)).length, 0);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Hook bank <span className="text-muted-foreground font-normal">({single ? "optional, pick one" : "optional, your own slide 1 hooks"})</span>
      </Label>
      <button
        type="button"
        onClick={() => { setUsed(getUsedHooks(client)); setOpen(o => !o); }}
        className="flex w-full items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm hover:border-border/70"
        aria-expanded={open}
      >
        <span>{picked.length ? `${picked.length} hook${picked.length === 1 ? "" : "s"} picked` : single ? "Choose a hook from the bank" : "Choose hooks from the bank"}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 rounded-md border border-border/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`hook-start-${uid}`} className="text-xs font-medium">When will this pack be posted?</Label>
            <select
              id={`hook-start-${uid}`}
              value={isoDate(start)}
              onChange={e => onStartDate(e.target.value)}
              className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm"
            >
              {starts.map(s => (
                <option key={isoDate(s)} value={isoDate(s)}>
                  {fmtDate(s)} to {fmtDate(addDays(s, PACK_DAYS - 1))}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Four weeks from that Monday. Seasonal hooks that do not fit these dates are greyed out so they cannot end up in the wrong month.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[...(dayRows.length > 1 ? ["All"] : []), ...dayRows.map(d => d.day)].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDayFilter(d)}
                className={`rounded-full border px-3 py-1 text-xs ${dayFilter === d ? "border-sky-500/60 bg-sky-500/10" : "border-border/40 hover:border-border/70"}`}
              >
                {d}
              </button>
            ))}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search hooks"
              className="ml-auto w-40 rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
              aria-label="Search hooks"
            />
          </div>

          {client.trim() ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setShowUsed(s => !s)}
                className={`rounded-full border px-3 py-1 ${showUsed ? "border-amber-500/60 bg-amber-500/10" : "border-border/40 hover:border-border/70"}`}
              >
                {showUsed ? "Hide used" : `Show used (${usedInView})`}
              </button>
              {used.length > 0 && (
                <button type="button" onClick={() => { void clearUsedHooks(client); setUsed([]); }} className="rounded-full border border-border/40 px-3 py-1 text-muted-foreground hover:border-border/70">
                  Put them all back for {client}
                </button>
              )}
              {picked.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="rounded-full border border-border/40 px-3 py-1 text-muted-foreground hover:border-border/70">
                  Clear picks
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Choose a client first and the hooks they have already had will drop out of this list.</p>
          )}

          <div className="space-y-5">
            {visibleDays.map(d => {
              const items = HOOKS
                .filter(h => h.day === d.day)
                .filter(h => !q || h.text.toLowerCase().includes(q))
                .filter(h => showUsed || !used.includes(h.code) || picked.includes(h.code));
              const pickedHere = picked.filter(c => HOOKS.some(h => h.code === c && h.day === d.day)).length;
              return (
                <div key={d.day} className="space-y-2">
                  <p className="text-xs font-semibold">
                    {d.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({items.length} to choose from{!single ? `, ${pickedHere} of ${maxPer ?? d.max} picked` : ""})
                    </span>
                  </p>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing left here for this client. Press Show used to see what they have had.</p>
                  ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                      {items.map(h => {
                        const on = picked.includes(h.code);
                        const isUsed = used.includes(h.code);
                        const t = hookTiming(h, start);
                        const full = !single && !on && pickedHere >= (maxPer ?? d.max);
                        const disabled = !on && (!t.ok || full);
                        return (
                          <label
                            key={h.code}
                            className={`relative flex h-full items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${on ? "border-sky-500/60 bg-sky-500/10" : "border-border/40"} ${isUsed ? "bg-amber-500/5" : ""} ${disabled ? "opacity-40" : "cursor-pointer hover:border-border/70"}`}
                          >
                            <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(h)} className="mt-1 shrink-0 accent-sky-500" />
                            <span className="min-w-0 flex-1 space-y-1 pr-5">
                              <span className={`block ${isUsed ? "line-through decoration-2 opacity-60" : ""}`}><HookText text={h.text} /></span>
                              <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                <span>{h.code}</span>
                                {isUsed && <span className="font-medium text-amber-400">already used</span>}
                                {h.season && (
                                  <span className={SEASON_STYLE[h.season]}>
                                    {SEASON_WINDOWS[h.season].label}
                                    {t.ok && t.from && t.to ? `, post between ${fmtDate(t.from)} and ${fmtDate(t.to)}` : `, out of season for these dates (${seasonRange(h.season)})`}
                                  </span>
                                )}
                                {full && t.ok && <span>that kind of post is full</span>}
                              </span>
                            </span>
                            {client.trim() && (
                              <button
                                type="button"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); flipUsed(h, !isUsed); }}
                                title={isUsed ? "Put this hook back in the list" : "Cross this hook out for this client"}
                                aria-label={isUsed ? "Put this hook back" : "Cross this hook out"}
                                className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-border/40 hover:text-foreground"
                              >
                                {isUsed ? <Undo2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {single
              ? "Your hook becomes the opening of the post, word for word, and the rest is written to follow on in a chatty, friendly voice."
              : "Each hook becomes slide 1 of the matching post, in the order you pick them, and the slides after it are written to follow on in a chatty, friendly voice. Posts without a hook are written as usual."}
          </p>
        </div>
      )}
    </div>
  );
}
