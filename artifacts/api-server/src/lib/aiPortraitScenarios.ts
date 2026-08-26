export type ScenarioCategory = "clinical" | "lifestyle" | "brand";

export interface AiScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  promptTemplate: string;
  hasScrubColor: boolean;
  hasOutfitStyle: boolean;
}

const SAFETY_CONSTRAINTS = `
Maintain the person's exact facial features, skin tone, and likeness from the reference photo.
No medical equipment, syringes, needles, or clinical devices in frame.
No branded products visible.
Natural, unretouched-looking skin.
Make no medical claims in imagery.
Professional, warm, approachable expression.
`.trim();

export const AI_PORTRAIT_SCENARIOS: AiScenario[] = [
  {
    id: "clinical-white-coat",
    name: "White Coat Consultation",
    category: "clinical",
    promptTemplate: `A professional portrait of the person from the reference photo wearing a clean white medical coat over a {scrubColor} top, standing or seated in a modern, softly lit clinical consultation room with neutral walls. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: true,
    hasOutfitStyle: false,
  },
  {
    id: "clinical-blue-scrubs",
    name: "Scrubs — Clinical Setting",
    category: "clinical",
    promptTemplate: `A professional portrait of the person from the reference photo wearing {scrubColor} medical scrubs in a bright, clean clinical environment with soft natural light. They look confident and approachable. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: true,
    hasOutfitStyle: false,
  },
  {
    id: "clinical-treatment-room",
    name: "Treatment Room — Seated",
    category: "clinical",
    promptTemplate: `A professional portrait of the person from the reference photo seated comfortably in a modern aesthetic treatment room wearing a {scrubColor} uniform, with soft studio lighting. Calm, professional, welcoming expression. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: true,
    hasOutfitStyle: false,
  },
  {
    id: "clinical-reception",
    name: "Reception Desk Greeting",
    category: "clinical",
    promptTemplate: `A professional portrait of the person from the reference photo standing at or near a sleek modern reception desk in {scrubColor} scrubs or uniform, smiling warmly. Clinic interior visible but blurred in background. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: true,
    hasOutfitStyle: false,
  },
  {
    id: "clinical-outdoors-scrubs",
    name: "Outdoors in Uniform",
    category: "clinical",
    promptTemplate: `A relaxed professional portrait of the person from the reference photo standing outdoors in soft natural light, wearing {scrubColor} scrubs or a clinical uniform. Background is green foliage or a clean modern building exterior, softly blurred. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: true,
    hasOutfitStyle: false,
  },
  {
    id: "lifestyle-coffee",
    name: "Coffee Shop Working",
    category: "lifestyle",
    promptTemplate: `A candid-style lifestyle portrait of the person from the reference photo seated at a warm, well-lit coffee shop or cafe, wearing {outfitStyle} clothing. They are looking up from a laptop with a relaxed, confident expression. Bokeh background. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "lifestyle-outdoors",
    name: "Walking Outdoors",
    category: "lifestyle",
    promptTemplate: `A natural lifestyle portrait of the person from the reference photo walking outdoors in a leafy urban or park setting, wearing {outfitStyle} clothing. Warm golden-hour lighting. Relaxed, energetic, approachable. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "lifestyle-coworking",
    name: "Coworking Space",
    category: "lifestyle",
    promptTemplate: `A lifestyle portrait of the person from the reference photo seated in a bright modern coworking space, wearing {outfitStyle} clothing. They look focused and approachable, with plants and open-plan interior softly blurred behind them. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "lifestyle-home-office",
    name: "Home Office",
    category: "lifestyle",
    promptTemplate: `A warm lifestyle portrait of the person from the reference photo working from a stylish home office or desk setup, wearing {outfitStyle} casual-professional clothing. Bookshelves or plants visible in the soft background. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "brand-headshot-plain",
    name: "Classic Headshot",
    category: "brand",
    promptTemplate: `A polished professional headshot of the person from the reference photo against a clean, neutral studio background (light grey, cream or white). Wearing {outfitStyle} clothing. Shoulders and face clearly visible. Confident, warm expression. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "brand-headshot-branded",
    name: "Branded Background Headshot",
    category: "brand",
    promptTemplate: `A professional branded headshot of the person from the reference photo. Background is a softly blurred gradient in warm neutral tones with subtle depth. Wearing {outfitStyle} professional attire. Polished studio lighting. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "brand-speaking",
    name: "Speaking or Presenting",
    category: "brand",
    promptTemplate: `A confident portrait of the person from the reference photo in a speaking or presenting pose — standing, gesturing naturally — wearing {outfitStyle} clothing. Background suggests a small event, workshop or conference, softly blurred. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "brand-reading",
    name: "Reading or Learning",
    category: "brand",
    promptTemplate: `A thoughtful lifestyle brand portrait of the person from the reference photo seated and reading or studying, wearing {outfitStyle} clothing. Warm, intellectually engaged expression. Soft background with books or natural light. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
  {
    id: "brand-arms-crossed",
    name: "Confident Arms-Crossed",
    category: "brand",
    promptTemplate: `A confident, authoritative brand portrait of the person from the reference photo with arms loosely crossed or hands on hips, wearing {outfitStyle} clothing. Clean background, strong directional studio lighting, direct eye contact. ${SAFETY_CONSTRAINTS}`,
    hasScrubColor: false,
    hasOutfitStyle: true,
  },
];

export function buildPrompt(scenario: AiScenario, scrubColor?: string, outfitStyle?: string, aspectRatio = "1:1"): string {
  let prompt = scenario.promptTemplate;
  if (scenario.hasScrubColor) {
    prompt = prompt.replace("{scrubColor}", scrubColor || "navy blue");
  }
  if (scenario.hasOutfitStyle) {
    prompt = prompt.replace("{outfitStyle}", outfitStyle || "smart casual");
  }
  const ratioDescription =
    aspectRatio === "9:16" ? "a vertical 9:16 portrait orientation (tall and narrow)" :
    aspectRatio === "3:4" ? "a 3:4 portrait orientation" :
    "a square 1:1 format";
  prompt += ` Compose the image in ${ratioDescription}.`;
  return prompt;
}

// ─── Custom outfit + background portrait system ────────────────────────────

export type OutfitType = "white-shirt-jeans" | "black-tee-trousers" | "floral-boho" | "scrubs";
export type BackgroundType = "clinic-bokeh" | "white-studio" | "black-studio" | "custom-color" | "upload-own";

export interface CustomPortraitConfig {
  outfitType: OutfitType;
  backgroundType: BackgroundType;
  scrubColor?: string;
  backdropColor?: string;
  aspectRatio?: string;
}

function outfitDescription(outfitType: OutfitType, scrubColor?: string): string {
  switch (outfitType) {
    case "white-shirt-jeans":
      return "a white crisp fitted shirt tucked into well-fitted dark jeans";
    case "black-tee-trousers":
      return "a fitted black long-sleeved top with neat tailored black trousers";
    case "floral-boho":
      return "a flowing floral boho-style dress with a relaxed open-front cardigan";
    case "scrubs":
      return `${scrubColor ?? "navy blue"} medical scrubs`;
  }
}

function backgroundDescription(backgroundType: BackgroundType, backdropColor?: string): string {
  switch (backgroundType) {
    case "clinic-bokeh":
      return "a soft warm bokeh background suggesting a clinic or medical environment — unidentifiable, no recognisable branding, no medical equipment, no anatomy diagrams, no visible text or sharp details";
    case "white-studio":
      return "a clean pure white studio backdrop";
    case "black-studio":
      return "a deep matte black studio backdrop";
    case "custom-color":
      return `a plain smooth studio backdrop in the colour ${backdropColor ?? "#ffffff"}`;
    case "upload-own":
      return "the provided background image as the setting, placing the person naturally within the environment shown in the second image";
  }
}

export function buildCustomPrompt(cfg: CustomPortraitConfig): string {
  const outfit = outfitDescription(cfg.outfitType, cfg.scrubColor);
  const bg = backgroundDescription(cfg.backgroundType, cfg.backdropColor);
  const ratioDescription =
    cfg.aspectRatio === "9:16" ? "a vertical 9:16 portrait orientation (tall and narrow)" :
    cfg.aspectRatio === "3:4" ? "a 3:4 portrait orientation" :
    "a square 1:1 format";
  return `A professional portrait photograph of the person from the reference photo, wearing ${outfit}. The background is ${bg}.

Maintain the person's exact facial features, skin tone, hair colour, and likeness from the reference photo with complete accuracy. Do not alter, slim, retouch, or beautify the face in any way. Natural, unretouched-looking skin. No medical equipment, syringes, needles, or clinical devices in frame unless they are a natural part of the chosen background. No branded products visible. Make no medical claims in imagery. Professional, warm, approachable expression.

Compose the image in ${ratioDescription}.`.trim();
}

// ─── AI Photo Studio — 15 preset prompts ──────────────────────────────────

const PHOTO_STUDIO_NEGATIVE = "Avoid: blurry image, low resolution, oversaturated colors, unrealistic skin smoothing, cartoon style, CGI look, distorted anatomy, extra fingers, extra hands, extra limbs, warped hands, malformed nails, uneven eyes, cross-eyed, duplicate objects, messy background, watermark, text overlay, logo artifacts, bad lighting, harsh shadows, plastic skin texture.";

export interface PhotoStudioPreset {
  id: string;
  name: string;
  promptTemplate: string;
  hasColour: boolean;
    hasHairColour?: boolean;
    hasName?: boolean;
  hasCustomText?: boolean;
}

export const NEW_PORTRAITS_PRESETS: PhotoStudioPreset[] = [
  {
    id: "np-01",
    name: "Studio Mono, Direct Gaze",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, standing against a pure black seamless studio backdrop. Tight, harsh single key light from camera left, facing dead on to camera, chin slightly down, unflinching direct stare. High contrast black and white, deep blacks, visible film grain. Natural unretouched skin texture with real pores and fine lines, no airbrushing, no smoothing. Same facial features as reference photo.`,
  },
  {
    id: "np-02",
    name: "Studio Mono, Close Crop",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, an open collar shirt. Extreme close crop from collarbone up, hard side light carving the jaw, one eye in soft shadow, pure black seamless background. Black and white, ultra realistic, unretouched skin, no smoothing, every texture detail visible. Same facial features as reference photo.`,
  },
  {
    id: "np-03",
    name: "Studio Colour, Approachable Clinical",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, warm easy smile, arms loosely crossed. Soft single key light on a black studio backdrop, gentle falloff, editorial but kind rather than severe. Hyper realistic skin with natural texture, no airbrushing, true to life colour. Same facial features as reference photo.`,
  },
  {
    id: "np-04",
    name: "Studio Colour, Confident Stance",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in a smart tailored blazer, no tie, hands in pockets, three quarter turn toward camera. Black studio backdrop, controlled rim light on the shoulders, rich natural skin tones, real fabric weave visible, magazine cover energy. No retouching. Same facial features as reference photo.`,
  },
  {
    id: "np-05",
    name: "Studio Mono, Profile Turn",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes. Side profile turning into a three quarter view, strong rim light outlining the silhouette against a pure black backdrop, dramatic shadow play across the face. Black and white, unretouched, hyper realistic skin detail throughout. Same facial features as reference photo.`,
  },
  {
    id: "np-06",
    name: "Coffee Shop Candid Mono",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, seated at a coffee shop window table, coffee cup in hand, caught mid laugh looking off camera. Natural window light, shallow depth of field, background softly blurred. Black and white, documentary realism, no retouching, natural skin texture. Same facial features as reference photo.`,
  },
  {
    id: "np-07",
    name: "Coffee Shop Colour Warm",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart casual clothes, a fine knit jumper with an open jacket, leaning on the coffee shop counter, relaxed half smile toward camera. Warm golden hour light through the window, rich amber and wood tones, unedited natural skin texture, editorial but lived in. Same facial features as reference photo.`,
  },
  {
    id: "np-08",
    name: "Coffee Shop Approachable Clinical",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, both hands wrapped around a coffee cup, soft genuine smile, seated in a coffee shop. Bright airy natural light, blurred café life behind, real unpolished skin texture, feels like a real morning rather than a shoot. Same facial features as reference photo.`,
  },
  {
    id: "np-09",
    name: "Coffee Shop Mono Editorial",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, standing by a coffee shop counter, candid glance caught mid conversation. High contrast window light, deep shadow on one side of the face, grainy documentary feel, unretouched skin detail. Black and white. Same facial features as reference photo.`,
  },
  {
    id: "np-10",
    name: "Sofa Colour Relaxed",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart casual clothes, seated on a neutral linen sofa, one arm along the backrest, easy confident posture. Soft diffused daylight from a large window, muted warm interior tones, hyper realistic natural skin, no glamming, lived in editorial feel. Same facial features as reference photo.`,
  },
  {
    id: "np-11",
    name: "Sofa Mono Intimate",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, leaning forward slightly, elbows on knees, direct engaged gaze, seated on a sofa. Single soft window light, deep tonal range, minimal set dressing. Black and white, unretouched realism throughout. Same facial features as reference photo.`,
  },
  {
    id: "np-12",
    name: "Sofa Approachable Clinical",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, cross legged on a sofa, hands clasped, warm open expression as if mid conversation. Soft natural light, calm domestic tones, natural unedited skin, feels reassuring rather than clinical. Same facial features as reference photo.`,
  },
  {
    id: "np-13",
    name: "Sofa Mono Editorial Recline",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, reclined into the corner of a sofa, one arm resting along the back, cool unbothered expression. Hard directional light, strong room shadow, high contrast. Black and white, real skin texture with no retouching. Same facial features as reference photo.`,
  },
  {
    id: "np-14",
    name: "Studio Colour Close Crop Eyes",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in a plain fitted top. Extreme close crop on the eyes and upper face, sharp clear catchlight, black studio backdrop, intense but not cold. Hyper realistic pore level skin detail, no smoothing, no glamming. Same facial features as reference photo.`,
  },
  {
    id: "np-15",
    name: "Smart Clothes Walking, Studio",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in a tailored coat, mid stride against a pure black studio backdrop, motion slightly caught in the fabric, strobe freezing the moment, high fashion energy. Black and white, unretouched skin, true film grain. Same facial features as reference photo.`,
  },
  {
    id: "np-16",
    name: "Scrubs Corridor Candid",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, caught mid stride in a softly blurred clinic corridor, natural unposed expression. Bright even light, natural skin texture, contemporary editorial rather than brochure gloss. Same facial features as reference photo.`,
  },
  {
    id: "np-17",
    name: "Studio Mono Seated Stool",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, perched on a stool, forearms resting on knees, steady gaze to camera. Single hard light, deep black studio backdrop, stark and graphic. Black and white, raw unretouched skin detail. Same facial features as reference photo.`,
  },
  {
    id: "np-18",
    name: "Coffee Shop Mono Reading",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart casual clothes, seated with a notebook or paper in a coffee shop, glancing up toward camera as if just noticed. Window light, soft grain, unguarded moment, real skin texture. Black and white. Same facial features as reference photo.`,
  },
  {
    id: "np-19",
    name: "Studio Colour Confident Clinical",
    hasColour: true,
    promptTemplate: `A woman from the reference photo wearing [COLOUR] scrubs, standing tall, arms crossed, warm assured expression, slight smile. Soft studio light on a black backdrop, natural unpolished skin, approachable authority rather than stern. Same facial features as reference photo.`,
  },
  {
    id: "np-20",
    name: "Sofa Colour Editorial Wide",
    hasColour: false,
    promptTemplate: `A woman from the reference photo in smart clothes, a wider shot showing more of the room, seated with a relaxed lean on a sofa, soft daylight, muted sophisticated palette, natural true to life skin throughout, no glamming. Same facial features as reference photo.`,
  },
];

export const JULY_2ND_SHOOT_PRESETS: PhotoStudioPreset[] = [
  {
    id: "js-01",
    name: "Head to Waist, Studio Neutral",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, head-to-waist portrait against a warm neutral studio backdrop, relaxed stance, soft directional light from one side. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-02",
    name: "Head to Waist, Window Light",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, head-to-waist portrait beside a large window, soft daylight falling across the face and shoulders, calm expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-03",
    name: "Head to Waist, Concrete Wall",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, head-to-waist portrait against a textured concrete wall, arms loosely crossed, confident but approachable. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-04",
    name: "Head to Waist, Seated Stool",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, head-to-waist portrait seated on a plain stool, hands resting in lap, direct eye contact with camera. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-05",
    name: "Head to Waist, Three Quarter Turn",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, head-to-waist portrait in soft studio light, three-quarter turn towards camera, slight smile. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-06",
    name: "Close Up, Direct Gaze",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, extreme close crop of the face, direct gaze into camera, soft even lighting. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-07",
    name: "Close Up, Side Profile",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, close crop side profile, natural window light, calm neutral expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-08",
    name: "Close Up, Candid Laugh",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, close crop, caught mid-laugh, candid and unposed. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-09",
    name: "Close Up, Three Quarter Angle",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, close crop, three-quarter angle, soft shadow across one side of the face. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-10",
    name: "Close Up, Golden Hour",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, close crop, warm golden hour light through a window, gentle expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-11",
    name: "Scrubs, Clinic Corridor",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, standing confidently in [COLOUR] scrubs in a modern clinic corridor, natural light from the side. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-12",
    name: "Scrubs, Reception Desk",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, behind a clinic reception desk in [COLOUR] scrubs, relaxed professional stance, soft indoor lighting. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-13",
    name: "Scrubs, Clinic Entrance",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, standing at a clinic entrance in [COLOUR] scrubs, natural daylight, approachable expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-14",
    name: "Scrubs, Seated with Tablet",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, seated with a tablet in hand, wearing [COLOUR] scrubs, soft clinic lighting, focused expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-15",
    name: "Scrubs, Close Mid Shot",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, close mid-shot in [COLOUR] scrubs holding a clipboard, warm approachable smile. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-16",
    name: "Lifestyle, City Street",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, walking along a city street, natural candid movement, soft overcast daylight. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-17",
    name: "Lifestyle, Coffee Shop",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, seated by the window in a coffee shop, cup in hand, relaxed candid moment. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-18",
    name: "Lifestyle, Park Bench",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, sitting on a park bench, soft natural light, calm unposed expression. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-19",
    name: "Lifestyle, Home Kitchen",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, leaning against a kitchen counter at home, morning light, relaxed candid pose. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "js-20",
    name: "Lifestyle, Car Interior",
    hasColour: false,
    promptTemplate: `A woman from the reference photo, in the driver's seat of a car, natural candid glance towards camera, soft window light. Shot on a medium format professional camera, natural true-to-life colour. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
];

export const PHOTO_STUDIO_PRESETS: PhotoStudioPreset[] = [
  {
    id: "ps-01",
    name: "Clean Skin Realism Enhancer",
    hasColour: false,
    promptTemplate: `Ultra-realistic human skin with natural texture and subtle imperfections. Visible pores across the face with realistic size variation. Soft, minimal fine lines around the eyes and mouth from natural expression, not aging. Natural peach fuzz along the jawline, cheeks, and temples. Even, clean skin tone with slight organic variation, not perfectly uniform. Realistic lip texture with fine vertical lines, not smooth or glossy. Individual eyelashes and eyebrows with natural density and irregularity. Skin reflects light naturally with soft highlights on high points of the face and gentle shadowing within pores and facial contours. No airbrushing, no plastic or waxy appearance. Photorealistic skin depth and micro-detail that appears naturally human and unfiltered. Use the person in the reference photo.`,
  },
  {
    id: "ps-02",
    name: "Textured Skin Realism Enhancer",
    hasColour: false,
    promptTemplate: `Ultra-realistic human skin with visible natural texture and organic variation. Clearly defined pores across the face with realistic size and placement. Subtle fine lines around the eyes and mouth formed from natural expression. Soft peach fuzz along the jawline, cheeks, and temples. Natural skin variation including light freckles, faint beauty marks, and tonal irregularities that appear organically embedded in the skin, never repeated or patterned. Realistic lip texture with fine lines and natural softness, not smooth or glossy. Individual eyelashes and eyebrows with natural density, irregular spacing, and realism. Skin interacts naturally with light, showing soft highlights on high points of the face and realistic shadows settling into pores, fine lines, and facial contours. No airbrushing, no plastic or waxy skin. Photorealistic skin depth and micro-detail that looks naturally human and unfiltered. Use the person in the reference photo.`,
  },
  {
    id: "ps-03",
    name: "Creative Director Office",
    hasColour: true,
    promptTemplate: `A woman with (photo for reference). Her makeup is polished and editorial: softly perfected skin, subtle contour, warm neutral eyeshadow, defined lashes, sculpted brows, and nude satin lips. Gold hoop earrings and minimal gold jewelry. Nails are almond-shaped, nude, clean and even. She is wearing [COLOUR] scrubs for a refined, luxury business silhouette. A refined fashion-studio workspace with neutral curtains, soft cream walls, and a minimal clothing rack filled with monochrome garments behind her. A modern desk is styled with printed brand layouts, mood boards, fabric swatches, and design sheets, creating a high-end creative director office aesthetic. Soft studio lighting with warm highlights and gentle shadows. Clean, bright, and professional. The mood is calm, focused, and powerful. Medium editorial shot framed from chest to waist. She is standing at the desk, one hand resting on printed medical materials while the other holds a takeaway coffee cup naturally. Background softly blurred. Ultra-sharp focus, luxury editorial clarity. Hyper-realistic skin texture, natural fabric folds, accurate lighting reflections, refined proportions.`,
  },
  {
    id: "ps-04",
    name: "Black Blazer Director Editorial",
    hasColour: false,
    promptTemplate: `A woman with (photo for reference). Hair is pulled up into a loose, elevated bun, with soft face-framing strands falling naturally around the cheeks and temples. Makeup is elevated editorial business glam: even satin skin, subtle contour, warm peach blush, softly defined brows, neutral brown eyeshadow, clean liner, wispy lashes. Expression is calm, confident, and thoughtful, eyes gazing slightly off-camera. A minimal white studio backdrop. She is seated in a black director's chair, centered in the frame. Soft, diffused studio lighting from the front and slightly above. No harsh shadows. Quiet luxury, nurse energy, composed confidence. Medium-full body editorial framing. Seated with legs crossed at the knee, left hand resting relaxed on her lap, right hand lifting a neutral takeaway coffee cup to her lips. Camera is eye-level, straight-on, crisp focus. Ultra-realistic fabric texture on the oversized black blazer worn as a blazer dress. No distorted fingers, no missing fingers, no extra hands, clean manicured nails, no extra limbs. High-end medical editorial realism.`,
  },
  {
    id: "ps-05",
    name: "Bathroom Vanity Skincare",
    hasColour: false,
    promptTemplate: `A woman with (photo for reference). Soft glam makeup transitioning into skincare: clean glowing skin, minimal makeup remaining, natural brows, soft lashes. Calm, focused expression. She is wearing a plush white bathrobe tied securely at the waist. Natural nails. She is standing at a bathroom vanity, gently applying moisturiser to her face with both hands, relaxed posture. Minimalist luxury bathroom with a neutral palette. White or light stone marble countertops, modern sink and fixtures, large mirror behind the vanity. Subtle decor like a folded towel or neutral skincare bottles. Soft warm vanity lighting evenly illuminating her face. No harsh shadows. Calm, serene nighttime mood. Shot on a professional digital camera, eye-level angle facing the mirror. Medium shot capturing her from head to waist with her reflection clearly visible. Camera: Canon EOS 5D Mark IV, Lens: 50mm prime, Aperture: f/2.8, ISO: 640, sharp focus on face and hands. Ultra-photorealistic skin texture, realistic mirror reflection, natural hand positioning.`,
  },
  {
    id: "ps-06",
    name: "Kitchen Island Lifestyle",
    hasColour: true,
    promptTemplate: `A woman with (photo for reference). Fresh clean-girl makeup with luminous skin, subtle contour, glossy nude lips, soft brown eyeshadow, defined brows, and fluttery lashes. Confident but relaxed expression. She is wearing [COLOUR] scrubs. Clean almond-shaped nude nails. She is seated casually at a kitchen island, one elbow resting lightly on the counter while holding a fork, effortless it-girl posture. Bright luxury kitchen with white marble countertops and backsplash. Minimal but styled decor: a ceramic bowl with fruit, a clear glass water cup, and a neutral plate with an aesthetic lunch. Soft natural daylight. Bright, clean, airy lighting. Shot on Sony A7R IV, 35mm prime lens, f/2.8, ISO 200, eye-level, medium shot, vertical framing. Ultra-photorealistic skin texture, crisp fabric details.`,
  },
  {
    id: "ps-07",
    name: "Patient Reassurance Clinical",
    hasColour: true,
    promptTemplate: `Clinical photograph of clinician reassuring a patient during treatment, same clinician features as reference photo, patient aged over 40, calm and authentic interaction, wearing [COLOUR] scrubs. Ultra-realistic, warm clinical lighting, candid moment, professional medical environment.`,
  },
  {
    id: "ps-08",
    name: "Luxury Clinic Injector",
    hasColour: true,
    promptTemplate: `Hyper-realistic photo of a confident medical aesthetic injector in a modern luxury clinic, wearing fitted [COLOUR] medical scrubs, hair sleek and up in a low bun, minimal clean girl makeup, soft dewy skin. She stands beside a white marble treatment bed with LED halo lighting above. Stainless steel tray with syringes neatly arranged, unopened filler boxes subtly visible, gloved hands mid-consultation gesture. Background features glass shelving with skincare bottles, certificates framed on wall, soft beige and taupe interior. Shot on Canon EOS R5, 85mm lens, shallow depth of field, warm clinical lighting, ultra-detailed skin texture, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ps-09",
    name: "White Shirt Sofa Casual",
    hasColour: false,
    promptTemplate: `Wearing a white shirt and jeans, the injector sits casually on a sofa, forearms resting on thighs with hands loosely clasped and anatomically accurate. Denim shows subtle creasing at knees; shirt fabric folds naturally at elbows. Expression thoughtful and calm. Editorial realism without glamour retouching. Seated lifestyle portrait, eye-level 1.3m, 35mm lens look, f/2.8 focus on eyes with soft falloff, warm window key light, neutral living room palette. Same facial features as reference photo.`,
  },
  {
    id: "ps-10",
    name: "Black and White Studio Portrait",
    hasColour: false,
    promptTemplate: `Black and white studio portrait, injector wearing a white shirt against deep black background. Crisp shadow edge defining jawline and collar. Expression confident and contemplative, shoulders squared. Skin texture honest with natural tonal gradation. Tight monochrome portrait, straight-on framing, 35mm full-frame look, f/2.8 sharp on eyes, single hard key light camera left, matte black backdrop. Same facial features as reference photo.`,
  },
  {
    id: "ps-11",
    name: "Consultation Space Head and Shoulders",
    hasColour: true,
    promptTemplate: `A medical aesthetic nurse seated indoors in a softly lit treatment consultation space, facing the camera with a calm, confident expression, shoulders squared but at ease. Background features floating wooden shelves with neatly arranged skincare boxes and folded linens (no readable text, no logos). Skin texture is honest and editorial: visible pores, subtle natural flush, fine baby hairs along the hairline. Hair falls naturally over both shoulders with believable strand separation. Hands are out of frame. Photographic realism, balanced dynamic range, professional clinical warmth without any beauty filter or airbrushing. She wears [COLOUR] scrubs. Tight head-and-shoulders portrait, eye-level centered, 35mm full-frame look, f/2.8 sharp on near eye, soft window light from camera-left, shallow depth of field. Same facial features as reference photo.`,
  },
  {
    id: "ps-12",
    name: "Clinic Arms Crossed Confident",
    hasColour: true,
    promptTemplate: `Photorealistic portrait photograph. Use the person in the reference image for exact facial features, hair, eye colour, skin tone, visible tattoos, piercings: preserve all identity details precisely. She stands with arms crossed, confident expression, looking directly at camera, treatment chair visible behind her. She wears [COLOUR] scrubs. Soft warm studio lighting. 85mm lens aesthetic, shallow depth of field, sharp focus on face. Professional editorial quality. Clinic interior background visible behind her.`,
  },
  {
    id: "ps-13",
    name: "B&W Camera Editorial",
    hasColour: false,
    promptTemplate: `High-resolution black and white studio editorial portrait. Subject in fitted black crew-neck t-shirt, thin circular wire-rim glasses, holding professional DSLR camera up to right eye, left eye visible looking directly at camera. Waist-up three-quarter angle. Short lighting from viewer's right, large softbox, soft gradient across cheek and jawline, seamless neutral grey background with subtle vignette. Silver smartwatch with Milanese mesh band, leather camera strap, large zoom lens. Shallow depth of field, cinematic bokeh, f/2.8 to f/4. Ultra-detailed visible hair strands, natural skin pores. Pure monochrome, ultra-high studio quality. Keep facial features identical to reference photo.`,
  },
  {
    id: "ps-14",
    name: "Side-Lit Vintage Texture",
    hasColour: false,
    promptTemplate: `Side-lit black-and-white portrait, wind moving hair, vintage film look, detailed texture in clothing, focus on emotional presence. DO NOT CHANGE FACE. Flattering lighting on face. Wearing black jumper, waist-up shot. All studio setting. Same facial features as reference photo.`,
  },
  {
    id: "ps-15",
    name: "Intense Eyes Close Crop",
    hasColour: true,
    promptTemplate: `Close crop, just eyes and mouth, intense stare, pure white background, overexposed edges for fashion-magazine boldness. DO NOT CHANGE FACE. Flattering lighting on face. Wearing [COLOUR] scrubs, waist-up shot. All studio setting. Same facial features as reference photo.`,
  },
  {
    id: "ps-fightnight",
    name: "Fight Night Entrance",
    hasColour: false,
    promptTemplate: `A dramatic wrestling and fight night entrance stage scene, with a muscular athletic person standing confidently at the centre, wearing a fitted one piece gladiator style unitard in [COLOUR] with contrasting side stripes and a bold emblem on the chest, white wristbands, gladiator sandals with ankle wrapping. They are holding a large red and white checkered pugil stick diagonally across their body, gripped firmly with a determined smile, full body heroic pose. Above them, a metallic chrome and steel textured 3D logo reads '[NAME]' in bold blockbuster wrestling font, positioned inside a chrome triangular emblem frame. Two tall illuminated stage towers stand either side of the scene with spotlights, blue lighting on the left tower and red lighting on the right, each topped with a diamond plate cylindrical pillar bearing a chrome shield emblem. Smoky atmospheric background, dark arena setting, glossy black tiled floor reflecting the lights, high contrast dramatic lighting, hyper realistic 3D render style. In the bottom corner, include a futuristic sci-fi stat card overlay with a dark charcoal background, glowing red neon border lines and corner brackets, angular hexagon accents top and bottom. Bold white heading text '[NAME]', a thin red divider line beneath it, stat rows reading '[SKILL LABEL]: [SKILL VALUE]', and a bottom statement in clean white text reading '[NAME] is [KNOWN AS DESCRIPTION]'. Maintain the person's exact facial features, skin tone, and likeness from the reference photo.`,
  },
  {
    id: "ps-perspex-number",
    name: "Perspex Number Studio",
    hasColour: false,
        promptTemplate: `A person standing confidently in the centre of a professional photography studio, facing the camera, holding a large three-dimensional number [NUMBER] with both hands at chest height, the number closest to camera and clearly readable. The number is a solid moulded object made from high-shine glossy plastic in [NUMBER COLOUR], with a smooth, reflective, polished surface, sharp clean edges, and realistic studio light reflections and specular highlights across its glossy surface, no transparency, no glass or acrylic look, not a flat board or sign. They are wearing [OUTFIT]. The studio backdrop is a smooth, seamless [STUDIO COLOUR] paper background, evenly lit with soft professional studio lighting, gentle shadow beneath their feet, no harsh reflections. Full body or three-quarter length shot, natural relaxed confident stance. Maintain their exact facial features, skin tone, body shape, and likeness from the reference photo. Must look physically believable and naturally photographed, not CGI or illustrated, natural imperfections, realistic depth, tactile textures, subtle sensor grain, true to life reflections on the glossy plastic number.`,
  },
  {
        id: "ps-word-hold",
        name: "Word In Hand Studio",
        hasColour: false,
        promptTemplate: `A person standing in the centre of a professional photography studio, holding a large three-dimensional word [WORD] out in front of them with both hands at full arm extension, gripped confidently so the word is closest to camera and dominates the foreground, clearly readable. The word is a solid moulded object made from high-shine glossy plastic in [WORD COLOUR], with a smooth, reflective, polished surface, sharp clean lettering, and realistic studio light reflections and specular highlights, no transparency, no glass or acrylic look. Shallow depth of field: the word held in front is in crisp sharp focus, while the person holding it is only slightly out of focus behind it, a gentle soft blur across their face and body, still clearly recognisable, not heavily blurred. They are wearing [OUTFIT]. The studio backdrop is a smooth, seamless [STUDIO COLOUR] paper background, evenly lit with soft professional studio lighting, gentle shadow beneath their feet, no harsh reflections. Full body or three-quarter length shot, natural relaxed confident stance. Maintain their exact facial features, skin tone, body shape, and likeness from the reference photo, even where softly out of focus. Must look physically believable and naturally photographed, not CGI or illustrated, natural imperfections, realistic depth, tactile textures, subtle sensor grain, true to life reflections on the glossy plastic lettering.`,
  },
  {
    id: "ps-custom",
    name: "Your Own Prompt",
    hasColour: false,
    hasCustomText: true,
    promptTemplate: `[CUSTOM PROMPT]`,
  },
    
];

export const HOMEWORK_SHOTS_PRESETS: PhotoStudioPreset[] = [
  {
    id: "hw-01",
    name: "Homework Shots 01 - Point Down (Both Hands)",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, both index fingers extended and pointing straight down toward the bottom of the frame as if directing the viewer to read a caption below, relaxed confident expression. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-02",
    name: "Homework Shots 02 - Point To The Side",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, one hand raised to chest height with the index finger pointing off to the side as if directing attention to something out of frame, slight smile. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-03",
    name: "Homework Shots 03 - Point Behind/Beside",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, turned slightly to one side with an arm raised and index finger pointing up and back over her shoulder as if showing off something behind her, playful raised eyebrow. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-04",
    name: "Homework Shots 04 - Point Up (Both Hands)",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, both arms raised above her head with both index fingers pointing straight up as if directing the viewer to a headline above, big confident energy. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-05",
    name: "Homework Shots 05 - Hold Up Tablet",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, holding a black tablet up at chest height with both hands, screen facing the camera, as if about to present information on the screen. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-06",
    name: "Homework Shots 06 - Hands On Hips",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, standing with both hands on her hips in a confident power stance, shoulders back, chin slightly raised. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-07",
    name: "Homework Shots 07 - Arms Crossed",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, arms folded loosely across her chest, warm approachable smile, relaxed posture. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-08",
    name: "Homework Shots 08 - Friendly Wave",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, one hand raised beside her head in a friendly wave, warm open smile as if greeting the viewer. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-09",
    name: "Homework Shots 09 - Thinking Pose",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, one hand resting lightly on her chin, head tilted slightly, thoughtful considering expression as if weighing up an idea. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-10",
    name: "Homework Shots 10 - Double Thumbs Up",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, both thumbs up at chest height, bright enthusiastic smile, energetic expression. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-11",
    name: "Homework Shots 11 - Shh Secret Tip",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, one index finger raised to her lips in a playful "shh, here's a secret" gesture, eyes bright and mischievous. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-12",
    name: "Homework Shots 12 - Product Showcase",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, holding a small unbranded skincare bottle up beside her face at shoulder height, showing it off to the camera with a pleased expression. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-13",
    name: "Homework Shots 13 - Seated With Clipboard",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, seated on a stool with a clipboard resting on her lap, one hand holding a pen above it, looking up at the camera with a friendly professional expression. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-14",
    name: "Homework Shots 14 - Candid Laugh Over Shoulder",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, body turned away from camera and glancing back over one shoulder with a genuine candid laugh, natural movement in her hair. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-15",
    name: "Homework Shots 15 - Heart Hands",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, both hands held together at chest height forming a heart shape, soft warm smile. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-16",
    name: "Homework Shots 16 - Presenting Gesture",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, standing side-on to the camera with one arm extended and palm open toward the empty space beside her, as if presenting something on an invisible screen or whiteboard. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-17",
    name: "Homework Shots 17 - Walking Towards Camera",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, captured mid-stride walking naturally toward the camera, one foot forward, relaxed confident movement, slight motion in her hair and dress. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-18",
    name: "Homework Shots 18 - Applying Product",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, dabbing a small amount of cream onto her own cheek with two fingers, eyes closed or looking at the camera with a serene expression. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-19",
    name: "Homework Shots 19 - Before and After Reveal",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, holding a tablet at chest height showing a blank screen and tapping it with one finger from the other hand, engaged explaining expression as if walking through a before-and-after result. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
  {
    id: "hw-20",
    name: "Homework Shots 20 - Casual Lean",
    hasColour: true,
    promptTemplate: `A woman from the reference photo, wearing [SCRUB COLOUR] medical scrubs, the entire background completely replaced with a solid, flat, seamless [COLOUR] studio backdrop filling 100% of the frame behind her — none of the original background, walls, or setting from the reference photo should remain visible anywhere in the shot, evenly and softly lit, framed and cropped from the waist up only with no legs or lower body visible in the shot, shot like a professional but natural phone photo for social media content, leaning casually against a treatment couch or counter edge with arms loosely crossed, one ankle crossed over the other, relaxed confident smile. Hyper-realistic unretouched skin texture with visible pores, no airbrushing, no smoothing, no glamming up. Same facial features as reference photo.`,
  },
];

export const RANDOM_PROMPT_PRESETS: PhotoStudioPreset[] = [
  {id: "rp-01",
    name: "Street Sign Lean",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K editorial photograph, 5:7 portrait, full-body shot of the reference subject leaning against giant 3D letters spelling [NAME] in a studio setting. She stands leaning back against the letters, one leg crossed over the other, hands in trouser pockets, calm confident gaze at camera. Same clothing as reference photo, same hair. Natural skin texture with visible pores, natural makeup; keep any cap, hijab or glasses from the reference. Giant vertical white 3D letters to one side casting a soft shadow, solid dark grey studio backdrop. Soft even studio lighting, frontal key with gentle fill, neutral palette with a pop of [COLOUR] in the trainers. Streetwear editorial style, minimalist, no CGI, no painting, no filter. Shot on Canon EOS R5, 50mm f/2.8, studio lighting. Preserve exact hair colour, length, cut, eye colour, skin tone and accessories from the reference.`,
  },
  {
    id: "rp-02",
    name: "Sunbeam Eyes",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic cinematic studio headshot, close-up, subject centred, direct eye contact, calm confident expression, wearing a [COLOUR] turtleneck, dark navy seamless backdrop. A dramatic horizontal beam of light crosses only the eyes, leaving forehead and lower face in soft shadow, bright catchlights in vivid blue-green eyes. Detailed natural skin texture and visible pores, soft realistic makeup, moody low-key lighting, high contrast, editorial fashion photography, luxury magazine aesthetic. A fine, barely-there necklace at the collarbone reads "[NAME]" in delicate script. 85mm lens, f/1.8, shallow depth of field, razor-sharp focus on the eyes, cinematic colour grading, HDR, 8K.`,
  },
  {
    id: "rp-03",
    name: "Crimson Block Profile",
    hasColour: true,
    hasName: true,
    promptTemplate: `Minimalist editorial poster portrait, same hairstyle as reference, perfect side profile, gazing upward with a thoughtful, determined expression. High-contrast black-and-white photography emphasising facial structure and shadow. Same clothing as reference. A bold vertical block of [COLOUR] sits behind her, its top edge just below her hairline; her hair extends above it into clean white space without being cropped. Face, neck and body sit inside the block. Small museum-poster caption type along the bottom edge reads "[NAME]". Clean white negative space surrounds the composition, gallery-poster aesthetic. Professional studio lighting, sharp focus, rich grayscale tones, cinematic contrast. Minimalist Swiss design influence, museum poster aesthetic. Hyper-realistic photography, 8K, razor-sharp detail, professional retouching. Aspect ratio 4:5.`,
  },
  {
    id: "rp-04",
    name: "Ink Silhouette Poster",
    hasColour: true,
    hasName: true,
    promptTemplate: `High-contrast black-and-white typographic portrait poster, side profile, built from bold black silhouette blocks, sharp negative space, rough ink edges, fragmented stencil shapes, editorial microtext reading "[NAME]" woven into hand-drawn calligraphic marks. Minimal [COLOUR] paper background, asymmetrical layout, cropped vertical composition, raw ink print texture. Aspect ratio 4:5.`,
  },
  {
    id: "rp-05",
    name: "Contact Sheet Campaign",
    hasColour: true,
    hasName: true,
    promptTemplate: `Premium 9:16 advertising poster styled as a giant contact sheet from a professional shoot, dozens of portrait frames of the same subject each capturing a different mood: confidence, ambition, curiosity, focus, freedom. Editorial portrait photography, film markings, frame numbers and photography notes as graphic elements. Bold headline typography reading "MORE THAN ONE VERSION OF [NAME]". Warm colour grading in [COLOUR] tones. Identity storytelling, premium camera campaign, viral poster aesthetic, hyper-realistic, ultra-detailed, 8K.`,
  },
  {
    id: "rp-06",
    name: "Purple Ottoman Editorial",
    hasColour: true,
    hasName: true,
    promptTemplate: `Preserve the subject's exact facial identity: face shape, bone structure, eyes, nose, lips, jawline, hairstyle, skin tone and natural expression, no beautifying. Ultra-premium fashion editorial portrait, seated casually on a cylindrical matte [COLOUR] ottoman, leaning slightly forward with elbows on the thighs, hands loosely clasped, confident modern attitude, direct eye contact. Oversized [COLOUR] monochromatic trench coat over a matching [COLOUR] crew-neck top, relaxed white trousers, white and [COLOUR] designer trainers, a sleek wristwatch engraved on the back with "[NAME]". Seamless monochromatic [COLOUR] studio, floor and backdrop matching, no props. High-end softbox lighting from camera left with subtle fill and gentle cinematic shadow, realistic skin texture and premium fabric detail. Full body and shoes visible, centred, 4:5 vertical composition, 85mm medium-format look, shallow depth of field, ultra-sharp focus, hyper-realistic skin pores, luxury editorial colour grading, commercial campaign quality, photorealistic 8K.`,
  },
  {
    id: "rp-07",
    name: "Autumn Wall Lean",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic environmental portrait, standing casually with her back against an aged beige wall, a traditional window beside her for architectural character. A branch of vivid autumn leaves extends into frame above, a few leaves drifting through the air, warm sunlight filtering through to create dappled light and soft shadow across the wall, ground and subject. She faces the camera directly, full body, wide-distance composition. Natural loose waves falling across her forehead with realistic texture and movement, calm, confident, effortlessly stylish expression. Relaxed beige wide-leg trousers, an oversized [COLOUR] button-up shirt with sleeves rolled to the forearm, clean modern trainers, a slim leather bracelet with "[NAME]" stamped into the inside. Warm, earthy colour palette. Natural sunlight, realistic highlights, soft contrast, cinematic depth, highly detailed skin texture, authentic fabric folds, ultra-sharp focus, editorial lifestyle photography.`,
  },
  {
    id: "rp-08",
    name: "Age Progression Slices",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic cinematic portrait, five diagonal vertical slices showing the same woman's face evolving from child to teenager, young adult, middle-aged and elderly, seamless facial progression. Plain top, dark studio background, dramatic soft lighting, detailed skin texture, sharp eyes, realistic ageing effects, symmetrical framing. Fine typographic caption in the lower margin reads "[NAME]". Photorealistic, HDR, ultra-detailed, 8K. Vertical 3:4.`,
  },
  {
    id: "rp-09",
    name: "Luxury Bar Portrait",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic black-and-white cinematic portrait seated in an upscale bar or restaurant, using the reference for facial structure and identity. Same hairstyle as reference — full textured waves, defined jawline, and round dark sunglasses with thin metal frames. Fitted [COLOUR] turtleneck, sleek modern smartwatch with the name "[NAME]" set as the watch face wallpaper. She rests her head thoughtfully on one hand with an intense, contemplative expression, holding a glass of red juice in the other. White tablecloth, background softly blurred shelves of premium bottles, warm ambient light. Cinematic lighting, soft shadows, luxury lifestyle aesthetic, editorial fashion photography, high-contrast monochrome, shallow depth of field, photorealistic skin texture, 85mm lens, f/1.8, bokeh, HDR, hyper-realistic, studio-grade photography. Aspect ratio 4:5.`,
  },
  {
    id: "rp-10",
    name: "Freckled Contact Sheet",
    hasColour: true,
    hasName: true,
    promptTemplate: `Ultra-viral black-and-white luxury casting contact sheet portrait, soft freckles, expressive eyes, natural beauty, arranged in a balanced 2x2 film-frame grid. Fitted [COLOUR] turtleneck, medium silver hoop earrings, loose textured updo with face-framing strands. Each frame a different intimate angle: direct eye contact over the shoulder, elegant side profile with lifted chin, playful candid smile, thoughtful beauty shot resting her face on her hand. Small casting-slate text in the corner reads "[NAME]". Minimalist studio background with soft tonal gradients. Shot on black-and-white film stock, cinematic fine-art fashion photography, ultra-realistic skin texture, visible freckles, subtle film grain, soft diffused lighting, shallow depth of field, high contrast monochrome, editorial beauty photography, analog look, 50mm lens, hyper-realistic, ultra-sharp focus.`,
  },
  {
    id: "rp-11",
    name: "Birthday Number Poster",
    hasColour: true,
    hasName: true,
    promptTemplate: `Minimalist birthday poster, 9:16 portrait. Giant bold black number with a realistic die-cut paper effect on a pure white background, small caption beneath reading "[NAME]". The subject from the reference photo emerges naturally through the cutout, matching her facial features, hairstyle, skin tone and appearance exactly. Crisp [COLOUR] button-down shirt with sleeves slightly rolled, tailored black trousers, a classic wristwatch, clean white trainers. Confident, friendly smile, one hand resting casually on the edge of the number. Ultra-photorealistic commercial photography, realistic skin texture, sharp detail, soft natural studio lighting, subtle shadow, clean luxury aesthetic, layered depth, premium magazine-quality campaign design.`,
  },
  {
    id: "rp-12",
    name: "Silhouette Rim Light",
    hasColour: true,
    hasName: true,
    promptTemplate: `Minimalist black-and-white cinematic portrait in strict side profile, calm introspective expression, wearing an elegant [COLOUR] turtleneck. Pure black background with dramatic rim lighting outlining facial contours and hair strands, high-contrast lighting with deep shadow and soft highlight, sharp facial structure and texture. Fine art caption etched subtly along the lower edge reading "[NAME]". Fine art editorial photography, ultra-realistic, clean composition, subtle film grain, 8K.`,
  },
  {
    id: "rp-13",
    name: "Orange Acetate Sunglasses",
    hasColour: false,
    hasName: true,
    promptTemplate: `Studio close-up editorial portrait, strong well-defined facial features with natural skin texture. Black tailored turtleneck under a high-collared black jacket, minimalist contemporary style. Semi-transparent orange acetate sunglasses — rectangular, softly rounded edges, glossy finish, gradient lenses — the only colour element in an otherwise monochrome black-and-white image. A subtle engraving reading "[NAME]" catches the light on one temple arm of the sunglasses. Calm, confident, serious expression, direct gaze. Soft frontal studio light, gentle shadow, even skin tone, cinematic contrast, visible natural texture. f/2.0, ISO 100, hyper-realistic, ultra-sharp focus. Editorial luxury fashion portrait, photorealistic, no illustration.`,
  },
  {
    id: "rp-14",
    name: "Armchair Monochrome",
    hasColour: true,
    hasName: true,
    promptTemplate: `Seated centred in a high-back armchair in a minimal monochromatic studio. Seamless wall and floor in a single solid deep [COLOUR]. Matching jacket and trousers in the same colour over a simple white top, clean white trainers with subtle matching accents, a wristwatch engraved with "[NAME]". Upright, composed posture, both feet flat, hands gently clasped in her lap. Chair matches the colour scheme for a seamless monochrome effect. Soft, even studio lighting, minimal shadow. Ultra-high-resolution, sleek, modern, minimalist, hyper-realistic high-fashion portrait photography.`,
  },
  {
    id: "rp-15",
    name: "Floating App Icons",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K portrait, deeply engrossed in her phone, phone case personalised with "[NAME]". Around her, glowing app icons float gracefully, connected by luminous flowing digital wires symbolising modern connectivity. Soft wavy hair, wearing a [COLOUR] trendy jacket over a casual top, stylish wireless headphones resting around her neck.`,
  },
  {
    id: "rp-16",
    name: "Water Droplets Close-Up",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic close-up portrait under cascading water, face turned slightly in profile. Droplets cling to the skin in perfect detail, beading and running down forehead, nose and jawline. Subtle freckles and natural texture, soft moody lighting against a dark out-of-focus background. Wet strands of hair cling to her face as water flows through it. Eyes gently closed, lashes heavy with droplets. A faint fine-art caption in the lower corner reads "[NAME]". Skin pores, water refraction and fine detail in ultra-sharp 4K clarity, emotional introspective mood, high-end cinematic portrait photography.`,
  },
  {
    id: "rp-17",
    name: "Motion Blur City Calm",
    hasColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic cinematic portrait standing still amid a rushing city crowd, dramatic motion blur. Sharply in focus with soft golden sunlight illuminating her face and hair, glowing halo effect, wearing a [COLOUR] coat. Surrounding people blurred into streaks, emphasising calm amid chaos. Tall buildings on either side reflecting warm morning light, shallow depth of field, softly diffused background. A small editorial credit line reads "[NAME]" in the corner. Emotional, introspective, atmospheric mood, film-style colour grading, 85mm lens aesthetic, bokeh-rich, editorial photography style, ultra-realistic.`,
  },
  {
    id: "rp-18",
    name: "Newspaper Roses",
    hasColour: true,
    hasName: true,
    promptTemplate: `Captivating high-angle full shot, confident and alluring. Long voluminous high ponytail, wearing a [COLOUR] blazer over a black top, black choker, bold [COLOUR] sunglasses and matching lipstick, holding a newspaper reading "[NAME]'s Valentine's Day". Surrounded by a romantic arrangement of red roses and heart-shaped balloons, background a collage of newspapers. Studio shot, softbox lighting, warm inviting atmosphere, hyper-realistic, do not change her face; serious but alluring expression.`,
  },
  {
    id: "rp-19",
    name: "Power Portrait — Seated Lean",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Seated at a three-quarter angle, leaning slightly forward with a relaxed yet commanding posture. Face turned slightly away from camera, not looking at the lens, one side sharply illuminated and the opposite side fading into deep velvety black shadow, contemplative expression. Hands near the chest, fingers gently interlocked. Delicate luxury watch with a slim case, fine bracelet band and "[NAME]" engraved on the case back, a subtle elegant ring on one hand. Tailored black blazer over a silk ivory blouse with a graceful neckline, refined fabric texture and natural folds. Solid seamless black background. Strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture. Hair strands, eyelashes, eye moisture, facial texture, watch face, bracelet reflections and ring all in fine detail. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-20",
    name: "Power Portrait — Side Profile",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Standing in a strong side-profile pose, body turned 90 degrees, chin slightly lifted, composed and authoritative expression. Full profile, not looking at the lens, sharp light cutting across the forehead, nose bridge and jaw while the back half fades into deep black shadow. Arms hanging naturally at her sides, one hand relaxed, the other with a subtle elegant ring visible. Delicate luxury watch with a slim case, fine bracelet band and "[NAME]" engraved on the case back. Tailored black blazer over a silk ivory blouse with a graceful neckline, refined fabric texture and natural folds. Solid seamless black background. Strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture. Fine detail in hair strands, eyelashes, eye moisture, facial texture, watch face, bracelet reflections and ring. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-21",
    name: "Power Portrait — Reclining Arms Crossed",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Seated and leaning back with relaxed confidence, arms crossed loosely, one hand resting over the opposite forearm. Face turned slightly upward and away from camera at a three-quarter angle, not looking at the lens, one side sharply lit and the other dissolving into deep shadow, calm and self-assured expression. Delicate luxury watch engraved with "[NAME]" and a subtle elegant ring. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-22",
    name: "Power Portrait — Hand to Jaw",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Seated and leaning forward, one elbow on the knee, that hand raised with the back of the fingers resting lightly against the jaw and cheekbone, thoughtful deliberate pose. Face at a slight three-quarter angle, not looking at the lens, eyes cast downward or to the side, deeply introspective expression. Other hand relaxed on the opposite knee. Delicate luxury watch engraved with "[NAME]" and a subtle elegant ring. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-23",
    name: "Power Portrait — Hand in Pocket",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Standing with one hand resting in the front pocket of tailored wide-leg trousers, the other hanging naturally, body angled at roughly 45 degrees, weight shifted to one leg, relaxed but commanding stance. Face turned away from the lens at a three-quarter angle, chin level, cool and unreadable expression, one side sharply illuminated and the other dissolving into deep velvety shadow. Delicate luxury watch engraved with "[NAME]" and a subtle elegant ring. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-24",
    name: "Power Portrait — Hands Clasped, Head Bowed",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Seated and leaning forward, both elbows on the knees, hands loosely clasped together between the legs. Head bowed slightly, face angled downward, eyes toward the floor or mid-distance, deep thought or quiet intensity. Top of the head and the back of the hands catch the primary light source while the face sits in partial shadow with subtle detail visible. Delicate luxury watch engraved with "[NAME]" and a subtle elegant ring. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-25",
    name: "Power Portrait — Over-the-Shoulder",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Standing with her back at roughly three-quarters to the camera, body facing away, head turned sharply back over one shoulder toward the camera with a direct, penetrating gaze just past the lens. Shoulders poised and strong, blazer falling cleanly across her back. One arm visible at her side, wrist showing a delicate luxury watch engraved with "[NAME]". Intense, deliberate expression. Sharp directional light across the turned face, one side fully illuminated, the other folding into deep shadow. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-26",
    name: "Power Portrait — Arm Draped Over Chair",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Seated sideways in a chair, one arm draped loosely over the top of the chair back, wrist hanging down relaxed. Body turned at an angle, far shoulder slightly elevated, head turned away from the camera, composed distant expression. Draped arm puts the delicate luxury watch, engraved with "[NAME]" on the case back, prominently on display. Other hand rests on her thigh, a subtle elegant ring visible. Posture reads effortless authority. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-27",
    name: "Power Portrait — Close Crop, Hand Raised",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K cinematic black-and-white portrait in a dramatic chiaroscuro style. Framed in a tight close-up crop from mid-chest upward, one hand raised to approximately collar height, fingers relaxed and slightly open, hovering near the face as if mid-thought. Face at a slight three-quarter angle, not looking at the lens, eyes focused beyond the frame, calm and contemplative expression. Raised hand brings the delicate luxury watch, engraved with "[NAME]", into sharp focus near the centre of the frame, a subtle elegant ring visible. Tailored black blazer over a silk ivory blouse with a graceful neckline. Solid seamless black background, strong directional studio lighting, rich contrast, clean shadow falloff, realistic skin texture, fine detail throughout. 85mm portrait lens look, shallow depth of field, premium commercial photography, ultra-sharp focus, no artificial plastic skin, no extra fingers, no distorted hands. Aspect ratio 4:5.`,
  },
  {
    id: "rp-28",
    name: "Doodle Art Portrait",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hand-drawn colourful doodle art portrait, bold confident coloured ink outlines with playful line-weight variation, whimsical decorative fill patterns in clothing and hair, loose expressive doodle energy. Seated sideways in a chair, one arm draped over the chair back with the wrist hanging relaxed, body turned at an angle, far shoulder slightly higher, head turned away with a composed distant expression. Draped arm displays a black chronograph watch with a detailed metal-link bracelet prominently, other hand resting on her thigh wearing a subtle silver ring, effortless authority in her posture. Sharp blazer over a white shirt with the top buttons open, refined fabric texture and folds. Small doodled banner or ribbon near the shoulder reads "[NAME]" in playful hand-lettering. Bold variable-weight ink outlines on facial features and hands, playful decorative pattern fills in the blazer and accessories, spontaneous hatching in clothing shadow. Clean white background with light doodle flourishes, stars and abstract marks. High-resolution digital illustration, hand-drawn doodle style, confident variable-weight line art, print-ready quality, professional personal-brand composition. No photographic realism, no extra fingers, no distorted hands, no watermark. Aspect ratio 4:5.`,
  },
  {
    id: "rp-29",
    name: "Editorial Magazine Power Stance",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic 8K high-fashion editorial magazine portrait, strong confident styling, dramatic precise lighting, luxury commercial fashion aesthetic. Standing with one hand in the front pocket of tailored trousers, the other hanging naturally, body angled roughly 45 degrees, weight shifted onto one leg for a relaxed confident stance. Face turned from the lens at a three-quarter angle, chin level, composed assured expression. Tailored black blazer over a silk ivory blouse with a graceful neckline, refined fabric texture and folds, delicate luxury watch engraved with "[NAME]" and a subtle elegant ring. Fine detail in hair strands, eye moisture, skin texture, fabric weave, watch face, bracelet reflection and ring detail. Seamless white or light grey background. 85mm lens look, shallow depth of field, editorial-magazine style, ultra-sharp focus, precise studio lighting, commercial fashion photography grade. Aspect ratio 4:5.`,
  },
  {
    id: "rp-30",
    name: "Five Expressions Poster",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic black-and-white poster portrait shown in five vertical sliced panels, each showing a different expression: serious, smiling, laughing, joyful and thoughtful. Wavy hair, cinematic studio lighting, deep shadow, dark black background, high-contrast monochrome photography, modern poster style, minimal aesthetic, sharp facial detail, vertical light strips separating each pose, premium editorial look, small caption along the base reading "[NAME]". Aspect ratio 4:5.`,
  },
  {
    id: "rp-31",
    name: "Fine Art Beauty Close-Up",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic fine art beauty portrait, extreme close-up, only partial face visible: one eye fully visible, partial nose and softly parted lips, cheek texture prominently featured, vertical crop, luxury beauty campaign framing. Pale blue-grey iris with sharp iris detail, soft natural lashes, calm introspective gaze, subtle window-light catchlight. Ultra-realistic skin texture, visible pores and fine peach fuzz, satin-matte finish, no smoothing, naturally luminous skin, natural asymmetry retained. Soft natural daylight through sheer curtains, delicate organic shadow patterns, diffused luminous highlights, gentle tonal transitions, no harsh contrast. Minimal luxury makeup, soft neutral blush, muted nude glossy lips, natural softly feathered brows. Soft wispy [HAIR COLOUR] strands framing the face, airy natural movement, soft dimensional highlights. Minimal pale ivory backdrop fading into creamy tones, tiny fine-art caption reading "[NAME]" in the corner. Quiet luxury beauty editorial, fine art skincare campaign aesthetic, medium-format camera realism, 85 to 110mm portrait lens look, shallow optical depth of field, micro-detail clarity without oversharpening, no CGI or AI-glamour look.`,
  },
  {
    id: "rp-32",
    name: "Cherry Lips Portrait",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic high-resolution close-up portrait, face angled slightly toward the viewer, hair styled to frame the face. Striking eyes with dramatic winged eyeliner and long lashes, full groomed brows, high-gloss red lips slightly parted holding a single ripe cherry by its stem, playful smile inferred. Dramatic diagonal shadow across one side of the face highlighting cheekbones and nose, dark out-of-focus background, centred composition, sophisticated alluring high-fashion mood. Delicate silver necklace at the décolletage engraved with "[NAME]", tight headshot emphasising facial features and the cherry detail.`,
  },
  {
    id: "rp-33",
    name: "Golden Hour Couture",
    hasColour: true,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Ultra-realistic 8K cinematic editorial beauty portrait, exact facial identity preserved — bone structure, face shape, jawline, chin, cheekbones, nose, lips, eye spacing, brow shape, age and natural proportions, no morphing or symmetry correction. Tight editorial close-up from the shoulders up, three-quarter angle, head slightly turned toward camera, eyes locked in an intense soulful gaze, chin tucked into a high textured collar for a dramatic silhouette. Warm golden-hour cinematic lighting across the face, luminous highlights on cheekbones, nose bridge, brow bone and lips, soft shadow falloff, gentle rim light on hair and collar. Editorial skin smoothing with texture preserved, radiant golden sheen. Cool silver-champagne eyeshadow shimmer on the lid and inner corner blending into a warm taupe crease shade, clean luminous brow-bone highlight, defined lashes, brightened under-eye. Natural full brows, softly glossy natural-tone lips. Soft voluminous [HAIR COLOUR] hair with full bangs curving into loose wavy curtain layers, airy windswept flyaways. High-fashion [COLOUR] textured garment with a dramatic raised collar, richly woven with subtle metallic threads, a tiny embroidered "[NAME]" along the inner collar seam. Warm golds, deep charcoals and soft neutral shadow, cinematic contrast, softly blurred background. Professional studio fashion photography, shallow depth of field, ultra-sharp focus on the eyes, photorealistic detail, magazine-ready 8K finish.`,
  },
  {
    id: "rp-34",
    name: "Keychain Miniature",
    hasColour: true,
    hasName: true,
    promptTemplate: `Playful hyper-realistic portrait built around a scale illusion. A smiling adult woman stands indoors in a modern softly lit living space, facing the camera directly with a warm confident expression. In the foreground she holds up a leather keychain close to the lens; the leather strap has visible stitching and embossed text reading "[NAME]" on a metal ring, shallow depth of field keeping the keychain sharp while her face stays clearly recognisable but slightly softer. Hanging from the ring is a miniature hyper-realistic version of herself, rendered as if an action-figure-scale human, clinging to the ring with one raised arm, legs dangling naturally with believable weight. The miniature mirrors her real features, hairstyle and a coordinated [COLOUR] outfit with realistic fabric folds. Soft cinematic lighting: foreground light on the leather, metal and miniature figure, warm diffused background light for a cosy modern interior, subtle reflections on the metal ring. Neutral contemporary background, softly blurred, nothing distracting. Warm natural colour grading emphasising skin tone, leather and interior light, clean realistic shadow reinforcing scale. Lighthearted, clever, imaginative mood blending realism with playful surrealism through perspective and scale rather than fantasy elements. Ultra-high realism, shallow depth of field, natural skin and fabric texture, clean compositing, no cartoon effects.`,
  },
  {
    id: "rp-35",
    name: "Honest Realism Portrait",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Ultra-realistic close-up portrait of a woman in her early-to-mid 40s, naturally sun-exposed skin, visible fine lines and subtle crow's feet, natural pores, freckles and light sun spots clearly visible, no skin smoothing, no retouching, honest realism. Three-quarter profile facing right, eyes looking slightly upward with a calm reflective expression, soft relaxed features, gentle closed-mouth smile, natural lips with no lipstick. Light blue eyes with sharp catchlight, natural soft brows, [HAIR COLOUR] bob. Warm soft directional light from the left as if overcast window light, smooth falloff, subtle shadow on the right, no harsh contrast. Neutral muted fully-blurred background, subject cleanly isolated. Warm earthy colour palette, realistic slightly golden skin tones, no colour grading effects, no cinematic stylisation. A discreet, barely-there monogram "[NAME]" as the only jewellery. 85 to 105mm portrait lens, f/2 to f/2.8, extremely shallow depth of field, sharp focus on the near eye, studio-quality clarity. Editorial realism, minimalist composition, no artificial enhancement, no plastic skin, no airbrushing, no glam makeup, no HDR, no exaggerated sharpness.`,
  },
  {
    id: "rp-36",
    name: "Staircase Silhouette",
    hasColour: true,
    hasName: true,
    promptTemplate: `Low-angle fashion photograph of a woman in a [COLOUR] ruched bodycon mini dress, posing on an elegant staircase, ascending with one hand on the handrail, torso turned toward the camera in an over-the-shoulder look, gold metallic stilettos, a delicate anklet engraved with "[NAME]". Detailed fabric texture, warm neutral tones, cinematic lighting, sharp focus on the dress and pose, worm's-eye upward angle. Hyper-realistic, using uploaded photo as the face reference.`,
  },
  {
    id: "rp-37",
    name: "Coffee Shop Candid",
    hasColour: true,
    hasName: true,
    promptTemplate: `Candid lifestyle portrait of a stylish woman in her 40s sitting in a cosy artisan coffee shop, holding a ceramic latte cup with her name "[NAME]" handwritten on the side in marker, detailed latte art, natural makeup, small gold hoop earrings. [COLOUR] denim jacket over a ribbed neutral tank top, relaxed olive-green trousers. Warm natural window light, shallow depth of field, soft cinematic tones. Rustic café interior, wooden tables, chalkboard menus, shelves with jars and books in the background, people softly blurred. Photorealistic lifestyle photography, 35mm lens look, creamy bokeh, warm colour grading, cosy editorial aesthetic, high detail, natural skin texture, relaxed pose, fair freckled skin, blue-grey eyes, hyper-realistic, do not alter her face.`,
  },
  {
    id: "rp-38",
    name: "Fireside Knit Elegance",
    hasColour: true,
    hasName: true,
    promptTemplate: `Soft editorial portrait seated indoors by a modern fireplace, wearing a [COLOUR] knit sweater dress and layered gold jewellery, holding a porcelain teacup monogrammed with "[NAME]", relaxed elegant posture. Neutral interior, large windows with a blurred city skyline. Warm natural light, beige and off-white palette, clean Pinterest It-Girl aesthetic, ultra-realistic skin texture, cosy luxury winter vibe, high detail.`,
  },
  {
    id: "rp-39",
    name: "Blown Kiss Beauty",
    hasColour: true,
    hasName: true,
    promptTemplate: `Cinematic studio beauty portrait, head tilted slightly down, eyes gently closed, lips softly pursed. Hand held in front of the mouth at lip height, palm facing the camera as if blowing a kiss, fingers gently cupped, wrist subtly bent, space between palm and face so the gesture reads as intentional and airy. Tailored [COLOUR] blazer with a clean neckline, minimal gold jewellery, small hoop earrings, delicate necklace engraved with "[NAME]". Soft cinematic studio lighting, sculpted highlights on cheekbones and jaw, gentle shadow falloff, deep neutral background. 85mm lens, f/2.0, ISO 200, shallow depth of field, ultra-realistic skin texture. Luxury, intimate, confident, high-fashion editorial mood. Don't change my face.`,
  },
  {
    id: "rp-40",
    name: "Silent Confidence Beauty",
    hasColour: false,
    hasName: true,
    promptTemplate: `Expressive high-fashion beauty portrait, calm confident pose, upper body frontal, head tilted slightly, one hand raised with fingertips gently touching the lips, eyes fully closed for an intimate controlled atmosphere. Sharp focus on face and hand, background softly falling away. Black tailored blazer with clean structured lines, no visible garment underneath. Statement silver geometric earring, several sculptural silver rings on the raised hand engraved with "[NAME]", long pointed stiletto black nails with high-gloss finish, delicate thin gold bracelets for contrast. Natural makeup, calm confident sensual expression, facial features preserved exactly. Dark neutral anthracite-to-black studio backdrop. Soft directional studio light from an angled top-front position, gentle highlights on hair, jewellery and nails, subtle shadow sculpting. Ultra-high sharpness, clean modern rendering, magazine-cover aesthetic, photorealistic studio quality, 4K-8K, cinematic depth. Don't change my face.`,
  },
  {
    id: "rp-41",
    name: "Leaf Shadow Profile",
    hasColour: false,
    hasName: true,
    promptTemplate: `Ultra-realistic black-and-white side-profile portrait, exact features and hair preserved, signature glam makeup. Strong directional sunlight casts dramatic leaf-pattern shadows across the face. Camera close, capturing the near side of the face in sharp detail — eye, lashes, brow, cheekbone, nose and lips. Eye bright, reflective, looking slightly upward, long separated lashes, soft natural eye, highly detailed skin texture with natural pores. Lips slightly parted with a soft sheen. Hair falling loosely with bright sunlit strands creating contrast. Fine editorial caption in the lower corner reads "[NAME]". High-contrast cinematic lighting, deep shadows and intense highlights emphasising depth and structure, 8K clarity, editorial, dramatic, photorealistic finish.`,
  },
  {
    id: "rp-42",
    name: "Peach Rose Elegance",
    hasColour: true,
    hasName: true,
    promptTemplate: `A woman in [COLOUR] sits on a white modern sofa, peach roses wrapped in green placed beside her, a small gift tag on the roses reading "[NAME]", matching peach balloons behind her. Simple background, natural sunlight illuminating her face, exuding elegance and femininity. High-focus photography, white minimalist style, high-definition detail, high resolution, hyper-realistic.`,
  },
  {
    id: "rp-43",
    name: "Vanity Morning Light",
    hasColour: true,
    hasName: true,
    promptTemplate: `Soft, feminine vanity scene. Seated at a minimal vanity surrounded by perfume bottles, makeup brushes and a small mirror with "[NAME]" etched delicately into one corner, wearing a silky [COLOUR] robe or neutral lounge set, hair half done. Natural light, airy, intimate beauty-content mood, hyper-realistic.`,
  },
  {
    id: "rp-44",
    name: "Golden Hour Car Selfie",
    hasColour: true,
    hasName: true,
    promptTemplate: `Golden-hour car selfie inside a luxury beige leather interior. Oversized cream sunglasses pushed onto her head, glossy lips, minimal makeup, [COLOUR] knit top, a keyring fob engraved with "[NAME]" visible on the dashboard. Light streaks across the cheekbone creating a cinematic glow. Relaxed, understated luxury energy, hyper-realistic.`,
  },
  {
    id: "rp-45",
    name: "Scrubs Mirror Selfie",
    hasColour: true,
    hasName: true,
    promptTemplate: `Casual mirror selfie inside a bright luxury apartment with cream walls and minimal decor. [COLOUR] scrubs with "[NAME]" embroidered small on the chest, gold hoops, slick hair, natural makeup, phone partially visible. Relaxed but put-together energy, hyper-realistic.`,
  },
  {
    id: "rp-46",
    name: "Yacht Deck Linen",
    hasColour: true,
    hasName: true,
    promptTemplate: `Wide-brim hat and [COLOUR] linen dress, sitting elegantly on a yacht deck, barefoot, soft beige tones, glowing daylight, golden reflections on water, a monogrammed beach tote nearby reading "[NAME]", luxury vacation photography, calm confidence, lifestyle editorial feel, hyper-realistic.`,
  },
  {
    id: "rp-47",
    name: "Venice Sunset Gown",
    hasColour: true,
    hasName: true,
    promptTemplate: `Cinematic portrait seated elegantly on a luxury wooden boat in Venice at sunset, dramatic strapless [COLOUR] feather gown with a voluminous skirt, sparkling silver heels, diamond jewellery engraved with "[NAME]". Long wavy hair styled with a large bow matching the gown colour, glowing golden-hour lighting, soft bokeh canal reflections, Venetian architecture and bridges in the background. Luxury editorial photography, fashion-magazine style, 85mm lens, f/1.4, shallow depth of field, detailed fabric texture, natural skin tone, graceful confident pose, high-end colour grading, hyper-realistic.`,
  },
  {
    id: "rp-48",
    name: "Angelic Muse",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Poses gracefully like an angel, leaning against a white cubic pedestal engraved with "[NAME]", hands resting delicately on the thighs, one gently touching the cheek. Shoulder-length wavy [HAIR COLOUR] hair falling softly over the shoulders. Short fitted white lace corset-bodice dress, transparent elbow-length gloves adorned with pearls and beads, white high heels with ankle straps and glittered buckles. Large white feathered angel wings extending behind her, voluminous and glowing subtly under the light. Smooth light grey background for elegant contrast. Ethereal, serene, cinematic, modern angelic beauty in high-fashion style, hyper-realistic.`,
  },
  {
    id: "rp-49",
    name: "Pastel Cyber Gamer",
    hasColour: true,
    hasName: true,
    promptTemplate: `Copy face 100% from reference. Long hair styled in pigtails, [COLOUR] crochet top with sleeves, leaning her head on her sleeve against a pastel-pink mechanical keyboard with keycaps spelling "[NAME]", looking straight at camera with a bright expression, cute mood. Room filled with light pink, decorated with posters and embellished lights, warm but slightly vintage atmosphere. Pastel-cyberpunk, gamer-girl mood, dreamy but softly wistful, warm neon glow, smooth finish, multi-knit fabric layers, glossy keyboard plastic, fluffy decorations, dim ambient room lighting.`,
  },
  {
    id: "rp-50",
    name: "Split Personality Portrait",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Conceptual split-personality portrait of a woman in her 40s with [HAIR COLOUR] hair (use uploaded reference image). Vertical split composition: left side rendered in detailed pencil realism, monochrome, small signature reading "[NAME]" in the corner; right side colourful abstract shapes and expressive textures. Explores inner contradiction and dual identity. Contemporary illustration style, mixed-media aesthetic, high detail, strong narrative storytelling.`,
  },
  {
    id: "rp-51",
    name: "Coastal Equestrian Power",
    hasColour: true,
    hasName: true,
    promptTemplate: `Advertisement-style portrait of a fair-skinned woman, hair swept by the wind, wearing a sharply tailored [COLOUR] suit with a crisp white shirt and black tie, monogram "[NAME]" embroidered on the cuff, seated astride a majestic white horse on a sandy beach, gazing toward the horizon with a calm focused expression, the horse's mane and tail caught in the breeze. Low focal length, wide-angle framing capturing the vastness of beach and sky, ocean waves rolling in under a pale blue sky. Mood of luxury, power and freedom, dramatic natural outdoor lighting, clean modern high-fashion photography, hyper-realistic.`,
  },
  {
    id: "rp-52",
    name: "Latte Art Portrait",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic latte-art portrait at the final stage of pouring — the reference person's face already fully formed in real milk foam inside a freshly poured cappuccino, the name "[NAME]" written in cocoa dusting along the rim of the saucer. A hand holds a stainless-steel milk pitcher to the side, finishing the pour with a thin controlled stream touching only the outer edge, face left clean and clearly visible. Ultra-real micro-foam texture, natural bubbles and crema, subtle ripples typical of professional latte art, no illustration look. Ceramic cup on a marble café table, rustic café vibe, warm diffused daylight, linen napkin and ceramic saucer softly out of focus. Photorealistic café photography, shallow depth of field, sharp focus on the latte-art face and cup rim, slight motion blur on the milk stream only, true-to-life colour grading, high-end DSLR look. Real coffee and milk foam only, no painted textures, no watermark. Aspect ratio 4:5.`,
  },
  {
    id: "rp-53",
    name: "Rain Macro Profile",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Extreme close-up macro headshot from the nose upward, glowing skin, [HAIR COLOUR] shoulder-length wavy hair. Highly detailed skin texture, glamorous dramatic makeup, long individual lashes, striking blue eye. Strong cinematic backlighting creating brilliant highlights on water droplets clinging to the skin and a thick textured knitted scarf, a small woven initial "[NAME]" in the corner of the scarf. Heavy rain streaking diagonally across the frame, sharp in the foreground, softly blurred behind. Volumetric lighting, atmospheric realism, 8K macro, hyper-realistic.`,
  },
  {
    id: "rp-54",
    name: "Rugby Player Transformation",
    hasColour: true,
    hasName: true,
    promptTemplate: `Transform the reference photo: turn her into a rugby player — [COLOUR] stripy rugby top with "[NAME]" printed across the shoulders, shorts, athletic legs, holding a rugby ball, a bit of mud, glasses removed. Keep her face exactly as in the reference.`,
  },
  {
    id: "rp-55",
    name: "Baddie Glam Selfie",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Confident glamorous full-body mirror selfie, bold baddie-glam aesthetic. Relaxed hip placement, one arm slightly bent holding the phone with a case reading "[NAME]", shoulders open, effortless powerful posture, sultry self-assured expression, lips softly parted. Long warm [HAIR COLOUR] hair with soft highlights, centre-parted, loose polished curls. Grey eyes, sun-kissed luminous shimmery skin, dramatic smoky eye, defined lashes, sculpted cheekbones, glossy neutral lips. Structured white corset-style spaghetti-strap crop top, light-wash denim jeans with horizontal cut-outs, short black acrylic nails, two silver bracelets including a delicate dangling cross. Minimalist all-white modern living room, clean architectural lines, golden-hour sunlight through large windows casting warm highlights and soft shadow for cinematic depth. Fashion-photography style, full-body framing, 85mm lens, f/2.0, ISO 200, ultra-high resolution, crisp editorial clarity, confident glamorous modern-luxury mood. Don't change my face.`,
  },
  {
    id: "rp-56",
    name: "Bedside Beauty Gaze",
    hasColour: false,
    hasName: true,
    promptTemplate: `Lying on her side on a softly textured bed, head resting naturally, face angled slightly toward camera with a gentle tilt for an intimate close-up. One hand lifted into her hair, relaxed fingers, eyes open with a calm dreamy gaze, lips slightly parted, serene editorial expression. Natural skin texture, softly defined brows, luminous skin, subtle beauty makeup with neutral lips and delicate highlights, a fine chain necklace with a small pendant reading "[NAME]". Loose slightly tousled hair framing the face. Diffused warm natural window light, soft highlights across cheekbones and eyes, gentle shadow falloff. Cinematic, intimate, luxury beauty editorial mood. Canon RF 85mm lens, f/1.8, ISO 200, 1/125s, shallow depth of field, creamy background blur, vogue-inspired beauty portrait, refined realism. Don't change my face.`,
  },
  {
    id: "rp-57",
    name: "Kintsugi Sculpture Portrait",
    hasColour: false,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Hyper-realistic luxury wall-art portrait, face preserved exactly — same bone structure, eyes, nose, lips, skin tone, age and natural expression. Transformed into a black matte sculptural figure with gold kintsugi cracks running across the face, hairline, neck and shoulders, symbolising resilience, power and beauty. Ombré [HAIR COLOUR] hair with dark roots, caramel-light skin complexion. Real face seamlessly embedded into the artwork rather than painted over, maintaining full realism while blending into the gold-cracked black sculpture. A small brushed-gold nameplate mounted beneath the piece reads "[NAME]". Liquid-gold cracks, metallic foil texture, kintsugi gold veins, reflective highlights, luxury art finish. Displayed as a large frameless wall print in a modern luxury hallway with soft grey walls, white trim and door, warm recessed lighting, a white side cabinet, a golden vase with minimalist branches, and a black-gold-white abstract piece alongside. Ultra-photorealistic, luxury interior photography, museum-grade installation, cinematic lighting, crisp detail, 8K. Elegant, powerful, modern, feminine, timeless mood.`,
  },
  {
    id: "rp-58",
    name: "Scrubs Editorial Authority",
    hasColour: true,
    hasName: true,
    promptTemplate: `A confident professional woman in [COLOUR] scrubs with "[NAME]" embroidered on the chest, modern editorial photoshoot. Minimalist luxury setting, soft natural light, neutral tones, clean architectural lines. Poised and self-assured, seated casually against a sculptural white desk, elegant heels, relaxed but powerful posture. Glowing skin, polished makeup, neatly styled hair. Calm authority, quiet confidence, success without excess. High-end fashion photography, sharp focus, soft shadows, magazine quality, contemporary business aesthetic, aspirational yet grounded, hyper-realistic, photorealistic, 85mm lens, shallow depth of field, editorial studio lighting, luxury branding feel.`,
  },
  {
    id: "rp-59",
    name: "Chessboard Queen",
    hasColour: false,
    hasName: true,
    promptTemplate: `Close-up dramatic portrait with intense eyes and freckles, positioned behind a reflective chessboard, the queen piece nearest camera engraved with "[NAME]". Low-angle perspective looking down the centre of the board, large black-and-white chess pieces flanking the sides in sharp focus, blurring toward the foreground. Moody cinematic lighting, dark smoky atmosphere. High-fashion makeup, sleek high ponytail with side-swept bangs. Muted tones with high contrast, sharp detail, 8K, 35mm lens, f/1.8, high-end editorial style, symmetrical composition.`,
  },
  {
    id: "rp-60",
    name: "Neon Tunnel Athlete",
    hasColour: true,
    hasName: true,
    promptTemplate: `Confident athletic woman standing full-body in a futuristic illuminated tunnel, symmetrical composition, strong power stance with one hand on hip. [COLOUR] American-football-inspired bodysuit with "[NAME]" on the chest, corset-style waist detailing, thigh-high boots in a matching tone, holding a matching helmet at her side. Long glossy dark hair in loose waves, natural glam makeup, calm dominant expression. Cinematic lighting with warm neon accents, reflective floor, strong depth and perspective. Ultra-realistic, high-fashion sports-editorial style, sharp focus, high contrast, dramatic shadows, professional studio quality, 8K.`,
  },
  {
    id: "rp-61",
    name: "Friendly Glam B&W",
    hasColour: false,
    hasName: true,
    promptTemplate: `Ultra-realistic 8K black-and-white portrait, facial features unaltered. Friendly gaze directly at the viewer, calm confident expression. Natural smoky-eye makeup, barely-there glossy lips. Head slightly tilted, right hand resting in her lap. High-contrast dramatic cinematic lighting with soft deep shadow beneath the cheekbone and chin. Rich tonal black-and-white range from pure white highlight to deep black shadow. Dark, moody, softly blurred background with a hint of light or reflection in the upper right, faint reflected lettering just legible reading "[NAME]". Hyperrealistic, photorealistic glamour photography, editorial, ultra-detailed, sharp focus, studio portrait. Do not change her facial features.`,
  },
  {
    id: "rp-62",
    name: "Seventies Freckle Portrait",
    hasColour: true,
    hasHairColour: true,
    hasName: true,
    promptTemplate: `Photorealistic 1970s-style close-up portrait, fair skin, prominent freckles across the nose and cheeks, striking green eyes, [HAIR COLOUR] hair styled in loose 1970s waves framing the face. Naturally full lips in a soft peachy-pink, gentle direct expression. Soft lighting highlighting features and skin texture. Dainty gold nose hoop engraved with "[NAME]". A small portion of a [COLOUR] 1970s-patterned blouse visible. Do not change her facial features.`,
  },
  {
    id: "rp-63",
    name: "Neon Milkshake Couture",
    hasColour: false,
    hasName: true,
    promptTemplate: `Neon milkshake couture bombshell, framed tight from upper chest to top of head for extreme clarity. Leaning atop a giant glowing neon milkshake pedestal swirling with hot pink, electric blue, lime green and ultraviolet layers, thick liquid-glass drips, oversized neon whipped-cream peaks, glowing candy shards and holographic sprinkles floating around her, a candy-glass name-tag charm reading "[NAME]" among the sprinkles. Sculpted liquid-glow bodice in layered neon vinyl shaped like melting milkshake waves, embedded micro-crystals, oversized holographic ruffled sleeves, floating candy-glass collar, neon cuffs, sculptural dripping-straw earrings. Avant-garde swirl updo with glowing neon streaks and floating candy beads, hyper-realistic editorial makeup with luminous skin, neon gradient eyeshadow, holographic eyeliner, candy-gloss lips. Leaning slightly toward camera, one hand touching a whipped-cream peak, confident sultry expression. Hyper-detailed neon dessert backdrop, soft frontal key light for skin realism, neon rim lights in pink, teal and violet, high contrast, ultra-glossy, no harsh shadow. 85mm lens, ultra-crisp focus, 8K, hyper-realistic, extreme editorial maximalism.`,
  },
  {
    id: "rp-64",
    name: "Cracked Porcelain Tears",
    hasColour: false,
    hasName: true,
    promptTemplate: `Hyper-realistic fine-art portrait, skin resembling cracked white porcelain with intricate organic fracture lines across the face, neck and shoulders, like dried clay or aged ceramic with natural depth and variation. Calm, solemn, emotionally restrained expression, lips relaxed and slightly parted. Striking vivid ice-blue eyes standing out against the pale fractured surface. Thin translucent tears following the cracks downward, catching soft light. Soft neutral studio-like lighting, minimal clean shadow, simple light-grey background, a fine gold crack near the collarbone tracing out the shape of the letters "[NAME]". Ultra-detailed skin texture, realistic ceramic fractures, photographic realism, fine-art style, high resolution, shallow depth of field, sharp focus on the eyes, minimalist composition, emotional stillness.`,
  },
  {
    id: "rp-65",
    name: "Behind The Scenes Glam",
    hasColour: true,
    hasName: true,
    promptTemplate: `Cinematic editorial portrait seated in a director's chair marked with "[NAME]" on the canvas back, wearing a plush [COLOUR] bathrobe, legs crossed, glossy skin, soft studio lighting. Hair set in large rollers, makeup partially finished. Stylists' hands entering the frame adjusting hair and offering a glass of red wine, another hand holding a film clapperboard. Direct calm-authority gaze at the camera. Luxury behind-the-scenes aesthetic, modern Hollywood dressing room, dark neutral backdrop, shallow depth of field, high-fashion editorial photography, ultra-realistic, sharp focus, cinematic mood, 85mm lens look, premium branding feel.`,
  },
];

export function buildPhotoStudioPrompt(preset: PhotoStudioPreset, colour?: string, aspectRatio = "3:4", vars?: { colour?: string; name?: string; skills?: string; knownAs?: string; hairColour?: string; number?: string; numberColour?: string; word?: string; wordColour?: string; outfit?: string; studioColour?: string; scrubColour?: string; customText?: string }): string {
    let prompt = preset.promptTemplate;
  if (preset.hasCustomText && vars?.customText?.trim()) {
    prompt = `${vars.customText.trim()}\n\nMaintain their exact facial features, skin tone, body shape, and likeness from the reference photo. Must look physically believable and naturally photographed, not CGI or illustrated, natural imperfections, realistic depth, tactile textures, subtle sensor grain, true to life reflections and lighting.`;
  }
    if (preset.hasColour) {
          prompt = prompt.replace(/\[COLOUR\]/g, colour?.trim() || "navy blue");
  }
  if (vars) {
    if (vars.colour?.trim()) prompt = prompt.replace(/\[COLOUR\]/g, vars.colour.trim());
    if (vars.name?.trim()) prompt = prompt.replace(/\[NAME\]/g, vars.name.trim());
        if (vars.hairColour?.trim()) prompt = prompt.replace(/\[HAIR COLOUR\]/g, vars.hairColour.trim());
    if (vars.knownAs?.trim()) prompt = prompt.replace(/\[KNOWN AS DESCRIPTION\]/g, vars.knownAs.trim());
    if (vars.number?.trim()) prompt = prompt.replace(/\[NUMBER\]/g, vars.number.trim());
    if (vars.numberColour?.trim()) prompt = prompt.replace(/\[NUMBER COLOUR\]/g, vars.numberColour.trim());
      if (vars.word?.trim()) prompt = prompt.replace(/\[WORD\]/g, vars.word.trim());
      if (vars.wordColour?.trim()) prompt = prompt.replace(/\[WORD COLOUR\]/g, vars.wordColour.trim());
    if (vars.outfit?.trim()) prompt = prompt.replace(/\[OUTFIT\]/g, vars.outfit.trim());
    if (vars.studioColour?.trim()) prompt = prompt.replace(/\[STUDIO COLOUR\]/g, vars.studioColour.trim());
    if (vars.scrubColour?.trim()) prompt = prompt.replace(/\[SCRUB COLOUR\]/g, vars.scrubColour.trim());
    const rows = (vars.skills || "").split(/\n/).map((x) => x.trim()).filter(Boolean).join(", ");
    if (rows) prompt = prompt.replace(/\[SKILL LABEL\]: \[SKILL VALUE\]/g, rows);
  }
  const ratioDescription =
    aspectRatio === "9:16" ? "a vertical 9:16 portrait orientation (tall and narrow)" :
    aspectRatio === "3:4" ? "a 3:4 portrait orientation" :
    "a square 1:1 format";
  return `${prompt}\n\nCompose the image in ${ratioDescription}.\n\n${PHOTO_STUDIO_NEGATIVE}`;
}

// Pure text-to-image generation with no reference photo at all — used by the
// "Generate without a photo" mode so Vanessa can produce genuinely faceless
// content (e.g. "a woman looking stressed at a desk") without needing a
// client photo on file. No likeness-preservation clause, since there's no
// person's photo to preserve.
export function buildTextOnlyPrompt(customText: string, aspectRatio = "3:4"): string {
  const ratioDescription =
    aspectRatio === "9:16" ? "a vertical 9:16 portrait orientation (tall and narrow)" :
    aspectRatio === "3:4" ? "a 3:4 portrait orientation" :
    "a square 1:1 format";
  return `${customText.trim()}\n\nPhotorealistic, professionally photographed, natural lighting and depth of field, true-to-life textures and detail, not CGI or illustrated.\n\nCompose the image in ${ratioDescription}.\n\n${PHOTO_STUDIO_NEGATIVE}`;
}

export function buildCustomTextWithPhotoPrompt(customText: string, aspectRatio = "3:4"): string {
  const ratioDescription =
    aspectRatio === "9:16"
      ? "a vertical 9:16 portrait orientation (tall and narrow)"
      : aspectRatio === "3:4"
        ? "a 3:4 portrait orientation"
        : "a square 1:1 format";
  return `${customText.trim()}

Maintain their exact facial features, skin tone, body shape, and likeness from the reference photo. Must look physically believable and naturally photographed, not CGI or illustrated, natural imperfections, realistic depth, tactile textures, subtle sensor grain, true to life reflections and lighting.

Photorealistic, professionally photographed, natural lighting and depth of field, true-to-life textures and detail, not CGI or illustrated.

Compose the image in ${ratioDescription}.

${PHOTO_STUDIO_NEGATIVE}`;
}

// ─── Men's Studio — 10 presets ─────────────────────────────────────────────

export const MEN_STUDIO_PRESETS: PhotoStudioPreset[] = [
  {
    id: "ms-01",
    name: "Luxury Medical Executive Portrait",
    hasColour: false,
    promptTemplate: `Ultra-realistic medium-format editorial portrait of a distinguished male medical professional. Same facial features, skin tone, and likeness as the reference photo. He wears a perfectly tailored crisp white button-down shirt with dark premium denim jeans, standing confidently in a minimalist high-end studio environment. Waist-up centered composition with subtle negative space, luxury magazine cover framing. Visible pores and realistic skin texture, subtle peach fuzz, natural tonal variation, hydrated complexion with dimensional realism, RAW unedited skin detail. Clean professional grooming, natural strand separation, subtle texture, realistic volume, soft flyaways visible under studio light. Structured cotton shirt with realistic stitching, fabric tension around shoulders, subtle wrinkles, premium denim texture with authentic weave detail. Relaxed shoulders, one hand in pocket, direct confident gaze, approachable leadership presence, natural asymmetry. Seamless warm gray luxury studio backdrop with subtle gradient. Large octabox key light, controlled rim lighting, soft bounce fill, dimensional facial sculpting, realistic shadow transitions, subtle catchlights. Premium editorial color grading, luxury neutral tones, refined contrast, realistic skin rendering, medium-format tonality. 85mm lens, f/4, ultra-high resolution RAW capture, tack-sharp facial detail with smooth depth falloff. Must look physically believable and naturally photographed, not CGI. Preserve realistic skin texture, authentic lighting behavior, believable material rendering, grounded anatomy, natural imperfections, realistic depth, tactile textures, subtle sensor grain, true-to-life reflections.`,
  },
  {
    id: "ms-02",
    name: "Forbes-Style Healthcare Leader",
    hasColour: false,
    promptTemplate: `Premium studio editorial portrait of a respected male medical specialist, same facial features and likeness as the reference photo. He wears a crisp white shirt tucked into fitted blue jeans, conveying expertise and trustworthiness. Three-quarter portrait with slight angle toward camera, executive magazine style. Hasselblad X2D aesthetic, 90mm lens, f/5.6. Visible pores and realistic skin texture, subtle under-eye texture, natural skin luminosity, realistic facial contours. Hair professionally styled with realistic texture and natural shine, individual strands visible. Luxurious cotton poplin shirt with clean collar structure, premium denim with visible stitching and realistic folds. Arms folded naturally, confident yet approachable expression, leadership energy without appearing corporate. Dark charcoal seamless studio backdrop. Dramatic editorial key light, subtle edge lighting, controlled contrast, sculpted cheekbone highlights, realistic falloff. High-end business publication aesthetic, rich tonal depth, luxury contrast curve. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-03",
    name: "GQ Healthcare Innovator Portrait",
    hasColour: false,
    promptTemplate: `Cinematic chest-up portrait of a modern male physician, same facial features and likeness as the reference photo. He wears an open-collar white shirt and tailored jeans, photographed for a luxury magazine feature. Tight cinematic crop with full-frame DSLR aesthetic, 105mm portrait lens, f/2.8. RAW skin texture, visible pores, realistic gloss on skin, natural complexion variation. Slightly relaxed hair styling, natural volume, subtle texture illuminated by edge light. Crisp shirt collar, realistic cotton weave, authentic denim structure, dimensional fabric folds. Calm confidence, subtle smile, strong eye contact, relaxed posture. Deep matte black luxury studio environment. Single large soft source with dramatic negative fill, cinematic facial modeling, realistic catchlights. Luxury fashion editorial grade, rich blacks, clean whites, realistic skin tones. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-04",
    name: "Modern Medical Icon",
    hasColour: false,
    promptTemplate: `Full-body studio portrait of a highly accomplished male medical professional with architectural symmetry, same facial features and likeness as the reference photo. He wears a fitted white shirt with sleeves slightly rolled and premium blue jeans. Medium-format portrait capture, 110mm lens, f/4.5. Visible pores and realistic skin texture, natural skin depth, subtle facial texture retention. Natural hair styling with realistic volume and strand definition. Crisp cotton shirt with rolled cuffs, realistic fabric tension, premium denim texture. Standing naturally with one hand adjusting cuff, confident editorial posture. Bright luxury studio with soft off-white seamless backdrop. Large overhead softbox combined with side fill, luxury fashion campaign lighting, subtle highlights on fabric. High-key luxury editorial grading, clean whites, refined contrast. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-05",
    name: "Healthcare Visionary Cover Shoot",
    hasColour: false,
    promptTemplate: `Magazine cover upper-body portrait of an influential male medical professional, same facial features and likeness as the reference photo. He wears a tailored white dress shirt and dark denim jeans. 85mm lens, f/3.2, ultra-realistic studio editorial photography. Visible pores, realistic skin depth, subtle peach fuzz, natural facial texture. Professional grooming with natural movement and strand separation. Structured white shirt with visible cotton fibers, realistic folds and seams, luxury denim texture. Direct eye contact, hands relaxed, composed confidence. Elegant stone-gray studio backdrop. Beauty dish key light combined with large fill source, sculpted shadows, editorial contrast. Prestige magazine color grading, realistic highlights and tonal separation. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-06",
    name: "Minimalist Luxury Portrait",
    hasColour: false,
    promptTemplate: `Symmetrical seated portrait of an experienced male doctor on a simple designer chair, same facial features and likeness as the reference photo. He wears a crisp white shirt and jeans. Medium-format camera, 100mm lens, f/5. RAW skin texture, visible pores, realistic tonal variation, dimensional facial rendering. Natural hair texture with realistic shine and volume. Premium cotton shirt with authentic fabric creases, realistic denim construction. Hands lightly clasped, calm confidence, approachable demeanor. Monochromatic luxury studio set. Soft directional key light with subtle rim separation and realistic shadow gradients. Luxury monochromatic editorial palette. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-07",
    name: "Contemporary Healthcare Authority",
    hasColour: false,
    promptTemplate: `Standing three-quarter portrait of a modern male physician with generous negative space, same facial features and likeness as the reference photo. He wears a white shirt and fitted jeans, photographed for a healthcare leadership campaign. 135mm lens, f/4, ultra-sharp studio portraiture. Visible pores, natural skin texture, realistic facial detail and dimensionality. Soft hair texture, realistic grooming, subtle strand definition. Crisp shirt structure, visible stitching, luxury denim texture. Relaxed confidence, natural hand placement, thoughtful expression. Neutral taupe gradient backdrop. Large side softbox, subtle reflector fill, realistic studio contrast. Sophisticated editorial toning with premium skin rendering. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-08",
    name: "Prestige Medical Campaign",
    hasColour: false,
    promptTemplate: `Full-length luxury campaign portrait of an accomplished male medical professional, same facial features and likeness as the reference photo. He wears a pristine white shirt and designer jeans. Hasselblad editorial portrait aesthetic, 80mm lens, f/4. Visible pores and realistic skin texture, subtle skin sheen, realistic depth. Controlled hair styling with natural movement and texture. Premium shirt construction, realistic draping, authentic denim fabric detail. Walking slightly toward camera, confident natural stride. Seamless luxury studio cyclorama. Fashion campaign lighting with controlled highlights and dimensional shadows. Luxury advertising aesthetic, refined whites and balanced contrast. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-09",
    name: "Black & White Editorial Doctor Portrait",
    hasColour: false,
    promptTemplate: `Tight black-and-white magazine feature portrait of a distinguished male physician, same facial features and likeness as the reference photo. He wears a white shirt and denim, captured in timeless monochrome. Leica-inspired portrait photography aesthetic, 90mm lens, f/2.8. Extremely detailed skin texture, visible pores, subtle skin variations preserved in monochrome tonal range. Natural hair texture and realistic strand separation. Crisp shirt contrast, textured denim detail translated into monochrome tonality. Quiet confidence, thoughtful gaze, understated authority. Deep textured charcoal studio backdrop. Classic Rembrandt-inspired studio lighting, dimensional shadow sculpting. Rich black-and-white editorial treatment with medium-format tonal depth. Must look physically believable and naturally photographed, not CGI.`,
  },
  {
    id: "ms-10",
    name: "International Medical Thought Leader",
    hasColour: false,
    promptTemplate: `Premium healthcare campaign portrait of an elite male medical professional, slightly off-center composition, same facial features and likeness as the reference photo. He wears a tailored white shirt and luxury denim, projecting intelligence, warmth, and credibility. Ultra-high-end commercial portrait photography, 85mm lens, f/4.5. Visible pores and realistic skin texture, subtle facial details, realistic gloss reflections, dimensional skin rendering. Natural hair texture, controlled volume, realistic strand detail under studio lighting. Crisp cotton shirt with premium tailoring, realistic seams, authentic denim weave and folds. Relaxed posture, genuine confidence, approachable executive presence. Soft gradient studio backdrop transitioning from warm gray to charcoal. Large cinematic key light, elegant rim light separation, realistic reflections, luxury portrait sculpting. Global luxury campaign aesthetic, refined tonal balance, premium magazine finish. Must look physically believable and naturally photographed, not CGI.`,
  },
  // ── Clinical Scrubs ──────────────────────────────────────────────────────
  {
    id: "cs-01",
    name: "Scrubs — Corridor Confidence Walk",
    hasColour: true,
    promptTemplate: `A confident male medical professional in [COLOUR] scrubs walking purposefully down a modern clinic corridor. Natural overhead lighting. Camera straight on. Editorial medical photography. Clean white walls. Sharp detail. Same facial features as reference photo.`,
  },
  {
    id: "cs-02",
    name: "Scrubs — Consultation Desk Authority",
    hasColour: true,
    promptTemplate: `A male doctor in [COLOUR] scrubs seated behind a clean consultation desk, hands folded, direct eye contact with camera. Soft diffused window light. Clinical setting. Professional editorial photography. Same facial features as reference photo.`,
  },
  {
    id: "cs-03",
    name: "Scrubs — Arms Crossed Clinical",
    hasColour: true,
    promptTemplate: `A male medical professional in [COLOUR] scrubs standing arms crossed in a treatment room. Confident posture. Neutral clinical background. Even studio-quality lighting. Editorial healthcare portrait. Same facial features as reference photo.`,
  },
  {
    id: "cs-04",
    name: "Scrubs — Window Lean Natural Light",
    hasColour: true,
    promptTemplate: `A male clinician in [COLOUR] scrubs leaning against a wall beside a large clinical window. Soft natural light from the left. Relaxed but professional expression. Clean background. Editorial portrait. Same facial features as reference photo.`,
  },
  {
    id: "cs-05",
    name: "Scrubs — Reception Stand Lifestyle",
    hasColour: true,
    promptTemplate: `A male healthcare professional in [COLOUR] scrubs standing at a clinic reception counter, looking at camera. Warm but professional tone. Lifestyle healthcare editorial. Bright modern reception space. Same facial features as reference photo.`,
  },
  {
    id: "cs-06",
    name: "Scrubs — Head and Shoulders Clean",
    hasColour: true,
    promptTemplate: `Close head and shoulders portrait of a male clinician in [COLOUR] scrubs. Clean white or light grey background. Studio lighting. Direct confident gaze. Medical professional editorial photography. Same facial features as reference photo.`,
  },
  {
    id: "cs-07",
    name: "Scrubs — Coffee Cup Casual Clinical",
    hasColour: true,
    promptTemplate: `A male doctor in [COLOUR] scrubs holding a coffee cup, relaxed expression, leaning against a clinic wall. Candid professional lifestyle. Warm natural light. Editorial healthcare photography. Same facial features as reference photo.`,
  },
  {
    id: "cs-08",
    name: "Scrubs — Outdoor Clinic Entrance",
    hasColour: true,
    promptTemplate: `A male medical professional in [COLOUR] scrubs standing outside a modern clinic entrance. Soft natural daylight. Arms relaxed at sides. Professional healthcare editorial portrait. Clean architecture in background. Same facial features as reference photo.`,
  },
  {
    id: "cs-09",
    name: "Scrubs — Stethoscope Detail Portrait",
    hasColour: true,
    promptTemplate: `A male clinician in [COLOUR] scrubs with a stethoscope around their neck, half-body portrait. Looking slightly to the side with confidence. Natural clinic lighting. Editorial medical photography. Same facial features as reference photo.`,
  },
  {
    id: "cs-10",
    name: "Scrubs — Treatment Room Seated",
    hasColour: true,
    promptTemplate: `A male doctor in [COLOUR] scrubs seated on a treatment bed in a bright modern clinic room. Relaxed posture, friendly expression. Natural light. Lifestyle editorial healthcare portrait. Same facial features as reference photo.`,
  },
  // ── David Bailey Editorial — Black & White ───────────────────────────────
  {
    id: "db-01",
    name: "Studio Portrait — White Infinity",
    hasColour: false,
    promptTemplate: `Black and white Hasselblad medium-format studio portrait of a male medical professional, same facial features and likeness as the reference photo. He wears a crisp white shirt with sleeves casually rolled and dark jeans, standing against a seamless white infinity backdrop. Waist-up centered composition, direct eye contact, iconic 1960s British fashion editorial framing. Visible pores and realistic skin texture, subtle facial lines, natural skin depth, RAW monochrome texture retention, realistic tonal transitions. Cleanly styled hair with natural texture, soft strand separation, realistic volume. Crisp cotton shirt rendered with rich monochrome contrast, visible stitching, realistic wrinkles, authentic denim texture. Hands casually in pockets, direct unapologetic gaze, understated confidence, effortless masculinity. Large overhead soft source combined with frontal fill, classic high-key Bailey lighting, clean shadows, luminous skin separation. 80mm lens, f/8, ultra-sharp focus, classic fashion portrait perspective, subtle film grain, deep tonal range. Rich monochrome tonal scale, deep blacks, luminous whites, Ilford HP5-inspired grain structure. Must look like an authentic David Bailey editorial photograph from a luxury fashion archive, physically believable, naturally photographed, realistic skin texture, authentic film grain, genuine studio lighting, grounded anatomy, true monochrome tonal realism.`,
  },
  {
    id: "db-02",
    name: "Soho Street Editorial Lifestyle",
    hasColour: false,
    promptTemplate: `Black and white documentary fashion portrait of a male medical professional, same facial features and likeness as the reference photo. He wears a crisp white shirt and jeans, walking confidently through a quiet urban street as if captured for a Sunday Times Magazine feature. Full-body environmental portrait. Visible pores, realistic skin texture, natural monochrome rendering. Hair with slight movement from walking, realistic strand separation. Crisp shirt catching natural daylight with realistic folds and tension, textured denim. Mid-stride, hands relaxed, focused gaze ahead. Historic city architecture softly falling out of focus behind. Leica M6 aesthetic, 50mm lens, f/4, documentary fashion photography, natural film grain. Overcast London-style daylight, soft contrast, realistic environmental bounce light. Classic documentary black and white with rich gray tonal separation. Must resemble a genuine David Bailey lifestyle editorial, naturally photographed with authentic documentary realism and tactile monochrome detail.`,
  },
  {
    id: "db-03",
    name: "Bare Studio Wall Portrait",
    hasColour: false,
    promptTemplate: `Black and white medium-format film portrait of a male doctor leaning casually against a plain studio wall, same facial features and likeness as the reference photo. He wears a white shirt and jeans. Tight chest-up portrait. Visible pores, realistic skin depth, subtle skin imperfections preserved. Natural hair texture and realistic volume. Crisp cotton shirt with visible weave and dimensional folds. Relaxed shoulders, subtle half-smile, direct engagement with camera. Single large soft light positioned slightly above eye level, classic Bailey simplicity. 100mm lens, f/11. Clean monochrome palette with rich tonal gradation. Must feel like a genuine archive fashion portrait rather than AI-generated imagery.`,
  },
  {
    id: "db-04",
    name: "Studio Chair Editorial",
    hasColour: false,
    promptTemplate: `Black and white Hasselblad studio portrait of a male medical professional seated backwards on a simple wooden chair in a minimalist studio, same facial features and likeness as the reference photo. He wears a white shirt with sleeves rolled and detailed denim. Full-body seated portrait. Visible pores and realistic skin texture, subtle tonal variation. Natural hair styling with realistic strand definition. White shirt sleeves rolled, denim texture highly detailed. Arms resting naturally on chair back, thoughtful expression. Soft directional light creating sculptural facial modeling. 85mm lens, f/5.6. Fine-art monochrome fashion editorial treatment. Must look physically believable and naturally photographed with authentic studio craftsmanship.`,
  },
  {
    id: "db-05",
    name: "Window Light Apartment Portrait",
    hasColour: false,
    promptTemplate: `Black and white documentary portrait of a male medical professional standing beside a large apartment window overlooking a city skyline, same facial features and likeness as the reference photo. He wears a crisp white shirt with realistic drape and textured denim. Environmental portrait. RAW skin texture, visible pores, realistic skin depth. Soft natural hair texture illuminated by window light. Looking out window, reflective and contemplative. Leica documentary photography aesthetic, 35mm lens, f/2.8. Natural side window light creating elegant monochrome contrast. Timeless black and white documentary grading. Must resemble a candid Bailey editorial portrait shot on location.`,
  },
  {
    id: "db-06",
    name: "White Cyclorama Fashion Editorial",
    hasColour: false,
    promptTemplate: `Black and white medium-format commercial fashion portrait of a male physician styled like a luxury magazine cover subject, same facial features and likeness as the reference photo. He wears only a white shirt and jeans. Full-body standing portrait with generous negative space. Visible pores, realistic skin texture, dimensional facial rendering. Natural hair texture and subtle movement. Architectural shirt folds, premium denim structure. Hands loosely crossed, confident stance. 90mm lens, f/8. Clean studio lighting with minimal shadows. High-key monochrome fashion treatment. Must look like a luxury editorial campaign photographed by a master portrait photographer.`,
  },
  {
    id: "db-07",
    name: "Cafe Lifestyle Editorial",
    hasColour: false,
    promptTemplate: `Black and white Leica rangefinder documentary portrait of a male medical professional seated alone in a quiet cafe, same facial features and likeness as the reference photo. He wears a white shirt with sleeves rolled and jeans, a coffee cup nearby on the table. Natural environmental portrait. Visible pores, realistic skin texture, natural facial detail. Soft natural hair styling. Realistic cotton texture, subtle wrinkles, worn denim character. Looking away from camera, candid moment. 50mm lens, f/2. Natural daylight entering through cafe windows. Elegant documentary black and white. Must feel like an authentic magazine feature portrait captured in a real environment.`,
  },
  {
    id: "db-08",
    name: "Bailey Fashion Archive Portrait",
    hasColour: false,
    promptTemplate: `Black and white Hasselblad 500CM-aesthetic tight face portrait of a male medical professional photographed as if for Vogue UK in the late 1960s, same facial features and likeness as the reference photo. He wears a white shirt with collar sharply defined against deep monochrome contrast. Minimal background distraction. Extremely detailed skin texture, visible pores, realistic tonal transitions. Natural hair texture with authentic strand detail. Intense eye contact, minimal expression. 150mm lens, f/11. Classic soft frontal light with subtle shadow definition. Rich silver-gelatin print tonality. Must resemble a genuine vintage Bailey portrait preserved in museum-quality condition.`,
  },
  {
    id: "db-09",
    name: "Industrial Loft Lifestyle Portrait",
    hasColour: false,
    promptTemplate: `Black and white documentary fashion portrait of a male medical professional standing inside an industrial loft studio, same facial features and likeness as the reference photo. He wears a white shirt untucked and premium jeans. Wide environmental composition. Visible pores, natural facial texture, realistic monochrome depth. Slightly relaxed hair styling with realistic volume. Cotton texture, authentic denim wear patterns. Relaxed confidence, leaning lightly against a concrete column. 35mm lens, f/4. Large warehouse windows creating natural directional light. Deep black-and-white editorial contrast with rich gray transitions. Must feel authentic, tactile, and naturally photographed rather than staged AI imagery.`,
  },
  {
    id: "db-10",
    name: "Iconic Close-Up Portrait",
    hasColour: false,
    promptTemplate: `Black and white Hasselblad medium-format ultra-high-resolution close-up portrait of a distinguished male medical professional in a white shirt, filling the entire frame, same facial features and likeness as the reference photo. Tight close-up composition. Visible pores and realistic skin texture, subtle facial asymmetry preserved, dimensional monochrome rendering. Natural hair texture, realistic strand separation. Direct gaze into lens, calm authority, quiet confidence. One large soft source directly above the camera axis, iconic Bailey portrait lighting. 120mm lens, f/8. Museum-quality monochrome tonality, deep blacks, luminous highlights, classic film grain. Must look physically believable and naturally photographed, not CGI. Authentic monochrome film character, realistic skin texture, genuine studio lighting behavior, tactile detail, subtle grain, and timeless editorial realism.`,
  },
];

// ─── Injector Collection — 100 presets across 10 categories ────────────────

export interface InjectorCollectionCategory {
  label: string;
  presetIds: string[];
}

export const INJECTOR_COLLECTION_PRESETS: PhotoStudioPreset[] = [
  // ── Category 1: Scrubs ────────────────────────────────────────────────────
  {
    id: "ic-01",
    name: "Scrubs — Clinic Corridor Stand",
    hasColour: true,
    promptTemplate: `A professional portrait of the person from the reference photo standing confidently in a modern clinic corridor wearing [COLOUR] scrubs, looking directly at camera with a warm professional expression. Soft overhead clinical lighting. Medium shot from waist up. Clean walls, subtle clinic interior visible but softly blurred behind. Ultra-realistic skin texture, natural fabric folds, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-02",
    name: "Scrubs — Consultation Desk Seated",
    hasColour: true,
    promptTemplate: `A professional portrait of the person from the reference photo seated at a consultation desk wearing [COLOUR] scrubs, hands resting naturally on the desk, confident and approachable expression. Soft warm window light from the side. Eye-level medium portrait, shoulders to hands visible. Clean minimal desk surface, neutral clinic background softly blurred. Honest editorial realism, no airbrushing. Same facial features as reference photo.`,
  },
  {
    id: "ic-03",
    name: "Scrubs — Arms Crossed Treatment Room",
    hasColour: true,
    promptTemplate: `A professional portrait of the person from the reference photo standing with arms loosely crossed in a modern treatment room wearing [COLOUR] scrubs, direct eye contact, calm confident expression. Clean clinical background softly blurred. Soft balanced studio-quality lighting. Medium shot, waist up. Natural skin texture, fabric folds realistic. Same facial features as reference photo.`,
  },
  {
    id: "ic-04",
    name: "Scrubs — Walking Clinic Hallway",
    hasColour: true,
    promptTemplate: `A candid-style professional portrait of the person from the reference photo walking naturally through a bright modern clinic hallway wearing [COLOUR] scrubs, relaxed confident stride, warm natural expression. Warm overhead clinic lighting. Motion captured candidly, background hallway softly blurred. Lifestyle editorial quality, authentic and human. Same facial features as reference photo.`,
  },
  {
    id: "ic-05",
    name: "Scrubs — Window Natural Light",
    hasColour: true,
    promptTemplate: `A portrait of the person from the reference photo standing beside a large window in [COLOUR] scrubs, soft natural sidelight gently wrapping the face, calm composed expression with a slight warm smile. Neutral interior wall behind, softly lit room. Medium shot. Skin texture natural and honest, fabric falls realistically. Quiet editorial warmth. Same facial features as reference photo.`,
  },
  {
    id: "ic-06",
    name: "Scrubs — Clean Head and Shoulders",
    hasColour: true,
    promptTemplate: `A clean head-and-shoulders portrait of the person from the reference photo wearing [COLOUR] scrubs against a neutral studio or plain interior background, slight warm smile, direct camera gaze. Balanced frontal studio lighting, no harsh shadows. Sharp editorial focus on face. Natural skin texture, no retouching. Professional and approachable. Same facial features as reference photo.`,
  },
  {
    id: "ic-07",
    name: "Scrubs — Coffee Cup Reception",
    hasColour: true,
    promptTemplate: `A lifestyle portrait of the person from the reference photo holding a takeaway coffee cup in [COLOUR] scrubs, standing at or near a bright modern clinic reception area, relaxed and personable expression. Warm airy interior, soft natural and ambient light. Candid authentic energy. Medium shot. Realistic skin, natural hand positioning, no distorted fingers. Same facial features as reference photo.`,
  },
  {
    id: "ic-08",
    name: "Scrubs — Wall Lean Lifestyle",
    hasColour: true,
    promptTemplate: `A lifestyle editorial portrait of the person from the reference photo leaning lightly against a white clinic wall in [COLOUR] scrubs, one hand relaxed at side or lightly in pocket, authentic comfortable posture, warm direct gaze. Mixed warm clinical and natural light. Medium shot. Honest editorial realism, natural fabric, no artificial retouching. Same facial features as reference photo.`,
  },
  {
    id: "ic-09",
    name: "Scrubs — Outdoors Building",
    hasColour: true,
    promptTemplate: `A professional outdoor portrait of the person from the reference photo standing outside a modern clinic or healthcare building in [COLOUR] scrubs, soft natural overcast or morning daylight, approachable confident expression. Slightly blurred architectural background. Medium portrait shot. Natural skin texture, authentic outdoor lighting. Same facial features as reference photo.`,
  },
  {
    id: "ic-10",
    name: "Scrubs — Over-Shoulder Editorial",
    hasColour: true,
    promptTemplate: `An editorial portrait of the person from the reference photo looking over their shoulder toward the camera wearing [COLOUR] scrubs, three-quarter angle, confident direct gaze, clean minimal background. Directional side lighting creating soft depth. Sharp editorial focus. Authentic skin texture, natural hair placement. Confident and composed. Same facial features as reference photo.`,
  },

  // ── Category 2: White Shirt + Jeans ───────────────────────────────────────
  {
    id: "ic-11",
    name: "White Shirt Jeans — Casual Seated",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo seated casually in a fitted white shirt and dark well-fitted jeans, forearms resting on knees, relaxed confident expression, looking directly at camera. Warm neutral interior background softly blurred. Soft natural and ambient light. Medium shot. Fabric creases naturally, honest editorial realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-12",
    name: "White Shirt Jeans — Plain Background Stand",
    hasColour: false,
    promptTemplate: `A clean editorial portrait of the person from the reference photo standing against a plain cream or light grey wall in a crisp white shirt and well-fitted jeans, direct camera gaze, composed confident expression. Balanced soft studio lighting. Medium portrait shot from waist up. Sharp focus, natural skin texture, clean minimalist aesthetic. Same facial features as reference photo.`,
  },
  {
    id: "ic-13",
    name: "White Shirt Jeans — Coffee Shop",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo in a bright warm coffee shop, wearing a white shirt slightly relaxed over dark jeans, hands wrapped naturally around a coffee cup, relaxed authentic expression. Warm bokeh interior background. Soft ambient café lighting. Candid editorial feel. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-14",
    name: "White Shirt Jeans — Golden Hour Outdoors",
    hasColour: false,
    promptTemplate: `A warm outdoor portrait of the person from the reference photo in a fitted white shirt and jeans at golden hour, warm backlight glowing softly around the hair and shoulders, natural park or urban setting behind softly blurred. Relaxed confident expression, slight squint from natural light. Lifestyle editorial quality. Medium portrait shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-15",
    name: "White Shirt Jeans — Arms Crossed Direct",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with arms loosely crossed, wearing a white shirt and jeans, direct eye contact, confident composed expression. Clean neutral interior or soft studio background. Balanced directional lighting. Waist-up medium shot. Natural skin and fabric texture, no airbrushing. Same facial features as reference photo.`,
  },
  {
    id: "ic-16",
    name: "White Shirt Jeans — Thoughtful Off-Camera",
    hasColour: false,
    promptTemplate: `A lifestyle editorial portrait of the person from the reference photo in a white shirt and jeans, looking slightly off-camera with a thoughtful introspective expression. Soft window sidelight. Warm neutral interior. Medium shot, relaxed posture. Authentic quiet mood. Natural skin texture and organic fabric. Same facial features as reference photo.`,
  },
  {
    id: "ic-17",
    name: "White Shirt Jeans — Desk Working",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo seated at a clean modern desk or table in a white shirt and jeans, hand resting on a laptop or open notebook, focused professional expression. Bright modern interior, soft ambient light, clean minimal background. Editorial lifestyle quality. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-18",
    name: "White Shirt Jeans — Architectural Lean",
    hasColour: false,
    promptTemplate: `An elevated editorial portrait of the person from the reference photo leaning against an architectural wall, column, or doorframe in a white shirt and jeans. Strong directional light creating clean shadow detail. Geometric or minimalist background. Fashion-adjacent professional editorial quality. Medium shot, confident posture. Same facial features as reference photo.`,
  },
  {
    id: "ic-19",
    name: "White Shirt Jeans — Side Profile",
    hasColour: false,
    promptTemplate: `A clean side-profile portrait of the person from the reference photo in a white shirt and jeans, calm composed expression, looking forward. Soft dramatic sidelight from in front. Plain neutral background. Editorial simplicity, strong jawline and profile lighting. Medium shot from shoulders up. Same facial features as reference photo.`,
  },
  {
    id: "ic-20",
    name: "White Shirt Jeans — Close Crop Editorial",
    hasColour: false,
    promptTemplate: `A close editorial portrait of the person from the reference photo cropped from shoulders up, white shirt collar visible, in a white shirt and jeans. Strong directional lighting, confident direct gaze, clean editorial quality. Background neutral and clean. Sharp focus on eyes and face. Same facial features as reference photo.`,
  },

  // ── Category 3: Black Jumper + Jeans ──────────────────────────────────────
  {
    id: "ic-21",
    name: "Black Jumper Jeans — Seated Forearms",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo seated in a fitted black long-sleeve crew-neck jumper and dark jeans, elbows on knees, hands loosely clasped, honest editorial realism, looking directly at camera. Warm neutral interior background. Soft window light. Medium shot. Natural skin, fabric, and hand anatomy. Same facial features as reference photo.`,
  },
  {
    id: "ic-22",
    name: "Black Jumper Jeans — Studio Stand",
    hasColour: false,
    promptTemplate: `A clean studio portrait of the person from the reference photo standing in a fitted black crew-neck jumper and dark jeans against a neutral grey or warm cream background, arms relaxed at sides, calm confident expression, direct camera gaze. Soft balanced studio lighting. Medium waist-up portrait shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-23",
    name: "Black Jumper Jeans — Window Sidelight",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo standing near a window in a fitted black jumper and dark jeans, soft natural sidelight creating gentle depth across the face, quiet confident energy, looking toward camera. Soft interior decor background blurred. Medium shot. Calm lifestyle editorial mood. Same facial features as reference photo.`,
  },
  {
    id: "ic-24",
    name: "Black Jumper Jeans — Urban Candid",
    hasColour: false,
    promptTemplate: `A candid lifestyle portrait of the person from the reference photo walking or moving naturally in a fitted black jumper and dark jeans in a modern urban or neutral setting. Bokeh architectural or street background. Natural movement, authentic energy. Medium shot. Editorial realism, natural skin and fabric. Same facial features as reference photo.`,
  },
  {
    id: "ic-25",
    name: "Black Jumper Jeans — Arms Crossed Stand",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with arms loosely crossed in a fitted black jumper and dark jeans, direct confident gaze, calm composed expression. Clean neutral interior or plain background. Directional studio-quality lighting. Waist-up. Strong editorial presence. Same facial features as reference photo.`,
  },
  {
    id: "ic-26",
    name: "Black Jumper Jeans — Chair Seated Relaxed",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo seated on a chair or stool in a fitted black jumper and dark jeans, one leg loosely crossed, relaxed yet authoritative posture, warm studio lighting. Medium shot. Neutral interior background. Comfortable confident editorial mood. Same facial features as reference photo.`,
  },
  {
    id: "ic-27",
    name: "Black Jumper Jeans — Close Dramatic",
    hasColour: false,
    promptTemplate: `A close-up editorial portrait of the person from the reference photo in a fitted black jumper visible from shoulders up. Strong single-source directional lighting, deep shadow on one side, face lit warmly. Dark or near-black neutral background. Emotional dramatic editorial presence without artifice. Sharp focus on eyes. Same facial features as reference photo.`,
  },
  {
    id: "ic-28",
    name: "Black Jumper Jeans — B&W Side Lit",
    hasColour: false,
    promptTemplate: `A black and white portrait of the person from the reference photo wearing a black crew-neck jumper. Strong sidelight from one direction, high-contrast tonal gradation across the face. Film-inspired texture and grain. Deep emotional editorial presence. Tight head-and-shoulders framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-29",
    name: "Black Jumper Jeans — Wall Lean Hands Pockets",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo leaning against a white or concrete wall in a fitted black jumper and dark jeans, hands relaxed in pockets, direct confident look at camera. Clean minimalist composition. Soft even lighting. Medium shot. Authentic editorial lifestyle. Same facial features as reference photo.`,
  },
  {
    id: "ic-30",
    name: "Black Jumper Jeans — Outdoors Overcast",
    hasColour: false,
    promptTemplate: `An outdoor portrait of the person from the reference photo in a fitted black jumper and dark jeans under soft overcast natural light, calm confident expression, relaxed posture. Neutral urban or clean architectural background softly blurred. Medium shot. Natural skin texture, authentic outdoor editorial quality. Same facial features as reference photo.`,
  },

  // ── Category 4: Expressions ───────────────────────────────────────────────
  {
    id: "ic-31",
    name: "Expression — Genuine Warm Smile",
    hasColour: false,
    promptTemplate: `A close portrait of the person from the reference photo with a genuine warm smile, natural laugh lines and facial muscle movement visible, soft flattering studio or window light. Head-and-shoulders framing, neutral background. Authentic joy, not performed. Sharp focus on eyes, natural skin texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-32",
    name: "Expression — Contemplative Serious",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with a serious and contemplative expression, eyes gazing slightly off-camera with quiet intensity. Strong directional sidelight, deep facial shadows. Neutral or dark background. Editorial gravitas without coldness. Tight head-and-shoulders framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-33",
    name: "Expression — Soft Warm Direct",
    hasColour: false,
    promptTemplate: `A portrait of the person from the reference photo with a soft warm expression, direct eye contact, eyes warm and approachable, slight natural smile at the corners of the mouth. Clean neutral background, balanced flattering portrait lighting. Head-and-shoulders frame. Natural skin texture, honest and human. Same facial features as reference photo.`,
  },
  {
    id: "ic-34",
    name: "Expression — Caught In Thought",
    hasColour: false,
    promptTemplate: `A candid editorial portrait of the person from the reference photo caught mid-thought, eyes glancing slightly downward then up to camera, authentic in-between expression of reflection. Soft natural window light. Lifestyle editorial quality. Medium shot. Spontaneous authentic human moment. Same facial features as reference photo.`,
  },
  {
    id: "ic-35",
    name: "Expression — Composed Neutral Power",
    hasColour: false,
    promptTemplate: `A strong editorial portrait of the person from the reference photo with a composed neutral expression, direct gaze to camera, square-on framing. Clean background, soft balanced studio or window light. Confident presence without aggression or coldness. Head-and-shoulders framing. Natural unretouched skin. Same facial features as reference photo.`,
  },
  {
    id: "ic-36",
    name: "Expression — Natural Laugh",
    hasColour: false,
    promptTemplate: `A candid lifestyle portrait of the person from the reference photo caught in a natural, genuine laugh, eyes crinkling, facial muscles moving authentically. Soft warm bokeh background. Warm ambient light. Human and warm, not performative. Medium candid shot. Authentic joy and personality. Same facial features as reference photo.`,
  },
  {
    id: "ic-37",
    name: "Expression — Introspective Film",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with an introspective expression, three-quarter angle, light catching the eyes at a thoughtful moment. Film-quality editorial mood, subtle grain or organic depth. Directional sidelight. Neutral background. Emotional and artistic. Head-and-shoulders tight framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-38",
    name: "Expression — Quiet Charisma",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with a quietly charismatic expression, a subtle confident energy in the eyes and the set of the mouth, half-smiling or composed with warmth beneath. Fashion-adjacent editorial lighting. Neutral background. Head-and-shoulders tight frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-39",
    name: "Expression — Serene Eyes Closed",
    hasColour: false,
    promptTemplate: `A serene editorial portrait of the person from the reference photo with eyes softly closed, chin slightly lifted, peaceful composed expression. Soft wrapping white studio light, even and flattering. Clean neutral background. Calm, introspective, beauty-editorial quality. Head-and-shoulders framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-40",
    name: "Expression — Bold Open Gaze",
    hasColour: false,
    promptTemplate: `A strong portrait of the person from the reference photo with wide-open eyes looking directly and boldly into the camera, honest and unflinching direct gaze. Clean studio backdrop. Balanced bright editorial lighting. Head-and-shoulders tight crop. Natural skin, no retouching, expressive and alive. Same facial features as reference photo.`,
  },

  // ── Category 5: With Patients ─────────────────────────────────────────────
  {
    id: "ic-41",
    name: "With Patient — Consultation Facing",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo warmly and attentively facing a seated patient during a consultation in [COLOUR] scrubs. Both positioned at an angle to camera showing interaction. Authentic warm clinical moment. Soft clinical interior lighting. No medical equipment, no syringes. Patient is an older adult, warm lighting. Same facial features as reference photo.`,
  },
  {
    id: "ic-42",
    name: "With Patient — Beside Treatment Bed",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo standing attentively beside a clinical treatment bed in [COLOUR] scrubs, caring and focused expression, looking at the patient with professional warmth. Soft clinical lighting, clean treatment room setting. No medical equipment or syringes in frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-43",
    name: "With Patient — Clipboard Review",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo in [COLOUR] scrubs reviewing notes on a clipboard alongside a patient in a consultation room, both looking at the clipboard in a natural collaborative moment. Warm clinical lighting. Clean consultation room, no medical equipment. Authentic professional interaction. Same facial features as reference photo.`,
  },
  {
    id: "ic-44",
    name: "With Patient — Tablet Explanation",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo wearing [COLOUR] scrubs showing information on a tablet screen to a patient, both looking at the device, warm professional explanation moment. Clean clinical consultation setting. Soft warm interior lighting. No syringes or medical devices. Authentic interaction. Same facial features as reference photo.`,
  },
  {
    id: "ic-45",
    name: "With Patient — Reassuring Touch",
    hasColour: true,
    promptTemplate: `A warm clinical portrait of the person from the reference photo in [COLOUR] scrubs gently placing a reassuring hand on a seated patient's shoulder. Empathetic, warm, authentic clinical setting. Soft clinical lighting. No medical equipment or syringes. Clean neutral consultation room. Genuine care and professionalism. Same facial features as reference photo.`,
  },
  {
    id: "ic-46",
    name: "With Patient — Shared Laugh",
    hasColour: true,
    promptTemplate: `A candid clinical portrait of the person from the reference photo in [COLOUR] scrubs sharing a natural laugh with a patient in a consultation room, both genuinely warm and relaxed. Authentic human moment. Warm clinical interior lighting. No medical equipment. Clean consultation room. Same facial features as reference photo.`,
  },
  {
    id: "ic-47",
    name: "With Patient — Clinician to Camera",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo in [COLOUR] scrubs looking confidently toward the camera while a patient is visible in a soft blurred background behind them. Professional clinical presence. Warm soft clinical lighting. Medium shot. Clean treatment room background. No medical equipment. Same facial features as reference photo.`,
  },
  {
    id: "ic-48",
    name: "With Patient — Desk Consultation",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo in [COLOUR] scrubs seated across from a patient at a consultation desk, both leaning slightly forward in engaged professional conversation. Warm authentic clinical interaction. Soft interior lighting. Clean consultation room, no medical equipment. Same facial features as reference photo.`,
  },
  {
    id: "ic-49",
    name: "With Patient — Corridor Walk",
    hasColour: true,
    promptTemplate: `A candid clinical portrait of the person from the reference photo in [COLOUR] scrubs walking alongside a patient through a bright clinic corridor, caring professional stride, relaxed warm interaction. Corridor background softly blurred. Natural clinical lighting. Authentic movement and warmth. Same facial features as reference photo.`,
  },
  {
    id: "ic-50",
    name: "With Patient — Consultation Prep",
    hasColour: true,
    promptTemplate: `A clinical portrait of the person from the reference photo in [COLOUR] scrubs preparing for a patient consultation, focused professional moment, patient visible in soft blurred background. Clean clinical setting, no medical equipment in foreground. Warm soft clinical lighting. Professional composure. Same facial features as reference photo.`,
  },

  // ── Category 6: Editorial ─────────────────────────────────────────────────
  {
    id: "ic-51",
    name: "Editorial — Hard Key Light B&W",
    hasColour: false,
    promptTemplate: `High-contrast black and white studio portrait of the person from the reference photo. Hard single key light from camera-left, deep shadow on right cheek, clean white seamless backdrop. Direct confrontational gaze. Film grain texture. Fashion editorial realism. Head-and-shoulders tight framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-52",
    name: "Editorial — Snoot Overhead B&W",
    hasColour: false,
    promptTemplate: `Stark black and white editorial portrait of the person from the reference photo lit with a single overhead snoot or beauty dish. Deep under-eye and cheekbone shadows, sharp catchlight in eyes. White seamless backdrop. Contemporary fashion editorial standard. Head-and-shoulders frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-53",
    name: "Editorial — Close Honest B&W",
    hasColour: false,
    promptTemplate: `A black and white editorial portrait of the person from the reference photo, wide aperture close-up, sharp catchlights in eyes, subtle skin imperfections and natural texture preserved. Unflinching honest editorial quality. Clean neutral background. Head-and-shoulders tight crop. Same facial features as reference photo.`,
  },
  {
    id: "ic-54",
    name: "Editorial — Moody Underexposed B&W",
    hasColour: false,
    promptTemplate: `A slightly underexposed moody black and white portrait of the person from the reference photo. 35mm film aesthetic, visible grain, organic dark tones. Honest skin texture, natural expression. Direct calm gaze. Atmospheric editorial quality. Neutral background. Head-and-shoulders framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-55",
    name: "Editorial — Overhead Shadow B&W",
    hasColour: false,
    promptTemplate: `A dramatic black and white editorial portrait of the person from the reference photo lit with hard overhead lighting casting a deep shadow beneath the nose and chin. Clean studio backdrop. Vintage fashion photography aesthetic. Defined facial structure. Direct gaze. Head-and-shoulders frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-56",
    name: "Editorial — Three-Quarter Motion B&W",
    hasColour: false,
    promptTemplate: `A three-quarter angle black and white editorial portrait of the person from the reference photo, strong jaw and profile caught in profile-to-camera lighting, slight natural hair movement. Film grain. Deep tonal range. Editorial fashion portrait standard. Shoulders to head visible. Same facial features as reference photo.`,
  },
  {
    id: "ic-57",
    name: "Editorial — High-Key White B&W",
    hasColour: false,
    promptTemplate: `A high-key black and white editorial portrait of the person from the reference photo against a bright overexposed white background, subject centre-frame wearing a black top or shirt, stark contrasting simplicity. Powerful fashion editorial standard. Head-and-shoulders or half-body framing. Same facial features as reference photo.`,
  },
  {
    id: "ic-58",
    name: "Editorial — Eyes and Mouth Close",
    hasColour: false,
    promptTemplate: `An extreme close-up editorial portrait of the person from the reference photo cropped to show just the eyes, nose, and mouth against a pure white surround. Black and white toning. Fashion magazine boldness, unflinching directness. Ultra-sharp focus. Same facial features as reference photo.`,
  },
  {
    id: "ic-59",
    name: "Editorial — Over-Shoulder Rim Light B&W",
    hasColour: false,
    promptTemplate: `A black and white editorial portrait of the person from the reference photo turned slightly away, then glancing back over the shoulder toward camera. Dramatic side rim light from behind. Dark background. Editorial tension and strength. Head-and-shoulders frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-60",
    name: "Editorial — Full Body Authority B&W",
    hasColour: false,
    promptTemplate: `A full-body or half-body black and white editorial portrait of the person from the reference photo standing against a plain studio backdrop in tailored or professional clothing. Strong composed posture, direct gaze. Balanced studio lighting. Timeless editorial authority. Same facial features as reference photo.`,
  },

  // ── Category 7: Lifestyle Branding ────────────────────────────────────────
  {
    id: "ic-61",
    name: "Lifestyle — Morning City Walk",
    hasColour: false,
    promptTemplate: `A cinematic lifestyle portrait of the person from the reference photo walking confidently through a bright modern city street, smart casual attire, morning golden light. Confident natural stride. Bokeh urban background. Editorial lifestyle brand quality. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-62",
    name: "Lifestyle — Outdoor Café Table",
    hasColour: false,
    promptTemplate: `A lifestyle brand portrait of the person from the reference photo seated at a sunny outdoor café table, coffee and phone on table, relaxed professional expression. Dappled natural light. Bokeh street and café background. Smart casual attire. Aspirational and human. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-63",
    name: "Lifestyle — Minimalist Home Interior",
    hasColour: false,
    promptTemplate: `A lifestyle brand portrait of the person from the reference photo standing in a modern minimalist home interior near large windows, natural light flooding in, warm and aspirational. Smart casual attire. Interior plants and clean décor softly blurred. Calm confident presence. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-64",
    name: "Lifestyle — Rooftop Golden Hour",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo on a rooftop terrace at golden hour, city skyline or rooftop plants softly blurred behind, confident relaxed posture. Warm golden light. Smart casual or professional attire. Aspirational brand quality. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-65",
    name: "Lifestyle — Creative Studio Work",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo working in a bright creative studio or home office, papers and mood boards artfully around, natural focused expression. Bright natural light. Smart casual attire. Professional lifestyle editorial. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-66",
    name: "Lifestyle — Glass Lobby Entrance",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo walking confidently into a modern glass building lobby, professional attire, purposeful natural movement. Corporate lifestyle editorial quality. Bright interior with architectural lines. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-67",
    name: "Lifestyle — Linen Sofa Interior",
    hasColour: false,
    promptTemplate: `A lifestyle brand portrait of the person from the reference photo seated on a natural linen sofa in a warm styled apartment interior, afternoon light, relaxed and aspirational. Smart casual attire. Warm ambient light. Interior décor softly blurred. Approachable lifestyle warmth. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-68",
    name: "Lifestyle — Wellness Active",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo in a gym or wellness studio setting in quality athletic or activewear, energised natural expression, wide aperture background blur. Clean light-filled wellness environment. Brand health and vitality. Medium lifestyle shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-69",
    name: "Lifestyle — Bookshop Library",
    hasColour: false,
    promptTemplate: `A lifestyle portrait of the person from the reference photo browsing in a warm bookshop or library, smart casual attire, warm ambient light. Rows of books softly blurred behind. Intellectual lifestyle branding. Genuine engaged expression. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-70",
    name: "Lifestyle — Morning Balcony Garden",
    hasColour: false,
    promptTemplate: `A serene lifestyle portrait of the person from the reference photo on a sunlit outdoor balcony or garden, soft morning light, holding a cup of coffee or tea, calm aspirational expression. Nature and greenery softly blurred behind. Smart casual or relaxed attire. Aspirational morning lifestyle. Medium shot. Same facial features as reference photo.`,
  },

  // ── Category 8: Power & Authority ────────────────────────────────────────
  {
    id: "ic-71",
    name: "Power — Open Stance Direct",
    hasColour: false,
    promptTemplate: `A strong editorial portrait of the person from the reference photo standing with feet shoulder-width apart, arms relaxed at sides or hands loosely clasped at front, direct powerful camera gaze, composed and confident. Clean neutral studio background. Balanced strong directional lighting. Medium half-body frame. Professional authority without aggression. Same facial features as reference photo.`,
  },
  {
    id: "ic-72",
    name: "Power — Executive Chair Seated",
    hasColour: false,
    promptTemplate: `An authoritative portrait of the person from the reference photo seated in a high-back executive office chair, leaning slightly back, arms resting naturally, composed confident gaze to camera. Professional interior background, clean and modern. Directional warm lighting. Medium shot. Quiet executive authority. Same facial features as reference photo.`,
  },
  {
    id: "ic-73",
    name: "Power — Arms Folded Forward Lean",
    hasColour: false,
    promptTemplate: `A strong editorial portrait of the person from the reference photo with arms firmly folded and a slight forward lean toward camera, direct powerful gaze. Dark or deep neutral background. Studio quality directional light. Medium shot, waist up. Confident authority, no aggression. Same facial features as reference photo.`,
  },
  {
    id: "ic-74",
    name: "Power — Desk Document Review",
    hasColour: false,
    promptTemplate: `An authoritative portrait of the person from the reference photo standing at a desk reviewing documents with a composed and focused expression, background suggesting an executive or clinical leadership environment. Professional interior lighting. Medium shot. Leadership presence. Same facial features as reference photo.`,
  },
  {
    id: "ic-75",
    name: "Power — Side-Lit Three-Quarter",
    hasColour: false,
    promptTemplate: `A strong editorial portrait of the person from the reference photo at a three-quarter angle with strong directional sidelight, squared shoulders, calm and powerful expression. Minimal neutral background. High-quality studio or window light. Head-and-shoulders frame. Quiet confident power. Same facial features as reference photo.`,
  },
  {
    id: "ic-76",
    name: "Power — Hands Clasped Gradient",
    hasColour: false,
    promptTemplate: `A composed authoritative portrait of the person from the reference photo looking directly into the lens, hands loosely clasped in front. Clean gradient neutral background, professional studio lighting. Medium head-to-waist frame. Authority and presence, warm and human. Same facial features as reference photo.`,
  },
  {
    id: "ic-77",
    name: "Power — Close Chin Up Confidence",
    hasColour: false,
    promptTemplate: `A strong close editorial portrait of the person from the reference photo with a slight upward chin angle, direct confident gaze, composed and still. Head-and-shoulders tight frame. Studio directional lighting, clean background. Subtle confidence and authority without coldness. Same facial features as reference photo.`,
  },
  {
    id: "ic-78",
    name: "Power — Full Length Professional",
    hasColour: false,
    promptTemplate: `A full-length or three-quarter length editorial portrait of the person from the reference photo in professional attire, strong open posture, clean neutral or studio background. Balanced professional studio lighting. Corporate editorial quality. Confident, grounded. Same facial features as reference photo.`,
  },
  {
    id: "ic-79",
    name: "Power — Look-Back Commanding",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo turned slightly away from camera then looking back directly, commanding confident energy. Studio directional lighting with subtle rim light behind. Clean background. Head-to-shoulders frame. Quiet power and movement. Same facial features as reference photo.`,
  },
  {
    id: "ic-80",
    name: "Power — Steps Forward Lean",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo seated on steps or a low surface, leaning forward slightly on elbows, hands loosely together, direct camera gaze. Accessible authority, approachable confidence. Clean architectural or neutral setting. Medium shot. Same facial features as reference photo.`,
  },

  // ── Category 9: Final Editorial Mix ──────────────────────────────────────
  {
    id: "ic-81",
    name: "Editorial Mix — Cinematic Interior Walk",
    hasColour: false,
    promptTemplate: `A cinematic wide portrait of the person from the reference photo walking through a bright modern interior, motion captured naturally in professional attire. Editorial reportage quality, architectural lines framing the subject. Warm directional interior light. Medium-wide shot. Authentic movement. Same facial features as reference photo.`,
  },
  {
    id: "ic-82",
    name: "Editorial Mix — Half-Face Window Drama",
    hasColour: false,
    promptTemplate: `A dramatic editorial portrait of the person from the reference photo with one half of the face lit by hard window light, the other in deep shadow. Black and white or desaturated toning. Powerful emotional depth. Close head-and-shoulders frame. Quiet storytelling. Same facial features as reference photo.`,
  },
  {
    id: "ic-83",
    name: "Editorial Mix — Scrubs Candid Turn",
    hasColour: true,
    promptTemplate: `A candid documentary-style portrait of the person from the reference photo mid-motion, turning naturally toward camera in [COLOUR] scrubs in a clinical setting. Reportage editorial quality, honest natural light. No medical equipment. Medium shot. Authentic human energy. Same facial features as reference photo.`,
  },
  {
    id: "ic-84",
    name: "Editorial Mix — Architectural Late Light",
    hasColour: false,
    promptTemplate: `A warm editorial lifestyle portrait of the person from the reference photo against or within a modern architectural background, late afternoon warm light. Smart casual or professional attire. Narrative lifestyle quality. Medium shot. Directional warm light, deep colours. Same facial features as reference photo.`,
  },
  {
    id: "ic-85",
    name: "Editorial Mix — Hands Frame Portrait",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo with both hands lightly framing or resting near the face, introspective intimate expression. Soft beauty-photographer lighting, clean neutral background. Head-and-shoulders close. Personal and artistic. Same facial features as reference photo.`,
  },
  {
    id: "ic-86",
    name: "Editorial Mix — Scrubs Window Silhouette",
    hasColour: true,
    promptTemplate: `A dramatic editorial portrait of the person from the reference photo in [COLOUR] scrubs standing at a large window overlooking a cityscape or green landscape, backlit by natural light softened by balanced fill light. Silhouette edge glow, face fully visible. Clinical and cinematic. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-87",
    name: "Editorial Mix — Low Angle Dynamic",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo shot from a slight low angle looking up, strong posture, building facade or sky visible behind in soft blur. Professional or smart casual attire. Editorial dynamism and scale. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-88",
    name: "Editorial Mix — Outdoor Steps Authentic",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo seated on concrete steps or an outdoor seat, casual authentic posture, relaxed arms. Overcast natural light, even and clean. Street editorial realism, smart casual attire. Medium shot. Genuine and grounded. Same facial features as reference photo.`,
  },
  {
    id: "ic-89",
    name: "Editorial Mix — Collar Fragment Abstract",
    hasColour: false,
    promptTemplate: `A fashion editorial portrait fragment of the person from the reference photo cropped tightly to show just the collar, lower jaw, and neck. Strong directional lighting on jawline and throat. Abstract editorial fashion composition. Black or deep neutral background. Same facial features as reference photo.`,
  },
  {
    id: "ic-90",
    name: "Editorial Mix — Scrubs Outdoor Full Body",
    hasColour: true,
    promptTemplate: `A full-body editorial portrait of the person from the reference photo in [COLOUR] scrubs in an outdoor setting, natural relaxed confidence, arms at sides or lightly clasped, direct gaze. Soft natural daylight. Clean architectural or garden background. Authentic and aspirational. Full-body frame. Same facial features as reference photo.`,
  },

  // ── Category 10: Extra High-End ───────────────────────────────────────────
  {
    id: "ic-91",
    name: "High-End — Luxury Hotel Lobby",
    hasColour: false,
    promptTemplate: `A high-end lifestyle editorial portrait of the person from the reference photo in a luxury hotel lobby or grand hotel interior, soft warm ambient light, elegant professional attire. Marble, brass, or rich warm interior materials softly blurred. Aspirational and composed. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-92",
    name: "High-End — Gel Accent Light",
    hasColour: false,
    promptTemplate: `A contemporary editorial portrait of the person from the reference photo in a studio setting with a subtle warm amber or deep rose colour-gel accent light behind or to the side, creating a premium editorial colour mood. Main light clean and flattering. Head-and-shoulders frame. Sophisticated and modern. Same facial features as reference photo.`,
  },
  {
    id: "ic-93",
    name: "High-End — Candlelight Film Noir",
    hasColour: false,
    promptTemplate: `A moody atmospheric portrait of the person from the reference photo lit by a single warm candle or table lamp source, dim surrounding environment. Film noir aesthetic, elegant and cinematic. Rich shadow tones, warm face light. Smart attire. Head-and-shoulders frame. Same facial features as reference photo.`,
  },
  {
    id: "ic-94",
    name: "High-End — Mediterranean Terrace",
    hasColour: false,
    promptTemplate: `A luxury lifestyle portrait of the person from the reference photo on a sun-drenched Mediterranean terrace, white-washed walls and blue sky or sea softly blurred behind. Elegant casual attire, warm natural light. Aspirational brand warmth. Medium shot. Same facial features as reference photo.`,
  },
  {
    id: "ic-95",
    name: "High-End — Marble Minimal Interior",
    hasColour: false,
    promptTemplate: `A high-end editorial portrait of the person from the reference photo in a luxury minimalist interior with marble surfaces and warm brass or gold accents, soft warm ambient light. Elegant professional attire. Clean composed medium shot. Editorial interiors brand quality. Same facial features as reference photo.`,
  },
  {
    id: "ic-96",
    name: "High-End — All White High Key",
    hasColour: false,
    promptTemplate: `A striking high-key editorial portrait of the person from the reference photo dressed entirely in white against a pure white background, overexposed edges, bold clean fashion editorial approach. Strong studio lighting, directional and clean. Head-to-waist frame. Graphic and powerful. Same facial features as reference photo.`,
  },
  {
    id: "ic-97",
    name: "High-End — Macro Skin Realism",
    hasColour: false,
    promptTemplate: `An ultra-close editorial beauty portrait of the person from the reference photo shot with macro-style studio lighting, individual skin texture, pores, fine hairs, and facial features rendered in hyper-realistic detail. Fashion editorial skin photography. Clean neutral background. Head-and-face close crop. Same facial features as reference photo.`,
  },
  {
    id: "ic-98",
    name: "High-End — Chiaroscuro Beam",
    hasColour: false,
    promptTemplate: `A cinematic chiaroscuro portrait of the person from the reference photo partially in deep shadow at the edge of a single shaft of natural or studio light. Rich dark tones and warm highlighted face. Atmospheric and cinematic. Clean background. Head-and-shoulders frame. Elegant and dramatic. Same facial features as reference photo.`,
  },
  {
    id: "ic-99",
    name: "High-End — Mirror Reflection",
    hasColour: false,
    promptTemplate: `An editorial portrait of the person from the reference photo and their reflection visible in a large mirror or glass surface, creating a layered double-portrait editorial composition. Fashion photographer style, warm studio or interior light. Both image and reflection sharp and well-composed. Same facial features as reference photo.`,
  },
  {
    id: "ic-100",
    name: "High-End — Grand Architectural Full Length",
    hasColour: false,
    promptTemplate: `A full-length luxury editorial portrait of the person from the reference photo in an impressive architectural setting — a grand marble staircase, high-ceilinged corridor, or landmark interior — elegant professional attire. Strong composed editorial framing. Rich warm interior lighting. High-end fashion photography quality. Same facial features as reference photo.`,
  },
  {
    id: "ic-101",
    name: "Art Deco - Bold Colour Suit",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo wearing a sharply tailored vintage [COLOUR] suit in a bright bold colour, full 1920s art deco glamour styling, against a deep black background with elegant gold geometric art deco accents and sunburst patterns. Luxurious vintage editorial lighting with a soft golden rim light. Medium portrait, waist up, confident expression. Natural skin texture, realistic fabric, fashion-magazine sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-102",
    name: "Art Deco - Polka Dot Glamour",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous editorial portrait of the person from the reference photo wearing a vintage polka dot dress in bright bold colour, art deco 1930s styling, against a deep black background with gold fan-shaped art deco motifs. Rich warm golden lighting, opulent vintage mood. Medium portrait. Realistic skin and fabric texture, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-103",
    name: "Art Deco - Striped Tailoring",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo wearing a bold brightly coloured vintage striped suit or jacket, art deco glamour, against a black background with vertical gold art deco lines and geometric trim. Dramatic soft luxury lighting. Medium portrait, confident pose. Natural skin texture, crisp fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-104",
    name: "Art Deco - Gold Sequin Gown",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo wearing a shimmering gold sequinned vintage gown, full 1920s Gatsby art deco glamour, against a deep black backdrop with radiating gold sunburst patterns. Warm glittering light, opulent mood. Head and shoulders to waist. Realistic skin and sequin texture, high fashion sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-105",
    name: "Art Deco - Velvet Chair Seated",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo seated elegantly in a velvet art deco armchair, wearing a bright [COLOUR] vintage suit, deep black background with gold geometric art deco panelling. Soft warm directional light, lux 1930s mood. Medium seated pose. Natural skin texture, rich fabric realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-107",
    name: "Art Deco - Power Stance",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo standing in a confident power stance wearing a bright [COLOUR] double-breasted vintage suit, art deco glamour, against a black background with bold gold geometric art deco shapes. Strong dramatic luxury lighting. Three-quarter length. Natural skin and crisp tailoring realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-108",
    name: "Art Deco - Profile Elegance",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial side-profile portrait of the person from the reference photo in elegant vintage art deco attire, brightly coloured fabric with subtle geometric pattern, against a black background with delicate gold deco line work. Soft warm rim lighting tracing the profile. Refined luxurious mood. Realistic skin texture, fashion sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-109",
    name: "Art Deco - Cocktail Glamour",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo holding a vintage coupe glass in a glamorous 1930s art deco setting, wearing a bright bold-coloured cocktail dress, deep black background with gold sunburst and chevron motifs. Warm opulent lighting. Medium portrait. Realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-110",
    name: "Art Deco - Full Length Statement",
    hasColour: true,
    promptTemplate: `An ultra-realistic full-length luxury editorial portrait of the person from the reference photo in a striking bright [COLOUR] vintage art deco ensemble, posed elegantly against a deep black background with grand gold geometric art deco architecture and sunburst detailing. Cinematic warm glamour lighting. Full body, fashion-editorial framing. Natural realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-111",
    name: "Leopard - Clinic Corridor Stand",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing confidently in a modern clinic corridor wearing stylish leopard print scrubs, with hot pink accessories and accents visible in the softly blurred background. Warm soft clinical lighting. Medium shot waist up, warm professional expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-112",
    name: "Leopard - Consultation Desk Seated",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo seated at a consultation desk wearing leopard print scrubs, with hot pink decor and accessories softly blurred in the background, hands resting naturally, confident approachable expression. Soft warm side light. Eye-level medium portrait. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-113",
    name: "Leopard - Arms Crossed Treatment Room",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing with arms loosely crossed in a modern treatment room wearing leopard print scrubs, with hot pink accents in the blurred background, calm confident expression and direct eye contact. Balanced soft studio-quality lighting. Medium shot waist up. Natural skin texture, realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-114",
    name: "Leopard - Walking Clinic Hallway",
    hasColour: false,
    promptTemplate: `An ultra-realistic candid professional portrait of the person from the reference photo walking through a bright clinic hallway wearing leopard print scrubs, with hot pink accessories and decor softly blurred behind. Natural soft daylight, energetic approachable mood. Three-quarter framing. Realistic motion, skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-115",
    name: "Leopard - Window Natural Light",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo by a large window in soft natural light wearing leopard print scrubs, with hot pink accents in the blurred interior background, serene confident expression. Gentle directional daylight. Medium head and shoulders to waist. Honest realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-116",
    name: "Leopard - Clean Head and Shoulders",
    hasColour: false,
    promptTemplate: `An ultra-realistic clean professional head-and-shoulders portrait of the person from the reference photo wearing leopard print scrubs, with a soft blurred background carrying subtle hot pink tones. Bright even flattering lighting, warm confident smile. Crisp editorial sharpness, natural skin texture, realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-117",
    name: "Leopard - Coffee Cup Reception",
    hasColour: false,
    promptTemplate: `An ultra-realistic lifestyle professional portrait of the person from the reference photo holding a coffee cup near a sleek clinic reception wearing leopard print scrubs, with hot pink accessories and branding softly blurred behind. Warm inviting light, relaxed confident mood. Medium portrait. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-118",
    name: "Leopard - Wall Lean Lifestyle",
    hasColour: false,
    promptTemplate: `An ultra-realistic relaxed lifestyle portrait of the person from the reference photo leaning casually against a clean wall wearing leopard print scrubs, with hot pink decor accents in the soft background, easy confident expression. Warm soft lighting. Three-quarter framing. Natural realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-119",
    name: "Leopard - Outdoors Building",
    hasColour: false,
    promptTemplate: `An ultra-realistic relaxed professional portrait of the person from the reference photo standing outdoors against a clean modern building exterior wearing leopard print scrubs, with hot pink accessory accents, soft natural golden light, approachable confident mood. Medium shot. Realistic skin and fabric texture, editorial quality. Same facial features as reference photo.`,
  },
  {
    id: "ic-120",
    name: "Leopard - Bold Editorial Stance",
    hasColour: false,
    promptTemplate: `An ultra-realistic bold editorial portrait of the person from the reference photo in a confident power stance wearing statement leopard print scrubs, with vivid hot pink lighting accents and decor in the background, strong fashion-editorial mood. Dramatic balanced lighting. Three-quarter length. Natural skin texture, crisp realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-301",
    name: "Art Deco - Satin Gown Standing",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo standing tall in a bright jewel-toned satin gown, full 1920s art deco glamour, against a deep black background with radiating gold sunburst patterns. Opulent warm lighting, soft sheen on the satin. Three-quarter length. Natural skin texture, realistic fabric drape, fashion-magazine sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-302",
    name: "Art Deco - Velvet Suit Pockets",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo in a sharply tailored bright [COLOUR] velvet suit, hands relaxed in pockets, confident art deco glamour, against a black background with vertical gold deco lines. Warm directional luxury lighting. Medium portrait, waist up. Realistic skin and rich velvet texture, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-303",
    name: "Art Deco - Geometric Backdrop Close",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous close editorial portrait of the person from the reference photo wearing a bright jewel-toned blouse, set against a bold black-and-gold geometric art deco backdrop with chevrons and fans. Soft warm glamour lighting. Head and shoulders. Natural realistic skin texture, crisp detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-304",
    name: "Art Deco - Gold Folding Screen",
    hasColour: true,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo in a bright [COLOUR] vintage art deco dress, posed beside an ornate gold lacquered art deco folding screen in a dark room. Warm opulent lighting. Three-quarter length. Realistic skin and fabric detail, fashion sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-305",
    name: "Art Deco - Chevron Suit Seated",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo seated elegantly wearing a bold bright chevron-patterned vintage suit, against a deep black background with gold geometric art deco accents. Soft warm side light. Medium seated pose. Natural skin texture, crisp tailoring realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-306",
    name: "Art Deco - Over the Shoulder",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous editorial portrait of the person from the reference photo glancing back over one shoulder, wearing a bright sequinned wrap, against a black background with a radiant gold art deco fan motif. Warm glittering light. Medium portrait. Realistic skin and sequin texture, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-307",
    name: "Art Deco - Marble and Gold",
    hasColour: true,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo in a bright [COLOUR] tailored vintage suit, posed against a black marble wall with inlaid gold art deco patterns. Cinematic warm lighting. Medium portrait, confident expression. Natural skin and fabric realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-308",
    name: "Art Deco - Champagne Coupe Glamour",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo holding a vintage champagne coupe, wearing a bright bold-coloured cocktail dress, in a glamorous black-and-gold art deco setting with chevron motifs. Warm opulent lighting. Medium portrait. Realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-309",
    name: "Art Deco - Hands on Hips Power",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo standing confidently with hands on hips in a bright [COLOUR] double-breasted vintage suit, against a black background with a bold gold sunburst. Strong dramatic luxury lighting. Three-quarter length. Natural skin and crisp tailoring realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-310",
    name: "Art Deco - Reclining Chaise",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous editorial portrait of the person from the reference photo reclining elegantly on a velvet chaise longue, wearing a bright polka dot vintage gown, against a deep black wall with gold art deco panelling. Soft warm luxury lighting. Full pose. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-311",
    name: "Art Deco - Striped Trouser Suit",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo standing in a bold brightly coloured striped trouser suit, art deco glamour, against a black background with gold geometric trim. Dramatic soft lighting. Three-quarter length, confident pose. Natural skin texture, crisp fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-312",
    name: "Art Deco - Beaded Fringe Dress",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous editorial portrait of the person from the reference photo wearing a bright beaded fringe vintage dress, full 1920s art deco glamour, against a black background with gold sunburst patterns. Warm glittering light. Medium portrait. Realistic skin and beadwork texture, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-313",
    name: "Art Deco - Mirror Reflection",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo and their reflection in an ornate gold art deco mirror, wearing a bright vintage suit, in a dark luxurious room. Warm interior lighting, layered composition. Both image and reflection sharp. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-314",
    name: "Art Deco - Satin Cape Drape",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo in a bright jewel-toned gown with a dramatic draped satin cape across the shoulders, against a black background with gold art deco sunbursts. Cinematic warm lighting. Three-quarter length. Realistic skin and fabric sheen. Same facial features as reference photo.`,
  },
  {
    id: "ic-315",
    name: "Art Deco - Seated Leaning Forward",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo seated and leaning forward with elbows on knees in a bright [COLOUR] tailored vintage suit, against a black background with gold geometric art deco accents. Soft warm directional light. Medium pose, engaged expression. Natural skin and fabric realism. Same facial features as reference photo.`,
  },
  {
    id: "ic-316",
    name: "Art Deco - Full Length Staircase",
    hasColour: false,
    promptTemplate: `An ultra-realistic full-length luxury editorial portrait of the person from the reference photo descending a black marble staircase with an ornate gold balustrade, wearing a bright flowing vintage gown, art deco grandeur. Cinematic warm lighting. Full body. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-317",
    name: "Art Deco - Profile with Gold Fan",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous editorial side-profile portrait of the person from the reference photo holding an elegant gold art deco hand fan, wearing a bright jewel-toned dress, against a black background with delicate gold line work. Soft warm rim lighting. Refined luxurious mood. Realistic skin texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-318",
    name: "Art Deco - Colour Block Suit",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo in a bright [COLOUR] colour-block vintage suit, art deco styling, against a strong black-and-gold geometric backdrop. Bold dramatic lighting. Medium portrait, confident pose. Natural skin and crisp fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-319",
    name: "Art Deco - Satin Gown Gold Light",
    hasColour: false,
    promptTemplate: `An ultra-realistic luxury editorial portrait of the person from the reference photo in a bright satin vintage gown bathed in soft pools of golden light, against a deep black background with gold art deco sunburst detailing. Opulent glamorous mood. Three-quarter length. Realistic skin and fabric sheen. Same facial features as reference photo.`,
  },
  {
    id: "ic-320",
    name: "Art Deco - Three Quarter Confident",
    hasColour: true,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo in a three-quarter confident pose wearing a bright [COLOUR] vintage suit, against a black background with a gold art deco panel. Warm cinematic lighting. Waist up. Natural skin and fabric realism, fashion sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-321",
    name: "Art Deco - Glamour Close Up",
    hasColour: false,
    promptTemplate: `An ultra-realistic glamorous close-up editorial portrait of the person from the reference photo with a bright jewel-tone neckline, soft golden glamour lighting, against a deep black background with subtle gold art deco shimmer. Refined luxurious mood. Tight head and shoulders. Natural realistic skin texture and crisp detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-401",
    name: "Leopard - Reception Smile",
    hasColour: false,
    promptTemplate: `An ultra-realistic lifestyle professional portrait of the person from the reference photo smiling warmly at a sleek clinic reception wearing leopard print scrubs, with hot pink accessories and branding softly blurred behind. Warm inviting light, friendly confident mood. Medium portrait. Natural skin texture, realistic fabric and leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-402",
    name: "Leopard - Holding Tablet",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo holding a tablet in a modern clinic wearing leopard print scrubs, with hot pink accents in the softly blurred background, focused approachable expression. Soft balanced lighting. Medium shot. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-403",
    name: "Leopard - Open Coat Over Scrubs",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo wearing leopard print scrubs under an open clean clinical coat, with hot pink decor accents softly blurred behind. Bright even lighting, confident expression. Medium shot waist up. Natural skin texture, realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-404",
    name: "Leopard - Laughing Candid",
    hasColour: false,
    promptTemplate: `An ultra-realistic candid lifestyle portrait of the person from the reference photo laughing naturally in a bright clinic space wearing leopard print scrubs, with hot pink accessories softly blurred behind. Warm natural light, joyful relaxed mood. Three-quarter framing. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-405",
    name: "Leopard - Arms Folded Doorway",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing with arms folded in a clinic doorway wearing leopard print scrubs, with hot pink accents in the blurred interior behind, calm confident expression. Soft directional light. Medium shot. Natural skin texture, realistic pattern detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-406",
    name: "Leopard - Sitting on Stool",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo seated on a modern stool in a treatment room wearing leopard print scrubs, with hot pink decor softly blurred behind, relaxed confident pose. Warm soft lighting. Medium full pose. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-407",
    name: "Leopard - Hot Pink Wall Lean",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial lifestyle portrait of the person from the reference photo leaning casually against a hot pink wall wearing leopard print scrubs, bold colour contrast, confident relaxed expression. Soft even lighting. Three-quarter framing. Natural skin texture, realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-408",
    name: "Leopard - Clipboard Consultation",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo holding a clipboard in a consultation setting wearing leopard print scrubs, with hot pink accents in the soft blurred background, warm approachable expression. Gentle window light. Medium portrait. Realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-409",
    name: "Leopard - Hands in Pockets Hallway",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing with hands in pockets in a bright clinic hallway wearing leopard print scrubs, with hot pink accessories softly blurred behind, easy confident stance. Natural soft daylight. Three-quarter length. Natural skin texture, realistic pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-410",
    name: "Leopard - Looking Out Window",
    hasColour: false,
    promptTemplate: `An ultra-realistic serene portrait of the person from the reference photo looking thoughtfully out of a large window wearing leopard print scrubs, with soft hot pink tones in the blurred interior. Gentle natural daylight, calm mood. Medium head and shoulders to waist. Honest realistic skin and fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-411",
    name: "Leopard - Treatment Bed Standing",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing beside a modern treatment bed wearing leopard print scrubs, with hot pink accent decor softly blurred behind, confident welcoming expression. Soft clinical lighting. Medium shot. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-412",
    name: "Leopard - Coffee Break Lounge",
    hasColour: false,
    promptTemplate: `An ultra-realistic lifestyle portrait of the person from the reference photo relaxing with a coffee in a stylish clinic staff lounge wearing leopard print scrubs, with hot pink furnishings softly blurred behind. Warm cosy light, easy mood. Medium portrait. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-413",
    name: "Leopard - Power Pose Hot Pink",
    hasColour: false,
    promptTemplate: `An ultra-realistic bold editorial portrait of the person from the reference photo in a confident power stance wearing statement leopard print scrubs, lit with vivid hot pink accent lighting and decor behind. Dramatic balanced lighting, strong fashion mood. Three-quarter length. Natural skin texture, crisp realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-414",
    name: "Leopard - Walking Toward Camera",
    hasColour: false,
    promptTemplate: `An ultra-realistic candid professional portrait of the person from the reference photo walking confidently toward camera through a bright clinic space wearing leopard print scrubs, with hot pink accessories softly blurred behind. Natural daylight, energetic mood. Three-quarter framing, slight motion. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-415",
    name: "Leopard - Seated Desk Editorial",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo seated at a sleek desk wearing leopard print scrubs, with hot pink accents and decor softly blurred behind, poised confident expression. Soft warm side light. Medium portrait. Natural skin texture, realistic fabric detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-416",
    name: "Leopard - Close Up Confident",
    hasColour: false,
    promptTemplate: `An ultra-realistic clean head-and-shoulders portrait of the person from the reference photo wearing leopard print scrubs, with a soft blurred background carrying hot pink tones, warm confident smile. Bright flattering even lighting. Crisp editorial sharpness, natural skin texture, realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-417",
    name: "Leopard - Pink Neon Glow",
    hasColour: false,
    promptTemplate: `An ultra-realistic editorial portrait of the person from the reference photo wearing leopard print scrubs, lit by a soft hot pink neon glow against a dark modern interior, bold contemporary mood, confident expression. Cinematic lighting. Medium portrait. Natural skin texture, realistic fabric and leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-418",
    name: "Leopard - Outdoors Pink Florals",
    hasColour: false,
    promptTemplate: `An ultra-realistic lifestyle portrait of the person from the reference photo standing outdoors beside soft hot pink florals wearing leopard print scrubs, natural golden light, relaxed approachable mood. Blurred greenery behind. Medium shot. Realistic skin and fabric texture. Same facial features as reference photo.`,
  },
  {
    id: "ic-419",
    name: "Leopard - Reception Counter Lean",
    hasColour: false,
    promptTemplate: `An ultra-realistic lifestyle professional portrait of the person from the reference photo leaning on a clinic reception counter wearing leopard print scrubs, with hot pink branding and accessories softly blurred behind, warm friendly expression. Inviting soft light. Medium portrait. Natural skin texture, realistic pattern detail. Same facial features as reference photo.`,
  },
  {
    id: "ic-420",
    name: "Leopard - Full Length Statement",
    hasColour: false,
    promptTemplate: `An ultra-realistic full-length editorial portrait of the person from the reference photo standing confidently in statement leopard print scrubs, with bold hot pink accents and decor in the background, strong fashion-editorial mood. Dramatic balanced lighting. Full body. Natural skin texture, crisp realistic leopard pattern. Same facial features as reference photo.`,
  },
  {
    id: "ic-421",
    name: "Leopard - Pink Studio Backdrop",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing confidently in a professional studio wearing leopard print scrubs, set against a bold leopard print backdrop with vivid hot pink accents and lighting. Warm soft studio lighting. Medium shot waist up, warm professional expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-422",
    name: "Leopard - Studio Beauty Light",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a clean studio wearing leopard print scrubs, with a leopard print background softened behind and hot pink accent lighting glowing around. Bright even beauty lighting. Head and shoulders, confident warm smile. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-423",
    name: "Leopard - Seated Treatment Chair",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo seated calmly in a modern treatment chair wearing leopard print scrubs, with a blurred leopard print wall and hot pink decor accents behind. Soft warm side light. Eye-level medium portrait, approachable expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-424",
    name: "Leopard - Reception Desk Lean",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo leaning lightly on a sleek clinic reception desk wearing leopard print scrubs, with leopard print panelling and hot pink accents softly blurred behind. Warm inviting light. Medium portrait, relaxed confident mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-425",
    name: "Leopard - Hot Pink Gradient Wall",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing against a smooth hot pink gradient wall with subtle leopard print detailing, wearing leopard print scrubs. Soft directional studio light. Three-quarter framing, confident stance. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-426",
    name: "Leopard - Holding Skincare Product",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo holding a skincare product near the face wearing leopard print scrubs, with a leopard print backdrop and hot pink accents softly blurred behind. Bright clean lighting. Medium portrait, engaged professional expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-427",
    name: "Leopard - Arms Crossed Studio",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing with arms loosely crossed in a studio wearing leopard print scrubs, against a leopard print background with hot pink lighting accents. Balanced soft studio-quality lighting. Medium shot waist up, calm confident eye contact. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-428",
    name: "Leopard - Soft Pink Curtain",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo posed in front of a soft draped curtain in hot pink tones with subtle leopard print, wearing leopard print scrubs. Gentle warm light. Medium head and shoulders to waist, serene expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-429",
    name: "Leopard - Three Quarter Editorial",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a confident three-quarter editorial pose wearing leopard print scrubs, against a bold leopard print backdrop with hot pink accent lighting. Dramatic balanced lighting. Three-quarter length, strong fashion-editorial mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-430",
    name: "Leopard - Gentle Smile Close Up",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a clean close-up wearing leopard print scrubs, with a softly blurred leopard print background carrying warm hot pink tones. Bright even flattering lighting. Head and shoulders, gentle warm smile. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-431",
    name: "Leopard - Hands on Hips Clinic",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing with hands on hips in a modern clinic wearing leopard print scrubs, with leopard print decor and hot pink accents blurred behind. Strong soft directional light. Three-quarter length, confident powerful stance. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-432",
    name: "Leopard - Pink Ring Light Glow",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a studio wearing leopard print scrubs, with a leopard print backdrop and a soft hot pink ring-light glow framing the scene. Even warm ring lighting. Medium portrait, poised confident expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-433",
    name: "Leopard - Beside Treatment Bed",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing beside a clean treatment bed wearing leopard print scrubs, with a leopard print feature wall and hot pink accents softly blurred behind. Soft clinical lighting. Medium shot waist up, warm professional expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-434",
    name: "Leopard - Relaxed Lounge Seated",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo seated comfortably in a stylish clinic lounge wearing leopard print scrubs, with a leopard print cushion and hot pink decor accents behind. Warm soft lighting. Three-quarter framing, easy confident mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-435",
    name: "Leopard - Confident Studio Stance",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a confident studio stance wearing leopard print scrubs, against a leopard print background lit with vivid hot pink accents. Dramatic balanced studio lighting. Three-quarter length, bold editorial mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-436",
    name: "Leopard - Pink Floral Feature Wall",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo standing beside a hot pink floral feature wall with subtle leopard print, wearing leopard print scrubs. Soft natural light. Medium shot, relaxed approachable expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-437",
    name: "Leopard - Over Shoulder Studio",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo glancing back over one shoulder wearing leopard print scrubs, against a leopard print backdrop with a radiant hot pink glow. Warm directional light. Medium portrait, confident editorial mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-438",
    name: "Leopard - Clean Clinical Backdrop",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a bright clinical setting wearing leopard print scrubs, with a crisp leopard print accent panel and subtle hot pink tones softly blurred behind. Bright even clinical lighting. Medium head and shoulders to waist, honest confident expression. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-439",
    name: "Leopard - Bold Pink Spotlight",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo under a bold hot pink spotlight wearing leopard print scrubs, against a deep leopard print backdrop. Dramatic focused lighting. Three-quarter length, striking editorial mood. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
  {
    id: "ic-440",
    name: "Leopard - Full Length Pink Studio",
    hasColour: false,
    promptTemplate: `An ultra-realistic professional portrait of the person from the reference photo in a full-length statement pose wearing leopard print scrubs, against a grand leopard print studio backdrop with vivid hot pink accent lighting. Cinematic warm glamour lighting. Full body, fashion-editorial framing. Natural skin texture, realistic fabric and leopard pattern detail, editorial sharpness. Same facial features as reference photo.`,
  },
];

export const INJECTOR_COLLECTION_CATEGORIES: InjectorCollectionCategory[] = [
  { label: "Scrubs",              presetIds: ["ic-01","ic-02","ic-03","ic-04","ic-05","ic-06","ic-07","ic-08","ic-09","ic-10"] },
  { label: "White Shirt + Jeans", presetIds: ["ic-11","ic-12","ic-13","ic-14","ic-15","ic-16","ic-17","ic-18","ic-19","ic-20"] },
  { label: "Black Jumper + Jeans",presetIds: ["ic-21","ic-22","ic-23","ic-24","ic-25","ic-26","ic-27","ic-28","ic-29","ic-30"] },
  { label: "Expressions",         presetIds: ["ic-31","ic-32","ic-33","ic-34","ic-35","ic-36","ic-37","ic-38","ic-39","ic-40"] },
  { label: "With Patients",       presetIds: ["ic-41","ic-42","ic-43","ic-44","ic-45","ic-46","ic-47","ic-48","ic-49","ic-50"] },
  { label: "Editorial",           presetIds: ["ic-51","ic-52","ic-53","ic-54","ic-55","ic-56","ic-57","ic-58","ic-59","ic-60"] },
  { label: "Lifestyle Branding",  presetIds: ["ic-61","ic-62","ic-63","ic-64","ic-65","ic-66","ic-67","ic-68","ic-69","ic-70"] },
  { label: "Power & Authority",   presetIds: ["ic-71","ic-72","ic-73","ic-74","ic-75","ic-76","ic-77","ic-78","ic-79","ic-80"] },
  { label: "Final Editorial Mix", presetIds: ["ic-81","ic-82","ic-83","ic-84","ic-85","ic-86","ic-87","ic-88","ic-89","ic-90"] },
  { label: "Extra High-End",      presetIds: ["ic-91","ic-92","ic-93","ic-94","ic-95","ic-96","ic-97","ic-98","ic-99","ic-100"] },
];
