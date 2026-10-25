// Small drawing helpers shared by the Unique layouts: stamps, pins, redaction bars, backgrounds.
import { HU, XH, XW, rand, rgba, shade, textBox, drawPhoto, type G } from "./xmas-designs";

export const tx = (g: G, k: string) => g.t[k] ?? "";
export const up = (g: G, k: string) => HU(g, g.t[k] ?? "");

// A rectangular rubber stamp with a double border, tilted. Text is centred inside.
export function stampBox(g: G, cx: number, cy: number, w: number, h: number, rot: number, text: string, colour: string, max = 56, o?: { alpha?: number; fill?: string }) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.globalAlpha = o?.alpha ?? 0.9;
  if (o?.fill) { ctx.fillStyle = o.fill; ctx.fillRect(-w / 2, -h / 2, w, h); }
  ctx.strokeStyle = colour; ctx.lineWidth = 7;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
  textBox(g, HU(g, text), -w / 2 + 24, -h / 2 + 20, w - 48, h - 40, { font: "head", max, min: 16, colour, align: "center", lh: 1.02 });
  ctx.restore();
}

// A round stamp with a ring of text (just the middle words, the ring is a double circle).
export function roundStamp(g: G, cx: number, cy: number, r: number, rot: number, colour: string, mid: string, max = 40) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((rot * Math.PI) / 180);
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = colour; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r - 16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  textBox(g, HU(g, mid), -r * 0.52, -r * 0.3, r * 1.04, r * 0.6, { font: "head", max, min: 14, colour, align: "center", lh: 1 });
  ctx.restore();
}

export function redact(g: G, x: number, y: number, widths: number[], h = 26, gap = 14, colour = "#121212") {
  g.ctx.save();
  g.ctx.fillStyle = colour;
  widths.forEach((w, i) => g.ctx.fillRect(x, y + i * (h + gap), w, h));
  g.ctx.restore();
}

export function pin(g: G, x: number, y: number, colour: string, r = 15) {
  const { ctx } = g;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Speckled backgrounds
export function speckle(g: G, base: string, seed: number, n = 2500, dark = "rgba(60,40,20,", light = "rgba(255,235,200,") {
  const { ctx } = g;
  ctx.fillStyle = base; ctx.fillRect(0, 0, XW, XH);
  const r = rand(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `${r() > 0.5 ? dark : light}${(0.05 + r() * 0.1).toFixed(2)})`;
    ctx.fillRect(r() * XW, r() * XH, 2 + r() * 5, 2 + r() * 4);
  }
  ctx.restore();
}

// An aged paper sheet: a rectangle with a soft shadow, a slight vignette and a few creases
export function sheet(g: G, x: number, y: number, w: number, h: number, colour: string, rot = 0, o?: { vignette?: boolean }) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate((rot * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
  ctx.fillStyle = colour; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  if (o?.vignette !== false) {
    const gr = ctx.createRadialGradient(0, 0, Math.min(w, h) * 0.25, 0, 0, Math.max(w, h) * 0.75);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(80,55,20,0.28)");
    ctx.fillStyle = gr; ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

// A straight photo with a thin frame, drawn rotated about its own centre. The photo slot is what drags.
export function framedPhoto(g: G, x: number, y: number, w: number, h: number, rot: number, border: number, colour: string, o?: { shadow?: boolean }) {
  const { ctx } = g;
  const cx = x + w / 2, cy = y + h / 2, a = (rot * Math.PI) / 180;
  g.slots.push({ i: 0, x: x + border, y: y + border, w: w - border * 2, h: h - border * 2, rot });
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(a);
  if (o?.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,0.38)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
  ctx.fillStyle = colour; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.beginPath(); ctx.rect(-w / 2 + border, -h / 2 + border, w - border * 2, h - border * 2); ctx.clip();
  drawPhoto(g, w - border * 2, h - border * 2);
  ctx.restore();
}

export function barcode(g: G, x: number, y: number, w: number, h: number, colour: string, seed = 4) {
  const r = rand(seed);
  g.ctx.save(); g.ctx.fillStyle = colour;
  for (let xx = x; xx < x + w;) { const bw = 2 + Math.floor(r() * 5); g.ctx.fillRect(xx, y, Math.min(bw, x + w - xx), h); xx += bw + 2 + Math.floor(r() * 4); }
  g.ctx.restore();
}

export function stars(g: G, x: number, y: number, n: number, filled: number, size: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 3; ctx.lineJoin = "round";
  for (let k = 0; k < n; k++) {
    const cx = x + k * (size + 12) + size / 2, cy = y + size / 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? size * 0.2 : size * 0.5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath();
    if (k < filled) ctx.fill(); else ctx.stroke();
  }
  ctx.restore();
}

export const faint = (g: G, a = 0.7) => rgba(g.c.ink, a);
export { shade, rgba };

// Tall condensed headline that wraps by itself. Each item can be a different colour; \n forces a break.
// The biggest size that fits the height wins, and each line is squeezed sideways (never past minSx) to fit the width.
export function tallWrap(g: G, items: { text: string; colour: string }[], x: number, y: number, w: number, hMax: number, max: number, o?: { lh?: number; minSx?: number; min?: number; align?: CanvasTextAlign }): number {
  const { ctx } = g;
  const lh = o?.lh ?? 1.0, minSx = o?.minSx ?? 0.78, min = o?.min ?? 24;
  let s = max;
  let rows: { t: string; colour: string }[] = [];
  const build = (size: number) => {
    ctx.font = `${g.headW} ${size}px ${g.head}`;
    const out: { t: string; colour: string }[] = [];
    items.forEach((it) => {
      const words = HU(g, it.text ?? "").split(/\n/);
      words.forEach((para) => {
        if (!para.trim()) return;
        let line = "";
        for (const wd of para.split(/\s+/).filter(Boolean)) {
          const t = line ? `${line} ${wd}` : wd;
          if (line && ctx.measureText(t).width * minSx > w) { out.push({ t: line, colour: it.colour }); line = wd; } else line = t;
        }
        if (line) out.push({ t: line, colour: it.colour });
      });
    });
    return out;
  };
  for (; s >= min; s -= 2) {
    rows = build(s);
    if (rows.length * s * lh <= hMax) break;
  }
  s = Math.max(s, min);
  rows = build(s);
  ctx.font = `${g.headW} ${s}px ${g.head}`;
  ctx.textBaseline = "top"; ctx.textAlign = o?.align ?? "left";
  let yy = y;
  rows.forEach((r) => {
    const wd = ctx.measureText(r.t).width;
    const sx = Math.min(1, w / (wd || 1));
    const ax = o?.align === "center" ? x + w / 2 : o?.align === "right" ? x + w : x;
    ctx.save(); ctx.translate(ax, yy); ctx.scale(sx, 1);
    ctx.fillStyle = r.colour; ctx.fillText(r.t, 0, 0);
    ctx.restore();
    yy += Math.round(s * lh);
  });
  return yy;
}
