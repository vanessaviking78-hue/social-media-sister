import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient } from "../../lib/objectStorage";
import { logActivity } from "../../lib/activityLog";

const CC_BASE = "https://app.cloudcampaign.com/api/v1";

async function ccFetch(path: string, opts: RequestInit = {}) {
  const apiKey = process.env.CLOUD_CAMPAIGN_API_KEY;
  const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
  if (!apiKey || !agencyId) throw new Error("Cloud Campaign credentials not configured");
  const res = await fetch(`${CC_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "x-agency-id": agencyId,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    console.error(`Cloud Campaign API error ${res.status}:`, data);
    throw new Error(data?.message || data?.errorReason || `API error ${res.status}`);
  }
  return data;
}

const router: IRouter = Router();

const VANESSA_SYSTEM = `You are Vanessa, the Social Media Sister AI. You're a straight-talking, no-nonsense social media strategist who specialises in aesthetic clinics, dental practices, skin clinics, and wellness businesses. You have deep expertise in:

- MHRA and ASA advertising compliance for aesthetics
- Writing hooks and captions that actually convert
- Social media strategy for clinics
- Before/after post compliance
- Using AI tools in aesthetic practices

Your personality:
- Warm but direct, you don't do wishy-washy
- Northern English warmth (think "right then", "love", "go on then")
- You give straight answers with practical examples
- You're encouraging but honest, if something won't work, you say so
- You know the aesthetics industry inside out
- You always keep content MHRA/ASA compliant without being boring about it

Compliance rules you always follow:
- NEVER mention Botox, anti-wrinkle injections, or any specific prescription-only medicines by name, this is a strict legal requirement
- Never use the word "safe" in advertising claims
- Never make medical claims or guarantee results
- Before/after posts need proper context and can't be misleading
- No pressure selling or urgency tactics that could be misleading
- Avoid superlatives like "best", "number one", "guaranteed"
- Always frame treatments as consultations, not sales
- Use "may help", "can improve" instead of definitive outcome claims
- When discussing injectable treatments, use general terms like "facial aesthetics", "injectable treatments", "smoothing treatments", or "facial rejuvenation" - never name the product
- NEVER use em dashes or en dashes anywhere in your output. Use hyphens (-) or commas instead. This is a strict formatting rule.`;

const CONTENT_SYSTEM = `You are a social media content creator who writes like a normal, relaxed person. Zero corporate speak, zero AI fluff.

Your voice:
- Relaxed, colloquial and friendly - like chatting with someone you know
- Short sentences. Natural grammar, not overly polished
- Use contractions (you're, it's, don't, we're, that's)
- Sound like a real person, not a marketing department
- BANNED words and phrases: "elevate", "transform", "unlock", "journey", "empower", "revolutionise", "game-changer", "dive into", "harness", "leverage", "delve", "navigate", "streamline", "cutting-edge", "holistic", "synergy", "bespoke"
- BANNED openers: "In today's world", "In the ever-changing landscape", "Are you ready to", "Picture this", "Imagine a world"
- No exclamation mark overload - one per post max, if any
- Warm but not over-the-top. Real people don't write with constant excitement
- Keep it simple and genuine. If you wouldn't say it out loud to a friend, don't write it

Compliance rules you always follow:
- NEVER mention Botox, anti-wrinkle injections, or any specific prescription-only medicines by name, this is a strict legal requirement
- Never use the word "safe" in advertising claims
- Never make medical claims or guarantee results
- Before/after posts need proper context and can't be misleading
- No pressure selling or urgency tactics that could be misleading
- Avoid superlatives like "best", "number one", "guaranteed"
- Always frame treatments as consultations, not sales
- Use "may help", "can improve" instead of definitive outcome claims
- When discussing injectable treatments, use general terms like "facial aesthetics", "injectable treatments", "smoothing treatments", or "facial rejuvenation" - never name the product
- NEVER use em dashes or en dashes anywhere in your output. Use hyphens (-) or commas instead. This is a strict formatting rule.`;

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

You are now generating carousel post content. Write in a ${tone} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry}.

Generate exactly ${count} carousel posts, each with exactly ${slides} slides.

Content rules:
- Slide 1 is always the HOOK/COVER slide — make it attention-grabbing, short (under 12 words), and compelling. Use the kind of hooks that stop the scroll — questions, bold statements, myth-busting, "stop doing this", numbered lists, etc.
- Slides 2-${slides - 1} are the VALUE slides — educational, practical, or story-driven. Each slide should be 1-3 sentences max. Give actual useful information, not fluff.
- Slide ${slides} is always the CTA (call to action) — encourage engagement, follows, saves, or bookings. Make it feel natural, not salesy.
- All content must be MHRA and ASA compliant — no medical claims, no guaranteed results, no pressure tactics
- Vary the hooks across posts — mix questions, bold statements, myths, statistics, lists, "mistakes to avoid", etc.
- Make content specific to ${industry}
- Keep language conversational, warm, and accessible
- Each slide text should be concise enough to fit on a 1080x1350 carousel image
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}

IMPORTANT: Output ONLY a valid JSON array with no markdown formatting, no code fences, no extra text. Each element should be an object with a "slides" array of exactly ${slides} strings. Example format:
[{"slides":["Hook text","Slide 2 text","Slide 3 text","Slide 4 text","CTA text"]}]`;

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

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate exactly ${thisBatch} carousel posts about these topics: ${topicList}. Distribute topics evenly across posts. Return ONLY a JSON array.`,
          },
        ],
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
        }
      }

      try {
        let cleaned = fullResponse.trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) cleaned = jsonMatch[0];
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          allPosts = allPosts.concat(parsed.slice(0, thisBatch));
        }
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

You are now generating text overlays for single-image Instagram posts. Write in a ${tone} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry}.

Generate exactly ${count} single-image post texts.

Content rules:
- Each text is a short, punchy statement or question that works as a standalone image overlay
- Keep each text under 15 words - these need to be readable on a single image
- Mix up styles: bold statements, questions, myth-busting, tips, calls to action, inspiring quotes
- Make them scroll-stopping and attention-grabbing
- All content must be MHRA and ASA compliant - no medical claims, no guaranteed results, no pressure tactics
- Make content specific to ${industry}
- Keep language conversational, warm, and accessible
- Each text should be concise enough to fit on a 1080x1350 image
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}

IMPORTANT: Output ONLY a valid JSON array of strings with no markdown formatting, no code fences, no extra text. Each element is a single text string.
Example: ["Your skin deserves better","Stop doing this to your face","3 things your practitioner wants you to know"]`;

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

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly ${thisBatch} single-image post texts about these topics: ${topicList}. Distribute topics evenly. Return ONLY a JSON array of strings.` },
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
          allTexts = allTexts.concat(parsed.map((t: any) => String(t)).slice(0, thisBatch));
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
- Includes a clear call to action (save this, share with a friend, book a consultation, drop a comment)
- Uses 3-5 relevant hashtags at the end
- Feels conversational and authentic, not corporate
- Is MHRA/ASA compliant - no medical claims, no guaranteed results, no pressure tactics
- Includes 1-2 relevant emojis naturally woven in (not emoji spam)
- NEVER use em dashes or en dashes, use hyphens or commas instead
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

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write captions for these ${batchPosts.length} ${postsLabel}:\n\n${postsDescription}\n\nReturn ONLY a JSON array of ${batchPosts.length} caption strings.`,
          },
        ],
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) fullResponse += content;
      }

      let parsed: string[] | null = null;
      try {
        let cleaned = fullResponse.trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) cleaned = jsonMatch[0];
        cleaned = cleaned.replace(/,\s*\]/g, "]");
        const result = JSON.parse(cleaned);
        if (Array.isArray(result)) {
          parsed = result.map((c: any) => String(c));
        }
      } catch {
        try {
          const cleaned = fullResponse
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0].replace(/,\s*\]/g, "]"));
            if (Array.isArray(result)) {
              parsed = result.map((c: any) => String(c));
            }
          }
        } catch (parseErr2) {
          console.error("Failed to parse caption batch:", parseErr2, "Raw:", fullResponse.slice(0, 500));
        }
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

