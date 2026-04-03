import { Router, type IRouter } from "express";
import { openai, toFile } from "@workspace/integrations-openai-ai-server";
import sharp from "sharp";

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

const CONTENT_SYSTEM = `You are a friendly, relatable social media content creator. You write like you're chatting with a mate, keeping things warm, down-to-earth and easy to read. You specialise in content for clinics, wellness businesses, and professional services.

Your style:
- Friendly and colloquial, like chatting over a coffee
- Relatable and human, not corporate or stiff
- You write content people actually want to read and share
- You keep things punchy and practical

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

    const systemPrompt = `${CONTENT_SYSTEM}

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
    const { clinicianBase64, clinicBase64 } = req.body;
    if (!clinicianBase64) {
      res.status(400).json({ error: "Clinician photo required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let clientClosed = false;
    res.on("close", () => { clientClosed = true; });

    const detectMime = (b64: string) => {
      if (b64.startsWith("/9j/")) return "image/jpeg";
      if (b64.startsWith("iVBOR")) return "image/png";
      if (b64.startsWith("UklGR")) return "image/webp";
      if (b64.startsWith("R0lGO")) return "image/gif";
      return "image/jpeg";
    };

    res.write(`data: ${JSON.stringify({ type: "progress", current: 0, total: 10, label: "Preparing your photo..." })}\n\n`);

    let clinicDescription = "a modern, clean aesthetic clinic with neutral tones, professional medical equipment, and tasteful decor";

    let clinicianPngBuf: Buffer;
    try {
      const clinicianBuf = Buffer.from(clinicianBase64, "base64");
      clinicianPngBuf = await sharp(clinicianBuf).png().toBuffer();
    } catch (prepErr: any) {
      console.error("Photo prep error:", prepErr?.message);
      res.write(`data: ${JSON.stringify({ type: "error", message: "Could not process your photo. Please try a different image." })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "complete", count: 0 })}\n\n`);
      res.end();
      return;
    }

    if (clinicBase64) {
      try {
        res.write(`data: ${JSON.stringify({ type: "progress", current: 0, total: 10, label: "Analysing your clinic..." })}\n\n`);
        const clinicVision = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 300,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe this clinic interior in detail for use in an image generation prompt. Focus on: colours, furniture, lighting, equipment visible, flooring, walls, overall aesthetic and mood. Be specific and concise. 2-3 sentences max." },
                { type: "image_url", image_url: { url: `data:${detectMime(clinicBase64)};base64,${clinicBase64}` } },
              ],
            },
          ],
        });
        const desc = clinicVision.choices[0]?.message?.content?.trim();
        if (desc) clinicDescription = desc;
        console.log("Clinic description:", clinicDescription);
      } catch (vErr: any) {
        console.error("Clinic vision error:", vErr?.message || vErr);
      }
    }

    const clinicSetting = clinicDescription;

    const identity = `IDENTITY LOCK: You MUST preserve this person's exact face, bone structure, skin tone, hair colour, hair texture, hair length, and every distinguishing feature from the reference photo. The face must be instantly recognisable as the same individual. Do not alter, idealise, or smooth any facial feature.`;

    const prompts = [
      { name: "gloves", label: "Pulling on Gloves", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Medium shot, eye-level, 35mm, f/2.8. They are pulling on medical gloves mid-motion, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "arms-folded", label: "Arms Folded", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Medium-full body, eye-level, 35mm, f/2.8. Standing with arms confidently folded, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "editorial", label: "Editorial Pose", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. 3/4 portrait, slight low angle, 35mm, f/2.8, directional contrast lighting. Editorial-style confident pose, direct gaze, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "lipstick", label: "Mirror Lipstick", prompt: `${identity} Close-up shot, 45 degree angle, 35mm, f/2.8. This person applying lipstick in front of a mirror, reflection visible, wearing their same outfit. Soft lighting. Photorealistic photo. No text or watermarks.` },
      { name: "moisturizing", label: "Moisturizing", prompt: `${identity} Extreme close-up, 35mm, f/2.8 shallow DOF. This person applying moisturiser to their face, fingertips pressing gently on skin. Photorealistic photo, soft frontal light. No text or watermarks.` },
      { name: "facial", label: "Performing Facial", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Close-up, slight top-down angle, 35mm, f/2.8. This person performing a facial treatment on a patient, wearing gloves, professional and focused. Photorealistic photo. No text or watermarks.` },
      { name: "proud", label: "Proud Pose", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Medium shot, eye-level, 35mm, f/2.8. Standing proudly with arms folded, shoulders squared, confident warm smile, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "hands-hips", label: "Hands on Hips", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Medium-full portrait, slight low angle, 35mm, f/2.8. Standing with hands on hips, confident stance, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "consultation", label: "Consultation", prompt: `${identity} Place this person in their clinic. ${clinicSetting}. Medium shot, eye-level, 35mm, f/2.8. Mid-consultation sitting across from a client, natural hand gesture, engaged expression, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
      { name: "linkedin", label: "LinkedIn Portrait", prompt: `${identity} Head-and-shoulders portrait, eye-level, 35mm, f/2.8, soft key light with fill. Professional LinkedIn-style portrait of this person, warm natural smile, clean softly blurred background, wearing their same outfit. Photorealistic photo. No text or watermarks.` },
    ];

    let completedCount = 0;
    const BATCH_SIZE = 5;

    const heartbeat = setInterval(() => {
      if (!clientClosed) {
        try { res.write(`: heartbeat\n\n`); } catch {}
      }
    }, 8000);

    let clinicFile: any = null;
    if (clinicBase64) {
      try {
        const clinicBuf = Buffer.from(clinicBase64, "base64");
        const clinicPng = await sharp(clinicBuf).png().toBuffer();
        clinicFile = clinicPng;
      } catch {}
    }

    for (let batchStart = 0; batchStart < prompts.length; batchStart += BATCH_SIZE) {
      if (clientClosed) break;
      const batch = prompts.slice(batchStart, batchStart + BATCH_SIZE);

      const batchLabels = batch.map(p => p.label).join(", ");
      res.write(`data: ${JSON.stringify({ type: "progress", current: batchStart + 1, total: prompts.length, label: `Generating: ${batchLabels}` })}\n\n`);

      const results = await Promise.allSettled(
        batch.map(async (p) => {
          console.log(`Generating: ${p.label}...`);
          const refImages: any[] = [];
          refImages.push(await toFile(Buffer.from(clinicianPngBuf), "clinician.png", { type: "image/png" }));
          if (clinicFile) {
            refImages.push(await toFile(Buffer.from(clinicFile), "clinic.png", { type: "image/png" }));
          }
          const response = await openai.images.edit({
            model: "gpt-image-1",
            image: refImages.length === 1 ? refImages[0] : refImages,
            prompt: p.prompt,
            n: 1,
            size: "1024x1536",
            input_fidelity: "high",
          });
          console.log(`Generated: ${p.label}, has data: ${!!response.data?.[0]?.b64_json}`);
          return { prompt: p, response };
        })
      );

      for (const result of results) {
        if (clientClosed) break;
        if (result.status === "fulfilled") {
          const { prompt: p, response } = result.value;
          const imageData = response.data?.[0];
          if (imageData?.b64_json) {
            const rawBuf = Buffer.from(imageData.b64_json, "base64");
            const resizedBuf = await sharp(rawBuf)
              .resize(1080, 1350, { fit: "cover", position: "centre" })
              .png()
              .toBuffer();
            const imageResult = `data:image/png;base64,${resizedBuf.toString("base64")}`;
            completedCount++;
            res.write(`data: ${JSON.stringify({ type: "portrait", style: p.name, label: p.label, image: imageResult })}\n\n`);
          } else {
            console.error(`No image data for ${p.name}`);
            res.write(`data: ${JSON.stringify({ type: "error", message: `"${p.label}" returned no image - skipping` })}\n\n`);
          }
        } else {
          const failedIdx = results.indexOf(result);
          const p = batch[failedIdx];
          console.error(`Error generating ${p?.name}:`, result.reason?.message || result.reason);
          res.write(`data: ${JSON.stringify({ type: "error", message: `Failed to generate "${p?.label}" - skipping` })}\n\n`);
        }
      }
    }

    clearInterval(heartbeat);

    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ type: "complete", count: completedCount })}\n\n`);
    }
    res.end();
  } catch (err: any) {
    console.error("Clinician recreate error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Recreation failed" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Recreation failed" })}\n\n`);
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

export default router;
