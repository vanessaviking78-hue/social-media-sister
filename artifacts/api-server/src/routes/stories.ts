import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const QUESTIONS_SYSTEM = `You write Instagram Story engagement questions for aesthetic and beauty clinics.

Audience: women aged 35 and over. They are confident, self-aware, and a little tired of being talked down to. They respond to warmth, honesty, and a bit of cheek. Think Dawn French energy — human, inclusive, gently funny, never preachy.

Rules without exception:
- Write exactly 10 questions. No more, no less.
- Each question must stand alone as a single sentence. No sub-questions.
- Topics: skin, beauty treatments, self-care, confidence, ageing well, life at 35+.
- Tone: warm, curious, a tiny bit cheeky. Like a brilliant friend who also happens to be a skin expert.
- Never clinical. Never salesy. No product pitches, no "book now" energy.
- No rhetorical questions that answer themselves.
- No em dashes. No dashes of any kind used as a pause or parenthetical.
- No "ladies". No "queens". No "gorgeous". No "babes".
- Do not start two questions the same way.
- Keep each question under 12 words wherever possible.

Good examples (this tone, not these exact questions):
- What's the one thing you'd change about your skin right now?
- When did you last do something just for you?
- What does confidence look like to you at this stage of life?
- If you could go back and tell your 25-year-old self one thing about skincare, what would it be?

Output format: one question per line, numbered 1 to 10. Nothing else before or after.`;

router.post("/stories/generate-questions", async (req: Request, res: Response) => {
  try {
    const { clientName } = req.body as { clientName?: string };

    const userMessage = clientName
      ? `Generate 10 engagement questions for ${clientName}.`
      : "Generate 10 engagement questions for a beauty and aesthetics clinic.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: QUESTIONS_SYSTEM },
        { role: "user", content: userMessage },
      ],
      temperature: 0.9,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    const questions = raw
      .split("\n")
      .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 10);

    if (!questions.length) {
      res.status(500).json({ error: "No questions generated" });
      return;
    }

    res.json({ questions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
