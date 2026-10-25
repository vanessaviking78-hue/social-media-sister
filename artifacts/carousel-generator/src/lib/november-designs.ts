// November Posts: ten single image November designs, drawn straight onto a 1080 x 1350 canvas so the
// preview, the download and the scheduled image are always identical. No React in here.
// Every colour comes from the Palette, so every colour can be changed per client.
// The drawing kit (torn paper, polaroids, tape, notebooks) is shared with the Xmas Posts tool.

import { fillTokens, type Fill } from "./basic-covers";
import {
  XW, XH, HU, bg, checkbox, drawLogo, headWeightFor, paper, polaroid, rgba, rule, shade, star, sticky, tape, textBox, heart,
  type Ctx, type Focus, type G, type LogoPos, type Palette, type Slot,
} from "./xmas-designs";

export { XW, XH };

// navy = green, rust = red, sage = tag. Same keys as the Xmas palette so the colour boxes work the same way.
export const NOVEMBER_PALETTE: Palette = {
  paper: "#ece7dc",
  green: "#0f2530",
  red: "#af4c2f",
  tag: "#a8b5ad",
  frame: "#f7f4ec",
  light: "#f1f0ec",
  ink: "#0f2530",
};

export const NOVEMBER_PALETTE_LABELS: { key: keyof Palette; label: string }[] = [
  { key: "paper", label: "Paper" },
  { key: "green", label: "Navy" },
  { key: "red", label: "Rust" },
  { key: "tag", label: "Sage" },
  { key: "frame", label: "Photo frames and cards" },
  { key: "ink", label: "Text" },
  { key: "light", label: "Light text" },
];

export type NovId = "chat" | "explosive" | "checkin" | "wishlist" | "status" | "notes" | "seven" | "y1992" | "war" | "closer";

export type FieldDef = { key: string; label: string; rows?: number };

export type NovDesign = {
  id: NovId;
  name: string;
  idea: string;
  fields: FieldDef[];
  defaults: Record<string, string>;
};

const f = (key: string, label: string, rows = 1): FieldDef => ({ key, label, rows });

