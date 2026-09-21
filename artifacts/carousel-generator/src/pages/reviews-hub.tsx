import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Star, RefreshCw, Download, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authHeaders } from "@/lib/use-approval";

const BASE = import.meta.env.BASE_URL || "/";
function api(path: string) { return `${BASE}api/${path}`; }

const CATS: { k: string; label: string; short: string }[] = [
  { k: "compliance", label: "Compliance knowledge", short: "Compliance knowledge" },
  { k: "creativity", label: "Creativity", short: "Creativity" },
  { k: "outside", label: "Thinking outside the box", short: "Thinking outside the box" },
  { k: "newthings", label: "Trying new things", short: "Trying new things" },
  { k: "patients", label: "Patient feedback on socials", short: "Patient feedback on socials" },
];

interface Review {
  id: number;
  name: string;
  clinic: string | null;
  email: string | null;
  average: number;
  ratings: Record<string, number>;
  ticks: Record<string, string[]> | null;
  heart: string;
  reviewText: string | null;
  consent: boolean;
  approved: boolean;
  createdAt: string;
}

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(n) ? "fill-pink-500 text-pink-500" : "text-zinc-700"} />
      ))}
    </span>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else { line = test; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "...";
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

// Same black, hot pink and white card the client sees after submitting
function cardPng(r: Review): string {
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1350;
  const ctx = cv.getContext("2d")!;
  const PINK = "#ff2e93";
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = PINK; ctx.fillRect(0, 0, 1080, 18); ctx.fillRect(0, 1332, 1080, 18);
  ctx.fillStyle = "#2a0a1a"; ctx.beginPath(); ctx.arc(960, 150, 190, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PINK; ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
  ctx.fillText("A CLIENT REVIEW FOR VANESSA WORMALD", 540, 100);
  const size = 72, total = 5 * size + 40, x0 = 540 - total / 2;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < Math.round(r.average) ? PINK : "#3a3a3a";
    ctx.font = size + "px Georgia"; ctx.textAlign = "left";
    ctx.fillText("★", x0 + i * (size + 10), 215);
  }
  ctx.fillStyle = "#fff"; ctx.font = "900 46px Arial"; ctx.textAlign = "center";
  ctx.fillText(Number(r.average).toFixed(1) + " out of 5", 540, 290);
  ctx.textAlign = "left"; ctx.font = "26px Arial";
  let y = 360;
  CATS.forEach((c) => {
    const v = Number(r.ratings?.[c.k] || 0);
    ctx.fillStyle = "#fff"; ctx.fillText(c.short, 90, y);
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(560, y - 22, 320, 18);
    ctx.fillStyle = PINK; ctx.fillRect(560, y - 22, 320 * (v / 5), 18);
    ctx.fillStyle = "#c7c0c5"; ctx.fillText(v + "/5", 905, y);
    y += 52;
  });
  ctx.fillStyle = PINK; ctx.font = "bold 150px Georgia"; ctx.fillText("“", 80, 690);
  let qs = 38;
  if (r.heart.length > 520) qs = 32;
  if (r.heart.length > 800) qs = 28;
  ctx.fillStyle = "#fff"; ctx.font = `italic ${qs}px Georgia`;
  const lh = Math.round(qs * 1.42);
  wrapText(ctx, r.heart, 100, 740, 880, lh, Math.floor((1210 - 720) / lh));
  ctx.fillStyle = "#fff"; ctx.font = "900 36px Arial";
  ctx.fillText(r.name + (r.clinic ? ", " + r.clinic : ""), 100, 1265);
  ctx.fillStyle = "#c7c0c5"; ctx.font = "22px Arial"; ctx.textAlign = "right";
  ctx.fillText("thecybersuite.com", 980, 1300);
  return cv.toDataURL("image/png");
}

export default function ReviewsHub() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(api("client-reviews"), { headers: authHeaders() });
      const data = await resp.json();
      if (Array.isArray(data.reviews)) setReviews(data.reviews);
      else toast.error(data.error || "Could not load reviews");
    } catch {
      toast.error("Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const n = reviews.length;
    if (!n) return null;
    const overall = reviews.reduce((a, r) => a + Number(r.average), 0) / n;
    const perCat = CATS.map((c) => ({
      ...c,
      avg: reviews.reduce((a, r) => a + Number(r.ratings?.[c.k] || 0), 0) / n,
    }));
    return { n, overall, perCat, approved: reviews.filter((r) => r.approved).length };
  }, [reviews]);

  const toggleApproved = async (r: Review) => {
    const next = !r.approved;
    try {
      const resp = await fetch(api(`client-reviews/${r.id}/approve`), {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ approved: next }),
      });
      if (!resp.ok) throw new Error();
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, approved: next } : x)));
      toast.success(next ? "Now showing on your wall of love" : "Removed from your wall of love");
    } catch {
      toast.error("Could not update that review");
    }
  };

  const remove = async (r: Review) => {
    if (!window.confirm(`Delete the review from ${r.name}? This cannot be undone.`)) return;
    try {
      const resp = await fetch(api(`client-reviews/${r.id}`), { method: "DELETE", headers: authHeaders() });
      if (!resp.ok) throw new Error();
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Review deleted");
    } catch {
      toast.error("Could not delete that review");
    }
  };

  const download = (r: Review) => {
    const a = document.createElement("a");
    a.href = cardPng(r);
    a.download = `review-${r.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "client"}.png`;
    a.click();
  };

  const copyText = async (r: Review) => {
    try {
      await navigator.clipboard.writeText(r.reviewText || `“${r.heart}”\n\nReview by ${r.name}${r.clinic ? ", " + r.clinic : ""}`);
      toast.success("Review text copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Star className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="font-sans text-3xl font-semibold tracking-tight">Client Reviews</h1>
            <p className="text-sm text-muted-foreground">
              Collected from <span className="font-mono text-xs">/reviews</span>. Approved ones show on <span className="font-mono text-xs">/wall</span>.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !stats ? (
          <div className="rounded-2xl border border-dashed border-border/40 py-16 text-center space-y-2">
            <Star className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No reviews yet.</p>
            <p className="text-sm text-muted-foreground/60">Send clients to <span className="font-mono text-xs">thecybersuite.com/reviews</span> to start collecting.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-pink-500/30 bg-card/50 p-6 space-y-5">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <div className="text-5xl font-bold text-pink-400 leading-none">{stats.overall.toFixed(1)}</div>
                  <div className="mt-2"><Stars n={stats.overall} size={20} /></div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div><span className="text-foreground font-semibold">{stats.n}</span> review{stats.n === 1 ? "" : "s"}</div>
                  <div><span className="text-foreground font-semibold">{stats.approved}</span> on your wall of love</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {stats.perCat.map((c) => (
                  <div key={c.k} className="space-y-1">
                    <div className="flex justify-between text-sm"><span>{c.label}</span><span className="text-muted-foreground">{c.avg.toFixed(1)}</span></div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full bg-pink-500" style={{ width: `${(c.avg / 5) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{r.name}</span>
                        {r.approved && <span className="text-xs font-medium text-pink-300 bg-pink-950/40 border border-pink-500/30 rounded-full px-2.5 py-0.5">On the wall</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[r.clinic, r.email].filter(Boolean).join(" · ")}
                        {(r.clinic || r.email) ? " · " : ""}
                        {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <Stars n={r.average} />
                      <div className="text-xs text-muted-foreground mt-0.5">{Number(r.average).toFixed(1)} out of 5</div>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed italic text-foreground/90 border-l-2 border-pink-500 pl-3 whitespace-pre-wrap">{"“"}{r.heart}{"”"}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {CATS.map((c) => <span key={c.k}>{c.short}: <span className="text-foreground">{r.ratings?.[c.k] ?? "-"}/5</span></span>)}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download(r)}><Download className="w-3.5 h-3.5" /> Card</Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(r)}><Copy className="w-3.5 h-3.5" /> Text</Button>
                    <Button size="sm" variant={r.approved ? "secondary" : "default"} className="gap-1.5" onClick={() => toggleApproved(r)}>
                      {r.approved ? <><EyeOff className="w-3.5 h-3.5" /> Take off wall</> : <><Eye className="w-3.5 h-3.5" /> Put on wall</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-red-400 ml-auto" onClick={() => remove(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
