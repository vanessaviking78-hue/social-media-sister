import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activityLogTable, scheduledPostsTable } from "@workspace/db/schema";
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
      totalStories: sql<number>`coalesce(sum(${activityLogTable.postCount}) filter (where ${activityLogTable.action} = 'generated' and ${activityLogTable.postType} = 'story'), 0)::int`,
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

router.get("/analytics/post-time-heatmap", async (req, res) => {
  try {
    const presetId = req.query.presetId ? parseInt(req.query.presetId as string, 10) : undefined;
    const rows = await db.select({
      dow: sql<number>`extract(dow from ${scheduledPostsTable.scheduledAt})::int`,
      hour: sql<number>`extract(hour from ${scheduledPostsTable.scheduledAt})::int`,
      count: sql<number>`count(*)::int`,
    })
      .from(scheduledPostsTable)
      .where(presetId ? eq(scheduledPostsTable.presetId, presetId) : sql`1=1`)
      .groupBy(sql`extract(dow from ${scheduledPostsTable.scheduledAt}), extract(hour from ${scheduledPostsTable.scheduledAt})`)
      .orderBy(sql`count(*) desc`);

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byDay: Record<number, number> = {};
    const byHour: Record<number, number> = {};
    for (const r of rows) {
      byDay[r.dow] = (byDay[r.dow] ?? 0) + r.count;
      byHour[r.hour] = (byHour[r.hour] ?? 0) + r.count;
    }

    const topSlots = rows.slice(0, 5).map((r) => ({
      day: DAYS[r.dow],
      hour: r.hour,
      label: `${DAYS[r.dow]} ${r.hour.toString().padStart(2, "0")}:00`,
      count: r.count,
    }));

    const dayBreakdown = DAYS.map((d, i) => ({ day: d, count: byDay[i] ?? 0 }));

    const HOUR_BANDS = [
      { label: "Early morning (5–8)", hours: [5, 6, 7] },
      { label: "Morning (9–11)", hours: [9, 10, 11] },
      { label: "Lunch (12–13)", hours: [12, 13] },
      { label: "Afternoon (14–17)", hours: [14, 15, 16, 17] },
      { label: "Evening (18–21)", hours: [18, 19, 20, 21] },
      { label: "Night (22+)", hours: [22, 23, 0, 1, 2] },
    ];
    const timeBands = HOUR_BANDS.map((b) => ({
      label: b.label,
      count: b.hours.reduce((s, h) => s + (byHour[h] ?? 0), 0),
    })).sort((a, b) => b.count - a.count);

    res.json({ topSlots, dayBreakdown, timeBands, total: rows.reduce((s, r) => s + r.count, 0) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch post-time data";
    req.log.error({ err }, "post-time-heatmap error");
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
