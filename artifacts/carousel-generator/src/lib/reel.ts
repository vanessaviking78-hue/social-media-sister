// Rising text reel: the three layers of one post (background, text box, logo and bow) go to the server, which slides the text up from
// the bottom over the background and gives back a silent 8 second MP4 (1080 x 1920).
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

async function pngBlob(c: HTMLCanvasElement): Promise<Blob> {
  const b: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!b) throw new Error("A layer could not be read");
  return b;
}

export async function makeRiseReel(layers: { bg: HTMLCanvasElement; text: HTMLCanvasElement; bow: HTMLCanvasElement; logo: HTMLCanvasElement }): Promise<string> {
  const fd = new FormData();
  fd.append("w", String(layers.bg.width));
  fd.append("h", String(layers.bg.height));
  fd.append("boxTop", String(topOfInk(layers.text)));
  fd.append("bg", await pngBlob(layers.bg), "bg.png");
  fd.append("text", await pngBlob(layers.text), "text.png");
  fd.append("bow", await pngBlob(layers.bow), "bow.png");
  fd.append("logo", await pngBlob(layers.logo), "logo.png");
  const r = await fetch(`${BASE}/api/reel-rise`, { method: "POST", body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.jobId) throw new Error(data.error || "Could not make the reel");
  // The server makes the video in the background, so ask for it every couple of seconds until it is ready (up to 4 minutes).
  for (let i = 0; i < 120; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    const s = await fetch(`${BASE}/api/reel-rise/${data.jobId}`).then((x) => x.json().catch(() => ({}))).catch(() => ({} as Record<string, unknown>));
    if (s.state === "done" && s.videoUrl) return s.videoUrl as string;
    if (s.state === "failed" || s.error) throw new Error((s.error as string) || "Could not make the reel");
  }
  throw new Error("The reel is taking too long, try again in a minute");
}

// The first row of the text layer that has anything drawn on it, so the server knows where the box starts.
function topOfInk(c: HTMLCanvasElement): number {
  const ctx = c.getContext("2d");
  if (!ctx) return 0;
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 12) return y;
  return 0;
}
