import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const NOTIFY_EMAIL = process.env.CLUB_NOTIFY_EMAIL || "vanessaviking78@gmail.com";

async function ensureClubSignupsTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS club_signups (
              id           SERIAL PRIMARY KEY,
                    name         TEXT NOT NULL,
                          email        TEXT NOT NULL,
                                clinic_name  TEXT,
                                      phone        TEXT,
                                            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                                                )
                                                  `);
}

let tableReady = false;

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

async function notifyClubSignup(entry: { name: string; email: string; clinicName?: string; phone?: string }) {
    const transporter = getTransporter();
    if (!transporter) return false;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
          from,
          to: NOTIFY_EMAIL,
        subject: `£99 Club: new sign-up - ${entry.name}`,          text: [
                  `New £99 Club sign-up.`,
                  ``,
                  `Name: ${entry.name}`,
                  `Email: ${entry.email}`,
                  `Clinic: ${entry.clinicName || "-"}`,
                  `Phone: ${entry.phone || "-"}`,
                ].join("\n"),
    });
    return true;
}

router.post("/club-signups", async (req: Request, res: Response) => {
    try {
          const { name, email, clinicName, phone } = req.body as {
                  name?: string;
                  email?: string;
                  clinicName?: string;
                  phone?: string;
          };

      if (!name?.trim() || !email?.trim()) {
              res.status(400).json({ error: "name and email are required" });
              return;
      }

      if (!tableReady) {
              await ensureClubSignupsTable();
              tableReady = true;
      }

      await db.execute(sql`
            INSERT INTO club_signups (name, email, clinic_name, phone)
                  VALUES (${name.trim()}, ${email.trim()}, ${clinicName?.trim() ?? null}, ${phone?.trim() ?? null})
                      `);

      const emailed = await notifyClubSignup({
              name: name.trim(),
              email: email.trim(),
              clinicName: clinicName?.trim(),
              phone: phone?.trim(),
      }).catch(() => false);

      req.log.info({ name: name.trim(), email: email.trim(), emailed }, "Club signup");
          res.json({ success: true });
    } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save";
          req.log.error({ err }, "club signup insert failed");
          res.status(500).json({ error: msg });
    }
});

router.get("/club-signups", async (req: Request, res: Response) => {
    const appPassword = process.env.APP_PASSWORD;
    const provided = req.headers["x-app-password"];
    if (appPassword && provided !== appPassword) {
          res.status(401).json({ error: "Unauthorized" });
          return;
    }
    try {
          if (!tableReady) {
                  await ensureClubSignupsTable();
                  tableReady = true;
          }
          const rows = await db.execute(sql`SELECT * FROM club_signups ORDER BY created_at DESC`);
          res.json({ entries: rows.rows });
    } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch";
          req.log.error({ err }, "club signups fetch failed");
          res.status(500).json({ error: msg });
    }
});

export default router;
