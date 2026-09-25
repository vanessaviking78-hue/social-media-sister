// Magazine flip-through animation.
//
// Four to five pages go in: the front cover, one or two middle pages and a
// call to action. A 1080 x 1440 clip comes out where each page turns to
// reveal the next, and the call to action is left holding on screen. The
// clip runs 10 seconds for 4 pages, 12 seconds for 5.
//
// Pages are hinged on the left, like the spine of a real magazine. The right
// hand edge lifts, rolls over a cylinder and lays back on itself, all drawn on
// a 2D canvas one pixel wide strip at a time, so nothing is uploaded anywhere.

import { DOOR_W, DOOR_H, DOOR_FPS } from "./advent-door";

export const MAG_W = DOOR_W;
export const MAG_H = DOOR_H;
export const MAG_FPS = DOOR_FPS;
/** @deprecated kept for older callers; use magSecondsFor(pageCount) instead */
export const MAG_SECONDS = 10;
/** @deprecated kept for older callers; use magFramesFor(pageCount) instead */
export const MAG_FRAMES = MAG_FPS * MAG_SECONDS;
export const MAG_PAGE_COUNT = 4;
export const MAG_MIN_PAGES = 4;
export const MAG_MAX_PAGES = 5;

// Timeline, in seconds. One start per page turn (pages.length - 1 turns),
// each turn starting 2.7s after the last so extra pages just add time.
const ALL_TURN_STARTS = [1.6, 4.3, 7.0, 9.7];
const TURN_DURATION = 1.0;
const TUG_DURATION = 0.4;
const CURL_RADIUS = 170;
const FOCAL = 2400;

function turnStartsFor(pageCount: number): number[] {
  return ALL_TURN_STARTS.slice(0, Math.max(0, pageCount - 1));
}

/** Total clip length for a given page count: 10s for 4 pages, 12s for 5. */
export function magSecondsFor(pageCount: number): number {
  return pageCount >= 5 ? 12 : 10;
}

export function magFramesFor(pageCount: number): number {
  return Math.round(MAG_FPS * magSecondsFor(pageCount));
}

export const MAG_PAGE_LABELS_ALL = ["Front cover", "Page 2", "Page 3", "Page 4"];
export const MAG_PAGE_HINTS_ALL = [
  "The cover that opens the video",
  "The first page you turn to",
  "The second page you turn to",
  "The third page you turn to",
];
export const MAG_CTA_LABEL = "Call to action";
export const MAG_CTA_HINT = "The last page, it stays on screen";

/** Labels/hints for however many pages are in play (4 or 5), CTA always last. */
export function magLabelsFor(pageCount: number): string[] {
  return [...MAG_PAGE_LABELS_ALL.slice(0, pageCount - 1), MAG_CTA_LABEL];
}
export function magHintsFor(pageCount: number): string[] {
  return [...MAG_PAGE_HINTS_ALL.slice(0, pageCount - 1), MAG_CTA_HINT];
}

// Backwards-compatible 4-page defaults.
export const MAG_PAGE_LABELS = magLabelsFor(4);
export const MAG_PAGE_HINTS = magHintsFor(4);

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Where the fold line of the turning page sits, s seconds after its turn
// starts. It begins at the right edge (page flat), lifts a small tug at the
// corner, then runs all the way across and off the left side.
function foldAt(s: number): number {
  if (s < -TUG_DURATION) return MAG_W;
  if (s < 0) {
    const k = (s + TUG_DURATION) / TUG_DURATION;
    return MAG_W - 46 * Math.sin(k * Math.PI);
  }
  const k = Math.min(1, s / TURN_DURATION);
  const end = -CURL_RADIUS - 30;
  return MAG_W + (end - MAG_W) * easeInOutCubic(k);
}

// Which turn (if any) is in progress at time t, and which page is showing.
function stateAt(t: number, turnStarts: number[]): { turn: number; s: number } {
  for (let i = 0; i < turnStarts.length; i++) {
    const s = t - turnStarts[i];
    if (s >= -TUG_DURATION && s <= TURN_DURATION) return { turn: i, s };
  }
  // Between turns: the page number showing is how many turns have finished.
  let done = 0;
  for (let i = 0; i < turnStarts.length; i++) if (t > turnStarts[i] + TURN_DURATION) done = i + 1;
  return { turn: -1 - done, s: 0 }; // -1 - done encodes "flat page number done"
}

// A soft shadow down the spine so every page reads as part of a bound magazine.
function drawSpine(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 70, 0);
  g.addColorStop(0, "rgba(0,0,0,0.20)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 70, MAG_H);
}

