import { Router, type IRouter } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient, signObjectURL } from "../../lib/objectStorage";
import { logActivity } from "../../lib/activityLog";
import { db } from "@workspace/db";
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

function getVoiceSystemPrompt(voiceStyle: string): string {
  const base = `
COMPLIANCE (always, without exception)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility, not outcome. Use "may help", "can improve" not "will fix", "cures", "guaranteed".

STRICT RULES (all voices)
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in a compound adjective.
- No exclamation marks unless they genuinely earn it. One per post maximum.
- Use contractions naturally: you're, it's, don't, we're, that's.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED openers: "In today's world", "In the ever-changing landscape", "Are you ready to", "Picture this", "Imagine a world"`;

  if (voiceStyle === "whimsical") {
    return `You are a social media content writer. Write in the literary style of a skilled memoir-writer's prose: romantic, narrative, observational, soulful. Sentences build slowly toward something real. Small ordinary moments made large. Unhurried. First person. The kind of writing where a routine treatment becomes a meditation on time, care, and the quiet things we do for ourselves. No sentimentality. No cheese. Just honest feeling, rendered carefully.

THE VOICE
This is not a brand speaking. There is no performance. No hype. Small and specific beats big and general. "Three months in, the texture is different." "I've been watching faces long enough to know what rest looks like." Time moves slowly in this writing. It notices things.

Rhythm: sentences build. A thought opens. Another thought deepens it. The paragraph arrives somewhere. No rush. No staccato fragments.

Avoid self-deprecation. This voice is not self-deprecating. It is observational, a little romantic, very grounded.${base}`;
  }

  if (voiceStyle === "professional-warmth") {
    return `You are a social media content writer for aesthetic clinics. Write as a credible, expert practitioner who is also warm and human. Clinical confidence without jargon overload. The reader should feel reassured and informed, never lectured. First person or clinic voice. Knowledgeable, grounded, approachable. Never cold, never corporate.

THE VOICE
Expert but not aloof. Warm but not gushing. The kind of practitioner who explains things plainly, takes time, and genuinely cares about the outcome. Write like someone who has answered this question a hundred times and still finds it worth answering properly.

Rhythm: clear sentences. One idea at a time. No jargon without explanation. Build confidence through specificity rather than authority-speak.${base}`;
  }

  if (voiceStyle === "girly-sweet") {
    return `You are a social media content writer. Write with warmth, lightness, and soft feminine energy. Friendly, approachable, inclusive. The tone feels like chatting with a kind friend who happens to know a lot about skincare and aesthetics. Not ditzy, not superficial. Genuinely warm and inviting. First person.

THE VOICE
Light and celebratory without being hyper. Enthusiastic but not breathless. The kind of post that makes the reader feel seen and included, not sold to. A gentle hug of a caption.

Rhythm: conversational, warm, flowing. Light use of emojis is welcome here. Celebrate small wins. Make the reader feel good about considering treatment, not pressured.${base}`;
  }

  return `You are Vanessa, the Social Media Sister AI. Write like a real person talking quietly to another real person at the end of a working day. Northern. Blunt. Witty. Real. First person always.

THE VOICE
No performance. No hype. No "here's the thing". No fluff or faff. No Americanisms (say "clinic" not "office", "course" not "program", "colour" not "color"). No AI patter. Short, complete sentences. A thought lands. Full stop. The next thought begins. Understated humour arrives sideways. The reader smiles before they know why.

This is Vanessa talking directly to a mate who happens to run a clinic. Direct. Warm. A little dry. Confident without showing off.

Rhythm: short, complete sentences. Vary sentence length but keep them punchy. Land ideas plainly. No meandering.${base}`;
}

const VOICE_STYLE_DESCRIPTIONS: Record<string, string> = {
  "whimsical": "Whimsical voice: narrative, observational, soulful. Sentences build slowly toward something real. Small ordinary moments made meaningful. Unhurried.",
  "professional-warmth": "Professional with Warmth voice: expert but human. Knowledgeable and credible without being cold or corporate. Warm, approachable, reassuring.",
  "girly-sweet": "Girly and Sweet voice: warm, light, friendly, inclusive. Like chatting with a kind friend who genuinely knows their subject. Gentle and celebratory, not breathless.",
};

