import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSampleDraftsTable, aiSourcePhotosTable } from "@workspace/db/schema";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient } from "./objectStorage";
import { HOUSE_VOICE } from "./houseRules";
import { BASE_RULES } from "../routes/caption-generator";
import { createJob, getJob, processPortraitJob } from "./aiPortraitWorker";
import { notifySampleReady } from "./notify";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// The 8 posts of a sample: which Studio image each one uses and how it is
// laid out. Half scrubs, half normal clothes is the default.
// ---------------------------------------------------------------------------

export type Look = "stylish" | "magazine";
export type PlanSlot = { id: string; look: Look; zoom?: boolean; mixStyle?: string };
export type MixType = "half" | "standard";

export const PLAN_HALF: PlanSlot[] = [
  { id: "mx-01", look: "magazine" },
  { id: "mx-05", look: "stylish" },
  { id: "mx-02", look: "magazine" },
  { id: "mx-13", look: "stylish" },
  { id: "mx-03", look: "stylish" },
  { id: "mx-06", look: "magazine" },
  { id: "mx-04", look: "stylish" },
  { id: "mx-14", look: "magazine" },
];

export const PLAN_STANDARD: PlanSlot[] = [
  { id: "mx-01", look: "magazine" },
  { id: "mx-05", look: "stylish" },
  { id: "mx-13", look: "magazine" },
  { id: "mx-09", look: "stylish", zoom: true, mixStyle: "luxe" },
  { id: "mx-02", look: "stylish" },
  { id: "mx-06", look: "magazine" },
  { id: "mx-14", look: "stylish" },
  { id: "mx-10", look: "magazine", mixStyle: "everyday" },
];