// Draws one frame. t is seconds from the start.
export function drawMagazineFrame(ctx: CanvasRenderingContext2D, pages: CanvasImageSource[], t: number) {
  const st = stateAt(t, turnStartsFor(pages.length));
  ctx.clearRect(0, 0, MAG_W, MAG_H);

  if (st.turn < 0) {
    const pageNo = -1 - st.turn;
    ctx.drawImage(pages[pageNo], 0, 0, MAG_W, MAG_H);
    drawSpine(ctx);
    return;
  }

  const top = pages[st.turn];
  const under = pages[st.turn + 1];
  ctx.drawImage(under, 0, 0, MAG_W, MAG_H);
  drawSpine(ctx);

  const f = foldAt(st.s);
  const R = CURL_RADIUS;

  if (f >= MAG_W - 0.5) {
    ctx.drawImage(top, 0, 0, MAG_W, MAG_H);
    drawSpine(ctx);
    return;
  }
  if (f <= -R - 29) return;

  // Soft shadow the lifted page throws onto the page underneath.
  const shadowStart = Math.max(0, f + R * 0.8);
  if (shadowStart < MAG_W) {
    const g = ctx.createLinearGradient(shadowStart, 0, shadowStart + 300, 0);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(shadowStart, 0, MAG_W - shadowStart, MAG_H);
  }

  // Flat part of the page that has not lifted yet.
  const flatW = Math.max(0, Math.min(MAG_W, f));
  if (flatW > 0) {
    ctx.drawImage(top, 0, 0, flatW, MAG_H, 0, 0, flatW, MAG_H);
    const gl = ctx.createLinearGradient(f - 170, 0, f, 0);
    gl.addColorStop(0, "rgba(0,0,0,0)");
    gl.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = gl;
    ctx.fillRect(Math.max(0, f - 170), 0, flatW - Math.max(0, f - 170), MAG_H);
  }

  // The rolling and folded part, painted strip by strip from the fold outwards.
  const posOf = (u: number) => {
    const d = u - f;
    if (d <= 0) return { x: u, z: 0, theta: 0 };
    if (d < Math.PI * R) {
      const theta = d / R;
      return { x: f + R * Math.sin(theta), z: R * (1 - Math.cos(theta)), theta };
    }
    return { x: f - (d - Math.PI * R), z: 2 * R, theta: Math.PI };
  };
  const start = Math.max(0, Math.floor(f));
  let prev = posOf(start);
  for (let u = start; u < MAG_W; u++) {
    const next = posOf(u + 1);
    const mid = posOf(u + 0.5);
    const xa = Math.min(prev.x, next.x);
    const w = Math.abs(next.x - prev.x);
    prev = next;
    if (w < 0.01 || xa + w < 0 || xa > MAG_W) continue;
    const scale = FOCAL / (FOCAL - mid.z);
    const h = MAG_H * scale;
    const y = (MAG_H - h) / 2;
    const back = mid.theta > Math.PI / 2;
    const ww = w + 0.35;
    if (back) {
      // the paper back of the page: solid cream with the print just showing through
      ctx.fillStyle = "rgb(240,233,220)";
      ctx.fillRect(xa, y, ww, h);
      ctx.globalAlpha = 0.09;
      ctx.drawImage(top, u, 0, 1, MAG_H, xa, y, ww, h);
      ctx.globalAlpha = 1;
      const round = Math.abs(Math.cos(mid.theta));
      ctx.fillStyle = `rgba(0,0,0,${0.14 * (1 - round)})`;
      ctx.fillRect(xa, y, ww, h);
    } else {
      ctx.drawImage(top, u, 0, 1, MAG_H, xa, y, ww, h);
      const shade = 0.34 * (1 - Math.cos(mid.theta));
      if (shade > 0.004) {
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(xa, y, ww, h);
      }
    }
  }
}

// Renders every frame into an MP4 using the browser's own H.264 encoder.
export async function exportMagazineMp4(
  pages: CanvasImageSource[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (typeof (window as any).VideoEncoder === "undefined") {
    throw new Error("MP4 export needs Chrome or Edge (or Safari 16.4 and newer). Open this page in one of those.");
  }
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const canvas = document.createElement("canvas");
  canvas.width = MAG_W;
  canvas.height = MAG_H;
  const ctx = canvas.getContext("2d")!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: MAG_W, height: MAG_H },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new (window as any).VideoEncoder({
    output: (chunk: any, meta?: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: Error) => {
      encoderError = e;
    },
  });
  encoder.configure({
    codec: "avc1.420029",
    width: MAG_W,
    height: MAG_H,
    bitrate: 8_000_000,
    framerate: MAG_FPS,
  });

  const frameCount = magFramesFor(pages.length);
  for (let i = 0; i < frameCount; i++) {
    if (encoderError) throw encoderError;
    drawMagazineFrame(ctx, pages, i / MAG_FPS);
    const frame = new (window as any).VideoFrame(canvas, {
      timestamp: Math.round(i * (1_000_000 / MAG_FPS)),
    });
    encoder.encode(frame, { keyFrame: i % (MAG_FPS * 2) === 0 });
    frame.close();
    onProgress?.((i + 1) / frameCount);
    if (encoder.encodeQueueSize > 8) await new Promise<void>((r) => setTimeout(r, 4));
    else if (i % 6 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  muxer.finalize();
  const { buffer } = muxer.target as any;
  return new Blob([buffer], { type: "video/mp4" });
}
