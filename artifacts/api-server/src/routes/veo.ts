import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createVeoJob, getVeoJob, processVeoJob, type VeoTier } from "../lib/veoWorker";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

router.use("/veo", requireAuth);

// Kicks off an AI video generation job with Veo 3.1. Fire-and-forget on the
// server side, the frontend polls /veo/jobs/:jobId/status for progress since
// generation can take anywhere from 11 seconds to several minutes.
router.post("/veo/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio = "9:16", tier = "lite", clientName } = req.body as {
      prompt?: string;
      aspectRatio?: "16:9" | "9:16";
      tier?: VeoTier;
      clientName?: string;
    };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }

    const jobId = `veo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    createVeoJob(jobId, prompt.trim(), clientName);

    setImmediate(async () => {
      try {
        await processVeoJob(jobId, prompt.trim(), aspectRatio, tier);
      } catch (err) {
        logger.error({ err, jobId }, "processVeoJob wrapper failed");
      }
    });

    res.status(202).json({ jobId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to start video generation" });
  }
});

router.get("/veo/jobs/:jobId/status", (req: Request, res: Response) => {
  const job = getVeoJob(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

export default router;
