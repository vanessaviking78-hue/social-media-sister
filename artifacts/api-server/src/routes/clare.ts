import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";
import { finalCta, isFinalCta } from "../lib/hookBank";

// CLARE CONNOLLY AESTHETICS, Wakefield. Her own page, one carousel at a time.
const router: IRouter = Router();

const CLINIC = "Clare Connolly Aesthetics";
const PROFILE_NAME = "clare connolly";
const AREA = "Wakefield";

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

// Exactly five hashtags, all Wakefield joined to a beauty, skin or midlife theme.
function fiveTags(raw: unknown, area: string = AREA): string[] {
  const town = slug(area) || slug(AREA);
  const themed = (t: string) => /(beauty|mum|mam|mummy|mummies|mother|skin|glow|aesthetic|facial|selfcare|wellness|fit|menopause|over40)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = fromModel.filter((t) => t.includes(town) && themed(t));
  const fallback = [`${town}beauty`, `${town}aesthetics`, `${town}skincare`, `${town}mums`, `${town}selfcare`, `${town}glow`, `${town}skin`];
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

function systemPrompt(brief: string, label: string, hasWord: boolean, glp1: boolean, clinic: string = CLINIC, area: string = AREA, own = true, fixedHook = "", feral = false, offers = false): string {
  return `${HOUSE_VOICE}

${HOUSE_RULES}

The house voice above is the voice for everything you write, with the client's own answers further down setting the personality.

${feral ? `You write as Vanessa Wormald of Social Media Sister, a UK social media strategist for the aesthetics industry with 7 years in aesthetics and 20 in social media, in the first person ("I", "my", "you"), never as a clinician. You are talking to aesthetic clinic owners and injectors. The voice is FERAL: blunt, savage, sarcastic and properly funny, but always affable and on their side, like a sister telling them what nobody else will. Real, honest and a bit unhinged in the best way, never cruel to the reader and never about a patient. Strong, confident opinions about what works on social media for clinics. The final slide and the caption carry a strong, stealth-sales friendly call to action that makes a clinic owner want to work with me.` : own ? `You write as Clare Connolly, an aesthetic nurse who runs ${clinic} in ${area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we". She is honest, realistic, friendly and hard working. Clients adore that she manages expectations, never recommends anything for the sake of it, and gives welcoming, thorough advice. Her clients are women of around 40 to 50, often in perimenopause, career women juggling life, work and kids who like to look after themselves. Their biggest worry is looking done, so natural, lifting and regenerative is how she describes her work. Her own life includes the gym, yoga, football, food, cooking, reading and holidays, which may be used lightly in posts about her own life or fitness, never invented into a story. Never assume the reader has children unless the brief says so. Do not use any stock prop jokes.` : `You write as the clinician who runs ${clinic} in ${area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we". Her own personality and how she talks come from the client's own answers further down, so follow those, and where there are none keep it warm, honest, realistic and a little funny. Her clients are women over 35 who want to look like themselves. Never assume the reader has children unless the brief says so. Do not use any stock prop jokes.`}

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. ${fixedHook ? `It is already written, return it EXACTLY as given: ${fixedHook}` : "Maximum 12 words."} It must stop a woman over 35 scrolling. Specific, relatable or funny, never generic.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, friendly but informative, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 110 words. First line is a hook that lands inside 3 seconds. Short punchy lines. It adds something the slides do not say. At least one genuinely funny line, dry and warm. ${hasWord ? "Its final line must be the comment line, which is added for you, so do not write it." : "Its final line must be a closing engagement line, which is added for you, so do not write it."}
- "hashtags": exactly 5, lower case, no spaces, each one joins ${area} to a beauty, skin or midlife theme. Every tag contains ${slug(area)}.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If it sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Compliance: ${offers ? "no guarantees, no income or results promises and no medical claims. The offers, facts and numbers given in the brief may be used, nothing else: never invent a price, discount, client, statistic or date. Urgency is allowed because this is a real one day sale." : "no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency."} Never say a treatment is safe, painless or risk free. Never say it will fix or cure anything. Keep consultation and suitability first.
- Never mention Botox, anti-wrinkle, wrinkles, lines, injectables, injections or jabs, and never mention a website or a link.${glp1 ? `
- THIS POST ONLY PROMOTES A CONSULTATION WITH ME. Never say what the consultation is for, never say what I would suggest or what could be done, never mention benefits, results, treatments, weight loss, volume loss, face changes, medicines, drugs or GLP-1. Do not describe any treatment. Only invite her warmly, and with humour, to book a consultation. The reader should finish knowing only that I would love to see her.` : `
- Never name any medication or drug of any kind.`}- No swearing. No exclamation marks. No emojis.
- Never invent a client, a story, a quote, a name, a qualification, a year or a number. Talk about how I work in general terms I could truthfully say.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/clare/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 120);
    const word = str(b.word, 40);
    const note = str(b.note, 300);
    const fixedHook = str(b.fixedHook, 300);
    const feral = b.feral === true;
    const offers = feral && b.offers === true;
    const who = str(b.clientName, 120);
    const area = str(b.area, 60) || AREA;
    const own = !who || /clare/i.test(who);
    const clinic = own ? CLINIC : who;
    const glp1 = /glp/i.test(label) || /glp-?1/i.test(brief);
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post type first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(brief, label, !!word, glp1, clinic, area, own, fixedHook, feral, offers) + (feral ? "" : await clientProfileContext(own ? PROFILE_NAME : who)) },
        { role: "user", content: `Write the carousel "${label}" for ${clinic}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = feral ? (word && word.toUpperCase() !== "SISTER" ? `Comment ${word.toUpperCase().replace(/[^A-Z0-9]/g, "")} and I will send you the details` : "Comment SISTER and I will show you how I would run your socials") : finalCta(word);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isFinalCta(l))
      .join("\n");
    res.json({
      hook: fixedHook || clean(j.hook, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: `${body}\n\n${cta}.`,
      hashtags: fiveTags(j.hashtags, area),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "clare: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
