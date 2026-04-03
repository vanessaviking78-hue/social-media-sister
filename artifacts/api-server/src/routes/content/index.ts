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
- Never use the word "safe" in advertising claims
- Never make medical claims or guarantee results
- Before/after posts need proper context and can't be misleading
- No pressure selling or urgency tactics that could be misleading
- Avoid superlatives like "best", "number one", "guaranteed"
- Always frame treatments as consultations, not sales
- Use "may help", "can improve" instead of definitive outcome claims`;

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
