import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  clientPresetsTable,
  contentLibraryTable,
  scheduledPostsTable,
  TEXT_POSITIONS,
  TEXT_ALIGNS,
  LOGO_POSITIONS,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const VALID_TEXT_POSITIONS = new Set(TEXT_POSITIONS);
const VALID_TEXT_ALIGNS = new Set(TEXT_ALIGNS);
const VALID_LOGO_POSITIONS = new Set(LOGO_POSITIONS);

const router: IRouter = Router();

router.get("/presets", async (_req, res) => {
  try {
    const presets = await db.select().from(clientPresetsTable).orderBy(clientPresetsTable.name);
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list presets" });
  }
});

router.get("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, id));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ preset });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get preset" });
  }
});

router.post("/presets", async (req, res) => {
  try {
    const { name, ...settings } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    if (settings.textPosition !== undefined && !VALID_TEXT_POSITIONS.has(settings.textPosition)) {
      res.status(400).json({ error: `Invalid textPosition "${settings.textPosition}". Must be one of: ${TEXT_POSITIONS.join(", ")}.` });
      return;
    }
    if (settings.textAlign !== undefined && !VALID_TEXT_ALIGNS.has(settings.textAlign)) {
      res.status(400).json({ error: `Invalid textAlign "${settings.textAlign}". Must be one of: ${TEXT_ALIGNS.join(", ")}.` });
      return;
    }
    if (settings.logoPosition !== undefined && !VALID_LOGO_POSITIONS.has(settings.logoPosition)) {
      res.status(400).json({ error: `Invalid logoPosition "${settings.logoPosition}". Must be one of: ${LOGO_POSITIONS.join(", ")}.` });
      return;
    }
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
    res.status(500).json({ error: err.message || "Failed to create preset" });
  }
});

router.put("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { name, ...settings } = req.body;
    if (settings.textPosition !== undefined && !VALID_TEXT_POSITIONS.has(settings.textPosition)) {
      res.status(400).json({ error: `Invalid textPosition "${settings.textPosition}". Must be one of: ${TEXT_POSITIONS.join(", ")}.` });
      return;
    }
    if (settings.textAlign !== undefined && !VALID_TEXT_ALIGNS.has(settings.textAlign)) {
      res.status(400).json({ error: `Invalid textAlign "${settings.textAlign}". Must be one of: ${TEXT_ALIGNS.join(", ")}.` });
      return;
    }
    if (settings.logoPosition !== undefined && !VALID_LOGO_POSITIONS.has(settings.logoPosition)) {
      res.status(400).json({ error: `Invalid logoPosition "${settings.logoPosition}". Must be one of: ${LOGO_POSITIONS.join(", ")}.` });
      return;
    }
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
    res.status(500).json({ error: err.message || "Failed to update preset" });
  }
});

router.delete("/presets/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, id));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const ACTIVE_STATUSES = ["pending", "processing"] as const;

    const [deletedLibrary, deletedScheduled] = await Promise.all([
      db.delete(contentLibraryTable)
        .where(eq(contentLibraryTable.clientName, preset.name))
        .returning({ id: contentLibraryTable.id }),
      db.delete(scheduledPostsTable)
        .where(
          and(
            eq(scheduledPostsTable.presetId, id),
            inArray(scheduledPostsTable.status, [...ACTIVE_STATUSES]),
          ),
        )
        .returning({ id: scheduledPostsTable.id }),
    ]);

    await db.delete(clientPresetsTable).where(eq(clientPresetsTable.id, id));

    res.json({
      success: true,
      deleted: {
        libraryItems: deletedLibrary.length,
        pendingPosts: deletedScheduled.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete preset" });
  }
});

export default router;
