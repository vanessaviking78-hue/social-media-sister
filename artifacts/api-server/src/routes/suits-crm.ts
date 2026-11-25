import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SUITS_CRM_HTML } from "../data/suits-crm-html";

const router: IRouter = Router();

// /suitscrm: the Suits in Social Media CRM for tracking new followers (solicitors).
// It has its own password so Vanessa, Isabella and Rachel can use it without the main tools login. Set SUITS_CRM_PASSWORD to change it.
// The list is shared: every record lives in the database, so everyone sees the same followers, pipeline, firms and wins.

const KINDS = ["followers", "pipeline", "clients", "wins"];

function allowed(req: Request): boolean {
  const suitsPassword = (process.env.SUITS_CRM_PASSWORD || "legal").trim().toLowerCase();
  const submitted = String(req.header("x-suits-password") ?? "").trim().toLowerCase();
  const toolsPassword = process.env.APP_PASSWORD?.trim().toLowerCase();
  const toolsSubmitted = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  return submitted === suitsPassword || (!!toolsPassword && toolsSubmitted === toolsPassword);
}

let ready: Promise<unknown> | null = null;
function ensureTable() {
  if (!ready) {
    ready = db
      .execute(sql`CREATE TABLE IF NOT EXISTS suits_crm_records (
        seq BIGSERIAL,
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, id)
      )`)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

router.get("/suits-crm", (req: Request, res: Response) => {
  if (!allowed(req)) {
    return res.status(401).json({ error: "That password is not right." });
  }
  res.setHeader("Cache-Control", "no-store");
  // The page needs the password to talk to the shared list. It is only sent after the password has been checked.
  const pw = JSON.stringify(String(req.header("x-suits-password") ?? "")).replace(/</g, "\\u003c");
  const inject = `<script>window.SUITS_PW=${pw};</script>`;
  const at = SUITS_CRM_HTML.indexOf("<script>");
  const page = at === -1 ? SUITS_CRM_HTML : SUITS_CRM_HTML.slice(0, at) + inject + SUITS_CRM_HTML.slice(at);
  res.type("html").send(page);
});

router.get("/suits-crm/data", async (req: Request, res: Response) => {
  if (!allowed(req)) return res.status(401).json({ error: "That password is not right." });
  try {
    await ensureTable();
    const rows = (await db.execute(sql`SELECT kind, id, data FROM suits_crm_records ORDER BY seq`)) as unknown as {
      rows?: { kind: string; id: string; data: Record<string, unknown> }[];
    };
    const list = Array.isArray(rows) ? (rows as unknown as { kind: string; id: string; data: Record<string, unknown> }[]) : rows.rows ?? [];
    const out: Record<string, unknown[]> = { followers: [], pipeline: [], clients: [], wins: [] };
    for (const r of list) {
      if (out[r.kind]) out[r.kind].push({ ...r.data, id: r.id });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(out);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/suits-crm/sync", async (req: Request, res: Response) => {
  if (!allowed(req)) return res.status(401).json({ error: "That password is not right." });
  try {
    const { kind, upserts, deletes } = req.body as {
      kind?: string;
      upserts?: { id: string; data: Record<string, unknown> }[];
      deletes?: string[];
    };
    if (!kind || !KINDS.includes(kind)) return res.status(400).json({ error: "Unknown list" });
    await ensureTable();
    for (const u of (upserts ?? []).slice(0, 2000)) {
      if (!u || typeof u.id !== "string" || !u.id) continue;
      const data = JSON.stringify(u.data ?? {});
      await db.execute(sql`INSERT INTO suits_crm_records (kind, id, data) VALUES (${kind}, ${u.id}, ${data}::jsonb)
        ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`);
    }
    for (const id of (deletes ?? []).slice(0, 2000)) {
      if (typeof id !== "string") continue;
      await db.execute(sql`DELETE FROM suits_crm_records WHERE kind = ${kind} AND id = ${id}`);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
