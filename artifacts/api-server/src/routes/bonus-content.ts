import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bonusContentTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// Admin: every bonus content item for one client, newest first.
router.get("/bonus-content", async (req, res) => {
  try {
    const presetId = req.query.presetId ? Number(req.query.presetId) : null;
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    const items = await db.select().from(bonusContentTable)
      .where(eq(bonusContentTable.presetId, presetId))
      .orderBy(desc(bonusContentTable.createdAt));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load bonus content" });
  }
});

// Admin: drop a new item into a client's bonus content.
router.post("/bonus-content", async (req, res) => {
  try {
    const { presetId, title, note, mediaUrl, mediaType } = req.body as {
      presetId?: number; title?: string; note?: string; mediaUrl?: string; mediaType?: string;
    };
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const [item] = await db.insert(bonusContentTable)
      .values({
        presetId,
        clientName: preset.name,
        title: title || "",
        note: note || "",
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || "none",
      })
      .returning();
    res.status(201).json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save bonus content" });
  }
});

// Admin: remove an item.
router.delete("/bonus-content/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(bonusContentTable).where(eq(bonusContentTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete item" });
  }
});

export default router;
