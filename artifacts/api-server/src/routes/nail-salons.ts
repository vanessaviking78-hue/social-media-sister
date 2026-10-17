import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

export type NailPostKind = "personal" | "facts" | "beforeafter" | "availability" | "tweet";
const KINDS: NailPostKind[] = ["personal", "facts", "beforeafter", "availability", "tweet"];

// Suggested days for the one week run. Vanessa can move them when she schedules.
const DAY_FOR: Record<NailPostKind, string> = {
  personal: "Monday",
  facts: "Wednesday",
  availability: "Thursday",
  beforeafter: "Friday",
  tweet: "Sunday",
};

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
function fiveTags(raw: unknown, area: string, kind: NailPostKind): string[] {
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const parts = area.split(",").map((p) => slug(p)).filter(Boolean);
  const town = parts[0] || "bradford";
  const city = parts[1] || parts[0] || "bradford";
  const fallback = [
    `${town}nails`,
    `${city}nails`,
    `${city}nailtech`,
    `${town}${city}`,
    kind === "availability" ? `${city}nailappointments` : `nailsof${city}`,
    `westyorkshirenails`,
    `${city}beauty`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...fromModel, ...fallback]) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length === 5) break;
  }
  return out.map((t) => `#${t}`);
}

const BRIEFS: Record<NailPostKind, string> = {
  personal: `A PERSONAL post. A small, believable, honest moment from a nail tech's week: the kettle going cold because a set ran over, a client who laughed so hard the polish smudged, a tiny win, a wobble, a Monday feeling. Only use real details supplied in the notes; where none are supplied, keep it to universal nail tech moments that cannot be disproved (never an invented client name, result, number or quote). The aim is that her followers feel they know her.`,
  facts: `A NAIL FACTS post. Three or four genuinely fun, surprising and TRUE facts about nails, polish or nail history that she could tell a friend over a cuppa. No textbook voice, no lecture, no medical claims, no statistics or percentages you are not certain of, no brand or product claims. If you are not sure of a detail, leave it out. Make each fact short and punchy with a cheeky aside.`,
  beforeafter: `A BEFORE AND AFTER post. The photo is supplied by Millie later, so you write the caption around it plus the text that sits on the template. Never promise a result, never say "guaranteed", and never claim nails will grow, strengthen or heal. Talk about the look, the colour, the feeling when she walks out, the little gasp. Also write the template text: a "before" label line, an "after" label line and a short sweet sign off line to sit under the photos.`,
  availability: `An AVAILABILITY post. Tell people she has appointments free, using ONLY the availability details supplied in the notes (days, times, number of spaces, offers). If none are supplied, say there are a few gaps this week without naming days, prices or numbers. Stealth sales: make her followers feel the gap is a little treat they could give themselves, never pressure, no countdown or urgency language, no "limited spaces", no "book now before it's gone".`,
  tweet: `A SUNDAY TWEET post. A short, funny, screenshot worthy tweet written as Millie that girls would send to their friends and tag each other in (cosy Sunday, nail habits, the chip you refuse to fix, the colour you swore you would never wear again). It must be under 230 characters, no hashtags in the tweet itself. Then a caption to go with the tweet graphic.`,
};

const SHAPE: Record<NailPostKind, string> = {
  personal: `{ "hook": "first line, max 14 words", "caption": "max 110 words, ends with the closing question", "hashtags": ["5 tags"] }`,
  facts: `{ "hook": "first line, max 14 words", "headline": "max 6 words for the graphic", "facts": ["max 22 words", "max 22 words", "max 22 words"], "caption": "max 110 words, ends with the closing question", "hashtags": ["5 tags"] }`,
  beforeafter: `{ "hook": "first line, max 14 words", "beforeLabel": "max 4 words", "afterLabel": "max 4 words", "signOff": "max 10 words", "caption": "max 100 words, ends with the closing question", "hashtags": ["5 tags"] }`,
  availability: `{ "hook": "first line, max 14 words", "headline": "max 6 words for the graphic", "caption": "max 100 words, ends with the closing question", "hashtags": ["5 tags"] }`,
  tweet: `{ "hook": "the tweet text, max 230 characters", "caption": "max 70 words, ends with the closing question", "hashtags": ["5 tags"] }`,
};

type Notes = {
  businessName: string;
  ownerName: string;
  area: string;
  audience: string;
  brandNotes: string;
  services: string;
  offer: string;
  availability: string;
  personal: string;
  booking: string;
  replyWords: Record<string, string>;
  emojis: boolean;
};

