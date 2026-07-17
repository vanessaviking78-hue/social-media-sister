import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable, dmInteractionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function monthRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return { start, end };
}

async function fetchIgStats(mediaId: string, token: string) {
  try {
    const url = `${GRAPH_BASE}/${mediaId}?fields=like_count,comments_count,permalink,caption,timestamp&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      likes: data.like_count ?? 0,
      comments: data.comments_count ?? 0,
      permalink: data.permalink ?? null,
      caption: data.caption ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchFbStats(postId: string, token: string) {
  try {
    const url = `${GRAPH_BASE}/${postId}?fields=likes.summary(true),comments.summary(true),shares,permalink_url,message&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      likes: data.likes?.summary?.total_count ?? 0,
      comments: data.comments?.summary?.total_count ?? 0,
      shares: data.shares?.count ?? 0,
      permalink: data.permalink_url ?? null,
      caption: data.message ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchFollowerDelta(igAccountId: string, token: string, sinceTs: number, untilTs: number) {
  try {
    const url = GRAPH_BASE + "/" + igAccountId + "/insights?metric=follower_count&period=day&since=" + sinceTs + "&until=" + untilTs + "&access_token=" + token;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const values = data?.data?.[0]?.values as { value: number; end_time: string }[] | undefined;
    if (!values || values.length === 0) return null;
    const first = values[0].value;
    const last = values[values.length - 1].value;
    return { newFollowers: last - first, followerCountEnd: last };
  } catch {
    return null;
  }
}

router.get("/reports/monthly", async (req, res) => {
  try {
    const presetId = Number(req.query["presetId"]);
    const month = String(req.query["month"] || "");
    if (isNaN(presetId)) {
      res.status(400).json({ error: "Missing or invalid presetId" });
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Missing or invalid month, expected format YYYY-MM" });
      return;
    }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) {
      res.status(404).json({ error: "Client preset not found" });
      return;
    }

    const { start, end } = monthRange(month);

    const posts = await db
      .select()
      .from(scheduledPostsTable)
      .where(
        and(
          eq(scheduledPostsTable.presetId, presetId),
          eq(scheduledPostsTable.status, "published"),
          gte(scheduledPostsTable.metaPostedAt, start),
          lte(scheduledPostsTable.metaPostedAt, end)
        )
      );

    const token = preset.metaPageAccessToken;

    let followerStats: { newFollowers: number; followerCountEnd: number } | null = null;
    if (token && preset.metaInstagramAccountId) {
      followerStats = await fetchFollowerDelta(
        preset.metaInstagramAccountId,
        token,
        Math.floor(start.getTime() / 1000),
        Math.floor(end.getTime() / 1000)
      );
    }

    const enriched = await Promise.all(
      posts.map(async (post) => {
        const result = post.metaResult as { igPostId?: string; fbPostId?: string } | null;
        let stats: { likes: number; comments: number; shares?: number; permalink: string | null; caption: string | null } | null = null;

        if (token && result?.igPostId) {
          stats = await fetchIgStats(result.igPostId, token);
        }
        if (!stats && token && result?.fbPostId) {
          stats = await fetchFbStats(result.fbPostId, token);
        }

        const content = post.content as { title?: string; caption?: string } | null;
        const engagementScore = stats ? stats.likes + stats.comments * 2 + (stats.shares ?? 0) * 3 : 0;

        return {
          id: post.id,
          postType: post.postType,
          title: content?.title || null,
          caption: stats?.caption || content?.caption || null,
          permalink: stats?.permalink || null,
          likes: stats?.likes ?? null,
          comments: stats?.comments ?? null,
          shares: stats?.shares ?? null,
          engagementScore,
          postedAt: post.metaPostedAt,
          statsAvailable: !!stats,
        };
      })
    );

    const topPosts = [...enriched].sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 10);

    const dmRows = await db
      .select()
      .from(dmInteractionsTable)
      .where(
        and(
          eq(dmInteractionsTable.presetId, presetId),
          gte(dmInteractionsTable.receivedAt, start),
          lte(dmInteractionsTable.receivedAt, end)
        )
      );

    const postsWithStats = enriched.filter((p) => p.statsAvailable);
    const totalEngagement = postsWithStats.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0), 0);
    const engagementRate =
      followerStats && followerStats.followerCountEnd > 0 && postsWithStats.length > 0
        ? Number(
            ((totalEngagement / postsWithStats.length / followerStats.followerCountEnd) * 100).toFixed(2)
          )
        : null;

    res.json({
      preset: { id: preset.id, name: preset.name },
      month,
      totalPosts: posts.length,
      topPosts,
      dmEnquiryCount: dmRows.length,
      newFollowers: followerStats?.newFollowers ?? null,
      followerCountEnd: followerStats?.followerCountEnd ?? null,
      engagementRatePercent: engagementRate,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to build monthly report" });
  }
});

router.get("/reports/leaderboard", async (req, res) => {
  try {
    const month = String(req.query["month"] || "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Missing or invalid month, expected format YYYY-MM" });
      return;
    }
    const { start, end } = monthRange(month);

    const presets = await db.select().from(clientPresetsTable);
    const posts = await db
      .select()
      .from(scheduledPostsTable)
      .where(
        and(
          eq(scheduledPostsTable.status, "published"),
          gte(scheduledPostsTable.metaPostedAt, start),
          lte(scheduledPostsTable.metaPostedAt, end)
        )
      );

    const results = await Promise.all(
      presets.map(async (preset) => {
        const token = preset.metaPageAccessToken;
        const clientPosts = posts.filter((p) => p.presetId === preset.id).slice(0, 20);
        if (!token || clientPosts.length === 0) {
          return {
            presetId: preset.id,
            clientName: preset.name,
            postCount: clientPosts.length,
            totalEngagement: 0,
            avgEngagement: 0,
            statsAvailable: false,
          };
        }
        let totalEngagement = 0;
        let countedPosts = 0;
        for (const post of clientPosts) {
          const result = post.metaResult as { igPostId?: string; fbPostId?: string } | null;
          let stats: { likes: number; comments: number } | null = null;
          if (result?.igPostId) stats = await fetchIgStats(result.igPostId, token);
          if (!stats && result?.fbPostId) stats = await fetchFbStats(result.fbPostId, token);
          if (stats) {
            totalEngagement += stats.likes + stats.comments;
            countedPosts++;
          }
        }
        return {
          presetId: preset.id,
          clientName: preset.name,
          postCount: clientPosts.length,
          totalEngagement,
          avgEngagement: countedPosts > 0 ? Number((totalEngagement / countedPosts).toFixed(1)) : 0,
          statsAvailable: countedPosts > 0,
        };
      })
    );

    const ranked = results.filter((r) => r.statsAvailable).sort((a, b) => b.totalEngagement - a.totalEngagement);

    res.json({ month, generatedAt: new Date().toISOString(), leaderboard: ranked });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to build leaderboard" });
  }
});

export default router;
