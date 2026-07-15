import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

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

// The voice this pipeline writes in, and the compliance rules every generated
// word has to follow. Kept consistent with the Content Generator's own
// Northern Grit tone and clinic compliance rules, since this is going out
// under the same brand.
const NORTHERN_GRIT_VOICE = "Write like a no-nonsense northern woman — direct, warm, working-class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew. First person where it reads naturally, as if Vanessa is speaking straight to the clinic owner.";

const COMPLIANCE_RULES = `
COMPLIANCE (non-negotiable, every single word)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility. Use "may help", "can improve" — not "will fix", "cures", "guaranteed".
- These are medical aesthetics clinics, not beauty or nail salons. Ideas should fit injectable, skin and clinical treatments, not generic "buy 3 get 1 free" salon-style loyalty gimmicks.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per idea maximum.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world"
- Use contractions naturally: you're, it's, don't, we're, that's.
- British English throughout. "colour" not "color". "practitioner" not "provider". "clinic" not "office".`;

type PresetRow = typeof clientPresetsTable.$inferSelect;
type GeneratedIdea = { title: string; instructions: string; draftContent: string };

// The Sunday that starts the current week (UTC), formatted YYYY-MM-DD. Used
// as the batch key so a client only ever gets one set of ideas per week.
function currentWeekOf(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return sunday.toISOString().slice(0, 10);
}