router.post("/content/before-after-captions", async (req, res) => {
  try {
    const { treatments, clientName, industry, tone, extraInstructions } = req.body;
    if (!treatments || !Array.isArray(treatments) || treatments.length === 0) {
      res.status(400).json({ error: "Treatments array required" });
      return;
    }

    const MAX_TREATMENTS = 30;
    if (treatments.length > MAX_TREATMENTS) {
      res.status(400).json({ error: `Maximum ${MAX_TREATMENTS} treatments allowed` });
      return;
    }

    for (let i = 0; i < treatments.length; i++) {
      const t = treatments[i];
      if (!t || typeof t !== "object" || !t.treatmentType || typeof t.treatmentType !== "string" || !t.treatmentType.trim()) {
        res.status(400).json({ error: `Treatment ${i + 1} is missing a treatment type` });
        return;
      }
    }

    const count = treatments.length;

    const systemPrompt = `${CONTENT_SYSTEM}

You are now generating Instagram/social media captions specifically for BEFORE & AFTER treatment posts. Write in a ${tone || "warm & professional"} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry || "aesthetics"}.

You will receive treatment information for before/after photo posts. For each treatment, write:
1. A carousel caption (the Instagram post caption)
2. Slide text for the "before" image (short, 2-5 words like "Before Treatment")
3. Slide text for the "after" image (short, 2-5 words like "After Treatment")  
4. A hook/cover slide text (attention-grabbing, under 10 words)

Rules for before/after content:
- NEVER make claims about specific results or guarantee outcomes
- Use phrases like "results may vary", "individual results", "after a course of treatments"
- Include proper context - mention that results are from real clients with consent
- Frame as a journey, not a dramatic transformation
- Do NOT use words like "amazing", "incredible", "unbelievable" about results
- Keep it authentic and compliant with MHRA/ASA rules
- Include 3-5 relevant hashtags in the caption
- Caption should be 80-150 words
- Include a call to action (book a consultation, DM for info)
- NEVER use em dashes or en dashes, use hyphens or commas instead
${extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : ""}

IMPORTANT: Output ONLY a valid JSON array with no markdown formatting, no code fences, no extra text. Each element should be an object with:
- "caption": the full Instagram caption
- "beforeLabel": short text for the before image (e.g. "Before")
- "afterLabel": short text for the after image (e.g. "After 3 Sessions") 
- "hookText": attention-grabbing cover slide text
- "treatmentType": echo back the treatment type

Return exactly ${count} items.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const batchSize = 10;
    const batches = Math.ceil(count / batchSize);
    let allResults: Array<{
      caption: string;
      beforeLabel: string;
      afterLabel: string;
      hookText: string;
      treatmentType: string;
    }> = [];

    for (let b = 0; b < batches; b++) {
      const batchStart = b * batchSize;
      const batchTreatments = treatments.slice(batchStart, batchStart + batchSize);

      res.write(
        `data: ${JSON.stringify({ type: "progress", generated: allResults.length, total: count })}\n\n`
      );

      const treatmentDesc = batchTreatments
        .map((t: { treatmentType: string; area?: string; notes?: string }, i: number) =>
          `Treatment ${batchStart + i + 1}: ${t.treatmentType}${t.area ? ` (${t.area})` : ""}${t.notes ? ` - ${t.notes}` : ""}`
        )
        .join("\n");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate before/after post content for these ${batchTreatments.length} treatments:\n\n${treatmentDesc}\n\nReturn ONLY a JSON array of ${batchTreatments.length} objects.`,
          },
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
        cleaned = cleaned.replace(/,\s*\]/g, "]");
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          allResults = allResults.concat(parsed.slice(0, batchTreatments.length));
        }
      } catch {
        try {
          const cleaned2 = fullResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const jsonMatch2 = cleaned2.match(/\[[\s\S]*\]/);
          if (jsonMatch2) {
            const result = JSON.parse(jsonMatch2[0].replace(/,\s*\]/g, "]"));
            if (Array.isArray(result)) {
              allResults = allResults.concat(result.slice(0, batchTreatments.length));
            }
          }
        } catch (parseErr2) {
          console.error("Failed to parse before/after caption batch:", parseErr2);
          res.write(
            `data: ${JSON.stringify({ type: "error", message: "Failed to parse AI response for a batch" })}\n\n`
          );
        }
      }
    }

    logActivity({ action: "generated", postType: "before-after", clientName: clientName || "", postCount: allResults.length, slideCount: allResults.length * 3 });

    res.write(
      `data: ${JSON.stringify({ type: "complete", results: allResults })}\n\n`
    );
    res.end();
  } catch (err: any) {
    console.error("Before/after caption generation error:", err);
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
  const agencyId = process.env.CLOUD_CAMPAIGN_AGENCY_ID;
  const workspaceIds = (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").filter(Boolean);
  res.json({
    configured: !!(apiKey && agencyId),
    hasWorkspaces: workspaceIds.length > 0,
    workspaceCount: workspaceIds.length,
  });
});

