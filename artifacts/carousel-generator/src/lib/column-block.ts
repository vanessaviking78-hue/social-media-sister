import { drawTitle, layoutTitle, titleHeight } from "./suite-fonts";

// The column block style: a solid column down the left of the tile with the words fitted inside it.
export const COL_W = 450;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export function drawColumn(ctx: CanvasRenderingContext2D, o: {
  text: string; paint: () => void; ink: string | CanvasGradient; font: (px: number) => string;
  tf?: { lf: any; style: any } | null; maxPx: number; minPx: number; lead: number; sub?: string; subFont?: (px: number) => string;
}) {
  const H = ctx.canvas.height;
  const pad = 46;
  const inner = COL_W - pad * 2;
  const maxH = H - 260;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, COL_W, H); ctx.clip();
  o.paint();
  ctx.restore();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  // the sub line (if any) sits under the words in a smaller size
  let subLines: string[] = [];
  const subPx = 28;
  if (o.sub && o.subFont) { ctx.font = o.subFont(subPx); subLines = wrap(ctx, o.sub, inner); }
  const subH = subLines.length ? 22 + subLines.length * subPx * 1.35 : 0;
  const room = maxH - subH;
  let top: number;
  if (o.tf) {
    let size = o.maxPx;
    let lay = layoutTitle(o.tf.lf, o.text, o.tf.style, size, inner, o.lead);
    while (size > o.minPx && (titleHeight(lay) > room || lay.lines.some((l) => l.width > inner))) { size -= 3; lay = layoutTitle(o.tf.lf, o.text, o.tf.style, size, inner, o.lead); }
    const h = titleHeight(lay);
    top = Math.round((H - h - subH) / 2);
    drawTitle(ctx, o.tf.lf, lay, o.tf.style, pad, top, "left", inner, o.ink);
    top += h;
  } else {
    let px = o.maxPx;
    let lines: string[] = [];
    for (;;) {
      ctx.font = o.font(px);
      lines = wrap(ctx, o.text, inner);
      const tooWide = lines.some((l) => ctx.measureText(l).width > inner);
      if ((lines.length * px * o.lead <= room && !tooWide) || px <= o.minPx) break;
      px -= 2;
    }
    const h = lines.length * px * o.lead;
    top = Math.round((H - h - subH) / 2);
    ctx.fillStyle = o.ink;
    ctx.font = o.font(px);
    lines.forEach((l, i) => ctx.fillText(l, pad, top + i * px * o.lead));
    top += h;
  }
  if (subLines.length && o.subFont) {
    ctx.fillStyle = o.ink;
    ctx.font = o.subFont(subPx);
    subLines.forEach((l, i) => ctx.fillText(l, pad, top + 22 + i * subPx * 1.35));
  }
  ctx.textAlign = "left";
}
