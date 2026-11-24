import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";

// Public endpoint behind cybersuite.com/smskirsty: clinics Kirsty sends to Vanessa apply for the £222 a month development rate.
// Every application is saved, then Vanessa gets an email straight away.

const router: IRouter = Router();

const NOTIFY_EMAIL = process.env.CLUB_NOTIFY_EMAIL || process.env.NOTIFY_EMAIL || "vanessaviking78@gmail.com";

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sms_applications (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'kirsty',
      name TEXT NOT NULL,
      clinic TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      reels TEXT NOT NULL,
      selfies TEXT NOT NULL,
      hour_call TEXT NOT NULL,
      trust_me TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

async function emailVanessa(subject: string, lines: string[]): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;
  try {
    const t = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await t.sendMail({ from: process.env.EMAIL_FROM || SMTP_USER, to: NOTIFY_EMAIL, subject, text: lines.join("\n") });
    return true;
  } catch {
    return false;
  }
}

const hits = new Map<string, number[]>();
const clean = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const yn = (v: unknown) => (v === "yes" || v === "no" ? (v as string) : "");

router.post("/sms-apply", async (req: Request, res: Response) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "x";
    const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
    if (recent.length >= 8) {
      res.status(429).json({ error: "That is a lot of goes in one hour. Give it a little while and try again." });
      return;
    }
    hits.set(ip, [...recent, Date.now()]);

    const b = req.body as Record<string, unknown>;
    const name = clean(b.name, 120);
    const clinic = clean(b.clinic, 160);
    const email = clean(b.email, 160);
    const phone = clean(b.phone, 40);
    const notes = clean(b.notes, 1500);
    const reels = yn(b.reels);
    const selfies = yn(b.selfies);
    const hourCall = yn(b.hourCall);
    const trustMe = yn(b.trustMe);

    if (!name || !clinic || !email || !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ error: "Please add your name, clinic and a proper email address." });
      return;
    }
    if (!reels || !selfies || !hourCall || !trustMe) {
      res.status(400).json({ error: "Please answer all four questions." });
      return;
    }

    await ensureTable();
    await db.execute(sql`
      INSERT INTO sms_applications (source, name, clinic, email, phone, reels, selfies, hour_call, trust_me, notes)
      VALUES ('kirsty', ${name}, ${clinic}, ${email}, ${phone || null}, ${reels}, ${selfies}, ${hourCall}, ${trustMe}, ${notes || null})
    `);

    const allYes = [reels, selfies, hourCall, trustMe].every((a) => a === "yes");
    const emailed = await emailVanessa(`Development rate application: ${clinic} (via Kirsty)${allYes ? "" : " - some answers were no"}`, [
      "A new application for the £222 a month development rate has come in through Kirsty's link.",
      "",
      `Name: ${name}`,
      `Clinic: ${clinic}`,
      `Email: ${email}`,
      `Phone: ${phone || "-"}`,
      "",
      `1. Willing to do 8 reels a month: ${reels.toUpperCase()}`,
      `2. Will take selfies: ${selfies.toUpperCase()}`,
      `3. Can commit to a 1 hour conversation a month: ${hourCall.toUpperCase()}`,
      `4. Will let me lead on social: ${trustMe.toUpperCase()}`,
      "",
      `Anything else: ${notes || "-"}`,
    ]);
    req.log?.info({ clinic, email, emailed }, "SMS development rate application");
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "sms apply failed");
    res.status(500).json({ error: "Something went wrong on my side. Please try again in a minute." });
  }
});

// Vanessa only: see every application.
router.get("/sms-apply", async (req: Request, res: Response) => {
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers["x-app-password"] !== appPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await ensureTable();
    const rows = await db.execute(sql`SELECT * FROM sms_applications ORDER BY created_at DESC`);
    res.json({ entries: rows.rows });
  } catch (err) {
    req.log?.error({ err }, "sms apply list failed");
    res.status(500).json({ error: "Failed to fetch" });
  }
});

export default router;
