import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

// Receives finished Story days from the Stories That Sell app. One request is one day:
// 1 to 5 frames that go out back to back as a single Instagram Stories post.
const router = Router();

function keyOk(req: Request, res: Response, next: NextFunction) {
  const want = process.env.STORYSELL_API_KEY || "";
  if (!want) { res.status(503).json({ error: "The Stories link is not switched on here." }); return; }
  const got = String(req.header("x-storysell-key") || "");
  const a = Buffer.from(got), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { res.status(401).json({ error: "Wrong key." }); return; }
  next();
}

router.get("/storysell/presets", keyOk, async (_req, res) => {
  try {
    const rows = await db.select({
      id: clientPresetsTable.id,
      name: clientPresetsTable.name,
      ig: clientPresetsTable.metaInstagramAccountId,
      token: clientPresetsTable.metaPageAccessToken,
    }).from(clientPresetsTable).orderBy(sql`LOWER(${clientPresetsTable.name})`);
    res.json({ presets: rows.map((r) => ({ id: r.id, name: r.name, metaConnected: !!(r.ig && r.token) })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/storysell/stories", keyOk, async (req, res) => {
  try {
    const b = req.body || {};
    const presetId = Number(b.presetId);
    const frames: { name?: string; base64?: string }[] = Array.isArray(b.frames) ? b.frames : [];
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (frames.length < 1 || frames.length > 5) { res.status(400).json({ error: "Each day needs 1 to 5 frames." }); return; }
    const draft = b.draft !== false;
    const when = new Date(String(b.scheduledAt || ""));
    if (!draft && isNaN(when.getTime())) { res.status(400).json({ error: "Bad date." }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Client not found." }); return; }

    // Same day sent twice never makes two posts.
    const dayKey = String(b.key || "").slice(0, 80);
    if (dayKey) {
      const [dupe] = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable)
        .where(and(
          eq(scheduledPostsTable.presetId, presetId),
          sql`${scheduledPostsTable.content}->>'storysellKey' = ${dayKey}`,
          sql`${scheduledPostsTable.status} in ('draft','pending','processing')`,
        )).limit(1);
      if (dupe) { res.json({ ok: true, duplicate: true, post: { id: dupe.id } }); return; }
    }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const bucket = objectStorageClient.bucket(bucketId);

    const imageUrls: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const raw = String(frames[i].base64 || "").replace(/^data:image\/\w+;base64,/, "");
      const png = Buffer.from(raw, "base64");
      if (png.length < 100) { res.status(400).json({ error: `Frame ${i + 1} is empty.` }); return; }
      const key = `storysell/${presetId}/${Date.now()}-${i + 1}-${crypto.randomBytes(3).toString("hex")}.png`;
      await bucket.file(key).save(png, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });
      imageUrls.push(`/api/media/${key}`);
    }

    const [post] = await db.insert(scheduledPostsTable).values({
      presetId,
      clientName: preset.name,
      postType: "stories",
      content: { imageUrls, caption: "", title: String(b.title || "Stories That Sell"), storysellKey: dayKey } as any,
      scheduledAt: draft ? new Date() : when,
      status: draft ? "draft" : "pending",
      isTrial: false,
      notes: b.stickerIdea ? `Sticker idea: ${String(b.stickerIdea).slice(0, 200)}` : "",
      stickerConfig: null,
    }).returning();

    res.status(201).json({ ok: true, post: { id: post.id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
