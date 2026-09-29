import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CAPTION_TONE_PROMPTS } from "./caption-generator";
import { validateHost } from "./aiPortrait";

// Client Stylish pack: writes the 16 row Stylish CSV for one clinic from its website,
// the 3 treatments being promoted this month and a chosen writing style. The images are
// made by the existing AI Photo Studio endpoints, so this route only does the copy.

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

const CSV_HEADER = ["headline", "subtitle", "text 1", "text 2", "text 3", "cta"];
const ROW_KEYS = ["headline", "subtitle", "text1", "text2", "text3", "cta"] as const;
type Row = Record<(typeof ROW_KEYS)[number], string>;

const MAX_PAGE_BYTES = 1_500_000;
const MAX_SITE_CHARS = 14_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function fetchPage(rawUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") return null;
      await validateHost(current.hostname);
      const r = await fetch(current.href, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CyberSuite/1.0)", Accept: "text/html" },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, current.href);
        continue;
      }
      if (!r.ok) return null;
      if (!(r.headers.get("content-type") ?? "").includes("text/html")) return null;
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_PAGE_BYTES) return null;
      return { html: Buffer.from(buf).toString("utf8"), finalUrl: current.href };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickTreatmentLinks(html: string, baseUrl: string, treatments: string[]): string[] {
  const base = new URL(baseUrl);
  const words = treatments
    .flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length >= 4);
  const seen = new Set<string>();
  const scored: { url: string; score: number }[] = [];
  const re = /<a\s[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.hostname !== base.hostname) continue;
    if (/\.(jpg|jpeg|png|gif|webp|pdf|svg|css|js)$/i.test(u.pathname)) continue;
    u.hash = "";
    u.search = "";
    const key = u.href;
    if (seen.has(key) || key === base.href) continue;
    seen.add(key);
    const path = u.pathname.toLowerCase();
    let score = 0;
    for (const w of words) if (path.includes(w)) score += 3;
    if (/treatment|service|about|meet/.test(path)) score += 1;
    if (score > 0) scored.push({ url: key, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.url);
}

async function readWebsite(website: string, treatments: string[]): Promise<string> {
  const start = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchPage(start);
  if (!home) return "";
  const parts = [`PAGE: ${home.finalUrl}\n${htmlToText(home.html)}`];
  for (const link of pickTreatmentLinks(home.html, home.finalUrl, treatments)) {
    const page = await fetchPage(link);
    if (page) parts.push(`PAGE: ${page.finalUrl}\n${htmlToText(page.html)}`);
  }
  return parts.join("\n\n").slice(0, MAX_SITE_CHARS);
}

function clean(text: unknown): string {
  return String(text ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\bfluff\b/gi, "nonsense")
    .replace(/\s+/g, " ")
    .trim();
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Row[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) lines.push(ROW_KEYS.map((k) => csvCell(r[k])).join(","));
  return lines.join("\n");
}

const TOP_POSTS_RULES = `
THE CLINIC'S TOP PERFORMING POSTS
The user message lists this clinic's own best performing posts, most engaged first. These are proven winners with this audience. Before writing, work out what they have in common: the kind of hook, the subject matter, the feeling they trigger, how personal they are, how long they run. Then write all 16 rows in that same family: the same kind of hooks, angles and emotions, about fresh things.
Never copy a top post or lightly reword it, every row must be new. Only echo a personal fact or credential (a career history, a number of years, a qualification) if it appears in the top posts or the clinician notes, and never invent one.`;

const STRUCTURE_RULES = `
WHAT YOU ARE WRITING
A Stylish carousel pack for one clinic: exactly 16 posts, each one a row of short text that sits over photos.
Each row has: headline, subtitle, text1, text2, text3, cta.
The headline and subtitle read together as one line (headline is the punchy start, subtitle is the finish, for example headline "5 reasons" and subtitle "to always wear SPF"). text1 to text3 are the three follow on slides. Keep every cell short because it sits on a photo: headline up to 5 words, subtitle up to 8 words, each text up to 16 words, cta up to 8 words.

THE 16 ROWS, IN THIS ORDER
Rows 1 to 4: treatment posts. Cover the 3 treatments the clinic is promoting this month. Row 1, 2 and 3 take one treatment each, in the order given. Row 4 is a second, different angle on the first treatment. Use real details, names and wording from the website text. Never invent a treatment or a claim the website does not support.
Rows 5 to 8: funny posts.
Rows 9 to 12: posts about aesthetics.
Rows 13 to 16: posts about menopause, growing old, and women being hotter than ever these days.

VOICE AND AUDIENCE
Write in the first person, as the clinic owner speaking. UK spelling, no Americanisms. Never use em dashes or en dashes. Use commas, full stops or colons.
Write for the consumer psychology of women over 35: stealth sales, high engagement, emotion, humour, affable. No boring medical education, make it fun.
Humanise it. No AI patter, no "not X, not Y" constructions, no "Most clinics don't have an X problem, they have a Y problem", no rhetorical question openers, no TED talk rule of three. Never use the word "fluff". Be original, avoid stock lines seen all over the industry.
Use the clinician notes for voice and any personal detail, if given.

HOOKS (the most important part)
The headline and subtitle together are the hook, and it has to stop a thumb mid scroll. Every hook must be funny, or stir a real feeling, or both: recognition ("that is so me"), nostalgia, a gentle laugh at ourselves, tenderness, pride, a little bit cheeky. A hook that only states a topic is not good enough. Make it specific and human rather than general. Warm, never shaming: never make the reader feel bad about her face, body or age, and laugh with her, not at her.

COMPLIANCE (CAP Code, ASA and MHRA)
Never name a prescription only medicine, including Botox, and never say "anti-wrinkle". Say facial aesthetics, smoothing treatments or injectable treatments. No guarantees, no before and after claims, no medical claims, no "safe", no superlatives like best or number one, no pressure, urgency or scarcity language. Frame treatments as a consultation and a possibility ("may help", "can support").

CTA
Every cta is a strong, stealth sales friendly call to action, such as a warm invitation to book a consultation or send a message. Vary them across rows. Never pushy.

BANNED WORDS
elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, seamless, effortless, next level, top-tier, spoiler alert, trust me.

OUTPUT
Return only JSON in this exact shape, with exactly 16 objects in "rows":
{"rows":[{"headline":"","subtitle":"","text1":"","text2":"","text3":"","cta":""}]}`;

