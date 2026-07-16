import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Search, Send, Upload, Trash2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { renderAllThumbs, makeBlocks, loadImg, type CsvRow } from "@/pages/bulk-carousel";
import { nameBucketOffsetMinutes } from "@/lib/broadcast-stagger";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Topic = {
  id: number;
  slide1Hook: string;
  slide1Subtitle: string;
  slide2Body: string;
  slide3Body: string;
  slide4Cta: string;
  category: string;
  imageUrl: string;
  createdAt: string;
};

function topicToCsvRow(t: Topic): CsvRow {
  return {
    slide1_hook: t.slide1Hook,
    slide1_subtitle: t.slide1Subtitle,
    slide2_body: t.slide2Body,
    slide3_body: t.slide3Body,
    slide4_cta: t.slide4Cta,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Broadcasts() {
  const { presets } = usePresets();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/broadcast-topics`);
      const d = await r.json();
      setTopics(Array.isArray(d.topics) ? d.topics : []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return topics;
    return topics.filter((t) => t.slide1Hook.toLowerCase().includes(term) || t.category.toLowerCase().includes(term));
  }, [topics, search]);

  const connectedClients = useMemo(() => {
    return (presets || []).filter((p: any) => p.metaFacebookPageId && p.metaInstagramAccountId);
  }, [presets]);

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const required = ["slide1_hook", "slide1_subtitle", "slide2_body", "slide3_body", "slide4_cta"];
          const headers = (results.meta.fields || []).map((h: string) => h.trim());
          const missing = required.filter((col) => !headers.includes(col));
          if (missing.length > 0) {
            toast.error(`Missing columns: ${missing.join(", ")}`);
            setImporting(false);
            return;
          }
          try {
            const r = await fetch(`${BASE}/api/broadcast-topics/bulk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: results.data }),
            });
            if (!r.ok) throw new Error("Import failed");
            toast.success("Topics added to the library.");
            load();
          } catch (e: any) {
            toast.error(e?.message || "Import failed");
          } finally {
            setImporting(false);
          }
        },
        error: () => setImporting(false),
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const removeTopic = async (id: number) => {
    await fetch(`${BASE}/api/broadcast-topics/${id}`, { method: "DELETE" });
    load();
  };

  const onUploadTopicImage = async (topic: Topic, file: File) => {
    setUploadingId(topic.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploadRes = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: file.name, base64: dataUrl }] }),
      });
      if (!uploadRes.ok) throw new Error("Image upload failed");
      const uploadData = await uploadRes.json();
      const url = uploadData?.results?.[0]?.url;
      if (!url) throw new Error("No image URL returned");
      const patchRes = await fetch(`${BASE}/api/broadcast-topics/${topic.id}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!patchRes.ok) throw new Error("Could not save image to topic");
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, imageUrl: url } : t)));
      toast.success("Image saved to this topic.");
    } catch (e: any) {
      toast.error(e?.message || "Image upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const clearTopicImage = async (topic: Topic) => {
    try {
      const patchRes = await fetch(`${BASE}/api/broadcast-topics/${topic.id}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: "" }),
      });
      if (!patchRes.ok) throw new Error("Could not clear image");
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, imageUrl: "" } : t)));
    } catch (e: any) {
      toast.error(e?.message || "Could not clear image");
    }
  };

  const broadcast = async (topic: Topic) => {
    if (connectedClients.length === 0) {
      toast.error("No connected clients to broadcast to.");
      return;
    }
    setBroadcastingId(topic.id);
    setProgress({ done: 0, total: connectedClients.length });
    const row = topicToCsvRow(topic);
    const blocks = makeBlocks(row);
    let topicImg: HTMLImageElement | null = null;
    if (topic.imageUrl) {
      try { topicImg = await loadImg(topic.imageUrl); } catch {}
    }
    let successCount = 0;
    let failCount = 0;
    for (const preset of connectedClients as ClientPreset[]) {
      try {
        let logoImg: HTMLImageElement | null = null;
        if ((preset as any).logoUrl) {
          try { logoImg = await loadImg((preset as any).logoUrl); } catch {}
        }
        const slideUrls = renderAllThumbs({ blocks, coverImg: topicImg, bodyImg: topicImg } as any, logoImg, preset, 0.9);
        const images = slideUrls.map((url, i) => ({ name: `slide-${i + 1}.png`, base64: url }));
        const uploadRes = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images }),
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const uploadData = await uploadRes.json();
        const imageUrls = (uploadData.results || []).map((x: any) => x.url).filter(Boolean);
        const offsetMinutes = nameBucketOffsetMinutes((preset as any).name || "");
        const base = new Date();
        base.setDate(base.getDate() + 1);
        const [hh, mm] = ((preset as any).defaultPostTime || "18:00").split(":").map((x: string) => parseInt(x, 10));
        base.setHours(hh || 18, (mm || 0) + offsetMinutes, 0, 0);
        const scheduleRes = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: (preset as any).id,
            postType: "carousel",
            content: {
              imageUrls,
              caption: `${topic.slide1Hook}\n\n${topic.slide4Cta}`,
              title: topic.slide1Hook.slice(0, 60),
              platforms: ["instagram", "facebook"],
            },
            scheduledAt: base.toISOString(),
          }),
        });
        if (!scheduleRes.ok) throw new Error("Schedule failed");
        successCount++;
      } catch {
        failCount++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    setBroadcastingId(null);
    if (failCount === 0) {
      toast.success(`Sent to all ${successCount} connected clients.`);
    } else {
      toast.error(`${successCount} sent, ${failCount} failed. Check the scheduler.`);
    }
  };

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Broadcasts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generic content library. Pick a post, send it to every connected client with their own branding.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics" className={inputCls + " pl-9"} />
          </div>
          <label className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400 flex items-center gap-2 cursor-pointer whitespace-nowrap">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import more topics
            <input type="file" accept=".csv" className="hidden" onChange={onImportFile} disabled={importing} />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">{connectedClients.length} connected client{connectedClients.length === 1 ? "" : "s"} will receive each broadcast. Add your own photo to a topic before sending, otherwise it goes out as text only.</p>

        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading library...</div>}
        {!loading && filteredTopics.length === 0 && <p className="text-sm text-muted-foreground">No topics found.</p>}

        <div className="space-y-3">
          {filteredTopics.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border/50 p-4">
              <div className="flex items-start gap-3">
                {t.imageUrl ? (
                  <div className="relative shrink-0">
                    <img src={t.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    <button onClick={() => clearTopicImage(t)} className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center cursor-pointer text-zinc-500 hover:border-pink-600 hover:text-pink-500">
                    {uploadingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingId === t.id}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadTopicImage(t, f); e.target.value = ""; }}
                    />
                  </label>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{t.slide1Hook}</p>
                  <p className="text-sm text-muted-foreground mb-1">{t.slide1Subtitle}</p>
                  {t.category && <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{t.category}</span>}
                </div>
                <button onClick={() => removeTopic(t.id)} className="text-zinc-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              <button
                onClick={() => broadcast(t)}
                disabled={broadcastingId !== null}
                className="mt-3 w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2.5 flex items-center justify-center gap-2 text-sm"
              >
                {broadcastingId === t.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending {progress.done}/{progress.total}...</>
                ) : (
                  <><Send className="w-4 h-4" /> Broadcast to all clients</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
