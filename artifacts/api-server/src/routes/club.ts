import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiSourcePhotosTable, clientPresetsTable } from "@workspace/db/schema";
import { saveSampleFile, readKey, appLink } from "../lib/freeSampleWorker";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { createJob, getJob, processPortraitJob } from "../lib/aiPortraitWorker";
import { logger } from "../lib/logger";
import { ensureTable as ensureTenFreeTable } from "./ten-free";
import { britishise } from "../lib/british";
import { REELS_CHALLENGE_ITEMS } from "./portal";

// THE CLUBS. £69 club (free injectors WhatsApp group, 5 places) and £275 club (Instagram DM, 7 places).
// The £69 club also has a public invitation page (/youreinvited): someone accepts the promise, becomes a PENDING member, fills in the details form, and waits for Vanessa to approve her.
// A member is made by Vanessa, gets a private link /club/<token>, fills in their details once, then picks their treatments and posts each month.
// Five days before their billing date the month is prepared (reel hooks and scripts, six AI photos), and an email tells Vanessa it is waiting.
// She builds the posts, vets everything in the approval queue, and only approved months reach the member's portal. Cancelled members lose access.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 22 } });
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

export const CLUB_PLANS = {
  "69": { price: 69, posts: 12, treatmentPosts: 3, aboutPosts: 3, picks: 9, reels: 10, stories: 12, tailoredReels: 4 },
  "222": { price: 275, posts: 16, treatmentPosts: 4, aboutPosts: 2, picks: 12, reels: 16, stories: 16, tailoredReels: 8 },
  // A portal only member (a client or a freebie): no billing, no monthly build, just a private page to collect work from. Nothing on their page says club.
  portal: { price: 0, posts: 0, treatmentPosts: 0, aboutPosts: 0, picks: 0, reels: 0, stories: 0, tailoredReels: 0 },
} as const;
type PlanId = keyof typeof CLUB_PLANS;
// A few members get more than their plan as a favour. A member named here gets all of the built posts to use, with nothing held back to choose between.
const POST_CAP_OVERRIDES: Record<string, number> = { "natasha lhd": 20 };
const capsFor = (m: { plan: PlanId; name: string }) => {
  const base = CLUB_PLANS[m.plan];
  const o = POST_CAP_OVERRIDES[String(m.name ?? "").trim().toLowerCase()];
  return o ? { ...base, posts: o } : base;
};
export const PLACES = { "69": 5, "222": 7 } as const;
const MAX_PHOTOS = 20;
const PICK_HOURS = 48; // a member has 48 hours after approval to choose her posts
/** Works out what the member sees for one approved month: either the full set to choose from, or the posts she has chosen. */
function pickState(content: Record<string, any> | null | undefined, approvedAt: string | Date | null, cap: number) {
  const all: any[] = (content?.posts as any[]) ?? [];
  const deadline = approvedAt ? new Date(new Date(approvedAt).getTime() + PICK_HOURS * 3600000) : null;
  if (all.length <= cap) return { phase: "done" as const, shown: all, picked: all.map((p) => p.n), deadline, cap, all };
  const chosen: number[] | null = Array.isArray(content?.picked) && content!.picked.length ? content!.picked.map(Number) : null;
  const expired = !!deadline && Date.now() > deadline.getTime();
  if (chosen) return { phase: "done" as const, shown: all.filter((p) => chosen.includes(p.n)), picked: chosen, deadline, cap, all };
  // Past the deadline with no choice: the first ones in order are used, so she is never left with nothing.
  if (expired) { const first = [...all].sort((a, b) => a.n - b.n).slice(0, cap); return { phase: "done" as const, shown: first, picked: first.map((p) => p.n), deadline, cap, all }; }
  return { phase: "choose" as const, shown: [] as any[], picked: [] as number[], deadline, cap, all };
}
const CLUB_BANK_EXTRA = 8; // extra posts built each month and saved to the member's bank for later
const CUT_OFF_DAYS = 7; // members choose up to a week before billing, generation starts five days before
const PREP_DAYS = 5;

// A member can be built for once their details and photos are saved, even if her form was later reopened for edits.
const canBuild = (m: { details_done: boolean; details?: Record<string, any>; photo_urls?: string[] }) =>
  m.details_done || (!!m.details?.clinicName && !!m.details?.clinicianName && (m.photo_urls ?? []).length > 0);

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const noDashes = (t: unknown) => britishise(String(t ?? "")).replace(/[–—]/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/!/g, ".").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const hex = (v: unknown, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? "").trim()) ? String(v).trim() : fallback);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS club_members (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      billing_day INTEGER NOT NULL DEFAULT 1,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      details_done BOOLEAN NOT NULL DEFAULT false,
      logo_url TEXT NOT NULL DEFAULT '',
      photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      clinic_photo_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      cancelled_at TIMESTAMPTZ
    )`)
    .then(() => db.execute(sql`CREATE TABLE IF NOT EXISTS club_months (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'choosing',
      choices JSONB NOT NULL DEFAULT '{}'::jsonb,
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      ai_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      ai_status TEXT NOT NULL DEFAULT '',
      reels_status TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      due_notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      approved_at TIMESTAMPTZ,
      UNIQUE (member_id, month)
    )`))
    .then(() => db.execute(sql`CREATE TABLE IF NOT EXISTS club_extras (
      month TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (month, kind)
    )`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS ref_photo_url TEXT NOT NULL DEFAULT ''`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS welcome_photo_url TEXT NOT NULL DEFAULT ''`))
    .then(() => db.execute(sql`ALTER TABLE club_months ADD COLUMN IF NOT EXISTS ai_error TEXT NOT NULL DEFAULT ''`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS slug TEXT`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS preset_id INTEGER`))
    .then(() => db.execute(sql`ALTER TABLE club_months ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}'::jsonb`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS agreed_name TEXT NOT NULL DEFAULT ''`))
    .then(() => db.execute(sql`ALTER TABLE club_members ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ`))
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

type Member = {
  id: string; token: string; plan: PlanId; status: string; name: string; email: string; billing_day: number;
  details: Record<string, any>; details_done: boolean; logo_url: string; photo_urls: string[]; clinic_photo_url: string; ref_photo_url?: string; welcome_photo_url?: string; phone?: string; agreed_name?: string; agreed_at?: string | null; created_at: string; cancelled_at: string | null;
};
type MonthRow = {
  id: string; member_id: string; month: string; status: string; choices: Record<string, any>; content: Record<string, any>;
  ai_urls: string[]; ai_status: string; ai_error?: string; reels_status: string; admin_note: string; due_notified_at: string | null; approved_at: string | null; created_at: string;
};

