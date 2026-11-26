import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { saveObject } from "../lib/photoshootWorker";
import { appLink } from "../lib/freeSampleWorker";
import { notifyOwner } from "../lib/notify";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { runBfdecPhotos, BFDEC_PHOTO_COUNT } from "../lib/bfdecWorker";

// DECEMBER BUNDLE at /bfdec. Black Friday offer: 20 Christmas pieces of content and 10 Christmas photos, delivered in the person's own portal.
// Full price 699 pounds. Code BFDEC makes it 149 pounds, from the evening of Thu 26 Nov 2026 (open from the moment it went live) until 8pm Fri 27 Nov 2026 (UK time, which is GMT in November).
// Payment is by Monzo link. Monzo cannot tell the site who has paid, so the person taps "I have paid", Vanessa sees it in her inbox, checks Monzo
// and ticks "payment seen". She makes the work, uploads it into the order, and the site gives the person a private portal link (/<name>decbundle).

const router: IRouter = Router();
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 2 } });
const uploadMany = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 40 } });
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

const FULL_PENCE = 69900;
const DEAL_PENCE = 14900;
const CODE = "BFDEC";
const FREE_CODE = "LEDZEP"; // free for whoever Vanessa gives it to, works any time, no payment needed
const OPENS_AT = new Date(process.env.BFDEC_OPENS_AT || "2026-11-26T18:00:00Z").getTime();
const CLOSES_AT = new Date(process.env.BFDEC_CLOSES_AT || "2026-11-27T20:00:00Z").getTime();
const MONZO_LINK = process.env.BFDEC_MONZO || "https://monzo.com/pay/r/the-cyber-suite_d4YOpp0fx9iPkj";
const POSTS_TARGET = 20;
const PHOTOS_TARGET = BFDEC_PHOTO_COUNT;
const KEEP_DAYS = 90;

