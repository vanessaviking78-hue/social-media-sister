// Empower: thirty static single image posts (1080 x 1350), drawn straight onto a canvas so the preview,
// the download and the scheduled image are always identical. No React in here.
// Every colour can be changed per post, and any colour can be switched to a metallic foil.

import { fillTokens, type Fill } from "./basic-covers";
import { DEFAULT_PALETTES, drawLogo, headWeightFor, leftoverPlaceholders, type Ctx, type Focus, type G, type LogoPos, type Slot } from "./xmas-designs";
import { S, XH, XW, type EG, type EKey, type EMetal, type EPalette } from "./empower-kit";
import { LAYOUTS } from "./empower-layouts";

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
  page: "Background", dark: "Dark block", accent: "Highlight colour", soft: "Second colour", ink: "Text on light", light: "Text on dark",
};

type Row = [string, string, string, boolean, [string, string, string, string, string, string], Partial<Record<EKey, string>>, [string, string, string?, number?][]];

const ROWS: Row[] = [
  ["group-project", "Not a group project", "Your face is not a committee decision", true, ["#f0ebdf", "#0e0e0e", "#c8281e", "#e6dfcf", "#0e0e0e", "#f3ecdd"], {}, [["head", "Headline", "Your face is not a group project.", 3], ["body", "Body", "Your partner gets an opinion. Your friends get an opinion. Instagram definitely has an opinion.\nBut there is only one person living in it.\nYOU.", 5], ["foot", "Bottom band", "Have it. Don't have it.\nChange your mind.\nYour face is not a committee decision.", 4]]],
  ["whats-gone", "What's disappeared first", "Collagen, eyebrows, patience or tolerance for idiots", true, ["#f1ede2", "#0b0b0b", "#d3191f", "#e6dfcf", "#0b0b0b", "#f4efe4"], {}, [["intro", "Small intro", "What's disappeared first:", 1], ["head", "Headline", "Collagen, *Eyebrows,* Patience or *Tolerance* for idiots?", 3], ["a", "Box one", "Collagen", 1], ["na", "Number one", "01.", 1], ["b", "Box two", "Eyebrows", 1], ["nb", "Number two", "02.", 1], ["c", "Box three", "Patience", 1], ["nc", "Number three", "03.", 1], ["d", "Box four", "Tolerance", 1], ["nd", "Number four", "04.", 1], ["foot", "Footer", "Pick one. No essays.", 1]]],
  ["film-title", "Film title", "Describe your ageing process using only a film title", true, ["#f1e7d4", "#0c1a2b", "#1f7a99", "#2a8aa8", "#0c1a2b", "#f4ecd8"], {}, [["head", "Headline", "Describe *your ageing process* using only a film title.", 4], ["exh", "Examples label", "Examples:", 1], ["examples", "Examples", "Mission: Impossible\nLost in Translation\nEverything Everywhere All at Once", 3], ["card", "Teal card", "Best answer wins absolutely nothing *except my respect.*", 3], ["q", "Big letter", "Q:", 1]]],
  ["thousand", "A thousand pounds", "£1,000 to spend on your face, wrong answers only", true, ["#f2ecdf", "#0a0a0a", "#e8f02c", "#f0f0e0", "#0a0a0a", "#ffffff"], {}, [["head", "Headline", "*£1,000*\nto spend on your face.\n*Wrong answers only.*", 5], ["list", "List", "industrial spotlight\n400x magnifying mirror\nseventeen identical serums\npersonal wind machine", 4], ["button", "Button", "Make it ridiculous.", 1]]],
  ["grown-to-love", "Grown to love", "Something you've grown to love about your face", true, ["#f2e8d8", "#2a1f1a", "#bd5b3a", "#e7c9a6", "#1a1410", "#ffffff"], {}, [["head", "Headline", "What's something you've grown to love about your face?", 4], ["bold", "Bold lines", "Not tolerate.\nNot 'accept'.\nLOVE.", 3], ["list", "List", "The nose from your dad.\nYour smile.\nYour freckles.\nThe lines beside your eyes.\nYour strong profile.", 5], ["foot", "Terracotta block", "I want a comment section full of women saying nice things about themselves.", 4]]],
  ["terrified", "Worth waiting for", "Terrified of getting older to quite liking the woman who turned up", true, ["#f0e8dc", "#0b1524", "#a6262b", "#e7e1d6", "#0b1524", "#ffffff"], {}, [["head", "Headline", "One minute you're terrified of getting older.\n\nNext minute you realise you quite like the woman who turned up.", 6], ["body", "Small list", "Better boundaries.\nBetter stories.\nBetter instincts.\nLess need for approval.", 4], ["foot", "Closing line", "She was worth waiting for.", 2]]],
  ["nineties", "90s magazine", "We spent the 90s trying to look older", true, ["#f6f2ea", "#0b0b0b", "#e0245e", "#f3e2e6", "#0b0b0b", "#ffffff"], {}, [["mast", "Masthead", "Vol. 09\nSpring 1995", 2], ["head", "Headline", "We spent the 90s trying to look older.", 3], ["pink", "Pink line", "Outstanding work, everyone.", 2], ["box", "Black box", "We forged ages. Borrowed heels. Wore makeup to get served.", 3], ["foot", "Footer", "Request processed.", 1]]],
  ["asymmetrical", "Asymmetrical", "Your face is asymmetrical because you're a mammal", true, ["#f4efe4", "#0a0a0a", "#1f3fb5", "#e9e4d8", "#0a0a0a", "#f4efe4"], {}, [["head", "Headline", "Your face is asymmetrical because you're a mammal.", 4], ["body", "Body", "One eyebrow may sit differently.\n\nOne side may photograph differently.\n\nHuman faces are not vector graphics.", 6], ["foot", "Bottom band", "Symmetry is not the entry requirement for being attractive.", 3]]],
  ["camera", "Hate the camera", "You don't hate your face, you might hate the camera", true, ["#e9e2d6", "#0b0b0b", "#cf3a22", "#f4efe4", "#0b0b0b", "#f4efe4"], {}, [["head", "Headline", "You don't hate your face.", 2], ["red", "Red headline", "You might hate the camera.", 2], ["body", "Small print", "Lens. Distance. Angle. Lighting. The frozen millisecond. None of these is how another human experiences your face in motion.", 4], ["foot", "Bottom line", "Don't let a *bad frame* become a diagnosis.", 3]]],
  ["influencer", "Not your anatomy", "Your favourite influencer isn't your anatomy", true, ["#f2eadc", "#0c0c0c", "#254a2e", "#e3e0d3", "#0c0c0c", "#f4efe4"], {}, [["head", "Headline", "Your favourite influencer isn't *your anatomy.*", 3], ["body", "Body", "Different face. Different proportions. Different history. Possibly different lighting, editing and filters too.", 4], ["big", "Bottom line", "Bring me your goal.", 2], ["small", "Small line", "Not somebody else's face.", 1]]],
  ["boring", "Boring on purpose", "Some aesthetic results are supposed to be boring", true, ["#f4f3ef", "#0e0e0e", "#8fa8c6", "#e9e9e6", "#0e0e0e", "#ffffff"], {}, [["head", "Headline", "Some aesthetic results are supposed to be boring.", 4], ["body", "Body", "No dramatic reveal.\nNo new identity.\nNo room full of people asking what you've done.\n\nSometimes the brief is simply: still me.", 6], ["foot", "Blue block", "Boring can be beautiful.", 2]]],
  ["gatecrasher", "Gatecrasher", "Gatecrasher to oestrogen", true, ["#f2ecd9", "#0c0c0c", "#b7e12a", "#f2ecd9", "#0c0c0c", "#f4efe4"], {}, [["head", "Headline", "One minute you're at *Gatecrasher.* Next minute you're discussing *Oestrogen.*", 5], ["box", "Boxed note", "Nobody explained the transition period.", 2], ["foot", "Bottom line", "And somehow *both women* are still in here.", 3]]],
  ["heather", "Heather shimmer", "Heather shimmer to lip hydration", true, ["#f1ecdc", "#0d0d0d", "#b49ddb", "#eae4d4", "#0d0d0d", "#f4efe4"], {}, [["head", "Headline", "*One minute you're wearing heather shimmer.*\nNext minute you're researching lip hydration.", 5], ["body", "Small print", "We really did powder away every molecule of moisture and call it a look.", 3], ["foot", "Bottom line", "Character development.", 2]]],
  ["knees", "25 year old knees", "I don't want my face back, I want my knees", true, ["#f4efe4", "#0e0e0e", "#e4702a", "#e8e2d4", "#0e0e0e", "#ffffff"], {}, [["head", "First line", "I don't want my 25-year-old face back.", 2], ["head2", "Orange line", "I want my 25-year-old", 1], ["big", "Giant word", "KNEES.", 1], ["body", "Small lines", "Face? Lived in.\nKnees? Open to negotiation.", 2], ["foot", "Orange block", "If you could have one 25-year-old body part back, what are you choosing?", 4]]],
  ["mum", "Knackered mum", "Your mum wasn't boring, she was knackered", true, ["#f3ebdd", "#1a1410", "#c0502c", "#e0d2bb", "#1a1410", "#f9efe0"], {}, [["head", "Headline", "The biggest plot twist of middle age is realising your mum wasn't boring.", 4], ["red", "Rust line", "She was knackered.", 2], ["body", "List", "The early nights.\nThe sensible shoes.\nThe cardigan.\nThe need for five minutes' peace.\nWe understand now.", 5], ["foot", "Rust block", "What did your mum do that finally makes sense?", 3]]],
  ["kodak", "700 edited faces", "The problem isn't your face, it's 700 edited ones", true, ["#f2ede3", "#0a0a0a", "#ee5a1f", "#e6e0d2", "#0a0a0a", "#ffffff"], {}, [["head", "Headline", "The problem isn't your face.", 2], ["orange", "Orange headline", "It's seeing 700 edited faces before breakfast.", 4], ["box", "Black box", "Your brain gets a very strange definition of 'normal' when normal skin disappears from the screen.", 4], ["foot", "Bottom line", "Real faces have texture, movement and asymmetry.", 3]]],
  ["refuse", "Brave and vain", "Nothing brave about refusing aesthetics, nothing vain about having them", true, ["#f4efe4", "#0a0a0a", "#ec2f6d", "#e6e0d4", "#0a0a0a", "#f4efe4"], {}, [["head", "Headline", "There is nothing *'brave'* about refusing aesthetics and nothing *'vain'* about having them.", 5], ["body", "Body", "Both can simply be choices.\nNo medal.\nNo shame.\nNo moral hierarchy.", 4], ["foot", "Bottom line", "Your face.\nYour decision.", 2]]],
  ["biggest-lie", "Biggest lie", "The biggest lie women are sold about getting older", true, ["#f2ecdf", "#0a0a0a", "#f3e51e", "#e8e2d2", "#0a0a0a", "#ffffff"], {}, [["head", "Headline", "What's the biggest *lie* women are sold about getting *older*", 5], ["mark", "Giant mark", "?", 1], ["list", "Four options", "That we disappear?\nThat beauty has an expiry date?\nThat every change needs fixing?\nThat confidence belongs to youth?", 4], ["foot", "Yellow band", "Your turn.", 1]]],
  ["smell", "Which 90s smell", "Which 90s smell could transport you in three seconds", true, ["#f0e9de", "#2c1630", "#c8b1e0", "#a6e0cc", "#1e1024", "#ffffff"], {}, [["head", "Headline", "Which 90s smell could emotionally transport you in three seconds?", 5], ["list", "Smells", "Dewberry\nWhite musk\nImpulse\nCK One\nHairspray\nNightclub smoke on your coat", 6], ["box", "Mint box", "Name it and tell me where you've gone.", 2], ["cap", "Handwritten note", "friday night 1996", 1]]],
  ["playlist", "Handbag song", "The song that makes you abandon your handbag", true, ["#f2ede4", "#0b1428", "#d4262e", "#e0dad0", "#0b1428", "#ffffff"], {}, [["head", "Headline", "What song could still make you abandon your handbag and run to the dancefloor?", 5], ["small", "Red small print", "No thinking.\nFirst song that entered your head wins.", 3], ["foot", "Red block", "I want the comments to become a playlist.", 3]]],
  ["algorithm", "Algorithm", "Your face isn't ugly, your algorithm changed", true, ["#f0ece0", "#0c0c0c", "#c3e71f", "#e6e2d4", "#0c0c0c", "#f4efe4"], {}, [["head", "Headline", "Your face isn't suddenly ugly.", 2], ["lime", "Lime block", "Your algorithm changed.", 2], ["body", "Body", "If you see hundreds of edited, filtered and unusually similar faces every day, normal starts looking unusual. Your face may not be the thing that changed.", 5], ["foot", "Bottom line", "Audit the feed before you audit your face.", 3]]],
  ["forty-eight", "48 looking 48", "A 48-year-old woman looking 48 is not a failed treatment", true, ["#f4f1ea", "#0b0b0b", "#1236a8", "#e6e2d6", "#0b0b0b", "#f4f1ea"], {}, [["head", "Headline", "A 48-year-old woman looking 48 is not a failed treatment.", 4], ["body", "Body", "Nor is it a failed skincare routine.\nNor a lack of effort.\n\nLooking your age is not evidence something went wrong.", 6], ["foot", "Blue block", "Treatment can be a choice. Youth is not the pass mark.", 3]]],
  ["criticised", "How convenient", "Criticised for ageing and for doing something about it", true, ["#f4efe4", "#0e0e0e", "#d6332a", "#e6e1d3", "#0e0e0e", "#ffffff"], {}, [["head", "Headline", "Women get criticised for ageing and criticised for doing something about it. *How convenient.*", 5], ["body", "Body", "Too natural.\nToo done.\nLet herself go.\nTrying too hard.\nApparently the winning move was never available.", 5], ["foot", "Bottom line", "So choose for yourself.", 1]]],
  ["no", "A good practitioner says no", "A good practitioner loses money saying no", true, ["#f2ece0", "#0b0b0b", "#1234b0", "#e6e0d2", "#0b0b0b", "#f2ece0"], {}, [["big", "Giant word", "NO.", 1], ["head", "Headline", "A good practitioner loses money saying", 3], ["body", "Body", "No to treatment you don't need.\n\nNo to a trend that doesn't suit you.\n\nNo to doing more because you asked for more.", 6], ["foot", "Blue line", "Sometimes 'no' is the most valuable thing in the consultation.", 3]]],
  ["consultation", "Not a checkout", "If every consultation ends in treatment, was it a consultation", true, ["#f2ece0", "#141414", "#d96a2a", "#e6e0d2", "#141414", "#f4efe4"], {}, [["head", "Headline", "If every consultation ends in treatment, was it really a consultation?", 4], ["body", "Body", "Sometimes the plan is wait.\n\nSometimes it is skincare.\n\nSometimes it is another option.\n\nSometimes it is nothing today.", 7], ["foot", "Orange ticket", "Consultation is not a checkout process.", 3]]],
  ["hotter", "We got hotter", "Plot twist: we got hotter", true, ["#f3ecdc", "#0b0b0b", "#c9262f", "#2442b5", "#0b0b0b", "#f4efe4"], {}, [["head", "Headline", "Plot twist: We got hotter.", 3], ["small", "Small lines", "Not younger.\nNot smoother.\nNot quieter.", 3], ["big", "Red word", "Hotter.", 1], ["body", "Body", "Turns out knowing who you are does something extraordinary to a woman.", 3], ["band1", "Band line one", "The face changed.", 1], ["band2", "Band line two", "The energy upgraded.", 1]]],
  ["list-hotter", "Hotter after 40", "Things that got hotter after 40", true, ["#f3ecdc", "#0b0b0b", "#d3322e", "#2442b5", "#0b0b0b", "#f4efe4"], {}, [["head", "Headline", "Things that got *hotter* after 40.", 3], ["list", "List", "My standards\nMy clothes\nMy boundaries\nMy opinions\nMy ability to leave early\nMy taste in music\nMy refusal to explain myself", 7], ["foot", "Blue line", "We thought the best bit was supposed to be over. Absolutely hilarious.", 3]]],
  ["at25", "At 25 and now", "At 25 I wanted everyone to think I was hot", true, ["#f3ecdc", "#0b0b0b", "#c9262f", "#2442b5", "#0b0b0b", "#f4efe4"], {}, [["head", "Top line", "At 25 I wanted everyone to think I was hot.", 3], ["red", "Red headline", "Now I only need me to know.", 3], ["body", "Small note", "That is a completely different kind of attractive.", 3], ["foot", "Red line", "Approval was exhausting anyway.", 2]]],
  ["nobody-warned", "Nobody warned us", "Nobody warned us about this part of midlife", true, ["#f3ecdc", "#0b0b0b", "#d3322e", "#2442b5", "#0b0b0b", "#f4efe4"], {}, [["head", "Headline", "Nobody warned us about this part of *midlife.*", 4], ["line", "Sub line", "The part where you stop auditioning.", 2], ["list", "Four points", "No longer dressing for strangers\nNo longer shrinking an opinion\nNo longer saying yes because it's easier\nFinally becoming the woman younger you would have been slightly intimidated by.", 4]]],
  ["built-different", "Built different", "We survived frosted lipstick and sun-in", true, ["#f3ecdc", "#0b0b0b", "#c9262f", "#2442b5", "#0b0b0b", "#f4efe4"], {}, [["head", "Headline", "We survived frosted lipstick, sun-in and eyebrows we personally *destroyed.*", 5], ["big", "Of course", "Of course we're hot.", 2], ["body", "Body", "We had no filters.\nNo ring lights.\nNo retakes.\nJust disposable cameras, questionable lighting and unreasonable confidence.", 5], ["foot", "Red block", "Built different.", 1]]],
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
