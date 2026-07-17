import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";

const router: IRouter = Router();

const TARGET_DAYS = 14;
const TASK_TYPES = ["seamless carousel", "bulk carousel", "animated carousel", "single broadcast post"];
const FLOATER_NAMES = ["kahlo", "cantik", "craig hobson", "lotus room"];

router.get("/daily-focus", async (_req, res) => {
  try {
    const allPresets = await db.select().from(clientPresetsTable);
    const presets = allPresets.filter((p) => !FLOATER_NAMES.some((name) => (p.name || "").toLowerCase().includes(name)));
    const now = new Date();

    const pending = await db
      .select()
      .from(scheduledPostsTable)
      .where(and(eq(scheduledPostsTable.status, "pending"), gte(scheduledPostsTable.scheduledAt, now)));

    const clients = presets.map((preset, index) => {
      const clientPosts = pending.filter((p) => p.presetId === preset.id);
      let furthest: Date | null = null;
      for (const p of clientPosts) {
        const d = new Date(p.scheduledAt as unknown as string);
        if (!furthest || d > furthest) furthest = d;
      }
      const daysCovered = furthest
        ? Math.max(0, Math.round((furthest.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const postsScheduled = clientPosts.length;
      const postsNeeded = Math.max(0, TARGET_DAYS - daysCovered);
      const taskType = TASK_TYPES[index % TASK_TYPES.length];

      const batchSize = Math.min(postsNeeded, 4) || 0;
      const suggestedMinutes = batchSize > 0 ? Math.max(10, batchSize * 5) : 0;

      return {
        presetId: preset.id,
        clientName: preset.name,
        daysCovered,
        postsScheduled,
        postsNeeded,
        taskType,
        batchSize,
        suggestedMinutes,
        urgent: daysCovered < TARGET_DAYS,
      };
    });

    const urgentClients = clients.filter((c) => c.urgent).sort((a, b) => a.daysCovered - b.daysCovered);
    const onTrackCount = clients.length - urgentClients.length;

    res.json({
      generatedAt: now.toISOString(),
      targetDays: TARGET_DAYS,
      totalClients: clients.length,
      onTrackCount,
      urgentClients,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to build daily focus" });
  }
});

export default router;
