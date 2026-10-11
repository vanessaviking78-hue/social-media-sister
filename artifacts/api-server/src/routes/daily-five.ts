import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import { DAILY_FIVE_BANK } from "../lib/dailyFiveTasks";

const router: IRouter = Router();

const SITE_URL = (process.env.DAILY_FIVE_SITE_URL || "https://www.thecybersuite.com").replace(/\/$/, "");
const SESSION_DAYS = 60;
const LOGIN_LINK_MINUTES = 30;

// ---------- tables (created on first use, same pattern as the rest of the site) ----------

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_five_members (
      email         TEXT PRIMARY KEY,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      streak        INTEGER NOT NULL DEFAULT 0,
      last_full_day TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at  TIMESTAMPTZ
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_five_tokens (
      token_hash TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      kind       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_five_ticks (
      email   TEXT NOT NULL,
      day     TEXT NOT NULL,
      task_id TEXT NOT NULL,
      PRIMARY KEY (email, day, task_id)
    )
  `);
  tablesReady = true;
}

// ---------- helpers ----------

function normEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function dayNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
}

type Task = { id: string; cat: string; text: string };

// Same rule as the prototype: one category rests each day, so you always get five.
function tasksFor(day: string): Task[] {
  const n = dayNum(day);
  const cats = Object.keys(DAILY_FIVE_BANK);
  const rest = n % cats.length;
  return cats
    .filter((_, i) => i !== rest)
    .map((cat, i) => {
      const arr = DAILY_FIVE_BANK[cat];
      const idx = (n + i * 3) % arr.length;
      return { id: `${cat}${idx}`, cat, text: arr[idx] };
    });
}

function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.DAILY_FIVE_WEBHOOK_SECRET;
  if (!expected) {
    res.status(503).json({ error: "Webhook secret not configured" });
    return;
  }
  const provided = (req.headers["x-webhook-secret"] as string | undefined)?.trim();
  if (!secretMatches(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

type AuthedRequest = Request & { memberEmail?: string };

async function requireMember(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await ensureTables();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const rows = await db.execute(sql`
      SELECT t.email, m.active
      FROM daily_five_tokens t
      JOIN daily_five_members m ON m.email = t.email
      WHERE t.token_hash = ${hash(token)} AND t.kind = 'session' AND t.expires_at > NOW()
    `);
    const row = (rows as unknown as { rows?: Array<{ email: string; active: boolean }> }).rows?.[0]
      ?? (Array.isArray(rows) ? (rows as Array<{ email: string; active: boolean }>)[0] : undefined);
    if (!row) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    if (!row.active) {
      res.status(402).json({ error: "Membership not active" });
      return;
    }
    req.memberEmail = row.email;
    next();
  } catch (err) {
    next(err);
  }
}

function rowsOf<T>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  if (r && Array.isArray(r.rows)) return r.rows;
  return Array.isArray(result) ? (result as T[]) : [];
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ---------- Zapier / Stan webhooks ----------

router.post("/daily-five/webhook/activate", requireWebhookSecret, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const email = normEmail(req.body?.email);
    if (!looksLikeEmail(email)) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }
    await db.execute(sql`
      INSERT INTO daily_five_members (email, active)
      VALUES (${email}, TRUE)
      ON CONFLICT (email) DO UPDATE SET active = TRUE, cancelled_at = NULL
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/daily-five/webhook/cancel", requireWebhookSecret, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const email = normEmail(req.body?.email);
    if (!looksLikeEmail(email)) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }
    await db.execute(sql`
      UPDATE daily_five_members SET active = FALSE, cancelled_at = NOW() WHERE email = ${email}
    `);
    await db.execute(sql`DELETE FROM daily_five_tokens WHERE email = ${email} AND kind = 'session'`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ---------- sign in by emailed link ----------

const lastLoginAsk = new Map<string, number>();

router.post("/daily-five/login", async (req: Request, res: Response) => {
  // Always answers the same way so nobody can use this to find out who is a member.
  const reply = () => res.json({ ok: true });
  try {
    await ensureTables();
    const email = normEmail(req.body?.email);
    if (!looksLikeEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email" });
      return;
    }
    const now = Date.now();
    const last = lastLoginAsk.get(email) ?? 0;
    if (now - last < 60_000) return reply();
    lastLoginAsk.set(email, now);

    const found = rowsOf<{ active: boolean }>(
      await db.execute(sql`SELECT active FROM daily_five_members WHERE email = ${email}`),
    )[0];
    if (!found || !found.active) return reply();

    const token = newToken();
    await db.execute(sql`
      INSERT INTO daily_five_tokens (token_hash, email, kind, expires_at)
      VALUES (${hash(token)}, ${email}, 'login', NOW() + (${LOGIN_LINK_MINUTES} * INTERVAL '1 minute'))
    `);

    const transporter = getTransporter();
    if (transporter) {
      const link = `${SITE_URL}/dailytasks?token=${token}`;
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Your Daily Five sign in link",
        text: [
          "Here is your link to get into Daily Five:",
          "",
          link,
          "",
          `It works once and runs out in ${LOGIN_LINK_MINUTES} minutes. If you did not ask for it, ignore this email.`,
        ].join("\n"),
      });
    }
    return reply();
  } catch {
    return reply();
  }
});

