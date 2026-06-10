import { Router } from "express";
import { db } from "@workspace/db";
import { stickerLibraryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

router.get("/stickers", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(stickerLibraryTable)
      .orderBy(stickerLibraryTable.createdAt);
    res.json({ stickers: rows });
  } catch (err: any) {
    req.log.error({ err }, "Failed to list stickers");
    res.status(500).json({ error: "Failed to load sticker catalogue" });
  }
});

router.post("/stickers", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) return res.status(500).json({ error: "Object storage not configured" });

    const { name, base64 } = req.body as { name: string; base64: string };
    if (!name || !base64) return res.status(400).json({ error: "name and base64 required" });

    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length > 15 * 1024 * 1024) return res.status(400).json({ error: "Sticker exceeds 15 MB" });

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `stickers/${Date.now()}-${safeName}`;
    const bucket = objectStorageClient.bucket(bucketId);
    await bucket.file(objectPath).save(buffer, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const url = `${proto}://${host}/api/content/images/${objectPath}`;

    const [row] = await db
      .insert(stickerLibraryTable)
      .values({ name: name.replace(/\.[^.]+$/, ""), url })
      .returning();

    res.json({ sticker: row });
  } catch (err: any) {
    req.log.error({ err }, "Failed to save sticker");
    res.status(500).json({ error: "Failed to save sticker" });
  }
});

router.delete("/stickers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await db.delete(stickerLibraryTable).where(eq(stickerLibraryTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to delete sticker");
    res.status(500).json({ error: "Failed to delete sticker" });
  }
});

export default router;
