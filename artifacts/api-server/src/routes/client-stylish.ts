import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CAPTION_TONE_PROMPTS, RYDER_TONE, isRyder } from "./caption-generator";
import { validateHost } from "./aiPortrait";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";

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

type SiteDiag = { reason?: "blocked" | "notfound" | "unreachable" | "notweb" | "unsafe" | "empty" };

// The title, description and structured data in a page's head. Sites built in the browser (Wix,
// Squarespace, many React sites) often have almost no body text but still put this in the head.
function headBits(html: string): string {
  const out: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) out.push(`TITLE: ${title.trim()}`);
  for (const m of html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title)["'][^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']+)["']/i)?.[1];
    if (c) out.push(c.trim());
  }
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.stringify(JSON.parse(m[1]));
      out.push(j.slice(0, 1500));
    } catch { /* ignore bad JSON */ }
  }
  return out.join("\n");
}

async function fetchPage(rawUrl: string, diag?: SiteDiag): Promise<{ html: string; finalUrl: string } | null> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    if (diag) diag.reason = "unreachable";
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") return null;
      try {
        try { await validateHost(current.hostname); }
        catch (e) {
          // A hiccup looking the name up is worth one more go. Only a private address is really unsafe.
          const m = e instanceof Error ? e.message : "";
          if (m.includes("private") || m.includes("reserved")) throw e;
          await new Promise(r => setTimeout(r, 400));
          await validateHost(current.hostname);
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        if (diag) diag.reason = m.includes("private") || m.includes("reserved") ? "unsafe" : "unreachable";
        return null;
      }
      const r = await fetch(current.href, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, current.href);
        continue;
      }
      if (!r.ok) {
        if (diag) diag.reason = r.status === 404 || r.status === 410 ? "notfound" : r.status === 401 || r.status === 403 || r.status === 429 || r.status === 503 ? "blocked" : "unreachable";
        return null;
      }
      if (!(r.headers.get("content-type") ?? "").includes("text/html")) { if (diag) diag.reason = "notweb"; return null; }
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_PAGE_BYTES) return null;
      return { html: Buffer.from(buf).toString("utf8"), finalUrl: current.href };
    }
    return null;
  } catch {
    if (diag && !diag.reason) diag.reason = "unreachable";
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

async function readWebsite(website: string, treatments: string[], diag?: SiteDiag): Promise<string> {
  const site = website.trim().split(/\s+/)[0].replace(/[,;]+$/, "");
  const start = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  let home = await fetchPage(start, diag);
  if (!home) {
    // Some sites only answer on the other spelling, with or without www.
    try {
      const u = new URL(start);
      u.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
      const retry: SiteDiag = {};
      home = await fetchPage(u.href, retry);
      if (home && diag) delete diag.reason;
    } catch { /* keep the first reason */ }
  }
  if (!home) return "";
  const page = (h: { html: string; finalUrl: string }) => `PAGE: ${h.finalUrl}\n${headBits(h.html)}\n${htmlToText(h.html)}`;
  const parts = [page(home)];
  for (const link of pickTreatmentLinks(home.html, home.finalUrl, treatments)) {
    const sub = await fetchPage(link);
    if (sub) parts.push(page(sub));
  }
  const text = parts.join("\n\n").slice(0, MAX_SITE_CHARS);
  if (text.length <= 200 && diag) diag.reason = "empty";
  return text;
}

// Words that must never reach a post: prescription only medicines and the claims wording
// the ASA and MHRA object to. Checked in code as well as in the prompt.
export const BANNED_TERMS = /\b(botox|botulinum(?:\s+toxin)?|bocouture|azzalure|dysport|xeomin|vistabel|nuceiva|letybo|baby[\s-]?tox|tox|anti[\s-]?wrinkle|antiwrinkle|wrinkle[\s-]?relax\w*|ozempic|wegovy|mounjaro|saxenda|semaglutide|tirzepatide|liraglutide)\b/gi;

// Swaps banned words for the compliant wording, so the model never sees them in its input.
export function neutralise(text: string): string {
  return text.replace(BANNED_TERMS, "smoothing treatments").replace(/(smoothing treatments)[®™]/g, "$1");
}

const DAY_WORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|mondays|fridays|sundays|saturdays)\b/gi;

