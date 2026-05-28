export type CarouselTemplate = {
  id: string;
  name: string;
  desc: string;
  thumb: string;
  needsPhoto: boolean;
  category: "template" | "seamless";
};

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  { id: "full_fade", name: "Full Frame Fade", desc: "Photo fills the frame, faded and cinematic with text floating over the top", thumb: "/carousel-templates/full-fade.jpg", needsPhoto: true, category: "template" },
  { id: "notecard", name: "Notecard", desc: "White paper card pinned over your photo — perfect for quotes and tips", thumb: "/carousel-templates/notecard.jpg", needsPhoto: true, category: "template" },
  { id: "torn_scrapbook", name: "Torn Scrapbook", desc: "Warm cream background, your photo behind torn paper and washi tape accents", thumb: "/carousel-templates/torn-scrapbook.jpg", needsPhoto: true, category: "template" },
  { id: "bold_editorial", name: "Bold Editorial", desc: "Clean bold typography on a solid background — nothing but your words", thumb: "/carousel-templates/bold-editorial.jpg", needsPhoto: false, category: "template" },
  { id: "dark_doodle", name: "Dark Chalkboard", desc: "Dark moody background with your photo embedded and hand-drawn doodle accents", thumb: "/carousel-templates/dark-doodle.jpg", needsPhoto: true, category: "template" },
  { id: "numbered_steps", name: "Numbered Steps", desc: "Step-by-step carousel with a large step number and your photo inset — great for tutorials", thumb: "/carousel-templates/clean-numbered.jpg", needsPhoto: true, category: "template" },
  { id: "split_panel", name: "Split Panel", desc: "Your photo on one side, your text on the other — editorial and clean", thumb: "/carousel-templates/split-panel.jpg", needsPhoto: true, category: "template" },
  { id: "polaroid_scrapbook", name: "Polaroid Scrapbook", desc: "Polaroid photo scattered on a vibrant background with botanical accents", thumb: "/carousel-templates/polaroid-scrapbook.jpg", needsPhoto: true, category: "template" },
  { id: "editorial_minimal", name: "Editorial Minimal", desc: "Monochrome photo with a clean white text panel — sophisticated and restrained", thumb: "/carousel-templates/editorial-minimal.jpg", needsPhoto: true, category: "template" },
  { id: "paper_cutout", name: "Paper Cutout", desc: "Textured cream background with your photo floating as a cut-out with snowflake accents", thumb: "/carousel-templates/paper-cutout.jpg", needsPhoto: true, category: "template" },
  { id: "textured_graphic", name: "Textured Graphic", desc: "Sandy textured background, oversized headline and colour-blocked highlight boxes", thumb: "/carousel-templates/textured-graphic.jpg", needsPhoto: false, category: "template" },
  { id: "dark_photo_steps", name: "Dark Photo Steps", desc: "Your photo darkened and dramatic, with numbered step labels and dot indicators", thumb: "/carousel-templates/dark-photo-steps.jpg", needsPhoto: true, category: "template" },
  { id: "background_overlays", name: "Seamless: Polaroid Overlays", desc: "One wide background photo with polaroid overlays bridging across slide seams", thumb: "/carousel-templates/full-fade.jpg", needsPhoto: true, category: "seamless" },
  { id: "mosaic", name: "Seamless: Mosaic Grid", desc: "All images in a flowing grid across the full carousel width", thumb: "/carousel-templates/editorial-minimal.jpg", needsPhoto: true, category: "seamless" },
  { id: "magazine", name: "Seamless: Magazine Spread", desc: "Two dominant images with accent shots — the most editorial look", thumb: "/carousel-templates/split-panel.jpg", needsPhoto: true, category: "seamless" },
  { id: "single_feature", name: "Seamless: Feature Shot", desc: "One hero image spanning most of the canvas with accent photos at the edges", thumb: "/carousel-templates/polaroid-scrapbook.jpg", needsPhoto: true, category: "seamless" },
  { id: "free", name: "Seamless: Free Arrangement", desc: "Images scattered organically across the full canvas", thumb: "/carousel-templates/dark-doodle.jpg", needsPhoto: true, category: "seamless" },
];

export const TEMPLATE_STYLE_IDS = new Set([
  "full_fade", "notecard", "torn_scrapbook", "bold_editorial",
  "dark_doodle", "numbered_steps", "split_panel", "polaroid_scrapbook",
  "editorial_minimal", "paper_cutout", "textured_graphic", "dark_photo_steps",
]);
