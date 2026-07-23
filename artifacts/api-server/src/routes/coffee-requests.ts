import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const NOTIFY_EMAIL = process.env.CLUB_NOTIFY_EMAIL || "vanessaviking78@gmail.com";

async function ensureCoffeeRequestsTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS coffee_requests (
              id           SERIAL PRIMARY KEY,
                    name         TEXT NOT NULL,
                          email        TEXT NOT NULL,
                                clinic_name  TEXT,
                                      phone        TEXT,
                                            note         TEXT,
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

async function notifyCoffeeRequest(entry: { name: string; email: string; clinicName?: string; phone?: string; note?: string }) {
    const transporter = getTransporter();
    if (!transporter) return false;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
          from,
          to: NOTIFY_EMAIL,
          subject: `Coffee call request - ${entry.name}`,
          text: [
                  `New "let's have a coffee" call request.`,
                  ``,
                  `Name: ${entry.name}`,
                  `Email: ${entry.email}`,
                  `Clinic: ${entry.clinicName || "-"}`,
                  `Phone: ${entry.phone || "-"}`,
                  `Note: ${entry.note || "-"}`,
                ].join("\n"),
    });
    return true;
}

router.post("/coffee-requests", async (req: Request, res: Response) => {
    try {
          const { name, email, clinicName, phone, note } = req.body as {
                  name?: string;
                  email?: string;
                  clinicName?: string;
                  phone?: string;
                  note?: string;
          };

      if (!name?.trim() || !email?.trim()) {
              res.status(400).json({ error: "name and email are required" });
              return;
      }

      if (!tableReady) {
              await ensureCoffeeRequestsTable();
              tableReady = true;
      }

      await db.execute(sql`
            INSERT INTO coffee_requests (name, email, clinic_name, phone, note)
                  VALUES (${name.trim()}, ${email.trim()}, ${clinicName?.trim() ?? null}, ${phone?.trim() ?? null}, ${note?.trim() ?? null})
                      `);

      const emailed = await notifyCoffeeRequest({
              name: name.trim(),
              email: email.trim(),
              clinicName: clinicName?.trim(),
              phone: phone?.trim(),
              note: note?.trim(),
      }).catch(() => false);

      req.log.info({ name: name.trim(), email: email.trim(), emailed }, "Coffee call request");
          res.json({ success: true });
    } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save";
          req.log.error({ err }, "coffee request insert failed");
          res.status(500).json({ error: msg });
    }
});

router.get("/coffee-requests", async (req: Request, res: Response) => {
    const appPassword = process.env.APP_PASSWORD;
    const provided = req.headers["x-app-password"];
    if (appPassword && provided !== appPassword) {
          res.status(401).json({ error: "Unauthorized" });
          return;
    }
    try {
          if (!tableReady) {
                  await ensureCoffeeRequestsTable();
                  tableReady = true;
          }
          const rows = await db.execute(sql`SELECT * FROM coffee_requests ORDER BY created_at DESC`);
          res.json({ entries: rows.rows });
    } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch";
          req.log.error({ err }, "coffee requests fetch failed");
          res.status(500).json({ error: msg });
    }
});

export default router;
