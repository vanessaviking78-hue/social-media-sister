import { Router, type IRouter, type Request, type Response } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const NOTIFY_EMAIL = process.env.PRIZE_NOTIFY_EMAIL || "vanessa@thecybersuite.com";

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

router.post("/prize-spins", async (req: Request, res: Response) => {
  const { email, prize, price, claimed } = req.body as {
    email?: string;
    prize?: string;
    price?: string;
    claimed?: boolean;
  };
  if (!email?.trim() || !prize?.trim()) {
    res.status(400).json({ error: "email and prize are required" });
    return;
  }
  const transporter = getTransporter();
  if (!transporter) {
    res.status(500).json({ error: "Email is not set up" });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `${claimed ? "Prize CLAIMED" : "Wheel spin"}: ${prize.trim()}`,
      text: [
        claimed ? "Someone has claimed their prize." : "Someone has spun the wheel.",
        "",
        `Email: ${email.trim()}`,
        `Prize: ${prize.trim()}`,
        `Price: ${price?.trim() || "-"}`,
      ].join("\n"),
    });
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "prize spin email failed");
    res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