// ---------------------------------------------------------------------------
// Dates. A member's cycle is named after the month their next billing date falls in.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function nextBilling(billingDay: number, now = new Date()): { date: Date; month: string } {
  const day = Math.min(28, Math.max(1, billingDay || 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
  if (d < today) d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, day));
  return { date: d, month: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}` };
}
const daysUntil = (d: Date, now = new Date()) => Math.round((d.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);

async function getOrMakeMonth(memberId: string, month: string): Promise<MonthRow> {
  const found = await db.execute(sql`SELECT * FROM club_months WHERE member_id = ${memberId} AND month = ${month}`);
  if (found.rows.length) return found.rows[0] as unknown as MonthRow;
  await db.execute(sql`INSERT INTO club_months (id, member_id, month) VALUES (${uuid()}, ${memberId}, ${month}) ON CONFLICT DO NOTHING`);
  const again = await db.execute(sql`SELECT * FROM club_months WHERE member_id = ${memberId} AND month = ${month}`);
  return again.rows[0] as unknown as MonthRow;
}

// ---------------------------------------------------------------------------
// Email to Vanessa
// ---------------------------------------------------------------------------

async function emailVanessa(subject: string, lines: string[]): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;
  const to = process.env.CLUB_NOTIFY_EMAIL || process.env.NOTIFY_EMAIL || "vanessaviking78@gmail.com";
  try {
    const t = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await t.sendMail({ from: process.env.EMAIL_FROM || SMTP_USER, to, subject, text: lines.join("\n") });
    return true;
  } catch (err) {
    logger.warn({ err }, "Club email failed");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Member shape. A member never sees another member, their email, or anything that is not approved.
// ---------------------------------------------------------------------------

const publicMember = (m: Member) => ({
  name: m.name,
  plan: m.plan,
  caps: capsFor(m),
  detailsDone: m.details_done,
  details: m.details,
  logoUrl: m.logo_url,
  photoUrls: m.photo_urls,
  clinicPhotoUrl: m.clinic_photo_url,
  welcomePhotoUrl: m.welcome_photo_url ?? "",
  billingDay: m.billing_day,
});

// A friendly link: her name plus a few random letters, so it reads well but cannot be guessed from her name alone. The old long link keeps working too.
function makeSlug(name: string): string {
  const base = (name || "member").toLowerCase().replace(/\(.*?\)/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "member";
  const tail = Array.from(randomBytes(5)).map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  return `${base}-${tail}`;
}

async function memberByToken(token: string): Promise<Member | null> {
  const r = await db.execute(sql`SELECT * FROM club_members WHERE token = ${token} OR slug = ${token}`);
  return (r.rows[0] as unknown as Member) ?? null;
}

// ---------------------------------------------------------------------------
// The £69 club invitation (public, unlisted link). Accepting makes a PENDING member who fills in the details form and waits for Vanessa.
// ---------------------------------------------------------------------------

async function placesTaken(plan: PlanId): Promise<number> {
  return Number((await db.execute(sql`SELECT count(*)::int AS n FROM club_members WHERE plan = ${plan} AND status IN ('active', 'pending')`)).rows[0]?.n ?? 0);
}

router.get("/club/invite/69", async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const total = PLACES["69"];
    const left = Math.max(0, total - (await placesTaken("69")));
    res.set("Cache-Control", "no-store");
    res.json({ total, left, open: left > 0 });
  } catch {
    res.status(500).json({ error: "Could not load the invitation" });
  }
});

const inviteHits = new Map<string, number[]>();
router.post("/club/invite/69", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ip = String(req.ip ?? "");
    const recent = (inviteHits.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
    if (recent.length >= 6) { res.status(429).json({ error: "That is a lot of tries. Please message me and I will sort it." }); return; }
    inviteHits.set(ip, [...recent, Date.now()]);
    const b = req.body as { name?: string; email?: string; phone?: string; agreed?: boolean; agreedName?: string; website?: string; billingDay?: number };
    if (b.website) { res.json({ ok: true, token: "" }); return; } // hidden field only a bot fills in
    const name = str(b.name, 100);
    const email = str(b.email, 160).toLowerCase();
    const phone = str(b.phone, 40);
    const agreedName = str(b.agreedName, 100);
    if (name.length < 2) { res.status(400).json({ error: "Please add your name" }); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "Please add an email address I can reach you on" }); return; }
    if (phone.replace(/\D/g, "").length < 7) { res.status(400).json({ error: "Please add your WhatsApp number" }); return; }
    if (!b.agreed || agreedName.length < 2) { res.status(400).json({ error: "Please tick the promise and type your name to sign it" }); return; }
    const dup = (await db.execute(sql`SELECT id FROM club_members WHERE plan = '69' AND lower(email) = ${email} AND status IN ('active', 'pending')`)).rows.length;
    if (dup) { res.status(409).json({ error: "It looks like you have already accepted. I have your details and will be in touch, or message me if you need anything." }); return; }
    const id = uuid();
    const token = randomBytes(18).toString("base64url");
    // She chooses the day of the month she would like her payment link sent (1 to 28); today's date if she did not pick one.
    const picked = Math.round(Number(b.billingDay));
    const billingDay = picked >= 1 && picked <= 28 ? picked : Math.min(28, new Date().getUTCDate());
    const ins = await db.execute(sql`INSERT INTO club_members (id, token, slug, plan, status, name, email, billing_day, phone, agreed_name, agreed_at)
      SELECT ${id}::text, ${token}::text, ${makeSlug(name)}::text, '69', 'pending', ${name}::text, ${email}::text, ${billingDay}::int, ${phone}::text, ${agreedName}::text, now()
      WHERE (SELECT count(*) FROM club_members WHERE plan = '69' AND status IN ('active', 'pending')) < ${PLACES["69"]}::int
      RETURNING id`);
    if (!ins.rows.length) { res.status(409).json({ full: true, error: "All the places have just been taken. Message me and I will add you to the list." }); return; }
    const left = Math.max(0, PLACES["69"] - (await placesTaken("69")));
    void emailVanessa(`Club invitation accepted: ${name}`, [
      `${name} has accepted the club invitation and signed the promise (typed name: ${agreedName}).`,
      `Email: ${email}`,
      `WhatsApp: ${phone}`,
      "",
      `${left} of ${PLACES["69"]} places left. She is waiting for your approval in Club admin, and is now filling in her details.`,
      "",
      appLink("/club-admin"),
    ]);
    res.json({ ok: true, token });
  } catch (err: unknown) {
    req.log?.error({ err }, "club invite failed");
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// ---------------------------------------------------------------------------
// The member side
// ---------------------------------------------------------------------------

router.get("/club/me/:token", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m) {
      res.status(404).json({ error: "That link does not look right. Please ask Vanessa for your link." });
      return;
    }
    if (m.status === "pending") {
      // Accepted the invitation, waiting for Vanessa. She can fill in her details but gets no months, choices or content yet.
      res.set("Cache-Control", "private, no-store");
      res.json({ pending: true, extras: [], member: publicMember(m), cycle: { month: "", nextBilling: "", cutOff: "", open: false, status: "building", choices: {} }, months: [] });
      return;
    }
    if (m.status !== "active") {
      res.status(403).json({ ended: true, error: "Your club membership has ended, so the portal is closed. Pop me a message if you would like to come back." });
      return;
    }
    if (m.plan === "portal") {
      // Portal only: just the posts and images Vanessa has sent to their Client Bank. No months, choices or billing.
      const pid = Number((m as any).preset_id) || 0;
      const rows = pid ? (await db.execute(sql`SELECT id, post_type, content, created_at FROM scheduled_posts WHERE preset_id = ${pid} AND status = 'draft' ORDER BY created_at DESC LIMIT 200`)).rows as any[] : [];
      const bank = rows.map((r) => ({ id: r.id, postType: r.post_type, title: str(r.content?.title, 120), caption: str(r.content?.caption, 4000), imageUrls: Array.isArray(r.content?.imageUrls) ? r.content.imageUrls.filter((u: any) => typeof u === "string") : [], videoUrl: typeof r.content?.videoUrl === "string" ? r.content.videoUrl : null, createdAt: r.created_at }));
      const files = Array.isArray(m.photo_urls) ? m.photo_urls.filter((u) => typeof u === "string") : [];
      res.set("Cache-Control", "private, no-store");
      res.json({ portalOnly: true, bank, files, extras: [], member: publicMember(m), cycle: { month: "", nextBilling: "", cutOff: "", open: false, status: "building", choices: {} }, months: [] });
      return;
    }
    const { date, month } = nextBilling(m.billing_day);
    const cur = await getOrMakeMonth(m.id, month);
    const cutOffDate = new Date(date.getTime() - CUT_OFF_DAYS * 86400000);
    const approved = await db.execute(sql`SELECT month, content, ai_urls, approved_at, choices, feedback FROM club_months WHERE member_id = ${m.id} AND status = 'approved' ORDER BY month DESC`);
    // The welcome page extras: this calendar month's, or the most recent month she has filled in.
    const nowMonth = `${new Date().getUTCFullYear()}-${pad(new Date().getUTCMonth() + 1)}`;
    let extraRows = (await db.execute(sql`SELECT * FROM club_extras WHERE month = ${nowMonth}`)).rows as any[];
    if (!extraRows.length) {
      const last = (await db.execute(sql`SELECT month FROM club_extras ORDER BY month DESC LIMIT 1`)).rows[0] as any;
      if (last) extraRows = (await db.execute(sql`SELECT * FROM club_extras WHERE month = ${last.month}`)).rows as any[];
    }
    const extras = extraRows.filter((r) => r.title || r.body || r.image_url).map((r) => ({ kind: r.kind, title: r.title, body: r.body, imageUrl: r.image_url }));
    // Posts Vanessa has sent to this member's Client Bank (drafts on her client page), for her to collect.
    const presetId = Number((m as any).preset_id) || 0;
    const bankRows = presetId ? (await db.execute(sql`SELECT id, post_type, content, created_at FROM scheduled_posts WHERE preset_id = ${presetId} AND status = 'draft' ORDER BY created_at DESC LIMIT 200`)).rows as any[] : [];
    const bank = bankRows.map((r) => ({ id: r.id, postType: r.post_type, title: str(r.content?.title, 120), caption: str(r.content?.caption, 4000), imageUrls: Array.isArray(r.content?.imageUrls) ? r.content.imageUrls.filter((u: any) => typeof u === "string") : [], videoUrl: typeof r.content?.videoUrl === "string" ? r.content.videoUrl : null, createdAt: r.created_at }));
    res.set("Cache-Control", "private, no-store");
    res.json({
      bank,
      extras,
      challengeHooks: REELS_CHALLENGE_ITEMS,
      member: publicMember(m),
      cycle: {
        month,
        nextBilling: ymd(date),
        cutOff: ymd(cutOffDate),
        open: cur.status === "choosing" && Date.now() <= cutOffDate.getTime() + 86400000,
        status: cur.status === "approved" ? "approved" : cur.status === "choosing" ? "choosing" : "building",
        choices: cur.choices,
      },
      months: (approved.rows as any[]).map((r) => {
        const ps = pickState(r.content, r.approved_at, capsFor(m).posts);
        return { month: r.month, content: { ...(r.content ?? {}), posts: ps.shown, bank: undefined, picked: undefined }, aiUrls: r.ai_urls, approvedAt: r.approved_at, feedback: r.feedback ?? {},
          ...(ps.phase === "choose" ? { choose: { cap: ps.cap, deadline: ps.deadline, posts: ps.all.map((p: any) => ({ n: p.n, label: p.label, images: p.images })) } } : {}) };
      }),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load your portal" });
  }
});

const detailsUpload = (req: Request, res: Response, next: NextFunction) =>
  upload.fields([{ name: "logo", maxCount: 1 }, { name: "clinicPhoto", maxCount: 1 }, { name: "photos", maxCount: MAX_PHOTOS }])(req, res, (err: unknown) => {
    if (!err) return next();
    const code = (err as { code?: string })?.code;
    res.status(400).json({ error: code === "LIMIT_FILE_SIZE" ? "One of those photos is very large. Please pick a smaller one." : "I could not receive those uploads. Please try again with fewer photos at once." });
  });

const DETAIL_TEXT = ["scrubs", "clinicName", "clinicianName", "handle", "area", "howStarted", "hobbies", "pets", "why", "threeWords", "personality", "passion", "mum", "age", "bizType"];

// Details are filled in once. More photos can be added later (up to 20 in all), and Vanessa can reopen the form for a member.
// Monzo cannot tell the site when someone pays, so the member taps "I have paid" and Vanessa gets an email to check her Monzo feed.
const paidHits = new Map<string, number>();
router.post("/club/me/:token/paid", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || (m.status !== "active" && m.status !== "pending")) { res.status(404).json({ error: "That link does not look right." }); return; }
    const last = paidHits.get(m.id) ?? 0;
    if (Date.now() - last < 60_000) { res.json({ ok: true }); return; }
    paidHits.set(m.id, Date.now());
    void emailVanessa(`Club: ${m.name} says she has paid`, [
      `${m.name} has pressed "I have paid" for the £${m.plan === "69" ? "69" : "275"} club.`,
      `Please check your Monzo Business feed for a payment with her name (${m.name}) as the reference.`,
      `Email: ${m.email}`,
      `WhatsApp: ${m.phone ?? ""}`,
      `Details form filled in: ${m.details_done ? "yes" : "not yet"}`,
      "",
      appLink("/club-admin"),
    ]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

router.post("/club/me/:token/details", detailsUpload, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || (m.status !== "active" && m.status !== "pending")) {
      res.status(403).json({ error: "This link is not active" });
      return;
    }
    const files = (req.files ?? {}) as { [f: string]: Express.Multer.File[] };
    const all = [...(files.logo ?? []), ...(files.clinicPhoto ?? []), ...(files.photos ?? [])];
    if (all.some((f) => !IMAGE_MIMES.includes(f.mimetype))) {
      res.status(400).json({ error: "Please upload JPG, PNG or WebP images" });
      return;
    }
    const b = req.body as Record<string, string>;
    const logoKey = files.logo?.[0] ? await saveSampleFile(files.logo[0].buffer, files.logo[0].mimetype, "logo") : "";
    const clinicKey = files.clinicPhoto?.[0] ? await saveSampleFile(files.clinicPhoto[0].buffer, files.clinicPhoto[0].mimetype, "clinic") : "";
    const room = Math.max(0, MAX_PHOTOS - (m.photo_urls?.length ?? 0));
    const newPhotos: string[] = [];
    for (const f of (files.photos ?? []).slice(0, room)) newPhotos.push(`/api/free-samples/media/${await saveSampleFile(f.buffer, f.mimetype, "photo")}`);
    const photoUrls = [...(m.photo_urls ?? []), ...newPhotos];

    if (!m.details_done) {
      const details: Record<string, any> = {};
      for (const k of DETAIL_TEXT) details[k] = str(b[k], k === "why" || k === "howStarted" || k === "passion" ? 900 : 300);
      details.mainHex = hex(b.mainHex, "#d6006f");
      details.accentHex = hex(b.accentHex, "#1a1a1a");
      details.font = /^[a-z0-9-]{1,40}$/.test(str(b.font, 40)) ? str(b.font, 40) : "hatcher";
      const lines = (v: unknown, n: number) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, n);
      details.facts = lines(b.facts, 5);
      details.favTreatments = lines(b.favTreatments, 5);
      details.treatmentsOffered = lines(b.treatmentsOffered, 60);
      if (!details.clinicName || !details.clinicianName || !details.handle || !details.area) {
        res.status(400).json({ error: "Please add your name, clinic name, Instagram handle and area" });
        return;
      }
      if (photoUrls.length < 1 && !newPhotos.length) {
        res.status(400).json({ error: "Please add at least one photo of you. Up to 20 is lovely, the more I have the better your posts look" });
        return;
      }
      await db.execute(sql`UPDATE club_members SET details = ${JSON.stringify(details)}::jsonb, details_done = true,
        logo_url = ${logoKey ? `/api/free-samples/media/${logoKey}` : m.logo_url}, clinic_photo_url = ${clinicKey ? `/api/free-samples/media/${clinicKey}` : m.clinic_photo_url},
        photo_urls = ${JSON.stringify(photoUrls)}::jsonb WHERE id = ${m.id}`);
      void emailVanessa(`Club: ${m.name} has filled in her details`, [`${m.name} (${m.plan === "69" ? "£69" : "£275"} club) has completed the one-off details form.${m.status === "pending" ? " She accepted your invitation and is waiting for you to approve her." : ""}`, "", appLink("/club-admin")]);
    } else {
      // Already done: only extra photos, a new logo or a clinic photo can be added.
      await db.execute(sql`UPDATE club_members SET photo_urls = ${JSON.stringify(photoUrls)}::jsonb,
        logo_url = ${logoKey ? `/api/free-samples/media/${logoKey}` : m.logo_url}, clinic_photo_url = ${clinicKey ? `/api/free-samples/media/${clinicKey}` : m.clinic_photo_url} WHERE id = ${m.id}`);
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    req.log?.error({ err }, "club details failed");
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

// Each month: four treatments and the rest of the posts. Open until a week before billing.
// The member chooses her posts from the full set. Once sent it cannot be changed, and she has 48 hours from approval.
router.post("/club/me/:token/pick", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || m.status !== "active") { res.status(403).json({ error: "This link is not active" }); return; }
    const b = req.body as { month?: string; picks?: number[] };
    const month = str(b.month, 10);
    const x = (await db.execute(sql`SELECT id, content, approved_at FROM club_months WHERE member_id = ${m.id} AND month = ${month} AND status = 'approved'`)).rows[0] as any;
    if (!x) { res.status(404).json({ error: "That month is not ready yet" }); return; }
    const cap = capsFor(m).posts;
    const ps = pickState(x.content, x.approved_at, cap);
    if (ps.phase !== "choose") { res.status(409).json({ error: "Your posts for this month are already chosen" }); return; }
    const valid = new Set(ps.all.map((p: any) => Number(p.n)));
    const picks = [...new Set((Array.isArray(b.picks) ? b.picks : []).map(Number))].filter((n) => valid.has(n));
    if (picks.length !== cap) { res.status(400).json({ error: `Please choose exactly ${cap} posts. You have chosen ${picks.length}.` }); return; }
    const content = { ...(x.content ?? {}), picked: picks, pickedAt: new Date().toISOString() };
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, updated_at = now() WHERE id = ${x.id}`);
    void emailVanessa(`Club: ${m.name} has chosen her ${cap} posts for ${month}`, [`${m.name} picked posts ${picks.sort((a, c) => a - c).join(", ")}.`, "The rest are in her bank on Club Build."]);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save your choice" });
  }
});

