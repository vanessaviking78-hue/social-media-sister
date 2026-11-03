import { loadImage, transparentLogo } from "./sample-post";

// Turns whatever logo a clinic uploads into a clean one with a see-through background, trimmed to its edges,
// so it sits straight on a photo or a coloured gradient. Used by the 10 free posts form (so they see it happen)
// and again when the posts are drawn.

const MAX = 1400;

function cornersClear(d: Uint8ClampedArray, w: number, h: number): boolean {
  const at = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  return [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)].every((a) => a < 40);
}

function opaqueShare(c: HTMLCanvasElement): number {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n / (c.width * c.height);
}

function trim(c: HTMLCanvasElement): HTMLCanvasElement {
  const w = c.width;
  const h = c.height;
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return c;
  const pad = 4;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w, maxX + pad + 1);
  const y1 = Math.min(h, maxY + pad + 1);
  const out = document.createElement("canvas");
  out.width = x1 - x0;
  out.height = y1 - y0;
  out.getContext("2d")!.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return out;
}

/** The logo with its background taken off. A logo that is already see-through is only trimmed. */
export async function makeClearLogo(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(8, Math.round(img.naturalWidth * s));
    const h = Math.max(8, Math.round(img.naturalHeight * s));
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    const ctx = base.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    if (cornersClear(ctx.getImageData(0, 0, w, h).data, w, h)) return trim(base);
    const cleared = transparentLogo(base);
    // If taking the background off removed almost everything, the logo is a solid block, so keep it as it came.
    return trim(opaqueShare(cleared) < 0.004 ? base : cleared);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Average brightness (0 dark, 1 white) of the visible part of the logo. */
export function logoLuma(c: HTMLCanvasElement): number {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    n++;
  }
  return n ? sum / n : 0.5;
}

/** The same shape in one flat colour, for putting a dark logo on a dark gradient. */
export function recolourLogo(c: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = c.width;
  out.height = c.height;
  const g = out.getContext("2d")!;
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colour;
  g.fillRect(0, 0, out.width, out.height);
  return out;
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not save the logo"))), "image/png"));
}
