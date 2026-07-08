import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, Trash2, UploadCloud, Download } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Resource = {
  id: number;
  title: string;
  description: string;
  fileKey: string;
  fileName: string;
  createdAt: string;
};

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

export default function ResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`${BASE}api/resources`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setResources(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const upload = async () => {
    setError("");
    if (!file) { setError("Pick a PDF first."); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim() || file.name);
      form.append("description", description.trim());
      const r = await fetch(`${BASE}api/resources/upload`, { method: "POST", headers: authHeaders(), body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Upload failed");
      setTitle(""); setDescription(""); setFile(null);
      load();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this document? Clients won't be able to see it anymore.")) return;
    await fetch(`${BASE}api/resources/${id}`, { method: "DELETE", headers: authHeaders() });
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 py-5 px-8 flex items-center gap-4">
        <Link href="/hub"><ArrowLeft className="w-5 h-5 cursor-pointer" /></Link>
        <div>
          <h1 className="font-bold text-xl leading-none">Resource Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload once, every client sees it in their portal.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-border/30 p-6 mb-10">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Add a document</h2>
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Engagement Cheat Sheet" className="w-full rounded-xl border border-border/40 bg-transparent px-4 py-2.5 text-sm outline-none" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short description, so clients know what it is" className="w-full rounded-xl border border-border/40 bg-transparent px-4 py-2.5 text-sm outline-none resize-none" />
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={upload} disabled={uploading} className="rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 flex items-center gap-2">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : "Upload"}
            </button>
          </div>
        </div>

        <h2 className="font-semibold text-base mb-4">Library ({resources.length})</h2>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border/30 p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.description && <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>}
                </div>
                <a href={`${BASE}api/media/${r.fileKey}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground p-1.5" title="Download">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-red-500 p-1.5" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
