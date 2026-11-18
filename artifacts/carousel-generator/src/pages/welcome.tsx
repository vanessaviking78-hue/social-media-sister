import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Heart, Instagram, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { QUESTIONS, shrink } from "@/pages/getting-to-know-you";
import { CLINIC_TREATMENT_GROUPS } from "@/lib/clinic-treatments";
import { SUITE_FONTS, injectSuiteFontCss } from "@/lib/suite-fonts";

const BASE = import.meta.env.BASE_URL;
const PINK = "#ff2d8a";

// THE WELCOME PAGE. Getting to know you, what they offer, their font, photos and Instagram, all in one personal link.
// It saves onto the same profile, treatments and font records the separate forms use, so every tool reads it as before.

const STEPS = ["welcome", "you", "patients", "treatments", "brand", "photos", "connect", "done"] as const;
type Step = (typeof STEPS)[number];

const GROUPS: { step: Step; title: string; intro: string; ids: string[] }[] = [
  { step: "you", title: "Let me get to know you", intro: "Chatty answers are perfect. Write it how you would say it to a friend and I will make your posts sound like you.", ids: ["who", "words", "adore", "howstarted", "facts", "humour", "extra"] },
  { step: "patients", title: "Your patients", intro: "The better I understand who you look after, the more your posts will make them stop scrolling.", ids: ["patient", "worries", "treatments", "favtreatments", "never", "links"] },
];

const LABEL_FOR: Record<string, string> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.label]));

