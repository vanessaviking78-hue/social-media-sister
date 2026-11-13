// Draws one Freehouse slide. Freehouse (the page and every Freehouse client) uses a single layout: a full bleed photo
// with the writing on a gradient, in a text box or on a block. Nothing else.

export const HW = 1080;
export const HH = 1350;
export const FREEHOUSE_BLUE = "#00e5ff";
export const FREEHOUSE_HIVIS = "#00e5ff";

export type FreehouseStyle = "gradient" | "box" | "block";
export type SlideKind = "hook" | "body" | "cta";

export type SlideLook = {
  style: FreehouseStyle;
  colour: string; // block or box fill, or the gradient colour
  textColour: "hivis" | "auto" | "white" | "black";
  headFamily: string; // canvas font family for hooks and closing lines
  bodyFamily: string;
  upper: boolean;
  textScale: number; // 0.6 to 1.5
  boxY: number; // 0 top to 1 bottom, for the text box
};

export type SlidePhoto = { bmp: ImageBitmap | null; zoom: number; panX: number; panY: number };

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function drawPhoto(ctx: CanvasRenderingContext2D, p: SlidePhoto) {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, HW, HH);
  if (!p.bmp) return;
  const s = Math.max(HW / p.bmp.width, HH / p.bmp.height) * Math.max(1, p.zoom || 1);
  const w = p.bmp.width * s;
  const h = p.bmp.height * s;
  // pan moves the photo within the room the zoom leaves over, so an edge never shows
  const roomX = Math.max(0, w - HW) / 2;
  const roomY = Math.max(0, h - HH) / 2;
  const x = (HW - w) / 2 - (p.panX || 0) * roomX;
  const y = (HH - h) / 2 - (p.panY || 0) * roomY;
  ctx.drawImage(p.bmp, x, y, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Finds the biggest font size that fits the text in the room, then lays the lines out. */
function fit(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, maxW: number, maxH: number, start: number, min: number, lead: number) {
  let size = start;
  for (;;) {
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
    const lines = wrap(ctx, text, maxW);
    const h = lines.length * size * lead;
    if (h <= maxH || size <= min) return { size, lines, lead };
    size -= 2;
  }
}

export function drawFreehouseSlide(canvas: HTMLCanvasElement, kind: SlideKind, text: string, photo: SlidePhoto, look: SlideLook, logo: ImageBitmap | null, handle: string) {
  canvas.width = HW;
  canvas.height = HH;
  const ctx = canvas.getContext("2d")!;
  drawPhoto(ctx, photo);

  const isHead = kind !== "body";
  const family = isHead ? look.headFamily : look.bodyFamily;
  const weight = isHead ? 400 : 600;
  const raw = (text || "").trim();
  const str = isHead && look.upper ? raw.toUpperCase() : raw;
  const scale = look.textScale || 1;
  const start = (kind === "hook" ? 92 : kind === "cta" ? 84 : 54) * scale;
  const pad = 70;
  const lead = isHead ? 1.08 : 1.34;

  // text colour: on a block or box it follows the fill, on a gradient it follows the gradient
  const fillForText = look.style === "gradient" ? look.colour : look.colour;
  const autoText = look.style === "gradient" ? (lum(fillForText) > 0.5 ? "#111111" : "#ffffff") : lum(fillForText) > 0.4 ? "#111111" : "#ffffff";
  // high vis yellow writing, but on a pale or yellow fill it would vanish, so it drops to black there
  const hiVis = lum(fillForText) > 0.4 ? "#111111" : FREEHOUSE_HIVIS;
  const textCol = look.textColour === "hivis" ? hiVis : look.textColour === "white" ? "#ffffff" : look.textColour === "black" ? "#111111" : autoText;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  if (look.style === "gradient") {
    const maxH = HH * 0.55;
    const f = fit(ctx, str, family, weight, HW - pad * 2, maxH, start, 28, lead);
    const textH = f.lines.length * f.size * f.lead;
    const top = HH - pad - textH - (kind === "cta" && handle ? 46 : 0);
    const g = ctx.createLinearGradient(0, Math.max(0, top - 330), 0, HH);
    g.addColorStop(0, rgba(look.colour, 0));
    g.addColorStop(0.45, rgba(look.colour, 0.92));
    g.addColorStop(1, rgba(look.colour, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, top - 330), HW, HH);
    ctx.fillStyle = textCol;
    ctx.font = `${weight} ${f.size}px "${family}", sans-serif`;
    f.lines.forEach((l, i) => ctx.fillText(l, pad, top + i * f.size * f.lead));
  } else if (look.style === "block") {
    const maxH = HH * 0.5;
    const f = fit(ctx, str, family, weight, HW - pad * 2, maxH, start, 28, lead);
    const textH = f.lines.length * f.size * f.lead;
    const blockH = Math.min(HH, textH + pad * 2 + (kind === "cta" && handle ? 46 : 0));
    ctx.fillStyle = look.colour;
    ctx.fillRect(0, HH - blockH, HW, blockH);
    ctx.fillStyle = textCol;
    ctx.font = `${weight} ${f.size}px "${family}", sans-serif`;
    f.lines.forEach((l, i) => ctx.fillText(l, pad, HH - blockH + pad + i * f.size * f.lead));
  } else {
    // text box: a solid box with a hard black edge, placed anywhere from top to bottom
    const boxW = HW - 120;
    const inner = boxW - 90;
    const f = fit(ctx, str, family, weight, inner, HH * 0.5, start * 0.92, 26, lead);
    const textH = f.lines.length * f.size * f.lead;
    const boxH = textH + 90;
    const maxTop = HH - 60 - boxH;
    const top = 60 + Math.max(0, maxTop - 60) * Math.min(1, Math.max(0, look.boxY));
    const left = 60;
    ctx.fillStyle = "#111111";
    ctx.fillRect(left + 12, top + 12, boxW, boxH);
    ctx.fillStyle = look.colour;
    ctx.fillRect(left, top, boxW, boxH);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#111111";
    ctx.strokeRect(left, top, boxW, boxH);
    ctx.fillStyle = textCol;
    ctx.font = `${weight} ${f.size}px "${family}", sans-serif`;
    f.lines.forEach((l, i) => ctx.fillText(l, left + 45, top + 45 + i * f.size * f.lead));
  }

  if (kind === "cta" && handle) {
    ctx.font = `700 26px "Montserrat", sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = look.style === "gradient" ? "#ffffff" : look.style === "block" ? textCol : "#ffffff";
    if (look.style === "box") {
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 8;
    }
    ctx.fillText(`@${handle.replace(/^@/, "").toUpperCase()}`, pad, HH - 34);
    ctx.shadowBlur = 0;
  }

  if (logo) {
    const maxW = 230;
    const maxH = 120;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    ctx.drawImage(logo, 50, 50, logo.width * s, logo.height * s);
  }
}
