import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, CalendarClock, X, Film, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";
import { nextWeekday, WEEKDAY, POST_TIME } from "@/lib/schedule";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL || "/";

type Item = {
  id: string;
  file: File;
  url: string;
  caption: string;
  date: string;
  time: string;
  slices: number;
  status: "" | "splitting" | "uploading" | "scheduling" | "done" | "error";
  note?: string;
};

// Spread items across upcoming days starting from the next Wednesday, one per week.
function defaultDate(i: number): string {
  const first = new Date(`${nextWeekday(WEEKDAY.WED, POST_TIME)}T${POST_TIME}`);
  const d = new Date(first);
  d.setDate(d.getDate() + i * 7);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AnimatedCarousels() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const preset = useMemo(() => presets.find((p) => p.id === presetId) || null, [presets, presetId]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const vids = Array.from(files).filter((f) => f.type.startsWith("video/") || f.name.toLowerCase().endsWith(".mp4"));
    if (!vids.length) { toast.error("Please choose MP4 video files."); return; }
    setItems((prev) => {
      const start = prev.length;
      const next = vids.map((f, k) => ({
        id: `v-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        url: URL.createObjectURL(f),
        caption: "",
        date: defaultDate(start + k),
        time: POST_TIME,
        slices: 4,
        status: "" as const,
      }));
      return [...prev, ...next];
    });
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Optional CSV: columns caption,date,time — applied to items by row order.
  function importCsv(file: File) {
    const rd = new FileReader();
    rd.onload = () => {
      const lines = String(rd.result).split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) return;
      const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const ci = head.indexOf("caption"), di = head.indexOf("date"), ti = head.indexOf("time");
      const rows = lines.slice(1).map((l) => l.split(","));
      setItems((prev) => prev.map((it, k) => {
        const r = rows[k]; if (!r) return it;
        return {
          ...it,
          caption: ci >= 0 ? (r[ci] || it.caption).trim() : it.caption,
          date: di >= 0 && r[di] ? r[di].trim() : it.date,
          time: ti >= 0 && r[ti] ? r[ti].trim() : it.time,
        };
      }));
      toast.success("Captions and dates applied from CSV.");
    };
    rd.readAsText(file);
  }

  async function scheduleAll() {
    if (!preset) { toast.error("Pick a client first."); return; }
    if (!items.length) { toast.error("Add some wide videos first."); return; }
    setBusy(true);
    let ok = 0;
    for (const it of items) {
      try {
        update(it.id, { status: "splitting", note: "" });
        const fd = new FormData();
        fd.append("video", it.file);
        fd.append("slices", String(it.slices));
        const split = await fetch(`${BASE}api/content/split-video`, { method: "POST", body: fd });
        const splitData = await split.json();
        if (!split.ok || !splitData.clips?.length) throw new Error(splitData.error || "Video split failed");
        const videoUrls: string[] = splitData.clips.map((c: { url: string }) => c.url);

        update(it.id, { status: "scheduling" });
        const r = await fetch(`${BASE}api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: preset.id,
            postType: "video_carousel",
            content: {
              videoUrls,
              caption: it.caption || "",
              title: it.file.name.replace(/\.[^.]+$/, "").slice(0, 60),
              platforms: ["instagram", "facebook"],
            },
            scheduledAt: new Date(`${it.date}T${it.time}`).toISOString(),
          }),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Schedule failed"); }
        update(it.id, { status: "done" });
        ok++;
      } catch (e: any) {
        update(it.id, { status: "error", note: e?.message || "Failed" });
      }
    }
    setBusy(false);
    toast[ok === items.length ? "success" : "message"](`${ok} of ${items.length} animated carousels split and scheduled.`);
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <Link href="/hub"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
        <div>
          <h1 className="font-semibold text-lg">Animated Carousels</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Upload one wide MP4 (e.g. 4320x1440). We cut it into slides, keep them as MP4, and post as a proper video carousel, same idea as the Seamless Carousel tool but for video.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-2">
          <h2 className="font-semibold text-base">1. Choose a client</h2>
          <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">
            <option value="">Select a client...</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">2. Upload wide animated video (MP4)</h2>
          <label className="block border-2 border-dashed border-border/50 rounded-2xl p-10 text-center cursor-pointer hover:border-pink-500/60 transition-colors">
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Drop one wide MP4 per carousel, or click to browse. Add as many as you like, each becomes its own carousel.</span>
            <input type="file" accept="video/mp4,video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
          </label>
          <div className="flex items-center gap-3">
            <label className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm cursor-pointer">
              Import captions + dates (CSV)
              <input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.currentTarget.value = ""; }} />
            </label>
            <span className="text-xs text-muted-foreground">Columns: caption, date, time. Matched by order.</span>
          </div>
        </section>

        {items.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-base">3. Slides, captions and schedule</h2>
            {items.map((it, i) => (
              <div key={it.id} className="rounded-xl p-4 bg-card/40 border border-border/30">
                <div className="flex gap-4">
                  <video src={it.url} className="w-40 rounded-lg border border-white/10 shrink-0" style={{ aspectRatio: "3/1", objectFit: "cover" }} muted controls />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {it.file.name}</span>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <label className="text-xs text-muted-foreground">Cut into</label>
                      <select
                        value={it.slices}
                        onChange={(e) => update(it.id, { slices: Number(e.target.value) })}
                        className="bg-white/5 border border-border/50 rounded-md px-2 py-1 text-xs"
                      >
                        {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} slides</option>)}
                      </select>
                    </div>
                    <textarea value={it.caption} onChange={(e) => update(it.id, { caption: e.target.value })} placeholder="Caption..." rows={2} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <input type="date" value={it.date} onChange={(e) => update(it.id, { date: e.target.value })} className="flex-1 bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
                      <input type="time" value={it.time} onChange={(e) => update(it.id, { time: e.target.value })} className="flex-1 bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-sm" />
                    </div>
                    {it.status && (
                      <p className={`text-xs ${it.status === "done" ? "text-emerald-400" : it.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                        {it.status === "splitting" ? "Cutting into slides..." : it.status === "uploading" ? "Uploading..." : it.status === "scheduling" ? "Scheduling..." : it.status === "done" ? `Scheduled for ${it.date} at ${it.time}` : it.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Each wide video is cut into equal MP4 slides and posted as a video carousel to Instagram and Facebook.</p>
              <Button onClick={scheduleAll} disabled={busy || !preset} className="bg-pink-600 hover:bg-pink-700">
                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />}
                Cut and schedule {items.length} carousel{items.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
