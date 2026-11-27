import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// VOUCHER COLLECT LINKS. In her Vouchers tool Vanessa ticks the finished designs and publishes them to a private link, /voucher-collect/<slug>.
// The clinic opens the link and downloads its posts and stories with the captions. The slug is random, so only the person she sends it to can open it.

const router: IRouter = Router();
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const slugOf = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

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
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS voucher_collects (
      slug TEXT PRIMARY KEY,
      clinic_name TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => undefined);
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

type Item = { n: number; kind: string; label: string; images: string[]; caption: string; tags: string };

router.post("/voucher-collect/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const clinic = str(req.body?.clinicName, 120);
    const raw = Array.isArray(req.body?.items) ? (req.body.items as Item[]) : [];
    const items = raw.slice(0, 60).map((p, i) => ({
      n: Number(p.n) || i + 1,
      kind: p.kind === "story" ? "story" : "post",
      label: str(p.label, 100),
      images: (Array.isArray(p.images) ? p.images : []).map((u) => str(u, 600)).filter(Boolean).slice(0, 4),
      caption: str(p.caption, 3000),
      tags: str(p.tags, 400),
    })).filter((p) => p.images.length);
    if (!clinic || !items.length) { res.status(400).json({ error: "A clinic name and at least one finished design are needed" }); return; }
    const slug = `${slugOf(clinic) || "clinic"}-${randomBytes(3).toString("hex")}`;
    await db.execute(sql`INSERT INTO voucher_collects (slug, clinic_name, data) VALUES (${slug}, ${clinic}, ${JSON.stringify({ items })})`);
    res.json({ ok: true, slug });
  } catch {
    res.status(500).json({ error: "Could not publish the link" });
  }
});

router.get("/voucher-collect/:slug", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT clinic_name, data FROM voucher_collects WHERE slug = ${str(req.params.slug, 60)} LIMIT 1`);
    if (!r.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const row = r.rows[0] as unknown as { clinic_name: string; data: string };
    res.setHeader("Cache-Control", "no-store");
    res.json({ clinicName: row.clinic_name, ...JSON.parse(row.data) });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
