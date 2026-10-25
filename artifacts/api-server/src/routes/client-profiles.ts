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

export function normaliseSite(url?: string | null): string {
  const first = String(url ?? "").trim().split(/\s+/)[0] ?? "";
  return first.toLowerCase().replace(/[,;.]+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

let siteCacheReady: Promise<void> | null = null;
function ensureSiteCache(): Promise<void> {
  if (!siteCacheReady) {
    siteCacheReady = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS client_site_cache (
          site TEXT PRIMARY KEY,
          treatments_json TEXT NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch(e => { siteCacheReady = null; throw e; });
  }
  return siteCacheReady;
}

/** Remembers the treatments read from a clinic website so every writing tool can use them. Never throws. */
export async function rememberSiteTreatments(website: string, treatments: string[]): Promise<void> {
  try {
    const site = normaliseSite(website);
    if (!site || !treatments.length) return;
    await ensureSiteCache();
    await db.execute(sql`
      INSERT INTO client_site_cache (site, treatments_json, updated_at) VALUES (${site}, ${JSON.stringify(treatments.slice(0, 40))}, NOW())
      ON CONFLICT (site) DO UPDATE SET treatments_json = EXCLUDED.treatments_json, updated_at = NOW()
    `);
  } catch { /* the cache is a nicety */ }
}

/** The caption footnote saved on a client's preset, or an empty string. Never throws. */
export async function captionFootnoteFor(clientName?: string | null): Promise<string> {
  const n = String(clientName ?? "").trim();
  if (n.length < 2) return "";
  try {
    const r = await db.execute(sql`SELECT caption_footnote FROM client_presets WHERE lower(name) = lower(${n}) LIMIT 1`);
    return String((r.rows[0] as { caption_footnote?: string | null } | undefined)?.caption_footnote ?? "").trim();
  } catch {
    return "";
  }
}

/** Adds the client's own footnote to the end of a caption, once. Never throws. */
export async function withFootnote(clientName: string | null | undefined, caption: string): Promise<string> {
  const foot = await captionFootnoteFor(clientName);
  if (!foot || !caption.trim() || caption.includes(foot)) return caption;
  return `${caption.trimEnd()}\n\n${foot}`;
}

/** The same client context, found from a preset id for the tools that work from presets. Never throws. */
export async function clientProfileContextByPreset(presetId?: number | string | null): Promise<string> {
  const id = Number(presetId);
  if (!Number.isFinite(id) || id <= 0) return "";
  try {
    const r = await db.execute(sql`SELECT name FROM client_presets WHERE id = ${id} LIMIT 1`);
    const name = (r.rows[0] as { name: string } | undefined)?.name;
    return name ? await clientProfileContext(name) : "";
  } catch {
    return "";
  }
}

/**
 * What I know about a client, written as a block for the caption, hook, story and copy prompts so the
 * writing sounds like them. It gathers Getting to know you, their client question answers, their weekly
 * homework replies and the details saved on their preset (website, area, audience, pillars, notes).
 * Returns an empty string when there is nothing yet. Never throws.
 */
const ctxCache = new Map<string, { at: number; text: string }>();
const CTX_TTL_MS = 15_000;

export async function clientProfileContext(clientName?: string | null): Promise<string> {
  const n = String(clientName ?? "").trim();
  if (n.length < 2) return "";
  const key = n.toLowerCase();
  const hit = ctxCache.get(key);
  if (hit && Date.now() - hit.at < CTX_TTL_MS) return hit.text;
  const text = await buildClientProfileContext(n);
  ctxCache.set(key, { at: Date.now(), text });
  if (ctxCache.size > 200) ctxCache.delete(ctxCache.keys().next().value as string);
  return text;
}

async function buildClientProfileContext(clientName: string): Promise<string> {
  const n = String(clientName ?? "").trim();
  if (n.length < 2) return "";
  const parts: string[] = [];
  try { await ensureSiteCache(); } catch { /* skip */ }
  const clip = (t: unknown, max = 600) => String(t ?? "").trim().replace(/\s+/g, " ").slice(0, max);

  // Getting to know you
  try {
    await ensureTable();
    const r = await db.execute(sql`
      SELECT client_name, answers_json, photo_url, updated_at FROM client_profiles
      WHERE lower(client_name) = lower(${n}) LIMIT 1
    `);
    const row = (r.rows as Row[])[0];
    if (row) {
      const { answers } = shape(row);
      const lines = Object.keys(LABELS)
        .filter(k => (answers[k] ?? "").trim())
        .map(k => `- ${LABELS[k]}: ${answers[k].trim().replace(/\s+/g, " ")}`);
      if (lines.length) parts.push(`GETTING TO KNOW YOU (their own words):\n${lines.join("\n")}`);
    }
  } catch { /* skip this part */ }

  // Their answers to the client questions
  try {
    const r = await db.execute(sql`
      SELECT q.question AS question, a.answer AS answer
      FROM client_question_answers a JOIN client_questions q ON q.id = a.question_id
      WHERE lower(trim(a.respondent_name)) = lower(${n})
      ORDER BY a.created_at DESC LIMIT 8
    `);
    const lines = (r.rows as { question: string; answer: string }[]).map(x => `- ${clip(x.question, 160)}: ${clip(x.answer)}`);
    if (lines.length) parts.push(`THEIR ANSWERS TO MY CLIENT QUESTIONS:\n${lines.join("\n")}`);
  } catch { /* skip this part */ }

  // Their weekly homework replies
  try {
    const r = await db.execute(sql`
      SELECT s.question1, s.question2, s.question3, s.question4, s.question5, s.question6, s.question7, s.question8, s.question9, s.question10,
             h.answer1, h.answer2, h.answer3, h.answer4, h.answer5, h.answer6, h.answer7, h.answer8, h.answer9, h.answer10
      FROM homework_replies h JOIN homework_question_sets s ON s.id = h.set_id
      WHERE lower(trim(h.client_name)) = lower(${n})
      ORDER BY h.submitted_at DESC LIMIT 2
    `);
    const lines: string[] = [];
    for (const row of r.rows as Record<string, string>[]) {
      for (let i = 1; i <= 10; i++) {
        const a = clip(row[`answer${i}`]);
        if (a) lines.push(`- ${clip(row[`question${i}`], 160)}: ${a}`);
      }
    }
    if (lines.length) parts.push(`THEIR RECENT HOMEWORK REPLIES:\n${lines.slice(0, 14).join("\n")}`);
  } catch { /* skip this part */ }

  // What is saved on their preset
  try {
    const r = await db.execute(sql`
      SELECT website_url, seo_area, target_audience, content_pillars, brand_notes, voice_style, caption_footnote,
             booking_link, newsletter_name, clinic_address FROM client_presets
      WHERE lower(name) = lower(${n}) LIMIT 1
    `);
    const p = (r.rows as Record<string, string | null>[])[0];
    if (p) {
      const lines: string[] = [];
      if (clip(p.website_url)) lines.push(`- Website (background reading only, never mention it or a link in bio in any post): ${clip(p.website_url, 200)}`);
      if (clip(p.seo_area)) lines.push(`- Area: ${clip(p.seo_area, 200)}`);
      if (clip(p.clinic_address)) lines.push(`- Clinic address (background only, never put it in a post): ${clip(p.clinic_address, 200)}`);
      if (clip(p.target_audience)) lines.push(`- Target audience: ${clip(p.target_audience)}`);
      if (clip(p.content_pillars)) lines.push(`- Content pillars: ${clip(p.content_pillars)}`);
      if (clip(p.brand_notes)) lines.push(`- Brand notes: ${clip(p.brand_notes)}`);
      if (clip(p.voice_style)) lines.push(`- Their chosen voice leans: ${clip(p.voice_style, 60).replace(/-/g, " ")} (still written in my one house voice, this only tells you how warm, cheeky or polished to be)`);
      if (clip(p.newsletter_name)) lines.push(`- Newsletter name: ${clip(p.newsletter_name, 120)}`);
      if (clip(p.booking_link)) lines.push(`- Booking link (background only, never put a link or web address in any post): ${clip(p.booking_link, 200)}`);
      if (clip(p.caption_footnote, 400)) lines.push(`- Footnote that is added automatically under every one of their captions (never write it out, never repeat it and never contradict it): ${clip(p.caption_footnote, 400)}`);
      if (lines.length) parts.push(`SAVED ON THEIR PRESET:\n${lines.join("\n")}`);
      // Treatments read from their own website, remembered from the treatment dropdowns.
      const fromFootnote = (p.caption_footnote ?? "").match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:co\.uk|com|uk|org|net|clinic|health|beauty)(?:\/[^\s,;)]*)?/i)?.[0];
      const site = normaliseSite(p.website_url || fromFootnote);
      if (site) {
        try {
          const t = await db.execute(sql`SELECT treatments_json FROM client_site_cache WHERE site = ${site} LIMIT 1`);
          const raw = (t.rows[0] as { treatments_json: string } | undefined)?.treatments_json;
          const list = raw ? (JSON.parse(raw) as unknown) : null;
          if (Array.isArray(list) && list.length) {
            parts.push(`TREATMENTS ON THEIR OWN WEBSITE (only write about these, never invent one, and neutral wording only for anything prescription only):\n- ${list.filter((x): x is string => typeof x === "string").slice(0, 40).join(", ")}`);
          }
        } catch { /* the cache is a nicety */ }
      }
    }
  } catch { /* skip this part */ }

  if (!parts.length) return "";
  return `\n\nWHAT I KNOW ABOUT THIS CLIENT (use it so the writing sounds like them, use their humour and their patients' worries, and respect any off limits list absolutely. Never quote this back word for word and never mention that you have it):\n${parts.join("\n\n")}`;
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
