import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE, HOUSE_RULES } from "../lib/houseRules";
import { clientProfileContext } from "./client-profiles";
import { finalCta, isFinalCta } from "../lib/hookBank";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSamplesTable } from "@workspace/db/schema";

// NO 1 BODY SCULPTING, Birmingham. Her own page, one carousel at a time.
const router: IRouter = Router();

const CLINIC = "NO 1 BODY SCULPTING";
const AREA = "Birmingham";

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

// Exactly five hashtags, all Birmingham joined to a beauty or mums theme.
function fiveTags(raw: unknown): string[] {
  const town = slug(AREA);
  const themed = (t: string) => /(beauty|mum|mam|mummy|mummies|mother|skin|glow|aesthetic|facial|selfcare|body|sculpt)/.test(t);
  const fromModel = Array.isArray(raw) ? raw.map((t) => slug(String(t ?? ""))).filter(Boolean) : [];
  const related = fromModel.filter((t) => t.includes(town) && themed(t));
  const fallback = [`${town}beauty`, `${town}mums`, `${town}skincare`, `${town}selfcare`, `${town}bodysculpting`, `${town}mumlife`, `${town}glow`];
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

function systemPrompt(brief: string, label: string, hasWord: boolean): string {
  return `${HOUSE_VOICE}

${HOUSE_RULES}

The house voice above is the voice for everything you write.

You write as the owner of ${CLINIC} in ${AREA}, in the first person ("I", "my", "you"), never as a social media manager and never as "we". She is glamorous, warm, loyal and straight talking, very dry and playful, honest, down to earth and never about the money. She is the clinician, so she speaks as herself. Never mention her dog, her sons, her friends or the gym, and never assume the reader has children, unless the brief itself is about her life. Treatment, skin, volume, menopause, weight loss, tweet and trust posts stay about the reader and the treatment only.

THIS IS A FIVE SLIDE CAROUSEL: "${label}".
THE BRIEF: ${brief}

THE SLIDES
- "hook": slide 1, the cover line. Maximum 12 words. It must stop a woman over 35 scrolling. Specific, relatable or funny, never generic.
- "slide2", "slide3", "slide4": each is EXACTLY three sentences, friendly but informative, each carrying on from the one before.
- The last slide is set for you, leave "cta" as an empty string.
- "caption": the Instagram caption, maximum 110 words. First line is a hook that lands inside 3 seconds. Short punchy lines. It adds something the slides do not say. At least one genuinely funny line, dry and warm. ${hasWord ? "Its final line must be the comment line, which is added for you, so do not write it." : "Its final line must be the line a closing engagement line, which is added for you, so do not write it."}
- "hashtags": exactly 5, lower case, no spaces, each one joins Birmingham to a beauty, mums or skin theme. Every tag contains birmingham.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If it sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency. Never say a treatment is safe, painless or risk free. Never say it will fix or cure anything. Keep consultation and suitability first.
- Never name any medication, drug or injection used for weight loss, and never mention prescription medicines, hormone treatment, Botox, anti-wrinkle or injectables. Never mention a website or a link.
- The intimate wellness machine is only ever about comfort and confidence. Never claim it treats bladder control, incontinence or any condition.
- No swearing. No exclamation marks. No emojis.
- Never invent a client, a story, a quote, a name or a number. Talk about how I work in general terms I could truthfully say.
- Be kind about bodies, always. The patient's biggest worry is showing her body, so every line should make her feel safe and unjudged.

Return JSON only, in exactly this shape:
{ "hook": "...", "slide2": "...", "slide3": "...", "slide4": "...", "cta": "", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/no1/copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 120);
    const word = str(b.word, 40);
    const note = str(b.note, 300);
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post type first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt(brief, label, !!word) + (await clientProfileContext(CLINIC)) },
        { role: "user", content: `Write the carousel "${label}" for ${CLINIC}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = finalCta(word);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isFinalCta(l))
      .join("\n");
    res.json({
      hook: clean(j.hook, 140),
      slides: [clean(j.slide2, 340), clean(j.slide3, 340), clean(j.slide4, 340)],
      cta,
      caption: `${body}\n\n${cta}.`,
      hashtags: fiveTags(j.hashtags),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "no1: copy error");
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Her static page: one image per post. Same voice and rules as the carousels, written for one picture.
// ---------------------------------------------------------------------------
function staticPrompt(brief: string, label: string, hasWord: boolean, isTweet: boolean): string {
  return `${HOUSE_VOICE}

${HOUSE_RULES}

The house voice above is the voice for everything you write.

You write as the owner of ${CLINIC} in ${AREA}, in the first person ("I", "my", "you"), never as a social media manager and never as "we". She is glamorous, warm, loyal and straight talking, very dry and playful, honest, down to earth and never about the money. She is the clinician, so she speaks as herself. Never mention her dog, her sons, her friends or the gym, and never assume the reader has children.

THIS IS A SINGLE STATIC IMAGE POST: "${label}".
THE BRIEF: ${brief}

THE IMAGE
- "hook": the words on the picture. ${isTweet ? "It is the tweet itself, one or two short sentences, maximum 30 words, blunt and shareable." : "Maximum 14 words. It must stop a woman over 35 scrolling. Specific, relatable or funny, never generic."}
- "line": ${isTweet ? "leave this as an empty string" : "one short supporting sentence for under the headline, maximum 22 words, friendly and plain"}.
- "caption": the Instagram caption, maximum 110 words. First line lands inside 3 seconds. Short punchy lines. It adds something the picture does not say. At least one genuinely funny line, dry and warm. ${hasWord ? "Its final line is the comment line, which is added for you, so do not write it." : "Its final line is a closing engagement line, which is added for you, so do not write it."}
- "hashtags": exactly 5, lower case, no spaces, each one joins Birmingham to a beauty, mums or skin theme. Every tag contains birmingham.

WRITING RULES (non-negotiable)
- NEVER use em dashes or en dashes. Use a comma, a full stop or a plain hyphen in compound words only.
- British English throughout: colour, favourite, programme, organise. No Americanisms.
- NEVER use negative parallelism ("It's not about X, it's about Y", "not just X but Y", "less X, more Y", "no X, no Y, just Z").
- No AI patter. Banned: elevate, transform, unlock, journey, empower, game-changer, dive into, delve, navigate, seamless, effortless, next level, bespoke, holistic, fluff, faff, "fuss", "we've all been there". If it sounds like a chatbot or a LinkedIn post, write what a real person would say.
- Compliance: no promises, no guarantees, no results, no before and after claims, no statistics, NO PRICES, no offers, no urgency. Never say a treatment is safe, painless or risk free. Never say it will fix or cure anything. Keep consultation and suitability first.
- Never name any medication, drug or injection used for weight loss, and never mention prescription medicines, hormone treatment, HRT, Botox, anti-wrinkle or injectables. Never mention a website or a link.
- The intimate wellness machine is only ever about comfort and confidence. Never claim it treats bladder control, incontinence or any condition.
- No swearing. No exclamation marks. No emojis.
- Never invent a client, a story, a quote, a name or a number.
- Be kind about bodies, always. Every line should make her feel safe and unjudged.

Return JSON only, in exactly this shape:
{ "hook": "...", "line": "...", "caption": "...", "hashtags": ["5 tags"] }`;
}

router.post("/no1/static-copy", async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const brief = str(b.brief, 1200);
    const label = str(b.label, 160);
    const word = str(b.word, 40);
    const note = str(b.note, 300);
    const isTweet = b.tweet === true;
    if (!brief || !label) {
      res.status(400).json({ error: "Pick a post first" });
      return;
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: staticPrompt(brief, label, !!word, isTweet) + (await clientProfileContext(CLINIC)) },
        { role: "user", content: `Write the single image post "${label}" for ${CLINIC}.${note ? ` Extra from her: ${note}` : ""}` },
      ],
      temperature: 0.9,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("No copy came back, try again");
    const j = JSON.parse(raw);

    const cta = finalCta(word);
    const body = clean(j.caption, 900)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isFinalCta(l))
      .join("\n");
    res.json({
      hook: clean(j.hook, 200),
      line: isTweet ? "" : clean(j.line, 220),
      caption: `${body}\n\n${cta}.`,
      hashtags: fiveTags(j.hashtags),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "The words would not write, try again";
    req.log?.error({ err }, "no1: static copy error");
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Her download page. Vanessa builds posts on /no1 and sends them here, one at a time. They all land on one
// private link (shown by the same Pack page the clinics' packs use), so the client opens one address and
// saves her slides and captions from it.
// ---------------------------------------------------------------------------
const PUBLISH_SLUG = "no1-body-sculpting-posts";
type StoredPost = { n: number; kind: string; images: string[]; caption: string; tags: string; label?: string };
type StoredData = { pack: true; size: number; logoUrl: string; accent: string; posts: StoredPost[] };

async function loadRow() {
  const [row] = await db.select().from(freeSamplesTable).where(eq(freeSamplesTable.slug, PUBLISH_SLUG));
  return row;
}

async function saveData(data: StoredData) {
  const row = await loadRow();
  if (row) await db.update(freeSamplesTable).set({ data }).where(eq(freeSamplesTable.slug, PUBLISH_SLUG));
  else await db.insert(freeSamplesTable).values({ slug: PUBLISH_SLUG, clinicName: CLINIC, data });
}

router.post("/no1/publish", async (req: Request, res: Response) => {
  try {
    const b = req.body as { label?: string; images?: string[]; caption?: string; tags?: string };
    const images = (Array.isArray(b.images) ? b.images : []).map((u) => String(u ?? "").trim().slice(0, 400)).filter(Boolean);
    if (images.length === 0) {
      res.status(400).json({ error: "The slides are needed" });
      return;
    }
    const row = await loadRow();
    const existing = (row?.data as Partial<StoredData> | undefined) ?? {};
    const posts = [...(existing.posts ?? [])];
    const n = posts.reduce((m, p) => Math.max(m, p.n), 0) + 1;
    posts.push({
      n,
      kind: "carousel",
      label: clean(b.label, 120),
      images,
      caption: clean(b.caption, 1500),
      tags: clean(b.tags, 300),
    });
    await saveData({ pack: true, size: posts.length, logoUrl: "/no1-logo.png", accent: "#1aa5bd", posts });
    res.json({ n, total: posts.length });
  } catch (err: unknown) {
    req.log?.error({ err }, "no1: publish error");
    res.status(500).json({ error: err instanceof Error ? err.message : "That did not save, try again" });
  }
});

router.post("/no1/unpublish", async (req: Request, res: Response) => {
  try {
    const n = Number((req.body as { n?: unknown }).n);
    const row = await loadRow();
    if (!row) {
      res.json({ total: 0 });
      return;
    }
    const data = row.data as StoredData;
    const posts = (data.posts ?? []).filter((p) => p.n !== n);
    await saveData({ ...data, size: posts.length, posts });
    res.json({ total: posts.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "That did not remove, try again" });
  }
});

router.get("/no1/published", async (_req: Request, res: Response) => {
  try {
    const row = await loadRow();
    const posts = ((row?.data as Partial<StoredData> | undefined)?.posts ?? []).map((p) => ({ n: p.n, label: p.label ?? "", slides: p.images.length }));
    res.set("Cache-Control", "no-store");
    res.json({ slug: PUBLISH_SLUG, posts });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});

// ---------------------------------------------------------------------------
// Feed preview for the owner. Vanessa sends her written statics here, newest first, and the owner opens one
// private link (/no1feed) to see them laid out like her Instagram grid. Nothing is posted from this.
// ---------------------------------------------------------------------------
const FEED_SLUG = "no1-statics-feed";
type FeedPost = { id: string; label: string; image: string; caption: string; tags: string };

function feedAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

async function loadFeed(): Promise<FeedPost[]> {
  const [row] = await db.select().from(freeSamplesTable).where(eq(freeSamplesTable.slug, FEED_SLUG));
  return (((row?.data as { posts?: FeedPost[] } | undefined)?.posts) ?? []).filter((p) => p && p.image);
}

async function saveFeed(posts: FeedPost[]) {
  const [row] = await db.select().from(freeSamplesTable).where(eq(freeSamplesTable.slug, FEED_SLUG));
  const data = { feed: true, posts };
  if (row) await db.update(freeSamplesTable).set({ data }).where(eq(freeSamplesTable.slug, FEED_SLUG));
  else await db.insert(freeSamplesTable).values({ slug: FEED_SLUG, clinicName: CLINIC, data });
}

router.get("/no1/feed", async (_req: Request, res: Response) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json({ clinic: CLINIC, posts: await loadFeed() });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});

router.post("/no1/feed", feedAuth, async (req: Request, res: Response) => {
  try {
    const incoming = Array.isArray((req.body as { posts?: unknown }).posts) ? ((req.body as { posts: unknown[] }).posts as Record<string, unknown>[]) : [];
    const fresh: FeedPost[] = incoming
      .map((p) => ({
        id: clean(p.id, 60),
        label: clean(p.label, 140),
        image: String(p.image ?? "").trim().slice(0, 400),
        caption: clean(p.caption, 1800),
        tags: clean(p.tags, 300),
      }))
      .filter((p) => p.id && p.image);
    if (fresh.length === 0) {
      res.status(400).json({ error: "There are no posts to show" });
      return;
    }
    const ids = new Set(fresh.map((p) => p.id));
    const kept = (await loadFeed()).filter((p) => !ids.has(p.id));
    const posts = [...fresh, ...kept].slice(0, 120);
    await saveFeed(posts);
    res.json({ total: posts.length });
  } catch (err: unknown) {
    req.log?.error({ err }, "no1: feed save error");
    res.status(500).json({ error: err instanceof Error ? err.message : "That did not save, try again" });
  }
});

router.post("/no1/feed/clear", feedAuth, async (_req: Request, res: Response) => {
  try {
    await saveFeed([]);
    res.json({ total: 0 });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "That did not clear, try again" });
  }
});

export default router;
