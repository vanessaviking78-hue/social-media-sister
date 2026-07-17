// Weekly posting pattern for The CyberSuite.
//   Monday    -> bulk carousel
//   Wednesday -> seamless carousel
//   Friday    -> treatment bulk carousel
//   Sunday    -> shareable quote / about-me static
// Everything posts at 19:45 local time.
// Posting days are always Monday, Wednesday, Friday or Sunday - Tuesday, Thursday
// and Saturday are kept free on purpose, so gap-finding and auto-fill logic must
// never suggest them.

export const POST_TIME = "19:45";

export const WEEKDAY = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 } as const;
export type Weekday = (typeof WEEKDAY)[keyof typeof WEEKDAY];

// The only days we ever post on. Tuesday, Thursday and Saturday are deliberately excluded.
export const MWF_DAYS: Weekday[] = [WEEKDAY.MON, WEEKDAY.WED, WEEKDAY.FRI, WEEKDAY.SUN];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Next calendar date (YYYY-MM-DD) whose weekday === targetDay, posting at `time`.
// If today IS the target day and the time has not yet passed, today is used;
// otherwise it rolls forward to the same weekday next week.
export function nextWeekday(targetDay: Weekday, time: string = POST_TIME): string {
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const now = new Date();
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  let add = (targetDay - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= now.getTime()) add = 7;
  d.setDate(d.getDate() + add);
  return ymd(d);
}

// Convenience: the ISO datetime a scheduler post should carry.
export function nextWeekdayISO(targetDay: Weekday, time: string = POST_TIME): string {
  return new Date(`${nextWeekday(targetDay, time)}T${time}`).toISOString();
}

// Find the next `count` open posting slots, walking forward day by day and only
// ever landing on Monday, Wednesday or Friday. A day counts as "open" unless its
// YYYY-MM-DD key is already present in `bookedDates`. Tuesday and Thursday are
// skipped entirely, on every pass, so they are never offered as a fill target.
export function nextOpenMWFSlots(bookedDates: Set<string>, count: number, time: string = POST_TIME): string[] {
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const out: string[] = [];
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  const now = new Date();
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  let guard = 0;
  while (out.length < count && guard < 400) {
    guard++;
    if ((MWF_DAYS as number[]).includes(d.getDay())) {
      const key = ymd(d);
      if (!bookedDates.has(key)) out.push(key);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Convenience: just the single next open Mon/Wed/Fri slot, as an ISO datetime.
export function nextOpenMWFSlotISO(bookedDates: Set<string>, time: string = POST_TIME): string {
  const [day] = nextOpenMWFSlots(bookedDates, 1, time);
  return new Date(`${day}T${time}`).toISOString();
}


// ---- Labelling booked posts, so scheduling screens can show *what* is booked, not just *that* something is booked ----

export type BookedPostSummary = {
  postType: string;
  content?: { sourceTool?: string } | null;
};

// Friendly label for a scheduled post when it doesn't carry an explicit sourceTool
// (older posts, or tools that haven't been tagged yet) — falls back to postType.
const POST_TYPE_LABELS: Record<string, string> = {
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  stories: "Story",
  "single-image": "Single Image",
  "about-me": "About Me",
  seamless: "Seamless",
};

export function labelForBookedPost(post: BookedPostSummary): string {
  const sourceTool = post.content?.sourceTool;
  if (sourceTool) return sourceTool;
  return POST_TYPE_LABELS[post.postType] || post.postType;
}

// Compact one-or-two-letter tag for tiny chip UI (e.g. the 14-day gap strip).
const SHORT_TAGS: Record<string, string> = {
  "Bulk Carousel": "B",
  "Seamless Carousels": "S",
  "Carousel": "C",
  "Reel": "R",
  "Story": "St",
  "Single Image": "SI",
  "About Me": "AM",
  "Seamless": "Se",
};

export function shortTagForBookedPost(post: BookedPostSummary): string {
  const label = labelForBookedPost(post);
  if (SHORT_TAGS[label]) return SHORT_TAGS[label];
  const initials = label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return initials || "?";
}
