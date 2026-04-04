import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { calendarPostsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/calendar", async (req, res) => {
  try {
    const { from, to, client } = req.query;

    const conditions = [];
    if (from && typeof from === "string") {
      conditions.push(gte(calendarPostsTable.date, from));
    }
    if (to && typeof to === "string") {
      conditions.push(lte(calendarPostsTable.date, to));
    }
    if (client && typeof client === "string" && client.trim()) {
      conditions.push(eq(calendarPostsTable.clientName, client.trim()));
    }

    let query = db.select().from(calendarPostsTable).$dynamic();
    if (conditions.length === 1) {
      query = query.where(conditions[0]);
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const posts = await query.orderBy(calendarPostsTable.date, desc(calendarPostsTable.createdAt));
    res.json({ posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list calendar posts";
    console.error("List calendar posts error:", err);
    res.status(500).json({ error: message });
  }
});

router.post("/calendar", async (req, res) => {
  try {
    const { date, clientName, postType, title, caption, notes, status, color, imageUrl } = req.body;
    if (!date?.trim()) { res.status(400).json({ error: "Date is required" }); return; }
    const [post] = await db.insert(calendarPostsTable).values({
      date: date.trim(),
      clientName: clientName?.trim() || "",
      postType: postType?.trim() || "carousel",
      title: title?.trim() || "",
      caption: caption?.trim() || "",
      notes: notes?.trim() || "",
      status: status?.trim() || "draft",
      color: color?.trim() || "#ec4899",
      imageUrl: imageUrl?.trim() || null,
    }).returning();
    res.json({ post });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create calendar post";
    console.error("Create calendar post error:", err);
    res.status(500).json({ error: message });
  }
});

router.put("/calendar/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { date, clientName, postType, title, caption, notes, status, color, imageUrl } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (date !== undefined) updates.date = typeof date === "string" ? date.trim() : date;
    if (clientName !== undefined) updates.clientName = typeof clientName === "string" ? clientName.trim() : clientName;
    if (postType !== undefined) updates.postType = typeof postType === "string" ? postType.trim() : postType;
    if (title !== undefined) updates.title = typeof title === "string" ? title.trim() : title;
    if (caption !== undefined) updates.caption = typeof caption === "string" ? caption.trim() : caption;
    if (notes !== undefined) updates.notes = typeof notes === "string" ? notes.trim() : notes;
    if (status !== undefined) updates.status = typeof status === "string" ? status.trim() : status;
    if (color !== undefined) updates.color = typeof color === "string" ? color.trim() : color;
    if (imageUrl !== undefined) updates.imageUrl = typeof imageUrl === "string" ? imageUrl.trim() || null : null;
    const [updated] = await db.update(calendarPostsTable).set(updates).where(eq(calendarPostsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ post: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update calendar post";
    console.error("Update calendar post error:", err);
    res.status(500).json({ error: message });
  }
});

router.delete("/calendar/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db.delete(calendarPostsTable).where(eq(calendarPostsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete calendar post";
    console.error("Delete calendar post error:", err);
    res.status(500).json({ error: message });
  }
});

export default router;
