import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getVoiceSystemPrompt } from "../lib/voicePrompts";
import { applySwap, isBlocking, scanOffer, scanText, type ComplianceFlag } from "../lib/newsletterCompliance";

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
- Headings are short, human and a bit clever, 3 to 8 words, in normal sentence case (not Title Case), no colons, never clickbait, never all capitals.
- Say "I" and "my", not "we" and "our", unless you are genuinely talking about the whole team.
- One exclamation mark in the whole newsletter at most. Usually none.
- Never trivialise a medical treatment ("quick fix", "lunchtime tweak"), never play on insecurity about ageing, and never suggest anyone needs fixing.`;

// ---------------------------------------------------------------------------
// Compliance enforcement. Every line the writer produces goes through this
// before it is saved or shown: an automatic scan, an AI compliance edit of
// anything risky, then deterministic swaps as the final safety net. Whatever
// still can't be fixed automatically comes back flagged, and the page won't
// let it download until it's sorted.
// ---------------------------------------------------------------------------
type FieldMap = Record<string, string>;

const COMPLIANCE_EDITOR = `You are a senior UK advertising compliance editor for aesthetic clinics, expert in the ASA, the CAP Code (especially the rules on medicines, cosmetic interventions and substantiation) and MHRA rules on prescription-only medicines.

You receive the fields of a patient newsletter as JSON, plus any issues an automatic scan found. Check EVERY field for breaches, not only the flagged ones:
- naming or hinting at a prescription-only medicine or brand (Botox, "tox", Azzalure, Bocouture, Dysport, Xeomin, Letybo, Relfydess and similar), or "anti-wrinkle injections"
- promoting, discounting or incentivising a prescription-only medicine treatment; offers may only attach to consultations, skincare, facials, devices or other non-prescription services
- claims about results: guarantees, "safe", pain-free, no downtime, permanent, how long results last, "proven", looking X years younger, erasing or removing wrinkles, reversing or stopping ageing, miracle or instant results
- superlatives such as best, number one, leading
- urgency or scarcity pressure: limited, hurry, last chance, diary filling fast, only a few left
- before and after claims
- trivialising a medical procedure, playing on insecurity about ageing or appearance, or anything likely to mislead or cause harm or offence

Fix each breach with the smallest rewrite that makes that field compliant. Keep the voice, the meaning, first person singular, British English, a similar length and any paragraph breaks (\\n\\n). Never use em dashes or en dashes. Never add disclaimers or legal wording into the copy.

