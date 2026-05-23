import { Router, type IRouter } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient } from "../../lib/objectStorage";
import { logActivity } from "../../lib/activityLog";
import { db } from "@workspace/db";
import { workspaceLabelsTable } from "@workspace/db/schema";

const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const CC_BASE = "https://app.cloudcampaign.com/api/v1";

let ccToken: string | null = null;
let ccTokenExpiry = 0;

async function getCCToken(): Promise<string> {
  if (ccToken && Date.now() < ccTokenExpiry) return ccToken;
  const apiKey = process.env.CLOUD_CAMPAIGN_API_KEY;
  const apiSecret = process.env.CLOUD_CAMPAIGN_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Cloud Campaign API key and secret not configured");
  console.log("Attempting CC auth token request...");
  const res = await fetch(`${CC_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: apiKey, secret: apiSecret }),
  });
  if (!res.ok) {
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    console.error(`CC auth error ${res.status}:`, data);
    throw new Error(data?.message || data?.errorReason || `Auth error ${res.status}`);
  }
  const token = res.headers.get("x-api-token");
  if (!token) {
    const allHeaders = Object.fromEntries(res.headers.entries());
    console.error("CC auth response headers:", JSON.stringify(allHeaders));
    throw new Error("No x-api-token header in CC auth response");
  }
  ccToken = token;
  ccTokenExpiry = Date.now() + 11 * 60 * 60 * 1000;
  console.log("CC auth token obtained successfully");
  return ccToken;
}

async function ccFetch(path: string, opts: RequestInit = {}) {
  const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
  if (!agencyId) throw new Error("Cloud Campaign agency ID not configured");
  const token = await getCCToken();
  const res = await fetch(`${CC_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-agency-id": agencyId,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      ccToken = null;
      ccTokenExpiry = 0;
    }
    console.error(`Cloud Campaign API error ${res.status}:`, data);
    throw new Error(data?.message || data?.errorReason || `API error ${res.status}`);
  }
  return data;
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
    } = req.body;

    if (!industry || !tone || !topics || !postCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(postCount) || 30, 60);
    const slides = Math.min(Number(slidesPerPost) || 5, 10);

    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${CONTENT_SYSTEM}

You are generating carousel post content for a ${industry} business.${clientName ? ` Client: "${clientName}".` : ""} Write in a ${tone} tone.

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
    const { clientName, industry, tone, topics, postCount, extraInstructions } = req.body;

    if (!industry || !tone || !topics || !postCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(postCount) || 10, 60);
    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${CONTENT_SYSTEM}

You are generating short text overlays for single-image Instagram posts for a ${industry} business.${clientName ? ` Client: "${clientName}".` : ""} Write in a ${tone} tone.

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
    const { posts, clientName, industry, tone, extraInstructions, postType } = req.body;
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "Posts array required" });
      return;
    }

    const count = posts.length;
    const isSingle = postType === "single-image";
    const postLabel = isSingle ? "single-image post" : "carousel post";
    const postsLabel = isSingle ? "single-image posts" : "carousel posts";

    const systemPrompt = `${CONTENT_SYSTEM}

You are now generating Instagram/social media captions for ${postsLabel}. Write in a ${tone || "warm & professional"} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry || "aesthetics"}.

You will receive the ${isSingle ? "overlay text" : "slide text"} for each ${postLabel}. Write a caption for each one that:
- Opens with a strong first line (this shows as the preview before "...more") - make it curiosity-driven or benefit-led
- Is 80-150 words long - enough to add value but not so long people scroll past
- Feels conversational and authentic, not corporate
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
    const { clientName, industry, tone, topics, questionCount, extraInstructions } = req.body;

    if (!industry || !tone || !topics || !questionCount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const count = Math.min(Number(questionCount) || 10, 60);
    const topicList = Array.isArray(topics) ? topics.join(", ") : topics;

    const systemPrompt = `${VANESSA_SYSTEM}

You are now generating Instagram Story engagement questions. Write in a ${tone} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry}.

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

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const url = `${proto}://${host}/api/content/videos/${objectPath}`;
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Video upload failed" });
  }
});

router.get("/content/videos/reel-videos/:filename", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) return res.status(500).json({ error: "Object storage not configured" });
    const objectPath = `reel-videos/${req.params.filename}`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: "Not found" });
    const [buffer] = await file.download();
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to serve video" });
  }
});

router.get("/content/images/carousel-images/:filename", async (req, res) => {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      return res.status(500).json({ error: "Object storage not configured" });
    }

    const objectPath = `carousel-images/${req.params.filename}`;
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "Image not found" });
    }

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    if (metadata.size) {
      res.setHeader("Content-Length", String(metadata.size));
    }

    file.createReadStream().pipe(res);
  } catch (err: any) {
    console.error("Image serve error:", err);
    res.status(500).json({ error: err.message || "Failed to serve image" });
  }
});

router.get("/cloud-campaign/status", async (_req, res) => {
  const apiKey = process.env.CLOUD_CAMPAIGN_API_KEY;
  const apiSecret = process.env.CLOUD_CAMPAIGN_API_SECRET;
  const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
  const workspaceIds = (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").filter(Boolean);
  res.json({
    configured: !!(apiKey && apiSecret),
    hasWorkspaces: workspaceIds.length > 0,
    workspaceCount: workspaceIds.length,
  });
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
        id: h.id,
        title: h.title || "Untitled",
        duration: h.duration || 0,
        artist: h.artist?.name || "Unknown",
        previewUrl: h.preview,
      }));
    res.json({ tracks, total: data.total || tracks.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Music search failed" });
  }
});

