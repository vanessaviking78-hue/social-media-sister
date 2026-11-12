import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { matchedCta, withCta, CAPTION_END_RULE } from "../lib/hookBank";
import { clientProfileContext } from "./client-profiles";

// UNIVERSAL: one tool for every client, six posts per treatment. The headline is the treatment name or the
// angle, the subtitle is one quirky line, and the writing comes from the client's own voice.
const router: IRouter = Router();

function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[–—]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/!/g, ".")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Exactly five hashtags, each joining the clinic's area to a beauty or mums theme.
function fiveTags(raw: unknown, area: string): string[] {
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const parts = area.split(",").map((p) => slug(p)).filter(Boolean);
  const town = parts[0] || "";
  const city = parts[1] || parts[0] || "";
  const themed = (t: string) => /(beauty|mum|mam|mummy|mummies|mother|skin|glow|aesthetic|facial|selfcare|hair|laser|clinic)/.test(t);
  const related = fromModel.filter((t) => ((town && t.includes(town)) || (city && t.includes(city))) && themed(t));
  const fallback = town
    ? [`${town}beauty`, `${town}mums`, `${city}beauty`, `${city}mums`, `${town}skincare`, `${city}skincare`, `${town}aesthetics`, `${town}selfcare`, `${town}glow`]
    : ["beauty", "skincare", "aesthetics", "selfcare", "glow"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...related, ...fallback]) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length === 5) break;
  }
  return out.map((t) => `#${t}`);
}

function systemPrompt(client: string, area: string, treatment: string, headline: string, brief: string, intro: boolean, fromHook = false): string {
  return `${HOUSE_VOICE}

${HOUSE_RULES}

For this tool only, these lines override the house rules above on the call to action: the last slide and the closing line of the caption are set for you, so never write a call to action yourself.

You write as ${client}${area ? ` in ${area}` : ""}, in the first person ("I", "my", "you"), as the clinician running the clinic, never as a social media manager. Where the client's own words are given below, their personality sets the tone. Otherwise use the house voice.

THIS IS A FIVE SLIDE CAROUSEL ABOUT ${treatment.toUpperCase()}.
THE HEADLINE (set, do not change it): "${headline}"
THE BRIEF: ${brief}
${fromHook ? `
THE HEADLINE IS A HOOK THE CLINIC CHOSE, AND IT SETS THE WHOLE POST. The slides must read as one continuous thought with it, never a generic explainer about ${treatment}.
- slide2 picks up the exact moment, feeling or detail in the headline (its place, age, memory or situation) and says more about it, in the same voice.
- slide3 turns that into how it feels for her now, in her own skin and her own confidence, still referring back to the headline's detail.
- slide4 brings ${treatment} in gently as one option many people find helpful, tied back to the same thought, ending on a warm line that echoes the headline.
- "phrases": exactly 6 short lines of at most 5 words each, that sit on the cover around the headline. Each one is a small observation, feeling or wry aside that belongs to the headline's own world, never advice, never a generic tip like "sun cream" or "aftercare matters".
- "points": exactly 3 items, each { "t": at most 4 words, "b": one short sentence of at most 14 words } that carry the headline's thought forward.
- The subtitle and the caption must also stay inside the headline's world. If the headline is not about ${treatment}, do not turn the slides into a treatment explainer.
` : ""}
THE WRITING
- "subtitle": the line under the headline on slide 1. ${intro ? "ONE short sentence, maximum 14 words, quirky and warm, that explains what the treatment is in plain words." : "ONE short sentence, maximum 14 words, quirky and warm, that adds a wink to the headline."} It should make a woman over 35 smile and keep reading. Never a question. Never a pun on someone's looks or age.
- "slide2", "slide3", "slide4": each is EXACTLY three short sentences, friendly but informative, each carrying on from the one before. Plain everyday words, a little humour where it fits.
- "caption": the Instagram caption, maximum 120 words. A first line that holds attention, short lines, a little humour and personality, adding something the slides do not say. ${CAPTION_END_RULE}
- "hashtags": exactly 5, lower case, no spaces${area ? `, each joining ${area} to a beauty, mums or skin theme` : ""}.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there".
- No emojis. No exclamation marks. No tea, kettle, biscuit, cuppa or sofa jokes.
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency. Never say a treatment is safe or painless or permanent. Never say it will fix, cure or reverse anything. Say "may", "can" and "many people find". Suitability is always decided at a consultation.
- You may use the treatment name exactly as given. Never use the words inject, injection, injectable, jab, needle (other than in the word microneedling), Botox, anti-wrinkle, wrinkle or lines, and never mention a prescription medicine.
- Never mention a website, a link or a web address.
- Never invent a patient, a story, a quote, a name, a qualification or a number. Speak only in general terms that this clinician could truthfully say.

Return JSON only, in exactly this shape:
{ "subtitle": "...", "slide2": "...", "slide3": "...", "slide4": "...", "caption": "...", "hashtags": ["5 tags"]${fromHook ? `, "phrases": ["6 short lines"], "points": [{ "t": "...", "b": "..." }]` : ""} }`;
}