// A member rates each post out of 5 with a reason, so the next month can be improved. Saved against the approved month.
router.post("/club/me/:token/feedback", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || m.status !== "active") { res.status(403).json({ error: "This link is not active" }); return; }
    const b = req.body as { month?: string; posts?: { n?: number; rating?: number; reason?: string }[]; overall?: string };
    const month = str(b.month, 10);
    const x = (await db.execute(sql`SELECT id FROM club_months WHERE member_id = ${m.id} AND month = ${month} AND status = 'approved'`)).rows[0] as any;
    if (!x) { res.status(404).json({ error: "That month is not ready yet" }); return; }
    const posts = (Array.isArray(b.posts) ? b.posts : []).slice(0, 40).map((p) => ({ n: Number(p.n) || 0, rating: Math.min(5, Math.max(0, Math.round(Number(p.rating) || 0))), reason: noDashes(p.reason).slice(0, 600) })).filter((p) => p.n && (p.rating || p.reason));
    const fb = { posts, overall: noDashes(b.overall).slice(0, 1200), at: new Date().toISOString() };
    await db.execute(sql`UPDATE club_months SET feedback = ${JSON.stringify(fb)}::jsonb, updated_at = now() WHERE id = ${x.id}`);
    void emailVanessa(`Club feedback: ${m.name} rated ${month}`, [`${m.name} has left feedback on ${month}.`, "", ...posts.map((p) => `Post ${p.n}: ${p.rating}/5 ${p.reason}`), ...(fb.overall ? ["", `Overall: ${fb.overall}`] : [])]);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save your feedback" });
  }
});

router.post("/club/me/:token/choices", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || m.status !== "active") {
      res.status(403).json({ error: "This link is not active" });
      return;
    }
    if (!m.details_done) {
      res.status(400).json({ error: "Please fill in your details first" });
      return;
    }
    const { date, month } = nextBilling(m.billing_day);
    const cur = await getOrMakeMonth(m.id, month);
    const cutOff = date.getTime() - CUT_OFF_DAYS * 86400000 + 86400000;
    if (cur.status !== "choosing" || Date.now() > cutOff) {
      res.status(400).json({ error: "This month's choices have closed because I have started on your content. Message me if something has changed." });
      return;
    }
    const caps = capsFor(m);
    const b = req.body as { treatments?: unknown; note?: unknown };
    const treatments = (Array.isArray(b.treatments) ? b.treatments : []).map((t) => str(t, 60)).filter(Boolean).slice(0, caps.treatmentPosts);
    // The other posts are chosen by Vanessa, so whatever she has set is kept.
    const picks = Array.isArray(cur.choices?.picks) ? cur.choices.picks : [];
    const firstTime = !cur.choices?.savedAt;
    await db.execute(sql`UPDATE club_months SET choices = ${JSON.stringify({ treatments, picks, note: str(b.note, 500), savedAt: cur.choices?.savedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() })}::jsonb, updated_at = now() WHERE id = ${cur.id}`);
    let buildLink = appLink("/club-admin");
    try {
      const rid = await ensureBuildRequest(cur.id);
      if (rid) buildLink = appLink(`/club-builder?id=${rid}`);
    } catch (err) {
      logger.warn({ err }, "Club build request failed");
    }
    void emailVanessa(`${firstTime ? "" : "UPDATED: "}MONTHLY CONTENT SUBMITTED FOR ${m.name.toUpperCase()}`, [
      `*** ${firstTime ? "" : "UPDATED "}MONTHLY CONTENT SUBMITTED FOR ${m.name.toUpperCase()} ***`,
      "",
      `${m.details?.clinicName || m.name} (${m.plan === "69" ? "£69" : "£275"} club), ${month}`,
      `Treatments: ${treatments.join(", ") || "none chosen"}`,
      ...(str(b.note, 500) ? [`Their note: ${str(b.note, 500)}`] : []),
      "",
      "Create the content here:",
      buildLink,
      "",
      "Their month, reels and approval queue:",
      appLink("/club-admin"),
    ]);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save your choices" });
  }
});

