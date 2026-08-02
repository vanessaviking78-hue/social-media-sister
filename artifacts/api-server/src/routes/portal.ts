import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable, homeworkQuestionSetsTable, homeworkRepliesTable, bonusContentTable, blogPostsTable, blogCommentsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, or, sql, desc, asc } from "drizzle-orm";
import crypto from "crypto";
import { getApprovedIdeasForClient } from "./revenue-ideas";
import { getVapidPublicKey } from "../lib/push";
import { notifyDownload, notifyRantComment } from "../lib/notify";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BASE_RULES } from "./caption-generator";

const router: IRouter = Router();

router.post("/presets/:id/generate-portal-token", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const token = crypto.randomBytes(24).toString("hex");
    const [updated] = await db.update(clientPresetsTable)
      .set({ clientPortalToken: token, updatedAt: new Date() })
      .where(eq(clientPresetsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Preset not found" }); return; }
    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate token" });
  }
});

// Streams a remote asset (image or video) back to the browser with a
// Content-Disposition: attachment header, so clicking "Download" in the
// client portal always saves the file to the device instead of just
// opening it in a new tab. Fetching the CDN url directly from the browser
// was hitting CORS restrictions on some clients' devices, which silently
// fell back to opening the file in-page instead of downloading it.
router.get("/portal-download", async (req, res) => {
  try {
    const fileUrl = req.query["url"] as string;
    const filename = (req.query["filename"] as string) || "download";
    if (!fileUrl) { res.status(400).json({ error: "Missing url" }); return; }
    const upstream = await fetch(fileUrl);
    if (!upstream.ok) { res.status(502).json({ error: "Failed to fetch file" }); return; }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Download failed" });
  }
});

router.get("/portal/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const clientName = preset.name;
    const today = new Date().toISOString().slice(0, 10);

    const upcomingPosts = await db.select().from(calendarPostsTable)
      .where(and(
        eq(calendarPostsTable.clientName, clientName),
        or(
          eq(calendarPostsTable.status, "scheduled"),
          eq(calendarPostsTable.status, "draft"),
        ),
        gte(calendarPostsTable.date, today),
      ));
    upcomingPosts.sort((a, b) => a.date.localeCompare(b.date));

    // Fold in upcoming posts queued through the scheduler (Bulk Carousel etc.)
    const nowTs = new Date();
    const scheduledRaw = await db.select().from(scheduledPostsTable)
      .where(and(
        eq(scheduledPostsTable.presetId, preset.id),
        eq(scheduledPostsTable.status, "pending"),
        gte(scheduledPostsTable.scheduledAt, nowTs),
      ));
    const scheduledMapped = scheduledRaw.map((sp) => {
      const c = (sp.content || {}) as { imageUrls?: string[]; caption?: string; title?: string };
      return {
        id: 900000000 + sp.id,
        date: new Date(sp.scheduledAt).toISOString().slice(0, 10),
        title: c.title || "",
        caption: c.caption || "",
        postType: sp.postType,
        status: "scheduled",
        color: "#ec4899",
        imageUrl: (c.imageUrls && c.imageUrls[0]) || null,
        imageUrls: c.imageUrls || [],
      };
    });
    const mergedUpcoming = [...upcomingPosts, ...scheduledMapped].sort((a, b) => a.date.localeCompare(b.date));

    // Already-posted content, so clients can look back at and download
    // things that have gone live rather than losing access the moment a
    // post moves off the "upcoming" list.
    const postedCalendar = await db.select().from(calendarPostsTable)
      .where(and(
        eq(calendarPostsTable.clientName, clientName),
        eq(calendarPostsTable.status, "posted"),
      ));
    const postedCalendarMapped = postedCalendar.map((p) => ({
      id: p.id,
      date: p.date,
      title: p.title,
      caption: p.caption,
      postType: p.postType,
      status: "posted",
      color: p.color,
      imageUrl: p.imageUrl,
      imageUrls: p.imageUrl ? [p.imageUrl] : [],
      videoUrl: null as string | null,
      source: "calendar" as const,
      scheduledPostId: null as number | null,
    }));

    const publishedRaw = await db.select().from(scheduledPostsTable)
      .where(and(
        eq(scheduledPostsTable.presetId, preset.id),
        eq(scheduledPostsTable.status, "published"),
      ));
    const publishedMapped = publishedRaw.map((sp) => {
      const c = (sp.content || {}) as { imageUrls?: string[]; videoUrl?: string; caption?: string; title?: string };
      const postedDate = sp.metaPostedAt || sp.scheduledAt;
      return {
        id: 900000000 + sp.id,
        date: new Date(postedDate).toISOString().slice(0, 10),
        title: c.title || "",
        caption: c.caption || "",
        postType: sp.postType,
        status: "posted",
        color: "#ec4899",
        imageUrl: (c.imageUrls && c.imageUrls[0]) || null,
        imageUrls: c.imageUrls || [],
        videoUrl: c.videoUrl || null,
        source: "scheduler" as const,
        scheduledPostId: sp.id,
      };
    });

    const publishedPosts = [...postedCalendarMapped, ...publishedMapped]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);

    const batches = await db.select().from(approvalBatchesTable)
      .where(eq(approvalBatchesTable.clientName, clientName));

    const batchesWithCounts = await Promise.all(batches.map(async (b) => {
      const images = await db.select().from(approvalImagesTable)
        .where(eq(approvalImagesTable.batchId, b.id));
      return {
        ...b,
        totalImages: images.length,
        pendingImages: images.filter((i) => i.status === "pending").length,
        approvedImages: images.filter((i) => i.status === "approved").length,
        rejectedImages: images.filter((i) => i.status === "rejected").length,
      };
    }));
    batchesWithCounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const revenueIdeas = await getApprovedIdeasForClient(clientName).catch(() => []);

    res.json({
      clientName,
      logoUrl: preset.logoUrl || null,
      photoUrl: preset.clientPhotoUrl || null,
      accentColor: preset.accentColor || null,
      welcomeMessage: preset.portalWelcomeMessage || null,
      upcomingPosts: mergedUpcoming,
      publishedPosts,
      approvalBatches: batchesWithCounts,
      revenueIdeas,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load portal" });
  }
});

