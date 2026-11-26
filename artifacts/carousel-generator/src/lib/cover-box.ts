import { drawTitle, layoutTitle, titleHeight } from "./suite-fonts";
import { paintFor, isHexColour, flatHexOf } from "./metal-colours";

// A text box cover: the whole photo stays clear and the hook sits inside one coloured box that can go anywhere on the page.
// Shared by every client tool so the look is the same everywhere. Colours are a hex or a metallic finish ("metal:gold").
export type CoverBox = { fill: string; text?: string; x: number; y: number; w?: number; tight?: boolean; outline?: string; outlineW?: number }; // tight: a floating box only as big as the words. outline: a border colour (hex or metal), outlineW: its thickness in pixels

// The outline sits just inside the edge of the box, so the box keeps its size and the line is never cut off at the edge of the post.
function strokeBox(ctx: CanvasRenderingContext2D, b: CoverBox, l: number, t: number, w: number, h: number) {
  if (!b.outline) return;
  const lw = Math.max(2, Math.round(b.outlineW ?? 6));
  ctx.save();
  ctx.strokeStyle = paintFor(ctx, b.outline, l, t, w, h);
  ctx.lineWidth = lw;
  ctx.lineJoin = "miter";
  ctx.strokeRect(l + lw / 2, t + lw / 2, w - lw, h - lw);
  ctx.restore();
}
export const DEFAULT_BOX: CoverBox = { fill: "#ffffff", x: 0.5, y: 0.78, w: 780 }; // sits in the lower part of the post

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

export function drawCoverBox(ctx: CanvasRenderingContext2D, o: { headline: string; box: CoverBox; tf: { lf: any; style: any } | null; headFont: string; ts?: number; sub?: string; subFont?: string }) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const b = o.box;
  const ts = o.ts ?? 1;
  const tight = !!b.tight;
  const maxBw = Math.max(460, Math.min(W - 80, b.w ?? 780));
  const pad = tight ? 26 : 56;
  let bw = maxBw;
  let inner = bw - pad * 2;
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
  let subLines: string[] = [];
  const subPx = 34;
  if (o.sub) { ctx.font = `400 ${subPx}px "${o.subFont ?? o.headFont}", sans-serif`; subLines = wrapLines(ctx, o.sub, inner); }
  const subH = subLines.length ? 28 + subLines.length * subPx * 1.35 : 0;
  if (tight) { drawTightBox(ctx, { W, H, b, size, ts, layout, lines, subLines, subPx, o, textVal, pad: Math.round(30 * ts) }); return; }
  if (tight) {
    // shrink the box round the widest line of words
    let widest = 0;
    if (o.tf && layout) widest = Math.max(...layout.lines.map((l) => l.width));
    else { ctx.font = `400 ${size}px "${o.headFont}", serif`; widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width)); }
    if (subLines.length) { ctx.font = `400 ${subPx}px "${o.subFont ?? o.headFont}", sans-serif`; widest = Math.max(widest, ...subLines.map((l) => ctx.measureText(l).width)); }
    bw = Math.min(maxBw, Math.ceil(widest) + pad * 2 + 4);
    inner = bw - pad * 2;
  }
  const bh = lineH + subH + pad * 2;
  const bl = Math.max(20, Math.min(W - bw - 20, Math.round(b.x * W - bw / 2)));
  const bt = Math.max(20, Math.min(H - bh - 20, Math.round(b.y * H - bh / 2)));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = paintFor(ctx, b.fill, bl, bt, bw, bh);
  ctx.fillRect(bl, bt, bw, bh);
  ctx.restore();
  strokeBox(ctx, b, bl, bt, bw, bh);
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
  if (subLines.length) {
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `400 ${subPx}px "${o.subFont ?? o.headFont}", sans-serif`;
    ctx.fillStyle = paintFor(ctx, textVal, bl + pad, ty + lineH, inner, subH);
    subLines.forEach((l, i) => ctx.fillText(l, bl + pad, ty + lineH + 28 + i * subPx * 1.35));
  }
  ctx.textAlign = "left";
}