// ---------------------------------------------------------------------------
// Reel hooks and scripts. Some are tailored to the treatments she chose, the rest are written to start conversations.
// ---------------------------------------------------------------------------

type Reel = { n: number; kind: "treatment" | "engagement"; theme?: string; treatment?: string; hook: string; onScreen: string; script: string };

type Story = { n: number; text: string; poll: { question: string; a: string; b: string } };

// Twelve story ideas a month, each with a suggested poll sticker she can copy straight onto Instagram.
async function writeStories(m: Member, month: MonthRow): Promise<Story[]> {
  const d = m.details;
  const treatments: string[] = (month.choices?.treatments as string[]) ?? [];
  const profile = [
    `Clinician: ${d.clinicianName || m.name}`, `Clinic: ${d.clinicName || ""}`, `Area: ${d.area || ""}`,
    d.personality && `Her personality and how she talks: ${d.personality}`, d.hobbies && `Hobbies: ${d.hobbies}`, d.pets && `Pets: ${d.pets}`,
    treatments.length && `Treatments she is promoting this month: ${treatments.join(", ")}`,
    month.choices?.note && `Her note for this month (use it for theme and timing only, never state results, percentages, satisfaction or claims about any product): ${str(month.choices.note, 500)}`,
  ].filter(Boolean).join("\n");
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.95,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${HOUSE_VOICE}\n${HOUSE_RULES}\n\nYou write Instagram stories for a UK aesthetics clinician, in HER first person. Write exactly ${capsFor(m).stories}. Each has a short line for the story itself (max 25 words, warm, funny, never salesy) and a suggested poll sticker: a question under 12 words with two short answers (max 3 words each) that women over 35 will tap without thinking. Spread them: a few about her life and the clinic, a few about common beauty myths, a few light this or that questions, and at most 3 that nudge towards her treatments. Never mention a website, Botox, anti-wrinkle or prescription treatments, never promise a result, no emojis, no em dashes, no negative parallelism, no AI patter. British spelling. Return JSON: {"stories":[{"text":string,"question":string,"a":string,"b":string}]}` },
      { role: "user", content: profile },
    ],
  });
  let list: any[] = [];
  try { list = JSON.parse(r.choices[0]?.message?.content ?? "{}").stories ?? []; } catch { list = []; }
  return list.slice(0, capsFor(m).stories).map((x, i) => ({ n: i + 1, text: noDashes(x.text).slice(0, 200), poll: { question: noDashes(x.question).slice(0, 90), a: noDashes(x.a).slice(0, 24), b: noDashes(x.b).slice(0, 24) } })).filter((x) => x.text && x.poll.question);
}

async function writeReels(m: Member, month: MonthRow): Promise<Reel[]> {
  const caps = capsFor(m);
  const d = m.details;
  const treatments: string[] = (month.choices?.treatments as string[]) ?? [];
  const tailored = treatments.length ? caps.tailoredReels : 0;
  const engagement = caps.reels - tailored;
  const out: Reel[] = [];
  const profile = [
    `Clinician: ${d.clinicianName || m.name}`, `Clinic: ${d.clinicName || ""}`, `Area: ${d.area || ""}`,
    d.howStarted && `How she got into aesthetics: ${d.howStarted}`, d.why && `Why she loves it: ${d.why}`, d.personality && `Her personality and how she talks: ${d.personality}`,
    d.threeWords && `Three words for her: ${d.threeWords}`, d.hobbies && `Hobbies: ${d.hobbies}`, d.pets && `Pets: ${d.pets}`, d.passion && `Passion: ${d.passion}`,
    (d.facts ?? []).length && `Things people might not know: ${(d.facts ?? []).join("; ")}`,
    month.choices?.note && `Her note for this month (use it for theme and timing only, never state results, percentages, satisfaction or claims about any product): ${str(month.choices.note, 500)}`,
  ].filter(Boolean).join("\n");

  const ask = async (kind: "treatment" | "engagement", count: number, startAt: number, focus: string) => {
    const brief = kind === "treatment"
      ? `Write ${count} reel hooks with scripts that are about these treatments: ${focus}. Spread them evenly across the treatments. Each is a different angle: a myth, a question she is too shy to ask, what the day after really feels like, a behind the scenes moment, a cheeky consultation confession. Set "treatment" to the treatment the reel is about.`
      : `Write ${count} reel hooks with scripts that start conversations and make women over 35 stop scrolling, comment and follow. These are NOT about a treatment. Use her life, her honest opinions, things people get wrong, small confessions, the quiet funny truths of running a clinic, and questions that are easy to answer in the comments. Make every one different in shape (a confession, a question, a hot take, a story, a list of three, a "things I will never say in a consultation"). Set "treatment" to an empty string.`;
    const r = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.95,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${HOUSE_VOICE}\n${HOUSE_RULES}\n\nYou write short form video reels for a UK aesthetics clinician, in HER first person, as her. Hooks must stop the scroll in the first three seconds, be unique and not the kind of line seen all over the industry. Scripts are 40 to 70 words, spoken, conversational, ending on a question that invites a comment. Never mention a website, never mention Botox, anti-wrinkle or prescription treatments, never promise a result, never use emojis, never use em dashes, no negative parallelism, no AI patter, no "here's the thing". Use British spelling. Do not use the same opening words twice.\nReturn JSON: {"reels":[{"treatment":string,"hook":string,"onScreen":string (max 8 words of text for the screen),"script":string}]}`,
        },
        { role: "user", content: `${profile}\n\n${brief}` },
      ],
    });
    let list: any[] = [];
    try {
      list = JSON.parse(r.choices[0]?.message?.content ?? "{}").reels ?? [];
    } catch {
      list = [];
    }
    list.slice(0, count).forEach((x, i) => out.push({ n: startAt + i, kind, treatment: kind === "treatment" ? str(x.treatment, 60) : undefined, hook: noDashes(x.hook).slice(0, 220), onScreen: noDashes(x.onScreen).slice(0, 80), script: noDashes(x.script).slice(0, 900) }));
  };
  if (tailored) await ask("treatment", tailored, 1, treatments.join(", "));
  // Engagement reels in batches of ten so the list stays varied.
  let start = out.length + 1;
  for (let left = engagement; left > 0; left -= 10) {
    const n = Math.min(10, left);
    await ask("engagement", n, start, "");
    start = out.length + 1;
  }
  return out.filter((r) => r.hook && r.script);
}

// ---------------------------------------------------------------------------
// The four AI photos a month: her David Bailey black and white studio portraits, two on a black backdrop and two on white.
// ---------------------------------------------------------------------------

async function makeAiShots(m: Member, monthId: string): Promise<void> {
  try {
    await db.execute(sql`UPDATE club_months SET ai_status = 'working', ai_error = '' WHERE id = ${monthId}`);
    // The reference photo is the one Vanessa picked for this member, or their first photo.
    const photos = m.photo_urls ?? [];
    const src = (m.ref_photo_url && photos.includes(m.ref_photo_url) ? m.ref_photo_url : photos[0]) ?? "";
    const key = src.replace("/api/free-samples/media/", "");
    if (!key) throw new Error("This member has not uploaded a photo of themselves yet");
    const buf = await readKey(key);
    // Up to two more of her own photos go in as extra references so the face comes out closer to her.
    const extraBufs: Buffer[] = [];
    for (const u of photos.filter((x) => x !== src).slice(0, 2)) {
      try { extraBufs.push(await readKey(u.replace("/api/free-samples/media/", ""))); } catch { /* skip */ }
    }
    const [source] = await db.insert(aiSourcePhotosTable).values({ clientName: m.details?.clinicName || m.name, photoUrl: `/api/media/${key}`, notes: "club" }).returning();
    // Her David Bailey range from the AI Photo Studio: hyper realistic black and white editorial portraits, strict face lock.
    // Four different shots picked at random, with the backdrop alternating black, white, black, white so every member gets a mix.
    const pool = ["bl-01", "bl-02", "bl-03", "bl-04", "bl-06", "bl-07", "bl-08"].map((x) => `cbw-${x}`);
    const take = (ids: string[]) => ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
    const backdrops = ["#000000", "#ffffff", "#000000", "#ffffff"];
    const cfgs: any[] = backdrops.map((colour) => ({ id: take(pool), aspectRatio: "3:4", promptVars: { colour } }));
    const results = new Map<string, string>();
    const reasons: string[] = [];
    let pending = cfgs;
    // The worker already retries each picture, so one round keeps the AI credits down.
    for (let round = 0; round < 1 && pending.length > 0; round++) {
      const jobId = `club_${Date.now()}_${uuid().slice(0, 8)}`;
      createJob(jobId, pending.map((c) => c.id));
      await processPortraitJob(jobId, buf, source.id, m.details?.clinicName || m.name, pending as any, extraBufs);
      for (const c of getJob(jobId)?.cards ?? []) {
        if (c.status === "success" && c.outputImageUrl) results.set(c.scenarioId, c.outputImageUrl);
        else if (c.failureReason) reasons.push(`${c.scenarioId}: ${c.failureReason}`);
      }
      pending = pending.filter((c) => !results.has(c.id));
      if (pending.length) await sleep(3000);
    }
    const urls = cfgs.map((c) => results.get(c.id)).filter((u): u is string => !!u);
    await db.execute(sql`UPDATE club_months SET ai_urls = ${JSON.stringify(urls)}::jsonb, ai_status = ${urls.length ? "ready" : "failed"}, ai_error = ${urls.length === cfgs.length ? "" : reasons.slice(-3).join(" | ").slice(0, 500)}, updated_at = now() WHERE id = ${monthId}`);
    // The builder reads from its own request row, so hand the photos over there too.
    await db.execute(sql`UPDATE tenfree_requests SET ai_urls = ${JSON.stringify(urls)}::jsonb, ai_status = ${urls.length ? "ready" : "failed"} WHERE id = ${`club-${monthId}`}`).catch(() => undefined);
  } catch (err) {
    logger.warn({ err }, "Club AI shots failed");
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db.execute(sql`UPDATE club_months SET ai_status = 'failed', ai_error = ${msg} WHERE id = ${monthId}`).catch(() => undefined);
  }
}

