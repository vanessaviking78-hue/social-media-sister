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
      model: "gpt-5.2",
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

    const content = completion.choices[0]?.message?.content;
    req.log.info({ model: "gpt-5.2", finishReason: completion.choices[0]?.finish_reason, contentLength: content?.length ?? 0 }, "video overlay generation response");

    if (!content?.trim()) {
      res.status(500).json({ error: "AI returned no content — please try again" });
      return;
    }

    const raw = content.trim();
    let segments: string[];
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      segments = JSON.parse(cleaned);
      if (!Array.isArray(segments)) throw new Error("not array");
      segments = segments.map((s) => String(s).trim()).filter(Boolean);
    } catch {
      segments = raw
        .split("\n")
        .filter(Boolean)
        .map((s: string) =>
          s
            .replace(/^[-•\d.]\s*/, "")
            .replace(/^["']|["']$/g, "")
            .replace(/^```.*$/, "")
            .trim(),
        )
        .filter((s) => s.length > 0 && !s.startsWith("```"));
    }

    res.json({ segments: segments.slice(0, count) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate captions";
    res.status(500).json({ error: msg });
  }
});

export default router;
