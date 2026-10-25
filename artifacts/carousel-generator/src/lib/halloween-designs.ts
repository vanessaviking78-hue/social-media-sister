// Halloween Posts: ten single image "Things scarier than Halloween" designs, drawn straight onto a 1080 x 1350
// canvas so the preview, the download and the scheduled image are always identical. No React in here.
// Every colour comes from the Palette, so every colour can be changed per client.
// The drawing kit (torn paper, tape, paperclips) is shared with the Xmas and November tools.

import { fillTokens, type Fill } from "./basic-covers";
import {
  XW, XH, HU, bg, drawLogo, drawPhoto, headWeightFor, paper, paperclip, placeholder, rand, rgba, shade, tape, textBox, tornPath,
  type Ctx, type Focus, type G, type LogoPos, type P, type Palette, type Slot,
} from "./xmas-designs";

export { XW, XH };

// Black page, blood red, parchment and cream. Same keys as the other seasonal palettes so the colour boxes work the same way.
export const HALLOWEEN_PALETTE: Palette = {
  paper: "#0d0d0d",
  green: "#1c1717",
  red: "#a3201f",
  tag: "#d8cbb1",
  frame: "#e8dfcc",
  light: "#e4d9c6",
  ink: "#141210",
};

export const HALLOWEEN_PALETTE_LABELS: { key: keyof Palette; label: string }[] = [
  { key: "paper", label: "Background" },
  { key: "red", label: "Blood red" },
  { key: "tag", label: "Parchment" },
  { key: "frame", label: "Photo frames and cards" },
  { key: "green", label: "Dark panels" },
  { key: "light", label: "Light text" },
  { key: "ink", label: "Text on paper" },
];

export type HalId = "friend" | "evidence" | "ghost" | "crystal" | "nosay" | "camera" | "mirror" | "vhs" | "receipt" | "chat";

export type FieldDef = { key: string; label: string; rows?: number };

export type HalDesign = {
  id: HalId;
  name: string;
  idea: string;
  fields: FieldDef[];
  defaults: Record<string, string>;
};

const f = (key: string, label: string, rows = 1): FieldDef => ({ key, label, rows });
const FOOT = "{clinic} / {area}";

