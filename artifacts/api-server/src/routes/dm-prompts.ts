import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const DM_SYSTEM = `You write DM templates for social media managers at aesthetic clinics, dental practices, skin clinics, and wellness businesses.

Write the way a real person messages someone — direct, warm, and natural. These should feel like texts from a genuine clinic owner or manager, not something drafted in a marketing meeting.

Non-negotiable rules:
- Short sentences only. No sentence longer than 20 words.
- Never open with "I hope this finds you well" or any version of that phrase.
- Never use "I just wanted to reach out" — banned.
- Never use "I'd love to connect" — banned.
- Never use "excited to share", "thrilled to announce", or similar — banned.
- Never use "here's the thing", "game changer", "no fluff", "at the end of the day", "deep dive" — banned.
- Never use em dashes.
- No hashtags in DMs.
- No bullet points inside the DM text — write as natural flowing lines.
- No excessive exclamation marks. Maximum one per template, and only if it feels genuinely natural.
- Contractions are fine and preferred — we're, I've, you're, it's.
- Vary how each template opens. No two should start the same way.
- Write 3 distinct templates numbered 1, 2, 3. Each should feel genuinely different in tone, not three slight variations of the same message.
- Leave a placeholder like [Name] where the recipient's name would go, but only if using it feels natural — not every DM needs to start with a name.`;

const SCENARIO_PROMPTS: Record<string, string> = {
  "new-follower": "Write 3 DM templates to send to a new follower shortly after they follow the account. The goal is to make them feel welcomed and open a natural conversation — not to sell immediately. It should feel like a genuine hello, not an automated sequence.",
  "consultation-enquiry": "Write 3 DM templates to reply to someone who has enquired about booking a consultation. The goal is to answer warmly, keep things moving, and make booking feel easy — not pushy.",
  "price-enquiry": "Write 3 DM templates to reply to someone asking about prices or packages. Acknowledge the question, be helpful, and invite them to book a free consultation to discuss their specific needs — without giving a hard price list in the DM.",
  "collab-outreach": "Write 3 DM templates to send to a local influencer or small business about a potential collaboration or partnership. Keep it brief and genuine. Do not make it sound like a mass outreach message.",
  "no-show-follow-up": "Write 3 DM templates to follow up with someone who missed their appointment. Warm, no guilt-tripping, easy for them to rebook. Keep it short.",
  "review-request": "Write 3 DM templates to ask a recent client for a review or testimonial after their appointment. Friendly, low pressure, and genuine — not a copy-paste corporate ask.",
  "post-treatment-check-in": "Write 3 DM templates to check in with a client a few days after their treatment. Caring, brief, and natural. Ask how they're getting on without it feeling like a survey.",
  "lapsed-client": "Write 3 DM templates to reach out to a client who hasn't booked in a while. Warm and personal — not a discount-pushing re-engagement email dressed up as a DM.",
};

router.post("/dm-prompts/generate", async (req: Request, res: Response) => {
  try {
    const { clientName, industry, scenario, extraContext } = req.body as {
      clientName?: string;
      industry?: string;
      scenario: string;
      extraContext?: string;
    };

    if (!scenario || !SCENARIO_PROMPTS[scenario]) {
      res.status(400).json({ error: "Invalid scenario" });
      return;
    }

    const scenarioPrompt = SCENARIO_PROMPTS[scenario];
    const contextLines: string[] = [];
    if (clientName) contextLines.push(`Business name: ${clientName}`);
    if (industry) contextLines.push(`Industry: ${industry}`);
    if (extraContext) contextLines.push(`Extra context: ${extraContext}`);

    const userMessage = [
      contextLines.length > 0 ? contextLines.join("\n") : "",
      scenarioPrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: DM_SYSTEM },
        { role: "user", content: userMessage },
      ],
      temperature: 0.85,
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    const templates: string[] = [];
    const blocks = raw.split(/\n(?=\d+[\.\)])/);
    for (const block of blocks) {
      const cleaned = block.replace(/^\d+[\.\)]\s*/, "").trim();
      if (cleaned.length > 20) templates.push(cleaned);
    }

    if (templates.length === 0) {
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      templates.push(lines.join("\n").trim());
    }

    res.json({ templates: templates.slice(0, 3) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
