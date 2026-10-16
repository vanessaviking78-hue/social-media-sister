import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarRange, Play, CheckCircle2, Loader2, PartyPopper, RefreshCcw } from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import { FONT_OPTIONS, loadGoogleFonts } from "@/lib/slide-utils";
import HookBankPicker from "@/components/hook-bank-picker";
import { packStarts, isoDate } from "@/lib/hook-bank";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Kind = "monday" | "wednesday" | "friday" | "sunday";
type KindState = { kind: Kind; scheduled: number; target: number; done: boolean; latest: string | null };
type Result = { presetId: number; kinds: KindState[]; allDone: boolean; completeUntil: string | null };

const CARDS: Record<Kind, { day: string; title: string; tool: string; href: string; hint: string }> = {
  monday: { day: "Monday", title: "Treatment carousels", tool: "Magazine Post", href: "/magazinepost", hint: "13 treatment posts, scheduled one per Monday" },
  wednesday: { day: "Wednesday", title: "Nostalgic and funny reels", tool: "Stylish then Magazine Flip", href: "/magazine", hint: "13 posts built in Stylish, posted as Magazine Flip reels" },
  friday: { day: "Friday", title: "Things that carousels", tool: "Stylish", href: "/stylish", hint: "13 'things that' carousels built in Stylish" },
  sunday: { day: "Sunday", title: "Shareable quotes", tool: "Tweet Maker", href: "/tweet-maker", hint: "13 quote posts from Tweet Maker" },
};

const ORDER: Kind[] = ["monday", "wednesday", "friday", "sunday"];

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
  });
}

function Battery({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${filled} of ${total} scheduled`}>
      <div className="flex gap-0.5 rounded-md border border-border/60 p-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-6 ${total > 8 ? "w-3.5 sm:w-4" : "w-8"} rounded-sm transition-all duration-700 ${i < filled ? "bg-emerald-500" : "bg-muted/40"}`}
          />
        ))}
      </div>
      <div className="h-3 w-1.5 rounded-r-sm bg-border/60" />
    </div>
  );
}

