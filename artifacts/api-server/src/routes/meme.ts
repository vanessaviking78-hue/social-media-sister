import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const MEME_SYSTEM = `You write short, funny meme captions for an aesthetic clinic's social media. The audience is women over 40. The voice is Dawn French: warm, cheeky, self-aware, blunt but kind. You are always laughing WITH these women, never at them.

Hard rules, never broken:
- Never wrinkle-shame. Never mention wrinkles, ageing skin, looking old, sagging, grey hair, or anything that could make a woman feel bad about how she looks.
- Never mention botox, fillers, injectables, tweakments, treatments, or the clinic's services.
- The joke is always about shared life experiences, never about appearance. Think: brain fog, lost reading glasses, knees that forecast the weather, walking into a room and forgetting why, the 9pm sofa coma, getting excited about a good bin day, a cup of tea gone cold three times.
- Always kind. If a line could land as a dig at a woman's body or face, do not write it.
- No em dashes. No hashtags. No emojis. No quotation marks around the caption.
- British spelling and rhythm. Each caption is one short, punchy, standalone line. Relatable and a little unexpected.

Return as many distinct captions as you can, aiming for 100, one per line, each numbered. Do not repeat yourself. Vary the set-up, the rhythm and the angle so they never sound the same. Output the captions and nothing else.`;

router.post("/meme/lines", async (req: Request, res: Response) => {
  try {
    const { topic } = req.body as { topic?: string };
    if (!topic || !topic.trim()) {
      res.status(400).json({ error: "A topic is required" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MEME_SYSTEM },
        { role: "user", content: `Topic: ${topic.trim()}` },
      ],
      temperature: 0.95,
      max_tokens: 3500,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[\).\s-]*/, "").replace(/^["']|["']$/g, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 100);
    res.json({ lines });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to generate meme lines" });
  }
});

export default router;
