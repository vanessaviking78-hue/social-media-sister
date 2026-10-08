import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable, approvalBatchesTable, approvalImagesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { notifySubmission } from "../lib/notify";

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


// A selfie a client sends is filed straight into their approved photos, so it shows up under
// "Add approved photos" next to their name. Already filed selfies are skipped.
async function fileSelfie(clientName: string, presetId: number | null, url: string): Promise<boolean> {
  if (!url || !clientName) return false;
  const name = `Selfies from ${clientName}`;
  const [existing] = await db.select().from(approvalBatchesTable)
    .where(and(eq(approvalBatchesTable.name, name), eq(approvalBatchesTable.clientName, clientName)));
  const batch = existing ?? (await db.insert(approvalBatchesTable).values({
    name, clientName, presetId: presetId || null, token: randomBytes(6).toString("hex"), expiresAt: null, status: "reviewed",
  }).returning())[0];
  const dupe = await db.select({ id: approvalImagesTable.id }).from(approvalImagesTable)
    .where(and(eq(approvalImagesTable.batchId, batch.id), eq(approvalImagesTable.imageUrl, url)));
  if (dupe.length) return false;
  await db.insert(approvalImagesTable).values({ batchId: batch.id, imageUrl: url, status: "approved", clientNote: "" });
  return true;
}

// Public: resolve the clinic for a submission link (reuses the client portal token).
router.get("/submit/:token", async (req: Request, res: Response) => {
  try {
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, req.params.token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ clientName: preset.name, logoUrl: preset.logoUrl || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load" });
  }
});

// Public: receive a before/after submission.
router.post("/submit/:token", async (req: Request, res: Response) => {
  try {
    const [preset] = await db.select().from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, req.params.token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const { beforeUrl, afterUrl, story, treatment, submitterName, notify } = req.body as {
      beforeUrl?: string; afterUrl?: string; story?: string; treatment?: string; submitterName?: string; notify?: boolean;
    };
    const kind = (treatment || "").trim().toUpperCase();
    const isSpecial = ["SELFIE", "WARDROBE", "REVIEW", "POST REQUEST", "ONBOARDING", "TOOL REQUEST"].includes(kind);
    if (!isSpecial && (!beforeUrl || !afterUrl)) {
      res.status(400).json({ error: "Both a before and an after photo are required." });
      return;
    }
    const result = await db.execute(sql`
      INSERT INTO before_after_submissions
        (preset_id, client_name, before_url, after_url, treatment, story, submitter_name, status)
      VALUES (${preset.id}, ${preset.name}, ${beforeUrl}, ${afterUrl},
              ${(treatment || "").slice(0, 200)}, ${(story || "").slice(0, 2000)},
              ${(submitterName || "").slice(0, 200)}, 'new')
      RETURNING id
    `);
    const id = (result as { rows?: { id?: number }[] }).rows?.[0]?.id ?? null;
    if (kind === "SELFIE" && beforeUrl) { void fileSelfie(preset.name, preset.id, beforeUrl).catch(() => undefined); }
    // Multi-photo sends (e.g. Wardrobe) post one row per photo; the portal
    // passes notify:false on all but the last so only one email goes out.
    if (notify !== false) {
      void notifySubmission({
        clientName: preset.name,
        kind: (treatment || "before and after").toLowerCase(),
        submitterName,
        story,
      });
    }
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save submission" });
  }
});

// Admin: list submissions for the review inbox.
router.get("/submissions", requireAuth, async (req: Request, res: Response) => {
  try {
    const clientName = (req.query.clientName as string) || "";
    const result = clientName
      ? await db.execute(sql`
          SELECT id, client_name AS "clientName", before_url AS "beforeUrl", after_url AS "afterUrl",
                 treatment, story, submitter_name AS "submitterName", status, created_at AS "createdAt"
          FROM before_after_submissions WHERE client_name = ${clientName}
          ORDER BY created_at DESC`)
      : await db.execute(sql`
          SELECT id, client_name AS "clientName", before_url AS "beforeUrl", after_url AS "afterUrl",
                 treatment, story, submitter_name AS "submitterName", status, created_at AS "createdAt"
          FROM before_after_submissions ORDER BY created_at DESC`);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: unknown[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list submissions" });
  }
});

// Admin: mark a submission complete (or reopen it).
router.patch("/submissions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    const allowed = ["new", "complete"];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: "status must be 'new' or 'complete'" });
      return;
    }
    await db.execute(sql`
      UPDATE before_after_submissions SET status = ${status} WHERE id = ${Number(req.params.id)}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update submission" });
  }
});

// Admin: file every selfie ever sent into that client's approved photos. Safe to run again, it skips ones already filed.
router.post("/submissions/backfill-selfies", requireAuth, async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(sql`
      SELECT s.client_name AS "clientName", s.before_url AS "url", p.id AS "presetId"
      FROM before_after_submissions s
      LEFT JOIN client_presets p ON p.id = s.preset_id
      WHERE upper(trim(s.treatment)) = 'SELFIE' AND s.before_url IS NOT NULL AND s.before_url <> ''
      ORDER BY s.created_at ASC`);
    const rows = ((r as unknown as { rows?: { clientName: string; url: string; presetId: number | null }[] }).rows) ?? [];
    const perClient: Record<string, { found: number; added: number }> = {};
    for (const row of rows) {
      const c = (perClient[row.clientName] ??= { found: 0, added: 0 });
      c.found++;
      if (await fileSelfie(row.clientName, row.presetId, row.url)) c.added++;
    }
    res.json({ ok: true, total: rows.length, added: Object.values(perClient).reduce((n, c) => n + c.added, 0), perClient });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Backfill failed" });
  }
});

export default router;