// Reads screenshots of a clinic's "Top performing posts" list into plain text.
async function readTopPostShots(files: Express.Multer.File[]): Promise<string> {
  const images = files.filter((f) => f.mimetype.startsWith("image/"));
  if (!images.length) return "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'These are screenshots of a clinic\'s top performing social media posts. For every post you can see, write out its opening line exactly as shown, plus its likes and comments numbers if visible. Keep the order shown. Return only JSON: {"posts":[{"hook":"","likes":0,"comments":0}]}',
            },
            ...images.map((f) => ({
              type: "image_url" as const,
              image_url: { url: `data:${f.mimetype};base64,${f.buffer.toString("base64")}` },
            })),
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1500,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      posts?: { hook?: string; likes?: number; comments?: number }[];
    };
    return (parsed.posts ?? [])
      .filter((p) => p.hook?.trim())
      .map((p, i) => `${i + 1}. ${clean(p.hook)} (${p.likes ?? "?"} likes, ${p.comments ?? "?"} comments)`)
      .join("\n");
  } catch {
    return "";
  }
}

router.post("/client-stylish/copy", upload.array("screenshots", 3), async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string | string[] | undefined>;
    const clientName = String(body.clientName ?? "");
    const website = String(body.website ?? "");
    const tone = String(body.tone ?? "4");
    const notes = String(body.notes ?? "");
    const pastedTop = String(body.topPosts ?? "").trim();
    const rawTreatments = body.treatments;

    const cleanTreatments = (Array.isArray(rawTreatments) ? rawTreatments : rawTreatments ? [rawTreatments] : [])
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!clientName.trim()) { res.status(400).json({ error: "Client name is required" }); return; }
    if (!website.trim()) { res.status(400).json({ error: "Website is required" }); return; }
    if (cleanTreatments.length !== 3) { res.status(400).json({ error: "Please give me 3 treatments" }); return; }

    const tonePrompt = CAPTION_TONE_PROMPTS[tone] ?? CAPTION_TONE_PROMPTS["4"];
    const [siteText, shotText] = await Promise.all([
      readWebsite(website.trim(), cleanTreatments),
      readTopPostShots((req.files as Express.Multer.File[] | undefined) ?? []),
    ]);
    const siteFound = siteText.length > 200;
    const topPosts = [shotText, pastedTop].filter(Boolean).join("\n").slice(0, 4000);
    const topPostsCount = topPosts ? topPosts.split("\n").filter((l) => l.trim()).length : 0;

    const system = `You write copy for Vanessa Wormald's clients, UK aesthetic clinics.

WRITING STYLE: ${tonePrompt}
${STRUCTURE_RULES}${topPosts ? `\n${TOP_POSTS_RULES}` : ""}`;

    const user = `Clinic: ${clientName.trim()}
Treatments to promote this month, in order:
1. ${cleanTreatments[0]}
2. ${cleanTreatments[1]}
3. ${cleanTreatments[2]}
${notes.trim() ? `Notes about the clinician: ${notes.trim()}\n` : ""}${topPosts ? `\nTOP PERFORMING POSTS, most engaged first:\n${topPosts}\n` : ""}
${siteFound ? `WEBSITE TEXT (take treatment details from here only):\n${siteText}` : "The website could not be read. Keep the treatment posts general and do not state any specific detail, price or claim about the treatments."}`;

    let rows: Row[] = [];
    for (let attempt = 0; attempt < 2 && rows.length !== 16; attempt++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 4000,
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      try {
        const parsed = JSON.parse(raw) as { rows?: Partial<Row>[] };
        rows = (parsed.rows ?? []).map((r) => ({
          headline: clean(r.headline),
          subtitle: clean(r.subtitle),
          text1: clean(r.text1),
          text2: clean(r.text2),
          text3: clean(r.text3),
          cta: clean(r.cta),
        }));
      } catch {
        rows = [];
      }
    }

    if (rows.length !== 16) {
      res.status(502).json({ error: "The copy did not come back as 16 rows. Please try again." });
      return;
    }

    res.json({ rows, csv: buildCsv(rows), siteFound, topPostsCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Copy generation failed";
    req.log.error({ err }, "client-stylish/copy failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
