// Rising text reel: the three layers of one post (background, text box, logo and bow) go to the server, which slides the text up from
// the bottom over the background and gives back a silent 8 second MP4 (1080 x 1920).
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

async function pngBlob(c: HTMLCanvasElement): Promise<Blob> {
  const b: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!b) throw new Error("A layer could not be read");
  return b;
}

export async function makeRiseReel(layers: { bg: HTMLCanvasElement; text: HTMLCanvasElement; top: HTMLCanvasElement }): Promise<string> {
  const fd = new FormData();
  fd.append("w", String(layers.bg.width));
  fd.append("h", String(layers.bg.height));
  fd.append("bg", await pngBlob(layers.bg), "bg.png");
  fd.append("text", await pngBlob(layers.text), "text.png");
  fd.append("bow", await pngBlob(layers.top), "top.png");
  const r = await fetch(`${BASE}/api/reel-rise`, { method: "POST", body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.videoUrl) throw new Error(data.error || "Could not make the reel");
  return data.videoUrl as string;
}
