import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { matchPagesToPresets } from "../lib/fuzzyMatch.js";

const router: IRouter = Router();

const GRAPH = "https://graph.facebook.com/v19.0";

export interface PageEntry {
  id: string;
  name: string;
  accessToken: string;
  instagramAccountId: string | null;
}

export interface PendingEntry {
  presetId?: number;
  mode?: "bulk" | "onboarding";
  presetToken?: string;
  pages: PageEntry[];
  expiresAt: number;
}

export const pendingPageSelections = new Map<string, PendingEntry>();

function getAppId(): string {
  const id = process.env["META_APP_ID"];
  if (!id) throw new Error("META_APP_ID environment variable is not set");
  return id;
}

function getAppSecret(): string {
  const secret = process.env["META_APP_SECRET"];
  if (!secret) throw new Error("META_APP_SECRET environment variable is not set");
  return secret;
}

function getBaseUrl(req: Request): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0].trim()}`;
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) return `https://${devDomain}`;
  return `${req.protocol}://${req.get("host")}`;
}

router.get("/meta/auth/start", (req: Request, res: Response) => {
  const presetId = Number(req.query["presetId"]);
  if (!presetId || isNaN(presetId)) {
    res.status(400).send("presetId required");
    return;
  }
  try {
    const appId = getAppId();
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/meta/auth/callback`;
    const state = Buffer.from(
      JSON.stringify({ presetId, nonce: randomBytes(8).toString("hex") })
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
    res.redirect(url);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Configuration error: ${msg}`);
  }
});

router.get("/meta/auth/bulk-start", (req: Request, res: Response) => {
  try {
    const appId = getAppId();
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/meta/auth/callback`;
    const state = Buffer.from(
      JSON.stringify({ mode: "bulk", nonce: randomBytes(8).toString("hex") })
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
    res.redirect(url);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Configuration error: ${msg}`);
  }
});

