import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { notifySubmission } from "../lib/notify";
import { ensureTable as ensureProfiles } from "./client-profiles";
import { ensureTable as ensureTreatments } from "./client-treatments";
import { ensureTable as ensureFonts } from "./client-fonts";

// THE WELCOME PAGE. One personal link per client that walks them through Getting to know you, what they offer,
// their font, their photos and (optionally) connecting Instagram. Everything saves onto the same tables the
// separate forms use, so every tool reads it exactly as before. The client's link token is the only key.
const router: IRouter = Router();

type ProfileRow = { client_name: string; answers_json: string; photo_url: string | null };

async function profileByToken(token: string): Promise<ProfileRow | null> {
  await ensureProfiles();
  const r = await db.execute(sql`SELECT client_name, answers_json, photo_url FROM client_profiles WHERE share_token = ${token} LIMIT 1`);
  return (r.rows[0] as ProfileRow | undefined) ?? null;
}

const parseAnswers = (json: string): Record<string, string> => {
  try { const v = JSON.parse(json); return v && typeof v === "object" ? v : {}; } catch { return {}; }
};

const cleanIds = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.map((v) => String(v ?? "").trim().slice(0, 60)).filter(Boolean))].slice(0, 300) : [];

const BIG_KEYS = new Set(["reviewImages", "clinicPhotos"]);

// Gives a client their own link, once. It is the same link the Getting to know you page uses, so nothing already sent breaks.
router.post("/welcome-link/:name", async (req, res) => {
  try {
    await ensureProfiles();
    const name = String(req.params.name || "").trim();
    if (!name) { res.status(400).json({ error: "Client name needed" }); return; }
    await db.execute(sql`INSERT INTO client_profiles (client_name, answers_json) VALUES (${name}, '{}') ON CONFLICT (client_name) DO NOTHING`);
    const t = await db.execute(sql`SELECT share_token FROM client_profiles WHERE lower(client_name) = lower(${name}) LIMIT 1`);
    let token = (t.rows[0] as { share_token: string | null } | undefined)?.share_token ?? null;
    if (!token) {
      token = randomBytes(12).toString("hex");
      await db.execute(sql`UPDATE client_profiles SET share_token = ${token} WHERE lower(client_name) = lower(${name}) AND share_token IS NULL`);
      const again = await db.execute(sql`SELECT share_token FROM client_profiles WHERE lower(client_name) = lower(${name}) LIMIT 1`);
      token = (again.rows[0] as { share_token: string }).share_token;
    }
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not make the link" });
  }
});

// Everything already saved for this client, so they can pick up where they left off.
router.get("/welcome/:token", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    await ensureTreatments();
    await ensureFonts();
    const tr = await db.execute(sql`SELECT treatments_json, other_text FROM client_treatments WHERE lower(client_name) = lower(${p.client_name}) LIMIT 1`);
    const fo = await db.execute(sql`SELECT font_id, upper FROM client_fonts WHERE lower(client_name) = lower(${p.client_name}) LIMIT 1`);
    const trRow = tr.rows[0] as { treatments_json: string; other_text: string } | undefined;
    const foRow = fo.rows[0] as { font_id: string; upper: boolean } | undefined;
    let treatments: string[] = [];
    try { treatments = cleanIds(JSON.parse(trRow?.treatments_json ?? "[]")); } catch { treatments = []; }
    res.json({
      clientName: p.client_name,
      answers: parseAnswers(p.answers_json),
      photoUrl: p.photo_url,
      treatments,
      other: trRow?.other_text ?? "",
      fontId: foRow?.font_id ?? "",
      upper: foRow?.upper ?? false,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not open your page" });
  }
});