function buildPersonalityContext(targetAudience?: string, contentPillars?: string, brandNotes?: string, voiceStyle?: string): string {
  const parts: string[] = [];
  if (voiceStyle && VOICE_STYLE_DESCRIPTIONS[voiceStyle]) {
    parts.push(`Voice style: ${VOICE_STYLE_DESCRIPTIONS[voiceStyle]}`);
  }
  if (targetAudience) parts.push(`Target audience: ${targetAudience}`);
  if (contentPillars) parts.push(`Content pillars: ${contentPillars}`);
  if (brandNotes) parts.push(`Brand personality and notes: ${brandNotes}`);
  if (parts.length === 0) return "";
  return `\n\nCLIENT PROFILE\n${parts.join("\n")}`;
}

const router: IRouter = Router();

const VANESSA_SYSTEM = `You are Vanessa, the Social Media Sister AI — a social media strategist specialising in aesthetic clinics, dental practices, skin clinics, and wellness businesses. You have deep expertise in MHRA/ASA compliance, writing hooks and captions that convert, and social media strategy for clinics.

THE VOICE
Write like a real person talking quietly to another real person. Not a brand. Not a marketing department. No performance.

Rhythm: short, complete sentences. A thought lands. Full stop. The next thought begins. No em dashes holding ideas together mid-sentence. No parenthetical asides with dashes. Sentences build slowly toward something real — a small truth, a moment of recognition, something quietly funny.

Humour: understated and self-aware. It arrives before the reader notices it coming. Never try-hard. Never announced. Think of someone dry and warm telling a story at the end of a working day.

Contractions: use them. You're, it's, don't, we've, that's, won't. Writing without contractions sounds stiff and corporate.

In conversation, you are a knowledgeable friend. Direct, warm, a little dry. If something won't work, you say so plainly without softening it into meaninglessness. You do not flatter. You do not catastrophise.

STRICT WRITING RULES
- NEVER use em dashes (—) or en dashes (–). Not once, not ever. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per message at most.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED openers: "In today's world", "In the ever-changing landscape", "Are you ready to", "Picture this", "Imagine a world"

COMPLIANCE (always, without exception)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility, not outcome. Use "may help", "can improve" not "will fix", "cures", "guaranteed".`;

const CONTENT_SYSTEM = `You are a social media content writer with a specific, non-negotiable voice. Read this carefully — this is not optional guidance, it is how you must write every single time.

THE VOICE
The writing sounds like a real person talking quietly to another real person. It is never a brand speaking. There is no performance. No hype.

Rhythm: short, complete sentences. A thought lands. Full stop. Then the next thought begins. Sentences build slowly — not by piling clauses together with dashes, but by starting a new sentence that picks up from where the last one stopped. The effect is unhurried. Honest. It sounds like someone who has actually thought about what they are saying.

Humour: understated and self-aware. Self-deprecating where appropriate. It arrives sideways — the reader smiles before they know why. Never try-hard. Never signposted. Never forced.

Small and specific beats big and general. "Three months in, the texture is different" beats "results take time". "I've been doing this for nine years. I still get this question every week." beats "Experts recommend..."

Contractions: always. You're, it's, don't, we've, that's, won't. Their absence sounds stiff and corporate.

HOOKS — this is where most content fails
A good hook sounds like something a real person would actually say. Quiet. Specific. Disarmingly plain. It opens on a small detail or an honest admission and earns attention by being real rather than by being loud.

GOOD hook patterns (understand what makes them work, do not copy them verbatim):
- "Nobody really talks about the consultation part."
- "There's a version of your skin that's just... not quite this. That's all."
- "Nine years in. Still explaining this one every single week."
- "It takes about three months. Most people don't expect that."
- "You don't have to be unhappy with your face to want this."
- "The part that surprises people is how ordinary it feels."
- "Three things I wish someone had told me earlier."
- "This isn't for everyone. That's the point."

BAD hooks — banned completely:
- "Are you tired of [problem]?"
- "It's time to invest in yourself."
- "What if we told you..."
- "Tired of feeling [negative feeling]?"
- "Are you ready to transform..."
- "Picture this." / "Imagine a world..."
- "In today's world..."
- Anything using: elevate, transform, unlock, journey, empower, revolutionise, game-changer, bespoke, synergy, leverage, holistic, cutting-edge, harness, delve, navigate, streamline

VALUE SLIDES
One idea per slide. Short. Specific over general. Give the actual information, plainly, without preamble. Do not restate at the end. Do not add a summary sentence. Land the point, stop.

CTA SLIDES
No urgency. No "DM us NOW". No "Don't miss out". Sounds like a person quietly extending an invitation: "If you've been thinking about it, a consultation is a good first step. No commitment." or "Save this one, it tends to come in useful." or "Drop us a message if any of this sounds familiar."

STRICT WRITING RULES
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in a compound adjective.
- No exclamation marks unless they genuinely earn it. One per post maximum.
- Use contractions naturally: you're, it's, don't, we're, that's.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke
- BANNED openers: "In today's world", "In the ever-changing landscape", "Are you ready to", "Picture this", "Imagine a world"

COMPLIANCE (always, without exception)
- NEVER name Botox, anti-wrinkle injections, or any prescription-only medicine by name. Use: "facial aesthetics", "smoothing treatments", "injectable treatments", "facial rejuvenation".
- Never use the word "safe" in advertising claims.
- No medical claims. No guaranteed results. No before/after that implies certainty.
- No pressure tactics. No urgency language.
- No superlatives: best, number one, guaranteed.
- Frame everything as consultation and possibility, not outcome. Use "may help", "can improve" not "will fix", "cures", "guaranteed".`;

