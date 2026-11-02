import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";
import { finalCta } from "../lib/hookBank";

// NO 1 BODY SCULPTING, Birmingham. Her own page, one carousel at a time.
const router: IRouter = Router();

const CLINIC = "NO 1 BODY SCULPTING";
const AREA = "Birmingham";

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

// Exactly five hashtags, all Birmingham joined to a beauty or mums theme.
function fiveTags(raw: unknown): string[] {
  const town = slug(AREA);
  const themed = (t: string) => /(beauty|mum|mam|mummy|mummies|mother|skin|glow|aesthetic|facial|selfcare|body|sculpt)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = fromModel.filter((t) => t.includes(town) && themed(t));
  const fallback = [`${town}beauty`, `${town}mums`, `${town}skincare`, `${town}selfcare`, `${town}bodysculpting`, `${town}mumlife`, `${town}glow`];
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

function systemPrompt(brief: string, label: string, hasWord: boolean): string {
  return `${HOUSE_VOICE}

${HOUSE_RULES}

The house voice above is the voice for everything you write.

You write as the owner of ${CLINIC} in ${AREA}, in the first person ("I", "my", "you"), never as a social media manager and never as "we". She is glamorous, warm, loyal and straight talking, very dry and playful, honest, down to earth and never about the money. She is the clinician, so she speaks as herself. Never mention her dog, her sons, her friends or the gym, and never assume the reader has children, unless the brief itself is about her life. Treatment, skin, volume, menopause, weight loss, tweet and trust posts stay about the reader and the treatment only.

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. Maximum 12 words. It must stop a woman over 35 scrolling. Specific, relatable or funny, never generic.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, friendly but informative, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 110 words. First line is a hook that lands inside 3 seconds. Short punchy lines. It adds something the slides do not say. At least one genuinely funny line, dry and warm. ${hasWord ? "Its final line must be the comment line, which is added for you, so do not write it." : "Its final line must be the line 'Tag a friend who will get it', which is added for you, so do not write it."}
- "hashtags": exactly 5, lower case, no spaces, each one joins Birmingham to a beauty, mums or skin theme. Every tag contains birmingham.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If it sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency. Never say a treatment is safe, painless or risk free. Never say it will fix or cure anything. Keep consultation and suitability first.
- Never name any medication, drug or injection used for weight loss, and never mention prescription medicines, hormone treatment, Botox, anti-wrinkle or injectables. Never mention a website or a link.
- The intimate wellness machine is only ever about comfort and confidence. Never claim it treats bladder control, incontinence or any condition.
- No swearing. No exclamation marks. No emojis.
- Never invent a client, a story, a quote, a name or a number. Talk about how I work in general terms I could truthfully say.
- Be kind about bodies, always. The patient's biggest worry is showing her body, so every line should make her feel safe and unjudged.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/no1/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 120);
    const word = str(b.word, 40);
    const note = str(b.note, 300);
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post type first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(brief, label, !!word) + (await clientProfileContext(CLINIC)) },
        { role: "user", content: `Write the carousel "${label}" for ${CLINIC}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = finalCta(word);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^comment .* for more info\.?$/i.test(l) && !/^tag a friend who will get it\.?$/i.test(l))
      .join("\n");
    res.json({
      hook: clean(j.hook, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: `${body}\n\n${cta}.`,
      hashtags: fiveTags(j.hashtags),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "no1: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
