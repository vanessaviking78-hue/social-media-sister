import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HOOKS, fillArea, fillTreatment, type Hook } from "@/lib/hook-bank";
import { getUsedHooks, syncUsedHooks, markHooksUsed } from "@/lib/hook-used";

// The Month tool's whole hook bank for a single clinic page. She taps a section first (Nostalgia, Treatment and so on),
// then taps the hook she wants, and it drops into the front slide of that post.
const SECTION_ORDER = ["Treatment", "Emotional", "Personal", "Nostalgia", "Engagement", "Audience", "Patient", "Seasonal", "Original"];
const SECTION_LABEL: Record<string, string> = { Original: "My first hooks" };
const sectionOf = (h: Hook) => h.theme || "Original";

export default function ClinicHookPicker({ client, treatment, area, onPick }: { client: string; treatment: string; area: string; onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [used, setUsed] = useState<string[]>([]);

  const sections = useMemo(() => {
    const m = new Map<string, Hook[]>();
    for (const h of HOOKS) {
      const k = sectionOf(h);
      m.set(k, [...(m.get(k) ?? []), h]);
    }
    return SECTION_ORDER.filter((k) => m.has(k)).map((k) => ({ id: k, label: SECTION_LABEL[k] ?? k, hooks: m.get(k)! }));
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setUsed(getUsedHooks(client));
    void syncUsedHooks(client).then((l) => { if (live) setUsed(l); });
    return () => { live = false; };
  }, [open, client]);

  const current = sections.find((s) => s.id === section) ?? null;
  const groups = useMemo(() => {
    if (!current) return [];
    const m = new Map<string, Hook[]>();
    for (const h of current.hooks) {
      const g = h.group || current.label;
      m.set(g, [...(m.get(g) ?? []), h]);
    }
    return [...m.entries()];
  }, [current]);

  const choose = (h: Hook) => {
    onPick(fillArea(fillTreatment(h.text, treatment), area));
    markHooksUsed(client, [h.code]);
    setOpen(false);
    setSection(null);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10">
        <BookOpen className="w-3.5 h-3.5" /> Pick a hook
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSection(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{current ? current.label : "Pick a hook section"}</DialogTitle>
          </DialogHeader>
          {!current ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sections.map((s) => (
                <button key={s.id} type="button" onClick={() => setSection(s.id)} className="rounded-lg border border-border p-4 text-left hover:bg-accent">
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.hooks.length} hooks</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button type="button" onClick={() => setSection(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> All sections
              </button>
              {groups.map(([g, list]) => (
                <div key={g} className="space-y-1.5">
                  {groups.length > 1 && <div className="text-xs uppercase tracking-wide text-muted-foreground">{g}</div>}
                  {list.map((h) => {
                    const isUsed = used.includes(h.code);
                    return (
                      <button key={h.code} type="button" onClick={() => choose(h)} className={`w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:bg-accent ${isUsed ? "opacity-50 line-through" : ""}`}>
                        {fillArea(fillTreatment(h.text, treatment), area)}
                        {h.season && <span className="ml-2 text-xs text-muted-foreground no-underline">({h.season})</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
