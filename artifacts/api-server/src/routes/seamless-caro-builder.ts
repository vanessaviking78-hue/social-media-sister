import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { objectStorageClient } from "../lib/objectStorage";
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

router.use("/seamless-caro", requireAuth);

type BackgroundRow = {
  id: number;
  presetId: number;
  imageUrl: string;
  slideCount: number;
  anchorX: number;
  anchorY: number;
  anchorW: number;
  createdAt: string;
};

// List the preloaded backgrounds for a client.
router.get("/seamless-caro/backgrounds", async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.query.presetId);
    if (!presetId) { res.status(400).json({ error: "presetId is required" }); return; }
    const result = await db.execute(sql`
      SELECT id, preset_id AS "presetId", image_url AS "imageUrl", slide_count AS "slideCount",
             anchor_x AS "anchorX", anchor_y AS "anchorY", anchor_w AS "anchorW", created_at AS "createdAt"
      FROM client_backgrounds WHERE preset_id = ${presetId} ORDER BY created_at DESC
    `);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: BackgroundRow[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load backgrounds" });
  }
});

// Register a newly-uploaded background image against a client. The actual
// upload happens through the existing /api/content/upload-image endpoint -
// this just records the URL plus a starting registration point.
router.post("/seamless-caro/backgrounds", async (req: Request, res: Response) => {
  try {
    const { presetId, imageUrl, slideCount } = req.body as { presetId?: number; imageUrl?: string; slideCount?: number };
    if (!presetId || !imageUrl) { res.status(400).json({ error: "presetId and imageUrl are required" }); return; }
    const n = Math.max(2, Math.min(5, Number(slideCount) || 3));
    const result = await db.execute(sql`
      INSERT INTO client_backgrounds (preset_id, image_url, slide_count)
      VALUES (${presetId}, ${imageUrl}, ${n})
      RETURNING id
    `);
    const id = (result as { rows?: { id?: number }[] }).rows?.[0]?.id ?? null;
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save background" });
  }
});

