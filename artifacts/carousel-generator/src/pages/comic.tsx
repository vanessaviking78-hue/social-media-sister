import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Sparkles, Loader2, Download, Copy, Wand2, RefreshCcw, Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { COMIC_CONVERSATIONS, COMIC_EXPRESSIONS, type Expr } from "@/lib/comic-conversations";
import { renderComicPage, renderComicCover, comicSummary, COMIC_W, COMIC_H, type ComicSprites, type SpriteSet } from "@/lib/comic-render";
import { COMIC_TITLES, COMIC_STRAPLINES, COMIC_ISSUES, fillTitle } from "@/lib/comic-titles";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function ensureComicFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector("link[data-comic-fonts]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.setAttribute("data-comic-fonts", "true");
  link.href = "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700;800&family=Bangers&display=swap";
  document.head.appendChild(link);
}
ensureComicFonts();

// What each expression looks like, in words the image model understands.
const EXPR_TEXT: Record<Expr, string> = {
  neutral: "a calm, neutral, attentive face with a small closed-mouth smile",
  smug: "a smug, knowing, side-eye look with one eyebrow raised and a tiny smirk",
  horrified: "wide eyes, mouth open in horror, eyebrows up, clearly appalled",
  happy: "a big warm delighted smile, bright eyes",
  angry: "furious, eyebrows down, jaw clenched, arms folded, about to storm off",
};

// The shared cast of cartoon patients. Same for every clinic.
const PATIENTS: { id: string; name: string; description: string }[] = [
  { id: "pat-1", name: "Trish", description: "A woman in her late 30s with a messy auburn bun, big round glasses and a mustard cardigan" },
  { id: "pat-2", name: "Denise", description: "A woman in her 50s with a silver bob, bold red lipstick and a leopard print scarf" },
  { id: "pat-3", name: "Kayleigh", description: "A woman in her 20s with long blonde hair, a baseball cap and a puffer jacket" },
  { id: "pat-4", name: "Pauline", description: "A woman in her 60s with tight grey curls, a floral blouse and pearl earrings" },
  { id: "pat-5", name: "Mandy", description: "A woman in her 40s with a dark ponytail, a bright pink gym top and a big handbag" },
  { id: "pat-6", name: "Gary", description: "A man in his 40s with a shaved head, a neat beard and a football shirt" },
];

type ExprUrls = Partial<Record<Expr, string>>;
type Store = { clinicians: Record<string, ExprUrls>; patients: Record<string, ExprUrls> };

const STORE_KEY = "comic-characters-v2";

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* private window or blocked storage */ }
  return { clinicians: {}, patients: {} };
}
function saveStore(s: Store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

interface JobCard { scenarioId: string; status: string; outputImageUrl?: string; failureReason?: string }

async function api(path: string, body: unknown) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || `Request failed (${r.status})`);
  return d as any;
}

