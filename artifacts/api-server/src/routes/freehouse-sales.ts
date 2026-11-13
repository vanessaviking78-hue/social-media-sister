import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// FREEHOUSE SALES DASHBOARD. Vanessa's own page at /freehousesales: up to 4 commission only sales partners selling Freehouse, the leads each one
// brings in, where every lead is, and the 20% commission earned and paid. Everything here needs the dashboard password.

const router: IRouter = Router();

const STAGES = ["Chatting", "Trial sent", "Followed up", "Call booked", "Signed"];
const SLOTS = [1, 2, 3, 4];

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

// The dashboard has its own password, kept in the FREEHOUSE_SALES_PASSWORD variable on Railway (never in the code). Her tools password also works.
const salesPassword = () => (process.env.FREEHOUSE_SALES_PASSWORD || "").trim().toLowerCase();

function passwordOk(req: Request): boolean {
  const mine = (req.headers["x-sales-password"] as string | undefined)?.trim().toLowerCase();
  if (mine && salesPassword() && mine === salesPassword()) return true;
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided && provided === expected) return true;
  const authHeader = req.headers.authorization;
  return !!(authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (passwordOk(req)) return next();
  res.status(401).json({ error: "Unauthorized" });
}

router.post("/freehousesales/auth", (req: Request, res: Response) => {
  const submitted = String(req.body?.password ?? "").trim().toLowerCase();
  const appPassword = (process.env.APP_PASSWORD || "").trim().toLowerCase();
  if (submitted && ((salesPassword() && submitted === salesPassword()) || (appPassword && submitted === appPassword))) {
    res.json({ valid: true });
    return;
  }
  res.status(401).json({ valid: false, error: "Incorrect password" });
});

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS smashed_partners (
        slot INTEGER PRIMARY KEY,
        name TEXT NOT NULL DEFAULT ''
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS smashed_leads (
        id           TEXT PRIMARY KEY,
        partner_slot INTEGER NOT NULL,
        lead         TEXT NOT NULL,
        business     TEXT NOT NULL,
        handle       TEXT NOT NULL DEFAULT '',
        months       INTEGER NOT NULL,
        price        NUMERIC NOT NULL,
        stage        TEXT NOT NULL,
        paid         BOOLEAN NOT NULL DEFAULT FALSE,
        paid_at      TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // First time only: four open slots.
    for (const slot of SLOTS) {
      await db.execute(sql`INSERT INTO smashed_partners (slot, name) VALUES (${slot}, '') ON CONFLICT (slot) DO NOTHING`);
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

type LeadRow = {
  id: string; partner_slot: number; lead: string; business: string; handle: string; months: number;
  price: string | number; stage: string; paid: boolean; paid_at: Date | null; created_at: Date;
};
const shape = (r: LeadRow) => ({
  id: r.id, partner: r.partner_slot, lead: r.lead, business: r.business, handle: r.handle, months: Number(r.months),
  price: Number(r.price), stage: r.stage, paid: r.paid, paidAt: r.paid_at, created: r.created_at,
});
const normHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, "");

router.get("/freehousesales/admin/data", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await db.execute(sql`SELECT slot, name FROM smashed_partners ORDER BY slot`);
    const l = await db.execute(sql`SELECT * FROM smashed_leads ORDER BY created_at DESC`);
    res.json({ partners: p.rows, leads: (l.rows as LeadRow[]).map(shape) });
  } catch (e) {
    res.status(500).json({ error: "Could not load the dashboard" });
  }
});

router.put("/freehousesales/admin/partners/:slot", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const slot = Number(req.params.slot);
    if (!SLOTS.includes(slot)) { res.status(400).json({ error: "Unknown slot" }); return; }
    const name = str(req.body?.name, 60);
    await db.execute(sql`INSERT INTO smashed_partners (slot, name) VALUES (${slot}, ${name}) ON CONFLICT (slot) DO UPDATE SET name = EXCLUDED.name`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.post("/freehousesales/admin/leads", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const slot = Number(req.body?.partner);
    const lead = str(req.body?.lead, 120);
    const business = str(req.body?.business, 120);
    const handle = str(req.body?.handle, 80);
    const months = Number(req.body?.months);
    const price = Number(req.body?.price);
    const stage = str(req.body?.stage, 40);
    if (!SLOTS.includes(slot) || !lead || !business || !Number.isInteger(months) || months < 1 || months > 12 || !(price > 0) || !STAGES.includes(stage)) {
      res.status(400).json({ error: "Please fill in every box" });
      return;
    }
    const all = await db.execute(sql`
      SELECT l.business, l.handle, l.created_at, p.name
      FROM smashed_leads l LEFT JOIN smashed_partners p ON p.slot = l.partner_slot
    `);
    const dupe = (all.rows as Array<{ business: string; handle: string; created_at: Date; name: string | null }>).find(
      (r) => r.business.trim().toLowerCase() === business.toLowerCase() || (handle && r.handle && normHandle(r.handle) === normHandle(handle)),
    );
    if (dupe) {
      res.status(409).json({ error: "duplicate", by: dupe.name || "another partner", at: dupe.created_at });
      return;
    }
    const id = "l" + randomBytes(6).toString("hex");
    await db.execute(sql`
      INSERT INTO smashed_leads (id, partner_slot, lead, business, handle, months, price, stage)
      VALUES (${id}, ${slot}, ${lead}, ${business}, ${handle}, ${months}, ${price}, ${stage})
    `);
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.patch("/freehousesales/admin/leads/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = str(req.params.id, 40);
    if (typeof req.body?.stage === "string") {
      const stage = str(req.body.stage, 40);
      if (!STAGES.includes(stage)) { res.status(400).json({ error: "Unknown stage" }); return; }
      await db.execute(sql`UPDATE smashed_leads SET stage = ${stage} WHERE id = ${id}`);
    }
    if (typeof req.body?.paid === "boolean") {
      const paid = req.body.paid as boolean;
      await db.execute(sql`UPDATE smashed_leads SET paid = ${paid}, paid_at = ${paid ? sql`NOW()` : sql`NULL`} WHERE id = ${id}`);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.delete("/freehousesales/admin/leads/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`DELETE FROM smashed_leads WHERE id = ${str(req.params.id, 40)}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not delete" });
  }
});

export default router;
