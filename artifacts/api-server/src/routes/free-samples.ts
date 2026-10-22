import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSamplesTable } from "@workspace/db/schema";
import { openai } from "@workspace/integrations-openai-ai-server";
import { objectStorageClient } from "../lib/objectStorage";
import { HOUSE_VOICE } from "../lib/houseRules";
import { BASE_RULES } from "./caption-generator";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// Free Sample tool: Vanessa builds a sample pack for a prospective clinic
// (8 posts, 2 weeks, with captions and hashtags) and the clinic gets a public
// link at /sample/<slug> to download everything.

const DAYS = ["Monday", "Wednesday", "Friday", "Sunday"];

const BRIEF = `YOU ARE WRITING A FREE SAMPLE PACK: 8 Instagram and Facebook posts over two weeks for one clinic, as the clinician or clinic owner, in the first person.

STRUCTURE (exactly 8 posts, in this order)
1. Week 1 Monday: relatable or treatment led (only if treatments were given, otherwise treatment neutral), warm and useful.
2. Week 1 Wednesday: really nostalgic and really funny for UK women over 35 (childhood, teenage years, early adulthood in the UK: telly, music, sweets, catalogues, school, the early 2000s).
3. Week 1 Friday: a "things that" post (things my patients have taught me, things I wish someone had told me, things I learned in my career).
4. Week 1 Sunday: shareable, empowering and emotional, tied to the season.
5. Week 2 Monday, 6. Week 2 Wednesday, 7. Week 2 Friday, 8. Week 2 Sunday: the same four jobs but different angles and different hooks. Week 2 must not repeat week 1.

FOR EACH POST WRITE
- headline: 2 to 4 words that will sit big on the photo, and subtitle: 3 to 8 words that finish the thought. Read together they are one hook line. No full stops. No month or year.
- caption: the hook line first, then the story in short paragraphs separated by a blank line, then a call to action that carries the reply word as "Comment WORD" (vary the wording each time, never pushy, invite a message too), then ONE closing question related to the post. Do NOT put hashtags in the caption.
- Small believable personal details (the kettle, a quiet Tuesday, the school run, a biscuit tin). Never invent results, client names, statistics or numbers about the clinic.
- 120 to 190 words per caption. No emojis. No em dashes or en dashes anywhere. UK spelling.
- Never use negative parallelism, rhetorical triplets, a tidy summing up ending, or the buzzwords journey, glow up, game changer, unlock, dive in, tapestry, elevate, faff, fluff.
- No treatment specifics, prices, doses, results claims, guarantees, urgency or scarcity. Never mention a website or any web address.
- Qualifications the clinician gave may be mentioned lightly and truthfully. Do not add any qualification that was not given.

HASHTAGS
- Give two lines, tagsA and tagsB, each with EXACTLY 5 hashtags separated by single spaces, all based on the clinic's area (town, nearby places, county or region) plus aesthetics. Posts alternate between tagsA and tagsB.

Return JSON only: {"posts":[{"headline":"","subtitle":"","caption":""} x 8],"tagsA":"","tagsB":""}`;

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
  if (uniq.length >= 5) return uniq.slice(0, 5).join(" ");
  return fallback;
}

router.post("/free-samples/captions", async (req: Request, res: Response) => {
  try {
    const { clinicName, clinicianName, area, credentials, treatments, replyWord } = req.body as {
      clinicName?: string;
      clinicianName?: string;
      area?: string;
      credentials?: string;
      treatments?: string;
      replyWord?: string;
    };
    if (!clinicName?.trim() || !area?.trim()) {
      res.status(400).json({ error: "clinicName and area are required" });
      return;
    }
    const word = (replyWord ?? "").trim().replace(/[^A-Za-z]/g, "").toUpperCase();
    const details = [
      `Clinic: ${clinicName.trim()}`,
      clinicianName?.trim() ? `Clinician: ${clinicianName.trim()}` : "",
      `Area: ${area.trim()}`,
      credentials?.trim() ? `Qualifications and background (use only these): ${credentials.trim()}` : "No qualifications given, so mention none.",
      treatments?.trim() ? `Treatments offered (never prescription only): ${treatments.trim()}` : "No treatments given, so write treatment neutral posts about the woman and how she feels.",
      word ? `Reply word to use in every call to action: ${word}` : "Choose one short, friendly, clinic related reply word (one uppercase word, not a buzzword) and use it in every call to action.",
    ]
      .filter(Boolean)
      .join("\n");

    const system = `${HOUSE_VOICE}\n\n${BASE_RULES}\n\n${BRIEF}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: details },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 4000,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as {
      posts?: { headline?: string; subtitle?: string; caption?: string }[];
      tagsA?: string;
      tagsB?: string;
    };
    const posts = parsed.posts ?? [];
    if (posts.length < 8) {
      res.status(502).json({ error: "The writer returned fewer than 8 posts, please try again" });
      return;
    }
    const slugWord = (area.trim().split(/[,\s]+/)[0] || "Local").replace(/[^A-Za-z0-9]/g, "");
    const fbA = `#${slugWord} #${slugWord}Aesthetics #AestheticsNurse #LocalClinic #SkinCare`;
    const fbB = `#${slugWord}Life #${slugWord}Clinic #AestheticClinic #UKAesthetics #SelfCare`;
    const tagsA = fiveTags(parsed.tagsA, fbA);
    const tagsB = fiveTags(parsed.tagsB, fbB);
    res.json({
      posts: posts.slice(0, 8).map((p, i) => ({
        n: i + 1,
        week: i < 4 ? 1 : 2,
        day: DAYS[i % 4],
        headline: clean(p.headline),
        subtitle: clean(p.subtitle),
        caption: clean(p.caption),
        tags: i % 2 === 0 ? tagsA : tagsB,
      })),
    });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples captions failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Caption writing failed" });
  }
});

