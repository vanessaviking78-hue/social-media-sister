import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Target, Bell, RotateCcw, Loader2 } from "lucide-react";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ScheduledPost = {
  id: number;
  presetId: number;
  clientName: string;
  scheduledAt: string;
  metaPostedAt: string | null;
  metaResult: { igPostId?: string; fbPostId?: string } | null;
};

type ClientMeta = {
  excluded?: boolean;
  priorityToday?: boolean;
  invoiceDay?: number;
  invoiceAmount?: string;
  renewalDate?: string;
  note?: string;
  oneOff?: string;
};

const CLIENT_META: Record<string, ClientMeta> = {
  "a d aesthetics pharmacist ltd": { invoiceDay: 1, invoiceAmount: "£575/quarter", oneOff: "Contact her — work underway" },
  "amii": { note: "Free client" },
  "annorlunda aesthetics": { oneOff: "URGENT — send content-day images/videos, add Shorts/Reels to weekly schedule" },
  "aspyre aesthetics": { invoiceAmount: "£2950/yr", renewalDate: "2027-02-16" },
  "behold me": { invoiceDay: 25, invoiceAmount: "£250" },
  "cantik aesthetics": { note: "Floating — upload in 2-month batches" },
  "castle clinic": { note: "Bundled under Dr Lisa aesthetics invoice (20th)" },
  "ck": { invoiceDay: 28, invoiceAmount: "£250" },
  "craig hobson aesthetics": { excluded: true },
  "ct": { renewalDate: "2026-07-31", note: "CASH payment", oneOff: "One-off free content day — make-good re: Emma/engagement" },
  "digital dentists": { excluded: true },
  "dr kathryn": { invoiceAmount: "£1450/yr", renewalDate: "2027-01-10" },
  "dr lisa academy": { note: "Bundled under Dr Lisa aesthetics invoice (20th)" },
  "dr lisa aesthetics": { invoiceDay: 20, invoiceAmount: "£750 bundle (Academy + Castle Clinic)" },
  "dr v": { invoiceDay: 14, invoiceAmount: "£175" },
  "eaton": { invoiceDay: 28, invoiceAmount: "£300" },
  "equilibrium": { excluded: true },
  "eva garcia academy": { excluded: true },
  "eva garcia aesthetics": { oneOff: "Blocker: help her connect to Meta — renewal on hold until live" },
  "forever young": { invoiceDay: 28, invoiceAmount: "£350" },
  "hair by leah": { note: "Freebie — barters haircuts" },
  "harwood": { invoiceAmount: "£2450/yr", renewalDate: "2027-02-16" },
  "highcroft aesthetics": { invoiceAmount: "£4000/yr", renewalDate: "2027-04-03" },
  "kahlo skin & soul": { priorityToday: true, invoiceAmount: "£150/mo", note: "Renewal = day of first post" },
  "kelly rafique": { invoiceAmount: "£1950/yr", renewalDate: "2026-11-01" },
  "lotus rooms": { priorityToday: true, note: "One-off £150, no invoice — month's content not made yet" },
  "madame wax": { note: "90-day trial from go-live 20 Jul", oneOff: "Create the sibling 'Madame Skin' account" },
  "nova aesthetics": { invoiceAmount: "£800/6mo", renewalDate: "2026-12-01" },
  "pip": { excluded: true },
  "pjp academy": { excluded: true },
  "pura": { invoiceDay: 26, invoiceAmount: "£200" },
  "rebecca gledhill": { excluded: true },
  "samantha grant aesthetics": { excluded: true },
  "sample": { excluded: true },
  "social media sister": { excluded: true, note: "Your own business — covered by the personal slots" },
  "teviot": { priorityToday: true, note: "Needs impressing", renewalDate: "2027-03-01" },
  "the church street clinic": { invoiceAmount: "£1450/yr", renewalDate: "2026-11-21" },
  "the compliance clinic": { excluded: true },
  "the glow getter": { invoiceDay: 9, invoiceAmount: "£90" },
  "the_media_madhouse": { note: "Your own business — included in the 10 slots" },
  "the ryder clinic": { note: "90-day trial — £500/3mo then 12-for-6 offer" },
  "timeless by sarah": { renewalDate: "2026-12-15", invoiceAmount: "TBC/yr" },
  "tweaked by helen": { oneOff: "Free month ended 5 Jul — send the post-trial offer" },
};

const STORAGE_PREFIX = "dailyFocus-";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function todaysContentType(): string {
  const d = new Date().getDay();
  if (d === 1 || d === 5) return "Seamless carousel";
  if (d === 3) return "AI-image carousel";
  if (d === 4) return "Before & after (if requested)";
  if (d === 0) return "Tweet / quote";
  return "Catch-up / flex slot";
}

