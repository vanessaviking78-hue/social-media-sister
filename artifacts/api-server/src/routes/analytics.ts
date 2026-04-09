import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db/schema";
import { sql, eq, gte, lte, and, desc } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res) => {
  try {
    const [totals] = await db.select({
      totalActions: sql<number>`count(*)::int`,
      totalGenerated: sql<number>`count(*) filter (where ${activityLogTable.action} = 'generated')::int`,
      totalDownloaded: sql<number>`count(*) filter (where ${activityLogTable.action} = 'downloaded')::int`,
      totalPushed: sql<number>`count(*) filter (where ${activityLogTable.action} = 'pushed')::int`,
      totalCarousels: sql<number>`coalesce(sum(${activityLogTable.postCount}) filter (where ${activityLogTable.action} = 'generated' and ${activityLogTable.postType} = 'carousel'), 0)::int`,
      totalSingleImages: sql<number>`coalesce(sum(${activityLogTable.postCount}) filter (where ${activityLogTable.action} = 'generated' and ${activityLogTable.postType} = 'single-image'), 0)::int`,
      totalPosts: sql<number>`coalesce(sum(${activityLogTable.postCount}) filter (where ${activityLogTable.action} = 'generated'), 0)::int`,
      totalSlides: sql<number>`coalesce(sum(${activityLogTable.slideCount}) filter (where ${activityLogTable.action} = 'generated'), 0)::int`,
    }).from(activityLogTable);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthTotals] = await db.select({
      monthActions: sql<number>`count(*)::int`,
      monthDownloads: sql<number>`count(*) filter (where ${activityLogTable.action} = 'downloaded')::int`,
    }).from(activityLogTable).where(gte(activityLogTable.createdAt, firstOfMonth));

    res.json({ summary: { ...totals, ...monthTotals } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch summary";
    console.error("Analytics summary error:", err);
    res.status(500).json({ error: message });
  }
});

router.get("/analytics/by-client", async (_req, res) => {
  try {
    const rows = await db.select({
      clientName: activityLogTable.clientName,
      total: sql<number>`count(*)::int`,
      posts: sql<number>`coalesce(sum(${activityLogTable.postCount}) filter (where ${activityLogTable.action} = 'generated'), 0)::int`,
      generated: sql<number>`count(*) filter (where ${activityLogTable.action} = 'generated')::int`,
      downloaded: sql<number>`count(*) filter (where ${activityLogTable.action} = 'downloaded')::int`,
    }).from(activityLogTable)
      .where(sql`${activityLogTable.clientName} != ''`)
      .groupBy(activityLogTable.clientName)
      .orderBy(sql`count(*) desc`);
    res.json({ clients: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch by-client data";
    console.error("Analytics by-client error:", err);
    res.status(500).json({ error: message });
  }
});

router.get("/analytics/over-time", async (req, res) => {
  try {
    const groupBy = req.query.group === "week" ? "week" : "month";
    const truncFn = groupBy === "week"
      ? sql`date_trunc('week', ${activityLogTable.createdAt})`
      : sql`date_trunc('month', ${activityLogTable.createdAt})`;
    const rows = await db.select({
      period: sql<string>`to_char(${truncFn}, 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      posts: sql<number>`coalesce(sum(${activityLogTable.postCount}), 0)::int`,
    }).from(activityLogTable)
      .where(eq(activityLogTable.action, "generated"))
      .groupBy(truncFn)
      .orderBy(truncFn);
    res.json({ data: rows, groupBy });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch over-time data";
    console.error("Analytics over-time error:", err);
    res.status(500).json({ error: message });
  }
});

router.get("/analytics/by-type", async (_req, res) => {
  try {
    const rows = await db.select({
      postType: activityLogTable.postType,
      total: sql<number>`count(*)::int`,
      posts: sql<number>`coalesce(sum(${activityLogTable.postCount}), 0)::int`,
    }).from(activityLogTable)
      .where(eq(activityLogTable.action, "generated"))
      .groupBy(activityLogTable.postType)
      .orderBy(sql`count(*) desc`);
    res.json({ types: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch by-type data";
    console.error("Analytics by-type error:", err);
    res.status(500).json({ error: message });
  }
});

router.get("/analytics/recent", async (_req, res) => {
  try {
    const rows = await db.select().from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(20);
    res.json({ recent: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch recent activity";
    console.error("Analytics recent error:", err);
    res.status(500).json({ error: message });
  }
});

router.post("/analytics/log", async (req, res) => {
  try {
    const { action, postType, clientName, slideCount, postCount } = req.body;
    if (!action || !postType) {
      res.status(400).json({ error: "action and postType required" });
      return;
    }
    await logActivity({
      action: typeof action === "string" ? action : String(action),
      postType: typeof postType === "string" ? postType : String(postType),
      clientName: typeof clientName === "string" ? clientName : "",
      slideCount: Number(slideCount) || 0,
      postCount: Number(postCount) || 0,
    });
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to log activity";
    console.error("Analytics log error:", err);
    res.status(500).json({ error: message });
  }
});

export default router;
