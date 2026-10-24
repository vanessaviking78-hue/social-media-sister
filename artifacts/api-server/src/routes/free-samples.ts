import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { eq, desc, and, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSamplesTable, freeSampleDraftsTable, scheduledPostsTable, clientPresetsTable } from "@workspace/db/schema";
import { objectStorageClient } from "../lib/objectStorage";
import { saveSampleFile, runDraft, markStaleDrafts, type DraftInput, type MixType } from "../lib/freeSampleWorker";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 12 } });

// Free Sample tool. A request (from the tool, or from the public intake link
// that Vanessa hands out in DMs and groups) is built in the background:
// Studio photos plus the 8 captions. Vanessa gets an email, opens the draft in
// the tool, then publishes a public page at /sample/<slug> or sends the 8
// posts to a client's Client Bank.

setTimeout(() => void markStaleDrafts(), 30_000).unref();

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

function paramKey(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? raw.join("/") : (raw ?? "");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[–—]/g, ",")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function str(v: unknown, max = 300): string {
  return String(v ?? "").trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// Stored images, served from this server so they can be drawn and downloaded in the browser
// ---------------------------------------------------------------------------

async function streamKey(key: string, allowedPrefixes: string[], res: Response, cache: string): Promise<void> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    res.status(500).json({ error: "Object storage not configured" });
    return;
  }
  if (!allowedPrefixes.some((p) => key.startsWith(p)) || key.includes("..")) {
    res.status(400).json({ error: "Not allowed" });
    return;
  }
  const [buffer] = await objectStorageClient.bucket(bucketId).file(key).download();
  res.set("Content-Type", key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg");
  res.set("Cache-Control", cache);
  res.send(buffer);
}

router.get("/free-samples/media/*key", async (req: Request, res: Response) => {
  try {
    await streamKey(paramKey((req.params as Record<string, string | string[]>).key), ["free-samples/"], res, "public, max-age=31536000");
  } catch (err: unknown) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

// Studio output images and uploaded photos, read by the tool so it can draw them onto a canvas.
router.get("/free-samples/source-image", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url ?? "");
    const key = url.startsWith("/api/media/") ? url.slice("/api/media/".length) : url.startsWith("/api/free-samples/media/") ? url.slice("/api/free-samples/media/".length) : "";
    if (!key) {
      res.status(400).json({ error: "Not allowed" });
      return;
    }
    await streamKey(key, ["ai-portraits/", "free-samples/"], res, "private, max-age=600");
  } catch (err: unknown) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

router.post("/free-samples/image", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "image file required" });
      return;
    }
    const key = await saveSampleFile(file.buffer, file.mimetype, "image");
    res.json({ url: `/api/free-samples/media/${key}` });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples image upload failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

// ---------------------------------------------------------------------------
// Drafts: creating them
// ---------------------------------------------------------------------------

async function createDraft(opts: {
  source: "tool" | "intake";
  clinicName: string;
  handle: string;
  area: string;
  clinicianName: string;
  credentials: string;
  treatments: string;
  email: string;
  logo?: Express.Multer.File;
  input: DraftInput;
}): Promise<string> {
  const id = uuid();
  const logoKey = opts.logo ? await saveSampleFile(opts.logo.buffer, opts.logo.mimetype, "logo") : "";
  await db.insert(freeSampleDraftsTable).values({
    id,
    status: "submitted",
    source: opts.source,
    clinicName: opts.clinicName,
    handle: opts.handle,
    area: opts.area,
    clinicianName: opts.clinicianName,
    credentials: opts.credentials,
    treatments: opts.treatments,
    email: opts.email,
    logoUrl: logoKey ? `/api/free-samples/media/${logoKey}` : "",
    input: opts.input,
  });
  setImmediate(() => void runDraft(id));
  return id;
}

const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

type Files = { [field: string]: Express.Multer.File[] };