router.put("/welcome/:token/answers", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    const body = (req.body ?? {}) as { answers?: Record<string, unknown>; photoUrl?: string | null };
    const merged = parseAnswers(p.answers_json);
    for (const [k, v] of Object.entries(body.answers ?? {})) {
      if (typeof v === "string" && k.length < 60) merged[k] = v.slice(0, BIG_KEYS.has(k) ? 20000 : 4000);
    }
    const photo = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
    await db.execute(sql`
      UPDATE client_profiles SET answers_json = ${JSON.stringify(merged)}, photo_url = COALESCE(${photo}, photo_url), updated_at = NOW()
      WHERE share_token = ${req.params.token}
    `);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

router.put("/welcome/:token/treatments", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    await ensureTreatments();
    const b = (req.body ?? {}) as { treatments?: unknown; other?: unknown };
    const treatments = cleanIds(b.treatments);
    const other = String(b.other ?? "").trim().slice(0, 1500);
    await db.execute(sql`
      INSERT INTO client_treatments (client_name, typed_name, matched, treatments_json, other_text, updated_at)
      VALUES (${p.client_name}, ${p.client_name}, TRUE, ${JSON.stringify(treatments)}, ${other}, NOW())
      ON CONFLICT (client_name) DO UPDATE
        SET treatments_json = EXCLUDED.treatments_json, other_text = EXCLUDED.other_text, matched = TRUE, updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

router.put("/welcome/:token/font", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    await ensureFonts();
    const b = (req.body ?? {}) as { fontId?: unknown; upper?: unknown };
    const fontId = String(b.fontId ?? "").trim().slice(0, 60).replace(/[^a-z0-9-]/gi, "");
    if (!fontId) { res.status(400).json({ error: "Choose a font first" }); return; }
    await db.execute(sql`
      INSERT INTO client_fonts (client_name, typed_name, matched, font_id, upper, updated_at)
      VALUES (${p.client_name}, ${p.client_name}, TRUE, ${fontId}, ${b.upper === true}, NOW())
      ON CONFLICT (client_name) DO UPDATE SET font_id = EXCLUDED.font_id, upper = EXCLUDED.upper, matched = TRUE, updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

// Optional step. If this client has a preset, hand back the Instagram connect token that page already uses.
router.post("/welcome/:token/instagram", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    const r = await db.execute(sql`SELECT id, client_portal_token, onboarding_connected_at FROM client_presets WHERE lower(name) = lower(${p.client_name}) LIMIT 1`);
    const row = r.rows[0] as { id: number; client_portal_token: string | null; onboarding_connected_at: string | null } | undefined;
    if (!row) { res.json({ available: false }); return; }
    let token = row.client_portal_token;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await db.execute(sql`UPDATE client_presets SET client_portal_token = ${token}, updated_at = NOW() WHERE id = ${row.id} AND client_portal_token IS NULL`);
      const again = await db.execute(sql`SELECT client_portal_token FROM client_presets WHERE id = ${row.id}`);
      token = (again.rows[0] as { client_portal_token: string }).client_portal_token;
    }
    res.json({ available: true, connected: !!row.onboarding_connected_at, onboardToken: token });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not check Instagram" });
  }
});

// One email to me when they reach the end, instead of one per step.
router.post("/welcome/:token/finish", async (req, res) => {
  try {
    const p = await profileByToken(req.params.token);
    if (!p) { res.status(404).json({ error: "This link is not valid" }); return; }
    await ensureTreatments();
    await ensureFonts();
    const answers = parseAnswers(p.answers_json);
    const filled = Object.entries(answers).filter(([k, v]) => !BIG_KEYS.has(k) && typeof v === "string" && v.trim()).length;
    const tr = await db.execute(sql`SELECT treatments_json FROM client_treatments WHERE lower(client_name) = lower(${p.client_name}) LIMIT 1`);
    const fo = await db.execute(sql`SELECT font_id FROM client_fonts WHERE lower(client_name) = lower(${p.client_name}) LIMIT 1`);
    let nTreat = 0;
    try { nTreat = cleanIds(JSON.parse((tr.rows[0] as { treatments_json: string } | undefined)?.treatments_json ?? "[]")).length; } catch { nTreat = 0; }
    const font = (fo.rows[0] as { font_id: string } | undefined)?.font_id;
    void notifySubmission({
      clientName: p.client_name,
      kind: "Welcome page finished",
      story: `${filled} answers, ${nTreat} treatments ticked, ${font ? `font ${font}` : "no font chosen"}${p.photo_url ? ", guide photo added" : ""}. Everything is saved on their profile.`,
    }).catch(() => undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not finish" });
  }
});

export default router;
