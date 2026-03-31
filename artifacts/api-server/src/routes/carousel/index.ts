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
    const safeFilename =
      Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, safeFilename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "photos") {
      if (!file.mimetype.startsWith("image/")) {
        cb(new Error("Only image files are allowed for photos"));
        return;
      }
    }
    cb(null, true);
  },
});

/**
 * Parse CSV into a 2D array of strings.
 * Each row becomes one carousel post; each column is one slide's text.
 * The first row is skipped if it looks like a header (e.g. Slide1, Slide2 …).
 */
function parseCarouselCsv(csvBuffer: Buffer): string[][] {
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
      .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")))
      .filter((row) => row.some((cell) => cell));
  }

  if (records.length === 0) return [];

  // Skip header row if first cell looks like a column label (Slide1, Column1, etc.)
  const firstCell = records[0]?.[0]?.toLowerCase() ?? "";
  const looksLikeHeader =
    /^(slide|col|column|text|header)\d*$/i.test(firstCell) ||
    records[0].every((cell) => /^[a-z][a-z0-9_\s]*$/i.test(cell) && !/\s{2,}/.test(cell));

  const dataRows = looksLikeHeader ? records.slice(1) : records;

  return dataRows
    .map((row) => row.filter((cell) => cell.trim() !== ""))
    .filter((row) => row.length > 0);
}

router.post(
  "/carousel/generate",
  (req, _res, next) => {
    (req as any).sessionId = uuidv4();
    next();
  },
  upload.fields([
    { name: "photos", maxCount: 50 },
    { name: "csv", maxCount: 1 },
  ]),
  async (req, res): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const sessionId = (req as any).sessionId as string;

    if (!files?.photos || files.photos.length === 0) {
      res.status(400).json({ error: "At least one photo is required" });
      return;
    }

    if (!files?.csv || files.csv.length === 0) {
      res.status(400).json({ error: "A CSV file is required" });
      return;
    }

    const csvFile = files.csv[0];
    const csvBuffer = fs.readFileSync(csvFile.path);
    const carouselRows = parseCarouselCsv(csvBuffer);

    if (carouselRows.length === 0) {
      res.status(400).json({ error: "CSV file must contain at least one row of text" });
      return;
    }

    const photos = files.photos;
    const MAX_POSTS = 30;
    const postCount = Math.min(MAX_POSTS, carouselRows.length);
    const slidesPerPost = carouselRows[0].length;

    const posts = [];
    for (let p = 0; p < postCount; p++) {
      const slideTexts = carouselRows[p];
      const slides = [];

      for (let s = 0; s < slideTexts.length; s++) {
        const photo = photos[(p * slideTexts.length + s) % photos.length];
        const imageUrl = `/api/carousel/image/${sessionId}/${path.basename(photo.path)}`;
        slides.push({
          slideIndex: s + 1,
          text: slideTexts[s],
          imageUrl,
          imageName: photo.originalname,
        });
      }

      posts.push({ postIndex: p + 1, slides });
    }

    req.log.info(
      { sessionId, postCount, slidesPerPost, photos: photos.length },
      "Carousel generated"
    );

    res.json({
      posts,
      totalPosts: posts.length,
      slidesPerPost,
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
