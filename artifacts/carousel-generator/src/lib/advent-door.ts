// Advent calendar door animation.
//
// Two images go in: a closed door and whatever sits behind it. A short
// 1080 x 1440 clip comes out where the door swings open on its left hinge
// and the reveal is left holding on screen.
//
// Everything is drawn on a 2D canvas, so nothing is uploaded anywhere. The
// 3D swing is faked by slicing the door into one pixel wide strips and
// pushing each strip through a simple perspective divide, which is plenty
// for a door and much lighter than dragging in WebGL.

export const DOOR_W = 1080;
export const DOOR_H = 1440;
export const DOOR_FPS = 30;
export const DOOR_SECONDS = 5;
export const DOOR_FRAMES = DOOR_FPS * DOOR_SECONDS;

// Timeline, in seconds (total is 5).
const HOLD_CLOSED = 0.9; // door sits shut, with a little rattle at the end
const OPEN_DURATION = 1.8; // the swing itself
const MAX_ANGLE = (112 * Math.PI) / 180; // far enough that the door leaves the frame
const FOCAL = 2400; // bigger is flatter, smaller is more dramatic
const CURL_RADIUS = 170; // how round the turning page is in the page turn style

export type DoorStyle = "swing" | "pageturn";
export const DOOR_STYLES: { key: DoorStyle; label: string; hint: string }[] = [
  { key: "swing", label: "Door swing", hint: "Opens on a left hinge like a real advent window" },
  { key: "pageturn", label: "Page turn", hint: "The door peels away from the right like a page" },
];

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image would not open, try another file"));
    };
    img.src = url;
  });
}

// Centre crops any upload to exactly 1080 x 1440, the same as CSS
// object-fit: cover, so nothing is ever squashed or letterboxed.
export function coverToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = DOOR_W;
  canvas.height = DOOR_H;
  const ctx = canvas.getContext("2d")!;
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = DOOR_W / DOOR_H;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, DOOR_W, DOOR_H);
  return canvas;
}

// Angle of the door (radians) at time t seconds. 0 is shut.
export function doorAngleAt(t: number): number {
  const rattleStart = HOLD_CLOSED - 0.35;
  if (t < rattleStart) return 0;
  if (t < HOLD_CLOSED) {
    // two quick little tugs on the handle before it gives way
    const k = (t - rattleStart) / 0.35;
    return Math.sin(k * Math.PI * 3) * (1 - k * 0.4) * 0.028;
  }
  const k = Math.min(1, (t - HOLD_CLOSED) / OPEN_DURATION);
  return easeInOutCubic(k) * MAX_ANGLE;
}

// Draws one frame. t is seconds from the start.
export function drawDoorFrame(
  ctx: CanvasRenderingContext2D,
  door: CanvasImageSource,
  reveal: CanvasImageSource,
  t: number,
  style: DoorStyle = "swing"
) {
  if (style === "pageturn") drawPageTurnFrame(ctx, door, reveal, t);
  else drawSwingFrame(ctx, door, reveal, t);
}

// Reveal picture with the slow push in that starts as the door lets go.
function drawReveal(ctx: CanvasRenderingContext2D, reveal: CanvasImageSource, t: number) {
  const zoomK = Math.max(0, Math.min(1, (t - HOLD_CLOSED) / (DOOR_SECONDS - HOLD_CLOSED)));
  const zoom = 1 + 0.045 * easeInOutCubic(zoomK);
  ctx.save();
  ctx.clearRect(0, 0, DOOR_W, DOOR_H);
  ctx.translate(DOOR_W / 2, DOOR_H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-DOOR_W / 2, -DOOR_H / 2);
  ctx.drawImage(reveal, 0, 0, DOOR_W, DOOR_H);
  ctx.restore();
}

// Where the fold line of the turning page sits at time t. It starts at the
// right edge (page flat), gives a small tug so the corner lifts, then runs
// all the way across and off the left side.
function foldPositionAt(t: number): number {
  const tugStart = HOLD_CLOSED - 0.4;
  if (t < tugStart) return DOOR_W;
  if (t < HOLD_CLOSED) {
    const k = (t - tugStart) / 0.4;
    return DOOR_W - 46 * Math.sin(k * Math.PI);
  }
  const k = Math.min(1, (t - HOLD_CLOSED) / OPEN_DURATION);
  const end = -CURL_RADIUS - 30;
  return DOOR_W + (end - DOOR_W) * easeInOutCubic(k);
}

