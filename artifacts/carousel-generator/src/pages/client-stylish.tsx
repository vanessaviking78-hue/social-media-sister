import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2, Upload, Check, AlertTriangle, Download, Palette, RotateCw, X, Film, Sparkles } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setStylishHandoff } from "@/lib/stylish-handoff";

const BASE = import.meta.env.BASE_URL;

const TONES = [
  { value: "1", label: "Northern grit Vanessa style" },
  { value: "2", label: "Bruce Springsteen storytelling, whimsical" },
  { value: "3", label: "Dawn French, funny and blunt" },
  { value: "4", label: "Professional but with personality" },
  { value: "5", label: "Feral, savage, sarcastic" },
];

const pad = (n: number) => String(n).padStart(2, "0");
// Autumn and winter alternate, so the photos run autumn, winter, autumn, winter and so on.
const SLOTS = Array.from({ length: 8 }, (_, i) => [
  { id: `au-${pad(i + 1)}`, label: `Autumn ${i + 1}` },
  { id: `ww-${pad(i + 1)}`, label: `Winter ${i + 1}` },
]).flat();

// The pack repeats funny, treatment, things that, shareable four times.
const ROW_GROUPS = Array.from({ length: 16 }, (_, i) => ["Funny", "Treatment", "Things that", "Shareable"][i % 4]);

type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";
type Card = { scenarioId: string; status: CardStatus; outputImageUrl?: string; failureReason?: string };
type CopyRow = { headline: string; subtitle: string; text1: string; text2: string; text3: string; cta: string };
type CopyState = "idle" | "writing" | "done" | "error";

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

