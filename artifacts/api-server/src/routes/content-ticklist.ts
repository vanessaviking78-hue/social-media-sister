import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { contentTicklistsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Generic public shared-tick store for simple content ticklist pages
// (e.g. /madamewaxticklist). No auth: these pages hold nothing sensitive,
// just which post ideas have been written, and clients tick them without
// logging in.

router.get("/content-ticklist/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(contentTicklistsTable)
      .where(eq(contentTicklistsTable.id, id));
    res.set("Cache-Control", "no-store");
    res.json({ state: row?.state ?? {} });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load ticklist" });
  }
});

router.patch("/content-ticklist/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { key, keys, value } = req.body as { key?: string; keys?: string[]; value?: boolean };
    // One key, or a list of keys to set together (the hook grid crosses out several hooks at once).
    const list = Array.isArray(keys) ? keys.filter((k) => typeof k === "string" && k) : key ? [key] : [];
    if (!list.length) {
      res.status(400).json({ error: "key required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(contentTicklistsTable)
      .where(eq(contentTicklistsTable.id, id));

    const nextState: Record<string, boolean> = {
      ...((existing?.state as Record<string, boolean>) ?? {}),
    };
    for (const k of list) {
      if (value) nextState[k] = true;
      else delete nextState[k];
    }

    if (existing) {
      await db
        .update(contentTicklistsTable)
        .set({ state: nextState, updatedAt: new Date() })
        .where(eq(contentTicklistsTable.id, id));
    } else {
      await db.insert(contentTicklistsTable).values({ id, state: nextState });
    }

    res.json({ ok: true, state: nextState });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update ticklist" });
  }
});

export default router;
