// Xmas Posts: ten single image Christmas designs, drawn straight onto a 1080 x 1350 canvas so the
// preview, the download and the scheduled image are always identical. No React in here.
// Every colour comes from the Palette, so every colour can be changed per client.

import { fillTokens, type Fill } from "./basic-covers";

export const XW = 1080;
export const XH = 1350;

export type Palette = {
  paper: string; // main background, the cream paper
  green: string; // headlines, dark bands, panels
  red: string; // accents, rules, banners
  tag: string; // gift tags
  frame: string; // polaroid frames
  light: string; // text that sits on green or red
  ink: string; // main text colour on paper (New Year set)
};

export type Group = "xmas" | "newyear";
export const GROUPS: { id: Group; label: string }[] = [
  { id: "xmas", label: "Christmas" },
  { id: "newyear", label: "New Year" },
];

export const PALETTE_LABELS_BY_GROUP: Record<Group, { key: keyof Palette; label: string }[]> = {
  xmas: [
    { key: "paper", label: "Paper" },
    { key: "green", label: "Green" },
    { key: "red", label: "Red" },
    { key: "tag", label: "Gift tags" },
    { key: "frame", label: "Photo frames" },
    { key: "light", label: "Light text" },
  ],
  newyear: [
    { key: "paper", label: "Paper" },
    { key: "green", label: "Sage" },
    { key: "red", label: "Accent red" },
    { key: "tag", label: "Sticky notes" },
    { key: "frame", label: "Photo frames" },
    { key: "ink", label: "Text" },
    { key: "light", label: "Light text" },
  ],
};

export const DEFAULT_PALETTES: Record<Group, Palette> = {
  xmas: { paper: "#f3ecdd", green: "#1b4a37", red: "#a3282a", tag: "#e8d8b9", frame: "#fbf8f0", light: "#f7f1e4", ink: "#1b4a37" },
  newyear: { paper: "#eee8dd", green: "#a3ad95", red: "#c0392b", tag: "#f0cbc2", frame: "#fcfaf5", light: "#ffffff", ink: "#161616" },
};

export type Slot = { i: number; x: number; y: number; w: number; h: number; rot: number };
export type Focus = [number, number];
export const DEFAULT_FOCUS: Focus = [0.5, 0.35];

export type DesignId =
  | "party" | "wish" | "things" | "morning" | "naughty" | "dinner" | "woman" | "face" | "closed" | "merry"
  | "nycover" | "nyleaving" | "nyageing" | "nynothanks" | "nypractitioner" | "nypatient" | "nyskin" | "nyfour" | "nycompare" | "nypokemon";

export type FieldDef = { key: string; label: string; rows?: number };

export type Design = {
  id: DesignId;
  group: Group;
  name: string;
  idea: string;
  fields: FieldDef[];
  defaults: Record<string, string>;
};

const f = (key: string, label: string, rows = 1): FieldDef => ({ key, label, rows });

