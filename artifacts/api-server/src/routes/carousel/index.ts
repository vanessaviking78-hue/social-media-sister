import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { parse } from "csv-parse/sync";
import { logger } from "../../lib/logger";

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
    if (file.fieldname === "csv") {
      if (
        !file.mimetype.includes("csv") &&
        !file.mimetype.includes("text") &&
        !file.originalname.endsWith(".csv")
      ) {
        cb(new Error("Only CSV files are allowed"));
        return;
      }
    }
    cb(null, true);
  },
});

function parseTextRows(csvBuffer: Buffer): string[] {
  try {
    const records = parse(csvBuffer, {
      skip_empty_lines: true,
      trim: true,
    }) as string[][];

    const rows: string[] = [];
    for (const row of records) {
      if (row.length > 0 && row[0].trim()) {
        rows.push(row[0].trim());
      }
    }
    return rows;
  } catch {
    const text = csvBuffer.toString("utf-8");
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }
}

router.post(
  "/carousel/generate",
  (req, res, next) => {
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
    const textRows = parseTextRows(csvBuffer);

    if (textRows.length === 0) {
      res.status(400).json({ error: "CSV file must contain at least one row of text" });
      return;
    }

    const photos = files.photos;
    const MAX_SLIDES = 30;
    const slideCount = Math.min(MAX_SLIDES, textRows.length);

    const slides = [];
    for (let i = 0; i < slideCount; i++) {
      const photo = photos[i % photos.length];
      const imageUrl = `/api/carousel/image/${sessionId}/${path.basename(photo.path)}`;

      slides.push({
        index: i + 1,
        text: textRows[i],
        imageUrl,
        imageName: photo.originalname,
      });
    }

    req.log.info(
      { sessionId, slideCount, photos: photos.length, textRows: textRows.length },
      "Carousel generated"
    );

    res.json({
      slides,
      totalSlides: slides.length,
      sessionId,
    });
  }
);

router.get("/carousel/image/:sessionId/:filename", async (req, res): Promise<void> => {
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
});

export default router;
