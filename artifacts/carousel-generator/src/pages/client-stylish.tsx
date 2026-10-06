import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { usePresets } from "@/lib/use-presets";
import { authHeaders } from "@/lib/use-approval";
import ApprovedImagesPicker from "@/components/approved-images-picker";

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
// The eight Halloween ideas. Up to three can be added to a pack, each with its own photo preset.
const HALLOWEEN_IDEAS = [
  { id: "hl-01", title: "Ghost stories from the treatment room" },
  { id: "hl-02", title: "Halloween 1992" },
  { id: "hl-03", title: "Things scarier than Halloween" },
  { id: "hl-04", title: "Which Halloween film is your perimenopause?" },
  { id: "hl-05", title: "The witch's cauldron (reading a skincare label)" },
  { id: "hl-06", title: "Carve the pumpkin with a plan (first consultation)" },
  { id: "hl-07", title: "Sheet mask Sunday looks like Scream" },
  { id: "hl-08", title: "The face behind the costume" },
];
const BASE_SLOTS = Array.from({ length: 10 }, (_, i) => [
  { id: `au-${pad(i + 1)}`, label: `Autumn ${i + 1}` },
  { id: `ww-${pad(i + 1)}`, label: `Winter ${i + 1}` },
]).flat();

// The pack repeats treatment, funny, things that, shareable, mix four times.
const ROW_GROUPS = Array.from({ length: 23 }, (_, i) => i >= 20 ? "Halloween" : ["Treatment", "Funny", "Things that", "Shareable", "Mix"][i % 5]);

type CardStatus = "idle" | "generating" | "success" | "failed" | "rate-limited";
type Card = { scenarioId: string; status: CardStatus; outputImageUrl?: string; failureReason?: string };
type CopyRow = { headline: string; subtitle: string; text1: string; text2: string; text3: string; cta: string };
type CopyState = "idle" | "writing" | "done" | "error";

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

