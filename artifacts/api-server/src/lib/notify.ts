import nodemailer from "nodemailer";
import { logger } from "./logger";

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

/**
 * Sends a post success/fail notification to NOTIFY_EMAIL.
 * Fire-and-forget: never throws, never blocks the posting flow.
 */
export async function notifyPostResult(opts: {
  ok: boolean;
  clientName: string;
  postType: string;
  detail?: string;
}): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const client = opts.clientName || "client";
  const type = opts.postType || "post";
  const subject = opts.ok
    ? `Posted: ${client} (${type})`
    : `Post FAILED: ${client} (${type})`;
  const lines = [
    opts.ok
      ? `A ${type} just posted for ${client}.`
      : `A ${type} failed to post for ${client}.`,
    "",
    opts.detail ? `Details: ${opts.detail}` : "",
    "",
    "Social Media Sister",
  ].filter(Boolean);
  try {
    await transporter.sendMail({ from, to, subject, text: lines.join("\n") });
  } catch (err) {
    logger.warn({ err }, "Post-result notification email failed");
  }
}

/**
 * Sends a one-off test email to NOTIFY_EMAIL so the user can confirm
 * the notification pipeline works without waiting for a real post.
 */
export async function sendTestEmail(): Promise<{ ok: boolean; error?: string; to?: string }> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return { ok: false, error: "NOTIFY_EMAIL is not set in the environment." };
  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: "SMTP is not configured (SMTP_HOST, SMTP_USER or SMTP_PASS missing)." };
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Test: Social Media Sister notifications are working",
      text: [
        "This is a test from your CyberSuite.",
        "",
        "If you can read this, your post success and failure notifications are set up correctly.",
        "",
        "Social Media Sister",
      ].join("\n"),
    });
    return { ok: true, to };
  } catch (err) {
    logger.warn({ err }, "Test notification email failed");
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}
