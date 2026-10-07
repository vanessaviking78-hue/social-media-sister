import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL;

// The questions I ask about each client, so their photos, covers, stories and captions all sound like them.
const QUESTIONS: { id: string; label: string; hint: string; long?: boolean }[] = [
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
async function shrink(file: File, max = 1600): Promise<string> {
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

            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save {name}
            </Button>
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
