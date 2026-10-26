import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL;
const SEASONAL_IDS = ["mx-09", "mx-10", "mx-11", "mx-12"];
const STYLES = [
  { value: "luxe", label: "Luxe" },
  { value: "everyday", label: "Everyday" },
  { value: "coffee shop", label: "Coffee shop" },
  { value: "desk typing", label: "Desk typing" },
  { value: "speaking to a patient", label: "Speaking to a patient" },
];

type Made = { key: string; url: string; on: boolean };
type Card = { status: string; outputImageUrl?: string };

const abs = (u: string) => (/^https?:/i.test(u) ? u : new URL(u, window.location.origin).href);

async function runSet(sourcePhotoId: number, clientName: string, month: string, mixStyle: string): Promise<string> {
  const r = await fetch(`${BASE}api/ai-portrait/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourcePhotoId, clientName,
      scenarios: SEASONAL_IDS.map((id) => ({ id, aspectRatio: "3:4", promptVars: { month, mixStyle } })),
    }),
  });
  const d = (await r.json()) as { jobId?: string; error?: string };
  if (!r.ok || !d.jobId) throw new Error(d.error || "Could not start the photos");
  return d.jobId;
}

async function waitFor(jobId: string, stop: () => boolean): Promise<Card[]> {
  for (let i = 0; i < 90; i++) {
    if (stop()) return [];
    await new Promise((res) => setTimeout(res, 4000));
    try {
      const r = await fetch(`${BASE}api/ai-portrait/jobs/${jobId}/status`);
      if (!r.ok) continue;
      const { cards } = (await r.json()) as { cards: Card[] };
      if (cards.length && cards.every((c) => c.status === "success" || c.status === "failed")) return cards;
    } catch { /* keep waiting */ }
  }
  return [];
}

// Makes 8 AI photos in the season's clothes and settings from one of the client's approved photos,
// then lets her tick the good ones and add them to the photos the month draws from.
export function MonthPhotoMaker({
  clientName, monthName, refs, disabled, onAdd,
}: {
  clientName: string;
  monthName: string;
  refs: { id: number | string; imageUrl: string }[];
  disabled: boolean;
  onAdd: (urls: string[]) => Promise<void>;
}) {
  const [refIdx, setRefIdx] = useState(0);
  const [styleA, setStyleA] = useState("luxe");
  const [styleB, setStyleB] = useState("everyday");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState<Made[]>([]);
  const cancel = useRef(false);

  const make = async () => {
    const ref = refs[refIdx];
    if (!ref) { toast.error("This client needs at least one approved photo to copy their face from."); return; }
    cancel.current = false;
    setBusy(true);
    setMade([]);
    const toastId = toast.loading("Making 8 photos. This takes a few minutes.");
    try {
      const sr = await fetch(`${BASE}api/ai-portrait/source-from-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: abs(ref.imageUrl), clientName }),
      });
      const src = (await sr.json()) as { id?: number; error?: string };
      if (!sr.ok || !src.id) throw new Error(src.error || "Could not read that reference photo");
      const [ja, jb] = await Promise.all([runSet(src.id, clientName, monthName, styleA), runSet(src.id, clientName, monthName, styleB)]);
      const [ca, cb] = await Promise.all([waitFor(ja, () => cancel.current), waitFor(jb, () => cancel.current)]);
      const good = [...ca, ...cb].filter((c) => c.status === "success" && c.outputImageUrl).map((c, i) => ({ key: `${i}-${c.outputImageUrl}`, url: c.outputImageUrl!, on: true }));
      setMade(good);
      if (good.length) toast.success(`${good.length} photos ready. Untick any you do not like, then add them.`, { id: toastId });
      else toast.error("No photos came back. Try again in a minute.", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const urls = made.filter((m) => m.on).map((m) => m.url);
    if (!urls.length) return;
    setAdding(true);
    try {
      await onAdd(urls);
      setMade([]);
      toast.success(`${urls.length} photos added. Press "Start this month again" to use them.`);
    } catch {
      toast.error("Could not add those photos");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Make 8 photos for {monthName}</h2>
        <span className="text-sm text-muted-foreground">AI photos in the clothes and settings that suit the season, copied from one of their approved photos.</span>
      </div>
      {refs.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Copy the face from</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {refs.slice(0, 16).map((r, i) => (
              <button key={String(r.id)} type="button" onClick={() => setRefIdx(i)} className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === refIdx ? "border-pink-500" : "border-transparent"}`}>
                <img src={r.imageUrl} alt="" className="h-20 w-16 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {[["First four", styleA, setStyleA], ["Second four", styleB, setStyleB]].map(([label, val, set]) => (
          <div key={label as string} className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label as string}</span>
            <Select value={val as string} onValueChange={set as (v: string) => void}>
              <SelectTrigger className="w-56 bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
        <Button onClick={make} disabled={disabled || busy || !refs.length}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Make 8 photos
        </Button>
        <span className="text-xs text-muted-foreground">Uses AI credits, so it only runs when you press it.</span>
      </div>
      {made.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {made.map((m) => (
              <label key={m.key} className="relative block cursor-pointer">
                <img src={m.url} alt="" className={`w-full aspect-[3/4] object-cover rounded-lg border ${m.on ? "border-pink-500" : "border-border/30 opacity-40"}`} />
                <input type="checkbox" className="absolute top-1.5 left-1.5" checked={m.on} onChange={(e) => setMade((l) => l.map((x) => (x.key === m.key ? { ...x, on: e.target.checked } : x)))} />
              </label>
            ))}
          </div>
          <Button onClick={add} disabled={adding || !made.some((m) => m.on)}>
            {adding && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Add {made.filter((m) => m.on).length} to this month's photos
          </Button>
        </div>
      )}
    </section>
  );
}
