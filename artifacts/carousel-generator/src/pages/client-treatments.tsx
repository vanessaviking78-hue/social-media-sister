import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { CLINIC_TREATMENT_BY_ID } from "@/lib/clinic-treatments";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
type Entry = { id: number; clientName: string; typedName: string; matched: boolean; treatments: string[]; other: string; updatedAt: string };

// What every client has told me they offer, from the one treatments link.
export default function ClientTreatments() {
  const { presets } = usePresets();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`${BASE}/api/client-treatments`);
    const d = await r.json().catch(() => ({}));
    setRows(d.clients ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const link = `${window.location.origin}${BASE}/treatments-form`;
  const linkTo = async (id: number, clientName: string) => {
    const r = await fetch(`${BASE}/api/client-treatments/${id}/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName }) });
    if (!r.ok) { toast.error("That did not link"); return; }
    toast.success("Linked");
    void load();
  };

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-xl font-semibold">Client treatments</h1>
        </div>
        <div className="rounded-xl border border-white/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm"><div className="text-white/60">The one link for every client</div><div className="break-all">{link}</div></div>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="w-4 h-4" /> Copy link</button>
        </div>
        {!rows ? <Loader2 className="w-5 h-5 animate-spin" /> : rows.length === 0 ? <p className="text-white/60">Nobody has filled it in yet.</p> : rows.map((x) => (
          <div key={x.id} className="rounded-xl border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold">{x.clientName}{x.matched && x.typedName !== x.clientName ? <span className="text-white/50 font-normal"> (typed {x.typedName})</span> : null}</div>
                <div className="text-xs text-white/50">{x.treatments.length} treatments, {new Date(x.updatedAt).toLocaleDateString("en-GB")}</div>
              </div>
              {!x.matched && (
                <select className="bg-white/10 rounded p-2 text-sm ring-1 ring-pink-500" defaultValue="" onChange={(e) => e.target.value && linkTo(x.id, e.target.value)}>
                  <option value="" className="text-black">Link to a client</option>
                  {[...presets].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.name} className="text-black">{p.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {x.treatments.map((t) => <span key={t} className="text-xs rounded-full bg-white/10 px-2 py-1">{CLINIC_TREATMENT_BY_ID.get(t)?.label ?? t}</span>)}
            </div>
            {x.other && <p className="text-sm text-white/70">Also: {x.other}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
