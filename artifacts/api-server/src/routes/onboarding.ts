import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { pendingPageSelections } from "./meta-auth.js";

const router: IRouter = Router();

function getBaseUrl(req: Request): string {
  const explicit = process.env["PUBLIC_BASE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

router.post("/presets/:id/generate-onboarding-token", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const token = crypto.randomBytes(24).toString("hex");
    const [updated] = await db
      .update(clientPresetsTable)
      .set({ clientPortalToken: token, onboardingConnectedAt: null, updatedAt: new Date() })
      .where(eq(clientPresetsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Preset not found" }); return; }
    const baseUrl = getBaseUrl(req);
    res.json({ token, link: `${baseUrl}/onboard/${token}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/onboarding/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params as { token: string };
    const [preset] = await db
      .select({
        name: clientPresetsTable.name,
        onboardingConnectedAt: clientPresetsTable.onboardingConnectedAt,
        metaFacebookPageId: clientPresetsTable.metaFacebookPageId,
      })
      .from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    res.json({
      clinicName: preset.name,
      alreadyConnected: !!preset.onboardingConnectedAt,
      connectedPageId: preset.metaFacebookPageId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/onboarding/:token/start", async (req: Request, res: Response) => {
  try {
    const { token } = req.params as { token: string };
    const appId = process.env["META_APP_ID"];
    if (!appId) { res.status(500).json({ error: "META_APP_ID not configured" }); return; }
    const [preset] = await db
      .select({ id: clientPresetsTable.id })
      .from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "not_found" }); return; }
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/meta/auth/callback`;
    const state = Buffer.from(
      JSON.stringify({ mode: "onboarding", token, nonce: crypto.randomBytes(8).toString("hex") })
    ).toString("base64url");
    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
      "pages_show_list",
    ].join(",");
    const url =
      `https://www.facebook.com/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scopes}` +
      `&state=${state}` +
      `&response_type=code`;
    res.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.post("/onboarding/:token/save-page", async (req: Request, res: Response) => {
  const { token } = req.params as { token: string };
  const { key, pageId } = req.body as { key?: string; pageId?: string };
  if (!key || !pageId) {
    res.status(400).json({ error: "key and pageId required" });
    return;
  }

  const entry = pendingPageSelections.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingPageSelections.delete(key);
    res.status(404).json({ error: "Session expired. Please reconnect via Facebook." });
    return;
  }
  if (entry.mode !== "onboarding" || entry.presetToken !== token) {
    res.status(403).json({ error: "Token mismatch" });
    return;
  }
  const page = entry.pages.find((p) => p.id === pageId);
  if (!page) {
    res.status(400).json({ error: "Page not found in session" });
    return;
  }
  try {
    const [preset] = await db
      .select({ id: clientPresetsTable.id })
      .from(clientPresetsTable)
      .where(eq(clientPresetsTable.clientPortalToken, token));
    if (!preset) { res.status(404).json({ error: "Preset not found" }); return; }
    await db
      .update(clientPresetsTable)
      .set({
        metaPageAccessToken: page.accessToken,
        metaFacebookPageId: page.id,
        metaInstagramAccountId: page.instagramAccountId,
        onboardingConnectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clientPresetsTable.id, preset.id));
    pendingPageSelections.delete(key);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
