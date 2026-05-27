import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import JSZip from "jszip";
import { createBulkJob, getBulkJob, processBulkJob } from "../lib/bulkImportWorker";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const TEMPLATE_SCHEMAS: Record<string, { columns: string[]; example1: string[]; example2: string[] }> = {
  "carousels.csv": {
    columns: ["caption", "music_track", "text_style", "slide_1_lead_in", "slide_1_hero_word", "slide_1_text", "slide_1_image", "slide_2_text", "slide_2_image", "slide_3_text", "slide_3_image", "slide_4_text", "slide_4_image", "slide_5_text", "slide_5_image", "scheduled_date", "scheduled_time"],
    example1: ["Did you know 80% of premature ageing is UV damage? Here's what we do about it.", "Upbeat Summer", "", "", "", "Did you know 80% of premature ageing is UV damage?", "slide1.jpg", "Our SPF50 serum creates a protective barrier every single day.", "slide2.jpg", "3 sessions is all it takes to see visible change.", "slide3.jpg", "Book your free consultation today.", "slide4.jpg", "", "", "2026-06-01", "18:00"],
    example2: ["Skin that does the talking. Results from a real client after 6 weeks of treatment.", "Calm Piano", "hero", "SKIN THAT", "SPEAKS", "Real results from a real client. 6 weeks. Zero filters.", "slide1.jpg", "Week 1: redness and texture visible.", "slide2.jpg", "Week 6: smooth, even, confident.", "slide3.jpg", "Your skin can do this too.", "slide4.jpg", "", "", "2026-06-02", "18:00"],
  },
  "singles.csv": {
    columns: ["caption", "music_track", "image_filename", "text_style", "overlay_text", "hero_lead_in", "hero_word", "hero_color", "leadin_color", "scheduled_date", "scheduled_time"],
    example1: ["Monday motivation from the treatment room. This is what confidence looks like.", "", "monday.jpg", "", "", "", "", "", "", "2026-06-03", "09:00"],
    example2: ["The one question I get asked every single week. Here is the honest answer.", "Soft R&B", "question.jpg", "hero", "", "THE HONEST", "ANSWER", "#E91976", "#ffffff", "2026-06-04", "12:00"],
  },
  "about_mes.csv": {
    columns: ["caption", "music_track", "title", "subtitle", "subject_image", "background_image", "words", "accent_color", "arrow_style", "scheduled_date", "scheduled_time"],
    example1: ["Meet the woman behind the clinic. This is me, in the words that matter.", "Acoustic Summer", "MEET SARAH", "Aesthetic Nurse", "sarah.jpg", "background.jpg", "Honest|Caring|Clinical|Qualified|Human", "#E91976", "arrow-right", "", ""],
    example2: ["Not a filter in sight. Just real results and real people.", "Lo-Fi Chill", "REAL RESULTS", "Clinic Director", "director.jpg", "clinic-bg.jpg", "Evidence-based|Ethical|Safe|Expert|Warm", "#ff6b35", "arrow-down", "", ""],
  },
  "seamless.csv": {
    columns: ["caption", "music_track", "slide_count", "layout_style", "images", "text_slide_1", "text_slide_2", "text_slide_3", "text_slide_4", "text_slide_5", "watermark", "scheduled_date", "scheduled_time"],
    example1: ["Three things about our clinic you won't find on our website.", "", "3", "landscape", "panel1.jpg|panel2.jpg|panel3.jpg", "We turn away clients we can't safely treat.", "We have no interest in making you look different.", "We have every interest in making you feel like yourself.", "", "", "yes", "2026-06-05", "18:00"],
    example2: ["The before is not the problem. The before is where you are right now.", "", "4", "portrait", "img1.jpg|img2.jpg|img3.jpg|img4.jpg", "Before.", "After.", "The difference is not a filter.", "It's skill, science, and a really good plan.", "", "yes", "2026-06-06", "18:00"],
  },
  "reels.csv": {
    columns: ["caption", "music_track", "video_filename", "cover_image", "cover_text", "typewriter_text", "scheduled_date", "scheduled_time"],
    example1: ["A day in the clinic. This is what we actually do all day.", "Upbeat Pop", "clinic-day.mp4", "cover1.jpg", "A DAY IN THE CLINIC", "Real. Honest. Clinical.", "2026-06-07", "17:00"],
    example2: ["Results that took 3 sessions and 6 weeks. Zero filters, zero drama.", "Chill Beats", "results.mp4", "cover2.jpg", "REAL RESULTS", "3 sessions. 6 weeks. You.", "2026-06-08", "17:00"],
  },
  "trial_reels.csv": {
    columns: ["caption", "music_track", "video_filename", "cover_image", "cover_text", "typewriter_text", "scheduled_date", "scheduled_time"],
    example1: ["[TRIAL] Content for internal review before approval.", "Upbeat Pop", "trial-reel-1.mp4", "trial-cover1.jpg", "TRIAL CONTENT", "For review only.", "", ""],
    example2: ["[TRIAL] Second concept for the June campaign — awaiting sign-off.", "Chill Beats", "trial-reel-2.mp4", "trial-cover2.jpg", "TRIAL CONCEPT 2", "Pending approval.", "", ""],
  },
};

