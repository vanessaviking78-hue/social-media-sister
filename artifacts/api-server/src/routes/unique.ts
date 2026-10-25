import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES, DENTAL_RULES, isDental } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";

const router: IRouter = Router();

function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[–—]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/!/g, ".")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Exactly five area based hashtags, always, whatever the model sent back.
function fiveTags(raw: unknown, area: string): string[] {
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const parts = area.split(",").map((p) => slug(p)).filter(Boolean);
  const town = parts[0] || "yorkshire";
  const city = parts[1] || parts[0] || "yorkshire";
  const fallback = [`${town}aesthetics`, `${city}aesthetics`, `${town}clinic`, `${city}skincare`, `${city}consultation`, `${town}${city}`, `${city}beauty`];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...fromModel, ...fallback]) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length === 5) break;
  }
  return out.map((t) => `#${t}`);
}

type FieldReq = { key: string; label: string; words: number; current: string };
type Notes = {
  businessName: string; ownerName: string; role: string; area: string; audience: string; brandNotes: string;
  idea: string; cover: string; fresh: boolean; fields: FieldReq[]; asManager: boolean;
};

function systemPrompt(n: Notes): string {
  const who = n.ownerName || "the owner";
  const voice = n.asManager
    ? `You write as a social media manager for the aesthetics industry (never as a clinician), in the first person.`
    : `You write as ${who} themselves, the ${n.role || "owner"} of ${n.businessName} in ${n.area}, in the first person ("I", "my", "you"), never as a social media manager and never as "we".`;
  const freshBlock = n.fresh
    ? `\n- "cover": a JSON object with fresh wording for the cover, same idea and same tone as the current words but a new angle each time. Keys and word limits: ${n.fields.map((f) => `"${f.key}" (${f.label}, max ${f.words} words, currently "${f.current.replace(/\n/g, " / ")}")`).join("; ")}. Keep any clinic name or owner name field exactly as it is. Line breaks inside a value are fine.`
    : "";
  return `${HOUSE_VOICE}

${HOUSE_RULES}
${isDental(n.businessName) ? `\n${DENTAL_RULES}\n` : ""}
The house voice above is the voice for everything you write.

${voice}

THIS IS A UNIQUE POST, a three slide carousel. The cover is a one of a kind designed piece, ${n.idea}. It is playful, tongue in cheek and shareable. Slides 2 and 3 sit over full bleed photos, so each must be short enough to read in a few seconds. Its job is to make a woman smile, feel seen and quietly trust me more. Honest, consultation first, never a hard sell.

THE COVER SHE HAS JUST SEEN:
${n.cover}

WHO SHE IS TALKING TO: ${n.audience || "women aged 35 plus who are curious but wary, who want honesty and nobody pushing them"}. Use the consumer psychology of women over 35: they want to feel seen and safe, they save and share what sounds like a real person, they are tired of being sold to. Stealth sales only.
${n.brandNotes ? `BRAND NOTES: ${n.brandNotes}\n` : ""}
Return these keys:
- "slide2": carries on from the cover with the funny, honest point behind it, a believable specific detail, plain words. 22 to 34 words.
- "slide3": the landing. Warm, a touch funny, a gentle invitation to a conversation with no pressure. 14 to 24 words.
- "cta": ONE short fun question for the last slide, easy to answer in a few words in the comments. Max 14 words. Never Comment WORD, never DM me, never a website.
- "caption": the Instagram caption, max 110 words, told as a short story from my point of view. First line is a hook that lands inside 3 seconds, specific and relatable or funny, never a rhetorical question. Short punchy lines. It adds something the slides do not say. It MUST end with one engaging question on its own final line that is easy to answer in the comments.
- "hashtags": exactly 5, lower case, no spaces, based on the area (${n.area}).${freshBlock}

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". Write what a real person would say.
- Compliance: no promises, guarantees, results, before and after claims, statistics, prices, offers or urgency. Never say a treatment is safe, painless or risk free. Consultation and suitability first. Prescription medicines are never named.
- Never mention Botox, anti-wrinkle or injectables. Never mention a website or a link.
- Never invent a client, a story about a named person, a quote, or a number. Speak about how I work in general terms I could truthfully say.
- Short punchy lines, plain conversational words. No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ "slide2": "...", "slide3": "...", "cta": "...", "caption": "...", "hashtags": ["5 tags"]${n.fresh ? ', "cover": { ... }' : ""} }`;
}

router.post("/unique/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const businessName = str(b.businessName, 80);
    if (!businessName) {
      res.status(400).json({ error: "Pick a client first" });
      return;
    }
    const fresh = b.fresh === true;
    const fields: FieldReq[] = fresh && Array.isArray(b.fields)
      ? (b.fields as Record<string, unknown>[]).slice(0, 12).map((f) => ({ key: str(f.key, 20), label: str(f.label, 40), words: Math.min(30, Number(f.words) || 6), current: str(f.current, 200) })).filter((f) => f.key)
      : [];
    const notes: Notes = {
      businessName,
      ownerName: str(b.ownerName, 40),
      role: str(b.role, 60),
      area: str(b.area, 80) || "Yorkshire",
      audience: str(b.audience, 200),
      brandNotes: str(b.brandNotes, 600),
      idea: str(b.idea, 300) || "a playful notice",
      cover: str(b.cover, 1200),
      fresh: fresh && fields.length > 0,
      fields,
      asManager: /social media sister/i.test(businessName),
    };
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(notes) + (await clientProfileContext(notes.businessName)) },
        { role: "user", content: `Write the Unique post for ${notes.businessName}.` },
      ],
      temperature: 0.95,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);
    let cover: Record<string, string> | undefined;
    if (notes.fresh && j.cover && typeof j.cover === "object") {
      cover = {};
      for (const f of fields) {
        const v = clean((j.cover as Record<string, unknown>)[f.key], 160);
        if (v) cover[f.key] = v;
      }
    }
    res.json({
      slide2: clean(j.slide2, 300),
      slide3: clean(j.slide3, 200),
      cta: clean(j.cta, 120),
      caption: clean(j.caption, 900),
      hashtags: fiveTags(j.hashtags, notes.area),
      ...(cover ? { cover } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unique posts copy failed";
    req.log?.error({ err }, "unique: copy error");
    res.status(500).json({ error: message });
  }
});

export default router;
