import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, CalendarRange, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePresets } from "@/lib/use-presets";

const KEY = "month-planner-v1";

type Kind = "seasonal" | "unique" | "educational" | "basic" | "treatment";

const KIND: Record<Kind, { label: string; colour: string }> = {
  seasonal: { label: "Seasonal", colour: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  unique: { label: "Unique", colour: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  educational: { label: "Friday educational", colour: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  basic: { label: "BASIC", colour: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  treatment: { label: "Treatment", colour: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

// The seasonal tool that fits each month. Months with nothing seasonal ready fall back to Unique.
const SEASONAL: Record<number, { href: string; name: string; theme: string } | undefined> = {
  9: { href: "/halloween-posts", name: "Halloween Posts", theme: "Halloween" },
  10: { href: "/november-posts", name: "November Posts", theme: "November, bonfire night and the dark evenings" },
  11: { href: "/xmas-posts", name: "Xmas Posts", theme: "Christmas" },
  0: { href: "/xmas-posts", name: "Xmas Posts (New Year)", theme: "New Year and fresh starts" },
};

const PROMPTS: Record<Kind, string[]> = {
  seasonal: [
    "A funny, true moment from the consultation room that fits {theme}. Tell it as a tiny story and end on a question she can answer in a few words.",
    "What {theme} does to our faces, skin and confidence, said with a wink. One honest line a woman over 35 will screenshot, then a question.",
    "The thing every client says to me at this time of year about {theme}. Make her laugh first, then make her feel understood.",
    "A gentle, no pressure {theme} post that shows I am a real person. A small story from my week, then a question about hers.",
  ],
  unique: [
    "Pick the cover that makes you laugh hardest this week. The story: what I wish every woman knew before she walks into any clinic.",
    "Choose a notice, recall or wanted poster cover and tell the myth behind it in my own voice. Finish with a question that gets people arguing kindly.",
    "A cover nobody else in {area} has. Tell the true story behind the joke and end on a question.",
    "Pick a red flags or penalty notice cover. The story: something I have seen that made me stand up for a client.",
  ],
  educational: [
    "Friday educational: a ready made safety or aftercare post from the content list, in my voice, with a question at the end.",
    "Friday educational: a myth a client believed until she came in, from the content list. Keep it fun and end on a question.",
    "Friday educational: what to ask any practitioner before booking, from the content list. Warm, honest and a question to finish.",
    "Friday educational: an aftercare or skin facts post from the content list, made funny and shareable, ending on a question.",
  ],
  basic: [
    "The trust carousel: a cover from BASIC, then two photo slides that carry on. The story: why I do things the slow, honest way.",
    "The trust carousel: a cover from BASIC. The story: what a consultation with me is actually like.",
  ],
  treatment: [
    "A Possible Side Effects May Include treatment carousel. Pick the treatment this clinic most wants more enquiries for. End with the DM line.",
    "A treatment carousel for the area of the face clients ask about most. Honest, funny, consultation first. End with the DM line.",
  ],
};

type Slot = { n: number; date: Date; kind: Kind; tool: string; href: string; prompt: string };

function weekdays(year: number, month: number): Date[] {
  const out: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() >= 1 && d.getDay() <= 5) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function planMonth(year: number, month: number, seed: number, area: string): Slot[] {
  const days = weekdays(year, month).slice(0, 20);
  const season = SEASONAL[month];
  const fillPrompt = (t: string, theme: string) => t.replace(/\{theme\}/g, theme).replace(/\{area\}/g, area || "your area");
  return days.map((date, i) => {
    const week = Math.floor(i / 5);
    const dow = i % 5; // 0 Mon to 4 Fri
    let kind: Kind;
    if (dow === 0 || dow === 1) kind = "seasonal";
    else if (dow === 2) kind = week % 2 === 0 ? "basic" : "treatment";
    else if (dow === 3) kind = "unique";
    else kind = "educational";
    const pick = (list: string[]) => list[(seed + week + dow) % list.length];
    let tool = "", href = "";
    let useKind = kind;
    if (kind === "seasonal") {
      if (season) { tool = season.name; href = season.href; }
      else { useKind = "unique"; }
    }
    if (useKind === "unique") { tool = "Unique"; href = "/unique"; }
    if (useKind === "educational") { tool = "Stylish ready made content"; href = "/stylish"; }
    if (useKind === "basic") { tool = "BASIC posts"; href = "/basic-posts"; }
    if (useKind === "treatment") { tool = "Treatments"; href = "/treatments"; }
    const theme = season?.theme ?? "this month";
    return { n: i + 1, date, kind: useKind, tool, href, prompt: fillPrompt(pick(PROMPTS[kind === "seasonal" && !season ? "unique" : kind]), theme) };
  });
}

type Saved = Record<string, { done: boolean; note: string }>;
const load = (): Record<string, Saved> => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function MonthPlanner() {
  const { presets, loading } = usePresets();
  const now = new Date();
  const [clientId, setClientId] = useState<string>("");
  const [ym, setYm] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [saved, setSaved] = useState<Record<string, Saved>>(load);

  const [year, month] = ym.split("-").map(Number);
  const preset = presets.find((p) => String(p.id) === clientId);
  const slots = useMemo(() => planMonth(year, month, preset?.id ?? 0, preset?.seoArea ?? ""), [year, month, preset?.id, preset?.seoArea]);
  const bucket = `${clientId}:${year}-${month}`;
  const mine = saved[bucket] ?? {};

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ } }, [saved]);
  const patch = (n: number, c: Partial<{ done: boolean; note: string }>) =>
    setSaved((o) => ({ ...o, [bucket]: { ...(o[bucket] ?? {}), [n]: { ...((o[bucket] ?? {})[n] ?? { done: false, note: "" }), ...c } } }));

  const doneCount = slots.filter((s) => mine[s.n]?.done).length;
  const options = Array.from({ length: 14 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return { v: `${d.getFullYear()}-${d.getMonth()}`, l: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }; });
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <CalendarRange className="w-5 h-5 text-violet-400" />
        <h1 className="font-bold text-lg">Month</h1>
        <span className="text-sm text-muted-foreground">20 posts for one client, one calendar month</span>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border/30 p-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Client</span>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue placeholder={loading ? "Loading…" : "Choose a client"} /></SelectTrigger>
              <SelectContent className="max-h-72">{presets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Month</span>
            <Select value={ym} onValueChange={setYm}>
              <SelectTrigger className="bg-muted/30 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>

        {!preset ? (
          <p className="text-sm text-muted-foreground">Choose a client and a month and I will lay out the 20 posts, each with a prompt to get you started. Each client starts at a different point in the rotation so no two clinics get the same month.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold">{preset.name}, {MONTHS[month]} {year}</span>
              <span className="text-muted-foreground">{doneCount} of {slots.length} scheduled</span>
              {!SEASONAL[month] && <span className="text-muted-foreground">No seasonal pack for this month yet, so those slots use Unique.</span>}
            </div>
            <div className="space-y-3">
              {slots.map((s) => {
                const st = mine[s.n] ?? { done: false, note: "" };
                return (
                  <article key={s.n} className={`rounded-2xl border p-4 space-y-3 ${st.done ? "border-emerald-500/40 opacity-70" : "border-border/30"}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => patch(s.n, { done: !st.done })} className={`h-6 w-6 rounded-md border flex items-center justify-center ${st.done ? "bg-emerald-500/30 border-emerald-500" : "border-border/50"}`} aria-label="Mark scheduled">
                        {st.done && <Check className="w-4 h-4" />}
                      </button>
                      <span className="font-semibold">{s.n}. {fmt(s.date)}</span>
                      <span className={`text-xs rounded-full border px-2.5 py-0.5 ${KIND[s.kind].colour}`}>{KIND[s.kind].label}</span>
                      <span className="text-sm text-muted-foreground">{s.tool}</span>
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(s.prompt); toast.success("Prompt copied"); }}><Copy className="w-4 h-4 mr-1.5" /> Copy prompt</Button>
                        <Link href={s.href}><Button size="sm"><ExternalLink className="w-4 h-4 mr-1.5" /> Open {s.tool}</Button></Link>
                      </div>
                    </div>
                    <p className="text-sm">{s.prompt}</p>
                    <Input value={st.note} onChange={(e) => patch(s.n, { note: e.target.value })} placeholder="Your notes for this post" />
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
