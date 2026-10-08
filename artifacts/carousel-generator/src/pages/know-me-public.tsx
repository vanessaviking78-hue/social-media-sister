import { useState, useEffect, useMemo } from "react";
import { Loader2, Upload, Check, X, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONS, shrink } from "@/pages/getting-to-know-you";

const BASE = import.meta.env.BASE_URL;

// The page a client opens from their own link. Their answers are kept on their profile and used for every hook and caption written for them.
export default function KnowMePublic({ token }: { token?: string }) {
  const [clientName, setClientName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">(token ? "loading" : "ready");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}api/know-me/${encodeURIComponent(token)}`)
      .then(async r => { if (!r.ok) throw new Error("invalid"); return r.json(); })
      .then(d => { setClientName(d.profile.clientName); setAnswers(d.profile.answers ?? {}); setPhotoUrl(d.profile.photoUrl ?? null); setState("ready"); })
      .catch(() => setState("invalid"));
  }, [token]);

  const reviewUrls: string[] = useMemo(() => { try { const v = JSON.parse(answers.reviewImages || "[]"); return Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : []; } catch { return []; } }, [answers.reviewImages]);
  const setReviewUrls = (urls: string[]) => setAnswers(a => ({ ...a, reviewImages: JSON.stringify(urls) }));
  const change = (id: string, v: string) => { setSaved(false); setAnswers(a => ({ ...a, [id]: v })); };

  const upload = async (files: File[], label: string): Promise<string[]> => {
    const out: string[] = [];
    for (let i = 0; i < files.length; i += 3) {
      const images = await Promise.all(files.slice(i, i + 3).map(async (f, j) => ({ name: `${clientName || "client"}-${label}-${Date.now()}-${i + j}.png`, base64: await shrink(f, 1400) })));
      const r = await fetch(`${BASE}api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "That image did not upload");
      out.push(...(d.results ?? []).map((x: { url: string }) => x.url));
    }
    return out;
  };

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setBusyUpload(true);
    try { const [u] = await upload([f], "photo"); if (u) { setPhotoUrl(u); setSaved(false); } }
    catch (e) { toast.error(e instanceof Error ? e.message : "That photo did not upload"); }
    finally { setBusyUpload(false); }
  };
  const pickReviews = async (fl: FileList | null) => {
    if (!fl?.length) return;
    setBusyUpload(true);
    try { const u = await upload(Array.from(fl), "review"); setReviewUrls([...reviewUrls, ...u]); setSaved(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That image did not upload"); }
    finally { setBusyUpload(false); }
  };

  const save = async () => {
    if (!token && clientName.trim().length < 2) { toast.error("Please tell me which clinic you are first."); return; }
    setSaving(true);
    try {
      const r = token
        ? await fetch(`${BASE}api/know-me/${encodeURIComponent(token)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, photoUrl }) })
        : await fetch(`${BASE}api/know-me-submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicName: clientName, answers, photoUrl }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not save");
      setSaved(true);
      if (!token) setSent(true);
      toast.success("Saved. Thank you, that really helps.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") return <div className="min-h-screen grid place-items-center bg-background text-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (state === "invalid") return <div className="min-h-screen grid place-items-center bg-background text-foreground px-6 text-center"><p>This link does not look right. Please ask Vanessa to send it again.</p></div>;

  if (sent) return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-6 text-center">
      <div className="max-w-md space-y-3">
        <Heart className="h-8 w-8 text-pink-400 mx-auto" />
        <h1 className="text-2xl font-semibold">Thank you, that is perfect</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">I have everything I need to make your posts sound like you. If you think of anything else, just open the same link and send it again.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-pink-400 flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Social Media Sister</p>
          <h1 className="text-3xl font-semibold">{token ? `Let me get to know ${clientName}` : "Let me get to know you"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">The more of you I put into your posts, the more they sound like you. Answer in your own words, as chatty as you like. There are no wrong answers and you can come back and change anything whenever you want.</p>
        </div>

        {!token && (
          <div className="space-y-1">
            <Label>Your clinic name</Label>
            <p className="text-xs text-muted-foreground">Exactly as you use it on Instagram, so I put your answers on the right page.</p>
            <Input value={clientName} onChange={e => { setSaved(false); setClientName(e.target.value); }} placeholder="e.g. Glow Aesthetics" />
          </div>
        )}

        <div className="space-y-2">
          <Label>A photo of you</Label>
          <p className="text-xs text-muted-foreground">A clear, front on photo with a closed mouth smile is perfect. I use it as the guide for your photoshoots.</p>
          <div className="flex items-center gap-4">
            {photoUrl ? <img src={photoUrl} alt="You" className="h-32 w-24 rounded-lg object-cover border border-border" /> : <div className="h-32 w-24 rounded-lg border border-dashed border-border grid place-items-center text-xs text-muted-foreground">No photo yet</div>}
            <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              {busyUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {photoUrl ? "Change photo" : "Add a photo"}
              <input type="file" accept="image/*" className="hidden" onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="space-y-5">
          {QUESTIONS.map(q => (
            <div key={q.id} className="space-y-1">
              <Label>{q.label}</Label>
              {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
              {q.long
                ? <Textarea rows={3} value={answers[q.id] ?? ""} onChange={e => change(q.id, e.target.value)} />
                : <Input value={answers[q.id] ?? ""} onChange={e => change(q.id, e.target.value)} />}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Your best reviews</Label>
          <p className="text-xs text-muted-foreground">Screenshots of reviews from Google, Facebook or Instagram. The words your patients use are gold for your posts.</p>
          <div className="flex flex-wrap gap-3">
            {reviewUrls.map(u => (
              <div key={u} className="relative">
                <img src={u} alt="Review" className="h-28 w-auto max-w-[180px] rounded-lg object-cover border border-border" />
                <button type="button" onClick={() => { setReviewUrls(reviewUrls.filter(x => x !== u)); setSaved(false); }} className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-0.5" aria-label="Remove review image"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <label className="h-28 w-28 rounded-lg border border-dashed border-border grid place-items-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 text-center px-2">
              {busyUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Upload className="h-4 w-4" />Add review images</span>}
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => { void pickReviews(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="sticky bottom-4">
          <Button onClick={save} disabled={saving || busyUpload} className="w-full gap-2 h-12 text-base bg-pink-600 hover:bg-pink-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saved ? "Saved, thank you" : "Save my answers"}
          </Button>
        </div>
      </div>
    </div>
  );
}
