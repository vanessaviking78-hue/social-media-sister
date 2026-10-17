import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// The five things a nail client rates. Keep in step with public/nail-reviews/index.html.
const KEYS = ["welcome", "finish", "creativity", "clean", "rebook"];

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nail_reviews (
      id          SERIAL PRIMARY KEY,
      salon       TEXT NOT NULL,
      owner       TEXT,
      name        TEXT NOT NULL,
      handle      TEXT,
      email       TEXT,
      average     DOUBLE PRECISION NOT NULL,
      ratings     JSONB NOT NULL,
      ticks       JSONB,
      heart       TEXT NOT NULL,
      review_text TEXT,
      consent     BOOLEAN NOT NULL DEFAULT TRUE,
      approved    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

function isAuthed(req: Request) {
  const appPassword = process.env.APP_PASSWORD;
  return !!appPassword && req.headers["x-app-password"] === appPassword;
}

// Small in-memory throttle: 6 reviews per IP per hour.
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

// ---- Public: a client leaves a review for her nail tech ----
router.post("/nail-reviews", async (req: Request, res: Response) => {
  try {
    const b = (req.body || {}) as Record<string, any>;

    // Bot trap: the hidden field must be empty.
    if (b.website) {
      res.json({ ok: true });
      return;
    }
    if (tooMany(req.ip || "unknown")) {
      res.status(429).json({ error: "Too many reviews from this device, try again later" });
      return;
    }

    const salon = String(b.salon || "").trim().slice(0, 120);
    const owner = String(b.owner || "").trim().slice(0, 60);
    const name = String(b.name || "").trim().slice(0, 120);
    const handle = String(b.handle || "").trim().slice(0, 80);
    const email = String(b.email || "").trim().slice(0, 200);
    const heart = String(b.heart || "").trim().slice(0, 1500);
    const ratings = (b.ratings || {}) as Record<string, unknown>;
    const ticks = (b.ticks || {}) as Record<string, unknown>;

    const nums = KEYS.map((k) => Number(ratings[k]));
    if (!salon || !name || heart.length < 20 || nums.some((n) => !(n >= 1 && n <= 5))) {
      res.status(400).json({ error: "Missing details" });
      return;
    }
    const average = Math.round((nums.reduce((a, c) => a + c, 0) / nums.length) * 10) / 10;
    const tickList = (k: string): string[] =>
      Array.isArray(ticks[k]) ? (ticks[k] as unknown[]).map((x) => String(x).slice(0, 120)).slice(0, 6) : [];
    const reviewText = String(b.reviewText || "").slice(0, 6000);

    await ensureTable();
    await db.execute(sql`
      INSERT INTO nail_reviews (salon, owner, name, handle, email, average, ratings, ticks, heart, review_text)
      VALUES (${salon}, ${owner || null}, ${name}, ${handle || null}, ${email || null}, ${average},
              ${JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, Number(ratings[k])])))}::jsonb,
              ${JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, tickList(k)])))}::jsonb,
              ${heart}, ${reviewText})
    `);
    req.log.info({ salon, name, average }, "Nail review received");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "nail review save failed");
    res.status(500).json({ error: "That did not save, please try again" });
  }
});

// ---- Hub: every review (password protected), optionally for one salon ----
router.get("/nail-reviews", async (req: Request, res: Response) => {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await ensureTable();
    const salon = String(req.query.salon ?? "").trim();
    const rows = await db.execute(sql`
      SELECT id, salon, owner, name, handle, email, average, ratings, ticks, heart, review_text AS "reviewText",
             consent, approved, created_at AS "createdAt"
      FROM nail_reviews
      WHERE (${salon} = '' OR salon = ${salon})
      ORDER BY created_at DESC
    `);
    res.json({ reviews: rows.rows });
  } catch (err) {
    req.log.error({ err }, "nail reviews fetch failed");
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// ---- Public wall: approved reviews for one salon, no email ----
router.get("/nail-reviews/public", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const salon = String(req.query.salon ?? "").trim();
    if (!salon) {
      res.json({ reviews: [] });
      return;
    }
    const rows = await db.execute(sql`
      SELECT id, salon, owner, name, handle, average, ratings, heart, created_at AS "createdAt"
      FROM nail_reviews
      WHERE approved = TRUE AND consent = TRUE AND salon = ${salon}
      ORDER BY created_at DESC LIMIT 200
    `);
    res.json({ reviews: rows.rows });
  } catch (err) {
    req.log.error({ err }, "public nail reviews fetch failed");
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// ---- Hub: put a review on, or take it off, the public wall ----
router.patch("/nail-reviews/:id/approve", async (req: Request, res: Response) => {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Bad id" });
    return;
  }
  const approved = !!(req.body && (req.body as { approved?: unknown }).approved);
  try {
    await ensureTable();
    await db.execute(sql`UPDATE nail_reviews SET approved = ${approved} WHERE id = ${id}`);
    res.json({ ok: true, approved });
  } catch (err) {
    req.log.error({ err }, "nail review approve failed");
    res.status(500).json({ error: "Failed to update review" });
  }
});

// ---- Hub: delete a review ----
router.delete("/nail-reviews/:id", async (req: Request, res: Response) => {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Bad id" });
    return;
  }
  try {
    await ensureTable();
    await db.execute(sql`DELETE FROM nail_reviews WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "nail review delete failed");
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
