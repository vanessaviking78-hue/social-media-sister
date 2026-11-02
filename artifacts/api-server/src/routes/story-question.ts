import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";

const router: IRouter = Router();

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

// One fun question for the story that goes out five minutes before a post. The story says "Answer below", so it
// has to be easy to answer in a word or two in the replies.
router.post("/story-question/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const post = str(b.post, 900);
    const topic = str(b.topic, 120);
    const businessName = str(b.businessName, 80);
    const who = /social media sister/i.test(businessName) ? "a social media manager for the aesthetics industry" : "the owner of the clinic";
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${HOUSE_VOICE}

${HOUSE_RULES}

You write for ${who}, in the first person. Write ONE fun, friendly question for an Instagram story that goes out five minutes before a post. The story shows the question with the words "Answer below", so it must be easy and fun to answer in a word or two in the replies. It relates to the post but never gives the post away. Warm, a little daft, aimed at women over 35. Max 14 words. Never mention a website, a price, a result or a prescription medicine. No emojis, no exclamation marks, no dashes, British English, never negative parallelism, no AI patter.

Return JSON only: { "question": "..." }`,
        },
        { role: "user", content: `The post is about: ${topic || "something relatable for women over 35"}.\nWhat the post says:\n${post}` },
      ],
      temperature: 0.95,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });
    const j = JSON.parse(completion.choices[0]?.message?.content?.trim() || "{}");
    const question = clean(j.question, 140);
    if (!question) throw new Error("No question came back, try again");
    res.json({ question });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Story question failed";
    req.log?.error({ err }, "story-question: error");
    res.status(500).json({ error: message });
  }
});

export default router;
