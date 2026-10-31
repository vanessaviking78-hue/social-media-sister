// LUX: ten cover designs (one per Canva page), each the first slide of its own carousel. Slides 2 and 3 are full
// photo slides with the words laid over them, the same as the other tools. Everything is drawn straight onto a
// 1080 x 1350 canvas so the preview, the download and the scheduled images are always identical. No React in here.
// Every colour can be changed for the whole carousel, and any colour can be switched to a metallic foil.

import { fillTokens, type Fill } from "./basic-covers";
import { DEFAULT_PALETTES, drawLogo, headWeightFor, leftoverPlaceholders, type Ctx, type Focus, type G, type LogoPos, type Palette, type Slot } from "./xmas-designs";
import { drawUniPhotoSlide } from "./unique-designs";
import { S, XH, XW, type EG, type EKey, type EMetal, type EPalette } from "./empower-kit";
import { LUX_LAYOUTS } from "./lux-layouts";

export { XW, XH, leftoverPlaceholders };
export type { EKey, EMetal, EPalette };
export { FOILS } from "./empower-kit";

// ten cover designs, and a carousel is the cover plus two photo slides
export const LUX_COVERS = 10;
export const LUX_SLIDES = 3;

export type LField = { key: string; label: string; rows?: number };

// The template's own colours: warm cream, espresso and a copper line
export const LUX_PALETTE: EPalette = {
  page: "#f1ece2", dark: "#2b2420", accent: "#a8764f", soft: "#d8d1c5", ink: "#2b2420", light: "#f3ece0",
};

export const LUX_LABELS: { key: EKey; label: string }[] = [
  { key: "page", label: "Background" },
  { key: "dark", label: "Dark block" },
  { key: "accent", label: "Fine lines" },
  { key: "soft", label: "Card and panel" },
  { key: "ink", label: "Text on light" },
  { key: "light", label: "Text on dark" },
];

type SlideDef = { name: string; fields: [string, string, string, number?][] };

const HEAD = (v: string, rows = 3): [string, string, string, number?] => ["head", "Headline", v, rows];
const SUB = (v: string, rows = 2): [string, string, string, number?] => ["sub", "Line underneath", v, rows];

export const LUX_SLIDE_DEFS: SlideDef[] = [ // one per cover design
  { name: "Opener, half portrait", fields: [HEAD("When did you start looking at yourself so critically?", 3), SUB("A gentler conversation can begin with noticing.")] },
  { name: "Film frame", fields: [HEAD("You deserve to be in the photograph.", 2), SUB("Not a future version of yourself. This life, as it is."), ["film", "Film edge print", "KODAK PORTRA 400", 1]] },
  { name: "Consultation", fields: [HEAD("A good consultation is allowed to end with no treatment.", 3), SUB("Trust is knowing the conversation comes first."), ["box", "Boxed note", "COMPLIMENTARY CONSULTATIONS AVAILABLE IN-CLINIC", 2]] },
  { name: "Dark block", fields: [HEAD("Your life is happening now. Not after a treatment.", 3), SUB("There is no before picture required for being present.")] },
  { name: "Side panel", fields: [HEAD("You see one detail.\n\nYour practitioner sees the whole picture.", 5), SUB("Proportion, context and you come first.")] },
  { name: "Question and portrait", fields: [HEAD("What if the question isn't how to look younger?", 3), SUB("Tell us what feeling like yourself means to you.")] },
  { name: "Big photo and dark box", fields: [HEAD("This face has been there for all of it.", 3), SUB("Every expression is part of the story.")] },
  { name: "Keepsake photograph", fields: [HEAD("Before we discuss what could change, tell me what you want to keep.", 4), SUB("What would you *never* want to lose?", 1)] },
  { name: "Tilted print", fields: [HEAD("You were never meant to look like somebody else's photograph.", 4), SUB("Comparison edits out the person who makes you, you.")] },
  { name: "Your turn", fields: [HEAD("What makes you feel most like yourself?", 2), SUB("We'd love to hear your answer.", 1)] },
];

export const LUX_FIELDS: LField[][] = LUX_SLIDE_DEFS.map((d) => d.fields.map(([key, label, , rows]) => ({ key, label, rows })));
export const luxDefaults = (cover: number): Record<string, string> => Object.fromEntries(LUX_SLIDE_DEFS[cover].fields.map(([key, , def]) => [key, def]));

export function resolveLuxText(n: number, text: Record<string, string>, fill: Fill): Record<string, string> {
  const base = LUX_SLIDE_DEFS[n].fields;
  return Object.fromEntries(base.map(([key, , def]) => [key, (text[key] ?? def ?? "").split("\n").map((l) => fillTokens(l, fill)).join("\n").trim()]));
}

export type LuxDrawInput = {
  cover: number;
  text: Record<string, string>;
  palette: EPalette;
  metal: EMetal;
  headFont: string;
  bodyFont: string;
  photo: ImageBitmap | null;
  focus: Focus;
  logo?: HTMLImageElement | null;
  logoPos?: LogoPos;
};

export function drawLux(ctx: Ctx, d: LuxDrawInput): Slot[] {
  const g: EG = {
    ctx, t: d.text, c: DEFAULT_PALETTES.xmas, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: false, photo: d.photo, focus: d.focus, slots: [], p: d.palette, metal: d.metal, foils: new Map(),
  };
  ctx.save();
  ctx.textBaseline = "top";
  ctx.save();
  ctx.scale(S, S);
  LUX_LAYOUTS[Math.max(0, Math.min(LUX_COVERS - 1, d.cover))](g);
  ctx.restore();
  if (d.logo && d.logoPos && d.logoPos !== "off") drawLogo(g as G, d.logo, d.logoPos);
  ctx.restore();
  return g.slots;
}

// ---------------------------------------------------------------------------
// Slides 2 and 3: a full bleed approved photo with the words laid over it, exactly as the other tools do it,
// in this carousel's own colours. The last one carries the engagement question.
// ---------------------------------------------------------------------------

export type LuxPhotoInput = {
  text: string;
  cta?: string;
  palette: EPalette;
  bodyFont: string;
  photo: ImageBitmap | null;
  focus: Focus;
  scrim: number;
  logo: HTMLImageElement | null;
  logoPos?: LogoPos;
  arrow: boolean;
};

export function drawLuxPhotoSlide(ctx: Ctx, d: LuxPhotoInput): Slot[] {
  const p = d.palette;
  const palette: Palette = { paper: p.page, green: p.dark, red: p.accent, tag: p.soft, frame: p.page, light: p.light, ink: p.ink };
  const corner = d.logoPos && d.logoPos !== "off" ? d.logoPos : undefined;
  return drawUniPhotoSlide(ctx, {
    text: d.text,
    cta: d.cta,
    palette,
    bodyFont: d.bodyFont,
    photo: d.photo,
    focus: d.focus,
    scrim: d.scrim,
    logo: corner ? d.logo : null,
    logoCorner: corner,
    arrow: d.arrow,
  });
}
