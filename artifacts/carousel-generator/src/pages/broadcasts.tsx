import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Search, Send, Upload, Trash2, Image as ImageIcon, X, Clock, CalendarClock, Film, Music } from "lucide-react";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";
import { toast } from "sonner";
import Papa from "papaparse";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { renderAllThumbs, makeBlocks, loadImg, type CsvRow } from "@/pages/bulk-carousel";
import { nameBucketOffsetMinutes } from "@/lib/broadcast-stagger";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CAPTION_TONES: { value: string; label: string }[] = [
  { value: "1", label: "Northern grit" },
  { value: "2", label: "Storyteller" },
  { value: "3", label: "Funny and blunt" },
  { value: "4", label: "Professional warmth" },
];

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

type Draft = {
  id: number;
  presetId: number;
  clientName: string;
  topicId: number | null;
  imageUrls: string[];
  caption: string;
  title: string;
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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

async function uploadVideoFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("video", file);
  const res = await fetch(`${BASE}/api/content/upload-video`, { method: "POST", body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Video upload failed (${res.status})` }));
    throw new Error(data.error || "Video upload failed");
  }
  const data = await res.json();
  return (data.url ?? data.proxyUrl) as string;
}

function defaultLocalDateTime(defaultPostTime?: string): string {
  const base = new Date();
  base.setDate(base.getDate() + 1);
  const [hh, mm] = (defaultPostTime || "18:00").split(":").map((x) => parseInt(x, 10));
  base.setHours(hh || 18, mm || 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

export default function Broadcasts() {
  const { presets } = usePresets();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [draftTimes, setDraftTimes] = useState<Record<number, string>>({});

  const [singleImgFile, setSingleImgFile] = useState<File | null>(null);
  const [singleImgPreview, setSingleImgPreview] = useState("");
  const [singleImgContext, setSingleImgContext] = useState("");
  const [singleImgTone, setSingleImgTone] = useState("1");
  const [singleImgBusy, setSingleImgBusy] = useState(false);
  const [singleVidFile, setSingleVidFile] = useState<File | null>(null);
  const [singleVidPreview, setSingleVidPreview] = useState("");
  const [singleVidContext, setSingleVidContext] = useState("");
  const [singleVidTone, setSingleVidTone] = useState("1");
  const [singleVidBusy, setSingleVidBusy] = useState(false);
  const [singleVidMusicTrack, setSingleVidMusicTrack] = useState<MusicTrack | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);

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

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const r = await fetch(`${BASE}/api/broadcast-drafts`);
      const d = await r.json();
      const list: Draft[] = Array.isArray(d.drafts) ? d.drafts : [];
      setDrafts(list);
      setDraftTimes((prev) => {
        const next = { ...prev };
        for (const draft of list) {
          if (!next[draft.id]) {
            const preset = (presets || []).find((p: any) => p.id === draft.presetId);
            next[draft.id] = defaultLocalDateTime((preset as any)?.defaultPostTime);
          }
        }
        return next;
      });
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  }, [presets]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);

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
    const draftRows: any[] = [];
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
        draftRows.push({
          presetId: (preset as any).id,
          clientName: (preset as any).name || "",
          topicId: topic.id,
          imageUrls,
          caption: `${topic.slide1Hook}\n\n${topic.slide4Cta}`,
          title: topic.slide1Hook.slice(0, 60),
        });
      } catch {
        failCount++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    if (draftRows.length > 0) {
      try {
        const r = await fetch(`${BASE}/api/broadcast-drafts/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: draftRows }),
        });
        if (!r.ok) throw new Error("Could not save to pending queue");
        loadDrafts();
      } catch (e: any) {
        toast.error(e?.message || "Could not save to pending queue");
      }
    }
    setBroadcastingId(null);
    if (failCount === 0) {
      toast.success(`Built ${draftRows.length} branded posts. Sitting in Pending Queue below, nothing is scheduled yet.`);
    } else {
      toast.error(`${draftRows.length} built, ${failCount} failed to build. Check the pending queue.`);
    }
  };

  const onPickSingleImage = async (file: File) => {
    setSingleImgFile(file);
    try {
      const dataUrl = await fileToDataUrl(file);
      setSingleImgPreview(dataUrl);
    } catch {
      setSingleImgPreview("");
    }
  };

  const clearSingleImage = () => {
    setSingleImgFile(null);
    setSingleImgPreview("");
    setSingleImgContext("");
  };

  const broadcastSingleImage = async () => {
    if (!singleImgFile) {
      toast.error("Choose a photo first.");
      return;
    }
    if (!singleImgContext.trim()) {
      toast.error("Add a line about what is in the photo, it helps the caption.");
      return;
    }
    if (connectedClients.length === 0) {
      toast.error("No connected clients to broadcast to.");
      return;
    }
    setSingleImgBusy(true);
    try {
      const dataUrl = singleImgPreview || (await fileToDataUrl(singleImgFile));
      const uploadRes = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: singleImgFile.name, base64: dataUrl }] }),
      });
      if (!uploadRes.ok) throw new Error("Photo upload failed");
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData?.results?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL returned");

      const captionRes = await fetch(`${BASE}/api/caption-generator/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: singleImgTone, context: singleImgContext.trim() }),
      });
      let caption = singleImgContext.trim();
      if (captionRes.ok) {
        const captionData = await captionRes.json();
        caption = captionData.caption || caption;
      }

      const baseImg = await loadImg(imageUrl);
      const blankRow: CsvRow = { slide1_hook: "", slide1_subtitle: "", slide2_body: "", slide3_body: "", slide4_cta: "" };
      const blocks = makeBlocks(blankRow);

      const draftRows: any[] = [];
      let failCount = 0;
      for (const preset of connectedClients as ClientPreset[]) {
        try {
          let logoImg: HTMLImageElement | null = null;
          if ((preset as any).logoUrl) {
            try { logoImg = await loadImg((preset as any).logoUrl); } catch {}
          }
          const slideUrls = renderAllThumbs({ blocks, coverImg: baseImg, bodyImg: baseImg } as any, logoImg, preset, 0.9);
          const brandedDataUrl = slideUrls[0];
          const brandedUploadRes = await fetch(`${BASE}/api/content/upload-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: [{ name: `single-${Date.now()}.png`, base64: brandedDataUrl }] }),
          });
          if (!brandedUploadRes.ok) throw new Error("Branded image upload failed");
          const brandedUploadData = await brandedUploadRes.json();
          const brandedUrl = brandedUploadData?.results?.[0]?.url;
          if (!brandedUrl) throw new Error("No branded URL returned");
          draftRows.push({
            presetId: (preset as any).id,
            clientName: (preset as any).name || "",
            topicId: null,
            imageUrls: [brandedUrl],
            caption,
            title: caption.slice(0, 60),
          });
        } catch {
          failCount++;
        }
      }

      if (draftRows.length > 0) {
        const r = await fetch(`${BASE}/api/broadcast-drafts/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: draftRows }),
        });
        if (!r.ok) throw new Error("Could not save to pending queue");
        loadDrafts();
      }
      if (failCount === 0) {
        toast.success(`Added to Pending Queue for ${draftRows.length} clients, logo included.`);
      } else {
        toast.error(`${draftRows.length} added, ${failCount} failed. Check the pending queue.`);
      }
      clearSingleImage();
    } catch (e: any) {
      toast.error(e?.message || "Could not broadcast this photo.");
    } finally {
      setSingleImgBusy(false);
    }
  };

  const onPickSingleVideo = (file: File) => {
    setSingleVidFile(file);
    setSingleVidPreview(URL.createObjectURL(file));
  };

  const clearSingleVideo = () => {
    setSingleVidFile(null);
    setSingleVidPreview("");
    setSingleVidContext("");
    setSingleVidMusicTrack(null);
  };

  const broadcastSingleVideo = async () => {
    if (!singleVidFile) {
      toast.error("Choose a video first.");
      return;
    }
    if (!singleVidContext.trim()) {
      toast.error("Add a line about what is in the video, it helps the caption.");
      return;
    }
    if (connectedClients.length === 0) {
      toast.error("No connected clients to broadcast to.");
      return;
    }
    setSingleVidBusy(true);
    try {
      const videoUrl = await uploadVideoFile(singleVidFile);

      const captionRes = await fetch(`${BASE}/api/caption-generator/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: singleVidTone, context: singleVidContext.trim() }),
      });
      let caption = singleVidContext.trim();
      if (captionRes.ok) {
        const captionData = await captionRes.json();
        caption = captionData.caption || caption;
      }
      if (singleVidMusicTrack) {
        caption = `${caption}\n\n🎵 Suggested track: ${singleVidMusicTrack.name} - ${singleVidMusicTrack.artist} (add manually in Instagram, it does not attach automatically)`;
      }

      const draftRows = (connectedClients as ClientPreset[]).map((preset) => ({
        presetId: (preset as any).id,
        clientName: (preset as any).name || "",
        topicId: null,
        imageUrls: [videoUrl],
        caption,
        title: caption.slice(0, 60),
      }));

      const r = await fetch(`${BASE}/api/broadcast-drafts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: draftRows }),
      });
      if (!r.ok) throw new Error("Could not save to pending queue");
      loadDrafts();
      toast.success(`Added to Pending Queue for ${draftRows.length} clients as reels.`);
      clearSingleVideo();
    } catch (e: any) {
      toast.error(e?.message || "Could not broadcast this video.");
    } finally {
      setSingleVidBusy(false);
    }
  };

  const scheduleDraft = async (draft: Draft) => {
    const localValue = draftTimes[draft.id];
    if (!localValue) {
      toast.error("Pick a date and time first.");
      return;
    }
    setSchedulingId(draft.id);
    try {
      const scheduledAt = new Date(localValue).toISOString();
      const isVideo = isVideoUrl(draft.imageUrls?.[0] || "");
      const scheduleRes = await fetch(`${BASE}/api/scheduler/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: draft.presetId,
          postType: isVideo ? "reel" : "carousel",
          content: isVideo
            ? {
                videoUrl: draft.imageUrls[0],
                caption: draft.caption,
                title: draft.title,
                platforms: ["instagram", "facebook"],
              }
            : {
                imageUrls: draft.imageUrls,
                caption: draft.caption,
                title: draft.title,
                platforms: ["instagram", "facebook"],
              },
          scheduledAt,
        }),
      });
      if (!scheduleRes.ok) throw new Error("Schedule failed");
      await fetch(`${BASE}/api/broadcast-drafts/${draft.id}`, { method: "DELETE" });
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success(`Scheduled for ${draft.clientName}.`);
    } catch (e: any) {
      toast.error(e?.message || "Schedule failed");
    } finally {
      setSchedulingId(null);
    }
  };

  const scheduleAllForGroup = async (group: Draft[]) => {
    for (const draft of group) {
      const preset = (presets || []).find((p: any) => p.id === draft.presetId);
      const offsetMinutes = nameBucketOffsetMinutes((preset as any)?.name || "");
      const base = new Date(draftTimes[draft.id] || defaultLocalDateTime((preset as any)?.defaultPostTime));
      base.setMinutes(base.getMinutes() + offsetMinutes);
      const pad = (n: number) => String(n).padStart(2, "0");
      const staggered = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
      setDraftTimes((prev) => ({ ...prev, [draft.id]: staggered }));
      await scheduleDraft({ ...draft });
    }
  };

  const discardDraft = async (draft: Draft) => {
    await fetch(`${BASE}/api/broadcast-drafts/${draft.id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
  };

  const draftGroups = useMemo(() => {
    const map = new Map<string, Draft[]>();
    for (const d of drafts) {
      const key = d.topicId != null ? `topic-${d.topicId}` : `single-${d.title}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries());
  }, [drafts]);

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
            Generic content library. Broadcast a topic or a photo to build branded posts for every client, they wait in the queue until you set a time.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {drafts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-pink-500" />
              <h2 className="font-semibold text-sm">Pending Queue ({drafts.length})</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Nothing here is scheduled yet. Set a date and time on each one, or a whole batch, to send it to the scheduler.</p>
            {draftsLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading queue...</div>}
            <div className="space-y-6">
              {draftGroups.map(([groupKey, group]) => {
                const first = group[0];
                const topic = first.topicId != null ? topics.find((t) => t.id === first.topicId) : null;
                const label = topic ? topic.slide1Hook : (first.title || "Broadcast batch");
                const thumb = first.imageUrls?.[0];
                return (
                  <div key={groupKey} className="rounded-2xl border border-border/50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {thumb && (isVideoUrl(thumb) ? (
                          <video src={thumb} muted className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <img src={thumb} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        ))}
                        <p className="font-semibold text-sm truncate">{label}</p>
                      </div>
                      <button
                        onClick={() => scheduleAllForGroup(group)}
                        className="text-xs px-3 py-1.5 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Schedule all with stagger
                      </button>
                    </div>
                    <div className="space-y-2">
                      {group.map((draft) => (
                        <div key={draft.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{draft.clientName}</p>
                            {draft.caption && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{draft.caption}</p>
                            )}
                          </div>
                          <input
                            type="datetime-local"
                            value={draftTimes[draft.id] || ""}
                            onChange={(e) => setDraftTimes((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                            className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-xs text-white outline-none focus:border-pink-600"
                          />
                          <button
                            onClick={() => scheduleDraft(draft)}
                            disabled={schedulingId === draft.id}
                            className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {schedulingId === draft.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                            Schedule
                          </button>
                          <button onClick={() => discardDraft(draft)} className="text-zinc-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-pink-500" />
            <h2 className="font-semibold text-sm">Upload a single photo</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Drop in one finished photo, add a line about what it is, and it writes a caption, adds every connected client logo, and drops it in the Pending Queue above. Nothing is scheduled until you set a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="shrink-0 w-24 h-24 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center cursor-pointer text-zinc-500 hover:border-pink-600 hover:text-pink-500 overflow-hidden">
              {singleImgPreview ? (
                <img src={singleImgPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={singleImgBusy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickSingleImage(f); e.target.value = ""; }}
              />
            </label>
            <div className="flex-1 space-y-2">
              <input
                value={singleImgContext}
                onChange={(e) => setSingleImgContext(e.target.value)}
                placeholder="What is in the photo? e.g. before and after lip filler, patient thrilled"
                className={inputCls}
                disabled={singleImgBusy}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={singleImgTone}
                  onChange={(e) => setSingleImgTone(e.target.value)}
                  disabled={singleImgBusy}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-600"
                >
                  {CAPTION_TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={broadcastSingleImage}
                  disabled={singleImgBusy || !singleImgFile}
                  className="flex-1 rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  {singleImgBusy ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Broadcast this photo</>
                  )}
                </button>
                {singleImgFile && !singleImgBusy && (
                  <button onClick={clearSingleImage} className="text-zinc-500 hover:text-red-400 px-2 shrink-0"><X className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-pink-500" />
            <h2 className="font-semibold text-sm">Upload a single video or animated post</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Drop in one finished video or animated post, already branded and ready to go, add a line about what it is, and it writes a caption and drops it in the Pending Queue above as a reel for every client. Nothing is scheduled until you set a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="shrink-0 w-24 h-24 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center cursor-pointer text-zinc-500 hover:border-pink-600 hover:text-pink-500 overflow-hidden">
              {singleVidPreview ? (
                <video src={singleVidPreview} muted className="w-full h-full object-cover" />
              ) : (
                <Film className="w-6 h-6" />
              )}
              <input
                type="file"
                accept="video/*,image/gif"
                className="hidden"
                disabled={singleVidBusy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickSingleVideo(f); e.target.value = ""; }}
              />
            </label>
            <div className="flex-1 space-y-2">
              <input
                value={singleVidContext}
                onChange={(e) => setSingleVidContext(e.target.value)}
                placeholder="What is in the video? e.g. quick before and after walkthrough"
                className={inputCls}
                disabled={singleVidBusy}
              />
              {singleVidMusicTrack ? (
                <MusicTrackBadge track={singleVidMusicTrack} onRemove={() => setSingleVidMusicTrack(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setMusicPickerOpen(true)}
                  className="text-xs font-medium text-muted-foreground hover:text-pink-400 flex items-center gap-1.5 rounded-lg border border-border/50 hover:border-pink-500/40 px-3 py-1.5 w-fit"
                >
                  <Music className="w-3.5 h-3.5" /> Add music
                </button>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={singleVidTone}
                  onChange={(e) => setSingleVidTone(e.target.value)}
                  disabled={singleVidBusy}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-600"
                >
                  {CAPTION_TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={broadcastSingleVideo}
                  disabled={singleVidBusy || !singleVidFile}
                  className="flex-1 rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  {singleVidBusy ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Broadcast this video</>
                  )}
                </button>
                {singleVidFile && !singleVidBusy && (
                  <button onClick={clearSingleVideo} className="text-zinc-500 hover:text-red-400 px-2 shrink-0"><X className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
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

          <p className="text-xs text-muted-foreground">{connectedClients.length} connected client{connectedClients.length === 1 ? "" : "s"} will get each broadcast added to the pending queue. Add your own photo to a topic before sending, otherwise it goes out as text only.</p>

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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Building {progress.done}/{progress.total}...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Broadcast to all clients</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {musicPickerOpen && (
        <MusicPickerModal
          open={musicPickerOpen}
          onClose={() => setMusicPickerOpen(false)}
          selectedTrack={singleVidMusicTrack}
          onSelect={(track) => setSingleVidMusicTrack(track)}
        />
      )}
    </div>
  );
}