async function prepareMonth(memberId: string, month: string): Promise<void> {
  const mr = await db.execute(sql`SELECT * FROM club_members WHERE id = ${memberId}`);
  const m = mr.rows[0] as unknown as Member | undefined;
  if (!m || m.status !== "active" || !canBuild(m)) return;
  const cur = await getOrMakeMonth(memberId, month);
  if (cur.status === "approved") return;
  await db.execute(sql`UPDATE club_months SET status = CASE WHEN status = 'choosing' THEN 'to_build' ELSE status END, reels_status = 'working', updated_at = now() WHERE id = ${cur.id}`);
  // AI studio photos are only ever made when I press the button in the club admin, so no credits are spent by surprise.
  try {
    const reels = await writeReels(m, cur);
    const stories = await writeStories(m, cur).catch((err) => { logger.warn({ err }, "Club stories failed"); return [] as Story[]; });
    const content = { ...(cur.content ?? {}), reels, stories };
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, reels_status = ${reels.length ? "ready" : "failed"}, updated_at = now() WHERE id = ${cur.id}`);
  } catch (err) {
    logger.warn({ err }, "Club reels failed");
    await db.execute(sql`UPDATE club_months SET reels_status = 'failed' WHERE id = ${cur.id}`).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Vanessa's side
// ---------------------------------------------------------------------------

// Treats a club member like a client: makes (once) her own client page with all the tools, named "<clinic> (club)", and returns its id. The hub's Club tab opens it from her tile.
router.post("/club/members/:id/client-page", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as (Member & { preset_id?: number | null }) | undefined;
    if (!m) { res.status(404).json({ error: "Member not found" }); return; }
    if (m.preset_id) { res.json({ id: m.preset_id }); return; }
    const d = m.details ?? {};
    const name = `${str(d.clinicName, 60) || m.name} (club)`;
    const accent = hex(d.accentHex, "") || hex(d.mainHex, "") || "#d6006f";
    const row = await db.insert(clientPresetsTable).values({
      name, logoUrl: m.logo_url || null, clientPhotoUrl: m.clinic_photo_url || (m.photo_urls ?? [])[0] || null, accentColor: accent, seoArea: str(d.area, 80) || null,
    } as any).returning().catch(async (err: any) => {
      if (err?.code === "23505" || err?.cause?.code === "23505") return (await db.select().from(clientPresetsTable)).filter((p: any) => p.name === name);
      throw err;
    });
    const id = (row as any[])[0]?.id;
    if (!id) throw new Error("Could not make her client page");
    await db.execute(sql`UPDATE club_members SET preset_id = ${id} WHERE id = ${m.id}`);
    res.json({ id });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not make her client page" });
  }
});

// Christmas reels for every active member: ten hooks with scripts each, in her own voice, added to her latest month. Nothing about treatments, results or claims.
async function writeChristmasReels(m: Member, month: MonthRow, count: number): Promise<Reel[]> {
  const d = m.details ?? {};
  const profile = [
    `Clinician: ${d.clinicianName || m.name}`, `Clinic: ${d.clinicName || ""}`, `Area: ${d.area || ""}`,
    d.personality && `Her personality and how she talks: ${d.personality}`, d.threeWords && `Three words for her: ${d.threeWords}`,
    d.hobbies && `Hobbies: ${d.hobbies}`, d.pets && `Pets: ${d.pets}`, d.passion && `Passion: ${d.passion}`, (d.facts ?? []).length && `Things people might not know: ${(d.facts ?? []).join("; ")}`,
    month.choices?.note && `Her note this month (theme and timing only, never state results or claims): ${str(month.choices.note, 500)}`,
  ].filter(Boolean).join("\n");
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.95,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${HOUSE_VOICE}\n${HOUSE_RULES}\n\nYou write short form video reels for a UK aesthetics clinician, in HER first person, as her. Every reel is Christmas related but NOT about a treatment: the chaos of December, the party season, family, work do's, gifts, the clinic in the run up to Christmas, small confessions and funny truths, questions that are easy to answer in the comments. Hooks must stop the scroll in three seconds, be unique and not the kind of line seen all over the industry. Scripts are 40 to 70 words, spoken, conversational, ending on a question that invites a comment. Never mention a website, never mention Botox, anti-wrinkle or prescription treatments, never promise a result, never use emojis, never use em dashes, no negative parallelism, no AI patter, no "here's the thing". Use British spelling. Every one a different shape (a confession, a question, a hot take, a story, a list of three). Do not use the same opening words twice.\nReturn JSON: {"reels":[{"hook":string,"onScreen":string,"script":string}]}` },
      { role: "user", content: `${profile}\n\nWrite ${count} Christmas reels.` },
    ],
  });
  let list: any[] = [];
  try { list = JSON.parse(r.choices[0]?.message?.content ?? "{}").reels ?? []; } catch { list = []; }
  return list.slice(0, count).map((x) => ({ n: 0, kind: "engagement" as const, theme: "christmas", hook: noDashes(x.hook).slice(0, 220), onScreen: noDashes(x.onScreen).slice(0, 80), script: noDashes(x.script).slice(0, 900) })).filter((x) => x.hook && x.script);
}

router.post("/club/reels/christmas", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const count = Math.min(15, Math.max(1, Number((req.body as any)?.count) || 10));
    const members = (await db.execute(sql`SELECT * FROM club_members WHERE status = 'active'`)).rows as unknown as Member[];
    const who = members.filter((m) => canBuild(m));
    res.json({ ok: true, members: who.map((m) => m.name), count });
    void (async () => {
      for (const m of who) {
        try {
          const x = (await db.execute(sql`SELECT * FROM club_months WHERE member_id = ${m.id} ORDER BY month DESC LIMIT 1`)).rows[0] as unknown as MonthRow | undefined;
          if (!x) continue;
          const content = { ...(x.content ?? {}) } as Record<string, any>;
          const have: Reel[] = (content.reels as Reel[]) ?? [];
          if (have.some((r) => r.theme === "christmas")) continue;
          const xmas = await writeChristmasReels(m, x, count);
          if (!xmas.length) continue;
          content.reels = [...have, ...xmas].map((r, i) => ({ ...r, n: i + 1 }));
          await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, reels_status = 'ready', updated_at = now() WHERE id = ${x.id}`);
        } catch (err) { logger.warn({ err, member: m.name }, "Christmas reels failed"); }
      }
    })();
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start" });
  }
});

// Reads the member's note for the month and pulls out a theme (Christmas, say) and any new treatment on its way, with a safe description that makes no claims.
router.post("/club/note/analyse", requireAuth, async (req: Request, res: Response) => {
  const empty = { theme: "", newTreatment: "", headline: "", safeDetail: "" };
  try {
    const note = str((req.body as any)?.note, 500);
    if (!note) { res.json(empty); return; }
    const r = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You read a note a UK aesthetics clinician wrote about her month and return JSON: {"theme": string, "newTreatment": string, "headline": string, "safeDetail": string}.
- theme: a short seasonal or topical theme if the note has one (for example "Christmas"), otherwise "".
- newTreatment: the name of a new treatment or product she says is coming to her clinic, otherwise "". Name only, no description.
- headline: if newTreatment is set, a curious, warm cover line of at most 9 words teasing that something new is on its way, never naming results, never a claim, no dashes, no exclamation marks, no emojis. Otherwise "".
- safeDetail: if newTreatment is set, one or two plain sentences describing it using only soft, general wording from the note (for example hydrating and moisturising). REMOVE every result claim, percentage, satisfaction figure, comparison, guarantee or medical promise. Say "may" and "many people find". Otherwise "".
British English. No em dashes.` },
        { role: "user", content: note },
      ],
    });
    const j = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    res.json({ theme: noDashes(j.theme).slice(0, 60), newTreatment: noDashes(j.newTreatment).slice(0, 60), headline: noDashes(j.headline).slice(0, 90), safeDetail: noDashes(j.safeDetail).slice(0, 400) });
  } catch (err: unknown) {
    req.log?.error({ err }, "club note analyse failed");
    res.json(empty);
  }
});