// Floating box: behaves like a Canva text box. The box is the real ink size of the words plus the same gap on every side,
// sitting directly behind the text (no extra line height, no shadow), so nothing looks off centre or justified.
function drawTightBox(ctx: CanvasRenderingContext2D, a: { W: number; H: number; b: CoverBox; size: number; ts: number; layout: ReturnType<typeof layoutTitle> | null; lines: string[]; subLines: string[]; subPx: number; o: { headline: string; tf: { lf: any; style: any } | null; headFont: string; subFont?: string }; textVal: string; pad: number }) {
  const { W, H, b, size, layout, lines, subLines, subPx, o, textVal } = a;
  const pad = a.pad + (b.outline ? Math.max(2, Math.round(b.outlineW ?? 6)) : 0); // the outline takes its own room, so the gap round the words stays the same
  const subFont = `400 ${subPx}px "${o.subFont ?? o.headFont}", sans-serif`;
  const headFont = `400 ${size}px "${o.headFont}", serif`;
  // ink bounds of the headline, relative to the point it is drawn from (x = left, y = top of first line)
  let iL = 0, iR = 0, iT = 0, iB = 0;
  if (o.tf && layout) {
    const lf = o.tf.lf, st = o.tf.style;
    const scale = layout.size / lf.font.unitsPerEm;
    const asc = (lf.font.ascender || lf.font.unitsPerEm * 0.8) * scale;
    const trackPx = (st.tracking / 1000) * layout.size;
    const space = (lf.font.charToGlyph(" ").advanceWidth || lf.font.unitsPerEm * 0.3) * scale + trackPx;
    iL = Infinity; iR = -Infinity; iT = Infinity; iB = -Infinity;
    layout.lines.forEach((line, li) => {
      const base = li * layout.size * layout.lineHeight + asc * 0.92;
      let cx = 0;
      for (const w of line.words) {
        for (const it of w.items) {
          const bb = it.g.getBoundingBox();
          if (!isFinite(bb.x1) || bb.x2 - bb.x1 <= 0) continue; // spaces and empty glyphs
          iL = Math.min(iL, cx + it.x + bb.x1 * scale);
          iR = Math.max(iR, cx + it.x + bb.x2 * scale);
          iT = Math.min(iT, base - bb.y2 * scale);
          iB = Math.max(iB, base - bb.y1 * scale);
        }
        cx += w.width + space;
      }
    });
    if (!isFinite(iL)) { iL = 0; iR = layout.lines[0]?.width ?? 0; iT = 0; iB = titleHeight(layout); }
  } else {
    ctx.font = headFont;
    iL = Infinity; iR = -Infinity;
    lines.forEach((l) => { const m = ctx.measureText(l); iL = Math.min(iL, -m.actualBoundingBoxLeft); iR = Math.max(iR, m.actualBoundingBoxRight); });
    if (!isFinite(iL)) { iL = 0; iR = 0; }
    ctx.textBaseline = "alphabetic";
    const m0 = ctx.measureText(lines[0] ?? "M");
    const lh = size * 1.1;
    iT = lh * 0.8 - m0.actualBoundingBoxAscent;
    const mLast = ctx.measureText(lines[lines.length - 1] ?? "M");
    iB = (lines.length - 1) * lh + lh * 0.8 + mLast.actualBoundingBoxDescent;
  }
  let headW = iR - iL, headH = iB - iT;
  // optional subtitle, sitting a small gap under the headline
  let subW = 0, subTop = 0, subH = 0, subL = 0;
  const sGap = subLines.length ? Math.round(subPx * 0.6) : 0;
  if (subLines.length) {
    ctx.font = subFont;
    subL = Infinity; let r = -Infinity;
    subLines.forEach((l) => { const m = ctx.measureText(l); subL = Math.min(subL, -m.actualBoundingBoxLeft); r = Math.max(r, m.actualBoundingBoxRight); });
    subW = r - subL;
    subTop = headH + sGap;
    subH = (subLines.length - 1) * subPx * 1.35 + subPx * 0.75;
  }
  const contentW = Math.max(headW, subW);
  const contentH = headH + (subLines.length ? sGap + subH : 0);
  const bw = Math.ceil(contentW + pad * 2);
  const bh = Math.ceil(contentH + pad * 2);
  const bl = Math.max(20, Math.min(W - bw - 20, Math.round(b.x * W - bw / 2)));
  const bt = Math.max(20, Math.min(H - bh - 20, Math.round(b.y * H - bh / 2)));
  ctx.save();
  ctx.fillStyle = paintFor(ctx, b.fill, bl, bt, bw, bh);
  ctx.fillRect(bl, bt, bw, bh);
  ctx.restore();
  strokeBox(ctx, b, bl, bt, bw, bh);
  // words sit dead centre in the box: equal gap left and right, top and bottom
  const hx = bl + pad + (contentW - headW) / 2 - iL; // draw origin x for the headline
  const hy = bt + pad - iT; // draw origin y (top of first line)
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const headPaint = paintFor(ctx, textVal, bl + pad, bt + pad, contentW, headH);
  if (o.tf && layout) {
    drawTitle(ctx, o.tf.lf, layout, o.tf.style, hx, hy, "left", contentW, headPaint);
  } else {
    ctx.fillStyle = headPaint;
    ctx.font = headFont;
    ctx.textBaseline = "alphabetic";
    lines.forEach((l, i) => ctx.fillText(l, hx, hy + i * size * 1.1 + size * 1.1 * 0.8));
  }
  if (subLines.length) {
    const sx = bl + pad + (contentW - subW) / 2 - subL;
    const sTop = bt + pad + subTop;
    ctx.font = subFont;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = paintFor(ctx, textVal, bl + pad, sTop, contentW, subH);
    subLines.forEach((l, i) => ctx.fillText(l, sx, sTop + subPx * 0.75 + i * subPx * 1.35));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}
