import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { dmAutomationsTable, dmInteractionsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "sms-cybersuite-webhook";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_GRAPH_VERSION = "v22.0";

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!META_APP_SECRET || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function sendDmReply(igAccountId: string, recipientId: string, token: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta DM reply failed: ${res.status} ${err}`);
  }
}

function matchesKeyword(messageText: string, keyword: string, exact: boolean, caseSensitive: boolean): boolean {
  const msg = caseSensitive ? messageText : messageText.toLowerCase();
  const kw = caseSensitive ? keyword : keyword.toLowerCase();
  return exact ? msg.trim() === kw.trim() : msg.includes(kw);
}

router.get("/webhooks/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    req.log.info("Instagram webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

router.post("/webhooks/instagram", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody: Buffer = (req as any).rawBody;
  if (rawBody && META_APP_SECRET && signature) {
    if (!verifySignature(rawBody, signature)) {
      req.log.warn("Instagram webhook signature mismatch");
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  }

  res.status(200).json({ status: "ok" });

  const body = req.body as any;
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const igAccountId: string = entry.id;
    const messaging: any[] = entry.messaging ?? [];

    for (const event of messaging) {
      const senderId: string = event.sender?.id;
      const messageText: string | undefined = event.message?.text;
      if (!senderId || !messageText || event.message?.is_echo) continue;

      try {
        const presets = await db
          .select()
          .from(clientPresetsTable)
          .where(eq(clientPresetsTable.metaInstagramAccountId, igAccountId));

        if (presets.length === 0) continue;
        const preset = presets[0];

        const automations = await db
          .select()
          .from(dmAutomationsTable)
          .where(and(eq(dmAutomationsTable.presetId, preset.id), eq(dmAutomationsTable.isActive, true)));

        let matched = false;
        for (const automation of automations) {
          if (!matchesKeyword(messageText, automation.keyword, automation.matchExact, automation.caseSensitive)) continue;
          matched = true;

          let replySent = false;
          let errorMessage: string | undefined;
          const replyText = automation.replyTemplate;

          try {
            if (preset.metaPageAccessToken) {
              await sendDmReply(igAccountId, senderId, preset.metaPageAccessToken, replyText);
              replySent = true;
            } else {
              errorMessage = "No page access token configured for preset";
            }
          } catch (err: any) {
            errorMessage = String(err?.message ?? err);
            req.log.error({ err, automationId: automation.id }, "DM reply failed");
          }

          await db.insert(dmInteractionsTable).values({
            automationId: automation.id,
            presetId: preset.id,
            senderId,
            igAccountId,
            messageText,
            matchedKeyword: automation.keyword,
            replySent,
            replyText: replySent ? replyText : null,
            errorMessage: errorMessage ?? null,
          });

          break;
        }

        if (!matched) {
          await db.insert(dmInteractionsTable).values({
            automationId: null,
            presetId: preset.id,
            senderId,
            igAccountId,
            messageText,
            matchedKeyword: null,
            replySent: false,
            replyText: null,
            errorMessage: null,
          });
        }
      } catch (err) {
        req.log.error({ err, igAccountId }, "Error processing DM webhook event");
      }
    }
  }
});

export default router;
