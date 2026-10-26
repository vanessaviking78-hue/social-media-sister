import { useEffect, useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SEEN = "today-popup-seen";

type Row = { label: string; href: string; note?: string };

// Opens once each time the site is opened and lists whatever needs doing today.
// Rows with nothing to do are left out, and if there is nothing at all it stays shut.
export function TodayPopup({ newCount, hwCount, reelCaptionCount, cqCount }: { newCount: number; hwCount: number; reelCaptionCount: number; cqCount: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ failed: number; today: number; drafts: number; low: { name: string; days: number }[] } | null>(null);

  useEffect(() => {
    try { if (sessionStorage.getItem(SEEN)) return; } catch { /* ignore */ }
    const pw = localStorage.getItem("cybersuite-pw") || "";
    if (!pw) return;
    let live = true;
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const threeDays = new Date(now.getTime() - 3 * 86400000);
    const get = async (path: string) => { try { const r = await fetch(`${BASE}${path}`); return r.ok ? await r.json() : null; } catch { return null; } };
    (async () => {
      const [failed, today, drafts, focus] = await Promise.all([
        get(`/api/scheduler/posts?status=failed&from=${encodeURIComponent(threeDays.toISOString())}`),
        get(`/api/scheduler/posts?status=pending&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`),
        get(`/api/scheduler/posts?status=draft`),
        get(`/api/daily-focus`),
      ]);
      if (!live) return;
      setCounts({
        failed: failed?.posts?.length ?? 0,
        today: today?.posts?.length ?? 0,
        drafts: drafts?.posts?.length ?? 0,
        low: (focus?.urgentClients ?? []).slice(0, 5).map((c: { clientName: string; daysCovered: number }) => ({ name: c.clientName, days: c.daysCovered })),
      });
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!counts) return;
    const r: Row[] = [];
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    if (counts.failed) r.push({ label: `${plural(counts.failed, "post", "posts")} failed to go out in the last 3 days`, href: "/scheduler", note: "Check and repost" });
    if (counts.today) r.push({ label: `${plural(counts.today, "post", "posts")} going out today`, href: "/scheduler", note: "Have a quick look" });
    if (cqCount) r.push({ label: `${plural(cqCount, "client question", "client questions")} waiting for an answer`, href: "/clientquestion" });
    if (newCount) r.push({ label: `${plural(newCount, "new submission", "new submissions")} to look at`, href: "/submissions" });
    if (hwCount) r.push({ label: `${plural(hwCount, "homework reply", "homework replies")} to read`, href: "/homework" });
    if (reelCaptionCount) r.push({ label: `${plural(reelCaptionCount, "reel caption request", "reel caption requests")} waiting`, href: "/reel-captioning" });
    if (counts.drafts) r.push({ label: `${plural(counts.drafts, "post", "posts")} parked in the Client Bank with no date`, href: "/scheduler", note: "Waiting Room tab" });
    if (counts.low.length) r.push({ label: `Running low on scheduled content: ${counts.low.map((c) => `${c.name} (${c.days} ${c.days === 1 ? "day" : "days"})`).join(", ")}`, href: "/daily-focus", note: "Daily Focus" });
    setRows(r);
  }, [counts, newCount, hwCount, reelCaptionCount, cqCount]);

  // The hub's own counts arrive a moment after the first load, so wait briefly before opening.
  useEffect(() => {
    if (!rows || !rows.length || open) return;
    const t = setTimeout(() => { setOpen(true); try { sessionStorage.setItem(SEEN, "1"); } catch { /* ignore */ } }, 1200);
    return () => clearTimeout(t);
  }, [rows, open]);

  if (!open || !rows || !rows.length) return null;
  const close = () => setOpen(false);
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-background border border-border/40 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start mb-4">
          <div>
            <h2 className="text-xl font-bold leading-tight">Today's to do list</h2>
            <p className="text-sm text-muted-foreground">{day}</p>
          </div>
          <button type="button" onClick={close} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i}>
              <Link href={r.href} onClick={close} className="block rounded-xl border border-border/40 px-4 py-3 hover:border-violet-400 transition-colors">
                <span className="text-sm font-medium">{r.label}</span>
                {r.note && <span className="block text-xs text-muted-foreground mt-0.5">{r.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={close} className="mt-4 w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-2.5 text-sm font-medium">Right, let's get going</button>
      </div>
    </div>
  );
}
