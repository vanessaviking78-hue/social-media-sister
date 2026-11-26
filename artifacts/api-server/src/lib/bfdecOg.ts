import sharp from "sharp";
import opentype from "opentype.js";
import { FONT_TTF } from "./xmasOgAssets";

// DECEMBER BUNDLE link preview picture: white, black and hot pink, with how long the offer has left.
// The letters are turned into outlines (no system fonts needed on the server) and drawn with sharp.
let font: opentype.Font | null = null;
const getFont = () => {
  if (!font) {
    const buf = Buffer.from(FONT_TTF, "base64");
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
};

const PINK = "#ff1f8e";

export function timeLeftLabel(closesAt: number, now = Date.now()): string {
  const ms = closesAt - now;
  if (ms <= 0) return "OFFER ENDED";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} MINUTES LEFT`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ${hrs === 1 ? "HOUR" : "HOURS"} LEFT`;
}

export async function renderBfdecOg(closesAt: number, now = Date.now(), fixedLabel?: string): Promise<Buffer> {
  const f = getFont();
  const w = (t: string, size: number) => f.getAdvanceWidth(t, size);
  const fit = (t: string, size: number, max: number) => { while (w(t, size) > max && size > 20) size -= 2; return size; };
  const path = (t: string, x: number, baseline: number, size: number, fill: string) => `<path d="${f.getPath(t, x, baseline, size).toPathData(2)}" fill="${fill}"/>`;
  const centred = (t: string, cx: number, baseline: number, size: number, fill: string) => path(t, cx - w(t, size) / 2, baseline, size, fill);

  const left = fixedLabel || timeLeftLabel(closesAt, now);
  const leftSize = fit(left, 120, 1000);
  const bundleSize = fit("DECEMBER BUNDLE", 112, 1080);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#ffffff"/>
<rect x="0" y="0" width="1200" height="14" fill="${PINK}"/>
${centred("YOUR WHOLE MONTH OF SOCIALS, COVERED", 600, 92, 38, PINK)}
${centred("DECEMBER BUNDLE", 600, 92 + 20 + bundleSize * 0.8, bundleSize, "#000000")}
${centred("20 XMAS POSTS + 10 XMAS PHOTOS", 600, 330, 44, "#000000")}
${centred("£86 WITH CODE BFDEC", 600, 392, 44, PINK)}
<rect x="60" y="430" width="1080" height="150" fill="${PINK}"/>
${centred(left, 600, 430 + 75 + leftSize * 0.36, leftSize * 0.9 > 130 ? 120 : leftSize, "#ffffff")}
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
