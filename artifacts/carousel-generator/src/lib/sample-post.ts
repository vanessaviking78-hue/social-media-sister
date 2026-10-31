// The portrait post look (Stylish and magazine) used by the free sample, copied out of the Free Sample page so the
// Post Pack can draw it without touching that tool. Titles use Instrument Serif and subtitles use Montserrat.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const W = 1080;
const H = 1350;
void BASE;

export type PortraitPost = { look: "stylish" | "magazine"; headline: string; subtitle: string; zoom: boolean; photo: HTMLImageElement };

export type Palette = { band: string; rule: string; ink: string; sub: string; accentHex: string; tile: string };

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
}
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load an image"));
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}


export async function prepareLogo(file: File): Promise<{ logo: HTMLCanvasElement; palette: Palette }> {
  const img = await loadImage(await fileToDataUrl(file));
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const corner = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const cs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const transparent = cs.every((p) => p[3] < 40);
  const bg = transparent ? [255, 255, 255] : [0, 1, 2].map((k) => Math.round(cs.reduce((a, p) => a + p[k], 0) / 4));

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 40) continue;
      const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 60) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const mx = Math.max(data[i], data[i + 1], data[i + 2]);
        const mn = Math.min(data[i], data[i + 1], data[i + 2]);
        if (mx - mn > 28 && mx < 235) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }
  const padX = Math.round((maxX - minX) * 0.05) + 6;
  const padY = Math.round((maxY - minY) * 0.08) + 6;
  const x0 = Math.max(0, minX - padX), y0 = Math.max(0, minY - padY);
  const x1 = Math.min(w, maxX + padX), y1 = Math.min(h, maxY + padY);
  const logo = document.createElement("canvas");
  logo.width = x1 - x0;
  logo.height = y1 - y0;
  const lctx = logo.getContext("2d")!;
  lctx.fillStyle = rgb(bg);
  lctx.fillRect(0, 0, logo.width, logo.height);
  lctx.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);

  const accent = count > 40 ? [Math.round(r / count), Math.round(g / count), Math.round(b / count)] : [150, 120, 105];
  const accentDark = mix(accent, [0, 0, 0], 0.18);
  return {
    logo,
    palette: {
      band: rgb(mix(accent, [255, 255, 255], 0.84)),
      rule: rgb(accentDark),
      ink: rgb(mix(accent, [0, 0, 0], 0.84)),
      sub: rgb(mix(accent, [0, 0, 0], 0.66)),
      accentHex: hex(mix(accent, [0, 0, 0], 0.32)),
      tile: rgb(bg),
    },
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const SERIF = '"Instrument Serif", "DM Serif Display", Georgia, serif';
export const SANS = '"Montserrat", "Poppins", system-ui, sans-serif';

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxw: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width <= maxw) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, maxw: number, maxh: number, start: number, min: number, spacing: number) {
  let size = start;
  while (size >= min) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, text, maxw);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxw);
    if (fits && lines.length * size * spacing <= maxh) return { lines, size };
    size -= 2;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return { lines: wrapLines(ctx, text, maxw), size: min };
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, top: number, zoom: boolean) {
  if (zoom) {
    const sx = img.width * 0.279;
    const sy = img.height * 0.172;
    const sw = img.width * 0.72;
    const sh = (sw * H) / W;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return;
  }
  const availH = H - top;
  const scale = Math.max(W / img.width, availH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, W, availH);
  ctx.clip();
  ctx.drawImage(img, (W - dw) / 2, top, dw, dh);
  ctx.restore();
}

function drawLogoTile(ctx: CanvasRenderingContext2D, logo: HTMLCanvasElement, palette: Palette, xRight: number, yTop: number, tileH: number): number {
  const pad = 10;
  const lh = tileH - 2 * pad;
  const lw = Math.round((lh * logo.width) / logo.height);
  const tw = lw + 2 * pad;
  ctx.save();
  roundRect(ctx, xRight - tw, yTop, tw, tileH, 14);
  ctx.fillStyle = palette.tile;
  ctx.fill();
  ctx.clip();
  ctx.drawImage(logo, xRight - tw + pad, yTop + pad, lw, lh);
  ctx.restore();
  return tw;
}

