import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, calendarPostsTable, approvalBatchesTable, approvalImagesTable, scheduledPostsTable, homeworkQuestionSetsTable, homeworkRepliesTable, bonusContentTable, blogPostsTable, blogCommentsTable, reelsChallengeCompletionsTable, reelSubmissionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, or, sql, desc, asc } from "drizzle-orm";
import crypto from "crypto";
import JSZip from "jszip";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { objectStorageClient } from "../lib/objectStorage";

const reelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });
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

// Zips several remote assets together and streams back one attachment.
// Added because looping individual <a download> clicks for a multi-slide
// carousel is unreliable — browsers only honour one automatic download per
// user gesture in some cases (a client only got the last slide of a 4-slide
// Madame Wax post). One zip, one click, works everywhere.
router.post("/portal-download-zip", async (req, res) => {
  try {
    const { files, zipName } = req.body as { files?: { url: string; filename: string }[]; zipName?: string };
    if (!files || !files.length) { res.status(400).json({ error: "No files provided" }); return; }
    const zip = new JSZip();
    let added = 0;
    for (const f of files) {
      try {
        const upstream = await fetch(f.url);
        if (!upstream.ok) continue;
        const buf = Buffer.from(await upstream.arrayBuffer());
        zip.file(f.filename, buf);
        added++;
      } catch {
        // Skip any single file that fails to fetch — still deliver a zip
        // with whatever did come through rather than failing the whole batch.
      }
    }
    if (!added) { res.status(502).json({ error: "Could not fetch any of the files" }); return; }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    const safeName = (zipName || "download").replace(/[^a-z0-9\-_]/gi, "-");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zip"`);
    res.setHeader("Content-Type", "application/zip");
    res.send(zipBuf);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Zip download failed" });
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
        source: "scheduler" as const,
        scheduledPostId: sp.id,
      };
    });
    const upcomingCalendarMapped = upcomingPosts.map((p) => ({
      ...p,
      source: "calendar" as const,
      scheduledPostId: null as number | null,
    }));
    const mergedUpcoming = [...upcomingCalendarMapped, ...scheduledMapped].sort((a, b) => a.date.localeCompare(b.date));

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
// The August 2026 "Reels Challenge" — a fixed list of relatable,
// non-work-related reel prompts, tracked per-client server-side (not
// localStorage) so a cross-client leaderboard is possible.
export const REELS_CHALLENGE_ITEMS: string[] = [
  "Things I hate hearing other women say about themselves",
  "Things menopause doesn't prepare you for",
  "Things nobody tells you about turning 40",
  "Things I wish I'd known in my twenties",
  "Things people say that are actually just sexist in disguise",
  "Things that annoy me about \"hustle culture\"",
  "Things I stopped apologising for",
  "Things that make me roll my eyes on social media",
  "Things nobody warns you about running your own business",
  "Things I used to believe about ageing that were rubbish",
  "Things I wish someone had told me before having kids",
  "Things that instantly tell me a woman doesn't rate herself",
  "Things people get wrong about northern women",
  "Things I've changed my mind about since my thirties",
  "Things I refuse to feel guilty about anymore",
  "Things that make me want to scream in group chats",
  "Things nobody tells you about grief",
  "Things I wish my mum had told me",
  "Things that make me proud to be a working mother",
  "Things people say to justify being rude",
  "Things I've learned from failing at something publicly",
  "Things that used to embarrass me and now don't",
  "Things people assume about you when you're self-employed",
  "Things I want my daughter to know that I didn't",
  "Things that make me switch off a conversation instantly",
  "Things nobody tells you about starting again",
  "Things I stopped explaining myself for",
  "Things that make me trust a woman instantly",
  "Things I wish I'd said at the time instead of biting my tongue",
  "Things that prove you're finally comfortable in your own skin"
];

router.get("/portal/:token/reels-challenge", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const rows = await db.select().from(reelsChallengeCompletionsTable)
      .where(eq(reelsChallengeCompletionsTable.clientName, preset.name));
    res.json({ items: REELS_CHALLENGE_ITEMS, completed: rows.map((r) => r.itemIndex) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load reels challenge" });
  }
});

