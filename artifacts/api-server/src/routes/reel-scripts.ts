import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const REEL_SYSTEM = `You write reel scripts for social media managers. The scripts are spoken on camera by a real person — not a voiceover, not a teleprompter-reader, but someone talking naturally to their phone.

Rules without exception:
- Hook: one sentence, maximum 12 words. It must make someone stop scrolling. Specific, concrete, a little unexpected. Not a generic question.
- Body: short talking points, each one a complete thought in 1-2 sentences. Written exactly how someone speaks — natural rhythm, contractions welcome.
- CTA: one or two sentences. Plain and direct. No "don't forget to like and subscribe". No "hit that follow button". Something a real person would actually say.
- No "today we're going to talk about" — banned.
- No "in this video" — banned.
- No "without further ado" — banned.
- No "it's no secret that" — banned.
- No "at the end of the day" — banned.
- No "game changer" or "game-changing" — banned.
- No "transformative" — banned.
- No "deep dive" or "dive in" — banned.
- No "let's get into it" — banned.
- No "here's the thing" — banned.
- No em dashes.
- No marketing buzzwords or jargon.
- Write in plain English. Active voice. Short sentences.
- For 15-second scripts: hook + 1 body point + CTA (total around 40-50 words spoken).
- For 30-second scripts: hook + 2-3 body points + CTA (total around 80-100 words spoken).
- For 60-second scripts: hook + 4-5 body points + CTA (total around 150-170 words spoken).

Output format exactly like this — no extra text before or after:
HOOK: [the hook line]
BODY:
- [point 1]
- [point 2]
CTA: [the call to action]`;

const TONE_DESCRIPTIONS: Record<string, string> = {
  relaxed: "Conversational and easy. Like chatting to a friend. No preachiness.",
  educational: "Clear and informative. Teaching something real without being dry or lecture-y.",
  motivational: "Warm and grounding. Not hype. The kind of thing that quietly makes someone feel understood.",
};

router.post("/reel-scripts/generate", async (req: Request, res: Response) => {
  try {
    const { clientName, industry, topic, tone, duration } = req.body as {
      clientName?: string;
      industry?: string;
      topic: string;
      tone: string;
      duration: string;
    };

    if (!topic || !tone || !duration) {
      res.status(400).json({ error: "Topic, tone and duration are required" });
      return;
    }

    const toneDesc = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS["relaxed"];

    const contextLines: string[] = [];
    if (clientName) contextLines.push(`Business: ${clientName}`);
    if (industry) contextLines.push(`Industry: ${industry}`);
    contextLines.push(`Topic: ${topic}`);
    contextLines.push(`Tone: ${toneDesc}`);
    contextLines.push(`Duration: ${duration} reel`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: REEL_SYSTEM },
        { role: "user", content: contextLines.join("\n") },
      ],
      temperature: 0.8,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    const hookMatch = raw.match(/^HOOK:\s*(.+?)(?=\nBODY:)/ms);
    const bodyMatch = raw.match(/BODY:\s*([\s\S]+?)(?=\nCTA:)/ms);
    const ctaMatch = raw.match(/CTA:\s*(.+?)$/ms);

    const hook = hookMatch?.[1]?.trim() ?? "";
    const bodyRaw = bodyMatch?.[1] ?? "";
    const body = bodyRaw
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter((l) => l.length > 0);
    const cta = ctaMatch?.[1]?.trim() ?? "";

    const fullScript = [hook, ...body, cta].join("\n\n");

    res.json({ hook, body, cta, fullScript, raw });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
