import { isFinalCta } from "../lib/hookBank";
import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";
import { RYDER_TONE } from "./caption-generator";

// THE RYDER CLINIC: her own page. Very professional, sincere, no humour, one carousel at a time.
const router: IRouter = Router();

const CLINIC = "The Ryder Clinic";

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
  const themed = (t: string) => /(beauty|mum|mam|skin|glow|aesthetic|facial|selfcare|wellness|health|clinic|doctor)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = town ? fromModel.filter((t) => t.includes(town) && themed(t)) : [];
  const fallback = town ? [`${town}beauty`, `${town}skincare`, `${town}aesthetics`, `${town}selfcare`, `${town}wellness`, `${town}clinic`, `${town}mums`] : ["skincare", "aesthetics", "selfcare", "skinhealth", "wellness"];
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
  "If you're in {area} and would like to know more, follow along.",
  "If you're in {area} and want clinical excellence with a smile, meet me in the DMs.",
  "If you're in {area} and the surrounding areas and are looking for treatment with someone who cares, feel free to ask me any questions.",
  "If you are near {area} and would like a considered conversation before deciding anything, my DMs are open.",
  "If you live in or around {area} and have a question you have been meaning to ask, send me a message.",
  "If you're in {area} and would like to talk it through with a doctor, I would love to hear from you in the DMs.",
  "If you're in {area} and would like a little more information, come and say hello in the DMs.",
  "If you are in {area} and the surrounding areas and want honest, unhurried advice, do get in touch.",
];
function pickCta(kind: string, area: string, avoid: string[]): string {
  if (kind === "treatment") return TREATMENT_CTA;
  const where = area || "your area";
  const all = AREA_CTAS.map((t) => t.replace("{area}", where));
  const fresh = all.filter((c) => !avoid.some((a) => a.trim().toLowerCase() === c.toLowerCase()));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function systemPrompt(brief: string, label: string, hasWord: boolean, area: string): string {
  return `${RYDER_TONE}

${HOUSE_RULES}

The Ryder Clinic voice above overrides any instruction to be funny or jokey. There is no humour at all.

You write as ${CLINIC}${area ? ` in ${area}` : ""}, a doctor led clinic, in the first person ("I", "my", "you"), never as a social media manager. The voice is composed, courteous and precise, warm and quietly emotional.

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. Maximum 12 words. Elegant, specific and sincere. It should make a woman over 35 stop and read. No puns.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, calm, informative and warm, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 110 words. A first line that holds attention. Short, composed lines. It adds something the slides do not say and closes with a question that relates to the post. Its final line is an invitation to get in touch, which is added for you, so do not write one.
- "hashtags": exactly 5, lower case, no spaces${area ? `, each joining ${area} to a beauty, skin or wellbeing theme` : ""}.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there".
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency. Never say a treatment is safe or painless. Never say it will fix or cure anything. Consultation and suitability come first.
- Never mention prescription medicines, Botox, anti-wrinkle or injectables by name, and never mention a website or a link.
- No exclamation marks. No emojis. No jokes.
- Never invent a patient, a story, a quote, a name, a qualification or a number. Speak only in general terms that a doctor could truthfully say.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/ryder/copy", async (req: Request, res: Response) => {
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
    req.log?.error({ err }, "ryder: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
