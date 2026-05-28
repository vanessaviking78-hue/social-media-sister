import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { strategyTopicsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

const STARTERS = [
  "5 things you didn't know about polynucleotides",
  "Why you should always book a consultation first",
  "The truth about lip filler longevity",
  "5 myths about tear trough I'm sick of hearing",
  "What good aftercare actually looks like",
  "The price of being uninsured",
  "Why I turn clients away",
  "5 questions to ask before booking anywhere",
  "Behind the scenes of my Tuesday",
  "The treatment I refuse to do (and why)",
  "What \"natural results\" actually means",
  "The aesthetic trends I won't be touching",
  "5 things I can't live without",
  "5 things I can do without",
  "The skincare habit you're missing",
  "Top 3 treatments for tired skin",
  "Why SPF is non-negotiable",
  "The difference between filler and bio-stimulator",
  "What to expect in your first consult",
  "Why cheap injections are expensive long-term",
];

router.get("/strategy-topics", async (req, res) => {
  try {
    const topics = await db
      .select()
      .from(strategyTopicsTable)
      .orderBy(asc(strategyTopicsTable.createdAt));
    res.json(topics);
  } catch (err: any) {
    req.log?.error({ err }, "Strategy topics fetch error");
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

router.post("/strategy-topics/seed", async (req, res) => {
  try {
    const existing = await db.select().from(strategyTopicsTable).limit(1);
    if (existing.length > 0) {
      res.json({ seeded: false, message: "Topics already exist" });
      return;
    }
    const rows = STARTERS.map((topic) => ({ topic, userId: "default" }));
    await db.insert(strategyTopicsTable).values(rows);
    const topics = await db
      .select()
      .from(strategyTopicsTable)
      .orderBy(asc(strategyTopicsTable.createdAt));
    res.json({ seeded: true, topics });
  } catch (err: any) {
    req.log?.error({ err }, "Strategy topics seed error");
    res.status(500).json({ error: "Failed to seed topics" });
  }
});

router.post("/strategy-topics", async (req, res) => {
  try {
    const { topic, userId = "default" } = req.body;
    if (!topic?.trim()) {
      res.status(400).json({ error: "topic is required" });
      return;
    }
    const [row] = await db
      .insert(strategyTopicsTable)
      .values({ topic: topic.trim(), userId })
      .returning();
    res.json(row);
  } catch (err: any) {
    req.log?.error({ err }, "Strategy topic create error");
    res.status(500).json({ error: "Failed to create topic" });
  }
});

router.put("/strategy-topics/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { topic } = req.body;
    if (!topic?.trim()) {
      res.status(400).json({ error: "topic is required" });
      return;
    }
    const [row] = await db
      .update(strategyTopicsTable)
      .set({ topic: topic.trim() })
      .where(eq(strategyTopicsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }
    res.json(row);
  } catch (err: any) {
    req.log?.error({ err }, "Strategy topic update error");
    res.status(500).json({ error: "Failed to update topic" });
  }
});

router.delete("/strategy-topics/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(strategyTopicsTable).where(eq(strategyTopicsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error({ err }, "Strategy topic delete error");
    res.status(500).json({ error: "Failed to delete topic" });
  }
});

export default router;
