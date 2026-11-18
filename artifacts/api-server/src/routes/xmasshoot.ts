import { renderXmasOg, firstNameFor } from "../lib/xmasOg";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { saveObject } from "../lib/photoshootWorker";
import { runXmasOrder, sweepExpiredXmas, XMAS_SHOT_COUNT } from "../lib/xmasshootWorker";
import { appLink } from "../lib/freeSampleWorker";
import { notifyOwner } from "../lib/notify";

// CYBERSUITE CHRISTMAS SHOOT at /xmasshoot. One selfie in, ten REALISTIC XMAS images out.
// Price: 49 pounds. BOTOX takes it to half price. SISTER is free for the first 5. Payment is by Monzo link, and Monzo cannot tell
// the site who has paid, so the person taps "I have paid", Vanessa sees it in her inbox, checks Monzo and ticks "payment seen".
// Only then does the Create images button work. She presses it, the site makes a link from their name (/vanessaxmas) and the
// ten images. The link lasts 30 days and then the selfie and images are deleted.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

const FULL_PENCE = 4900;
const HALF_PENCE = 2450;
const SISTER_SLOTS = 5;
const MONZO_FULL = process.env.XMASSHOOT_MONZO_FULL || "https://monzo.com/pay/r/the-cyber-suite_WRksQgUu0CyIZj";
const MONZO_HALF = process.env.XMASSHOOT_MONZO_HALF || "https://monzo.com/pay/r/the-cyber-suite_gQiXptLmSKB2tC";

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
    .execute(sql`CREATE TABLE IF NOT EXISTS xmasshoot_orders (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      colour TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL DEFAULT '',
      amount_pence INT NOT NULL DEFAULT 0,
      pay_state TEXT NOT NULL DEFAULT 'unpaid',
      selfie_key TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'waiting',
      note TEXT NOT NULL DEFAULT '',
      marketing BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ready_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ
    )`)
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

// Hourly tidy: after 30 days the selfie and images are deleted.
const sweepTimer = setInterval(() => void sweepExpiredXmas(), 60 * 60 * 1000);
sweepTimer.unref?.();
setTimeout(() => void ensureTable().then(sweepExpiredXmas).catch(() => undefined), 90 * 1000).unref?.();

type CodeInfo = { kind: "none" | "half" | "free" | "bad" | "gone"; amountPence: number; slotsLeft?: number };

async function sisterUsed(): Promise<number> {
  const n = (await db.execute(sql`SELECT count(*)::int AS n FROM xmasshoot_orders WHERE upper(code) = 'SISTER'`)).rows[0] as { n: number };
  return n?.n ?? 0;
}

async function readCode(raw: string): Promise<CodeInfo> {
  const code = raw.trim().toUpperCase();
  if (!code) return { kind: "none", amountPence: FULL_PENCE };
  if (code === "BOTOX") return { kind: "half", amountPence: HALF_PENCE };
  if (code === "SISTER") {
    const left = SISTER_SLOTS - (await sisterUsed());
    return left > 0 ? { kind: "free", amountPence: 0, slotsLeft: left } : { kind: "gone", amountPence: FULL_PENCE, slotsLeft: 0 };
  }
  return { kind: "bad", amountPence: FULL_PENCE };
}

const pounds = (p: number) => (p === 0 ? "free" : `£${(p / 100).toFixed(2).replace(/\.00$/, "")}`);

const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 6;
}

async function makeSlug(name: string): Promise<string> {
  const first = name.trim().split(/\s+/)[0] || "";
  const base = first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "").slice(0, 20) || "guest";
  for (let n = 1; n < 500; n++) {
    const slug = n === 1 ? `${base}xmas` : `${base}${n}xmas`;
    const hit = (await db.execute(sql`SELECT 1 FROM xmasshoot_orders WHERE slug = ${slug}`)).rows.length;
    if (!hit) return slug;
  }
  return `${base}${randomBytes(3).toString("hex")}xmas`;
}

