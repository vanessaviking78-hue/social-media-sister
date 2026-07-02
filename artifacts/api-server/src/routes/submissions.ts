import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
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
    const { beforeUrl, afterUrl, story, treatment, submitterName } = req.body as {
      beforeUrl?: string; afterUrl?: string; story?: string; treatment?: string; submitterName?: string;
    };
    const kind = (treatment || "").trim().toUpperCase();
    const isSpecial = ["SELFIE", "REVIEW", "POST REQUEST", "ONBOARDING"].includes(kind);
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
    void notifySubmission({
      clientName: preset.name,
      kind: (treatment || "before and after").toLowerCase(),
      submitterName,
      story,
    });
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

export default router;
