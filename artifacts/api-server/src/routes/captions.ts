import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { captionsTable } from "@workspace/db/schema";
import { eq, ilike, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/captions", async (req, res) => {
  try {
    const { search, category, client } = req.query;

    let query = db.select().from(captionsTable).$dynamic();

    const conditions = [];
    if (search && typeof search === "string" && search.trim()) {
      conditions.push(ilike(captionsTable.text, `%${search.trim()}%`));
    }
    if (category && typeof category === "string" && category.trim()) {
      conditions.push(eq(captionsTable.category, category.trim()));
    }
    if (client && typeof client === "string" && client.trim()) {
      conditions.push(eq(captionsTable.clientName, client.trim()));
    }

    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      let combined = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        combined = and(combined, conditions[i])!;
      }
      query = query.where(combined);
    }

    const captions = await query.orderBy(desc(captionsTable.createdAt));
    res.json({ captions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list captions";
    console.error("List captions error:", err);
    res.status(500).json({ error: message });
  }
});

router.post("/captions", async (req, res) => {
  try {
    const { text, category, clientName, favourite } = req.body;
    if (!text?.trim()) { res.status(400).json({ error: "Caption text is required" }); return; }
    const [caption] = await db.insert(captionsTable).values({
      text: text.trim(),
      category: category?.trim() || "General",
      clientName: clientName?.trim() || "",
      favourite: favourite ?? false,
    }).returning();
    res.json({ caption });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create caption";
    console.error("Create caption error:", err);
    res.status(500).json({ error: message });
  }
});

router.post("/captions/bulk", async (req, res) => {
  try {
    const { captions: items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Captions array is required" });
      return;
    }
    const values = items
      .filter((item: { text?: string }) => item.text?.trim())
      .map((item: { text: string; category?: string; clientName?: string }) => ({
        text: item.text.trim(),
        category: item.category?.trim() || "General",
        clientName: item.clientName?.trim() || "",
        favourite: false,
      }));
    if (values.length === 0) { res.status(400).json({ error: "No valid captions provided" }); return; }
    const created = await db.insert(captionsTable).values(values).returning();
    res.json({ captions: created, count: created.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to bulk save captions";
    console.error("Bulk save captions error:", err);
    res.status(500).json({ error: message });
  }
});

router.put("/captions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { text, category, clientName, favourite } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (text !== undefined) updates.text = text.trim();
    if (category !== undefined) updates.category = category.trim();
    if (clientName !== undefined) updates.clientName = clientName.trim();
    if (favourite !== undefined) updates.favourite = favourite;
    const [caption] = await db.update(captionsTable)
      .set(updates)
      .where(eq(captionsTable.id, id))
      .returning();
    if (!caption) { res.status(404).json({ error: "Caption not found" }); return; }
    res.json({ caption });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update caption";
    console.error("Update caption error:", err);
    res.status(500).json({ error: message });
  }
});

router.delete("/captions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db.delete(captionsTable).where(eq(captionsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Caption not found" }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete caption";
    console.error("Delete caption error:", err);
    res.status(500).json({ error: message });
  }
});

export default router;
