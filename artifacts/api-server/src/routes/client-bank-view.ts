import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Reserved for clients Vanessa doesn't have Meta access for -- she parks
// content in the Client Bank as usual, then shares this link with just the
// clients she chooses so they can view and download it themselves. Same
// slug scheme as content-preview.ts, deliberately -- no separate token
// table needed since access is controlled by who she hands the link to.
function safeClientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/client-bank-view/:clientSlug", async (req, res) => {
  try {
    const { clientSlug } = req.params;

    const presets = await db.select().from(clientPresetsTable);
    const preset = presets.find((p) => safeClientSlug(p.name) === clientSlug);
    if (!preset) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const rows = await db
      .select()
      .from(scheduledPostsTable)
      .where(and(eq(scheduledPostsTable.presetId, preset.id), eq(scheduledPostsTable.status, "draft")))
      .orderBy(desc(scheduledPostsTable.createdAt));

    const posts = rows.map((p) => ({
      id: p.id,
      postType: p.postType,
      title: p.content?.title || "",
      caption: p.content?.caption || "",
      imageUrls: p.content?.imageUrls || [],
      videoUrl: p.content?.videoUrl || null,
      createdAt: (p.createdAt as Date).toISOString(),
    }));

    res.json({ clientName: preset.name, logoUrl: preset.logoUrl || null, posts });
  } catch (err: unknown) {
    logger.error({ err }, "client-bank-view fetch failed");
    res.status(500).json({ error: "Failed to load bank" });
  }
});

export default router;
