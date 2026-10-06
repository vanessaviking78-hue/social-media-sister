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
- ALWAYS write in the first person (I, me, my, and we or our when speaking for the clinic). Never write in the third person about the clinic, the team or the practitioner. Use UK spelling.
- NEVER use em dashes (—) or en dashes (–). Not once. Use a comma, a full stop, or a plain hyphen in compound adjectives only.
- No exclamation marks unless they genuinely earn it. One per caption maximum.
- BANNED words: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, boasts, nestled, seamless, effortless, next level, top-tier, being honest, the truth is, at the end of the day, when it comes to, look no further, say goodbye to, buckle up, spoiler alert, trust me, make no mistake, fluff, faff, fuss, game changer, hack, vibes
- BANNED hook openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world", "In a world where", "In the ever-changing landscape"
- Use contractions naturally: you're, it's, don't, we're, that's.
- British English throughout. "colour" not "color". "practitioner" not "provider". "clinic" not "office".
- Write in first person, as the clinician/owner posting this themselves.
- Keep it informal and colloquial, like the clinician talking to a mate, not a brand talking to a customer. Warm, a bit cheeky where it fits, genuinely funny if the moment allows it, but it should still read like a professional said it, not like someone trying too hard to be funny.
- 3 to 6 short sentences, split into 2 to 4 short chunks of one or two sentences each, with a blank line between each chunk. Never write it as one solid block of text, captions are read broken up like that.
- No hashtags. No emojis unless the context clearly calls for one, and never more than one.
- If a sentence could have been written by a chatbot, delete it and write what you would actually say instead.
- Do not use the construction where it is not about X, it is about Y, or any rule of three escalation that sounds like a TED talk. Do not open with a rhetorical question. Say the thing plainly, the way you would actually say it to someone face to face.
- Never use negative parallelism in any form: no "it's not X, it's Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z", "don't X, do Y", "isn't about X, it's about Y". State the positive point directly.
- EVERY caption ends with one short, genuine question that relates to that post and invites a comment (for example a question about her own memory, her own experience or her own opinion on what the post is about). The question is the very last line, with nothing after it.
- Humanise everything. Write like a real woman in her own voice, with specific details, small asides and the odd imperfect sentence. No AI patter, no neat summing up line, no tidy moral at the end.`;


export const isRyder = (name?: string) => /ryder/i.test(name ?? "");

export const RYDER_TONE = `THE RYDER CLINIC VOICE, ALWAYS: extremely professional language. Polished, measured, courteous and precise, the way a respected consultant writes to a patient she cares about. No jokes, no japes, no puns, no slang, no sarcasm, no cheekiness, no emojis, no exclamation marks. Emotionally intelligent and genuinely affable: warm, gracious, reassuring and human, with real feeling in the details (a patient's quiet moment of confidence, the trust built in a consultation, the dignity of feeling like yourself). Evoke emotion through sincerity and specific, tender observation, never through humour.`;

// The Ryder Clinic is always written in a very professional, emotive and affable voice, with no humour.
export function captionVoice(clinicName: string | undefined, tonePrompt: string): { tonePrompt: string; rules: string } {
  if (!isRyder(clinicName)) return { tonePrompt, rules: BASE_RULES };
  const rules = BASE_RULES
    .replace(/- Keep it informal and colloquial[^\n]*/, "- Write in very professional, polished language. Warm, gracious and affable, never chatty, never jokey, no slang, no banter, no humour of any kind. Emotion comes from sincerity and specific, tender detail.")
    .replace(/- Use contractions naturally[^\n]*/, "- Prefer full forms over contractions where it reads more polished.")
    .replace(/- No exclamation marks[^\n]*/, "- No exclamation marks and no emojis.");
  return { tonePrompt: RYDER_TONE, rules };
}

router.post("/caption-generator/generate", async (req: Request, res: Response) => {
  try {
    const { tone, context, clinicName, location } = req.body as {
      tone?: string;
      context?: string;
      clinicName?: string;
      location?: string;
    };
    const area = typeof location === "string" ? location.replace(/[\r\n]+/g, " ").trim().slice(0, 120) : "";

    if (!context || !context.trim()) {
      res.status(400).json({ error: "Context is required" });
      return;
    }

    const toneKey = String(tone ?? "2");
    const voice = captionVoice(clinicName, CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["2"]);
    const tonePrompt = voice.tonePrompt;

    const systemPrompt = `You write a single Instagram/Facebook caption for an aesthetics clinic post.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}
${area ? `
LOCAL SEO: the clinic is in ${area}. Make the caption strong for local search on Instagram and Facebook. Name ${area} naturally once or twice in the body, the way a local would say it, and use the treatment name in plain words a client would type into a search bar. End with one line of hashtags: a mix of 2 or 3 local ones (for example the town, the county or region, and the treatment plus the town as one tag) and 2 or 3 broader treatment tags. Never invent a street address, a postcode or a landmark, and only use the place names given here. Do not stuff keywords. It must still read like a person talking.` : ""}

Write one caption for the post described below. Return plain text only, no JSON, no quote marks around it, no title.
${voice.rules}`;

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
    const voice = captionVoice(clinicName, CAPTION_TONE_PROMPTS[toneKey] ?? CAPTION_TONE_PROMPTS["2"]);
    const tonePrompt = voice.tonePrompt;

    const systemPrompt = `You write a single Instagram/Facebook caption for an aesthetics clinic post. You will be shown an image, which may be a branded quote card, a photo, or a graphic with text on it. First read any words in the image carefully. If it is a quote card, base the caption on that quote, do not just repeat it verbatim, write a caption that captures its meaning in your own words unless the quote itself is short enough to use directly.

TONE: ${tonePrompt}

${clinicName ? `Clinic: ${clinicName}` : ""}

Write one caption for this image. Return plain text only, no JSON, no quote marks around it, no title.
${voice.rules}`;

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

export default router;
