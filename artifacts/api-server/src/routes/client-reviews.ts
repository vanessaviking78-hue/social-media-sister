import { Router, type IRouter, type Request, type Response } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const LABELS: Record<string, string> = {
  compliance: "Compliance knowledge",
  creativity: "Creativity",
  outside: "Thinking outside the box",
  newthings: "Trying new things",
  patients: "Patient feedback on my socials",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

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

// Very small in-memory throttle: 6 reviews per IP per hour
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

router.post("/client-reviews", async (req: Request, res: Response) => {
  try {
    const b = (req.body || {}) as Record<string, any>;

    // Bot trap: hidden field must be empty
    if (b.website) { res.json({ ok: true }); return; }
    if (tooMany(req.ip || "unknown")) { res.status(429).json({ error: "Too many reviews from this device, try again later" }); return; }

    const name = String(b.name || "").trim().slice(0, 120);
    const clinic = String(b.clinic || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().slice(0, 200);
    const heart = String(b.heart || "").trim().slice(0, 1500);
    const ratings = (b.ratings || {}) as Record<string, unknown>;
    const ticks = (b.ticks || {}) as Record<string, unknown>;

    const keys = Object.keys(LABELS);
    const nums = keys.map((k) => Number(ratings[k]));
    if (!name || heart.length < 20 || nums.some((n) => !(n >= 1 && n <= 5))) {
      res.status(400).json({ error: "Missing details" });
      return;
    }
    const average = Math.round((nums.reduce((a, c) => a + c, 0) / nums.length) * 10) / 10;
    const tickList = (k: string): string[] =>
      Array.isArray(ticks[k]) ? (ticks[k] as unknown[]).map((x) => String(x).slice(0, 120)).slice(0, 6) : [];

    const transporter = getTransporter();
    if (!transporter) { res.status(500).json({ error: "Email is not set up yet" }); return; }

    const to = process.env.REVIEWS_NOTIFY_EMAIL || "vanessaviking78@gmail.com";
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    const reviewText = String(b.reviewText || "").slice(0, 6000);
    const sign = name + (clinic ? ", " + clinic : "");

    const text = [
      `NEW REVIEW from ${sign}`,
      `Overall: ${average} out of 5`,
      "",
      ...keys.map((k) => `${LABELS[k]}: ${ratings[k]}/5${tickList(k).length ? "  (" + tickList(k).join("; ") + ")" : ""}`),
      "",
      "THE REVIEW, READY TO POST:",
      reviewText,
      "",
      email ? `Reply to them: ${email}` : "No email left.",
    ].join("\n");

    const rows = keys
      .map(
        (k) => `<tr>
        <td style="padding:8px 0;font:15px Arial,sans-serif;color:#ffffff">${esc(LABELS[k])}</td>
        <td style="padding:8px 0;text-align:right;font:18px Arial,sans-serif;color:#ff2e93;white-space:nowrap">${stars(Number(ratings[k]))}</td>
      </tr>${
        tickList(k).length
          ? `<tr><td colspan="2" style="padding:0 0 8px;font:13px Arial,sans-serif;color:#c7c0c5">${tickList(k).map(esc).join(" &middot; ")}</td></tr>`
          : ""
      }`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#000000">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="background:#ff2e93;color:#000;text-align:center;padding:18px;border-radius:16px 16px 0 0;font:bold 13px Arial,sans-serif;letter-spacing:.08em">NEW CLIENT REVIEW</div>
    <div style="background:#0f0f0f;border:1px solid #ff2e93;border-top:0;border-radius:0 0 16px 16px;padding:28px">
      <div style="text-align:center;font:44px Arial,sans-serif;color:#ff2e93;letter-spacing:4px">${stars(average)}</div>
      <div style="text-align:center;font:bold 22px Georgia,serif;color:#ffffff;margin-bottom:20px">${average} out of 5</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #3b2431;border-bottom:1px solid #3b2431;margin-bottom:22px">${rows}</table>
      <div style="font:italic 19px/1.6 Georgia,serif;color:#ffffff;border-left:4px solid #ff2e93;padding-left:16px;white-space:pre-wrap">&ldquo;${esc(heart)}&rdquo;</div>
      <div style="font:bold 17px Georgia,serif;color:#ff2e93;margin-top:18px">${esc(sign)}</div>
      ${email ? `<div style="font:14px Arial,sans-serif;color:#c7c0c5;margin-top:4px">${esc(email)}</div>` : ""}
      <hr style="border:0;border-top:1px solid #3b2431;margin:26px 0">
      <div style="font:bold 12px Arial,sans-serif;color:#ff2e93;letter-spacing:.06em;margin-bottom:8px">THE FULL REVIEW, READY TO COPY AND POST</div>
      <div style="font:15px/1.6 Georgia,serif;color:#ffffff;white-space:pre-wrap;background:#000;border:1px solid #3b2431;border-radius:10px;padding:14px">${esc(reviewText)}</div>
      <div style="font:13px Arial,sans-serif;color:#c7c0c5;margin-top:16px">The review card is attached as a picture, ready to share.</div>
    </div>
  </div></body></html>`;

    const attachments: { filename: string; content: string; encoding: "base64" }[] = [];
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
    if (m && m[1].length < 4_000_000) {
      attachments.push({
        filename: `review-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "client"}.png`,
        content: m[1],
        encoding: "base64",
      });
    }

    await transporter.sendMail({
      from,
      to,
      subject: `New ${average}/5 review from ${sign}`,
      text,
      html,
      attachments,
      ...(email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { replyTo: email } : {}),
    });

    req.log.info({ name, clinic, average }, "Client review received");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "client review failed");
    res.status(500).json({ error: "The email would not send" });
  }
});

export default router;
