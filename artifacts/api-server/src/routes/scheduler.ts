import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable, type StickerConfig } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";

const router = Router();

async function nextFreeMinute(desired: Date): Promise<Date> {
  const candidate = new Date(desired);
  candidate.setSeconds(0, 0);
  for (let i = 0; i < 1440; i++) {
    const windowEnd = new Date(candidate.getTime() + 59999);
    const conflict = await db
      .select({ id: scheduledPostsTable.id })
      .from(scheduledPostsTable)
      .where(and(
        inArray(scheduledPostsTable.status, ["pending", "processing"]),
        gte(scheduledPostsTable.scheduledAt, candidate),
        lte(scheduledPostsTable.scheduledAt, windowEnd),
      ))
      .limit(1);
    if (conflict.length === 0) return candidate;
    candidate.setTime(candidate.getTime() + 60000);
  }
  return candidate;
}

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

    // A "waiting room" draft has no committed date yet - Vanessa parks an idea
    // against a client and schedules it for real later (e.g. on the 1st of the
    // month) once she's sure it's the piece she wants to run. Drafts carry a
    // placeholder scheduledAt (now) purely to satisfy the NOT NULL column; the
    // scheduler cron only ever claims status="pending" rows, so a draft's
    // placeholder date can never cause it to post.
    const isDraft = (req.body as { status?: string }).status === "draft";

    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (!postType) { res.status(400).json({ error: "postType required" }); return; }
    if (!isDraft && !scheduledAt) { res.status(400).json({ error: "scheduledAt required" }); return; }
    if (content?.caption == null) { res.status(400).json({ error: "content.caption required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const [post] = await db
      .insert(scheduledPostsTable)
      .values({
        presetId,
        clientName: clientName || preset.name,
        postType,
        content,
        scheduledAt: isDraft ? new Date() : await nextFreeMinute(new Date(scheduledAt)),
        status: isDraft ? "draft" : "pending",
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
    // Releasing a draft: status flips to "pending" and a real date comes in
    // together, so route the date through the same collision-avoidance the
    // normal create path uses. Any other update (edit caption on an already-
    // pending post, cancel, etc.) keeps the date as given.
    if (scheduledAt) {
      updates.scheduledAt = status === "pending" ? await nextFreeMinute(new Date(scheduledAt)) : new Date(scheduledAt);
    }
    if (status) updates.status = status;
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

// Bulk clear-out for a client, used by the "Delete all upcoming" button on
// the scheduler page. Scoped to draft, pending and processing only, so a
// client's published history and failed log are never touched by this, only
// the posts that haven't gone out yet. Built after Vanessa needed a batch of
// CT Aesthetics posts pulled because the captions never got uploaded, so this
// is now something she can do herself instead of asking for it each time.
router.delete("/scheduler/posts", async (req, res) => {
  try {
    const { clientName, presetId } = req.query as Record<string, string>;
    if (!clientName && !presetId) {
      res.status(400).json({ error: "clientName or presetId required" });
      return;
    }

    const conditions = [inArray(scheduledPostsTable.status, ["draft", "pending", "processing"])];
    if (presetId) conditions.push(eq(scheduledPostsTable.presetId, Number(presetId)));
    if (clientName) conditions.push(eq(scheduledPostsTable.clientName, clientName));

    const deleted = await db
      .delete(scheduledPostsTable)
      .where(and(...conditions))
      .returning({ id: scheduledPostsTable.id });

    res.json({ ok: true, deletedCount: deleted.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/scheduler/posts/:id/retry", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [post] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    if (post.status !== "failed" && post.status !== "processing") { res.status(400).json({ error: "Only failed or stuck posts can be retried" }); return; }

    const [updated] = await db
      .update(scheduledPostsTable)
      .set({
        status: "pending",
        metaStatus: "pending",
        metaResult: null,
        metaPostedAt: null,
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
      })
      .from(scheduledPostsTable)
      .where(inArray(scheduledPostsTable.status, ["published", "failed"]));

    const totals = { total: 0, metaSuccess: 0, metaFail: 0 };
    const byClient: Record<string, typeof totals> = {};

    for (const row of rows) {
      totals.total++;
      if (row.metaStatus === "success") totals.metaSuccess++;
      if (row.metaStatus === "failed") totals.metaFail++;

      if (!byClient[row.clientName]) {
        byClient[row.clientName] = { total: 0, metaSuccess: 0, metaFail: 0 };
      }
      byClient[row.clientName].total++;
      if (row.metaStatus === "success") byClient[row.clientName].metaSuccess++;
      if (row.metaStatus === "failed") byClient[row.clientName].metaFail++;
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
