// deploy: igPublish retry fix (carousel publish timing) 2026-06-30T18:11:55.260170Z
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable, type StickerConfig } from "@workspace/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { logger } from "./logger";
import { notifyPostResult } from "./notify";

const GRAPH = "https://graph.facebook.com/v19.0";

async function igUpload(igId: string, token: string, imageUrl: string, isCarouselItem: boolean, caption?: string, audioName?: string): Promise<string> {
  const params: Record<string, string> = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) {
    params.is_carousel_item = "true";
  } else {
    if (caption) params.caption = caption;
    if (audioName) params.audio_name = audioName;
  }
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
  // Instagram needs time to finish processing the (carousel) container before it can be published.
  // Publishing too soon returns "Media ID is not available". Retry on not-ready errors with backoff.
  const NOT_READY = ["not available", "not ready", "not yet", "processing", "in_progress"];
  let lastErr = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt === 1 ? 5000 : 8000));
    const res = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const data = await res.json() as { id?: string; error?: { message?: string } };
    if (res.ok && data.id) return data.id;
    lastErr = data?.error?.message || JSON.stringify(data);
    if (!NOT_READY.some((ph) => lastErr.toLowerCase().includes(ph))) {
      throw new Error(`IG publish failed: ${lastErr}`);
    }
  }
  throw new Error(`IG publish failed after retries: ${lastErr}`);
}

async function postCarouselToIG(igId: string, token: string, imageUrls: string[], caption: string, audioName?: string): Promise<string> {
  if (imageUrls.length === 1) {
    const id = await igUpload(igId, token, imageUrls[0], false, caption, audioName);
    return igPublish(igId, token, id);
  }
  const childIds: string[] = [];
  for (const url of imageUrls) childIds.push(await igUpload(igId, token, url, true));
  const carouselBody: Record<string, unknown> = { media_type: "CAROUSEL", children: childIds.join(","), caption, access_token: token };
  if (audioName) carouselBody.audio_name = audioName;
  const res = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(carouselBody),
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

async function postReelToIG(igId: string, token: string, videoUrl: string, caption: string, isTrial: boolean, audioName?: string): Promise<string> {
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: token,
  };
  if (isTrial) body.trial_params = JSON.stringify({ graduation_strategy: "MANUAL" });
  if (audioName) body.audio_name = audioName;

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

async function postStoryToIG(
  igId: string,
  token: string,
  imageUrls: string[],
  stickerConfig?: StickerConfig | null,
): Promise<string[]> {
  const postIds: string[] = [];
  for (const url of imageUrls) {
    const body: Record<string, unknown> = {
      image_url: url,
      media_type: "STORIES",
      access_token: token,
    };
    if (stickerConfig) {
      if (stickerConfig.type === "poll") {
        body.poll_sticker = JSON.stringify({
          question: stickerConfig.question,
          options: stickerConfig.options,
        });
      } else if (stickerConfig.type === "quiz") {
        body.quiz_sticker = JSON.stringify({
          question: stickerConfig.question,
          options: stickerConfig.options,
          correct_option: stickerConfig.correctIndex,
        });
      } else if (stickerConfig.type === "question") {
        body.question_sticker = JSON.stringify({
          question: stickerConfig.question,
        });
      }
    }
    const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const containerData = await containerRes.json() as { id?: string; error?: { message?: string } };
    if (!containerRes.ok || !containerData.id) {
      throw new Error(`Story container failed: ${containerData?.error?.message || JSON.stringify(containerData)}`);
    }
    postIds.push(await igPublish(igId, token, containerData.id));
  }
  return postIds;
}

async function igPostComment(igMediaId: string, token: string, commentText: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${igMediaId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: commentText, access_token: token }),
  });
  const data = await res.json() as { error?: { message?: string } };
  if (!res.ok) {
    logger.warn({ igMediaId, err: data?.error?.message }, "Scheduled first comment post failed");
  }
}

type PostContent = { imageUrls?: string[]; videoUrl?: string; caption: string; title: string; firstComment?: string; musicTrack?: { name: string; artist: string } | null; platforms?: string[] };

