import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { saveObject, runOrder } from "../lib/photoshootWorker";
import { appLink } from "../lib/freeSampleWorker";
import { notifyOwner } from "../lib/notify";

// AI PHOTO STUDIO at /photoshoot. Pay on Stripe (GROUP code gives the group price), come back with the Stripe session id, we check
// it with Stripe, take 3 photos and a few details, then make 20 images. Vanessa reviews them on /photoshoot-admin before the
// private delivery link /photos/<token> goes to the client.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 4 } });
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MIN_PENCE = 3000;
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ") && h.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS photoshoot_orders (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      clinic_name TEXT NOT NULL,
      scrub_colour TEXT NOT NULL DEFAULT '',
      photo_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      interior_key TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      amount INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    )`)
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

type Checked = { ok: true; email: string; amount: number } | { ok: false; code: number; error: string };

async function checkStripe(sessionId: string, minPence = MIN_PENCE, linkEnv = "PHOTOSHOOT_PAYMENT_LINK_ID", what = "AI Photo Studio"): Promise<Checked> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, code: 503, error: "Payment checking is not switched on yet. Please email me and I will sort you out." };
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return { ok: false, code: 400, error: "That payment reference does not look right." };
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { ok: false, code: 400, error: "I could not find that payment. If you have just paid, wait a minute and try again." };
    const s = (await r.json()) as { payment_status?: string; amount_total?: number; currency?: string; payment_link?: string | null; customer_details?: { email?: string } };
    if (s.payment_status !== "paid") return { ok: false, code: 402, error: "That payment has not gone through yet." };
    if ((s.currency || "gbp") !== "gbp" || (s.amount_total ?? 0) < minPence) return { ok: false, code: 400, error: `That payment is not for the ${what}.` };
    const link = process.env[linkEnv];
    if (link && !link.split(",").map((x) => x.trim()).includes(String(s.payment_link))) return { ok: false, code: 400, error: `That payment is not for the ${what}.` };
    return { ok: true, email: s.customer_details?.email || "", amount: s.amount_total ?? 0 };
  } catch {
    return { ok: false, code: 502, error: "I could not reach the payment system just now. Please try again in a minute." };
  }
}

router.get("/over50/verify/:sid", async (req: Request, res: Response) => {
  const c = await checkStripe(str(req.params.sid, 120), 1500, "OVER50_PAYMENT_LINK_ID", "Women Over 50 bundle");
  if (!c.ok) {
    res.status(c.code).json({ error: c.error });
    return;
  }
  res.json({ ok: true });
});

router.get("/photoshoot/session/:sid", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const sid = str(req.params.sid, 120);
    const used = (await db.execute(sql`SELECT token, status FROM photoshoot_orders WHERE session_id = ${sid}`)).rows[0] as { token?: string; status?: string } | undefined;
    if (used) {
      res.json({ ok: true, used: true, token: used.token, status: used.status });
      return;
    }
    const c = await checkStripe(sid);
    if (!c.ok) {
      res.status(c.code).json({ error: c.error });
      return;
    }
    res.json({ ok: true, used: false, email: c.email });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

router.post("/photoshoot/start", upload.fields([{ name: "photos", maxCount: 3 }, { name: "interior", maxCount: 1 }]), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const b = req.body as Record<string, string>;
    const sid = str(b.sessionId, 120);
    const files = (req.files ?? {}) as { [f: string]: Express.Multer.File[] };
    const photos = files.photos ?? [];
    const interior = files.interior?.[0];
    const clinicName = str(b.clinicName, 120);
    const scrub = str(b.scrubColour, 30).toLowerCase().replace(/[^a-z \-]/g, "");
    const email = str(b.email, 160);
    if (!clinicName || !scrub) {
      res.status(400).json({ error: "Please add your clinic name and your scrub colour" });
      return;
    }
    if (photos.length !== 3) {
      res.status(400).json({ error: "Please add 3 photos of you, no filter, face on, head and shoulders" });
      return;
    }
    for (const f of [...photos, ...(interior ? [interior] : [])]) {
      if (!IMAGE_MIMES.includes(f.mimetype)) {
        res.status(400).json({ error: "Please upload JPG, PNG or WebP images" });
        return;
      }
    }
    if (b.consent !== "yes") {
      res.status(400).json({ error: "Please tick the box to confirm the photos are of you and you are happy for AI images to be made" });
      return;
    }
    let amount = 0;
    let payEmail = "";
    const tester = sid === "test" && !!process.env.APP_PASSWORD && String(req.headers["x-app-password"] ?? "").trim().toLowerCase() === process.env.APP_PASSWORD.trim().toLowerCase();
    const sessionId = tester ? `test_${uuid()}` : sid;
    if (!tester) {
      const dup = (await db.execute(sql`SELECT 1 FROM photoshoot_orders WHERE session_id = ${sid}`)).rows.length;
      if (dup) {
        res.status(409).json({ error: "This payment has already been used. Check your email for your link, or message me." });
        return;
      }
      const c = await checkStripe(sid);
      if (!c.ok) {
        res.status(c.code).json({ error: c.error });
        return;
      }
      amount = c.amount;
      payEmail = c.email;
    }
    const id = uuid();
    const token = randomBytes(12).toString("hex");
    const photoKeys: string[] = [];
    for (let i = 0; i < photos.length; i++) photoKeys.push(await saveObject(photos[i].buffer, photos[i].mimetype, `face-${i + 1}`));
    const interiorKey = interior ? await saveObject(interior.buffer, interior.mimetype, "interior") : "";
    await db.execute(sql`INSERT INTO photoshoot_orders (id, session_id, token, email, clinic_name, scrub_colour, photo_keys, interior_key, amount)
      VALUES (${id}, ${sessionId}, ${token}, ${email || payEmail}, ${clinicName}, ${scrub}, ${JSON.stringify(photoKeys)}::jsonb, ${interiorKey}, ${amount})`);
    void notifyOwner(`AI Photo Studio order: ${clinicName}`, `${clinicName} has paid and sent their photos. The 20 images are being made now.\nScrubs: ${scrub}\nInterior photo: ${interior ? "yes" : "no"}\nReview them here: ${appLink("/photoshoot-admin")}`);
    void runOrder(id);
    res.json({ ok: true, token });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// Public: the client's page. Shows progress until Vanessa has approved, then the 20 images.
router.get("/photoshoot/order/:token", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const row = (await db.execute(sql`SELECT clinic_name, status, images, sent_at FROM photoshoot_orders WHERE token = ${str(req.params.token, 60)}`)).rows[0] as
      | { clinic_name: string; status: string; images: unknown[]; sent_at: string | null }
      | undefined;
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const sent = row.status === "sent";
    res.json({ clinicName: row.clinic_name, ready: sent, images: sent ? row.images : [] });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/photoshoot/orders", requireAuth, async (_req: Request, res: Response) => {
  await ensureTable();
  const rows = (await db.execute(sql`SELECT id, token, email, clinic_name, scrub_colour, status, note, amount, jsonb_array_length(images) AS done, created_at FROM photoshoot_orders ORDER BY created_at DESC LIMIT 100`)).rows;
  res.json({ orders: rows });
});

router.get("/photoshoot/orders/:id", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const row = (await db.execute(sql`SELECT * FROM photoshoot_orders WHERE id = ${str(req.params.id, 60)}`)).rows[0];
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ order: row, link: appLink(`/photos/${(row as { token: string }).token}`) });
});

router.post("/photoshoot/orders/:id/make", requireAuth, async (req: Request, res: Response) => {
  const only = Array.isArray(req.body?.only) ? (req.body.only as unknown[]).map(Number).filter((n) => n >= 1 && n <= 20) : undefined;
  void runOrder(str(req.params.id, 60), only && only.length ? only : undefined);
  res.json({ ok: true });
});

router.post("/photoshoot/orders/:id/approve", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const id = str(req.params.id, 60);
  await db.execute(sql`UPDATE photoshoot_orders SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = ${id}`);
  const row = (await db.execute(sql`SELECT token, email, clinic_name FROM photoshoot_orders WHERE id = ${id}`)).rows[0] as { token: string; email: string; clinic_name: string } | undefined;
  res.json({ ok: true, link: row ? appLink(`/photos/${row.token}`) : "", email: row?.email ?? "" });
});

router.delete("/photoshoot/orders/:id/images/:n", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const n = Number(req.params.n);
  await db.execute(sql`UPDATE photoshoot_orders SET images = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(images) e WHERE (e->>'n')::int <> ${n}), '[]'::jsonb), updated_at = now() WHERE id = ${str(req.params.id, 60)}`);
  res.json({ ok: true });
});

export default router;
