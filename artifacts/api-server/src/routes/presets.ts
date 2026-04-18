import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/presets", async (_req, res) => {
  try {
    const presets = await db.select().from(clientPresetsTable).orderBy(clientPresetsTable.name);
    res.json({ presets });
  } catch (err: any) {
    console.error("List presets error:", err);
    res.status(500).json({ error: err.message || "Failed to list presets" });
  }
});

router.get("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, id));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ preset });
  } catch (err: any) {
    console.error("Get preset error:", err);
    res.status(500).json({ error: err.message || "Failed to get preset" });
  }
});

router.post("/presets", async (req, res) => {
  try {
    const { name, ...settings } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    const [preset] = await db.insert(clientPresetsTable).values({
      name: name.trim(),
      ...settings,
    }).returning();
    res.json({ preset });
  } catch (err: any) {
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      res.status(409).json({ error: `A client named "${req.body.name?.trim()}" already exists.` });
      return;
    }
    console.error("Create preset error:", err);
    res.status(500).json({ error: err.message || "Failed to create preset" });
  }
});

router.put("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { name, ...settings } = req.body;
    const [preset] = await db.update(clientPresetsTable)
      .set({ name: name?.trim(), ...settings, updatedAt: new Date() })
      .where(eq(clientPresetsTable.id, id))
      .returning();
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ preset });
  } catch (err: any) {
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      res.status(409).json({ error: `A client named "${req.body.name?.trim()}" already exists.` });
      return;
    }
    console.error("Update preset error:", err);
    res.status(500).json({ error: err.message || "Failed to update preset" });
  }
});

router.delete("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db.delete(clientPresetsTable).where(eq(clientPresetsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete preset error:", err);
    res.status(500).json({ error: err.message || "Failed to delete preset" });
  }
});

export default router;
