import { Router, type IRouter, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();
const GEMINI_MODEL = "gemini-2.5-flash-image";

router.post("/carousel/hook-image", async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) { res.status(400).json({ error: "A headline is required" }); return; }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "Image generation is not configured (GEMINI_API_KEY missing)" }); return; }

    const genAI = new GoogleGenAI({ apiKey });
    const prompt = `Create a clean, elegant background image for an aesthetic clinic's Instagram carousel cover, inspired by this headline: "${text.trim()}".

Style: soft, calming, premium and editorial. Muted, on-brand tones, gentle natural light, subtle texture, and plenty of negative space so headline text can sit comfortably on top.

Strict rules: absolutely no people, no faces, no hands, no bodies. No text, no words, no letters, no numbers, no logos, no watermarks. Just a beautiful, tasteful abstract or still-life aesthetic background. Vertical 4:5 composition.`;

    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData?.data) { res.status(502).json({ error: "The image model returned no image, please try again" }); return; }

    const mime = imagePart.inlineData.mimeType || "image/png";
    res.json({ dataUrl: `data:${mime};base64,${imagePart.inlineData.data}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Image generation failed" });
  }
});

export default router;
