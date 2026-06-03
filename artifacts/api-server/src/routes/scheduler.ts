import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable, type StickerConfig } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";

const router = Router();

router.get("/scheduler/posts", async (req, res) => {
  try {
    const { status, presetId, from, to } = req.query as Record<string, string>;
    const conditions = [];
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(scheduledPostsTable.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(scheduledPostsTable.status, statuses));
      }
    }
    if (presetId) conditions.push(eq(scheduledPostsTable.presetId, Number(presetId)));
    if (from) conditions.push(gte(scheduledPostsTable.scheduledAt, new Date(from)));
    if (to) conditions.push(lte(scheduledPostsTable.scheduledAt, new Date(to)));

    const posts = await db
      .select()
      .from(scheduledPostsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(scheduledPostsTable.scheduledAt));

    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/scheduler/posts", async (req, res) => {
  try {
    const {
      presetId,
      clientName,
      postType,
      content,
      scheduledAt,
      isTrial,
      notes,
      stickerConfig,
    } = req.body as {
      presetId: number;
      clientName?: string;
      postType: "carousel" | "reel" | "story" | "stories" | "single-image" | "about-me" | "seamless";
      content: { imageUrls?: string[]; videoUrl?: string; caption: string; title: string };
      scheduledAt: string;
      isTrial?: boolean;
      notes?: string;
      stickerConfig?: StickerConfig | null;
    };

    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (!postType) { res.status(400).json({ error: "postType required" }); return; }
    if (!scheduledAt) { res.status(400).json({ error: "scheduledAt required" }); return; }
    if (!content?.caption) { res.status(400).json({ error: "content.caption required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const [post] = await db
      .insert(scheduledPostsTable)
      .values({
        presetId,
        clientName: clientName || preset.name,
        postType,
        content,
        scheduledAt: new Date(scheduledAt),
        isTrial: isTrial ?? false,
        notes: notes ?? "",
        stickerConfig: stickerConfig ?? null,
      })
      .returning();

    res.status(201).json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/scheduler/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { scheduledAt, status, notes, content } = req.body as {
      scheduledAt?: string;
      status?: string;
      notes?: string;
      content?: object;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (scheduledAt) updates.scheduledAt = new Date(scheduledAt);
    if (status === "cancelled") updates.status = "cancelled";
    if (notes !== undefined) updates.notes = notes;
    if (content) updates.content = content;

    const [updated] = await db
      .update(scheduledPostsTable)
      .set(updates)
      .where(eq(scheduledPostsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ post: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/scheduler/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/scheduler/posts/:id/retry", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [post] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    if (post.status !== "failed") { res.status(400).json({ error: "Only failed posts can be retried" }); return; }

    const [updated] = await db
      .update(scheduledPostsTable)
      .set({
        status: "pending",
        metaStatus: "pending",
        metaResult: null,
        metaPostedAt: null,
        ccStatus: "pending",
        ccResult: null,
        ccPostedAt: null,
        scheduledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduledPostsTable.id, id))
      .returning();

    res.json({ post: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/scheduler/stats", async (req, res) => {
  try {
    const rows = await db
      .select({
        clientName: scheduledPostsTable.clientName,
        postType: scheduledPostsTable.postType,
        status: scheduledPostsTable.status,
        metaStatus: scheduledPostsTable.metaStatus,
        ccStatus: scheduledPostsTable.ccStatus,
      })
      .from(scheduledPostsTable)
      .where(inArray(scheduledPostsTable.status, ["published", "failed"]));

    const totals = { total: 0, metaSuccess: 0, metaFail: 0, ccSuccess: 0, ccFail: 0 };
    const byClient: Record<string, typeof totals> = {};

    for (const row of rows) {
      totals.total++;
      if (row.metaStatus === "success") totals.metaSuccess++;
      if (row.metaStatus === "failed") totals.metaFail++;
      if (row.ccStatus === "success") totals.ccSuccess++;
      if (row.ccStatus === "failed") totals.ccFail++;

      if (!byClient[row.clientName]) {
        byClient[row.clientName] = { total: 0, metaSuccess: 0, metaFail: 0, ccSuccess: 0, ccFail: 0 };
      }
      byClient[row.clientName].total++;
      if (row.metaStatus === "success") byClient[row.clientName].metaSuccess++;
      if (row.metaStatus === "failed") byClient[row.clientName].metaFail++;
      if (row.ccStatus === "success") byClient[row.clientName].ccSuccess++;
      if (row.ccStatus === "failed") byClient[row.clientName].ccFail++;
    }

    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scheduledPostsTable)
      .where(inArray(scheduledPostsTable.status, ["pending", "processing"]));

    res.json({
      totals,
      byClient,
      pendingCount: Number(pendingCount[0]?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
