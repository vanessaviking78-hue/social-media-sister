import { Router } from "express";
import { db } from "@workspace/db";
import { dmAutomationsTable, dmInteractionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const createSchema = z.object({
  presetId: z.number().int().positive(),
  keyword: z.string().min(1).max(200),
  replyTemplate: z.string().min(1).max(1000),
  isActive: z.boolean().optional().default(true),
  matchExact: z.boolean().optional().default(false),
  caseSensitive: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  keyword: z.string().min(1).max(200).optional(),
  replyTemplate: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
  matchExact: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
});

router.get("/dm-automations", async (req, res) => {
  const presetId = req.query.presetId ? parseInt(req.query.presetId as string, 10) : undefined;
  if (!presetId || isNaN(presetId)) {
    res.status(400).json({ error: "presetId query param required" });
    return;
  }
  const rows = await db
    .select()
    .from(dmAutomationsTable)
    .where(eq(dmAutomationsTable.presetId, presetId))
    .orderBy(desc(dmAutomationsTable.createdAt));
  res.json(rows);
});

router.get("/dm-automations/:id/interactions", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db
    .select()
    .from(dmInteractionsTable)
    .where(eq(dmInteractionsTable.automationId, id))
    .orderBy(desc(dmInteractionsTable.receivedAt))
    .limit(50);
  res.json(rows);
});

router.post("/dm-automations", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [row] = await db.insert(dmAutomationsTable).values(parsed.data).returning();
  req.log.info({ id: row.id }, "DM automation created");
  res.status(201).json(row);
});

router.put("/dm-automations/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const [row] = await db
    .update(dmAutomationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(dmAutomationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/dm-automations/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(dmAutomationsTable).where(eq(dmAutomationsTable.id, id));
  req.log.info({ id }, "DM automation deleted");
  res.status(204).send();
});

export default router;
