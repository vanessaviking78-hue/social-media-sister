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

const NORTHERN_GRIT_VOICE = "Write like a no-nonsense northern woman, direct, warm, working class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew. This is Vanessa writing DIRECTLY TO the clinic owner, second person throughout, using 'you' and 'your', never 'the clinic' or 'they' or 'this client'. It should read exactly like an email or message Vanessa has sat down and written herself, addressed to them by name, personal and warm, encouraging and empowering, never talking them down or making them feel behind.";

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

// Runs the actual research and write up in the background, well after the
// HTTP response has already gone back. This has to happen out of band
// because the live web search plus high reasoning effort routinely takes
// a minute or two, and the Netlify proxy that sits in front of this API
// kills any single request at 30 seconds flat, handing the browser an
// HTML error page instead of JSON. Polling a short GET instead sidesteps
// that limit entirely, however long the research actually takes.
async function runReportGeneration(
  id: number,
  clinicName: string,
  postcode: string,
  researchNotes: string,
): Promise<void> {
  try {
    const systemPrompt = `You are Vanessa, writing directly to your client ${clinicName} with their personal competitor analysis. This is a message FROM Vanessa TO the clinic, not a report about them.

${NORTHERN_GRIT_VOICE}

RESEARCH TASK (use your live web search tool, this is real research, not a guess)
1. Find ${clinicName} near postcode ${postcode} in the UK. Work out from whatever is genuinely findable, their own website, Google Business listing, Instagram or Facebook, what they actually offer and what stands out about them.
2. Find their top 3 real, currently trading local competitors: other businesses of the same broad type, in or close to that postcode area. For each one, find out what they offer, what they seem to do well, and anything they are missing or doing less well.
3. Only use real facts you find. Never invent a competitor, a name, a review, or a fact about either side that your search does not support.

VANESSA'S OWN NOTES ON THIS CLIENT (may be empty, treat as true and combine with your own search, never contradict them)
${researchNotes || "(none given, rely fully on your own search)"}

WRITING TASK
Once your research is done, write the full message as clean semantic HTML (use h2, p, strong, ul/li only, no inline styles, no html/head/body wrapper, no markdown, no code fences). Address the clinic directly by name in the opening line and keep speaking to them as "you" all the way through every section, never slipping into third person. Structure it in this order:
1. A warm, personal opening addressed to the clinic by name, like the start of a message Vanessa is sending them.
2. "Your patch" - a short paragraph telling them, in "you" language, how competitive their area looks from what you found.
3. "Who else is on your patch" - one short paragraph per real competitor you found, written to the clinic, telling them what each one does well and where they fall short.
4. "What you've got that they haven't" - the most positive, specific section, telling the clinic directly what makes them stand out, built only from real details you found plus reasonable, clearly-labelled general strengths of a warm, personal, all-under-one-roof clinic. Do not invent specific facts.
5. "Where they're pulling ahead of you, and it's fixable" - honest and constructive, told straight to them, framed as gaps to close, never a threat.
6. "Where I'd focus your socials next" - Vanessa speaking as their own social media person, 3 to 5 specific, actionable content ideas built on their real strengths.
7. A short closing paragraph, warm and confident, signed off in spirit like Vanessa talking to them directly about turning this into an actual content plan together.
${COMPLIANCE_RULES}

Return ONLY the finished HTML for the message. No preamble, no explanation of your research, no JSON, no code fences, nothing else.`;

    const response = await openai.responses.create({
      model: "gpt-5.5",
      reasoning: { effort: "high" },
      tools: [{ type: "web_search" }],
      instructions: systemPrompt,
      input: `Research ${clinicName} near postcode ${postcode} and its top 3 real local competitors, then write the full report now, addressed directly to the clinic.`,
      max_output_tokens: 3000,
    });

    let reportHtml = (response.output_text ?? "").trim();
    reportHtml = reportHtml.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!reportHtml) {
      logger.warn({ clinicName, postcode }, "competitor-scout: empty response from web search generation");
      await db.execute(sql`
        UPDATE competitor_scout_reports SET status = 'failed' WHERE id = ${id}
      `);
      return;
    }

    await db.execute(sql`
      UPDATE competitor_scout_reports
      SET report_html = ${reportHtml}, status = 'ready'
      WHERE id = ${id}
    `);
  } catch (err) {
    logger.error({ err, id, clinicName }, "Failed to generate competitor scout report");
    await db.execute(sql`
      UPDATE competitor_scout_reports SET status = 'failed' WHERE id = ${id}
    `).catch((updateErr) => {
      logger.error({ updateErr, id }, "Failed to mark competitor scout report as failed");
    });
  }
}

// POST /api/competitor-scout/generate
// { clinicName, postcode, researchNotes? }
// researchNotes is now OPTIONAL: any extra digging Vanessa already has on
// the clinic or its competitors. The tool itself uses a live web search
// tool to go and find the clinic and its top 3 real nearby competitors,
// then writes the finished, on-brand, compliant report from what it finds
// (plus whatever notes Vanessa has added on top).
//
// This kicks the actual research and writing off in the background and
// responds immediately with a 'processing' row, since the full job can
// take a minute or two and the Netlify proxy in front of this API times
// requests out at 30 seconds. The frontend polls GET /:id until it flips
// to 'ready' (or 'failed').
router.post("/competitor-scout/generate", async (req, res) => {
  try {
    const clinicName = String(req.body?.clinicName || "").trim();
    const postcode = String(req.body?.postcode || "").trim();
    const researchNotes = String(req.body?.researchNotes || "").trim();

    if (!clinicName || !postcode) {
      return res.status(400).json({ error: "Clinic name and postcode are required" });
    }

    const insertResult = await db.execute(sql`
      INSERT INTO competitor_scout_reports (clinic_name, postcode, research_notes, report_html, status)
      VALUES (${clinicName}, ${postcode}, ${researchNotes}, '', 'processing')
      RETURNING id, clinic_name, postcode, research_notes, report_html, status, created_at
    `);
    const row = (insertResult as { rows?: ScoutReportRow[] }).rows?.[0];
    if (!row) {
      return res.status(500).json({ error: "Failed to start the report" });
    }

    res.json(row);

    void runReportGeneration(row.id, clinicName, postcode, researchNotes);
  } catch (err) {
    logger.error({ err }, "Failed to start competitor scout report");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
