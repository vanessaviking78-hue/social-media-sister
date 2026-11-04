import { isFinalCta } from "../lib/hookBank";
import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_RULES, ACADEMY_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";

// DR LISA ACADEMY: her own page. A warm, experienced trainer with personality, one carousel at a time.
const router: IRouter = Router();

const CLINIC = "Dr Lisa Academy";

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

// Exactly five hashtags, each joining the clinic's area to a beauty, skin or wellbeing theme.
function fiveTags(raw: unknown, area: string): string[] {
  const town = slug(area);
  const themed = (t: string) => /(beauty|aesthetic|training|trainer|academy|course|career|learn|education|nurse|dental)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = town ? fromModel.filter((t) => t.includes(town) && themed(t)) : [];
  const fallback = town ? [`${town}aesthetics`, `${town}aestheticstraining`, `${town}beauty`, `${town}training`, `${town}academy`, `${town}careerchange`, `${town}aestheticsacademy`] : ["aesthetics", "aestheticstraining", "aestheticsacademy", "careerchange", "learnaesthetics"];
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

// The last slide line. Treatment posts always close on the DM line. Every other post gets an area line,
// picked at random and kept different from the other posts she has already made.
const TREATMENT_CTA = "If this sounds like something you'd be interested in, drop me a DM.";
const AREA_CTAS = [
  "If you're a medical professional looking to train with someone who cares, follow along.",
  "If you're a medical professional looking to train with someone who cares, meet me in the DMs.",
  "If you're a medical professional looking to train with someone who cares, feel free to ask me any questions.",
  "If you're a medical professional and would like a relaxed chat before deciding anything, my DMs are open. Many of my trainees travel to me.",
  "If you're a medical professional looking to train with someone who cares, send me a message. Plenty of people travel to train with me.",
  "If you're a medical professional looking to train with someone who cares, I would love to hear from you in the DMs.",
  "If you're a medical professional and happy to travel to train with someone who cares, come and say hello in the DMs.",
  "If you're a medical professional looking for honest, unhurried advice about training, do get in touch.",
];
function pickCta(kind: string, area: string, avoid: string[]): string {
  if (kind === "treatment") return TREATMENT_CTA;
  const all = AREA_CTAS;
  const fresh = all.filter((c) => !avoid.some((a) => a.trim().toLowerCase() === c.toLowerCase()));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function systemPrompt(brief: string, label: string, hasWord: boolean, area: string): string {
  return `${HOUSE_RULES}

${ACADEMY_RULES}

VOICE: you are Dr Lisa, an experienced aesthetics trainer${area ? ` based in ${area}` : ""}, writing in the first person ("I", "my", "you"), never as a social media manager. Professional with personality: warm, encouraging, honest and quick to put a nervous woman at ease. A little dry humour is welcome in the caption, never silly, never at the reader's expense. Plain, human words. Write for women over 35 who are wondering whether a career in aesthetics could be for them.

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. Maximum 12 words. Specific, warm and stops the scroll. No puns.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, friendly and informative, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 120 words. A first line that holds attention. Short lines. It adds something the slides do not say and closes with a light, relevant question. Its final line is an invitation to get in touch, which is added for you, so do not write one.
- "hashtags": exactly 5, lower case, no spaces${area ? `, each joining ${area} to an aesthetics, training or career theme` : ""}.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there".
- Compliance: no promises about earnings, income, success or job outcomes, no guarantees, no prices, no offers, no urgency. Never state a qualification, accreditation, award, number of years or number of delegates. Never mention Botox, prescription medicines, anti-wrinkle or injectables by name, and never mention a website or a link.
- No exclamation marks. No emojis.
- Never invent a delegate, a story, a quote, a name or a number. Speak only in general terms that a trainer could truthfully say.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/lisa/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 120);
    const word = str(b.word, 40);
    const note = str(b.note, 300);
    const area = str(b.area, 60);
    const kind = str(b.kind, 20);
    const avoid = Array.isArray(b.avoid) ? (b.avoid as unknown[]).map((x) => String(x ?? "")).slice(0, 60) : [];
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(brief, label, !!word, area) + (await clientProfileContext(CLINIC)) },
        { role: "user", content: `Write the carousel "${label}" for ${CLINIC}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.8,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = pickCta(kind, area, avoid);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isFinalCta(l) && !/drop me a dm|meet me in the dms|follow along\.?$/i.test(l))
      .join("\n");
    res.json({
      hook: clean(j.hook, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: `${body}\n\n${cta}`,
      hashtags: fiveTags(j.hashtags, area),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "lisa: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
