import { useEffect, useState } from "react";
import { labelForBookedPost } from "./schedule";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
}

export type BookingEntry = { label: string; count: number };

function dateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Groups a client's upcoming scheduled posts by calendar date, so scheduling
// screens can show what's already booked over the next `days` days instead
// of leaving the gap-finder guessing. Cancelled posts are ignored.
export function useBookedDays(presetId: number | null, days: number) {
  const [byDate, setByDate] = useState<Record<string, BookingEntry[]>>({});
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (presetId === null) {
      setByDate({});
      setBookedDates(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE}/api/scheduler/posts?presetId=${presetId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data) => {
        if (cancelled) return;
        const posts: any[] = data.posts || [];
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() + days);
        const grouped: Record<string, Record<string, number>> = {};
        for (const p of posts) {
          if (p.status === "cancelled") continue;
          if (!p.scheduledAt) continue;
          const d = new Date(p.scheduledAt);
          if (d < now || d > cutoff) continue;
          const key = dateKey(p.scheduledAt);
          const label = labelForBookedPost({ postType: p.postType, content: p.content });
          grouped[key] = grouped[key] || {};
          grouped[key][label] = (grouped[key][label] || 0) + 1;
        }
        const out: Record<string, BookingEntry[]> = {};
        const dates = new Set<string>();
        for (const key of Object.keys(grouped)) {
          out[key] = Object.entries(grouped[key]).map(([label, count]) => ({ label, count }));
          dates.add(key);
        }
        setByDate(out);
        setBookedDates(dates);
      })
      .catch(() => {
        if (!cancelled) {
          setByDate({});
          setBookedDates(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [presetId, days]);

  return { byDate, bookedDates, loading };
}
