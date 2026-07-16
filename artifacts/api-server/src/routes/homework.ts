import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { homeworkQuestionSetsTable, homeworkRepliesTable, clientPresetsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// Admin: the currently active weekly question set (3 questions).
router.get("/homework/current", async (_req, res) => {
  try {
    const [set] = await db.select().from(homeworkQuestionSetsTable)
      .where(eq(homeworkQuestionSetsTable.status, "active"))
      .orderBy(desc(homeworkQuestionSetsTable.createdAt))
      .limit(1);
    res.json({ set: set || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load current homework" });
  }
});

// Admin: publish a new weekly set of 3 questions, closing off the previous one.
router.post("/homework/questions", async (req, res) => {
  try {
    const { question1, question2, question3, weekLabel } = req.body as {
      question1?: string; question2?: string; question3?: string; weekLabel?: string;
    };
    if (!question1?.trim() || !question2?.trim() || !question3?.trim()) {
      res.status(400).json({ error: "All three questions are required" });
      return;
    }
    await db.update(homeworkQuestionSetsTable)
      .set({ status: "closed" })
      .where(eq(homeworkQuestionSetsTable.status, "active"));
    const [set] = await db.insert(homeworkQuestionSetsTable)
      .values({
        question1: question1.trim(),
        question2: question2.trim(),
        question3: question3.trim(),
        weekLabel: weekLabel || new Date().toISOString().slice(0, 10),
        status: "active",
      })
      .returning();
    res.status(201).json({ set });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to publish homework questions" });
  }
});

// Admin: every reply ever submitted, newest first, with the question set and client name attached.
router.get("/homework/replies", async (_req, res) => {
  try {
    const replies = await db.select().from(homeworkRepliesTable)
      .orderBy(desc(homeworkRepliesTable.submittedAt));
    const setIds = [...new Set(replies.map((r) => r.setId))];
    const sets = setIds.length
      ? await db.select().from(homeworkQuestionSetsTable)
      : [];
    const setById = new Map(sets.map((s) => [s.id, s]));
    const enriched = replies.map((r) => ({
      ...r,
      set: setById.get(r.setId) || null,
    }));
    res.json({ replies: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load homework replies" });
  }
});

// Admin: all weekly sets, newest first, for a history view.
router.get("/homework/questions", async (_req, res) => {
  try {
    const sets = await db.select().from(homeworkQuestionSetsTable)
      .orderBy(desc(homeworkQuestionSetsTable.createdAt));
    res.json({ sets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load homework history" });
  }
});

export default router;
