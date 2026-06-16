import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  approvalBundlesTable,
  approvalBundleItemsTable,
  approvalResponsesTable,
  contentLibraryTable,
  clientPresetsTable,
  scheduledPostsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function computeStatus(
  itemCount: number,
  responses: { status: string; submittedAt: Date | null }[]
): "pending" | "partial" | "completed" {
  const responded = responses.filter((r) => r.submittedAt !== null && r.status !== "pending");
  if (responded.length === 0) return "pending";
  if (responded.length < itemCount) return "partial";
  return "completed";
}

// ── Public routes first (must come before /:id) ──────────────────────────────

router.get("/approval-bundles/public/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [bundle] = await db.select().from(approvalBundlesTable)
      .where(eq(approvalBundlesTable.token, token));
    if (!bundle) { res.status(404).json({ error: "Approval link not found" }); return; }

    const expired = bundle.expiresAt < new Date();

    const bundleItems = await db.select().from(approvalBundleItemsTable)
      .where(eq(approvalBundleItemsTable.bundleId, bundle.id))
      .orderBy(approvalBundleItemsTable.position);

    const libIds = bundleItems.map((bi) => bi.libraryItemId);
    const libraryItems = libIds.length > 0
      ? await db.select().from(contentLibraryTable).where(inArray(contentLibraryTable.id, libIds))
      : [];

    const responses = await db.select().from(approvalResponsesTable)
      .where(eq(approvalResponsesTable.bundleId, bundle.id));

    res.json({ bundle: { ...bundle, expired }, items: bundleItems, libraryItems, responses });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles public get failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/approval-bundles/public/:token/respond", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { responses: raw, bundleRating, overallComments } = req.body as {
      responses: Array<{ libraryItemId: number; status: "approved" | "rejected"; feedback?: string }>;
      bundleRating?: number;
      overallComments?: string;
    };

    const [bundle] = await db.select().from(approvalBundlesTable)
      .where(eq(approvalBundlesTable.token, token));
    if (!bundle) { res.status(404).json({ error: "Approval link not found" }); return; }
    if (bundle.expiresAt < new Date()) { res.status(410).json({ error: "This approval link has expired" }); return; }
    if (!Array.isArray(raw) || raw.length === 0) { res.status(400).json({ error: "responses array required" }); return; }

    const now = new Date();

    for (const r of raw) {
      const [existing] = await db.select().from(approvalResponsesTable)
        .where(and(
          eq(approvalResponsesTable.bundleId, bundle.id),
          eq(approvalResponsesTable.libraryItemId, r.libraryItemId),
        )).limit(1);

      if (existing) {
        await db.update(approvalResponsesTable).set({
          status: r.status,
          feedback: r.feedback ?? "",
          bundleRating: bundleRating ?? null,
          overallComments: overallComments ?? "",
          submittedAt: now,
          updatedAt: now,
        }).where(eq(approvalResponsesTable.id, existing.id));
      } else {
        await db.insert(approvalResponsesTable).values({
          bundleId: bundle.id,
          libraryItemId: r.libraryItemId,
          status: r.status,
          feedback: r.feedback ?? "",
          bundleRating: bundleRating ?? null,
          overallComments: overallComments ?? "",
          submittedAt: now,
          updatedAt: now,
        });
      }
    }

    const allItems = await db.select().from(approvalBundleItemsTable)
      .where(eq(approvalBundleItemsTable.bundleId, bundle.id));
    const allResponses = await db.select().from(approvalResponsesTable)
      .where(eq(approvalResponsesTable.bundleId, bundle.id));
    const newStatus = computeStatus(allItems.length, allResponses);

    await db.update(approvalBundlesTable).set({ status: newStatus })
      .where(eq(approvalBundlesTable.id, bundle.id));

    res.json({ success: true, status: newStatus });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles respond failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ── Internal (Vanessa-side) routes ────────────────────────────────────────────

