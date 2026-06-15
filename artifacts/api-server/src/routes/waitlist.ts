import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Create the waitlist table on first use if it doesn't exist
async function ensureWaitlistTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          SERIAL PRIMARY KEY,
      clinic      TEXT NOT NULL,
      email       TEXT NOT NULL,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

let tableReady = false;

router.post("/waitlist", async (req: Request, res: Response) => {
  try {
    const { clinic, email, note } = req.body as { clinic?: string; email?: string; note?: string };

    if (!clinic?.trim() || !email?.trim()) {
      res.status(400).json({ error: "clinic and email are required" });
      return;
    }

    if (!tableReady) {
      await ensureWaitlistTable();
      tableReady = true;
    }

    await db.execute(sql`
      INSERT INTO waitlist (clinic, email, note)
      VALUES (${clinic.trim()}, ${email.trim()}, ${note?.trim() ?? null})
    `);

    req.log.info({ clinic: clinic.trim(), email: email.trim() }, "Waitlist signup");
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save";
    req.log.error({ err }, "waitlist insert failed");
    res.status(500).json({ error: msg });
  }
});

router.get("/waitlist", async (req: Request, res: Response) => {
  try {
    if (!tableReady) {
      await ensureWaitlistTable();
      tableReady = true;
    }
    const rows = await db.execute(sql`SELECT * FROM waitlist ORDER BY created_at DESC`);
    res.json({ entries: rows.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch";
    req.log.error({ err }, "waitlist fetch failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
