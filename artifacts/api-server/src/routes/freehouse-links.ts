import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureTable as ensureTenFreeTable } from "./ten-free";

// Freehouse tracking links. Each person promoting Freehouse gets a link ending ?ref=name. The free sample page reports when the link is
// opened ("open") and when the visitor first types into the form ("start"). Entries come from the tenfree_requests table, where the
// intake saves the ref inside answers. The dashboard at /freehouselinks reads the totals from here.

const router: IRouter = Router();

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

const cleanRef = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
const cleanVisitor = (v: unknown) => String(v ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS smashed_link_events (
      id BIGSERIAL PRIMARY KEY,
      ref TEXT NOT NULL DEFAULT '',
      visitor TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => db.execute(sql`CREATE INDEX IF NOT EXISTS smashed_link_events_ref_idx ON smashed_link_events (ref, kind)`))
    .then(() => undefined);
  p.catch(() => { ready = null; });
  ready = p;
  return p;
}

// Public: called by the free sample page. Never fails loudly, a tracking hiccup must not get in the way of a tradesperson.
router.post("/freehouse/hit", async (req: Request, res: Response) => {
  try {
    const kind = req.body?.kind === "start" ? "start" : "open";
    const ref = cleanRef(req.body?.ref);
    const visitor = cleanVisitor(req.body?.visitor);
    if (!visitor) { res.json({ ok: true }); return; }
    await ensureTable();
    // Count each visitor once per kind per link, so refreshing the page does not inflate the numbers.
    const seen = await db.execute(sql`SELECT 1 FROM smashed_link_events WHERE ref = ${ref} AND visitor = ${visitor} AND kind = ${kind} LIMIT 1`);
    if (seen.rows.length === 0) await db.execute(sql`INSERT INTO smashed_link_events (ref, visitor, kind) VALUES (${ref}, ${visitor}, ${kind})`);
  } catch (err) {
    req.log?.warn({ err }, "freehouse hit failed");
  }
  res.json({ ok: true });
});

router.get("/freehouse/links", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    await ensureTenFreeTable();
    const events = await db.execute(sql`
      SELECT ref,
        COUNT(*) FILTER (WHERE kind = 'open')::int AS opens,
        COUNT(*) FILTER (WHERE kind = 'start')::int AS started,
        MAX(created_at) FILTER (WHERE kind = 'open') AS last_open
      FROM smashed_link_events GROUP BY ref`);
    const entries = await db.execute(sql`
      SELECT COALESCE(answers->>'ref', '') AS ref, COUNT(*)::int AS entries, MAX(created_at) AS last_entry
      FROM tenfree_requests WHERE kind = 'freehouse' GROUP BY 1`);
    const recent = await db.execute(sql`
      SELECT id, clinic_name, clinician_name, COALESCE(answers->>'bizType', '') AS trade, COALESCE(answers->>'ref', '') AS ref, status, created_at
      FROM tenfree_requests WHERE kind = 'freehouse' ORDER BY created_at DESC LIMIT 30`);
    const map = new Map<string, { ref: string; opens: number; started: number; entries: number; lastOpen: string | null; lastEntry: string | null }>();
    const row = (ref: string) => {
      if (!map.has(ref)) map.set(ref, { ref, opens: 0, started: 0, entries: 0, lastOpen: null, lastEntry: null });
      return map.get(ref)!;
    };
    for (const r of events.rows as Array<Record<string, unknown>>) {
      const o = row(String(r.ref ?? ""));
      o.opens = Number(r.opens); o.started = Number(r.started); o.lastOpen = r.last_open ? new Date(String(r.last_open)).toISOString() : null;
    }
    for (const r of entries.rows as Array<Record<string, unknown>>) {
      const o = row(String(r.ref ?? ""));
      o.entries = Number(r.entries); o.lastEntry = r.last_entry ? new Date(String(r.last_entry)).toISOString() : null;
    }
    res.json({
      links: [...map.values()],
      recent: (recent.rows as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), business: String(r.clinic_name), name: String(r.clinician_name), trade: String(r.trade), ref: String(r.ref), status: String(r.status), at: new Date(String(r.created_at)).toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load the links" });
    console.error("freehouse links failed", err);
  }
});

export default router;
