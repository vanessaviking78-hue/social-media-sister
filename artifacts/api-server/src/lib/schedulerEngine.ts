import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable } from "@workspace/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { logger } from "./logger";

const GRAPH = "https://graph.facebook.com/v19.0";
const CC_BASE = "https://app.cloudcampaign.com/api/v1";

let ccToken: string | null = null;
let ccTokenExpiry = 0;

async function getCCToken(): Promise<string> {
  if (ccToken && Date.now() < ccTokenExpiry) return ccToken;
  const apiKey = process.env.CLOUD_CAMPAIGN_API_KEY;
  const apiSecret = process.env.CLOUD_CAMPAIGN_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("CC API key/secret not configured");
  const res = await fetch(`${CC_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: apiKey, secret: apiSecret }),
  });
  if (!res.ok) throw new Error(`CC auth failed: ${res.status}`);
  const token = res.headers.get("x-api-token");
  if (!token) throw new Error("No x-api-token in CC auth response");
  ccToken = token;
  ccTokenExpiry = Date.now() + 11 * 60 * 60 * 1000;
  return token;
}

async function ccFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
  if (!agencyId) throw new Error("CC agency ID not configured");
  const token = await getCCToken();
  const res = await fetch(`${CC_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-agency-id": agencyId,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) { ccToken = null; ccTokenExpiry = 0; }
    throw new Error(data?.message || data?.errorReason || `CC API error ${res.status}`);
  }
  return data;
}

async function igUpload(igId: string, token: string, imageUrl: string, isCarouselItem: boolean, caption?: string): Promise<string> {
  const params: Record<string, string> = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = "true";
  else if (caption) params.caption = caption;
  const res = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json() as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(`IG upload failed: ${data?.error?.message || JSON.stringify(data)}`);
  return data.id;
}

async function igPublish(igId: string, token: string, creationId: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  const data = await res.json() as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(`IG publish failed: ${data?.error?.message || JSON.stringify(data)}`);
  return data.id;
}

async function postCarouselToIG(igId: string, token: string, imageUrls: string[], caption: string): Promise<string> {
  if (imageUrls.length === 1) {
    const id = await igUpload(igId, token, imageUrls[0], false, caption);
    return igPublish(igId, token, id);
  }
  const childIds: string[] = [];
  for (const url of imageUrls) childIds.push(await igUpload(igId, token, url, true));
  const res = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", children: childIds.join(","), caption, access_token: token }),
  });
  const data = await res.json() as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(`IG carousel container failed: ${data?.error?.message}`);
  return igPublish(igId, token, data.id);
}

