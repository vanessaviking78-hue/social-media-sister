import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

const router: IRouter = Router();
const GRAPH = "https://graph.facebook.com/v22.0";

function metaFetch(url: string, timeoutMs = 10_000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// GET /api/account-health — connection status for every client, used by the
// Health Check dashboard. Lives separately from /healthz (infra uptime check).
router.get("/account-health", async (_req: Request, res: Response) => {
  try {
    const presets = await db.select().from(clientPresetsTable);

    const accounts = await Promise.all(presets.map(async (preset) => {
      const token = preset.metaPageAccessToken;
      const igId = preset.metaInstagramAccountId;
      const pageId = preset.metaFacebookPageId;

      let ig: { connected: boolean; username?: string; error?: string } = { connected: false };
      let fb: { connected: boolean; name?: string; error?: string } = { connected: false };

      if (!token) {
        ig = { connected: false, error: "No Meta token configured" };
        fb = { connected: false, error: "No Meta token configured" };
      } else {
        if (igId) {
          try {
            const r = await metaFetch(`${GRAPH}/${igId}?fields=id,username&access_token=${token}`);
            const data = await r.json() as any;
            ig = r.ok && data.username
              ? { connected: true, username: data.username }
              : { connected: false, error: data?.error?.message || "Could not verify" };
          } catch (e: any) {
            ig = { connected: false, error: e.message || "Request failed or timed out" };
          }
        } else {
          ig = { connected: false, error: "No Instagram Account ID configured" };
        }

        if (pageId) {
          try {
            const r = await metaFetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${token}`);
            const data = await r.json() as any;
            fb = r.ok && data.name
              ? { connected: true, name: data.name }
              : { connected: false, error: data?.error?.message || "Could not verify" };
          } catch (e: any) {
            fb = { connected: false, error: e.message || "Request failed or timed out" };
          }
        } else {
          fb = { connected: false, error: "No Facebook Page ID configured" };
        }
      }

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

      return {
        presetId: preset.id,
        clientName: preset.name,
        hasToken: !!token,
        ig,
        fb,
        lastPublishedAt: lastPublished?.metaPostedAt ? lastPublished.metaPostedAt.toISOString() : null,
        lastFailedAt: lastFailed?.updatedAt ? lastFailed.updatedAt.toISOString() : null,
        lastFailedError: lastFailedResult?.error ?? null,
        pendingCount: pendingRows.length,
      };
    }));

    accounts.sort((a, b) => a.clientName.localeCompare(b.clientName));

    res.json({ accounts, checkedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Account health check failed" });
  }
});

export default router;
