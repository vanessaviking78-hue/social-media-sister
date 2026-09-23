import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getVoiceSystemPrompt } from "../lib/voicePrompts";

const router: IRouter = Router();

// Vanessa-only tool on www.thecybersuite.com, behind the admin password.
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

router.use("/newsletter", requireAuth);

const rowsOf = (r: unknown) => ((r as { rows?: any[] }).rows ?? []) as any[];

// The five slots always run in this order so every issue has the same rhythm:
// a proper read, a quick Q&A, a punchy myth buster, a human bit, then the
// gentle nudge towards booking.
export const SLOTS = [
  {
    slot: "lead",
    label: "The Lead Story",
    brief:
      "The main feature. 3 short paragraphs, around 130 to 170 words. Opens with a small, specific, real-feeling moment from clinic life or the season, then gets into the topic in plain English. No lecture, no textbook explanation. Ends on a line that leaves the reader curious.",
  },
  {
    slot: "ask",
    label: "Ask the Clinician",
    brief:
      "The heading IS a question a patient would genuinely ask about this topic, written the way a real person would say it, ending in a question mark. The body is the clinician's answer in 2 short paragraphs, 70 to 100 words, personal and reassuring, and always points towards a consultation as the place to get a proper answer for their own face or skin.",
  },
  {
    slot: "myth",
    label: "Myth vs Truth",
    brief:
      "The heading is the myth itself, written as a short statement people believe (no 'Myth:' prefix). The body is the truth, 50 to 80 words, punchy, a little bit funny, and factually careful. No efficacy promises.",
  },
  {
    slot: "bts",
    label: "Behind the Scenes",
    brief:
      "A warm, human, slightly funny peek behind the clinic door linked to this topic. 60 to 100 words. Real details: the team, the kettle, the diary, the playlist, the new chair. This is the bit that makes patients feel like they know the clinic.",
  },
  {
    slot: "sell",
    label: "Something for You",
    brief:
      "The stealth sell. 60 to 90 words. Seasonal and personal, it should read like a friend mentioning something rather than an advert. If an offer is supplied, weave it in plainly and truthfully with no urgency or pressure, and never attach an offer or discount to a prescription-only treatment. Also return ctaText: a short, warm button label of 2 to 5 words (for example 'Come and have a chat', 'Book your consultation', 'Find a time that suits').",
  },
] as const;

type SlotKey = (typeof SLOTS)[number]["slot"];

export type NewsletterSection = { slot: SlotKey; label: string; topic: string; heading: string; body: string };
export type NewsletterContent = {
  subjectLines: string[];
  previewTexts: string[];
  intro: string;
  sections: NewsletterSection[];
  ctaText: string;
  signOff: string;
};

const NEWSLETTER_RULES = `
THIS IS A PATIENT EMAIL NEWSLETTER, NOT A SOCIAL CAPTION
- Ignore any caption length rules above. Follow the word counts given for each section instead.
- The reader is an existing or past patient of the clinic, mostly women over 35. They opted in because they like the clinic. Write to one person, warmly, like a letter from someone they trust.
- First person singular, written as the clinic owner or lead clinician. British English throughout (colour, practise as a verb, specialise, centre, programme).
- No em dashes or en dashes anywhere, not once. No hashtags. No emojis.
- No boring medical education. Plain words, a bit of humour, real feeling. Keep facts careful and never overclaim.
- Never name a prescription-only medicine or brand (Botox, Azzalure, Bocouture, Dysport, Xeomin, Letybo, Relfydess and so on). Never write "anti-wrinkle". Use "injectable treatments", "smoothing treatments", "facial aesthetics" instead.
- Never promote or discount a prescription-only medicine treatment. Offers can only apply to consultations, skincare, facials, devices or other non-prescription services.
- Never say safe, pain-free, painless, guaranteed, permanent, no downtime, risk-free, instant results, best, number one, miracle, or promise any result. No before and after claims.
- No urgency or pressure: no "limited time", "hurry", "don't miss out", "last chance", "only X left".
- Headings are short, human and a bit clever, 3 to 8 words, never clickbait, never all capitals.`;

