import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CAPTION_TONE_PROMPTS } from "./caption-generator";
import { BANNED_TERMS, neutralise, clean } from "./client-stylish";

// One short question per post, written to sit in bold across a story that goes out on the same
// day as the post. Followers answer by replying to the story.
const router: IRouter = Router();
const bannedRe = new RegExp(BANNED_TERMS.source, "i");

type PostIn = { slides: string[] };

router.post("/stylish-story/questions", async (req, res) => {
  try {
    const { tone, posts, area, clinicName } = req.body as { tone?: string; posts?: PostIn[]; area?: string; clinicName?: string };
    if (!Array.isArray(posts) || !posts.length || posts.length > 30) { res.status(400).json({ error: "Send between 1 and 30 posts" }); return; }
    const tonePrompt = CAPTION_TONE_PROMPTS[String(tone ?? "3")] ?? CAPTION_TONE_PROMPTS["3"];
    const listing = posts
      .map((p, i) => `${i + 1}. ${neutralise((p.slides ?? []).filter(Boolean).join(" | "))}`)
      .join("\n");
    const place = String(area ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);

    const run = async (extra: string) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.95,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: `You write the bold question that sits across an Instagram story for an aesthetics clinic. Each story goes out the same morning as a feed post and is about the same thing, so followers reply to the story with their answer.

TONE: ${tonePrompt}

RULES
- One question per post, 12 words at most, easy to answer in a word or a sentence, and you want to answer it straight away.
- It must connect to the post it belongs to, but must not give the post away. It should make people curious about the post.
- Funny or emotion evoking. Everyday, relatable and a little cheeky. Never a medical education question.
- Never mention Botox, anti wrinkle, injectable prescription medicines, weight loss medicines or any brand of them. Never make a promise about results.
- Write as the clinician or clinic owner speaking, first person if a pronoun is needed. UK spelling. No em dashes or en dashes. Do not use the word fluff. No hashtags, no emojis.
- Never use the construction "it is not X, it is Y" and do not open with "Ever wondered".
- Each of the questions must be different in shape from the others.${place ? `\n- The clinic is in ${place}. In about one question in four, work the place in naturally, only if it fits.` : ""}${clinicName ? `\nClinic: ${clinicName}` : ""}
${extra}
Return JSON: {"questions": ["...", ...]} with exactly ${posts.length} questions in the same order as the posts.`,
          },
          { role: "user", content: `The posts, slide text in order:\n${listing}` },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { questions?: unknown };
      return (Array.isArray(parsed.questions) ? parsed.questions : []).map(q => clean(q).replace(/^["'“”]+|["'“”]+$/g, ""));
    };

    let questions = await run("");
    for (let attempt = 0; attempt < 2; attempt++) {
      const bad = questions.length !== posts.length || questions.some(q => !q || q.length > 110 || bannedRe.test(q));
      if (!bad) break;
      questions = await run("Your last attempt broke a rule (wrong count, too long, or banned wording). Follow every rule exactly.");
    }
    questions = questions.map(q => neutralise(q));
    if (questions.length !== posts.length) { res.status(502).json({ error: "Could not write the story questions, try again" }); return; }
    res.json({ questions });
  } catch (err) {
    req.log?.error({ err }, "stylish-story questions failed");
    res.status(500).json({ error: "Could not write the story questions" });
  }
});

export default router;