const SHIRT_IDS = ["mx-05", "mx-06", "mx-07", "mx-08"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Monday", "Wednesday", "Friday", "Sunday"];

export type DraftInput = {
  mixType?: MixType;
  shirt?: string;
  month?: string;
  /** slot index (0 to 7) mapped to a stored image key, for approved photos */
  approved?: Record<string, string>;
  /** stored key of the clinician photo, used to make the Studio images */
  photoKey?: string;
  /** colour of the scrubs worn in the clinical photos */
  scrubs?: string;
  /** brand colours as typed by the clinic, e.g. "navy and gold" */
  brandColours?: string;
  /** about the clinician, in their own words (about 3 sentences) */
  about?: string;
};

export type DraftPost = {
  n: number;
  week: number;
  day: string;
  look: Look;
  zoom: boolean;
  headline: string;
  subtitle: string;
  caption: string;
  tags: string;
};

export type DraftData = {
  photos?: { url: string; source: "studio" | "approved" }[];
  posts?: DraftPost[];
  /** brand colours resolved to hex codes, first is the main one */
  brand?: { hex: string[] };
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function bucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

export async function saveSampleFile(buffer: Buffer, mime: string, name: string): Promise<string> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const key = `free-samples/${uuid()}/${name}.${ext}`;
  await objectStorageClient.bucket(bucketId()).file(key).save(buffer, {
    contentType: mime,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return key;
}

export async function readKey(key: string): Promise<Buffer> {
  const [buffer] = await objectStorageClient.bucket(bucketId()).file(key).download();
  return buffer;
}

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

const BRIEF = `YOU ARE WRITING A FREE SAMPLE PACK: 8 Instagram and Facebook posts over two weeks for one clinic, as the clinician or clinic owner, in the first person.

STRUCTURE (exactly 8 posts, in this order)
1. Week 1 Monday: relatable or treatment led (only if treatments were given, otherwise treatment neutral), warm and useful.
2. Week 1 Wednesday: really nostalgic and really funny for UK women over 35 (childhood, teenage years, early adulthood in the UK: telly, music, sweets, catalogues, school, the early 2000s).
3. Week 1 Friday: a "things that" post (things my patients have taught me, things I wish someone had told me, things I learned in my career).
4. Week 1 Sunday: shareable, empowering and emotional, tied to the season.
5. Week 2 Monday, 6. Week 2 Wednesday, 7. Week 2 Friday, 8. Week 2 Sunday: the same four jobs but different angles and different hooks. Week 2 must not repeat week 1.

FOR EACH POST WRITE
- headline: 2 to 4 words that will sit big on the photo, and subtitle: 3 to 8 words that finish the thought. Read together they are one hook line. No full stops. No month or year.
- caption: the hook line first, then the story in short paragraphs separated by a blank line, then ONE closing question that relates to the post and is easy and fun to answer in the comments (for example "What reminds you of your childhood?"). Do NOT put hashtags in the caption. Never use Comment WORD, a reply word or any web address.
- The only exception to the closing question is a post that is genuinely about one of the treatments given (only possible when treatments were given, normally the two Monday posts). Those end with exactly: Drop me a DM to see if you're a good fit for this.
- Small believable personal details (the kettle, a quiet Tuesday, the school run, a biscuit tin). Never invent results, client names, statistics or numbers about the clinic.
- 120 to 190 words per caption. No emojis. No em dashes or en dashes anywhere. UK spelling.
- Never use negative parallelism, rhetorical triplets, a tidy summing up ending, or the buzzwords journey, glow up, game changer, unlock, dive in, tapestry, elevate, faff, fluff.
- No treatment specifics, prices, doses, results claims, guarantees, urgency or scarcity. Never mention a website or any web address.
- Qualifications the clinician gave may be mentioned lightly and truthfully. Do not add any qualification that was not given.

HASHTAGS
- Give two lines, tagsA and tagsB, each with EXACTLY 5 hashtags separated by single spaces, all based on the clinic's area (town, nearby places, county or region) plus aesthetics. Posts alternate between tagsA and tagsB.

BRAND COLOURS
- If brand colours are given, also return "brandHex": up to 3 hex codes (like #1f3a5f) that match those colours as closely as you can, main colour first, chosen so white or very dark text is readable on a pale tint of the first one. If none are given, return an empty array.

ABOUT THE CLINICIAN
- If an About section is given, use small true details from it in the captions, in her voice. Never add facts that are not in it.

Return JSON only: {"posts":[{"headline":"","subtitle":"","caption":""} x 8],"tagsA":"","tagsB":"","brandHex":[]}`;

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[–—]/g, ",")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function fiveTags(line: unknown, fallback: string): string {
  const tags = String(line ?? "")
    .split(/\s+/)
    .map((t) => t.replace(/[^#A-Za-z0-9]/g, ""))
    .filter((t) => t.length > 1)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
  const uniq = Array.from(new Set(tags));
  return uniq.length >= 5 ? uniq.slice(0, 5).join(" ") : fallback;
}

// Catches "not just X, but Y", "it isn't X, it's Y", "less about X, more about Y" and the buzzwords she bans.
const NEGATIVE_PARALLEL = [
  /\bnot (?:just|only|merely|simply)\b[^.!?\n]{0,80}\bbut\b/i,
  /\bnot\b[^.!?\n]{0,60},\s*(?:but|it'?s|it is|that'?s|they'?re)\b/i,
  /\b(?:isn'?t|aren'?t|wasn'?t|doesn'?t|don'?t|didn'?t|never)\b[^.!?\n]{0,60}[,;]\s*(?:it'?s|it is|that'?s|but|they'?re|you'?re)\b/i,
  /\b(?:it'?s|this is|that'?s) not (?:about|just|only)\b/i,
  /\bless about\b[^.!?\n]{0,60}\bmore about\b/i,
  /\bno (?:fluff|faff)\b/i,
  /\b(?:journey|game.?changer|glow.?up|unlock|dive in|tapestry|elevate|faff|fluff)\b/i,
];

function needsRewrite(text: string): boolean {
  return NEGATIVE_PARALLEL.some((re) => re.test(text));
}

async function rewriteFlagged(posts: { headline: string; subtitle: string; caption: string }[]): Promise<void> {
  for (let pass = 0; pass < 2; pass++) {
    const flagged = posts.map((p, i) => ({ p, i })).filter(({ p }) => needsRewrite(p.caption));
    if (flagged.length === 0) return;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${HOUSE_VOICE}\n\n${BASE_RULES}\n\nRewrite each caption below so it keeps the same story, voice, length and closing line, but contains NO negative parallelism at all. That means no "not just X but Y", no "it isn't X, it's Y", no "not about X, about Y", no "less X, more Y", and none of the banned buzzwords. State things positively and directly instead. Keep the first person voice, UK spelling, no em dashes and no emojis. Return JSON only: {"captions":["",...]} with the same number of captions in the same order.`,
        },
        { role: "user", content: JSON.stringify({ captions: flagged.map(({ p }) => p.caption) }) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 3000,
    });
    try {
      const out = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { captions?: string[] };
      if (out.captions?.length === flagged.length) flagged.forEach(({ i }, k) => (posts[i].caption = clean(out.captions![k])));
    } catch {
      return;
    }
  }
}

export async function generateSampleCaptions(opts: {
  clinicName: string;
  clinicianName?: string;
  area: string;
  credentials?: string;
  treatments?: string;
  month?: string;
  about?: string;
  brandColours?: string;
}): Promise<{ posts: { headline: string; subtitle: string; caption: string; tags: string }[]; brandHex: string[] }> {
  const details = [
    `Clinic: ${opts.clinicName.trim()}`,
    opts.clinicianName?.trim() ? `Clinician: ${opts.clinicianName.trim()}` : "",
    `Area: ${opts.area.trim()}`,
    opts.credentials?.trim() ? `Qualifications and background (use only these): ${opts.credentials.trim()}` : "No qualifications given, so mention none.",
    opts.treatments?.trim()
      ? `Treatments offered (never prescription only): ${opts.treatments.trim()}`
      : "No treatments given, so write treatment neutral posts about the woman and how she feels, and every post ends with a closing question.",
    opts.about?.trim()
      ? `About the clinician, in her own words (true background to draw small personal details from, never invent anything beyond it): ${opts.about.trim()}`
      : "",
    opts.brandColours?.trim() ? `Brand colours: ${opts.brandColours.trim()}` : "",
    `Current month: ${opts.month || MONTHS[new Date().getMonth()]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: `${HOUSE_VOICE}\n\n${BASE_RULES}\n\n${BRIEF}` },
      { role: "user", content: details },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
    max_tokens: 4000,
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
    posts?: { headline?: string; subtitle?: string; caption?: string }[];
    tagsA?: string;
    tagsB?: string;
    brandHex?: string[];
  };
  const posts = parsed.posts ?? [];
  const brandHex = (Array.isArray(parsed.brandHex) ? parsed.brandHex : []).filter((h) => /^#[0-9a-fA-F]{6}$/.test(String(h))).slice(0, 3);
  if (posts.length < 8) throw new Error("The writer returned fewer than 8 posts");
  const word = (opts.area.trim().split(/[,\s]+/)[0] || "Local").replace(/[^A-Za-z0-9]/g, "");
  const tagsA = fiveTags(parsed.tagsA, `#${word} #${word}Aesthetics #AestheticsNurse #LocalClinic #SkinCare`);
  const tagsB = fiveTags(parsed.tagsB, `#${word}Life #${word}Clinic #AestheticClinic #UKAesthetics #SelfCare`);
  const eight = posts.slice(0, 8).map((p) => ({ headline: clean(p.headline), subtitle: clean(p.subtitle), caption: clean(p.caption) }));
  await rewriteFlagged(eight).catch(() => {});
  return { posts: eight.map((p, i) => ({ ...p, tags: i % 2 === 0 ? tagsA : tagsB })), brandHex };
}

// ---------------------------------------------------------------------------
// The background build
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function appLink(path: string): string {
  const base = (process.env.PUBLIC_APP_URL || "https://www.thecybersuite.com").replace(/\/$/, "");
  return `${base}${path}`;
}

async function setDraft(id: string, patch: Partial<typeof freeSampleDraftsTable.$inferInsert>): Promise<void> {
  await db
    .update(freeSampleDraftsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(freeSampleDraftsTable.id, id));
}

/** Builds a draft: Studio photos for the slots that need them, the 8 captions, then emails Vanessa. */
export async function runDraft(id: string): Promise<void> {
  const [draft] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, id));
  if (!draft) return;
  await setDraft(id, { status: "working", error: "" });
  try {
    const input = (draft.input ?? {}) as DraftInput;
    const plan = input.mixType === "standard" ? PLAN_STANDARD : PLAN_HALF;
    const approved = input.approved ?? {};
    const month = input.month || MONTHS[new Date().getMonth()];
    const shirt = (input.shirt ?? "bright optic white").trim();

    const photos: ({ url: string; source: "studio" | "approved" } | null)[] = plan.map((_, i) =>
      approved[String(i)] ? { url: `/api/media/${approved[String(i)]}`, source: "approved" } : null,
    );
    const needed = plan.map((p, i) => ({ p, i })).filter(({ i }) => !photos[i]);

    const captionsPromise = generateSampleCaptions({
      clinicName: draft.clinicName,
      clinicianName: draft.clinicianName,
      area: draft.area,
      credentials: draft.credentials,
      treatments: draft.treatments,
      month,
      about: input.about,
      brandColours: input.brandColours,
    });

    if (needed.length > 0) {
      if (!input.photoKey) throw new Error("A clinician photo is needed to make the Studio images");
      const sourceBuf = await readKey(input.photoKey);
      const [source] = await db
        .insert(aiSourcePhotosTable)
        .values({ clientName: draft.clinicName, photoUrl: `/api/media/${input.photoKey}`, notes: "Free sample" })
        .returning();

      const scenarioFor = (slot: PlanSlot) => {
        const promptVars: Record<string, string> = {};
        if (slot.mixStyle) {
          promptVars.month = month;
          promptVars.mixStyle = slot.mixStyle;
        }
        if (SHIRT_IDS.includes(slot.id) && shirt) promptVars.outfit = shirt;
        if (input.scrubs?.trim() && ["mx-01", "mx-02", "mx-03", "mx-04"].includes(slot.id)) promptVars.scrubs = input.scrubs.trim();
        return { id: slot.id, aspectRatio: "3:4", ...(Object.keys(promptVars).length ? { promptVars } : {}) };
      };

      const results = new Map<string, string>();
      let pending = Array.from(new Set(needed.map(({ p }) => p.id)));
      for (let round = 0; round < 3 && pending.length > 0; round++) {
        const slots = pending.map((pid) => plan.find((p) => p.id === pid)!);
        const jobId = `fs_${Date.now()}_${uuid().slice(0, 8)}`;
        createJob(jobId, pending);
        await processPortraitJob(jobId, sourceBuf, source.id, draft.clinicName, slots.map(scenarioFor));
        const job = getJob(jobId);
        for (const c of job?.cards ?? []) {
          if (c.status === "success" && c.outputImageUrl) results.set(c.scenarioId, c.outputImageUrl);
        }
        pending = pending.filter((pid) => !results.has(pid));
        if (pending.length > 0) await sleep(3000);
      }
      if (pending.length > 0) throw new Error(`${pending.length} Studio photo${pending.length > 1 ? "s" : ""} would not generate`);
      for (const { p, i } of needed) photos[i] = { url: results.get(p.id)!, source: "studio" };
    }

    const { posts: written, brandHex } = await captionsPromise;
    const posts: DraftPost[] = written.map((w, i) => ({
      n: i + 1,
      week: i < 4 ? 1 : 2,
      day: DAYS[i % 4],
      look: plan[i].look,
      zoom: !!plan[i].zoom && photos[i]?.source === "studio",
      ...w,
    }));
    const data: DraftData = { photos: photos as { url: string; source: "studio" | "approved" }[], posts, ...(brandHex.length ? { brand: { hex: brandHex } } : {}) };
    await setDraft(id, { status: "ready", data, error: "" });
    await notifySampleReady({ clinicName: draft.clinicName, handle: draft.handle, link: appLink(`/free-sample?draft=${id}`), ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "The sample did not finish building";
    logger.error({ err, id }, "free sample build failed");
    await setDraft(id, { status: "failed", error: msg }).catch(() => {});
    await notifySampleReady({ clinicName: draft.clinicName, handle: draft.handle, link: appLink(`/free-sample?draft=${id}`), ok: false, detail: msg });
  }
}

/** Anything left "working" from before a restart is marked failed so it can be retried from the tool. */
export async function markStaleDrafts(): Promise<void> {
  try {
    const rows = await db.select().from(freeSampleDraftsTable);
    const cutoff = Date.now() - 20 * 60 * 1000;
    for (const r of rows) {
      if ((r.status === "working" || r.status === "submitted") && (r.updatedAt as Date).getTime() < cutoff) {
        await setDraft(r.id, { status: "failed", error: "The build was interrupted. Press Try again." });
      }
    }
  } catch (err) {
    logger.warn({ err }, "markStaleDrafts failed");
  }
}
