import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, Loader2, Copy, RefreshCcw, Check, Star, Eye, EyeOff, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { authHeaders } from "@/lib/use-approval";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Kind = "personal" | "facts" | "availability" | "beforeafter" | "tweet";

type Post = {
  kind: Kind;
  day: string;
  hook: string;
  caption: string;
  replyWord: string;
  hashtags: string[];
  headline?: string;
  facts?: string[];
  beforeLabel?: string;
  afterLabel?: string;
  signOff?: string;
};

// Millie's own price list and policies, from her Instagram stories. Prefilled for The Nail Corner only.
const MILLIE_SERVICES =
  "Gel nails 15 pounds, plain builder gel 20 pounds, builder gel with French tip 22 pounds, builder gel with design 25 pounds, gel toes 15 pounds, French tip toes 22 pounds, soak offs 7 pounds, cuticle oil 3 pounds";
const MILLIE_POLICIES =
  "5 pound non-refundable deposit secures a booking. 15 minute grace period. 48 hours notice to cancel. 72 hour guarantee, any problems with the nails within 72 hours fixed free. No foreign infills or acrylic soak offs.";

const ORDER: Kind[] = ["personal", "facts", "availability", "beforeafter", "tweet"];

const META: Record<Kind, { title: string; blurb: string }> = {
  personal: { title: "Personal post", blurb: "A bit of Millie's week, so her followers feel they know her." },
  facts: { title: "Nail facts post", blurb: "Fun and true, never a lecture. Great for saves and shares." },
  availability: { title: "Availability post", blurb: "Gaps in the diary, written as a little treat, never pressure." },
  beforeafter: { title: "Before and after template", blurb: "Add Millie's photos, then use the words below." },
  tweet: { title: "Sunday tweet post", blurb: "A shareable tweet. Drop the text into Tweet Maker for the graphic." },
};

const inputCls =
  "w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-pink-500 outline-none px-3 py-2 text-sm text-white placeholder:text-zinc-600";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{children}</span>;
}

function fullCaption(p: Post): string {
  return `${p.caption}\n\n${p.hashtags.join(" ")}`;
}

type NailReview = {
  id: number;
  salon: string;
  owner: string | null;
  name: string;
  handle: string | null;
  email: string | null;
  average: number;
  ratings: Record<string, number>;
  heart: string;
  reviewText: string | null;
  approved: boolean;
  createdAt: string;
};

const REVIEW_CATS: { k: string; label: string }[] = [
  { k: "welcome", label: "The welcome" },
  { k: "finish", label: "The finish" },
  { k: "creativity", label: "The creativity" },
  { k: "clean", label: "Clean and comfy" },
  { k: "rebook", label: "Would rebook" },
];

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-zinc-700"} />
      ))}
    </span>
  );
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "...";
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

// Black, cream and gold card, the same one the client sees after she sends her review.
function reviewCardPng(r: NailReview): string {
  const GOLD = "#c9a24b";
  const CREAM = "#f3ece4";
  const cv = document.createElement("canvas");
  cv.width = 1080;
  cv.height = 1350;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, 1080, 16);
  ctx.fillRect(0, 1334, 1080, 16);
  ctx.fillStyle = "#1c1a16";
  ctx.beginPath();
  ctx.arc(960, 150, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`A REVIEW FOR ${r.salon}`.toUpperCase().slice(0, 44), 540, 100);
  const size = 72;
  const x0 = 540 - (5 * size + 40) / 2;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < Math.round(r.average) ? GOLD : "#3a3631";
    ctx.font = size + "px Georgia";
    ctx.textAlign = "left";
    ctx.fillText("★", x0 + i * (size + 10), 215);
  }
  ctx.fillStyle = CREAM;
  ctx.font = "900 46px Arial";
  ctx.textAlign = "center";
  ctx.fillText(Number(r.average).toFixed(1) + " out of 5", 540, 290);
  ctx.textAlign = "left";
  ctx.font = "26px Arial";
  let y = 360;
  REVIEW_CATS.forEach((c) => {
    const v = Number(r.ratings?.[c.k] || 0);
    ctx.fillStyle = CREAM;
    ctx.fillText(c.label, 90, y);
    ctx.fillStyle = "#2a2723";
    ctx.fillRect(560, y - 22, 320, 18);
    ctx.fillStyle = GOLD;
    ctx.fillRect(560, y - 22, 320 * (v / 5), 18);
    ctx.fillStyle = "#c9bfb0";
    ctx.fillText(v + "/5", 905, y);
    y += 52;
  });
  ctx.fillStyle = GOLD;
  ctx.font = "bold 150px Georgia";
  ctx.fillText("“", 80, 690);
  let qs = 38;
  if (r.heart.length > 520) qs = 32;
  if (r.heart.length > 800) qs = 28;
  ctx.fillStyle = CREAM;
  ctx.font = `italic ${qs}px Georgia`;
  const lh = Math.round(qs * 1.42);
  wrapLines(ctx, r.heart, 100, 740, 880, lh, Math.floor((1210 - 720) / lh));
  ctx.fillStyle = CREAM;
  ctx.font = "900 36px Arial";
  ctx.fillText(r.name + (r.handle ? " " + (r.handle.startsWith("@") ? r.handle : "@" + r.handle) : ""), 100, 1265);
  return cv.toDataURL("image/png");
}

