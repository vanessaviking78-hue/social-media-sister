import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastTopicsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// Admin: every topic in the shared content library, newest first.
router.get("/broadcast-topics", async (_req, res) => {
  try {
    const topics = await db.select().from(broadcastTopicsTable).orderBy(desc(broadcastTopicsTable.createdAt));
    res.json({ topics });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load topics" });
  }
});

// Admin: bulk import rows from a CSV upload.
router.post("/broadcast-topics/bulk", async (req, res) => {
  try {
    const { rows } = req.body as {
      rows?: { slide1_hook?: string; slide1_subtitle?: string; slide2_body?: string; slide3_body?: string; slide4_cta?: string; category?: string }[];
    };
    if (!rows || !rows.length) {
      res.status(400).json({ error: "No rows to import" });
      return;
    }
    const values = rows.map((r) => ({
      slide1Hook: r.slide1_hook || "",
      slide1Subtitle: r.slide1_subtitle || "",
      slide2Body: r.slide2_body || "",
      slide3Body: r.slide3_body || "",
      slide4Cta: r.slide4_cta || "",
      category: r.category || "",
    }));
    const inserted = await db.insert(broadcastTopicsTable).values(values).returning();
    res.status(201).json({ topics: inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to import topics" });
  }
});

// Admin: remove a topic.
router.delete("/broadcast-topics/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(broadcastTopicsTable).where(eq(broadcastTopicsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete topic" });
  }
});

export default router;
