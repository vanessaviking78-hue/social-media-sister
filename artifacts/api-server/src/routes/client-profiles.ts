import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
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
      .then(() => db.execute(sql`ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS share_token TEXT`))
      .then(() => db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS client_profiles_share_token_idx ON client_profiles (share_token)`))
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
      if (typeof v === "string" && k.length < 60) answers[k] = v.slice(0, k === "reviewImages" ? 20000 : 4000);
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

const LABELS: Record<string, string> = {
  who: "Clinician and town",
  words: "Three words for their personality",
  adore: "What patients adore about them",
  colours: "Brand colours",
  font: "Font vibe",
  patient: "Their ideal patient",
  worries: "What that patient worries about before booking",
  treatments: "Signature treatments",
  humour: "Their sense of humour",
  never: "OFF LIMITS (never write about or include these)",
  links: "Website and Instagram",
  extra: "What else makes them them",
};

/**
 * What I know about a client, written as a block for the caption, hook, story and copy prompts so the
 * writing sounds like them. Returns an empty string when there is no profile yet. Never throws.
 */
export async function clientProfileContext(clientName?: string | null): Promise<string> {
  try {
    const n = String(clientName ?? "").trim();
    if (n.length < 2) return "";
    await ensureTable();
    const r = await db.execute(sql`
      SELECT client_name, answers_json, photo_url, updated_at FROM client_profiles
      WHERE lower(client_name) = lower(${n}) LIMIT 1
    `);
    const row = (r.rows as Row[])[0];
    if (!row) return "";
    const { answers } = shape(row);
    const lines = Object.keys(LABELS)
      .filter(k => (answers[k] ?? "").trim())
      .map(k => `- ${LABELS[k]}: ${answers[k].trim().replace(/\s+/g, " ")}`);
    if (!lines.length) return "";
    return `\n\nWHAT I KNOW ABOUT THIS CLIENT (it is their own words, so make the writing sound like them, use their humour and their patients' worries, and respect the off limits list absolutely. Never quote this back word for word and never mention that you have it):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

const newToken = () => randomBytes(12).toString("hex");

// Gives a client their own link, once. Asking again returns the same link.
router.post("/client-profiles/:name/link", async (req, res) => {
  try {
    await ensureTable();
    const name = String(req.params.name || "").trim();
    if (!name) { res.status(400).json({ error: "Client name needed" }); return; }
    await db.execute(sql`
      INSERT INTO client_profiles (client_name, answers_json) VALUES (${name}, '{}')
      ON CONFLICT (client_name) DO NOTHING
    `);
    const t = await db.execute(sql`SELECT share_token FROM client_profiles WHERE lower(client_name) = lower(${name}) LIMIT 1`);
    let token = (t.rows[0] as { share_token: string | null } | undefined)?.share_token ?? null;
    if (!token) {
      token = newToken();
      await db.execute(sql`UPDATE client_profiles SET share_token = ${token} WHERE lower(client_name) = lower(${name}) AND share_token IS NULL`);
      const again = await db.execute(sql`SELECT share_token FROM client_profiles WHERE lower(client_name) = lower(${name}) LIMIT 1`);
      token = (again.rows[0] as { share_token: string }).share_token;
    }
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not make the link" });
  }
});

// The page a client opens from their link. The token is the only key, and it only ever opens their own profile.
router.get("/know-me/:token", async (req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT client_name, answers_json, photo_url, updated_at FROM client_profiles WHERE share_token = ${req.params.token} LIMIT 1`);
    const row = (r.rows as Row[])[0];
    if (!row) { res.status(404).json({ error: "This link is not valid" }); return; }
    res.json({ profile: shape(row) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not open your page" });
  }
});

router.put("/know-me/:token", async (req, res) => {
  try {
    await ensureTable();
    const body = (req.body ?? {}) as { answers?: Record<string, unknown>; photoUrl?: string | null };
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.answers ?? {})) {
      if (typeof v === "string" && k.length < 60) answers[k] = v.slice(0, k === "reviewImages" ? 20000 : 4000);
    }
    const photo = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
    const r = await db.execute(sql`
      UPDATE client_profiles
      SET answers_json = ${JSON.stringify(answers)}, photo_url = COALESCE(${photo}, photo_url), updated_at = NOW()
      WHERE share_token = ${req.params.token}
      RETURNING id
    `);
    if (!r.rows.length) { res.status(404).json({ error: "This link is not valid" }); return; }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

export default router;