function systemPrompt(kind: NailPostKind, n: Notes): string {
  const word = n.replyWords[kind] || "";
  return `You write one social media post for ${n.ownerName || "Millie"}, a nail technician who runs ${n.businessName}, in ${n.area}. You write as ${n.ownerName || "Millie"} herself, in the first person ("I", "my", "you"), never as a social media manager and never as "we".

WHO SHE IS TALKING TO: ${n.audience || "women aged 18 plus who love nails, cute, girly and sweet"}. Use the consumer psychology of a young, girly, social audience: they save, share and tag friends, they love a treat they feel they have earned, they want to feel seen, they follow people who feel like a mate. Cute, girly, sweet, warm, affable, funny and humanised. Fun rather than technical.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}${n.services ? `SERVICES SHE OFFERS: ${n.services}\n` : ""}${n.offer ? `CURRENT OFFER: ${n.offer}\n` : ""}${n.booking ? `HOW PEOPLE BOOK: ${n.booking}\n` : ""}
THIS POST
${BRIEFS[kind]}
${kind === "personal" && n.personal ? `What is really going on in her week (use this, only this): ${n.personal}\n` : ""}${kind === "availability" && n.availability ? `Her availability (use exactly this): ${n.availability}\n` : ""}
THE HOOK: the first line lands inside 3 seconds. It is specific, relatable or funny, never generic, and never a rhetorical question.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If a sentence sounds like a chatbot or a LinkedIn post, write what a real girl would actually say.
- Short punchy lines, the odd one word line, plain conversational words. No exclamation marks.
- ${n.emojis ? "A few cute emojis are welcome (nails, sparkles, hearts), no more than three in the whole caption." : "No emojis."}
- Never state prices, percentages or guarantees unless they were supplied above. Never invent a client, a result, a quote or a number.
- Never mention a website or a link anywhere. Get people to engage on the platform instead (comment the reply word, send a message).
- STEALTH SALES: she never says "book now". She makes the reader picture herself in the chair, feel the little lift of fresh nails, and quietly decide she wants it. The close is a strong but friendly nudge to comment the reply word so Millie can send the details.
- The caption ends with ONE question that relates to the post. The reply word sits inside that closing question or the line just before it, written as "Comment ${word || "WORD"}" with the word in capitals${word ? ` (use ${word} exactly)` : " (a fun single uppercase word that fits the post)"}.
- Do not put hashtags in the caption text. Return them separately as the "hashtags" array: exactly 5, lower case, no spaces, all based on the area (${n.area}) and the post, for example the town, the city, the nearby areas and nail related tags with the town.

Return JSON only, in exactly this shape:
${SHAPE[kind]}
Also include "replyWord": "the single uppercase reply word you used".`;
}

async function writeOne(kind: NailPostKind, n: Notes) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt(kind, n) },
      { role: "user", content: `Write the ${kind} post for ${n.businessName}.` },
    ],
    temperature: 0.9,
    max_tokens: 1200,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("No copy came back, try again");
  const j = JSON.parse(raw);

  const tweet = kind === "tweet";
  const hook = clean(j.hook, tweet ? 240 : 140);
  let caption = clean(j.caption, 900);
  if (!tweet && hook && !caption.toLowerCase().startsWith(hook.toLowerCase().slice(0, 24))) caption = `${hook}\n\n${caption}`;
  const replyWord = String(j.replyWord ?? n.replyWords[kind] ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
  const hashtags = fiveTags(j.hashtags, n.area, kind);

  const post: Record<string, unknown> = {
    kind,
    day: DAY_FOR[kind],
    hook,
    caption,
    replyWord,
    hashtags,
  };
  if (kind === "facts") {
    post.headline = clean(j.headline, 60);
    post.facts = (Array.isArray(j.facts) ? j.facts : []).slice(0, 4).map((f: unknown) => clean(f, 200));
  }
  if (kind === "availability") post.headline = clean(j.headline, 60);
  if (kind === "beforeafter") {
    post.beforeLabel = clean(j.beforeLabel, 40);
    post.afterLabel = clean(j.afterLabel, 40);
    post.signOff = clean(j.signOff, 80);
  }
  return post;
}

router.post("/nail-salons/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Partial<Notes> & { only?: NailPostKind; replyWords?: Record<string, string> };
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const businessName = str(b.businessName, 80);
    if (!businessName) {
      res.status(400).json({ error: "Pick a client first" });
      return;
    }
    const notes: Notes = {
      businessName,
      ownerName: str(b.ownerName, 40) || "Millie",
      area: str(b.area, 80) || "Wyke, Bradford",
      audience: str(b.audience, 200),
      brandNotes: str(b.brandNotes, 600),
      services: str(b.services, 300),
      offer: str(b.offer, 300),
      availability: str(b.availability, 300),
      personal: str(b.personal, 400),
      booking: str(b.booking, 120),
      replyWords: Object.fromEntries(
        Object.entries(b.replyWords ?? {}).map(([k, v]) => [k, String(v ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16)]),
      ),
      emojis: Boolean(b.emojis),
    };

    const kinds = b.only && KINDS.includes(b.only) ? [b.only] : KINDS;
    const posts = await Promise.all(kinds.map((k) => writeOne(k, notes)));
    res.json({ posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Nail Salons copy failed";
    req.log?.error({ err }, "nail-salons: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
