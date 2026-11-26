import { flatHexOf } from "./metal-colours";

// Bows: a real satin ribbon and bow laid over a finished slide, in any colour, with a soft shadow so it lifts off the post.
// The ribbons are grey satin photographs with the background cut out. Recolouring keeps every fold, shadow and highlight, so a
// red, navy or gold bow all look like real satin and nothing looks flat. Used the same way as Sparkle: a switch, then the pickers.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export type RibbonId = "horizontal" | "vertical" | "diagonal" | "corner";
export const RIBBON_LABELS: Record<RibbonId, string> = { horizontal: "Across", vertical: "Down", diagonal: "Diagonal", corner: "Corner" };
export const RIBBON_IDS = Object.keys(RIBBON_LABELS) as RibbonId[];
export const ribbonUrl = (id: RibbonId) => `${BASE}/bows/${id}.png`;

export type BowChoice = {
  on: boolean;
  ribbon: RibbonId;
  color: string; // hex, or a metallic finish such as "metal:gold" (the ribbon takes the metal's main colour)
  size: number; // 0.6 to 1.6 times the standard size
  dx: number; // moves the bow left or right, as a share of the post width
  dy: number; // moves the bow up or down, as a share of the post height
  all: boolean; // false: the cover only. true: every slide
};

export const DEFAULT_BOW: BowChoice = { on: false, ribbon: "horizontal", color: "#c1121f", size: 1, dx: 0, dy: 0, all: false };
const KEY = "bows-choice-v1";

export function loadBowChoice(): BowChoice {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      on: r.on === true,
      ribbon: RIBBON_IDS.includes(r.ribbon) ? r.ribbon : DEFAULT_BOW.ribbon,
      color: typeof r.color === "string" && r.color ? r.color : DEFAULT_BOW.color,
      size: typeof r.size === "number" ? Math.min(1.6, Math.max(0.6, r.size)) : 1,
      dx: typeof r.dx === "number" ? Math.min(0.5, Math.max(-0.5, r.dx)) : 0,
      dy: typeof r.dy === "number" ? Math.min(0.5, Math.max(-0.5, r.dy)) : 0,
      all: r.all === true,
    };
  } catch {
    return { ...DEFAULT_BOW };
  }
}
export function saveBowChoice(c: BowChoice) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

const imgCache = new Map<RibbonId, Promise<HTMLImageElement>>();
function loadRibbon(id: RibbonId): Promise<HTMLImageElement> {
  let p = imgCache.get(id);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => { imgCache.delete(id); rej(new Error("The bow image could not load")); };
      im.src = ribbonUrl(id);
    });
    imgCache.set(id, p);
  }
  return p;
}

// Satin recolour. The grey of the photo is the light: mid grey becomes the pure colour, shadows go deeper and highlights lift towards white.
const tintCache = new Map<string, HTMLCanvasElement>();
async function tinted(id: RibbonId, hex: string): Promise<HTMLCanvasElement> {
  const key = `${id}|${hex}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const im = await loadRibbon(id);
  const c = document.createElement("canvas");
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const v = parseInt(hex.slice(1), 16);
  const R = (v >> 16) & 255, G = (v >> 8) & 255, B = v & 255;
  const PIVOT = 0.56;
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    if (l < PIVOT) {
      const k = l / PIVOT;
      px[i] = R * k; px[i + 1] = G * k; px[i + 2] = B * k;
    } else {
      const k = Math.min(1, (l - PIVOT) / (1 - PIVOT)) * 0.92;
      px[i] = R + (255 - R) * k; px[i + 1] = G + (255 - G) * k; px[i + 2] = B + (255 - B) * k;
    }
  }
  x.putImageData(d, 0, 0);
  if (tintCache.size > 24) tintCache.clear();
  tintCache.set(key, c);
  return c;
}

export type ReadyBow = { choice: BowChoice; img: HTMLCanvasElement };

// Load and recolour the bow once, before drawing slides. Returns null when the bow is switched off.
export async function prepareBow(choice: BowChoice | null | undefined): Promise<ReadyBow | null> {
  if (!choice?.on) return null;
  const hex = flatHexOf(choice.color, "#c1121f");
  return { choice, img: await tinted(choice.ribbon, hex) };
}

// Where the knot of each bow sits inside its square picture, as a share of the picture, and how big the picture is on the post.
const KNOT: Record<RibbonId, { kx: number; ky: number }> = {
  horizontal: { kx: 0.5, ky: 0.37 },
  vertical: { kx: 0.5, ky: 0.33 },
  diagonal: { kx: 0.51, ky: 0.36 },
  corner: { kx: 0.79, ky: 0.56 },
};

// Lays the bow over the slide. n is the slide number, so the bow can stay on the cover only.
export function drawBow(ctx: CanvasRenderingContext2D, bow: ReadyBow | null, n = 0) {
  if (!bow || (!bow.choice.all && n > 0)) return;
  const { choice, img } = bow;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const base = choice.ribbon === "vertical" ? H * 1.1 : choice.ribbon === "diagonal" ? Math.max(W, H) : choice.ribbon === "corner" ? W * 1.15 : W;
  const S = base * choice.size;
  const { kx, ky } = KNOT[choice.ribbon];
  let left: number, top: number;
  if (choice.ribbon === "corner") {
    left = W - S + choice.dx * W; top = H - S + choice.dy * H; // tucked into the bottom right corner
  } else if (choice.ribbon === "horizontal") {
    left = W * (0.5 + choice.dx) - kx * S; top = H * (0.62 + choice.dy) - ky * S;
  } else if (choice.ribbon === "vertical") {
    left = W * (0.5 + choice.dx) - kx * S; top = H * (0.35 + choice.dy) - ky * S; // the ribbon runs off the top of the post
  } else {
    left = W * (0.5 + choice.dx) - kx * S; top = H * (0.5 + choice.dy) - ky * S;
  }
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = S * 0.035;
  ctx.shadowOffsetX = S * 0.006;
  ctx.shadowOffsetY = S * 0.014;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, left, top, S, S);
  ctx.restore();
}
