import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// SALES DASHBOARD. Vanessa's own page at /salesdashboard: up to 5 commission only sales partners, the leads each one
// brings in, where every lead is, and the 25% commission earned and paid. Everything here needs the dashboard password.

const router: IRouter = Router();

const STAGES = ["Chatting", "Freebies sent", "Followed up", "Call booked", "Signed"];
const SLOTS = [1, 2, 3, 4, 5];

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

// The dashboard has its own password, kept in the SALES_DASHBOARD_PASSWORD variable on Railway (never in the code). Her tools password also works.
const salesPassword = () => (process.env.SALES_DASHBOARD_PASSWORD || "").trim().toLowerCase();

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

router.post("/sales/auth", (req: Request, res: Response) => {
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
    await db.execute(sql`ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS contact TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS via_link BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sales_link_events (
        id BIGSERIAL PRIMARY KEY,
        ref TEXT NOT NULL DEFAULT '',
        visitor TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
    // Deanos gets his own sign up link, so he needs a partner slot. He takes the first open one (only if he is not already there).
    const hasDeanos = await db.execute(sql`SELECT 1 FROM sales_partners WHERE lower(name) LIKE 'deanos%' LIMIT 1`);
    if (hasDeanos.rows.length === 0) {
      await db.execute(sql`UPDATE sales_partners SET name = 'Deanos' WHERE slot = (SELECT slot FROM sales_partners WHERE name = '' ORDER BY slot LIMIT 1)`);
    }
    // Isabella, Leah and Rachel join the sales team the same way, each taking the next open slot (only if they are not already there).
    for (const member of ["Isabella", "Leah", "Rachel"]) {
      const has = await db.execute(sql`SELECT 1 FROM sales_partners WHERE lower(name) LIKE ${member.toLowerCase() + "%"} LIMIT 1`);
      if (has.rows.length === 0) {
        await db.execute(sql`UPDATE sales_partners SET name = ${member} WHERE slot = (SELECT slot FROM sales_partners WHERE name = '' ORDER BY slot LIMIT 1)`);
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
  contact?: string; via_link?: boolean;
};
const shape = (r: LeadRow) => ({
  id: r.id, partner: r.partner_slot, lead: r.lead, clinic: r.clinic, handle: r.handle, package: Number(r.package),
  price: Number(r.price), stage: r.stage, test: r.is_test, paid: r.paid, paidAt: r.paid_at, created: r.created_at,
  contact: r.contact || "", viaLink: !!r.via_link,
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
    if (req.body?.price !== undefined) {
      const price = Number(req.body.price);
      if (!(price > 0) || price > 5000) { res.status(400).json({ error: "Unknown price" }); return; }
      await db.execute(sql`UPDATE sales_leads SET price = ${price} WHERE id = ${id}`);
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

// SIGN UP LINKS. Each partner has a personal link, www.thecybersuite.com/signup?ref=kelly (the ref is the partner's name, lower case).
// Same idea as the freebies links, but this counts people signing up as a client. The page reports an "open" when the link is opened and
// a "start" when the visitor first types into the form; sending the form logs a Call booked lead for that partner. Vanessa moves it to Signed once confirmed, which is when the 25% is earned.
const cleanRef = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
const cleanVisitor = (v: unknown) => String(v ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
const partnerRef = (name: string) => cleanRef(name.trim().split(/\s+/)[0] || "");

router.post("/sales/hit", async (req: Request, res: Response) => {
  try {
    const kind = req.body?.kind === "start" ? "start" : "open";
    const ref = cleanRef(req.body?.ref);
    const visitor = cleanVisitor(req.body?.visitor);
    if (!visitor) { res.json({ ok: true }); return; }
    await ensureTables();
    const seen = await db.execute(sql`SELECT 1 FROM sales_link_events WHERE ref = ${ref} AND visitor = ${visitor} AND kind = ${kind} LIMIT 1`);
    if (seen.rows.length === 0) await db.execute(sql`INSERT INTO sales_link_events (ref, visitor, kind) VALUES (${ref}, ${visitor}, ${kind})`);
  } catch (err) {
    req.log?.warn({ err }, "sales hit failed");
  }
  res.json({ ok: true });
});

router.post("/sales/signup", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = cleanRef(req.body?.ref);
    const name = str(req.body?.name, 120);
    const clinic = str(req.body?.clinic, 120);
    const handle = str(req.body?.handle, 80);
    const contact = str(req.body?.contact, 160);
    const pkg = Number(req.body?.package);
    if (!name || !clinic || !contact || ![6, 12].includes(pkg)) {
      res.status(400).json({ error: "Please fill in every box so Vanessa can get in touch." });
      return;
    }
    const partners = await db.execute(sql`SELECT slot, name FROM sales_partners WHERE name <> ''`);
    const match = (partners.rows as Array<{ slot: number; name: string }>).find((p) => ref && partnerRef(p.name) === ref);
    if (!match) {
      res.status(400).json({ error: "This link is missing its name. Please ask the person who sent it for their own link." });
      return;
    }
    const all = await db.execute(sql`SELECT id, clinic, handle, stage FROM sales_leads`);
    const dupe = (all.rows as Array<{ id: string; clinic: string; handle: string; stage: string }>).find(
      (r) => r.clinic.trim().toLowerCase() === clinic.toLowerCase() || (handle && r.handle && normHandle(r.handle) === normHandle(handle)),
    );
    if (dupe) {
      // Already logged (by this partner or another): keep who found them first, just move them on to Call booked (unless already further along).
      if (dupe.stage !== "Signed") await db.execute(sql`UPDATE sales_leads SET stage = 'Call booked', package = ${pkg}, contact = ${contact}, via_link = TRUE WHERE id = ${dupe.id}`);
    } else {
      const id = "l" + randomBytes(6).toString("hex");
      await db.execute(sql`
        INSERT INTO sales_leads (id, partner_slot, lead, clinic, handle, package, price, stage, contact, via_link)
        VALUES (${id}, ${match.slot}, ${name}, ${clinic}, ${handle}, ${pkg}, 500, 'Call booked', ${contact}, TRUE)
      `);
    }
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "sales signup failed");
    res.status(500).json({ error: "Something went wrong. Please try again in a minute." });
  }
});

router.get("/sales/admin/signup-links", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const ev = await db.execute(sql`
      SELECT ref,
        COUNT(*) FILTER (WHERE kind = 'open')::int AS opens,
        COUNT(*) FILTER (WHERE kind = 'start')::int AS started,
        MAX(created_at) FILTER (WHERE kind = 'open') AS last_open
      FROM sales_link_events GROUP BY ref`);
    const su = await db.execute(sql`
      SELECT partner_slot, COUNT(*)::int AS signups, MAX(created_at) AS last_signup
      FROM sales_leads WHERE via_link = TRUE GROUP BY partner_slot`);
    res.json({ events: ev.rows, signups: su.rows });
  } catch {
    res.status(500).json({ error: "Could not load the links" });
  }
});

export default router;
