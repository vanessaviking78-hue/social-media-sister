// One shared home for metallic colour finishes, used by the About me posts and the new colour picker.
// A colour value is either a plain hex ("#d6006f") or "metal:id" for a shiny multi stop gradient.

export type MetalDef = { id: string; name: string; stops: string[] };

export const METAL_FINISHES: MetalDef[] = [
  { id: "silver", name: "Silver", stops: ["#6d6f73", "#c9ccd1", "#ffffff", "#a9adb3", "#6d6f73"] },
  { id: "gold", name: "Gold", stops: ["#7a5a14", "#d4a93c", "#fff1a8", "#c9962b", "#7a5a14"] },
  { id: "rosegold", name: "Rose gold", stops: ["#8a4f45", "#d9a08f", "#ffe3d6", "#c98a79", "#8a4f45"] },
  { id: "blue", name: "Metallic blue", stops: ["#16335f", "#4f86d6", "#d6e8ff", "#3a6fc0", "#16335f"] },
  { id: "champagne", name: "Champagne", stops: ["#9c8458", "#e6d2a8", "#fff8e6", "#d2bb8c", "#9c8458"] },
  { id: "bronze", name: "Bronze", stops: ["#5c3a1a", "#a8713a", "#e0ac72", "#8a5a2a", "#5c3a1a"] },
  { id: "copper", name: "Copper", stops: ["#6e2f1a", "#c0683f", "#f0a984", "#b05a35", "#6e2f1a"] },
  { id: "gunmetal", name: "Gunmetal", stops: ["#1c1f24", "#4a5059", "#8b929c", "#3a3f47", "#1c1f24"] },
];

export const isHexColour = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export const isMetalValue = (v: unknown): v is string => typeof v === "string" && v.startsWith("metal:");
export const metalOfValue = (v: unknown): MetalDef | undefined => (isMetalValue(v) ? METAL_FINISHES.find((m) => m.id === v.slice(6)) : undefined);
export const metalCss = (m: MetalDef) => `linear-gradient(135deg, ${m.stops.map((c, i) => `${c} ${Math.round((i / (m.stops.length - 1)) * 100)}%`).join(", ")})`;
/** A plain hex that stands in for the colour when something needs one number (contrast, shadows). */
export const flatHexOf = (v: string | undefined, fallback = "#888888") => (isHexColour(v) ? v : metalOfValue(v)?.stops[1] ?? fallback);

/** The fill to hand to a canvas. Metallic values become a diagonal gradient across the box given. */
export function paintFor(ctx: CanvasRenderingContext2D, value: string | undefined, x: number, y: number, w: number, h: number, fallback = "#000000"): string | CanvasGradient {
  const m = metalOfValue(value);
  if (m) {
    const g = ctx.createLinearGradient(x, y, x + Math.max(1, w), y + Math.max(1, h));
    m.stops.forEach((c, i) => g.addColorStop(i / (m.stops.length - 1), c));
    return g;
  }
  return isHexColour(value) ? value : fallback;
}