router.post("/xmasshoot/check-code", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const info = await readCode(str(req.body?.code, 30));
    res.json({ kind: info.kind, amountPence: info.amountPence, label: pounds(info.amountPence), slotsLeft: info.slotsLeft });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

router.post("/xmasshoot/start", upload.single("selfie"), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    if (tooMany(String(req.ip))) {
      res.status(429).json({ error: "That is a lot of goes in a short time. Please try again in a bit, or message me." });
      return;
    }
    const b = req.body as Record<string, string>;
    const name = str(b.name, 80);
    const email = str(b.email, 160);
    const phone = str(b.phone, 30);
    const colour = str(b.colour, 40).toLowerCase().replace(/[^a-z \-]/g, "").trim();
    const code = str(b.code, 30).toUpperCase();
    const file = req.file;
    if (!name) { res.status(400).json({ error: "Please add your name" }); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Please add your email so I can send your images" }); return; }
    if (phone.replace(/\D/g, "").length < 10) { res.status(400).json({ error: "Please add your WhatsApp number" }); return; }
    if (!file) { res.status(400).json({ error: "Please add your selfie" }); return; }
    if (!IMAGE_MIMES.includes(file.mimetype)) { res.status(400).json({ error: "Please upload a JPG, PNG or WebP photo. If your phone saves photos as HEIC, take a screenshot of your selfie and upload that instead." }); return; }
    if (b.consent !== "yes") { res.status(400).json({ error: "Please tick the box so I know you are happy for me to make the images" }); return; }

    const info = await readCode(code);
    if (info.kind === "bad") { res.status(400).json({ error: "I do not recognise that code. Check the spelling, or clear the box to carry on without one." }); return; }
    if (info.kind === "gone") { res.status(409).json({ error: "All the SISTER spaces have gone. Clear the code box to carry on at the usual price." }); return; }

    let jpg: Buffer;
    try {
      jpg = await sharp(file.buffer).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    } catch {
      res.status(400).json({ error: "I could not open that photo. Please try a different selfie." });
      return;
    }
    const selfieKey = await saveObject(jpg, "image/jpeg", "selfie");
    const id = uuid();
    const token = randomBytes(12).toString("hex");
    const free = info.kind === "free";
    const payState = free ? "free" : "unpaid";
    // The SISTER cap is checked inside the insert itself, so two people pressing at once cannot both take the last space.
    const ins = await db.execute(sql`INSERT INTO xmasshoot_orders (id, token, name, email, phone, colour, code, amount_pence, pay_state, selfie_key, marketing)
      SELECT ${id}, ${token}, ${name}, ${email}, ${phone}, ${colour}, ${code}, ${info.amountPence}, ${payState}, ${selfieKey}, ${b.marketing === "yes"}
      WHERE ${free ? sql`(SELECT count(*) FROM xmasshoot_orders WHERE upper(code) = 'SISTER') < ${SISTER_SLOTS}` : sql`true`}
      RETURNING id`);
    if (!ins.rows.length) { res.status(409).json({ error: "All the SISTER spaces have gone. Clear the code box to carry on at the usual price." }); return; }

    void notifyOwner(
      `Christmas shoot: ${name} is waiting`,
      [
        `${name} has sent a selfie for the CYBERSUITE CHRISTMAS SHOOT.`,
        free ? "Code SISTER: free, no payment needed." : `They owe ${pounds(info.amountPence)}${code ? ` (code ${code})` : ""}. Look for ${name} in your Monzo feed.`,
        `Colour: ${colour || "red (they left it blank)"}`,
        `WhatsApp: ${phone}`,
        `Email: ${email}`,
        "",
        "Open your inbox, check the payment, tick payment seen and press Create images:",
        appLink("/xmasshoot-admin"),
      ].join("\n"),
    );
    res.json({ ok: true, token, amountPence: info.amountPence, label: pounds(info.amountPence), payUrl: free ? "" : info.kind === "half" ? MONZO_HALF : MONZO_FULL, free });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// The person's own status page, found by the order token. Shows the right Monzo link until payment is seen.
router.get("/xmasshoot/order/:token", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = (await db.execute(sql`SELECT name, code, amount_pence, pay_state, status, slug FROM xmasshoot_orders WHERE token = ${str(req.params.token, 60)}`)).rows[0] as
      | { name: string; code: string; amount_pence: number; pay_state: string; status: string; slug: string | null }
      | undefined;
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const owes = r.pay_state === "unpaid" || r.pay_state === "claimed";
    res.json({
      name: r.name,
      label: pounds(r.amount_pence),
      payState: r.pay_state,
      payUrl: owes && r.amount_pence > 0 ? (r.amount_pence === HALF_PENCE ? MONZO_HALF : MONZO_FULL) : "",
      status: r.status,
      slug: r.status === "ready" ? r.slug : null,
    });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

const paidHits = new Map<string, number>();
router.post("/xmasshoot/order/:token/paid", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const token = str(req.params.token, 60);
    const r = (await db.execute(sql`SELECT id, name, amount_pence, pay_state, phone, email FROM xmasshoot_orders WHERE token = ${token}`)).rows[0] as
      | { id: string; name: string; amount_pence: number; pay_state: string; phone: string; email: string }
      | undefined;
    if (!r) { res.status(404).json({ error: "That link does not look right." }); return; }
    if (r.pay_state === "free" || r.pay_state === "seen") { res.json({ ok: true }); return; }
    const last = paidHits.get(r.id) ?? 0;
    if (Date.now() - last < 60_000) { res.json({ ok: true }); return; }
    paidHits.set(r.id, Date.now());
    await db.execute(sql`UPDATE xmasshoot_orders SET pay_state = 'claimed', updated_at = now() WHERE id = ${r.id}`);
    void notifyOwner(
      `Christmas shoot: ${r.name} says she has paid`,
      [
        `${r.name} has pressed "I have paid" for ${pounds(r.amount_pence)}.`,
        `Please check your Monzo feed for a payment from ${r.name}.`,
        `WhatsApp: ${r.phone}`,
        `Email: ${r.email}`,
        "",
        appLink("/xmasshoot-admin"),
      ].join("\n"),
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// Public: the person's private page at /<name>xmas. Shows the ten images until the 30 days are up.
router.get("/xmasshoot/view/:slug", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = (await db.execute(sql`SELECT name, status, images, expires_at FROM xmasshoot_orders WHERE slug = ${str(req.params.slug, 60).toLowerCase()}`)).rows[0] as
      | { name: string; status: string; images: unknown[]; expires_at: string | null }
      | undefined;
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const expired = r.status === "expired" || (!!r.expires_at && new Date(r.expires_at).getTime() < Date.now());
    if (expired) { res.json({ name: r.name, expired: true, ready: false, images: [] }); return; }
    const ok = r.status === "ready";
    res.json({ name: r.name, expired: false, ready: ok, images: ok ? r.images : [], expiresAt: r.expires_at });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Link preview picture for the private link, e.g. /xmasshoot/og/izzyxmas.jpg says "IZZY'S XMAS SHOOT".
router.get("/xmasshoot/og/:file", async (req: Request, res: Response) => {
  try {
    const slug = str(req.params.file, 80).toLowerCase().replace(/\.(png|jpg)$/, "");
    if (!/^[a-z0-9]+xmas$/.test(slug)) { res.status(404).end(); return; }
    await ensureTable();
    const r = (await db.execute(sql`SELECT name FROM xmasshoot_orders WHERE slug = ${slug}`)).rows[0] as { name: string } | undefined;
    const png = await renderXmasOg(firstNameFor(r?.name || "", slug));
    res.set("Content-Type", "image/jpeg").set("Cache-Control", "public, max-age=86400").send(png);
  } catch {
    res.status(500).end();
  }
});

// Vanessa's side.
router.get("/xmasshoot/orders", requireAuth, async (_req: Request, res: Response) => {
  await ensureTable();
  const rows = (await db.execute(sql`SELECT id, name, email, phone, colour, code, amount_pence, pay_state, status, note, slug, marketing, selfie_key, jsonb_array_length(images) AS done, created_at, expires_at
    FROM xmasshoot_orders ORDER BY created_at DESC LIMIT 200`)).rows as unknown as Record<string, unknown>[];
  res.json({
    total: XMAS_SHOT_COUNT,
    sisterLeft: Math.max(0, SISTER_SLOTS - (await sisterUsed())),
    orders: rows.map((r) => ({
      ...r,
      selfie_url: r.selfie_key ? `/api/media/${r.selfie_key}` : "",
      selfie_key: undefined,
      label: pounds(Number(r.amount_pence)),
      link: r.slug ? appLink(`/${r.slug}`) : "",
    })),
  });
});

router.get("/xmasshoot/orders/:id", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const r = (await db.execute(sql`SELECT * FROM xmasshoot_orders WHERE id = ${str(req.params.id, 60)}`)).rows[0] as Record<string, unknown> | undefined;
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ order: { ...r, selfie_url: r.selfie_key ? `/api/media/${r.selfie_key}` : "" }, link: r.slug ? appLink(`/${r.slug}`) : "" });
});

router.post("/xmasshoot/orders/:id/payment-seen", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const seen = req.body?.seen !== false;
  await db.execute(sql`UPDATE xmasshoot_orders SET pay_state = ${seen ? "seen" : "claimed"}, updated_at = now() WHERE id = ${str(req.params.id, 60)} AND pay_state <> 'free'`);
  res.json({ ok: true });
});

// Gives a SISTER space back. The order and its images stay; only the code is relabelled so it stops counting towards the 5.
router.post("/xmasshoot/orders/:id/release-sister", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const r = await db.execute(sql`UPDATE xmasshoot_orders SET code = 'SISTER (space given back)', note = coalesce(note, '') || ' [SISTER space given back]', updated_at = now() WHERE id = ${str(req.params.id, 60)} AND upper(code) = 'SISTER' RETURNING id`);
  if (!r.rows.length) { res.status(404).json({ error: "That one is not using a SISTER space" }); return; }
  res.json({ ok: true, sisterLeft: Math.max(0, SISTER_SLOTS - (await sisterUsed())) });
});

// The one button. Needs the payment ticked (or a free code), gives the order its /<name>xmas link and starts the ten images.
router.post("/xmasshoot/orders/:id/create", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const id = str(req.params.id, 60);
  const r = (await db.execute(sql`SELECT id, name, pay_state, slug, status FROM xmasshoot_orders WHERE id = ${id}`)).rows[0] as
    | { id: string; name: string; pay_state: string; slug: string | null; status: string }
    | undefined;
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (r.pay_state !== "free" && r.pay_state !== "seen") { res.status(402).json({ error: "Tick payment seen first" }); return; }
  if (r.status === "expired") { res.status(410).json({ error: "This one has expired and the photos are deleted" }); return; }
  const slug = r.slug || (await makeSlug(r.name));
  if (!r.slug) await db.execute(sql`UPDATE xmasshoot_orders SET slug = ${slug}, updated_at = now() WHERE id = ${id}`);
  void runXmasOrder(id);
  res.json({ ok: true, slug, link: appLink(`/${slug}`) });
});

router.post("/xmasshoot/orders/:id/make", requireAuth, async (req: Request, res: Response) => {
  const only = Array.isArray(req.body?.only) ? (req.body.only as unknown[]).map(Number).filter((n) => n >= 1 && n <= XMAS_SHOT_COUNT) : undefined;
  void runXmasOrder(str(req.params.id, 60), only && only.length ? only : undefined);
  res.json({ ok: true });
});

router.delete("/xmasshoot/orders/:id/images/:n", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const n = Number(req.params.n);
  await db.execute(sql`UPDATE xmasshoot_orders SET images = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(images) e WHERE (e->>'n')::int <> ${n}), '[]'::jsonb), updated_at = now() WHERE id = ${str(req.params.id, 60)}`);
  res.json({ ok: true });
});

export default router;
