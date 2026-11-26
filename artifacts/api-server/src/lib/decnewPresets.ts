import type { PhotoStudioPreset } from "./aiPortraitScenarios";

// DECNEW: the 13 prompts from her TextBlaze DECEMBER folder (/DE001 to /DE013), copied across 26 Nov 2026.
// Her TextBlaze colour field became a colour box on each card. The colour is passed in as the xmasColour
// prompt variable, so [XMAS COLOUR] below is simply "the colour picked on that card".
// The hyper realistic and face lock lines are added to every prompt that features her, so the face always stays as the uploaded photo.
const LOCK = ` Hyper-realistic, true to life photograph with natural unretouched skin texture and visible pores, no airbrushing, no smoothing, no plastic or CGI look. STRICT FACELOCK: use the uploaded reference photo for the face and hair identity and preserve the exact face, facial proportions, bone structure, eyes, nose, lips and age. DO NOT CHANGE FACIAL FEATURES.`;

// Flat lay and desk shots have no face in them, so they only get the realism line.
const REAL_ONLY = ` Hyper-realistic, true to life photograph, natural light and real textures, no CGI or illustrated look.`;

const C = "[XMAS COLOUR]";

export interface DecnewMeta {
  defaultColour?: string;
}

function dn(
  n: number,
  name: string,
  text: string,
  defaultColour?: string,
  noFace = false,
): PhotoStudioPreset & DecnewMeta {
  return {
    id: `dn-${String(n).padStart(2, "0")}`,
    name,
    defaultColour,
    hasColour: false,
    promptTemplate: `${text.trim()}${noFace ? REAL_ONLY : LOCK}`,
  };
}

const DEFAULT_COLOUR = "navy blue";

export const DECNEW_PRESETS: (PhotoStudioPreset & DecnewMeta)[] = [
  dn(1, "Winter Editorial Portrait", `Aesthetic clinician portrait in soft winter light, ${C} scrubs subtly integrated, clean editorial style, crisp shadows, serene confidence. Use photo as reference, do not change facial features.`, DEFAULT_COLOUR),
  dn(2, "Golden Hour Glow Portrait", `Close-up beauty portrait with dewy skin, warm low sun, background bokeh hints of ${C}, refined and elegant finish. Using photo for reference, do not change facial features.`, DEFAULT_COLOUR),
  dn(3, "Monochrome Power Shot", `Dramatic black and white portrait, black backdrop, black jumper, bold contrast, sharp eyes, minimal styling, subtle dark blue detail in wardrobe or backdrop. Do not change facial features.`),
  dn(4, "Icy Toned Winter Portrait", `Portrait with frosty tones, soft breeze in the hair, textured background carrying a faint wash of ${C}.`, DEFAULT_COLOUR),
  dn(5, "Skincare Technique Close-Up", `High-detail skincare application shot, clear texture, soft shadows, discreet ${C} in towels or tools. Do not change facial features.`, DEFAULT_COLOUR),
  dn(6, "Polaroid Knit Jumper Moment", `Polaroid-style frame, natural winter light, chunky knit jumper, background element containing a gentle ${C} accent.`, DEFAULT_COLOUR),
  dn(7, "Old-School Magazine Beauty Shot", `Vintage magazine-style beauty portrait, muted lighting, classic eyeliner, backdrop softened with ${C}.`, DEFAULT_COLOUR),
  dn(8, "Tree Glow Portrait", `Portrait in front of warm festive lights, shallow depth of field, soft shadows, ${C} threaded subtly through décor.`, DEFAULT_COLOUR),
  dn(9, "Snowfall Motion Portrait", `Snow falling through the frame, soft blur, crisp winter palette, ${C} included through accessories or styling.`, DEFAULT_COLOUR),
  dn(10, "Minimalist Festive Flat Lay", `Clean festive flat lay: skincare, winter foliage, textured linen, touches of ${C} for seasonal branding.`, DEFAULT_COLOUR, true),
  dn(11, "Candlelit Red Lip Shot", `Classic winter beauty portrait with bold lip, warm candlelight glow, atmospheric shadows, tailored ${C} detail in styling.`, DEFAULT_COLOUR),
  dn(12, "Winter Desk Workspace", `Top-down desk shot with planner, pen, iPhone, winter candle, and refined ${C} worked into stationery.`, DEFAULT_COLOUR, true),
  dn(13, "Frosted Editorial Look", `Cinematic winter light, sharp cheekbones, soft shadows, refined confidence.`),
];
