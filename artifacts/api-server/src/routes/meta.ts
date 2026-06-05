import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, type StickerConfig } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GRAPH = "https://graph.facebook.com/v22.0";

function metaFetch(url: string, opts: RequestInit = {}, timeoutMs = 30_000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function igUploadContainer(
  igAccountId: string,
  token: string,
  imageUrl: string,
  isCarouselItem: boolean,
  caption?: string,
  audioName?: string
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: token,
  };
  if (isCarouselItem) {
    params.is_carousel_item = "true";
  } else {
    if (caption) params.caption = caption;
    if (audioName) params.audio_name = audioName;
  }
  const res = await metaFetch(`${GRAPH}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.id) {
    throw new Error(`IG media upload failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function igPublish(igAccountId: string, token: string, creationId: string): Promise<string> {
  const res = await metaFetch(`${GRAPH}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  const data = await res.json() as any;
  if (!res.ok || !data.id) {
    throw new Error(`IG publish failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function postToInstagram(
  igAccountId: string,
  token: string,
  imageUrls: string[],
  caption: string,
  audioName?: string
): Promise<string> {
  if (imageUrls.length === 1) {
    const containerId = await igUploadContainer(igAccountId, token, imageUrls[0], false, caption, audioName);
    return igPublish(igAccountId, token, containerId);
  }
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const id = await igUploadContainer(igAccountId, token, url, true);
    childIds.push(id);
  }
  const carouselBody: Record<string, unknown> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: token,
  };
  if (audioName) carouselBody.audio_name = audioName;
  const carouselRes = await metaFetch(`${GRAPH}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(carouselBody),
  });
  const carouselData = await carouselRes.json() as any;
  if (!carouselRes.ok || !carouselData.id) {
    throw new Error(`IG carousel container failed (${carouselRes.status}): ${carouselData?.error?.message || JSON.stringify(carouselData)}`);
  }
  return igPublish(igAccountId, token, carouselData.id);
}

async function postToFacebook(
  pageId: string,
  token: string,
  imageUrls: string[],
  caption: string
): Promise<string> {
  if (imageUrls.length === 1) {
    const res = await metaFetch(`${GRAPH}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrls[0], caption, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`FB photo post failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
    return data.post_id || data.id;
  }

  const mediaFbids: { media_fbid: string }[] = [];
  for (const url of imageUrls) {
    const res = await metaFetch(`${GRAPH}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, published: false, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`FB photo upload failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
    mediaFbids.push({ media_fbid: data.id });
  }

  const feedRes = await metaFetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: caption,
      attached_media: mediaFbids,
      access_token: token,
    }),
  });
  const feedData = await feedRes.json() as any;
  if (!feedRes.ok) throw new Error(`FB feed post failed (${feedRes.status}): ${feedData?.error?.message || JSON.stringify(feedData)}`);
  return feedData.id;
}

async function igPostComment(igMediaId: string, token: string, commentText: string): Promise<void> {
  const res = await metaFetch(`${GRAPH}/${igMediaId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: commentText, access_token: token }),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    logger.warn({ igMediaId, err: data?.error?.message }, "First comment post failed");
  }
}

router.get("/meta/test-connection", async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.query.presetId);
    if (isNaN(presetId)) {
      res.status(400).json({ error: "presetId required" });
      return;
    }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    if (!preset.metaPageAccessToken) {
      res.status(400).json({ error: "No Meta access token configured for this preset" });
      return;
    }
    const r = await metaFetch(`${GRAPH}/me?fields=id,name&access_token=${preset.metaPageAccessToken}`);
    const data = await r.json() as any;
    if (!r.ok) {
      res.status(400).json({ error: `Token invalid: ${data?.error?.message || "Unknown error"}` });
      return;
    }
    res.json({ ok: true, name: data.name, id: data.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Test failed" });
  }
});

