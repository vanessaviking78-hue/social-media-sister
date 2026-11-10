import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { aiSourcePhotosTable } from "@workspace/db/schema";
import { saveSampleFile, readKey, appLink } from "../lib/freeSampleWorker";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { createJob, getJob, processPortraitJob } from "../lib/aiPortraitWorker";
import { logger } from "../lib/logger";
import { ensureTable as ensureTenFreeTable } from "./ten-free";

// THE CLUBS. £69 club (free injectors WhatsApp group, 5 places) and £222 club (Instagram DM, 7 places).
// A member is made by Vanessa, gets a private link /club/<token>, fills in their details once, then picks their treatments and posts each month.
// Five days before their billing date the month is prepared (reel hooks and scripts, six AI photos), and an email tells Vanessa it is waiting.
// She builds the posts, vets everything in the approval queue, and only approved months reach the member's portal. Cancelled members lose access.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 22 } });
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

export const CLUB_PLANS = {
  "69": { price: 69, posts: 12, treatmentPosts: 3, aboutPosts: 3, picks: 7, reels: 10, tailoredReels: 4 },
  "222": { price: 222, posts: 20, treatmentPosts: 4, aboutPosts: 2, picks: 16, reels: 20, tailoredReels: 8 },
} as const;
type PlanId = keyof typeof CLUB_PLANS;
const MAX_PHOTOS = 20;
const CUT_OFF_DAYS = 7; // members choose up to a week before billing, generation starts five days before
const PREP_DAYS = 5;

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const noDashes = (t: unknown) => String(t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/!/g, ".").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

type Member = {
  id: string; token: string; plan: PlanId; status: string; name: string; email: string; billing_day: number;
  details: Record<string, any>; details_done: boolean; logo_url: string; photo_urls: string[]; clinic_photo_url: string; ref_photo_url?: string; welcome_photo_url?: string; created_at: string; cancelled_at: string | null;
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
  caps: CLUB_PLANS[m.plan],
  detailsDone: m.details_done,
  details: m.details,
  logoUrl: m.logo_url,
  photoUrls: m.photo_urls,
  clinicPhotoUrl: m.clinic_photo_url,
  welcomePhotoUrl: m.welcome_photo_url ?? "",
});

