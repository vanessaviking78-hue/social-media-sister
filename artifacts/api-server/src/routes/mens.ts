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

// Exactly five area based hashtags, always, whatever the model sent back.
function fiveTags(raw: unknown, area: string): string[] {
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const parts = area.split(",").map((p) => slug(p)).filter(Boolean);
  const town = parts[0] || "";
  const city = parts[1] || parts[0] || "";
  const related = fromModel.filter((t) => (town && t.includes(town)) || (city && t.includes(city)));
  const fallback = [`${town}aesthetics`, `${city}aesthetics`, `${town}clinic`, `${city}skincare`, `${city}consultation`, `${town}${city}`, `${city}beauty`];
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
  businessName: string; ownerName: string; role: string; area: string; audience: string; brandNotes: string; topic: string; slides: string; asManager: boolean;
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

THIS IS A MEN'S POST, an eight slide carousel for the men's section that goes out about every 20 days. The slides are already designed. Topic: ${n.topic}. It is warm, funny and straight talking, it makes men feel they are allowed to ask questions, and it is just as shareable by the women who tag their husbands, brothers and dads. Honest, consultation first, never a hard sell.

WHAT THE SLIDES SAY:
${n.slides}

WHO IS READING: ${n.audience || "women aged 35 plus who are curious but wary, and the men in their lives"}. Stealth sales only.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
Return these keys:
- "caption": the Instagram caption, max 120 words, told as a short story from my point of view in my consulting room. First line is a hook that lands inside 3 seconds, specific and relatable or funny, never a rhetorical question. Short punchy lines. It adds something the slides do not say. It MUST end with one engaging question on its own final line that is easy to answer in the comments.
- "hashtags": exactly 5, lower case, no spaces, based on the area (${n.area}).

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". Write what a real person would say.
- Compliance: no promises, guarantees, results, before and after claims, statistics, prices, offers or urgency. Never say a treatment is safe, painless or risk free. Consultation and suitability first. Prescription medicines are never named.
- Never mention Botox, anti-wrinkle or injectables. Never mention a website or a link.
- Never invent a client, a story about a named person, a quote, or a number. Speak about how I work in general terms I could truthfully say.
- Short punchy lines, plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/mens/copy", async (req: Request, res: Response) => {
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
      topic: str(b.topic, 300) || "men and aesthetics",
      slides: str(b.slides, 3000),
      asManager: /social media sister/i.test(businessName),
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + (await clientProfileContext(notes.businessName)) },
        { role: "user", content: `Write the mens post for ${notes.businessName}.` },
      ],
      temperature: 0.95,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);
    res.json({ caption: clean(j.caption, 900), hashtags: fiveTags(j.hashtags, notes.area) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Mens post copy failed";
    req.log?.error({ err }, "mens: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
