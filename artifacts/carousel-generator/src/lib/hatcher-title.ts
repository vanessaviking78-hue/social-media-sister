import opentype from "opentype.js";
import { type LoadedFont, type TitleStyle } from "./suite-fonts";

// Hatcher for the cover title on the Castle Clinic and Dr Kathryn pages. Only the very first letter of the
// title is curly (Hatcher's own ".salt" capital, the one with the little curl). Letters with no curly
// version in the font (C, O, Q, S) stay plain.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const CAPS = "ABDEFGHIJKLMNPRTUVWXYZ";

let p: Promise<LoadedFont> | null = null;
export function loadHatcher(): Promise<LoadedFont> {
  if (!p) {
    p = fetch(`${BASE}/fonts/no1/Hatcher.woff`).then(async (r) => {
      if (!r.ok) throw new Error("Hatcher font missing");
      const font = opentype.parse(await r.arrayBuffer());
      const byName = new Map<string, opentype.Glyph>();
      for (let i = 0; i < font.glyphs.length; i++) {
        const g = font.glyphs.get(i);
        if (g.name) byName.set(g.name, g);
      }
      const chars: Record<string, string> = {};
      for (const c of CAPS) if (byName.has(`${c}.salt`)) chars[c] = `${c}.salt`;
      return { id: "hatcher", font, byName, data: { alts: {}, chars } } as LoadedFont;
    });
    p.catch(() => { p = null; });
  }
  return p;
}

export async function loadHatcherTitle(): Promise<{ lf: LoadedFont; style: TitleStyle } | null> {
  try {
    const lf = await loadHatcher();
    const swaps: Record<string, string> = {};
    for (const c of Object.keys(lf.data.chars)) swaps[c] = lf.data.chars[c];
    return { lf, style: { fontId: "hatcher", tracking: 20, upper: false, ligatures: false, swaps, rate: "first" } };
  } catch {
    return null;
  }
}

/** @font-face for ordinary canvas text (the last slide) in Hatcher. */
export function hatcherCss(): string {
  return `@font-face { font-family: "Hatcher"; src: url("${BASE}/fonts/no1/Hatcher.woff2") format("woff2"), url("${BASE}/fonts/no1/Hatcher.woff") format("woff"); font-weight: 400; font-style: normal; font-display: swap; }`;
}