// Makes a portal only member (once per name), active straight away, and joins her to her existing client page so what Vanessa sends to that client's Client Bank turns up on her page.
async function makePortalMember(name: string, email: string, clientName: string): Promise<{ id: string; slug: string; clientLinked: boolean; existed: boolean }> {
  const found = (await db.execute(sql`SELECT id, slug, token FROM club_members WHERE plan = 'portal' AND lower(name) = lower(${name}) LIMIT 1`)).rows[0] as any;
  const presets = (await db.select().from(clientPresetsTable)) as any[];
  const want = clientName.trim().toLowerCase();
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const preset = presets.find((p) => String(p.name ?? "").trim().toLowerCase() === want)
    ?? presets.find((p) => squash(String(p.name ?? "")) === squash(clientName))
    ?? presets.find((p) => squash(clientName).length >= 6 && squash(String(p.name ?? "")).includes(squash(clientName)));
  if (found) {
    if (preset) await db.execute(sql`UPDATE club_members SET preset_id = ${preset.id} WHERE id = ${found.id} AND preset_id IS NULL`);
    return { id: found.id, slug: found.slug || found.token, clientLinked: !!preset, existed: true };
  }
  const id = uuid();
  const token = randomBytes(18).toString("base64url");
  const slugNew = makeSlug(name);
  await db.execute(sql`INSERT INTO club_members (id, token, slug, plan, status, name, email, billing_day, details_done) VALUES (${id}, ${token}, ${slugNew}, 'portal', 'active', ${name}, ${email}, 1, true)`);
  if (preset) await db.execute(sql`UPDATE club_members SET preset_id = ${preset.id} WHERE id = ${id}`);
  return { id, slug: slugNew, clientLinked: !!preset, existed: false };
}

// Kelly (ENHANCED) and Julie Pawson Aesthetics (JPA) collect their work from a portal only page, set up once on the first start after this was added.
export async function seedPortalMembers(): Promise<void> {
  try {
    await ensureTables();
    for (const [name, client] of [["Kelly", "ENHANCED"], ["Julie Pawson Aesthetics", "Julie Pawson Aesthetics LTD"], ["Dermaluxe", "Dermaluxe"]] as const) {
      const r = await makePortalMember(name, "", client);
      logger.info({ name, clientLinked: r.clientLinked, existed: r.existed }, "Portal member ready");
    }
  } catch (err) {
    logger.warn({ err }, "Could not set up the portal members");
  }
}

router.post("/club/members", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { name?: string; email?: string; plan?: string; billingDay?: number; clientName?: string };
    const plan = b.plan === "222" ? "222" : b.plan === "69" ? "69" : b.plan === "portal" ? "portal" : null;
    const name = str(b.name, 100);
    if (!plan || !name) {
      res.status(400).json({ error: "A name and a plan (69 or 222) are needed" });
      return;
    }
    if (plan === "portal") {
      const made = await makePortalMember(name, str(b.email, 160), str(b.clientName, 100) || name);
      res.json({ id: made.id, link: appLink(`/club/${made.slug}`), clientLinked: made.clientLinked });
      return;
    }
    const limit = PLACES[plan];
    const n = Number((await db.execute(sql`SELECT count(*)::int AS n FROM club_members WHERE plan = ${plan} AND status IN ('active', 'pending')`)).rows[0]?.n ?? 0);
    if (n >= limit && !(req.body as any).overrideLimit) {
      res.status(409).json({ error: `The ${plan === "69" ? "£69" : "£275"} club is full (${limit} places). Tick "allow an extra place" if you want to go over.`, full: true });
      return;
    }
    const id = uuid();
    const token = randomBytes(18).toString("base64url");
    const slugNew = makeSlug(name);
    const billingDay = Math.min(28, Math.max(1, Number(b.billingDay) || new Date().getUTCDate()));
    await db.execute(sql`INSERT INTO club_members (id, token, slug, plan, name, email, billing_day) VALUES (${id}, ${token}, ${slugNew}, ${plan}, ${name}, ${str(b.email, 160)}, ${billingDay})`);
    res.json({ id, link: appLink(`/club/${slugNew}`) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not add the member" });
  }
});

router.get("/club/members", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const ms = (await db.execute(sql`SELECT * FROM club_members ORDER BY created_at DESC`)).rows as unknown as (Member & { slug?: string | null })[];
    // Anyone without a friendly link yet gets one now.
    for (const m of ms) if (!m.slug) { m.slug = makeSlug(m.name); await db.execute(sql`UPDATE club_members SET slug = ${m.slug} WHERE id = ${m.id}`); }
    const months = (await db.execute(sql`SELECT * FROM club_months ORDER BY month DESC`)).rows as unknown as MonthRow[];
    res.json({
      members: ms.map((m) => {
        const { date, month } = nextBilling(m.billing_day);
        return {
          id: m.id, name: m.name, email: m.email, phone: m.phone ?? "", agreedName: m.agreed_name ?? "", agreedAt: m.agreed_at ?? null, plan: m.plan, status: m.status, billingDay: m.billing_day, detailsDone: m.details_done, canBuild: canBuild(m), details: m.details,
          link: appLink(`/club/${m.slug || m.token}`), nextBilling: ymd(date), daysToBilling: daysUntil(date), cycle: month, photoCount: (m.photo_urls ?? []).length, hasClinicPhoto: !!m.clinic_photo_url, photoUrls: m.photo_urls ?? [], logoUrl: m.logo_url ?? "", clinicPhotoUrl: m.clinic_photo_url ?? "", refPhotoUrl: m.ref_photo_url ?? "", welcomePhotoUrl: m.welcome_photo_url ?? "",
          months: months.filter((x) => x.member_id === m.id).map((x) => ({
            id: x.id, month: x.month, status: x.status, choices: x.choices, reelCount: ((x.content?.reels as any[]) ?? []).length, postCount: ((x.content?.posts as any[]) ?? []).length,
            aiUrls: x.ai_urls, aiStatus: x.ai_status, aiError: x.ai_error ?? "", reelsStatus: x.reels_status, note: x.admin_note,
            feedback: (x as any).feedback ?? {}, pick: (() => { const ps = pickState(x.content, x.approved_at, capsFor(m).posts); return { phase: ps.phase, picked: ps.picked, deadline: ps.deadline, cap: ps.cap, total: ps.all.length }; })(),
            bank: (() => { const ps = pickState(x.content, x.approved_at, capsFor(m).posts); const left = ps.phase === "done" && ps.all.length > ps.cap ? ps.all.filter((p: any) => !ps.picked.includes(p.n)) : []; return [...(((x.content?.bank as any[]) ?? [])), ...left]; })(), postsList: ((x.content?.posts as any[]) ?? []).map((p: any) => ({ n: p.n, label: p.label, image: (p.images ?? [])[0] ?? "" })),
          })),
        };
      }),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load the members" });
  }
});

router.patch("/club/members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { status?: string; billingDay?: number; email?: string; reopenDetails?: boolean; token?: string };
    const id = String(req.params.id);
    // A short friendly link word, for a member who has asked for one (letters, numbers and dashes only, and never one that is already taken).
    if (typeof b.token === "string" && /^[a-z0-9-]{6,60}$/.test(b.token)) {
      const taken = (await db.execute(sql`SELECT id FROM club_members WHERE token = ${b.token} AND id <> ${id}`)).rows.length;
      if (taken) { res.status(409).json({ error: "That link word is already taken" }); return; }
      await db.execute(sql`UPDATE club_members SET token = ${b.token} WHERE id = ${id}`);
    }
    if (b.status === "cancelled") await db.execute(sql`UPDATE club_members SET status = 'cancelled', cancelled_at = now() WHERE id = ${id}`);
    if (b.status === "active") await db.execute(sql`UPDATE club_members SET status = 'active', cancelled_at = NULL WHERE id = ${id}`);
    if (b.billingDay) await db.execute(sql`UPDATE club_members SET billing_day = ${Math.min(28, Math.max(1, Number(b.billingDay)))} WHERE id = ${id}`);
    if (typeof b.email === "string") await db.execute(sql`UPDATE club_members SET email = ${str(b.email, 160)} WHERE id = ${id}`);
    if (b.reopenDetails) await db.execute(sql`UPDATE club_members SET details_done = false WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not update" });
  }
});

// Remove a cancelled member for good, with all their months. Active or pending members must be cancelled first.
router.delete("/club/members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const m = (await db.execute(sql`SELECT id, status FROM club_members WHERE id = ${id}`)).rows[0] as unknown as { id: string; status: string } | undefined;
    if (!m) { res.status(404).json({ error: "Member not found" }); return; }
    if (m.status !== "cancelled") { res.status(409).json({ error: "Cancel them first, then you can remove them for good" }); return; }
    await db.execute(sql`DELETE FROM club_months WHERE member_id = ${id}`);
    await db.execute(sql`DELETE FROM club_members WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not remove" });
  }
});

