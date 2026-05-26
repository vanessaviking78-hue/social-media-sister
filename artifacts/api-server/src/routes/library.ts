import { Router, type IRouter } from "express";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";
import JSZip from "jszip";
import { db } from "@workspace/db";
import { contentLibraryTable, calendarPostsTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { v4 as uuid } from "uuid";
import { logger } from "../lib/logger";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 },
});

const router: IRouter = Router();

function detectMime(filename: string): string {
  const ext = (filename.toLowerCase().split(".").pop() ?? "");
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", avif: "image/avif",
    mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", avi: "video/avi",
  };
  return map[ext] ?? "application/octet-stream";
}

function safeClientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapToCalendarType(postType: string): "carousel" | "single-image" | "story" {
  if (postType === "carousel") return "carousel";
  if (postType === "story") return "story";
  return "single-image";
}

async function uploadToPublicGCS(
  buffer: Buffer,
  filename: string,
  clientName: string,
): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const slug = safeClientSlug(clientName);
  const key = `library/${slug}/${uuid()}/${filename}`;
  const bucket = objectStorageClient.bucket(bucketId);
  await bucket.file(key).save(buffer, {
    public: true,
    contentType: detectMime(filename),
  });
  return `https://storage.googleapis.com/${bucketId}/${key}`;
}