// In the order they go out.
export const NOVEMBER_DESIGNS: NovDesign[] = [
  {
    id: "chat", name: "November has entered the chat",
    idea: "a funny, relatable British November post: dark at 4pm, central heating on, SPF suddenly treated like a summer hobby and skin wondering what happened, ending on welcome to British winter",
    fields: [f("headline", "Headline", 3), f("i1", "Line 1"), f("i2", "Line 2", 2), f("i3", "Line 3", 3), f("i4", "Line 4", 3), f("welcome", "Small line"), f("hot", "Big line (in rust)", 2)],
    defaults: {
      headline: "November has entered the chat", i1: "dark at 4pm.", i2: "central\nheating on.", i3: "SPF suddenly being treated like a summer hobby.",
      i4: "Skin wondering what the hell happened.", welcome: "welcome to", hot: "british\nwinter.",
    },
  },
  {
    id: "explosive", name: "Things more explosive than Bonfire Night",
    idea: "a funny list of things more explosive than Bonfire Night, the front camera, telling your practitioner TikTok said, five new actives at once and the family group chat about presents",
    fields: [f("h1", "Headline line 1"), f("h2", "Headline line 2 (rust)"), f("h3", "Headline line 3"), f("tag", "Little label"),
      f("i1", "Number 1", 2), f("i2", "Number 2", 2), f("i3", "Number 3", 3), f("i4", "Number 4", 4), f("footer", "Banner words")],
    defaults: {
      h1: "things more", h2: "explosive", h3: "than bonfire night.", tag: "practitioner",
      i1: "opening the front camera unexpectedly", i2: "telling your practitioner 'TikTok said...'", i3: "putting five new actives on your face at once",
      i4: "the family group chat when somebody says 'we're not doing presents this year'", footer: "stay safe out there.",
    },
  },
  {
    id: "checkin", name: "Your winter skin check-in",
    idea: "a gentle winter skin check-in of five honest questions, does the routine still feel comfortable, is SPF being used, too many products at once, one product to fix everything, and would a consultation save a panic purchase, ending that boring consistency is deeply underrated",
    fields: [f("pre", "Small word"), f("headline", "Headline", 2), f("hot", "Last word (rust)"), f("q1", "Question 1", 2), f("q2", "Question 2", 2), f("q3", "Question 3", 3), f("q4", "Question 4", 3), f("q5", "Question 5", 3), f("footer", "Bottom words", 3)],
    defaults: {
      pre: "Your", headline: "Winter\nSkin", hot: "Check-in.",
      q1: "Does my routine\nstill feel comfortable?", q2: "Am I actually\nusing spf?", q3: "Have I introduced\ntoo many things\nat once?",
      q4: "Am I expecting\none product to\nfix everything?", q5: "Would a professional skin consultation\nsave me another\npanic purchase?",
      footer: "Boring\nconsistency is\ndeeply underrated.",
    },
  },
  {
    id: "wishlist", name: "My pre-Christmas wish list",
    idea: "a clinician's honest and funny pre-Christmas wish list about the patients and moments they love, finishing that they will take the coffee",
    fields: [f("headline", "Headline", 3), f("hot", "Last words (rust)"), f("i1", "Wish 1", 2), f("i2", "Wish 2", 3), f("i3", "Wish 3"), f("i4", "Wish 4", 2), f("i5", "Wish 5", 2), f("footA", "Bottom line 1"), f("footB", "Bottom line 2 (rust)")],
    defaults: {
      headline: "My\npre-\nchristmas", hot: "wish list.",
      i1: "patients who book with\nenough time", i2: "people who tell me about\nthe Christmas party BEFORE treatment", i3: "realistic expectations",
      i4: "SPF still being used\nin November", i5: "one hot coffee consumed\nwhile actually hot",
      footA: "honestly,", footB: "I'll take the coffee.",
    },
  },
  {
    id: "status", name: "November status report",
    idea: "a funny November status report: Christmas shopping started in theory, skin routine mostly behaving, central heating aggressive, motivation after 4pm missing, magnifying mirror still not invited, practitioner needing a cup of tea, ending December please approach slowly",
    fields: [f("report", "Small top line"), f("headline", "Headline", 3), f("l1", "Row 1 label"), f("v1", "Row 1 answer"), f("l2", "Row 2 label"), f("v2", "Row 2 answer"), f("l3", "Row 3 label"), f("v3", "Row 3 answer"),
      f("l4", "Row 4 label"), f("v4", "Row 4 answer"), f("l5", "Row 5 label"), f("v5", "Row 5 answer"), f("l6", "Row 6 label"), f("v6", "Row 6 answer"),
      f("sticker", "Little sticker", 2), f("ticket", "Ticket words", 2), f("stub", "Ticket stub", 4)],
    defaults: {
      report: "Report No. 11/10", headline: "November\nStatus\nReport",
      l1: "Christmas shopping:", v1: "Started in theory", l2: "Skin routine:", v2: "Mostly behaving", l3: "Central heating:", v3: "Aggressive",
      l4: "Motivation after 4pm:", v4: "Missing", l5: "Magnifying mirror:", v5: "Still not invited", l6: "Practitioner:", v6: "Needs a cup of tea",
      sticker: "End of Month\nCheck-in", ticket: "December,\nPlease Approach Slowly.", stub: "Handle\nwith\nCareful\nOptimism",
    },
  },
  {
    id: "notes", name: "Your skin has not suddenly given up",
    idea: "a reassuring consultation note that your skin has not given up, it is November, listing the real causes, colder air, central heating, temperature changes, inconsistent routines and less daylight, and asking people to work out what their skin needs before buying seven new products",
    fields: [f("label", "Little label"), f("headline", "Headline", 4), f("hot", "Second line (rust)"), f("i1", "Cause 1"), f("i2", "Cause 2"), f("i3", "Cause 3", 2), f("i4", "Cause 4", 3), f("i5", "Cause 5", 2), f("bot", "Bottom words", 3), f("botHot", "Bottom last line (rust)")],
    defaults: {
      label: "Consultation Notes", headline: "Your skin has not suddenly given up.", hot: "It's November.",
      i1: "colder air", i2: "central heating", i3: "temperature changes", i4: "routines becoming inconsistent", i5: "less daylight and\nmore sofa",
      bot: "Before you buy seven new products,\nlet's work out what", botHot: "Your skin actually needs.",
    },
  },
  {
    id: "seven", name: "Christmas is seven weeks away",
    idea: "a funny reality check that Christmas is only seven weeks away, so if anyone is thinking about treatment for the festive season this is the sensible planning stage, not the December panic stage",
    fields: [f("calMonth", "Calendar month"), f("calDay", "Calendar day"), f("big", "Big number"), f("headline", "Headline"), f("sub", "Grey line", 2), f("body", "Words", 5), f("cta", "Big bottom words", 3), f("small", "Small print", 2)],
    defaults: {
      calMonth: "Nov", calDay: "03", big: "7", headline: "Christmas.", sub: "Yes. Seven. Don't shoot the messenger.",
      body: "If you've been thinking about treatment for the festive season, this is the sensible-planning stage, not the December-panic stage.",
      cta: "Consult early. Plan properly.", small: "treatment suitability, timing and recovery vary.",
    },
  },
  {
    id: "y1992", name: "November, 1992. Somehow we survived",
    idea: "a nostalgic and funny look back at November 1992, the Bonfire Night coat that smelled of smoke, gloves attached to your sleeves, your mum shouting about catching your death and absolutely nobody discussing their skin barrier",
    fields: [f("headline", "Headline", 2), f("a", "Bottom line 1"), f("b", "Bottom line 2 (rust)"), f("i1", "Memory 1", 4), f("i2", "Memory 2", 2), f("i3", "Memory 3", 2), f("i3b", "Memory 3 second part (rust)", 2), f("i4", "Memory 4", 4)],
    defaults: {
      headline: "November,\n1992.", a: "somehow", b: "we survived.",
      i1: "Bonfire Night\ncoat that\nsmelled of smoke\nfor three days", i2: "gloves attached\nto your sleeves", i3: "your mum\nshouting", i3b: "'You'll catch your death'",
      i4: "absolutely\nnobody\ndiscussing their\nskin barrier",
    },
  },
  {
    id: "war", name: "Central heating has declared war on your face",
    idea: "a funny post about central heating declaring war on your face, freezing outside, tropical conservatory inside, and skin asking everybody to please pick a temperature, ending that winter skin often needs a routine review, not a panic shop",
    fields: [f("headline", "Headline lines", 4), f("hot", "Last lines (rust)", 2), f("o1", "Outside"), f("o2", "Outside answer"), f("n1", "Inside"), f("n2", "Inside answer"), f("s1", "Your skin"), f("s2", "Your skin answer", 3), f("footer", "Bottom words", 3)],
    defaults: {
      headline: "central\nheating\nhas declared", hot: "War on\nyour face.",
      o1: "Outside:", o2: "freezing.", n1: "Inside:", n2: "tropical conservatory.", s1: "Your skin:", s2: "could everybody\nplease pick a\ntemperature?",
      footer: "Winter skin often needs a routine review,\nnot a panic shop.",
    },
  },
  {
    id: "closer", name: "Christmas is getting closer",
    idea: "a funny reminder that Christmas is getting closer and a face is not an Amazon Prime order, treatment Thursday and party Saturday with the request to have it all settled by then, because biology does not offer next-day delivery",
    fields: [f("month", "Header left"), f("postNo", "Post number"), f("ofNo", "Out of"), f("headline", "Headline", 3), f("hot", "Rust line", 3), f("a", "Line 1"), f("b", "Line 2"), f("c", "Line 3", 2), f("end", "Bold line", 2), f("small", "Small print", 4), f("stampPost", "Corner label"), f("stampSub", "Corner words", 2)],
    defaults: {
      month: "November", postNo: "06", ofNo: "06", headline: "Christmas is getting closer.", hot: "Your face is not an Amazon Prime order.",
      a: "Treatment Thursday.", b: "Party Saturday.", c: "'Can you make it all\nsettled by then?'", end: "Biology does not\noffer next-day delivery.",
      small: "discuss treatment timing and expected recovery with your practitioner.", stampPost: "Post", stampSub: "Countdown\nto Christmas",
    },
  },
];