// Fired from the client portal the moment someone taps "Download image(s)".
// Purely a notification beacon, it never blocks or affects the download
// itself, which already happened client side before this call goes out.
router.post("/portal/:token/download", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const { title, fileCount } = req.body as { title?: string; fileCount?: number };
    void notifyDownload({ clientName: preset.name, title, fileCount });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to log download" });
  }
});

// Client: get their saved reel checklist progress (100 Reels tab), synced
// server side so it survives switching phones and Vanessa can actually see it.
router.get("/portal/:token/reels", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    let ticked: Record<string, boolean> = {};
    try { ticked = JSON.parse(preset.completedReels || "{}"); } catch { ticked = {}; }
    res.json({ ticked });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load reel progress" });
  }
});

// Client: save their reel checklist progress.
router.patch("/portal/:token/reels", async (req, res) => {
  try {
    const { token } = req.params;
    const { ticked } = req.body as { ticked?: Record<string, boolean> };
    if (!ticked || typeof ticked !== "object") { res.status(400).json({ error: "Invalid request" }); return; }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    await db.update(clientPresetsTable)
      .set({ completedReels: JSON.stringify(ticked) })
      .where(eq(clientPresetsTable.id, preset.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save reel progress" });
  }
});

// Client: their own history of before/afters, selfies, reviews, requests and
// onboarding sends, with whether Vanessa's actioned them yet.
router.get("/portal/:token/submissions", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const result = await db.execute(sql`
      SELECT id, treatment, story, submitter_name AS "submitterName", status, created_at AS "createdAt"
      FROM before_after_submissions WHERE preset_id = ${preset.id}
      ORDER BY created_at DESC LIMIT 50
    `);
    res.json({ submissions: (result as { rows?: unknown[] }).rows ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load submissions" });
  }
});

// Client: a quick honest recap, posts made this month, reels filmed so far,
// and how many things they've sent through, a small proof of work.
router.get("/portal/:token/recap", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const now = new Date();
    const monthPrefix = now.toISOString().slice(0, 7);
    const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    const postsResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM calendar_posts
      WHERE client_name = ${preset.name} AND date LIKE ${monthPrefix + "%"}
    `);
    const scheduledResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM scheduled_posts
      WHERE preset_id = ${preset.id} AND to_char(scheduled_at, 'YYYY-MM') = ${monthPrefix}
    `);
    const submissionsResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM before_after_submissions
      WHERE preset_id = ${preset.id} AND to_char(created_at, 'YYYY-MM') = ${monthPrefix}
    `);

    let ticked: Record<string, boolean> = {};
    try { ticked = JSON.parse(preset.completedReels || "{}"); } catch { ticked = {}; }
    const reelsCompleted = Object.values(ticked).filter(Boolean).length;

    const postsThisMonth = Number((postsResult as { rows?: { count: number }[] }).rows?.[0]?.count ?? 0)
      + Number((scheduledResult as { rows?: { count: number }[] }).rows?.[0]?.count ?? 0);
    const submissionsThisMonth = Number((submissionsResult as { rows?: { count: number }[] }).rows?.[0]?.count ?? 0);

    res.json({ monthLabel, postsThisMonth, submissionsThisMonth, reelsCompleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load recap" });
  }
});

// Lets a client update the caption on one of their own upcoming posts. Works
// for both calendar posts and scheduler-sourced posts (the latter are
// identified by the 900000000 offset baked into their id in the GET above).
router.patch("/portal/:token/posts/:id", async (req, res) => {
  try {
    const { token } = req.params;
    const id = Number(req.params.id);
    const { caption } = req.body as { caption?: string };
    if (isNaN(id) || typeof caption !== "string") { res.status(400).json({ error: "Invalid request" }); return; }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    if (id >= 900000000) {
      const realId = id - 900000000;
      const [sp] = await db.select().from(scheduledPostsTable)
        .where(and(eq(scheduledPostsTable.id, realId), eq(scheduledPostsTable.presetId, preset.id)));
      if (!sp) { res.status(404).json({ error: "not_found" }); return; }
      const content = { ...(sp.content || {}), caption: caption.trim() };
      await db.update(scheduledPostsTable).set({ content }).where(eq(scheduledPostsTable.id, realId));
    } else {
      const [updated] = await db.update(calendarPostsTable)
        .set({ caption: caption.trim(), updatedAt: new Date() })
        .where(and(eq(calendarPostsTable.id, id), eq(calendarPostsTable.clientName, preset.name)))
        .returning();
      if (!updated) { res.status(404).json({ error: "not_found" }); return; }
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update caption" });
  }
});

// Rewrites a caption on request from the client, using their note plus the
// post's existing title/caption for context. Reuses the same compliance
// rules as the internal caption generator so nothing off-brand slips out.
router.post("/portal/:token/posts/:id/generate-caption", async (req, res) => {
  try {
    const { token } = req.params;
    const id = Number(req.params.id);
    const { note, currentCaption, title } = req.body as { note?: string; currentCaption?: string; title?: string };
    if (isNaN(id)) { res.status(400).json({ error: "Invalid request" }); return; }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const systemPrompt = `You write a single Instagram/Facebook caption for an aesthetics clinic called ${preset.name}. Rewrite the caption below exactly the way the client has asked. Return plain text only, no JSON, no quote marks around it, no title.\n${BASE_RULES}`;
    const userContent = `Post title: ${title || "(no title)"}\nCurrent caption: ${currentCaption || "(none yet)"}\nWhat the client wants changed: ${note?.trim() || "Just make it better."}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.9,
      max_tokens: 400,
    });
    const caption = completion.choices[0]?.message?.content?.trim() || "";
    if (!caption) { res.status(500).json({ error: "No caption returned" }); return; }
    res.json({ caption });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate caption" });
  }
});

