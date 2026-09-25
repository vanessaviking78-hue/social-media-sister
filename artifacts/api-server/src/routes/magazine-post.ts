import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { STYLE_PROMPTS, RULES, clean } from "./magazine-maker";
import { scanText, applySwap } from "../lib/newsletterCompliance";

const router: IRouter = Router();

// Runs every line through the compliance scanner and applies each straight swap it offers.
function tidy(text: string, max: number): string {
  let out = clean(text, max * 2);
  for (let pass = 0; pass < 4; pass++) {
    const swaps = scanText(out, "", "x").filter((f) => f.swap !== undefined);
    if (!swaps.length) break;
    for (const f of swaps) out = applySwap(out, f.matched, f.swap as string);
  }
  return clean(out, max);
}

router.post("/magazine-post/copy", async (req: Request, res: Response) => {
  try {
    const { clinicName, treatment, replyWord, style } = req.body as {
      clinicName?: string;
      treatment?: string;
      replyWord?: string;
      style?: string;
    };

    const treat = String(treatment ?? "").trim().slice(0, 60);
    if (!treat) {
      res.status(400).json({ error: "Tell me the treatment first" });
      return;
    }
    // Prescription-only medicines can't be named in public content, so stop here rather than write it.
    const blocked = scanText(treat, "Treatment", "treatment").find((f) => f.severity === "high");
    if (blocked) {
      res.status(400).json({
        error: `"${blocked.matched}" can't be named in public content (${blocked.reason}) Try a non prescription treatment, or something like "Facial aesthetics consultation".`,
      });
      return;
    }

    const word = String(replyWord ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
    const stylePrompt = STYLE_PROMPTS[String(style ?? "1")] ?? STYLE_PROMPTS["1"];
    const clinic = (clinicName ?? "").trim() || "the clinic";

    const systemPrompt = `You write the copy for a 5 page social media magazine post for an aesthetics clinic, ${clinic}, all about ONE treatment: "${treat}". It is a swipe carousel, so every piece of copy must be short enough to read in a couple of seconds.

VOICE: ${stylePrompt}

THE PAGES
1. Cover: the treatment name is the title (already decided, do not write it). You write a tiny kicker above it and a tagline below it.
2, 3 and 4. Three fact pages, each with a headline, a friendly intro line and three quick facts. Together they should tell a little story about the treatment: page 2 what it is and how it works in plain English, page 3 what having it is like and who tends to ask about it, page 4 what to expect afterwards and what a consultation covers.
5. Last page: a photo with "If this interests you, comment ${word || "the reply word"}". You write one short, sly line to sit under it.
Plus a caption for the post itself.

FACTS
- Only include things that are widely and generally accepted about ${treat}. No statistics, no percentages, no timings you are not certain of, no brand or product claims.
- If you are not sure of a detail, say something general and honest instead, or say what a practitioner will talk through at the consultation.
- Never promise or imply a result. Use "may", "can", "some people".
- Make it fun. A surprising angle, a bit of humour, something she would tell a friend. No textbook voice, no boring medical education.

Return JSON only, in exactly this shape and within these limits:
{
  "cover": { "kicker": "max 4 words", "tagline": "max 9 words" },
  "pages": [
    { "kicker": "max 3 words", "headline": "max 7 words", "intro": "max 18 words", "facts": [ { "label": "max 3 words", "text": "max 22 words" }, { "label": "max 3 words", "text": "max 22 words" }, { "label": "max 3 words", "text": "max 22 words" } ] },
    { "kicker": "max 3 words", "headline": "max 7 words", "intro": "max 18 words", "facts": [ same shape x3 ] },
    { "kicker": "max 3 words", "headline": "max 7 words", "intro": "max 18 words", "facts": [ same shape x3 ] }
  ],
  "cta": { "line": "max 12 words, a warm sly nudge to comment, no pressure" },
  "caption": "max 70 words. Opens with a hook, ends by inviting her to comment ${word || "the reply word"} so the details can be sent over. No hashtags."
}
${RULES}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Treatment: ${treat}` },
      ],
      temperature: 0.85,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      res.status(500).json({ error: "No copy came back, try again" });
      return;
    }
    const j = JSON.parse(raw);

    const pages: any[] = Array.isArray(j?.pages) ? j.pages : [];
    const page = (o: any) => {
      const facts: any[] = Array.isArray(o?.facts) ? o.facts : [];
      const fact = (f: any) => ({ label: tidy(f?.label ?? "", 30), text: tidy(f?.text ?? "", 190) });
      return {
        kicker: tidy(o?.kicker ?? "", 30),
        headline: tidy(o?.headline ?? "", 70),
        intro: tidy(o?.intro ?? "", 150),
        facts: [fact(facts[0]), fact(facts[1]), fact(facts[2])],
      };
    };

    res.json({
      cover: {
        kicker: tidy(j?.cover?.kicker ?? "", 30),
        title: treat,
        tagline: tidy(j?.cover?.tagline ?? "", 80),
      },
      pages: [page(pages[0]), page(pages[1]), page(pages[2])],
      cta: { lead: "If this interests you", word, line: tidy(j?.cta?.line ?? "", 100) },
      caption: tidy(j?.caption ?? "", 600),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Magazine post copy failed";
    req.log?.error({ err }, "magazine-post: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
