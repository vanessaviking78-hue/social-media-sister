import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

// The Ryder Clinic engagement dashboard (page: /ryderdashboard). It shows the clinic what is being done for them on Instagram.
// Comments and DMs (incoming and outgoing) come straight from the client inbox (inbox_items). New followers and new following come from a daily
// follower snapshot read from Instagram, and can be typed in by hand for any day. Story responses are typed in by hand, because Instagram does not
// hand them over without the verified Meta app. A page health score out of 100 is worked out from whatever is being measured.

const router: IRouter = Router();
const GRAPH = "https://graph.facebook.com/v22.0";
const TZ = "Europe/London";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

const rowsOf = (r: unknown): any[] => ((r as any)?.rows ?? r ?? []) as any[];

// What a healthy week looks like for The Ryder Clinic. Each measure is scored against its target, scaled to the length of the period.
export type Goals = { comments: number; dms: number; newFollowers: number; storyResponses: number; bookings: number };
// Monthly goals for the clinic (30 days). They can be changed on the page and are scaled to whatever period is being looked at.
export const DEFAULT_GOALS: Goals = { comments: 40, dms: 40, newFollowers: 60, storyResponses: 20, bookings: 8 };
const WEIGHTS = { replyRate: 30, conversations: 20, comments: 15, followers: 20, stories: 15 };

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS engagement_log (
      preset_id INTEGER NOT NULL,
      day DATE NOT NULL,
      new_followers INTEGER,
      new_following INTEGER,
      story_responses INTEGER,
      note TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (preset_id, day)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS follower_snapshots (
      preset_id INTEGER NOT NULL,
      day DATE NOT NULL,
      followers INTEGER NOT NULL,
      following INTEGER NOT NULL,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (preset_id, day)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ryder_time_log (
      id SERIAL PRIMARY KEY, preset_id INTEGER NOT NULL, day DATE NOT NULL, minutes INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ryder_timer (preset_id INTEGER PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ryder_goals (
      preset_id INTEGER PRIMARY KEY, dms INTEGER NOT NULL, comments INTEGER NOT NULL, new_followers INTEGER NOT NULL,
      story_responses INTEGER NOT NULL, bookings INTEGER NOT NULL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS post_metrics (
      scheduled_post_id INTEGER PRIMARY KEY, preset_id INTEGER NOT NULL, ig_media_id TEXT NOT NULL, permalink TEXT, likes INTEGER, comments INTEGER,
      saved INTEGER, shares INTEGER, reach INTEGER, insights_error TEXT NOT NULL DEFAULT '', fetched_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ryder_story_views (
      preset_id INTEGER NOT NULL, handle TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (preset_id, handle, day))`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ryder_lead_status (
      preset_id INTEGER NOT NULL, handle TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (preset_id, handle))`);
    await db.execute(sql`ALTER TABLE ryder_lead_status ADD COLUMN IF NOT EXISTS value INTEGER`);
    // inbox_items is created by the inbox route; make sure it exists so the dashboard works even if it loads first.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS inbox_items (
      id SERIAL PRIMARY KEY, preset_id INTEGER NOT NULL, client_name TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, direction TEXT NOT NULL DEFAULT 'in',
      external_id TEXT NOT NULL UNIQUE, thread_id TEXT NOT NULL DEFAULT '', permalink TEXT, media_caption TEXT, author_name TEXT NOT NULL DEFAULT '',
      author_id TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', is_read BOOLEAN NOT NULL DEFAULT false, replied BOOLEAN NOT NULL DEFAULT false,
      push_sent BOOLEAN NOT NULL DEFAULT false, email_sent BOOLEAN NOT NULL DEFAULT false, created_at_meta TIMESTAMPTZ NOT NULL DEFAULT now(),
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  })();
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

async function ryderPreset(): Promise<{ id: number; name: string; ig_id: string | null; token: string | null; username: string | null } | null> {
  const r = rowsOf(await db.execute(sql`SELECT id, name, meta_instagram_account_id AS ig_id, meta_page_access_token AS token, meta_instagram_username AS username
    FROM client_presets WHERE name ILIKE '%ryder%' ORDER BY id LIMIT 1`))[0];
  return r ? { id: Number(r.id), name: String(r.name), ig_id: r.ig_id, token: r.token, username: r.username } : null;
}

const londonToday = (): string => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayList = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

// ---------- follower snapshots (read from Instagram once a day, best effort) ----------

let lastSnapshot: { at: string; error: string } | null = null;

export async function snapshotRyderFollowers(): Promise<{ error: string }> {
  let error = "";
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { error = "I could not find a client called Ryder"; return { error }; }
    if (!p.ig_id || !p.token) { error = "The Ryder Clinic is not connected to Instagram yet"; return { error }; }
    const qs = new URLSearchParams({ fields: "followers_count,follows_count", access_token: p.token }).toString();
    const res = await fetch(`${GRAPH}/${p.ig_id}?${qs}`, { signal: AbortSignal.timeout(25000) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) { error = String(data?.error?.message || `Meta said ${res.status}`); return { error }; }
    if (typeof data.followers_count !== "number") { error = "Instagram did not return a follower count"; return { error }; }
    await db.execute(sql`INSERT INTO follower_snapshots (preset_id, day, followers, following, taken_at)
      VALUES (${p.id}, ${londonToday()}, ${data.followers_count}, ${Number(data.follows_count ?? 0)}, now())
      ON CONFLICT (preset_id, day) DO UPDATE SET followers = EXCLUDED.followers, following = EXCLUDED.following, taken_at = now()`);
    return { error };
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, `Ryder follower snapshot failed: ${error}`);
    return { error };
  } finally {
    lastSnapshot = { at: new Date().toISOString(), error };
  }
}

let timer: NodeJS.Timeout | null = null;
export function startRyderSnapshotSync(): void {
  if (timer) return;
  const run = () => { snapshotRyderFollowers().then(() => syncRyderPostMetrics()).catch(() => undefined); };
  setTimeout(run, 120_000);
  timer = setInterval(run, 3 * 60 * 60 * 1000);
}

// ---------- the numbers ----------

type Day = {
  day: string; newFollowers: number | null; newFollowing: number | null; commentsIn: number; commentsOut: number;
  dmsIn: number; dmsOut: number; storyResponses: number | null; note: string; followersAuto: boolean; minutes: number;
};

async function loadDays(presetId: number, from: string, to: string): Promise<Day[]> {
  // The day before `from` is read as well so the first day of a period can still work out a follower change from snapshots.
  const before = addDays(from, -1);
  const inbox = rowsOf(await db.execute(sql`SELECT (created_at_meta AT TIME ZONE ${TZ})::date::text AS day,
      COUNT(*) FILTER (WHERE kind = 'comment' AND direction = 'in') AS comments_in,
      COUNT(*) FILTER (WHERE kind = 'comment' AND direction = 'out') AS comments_out,
      COUNT(*) FILTER (WHERE kind = 'dm' AND direction = 'in') AS dms_in,
      COUNT(*) FILTER (WHERE kind = 'dm' AND direction = 'out') AS dms_out
    FROM inbox_items WHERE preset_id = ${presetId}
      AND (created_at_meta AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date GROUP BY 1`));
  const log = rowsOf(await db.execute(sql`SELECT day::text AS day, new_followers, new_following, story_responses, note FROM engagement_log
    WHERE preset_id = ${presetId} AND day BETWEEN ${from}::date AND ${to}::date`));
  const snaps = rowsOf(await db.execute(sql`SELECT day::text AS day, followers, following FROM follower_snapshots
    WHERE preset_id = ${presetId} AND day BETWEEN ${before}::date AND ${to}::date ORDER BY day`));
  const time = rowsOf(await db.execute(sql`SELECT day::text AS day, SUM(minutes) AS minutes FROM ryder_time_log
    WHERE preset_id = ${presetId} AND day BETWEEN ${from}::date AND ${to}::date GROUP BY day`));
  const timeBy = new Map(time.map((r) => [String(r.day), Number(r.minutes)]));
  const inboxBy = new Map(inbox.map((r) => [String(r.day), r]));
  const logBy = new Map(log.map((r) => [String(r.day), r]));
  const snapBy = new Map(snaps.map((r) => [String(r.day), r]));
  return dayList(from, to).map((day) => {
    const i = inboxBy.get(day);
    const l = logBy.get(day);
    const s = snapBy.get(day);
    const prev = snapBy.get(addDays(day, -1));
    const autoF = s && prev ? Math.max(0, Number(s.followers) - Number(prev.followers)) : null;
    const autoFg = s && prev ? Math.max(0, Number(s.following) - Number(prev.following)) : null;
    const manualF = l?.new_followers == null ? null : Number(l.new_followers);
    const manualFg = l?.new_following == null ? null : Number(l.new_following);
    return {
      day,
      newFollowers: manualF ?? autoF,
      newFollowing: manualFg ?? autoFg,
      followersAuto: manualF == null && autoF != null,
      commentsIn: Number(i?.comments_in ?? 0), commentsOut: Number(i?.comments_out ?? 0),
      dmsIn: Number(i?.dms_in ?? 0), dmsOut: Number(i?.dms_out ?? 0),
      storyResponses: l?.story_responses == null ? null : Number(l.story_responses),
      note: String(l?.note ?? ""),
      minutes: timeBy.get(day) ?? 0,
    };
  });
}

const sum = (days: Day[], k: "commentsIn" | "commentsOut" | "dmsIn" | "dmsOut"): number => days.reduce((a, d) => a + d[k], 0);
const sumNullable = (days: Day[], k: "newFollowers" | "newFollowing" | "storyResponses"): number | null => {
  const have = days.filter((d) => d[k] != null);
  return have.length === 0 ? null : have.reduce((a, d) => a + (d[k] as number), 0);
};

function totalsOf(days: Day[]) {
  return {
    newFollowers: sumNullable(days, "newFollowers"),
    newFollowing: sumNullable(days, "newFollowing"),
    commentsIn: sum(days, "commentsIn"),
    commentsOut: sum(days, "commentsOut"),
    dmsIn: sum(days, "dmsIn"),
    dmsOut: sum(days, "dmsOut"),
    storyResponses: sumNullable(days, "storyResponses"),
    minutes: days.reduce((a, d) => a + d.minutes, 0),
  };
}

type Totals = ReturnType<typeof totalsOf>;

async function dmReplyShare(presetId: number, from: string, to: string): Promise<{ answered: number; total: number }> {
  // A conversation counts as answered when there is an outgoing message after the first incoming message of the period.
  const r = rowsOf(await db.execute(sql`WITH inbound AS (
      SELECT thread_id, MIN(created_at_meta) AS first_in FROM inbox_items
      WHERE preset_id = ${presetId} AND kind = 'dm' AND direction = 'in'
        AND (created_at_meta AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date GROUP BY thread_id)
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM inbox_items o WHERE o.preset_id = ${presetId} AND o.kind = 'dm' AND o.direction = 'out'
        AND o.thread_id = inbound.thread_id AND o.created_at_meta >= inbound.first_in)) AS answered FROM inbound`))[0];
  return { total: Number(r?.total ?? 0), answered: Number(r?.answered ?? 0) };
}

function scoreOf(t: Totals, days: number, dm: { answered: number; total: number }, goals: Goals) {
  const scale = days / 30;
  const parts: { key: string; label: string; weight: number; value: number | null; target: number | null; points: number | null; detail: string }[] = [];
  const cap = (v: number) => Math.max(0, Math.min(1, v));

  // 1. Reply rate: conversations answered plus comment replies against comments received.
  const commentShare = t.commentsIn > 0 ? cap(t.commentsOut / t.commentsIn) : null;
  const dmShare = dm.total > 0 ? dm.answered / dm.total : null;
  const shares = [commentShare, dmShare].filter((x): x is number => x != null);
  const replyRate = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
  parts.push({
    key: "replyRate", label: "Reply rate", weight: WEIGHTS.replyRate, value: replyRate == null ? null : Math.round(replyRate * 100), target: 100,
    points: replyRate == null ? null : replyRate * WEIGHTS.replyRate,
    detail: replyRate == null ? "Nothing to reply to yet" : `${dm.answered} of ${dm.total} DM conversations answered, ${t.commentsOut} replies to ${t.commentsIn} comments`,
  });

  const dmTarget = goals.dms * scale;
  const dmTotal = t.dmsIn + t.dmsOut;
  parts.push({ key: "conversations", label: "DM conversations", weight: WEIGHTS.conversations, value: dmTotal, target: Math.round(dmTarget),
    points: cap(dmTotal / dmTarget) * WEIGHTS.conversations, detail: `${t.dmsIn} in, ${t.dmsOut} out` });

  const cTarget = goals.comments * scale;
  const cTotal = t.commentsIn + t.commentsOut;
  parts.push({ key: "comments", label: "Comments", weight: WEIGHTS.comments, value: cTotal, target: Math.round(cTarget),
    points: cap(cTotal / cTarget) * WEIGHTS.comments, detail: `${t.commentsIn} received, ${t.commentsOut} replied` });

  const fTarget = goals.newFollowers * scale;
  parts.push({ key: "followers", label: "New followers", weight: WEIGHTS.followers, value: t.newFollowers, target: Math.round(fTarget),
    points: t.newFollowers == null ? null : cap(t.newFollowers / fTarget) * WEIGHTS.followers,
    detail: t.newFollowers == null ? "No follower numbers yet" : `${t.newFollowers} new, ${t.newFollowing ?? 0} followed` });

  const sTarget = goals.storyResponses * scale;
  parts.push({ key: "stories", label: "Story responses", weight: WEIGHTS.stories, value: t.storyResponses, target: Math.round(sTarget),
    points: t.storyResponses == null ? null : cap(t.storyResponses / sTarget) * WEIGHTS.stories,
    detail: t.storyResponses == null ? "Not logged yet" : `${t.storyResponses} logged` });

  const measured = parts.filter((p) => p.points != null);
  const possible = measured.reduce((a, p) => a + p.weight, 0);
  const earned = measured.reduce((a, p) => a + (p.points as number), 0);
  const score = possible === 0 ? null : Math.round((earned / possible) * 100);
  const band = score == null ? "none" : score >= 80 ? "thriving" : score >= 60 ? "healthy" : score >= 40 ? "building" : "needs love";
  return { score, band, measured: measured.length, of: parts.length, parts };
}


async function loadGoals(presetId: number): Promise<Goals> {
  const r = rowsOf(await db.execute(sql`SELECT dms, comments, new_followers, story_responses, bookings FROM ryder_goals WHERE preset_id = ${presetId}`))[0];
  return r ? { dms: Number(r.dms), comments: Number(r.comments), newFollowers: Number(r.new_followers), storyResponses: Number(r.story_responses), bookings: Number(r.bookings) } : { ...DEFAULT_GOALS };
}

// How quickly DMs are answered: for each conversation that started in the period, the time from the first incoming message to the first reply.
async function replySpeed(presetId: number, from: string, to: string) {
  const r = rowsOf(await db.execute(sql`WITH inbound AS (
      SELECT thread_id, MIN(created_at_meta) AS first_in FROM inbox_items
      WHERE preset_id = ${presetId} AND kind = 'dm' AND direction = 'in'
        AND (created_at_meta AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date GROUP BY thread_id),
      replied AS (SELECT i.first_in, (SELECT MIN(o.created_at_meta) FROM inbox_items o WHERE o.preset_id = ${presetId} AND o.kind = 'dm'
        AND o.direction = 'out' AND o.thread_id = i.thread_id AND o.created_at_meta >= i.first_in) AS first_out FROM inbound i)
    SELECT COUNT(*) AS total, COUNT(first_out) AS answered,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_out - first_in)) / 60) FILTER (WHERE first_out IS NOT NULL) AS median_min,
      COUNT(*) FILTER (WHERE first_out IS NOT NULL AND first_out - first_in <= interval '1 hour') AS within_hour
    FROM replied`))[0];
  const total = Number(r?.total ?? 0), answered = Number(r?.answered ?? 0);
  return {
    conversations: total, answered,
    medianMinutes: r?.median_min == null ? null : Math.round(Number(r.median_min)),
    withinHourPct: answered > 0 ? Math.round((Number(r.within_hour) / answered) * 100) : null,
  };
}

async function bookingsIn(presetId: number, from: string, to: string): Promise<{ booked: number; value: number }> {
  const r = rowsOf(await db.execute(sql`SELECT COUNT(*) AS n, COALESCE(SUM(value), 0) AS v FROM ryder_lead_status
    WHERE preset_id = ${presetId} AND status = 'booked' AND (updated_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date`))[0];
  return { booked: Number(r?.n ?? 0), value: Number(r?.v ?? 0) };
}

async function topPosts(presetId: number, from: string, to: string) {
  const rows = rowsOf(await db.execute(sql`SELECT sp.id, sp.scheduled_at, sp.content->>'title' AS title, sp.content->>'caption' AS caption,
      m.permalink, m.likes, m.comments, m.saved, m.shares, m.reach, m.insights_error, m.fetched_at
    FROM scheduled_posts sp LEFT JOIN post_metrics m ON m.scheduled_post_id = sp.id
    WHERE sp.preset_id = ${presetId} AND sp.status = 'published' AND sp.post_type NOT ILIKE '%story%'
      AND (sp.scheduled_at AT TIME ZONE ${TZ})::date BETWEEN ${from}::date AND ${to}::date`));
  const n = (v: unknown) => (v == null ? null : Number(v));
  const posts = rows.map((x) => {
    const likes = n(x.likes), comments = n(x.comments), saved = n(x.saved), shares = n(x.shares), reach = n(x.reach);
    const hasData = x.fetched_at != null;
    return {
      id: Number(x.id), title: String(x.title || ""), caption: String(x.caption || "").slice(0, 140), postedAt: x.scheduled_at, permalink: x.permalink as string | null,
      likes, comments, saved, shares, reach, hasData, insightsMissing: hasData && !!x.insights_error,
      score: hasData ? (likes ?? 0) + 2 * (comments ?? 0) + 3 * (saved ?? 0) + 4 * (shares ?? 0) : null,
    };
  });
  const tracked = posts.filter((x) => x.hasData);
  tracked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { published: posts.length, tracked: tracked.length, top: tracked.slice(0, 5) };
}

// Likes, comments, saves, shares and reach for the clinic's published posts, read from Instagram (saves, shares and reach need the insights permission).
export async function syncRyderPostMetrics(): Promise<{ checked: number; error: string }> {
  let checked = 0, error = "";
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p || !p.token) return { checked, error: p ? "The Ryder Clinic is not connected to Instagram yet" : "I could not find a client called Ryder" };
    const posts = rowsOf(await db.execute(sql`SELECT id, meta_result->>'igPostId' AS ig_id FROM scheduled_posts
      WHERE preset_id = ${p.id} AND status = 'published' AND post_type NOT ILIKE '%story%' AND meta_result->>'igPostId' IS NOT NULL
      ORDER BY scheduled_at DESC LIMIT 60`));
    const get = async (path: string, params: Record<string, string>) => {
      const qs = new URLSearchParams({ ...params, access_token: p.token as string }).toString();
      const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(25000) });
      const d: any = await res.json().catch(() => ({}));
      if (!res.ok || d?.error) throw new Error(String(d?.error?.message || `Meta said ${res.status}`));
      return d;
    };
    for (const post of posts) {
      const mediaId = String(post.ig_id);
      let likes: number | null = null, comments: number | null = null, permalink: string | null = null;
      let saved: number | null = null, shares: number | null = null, reach: number | null = null, insightsError = "";
      try {
        const m = await get(mediaId, { fields: "like_count,comments_count,permalink" });
        likes = typeof m.like_count === "number" ? m.like_count : null;
        comments = typeof m.comments_count === "number" ? m.comments_count : null;
        permalink = m.permalink || null;
      } catch (e) { error = e instanceof Error ? e.message : String(e); continue; }
      try {
        const ins = await get(`${mediaId}/insights`, { metric: "reach,saved,shares" });
        for (const row of ins.data || []) {
          const v = row.values?.[0]?.value ?? row.total_value?.value;
          if (row.name === "reach") reach = Number(v);
          if (row.name === "saved") saved = Number(v);
          if (row.name === "shares") shares = Number(v);
        }
      } catch (e) { insightsError = e instanceof Error ? e.message : String(e); }
      await db.execute(sql`INSERT INTO post_metrics (scheduled_post_id, preset_id, ig_media_id, permalink, likes, comments, saved, shares, reach, insights_error, fetched_at)
        VALUES (${post.id}, ${p.id}, ${mediaId}, ${permalink}, ${likes}, ${comments}, ${saved}, ${shares}, ${reach}, ${insightsError}, now())
        ON CONFLICT (scheduled_post_id) DO UPDATE SET permalink = EXCLUDED.permalink, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
          saved = EXCLUDED.saved, shares = EXCLUDED.shares, reach = EXCLUDED.reach, insights_error = EXCLUDED.insights_error, fetched_at = now()`);
      checked++;
    }
    return { checked, error };
  } catch (err) {
    return { checked, error: err instanceof Error ? err.message : String(err) };
  }
}

