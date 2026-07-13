import webpush from "web-push";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not set — push notifications are disabled until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set.");
    return;
  }
  webpush.setVapidDetails("mailto:vanessaviking78@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type SubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubscription(sub: SubscriptionRow, payload: PushPayload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    // 404/410 means the subscription is gone (uninstalled, permissions revoked etc) — clean it up.
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await db.execute(sql`DELETE FROM portal_push_subscriptions WHERE id = ${sub.id}`);
    } else {
      console.error("[push] failed to send to subscription", sub.id, err?.message || err);
    }
  }
}

// Sends a push notification to every device a specific client has subscribed on.
export async function notifyClientByToken(clientPortalToken: string, payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;
  const rows = await db.execute(sql`
    SELECT id, endpoint, p256dh, auth FROM portal_push_subscriptions WHERE client_portal_token = ${clientPortalToken}
  `);
  const subs = (rows as any).rows ?? rows;
  await Promise.all((subs as SubscriptionRow[]).map((s) => sendToSubscription(s, payload)));
}

// Sends a push notification to every subscribed device across all clients — used for news posts.
export async function notifyAllClients(payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;
  const rows = await db.execute(sql`SELECT id, endpoint, p256dh, auth FROM portal_push_subscriptions`);
  const subs = (rows as any).rows ?? rows;
  await Promise.all((subs as SubscriptionRow[]).map((s) => sendToSubscription(s, payload)));
}
