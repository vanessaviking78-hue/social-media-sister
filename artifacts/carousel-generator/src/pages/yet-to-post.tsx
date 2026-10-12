import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Check, CheckCircle2, Loader2, PackageOpen, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Day = "Mon" | "Wed" | "Fri" | "Sun";
type Meta = {
  bundle: string;
  week: number;
  day: Day;
  kind: "treatment" | "wont-will" | "nostalgia" | "tweet";
  format: "post" | "story" | "reel";
  slotKey: string;
  approved?: boolean;
};
type Content = {
  caption?: string;
  title?: string;
  imageUrls?: string[];
  videoUrl?: string;
  question?: string;
  firstComment?: string;
  platforms?: string[];
  sourceTool?: string;
};
type Item = { id: number; postType: string; content: Content; meta: Meta };
type ClientTile = { presetId: number; clientName: string; posts: number; stories: number; reels: number; approved: number; total: number; updatedAt: string };

const DAY_NAMES: Record<Day, string> = { Mon: "Monday", Wed: "Wednesday", Fri: "Friday", Sun: "Sunday" };
const KIND_NAMES: Record<Meta["kind"], string> = {
  treatment: "Treatment",
  "wont-will": "Things I won't, or will",
  nostalgia: "Nostalgia and relatable",
  tweet: "Tweet",
};
const DAY_ORDER: Day[] = ["Mon", "Wed", "Fri", "Sun"];

function src(url: string) {
  return url.startsWith("/") ? `${BASE}${url}` : url;
}

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data;
}

