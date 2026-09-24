import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// The five voices Vanessa writes in. The key is what the front end sends.
const STYLE_PROMPTS: Record<string, string> = {
  "1": "Northern grit, Vanessa style. A no-nonsense northern woman, direct, warm and honest, with a dry sense of humour. Plain words, short sentences, real talk, like putting the world to rights over a brew. Never posh, never corporate.",
  "2": "Storytelling with a whimsical streak, in the manner of Bruce Springsteen. Small human scenes, a specific street, a specific morning, a person you can picture. Big-hearted, a little wistful, a bit of wonder in ordinary things. Never quote or mention lyrics or songs.",
  "3": "Funny and blunt, in the manner of Dawn French. Warm, self-deprecating, quick and daft, says the quiet bit out loud and gets away with it. Never cruel, always affable.",
  "4": "Professional but with personality. Polished and credible, still clearly a real person with opinions and a sense of humour. Warm, confident, never stiff.",
  "5": "Feral, savage and sarcastic. Sharp, cheeky, wickedly dry, roasts the nonsense of the industry without ever being cruel to the reader. Still affable underneath.",
};

const RULES = `
WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Not once. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, practise, programme, organise, favourite. Never Americanisms (no "gotten", "vacation", "awesome", "y'all").
- Write in the first person, as the clinic owner speaking to her reader ("I", "my clinic", "you"). Never write "we" unless the clinic is clearly a team.
- The reader is a woman over 35. Speak to her like a friend who knows her, not a brand. Warm, funny, human.
- Humour is welcome. Keep it affable and never at the reader's expense.
- Sell softly and slyly. Never push. Let the reader work out for herself that she wants to book. No boring medical education, make it fun.
- No hashtags, no emojis, no exclamation marks.
- Use contractions naturally.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, boasts, nestled, seamless, effortless, next level, top-tier, fluff, elevate.
- BANNED patterns: "It's not about X, it's about Y", rhetorical question openers, rule of three escalations, "Most clinics don't have a X problem, they have a Y problem", "not fuss not fluff", anything that sounds like a chatbot or a LinkedIn post. If a sentence could have been written by an AI, write what a real person would actually say.
- Be specific and unusual. Avoid the phrases seen on every aesthetics clinic page.

COMPLIANCE (UK, non-negotiable)
- NEVER name Botox or any prescription-only medicine. NEVER use "anti-wrinkle". Say "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in a claim. No medical claims, no guaranteed results, no before and after promises, no superlatives (best, number one, guaranteed).
- No pressure tactics and no urgency language (no "limited spaces", "book now before it's gone").
- Frame treatment as consultation and possibility: "may help", "can improve".`;

function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[–—]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/!/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

router.post("/magazine-maker/copy", async (req: Request, res: Response) => {
  try {
    const { clinicName, topics, style, cta } = req.body as {
      clinicName?: string;
      topics?: string[];
      style?: string;
      cta?: string;
    };

    const cleanTopics = (Array.isArray(topics) ? topics : [])
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (cleanTopics.length !== 3) {
      res.status(400).json({ error: "Please give me all 3 topics" });
      return;
    }

    const stylePrompt = STYLE_PROMPTS[String(style ?? "1")] ?? STYLE_PROMPTS["1"];
    const clinic = (clinicName ?? "").trim() || "the clinic";
    const action = (cta ?? "").trim() || "Book a consultation";

    const systemPrompt = `You write the copy for a 4 page social media magazine for an aesthetics clinic, ${clinic}. It is shown as a video that turns the pages, so every piece of copy must be short enough to read in two seconds.

VOICE: ${stylePrompt}

THE PAGES
1. Cover: a headline that makes the reader want to turn the page, plus 3 cover lines, one teasing each topic.
2. Page 2: a feature on topic 1.
3. Page 3: two smaller features, on topic 2 and topic 3.
4. Call to action page: a warm, sly nudge towards this action: "${action}".

Return JSON only, in exactly this shape and within these limits:
{
  "cover": { "headline": "max 7 words", "lines": ["max 6 words", "max 6 words", "max 6 words"] },
  "page2": { "kicker": "max 3 words", "headline": "max 8 words", "intro": "max 22 words", "body": "max 55 words" },
  "page3": [
    { "kicker": "max 3 words", "headline": "max 7 words", "body": "max 35 words" },
    { "kicker": "max 3 words", "headline": "max 7 words", "body": "max 35 words" }
  ],
  "cta": { "headline": "max 8 words", "body": "max 30 words" }
}
${RULES}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Topic 1 (page 2 feature, and a cover line): ${cleanTopics[0]}\nTopic 2 (first feature on page 3, and a cover line): ${cleanTopics[1]}\nTopic 3 (second feature on page 3, and a cover line): ${cleanTopics[2]}`,
        },
      ],
      temperature: 0.9,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      res.status(500).json({ error: "No copy came back, try again" });
      return;
    }
    const j = JSON.parse(raw);

    const lines: string[] = Array.isArray(j?.cover?.lines) ? j.cover.lines : [];
    const p3: any[] = Array.isArray(j?.page3) ? j.page3 : [];
    const item = (o: any) => ({
      kicker: clean(o?.kicker, 30),
      headline: clean(o?.headline, 70),
      body: clean(o?.body, 260),
    });

    res.json({
      cover: {
        headline: clean(j?.cover?.headline, 70),
        lines: [0, 1, 2].map((i) => clean(lines[i], 60)),
      },
      page2: {
        kicker: clean(j?.page2?.kicker, 30),
        headline: clean(j?.page2?.headline, 80),
        intro: clean(j?.page2?.intro, 200),
        body: clean(j?.page2?.body, 420),
      },
      page3: [item(p3[0]), item(p3[1])],
      cta: {
        headline: clean(j?.cta?.headline, 80),
        body: clean(j?.cta?.body, 260),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Magazine copy failed";
    req.log?.error({ err }, "magazine-maker: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