router.get("/meta/auth/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const stateRaw = req.query["state"] as string | undefined;
  const oauthError = req.query["error"] as string | undefined;
  const baseUrl = getBaseUrl(req);
  const front = `${baseUrl}/oauth/meta/result`;

  if (oauthError) {
    res.redirect(`${front}?error=${encodeURIComponent(oauthError)}`);
    return;
  }
  if (!code || !stateRaw) {
    res.redirect(`${front}?error=missing_code`);
    return;
  }

  let stateObj: { presetId?: unknown; mode?: string; nonce?: string; token?: string };
  try {
    stateObj = JSON.parse(Buffer.from(stateRaw, "base64url").toString()) as typeof stateObj;
  } catch {
    res.redirect(`${front}?error=invalid_state`);
    return;
  }

  const isBulk = stateObj.mode === "bulk";
  const isOnboarding = stateObj.mode === "onboarding";
  const onboardingPresetToken = stateObj.token;
  let presetId = 0;

  if (!isBulk && !isOnboarding) {
    presetId = Number(stateObj.presetId);
    if (!presetId || isNaN(presetId)) {
      res.redirect(`${front}?error=invalid_state`);
      return;
    }
  }

  if (isOnboarding && !onboardingPresetToken) {
    res.redirect(`${front}?error=invalid_state`);
    return;
  }

  const onboardFront = isOnboarding ? `${baseUrl}/onboard/${onboardingPresetToken}` : "";

  try {
    const appId = getAppId();
    const appSecret = getAppSecret();
    const redirectUri = `${baseUrl}/api/meta/auth/callback`;

    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}` +
        `&code=${code}`
    );
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? "Token exchange failed");
    }

    const longRes = await fetch(
      `${GRAPH}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = (await longRes.json()) as { access_token?: string };
    const longToken = longData.access_token ?? tokenData.access_token;

    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${longToken}&fields=id,name,access_token`
    );
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
      error?: { message: string };
    };
    if (!pagesRes.ok || !pagesData.data) {
      throw new Error(pagesData.error?.message ?? "Failed to fetch pages");
    }
    if (pagesData.data.length === 0) {
      if (isBulk) {
        res.redirect(`${baseUrl}/presets/bulk-connect/review?error=no_pages`);
      } else if (isOnboarding) {
        res.redirect(`${onboardFront}?error=no_pages`);
      } else {
        res.redirect(`${front}?error=no_pages&presetId=${presetId}`);
      }
      return;
    }

    const pages: PageEntry[] = await Promise.all(
      pagesData.data.map(async (page) => {
        const igRes = await fetch(
          `${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        const igData = (await igRes.json()) as { instagram_business_account?: { id: string } };
        return {
          id: page.id,
          name: page.name,
          accessToken: page.access_token,
          instagramAccountId: igData.instagram_business_account?.id ?? null,
        };
      })
    );

    if (isBulk) {
      const key = randomBytes(16).toString("hex");
      pendingPageSelections.set(key, { mode: "bulk", pages, expiresAt: Date.now() + 10 * 60 * 1000 });
      res.redirect(`${baseUrl}/presets/bulk-connect/review?key=${key}`);
      return;
    }

    if (isOnboarding) {
      const [preset] = await db
        .select({ id: clientPresetsTable.id })
        .from(clientPresetsTable)
        .where(eq(clientPresetsTable.clientPortalToken, onboardingPresetToken!));
      if (!preset) {
        res.redirect(`${onboardFront}?error=invalid_token`);
        return;
      }
      if (pages.length === 1) {
        const page = pages[0]!;
        await db
          .update(clientPresetsTable)
          .set({
            metaPageAccessToken: page.accessToken,
            metaFacebookPageId: page.id,
            metaInstagramAccountId: page.instagramAccountId,
            onboardingConnectedAt: new Date(),
          })
          .where(eq(clientPresetsTable.id, preset.id));
        res.redirect(`${onboardFront}/success`);
        return;
      }
      const key = randomBytes(16).toString("hex");
      pendingPageSelections.set(key, {
        mode: "onboarding",
        presetToken: onboardingPresetToken!,
        pages,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      res.redirect(`${onboardFront}/choose-page?key=${key}`);
      return;
    }

    if (pages.length === 1) {
      const page = pages[0]!;
      await db
        .update(clientPresetsTable)
        .set({
          metaPageAccessToken: page.accessToken,
          metaFacebookPageId: page.id,
          metaInstagramAccountId: page.instagramAccountId,
        })
        .where(eq(clientPresetsTable.id, presetId));
      res.redirect(
        `${front}?success=1&presetId=${presetId}` +
          `&pageName=${encodeURIComponent(page.name)}` +
          `&hasInstagram=${page.instagramAccountId ? "1" : "0"}`
      );
      return;
    }

    const key = randomBytes(16).toString("hex");
    pendingPageSelections.set(key, { presetId, pages, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.redirect(`${front}?select=1&key=${key}&presetId=${presetId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isBulk) {
      res.redirect(`${baseUrl}/presets/bulk-connect/review?error=${encodeURIComponent(msg)}`);
    } else if (isOnboarding && onboardingPresetToken) {
      res.redirect(`${onboardFront}?error=${encodeURIComponent(msg)}`);
    } else {
      res.redirect(`${front}?error=${encodeURIComponent(msg)}&presetId=${presetId}`);
    }
  }
});

router.get("/meta/auth/pages", (req: Request, res: Response) => {
  const key = req.query["key"] as string | undefined;
  if (!key) {
    res.status(400).json({ error: "key required" });
    return;
  }
  const entry = pendingPageSelections.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingPageSelections.delete(key);
    res.status(404).json({ error: "expired" });
    return;
  }
  res.json({
    presetId: entry.presetId,
    pages: entry.pages.map((p) => ({ id: p.id, name: p.name, hasInstagram: !!p.instagramAccountId })),
  });
});

router.post("/meta/auth/select-page", async (req: Request, res: Response) => {
  const { key, pageId } = req.body as { key?: string; pageId?: string };
  if (!key || !pageId) {
    res.status(400).json({ error: "key and pageId required" });
    return;
  }
  const entry = pendingPageSelections.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingPageSelections.delete(key);
    res.status(404).json({ error: "expired" });
    return;
  }
  const page = entry.pages.find((p) => p.id === pageId);
  if (!page) {
    res.status(400).json({ error: "page not found" });
    return;
  }
  await db
    .update(clientPresetsTable)
    .set({
      metaPageAccessToken: page.accessToken,
      metaFacebookPageId: page.id,
      metaInstagramAccountId: page.instagramAccountId,
    })
    .where(eq(clientPresetsTable.id, entry.presetId!));
  pendingPageSelections.delete(key);
  res.json({
    success: true,
    pageName: page.name,
    presetId: entry.presetId,
    hasInstagram: !!page.instagramAccountId,
  });
});

router.get("/meta/auth/bulk-pending", async (req: Request, res: Response) => {
  const key = req.query["key"] as string | undefined;
  if (!key) {
    res.status(400).json({ error: "key required" });
    return;
  }
  const entry = pendingPageSelections.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingPageSelections.delete(key);
    res.status(404).json({ error: "Session expired. Please reconnect via Facebook." });
    return;
  }
  if (entry.mode !== "bulk") {
    res.status(400).json({ error: "Not a bulk session" });
    return;
  }

  const allPresets = await db
    .select({ id: clientPresetsTable.id, name: clientPresetsTable.name, metaFacebookPageId: clientPresetsTable.metaFacebookPageId })
    .from(clientPresetsTable)
    .orderBy(clientPresetsTable.name);

  const presetsForMatch = allPresets.map((p) => ({ id: p.id, name: p.name }));
  const matched = matchPagesToPresets(entry.pages, presetsForMatch);

  const presetMap = new Map(allPresets.map((p) => [p.id, p]));

  const pages = matched.map((p) => ({
    id: p.id,
    name: p.name,
    hasInstagram: !!p.instagramAccountId,
    suggestedPresetId: p.suggestedPresetId,
    matchScore: p.matchScore,
    existingConnection: p.suggestedPresetId
      ? !!(presetMap.get(p.suggestedPresetId)?.metaFacebookPageId)
      : false,
  }));

  const presets = allPresets.map((p) => ({
    id: p.id,
    name: p.name,
    alreadyConnected: !!p.metaFacebookPageId,
  }));

  res.json({ pages, presets });
});

router.post("/meta/auth/bulk-save", async (req: Request, res: Response) => {
  const { key, assignments } = req.body as {
    key?: string;
    assignments?: Array<{ pageId: string; presetId: number }>;
  };

  if (!key || !assignments || !Array.isArray(assignments)) {
    res.status(400).json({ error: "key and assignments required" });
    return;
  }

  const entry = pendingPageSelections.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    pendingPageSelections.delete(key);
    res.status(404).json({ error: "Session expired. Please reconnect via Facebook." });
    return;
  }
  if (entry.mode !== "bulk") {
    res.status(400).json({ error: "Not a bulk session" });
    return;
  }

  const presetIds = assignments.map((a) => a.presetId);
  const uniquePresetIds = new Set(presetIds);
  if (uniquePresetIds.size !== presetIds.length) {
    res.status(400).json({ error: "Duplicate preset assignments detected. Each preset can only be linked to one page." });
    return;
  }

  let saved = 0;
  const failedDetails: string[] = [];

  for (const assignment of assignments) {
    const page = entry.pages.find((p) => p.id === assignment.pageId);
    if (!page) {
      failedDetails.push(`Page ${assignment.pageId} not found in session`);
      continue;
    }
    try {
      await db
        .update(clientPresetsTable)
        .set({
          metaPageAccessToken: page.accessToken,
          metaFacebookPageId: page.id,
          metaInstagramAccountId: page.instagramAccountId,
        })
        .where(eq(clientPresetsTable.id, assignment.presetId));
      saved++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failedDetails.push(`Preset ${assignment.presetId}: ${msg}`);
    }
  }

  pendingPageSelections.delete(key);
  res.json({ saved, failed: failedDetails.length, failedDetails });
});

export default router;
