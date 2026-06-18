import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const TONE_PROMPTS: Record<string, string> = {
  "1": "Write like a no-nonsense northern woman — direct, warm, working-class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew.",
  "2": "Write like a poetic storyteller — vivid, character-led, a little wistful. Paint scenes. Use unexpected metaphors. Let the emotion sit in the detail rather than the statement.",
  "3": "Write like a funny, sharp woman in her 40s-50s who has earned the right to say what she thinks. Self-deprecating, warm, genuinely funny. Never cruel. Always honest.",
  "4": "Write like a warm medical expert who happens to also be a real human being. Authoritative but approachable. Evidence-led but never cold.",
  "5": "Write like a senior consultant — precise, elevated, confident. No colloquialisms. Premium language. The kind of practitioner that inspires complete trust.",
  "6": "Write like a confident male practitioner who takes his work seriously but doesn't take himself too seriously. Direct, clear, professionally warm, a bit of dry humour.",
};

const BASE_RULES = `
COMPLIANCE (non-negotiable, every single post)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility. Use "may help", "can improve" — not "will fix", "cures", "guaranteed".

WRITING RULES (non-negotiable)
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per post maximum.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world"
- Use contractions naturally: you're, it's, don't, we're, that's.
- British English throughout. "colour" not "color". "practitioner" not "provider". "clinic" not "office".`;

type GeneratedPost = {
  title: string;
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
};

router.post("/content-generator/generate", async (req: Request, res: Response) => {
  try {
    const {
      clinicianName,
      clinicName,
      location,
      treatments,
      tone,
      brandVoice,
      postTitles,
    } = req.body as {
      clinicianName?: string;
      clinicName?: string;
      location?: string;
      treatments?: string;
      tone?: string;
      brandVoice?: string;
      postTitles: string[];
    };

    if (!postTitles || !Array.isArray(postTitles) || postTitles.length === 0) {
      res.status(400).json({ error: "Post titles are required" });
      return;
    }

    const toneKey = String(tone ?? "1");
    const tonePrompt = TONE_PROMPTS[toneKey] ?? TONE_PROMPTS["1"];
    const voiceInstruction = brandVoice?.trim()
      ? `BRAND VOICE (overrides tone — follow this exactly, this is the client's own brand guidelines):\n${brandVoice.trim()}`
      : `TONE: ${tonePrompt}`;

    const clinicLines: string[] = [];
    if (clinicianName) clinicLines.push(`Clinician name: ${clinicianName}`);
    if (clinicName) clinicLines.push(`Clinic name: ${clinicName}`);
    if (location) clinicLines.push(`Location: ${location}`);
    if (treatments) clinicLines.push(`Treatments offered: ${treatments}`);
    const clinicContext = clinicLines.join("\n");

    const systemPrompt = `You generate carousel post content for aesthetic clinics, skin clinics, and wellness practices.

${voiceInstruction}

CLINIC CONTEXT
${clinicContext || "No specific clinic details provided."}

OUTPUT FORMAT
For each post title, return a JSON object in a "posts" array with exactly these five fields:

slide1_hook
A punchy, scroll-stopping opening hook. Max 12 words. Put the single most important word in |pipes| like this: "Nobody warned me that losing weight would take my |face| with it". Must sound like a real person speaking plainly, not a marketing line. Never start with a banned opener.

slide1_subtitle
One sentence that lands the hook. Wry or warm. Max 15 words. No em dashes.

slide2_body
3-4 sentences of story or education for this post concept. Written in the voice above. Reference the location and treatments where it feels natural — not forced. Specific over general. Plain language.

slide3_body
3-4 sentences going deeper into the topic. A turning point, a relatable observation, or a quiet truth that earns the reader's trust. Do not repeat what was said in slide2_body.

slide4_cta
A DM-keyword call to action. Use this format: "DM me the word [KEYWORD] and I'll [what they receive]". The keyword should be a single, memorable word related to the post topic. No urgency. No "NOW". Sounds like a person quietly extending an invitation, not a campaign.
${BASE_RULES}`;

    const titles = postTitles.slice(0, 60);
    const batchSize = 5;
    const allPosts: GeneratedPost[] = [];

    for (let i = 0; i < titles.length; i += batchSize) {
      const batch = titles.slice(i, i + batchSize);

      const userMessage = `Generate carousel content for these post titles:\n${batch.map((t, idx) => `${idx + 1}. ${t}`).join("\n")}\n\nReturn a JSON object with a "posts" array containing ${batch.length} objects, one per title, in order.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: 4000,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsed: { posts?: unknown[] } = {};
      try {
        parsed = JSON.parse(raw) as { posts?: unknown[] };
      } catch {
        req.log?.warn({ raw }, "content-generator: failed to parse AI JSON");
      }

      const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
      for (let j = 0; j < batch.length; j++) {
        const p = (posts[j] ?? {}) as Record<string, string>;
        allPosts.push({
          title: batch[j],
          slide1_hook: p.slide1_hook ?? "",
          slide1_subtitle: p.slide1_subtitle ?? "",
          slide2_body: p.slide2_body ?? "",
          slide3_body: p.slide3_body ?? "",
          slide4_cta: p.slide4_cta ?? "",
        });
      }
    }

    res.json({ posts: allPosts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    req.log?.error({ err }, "content-generator: generate error");
    res.status(500).json({ error: message });
  }
});

export default router;
