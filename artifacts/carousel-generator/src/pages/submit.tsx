import React, { useEffect, useRef, useState } from "react";
import { UploadCloud, CheckCircle2, Loader2, AlertTriangle, ImageIcon } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Clinic = { clientName: string; logoUrl: string | null };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SubmitBeforeAfter({ token }: { token: string }) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [beforePrev, setBeforePrev] = useState<string>("");
  const [afterPrev, setAfterPrev] = useState<string>("");
  const [treatment, setTreatment] = useState("");
  const [story, setStory] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BASE}api/submit/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClinic(d))
      .catch(() => setLoadError(true));
  }, [token]);

  const pick = (which: "before" | "after") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const prev = URL.createObjectURL(f);
    if (which === "before") { setBefore(f); setBeforePrev(prev); }
    else { setAfter(f); setAfterPrev(prev); }
  };

  const uploadOne = async (f: File): Promise<string> => {
    const base64 = await fileToBase64(f);
    const r = await fetch(`${BASE}api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name: f.name, base64 }] }),
    });
    if (!r.ok) throw new Error("Upload failed, please try a smaller photo.");
    const d = await r.json();
    const url = d.results?.[0]?.url;
    if (!url) throw new Error("Upload failed, please try again.");
    return url;
  };

  const submit = async () => {
    setErr("");
    if (!before || !after) { setErr("Please add both a before and an after photo."); return; }
    setSubmitting(true);
    try {
      const beforeUrl = await uploadOne(before);
      const afterUrl = await uploadOne(after);
      const r = await fetch(`${BASE}api/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeUrl, afterUrl, treatment, story, submitterName: name }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Could not save, please try again.");
      }
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-yellow-500" />
          <p className="text-zinc-400">This link is not valid. Please check with whoever sent it.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-xl font-bold mb-2">Thank you</h1>
          <p className="text-zinc-400">Your before and after has been sent. You can close this page, or add another below.</p>
          <button
            onClick={() => { setBefore(null); setAfter(null); setBeforePrev(""); setAfterPrev(""); setTreatment(""); setStory(""); setName(""); setDone(false); }}
            className="mt-5 text-sm text-pink-400 hover:text-pink-300"
          >Add another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          {clinic?.logoUrl ? <img src={clinic.logoUrl} alt="" className="h-9 w-auto object-contain rounded" /> : null}
          <div>
            <p className="font-semibold text-sm">{clinic?.clientName || "Submit a before & after"}</p>
            <p className="text-xs text-zinc-500">Before & After upload</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-zinc-400">Add a before photo, an after photo and a few words about the treatment. That's it.</p>

        <div className="grid grid-cols-2 gap-3">
          {([["before", before, beforePrev, beforeRef, pick("before")], ["after", after, afterPrev, afterRef, pick("after")]] as const).map(
            ([label, file, prev, ref, onChange]) => (
              <div key={label}>
                <label className="text-xs uppercase tracking-wide text-zinc-500">{label}</label>
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  className="mt-1 w-full aspect-square rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 flex items-center justify-center overflow-hidden hover:border-pink-500/50"
                >
                  {prev ? (
                    <img src={prev} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center text-zinc-500 text-xs gap-2">
                      <UploadCloud className="w-6 h-6" /> Tap to add {label}
                    </span>
                  )}
                </button>
                <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onChange} />
              </div>
            )
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">Treatment</label>
          <input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Lip filler, skin boosters"
            className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">A little back story</label>
          <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} placeholder="What were they hoping for, how did it go, anything nice they said..."
            className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50 resize-none" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">Your name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="So we know who sent it"
            className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50" />
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <button onClick={submit} disabled={submitting}
          className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-60 py-3 font-semibold text-sm flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {submitting ? "Sending..." : "Send my before & after"}
        </button>
      </main>
    </div>
  );
}
