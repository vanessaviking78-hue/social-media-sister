import { drawAligned, drawCornerLogo, type Align, type CornerPos } from "./text-layout";
// BASIC posts: twelve cover layouts and the two full bleed photo slides that follow them.
// Everything draws straight onto a 1080 x 1440 canvas so the preview, the download and the
// scheduled image are always identical. No React in here, so it can be tested on its own.

export const W = 1080;
export const H = 1440;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export type Colours = { bg: string; text: string; accent: string; paper: string; ink: string };

function rgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [20, 25, 92];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readable(bg: string): string {
  return luminance(bg) > 0.5 ? "#16171f" : "#ffffff";
}

// Four colours from one: the background the client picked, readable text on it, a softer accent
// for badges and lines, and a light "paper" colour for the panels.
export function makeColours(bg: string, over?: Partial<Colours>): Colours {
  const text = readable(bg);
  const dark = luminance(bg) <= 0.5;
  const paper = dark ? mix(bg, "#ffffff", 0.88) : mix(bg, "#000000", 0.06);
  const base: Colours = {
    bg,
    text,
    accent: dark ? mix(bg, "#ffffff", 0.32) : mix(bg, "#000000", 0.35),
    paper,
    ink: readable(paper),
  };
  return { ...base, ...(over ?? {}) };
}

// ---------------------------------------------------------------------------
// Cover definitions
// ---------------------------------------------------------------------------

export type CoverId =
  | "starthere" | "intro" | "whyme" | "simple" | "beforebook" | "wontget"
  | "willget" | "person" | "getonif" | "three" | "statement" | "ask";

export type FieldDef = { key: string; label: string; rows?: number; words: number };

export type CoverDef = {
  id: CoverId;
  name: string;
  photos: 0 | 1 | 2;
  idea: string;
  fields: FieldDef[];
  defaults: Record<string, string>;
};

const f = (key: string, label: string, words: number, rows = 1): FieldDef => ({ key, label, words, rows });

