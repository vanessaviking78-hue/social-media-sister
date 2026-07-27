import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { googleTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const pendingState = new Map<string, number>();

function getClientId(): string {
  const id = process.env["GOOGLE_CLIENT_ID"];
  if (!id) throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET environment variable is not set");
  return secret;
}

function getBaseUrl(req: Request): string {
  const explicit = process.env["PUBLIC_BASE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

export async function getStoredGoogleToken() {
  const [token] = await db.select().from(googleTokensTable).limit(1);
  return token ?? null;
}

export async function refreshGoogleTokenIfNeeded(token: typeof googleTokensTable.$inferSelect) {
  if (!token.expiresAt || token.expiresAt > new Date()) return token;
  if (!token.refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
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
    expires_in?: number;
  };

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000 - 60000)
    : null;

  const [updated] = await db
    .update(googleTokensTable)
    .set({
      accessToken: data.access_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(googleTokensTable.id, token.id))
    .returning();

  return updated ?? null;
}

router.get("/google/auth/start", (req: Request, res: Response) => {
  try {
    const clientId = getClientId();
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/google/auth/callback`;

    const state = randomBytes(16).toString("hex");
    pendingState.set(state, Date.now() + 10 * 60 * 1000);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Configuration error: ${msg}`);
  }
});

router.get("/google/auth/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const state = req.query["state"] as string | undefined;
  const oauthError = req.query["error"] as string | undefined;
  const baseUrl = getBaseUrl(req);
  const front = `${baseUrl}/oauth/google/result`;

  if (oauthError) {
    res.redirect(`${front}?error=${encodeURIComponent(oauthError)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${front}?error=missing_params`);
    return;
  }

  const expiresAt = pendingState.get(state);
  if (!expiresAt || expiresAt < Date.now()) {
    pendingState.delete(state);
    res.redirect(`${front}?error=expired_state`);
    return;
  }
  pendingState.delete(state);

  try {
    const redirectUri = `${baseUrl}/api/google/auth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
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
      req.log.error({ tokenData }, "google token exchange failed");
      res.redirect(`${front}?error=${encodeURIComponent(msg)}`);
      return;
    }

    let googleEmail: string | null = null;
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData = (await userRes.json()) as { email?: string };
        googleEmail = userData.email ?? null;
      }
    } catch {
      /* non-fatal */
    }

    const expiresAtDate = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000 - 60000)
      : null;

    if (!tokenData.refresh_token) {
      // Google only sends a refresh_token the very first time a user consents (or after
      // revoking access). If we somehow got here without one and don't already have one
      // stored, the connection would silently stop working once the access token expires.
      const existing = await getStoredGoogleToken();
      if (!existing?.refreshToken) {
        res.redirect(`${front}?error=${encodeURIComponent("No refresh token received. Please revoke access at myaccount.google.com/permissions and try connecting again.")}`);
        return;
      }
    }

    await db.delete(googleTokensTable);
    await db.insert(googleTokensTable).values({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: expiresAtDate,
      googleEmail,
      calendarId: "primary",
      updatedAt: new Date(),
    });

    req.log.info({ googleEmail }, "google calendar connected successfully");
    res.redirect(`${front}?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, msg }, "google/auth/callback unhandled error");
    res.redirect(`${front}?error=${encodeURIComponent(msg)}`);
  }
});

router.get("/google/status", async (_req: Request, res: Response) => {
  try {
    const token = await getStoredGoogleToken();
    if (!token) {
      res.json({ connected: false });
      return;
    }
    res.json({ connected: true, googleEmail: token.googleEmail });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/google/disconnect", async (_req: Request, res: Response) => {
  try {
    await db.delete(googleTokensTable);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
