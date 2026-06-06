import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { trialBundlesTable, founderSignupsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { generateBundleContent } from "../lib/generateBundleContent";
import { pickAndMixBundle, regenerateBundlePiece } from "../lib/pickAndMixBundle";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) { next(); return; }
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided !== appPassword.trim().toLowerCase()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const router: IRouter = Router();

router.post("/bundle/pick-and-mix", requireAuth, async (req, res) => {
  try {
    const { clinicName, igHandle, treatmentFocus, brandColour, voiceStyle, presetId } = req.body;
    if (!clinicName || !treatmentFocus) {
      res.status(400).json({ error: "clinicName and treatmentFocus are required" });
      return;
    }
    const result = await pickAndMixBundle({
      clinicName, igHandle, treatmentFocus, brandColour, voiceStyle,
      presetId: presetId ? Number(presetId) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    req.log?.error({ err }, "Pick and Mix bundle error");
    if (!res.headersSent) res.status(500).json({ error: err.message || "Pick and Mix failed" });
  }
});

router.post("/bundle/:token/regenerate-piece", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenStr = Array.isArray(token) ? token[0] : token;
    const { piece, voiceStyle, presetId } = req.body;
    const VALID_PIECES = ["carousel", "aboutMe", "reel", "seamless"] as const;
    if (!(VALID_PIECES as readonly string[]).includes(piece as string)) {
      res.status(400).json({ error: "piece must be one of: carousel, aboutMe, reel, seamless" });
      return;
    }
    const result = await regenerateBundlePiece(
      tokenStr, piece, voiceStyle, presetId ? Number(presetId) : undefined,
    );
    res.json(result);
  } catch (err: any) {
    req.log?.error({ err }, "Bundle piece regeneration error");
    if (!res.headersSent) res.status(500).json({ error: err.message || "Regeneration failed" });
  }
});

router.post("/bundle/generate", async (req, res) => {
  try {
    const { clinicName, igHandle, treatmentFocus, brandColour, voiceStyle, topics } = req.body;

    if (!clinicName || !treatmentFocus) {
      res.status(400).json({ error: "clinicName and treatmentFocus are required" });
      return;
    }

    const result = await generateBundleContent({
      clinicName,
      igHandle,
      treatmentFocus,
      brandColour,
      voiceStyle,
      topics,
    });

    res.json(result);
  } catch (err: any) {
    req.log?.error({ err }, "Bundle generation error");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Bundle generation failed" });
    }
  }
});

const FOUNDER_TOTAL = 20;

router.get("/bundle/founder-spots", async (req, res) => {
  try {
    const [{ value: claimed }] = await db
      .select({ value: count() })
      .from(founderSignupsTable);
    const remaining = Math.max(0, FOUNDER_TOTAL - Number(claimed));
    res.json({ remaining, claimed: Number(claimed), total: FOUNDER_TOTAL });
  } catch (err: any) {
    req.log?.error({ err }, "Founder spots fetch error");
    res.status(500).json({ error: "Failed to fetch founder spots" });
  }
});

router.post("/bundle/founder-signup", async (req, res) => {
  try {
    const { name, email, clinicName, phone, bundleToken } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "name and email are required" });
      return;
    }
    const [{ value: claimed }] = await db
      .select({ value: count() })
      .from(founderSignupsTable);
    if (Number(claimed) >= FOUNDER_TOTAL) {
      res.status(409).json({ error: "All founder spots have been claimed" });
      return;
    }
    const [signup] = await db
      .insert(founderSignupsTable)
      .values({
        name: name.trim(),
        email: email.trim(),
        clinicName: clinicName?.trim() ?? "",
        phone: phone?.trim() ?? "",
        bundleToken: bundleToken || null,
      })
      .returning();
    res.json({ id: signup.id, remaining: Math.max(0, FOUNDER_TOTAL - Number(claimed) - 1) });
  } catch (err: any) {
    req.log?.error({ err }, "Founder signup error");
    res.status(500).json({ error: err.message || "Signup failed" });
  }
});

router.get("/bundle/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [bundle] = await db
      .select()
      .from(trialBundlesTable)
      .where(eq(trialBundlesTable.token, token))
      .limit(1);

    if (!bundle) {
      res.status(404).json({ error: "Bundle not found" });
      return;
    }

    res.json(bundle);
  } catch (err: any) {
    req.log?.error({ err }, "Bundle fetch error");
    res.status(500).json({ error: err.message || "Failed to fetch bundle" });
  }
});

router.patch("/bundle/:token/images", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const { renderedImageUrls } = req.body;
    if (!renderedImageUrls || typeof renderedImageUrls !== "object") {
      res.status(400).json({ error: "renderedImageUrls is required" });
      return;
    }
    const tokenStr = Array.isArray(token) ? token[0] : token;
    const [bundle] = await db
      .select({ id: trialBundlesTable.id })
      .from(trialBundlesTable)
      .where(eq(trialBundlesTable.token, tokenStr))
      .limit(1);
    if (!bundle) {
      res.status(404).json({ error: "Bundle not found" });
      return;
    }
    await db
      .update(trialBundlesTable)
      .set({ renderedImageUrls })
      .where(eq(trialBundlesTable.token, tokenStr));
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error({ err }, "Bundle image save error");
    res.status(500).json({ error: err.message || "Failed to save images" });
  }
});

export default router;
