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
