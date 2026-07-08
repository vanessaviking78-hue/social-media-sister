import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// Admin: upload a new PDF to the shared resource library.
router.post("/resources/upload", requireAuth, pdfUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

    const title = ((req.body?.title as string) || "").trim() || req.file.originalname;
    const description = ((req.body?.description as string) || "").trim();

    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `resource-pdfs/${timestamp}-${safeName}`;

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);
    await file.save(req.file.buffer, {
      contentType: "application/pdf",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    await db.execute(sql`
      INSERT INTO resource_library (title, description, file_key, file_name)
      VALUES (${title}, ${description}, ${objectPath}, ${req.file.originalname})
    `);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// Admin: list every document in the library.
router.get("/resources", requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, title, description, file_key AS "fileKey", file_name AS "fileName", created_at AS "createdAt"
      FROM resource_library
      ORDER BY created_at DESC
    `);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: unknown[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load resources" });
  }
});

// Admin: delete a document from the library and its file in storage.
router.delete("/resources/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const existing = await db.execute(sql`SELECT file_key AS "fileKey" FROM resource_library WHERE id = ${id}`);
    const row = (existing as { rows?: Array<{ fileKey: string }> }).rows?.[0];

    await db.execute(sql`DELETE FROM resource_library WHERE id = ${id}`);

    if (row?.fileKey && bucketId) {
      await objectStorageClient.bucket(bucketId).file(row.fileKey).delete().catch(() => {});
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete resource" });
  }
});

// Public: the client portal's shared resource library, same list for every client.
router.get("/portal-resources", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, title, description, file_key AS "fileKey", file_name AS "fileName", created_at AS "createdAt"
      FROM resource_library
      ORDER BY created_at DESC
    `);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: unknown[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load resources" });
  }
});

export default router;