export default function Welcome({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [clientName, setClientName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [other, setOther] = useState("");
  const [fontId, setFontId] = useState("");
  const [upper, setUpper] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [returning, setReturning] = useState(false);
  const [ig, setIg] = useState<{ checked: boolean; available: boolean; connected: boolean; onboardToken?: string }>({ checked: false, available: false, connected: false });
  const [igBusy, setIgBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { try { injectSuiteFontCss(); } catch { /* fonts fall back */ } }, []);
  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  useEffect(() => {
    fetch(`${BASE}api/welcome/${encodeURIComponent(token)}`)
      .then(async (r) => { if (!r.ok) throw new Error("invalid"); return r.json(); })
      .then((d) => {
        setClientName(d.clientName);
        setAnswers(d.answers ?? {});
        setPhotoUrl(d.photoUrl ?? null);
        setTicked(new Set<string>(d.treatments ?? []));
        setOther(d.other ?? "");
        setFontId(d.fontId ?? "");
        setUpper(!!d.upper);
        setReturning(Object.entries(d.answers ?? {}).some(([k, v]) => k !== "reviewImages" && k !== "clinicPhotos" && typeof v === "string" && v.trim()));
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const idx = STEPS.indexOf(step);
  const progress = Math.round((idx / (STEPS.length - 1)) * 100);
  const change = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  const list = (key: string): string[] => { try { const v = JSON.parse(answers[key] || "[]"); return Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : []; } catch { return []; } };
  const setList = (key: string, urls: string[]) => change(key, JSON.stringify(urls));

  const api = async (path: string, method: string, body?: unknown) => {
    const r = await fetch(`${BASE}api/welcome/${encodeURIComponent(token)}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { error?: string }).error || "That did not save, please try again");
    return d;
  };

  const upload = async (files: File[], label: string): Promise<string[]> => {
    const out: string[] = [];
    for (let i = 0; i < files.length; i += 2) {
      const images = await Promise.all(files.slice(i, i + 2).map(async (f, j) => ({ name: `${clientName || "client"}-${label}-${Date.now()}-${i + j}.png`, base64: await shrink(f, 2400) })));
      const r = await fetch(`${BASE}api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error || "That photo did not upload, try a smaller one");
      out.push(...(d.results ?? []).map((x: { url: string }) => x.url));
    }
    return out;
  };

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try { const [u] = await upload([f], "photo"); if (u) setPhotoUrl(u); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That photo did not upload"); }
    finally { setUploading(false); }
  };
  const pickMany = async (key: string, label: string, fl: FileList | null) => {
    if (!fl?.length) return;
    setUploading(true);
    try { const u = await upload(Array.from(fl), label); setList(key, [...list(key), ...u]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That image did not upload"); }
    finally { setUploading(false); }
  };

  const saveStep = async (from: Step) => {
    if (from === "you" || from === "patients" || from === "brand" || from === "photos") {
      const chosen = SUITE_FONTS.find((f) => f.id === fontId);
      const send = from === "brand" && chosen ? { ...answers, font: chosen.name } : answers;
      await api("/answers", "PUT", { answers: send, photoUrl });
    }
    if (from === "treatments") await api("/treatments", "PUT", { treatments: [...ticked], other });
    if (from === "brand" && fontId) await api("/font", "PUT", { fontId, upper });
  };

  const checkInstagram = async () => {
    try {
      const d = await api("/instagram", "POST");
      setIg({ checked: true, available: !!d.available, connected: !!d.connected, onboardToken: d.onboardToken });
    } catch { setIg({ checked: true, available: false, connected: false }); }
  };

  const go = async (to: Step) => {
    setBusy(true);
    try {
      await saveStep(step);
      if (to === "connect") await checkInstagram();
      if (to === "done") await api("/finish", "POST");
      setStep(to);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not save, please try again");
    } finally { setBusy(false); }
  };
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => { setStep(STEPS[Math.max(idx - 1, 0)]); window.scrollTo({ top: 0 }); };

  const connect = async () => {
    if (!ig.onboardToken) return;
    setIgBusy(true);
    try {
      const r = await fetch(`${BASE}api/onboarding/${ig.onboardToken}/start`);
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || "Could not start the connection");
      window.open(d.url, "_blank", "noopener");
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const s = await (await fetch(`${BASE}api/onboarding/${ig.onboardToken}`)).json();
          if (s.alreadyConnected) { if (poll.current) clearInterval(poll.current); setIg((x) => ({ ...x, connected: true })); setIgBusy(false); }
        } catch { /* keep checking */ }
      }, 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the connection");
      setIgBusy(false);
    }
  };

  const toggle = (id: string) => setTicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ids: string[]) => setTicked((s) => { const n = new Set(s); const all = ids.every((i) => n.has(i)); ids.forEach((i) => (all ? n.delete(i) : n.add(i))); return n; });

  const first = useMemo(() => clientName.split(" ")[0] || "lovely", [clientName]);

  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="h-1.5 bg-black/10"><div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: PINK }} /></div>
      <div className="max-w-2xl mx-auto px-5 py-8 pb-28">{children}</div>
    </div>
  );

  if (state === "loading") return <div className="min-h-screen grid place-items-center bg-white"><Loader2 className="h-6 w-6 animate-spin" style={{ color: PINK }} /></div>;
  if (state === "invalid") return <div className="min-h-screen grid place-items-center bg-white text-black px-6 text-center" style={{ fontFamily: "'League Spartan', sans-serif" }}><p>This link does not look right. Please ask me to send it again.</p></div>;

  const nav = (label = "Next", disabled = false) => (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-black/10">
      <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
        {idx > 0 ? <button type="button" onClick={back} className="inline-flex items-center gap-1 text-black/60 font-semibold"><ChevronLeft className="w-4 h-4" /> Back</button> : <span />}
        <button type="button" disabled={busy || uploading || disabled} onClick={() => void next()} className="rounded-full text-white px-7 py-3 font-bold inline-flex items-center gap-2 disabled:opacity-40" style={{ background: "#000" }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {label} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const heading = (title: string, intro: string, n?: string) => (
    <div className="space-y-2 mb-6">
      {n && <p className="text-xs font-bold tracking-widest uppercase" style={{ color: PINK }}>{n}</p>}
      <h1 className="text-4xl font-black leading-none">{title}</h1>
      <p className="text-black/70 leading-relaxed">{intro}</p>
    </div>
  );

  const field = (id: string) => {
    const q = QUESTIONS.find((x) => x.id === id);
    if (!q) return null;
    const cls = "w-full rounded-xl border-2 border-black/15 p-3 focus:outline-none focus:border-[#ff2d8a]";
    return (
      <label key={id} className="block space-y-1">
        <span className="font-bold">{LABEL_FOR[id]}</span>
        {q.hint && <span className="block text-sm text-black/50">{q.hint}</span>}
        {q.long
          ? <textarea rows={3} className={cls} value={answers[id] ?? ""} onChange={(e) => change(id, e.target.value)} />
          : <input className={cls} value={answers[id] ?? ""} onChange={(e) => change(id, e.target.value)} />}
      </label>
    );
  };

  const uploader = (key: string, label: string, text: string) => (
    <div className="flex flex-wrap gap-3">
      {list(key).map((u) => (
        <div key={u} className="relative">
          <img src={u} alt="" className="h-28 w-auto max-w-[180px] rounded-xl object-cover border border-black/10" />
          <button type="button" onClick={() => setList(key, list(key).filter((x) => x !== u))} className="absolute -top-2 -right-2 rounded-full bg-white border border-black/20 p-0.5" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <label className="h-28 w-28 rounded-xl border-2 border-dashed border-black/20 grid place-items-center text-xs text-black/60 cursor-pointer hover:border-[#ff2d8a] text-center px-2">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Upload className="h-4 w-4" />{text}</span>}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void pickMany(key, label, e.target.files); e.target.value = ""; }} />
      </label>
    </div>
  );

  if (step === "welcome") return shell(<>
    <div className="pt-6 space-y-6">
      <p className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: PINK }}><Heart className="w-3.5 h-3.5" /> Social Media Sister</p>
      <h1 className="text-5xl font-black leading-[0.95]">{returning ? `Welcome back, ${first}` : `Welcome, ${first}`}</h1>
      <p className="text-lg text-black/70 leading-relaxed">I am so glad you are here. This is the one place where you tell me everything I need to make your content properly yours. It takes about ten minutes, you only do it once, and you can come back to change anything whenever you like.</p>
      <div className="rounded-2xl border-2 border-black p-5 space-y-3">
        <p className="font-black uppercase tracking-wide" style={{ color: PINK }}>What we will do together</p>
        <ol className="space-y-2 text-black/80">
          <li><b>1.</b> You tell me about you, in your own words</li>
          <li><b>2.</b> You tell me about the people you look after</li>
          <li><b>3.</b> You tick the treatments you offer</li>
          <li><b>4.</b> You pick your colours and your font</li>
          <li><b>5.</b> You send me your photos and reviews</li>
          <li><b>6.</b> You connect Instagram, if you want to</li>
        </ol>
      </div>
      <p className="text-black/60 text-sm">Everything saves as you go, so you can close this and pick it up later from the same link.</p>
    </div>
    {nav(returning ? "Carry on" : "Let us begin")}
  </>);

  const group = GROUPS.find((g) => g.step === step);
  if (group) return shell(<>
    {heading(group.title, group.intro, `Step ${idx} of 6`)}
    {step === "you" && (
      <div className="space-y-2 mb-6">
        <span className="font-bold block">A photo of you</span>
        <span className="block text-sm text-black/50">A clear, front on photo with a closed mouth smile is perfect. Straight off your phone is fine, no editing needed.</span>
        <div className="flex items-center gap-4">
          {photoUrl ? <img src={photoUrl} alt="You" className="h-32 w-24 rounded-xl object-cover border border-black/10" /> : <div className="h-32 w-24 rounded-xl border-2 border-dashed border-black/20 grid place-items-center text-xs text-black/50 text-center px-1">No photo yet</div>}
          <label className="inline-flex items-center gap-2 rounded-full border-2 border-black px-4 py-2 font-bold cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {photoUrl ? "Change photo" : "Add a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>
    )}
    <div className="space-y-5">{group.ids.map(field)}</div>
    {nav()}
  </>);

  if (step === "treatments") return shell(<>
    {heading("What do you offer?", "Tick every treatment you offer and nothing you do not. I use this so your content is only ever about what you actually do.", "Step 3 of 6")}
    <div className="space-y-4">
      {CLINIC_TREATMENT_GROUPS.map((g) => {
        const ids = g.items.map((i) => i.id);
        const n = ids.filter((i) => ticked.has(i)).length;
        return (
          <section key={g.id} className="rounded-2xl border border-black/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black text-lg">{g.label}</h2>
              <button type="button" onClick={() => toggleGroup(ids)} className="text-sm font-bold" style={{ color: PINK }}>{n === ids.length ? "Clear all" : "Tick all"}</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {g.items.map((t) => {
                const on = ticked.has(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer" style={{ borderColor: on ? PINK : "rgba(0,0,0,.15)", background: on ? "rgba(255,45,138,.06)" : undefined }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(t.id)} className="w-5 h-5" style={{ accentColor: PINK }} />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
      <label className="block space-y-1">
        <span className="font-bold">Anything else you offer that is not on the list?</span>
        <textarea rows={3} value={other} onChange={(e) => setOther(e.target.value)} className="w-full rounded-xl border-2 border-black/15 p-3 focus:outline-none focus:border-[#ff2d8a]" />
      </label>
      <p className="text-black/50 text-sm">{ticked.size} ticked</p>
    </div>
    {nav()}
  </>);

  if (step === "brand") {
    const shown = clientName || "Your Clinic Name";
    return shell(<>
      {heading("Your look", "Tell me your colours, then tap the font that feels most like you. It will be used on the titles of your posts.", "Step 4 of 6")}
      <div className="space-y-6">
        {field("colours")}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} style={{ accentColor: PINK }} /> Show my name in capital letters</label>
        <div className="grid sm:grid-cols-2 gap-3">
          {SUITE_FONTS.map((f) => {
            const on = fontId === f.id;
            return (
              <button key={f.id} type="button" onClick={() => setFontId(f.id)} className="text-left rounded-2xl border-2 p-4" style={{ borderColor: on ? PINK : "rgba(0,0,0,.15)", background: on ? "rgba(255,45,138,.06)" : undefined }}>
                <div className="text-3xl leading-tight break-words" style={{ fontFamily: `"${f.family}", serif`, textTransform: upper ? "uppercase" : "none" }}>{shown}</div>
                <div className="text-xs mt-2 text-black/50 flex items-center gap-1">{f.name}{on && <Check className="w-4 h-4" style={{ color: PINK }} />}</div>
              </button>
            );
          })}
        </div>
      </div>
      {nav()}
    </>);
  }

  if (step === "photos") return shell(<>
    {heading("Photos and reviews", "Straight from your phone is perfect, you do not need to edit or shrink anything. Natural light and clear faces make the best posts.", "Step 5 of 6")}
    <div className="space-y-8">
      <div className="space-y-2">
        <span className="font-bold block">Your clinic and your work</span>
        <span className="block text-sm text-black/50">Your treatment room, your team, your clinic, anything that shows what it feels like to be with you.</span>
        {uploader("clinicPhotos", "clinic", "Add photos")}
      </div>
      <div className="space-y-2">
        <span className="font-bold block">Your best reviews</span>
        <span className="block text-sm text-black/50">Screenshots from Google, Facebook or Instagram. The words your patients use are gold for your posts.</span>
        {uploader("reviewImages", "review", "Add review images")}
      </div>
    </div>
    {nav()}
  </>);

  if (step === "connect") return shell(<>
    {heading("Connect Instagram", "This lets me post for you without ever asking for your password. It is completely optional and you can do it later.", "Step 6 of 6")}
    {!ig.checked && <Loader2 className="h-5 w-5 animate-spin" />}
    {ig.checked && ig.connected && (
      <div className="rounded-2xl border-2 p-5 flex items-start gap-3" style={{ borderColor: PINK }}>
        <Check className="w-6 h-6 shrink-0" style={{ color: PINK }} />
        <div><p className="font-black">You are connected</p><p className="text-black/70 text-sm mt-1">Your Facebook Page and Instagram are linked. Nothing more to do here.</p></div>
      </div>
    )}
    {ig.checked && !ig.connected && ig.available && (
      <div className="space-y-3">
        <button type="button" onClick={() => void connect()} disabled={igBusy} className="w-full rounded-2xl text-white font-bold py-4 inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: PINK }}>
          {igBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Instagram className="w-5 h-5" />} {igBusy ? "Waiting for Facebook" : "Connect Facebook and Instagram"}
        </button>
        {igBusy && <p className="text-sm text-black/60 text-center">A Facebook window has opened. Finish the steps there and this page will update by itself.</p>}
      </div>
    )}
    {ig.checked && !ig.available && <p className="text-black/70">I will sort the Instagram connection with you personally, so there is nothing to do here. Just press next.</p>}
    {nav(ig.connected ? "Finish" : "Skip for now and finish")}
  </>);

  return shell(<div className="pt-10 text-center space-y-5">
    <div className="mx-auto w-16 h-16 rounded-full text-white flex items-center justify-center" style={{ background: PINK }}><Check className="w-8 h-8" /></div>
    <h1 className="text-5xl font-black leading-[0.95]">Thank you, {first}</h1>
    <p className="text-lg text-black/70 leading-relaxed max-w-md mx-auto">I have everything I need to make your content sound like you. I will be in touch soon with what happens next.</p>
    <p className="text-black/50 text-sm">If you think of anything else, open the same link and add it. Your next batch of content will include it.</p>
    <button type="button" onClick={() => setStep("you")} className="rounded-full border-2 border-black px-6 py-3 font-bold">Add or change something</button>
  </div>);
}
