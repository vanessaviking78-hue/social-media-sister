// Weekly posting pattern for The CyberSuite.
//   Monday    -> bulk carousel
//   Wednesday -> seamless carousel
//   Friday    -> treatment bulk carousel
//   Sunday    -> shareable quote / about-me static
// Everything posts at 19:45 local time.

export const POST_TIME = "19:45";

export const WEEKDAY = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 } as const;
export type Weekday = (typeof WEEKDAY)[keyof typeof WEEKDAY];

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
