import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSampleDraftsTable } from "@workspace/db/schema";
import { openai } from "@workspace/integrations-openai-ai-server";
import { saveSampleFile, needsRewrite, rewriteFlagged } from "../lib/freeSampleWorker";
import { runPackDraft, type PackInput } from "../lib/packWorker";
import { HOUSE_RULES, HASHTAG_RULE, HOUSE_VOICE } from "../lib/houseRules";
import { BASE_RULES } from "./caption-generator";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 6 } });

// Post Pack. A clinic orders 12, 20 or 30 posts on the public form. While Vanessa is testing no payment is taken
// (PACK_PAYMENTS is not "on"), the order is saved as a draft, the Studio portraits are made in the background, and
// she opens it on the review page, where the posts are planned, written and drawn before anyone gets the link.

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const SIZES = [12, 20, 30] as const;
const ROLES = ["nurse", "injector", "dentist", "doctor", "pharmacist", "other"];

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const hex = (v: unknown, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? "").trim()) ? String(v).trim() : fallback);
const noDashes = (t: unknown) => String(t ?? "").replace(/[–—]/g, ",").replace(/\s+\n/g, "\n").trim();

const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

type Files = { [field: string]: Express.Multer.File[] };

router.post(
  "/post-packs/intake",
  upload.fields([{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }, { name: "extra", maxCount: 3 }]),
  async (req: Request, res: Response) => {
    try {
      if (tooMany(req.ip || "unknown")) {
        res.status(429).json({ error: "That is a lot of orders in a short time, please try again later" });
        return;
      }
      const files = (req.files ?? {}) as Files;
      const photo = files.photo?.[0];
      const logo = files.logo?.[0];
      const extras = files.extra ?? [];
      const body = req.body as Record<string, string>;
      const clinicName = str(body.clinicName, 120);
      const handle = str(body.handle, 80).replace(/^@/, "").replace(/\s+/g, "");
      const area = str(body.area, 120);
      const role = str(body.role, 60).toLowerCase();
      const email = str(body.email, 160);
      const size = Number(body.size) as 12 | 20 | 30;
      if (!clinicName || !handle || !area || !email || !photo) {
        res.status(400).json({ error: "Please add your clinic name, Instagram handle, area, email and a photo of you" });
        return;
      }
      if (!role) {
        res.status(400).json({ error: "Please tell us your role, for example nurse or injector" });
        return;
      }
      if (!SIZES.includes(size)) {
        res.status(400).json({ error: "Please choose 12, 20 or 30 posts" });
        return;
      }
      if (body.consent !== "yes") {
        res.status(400).json({ error: "Please tick the box to say you are happy for your photo to be used" });
        return;
      }
      for (const f of [photo, logo, ...extras]) {
        if (f && !IMAGE_MIMES.includes(f.mimetype)) {
          res.status(400).json({ error: "Please upload JPG, PNG or WebP images" });
          return;
        }
      }
      const photoKey = await saveSampleFile(photo.buffer, photo.mimetype, "photo");
      const extraKeys: string[] = [];
      for (let i = 0; i < extras.length; i++) extraKeys.push(await saveSampleFile(extras[i].buffer, extras[i].mimetype, `own-${i}`));
      const logoKey = logo ? await saveSampleFile(logo.buffer, logo.mimetype, "logo") : "";
      let treatments: string[] = [];
      try {
        const t = JSON.parse(body.treatments || "[]");
        if (Array.isArray(t)) treatments = t.map((x) => str(x, 60)).filter(Boolean).slice(0, 30);
      } catch { /* none ticked */ }

      const now = new Date();
      const pack: PackInput = {
        size,
        role: ROLES.includes(role) || role.length <= 60 ? role : "other",
        website: str(body.website, 200),
        mainHex: hex(body.mainHex, "#1f3a5f"),
        accentHex: hex(body.accentHex, "#c9a27a"),
        photoKey,
        extraKeys,
        treatments,
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        test: process.env.PACK_PAYMENTS !== "on",
      };
      const id = uuid();
      await db.insert(freeSampleDraftsTable).values({
        id,
        status: "submitted",
        source: "pack",
        clinicName,
        handle,
        area,
        clinicianName: str(body.clinicianName, 80),
        credentials: "",
        treatments: treatments.join(", "),
        email,
        logoUrl: logoKey ? `/api/free-samples/media/${logoKey}` : "",
        input: { pack },
      });
      setImmediate(() => void runPackDraft(id));
      res.json({ ok: true });
    } catch (err: unknown) {
      req.log?.error({ err }, "post-packs intake failed");
      res.status(500).json({ error: "Something went wrong, please try again" });
    }
  },
);

router.post("/post-packs/drafts/:id/retry", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [r] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, id));
    if (!r || r.source !== "pack") {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (r.status === "working") {
      res.status(409).json({ error: "It is still being built" });
      return;
    }
    setImmediate(() => void runPackDraft(id));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to retry" });
  }
});

// ---------------------------------------------------------------------------
// The caption and on image words writer. The review page plans the pack, then sends the posts here in small
// batches. Each item says what kind of post it is and which words fields it has, and gets back words for all of them.
// ---------------------------------------------------------------------------

type CopyItem = {
  n: number;
  kind: "portrait" | "tweet" | "treatment" | "unique" | "empower" | "lux";
  idea: string;
  fields: { key: string; label: string; rows?: number }[];
  current: Record<string, string>;
  photoSlides: number; // how many photo slides follow the cover
};
type CopyReq = {
  clinic: { name: string; owner?: string; role: string; area: string; treatments: string[] };
  items: CopyItem[];
};