// Public key the client portal needs to call pushManager.subscribe(). Safe to
// expose — it's the public half of the VAPID keypair, not a secret.
router.get("/portal-push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) { res.status(503).json({ error: "Push notifications aren't set up yet" }); return; }
  res.json({ publicKey: key });
});

// Stores (or refreshes) a browser's push subscription against a client's
// existing portal token. No login involved, the token itself is the identity.
router.post("/portal/:token/push-subscribe", async (req, res) => {
  try {
    const { token } = req.params;
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    await db.execute(sql`
      INSERT INTO portal_push_subscriptions (client_portal_token, endpoint, p256dh, auth)
      VALUES (${token}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET client_portal_token = EXCLUDED.client_portal_token
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save subscription" });
  }
});

// Called when a client turns notifications back off on a device.
router.post("/portal/:token/push-unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
    await db.execute(sql`DELETE FROM portal_push_subscriptions WHERE endpoint = ${endpoint}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove subscription" });
  }
});

// Client: current active weekly homework questions, plus this clients existing reply if any.
router.get("/portal/:token/homework", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const [set] = await db.select().from(homeworkQuestionSetsTable)
      .where(eq(homeworkQuestionSetsTable.status, "active"))
      .orderBy(desc(homeworkQuestionSetsTable.createdAt))
      .limit(1);

    let existingReply = null;
    if (set) {
      const [reply] = await db.select().from(homeworkRepliesTable)
        .where(and(
          eq(homeworkRepliesTable.setId, set.id),
          eq(homeworkRepliesTable.presetId, preset.id),
        ));
      existingReply = reply || null;
    }

    res.json({ set: set || null, existingReply });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load homework" });
  }
});

