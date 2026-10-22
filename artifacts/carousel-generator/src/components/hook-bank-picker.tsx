import { useEffect, useId, useMemo, useState } from "react";
import { getUsedHooks, clearUsedHooks } from "@/lib/hook-used";
import { ChevronDown } from "lucide-react";
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
  // Replaces the default "Hook bank" heading, for pages that show one picker per day.
  title?: string;
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

export default function HookBankPicker({ picked, onChange, startDate, onStartDate, single, days, client = "", title }: Props) {
  const uid = useId();
  const [used, setUsed] = useState<string[]>([]);
  const dayRows = days ? HOOK_DAYS.filter(d => days.includes(d.day)) : HOOK_DAYS;
  const [open, setOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("All");
  useEffect(() => { setUsed(getUsedHooks(client)); }, [client, picked]);
  const starts = useMemo(() => packStarts(), []);
  const start = parseIso(startDate) ?? starts[0];

  const toggle = (h: Hook) => {
    if (single) { onChange(picked.includes(h.code) ? [] : [h.code]); return; }
    onChange(picked.includes(h.code) ? picked.filter(c => c !== h.code) : [...picked, h.code]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {title ?? "Hook bank"} <span className="text-muted-foreground font-normal">({single ? "optional, pick one" : "optional, your own slide 1 hooks"})</span>
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

          <div className="flex flex-wrap gap-1.5">
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
            {client.trim() && used.length > 0 && (
              <button type="button" onClick={() => { clearUsedHooks(client); setUsed([]); }} className="rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground hover:border-border/70">
                Reset used for {client}
              </button>
            )}
            {picked.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground hover:border-border/70">
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-4">
            {dayRows.filter(d => dayFilter === "All" || dayFilter === d.day || dayRows.length === 1).map(d => {
              const items = HOOKS.filter(h => h.day === d.day);
              const pickedHere = picked.filter(c => items.some(h => h.code === c)).length;
              return (
                <div key={d.day} className="space-y-1.5">
                  <p className="text-xs font-semibold">
                    {d.label} {!single && <span className="font-normal text-muted-foreground">({pickedHere} of {d.max} picked)</span>}
                  </p>
                  {items.map(h => {
                    const on = picked.includes(h.code);
                    const t = hookTiming(h, start);
                    const full = !single && !on && pickedHere >= d.max;
                    const disabled = !on && (!t.ok || full);
                    return (
                      <label
                        key={h.code}
                        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${on ? "border-sky-500/60 bg-sky-500/10" : "border-border/40"} ${disabled ? "opacity-40" : "cursor-pointer hover:border-border/70"}`}
                      >
                        <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(h)} className="mt-1 accent-sky-500" />
                        <span className="min-w-0 space-y-0.5">
                          <span className={`block ${used.includes(h.code) ? "line-through decoration-2" : ""}`}><HookText text={h.text} /></span>
                          <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                            <span>{h.code}</span>
                            {used.includes(h.code) && <span className="font-medium text-amber-400">already used for {client}</span>}
                            {h.season && (
                              <span className={SEASON_STYLE[h.season]}>
                                {SEASON_WINDOWS[h.season].label}
                                {t.ok && t.from && t.to ? `, post between ${fmtDate(t.from)} and ${fmtDate(t.to)}` : `, out of season for these dates (${seasonRange(h.season)})`}
                              </span>
                            )}
                            {full && !t.ok ? null : full && <span>that kind of post is full</span>}
                          </span>
                        </span>
                      </label>
                    );
                  })}
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