// Start a month now (reel hooks, scripts and AI photos), without waiting for the five day mark.
router.put("/club/members/:id/reference", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as Member | undefined;
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const url = str((req.body as any)?.url, 400);
    if (url && !(m.photo_urls ?? []).includes(url)) {
      res.status(400).json({ error: "That is not one of this member's photos" });
      return;
    }
    await db.execute(sql`UPDATE club_members SET ref_photo_url = ${url} WHERE id = ${m.id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save" });
  }
});

// The photo that sits beside "Welcome back" on a member's front page. Vanessa uploads it for them (or removes it).
router.put("/club/members/:id/welcome-photo", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as Member | undefined;
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const f = req.file;
    if (f && !IMAGE_MIMES.includes(f.mimetype)) {
      res.status(400).json({ error: "Please use a JPG, PNG or WebP image" });
      return;
    }
    let url = m.welcome_photo_url ?? "";
    if ((req.body as any)?.remove === "1") url = "";
    if (f) url = `/api/free-samples/media/${await saveSampleFile(f.buffer, f.mimetype, "welcome")}`;
    await db.execute(sql`UPDATE club_members SET welcome_photo_url = ${url} WHERE id = ${m.id}`);
    res.json({ ok: true, url });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save" });
  }
});

// Vanessa adds photos of a member herself, for someone who has not uploaded any. They join the member's own photos (up to 20 in all).
router.post("/club/members/:id/photos", requireAuth, upload.array("images", 20), async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as Member | undefined;
    if (!m) { res.status(404).json({ error: "Member not found" }); return; }
    const files = ((req.files ?? []) as Express.Multer.File[]).filter((f) => IMAGE_MIMES.includes(f.mimetype));
    if (!files.length) { res.status(400).json({ error: "Please choose JPG, PNG or WebP images" }); return; }
    const room = Math.max(0, MAX_PHOTOS - (m.photo_urls?.length ?? 0));
    if (!room) { res.status(400).json({ error: `She already has ${MAX_PHOTOS} photos, remove one first` }); return; }
    const added: string[] = [];
    for (const f of files.slice(0, room)) added.push(`/api/free-samples/media/${await saveSampleFile(f.buffer, f.mimetype, "photo")}`);
    const photoUrls = [...(m.photo_urls ?? []), ...added];
    await db.execute(sql`UPDATE club_members SET photo_urls = ${JSON.stringify(photoUrls)}::jsonb WHERE id = ${m.id}`);
    res.json({ ok: true, added: added.length, total: photoUrls.length, skipped: files.length - added.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save the photos" });
  }
});

// Makes the four studio photos for a month on its own, with the reference photo chosen for that member.
router.post("/club/months/:id/studio", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as MonthRow | undefined;
    const m = x ? ((await db.execute(sql`SELECT * FROM club_members WHERE id = ${x.member_id}`)).rows[0] as unknown as Member | undefined) : undefined;
    if (!x || !m) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (x.ai_status === "working") {
      res.status(409).json({ error: "The photos are already being made" });
      return;
    }
    void makeAiShots(m, x.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start" });
  }
});

router.post("/club/members/:id/prepare", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as Member | undefined;
    if (!m) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const month = str((req.body as any)?.month, 7) || nextBilling(m.billing_day).month;
    void prepareMonth(m.id, month);
    res.json({ ok: true, month });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start" });
  }
});

// Everything the browser build needs for one month: the member's details shaped like a ten-free request, plus the plan sizes and picks.
router.get("/club/months/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as MonthRow | undefined;
    if (!x) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${x.member_id}`)).rows[0] as unknown as Member;
    res.json({
      id: x.id, month: x.month, status: x.status, choices: x.choices, content: x.content, aiUrls: x.ai_urls, aiStatus: x.ai_status, reelsStatus: x.reels_status, note: x.admin_note,
      member: { id: m.id, name: m.name, plan: m.plan, caps: capsFor(m), details: m.details, logoUrl: m.logo_url, photoUrls: m.photo_urls, clinicPhotoUrl: m.clinic_photo_url },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load the month" });
  }
});



// The personal bit of the welcome page: Vanessa's book, recipe and rants for the month, the same for every member.
const EXTRA_KINDS = ["book", "recipe", "rants"];
router.get("/club/extras/:month", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const rows = (await db.execute(sql`SELECT * FROM club_extras WHERE month = ${String(req.params.month)}`)).rows as any[];
    res.json({ extras: rows.map((r) => ({ kind: r.kind, title: r.title, body: r.body, imageUrl: r.image_url })) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});
router.put("/club/extras/:month/:kind", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const month = String(req.params.month);
    const kind = String(req.params.kind);
    if (!/^\d{4}-\d{2}$/.test(month) || !EXTRA_KINDS.includes(kind)) {
      res.status(400).json({ error: "That month or section is not right" });
      return;
    }
    const b = req.body as Record<string, string>;
    const f = req.file;
    if (f && !IMAGE_MIMES.includes(f.mimetype)) {
      res.status(400).json({ error: "Please use a JPG, PNG or WebP image" });
      return;
    }
    const prev = (await db.execute(sql`SELECT image_url FROM club_extras WHERE month = ${month} AND kind = ${kind}`)).rows[0] as any;
    let image = prev?.image_url ?? "";
    if (b.removeImage === "1") image = "";
    if (f) image = `/api/free-samples/media/${await saveSampleFile(f.buffer, f.mimetype, `extra-${kind}`)}`;
    await db.execute(sql`INSERT INTO club_extras (month, kind, title, body, image_url) VALUES (${month}, ${kind}, ${str(b.title, 160)}, ${String(b.body ?? "").trim().slice(0, 5000)}, ${image})
      ON CONFLICT (month, kind) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, image_url = EXCLUDED.image_url, updated_at = now()`);
    res.json({ ok: true, imageUrl: image });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save" });
  }
});

// Turns a month into a build request the browser builder already understands (same photos, details, treatments and about me answers).
// Makes (or refreshes) the build request the browser builder opens for a month. Returns its id.
async function ensureBuildRequest(monthId: string): Promise<string | null> {
  await ensureTables();
  const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${monthId}`)).rows[0] as unknown as MonthRow | undefined;
  if (!x) return null;
  const m = (await db.execute(sql`SELECT * FROM club_members WHERE id = ${x.member_id}`)).rows[0] as unknown as Member;
  const d = m.details ?? {};
  const caps = capsFor(m);
  const picks = ((x.choices?.picks as any[]) ?? []);
  // The same treatment can come round again in a later month, but never with the same hook as before.
  const earlier = (await db.execute(sql`SELECT content FROM club_months WHERE member_id = ${m.id} AND id <> ${x.id}`)).rows as any[];
  const usedAngles: Record<string, number[]> = {};
  for (const e of earlier) for (const p of (e.content?.posts as any[]) ?? []) if (p.treatment && typeof p.angle === "number") (usedAngles[p.treatment] ??= []).push(p.angle);
  const hookCodes = picks.filter((p) => p.kind === "hook" && p.code).map((p) => p.code);
  const answers = {
    bizType: d.bizType || "Clinic", age: d.age || "", hobbies: d.hobbies || "", mum: d.mum || "", pets: d.pets || "", why: [d.why, d.howStarted].filter(Boolean).join(" "),
    threeWords: d.threeWords || "", personality: d.personality || "", font: d.font || "hatcher", passion: d.passion || "",
    facts: d.facts ?? [], favTreatments: d.favTreatments ?? [], howStarted: d.howStarted || "",
    monthNote: str(x.choices?.note, 500), usedAngles, clubHooks: hookCodes, clubTreatmentSlots: caps.treatmentPosts, clubAboutSlots: caps.aboutPosts, clubPostCap: caps.posts, clubHookSlots: Math.min(caps.picks - caps.aboutPosts, Math.max(hookCodes.length, caps.picks - caps.aboutPosts - picks.filter((p) => p.kind === "tool").length)) + CLUB_BANK_EXTRA,
  };
  await ensureTenFreeTable();
  const rid = `club-${x.id}`;
  const kind = `club${m.plan}`;
  const aiUrls = (x.ai_urls ?? []);
  const photos = (m.photo_urls ?? []).slice(0, 12);
  const chosen = ((x.choices?.treatments as string[]) ?? []).slice(0, 4);
  // If she has not picked her treatments yet, start from the favourites she listed on her details form.
  const treatments = chosen.length ? chosen : (((d.favTreatments as string[]) ?? []).slice(0, caps.treatmentPosts));
  const exists = (await db.execute(sql`SELECT 1 FROM tenfree_requests WHERE id = ${rid}`)).rows.length > 0;
  if (exists) {
    await db.execute(sql`UPDATE tenfree_requests SET treatments = ${JSON.stringify(treatments)}::jsonb, answers = ${JSON.stringify(answers)}::jsonb, ai_urls = ${JSON.stringify(aiUrls)}::jsonb,
      photos = ${JSON.stringify(photos)}::jsonb, logo_url = ${m.logo_url}, photo_url = ${photos[0] ?? ""}, main_hex = ${hex(d.mainHex, "#d6006f")}, accent_hex = ${hex(d.accentHex, "#1a1a1a")}, updated_at = now() WHERE id = ${rid}`);
  } else {
    await db.execute(sql`INSERT INTO tenfree_requests
      (id, email, email_key, clinic_name, clinician_name, handle, area, website, whatsapp, main_hex, accent_hex, treatments, answers, logo_url, photo_url, kind, photos, ai_urls, ai_status)
      VALUES (${rid}, ${m.email}, ${`club:${x.id}`}, ${d.clinicName || m.name}, ${d.clinicianName || m.name}, ${String(d.handle || "").replace(/^@/, "")}, ${d.area || ""}, '', '',
        ${hex(d.mainHex, "#d6006f")}, ${hex(d.accentHex, "#1a1a1a")}, ${JSON.stringify(treatments)}::jsonb, ${JSON.stringify(answers)}::jsonb, ${m.logo_url}, ${photos[0] ?? ""}, ${kind}, ${JSON.stringify(photos)}::jsonb, ${JSON.stringify(aiUrls)}::jsonb, 'ready')`);
  }
  return rid;
}

router.post("/club/months/:id/build-request", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = await ensureBuildRequest(String(req.params.id));
    if (!id) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // One button does it all: the four studio photos start as the build opens, unless they are already made or being made.
    try {
      const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as MonthRow | undefined;
      const m = x ? ((await db.execute(sql`SELECT * FROM club_members WHERE id = ${x.member_id}`)).rows[0] as unknown as Member | undefined) : undefined;
      if (x && m && x.ai_status !== "working" && !(x.ai_urls ?? []).length && (m.photo_urls ?? []).length) {
        await db.execute(sql`UPDATE tenfree_requests SET ai_status = 'working' WHERE id = ${id}`).catch(() => undefined);
        void makeAiShots(m, x.id);
      }
    } catch (err) {
      logger.warn({ err }, "Could not auto start club studio photos");
    }
    res.json({ id });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start the build" });
  }
});

// Take one of a member's photos away (a mock up, a blurry one). Also removes it from the builder's copy.
router.post("/club/months/:id/photos/remove", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${String(req.params.id)}`)).rows[0] as unknown as MonthRow | undefined;
    const m = x ? ((await db.execute(sql`SELECT * FROM club_members WHERE id = ${x.member_id}`)).rows[0] as unknown as Member | undefined) : undefined;
    if (!x || !m) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const url = str((req.body as any)?.url, 400);
    const photos = (m.photo_urls ?? []).filter((u) => u !== url);
    const ref = m.ref_photo_url === url ? "" : (m.ref_photo_url ?? "");
    await db.execute(sql`UPDATE club_members SET photo_urls = ${JSON.stringify(photos)}::jsonb, ref_photo_url = ${ref} WHERE id = ${m.id}`);
    await db.execute(sql`UPDATE tenfree_requests SET photos = ${JSON.stringify(photos.slice(0, 12))}::jsonb, photo_url = ${photos[0] ?? ""} WHERE id = ${`club-${x.id}`}`).catch(() => undefined);
    res.json({ ok: true, photos });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not remove" });
  }
});