// In the order they go out.
export const HALLOWEEN_DESIGNS: HalDesign[] = [
  {
    id: "friend", name: "My friend can do it cheaper",
    idea: "a funny, blunt post that the scariest sentence a practitioner hears is my friend can do it cheaper, five words, one practitioner, absolutely haunted, gently reminding people that cheap and safe are not always the same thing",
    fields: [f("h", "Headline", 4), f("big", "Big red words", 3), f("small", "Small words", 3), f("footer", "Bottom band")],
    defaults: { h: "Things\nscarier\nthan\nhalloween", big: "My friend\ncan do it\ncheaper.", small: "Five words.\nOne practitioner.\nAbsolutely haunted.", footer: FOOT },
  },
  {
    id: "evidence", name: "Three acids, two retinoids and a scrub",
    idea: "a funny evidence file about the bathroom cabinet: finding three acids, two retinoids, a scrub and the word tingling in the same routine, somewhere a skin barrier just locked the door",
    fields: [f("h1", "Headline top", 2), f("h2", "Headline red"), f("h3", "Headline end", 2), f("l1", "Shelf label 1"), f("l2", "Shelf label 2"), f("l3", "Shelf label 3"),
      f("note", "Card words", 6), f("small", "Small words under", 2), f("tag", "Tag word"), f("num", "Tag number"), f("footer", "Bottom band")],
    defaults: {
      h1: "things", h2: "scarier", h3: "than\nhalloween", l1: "unknown", l2: "potent", l3: "use caution",
      note: "Finding three acids, two retinoids, a scrub and the word 'tingling' in the same routine.", small: "Somewhere, a skin\nbarrier just locked the door.",
      tag: "evidence", num: "#07", footer: FOOT,
    },
  },
  {
    id: "ghost", name: "The ghost of treatments past",
    idea: "a funny and gentle post about the ghost of treatments past, someone who had filler somewhere in 2021 and cannot remember what, how much or who did it, so please tell your practitioner everything you do remember",
    fields: [f("top", "Top line"), f("h", "Headline", 4), f("l1", "Line 1", 2), f("l2", "Line 2", 2), f("l3", "Line 3"), f("l4", "Line 4"), f("note", "Red note", 3), f("footer", "Bottom words")],
    defaults: {
      top: "Things Scarier than Halloween", h: "the ghost of\ntreatments\npast", l1: "I had filler somewhere in 2021. I think.", l2: "I can't remember what.", l3: "Or how much.", l4: "Or who did it.",
      note: "Please tell me everything you do remember.", footer: FOOT,
    },
  },
  {
    id: "crystal", name: "Will I see my final result by Friday",
    idea: "a funny crystal ball post about the patient question will I see my final result by Friday, the spirits refuse to overpromise, and the honest answer is to ask your practitioner about the actual timeline",
    fields: [f("h1", "Headline line 1"), f("h2", "Headline line 2 (red)"), f("label", "Card label"), f("q", "The question", 5), f("under", "Words under the card", 3), f("ball", "Crystal ball label", 2), f("answer", "Crystal ball answer", 5), f("footer", "Bottom words")],
    defaults: {
      h1: "things scarier", h2: "than halloween", label: "patient question", q: "will i see my final result by friday?", under: "The spirits refuse to overpromise.",
      ball: "crystal-ball answer", answer: "ask your practitioner about the actual timeline.", footer: FOOT,
    },
  },
  {
    id: "nosay", name: "A practitioner who never says no",
    idea: "a blunt post that a practitioner who never says no is the scary one: no assessment, no boundaries, no I don't think you need that, no thanks, and that good practitioners are not yes people",
    fields: [f("h", "Top words", 2), f("pre", "Small first word"), f("big", "Big words", 3), f("list", "List", 5), f("end", "Bottom words", 2), f("num", "Corner number"), f("footer", "Bottom words small")],
    defaults: {
      h: "Things Scarier\nthan Halloween", pre: "A", big: "Practitioner\nWho Never\nSays No.", list: "No assessment.\nNo boundaries.\nNo 'I DON'T THINK YOU NEED THAT.'\nNo thanks.",
      end: "Good practitioners aren't yes people.", num: "10", footer: FOOT,
    },
  },
  {
    id: "camera", name: "Opening the front camera by accident",
    idea: "a funny post about opening the front camera by accident, half a times zoom, overhead lighting, no warning, and nobody surviving emotionally unchanged",
    fields: [f("h", "Headline", 3), f("hot", "Last word (red)"), f("cam", "Camera label"), f("rec", "Recording word"), f("time", "Time"), f("big", "Card headline", 2), f("bigHot", "Card last line (red)"),
      f("r1", "List 1"), f("r2", "List 2"), f("r3", "List 3"), f("r4", "List 4", 2), f("footer", "Bottom words")],
    defaults: {
      h: "Things\nScarier\nThan", hot: "Halloween", cam: "Cam 02", rec: "Rec", time: "07:14", big: "Opening the\nFront Camera", bigHot: "By Accident.",
      r1: "0.5x.", r2: "Overhead lighting.", r3: "No warning.", r4: "Nobody survives emotionally unchanged.", footer: FOOT,
    },
  },
  {
    id: "mirror", name: "The 10x magnifying mirror",
    idea: "a funny post about the 10x magnifying mirror, known to turn one perfectly ordinary pore into a national emergency, a gentle reminder that nobody looks at you from six inches away",
    fields: [f("h1", "Headline 1"), f("h2", "Headline 2 (red)"), f("h3", "Headline 3"), f("h4", "Headline 4"), f("cal", "Calendar number"), f("pre", "Tag small word"), f("big", "Tag big words"), f("tagline", "Tag words", 2), f("small", "Card words", 5), f("footer", "Bottom words")],
    defaults: {
      h1: "things", h2: "scarier", h3: "than", h4: "halloween", cal: "03", pre: "THE", big: "10X", tagline: "MAGNIFYING\nMIRROR",
      small: "Known to transform one perfectly ordinary pore into a national emergency.", footer: FOOT,
    },
  },
  {
    id: "vhs", name: "The aftercare rebellion",
    idea: "a funny post about the aftercare rebellion, she was given clear aftercare, then her group chat got involved, and this October everyone is an expert",
    fields: [f("vhs", "Tape label"), f("hifi", "Tape small word"), f("genre", "Sticker top"), f("tape", "Sticker bottom"), f("title", "Top line"), f("play", "Play label"), f("pre", "Small first word"),
      f("w1", "Big word 1"), f("w2", "Big word 2 (red)"), f("body", "Words", 4), f("badge", "Red circle", 3), f("footer", "Bottom words")],
    defaults: {
      vhs: "VHS", hifi: "Hi-fi", genre: "Horror", tape: "T-120", title: "Things Scarier Than Halloween", play: "Play ▸", pre: "The", w1: "Aftercare", w2: "Rebellion",
      body: "She was given\nclear aftercare.\nThen her group\nchat got involved.", badge: "This October,\neveryone's\nan expert.", footer: FOOT,
    },
  },
  {
    id: "receipt", name: "Checking your SPF and seeing EXP 2022",
    idea: "a funny receipt post about the skincare shopping habit: a new serum, another serum, an LED mask, and forgetting sunscreen, then checking your SPF and seeing exp 2022, terrifying priorities",
    fields: [f("h", "Headline", 3), f("hot", "Last word (red)"), f("r1", "Receipt 1"), f("p1", "Price 1"), f("r2", "Receipt 2"), f("p2", "Price 2"), f("r3", "Receipt 3"), f("p3", "Price 3"),
      f("r4", "Receipt 4 (circled)"), f("p4", "Price 4"), f("tl", "Total label"), f("tp", "Total price"), f("s1", "Red box words", 2), f("s2", "Red box dark words"), f("s3", "Red box last line"), f("footer", "Bottom words")],
    defaults: {
      h: "things\nscarier\nthan", hot: "halloween", r1: "bought expensive serum", p1: "££.££", r2: "bought another serum", p2: "££.££", r3: "bought LED mask", p3: "££.££",
      r4: "forgot sunscreen", p4: "££.££", tl: "total", tp: "£££.££", s1: "checking your\nspf and seeing", s2: "'exp 2022'.", s3: "terrifying priorities.", footer: FOOT,
    },
  },
  {
    id: "chat", name: "I've got a wedding tomorrow",
    idea: "a funny and honest post about the last minute message hi hun I've got a wedding tomorrow can we do everything today, with the reminder that timing matters and the sensible answer is to plan ahead",
    fields: [f("h1", "Headline 1 (red)"), f("h2", "Headline 2"), f("msg", "Their message", 5), f("reply", "Your reply (leave empty if you like)", 3), f("cta", "Bottom words"), f("footer", "Bottom small words")],
    defaults: { h1: "things scarier", h2: "than halloween", msg: "Hi hun, I've got a wedding tomorrow. Can we do everything today?", reply: "", cta: "timing matters. Plan ahead.", footer: FOOT },
  },
];

