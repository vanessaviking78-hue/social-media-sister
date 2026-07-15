import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, AlertTriangle, Inbox, Unplug, RotateCcw, Loader2 } from "lucide-react";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// gone-quiet threshold: if a client has posted before but nothing on a
// connected platform in this many days, they show up in "put the fires out first".
const QUIET_DAYS = 5;

type Item = { name: string; note?: string };
type Section = { key: string; title: string; blurb: string; icon: "fire" | "inbox" | "unplug"; items: Item[] };

type ScheduledPost = {
  id: number;
  presetId: number;
  scheduledAt: string;
  status: string;
  metaPostedAt: string | null;
  metaResult: { igPostId?: string; fbPostId?: string; error?: string } | null;
};

const STORAGE_KEY = "catchUpPlan-v1";

function loadDone(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function CatchUpPlan() {
  const { presets, loading: presetsLoading } = usePresets();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const r = await fetch(`${BASE}/api/scheduler/posts?status=published`);
      const data = await r.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    setDone(loadDone());
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  }, [done]);

  const SECTIONS: Section[] = useMemo(() => {
    const fires: Item[] = [];
    const neverPosted: Item[] = [];
    const notConnected: Item[] = [];

    for (const preset of presets) {
      const fbConnected = !!preset.metaFacebookPageId;
      const igConnected = !!preset.metaInstagramAccountId;

      if (!fbConnected && !igConnected) {
        notConnected.push({ name: preset.name });
        continue;
      }

      const clientPosts = posts.filter((p) => p.presetId === preset.id);
      let lastFb: string | null = null;
      let lastIg: string | null = null;
      for (const p of clientPosts) {
        const when = p.metaPostedAt || p.scheduledAt;
        if (p.metaResult?.fbPostId && (!lastFb || when > lastFb)) lastFb = when;
        if (p.metaResult?.igPostId && (!lastIg || when > lastIg)) lastIg = when;
      }

      const everPosted = !!lastFb || !!lastIg;
      if (!everPosted) {
        neverPosted.push({ name: preset.name });
        continue;
      }

      const staleParts: string[] = [];
      let maxGap = 0;
      if (fbConnected) {
        const gap = lastFb ? daysSince(lastFb) : Infinity;
        if (gap >= QUIET_DAYS) { staleParts.push("Facebook"); maxGap = Math.max(maxGap, gap === Infinity ? 999 : gap); }
      }
      if (igConnected) {
        const gap = lastIg ? daysSince(lastIg) : Infinity;
        if (gap >= QUIET_DAYS) { staleParts.push("Instagram"); maxGap = Math.max(maxGap, gap === Infinity ? 999 : gap); }
      }
      if (staleParts.length > 0) {
        const gapLabel = maxGap >= 999 ? "no posts yet" : `${maxGap} day${maxGap === 1 ? "" : "s"} since last ${staleParts.join(" and ")} post`;
        fires.push({ name: preset.name, note: gapLabel, });
      }
    }

    // worst gaps first
    fires.sort((a, b) => {
      const da = parseInt(a.note || "0", 10);
      const db = parseInt(b.note || "0", 10);
      return db - da;
    });
    neverPosted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    notConnected.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return [
      {
        key: "fires",
        title: "Put the fires out first",
        blurb: `Already had a rhythm going, now gone quiet (${QUIET_DAYS}+ days on a connected platform). Most likely to notice and message you.`,
        icon: "fire",
        items: fires,
      },
      {
        key: "never-posted",
        title: "Never had a single post go out",
        blurb: "Connected to Meta, zero published posts ever. One sitting, ten minutes each, clears the whole batch.",
        icon: "inbox",
        items: neverPosted,
      },
      {
        key: "not-connected",
        title: "Not connected to Meta at all",
        blurb: "Check each is still an active, paying client before spending time connecting or building content.",
        icon: "unplug",
        items: notConnected,
      },
    ];
  }, [presets, posts]);

  const totalItems = useMemo(() => SECTIONS.reduce((n, s) => n + s.items.length, 0), [SECTIONS]);
  const totalDone = useMemo(
    () => SECTIONS.reduce((n, s) => n + s.items.filter((it) => done[it.name]).length, 0),
    [SECTIONS, done]
  );

  function toggle(name: string) {
    setDone((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function resetPlan() {
    if (!window.confirm("Clear all ticks on this catch-up plan?")) return;
    setDone({});
  }

  const isLoading = presetsLoading || postsLoading;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Catch-Up Plan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "Loading live status…" : `${totalDone}/${totalItems} sorted`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadPosts}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
        >
          {postsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
        <button
          type="button"
          onClick={resetPlan}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
        >
          Clear ticks
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Pulling live status for every client…
          </div>
        )}
        {!isLoading && SECTIONS.map((section, sIdx) => {
          const sectionDone = section.items.filter((it) => done[it.name]).length;
          const Icon = section.icon === "fire" ? AlertTriangle : section.icon === "inbox" ? Inbox : Unplug;
          const accent =
            section.icon === "fire"
              ? "text-red-400 border-red-500/30"
              : section.icon === "inbox"
              ? "text-amber-400 border-amber-500/30"
              : "text-zinc-400 border-zinc-500/30";
          return (
            <section key={section.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full border ${accent} text-xs font-semibold shrink-0`}>
                  {sIdx + 1}
                </span>
                <Icon className={`w-4 h-4 ${accent.split(" ")[0]} shrink-0`} />
                <h2 className="font-semibold text-base">{section.title}</h2>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {sectionDone}/{section.items.length}
                </span>
              </div>
              <p className="text-sm text-muted-foreground -mt-1">{section.blurb}</p>
              {section.items.length === 0 ? (
                <p className="text-sm text-muted-foreground/70 italic px-1">Nothing here right now.</p>
              ) : (
                <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                  {section.items.map((item) => (
                    <label
                      key={item.name}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-card/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!!done[item.name]}
                        onChange={() => toggle(item.name)}
                        className="w-4 h-4 accent-pink-500 shrink-0"
                      />
                      <span className={`text-sm font-medium ${done[item.name] ? "line-through text-muted-foreground" : ""}`}>
                        {item.name}
                      </span>
                      {item.note && (
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.note}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
