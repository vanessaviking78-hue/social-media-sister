import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte, or } from "drizzle-orm";
import crypto from "crypto";

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

    res.json({
      clientName,
      logoUrl: preset.logoUrl || null,
      upcomingPosts: mergedUpcoming,
      approvalBatches: batchesWithCounts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load portal" });
  }
});

export default router;