router.post("/content/generate", async (req, res) => {
  try {
    const {
      clientName,
      industry,
      tone,
      topics,
      postCount,
      slidesPerPost,
      extraInstructions,
      targetAudience,
      contentPillars,
      brandNotes,
      voiceStyle,
    } = req.body;

    if (!industry || !tone || !topics || !postCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(postCount) || 30, 60);
    const slides = Math.min(Number(slidesPerPost) || 5, 10);

    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${CONTENT_SYSTEM}

You are generating carousel post content for a ${industry} business.${clientName ? ` Client: "${clientName}".` : ""} Write in a ${tone} tone.${buildPersonalityContext(targetAudience, contentPillars, brandNotes, voiceStyle)}

Slide structure — follow this exactly:
- Slide 1 is the HOOK. Under 10 words. Sounds like something a real person would actually say. Quiet, specific, honest. Not a marketing line. No banned openers. No generic "Are you tired of..." or "It's time to..." — follow the GOOD hook patterns in the voice rules above.
- Slides 2 to ${slides - 1} are VALUE slides. One idea per slide. 1-3 short sentences. Specific over general. Give the actual information plainly, no preamble, no restatement.
- Slide ${slides} is the CTA. A warm, unhurried invitation. No urgency. No "DM us NOW". Sounds like a person, not a campaign.

Rules:
- Every post must be fully MHRA and ASA compliant
- Every hook must sound different — vary the structure, angle, and tone across posts
- Content must be specific to ${industry}
- Text must fit on a 1080x1350 image — keep each slide concise
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const batchSize = Math.min(count, 15);
    const batches = Math.ceil(count / batchSize);
    let allPosts: Array<{ slides: string[] }> = [];

    for (let b = 0; b < batches; b++) {
      const remaining = count - allPosts.length;
      const thisBatch = Math.min(batchSize, remaining);

      res.write(
        `data: ${JSON.stringify({ type: "progress", generated: allPosts.length, total: count })}\n\n`
      );

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 16384,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate exactly ${thisBatch} carousel posts about these topics: ${topicList}. Distribute topics evenly across posts. Return a JSON object with a single key "posts" whose value is an array of exactly ${thisBatch} objects, each with a "slides" array.`,
          },
        ],
      });

      try {
        const raw = completion.choices[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw) as { posts?: Array<{ slides: string[] }> };
        const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
        allPosts = allPosts.concat(posts.slice(0, thisBatch));
      } catch (parseErr) {
        console.error("Failed to parse AI batch response:", parseErr);
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "Failed to parse AI response for a batch. Retrying..." })}\n\n`
        );
      }
    }

    const csvRows: string[][] = [];
    for (const post of allPosts) {
      if (post.slides && Array.isArray(post.slides)) {
        const row = post.slides.map((s: string) =>
          typeof s === "string" ? s : String(s)
        );
        while (row.length < slides) row.push("");
        csvRows.push(row.slice(0, slides));
      }
    }

    logActivity({ action: "generated", postType: "carousel", clientName: clientName || "", postCount: csvRows.length, slideCount: csvRows.length * slides });

    res.write(
      `data: ${JSON.stringify({ type: "complete", posts: csvRows, postCount: csvRows.length })}\n\n`
    );
    res.end();
  } catch (err: any) {
    console.error("Content generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Generation failed" });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: err.message || "Generation failed" })}\n\n`
      );
      res.end();
    }
  }
});

router.post("/content/generate-single", async (req, res) => {
  try {
    const { clientName, industry, tone, topics, postCount, extraInstructions, targetAudience, contentPillars, brandNotes, voiceStyle: singleVoiceStyle } = req.body;

    if (!industry || !tone || !topics || !postCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(postCount) || 10, 60);
    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${CONTENT_SYSTEM}

You are generating short text overlays for single-image Instagram posts for a ${industry} business.${clientName ? ` Client: "${clientName}".` : ""} Write in a ${tone} tone.${buildPersonalityContext(targetAudience, contentPillars, brandNotes, singleVoiceStyle)}

Rules:
- Each text is a standalone image overlay — under 12 words, readable at a glance
- Apply the GOOD hook patterns from the voice rules: quiet, specific, honest, real
- No banned openers. No generic scroll-bait. Sounds like a person, not a campaign.
- Vary styles across texts: plain statements, quiet observations, myth-busting, small surprising facts, honest admissions, numbered lists
- All content fully MHRA and ASA compliant
- Specific to ${industry}
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const batchSize = Math.min(count, 30);
    const batches = Math.ceil(count / batchSize);
    let allTexts: string[] = [];

    for (let b = 0; b < batches; b++) {
      const remaining = count - allTexts.length;
      const thisBatch = Math.min(batchSize, remaining);

      res.write(`data: ${JSON.stringify({ type: "progress", generated: allTexts.length, total: count })}\n\n`);

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly ${thisBatch} single-image post texts about these topics: ${topicList}. Distribute topics evenly. Return a JSON object with a single key "texts" whose value is an array of exactly ${thisBatch} strings.` },
        ],
      });

      try {
        const raw = completion.choices[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw) as { texts?: unknown[] };
        if (Array.isArray(parsed.texts)) {
          allTexts = allTexts.concat(parsed.texts.map((t) => String(t)).slice(0, thisBatch));
        }
      } catch (parseErr) {
        console.error("Failed to parse AI single-image batch:", parseErr);
        res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to parse AI response for a batch." })}\n\n`);
      }
    }

    logActivity({ action: "generated", postType: "single-image", clientName: clientName || "", postCount: allTexts.length, slideCount: allTexts.length });

    res.write(`data: ${JSON.stringify({ type: "complete", texts: allTexts })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Single image content generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Generation failed" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Generation failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/content/captions", async (req, res) => {
  try {
    const { posts, clientName, industry, extraInstructions, postType, voiceStyle, targetAudience, contentPillars, brandNotes } = req.body;
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "Posts array required" });
      return;
    }

    const count = posts.length;
    const isSingle = postType === "single-image";
    const postLabel = isSingle ? "single-image post" : "carousel post";
    const postsLabel = isSingle ? "single-image posts" : "carousel posts";
    const voicePrompt = getVoiceSystemPrompt(voiceStyle || "northern-grit");

    const systemPrompt = `${voicePrompt}

You are now generating Instagram/social media captions for ${postsLabel}.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry || "aesthetics"}.${buildPersonalityContext(targetAudience, contentPillars, brandNotes)}

