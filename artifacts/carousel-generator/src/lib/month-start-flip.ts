// Month Start flip-through animation.
//
// Five pages go in. A 12 second 1080 x 1440 clip comes out where each page
// turns to reveal the next, and the last page is left holding on screen.
// This is the same page turn as the Magazine Flip tool, for five pages.
//
// Pages are hinged on the left, like the spine of a real magazine. The right
// hand edge lifts, rolls over a cylinder and lays back on itself, all drawn on
// a 2D canvas one pixel wide strip at a time, so nothing is uploaded anywhere.

import { DOOR_W, DOOR_H, DOOR_FPS } from "./advent-door";

export const MONTH_W = DOOR_W;
export const MONTH_H = DOOR_H;
export const MONTH_FPS = DOOR_FPS;
export const MONTH_SECONDS = 12;
export const MONTH_FRAMES = MONTH_FPS * MONTH_SECONDS;
export const MONTH_PAGE_COUNT = 5;

// Timeline, in seconds (total is 12).
// Each turn starts with a little tug at the corner, then the page goes over.
const TURN_STARTS = [1.6, 4.3, 7.0, 9.7];
const TURN_DURATION = 1.0;
const TUG_DURATION = 0.4;
const CURL_RADIUS = 170;
const FOCAL = 2400;

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Where the fold line of the turning page sits, s seconds after its turn
// starts. It begins at the right edge (page flat), lifts a small tug at the
// corner, then runs all the way across and off the left side.
function foldAt(s: number): number {
  if (s < -TUG_DURATION) return MONTH_W;
  if (s < 0) {
    const k = (s + TUG_DURATION) / TUG_DURATION;
    return MONTH_W - 46 * Math.sin(k * Math.PI);
  }
  const k = Math.min(1, s / TURN_DURATION);
  const end = -CURL_RADIUS - 30;
  return MONTH_W + (end - MONTH_W) * easeInOutCubic(k);
}

// Which turn (if any) is in progress at time t, and which page is showing.
function stateAt(t: number): { turn: number; s: number } {
  for (let i = 0; i < TURN_STARTS.length; i++) {
    const s = t - TURN_STARTS[i];
    if (s >= -TUG_DURATION && s <= TURN_DURATION) return { turn: i, s };
  }
  // Between turns: the page number showing is how many turns have finished.
  let done = 0;
  for (let i = 0; i < TURN_STARTS.length; i++) if (t > TURN_STARTS[i] + TURN_DURATION) done = i + 1;
  return { turn: -1 - done, s: 0 }; // -1 - done encodes "flat page number done"
}

// A soft shadow down the spine so every page reads as part of a bound magazine.
function drawSpine(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 70, 0);
  g.addColorStop(0, "rgba(0,0,0,0.20)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 70, MONTH_H);
}

// Draws one frame. t is seconds from the start.
export function drawMonthFrame(ctx: CanvasRenderingContext2D, pages: CanvasImageSource[], t: number) {
  const st = stateAt(t);
  ctx.clearRect(0, 0, MONTH_W, MONTH_H);

  if (st.turn < 0) {
    const pageNo = -1 - st.turn;
    ctx.drawImage(pages[pageNo], 0, 0, MONTH_W, MONTH_H);
    drawSpine(ctx);
    return;
  }

  const top = pages[st.turn];
  const under = pages[st.turn + 1];
  ctx.drawImage(under, 0, 0, MONTH_W, MONTH_H);
  drawSpine(ctx);

  const f = foldAt(st.s);
  const R = CURL_RADIUS;

  if (f >= MONTH_W - 0.5) {
    ctx.drawImage(top, 0, 0, MONTH_W, MONTH_H);
    drawSpine(ctx);
    return;
  }
  if (f <= -R - 29) return;

  // Soft shadow the lifted page throws onto the page underneath.
  const shadowStart = Math.max(0, f + R * 0.8);
  if (shadowStart < MONTH_W) {
    const g = ctx.createLinearGradient(shadowStart, 0, shadowStart + 300, 0);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(shadowStart, 0, MONTH_W - shadowStart, MONTH_H);
  }

  // Flat part of the page that has not lifted yet.
  const flatW = Math.max(0, Math.min(MONTH_W, f));
  if (flatW > 0) {
    ctx.drawImage(top, 0, 0, flatW, MONTH_H, 0, 0, flatW, MONTH_H);
    const gl = ctx.createLinearGradient(f - 170, 0, f, 0);
    gl.addColorStop(0, "rgba(0,0,0,0)");
    gl.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = gl;
    ctx.fillRect(Math.max(0, f - 170), 0, flatW - Math.max(0, f - 170), MONTH_H);
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
  for (let u = start; u < MONTH_W; u++) {
    const next = posOf(u + 1);
    const mid = posOf(u + 0.5);
    const xa = Math.min(prev.x, next.x);
    const w = Math.abs(next.x - prev.x);
    prev = next;
    if (w < 0.01 || xa + w < 0 || xa > MONTH_W) continue;
    const scale = FOCAL / (FOCAL - mid.z);
    const h = MONTH_H * scale;
    const y = (MONTH_H - h) / 2;
    const back = mid.theta > Math.PI / 2;
    const ww = w + 0.35;
    if (back) {
      // the paper back of the page: solid cream with the print just showing through
      ctx.fillStyle = "rgb(240,233,220)";
      ctx.fillRect(xa, y, ww, h);
      ctx.globalAlpha = 0.09;
      ctx.drawImage(top, u, 0, 1, MONTH_H, xa, y, ww, h);
      ctx.globalAlpha = 1;
      const round = Math.abs(Math.cos(mid.theta));
      ctx.fillStyle = `rgba(0,0,0,${0.14 * (1 - round)})`;
      ctx.fillRect(xa, y, ww, h);
    } else {
      ctx.drawImage(top, u, 0, 1, MONTH_H, xa, y, ww, h);
      const shade = 0.34 * (1 - Math.cos(mid.theta));
      if (shade > 0.004) {
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(xa, y, ww, h);
      }
    }
  }
}

// Renders every frame into an MP4 using the browser's own H.264 encoder.
export async function exportMonthMp4(
  pages: CanvasImageSource[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (typeof (window as any).VideoEncoder === "undefined") {
    throw new Error("MP4 export needs Chrome or Edge (or Safari 16.4 and newer). Open this page in one of those.");
  }
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const canvas = document.createElement("canvas");
  canvas.width = MONTH_W;
  canvas.height = MONTH_H;
  const ctx = canvas.getContext("2d")!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: MONTH_W, height: MONTH_H },
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
    width: MONTH_W,
    height: MONTH_H,
    bitrate: 8_000_000,
    framerate: MONTH_FPS,
  });

  for (let i = 0; i < MONTH_FRAMES; i++) {
    if (encoderError) throw encoderError;
    drawMonthFrame(ctx, pages, i / MONTH_FPS);
    const frame = new (window as any).VideoFrame(canvas, {
      timestamp: Math.round(i * (1_000_000 / MONTH_FPS)),
    });
    encoder.encode(frame, { keyFrame: i % (MONTH_FPS * 2) === 0 });
    frame.close();
    onProgress?.((i + 1) / MONTH_FRAMES);
    if (encoder.encodeQueueSize > 8) await new Promise<void>((r) => setTimeout(r, 4));
    else if (i % 6 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  muxer.finalize();
  const { buffer } = muxer.target as any;
  return new Blob([buffer], { type: "video/mp4" });
}
