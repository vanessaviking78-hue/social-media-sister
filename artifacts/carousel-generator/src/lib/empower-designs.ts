// Empower: thirty static single image posts (1080 x 1350), drawn straight onto a canvas so the preview,
// the download and the scheduled image are always identical. No React in here.
// Every colour can be changed per post, and any colour can be switched to a metallic foil.

import { fillTokens, type Fill } from "./basic-covers";
import { DEFAULT_PALETTES, drawLogo, headWeightFor, leftoverPlaceholders, type Ctx, type Focus, type G, type LogoPos, type Slot } from "./xmas-designs";
import { S, XH, XW, type EG, type EKey, type EMetal, type EPalette } from "./empower-kit";
import { LAYOUTS_A } from "./empower-layouts-a";
import { LAYOUTS_B } from "./empower-layouts-b";

export { XW, XH, leftoverPlaceholders };
export type { EKey, EMetal, EPalette };
export { FOILS } from "./empower-kit";

export type EField = { key: string; label: string; rows?: number };
export type EDesign = {
  id: string;
  name: string;
  idea: string;
  usesPhoto: boolean;
  fields: EField[];
  defaults: Record<string, string>;
  palette: EPalette;
  labels: { key: EKey; label: string }[];
};

const BASE_LABELS: Record<EKey, string> = {
  page: "Background", dark: "Dark block", accent: "Accent", soft: "Soft colour", ink: "Text on light", light: "Text on dark",
};

type Row = [string, string, string, boolean, [string, string, string, string, string, string], Partial<Record<EKey, string>>, [string, string, string?, number?][]];