// Client: tick/untick one item. Toggles rather than a bulk save, since this
// also has to keep the cross-client leaderboard accurate in real time.
router.post("/portal/:token/reels-challenge/:index/toggle", async (req, res) => {
  try {
    const { token, index } = req.params;
    const itemIndex = Number(index);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= REELS_CHALLENGE_ITEMS.length) {
      res.status(400).json({ error: "Invalid item" }); return;
    }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const existing = await db.select().from(reelsChallengeCompletionsTable)
      .where(and(eq(reelsChallengeCompletionsTable.clientName, preset.name), eq(reelsChallengeCompletionsTable.itemIndex, itemIndex)));
    if (existing.length) {
      await db.delete(reelsChallengeCompletionsTable).where(eq(reelsChallengeCompletionsTable.id, existing[0].id));
      res.json({ completed: false });
    } else {
      await db.insert(reelsChallengeCompletionsTable).values({ clientName: preset.name, itemIndex });
      res.json({ completed: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update reels challenge" });
  }
});

// Leaderboard across every clinic with a live portal — any client's token
// can fetch it (it's shown inside their own portal), it's not filtered to
// just them. Lets Vanessa see standings from any single client's portal
// too, without a separate admin page.
router.get("/portal/:token/reels-challenge/leaderboard", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const result = await db.execute(sql`
      SELECT cp.name AS "clientName", COUNT(rc.id)::int AS "count"
      FROM client_presets cp
      LEFT JOIN reels_challenge_completions rc ON rc.client_name = cp.name
      WHERE cp.client_portal_token IS NOT NULL
      GROUP BY cp.name
      ORDER BY count DESC, cp.name ASC
    `);
    res.json({ leaderboard: (result as { rows?: unknown[] }).rows ?? [], total: REELS_CHALLENGE_ITEMS.length, you: preset.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load leaderboard" });
  }
});

// Client uploads a raw reel (60-90 seconds, no editing needed on their end)
// for Vanessa to caption in the admin captioning tool. Just stores the file
// and a pending row — the actual captioning happens admin-side.
router.post("/portal/:token/reel-submissions", reelUpload.single("video"), async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    if (!req.file) { res.status(400).json({ error: "No video file provided" }); return; }
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `reel-submissions/${uuidv4()}-${(req.file.originalname || "reel.mp4").replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
    await objectStorageClient.bucket(bucketId).file(objectPath).save(req.file.buffer, {
      contentType: req.file.mimetype || "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    const videoUrl = `/api/media/${objectPath}`;
    const [row] = await db.insert(reelSubmissionsTable).values({
      clientName: preset.name,
      videoUrl,
      status: "pending",
    }).returning();
    res.json({ ok: true, id: row?.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to upload reel" });
  }
});

// Client: their own upload history and status (pending / captions added).
router.get("/portal/:token/reel-submissions", async (req, res) => {
  try {
    const { token } = req.params;
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const rows = await db.select().from(reelSubmissionsTable)
      .where(eq(reelSubmissionsTable.clientName, preset.name))
      .orderBy(desc(reelSubmissionsTable.createdAt));
    res.json({ submissions: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load reel submissions" });
  }
});

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

// Lets a client bounce a post they don't want going out, with a short note
// on why, so Vanessa can see the reason without a back-and-forth message.
// Scheduler-sourced posts (id >= 900000000) get their status flipped to
// "cancelled" so the scheduler engine skips them; the reason is stored in
// the reusable notes column. Calendar-sourced posts aren't supported yet
// (the calendar_posts status check constraint has no "cancelled"/"rejected"
// value), so we return a clear 400 rather than silently failing.
router.post("/portal/:token/posts/:id/reject", async (req, res) => {
  try {
    const { token } = req.params;
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    if (isNaN(id) || typeof reason !== "string" || !reason.trim()) {
      res.status(400).json({ error: "A reason is required" }); return;
    }
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }

    if (id >= 900000000) {
      const realId = id - 900000000;
      const [sp] = await db.select().from(scheduledPostsTable)
        .where(and(eq(scheduledPostsTable.id, realId), eq(scheduledPostsTable.presetId, preset.id)));
      if (!sp) { res.status(404).json({ error: "not_found" }); return; }
      await db.update(scheduledPostsTable)
        .set({ status: "cancelled", notes: `Rejected by client: ${reason.trim()}`, updatedAt: new Date() })
        .where(eq(scheduledPostsTable.id, realId));
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: "This post can't be rejected from here yet. Please message Vanessa directly." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reject post" });
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
