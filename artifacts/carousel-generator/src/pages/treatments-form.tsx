import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CLINIC_TREATMENT_GROUPS } from "@/lib/clinic-treatments";

const BASE = import.meta.env.BASE_URL;

// The one link every client gets. They type their business name (a trading name is fine, I link it afterwards) and tick what they offer.
export default function TreatmentsForm() {
  const [business, setBusiness] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (id: string) => setTicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ids: string[]) => setTicked((s) => {
    const n = new Set(s);
    const all = ids.every((i) => n.has(i));
    ids.forEach((i) => (all ? n.delete(i) : n.add(i)));
    return n;
  });
  const count = ticked.size;
  const ok = useMemo(() => business.trim().length >= 2 && count > 0, [business, count]);

  const send = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}api/treatments-form`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName: business, treatments: [...ticked], other }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "That did not save, try again");
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not save, try again");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#ff2d8a] text-white flex items-center justify-center"><Check className="w-7 h-7" /></div>
          <h1 className="text-2xl font-bold">Thank you</h1>
          <p className="text-black/70">I have everything I need. Your content will now be about the treatments you actually do. If you add a new one later, just open this link again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">What do you offer?</h1>
          <p className="text-black/70">Tick every treatment you offer, and nothing you do not. I use this to make content that is properly about what you do, so it takes two minutes and saves us both a lot of back and forth.</p>
        </div>

        <label className="block space-y-1">
          <span className="font-semibold">Your business name</span>
          <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="For example Fresher Faces" className="w-full rounded-lg border border-black/20 p-3 focus:outline-none focus:ring-2 focus:ring-[#ff2d8a]" />
          <span className="text-sm text-black/50">Use the name you trade under.</span>
        </label>

        {CLINIC_TREATMENT_GROUPS.map((g) => {
          const ids = g.items.map((i) => i.id);
          const n = ids.filter((i) => ticked.has(i)).length;
          return (
            <section key={g.id} className="rounded-xl border border-black/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-lg">{g.label}</h2>
                <button type="button" onClick={() => toggleGroup(ids)} className="text-sm text-[#ff2d8a] font-semibold">{n === ids.length ? "Clear all" : "Tick all"}</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {g.items.map((t) => {
                  const on = ticked.has(t.id);
                  return (
                    <label key={t.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${on ? "border-[#ff2d8a] bg-[#ff2d8a]/5" : "border-black/15"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(t.id)} className="w-5 h-5 accent-[#ff2d8a]" />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <label className="block space-y-1">
          <span className="font-semibold">Anything else you offer that is not on the list?</span>
          <textarea value={other} onChange={(e) => setOther(e.target.value)} rows={3} className="w-full rounded-lg border border-black/20 p-3 focus:outline-none focus:ring-2 focus:ring-[#ff2d8a]" />
        </label>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-black/10 -mx-4 px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-black/60">{count} ticked</span>
          <button type="button" disabled={!ok || saving} onClick={send} className="rounded-full bg-black text-white px-6 py-3 font-semibold disabled:opacity-40 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Send to Vanessa
          </button>
        </div>
      </div>
    </div>
  );
}