const monthStartOf = (iso: string): string => iso.slice(0, 7) + "-01";
function previousMonthRange(to: string): { from: string; to: string } {
  const start = monthStartOf(to);
  const prevEnd = addDays(start, -1);
  const prevStart = monthStartOf(prevEnd);
  const elapsed = Number(to.slice(8, 10));
  const same = addDays(prevStart, elapsed - 1);
  return { from: prevStart, to: same > prevEnd ? prevEnd : same };
}

router.get("/ryder/dashboard", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const to = londonToday();
    const from = addDays(to, -(days - 1));
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));

    const [series, prevSeries, dm] = await Promise.all([loadDays(p.id, from, to), loadDays(p.id, prevFrom, prevTo), dmReplyShare(p.id, from, to)]);
    const totals = totalsOf(series);
    const prevTotals = totalsOf(prevSeries);
    const prevDm = await dmReplyShare(p.id, prevFrom, prevTo);
    const goals = await loadGoals(p.id);
    const health = scoreOf(totals, days, dm, goals);
    const prevHealth = scoreOf(prevTotals, days, prevDm, goals);

    const mFrom = monthStartOf(to);
    const prevMonth = previousMonthRange(to);
    const [speed, prevSpeed, booked, prevBooked, posts, monthSeries, prevMonthSeries, monthBooked, prevMonthBooked] = await Promise.all([
      replySpeed(p.id, from, to), replySpeed(p.id, prevFrom, prevTo), bookingsIn(p.id, from, to), bookingsIn(p.id, prevFrom, prevTo), topPosts(p.id, from, to),
      loadDays(p.id, mFrom, to), loadDays(p.id, prevMonth.from, prevMonth.to), bookingsIn(p.id, mFrom, to), bookingsIn(p.id, prevMonth.from, prevMonth.to),
    ]);

    const snap = rowsOf(await db.execute(sql`SELECT day::text AS day, followers, following FROM follower_snapshots WHERE preset_id = ${p.id} ORDER BY day DESC LIMIT 1`))[0];
    const first = rowsOf(await db.execute(sql`SELECT day::text AS day, followers FROM follower_snapshots WHERE preset_id = ${p.id} ORDER BY day ASC LIMIT 1`))[0];
    const timerRow = rowsOf(await db.execute(sql`SELECT started_at FROM ryder_timer WHERE preset_id = ${p.id}`))[0];
    const backlog = rowsOf(await db.execute(sql`SELECT COUNT(*) AS n FROM inbox_items WHERE preset_id = ${p.id} AND direction = 'in' AND is_read = false`))[0];

    res.json({
      clinic: p.name, connected: !!(p.ig_id && p.token), username: p.username, days, from, to,
      totals, prevTotals, health: { ...health, previous: prevHealth.score }, goals,
      series, followers: snap ? { now: Number(snap.followers), following: Number(snap.following), asOf: snap.day, since: first ? { day: first.day, count: Number(first.followers) } : null } : null,
      unanswered: Number(backlog?.n ?? 0), lastSnapshot,
      replySpeed: { ...speed, previousMedianMinutes: prevSpeed.medianMinutes },
      bookings: { enquiries: speed.conversations, booked: booked.booked, value: booked.value, previousBooked: prevBooked.booked, previousValue: prevBooked.value },
      topPosts: posts,
      month: {
        from: mFrom, to, label: new Date(mFrom + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        totals: totalsOf(monthSeries), prevTotals: totalsOf(prevMonthSeries), booked: monthBooked.booked, prevBooked: prevMonthBooked.booked,
      },
      timer: timerRow ? { startedAt: new Date(timerRow.started_at).toISOString() } : null,
    });
  } catch (err) {
    logger.error({ err }, `Ryder dashboard failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not load the dashboard" });
  }
});

// Type in (or correct) the numbers Instagram does not give: new followers, new following, story responses, plus a note about what was done that day.
router.post("/ryder/dashboard/log", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const day = String(req.body?.day || londonToday());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { res.status(400).json({ error: "That date does not look right" }); return; }
    const n = (v: unknown): number | null => {
      if (v === "" || v == null) return null;
      const x = Math.round(Number(v));
      return Number.isFinite(x) && x >= 0 && x < 100000 ? x : null;
    };
    const note = String(req.body?.note ?? "").slice(0, 400);
    await db.execute(sql`INSERT INTO engagement_log (preset_id, day, new_followers, new_following, story_responses, note, updated_at)
      VALUES (${p.id}, ${day}::date, ${n(req.body?.newFollowers)}, ${n(req.body?.newFollowing)}, ${n(req.body?.storyResponses)}, ${note}, now())
      ON CONFLICT (preset_id, day) DO UPDATE SET new_followers = EXCLUDED.new_followers, new_following = EXCLUDED.new_following,
        story_responses = EXCLUDED.story_responses, note = EXCLUDED.note, updated_at = now()`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, `Ryder dashboard log failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not save that" });
  }
});

