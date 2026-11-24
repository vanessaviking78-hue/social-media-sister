import JSZip from "jszip";
import { saveAs } from "file-saver";

// Sparkle: finished slides go to the server, which lays falling snow, gold glitter or twinkling stars over each one and
// gives back a short looping MP4 per slide. Used by Xmas Posts, Xmas, NEWXMAS and XMAS FEELS.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type SparkleStyle = "gold" | "snow" | "twinkle" | "pink";
export type SparkleAmount = "light" | "medium" | "full";

export const SPARKLE_STYLE_LABELS: Record<SparkleStyle, string> = {
  gold: "Gold glitter",
  snow: "Snowfall",
  twinkle: "Twinkle stars",
  pink: "Hot pink glitter",
};
export const SPARKLE_AMOUNT_LABELS: Record<SparkleAmount, string> = { light: "Light", medium: "Medium", full: "Full" };

const KEY = "sparkle-choice-v1";

export type SparkleChoice = { style: SparkleStyle; amount: SparkleAmount; color: string }; // color is a hex like #ff2d95, or "" to use the style's own colours

export function loadSparkleChoice(): SparkleChoice {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "{}");
    const style = r.style in SPARKLE_STYLE_LABELS ? r.style : "gold";
    const amount = r.amount in SPARKLE_AMOUNT_LABELS ? r.amount : "medium";
    const color = typeof r.color === "string" && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color.toLowerCase() : "";
    return { style, amount, color };
  } catch {
    return { style: "gold", amount: "medium", color: "" };
  }
}

export function saveSparkleChoice(c: SparkleChoice) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

async function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
  const b: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!b) throw new Error("A slide could not be read");
  return b;
}

// One MP4 per slide, in the same order as the slides. Sent a few at a time so a big post never times out.
export async function sparkleSlides(slides: HTMLCanvasElement[], style: SparkleStyle, amount: SparkleAmount, color = ""): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < slides.length; i += 3) {
    const fd = new FormData();
    fd.append("style", style);
    fd.append("amount", amount);
    if (color) fd.append("color", color);
    for (let k = i; k < Math.min(slides.length, i + 3); k++) fd.append("slides", await canvasBlob(slides[k]), `slide-${k + 1}.png`);
    const r = await fetch(`${BASE}/api/sparkle`, { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Could not add the sparkle");
    urls.push(...((data.videoUrls ?? []) as string[]));
  }
  if (urls.length !== slides.length) throw new Error("Some sparkle slides did not come back, try again");
  return urls;
}

export async function addVideosToZip(zip: JSZip, urls: string[], prefix: string) {
  for (let i = 0; i < urls.length; i++) {
    const r = await fetch(urls[i].startsWith("http") ? urls[i] : `${BASE}${urls[i]}`);
    if (!r.ok) throw new Error("Could not fetch a sparkle slide");
    zip.file(`${prefix}-slide-${i + 1}.mp4`, await r.blob());
  }
}

export async function downloadSparkleZip(files: { prefix: string; urls: string[]; caption?: string }[], zipName: string) {
  const zip = new JSZip();
  for (const f of files) {
    await addVideosToZip(zip, f.urls, f.prefix);
    if (f.caption?.trim()) zip.file(`${f.prefix}-caption.txt`, f.caption);
  }
  saveAs(await zip.generateAsync({ type: "blob" }), zipName);
}

// How a sparkly post goes into the scheduler: several slides make a video carousel, one slide makes a reel.
export function sparklePostBody(urls: string[], caption: string, title: string, sourceTool: string) {
  const base = { caption, title, platforms: ["instagram"], sourceTool };
  return urls.length > 1
    ? { postType: "video_carousel", content: { ...base, videoUrls: urls } }
    : { postType: "reel", content: { ...base, videoUrl: urls[0] } };
}