export const HALLOWEEN_BY_ID: Record<HalId, HalDesign> = Object.fromEntries(HALLOWEEN_DESIGNS.map((d) => [d.id, d])) as Record<HalId, HalDesign>;

// ---------------------------------------------------------------------------
// Small helpers for this set
// ---------------------------------------------------------------------------

const mute = (g: G) => shade(g.c.light, -0.42);

// Tall, narrow headline lines: one size for the whole stack, squeezed sideways (never below minSx) so long words still fit.
function hstack(g: G, items: { text: string; colour: string }[], x: number, y: number, w: number, hMax: number, max: number, o?: { lh?: number; minSx?: number; min?: number; align?: CanvasTextAlign }): number {
  const { ctx } = g;
  const lh = o?.lh ?? 0.92, minSx = o?.minSx ?? 0.5, min = o?.min ?? 30;
  const rows: { t: string; colour: string }[] = [];
  items.forEach((it) => (it.text ?? "").split("\n").filter((s) => s.length).forEach((t) => rows.push({ t: HU(g, t), colour: it.colour })));
  if (!rows.length) return y;
  const widest = (s: number) => { ctx.font = `${g.headW} ${s}px ${g.head}`; return Math.max(...rows.map((r) => ctx.measureText(r.t).width)); };
  let s = Math.min(max, Math.floor(hMax / (rows.length * lh)));
  while (s > min && w / widest(s) < minSx) s -= 2;
  const sx = Math.min(1, w / widest(s));
  ctx.font = `${g.headW} ${s}px ${g.head}`;
  ctx.textBaseline = "top"; ctx.textAlign = o?.align ?? "left";
  let yy = y;
  rows.forEach((r) => {
    ctx.save();
    const ax = o?.align === "center" ? x + w / 2 : o?.align === "right" ? x + w : x;
    ctx.translate(ax, yy); ctx.scale(sx, 1);
    ctx.fillStyle = r.colour; ctx.fillText(r.t, 0, 0);
    ctx.restore();
    yy += Math.round(s * lh);
  });
  return yy;
}

// One tall narrow line at (up to) a given size.
function hline(g: G, text: string, x: number, y: number, w: number, size: number, colour: string, o?: { align?: CanvasTextAlign; minSx?: number }): number {
  return hstack(g, [{ text, colour }], x, y, w, size * 1.02, size, { lh: 1, minSx: o?.minSx ?? 0.5, align: o?.align, min: 24 });
}

// A rough brush stroke or torn strip, in a single colour.
function brush(g: G, x: number, y: number, w: number, h: number, colour: string, seed = 3) {
  paper(g, [[x, y], [x + w, y - 2], [x + w, y + h], [x, y + h + 2]], [true, true, true, true], colour, { seed, amp: 2.5, fringe: colour, shadow: false });
}

function ornament(g: G, cx: number, y: number, w: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 16, y); ctx.moveTo(cx + 16, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, y - 8); ctx.lineTo(cx + 8, y); ctx.lineTo(cx, y + 8); ctx.lineTo(cx - 8, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function foot(g: G, y: number, colour: string, o?: { x?: number; w?: number; align?: CanvasTextAlign; size?: number }) {
  textBox(g, HU(g, g.t.footer), o?.x ?? 60, y, o?.w ?? 960, 44, { font: "body", weight: 700, max: o?.size ?? 32, min: 13, colour, align: o?.align ?? "center", lh: 1.1 });
}

// A photo on torn paper. Only the torn edges get a paper rim, the others run off the page. The photo is the draggable slot.
function photoPaper(g: G, x: number, y: number, w: number, h: number, torn: [boolean, boolean, boolean, boolean], seed: number, rim = 11) {
  const { ctx, c } = g;
  paper(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], torn, c.frame, { seed, amp: 7 });
  const x0 = torn[3] ? x + rim : x, x1 = torn[1] ? x + w - rim : x + w;
  const y0 = torn[0] ? y + rim : y, y1 = torn[2] ? y + h - rim : y + h;
  const ip: P[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  ctx.save();
  tornPath(ctx, ip, torn, seed + 5, 5, 0);
  ctx.clip();
  ctx.translate((x0 + x1) / 2, (y0 + y1) / 2);
  drawPhoto(g, x1 - x0, y1 - y0);
  ctx.restore();
  g.slots.push({ i: 0, x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: 0 });
}

// A straight photo with a plain coloured border.
function photoRect(g: G, x: number, y: number, w: number, h: number, border: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
  ctx.fillStyle = colour; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(x + border, y + border, w - border * 2, h - border * 2); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  drawPhoto(g, w - border * 2, h - border * 2);
  ctx.restore();
  g.slots.push({ i: 0, x: x + border, y: y + border, w: w - border * 2, h: h - border * 2, rot: 0 });
}

function archPath(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
}

function scan(g: G, x: number, y: number, w: number, h: number, alpha = 0.07) {
  const { ctx } = g;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let yy = y; yy < y + h; yy += 4) ctx.fillRect(x, yy, w, 2);
  ctx.restore();
}

