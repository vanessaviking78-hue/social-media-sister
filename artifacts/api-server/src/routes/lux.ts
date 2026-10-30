import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES, DENTAL_RULES, isDental } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";

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

// Exactly five hashtags, each the clinic's town or city joined to a beauty or mums theme, always, whatever the model sent back.
function fiveTags(raw: unknown, area: string): string[] {
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const parts = area.split(",").map((p) => slug(p)).filter(Boolean);
  const town = parts[0] || "";
  const city = parts[1] || parts[0] || "";
  const themed = (t: string) => /(beauty|mum|mam|mummy|mummies|mother|skin|glow|aesthetic|facial|selfcare)/.test(t);
  const related = fromModel.filter((t) => ((town && t.includes(town)) || (city && t.includes(city))) && themed(t));
  const fallback = [`${town}beauty`, `${town}mums`, `${city}beauty`, `${city}mums`, `${town}skincare`, `${city}skincare`, `${town}mummies`, `${town}mumlife`, `${town}selfcare`, `${town}glow`];
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

type Notes = {
  businessName: string;
  ownerName: string;
  role: string;
  area: string;
  audience: string;
  brandNotes: string;
  theme: string;
  onImage: string;
  fresh: boolean;
  asManager: boolean;
};

function systemPrompt(n: Notes): string {
  const who = n.ownerName || "the owner";
  const voice = n.asManager
    ? `You write as a social media manager for the aesthetics industry (never as a clinician), in the first person.`
    : `You write as ${who} themselves, the ${n.role || "owner"} of ${n.businessName} in ${n.area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we".`;
  return `${HOUSE_VOICE}

${HOUSE_RULES}
${isDental(n.businessName) ? `\n${DENTAL_RULES}\n` : ""}
The house voice above is the voice for everything you write.

${voice}

THIS IS A LUX CAROUSEL: ten quiet, elegant slides in a magazine style. It is the calm, honest side of aesthetics for women over 35: noticing, confidence, being in the photograph, the consultation done properly. Soft and reassuring with the odd dry line. Warm, never preachy, never a sales pitch.
THEME OF THIS CAROUSEL: ${n.theme || "feeling like yourself, honest consultations and being present in your own life"}.
${n.fresh ? `
SLIDE WORDS. Write fresh words for all ten slides on that theme. Each slide has a headline (a short sentence of 4 to 12 words, one thought, no more than two sentences) and one small line under it (max 12 words). Slide 1 opens with a gentle question or observation. Slide 10 asks the reader one warm question she will want to answer in the comments. Across the ten, mix the feel: some about noticing and self-image, some about the consultation being allowed to end with no treatment, some about being present in your own life. Never promise a result and never say a treatment is needed.
` : `
The slides are already written, this is what they say:
"""
${n.onImage}
"""
`}
WHO SHE IS TALKING TO: ${n.audience || "women aged 35 plus who want honesty, humour and nobody pushing them"}. Use the consumer psychology of women over 35: they want to feel seen, they save what sounds like a real person, they are tired of being sold to. Stealth sales only: she quietly thinks of ${who} as the person she wants to book a conversation with. Treatments are not the point, the woman is.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
CAPTION: max 100 words. It must ADD to the slides, never repeat them word for word. The first line is a hook that lands inside 3 seconds, specific and human, never a rhetorical question. Then short lines. It ends with ONE closing question that is easy and fun to answer in the comments. Never Comment WORD, never DM me, never a website.
Hashtags: exactly 5, lower case, no spaces, each one is the area (${n.area}) joined to a beauty or mums theme. Every tag must contain the town or city.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z", "Not X. Y.").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If a sentence sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Never mention a website or a link. Never mention Botox, anti-wrinkle, injectables or prescription medicines. No prices, no guarantees, no results, no claims, no statistics.
- Never invent a client, a story, a quote, a name or a number. Talk in general terms I could truthfully say.
- Plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ ${n.fresh ? `"slides": [ { "head": "...", "sub": "..." } ten of these, `: ""}"caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/lux/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const businessName = str(b.businessName, 80);
    if (!businessName) {
      res.status(400).json({ error: "Pick a client first" });
      return;
    }
    if (!str(b.area, 80)) {
      res.status(400).json({ error: "Add the clinic's town and city first, so every hashtag matches where they are" });
      return;
    }
    const notes: Notes = {
      businessName,
      ownerName: str(b.ownerName, 40),
      role: str(b.role, 60),
      area: str(b.area, 80),
      audience: str(b.audience, 200),
      brandNotes: str(b.brandNotes, 600),
      theme: str(b.theme, 200),
      onImage: str(b.onImage, 2000),
      fresh: b.fresh === true,
      asManager: /social media sister/i.test(businessName),
    };
    const profileCtx = await clientProfileContext(businessName);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + profileCtx },
        { role: "user", content: `Write the ${notes.fresh ? "slide words and caption" : "caption"} for the LUX carousel for ${notes.businessName}.` },
      ],
      temperature: 0.9,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("Nothing came back, try again");
    const j = JSON.parse(raw);
    const slides = notes.fresh && Array.isArray(j.slides)
      ? j.slides.slice(0, 10).map((s: Record<string, unknown>) => ({ head: clean(s?.head, 140), sub: clean(s?.sub, 90) }))
      : undefined;
    if (notes.fresh && (!slides || slides.length < 10 || slides.some((s: { head: string }) => !s.head))) throw new Error("The slide words came back incomplete, try again");
    res.json({ slides, caption: clean(j.caption, 900), hashtags: fiveTags(j.hashtags, notes.area) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "LUX copy failed";
    req.log?.error({ err }, "lux: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