// Returns the resolved Instagram username + Facebook page name for a preset's stored credentials.
// Used by the scheduling UI to confirm which account will receive the post before it fires.
router.get("/meta/ig-account-info", async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.query.presetId);
    if (isNaN(presetId)) { res.status(400).json({ error: "presetId required" }); return; }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const token = preset.metaPageAccessToken;
    const igId  = preset.metaInstagramAccountId;
    const pageId = preset.metaFacebookPageId;

    const result: {
      ig?: { id: string; username: string; name: string };
      fb?: { id: string; name: string };
      igError?: string;
      fbError?: string;
    } = {};

    if (token && igId) {
      try {
        const r = await metaFetch(`${GRAPH}/${igId}?fields=id,username,name&access_token=${token}`);
        const data = await r.json() as any;
        if (r.ok && data.username) {
          result.ig = { id: data.id, username: data.username, name: data.name };
        } else {
          result.igError = data?.error?.message || "Could not resolve Instagram account";
        }
      } catch (e: any) {
        result.igError = e.message;
      }
    } else {
      result.igError = !token ? "No Meta access token configured for this client" : "No Instagram Account ID configured";
    }

    if (token && pageId) {
      try {
        const r = await metaFetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${token}`);
        const data = await r.json() as any;
        if (r.ok && data.name) {
          result.fb = { id: data.id, name: data.name };
        } else {
          result.fbError = data?.error?.message || "Could not resolve Facebook page";
        }
      } catch (e: any) {
        result.fbError = e.message;
      }
    } else if (!pageId) {
      result.fbError = "No Facebook Page ID configured";
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Account lookup failed" });
  }
});

router.post("/meta/push", async (req: Request, res: Response) => {
  try {
    const { posts, presetId, postType, platforms } = req.body as {
      posts: { title: string; caption: string; imageUrls: string[]; firstComment?: string; musicTrack?: { name: string; artist: string } | null }[];
      presetId: number;
      postType?: string;
      platforms?: string[];
    };

    const wantIg = !platforms || platforms.includes("instagram");
    const wantFb = !platforms || platforms.includes("facebook");

    if (!posts?.length) { res.status(400).json({ error: "No posts provided" }); return; }
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const token = preset.metaPageAccessToken;
    const pageId = preset.metaFacebookPageId;
    const igId = preset.metaInstagramAccountId;

    if (!token) {
      res.status(400).json({ error: "No Meta access token configured for this client. Add it in Client Presets." });
      return;
    }
    if (!pageId && !igId) {
      res.status(400).json({ error: "No Facebook Page ID or Instagram Account ID configured for this client." });
      return;
    }

    const results: { post: string; platform: string; status: string; id?: string; error?: string }[] = [];

    for (const post of posts) {
      const isMultiImage = (post.imageUrls?.length ?? 0) > 1;
      const isStory = postType === "story" || postType === "stories";
      const isSeamless = postType === "seamless";
      const supportsAudioAttachment = isMultiImage || isStory || isSeamless;
      const audioName = post.musicTrack?.name && supportsAudioAttachment
        ? `${post.musicTrack.name} by ${post.musicTrack.artist}`
        : undefined;
      // Music is saved as post metadata only. Never append music text to the published caption.
      const finalCaption = post.caption;

      if (igId && wantIg) {
        try {
          const id = await postToInstagram(igId, token, post.imageUrls, finalCaption, audioName);
          results.push({ post: post.title, platform: "instagram", status: "success", id });
          const firstCommentText = post.firstComment?.trim() || undefined;
          if (firstCommentText && id) {
            setTimeout(() => {
              igPostComment(id, token, firstCommentText).catch((err) =>
                logger.warn({ err }, "Async first comment failed")
              );
            }, 35_000);
          }
        } catch (err: any) {
          results.push({ post: post.title, platform: "instagram", status: "error", error: err.message });
        }
      }
      if (pageId && wantFb) {
        try {
          const id = await postToFacebook(pageId, token, post.imageUrls, finalCaption);
          results.push({ post: post.title, platform: "facebook", status: "success", id });
        } catch (err: any) {
          results.push({ post: post.title, platform: "facebook", status: "error", error: err.message });
        }
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    const platformCount = (igId && wantIg ? 1 : 0) + (pageId && wantFb ? 1 : 0);
    if (succeeded > 0) {
      logActivity({ action: "pushed", postType: (postType as any) || "carousel", postCount: Math.ceil(succeeded / Math.max(platformCount, 1)) });
    }

    res.json({ results, summary: { total: results.length, succeeded, failed } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Meta push failed" });
  }
});

router.post("/meta/post-first-comment", async (req: Request, res: Response) => {
  try {
    const { presetId, igMediaId, commentText } = req.body as { presetId: number; igMediaId: string; commentText: string };
    if (!presetId || !igMediaId || !commentText?.trim()) {
      res.status(400).json({ error: "presetId, igMediaId, and commentText are required" });
      return;
    }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    if (!preset.metaPageAccessToken) {
      res.status(400).json({ error: "No Meta access token configured for this client" });
      return;
    }
    await igPostComment(igMediaId, preset.metaPageAccessToken, commentText.trim());
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to post first comment" });
  }
});

router.post("/meta/push-story", async (req: Request, res: Response) => {
  try {
    const { presetId, imageUrls, clientName, stickerConfig } = req.body as {
      presetId: number;
      imageUrls: string[];
      clientName?: string;
      stickerConfig?: StickerConfig | null;
    };

    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (!imageUrls?.length) { res.status(400).json({ error: "imageUrls required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const token = preset.metaPageAccessToken;
    const igId = preset.metaInstagramAccountId;

    if (!token) {
      res.status(400).json({ error: "No Meta access token configured for this client." });
      return;
    }
    if (!igId) {
      res.status(400).json({ error: "No Instagram Account ID configured for this client." });
      return;
    }

    const results: { imageIndex: number; status: string; id?: string; error?: string }[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const containerBody: Record<string, unknown> = {
          image_url: imageUrls[i],
          media_type: "STORIES",
          access_token: token,
        };
        if (stickerConfig) {
          if (stickerConfig.type === "poll") {
            containerBody.poll_sticker = JSON.stringify({
              question: stickerConfig.question,
              options: stickerConfig.options,
            });
          } else if (stickerConfig.type === "quiz") {
            containerBody.quiz_sticker = JSON.stringify({
              question: stickerConfig.question,
              options: stickerConfig.options,
              correct_option: stickerConfig.correctIndex,
            });
          } else if (stickerConfig.type === "question") {
            containerBody.question_sticker = JSON.stringify({
              question: stickerConfig.question,
            });
          }
        }
        const containerRes = await metaFetch(`${GRAPH}/${igId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(containerBody),
        });
        const containerData = await containerRes.json() as any;
        if (!containerRes.ok || !containerData.id) {
          throw new Error(`Story container failed (${containerRes.status}): ${containerData?.error?.message || JSON.stringify(containerData)}`);
        }
        const postId = await igPublish(igId, token, containerData.id as string);
        results.push({ imageIndex: i, status: "success", id: postId });
      } catch (err: any) {
        results.push({ imageIndex: i, status: "error", error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    if (succeeded > 0) {
      logActivity({ action: "pushed", postType: "story", postCount: succeeded, clientName });
    }

    res.json({ results, summary: { total: results.length, succeeded, failed } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Story push failed" });
  }
});

// ---------------------------------------------------------------------------
// Async reel job store
// Reel container creation + polling takes up to 2 min, which exceeds the
// Replit reverse-proxy hard timeout of 120 s.  We solve this by returning a
// jobId immediately and processing the reel in the background.
// ---------------------------------------------------------------------------

type ReelJobStatus = "queued" | "processing" | "finished" | "error";

interface ReelJob {
  status: ReelJobStatus;
  igPostId?: string;
  trial?: boolean;
  error?: string;
  startedAt: number;
}

const reelJobs = new Map<string, ReelJob>();

// Auto-clean jobs older than 15 minutes so the Map doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [id, job] of reelJobs) {
    if (job.startedAt < cutoff) reelJobs.delete(id);
  }
}, 5 * 60_000).unref();