const KIND_BRIEF: Record<CopyItem["kind"], string> = {
  portrait:
    "A photo post of me. Give headline (2 to 4 words that sit big on the photo) and subtitle (3 to 8 words that finish the thought), which read together as one hook line with no full stops. Put them in text.headline and text.subtitle. Caption 120 to 190 words.",
  tweet:
    'A tweet style graphic. Put the tweet in text.quote: one short, funny or painfully relatable line in my voice, under 180 characters, no hashtags, no emojis. Caption 60 to 110 words that carries the same idea on in my voice.',
  treatment:
    "A five slide treatment carousel in the format of a funny list of 'possible side effects' of a treatment I offer. Rewrite the wording in each field of text in the same shape as the current wording but new and specific, keeping each line short. Put the words for each photo slide in slides (short, 8 to 20 words each, same funny list voice). Treatment posts end the caption with exactly: Drop me a DM to see if you're a good fit for this. Caption 90 to 150 words. Only talk about treatments from the list I offer. Never prescription only treatments.",
  unique:
    "A designed graphic post followed by photo slides. Rewrite each field of text so it is fresh and specific but keeps the shape and length of the current wording. Put the words for each photo slide in slides (short, 8 to 25 words each). Caption 100 to 170 words.",
  empower:
    "A single designed graphic about midlife confidence. Rewrite each field of text so it is fresh and specific but keeps the shape and length of the current wording. Caption 90 to 150 words.",
  lux:
    "A premium looking carousel. Rewrite each field of text so it is fresh and specific but keeps the shape and length of the current wording. Put the words for each photo slide in slides (short, 8 to 25 words each). Caption 100 to 170 words.",
};

router.post("/post-packs/copy", async (req: Request, res: Response) => {
  try {
    const body = req.body as CopyReq;
    if (!body?.clinic?.name || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 6) {
      res.status(400).json({ error: "Send the clinic and between 1 and 6 posts" });
      return;
    }
    const c = body.clinic;
    const details = [
      `Clinic: ${str(c.name, 120)}`,
      c.owner ? `Clinician: ${str(c.owner, 80)}` : "",
      `Role: ${str(c.role, 60)} (I may say I am a ${str(c.role, 60)} but add no qualification that was not given)`,
      `Area: ${str(c.area, 120)}`,
      Array.isArray(c.treatments) && c.treatments.length ? `Treatments I offer (never prescription only): ${c.treatments.map((t) => str(t, 60)).join(", ")}` : "No treatments given, so keep every post treatment neutral about the woman and how she feels.",
    ].filter(Boolean).join("\n");

    const items = body.items.map((it) => ({
      n: it.n,
      kind: it.kind,
      brief: KIND_BRIEF[it.kind],
      idea: str(it.idea, 300),
      fields: it.fields.slice(0, 12).map((f) => ({ key: f.key, label: f.label })),
      currentWording: it.current,
      photoSlides: Math.max(0, Math.min(5, it.photoSlides | 0)),
    }));

    const system = `${HOUSE_VOICE}\n\n${BASE_RULES}\n\n${HOUSE_RULES}\n\n${HASHTAG_RULE}\n\nYOU ARE WRITING POSTS FOR A PAID POST PACK, as the clinic owner in the first person. For every item return its words and its Instagram caption.
- caption: the hook line first, then the story in short paragraphs separated by a blank line, then ONE closing question that relates to the post and is easy and fun to answer in the comments. The only exception is a treatment post, which ends with exactly: Drop me a DM to see if you're a good fit for this. No hashtags in the caption, no emojis, no em dashes or en dashes, UK spelling, never a website or web address, never a reply word.
- text: an object with a value for every field key given (and headline and subtitle, or quote, where the brief says so).
- slides: an array with exactly photoSlides entries (empty if photoSlides is 0).
- cta: for items with photo slides, a short closing question for the last slide, written for that post. Empty otherwise.
- Never invent results, client names, statistics or numbers about the clinic.
- Also return tagsA and tagsB: two lines, each EXACTLY 5 hashtags separated by single spaces, all based on the clinic's area (town, nearby places, county or region) plus beauty or aesthetics. Posts alternate between them.
Return JSON only: {"items":[{"n":0,"text":{},"slides":[],"cta":"","caption":""}],"tagsA":"","tagsB":""}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${details}\n\nPOSTS TO WRITE:\n${JSON.stringify(items)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 4000,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      items?: { n: number; text?: Record<string, string>; slides?: string[]; cta?: string; caption?: string }[];
      tagsA?: string;
      tagsB?: string;
    };
    const out = (parsed.items ?? []).map((p) => ({
      n: p.n,
      text: Object.fromEntries(Object.entries(p.text ?? {}).map(([k, v]) => [k, noDashes(v)])),
      slides: (p.slides ?? []).map(noDashes),
      cta: noDashes(p.cta),
      caption: noDashes(p.caption),
    }));
    // The same negative parallelism and banned word check the free sample runs.
    const forCheck = out.map((p) => ({ headline: "", subtitle: "", caption: p.caption }));
    if (forCheck.some((p) => needsRewrite(p.caption))) {
      await rewriteFlagged(forCheck).catch(() => {});
      forCheck.forEach((p, i) => (out[i].caption = p.caption));
    }
    res.json({ items: out, tagsA: noDashes(parsed.tagsA), tagsB: noDashes(parsed.tagsB) });
  } catch (err: unknown) {
    req.log?.error({ err }, "post-packs copy failed");
    res.status(500).json({ error: "The words would not write, try again" });
  }
});

export default router;
