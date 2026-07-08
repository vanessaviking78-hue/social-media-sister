mport { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte, or } from "drizzle-orm";
import crypto from "crypto";
import { notifyReject } from "../lib/notify";

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
          const calendarMapped = upcomingPosts.map((p) => ({
                  id: p.id,
                  source: "calendar" as const,
                  scheduledPostId: null as number | null,
                  date: p.date,
                  title: p.title,
                  caption: p.caption,
                  postType: p.postType,
                  status: p.status,
                  color: p.color,
                  imageUrl: p.imageUrl,
                  imageUrls: p.imageUrl ? [p.imageUrl] : [],
          }));

      const nowTs = new Date();
          const scheduledRaw = await db.select().from(scheduledPostsTable)
            .where(and(
                      eq(scheduledPostsTable.presetId, preset.id),
                      eq(scheduledPostsTable.status, "pending"),
                      gte(scheduledPostsTable.scheduledAt, nowTs),
                    ));
          const scheduledMapped = scheduledRaw.map((sp) => {
                  const c = (sp.content || {}) as { imageUrls?: string[]; videoUrl?: string; caption?: string; title?: string };
                  const imageUrls = c.imageUrls && c.imageUrls.length > 0 ? c.imageUrls : (c.videoUrl ? [c.videoUrl] : []);
                  return {
                            id: 900000000 + sp.id,
                            source: "scheduler" as const,
                            scheduledPostId: sp.id as number | null,
                            date: new Date(sp.scheduledAt).toISOString().slice(0, 10),
                            title: c.title || "",
                            caption: c.caption || "",
                            postType: sp.postType,
                            status: "scheduled",
                            color: "#ec4899",
                            imageUrl: imageUrls[0] || null,
                            imageUrls,
                  };
          });
          const mergedUpcoming = [...calendarMapped, ...scheduledMapped].sort((a, b) => a.date.localeCompare(b.date));

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

router.post("/portal/:token/posts/:id/reject", async (req, res) => {
  try {
        const { token, id } = req.params;
        const { reason } = req.body as { reason?: string };
        if (!reason || !reason.trim()) { res.status(400).json({ error: "A reason is required." }); return; }

      const [preset] = await db.select().from(clientPresetsTable)
          .where(eq(clientPresetsTable.clientPortalToken, token));
        if (!preset) { res.status(404).json({ error: "not_found" }); return; }

      const postId = Number(id);
        if (isNaN(postId)) { res.status(400).json({ error: "Invalid post id" }); return; }

      const [post] = await db.select().from(scheduledPostsTable)
          .where(and(eq(scheduledPostsTable.id, postId), eq(scheduledPostsTable.presetId, preset.id)));
        if (!post) { res.status(404).json({ error: "Post not found" }); return; }
        if (post.status !== "pending") { res.status(400).json({ error: "This post has already gone out or been actioned." }); return; }

      const content = (post.content || {}) as { title?: string; caption?: string };
        const trimmedReason = reason.trim().slice(0, 2000);
        const combinedNotes = post.notes ? `${post.notes}\nRejected by client: ${trimmedReason}` : `Rejected by client: ${trimmedReason}`;

      await db.update(scheduledPostsTable)
          .set({ status: "cancelled", notes: combinedNotes, updatedAt: new Date() })
          .where(eq(scheduledPostsTable.id, postId));

      void notifyReject({
              clientName: preset.name,
              title: content.title || content.caption?.slice(0, 60) || "a scheduled post",
              reason: trimmedReason,
      });

      res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reject post" });
  }
});

export default router;
