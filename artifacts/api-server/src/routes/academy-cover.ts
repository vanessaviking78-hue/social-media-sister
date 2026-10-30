import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES, ACADEMY_RULES } from "../lib/houseRules";

const router: IRouter = Router();

type FieldReq = { key: string; label: string; words: number; current: string };

const clean = (text: unknown, max: number): string =>
  typeof text !== "string"
    ? ""
    : text.replace(/[–—]/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/!/g, ".").replace(/[ \t]+/g, " ").trim().slice(0, max);

// Rewrites the words on a post's cover so a training academy can use any of the clinic designs.
router.post("/academy/cover", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const businessName = str(b.businessName, 80);
    if (!businessName) {
      res.status(400).json({ error: "Pick a client first" });
      return;
    }
    const fields: FieldReq[] = (Array.isArray(b.fields) ? (b.fields as Record<string, unknown>[]) : [])
      .slice(0, 24)
      .map((f) => ({ key: str(f.key, 24), label: str(f.label, 60), words: Math.min(30, Math.max(1, Number(f.words) || 5)), current: str(f.current, 240) }))
      .filter((f) => f.key);
    if (!fields.length) {
      res.status(400).json({ error: "No cover fields to write" });
      return;
    }
    const who = str(b.ownerName, 40) || "the owner";
    const system = `${HOUSE_VOICE}

${HOUSE_RULES}

${ACADEMY_RULES}

You are rewriting the words printed on the cover of a designed Instagram post for ${businessName}, run by ${who} (${str(b.role, 60) || "founder"}) in ${str(b.area, 80)}. The design is a template made for a patient facing aesthetics clinic, and the words on it must now speak for the training academy instead, to practitioners and people thinking about training.
Design: "${str(b.designName, 120)}". Original idea of the design, for the shape of the joke or format only: ${str(b.idea, 300)}.
Keep the format, structure and comic device of the design (a notice, a receipt, a poster, a list, a stamp, a chat) and swap the subject to the academy: training days, first day nerves, learning hands on, supervision, kit bags, imposter syndrome, practitioner life. Keep it funny, specific and kind.

FIELD RULES
- Return every key listed below, in a JSON object called "cover", and nothing else.
- Respect the word limit of each field. Line breaks inside a value are fine where the current words have them.
- Keep a field exactly as it is when the current words are a token such as {owner}, {clinic} or {area}, a name, a clinic name, a number, a date or a price-free label like a ref or page number.
- Leave a field empty when it is empty now.
- Never write a price or a figure of money. If a field currently holds a price, replace it with a small funny non-money phrase of the same length.
- Never mention Botox, anti-wrinkle, injectables, prescription medicines, a website, a link or a person's name other than ${who}.
- UK English. No em dashes or en dashes. No negative parallelism. No AI patter.

FIELDS (key, label, max words, current words)
${fields.map((f) => `- "${f.key}" (${f.label}, max ${f.words}): "${f.current.replace(/\n/g, " / ")}"`).join("\n")}

Return JSON only: { "cover": { ${fields.map((f) => `"${f.key}": "..."`).join(", ")} } }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Write the academy cover words for ${businessName}.` },
      ],
      temperature: 0.9,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No cover words came back, try again");
    const j = JSON.parse(raw);
    const cover: Record<string, string> = {};
    for (const f of fields) {
      const v = (j.cover as Record<string, unknown> | undefined)?.[f.key];
      if (typeof v === "string") cover[f.key] = clean(v, 240);
    }
    res.json({ cover });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "The cover words would not write, try again" });
  }
});

export default router;
