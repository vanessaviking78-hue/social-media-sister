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
  igOk?: boolean;
  fbOk?: boolean;
}): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const client = opts.clientName || "client";
  const type = opts.postType || "post";
  const hasPlatformDetail = opts.igOk !== undefined || opts.fbOk !== undefined;
  const platformParts = [
    opts.fbOk !== undefined ? `Facebook: ${opts.fbOk ? "posted" : "failed"}` : null,
    opts.igOk !== undefined ? `Instagram: ${opts.igOk ? "posted" : "failed"}` : null,
  ].filter(Boolean);
  const platformSummary = platformParts.join(", ");
  const subject = hasPlatformDetail
    ? `${opts.ok ? "Posted" : "Post FAILED"}: ${client} (${type}) — ${platformSummary}`
    : opts.ok
      ? `Posted: ${client} (${type})`
      : `Post FAILED: ${client} (${type})`;
  const lines = [
    hasPlatformDetail
      ? `${type} for ${client} — ${platformSummary}.`
      : opts.ok
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
 * Sends a notification to NOTIFY_EMAIL whenever a client submits something
 * through their portal (before/after, selfie, review, post request, onboarding).
 * Fire-and-forget: never throws, never blocks the submit flow.
 */
export async function notifySubmission(opts: {
  clientName: string;
  kind: string;
  submitterName?: string;
  story?: string;
}): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const client = opts.clientName || "A client";
  const kind = (opts.kind || "something").trim() || "something";
  const who = opts.submitterName ? ` (from ${opts.submitterName})` : "";
  const subject = `New ${kind} from ${client}`;
  const lines = [
    `${client} just sent you a ${kind} through their portal${who}.`,
    "",
    opts.story ? `They said: ${opts.story}` : "",
    "",
    "Open your Before & After Inbox to see it.",
    "",
    "The CyberSuite",
  ].filter(Boolean);
  try {
    await transporter.sendMail({ from, to, subject, text: lines.join("\n") });
  } catch (err) {
    logger.warn({ err }, "Submission notification email failed");
  }
}

/**
 * Sends a notification to NOTIFY_EMAIL whenever a client rejects an
  * already-scheduled upcoming post from their portal, with their reason.
   * Fire-and-forget: never throws, never blocks the reject flow.
    */
export async function notifyReject(opts: {
    clientName: string;
    title: string;
    reason: string;
}): Promise<void> {
    const to = process.env.NOTIFY_EMAIL;
    if (!to) return;
    const transporter = getTransporter();
    if (!transporter) return;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    const client = opts.clientName || "A client";
    const subject = `${client} rejected a scheduled post`;
    const lines = [
          `${client} just rejected "${opts.title}" from their upcoming content.`,
          "",
          `Their reason: ${opts.reason}`,
          "",
          "It's been pulled from the schedule and won't go out.",
          "",
          "The CyberSuite",
        ].filter(Boolean);
    try {
          await transporter.sendMail({ from, to, subject, text: lines.join("\n") });
    } catch (err) {
          logger.warn({ err }, "Reject notification email failed");
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


/**
 * Cheap heuristic for spotting Meta/Facebook "your token or connection is
 * broken" errors inside an API error message, as opposed to a one-off post
 * failure (bad image URL, rate limit, etc.). This matters because a broken
 * token means EVERY future post for that client will keep failing silently
 * until someone reconnects it — that's the case that deserves a loud,
 * distinct alert rather than blending into the normal failure emails.
 */
export function isMetaTokenError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("error validating access token") ||
    m.includes("session has expired") ||
    (m.includes("access token") && m.includes("expired")) ||
    m.includes("invalid oauth") ||
    m.includes("oauthexception") ||
    m.includes("has not authorized application") ||
    m.includes("token is invalid") ||
    m.includes("malformed access token") ||
    m.includes("cannot parse access token") ||
    m.includes("application does not have permission") ||
    m.includes("user is enrolled in a blocking") ||
    m.includes("permissions error")
  );
}

// In-memory per-client cooldown so a burst of failed posts (e.g. a whole
// broadcast batch hitting a dead token) sends one clear alert, not one email
// per failed post. Resets on deploy — acceptable, since a still-broken
// connection will simply alert again next time something tries to post.
const reconnectAlertedAt = new Map<string, number>();
const RECONNECT_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Sends a distinct, unmissable "this client's Meta connection is broken and
 * needs reconnecting" email — separate from the routine post success/fail
 * notifications — so it doesn't get lost in the noise of everyday activity.
 * Rate-limited per client via reconnectAlertedAt. Fire-and-forget: never
 * throws, never blocks the posting flow.
 */
export async function notifyReconnectionNeeded(opts: {
  clientName: string;
  presetId: number;
  detail: string;
}): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const key = String(opts.presetId);
  const now = Date.now();
  const last = reconnectAlertedAt.get(key);
  if (last && now - last < RECONNECT_ALERT_COOLDOWN_MS) return;
  reconnectAlertedAt.set(key, now);
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const client = opts.clientName || "A client";
  const subject = `RECONNECT NEEDED: ${client}'s Meta connection has broken`;
  const lines = [
    `${client}'s Facebook/Instagram connection looks broken. Posts for this client will keep failing until it's reconnected.`,
    "",
    `Error from Meta: ${opts.detail}`,
    "",
    "Go to Client Presets and reconnect this client's account.",
    "",
    "The CyberSuite",
  ].filter(Boolean);
  try {
    await transporter.sendMail({ from, to, subject, text: lines.join("\n") });
  } catch (err) {
    logger.warn({ err }, "Reconnection alert email failed");
  }
}