// In the order they go out. The first one is the earliest.
export const DESIGNS: Design[] = [
  {
    id: "party", group: "xmas", name: "Your Christmas party is not a treatment deadline",
    idea: "a gentle, funny planning reminder that anyone with a Christmas event should book consultations early, because some things need planning and time",
    fields: [f("headline", "Headline", 2), f("body", "Words under the headline", 4), f("footer", "Bottom line", 2)],
    defaults: {
      headline: "Your Christmas party is not a treatment deadline",
      body: "If you have an event coming up, tell your practitioner before booking. Some treatments need planning, recovery or time before review.",
      footer: "December 23rd is not a strategy.",
    },
  },
  {
    id: "wish", group: "xmas", name: "My Christmas wish list",
    idea: "a clinician's honest and funny Christmas wish list about the patients they love working with",
    fields: [f("headline", "Headline", 2), f("i1", "Wish 1", 2), f("i2", "Wish 2", 2), f("i3", "Wish 3", 2), f("i4", "Wish 4", 2), f("i5", "Wish 5", 2), f("footer", "Bottom line", 2), f("tagtext", "Tag")],
    defaults: {
      headline: "My Christmas wish list",
      i1: "patients who follow their aftercare", i2: "SPF that actually gets used", i3: "realistic expectations",
      i4: "nobody saying 'my friend can do it cheaper'", i5: "five minutes to drink my coffee while it's hot",
      footer: "Honestly, I'll take the coffee.", tagtext: "Merry Christmas",
    },
  },
  {
    id: "things", group: "xmas", name: "Things we wanted for Christmas then and now",
    idea: "a nostalgic and funny then and now list, what we wanted for Christmas as children and what we want now as grown women",
    fields: [f("headA", "Top heading", 2), f("a1", "Then 1"), f("a2", "Then 2"), f("a3", "Then 3"), f("a4", "Then 4", 2), f("headB", "Lower heading", 2), f("b1", "Now 1"), f("b2", "Now 2"), f("b3", "Now 3"), f("b4", "Now 4", 2)],
    defaults: {
      headA: "Things we wanted for Christmas then", a1: "Walkman", a2: "Mr Frosty", a3: "Baby-G-style watch", a4: "Enormous chocolate selection box",
      headB: "Things we want now", b1: "Sleep", b2: "Good skin", b3: "Peace and quiet", b4: "Nobody asking what we're doing for New Year's Eve",
    },
  },
  {
    id: "morning", group: "xmas", name: "Christmas morning, 1989",
    idea: "a nostalgic, funny look back at Christmas morning in 1989, with no filters and no front facing cameras",
    fields: [f("headline", "Headline", 2), f("i1", "Memory 1", 2), f("i2", "Memory 2", 2), f("i3", "Memory 3", 3), f("i4", "Memory 4", 2), f("i5", "Memory 5", 3), f("footer", "Bottom line", 2)],
    defaults: {
      headline: "Christmas morning, 1989",
      i1: "Selection box before breakfast", i2: "Batteries not included", i3: "One present you weren't allowed to touch until everyone was awake",
      i4: "Quality Street wrappers everywhere", i5: "Absolutely no front-facing camera documenting any of it",
      footer: "We had no filters.\nJust flash photography and courage.",
    },
  },
  {
    id: "naughty", group: "xmas", name: "Santa's naughty or nice list, clinic edition",
    idea: "a funny naughty or nice list for patients, what the nice list does and what lands you on the naughty list",
    fields: [f("headline", "Headline", 3), f("niceHead", "Nice heading"), f("naughtyHead", "Naughty heading"),
      f("n1", "Nice 1"), f("n2", "Nice 2"), f("n3", "Nice 3"), f("n4", "Nice 4"), f("n5", "Nice 5"),
      f("x1", "Naughty 1"), f("x2", "Naughty 2"), f("x3", "Naughty 3"), f("x4", "Naughty 4"), f("x5", "Naughty 5"),
      f("footer", "Bottom banner", 2), f("tagtext", "Tag")],
    defaults: {
      headline: "Santa's naughty or nice list, clinic edition", niceHead: "Nice", naughtyHead: "Naughty",
      n1: "disclosed medical history", n2: "asked questions", n3: "followed aftercare", n4: "wore SPF", n5: "gave things time",
      x1: "picked at it", x2: "panic-Googled at midnight", x3: "took advice from the group chat", x4: "booked the day before an event", x5: "inspected face under 10x magnification",
      footer: "Santa says please stop touching it.", tagtext: "Merry Christmas",
    },
  },
  {
    id: "dinner", group: "xmas", name: "Christmas dinner bingo, woman over 40 edition",
    idea: "a funny Christmas dinner bingo card of the things women over 40 hear at the table",
    fields: [f("headline", "Headline", 3), f("c1", "Square 1", 2), f("c2", "Square 2", 2), f("c3", "Square 3", 2), f("c4", "Square 4", 2),
      f("c5", "Middle square (red)", 2), f("c6", "Square 6", 2), f("c7", "Square 7", 2), f("c8", "Square 8", 3), f("c9", "Last square (blank is fine)", 2)],
    defaults: {
      headline: "Christmas dinner: woman over 40 edition", c1: "You look tired", c2: "Are you having pudding?", c3: "What have you had done?",
      c4: "You don't need anything doing", c5: "Smile and pour the gravy", c6: "When are you coming to visit?",
      c7: "Someone mentions menopause", c8: "Somebody falls asleep before the King's speech", c9: "",
    },
  },
  {
    id: "woman", group: "xmas", name: "To the woman who spent all year looking after everyone else",
    idea: "a warm gift tag message to the woman who looks after everyone else, giving her permission to look after herself",
    fields: [f("to", "To", 3), f("from", "From"), f("i1", "Gift 1", 2), f("i2", "Gift 2", 2), f("i3", "Gift 3", 2), f("i4", "Gift 4", 2), f("footer", "Last line", 3)],
    defaults: {
      to: "To: the woman who spent all year looking after everyone else.", from: "From: You.",
      i1: "an hour to yourself", i2: "a consultation you've been thinking about", i3: "skincare you'll actually use", i4: "absolutely nothing if that's what you want",
      footer: "You don't have to earn looking after yourself.",
    },
  },
  {
    id: "face", group: "xmas", name: "Your face made it through another year",
    idea: "a kind, funny thank you to the face for surviving another year, ending on looking after it rather than fixing it",
    fields: [f("headline", "Headline", 3), f("body", "Words under the headline", 6), f("footer", "Bottom words", 4)],
    defaults: {
      headline: "Your face made it through another year",
      body: "It laughed. It cried. It squinted at menus. It survived central heating, deadlines, hormones, bad sleep and approximately 4,000 facial expressions.",
      footer: "Maybe it doesn't need fixing. Maybe it just deserves looking after.",
    },
  },
  {
    id: "closed", group: "xmas", name: "The clinic is now closed for Christmas",
    idea: "the clinic closing for Christmas, a warm thank you to every patient and the date the clinic reopens",
    fields: [f("headline", "Headline", 3), f("lines", "Three short lines", 3), f("thanks", "Thank you", 4), f("reopen", "Tag words"), f("date", "Date")],
    defaults: {
      headline: "The clinic is now closed for Christmas",
      lines: "The messages can wait.\nThe washing can wait.\nInstagram can definitely wait.",
      thanks: "Thank you to every person who trusted me with their face, their questions and approximately 700 stories about their life this year.",
      reopen: "We will reopen on", date: "[DATE]",
    },
  },
  {
    id: "merry", group: "xmas", name: "Merry Christmas, however yours looks",
    idea: "a warm Christmas message for everyone, however their Christmas looks, loud or quiet, full table or missing someone",
    fields: [f("headline", "Headline", 3), f("lines", "Short lines", 8), f("note", "Green line", 2), f("clinic", "Name on the tag"), f("footer", "Bottom words", 3)],
    defaults: {
      headline: "Merry Christmas, however yours looks.",
      lines: "Loud house.\nQuiet house.\nFull table.\nMissing someone.\nWorking.\nResting.\nLoving it.\nGetting through it.",
      note: "There is no correct way to do today.", clinic: "{clinic}",
      footer: "From my little clinic to you, have the Christmas you need.",
    },
  },

  // ---- New Year ----
  {
    id: "nycover", group: "newyear", name: "New Year. Same Face.",
    idea: "a New Year cover post saying she is not becoming a new woman in January and quite likes the one she has",
    fields: [f("headline", "Headline", 2), f("sub", "Words under it", 3), f("footer", "Bottom line", 2)],
    defaults: { headline: "New Year.\nSame Face.", sub: "I am not becoming a new woman in January.", footer: "I quite like this one." },
  },
  {
    id: "nyleaving", group: "newyear", name: "Things I am leaving in last year",
    idea: "a funny list of the mirror habits and thoughts she is leaving behind in the old year",
    fields: [f("headline", "Headline", 2), f("i1", "Item 1"), f("i2", "Item 2", 2), f("i3", "Item 3", 2), f("i4", "Item 4", 2), f("i5", "Item 5", 3), f("footer", "Bottom banner", 2)],
    defaults: {
      headline: "Things I am leaving in last year.", i1: "the 10x mirror", i2: "checking my face in car mirrors", i3: "diagnosing myself at midnight",
      i4: "saving filtered faces as 'inspiration'", i5: "saying 'I look awful' when I actually mean 'I'm exhausted'", footer: "The mirror is losing its management position.",
    },
  },
  {
    id: "nyageing", group: "newyear", name: "My only ageing resolution",
    idea: "a defiant, kind resolution to stop apologising for ageing and stop treating ageing as misconduct",
    fields: [f("label", "Small label"), f("headline", "Headline", 6), f("note", "Sticky note", 5)],
    defaults: {
      label: "My only ageing resolution.",
      headline: "I will not spend another year apologising for having the face of a woman who has lived this long.",
      note: "Treat it. Don't treat it. Wear makeup. Don't. But stop acting as though ageing is misconduct.",
    },
  },
  {
    id: "nynothanks", group: "newyear", name: "New year, new you? No thanks.",
    idea: "refusing the New Year new you pressure, she does not need reinventing because the calendar changed",
    fields: [f("headline", "Headline", 3), f("note", "Sticky note", 4), f("footer", "Bottom banner", 3)],
    defaults: {
      headline: "New year, new you? No thanks.", note: "Same me.\nBetter boundaries.\nBetter skin habits.\nLess magnifying mirror.",
      footer: "You do not need reinventing because the calendar changed.",
    },
  },
  {
    id: "nypractitioner", group: "newyear", name: "My New Year's resolutions as your practitioner",
    idea: "the clinician's six New Year resolutions for how she looks after her patients",
    fields: [f("headline", "Headline", 2), f("sub", "Second line (in colour)"), f("i1", "Resolution 1", 2), f("i2", "Resolution 2"), f("i3", "Resolution 3", 2), f("i4", "Resolution 4", 2), f("i5", "Resolution 5", 2), f("i6", "Resolution 6", 2)],
    defaults: {
      headline: "My New Year's resolutions", sub: "as your practitioner.",
      i1: "keep saying no when no is the right answer", i2: "explain the why", i3: "never chase trends with your face",
      i4: "make room for your questions", i5: "remember subtle is still a result", i6: "keep the kettle operational.",
    },
  },
  {
    id: "nypatient", group: "newyear", name: "The Aesthetic Patient's 2027 Resolutions",
    idea: "a checklist of sensible 2027 resolutions for aesthetic patients, ending on still looking like herself",
    fields: [f("headline", "Headline", 3), f("i1", "Tick 1"), f("i2", "Tick 2", 2), f("i3", "Tick 3"), f("i4", "Tick 4", 2), f("i5", "Tick 5"), f("i6", "Tick 6", 2), f("i7", "Tick 7", 2), f("lead", "Banner first line"), f("last", "Banner second line (red)"), f("pill", "Name tag")],
    defaults: {
      headline: "The Aesthetic Patient's 2027 Resolutions.", i1: "I will ask questions", i2: "I will disclose my medical history", i3: "I will follow my aftercare",
      i4: "I will give results the appropriate time", i5: "I will stop comparing", i6: "I will choose practitioners, not prices", i7: "I will remember more is not automatically better.",
      lead: "Most importantly:", last: "I will still look like me.", pill: "{clinic}  \u2022  {area}",
    },
  },
  {
    id: "nyskin", group: "newyear", name: "My Skin Resolutions",
    idea: "a short list of realistic skin resolutions, SPF, using what she owns and asking a professional first",
    fields: [f("headline", "Headline", 2), f("i1", "Tick 1"), f("i2", "Tick 2", 2), f("i3", "Tick 3"), f("i4", "Tick 4", 3), f("i5", "Tick 5", 4)],
    defaults: {
      headline: "My Skin Resolutions", i1: "wear the SPF", i2: "stop panic-buying serums", i3: "use what I already own",
      i4: "ask a professional before attacking my face with another acid", i5: "remember consistency is considerably less exciting than TikTok but usually more useful.",
    },
  },
  {
    id: "nyfour", group: "newyear", name: "Resolution #4, plan first",
    idea: "a resolution to stop booking a week before the event, plan first and panic never",
    fields: [f("label", "Oval label"), f("headline", "Headline", 5), f("note", "Sticky note", 5), f("footer", "Bottom banner", 2)],
    defaults: {
      label: "Resolution #4", headline: "This year I will stop saying 'I'll book a week before the event.'",
      note: "Weddings, holidays, birthdays and big occasions are allowed to exist in the diary before the panic sets in.", footer: "Plan first. Panic never.",
    },
  },
  {
    id: "nycompare", group: "newyear", name: "2027 Resolution: stop comparing",
    idea: "a funny resolution to stop comparing her face to people who were not born when she bought her first eyeshadow",
    fields: [f("label", "Label"), f("headline", "Headline", 5), f("hot", "Last words (in red)", 2), f("note", "Sticky note", 5)],
    defaults: {
      label: "2027 Resolution:", headline: "Stop comparing my face to people who weren't even born when I bought my first",
      hot: "Rimmel Heather Shimmer.", note: "Different age. Different face. Different life.\n\nAbsolutely ridiculous comparison.",
    },
  },
  {
    id: "nypokemon", group: "newyear", name: "Not collecting treatments like Pokemon",
    idea: "a consultation led plan beats a shopping list, she is not collecting treatments like Pokemon",
    fields: [f("headline", "Headline", 3), f("hot", "Last words (in colour)"), f("i1", "Tick 1"), f("i2", "Tick 2"), f("i3", "Tick 3", 2), f("i4", "Tick 4"), f("i5", "Tick 5", 2), f("footer", "Bottom banner", 2)],
    defaults: {
      headline: "This year I am not collecting treatments", hot: "like Pokemon.", i1: "consultation first", i2: "goal second", i3: "treatment only if appropriate",
      i4: "review", i5: "repeat only if it still makes sense", footer: "A plan beats a shopping list.",
    },
  },
];

export const DESIGN_BY_ID: Record<DesignId, Design> = Object.fromEntries(DESIGNS.map((d) => [d.id, d])) as Record<DesignId, Design>;

// ---------------------------------------------------------------------------
// Drawing kit
// ---------------------------------------------------------------------------

type P = [number, number];
type Ctx = CanvasRenderingContext2D;

type G = {
  ctx: Ctx;
  t: Record<string, string>;
  c: Palette;
  head: string;
  body: string;
  headW: number;
  upper: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  slots: Slot[];
};

