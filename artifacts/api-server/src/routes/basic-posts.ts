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

type Field = { key: string; label: string; words: number };

type Notes = {
  businessName: string;
  ownerName: string;
  role: string;
  area: string;
  audience: string;
  brandNotes: string;
  coverName: string;
  coverIdea: string;
  cover: Record<string, string>;
  fields: Field[];
  writeCover: boolean;
  asManager: boolean;
};

function systemPrompt(n: Notes): string {
  const who = n.ownerName || "the owner";
  const voice = n.asManager
    ? `You write as a social media manager for the aesthetics industry (never as a clinician), in the first person.`
    : `You write as ${who} themselves, the ${n.role || "owner"} of ${n.businessName} in ${n.area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we".`;
  const coverBlock = n.writeCover
    ? `WRITE THE COVER TOO. The cover is a designed slide with these text boxes. Fill every one, keeping to the word limits, so it reads as a punchy, warm cover that makes a woman stop scrolling:\n${n.fields
        .map((f) => `- "${f.key}": ${f.label} (max ${f.words} words)`)
        .join("\n")}\nKeep the same idea as the current cover (${n.coverIdea}). Use the real names where it is natural: ${who}, ${n.businessName}, ${n.area}.`
    : `THE COVER IS ALREADY DESIGNED. Do not rewrite it. This is the cover text the reader sees on slide 1:\n${n.fields.map((f) => `- ${f.label}: ${n.cover[f.key] ?? ""}`).join("\n")}`;

  return `${HOUSE_VOICE}

${HOUSE_RULES}
${isDental(n.businessName) ? `\n${DENTAL_RULES}\n` : ""}${isAcademy(n.businessName) ? `\n${ACADEMY_RULES}\n` : ""}
The house voice above is the voice for everything you write.

${voice}

THIS IS A BASIC POST, a three slide carousel that goes out every other Wednesday for every client. Its job is trust. It tells a woman who has never booked who ${who} is, how they work and what it feels like to walk in. It is evergreen, personal and warm, never a list of treatments and never a sales pitch.
Cover idea: "${n.coverName}", ${n.coverIdea}.

WHO SHE IS TALKING TO: ${n.audience || "women aged 35 plus who are curious but wary, who want honesty, time to ask questions and nobody pushing them"}. Use the consumer psychology of women over 35: they want to feel seen and safe, they save and share what sounds like a real person, they are tired of being sold to, and they trust the person who tells them the truth. Stealth sales only: make her picture herself in the consultation chair, relaxed, listened to, and quietly decide she wants to say hello.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
${coverBlock}

SLIDES 2 AND 3 sit over a full bleed photo, so they must be short enough to read in a few seconds.
- "slide2": continues straight on from the cover. It picks up the idea the cover started and goes one level deeper, with a small, believable, specific detail from the treatment room or consultation chair, said in plain words. 28 to 40 words.
- "slide3": lands the point with warmth and a little humour, so she feels she already knows ${who}. 24 to 36 words.
- "cta": ONE short question for the last slide that is easy and fun to answer in a few words in the comments, relating to the post (for example What would you ask me if you were not worried about sounding silly?). Max 16 words. Never Comment WORD, never DM me, never a website.
- "caption": the Instagram caption, max 110 words. The first line is a hook that lands inside 3 seconds, specific and relatable or funny, never generic and never a rhetorical question. Then short punchy lines. It adds something the slides do not already say. It ends with ONE closing question relating to the post (it can be the cta question or a close cousin of it).
- "hashtags": exactly 5, lower case, no spaces, each one is the area (${n.area}) joined to a beauty or mums theme, for example the town or city plus beauty, mums, skincare or mummies. Every tag must contain the town or city.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If a sentence sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Never mention a website or a link. Never mention Botox, anti-wrinkle, injectables or prescription medicines. No prices, no guarantees, no results, no claims, no statistics.
- Never invent a client, a story, a quote, a name or a number. Talk about how I work in general terms I could truthfully say.
- Short punchy lines, the odd one word line, plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ ${n.writeCover ? `"cover": { ${n.fields.map((f) => `"${f.key}": "..."`).join(", ")} }, ` : ""}"slide2": "...", "slide3": "...", "cta": "...", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/basic-posts/copy", async (req: Request, res: Response) => {
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
    const fields: Field[] = (Array.isArray(b.fields) ? b.fields : [])
      .slice(0, 14)
      .map((f) => {
        const r = f as Record<string, unknown>;
        return { key: str(r.key, 20).replace(/[^a-zA-Z0-9]/g, ""), label: str(r.label, 60), words: Math.max(1, Math.min(40, Number(r.words) || 12)) };
      })
      .filter((f) => f.key);
    const coverIn = (b.cover && typeof b.cover === "object" ? b.cover : {}) as Record<string, unknown>;
    const notes: Notes = {
      businessName,
      ownerName: str(b.ownerName, 40),
      role: str(b.role, 60),
      area: str(b.area, 80),
      audience: str(b.audience, 200),
      brandNotes: str(b.brandNotes, 600),
      coverName: str(b.coverName, 60),
      coverIdea: str(b.coverIdea, 200),
      cover: Object.fromEntries(fields.map((f) => [f.key, str(coverIn[f.key], 200)])),
      fields,
      writeCover: Boolean(b.writeCover) && fields.length > 0,
      asManager: /social media sister/i.test(businessName),
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + (await clientProfileContext(notes.businessName)) },
        { role: "user", content: `Write the ${notes.coverName} BASIC post for ${notes.businessName}.` },
      ],
      temperature: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const out: Record<string, unknown> = {
      slide2: clean(j.slide2, 320),
      slide3: clean(j.slide3, 280),
      cta: clean(j.cta, 140),
      caption: clean(j.caption, 900),
      hashtags: fiveTags(j.hashtags, notes.area),
    };
    if (notes.writeCover && j.cover && typeof j.cover === "object") {
      out.cover = Object.fromEntries(notes.fields.map((f) => [f.key, clean((j.cover as Record<string, unknown>)[f.key], 220)]));
    }
    res.json(out);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "BASIC posts copy failed";
    req.log?.error({ err }, "basic-posts: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
