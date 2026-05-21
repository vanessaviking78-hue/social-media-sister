import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/video-overlay/generate-captions", async (req: Request, res: Response) => {
  try {
    const { topic, segmentCount = 4 } = req.body as { topic: string; segmentCount?: number };
    if (!topic?.trim()) {
      res.status(400).json({ error: "topic is required" });
      return;
    }
    const count = Math.min(8, Math.max(1, Number(segmentCount) || 4));
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a social media content writer. Generate exactly ${count} short, punchy text overlays for a social media video. Each should be 2-8 words max, bold and impactful — like hook lines that appear on screen. Return ONLY a JSON array of strings, nothing else. Example: ["Stop scrolling.", "This changes everything.", "Here's what no one tells you.", "You need to see this."]`,
        },
        {
          role: "user",
          content: `Topic: ${topic.trim()}\n\nGenerate ${count} short text overlays for this video.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let segments: string[];
    try {
      segments = JSON.parse(raw);
      if (!Array.isArray(segments)) throw new Error("not array");
    } catch {
      segments = raw
        .split("\n")
        .filter(Boolean)
        .map((s: string) =>
          s
            .replace(/^[-•\d.]\s*/, "")
            .replace(/^["']|["']$/g, "")
            .trim(),
        )
        .filter(Boolean);
    }
    res.json({ segments: segments.slice(0, count) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate captions";
    res.status(500).json({ error: msg });
  }
});

export default router;
