import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

// Smashed performance tracker. Pulls likes, comments, saves, shares and reach for every published Smashed post straight from Instagram
// (needs instagram_manage_insights, added to the connect scopes in meta-auth.ts, so Smashed has to be reconnected once). Scores each post and
// marks the top quarter as high performing. The page is /smashedperformance.

const router: IRouter = Router();
const GRAPH = "https://graph.facebook.com/v22.0";

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

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS post_metrics (
      scheduled_post_id INTEGER PRIMARY KEY,
      preset_id INTEGER NOT NULL,
      ig_media_id TEXT NOT NULL,
      permalink TEXT,
      likes INTEGER,
      comments INTEGER,
      saved INTEGER,
      shares INTEGER,
      reach INTEGER,
      insights_error TEXT NOT NULL DEFAULT '',
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => undefined);
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

async function graphGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(25000) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(String(data?.error?.message || `Meta said ${res.status}`));
  return data;
}

let lastSync: { at: string; checked: number; error: string } | null = null;
let syncing = false;

export async function syncSmashedMetrics(maxPosts = 60): Promise<{ checked: number; error: string }> {
  if (syncing) return { checked: 0, error: "" };
  syncing = true;
  let error = "";
  let checked = 0;
  try {
    await ensureTable();
    const preset = rowsOf(await db.execute(sql`SELECT id, meta_page_access_token FROM client_presets WHERE name ILIKE '%smashed%' ORDER BY id LIMIT 1`))[0];
    if (!preset) return { checked: 0, error: "I could not find a client called Smashed" };
    const token = preset.meta_page_access_token as string | null;
    if (!token) return { checked: 0, error: "Smashed is not connected to Instagram yet" };
    const posts = rowsOf(await db.execute(sql`SELECT id, meta_result->>'igPostId' AS ig_id FROM scheduled_posts
      WHERE preset_id = ${preset.id} AND status = 'published' AND post_type NOT ILIKE '%story%' AND meta_result->>'igPostId' IS NOT NULL
      ORDER BY scheduled_at DESC LIMIT ${maxPosts}`));
    for (const post of posts) {
      const mediaId = String(post.ig_id);
      let likes: number | null = null, comments: number | null = null, permalink: string | null = null;
      let saved: number | null = null, shares: number | null = null, reach: number | null = null, insightsError = "";
      try {
        const m = await graphGet(mediaId, { fields: "like_count,comments_count,permalink" }, token);
        likes = typeof m.like_count === "number" ? m.like_count : null;
        comments = typeof m.comments_count === "number" ? m.comments_count : null;
        permalink = m.permalink || null;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        continue;
      }
      try {
        const ins = await graphGet(`${mediaId}/insights`, { metric: "reach,saved,shares" }, token);
        for (const row of ins.data || []) {
          const v = row.values?.[0]?.value ?? row.total_value?.value;
          if (row.name === "reach") reach = Number(v);
          if (row.name === "saved") saved = Number(v);
          if (row.name === "shares") shares = Number(v);
        }
      } catch (e) {
        insightsError = e instanceof Error ? e.message : String(e);
      }
      await db.execute(sql`INSERT INTO post_metrics (scheduled_post_id, preset_id, ig_media_id, permalink, likes, comments, saved, shares, reach, insights_error, fetched_at)
        VALUES (${post.id}, ${preset.id}, ${mediaId}, ${permalink}, ${likes}, ${comments}, ${saved}, ${shares}, ${reach}, ${insightsError}, now())
        ON CONFLICT (scheduled_post_id) DO UPDATE SET permalink = EXCLUDED.permalink, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
          saved = EXCLUDED.saved, shares = EXCLUDED.shares, reach = EXCLUDED.reach, insights_error = EXCLUDED.insights_error, fetched_at = now()`);
      checked++;
    }
    return { checked, error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, `Smashed metrics sync failed: ${msg}`);
    return { checked, error: msg };
  } finally {
    syncing = false;
    lastSync = { at: new Date().toISOString(), checked, error };
  }
}

