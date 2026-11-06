import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notifySubmission } from "../lib/notify";
import { matchClient } from "./client-profiles";

// WHAT EACH CLIENT OFFERS. One link goes to every client, they type their business name and tick their treatments.
// The ticks are kept per client so every tool can read them and offer only what that client actually does.
const router: IRouter = Router();

let ready: Promise<unknown> | null = null;
function ensureTable(): Promise<unknown> {
  if (!ready) {
    ready = db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_treatments (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL UNIQUE,
        typed_name TEXT NOT NULL,
        matched BOOLEAN NOT NULL DEFAULT FALSE,
        treatments_json TEXT NOT NULL DEFAULT '[]',
        other_text TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const cleanIds = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.map((v) => String(v ?? "").trim().slice(0, 60)).filter(Boolean))].slice(0, 300) : [];

type Row = { id: number; client_name: string; typed_name: string; matched: boolean; treatments_json: string; other_text: string; updated_at: string };
const shape = (r: Row) => {
  let treatments: string[] = [];
  try { treatments = cleanIds(JSON.parse(r.treatments_json)); } catch { treatments = []; }
  return { id: r.id, clientName: r.client_name, typedName: r.typed_name, matched: r.matched, treatments, other: r.other_text, updatedAt: r.updated_at };
};

// The public form. No sign in, just a business name and ticks.
router.post("/treatments-form", async (req, res) => {
  try {
    await ensureTable();
    const b = (req.body ?? {}) as { businessName?: unknown; treatments?: unknown; other?: unknown };
    const typed = String(b.businessName ?? "").trim().slice(0, 120);
    if (typed.length < 2) { res.status(400).json({ error: "Please tell me your business name" }); return; }
    const treatments = cleanIds(b.treatments);
    if (!treatments.length) { res.status(400).json({ error: "Tick at least one treatment" }); return; }
    const other = String(b.other ?? "").trim().slice(0, 1500);
    const matchedName = await matchClient(typed);
    const key = matchedName ?? typed;
    await db.execute(sql`
      INSERT INTO client_treatments (client_name, typed_name, matched, treatments_json, other_text, updated_at)
      VALUES (${key}, ${typed}, ${!!matchedName}, ${JSON.stringify(treatments)}, ${other}, NOW())
      ON CONFLICT (client_name) DO UPDATE
        SET typed_name = EXCLUDED.typed_name, matched = EXCLUDED.matched, treatments_json = EXCLUDED.treatments_json,
            other_text = EXCLUDED.other_text, updated_at = NOW()
    `);
    void notifySubmission({
      clientName: key,
      kind: "Treatments form",
      submitterName: matchedName && matchedName !== typed ? typed : undefined,
      story: `${treatments.length} treatments ticked${other ? ", plus a note of others" : ""}.${matchedName ? "" : " I could not match this name to a client, so it needs linking."}`,
    }).catch(() => undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

router.get("/client-treatments", async (_req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT id, client_name, typed_name, matched, treatments_json, other_text, updated_at FROM client_treatments ORDER BY matched, client_name`);
    res.json({ clients: (r.rows as Row[]).map(shape) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load" });
  }
});

// One client by name, for the tools. Matches the preset name ignoring case.
router.get("/client-treatments/by-client", async (req, res) => {
  try {
    await ensureTable();
    const name = String(req.query.name ?? "").trim();
    if (!name) { res.json({ client: null }); return; }
    const r = await db.execute(sql`SELECT id, client_name, typed_name, matched, treatments_json, other_text, updated_at FROM client_treatments WHERE lower(client_name) = lower(${name}) LIMIT 1`);
    const row = r.rows[0] as Row | undefined;
    res.json({ client: row ? shape(row) : null });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load" });
  }
});

// Link a name I could not match (someone typed a trading name) to the right client.
router.post("/client-treatments/:id/link", async (req, res) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const name = String((req.body ?? {}).clientName ?? "").trim();
    if (!id || !name) { res.status(400).json({ error: "Choose which client this is" }); return; }
    const src = await db.execute(sql`SELECT id, client_name, typed_name, matched, treatments_json, other_text, updated_at FROM client_treatments WHERE id = ${id} LIMIT 1`);
    const row = src.rows[0] as Row | undefined;
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await db.execute(sql`DELETE FROM client_treatments WHERE lower(client_name) = lower(${name}) AND id <> ${id}`);
    await db.execute(sql`UPDATE client_treatments SET client_name = ${name}, matched = TRUE, updated_at = NOW() WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not link" });
  }
});

export default router;
