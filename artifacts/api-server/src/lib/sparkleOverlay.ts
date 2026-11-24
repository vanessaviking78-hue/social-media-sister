import { spawn } from "child_process";
import { mkdir, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Makes a looping, see through sparkle layer (a QuickTime file with an alpha channel) that gets laid over a finished slide.
// Everything is drawn here with plain maths, so there is no stock footage and nothing to license.
// Every movement is a whole number of cycles over the loop, so the last frame runs straight back into the first with no jump.

export const SPARKLE_W = 1080;
export const SPARKLE_H = 1350;
export const SPARKLE_FPS = 30;
export const SPARKLE_SECONDS = 6;

export type SparkleStyle = "gold" | "snow" | "twinkle" | "pink";
export type SparkleAmount = "light" | "medium" | "full";

export const SPARKLE_STYLES: SparkleStyle[] = ["gold", "snow", "twinkle", "pink"];
export const SPARKLE_AMOUNTS: SparkleAmount[] = ["light", "medium", "full"];

const AMOUNT_FACTOR: Record<SparkleAmount, number> = { light: 0.5, medium: 1, full: 1.6 };

type Particle = {
  x: number; y: number; r: number; // start position and size in pixels
  kind: "star" | "dot";
  rgb: [number, number, number];
  twinkle: number; phase: number; // whole cycles per loop, and where in the cycle it starts
  swayX: number; swayY: number; swayCycles: number; swayPhase: number;
  fall: number; // whole screens the particle drops per loop (0 for none)
  base: number; // brightest opacity, 0 to 1
};

// A tiny seeded random, so a style always looks the same and the cached file can be reused.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)];
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);
const whole = (r: () => number, a: number, b: number) => Math.round(between(r, a, b));

function makeParticles(style: SparkleStyle, amount: SparkleAmount): Particle[] {
  const r = rng(style.length * 7919 + style.charCodeAt(0) * 104729);
  const f = AMOUNT_FACTOR[amount];
  const out: Particle[] = [];
  const add = (p: Partial<Particle> & Pick<Particle, "kind" | "rgb" | "r">) =>
    out.push({
      x: r() * SPARKLE_W, y: r() * SPARKLE_H, twinkle: 1, phase: r(), swayX: 0, swayY: 0, swayCycles: 1, swayPhase: r(), fall: 0, base: 1, ...p,
    });

  if (style === "gold") {
    const golds: [number, number, number][] = [[255, 214, 120], [255, 232, 160], [245, 190, 90], [255, 246, 214]];
    for (let i = 0; i < Math.round(58 * f); i++) {
      add({ kind: "star", r: between(r, 9, 30), rgb: pick(r, golds), twinkle: whole(r, 1, 3), swayX: between(r, 6, 22), swayY: between(r, 6, 22), swayCycles: 1, base: between(r, 0.75, 1) });
    }
    for (let i = 0; i < Math.round(80 * f); i++) {
      add({ kind: "dot", r: between(r, 2, 5.5), rgb: pick(r, golds), twinkle: whole(r, 2, 4), swayX: between(r, 4, 16), swayY: between(r, 4, 16), base: between(r, 0.6, 0.95) });
    }
  } else if (style === "snow") {
    const whites: [number, number, number][] = [[255, 255, 255], [240, 248, 255], [255, 250, 250]];
    for (let i = 0; i < Math.round(70 * f); i++) {
      add({ kind: "dot", r: between(r, 3, 8), rgb: pick(r, whites), twinkle: 0, fall: 1, swayX: between(r, 14, 46), swayCycles: whole(r, 1, 2), base: between(r, 0.55, 0.92) });
    }
    for (let i = 0; i < Math.round(26 * f); i++) {
      add({ kind: "dot", r: between(r, 9, 17), rgb: pick(r, whites), twinkle: 0, fall: 1, swayX: between(r, 20, 60), base: between(r, 0.18, 0.4) });
    }
    for (let i = 0; i < Math.round(30 * f); i++) {
      add({ kind: "dot", r: between(r, 1.5, 3.5), rgb: [255, 255, 255], twinkle: 0, fall: 2, swayX: between(r, 8, 24), swayCycles: 2, base: between(r, 0.5, 0.85) });
    }
  } else if (style === "twinkle") {
    const cools: [number, number, number][] = [[255, 255, 255], [255, 236, 245], [236, 244, 255], [255, 248, 220]];
    for (let i = 0; i < Math.round(30 * f); i++) {
      add({ kind: "star", r: between(r, 16, 40), rgb: pick(r, cools), twinkle: whole(r, 2, 4), swayX: between(r, 3, 12), swayY: between(r, 3, 12), base: 1 });
    }
    for (let i = 0; i < Math.round(60 * f); i++) {
      add({ kind: "dot", r: between(r, 2, 4.5), rgb: pick(r, cools), twinkle: whole(r, 2, 5), base: between(r, 0.6, 1) });
    }
  } else {
    // pink: hot pink glitter with white hearts of light
    const pinks: [number, number, number][] = [[255, 45, 149], [255, 105, 180], [255, 160, 205], [255, 255, 255]];
    for (let i = 0; i < Math.round(44 * f); i++) {
      add({ kind: "star", r: between(r, 10, 32), rgb: pick(r, pinks), twinkle: whole(r, 1, 3), swayX: between(r, 6, 20), swayY: between(r, 6, 20), base: between(r, 0.8, 1) });
    }
    for (let i = 0; i < Math.round(90 * f); i++) {
      add({ kind: "dot", r: between(r, 2, 5), rgb: pick(r, pinks), twinkle: whole(r, 2, 4), swayX: between(r, 4, 14), swayY: between(r, 4, 14), base: between(r, 0.6, 0.95) });
    }
  }
  return out;
}

