import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, Loader2, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import { MENS_SETS } from "@/lib/mens-sets";
import { uploadPngs } from "@/lib/month-engine";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SETTINGS_KEY = "mens-client-v1";
const OTHER_KEYS = ["month-client-v1", "unique-posts-client-v1", "treatments-client-v1", "basic-posts-client-v1"];
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");
const slideUrl = (folder: string, n: number) => `${BASE}/mens/${folder}/slide-${n}.png`;

type Entry = { caption: string; hashtags: string[]; busy: boolean; selected: boolean };

// Men's posts go out about every 20 days. The first one lands on the next Saturday at the client's usual time.
function nextSaturday(hhmm: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const [hh, mm] = (hhmm || "10:00").split(":").map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(hh) ? hh : 10, Number.isFinite(mm) ? mm : 0, 0, 0);
  while (d.getDay() !== 6 || d.getTime() <= Date.now() + 5 * 60000) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const uploaded = new Map<string, string[]>();
async function hostedSlides(folder: string, count: number): Promise<string[]> {
  const got = uploaded.get(folder);
  if (got) return got;
  const dataUrls: string[] = [];
  for (let n = 1; n <= count; n++) {
    const res = await fetch(slideUrl(folder, n));
    const blob = await res.blob();
    if (!res.ok || !blob.type.startsWith("image/")) throw new Error("The men's slide images have not been added yet, so I can't schedule this one.");
    dataUrls.push(await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); }));
  }
  const urls = await uploadPngs(dataUrls, dataUrls.map((_, i) => `mens-${folder}-${i + 1}-${Date.now()}.png`));
  uploaded.set(folder, urls);
  return urls;
}