router.post("/ryder/dashboard/refresh", requireAuth, async (_req: Request, res: Response) => {
  const r = await snapshotRyderFollowers();
  const m = await syncRyderPostMetrics();
  res.json({ error: r.error || m.error, postsChecked: m.checked });
});

// ---------- leads ----------
// Instagram does not give anyone the list of who viewed a story, so story viewers are pasted in from the app (the viewer list shows for 48 hours).
// Everyone who comments or messages comes from the inbox by themselves. Both are merged into one list, warmest first.

// Words that suggest someone is ready to book. Anyone using them is flagged as an enquiry and floats to the top of the leads list.
const ENQUIRY_RE = "(\\y(price|prices|pricing|cost|costs|how much|book|booking|booked|consultation|consult|appointment|availability|available|enquire|enquiry|interested|quote|deposit|offer|offers)\\y|£)";
const STATUSES = ["new", "contacted", "booked", "not interested"];
const cleanHandle = (h: string): string => h.trim().replace(/^@/, "").toLowerCase();
const validHandle = (h: string): boolean => /^[a-z0-9._]{1,30}$/.test(h);

router.get("/ryder/leads", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const own = (p.username || "").toLowerCase();
    const inbox = rowsOf(await db.execute(sql`SELECT lower(author_name) AS handle,
        COUNT(*) FILTER (WHERE kind = 'comment') AS comments, COUNT(*) FILTER (WHERE kind = 'dm') AS dms,
        MAX(created_at_meta) AS last_at, bool_or(body ~* ${ENQUIRY_RE}) AS enquiry,
        (array_agg(body ORDER BY created_at_meta DESC) FILTER (WHERE body ~* ${ENQUIRY_RE}))[1] AS enquiry_text FROM inbox_items
      WHERE preset_id = ${p.id} AND direction = 'in' AND author_name <> '' GROUP BY 1`));
    const views = rowsOf(await db.execute(sql`SELECT handle, COUNT(*) AS views, MAX(day)::text AS last_day FROM ryder_story_views WHERE preset_id = ${p.id} GROUP BY handle`));
    const status = rowsOf(await db.execute(sql`SELECT handle, status, note, value FROM ryder_lead_status WHERE preset_id = ${p.id}`));
    const by = new Map<string, any>();
    const get = (h: string) => {
      if (!by.has(h)) by.set(h, { handle: h, comments: 0, dms: 0, storyViews: 0, lastAt: null as string | null, status: "new", note: "", value: null as number | null, enquiry: false, enquiryText: "" });
      return by.get(h);
    };
    for (const r of inbox) {
      const h = cleanHandle(String(r.handle));
      if (!h || h === own) continue;
      const l = get(h);
      l.comments = Number(r.comments); l.dms = Number(r.dms);
      l.enquiry = !!r.enquiry; l.enquiryText = r.enquiry_text ? String(r.enquiry_text).slice(0, 140) : "";
      l.lastAt = r.last_at ? new Date(r.last_at).toISOString() : l.lastAt;
    }
    for (const r of views) {
      const h = cleanHandle(String(r.handle));
      if (!h || h === own) continue;
      const l = get(h);
      l.storyViews = Number(r.views);
      const d = r.last_day ? new Date(r.last_day + "T12:00:00Z").toISOString() : null;
      if (d && (!l.lastAt || d > l.lastAt)) l.lastAt = d;
    }
    for (const r of status) {
      const l = by.get(cleanHandle(String(r.handle)));
      if (l) { l.status = String(r.status); l.note = String(r.note || ""); l.value = r.value == null ? null : Number(r.value); }
    }
    const leads = [...by.values()].map((l) => {
      const warmth = l.storyViews + 2 * l.comments + 4 * l.dms;
      const open = l.status === "new" || l.status === "contacted";
      return { ...l, warmth, rank: warmth + (l.enquiry && open ? 1000 : 0), heat: l.enquiry || warmth >= 6 ? "hot" : warmth >= 3 ? "warm" : "new" };
    }).sort((a, b) => b.rank - a.rank || String(b.lastAt || "").localeCompare(String(a.lastAt || "")));
    res.json({ leads, statuses: STATUSES });
  } catch (err) {
    logger.error({ err }, `Ryder leads failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not load the leads" });
  }
});

router.post("/ryder/leads/story-viewers", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const day = String(req.body?.day || londonToday());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { res.status(400).json({ error: "That date does not look right" }); return; }
    const handles = [...new Set(String(req.body?.handles ?? "").split(/[\s,;]+/).map(cleanHandle).filter(validHandle))].slice(0, 2000);
    if (handles.length === 0) { res.status(400).json({ error: "I could not find any usernames in that. Paste them one per line." }); return; }
    let added = 0;
    for (const h of handles) {
      const r = await db.execute(sql`INSERT INTO ryder_story_views (preset_id, handle, day) VALUES (${p.id}, ${h}, ${day}::date) ON CONFLICT DO NOTHING RETURNING handle`);
      added += rowsOf(r).length;
    }
    res.json({ ok: true, found: handles.length, added });
  } catch (err) {
    logger.error({ err }, `Ryder story viewers failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not save those" });
  }
});

