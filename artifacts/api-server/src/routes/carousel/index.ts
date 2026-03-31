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

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const sessionId = (req as any).sessionId || uuidv4();
    (req as any).sessionId = sessionId;
    const dir = path.join(uploadsBase, sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "photos" && !file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed for photos"));
      return;
    }
    cb(null, true);
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

  // Skip header row if first cell looks like a column label (Slide1, Hook, etc.)
  const first = records[0]?.[0]?.toLowerCase() ?? "";
  const looksLikeHeader = /^(slide|hook|col|column|text|caption|header)\d*$/i.test(first);
  const rows = looksLikeHeader ? records.slice(1) : records;

  return rows
    .map((row) => row.filter((c) => c.trim() !== ""))
    .filter((row) => row.length > 0);
}

router.post(
  "/carousel/generate",
  (req, _res, next) => {
    (req as any).sessionId = uuidv4();
    next();
  },
  upload.fields([
    { name: "photos", maxCount: 100 },
    { name: "csv", maxCount: 1 },
  ]),
  async (req, res): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const sessionId = (req as any).sessionId as string;

    if (!files?.photos?.length) {
      res.status(400).json({ error: "At least one photo is required" });
      return;
    }

    if (!files?.csv?.length) {
      res.status(400).json({ error: "A CSV file is required" });
      return;
    }

    const csvBuffer = fs.readFileSync(files.csv[0].path);
    const carouselRows = parseCarouselRows(csvBuffer);

    if (carouselRows.length === 0) {
      res.status(400).json({ error: "CSV file must contain at least one data row" });
      return;
    }

    const photos = files.photos;
    const MAX_CAROUSELS = 60;
    const postRows = carouselRows.slice(0, MAX_CAROUSELS);
    const slidesPerCarousel = postRows[0].length; // use first row's column count

    const slides: Array<{
      slideIndex: number;
      groupIndex: number;
      groupPosition: number;
      text: string;
      imageUrl: string;
      imageName: string;
    }> = [];

    let globalSlideIndex = 1;
    for (let pi = 0; pi < postRows.length; pi++) {
      const photo = photos[pi % photos.length]; // one photo per carousel row
      const slideTexts = postRows[pi];
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

    req.log.info({ sessionId, totalCarousels: postRows.length, slidesPerCarousel, photos: photos.length }, "Carousel generated");

    res.json({
      slides,
      totalSlides: slides.length,
      slidesPerCarousel,
      totalCarousels: postRows.length,
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

export default router;
