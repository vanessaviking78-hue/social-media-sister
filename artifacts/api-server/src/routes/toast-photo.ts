import { Router, type IRouter, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const router: IRouter = Router();
const GEMINI_MODEL = "gemini-2.5-flash-image";

const PROMPTS = [
  "a single slice of golden brown toast standing upright in a chrome toaster on a bright kitchen counter, morning window light",
  "a single slice of golden brown buttered toast on a white plate on a pale wooden table, soft morning light, shot from slightly above",
  "a single slice of golden brown toast resting on a clean marble worktop with a mug of tea blurred behind it, warm morning light",
  "a single slice of golden brown sourdough toast on a ceramic plate by a sunny window, shallow depth of field",
];

async function one(prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey });
  const result = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text:
      `Hyper realistic photograph, looks like real life, 9:16 portrait. ${prompt}. The toast fills the middle of the frame with a smooth, flat, unmarked surface. No text, no letters, no numbers, no writing, no logos, no markings and no people anywhere in the picture.` }] }],
    config: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "9:16" } },
  });
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!img?.inlineData?.data) throw new Error("The image model returned no image");
  const out = await sharp(Buffer.from(img.inlineData.data, "base64"))
    .resize(1080, 1920, { fit: "cover", position: "attention" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

router.post("/morning-motivation/toast-photo", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "Image generation is not configured (GEMINI_API_KEY missing)" }); return; }
    const n = Number((req.body as { variant?: number })?.variant);
    const prompt = PROMPTS[(Number.isFinite(n) ? n : Math.floor(Math.random() * PROMPTS.length)) % PROMPTS.length];
    res.json({ image: await one(prompt, apiKey) });
  } catch (err: unknown) {
    req.log?.error({ err }, "morning-motivation: toast-photo error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Toast photo failed" });
  }
});

export default router;
