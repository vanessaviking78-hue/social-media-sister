import sharp from "sharp";
import opentype from "opentype.js";
import { BASE_JPG, FONT_TTF } from "./xmasOgAssets";

// Draws "<NAME>'S / XMAS / SHOOT" onto the link preview picture. The letters are turned into outlines
// (no system fonts needed on the server) and laid over the picture with sharp.
let font: opentype.Font | null = null;
const getFont = () => {
  if (!font) {
    const buf = Buffer.from(FONT_TTF, "base64");
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
};

export function firstNameFor(name: string, slug: string): string {
  const first = (name || "").trim().split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, "");
  if (first) return first;
  const fromSlug = slug.replace(/xmas$/, "").replace(/\d+$/, "");
  return fromSlug ? fromSlug[0].toUpperCase() + fromSlug.slice(1) : "Your";
}

export function possessive(first: string): string {
  if (first === "Your") return "Your";
  return /s$/i.test(first) ? `${first}’` : `${first}’s`;
}

const MAX_W = 540;
const LEFT = 56;

export async function renderXmasOg(first: string): Promise<Buffer> {
  const f = getFont();
  const nameLine = possessive(first).toUpperCase();
  const widthAt = (t: string, size: number) => f.getAdvanceWidth(t, size);
  let size = 80;
  const longest = ["CHRISTMAS", nameLine].sort((a, b) => widthAt(b, 80) - widthAt(a, 80))[0];
  while (widthAt(longest, size) > MAX_W && size > 36) size -= 2;
  const line = (t: string, baseline: number, fill: string) => `<path d="${f.getPath(t, LEFT, baseline, size).toPathData(2)}" fill="${fill}"/>`;
  const gap = Math.round(size * 1.18);
  const total = gap * 3;
  const first_baseline = 150 + (330 - total) / 2 + size * 0.95;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${line(nameLine, first_baseline, "#111111")}${line("XMAS", first_baseline + gap, "#ff208c")}${line("SHOOT", first_baseline + gap * 2, "#ff208c")}</svg>`;
  return sharp(Buffer.from(BASE_JPG, "base64")).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
}