// Public intake link: only people Vanessa sends the link to ever see it.
router.post(
  "/free-samples/intake",
  upload.fields([{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }]),
  async (req: Request, res: Response) => {
    try {
      if (tooMany(req.ip || "unknown")) {
        res.status(429).json({ error: "That is a lot of requests, please try again later" });
        return;
      }
      const files = (req.files ?? {}) as Files;
      const photo = files.photo?.[0];
      const body = req.body as Record<string, string>;
      const clinicName = str(body.clinicName, 120);
      const handle = str(body.handle, 80).replace(/^@/, "").replace(/\s+/g, "");
      const area = str(body.area, 120);
      if (!clinicName || !handle || !area || !photo) {
        res.status(400).json({ error: "Please add your clinic name, Instagram handle, town and a photo" });
        return;
      }
      if (body.consent !== "yes") {
        res.status(400).json({ error: "Please tick the box to say you are happy for your photo to be used" });
        return;
      }
      if (!IMAGE_MIMES.includes(photo.mimetype) || (files.logo?.[0] && !IMAGE_MIMES.includes(files.logo[0].mimetype))) {
        res.status(400).json({ error: "Please upload a JPG, PNG or WebP image" });
        return;
      }
      // One request per handle in 48 hours
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const existing = await db
        .select()
        .from(freeSampleDraftsTable)
        .where(and(eq(freeSampleDraftsTable.source, "intake"), gt(freeSampleDraftsTable.createdAt, since)));
      if (existing.some((d) => d.handle.toLowerCase() === handle.toLowerCase())) {
        res.json({ ok: true });
        return;
      }
      const photoKey = await saveSampleFile(photo.buffer, photo.mimetype, "photo");
      await createDraft({
        source: "intake",
        clinicName,
        handle,
        area,
        clinicianName: "",
        credentials: "",
        treatments: "",
        email: str(body.email, 160),
        logo: files.logo?.[0],
        input: { mixType: "half", shirt: "bright optic white", photoKey },
      });
      res.json({ ok: true });
    } catch (err: unknown) {
      req.log?.error({ err }, "free-samples intake failed");
      res.status(500).json({ error: "Something went wrong, please try again" });
    }
  },
);

const REQUEST_FIELDS = [{ name: "photo", maxCount: 1 }, { name: "logo", maxCount: 1 }, ...Array.from({ length: 8 }, (_, i) => ({ name: `a${i}`, maxCount: 1 }))];

// From the tool: all the options, including approved photos for some or all of the 8 slots.
router.post("/free-samples/requests", upload.fields(REQUEST_FIELDS), async (req: Request, res: Response) => {
  try {
    const files = (req.files ?? {}) as Files;
    let meta: Record<string, string> = {};
    try {
      meta = JSON.parse(String((req.body as Record<string, string>).meta ?? "{}"));
    } catch {
      /* fall through to validation */
    }
    const clinicName = str(meta.clinicName, 120);
    const area = str(meta.area, 120);
    if (!clinicName || !area) {
      res.status(400).json({ error: "clinicName and area are required" });
      return;
    }
    const approved: Record<string, string> = {};
    for (let i = 0; i < 8; i++) {
      const f = files[`a${i}`]?.[0];
      if (f) approved[String(i)] = await saveSampleFile(f.buffer, f.mimetype, `approved-${i}`);
    }
    const photo = files.photo?.[0];
    if (!photo && Object.keys(approved).length < 8) {
      res.status(400).json({ error: "Add the clinician photo, or choose all 8 approved photos" });
      return;
    }
    const photoKey = photo ? await saveSampleFile(photo.buffer, photo.mimetype, "photo") : undefined;
    const id = await createDraft({
      source: "tool",
      clinicName,
      handle: str(meta.handle, 80).replace(/^@/, ""),
      area,
      clinicianName: str(meta.clinicianName, 80),
      credentials: str(meta.credentials, 300),
      treatments: str(meta.treatments, 300),
      email: "",
      logo: files.logo?.[0],
      input: {
        mixType: (meta.mixType === "standard" ? "standard" : "half") as MixType,
        shirt: str(meta.shirt, 40) || "bright optic white",
        month: str(meta.month, 20),
        approved,
        photoKey,
      },
    });
    res.json({ id });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples request failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not start the sample" });
  }
});

// ---------------------------------------------------------------------------
// Drafts: listing, opening, editing, retrying, deleting
// ---------------------------------------------------------------------------

