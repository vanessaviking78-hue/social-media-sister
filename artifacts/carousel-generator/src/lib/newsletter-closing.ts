// The closing card: the clinician's photo cropped to a circle, and their
// name written in Caveat. The name is drawn to an image rather than set as
// text, so it looks exactly the same in the PDF and in every email app,
// even the ones that ignore web fonts.

const CAVEAT_URL = "https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.3.0/files/caveat-latin-600-normal.woff2";
let caveatReady: Promise<boolean> | null = null;

function loadCaveat(): Promise<boolean> {
  if (!caveatReady) {
    caveatReady = (async () => {
      try {
        const face = new FontFace("NewsletterCaveat", `url(${CAVEAT_URL})`, { weight: "600" });
        await face.load();
        (document.fonts as any).add(face);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return caveatReady;
}

// Returns a transparent PNG of the name in handwriting, trimmed to fit.
export async function renderSignature(name: string, color: string): Promise<string | null> {
  const text = (name || "").trim();
  if (!text) return null;
  const ok = await loadCaveat();
  const font = ok ? `600 180px NewsletterCaveat` : `italic 150px Georgia, serif`;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 60;
  c.width = w;
  c.height = 260;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 30, 185);
  return c.toDataURL("image/png");
}

// Centre-crops any photo to a circle with a transparent surround.
export function circlePhoto(img: HTMLImageElement, size = 700): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2;
  // Portraits usually have the face in the upper half, so bias the crop up.
  const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - s) * 0.25 : (img.naturalHeight - s) / 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  return c.toDataURL("image/png");
}

export const DEFAULT_THANKS = "Thanks for being a part of my clinic";
