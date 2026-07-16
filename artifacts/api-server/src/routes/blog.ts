import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

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

// Admin: publish a new post.
router.post("/blog-posts", async (req, res) => {
  try {
    const { title, body, imageUrls } = req.body as { title?: string; body?: string; imageUrls?: string[] };
    if (!title?.trim() && !body?.trim() && (!imageUrls || imageUrls.length === 0)) {
      res.status(400).json({ error: "Add a title, some text, or an image first." });
      return;
    }
    const [post] = await db.insert(blogPostsTable)
      .values({ title: title || "", body: body || "", imageUrls: imageUrls || [] })
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
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete post" });
  }
});

export default router;