// The door as a page: the right hand side lifts, rolls over a cylinder and
// lays back on itself, so you see its paper back as it turns away to the left.
function drawPageTurnFrame(
  ctx: CanvasRenderingContext2D,
  door: CanvasImageSource,
  reveal: CanvasImageSource,
  t: number
) {
  drawReveal(ctx, reveal, t);
  const f = foldPositionAt(t);
  const R = CURL_RADIUS;

  if (f >= DOOR_W - 0.5) {
    ctx.drawImage(door, 0, 0, DOOR_W, DOOR_H);
    return;
  }
  if (f <= -R - 29) return;

  // Soft shadow the lifted page throws onto the picture underneath.
  const shadowStart = Math.max(0, f + R * 0.8);
  if (shadowStart < DOOR_W) {
    const g = ctx.createLinearGradient(shadowStart, 0, shadowStart + 300, 0);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(shadowStart, 0, DOOR_W - shadowStart, DOOR_H);
  }

  // Flat part of the page that has not lifted yet.
  const flatW = Math.max(0, Math.min(DOOR_W, f));
  if (flatW > 0) {
    ctx.drawImage(door, 0, 0, flatW, DOOR_H, 0, 0, flatW, DOOR_H);
    // shade under the curl, darkest just left of the fold
    const gl = ctx.createLinearGradient(f - 170, 0, f, 0);
    gl.addColorStop(0, "rgba(0,0,0,0)");
    gl.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = gl;
    ctx.fillRect(Math.max(0, f - 170), 0, flatW - Math.max(0, f - 170), DOOR_H);
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
  for (let u = start; u < DOOR_W; u++) {
    const next = posOf(u + 1);
    const mid = posOf(u + 0.5);
    const xa = Math.min(prev.x, next.x);
    const w = Math.abs(next.x - prev.x);
    prev = next;
    if (w < 0.01 || xa + w < 0 || xa > DOOR_W) continue;
    const scale = FOCAL / (FOCAL - mid.z);
    const h = DOOR_H * scale;
    const y = (DOOR_H - h) / 2;
    const back = mid.theta > Math.PI / 2;
    const ww = w + 0.35;
    if (back) {
      // the paper back of the page: solid cream, with the door just showing
      // through, and a little roundness in the light
      ctx.fillStyle = "rgb(240,233,220)";
      ctx.fillRect(xa, y, ww, h);
      ctx.globalAlpha = 0.09;
      ctx.drawImage(door, u, 0, 1, DOOR_H, xa, y, ww, h);
      ctx.globalAlpha = 1;
      const round = Math.abs(Math.cos(mid.theta));
      ctx.fillStyle = `rgba(0,0,0,${0.14 * (1 - round)})`;
      ctx.fillRect(xa, y, ww, h);
    } else {
      ctx.drawImage(door, u, 0, 1, DOOR_H, xa, y, ww, h);
      const shade = 0.34 * (1 - Math.cos(mid.theta));
      if (shade > 0.004) {
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(xa, y, ww, h);
      }
    }
  }
}

function drawSwingFrame(
  ctx: CanvasRenderingContext2D,
  door: CanvasImageSource,
  reveal: CanvasImageSource,
  t: number
) {
  const angle = Math.max(0, doorAngleAt(t));
  const openness = Math.min(1, angle / (Math.PI / 2));

  drawReveal(ctx, reveal, t);

  if (angle <= 0.0005 && t < HOLD_CLOSED - 0.35) {
    ctx.drawImage(door, 0, 0, DOOR_W, DOOR_H);
    return;
  }

  // Inside of the door frame: a shadow that falls across the reveal on the
  // hinge side and fades as the door clears the way.
  if (openness < 1) {
    const shadowAlpha = 0.55 * Math.sin(Math.min(1, openness * 1.15) * Math.PI) * (1 - openness * 0.5);
    const g = ctx.createLinearGradient(0, 0, DOOR_W * 0.85, 0);
    g.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
    g.addColorStop(0.55, `rgba(0,0,0,${shadowAlpha * 0.35})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DOOR_W, DOOR_H);
  }

  if (angle >= MAX_ANGLE - 0.0005) return;

  // The door itself, hinged on the left edge and swinging towards the viewer.
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  let prevX = 0;
  const step = 1;
  const shade = Math.min(0.5, 0.6 * (1 - cosA));
  for (let u = 0; u < DOOR_W; u += step) {
    const uMid = u + step / 2;
    const z = uMid * sinA; // distance towards the viewer
    const scale = FOCAL / Math.max(200, FOCAL - z);
    const x0 = prevX;
    const x1 = (u + step) * cosA * (FOCAL / Math.max(200, FOCAL - (u + step) * sinA));
    prevX = x1;
    if (x1 < 0 && x0 < 0) continue;
    const w = x1 - x0;
    if (w <= 0) continue; // edge on or turned away, nothing to see
    const h = DOOR_H * scale;
    ctx.drawImage(door, u, 0, step, DOOR_H, x0, (DOOR_H - h) / 2, w + 0.6, h);
    // Light falls off as the door turns away, darkest along the free edge.
    if (shade > 0.004) {
      ctx.fillStyle = `rgba(0,0,0,${shade * (u / DOOR_W)})`;
      ctx.fillRect(x0, (DOOR_H - h) / 2, w + 0.6, h);
    }
  }
}

// Renders every frame into an MP4 using the browser's own H.264 encoder.
export async function exportDoorMp4(
  door: CanvasImageSource,
  reveal: CanvasImageSource,
  onProgress?: (pct: number) => void,
  style: DoorStyle = "swing"
): Promise<Blob> {
  if (typeof (window as any).VideoEncoder === "undefined") {
    throw new Error("MP4 export needs Chrome or Edge (or Safari 16.4 and newer). Open this page in one of those.");
  }
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const canvas = document.createElement("canvas");
  canvas.width = DOOR_W;
  canvas.height = DOOR_H;
  const ctx = canvas.getContext("2d")!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: DOOR_W, height: DOOR_H },
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
    width: DOOR_W,
    height: DOOR_H,
    bitrate: 8_000_000,
    framerate: DOOR_FPS,
  });

  for (let i = 0; i < DOOR_FRAMES; i++) {
    if (encoderError) throw encoderError;
    drawDoorFrame(ctx, door, reveal, i / DOOR_FPS, style);
    const frame = new (window as any).VideoFrame(canvas, {
      timestamp: Math.round(i * (1_000_000 / DOOR_FPS)),
    });
    encoder.encode(frame, { keyFrame: i % (DOOR_FPS * 2) === 0 });
    frame.close();
    onProgress?.((i + 1) / DOOR_FRAMES);
    // keep the page breathing, and stop the encoder queue running away
    if (encoder.encodeQueueSize > 8) await new Promise<void>((r) => setTimeout(r, 4));
    else if (i % 6 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  muxer.finalize();
  const { buffer } = muxer.target as any;
  return new Blob([buffer], { type: "video/mp4" });
}