const FIRST_PERSON = /\b(i|i'm|i've|i'd|i'll|my|me|mine|myself|we|we're|our)\b/i;
function rowsWithoutFirstPerson(rows: Row[]): number[] {
  return rows.map((r, i) => (FIRST_PERSON.test(`${r.headline} ${r.subtitle} ${r.text1} ${r.text2} ${r.text3}`) ? 0 : i + 1)).filter(Boolean);
}

function findBanned(rows: Row[]): string[] {
  const hits = new Set<string>();
  for (const r of rows) {
    for (const k of ROW_KEYS) {
      for (const m of r[k].match(BANNED_TERMS) ?? []) hits.add(m.toLowerCase());
      for (const m of r[k].match(DAY_WORDS) ?? []) hits.add(m.toLowerCase());
    }
  }
  return [...hits];
}

export function clean(text: unknown): string {
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
The user message lists this clinic's own best performing posts, most engaged first. These are proven winners with this audience. Before writing, work out what they have in common: the kind of hook, the subject matter, the feeling they trigger, how personal they are, how long they run. Then write all 20 rows in that same family: the same kind of hooks, angles and emotions, about fresh things.
Never copy a top post or lightly reword it, every row must be new. Only echo a personal fact or credential (a career history, a number of years, a qualification) if it appears in the top posts or the clinician notes, and never invent one.`;

const HALLOWEEN_IDEAS: Record<string, { title: string; brief: string }> = {
  "hl-01": { title: "Ghost stories from the treatment room", brief: "Funny, gently spooky stories about things people have put on their faces (three retinols at once, a kitchen table facial, a mystery serum from a Facebook group). Ends warmly on why a proper consultation matters. Never name a real product, person or competitor." },
  "hl-02": { title: "Halloween 1992", brief: "Pure nostalgia for UK women over 35: a bin bag costume, Woolworths face paint that stained for a week, an Elnett cloud, a pointed hat from Tammy Girl. Hyper specific, affectionate and funny." },
  "hl-03": { title: "Things scarier than Halloween", brief: "A 'things that' list: the 3am hot flush, a front camera in bad light, a group chat that has gone quiet. Warm, funny, never body shaming." },
  "hl-04": { title: "Which Halloween film is your perimenopause?", brief: "Each slide matches a film to a menopause moment with a one line joke (for example Night Sweats on Elm Street, The Fog, Poltergeist for the thermostat). Warm, validating, no medical advice, no mention of hormones or medicines." },
  "hl-05": { title: "The witch's cauldron", brief: "Reading a skincare label like a spell book: three ingredient names that sound like curses, with what each does in plain, light English. Fun, no medical claims, no brands." },
  "hl-06": { title: "Carve the pumpkin with a plan", brief: "Nobody carves a pumpkin without a plan, so here is what to bring to a first consultation. A stealth sell: she finishes it feeling curious and comfortable." },
  "hl-07": { title: "Sheet mask Sunday looks like Scream", brief: "The picture of you in a face mask opening the door to the delivery driver. Pure relatable humour about Sunday night routines." },
  "hl-08": { title: "The face behind the costume", brief: "Emotional and shareable: the Halloweens she dressed as someone else, and the one where she was happy as herself. Original and specific, never a stock quote." },
};

const STRUCTURE_RULES = `
WHAT YOU ARE WRITING
A Stylish carousel pack for one clinic: exactly 20 posts, each one a row of short text that sits over photos.
Each row has: headline, subtitle, text1, text2, text3, cta.
The headline and subtitle read together as one line (headline is the punchy start, subtitle is the finish, for example headline "5 reasons" and subtitle "to always wear SPF"). text1 to text3 are the three follow on slides. Keep it short enough to sit on a photo: headline up to 5 words, subtitle up to 8 words, cta up to 8 words. Each of text1, text2 and text3 is a proper little passage of 2 or 3 short sentences, 20 to 32 words, never a single line.

THE 20 ROWS: FIVE KINDS OF POST, MIXED
The pack is five kinds of post, four of each, repeating in this order so the feed always feels varied: treatment, funny, things that, shareable, mix. So rows 1, 6, 11 and 16 are treatment; rows 2, 7, 12 and 17 are funny; rows 3, 8, 13 and 18 are things that; rows 4, 9, 14 and 19 are shareable; rows 5, 10, 15 and 20 are mix.

TREATMENT (rows 1, 6, 11, 16): Rows 1, 6 and 11 take the 3 treatments in the order given. Row 16 is a second, different angle on the first treatment. Use real details, names and wording from the website text, and never invent a treatment or a claim the website does not support. Do not write a list of benefits. Find an unexpected way in: a small human moment, a question she has been too shy to ask, a gentle myth to lay to rest, what a first consultation is actually like, a tiny story from the treatment room. Stealth sales: she should finish it feeling curious and comfortable, never sold to.

FUNNY (rows 2, 7, 12, 17): Really nostalgic and really funny, written for UK women over 35 who grew up in the 70s, 80s and 90s. Hyper specific British memories she can smell and hear: the Argos catalogue and the tiny pencil, Impulse body spray, wet play, the school disco, Tammy Girl, dial up internet, a mixtape with a pause button, Sunday trading, a Pot Noodle in halls, crimping tongs, Saturday morning telly, a Mini Milk on the beach in a cagoule. Do not just reuse these examples, find fresh and surprising ones. The kind of post that has her laughing out loud and messaging her school friend. Affectionate, a bit cheeky, never mean. Each of the four rows uses a completely different era or theme.

THINGS THAT (rows 3, 8, 13, 18): Titles in the style of "Things I hate about the industry", "Things my patients have taught me", "Things I wish someone had told me before my first consultation", "Things I have stopped apologising for". The headline and subtitle read as the title and text 1 to 3 are three specific, honest, vivid items, written in the first person as the clinic owner. Affable, a little cheeky, outside the box, with real insight into what happens in a clinic room and what women actually say. Compliant and warm, never bitter about colleagues or competitors, never naming anyone. Use four completely different "things that" titles across the four rows.

SHAREABLE (rows 4, 9, 14, 19): The post she sends to her sister or her best friend, or saves for a bad day. Empowering and emotional: say the thing every woman feels but nobody has quite put into words, give a warm counterintuitive take, a tiny honest confession, or a line worth screenshotting. About friendship, growing older, confidence, time, being seen, mothers and daughters, the woman she used to be. It should make her feel something in her chest. No selling. Never a stock quote line like "you are enough": it has to feel original, specific and true.

MIX (rows 5, 10, 15, 20): One of each, in this order: row 5 menopause (warm, funny, validating, no medical claims, no advice on hormones or medicines), row 10 skincare (a fun, useful, surprising idea she can use tonight, no medical education), row 15 growing older (the joy, the oddness and the freedom of it), row 20 a "did you know" fun fact (a genuinely interesting, true and checkable general fact about skin, ageing, beauty history or the body, with no claims about any treatment and no statistics you are not certain of). Keep all of it light, human and surprising.

FIRST PERSON, EVERY SINGLE ROW
Every row is written in the first person, as the person behind the page speaking to her: I, me, my, I'm, I've, I'd. This includes the funny, nostalgic, things that, shareable and mix rows, not just the treatment rows. Text1, text2 and text3 each carry a personal voice (what I saw, what I said, what I remember, what I think). Never write about "the clinic", "the team", "clients", "women" or "she" from a distance when "I" or "my" works. Never second person lecturing. Use "you" only to talk warmly to her.

MAKE IT SCROLL WORTHY (the most important rule)
Each carousel is a tiny story she cannot stop swiping. Slide 1 (headline and subtitle) opens a curiosity gap or promises a laugh. Text1 gives her the first beat and ends on a hook that makes her swipe (an unfinished thought, a surprise coming, a "wait for the next one"). Text2 raises the stakes, adds the funniest or most vivid detail, or turns the corner. Text3 is the payoff: the biggest laugh, the line that gives her a lump in her throat, or the "oh my god, me" moment. Then the cta lands warmly. Never summarise a slide in one flat line. Every slide must earn the swipe with a specific, vivid detail (a smell, a brand of crisps, a name of a TV programme, a thing someone said, an exact time of night), a joke that builds, or a feeling she recognises. Vary the rhythm: a long sentence then a short one. Write the way a funny friend tells a story on the sofa, with asides in brackets and the odd cheeky tangent. It has to be properly entertaining: if a slide would not make her smile, snort or feel something, rewrite it.

NO DAYS, DATES OR TIMING
These posts are scheduled for any day of the week, so never name a day of the week or a weekday ritual (no Monday, Friday, Sunday, weekend, "Friday feeling", "Sunday scaries", "Thursday night"), never name a date, month or season, and never say "today", "tonight", "this week" or "this morning". Write evergreen. The one exception is the Halloween rows, which may mention Halloween itself.

ENGAGEMENT AND ORIGINALITY
Everything is written to earn comments, saves, shares and tags. Think outside the box: every row needs an angle you would not see on another clinic's page. Never write the obvious post about the topic. If a line could appear on any clinic's feed, rewrite it.

VOICE AND AUDIENCE
Write in the first person, as the clinic owner speaking. UK spelling, no Americanisms. Never use em dashes or en dashes. Use commas, full stops or colons.
Write for the consumer psychology of women over 35: stealth sales, high engagement, emotion, humour, affable. No boring medical education, make it fun.
Humanise it. No AI patter. Never use negative parallelism in any form: no "not X, not Y", no "it is not X, it is Y", no "not just X but Y", no "less X, more Y", no "no X, no Y, just Z". State the positive point directly. No "not X, not Y" constructions, no "Most clinics don't have an X problem, they have a Y problem", no rhetorical question openers, no TED talk escalations. Never use the words fluff, faff or fuss. Be original, avoid stock lines seen all over the industry.
Use the clinician notes for voice and any personal detail, if given.

HOOKS (the most important part)
The headline and subtitle together are the hook, and it has to stop a thumb mid scroll. Every hook must be funny, or stir a real feeling, or both: recognition ("that is so me"), nostalgia, a gentle laugh at ourselves, tenderness, pride, a little bit cheeky. A hook that only states a topic is not good enough. Make it specific and human rather than general. Warm, never shaming: never make the reader feel bad about her face, body or age, and laugh with her, not at her.

COMPLIANCE (CAP Code, ASA and MHRA), NON NEGOTIABLE
NEVER write the words Botox, botulinum, toxin brand names (Bocouture, Azzalure, Dysport, Xeomin, Vistabel and the like), "tox", "baby tox", "anti-wrinkle", "antiwrinkle" or "wrinkle relaxer", and never name any prescription only medicine (including weight loss injections such as Ozempic, Wegovy or Mounjaro), in any cell of any row. This applies even if the website or the treatment list uses those words: where they do, say "smoothing treatments" or "facial aesthetics" instead. No guarantees, no before and after claims, no medical claims, no "safe", no superlatives like best or number one, no pressure, urgency or scarcity language. Frame treatments as a consultation and a possibility ("may help", "can support").

CTA
Every cta is a strong, stealth sales friendly call to action, varied across the rows and never pushy. On treatment rows it warmly invites a consultation or a message. On funny, things that and shareable rows it asks for a comment, a share, a save or a tag ("Tag the friend who...", "Comment the one I forgot") and is worded so it also warmly draws her into the clinic's world (follow along, send a message, come and say hello).

BANNED WORDS
fluff, faff, fuss, elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, seamless, effortless, next level, top-tier, spoiler alert, trust me.

OUTPUT
Return only JSON in this exact shape, with exactly 20 objects in "rows":
{"rows":[{"headline":"","subtitle":"","text1":"","text2":"","text3":"","cta":""}]}`;

// Pulls a client's own top 10 posts straight from their connected Instagram account, so nobody
// has to screenshot anything. Finds the client by name in the saved client list, reads their recent
// posts and ranks them by likes plus twice the comments. Returns "" when the client is not
// connected or Instagram does not answer, and the copy is written without it.
async function fetchInstagramTopPosts(clientName: string): Promise<string> {
  try {
    const n = clientName.trim().toLowerCase();
    if (!n) return "";
    const presets = await db.select().from(clientPresetsTable);
    const match =
      presets.find((p) => p.name.trim().toLowerCase() === n) ??
      (n.length >= 4 ? presets.find((p) => { const pn = p.name.trim().toLowerCase(); return pn.length >= 4 && (pn.includes(n) || n.includes(pn)); }) : undefined);
    if (!match?.metaInstagramAccountId || !match.metaPageAccessToken) return "";
    type Media = { caption?: string; like_count?: number; comments_count?: number };
    const all: Media[] = [];
    let url: string | null =
      `https://graph.facebook.com/v19.0/${match.metaInstagramAccountId}/media?fields=caption,like_count,comments_count,timestamp&limit=50&access_token=${encodeURIComponent(match.metaPageAccessToken)}`;
    for (let page = 0; page < 2 && url; page++) {
      const r: globalThis.Response = await fetch(url);
      if (!r.ok) break;
      const d = (await r.json()) as { data?: Media[]; paging?: { next?: string } };
      all.push(...(d.data ?? []));
      url = d.paging?.next ?? null;
    }
    const ranked = all
      .filter((m) => (m.caption ?? "").trim())
      .map((m) => ({ hook: (m.caption ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "", likes: m.like_count ?? 0, comments: m.comments_count ?? 0 }))
      .filter((m) => m.hook)
      .sort((a, b) => (b.likes + b.comments * 2) - (a.likes + a.comments * 2))
      .slice(0, 10);
    return ranked.map((m, i) => `${i + 1}. ${m.hook.slice(0, 160)} (${m.likes} likes, ${m.comments} comments)`).join("\n");
  } catch {
    return "";
  }
}

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

type CopyJob = { status: "running" | "done" | "error"; code?: number; body?: unknown; at: number };
const copyJobs = new Map<string, CopyJob>();
setInterval(() => { const cut = Date.now() - 30 * 60_000; for (const [k, v] of copyJobs) if (v.at < cut) copyJobs.delete(k); }, 10 * 60_000).unref?.();

router.get("/client-stylish/copy/:jobId", (req: Request, res: Response) => {
  const job = copyJobs.get(String(req.params["jobId"]));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status === "running") { res.json({ status: "running" }); return; }
  res.json({ status: job.status, code: job.code ?? 200, ...(job.body as object) });
});

