import { useEffect, useRef, useState } from "react";
import { Archive, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Loader2, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildAssets, renderUniversalPost } from "@/lib/tenfree-engine";
import { uploadPngs } from "@/lib/month-engine";
import { U_TREATMENTS, postTypesFor } from "@/lib/universal-treatments";
import type { ClientPreset } from "@/lib/use-presets";

// NEW month builder: she ticks the covers, presses Create, every post is built with all its slides and caption,
// then they come up one at a time to vet. Each one goes to the Client Bank or is scheduled, or "Schedule all" fills her chosen days.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type MonthLayout = { id: string; n: number; label: string; statik?: boolean };
type Status = "waiting" | "banked" | "scheduled" | "skipped" | "failed";
type MPost = { id: string; label: string; treatment: string; headline: string; slides: string[]; caption: string; status: Status; when?: string; error?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (iso?: string) => { try { return new Date(iso || "").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };

export function NewMonth(props: {
  preset: ClientPreset;
  area: string;
  layouts: MonthLayout[];
  treatments: string[];
  photos: ImageBitmap[];
  brand: [string, string];
  makeCover: (layout: string, treatment: string, headline: string) => Promise<HTMLCanvasElement>;
  onClose: () => void;
}) {
  const { preset, area, layouts, treatments, photos, brand, makeCover, onClose } = props;
  const [posts, setPosts] = useState<MPost[]>([]);
  const [making, setMaking] = useState("Getting the fonts and logo ready...");
  const [made, setMade] = useState(0);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState(preset.defaultPostTime || "18:00");
  const started = useRef(false);
  const foot = (preset.captionFootnote || "").trim();

  const patch = (id: string, c: Partial<MPost>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...c } : p)));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const logoBlob = preset.logoUrl ? await fetch(preset.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
        const assets = await buildAssets({ main: brand[0], accent: brand[1], clinicName: preset.name, handle: "", whatsapp: "", logoBlob, photoBlob: null });
        const used: Record<string, number> = {};
        for (let k = 0; k < layouts.length; k++) {
          const l = layouts[k];
          const x = U_TREATMENTS.find((t) => t.name === treatments[k % treatments.length]) ?? U_TREATMENTS[0];
          const angle = (used[x.id] = (used[x.id] ?? -1) + 1) % 6;
          const type = postTypesFor(x)[angle];
          setMaking(`Writing and drawing post ${k + 1} of ${layouts.length}...`);
          const id = `${l.id}-${k}-${Date.now()}`;
          try {
            const r = await fetch(`${BASE}/api/universal/copy`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client: preset.name, area, treatment: x.name, headline: type.headline, brief: type.brief, intro: angle === 0, note: "" }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d?.error || "The words would not write");
            const cover = await makeCover(l.id, x.name, type.headline);
            const rest = l.statik ? [] : renderUniversalPost({ treatmentId: x.id, headline: type.headline, copy: { subtitle: d.subtitle, slides: d.slides, cta: d.cta }, photos, offset: k, angle }, assets).slice(1);
            const slides = [cover, ...rest].map((c) => c.toDataURL("image/jpeg", 0.93));
            const caption = [String(d.caption || "").replace(foot, "").trim(), (d.hashtags || []).join(" "), foot].filter(Boolean).join("\n\n");
            setPosts((cur) => [...cur, { id, label: `${l.n}. ${l.label}`, treatment: x.name, headline: type.headline, slides, caption, status: "waiting" }]);
          } catch (e) {
            setPosts((cur) => [...cur, { id, label: `${l.n}. ${l.label}`, treatment: x.name, headline: type.headline, slides: [], caption: "", status: "failed", error: e instanceof Error ? e.message : "Failed" }]);
          }
          setMade(k + 1);
        }
        setMaking("");
      } catch (e) {
        setMaking("");
        toast.error(e instanceof Error ? e.message : "I could not start the month");
      }
    })();
  }, []);

  const cur = posts[i];
  useEffect(() => { if (cur) setWhen(cur.when || ""); }, [cur?.id]);

  const send = async (p: MPost, mode: "bank" | "schedule", whenIso?: string) => {
    const urls = await uploadPngs(p.slides, p.slides.map((_, n) => `new-${p.id}-${n + 1}.jpg`));
    const content = { caption: p.caption, title: `${p.treatment} · ${preset.name}`, platforms: ["instagram"], imageUrls: urls, sourceTool: "new-covers" };
    const body = mode === "bank"
      ? { postType: p.slides.length > 1 ? "carousel" : "single", content, status: "draft", presetId: preset.id }
      : { postType: p.slides.length > 1 ? "carousel" : "single", content, scheduledAt: new Date(whenIso!).toISOString(), isTrial: false, notes: "", presetId: preset.id };
    const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(err.error || "Could not send it"); }
  };
  const nextOpen = (from: number) => { const idx = posts.findIndex((p, n) => n > from && p.status === "waiting"); return idx >= 0 ? idx : from; };

  const doOne = async (mode: "bank" | "schedule") => {
    if (!cur) return;
    if (mode === "schedule" && !when) { toast.error("Pick a date and time first"); return; }
    setBusy(true);
    try {
      const iso = when ? new Date(when).toISOString() : undefined;
      await send(cur, mode, iso);
      patch(cur.id, { status: mode === "bank" ? "banked" : "scheduled", when: iso });
      toast.success(mode === "bank" ? "In the Client Bank" : "Scheduled");
      setI(nextOpen(i));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send it"); }
    setBusy(false);
  };

  const scheduleAll = async () => {
    const sorted = [...days].sort();
    const list = posts.filter((p) => p.status === "waiting" && p.slides.length);
    if (!sorted.length || !list.length) { toast.error("Tick some days and keep some posts waiting first"); return; }
    setBusy(true);
    let done = 0;
    for (const [n, p] of list.slice(0, sorted.length).entries()) {
      const [y, m, d] = sorted[n].split("-").map(Number);
      const [hh, mm] = time.split(":").map(Number);
      const iso = new Date(y, m - 1, d, hh || 18, mm || 0).toISOString();
      try { await send(p, "schedule", iso); patch(p.id, { status: "scheduled", when: iso }); done++; }
      catch (e) { toast.error(`Stopped after ${done}: ${e instanceof Error ? e.message : "something failed"}`); break; }
    }
    setBusy(false);
    if (done) toast.success(`${done} scheduled${list.length > done ? `, ${list.length - done} still waiting for more days` : ""}`);
  };

  const waiting = posts.filter((p) => p.status === "waiting" && p.slides.length).length;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const cal = Array.from({ length: 42 }, (_, n) => { const d = new Date(tomorrow); d.setDate(d.getDate() + n); return d; });
  const badge = (s: Status) => ({ waiting: "Waiting", banked: "In Client Bank", scheduled: "Scheduled", skipped: "Skipped", failed: "Failed" }[s]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-black">
      <div className="max-w-3xl mx-auto p-4 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">The month for {preset.name}</h2>
          <Button size="sm" variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Close</Button>
        </div>

        {making && <div className="flex items-center gap-2 rounded border border-pink-500 p-3"><Loader2 className="w-4 h-4 animate-spin" />{making} ({made} of {layouts.length} done)</div>}

        {posts.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {posts.map((p, n) => (
              <button key={p.id} type="button" onClick={() => setI(n)} className={`h-7 w-7 rounded-full text-xs font-semibold border ${n === i ? "ring-2 ring-pink-500" : ""} ${p.status === "scheduled" ? "bg-pink-500 text-white" : p.status === "banked" ? "bg-black text-white" : p.status === "skipped" ? "bg-neutral-200 text-neutral-400 line-through" : p.status === "failed" ? "bg-red-100 text-red-600" : "bg-white"}`}>{n + 1}</button>
            ))}
          </div>
        )}

        {cur && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <div className="text-center">
                <div className="font-semibold">Post {i + 1} of {layouts.length}: {cur.treatment}</div>
                <div className="text-neutral-500">{cur.label} · {badge(cur.status)}{cur.when ? ` · ${nice(cur.when)}` : ""}</div>
              </div>
              <Button size="sm" variant="outline" disabled={i >= posts.length - 1} onClick={() => setI(i + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>

            {cur.status === "failed" ? <div className="rounded border border-red-400 p-3 text-red-600">This one would not build: {cur.error}</div> : (
              <>
                <div className="flex gap-3 overflow-x-auto snap-x pb-2">
                  {cur.slides.map((s, n) => (
                    <div key={n} className="snap-start shrink-0">
                      <img src={s} alt="" className="h-[52vh] w-auto max-w-none rounded border" />
                      <div className="text-center text-xs text-neutral-500 mt-1">Slide {n + 1}</div>
                    </div>
                  ))}
                </div>
                <label className="block space-y-1"><span className="font-semibold">Caption</span>
                  <textarea value={cur.caption} onChange={(e) => patch(cur.id, { caption: e.target.value })} rows={8} className="w-full rounded border p-2" /></label>
                <div className="flex gap-2 flex-wrap items-end">
                  <Button disabled={busy || cur.status === "banked" || cur.status === "scheduled"} onClick={() => void doOne("bank")}><Archive className="w-4 h-4 mr-1" />Send to Client Bank</Button>
                  <label className="space-y-1"><span className="block text-xs text-neutral-500">Or pick a date and time</span>
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded border px-2 py-1.5" /></label>
                  <Button variant="outline" disabled={busy || cur.status === "scheduled"} onClick={() => void doOne("schedule")}><CalendarClock className="w-4 h-4 mr-1" />Schedule</Button>
                  <Button variant="outline" disabled={busy} onClick={() => { patch(cur.id, { status: "skipped" }); setI(nextOpen(i)); }}><SkipForward className="w-4 h-4 mr-1" />Skip</Button>
                </div>
              </>
            )}
          </div>
        )}

        {posts.length > 0 && (
          <div className="rounded border-2 border-pink-500 p-3 space-y-2">
            <div className="font-semibold">Schedule all</div>
            <div className="text-neutral-600">Tick the days these should go out. The {waiting} waiting {waiting === 1 ? "post goes" : "posts go"} on them in order, earliest day first.</div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="text-neutral-500">{d}</div>)}
              {Array.from({ length: (cal[0].getDay() + 6) % 7 }, (_, n) => <div key={`g${n}`} />)}
              {cal.map((d) => {
                const k = dayKey(d); const on = days.includes(k);
                return <button key={k} type="button" onClick={() => setDays((l) => (on ? l.filter((x) => x !== k) : [...l, k]))} className={`rounded border py-1.5 ${on ? "bg-pink-500 text-white border-pink-500" : "bg-white"}`}><div className="font-semibold">{d.getDate()}</div><div className="text-[10px] opacity-70">{d.toLocaleDateString("en-GB", { month: "short" })}</div></button>;
              })}
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <label className="space-y-1"><span className="block text-xs text-neutral-500">Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded border px-2 py-1.5" /></label>
              <Button disabled={busy || !days.length || !waiting} onClick={() => void scheduleAll()}><CalendarCheck className="w-4 h-4 mr-1" />Schedule all ({Math.min(days.length, waiting)} of {waiting})</Button>
              <Button variant="ghost" size="sm" onClick={() => setDays([])}>Clear days</Button>
            </div>
            {days.length > 0 && waiting > days.length && <div className="text-neutral-600">{waiting - days.length} more {waiting - days.length === 1 ? "day is" : "days are"} needed for every post. The rest stay waiting.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
