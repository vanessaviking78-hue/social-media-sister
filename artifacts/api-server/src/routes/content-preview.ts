import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeClientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/content-preview/:clientSlug", async (req, res) => {
  try {
    const { clientSlug } = req.params;

    const presets = await db.select().from(clientPresetsTable);
    const preset = presets.find((p) => safeClientSlug(p.name) === clientSlug);

    if (!preset) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const posts = await db
      .select({
        id: scheduledPostsTable.id,
        scheduledAt: scheduledPostsTable.scheduledAt,
        postType: scheduledPostsTable.postType,
        content: scheduledPostsTable.content,
        status: scheduledPostsTable.status,
      })
      .from(scheduledPostsTable)
      .where(eq(scheduledPostsTable.presetId, preset.id))
      .orderBy(scheduledPostsTable.scheduledAt);

    const safe = posts
      .filter((p) => ["pending", "processing", "published"].includes(p.status))
      .map((p) => ({
        id: p.id,
        scheduledAt: p.scheduledAt,
        postType: p.postType,
        thumbnailUrl: (p.content as { imageUrls?: string[] })?.imageUrls?.[0] ?? null,
        title: (p.content as { title?: string })?.title ?? "",
        status: p.status,
      }));

    res.json({
      clientName: preset.name,
      logoUrl: preset.logoUrl ?? null,
      posts: safe,
    });
  } catch (err: any) {
    logger.error({ err }, "content-preview fetch failed");
    res.status(500).json({ error: "Failed to load preview" });
  }
});

export default router;
