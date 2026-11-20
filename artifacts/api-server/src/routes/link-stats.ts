import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";

// ONE ANALYTICS PAGE for every link Vanessa sends out: the Social Media Sister Black Friday page and sign up links, the Hammered Black Friday
// page and freebies links, and the Freehold freebies links. The page at /linkstats reads from here. It only reads, nothing is changed.

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

type Row = Record<string, unknown>;
// A table might not exist yet (nobody has opened that link), so every read falls back to nothing rather than failing the whole page.
const rows = async (q: SQL): Promise<Row[]> => {
  try { return (await db.execute(q)).rows as Row[]; } catch { return []; }
};
const num = (v: unknown) => Number(v ?? 0) || 0;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

async function blackFriday(scope: SQL) {
  const total = (await rows(sql`
    SELECT COUNT(DISTINCT visitor) FILTER (WHERE event = 'view')::int AS visitors,
           COUNT(*) FILTER (WHERE event = 'wa_click')::int AS taps,
           COUNT(DISTINCT visitor) FILTER (WHERE event = 'view' AND created_at > now() - interval '24 hours')::int AS visitors24,
           COUNT(*) FILTER (WHERE event = 'wa_click' AND created_at > now() - interval '24 hours')::int AS taps24,
           MAX(created_at) FILTER (WHERE event = 'view') AS last_view
    FROM bf26_events WHERE ${scope}`))[0] || {};
  const bySrc = await rows(sql`
    SELECT src, COUNT(DISTINCT visitor) FILTER (WHERE event = 'view')::int AS visitors, COUNT(*) FILTER (WHERE event = 'wa_click')::int AS taps
    FROM bf26_events WHERE ${scope} GROUP BY src ORDER BY visitors DESC, taps DESC LIMIT 30`);
  const byOffer = await rows(sql`
    SELECT offer, COUNT(DISTINCT visitor) FILTER (WHERE event = 'offer_view')::int AS looked, COUNT(*) FILTER (WHERE event = 'wa_click')::int AS taps
    FROM bf26_events WHERE ${scope} AND offer IS NOT NULL AND offer NOT IN ('h-page') GROUP BY offer ORDER BY looked DESC`);
  return {
    visitors: num(total.visitors), taps: num(total.taps), visitors24: num(total.visitors24), taps24: num(total.taps24), lastView: iso(total.last_view),
    bySrc: bySrc.map((r) => ({ src: String(r.src), visitors: num(r.visitors), taps: num(r.taps) })),
    byOffer: byOffer.map((r) => ({ offer: String(r.offer), looked: num(r.looked), taps: num(r.taps) })),
  };
}

async function freebies(eventsTable: SQL, kind: string) {
  const ev = await rows(sql`
    SELECT ref, COUNT(*) FILTER (WHERE kind = 'open')::int AS opens, COUNT(*) FILTER (WHERE kind = 'start')::int AS started,
           MAX(created_at) FILTER (WHERE kind = 'open') AS last_open
    FROM ${eventsTable} GROUP BY ref`);
  const en = await rows(sql`
    SELECT COALESCE(answers->>'ref', '') AS ref, COUNT(*)::int AS entries, MAX(created_at) AS last_entry
    FROM tenfree_requests WHERE kind = ${kind} GROUP BY 1`);
  const map = new Map<string, { ref: string; opens: number; started: number; entries: number; lastOpen: string | null; lastEntry: string | null }>();
  const get = (ref: string) => {
    if (!map.has(ref)) map.set(ref, { ref, opens: 0, started: 0, entries: 0, lastOpen: null, lastEntry: null });
    return map.get(ref)!;
  };
  for (const r of ev) { const o = get(String(r.ref ?? "")); o.opens = num(r.opens); o.started = num(r.started); o.lastOpen = iso(r.last_open); }
  for (const r of en) { const o = get(String(r.ref ?? "")); o.entries = num(r.entries); o.lastEntry = iso(r.last_entry); }
  return [...map.values()].sort((a, b) => b.opens - a.opens);
}

router.get("/linkstats/data", requireAuth, async (_req: Request, res: Response) => {
  try {
    const sms = await blackFriday(sql`(offer IS NULL OR offer NOT LIKE 'h-%')`);
    const ham = await blackFriday(sql`offer LIKE 'h-%'`);
    const hamFree = await freebies(sql`hammered_link_events`, "hammered");
    const freeFree = await freebies(sql`smashed_link_events`, "freehouse");
    const ev = await rows(sql`
      SELECT ref, COUNT(*) FILTER (WHERE kind = 'open')::int AS opens, COUNT(*) FILTER (WHERE kind = 'start')::int AS started,
             MAX(created_at) FILTER (WHERE kind = 'open') AS last_open
      FROM sales_link_events GROUP BY ref`);
    const partners = await rows(sql`
      SELECT p.name, COUNT(l.id) FILTER (WHERE l.via_link = TRUE)::int AS signups
      FROM sales_partners p LEFT JOIN sales_leads l ON l.partner_slot = p.slot WHERE p.name <> '' GROUP BY p.slot, p.name ORDER BY p.slot`);
    const refOf = (name: string) => name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const signup = partners.map((p) => {
      const ref = refOf(String(p.name));
      const e = ev.find((x) => String(x.ref) === ref);
      return { name: String(p.name), ref, opens: num(e?.opens), started: num(e?.started), signups: num(p.signups), lastOpen: iso(e?.last_open) };
    });
    res.json({ sms, ham, hamFree, freeFree, signup });
  } catch (err) {
    console.error("link stats failed", err);
    res.status(500).json({ error: "Could not load the numbers" });
  }
});

export default router;