// Paints one particle into the frame. A pixel keeps whichever layer is brightest, which stops overlapping glows turning muddy.
function paint(buf: Buffer, cx: number, cy: number, p: Particle, a: number) {
  if (a <= 0.01) return;
  const reach = p.kind === "star" ? p.r * 1.25 : p.r * 2.4;
  const x0 = Math.max(0, Math.floor(cx - reach)), x1 = Math.min(SPARKLE_W - 1, Math.ceil(cx + reach));
  const y0 = Math.max(0, Math.floor(cy - reach)), y1 = Math.min(SPARKLE_H - 1, Math.ceil(cy + reach));
  const [cr, cg, cb] = p.rgb;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      let alpha: number;
      let mixWhite = 0;
      if (p.kind === "dot") {
        const d = Math.sqrt(dx * dx + dy * dy) / p.r;
        if (d > 2.4) continue;
        alpha = d <= 1 ? 1 - d * d * 0.35 : Math.exp(-((d - 1) * (d - 1)) * 3.2) * 0.65;
        mixWhite = d < 0.6 ? 0.6 : 0;
      } else {
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const along = Math.max(adx, ady), across = Math.min(adx, ady);
        const w = Math.max(1.1, p.r * 0.06);
        const ray = along < p.r * 1.25 ? Math.exp(-((across * across) / (w * w * 2))) * Math.pow(1 - along / (p.r * 1.25), 1.6) : 0;
        const d = Math.sqrt(dx * dx + dy * dy);
        const glow = Math.exp(-((d * d) / (p.r * p.r * 0.09))) * 0.85;
        const diag = Math.abs(Math.abs(dx) - Math.abs(dy)) < w * 1.2 && d < p.r * 0.55 ? (1 - d / (p.r * 0.55)) * 0.55 : 0;
        alpha = Math.max(ray, glow, diag);
        mixWhite = glow > 0.5 ? 0.75 : 0;
      }
      const o = a * alpha;
      if (o <= 0.01) continue;
      const i = (y * SPARKLE_W + x) * 4;
      const oa = Math.min(255, Math.round(o * 255));
      if (oa > buf[i + 3]) {
        buf[i] = Math.round(cr + (255 - cr) * mixWhite);
        buf[i + 1] = Math.round(cg + (255 - cg) * mixWhite);
        buf[i + 2] = Math.round(cb + (255 - cb) * mixWhite);
        buf[i + 3] = oa;
      }
    }
  }
}

function frameAt(buf: Buffer, parts: Particle[], t: number) {
  buf.fill(0);
  const TAU = Math.PI * 2;
  for (const p of parts) {
    let x = p.x + p.swayX * Math.sin(TAU * (p.swayCycles * t + p.swayPhase));
    let y = p.y + p.swayY * Math.sin(TAU * (p.swayCycles * t + p.swayPhase + 0.25));
    if (p.fall) y = (((y + p.fall * SPARKLE_H * t) % SPARKLE_H) + SPARKLE_H) % SPARKLE_H;
    // a flake that drifts off one edge comes back on the other, so no gaps appear
    x = ((x % SPARKLE_W) + SPARKLE_W) % SPARKLE_W;
    let a = p.base;
    if (p.twinkle > 0) {
      const s = 0.5 + 0.5 * Math.sin(TAU * (p.twinkle * t + p.phase));
      a = p.base * Math.pow(s, 2.2);
    }
    paint(buf, x, y, p, a);
  }
}

function runFfmpegFromFrames(outPath: string, total: number, draw: (n: number, buf: Buffer) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${SPARKLE_W}x${SPARKLE_H}`, "-r", String(SPARKLE_FPS), "-i", "pipe:0",
      "-c:v", "qtrle", "-pix_fmt", "argb", "-y", outPath,
    ]);
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`sparkle ffmpeg exited ${code}: ${err.slice(-400)}`))));
    (async () => {
      const buf = Buffer.alloc(SPARKLE_W * SPARKLE_H * 4);
      for (let n = 0; n < total; n++) {
        draw(n, buf);
        // Hand the frame over a copy, then wait if ffmpeg is still catching up
        if (!p.stdin.write(Buffer.from(buf))) await new Promise<void>((r) => p.stdin.once("drain", () => r()));
      }
      p.stdin.end();
    })().catch((e) => { p.kill("SIGKILL"); reject(e); });
  });
}

const cache = new Map<string, Promise<string>>();

// One overlay file per style and amount, made the first time it is asked for and kept for the life of the server.
export function sparkleOverlayFile(style: SparkleStyle, amount: SparkleAmount): Promise<string> {
  const key = `${style}-${amount}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const dir = join(tmpdir(), "sparkle-overlays-v1");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${key}.mov`);
    try {
      const s = await stat(file);
      if (s.size > 10_000) return file;
    } catch { /* not made yet */ }
    const parts = makeParticles(style, amount);
    const total = SPARKLE_FPS * SPARKLE_SECONDS;
    const tmp = join(dir, `${key}.${process.pid}.part.mov`);
    await runFfmpegFromFrames(tmp, total, (n, buf) => frameAt(buf, parts, n / total));
    const { rename } = await import("fs/promises");
    await rename(tmp, file);
    return file;
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
