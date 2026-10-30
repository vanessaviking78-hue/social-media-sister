import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES, DENTAL_RULES, isDental, ACADEMY_RULES, isAcademy } from "../lib/houseRules";
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
  treatment: string;
  headline: string;
  bullets: string[];
  callout: string;
  asManager: boolean;
};

function systemPrompt(n: Notes): string {
  const who = n.ownerName || "the owner";
  const voice = n.asManager
    ? `You write as a social media manager for the aesthetics industry (never as a clinician), in the first person.`
    : `You write as ${who} themselves, the ${n.role || "owner"} of ${n.businessName} in ${n.area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we".`;

  return `${HOUSE_VOICE}

${HOUSE_RULES}
${isDental(n.businessName) ? `\n${DENTAL_RULES}\n` : ""}${isAcademy(n.businessName) ? `\n${ACADEMY_RULES}\n` : ""}
The house voice above is the voice for everything you write.

${voice}

THIS IS A TREATMENT POST, a five slide carousel that goes out every other Wednesday. The cover is already designed and is a playful, tongue in cheek "Possible side effects may include..." list about ${n.treatment}. Slides 2 to 5 sit over full bleed photos, so every slide must be short enough to read in a few seconds. Its job is to make a woman smile, feel safe and quietly decide a consultation with ${who} is a good idea. It is honest, consultation first and never a hard sell.

THE COVER SHE HAS JUST SEEN:
Headline: ${n.headline}
${n.bullets.map((b) => `- ${b}`).join("\n")}${n.callout ? `\nExtra note on the cover: ${n.callout}` : ""}

WHO SHE IS TALKING TO: ${n.audience || "women aged 35 plus who are curious but wary, who want honesty, time to ask questions and nobody pushing them"}. Use the consumer psychology of women over 35: they want to feel seen and safe, they save and share what sounds like a real person, they are tired of being sold to, and they trust the person who tells them the truth. Stealth sales only.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
THE SLIDES (each carries on from the one before, same playful voice as the cover, with a believable specific detail from the consultation room, in plain words):
- "slide2": the honest bit the cover does not say. What really happens first: the conversation, looking at her whole face, time to ask questions, and that I may suggest a different plan or say not today. 26 to 38 words.
- "slide3": who this treatment can suit and who it may not, said warmly with a little humour. No promises. 24 to 36 words.
- "slide4": what to ask any practitioner before booking (training, how they handle the unexpected, how long the consultation is), framed as questions she is allowed to ask me. 24 to 36 words.
- "slide5": the landing. Warm, a touch funny, invites a conversation with no pressure. 14 to 24 words.
- "cta": ONE short fun question for the last slide that is easy to answer in a few words in the comments, relating to the post (for example Which side effect have you already got?). Max 14 words. Never Comment WORD, never DM me, never a website.
- "caption": the Instagram caption, max 110 words. First line is a hook that lands inside 3 seconds, specific and relatable or funny, never generic and never a rhetorical question. Then short punchy lines. It adds something the slides do not say. It MUST end with this exact final line on its own: Drop me a DM to see if you're a good fit for this
- "hashtags": exactly 5, lower case, no spaces, each one is the area (${n.area}) joined to a beauty or mums theme, for example the town or city plus beauty, mums, skincare or mummies. Every tag must contain the town or city.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If a sentence sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, no prices, no offers, no urgency. Never say a treatment is safe, painless or risk free. Never say it will change or fix anything. Always keep consultation and suitability first. Prescription medicines are never named.
- You may use the word filler only as the treatment name on this post. Never mention Botox, anti-wrinkle or injectables. Never mention a website or a link.
- Never invent a client, a story, a quote, a name or a number. Talk about how I work in general terms I could truthfully say.
- Short punchy lines, the odd one word line, plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ "slide2": "...", "slide3": "...", "slide4": "...", "slide5": "...", "cta": "...", "caption": "...", "hashtags": ["5 tags"] }`;
}

const CLOSE = "Drop me a DM to see if you're a good fit for this";

router.post("/treatments/copy", async (req: Request, res: Response) => {
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
      treatment: str(b.treatment, 80) || "a treatment",
      headline: str(b.headline, 160),
      bullets: (Array.isArray(b.bullets) ? b.bullets : []).slice(0, 4).map((x) => str(x, 200)).filter(Boolean),
      callout: str(b.callout, 240),
      asManager: /social media sister/i.test(businessName),
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + (await clientProfileContext(notes.businessName)) },
        { role: "user", content: `Write the ${notes.treatment} TREATMENT post for ${notes.businessName}.` },
      ],
      temperature: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    let caption = clean(j.caption, 900);
    const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || lines[lines.length - 1].replace(/\.$/, "").toLowerCase() !== CLOSE.toLowerCase()) {
      caption = `${lines.filter((l) => l.replace(/\.$/, "").toLowerCase() !== CLOSE.toLowerCase()).join("\n")}\n\n${CLOSE}`;
    } else {
      caption = `${lines.slice(0, -1).join("\n")}\n\n${CLOSE}`;
    }
    res.json({
      slide2: clean(j.slide2, 320),
      slide3: clean(j.slide3, 280),
      slide4: clean(j.slide4, 280),
      slide5: clean(j.slide5, 200),
      cta: clean(j.cta, 120),
      caption,
      hashtags: fiveTags(j.hashtags, notes.area),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Treatment posts copy failed";
    req.log?.error({ err }, "treatments: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