function csvRow(fields: string[]): string {
  return fields.map((f) => {
    if (f.includes(",") || f.includes('"') || f.includes("\n")) {
      return `"${f.replace(/"/g, '""')}"`;
    }
    return f;
  }).join(",");
}

function buildTemplateCsv(schema: typeof TEMPLATE_SCHEMAS[string]): string {
  const lines = [
    csvRow(schema.columns),
    csvRow(schema.example1),
    csvRow(schema.example2),
  ];
  return lines.join("\n") + "\n";
}

router.get("/library/bulk-import-templates.zip", async (_req: Request, res: Response) => {
  try {
    const zip = new JSZip();
    const mediaFolder = zip.folder("media")!;

    for (const [filename, schema] of Object.entries(TEMPLATE_SCHEMAS)) {
      zip.file(filename, buildTemplateCsv(schema));
    }

    mediaFolder.file("README.txt", [
      "Replace these placeholder files with your actual media.",
      "",
      "File naming:",
      "  - Match filenames exactly as written in your CSV columns",
      "  - Matching is case-insensitive",
      "  - Files can be in subdirectories (the system matches by basename)",
      "",
      "Supported formats:",
      "  Images: jpg, jpeg, png, webp, gif, avif",
      "  Video:  mp4, mov, m4v",
      "",
      "Expected volume per client per month:",
      "  12 carousels, 4 about mes, 4 seamless carousels,",
      "  5 single images, 5 reels, 10 trial reels = 40 entries",
    ].join("\n"));

    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=\"cybersuite-bulk-import-templates.zip\"");
    res.send(buf);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Template generation failed";
    res.status(500).json({ error: msg });
  }
});

router.post(
  "/library/bulk-import-zip",
  upload.single("zip"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      const { clientName } = req.body as { clientName?: string };

      if (!file) { res.status(400).json({ error: "zip file required" }); return; }
      if (!clientName?.trim()) { res.status(400).json({ error: "clientName required" }); return; }

      const jobId = `bulk_${Date.now()}_${uuid().slice(0, 8)}`;
      createBulkJob(jobId);

      const zipBuffer = Buffer.from(file.buffer);
      const cn = clientName.trim();

      setImmediate(async () => {
        await processBulkJob(jobId, zipBuffer, cn);
      });

      res.status(202).json({ jobId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start import";
      req.log.error({ err }, "bulk-import-zip start failed");
      res.status(500).json({ error: msg });
    }
  },
);

router.get("/library/bulk-import-zip/jobs/:jobId", (req: Request, res: Response) => {
  const job = getBulkJob(String(req.params.jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

export default router;
