import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  clientPresetsTable,
  contentLibraryTable,
  scheduledPostsTable,
  approvalBatchesTable,
  approvalImagesTable,
  calendarPostsTable,
  aboutMePostsTable,
  seamlessCarouselsTable,
  aiSourcePhotosTable,
  aiGeneratedPortraitsTable,
  dmInteractionsTable,
  TEXT_POSITIONS,
  TEXT_ALIGNS,
  LOGO_POSITIONS,
} from "@workspace/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { reelsChallengeCompletionsTable } from "@workspace/db/schema";
import { REELS_CHALLENGE_ITEMS } from "./portal";

const VALID_TEXT_POSITIONS = new Set(TEXT_POSITIONS);
const VALID_TEXT_ALIGNS = new Set(TEXT_ALIGNS);
const VALID_LOGO_POSITIONS = new Set(LOGO_POSITIONS);

const router: IRouter = Router();

router.get("/presets", async (_req, res) => {
  try {
    const presets = await db.select().from(clientPresetsTable).orderBy(sql`LOWER(${clientPresetsTable.name})`);
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list presets" });
  }
});

router.get("/presets/reel-progress", async (_req, res) => {
  try {
    const presets = await db.select({
      id: clientPresetsTable.id,
      name: clientPresetsTable.name,
      completedReels: clientPresetsTable.completedReels,
    }).from(clientPresetsTable).orderBy(sql`LOWER(${clientPresetsTable.name})`);
    const progress = presets.map((p) => {
      let ticked: Record<string, boolean> = {};
      try { ticked = JSON.parse(p.completedReels || "{}"); } catch { ticked = {}; }
      const done = Object.values(ticked).filter(Boolean).length;
      return { id: p.id, name: p.name, done, total: 100 };
    });
    res.json({ progress });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load reel progress" });
  }
});

router.get("/presets/reels-challenge-progress", async (_req, res) => {
  try {
    const presets = await db.select({ id: clientPresetsTable.id, name: clientPresetsTable.name })
      .from(clientPresetsTable)
      .orderBy(sql`LOWER(${clientPresetsTable.name})`);
    const completions = await db.select().from(reelsChallengeCompletionsTable);
    const byClient = new Map<string, number[]>();
    for (const c of completions) {
      const arr = byClient.get(c.clientName) || [];
      arr.push(c.itemIndex);
      byClient.set(c.clientName, arr);
    }
    const progress = presets
      .map((p) => {
        const completedIndexes = (byClient.get(p.name) || []).slice().sort((a, b) => a - b);
        return { id: p.id, name: p.name, completedIndexes, done: completedIndexes.length, total: REELS_CHALLENGE_ITEMS.length };
      })
      .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));
    res.json({ progress, items: REELS_CHALLENGE_ITEMS });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load reels challenge progress" });
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

const DEFAULT_FIRST_COMMENT_CAROUSEL = "I'd love to know your thoughts";
const DEFAULT_FIRST_COMMENT_SINGLE   = "Save this for later";
const DEFAULT_FIRST_COMMENT_REEL     = "Save this and share to someone who needs to know";

const DEFAULT_TARGET_AUDIENCE = "Women over 35, perimenopause, women in the local area, who want to feel good in themselves";
const DEFAULT_CONTENT_PILLARS = "Set by Vanessa's spreadsheets";
const DEFAULT_BRAND_NOTES     = "Warm, affable, friendly, personality over professionalism. Affable.";

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
      defaultFirstCommentCarousel: DEFAULT_FIRST_COMMENT_CAROUSEL,
      defaultFirstCommentSingle:   DEFAULT_FIRST_COMMENT_SINGLE,
      defaultFirstCommentReel:     DEFAULT_FIRST_COMMENT_REEL,
      targetAudience: DEFAULT_TARGET_AUDIENCE,
      contentPillars: DEFAULT_CONTENT_PILLARS,
      brandNotes:     DEFAULT_BRAND_NOTES,
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

    const clientName = preset.name;

    const batches = await db
      .select({ id: approvalBatchesTable.id })
      .from(approvalBatchesTable)
      .where(eq(approvalBatchesTable.presetId, id));
    const batchIds = batches.map((b) => b.id);

    if (batchIds.length > 0) {
      await db.delete(approvalImagesTable).where(inArray(approvalImagesTable.batchId, batchIds));
    }

    await Promise.all([
      db.delete(approvalBatchesTable).where(eq(approvalBatchesTable.presetId, id)),
      db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.presetId, id)),
      db.delete(dmInteractionsTable).where(eq(dmInteractionsTable.presetId, id)),
      db.delete(contentLibraryTable).where(eq(contentLibraryTable.clientName, clientName)),
      db.delete(calendarPostsTable).where(eq(calendarPostsTable.clientName, clientName)),
      db.delete(aboutMePostsTable).where(eq(aboutMePostsTable.clientName, clientName)),
      db.delete(seamlessCarouselsTable).where(eq(seamlessCarouselsTable.clientName, clientName)),
      db.delete(aiGeneratedPortraitsTable).where(eq(aiGeneratedPortraitsTable.clientName, clientName)),
    ]);

    await db.delete(aiSourcePhotosTable).where(eq(aiSourcePhotosTable.clientName, clientName));

    await db.delete(clientPresetsTable).where(eq(clientPresetsTable.id, id));

    req.log.info({ id, clientName }, "Preset hard-deleted with all related data");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete preset" });
  }
});

export default router;
