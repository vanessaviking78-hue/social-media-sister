import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable, clientPresetsTable, calendarPostsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeClientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type PreviewPost = {
  id: number;
  scheduledAt: string;
  postType: string;
  thumbnailUrl: string | null;
  title: string;
  status: string;
  source: "scheduler" | "calendar";
};

router.get("/content-preview/:clientSlug", async (req, res) => {
  try {
    const { clientSlug } = req.params;

    // ── Resolve client name ───────────────────────────────────────────────
    // Primary: match a preset by slug
    const presets = await db.select().from(clientPresetsTable);
    const preset = presets.find((p) => safeClientSlug(p.name) === clientSlug);

    let clientName: string;
    let logoUrl: string | null = null;

    if (preset) {
      clientName = preset.name;
      logoUrl = preset.logoUrl ?? null;
    } else {
      // Fallback: check calendar_posts for a matching client name
      const calendarClients = await db
        .selectDistinct({ clientName: calendarPostsTable.clientName })
        .from(calendarPostsTable);
      const match = calendarClients.find(
        (c) => safeClientSlug(c.clientName) === clientSlug
      );
      if (!match) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      clientName = match.clientName;
    }

    // ── Scheduled posts (only when preset exists) ─────────────────────────
    const scheduledPosts: PreviewPost[] = [];

    if (preset) {
      const scheduledRows = await db
        .select({
          id: scheduledPostsTable.id,
          scheduledAt: scheduledPostsTable.scheduledAt,
          postType: scheduledPostsTable.postType,
          content: scheduledPostsTable.content,
          status: scheduledPostsTable.status,
        })
        .from(scheduledPostsTable)
        .where(eq(scheduledPostsTable.presetId, preset.id));

      for (const p of scheduledRows) {
        if (!["pending", "processing", "published"].includes(p.status)) continue;
        scheduledPosts.push({
          id: p.id,
          scheduledAt: (p.scheduledAt as Date).toISOString(),
          postType: p.postType,
          thumbnailUrl: (p.content as { imageUrls?: string[] })?.imageUrls?.[0] ?? null,
          title: (p.content as { title?: string })?.title ?? "",
          status: p.status,
          source: "scheduler",
        });
      }
    }

    // ── Calendar posts (matched by clientName text) ───────────────────────
    const calendarRows = await db
      .select({
        id: calendarPostsTable.id,
        date: calendarPostsTable.date,
        postType: calendarPostsTable.postType,
        title: calendarPostsTable.title,
        status: calendarPostsTable.status,
        imageUrl: calendarPostsTable.imageUrl,
      })
      .from(calendarPostsTable)
      .where(eq(calendarPostsTable.clientName, clientName));

    const calendarPosts: PreviewPost[] = calendarRows.map((p) => ({
      id: p.id + 100_000,
      scheduledAt: new Date(`${p.date}T12:00:00.000Z`).toISOString(),
      postType: p.postType,
      thumbnailUrl: p.imageUrl ?? null,
      title: p.title,
      status: p.status === "posted" ? "published" : p.status,
      source: "calendar",
    }));

    // ── Merge + sort ───────────────────────────────────────────────────────
    const all = [...scheduledPosts, ...calendarPosts].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    res.json({ clientName, logoUrl, posts: all });
  } catch (err: unknown) {
    logger.error({ err }, "content-preview fetch failed");
    res.status(500).json({ error: "Failed to load preview" });
  }
});

export default router;