export const NOVEMBER_BY_ID: Record<NovId, NovDesign> = Object.fromEntries(NOVEMBER_DESIGNS.map((d) => [d.id, d])) as Record<NovId, NovDesign>;

// ---------------------------------------------------------------------------
// Small helpers for this set
// ---------------------------------------------------------------------------

export const wrapLine = (ctx: Ctx, text: string, maxW: number) => {
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
};

// A stack of headline lines, one size for all of them, each line in its own colour. Lines stay as typed.
export function stack(g: G, items: { text: string; colour: string }[], x: number, y: number, w: number, max: number, min: number, lh = 0.98, o?: { align?: CanvasTextAlign; hMax?: number }): number {
  const { ctx } = g;
  const rows: { t: string; colour: string }[] = [];
  items.forEach((it) => (it.text ?? "").split("\n").filter((s) => s.length).forEach((t) => rows.push({ t: HU(g, t), colour: it.colour })));
  let s = max;
  for (; s >= min; s -= 2) {
    ctx.font = `${g.headW} ${s}px ${g.head}`;
    if (rows.every((r) => ctx.measureText(r.t).width <= w) && (!o?.hMax || rows.length * s * lh <= o.hMax)) break;
  }
  s = Math.max(s, min);
  ctx.font = `${g.headW} ${s}px ${g.head}`;
  ctx.textBaseline = "top";
  ctx.textAlign = o?.align ?? "left";
  const ax = o?.align === "center" ? x + w / 2 : x;
  let yy = y;
  rows.forEach((r) => { ctx.fillStyle = r.colour; ctx.fillText(r.t, ax, yy); yy += Math.round(s * lh); });
  return yy;
}

