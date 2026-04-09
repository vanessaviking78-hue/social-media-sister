import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { approvalBatchesTable, approvalImagesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const provided = req.headers["x-app-password"];
  if (provided === appPassword) return next();
  res.status(401).json({ error: "Unauthorized" });
}

router.post("/approval/batches", requireAuth, async (req, res) => {
  try {
    const { name, clientName, presetId, imageUrls, expiryDays } = req.body as {
      name: string;
      clientName?: string;
      presetId?: number;
      imageUrls: string[];
      expiryDays?: number;
    };

    if (!name || !imageUrls?.length) {
      return res.status(400).json({ error: "Name and at least one image URL required" });
    }

    const token = randomBytes(6).toString("hex");
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    const [batch] = await db.insert(approvalBatchesTable).values({
      name,
      clientName: clientName || "",
      presetId: presetId || null,
      token,
      expiresAt,
      status: "pending",
    }).returning();

    const images = await db.insert(approvalImagesTable).values(
      imageUrls.map((url) => ({
        batchId: batch.id,
        imageUrl: url,
        status: "pending",
        clientNote: "",
      }))
    ).returning();

    res.json({ batch, images });
  } catch (err: any) {
    console.error("Create approval batch error:", err);
    res.status(500).json({ error: err.message || "Failed to create batch" });
  }
});

router.get("/approval/batches", requireAuth, async (_req, res) => {
  try {
    const batches = await db.select().from(approvalBatchesTable).orderBy(desc(approvalBatchesTable.createdAt));

    const batchesWithImages = await Promise.all(
      batches.map(async (batch) => {
        const images = await db.select().from(approvalImagesTable).where(eq(approvalImagesTable.batchId, batch.id));
        const approved = images.filter((i) => i.status === "approved").length;
        const rejected = images.filter((i) => i.status === "rejected").length;
        const pending = images.filter((i) => i.status === "pending").length;
        return { ...batch, imageCount: images.length, approved, rejected, pending };
      })
    );

    res.json(batchesWithImages);
  } catch (err: any) {
    console.error("List approval batches error:", err);
    res.status(500).json({ error: err.message || "Failed to list batches" });
  }
});

router.get("/approval/batches/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const [batch] = await db.select().from(approvalBatchesTable).where(eq(approvalBatchesTable.id, id));
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    const images = await db.select().from(approvalImagesTable).where(eq(approvalImagesTable.batchId, batch.id));
    res.json({ ...batch, images });
  } catch (err: any) {
    console.error("Get approval batch error:", err);
    res.status(500).json({ error: err.message || "Failed to get batch" });
  }
});

router.delete("/approval/batches/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const [existing] = await db.select({ id: approvalBatchesTable.id }).from(approvalBatchesTable).where(eq(approvalBatchesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Batch not found" });
    await db.delete(approvalImagesTable).where(eq(approvalImagesTable.batchId, id));
    await db.delete(approvalBatchesTable).where(eq(approvalBatchesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete approval batch error:", err);
    res.status(500).json({ error: err.message || "Failed to delete batch" });
  }
});

router.get("/approval/public/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [batch] = await db.select().from(approvalBatchesTable).where(eq(approvalBatchesTable.token, token));
    if (!batch) return res.status(404).json({ error: "Approval link not found" });

    if (batch.expiresAt && new Date() > batch.expiresAt) {
      return res.status(410).json({ error: "This approval link has expired" });
    }

    const images = await db.select().from(approvalImagesTable).where(eq(approvalImagesTable.batchId, batch.id));
    res.json({ name: batch.name, clientName: batch.clientName, status: batch.status, images });
  } catch (err: any) {
    console.error("Public approval fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to load approval" });
  }
});

router.put("/approval/public/:token/images/:imageId", async (req, res) => {
  try {
    const { token, imageId } = req.params;
    const parsedImageId = parseInt(imageId);
    if (isNaN(parsedImageId)) return res.status(400).json({ error: "Invalid image ID" });

    const { status, clientNote } = req.body as { status: "approved" | "rejected"; clientNote?: string };

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    const [batch] = await db.select().from(approvalBatchesTable).where(eq(approvalBatchesTable.token, token));
    if (!batch) return res.status(404).json({ error: "Approval link not found" });

    if (batch.expiresAt && new Date() > batch.expiresAt) {
      return res.status(410).json({ error: "This approval link has expired" });
    }

    const [updated] = await db.update(approvalImagesTable)
      .set({ status, clientNote: clientNote || "", updatedAt: new Date() })
      .where(and(eq(approvalImagesTable.id, parsedImageId), eq(approvalImagesTable.batchId, batch.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Image not found" });

    const allImages = await db.select().from(approvalImagesTable).where(eq(approvalImagesTable.batchId, batch.id));
    const allReviewed = allImages.every((i) => i.status !== "pending");
    if (allReviewed) {
      await db.update(approvalBatchesTable).set({ status: "reviewed" }).where(eq(approvalBatchesTable.id, batch.id));
    }

    res.json(updated);
  } catch (err: any) {
    console.error("Update approval image error:", err);
    res.status(500).json({ error: err.message || "Failed to update image" });
  }
});

router.get("/approval/approved-images", requireAuth, async (req, res) => {
  try {
    const clientName = req.query.clientName as string || "";
    const batches = await db.select().from(approvalBatchesTable);
    const relevantBatches = clientName
      ? batches.filter((b) => b.clientName === clientName)
      : batches;

    const allApproved: { id: number; imageUrl: string; batchName: string; clientName: string }[] = [];
    for (const batch of relevantBatches) {
      const images = await db.select().from(approvalImagesTable)
        .where(and(eq(approvalImagesTable.batchId, batch.id), eq(approvalImagesTable.status, "approved")));
      for (const img of images) {
        allApproved.push({ id: img.id, imageUrl: img.imageUrl, batchName: batch.name, clientName: batch.clientName });
      }
    }

    res.json(allApproved);
  } catch (err: any) {
    console.error("List approved images error:", err);
    res.status(500).json({ error: err.message || "Failed to list approved images" });
  }
});

export default router;