const pounds = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, "")}`;
const windowState = (now = Date.now()): "before" | "open" | "closed" => (now < OPENS_AT ? "before" : now >= CLOSES_AT ? "closed" : "open");

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
    .execute(sql`CREATE TABLE IF NOT EXISTS bfdec_orders (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      insta TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      colours TEXT NOT NULL DEFAULT '',
      amount_pence INT NOT NULL DEFAULT 0,
      pay_state TEXT NOT NULL DEFAULT 'unpaid',
      photo_key TEXT NOT NULL DEFAULT '',
      logo_key TEXT NOT NULL DEFAULT '',
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'waiting',
      note TEXT NOT NULL DEFAULT '',
      marketing BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ready_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ
    )`)
    .then(() => db.execute(sql`ALTER TABLE bfdec_orders ADD COLUMN IF NOT EXISTS photo_state TEXT NOT NULL DEFAULT 'idle'`))
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

type Item = { id: string; kind: "post" | "photo"; label: string; url: string; n?: number };
type OrderRow = { id: string; photo_key: string; logo_key: string; items: Item[] };
const keyOf = (url: string) => url.replace(/^\/api\/media\//, "");

async function sweepExpired(): Promise<void> {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const rows = (await db.execute(sql`SELECT id, photo_key, logo_key, items FROM bfdec_orders WHERE expires_at IS NOT NULL AND expires_at < now() AND status <> 'expired'`)).rows as unknown as OrderRow[];
    for (const r of rows) {
      if (bucketId) {
        const keys = [r.photo_key, r.logo_key, ...(r.items ?? []).map((i) => keyOf(i.url))].filter(Boolean);
        for (const k of keys) await objectStorageClient.bucket(bucketId).file(k).delete({ ignoreNotFound: true }).catch(() => undefined);
      }
      await db.execute(sql`UPDATE bfdec_orders SET status = 'expired', items = '[]'::jsonb, photo_key = '', logo_key = '', updated_at = now() WHERE id = ${r.id}`);
    }
  } catch (e) {
    logger.warn({ err: e }, "bfdec expiry sweep failed");
  }
}
const sweepTimer = setInterval(() => void sweepExpired(), 60 * 60 * 1000);
sweepTimer.unref?.();
setTimeout(() => void ensureTable().then(sweepExpired).catch(() => undefined), 120 * 1000).unref?.();

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
    const slug = n === 1 ? `${base}decbundle` : `${base}${n}decbundle`;
    const hit = (await db.execute(sql`SELECT 1 FROM bfdec_orders WHERE slug = ${slug}`)).rows.length;
    if (!hit) return slug;
  }
  return `${base}${randomBytes(3).toString("hex")}decbundle`;
}

const clean = (buf: Buffer, size: number) => sharp(buf).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true });

// What the page needs to know: the prices, the code and whether the offer is on.
router.get("/bfdec/offer", (_req: Request, res: Response) => {
  res.json({ state: windowState(), opensAt: new Date(OPENS_AT).toISOString(), closesAt: new Date(CLOSES_AT).toISOString(), fullLabel: pounds(FULL_PENCE), dealLabel: pounds(DEAL_PENCE), serverNow: new Date().toISOString() });
});

router.post("/bfdec/check-code", (req: Request, res: Response) => {
  const state = windowState();
  const code = str(req.body?.code, 30).toUpperCase();
  if (!code) { res.json({ kind: "none", label: pounds(FULL_PENCE), state }); return; }
  if (code === FREE_CODE) { res.json({ kind: "free", label: "free", state }); return; }
  if (code !== CODE) { res.json({ kind: "bad", label: pounds(FULL_PENCE), state }); return; }
  if (state !== "open") { res.json({ kind: state === "before" ? "early" : "ended", label: pounds(FULL_PENCE), state }); return; }
  res.json({ kind: "deal", label: pounds(DEAL_PENCE), state });
});

router.post("/bfdec/start", upload.fields([{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }]), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    if (tooMany(String(req.ip))) { res.status(429).json({ error: "That is a lot of goes in a short time. Please try again in a bit, or message me." }); return; }
    const state = windowState();
    const b = req.body as Record<string, string>;
    const free = str(b.code, 30).toUpperCase() === FREE_CODE;
    if (!free && state === "before") { res.status(403).json({ error: "The offer opens at 8pm tonight. Pop back then." }); return; }
    if (!free && state === "closed") { res.status(403).json({ error: "This offer has now ended. Message me and I will tell you what I can do." }); return; }
    const name = str(b.name, 80);
    const email = str(b.email, 160);
    const phone = str(b.phone, 30);
    const insta = str(b.insta, 60).replace(/^@+/, "").replace(/[^a-zA-Z0-9._]/g, "");
    const area = str(b.area, 120);
    const colours = str(b.colours, 120);
    const code = str(b.code, 30).toUpperCase();
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const photo = files?.photo?.[0];
    const logo = files?.logo?.[0];
    if (!name) { res.status(400).json({ error: "Please add your name" }); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Please add your email so I can send your portal" }); return; }
    if (phone.replace(/\D/g, "").length < 10) { res.status(400).json({ error: "Please add your WhatsApp number" }); return; }
    if (!insta) { res.status(400).json({ error: "Please add your Instagram @" }); return; }
    if (!area) { res.status(400).json({ error: "Please tell me your area" }); return; }
    if (!colours) { res.status(400).json({ error: "Please tell me your colour scheme" }); return; }
    if (!photo) { res.status(400).json({ error: "Please add your photo" }); return; }
    if (!IMAGE_MIMES.includes(photo.mimetype)) { res.status(400).json({ error: "Please upload a JPG, PNG or WebP photo. If your phone saves photos as HEIC, take a screenshot of your photo and upload that instead." }); return; }
    if (logo && !IMAGE_MIMES.includes(logo.mimetype)) { res.status(400).json({ error: "Your logo needs to be a JPG, PNG or WebP file." }); return; }
    if (b.consent !== "yes") { res.status(400).json({ error: "Please tick the box so I know you are happy for me to make your content" }); return; }
    if (code !== CODE && !free) { res.status(400).json({ error: `Pop the code ${CODE} in the code box to unlock the ${pounds(DEAL_PENCE)} price.` }); return; }

    let photoJpg: Buffer;
    try {
      photoJpg = await clean(photo.buffer, 2048).jpeg({ quality: 90 }).toBuffer();
    } catch {
      res.status(400).json({ error: "I could not open that photo. Please try a different one." });
      return;
    }
    let logoKey = "";
    if (logo) {
      try {
        const png = await clean(logo.buffer, 1600).png().toBuffer();
        logoKey = await saveObject(png, "image/png", "bfdec-logo");
      } catch {
        res.status(400).json({ error: "I could not open that logo. Please try a different file." });
        return;
      }
    }
    const photoKey = await saveObject(photoJpg, "image/jpeg", "bfdec-photo");
    const id = uuid();
    const token = randomBytes(12).toString("hex");
    const amount = free ? 0 : DEAL_PENCE;
    await db.execute(sql`INSERT INTO bfdec_orders (id, token, name, email, phone, insta, area, colours, amount_pence, pay_state, photo_key, logo_key, marketing)
      VALUES (${id}, ${token}, ${name}, ${email}, ${phone}, ${insta}, ${area}, ${colours}, ${amount}, ${free ? "free" : "unpaid"}, ${photoKey}, ${logoKey}, ${b.marketing === "yes"})`);
    // A free order has nothing to wait for, so the ten Christmas photos start now.
    if (free) void runBfdecPhotos(id);

    void notifyOwner(
      `December Bundle: ${name} is waiting`,
      [
        `${name} has filled in the DECEMBER BUNDLE form (code ${free ? FREE_CODE : CODE}).`,
        free ? "Code LEDZEP: free, no payment needed. Their ten Christmas photos have started by themselves." : `They owe ${pounds(DEAL_PENCE)}. Look for ${name} in your Monzo feed.`,
        `Area: ${area}`,
        `Colour scheme: ${colours}`,
        `Instagram: @${insta}`,
        `WhatsApp: ${phone}`,
        `Email: ${email}`,
        logoKey ? "Logo: uploaded" : "Logo: none uploaded",
        "",
        free ? "Open your inbox, upload their 20 posts and send the portal link:" : "Open your inbox, check the payment, tick payment seen, upload their 20 posts and send the portal link:",
        appLink("/bfdec-admin"),
      ].join("\n"),
    );
    res.json({ ok: true, token, label: free ? "free" : pounds(DEAL_PENCE), payUrl: free ? "" : MONZO_LINK, free });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// The person's own status page, found by the order token.
router.get("/bfdec/order/:token", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = (await db.execute(sql`SELECT name, amount_pence, pay_state, status, slug FROM bfdec_orders WHERE token = ${str(req.params.token, 60)}`)).rows[0] as
      | { name: string; amount_pence: number; pay_state: string; status: string; slug: string | null }
      | undefined;
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const owes = r.pay_state === "unpaid" || r.pay_state === "claimed";
    res.json({ name: r.name, label: pounds(r.amount_pence), payState: r.pay_state, payUrl: owes ? MONZO_LINK : "", status: r.status, slug: r.status === "ready" ? r.slug : null });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

const paidHits = new Map<string, number>();
router.post("/bfdec/order/:token/paid", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = (await db.execute(sql`SELECT id, name, amount_pence, pay_state, phone, email, insta FROM bfdec_orders WHERE token = ${str(req.params.token, 60)}`)).rows[0] as
      | { id: string; name: string; amount_pence: number; pay_state: string; phone: string; email: string; insta: string }
      | undefined;
    if (!r) { res.status(404).json({ error: "That link does not look right." }); return; }
    if (r.pay_state === "seen" || r.pay_state === "free") { res.json({ ok: true }); return; }
    const last = paidHits.get(r.id) ?? 0;
    if (Date.now() - last < 60_000) { res.json({ ok: true }); return; }
    paidHits.set(r.id, Date.now());
    await db.execute(sql`UPDATE bfdec_orders SET pay_state = 'claimed', updated_at = now() WHERE id = ${r.id}`);
    void notifyOwner(
      `December Bundle: ${r.name} says they have paid`,
      [
        `${r.name} has pressed "I have paid" for ${pounds(r.amount_pence)}.`,
        `Please check your Monzo feed for a payment from ${r.name}.`,
        `Instagram: @${r.insta}`,
        `WhatsApp: ${r.phone}`,
        `Email: ${r.email}`,
        "",
        appLink("/bfdec-admin"),
      ].join("\n"),
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// Public: the person's private portal at /<name>decbundle.
router.get("/bfdec/view/:slug", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = (await db.execute(sql`SELECT name, status, items, expires_at FROM bfdec_orders WHERE slug = ${str(req.params.slug, 80).toLowerCase()}`)).rows[0] as
      | { name: string; status: string; items: Item[]; expires_at: string | null }
      | undefined;
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    const expired = r.status === "expired" || (!!r.expires_at && new Date(r.expires_at).getTime() < Date.now());
    if (expired) { res.json({ name: r.name, expired: true, ready: false, items: [] }); return; }
    const ok = r.status === "ready";
    res.json({ name: r.name, expired: false, ready: ok, items: ok ? r.items : [], expiresAt: r.expires_at });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Vanessa's side.
router.get("/bfdec/orders", requireAuth, async (_req: Request, res: Response) => {
  await ensureTable();
  const rows = (await db.execute(sql`SELECT id, name, email, phone, insta, area, colours, amount_pence, pay_state, photo_state, status, note, slug, marketing, photo_key, logo_key, items, created_at, expires_at
    FROM bfdec_orders ORDER BY created_at DESC LIMIT 200`)).rows as unknown as Record<string, unknown>[];
  res.json({
    postsTarget: POSTS_TARGET,
    photosTarget: PHOTOS_TARGET,
    orders: rows.map((r) => ({
      ...r,
      photo_url: r.photo_key ? `/api/media/${r.photo_key}` : "",
      logo_url: r.logo_key ? `/api/media/${r.logo_key}` : "",
      photo_key: undefined,
      logo_key: undefined,
      label: pounds(Number(r.amount_pence)),
      link: r.slug ? appLink(`/${r.slug}`) : "",
    })),
  });
});

router.post("/bfdec/orders/:id/payment-seen", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const seen = req.body?.seen !== false;
  const id = str(req.params.id, 60);
  await db.execute(sql`UPDATE bfdec_orders SET pay_state = ${seen ? "seen" : "claimed"}, updated_at = now() WHERE id = ${id} AND pay_state <> 'free'`);
  // Payment seen starts the ten Christmas photos by itself, in the person's colours. Only the first time.
  if (seen) {
    const r = (await db.execute(sql`SELECT photo_state FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { photo_state: string } | undefined;
    if (r && r.photo_state === "idle") void runBfdecPhotos(id);
  }
  res.json({ ok: true });
});

