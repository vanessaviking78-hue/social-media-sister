import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { notifySubmission } from "../lib/notify";

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
      .then(() => db.execute(sql`
        CREATE TABLE IF NOT EXISTS client_profile_submissions (
          id SERIAL PRIMARY KEY,
          typed_name TEXT NOT NULL,
          matched_name TEXT,
          answers_json TEXT NOT NULL DEFAULT '{}',
          photo_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `))
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
      RETURNING id, client_name
    `);
    if (!r.rows.length) { res.status(404).json({ error: "This link is not valid" }); return; }
    const filled = Object.entries(answers).filter(([k, v]) => k !== "reviewImages" && v.trim()).length;
    void notifySubmission({
      clientName: String((r.rows[0] as { client_name: string }).client_name),
      kind: "Getting to know you form",
      story: `${filled} answers${photo ? ", a guide photo" : ""}. Saved onto their profile.`,
    }).catch(() => undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

// ---- one shared link for everyone -------------------------------------------------------------
// A client opens the shared link, says which clinic they are and fills the form in. If the name matches a
// client of mine whose profile is still empty it is saved straight onto them. Otherwise it waits for me to
// check it, so nobody can overwrite someone else's answers by typing their name.
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");

async function matchClient(typed: string): Promise<string | null> {
  const t = norm(typed);
  if (t.length < 3) return null;
  const rows = await db.select({ name: clientPresetsTable.name }).from(clientPresetsTable);
  const names = rows.map(r => r.name).filter(Boolean);
  const exact = names.filter(n => norm(n) === t);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const near = names.filter(n => { const m = norm(n); return m.length >= 5 && t.length >= 5 && (m.includes(t) || t.includes(m)); });
  return near.length === 1 ? near[0] : null;
}

function cleanAnswers(raw: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    if (typeof v === "string" && k.length < 60) answers[k] = v.slice(0, k === "reviewImages" ? 20000 : 4000);
  }
  return answers;
}

async function applyToProfile(name: string, answers: Record<string, string>, photo: string | null) {
  await db.execute(sql`
    INSERT INTO client_profiles (client_name, answers_json, photo_url, updated_at)
    VALUES (${name}, ${JSON.stringify(answers)}, ${photo}, NOW())
    ON CONFLICT (client_name) DO UPDATE
      SET answers_json = EXCLUDED.answers_json,
          photo_url = COALESCE(EXCLUDED.photo_url, client_profiles.photo_url),
          updated_at = NOW()
  `);
}

router.post("/know-me-submit", async (req, res) => {
  try {
    await ensureTable();
    const body = (req.body ?? {}) as { clinicName?: string; answers?: unknown; photoUrl?: string | null };
    const typed = String(body.clinicName ?? "").trim().slice(0, 120);
    if (typed.length < 2) { res.status(400).json({ error: "Please tell me which clinic you are" }); return; }
    const answers = cleanAnswers(body.answers);
    const photo = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
    const matched = await matchClient(typed);
    let status = "pending";
    if (matched) {
      const ex = await db.execute(sql`SELECT answers_json FROM client_profiles WHERE lower(client_name) = lower(${matched}) LIMIT 1`);
      let existing: Record<string, string> = {};
      try { existing = JSON.parse((ex.rows[0] as { answers_json: string } | undefined)?.answers_json ?? "{}") ?? {}; } catch { existing = {}; }
      const hasAnswers = Object.entries(existing).some(([k, v]) => k !== "reviewImages" && typeof v === "string" && v.trim());
      if (!hasAnswers) { await applyToProfile(matched, answers, photo); status = "applied"; }
    }
    await db.execute(sql`
      INSERT INTO client_profile_submissions (typed_name, matched_name, answers_json, photo_url, status)
      VALUES (${typed}, ${matched}, ${JSON.stringify(answers)}, ${photo}, ${status})
    `);
    const filled = Object.entries(answers).filter(([k, v]) => k !== "reviewImages" && v.trim()).length;
    void notifySubmission({
      clientName: matched ?? typed,
      kind: "Getting to know you form",
      submitterName: matched && matched !== typed ? typed : undefined,
      story: `${filled} answers${photo ? ", a guide photo" : ""}. ${status === "applied" ? "Saved straight onto their profile." : "Waiting for you to check it in Getting to know you."}`,
    }).catch(() => undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

// What is waiting for me to check.
router.get("/client-profile-submissions", async (_req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT id, typed_name, matched_name, answers_json, photo_url, created_at FROM client_profile_submissions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`);
    res.json({
      submissions: (r.rows as { id: number; typed_name: string; matched_name: string | null; answers_json: string; photo_url: string | null; created_at: string }[]).map(x => {
        let answers: Record<string, string> = {};
        try { answers = JSON.parse(x.answers_json) ?? {}; } catch { answers = {}; }
        return { id: x.id, typedName: x.typed_name, matchedName: x.matched_name, answers, photoUrl: x.photo_url, createdAt: x.created_at };
      }),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load" });
  }
});

router.post("/client-profile-submissions/:id/accept", async (req, res) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const name = String((req.body ?? {}).clientName ?? "").trim();
    if (!id || !name) { res.status(400).json({ error: "Choose which client this is" }); return; }
    const r = await db.execute(sql`SELECT answers_json, photo_url FROM client_profile_submissions WHERE id = ${id} AND status = 'pending' LIMIT 1`);
    const row = r.rows[0] as { answers_json: string; photo_url: string | null } | undefined;
    if (!row) { res.status(404).json({ error: "Already dealt with" }); return; }
    let answers: Record<string, string> = {};
    try { answers = cleanAnswers(JSON.parse(row.answers_json)); } catch { answers = {}; }
    await applyToProfile(name, answers, row.photo_url);
    await db.execute(sql`UPDATE client_profile_submissions SET status = 'applied', matched_name = ${name} WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not apply" });
  }
});

router.post("/client-profile-submissions/:id/dismiss", async (req, res) => {
  try {
    await ensureTable();
    await db.execute(sql`UPDATE client_profile_submissions SET status = 'dismissed' WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not dismiss" });
  }
});

export default router;
