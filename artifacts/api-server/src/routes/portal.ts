import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable, homeworkQuestionSetsTable, homeworkRepliesTable, bonusContentTable } from "@workspace/db/schema";
import { eq, and, gte, or, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import { getApprovedIdeasForClient } from "./revenue-ideas";
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
        imageUrls: c.imageUrls || [],
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

    const revenueIdeas = await getApprovedIdeasForClient(clientName).catch(() => []);

    res.json({
      clientName,
      logoUrl: preset.logoUrl || null,
      upcomingPosts: mergedUpcoming,
      approvalBatches: batchesWithCounts,
      revenueIdeas,
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

// Client: current active weekly homework questions, plus this clients existing reply if any.
router.get("/portal/:token/homework", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const [set] = await db.select().from(homeworkQuestionSetsTable)
      .where(eq(homeworkQuestionSetsTable.status, "active"))
      .orderBy(desc(homeworkQuestionSetsTable.createdAt))
      .limit(1);

    let existingReply = null;
    if (set) {
      const [reply] = await db.select().from(homeworkRepliesTable)
        .where(and(
          eq(homeworkRepliesTable.setId, set.id),
          eq(homeworkRepliesTable.presetId, preset.id),
        ));
      existingReply = reply || null;
    }

    res.json({ set: set || null, existingReply });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load homework" });
  }
});

// Client: submit or update the current weeks homework reply.
router.post("/portal/:token/homework/reply", async (req, res) => {
  try {
    const { token } = req.params;
    const { setId, answer1, answer2, answer3 } = req.body as {
      setId?: number; answer1?: string; answer2?: string; answer3?: string;
    };
    if (!setId) { res.status(400).json({ error: "setId required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const [existing] = await db.select().from(homeworkRepliesTable)
      .where(and(
        eq(homeworkRepliesTable.setId, setId),
        eq(homeworkRepliesTable.presetId, preset.id),
      ));

    if (existing) {
      const [updated] = await db.update(homeworkRepliesTable)
        .set({
          answer1: answer1 || "",
          answer2: answer2 || "",
          answer3: answer3 || "",
          updatedAt: new Date(),
        })
        .where(eq(homeworkRepliesTable.id, existing.id))
        .returning();
      res.json({ reply: updated });
      return;
    }

    const [reply] = await db.insert(homeworkRepliesTable)
      .values({
        setId,
        presetId: preset.id,
        clientName: preset.name,
        answer1: answer1 || "",
        answer2: answer2 || "",
        answer3: answer3 || "",
      })
      .returning();
    res.status(201).json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save homework reply" });
  }
});

// Client: bonus content dropped in for this client, newest first.
router.get("/portal/:token/bonus-content", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const items = await db.select().from(bonusContentTable)
      .where(eq(bonusContentTable.presetId, preset.id))
      .orderBy(desc(bonusContentTable.createdAt));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load bonus content" });
  }
});

export default router;
