import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Upload, Check, X, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL;

// The questions I ask about each client, so their photos, covers, stories and captions all sound like them.
export const QUESTIONS: { id: string; label: string; hint: string; long?: boolean }[] = [
  { id: "who", label: "Clinician name and clinic town", hint: "Who is in the photos, and where are they based?" },
  { id: "words", label: "Three words for their personality", hint: "Warm, dry, glamorous, straight talking..." },
  { id: "adore", label: "What do patients adore about them?", hint: "The thing people say in reviews.", long: true },
  { id: "colours", label: "Brand colours", hint: "Hex codes if known, or just describe them." },
  { id: "font", label: "Font vibe", hint: "Elegant serif, soft handwritten, clean modern or bold editorial." },
  { id: "patient", label: "Their ideal patient", hint: "Age, life stage, what she is like.", long: true },
  { id: "worries", label: "What does that patient worry about before booking?", hint: "Cost, looking done, pain, being judged...", long: true },
  { id: "treatments", label: "Signature treatments", hint: "The ones they want to be known for.", long: true },
  { id: "humour", label: "Their sense of humour", hint: "Dry, daft, warm or cheeky." },
  { id: "never", label: "Off limits", hint: "No teeth, no before and afters, no prices, topics to avoid...", long: true },
  { id: "links", label: "Website and Instagram handle", hint: "" },
  { id: "extra", label: "Anything else that makes them them", hint: "Pets, hobbies, local gossip, catchphrases.", long: true },
];

// Keeps the guide photo to a sensible size before it is saved.
export async function shrink(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/png");
}

