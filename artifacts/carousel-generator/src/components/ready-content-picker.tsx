import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import data from "@/data/ready-made-content.json";

type Item = { id: string; hook: string; subtitle: string; text1: string; text2: string; cta: string; check: boolean; day: string };
const DAYS = ["All", "Wednesday", "Friday", "October"] as const;
const ITEMS = data.items as Item[];

type Props = {
  // Receives the ticked posts as rows of text: headline, subtitle, text, text, CTA.
  onAdd: (rows: string[][], replace: boolean) => void;
};

// A dropdown of ready written posts. Tick the ones you want and add them straight in as posts.
export default function ReadyContentPicker({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [day, setDay] = useState<(typeof DAYS)[number]>("All");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byDay = day === "All" ? ITEMS : ITEMS.filter(i => i.day === day);
    return s ? byDay.filter(i => `${i.hook} ${i.subtitle} ${i.text1} ${i.text2} ${i.cta}`.toLowerCase().includes(s)) : byDay;
  }, [q, day]);

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const rowsFor = () => picked
    .map(id => ITEMS.find(i => i.id === id))
    .filter((i): i is Item => !!i)
    .map(i => [i.hook, i.subtitle, i.text1, i.text2, i.cta]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Ready made content</Label>
      <p className="text-xs text-muted-foreground leading-snug">{day === "All" || day === "October" ? `${data.theme}. ` : ""}Tick the ones you want, then add them as posts.</p>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm"
      >
        <span>{picked.length ? `${picked.length} picked` : "Choose from the list"}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 rounded-md border border-border/40 p-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search the list"
            className="w-full h-8 rounded bg-muted/30 border border-border/40 px-2 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${day === d ? "border-sky-500 bg-sky-500/20 text-sky-300" : "border-border/40 text-muted-foreground"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-2 text-xs">
            <button type="button" className="underline" onClick={() => setPicked(Array.from(new Set([...picked, ...shown.map(i => i.id)])))}>Tick all shown</button>
            <button type="button" className="underline" onClick={() => setPicked([])}>Clear</button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {shown.map(i => (
              <label key={i.id} className="flex items-start gap-2 rounded p-1.5 text-sm leading-snug hover:bg-muted/30 cursor-pointer">
                <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggle(i.id)} className="mt-0.5" />
                <span>
                  {i.hook}
                  <span className="block text-xs text-muted-foreground">{i.subtitle}</span>
                  {i.check && <span className="block text-xs text-amber-400">Check wording: mentions treatment, consultations or the clinic</span>}
                </span>
              </label>
            ))}
            {!shown.length && <p className="text-xs text-muted-foreground p-2">Nothing matches that search.</p>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!picked.length} onClick={() => onAdd(rowsFor(), false)}>Add {picked.length || ""} to my posts</Button>
        <Button size="sm" variant="outline" disabled={!picked.length} onClick={() => onAdd(rowsFor(), true)}>Start fresh with these</Button>
      </div>
    </div>
  );
}