export default function ClientStylish() {
  const [, setLocation] = useLocation();

  const [clientName, setClientName] = useState("");
  const [website, setWebsite] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [treatments, setTreatments] = useState(["", "", ""]);
  const [tone, setTone] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [topText, setTopText] = useState("");
  const [shots, setShots] = useState<File[]>([]);
  const [topCount, setTopCount] = useState(0);
  const shotRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [copyError, setCopyError] = useState("");
  const [rows, setRows] = useState<CopyRow[]>([]);
  const [csv, setCsv] = useState("");
  const [siteFound, setSiteFound] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [packName, setPackName] = useState("");

  const sourcePhotoId = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Polls the photo job and folds its cards into the 16 slots.
  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}api/ai-portrait/jobs/${jobId}/status`);
        if (!r.ok) return;
        const data = (await r.json()) as { cards: Card[] };
        setCards(prev => {
          const next = { ...prev };
          for (const c of data.cards) next[c.scenarioId] = c;
          return next;
        });
        const done = data.cards.every(c => c.status === "success" || c.status === "failed");
        if (done) { clearInterval(timer); setJobId(null); }
      } catch { /* try again on the next tick */ }
    }, 2000);
    return () => clearInterval(timer);
  }, [jobId]);

  const startPhotoJob = useCallback(async (ids: string[]) => {
    if (!sourcePhotoId.current) return;
    setCards(prev => {
      const next = { ...prev };
      for (const id of ids) next[id] = { scenarioId: id, status: "idle" };
      return next;
    });
    const r = await fetch(`${BASE}api/ai-portrait/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePhotoId: sourcePhotoId.current,
        clientName,
        scenarios: ids.map(id => ({ id, aspectRatio: "3:4" })),
      }),
    });
    const data = (await r.json()) as { jobId?: string; error?: string };
    if (!r.ok || !data.jobId) throw new Error(data.error || "The photos did not start");
    setJobIds(prev => [...prev, data.jobId!]);
    setJobId(data.jobId);
  }, [clientName]);

  const writeCopy = useCallback(async () => {
    setCopyState("writing");
    setCopyError("");
    try {
      const fd = new FormData();
      fd.append("clientName", clientName.trim());
      fd.append("website", website.trim());
      treatments.forEach(t => fd.append("treatments", t.trim()));
      fd.append("tone", tone);
      fd.append("notes", notes);
      fd.append("topPosts", topText);
      shots.forEach(f => fd.append("screenshots", f));
      const r = await fetch(`${BASE}api/client-stylish/copy`, { method: "POST", body: fd });
      const data = (await r.json()) as { rows?: CopyRow[]; csv?: string; siteFound?: boolean; topPostsCount?: number; error?: string };
      if (!r.ok || !data.rows || !data.csv) throw new Error(data.error || "The copy did not come back");
      setRows(data.rows);
      setCsv(data.csv);
      setSiteFound(data.siteFound !== false);
      setTopCount(data.topPostsCount ?? 0);
      setCopyState("done");
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "The copy did not come back");
      setCopyState("error");
    }
  }, [clientName, website, treatments, tone, notes, topText, shots]);

  const canStart =
    clientName.trim() && website.trim() && photo && treatments.every(t => t.trim()) && tone && !busy;

  const handleStart = async () => {
    if (!canStart || !photo) return;
    setBusy(true);
    setStarted(true);
    setPackName(safeName(clientName));
    setRows([]);
    setCsv("");
    setJobIds([]);
    setCards(Object.fromEntries(SLOTS.map(s => [s.id, { scenarioId: s.id, status: "idle" as CardStatus }])));
    // The copy writes while the photos are being made.
    void writeCopy();
    try {
      setStage("Uploading the photo");
      const fd = new FormData();
      fd.append("photo", photo);
      fd.append("clientName", clientName.trim());
      const up = await fetch(`${BASE}api/ai-portrait/source`, { method: "POST", body: fd });
      const row = (await up.json()) as { id?: number; error?: string };
      if (!up.ok || !row.id) throw new Error(row.error || "The photo did not upload");
      sourcePhotoId.current = row.id;
      setStage("Making the 16 photos");
      await startPhotoJob(SLOTS.map(s => s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setStage("");
    } finally {
      setBusy(false);
    }
  };

  const failedIds = SLOTS.filter(s => cards[s.id]?.status === "failed").map(s => s.id);
  const doneCount = SLOTS.filter(s => cards[s.id]?.status === "success").length;
  const photosRunning = !!jobId || busy;
  const photosFinished = started && !busy && !jobId && jobIds.length > 0 && doneCount + failedIds.length === 16;
  const packReady = photosFinished && copyState === "done" && doneCount > 0;

  const rerunFailed = async () => {
    if (!failedIds.length) return;
    try {
      await startPhotoJob(failedIds);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The rerun did not start");
    }
  };

  const slotFileName = (slotId: string, mime: string) => {
    const idx = SLOTS.findIndex(s => s.id === slotId);
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    // The running number keeps autumn, winter, autumn, winter in order if the photos are uploaded again.
    return `${packName} Stylish ${pad(idx + 1)} ${SLOTS[idx].label}.${ext}`;
  };

  const collectImages = async (): Promise<File[]> => {
    const files: File[] = [];
    for (const slot of SLOTS) {
      const c = cards[slot.id];
      if (c?.status !== "success" || !c.outputImageUrl) continue;
      const r = await fetch(c.outputImageUrl);
      if (!r.ok) throw new Error(`${slot.label} would not download`);
      const blob = await r.blob();
      files.push(new File([blob], slotFileName(slot.id, blob.type), { type: blob.type || "image/png" }));
    }
    return files;
  };

  const handleOpenInStylish = async (intent?: "reels" | "auto") => {
    setBusy(true);
    try {
      const files = await collectImages();
      const ok = await setStylishHandoff({ files, csv, csvName: `${packName} Stylish.csv`, clientName: clientName.trim(), location: area.trim() || undefined, intent });
      if (!ok) throw new Error("Stylish could not be loaded from here, please download instead");
      setLocation("/stylish");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open Stylish");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadImages = async () => {
    setBusy(true);
    try {
      const files = await collectImages();
      const zip = new JSZip();
      const folder = zip.folder(`${packName} Stylish`)!;
      for (const f of files) folder.file(f.name, f);
      saveAs(await zip.generateAsync({ type: "blob" }), `${packName} Stylish.zip`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The download failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCsv = () => {
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${packName} Stylish.csv`);
  };

  const handlePhotoFiles = (files: FileList | File[]) => {
    const f = Array.from(files).find(x => x.type.startsWith("image/"));
    if (!f) { toast.error("Please choose an image"); return; }
    setPhoto(f);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">Client Stylish</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* ------------------------------ left: the questions ------------------------------ */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto pr-1">
          <div>
            <h2 className="text-2xl font-bold mb-1">Client Stylish</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              One click for a whole client pack. I make the 16 photos (8 Winter Woolies, 8 Autumn) and write the 16 row CSV, then it all drops straight into Stylish.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Client</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Teviot Dental Face" disabled={started && busy} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.theirclinic.co.uk" disabled={started && busy} />
            <p className="text-xs text-muted-foreground">The treatment posts take their details from here.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Clinic area <span className="text-muted-foreground font-normal">(for local SEO in the captions)</span></Label>
            <Input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Harrogate, North Yorkshire" disabled={started && busy} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Clinician photo</Label>
            <div
              onDrop={e => { e.preventDefault(); setDrag(false); handlePhotoFiles(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-3 transition-colors ${drag ? "border-sky-500/60 bg-sky-500/5" : photo ? "border-sky-500/40 bg-sky-500/5" : "border-border/40 hover:border-border/60"}`}
            >
              {photoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={photoPreview} alt="Clinician" className="w-16 h-20 object-cover rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sky-400 break-all">{photo?.name}</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setPhoto(null); }} className="text-muted-foreground hover:text-foreground" aria-label="Remove photo">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-4 text-center">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop the photo here or click to browse</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { if (e.target.files) handlePhotoFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">3 treatments to promote this month</Label>
            {treatments.map((t, i) => (
              <Input key={i} value={t} onChange={e => setTreatments(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Treatment ${i + 1}`} />
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Writing style</Label>
            <div className="space-y-1.5">
              {TONES.map(t => (
                <label key={t.value} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${tone === t.value ? "border-sky-500/60 bg-sky-500/10" : "border-border/40 hover:border-border/70"}`}>
                  <input type="radio" name="tone" value={t.value} checked={tone === t.value} onChange={() => setTone(t.value)} className="accent-sky-500" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Their top performing posts <span className="text-muted-foreground font-normal">(recommended)</span></Label>
            <p className="text-xs text-muted-foreground">Screenshot their top 10 from Insights, or paste the opening lines. I write the 16 posts in the same family as the winners.</p>
            <div className="flex flex-wrap items-center gap-2">
              {shots.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/5 px-2 py-1 text-xs">
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button onClick={() => setShots(prev => prev.filter((_, j) => j !== i))} aria-label="Remove screenshot" className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {shots.length < 3 && (
                <Button type="button" size="sm" variant="outline" onClick={() => shotRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Add screenshot
                </Button>
              )}
            </div>
            <input ref={shotRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => {
                const picked = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/"));
                setShots(prev => [...prev, ...picked].slice(0, 3));
                e.target.value = "";
              }} />
            <Textarea value={topText} onChange={e => setTopText(e.target.value)} rows={4} placeholder="Or paste their best posts here, one per line, with the likes if you have them." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">About the clinician <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="A few words on who they are, so the voice fits them." />
          </div>

          <Button onClick={handleStart} disabled={!canStart} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}
            {started ? "Start again" : "Make the pack"}
          </Button>
          {!canStart && !busy && (
            <p className="text-xs text-muted-foreground">I need the client, website, photo, all 3 treatments and a writing style.</p>
          )}
        </aside>

        {/* ------------------------------ right: the pack ------------------------------ */}
        <section className="space-y-8 min-w-0">
          {!started && (
            <div className="rounded-lg border border-border/30 p-8 text-center text-muted-foreground text-sm">
              Fill in the questions on the left and press Make the pack. The photos take a few minutes, and the copy is written while you wait.
            </div>
          )}

          {started && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {photosRunning || busy ? <Loader2 className="w-4 h-4 animate-spin text-sky-400" /> : <Check className="w-4 h-4 text-sky-400" />}
                  <span>{stage && !photosFinished ? stage : `Photos: ${doneCount} of 16 made`}</span>
                </div>
                <span className="text-border/60">·</span>
                <div className="flex items-center gap-2 text-sm">
                  {copyState === "writing" && <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
                  {copyState === "done" && <Check className="w-4 h-4 text-sky-400" />}
                  {copyState === "error" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  <span>
                    {copyState === "writing" && "Writing the 16 posts"}
                    {copyState === "done" && (topCount > 0 ? `16 posts written, modelled on ${topCount} top posts` : "16 posts written")}
                    {copyState === "error" && copyError}
                  </span>
                  {copyState === "error" && (
                    <Button size="sm" variant="outline" onClick={writeCopy}><RotateCw className="w-3.5 h-3.5 mr-1.5" />Try the copy again</Button>
                  )}
                </div>
              </div>

              {copyState === "done" && !siteFound && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm text-yellow-200/90">
                  I could not read that website, so the treatment posts are general. Check the address and press Try the copy again if you want details from the site.
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-3">Photos</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {SLOTS.map(s => {
                    const c = cards[s.id];
                    return (
                      <div key={s.id} className="space-y-1">
                        <div className="aspect-[3/4] rounded-md overflow-hidden border border-border/30 bg-muted/20 flex items-center justify-center">
                          {c?.status === "success" && c.outputImageUrl ? (
                            <img src={c.outputImageUrl} alt={s.label} className="w-full h-full object-cover" />
                          ) : c?.status === "failed" ? (
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          ) : (
                            <Loader2 className={`w-4 h-4 text-muted-foreground ${c?.status === "generating" ? "animate-spin" : "opacity-40"}`} />
                          )}
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground">{s.label}</p>
                      </div>
                    );
                  })}
                </div>
                {photosFinished && failedIds.length > 0 && (
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="text-destructive">{failedIds.length} would not make.</span>
                    <Button size="sm" variant="outline" onClick={rerunFailed}><RotateCw className="w-3.5 h-3.5 mr-1.5" />Rerun the failed ones</Button>
                  </div>
                )}
              </div>

              {rows.length === 16 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">The 16 posts</h3>
                  <div className="rounded-lg border border-border/30 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 font-medium">#</th>
                          <th className="text-left p-2 font-medium">Group</th>
                          <th className="text-left p-2 font-medium">Headline and subtitle</th>
                          <th className="text-left p-2 font-medium">Text 1</th>
                          <th className="text-left p-2 font-medium">Text 2</th>
                          <th className="text-left p-2 font-medium">Text 3</th>
                          <th className="text-left p-2 font-medium">CTA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-t border-border/20 align-top">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2 text-muted-foreground whitespace-nowrap">{ROW_GROUPS[i]}</td>
                            <td className="p-2 font-medium">{r.headline} {r.subtitle}</td>
                            <td className="p-2">{r.text1}</td>
                            <td className="p-2">{r.text2}</td>
                            <td className="p-2">{r.text3}</td>
                            <td className="p-2 text-sky-400">{r.cta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => handleOpenInStylish()} disabled={!packReady || busy}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}
                  Open in Stylish
                </Button>
                <Button variant="outline" onClick={() => handleOpenInStylish("auto")} disabled={!packReady || busy} title="Loads the pack in Stylish, writes the captions and the 7am story questions, and takes you to the schedule screen for one check">
                  <Sparkles className="w-4 h-4 mr-2" />Posts and stories in one go
                </Button>
                <Button variant="outline" onClick={() => handleOpenInStylish("reels")} disabled={!packReady || busy} title="Loads the pack in Stylish, ready to turn into reels or send to Magazine Flip">
                  <Film className="w-4 h-4 mr-2" />Open in Stylish and make reels
                </Button>
                <Button variant="outline" onClick={handleDownloadImages} disabled={doneCount === 0 || busy}>
                  <Download className="w-4 h-4 mr-2" />Download photos
                </Button>
                <Button variant="outline" onClick={handleDownloadCsv} disabled={!csv}>
                  <Download className="w-4 h-4 mr-2" />Download CSV
                </Button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