router.post("/free-samples/image", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "image file required" });
      return;
    }
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
    const ext = file.mimetype === "image/png" ? "png" : "jpg";
    const key = `free-samples/${uuid()}/image.${ext}`;
    await objectStorageClient.bucket(bucketId).file(key).save(file.buffer, {
      contentType: file.mimetype,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    res.json({ url: `/api/free-samples/media/${key}` });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples image upload failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

router.post("/free-samples", async (req: Request, res: Response) => {
  try {
    const { clinicName, slug, logoUrl, accent, replyWord, posts } = req.body as {
      clinicName?: string;
      slug?: string;
      logoUrl?: string;
      accent?: string;
      replyWord?: string;
      posts?: { n: number; week: number; day: string; imageUrl: string; caption: string; tags: string }[];
    };
    if (!clinicName?.trim() || !Array.isArray(posts) || posts.length !== 8) {
      res.status(400).json({ error: "clinicName and exactly 8 posts are required" });
      return;
    }
    let base = slugify(slug?.trim() || clinicName) || "clinic";
    let final = base;
    for (let i = 2; i < 50; i++) {
      const [exists] = await db.select().from(freeSamplesTable).where(eq(freeSamplesTable.slug, final));
      if (!exists) break;
      final = `${base}-${i}`;
    }
    await db.insert(freeSamplesTable).values({
      slug: final,
      clinicName: clinicName.trim(),
      data: {
        logoUrl: logoUrl ?? "",
        accent: /^#[0-9a-fA-F]{6}$/.test(accent ?? "") ? accent : "#9a5a49",
        replyWord: (replyWord ?? "").toUpperCase(),
        posts: posts.map((p) => ({
          n: p.n,
          week: p.week,
          day: p.day,
          imageUrl: p.imageUrl,
          caption: clean(p.caption),
          tags: clean(p.tags),
        })),
      },
    });
    res.json({ slug: final });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples save failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Save failed" });
  }
});

router.get("/free-samples", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(freeSamplesTable).orderBy(desc(freeSamplesTable.createdAt)).limit(100);
    res.json({ samples: rows.map((r) => ({ slug: r.slug, clinicName: r.clinicName, createdAt: (r.createdAt as Date).toISOString() })) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list samples" });
  }
});

async function streamKey(key: string, allowedPrefix: string, res: Response, cache: string): Promise<void> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    res.status(500).json({ error: "Object storage not configured" });
    return;
  }
  if (!key.startsWith(allowedPrefix) || key.includes("..")) {
    res.status(400).json({ error: "Not allowed" });
    return;
  }
  const [buffer] = await objectStorageClient.bucket(bucketId).file(key).download();
  res.set("Content-Type", key.endsWith(".png") ? "image/png" : "image/jpeg");
  res.set("Cache-Control", cache);
  res.send(buffer);
}

function paramKey(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? raw.join("/") : (raw ?? "");
}

// Public stored images for the sample pages (same origin, so they can be
// downloaded and zipped in the browser without any cross origin trouble).
router.get("/free-samples/media/*key", async (req: Request, res: Response) => {
  try {
    await streamKey(paramKey((req.params as Record<string, string | string[]>).key), "free-samples/", res, "public, max-age=31536000");
  } catch (err: unknown) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

// Studio output images, read by the tool so it can draw them onto a canvas.
router.get("/free-samples/source-image", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url ?? "");
    if (!url.startsWith("/api/media/")) {
      res.status(400).json({ error: "Not allowed" });
      return;
    }
    await streamKey(url.slice("/api/media/".length), "ai-portraits/", res, "private, max-age=600");
  } catch (err: unknown) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

router.get("/free-samples/:slug", async (req: Request, res: Response) => {
  try {
    const [row] = await db.select().from(freeSamplesTable).where(eq(freeSamplesTable.slug, String(req.params.slug)));
    if (!row) {
      res.status(404).json({ error: "Sample not found" });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json({ slug: row.slug, clinicName: row.clinicName, ...(row.data as object) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load sample" });
  }
});

router.delete("/free-samples/:slug", async (req: Request, res: Response) => {
  try {
    await db.delete(freeSamplesTable).where(eq(freeSamplesTable.slug, String(req.params.slug)));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete" });
  }
});

export default router;