router.get("/approval-bundles", async (req: Request, res: Response) => {
  try {
    const bundles = await db.select().from(approvalBundlesTable)
      .orderBy(approvalBundlesTable.createdAt);

    const now = new Date();
    const withCounts = await Promise.all(bundles.map(async (b) => {
      const items = await db.select().from(approvalBundleItemsTable)
        .where(eq(approvalBundleItemsTable.bundleId, b.id));
      const responses = await db.select().from(approvalResponsesTable)
        .where(eq(approvalResponsesTable.bundleId, b.id));
      const status = b.expiresAt < now ? "expired" : b.status;
      const approved = responses.filter((r) => r.status === "approved").length;
      const rejected = responses.filter((r) => r.status === "rejected").length;
      return { ...b, status, itemCount: items.length, approved, rejected };
    }));

    res.json({ bundles: withCounts });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles list failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/approval-bundles", async (req: Request, res: Response) => {
  try {
    const { bundleName, clientName, clientEmail, libraryItemIds } = req.body as {
      bundleName: string;
      clientName: string;
      clientEmail: string;
      libraryItemIds: number[];
    };

    if (!bundleName?.trim()) { res.status(400).json({ error: "bundleName required" }); return; }
    if (!Array.isArray(libraryItemIds) || libraryItemIds.length === 0) {
      res.status(400).json({ error: "At least one item is required" }); return;
    }
    if (libraryItemIds.length > 50) { res.status(400).json({ error: "Maximum 50 items per bundle" }); return; }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [bundle] = await db.insert(approvalBundlesTable).values({
      bundleName: bundleName.trim(),
      clientName: clientName?.trim() ?? "",
      clientEmail: clientEmail?.trim() ?? "",
      token,
      status: "pending",
      expiresAt,
    }).returning();

    await db.insert(approvalBundleItemsTable).values(
      libraryItemIds.map((id, idx) => ({ bundleId: bundle.id, libraryItemId: id, position: idx }))
    );

    req.log.info({ bundleId: bundle.id, itemCount: libraryItemIds.length }, "approval bundle created");
    res.status(201).json({ bundle, token });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles create failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

// ── from-images: create library items + bundle in one shot ───────────────────

router.post("/approval-bundles/from-images", async (req: Request, res: Response) => {
  try {
    const { bundleName, clientName, clientEmail, carousels } = req.body as {
      bundleName: string;
      clientName?: string;
      clientEmail?: string;
      carousels: Array<{ imageUrls: string[]; caption: string }>;
    };

    if (!bundleName?.trim()) { res.status(400).json({ error: "bundleName required" }); return; }
    if (!Array.isArray(carousels) || carousels.length === 0) {
      res.status(400).json({ error: "At least one carousel is required" }); return;
    }
    if (carousels.length > 50) { res.status(400).json({ error: "Maximum 50 carousels per bundle" }); return; }

    const libraryItems = await db.insert(contentLibraryTable).values(
      carousels.map((c) => ({
        clientName: clientName?.trim() ?? "",
        postType: c.imageUrls.length === 1 ? "single" : "carousel",
        caption: c.caption ?? "",
        mediaUrl: c.imageUrls.length === 1 ? (c.imageUrls[0] ?? null) : null,
        mediaUrls: c.imageUrls.length > 1 ? c.imageUrls : null,
        thumbnailUrl: c.imageUrls[0] ?? null,
      }))
    ).returning();

    const token = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [bundle] = await db.insert(approvalBundlesTable).values({
      bundleName: bundleName.trim(),
      clientName: clientName?.trim() ?? "",
      clientEmail: clientEmail?.trim() ?? "",
      token,
      status: "pending",
      expiresAt,
    }).returning();

    await db.insert(approvalBundleItemsTable).values(
      libraryItems.map((item, idx) => ({ bundleId: bundle.id, libraryItemId: item.id, position: idx }))
    );

    req.log.info({ bundleId: bundle.id, itemCount: libraryItems.length }, "approval bundle created from images");
    res.status(201).json({ bundle, token });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles from-images failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/approval-bundles/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [bundle] = await db.select().from(approvalBundlesTable)
      .where(eq(approvalBundlesTable.id, id));
    if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }

    const bundleItems = await db.select().from(approvalBundleItemsTable)
      .where(eq(approvalBundleItemsTable.bundleId, id))
      .orderBy(approvalBundleItemsTable.position);

    const libIds = bundleItems.map((bi) => bi.libraryItemId);
    const libraryItems = libIds.length > 0
      ? await db.select().from(contentLibraryTable).where(inArray(contentLibraryTable.id, libIds))
      : [];

    const responses = await db.select().from(approvalResponsesTable)
      .where(eq(approvalResponsesTable.bundleId, id));

    const status = bundle.expiresAt < new Date() ? "expired" : bundle.status;
    res.json({ bundle: { ...bundle, status }, items: bundleItems, libraryItems, responses });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles detail failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/approval-bundles/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(approvalBundlesTable).where(eq(approvalBundlesTable.id, id));
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles delete failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/approval-bundles/:id/queue-approved", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [bundle] = await db.select().from(approvalBundlesTable)
      .where(eq(approvalBundlesTable.id, id));
    if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }

    const approvedResponses = await db.select().from(approvalResponsesTable)
      .where(and(
        eq(approvalResponsesTable.bundleId, id),
        eq(approvalResponsesTable.status, "approved"),
      ));

    if (approvedResponses.length === 0) {
      res.json({ queued: 0, message: "No approved items to queue" }); return;
    }

    const libIds = approvedResponses.map((r) => r.libraryItemId);
    const libraryItems = await db.select().from(contentLibraryTable)
      .where(inArray(contentLibraryTable.id, libIds));

    const presets = bundle.clientName
      ? await db.select().from(clientPresetsTable)
          .where(eq(clientPresetsTable.name, bundle.clientName))
          .limit(1)
      : [];

    if (presets.length === 0) {
      res.json({
        queued: 0,
        message: `No client preset found for "${bundle.clientName}". Create a preset for this client first, then queue again.`,
      });
      return;
    }

    const preset = presets[0];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 7);
    baseDate.setHours(9, 0, 0, 0);

    const toInsert = libraryItems.map((item, i) => {
      const scheduledAt = new Date(baseDate);
      scheduledAt.setDate(scheduledAt.getDate() + i);
      return {
        presetId: preset.id,
        clientName: bundle.clientName,
        postType: "carousel" as const,
        content: {
          imageUrls: item.mediaUrls ?? (item.mediaUrl ? [item.mediaUrl] : []),
          caption: item.caption ?? "",
          title: (item.caption ?? "Approved post").slice(0, 80),
        },
        scheduledAt,
        notes: `From approval bundle: ${bundle.bundleName}`,
      };
    });

    if (toInsert.length > 0) {
      await db.insert(scheduledPostsTable).values(toInsert);
      await db.update(approvalBundlesTable).set({ queuedAt: new Date() })
        .where(eq(approvalBundlesTable.id, id));
    }

    logger.info({ bundleId: id, queued: toInsert.length }, "approval bundle items queued to scheduler");
    res.json({ queued: toInsert.length });
  } catch (err: unknown) {
    req.log.error({ err }, "approval-bundles queue-approved failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
