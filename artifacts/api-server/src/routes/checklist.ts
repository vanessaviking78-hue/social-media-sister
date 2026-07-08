import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

const BOOL_FIELDS: Record<string, string> = {
  hexColours: "hex_colours",
  images: "images",
  bulkCarousels: "bulk_carousels",
  seamlessCarousels: "seamless_carousels",
  quotes: "quotes",
  beforeAfters: "before_afters",
  footnoteLogo: "footnote_logo",
  connectedAccounts: "connected_accounts",
};

// Admin: list every client with their checklist state (defaults to all-false if never touched).
router.get("/checklist", requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        cp.id AS "presetId",
        cp.name AS "clientName",
        COALESCE(cc.hex_colours, false) AS "hexColours",
        COALESCE(cc.images, false) AS "images",
        COALESCE(cc.bulk_carousels, false) AS "bulkCarousels",
        COALESCE(cc.seamless_carousels, false) AS "seamlessCarousels",
        COALESCE(cc.quotes, false) AS "quotes",
        COALESCE(cc.before_afters, false) AS "beforeAfters",
        COALESCE(cc.footnote_logo, false) AS "footnoteLogo",
        COALESCE(cc.connected_accounts, false) AS "connectedAccounts",
        COALESCE(cc.notes, '') AS "notes"
      FROM client_presets cp
      LEFT JOIN client_checklist cc ON cc.preset_id = cp.id
      ORDER BY cp.name ASC
    `);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: unknown[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load checklist" });
  }
});

// Admin: toggle a single checklist field, or update notes, for one client.
router.patch("/checklist/:presetId", requireAuth, async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.params.presetId);
    if (isNaN(presetId)) { res.status(400).json({ error: "Invalid client id" }); return; }
    const { field, value } = req.body as { field?: string; value?: unknown };

    if (field === "notes") {
      const notes = String(value ?? "").slice(0, 2000);
      await db.execute(sql`
        INSERT INTO client_checklist (preset_id, notes) VALUES (${presetId}, ${notes})
        ON CONFLICT (preset_id) DO UPDATE SET notes = ${notes}, updated_at = NOW()
      `);
      res.json({ ok: true });
      return;
    }

    const column = field ? BOOL_FIELDS[field] : undefined;
    if (!column) { res.status(400).json({ error: "Unknown checklist field" }); return; }
    const boolValue = value === true;

    switch (column) {
      case "hex_colours":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, hex_colours) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET hex_colours = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "images":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, images) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET images = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "bulk_carousels":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, bulk_carousels) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET bulk_carousels = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "seamless_carousels":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, seamless_carousels) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET seamless_carousels = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "quotes":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, quotes) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET quotes = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "before_afters":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, before_afters) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET before_afters = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "footnote_logo":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, footnote_logo) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET footnote_logo = ${boolValue}, updated_at = NOW()
        `);
        break;
      case "connected_accounts":
        await db.execute(sql`
          INSERT INTO client_checklist (preset_id, connected_accounts) VALUES (${presetId}, ${boolValue})
          ON CONFLICT (preset_id) DO UPDATE SET connected_accounts = ${boolValue}, updated_at = NOW()
        `);
        break;
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update checklist" });
  }
});

export default router;