export default function YetToPost() {
  const { presets } = usePresets();
  const [tiles, setTiles] = useState<ClientTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientTile | null>(null);

  const loadTiles = useCallback(() => {
    setLoading(true);
    api("/yet-to-post")
      .then((d) => setTiles(Array.isArray(d.clients) ? d.clients : []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTiles(); }, [loadTiles]);

  if (selected) {
    return (
      <ClientView
        tile={selected}
        presets={presets}
        onBack={() => { setSelected(null); loadTiles(); }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <div className="flex items-center gap-3">
          <PackageOpen className="w-6 h-6 text-pink-400" />
          <h1 className="text-2xl font-bold">Yet to post</h1>
          <button onClick={loadTiles} className="ml-auto px-3 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm flex items-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Finished content waiting for you, one place per client. Nothing here is scheduled until you say so.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && tiles.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">Nothing waiting</p>
            <p className="text-sm">When a client's bundle is finished it lands here, ready for you to finalise and schedule.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => {
            const pct = t.total ? Math.round((t.approved / t.total) * 100) : 0;
            return (
              <button
                key={t.presetId}
                onClick={() => setSelected(t)}
                className="text-left rounded-xl border border-border/40 hover:border-pink-500/60 bg-gradient-to-br from-pink-500/10 to-transparent p-4 transition-colors"
              >
                <p className="text-base font-semibold truncate">{t.clientName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.posts} post{t.posts !== 1 ? "s" : ""} · {t.stories} stor{t.stories !== 1 ? "ies" : "y"} · {t.reels} reel{t.reels !== 1 ? "s" : ""}
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-pink-400" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">{t.approved} of {t.total} approved</p>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function ClientView({ tile, presets, onBack }: { tile: ClientTile; presets: { id: number; name: string }[]; onBack: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<"carousel" | "single-image" | { reel: Item } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api(`/yet-to-post/${tile.presetId}`)
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [tile.presetId]);

  useEffect(() => { load(); }, [load]);

  const slots = useMemo(() => {
    const map = new Map<string, { post?: Item; story?: Item; reel?: Item; week: number; day: Day }>();
    for (const it of items) {
      let s = map.get(it.meta.slotKey);
      if (!s) { s = { week: it.meta.week, day: it.meta.day }; map.set(it.meta.slotKey, s); }
      s[it.meta.format] = it;
    }
    return [...map.entries()]
      .map(([key, s]) => ({ key, ...s }))
      .sort((a, b) => a.week - b.week || DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  }, [items]);

  const weeks = [...new Set(slots.map((s) => s.week))];
  const approvedSlots = slots.filter((s) => s.post?.meta.approved);
  const total = items.length;
  const approvedCount = items.filter((i) => i.meta.approved).length;

  async function patch(id: number, body: { approved?: boolean; caption?: string; question?: string }) {
    try {
      const d = await api(`/yet-to-post/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, content: d.content, meta: d.content.yetToPost ?? i.meta } : i));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function toggleSlot(slot: (typeof slots)[number]) {
    const next = !slot.post?.meta.approved;
    const parts = [slot.post, slot.story, slot.reel].filter(Boolean) as Item[];
    await Promise.all(parts.map((p) => patch(p.id, { approved: next })));
  }

  async function remove(item: Item) {
    if (!confirm("Remove this from Yet to post? This can't be undone.")) return;
    try {
      await api(`/yet-to-post/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function afterScheduled(slotsDone: typeof slots) {
    const ids = slotsDone.flatMap((s) => [s.post, s.story].filter(Boolean) as Item[]).map((i) => i.id);
    await Promise.all(ids.map((id) => fetch(`${BASE}/api/yet-to-post/${id}`, { method: "DELETE" }).catch(() => null)));
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setScheduling(null);
  }

  const carouselSlots = approvedSlots.filter((s) => s.post!.postType === "carousel");
  const tweetSlots = approvedSlots.filter((s) => s.post!.postType === "single-image");

  function payloadFor(slotsIn: typeof slots): SchedulePostPayload[] {
    return slotsIn.map((s) => ({
      title: s.post!.content.title || "",
      caption: s.post!.content.caption || "",
      imageUrls: s.post!.content.imageUrls,
      firstComment: s.post!.content.firstComment,
      platforms: s.post!.content.platforms,
      sourceTool: "Yet to post",
    }));
  }

  function storiesFor(slotsIn: typeof slots) {
    const list = slotsIn.map((s) => s.story?.content.imageUrls?.[0]);
    if (list.some((u) => !u)) return undefined; // companion stories need one per post
    return slotsIn.map((s) => ({
      imageUrl: s.story!.content.imageUrls![0],
      title: s.story!.content.title || "",
      question: s.story!.content.question,
    }));
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onBack} className="p-2 rounded-lg border border-border/50 hover:border-pink-500/60" aria-label="Back to all clients">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-bold">{tile.clientName}</h1>
          <span className="text-sm text-muted-foreground">{approvedCount} of {total} approved</span>
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              disabled={carouselSlots.length === 0}
              onClick={() => setScheduling("carousel")}
              className="px-3 py-2 rounded-lg bg-pink-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-pink-400 disabled:opacity-40"
            >
              <CalendarClock className="w-4 h-4" /> Schedule approved posts ({carouselSlots.length})
            </button>
            <button
              disabled={tweetSlots.length === 0}
              onClick={() => setScheduling("single-image")}
              className="px-3 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"
            >
              <CalendarClock className="w-4 h-4" /> Schedule approved tweets ({tweetSlots.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && slots.length === 0 && (
          <p className="text-center text-muted-foreground py-16">Everything for {tile.clientName} has been scheduled or removed.</p>
        )}

        {weeks.map((w) => (
          <section key={w}>
            <h2 className="text-lg font-bold mb-3">Week {w}</h2>
            <div className="space-y-4">
              {slots.filter((s) => s.week === w).map((slot) => {
                const post = slot.post;
                const approved = !!post?.meta.approved;
                const main = post ?? slot.story ?? slot.reel!;
                return (
                  <div key={slot.key} className={`rounded-xl border p-4 ${approved ? "border-green-500/50 bg-green-500/5" : "border-border/40"}`}>
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <span className="text-sm font-semibold">{DAY_NAMES[slot.day]}</span>
                      <span className="text-xs text-muted-foreground">{KIND_NAMES[main.meta.kind]}</span>
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => toggleSlot(slot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${approved ? "bg-green-500 text-white border-green-500" : "border-border/50 hover:border-green-500/60"}`}
                        >
                          {approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          {approved ? "Approved" : "Approve"}
                        </button>
                        {post && (
                          <button onClick={() => remove(post)} className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-red-500/60 text-xs font-semibold text-red-300 flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="min-w-0 space-y-3">
                        {post && (
                          <>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {(post.content.imageUrls ?? []).map((u, i) => (
                                <img key={i} src={src(u)} alt={`Slide ${i + 1}`} className="h-28 w-auto rounded-md border border-border/40 object-cover bg-black/30 shrink-0" />
                              ))}
                            </div>
                            <CaptionBox value={post.content.caption || ""} onSave={(v) => patch(post.id, { caption: v })} />
                          </>
                        )}
                        {slot.reel && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-xs font-semibold mb-2">Reel</p>
                            {slot.reel.content.videoUrl && <video src={src(slot.reel.content.videoUrl)} controls className="h-40 rounded-md bg-black" />}
                            <CaptionBox value={slot.reel.content.caption || ""} onSave={(v) => patch(slot.reel!.id, { caption: v })} />
                            <button
                              onClick={() => setScheduling({ reel: slot.reel! })}
                              className="mt-2 px-3 py-1.5 rounded-lg border border-border/50 hover:border-pink-500/60 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <CalendarClock className="w-3.5 h-3.5" /> Schedule this reel
                            </button>
                          </div>
                        )}
                      </div>
                      {slot.story && (
                        <div className="w-[150px] shrink-0">
                          <p className="text-xs font-semibold mb-1">Story</p>
                          {slot.story.content.imageUrls?.[0] && (
                            <img src={src(slot.story.content.imageUrls[0])} alt="Story" className="w-[150px] rounded-md border border-border/40 object-cover bg-black/30" style={{ aspectRatio: "9 / 16" }} />
                          )}
                          <textarea
                            defaultValue={slot.story.content.question || ""}
                            rows={3}
                            onBlur={(e) => { if (e.target.value.trim() !== (slot.story!.content.question || "").trim()) patch(slot.story!.id, { question: e.target.value }); }}
                            className="mt-1 w-full rounded-md bg-white/5 border border-border/50 text-[11px] p-1.5 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {scheduling === "carousel" && (
        <ScheduleModal
          presetId={tile.presetId}
          presetName={tile.clientName}
          postType="carousel"
          posts={payloadFor(carouselSlots)}
          presets={presets}
          sourceTool="Yet to post"
          perPostCaptions
          postingDays
          companionStories={storiesFor(carouselSlots)}
          onClose={() => setScheduling(null)}
          onSaved={() => afterScheduled(carouselSlots)}
        />
      )}
      {scheduling === "single-image" && (
        <ScheduleModal
          presetId={tile.presetId}
          presetName={tile.clientName}
          postType="single-image"
          posts={payloadFor(tweetSlots)}
          presets={presets}
          sourceTool="Yet to post"
          perPostCaptions
          postingDays
          companionStories={storiesFor(tweetSlots)}
          onClose={() => setScheduling(null)}
          onSaved={() => afterScheduled(tweetSlots)}
        />
      )}
      {scheduling && typeof scheduling === "object" && (
        <ScheduleModal
          presetId={tile.presetId}
          presetName={tile.clientName}
          postType="reel"
          posts={[{
            title: scheduling.reel.content.title || "",
            caption: scheduling.reel.content.caption || "",
            videoUrl: scheduling.reel.content.videoUrl,
            sourceTool: "Yet to post",
          }]}
          presets={presets}
          sourceTool="Yet to post"
          onClose={() => setScheduling(null)}
          onSaved={async () => {
            const id = scheduling.reel.id;
            await fetch(`${BASE}/api/yet-to-post/${id}`, { method: "DELETE" }).catch(() => null);
            setItems((prev) => prev.filter((i) => i.id !== id));
            setScheduling(null);
          }}
        />
      )}
    </div>
  );
}

function CaptionBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <textarea
      value={text}
      rows={5}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text !== value) onSave(text); }}
      className="w-full rounded-lg bg-white/5 border border-border/50 text-sm p-3 resize-y"
    />
  );
}