You will receive the ${isSingle ? "overlay text" : "slide text"} for each ${postLabel}. Write a caption for each one that:
- Opens with a strong first line (this shows as the preview before "...more") - make it curiosity-driven or benefit-led, in the voice style above
- Is 80-150 words long - enough to add value but not so long people scroll past
- Feels authentic and human, not corporate - follow the voice style faithfully
- Is MHRA/ASA compliant - no medical claims, no guaranteed results, no pressure tactics
- Includes 1-2 relevant emojis naturally woven in (not emoji spam)
- NEVER use em dashes or en dashes, use hyphens or commas instead
- Include 3-5 relevant hashtags BEFORE the final CTA line
- The VERY LAST LINE of every caption MUST be a fun CTA in this exact format: "Comment [WORD] for more info" where [WORD] is a single fun, playful, uppercase word that relates to the content of that specific post. For example: "Comment GLOW for more info", "Comment POUT for more info", "Comment FRESH for more info". The word should be different and creative for each caption. Nothing comes after this line.
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}

IMPORTANT: Output ONLY a valid JSON array with no markdown formatting, no code fences, no extra text. Each element should be a string containing the full caption. Return exactly ${count} captions.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const batchSize = 15;
    const batches = Math.ceil(count / batchSize);
    let allCaptions: string[] = [];

    for (let b = 0; b < batches; b++) {
      const batchStart = b * batchSize;
      const batchPosts = posts.slice(batchStart, batchStart + batchSize);

      res.write(
        `data: ${JSON.stringify({ type: "progress", generated: allCaptions.length, total: count })}\n\n`
      );

      const postsDescription = batchPosts
        .map((p: string[], i: number) => {
          if (isSingle) return `Post ${batchStart + i + 1}: Overlay text: ${p[0]}`;
          return `Post ${batchStart + i + 1}: Slides: ${p.map((s, si) => `[Slide ${si + 1}] ${s}`).join(" | ")}`;
        })
        .join("\n");

      const captionCompletion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 16384,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write captions for these ${batchPosts.length} ${postsLabel}:\n\n${postsDescription}\n\nReturn a JSON object with a single key "captions" whose value is an array of exactly ${batchPosts.length} caption strings.`,
          },
        ],
      });

      let parsed: string[] | null = null;
      try {
        const raw = captionCompletion.choices[0]?.message?.content ?? "";
        const result = JSON.parse(raw) as { captions?: unknown[] };
        if (Array.isArray(result.captions)) {
          parsed = result.captions.map((c) => String(c));
        }
      } catch (parseErr2) {
        console.error("Failed to parse caption batch:", parseErr2);
      }

      if (parsed) {
        allCaptions = allCaptions.concat(parsed);
      } else {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "Failed to parse caption batch, retrying..." })}\n\n`
        );
      }
    }

    res.write(
      `data: ${JSON.stringify({ type: "complete", captions: allCaptions })}\n\n`
    );
    res.end();
  } catch (err: any) {
    console.error("Caption generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Caption generation failed" });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: err.message || "Caption generation failed" })}\n\n`
      );
      res.end();
    }
  }
});

router.post("/content/image-prompts", async (req, res) => {
  try {
    const { industry, topics, count, style } = req.body;
    if (!industry) {
      res.status(400).json({ error: "Industry required" });
      return;
    }

    const imageCount = Math.min(Number(count) || 6, 20);

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You generate detailed image prompts for AI image generation. These images will be used as backgrounds for social media carousel posts in the ${industry} industry.

Style preference: ${style || "clean, modern, professional"}

Rules:
- Each prompt should describe a visually striking image suitable for a portrait (3:4) carousel slide
- Focus on aesthetic, mood, lighting, and composition
- DO NOT include any text, words, letters, or typography in the images
- Good subjects: flat lays, treatment rooms, skincare products, lifestyle shots, textures, abstract beauty concepts, clinic interiors, hands, close-ups
- Keep prompts specific and detailed (lighting, colours, angles, style)
- Make them diverse - mix close-ups, wide shots, flat lays, abstract, lifestyle
- NEVER use em dashes or en dashes

Output ONLY a valid JSON array of ${imageCount} objects, each with "prompt" (the AI image prompt) and "label" (a short 3-4 word description). No markdown, no code fences.`,
        },
        {
          role: "user",
          content: `Generate ${imageCount} image prompts for ${industry} social media carousel backgrounds.${topics ? ` Topics: ${topics}` : ""} Return ONLY a JSON array.`,
        },
      ],
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) fullResponse += content;
    }

    let prompts: Array<{ prompt: string; label: string }> = [];
    try {
      let cleaned = fullResponse.trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) cleaned = jsonMatch[0];
      cleaned = cleaned.replace(/,\s*\]/g, "]");
      prompts = JSON.parse(cleaned);
    } catch {
      try {
        const cleaned = fullResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) prompts = JSON.parse(jsonMatch[0].replace(/,\s*\]/g, "]"));
      } catch {
        res.status(500).json({ error: "Failed to generate image prompts" });
        return;
      }
    }

    res.json({ prompts });
  } catch (err: any) {
    console.error("Image prompt error:", err);
    res.status(500).json({ error: err.message || "Failed to generate prompts" });
  }
});

