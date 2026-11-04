import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notifyOwner } from "./notify";
import { logger } from "./logger";

// Google does not let an app read how many AI Studio credits are left, so this watches for the sign that they have run out:
// Gemini answering "quota", "billing" or "credits" errors several times in a row with no good image in between.
// When that happens the hub shows a warning and one email goes to NOTIFY_EMAIL (at most one every 6 hours).

const CREDIT_WORDS = /prepayment|credit|billing|exceeded your current quota|resource_exhausted|quota/i;
const TRIGGER = 3;
let streak = 0;
let lastEmail = 0;
let ready: Promise<void> | null = null;

function ensure() {
  if (!ready) {
    ready = db.execute(sql`CREATE TABLE IF NOT EXISTS ai_credit_status (id INT PRIMARY KEY, low BOOLEAN NOT NULL DEFAULT false, message TEXT NOT NULL DEFAULT '', since TIMESTAMPTZ)`)
      .then(() => db.execute(sql`INSERT INTO ai_credit_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING`))
      .then(() => undefined);
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export async function geminiOk(): Promise<void> {
  if (streak === 0) return;
  streak = 0;
  try {
    await ensure();
    await db.execute(sql`UPDATE ai_credit_status SET low = false, message = '', since = NULL WHERE id = 1 AND low = true`);
  } catch (err) {
    logger.warn({ err }, "Could not clear the AI credit warning");
  }
}

export async function geminiFailed(msg: string): Promise<void> {
  if (!CREDIT_WORDS.test(msg)) return;
  streak++;
  if (streak < TRIGGER) return;
  try {
    await ensure();
    const short = msg.slice(0, 300);
    await db.execute(sql`UPDATE ai_credit_status SET low = true, message = ${short}, since = COALESCE(since, now()) WHERE id = 1`);
    if (Date.now() - lastEmail > 6 * 60 * 60 * 1000) {
      lastEmail = Date.now();
      await notifyOwner(
        "Your Google AI Studio credits may have run out",
        `The Studio portraits and other AI images have failed ${streak} times in a row with a quota or credits error, so the credits are probably empty.\n\nTop up at https://aistudio.google.com (Billing) and it will start working again on its own.\n\nWhat Google said: ${short}\n\nThe CyberSuite`,
      );
    }
  } catch (err) {
    logger.warn({ err }, "Could not record the AI credit warning");
  }
}

export async function creditStatus(): Promise<{ low: boolean; message: string; since: string | null }> {
  await ensure();
  const r = await db.execute(sql`SELECT low, message, since FROM ai_credit_status WHERE id = 1`);
  const row = (r.rows[0] ?? {}) as { low?: boolean; message?: string; since?: string | null };
  return { low: !!row.low, message: row.message ?? "", since: row.since ?? null };
}