function nextInvoiceDate(day: number): Date {
  const now = new Date();
  const todayDate = now.getDate();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (day < todayDate) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return new Date(year, month, day);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const PERSONAL_SALES = [
  "Follow up with one warm lead — a message, not an essay.",
  "Send one outreach message to a prospective clinic.",
  "Chase one overdue invoice or check a payment landed.",
  "Post one piece of content selling The CyberSuite itself.",
  "Reply to anyone who's been sitting in your DMs.",
  "Review pricing or packages for one offer you're running.",
  "Ask one happy client for a testimonial or referral.",
];

function personalSalesTask(): string {
  return PERSONAL_SALES[new Date().getDay() % PERSONAL_SALES.length];
}

type Item = { key: string; label: string; note?: string; priority?: boolean };

export default function DailyFocus() {
  const { presets, loading: presetsLoading } = usePresets();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const storageKey = STORAGE_PREFIX + todayKey();

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const r = await fetch(BASE + "/api/scheduler/posts?status=published");
      const data = await r.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setDone(raw ? JSON.parse(raw) : {});
    } catch {
      setDone({});
    }
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(done));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function toggle(key: string) {
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const clientTasks: Item[] = useMemo(() => {
    const rows: { name: string; gap: number; priority: boolean }[] = [];
    for (const preset of presets) {
      const meta = CLIENT_META[preset.name.trim().toLowerCase()];
      if (meta && meta.excluded) continue;
      const clientPosts = posts.filter((p) => p.presetId === preset.id);
      let last: string | null = null;
      for (const p of clientPosts) {
        const when = p.metaPostedAt || p.scheduledAt;
        if ((p.metaResult && (p.metaResult.fbPostId || p.metaResult.igPostId)) && (!last || when > last)) last = when;
      }
      const gap = last ? daysSince(last) : 999;
      rows.push({ name: preset.name, gap, priority: !!(meta && meta.priorityToday) });
    }
    rows.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return b.gap - a.gap;
    });
    return rows.slice(0, 10).map((r) => ({
      key: "client-" + r.name,
      label: r.name,
      note: (r.gap >= 999 ? "Never posted" : r.gap + " day" + (r.gap === 1 ? "" : "s") + " since last post") + " · " + todaysContentType(),
      priority: r.priority,
    }));
  }, [presets, posts]);

  const personalTasks: Item[] = [
    { key: "personal-sales", label: personalSalesTask(), note: "Personal — sales & income" },
    { key: "personal-content", label: "Create or post one piece of content for The Media Madhouse / CyberSuite", note: "Personal — your own content" },
  ];

  const allTasks = [...personalTasks, ...clientTasks];

  const reminders: Item[] = useMemo(() => {
    const items: Item[] = [];
    const now = new Date();
    for (const name of Object.keys(CLIENT_META)) {
      const meta = CLIENT_META[name];
      if (meta.excluded) continue;
      if (meta.oneOff) {
        items.push({ key: "oneoff-" + name, label: meta.oneOff, note: titleCase(name) });
      }
      if (meta.renewalDate) {
        const days = Math.ceil((new Date(meta.renewalDate).getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= 30) {
          items.push({ key: "renewal-" + name, label: "Renewal in " + days + " day" + (days === 1 ? "" : "s"), note: titleCase(name) + (meta.invoiceAmount ? " · " + meta.invoiceAmount : "") });
        }
      }
      if (meta.invoiceDay) {
        const due = nextInvoiceDate(meta.invoiceDay);
        const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= 7) {
          items.push({ key: "invoice-" + name, label: "Invoice due in " + days + " day" + (days === 1 ? "" : "s") + (meta.invoiceAmount ? " — " + meta.invoiceAmount : ""), note: titleCase(name) });
        }
      }
    }
    return items;
  }, []);

  const totalDone = allTasks.filter((t) => done[t.key]).length;
  const isLoading = presetsLoading || postsLoading;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Daily Focus</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dayLabel()} · {isLoading ? "Loading…" : totalDone + "/" + allTasks.length + " done"}
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
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Building today's list…
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-pink-400" />
                <h2 className="font-semibold text-base">Today's 12</h2>
                <span className="text-xs text-muted-foreground ml-auto">2 personal + {clientTasks.length} client</span>
              </div>
              <p className="text-sm text-muted-foreground -mt-1">Tick each one off. Priority clients are pinned to the top.</p>
              <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                {allTasks.map((item) => (
                  <label key={item.key} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-card/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!done[item.key]}
                      onChange={() => toggle(item.key)}
                      className="w-4 h-4 accent-pink-500 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={"text-sm font-medium block " + (done[item.key] ? "line-through text-muted-foreground" : "")}>
                        {item.label}
                        {item.priority && <span className="ml-2 text-[10px] uppercase tracking-wide text-pink-400 border border-pink-500/40 rounded px-1.5 py-0.5 align-middle">priority</span>}
                      </span>
                      {item.note && <span className="text-xs text-muted-foreground block">{item.note}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {reminders.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h2 className="font-semibold text-base">Reminders</h2>
                  <span className="text-xs text-muted-foreground ml-auto">{reminders.length}</span>
                </div>
                <p className="text-sm text-muted-foreground -mt-1">Renewals, invoicing and flagged one-offs. Not part of the 12 — just don't lose them.</p>
                <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                  {reminders.map((item) => (
                    <label key={item.key} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-card/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!done[item.key]}
                        onChange={() => toggle(item.key)}
                        className="w-4 h-4 accent-amber-500 mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className={"text-sm font-medium block " + (done[item.key] ? "line-through text-muted-foreground" : "")}>{item.label}</span>
                        {item.note && <span className="text-xs text-muted-foreground block">{item.note}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
