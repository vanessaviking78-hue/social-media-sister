import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { broadcastDraftsTable } from "@workspace/db/schema";

const router = Router();

router.get("/broadcast-drafts", async (_req, res) => {
  try {
    const drafts = await db.select().from(broadcastDraftsTable).orderBy(broadcastDraftsTable.id);
    res.json({ drafts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load drafts" });
  }
});

router.post("/broadcast-drafts/bulk", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      res.status(400).json({ error: "No rows provided" });
      return;
    }
    const inserted = await db
      .insert(broadcastDraftsTable)
      .values(
        rows.map((r: any) => ({
          presetId: r.presetId,
          clientName: r.clientName || "",
          topicId: r.topicId ?? null,
          imageUrls: r.imageUrls || [],
          caption: r.caption || "",
          title: r.title || "",
        }))
      )
      .returning();
    res.status(201).json({ drafts: inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save drafts" });
  }
});

router.delete("/broadcast-drafts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(broadcastDraftsTable).where(eq(broadcastDraftsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete draft" });
  }
});

export default router;