// A post built somewhere else (Empower, November, Xmas, Unique and so on) can be attached to the month by hand.
router.post("/club/months/:id/attach-post", requireAuth, upload.array("images", 10), async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${id}`)).rows[0] as unknown as MonthRow | undefined;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!x || !files.length || files.some((f) => !IMAGE_MIMES.includes(f.mimetype))) {
      res.status(400).json({ error: "Add one or more JPG, PNG or WebP images" });
      return;
    }
    const images: string[] = [];
    for (const f of files) images.push(`/api/free-samples/media/${await saveSampleFile(f.buffer, f.mimetype, "post")}`);
    const b = req.body as Record<string, string>;
    const posts = [...(((x.content?.posts as any[]) ?? []))];
    posts.push({ n: posts.length + 1, kind: "tool", label: str(b.label, 100) || "Extra post", images, caption: noDashes(b.caption).slice(0, 1800), tags: noDashes(b.tags).slice(0, 300) });
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify({ ...(x.content ?? {}), posts })}::jsonb, updated_at = now() WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not attach" });
  }
});

// The browser build hands back the finished posts here. Finishing a bundle publishes it straight to the member's link (no approval step). Re-saving an already live month keeps its original approval time so the member's 48 hour choosing window is not reset.
router.post("/club/months/:id/posts", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${id}`)).rows[0] as unknown as MonthRow | undefined;
    if (!x) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const b = req.body as { posts?: any[]; bank?: any[]; reels?: any[] };
    const posts = (Array.isArray(b.posts) ? b.posts : []).slice(0, 24).map((p, i) => ({
      n: Number(p.n) || i + 1, kind: str(p.kind, 30), label: str(p.label, 100),
      images: (p.images ?? []).map((u: unknown) => str(u, 400)).filter(Boolean).slice(0, 10),
      caption: noDashes(p.caption).slice(0, 1800), tags: noDashes(p.tags).slice(0, 300),
      ...(p.treatment ? { treatment: str(p.treatment, 60), angle: Number(p.angle) || 0 } : {}),
    }));
    const content: Record<string, any> = { ...(x.content ?? {}), posts };
    // Posts she keeps back for later months. Never shown to the member.
    if (Array.isArray(b.bank)) content.bank = b.bank.slice(0, 40).map((p: any, i: number) => ({ n: Number(p.n) || i + 1, kind: str(p.kind, 30), label: str(p.label, 100), images: (p.images ?? []).map((u: unknown) => str(u, 400)).filter(Boolean).slice(0, 10), caption: noDashes(p.caption).slice(0, 1800), tags: noDashes(p.tags).slice(0, 300), ...(p.treatment ? { treatment: str(p.treatment, 60), angle: Number(p.angle) || 0 } : {}) }));
    if (Array.isArray(b.reels)) {
      (content as any).reels = b.reels.slice(0, 30).map((r: any, i: number) => ({ n: i + 1, kind: r.kind === "treatment" ? "treatment" : "engagement", treatment: str(r.treatment, 60), hook: noDashes(r.hook).slice(0, 220), onScreen: noDashes(r.onScreen).slice(0, 80), script: noDashes(r.script).slice(0, 900) }));
    }
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, status = 'approved', approved_at = CASE WHEN status = 'approved' AND approved_at IS NOT NULL THEN approved_at ELSE now() END, updated_at = now() WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save the posts" });
  }
});

router.post("/club/months/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`UPDATE club_months SET status = 'approved', approved_at = now(), updated_at = now() WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not approve" });
  }
});

router.post("/club/months/:id/send-back", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`UPDATE club_months SET status = 'to_build', admin_note = ${str((req.body as any)?.note, 500)}, approved_at = NULL, updated_at = now() WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not send back" });
  }
});

// Her own tweaks to a reel or an AI photo list before approving.
router.patch("/club/months/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const b = req.body as { reels?: any[]; stories?: any[]; aiUrls?: string[]; choices?: Record<string, any> };
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${id}`)).rows[0] as unknown as MonthRow | undefined;
    if (!x) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (Array.isArray(b.reels)) {
      const content = { ...(x.content ?? {}), reels: b.reels.slice(0, 30).map((r: any, i: number) => ({ n: i + 1, kind: r.kind === "treatment" ? "treatment" : "engagement", treatment: str(r.treatment, 60), hook: noDashes(r.hook).slice(0, 220), onScreen: noDashes(r.onScreen).slice(0, 80), script: noDashes(r.script).slice(0, 900) })) };
      await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, updated_at = now() WHERE id = ${id}`);
    }
    if (Array.isArray(b.stories)) {
      const content = { ...(x.content ?? {}), stories: b.stories.slice(0, 16).map((s: any, i: number) => ({ n: i + 1, text: noDashes(s.text).slice(0, 200), poll: { question: noDashes(s.poll?.question).slice(0, 90), a: noDashes(s.poll?.a).slice(0, 24), b: noDashes(s.poll?.b).slice(0, 24) } })) };
      await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, updated_at = now() WHERE id = ${id}`);
    }
    if (Array.isArray(b.aiUrls)) await db.execute(sql`UPDATE club_months SET ai_urls = ${JSON.stringify(b.aiUrls.map((u) => str(u, 400)).slice(0, 12))}::jsonb WHERE id = ${id}`);
    if (b.choices && typeof b.choices === "object") {
      await db.execute(sql`UPDATE club_months SET choices = ${JSON.stringify(b.choices)}::jsonb WHERE id = ${id}`);
      await ensureBuildRequest(id).catch(() => null);
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not update" });
  }
});

// ---------------------------------------------------------------------------
// Five days before billing: prepare the month and email Vanessa. Checked every six hours, once per member and month.
// ---------------------------------------------------------------------------

export async function clubDueCheck(): Promise<void> {
  try {
    await ensureTables();
    const ms = (await db.execute(sql`SELECT * FROM club_members WHERE status = 'active' AND details_done = true AND plan <> 'portal'`)).rows as unknown as Member[];
    const started: string[] = [];
    for (const m of ms) {
      const { date, month } = nextBilling(m.billing_day);
      if (daysUntil(date) > PREP_DAYS) continue;
      const cur = await getOrMakeMonth(m.id, month);
      if (cur.due_notified_at || cur.status === "approved") continue;
      await db.execute(sql`UPDATE club_months SET due_notified_at = now() WHERE id = ${cur.id}`);
      started.push(`${m.name} (${m.plan === "69" ? "£69" : "£275"} club, bills ${ymd(date)})`);
      void prepareMonth(m.id, month);
    }
    if (started.length) {
      await emailVanessa(`Club: ${started.length} month${started.length > 1 ? "s" : ""} ready to build`, [
        "These members are five days from billing. I have started their reel hooks, scripts and AI photos. The posts are waiting for you to build and vet:",
        "",
        ...started.map((s) => `- ${s}`),
        "",
        appLink("/club-admin"),
      ]);
    }
  } catch (err) {
    logger.warn({ err }, "Club due check failed");
  }
}
// The five days before billing check is switched off: Vanessa tracks payments herself and starts each month from Club Build.
// Set CLUB_AUTO_DUE=1 on the server to bring the automatic check and its email back.
let timer: NodeJS.Timeout | null = null;
if (!timer && process.env.NODE_ENV !== "test" && process.env.CLUB_AUTO_DUE === "1") {
  timer = setInterval(() => void clubDueCheck(), 6 * 60 * 60 * 1000);
  timer.unref?.();
  setTimeout(() => void clubDueCheck(), 90_000).unref?.();
}
router.post("/club/due-check", requireAuth, async (_req: Request, res: Response) => {
  await clubDueCheck();
  res.json({ ok: true });
});

export default router;
