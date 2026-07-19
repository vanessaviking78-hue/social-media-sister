import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Same auth pattern as seamless-caro-builder.ts and the other admin-only tools.
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

router.use("/background-builder", requireAuth);

const GEMINI_MODEL = "gemini-2.5-flash-image";

// The final canvas Seamless Carousels expects a background strip to be:
// 4320x1440, a 3:1 ratio, cut into 4 equal 1080x1440 panels. Gemini's widest
// native aspect ratio is 21:9 (roughly 2.33:1), so we generate there and let
// sharp crop-to-fill the rest. For an abstract colour/pattern background a
// touch of cropping on generation makes no visible difference, and it means
// every image handed off to Seamless Carousels is guaranteed to be exactly
// the right size without Vanessa ever having to think about it.
const TARGET_WIDTH = 4320;
const TARGET_HEIGHT = 1440;

router.post("/background-builder/generate", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || !prompt.trim()) { res.status(400).json({ error: "A prompt is required" }); return; }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "Image generation is not configured (GEMINI_API_KEY missing)" }); return; }

    const fullPrompt = `Create a seamless, edge-to-edge background image for social media carousel slides, based on this brief: "${prompt.trim()}".

Strict rules: absolutely no people, no faces, no hands, no bodies. No text, no words, no letters, no numbers, no logos, no watermarks. The design should read as one continuous wide strip, not four separate panels, since it will later be cut into equal vertical slices. Wide panoramic landscape composition, colours and elements should flow naturally across the full width with no obvious seams or repeats.`;

    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: "21:9", imageSize: "2K" },
      },
    });

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData?.data) { res.status(502).json({ error: "The image model returned no image, please try again" }); return; }

    const rawBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    const outBuffer = await sharp(rawBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "attention" })
      .png()
      .toBuffer();

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "Object storage not configured" }); return; }
    // Saved under carousel-images/ so it's served straight back by the existing
    // GET /content/images/carousel-images/:filename route, same as every other
    // generated/composited image in the app.
    const objectPath = `carousel-images/${Date.now()}-background-builder.png`;
    const bucket = objectStorageClient.bucket(bucketId);
    await bucket.file(objectPath).save(outBuffer, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });

    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const imageUrl = `${proto}://${host}/api/content/images/${objectPath}`;

    res.json({ imageUrl, width: TARGET_WIDTH, height: TARGET_HEIGHT });
  } catch (err: any) {
    logger.error({ err }, "Background Builder generate failed");
    res.status(500).json({ error: err?.message || "Background generation failed" });
  }
});

export default router;