const ROWS: Row[] = [
  ["group-project", "Not a group project", "A bold diagonal split with a line that sets your boundaries", true,
    ["#f2ecdf", "#14110f", "#c8281e", "#e8dfcc", "#14110f", "#f6f0e4"], { dark: "Diagonal panel" },
    [["head", "Headline", "Your face is not a group project.", 4], ["sub", "Bottom line", "Opinions welcome. Edits are not.", 2]]],
  ["whats-gone", "What disappeared first", "Four cheeky options in a checkerboard and a one word reply", false,
    ["#f4efe4", "#16130f", "#c8281e", "#e5d9bd", "#16130f", "#f7f1e5"], {},
    [["head", "Title", "What's disappeared first", 2], ["a", "Box one", "Collagen"], ["b", "Box two", "Eyebrows"], ["c", "Box three", "Patience"], ["d", "Box four", "Tolerance"], ["foot", "Footer", "Pick one. No essays."]]],
  ["film-title", "Film title", "Describe your ageing using only a film title", true,
    ["#f1e7d4", "#122440", "#1f8a8a", "#f4ecd9", "#122440", "#f7f1e5"], { soft: "Note card" },
    [["head", "Headline", "Describe your ageing process using only a film title", 4], ["note", "Note on the card", "Mine is Bridget Jones. Mostly the diary.", 4], ["foot", "Small line", "Your title in the comments please", 2]]],
  ["thousand", "A thousand pounds", "What would you spend £1,000 on", true,
    ["#f2ecdf", "#0e0e0e", "#f2c500", "#e8dfcc", "#0e0e0e", "#f6f0e4"], { accent: "Yellow" },
    [["head", "Headline", "£1,000 to spend on your face", 3], ["list", "List", "Skin\nSleep\nA very good haircut\nA holiday", 5], ["button", "Button", "Choose wisely"]]],
  ["receipt", "Receipt of truth", "A cheeky receipt for the most money wasted", true,
    ["#f2ecdf", "#14382d", "#e0533b", "#c9d8a8", "#1a1a1a", "#f4efe2"], { dark: "Green", light: "Receipt paper" },
    [["head", "Headline", "Most money spent fixing something nobody noticed", 3], ["rtitle", "Receipt title", "Receipt of truth"], ["items", "Receipt lines", "Serum 1\nSerum 2\nSerum 3\nA gadget\nA lot of hope", 5], ["total", "Total", "Total damage £1,000", 2], ["foot", "Side note", "Be honest. We have all done it.", 3]]],
  ["grown-to-love", "Grown to love", "Something you have grown to love about your face", true,
    ["#f1e6d3", "#2a1f1a", "#c5683f", "#e7c9a6", "#2a1f1a", "#f7efe0"], { accent: "Terracotta" },
    [["head", "Headline", "Something you've grown to love about your face", 4], ["tag", "Tag", "Tell me yours"]]],
  ["terrified", "Worth waiting for", "From terrified of ageing to feeling worth the wait", true,
    ["#f1e8d6", "#14264a", "#c8281e", "#e6c9c0", "#14264a", "#f7f1e5"], {},
    [["head", "Top line", "One minute you're terrified of getting older", 3], ["close", "Closing line", "She was worth waiting for.", 2]]],
  ["nineties", "90s magazine", "A glossy 90s cover for a Spring issue", true,
    ["#f7d6dc", "#1b1b1b", "#d6336c", "#fbe9ec", "#1b1b1b", "#fffaf4"], { page: "Cover" },
    [["mast", "Masthead", "Vol. 09 Spring 1995"], ["head", "Cover headline", "We spent the 90s trying to look older", 3], ["line1", "Cover line", "Now look at us"], ["line2", "Small line", "Free with every birthday"]]],
  ["asymmetrical", "Asymmetrical", "Your face is not symmetrical and neither is anyone else's", true,
    ["#f3eee3", "#14110f", "#2f6fc7", "#d9e4f4", "#14110f", "#f7f3ea"], { accent: "Blue quarter circle" },
    [["head", "Headline", "Your face is asymmetrical because you're a mammal", 4], ["left", "Left label", "Left side"], ["right", "Right label", "Right side"], ["foot", "Footer", "Same woman. Both fabulous."]]],
  ["camera", "Hate the camera", "Maybe it is the camera and not your face", true,
    ["#f2ecdf", "#0f2a2a", "#e8c35a", "#cfd8d0", "#1b1b1b", "#f6f0e4"], {},
    [["head", "Headline", "You don't hate your face. You might hate the camera.", 4], ["foot", "Footer", "A front camera is a mean little lens.", 3]]],
  ["influencer", "Not an influencer", "Your anatomy is not your favourite influencer's", true,
    ["#f2ecdf", "#111111", "#7fc47a", "#d6d6d0", "#111111", "#fbf8f0"], { accent: "Green", soft: "Silhouette" },
    [["head", "Headline", "Your favourite influencer isn't your anatomy", 3], ["labelA", "Left label", "Her filter"], ["labelB", "Right label", "Your face"], ["foot", "Corner line", "Borrowed cheekbones don't fit.", 2]]],
  ["boring", "Boring on purpose", "Some results are meant to be quiet", true,
    ["#efeee9", "#16130f", "#2f4fd6", "#d9def5", "#16130f", "#f7f6f1"], { accent: "Blue block" },
    [["head", "Headline", "Some aesthetic results are supposed to be boring.", 3], ["sub", "Small line", "Nobody should clock it. They should just think you slept well.", 2]]],
  ["gatecrasher", "Gatecrasher", "Hormones turning up uninvited", true,
    ["#f2ecdf", "#111111", "#c6f13b", "#e8dfcc", "#111111", "#f6f0e4"], { accent: "Lime" },
    [["word1", "Small word", "Gatecrasher"], ["word2", "Big word", "Oestrogen"], ["body", "Body", "Leaves the party early and takes the good mood with her.", 3], ["foot", "Footer", "Anyone else?"]]],
  ["heather", "Heather shimmer", "A soft lilac note about lip hydration", true,
    ["#e6dcf0", "#3a2c52", "#8a5cc2", "#f3edf8", "#3a2c52", "#fbf8ff"], {},
    [["head", "Headline", "Heather shimmer", 2], ["sub", "Sub line", "lip hydration"], ["foot", "Footer", "Lips deserve a drink too."]]],
  ["commas", "Eyebrow commas", "Plucking eyebrows into commas in 1997", true,
    ["#f2ecdf", "#14110f", "#d63a2b", "#e8dfcc", "#14110f", "#fbf5ea"], { accent: "Film strip" },
    [["head", "Headline", "Plucking eyebrows into commas", 3], ["body", "Body", "We did it with tweezers, a hand mirror and total confidence.", 4], ["foot", "Footer", "Who else regrets 1997?"]]],
  ["afterparty", "Afterparty", "Where is the afterparty and what time are we eating", true,
    ["#f2ecdf", "#5a1a2a", "#e8564a", "#b9d9ee", "#5a1a2a", "#fbf3ea"], { dark: "Maroon", soft: "Light blue" },
    [["q1", "First line", "Where's the afterparty?", 2], ["q2", "Second line", "What time are we eating?", 2], ["word", "Big word", "Growth.", 2], ["foot", "Footer", "Midlife in two questions.", 2]]],
  ["knees", "25 year old knees", "Wanting knees from 25 years ago", true,
    ["#f2ecdf", "#17110d", "#f08a24", "#f7d9b0", "#17110d", "#fbf4e8"], { accent: "Orange" },
    [["head", "Headline", "25-year-old knees", 3], ["tag", "Badge", "Wanted"], ["foot", "Footer", "Reward: my gratitude.", 2]]],
  ["mum", "Knackered mum", "Our mums were not boring", true,
    ["#f1e6d3", "#2a1f1a", "#c5683f", "#e7c9a6", "#2a1f1a", "#f7efe0"], { accent: "Terracotta" },
    [["head", "Headline", "Your mum wasn't boring, she was knackered.", 4], ["foot", "Footer", "Hello from the other side.", 2]]],
  ["kodak", "Film frame", "Edited faces versus the real thing", true,
    ["#f2ecdf", "#161412", "#f08a24", "#f7d9b0", "#161412", "#fbf4e8"], { dark: "Film frame", accent: "Orange" },
    [["head", "Headline", "The problem isn't your face.", 2], ["sub", "Sub line", "It's 700 edited ones.", 2]]],
  ["refuse", "Refusing aesthetics", "Nothing brave about refusing aesthetics", true,
    ["#f2ecdf", "#111111", "#f48fb1", "#fbd6e2", "#111111", "#fbf8f0"], { accent: "Pink" },
    [["head", "Headline", "Nothing brave about refusing aesthetics", 4], ["sub", "Body", "Nothing shameful about choosing them either. It is your face, so it is your call.", 4], ["foot", "Footer", "Agree?"]]],
  ["biggest-lie", "Biggest lie", "The biggest lie women are sold", false,
    ["#f2ecdf", "#14110f", "#f5c518", "#fbe7a0", "#14110f", "#f6f0e4"], { accent: "Yellow" },
    [["mark", "Giant mark", "?"], ["head", "Question", "Biggest lie women are sold", 2], ["close", "Closing line", "Your turn."]]],
  ["confess", "Confess", "Which beauty trend did permanent damage", true,
    ["#f2ecdf", "#101a33", "#2c6fd1", "#cfdcf2", "#101a33", "#f7f3ea"], { accent: "Blue", dark: "Film strip" },
    [["head", "Headline", "What beauty trend permanently damaged you?", 3], ["close", "Closing word", "Confess."]]],
  ["smell", "Which 90s smell", "A nostalgic smell question with a polaroid", true,
    ["#f2ecdf", "#4a1f4f", "#e8a0c8", "#bfe8d4", "#2d1a30", "#fbf4f0"], { dark: "Plum", soft: "Mint box" },
    [["head", "Headline", "Which 90s smell takes you straight back", 3], ["box", "Mint box", "Impulse body spray? Charlie? Lynx at the school disco?", 4], ["cap", "Polaroid caption", "friday night 1996"], ["foot", "Footer", "Tell me everything.", 3]]],
  ["playlist", "Handbag song", "The song that makes you abandon your handbag", true,
    ["#f2ecdf", "#12203d", "#d6342c", "#cfd6e6", "#12203d", "#fbf6ee"], { accent: "Red film frame" },
    [["head", "Headline", "What song makes you abandon your handbag", 3], ["foot", "Footer", "I want the comments to become a playlist.", 3]]],
  ["algorithm", "Algorithm", "Your face has not changed, your feed has", true,
    ["#f2ecdf", "#111111", "#c6f13b", "#e8dfcc", "#111111", "#f6f0e4"], { accent: "Lime" },
    [["head", "Headline", "Your face isn't suddenly ugly. Your algorithm changed.", 4], ["foot", "Footer", "Go and tidy your feed.", 2]]],
  ["hotter", "We got hotter", "Plot twist: we got hotter", true,
    ["#f2ecdf", "#0e0e0e", "#d6342c", "#cfd8e6", "#0e0e0e", "#f6f0e4"], {},
    [["kicker", "Kicker", "Plot twist"], ["head", "Headline", "We got hotter.", 2], ["big", "Big word", "hotter."], ["body", "Body", "Not younger. Not smoother. Not quieter. Turns out knowing who you are does something extraordinary to a woman.", 6]]],
  ["list-hotter", "Hotter after 40", "A list of what got better after 40", true,
    ["#f2ecdf", "#0e0e0e", "#d6342c", "#cfd8e6", "#0e0e0e", "#f6f0e4"], {},
    [["head", "Headline", "Things that got hotter after 40", 3], ["list", "List", "My standards\nMy clothes\nMy boundaries\nMy opinions\nMy ability to leave early\nMy taste in music\nMy refusal to explain myself", 8], ["close", "Closing line", "We thought the best bit was supposed to be over. Absolutely hilarious.", 3]]],
  ["at25", "At 25 and now", "At 25 versus now", true,
    ["#f2ecdf", "#0e0e0e", "#2c6fd1", "#cfd8e6", "#0e0e0e", "#f6f0e4"], { accent: "Blue" },
    [["top", "Top line", "At 25 I wanted everyone to think I was hot.", 3], ["bottom", "Bottom line", "Now I only need me to know.", 3], ["body", "Body", "That is a completely different kind of attractive. Approval was exhausting anyway.", 3]]],
  ["nobody-warned", "Nobody warned us", "The part where you stop auditioning", true,
    ["#f2ecdf", "#0e0e0e", "#d6342c", "#cfd8e6", "#0e0e0e", "#f6f0e4"], {},
    [["head", "Headline", "Nobody warned us about this part of midlife.", 3], ["list", "List", "No longer dressing for strangers\nNo longer shrinking an opinion\nNo longer saying yes because it's easier", 5], ["close", "Closing line", "Finally becoming the woman younger you would have been slightly intimidated by.", 4]]],
  ["built-different", "Built different", "Frosted lipstick survivors", true,
    ["#f2ecdf", "#0e0e0e", "#d6342c", "#cfd8e6", "#0e0e0e", "#f6f0e4"], {},
    [["head", "Top banner", "We survived frosted lipstick, sun-in and eyebrows we personally destroyed.", 3], ["big", "Big line", "Built different.", 2], ["body", "Body", "No filters. No ring lights. No retakes. Just disposable cameras, questionable lighting and unreasonable confidence.", 4]]],
];

