// Shared by the photo slides: draws a block of wrapped lines left, centred, right or justified.
export type Align = "left" | "center" | "right" | "justify";
export const ALIGNS: { value: Align; label: string }[] = [
  { value: "center", label: "Centre" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justified" },
];

// Draws the lines from y downwards inside a box that is `width` wide and centred on the page. Returns the y after the last line.
export function drawAligned(
  ctx: CanvasRenderingContext2D, lines: string[], y: number, lh: number,
  align: Align | undefined, pageW: number, width = 860,
): number {
  const a: Align = align ?? "center";
  const left = (pageW - width) / 2;
  ctx.save();
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    if (a === "justify" && i < lines.length - 1) {
      const words = line.split(" ").filter(Boolean);
      if (words.length > 1) {
        const used = words.reduce((s, w) => s + ctx.measureText(w).width, 0);
        const gap = (width - used) / (words.length - 1);
        let x = left;
        ctx.textAlign = "left";
        for (const w of words) { ctx.fillText(w, x, y); x += ctx.measureText(w).width + gap; }
        y += lh;
        return;
      }
    }
    if (a === "left" || a === "justify") { ctx.textAlign = "left"; ctx.fillText(line, left, y); }
    else if (a === "right") { ctx.textAlign = "right"; ctx.fillText(line, left + width, y); }
    else { ctx.textAlign = "center"; ctx.fillText(line, pageW / 2, y); }
    y += lh;
  });
  ctx.restore();
  return y;
}

export type CornerPos = "tl" | "tr" | "bl" | "br";

// The logo on a photo slide. Top right is where it has always sat; `lift` keeps a bottom corner clear of the swipe arrow.
export function drawCornerLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, pos: CornerPos | undefined, pageW: number, pageH: number, lift = 0) {
  if (!logo) return;
  const p = pos ?? "tr";
  const s = Math.min(240 / logo.width, 80 / logo.height);
  const w = logo.width * s, h = logo.height * s;
  const x = p === "tl" || p === "bl" ? 50 : pageW - 50 - w;
  const y = p === "tl" || p === "tr" ? 40 : pageH - 40 - h - (p === "br" ? lift : 0);
  ctx.drawImage(logo, x, y, w, h);
}
