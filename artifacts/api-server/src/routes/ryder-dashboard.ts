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
export const WEEKLY_TARGETS = { comments: 10, dms: 10, newFollowers: 15, storyResponses: 5 };
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
  setTimeout(() => { snapshotRyderFollowers().catch(() => undefined); }, 120_000);
  timer = setInterval(() => { snapshotRyderFollowers().catch(() => undefined); }, 3 * 60 * 60 * 1000);
}

// ---------- the numbers ----------

type Day = {
  day: string; newFollowers: number | null; newFollowing: number | null; commentsIn: number; commentsOut: number;
  dmsIn: number; dmsOut: number; storyResponses: number | null; note: string; followersAuto: boolean;
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

function scoreOf(t: Totals, days: number, dm: { answered: number; total: number }) {
  const weeks = days / 7;
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

  const dmTarget = WEEKLY_TARGETS.dms * weeks;
  const dmTotal = t.dmsIn + t.dmsOut;
  parts.push({ key: "conversations", label: "DM conversations", weight: WEIGHTS.conversations, value: dmTotal, target: Math.round(dmTarget),
    points: cap(dmTotal / dmTarget) * WEIGHTS.conversations, detail: `${t.dmsIn} in, ${t.dmsOut} out` });

  const cTarget = WEEKLY_TARGETS.comments * weeks;
  const cTotal = t.commentsIn + t.commentsOut;
  parts.push({ key: "comments", label: "Comments", weight: WEIGHTS.comments, value: cTotal, target: Math.round(cTarget),
    points: cap(cTotal / cTarget) * WEIGHTS.comments, detail: `${t.commentsIn} received, ${t.commentsOut} replied` });

  const fTarget = WEEKLY_TARGETS.newFollowers * weeks;
  parts.push({ key: "followers", label: "New followers", weight: WEIGHTS.followers, value: t.newFollowers, target: Math.round(fTarget),
    points: t.newFollowers == null ? null : cap(t.newFollowers / fTarget) * WEIGHTS.followers,
    detail: t.newFollowers == null ? "No follower numbers yet" : `${t.newFollowers} new, ${t.newFollowing ?? 0} followed` });

  const sTarget = WEEKLY_TARGETS.storyResponses * weeks;
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
    const health = scoreOf(totals, days, dm);
    const prevHealth = scoreOf(prevTotals, days, prevDm);

    const snap = rowsOf(await db.execute(sql`SELECT day::text AS day, followers, following FROM follower_snapshots WHERE preset_id = ${p.id} ORDER BY day DESC LIMIT 1`))[0];
    const first = rowsOf(await db.execute(sql`SELECT day::text AS day, followers FROM follower_snapshots WHERE preset_id = ${p.id} ORDER BY day ASC LIMIT 1`))[0];
    const backlog = rowsOf(await db.execute(sql`SELECT COUNT(*) AS n FROM inbox_items WHERE preset_id = ${p.id} AND direction = 'in' AND is_read = false`))[0];

    res.json({
      clinic: p.name, connected: !!(p.ig_id && p.token), username: p.username, days, from, to,
      totals, prevTotals, health: { ...health, previous: prevHealth.score }, targets: WEEKLY_TARGETS,
      series, followers: snap ? { now: Number(snap.followers), following: Number(snap.following), asOf: snap.day, since: first ? { day: first.day, count: Number(first.followers) } : null } : null,
      unanswered: Number(backlog?.n ?? 0), lastSnapshot,
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
  res.json(r);
});

export default router;
