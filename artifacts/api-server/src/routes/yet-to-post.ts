import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  clientPresetsTable,
  scheduledPostsTable,
  YET_TO_POST_DAYS,
  YET_TO_POST_KINDS,
  YET_TO_POST_FORMATS,
  type YetToPostMeta,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

// Yet to post: a client by client dashboard for finished content that is waiting
// for Vanessa to finalise and schedule. It sits on top of the scheduler's draft
// rows (the same waiting room the Client Bank uses), tagged with where each piece
// belongs in a bundle. Nothing here ever schedules or posts anything.

const router: IRouter = Router();

type Row = typeof scheduledPostsTable.$inferSelect;

function metaOf(row: Row): YetToPostMeta | null {
  const m = (row.content as { yetToPost?: YetToPostMeta } | null)?.yetToPost;
  return m && typeof m === "object" ? m : null;
}

async function waitingRows(presetId?: number): Promise<Row[]> {
  const rows = await db
    .select()
    .from(scheduledPostsTable)
    .where(
      presetId
        ? and(eq(scheduledPostsTable.status, "draft"), eq(scheduledPostsTable.presetId, presetId))
        : eq(scheduledPostsTable.status, "draft"),
    );
  return rows.filter((r) => metaOf(r) !== null);
}

function postTypeFor(format: string, kind: string): string {
  if (format === "story") return "story";
  if (format === "reel") return "reel";
  return kind === "tweet" ? "single-image" : "carousel";
}

// Every client with something waiting, with simple counts for the dashboard tiles.
router.get("/yet-to-post", async (_req, res) => {
  try {
    const rows = await waitingRows();
    const byClient = new Map<number, { presetId: number; clientName: string; posts: number; stories: number; reels: number; approved: number; total: number; updatedAt: string }>();
    for (const row of rows) {
      const m = metaOf(row)!;
      let c = byClient.get(row.presetId);
      if (!c) {
        c = { presetId: row.presetId, clientName: row.clientName, posts: 0, stories: 0, reels: 0, approved: 0, total: 0, updatedAt: "" };
        byClient.set(row.presetId, c);
      }
      if (m.format === "post") c.posts++;
      else if (m.format === "story") c.stories++;
      else if (m.format === "reel") c.reels++;
      c.total++;
      if (m.approved) c.approved++;
      const stamp = new Date(row.updatedAt as unknown as string).toISOString();
      if (stamp > c.updatedAt) c.updatedAt = stamp;
    }
    const clients = [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
    res.set("Cache-Control", "no-store");
    res.json({ clients });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not load Yet to post" });
  }
});

// Everything waiting for one client.
router.get("/yet-to-post/:presetId", async (req, res) => {
  try {
    const presetId = Number(req.params.presetId);
    if (!Number.isFinite(presetId)) { res.status(400).json({ error: "Bad client" }); return; }
    const rows = await waitingRows(presetId);
    const items = rows
      .map((r) => ({ id: r.id, postType: r.postType, content: r.content, meta: metaOf(r)! }))
      .sort((a, b) => a.meta.week - b.meta.week
        || YET_TO_POST_DAYS.indexOf(a.meta.day) - YET_TO_POST_DAYS.indexOf(b.meta.day)
        || YET_TO_POST_FORMATS.indexOf(a.meta.format) - YET_TO_POST_FORMATS.indexOf(b.meta.format));
    res.set("Cache-Control", "no-store");
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not load this client" });
  }
});

type ParkItem = {
  week: number;
  day: string;
  kind: string;
  format?: string;
  title?: string;
  caption?: string;
  imageUrls?: string[];
  videoUrl?: string;
  question?: string;
  firstComment?: string;
  sourceTool?: string;
};

// Park a batch of finished pieces against a client. Used by the content skills when a
// bundle is done. Refuses to double up on a bundle that is already waiting unless
// replace is true.
router.post("/yet-to-post/park", async (req, res) => {
  try {
    const { presetId, bundle = "mix", replace = false, items } = req.body as {
      presetId?: number;
      bundle?: string;
      replace?: boolean;
      items?: ParkItem[];
    };
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "items required" }); return; }

    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) { res.status(404).json({ error: "Client not found" }); return; }

    for (const it of items) {
      const format = it.format ?? "post";
      if (!Number.isInteger(it.week) || it.week < 1 || it.week > 4) { res.status(400).json({ error: "week must be 1 to 4" }); return; }
      if (!(YET_TO_POST_DAYS as readonly string[]).includes(it.day)) { res.status(400).json({ error: "day must be Mon, Wed, Fri or Sun" }); return; }
      if (!(YET_TO_POST_KINDS as readonly string[]).includes(it.kind)) { res.status(400).json({ error: `kind must be one of ${YET_TO_POST_KINDS.join(", ")}` }); return; }
      if (!(YET_TO_POST_FORMATS as readonly string[]).includes(format)) { res.status(400).json({ error: "format must be post, story or reel" }); return; }
    }

    const existing = (await waitingRows(presetId)).filter((r) => metaOf(r)!.bundle === bundle);
    if (existing.length > 0 && !replace) {
      res.status(409).json({ error: `${preset.name} already has a ${bundle} bundle waiting. Send replace: true to swap it for this one.` });
      return;
    }
    if (existing.length > 0) {
      for (const r of existing) await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, r.id));
    }

    let saved = 0;
    for (const it of items) {
      const format = (it.format ?? "post") as YetToPostMeta["format"];
      const meta: YetToPostMeta = {
        bundle,
        week: it.week,
        day: it.day as YetToPostMeta["day"],
        kind: it.kind as YetToPostMeta["kind"],
        format,
        slotKey: `w${it.week}-${it.day}`,
        approved: false,
      };
      await db.insert(scheduledPostsTable).values({
        presetId,
        clientName: preset.name,
        postType: postTypeFor(format, it.kind),
        content: {
          caption: it.caption ?? "",
          title: it.title ?? "",
          ...(it.imageUrls ? { imageUrls: it.imageUrls } : {}),
          ...(it.videoUrl ? { videoUrl: it.videoUrl } : {}),
          ...(it.question ? { question: it.question } : {}),
          ...(it.firstComment ? { firstComment: it.firstComment } : {}),
          sourceTool: it.sourceTool ?? "Yet to post",
          yetToPost: meta,
        },
        scheduledAt: new Date(),
        status: "draft",
        notes: "",
      });
      saved++;
    }
    res.status(201).json({ saved, replaced: existing.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not park the content" });
  }
});

// Edit a waiting piece: its words, its story question, or tick it as approved.
router.patch("/yet-to-post/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { approved, caption, question } = req.body as { approved?: boolean; caption?: string; question?: string };
    const [row] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    const meta = row ? metaOf(row) : null;
    if (!row || row.status !== "draft" || !meta) { res.status(404).json({ error: "Not waiting in Yet to post" }); return; }

    const content = { ...(row.content as Record<string, unknown>) };
    if (typeof caption === "string") content.caption = caption;
    if (typeof question === "string") content.question = question;
    if (typeof approved === "boolean") content.yetToPost = { ...meta, approved };

    const [updated] = await db
      .update(scheduledPostsTable)
      .set({ content: content as Row["content"], updatedAt: new Date() })
      .where(eq(scheduledPostsTable.id, id))
      .returning();
    res.json({ id: updated.id, content: updated.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not save" });
  }
});

// Take a waiting piece out, either because it was scheduled or because she does not want it.
router.delete("/yet-to-post/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    if (!row || row.status !== "draft" || !metaOf(row)) { res.status(404).json({ error: "Not waiting in Yet to post" }); return; }
    await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not remove" });
  }
});

export default router;