// Generates three distinct ideas in a single completion (one offer/promo
// angle, one content/awareness angle, one referral or loyalty mechanic),
// rather than three separate API calls.
async function generateIdeasForPreset(preset: PresetRow): Promise<GeneratedIdea[]> {
  const context = [
    `Clinic name: ${preset.name}`,
    preset.targetAudience ? `Target audience: ${preset.targetAudience}` : "",
    preset.contentPillars ? `Content pillars: ${preset.contentPillars}` : "",
    preset.brandNotes ? `Brand notes: ${preset.brandNotes}` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a social media and revenue strategist for aesthetic and wellness clinics, writing this week's set of revenue ideas for a specific clinic client.

${NORTHERN_GRIT_VOICE}

CLINIC CONTEXT
${context}

TASK
Come up with THREE fresh, specific revenue ideas for this clinic. These are not weekly social media promos, they are genuine ways for the clinic to make more money, the kind of thing a clinic owner would actually build and run for months, not a one-off post. Think in terms of real revenue mechanics, for example:
- A recurring revenue model: a skin subscription, a monthly membership, a pre-paid package or plan that turns one-off clients into regular income.
- Winning back lapsed clients: a specific way to get old clients who haven't been in for a while back through the door, not a vague "we miss you" post but an actual mechanic (what's the trigger, what's the offer, how does it get sent).
- A third idea of your choosing in the same spirit, for example an upsell/bundle across treatments, a VIP or loyalty tier, or a referral system with real structure behind it, not just "refer a friend".

Make sure the three are genuinely different revenue mechanics from each other. Avoid generic "book now" offers and avoid anything that reads like a nail bar or beauty salon deal, these are medical aesthetics clinics. Make each idea feel tailored to this clinic.

Return a JSON object with exactly this shape:

{ "ideas": [ { "title": "...", "instructions": "...", "draftContent": "..." }, { "title": "...", "instructions": "...", "draftContent": "..." }, { "title": "...", "instructions": "...", "draftContent": "..." } ] }

title
A short, punchy name for the idea. Max 8 words.

instructions
A brief written directly to the clinic owner explaining the idea and how to actually set it up and run it, in the voice above. 4-6 sentences. Practical and specific: what it is, roughly how it would work operationally (pricing structure, who it targets, how it gets communicated), and why it makes sense for this clinic. No fluff.

draftContent
A ready-to-use piece of copy (a social caption, email, or short post) announcing or promoting the idea, that the clinic could post or send as-is or lightly tweak. 4-6 sentences.
${COMPLIANCE_RULES}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate this week's three revenue ideas now." },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
    max_tokens: 1800,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { ideas?: Partial<GeneratedIdea>[] } = {};
  try {
    parsed = JSON.parse(raw) as { ideas?: Partial<GeneratedIdea>[] };
  } catch {
    logger.warn({ raw, preset: preset.name }, "revenue-ideas: failed to parse AI JSON");
  }
  const ideas = (parsed.ideas || []).slice(0, 3).map((idea) => ({
    title: idea.title || "This week's revenue idea",
    instructions: idea.instructions || "",
    draftContent: idea.draftContent || "",
  }));
  while (ideas.length < 3) {
    ideas.push({ title: "This week's revenue idea", instructions: "", draftContent: "" });
  }
  return ideas;
}

export async function generateWeeklyRevenueIdeas(weekOf?: string): Promise<{ weekOf: string; created: number; skipped: number; failed: number }> {
  const week = weekOf || currentWeekOf();
  const presets = await db.select().from(clientPresetsTable);
  let created = 0, skipped = 0, failed = 0;

  for (const preset of presets) {
    try {
      const existing = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM revenue_ideas WHERE preset_id = ${preset.id} AND week_of = ${week}
      `);
      const existingCount = Number((existing as { rows?: Array<{ count: number }> }).rows?.[0]?.count ?? 0);
      if (existingCount >= 3) {
        skipped++;
        continue;
      }
      const ideas = await generateIdeasForPreset(preset);
      for (let i = 0; i < 3; i++) {
        const idea = ideas[i];
        await db.execute(sql`
          INSERT INTO revenue_ideas (preset_id, client_name, week_of, idea_index, title, instructions, draft_content, status)
          VALUES (${preset.id}, ${preset.name}, ${week}, ${i + 1}, ${idea.title}, ${idea.instructions}, ${idea.draftContent}, 'draft')
          ON CONFLICT (preset_id, week_of, idea_index) DO NOTHING
        `);
      }
      created++;
    } catch (err) {
      failed++;
      logger.error({ err, preset: preset.name }, "revenue-ideas: failed to generate ideas for client");
    }
  }

  logger.info({ week, created, skipped, failed }, "Weekly revenue ideas generation complete");
  return { weekOf: week, created, skipped, failed };
}

// Used by the client portal route to show the client every idea approved for
// them so far, newest week first, so ideas build up over time rather than
// disappearing once the week ends.
export async function getApprovedIdeasForClient(clientName: string): Promise<Array<{ title: string; instructions: string; draftContent: string; weekOf: string }>> {
  const result = await db.execute(sql`
    SELECT title, instructions, draft_content, week_of FROM revenue_ideas
    WHERE client_name = ${clientName} AND status = 'approved'
    ORDER BY week_of DESC, idea_index ASC
  `);
  const rows = (result as { rows?: any[] }).rows ?? [];
  return rows.map((row) => ({ title: row.title, instructions: row.instructions, draftContent: row.draft_content, weekOf: row.week_of }));
}

router.post("/revenue-ideas/generate", requireAuth, async (req, res) => {
  try {
    const { weekOf } = req.body as { weekOf?: string };
    const result = await generateWeeklyRevenueIdeas(weekOf);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "revenue-ideas: generate endpoint failed");
    res.status(500).json({ error: err.message || "Failed to generate revenue ideas" });
  }
});

router.get("/revenue-ideas", requireAuth, async (req, res) => {
  try {
    const weekOf = (req.query.weekOf as string) || currentWeekOf();
    const result = await db.execute(sql`
      SELECT * FROM revenue_ideas WHERE week_of = ${weekOf} ORDER BY client_name ASC, idea_index ASC
    `);
    res.json({ weekOf, ideas: (result as { rows?: any[] }).rows ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list revenue ideas" });
  }
});

router.patch("/revenue-ideas/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { title, instructions, draftContent, status } = req.body as { title?: string; instructions?: string; draftContent?: string; status?: string };
    if (status && !["draft", "approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be draft, approved or rejected" });
      return;
    }
    const result = await db.execute(sql`
      UPDATE revenue_ideas SET
        title = COALESCE(${title ?? null}, title),
        instructions = COALESCE(${instructions ?? null}, instructions),
        draft_content = COALESCE(${draftContent ?? null}, draft_content),
        status = COALESCE(${status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);
    const rows = (result as { rows?: any[] }).rows ?? [];
    if (!rows.length) { res.status(404).json({ error: "Idea not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update idea" });
  }
});

router.delete("/revenue-ideas/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.execute(sql`DELETE FROM revenue_ideas WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete idea" });
  }
});

export default router;