router.post("/ryder/leads/status", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const handle = cleanHandle(String(req.body?.handle ?? ""));
    const status = String(req.body?.status ?? "new");
    if (!validHandle(handle) || !STATUSES.includes(status)) { res.status(400).json({ error: "That did not look right" }); return; }
    const note = String(req.body?.note ?? "").slice(0, 300);
    const v = req.body?.value === "" || req.body?.value == null ? null : Math.round(Number(req.body.value));
    const value = v != null && Number.isFinite(v) && v >= 0 && v < 1000000 ? v : null;
    // Moving a lead to booked stamps the date, so bookings count in the period they happened. Re-saving the same status keeps the original date.
    await db.execute(sql`INSERT INTO ryder_lead_status (preset_id, handle, status, note, value, updated_at) VALUES (${p.id}, ${handle}, ${status}, ${note}, ${value}, now())
      ON CONFLICT (preset_id, handle) DO UPDATE SET note = EXCLUDED.note, value = EXCLUDED.value,
        updated_at = CASE WHEN ryder_lead_status.status = EXCLUDED.status THEN ryder_lead_status.updated_at ELSE now() END, status = EXCLUDED.status`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not save that" });
  }
});

// ---------- time spent engaging ----------
// Instagram does not report how long anyone spends in the app, so time is logged here: a timer that keeps running on the server (closing the page
// does not lose it), or minutes typed in for time that was not timed.