// {owner}, {clinic}, {area} and {role} are filled in from the client at draw time.
export const COVERS: CoverDef[] = [
  {
    id: "starthere", name: "Start here", photos: 1,
    idea: "a welcome for a brand new follower, three things she should know about working with me",
    fields: [f("headline", "Headline", 3), f("sub", "Line under the headline", 14, 2), f("i1", "Point 1", 4), f("i2", "Point 2", 5), f("i3", "Point 3", 6), f("footer", "Bottom line", 6)],
    defaults: {
      headline: "Start here", sub: "If you're new here, this is what I want you to know.",
      i1: "thoughtful consultations", i2: "treatment plans built around you", i3: "never more for the sake of more",
      footer: "{clinic}, {area}",
    },
  },
  {
    id: "intro", name: "Hi, I'm", photos: 2,
    idea: "a friendly personal introduction from the owner",
    fields: [f("headline", "Headline", 4), f("sub", "Who I am", 10, 2), f("i1", "A line about me", 24, 4)],
    defaults: {
      headline: "Hi, I'm {owner}.", sub: "{role} at {clinic}, {area}.",
      i1: "I want you to feel comfortable asking questions, including the ones you think sound silly.",
    },
  },
  {
    id: "whyme", name: "Why me?", photos: 1,
    idea: "four honest reasons to choose me",
    fields: [f("headline", "Headline", 3), f("i1", "Reason 1", 12, 2), f("i2", "Reason 2", 10, 2), f("i3", "Reason 3", 10, 2), f("i4", "Reason 4", 10, 2), f("footer", "Bottom banner", 5)],
    defaults: {
      headline: "Why me?", i1: "I will tell you when I think you don't need something", i2: "I explain the why, not just the what",
      i3: "I look at the whole picture, not one area", i4: "saying no is part of good practice", footer: "Consultation first. Always.",
    },
  },
  {
    id: "simple", name: "My approach is simple", photos: 1,
    idea: "four simple promises about how I work",
    fields: [f("headline", "Headline", 5), f("i1", "Promise 1", 8), f("i2", "Promise 2", 8), f("i3", "Promise 3", 8), f("i4", "Promise 4", 8)],
    defaults: {
      headline: "My approach is simple", i1: "You should still look like you.", i2: "You should understand what you're choosing.",
      i3: "You should never feel pressured.", i4: "You are allowed to change your mind.",
    },
  },
  {
    id: "beforebook", name: "Before you book with me", photos: 1,
    idea: "an honest checklist of what to bring and expect before a first appointment",
    fields: [f("headline", "Headline", 5), f("sub", "Line under the headline", 14, 2), f("i1", "Tick 1", 6), f("i2", "Tick 2", 6), f("i3", "Tick 3", 7), f("i4", "Tick 4", 8), f("i5", "Tick 5", 7)],
    defaults: {
      headline: "Before you book with me.", sub: "A little honesty upfront helps us create the right plan for you.",
      i1: "bring your questions", i2: "tell me your real concerns", i3: "tell me your medical history honestly",
      i4: "forget what Instagram says you 'should' have", i5: "expect a conversation before a plan.",
    },
  },
  {
    id: "wontget", name: "What you won't get here", photos: 1,
    idea: "the things I will never do, said with warmth and humour",
    fields: [f("headline", "Headline", 5), f("i1", "Item 1", 6), f("i2", "Item 2", 6), f("i3", "Item 3", 7), f("i4", "Item 4", 7), f("i5", "Item 5", 8), f("footer", "Bottom panel", 12, 2)],
    defaults: {
      headline: "What you won't get here.", i1: "a one size fits all plan", i2: "pressure to book", i3: "a treatment because it's trending",
      i4: "promises I can't responsibly make", i5: "offence taken if I say 'not today'.", footer: "Sometimes the best plan includes doing less.",
    },
  },
  {
    id: "willget", name: "What you will get here", photos: 1,
    idea: "what a woman can expect when she walks in",
    fields: [f("headline", "Headline", 5), f("i1", "Item 1", 3), f("i2", "Item 2", 5), f("i3", "Item 3", 7), f("i4", "Item 4", 4), f("i5", "Item 5", 9)],
    defaults: {
      headline: "What you will get here", i1: "honesty", i2: "time to ask questions", i3: "a plan that makes sense for you",
      i4: "clear aftercare", i5: "someone who wants the result to feel like you.",
    },
  },
  {
    id: "person", name: "There's a person behind this", photos: 1,
    idea: "the human behind the clinic, remembering the little things about her patients",
    fields: [f("headline", "Headline", 8, 2), f("i1", "Note line 1", 6), f("i2", "Note line 2", 6), f("i3", "Note line 3", 6), f("footer", "Bottom panel", 22, 3)],
    defaults: {
      headline: "There's a person behind this clinic.", i1: "I remember your name.", i2: "I remember what worried you.", i3: "I remember how you take your tea.",
      footer: "Come for the consultation. Stay because I remembered the story you told me six months ago.",
    },
  },
  {
    id: "getonif", name: "We'll probably get on if", photos: 1,
    idea: "who I am a good fit for, and one honest line about who I am not",
    fields: [f("headline", "Headline", 6, 2), f("i1", "Get on 1", 8), f("i2", "Get on 2", 6), f("i3", "Get on 3", 10), f("i4", "Get on 4", 8), f("head2", "Second heading", 7), f("j1", "Not for you", 12, 2)],
    defaults: {
      headline: "We'll probably get on if...", i1: "you want to look like yourself", i2: "you like honest advice",
      i3: "you would rather have a plan than chase trends", i4: "you want to understand your options.",
      head2: "I may not be your clinic if...", j1: "you want someone to agree with everything you ask for.",
    },
  },
  {
    id: "three", name: "Three things I wish you knew", photos: 0,
    idea: "three reassuring things I wish every new patient knew, plain colour with big numbers",
    fields: [f("headline", "Headline", 9, 3), f("i1", "Thing 1", 8), f("i2", "Thing 2", 8), f("i3", "Thing 3", 8)],
    defaults: {
      headline: "Three things I wish you knew before your first visit", i1: "You can ask me anything.", i2: "Doing nothing is a perfectly good plan.", i3: "I will never rush you.",
    },
  },
  {
    id: "statement", name: "Come as you are", photos: 1,
    idea: "a big warm statement over a full photo, inviting her to come as she is",
    fields: [f("headline", "Headline", 5, 2), f("sub", "Line under it", 22, 3), f("footer", "Small line at the bottom", 6)],
    defaults: {
      headline: "Come as you are.", sub: "No make-up needed. No script. Just a proper chat and a cuppa with me at {clinic}.", footer: "{area}",
    },
  },
  {
    id: "ask", name: "Questions I never mind", photos: 1,
    idea: "the questions women are scared to ask, and a promise that I welcome every one",
    fields: [f("headline", "Headline", 6, 2), f("i1", "Question 1", 8), f("i2", "Question 2", 8), f("i3", "Question 3", 8), f("i4", "Question 4", 8), f("footer", "Bottom line", 10, 2)],
    defaults: {
      headline: "Questions I never mind being asked.", i1: "Can I just come for a chat?", i2: "Do I have to decide today?",
      i3: "What if I change my mind?", i4: "Is this a silly question?", footer: "Send me yours. I read every one.",
    },
  },
];

