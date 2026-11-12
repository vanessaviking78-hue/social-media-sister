import { useEffect, useRef, useState } from "react";
import { Archive, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Loader2, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildAssets, buildTitleFont, renderUniversalPost } from "@/lib/tenfree-engine";
import { SUITE_FONTS } from "@/lib/suite-fonts";
import { uploadPngs } from "@/lib/month-engine";
import { U_TREATMENTS, U_BY_ID, postTypesFor } from "@/lib/universal-treatments";
import type { ClientPreset } from "@/lib/use-presets";

// NEW month builder: she ticks the covers, presses Create, every post is built with all its slides and caption,
// then they come up one at a time to vet. Each one goes to the Client Bank or is scheduled, or "Schedule all" fills her chosen days.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type MonthLayout = { id: string; n: number; label: string; statik?: boolean };
type Status = "waiting" | "banked" | "scheduled" | "skipped" | "failed";
type Style = "new" | "gradient" | "block" | "box";
type MPost = { id: string; label: string; treatment: string; treatmentId: string; layoutId: string; statik: boolean; k: number; angle: number; headline: string; subtitle: string; body: string[]; cta: string; style: Style; slides: string[]; caption: string; status: Status; when?: string; error?: string };
const STYLES: { id: Style; label: string }[] = [{ id: "new", label: "New cover" }, { id: "gradient", label: "Gradient" }, { id: "block", label: "Colour block" }, { id: "box", label: "Text box" }];