export const EMPOWER: EDesign[] = ROWS.map(([id, name, idea, usesPhoto, p, lab, fl]) => {
  const keys: EKey[] = ["page", "dark", "accent", "soft", "ink", "light"];
  const palette = Object.fromEntries(keys.map((kk, i) => [kk, p[i]])) as EPalette;
  const labels = keys.map((kk) => ({ key: kk, label: lab[kk] ?? BASE_LABELS[kk] }));
  return {
    id, name, idea, usesPhoto, palette, labels,
    fields: fl.map(([key, label, , rws]) => ({ key, label, rows: rws })),
    defaults: Object.fromEntries(fl.map(([key, , def]) => [key, def ?? ""])),
  };
});

export const EMPOWER_BY_ID: Record<string, EDesign> = Object.fromEntries(EMPOWER.map((d) => [d.id, d]));

export function resolveEmpowerText(design: EDesign, text: Record<string, string>, fill: Fill): Record<string, string> {
  return Object.fromEntries(design.fields.map((fd) => [fd.key, fillTokens(text[fd.key] ?? design.defaults[fd.key] ?? "", fill)]));
}

const LAYOUTS = { ...LAYOUTS_A, ...LAYOUTS_B };

export type EmpowerDrawInput = {
  design: string;
  text: Record<string, string>;
  palette: EPalette;
  metal: EMetal;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  logo?: HTMLImageElement | null;
  logoPos?: LogoPos;
};

export function drawEmpower(ctx: Ctx, d: EmpowerDrawInput): Slot[] {
  const g: EG = {
    ctx, t: d.text, c: DEFAULT_PALETTES.xmas, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: d.upper, photo: d.photo, focus: d.focus, slots: [], p: d.palette, metal: d.metal, foils: new Map(),
  };
  ctx.save();
  ctx.textBaseline = "top";
  ctx.save();
  ctx.scale(S, S);
  (LAYOUTS[d.design] ?? LAYOUTS["group-project"])(g);
  ctx.restore();
  if (d.logo && d.logoPos && d.logoPos !== "off") drawLogo(g as G, d.logo, d.logoPos);
  ctx.restore();
  return g.slots;
}