async function loadPreset(presetId: number) {
  const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
  return preset;
}

function clinicContext(preset: Awaited<ReturnType<typeof loadPreset>>, monthLabel: string, offer?: string) {
  if (!preset) return "";
  return [
    `CLINIC: ${preset.name}`,
    preset.targetAudience ? `AUDIENCE: ${preset.targetAudience}` : "",
    preset.brandNotes ? `BRAND NOTES (follow these): ${preset.brandNotes}` : "",
    `ISSUE: ${monthLabel}. Let the season and time of year colour the writing naturally, without forcing it.`,
    offer?.trim() ? `OFFER TO WEAVE INTO THE LAST SECTION ONLY: ${offer.trim()}` : "No offer this issue, so the last section nudges gently towards booking a consultation instead.",
  ]
    .filter(Boolean)
    .join("\n");
}

function stripDashes(s: unknown): string {
  return String(s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
}

async function recentTopics(presetId: number): Promise<string[]> {
  try {
    const r = await db.execute(sql`SELECT topics FROM newsletters WHERE preset_id = ${presetId} ORDER BY created_at DESC LIMIT 3`);
    return rowsOf(r).flatMap((row) => (Array.isArray(row.topics) ? row.topics : [])).map(String);
  } catch {
    return [];
  }
}

// POST /api/newsletter/generate
router.post("/newsletter/generate", async (req: Request, res: Response) => {
  try {
    const { presetId, topics, monthLabel, offer } = req.body as {
      presetId?: number;
      topics?: string[];
      monthLabel?: string;
      offer?: string;
    };
    const id = Number(presetId);
    if (!id) { res.status(400).json({ error: "Pick a clinic first" }); return; }
    const cleanTopics = (topics ?? []).map((t) => String(t ?? "").trim());
    if (cleanTopics.length !== 5) { res.status(400).json({ error: "Five topics are needed" }); return; }

    const preset = await loadPreset(id);
    if (!preset) { res.status(404).json({ error: "Clinic not found" }); return; }

    const month = (monthLabel || "").trim() || new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const past = await recentTopics(id);

    const slotLines = SLOTS.map((s, i) => {
      const topic = cleanTopics[i] || "(blank: choose a fitting seasonal topic for this clinic yourself)";
      return `${i + 1}. slot "${s.slot}" (${s.label}), topic: ${topic}\n   ${s.brief}`;
    }).join("\n");

    const system = `${getVoiceSystemPrompt(preset.voiceStyle || "northern-grit")}
${NEWSLETTER_RULES}

${clinicContext(preset, month, offer)}
${past.length ? `\nRECENT ISSUES ALREADY COVERED (do not repeat these angles): ${past.join("; ")}` : ""}

Return JSON only, in exactly this shape:
{
  "subjectLines": [3 email subject lines, each under 50 characters, curious and warm, no clickbait, no capitals shouting],
  "previewTexts": [3 inbox preview lines, each under 90 characters, that pair with the subject lines],
  "intro": "a short hello from the clinician, 2 to 3 sentences, 35 to 60 words, seasonal and personal",
  "sections": [ five objects in the order given, each { "slot": "...", "heading": "...", "body": "..." } ],
  "ctaText": "button label from the sell section",
  "signOff": "a short warm sign off line, one sentence, then the clinician's first name is added separately so do not include a name"
}
Use \\n\\n between paragraphs inside body text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 2600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Write this month's newsletter. The five sections:\n${slotLines}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { res.status(500).json({ error: "The writer returned something odd, try again" }); return; }

    const content: NewsletterContent = {
      subjectLines: (parsed.subjectLines ?? []).slice(0, 3).map(stripDashes),
      previewTexts: (parsed.previewTexts ?? []).slice(0, 3).map(stripDashes),
      intro: stripDashes(parsed.intro),
      sections: SLOTS.map((s, i) => {
        const found = (parsed.sections ?? []).find((x: any) => x?.slot === s.slot) ?? parsed.sections?.[i] ?? {};
        return { slot: s.slot, label: s.label, topic: cleanTopics[i], heading: stripDashes(found.heading), body: stripDashes(found.body) };
      }),
      ctaText: stripDashes(parsed.ctaText) || "Book your consultation",
      signOff: stripDashes(parsed.signOff),
    };

    const ins = await db.execute(sql`
      INSERT INTO newsletters (preset_id, client_name, month_label, topics, content)
      VALUES (${id}, ${preset.name}, ${month}, ${JSON.stringify(cleanTopics)}::jsonb, ${JSON.stringify(content)}::jsonb)
      RETURNING id
    `);
    const newId = rowsOf(ins)[0]?.id ?? null;

    res.json({ id: newId, monthLabel: month, content });
  } catch (err: unknown) {
    req.log?.error({ err }, "newsletter: generate error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Newsletter generation failed" });
  }
});

// POST /api/newsletter/regenerate-section -> rewrite one slot, or the intro
router.post("/newsletter/regenerate-section", async (req: Request, res: Response) => {
  try {
    const { presetId, slot, topic, monthLabel, offer, note, otherHeadings } = req.body as {
      presetId?: number;
      slot?: string;
      topic?: string;
      monthLabel?: string;
      offer?: string;
      note?: string;
      otherHeadings?: string[];
    };
    const preset = await loadPreset(Number(presetId));
    if (!preset) { res.status(404).json({ error: "Clinic not found" }); return; }
    const def = SLOTS.find((s) => s.slot === slot);
    if (!def) { res.status(400).json({ error: "Unknown section" }); return; }

    const month = (monthLabel || "").trim();
    const system = `${getVoiceSystemPrompt(preset.voiceStyle || "northern-grit")}
${NEWSLETTER_RULES}

${clinicContext(preset, month, def.slot === "sell" ? offer : undefined)}

You are rewriting ONE section of the newsletter: "${def.label}".
${def.brief}
${otherHeadings?.length ? `Other headings in this issue (do not echo them): ${otherHeadings.join(" | ")}` : ""}
Return JSON only: { "heading": "...", "body": "..."${def.slot === "sell" ? ', "ctaText": "..."' : ""} }. Use \\n\\n between paragraphs.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: 700,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Topic: ${topic || "choose a fitting seasonal topic"}${note?.trim() ? `\nVanessa's note for this rewrite: ${note.trim()}` : ""}\nGive me a fresh take.` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    res.json({
      heading: stripDashes(parsed.heading),
      body: stripDashes(parsed.body),
      ctaText: parsed.ctaText ? stripDashes(parsed.ctaText) : undefined,
    });
  } catch (err: unknown) {
    req.log?.error({ err }, "newsletter: regenerate error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Rewrite failed" });
  }
});

// GET /api/newsletter/history/:presetId
router.get("/newsletter/history/:presetId", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params["presetId"]);
    const r = await db.execute(sql`
      SELECT id, month_label, topics, content, created_at, updated_at
      FROM newsletters WHERE preset_id = ${id} ORDER BY created_at DESC LIMIT 24
    `);
    res.json({ issues: rowsOf(r) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load past issues" });
  }
});

// PUT /api/newsletter/:id -> save edits
router.put("/newsletter/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params["id"]);
    const { content, monthLabel } = req.body as { content?: NewsletterContent; monthLabel?: string };
    if (!id || !content) { res.status(400).json({ error: "Nothing to save" }); return; }
    const topics = (content.sections ?? []).map((s) => s.topic ?? "");
    await db.execute(sql`
      UPDATE newsletters
      SET content = ${JSON.stringify(content)}::jsonb,
          topics = ${JSON.stringify(topics)}::jsonb,
          month_label = COALESCE(${monthLabel ?? null}, month_label),
          updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Save failed" });
  }
});

// DELETE /api/newsletter/:id
router.delete("/newsletter/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM newsletters WHERE id = ${Number(req.params["id"])}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
  }
});

export default router;
