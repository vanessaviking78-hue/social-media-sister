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
  designName: string;
  idea: string;
  onImage: string;
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

THIS IS A CHRISTMAS POST, a single image that goes out in December. The image is already designed and says this:
"""
${n.onImage}
"""
Design: "${n.designName}", ${n.idea}.

WHO SHE IS TALKING TO: ${n.audience || "women aged 35 plus who want honesty, humour and nobody pushing them"}. Use the consumer psychology of women over 35: they want to feel seen, they save and share what sounds like a real person, they are tired of being sold to. Stealth sales only: warm, funny and human, so she quietly thinks of ${who} as the person she wants to book with in the new year. It is Christmas, so be festive, affable and funny, never a treatment list and never a sales pitch.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
Write the Instagram caption, max 100 words. It must ADD to the image, never repeat it word for word. The first line is a hook that lands inside 3 seconds, specific, relatable or funny, never generic and never a rhetorical question. Then short punchy lines. It ends with ONE closing question that relates to the post and is fun to answer in the comments (for example What would you ask Santa for if he was a clinician?). Never Comment WORD, never DM me, never a website.
Hashtags: exactly 5, lower case, no spaces, each one is the area (${n.area}) joined to a beauty or mums theme, for example the town or city plus beauty, mums, skincare or mummies. Every tag must contain the town or city.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If a sentence sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Never mention a website or a link. Never mention Botox, anti-wrinkle, injectables or prescription medicines. No prices, no guarantees, no results, no claims, no statistics.
- Never invent a client, a story, a quote, a name or a number. Talk in general terms I could truthfully say.
- Short punchy lines, the odd one word line, plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/xmas-posts/copy", async (req: Request, res: Response) => {
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
      designName: str(b.designName, 120),
      idea: str(b.idea, 300),
      onImage: str(b.onImage, 1200),
      asManager: /social media sister/i.test(businessName),
    };
    const profileCtx = await clientProfileContext(businessName);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + profileCtx },
        { role: "user", content: `Write the caption for the "${notes.designName}" Christmas post for ${notes.businessName}.` },
      ],
      temperature: 0.9,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No caption came back, try again");
    const j = JSON.parse(raw);
    res.json({ caption: clean(j.caption, 900), hashtags: fiveTags(j.hashtags, notes.area) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Xmas posts caption failed";
    req.log?.error({ err }, "xmas-posts: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