router.post("/ryder/time/start", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    await db.execute(sql`INSERT INTO ryder_timer (preset_id, started_at) VALUES (${p.id}, now()) ON CONFLICT (preset_id) DO NOTHING`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not start the timer" });
  }
});

router.post("/ryder/time/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const t = rowsOf(await db.execute(sql`SELECT started_at, (started_at AT TIME ZONE ${TZ})::date::text AS day,
      CEIL(EXTRACT(EPOCH FROM (now() - started_at)) / 60) AS mins FROM ryder_timer WHERE preset_id = ${p.id}`))[0];
    if (!t) { res.status(400).json({ error: "The timer is not running" }); return; }
    // The minutes can be corrected when stopping, for the day the timer was left running.
    const typed = Math.round(Number(req.body?.minutes));
    const minutes = Number.isFinite(typed) && typed > 0 && typed <= 1440 ? typed : Math.max(1, Math.min(1440, Number(t.mins)));
    const note = String(req.body?.note ?? "").slice(0, 300);
    await db.execute(sql`INSERT INTO ryder_time_log (preset_id, day, minutes, note) VALUES (${p.id}, ${String(t.day)}::date, ${minutes}, ${note})`);
    await db.execute(sql`DELETE FROM ryder_timer WHERE preset_id = ${p.id}`);
    res.json({ ok: true, minutes });
  } catch (err) {
    res.status(500).json({ error: "Could not stop the timer" });
  }
});

router.post("/ryder/time/add", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const day = String(req.body?.day || londonToday());
    const minutes = Math.round(Number(req.body?.minutes));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) { res.status(400).json({ error: "Put in a number of minutes between 1 and 1440" }); return; }
    await db.execute(sql`INSERT INTO ryder_time_log (preset_id, day, minutes, note) VALUES (${p.id}, ${day}::date, ${minutes}, ${String(req.body?.note ?? "").slice(0, 300)})`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not save that" });
  }
});

router.post("/ryder/time/cancel", requireAuth, async (_req: Request, res: Response) => {
  const p = await ryderPreset();
  if (p) await db.execute(sql`DELETE FROM ryder_timer WHERE preset_id = ${p.id}`);
  res.json({ ok: true });
});

router.post("/ryder/goals", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await ryderPreset();
    if (!p) { res.status(404).json({ error: "I could not find The Ryder Clinic in your clients" }); return; }
    const cur = await loadGoals(p.id);
    const n = (v: unknown, fallback: number): number => {
      const x = Math.round(Number(v));
      return Number.isFinite(x) && x >= 1 && x <= 100000 ? x : fallback;
    };
    const g: Goals = { dms: n(req.body?.dms, cur.dms), comments: n(req.body?.comments, cur.comments), newFollowers: n(req.body?.newFollowers, cur.newFollowers),
      storyResponses: n(req.body?.storyResponses, cur.storyResponses), bookings: n(req.body?.bookings, cur.bookings) };
    await db.execute(sql`INSERT INTO ryder_goals (preset_id, dms, comments, new_followers, story_responses, bookings)
      VALUES (${p.id}, ${g.dms}, ${g.comments}, ${g.newFollowers}, ${g.storyResponses}, ${g.bookings})
      ON CONFLICT (preset_id) DO UPDATE SET dms = EXCLUDED.dms, comments = EXCLUDED.comments, new_followers = EXCLUDED.new_followers,
        story_responses = EXCLUDED.story_responses, bookings = EXCLUDED.bookings`);
    res.json({ ok: true, goals: g });
  } catch (err) {
    res.status(500).json({ error: "Could not save the goals" });
  }
});

export default router;