export function renderPost(post: PortraitPost, logo: HTMLCanvasElement, palette: Palette, mastheadArea: string): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  const headline = post.headline.trim();
  const subtitle = post.subtitle.trim();

  if (post.look === "stylish") {
    drawPhoto(ctx, post.photo, 0, post.zoom);
    const bandH = 400;
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, H - bandH, W, bandH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, H - bandH, W, 6);
    const pad = 70;
    const maxw = W - 2 * pad;
    const hl = fitText(ctx, headline, SERIF, "400", maxw, 210, 140, 70, 1.08);
    let y = H - bandH + 44;
    ctx.fillStyle = palette.ink;
    ctx.font = `400 ${hl.size}px ${SERIF}`;
    for (const line of hl.lines) {
      ctx.fillText(line, pad, y + hl.size * 0.82);
      y += Math.round(hl.size * 1.08);
    }
    const sl = fitText(ctx, subtitle, SANS, "600", maxw, 120, 46, 30, 1.25);
    y += 14;
    ctx.fillStyle = palette.sub;
    ctx.font = `600 ${sl.size}px ${SANS}`;
    for (const line of sl.lines) {
      ctx.fillText(line, pad, y + sl.size * 0.85);
      y += Math.round(sl.size * 1.25);
    }
    drawLogoTile(ctx, logo, palette, W - 40, 40, 190);
  } else {
    const stripH = 170;
    drawPhoto(ctx, post.photo, stripH, post.zoom);
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, 0, W, stripH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, stripH, W, 4);
    const tw = drawLogoTile(ctx, logo, palette, W - 30, 10, stripH - 20);
    const mastText = `THE ${mastheadArea.toUpperCase()} EDIT`;
    const mastMax = W - tw - 30 - 50 - 30;
    let ms = 40;
    ctx.font = `400 ${ms}px ${SERIF}`;
    while (ctx.measureText(mastText).width > mastMax && ms > 20) {
      ms -= 2;
      ctx.font = `400 ${ms}px ${SERIF}`;
    }
    ctx.fillStyle = palette.ink;
    ctx.fillText(mastText, 50, stripH / 2 + ms * 0.32);

    const cardW = 880;
    const inner = cardW - 100;
    const hl = fitText(ctx, headline, SERIF, "400", inner, 260, 120, 60, 1.08);
    const sl = fitText(ctx, subtitle, SANS, "500", inner, 100, 38, 26, 1.25);
    const cardH = 44 + Math.round(hl.lines.length * hl.size * 1.08) + 24 + Math.round(sl.lines.length * sl.size * 1.25) + 44;
    const y0 = H - cardH - 70;
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, y0, cardW, cardH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, y0, 12, cardH);
    let y = y0 + 44;
    ctx.fillStyle = palette.ink;
    ctx.font = `400 ${hl.size}px ${SERIF}`;
    for (const line of hl.lines) {
      ctx.fillText(line, 56, y + hl.size * 0.82);
      y += Math.round(hl.size * 1.08);
    }
    ctx.fillStyle = palette.rule;
    ctx.fillRect(56, y + 6, 90, 3);
    y += 24;
    ctx.fillStyle = palette.sub;
    ctx.font = `500 ${sl.size}px ${SANS}`;
    for (const line of sl.lines) {
      ctx.fillText(line, 56, y + sl.size * 0.85);
      y += Math.round(sl.size * 1.25);
    }
  }
  return c.toDataURL("image/jpeg", 0.92);
}

export function dataUrlToBlob(url: string): Blob {
  const [head, body] = url.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function hexToRgb(h: string): number[] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Posts follow the clinic's own brand colours when they gave them.
export function brandPalette(h: string, base: Palette): Palette {
  const accent = hexToRgb(h);
  return {
    band: rgb(mix(accent, [255, 255, 255], 0.84)),
    rule: rgb(mix(accent, [0, 0, 0], 0.18)),
    ink: rgb(mix(accent, [0, 0, 0], 0.84)),
    sub: rgb(mix(accent, [0, 0, 0], 0.66)),
    accentHex: hex(mix(accent, [0, 0, 0], 0.32)),
    tile: base.tile,
  };
}

const FALLBACK_PALETTE: Palette = {
  band: rgb(mix([150, 120, 105], [255, 255, 255], 0.84)),
  rule: rgb(mix([150, 120, 105], [0, 0, 0], 0.18)),
  ink: rgb(mix([150, 120, 105], [0, 0, 0], 0.84)),
  sub: rgb(mix([150, 120, 105], [0, 0, 0], 0.66)),
  accentHex: hex(mix([150, 120, 105], [0, 0, 0], 0.32)),
  tile: "rgb(255,252,251)",
};

// With no logo, the clinic name stands in for it so the posts still have a corner mark.
export function textLogo(name: string): { logo: HTMLCanvasElement; palette: Palette } {
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 240;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(255,252,251)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#3a2a25";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 90;
  ctx.font = `400 ${size}px ${SERIF}`;
  while (ctx.measureText(name).width > 640 && size > 28) {
    size -= 4;
    ctx.font = `400 ${size}px ${SERIF}`;
  }
  ctx.fillText(name, 360, 120);
  return { logo: c, palette: FALLBACK_PALETTE };
}

