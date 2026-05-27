import { v4 as uuid } from "uuid";
import { parse as csvParse } from "csv-parse/sync";
import JSZip from "jszip";
import { db } from "@workspace/db";
import { contentLibraryTable } from "@workspace/db/schema";
import { objectStorageClient } from "./objectStorage";
import { logger } from "./logger";

export interface BulkImportProgress {
  processed: number;
  total: number;
  currentFile: string;
}

export interface BulkImportJob {
  status: "running" | "done" | "error";
  progress: BulkImportProgress;
  summary: Record<string, number>;
  errors: string[];
  startedAt: number;
  errorMessage?: string;
}

const jobs = new Map<string, BulkImportJob>();

setInterval(() => {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id);
  }
}, 15 * 60_000).unref();

export function createBulkJob(jobId: string): string {
  jobs.set(jobId, {
    status: "running",
    progress: { processed: 0, total: 0, currentFile: "" },
    summary: {},
    errors: [],
    startedAt: Date.now(),
  });
  return jobId;
}

export function getBulkJob(jobId: string): BulkImportJob | undefined {
  return jobs.get(jobId);
}

function safeClientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function detectMime(filename: string): string {
  const ext = (filename.toLowerCase().split(".").pop() ?? "");
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", avif: "image/avif",
    mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", avi: "video/avi",
  };
  return map[ext] ?? "application/octet-stream";
}