// Client: submit or update the current weeks homework reply.
router.post("/portal/:token/homework/reply", async (req, res) => {
  try {
    const { token } = req.params;
    const { setId, answer1, answer2, answer3, answer4, answer5, answer6, answer7, answer8, answer9, answer10 } = req.body as {
      setId?: number; answer1?: string; answer2?: string; answer3?: string;
      answer4?: string; answer5?: string; answer6?: string; answer7?: string;
      answer8?: string; answer9?: string; answer10?: string;
    };
    if (!setId) { res.status(400).json({ error: "setId required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const [existing] = await db.select().from(homeworkRepliesTable)
      .where(and(
        eq(homeworkRepliesTable.setId, setId),
        eq(homeworkRepliesTable.presetId, preset.id),
      ));

    if (existing) {
      const [updated] = await db.update(homeworkRepliesTable)
        .set({
          answer1: answer1 || "",
          answer2: answer2 || "",
          answer3: answer3 || "",
          answer4: answer4 || "",
          answer5: answer5 || "",
          answer6: answer6 || "",
          answer7: answer7 || "",
          answer8: answer8 || "",
          answer9: answer9 || "",
          answer10: answer10 || "",
          updatedAt: new Date(),
        })
        .where(eq(homeworkRepliesTable.id, existing.id))
        .returning();
      res.json({ reply: updated });
      return;
    }

    const [reply] = await db.insert(homeworkRepliesTable)
      .values({
        setId,
        presetId: preset.id,
        clientName: preset.name,
        answer1: answer1 || "",
        answer2: answer2 || "",
        answer3: answer3 || "",
        answer4: answer4 || "",
        answer5: answer5 || "",
        answer6: answer6 || "",
        answer7: answer7 || "",
        answer8: answer8 || "",
        answer9: answer9 || "",
        answer10: answer10 || "",
      })
      .returning();
    res.status(201).json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save homework reply" });
  }
});

// Client: bonus content dropped in for this client, newest first.
router.get("/portal/:token/bonus-content", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    const items = await db.select().from(bonusContentTable)
      .where(eq(bonusContentTable.presetId, preset.id))
      .orderBy(desc(bonusContentTable.createdAt));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load bonus content" });
  }
});

// Client: leave a comment under one of Vanessa's rants. Notifies Vanessa by
// email; the comment shows straight away in the portal's rants tab and on
// the public shareable page for that post.
router.post("/portal/:token/rants/:postId/comments", async (req, res) => {
  try {
    const { token, postId } = req.params;
    const { comment } = req.body as { comment?: string };
    if (!comment?.trim()) { res.status(400).json({ error: "Say something first." }); return; }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const id = Number(postId);
    const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    const [saved] = await db.insert(blogCommentsTable)
      .values({ blogPostId: id, clientName: preset.name, comment: comment.trim() })
      .returning();
    notifyRantComment({ clientName: preset.name, postTitle: post?.title, comment: comment.trim() }).catch(() => {});
    res.status(201).json({ comment: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save comment" });
  }
});

export default router;