async function fireMetaRail(post: typeof scheduledPostsTable.$inferSelect, preset: typeof clientPresetsTable.$inferSelect): Promise<{ igPostId?: string; fbPostId?: string }> {
  const token = preset.metaPageAccessToken;
  const igId = preset.metaInstagramAccountId;
  const pageId = preset.metaFacebookPageId;
  if (!token) throw new Error("No Meta access token configured for this client");
  const content = post.content as PostContent;

  if (post.postType === "reel") {
    if (!igId) throw new Error("No Instagram account ID for reel");
    if (!content.videoUrl) throw new Error("No video URL for reel");
    const reelAudioName = content.musicTrack?.name
      ? `${content.musicTrack.name} by ${content.musicTrack.artist}`
      : undefined;
    const igPostId = await postReelToIG(igId, token, content.videoUrl, content.caption, post.isTrial, reelAudioName);
    const reelFirstComment = content.firstComment?.trim();
    if (reelFirstComment && igPostId) {
      setTimeout(() => {
        igPostComment(igPostId, token, reelFirstComment).catch((err) =>
          logger.warn({ err }, "Reel first comment failed")
        );
      }, 35_000);
    }
    return { igPostId };
  }

  if (!content.imageUrls?.length) throw new Error("No image URLs");
  const result: { igPostId?: string; fbPostId?: string } = {};
  const errors: string[] = [];
  const isStoryFormat = post.postType === "story" || post.postType === "stories";

  if (isStoryFormat) {
    if (!igId) throw new Error("No Instagram account ID configured — stories require an Instagram account");
    const stickerConfig = (post.stickerConfig as StickerConfig | null | undefined) ?? null;
    try {
      const storyIds = await postStoryToIG(igId, token, content.imageUrls, stickerConfig);
      result.igPostId = storyIds[0];
    } catch (e: any) {
      errors.push(`IG story: ${e.message}`);
    }
    if (errors.length > 0 && !result.igPostId) throw new Error(errors.join("; "));
    return result;
  }

  const isMultiImage = content.imageUrls.length > 1;
  const isSeamlessFormat = post.postType === "seamless";
  const supportsAudioAttachment = isMultiImage || isSeamlessFormat;
  const audioName = content.musicTrack?.name && supportsAudioAttachment
    ? `${content.musicTrack.name} by ${content.musicTrack.artist}`
    : undefined;
  // Music is saved as post metadata only. Never append music text to the published caption.
  const caption = content.caption;
  // Per-post platform selection: if content.platforms is set, only fire the requested rails.
  // If absent (legacy posts), default to both.
  const wantIG = !content.platforms || content.platforms.includes("instagram");
  const wantFB = !content.platforms || content.platforms.includes("facebook");
  if (wantIG && !igId) errors.push("IG: No Instagram Account ID configured for this client preset");
  if (wantFB && !pageId) errors.push("FB: No Facebook Page ID configured for this client preset");

  if (igId && wantIG) {
    try {
      result.igPostId = await postCarouselToIG(igId, token, content.imageUrls, caption, audioName);
      const firstCommentText = content.firstComment?.trim();
      if (firstCommentText && result.igPostId) {
        setTimeout(() => {
          igPostComment(result.igPostId!, token, firstCommentText).catch((err) =>
            logger.warn({ err }, "Scheduled first comment failed")
          );
        }, 35_000);
      }
    }
    catch (e: any) { errors.push(`IG: ${e.message}`); }
  }
  if (pageId && wantFB) {
    try { result.fbPostId = await postCarouselToFB(pageId, token, content.imageUrls, caption); }
    catch (e: any) { errors.push(`FB: ${e.message}`); }
  }
  if (errors.length > 0) {
    logger.warn(
      { errors, igPosted: !!result.igPostId, fbPosted: !!result.fbPostId, postId: post.id },
      "Meta rail posting error(s) — one or more platforms failed",
    );
    throw new Error(errors.join("; "));
  }
  return result;
}

let schedulerRunning = false;

async function processScheduledPosts(): Promise<void> {
  // Re-entrancy guard: never let two overlapping timer ticks run at once.
  if (schedulerRunning) {
    logger.info("Scheduler tick skipped — previous run still in progress");
    return;
  }
  schedulerRunning = true;
  try {
    const now = new Date();
    // Atomically claim all due posts in a single UPDATE so overlapping runs
    // (or multiple instances) can never grab the same post twice. Only the
    // rows this statement actually flips from pending -> processing are returned.
    const due = await db
      .update(scheduledPostsTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(scheduledPostsTable.status, "pending"), lte(scheduledPostsTable.scheduledAt, now)))
      .returning();

    if (due.length > 0) {
      logger.info({ count: due.length }, "Processing scheduled posts");
    }

    for (const post of due) {
      const [preset] = await db
      .select()
      .from(clientPresetsTable)
      .where(eq(clientPresetsTable.id, post.presetId));

    if (!preset) {
      const err = { error: "Preset not found" };
      await db.update(scheduledPostsTable).set({
        status: "failed", metaStatus: "failed", metaResult: err, updatedAt: new Date(),
      }).where(eq(scheduledPostsTable.id, post.id));
      continue;
    }

    const hasMetaConfig = !!(preset.metaPageAccessToken && (preset.metaInstagramAccountId || preset.metaFacebookPageId));

    const metaSettled = await Promise.allSettled([
      hasMetaConfig ? fireMetaRail(post, preset) : Promise.reject(new Error("Meta not configured for this client")),
    ]);

    const postedAt = new Date();
    const metaOk = metaSettled[0].status === "fulfilled";
    const metaResult = metaOk ? (metaSettled[0] as PromiseFulfilledResult<any>).value : { error: (metaSettled[0] as PromiseRejectedResult).reason?.message || "Unknown error" };

    const overallStatus = metaOk ? "published" : "failed";

    await db.update(scheduledPostsTable).set({
      status: overallStatus,
      metaStatus: hasMetaConfig ? (metaOk ? "success" : "failed") : "skipped",
      metaResult,
      metaPostedAt: metaOk ? postedAt : null,
      updatedAt: postedAt,
    }).where(eq(scheduledPostsTable.id, post.id));

    logger.info(
      { postId: post.id, client: post.clientName, type: post.postType, metaOk },
      "Scheduled post processed",
    );

    await notifyPostResult({
      ok: metaOk,
      clientName: preset.name || post.clientName || "client",
      postType: post.postType,
      detail: metaOk ? undefined : (metaResult?.error || undefined),
    });
  }
  } finally {
    schedulerRunning = false;
  }
}

export function startSchedulerCron(): void {
  logger.info("Post scheduler started (60s interval)");
  processScheduledPosts().catch((err) => logger.error({ err }, "Initial scheduler run error"));
  setInterval(() => {
    processScheduledPosts().catch((err) => logger.error({ err }, "Scheduler cron error"));
  }, 60_000);
}