router.post("/daily-five/verify", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "Missing link" });
      return;
    }
    const deleted = rowsOf<{ email: string }>(
      await db.execute(sql`
        DELETE FROM daily_five_tokens
        WHERE token_hash = ${hash(token)} AND kind = 'login' AND expires_at > NOW()
        RETURNING email
      `),
    )[0];
    if (!deleted) {
      res.status(401).json({ error: "That link has expired. Ask for a new one." });
      return;
    }
    const member = rowsOf<{ active: boolean }>(
      await db.execute(sql`SELECT active FROM daily_five_members WHERE email = ${deleted.email}`),
    )[0];
    if (!member?.active) {
      res.status(402).json({ error: "Membership not active" });
      return;
    }
    const session = newToken();
    await db.execute(sql`
      INSERT INTO daily_five_tokens (token_hash, email, kind, expires_at)
      VALUES (${hash(session)}, ${deleted.email}, 'session', NOW() + (${SESSION_DAYS} * INTERVAL '1 day'))
    `);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ---------- the app itself ----------

async function stateFor(email: string) {
  const day = londonToday();
  const tasks = tasksFor(day);
  const ids = tasks.map((t) => t.id);
  const ticks = rowsOf<{ task_id: string }>(
    await db.execute(sql`SELECT task_id FROM daily_five_ticks WHERE email = ${email} AND day = ${day}`),
  )
    .map((r) => r.task_id)
    .filter((id) => ids.includes(id));
  const member = rowsOf<{ streak: number; last_full_day: string | null }>(
    await db.execute(sql`SELECT streak, last_full_day FROM daily_five_members WHERE email = ${email}`),
  )[0];
  let streak = member?.streak ?? 0;
  const last = member?.last_full_day ?? null;
  // A streak that missed yesterday and has not been topped up today has run out.
  if (last && last !== day && dayNum(day) - dayNum(last) > 1) streak = 0;
  return { day, tasks, ticked: ticks, streak, full: last === day };
}

router.get("/daily-five/me", requireMember, async (req: AuthedRequest, res: Response) => {
  try {
    res.json(await stateFor(req.memberEmail!));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/daily-five/tick", requireMember, async (req: AuthedRequest, res: Response) => {
  try {
    const email = req.memberEmail!;
    const taskId = typeof req.body?.taskId === "string" ? req.body.taskId : "";
    const done = req.body?.done !== false;
    const day = londonToday();
    const ids = tasksFor(day).map((t) => t.id);
    if (!ids.includes(taskId)) {
      res.status(400).json({ error: "That is not one of today's tasks" });
      return;
    }
    if (done) {
      await db.execute(sql`
        INSERT INTO daily_five_ticks (email, day, task_id) VALUES (${email}, ${day}, ${taskId})
        ON CONFLICT DO NOTHING
      `);
    } else {
      await db.execute(sql`DELETE FROM daily_five_ticks WHERE email = ${email} AND day = ${day} AND task_id = ${taskId}`);
    }

    const state = await stateFor(email);
    let justCompleted = false;
    if (state.ticked.length === ids.length && !state.full) {
      const member = rowsOf<{ streak: number; last_full_day: string | null }>(
        await db.execute(sql`SELECT streak, last_full_day FROM daily_five_members WHERE email = ${email}`),
      )[0];
      const last = member?.last_full_day ?? null;
      const next = last && dayNum(day) - dayNum(last) === 1 ? (member?.streak ?? 0) + 1 : 1;
      await db.execute(sql`
        UPDATE daily_five_members SET streak = ${next}, last_full_day = ${day} WHERE email = ${email}
      `);
      justCompleted = true;
    }
    res.json({ ...(await stateFor(email)), justCompleted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
