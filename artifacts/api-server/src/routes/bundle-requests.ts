import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bundleRequestsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateBundleContent } from "../lib/generateBundleContent";
import nodemailer from "nodemailer";

const router: IRouter = Router();

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

async function sendBundleEmail(to: string, clinicName: string, bundleUrl: string) {
  const transporter = getTransporter();
  if (!transporter) return false;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to,
    subject: `Your Social Media Sister content sample is ready`,
    text: [
      `Hi ${clinicName},`,
      ``,
      `Your content sample is ready. Take a look when you're ready — no rush, no pressure.`,
      ``,
      bundleUrl,
      ``,
      `This is four pieces of content written specifically for your clinic. If it feels right, we should talk.`,
      ``,
      `Vanessa`,
      `Social Media Sister`,
    ].join("\n"),
  });
  return true;
}

router.post("/bundle-requests", async (req, res) => {
  try {
    const { clinicName, igHandle, email, treatmentFocus } = req.body;
    if (!clinicName?.trim() || !email?.trim() || !treatmentFocus?.trim()) {
      res.status(400).json({ error: "clinicName, email and treatmentFocus are required" });
      return;
    }
    const [row] = await db
      .insert(bundleRequestsTable)
      .values({
        clinicName: clinicName.trim(),
        igHandle: igHandle?.trim() || null,
        email: email.trim(),
        treatmentFocus: treatmentFocus.trim(),
        status: "pending_review",
      })
      .returning();
    res.status(201).json({ id: row.id });
  } catch (err: any) {
    req.log?.error({ err }, "Bundle request create error");
    res.status(500).json({ error: "Failed to save request" });
  }
});

router.get("/bundle-requests", async (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  const provided = req.headers["x-app-password"];
  if (appPassword && provided !== appPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(bundleRequestsTable)
      .orderBy(desc(bundleRequestsTable.createdAt));
    res.json(rows);
  } catch (err: any) {
    req.log?.error({ err }, "Bundle requests fetch error");
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/bundle-requests/:id/generate", async (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  const provided = req.headers["x-app-password"];
  if (appPassword && provided !== appPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    const [request] = await db
      .select()
      .from(bundleRequestsTable)
      .where(eq(bundleRequestsTable.id, id))
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    if (request.status === "generated") {
      res.json({ token: request.bundleToken });
      return;
    }

    const { token } = await generateBundleContent({
      clinicName: request.clinicName,
      igHandle: request.igHandle ?? undefined,
      treatmentFocus: request.treatmentFocus,
    });

    await db
      .update(bundleRequestsTable)
      .set({ status: "generated", bundleToken: token })
      .where(eq(bundleRequestsTable.id, id));

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domains ? `https://${domains}` : `${req.protocol}://${req.get("host")}`;
    const bundleUrl = `${base}/bundle/${token}`;

    const emailed = await sendBundleEmail(request.email, request.clinicName, bundleUrl).catch(() => false);
    req.log?.info({ id, token, emailed }, "Bundle request generated");

    res.json({ token, bundleUrl, emailed });
  } catch (err: any) {
    req.log?.error({ err }, "Bundle request generate error");
    res.status(500).json({ error: err.message || "Generation failed" });
  }
});

router.post("/bundle-requests/:id/decline", async (req, res) => {
  const appPassword = process.env.APP_PASSWORD;
  const provided = req.headers["x-app-password"];
  if (appPassword && provided !== appPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    await db
      .update(bundleRequestsTable)
      .set({ status: "declined" })
      .where(eq(bundleRequestsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error({ err }, "Bundle request decline error");
    res.status(500).json({ error: "Failed to decline request" });
  }
});

export default router;
