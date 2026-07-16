import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, broadcastTopicsTable } from "@workspace/db";

const router = Router();

router.get("/broadcast-topics", async (_req, res) => {
  const topics = await db.select().from(broadcastTopicsTable).orderBy(broadcastTopicsTable.id);
  res.json({ topics });
});

router.post("/broadcast-topics/bulk", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    res.status(400).json({ error: "No rows provided" });
    return;
  }
  const inserted = await db
    .insert(broadcastTopicsTable)
    .values(
      rows.map((r: any) => ({
        slide1Hook: r.slide1_hook || "",
        slide1Subtitle: r.slide1_subtitle || "",
        slide2Body: r.slide2_body || "",
        slide3Body: r.slide3_body || "",
        slide4Cta: r.slide4_cta || "",
        category: r.category || "",
      }))
    )
    .returning();
  res.status(201).json({ topics: inserted });
});

router.patch("/broadcast-topics/:id/image", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const updated = await db
    .update(broadcastTopicsTable)
    .set({ imageUrl })
    .where(eq(broadcastTopicsTable.id, id))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  res.json({ topic: updated[0] });
});

router.delete("/broadcast-topics/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(broadcastTopicsTable).where(eq(broadcastTopicsTable.id, id));
  res.json({ success: true });
});

export default router;