export default function ClientStylish() {
  const [, setLocation] = useLocation();

  const [clientName, setClientName] = useState("");
  const [website, setWebsite] = useState("");
  const [october, setOctober] = useState(false);
  const [spot, setSpot] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // Option to skip the photoshoot and use photos already in the client's approved images.
  // Halloween posts picked for this pack (up to 3). packHalloween is what the running pack was made with.
  const [halloweenPick, setHalloweenPick] = useState<string[]>([]);
  const [packHalloween, setPackHalloween] = useState<string[]>([]);
  const hallRef = useRef<string[]>([]);
  const slots = [...BASE_SLOTS, ...packHalloween.map(id => ({ id, label: `Halloween ${HALLOWEEN_IDEAS.findIndex(h => h.id === id) + 1}` }))];
  const expected = 20 + packHalloween.length;
  const [useApproved, setUseApproved] = useState(false);
  const [approvedFiles, setApprovedFiles] = useState<File[]>([]);
  const [fromApproved, setFromApproved] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Photos uploaded from the computer are filed into the client's library by Stylish, approved ones are not filed twice.
  const uploadedSet = useRef<WeakSet<File>>(new WeakSet());
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [treatments, setTreatments] = useState(["", "", ""]);
  const [tone, setTone] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [topText, setTopText] = useState("");
  const [shots, setShots] = useState<File[]>([]);
  const { presets } = usePresets();
  // Picking a saved client always brings forward their website, area and brand colour from their profile,
  // replacing whatever the previous client had. Typing a different website afterwards is still allowed.
  const matchedPreset = useMemo(() => {
    const n = clientName.trim().toLowerCase();
    if (!n) return null;
    return presets.find(p => p.name.trim().toLowerCase() === n)
      ?? (n.length >= 4 ? presets.find(p => { const pn = p.name.trim().toLowerCase(); return pn.length >= 4 && (pn.includes(n) || n.includes(pn)); }) : undefined)
      ?? null;
  }, [clientName, presets]);
  const lastPresetId = useRef<number | null>(null);
  useEffect(() => {
    if (!matchedPreset) { lastPresetId.current = null; return; }
    if (lastPresetId.current === matchedPreset.id) return;
    lastPresetId.current = matchedPreset.id;
    setWebsite(matchedPreset.websiteUrl?.trim() ?? "");
    setArea(matchedPreset.seoArea?.trim() ?? "");
    setSpot(/^#?[0-9a-f]{6}$/i.test((matchedPreset.accentColor ?? "").trim()) ? (matchedPreset.accentColor.startsWith("#") ? matchedPreset.accentColor : `#${matchedPreset.accentColor}`) : "");
  }, [matchedPreset]);
  const brandSwatches = matchedPreset
    ? Array.from(new Set([matchedPreset.accentColor, matchedPreset.pageColor, matchedPreset.overlayColor, matchedPreset.cornerColor]
        .map(c => (c ?? "").trim()).filter(c => /^#?[0-9a-f]{6}$/i.test(c)).map(c => (c.startsWith("#") ? c : `#${c}`).toLowerCase())))
    : [];
  const [topCount, setTopCount] = useState(0);
  const [topSource, setTopSource] = useState("none");
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
  const [siteReason, setSiteReason] = useState<string | null>(null);
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

  // Polls the photo job and folds its cards into the 20 slots.
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
      hallRef.current.forEach(h => fd.append("halloween", h));
      fd.append("notes", notes);
      fd.append("topPosts", topText);
      shots.forEach(f => fd.append("screenshots", f));
      const r = await fetch(`${BASE}api/client-stylish/copy`, { method: "POST", body: fd });
      const data = (await r.json()) as { rows?: CopyRow[]; csv?: string; siteFound?: boolean; siteReason?: string | null; topPostsCount?: number; topPostsSource?: string; error?: string };
      if (!r.ok || !data.rows || !data.csv) throw new Error(data.error || "The copy did not come back");
      setRows(data.rows);
      setCsv(data.csv);
      setSiteFound(data.siteFound !== false);
      setSiteReason(data.siteReason ?? null);
      setTopCount(data.topPostsCount ?? 0);
      setTopSource(data.topPostsSource ?? "none");
      setCopyState("done");
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "The copy did not come back");
      setCopyState("error");
    }
  }, [clientName, website, treatments, tone, notes, topText, shots]);

  const canStart =
    clientName.trim() && website.trim() && (useApproved ? approvedFiles.length > 0 : photo) && treatments.every(t => t.trim()) && tone && !busy;

  const handleStart = async () => {
    if (!canStart || (!useApproved && !photo)) return;
    setBusy(true);
    setStarted(true);
    setPackName(safeName(clientName));
    setRows([]);
    setCsv("");
    setJobIds([]);
    hallRef.current = halloweenPick;
    setPackHalloween(halloweenPick);
    setFromApproved(useApproved);
    if (useApproved) {
      // No photoshoot: the chosen approved images fill the slots in the order they were picked.
      setCards(Object.fromEntries([...BASE_SLOTS, ...halloweenPick.map(id => ({ id }))].map((s, i) => [s.id, approvedFiles[i]
        ? { scenarioId: s.id, status: "success" as CardStatus, outputImageUrl: URL.createObjectURL(approvedFiles[i]) }
        : { scenarioId: s.id, status: "idle" as CardStatus }])));
      setJobIds(["approved"]);
      void writeCopy();
      setBusy(false);
      return;
    }
    setCards(Object.fromEntries([...BASE_SLOTS, ...halloweenPick.map(id => ({ id }))].map(s => [s.id, { scenarioId: s.id, status: "idle" as CardStatus }])));
    // The copy writes while the photos are being made.
    void writeCopy();
    try {
      setStage("Uploading the photo");
      const fd = new FormData();
      fd.append("photo", photo as File);
      fd.append("clientName", clientName.trim());
      const up = await fetch(`${BASE}api/ai-portrait/source`, { method: "POST", body: fd });
      const row = (await up.json()) as { id?: number; error?: string };
      if (!up.ok || !row.id) throw new Error(row.error || "The photo did not upload");
      sourcePhotoId.current = row.id;
      setStage(`Making the ${20 + halloweenPick.length} photos`);
      await startPhotoJob([...BASE_SLOTS, ...halloweenPick.map(id => ({ id }))].map(s => s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setStage("");
    } finally {
      setBusy(false);
    }
  };

  const failedIds = slots.filter(s => cards[s.id]?.status === "failed").map(s => s.id);
  const doneCount = slots.filter(s => cards[s.id]?.status === "success").length;
  const photosRunning = !!jobId || busy;
  const totalPhotos = fromApproved ? Math.min(approvedFiles.length, slots.length) : slots.length;
  const photosFinished = started && !busy && !jobId && jobIds.length > 0 && doneCount + failedIds.length === totalPhotos;
  const packReady = photosFinished && copyState === "done" && doneCount > 0;

  // Every finished photo is filed straight into the client's approved images, once each, with no
  // button to press. Reruns of failed photos are picked up the same way.
  const savedIds = useRef<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveNew = useCallback(async () => {
    const fresh = slots.filter(s => cards[s.id]?.status === "success" && cards[s.id]?.outputImageUrl && !savedIds.current.has(s.id));
    if (!fresh.length || !clientName.trim()) return;
    fresh.forEach(s => savedIds.current.add(s.id));
    try {
      const r = await fetch(`${BASE}api/approval/batches`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: `${packName || safeName(clientName)} Autumn and Winter ${new Date().toLocaleDateString("en-GB")}`,
          clientName: clientName.trim(),
          imageUrls: fresh.map(s => cards[s.id]!.outputImageUrl!),
          alreadyApproved: true,
        }),
      });
      if (!r.ok) throw new Error("save failed");
      setSavedCount(n => n + fresh.length);
      setSaveFailed(false);
      toast.success(`Saved ${fresh.length} photo${fresh.length !== 1 ? "s" : ""} to ${clientName.trim()}'s approved images`);
    } catch {
      fresh.forEach(s => savedIds.current.delete(s.id));
      setSaveFailed(true);
    }
  }, [cards, clientName, packName]);

  useEffect(() => {
    if (!started || jobId || fromApproved) return;
    void saveNew();
  }, [started, jobId, cards, saveNew, fromApproved]);

  const sendAllToCanva = async () => {
    setBusy(true);
    const t = toast.loading("Sending the photos to Canva");
    try {
      const st = await fetch(`${BASE}api/canva/status`);
      const sd = (await st.json()) as { connected?: boolean };
      if (!sd.connected) throw new Error("Canva is not connected yet. Connect it from the Canva button in the AI Photo Studio first.");
      let n = 0;
      for (const slot of slots) {
        const c = cards[slot.id];
        if (c?.status !== "success" || !c.outputImageUrl) continue;
        const url = c.outputImageUrl.startsWith("http") ? c.outputImageUrl : `${window.location.origin}${c.outputImageUrl}`;
        const r = await fetch(`${BASE}api/canva/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url, name: `${packName} Stylish ${pad(slots.indexOf(slot) + 1)} ${slot.label}` }),
        });
        if (!r.ok) throw new Error(`${slot.label} would not go to Canva`);
        n++;
        toast.loading(`Sent ${n} of ${doneCount} to Canva`, { id: t });
      }
      toast.success(`${n} photos sent to Canva, look in your uploads`, { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Canva did not take them", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const rerunFailed = async () => {
    if (!failedIds.length) return;
    try {
      await startPhotoJob(failedIds);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The rerun did not start");
    }
  };

  const slotFileName = (slotId: string, mime: string) => {
    const idx = slots.findIndex(s => s.id === slotId);
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    // The approved- start tells Stylish these are already in the client's library, so it does not file them twice.
    if (fromApproved && !uploadedSet.current.has(approvedFiles[idx])) return `approved-${pad(idx + 1)}-${packName}.${ext}`;
    if (fromApproved) return `${packName} Stylish ${pad(idx + 1)} photo.${ext}`;
    // The running number keeps autumn, winter, autumn, winter in order if the photos are uploaded again.
    return `${packName} Stylish ${pad(idx + 1)} ${slots[idx].label}.${ext}`;
  };

  const collectImages = async (): Promise<File[]> => {
    const files: File[] = [];
    for (const slot of slots) {
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
      const ok = await setStylishHandoff({ files, csv, csvName: `${packName} Stylish.csv`, clientName: clientName.trim(), location: area.trim() || undefined, intent, october, spot: spot.trim() || undefined });
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
              One click for a whole client pack. I make the 20 photos (10 Winter Woolies, 10 Autumn) and write the 20 row CSV, then it all drops straight into Stylish.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Client</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} list="client-names" placeholder="e.g. Teviot Dental Face" disabled={started && busy} />
            <datalist id="client-names">{presets.map(p => <option key={p.id} value={p.name} />)}</datalist>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.theirclinic.co.uk" disabled={started && busy} />
            <p className="text-xs text-muted-foreground">{matchedPreset?.websiteUrl ? "Brought forward from their client profile. " : ""}The treatment posts take their details from here.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Clinic area <span className="text-muted-foreground font-normal">(for local SEO in the captions)</span></Label>
            <Input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Harrogate, North Yorkshire" disabled={started && busy} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Brand colour</Label>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-md border border-border/50 shrink-0" style={{ background: /^#?[0-9a-f]{6}$/i.test(spot.trim()) ? (spot.trim().startsWith("#") ? spot.trim() : `#${spot.trim()}`) : "transparent" }} />
              <Input className="h-8 w-32" value={spot} onChange={e => setSpot(e.target.value)} placeholder="#2c9a8f" />
              {brandSwatches.map(c => (
                <button key={c} type="button" title={c} onClick={() => setSpot(c)} className="h-6 w-6 rounded-full border border-border/50" style={{ background: c }} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{matchedPreset ? "Brought forward from their client profile. Tap another swatch or type a hex to change it." : "Pick a saved client and their colour appears here."} It colours the October 26 covers.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Photos</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setUseApproved(false)} className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${!useApproved ? "border-sky-500/60 bg-sky-500/10" : "border-border/40 hover:border-border/70"}`}>
                Make new photos<span className="block text-xs text-muted-foreground">20 autumn and winter photos from one picture</span>
              </button>
              <button type="button" onClick={() => setUseApproved(true)} className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${useApproved ? "border-sky-500/60 bg-sky-500/10" : "border-border/40 hover:border-border/70"}`}>
                Use my own photos<span className="block text-xs text-muted-foreground">Approved images or upload</span>
              </button>
            </div>
            {useApproved && (
              <div className="space-y-2">
                <ApprovedImagesPicker
                  clientName={clientName.trim()}
                  mode="multi"
                  skipBackgroundRemoval
                  large
                  label="Choose approved images"
                  onAddImages={(files) => setApprovedFiles(prev => [...prev, ...files].slice(0, 20 + halloweenPick.length))}
                />
                <input ref={uploadRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = Array.from(e.target.files ?? []).filter(x => x.type.startsWith("image/")); f.forEach(x => uploadedSet.current.add(x)); if (f.length) setApprovedFiles(prev => [...prev, ...f].slice(0, 20 + halloweenPick.length)); e.target.value = ""; }} />
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => uploadRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Upload photos from my computer
                </Button>
                {approvedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{approvedFiles.length} chosen, up to 20. They go in the order you picked them, one per post.</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {approvedFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="relative aspect-[3/4] rounded overflow-hidden border border-border/30">
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setApprovedFiles(prev => prev.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setApprovedFiles([])} className="text-xs text-muted-foreground underline">Clear them all</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!useApproved && (
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
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">3 treatments to promote this month</Label>
            {treatments.map((t, i) => (
              <Input key={i} value={t} onChange={e => setTreatments(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Treatment ${i + 1}`} />
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Halloween posts <span className="text-muted-foreground font-normal">(optional, pick up to 3)</span></Label>
            <div className="space-y-1.5">
              {HALLOWEEN_IDEAS.map(h => {
                const on = halloweenPick.includes(h.id);
                const full = !on && halloweenPick.length >= 3;
                return (
                  <label key={h.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${on ? "border-orange-500/60 bg-orange-500/10" : "border-border/40"} ${full ? "opacity-40" : "cursor-pointer hover:border-border/70"}`}>
                    <input type="checkbox" checked={on} disabled={full} className="accent-orange-500"
                      onChange={() => setHalloweenPick(prev => on ? prev.filter(x => x !== h.id) : [...prev, h.id])} />
                    {h.title}
                  </label>
                );
              })}
            </div>
            {halloweenPick.length > 0 && <p className="text-xs text-muted-foreground">Each one gets its own Halloween photo and is written in the clinic's style, as posts 21 onwards.</p>}
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

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">About the clinician <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="A few words on who they are, so the voice fits them." />
          </div>

          <div className="sticky bottom-0 z-10 -mx-1 space-y-2 bg-background px-1 pb-2 pt-3 border-t border-border/40">
          <Button onClick={handleStart} disabled={!canStart} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Palette className="w-4 h-4 mr-2" />}
            {started ? "Start again" : "Make the pack"}
          </Button>
          {!canStart && !busy && (
            <p className="text-xs text-muted-foreground">I need the client, website, photos, all 3 treatments and a writing style.</p>
          )}
          </div>
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
                  <span>{stage && !photosFinished ? stage : fromApproved ? `Using ${doneCount} approved photos` : `Photos: ${doneCount} of ${expected} made`}</span>
                </div>
                <span className="text-border/60">·</span>
                <div className="flex items-center gap-2 text-sm">
                  {copyState === "writing" && <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
                  {copyState === "done" && <Check className="w-4 h-4 text-sky-400" />}
                  {copyState === "error" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  <span>
                    {copyState === "writing" && `Writing the ${expected} posts`}
                    {copyState === "done" && (topCount > 0 ? `${expected} posts written, modelled on ${topCount} top posts${topSource === "instagram" ? " from their Instagram" : ""}` : `${expected} posts written, but I could not reach their Instagram, so it is not modelled on their top posts`)}
                    {copyState === "error" && copyError}
                  </span>
                  {copyState === "error" && (
                    <Button size="sm" variant="outline" onClick={writeCopy}><RotateCw className="w-3.5 h-3.5 mr-1.5" />Try the copy again</Button>
                  )}
                </div>
              </div>

              {copyState === "done" && !siteFound && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm text-yellow-200/90">
                  {siteReason === "blocked" && "Their website refused to let me read it (many hosts block automated visitors), so the treatment posts are general. Add anything specific in the clinician notes."}
                  {siteReason === "notfound" && "That address gave a page not found, so the treatment posts are general. Check the website on their client details."}
                  {siteReason === "empty" && "Their site loads its words in the browser, so there was almost nothing for me to read. The treatment posts are general. Add specifics in the clinician notes."}
                  {siteReason === "unsafe" && "I am not allowed to read that address. Check the website on their client details."}
                  {siteReason !== "blocked" && siteReason !== "notfound" && siteReason !== "empty" && siteReason !== "unsafe" && "I could not reach that website, so the treatment posts are general. Check the address and press Try the copy again if you want details from the site."}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-3">Photos</h3>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <Button onClick={handleDownloadImages} disabled={doneCount === 0 || busy}>
                    <Download className="w-4 h-4 mr-2" />Download all
                  </Button>
                  <Button variant="outline" onClick={sendAllToCanva} disabled={doneCount === 0 || busy || fromApproved} title={fromApproved ? "Approved images can be sent to Canva from the approved images screen" : undefined}>
                    <Upload className="w-4 h-4 mr-2" />Share to Canva
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCsv} disabled={!csv || copyState === "writing"}>
                    <Download className="w-4 h-4 mr-2" />Download CSV
                  </Button>
                  <Button variant="outline" onClick={writeCopy} disabled={copyState === "writing" || busy} title="Writes a brand new set of posts, replacing the current ones">
                    {copyState === "writing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}Rerun CSV
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {fromApproved ? "These came from their approved images, so nothing new to save." : saveFailed ? "The save to approved images did not go through, I will try again as photos finish." : savedCount > 0 ? `${savedCount} saved to their approved images` : "Photos save to their approved images as they finish."}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {slots.map(s => {
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
                        <p className="text-[18px] text-center text-muted-foreground">{s.label}</p>
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

              {rows.length === expected && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">The {expected} posts</h3>
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

              <div className="rounded-lg border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={october} onChange={e => setOctober(e.target.checked)} />
                  Use the October 26 covers
                </label>
                <p className="text-xs text-muted-foreground">Each post gets one of the October 26 covers in the clinic's colour and fonts, ready to check in Stylish. Slides 2 to 5 stay in the usual Stylish look.</p>
                {october && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Spot colour (from their brand colour above)</Label>
                    <Input className="w-32 h-8" value={spot} onChange={e => setSpot(e.target.value)} placeholder="#2c9a8f" />
                  </div>
                )}
              </div>

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
                  <Download className="w-4 h-4 mr-2" />Download all images
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
