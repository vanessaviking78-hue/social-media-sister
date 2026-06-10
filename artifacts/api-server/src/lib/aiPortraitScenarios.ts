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
}

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
];

export function buildPhotoStudioPrompt(preset: PhotoStudioPreset, colour?: string, aspectRatio = "3:4"): string {
  let prompt = preset.promptTemplate;
  if (preset.hasColour) {
    prompt = prompt.replace(/\[COLOUR\]/g, colour?.trim() || "navy blue");
  }
  const ratioDescription =
    aspectRatio === "9:16" ? "a vertical 9:16 portrait orientation (tall and narrow)" :
    aspectRatio === "3:4" ? "a 3:4 portrait orientation" :
    "a square 1:1 format";
  return `${prompt}\n\nCompose the image in ${ratioDescription}.\n\n${PHOTO_STUDIO_NEGATIVE}`;
}