async function uploadMedia(buf: Buffer, filename: string, clientName: string, importStamp: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const slug = safeClientSlug(clientName);
  const key = `library/${slug}/bulk-${importStamp}/${filename}`;
  await objectStorageClient.bucket(bucketId).file(key).save(buf, {
    contentType: detectMime(filename),
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return `/api/media/${key}`;
}

const CSV_CONFIGS: Record<string, {
  postType: string;
  mediaFields: string[];
  pipeFields?: string[];
  requiredField?: string;
  graduationStrategy?: string;
}> = {
  "carousels.csv": {
    postType: "carousel",
    mediaFields: ["slide_1_image", "slide_2_image", "slide_3_image", "slide_4_image", "slide_5_image"],
  },
  "singles.csv": {
    postType: "single",
    mediaFields: ["image_filename"],
  },
  "about_mes.csv": {
    postType: "about-me",
    mediaFields: ["subject_image", "background_image"],
  },
  "seamless.csv": {
    postType: "seamless-carousel",
    mediaFields: [],
    pipeFields: ["images"],
  },
  "reels.csv": {
    postType: "reel",
    mediaFields: ["video_filename", "cover_image"],
  },
  "trial_reels.csv": {
    postType: "trial-reel",
    mediaFields: ["video_filename", "cover_image"],
    graduationStrategy: "MANUAL",
  },
};

type AnyRow = Record<string, string>;

function buildMediaUrls(row: AnyRow, cfg: typeof CSV_CONFIGS[string], fileMap: Map<string, Buffer>): { urls: string[]; primaryKey: string; missing: string[] } {
  const keys: string[] = [];

  for (const field of cfg.mediaFields) {
    const val = (row[field] || "").trim();
    if (val) keys.push(val);
  }

  for (const field of cfg.pipeFields ?? []) {
    const val = (row[field] || "").trim();
    if (val) {
      for (const part of val.split("|").map((v) => v.trim()).filter(Boolean)) {
        keys.push(part);
      }
    }
  }

  const found: string[] = [];
  const missing: string[] = [];
  for (const k of keys) {
    if (fileMap.has(k.toLowerCase())) found.push(k);
    else missing.push(k);
  }

  return { urls: found, primaryKey: found[0] ?? "", missing };
}

export async function processBulkJob(
  jobId: string,
  zipBuffer: Buffer,
  clientName: string,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const importStamp = String(Date.now());

  try {
    const zip = await JSZip.loadAsync(zipBuffer);

    const fileMap = new Map<string, Buffer>();
    for (const [name, entry] of Object.entries(zip.files)) {
      if (!entry.dir) {
        const basename = name.split("/").pop()!;
        fileMap.set(basename.toLowerCase(), Buffer.from(await entry.async("arraybuffer")));
        fileMap.set(basename, Buffer.from(await entry.async("arraybuffer")));
      }
    }

    const detectedCsvs: Array<{ csvName: string; config: typeof CSV_CONFIGS[string]; rows: AnyRow[] }> = [];

    for (const [csvName, config] of Object.entries(CSV_CONFIGS)) {
      const csvBuf = fileMap.get(csvName) ?? fileMap.get(csvName.toLowerCase());
      if (!csvBuf) continue;

      try {
        const rows = csvParse(csvBuf, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }) as AnyRow[];

        if (rows.length > 0) {
          detectedCsvs.push({ csvName, config, rows });
        }
      } catch (parseErr: unknown) {
        job.errors.push(`Could not parse ${csvName}: ${parseErr instanceof Error ? parseErr.message : "parse error"}`);
      }
    }

    const totalRows = detectedCsvs.reduce((sum, c) => sum + c.rows.length, 0);
    job.progress.total = totalRows;

    if (totalRows === 0) {
      job.status = "done";
      job.progress.currentFile = "No matching CSV files found in zip";
      return;
    }

    let processed = 0;

    for (const { csvName, config, rows } of detectedCsvs) {
      job.progress.currentFile = csvName;
      const typeKey = config.postType;
      if (!job.summary[typeKey]) job.summary[typeKey] = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const { urls: mediaKeys, primaryKey, missing } = buildMediaUrls(row, config, fileMap);

          if (missing.length > 0) {
            job.errors.push(`${csvName} row ${rowNum}: missing media file(s): ${missing.join(", ")} — row skipped`);
            processed++;
            job.progress.processed = processed;
            continue;
          }

          const mediaNoRequiredMedia = config.mediaFields.length === 0 && (config.pipeFields ?? []).length === 0;
          if (!mediaNoRequiredMedia && mediaKeys.length === 0) {
            processed++;
            job.progress.processed = processed;
            continue;
          }

          const uploadedUrls: string[] = [];
          let thumbnailUrl: string | null = null;

          for (const key of mediaKeys) {
            const buf = fileMap.get(key.toLowerCase()) ?? fileMap.get(key);
            if (!buf) continue;
            const url = await uploadMedia(buf, key, clientName, importStamp);
            uploadedUrls.push(url);
            if (!thumbnailUrl) thumbnailUrl = url;
          }

          const metadata: Record<string, unknown> = {};

          const musicTrack = (row.music_track || "").trim();
          if (musicTrack) metadata.musicTrack = musicTrack;

          if (config.postType === "carousel") {
            const textStyle = (row.text_style || "").trim();
            if (textStyle) metadata.textStyle = textStyle;
            if (row.slide_1_lead_in?.trim()) metadata.slide1LeadIn = row.slide_1_lead_in.trim();
            if (row.slide_1_hero_word?.trim()) metadata.slide1HeroWord = row.slide_1_hero_word.trim();

            const slideTexts: string[] = [];
            for (let s = 1; s <= 5; s++) {
              const t = (row[`slide_${s}_text`] || "").trim();
              slideTexts.push(t);
            }
            if (slideTexts.some(Boolean)) metadata.slideTexts = slideTexts;
          }

          if (config.postType === "single") {
            const textStyle = (row.text_style || "").trim();
            if (textStyle) metadata.textStyle = textStyle;
            if (row.overlay_text?.trim()) metadata.overlayText = row.overlay_text.trim();
            if (row.hero_lead_in?.trim()) metadata.heroLeadIn = row.hero_lead_in.trim();
            if (row.hero_word?.trim()) metadata.heroWord = row.hero_word.trim();
            if (row.hero_color?.trim()) metadata.heroWordColor = row.hero_color.trim();
            if (row.leadin_color?.trim()) metadata.heroLeadInColor = row.leadin_color.trim();
          }

          if (config.postType === "about-me") {
            if (row.title?.trim()) metadata.title = row.title.trim();
            if (row.subtitle?.trim()) metadata.subtitle = row.subtitle.trim();
            if (row.words?.trim()) metadata.words = row.words.trim().split("|").map((w) => w.trim()).filter(Boolean);
            if (row.accent_color?.trim()) metadata.accentColor = row.accent_color.trim();
            if (row.arrow_style?.trim()) metadata.arrowStyle = row.arrow_style.trim();
          }

          if (config.postType === "seamless-carousel") {
            if (row.slide_count?.trim()) metadata.slideCount = Number(row.slide_count.trim()) || null;
            if (row.layout_style?.trim()) metadata.layoutStyle = row.layout_style.trim();
            if (row.watermark?.trim()) metadata.watermark = row.watermark.trim();
            const textSlides: string[] = [];
            for (let s = 1; s <= 5; s++) {
              const t = (row[`text_slide_${s}`] || "").trim();
              textSlides.push(t);
            }
            if (textSlides.some(Boolean)) metadata.textSlides = textSlides;
          }

          if (config.postType === "reel" || config.postType === "trial-reel") {
            if (row.cover_text?.trim()) metadata.coverText = row.cover_text.trim();
            if (row.typewriter_text?.trim()) metadata.typewriterText = row.typewriter_text.trim();
            if (config.graduationStrategy) metadata.graduationStrategy = config.graduationStrategy;
          }

          if (row.scheduled_date?.trim()) {
            metadata.scheduledDate = row.scheduled_date.trim();
            if (row.scheduled_time?.trim()) metadata.scheduledTime = row.scheduled_time.trim();
          }

          const isMultiMedia = uploadedUrls.length > 1;

          await db.insert(contentLibraryTable).values({
            clientName,
            postType: config.postType,
            caption: (row.caption || "").trim(),
            mediaUrl: !isMultiMedia ? (uploadedUrls[0] ?? null) : null,
            mediaUrls: isMultiMedia ? uploadedUrls : null,
            thumbnailUrl,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
          });

          job.summary[typeKey]++;
        } catch (rowErr: unknown) {
          const msg = rowErr instanceof Error ? rowErr.message : "Unknown error";
          job.errors.push(`${csvName} row ${rowNum}: ${msg}`);
          logger.error({ err: rowErr, csvName, rowNum }, "Bulk import row failed");
        }

        processed++;
        job.progress.processed = processed;
      }
    }

    job.status = "done";
    job.progress.currentFile = "Complete";
    logger.info({ jobId, summary: job.summary, errors: job.errors.length }, "Bulk import complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bulk import failed";
    job.status = "error";
    job.errorMessage = msg;
    logger.error({ err, jobId }, "Bulk import job failed");
  }
}