async function postCarouselToFB(pageId: string, token: string, imageUrls: string[], caption: string): Promise<string> {
  const fbids: { media_fbid: string }[] = [];
  for (const url of imageUrls) {
    const res = await fetch(`${GRAPH}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, published: false, access_token: token }),
    });
    const data = await res.json() as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) throw new Error(`FB photo upload failed: ${data?.error?.message}`);
    fbids.push({ media_fbid: data.id });
  }
  const res = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: caption, attached_media: fbids, access_token: token }),
  });
  const data = await res.json() as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(`FB feed post failed: ${data?.error?.message}`);
  return data.id;
}

async function postReelToIG(igId: string, token: string, videoUrl: string, caption: string, isTrial: boolean): Promise<string> {
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: token,
  };
  if (isTrial) body.trial_params = JSON.stringify({ graduation_strategy: "MANUAL" });

  const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const containerData = await containerRes.json() as { id?: string; error?: { message?: string } };
  if (!containerRes.ok || !containerData.id) throw new Error(`Reel container failed: ${containerData?.error?.message || JSON.stringify(containerData)}`);
  const containerId = containerData.id;

  let statusCode = "IN_PROGRESS";
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    const statusData = await statusRes.json() as { status_code?: string; status?: string };
    statusCode = statusData.status_code || "UNKNOWN";
    if (statusCode === "FINISHED") break;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") throw new Error(`Reel processing failed: ${statusCode} — ${statusData.status || ""}`);
  }
  if (statusCode !== "FINISHED") throw new Error("Reel container timed out (>2 min)");

  return igPublish(igId, token, containerId);
}

type PostContent = { imageUrls?: string[]; videoUrl?: string; caption: string; title: string };

async function fireMetaRail(post: typeof scheduledPostsTable.$inferSelect, preset: typeof clientPresetsTable.$inferSelect): Promise<{ igPostId?: string; fbPostId?: string }> {
  const token = preset.metaPageAccessToken;
  const igId = preset.metaInstagramAccountId;
  const pageId = preset.metaFacebookPageId;
  if (!token) throw new Error("No Meta access token configured for this client");
  const content = post.content as PostContent;

  if (post.postType === "reel") {
    if (!igId) throw new Error("No Instagram account ID for reel");
    if (!content.videoUrl) throw new Error("No video URL for reel");
    const igPostId = await postReelToIG(igId, token, content.videoUrl, content.caption, post.isTrial);
    return { igPostId };
  }

  if (!content.imageUrls?.length) throw new Error("No image URLs for carousel");
  const result: { igPostId?: string; fbPostId?: string } = {};
  const errors: string[] = [];
  if (igId) {
    try { result.igPostId = await postCarouselToIG(igId, token, content.imageUrls, content.caption); }
    catch (e: any) { errors.push(`IG: ${e.message}`); }
  }
  if (pageId) {
    try { result.fbPostId = await postCarouselToFB(pageId, token, content.imageUrls, content.caption); }
    catch (e: any) { errors.push(`FB: ${e.message}`); }
  }
  if (!igId && !pageId) throw new Error("No IG or FB account configured for this client");
  if (errors.length > 0 && !result.igPostId && !result.fbPostId) throw new Error(errors.join("; "));
  return result;
}

async function fireCCRail(post: typeof scheduledPostsTable.$inferSelect, preset: typeof clientPresetsTable.$inferSelect): Promise<{ postId?: string }> {
  const wsId = preset.ccWorkspaceId;
  if (!wsId) throw new Error("No CC workspace ID configured for this client");
  const content = post.content as PostContent;
  const media = content.videoUrl
    ? [{ type: "VIDEO", sourceUrl: content.videoUrl }]
    : (content.imageUrls || []).map((url) => ({ type: "IMAGE", sourceUrl: url }));

  const data = await ccFetch(`/workspace/${wsId}/content`, {
    method: "POST",
    body: JSON.stringify({
      title: content.title,
      postNow: false,
      approved: true,
      captions: [
        { text: content.caption, platform: "INSTAGRAM", index: 0 },
        { text: content.caption, platform: "FACEBOOK", index: 0 },
      ],
      publishingSettings: {},
      platformList: ["INSTAGRAM", "FACEBOOK"],
      accountIds: [],
      ...(media.length > 0 ? { media } : {}),
    }),
  });
  return { postId: data.id };
}

async function processScheduledPosts(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(scheduledPostsTable)
    .where(and(eq(scheduledPostsTable.status, "pending"), lte(scheduledPostsTable.scheduledAt, now)));

  if (due.length > 0) {
    logger.info({ count: due.length }, "Processing scheduled posts");
  }

  for (const post of due) {
    await db
      .update(scheduledPostsTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(scheduledPostsTable.id, post.id));

    const [preset] = await db
      .select()
      .from(clientPresetsTable)
      .where(eq(clientPresetsTable.id, post.presetId));

    if (!preset) {
      const err = { error: "Preset not found" };
      await db.update(scheduledPostsTable).set({
        status: "failed", metaStatus: "failed", metaResult: err,
        ccStatus: "failed", ccResult: err, updatedAt: new Date(),
      }).where(eq(scheduledPostsTable.id, post.id));
      continue;
    }

    const hasMetaConfig = !!(preset.metaPageAccessToken && (preset.metaInstagramAccountId || preset.metaFacebookPageId));
    const hasCCConfig = !!preset.ccWorkspaceId;

    const [metaSettled, ccSettled] = await Promise.allSettled([
      hasMetaConfig ? fireMetaRail(post, preset) : Promise.reject(new Error("Meta not configured for this client")),
      hasCCConfig ? fireCCRail(post, preset) : Promise.reject(new Error("CC not configured for this client")),
    ]);

    const postedAt = new Date();
    const metaOk = metaSettled.status === "fulfilled";
    const ccOk = ccSettled.status === "fulfilled";
    const metaResult = metaOk ? metaSettled.value : { error: (metaSettled.reason as Error)?.message || "Unknown error" };
    const ccResult = ccOk ? ccSettled.value : { error: (ccSettled.reason as Error)?.message || "Unknown error" };

    const overallStatus = (metaOk || ccOk) ? "published" : "failed";

    await db.update(scheduledPostsTable).set({
      status: overallStatus,
      metaStatus: hasMetaConfig ? (metaOk ? "success" : "failed") : "skipped",
      metaResult,
      metaPostedAt: metaOk ? postedAt : null,
      ccStatus: hasCCConfig ? (ccOk ? "success" : "failed") : "skipped",
      ccResult,
      ccPostedAt: ccOk ? postedAt : null,
      updatedAt: postedAt,
    }).where(eq(scheduledPostsTable.id, post.id));

    logger.info(
      { postId: post.id, client: post.clientName, type: post.postType, metaOk, ccOk },
      "Scheduled post processed",
    );
  }
}

export function startSchedulerCron(): void {
  logger.info("Post scheduler started (60s interval)");
  processScheduledPosts().catch((err) => logger.error({ err }, "Initial scheduler run error"));
  setInterval(() => {
    processScheduledPosts().catch((err) => logger.error({ err }, "Scheduler cron error"));
  }, 60_000);
}