router.post("/content/generate-story-questions", async (req, res) => {
  try {
    const { clientName, industry, tone, topics, questionCount, extraInstructions, targetAudience, contentPillars, brandNotes, voiceStyle: storyVoiceStyle } = req.body;

    if (!industry || !tone || !topics || !questionCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(questionCount) || 10, 60);
    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${VANESSA_SYSTEM}

You are now generating Instagram Story engagement questions. Write in a ${tone} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry}.${buildPersonalityContext(targetAudience, contentPillars, brandNotes, storyVoiceStyle)}

Generate exactly ${count} engagement questions for Instagram Stories.

Content rules:
- Each question should be short, punchy, and designed to get followers to respond in comments or DMs
- Keep each question under 15 words - these need to fit on a 1080x1920 story image with large text
- Mix up styles: "this or that" questions, "what's your go-to...", opinion polls, myth-busting, fill-in-the-blank, "agree or disagree", hot takes, "what would you do"
- Make them scroll-stopping and engagement-driving
- All content must be MHRA and ASA compliant - no medical claims, no guaranteed results
- Make content specific to ${industry}
- Keep language conversational, warm, and accessible
- These are designed for story slides with a bold background and overlay
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}

IMPORTANT: Output ONLY a valid JSON array of strings with no markdown formatting, no code fences, no extra text. Each element is a single question string.
Example: ["Morning skincare or evening skincare?","What treatment would you try first?","Agree or disagree: SPF every day, even in winter"]`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const batchSize = Math.min(count, 30);
    const batches = Math.ceil(count / batchSize);
    let allQuestions: string[] = [];

    for (let b = 0; b < batches; b++) {
      const remaining = count - allQuestions.length;
      const thisBatch = Math.min(batchSize, remaining);

      res.write(`data: ${JSON.stringify({ type: "progress", generated: allQuestions.length, total: count })}\n\n`);

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly ${thisBatch} Instagram Story engagement questions about these topics: ${topicList}. Distribute topics evenly. Return ONLY a JSON array of strings.` },
        ],
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) fullResponse += content;
      }

      try {
        let cleaned = fullResponse.trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) cleaned = jsonMatch[0];
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          allQuestions = allQuestions.concat(parsed.map((t: any) => String(t)).slice(0, thisBatch));
        }
      } catch (parseErr) {
        console.error("Failed to parse AI story questions batch:", parseErr);
        res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to parse AI response for a batch." })}\n\n`);
      }
    }

    logActivity({ action: "generated", postType: "story", clientName: clientName || "", postCount: allQuestions.length, slideCount: allQuestions.length });

    res.write(`data: ${JSON.stringify({ type: "complete", questions: allQuestions })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Story questions generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Generation failed" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Generation failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/content/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Messages array required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: VANESSA_SYSTEM + `\n\nYou are chatting with a user who is building social media content. Help them with strategy, compliance questions, content ideas, caption writing, hook ideas, or anything related to social media marketing for their business. Keep responses conversational and practical. Use short paragraphs. If they ask about compliance, be specific about MHRA/ASA rules.` },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Chat failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || "Chat failed" })}\n\n`);
      res.end();
    }
  }
});