async function processReelJob(
  jobId: string,
  params: {
    videoUrl: string;
    caption: string;
    token: string;
    igId: string;
    trial: boolean;
    graduationStrategy: string;
  }
): Promise<void> {
  const { videoUrl, caption, token, igId, trial, graduationStrategy } = params;

  const patch = (update: Partial<ReelJob>) =>
    reelJobs.set(jobId, { ...reelJobs.get(jobId)!, ...update });

  try {
    patch({ status: "processing" });

    // Step 1: create Reel container
    const containerBody: Record<string, unknown> = {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    };
    if (trial) {
      containerBody.trial_params = JSON.stringify({
        graduation_strategy: graduationStrategy,
      });
    }

    const containerRes = await metaFetch(
      `${GRAPH}/${igId}/media`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(containerBody) },
      60_000,
    );
    const containerData = await containerRes.json() as { id?: string; error?: { message?: string } };
    if (!containerRes.ok || !containerData.id) {
      throw new Error(`Reel container creation failed: ${containerData?.error?.message || JSON.stringify(containerData)}`);
    }
    const containerId = containerData.id;
    logger.info({ jobId, containerId, igId }, "Reel container created");

    // Step 2: publish with retry loop.
    // We skip the GET /{containerId}?fields=status_code check because it requires
    // a permission scope that page tokens often don't carry (GraphMethodException/33).
    // Instead we wait an initial period for video processing, then attempt to publish.
    // If Instagram says the video isn't ready yet, we wait and retry.
    const NOT_READY_PHRASES = ["not yet", "not ready", "processing", "in_progress", "media posted before"];
    const isNotReady = (msg: string) => NOT_READY_PHRASES.some((p) => msg.toLowerCase().includes(p));

    // Initial wait — short videos typically finish processing in 20-30 s.
    await new Promise((r) => setTimeout(r, 30_000));

    let publishData: { id?: string; error?: { message?: string; code?: number } } = {};
    let published = false;
    // Retry up to 8 times × 20 s apart = up to 2 min 30 s additional wait after the initial 30 s.
    for (let attempt = 0; attempt < 9; attempt++) {
      if (attempt > 0) {
        logger.info({ jobId, attempt }, "Reel not ready yet — waiting 20 s before retry");
        await new Promise((r) => setTimeout(r, 20_000));
      }
      const publishRes = await metaFetch(`${GRAPH}/${igId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: token }),
      });
      publishData = await publishRes.json() as typeof publishData;
      logger.info({ jobId, attempt: attempt + 1, ok: publishRes.ok, data: publishData }, "Reel publish attempt");
      if (publishRes.ok && publishData.id) { published = true; break; }
      const errMsg = publishData?.error?.message ?? "";
      if (!isNotReady(errMsg)) {
        throw new Error(`Reel publish failed: ${errMsg || JSON.stringify(publishData)}`);
      }
    }
    if (!published) {
      throw new Error("Reel publish failed: video took too long to process on Instagram's side. Please try again.");
    }

    logActivity({ action: "pushed", postType: "reel", postCount: 1 });
    patch({ status: "finished", igPostId: publishData.id, trial });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reel push failed";
    patch({ status: "error", error: msg });
  }
}

// POST /api/meta/push-reel
// Returns immediately with { jobId, status: "queued" }.  Actual processing
// runs in the background via processReelJob().
router.post("/meta/push-reel", async (req: Request, res: Response) => {
  try {
    const { videoUrl, caption, presetId, trial, graduationStrategy } = req.body as {
      videoUrl: string;
      caption?: string;
      presetId: number;
      trial?: boolean;
      graduationStrategy?: "MANUAL" | "SS_PERFORMANCE";
    };

    if (!videoUrl) { res.status(400).json({ error: "videoUrl required" }); return; }
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }

    const token = preset.metaPageAccessToken;
    const igId = preset.metaInstagramAccountId;

    if (!token) {
      res.status(400).json({ error: "No Meta access token configured for this client. Add it in Client Presets." });
      return;
    }
    if (!igId) {
      res.status(400).json({ error: "No Instagram Account ID configured for this client. Add it in Client Presets." });
      return;
    }

    const jobId = `rl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    reelJobs.set(jobId, { status: "queued", startedAt: Date.now() });

    // Fire and forget — response is sent before the async work starts.
    setImmediate(() => {
      processReelJob(jobId, {
        videoUrl,
        caption: caption || "",
        token,
        igId,
        trial: trial ?? false,
        graduationStrategy: graduationStrategy || "MANUAL",
      }).catch(() => {});
    });

    res.status(202).json({ jobId, status: "queued" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reel push failed";
    res.status(500).json({ error: msg });
  }
});

// GET /api/meta/push-reel/:jobId/status
router.get("/meta/push-reel/:jobId/status", (req: Request, res: Response) => {
  const job = reelJobs.get(req.params["jobId"] as string);
  if (!job) {
    res.status(404).json({ error: "Job not found — it may have expired" });
    return;
  }
  res.json(job);
});

export default router;