function ReviewsSection({ salon, owner }: { salon: string; owner: string }) {
  const [reviews, setReviews] = useState<NailReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const q = `salon=${encodeURIComponent(salon)}&owner=${encodeURIComponent(owner)}`;
  const formLink = `${origin}/nail-reviews?${q}`;
  const wallLink = `${origin}/nail-wall?${q}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/nail-reviews?salon=${encodeURIComponent(salon)}`, { headers: authHeaders() });
      const data = await r.json();
      if (Array.isArray(data.reviews)) setReviews(data.reviews);
      else toast.error(data.error || "Could not load reviews");
    } catch {
      toast.error("Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [salon]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const n = reviews.length;
    if (!n) return null;
    return {
      n,
      overall: reviews.reduce((a, r) => a + Number(r.average), 0) / n,
      approved: reviews.filter((r) => r.approved).length,
    };
  }, [reviews]);

  async function copyLink(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Copy did not work, select the link and copy it by hand");
    }
  }

  async function toggle(r: NailReview) {
    const next = !r.approved;
    try {
      const resp = await fetch(`${BASE}/api/nail-reviews/${r.id}/approve`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ approved: next }) });
      if (!resp.ok) throw new Error();
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, approved: next } : x)));
      toast.success(next ? "Now on the wall" : "Taken off the wall");
    } catch {
      toast.error("Could not update that review");
    }
  }

  async function remove(r: NailReview) {
    if (!window.confirm(`Delete the review from ${r.name}? This cannot be undone.`)) return;
    try {
      const resp = await fetch(`${BASE}/api/nail-reviews/${r.id}`, { method: "DELETE", headers: authHeaders() });
      if (!resp.ok) throw new Error();
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Review deleted");
    } catch {
      toast.error("Could not delete that review");
    }
  }

  function download(r: NailReview) {
    const a = document.createElement("a");
    a.href = reviewCardPng(r);
    a.download = `review-${r.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "client"}.png`;
    a.click();
  }

  async function copyText(r: NailReview) {
    try {
      await navigator.clipboard.writeText(r.reviewText || `“${r.heart}”\n\nReview by ${r.name}`);
      toast.success("Review text copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Star className="w-5 h-5 text-amber-400" />
        <h2 className="font-semibold text-lg">Reviews for {salon}</h2>
        <button type="button" onClick={load} className="ml-auto text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Send this link to {owner || "her"}'s clients</Label>
          <div className="flex gap-2">
            <input readOnly className={inputCls} value={formLink} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copyLink("form", formLink)} className="shrink-0 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-800">
              {copied === "form" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label>Public wall of kind words (approved reviews only)</Label>
          <div className="flex gap-2">
            <input readOnly className={inputCls} value={wallLink} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copyLink("wall", wallLink)} className="shrink-0 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-800">
              {copied === "wall" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !stats ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet. Send the link above to {owner || "her"}'s happy clients to start collecting.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-4xl font-bold text-amber-400 leading-none">{stats.overall.toFixed(1)}</div>
              <div className="mt-2">
                <Stars n={stats.overall} size={18} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>
                <span className="text-foreground font-semibold">{stats.n}</span> review{stats.n === 1 ? "" : "s"}
              </div>
              <div>
                <span className="text-foreground font-semibold">{stats.approved}</span> on the wall
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-semibold">{r.name}</span>
                    {r.approved && <span className="ml-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-full px-2 py-0.5">On the wall</span>}
                    <p className="text-xs text-muted-foreground">
                      {[r.handle, r.email].filter(Boolean).join(" · ")}
                      {r.handle || r.email ? " · " : ""}
                      {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <Stars n={r.average} />
                    <div className="text-xs text-muted-foreground mt-0.5">{Number(r.average).toFixed(1)} out of 5</div>
                  </div>
                </div>
                <p className="text-sm italic border-l-2 border-amber-500 pl-3 whitespace-pre-wrap">{"“"}{r.heart}{"”"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {REVIEW_CATS.map((c) => (
                    <span key={c.k}>
                      {c.label}: <span className="text-foreground">{r.ratings?.[c.k] ?? "-"}/5</span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => download(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
                    <Download className="w-3.5 h-3.5" /> Card
                  </button>
                  <button type="button" onClick={() => copyText(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
                    <Copy className="w-3.5 h-3.5" /> Text
                  </button>
                  <button type="button" onClick={() => toggle(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-black px-3 py-1.5 text-sm font-medium hover:bg-amber-400">
                    {r.approved ? <><EyeOff className="w-3.5 h-3.5" /> Take off wall</> : <><Eye className="w-3.5 h-3.5" /> Put on wall</>}
                  </button>
                  <button type="button" onClick={() => remove(r)} className="ml-auto text-muted-foreground hover:text-red-400 px-2" aria-label="Delete review">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function NailSalons() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [owner, setOwner] = useState("Millie");
  const [area, setArea] = useState("Wyke, Bradford");
  const [services, setServices] = useState("");
  const [policies, setPolicies] = useState("");
  const [offer, setOffer] = useState("");
  const [availability, setAvailability] = useState("");
  const [personal, setPersonal] = useState("");
  const [booking, setBooking] = useState("");
  const [emojis, setEmojis] = useState(false);
  const [replyWords, setReplyWords] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState<Kind | "all" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Start on The Nail Corner when it exists, otherwise let her choose.
  useEffect(() => {
    if (presetId != null || !presets.length) return;
    const nc = presets.find((p) => /nail corner/i.test(p.name)) ?? presets.find((p) => /nail/i.test(p.name));
    if (nc) {
      setPresetId(nc.id);
      if (/nail corner/i.test(nc.name)) {
        setServices(MILLIE_SERVICES);
        setPolicies(MILLIE_POLICIES);
      }
    }
  }, [presets, presetId]);

  const preset = useMemo(() => presets.find((p) => p.id === presetId), [presets, presetId]);

  async function generate(only?: Kind) {
    if (!preset) {
      toast.error("Pick a client first");
      return;
    }
    setBusy(only ?? "all");
    try {
      const r = await fetch(`${BASE}/api/nail-salons/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          only,
          businessName: preset.name,
          ownerName: owner,
          area,
          audience: preset.targetAudience ?? "",
          brandNotes: preset.brandNotes ?? "",
          services,
          policies,
          offer,
          availability,
          personal,
          booking,
          emojis,
          replyWords,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The copy would not write, try again");
      const fresh: Post[] = data.posts ?? [];
      setPosts((old) => {
        const merged = new Map(old.map((p) => [p.kind, p] as const));
        for (const p of fresh) merged.set(p.kind, p);
        return ORDER.map((k) => merged.get(k)).filter(Boolean) as Post[];
      });
      toast.success(only ? "Rewritten" : "Your week is written");
    } catch (e: any) {
      toast.error(e?.message || "The copy would not write, try again");
    } finally {
      setBusy(null);
    }
  }

  function patch(kind: Kind, change: Partial<Post>) {
    setPosts((old) => old.map((p) => (p.kind === kind ? { ...p, ...change } : p)));
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Copy did not work, select the text and copy it by hand");
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Sparkles className="w-5 h-5 text-pink-400" />
        <h1 className="font-bold text-lg">Nail Salons</h1>
        <span className="text-sm text-muted-foreground">One week of posts for a nail tech: 4 posts plus a Sunday tweet</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="rounded-2xl border border-border/30 p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <Label>Client</Label>
              <select className={inputCls} value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose a client</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label>Owner's first name</Label>
              <input className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} />
            </label>
            <label className="block">
              <Label>Area (used for the 5 hashtags)</Label>
              <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Wyke, Bradford" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <Label>Services and prices</Label>
              <textarea rows={3} className={inputCls} value={services} onChange={(e) => setServices(e.target.value)} placeholder="Gel nails 15 pounds, builder gel 20 pounds" />
            </label>
            <label className="block">
              <Label>Policies (only used where they fit naturally)</Label>
              <textarea rows={3} className={inputCls} value={policies} onChange={(e) => setPolicies(e.target.value)} placeholder="Deposit, cancellation notice, guarantee" />
            </label>
            <label className="block">
              <Label>Current offer (optional)</Label>
              <input className={inputCls} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Leave blank if there isn't one" />
            </label>
            <label className="block">
              <Label>This week's availability (for the availability post)</Label>
              <input className={inputCls} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Tuesday 11am, Thursday 4pm, two Saturday slots" />
            </label>
            <label className="block">
              <Label>What's happening in Millie's week (for the personal post)</Label>
              <input className={inputCls} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="New colour in, quiet Monday, treated herself" />
            </label>
            <label className="block">
              <Label>How people book (optional)</Label>
              <input className={inputCls} value={booking} onChange={(e) => setBooking(e.target.value)} placeholder="Message me on Instagram" />
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm">
              <input type="checkbox" checked={emojis} onChange={(e) => setEmojis(e.target.checked)} />
              Add a few cute emojis
            </label>
          </div>

          <div>
            <Label>Reply words (optional, leave blank and I will pick a fun one for each post)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ORDER.map((k) => (
                <input
                  key={k}
                  className={inputCls}
                  placeholder={META[k].title.split(" ")[0]}
                  value={replyWords[k] ?? ""}
                  onChange={(e) => setReplyWords((r) => ({ ...r, [k]: e.target.value }))}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={busy !== null || !preset}
            onClick={() => generate()}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5"
          >
            {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Write my week
          </button>
        </section>

        {posts.length > 0 && (
          <section className="space-y-5">
            {posts.map((p) => (
              <article key={p.kind} className="rounded-2xl border border-border/30 p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold text-base">{META[p.kind].title}</h2>
                  <span className="text-xs rounded-full bg-pink-500/15 text-pink-300 px-2.5 py-0.5">Suggested: {p.day}</span>
                  {p.replyWord && <span className="text-xs rounded-full bg-zinc-800 text-zinc-300 px-2.5 py-0.5">Reply word: {p.replyWord}</span>}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => generate(p.kind)}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {busy === p.kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Rewrite
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{META[p.kind].blurb}</p>

                {p.kind === "tweet" && (
                  <div>
                    <Label>Tweet text</Label>
                    <textarea rows={3} className={inputCls} value={p.hook} onChange={(e) => patch(p.kind, { hook: e.target.value })} />
                    <p className="text-xs text-zinc-500 mt-1">{p.hook.length} characters</p>
                    <button type="button" onClick={() => copy(`${p.kind}-tweet`, p.hook)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200">
                      {copied === `${p.kind}-tweet` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copy tweet text
                    </button>
                    <Link href="/tweet-maker" className="ml-4 text-sm text-pink-300 hover:text-pink-200 underline">
                      Open Tweet Maker
                    </Link>
                  </div>
                )}

                {p.headline && (
                  <div>
                    <Label>Graphic headline</Label>
                    <input className={inputCls} value={p.headline} onChange={(e) => patch(p.kind, { headline: e.target.value })} />
                  </div>
                )}

                {p.facts && p.facts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Facts for the graphic</Label>
                    {p.facts.map((f, i) => (
                      <textarea
                        key={i}
                        rows={2}
                        className={inputCls}
                        value={f}
                        onChange={(e) => patch(p.kind, { facts: p.facts!.map((x, j) => (j === i ? e.target.value : x)) })}
                      />
                    ))}
                  </div>
                )}

                {p.kind === "beforeafter" && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="block">
                      <Label>Before label</Label>
                      <input className={inputCls} value={p.beforeLabel ?? ""} onChange={(e) => patch(p.kind, { beforeLabel: e.target.value })} />
                    </label>
                    <label className="block">
                      <Label>After label</Label>
                      <input className={inputCls} value={p.afterLabel ?? ""} onChange={(e) => patch(p.kind, { afterLabel: e.target.value })} />
                    </label>
                    <label className="block">
                      <Label>Sign off line</Label>
                      <input className={inputCls} value={p.signOff ?? ""} onChange={(e) => patch(p.kind, { signOff: e.target.value })} />
                    </label>
                  </div>
                )}

                <div>
                  <Label>Caption</Label>
                  <textarea rows={8} className={inputCls} value={p.caption} onChange={(e) => patch(p.kind, { caption: e.target.value })} />
                  <p className="text-sm text-pink-300 mt-2 break-words">{p.hashtags.join(" ")}</p>
                  <button type="button" onClick={() => copy(`${p.kind}-cap`, fullCaption(p))} className="mt-2 inline-flex items-center gap-1.5 text-sm text-pink-300 hover:text-pink-200">
                    {copied === `${p.kind}-cap` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    Copy caption and hashtags
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {preset && <ReviewsSection salon={preset.name} owner={owner} />}
      </main>
    </div>
  );
}