export const COVER_BY_ID: Record<CoverId, CoverDef> = Object.fromEntries(COVERS.map((c) => [c.id, c])) as Record<CoverId, CoverDef>;

export type Fill = { owner: string; clinic: string; area: string; role: string };

export function fillTokens(text: string, v: Fill): string {
  return (text ?? "")
    .replace(/\{owner\}/gi, v.owner || "[first name]")
    .replace(/\{clinic\}/gi, v.clinic || "[business name]")
    .replace(/\{area\}/gi, v.area || "[area]")
    .replace(/\{role\}/gi, v.role || "Owner")
    .replace(/,\s*\.$/, ".")
    .replace(/,\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

export type Slot = { i: number; x: number; y: number; w: number; h: number; rot: number };
export type Focus = [number, number];
export const DEFAULT_FOCUS: Focus = [0.5, 0.32];

export type G = {
  ctx: CanvasRenderingContext2D;
  t: Record<string, string>;
  c: Colours;
  head: string; // CSS font value for the headline, e.g. 'Anton', sans-serif
  body: string;
  headW: number; // headline weight
  upper: boolean;
  photos: (ImageBitmap | null)[];
  focus: Focus[];
  logo: HTMLImageElement | null;
  slots: Slot[];
};

const U = (g: G, s: string) => (g.upper ? (s ?? "").toUpperCase() : s ?? "");

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

function fit(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, maxW: number, maxH: number, max: number, min: number, lh: number) {
  let s = max;
  let lines: string[] = [];
  for (; s >= min; s -= 2) {
    ctx.font = font(s);
    lines = wrap(ctx, text, maxW);
    if (lines.length * s * lh <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW + 1)) break;
  }
  s = Math.max(s, min);
  ctx.font = font(s);
  lines = wrap(ctx, text, maxW);
  return { size: s, lines };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lh: number, align: CanvasTextAlign = "left"): number {
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
  return y;
}

// A block of text in the body font, wrapped. Returns the y under it.
function para(g: G, text: string, x: number, y: number, o: { size: number; w: number; weight?: number; lh?: number; colour?: string; align?: CanvasTextAlign; upper?: boolean; italic?: boolean }): number {
  const { ctx } = g;
  const lh = o.lh ?? 1.28;
  ctx.font = `${o.italic ? "italic " : ""}${o.weight ?? 500} ${o.size}px ${g.body}`;
  ctx.fillStyle = o.colour ?? g.c.text;
  const lines = wrap(ctx, o.upper ? text.toUpperCase() : text, o.w);
  return drawLines(ctx, lines, x, y, Math.round(o.size * lh), o.align ?? "left");
}

// The big headline, shrunk until it fits the box. Returns the y under it.
function headline(g: G, text: string, x: number, y: number, w: number, maxH: number, max: number, min = 56, o?: { colour?: string; align?: CanvasTextAlign; lh?: number }): number {
  const { ctx } = g;
  const lh = o?.lh ?? 1.02;
  const r = fit(ctx, U(g, text), (s) => `${g.headW} ${s}px ${g.head}`, w, maxH, max, min, lh);
  ctx.fillStyle = o?.colour ?? g.c.text;
  return drawLines(ctx, r.lines, x, y, Math.round(r.size * lh), o?.align ?? "left");
}

function rule(g: G, x1: number, x2: number, y: number, colour?: string, alpha = 0.55, width = 2) {
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour ?? g.c.text;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

function fillBg(g: G) {
  g.ctx.fillStyle = g.c.bg;
  g.ctx.fillRect(0, 0, W, H);
}

function quarter(g: G, corner: "br" | "bl" | "tr", r: number, colour?: string) {
  const { ctx } = g;
  ctx.fillStyle = colour ?? g.c.paper;
  ctx.beginPath();
  if (corner === "br") { ctx.moveTo(W, H); ctx.arc(W, H, r, Math.PI, Math.PI * 1.5); }
  else if (corner === "bl") { ctx.moveTo(0, H); ctx.arc(0, H, r, Math.PI * 1.5, Math.PI * 2); }
  else { ctx.moveTo(W, 0); ctx.arc(W, 0, r, Math.PI * 0.5, Math.PI); }
  ctx.closePath();
  ctx.fill();
}

function badge(g: G, cx: number, cy: number, r: number, label: string) {
  const { ctx } = g;
  ctx.fillStyle = g.c.accent;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = readable(g.c.accent);
  ctx.font = `700 ${Math.round(r * 0.9)}px ${g.body}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 2);
  ctx.textBaseline = "top";
}

function tick(g: G, cx: number, cy: number, r: number, colour: string) {
  const { ctx } = g;
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy + r * 0.02); ctx.lineTo(cx - r * 0.08, cy + r * 0.34); ctx.lineTo(cx + r * 0.46, cy - r * 0.3); ctx.stroke();
  ctx.restore();
}

function placeholder(g: G, w: number, h: number) {
  const { ctx } = g;
  ctx.fillStyle = mix(g.c.bg, g.c.text, 0.16);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = mix(g.c.bg, g.c.text, 0.55);
  ctx.font = `600 34px ${g.body}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Choose a photo", 0, 0);
  ctx.textBaseline = "top";
}

// One photo in a frame. i is the photo slot (0, 1). The frame can be a rectangle, a circle or tilted.
// The photo is cropped to fill the frame and focus (0 to 1) decides which part stays in view.
function photo(g: G, i: number, x: number, y: number, w: number, h: number, o?: { circle?: boolean; rot?: number; tape?: boolean; border?: number }): void {
  const { ctx } = g;
  const rot = ((o?.rot ?? 0) * Math.PI) / 180;
  const cx = x + w / 2, cy = y + h / 2;
  const bmp = g.photos[i] ?? null;
  const fc = g.focus[i] ?? DEFAULT_FOCUS;
  g.slots.push({ i, x, y, w, h, rot: o?.rot ?? 0 });

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  if (o?.border) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
    ctx.fillRect(-w / 2 - o.border, -h / 2 - o.border, w + o.border * 2, h + o.border * 2);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  ctx.beginPath();
  if (o?.circle) ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  if (bmp) {
    const s = Math.max(w / bmp.width, h / bmp.height);
    const dw = bmp.width * s, dh = bmp.height * s;
    ctx.drawImage(bmp, -w / 2 - (dw - w) * fc[0], -h / 2 - (dh - h) * fc[1], dw, dh);
  } else {
    placeholder(g, w, h);
  }
  ctx.restore();

  if (o?.tape) {
    ctx.save();
    ctx.translate(cx, y + 6);
    ctx.rotate(rot - 0.05);
    ctx.fillStyle = "rgba(235,224,196,0.88)";
    ctx.fillRect(-90, -24, 180, 50);
    ctx.restore();
  }
}

function logoAt(g: G, x: number, y: number, align: "left" | "right", maxW = 250, maxH = 84) {
  if (!g.logo) return;
  const lg = g.logo;
  const s = Math.min(maxW / lg.width, maxH / lg.height);
  const w = lg.width * s, h = lg.height * s;
  g.ctx.drawImage(lg, align === "right" ? x - w : x, y, w, h);
}

// ---------------------------------------------------------------------------
// The twelve covers
// ---------------------------------------------------------------------------

const LAYOUTS: Record<CoverId, (g: G) => void> = {
  starthere(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    photo(g, 0, 0, 0, 500, 1236);
    quarter(g, "br", 340);
    const x = 556, w = 452;
    let y = headline(g, t.headline, x, 120, w, 420, 150, 64);
    y += 28;
    rule(g, x, x + w, y);
    y += 30;
    y = para(g, t.sub, x, y, { size: 32, w, weight: 700, lh: 1.3, upper: true });
    y = Math.max(y + 40, 740);
    [t.i1, t.i2, t.i3].forEach((line, k) => {
      const cy = y + k * 124 + 36;
      badge(g, x + 36, cy, 34, String(k + 1));
      ctx.save(); ctx.globalAlpha = 0.4; ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 92, cy - 34); ctx.lineTo(x + 92, cy + 34); ctx.stroke(); ctx.restore();
      ctx.font = `700 33px ${g.body}`;
      const lines = wrap(ctx, line, w - 130);
      const lh = 40;
      ctx.fillStyle = c.text;
      drawLines(ctx, lines, x + 116, cy - (lines.length * lh) / 2, lh);
    });
    para(g, t.footer, 40, H - 110, { size: 28, w: 640, weight: 700, upper: true });
    logoAt(g, W - 50, 30, "right", 220, 70);
  },

  intro(g) {
    const { c, t } = g;
    fillBg(g);
    quarter(g, "bl", 300);
    const x = 72, w = 430;
    let y = headline(g, t.headline, x, 130, w, 420, 130, 64);
    y += 30;
    y = para(g, t.sub, x, y, { size: 42, w, weight: 700, lh: 1.25 });
    y += 36;
    rule(g, x, x + w, y);
    y += 40;
    para(g, t.i1, x, y, { size: 36, w, weight: 500, lh: 1.35 });
    photo(g, 0, 560, 100, 450, 540);
    photo(g, 1, 560, 700, 450, 540);
    logoAt(g, W - 50, H - 130, "right", 240, 80);
    void c;
  },

  whyme(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    const x = 72;
    headline(g, t.headline, x, 120, 470, 420, 190, 80);
    photo(g, 0, 580, 100, 430, 1030);
    // little paper circle tucked into the photo corner
    ctx.fillStyle = c.paper; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(W - 20, 90, 150, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    [t.i1, t.i2, t.i3, t.i4].forEach((line, k) => {
      const y = 620 + k * 135;
      badge(g, x + 30, y + 40, 28, String(k + 1).padStart(2, "0"));
      ctx.font = `600 32px ${g.body}`;
      ctx.fillStyle = c.text;
      const lines = wrap(ctx, line, 400);
      drawLines(ctx, lines, x + 82, y + 40 - (lines.length * 38) / 2, 38);
      rule(g, x, 520, y + 112, c.text, 0.3, 1.5);
    });
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, H - 140, W, 140);
    ctx.fillStyle = c.ink;
    ctx.font = `${g.headW} 52px ${g.head}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(U(g, t.footer), W / 2, H - 70);
    ctx.textBaseline = "top";
    logoAt(g, x, 40, "left", 220, 64);
  },

  simple(g) {
    const { t, c } = g;
    fillBg(g);
    photo(g, 0, 620, 40, 420, 1360);
    const x = 72, w = 470;
    let y = headline(g, t.headline, x, 300, w, 500, 128, 64);
    y += 34;
    rule(g, x, x + 300, y);
    y += 50;
    [t.i1, t.i2, t.i3, t.i4].forEach((line) => {
      y = para(g, line, x, y, { size: 36, w, weight: 500, lh: 1.3 }) + 44;
    });
    logoAt(g, x, H - 130, "left", 240, 80);
    void c;
  },

  beforebook(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    const x = 60;
    let y = headline(g, t.headline, x, 70, 400, 560, 150, 64);
    y += 26;
    para(g, t.sub, x, y, { size: 32, w: 400, weight: 500, lh: 1.3 });
    photo(g, 0, 520, 130, 600, 600, { circle: true });
    // checklist panel
    ctx.fillStyle = c.paper; ctx.globalAlpha = 0.92;
    ctx.fillRect(40, 800, 640, 560); ctx.globalAlpha = 1;
    [t.i1, t.i2, t.i3, t.i4, t.i5].forEach((line, k) => {
      const ry = 830 + k * 106;
      tick(g, 90, ry + 40, 22, c.ink);
      ctx.font = `600 33px ${g.body}`;
      ctx.fillStyle = c.ink;
      const lines = wrap(ctx, line, 520);
      drawLines(ctx, lines, 136, ry + 40 - (lines.length * 38) / 2, 38);
      rule(g, 70, 650, ry + 92, c.ink, 0.25, 1.5);
    });
    logoAt(g, W - 50, H - 150, "right", 260, 90);
  },

  wontget(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    ctx.fillStyle = mix(c.bg, "#000000", 0.5);
    ctx.fillRect(660, 0, W - 660, H);
    const x = 50;
    headline(g, t.headline, x, 90, 520, 560, 140, 64);
    photo(g, 0, 470, 330, 520, 560);
    let ly = 700;
    [t.i1, t.i2, t.i3, t.i4, t.i5].forEach((line) => {
      ctx.font = `600 31px ${g.body}`;
      const lines = wrap(ctx, line, 380);
      const hh = lines.length * 38;
      ctx.fillStyle = c.accent;
      ctx.fillRect(x, ly + 2, 4, hh - 4);
      ctx.fillStyle = c.text;
      drawLines(ctx, lines, x + 26, ly, 38);
      ly += hh + 26;
    });
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 1120, 740, 320);
    para(g, t.footer, 50, 1180, { size: 40, w: 640, weight: 600, lh: 1.3, colour: c.ink });
    logoAt(g, W - 40, 40, "right", 220, 64);
  },

  willget(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    ctx.save(); ctx.strokeStyle = c.text; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, H, 230, Math.PI * 1.5, Math.PI * 2); ctx.stroke(); ctx.restore();
    headline(g, t.headline, 60, 70, 540, 520, 130, 64);
    photo(g, 0, 650, 50, 380, 1220);
    rule(g, 625, 625, 50, c.text, 0.3, 1.5);
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(626, 60); ctx.lineTo(626, 1260); ctx.stroke(); ctx.restore();
    [t.i1, t.i2, t.i3, t.i4, t.i5].forEach((line, k) => {
      const y = 650 + k * 124;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(92, y + 42, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(92, y + 42, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = `600 33px ${g.body}`;
      ctx.fillStyle = c.text;
      const lines = wrap(ctx, line, 440);
      drawLines(ctx, lines, 146, y + 42 - (lines.length * 39) / 2, 39);
      rule(g, 60, 600, y + 100, c.text, 0.28, 1.5);
    });
    logoAt(g, W - 50, H - 130, "right", 240, 80);
  },

  person(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    headline(g, t.headline, 50, 70, 370, 440, 100, 52);
    photo(g, 0, 440, 130, 580, 980, { rot: 2.5, tape: true, border: 10 });
    // note paper, taped on
    ctx.save();
    ctx.translate(245, 870); ctx.rotate(-0.035);
    ctx.fillStyle = c.paper; ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    ctx.fillRect(-205, -290, 410, 580);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(235,224,196,0.92)"; ctx.fillRect(-85, -314, 170, 46);
    [t.i1, t.i2, t.i3].forEach((line, k) => {
      const ly = -170 + k * 150;
      ctx.font = `italic 600 34px ${g.body}`;
      ctx.fillStyle = c.ink; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const lines = wrap(ctx, line, 340);
      drawLines(ctx, lines, -170, ly, 42);
      ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-170, ly + 112); ctx.lineTo(170, ly + 112); ctx.stroke(); ctx.restore();
    });
    ctx.restore();
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 1180, W, 260);
    para(g, t.footer, 60, 1215, { size: 40, w: 960, weight: 500, lh: 1.32, colour: c.ink });
    logoAt(g, W - 50, 30, "right", 220, 64);
  },

  getonif(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    quarter(g, "bl", 360, mix(c.bg, c.text, 0.28));
    const x = 50;
    let y = headline(g, t.headline, x, 90, 600, 420, 150, 60);
    y += 30;
    photo(g, 0, 520, 470, 490, 560, { rot: 8, tape: true, border: 8 });
    rule(g, x, 500, y, c.text, 0.45);
    y += 36;
    [t.i1, t.i2, t.i3, t.i4].forEach((line) => {
      ctx.font = `600 33px ${g.body}`;
      const lines = wrap(ctx, line, 410);
      ctx.fillStyle = c.text;
      const bottom = drawLines(ctx, lines, x, y, 40);
      rule(g, x, 470, bottom + 14, c.text, 0.3, 1.5);
      y = bottom + 34;
    });
    ctx.fillStyle = c.text;
    ctx.font = `700 34px ${g.body}`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const hl = wrap(ctx, U(g, t.head2), 640);
    const hy = Math.max(1190, y + 20);
    const hb = drawLines(ctx, hl, 390, hy, 42);
    rule(g, 390, 1030, hb + 8, c.text, 0.5);
    para(g, t.j1, 390, hb + 24, { size: 30, w: 640, weight: 500, lh: 1.3 });
    logoAt(g, W - 50, 30, "right", 220, 64);
  },

  three(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    headline(g, t.headline, 72, 130, 936, 520, 130, 60);
    [t.i1, t.i2, t.i3].forEach((line, k) => {
      const y = 700 + k * 210;
      rule(g, 72, W - 72, y - 22, c.text, 0.3, 1.5);
      ctx.fillStyle = c.accent;
      ctx.font = `${g.headW} 170px ${g.head}`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(String(k + 1), 72, y - 4);
      ctx.fillStyle = c.text;
      ctx.font = `600 44px ${g.body}`;
      const lines = wrap(ctx, line, 700);
      drawLines(ctx, lines, 250, y + 80 - (lines.length * 54) / 2, 54);
    });
    logoAt(g, W - 60, 50, "right", 240, 80);
  },

  statement(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    // the one full bleed photo cover
    photo(g, 0, 0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 18;
    const y = headline(g, t.headline, W / 2, 470, 900, 400, 180, 80, { colour: "#ffffff", align: "center" });
    para(g, t.sub, W / 2, y + 26, { size: 40, w: 760, weight: 500, lh: 1.32, colour: "#ffffff", align: "center" });
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `700 28px ${g.body}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText((t.footer ?? "").toUpperCase(), W / 2, H - 130);
    void c;
    logoAt(g, W - 50, 40, "right", 240, 80);
  },

  ask(g) {
    const { ctx, t, c } = g;
    fillBg(g);
    photo(g, 0, 560, 70, 470, 470, { circle: true });
    headline(g, t.headline, 72, 110, 470, 420, 120, 60);
    [t.i1, t.i2, t.i3, t.i4].forEach((line, k) => {
      const y = 650 + k * 140;
      ctx.font = `600 36px ${g.body}`;
      const tw = Math.min(900, ctx.measureText(line).width + 90);
      const x = k % 2 === 0 ? 72 : W - 72 - tw;
      ctx.fillStyle = c.paper;
      ctx.beginPath();
      const r = 44, hh = 96;
      ctx.moveTo(x + r, y); ctx.arcTo(x + tw, y, x + tw, y + hh, r); ctx.arcTo(x + tw, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + tw, y, r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(line, x + tw / 2, y + hh / 2 + 2, tw - 50);
      ctx.textBaseline = "top";
    });
    para(g, t.footer, 72, 1250, { size: 36, w: 700, weight: 600, lh: 1.3 });
    logoAt(g, W - 50, H - 130, "right", 240, 80);
  },
};

export type DrawInput = {
  cover: CoverId;
  text: Record<string, string>; // already filled, no tokens left
  colours: Colours;
  headFont: string;
  bodyFont: string;
  upper?: boolean;
  photos: (ImageBitmap | null)[];
  focus: Focus[];
  logo: HTMLImageElement | null;
};

export function headWeightFor(font: string): number {
  return /anton|bebas|oswald|league gothic|fjalla|londrina/i.test(font) ? 400 : 700;
}

// Draws one cover and says where each photo went, so the preview can drag them about.
export function drawCover(ctx: CanvasRenderingContext2D, d: DrawInput): Slot[] {
  const g: G = {
    ctx, t: d.text, c: d.colours, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: d.upper !== false, photos: d.photos, focus: d.focus, logo: d.logo, slots: [],
  };
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  LAYOUTS[d.cover](g);
  ctx.restore();
  return g.slots;
}

// ---------------------------------------------------------------------------
// Slides 2 and 3: a full bleed approved photo with the words laid over it
// ---------------------------------------------------------------------------

export type PhotoSlideInput = {
  text: string;
  cta?: string;
  colours: Colours;
  bodyFont: string;
  headFont: string;
  photo: ImageBitmap | null;
  focus: Focus;
  scrim: number; // 0 to 80, how much the photo is dimmed
  logo: HTMLImageElement | null;
  arrow: boolean;
  align?: Align;
  logoCorner?: CornerPos;
  spacing?: number;
};

export function drawPhotoSlide(ctx: CanvasRenderingContext2D, d: PhotoSlideInput): Slot[] {
  const slots: Slot[] = [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }];
  ctx.save();
  ctx.fillStyle = d.colours.bg;
  ctx.fillRect(0, 0, W, H);
  if (d.photo) {
    const s = Math.max(W / d.photo.width, H / d.photo.height);
    const dw = d.photo.width * s, dh = d.photo.height * s;
    ctx.drawImage(d.photo, -(dw - W) * d.focus[0], -(dh - H) * d.focus[1], dw, dh);
  } else {
    ctx.fillStyle = mix(d.colours.bg, d.colours.text, 0.16);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = mix(d.colours.bg, d.colours.text, 0.55);
    ctx.font = `600 40px ${d.bodyFont}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Choose a photo", W / 2, H / 2);
  }
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(80, d.scrim)) / 100})`;
  ctx.fillRect(0, 0, W, H);
  // a touch of extra depth behind the words
  const gr = ctx.createLinearGradient(0, H * 0.35, 0, H);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, H * 0.35, W, H * 0.65);

  const maxW = 860;
  const hasCta = !!d.cta?.trim();
  const body = fit(ctx, d.text, (s) => `600 ${s}px ${d.bodyFont}`, maxW, hasCta ? 520 : 640, 66, 32, d.spacing ?? 1.3);
  const lh = Math.round(body.size * (d.spacing ?? 1.3));
  const bodyH = body.lines.length * lh;

  let pillW = 0, pillH = 0, ctaLines: string[] = [];
  const ctaSize = 38, ctaLh = 48;
  if (hasCta) {
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    ctaLines = wrap(ctx, d.cta!.trim(), 720);
    pillW = Math.min(840, Math.max(...ctaLines.map((l) => ctx.measureText(l).width)) + 90);
    pillH = ctaLines.length * ctaLh + 56;
  }
  const gap = hasCta ? 56 : 0;
  const total = bodyH + gap + pillH;
  let y = Math.round(H * 0.6 - total / 2);

  ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${body.size}px ${d.bodyFont}`;
  y = drawAligned(ctx, body.lines, y, lh, d.align, W);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  if (hasCta) {
    y += gap;
    const px = (W - pillW) / 2, r = 40;
    ctx.fillStyle = d.colours.paper;
    ctx.beginPath();
    ctx.moveTo(px + r, y); ctx.arcTo(px + pillW, y, px + pillW, y + pillH, r); ctx.arcTo(px + pillW, y + pillH, px, y + pillH, r);
    ctx.arcTo(px, y + pillH, px, y, r); ctx.arcTo(px, y, px + pillW, y, r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.colours.ink;
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    drawLines(ctx, ctaLines, W / 2, y + 28, ctaLh, "center");
  }

  if (d.arrow) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const ay = H - 96;
    ctx.beginPath(); ctx.moveTo(W - 168, ay); ctx.lineTo(W - 88, ay); ctx.moveTo(W - 104, ay - 13); ctx.lineTo(W - 88, ay); ctx.lineTo(W - 104, ay + 13); ctx.stroke();
  }
  drawCornerLogo(ctx, d.logo, d.logoCorner, W, H, d.arrow ? 110 : 0);
  ctx.restore();
  return slots;
}
