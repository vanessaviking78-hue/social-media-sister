import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Simple visit tracking for public pages (first one: /smskirsty). Counts opens, people who started the form and applications sent.

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS page_events (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      page        TEXT NOT NULL,
      visitor     TEXT NOT NULL,
      event       TEXT NOT NULL,
      src         TEXT
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS page_events_page_created_idx ON page_events (page, created_at)`);
  tableReady = true;
}

const EVENTS = new Set(["view", "form_start", "applied"]);
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[^A-Za-z0-9_\-.]/g, "").slice(0, max);

router.post("/page-track", async (req: Request, res: Response) => {
  try {
    const page = clean(req.body?.page, 30).toLowerCase();
    const event = clean(req.body?.event, 20);
    const visitor = clean(req.body?.visitor, 64);
    if (!page || !EVENTS.has(event) || !visitor) return res.status(204).end();
    const src = clean(req.body?.src, 30).toLowerCase() || "direct";
    await ensureTable();
    await db.execute(sql`INSERT INTO page_events (page, visitor, event, src) VALUES (${page}, ${visitor}, ${event}, ${src})`);
    res.status(204).end();
  } catch (err) {
    console.error("page-track error:", err);
    res.status(204).end();
  }
});

function authed(req: Request): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  const submitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  return submitted === appPassword.trim().toLowerCase();
}

router.get("/page-track/stats", async (req: Request, res: Response) => {
  if (!authed(req)) return res.status(401).json({ error: "Please log in to your tools first." });
  const page = clean(req.query.page, 30).toLowerCase();
  if (!page) return res.status(400).json({ error: "Which page?" });
  try {
    await ensureTable();
    const totals = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE event = 'view')::int                                  AS opens,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int                   AS visitors,
        count(DISTINCT visitor) FILTER (WHERE event = 'form_start')::int             AS started,
        count(DISTINCT visitor) FILTER (WHERE event = 'applied')::int                AS applied,
        count(DISTINCT visitor) FILTER (WHERE event = 'view' AND created_at >= NOW() - INTERVAL '24 hours')::int AS visitors_24h
      FROM page_events WHERE page = ${page}
    `);
    const bySrc = await db.execute(sql`
      SELECT src,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int  AS visitors,
        count(DISTINCT visitor) FILTER (WHERE event = 'applied')::int AS applied
      FROM page_events WHERE page = ${page} GROUP BY src ORDER BY visitors DESC
    `);
    const byDay = await db.execute(sql`
      SELECT to_char((created_at AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS day,
        count(*) FILTER (WHERE event = 'view')::int                AS opens,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int AS visitors,
        count(DISTINCT visitor) FILTER (WHERE event = 'applied')::int AS applied
      FROM page_events WHERE page = ${page} GROUP BY 1 ORDER BY 1 DESC LIMIT 30
    `);
    const rows = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? (r as unknown[]));
    res.setHeader("Cache-Control", "no-store");
    res.json({ totals: (rows(totals) as Record<string, number>[])[0] ?? {}, bySrc: rows(bySrc), byDay: rows(byDay) });
  } catch (err) {
    console.error("page-track stats error:", err);
    res.status(500).json({ error: "Could not load the stats." });
  }
});

export default router;