// Vanessa adds the finished work: posts (20) and photos (10). Several files at once.
router.post("/bfdec/orders/:id/items", requireAuth, uploadMany.array("files", 40), async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const id = str(req.params.id, 60);
    const kind: "post" | "photo" = req.body?.kind === "photo" ? "photo" : "post";
    const r = (await db.execute(sql`SELECT items, status FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { items: Item[]; status: string } | undefined;
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    if (r.status === "expired") { res.status(410).json({ error: "This one has expired and the files are deleted" }); return; }
    const files = ((req.files as Express.Multer.File[]) || []).filter((f) => IMAGE_MIMES.includes(f.mimetype));
    if (!files.length) { res.status(400).json({ error: "Add some JPG, PNG or WebP images" }); return; }
    const items = [...(r.items ?? [])];
    files.sort((a, b) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true }));
    for (const f of files) {
      const key = await saveObject(f.buffer, f.mimetype, `bfdec-${kind}`);
      items.push({ id: uuid(), kind, label: f.originalname.replace(/\.[a-z0-9]+$/i, "").slice(0, 80), url: `/api/media/${key}` });
    }
    await db.execute(sql`UPDATE bfdec_orders SET items = ${JSON.stringify(items)}::jsonb, updated_at = now() WHERE id = ${id}`);
    res.json({ ok: true, count: items.length });
  } catch {
    res.status(500).json({ error: "Those did not upload, please try again" });
  }
});

router.delete("/bfdec/orders/:id/items/:itemId", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  await db.execute(sql`UPDATE bfdec_orders SET items = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(items) e WHERE e->>'id' <> ${str(req.params.itemId, 60)}), '[]'::jsonb), updated_at = now() WHERE id = ${str(req.params.id, 60)}`);
  res.json({ ok: true });
});

// Gives the order its portal link (/<name>decbundle) without publishing it yet, so she can copy it while she works.
router.post("/bfdec/orders/:id/link", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const id = str(req.params.id, 60);
  const r = (await db.execute(sql`SELECT name, slug FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { name: string; slug: string | null } | undefined;
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  const slug = r.slug || (await makeSlug(r.name));
  if (!r.slug) await db.execute(sql`UPDATE bfdec_orders SET slug = ${slug}, updated_at = now() WHERE id = ${id}`);
  res.json({ ok: true, slug, link: appLink(`/${slug}`) });
});

