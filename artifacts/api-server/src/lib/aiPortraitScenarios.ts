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

export function buildPrompt(scenario: AiScenario, scrubColor?: string, outfitStyle?: string): string {
  let prompt = scenario.promptTemplate;
  if (scenario.hasScrubColor) {
    prompt = prompt.replace("{scrubColor}", scrubColor || "navy blue");
  }
  if (scenario.hasOutfitStyle) {
    prompt = prompt.replace("{outfitStyle}", outfitStyle || "smart casual");
  }
  return prompt;
}
