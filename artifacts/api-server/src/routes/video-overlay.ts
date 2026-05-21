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
          content: `You are a social media content writer. Generate exactly ${count} text overlays for a social media video. The first ${count - 1} should be punchy hook/body lines, each 5-12 words, bold and impactful, like captions that appear on screen one at a time. The final overlay (overlay #${count}) MUST be a clear call-to-action, e.g. "Book your consultation! Link in bio." or "DM us INFO to get started today!" or "Click the link in bio to book now!". NEVER use em dashes (the character —). Use a period, exclamation mark, or just a space instead. Return ONLY a JSON array of strings, nothing else. Example for 4 overlays: ["Here is what your clinic is missing on Instagram.", "Patients are searching for you. Are you showing up?", "3 content types that actually drive bookings.", "DM us CLINIC and we will show you exactly what to post!"]`,
        },
        {
          role: "user",
          content: `Topic: ${topic.trim()}\n\nGenerate ${count} text overlays for this video. Remember: first ${count - 1} are punchy hooks/points (5-12 words each), and the last one is a strong CTA.`,
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
      segments = segments.map((s) => String(s).replace(/—/g, "-").trim()).filter(Boolean);
    } catch {
      segments = raw
        .split("\n")
        .filter(Boolean)
        .map((s: string) =>
          s
            .replace(/^[-•\d.]\s*/, "")
            .replace(/^["']|["']$/g, "")
            .replace(/^```.*$/, "")
            .replace(/—/g, "-")
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
