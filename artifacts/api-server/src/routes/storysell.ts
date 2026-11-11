import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { clientPresetsTable, scheduledPostsTable } from "@workspace/db/schema";
import { and, eq, like } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { nextFreeMinute } from "./scheduler";

// Routes used only by the Stories That Sell app. Every request must carry the shared secret in
// the x-storysell-key header (set STORYSELL_API_KEY on this service and on Stories That Sell).
// The secret is held by the Stories That Sell server, never by a browser.
const router = Router();

const MAX_FRAMES = 5;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireStorySellKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.STORYSELL_API_KEY || "";
  if (!configured) { res.status(503).json({ error: "STORYSELL_API_KEY is not set on this service" }); return; }
  const sent = String(req.get("x-storysell-key") || "");
  if (!sent || !sameSecret(sent, configured)) { res.status(401).json({ error: "Bad key" }); return; }
  next();
}

router.use("/storysell", requireStorySellKey);

// Clients, with only what Stories That Sell needs. Never returns tokens.
router.get("/storysell/presets", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(clientPresetsTable);
    const presets = rows
      .map((p) => ({
        id: p.id,
        name: p.name,
        metaConnected: !!(p.metaPageAccessToken && p.metaInstagramAccountId),
      }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not list clients" });
  }
});

type Body = {
  presetId?: number;
  key?: string;
  title?: string;
  stickerIdea?: string;
  scheduledAt?: string;
  draft?: boolean;
  frames?: { name?: string; base64?: string }[];
};

// One Story day: 1 to 5 frames become one scheduled Story post (each frame goes out as its own Story,
// in order). Sending the same key for the same client twice returns the first post instead of a copy.
router.post("/storysell/stories", async (req: Request, res: Response) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const b = (req.body || {}) as Body;
    const presetId = Number(b.presetId);
    const key = String(b.key || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 80);
    const draft = b.draft === true;
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (!key) { res.status(400).json({ error: "key required" }); return; }
    if (!Array.isArray(b.frames) || b.frames.length < 1 || b.frames.length > MAX_FRAMES) {
      res.status(400).json({ error: `Send between 1 and ${MAX_FRAMES} frames` }); return;
    }
    let when: Date | null = null;
    if (!draft) {
      when = new Date(String(b.scheduledAt || ""));
      if (isNaN(when.getTime())) { res.status(400).json({ error: "scheduledAt must be a valid date" }); return; }
    }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Client not found" }); return; }
    if (!draft && !(preset.metaPageAccessToken && preset.metaInstagramAccountId)) {
      res.status(400).json({ error: `${preset.name} has no Instagram connection for the scheduler. Park these in the Waiting Room instead.` });
      return;
    }

    const notesPrefix = `Stories That Sell ${key}`;
    const [existing] = await db.select().from(scheduledPostsTable)
      .where(and(eq(scheduledPostsTable.presetId, presetId), like(scheduledPostsTable.notes, `${notesPrefix}%`)))
      .limit(1);
    if (existing) { res.json({ post: existing, duplicate: true }); return; }

    const buffers: Buffer[] = [];
    for (const f of b.frames) {
      const raw = String(f?.base64 || "");
      const data = raw.includes(",") ? raw.split(",")[1] : raw;
      const buf = Buffer.from(data, "base64");
      // PNG signature check, so only real images reach the public bucket.
      if (buf.length < 8 || buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
        res.status(400).json({ error: "Every frame must be a PNG image" }); return;
      }
      if (buf.length > MAX_FRAME_BYTES) { res.status(400).json({ error: "A frame is larger than 8 MB" }); return; }
      buffers.push(buf);
    }

    const base = (process.env.PUBLIC_BASE_URL || "https://www.thecybersuite.com").replace(/\/+$/, "");
    const stamp = Date.now();
    const rand = crypto.randomBytes(4).toString("hex");
    const bucket = objectStorageClient.bucket(bucketId);
    const imageUrls: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const name = `${stamp}-${rand}-storysell-${i + 1}.png`;
      await bucket.file(`carousel-images/${name}`).save(buffers[i], {
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      imageUrls.push(`${base}/api/content/images/carousel-images/${name}`);
    }

    const idea = String(b.stickerIdea || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const [post] = await db.insert(scheduledPostsTable).values({
      presetId,
      clientName: preset.name,
      postType: "story",
      content: {
        imageUrls,
        caption: "",
        title: String(b.title || "Stories That Sell").slice(0, 120),
        sourceTool: "stories-that-sell",
      },
      scheduledAt: draft || !when ? new Date() : await nextFreeMinute(when),
      status: draft ? "draft" : "pending",
      isTrial: false,
      notes: idea ? `${notesPrefix}. Add by hand on frame 2: ${idea}` : notesPrefix,
      stickerConfig: null,
    }).returning();

    res.status(201).json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not send the Story" });
  }
});

export default router;
