import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// SALES DASHBOARD. Vanessa's own page at /salesdashboard: up to 5 commission only sales partners, the leads each one
// brings in, where every lead is, and the 25% commission earned and paid. Everything here needs her tools password.

const router: IRouter = Router();

const STAGES = ["Chatting", "Freebies sent", "Followed up", "Call booked", "Signed"];
const SLOTS = [1, 2, 3, 4, 5];

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

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

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sales_partners (
        slot INTEGER PRIMARY KEY,
        name TEXT NOT NULL DEFAULT ''
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sales_leads (
        id           TEXT PRIMARY KEY,
        partner_slot INTEGER NOT NULL,
        lead         TEXT NOT NULL,
        clinic       TEXT NOT NULL,
        handle       TEXT NOT NULL DEFAULT '',
        package      INTEGER NOT NULL,
        price        NUMERIC NOT NULL,
        stage        TEXT NOT NULL,
        is_test      BOOLEAN NOT NULL DEFAULT FALSE,
        paid         BOOLEAN NOT NULL DEFAULT FALSE,
        paid_at      TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // First time only: five open slots, Kelly in the first as the test partner, with a few test leads.
    const existing = await db.execute(sql`SELECT COUNT(*)::int AS n FROM sales_partners`);
    const n = Number((existing.rows[0] as { n: number }).n);
    if (n === 0) {
      for (const slot of SLOTS) {
        await db.execute(sql`INSERT INTO sales_partners (slot, name) VALUES (${slot}, ${slot === 1 ? "Kelly" : ""}) ON CONFLICT (slot) DO NOTHING`);
      }
      const tests: Array<[string, string, string, number, number, string, string]> = [
        ["Test Lead One", "Test Glow Clinic", "@testglow", 12, 450, "Signed", "2026-11-10T10:00:00Z"],
        ["Test Lead Two", "Test Radiance Aesthetics", "@testradiance", 6, 350, "Signed", "2026-11-11T11:00:00Z"],
        ["Test Lead Three", "Test Bloom Skin", "@testbloom", 6, 500, "Call booked", "2026-11-11T14:30:00Z"],
        ["Test Lead Four", "Test Nurse Nic", "@testnurse", 12, 500, "Freebies sent", "2026-11-12T09:15:00Z"],
        ["Test Lead Five", "Test Pout Place", "@testpout", 6, 300, "Chatting", "2026-11-12T12:00:00Z"],
      ];
      for (const [lead, clinic, handle, pkg, price, stage, at] of tests) {
        const id = "t" + randomBytes(6).toString("hex");
        await db.execute(sql`
          INSERT INTO sales_leads (id, partner_slot, lead, clinic, handle, package, price, stage, is_test, created_at)
          VALUES (${id}, 1, ${lead}, ${clinic}, ${handle}, ${pkg}, ${price}, ${stage}, TRUE, ${at}::timestamptz)
        `);
      }
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

type LeadRow = {
  id: string; partner_slot: number; lead: string; clinic: string; handle: string; package: number;
  price: string | number; stage: string; is_test: boolean; paid: boolean; paid_at: Date | null; created_at: Date;
};
const shape = (r: LeadRow) => ({
  id: r.id, partner: r.partner_slot, lead: r.lead, clinic: r.clinic, handle: r.handle, package: Number(r.package),
  price: Number(r.price), stage: r.stage, test: r.is_test, paid: r.paid, paidAt: r.paid_at, created: r.created_at,
});
const normHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, "");

router.get("/sales/admin/data", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const p = await db.execute(sql`SELECT slot, name FROM sales_partners ORDER BY slot`);
    const l = await db.execute(sql`SELECT * FROM sales_leads ORDER BY created_at DESC`);
    res.json({ partners: p.rows, leads: (l.rows as LeadRow[]).map(shape) });
  } catch (e) {
    res.status(500).json({ error: "Could not load the dashboard" });
  }
});

router.put("/sales/admin/partners/:slot", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const slot = Number(req.params.slot);
    if (!SLOTS.includes(slot)) { res.status(400).json({ error: "Unknown slot" }); return; }
    const name = str(req.body?.name, 60);
    await db.execute(sql`INSERT INTO sales_partners (slot, name) VALUES (${slot}, ${name}) ON CONFLICT (slot) DO UPDATE SET name = EXCLUDED.name`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.post("/sales/admin/leads", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const slot = Number(req.body?.partner);
    const lead = str(req.body?.lead, 120);
    const clinic = str(req.body?.clinic, 120);
    const handle = str(req.body?.handle, 80);
    const pkg = Number(req.body?.package);
    const price = Number(req.body?.price);
    const stage = str(req.body?.stage, 40);
    if (!SLOTS.includes(slot) || !lead || !clinic || ![6, 12].includes(pkg) || !(price > 0) || !STAGES.includes(stage)) {
      res.status(400).json({ error: "Please fill in every box" });
      return;
    }
    const all = await db.execute(sql`
      SELECT l.clinic, l.handle, l.created_at, p.name
      FROM sales_leads l LEFT JOIN sales_partners p ON p.slot = l.partner_slot
    `);
    const dupe = (all.rows as Array<{ clinic: string; handle: string; created_at: Date; name: string | null }>).find(
      (r) => r.clinic.trim().toLowerCase() === clinic.toLowerCase() || (handle && r.handle && normHandle(r.handle) === normHandle(handle)),
    );
    if (dupe) {
      res.status(409).json({ error: "duplicate", by: dupe.name || "another partner", at: dupe.created_at });
      return;
    }
    const id = "l" + randomBytes(6).toString("hex");
    await db.execute(sql`
      INSERT INTO sales_leads (id, partner_slot, lead, clinic, handle, package, price, stage)
      VALUES (${id}, ${slot}, ${lead}, ${clinic}, ${handle}, ${pkg}, ${price}, ${stage})
    `);
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.patch("/sales/admin/leads/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = str(req.params.id, 40);
    if (typeof req.body?.stage === "string") {
      const stage = str(req.body.stage, 40);
      if (!STAGES.includes(stage)) { res.status(400).json({ error: "Unknown stage" }); return; }
      await db.execute(sql`UPDATE sales_leads SET stage = ${stage} WHERE id = ${id}`);
    }
    if (typeof req.body?.paid === "boolean") {
      const paid = req.body.paid as boolean;
      await db.execute(sql`UPDATE sales_leads SET paid = ${paid}, paid_at = ${paid ? sql`NOW()` : sql`NULL`} WHERE id = ${id}`);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not save" });
  }
});

router.delete("/sales/admin/leads/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`DELETE FROM sales_leads WHERE id = ${str(req.params.id, 40)}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not delete" });
  }
});

router.delete("/sales/admin/test-leads", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`DELETE FROM sales_leads WHERE is_test = TRUE`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not delete" });
  }
});

export default router;