const SCRIPT = `'Playfair Display', Georgia, 'Times New Roman', serif`;
const HAND = `'Caveat', 'Patrick Hand', 'Comic Sans MS', cursive`;

function rand(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexRgb(hex);
  const m = amt >= 0 ? 255 : 0;
  const k = Math.abs(amt);
  const q = (v: number) => Math.round(v + (m - v) * k).toString(16).padStart(2, "0");
  return `#${q(r)}${q(g)}${q(b)}`;
}
function rgba(hex: string, a: number) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text ?? "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function lines(ctx: Ctx, ls: string[], x: number, y: number, lh: number, align: CanvasTextAlign = "left"): number {
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  for (const l of ls) { ctx.fillText(l, x, y); y += lh; }
  return y;
}

// Shrinks the text until it fits the box. Returns the font size used and the y under the text.
function textBox(g: G, text: string, x: number, y: number, w: number, h: number, o: {
  font: "head" | "body" | "script" | "hand"; max: number; min?: number; weight?: number; colour: string; align?: CanvasTextAlign; lh?: number; upper?: boolean; italic?: boolean;
}): { size: number; y: number } {
  const { ctx } = g;
  const lh = o.lh ?? (o.font === "head" ? 1.04 : 1.28);
  const fam = o.font === "head" ? g.head : o.font === "script" ? SCRIPT : o.font === "hand" ? HAND : g.body;
  const wt = o.weight ?? (o.font === "head" ? g.headW : 500);
  const txt = o.upper ? (text ?? "").toUpperCase() : text ?? "";
  const font = (s: number) => `${o.italic ? "italic " : ""}${wt} ${s}px ${fam}`;
  let s = o.max;
  let ls: string[] = [];
  const min = o.min ?? 16;
  for (; s >= min; s -= 2) {
    ctx.font = font(s);
    ls = wrap(ctx, txt, w);
    if (ls.length * s * lh <= h && ls.every((l) => ctx.measureText(l).width <= w + 1)) break;
  }
  s = Math.max(s, min);
  ctx.font = font(s);
  ls = wrap(ctx, txt, w);
  ctx.fillStyle = o.colour;
  const ax = o.align === "center" ? x + w / 2 : o.align === "right" ? x + w : x;
  const end = lines(ctx, ls, ax, y, Math.round(s * lh), o.align ?? "left");
  return { size: s, y: end };
}

const HU = (g: G, s: string) => (g.upper ? (s ?? "").toUpperCase() : s ?? "");

function rule(g: G, x1: number, x2: number, y: number, colour: string, width = 2, alpha = 1) {
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

// --- torn paper ------------------------------------------------------------

function tornPath(ctx: Ctx, pts: P[], torn: boolean[], seed: number, amp: number, off: number) {
  const r = rand(seed);
  const n = pts.length;
  let cx = 0, cy = 0;
  pts.forEach((p) => { cx += p[0]; cy += p[1]; });
  cx /= n; cy /= n;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (!torn[i]) { ctx.lineTo(b[0], b[1]); continue; }
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    const steps = Math.max(2, Math.round(len / 13));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const j = (r() - 0.5) * 2 * amp + off;
      ctx.lineTo(a[0] + dx * t + nx * j, a[1] + dy * t + ny * j);
    }
  }
  ctx.closePath();
}

type PaperKind = "plain" | "stars" | "holly";

// A piece of torn paper: a pale fibre edge, the coloured paper on top and an optional pattern.
function paper(g: G, pts: P[], torn: boolean[], colour: string, o?: { seed?: number; kind?: PaperKind; pattern?: string; fringe?: string; shadow?: boolean; amp?: number }) {
  const { ctx } = g;
  const seed = o?.seed ?? 7;
  const amp = o?.amp ?? 7;
  const fringe = o?.fringe ?? "#faf6ec";
  ctx.save();
  if (o?.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5; }
  tornPath(ctx, pts, torn, seed + 31, amp, 6);
  ctx.fillStyle = fringe;
  ctx.fill();
  ctx.restore();
  tornPath(ctx, pts, torn, seed, amp, 0);
  ctx.fillStyle = colour;
  ctx.fill();
  if (o?.kind && o.kind !== "plain") {
    ctx.save();
    ctx.clip();
    const col = o.pattern ?? "rgba(255,255,255,0.55)";
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    const step = o.kind === "stars" ? 74 : 96;
    let row = 0;
    for (let y = minY - step; y < maxY + step; y += step * 0.9, row++) {
      for (let x = minX - step + (row % 2 ? step / 2 : 0); x < maxX + step; x += step) {
        if (o.kind === "stars") star(ctx, x, y, 14, col);
        else sprig(ctx, x, y, 0.55, (row * 37 + x) % 360, col);
      }
    }
    ctx.restore();
  }
}