let timer: NodeJS.Timeout | null = null;
export function startSmashedMetricsSync(): void {
  if (timer) return;
  setTimeout(() => { syncSmashedMetrics(30).catch(() => undefined); }, 90_000);
  timer = setInterval(() => { syncSmashedMetrics(30).catch(() => undefined); }, 60 * 60 * 1000);
}

router.post("/smashed/performance/sync", requireAuth, async (_req, res) => {
  const r = await syncSmashedMetrics(60);
  res.json(r);
});

router.get("/smashed/performance", requireAuth, async (_req, res) => {
  try {
    await ensureTable();
    const r = rowsOf(await db.execute(sql`SELECT sp.id, sp.scheduled_at, sp.content->>'title' AS title, sp.content->>'caption' AS caption, sp.post_type,
        m.permalink, m.likes, m.comments, m.saved, m.shares, m.reach, m.insights_error, m.fetched_at
      FROM scheduled_posts sp
      JOIN client_presets cp ON cp.id = sp.preset_id AND cp.name ILIKE '%smashed%'
      LEFT JOIN post_metrics m ON m.scheduled_post_id = sp.id
      WHERE sp.status = 'published' AND sp.post_type NOT ILIKE '%story%'
      ORDER BY sp.scheduled_at DESC LIMIT 120`));
    const posts = r.map((x) => {
      const likes = x.likes == null ? null : Number(x.likes);
      const comments = x.comments == null ? null : Number(x.comments);
      const saved = x.saved == null ? null : Number(x.saved);
      const shares = x.shares == null ? null : Number(x.shares);
      const reach = x.reach == null ? null : Number(x.reach);
      const hasData = x.fetched_at != null;
      const score = hasData ? (likes ?? 0) + 2 * (comments ?? 0) + 3 * (saved ?? 0) + 4 * (shares ?? 0) : null;
      const rate = score != null && reach ? Math.round((score / reach) * 1000) / 10 : null;
      return {
        id: Number(x.id), title: String(x.title || ""), caption: String(x.caption || "").slice(0, 160), postedAt: x.scheduled_at, permalink: x.permalink,
        likes, comments, saved, shares, reach, score, rate, insightsError: String(x.insights_error || ""), hasData, tier: "none" as "high" | "steady" | "slow" | "none",
      };
    });
    // Rank by engagement rate where reach is known, otherwise by raw score. Top quarter (at least one) are high performing.
    const rankable = posts.filter((p) => p.hasData && (p.score ?? 0) > 0);
    const key = (p: (typeof posts)[number]) => (p.rate != null ? p.rate : (p.score ?? 0));
    rankable.sort((a, b) => key(b) - key(a));
    const topN = rankable.length >= 4 ? Math.ceil(rankable.length / 4) : rankable.length >= 1 ? 1 : 0;
    rankable.forEach((p, i) => { p.tier = i < topN ? "high" : i >= rankable.length - Math.floor(rankable.length / 4) && rankable.length >= 4 ? "slow" : "steady"; });
    for (const p of posts) if (p.hasData && p.tier === "none") p.tier = "slow";
    const withData = posts.filter((p) => p.hasData);
    res.json({
      posts: [...posts].sort((a, b) => (b.hasData ? key(b) : -1) - (a.hasData ? key(a) : -1)),
      totals: {
        published: posts.length,
        tracked: withData.length,
        likes: withData.reduce((a, p) => a + (p.likes ?? 0), 0),
        comments: withData.reduce((a, p) => a + (p.comments ?? 0), 0),
        saved: withData.reduce((a, p) => a + (p.saved ?? 0), 0),
        shares: withData.reduce((a, p) => a + (p.shares ?? 0), 0),
        reach: withData.reduce((a, p) => a + (p.reach ?? 0), 0),
      },
      lastSync,
    });
  } catch (err) {
    logger.error({ err }, `Smashed performance failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not load the numbers" });
  }
});

export default router;
