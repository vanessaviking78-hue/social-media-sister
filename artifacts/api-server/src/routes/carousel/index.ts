import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { parse } from "csv-parse/sync";

const router: IRouter = Router();

const uploadsBase = path.join(os.tmpdir(), "carousel-uploads");
if (!fs.existsSync(uploadsBase)) {
  fs.mkdirSync(uploadsBase, { recursive: true });
}

function makeStorage(getSessionId: (req: Express.Request) => string) {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      const sessionId = getSessionId(req as any);
      (req as any).sessionId = sessionId;
      const dir = path.join(uploadsBase, sessionId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = Date.now() + Math.random().toString(36).slice(2, 6) + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, safe);
    },
  });
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const uploadBatch = multer({
  storage: makeStorage((req: any) => (req.query?.sessionId as string) || uuidv4()),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, IMAGE_MIMES.has(file.mimetype));
  },
});

const uploadAll = multer({
  storage: makeStorage((req: any) => (req as any).sessionId || (req.query?.sessionId as string) || uuidv4()),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "photos") cb(null, IMAGE_MIMES.has(file.mimetype));
    else cb(null, true);
  },
});

/**
 * Parse CSV where each row is one carousel post and each column is one slide.
 * Returns string[][] — outer = carousel posts, inner = slide captions.
 * Header row is skipped automatically.
 */
function parseCarouselRows(csvBuffer: Buffer): string[][] {
  let records: string[][] = [];

  try {
    records = parse(csvBuffer, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch {
    const text = csvBuffer.toString("utf-8");
    records = text
      .split("\n")
      .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")))
      .filter((r) => r.some((c) => c));
  }

  if (records.length === 0) return [];

  const first = records[0]?.[0]?.toLowerCase() ?? "";
  const looksLikeHeader = /^(slide|hook|col|column|text|caption|header)\d*$/i.test(first);
  const rows = looksLikeHeader ? records.slice(1) : records;

  return rows
    .map((row) => row.filter((c) => c.trim() !== ""))
    .filter((row) => row.length > 0);
}

function buildSlides(
  postRows: string[][],
  photos: { path: string; originalname: string }[],
  sessionId: string
) {
  const MAX_CAROUSELS = 60;
  const rows = postRows.slice(0, MAX_CAROUSELS);
  const slidesPerCarousel = rows[0].length;
  const slides: Array<{
    slideIndex: number;
    groupIndex: number;
    groupPosition: number;
    text: string;
    imageUrl: string;
    imageName: string;
  }> = [];

  let globalSlideIndex = 1;
  for (let pi = 0; pi < rows.length; pi++) {
    const photo = photos[pi % photos.length];
    const slideTexts = rows[pi];
    for (let si = 0; si < slideTexts.length; si++) {
      slides.push({
        slideIndex: globalSlideIndex++,
        groupIndex: pi + 1,
        groupPosition: si + 1,
        text: slideTexts[si],
        imageUrl: `/api/carousel/image/${sessionId}/${path.basename(photo.path)}`,
        imageName: photo.originalname,
      });
    }
  }
  return { slides, slidesPerCarousel, totalCarousels: rows.length };
}

/** Upload a batch of photos to an existing (or new) session */
router.post(
  "/carousel/upload-photos",
  uploadBatch.fields([{ name: "photos", maxCount: 20 }]),
  (req, res): void => {
    const sessionId = (req as any).sessionId as string;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const count = files?.photos?.length ?? 0;
    res.json({ sessionId, uploaded: count });
  }
);

/** Generate carousels — accepts either:
 *  A) sessionId (query) + csv (file) — photos already uploaded in batches
 *  B) photos (files) + csv (file) — all-in-one legacy mode */
router.post(
  "/carousel/generate",
  (req, _res, next) => {
    (req as any).sessionId = (req.query.sessionId as string) || uuidv4();
    next();
  },
  uploadAll.fields([
    { name: "photos", maxCount: 100 },
    { name: "csv", maxCount: 1 },
  ]),
  async (req, res): Promise<void> => {
    const sessionId = (req as any).sessionId as string;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files?.csv?.length) {
      res.status(400).json({ error: "A CSV file is required" });
      return;
    }

    let photos: { path: string; originalname: string }[];

    if (files?.photos?.length) {
      photos = files.photos.map((f) => ({ path: f.path, originalname: f.originalname }));
    } else {
      const sessionDir = path.join(uploadsBase, sessionId);
      if (!fs.existsSync(sessionDir)) {
        res.status(400).json({ error: "Session not found — please upload photos first" });
        return;
      }
      const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
      const photoFiles = fs.readdirSync(sessionDir)
        .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .sort()
        .map((f) => ({ path: path.join(sessionDir, f), originalname: f }));
      if (photoFiles.length === 0) {
        res.status(400).json({ error: "No photos found in session — please upload photos first" });
        return;
      }
      photos = photoFiles;
    }

    const csvBuffer = fs.readFileSync(files.csv[0].path);
    const carouselRows = parseCarouselRows(csvBuffer);

    if (carouselRows.length === 0) {
      res.status(400).json({ error: "CSV file must contain at least one data row" });
      return;
    }

    const { slides, slidesPerCarousel, totalCarousels } = buildSlides(carouselRows, photos, sessionId);

    req.log.info({ sessionId, totalCarousels, slidesPerCarousel, photos: photos.length }, "Carousel generated");

    res.json({
      slides,
      totalSlides: slides.length,
      slidesPerCarousel,
      totalCarousels,
      sessionId,
    });
  }
);

router.get(
  "/carousel/image/:sessionId/:filename",
  async (req, res): Promise<void> => {
    const rawSessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    const rawFilename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;

    if (!/^[a-f0-9-]+$/.test(rawSessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const safeName = path.basename(rawFilename);
    const filePath = path.join(uploadsBase, rawSessionId, safeName);

    if (!filePath.startsWith(uploadsBase)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.sendFile(filePath);
  }
);

router.post("/carousel/generate-caption", async (req, res) => {
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const { hook = "", subtitle = "", body2 = "", body3 = "", cta = "" } = req.body as {
      hook?: string; subtitle?: string; body2?: string; body3?: string; cta?: string;
    };
    const slideContext = [
      hook     && `Hook: "${hook}"`,
      subtitle && `Subtitle: "${subtitle}"`,
      body2    && `Slide 2: "${body2}"`,
      body3    && `Slide 3: "${body3}"`,
      cta      && `CTA: "${cta}"`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Write an Instagram caption for an aesthetic clinic practitioner based on the carousel slide content provided. The caption must sound like a real human wrote it - warm, honest, direct and conversational. Write in first person. Never use emdashes. Never use americanisations (use British English). Never use AI-sounding phrases or marketing clichés. No bullet points. No hashtag blocks. Just 7-10 natural sentences that match the topic and tone of the slides, as if the practitioner is talking directly to their audience. Sound like a real person, not a brand.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Carousel slides:\n${slideContext}` },
      ],
      max_completion_tokens: 400,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ caption });
  } catch (e: unknown) {
    req.log.error(e, "carousel generate-caption failed");
    res.status(500).json({ error: "Caption generation failed" });
  }
});

export default router;