router.get("/free-samples/drafts", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(freeSampleDraftsTable).orderBy(desc(freeSampleDraftsTable.createdAt)).limit(100);
    res.json({
      drafts: rows.map((r) => ({
        id: r.id,
        status: r.status,
        source: r.source,
        clinicName: r.clinicName,
        handle: r.handle,
        slug: r.slug,
        error: r.error,
        createdAt: (r.createdAt as Date).toISOString(),
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list drafts" });
  }
});

router.get("/free-samples/drafts/:id", async (req: Request, res: Response) => {
  try {
    const [r] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, String(req.params.id)));
    if (!r) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json({
      id: r.id,
      status: r.status,
      source: r.source,
      clinicName: r.clinicName,
      handle: r.handle,
      area: r.area,
      logoUrl: r.logoUrl,
      slug: r.slug,
      error: r.error,
      data: r.data,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load draft" });
  }
});

// Save edits to the headlines and captions, or note which public page it became.
router.patch("/free-samples/drafts/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [r] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, id));
    if (!r) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    const body = req.body as { posts?: { n: number; headline: string; subtitle: string; caption: string; tags: string }[]; slug?: string };
    const data = { ...((r.data ?? {}) as { posts?: Record<string, unknown>[] }) };
    if (Array.isArray(body.posts) && Array.isArray(data.posts)) {
      data.posts = data.posts.map((p) => {
        const edit = body.posts!.find((e) => e.n === p.n);
        return edit ? { ...p, headline: clean(edit.headline), subtitle: clean(edit.subtitle), caption: clean(edit.caption), tags: clean(edit.tags) } : p;
      });
    }
    await db
      .update(freeSampleDraftsTable)
      .set({ data, slug: body.slug ?? r.slug, updatedAt: new Date() })
      .where(eq(freeSampleDraftsTable.id, id));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save" });
  }
});

router.post("/free-samples/drafts/:id/retry", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [r] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, id));
    if (!r) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (r.status === "working") {
      res.status(409).json({ error: "It is still being built" });
      return;
    }
    setImmediate(() => void runDraft(id));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to retry" });
  }
});

router.delete("/free-samples/drafts/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete" });
  }
});

// ---------------------------------------------------------------------------
// Send the 8 finished posts to a client's Client Bank (parked drafts, no dates)
// ---------------------------------------------------------------------------

router.post("/free-samples/send-to-bank", async (req: Request, res: Response) => {
  try {
    const { presetId, draftId, posts } = req.body as {
      presetId?: number;
      draftId?: string;
      posts?: { n: number; headline?: string; imageUrl: string; caption: string; tags: string }[];
    };
    if (!presetId || !Array.isArray(posts) || posts.length !== 8) {
      res.status(400).json({ error: "presetId and exactly 8 posts are required" });
      return;
    }
    const [preset] = await db.select().from(clientPresetsTable).where(eq(clientPresetsTable.id, presetId));
    if (!preset) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    for (const p of posts) {
      // The scheduler reads stored images from /api/media/<key>
      const imageUrl = p.imageUrl.replace("/api/free-samples/media/", "/api/media/");
      await db.insert(scheduledPostsTable).values({
        presetId,
        clientName: preset.name,
        postType: "carousel",
        content: {
          imageUrls: [imageUrl],
          caption: `${clean(p.caption)}\n\n${clean(p.tags)}`,
          title: clean(p.headline) || `Sample post ${p.n}`,
          sourceTool: "free-sample",
        },
        scheduledAt: new Date(),
        status: "draft",
        notes: "From the Free Sample tool",
      });
    }
    if (draftId) {
      await db.update(freeSampleDraftsTable).set({ status: "sent", updatedAt: new Date() }).where(eq(freeSampleDraftsTable.id, draftId));
    }
    res.json({ ok: true, clientName: preset.name });
  } catch (err: unknown) {
    req.log?.error({ err }, "free-samples send-to-bank failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not send to the Client Bank" });
  }
});

// ---------------------------------------------------------------------------
// Published sample pages
// ---------------------------------------------------------------------------

router.post("/free-samples", async (req: Request, res: Response) => {
  try {
    const { clinicName, slug, logoUrl, accent, draftId, posts } = req.body as {
      clinicName?: string;
      slug?: string;
      logoUrl?: string;
      accent?: string;
      draftId?: string;
      posts?: { n: number; week: number; day: string; imageUrl: string; caption: string; tags: string }[];
    };
    if (!clinicName?.trim() || !Array.isArray(posts) || posts.length !== 8) {
      res.status(400).json({ error: "clinicName and exactly 8 posts are required" });
      return;
    }
    const base = slugify(slug?.trim() || clinicName) || "clinic";
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
    if (draftId) {
      await db
        .update(freeSampleDraftsTable)
        .set({ status: "published", slug: final, updatedAt: new Date() })
        .where(eq(freeSampleDraftsTable.id, draftId));
    }
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
