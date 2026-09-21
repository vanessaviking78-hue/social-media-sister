import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Vanessa-only tool: sits on thecybersuite.com behind the same admin
// password as the rest of the ProtectedRouter, never on the client-facing
// apps.thecybersuite.com side. Nobody but Vanessa should ever hit this.
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

router.use("/competitor-scout", requireAuth);

const NORTHERN_GRIT_VOICE = "Write like a no-nonsense northern woman, direct, warm, working class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew. First person throughout, as if Vanessa is speaking straight to herself about her own client, encouraging and empowering, never talking the client down.";

const COMPLIANCE_RULES = `
COMPLIANCE (non-negotiable, every single word)
- NEVER name Botox, or any prescription-only medicine, by brand or generic drug name. Use: "anti-wrinkle injections", "facial aesthetics", "injectable treatments".
- Never use the word "safe" as a marketing claim.
- No medical claims, no guaranteed results.
- No superlatives: best, number one, guaranteed.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- Never use the word "fluff".
- No Americanised spelling anywhere. British English throughout: colour, specialise, favour, practitioner, not color, specialize, favor, provider.
- BANNED words and phrases: elevate, transform, unlock, journey, empower (as a verb), revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, boasts, nestled, seamless, effortless, next level, top-tier, not fuss not fluff, most clinics don't have a content problem they have a system problem, at the end of the day, when it comes to, look no further, say goodbye to, trust me, make no mistake.
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world".
- Say the thing plainly, the way you would actually say it to someone face to face. If a sentence could have been written by a chatbot, delete it and say it straight instead.
- Always end on a short, warm, confident line pointing at the obvious next step. Never a hard sales pitch, never generic.`;

type ScoutReportRow = {
  id: number;
  clinic_name: string;
  postcode: string;
  research_notes: string;
  report_html: string;
  status: string;
  created_at: string;
};

// GET /api/competitor-scout - library list, newest first
router.get("/competitor-scout", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, clinic_name, postcode, status, created_at
      FROM competitor_scout_reports
      ORDER BY created_at DESC
    `);
    res.json({ reports: (result as { rows?: ScoutReportRow[] }).rows ?? [] });
  } catch (err) {
    logger.error({ err }, "Failed to list competitor scout reports");
    res.status(500).json({ error: "Failed to load reports" });
  }
});

// GET /api/competitor-scout/:id - one full report
router.get("/competitor-scout/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute(sql`
      SELECT id, clinic_name, postcode, research_notes, report_html, status, created_at
      FROM competitor_scout_reports WHERE id = ${id}
    `);
    const row = (result as { rows?: ScoutReportRow[] }).rows?.[0];
    if (!row) return res.status(404).json({ error: "Report not found" });
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to fetch competitor scout report");
    res.status(500).json({ error: "Failed to load report" });
  }
});

// DELETE /api/competitor-scout/:id
router.delete("/competitor-scout/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    await db.execute(sql`DELETE FROM competitor_scout_reports WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete competitor scout report");
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// POST /api/competitor-scout/generate
// { clinicName, postcode, researchNotes }
// researchNotes is the raw digging Vanessa (or Claude alongside her) has
// already done on the top nearby competitors, since this server has no
// live web search of its own. This endpoint's job is turning that raw
// material into the finished, on-brand, compliant written report.
router.post("/competitor-scout/generate", async (req, res) => {
  try {
    const clinicName = String(req.body?.clinicName || "").trim();
    const postcode = String(req.body?.postcode || "").trim();
    const researchNotes = String(req.body?.researchNotes || "").trim();

    if (!clinicName || !postcode) {
      return res.status(400).json({ error: "Clinic name and postcode are required" });
    }
    if (!researchNotes) {
      return res.status(400).json({ error: "Paste in the competitor research notes first, this tool writes up what's already been found, it doesn't go and find it" });
    }

    const systemPrompt = `You are Vanessa, writing a private competitor analysis report for your own use about one of your social media clients.

${NORTHERN_GRIT_VOICE}

CLIENT
Clinic name: ${clinicName}
Postcode / area: ${postcode}

RAW RESEARCH NOTES (real findings on the nearby competitors, already gathered, do not invent anything beyond this)
${researchNotes}

TASK
Write the full report as clean semantic HTML (use h2, p, strong, ul/li only, no inline styles, no html/head/body wrapper, no markdown). Structure it in this order:
1. A one or two sentence warm, encouraging opening line addressed to the clinic by name.
2. "The patch" - a short paragraph on how competitive the area looks from the research notes.
3. "Who's on the same patch" - one short paragraph per competitor found in the notes (use their real names from the notes), covering what they do well and where they fall short.
4. "What you've got that they don't" - the most positive, specific section, built only from real details already known about this client from the notes plus reasonable, clearly-labelled general strengths of a warm, personal, all-under-one-roof clinic. Do not invent specific facts about the client that are not implied by the notes.
5. "Where they're pulling ahead, and it's fixable" - honest and constructive, framed as gaps to close, never a threat.
6. "Where I'd focus the socials next" - 3 to 5 specific, actionable content ideas built on the client's real strengths from the notes.
7. A short closing paragraph, warm and confident, pointing at the obvious next step of turning this into an actual content plan.
${COMPLIANCE_RULES}

Return a JSON object with exactly this shape: { "reportHtml": "..." }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Write the full competitor scout report now." },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 2600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let reportHtml = "";
    try {
      const parsed = JSON.parse(raw) as { reportHtml?: string };
      reportHtml = parsed.reportHtml || "";
    } catch {
      logger.warn({ raw, clinicName }, "competitor-scout: failed to parse AI JSON");
    }

    if (!reportHtml) {
      return res.status(502).json({ error: "The write up didn't come back properly, try generating again" });
    }

    const insertResult = await db.execute(sql`
      INSERT INTO competitor_scout_reports (clinic_name, postcode, research_notes, report_html, status)
      VALUES (${clinicName}, ${postcode}, ${researchNotes}, ${reportHtml}, 'ready')
      RETURNING id, clinic_name, postcode, research_notes, report_html, status, created_at
    `);
    const row = (insertResult as { rows?: ScoutReportRow[] }).rows?.[0];
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to generate competitor scout report");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