export default function Mens() {
  const { presets, loading } = usePresets();
  const [clientId, setClientId] = useState("");
  const preset = presets.find((p) => String(p.id) === clientId);
  const [owner, setOwner] = useState("");
  const [role, setRole] = useState("Owner");
  const [area, setArea] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<SchedulePostPayload[] | null>(null);
  const [start, setStart] = useState("");

  useEffect(() => {
    if (!preset) return;
    const grab = (k: string) => { try { return (JSON.parse(localStorage.getItem(k) || "{}") as Record<string, { owner?: string; role?: string; area?: string }>)[String(preset.id)]; } catch { return undefined; } };
    const saved = grab(SETTINGS_KEY) ?? OTHER_KEYS.map(grab).find((s) => s?.owner) ?? {};
    setOwner(saved.owner ?? "");
    setRole(saved.role ?? "Owner");
    setArea(saved.area || preset.seoArea || "");
    setEntries(Object.fromEntries(MENS_SETS.map((s) => [s.id, { caption: "", hashtags: [], busy: false, selected: true }])));
  }, [preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!preset) return;
    try {
      const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      all[String(preset.id)] = { owner, role, area };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }, [preset?.id, owner, role, area]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: string, c: Partial<Entry>) => setEntries((o) => ({ ...o, [id]: { ...o[id], ...c } }));

  const write = async (id: string) => {
    if (!preset) { toast.error("Choose a client first"); return; }
    const set = MENS_SETS.find((s) => s.id === id)!;
    patch(id, { busy: true });
    try {
      const r = await fetch(`${BASE}/api/mens/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: preset.name, ownerName: owner.trim(), role: role.trim(), area: area.trim(),
          audience: preset.targetAudience ?? "", brandNotes: preset.brandNotes ?? "", topic: set.topic, slides: set.summary,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The caption would not write, try again");
      const foot = preset.captionFootnote?.trim();
      let caption = noDashes(data.caption ?? "");
      if (foot && !caption.includes(foot)) caption += `\n\n${foot}`;
      patch(id, { busy: false, caption, hashtags: Array.isArray(data.hashtags) ? data.hashtags : [] });
    } catch (e) {
      patch(id, { busy: false });
      toast.error(e instanceof Error ? e.message : "The caption would not write, try again");
    }
  };

  const chosen = useMemo(() => MENS_SETS.filter((s) => entries[s.id]?.selected), [entries]);

  const schedule = async () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    if (!chosen.length) { toast.error("Tick at least one post first"); return; }
    const noWords = chosen.filter((s) => !entries[s.id]?.caption.trim());
    if (noWords.length) { toast.error("Press Write caption first."); return; }
    setBusy(true);
    const toastId = toast.loading("Getting the pictures ready");
    try {
      const out: SchedulePostPayload[] = [];
      for (const s of chosen) {
        const urls = await hostedSlides(s.folder, s.slides);
        const e = entries[s.id];
        out.push({ title: `${s.name} · ${preset.name}`, caption: `${e.caption.trim()}\n\n${e.hashtags.join(" ")}`.trim(), imageUrls: urls });
      }
      toast.dismiss(toastId);
      setItems(out);
      setStart(nextSaturday((preset as unknown as { defaultPostTime?: string }).defaultPostTime ?? "10:00"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get those ready", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <UserRound className="w-5 h-5 text-orange-400" />
        <h1 className="font-bold text-lg">Men</h1>
        <span className="text-sm text-muted-foreground">The men's carousels, one about every 20 days</span>
      </header>
      <main className="max-w-[1300px] mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border/30 p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Client</span>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue placeholder={loading ? "Loading…" : "Choose a client"} /></SelectTrigger>
              <SelectContent className="max-h-72">{presets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="space-y-1.5 block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Owner first name</span>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Their role</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </label>
          <label className="space-y-1.5 block lg:col-span-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Area (also used for the 5 hashtags)</span>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Town, City" />
          </label>
          <div className="flex items-end lg:col-span-2">
            <Button onClick={schedule} disabled={!preset || busy || !chosen.length}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />} Schedule ticked, every 20 days
            </Button>
          </div>
        </section>

        {!preset && <p className="text-sm text-muted-foreground">Choose a client. The slides are exactly as designed, photos of the man included. I write the caption in the clinic's voice, ending on a question, and the scheduler starts on the next Saturday with 20 days between posts. You can move any date or the gap when you schedule.</p>}

        {preset && MENS_SETS.map((s) => {
          const e = entries[s.id];
          if (!e) return null;
          return (
            <article key={s.id} className="rounded-2xl border border-border/30 p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="checkbox" checked={e.selected} onChange={(ev) => patch(s.id, { selected: ev.target.checked })} />
                <h2 className="font-semibold">{s.name}</h2>
                <span className="text-sm text-muted-foreground">{s.slides} slides</span>
                <Button size="sm" variant="outline" className="ml-auto" disabled={e.busy} onClick={() => write(s.id)}>
                  {e.busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />} {e.caption ? "Rewrite caption" : "Write caption"}
                </Button>
              </div>
              <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                {Array.from({ length: s.slides }, (_, i) => (
                  <img key={i} src={slideUrl(s.folder, i + 1)} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-border/30" style={{ aspectRatio: "4 / 5" }} />
                ))}
              </div>
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Caption</span>
                <Textarea rows={7} value={e.caption} onChange={(ev) => patch(s.id, { caption: ev.target.value })} placeholder="Press Write caption" />
                {e.hashtags.length > 0 && <p className="text-sm text-orange-300 break-words mt-1">{e.hashtags.join(" ")}</p>}
              </label>
            </article>
          );
        })}
      </main>

      {items && preset && (
        <ScheduleModal
          presetId={preset.id}
          presetName={preset.name}
          postType="carousel"
          posts={items}
          perPostCaptions
          initialScheduledAt={start}
          initialGapMinutes={20 * 1440}
          keepClockTime
          sourceTool="mens"
          presets={presets.map((x) => ({ id: x.id, name: x.name }))}
          onClose={() => setItems(null)}
          onSaved={() => { setItems(null); toast.success("Scheduled. Go and put the kettle on."); }}
        />
      )}
    </div>
  );
}
