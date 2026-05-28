import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { trialBundlesTable, founderSignupsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getVoiceSystemPrompt } from "../lib/voicePrompts";

const router: IRouter = Router();

router.post("/bundle/generate", async (req, res) => {
  try {
    const { clinicName, igHandle, treatmentFocus, brandColour, voiceStyle } = req.body;

    if (!clinicName || !treatmentFocus) {
      res.status(400).json({ error: "clinicName and treatmentFocus are required" });
      return;
    }

    const voicePrompt = getVoiceSystemPrompt(voiceStyle || "northern-grit");

    const systemPrompt = `${voicePrompt}

You are generating a complete social media content bundle for a prospect clinic evaluation.

CLINIC DETAILS:
- Name: ${clinicName}
- Instagram handle: ${igHandle || "not provided"}
- Treatment focus: ${treatmentFocus}

Generate 4 content pieces in this exact JSON structure (no extra text, no markdown fences):
{
  "carousel": {
    "slides": [
      {"heading": "hook slide (under 10 words, direct and real)", "body": "optional 1-2 sentence expansion"},
      {"heading": "value point 2", "body": "specific fact or insight for this treatment"},
      {"heading": "value point 3", "body": "specific fact or insight"},
      {"heading": "value point 4", "body": "specific fact or insight"},
      {"heading": "cta slide heading", "body": "warm unhurried invitation — no urgency, no DM us NOW"}
    ],
    "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
  },
  "aboutMe": {
    "intro": "2-3 sentences from the clinic owner's perspective. First person. Warm, real, no patter.",
    "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
  },
  "reel": {
    "script": "3-4 short punchy lines for video overlay text. Each line under 8 words. Lines separated by | characters.",
    "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
  },
  "seamless": {
    "tagline": "one powerful 3-7 word tagline for a seamless panoramic carousel",
    "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
  }
}

Voice style: follow the system prompt voice exactly. All content MHRA/ASA compliant. No em dashes. Each Comment [WORD] CTA must use a different creative uppercase word relevant to that specific post.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate the full content bundle for ${clinicName}, focusing on ${treatmentFocus}. Return ONLY the JSON object.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let content: unknown;
    try {
      content = JSON.parse(raw);
    } catch {
      req.log?.error({ raw }, "Failed to parse bundle AI response");
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const token = randomBytes(20).toString("hex");

    const [bundle] = await db
      .insert(trialBundlesTable)
      .values({
        token,
        clinicName,
        igHandle: igHandle || "",
        treatmentFocus,
        brandColour: brandColour || "#ec4899",
        voiceStyle: voiceStyle || "northern-grit",
        content: content as any,
      })
      .returning();

    res.json({ token: bundle.token, content: bundle.content });
  } catch (err: any) {
    req.log?.error({ err }, "Bundle generation error");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Bundle generation failed" });
    }
  }
});

const FOUNDER_TOTAL = 20;

router.get("/bundle/founder-spots", async (req, res) => {
  try {
    const [{ value: claimed }] = await db
      .select({ value: count() })
      .from(founderSignupsTable);
    const remaining = Math.max(0, FOUNDER_TOTAL - Number(claimed));
    res.json({ remaining, claimed: Number(claimed), total: FOUNDER_TOTAL });
  } catch (err: any) {
    req.log?.error({ err }, "Founder spots fetch error");
    res.status(500).json({ error: "Failed to fetch founder spots" });
  }
});

router.post("/bundle/founder-signup", async (req, res) => {
  try {
    const { name, email, clinicName, phone, bundleToken } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "name and email are required" });
      return;
    }
    const [{ value: claimed }] = await db
      .select({ value: count() })
      .from(founderSignupsTable);
    if (Number(claimed) >= FOUNDER_TOTAL) {
      res.status(409).json({ error: "All founder spots have been claimed" });
      return;
    }
    const [signup] = await db
      .insert(founderSignupsTable)
      .values({
        name: name.trim(),
        email: email.trim(),
        clinicName: clinicName?.trim() ?? "",
        phone: phone?.trim() ?? "",
        bundleToken: bundleToken || null,
      })
      .returning();
    res.json({ id: signup.id, remaining: Math.max(0, FOUNDER_TOTAL - Number(claimed) - 1) });
  } catch (err: any) {
    req.log?.error({ err }, "Founder signup error");
    res.status(500).json({ error: err.message || "Signup failed" });
  }
});

router.get("/bundle/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [bundle] = await db
      .select()
      .from(trialBundlesTable)
      .where(eq(trialBundlesTable.token, token))
      .limit(1);

    if (!bundle) {
      res.status(404).json({ error: "Bundle not found" });
      return;
    }

    res.json(bundle);
  } catch (err: any) {
    req.log?.error({ err }, "Bundle fetch error");
    res.status(500).json({ error: err.message || "Failed to fetch bundle" });
  }
});

export default router;
