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

// Public: the one question currently live on /clientquestion.
router.get("/client-question", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, question, created_at AS "createdAt"
      FROM client_questions WHERE active = TRUE
      ORDER BY created_at DESC LIMIT 1
    `);
    const row = (result as { rows?: unknown[] }).rows?.[0] ?? null;
    res.set("Cache-Control", "no-store");
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load the question" });
  }
});

// Public: a client answering the live question.
router.post("/client-question/answer", async (req: Request, res: Response) => {
  try {
    const { questionId, answer, name } = req.body as { questionId?: number; answer?: string; name?: string };
    if (!questionId || !Number.isFinite(Number(questionId))) {
      res.status(400).json({ error: "Missing question." });
      return;
    }
    const trimmed = (answer || "").trim();
    if (!trimmed) {
      res.status(400).json({ error: "Please type an answer before sending." });
      return;
    }
    const [question] = (await db.execute(sql`
      SELECT id FROM client_questions WHERE id = ${Number(questionId)}
    `) as { rows?: { id: number }[] }).rows ?? [];
    if (!question) {
      res.status(404).json({ error: "That question is no longer live." });
      return;
    }
    await db.execute(sql`
      INSERT INTO client_question_answers (question_id, answer, respondent_name)
      VALUES (${Number(questionId)}, ${trimmed.slice(0, 4000)}, ${(name || "").trim().slice(0, 200)})
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save the answer" });
  }
});

// Admin: every question asked, newest first, each with its answers attached.
router.get("/client-questions", requireAuth, async (_req: Request, res: Response) => {
  try {
    const questions = (await db.execute(sql`
      SELECT id, question, active, created_at AS "createdAt"
      FROM client_questions ORDER BY created_at DESC
    `) as { rows?: any[] }).rows ?? [];
    const answers = (await db.execute(sql`
      SELECT id, question_id AS "questionId", answer, respondent_name AS "respondentName", created_at AS "createdAt"
      FROM client_question_answers ORDER BY created_at ASC
    `) as { rows?: any[] }).rows ?? [];
    const withAnswers = questions.map((q) => ({
      ...q,
      answers: answers.filter((a) => a.questionId === q.id),
    }));
    res.set("Cache-Control", "no-store");
    res.json(withAnswers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list questions" });
  }
});

// Admin: ask a new question. It becomes the one live on /clientquestion;
// the previous question stays on record but stops accepting new answers
// on the public page (its answers are untouched).
router.post("/client-questions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { question } = req.body as { question?: string };
    const trimmed = (question || "").trim();
    if (!trimmed) {
      res.status(400).json({ error: "Type a question first." });
      return;
    }
    await db.execute(sql`UPDATE client_questions SET active = FALSE WHERE active = TRUE`);
    const result = await db.execute(sql`
      INSERT INTO client_questions (question, active)
      VALUES (${trimmed.slice(0, 500)}, TRUE)
      RETURNING id, question, active, created_at AS "createdAt"
    `);
    const row = (result as { rows?: unknown[] }).rows?.[0] ?? null;
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save the question" });
  }
});

export default router;