export function dash(g: G, x1: number, x2: number, y: number, colour: string, lw = 2.5, alpha = 0.5) {
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = lw; ctx.setLineDash([10, 9]); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

export function squiggle(g: G, x: number, y: number, w: number, colour: string, lw = 4) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= w; i += 4) {
    const yy = y + Math.sin((i / w) * Math.PI * 5) * 5;
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x + i, yy);
  }
  ctx.stroke();
  ctx.restore();
}

function tick(g: G, x: number, y: number, s: number, colour: string, filled = false) {
  const { ctx } = g;
  ctx.save();
  ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = colour;
  ctx.strokeRect(x, y, s, s);
  if (filled) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.55); ctx.lineTo(x + s * 0.45, y + s * 0.78); ctx.lineTo(x + s * 0.9, y + s * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

export function vbar(g: G, x: number, y: number, w: number, h: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// two lines, the first in navy and the second in a softer grey-sage
function pair(g: G, a: string, b: string, x: number, y: number, w: number, size: number, colA: string, colB: string) {
  const { ctx } = g;
  ctx.font = `700 ${size}px ${g.body}`;
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  const la = wrapLine(ctx, a, w), lb = wrapLine(ctx, b, w);
  const lh = Math.round(size * 1.2);
  let yy = y;
  ctx.fillStyle = colA; la.forEach((l) => { ctx.fillText(l, x, yy); yy += lh; });
  ctx.fillStyle = colB; lb.forEach((l) => { ctx.fillText(l, x, yy); yy += lh; });
}

const grey = (g: G) => shade(g.c.tag, -0.38);

// ---------------------------------------------------------------------------
// The ten layouts
// ---------------------------------------------------------------------------

const LAYOUTS: Record<NovId, (g: G) => void> = {
  chat(g) {
    const { ctx, c, t } = g;
    bg(g);
    // navy panel with four short lines
    paper(g, [[0, 472], [440, 472], [455, 1040], [0, 1048]], [false, true, true, false], c.green, { seed: 3 });
    polaroid(g, 768, 912, 650, 880, 2, { pad: 26, bottom: 70 });
    tape(g, 738, 466, 130, 46, -4, "kraft");
    // bottom left card
    paper(g, [[0, 1029], [520, 1040], [540, 1350], [0, 1350]], [true, true, false, false], c.frame, { seed: 9 });
    textBox(g, HU(g, t.headline), 56, 24, 970, 430, { font: "head", max: 150, min: 60, colour: c.green, lh: 0.98 });
    const L = (k: string, y: number, h: number) => textBox(g, t[k], 87, y, 250, h, { font: "body", max: 32, min: 17, weight: 700, colour: c.light, lh: 1.12 });
    L("i1", 540, 42); squiggle(g, 83, 598, 105, c.red);
    L("i2", 615, 74); squiggle(g, 83, 700, 105, c.red);
    L("i3", 730, 135); squiggle(g, 83, 886, 105, c.red);
    L("i4", 906, 112);
    textBox(g, HU(g, t.welcome), 84, 1062, 420, 72, { font: "head", max: 67, min: 30, colour: c.green });
    textBox(g, HU(g, t.hot), 84, 1124, 440, 200, { font: "head", max: 96, min: 44, colour: c.red, lh: 1.0 });
    void ctx;
  },

  explosive(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[20, 14], [1038, 10], [1038, 52], [20, 54]], [true, true, true, true], c.tag, { seed: 5, shadow: false, amp: 3 });
    stack(g, [{ text: t.h1, colour: c.ink }, { text: t.h2, colour: c.red }, { text: t.h3, colour: c.ink }], 44, 30, 980, 112, 50, 0.88);
    polaroid(g, 291, 770, 560, 820, -1, { pad: 24, bottom: 48 });
    tape(g, 70, 440, 170, 46, -72, "kraft");
    sticky(g, 374, 953, 140, 54, -3, c.frame, (cx) => {
      cx.fillStyle = c.ink; cx.font = `600 18px ${g.body}`; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(t.tag, 0, 2, 124);
    });
    paper(g, [[560, 372], [1080, 372], [1080, 1166], [560, 1160]], [true, false, false, true], c.frame, { seed: 8 });
    const rows: [string, number, number, number][] = [["i1", 419, 449, 100], ["i2", 585, 611, 100], ["i3", 751, 775, 130], ["i4", 933, 955, 165]];
    rows.forEach(([k, ny, ty, h], i) => {
      ctx.fillStyle = c.red; ctx.font = `${g.headW} 54px ${g.head}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`0${i + 1}`, 592, ny + 6);
      textBox(g, t[k], 686, ty, 335, h, { font: "body", max: 28, min: 17, weight: 700, colour: c.ink, lh: 1.18 });
    });
    [556, 725, 911].forEach((y) => dash(g, 581, 997, y, c.ink, 2.5, 0.35));
    paper(g, [[83, 1181], [977, 1176], [977, 1334], [83, 1338]], [true, false, true, false], c.tag, { seed: 12 });
    textBox(g, HU(g, t.footer), 90, 1196, 880, 122, { font: "head", max: 94, min: 44, colour: c.ink, align: "center" });
  },

  checkin(g) {
    const { ctx, c, t } = g;
    bg(g);
    ctx.fillStyle = c.tag; ctx.fillRect(0, 0, 63, 1080);
    // navy band along the bottom
    paper(g, [[0, 1063], [1080, 1050], [1080, 1350], [0, 1350]], [true, false, false, false], c.green, { seed: 6 });
    vbar(g, 41, 1113, 21, 187, c.red);
    textBox(g, HU(g, t.pre), 78, 108, 300, 48, { font: "head", max: 42, min: 20, colour: c.red });
    stack(g, [{ text: t.headline, colour: c.ink }], 76, 148, 380, 80, 40, 0.97);
    textBox(g, HU(g, t.hot), 76, 324, 430, 90, { font: "head", max: 82, min: 36, colour: c.red });
    const rows: [string, number, number][] = [["q1", 422, 80], ["q2", 523, 80], ["q3", 624, 125], ["q4", 759, 112], ["q5", 877, 150]];
    rows.forEach(([k, y, h]) => {
      tick(g, 72, y + 12, 34, c.red, true);
      textBox(g, t[k], 143, y + 8, 385, h - 10, { font: "body", max: 27, min: 15, weight: 700, colour: c.ink, lh: 1.2 });
    });
    [506, 607, 742, 860].forEach((y) => dash(g, 62, 520, y, c.ink, 2.5, 0.3));
    textBox(g, HU(g, t.footer), 84, 1122, 520, 190, { font: "head", max: 52, min: 26, colour: c.tag, lh: 1.04 });
    polaroid(g, 800, 616, 560, 1100, 1.5, { pad: 24, bottom: 60, tapeAt: "kraft" });
  },

  wishlist(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [188, 0], [150, 118], [0, 203]], [false, true, true, false], c.tag, { seed: 9 });
    paper(g, [[519, 34], [1080, 34], [1080, 1283], [519, 1283]], [true, false, false, true], c.frame, { seed: 4 });
    polaroid(g, 810, 668, 520, 1160, 1, { pad: 22, bottom: 60 });
    tape(g, 492, 118, 190, 50, -28, "kraft");
    stack(g, [{ text: t.headline, colour: c.ink }, { text: t.hot, colour: c.red }], 50, 148, 440, 92, 40, 0.92, { hMax: 400 });
    const rows: [string, number, number][] = [["i1", 533, 76], ["i2", 628, 100], ["i3", 758, 60], ["i4", 840, 76], ["i5", 944, 76]];
    rows.forEach(([k, y, h]) => {
      tick(g, 44, y + 10, 38, c.red, true);
      textBox(g, t[k], 118, y + 4, 385, h, { font: "body", max: 27, min: 16, weight: 700, colour: c.ink, lh: 1.18 });
    });
    [614, 746, 826, 926].forEach((y) => dash(g, 41, 498, y, c.ink, 2.5, 0.3));
    paper(g, [[0, 1052], [686, 1046], [686, 1350], [0, 1350]], [true, true, false, false], c.frame, { seed: 15 });
    textBox(g, HU(g, t.footA), 53, 1150, 600, 80, { font: "head", max: 62, min: 30, colour: c.green });
    textBox(g, HU(g, t.footB), 50, 1216, 620, 80, { font: "head", max: 62, min: 30, colour: c.red });
    void ctx;
  },

  status(g) {
    const { ctx, c, t } = g;
    bg(g);
    textBox(g, t.report, 44, 48, 430, 30, { font: "script", max: 20, min: 12, weight: 600, colour: c.ink });
    dash(g, 41, 519, 90, c.ink, 2.5, 0.35);
    textBox(g, t.headline, 39, 112, 440, 250, { font: "script", max: 74, min: 38, weight: 600, colour: c.ink, lh: 0.98 });
    const ys: [number, number, number][] = [[412, 405, 439], [521, 512, 544], [626, 617, 651], [736, 722, 755], [845, 833, 866], [954, 943, 975]];
    ys.forEach(([ny, ly, vy], i) => {
      ctx.fillStyle = shade(c.tag, -0.12); ctx.font = `600 36px ${SERIF}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`0${i + 1}`, 50, ny);
      textBox(g, t[`l${i + 1}`], 150, ly, 370, 32, { font: "script", max: 23, min: 14, weight: 500, colour: c.ink });
      textBox(g, t[`v${i + 1}`], 150, vy, 370, 32, { font: "script", max: 23, min: 14, weight: 500, colour: c.red });
    });
    [371, 472, 573, 691, 792, 911].forEach((y) => dash(g, 41, 519, y, c.ink, 2.5, 0.3));
    ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = c.ink; ctx.lineWidth = 2.5; ctx.setLineDash([10, 9]);
    ctx.beginPath(); ctx.moveTo(135, 371); ctx.lineTo(135, 1031); ctx.stroke(); ctx.restore();
    polaroid(g, 780, 565, 560, 1010, 2, { pad: 24, bottom: 60 });
    tape(g, 810, 86, 210, 50, -3, "kraft");
    sticky(g, 478, 340, 209, 122, -12, c.frame, () => {
      textBox(g, t.sticker, -95, -44, 190, 88, { font: "script", max: 25, min: 14, weight: 700, colour: c.red, align: "center", lh: 1.15 });
    });
    // the ticket along the bottom
    paper(g, [[41, 1046], [1038, 1046], [1038, 1317], [41, 1317]], [false, false, false, false], c.frame, { seed: 20 });
    ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(862, 1046); ctx.lineTo(862, 1317); ctx.stroke(); ctx.restore();
    textBox(g, HU(g, t.ticket), 81, 1084, 760, 214, { font: "head", max: 90, min: 40, colour: c.red, lh: 1.04 });
    rule(g, 892, 1018, 1100, c.red, 4);
    textBox(g, t.stub, 892, 1114, 126, 116, { font: "body", max: 25, min: 12, weight: 700, colour: c.red, align: "center", lh: 1.08 });
    rule(g, 892, 1018, 1238, c.red, 4);
    rule(g, 892, 1018, 1262, c.red, 2);
    rule(g, 892, 1018, 1282, c.red, 6);
  },

  notes(g) {
    const { ctx, c, t } = g;
    bg(g);
    paper(g, [[0, 0], [374, 0], [374, 1350], [0, 1350]], [false, true, false, false], c.tag, { seed: 2, shadow: false });
    polaroid(g, 285, 625, 580, 1130, -1, { pad: 24, bottom: 50 });
    tape(g, 84, 136, 190, 46, -80, "kraft");
    paper(g, [[643, 34], [1060, 34], [1060, 102], [643, 102]], [true, false, true, false], c.tag, { seed: 31 });
    textBox(g, t.label, 650, 52, 404, 40, { font: "body", max: 29, min: 15, weight: 700, colour: c.ink, align: "center" });
    textBox(g, t.headline, 580, 136, 450, 330, { font: "script", max: 86, min: 38, weight: 600, colour: c.ink, lh: 0.96 });
    dash(g, 581, 997, 474, c.ink, 2.5, 0.35);
    textBox(g, t.hot, 586, 490, 450, 60, { font: "script", max: 46, min: 24, weight: 600, colour: c.red });
    paper(g, [[560, 540], [1038, 540], [1038, 962], [560, 962]], [false, true, true, false], c.frame, { seed: 7 });
    vbar(g, 560, 573, 22, 389, c.tag);
    const rows: [string, number, number][] = [["i1", 575, 44], ["i2", 641, 44], ["i3", 709, 44], ["i4", 765, 78], ["i5", 862, 78]];
    rows.forEach(([k, y, h]) => {
      tick(g, 604, y + 4, 34, c.red, true);
      textBox(g, t[k], 660, y, 370, h, { font: "body", max: 30, min: 16, weight: 700, colour: c.ink, lh: 1.18 });
    });
    paper(g, [[352, 994], [1038, 990], [1038, 1333], [352, 1333]], [true, false, false, true], c.frame, { seed: 41 });
    textBox(g, t.bot, 402, 1052, 470, 150, { font: "script", max: 42, min: 22, weight: 600, colour: c.ink, lh: 1.14 });
    textBox(g, t.botHot, 401, 1210, 600, 56, { font: "script", max: 42, min: 22, weight: 600, colour: c.red });
    sticky(g, 986, 1040, 160, 130, 4, c.tag, () => { heart(g, 0, 6, 70, c.red, false, 5); }, true);
    void ctx;
  },

  seven(g) {
    const { ctx, c, t } = g;
    bg(g);
    polaroid(g, 780, 632, 600, 1220, 1, { pad: 22, bottom: 70 });
    // calendar sticker
    paper(g, [[0, 0], [190, 0], [190, 150], [0, 222]], [false, true, true, false], c.frame, { seed: 17 });
    ctx.save(); ctx.translate(98, 112); ctx.rotate((-4 * Math.PI) / 180);
    textBox(g, t.calMonth, -80, -62, 160, 44, { font: "head", max: 36, min: 16, colour: c.red, align: "center" });
    textBox(g, t.calDay, -80, -22, 160, 96, { font: "head", max: 80, min: 30, colour: c.ink, align: "center", lh: 1 });
    ctx.restore();
    textBox(g, t.big, 40, 150, 330, 440, { font: "head", max: 354, min: 120, colour: c.ink, lh: 0.92 });
    textBox(g, HU(g, t.headline), 37, 488, 430, 160, { font: "head", max: 133, min: 56, colour: c.ink, lh: 0.95 });
    tape(g, 135, 660, 190, 42, 0, "kraft");
    textBox(g, t.sub, 37, 696, 440, 100, { font: "body", max: 35, min: 18, weight: 700, colour: grey(g), lh: 1.15 });
    textBox(g, t.body, 37, 812, 442, 136, { font: "body", max: 26, min: 15, weight: 700, colour: c.ink, lh: 1.25 });
    paper(g, [[0, 978], [499, 972], [499, 1350], [0, 1350]], [true, true, false, false], c.frame, { seed: 14 });
    textBox(g, HU(g, t.cta), 45, 1028, 410, 190, { font: "head", max: 90, min: 36, colour: c.ink, lh: 0.95 });
    tape(g, 250, 1262, 416, 34, 0, "kraft");
    textBox(g, t.small, 40, 1292, 440, 50, { font: "body", max: 17, min: 11, weight: 700, colour: c.ink, lh: 1.2 });
    sticky(g, 930, 1180, 220, 200, 5, c.tag, () => { heart(g, 0, 6, 80, c.red, false, 5); }, true);
  },

  y1992(g) {
    const { c, t } = g;
    bg(g);
    textBox(g, HU(g, t.headline), 26, 6, 760, 330, { font: "head", max: 152, min: 60, colour: c.ink, lh: 0.94 });
    tape(g, 230, 338, 410, 38, -1, "kraft");
    paper(g, [[0, 893], [1080, 880], [1080, 1350], [0, 1350]], [true, false, false, false], c.frame, { seed: 18 });
    polaroid(g, 322, 726, 644, 743, -1, { pad: 24, bottom: 80 });
    tape(g, 560, 404, 150, 46, 38, "kraft");
    tape(g, 82, 1018, 150, 46, 38, "kraft");
    paper(g, [[643, 236], [1060, 236], [1060, 1114], [643, 1114]], [false, true, true, false], c.frame, { seed: 30 });
    textBox(g, t.i1, 722, 268, 300, 175, { font: "body", max: 34, min: 16, weight: 700, colour: c.ink, lh: 1.22 });
    dash(g, 705, 1018, 462, c.ink, 2.5, 0.35);
    textBox(g, t.i2, 720, 498, 300, 85, { font: "body", max: 33, min: 16, weight: 700, colour: c.ink, lh: 1.22 });
    dash(g, 705, 1018, 612, c.ink, 2.5, 0.35);
    textBox(g, t.i3, 719, 636, 300, 82, { font: "body", max: 33, min: 16, weight: 700, colour: c.ink, lh: 1.22 });
    textBox(g, t.i3b, 719, 724, 300, 92, { font: "body", max: 34, min: 16, weight: 700, colour: c.red, lh: 1.22 });
    dash(g, 705, 1018, 832, c.ink, 2.5, 0.35);
    textBox(g, t.i4, 714, 862, 300, 170, { font: "body", max: 33, min: 16, weight: 700, colour: c.ink, lh: 1.22 });
    stack(g, [{ text: t.a, colour: c.ink }, { text: t.b, colour: c.red }], 56, 1082, 960, 128, 54, 0.92);
  },

  war(g) {
    const { ctx, c, t } = g;
    ctx.fillStyle = c.green; ctx.fillRect(0, 0, XW, XH);
    paper(g, [[0, 0], [478, 0], [478, 1148], [0, 1148]], [false, true, true, false], c.frame, { seed: 33 });
    const wy = stack(g, [{ text: t.headline, colour: c.ink }], 38, 60, 370, 112, 40, 0.88);
    stack(g, [{ text: t.hot, colour: c.red }], 38, wy, 370, 122, 40, 0.88, { hMax: 570 - wy });
    dash(g, 20, 416, 576, c.ink, 2.5, 0.4);
    pair(g, t.o1, t.o2, 40, 606, 365, 32, c.ink, grey(g));
    pair(g, t.n1, t.n2, 38, 710, 370, 34, c.ink, grey(g));
    pair(g, t.s1, t.s2, 38, 820, 370, 33, c.ink, grey(g));
    polaroid(g, 748, 582, 665, 1030, 1, { pad: 22, bottom: 70 });
    tape(g, 457, 1215, 180, 42, 90, "kraft");
    textBox(g, t.footer, 502, 1126, 530, 200, { font: "body", max: 54, min: 22, weight: 700, colour: c.light, lh: 1.04 });
    void ctx;
  },

  closer(g) {
    const { ctx, c, t } = g;
    bg(g);
    polaroid(g, 291, 658, 582, 1216, -1.5, { pad: 24, bottom: 90 });
    tape(g, 62, 127, 150, 44, -80, "kraft");
    paper(g, [[0, 1029], [540, 1022], [540, 1215], [0, 1215]], [false, true, true, false], c.tag, { seed: 6 });
    ctx.save(); ctx.translate(100, 1130); ctx.rotate((-2 * Math.PI) / 180); ctx.globalAlpha = 0.85;
    textBox(g, t.stampPost, -30, -48, 150, 40, { font: "body", max: 29, min: 14, weight: 700, colour: c.ink });
    textBox(g, t.postNo, -30, -22, 150, 70, { font: "body", max: 58, min: 20, weight: 700, colour: c.ink });
    ctx.restore();
    vbar(g, 186, 1063, 8, 136, c.red);
    ctx.save(); ctx.translate(220, 1118); ctx.rotate((-2 * Math.PI) / 180); ctx.globalAlpha = 0.85;
    textBox(g, t.stampSub, 0, 0, 300, 70, { font: "body", max: 27, min: 14, weight: 500, colour: c.ink, lh: 1.2 });
    ctx.restore();
    // header row
    rule(g, 560, 1038, 67, c.red, 3);
    rule(g, 560, 1038, 135, c.red, 3);
    textBox(g, t.month, 560, 94, 260, 36, { font: "body", max: 27, min: 14, weight: 700, colour: c.ink });
    const runs: [string, number, string][] = [["Post", 700, c.ink], [t.postNo, 700, c.red], ["of", 500, c.ink], [t.ofNo, 500, c.red]];
    ctx.font = `600 27px ${g.body}`;
    let rx = 1038;
    const placed: { s: string; w: number; x: number; col: string; wt: number }[] = [];
    for (let i = runs.length - 1; i >= 0; i--) {
      ctx.font = `${runs[i][1]} 27px ${g.body}`;
      const w = ctx.measureText(runs[i][0]).width;
      rx -= w;
      placed.push({ s: runs[i][0], w, x: rx, col: runs[i][2], wt: runs[i][1] });
      rx -= 12;
    }
    placed.forEach((p) => { ctx.font = `${p.wt} 27px ${g.body}`; ctx.fillStyle = p.col; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(p.s, p.x, 97); });
    textBox(g, t.headline, 557, 168, 470, 340, { font: "script", max: 105, min: 42, weight: 600, colour: c.ink, lh: 0.98 });
    dash(g, 560, 1038, 524, c.ink, 2.5, 0.4);
    textBox(g, t.hot, 557, 556, 470, 98, { font: "body", max: 41, min: 20, weight: 700, colour: c.red, lh: 1.08 });
    textBox(g, t.a, 582, 698, 440, 42, { font: "body", max: 33, min: 16, weight: 600, colour: c.ink });
    dash(g, 581, 997, 756, c.ink, 2.5, 0.35);
    textBox(g, t.b, 583, 772, 440, 42, { font: "body", max: 33, min: 16, weight: 600, colour: c.ink });
    dash(g, 581, 997, 832, c.ink, 2.5, 0.35);
    textBox(g, t.c, 582, 858, 440, 82, { font: "body", max: 33, min: 16, weight: 600, colour: c.ink, lh: 1.2 });
    dash(g, 560, 1038, 976, c.red, 3, 0.8);
    textBox(g, t.end, 573, 1010, 465, 80, { font: "body", max: 34, min: 16, weight: 700, colour: c.ink, lh: 1.1 });
    paper(g, [[560, 1113], [1038, 1113], [1038, 1300], [560, 1300]], [false, true, true, false], c.tag, { seed: 52 });
    ctx.save(); ctx.strokeStyle = c.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(654, 1198, 48, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    star(ctx, 654, 1198, 30, c.red);
    textBox(g, t.small, 712, 1148, 300, 100, { font: "body", max: 26, min: 12, weight: 500, colour: c.ink, lh: 1.2 });
    void rgba; void checkbox;
  },
};

// Georgia fallback for the report numbers
const SERIF = `'Playfair Display', Georgia, 'Times New Roman', serif`;

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export type NovDrawInput = {
  design: NovId;
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

export function resolveNovText(design: NovDesign, text: Record<string, string>, fill: Fill): Record<string, string> {
  return Object.fromEntries(design.fields.map((fd) => [fd.key, fillTokens(text[fd.key] ?? design.defaults[fd.key] ?? "", fill)]));
}

export function drawNovember(ctx: Ctx, d: NovDrawInput): Slot[] {
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