export type MonthSlot = { layout: MonthLayout; treatment: string; hook: string };
const BODY_OPTS = [
  { id: "playfair", label: "Playfair Display", family: "Playfair Display" },
  { id: "roboto", label: "Roboto", family: "Roboto" },
  { id: "inter", label: "Inter", family: "Inter" },
  { id: "instrument", label: "Instrument Serif", family: "Instrument Serif" },
];
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (iso?: string) => { try { return new Date(iso || "").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };

export function NewMonth(props: {
  preset: ClientPreset;
  area: string;
  slots: MonthSlot[];
  photos: ImageBitmap[];
  brand: [string, string];
  startFont: string;
  makeCover: (layout: string, treatment: string, headline: string, fontId: string, bodyId: string) => Promise<HTMLCanvasElement>;
  onClose: () => void;
}) {
  const { preset, area, slots, photos, brand, startFont, makeCover, onClose } = props;
  const layouts = slots.map((s) => s.layout);
  const [posts, setPosts] = useState<MPost[]>([]);
  const [making, setMaking] = useState("Getting the fonts and logo ready...");
  const [made, setMade] = useState(0);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState(preset.defaultPostTime || "18:00");
  const started = useRef(false);
  const assetsRef = useRef<Awaited<ReturnType<typeof buildAssets>> | null>(null);
  // Settings that apply to every post at once. Press Apply to redraw them all.
  const [gFont, setGFont] = useState(startFont || "hatcher");
  const [gBody, setGBody] = useState("playfair");
  const [gScale, setGScale] = useState(100);
  const [gColour, setGColour] = useState("");
  const [gFill, setGFill] = useState(brand[0]);
  const [showWords, setShowWords] = useState(false);
  const [redraw, setRedraw] = useState("");
  // One logo for the whole month: top right, drawn over every slide of every post, so the size and colour here change them all.
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoSize, setLogoSize] = useState(130);
  const [logoWhite, setLogoWhite] = useState(false);
  const logoBox = () => {
    if (!logoImg || !logoImg.naturalWidth) return null;
    const k = logoSize / 100;
    const sc = Math.min((210 * k) / logoImg.naturalWidth, (100 * k) / logoImg.naturalHeight);
    return { w: logoImg.naturalWidth * sc, h: logoImg.naturalHeight * sc };
  };
  const withLogo = async (dataUrl: string): Promise<string> => {
    const box = logoBox();
    if (!box || !logoImg) return dataUrl;
    const base = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
    const c = document.createElement("canvas"); c.width = base.naturalWidth; c.height = base.naturalHeight;
    const g = c.getContext("2d")!; g.drawImage(base, 0, 0);
    const x = c.width - 60 - box.w;
    if (logoWhite) {
      const t = document.createElement("canvas"); t.width = Math.max(1, Math.round(box.w)); t.height = Math.max(1, Math.round(box.h));
      const tg = t.getContext("2d")!; tg.drawImage(logoImg, 0, 0, t.width, t.height); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#ffffff"; tg.fillRect(0, 0, t.width, t.height);
      g.drawImage(t, x, 60);
    } else g.drawImage(logoImg, x, 60, box.w, box.h);
    return c.toDataURL("image/jpeg", 0.93);
  };
  const foot = (preset.captionFootnote || "").trim();

  const patch = (id: string, c: Partial<MPost>) => setPosts((l) => l.map((p) => (p.id === id ? { ...p, ...c } : p)));

  const build = async (p: MPost, over?: Partial<MPost>): Promise<string[]> => {
    const a = assetsRef.current!;
    const q = { ...p, ...over };
    const common = { treatmentId: q.treatmentId, headline: q.headline, copy: { subtitle: q.subtitle, slides: q.body, cta: q.cta }, photos, offset: q.k, angle: q.angle, bodyFont: BODY_OPTS.find((b) => b.id === gBody)?.family, textScale: gScale !== 100 ? gScale / 100 : undefined, textColour: gColour || undefined };
    let cs: HTMLCanvasElement[];
    if (q.style === "new") {
      const cover = await makeCover(q.layoutId, q.treatment, q.headline, gFont, gBody);
      cs = [cover, ...(q.statik ? [] : renderUniversalPost(common, a).slice(1))];
    } else {
      const extra = q.style === "block" ? { block: gFill } : q.style === "box" ? { box: { fill: gFill, x: 0.5, y: 0.5 } } : {};
      cs = renderUniversalPost({ ...common, ...extra }, a);
    }
    return cs.map((c) => c.toDataURL("image/jpeg", 0.93));
  };
  const redrawOne = async (p: MPost, over?: Partial<MPost>) => {
    try { const slides = await build(p, over); patch(p.id, { ...over, slides }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That one would not redraw"); }
  };
  const redrawAll = async (over?: Partial<MPost>) => {
    if (assetsRef.current) assetsRef.current.tf = await buildTitleFont(gFont);
    await Promise.all(BODY_OPTS.map((b) => document.fonts.load(`400 40px "${b.family}"`).catch(() => [])));
    const list = posts.filter((p) => p.status !== "failed");
    for (const [n, p] of list.entries()) { setRedraw(`Redrawing ${n + 1} of ${list.length}...`); await redrawOne(p, over); }
    setRedraw("");
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const logoBlob = preset.logoUrl ? await fetch(preset.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
        const assets = await buildAssets({ main: brand[0], accent: brand[1], clinicName: preset.name, handle: "", whatsapp: "", logoBlob, photoBlob: null });
        setLogoImg(assets.logoImg);
        assets.logoImg = null; // the logo is added afterwards, in one place, so one control moves it on every slide
        assetsRef.current = assets;
        const used: Record<string, number> = {};
        for (let k = 0; k < layouts.length; k++) {
          const l = slots[k].layout;
          const x = U_TREATMENTS.find((t) => t.name === slots[k].treatment) ?? U_TREATMENTS[0];
          const angle = (used[x.id] = (used[x.id] ?? -1) + 1) % 6;
          const type = { ...postTypesFor(x)[angle], headline: slots[k].hook, brief: `Carry on from the hook on slide 1 and make it about ${x.name}.` };
          setMaking(`Writing and drawing post ${k + 1} of ${layouts.length}...`);
          const id = `${l.id}-${k}-${Date.now()}`;
          try {
            const r = await fetch(`${BASE}/api/universal/copy`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client: preset.name, area, treatment: x.name, headline: type.headline, brief: type.brief, intro: false, note: "" }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d?.error || "The words would not write");
            const caption = [String(d.caption || "").replace(foot, "").trim(), (d.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
            const np: MPost = { id, label: `${l.n}. ${l.label}`, treatment: x.name, treatmentId: x.id, layoutId: l.id, statik: !!l.statik, k, angle, headline: type.headline, subtitle: d.subtitle, body: d.slides, cta: d.cta, style: "new", slides: [], caption, status: "waiting" };
            np.slides = await build(np);
            setPosts((cur) => [...cur, np]);
          } catch (e) {
            setPosts((cur) => [...cur, { id, label: `${l.n}. ${l.label}`, treatment: x.name, headline: type.headline, treatmentId: x.id, layoutId: l.id, statik: !!l.statik, k, angle, subtitle: "", body: [], cta: "", style: "new", slides: [], caption: "", status: "failed", error: e instanceof Error ? e.message : "Failed" }]);
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
    const finals = await Promise.all(p.slides.map((s) => withLogo(s)));
    const urls = await uploadPngs(finals, p.slides.map((_, n) => `new-${p.id}-${n + 1}.jpg`));
    const content = { caption: [p.caption.trim(), foot].filter(Boolean).join("\n\n"), title: `${p.treatment} · ${preset.name}`, platforms: ["instagram"], imageUrls: urls, sourceTool: "new-covers" };
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

        {logoImg && (
          <div className="flex items-center gap-3 flex-wrap rounded border p-2">
            <span className="font-semibold">Logo, top right on every slide of every post</span>
            <label className="flex items-center gap-2">Size<input type="range" min={40} max={300} value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="accent-pink-500" /><span className="w-10 text-right">{logoSize}%</span></label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={logoWhite} onChange={(e) => setLogoWhite(e.target.checked)} className="accent-pink-500" />Make it white</label>
          </div>
        )}

        {posts.length > 0 && (
          <div className="rounded border p-2 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">Fonts for every post</span>
              <label className="flex items-center gap-1.5">Headlines<select value={gFont} onChange={(e) => setGFont(e.target.value)} className="rounded border px-2 py-1">{SUITE_FONTS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
              <label className="flex items-center gap-1.5">Subtitles<select value={gBody} onChange={(e) => setGBody(e.target.value)} className="rounded border px-2 py-1">{BODY_OPTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Make every post</span>
              {STYLES.map((st) => <Button key={st.id} size="sm" variant="outline" disabled={!!redraw} onClick={() => void redrawAll({ style: st.id })}>{st.label}</Button>)}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">All headings and subtitles</span>
              <label className="flex items-center gap-2">Writing size<input type="range" min={70} max={140} value={gScale} onChange={(e) => setGScale(Number(e.target.value))} className="accent-pink-500" /><span className="w-10 text-right">{gScale}%</span></label>
              <label className="flex items-center gap-1.5">Writing colour<input type="color" value={gColour || "#ffffff"} onChange={(e) => setGColour(e.target.value)} />{gColour && <button type="button" className="text-xs underline" onClick={() => setGColour("")}>Automatic</button>}</label>
              <label className="flex items-center gap-1.5">Block and box colour<input type="color" value={gFill} onChange={(e) => setGFill(e.target.value)} /></label>
              <Button size="sm" disabled={!!redraw} onClick={() => void redrawAll()}>Apply fonts, size and colour to all posts</Button>
              <Button size="sm" variant="outline" onClick={() => setShowWords((v) => !v)}>{showWords ? "Hide the wording" : "Edit all the wording"}</Button>
              {redraw && <span className="flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" />{redraw}</span>}
            </div>
            <div className="text-xs text-neutral-500">Size and colour change the writing on the gradient, block and box covers and every slide after the cover. The New cover designs keep their own designed text.</div>
            {showWords && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {posts.filter((p) => p.status !== "failed").map((p, n) => (
                  <div key={p.id} className="grid gap-1 md:grid-cols-2">
                    <input value={p.headline} onChange={(e) => patch(p.id, { headline: e.target.value })} className="rounded border px-2 py-1" aria-label={`Heading ${n + 1}`} />
                    <input value={p.subtitle} onChange={(e) => patch(p.id, { subtitle: e.target.value })} className="rounded border px-2 py-1" aria-label={`Subtitle ${n + 1}`} />
                  </div>
                ))}
                <div className="text-xs text-neutral-500">Change any heading or subtitle, then press Apply to all posts to redraw.</div>
              </div>
            )}
          </div>
        )}

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
                  <div className="snap-start shrink-0 order-last w-[min(80vw,26rem)] space-y-1">
                    <div className="font-semibold">Caption</div>
                    <textarea value={cur.caption} onChange={(e) => patch(cur.id, { caption: e.target.value })} rows={12} className="w-full rounded border p-2" />
                    <div className="text-xs text-neutral-500">Footnote from {preset.name}'s preset, added when it goes out:</div>
                    <div className="rounded border bg-neutral-50 p-2 text-xs whitespace-pre-wrap">{foot || "None set on this client's preset."}</div>
                  </div>
                  {cur.slides.map((s, n) => (
                    <div key={n} className="snap-start shrink-0">
                      <div className="relative inline-block">
                        <img src={s} alt="" className="h-[52vh] w-auto max-w-none rounded border block" />
                        {logoImg && logoBox() && <img src={logoImg.src} alt="" style={{ position: "absolute", top: "4.44%", right: "5.56%", width: `${(logoBox()!.w / 1080) * 100}%`, filter: logoWhite ? "brightness(0) invert(1)" : undefined }} className="max-w-none" />}
                      </div>
                      <div className="text-center text-xs text-neutral-500 mt-1">Slide {n + 1}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="font-semibold">Style for this post</span>
                  {STYLES.map((st) => <button key={st.id} type="button" disabled={!!redraw} onClick={() => void redrawOne(cur, { style: st.id })} className={`rounded-full border px-3 py-1 ${cur.style === st.id ? "bg-pink-500 border-pink-500 text-white" : ""}`}>{st.label}</button>)}
                  <Button size="sm" variant="outline" disabled={!!redraw} onClick={() => void redrawAll({ style: cur.style })}>Use this style on all posts</Button>
                </div>
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
