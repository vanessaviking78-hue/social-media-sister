import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

type ClientNewsRow = {
  id: number;
  preset_id: number;
  client_name: string;
  title: string;
  body: string;
  created_at: string;
};

// GET /client-news?presetId=123
router.get("/client-news", async (req, res) => {
  try {
    const presetId = Number(req.query.presetId);
    if (!presetId) {
      return res.status(400).json({ error: "presetId is required" });
    }
    const result = await db.execute(sql`
      SELECT id, preset_id, client_name, title, body, created_at
      FROM client_news
      WHERE preset_id = ${presetId}
      ORDER BY created_at DESC
    `);
    const rows = (result as { rows?: ClientNewsRow[] }).rows ?? [];
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch client news");
    res.status(500).json({ error: "Failed to fetch client news" });
  }
});

// POST /client-news { presetId, clientName, title, body }
router.post("/client-news", async (req, res) => {
  try {
    const { presetId, clientName, title, body } = req.body ?? {};
    if (!presetId || !title) {
      return res.status(400).json({ error: "presetId and title are required" });
    }
    const result = await db.execute(sql`
      INSERT INTO client_news (preset_id, client_name, title, body)
      VALUES (${presetId}, ${clientName ?? ""}, ${title}, ${body ?? ""})
      RETURNING id, preset_id, client_name, title, body, created_at
    `);
    const row = (result as { rows?: ClientNewsRow[] }).rows?.[0];
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to create client news item");
    res.status(500).json({ error: "Failed to create client news item" });
  }
});

// DELETE /client-news/:id
router.delete("/client-news/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid id" });
    }
    await db.execute(sql`DELETE FROM client_news WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete client news item");
    res.status(500).json({ error: "Failed to delete client news item" });
  }
});

// Helper used by content-preview.ts to fetch news for a resolved client name.
export async function getNewsForClient(clientName: string): Promise<ClientNewsRow[]> {
  try {
    const result = await db.execute(sql`
      SELECT id, preset_id, client_name, title, body, created_at
      FROM client_news
      WHERE client_name = ${clientName}
      ORDER BY created_at DESC
    `);
    return (result as { rows?: ClientNewsRow[] }).rows ?? [];
  } catch (err) {
    logger.error({ err, clientName }, "Failed to fetch news for client");
    return [];
  }
}

export default router;