function bubble(g: G, x: number, y: number, w: number, h: number, colour: string, tail: "bl" | "br") {
  const { ctx } = g;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 38); ctx.fill();
  ctx.beginPath();
  if (tail === "bl") { ctx.moveTo(x + 26, y + h - 8); ctx.lineTo(x + 8, y + h + 52); ctx.lineTo(x + 96, y + h - 8); }
  else { ctx.moveTo(x + w - 26, y + h - 8); ctx.lineTo(x + w - 8, y + h + 52); ctx.lineTo(x + w - 96, y + h - 8); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function label(g: G, cx: number, cy: number, w: number, h: number, rot: number, text: string) {
  g.ctx.save();
  tape(g, cx, cy - h / 2 - 2, w * 0.55, 24, rot * 0.5 - 3, "kraft");
  g.ctx.restore();
  const { c } = g;
  const tx = text;
  const sx = cx, sy = cy;
  g.ctx.save();
  g.ctx.translate(sx, sy); g.ctx.rotate((rot * Math.PI) / 180);
  g.ctx.shadowColor = "rgba(0,0,0,0.4)"; g.ctx.shadowBlur = 10; g.ctx.shadowOffsetY = 3;
  g.ctx.fillStyle = c.frame; g.ctx.fillRect(-w / 2, -h / 2, w, h);
  g.ctx.shadowColor = "transparent";
  textBox(g, tx, -w / 2 + 6, -h / 2 + 14, w - 12, h - 20, { font: "hand", max: 34, min: 14, weight: 700, colour: c.ink, align: "center", lh: 1 });
  g.ctx.restore();
}

// ---------------------------------------------------------------------------
// The ten layouts
// ---------------------------------------------------------------------------

const LAYOUTS: Record<HalId, (g: G) => void> = {
  friend(g) {
    const { c, t } = g;
    bg(g);
    photoPaper(g, 519, 50, 541, 1149, [false, false, true, true], 4);
    paper(g, [[0, 1198], [1080, 1190], [1080, 1350], [0, 1350]], [true, false, false, false], c.red, { seed: 2, fringe: shade(c.red, -0.3), shadow: false });
    hstack(g, [{ text: t.h, colour: c.light }], 52, 55, 400, 345, 90, { lh: 0.98 });
    brush(g, 41, 424, 478, 24, c.red, 3);
    hstack(g, [{ text: t.big, colour: c.red }], 52, 470, 440, 540, 200, { lh: 0.94, minSx: 0.55 });
    brush(g, 41, 1031, 478, 24, c.red, 5);
    textBox(g, t.small, 52, 1076, 440, 122, { font: "body", max: 36, min: 15, weight: 700, colour: shade(c.light, -0.12), lh: 1.2 });
    foot(g, 1266, c.light);
  },

  evidence(g) {
    const { ctx, c, t } = g;
    bg(g);
    photoPaper(g, 436, 67, 644, 1114, [false, false, false, false], 6);
    // shelf labels
    label(g, 613, 262, 146, 62, 8, t.l1);
    label(g, 613, 523, 146, 62, 0, t.l2);
    label(g, 602, 835, 167, 62, -13, t.l3);
    hstack(g, [{ text: t.h1, colour: c.light }, { text: t.h2, colour: c.red }, { text: t.h3, colour: c.light }], 42, 22, 380, 640, 175, { lh: 0.92 });
    // the card
    ctx.save();
    ctx.translate(249, 945); ctx.rotate((-1.6 * Math.PI) / 180); ctx.translate(-249, -945);
    paper(g, [[20, 640], [478, 640], [478, 1249], [20, 1249]], [true, false, true, true], c.tag, { seed: 11 });
    textBox(g, t.note, 52, 684, 380, 380, { font: "body", max: 44, min: 20, weight: 800, colour: c.red, lh: 1.14, upper: g.upper });
    brush(g, 44, 1072, 380, 3, rgba(c.ink, 0.35), 8);
    textBox(g, t.small, 52, 1096, 390, 110, { font: "body", max: 32, min: 14, weight: 600, colour: rgba(c.ink, 0.72), lh: 1.2 });
    ctx.restore();
    tape(g, 249, 640, 170, 40, 2, "kraft");
    // the evidence tag
    paper(g, [[934, 725], [1080, 725], [1080, 1181], [934, 1181]], [false, false, false, true], c.tag, { seed: 21 });
    ctx.save();
    ctx.translate(1018, 930); ctx.rotate(Math.PI / 2);
    textBox(g, HU(g, t.tag), -170, -34, 340, 70, { font: "head", max: 56, min: 24, colour: c.ink, align: "center", lh: 1 });
    ctx.restore();
    textBox(g, t.num, 944, 1088, 130, 60, { font: "head", max: 50, min: 20, colour: c.red, align: "center", lh: 1 });
    paperclip(g, 1040, 722, 0, "#9b968b");
    paper(g, [[0, 1232], [1080, 1226], [1080, 1350], [0, 1350]], [true, false, false, false], c.red, { seed: 4, fringe: shade(c.red, -0.3), shadow: false });
    foot(g, 1272, c.light);
  },

  ghost(g) {
    const { ctx, c, t } = g;
    bg(g);
    ctx.save(); ctx.strokeStyle = rgba(c.red, 0.75); ctx.lineWidth = 3; ctx.strokeRect(16, 16, 1048, 1318); ctx.restore();
    textBox(g, HU(g, t.top), 130, 38, 820, 44, { font: "head", max: 38, min: 16, colour: c.red, align: "center", lh: 1 });
    // the arch
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = c.frame; archPath(ctx, 519, 101, 520, 1165); ctx.fill();
    ctx.restore();
    ctx.save();
    archPath(ctx, 531, 113, 496, 1141); ctx.clip();
    ctx.translate(779, 683); drawPhoto(g, 496, 1141);
    ctx.restore();
    g.slots.push({ i: 0, x: 531, y: 113, w: 496, h: 1141, rot: 0 });
    ctx.save(); ctx.strokeStyle = rgba(c.red, 0.9); ctx.lineWidth = 3; archPath(ctx, 527, 109, 504, 1149); ctx.stroke(); ctx.restore();
    hstack(g, [{ text: t.h, colour: c.light }], 78, 119, 470, 540, 160, { lh: 0.95 });
    ornament(g, 290, 718, 380, c.red);
    paper(g, [[20, 742], [582, 742], [582, 1232], [20, 1232]], [true, false, true, true], c.tag, { seed: 14 });
    const L = (k: string, y: number, h: number) => textBox(g, t[k], 101, y, 440, h, { font: "body", max: 38, min: 16, weight: 700, colour: c.ink, lh: 1.16 });
    L("l1", 813, 118); L("l2", 957, 84); L("l3", 1066, 50); L("l4", 1133, 50);
    // the note
    ctx.save();
    ctx.translate(822, 1098); ctx.rotate((-4 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = c.frame; ctx.fillRect(-240, -118, 480, 236);
    ctx.shadowColor = "transparent";
    textBox(g, HU(g, t.note), -205, -80, 410, 170, { font: "body", max: 46, min: 18, weight: 800, colour: c.red, align: "center", lh: 1.14 });
    ctx.fillStyle = rgba(c.red, 0.85); ctx.fillRect(-115, -150, 230, 50);
    ctx.restore();
    foot(g, 1272, mute(g), { x: 40, w: 520, size: 30 });
  },

  crystal(g) {
    const { ctx, c, t } = g;
    bg(g);
    hline(g, t.h1, 68, 28, 880, 128, c.light);
    hline(g, t.h2, 62, 150, 950, 146, c.red);
    photoPaper(g, 436, 337, 644, 896, [false, false, false, true], 8);
    // crystal ball
    const cx = 768, cy = 950, r = 208;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    const grd = ctx.createRadialGradient(cx - 60, cy - 70, 20, cx, cy, r);
    grd.addColorStop(0, c.frame); grd.addColorStop(1, shade(c.frame, -0.1));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.strokeStyle = rgba(c.red, 0.55); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    textBox(g, HU(g, t.ball), cx - 120, 790, 240, 70, { font: "body", max: 27, min: 13, weight: 800, colour: c.red, align: "center", lh: 1.1 });
    ornament(g, cx, 868, 150, c.red);
    textBox(g, HU(g, t.answer), cx - 130, 892, 260, 230, { font: "head", max: 46, min: 18, colour: c.ink, align: "center", lh: 1.04 });
    // the card
    paper(g, [[20, 337], [498, 337], [498, 1047], [20, 1047]], [true, false, true, true], c.tag, { seed: 15 });
    paperclip(g, 249, 345, 0, "#9b968b");
    textBox(g, HU(g, t.label), 59, 419, 400, 40, { font: "body", max: 33, min: 14, weight: 800, colour: c.red, align: "center", lh: 1 });
    ornament(g, 259, 482, 380, c.red);
    textBox(g, HU(g, t.q), 77, 520, 365, 440, { font: "head", max: 96, min: 30, colour: c.ink, lh: 1.0 });
    brush(g, 62, 1066, 333, 20, c.red, 6);
    textBox(g, t.under, 80, 1104, 320, 80, { font: "body", max: 34, min: 16, weight: 700, colour: c.light, align: "center", lh: 1.14 });
    brush(g, 62, 1190, 333, 28, c.red, 9);
    paper(g, [[0, 1214], [1080, 1214], [1080, 1350], [0, 1350]], [false, false, false, false], c.green, { seed: 3, shadow: false, fringe: c.green });
    foot(g, 1284, mute(g), { size: 28 });
  },

  nosay(g) {
    const { ctx, c, t } = g;
    bg(g);
    photoPaper(g, 477, 50, 603, 1250, [false, false, false, true], 5);
    // folded red corner with the number
    ctx.save();
    ctx.fillStyle = shade(c.red, -0.12);
    ctx.beginPath(); ctx.moveTo(851, 0); ctx.lineTo(1080, 0); ctx.lineTo(1080, 220); ctx.closePath(); ctx.fill();
    ctx.restore();
    textBox(g, t.num, 958, 6, 100, 100, { font: "head", max: 92, min: 30, colour: "#0b0b0b", align: "center", lh: 1 });
    hstack(g, [{ text: t.h, colour: c.light }], 57, 53, 390, 160, 74, { lh: 1.0 });
    brush(g, 0, 219, 499, 18, c.red, 2);
    hstack(g, [{ text: t.pre, colour: shade(c.red, 0.25) }, { text: t.big, colour: c.red }], 55, 245, 430, 540, 150, { lh: 0.94, minSx: 0.5 });
    brush(g, 41, 792, 457, 18, c.red, 4);
    textBox(g, t.list, 57, 836, 400, 224, { font: "body", max: 38, min: 15, weight: 700, colour: shade(c.light, -0.05), lh: 1.2 });
    brush(g, 41, 1079, 353, 18, c.red, 7);
    textBox(g, HU(g, t.end), 56, 1127, 440, 92, { font: "head", max: 42, min: 18, colour: c.light, lh: 1.04 });
    brush(g, 41, 1232, 457, 12, c.red, 9);
    foot(g, 1270, mute(g), { x: 56, w: 416, align: "left", size: 26 });
  },

  camera(g) {
    const { ctx, c, t } = g;
    bg(g);
    photoRect(g, 415, 34, 645, 827, 9, c.frame);
    scan(g, 424, 43, 627, 809);
    // viewfinder
    ctx.save();
    ctx.strokeStyle = rgba(c.light, 0.9); ctx.lineWidth = 4; ctx.lineCap = "square";
    const corner = (x: number, y: number, dx: number, dy: number) => { ctx.beginPath(); ctx.moveTo(x + dx * 46, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 46); ctx.stroke(); };
    corner(452, 70, 1, 1); corner(1022, 70, -1, 1); corner(452, 800, 1, -1); corner(1022, 800, -1, -1);
    ctx.fillStyle = "#e23b3b"; ctx.beginPath(); ctx.arc(930, 102, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 6;
    textBox(g, HU(g, t.cam), 481, 88, 200, 36, { font: "body", max: 29, min: 14, weight: 600, colour: "#f3efe6", lh: 1 });
    textBox(g, HU(g, t.rec), 948, 88, 90, 36, { font: "body", max: 29, min: 14, weight: 600, colour: "#f3efe6", lh: 1 });
    textBox(g, t.time, 840, 770, 170, 44, { font: "body", max: 38, min: 16, weight: 600, colour: "#f3efe6", align: "right", lh: 1 });
    ctx.restore();
    hstack(g, [{ text: t.h, colour: c.light }, { text: t.hot, colour: c.red }], 59, 62, 350, 720, 200, { lh: 0.9, minSx: 0.5 });
    brush(g, 62, 800, 417, 26, c.red, 6);
    paper(g, [[0, 860], [1080, 852], [1080, 1266], [0, 1266]], [true, false, false, false], c.tag, { seed: 12, amp: 9 });
    hstack(g, [{ text: t.big, colour: c.ink }, { text: t.bigHot, colour: c.red }], 67, 892, 480, 340, 112, { lh: 1.0 });
    ctx.save(); ctx.fillStyle = rgba(c.ink, 0.7); ctx.fillRect(580, 911, 3, 304); ctx.restore();
    textBox(g, t.r1, 640, 914, 380, 44, { font: "body", max: 31, min: 14, weight: 700, colour: c.ink, lh: 1.1 });
    textBox(g, t.r2, 640, 981, 380, 44, { font: "body", max: 31, min: 14, weight: 700, colour: c.ink, lh: 1.1 });
    textBox(g, t.r3, 640, 1050, 380, 44, { font: "body", max: 31, min: 14, weight: 700, colour: c.ink, lh: 1.1 });
    textBox(g, t.r4, 640, 1117, 360, 76, { font: "body", max: 31, min: 14, weight: 700, colour: c.ink, lh: 1.1 });
    brush(g, 62, 1244, 957, 14, c.red, 3);
    foot(g, 1286, mute(g), { size: 30 });
  },

  mirror(g) {
    const { ctx, c, t } = g;
    bg(g);
    photoPaper(g, 415, 286, 665, 963, [false, false, false, true], 7);
    // calendar tab
    paper(g, [[831, 0], [1039, 0], [1039, 253], [831, 253]], [false, false, true, false], c.tag, { seed: 13 });
    ctx.save(); ctx.fillStyle = c.frame; ctx.fillRect(851, 34, 167, 169); ctx.restore();
    ctx.save(); ctx.translate(934, 118); ctx.rotate((4 * Math.PI) / 180);
    textBox(g, t.cal, -80, -78, 160, 150, { font: "head", max: 150, min: 40, colour: c.red, align: "center", lh: 1 });
    ctx.restore();
    hline(g, t.h1, 57, 20, 355, 168, c.light);
    hline(g, t.h2, 55, 150, 580, 236, c.red);
    hline(g, t.h3, 58, 378, 300, 160, c.light);
    hline(g, t.h4, 59, 530, 345, 128, c.light);
    // tag
    paper(g, [[20, 675], [437, 675], [437, 1013], [20, 1013]], [true, true, true, true], c.tag, { seed: 17 });
    textBox(g, HU(g, t.pre), 110, 712, 120, 40, { font: "head", max: 36, min: 14, colour: c.red, lh: 1 });
    textBox(g, HU(g, t.big), 106, 740, 300, 170, { font: "head", max: 180, min: 50, colour: c.red, lh: 1 });
    textBox(g, HU(g, t.tagline), 107, 912, 300, 90, { font: "body", max: 36, min: 14, weight: 800, colour: c.red, lh: 1.1 });
    paperclip(g, 46, 800, 0, "#9b968b");
    paper(g, [[20, 1029], [457, 1029], [457, 1249], [20, 1249]], [true, true, true, true], c.frame, { seed: 18 });
    paperclip(g, 64, 1030, 0, "#9b968b");
    textBox(g, t.small, 89, 1070, 330, 150, { font: "body", max: 27, min: 12, weight: 700, colour: c.ink, lh: 1.2 });
    brush(g, 41, 1252, 997, 12, c.red, 3);
    foot(g, 1290, c.light, { size: 29 });
  },

  vhs(g) {
    const { ctx, c, t } = g;
    bg(g);
    // tape label
    ctx.save(); ctx.strokeStyle = rgba(c.light, 0.9); ctx.lineWidth = 3; ctx.strokeRect(41, 34, 146, 60); ctx.restore();
    textBox(g, HU(g, t.vhs), 41, 40, 146, 50, { font: "head", max: 48, min: 18, colour: c.light, align: "center", lh: 1 });
    textBox(g, HU(g, t.hifi), 44, 100, 140, 30, { font: "body", max: 26, min: 12, weight: 700, colour: shade(c.light, -0.2), lh: 1 });
    paper(g, [[41, 140], [229, 140], [229, 276], [41, 276]], [false, false, false, false], c.tag, { seed: 5, shadow: true });
    ctx.save(); ctx.strokeStyle = shade(c.red, -0.1); ctx.lineWidth = 4; ctx.strokeRect(50, 149, 170, 118); ctx.restore();
    textBox(g, HU(g, t.genre), 50, 160, 170, 50, { font: "head", max: 34, min: 16, colour: c.red, align: "center", lh: 1 });
    textBox(g, HU(g, t.tape), 50, 214, 170, 46, { font: "head", max: 40, min: 16, colour: c.ink, align: "center", lh: 1 });
    textBox(g, HU(g, t.title), 332, 47, 665, 44, { font: "head", max: 37, min: 16, colour: c.light, align: "center", lh: 1 });
    brush(g, 332, 101, 665, 14, c.red, 3);
    photoRect(g, 456, 117, 604, 1098, 12, shade(c.red, -0.15));
    scan(g, 468, 129, 580, 1074, 0.08);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 8;
    textBox(g, t.play, 505, 185, 200, 36, { font: "body", max: 28, min: 14, weight: 600, colour: "#ffffff", lh: 1 });
    ctx.restore();
    textBox(g, HU(g, t.pre), 52, 300, 200, 60, { font: "head", max: 56, min: 20, colour: c.light, lh: 1 });
    hline(g, t.w1, 46, 350, 370, 220, c.light);
    hline(g, t.w2, 46, 525, 380, 220, c.red);
    brush(g, 41, 782, 416, 14, c.red, 6);
    textBox(g, t.body, 50, 816, 380, 150, { font: "body", max: 33, min: 14, weight: 700, colour: c.light, lh: 1.2 });
    // red circle sticker
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.fillStyle = c.red; ctx.beginPath(); ctx.arc(238, 1113, 135, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.strokeStyle = rgba(c.light, 0.3); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(238, 1113, 122, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    textBox(g, HU(g, t.badge), 140, 1050, 196, 130, { font: "body", max: 31, min: 12, weight: 800, colour: c.light, align: "center", lh: 1.12 });
    brush(g, 0, 1248, 1080, 16, c.red, 5);
    brush(g, 0, 1318, 1080, 16, c.red, 8);
    foot(g, 1274, c.light, { size: 33 });
  },

  receipt(g) {
    const { ctx, c, t } = g;
    bg(g);
    photoPaper(g, 456, 34, 624, 844, [false, false, false, true], 9);
    hstack(g, [{ text: t.h, colour: c.light }, { text: t.hot, colour: c.red }], 39, 12, 420, 620, 175, { lh: 0.9, minSx: 0.5 });
    // red box
    paper(g, [[498, 877], [1080, 877], [1080, 1282], [498, 1282]], [true, false, true, true], c.red, { seed: 20, fringe: shade(c.red, -0.35) });
    textBox(g, HU(g, t.s1), 604, 920, 440, 140, { font: "head", max: 64, min: 20, colour: c.light, lh: 1.04 });
    textBox(g, HU(g, t.s2), 620, 1062, 400, 76, { font: "head", max: 64, min: 20, colour: "#0d0d0d", lh: 1.04 });
    brush(g, 620, 1150, 396, 4, rgba(c.light, 0.7), 4);
    textBox(g, HU(g, t.s3), 600, 1178, 440, 46, { font: "body", max: 34, min: 13, weight: 800, colour: "#0d0d0d", align: "center", lh: 1 });
    // the receipt, zigzag top and bottom
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    ctx.fillStyle = c.frame;
    ctx.beginPath(); ctx.moveTo(20, 573);
    for (let x = 20; x < 580; x += 14) { ctx.lineTo(x + 7, 565); ctx.lineTo(x + 14, 573); }
    ctx.lineTo(582, 1266);
    for (let x = 582; x > 22; x -= 14) { ctx.lineTo(x - 7, 1274); ctx.lineTo(x - 14, 1266); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(82, 652); ctx.rotate((-4 * Math.PI) / 180);
    const ink = rgba(c.ink, 0.86);
    const rows: [string, string, number][] = [[t.r1, t.p1, 10], [t.r2, t.p2, 88], [t.r3, t.p3, 165], [t.r4, t.p4, 241]];
    rows.forEach(([a, b, y]) => {
      textBox(g, a, 0, y, 290, 36, { font: "body", max: 26, min: 12, weight: 500, colour: ink, lh: 1 });
      textBox(g, b, 300, y - 2, 90, 36, { font: "body", max: 26, min: 12, weight: 500, colour: ink, align: "right", lh: 1 });
    });
    // circle round the last row, with an arrow
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(150, 257, 168, 28, -0.02, 0.25, Math.PI * 2 + 0.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(330, 296); ctx.quadraticCurveTo(375, 292, 392, 266); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(380, 262); ctx.lineTo(393, 264); ctx.lineTo(392, 278); ctx.stroke();
    ctx.setLineDash([9, 8]); ctx.strokeStyle = rgba(c.ink, 0.4); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, 340); ctx.lineTo(400, 340); ctx.stroke();
    ctx.setLineDash([]);
    textBox(g, t.tl, 0, 372, 200, 40, { font: "body", max: 30, min: 14, weight: 800, colour: ink, lh: 1 });
    textBox(g, t.tp, 230, 372, 160, 40, { font: "body", max: 30, min: 14, weight: 800, colour: ink, align: "right", lh: 1 });
    ctx.restore();
    // barcode
    const r = rand(7);
    ctx.save(); ctx.fillStyle = rgba(c.ink, 0.9);
    for (let x = 103; x < 478;) { const w = 2 + Math.floor(r() * 5); ctx.fillRect(x, 1100, w, 82); x += w + 2 + Math.floor(r() * 4); }
    ctx.restore();
    foot(g, 1289, mute(g), { size: 25 });
  },

  chat(g) {
    const { c, t } = g;
    bg(g);
    hline(g, t.h1, 71, 18, 940, 150, c.red);
    hline(g, t.h2, 71, 158, 940, 136, c.light);
    brush(g, 0, 303, 1080, 30, c.red, 4);
    photoPaper(g, 477, 320, 603, 812, [false, false, true, true], 10);
    bubble(g, 20, 371, 458, 406, c.frame, "bl");
    textBox(g, HU(g, t.msg), 78, 404, 360, 340, { font: "head", max: 54, min: 22, colour: c.ink, lh: 1.04 });
    bubble(g, 41, 826, 457, 221, c.red, "br");
    if (t.reply?.trim()) textBox(g, HU(g, t.reply), 80, 862, 380, 150, { font: "head", max: 50, min: 20, colour: c.light, lh: 1.04 });
    paper(g, [[20, 1164], [1060, 1164], [1060, 1266], [20, 1266]], [true, false, true, false], c.tag, { seed: 31 });
    textBox(g, t.cta, 60, 1190, 960, 56, { font: "body", max: 46, min: 18, weight: 700, colour: c.red, align: "center", lh: 1 });
    foot(g, 1286, mute(g), { size: 30 });
  },
};

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export type HalDrawInput = {
  design: HalId;
  text: Record<string, string>; // already resolved, no tokens left
  palette: Palette;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  mono: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  logo?: HTMLImageElement | null;
  logoPos?: LogoPos;
};

export function resolveHalText(design: HalDesign, text: Record<string, string>, fill: Fill): Record<string, string> {
  return Object.fromEntries(design.fields.map((fd) => [fd.key, fillTokens(text[fd.key] ?? design.defaults[fd.key] ?? "", fill)]));
}

export function drawHalloween(ctx: Ctx, d: HalDrawInput): Slot[] {
  const g: G = {
    ctx, t: d.text, c: d.palette, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: d.upper, photo: d.photo, focus: d.focus, slots: [], mono: d.mono,
  };
  ctx.save();
  ctx.textBaseline = "top";
  LAYOUTS[d.design](g);
  if (d.logo && d.logoPos && d.logoPos !== "off") drawLogo(g, d.logo, d.logoPos);
  ctx.restore();
  return g.slots;
}

void placeholder;
