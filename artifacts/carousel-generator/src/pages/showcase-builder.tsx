import { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CAROUSELS = 6;
const SLIDES = 4;

type Slot = { url?: string; preview?: string; uploading?: boolean };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ShowcaseBuilder() {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [cta, setCta] = useState("");
  const [grid, setGrid] = useState<Slot[][]>(
    Array.from({ length: CAROUSELS }, () => Array.from({ length: SLIDES }, () => ({})))
  );
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function uploadOne(base64: string): Promise<string> {
    const resp = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name: "showcase.jpg", base64 }] }),
    });
    if (!resp.ok) throw new Error("Image upload failed");
    const d = await resp.json();
    const url = d?.results?.[0]?.url;
    if (!url) throw new Error("No URL returned for image");
    return url;
  }

  async function onPick(ci: number, si: number, files: FileList | null) {
    if (!files || !files.length) return;
    // Allow selecting several at once into consecutive slots of this carousel.
    const picks = Array.from(files).slice(0, SLIDES - si);
    for (let k = 0; k < picks.length; k++) {
      const idx = si + k;
      const dataUrl = await fileToDataUrl(picks[k]);
      setGrid((g) => {
        const n = g.map((row) => row.slice());
        n[ci][idx] = { preview: dataUrl, uploading: true };
        return n;
      });
      try {
        const url = await uploadOne(dataUrl);
        setGrid((g) => {
          const n = g.map((row) => row.slice());
          n[ci][idx] = { url, preview: dataUrl, uploading: false };
          return n;
        });
      } catch (e: any) {
        setGrid((g) => {
          const n = g.map((row) => row.slice());
          n[ci][idx] = {};
          return n;
        });
        setError(e?.message || "Upload failed");
      }
    }
  }

  function clearSlot(ci: number, si: number) {
    setGrid((g) => {
      const n = g.map((row) => row.slice());
      n[ci][si] = {};
      return n;
    });
  }

  async function create() {
    setError("");
    setLink("");
    const carousels = grid
      .map((row) => row.map((s) => s.url).filter(Boolean) as string[])
      .filter((c) => c.length > 0);
    if (carousels.length === 0) {
      setError("Add at least one image to at least one carousel.");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch(`${BASE}/api/showcase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clientName, carousels, ctaUrl: cta }),
      });
      const d = await resp.json();
      if (!resp.ok || !d.token) throw new Error(d.error || "Could not create showcase");
      setLink(`${window.location.origin}/showcase/${d.token}`);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const anyUploading = grid.some((row) => row.some((s) => s.uploading));

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Showcase Builder <span className="text-pink-500">·</span> The CyberSuite
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Add up to 6 carousels (4 slides each). Get one link that plays them, then shows the grid.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-1">Showcase title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sample work for Dr Smith"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 outline-none focus:border-pink-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-1">Their clinic name (optional)</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Shown on the final grid"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 outline-none focus:border-pink-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-1">"Work with me" button link (optional)</label>
            <input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Your Instagram or booking page. Leave blank and it defaults to emailing you."
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 outline-none focus:border-pink-500"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {grid.map((row, ci) => (
            <div key={ci} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold mb-3">
                Carousel {ci + 1}
                <span className="text-white/40 font-normal"> · {row.filter((s) => s.url).length}/4</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {row.map((slot, si) => (
                  <label
                    key={si}
                    className="relative aspect-[4/5] rounded-lg border border-white/15 bg-black/40 overflow-hidden flex items-center justify-center cursor-pointer hover:border-pink-500 transition-colors"
                  >
                    {slot.preview ? (
                      <>
                        <img src={slot.preview} alt="" className="w-full h-full object-cover" />
                        {slot.uploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] text-white/70">…</div>
                        )}
                        {!slot.uploading && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); clearSlot(ci, si); }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white/80 text-xs leading-none"
                          >×</button>
                        )}
                      </>
                    ) : (
                      <span className="text-white/30 text-xl">+</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onPick(ci, si, e.target.files)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="mt-6 text-pink-400 text-sm">{error}</div>}

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={create}
            disabled={busy || anyUploading}
            className="px-6 py-3 rounded-full bg-pink-500 text-white font-semibold disabled:opacity-40 hover:bg-pink-400 transition-colors"
          >
            {busy ? "Creating…" : anyUploading ? "Uploading images…" : "Create showcase link"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="text-sm text-white/60 underline">
              Preview
            </a>
          )}
        </div>

        {link && (
          <div className="mt-6 rounded-2xl border border-pink-500/40 bg-pink-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Your shareable link</div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <code className="flex-1 break-all text-pink-300">{link}</code>
              <button onClick={copy} className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm whitespace-nowrap">
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <p className="text-xs text-white/40 mt-3">Send this to a potential client. It opens with no login and plays automatically.</p>
          </div>
        )}
      </main>
    </div>
  );
}