router.post("/content/upload-image", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return res.status(500).json({ error: "Object storage not configured" });
    }

    const { images } = req.body as { images: { name: string; base64: string }[] };
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }
    if (images.length > 5) {
      return res.status(400).json({ error: "Maximum 5 images per request" });
    }

    const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
    const bucket = objectStorageClient.bucket(bucketId);
    const results: { name: string; url: string }[] = [];

    for (const img of images) {
      const raw = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
      const buffer = Buffer.from(raw, "base64");
      if (buffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: `Image ${img.name} exceeds 5MB limit` });
      }
      const timestamp = Date.now();
      const safeName = img.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `carousel-images/${timestamp}-${safeName}`;

      const file = bucket.file(objectPath);
      await file.save(buffer, {
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const proto = (req.headers["x-forwarded-proto"] as string) || "https";
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
      const fullUrl = `${proto}://${host}/api/content/images/${objectPath}`;
      console.log(`Uploaded ${img.name} → ${fullUrl}`);
      results.push({ name: img.name, url: fullUrl });
    }

    res.json({ results });
  } catch (err: any) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

router.post("/content/upload-video", videoUpload.single("video"), async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) return res.status(500).json({ error: "Object storage not configured" });
    if (!req.file) return res.status(400).json({ error: "No video file provided" });

    const timestamp = Date.now();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `reel-videos/${timestamp}-${safeName}`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);
    await file.save(req.file.buffer, {
      contentType: req.file.mimetype || "video/mp4",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    // Generate a signed GCS URL valid for 2 hours so Instagram can download
    // the video directly from object storage without routing through our server.
    const signedUrl = await signObjectURL({
      bucketName: bucketId,
      objectName: objectPath,
      method: "GET",
      ttlSec: 7200,
    });
    // Also keep a proxy URL as fallback for in-app playback preview
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const proxyUrl = `${proto}://${host}/api/content/videos/${objectPath}`;
    res.json({ url: signedUrl, proxyUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Video upload failed" });
  }
});

function extToMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", gif: "image/gif", mp4: "video/mp4",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

router.get("/content/videos/reel-videos/:filename", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `reel-videos/${req.params.filename}`;
    const file = objectStorageClient.bucket(bucketId).file(objectPath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    const stream = file.createReadStream();
    stream.on("error", () => { if (!res.headersSent) res.status(404).json({ error: "Not found" }); });
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to serve video" });
  }
});