function star(ctx: Ctx, x: number, y: number, r: number, colour: string) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const rr = i % 2 ? r * 0.32 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function sprig(ctx: Ctx, x: number, y: number, s: number, rot: number, colour: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.fillStyle = colour;
  for (const a of [-40, 40, 0]) {
    ctx.save();
    ctx.rotate((a * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(26 * s, -14 * s, 50 * s, 0);
    ctx.quadraticCurveTo(26 * s, 14 * s, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(2 * s, 2 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- decorations -----------------------------------------------------------

function holly(g: G, x: number, y: number, s: number, rot: number) {
  const { ctx, c } = g;
  const leaf = shade(c.green, -0.1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(s, s);
  for (const a of [-52, 0, 52]) {
    ctx.save();
    ctx.rotate((a * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(20, -30, 70, -34, 118, 0);
    ctx.bezierCurveTo(70, 34, 20, 30, 0, 0);
    ctx.fillStyle = leaf;
    ctx.fill();
    ctx.strokeStyle = shade(c.green, 0.4);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(104, 0); ctx.stroke();
    ctx.restore();
  }
  for (const [bx, by] of [[-6, -6], [12, 6], [-4, 14]] as P[]) {
    ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fillStyle = shade(c.red, -0.05);
    ctx.fill();
    ctx.beginPath(); ctx.arc(bx - 4, by - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  }
  ctx.restore();
}

function tape(g: G, cx: number, cy: number, w: number, h: number, rot: number, kind: "kraft" | "candy") {
  const { ctx, c } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.save();
  ctx.clip();
  if (kind === "kraft") {
    ctx.fillStyle = rgba(shade(c.tag, -0.08), 0.9);
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = "rgba(250,246,236,0.95)";
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = c.red;
    for (let x = -w; x < w; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, -h / 2); ctx.lineTo(x + 17, -h / 2); ctx.lineTo(x + 17 + h, h / 2); ctx.lineTo(x + h, h / 2);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// Red and cream candy twine along a curve.
function twine(g: G, p0: P, c1: P, p1: P, width = 8) {
  const { ctx, c } = g;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = c.red;
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); ctx.stroke();
  ctx.strokeStyle = "#f6efe0";
  ctx.setLineDash([9, 13]);
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); ctx.stroke();
  ctx.restore();
}

// A gift tag. The callback draws inside it, with (0,0) at the centre of the tag.
function giftTag(g: G, cx: number, cy: number, w: number, h: number, rot: number, o?: { shape?: "up" | "left"; string?: P; holeRing?: string; draw?: (ctx: Ctx) => void }) {
  const { ctx, c } = g;
  const shape = o?.shape ?? "up";
  const cut = Math.min(w, h) * 0.2;
  const pts: P[] = shape === "up"
    ? [[-w * 0.3, -h / 2], [w * 0.3, -h / 2], [w / 2, -h / 2 + cut], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2 + cut]]
    : [[-w / 2, 0], [-w / 2 + cut * 1.2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2 + cut * 1.2, h / 2]];
  const hole: P = shape === "up" ? [0, -h / 2 + cut * 0.62] : [-w / 2 + cut * 0.75, 0];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  if (o?.string) {
    // string from the hole out to a point given in world space
    const inv = (-rot * Math.PI) / 180;
    const dx = o.string[0] - cx, dy = o.string[1] - cy;
    const sx = dx * Math.cos(inv) - dy * Math.sin(inv), sy = dx * Math.sin(inv) + dy * Math.cos(inv);
    twine(g, hole, [(hole[0] + sx) / 2 - 40, (hole[1] + sy) / 2 + 60], [sx, sy], 8);
  }
  ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = c.tag;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = shade(c.tag, -0.22);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = shade(c.tag, -0.15);
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
  ctx.restore();
  // the hole
  ctx.beginPath(); ctx.arc(hole[0], hole[1], 15, 0, Math.PI * 2);
  ctx.fillStyle = shade(c.green, -0.2); ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = o?.holeRing ?? c.red; ctx.stroke();
  o?.draw?.(ctx);
  ctx.restore();
}

function placeholder(g: G, w: number, h: number) {
  const { ctx } = g;
  ctx.fillStyle = "#cdcac3";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "#8d8a83";
  ctx.font = `600 38px ${g.body}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Choose a photo", 0, 0);
  ctx.textBaseline = "top";
}

// A cropped photo inside a framed print. The slot it reports is the photo itself, so it can be dragged.
function polaroid(g: G, cx: number, cy: number, w: number, h: number, rot: number, o?: { pad?: number; bottom?: number; tapeAt?: "kraft" | "candy" | null }) {
  const { ctx, c } = g;
  const pad = o?.pad ?? 26;
  const bottom = o?.bottom ?? pad;
  const iw = w - pad * 2, ih = h - pad - bottom;
  const ox = 0, oy = (pad - bottom) / 2;
  const a = (rot * Math.PI) / 180;
  const scx = cx + ox * Math.cos(a) - oy * Math.sin(a);
  const scy = cy + ox * Math.sin(a) + oy * Math.cos(a);
  g.slots.push({ i: 0, x: scx - iw / 2, y: scy - ih / 2, w: iw, h: ih, rot });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.shadowColor = "rgba(0,0,0,0.32)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 9;
  ctx.fillStyle = c.frame;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath(); ctx.rect(-iw / 2, -ih / 2, iw, ih); ctx.clip();
  drawPhoto(g, iw, ih);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.strokeRect(ox - iw / 2, oy - ih / 2, iw, ih);
  ctx.restore();
  if (o?.tapeAt) tape(g, cx + Math.sin(a) * (h / 2) * -1 + 0, cy - Math.cos(a) * (h / 2) + 4, 190, 52, rot - 4, o.tapeAt);
}

function drawPhoto(g: G, w: number, h: number) {
  const { ctx, photo: bmp, focus: fc } = g;
  if (!bmp) { placeholder(g, w, h); return; }
  const s = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * s, dh = bmp.height * s;
  ctx.drawImage(bmp, -w / 2 - (dw - w) * fc[0], -h / 2 - (dh - h) * fc[1], dw, dh);
}

function fullBleed(g: G) {
  const { ctx } = g;
  g.slots.push({ i: 0, x: 0, y: 0, w: XW, h: XH, rot: 0 });
  ctx.save();
  ctx.translate(XW / 2, XH / 2);
  ctx.beginPath(); ctx.rect(-XW / 2, -XH / 2, XW, XH); ctx.clip();
  drawPhoto(g, XW, XH);
  ctx.restore();
}

function bg(g: G) {
  const { ctx, c } = g;
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, XW, XH);
  // a little paper grain so the cream does not look flat
  const r = rand(5);
  ctx.save();
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(120,100,60,${0.02 + r() * 0.03})`;
    ctx.fillRect(r() * XW, r() * XH, 2 + r() * 3, 1 + r() * 2);
  }
  ctx.restore();
}

function squareBullet(g: G, x: number, y: number, s: number, colour: string) {
  g.ctx.fillStyle = colour;
  g.ctx.fillRect(x, y, s, s);
}


// --- New Year kit ------------------------------------------------------------

// Ruled notebook paper with punched holes down the left.
function notebook(g: G, x: number, y: number, w: number, h: number, o?: { holes?: boolean; lines?: boolean; colour?: string }) {
  const { ctx } = g;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  ctx.fillStyle = o?.colour ?? "#fbf9f4";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (o?.lines !== false) {
    ctx.strokeStyle = "rgba(110,125,150,0.16)"; ctx.lineWidth = 2;
    for (let yy = y + 70; yy < y + h - 20; yy += 54) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  }
  if (o?.holes !== false) {
    for (let yy = y + 30; yy < y + h - 14; yy += 46) {
      ctx.fillStyle = "#dcd5c7";
      ctx.beginPath(); ctx.arc(x + 18, yy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + 18, yy, 9, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    }
  }
}

// A sticky note with a soft shadow. The callback draws inside it with (0,0) at the centre.
function sticky(g: G, cx: number, cy: number, w: number, h: number, rot: number, colour: string, draw?: (ctx: Ctx) => void, tapeAt?: boolean) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = colour;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 34); ctx.lineTo(w / 2 - 34, h / 2); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
  draw?.(ctx);
  ctx.restore();
  if (tapeAt) tape(g, cx, cy - h / 2 + 4, 140, 44, rot * 0.5 + 2, "kraft");
}

function paperclip(g: G, x: number, y: number, rot: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-8, 38); ctx.lineTo(-8, -34);
  ctx.arc(2, -34, 10, Math.PI, 0);
  ctx.lineTo(12, 46);
  ctx.arc(-2, 46, 14, 0, Math.PI);
  ctx.lineTo(-16, -22);
  ctx.stroke();
  ctx.restore();
}

function strike(g: G, x1: number, x2: number, y: number, colour: string, width = 7) {
  const { ctx } = g;
  const r = rand(Math.round(x1 + y));
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y + (r() - 0.5) * 4);
  for (let x = x1 + 30; x < x2; x += 30) ctx.lineTo(x, y + (r() - 0.5) * 5);
  ctx.lineTo(x2, y + (r() - 0.5) * 4);
  ctx.stroke();
  ctx.restore();
}

function checkbox(g: G, x: number, y: number, s: number, colour: string, lw = 3) {
  g.ctx.save();
  g.ctx.strokeStyle = colour; g.ctx.lineWidth = lw;
  g.ctx.strokeRect(x, y, s, s);
  g.ctx.restore();
}

function heart(g: G, cx: number, cy: number, s: number, colour: string, fillIt = false, lw = 4) {
  const { ctx } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 40, s / 40);
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.bezierCurveTo(-30, -6, -18, -30, 0, -14);
  ctx.bezierCurveTo(18, -30, 30, -6, 0, 14);
  ctx.closePath();
  if (fillIt) { ctx.fillStyle = colour; ctx.fill(); } else { ctx.strokeStyle = colour; ctx.lineWidth = lw * (40 / s); ctx.stroke(); }
  ctx.restore();
}

// Two lines of headline in two colours at one size, so the last words can stand out.
function twoTone(g: G, a: string, b: string, x: number, y: number, w: number, h: number, max: number, min: number, colA: string, colB: string, lhf = 1.04): number {
  const { ctx } = g;
  let s = max;
  let la: string[] = [], lb: string[] = [];
  for (; s >= min; s -= 2) {
    ctx.font = `${g.headW} ${s}px ${g.head}`;
    la = wrap(ctx, HU(g, a), w);
    lb = wrap(ctx, HU(g, b), w);
    if ((la.length + lb.length) * s * lhf <= h && [...la, ...lb].every((l) => ctx.measureText(l).width <= w + 1)) break;
  }
  s = Math.max(s, min);
  ctx.font = `${g.headW} ${s}px ${g.head}`;
  la = wrap(ctx, HU(g, a), w);
  lb = wrap(ctx, HU(g, b), w);
  ctx.fillStyle = colA;
  let yy = lines(ctx, la, x, y, Math.round(s * lhf));
  ctx.fillStyle = colB;
  yy = lines(ctx, lb, x, yy, Math.round(s * lhf));
  return yy;
}

// A checklist line: box, then the words.
function tickRows(g: G, keys: string[], x: number, y: number, w: number, step: number, o: { box: string; text: string; size: number; weight?: number; strikeKeys?: string[]; boxSize?: number; rowH?: number }) {
  keys.forEach((k, i) => {
    const yy = y + i * step;
    const bs = o.boxSize ?? 34;
    checkbox(g, x, yy + 4, bs, o.box, 3);
    textBox(g, g.t[k] ?? "", x + bs + 22, yy, w - bs - 22, o.rowH ?? step - 6, { font: "body", max: o.size, min: 15, weight: o.weight ?? 600, colour: o.text, lh: 1.2 });
    if (o.strikeKeys?.includes(k)) strike(g, x + bs + 18, x + w - 30, yy + o.size * 0.62, shade(g.c.red, 0), 5);
  });
}

// ---------------------------------------------------------------------------
// The ten designs
// ---------------------------------------------------------------------------

const LAYOUTS: Record<DesignId, (g: G) => void> = {
  party(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [520, 0], [470, 120], [0, 135]], [false, true, true, true], c.green, { seed: 3, kind: "holly", pattern: rgba(c.light, 0.16) });
    polaroid(g, 770, 505, 600, 880, 2, { pad: 28, bottom: 28 });
    // red band and wrapping paper along the bottom
    paper(g, [[0, 1010], [1080, 960], [1080, 1350], [0, 1350]], [true, false, false, false], c.red, { seed: 11 });
    paper(g, [[740, 930], [1080, 900], [1080, 1350], [700, 1350]], [true, false, false, true], shade(c.green, 0.0), { seed: 21, kind: "holly", pattern: rgba(c.light, 0.3) });
    textBox(g, HU(g, t.headline), 44, 160, 420, 520, { font: "head", max: 96, min: 44, colour: c.green });
    rule(g, 44, 430, 665, c.red, 3);
    textBox(g, t.body, 44, 700, 410, 230, { font: "body", max: 29, min: 20, weight: 500, colour: c.green });
    rule(g, 44, 520, 1040, g.c.light, 2, 0.7);
    textBox(g, HU(g, t.footer), 44, 1062, 480, 230, { font: "head", max: 104, min: 50, colour: c.light });
    rule(g, 44, 520, 1300, g.c.light, 2, 0.7);
    giftTag(g, 905, 1130, 210, 300, -9, { string: [830, 1005], holeRing: c.green });
  },

  wish(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [1080, 0], [1080, 66], [0, 80]], [false, false, true, false], c.green, { seed: 4, kind: "holly", pattern: rgba(c.light, 0.14) });
    polaroid(g, 770, 575, 540, 930, 3, { pad: 24, bottom: 120 });
    textBox(g, HU(g, t.headline), 64, 128, 430, 330, { font: "head", max: 112, min: 50, colour: c.green });
    rule(g, 64, 245, 505, c.red, 3);
    rule(g, 330, 480, 505, c.red, 3);
    holly(g, 288, 505, 0.28, -20);
    const keys = ["i1", "i2", "i3", "i4", "i5"];
    keys.forEach((k, i) => {
      const y = 560 + i * 128;
      ctx.strokeStyle = c.red; ctx.lineWidth = 4;
      ctx.strokeRect(66, y + 8, 48, 48);
      textBox(g, t[k], 142, y, 340, 112, { font: "body", max: 36, min: 22, weight: 500, colour: c.green });
    });
    paper(g, [[690, 1070], [1080, 1010], [1080, 1350], [660, 1350]], [true, false, false, false], c.red, { seed: 15, kind: "stars", pattern: rgba(c.light, 0.35) });
    paper(g, [[0, 1180], [700, 1170], [700, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 9 });
    rule(g, 60, 650, 1226, c.light, 2, 0.6);
    textBox(g, HU(g, t.footer), 60, 1240, 600, 96, { font: "head", max: 34, min: 22, weight: Math.max(500, g.headW), colour: c.light, align: "center" });
    giftTag(g, 810, 1120, 250, 340, -14, {
      string: [1080, 1010],
      draw: (cx) => {
        cx.fillStyle = c.green;
        cx.font = `italic 600 54px ${SCRIPT}`;
        cx.textAlign = "center"; cx.textBaseline = "top";
        const ls = wrap(cx, t.tagtext, 190);
        lines(cx, ls, 0, -40, 58, "center");
      },
    });
    holly(g, 905, 1245, 0.42, -25);
  },

  things(g) {
    const { ctx, c, t } = g;
    bg(g);
    // the lower half is green
    paper(g, [[0, 760], [1080, 740], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 17 });
    paper(g, [[890, 800], [1080, 780], [1080, 1350], [850, 1350]], [true, false, false, false], c.red, { seed: 25, kind: "stars", pattern: rgba(c.light, 0.4) });
    // the "then" list panel
    paper(g, [[26, 30], [455, 40], [450, 745], [26, 750]], [true, true, true, true], c.paper, { seed: 13, fringe: "#fffdf6", amp: 5 });
    textBox(g, HU(g, t.headA), 62, 78, 370, 160, { font: "head", max: 58, min: 34, colour: c.green });
    ["a1", "a2", "a3", "a4"].forEach((k, i) => {
      const y = 270 + i * 118;
      ctx.fillStyle = c.red; ctx.fillRect(62, y + 18, 54, 54);
      ctx.fillStyle = c.light; ctx.font = `700 26px ${g.body}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`0${i + 1}`, 89, y + 46); ctx.textBaseline = "top";
      textBox(g, HU({ ...g, upper: true }, t[k]), 140, y + 4, 290, 100, { font: "body", max: 28, min: 18, weight: 700, colour: c.green, upper: true });
    });
    polaroid(g, 770, 395, 540, 640, 4, { pad: 22, bottom: 22, tapeAt: "candy" });
    textBox(g, HU(g, t.headB), 400, 795, 470, 190, { font: "head", max: 78, min: 40, colour: c.light, align: "left" });
    ["b1", "b2", "b3", "b4"].forEach((k, i) => {
      const y = 1008 + i * 78;
      ctx.fillStyle = c.paper; ctx.fillRect(400, y, 58, 58);
      ctx.fillStyle = c.green; ctx.font = `700 26px ${g.body}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`0${i + 1}`, 429, y + 30); ctx.textBaseline = "top";
      rule(g, 476, 880, y + 70, c.light, 1, 0.35);
      textBox(g, t[k], 482, y + 4, 400, 70, { font: "body", max: 30, min: 18, weight: 700, colour: c.light, upper: true, lh: 1.1 });
    });
    giftTag(g, 165, 1070, 250, 350, -10, {
      string: [20, 840],
      draw: () => { holly(g, 0, 62, 0.8, -90); },
    });
  },

  morning(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[700, 100], [1080, 90], [1080, 960], [680, 960]], [true, false, false, false], c.green, { seed: 6 });
    paper(g, [[0, 0], [880, 0], [860, 62], [0, 92]], [false, false, true, true], c.red, { seed: 8, kind: "holly", pattern: rgba(c.light, 0.38) });
    paper(g, [[0, 1080], [1080, 1050], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 12 });
    polaroid(g, 730, 650, 640, 850, 2, { pad: 30, bottom: 112, tapeAt: "kraft" });
    textBox(g, HU(g, t.headline), 60, 150, 360, 330, { font: "head", max: 88, min: 44, colour: c.green });
    const keys = ["i1", "i2", "i3", "i4", "i5"];
    // pick the biggest text size that keeps the whole list clear of the banner
    let size = 27;
    const need = (sz: number) => {
      ctx.font = `700 ${sz}px ${g.body}`;
      return keys.reduce((n, k) => n + wrap(ctx, (t[k] ?? "").toUpperCase(), 300).length * sz * 1.18 + 34, 0);
    };
    while (size > 17 && need(size) > 600) size -= 1;
    let y = 440;
    keys.forEach((k) => {
      squareBullet(g, 62, y + 6, 20, c.red);
      const r = textBox(g, t[k], 106, y, 300, 220, { font: "body", max: size, min: size, weight: 700, colour: c.green, upper: true, lh: 1.18 });
      y = r.y + 10;
      rule(g, 62, 410, y, c.red, 2, 0.8);
      y += 20;
    });
    paper(g, [[80, 1110], [1000, 1105], [1000, 1280], [80, 1285]], [false, false, false, false], c.paper, { seed: 30, fringe: "#fffdf6", amp: 2, shadow: true });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(96, 1124, 888, 148);
    textBox(g, t.footer, 110, 1146, 860, 110, { font: "body", max: 40, min: 22, weight: 700, colour: c.red, upper: true, align: "center", lh: 1.22 });
    giftTag(g, 895, 1010, 215, 300, 20, { string: [1000, 900], draw: () => holly(g, 0, 50, 0.62, -90) });
  },

  naughty(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [470, 0], [440, 1350], [0, 1350]], [false, true, true, false], c.green, { seed: 5, kind: "holly", pattern: rgba(c.light, 0.14) });
    polaroid(g, 245, 480, 400, 780, -2, { pad: 22, bottom: 22, tapeAt: "kraft" });
    textBox(g, HU(g, t.headline), 540, 70, 500, 380, { font: "head", max: 78, min: 40, colour: c.green });
    // the table
    const x0 = 527, colW = 256, top = 505, headH = 66, rowH = 112;
    ctx.fillStyle = c.green; ctx.fillRect(x0, top, colW, headH);
    ctx.fillStyle = c.red; ctx.fillRect(x0 + colW + 1, top, colW, headH);
    textBox(g, HU(g, t.niceHead), x0, top + 14, colW, 50, { font: "head", max: 36, min: 22, colour: c.light, align: "center" });
    textBox(g, HU(g, t.naughtyHead), x0 + colW + 1, top + 14, colW, 50, { font: "head", max: 36, min: 22, colour: c.light, align: "center" });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)"; ctx.shadowBlur = 8;
    ctx.fillStyle = c.frame;
    ctx.fillRect(x0, top + headH, colW * 2 + 1, rowH * 5);
    ctx.restore();
    for (let r = 0; r < 5; r++) {
      const y = top + headH + r * rowH;
      ctx.strokeStyle = c.green; ctx.lineWidth = 2;
      ctx.strokeRect(x0, y, colW, rowH);
      ctx.strokeStyle = c.red;
      ctx.strokeRect(x0 + colW + 1, y, colW, rowH);
      textBox(g, t[`n${r + 1}`], x0 + 14, y + 8, colW - 28, rowH - 16, { font: "body", max: 25, min: 16, weight: 500, colour: c.green, align: "center" });
      textBox(g, t[`x${r + 1}`], x0 + colW + 15, y + 8, colW - 28, rowH - 16, { font: "body", max: 25, min: 16, weight: 500, colour: c.red, align: "center" });
    }
    paper(g, [[310, 1190], [1060, 1175], [1060, 1305], [300, 1315]], [true, false, true, false], c.red, { seed: 27, amp: 5 });
    textBox(g, t.footer, 340, 1226, 690, 70, { font: "body", max: 38, min: 20, weight: 700, colour: c.light, align: "center", upper: true });
    giftTag(g, 160, 1095, 245, 335, -8, {
      string: [60, 880],
      draw: (cx) => {
        cx.fillStyle = c.red;
        cx.font = `italic 600 52px ${SCRIPT}`;
        cx.textAlign = "center"; cx.textBaseline = "top";
        lines(cx, wrap(cx, t.tagtext, 180), 0, -34, 56, "center");
      },
    });
    holly(g, 440, 120, 0.5, 20);
  },

  dinner(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [560, 0], [520, 70], [0, 110]], [false, false, true, true], c.green, { seed: 3, kind: "holly", pattern: rgba(c.light, 0.14) });
    paper(g, [[0, 1285], [1080, 1275], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 14 });
    polaroid(g, 195, 650, 440, 620, -2, { pad: 22, bottom: 22 });
    textBox(g, HU(g, t.headline), 410, 100, 640, 320, { font: "head", max: 86, min: 40, colour: c.green });
    const x0 = 426, cw = 200, ch = 232, gap = 7, top = 470;
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), k = i % 3;
      const x = x0 + k * (cw + gap), y = top + r * (ch + gap);
      const mid = i === 4;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.14)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillStyle = mid ? c.red : c.frame;
      ctx.fillRect(x, y, cw, ch);
      ctx.restore();
      ctx.strokeStyle = mid ? shade(c.red, -0.3) : c.green; ctx.lineWidth = 2;
      ctx.strokeRect(x + 7, y + 7, cw - 14, ch - 14);
      const word = t[`c${i + 1}`] ?? "";
      if (word) {
        const h = ch - 40;
        // vertically centre: measure first with a dry run
        ctx.font = `700 26px ${g.body}`;
        const probe = wrap(ctx, word.toUpperCase(), cw - 38);
        const guess = Math.min(26, 26);
        const used = probe.length * guess * 1.2;
        textBox(g, word, x + 19, y + 20 + Math.max(0, (h - used) / 2), cw - 38, h, { font: "body", max: 26, min: 15, weight: 700, colour: mid ? c.light : c.green, align: "center", upper: true, lh: 1.2 });
      }
    }
    // a little pile of wrapped presents, bottom left
    paper(g, [[0, 1010], [290, 1040], [270, 1290], [0, 1290]], [false, true, false, false], c.red, { seed: 33, kind: "holly", pattern: rgba(c.light, 0.34) });
    ctx.fillStyle = c.green; ctx.fillRect(110, 1010, 36, 280);
    ctx.save(); ctx.translate(128, 1010); ctx.rotate(-0.4);
    ctx.fillStyle = c.green; ctx.beginPath(); ctx.ellipse(-30, -20, 44, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(34, -26, 44, 26, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    giftTag(g, 150, 190, 230, 300, -20, {
      string: [20, 40],
      draw: () => { holly(g, 0, 40, 0.6, -90); },
    });
  },

  woman(g) {
    const { ctx, c, t } = g;
    fullBleed(g);
    paper(g, [[0, 0], [700, 0], [660, 78], [0, 105]], [false, false, true, true], c.green, { seed: 3, kind: "holly", pattern: rgba(c.light, 0.14) });
    paper(g, [[0, 1235], [1080, 1215], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 19 });
    giftTag(g, 810, 690, 520, 1040, 5, {
      string: [900, 90],
      draw: (cx) => {
        const x = -210, w = 420;
        g.ctx = cx;
        textBox(g, t.to, x, -385, w, 190, { font: "body", max: 40, min: 24, weight: 700, colour: c.green, upper: true, lh: 1.14 });
        rule(g, x, x + w, -175, c.red, 2, 0.8);
        textBox(g, t.from, x, -155, w, 60, { font: "body", max: 40, min: 24, weight: 700, colour: c.red, upper: true });
        const items = ["i1", "i2", "i3", "i4"];
        let y = -80;
        items.forEach((k) => {
          star(cx, x + 14, y + 20, 11, c.red);
          const r = textBox(g, t[k], x + 42, y, w - 42, 90, { font: "body", max: 26, min: 17, weight: 600, colour: c.green, lh: 1.2 });
          y = Math.max(r.y, y + 38) + 12;
        });
        rule(g, x, x + w, y + 8, c.red, 2, 0.8);
        textBox(g, t.footer, x, y + 26, w, Math.max(60, 470 - (y + 26)), { font: "body", max: 42, min: 20, weight: 700, colour: c.red, upper: true, lh: 1.12 });
      },
    });
    holly(g, 905, 1245, 0.9, -28);
    void ctx;
  },

  face(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [860, 0], [830, 60], [0, 78]], [false, false, true, true], c.red, { seed: 5, kind: "holly", pattern: rgba(c.light, 0.34) });
    polaroid(g, 770, 575, 640, 1020, 0, { pad: 26, bottom: 26 });
    paper(g, [[0, 1085], [1080, 1065], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 21 });
    textBox(g, HU(g, t.headline), 44, 130, 395, 480, { font: "head", max: 96, min: 44, colour: c.green });
    rule(g, 44, 190, 625, c.red, 3);
    star(ctx, 232, 625, 13, c.red);
    rule(g, 270, 410, 625, c.red, 3);
    textBox(g, t.body, 44, 665, 400, 300, { font: "body", max: 30, min: 18, weight: 600, colour: c.green, upper: true, lh: 1.28 });
    textBox(g, t.footer, 380, 1150, 660, 170, { font: "body", max: 40, min: 20, weight: 700, colour: c.light, upper: true, lh: 1.2 });
    giftTag(g, 125, 1175, 230, 320, 14, { string: [200, 1040], draw: () => holly(g, 0, 40, 0.6, -90) });
  },

  closed(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[540, 0], [1080, 0], [1080, 1350], [500, 1350]], [true, false, false, true], c.green, { seed: 6, kind: "holly", pattern: rgba(c.light, 0.14) });
    paper(g, [[0, 0], [60, 0], [60, 1], [0, 1]], [false, false, false, false], c.paper, { seed: 1, shadow: false });
    polaroid(g, 750, 575, 620, 860, 2.5, { pad: 28, bottom: 28, tapeAt: "candy" });
    textBox(g, HU(g, t.headline), 40, 140, 385, 460, { font: "head", max: 94, min: 44, colour: c.green });
    rule(g, 40, 410, 612, c.red, 3);
    textBox(g, t.lines, 40, 634, 385, 150, { font: "body", max: 30, min: 18, weight: 700, colour: c.green, upper: true, lh: 1.22 });
    rule(g, 40, 410, 800, c.red, 3);
    textBox(g, t.thanks, 40, 822, 385, 190, { font: "body", max: 27, min: 17, weight: 500, colour: c.green });
    giftTag(g, 705, 1130, 640, 270, -2, {
      shape: "left", string: [300, 1050],
      draw: (cx) => {
        cx.fillStyle = c.green;
        cx.font = `700 34px ${g.body}`;
        cx.textAlign = "center"; cx.textBaseline = "top";
        cx.fillText(HU(g, t.reopen).toUpperCase(), 25, -78);
        cx.fillStyle = c.red;
        const sz = Math.min(110, 96);
        cx.font = `${g.headW} ${sz}px ${g.head}`;
        let size = sz;
        while (cx.measureText((t.date ?? "").toUpperCase()).width > 420 && size > 30) { size -= 4; cx.font = `${g.headW} ${size}px ${g.head}`; }
        cx.fillText((t.date ?? "").toUpperCase(), 25, -24);
      },
    });
    holly(g, 150, 1180, 0.95, -25);
    void ctx;
  },

  merry(g) {
    const { ctx, c, t } = g;
    bg(g);
    polaroid(g, 755, 515, 620, 920, 0, { pad: 26, bottom: 26 });
    paper(g, [[0, 1000], [1080, 980], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 18 });
    textBox(g, HU(g, t.headline), 44, 150, 380, 360, { font: "head", max: 82, min: 40, colour: c.green });
    rule(g, 44, 400, 520, c.red, 2);
    textBox(g, t.lines, 44, 548, 380, 300, { font: "body", max: 28, min: 17, weight: 600, colour: c.green, upper: true, lh: 1.38 });
    textBox(g, t.note, 44, 860, 380, 100, { font: "body", max: 30, min: 18, weight: 700, colour: c.green, upper: true, lh: 1.2 });
    giftTag(g, 250, 1085, 520, 190, -4, {
      shape: "left", string: [0, 1010],
      draw: (cx) => {
        cx.fillStyle = c.red;
        cx.textAlign = "center"; cx.textBaseline = "middle";
        let s = 52;
        cx.font = `700 ${s}px ${g.body}`;
        const txt = HU(g, fillBrackets(t.clinic)).toUpperCase();
        while (cx.measureText(txt).width > 380 && s > 22) { s -= 2; cx.font = `700 ${s}px ${g.body}`; }
        cx.fillText(txt, 22, 0);
      },
    });
    textBox(g, t.footer, 560, 1110, 470, 170, { font: "body", max: 36, min: 20, weight: 600, colour: c.light, lh: 1.3 });
    void ctx;
  },

  // ------------------------------------------------------------ New Year
  nycover(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [1080, 0], [1080, 40], [0, 70]], [false, false, true, true], c.green, { seed: 4 });
    polaroid(g, 800, 690, 600, 980, 2, { pad: 26, bottom: 26, tapeAt: "kraft" });
    twoTone(g, (t.headline ?? "").split("\n")[0] ?? "", (t.headline ?? "").split("\n")[1] ?? "", 56, 120, 470, 400, 140, 60, c.ink, c.green);
    sticky(g, 215, 760, 330, 270, -4, c.tag, (cx) => {
      cx.fillStyle = c.ink; cx.textAlign = "left"; cx.textBaseline = "top";
      g.ctx = cx;
      textBox(g, t.sub, -140, -105, 280, 210, { font: "body", max: 34, min: 20, weight: 700, colour: c.ink, upper: true, lh: 1.15 });
    }, true);
    paper(g, [[0, 1130], [1080, 1100], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 21 });
    textBox(g, HU(g, t.footer), 60, 1190, 960, 120, { font: "head", max: 78, min: 36, colour: c.ink, align: "center" });
    void ctx;
  },

  nyleaving(g) {
    const { ctx, c, t } = g;
    bg(g);
    // punched strip across the top right
    notebook(g, 690, 50, 400, 130, { holes: false, lines: false, colour: "#e6e0d3" });
    for (let x = 720; x < 1070; x += 32) { ctx.fillStyle = "#cfc8b9"; ctx.beginPath(); ctx.arc(x, 80, 7, 0, Math.PI * 2); ctx.fill(); }
    textBox(g, HU(g, t.headline), 48, 60, 620, 300, { font: "head", max: 96, min: 44, colour: c.ink });
    strike(g, 60, 420, 372, shade(c.green, -0.1), 6);
    polaroid(g, 335, 740, 600, 780, -2, { pad: 24, bottom: 70 });
    const keys = ["i1", "i2", "i3", "i4", "i5"];
    const ys = [262, 424, 575, 729, 883];
    keys.forEach((k, i) => {
      sticky(g, 830, ys[i] + 72, 410, 142, 0, c.tag, (cx) => {
        cx.strokeStyle = c.red; cx.lineWidth = 7; cx.lineCap = "round";
        cx.beginPath(); cx.moveTo(-170, -22); cx.lineTo(-136, 12); cx.moveTo(-136, -22); cx.lineTo(-170, 12); cx.stroke();
        g.ctx = cx;
        textBox(g, t[k], -110, -50, 280, 100, { font: "body", max: 28, min: 16, weight: 500, colour: c.ink, lh: 1.2 });
      });
    });
    tape(g, 835, 252, 220, 48, 0, "kraft");
    paper(g, [[32, 1140], [1010, 1130], [1010, 1330], [32, 1335]], [true, false, true, false], c.green, { seed: 13 });
    ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = c.red;
    ctx.beginPath(); ctx.arc(102, 1235, 24, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    textBox(g, HU(g, t.footer), 170, 1175, 800, 130, { font: "body", max: 42, min: 22, weight: 700, colour: c.ink, upper: true, lh: 1.16 });
    strike(g, 170, 940, 1316, c.red, 5);
  },

  nyageing(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[880, 50], [1080, 30], [1080, 800], [900, 800]], [false, false, false, false], c.green, { seed: 2, shadow: false });
    notebook(g, 24, 60, 440, 760);
    paper(g, [[60, 40], [235, 40], [235, 105], [60, 105]], [false, false, false, false], c.green, { seed: 3, shadow: false });
    textBox(g, t.label, 76, 155, 360, 40, { font: "body", max: 22, min: 14, weight: 700, colour: c.ink, upper: true });
    rule(g, 76, 396, 202, c.ink, 2, 0.7);
    textBox(g, HU(g, t.headline), 76, 236, 360, 520, { font: "head", max: 52, min: 26, colour: c.ink, lh: 1.14 });
    polaroid(g, 750, 640, 620, 1100, 0, { pad: 26, bottom: 26 });
    paper(g, [[0, 960], [420, 1000], [420, 1350], [0, 1350]], [false, true, false, false], c.green, { seed: 9 });
    ctx.save(); ctx.strokeStyle = shade(c.green, -0.45); ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(150, 1050); ctx.bezierCurveTo(210, 1070, 215, 1140, 190, 1180); ctx.bezierCurveTo(175, 1210, 205, 1225, 190, 1250); ctx.bezierCurveTo(170, 1290, 120, 1290, 90, 1270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(110, 1120); ctx.quadraticCurveTo(140, 1105, 165, 1125); ctx.stroke();
    ctx.restore();
    sticky(g, 270, 925, 380, 390, -2, c.tag, () => {
      g.ctx = ctx;
    });
    // the note text sits inside the sticky, drawn upright over it
    textBox(g, t.note, 110, 780, 320, 300, { font: "body", max: 30, min: 18, weight: 700, colour: c.ink, lh: 1.22 });
    ctx.save(); ctx.fillStyle = "#d8c9a4"; ctx.beginPath(); ctx.arc(268, 752, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    paper(g, [[600, 1215], [1080, 1195], [1080, 1300], [600, 1305]], [true, true, false, true], c.red, { seed: 41, amp: 10, shadow: false, fringe: c.red });
  },

  nynothanks(g) {
    const { ctx, c, t } = g;
    bg(g);
    notebook(g, 32, 50, 540, 700);
    // pin
    ctx.fillStyle = c.green; ctx.beginPath(); ctx.arc(300, 78, 28, 0, Math.PI * 2); ctx.fill();
    const hl = HU(g, t.headline);
    const r = textBox(g, hl, 82, 150, 460, 380, { font: "head", max: 90, min: 44, colour: c.ink });
    // a red line through every line of the headline
    const lineH = Math.round(r.size * 1.04);
    const n = Math.max(1, Math.round((r.y - 150) / lineH));
    for (let i = 0; i < n; i++) strike(g, 70, 540, 150 + i * lineH + r.size * 0.52, c.red, 8);
    sticky(g, 345, 800, 500, 470, 1, c.tag, undefined, true);
    textBox(g, t.note, 135, 620, 380, 360, { font: "hand", max: 56, min: 28, weight: 600, colour: c.ink, upper: true, lh: 1.16 });
    polaroid(g, 815, 660, 520, 1040, 0, { pad: 24, bottom: 120 });
    paper(g, [[0, 1040], [690, 1040], [670, 1300], [0, 1300]], [true, true, false, false], c.green, { seed: 17 });
    textBox(g, t.footer, 50, 1090, 560, 190, { font: "body", max: 44, min: 24, weight: 700, colour: c.ink, lh: 1.2 });
    ctx.save(); ctx.fillStyle = c.red; ctx.beginPath(); ctx.arc(640, 1110, 72, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    heart(g, 640, 1112, 60, c.light, false, 5);
  },

  nypractitioner(g) {
    const { ctx, c, t } = g;
    bg(g);
    polaroid(g, 820, 705, 600, 1280, 0, { pad: 24, bottom: 24, tapeAt: "kraft" });
    twoTone(g, t.headline, t.sub, 36, 60, 430, 410, 92, 44, c.ink, shade(c.green, -0.12));
    notebook(g, 14, 480, 520, 820);
    paperclip(g, 508, 520, 12, shade(c.green, -0.3));
    const keys = ["i1", "i2", "i3", "i4", "i5", "i6"];
    keys.forEach((k, i) => {
      const y = 556 + i * 112;
      ctx.fillStyle = i % 2 === 0 ? c.tag : c.frame;
      ctx.strokeStyle = shade(c.red, 0.0); 
      ctx.beginPath(); ctx.arc(92, y + 38, 28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(c.tag, -0.3); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = c.ink; ctx.font = `700 26px ${g.body}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), 92, y + 40); ctx.textBaseline = "top";
      textBox(g, t[k], 140, y, 350, 96, { font: "body", max: 28, min: 17, weight: 600, colour: c.ink, lh: 1.18 });
      rule(g, 70, 500, y + 100, c.ink, 1.5, 0.25);
    });
    sticky(g, 700, 1140, 220, 250, -5, c.tag, () => { heart(g, 0, 10, 70, c.red, false, 4); });
  },

  nypatient(g) {
    const { ctx, c, t } = g;
    bg(g);
    textBox(g, HU(g, t.headline), 50, 40, 980, 270, { font: "head", max: 86, min: 44, colour: c.ink });
    notebook(g, 14, 370, 500, 690);
    tape(g, 260, 360, 200, 46, -2, "kraft");
    tickRows(g, ["i1", "i2", "i3", "i4", "i5", "i6", "i7"], 66, 408, 420, 92, { box: c.ink, text: c.ink, size: 24, weight: 600, boxSize: 30 });
    polaroid(g, 785, 725, 570, 740, 2, { pad: 24, bottom: 24 });
    paperclip(g, 905, 360, -6, c.red);
    paper(g, [[27, 1085], [1053, 1070], [1053, 1275], [27, 1285]], [true, false, true, false], c.green, { seed: 31 });
    textBox(g, HU(g, t.lead), 40, 1112, 1000, 60, { font: "body", max: 46, min: 24, weight: 800, colour: c.ink, align: "center", upper: true });
    textBox(g, HU(g, t.last), 40, 1176, 1000, 70, { font: "body", max: 52, min: 24, weight: 800, colour: c.red, align: "center", upper: true });
    paper(g, [[324, 1275], [797, 1270], [797, 1330], [324, 1335]], [false, false, false, false], c.tag, { seed: 5, shadow: false, fringe: c.tag });
    textBox(g, HU(g, t.pill), 324, 1286, 473, 40, { font: "body", max: 26, min: 14, weight: 700, colour: c.ink, align: "center", upper: true });
    void ctx;
  },

  nyskin(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [400, 0], [330, 150], [0, 190]], [false, false, true, true], c.green, { seed: 6, shadow: false });
    notebook(g, 0, 150, 500, 1040);
    paperclip(g, 55, 140, 4, c.red);
    textBox(g, HU(g, t.headline), 80, 250, 340, 190, { font: "head", max: 80, min: 40, colour: c.ink });
    rule(g, 80, 420, 450, c.red, 3);
    tickRows(g, ["i1", "i2", "i3", "i4", "i5"], 74, 485, 350, 118, { box: c.red, text: c.ink, size: 28, weight: 600, boxSize: 34 });
    polaroid(g, 790, 600, 580, 1080, 1, { pad: 28, bottom: 130 });
    tape(g, 720, 96, 250, 52, 3, "kraft");
    sticky(g, 235, 1235, 250, 230, -3, c.tag, () => { heart(g, 0, 10, 80, c.red, false, 5); });
    paper(g, [[880, 1120], [1080, 1090], [1080, 1350], [820, 1350]], [true, false, false, true], c.green, { seed: 25 });
    ctx.save(); ctx.fillStyle = "#c9b89a"; ctx.beginPath(); ctx.arc(930, 1240, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },

  nyfour(g) {
    const { ctx, c, t } = g;
    // a sage planner cover with a cream page and gold rings
    ctx.fillStyle = shade(c.paper, -0.04); ctx.fillRect(0, 0, XW, XH);
    ctx.fillStyle = c.green; ctx.fillRect(40, 20, 1040, 1310);
    notebook(g, 110, 40, 940, 1270, { holes: false, lines: false, colour: "#fbf9f4" });
    for (let y = 110; y < 1260; y += 150) {
      ctx.strokeStyle = "#b99a4a"; ctx.lineWidth = 9; ctx.lineCap = "round";
      ctx.beginPath(); ctx.ellipse(104, y, 62, 22, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#e8dcc0"; ctx.beginPath(); ctx.arc(128, y, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = c.red; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(310, 168, 150, 48, -0.04, 0, Math.PI * 2); ctx.stroke();
    textBox(g, HU(g, t.label), 170, 146, 280, 44, { font: "body", max: 30, min: 18, weight: 800, colour: c.red, align: "center", upper: true });
    textBox(g, HU(g, t.headline), 195, 260, 360, 480, { font: "head", max: 80, min: 38, colour: c.ink });
    // little wall calendar, top right of the page
    ctx.save(); ctx.fillStyle = "#fff"; ctx.fillRect(790, 90, 230, 190); ctx.strokeStyle = "#9aa"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) ctx.strokeRect(795 + i * 32, 110 + j * 32, 32, 32);
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(985, 232, 20, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    sticky(g, 320, 960, 410, 370, -2, c.green, undefined, true);
    textBox(g, t.note, 135, 805, 360, 300, { font: "body", max: 28, min: 17, weight: 700, colour: c.ink, lh: 1.22 });
    polaroid(g, 835, 700, 520, 780, 2, { pad: 22, bottom: 80 });
    paperclip(g, 590, 390, -8, shade(c.tag, -0.25));
    paper(g, [[210, 1160], [980, 1150], [980, 1300], [210, 1310]], [true, false, true, false], c.tag, { seed: 43, fringe: shade(c.tag, 0.4) });
    textBox(g, HU(g, t.footer), 210, 1190, 770, 90, { font: "body", max: 56, min: 26, weight: 800, colour: c.ink, align: "center", upper: true });
    strike(g, 330, 860, 1274, c.red, 5);
  },

  nycompare(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[470, 40], [1080, 20], [1080, 500], [470, 520]], [false, false, false, false], c.green, { seed: 8, shadow: false });
    notebook(g, 14, 70, 500, 780);
    ctx.fillStyle = shade(c.red, 0.45); ctx.fillRect(74, 138, 340, 74);
    textBox(g, HU(g, t.label), 74, 152, 340, 50, { font: "body", max: 30, min: 16, weight: 800, colour: c.ink, align: "center", upper: true });
    const y2 = twoTone(g, t.headline, t.hot, 74, 250, 350, 560, 60, 28, c.ink, c.red);
    void y2;
    polaroid(g, 800, 615, 560, 1090, 0, { pad: 26, bottom: 70 });
    paperclip(g, 540, 120, -8, c.red);
    // planner, bottom left
    ctx.save(); ctx.translate(210, 1130); ctx.rotate(-0.12);
    ctx.fillStyle = "#566147"; ctx.fillRect(-250, -230, 500, 470);
    ctx.fillStyle = "#f6f0e2"; ctx.fillRect(-230, -210, 450, 430);
    ctx.fillStyle = c.red; ctx.font = `600 26px ${g.body}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Saturday", -140, -170);
    ctx.fillStyle = c.ink; ctx.fillText("17", 120, -170);
    ctx.restore();
    sticky(g, 845, 1130, 300, 380, 3, c.tag, undefined, true);
    textBox(g, t.note, 715, 975, 260, 320, { font: "body", max: 28, min: 16, weight: 700, colour: c.ink, lh: 1.22 });
  },

  nypokemon(g) {
    const { ctx, c, t } = g;
    bg(g);
    notebook(g, 700, 30, 380, 150, { holes: false, lines: true, colour: "#f3efe6" });
    twoTone(g, t.headline, t.hot, 48, 45, 800, 320, 84, 40, c.ink, shade(c.green, -0.25));
    // a cream checklist card
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#f4efe3"; ctx.beginPath(); ctx.roundRect(40, 410, 450, 650, 24); ctx.fill(); ctx.restore();
    tape(g, 265, 408, 190, 46, -1, "kraft");
    tickRows(g, ["i1", "i2", "i3", "i4", "i5"], 80, 480, 380, 110, { box: c.ink, text: c.ink, size: 30, weight: 800, boxSize: 28, strikeKeys: ["i1"] });
    polaroid(g, 780, 740, 600, 700, 0, { pad: 24, bottom: 24 });
    ctx.fillStyle = c.tag; ctx.beginPath(); ctx.arc(930, 400, 40, 0, Math.PI * 2); ctx.fill();
    paper(g, [[0, 1110], [1080, 1090], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 27 });
    ctx.save(); ctx.strokeStyle = c.red; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(165, 1215, 92, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    star(ctx, 165, 1215, 54, c.red);
    textBox(g, HU(g, t.footer), 300, 1150, 740, 150, { font: "head", max: 78, min: 36, colour: c.ink, lh: 1.04 });
    paper(g, [[800, 1000], [1080, 985], [1080, 1080], [820, 1090]], [true, true, false, true], c.tag, { seed: 52, shadow: false, fringe: c.tag });
  },
};

// the clinic name on the tag is a token already filled in by the caller
function fillBrackets(s: string) { return s; }

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export type DrawInput = {
  design: DesignId;
  text: Record<string, string>; // already resolved, no tokens left
  palette: Palette;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  logo?: HTMLImageElement | null;
  logoPos?: LogoPos;
};

export type LogoPos = "off" | "tl" | "tr" | "bl" | "br";
export const LOGO_POSITIONS: { value: LogoPos; label: string }[] = [
  { value: "off", label: "No logo" },
  { value: "tl", label: "Top left" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "br", label: "Bottom right" },
];

// The logo sits on a small paper plate in the chosen corner, so it reads on any colour or photo.
function drawLogo(g: G, logo: HTMLImageElement, pos: LogoPos) {
  const { ctx, c } = g;
  const maxW = 230, maxH = 96, pad = 16, m = 28;
  const sc = Math.min(maxW / logo.width, maxH / logo.height);
  const w = logo.width * sc, h = logo.height * sc;
  const pw = w + pad * 2, ph = h + pad * 2;
  const x = pos === "tl" || pos === "bl" ? m : XW - m - pw;
  const y = pos === "tl" || pos === "tr" ? m : XH - m - ph;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = c.frame;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 14);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(logo, x + pad, y + pad, w, h);
}

export function resolveText(design: Design, text: Record<string, string>, fill: Fill): Record<string, string> {
  return Object.fromEntries(design.fields.map((fd) => [fd.key, fillTokens(text[fd.key] ?? design.defaults[fd.key] ?? "", fill)]));
}

export function headWeightFor(font: string): number {
  return /anton|bebas|oswald|league|archivo narrow|fjalla|pathway|teko|staatliches|passion|big shoulders/i.test(font) ? 400 : 700;
}

export function drawXmas(ctx: Ctx, d: DrawInput): Slot[] {
  const g: G = {
    ctx, t: d.text, c: d.palette, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: d.upper, photo: d.photo, focus: d.focus, slots: [],
  };
  ctx.save();
  ctx.textBaseline = "top";
  LAYOUTS[d.design](g);
  if (d.logo && d.logoPos && d.logoPos !== "off") drawLogo(g, d.logo, d.logoPos);
  ctx.restore();
  return g.slots;
}

// Placeholders that have not been filled in yet, such as [DATE]
export function leftoverPlaceholders(text: Record<string, string>): string[] {
  const out: string[] = [];
  for (const v of Object.values(text)) {
    const m = (v ?? "").match(/\[[^\]]+\]/g);
    if (m) out.push(...m);
  }
  return out;
}
