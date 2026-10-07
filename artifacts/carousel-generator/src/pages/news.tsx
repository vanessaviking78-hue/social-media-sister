import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type NewsItem = {
  id: number;
  preset_id: number;
  client_name: string;
  title: string;
  body: string;
  created_at: string;
};

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

export default function News() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const selectedPreset = presets.find((p) => p.name === clientName) ?? null;

  function load(presetId: number) {
    setLoading(true);
    fetch(`${BASE}/api/client-news?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Could not load news for this client."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (selectedPreset) load(selectedPreset.id);
    else setItems([]);
  }, [selectedPreset?.id]);

  async function post() {
    if (!selectedPreset) { toast.error("Pick a client first"); return; }
    if (!title.trim()) { toast.error("Give it a title"); return; }
    setPosting(true);
    try {
      const r = await fetch(`${BASE}/api/client-news`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ presetId: selectedPreset.id, clientName: selectedPreset.name, title, body }),
      });
      if (!r.ok) throw new Error("Failed to post");
      toast.success(`Posted to ${selectedPreset.name}'s preview page`);
      setTitle("");
      setBody("");
      load(selectedPreset.id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: number) {
    setDeletingId(id);
    try {
      const r = await fetch(`${BASE}/api/client-news/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Removed.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">News & Updates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Post an update on a client's behalf. It shows straight away on their content preview page.</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <section className="space-y-2">
          <h2 className="font-semibold text-base">Choose a client</h2>
          <Select value={clientName} onValueChange={setClientName}>
            <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
            <SelectContent>
              {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </section>

        {selectedPreset && (
          <>
            <section className="space-y-3 rounded-2xl border border-border/40 p-5">
              <h2 className="font-semibold text-base">New update</h2>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. We're open bank holiday Monday"
                  className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Details (optional)</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Any extra detail clients should see"
                  className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <Button onClick={post} disabled={posting} className="w-full">
                {posting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                {posting ? "Posting…" : "Post update"}
              </Button>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold text-base">Previously posted</h2>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-pink-500" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing posted for {selectedPreset.name} yet.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/40 p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="font-medium text-sm mt-0.5">{item.title}</p>
                        {item.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.body}</p>}
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        disabled={deletingId === item.id}
                        className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                        title="Delete"
                      >
                        {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
