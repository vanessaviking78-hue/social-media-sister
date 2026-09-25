import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

export const CAPTION_TONE_PROMPTS: Record<string, string> = {
  "1": "Write like a no-nonsense northern woman — direct, warm, working-class honest. Plain words. Real talk. No fluff, no poetry, no corporate speak. Like talking to your best mate over a brew.",
  "2": "Write like a poetic storyteller — vivid, character-led, a little wistful. Paint scenes. Use unexpected metaphors. Let the emotion sit in the detail rather than the statement.",
  "3": "Write like a funny, sharp woman in her 40s-50s who has earned the right to say what she thinks. Self-deprecating, warm, genuinely funny. Never cruel. Always honest.",
  "4": "Write like a warm medical expert who happens to also be a real human being. Authoritative but approachable. Evidence-led but never cold.",
  "5": "Write in a feral, savage, sarcastic voice. Dry, blunt, a bit unhinged, laughing at the industry not at the patient. Short punchy sentences. Never cruel to patients, always on the side of proper, qualified care.",
};

export const BASE_RULES = `
COMPLIANCE (non-negotiable, every single caption)
- NEVER name Botox, or any prescription-only medicine by name. NEVER use the phrase "anti-wrinkle" in any form either, that's an efficacy claim in its own right, not just a naming issue. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility. Use "may help", "can improve", not "will fix", "cures", "guaranteed".

WRITING RULES (non-negotiable)
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per caption maximum.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, boasts, nestled, seamless, effortless, next level, top-tier, being honest, the truth is, at the end of the day, when it comes to, look no further, say goodbye to, buckle up, spoiler alert, trust me, make no mistake
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world", "In a world where", "In the ever-changing landscape"
- Use contractions naturally: you're, it's, don't, we're, that's.
- British English throughout. "colour" not "color". "practitioner" not "provider". "clinic" not "office".
- Write in first person, as the clinician/owner posting this themselves.
- Keep it informal and colloquial, like the clinician talking to a mate, not a brand talking to a customer. Warm, a bit cheeky where it fits, genuinely funny if the moment allows it, but it should still read like a professional said it, not like someone trying too hard to be funny.
- 3 to 6 short sentences, split into 2 to 4 short chunks of one or two sentences each, with a blank line between each chunk. Never write it as one solid block of text, captions are read broken up like that.
- No hashtags. No emojis unless the context clearly calls for one, and never more than one.
- If a sentence could have been written by a chatbot, delete it and write what you would actually say instead.
- Do not use the construction where it is not about X, it is about Y, or any rule of three escalation that sounds like a TED talk. Do not open with a rhetorical question. Say the thing plainly, the way you would actually say it to someone face to face.`;

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

const SLIDE_RULES = `
COMPLIANCE (non-negotiable)
- NEVER name Botox or any prescription-only medicine. NEVER use "anti-wrinkle". Use "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims. No medical claims, no guaranteed results, no superlatives (best, number one), no pressure or urgency language.
- Frame everything as consultation and possibility: "may help", "can improve", never "will fix" or "cures".
- The call to action must be a warm, low pressure invitation (a consultation, a chat, a message), never a hard sell and never urgent.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma or a full stop.
- British English throughout. Write in first person as the clinician or owner where a person speaks.
- Sound like a real woman talking, never like a brand or a chatbot. Plain words, contractions, a little humour where it fits.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, seamless, effortless, next level, top-tier, fluff, being honest, the truth is, trust me, buckle up.
- Do not use "it is not about X, it is about Y", rule of three escalations, or rhetorical question openers on the text slides.
- No hashtags, no emojis, no exclamation marks.
- Consumer psychology: women over 35 who want to feel understood, not sold to. Evoke emotion or a wry smile. No boring medical education, make it fun and useful.

SLIDE LENGTH
- headline: 2 to 6 words, punchy.
- subtitle: 2 to 8 words that finishes or twists the headline.
- each text slide: one short sentence or two very short ones, 8 to 22 words.
- cta: 3 to 9 words, a stealth-sales invitation that fits the post.`;

router.post("/caption-generator/stylish-posts", async (req: Request, res: Response) => {
  try {
    const { tone, clinicName, topics, brief, count, textSlides } = req.body as {
      tone?: string;
      clinicName?: string;
      topics?: string[];
      brief?: string;
      count?: number;
      textSlides?: number;
    };

    const list = Array.isArray(topics) ? topics.map(t => String(t).trim()).filter(Boolean).slice(0, 12) : [];
    const n = list.length ? list.length : Math.min(12, Math.max(1, Math.floor(Number(count) || 1)));
    if (!list.length && !(brief && brief.trim())) {
      res.status(400).json({ error: "A brief or a list of topics is required" });
      return;
    }
    const slides = Math.min(4, Math.max(1, Math.floor(Number(textSlides) || 3)));

    const toneKey = String(tone ?? "2");
    const tonePrompt = CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["2"];

    const systemPrompt = `You write the on-slide text for Instagram carousel posts for UK aesthetics and dental clinics.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}

Each post has exactly ${slides} text slide${slides === 1 ? "" : "s"} between its headline and its call to action.
Return JSON only, in this exact shape:
{"posts":[{"headline":"","subtitle":"","text":[${Array(slides).fill('""').join(",")}],"cta":""}]}
${SLIDE_RULES}`;

    const userPrompt = list.length
      ? `Write ${n} posts, one for each of these topics, in this order:\n${list.map((t, i) => `${i + 1}. ${t}`).join("\n")}${brief?.trim() ? `\n\nExtra guidance: ${brief.trim()}` : ""}`
      : `Write ${n} different posts on this brief. Give each post its own angle and its own hook so no two feel alike:\n${brief!.trim()}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const clean = (v: unknown) => String(v ?? "").replace(/[\u2013\u2014]/g, ",").trim();
    const posts: string[][] = (Array.isArray(parsed?.posts) ? parsed.posts : [])
      .map((p: any) => [
        clean(p.headline),
        clean(p.subtitle),
        ...Array.from({ length: slides }, (_, i) => clean(Array.isArray(p.text) ? p.text[i] : "")),
        clean(p.cta),
      ])
      .filter((r: string[]) => r[0]);
    if (!posts.length) {
      res.status(500).json({ error: "No posts returned" });
      return;
    }
    res.json({ posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Post writing failed";
    req.log?.error({ err }, "caption-generator: stylish-posts error");
    res.status(500).json({ error: message });
  }
});

export default router;