// The one button. Needs the payment ticked, then makes the portal live for the person.
router.post("/bfdec/orders/:id/publish", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const id = str(req.params.id, 60);
  const r = (await db.execute(sql`SELECT name, pay_state, slug, status, items FROM bfdec_orders WHERE id = ${id}`)).rows[0] as
    | { name: string; pay_state: string; slug: string | null; status: string; items: Item[] }
    | undefined;
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (r.pay_state !== "seen" && r.pay_state !== "free") { res.status(402).json({ error: "Tick payment seen first" }); return; }
  if (r.status === "expired") { res.status(410).json({ error: "This one has expired and the files are deleted" }); return; }
  if (!(r.items ?? []).length) { res.status(409).json({ error: "Upload their posts and photos first" }); return; }
  const slug = r.slug || (await makeSlug(r.name));
  await db.execute(sql`UPDATE bfdec_orders SET slug = ${slug}, status = 'ready', ready_at = COALESCE(ready_at, now()), expires_at = COALESCE(expires_at, now() + (${KEEP_DAYS} || ' days')::interval), updated_at = now() WHERE id = ${id}`);
  res.json({ ok: true, slug, link: appLink(`/${slug}`) });
});

// Makes the missing Christmas photos (or just the ones in `only`). Needs the payment ticked.
router.post("/bfdec/orders/:id/photos", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  const id = str(req.params.id, 60);
  const r = (await db.execute(sql`SELECT pay_state, status FROM bfdec_orders WHERE id = ${id}`)).rows[0] as { pay_state: string; status: string } | undefined;
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (r.pay_state !== "seen" && r.pay_state !== "free") { res.status(402).json({ error: "Tick payment seen first" }); return; }
  if (r.status === "expired") { res.status(410).json({ error: "This one has expired and the files are deleted" }); return; }
  const only = Array.isArray(req.body?.only) ? (req.body.only as unknown[]).map(Number).filter((n) => n >= 1 && n <= BFDEC_PHOTO_COUNT) : undefined;
  void runBfdecPhotos(id, only && only.length ? only : undefined);
  res.json({ ok: true });
});

router.post("/bfdec/orders/:id/unpublish", requireAuth, async (req: Request, res: Response) => {
  await ensureTable();
  await db.execute(sql`UPDATE bfdec_orders SET status = 'waiting', updated_at = now() WHERE id = ${str(req.params.id, 60)} AND status = 'ready'`);
  res.json({ ok: true });
});

export default router;
