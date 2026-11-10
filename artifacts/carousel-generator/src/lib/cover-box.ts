import { drawTitle, layoutTitle, titleHeight } from "./suite-fonts";
import { paintFor, isHexColour, flatHexOf } from "./metal-colours";

// A text box cover: the whole photo stays clear and the hook sits inside one coloured box that can go anywhere on the page.
// Shared by every client tool so the look is the same everywhere. Colours are a hex or a metallic finish ("metal:gold").
export type CoverBox = { fill: string; text?: string; x: number; y: number; w?: number };
export const DEFAULT_BOX: CoverBox = { fill: "#ffffff", x: 0.5, y: 0.5, w: 780 };

const lum = (h: string) => { const v = parseInt(h.slice(1), 16); return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function drawCoverBox(ctx: CanvasRenderingContext2D, o: { headline: string; box: CoverBox; tf: { lf: any; style: any } | null; headFont: string; ts?: number }) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const b = o.box;
  const ts = o.ts ?? 1;
  const bw = Math.max(460, Math.min(W - 80, b.w ?? 780));
  const pad = 56;
  const inner = bw - pad * 2;
  const flat = flatHexOf(b.fill, "#ffffff");
  const t: string = String(b.text ?? "");
  const textVal = t && (isHexColour(t) || (t as string).startsWith("metal:")) ? t : lum(flat) > 0.45 ? "#111111" : "#ffffff";
  let size = Math.round(96 * ts);
  let layout: ReturnType<typeof layoutTitle> | null = null;
  let lines: string[] = [];
  let lineH = 0;
  if (o.tf) {
    const make = (s: number) => layoutTitle(o.tf!.lf, o.headline, o.tf!.style, s, inner, 1.1);
    layout = make(size);
    while (size > Math.round(40 * ts) && titleHeight(layout) > 460) { size -= 4; layout = make(size); }
    lineH = titleHeight(layout);
  } else {
    ctx.font = `400 ${size}px "${o.headFont}", serif`;
    lines = wrapLines(ctx, o.headline, inner);
    while (size > 40 && lines.length * size * 1.1 > 460) { size -= 4; ctx.font = `400 ${size}px "${o.headFont}", serif`; lines = wrapLines(ctx, o.headline, inner); }
    lineH = lines.length * size * 1.1;
  }
  const bh = lineH + pad * 2;
  const bl = Math.max(20, Math.min(W - bw - 20, Math.round(b.x * W - bw / 2)));
  const bt = Math.max(20, Math.min(H - bh - 20, Math.round(b.y * H - bh / 2)));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = paintFor(ctx, b.fill, bl, bt, bw, bh);
  ctx.fillRect(bl, bt, bw, bh);
  ctx.restore();
  const ty = bt + pad;
  ctx.textBaseline = "top";
  if (o.tf && layout) {
    drawTitle(ctx, o.tf.lf, layout, o.tf.style, bl + pad, ty, "left", inner, paintFor(ctx, textVal, bl + pad, ty, inner, lineH));
  } else {
    ctx.fillStyle = paintFor(ctx, textVal, bl + pad, ty, inner, lineH);
    ctx.textAlign = "left";
    ctx.font = `400 ${size}px "${o.headFont}", serif`;
    lines.forEach((l, i) => ctx.fillText(l, bl + pad, ty + i * size * 1.1));
  }
  ctx.textAlign = "left";
}