async function memberByToken(token: string): Promise<Member | null> {
  const r = await db.execute(sql`SELECT * FROM club_members WHERE token = ${token}`);
  return (r.rows[0] as unknown as Member) ?? null;
}

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
    if (m.status !== "active") {
      res.status(403).json({ ended: true, error: "Your club membership has ended, so the portal is closed. Pop me a message if you would like to come back." });
      return;
    }
    const { date, month } = nextBilling(m.billing_day);
    const cur = await getOrMakeMonth(m.id, month);
    const cutOffDate = new Date(date.getTime() - CUT_OFF_DAYS * 86400000);
    const approved = await db.execute(sql`SELECT month, content, ai_urls, approved_at, choices FROM club_months WHERE member_id = ${m.id} AND status = 'approved' ORDER BY month DESC`);
    // The welcome page extras: this calendar month's, or the most recent month she has filled in.
    const nowMonth = `${new Date().getUTCFullYear()}-${pad(new Date().getUTCMonth() + 1)}`;
    let extraRows = (await db.execute(sql`SELECT * FROM club_extras WHERE month = ${nowMonth}`)).rows as any[];
    if (!extraRows.length) {
      const last = (await db.execute(sql`SELECT month FROM club_extras ORDER BY month DESC LIMIT 1`)).rows[0] as any;
      if (last) extraRows = (await db.execute(sql`SELECT * FROM club_extras WHERE month = ${last.month}`)).rows as any[];
    }
    const extras = extraRows.filter((r) => r.title || r.body || r.image_url).map((r) => ({ kind: r.kind, title: r.title, body: r.body, imageUrl: r.image_url }));
    res.set("Cache-Control", "private, no-store");
    res.json({
      extras,
      member: publicMember(m),
      cycle: {
        month,
        nextBilling: ymd(date),
        cutOff: ymd(cutOffDate),
        open: cur.status === "choosing" && Date.now() <= cutOffDate.getTime() + 86400000,
        status: cur.status === "approved" ? "approved" : cur.status === "choosing" ? "choosing" : "building",
        choices: cur.choices,
      },
      months: (approved.rows as any[]).map((r) => ({ month: r.month, content: r.content, aiUrls: r.ai_urls, approvedAt: r.approved_at })),
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
router.post("/club/me/:token/details", detailsUpload, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await memberByToken(String(req.params.token));
    if (!m || m.status !== "active") {
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
      void emailVanessa(`Club: ${m.name} has filled in her details`, [`${m.name} (${m.plan === "69" ? "£69" : "£222"} club) has completed the one-off details form.`, "", appLink("/club-admin")]);
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
    const caps = CLUB_PLANS[m.plan];
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
      `${m.details?.clinicName || m.name} (${m.plan === "69" ? "£69" : "£222"} club), ${month}`,
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

type Reel = { n: number; kind: "treatment" | "engagement"; treatment?: string; hook: string; onScreen: string; script: string };

async function writeReels(m: Member, month: MonthRow): Promise<Reel[]> {
  const caps = CLUB_PLANS[m.plan];
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
// The six AI photos a month: three black and white studio, three colour. If she gave a clinic photo, the colour ones are set in her clinic.
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
    const [source] = await db.insert(aiSourcePhotosTable).values({ clientName: m.details?.clinicName || m.name, photoUrl: `/api/media/${key}`, notes: "club" }).returning();
    // Two different black and white David Bailey shots, then two colour shots in the scrubs colour: in her clinic if she sent a clinic photo, otherwise on plain white.
    const pool = ["bl-01", "bl-02", "bl-03", "bl-04", "bl-06", "bl-07", "bl-08"];
    const pick = () => `cbw-${pool.splice(Math.floor(Math.random() * pool.length), 1)[0]}`;
    const scrub = String(m.details?.scrubs || "").trim().slice(0, 40) || "navy blue";
    // The worker reads pictures from storage by their /api/media path.
    const clinic = m.clinic_photo_url ? `/api/media/${m.clinic_photo_url.replace("/api/free-samples/media/", "")}` : "";
    const cfgs: any[] = [
      { id: pick(), aspectRatio: "3:4" },
      { id: pick(), aspectRatio: "3:4" },
      ...(clinic
        ? [{ id: "club-clinic-1", aspectRatio: "3:4", scrubColor: scrub, backgroundImageUrl: clinic }, { id: "club-clinic-2", aspectRatio: "3:4", scrubColor: scrub, backgroundImageUrl: clinic }]
        : [{ id: "club-white-1", aspectRatio: "3:4", scrubColor: scrub }, { id: "club-white-2", aspectRatio: "3:4", scrubColor: scrub }]),
    ];
    const results = new Map<string, string>();
    const reasons: string[] = [];
    let pending = cfgs;
    // The worker already retries each picture, so one round keeps the AI credits down.
    for (let round = 0; round < 1 && pending.length > 0; round++) {
      const jobId = `club_${Date.now()}_${uuid().slice(0, 8)}`;
      createJob(jobId, pending.map((c) => c.id));
      await processPortraitJob(jobId, buf, source.id, m.details?.clinicName || m.name, pending as any);
      for (const c of getJob(jobId)?.cards ?? []) {
        if (c.status === "success" && c.outputImageUrl) results.set(c.scenarioId, c.outputImageUrl);
        else if (c.failureReason) reasons.push(`${c.scenarioId}: ${c.failureReason}`);
      }
      pending = pending.filter((c) => !results.has(c.id));
      if (pending.length) await sleep(3000);
    }
    const urls = cfgs.map((c) => results.get(c.id)).filter((u): u is string => !!u);
    await db.execute(sql`UPDATE club_months SET ai_urls = ${JSON.stringify(urls)}::jsonb, ai_status = ${urls.length ? "ready" : "failed"}, ai_error = ${urls.length === cfgs.length ? "" : reasons.slice(-3).join(" | ").slice(0, 500)}, updated_at = now() WHERE id = ${monthId}`);
  } catch (err) {
    logger.warn({ err }, "Club AI shots failed");
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db.execute(sql`UPDATE club_months SET ai_status = 'failed', ai_error = ${msg} WHERE id = ${monthId}`).catch(() => undefined);
  }
}

async function prepareMonth(memberId: string, month: string): Promise<void> {
  const mr = await db.execute(sql`SELECT * FROM club_members WHERE id = ${memberId}`);
  const m = mr.rows[0] as unknown as Member | undefined;
  if (!m || m.status !== "active" || !m.details_done) return;
  const cur = await getOrMakeMonth(memberId, month);
  if (cur.status === "approved") return;
  await db.execute(sql`UPDATE club_months SET status = CASE WHEN status = 'choosing' THEN 'to_build' ELSE status END, reels_status = 'working', updated_at = now() WHERE id = ${cur.id}`);
  // AI studio photos are only ever made when I press the button in the club admin, so no credits are spent by surprise.
  try {
    const reels = await writeReels(m, cur);
    const content = { ...(cur.content ?? {}), reels };
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, reels_status = ${reels.length ? "ready" : "failed"}, updated_at = now() WHERE id = ${cur.id}`);
  } catch (err) {
    logger.warn({ err }, "Club reels failed");
    await db.execute(sql`UPDATE club_months SET reels_status = 'failed' WHERE id = ${cur.id}`).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Vanessa's side
// ---------------------------------------------------------------------------

router.post("/club/members", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { name?: string; email?: string; plan?: string; billingDay?: number };
    const plan = b.plan === "222" ? "222" : b.plan === "69" ? "69" : null;
    const name = str(b.name, 100);
    if (!plan || !name) {
      res.status(400).json({ error: "A name and a plan (69 or 222) are needed" });
      return;
    }
    const limit = plan === "69" ? 5 : 7;
    const n = Number((await db.execute(sql`SELECT count(*)::int AS n FROM club_members WHERE plan = ${plan} AND status = 'active'`)).rows[0]?.n ?? 0);
    if (n >= limit && !(req.body as any).overrideLimit) {
      res.status(409).json({ error: `The ${plan === "69" ? "£69" : "£222"} club is full (${limit} places). Tick "allow a sixth place" if you want to go over.`, full: true });
      return;
    }
    const id = uuid();
    const token = randomBytes(18).toString("base64url");
    const billingDay = Math.min(28, Math.max(1, Number(b.billingDay) || new Date().getUTCDate()));
    await db.execute(sql`INSERT INTO club_members (id, token, plan, name, email, billing_day) VALUES (${id}, ${token}, ${plan}, ${name}, ${str(b.email, 160)}, ${billingDay})`);
    res.json({ id, link: appLink(`/club/${token}`) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not add the member" });
  }
});

router.get("/club/members", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const ms = (await db.execute(sql`SELECT * FROM club_members ORDER BY created_at DESC`)).rows as unknown as Member[];
    const months = (await db.execute(sql`SELECT * FROM club_months ORDER BY month DESC`)).rows as unknown as MonthRow[];
    res.json({
      members: ms.map((m) => {
        const { date, month } = nextBilling(m.billing_day);
        return {
          id: m.id, name: m.name, email: m.email, plan: m.plan, status: m.status, billingDay: m.billing_day, detailsDone: m.details_done, details: m.details,
          link: appLink(`/club/${m.token}`), nextBilling: ymd(date), daysToBilling: daysUntil(date), cycle: month, photoCount: (m.photo_urls ?? []).length, hasClinicPhoto: !!m.clinic_photo_url, photoUrls: m.photo_urls ?? [], refPhotoUrl: m.ref_photo_url ?? "", welcomePhotoUrl: m.welcome_photo_url ?? "",
          months: months.filter((x) => x.member_id === m.id).map((x) => ({
            id: x.id, month: x.month, status: x.status, choices: x.choices, reelCount: ((x.content?.reels as any[]) ?? []).length, postCount: ((x.content?.posts as any[]) ?? []).length,
            aiUrls: x.ai_urls, aiStatus: x.ai_status, aiError: x.ai_error ?? "", reelsStatus: x.reels_status, note: x.admin_note,
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
    const b = req.body as { status?: string; billingDay?: number; email?: string; reopenDetails?: boolean };
    const id = String(req.params.id);
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
      member: { id: m.id, name: m.name, plan: m.plan, caps: CLUB_PLANS[m.plan], details: m.details, logoUrl: m.logo_url, photoUrls: m.photo_urls, clinicPhotoUrl: m.clinic_photo_url },
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
  const caps = CLUB_PLANS[m.plan];
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
    usedAngles, clubHooks: hookCodes, clubTreatmentSlots: caps.treatmentPosts, clubAboutSlots: caps.aboutPosts, clubHookSlots: Math.min(caps.picks - caps.aboutPosts, Math.max(hookCodes.length, caps.picks - caps.aboutPosts - picks.filter((p) => p.kind === "tool").length)),
  };
  await ensureTenFreeTable();
  const rid = `club-${x.id}`;
  const kind = `club${m.plan}`;
  const aiUrls = (x.ai_urls ?? []);
  const photos = (m.photo_urls ?? []).slice(0, 12);
  const treatments = ((x.choices?.treatments as string[]) ?? []).slice(0, 4);
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
    res.json({ id });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start the build" });
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

// The browser build hands back the finished posts here. They go to the approval queue, never straight to the member.
router.post("/club/months/:id/posts", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${id}`)).rows[0] as unknown as MonthRow | undefined;
    if (!x) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const b = req.body as { posts?: any[]; reels?: any[] };
    const posts = (Array.isArray(b.posts) ? b.posts : []).slice(0, 24).map((p, i) => ({
      n: Number(p.n) || i + 1, kind: str(p.kind, 30), label: str(p.label, 100),
      images: (p.images ?? []).map((u: unknown) => str(u, 400)).filter(Boolean).slice(0, 10),
      caption: noDashes(p.caption).slice(0, 1800), tags: noDashes(p.tags).slice(0, 300),
      ...(p.treatment ? { treatment: str(p.treatment, 60), angle: Number(p.angle) || 0 } : {}),
    }));
    const content = { ...(x.content ?? {}), posts };
    if (Array.isArray(b.reels)) {
      (content as any).reels = b.reels.slice(0, 30).map((r: any, i: number) => ({ n: i + 1, kind: r.kind === "treatment" ? "treatment" : "engagement", treatment: str(r.treatment, 60), hook: noDashes(r.hook).slice(0, 220), onScreen: noDashes(r.onScreen).slice(0, 80), script: noDashes(r.script).slice(0, 900) }));
    }
    await db.execute(sql`UPDATE club_months SET content = ${JSON.stringify(content)}::jsonb, status = 'pending_approval', updated_at = now() WHERE id = ${id}`);
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
    const b = req.body as { reels?: any[]; aiUrls?: string[]; choices?: Record<string, any> };
    const x = (await db.execute(sql`SELECT * FROM club_months WHERE id = ${id}`)).rows[0] as unknown as MonthRow | undefined;
    if (!x) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (Array.isArray(b.reels)) {
      const content = { ...(x.content ?? {}), reels: b.reels.slice(0, 30).map((r: any, i: number) => ({ n: i + 1, kind: r.kind === "treatment" ? "treatment" : "engagement", treatment: str(r.treatment, 60), hook: noDashes(r.hook).slice(0, 220), onScreen: noDashes(r.onScreen).slice(0, 80), script: noDashes(r.script).slice(0, 900) })) };
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
    const ms = (await db.execute(sql`SELECT * FROM club_members WHERE status = 'active' AND details_done = true`)).rows as unknown as Member[];
    const started: string[] = [];
    for (const m of ms) {
      const { date, month } = nextBilling(m.billing_day);
      if (daysUntil(date) > PREP_DAYS) continue;
      const cur = await getOrMakeMonth(m.id, month);
      if (cur.due_notified_at || cur.status === "approved") continue;
      await db.execute(sql`UPDATE club_months SET due_notified_at = now() WHERE id = ${cur.id}`);
      started.push(`${m.name} (${m.plan === "69" ? "£69" : "£222"} club, bills ${ymd(date)})`);
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
let timer: NodeJS.Timeout | null = null;
if (!timer && process.env.NODE_ENV !== "test") {
  timer = setInterval(() => void clubDueCheck(), 6 * 60 * 60 * 1000);
  timer.unref?.();
  setTimeout(() => void clubDueCheck(), 90_000).unref?.();
}
router.post("/club/due-check", requireAuth, async (_req: Request, res: Response) => {
  await clubDueCheck();
  res.json({ ok: true });
});

export default router;
