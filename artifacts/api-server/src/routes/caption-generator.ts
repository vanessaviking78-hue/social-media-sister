import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const CAPTION_TONE_PROMPTS: Record<string, string> = {
  "1": "Write like a no-nonsense northern woman — direct, warm, working-class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew.",
  "2": "Write like a poetic storyteller — vivid, character-led, a little wistful. Paint scenes. Use unexpected metaphors. Let the emotion sit in the detail rather than the statement.",
  "3": "Write like a funny, sharp woman in her 40s-50s who has earned the right to say what she thinks. Self-deprecating, warm, genuinely funny. Never cruel. Always honest.",
  "4": "Write like a warm medical expert who happens to also be a real human being. Authoritative but approachable. Evidence-led but never cold.",
};

export const BASE_RULES = `
COMPLIANCE (non-negotiable, every single caption)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility. Use "may help", "can improve", not "will fix", "cures", "guaranteed".

WRITING RULES (non-negotiable)
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per caption maximum.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world"
- Use contractions naturally: you're, it's, don't, we're, that's.
- British English throughout. "colour" not "color". "practitioner" not "provider". "clinic" not "office".
- Write in first person, as the clinician/owner posting this themselves.
- 3 to 6 sentences. No hashtags. No emojis unless the context clearly calls for one, and never more than one.`;

router.post("/caption-generator/generate", async (req: Request, res: Response) => {
  try {
    const { tone, context, clinicName } = req.body as {
      tone?: string;
      context?: string;
      clinicName?: string;
    };

    if (!context || !context.trim()) {
      res.status(400).json({ error: "Context is required" });
      return;
    }

    const toneKey = String(tone ?? "2");
    const tonePrompt = CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["2"];

    const systemPrompt = `You write a single Instagram/Facebook caption for an aesthetics clinic post.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}

Write one caption for the post described below. Return plain text only, no JSON, no quote marks around it, no title.
${BASE_RULES}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Write the caption for this post:\n${context.trim()}` },
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!caption) {
      res.status(500).json({ error: "No caption returned" });
      return;
    }

    res.json({ caption });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Caption generation failed";
    req.log?.error({ err }, "caption-generator: generate error");
    res.status(500).json({ error: message });
  }
});

router.post("/caption-generator/from-image", async (req: Request, res: Response) => {
  try {
    const { tone, imageUrl, clinicName } = req.body as {
      tone?: string;
      imageUrl?: string;
      clinicName?: string;
    };

    if (!imageUrl || !imageUrl.trim()) {
      res.status(400).json({ error: "imageUrl is required" });
      return;
    }

    const toneKey = String(tone ?? "2");
    const tonePrompt = CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["2"];

    const systemPrompt = `You write a single Instagram/Facebook caption for an aesthetics clinic post. You will be shown an image, which may be a branded quote card, a photo, or a graphic with text on it. First read any words in the image carefully. If it is a quote card, base the caption on that quote, do not just repeat it verbatim, write a caption that captures its meaning in your own words unless the quote itself is short enough to use directly.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}

Write one caption for this image. Return plain text only, no JSON, no quote marks around it, no title.
${BASE_RULES}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Write the caption for this image." },
            { type: "image_url", image_url: { url: imageUrl } },
          ] as any,
        },
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!caption) {
      res.status(500).json({ error: "No caption returned" });
      return;
    }
    res.json({ caption });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Caption generation failed";
    req.log?.error({ err }, "caption-generator: from-image error");
    res.status(500).json({ error: message });
  }
});

export default router;