Return JSON only: {"changes": {"<field key>": "<the full rewritten text for that field>"}}. Include only fields you actually changed. If everything is compliant, return {"changes": {}}.`;

function scanFields(fields: FieldMap): ComplianceFlag[] {
  return Object.entries(fields).flatMap(([key, text]) => scanText(text || "", key, key));
}

async function enforceCompliance(fields: FieldMap, context: string) {
  const out: FieldMap = { ...fields };
  let rewritten = 0;
  for (let round = 0; round < 3; round++) {
    const flags = scanFields(out).filter(isBlocking);
    // The first round always reviews everything; the second only runs if the scan still finds something.
    if (round > 0 && flags.length === 0) break;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: "system", content: COMPLIANCE_EDITOR },
          {
            role: "user",
            content:
              (round > 0
                ? `These exact phrases are STILL in the copy and MUST be removed or reworded so they no longer appear in any form: ${flags.map((f) => `"${f.matched.trim()}" in ${f.field}`).join("; ")}.\n\n`
                : "") +
              JSON.stringify({
                context,
                fields: out,
                flaggedByScan: flags.map((f) => ({ field: f.field, matched: f.matched, reason: f.reason })),
              }),
          },
        ],
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      for (const [key, value] of Object.entries(parsed.changes ?? {})) {
        if (key in out && typeof value === "string" && value.trim() && value.trim() !== out[key]) {
          out[key] = stripDashes(value);
          rewritten++;
        }
      }
    } catch {
      // If the editor call fails, the deterministic pass and the page's lock still protect the copy.
    }
  }

  // Deterministic safety net for anything with a known safe swap.
  let autoFixed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const swappable = scanFields(out).filter((f) => f.swap !== undefined);
    if (!swappable.length) break;
    for (const f of swappable) {
      const next = applySwap(out[f.field], f.matched, f.swap!);
      if (next !== out[f.field]) { out[f.field] = next; autoFixed++; }
    }
  }

  // Last resort: if a risky phrase still won't budge, drop the sentence it
  // sits in, as long as the field still reads as something afterwards.
  let removed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const stuck = scanFields(out).filter(isBlocking);
    if (!stuck.length) break;
    let changed = false;
    for (const f of stuck) {
      const next = dropSentence(out[f.field], f.matched);
      if (next !== null && next !== out[f.field]) { out[f.field] = next; removed++; changed = true; }
    }
    if (!changed) break;
  }

  const remaining = scanFields(out).filter(isBlocking).map((f) => ({ field: f.field, matched: f.matched, reason: f.reason }));
  return { fields: out, report: { checked: true, rewritten, autoFixed: autoFixed + removed, remaining } };
}

// Removes the sentence containing `phrase`. Returns null if nothing sensible
// would be left, so the field stays flagged for a human instead.
export function dropSentence(text: string, phrase: string): string | null {
  const idx = text.indexOf(phrase);
  if (idx < 0) return null;
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (text[i] === "\n") { start = i + 1; break; }
    if (/[.!?]/.test(text[i]) && /\s/.test(text[i + 1] ?? "")) { start = i + 1; break; }
  }
  const tail = text.slice(idx).search(/[.!?](\s|$)/);
  const end = tail < 0 ? text.length : idx + tail + 1;
  const next = (text.slice(0, start) + text.slice(end))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return next.length >= 25 ? next : null;
}

function contentToFields(c: NewsletterContent): FieldMap {
  const f: FieldMap = { intro: c.intro, ctaText: c.ctaText, signOff: c.signOff };
  c.subjectLines.forEach((t, i) => (f[`subjectLine${i + 1}`] = t));
  c.previewTexts.forEach((t, i) => (f[`previewText${i + 1}`] = t));
  c.sections.forEach((s) => {
    f[`${s.slot}.heading`] = s.heading;
    f[`${s.slot}.body`] = s.body;
  });
  return f;
}

function fieldsToContent(c: NewsletterContent, f: FieldMap): NewsletterContent {
  return {
    ...c,
    intro: f.intro ?? c.intro,
    ctaText: f.ctaText ?? c.ctaText,
    signOff: f.signOff ?? c.signOff,
    subjectLines: c.subjectLines.map((t, i) => f[`subjectLine${i + 1}`] ?? t),
    previewTexts: c.previewTexts.map((t, i) => f[`previewText${i + 1}`] ?? t),
    sections: c.sections.map((s) => ({ ...s, heading: f[`${s.slot}.heading`] ?? s.heading, body: f[`${s.slot}.body`] ?? s.body })),
  };
}

const OFFER_REFUSAL =
  "That offer looks like it's attached to a prescription-only treatment, which the MHRA and CAP Code don't allow. Put the offer on a consultation, skincare, a facial or another non-prescription service instead.";

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

    if (scanOffer(offer ?? "").length) { res.status(400).json({ error: OFFER_REFUSAL }); return; }

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
  "signOff": "a one-sentence P.S. that sits under the clinician's signature: playful, warm and personal, and it can carry a gentle nudge towards booking or replying. Do not start it with 'P.S.' (that is added for you) and do not include a name"
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

    const draft: NewsletterContent = {
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

    const checked = await enforceCompliance(contentToFields(draft), `Patient newsletter for ${preset.name}, ${month}.${offer?.trim() ? ` Offer: ${offer.trim()}` : ""}`);
    const content = fieldsToContent(draft, checked.fields);

    const ins = await db.execute(sql`
      INSERT INTO newsletters (preset_id, client_name, month_label, topics, content)
      VALUES (${id}, ${preset.name}, ${month}, ${JSON.stringify(cleanTopics)}::jsonb, ${JSON.stringify(content)}::jsonb)
      RETURNING id
    `);
    const newId = rowsOf(ins)[0]?.id ?? null;

    res.json({ id: newId, monthLabel: month, content, compliance: checked.report });
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
    if (def.slot === "sell" && scanOffer(offer ?? "").length) { res.status(400).json({ error: OFFER_REFUSAL }); return; }

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
    const fields: FieldMap = { [`${def.slot}.heading`]: stripDashes(parsed.heading), [`${def.slot}.body`]: stripDashes(parsed.body) };
    if (parsed.ctaText) fields.ctaText = stripDashes(parsed.ctaText);
    const checked = await enforceCompliance(fields, `One section ("${def.label}") of a patient newsletter for ${preset.name}.`);
    res.json({
      heading: checked.fields[`${def.slot}.heading`],
      body: checked.fields[`${def.slot}.body`],
      ctaText: checked.fields.ctaText,
      compliance: checked.report,
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