async function uploadSource(blob: Blob, clientName: string): Promise<number> {
  const fd = new FormData();
  fd.append("photo", blob, "source.png");
  fd.append("clientName", clientName);
  const r = await fetch(`${BASE}/api/ai-portrait/source`, { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || "Upload failed");
  return (d as { id: number }).id;
}

async function runJob(sourcePhotoId: number | undefined, clientName: string, scenarios: unknown[]): Promise<JobCard[]> {
  const { jobId } = await api("/ai-portrait/generate", { sourcePhotoId, clientName, scenarios });
  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${BASE}/api/ai-portrait/jobs/${jobId}/status`);
    if (!r.ok) throw new Error("Lost track of the job");
    const { cards } = await r.json() as { cards: JobCard[] };
    if (cards.every((c) => c.status === "success" || c.status === "failed")) return cards;
  }
  throw new Error("Timed out waiting for the artwork");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed"));
    img.src = url;
  });
}

async function loadSprites(urls: ExprUrls): Promise<SpriteSet> {
  const out: SpriteSet = {};
  await Promise.all(
    COMIC_EXPRESSIONS.map(async (e) => {
      const u = urls[e];
      if (!u) return;
      try { out[e] = await loadImage(u); } catch { /* missing sprite falls back to a placeholder */ }
    }),
  );
  return out;
}

// Makes one character: neutral first (from the photo, or from words for a patient),
// then the other expressions redrawn from that neutral so the face stays the same.
async function buildCharacter(opts: {
  clientName: string;
  description: string;
  photo: File | null;
  onProgress: (msg: string) => void;
}): Promise<ExprUrls> {
  const { clientName, description, photo, onProgress } = opts;
  onProgress("Drawing the first cartoon");
  const photoId = photo ? await uploadSource(photo, clientName) : undefined;
  const first = await runJob(photoId, clientName, [{
    id: "cartoon-neutral",
    aspectRatio: "3:4",
    cartoon: true,
    textOnly: !photo,
    promptVars: { customText: `${description}. Expression: ${EXPR_TEXT.neutral}.` },
  }]);
  const base = first[0];
  if (base.status !== "success" || !base.outputImageUrl) throw new Error(base.failureReason || "The first cartoon failed");

  onProgress("Drawing the other expressions");
  const baseBlob = await (await fetch(base.outputImageUrl)).blob();
  const refId = await uploadSource(baseBlob, clientName);
  const rest = COMIC_EXPRESSIONS.filter((e) => e !== "neutral");
  const cards = await runJob(refId, clientName, rest.map((e) => ({
    id: `cartoon-${e}`,
    aspectRatio: "3:4",
    cartoon: true,
    cartoonRedraw: true,
    promptVars: { customText: `${description}. Expression: ${EXPR_TEXT[e]}.` },
  })));

  // The artwork comes back on plain white and is blended into the panels, so no cut-out step is needed.
  const out: ExprUrls = { neutral: base.outputImageUrl };
  for (const c of cards) {
    const e = c.scenarioId.replace("cartoon-", "") as Expr;
    if (c.status === "success" && c.outputImageUrl) out[e] = c.outputImageUrl;
  }
  // If an expression failed, fall back to neutral so the strip still renders.
  for (const e of COMIC_EXPRESSIONS) if (!out[e]) out[e] = out.neutral;
  return out;
}

export default function ComicPage() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [uniform, setUniform] = useState("navy blue");
  const [store, setStore] = useState<Store>(() => loadStore());
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [convId, setConvId] = useState(COMIC_CONVERSATIONS[0].id);
  const [patientId, setPatientId] = useState("auto");
  const [search, setSearch] = useState("");
  const [footer, setFooter] = useState("");
  const [tone, setTone] = useState("5");
  const [caption, setCaption] = useState("");
  const [titleIdx, setTitleIdx] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [strapline, setStrapline] = useState(COMIC_STRAPLINES[0]);
  const [issue, setIssue] = useState("1");
  const [clinicName, setClinicName] = useState("");
  const [writing, setWriting] = useState(false);
  const [sprites, setSprites] = useState<ComicSprites>({ inj: {}, pat: {} });
  const [fontsReady, setFontsReady] = useState(0);
  const c0 = useRef<HTMLCanvasElement>(null);
  const c1 = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const conv = useMemo(() => COMIC_CONVERSATIONS.find((c) => c.id === convId) ?? COMIC_CONVERSATIONS[0], [convId]);
  const convIndex = COMIC_CONVERSATIONS.findIndex((c) => c.id === conv.id);

  // Which patient plays this comic. "auto" rotates through the ones that have been made.
  const madePatients = PATIENTS.filter((p) => store.patients[p.id]);
  const activePatient = patientId !== "auto"
    ? PATIENTS.find((p) => p.id === patientId)
    : madePatients.length ? madePatients[convIndex % madePatients.length] : undefined;

  const clinicianUrls = clientName ? store.clinicians[clientName] : undefined;
  const patientUrls = activePatient ? store.patients[activePatient.id] : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [inj, pat] = await Promise.all([
        loadSprites(clinicianUrls ?? {}),
        loadSprites(patientUrls ?? {}),
      ]);
      if (!cancelled) setSprites({ inj, pat });
    })();
    return () => { cancelled = true; };
  }, [clinicianUrls, patientUrls]);

  useEffect(() => {
    const f = (document as { fonts?: { load?: (s: string) => Promise<unknown> } }).fonts;
    Promise.all([f?.load?.('800 36px "Comic Neue"'), f?.load?.('400 60px "Bangers"')])
      .then(() => setFontsReady((n) => n + 1)).catch(() => {});
  }, []);

  const coverTitle = customTitle.trim() || fillTitle(COMIC_TITLES[titleIdx] ?? COMIC_TITLES[0], clientName, clinicName);

  const shuffleTitle = () => {
    setCustomTitle("");
    setTitleIdx((cur) => {
      let next = cur;
      while (COMIC_TITLES.length > 1 && next === cur) next = Math.floor(Math.random() * COMIC_TITLES.length);
      return next;
    });
  };

  const render = useCallback(() => {
    if (c0.current) renderComicCover(c0.current, conv, sprites, { title: coverTitle, strapline, issue, footer });
    if (c1.current) renderComicPage(c1.current, conv, sprites, { footer });
  }, [conv, sprites, footer, coverTitle, strapline, issue]);

  useEffect(() => { render(); }, [render, fontsReady]);

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const makeClinician = async () => {
    if (!clientName) { toast.error("Choose a clinician first"); return; }
    if (!photo) { toast.error("Add their photo first"); return; }
    if (!consent) { toast.error("Tick the box to confirm they are happy to be cartooned"); return; }
    setBusy("clinician");
    try {
      const urls = await buildCharacter({
        clientName,
        description: `A friendly, professional aesthetics clinician wearing a smart ${uniform} clinic tunic`,
        photo,
        onProgress: setProgress,
      });
      const next = { ...store, clinicians: { ...store.clinicians, [clientName]: urls } };
      setStore(next); saveStore(next);
      toast.success(`${clientName} is a cartoon`);
    } catch (e: any) {
      toast.error(e?.message || "Could not make the character");
    } finally {
      setBusy(null); setProgress("");
    }
  };

  const makePatient = async (id: string) => {
    const p = PATIENTS.find((x) => x.id === id);
    if (!p) return;
    setBusy(id);
    try {
      const urls = await buildCharacter({
        clientName: `Comic patient ${p.name}`,
        description: p.description,
        photo: null,
        onProgress: setProgress,
      });
      const next = { ...store, patients: { ...store.patients, [id]: urls } };
      setStore(next); saveStore(next);
      toast.success(`${p.name} is ready`);
    } catch (e: any) {
      toast.error(e?.message || "Could not make the patient");
    } finally {
      setBusy(null); setProgress("");
    }
  };

  const download = (canvas: HTMLCanvasElement | null, n: number) =>
    new Promise<void>((resolve) => {
      if (!canvas) return resolve();
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const slug = (clientName || "clinic").replace(/\s+/g, "-").toLowerCase();
        a.download = `${slug}-comic-${conv.id}-${n === 1 ? "1-cover" : "2-page"}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        resolve();
      }, "image/png");
    });

  const downloadBoth = async () => {
    render();
    await download(c0.current, 1);
    await new Promise((r) => setTimeout(r, 400));
    await download(c1.current, 2);
  };

  const writeCaption = async () => {
    setWriting(true);
    try {
      const context = [
        `A two-slide comic book carousel: a cover titled "${coverTitle}" then one page of six panels called "${conv.title}". The clinician is the sensible one and the joke pokes fun at the safety risks of unqualified or cheap treatment. The conversation:`,
        comicSummary(conv),
        "Write the caption to go with the comic. Do not repeat the dialogue word for word, react to it like the clinician posting it. Finish with a strong, stealth-sales-friendly call to action that invites people to book a proper consultation or send a message, without sounding pushy.",
      ].join("\n\n");
      const d = await api("/caption-generator/generate", { tone, context, clinicName: clientName || undefined });
      setCaption(d.caption || "");
    } catch (e: any) {
      toast.error(e?.message || "Could not write the caption");
    } finally {
      setWriting(false);
    }
  };

  const filtered = COMIC_CONVERSATIONS.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const clinicianReady = !!clinicianUrls;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Comic Strip Maker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Turn a clinician into a pop-art cartoon and post a two slide comic (cover plus six panels) that pokes fun at the safety side of aesthetics.</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* Controls */}
        <div className="space-y-7">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Choose the clinician</h2>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a clinician..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {clinicianReady && (
              <div className="flex items-center gap-2 text-xs text-emerald-400"><Check className="w-3.5 h-3.5" /> Cartoon character saved for {clientName}</div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Make their cartoon</h2>
            <p className="text-xs text-muted-foreground">One clear photo of their face. This is done once per clinician, then every comic is free and instant.</p>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) pickPhoto(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors"
            >
              {photoPreview
                ? <img src={photoPreview} alt="" className="w-16 h-16 rounded-lg object-cover" />
                : <Upload className="w-6 h-6 text-muted-foreground" />}
              <p className="text-sm text-muted-foreground">{photo ? "Photo loaded. Click to change." : "Click or drop a photo"}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) pickPhoto(e.target.files[0]); e.target.value = ""; }} />
            <div className="space-y-1">
              <Label className="text-xs">Uniform colour</Label>
              <Input value={uniform} onChange={(e) => setUniform(e.target.value)} className="h-8 text-sm" />
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>The clinician knows they are being turned into a cartoon and is happy for it to go on their page.</span>
            </label>
            <Button onClick={makeClinician} disabled={!!busy} className="w-full">
              {busy === "clinician" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Working"}</> : <><Sparkles className="w-4 h-4 mr-2" />{clinicianReady ? "Redo their cartoon" : "Make their cartoon"}</>}
            </Button>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Patient cast</h2>
            <p className="text-xs text-muted-foreground">Shared by every clinic. Make them once. Comics rotate through whoever is ready.</p>
            <div className="space-y-1.5">
              {PATIENTS.map((p) => {
                const ready = !!store.patients[p.id];
                const working = busy === p.id;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>
                    </div>
                    <Button size="sm" variant={ready ? "outline" : "default"} disabled={!!busy} onClick={() => makePatient(p.id)}>
                      {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ready ? <RefreshCcw className="w-3.5 h-3.5" /> : "Make"}
                    </Button>
                  </div>
                );
              })}
            </div>
            {busy && busy !== "clinician" && <p className="text-xs text-muted-foreground">{progress}</p>}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">4. Pick a conversation</h2>
            <Input placeholder="Search the 40..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border/30 divide-y divide-border/20">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => setConvId(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 ${c.id === conv.id ? "bg-muted/60 font-medium" : ""}`}>
                  <span className="text-muted-foreground mr-2">{COMIC_CONVERSATIONS.indexOf(c) + 1}.</span>{c.title}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Rotate through the cast</SelectItem>
                  {PATIENTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{store.patients[p.id] ? "" : " (not made yet)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Small footer line (optional)</Label>
              <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="@yourclinic" className="h-8 text-sm" />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">5. Name the comic</h2>
            <p className="text-xs text-muted-foreground">The cover slide. Pick a title, shuffle for a surprise, or type your own.</p>
            <div className="space-y-1">
              <Label className="text-xs">Clinic name (used in titles)</Label>
              <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder={clientName || "The Clinic"} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <div className="flex gap-2">
                <Select value={String(titleIdx)} onValueChange={(v) => { setCustomTitle(""); setTitleIdx(Number(v)); }}>
                  <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMIC_TITLES.map((t, i) => <SelectItem key={t} value={String(i)}>{fillTitle(t, clientName, clinicName)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={shuffleTitle} title="Shuffle"><Shuffle className="w-3.5 h-3.5" /></Button>
              </div>
              <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Or type your own title" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Strapline</Label>
                <Select value={strapline} onValueChange={setStrapline}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMIC_STRAPLINES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issue</Label>
                <Select value={issue} onValueChange={setIssue}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMIC_ISSUES.map((n) => <SelectItem key={n} value={n}>No. {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        {/* Preview */}
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-base">{convIndex + 1}. {conv.title}</h2>
              {!clinicianReady && <p className="text-xs text-amber-400 mt-0.5">Stand-in characters are showing until you make the cartoon.</p>}
            </div>
            <Button onClick={downloadBoth}><Download className="w-4 h-4 mr-2" />Download both slides</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Slide 1: the cover</p>
              <canvas ref={c0} width={COMIC_W} height={COMIC_H} className="w-full h-auto rounded-lg border border-border/30" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Slide 2: the six panels</p>
              <canvas ref={c1} width={COMIC_W} height={COMIC_H} className="w-full h-auto rounded-lg border border-border/30" />
            </div>
          </div>

          <section className="space-y-2 rounded-xl border border-border/30 p-4">
            <h2 className="font-semibold text-base">Caption</h2>
            <div className="flex items-center gap-2">
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-8 text-sm w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Feral, savage, sarcastic</SelectItem>
                  <SelectItem value="1">Northern grit</SelectItem>
                  <SelectItem value="3">Funny and blunt</SelectItem>
                  <SelectItem value="4">Professional with personality</SelectItem>
                  <SelectItem value="2">Storyteller, whimsical</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={writeCaption} disabled={writing}>
                {writing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4 mr-2" />Write caption</>}
              </Button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={9}
              placeholder="The caption appears here. Edit it however you like."
              className="w-full rounded-lg border border-border/30 bg-background p-3 text-sm"
            />
            <Button size="sm" variant="outline" disabled={!caption}
              onClick={() => { navigator.clipboard.writeText(caption).then(() => toast.success("Copied")); }}>
              <Copy className="w-4 h-4 mr-2" />Copy caption
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