// Update the registration point (dragged position) for a background.
router.patch("/seamless-caro/backgrounds/:id", async (req: Request, res: Response) => {
  try {
    const { anchorX, anchorY, anchorW } = req.body as { anchorX?: number; anchorY?: number; anchorW?: number };
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    await db.execute(sql`
      UPDATE client_backgrounds SET
        anchor_x = ${clamp(Number(anchorX))},
        anchor_y = ${clamp(Number(anchorY))},
        anchor_w = ${clamp(Number(anchorW))}
      WHERE id = ${Number(req.params.id)}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update background" });
  }
});

router.delete("/seamless-caro/backgrounds/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM client_backgrounds WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete background" });
  }
});

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// Strips the background off a photo using Photoroom's Remove Background API.
// Needs PHOTOROOM_API_KEY set in Railway > Variables.
async function removeBackground(photoBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) throw new Error("PHOTOROOM_API_KEY not set. Add it in Railway > Variables.");
  const form = new FormData();
  form.append("image_file", new Blob([photoBuffer]), "photo.jpg");
  const r = await fetch("https://sdk.photoroom.com/v1/segment", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Background removal failed (${r.status}): ${text.slice(0, 200)}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

// Composites the cut-out person onto the background, repeated identically in
// every panel (registered by anchorX/anchorY/anchorW, all fractions of one
// panel), so once this wide image is sliced into N slides elsewhere, the
// person lines up the same way on each one.
router.post("/seamless-caro/composite", async (req: Request, res: Response) => {
  try {
    const { backgroundId, photoUrl } = req.body as { backgroundId?: number; photoUrl?: string };
    if (!backgroundId || !photoUrl) { res.status(400).json({ error: "backgroundId and photoUrl are required" }); return; }

    const bgResult = await db.execute(sql`
      SELECT id, preset_id AS "presetId", image_url AS "imageUrl", slide_count AS "slideCount",
             anchor_x AS "anchorX", anchor_y AS "anchorY", anchor_w AS "anchorW"
      FROM client_backgrounds WHERE id = ${backgroundId}
    `);
    const bg = (bgResult as { rows?: BackgroundRow[] }).rows?.[0];
    if (!bg) { res.status(404).json({ error: "Background not found" }); return; }

    const [backgroundBuffer, photoBuffer] = await Promise.all([fetchBuffer(bg.imageUrl), fetchBuffer(photoUrl)]);
    const cutoutBuffer = await removeBackground(photoBuffer);

    const bgMeta = await sharp(backgroundBuffer).metadata();
    const totalW = bgMeta.width || 0;
    const totalH = bgMeta.height || 0;
    const n = Math.max(2, Math.min(5, bg.slideCount || 3));
    const panelW = totalW / n;

    const cutoutMeta = await sharp(cutoutBuffer).metadata();
    const cw = cutoutMeta.width || 1;
    const ch = cutoutMeta.height || 1;
    let targetW = Math.round(panelW * bg.anchorW);
    let targetH = Math.round(targetW * (ch / cw));
    if (targetH > totalH) { targetH = totalH; targetW = Math.round(targetH * (cw / ch)); }
    if (targetW > totalW) { targetW = totalW; targetH = Math.round(targetW * (ch / cw)); }
    targetW = Math.max(1, targetW);
    targetH = Math.max(1, targetH);
    const resizedCutout = await sharp(cutoutBuffer).resize(targetW, targetH).toBuffer();

    const composites = Array.from({ length: n }, (_, i) => {
      const panelLeft = i * panelW;
      const centerX = panelLeft + bg.anchorX * panelW;
      const bottomY = bg.anchorY * totalH;
      const left = Math.round(centerX - targetW / 2);
      const top = Math.round(bottomY - targetH);
      return { input: resizedCutout, left, top };
    });

    const outBuffer = await sharp(backgroundBuffer).composite(composites).png().toBuffer();

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    // Saved under carousel-images/ (not a seamless-caro/ prefix) so it is served
    // back by the existing GET /content/images/carousel-images/:filename route.
    // There is no separate serving route for other prefixes.
    const objectPath = `carousel-images/${Date.now()}-seamless-caro-composite.png`;
    const bucket = objectStorageClient.bucket(bucketId);
    await bucket.file(objectPath).save(outBuffer, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const imageUrl = `${proto}://${host}/api/content/images/${objectPath}`;

    res.json({ imageUrl, width: totalW, height: totalH, slideCount: n });
  } catch (err: any) {
    logger.error({ err }, "Seamless Caro composite failed");
    res.status(500).json({ error: err.message || "Composite failed" });
  }
});

type PhotoPlacement = { photoUrl: string; anchorX: number; anchorY: number; anchorW: number };

// Composites a DIFFERENT photo into each panel guideline instead of repeating
// one photo identically across every panel. Powers the "up to twenty photos,
// three to five per piece, drag each onto its own guideline" bulk flow —
// each entry in `photos` carries its own dragged position and size, already
// expressed as the same anchorX/anchorY/anchorW fractions the single-photo
// /composite route uses, just one set per panel instead of one shared set.
router.post("/seamless-caro/composite-multi", async (req: Request, res: Response) => {
  try {
    const { backgroundId, photos } = req.body as { backgroundId?: number; photos?: PhotoPlacement[] };
    if (!backgroundId || !photos || !photos.length) { res.status(400).json({ error: "backgroundId and at least one photo are required" }); return; }

    const bgResult = await db.execute(sql`
      SELECT id, preset_id AS "presetId", image_url AS "imageUrl", slide_count AS "slideCount"
      FROM client_backgrounds WHERE id = ${backgroundId}
    `);
    const bg = (bgResult as { rows?: { imageUrl: string }[] }).rows?.[0];
    if (!bg) { res.status(404).json({ error: "Background not found" }); return; }

    const n = Math.max(2, Math.min(5, photos.length));
    const backgroundBuffer = await fetchBuffer(bg.imageUrl);
    const bgMeta = await sharp(backgroundBuffer).metadata();
    const totalW = bgMeta.width || 0;
    const totalH = bgMeta.height || 0;
    const panelW = totalW / n;

    const composites = await Promise.all(photos.slice(0, n).map(async (p, i) => {
      const photoBuffer = await fetchBuffer(p.photoUrl);
      const cutoutBuffer = await removeBackground(photoBuffer);
      const cutoutMeta = await sharp(cutoutBuffer).metadata();
      const cw = cutoutMeta.width || 1;
      const ch = cutoutMeta.height || 1;
      const anchorW = Math.max(0.05, Math.min(1, Number(p.anchorW) || 0.34));
      const anchorX = Math.max(0, Math.min(1, Number(p.anchorX ?? 0.5)));
      const anchorY = Math.max(0, Math.min(1, Number(p.anchorY ?? 0.94)));
      let targetW = Math.round(panelW * anchorW);
      let targetH = Math.round(targetW * (ch / cw));
      if (targetH > totalH) { targetH = totalH; targetW = Math.round(targetH * (cw / ch)); }
      if (targetW > totalW) { targetW = totalW; targetH = Math.round(targetW * (ch / cw)); }
      targetW = Math.max(1, targetW);
      targetH = Math.max(1, targetH);
      const resizedCutout = await sharp(cutoutBuffer).resize(targetW, targetH).toBuffer();
      const panelLeft = i * panelW;
      const centerX = panelLeft + anchorX * panelW;
      const bottomY = anchorY * totalH;
      const left = Math.round(centerX - targetW / 2);
      const top = Math.round(bottomY - targetH);
      return { input: resizedCutout, left, top };
    }));

    const outBuffer = await sharp(backgroundBuffer).composite(composites).png().toBuffer();

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    const objectPath = `carousel-images/${Date.now()}-seamless-caro-composite.png`;
    const bucket = objectStorageClient.bucket(bucketId);
    await bucket.file(objectPath).save(outBuffer, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const imageUrl = `${proto}://${host}/api/content/images/${objectPath}`;

    res.json({ imageUrl, width: totalW, height: totalH, slideCount: n });
  } catch (err: any) {
    logger.error({ err }, "Seamless Caro multi-composite failed");
    res.status(500).json({ error: err.message || "Composite failed" });
  }
});

export default router;