router.get("/cloud-campaign/workspace-labels", async (_req, res) => {
  try {
    const labels = await db.select().from(workspaceLabelsTable);
    res.json(labels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/cloud-campaign/workspace-labels", async (req, res) => {
  try {
    const entries: Array<{ workspaceId: string; label: string }> = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: "Expected array" });
    for (const { workspaceId, label } of entries) {
      if (!workspaceId) continue;
      await db
        .insert(workspaceLabelsTable)
        .values({ workspaceId, label: label || "", updatedAt: new Date() })
        .onConflictDoUpdate({
          target: workspaceLabelsTable.workspaceId,
          set: { label: label || "", updatedAt: new Date() },
        });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cloud-campaign/workspaces", async (_req, res) => {
  try {
    const workspaceIds = (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (workspaceIds.length === 0) {
      return res.json({ workspaces: [] });
    }

    const dbLabels = await db.select().from(workspaceLabelsTable);
    const dbLabelMap = new Map(dbLabels.map((l) => [l.workspaceId, l.label]));

    const nameOverrides = (process.env.CLOUD_CAMPAIGN_WORKSPACE_NAMES || "")
      .split(",").map((s) => s.trim());
    const envNameById = new Map<string, string>();
    workspaceIds.forEach((id, i) => {
      if (nameOverrides[i] && nameOverrides[i].length > 0) envNameById.set(id, nameOverrides[i]);
    });

    const workspaces = workspaceIds.map((id) => {
      const name =
        dbLabelMap.get(id) ||
        envNameById.get(id) ||
        `Workspace ${id.slice(0, 8)}…`;
      return { id, name };
    });

    res.json({ workspaces });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Failed to fetch workspaces from Cloud Campaign" });
  }
});

router.post("/cloud-campaign/push", async (req, res) => {
  try {
    const { posts, workspaceIds, postType } = req.body as {
      posts: { title: string; caption: string; imageUrls?: string[]; videoUrl?: string }[];
      workspaceIds?: string[];
      postType?: string;
    };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: "No posts provided" });
    }

    if (!workspaceIds || workspaceIds.length === 0) {
      return res.status(400).json({ error: "No workspace selected. Please select a client preset with a linked Cloud Campaign workspace." });
    }

    const targetIds = workspaceIds;

    const results: { workspace: string; post: string; status: string; id?: string; error?: string }[] = [];

    for (const wsId of targetIds) {
      for (const post of posts) {
        try {
          const media = post.videoUrl
            ? [{ type: "VIDEO", sourceUrl: post.videoUrl }]
            : (post.imageUrls || []).map((url) => ({ type: "IMAGE", sourceUrl: url }));

          const body: Record<string, any> = {
            title: post.title,
            postNow: false,
            approved: true,
            captions: [
              { text: post.caption, platform: "INSTAGRAM", index: 0 },
              { text: post.caption, platform: "FACEBOOK", index: 0 },
            ],
            publishingSettings: {},
            platformList: ["INSTAGRAM", "FACEBOOK"],
            accountIds: [],
          };
          if (media.length > 0) {
            body.media = media;
          }

          req.log.info({ wsId, title: post.title, captionLength: post.caption?.length ?? 0, mediaCount: media.length }, "Pushing to CC");
          const data = await ccFetch(`/workspace/${wsId}/content`, {
            method: "POST",
            body: JSON.stringify(body),
          });

          results.push({ workspace: wsId, post: post.title, status: "success", id: data.id });
        } catch (err: any) {
          console.error(`Failed to push "${post.title}" to ${wsId}:`, err.message);
          results.push({ workspace: wsId, post: post.title, status: "error", error: err.message });
        }
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    if (succeeded > 0) {
      logActivity({ action: "pushed", postType: postType || "carousel", postCount: succeeded });
    }
    res.json({ results, summary: { total: results.length, succeeded, failed } });
  } catch (err: any) {
    console.error("CC push error:", err);
    res.status(500).json({ error: err.message || "Failed to push to Cloud Campaign" });
  }
});

router.post("/cloud-campaign/push-csv", async (req, res) => {
  try {
    const { csvUrl, workspaceIds } = req.body as { csvUrl: string; workspaceIds?: string[] };

    if (!csvUrl) {
      return res.status(400).json({ error: "No CSV URL provided" });
    }

    const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
    const targetIds = workspaceIds?.length
      ? workspaceIds
      : (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").filter(Boolean);

    if (targetIds.length === 0) {
      return res.status(400).json({ error: "No workspace IDs configured" });
    }

    console.log(`Pushing CSV to ${targetIds.length} workspace(s): ${csvUrl}`);
    const data = await ccFetch("/content/csv", {
      method: "POST",
      body: JSON.stringify({ agencyId, workspaceIds: targetIds, externalUrl: csvUrl }),
    });

    res.json({ success: true, data });
  } catch (err: any) {
    console.error("CC CSV push error:", err);
    res.status(500).json({ error: err.message || "Failed to push CSV to Cloud Campaign" });
  }
});

export default router;