router.get("/content/images/carousel-images/:filename", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `carousel-images/${req.params.filename}`;
    const file = objectStorageClient.bucket(bucketId).file(objectPath);
    res.setHeader("Content-Type", extToMime(req.params.filename) || "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    const stream = file.createReadStream();
    stream.on("error", () => { if (!res.headersSent) res.status(404).json({ error: "Not found" }); });
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to serve image" });
  }
});

router.get("/media/*key", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    // Express 5 wildcard splits multi-segment paths into an array — join them back
    const rawKey = (req.params as Record<string, string | string[]>).key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (!key) { res.status(400).json({ error: "No key specified" }); return; }
    const signedUrl = await signObjectURL({ bucketName: bucketId, objectName: key, method: "GET", ttlSec: 300 });
    res.redirect(302, signedUrl);
  } catch (err: any) {
    req.log.error({ err }, "media signed-url failed");
    res.status(500).json({ error: err.message || "Failed to generate download URL" });
  }
});

router.get("/music/search", async (req, res) => {
  try {
    const { q = "", genre = "", page = "1" } = req.query as Record<string, string>;
    const index = (Math.max(1, parseInt(page, 10)) - 1) * 20;
    const searchTerm = q.trim() || genre.trim() || "happy";
    const params = new URLSearchParams({
      q: searchTerm,
      limit: "20",
      index: String(index),
    });
    const resp = await fetch(`https://api.deezer.com/search?${params}`);
    if (!resp.ok) throw new Error(`Deezer error ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || "Deezer API error");
    const tracks = (data.data || [])
      .filter((h: any) => h.preview)
      .map((h: any) => ({
        trackId: h.id,
        name: h.title || "Untitled",
        durationMs: (h.duration || 0) * 1000,
        artist: h.artist?.name || "Unknown",
        url: h.preview,
      }));
    res.json({ tracks, total: data.total || tracks.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Music search failed" });
  }
});

router.post("/content/ba-caption", async (req, res) => {
  try {
    const { treatment, backStory, clientName, voiceStyle } = req.body as { treatment?: string; backStory?: string; clientName?: string; voiceStyle?: string };
    if (!(backStory || "").trim() && !(treatment || "").trim()) { res.status(400).json({ error: "Add a back story or treatment first" }); return; }
    const voicePrompt = getVoiceSystemPrompt(voiceStyle || "northern-grit");
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: `${voicePrompt}\n\nYou write warm, story-led Instagram captions for an aesthetics clinic${clientName ? ` (${clientName})` : ""} to sit alongside a before-and-after photo. Tell it as a short story: set the scene, how the client felt beforehand, what they had done, and how they felt after. Keep it human and specific, roughly 80 to 140 words. Be MHRA and ASA compliant: no medical claims, no guaranteed results, no pressure tactics. Use hyphens, never em dashes. Weave in one or two emojis naturally. Put 3 to 5 relevant hashtags on the final line. Output only the caption text, nothing else.` },
        { role: "user", content: `Treatment: ${treatment || "(not given)"}\nBack story from the clinic: ${backStory || "(not given)"}` },
      ],
    });
    const caption = (completion.choices[0]?.message?.content || "").trim();
    res.json({ caption });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Could not write a caption" });
  }
});

export default router;
