// Passes finished cover slides from Stylish to Magazine Flip without uploading anything.
// The canvases stay in memory while the page changes, so a full refresh clears them.
export type FlipHandoff = { canvases: HTMLCanvasElement[]; clientName: string };

let pending: FlipHandoff | null = null;

export function setFlipHandoff(h: FlipHandoff) { pending = h; }

export function takeFlipHandoff(): FlipHandoff | null {
  const h = pending;
  pending = null;
  return h;
}