router.post("/client-stylish/copy", upload.array("screenshots", 3), async (req: Request, res: Response) => {
  // The pack takes longer than the 28 seconds the website allows a single request, so it is written as a
  // job: the answer comes straight back with a job id and the page checks on it until the copy is ready.
  let out: { status: (c: number) => any; json: (b: unknown) => void } = res;
  if (String((req.body as Record<string, unknown> | undefined)?.async ?? "") === "1") {
    const jobId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    copyJobs.set(jobId, { status: "running", at: Date.now() });
    res.status(202).json({ jobId });
    let code = 200;
    out = {
      status(c: number) { code = c; return this; },
      json(b: unknown) { copyJobs.set(jobId, { status: code >= 400 ? "error" : "done", code, body: b, at: Date.now() }); },
    };
  }
  try {
    const body = req.body as Record<string, string | string[] | undefined>;
    const clientName = String(body.clientName ?? "");
    let website = String(body.website ?? "");
    const tone = String(body.tone ?? "4");
    const notes = String(body.notes ?? "");
    const pastedTop = String(body.topPosts ?? "").trim();
    const rawTreatments = body.treatments;

    const cleanTreatments = (Array.isArray(rawTreatments) ? rawTreatments : rawTreatments ? [rawTreatments] : [])
      .map((t) => neutralise(String(t ?? "").trim()))
      .filter(Boolean)
      .slice(0, 3);
    if (!clientName.trim()) { out.status(400).json({ error: "Client name is required" }); return; }
    if (!website.trim()) {
      // Falls back to the website saved on the client's preset.
      const n = clientName.trim().toLowerCase();
      const presets = await db.select().from(clientPresetsTable);
      const m = presets.find((p) => p.name.trim().toLowerCase() === n);
      website = m?.websiteUrl?.trim() ?? "";
    }
    if (!website.trim()) { out.status(400).json({ error: "Website is required" }); return; }
    if (cleanTreatments.length !== 3) { out.status(400).json({ error: "Please give me 3 treatments" }); return; }

    const rawHall = body.halloween;
    const hallIds = (Array.isArray(rawHall) ? rawHall : rawHall ? [rawHall] : []).map(String).filter((h, i, a) => HALLOWEEN_IDEAS[h] && a.indexOf(h) === i).slice(0, 3);
    const expected = 20 + hallIds.length;
    const ryderPack = isRyder(clientName);
    const tonePrompt = ryderPack ? RYDER_TONE : (CAPTION_TONE_PROMPTS[tone] ?? CAPTION_TONE_PROMPTS["4"]);
    const siteDiag: SiteDiag = {};
    const [siteText, shotText, igTop] = await Promise.all([
      readWebsite(website.trim(), cleanTreatments, siteDiag),
      readTopPostShots((req.files as Express.Multer.File[] | undefined) ?? []),
      fetchInstagramTopPosts(clientName),
    ]);
    const siteFound = siteText.length > 200;
    const safeSite = neutralise(siteText);
    // Anything supplied by hand wins. Otherwise the client's own Instagram is used.
    const manualTop = [shotText, pastedTop].filter(Boolean).join("\n");
    const topPostsSource = manualTop ? "supplied" : igTop ? "instagram" : "none";
    const topPosts = neutralise(manualTop || igTop).slice(0, 4000);
    const topPostsCount = topPosts ? topPosts.split("\n").filter((l) => l.trim()).length : 0;

    const system = `You write copy for Vanessa Wormald's clients, UK aesthetic clinics.

WRITING STYLE: ${tonePrompt}
${ryderPack ? "THE RYDER CLINIC: write every row in the professional, emotive, affable voice above. Wherever the rules below ask for funny, cheeky or nostalgic comedy, write sincere, warm, emotionally rich posts instead, with no humour or japes at all.\n" : ""}${hallIds.length ? STRUCTURE_RULES.replace(/exactly 20 (posts|objects)/g, `exactly ${expected} $1`) + `\n\nHALLOWEEN ROWS: after the 20 rows above, add ${hallIds.length} extra Halloween rows (rows 21 to ${expected}), in this order. Same format, same rules, same voice, still ending ideas with a comment, share, save or tag call to action. Make each one clever, industry relevant and outside the box.\n${hallIds.map((h, i) => `Row ${21 + i}: "${HALLOWEEN_IDEAS[h].title}". ${HALLOWEEN_IDEAS[h].brief}`).join("\n")}` : STRUCTURE_RULES}${topPosts ? `\n${TOP_POSTS_RULES}` : ""}`;

    const user = `Clinic: ${clientName.trim()}
Treatments to promote this month, in order:
1. ${cleanTreatments[0]}
2. ${cleanTreatments[1]}
3. ${cleanTreatments[2]}
${notes.trim() ? `Notes about the clinician: ${neutralise(notes.trim())}\n` : ""}${topPosts ? `\nTOP PERFORMING POSTS, most engaged first:\n${topPosts}\n` : ""}
${siteFound ? `WEBSITE TEXT (take treatment details from here only):\n${safeSite}` : "The website could not be read. Keep the treatment posts general and do not state any specific detail, price or claim about the treatments."}`;

    let rows: Row[] = [];
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user + feedback },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 7500,
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
      if (rows.length !== expected) {
        feedback = `\n\nYour last answer did not have exactly ${expected} rows. Return exactly ${expected} rows.`;
        continue;
      }
      const hits = findBanned(rows);
      const noI = rowsWithoutFirstPerson(rows);
      if (!hits.length && !noI.length) break;
      if (!hits.length && noI.length) {
        feedback = `\n\nRows ${noI.join(", ")} are not in the first person. Rewrite all ${expected} rows so every row is spoken as I, me and my.`;
        continue;
      }
      feedback = `\n\nYour last answer used banned wording (${hits.join(", ")}). Rewrite all ${expected} rows without any of those words. Never name a day of the week or the weekend. Where a compliance word is the problem, use "smoothing treatments" or "facial aesthetics".`;
    }

    // Last line of defence: if a banned word still slipped through, swap it out in code.
    if (rows.length === expected) {
      rows = rows.map((r) => ({
        headline: neutralise(r.headline),
        subtitle: neutralise(r.subtitle),
        text1: neutralise(r.text1),
        text2: neutralise(r.text2),
        text3: neutralise(r.text3),
        cta: neutralise(r.cta),
      }));
    }

    if (rows.length !== expected) {
      out.status(502).json({ error: `The copy did not come back as ${expected} rows. Please try again.` });
      return;
    }

    out.json({ rows, csv: buildCsv(rows), siteFound, siteReason: siteFound ? null : (siteDiag.reason ?? "unreachable"), topPostsCount, topPostsSource });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Copy generation failed";
    req.log.error({ err }, "client-stylish/copy failed");
    out.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// Write-my-CSV for the Stylish tool: she says what the 4 treatment posts are about and what the rest
// should be, and the rows come back ready to load. The Ryder Clinic is always written in a very
// professional, emotive and affable voice, with no humour, for the slides and for the captions.
// ---------------------------------------------------------------------------
function section(from: string, to: string): string {
  const a = STRUCTURE_RULES.indexOf(from);
  const b = STRUCTURE_RULES.indexOf(to, a + 1);
  return a >= 0 ? STRUCTURE_RULES.slice(a, b >= 0 ? b : undefined).trim() : "";
}

// Lists the treatments a clinic offers, read from the links on its own website, for the treatment dropdowns.
router.post("/client-stylish/treatments", async (req: Request, res: Response) => {
  try {
    const website = typeof req.body?.website === "string" ? req.body.website.trim() : "";
    if (!website) { res.status(400).json({ error: "website required" }); return; }
    const site = website.split(/\s+/)[0].replace(/[,;]+$/, "");
    const start = /^https?:\/\//i.test(site) ? site : `https://${site}`;
    const diag: SiteDiag = {} as SiteDiag;
    const home = await fetchPage(start, diag);
    if (!home) { res.json({ treatments: [], reason: diag.reason ?? "unreachable" }); return; }
    const collect = (html: string, baseUrl: string) => {
      const base = new URL(baseUrl);
      const out: { text: string; path: string }[] = [];
      const re = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        let u: URL;
        try { u = new URL(m[1], base); } catch { continue; }
        if (u.hostname !== base.hostname) continue;
        const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        if (!text || text.length > 60) continue;
        out.push({ text, path: u.pathname });
      }
      return out;
    };
    let links = collect(home.html, home.finalUrl);
    // Follow the main treatments or services page too, where the full list usually lives.
    const index = links.find(l => /^\/(treatments?|services?|our-treatments?|what-we-offer)\/?$/i.test(l.path));
    if (index) {
      const page = await fetchPage(new URL(index.path, home.finalUrl).href);
      if (page) links = links.concat(collect(page.html, page.finalUrl));
    }
    const seen = new Set<string>();
    const lines = links.filter(l => { const k = `${l.text}|${l.path}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 220).map(l => `${l.text} (${l.path})`).join("\n");
    if (!lines) { res.json({ treatments: [], reason: "nothing found" }); return; }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are given the link texts and paths found on an aesthetics, dental or skin clinic website. Return JSON {\"treatments\": [..]} listing only the actual treatments, procedures or services the clinic offers to patients, as short names (for example Dermal Fillers, Skin Boosters, Facials). Leave out navigation, contact, pricing, blog, about, team, booking, legal and shop links. Remove duplicates. Use the clinic's own wording, tidied to Title Case. Never name prescription-only medicines: if the site lists one, use a neutral name such as Smoothing Treatments. Maximum 40." },
        { role: "user", content: lines },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { treatments?: unknown };
    const list = Array.isArray(parsed.treatments) ? parsed.treatments.filter((t): t is string => typeof t === "string").map(t => t.trim()).filter(Boolean).slice(0, 40) : [];
    res.json({ treatments: list });
  } catch (err) {
    req.log?.error({ err }, "client-stylish: treatments error");
    res.json({ treatments: [], reason: "failed" });
  }
});

router.post("/client-stylish/csv", async (req: Request, res: Response) => {
  try {
    const body = req.body as { clientName?: string; website?: string; tone?: string; notes?: string; treatmentTopics?: string[]; restBrief?: string; restCount?: number };
    const clientName = String(body.clientName ?? "").trim();
    if (!clientName) { res.status(400).json({ error: "Please choose the client first" }); return; }
    const topics = (Array.isArray(body.treatmentTopics) ? body.treatmentTopics : []).map((t) => neutralise(String(t ?? "").trim())).filter(Boolean).slice(0, 4);
    if (topics.length < 1) { res.status(400).json({ error: "Tell me what the treatment posts are about" }); return; }
    const restCount = Math.min(40, Math.max(0, Math.round(Number(body.restCount ?? 16))));
    const restBrief = neutralise(String(body.restBrief ?? "").trim()).slice(0, 2000);
    const ryder = isRyder(clientName);
    const tonePrompt = ryder ? RYDER_TONE : (CAPTION_TONE_PROMPTS[String(body.tone ?? "4")] ?? CAPTION_TONE_PROMPTS["4"]);
    const notes = neutralise(String(body.notes ?? "").trim()).slice(0, 1500);
    const total = topics.length + restCount;

    let siteText = "";
    const website = String(body.website ?? "").trim();
    if (website) {
      try { siteText = neutralise(await readWebsite(website, topics, {})); } catch { siteText = ""; }
    }

    const common = [
      section("FIRST PERSON, EVERY SINGLE ROW", "MAKE IT SCROLL WORTHY"),
      ryder
        ? `MAKE IT SCROLL WORTHY, THE RYDER WAY
Each carousel is a short, absorbing story she wants to finish. Slide 1 (headline and subtitle) opens with a sincere, emotionally resonant line that draws her in. Text1, text2 and text3 are each 2 or 3 short, graceful sentences of 20 to 32 words, never a single line. Text1 sets the scene with a specific, humane detail and ends on a thought that invites the swipe. Text2 deepens the feeling or the insight. Text3 is the moment of reassurance or the quietly moving payoff. The cta lands warmly. No humour at all. Vary the rhythm between longer and shorter sentences. Be specific and tender rather than general.`
        : section("MAKE IT SCROLL WORTHY", "NO DAYS, DATES OR TIMING"),
      section("NO DAYS, DATES OR TIMING", "ENGAGEMENT AND ORIGINALITY"),
      section("COMPLIANCE (CAP Code", "CTA"),
      section("CTA", "BANNED WORDS"),
      section("BANNED WORDS", "OUTPUT"),
    ].filter(Boolean).join("\n\n");

    const system = `You write copy for Vanessa Wormald's clients, UK aesthetic clinics.

WRITING STYLE: ${tonePrompt}

WHAT YOU ARE WRITING
A Stylish carousel pack for one clinic: exactly ${total} posts, each one a row of short text that sits over photos. Each row has: headline, subtitle, text1, text2, text3, cta. The headline and subtitle read together as one line (headline is the start, subtitle is the finish). Headline up to 5 words, subtitle up to 8 words, cta up to 8 words, each of text1 to text3 is 2 or 3 short sentences of 20 to 32 words.

THE ${total} ROWS
${topics.length} treatment posts and ${restCount} other posts. Spread the treatment posts evenly through the list so the feed stays varied, never bunched together.
TREATMENT POSTS: one for each of these topics, in this order:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}
Use real details and wording from the website text if given, and never invent a treatment or a claim. Do not write a list of benefits. Find a human way in: a small moment, a question she has been too shy to ask, what a consultation is actually like. Stealth sales: she should finish feeling curious and comfortable, never sold to.
${restCount ? `OTHER POSTS (${restCount}): ${restBrief || "A varied mix of emotional, shareable, informative and engaging posts for women over 35 that suit the clinic."}
Follow that brief exactly for the number and kind of posts it describes. Where it does not say, vary the angles so no two posts feel alike.` : ""}

${common}

${ryder ? "Because this is The Ryder Clinic, any instruction above that asks for humour, cheekiness, nostalgia jokes or comedy is replaced by sincere warmth and emotion. Never joke." : ""}

OUTPUT
Return only JSON in this exact shape, with exactly ${total} objects in "rows":
{"rows":[{"headline":"","subtitle":"","text1":"","text2":"","text3":"","cta":""}]}`;

    const user = `Clinic: ${clientName}
${notes ? `Notes about the clinic and clinician: ${notes}\n` : ""}${siteText ? `WEBSITE TEXT:\n${siteText.slice(0, 6000)}` : "No website text was available, keep treatment details general."}`;

    let rows: Row[] = [];
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: system }, { role: "user", content: user + feedback }],
        response_format: { type: "json_object" },
        temperature: ryder ? 0.7 : 0.9,
        max_tokens: 9000,
      });
      try {
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { rows?: Partial<Row>[] };
        rows = (parsed.rows ?? []).map((r) => ({ headline: clean(r.headline), subtitle: clean(r.subtitle), text1: clean(r.text1), text2: clean(r.text2), text3: clean(r.text3), cta: clean(r.cta) }));
      } catch { rows = []; }
      if (rows.length !== total) { feedback = `\n\nYour last answer did not have exactly ${total} rows. Return exactly ${total} rows.`; continue; }
      const hits = findBanned(rows);
      const noI = rowsWithoutFirstPerson(rows);
      if (!hits.length && !noI.length) break;
      feedback = hits.length
        ? `\n\nYour last answer used banned wording (${hits.join(", ")}). Rewrite all ${total} rows without any of those words. Never name a day of the week.`
        : `\n\nRows ${noI.join(", ")} are not in the first person. Rewrite all ${total} rows so every row is spoken as I, me and my.`;
    }
    if (rows.length !== total) { res.status(502).json({ error: `The copy did not come back as ${total} rows. Please try again.` }); return; }
    rows = rows.map((r) => ({ headline: neutralise(r.headline), subtitle: neutralise(r.subtitle), text1: neutralise(r.text1), text2: neutralise(r.text2), text3: neutralise(r.text3), cta: neutralise(r.cta) }));
    res.json({ rows, csv: buildCsv(rows), ryder });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "CSV writing failed";
    req.log.error({ err }, "client-stylish/csv failed");
    res.status(500).json({ error: msg });
  }
});

export default router;
