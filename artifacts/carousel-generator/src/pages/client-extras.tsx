import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { HOOKS, fillArea, fillTreatment } from "@/lib/hook-bank";
import { getUsedHooks, syncUsedHooks, markHooksUsed } from "@/lib/hook-used";
import { U_TREATMENTS } from "@/lib/universal-treatments";
import { usePresets } from "@/lib/use-presets";
import { useForcedClient } from "@/lib/forced-client";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// EVERYTHING A CLIENT HAS FILLED IN, in one place at the top of their page: their preset details, their Getting to know you answers
// and the treatments they ticked on the treatments form.
export function ClientInfoPanel({ clientName, treatmentIds }: { clientName: string; treatmentIds?: string[] }) {
  const { presets } = usePresets();
  const preset = presets.find((p) => p.name === clientName) ?? null;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/api/client-profiles/${encodeURIComponent(clientName)}`).then((r) => r.json()).then((d: { profile?: { answers?: Record<string, string> } | null }) => { if (live) setAnswers(d.profile?.answers ?? {}); }).catch(() => undefined);
    import("./getting-to-know-you").then((m) => { if (live) setLabels(Object.fromEntries(m.QUESTIONS.map((q) => [q.id, q.label]))); }).catch(() => undefined);
    return () => { live = false; };
  }, [clientName]);
  const rows: [string, string][] = [];
  const add = (k: string, v?: string | null) => { if (v && String(v).trim()) rows.push([k, String(v).trim()]); };
  add("Area", preset?.seoArea);
  add("Website", preset?.websiteUrl);
  add("Booking link", preset?.bookingLink);
  add("Address", preset?.clinicAddress);
  add("Audience", preset?.targetAudience);
  add("Content pillars", preset?.contentPillars);
  add("Brand notes", preset?.brandNotes);
  for (const [k, v] of Object.entries(answers)) add(labels[k] ?? k, v);
  const names = (treatmentIds ?? []).map((id) => U_TREATMENTS.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  if (names.length) add("Treatments they offer", names.join(", "));
  return (
    <div className="max-w-6xl mx-auto px-4 pt-3">
      <button onClick={() => setOpen((o) => !o)} className="text-sm rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10">
        {open ? "Hide" : "Show"} everything {clientName} has filled in ({rows.length})
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {rows.length === 0 && <p className="text-white/60">Nothing filled in yet.</p>}
          {rows.map(([k, v]) => (
            <div key={k}><div className="text-white/50 text-xs">{k}</div><div className="whitespace-pre-wrap break-words">{v}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

// MY FIRST HOOKS as its own tab: the original hooks, filled in for this client's area and a treatment of their choice.
export function ClientFirstHooks() {
  const forced = useForcedClient();
  const { presets } = usePresets();
  const preset = useMemo(() => presets.find((p) => (forced?.pattern ?? /$^/).test(p.name)) ?? null, [presets, forced]);
  const client = preset?.name ?? "";
  const [area, setArea] = useState("");
  const [treatment, setTreatment] = useState("");
  const [used, setUsed] = useState<string[]>([]);
  useEffect(() => { if (preset?.seoArea) setArea((a) => a || preset.seoArea!); }, [preset?.id, preset?.seoArea]);
  const options = useMemo(() => (forced?.treatmentIds?.length ? U_TREATMENTS.filter((t) => forced.treatmentIds!.includes(t.id)) : U_TREATMENTS), [forced]);
  useEffect(() => { if (!treatment && options[0]) setTreatment(options[0].name); }, [options, treatment]);
  useEffect(() => {
    if (!client) return;
    setUsed(getUsedHooks(client));
    let live = true;
    void syncUsedHooks(client).then((l) => { if (live) setUsed(l); });
    return () => { live = false; };
  }, [client]);
  // every section of the hook bank: Treatment, Emotional, Personal, Nostalgia, Engagement, Audience, Seasonal and My first hooks
  const ORDER = ["Original", "Treatment", "Emotional", "Personal", "Nostalgia", "Engagement", "Audience", "Seasonal"];
  const LABEL: Record<string, string> = { Original: "My first hooks" };
  const [section, setSection] = useState("Original");
  const hooks = HOOKS.filter((h) => (h.theme || "Original") === section);
  const groups = useMemo(() => {
    const m = new Map<string, typeof hooks>();
    for (const h of hooks) m.set(h.group || LABEL[section] || section, [...(m.get(h.group || LABEL[section] || section) ?? []), h]);
    return [...m.entries()];
  }, [section]);
  const copy = async (code: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    markHooksUsed(client, [code]);
    setUsed(getUsedHooks(client));
    toast.success("Copied");
  };
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <h2 className="text-2xl font-semibold">Hooks</h2>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label className="space-y-1 block"><span className="text-white/60">Area</span><input className="w-full bg-white/5 rounded p-2" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Type the area" /></label>
        <label className="space-y-1 block"><span className="text-white/60">Treatment</span>
          <select className="w-full bg-white/5 rounded p-2" value={treatment} onChange={(e) => setTreatment(e.target.value)}>{options.map((t) => <option key={t.id} value={t.name} className="text-black">{t.name}</option>)}</select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((k) => (
          <button key={k} onClick={() => setSection(k)} className={`px-3 py-1.5 rounded-full text-sm border ${section === k ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{LABEL[k] ?? k} ({HOOKS.filter((h) => (h.theme || "Original") === k).length})</button>
        ))}
      </div>
      {groups.map(([g, list]) => (
        <section key={g} className="space-y-2">
          <h3 className="font-medium text-white/80">{g}</h3>
          {list.map((h) => {
            const text = fillArea(fillTreatment(h.text, treatment), area);
            const done = used.includes(h.code);
            return (
              <button key={h.code} onClick={() => void copy(h.code, text)} className={`w-full text-left rounded-lg border px-3 py-2 flex items-start gap-3 hover:bg-white/10 ${done ? "border-white/10 text-white/40" : "border-white/20"}`}>
                <span className="flex-1">{text}</span><Copy className="w-4 h-4 shrink-0 mt-1" />
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

// The same panel for pages that only know a name pattern (Ryder, Lisa, Clare, Castle, Kathryn, NO 1): finds the preset and their treatments itself.
export function ClientInfoByPattern({ pattern }: { pattern: RegExp }) {
  const { presets } = usePresets();
  const preset = presets.find((p) => pattern.test(p.name)) ?? null;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/api/client-treatments`).then((r) => r.json()).then((d: { clients?: { clientName: string; typedName: string; treatments: string[] }[] }) => {
      const row = (d.clients ?? []).find((c) => pattern.test(c.clientName) || pattern.test(c.typedName));
      const known = new Set(U_TREATMENTS.map((x) => x.id));
      if (live) setIds((row?.treatments ?? []).filter((t) => known.has(t)));
    }).catch(() => undefined);
    return () => { live = false; };
  }, [pattern]);
  if (!preset) return null;
  return <ClientInfoPanel clientName={preset.name} treatmentIds={ids} />;
}
