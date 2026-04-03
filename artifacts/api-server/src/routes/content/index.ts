import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const VANESSA_SYSTEM = `You are Vanessa — the Social Media Sister AI. You're a straight-talking, no-nonsense social media strategist who specialises in aesthetic clinics, dental practices, skin clinics, and wellness businesses. You have deep expertise in:

- MHRA and ASA advertising compliance for aesthetics
- Writing hooks and captions that actually convert
- Social media strategy for clinics
- Before/after post compliance
- Using AI tools in aesthetic practices

Your personality:
- Warm but direct — you don't do wishy-washy
- Northern English warmth (think "right then", "love", "go on then")
- You give straight answers with practical examples
- You're encouraging but honest — if something won't work, you say so
- You know the aesthetics industry inside out
- You always keep content MHRA/ASA compliant without being boring about it

Compliance rules you always follow:
- NEVER mention Botox, anti-wrinkle injections, or any specific prescription-only medicines by name — this is a strict legal requirement
- Never use the word "safe" in advertising claims
- Never make medical claims or guarantee results
- Before/after posts need proper context and can't be misleading
- No pressure selling or urgency tactics that could be misleading
- Avoid superlatives like "best", "number one", "guaranteed"
- Always frame treatments as consultations, not sales
- Use "may help", "can improve" instead of definitive outcome claims
- When discussing injectable treatments, use general terms like "facial aesthetics", "injectable treatments", "smoothing treatments", or "facial rejuvenation" - never name the product
- NEVER use em dashes (—) or en dashes (–) anywhere in your output. Use hyphens (-) or commas instead. This is a strict formatting rule.`;

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

    const systemPrompt = `${VANESSA_SYSTEM}

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

router.post("/content/captions", async (req, res) => {
  try {
    const { posts, clientName, industry, tone, extraInstructions } = req.body;
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "Posts array required" });
      return;
    }

    const count = posts.length;

    const systemPrompt = `${VANESSA_SYSTEM}

You are now generating Instagram/social media captions for carousel posts. Write in a ${tone || "warm & professional"} tone of voice.${clientName ? ` You are creating content for "${clientName}".` : ""} The industry is: ${industry || "aesthetics"}.

You will receive the slide text for each carousel post. Write a caption for each one that:
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
        .map((p: string[], i: number) => `Post ${batchStart + i + 1}: Slides: ${p.map((s, si) => `[Slide ${si + 1}] ${s}`).join(" | ")}`)
        .join("\n");

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write captions for these ${batchPosts.length} carousel posts:\n\n${postsDescription}\n\nReturn ONLY a JSON array of ${batchPosts.length} caption strings.`,
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

router.post("/content/clinician-recreate", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "Image required" });
      return;
    }

    const styles = [
      { name: "classic", prompt: "Classic professional portrait headshot, studio lighting, neutral background, formal pose" },
      { name: "bailey", prompt: "David Bailey style portrait, dramatic lighting, high contrast black and white, elegant and timeless" },
      { name: "closeup", prompt: "Intimate close-up portrait, soft focus background, natural lighting, professional makeup" },
      { name: "patient", prompt: "Professional healthcare setting, clinician talking to patient, warm and approachable, medical environment" },
      { name: "editorial", prompt: "Editorial style fashion portrait, dynamic pose, artistic lighting, magazine quality" },
    ];

    const results = await Promise.all(
      styles.map(async (style) => {
        try {
          const response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: `${style.prompt}. No text, words, letters, or typography in the image. Same person, same outfit, identical facial features.`,
            n: 1,
            size: "1024x1024",
          });

          const imageData = response.data?.[0];
          if (imageData?.b64_json) {
            return { style: style.name, image: `data:image/png;base64,${imageData.b64_json}` };
          } else if (imageData?.url) {
            return { style: style.name, image: imageData.url };
          }
          return null;
        } catch (err) {
          console.error(`Error generating ${style.name} style:`, err);
          return null;
        }
      })
    );

    const validResults = results.filter(r => r !== null);
    if (validResults.length === 0) {
      res.status(500).json({ error: "Failed to generate portrait styles" });
      return;
    }

    res.json({ portraits: validResults });
  } catch (err: any) {
    console.error("Clinician recreate error:", err);
    res.status(500).json({ error: err.message || "Recreation failed" });
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

export default router;