const WORKSPACE_NAMES: Record<string, string> = {
  "fc7cb893-462d-484f-bfc9-797a371fab49": "Rafique Aesthetics",
  "5bcb3eda-41a4-4dc4-b5d2-f0538553fd72": "Ami B",
  "82352433-c37b-4adb-a5dc-d2f46928979d": "Aspyre",
  "d16db895-87ee-4fd2-821c-7e2ddfbe860d": "Behold Me",
  "bb592af3-cb91-460d-b759-b407c091ca81": "Bex Wood",
  "a6c88691-6770-4094-88c2-421e192779b4": "Castle Clinic",
  "29ad0ded-06d7-4f2c-9796-b08097fbe722": "CK",
  "b405b7b0-b6fe-479f-a8fb-3cef1b44ecce": "Claire Brown",
  "9434b57b-1db5-4d7f-8f6a-d171983f502d": "Clare Connolly",
  "ea050da9-a302-4e51-99c4-40dd6b07d452": "CT",
  "f79e7f45-e5aa-4729-b856-bd55702216af": "Dr Kathryn",
  "2d0a7b46-f2e9-4dd6-8be1-4514cb505e80": "Dr Laura Highcroft",
  "1935ae9e-b164-44a3-ba51-1ed8bbd5d312": "Dr Lisa Academy",
  "7ec52a39-9f8f-4074-ac00-ed60ef5014d4": "Dr Lisa Aesthetics",
  "a4268d17-142d-4f9c-b40c-2d71a916fe29": "Dr V",
  "92f303a0-3458-4893-9820-10aa47d393d0": "Eaton",
  "0244ca6e-2269-47df-8d6b-aa89b8bc7448": "Equilibrium",
  "14d722a6-0c91-474e-becf-2627f76becd7": "Eva Garcia Aesthetics",
  "a1961d93-02f0-4f54-8c1f-a24fba893783": "Forever Young",
  "558e4849-d72e-4c27-9b43-27084074612b": "Happy Face",
  "21418c01-a9d7-450f-a936-36cf6aecbcb1": "Harwood Aesthetics",
  "e21a4a62-8ed9-4589-bbf7-083f959c984d": "Helen Tweaked",
  "d28a4ba3-abe8-47a2-99cd-d714b0752ca4": "Kelly Anne",
  "7f55ed52-fa03-40d8-9c33-11c191cdfd1d": "Nova Aesthetics",
  "1aebf27a-73e5-424b-84a4-67d8c7cee00c": "Pip",
  "682dde7b-48bc-4267-a1e8-aadca3173afb": "Pura Aesthetics",
  "53aebda4-a90a-496b-9609-5300786735ab": "Radiant Rose",
  "9c9bc090-4dc1-4cdf-a988-418e91caa422": "Social Media Sister",
  "8d69664a-3f90-40ac-934e-6da379997798": "Sonja",
  "d0ee5ed5-347a-4a9e-b73a-020dcbc69133": "Suzanne",
  "b9349755-68cf-4219-9157-bcff6968c53d": "Taunton",
  "1858ac0e-6c1f-47d5-b427-664a522d00ed": "Teviot",
  "7458f9c2-419d-4d0c-b203-0cc78a582c29": "The Compliance Clinic",
  "6af48e3f-7251-46df-9f3a-c3f3c36cdb6d": "Timeless by Sarah",
};

