import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Search, Gift, Image as ImageIcon, Film, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Preset = { id: number; name: string };
type Item = {
  id: number;
  title: string;
  note: string;
  mediaUrl: string | null;
  mediaType: string;
  createdAt: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function BonusContent() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Preset | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/presets`)
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d.presets) ? d.presets : []))
      .catch(() => setPresets([]));
  }, []);

  const loadItems = useCallback(async (presetId: number) => {
    setLoadingItems(true);
    try {
      const r = await fetch(`${BASE}/api/bonus-content?presetId=${presetId}`);
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const pick = (p: Preset) => {
    setSelected(p);
    setTitle(""); setNote(""); setFile(null); setFilePreview("");
    loadItems(p.id);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!selected) return;
    if (!title.trim() && !note.trim() && !file) {
      toast.error("Add a title, a note, or a file first.");
      return;
    }
    setSaving(true);
    try {
      let mediaUrl = "";
      let mediaType = "none";
      if (file) {
        if (file.type.startsWith("video/")) {
          const form = new FormData();
          form.append("video", file);
          const r = await fetch(`${BASE}/api/content/upload-video`, { method: "POST", body: form });
          if (!r.ok) throw new Error("Video upload failed");
          const d = await r.json();
          mediaUrl = d.proxyUrl || d.url;
          mediaType = "video";
        } else {
          const base64 = await fileToBase64(file);
          const r = await fetch(`${BASE}/api/content/upload-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: [{ name: file.name, base64 }] }),
          });
          if (!r.ok) throw new Error("Image upload failed");
          const d = await r.json();
          mediaUrl = d.results?.[0]?.url || "";
          mediaType = "image";
        }
      }
      const r = await fetch(`${BASE}/api/bonus-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: selected.id, title, note, mediaUrl, mediaType }),
      });
      if (!r.ok) throw new Error("Failed to save");
      setTitle(""); setNote(""); setFile(null); setFilePreview("");
      toast.success("Added to their Bonus Content.");
      loadItems(selected.id);
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!selected) return;
    await fetch(`${BASE}/api/bonus-content/${id}`, { method: "DELETE" });
    loadItems(selected.id);
  };

  const filteredPresets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(term));
  }, [presets, search]);

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Bonus Content</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selected ? `Adding for ${selected.name}` : "Pick a client to get started"}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {!selected && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className={inputCls + " pl-9"} />
            </div>
            <div className="grid gap-2">
              {filteredPresets.map((p) => (
                <button key={p.id} onClick={() => pick(p)} className="text-left rounded-xl border border-zinc-800 hover:border-pink-600 px-4 py-3 text-sm">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-8">
            <button onClick={() => setSelected(null)} className="text-xs text-pink-400 underline">Change client</button>

            <div className="space-y-4 rounded-2xl border border-border/50 p-4">
              <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-pink-400" /><h2 className="font-semibold text-sm">Add something new</h2></div>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A treatment idea for you" className={inputCls} /></div>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Note</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>
              <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Image or video (optional)</label>
                <label className="w-full h-32 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 overflow-hidden flex items-center justify-center cursor-pointer">
                  {filePreview ? (file?.type.startsWith("video/") ? <video src={filePreview} className="max-h-full max-w-full" /> : <img src={filePreview} alt="preview" className="max-h-full max-w-full object-contain p-2" />) : (<div className="text-center text-zinc-600"><Upload className="w-6 h-6 mx-auto mb-1" /><span className="text-xs">Tap to add a file</span></div>)}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
                </label>
              </div>
              <button onClick={save} disabled={saving} className="w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Add to their Bonus Content"}
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="font-semibold text-sm">Already there</h2>
              {loadingItems && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
              {!loadingItems && items.length === 0 && <p className="text-sm text-muted-foreground">Nothing added yet.</p>}
              {items.map((it) => (
                <div key={it.id} className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {it.title && <p className="font-semibold text-sm mb-1">{it.title}</p>}
                      {it.note && <p className="text-sm text-muted-foreground mb-2">{it.note}</p>}
                      {it.mediaUrl && it.mediaType === "image" && <img src={it.mediaUrl} alt="" className="rounded-lg max-h-48" />}
                      {it.mediaUrl && it.mediaType === "video" && <video src={it.mediaUrl} controls className="rounded-lg max-h-48" />}
                      <p className="text-xs text-muted-foreground mt-2">{timeAgo(it.createdAt)}</p>
                    </div>
                    <button onClick={() => remove(it.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
