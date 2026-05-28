import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { trialBundlesTable } from "@workspace/db/schema";
import { randomBytes } from "crypto";
import { getVoiceSystemPrompt } from "./voicePrompts";
import { logger } from "./logger";

export interface GenerateBundleOptions {
  clinicName: string;
  igHandle?: string;
  treatmentFocus: string;
  brandColour?: string;
  voiceStyle?: string;
  topics?: string[];
}

export async function generateBundleContent(opts: GenerateBundleOptions): Promise<{ token: string; content: unknown }> {
  const { clinicName, igHandle, treatmentFocus, brandColour, voiceStyle, topics } = opts;

  const voicePrompt = getVoiceSystemPrompt(voiceStyle || "northern-grit");

  const topicLines = Array.isArray(topics) && topics.length === 4
    ? `\nCONTENT ANGLES (use these as the specific angle/topic for each format — adapt to the clinic's treatment focus):
- Carousel: "${topics[0]}"
- About Me: "${topics[1]}"
- Reel: "${topics[2]}"
- Seamless: "${topics[3]}"\n`
    : "";

  const systemPrompt = `${voicePrompt}

You are generating a complete social media content bundle for a prospect clinic evaluation.

CLINIC DETAILS:
- Name: ${clinicName}
- Instagram handle: ${igHandle || "not provided"}
- Treatment focus: ${treatmentFocus}
${topicLines}
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
    logger.error({ raw }, "Failed to parse bundle AI response");
    throw new Error("Failed to parse AI response");
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

  return { token: bundle.token, content: bundle.content };
}
