import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte, or, sql } from "drizzle-orm";
import crypto from "crypto";
import { getApprovedIdeaForClient } from "./revenue-ideas";
import { getVapidPublicKey } from "../lib/push";

const router: IRouter = Router();

router.post("/presets/:id/generate-portal-token", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const token = crypto.randomBytes(24).toString("hex");
    const [updated] = await db.update(clientPresetsTable)
      .set({ clientPortalToken: token, updatedAt: new Date() })
      .where(eq(clientPresetsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate token" });
  }
});

router.get("/portal/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const clientName = preset.name;
    const today = new Date().toISOString().slice(0, 10);

    const upcomingPosts = await db.select().from(calendarPostsTable)
      .where(and(
        eq(calendarPostsTable.clientName, clientName),
        or(
          eq(calendarPostsTable.status, "scheduled"),
          eq(calendarPostsTable.status, "draft"),
        ),
        gte(calendarPostsTable.date, today),
      ));
    upcomingPosts.sort((a, b) => a.date.localeCompare(b.date));

    // Fold in upcoming posts queued through the scheduler (Bulk Carousel etc.)
    const nowTs = new Date();
    const scheduledRaw = await db.select().from(scheduledPostsTable)
      .where(and(
        eq(scheduledPostsTable.presetId, preset.id),
        eq(scheduledPostsTable.status, "pending"),
        gte(scheduledPostsTable.scheduledAt, nowTs),
      ));
    const scheduledMapped = scheduledRaw.map((sp) => {
      const c = (sp.content || {}) as { imageUrls?: string[]; caption?: string; title?: string };
      return {
        id: 900000000 + sp.id,
        date: new Date(sp.scheduledAt).toISOString().slice(0, 10),
        title: c.title || "",
        caption: c.caption || "",
        postType: sp.postType,
        status: "scheduled",
        color: "#ec4899",
        imageUrl: (c.imageUrls && c.imageUrls[0]) || null,
      };
    });
    const mergedUpcoming = [...upcomingPosts, ...scheduledMapped].sort((a, b) => a.date.localeCompare(b.date));

    const batches = await db.select().from(approvalBatchesTable)
      .where(eq(approvalBatchesTable.clientName, clientName));

    const batchesWithCounts = await Promise.all(batches.map(async (b) => {
      const images = await db.select().from(approvalImagesTable)
        .where(eq(approvalImagesTable.batchId, b.id));
      return {
        ...b,
        totalImages: images.length,
        pendingImages: images.filter((i) => i.status === "pending").length,
        approvedImages: images.filter((i) => i.status === "approved").length,
        rejectedImages: images.filter((i) => i.status === "rejected").length,
      };
    }));
    batchesWithCounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const revenueIdea = await getApprovedIdeaForClient(clientName).catch(() => null);

    res.json({
      clientName,
      logoUrl: preset.logoUrl || null,
      upcomingPosts: mergedUpcoming,
      approvalBatches: batchesWithCounts,
      revenueIdea,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load portal" });
  }
});

// Public key the client portal needs to call pushManager.subscribe(). Safe to
// expose — it's the public half of the VAPID keypair, not a secret.
router.get("/portal-push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) { res.status(503).json({ error: "Push notifications aren't set up yet" }); return; }
  res.json({ publicKey: key });
});

// Stores (or refreshes) a browser's push subscription against a client's
// existing portal token. No login involved, the token itself is the identity.
router.post("/portal/:token/push-subscribe", async (req, res) => {
  try {
    const { token } = req.params;
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    await db.execute(sql`
      INSERT INTO portal_push_subscriptions (client_portal_token, endpoint, p256dh, auth)
      VALUES (${token}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET client_portal_token = EXCLUDED.client_portal_token
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save subscription" });
  }
});

// Called when a client turns notifications back off on a device.
router.post("/portal/:token/push-unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
    await db.execute(sql`DELETE FROM portal_push_subscriptions WHERE endpoint = ${endpoint}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove subscription" });
  }
});

export default router;