export default function NinetyDays() {
  const { presets, updatePresetCoverFonts } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [starting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hookLook, setHookLook] = useState<string[]>([]);
  const [hookStart, setHookStart] = useState(() => isoDate(packStarts()[0]));

  const [headFont, setHeadFont] = useState("");
  const [subFont, setSubFont] = useState("");
  const [savingFonts, setSavingFonts] = useState(false);
  const [fontsSaved, setFontsSaved] = useState(false);

  useEffect(() => { try { loadGoogleFonts(); } catch { /* fonts only affect the preview */ } }, []);

  useEffect(() => {
    const p = presets.find((x) => x.id === presetId) as (typeof presets[number] & { stylishCoverHeadlineFont?: string | null; stylishCoverSubtitleFont?: string | null }) | undefined;
    setHeadFont(p?.stylishCoverHeadlineFont || "");
    setSubFont(p?.stylishCoverSubtitleFont || "");
    setFontsSaved(false);
  }, [presetId, presets]);

  const saveFonts = async () => {
    if (presetId == null) return;
    setSavingFonts(true);
    setError("");
    try {
      await updatePresetCoverFonts(presetId, headFont || null, subFont || null);
      setFontsSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingFonts(false);
    }
  };

  const runSkill = async (name: string) => {
    setError("");
    const command = `/skill-90days ${name}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setStartedAt(Date.now());
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setError(`Could not copy. Type this into Claude: ${command}`);
    }
  };

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${BASE}/api/ninety-days?presetId=${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Something went wrong");
      setData(d);
      if (d.allDone) setShowDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (presetId == null) return;
    setShowDone(false);
    load(presetId);
    const t = setInterval(() => load(presetId), 20000);
    return () => clearInterval(t);
  }, [presetId, load]);

  const clientName = presets.find((p) => p.id === presetId)?.name ?? "";
  const doneCount = data ? data.kinds.filter((k) => k.done).length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border/30 px-6 py-4">
        <Link href="/hub">
          <button className="shrink-0 rounded-lg p-2 hover:bg-muted/50"><ArrowLeft className="h-4 w-4" /></button>
        </Link>
        <CalendarRange className="h-5 w-5 text-emerald-400" />
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-none">90 Days</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Thirteen weeks of content per kind, charged up as each post is scheduled</p>
        </div>
        {presetId != null && (
          <button onClick={() => load(presetId)} className="rounded-lg p-2 hover:bg-muted/50" title="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </button>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Client</label>
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={presetId ?? ""}
            onChange={(e) => { setData(null); setPresetId(e.target.value ? Number(e.target.value) : null); }}
          >
            <option value="">Choose a client</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {presetId != null && clientName && (
          <div className="flex items-center justify-between rounded-xl border border-pink-500/40 bg-pink-500/5 p-4">
            <p className="text-sm">
              {copied
                ? `Copied. Now paste it into Claude and press enter. The batteries fill as posts are scheduled.`
                : startedAt && !data?.allDone
                ? `Run started for ${clientName}. The batteries fill as posts are scheduled.`
                : `Start the 90 days run for ${clientName}`}
            </p>
            <button
              disabled={starting}
              onClick={() => runSkill(clientName)}
              className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-xs font-medium text-white hover:bg-pink-700 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Run 90 days"}
            </button>
          </div>
        )}

        {presetId != null && clientName && (
          <div className="space-y-3 rounded-xl border border-border/40 p-4">
            <div>
              <h2 className="text-sm font-semibold">Cover fonts</h2>
              <p className="text-xs text-muted-foreground">Saved to {clientName}, so Stylish covers use them every time.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Headline font</label>
                <select
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                  value={headFont}
                  onChange={(e) => { setHeadFont(e.target.value); setFontsSaved(false); }}
                >
                  <option value="">Stylish default</option>
                  {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                </select>
                <p className="mt-2 text-xl" style={{ fontFamily: headFont || undefined }}>Why you will love this</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Subtitle font</label>
                <select
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                  value={subFont}
                  onChange={(e) => { setSubFont(e.target.value); setFontsSaved(false); }}
                >
                  <option value="">Stylish default (Montserrat)</option>
                  {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                </select>
                <p className="mt-2 text-sm" style={{ fontFamily: subFont || undefined }}>A little line underneath it</p>
              </div>
            </div>
            <button
              onClick={saveFonts}
              disabled={savingFonts}
              className="rounded-lg border border-border/60 px-4 py-2 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              {savingFonts ? "Saving" : fontsSaved ? "Saved" : "Save fonts"}
            </button>
          </div>
        )}

        {presetId != null && data && (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
              <p className="text-sm">{doneCount} of 4 kinds fully scheduled for the next 90 days</p>
              <Battery filled={doneCount} total={4} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ORDER.map((k) => {
                const s = data.kinds.find((x) => x.kind === k)!;
                const c = CARDS[k];
                return (
                  <div key={k} className={`rounded-xl border p-4 ${s.done ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/40"}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">{c.day}</span>
                      {s.done && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    </div>
                    <h2 className="text-sm font-semibold">{c.title}</h2>
                    <p className="mb-3 mt-1 text-xs text-muted-foreground">{c.hint}</p>
                    <Battery filled={s.scheduled} total={s.target} />
                    <p className="mt-2 text-xs text-muted-foreground">{s.scheduled} of {s.target} scheduled</p>
                    <Link href={c.href}>
                      <button className="mt-3 w-full rounded-lg bg-pink-600 px-3 py-2 text-xs font-medium text-white hover:bg-pink-700">
                        {s.done ? `Open ${c.tool}` : `Go to ${c.tool}`}
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 rounded-xl border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">Hooks for {clientName}. Any with a line through it have already been used for them. Pick them in the tool you are writing in (Magazine Post, Stylish, Tweet Maker, Bulk Carousel), they are crossed off there once used.</p>
              <HookBankPicker client={clientName} picked={hookLook} onChange={setHookLook} startDate={hookStart} onStartDate={setHookStart} />
            </div>
          </>
        )}
      </main>

      {showDone && data?.allDone && data.completeUntil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/50 bg-background p-8 text-center">
            <PartyPopper className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
            <h2 className="text-xl font-semibold">Work complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">{clientName} is sorted until</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{longDate(data.completeUntil)}</p>
            <button onClick={() => setShowDone(false)} className="mt-6 rounded-lg bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-pink-700">
              Lovely
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
