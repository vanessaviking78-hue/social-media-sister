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
    name: "Clinical Consultation Portrait",
    hasColour: true,
    promptTemplate: `Medium-format commercial healthcare photography, 85mm lens, f/2.8, ultra-high-resolution RAW capture, shallow depth of field. Three-quarter environmental portrait. Professional male medical practitioner wearing premium scrubs in [COLOUR], standing beside a patient during a consultation, patient softly out of focus. Visible pores and realistic skin texture, subtle peach fuzz, natural tonal variation. Professional grooming, natural strand separation. Premium medical scrubs with visible stitching, realistic fabric folds, colour [COLOUR] rendered accurately. Warm attentive expression, engaged with patient, natural hand gestures. Luxury bokeh environment from blurred clinic lighting, intentionally unrecognizable healthcare setting. Large softbox key light, subtle rim lighting, natural skin reflections. Premium healthcare campaign aesthetic, clean skin tones. Must look physically believable and naturally photographed, not CGI or overly AI-generated. Same facial features as reference photo.`,
  },
  {
    id: "cs-02",
    name: "Luxury Studio Healthcare Headshot",
    hasColour: true,
    promptTemplate: `Hasselblad X2D portrait photography, 100mm lens, f/5.6. Tight chest-up portrait. Male medical professional wearing tailored scrubs in [COLOUR], photographed for a luxury aesthetic medicine campaign. Visible pores and realistic skin texture, natural under-eye detail. Neatly styled with realistic texture. Structured scrub top with premium fabric texture in [COLOUR], realistic folds and seams. Direct eye contact, calm confidence. Soft gradient fading into creamy bokeh highlights. Beauty key light with subtle edge illumination. Luxury healthcare editorial colour grading. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-03",
    name: "Arranging Skincare Products — Clinic Shelves",
    hasColour: true,
    promptTemplate: `Editorial commercial photography, 50mm lens, f/2. Mid-action environmental portrait. Male medical professional in scrubs [COLOUR] carefully arranging premium skincare products on illuminated clinic shelving. Focused expression while organizing skincare displays. Premium skincare bottles, glass packaging, luxury medical-grade skincare branding blurred and elegant. Soft-focus bokeh clinic environment with glowing shelf illumination. Warm shelf lighting mixed with studio fill light. High-end skincare campaign aesthetic. Scrub fabric in [COLOUR] rendered with realistic dimensionality. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-04",
    name: "Reviewing Patient Results",
    hasColour: true,
    promptTemplate: `Full-frame DSLR, 85mm lens, f/2.2. Over-the-shoulder consultation portrait. Medical professional in scrubs [COLOUR] reviewing treatment images with a patient. Visible pores and realistic skin texture. Engaged, reassuring expression, collaborative body language. Bokeh lighting and softly blurred clinic environment. Bright luxury clinical lighting softened for editorial appeal. Modern aesthetic medicine campaign look. Premium scrub fabric in [COLOUR] with realistic folds. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-05",
    name: "Walking Through Luxury Clinic",
    hasColour: true,
    promptTemplate: `Commercial healthcare campaign photography, 35mm lens, f/2.8. Full-body walking portrait. Male practitioner in scrubs [COLOUR] confidently walking through a luxury clinic corridor. Visible pores, realistic skin depth. Premium scrub fabric in [COLOUR] showing realistic drape and motion. Relaxed confidence, approachable leadership presence. Abstract luxury clinic shapes in background bokeh. Natural overhead clinic lighting with cinematic side fill. Luxury healthcare advertising aesthetic. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-06",
    name: "Skincare Shelf Curation Close-Up",
    hasColour: true,
    promptTemplate: `70mm lens, f/2. Waist-up portrait during product arrangement. Male clinician in scrubs [COLOUR] selecting premium skincare products from a shelf display. RAW skin texture, visible pores. Matte scrub fabric in [COLOUR] with subtle highlights. Focused concentration with natural hand placement. Elegant bokeh from illuminated shelving units. Product-focused lighting with realistic reflections on glass containers. Luxury skincare campaign grading. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-07",
    name: "Luxury Aesthetic Medicine Portrait",
    hasColour: true,
    promptTemplate: `Medium-format portrait photography, 90mm lens, f/4. Standing portrait with slight angle. Medical professional in premium scrubs [COLOUR] posing between consultations. Visible pores and realistic skin texture. Controlled styling with natural texture. Premium medical fabric in [COLOUR] with realistic stitching. Calm confidence, hands loosely clasped. Rich bokeh backdrop inspired by luxury clinic lighting. Soft octabox key light with subtle rim lighting. Premium healthcare editorial tones. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-08",
    name: "Patient Care Interaction",
    hasColour: true,
    promptTemplate: `Documentary editorial photography, 50mm lens, f/2. Candid consultation moment. Male clinician in scrubs [COLOUR] interacting warmly with a patient. Visible pores, natural skin detail. Natural professional styling. Realistic scrub folds and premium fabric texture in [COLOUR]. Genuine smile, compassionate communication. Soft clinical bokeh with no identifiable clinic features. Bright healthcare lighting balanced with editorial softness. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-09",
    name: "Studio Healthcare Brand Portrait",
    hasColour: true,
    promptTemplate: `Hasselblad commercial portrait, 120mm lens, f/5.6. Luxury campaign portrait. Male doctor in scrubs [COLOUR] photographed against a seamless bokeh-inspired studio backdrop. Visible pores, realistic skin texture. Professional styling with realistic strand detail. Premium scrub fabric in [COLOUR] rendered with realistic dimensionality. Confident healthcare leader, direct eye contact. Large beauty key light, subtle edge separation, realistic catchlights. Sophisticated healthcare branding aesthetic. Must look physically believable and naturally photographed. Same facial features as reference photo.`,
  },
  {
    id: "cs-10",
    name: "Luxury Skincare Consultation Environment",
    hasColour: true,
    promptTemplate: `Editorial advertising photography, 85mm lens, f/2.5. Environmental portrait with product displays visible. Male medical professional in scrubs [COLOUR], standing beside beautifully merchandised skincare shelves, discussing treatment options with a patient. Visible pores and realistic skin texture, subtle peach fuzz. Premium scrub fabric in [COLOUR] with visible stitching and realistic draping. Professional, welcoming, trustworthy. Elegant skincare packaging, glass bottles, luxury clinic displays. Bokeh lighting obscuring all clinic identifiers while maintaining premium healthcare atmosphere. Balanced clinical and commercial lighting, dimensional highlights, realistic reflections on products. Ultra-premium aesthetic clinic campaign. Must look physically believable and naturally photographed, not CGI or overly AI-generated. Same facial features as reference photo.`,
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