router.post("/universal/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const client = str(b.client, 120);
    const area = str(b.area, 80);
    const treatment = str(b.treatment, 80);
    const headline = str(b.headline, 160);
    const brief = str(b.brief, 1500);
    const note = str(b.note, 900);
    const intro = b.intro === true;
    const fromHook = b.fromHook === true;
    if (!client || !treatment || !headline || !brief) {
      res.status(400).json({ error: "Pick a client and a post first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(client, area, treatment, headline, brief, intro, fromHook) + (await clientProfileContext(client)) },
        { role: "user", content: `Write the carousel "${headline}" for ${client}.${note ? ` Extra from them: ${note}` : ""}` },
      ],
      temperature: 0.85,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = matchedCta(treatment, undefined, headline);
    res.json({
      subtitle: clean(j.subtitle, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: withCta(clean(j.caption, 900), cta),
      hashtags: fiveTags(j.hashtags, area),
      ...(fromHook ? {
        phrases: (Array.isArray(j.phrases) ? j.phrases : []).map((x: unknown) => clean(x, 60)).filter(Boolean).slice(0, 6),
        points: (Array.isArray(j.points) ? j.points : []).map((x: { t?: unknown; b?: unknown }) => ({ t: clean(x?.t, 50), b: clean(x?.b, 140) })).filter((x: { t: string }) => x.t).slice(0, 3),
      } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "universal: copy error");
    res.status(500).json({ error: message });
  }
});

// The fixed images for each treatment. The files themselves go up through /api/content/upload-image,
// this table only remembers which picture belongs to which treatment.
let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS universal_images (
      id SERIAL PRIMARY KEY,
      treatment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

router.get("/universal/images", async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT id, treatment_id AS "treatmentId", name, url FROM universal_images ORDER BY id`);
    res.json({ images: r.rows });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load the images" });
  }
});

router.post("/universal/images", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const items = Array.isArray((req.body as { items?: unknown }).items) ? ((req.body as { items: unknown[] }).items as Record<string, unknown>[]) : [];
    const rows = items
      .map((i) => ({ treatmentId: String(i.treatmentId ?? "").slice(0, 60), name: String(i.name ?? "").slice(0, 200), url: String(i.url ?? "").slice(0, 600) }))
      .filter((i) => i.treatmentId && i.url.startsWith("http"))
      .slice(0, 100);
    for (const r of rows) {
      await db.execute(sql`INSERT INTO universal_images (treatment_id, name, url) VALUES (${r.treatmentId}, ${r.name}, ${r.url})`);
    }
    res.json({ added: rows.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save the images" });
  }
});

router.delete("/universal/images/:id", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Which image?" });
      return;
    }
    await db.execute(sql`DELETE FROM universal_images WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not remove it" });
  }
});

export default router;
