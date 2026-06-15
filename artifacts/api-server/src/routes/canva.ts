import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { canvaTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const pendingPkce = new Map<string, { codeVerifier: string; expiresAt: number }>();

function getClientId(): string {
  const id = process.env["CANVA_CLIENT_ID"];
  if (!id) throw new Error("CANVA_CLIENT_ID environment variable is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env["CANVA_CLIENT_SECRET"];
  if (!secret) throw new Error("CANVA_CLIENT_SECRET environment variable is not set");
  return secret;
}

function getBaseUrl(req: Request): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]!.trim()}`;
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) return `https://${devDomain}`;
  return `${req.protocol}://${req.get("host")}`;
}

async function getStoredToken() {
  const [token] = await db.select().from(canvaTokensTable).limit(1);
  return token ?? null;
}

async function refreshTokenIfNeeded(token: typeof canvaTokensTable.$inferSelect) {
  if (!token.expiresAt || token.expiresAt > new Date()) return token;
  if (!token.refreshToken) return null;

  const res = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000 - 60000)
    : null;

  const [updated] = await db
    .update(canvaTokensTable)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(canvaTokensTable.id, token.id))
    .returning();

  return updated ?? null;
}

router.get("/canva/auth/start", (req: Request, res: Response) => {
  try {
    const clientId = getClientId();
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/canva/callback`;

    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const state = randomBytes(16).toString("hex");

    pendingPkce.set(state, { codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "asset:read asset:write",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    res.redirect(`https://www.canva.com/api/oauth/authorize?${params.toString()}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Configuration error: ${msg}`);
  }
});

router.get("/canva/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const state = req.query["state"] as string | undefined;
  const oauthError = req.query["error"] as string | undefined;
  const baseUrl = getBaseUrl(req);
  const front = `${baseUrl}/oauth/canva/result`;

  if (oauthError) {
    res.redirect(`${front}?error=${encodeURIComponent(oauthError)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${front}?error=missing_params`);
    return;
  }

  const pkce = pendingPkce.get(state);
  if (!pkce || pkce.expiresAt < Date.now()) {
    pendingPkce.delete(state);
    res.redirect(`${front}?error=expired_state`);
    return;
  }
  pendingPkce.delete(state);

  try {
    const redirectUri = `${baseUrl}/api/canva/callback`;

    const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: pkce.codeVerifier,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? "Token exchange failed";
      req.log.error({ tokenData }, "canva token exchange failed");
      res.redirect(`${front}?error=${encodeURIComponent(msg)}`);
      return;
    }

    let canvaUserId: string | null = null;
    try {
      const userRes = await fetch("https://api.canva.com/rest/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData = (await userRes.json()) as { profile?: { display_name?: string } };
        canvaUserId = userData.profile?.display_name ?? null;
      }
    } catch {
      /* non-fatal */
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000 - 60000)
      : null;

    await db.delete(canvaTokensTable);
    await db.insert(canvaTokensTable).values({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt,
      canvaUserId,
      updatedAt: new Date(),
    });

    req.log.info({ canvaUserId }, "canva connected successfully");
    res.redirect(`${front}?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, msg }, "canva/callback unhandled error");
    res.redirect(`${front}?error=${encodeURIComponent(msg)}`);
  }
});

router.get("/canva/status", async (_req: Request, res: Response) => {
  try {
    const token = await getStoredToken();
    if (!token) {
      res.json({ connected: false });
      return;
    }
    res.json({ connected: true, canvaUserId: token.canvaUserId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/canva/disconnect", async (_req: Request, res: Response) => {
  try {
    await db.delete(canvaTokensTable);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/canva/upload", async (req: Request, res: Response) => {
  try {
    const { imageUrl, imageBase64, name } = req.body as {
      imageUrl?: string;
      imageBase64?: string;
      name?: string;
    };

    let token = await getStoredToken();
    if (!token) {
      res.status(401).json({ error: "Canva is not connected. Go to Settings to connect." });
      return;
    }
    token = (await refreshTokenIfNeeded(token)) ?? token;

    let imageBuffer: Buffer;
    let mimeType = "image/jpeg";

    if (imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error("Failed to fetch image from URL");
      const ct = r.headers.get("content-type") ?? "image/jpeg";
      mimeType = ct.split(";")[0]!.trim();
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else if (imageBase64) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1]!;
        imageBuffer = Buffer.from(match[2]!, "base64");
      } else {
        imageBuffer = Buffer.from(imageBase64, "base64");
      }
    } else {
      res.status(400).json({ error: "Provide imageUrl or imageBase64" });
      return;
    }

    const assetName = name ?? "Social Media Sister Export";
    const metadata = JSON.stringify({ name_base64: Buffer.from(assetName).toString("base64") });

    const canvaRes = await fetch("https://api.canva.com/rest/v1/assets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Asset-Upload-Metadata": metadata,
        "Content-Type": mimeType,
      },
      body: imageBuffer,
    });

    const canvaData = (await canvaRes.json()) as {
      asset?: { id: string };
      code?: string;
      message?: string;
    };

    if (!canvaRes.ok) {
      throw new Error(canvaData.message ?? canvaData.code ?? "Canva upload failed");
    }

    req.log.info({ assetId: canvaData.asset?.id, assetName }, "canva asset uploaded");
    res.json({ success: true, assetId: canvaData.asset?.id });
  } catch (err: any) {
    req.log.error({ err }, "canva/upload error");
    res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

export default router;