// GET /api/library — list items for a client
router.get("/library", async (req, res) => {
  try {
    const { clientName } = req.query;
    let query = db.select().from(contentLibraryTable).$dynamic();
    if (clientName && typeof clientName === "string" && clientName.trim()) {
      query = query.where(eq(contentLibraryTable.clientName, clientName.trim()));
    }
    const items = await query.orderBy(contentLibraryTable.createdAt);
    res.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list library items";
    req.log.error({ err }, msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/library — create a single item
router.post("/library", async (req, res) => {
  try {
    const { clientName, postType, caption, mediaUrl, mediaUrls, thumbnailUrl, metadata } = req.body as {
      clientName?: string; postType?: string; caption?: string;
      mediaUrl?: string; mediaUrls?: string[]; thumbnailUrl?: string;
      metadata?: Record<string, unknown>;
    };
    if (!clientName?.trim()) { res.status(400).json({ error: "clientName required" }); return; }
    const [item] = await db.insert(contentLibraryTable).values({
      clientName: clientName.trim(),
      postType: postType ?? "single",
      caption: caption ?? "",
      mediaUrl: mediaUrl ?? null,
      mediaUrls: mediaUrls ?? null,
      thumbnailUrl: thumbnailUrl ?? null,
      metadata: metadata ?? null,
    }).returning();
    res.json({ item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create library item";
    req.log.error({ err }, msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/library/bulk — create multiple items at once
router.post("/library/bulk", async (req, res) => {
  try {
    const { items } = req.body as {
      items: Array<{
        clientName: string; postType?: string; caption?: string;
        mediaUrl?: string; mediaUrls?: string[]; thumbnailUrl?: string;
        metadata?: Record<string, unknown>;
      }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array required" }); return;
    }
    const inserted = await db.insert(contentLibraryTable).values(
      items.map((i) => ({
        clientName: i.clientName,
        postType: i.postType ?? "single",
        caption: i.caption ?? "",
        mediaUrl: i.mediaUrl ?? null,
        mediaUrls: i.mediaUrls ?? null,
        thumbnailUrl: i.thumbnailUrl ?? null,
        metadata: i.metadata ?? null,
      })),
    ).returning();
    res.json({ items: inserted, count: inserted.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to bulk create";
    req.log.error({ err }, msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/library/:id
router.delete("/library/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db.delete(contentLibraryTable).where(eq(contentLibraryTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete library item";
    req.log.error({ err }, msg);
    res.status(500).json({ error: msg });
  }
});

// POST /api/library/upload-file — upload a single file to public GCS, return its URL
router.post(
  "/library/upload-file",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      const { clientName } = req.body as { clientName?: string };
      if (!file) { res.status(400).json({ error: "file required" }); return; }
      if (!clientName?.trim()) { res.status(400).json({ error: "clientName required" }); return; }
      const url = await uploadToPublicGCS(file.buffer, file.originalname, clientName.trim());
      res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      req.log.error({ err }, msg);
      res.status(500).json({ error: msg });
    }
  },
);

// POST /api/library/upload — CSV + zip bulk import
router.post(
  "/library/upload",
  upload.fields([{ name: "csv", maxCount: 1 }, { name: "zip", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { clientName } = req.body as { clientName?: string };
      if (!clientName?.trim()) { res.status(400).json({ error: "clientName required" }); return; }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const csvFile = files?.csv?.[0];
      const zipFile = files?.zip?.[0];
      if (!csvFile) { res.status(400).json({ error: "csv file required" }); return; }
      if (!zipFile) { res.status(400).json({ error: "zip file required" }); return; }

      type CsvRow = {
        post_type: string; caption: string; media_filename: string; music_track: string;
        text_style: string; lead_in: string; hero_word: string; hero_color: string; leadin_color: string;
      };
      const rows = csvParse(csvFile.buffer, {
        columns: ["post_type", "caption", "media_filename", "music_track", "text_style", "lead_in", "hero_word", "hero_color", "leadin_color"],
        skip_empty_lines: true,
        trim: true,
        from_line: 1,
        relax_column_count: true,
      }) as CsvRow[];

      const zip = await JSZip.loadAsync(zipFile.buffer);
      const fileMap = new Map<string, Buffer>();
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!entry.dir) {
          const basename = name.split("/").pop()!;
          fileMap.set(basename, Buffer.from(await entry.async("arraybuffer")));
        }
      }

      req.log.info({ clientName, rowCount: rows.length, zipFiles: fileMap.size }, "Library upload started");

      const created = [];
      for (const row of rows) {
        if (!row.media_filename) continue;
        const filenames = row.media_filename.split("|").map((f) => f.trim()).filter(Boolean);
        const uploadedUrls: string[] = [];
        let thumbnailUrl: string | null = null;

        for (const filename of filenames) {
          const buf = fileMap.get(filename);
          if (!buf) {
            req.log.warn({ filename }, "File in CSV not found in zip — skipping");
            continue;
          }
          const url = await uploadToPublicGCS(buf, filename, clientName.trim());
          uploadedUrls.push(url);
          if (!thumbnailUrl) thumbnailUrl = url;
        }

        if (uploadedUrls.length === 0) continue;

        const rawType = (row.post_type || "").toLowerCase().trim();
        const isCarousel = uploadedUrls.length > 1 || rawType === "carousel";
        const postType = rawType || (isCarousel ? "carousel" : "single");
        const textStyle = (row.text_style || "").toLowerCase().trim();
        const isValidHex = (c: string) => /^#[0-9a-fA-F]{3,8}$/.test((c || "").trim());

        const heroMeta = textStyle === "hero" ? {
          textStyle: "hero",
          heroLeadIn: (row.lead_in || "").trim() || null,
          heroWord: (row.hero_word || "").trim() || null,
          heroWordColor: isValidHex(row.hero_color) ? row.hero_color.trim() : "#ffffff",
          heroLeadInColor: isValidHex(row.leadin_color) ? row.leadin_color.trim() : "#E91976",
        } : null;

        const metadata: Record<string, unknown> = {};
        if (row.music_track) metadata.musicTrack = row.music_track;
        if (heroMeta) Object.assign(metadata, heroMeta);

        const [item] = await db.insert(contentLibraryTable).values({
          clientName: clientName.trim(),
          postType,
          caption: row.caption ?? "",
          mediaUrl: uploadedUrls.length === 1 ? uploadedUrls[0] : null,
          mediaUrls: uploadedUrls.length > 1 ? uploadedUrls : null,
          thumbnailUrl,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        }).returning();

        created.push(item);
      }

      req.log.info({ created: created.length }, "Library upload complete");
      res.json({ items: created, count: created.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      req.log.error({ err }, msg);
      res.status(500).json({ error: msg });
    }
  },
);

// POST /api/library/auto-schedule — schedule selected items daily, create calendar posts
router.post("/library/auto-schedule", async (req, res) => {
  try {
    const { itemIds, clientName, startDate, postTime } = req.body as {
      itemIds?: number[];
      clientName?: string;
      startDate?: string;
      postTime?: string;
    };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: "itemIds array required" }); return;
    }
    if (!clientName?.trim()) { res.status(400).json({ error: "clientName required" }); return; }
    if (!startDate?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      res.status(400).json({ error: "startDate must be YYYY-MM-DD" }); return;
    }
    if (!postTime?.match(/^\d{2}:\d{2}$/)) {
      res.status(400).json({ error: "postTime must be HH:mm" }); return;
    }

    const items = await db
      .select()
      .from(contentLibraryTable)
      .where(inArray(contentLibraryTable.id, itemIds));

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const ordered = itemIds.map((id) => itemMap.get(id)).filter(Boolean) as typeof items;

    if (ordered.length === 0) { res.status(404).json({ error: "No matching library items found" }); return; }

    const [sy, sm, sd] = startDate.split("-").map(Number);
    const calendarEntries = ordered.map((item, i) => {
      const d = new Date(sy, sm - 1, sd + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        date,
        clientName: clientName.trim(),
        postType: mapToCalendarType(item.postType) as "carousel" | "single-image" | "story",
        title: "",
        caption: item.caption,
        notes: `Scheduled from library at ${postTime}`,
        status: "scheduled" as const,
        color: "#ec4899",
        imageUrl: item.thumbnailUrl ?? item.mediaUrl ?? null,
      };
    });

    const created = await db.insert(calendarPostsTable).values(calendarEntries).returning();

    await db.delete(contentLibraryTable).where(inArray(contentLibraryTable.id, itemIds));

    const endDate = calendarEntries[calendarEntries.length - 1].date;
    req.log.info({ count: created.length, startDate, endDate, clientName }, "Auto-scheduled library items");
    res.json({ count: created.length, startDate, endDate, posts: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Auto-schedule failed";
    req.log.error({ err }, msg);
    res.status(500).json({ error: msg });
  }
});

// GET /api/library/clients — unique client names that have library items
router.get("/library/clients", async (_req, res) => {
  try {
    const presets = await db.select({ name: clientPresetsTable.name }).from(clientPresetsTable).orderBy(clientPresetsTable.name);
    res.json({ clients: presets.map((p) => p.name) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch clients";
    res.status(500).json({ error: msg });
  }
});

export default router;
