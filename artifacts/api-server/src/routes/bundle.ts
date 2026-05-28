import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { trialBundlesTable, founderSignupsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { generateBundleContent } from "../lib/generateBundleContent";

const router: IRouter = Router();

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

export default router;
