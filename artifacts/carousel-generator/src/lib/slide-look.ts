// Shared by the photo slide drawers: a colour wash over the photo, the colour of the words and a size for them.
export function washRgba(hex: string, a: number): string {
  const h = (hex || "#000000").replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.padEnd(6, "0");
  const n = parseInt(f.slice(0, 6), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export const washAlpha = (scrim: number): number => Math.min(0.85, Math.max(0, Math.min(80, scrim)) / 100 + 0.25);
