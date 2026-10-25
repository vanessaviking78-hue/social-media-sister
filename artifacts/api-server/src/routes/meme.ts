import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { clientProfileContext } from "./client-profiles";

const router: IRouter = Router();

const MEME_SYSTEM = `You write wild, feral, savage meme quotes for an aesthetic clinic's social media. The audience is women over 35. The voice is sarcastic, unfiltered and gloriously over the top, like a woman who has stopped apologising and is saying it at full volume over a gin. Dawn French energy with the safety catch off. Funny first, always laughing WITH these women.

Hard rules, never broken:
- The target of the joke is life, other people, technology, the school run, hormones, husbands, bins, group chats, sleep, queues, the state of the world. Never the woman's face, skin, body, weight or age. Never wrinkle-shame, never mention looking old, sagging, grey hair or anything appearance based.
- Never mention botox, fillers, injectables, anti-wrinkle, tweakments, prescriptions or any clinic treatment.
- Savage and sarcastic is welcome. Cruel to the reader is not. No swearing stronger than "bloody", "hell" or "sodding".
- Each quote is a standalone line or two of 8 to 25 words, written in first person or as a blunt statement. It must be quotable and screenshot-able, with a punchline that lands at the end.
- Make all five completely different in angle, rhythm and structure. No two should start the same way.
- No em dashes or en dashes. No hashtags. No emojis. No quotation marks around the quote.
- British spelling and British references.
- Never use negative parallelism (no "it's not X, it's Y", "not just X but Y", "less X, more Y"). Never sound like a chatbot or a motivational poster.

Return ONLY a JSON object in this exact shape: {"quotes":["quote 1","quote 2","quote 3","quote 4","quote 5"]}`;

function clean(q: unknown): string {
  return String(q ?? "")
    .replace(/[—–]/g, ",")
    .replace(/#\w+/g, "")
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

router.post("/meme/lines", async (req: Request, res: Response) => {
  try {
    const { topic, exclude, clientName } = req.body as { topic?: string; exclude?: string[]; clientName?: string };
    const profileCtx = await clientProfileContext(clientName);
    if (!topic || !topic.trim()) {
      res.status(400).json({ error: "A topic is required" });
      return;
    }
    const seen = Array.isArray(exclude) ? exclude.filter((x) => typeof x === "string").slice(-30) : [];
    const user =
      `Topic: ${topic.trim().slice(0, 200)}` +
      (seen.length ? `\n\nI have already seen these, so write five completely new ones that do not repeat their jokes or structure:\n${seen.map((s) => `- ${s}`).join("\n")}` : "");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MEME_SYSTEM + profileCtx },
        { role: "user", content: user },
      ],
      temperature: 1.0,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let quotes: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { quotes?: unknown };
      if (Array.isArray(parsed.quotes)) quotes = parsed.quotes.map(clean);
    } catch {
      quotes = raw
        .split("\n")
        .map((l) => clean(l.replace(/^\s*\d+[\).\s-]*/, "")))
        .filter((l) => l.length > 8);
    }
    quotes = Array.from(new Set(quotes.filter((q) => q.length > 0))).slice(0, 5);
    if (!quotes.length) {
      res.status(502).json({ error: "No quotes came back, press the button again" });
      return;
    }
    res.json({ quotes });
  } catch (err: any) {
    req.log?.error({ err }, "meme: lines error");
    res.status(500).json({ error: err?.message || "Failed to generate meme quotes" });
  }
});

export default router;
