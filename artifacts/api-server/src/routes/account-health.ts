import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/account-health — connection status for every client, used by the
// Health Check dashboard. Lives separately from /healthz (infra uptime check).
//
// Note: this deliberately does NOT ping Facebook\u2019s Graph API live to "test" a
// connection. A read-only profile fetch (GET /{pageId}?fields=id,name) needs
// permission scopes our page tokens were never granted, even on accounts that
// post successfully every day \u2014 so that check produced false "not connected"
// alarms across almost every client. Real posting outcomes recorded in the
// scheduler are the trustworthy signal, so status is derived from those.
router.get("/account-health", async (_req: Request, res: Response) => {
  try {
    const presets = await db.select().from(clientPresetsTable);

    const accounts = await Promise.all(presets.map(async (preset) => {
      const hasToken = !!preset.metaPageAccessToken;
      const igConfigured = hasToken && !!preset.metaInstagramAccountId;
      const fbConfigured = hasToken && !!preset.metaFacebookPageId;

      const [lastPublished] = await db.select().from(scheduledPostsTable)
        .where(and(eq(scheduledPostsTable.presetId, preset.id), eq(scheduledPostsTable.status, "published")))
        .orderBy(desc(scheduledPostsTable.metaPostedAt))
        .limit(1);

      const [lastFailed] = await db.select().from(scheduledPostsTable)
        .where(and(eq(scheduledPostsTable.presetId, preset.id), eq(scheduledPostsTable.status, "failed")))
        .orderBy(desc(scheduledPostsTable.updatedAt))
        .limit(1);

      const pendingRows = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable)
        .where(and(eq(scheduledPostsTable.presetId, preset.id), inArray(scheduledPostsTable.status, ["pending", "processing"])));

      const lastFailedResult = lastFailed?.metaResult as { error?: string } | null;
      const lastPublishedAt = lastPublished?.metaPostedAt ? lastPublished.metaPostedAt.toISOString() : null;
      const lastFailedAt = lastFailed?.updatedAt ? lastFailed.updatedAt.toISOString() : null;

      let status: "not_connected" | "no_posts_yet" | "needs_attention" | "healthy";
      if (!hasToken || (!igConfigured && !fbConfigured)) {
        status = "not_connected";
      } else if (!lastPublishedAt && !lastFailedAt) {
        status = "no_posts_yet";
      } else if (lastFailedAt && (!lastPublishedAt || new Date(lastFailedAt) > new Date(lastPublishedAt))) {
        status = "needs_attention";
      } else {
        status = "healthy";
      }

      return {
        presetId: preset.id,
        clientName: preset.name,
        hasToken,
        igConfigured,
        fbConfigured,
        status,
        lastPublishedAt,
        lastFailedAt,
        lastFailedError: lastFailedResult?.error ?? null,
        pendingCount: pendingRows.length,
      };
    }));

    const statusOrder: Record<string, number> = { not_connected: 0, needs_attention: 1, no_posts_yet: 2, healthy: 3 };
    accounts.sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return a.clientName.localeCompare(b.clientName);
    });

    res.json({ accounts, checkedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Account health check failed" });
  }
});

export default router;
