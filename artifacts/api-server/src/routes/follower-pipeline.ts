import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";

// Follower Pipeline (admin only, never shown to clients): per client, the followers and following imported from an Instagram export,
// each tagged as Patient, Family, Friend and so on so Vanessa can cross them off. Instagram will not hand a tool a follower list,
// so the list comes from the account's own data export. Re-importing only adds new people and keeps existing tags.

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

const rowsOf = (r: unknown): any[] => ((r as any)?.rows ?? r ?? []) as any[];
const TAGS = ["untagged", "patient", "family", "friend", "staff", "supplier", "local-business", "potential-patient", "ignore"];

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS follower_pipeline (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      is_follower BOOLEAN NOT NULL DEFAULT false,
      is_following BOOLEAN NOT NULL DEFAULT false,
      tag TEXT NOT NULL DEFAULT 'untagged',
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (preset_id, username)
    )`);
  })();
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

router.get("/pipeline/clients", requireAuth, async (_req, res) => {
  try {
    await ensureTables();
    const presets = await db.select().from(clientPresetsTable);
    const counts = rowsOf(await db.execute(sql`SELECT preset_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE tag = 'untagged') AS untagged FROM follower_pipeline GROUP BY preset_id`));
    const byId = new Map(counts.map((c) => [Number(c.preset_id), c]));
    res.json({
      clients: presets.map((p) => ({ presetId: p.id, name: p.name, total: Number(byId.get(p.id)?.total || 0), untagged: Number(byId.get(p.id)?.untagged || 0) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    logger.error({ err }, "Pipeline clients failed");
    res.status(500).json({ error: "Could not load clients" });
  }
});

router.get("/pipeline/people", requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const presetId = Number(req.query.presetId);
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    const r = rowsOf(await db.execute(sql`SELECT id, username, is_follower, is_following, tag FROM follower_pipeline WHERE preset_id = ${presetId} ORDER BY username`));
    res.json({ people: r.map((x) => ({ id: Number(x.id), username: x.username, follower: x.is_follower, following: x.is_following, tag: x.tag })) });
  } catch {
    res.status(500).json({ error: "Could not load the pipeline" });
  }
});

router.post("/pipeline/import", requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const presetId = Number(req.body?.presetId);
    const kind = req.body?.kind === "following" ? "following" : "followers";
    const names: string[] = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
    if (!presetId || names.length === 0) { res.status(400).json({ error: "Pick a client and choose a file with usernames in it" }); return; }
    const clean = [...new Set(names.map((n) => String(n).trim().replace(/^@/, "").toLowerCase()).filter((n) => /^[a-z0-9._]{1,40}$/.test(n)))];
    let added = 0;
    for (let i = 0; i < clean.length; i += 500) {
      const chunk = clean.slice(i, i + 500);
      const values = sql.join(chunk.map((u) => sql`(${presetId}, ${u}, ${kind === "followers"}, ${kind === "following"})`), sql`, `);
      const out = rowsOf(await db.execute(sql`INSERT INTO follower_pipeline (preset_id, username, is_follower, is_following) VALUES ${values}
        ON CONFLICT (preset_id, username) DO UPDATE SET
          is_follower = follower_pipeline.is_follower OR EXCLUDED.is_follower,
          is_following = follower_pipeline.is_following OR EXCLUDED.is_following
        RETURNING (xmax = 0) AS inserted`));
      added += out.filter((o) => o.inserted === true || o.inserted === "t").length;
    }
    res.json({ ok: true, read: clean.length, added });
  } catch (err) {
    logger.error({ err }, "Pipeline import failed");
    res.status(500).json({ error: "Import failed" });
  }
});

router.post("/pipeline/tag", requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const ids: number[] = (Array.isArray(req.body?.ids) ? req.body.ids : [req.body?.id]).map(Number).filter(Boolean);
    const tag = String(req.body?.tag || "");
    if (ids.length === 0 || !TAGS.includes(tag)) { res.status(400).json({ error: "Bad tag" }); return; }
    await db.execute(sql`UPDATE follower_pipeline SET tag = ${tag} WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save that tag" });
  }
});

export default router;