router.get("/cloud-campaign/workspaces", async (_req, res) => {
  try {
    const ids = (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").filter(Boolean);
    const workspaces = ids.map(id => ({
      id,
      name: WORKSPACE_NAMES[id] || id,
    }));
    res.json({ workspaces });
  } catch (err: any) {
    console.error("CC workspaces error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch workspaces" });
  }
});

router.post("/cloud-campaign/push", async (req, res) => {
  try {
    const { posts, workspaceIds, postType } = req.body as {
      posts: { title: string; caption: string; imageUrls: string[] }[];
      workspaceIds?: string[];
      postType?: string;
    };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: "No posts provided" });
    }

    const targetIds = workspaceIds?.length
      ? workspaceIds
      : (process.env.CLOUD_CAMPAIGN_WORKSPACE_IDS || "").split(",").filter(Boolean);

    if (targetIds.length === 0) {
      return res.status(400).json({ error: "No workspace IDs configured" });
    }

    const results: { workspace: string; post: string; status: string; id?: string; error?: string }[] = [];

    for (const wsId of targetIds) {
      for (const post of posts) {
        try {
          const media = post.imageUrls.map((url) => ({
            type: "IMAGE",
            sourceUrl: url,
          }));

          const body = {
            title: post.title,
            captions: [{ text: post.caption, platform: "INSTAGRAM", index: 0 }],
            media,
            approved: true,
            postNow: false,
          };

          console.log(`Pushing "${post.title}" to workspace ${wsId} with ${media.length} images`);
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