export default function GettingToKnowYou() {
  const { presets } = usePresets();
  const [client, setClient] = useState("");
  const [typed, setTyped] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingReviews, setUploadingReviews] = useState(false);
  const [linking, setLinking] = useState(false);
  type Sub = { id: number; typedName: string; matchedName: string | null; answers: Record<string, string>; photoUrl: string | null; createdAt: string };
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subPick, setSubPick] = useState<Record<number, string>>({});
  const loadSubs = async () => {
    try { const r = await fetch(`${BASE}api/client-profile-submissions`); const d = await r.json(); setSubs(d.submissions ?? []); } catch { /* nothing waiting */ }
  };
  useEffect(() => { void loadSubs(); }, []);
  const copyShared = async () => {
    const url = `${window.location.origin}${BASE}know-me`.replace(/([^:]\/)\/+/g, "$1");
    try { await navigator.clipboard.writeText(url); toast.success("The one link for every client is copied. Send it to anyone.", { duration: 8000 }); }
    catch { window.prompt("Copy this link and send it to your clients", url); }
  };
  const acceptSub = async (s: Sub) => {
    const to = subPick[s.id] || s.matchedName || "";
    if (!to) { toast.error("Choose which client this belongs to first."); return; }
    const r = await fetch(`${BASE}api/client-profile-submissions/${s.id}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName: to }) });
    if (!r.ok) { toast.error("Could not save that one"); return; }
    toast.success(`Saved onto ${to}.`);
    void loadSubs(); void refreshList();
  };
  const dismissSub = async (s: Sub) => {
    await fetch(`${BASE}api/client-profile-submissions/${s.id}/dismiss`, { method: "POST" });
    void loadSubs();
  };
  // Screenshots of the client's reviews. Their wording shapes the copy, so they are kept with the profile.
  const reviewUrls: string[] = useMemo(() => { try { const v = JSON.parse(answers.reviewImages || "[]"); return Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : []; } catch { return []; } }, [answers.reviewImages]);
  const setReviewUrls = (urls: string[]) => setAnswers(a => ({ ...a, reviewImages: JSON.stringify(urls) }));
  const [saved, setSaved] = useState<{ name: string; filled: number }[]>([]);

  const name = (client || typed).trim();

  const refreshList = async () => {
    try {
      const r = await fetch(`${BASE}api/client-profiles`);
      const d = await r.json();
      setSaved((d.profiles ?? []).map((p: { clientName: string; answers: Record<string, string> }) => ({ name: p.clientName, filled: Object.values(p.answers).filter(v => v.trim()).length })));
    } catch { /* the list is a nicety */ }
  };
  useEffect(() => { void refreshList(); }, []);

  useEffect(() => {
    if (!name) { setAnswers({}); setPhotoUrl(null); return; }
    let off = false;
    setLoading(true);
    fetch(`${BASE}api/client-profiles/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { if (off) return; setAnswers(d.profile?.answers ?? {}); setPhotoUrl(d.profile?.photoUrl ?? null); })
      .catch(() => { if (!off) { setAnswers({}); setPhotoUrl(null); } })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [name]);

  const options = useMemo(() => presets.map(p => p.name), [presets]);

  const choosePhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const base64 = await shrink(f);
      const r = await fetch(`${BASE}api/content/upload-image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: `${name || "client"}-guide.png`, base64 }] }),
      });
      const d = await r.json();
      if (!r.ok || !d.results?.[0]?.url) throw new Error(d.error || "The photo did not upload");
      setPhotoUrl(d.results[0].url);
      toast.success("Guide photo added. Press Save to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The photo did not upload");
    }
  };

  const addReviews = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingReviews(true);
    try {
      const got: string[] = [];
      const list = Array.from(files);
      for (let i = 0; i < list.length; i += 3) {
        const images = await Promise.all(list.slice(i, i + 3).map(async (f, j) => ({ name: `${name || "client"}-review-${Date.now()}-${i + j}.png`, base64: await shrink(f, 1400) })));
        const r = await fetch(`${BASE}api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "A review image did not upload");
        got.push(...(d.results ?? []).map((x: { url: string }) => x.url));
      }
      setReviewUrls([...reviewUrls, ...got]);
      toast.success(`${got.length} review image${got.length === 1 ? "" : "s"} added. Press Save to keep ${got.length === 1 ? "it" : "them"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A review image did not upload");
    } finally {
      setUploadingReviews(false);
    }
  };

  // Gives this client their own link to fill the form in themselves. The same link is reused every time.
  const copyLink = async () => {
    if (!name) { toast.error("Pick or type a client first."); return; }
    setLinking(true);
    try {
      const r = await fetch(`${BASE}api/client-profiles/${encodeURIComponent(name)}/link`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.error || "Could not make the link");
      const url = `${window.location.origin}${BASE}know-me/${d.token}`.replace(/([^:]\/)\/+/g, "$1");
      try { await navigator.clipboard.writeText(url); toast.success(`Link for ${name} copied. Send it to them and their answers will appear here.`, { duration: 8000 }); }
      catch { window.prompt("Copy this link and send it to your client", url); }
      void refreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the link");
    } finally {
      setLinking(false);
    }
  };

  const save = async () => {
    if (!name) { toast.error("Pick or type a client first."); return; }
    setSaving(true);
    try {
      const r = await fetch(`${BASE}api/client-profiles/${encodeURIComponent(name)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, photoUrl }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not save");
      toast.success(`${name} saved. I will use this every time we shoot for them.`);
      void refreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Link href="/hub" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Hub</Link>
        <div>
          <h1 className="text-2xl font-semibold">Getting to know you</h1>
          <p className="text-sm text-muted-foreground mt-1">One profile per client: a guide photo and the answers that make them who they are. Every shoot, cover, story and caption starts from this.</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={copyShared} className="gap-2 bg-pink-600 hover:bg-pink-700 text-white"><Link2 className="h-4 w-4" /> Copy the one link for every client</Button>
            <span className="text-xs text-muted-foreground">They type their clinic name and fill it in. Answers land on the matching client, or wait below for me to check.</span>
          </div>
          {subs.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <p className="text-sm font-medium">Waiting for you ({subs.length})</p>
              {subs.map(s => (
                <div key={s.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-sm"><span className="font-medium">{s.typedName}</span> <span className="text-muted-foreground">sent {Object.values(s.answers).filter(v => v.trim()).length} answers{s.matchedName ? `, looks like ${s.matchedName}, who already has a profile` : ", I could not match the name"}</span></p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={subPick[s.id] ?? s.matchedName ?? ""} onChange={e => setSubPick(p => ({ ...p, [s.id]: e.target.value }))} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
                      <option value="">Choose the client</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <Button size="sm" onClick={() => acceptSub(s)}>Save onto them</Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissSub(s)}>Dismiss</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Client</Label>
          <select
            value={client} onChange={e => { setClient(e.target.value); setTyped(""); }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a saved client</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <Input placeholder="or type a new client name" value={typed} onChange={e => { setTyped(e.target.value); setClient(""); }} />
        </div>

        {name && (
          <>
            {loading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Opening {name}</p>}
            <div className="space-y-2">
              <Label>Guide photo</Label>
              <p className="text-xs text-muted-foreground">A clear, front on photo with a closed mouth smile. It is the reference for every new shoot.</p>
              <div className="flex items-center gap-4">
                {photoUrl ? <img src={photoUrl} alt="Guide" className="h-32 w-24 rounded-lg object-cover border border-border" /> : <div className="h-32 w-24 rounded-lg border border-dashed border-border grid place-items-center text-xs text-muted-foreground">No photo</div>}
                <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <Upload className="h-4 w-4" /> {photoUrl ? "Change photo" : "Add photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { void choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map(q => (
                <div key={q.id} className="space-y-1">
                  <Label>{q.label}</Label>
                  {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
                  {q.long
                    ? <Textarea rows={3} value={answers[q.id] ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                    : <Input value={answers[q.id] ?? ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Review screenshots</Label>
              <p className="text-xs text-muted-foreground">Add screenshots of their best reviews from Google, Facebook or Instagram. Their words and the phrases patients use shape the copy.</p>
              <div className="flex flex-wrap gap-3">
                {reviewUrls.map(u => (
                  <div key={u} className="relative">
                    <img src={u} alt="Review" className="h-28 w-auto max-w-[180px] rounded-lg object-cover border border-border" />
                    <button type="button" onClick={() => setReviewUrls(reviewUrls.filter(x => x !== u))} className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-0.5 hover:text-red-400" aria-label="Remove review image"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <label className="h-28 w-28 rounded-lg border border-dashed border-border grid place-items-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 text-center px-2">
                  {uploadingReviews ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Upload className="h-4 w-4" />Add review images</span>}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => { void addReviews(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save {name}
              </Button>
              <Button variant="outline" onClick={copyLink} disabled={linking} className="gap-2">
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Copy their link to fill it in
              </Button>
            </div>
          </>
        )}

        {saved.length > 0 && (
          <div className="border-t border-border/40 pt-4 space-y-2">
            <p className="text-sm font-medium">Clients I know so far</p>
            <div className="flex flex-wrap gap-2">
              {saved.map(s => (
                <button key={s.name} type="button" onClick={() => { setClient(presets.some(p => p.name === s.name) ? s.name : ""); setTyped(presets.some(p => p.name === s.name) ? "" : s.name); }} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted/40">
                  {s.name} <span className="text-muted-foreground">{s.filled}/{QUESTIONS.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
