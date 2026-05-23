import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router: IRouter = Router();

const GRAPH = "https://graph.facebook.com/v19.0";

function metaFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function igUploadContainer(
  igAccountId: string,
  token: string,
  imageUrl: string,
  isCarouselItem: boolean,
  caption?: string
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: token,
  };
  if (isCarouselItem) {
    params.is_carousel_item = "true";
  } else if (caption) {
    params.caption = caption;
  }
  const res = await metaFetch(`${GRAPH}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
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
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`IG publish failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function postToInstagram(
  igAccountId: string,
  token: string,
  imageUrls: string[],
  caption: string
): Promise<string> {
  if (imageUrls.length === 1) {
    const containerId = await igUploadContainer(igAccountId, token, imageUrls[0], false, caption);
    return igPublish(igAccountId, token, containerId);
  }
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const id = await igUploadContainer(igAccountId, token, url, true);
    childIds.push(id);
  }
  const carouselRes = await metaFetch(`${GRAPH}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: token,
    }),
  });
  const carouselData = await carouselRes.json();
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
    const data = await res.json();
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
    const data = await res.json();
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
  const feedData = await feedRes.json();
  if (!feedRes.ok) throw new Error(`FB feed post failed (${feedRes.status}): ${feedData?.error?.message || JSON.stringify(feedData)}`);
  return feedData.id;
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
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ error: `Token invalid: ${data?.error?.message || "Unknown error"}` });
      return;
    }
    res.json({ ok: true, name: data.name, id: data.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Test failed" });
  }
});

router.post("/meta/push", async (req: Request, res: Response) => {
  try {
    const { posts, presetId, postType } = req.body as {
      posts: { title: string; caption: string; imageUrls: string[] }[];
      presetId: number;
      postType?: string;
    };

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
      if (igId) {
        try {
          const id = await postToInstagram(igId, token, post.imageUrls, post.caption);
          results.push({ post: post.title, platform: "instagram", status: "success", id });
        } catch (err: any) {
          results.push({ post: post.title, platform: "instagram", status: "error", error: err.message });
        }
      }
      if (pageId) {
        try {
          const id = await postToFacebook(pageId, token, post.imageUrls, post.caption);
          results.push({ post: post.title, platform: "facebook", status: "success", id });
        } catch (err: any) {
          results.push({ post: post.title, platform: "facebook", status: "error", error: err.message });
        }
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    if (succeeded > 0) {
      logActivity({ action: "pushed", postType: (postType as any) || "carousel", postCount: Math.ceil(succeeded / ((igId ? 1 : 0) + (pageId ? 1 : 0))) });
    }

    res.json({ results, summary: { total: results.length, succeeded, failed } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Meta push failed" });
  }
});

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

    // Step 1: create Reel container
    const containerBody: Record<string, unknown> = {
      media_type: "REELS",
      video_url: videoUrl,
      caption: caption || "",
      access_token: token,
    };
    if (trial) {
      containerBody.trial_params = JSON.stringify({
        graduation_strategy: graduationStrategy || "MANUAL",
      });
    }

    const containerRes = await metaFetch(`${GRAPH}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });
    const containerData = await containerRes.json() as { id?: string; error?: { message?: string } };
    if (!containerRes.ok || !containerData.id) {
      throw new Error(`Reel container creation failed: ${containerData?.error?.message || JSON.stringify(containerData)}`);
    }
    const containerId = containerData.id;

    // Step 2: poll until FINISHED (up to ~2 min)
    let statusCode = "IN_PROGRESS";
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await metaFetch(
        `${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`,
      );
      const statusData = await statusRes.json() as { status_code?: string; status?: string };
      statusCode = statusData.status_code || "UNKNOWN";
      if (statusCode === "FINISHED") break;
      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        throw new Error(`Reel container failed with status: ${statusCode} — ${statusData.status || ""}`);
      }
    }

    if (statusCode !== "FINISHED") {
      throw new Error("Reel container timed out. Try again or check the video format.");
    }

    // Step 3: publish
    const publishRes = await metaFetch(`${GRAPH}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishData = await publishRes.json() as { id?: string; error?: { message?: string } };
    if (!publishRes.ok || !publishData.id) {
      throw new Error(`Reel publish failed: ${publishData?.error?.message || JSON.stringify(publishData)}`);
    }

    logActivity({ action: "pushed", postType: "reel", postCount: 1 });
    res.json({ id: publishData.id, trial: trial || false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reel push failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
