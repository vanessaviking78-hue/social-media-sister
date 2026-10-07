import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// "Getting to know you": one profile per client, keyed by the client name. The answers and the
// guide photo are kept so every shoot, cover and caption can start from who the client really is.

const router: IRouter = Router();

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS client_profiles (
          id SERIAL PRIMARY KEY,
          client_name TEXT NOT NULL UNIQUE,
          answers_json TEXT NOT NULL DEFAULT '{}',
          photo_url TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch(e => { ready = null; throw e; });
  }
  return ready;
}

type Row = { client_name: string; answers_json: string; photo_url: string | null; updated_at: string };

function shape(r: Row) {
  let answers: Record<string, string> = {};
  try { answers = JSON.parse(r.answers_json) ?? {}; } catch { answers = {}; }
  return { clientName: r.client_name, answers, photoUrl: r.photo_url, updatedAt: r.updated_at };
}

router.get("/client-profiles", async (_req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT client_name, answers_json, photo_url, updated_at FROM client_profiles ORDER BY client_name`);
    res.json({ profiles: (r.rows as Row[]).map(shape) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load profiles" });
  }
});

router.get("/client-profiles/:name", async (req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT client_name, answers_json, photo_url, updated_at FROM client_profiles WHERE lower(client_name) = lower(${req.params.name}) LIMIT 1`);
    const row = (r.rows as Row[])[0];
    res.json({ profile: row ? shape(row) : null });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load the profile" });
  }
});

router.put("/client-profiles/:name", async (req, res) => {
  try {
    await ensureTable();
    const name = String(req.params.name || "").trim();
    if (!name) { res.status(400).json({ error: "Client name needed" }); return; }
    const body = (req.body ?? {}) as { answers?: Record<string, unknown>; photoUrl?: string | null };
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.answers ?? {})) {
      if (typeof v === "string" && k.length < 60) answers[k] = v.slice(0, 4000);
    }
    const photo = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
    await db.execute(sql`
      INSERT INTO client_profiles (client_name, answers_json, photo_url, updated_at)
      VALUES (${name}, ${JSON.stringify(answers)}, ${photo}, NOW())
      ON CONFLICT (client_name) DO UPDATE
        SET answers_json = EXCLUDED.answers_json,
            photo_url = COALESCE(EXCLUDED.photo_url, client_profiles.photo_url),
            updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save the profile" });
  }
});

export default router;
