import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";

const router: IRouter = Router();

// Self-contained: ensure the showcases table exists without a drizzle migration.
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS showcases (
          id serial PRIMARY KEY,
          token text UNIQUE NOT NULL,
          title text,
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

type ShowcaseData = {
  carousels: string[][];
  closingLine?: string;
  clientName?: string;
  ctaUrl?: string;
  musicUrl?: string;
  musicName?: string;
};

router.post("/showcase", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { title, clientName, carousels, ctaUrl, musicUrl, musicName } = req.body as {
      title?: string;
      clientName?: string;
      carousels?: string[][];
      ctaUrl?: string;
      musicUrl?: string;
      musicName?: string;
    };
    if (!Array.isArray(carousels) || carousels.length === 0) {
      res.status(400).json({ error: "At least one carousel is required." });
      return;
    }
    const clean = carousels
      .slice(0, 6)
      .map((c) => (Array.isArray(c) ? c.filter((u) => typeof u === "string" && u.length > 0).slice(0, 4) : []))
      .filter((c) => c.length > 0);
    if (clean.length === 0) {
      res.status(400).json({ error: "No valid images were provided." });
      return;
    }
    const data: ShowcaseData = {
      carousels: clean,
      closingLine: "This is how your work would look if I was looking after you",
      clientName: (clientName || "").slice(0, 120) || undefined,
      ctaUrl: (() => {
        const u = (ctaUrl || "").trim();
        return /^(https?:\/\/|mailto:)/i.test(u) ? u.slice(0, 400) : undefined;
      })(),
      musicUrl: (() => {
        const u = (musicUrl || "").trim();
        return /^https?:\/\//i.test(u) ? u.slice(0, 600) : undefined;
      })(),
      musicName: (musicName || "").slice(0, 160) || undefined,
    };
    const token = randomBytes(9).toString("hex");
    await db.execute(sql`
      INSERT INTO showcases (token, title, data)
      VALUES (${token}, ${(title || "").slice(0, 160) || null}, ${JSON.stringify(data)}::jsonb)
    `);
    res.json({ ok: true, token });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to create showcase" });
  }
});

router.get("/showcase/:token", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const result = await db.execute(sql`
      SELECT title, data FROM showcases WHERE token = ${req.params.token} LIMIT 1
    `);
    const row = (result as { rows?: { title: string | null; data: ShowcaseData }[] }).rows?.[0];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ title: row.title, ...row.data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load showcase" });
  }
});

export default router;
