import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const NOTIFY_EMAIL = process.env.GROUP_NOTIFY_EMAIL || process.env.CLUB_NOTIFY_EMAIL || "vanessaviking78@gmail.com";

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS join_group_signups (
      id             SERIAL PRIMARY KEY,
      full_name      TEXT NOT NULL,
      business_type  TEXT NOT NULL,
      phone          TEXT NOT NULL,
      instagram      TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
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

async function notify(e: { fullName: string; businessType: string; phone: string; instagram: string }) {
  const transporter = getTransporter();
  if (!transporter) return false;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to: NOTIFY_EMAIL,
    subject: `WhatsApp group: new member - ${e.fullName}`,
    text: [
      "Someone wants to join the group.",
      "",
      `Name: ${e.fullName}`,
      `Business: ${e.businessType}`,
      `Phone: ${e.phone}`,
      `Instagram: ${e.instagram}`,
    ].join("\n"),
  });
  return true;
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

router.post("/join-group", async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    // Honeypot: bots fill this in, humans never see it. Pretend success.
    if (clean(body.website)) {
      res.json({ success: true });
      return;
    }
    const fullName = clean(body.fullName, 120);
    const businessType = clean(body.businessType, 120);
    const phone = clean(body.phone, 40);
    const instagram = clean(body.instagram, 80);

    if (!fullName || !businessType || !phone || !instagram) {
      res.status(400).json({ error: "Please fill in every box" });
      return;
    }

    await ensureTable();
    await db.execute(sql`
      INSERT INTO join_group_signups (full_name, business_type, phone, instagram)
      VALUES (${fullName}, ${businessType}, ${phone}, ${instagram})
    `);

    const emailed = await notify({ fullName, businessType, phone, instagram }).catch(() => false);
    req.log.info({ fullName, emailed }, "Join group signup");
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "join group insert failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.get("/join-group", async (req: Request, res: Response) => {
  const appPassword = process.env.APP_PASSWORD;
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (appPassword && provided !== appPassword.trim().toLowerCase()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await ensureTable();
    const rows = await db.execute(sql`SELECT * FROM join_group_signups ORDER BY created_at DESC`);
    res.json({ entries: rows.rows });
  } catch (err: unknown) {
    req.log.error({ err }, "join group fetch failed");
    res.status(500).json({ error: "Failed to fetch" });
  }
});

export default router;
