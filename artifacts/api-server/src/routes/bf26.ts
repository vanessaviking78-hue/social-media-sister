import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// /blackfriday26: counts how many people open the Black Friday page, which offer they look at,
// where they came from (the ?src= tag on the link) and who taps the WhatsApp button.

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bf26_events (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      visitor     TEXT NOT NULL,
      event       TEXT NOT NULL,
      offer       TEXT,
      src         TEXT
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bf26_events_created_idx ON bf26_events (created_at)`);
  tableReady = true;
}

const EVENTS = new Set(["view", "offer_view", "wa_click"]);
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[^A-Za-z0-9_\-.]/g, "").slice(0, max);

router.post("/bf26/track", async (req: Request, res: Response) => {
  try {
    const event = clean(req.body?.event, 20);
    const visitor = clean(req.body?.visitor, 64);
    if (!EVENTS.has(event) || !visitor) return res.status(204).end();
    const offer = clean(req.body?.offer, 30) || null;
    const src = clean(req.body?.src, 30).toLowerCase() || "direct";
    await ensureTable();
    await db.execute(sql`INSERT INTO bf26_events (visitor, event, offer, src) VALUES (${visitor}, ${event}, ${offer}, ${src})`);
    res.status(204).end();
  } catch (err) {
    console.error("bf26 track error:", err);
    res.status(204).end();
  }
});

function authed(req: Request): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  const submitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  return submitted === appPassword.trim().toLowerCase();
}

router.get("/bf26/stats", async (req: Request, res: Response) => {
  if (!authed(req)) return res.status(401).json({ error: "Please log in to your tools first." });
  try {
    await ensureTable();
    const totals = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE event = 'view')::int                                  AS opens,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int                   AS visitors,
        count(*) FILTER (WHERE event = 'wa_click')::int                              AS clicks,
        count(DISTINCT visitor) FILTER (WHERE event = 'wa_click')::int               AS clickers,
        count(DISTINCT visitor) FILTER (WHERE event = 'view' AND created_at >= NOW() - INTERVAL '24 hours')::int AS visitors_24h
      FROM bf26_events
    `);
    const byOffer = await db.execute(sql`
      SELECT offer,
        count(DISTINCT visitor) FILTER (WHERE event = 'offer_view')::int AS looked,
        count(*) FILTER (WHERE event = 'wa_click')::int                  AS clicks
      FROM bf26_events WHERE offer IS NOT NULL GROUP BY offer
    `);
    const bySrc = await db.execute(sql`
      SELECT src,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int AS visitors,
        count(*) FILTER (WHERE event = 'wa_click')::int            AS clicks
      FROM bf26_events GROUP BY src ORDER BY visitors DESC
    `);
    const byDay = await db.execute(sql`
      SELECT to_char((created_at AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS day,
        count(*) FILTER (WHERE event = 'view')::int                AS opens,
        count(DISTINCT visitor) FILTER (WHERE event = 'view')::int AS visitors,
        count(*) FILTER (WHERE event = 'wa_click')::int            AS clicks
      FROM bf26_events GROUP BY 1 ORDER BY 1 DESC LIMIT 30
    `);
    const rows = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? (r as unknown[]));
    res.setHeader("Cache-Control", "no-store");
    res.json({
      totals: (rows(totals) as Record<string, number>[])[0] ?? {},
      byOffer: rows(byOffer),
      bySrc: rows(bySrc),
      byDay: rows(byDay),
    });
  } catch (err) {
    console.error("bf26 stats error:", err);
    res.status(500).json({ error: "Could not load the stats." });
  }
});

export default router;
