import { isFinalCta } from "../lib/hookBank";
import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";
import { RYDER_TONE } from "./caption-generator";

// CASTLE CLINIC and DR KATHRYN BELL: their own dental pages. Very professional, warm and sincere,
// written as the dentist in the first person, one carousel at a time.
const router: IRouter = Router();

const CLINICS: Record<string, { name: string; dentist: string }> = {
  castle: { name: "Castle Clinic", dentist: "the dentist who runs Castle Clinic" },
  kathryn: { name: "Dr Kathryn Bell", dentist: "Dr Kathryn Bell, a dentist" },
};

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

// Exactly five hashtags, each joining the clinic's area to a beauty, skin or wellbeing theme.
function fiveTags(raw: unknown, area: string): string[] {
  const town = slug(area);
  const themed = (t: string) => /(beauty|mum|mam|smile|teeth|dental|dentist|orthodont|oral|selfcare|wellness|health|clinic|family|kids)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = town ? fromModel.filter((t) => t.includes(town) && themed(t)) : [];
  const fallback = town ? [`${town}dentist`, `${town}dental`, `${town}smile`, `${town}teeth`, `${town}mums`, `${town}beauty`, `${town}familydentist`] : ["dentist", "dental", "smile", "oralhealth", "teeth"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...related, ...fallback]) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length === 5) break;
  }
  return out.map((t) => `#${t}`);
}

// The last slide line. Treatment posts always close on the DM line. Every other post gets an area line,
// picked at random and kept different from the other posts she has already made.
const TREATMENT_CTA = "If this sounds like something you'd be interested in, drop me a DM.";
const AREA_CTAS = [
  "If you're in {area} and would like to know more, follow along.",
  "If you're in {area} and want gentle, careful dentistry with a smile, meet me in the DMs.",
  "If you're in {area} and the surrounding areas and are looking for treatment with someone who cares, feel free to ask me any questions.",
  "If you are near {area} and would like a considered conversation before deciding anything, my DMs are open.",
  "If you live in or around {area} and have a question you have been meaning to ask, send me a message.",
  "If you're in {area} and would like to talk it through with a dentist, I would love to hear from you in the DMs.",
  "If you're in {area} and would like a little more information, come and say hello in the DMs.",
  "If you are in {area} and the surrounding areas and want honest, unhurried advice, do get in touch.",
];
function pickCta(kind: string, area: string, avoid: string[]): string {
  if (kind === "treatment") return TREATMENT_CTA;
  const where = area || "your area";
  const all = AREA_CTAS.map((t) => t.replace("{area}", where));
  const fresh = all.filter((c) => !avoid.some((a) => a.trim().toLowerCase() === c.toLowerCase()));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function systemPrompt(clinic: { name: string; dentist: string }, brief: string, label: string, area: string): string {
  return `${RYDER_TONE}

${HOUSE_RULES}

The professional voice above overrides any instruction to be funny or jokey. There is no humour. Where the brief is a fun fact or a myth, be curious, light and warm, never jokey.

You write as ${clinic.name}${area ? ` in ${area}` : ""}, a dental practice, as ${clinic.dentist}, in the first person ("I", "my", "you"), never as a social media manager. The voice is composed, courteous and precise, warm and quietly emotional. This page is about dentistry only: never mention aesthetics, skin, injectables or facial treatments.

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. Maximum 12 words. Elegant, specific and sincere. It should make a woman over 35 stop and read. No puns. Do not start with a quotation mark.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, calm, informative and warm, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 110 words. A first line that holds attention. Short, composed lines. It adds something the slides do not say and closes with a question that relates to the post. Its final line is an invitation to get in touch, which is added for you, so do not write one.
- "hashtags": exactly 5, lower case, no spaces${area ? `, each joining ${area} to a dental, smile, teeth or family theme` : ""}.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise, anaesthetic.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there".
- Dental advertising compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency, no superlatives. Never say a treatment is safe or painless, say it is carried out with care and comfort comes first. Never say it will fix or cure anything. A dentist's assessment and suitability come first.
- Only well established, general dental facts. Never invent a statistic, a study, a number of years, a qualification, an award, a patient, a story, a quote or a name.
- Never mention prescription medicines or brand names of any product. The only exceptions are the treatment name "Invisalign" when the brief is about it, and the general term "GLP-1 medicines" when the brief is about them. Never give advice about taking, dosing or stopping any medicine, tell the reader to speak to their prescriber. Never mention a website or a link.
- No exclamation marks. No emojis.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/dental/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 120);
    const who = str(b.clinic, 20);
    const clinic = CLINICS[who];
    const profileName = str(b.clientName, 120) || clinic?.name || "";
    const note = str(b.note, 300);
    const area = str(b.area, 60);
    const kind = str(b.kind, 20);
    const avoid = Array.isArray(b.avoid) ? (b.avoid as unknown[]).map((x) => String(x ?? "")).slice(0, 60) : [];
    if (!clinic) {
      res.status(400).json({ error: "Unknown clinic" });
      return;
    }
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(clinic, brief, label, area) + (await clientProfileContext(profileName)) },
        { role: "user", content: `Write the carousel "${label}" for ${clinic.name}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.8,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = pickCta(kind, area, avoid);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isFinalCta(l) && !/drop me a dm|meet me in the dms|follow along\.?$/i.test(l))
      .join("\n");
    res.json({
      hook: clean(j.hook, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: `${body}\n\n${cta}`,
      hashtags: fiveTags(j.hashtags, area),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "dental: copy error");
    res.status(500).json({ error: message });
  }
});

// The saved photos for each section (root canal, Invisalign and so on), per clinic. Uploaded once, used on every post in that section.
let imagesReady: Promise<void> | null = null;
function ensureImagesTable(): Promise<void> {
  if (imagesReady) return imagesReady;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS dental_images (
      id SERIAL PRIMARY KEY,
      clinic TEXT NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => undefined);
  imagesReady = p;
  p.catch(() => { imagesReady = null; });
  return p;
}

router.get("/dental/images", async (req: Request, res: Response) => {
  try {
    const clinic = String(req.query.clinic ?? "");
    if (!CLINICS[clinic]) { res.status(400).json({ error: "Unknown clinic" }); return; }
    await ensureImagesTable();
    const r = await db.execute(sql`SELECT id, group_id AS "groupId", name, url FROM dental_images WHERE clinic = ${clinic} ORDER BY id`);
    res.json({ images: r.rows });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load the photos" });
  }
});

router.post("/dental/images", async (req: Request, res: Response) => {
  try {
    const body = req.body as { clinic?: unknown; items?: unknown };
    const clinic = String(body.clinic ?? "");
    if (!CLINICS[clinic]) { res.status(400).json({ error: "Unknown clinic" }); return; }
    await ensureImagesTable();
    const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    const rows = items
      .map((i) => ({ groupId: String(i.groupId ?? "").slice(0, 40), name: String(i.name ?? "").slice(0, 200), url: String(i.url ?? "").slice(0, 600) }))
      .filter((i) => i.groupId && i.url.startsWith("http"))
      .slice(0, 100);
    for (const r of rows) {
      await db.execute(sql`INSERT INTO dental_images (clinic, group_id, name, url) VALUES (${clinic}, ${r.groupId}, ${r.name}, ${r.url})`);
    }
    res.json({ added: rows.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save the photos" });
  }
});

router.delete("/dental/images/:id", async (req: Request, res: Response) => {
  try {
    await ensureImagesTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Which photo?" }); return; }
    await db.execute(sql`DELETE FROM dental_images WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not remove it" });
  }
});

export default router;
