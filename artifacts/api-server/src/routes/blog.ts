import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { blogPostsTable, blogCommentsTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

// Public and admin: every blog post, newest first.
router.get("/blog-posts", async (_req, res) => {
  try {
    const posts = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.createdAt));
    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load blog posts" });
  }
});

// Public: a single post, for the shareable link (thecybersuite.com/rant/:id).
router.get("/blog-posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    if (!post) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load post" });
  }
});

// Public: every comment left under a post, oldest first, for the portal
// rants tab and the public shareable page to both display.
router.get("/blog-posts/:id/comments", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const comments = await db.select().from(blogCommentsTable)
      .where(eq(blogCommentsTable.blogPostId, id))
      .orderBy(asc(blogCommentsTable.createdAt));
    res.json({ comments });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load comments" });
  }
});

// Admin: publish a new post.
router.post("/blog-posts", async (req, res) => {
  try {
    const { title, body, imageUrls, videoUrl } = req.body as { title?: string; body?: string; imageUrls?: string[]; videoUrl?: string };
    if (!title?.trim() && !body?.trim() && (!imageUrls || imageUrls.length === 0) && !videoUrl?.trim()) {
      res.status(400).json({ error: "Add a title, some text, an image or a video first." });
      return;
    }
    const [post] = await db.insert(blogPostsTable)
      .values({ title: title || "", body: body || "", imageUrls: imageUrls || [], videoUrl: videoUrl || null })
      .returning();
    res.status(201).json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to publish post" });
  }
});

// Admin: remove a post.
router.delete("/blog-posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
    await db.delete(blogCommentsTable).where(eq(blogCommentsTable.blogPostId, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete post" });
  }
});

export default router;
