// The two About me poster templates Vanessa supplied (a cream editorial one and a peach vertical one), drawn on canvas
// so each clinic's own photo and bio drop straight in. Single 1080 x 1350 posts.
import { W, H } from "./tenfree-engine";

const HEAD = "Anton, 'Bebas Neue', Impact, sans-serif";

let loaded: Promise<unknown> | null = null;
export function loadAboutFonts(): Promise<unknown> {
  if (!loaded) {
    if (typeof document !== "undefined" && !document.getElementById("about-fonts")) {
      const l = document.createElement("link");
      l.id = "about-fonts";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Anton&family=Quicksand:wght@400;500&family=League+Spartan:ital,wght@0,400;0,500&family=Mrs+Saint+Delafield&display=swap";
      document.head.appendChild(l);
    }
    loaded = Promise.all(['40px Anton', '400 40px Quicksand', '400 40px "League Spartan"', '40px "Mrs Saint Delafield"'].map((f) => document.fonts.load(f).catch(() => []))).catch(() => undefined);
  }
  return loaded;
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number, focusY = 0.35) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y - (dh - h) * focusY, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function justified(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, w: number, lh: number) {
  lines.forEach((ln, i) => {
    const words = ln.split(" ");
    if (i === lines.length - 1 || words.length < 2) { ctx.textAlign = "left"; ctx.fillText(ln, x, y + i * lh); return; }
    const gap = (w - words.reduce((a, b) => a + ctx.measureText(b).width, 0)) / (words.length - 1);
    let cx = x;
    for (const wd of words) { ctx.fillText(wd, cx, y + i * lh); cx += ctx.measureText(wd).width + gap; }
  });
}

// Template 1: cream page, huge sage headline overlapping a tall photo, italic justified bio beside it.
function templateCream(photo: ImageBitmap, bio: string, headline: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#FFFFF5"; ctx.fillRect(0, 0, W, H);
  cover(ctx, photo, 108, 418, 448, 824, 0.3);
  // headline stretched to the page width
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#D9D9A8";
  ctx.font = `400 400px ${HEAD}`;
  const m = ctx.measureText(headline);
  const capH = m.actualBoundingBoxAscent;
  const tw = 900, th = 235;
  ctx.save();
  ctx.translate(12, 475);
  ctx.scale(tw / m.width, th / capH);
  ctx.fillText(headline, 0, 0);
  ctx.restore();
  // bio
  ctx.fillStyle = "#1c1c1c";
  let size = 29, lines: string[] = [];
  for (; size >= 20; size -= 1) {
    ctx.font = `italic 400 ${size}px "League Spartan", sans-serif`;
    lines = wrap(ctx, bio, 387);
    if (lines.length * size * 1.3 <= 640) break;
  }
  justified(ctx, lines, 585, 620, 387, size * 1.3);
  return c;
}

// Template 2: peach page, tall red headline running up the left, short bio top right, photo bottom right with the name signed across it.
function templatePeach(photo: ImageBitmap, bio: string, headline: string, name: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#E6BAA7"; ctx.fillRect(0, 0, W, H);
  // vertical headline, reading upwards
  ctx.fillStyle = "#C00423";
  ctx.font = `400 400px ${HEAD}`;
  const m = ctx.measureText(headline);
  const capH = m.actualBoundingBoxAscent;
  ctx.save();
  ctx.translate(440, H - 40);
  ctx.rotate(-Math.PI / 2);
  ctx.scale((H - 100) / m.width, 345 / capH);
  ctx.fillText(headline, 0, 0);
  ctx.restore();
  // photo with a soft shadow, bleeding off the bottom right
  const px = 410, py = 340, pw = W - px, ph = H - py, r = 220;
  ctx.save();
  ctx.shadowColor = "rgba(60,20,10,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetX = -10; ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.moveTo(px + r, py); ctx.lineTo(W, py); ctx.lineTo(W, H); ctx.lineTo(px, H); ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.closePath();
  ctx.fillStyle = "#000"; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px + r, py); ctx.lineTo(W, py); ctx.lineTo(W, H); ctx.lineTo(px, H); ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.closePath();
  ctx.clip();
  cover(ctx, photo, px, py, pw, ph, 0.25);
  ctx.restore();
  // bio
  ctx.fillStyle = "#3b1a12";
  ctx.textBaseline = "alphabetic";
  let size = 31, lines: string[] = [];
  for (; size >= 22; size -= 1) {
    ctx.font = `400 ${size}px Quicksand, sans-serif`;
    lines = wrap(ctx, bio, 560);
    if (lines.length * size * 1.25 <= 250) break;
  }
  lines.forEach((ln, i) => ctx.fillText(ln, 483, 90 + i * size * 1.25));
  // signature
  if (name) {
    ctx.save();
    ctx.fillStyle = "#F4F0EC";
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 8;
    let fs = 130;
    ctx.font = `${fs}px "Mrs Saint Delafield", cursive`;
    while (ctx.measureText(name).width > 560 && fs > 60) { fs -= 4; ctx.font = `${fs}px "Mrs Saint Delafield", cursive`; }
    ctx.fillText(name, 520, H - 170);
    ctx.restore();
  }
  return c;
}

export type AboutLayout = "cream" | "peach";
export async function renderAboutPost(o: { layout: AboutLayout; photo: ImageBitmap; bio: string; name: string; headline?: string }): Promise<HTMLCanvasElement> {
  await loadAboutFonts();
  const head = o.headline || "ABOUT ME";
  return o.layout === "cream" ? templateCream(o.photo, o.bio, head) : templatePeach(o.photo, o.bio, head, o.name);
}
