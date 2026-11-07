import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notifySubmission } from "../lib/notify";
import { matchClient } from "./client-profiles";

// FONT LAB FORM. One link goes to every client: they type their business name and choose the font they like.
// The choice is kept per client so every tool can start on it.
const router: IRouter = Router();

let ready: Promise<unknown> | null = null;
function ensureTable(): Promise<unknown> {
  if (!ready) {
    ready = db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_fonts (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL UNIQUE,
        typed_name TEXT NOT NULL,
        matched BOOLEAN NOT NULL DEFAULT FALSE,
        font_id TEXT NOT NULL,
        upper BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

router.post("/fontlab-form", async (req, res) => {
  try {
    await ensureTable();
    const b = (req.body ?? {}) as { businessName?: unknown; fontId?: unknown; upper?: unknown };
    const typed = String(b.businessName ?? "").trim().slice(0, 120);
    const fontId = String(b.fontId ?? "").trim().slice(0, 60).replace(/[^a-z0-9-]/gi, "");
    if (typed.length < 2) { res.status(400).json({ error: "Please tell me your business name" }); return; }
    if (!fontId) { res.status(400).json({ error: "Choose a font first" }); return; }
    const upper = b.upper === true;
    const matchedName = await matchClient(typed);
    const key = matchedName ?? typed;
    await db.execute(sql`
      INSERT INTO client_fonts (client_name, typed_name, matched, font_id, upper, updated_at)
      VALUES (${key}, ${typed}, ${!!matchedName}, ${fontId}, ${upper}, NOW())
      ON CONFLICT (client_name) DO UPDATE
        SET typed_name = EXCLUDED.typed_name, matched = EXCLUDED.matched, font_id = EXCLUDED.font_id, upper = EXCLUDED.upper, updated_at = NOW()
    `);
    void notifySubmission({
      clientName: key,
      kind: "Font Lab form",
      submitterName: matchedName && matchedName !== typed ? typed : undefined,
      story: `Chose the font ${fontId}${upper ? " in capitals" : ""}.${matchedName ? "" : " I could not match this name to a client, so it needs linking."}`,
    }).catch(() => undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not save" });
  }
});

router.get("/client-fonts", async (_req, res) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT client_name, typed_name, matched, font_id, upper, updated_at FROM client_fonts ORDER BY matched, client_name`);
    res.json({ clients: (r.rows as { client_name: string; typed_name: string; matched: boolean; font_id: string; upper: boolean; updated_at: string }[]).map((x) => ({ clientName: x.client_name, typedName: x.typed_name, matched: x.matched, fontId: x.font_id, upper: x.upper, updatedAt: x.updated_at })) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load" });
  }
});

export default router;
