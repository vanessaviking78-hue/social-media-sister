// Empower layouts, one per Canva page. All coordinates are in a 400 x 500 space (the Canva page size).
// Words: *asterisks* make a word the highlight colour.
import {
  W, H, arcPts, archPts, barcode, big, bracket, brush, circle, crop, crosshair, jag, k, photoPoly, photoRect, poly, rect, rich, sprockets, torn, T2,
  type EG, type P,
} from "./empower-kit";

export type Layout = (g: EG) => void;
const fill = (g: EG, key: "page" | "dark" | "accent" | "soft" | "ink" | "light") => rect(g, 0, 0, W, H, k(g, key));
const rt = (g: EG, text: string, ...a: [number, number, number, number, Parameters<typeof rich>[6]]) => { g.t["__t"] = text; rich(g, "__t", ...a); };
const box = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export const LAYOUTS: Record<string, Layout> = {
  // 1 Your face is not a group project
  "group-project": (g) => {
    fill(g, "page");
    photoPoly(g, [[255, 0], [W, 0], [W, 410], [180, 410]], 150, 0, 250, 410);
    poly(g, [[0, 0], [256, 0], [181, 411], [0, 411]], k(g, "dark"));
    rich(g, "head", 18, 20, 175, 265, { max: 54, colour: k(g, "light"), caps: g.upper });
    rect(g, 20, 291, 130, 1.4, k(g, "accent"));
    rich(g, "body", 20, 301, 168, 100, { font: "body", max: 10.5, weight: 400, colour: k(g, "light"), lh: 1.18 });
    rich(g, "foot", 20, 424, 360, 62, { max: 20, colour: k(g, "ink"), caps: g.upper, lh: 1.02 });
  },
  // 2 What's disappeared first
  "whats-gone": (g) => {
    fill(g, "dark");
    photoRect(g, 200, 0, 200, 243);
    rich(g, "intro", 16, 24, 175, 14, { font: "body", max: 10.5, weight: 700, colour: k(g, "light"), caps: true });
    rich(g, "head", 16, 40, 180, 195, { max: 40, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rect(g, 0, 243, 198, 114, k(g, "page"));
    rect(g, 198, 243, 202, 114, k(g, "accent"));
    rect(g, 0, 357, 198, 113, k(g, "dark"));
    rect(g, 198, 357, 202, 113, k(g, "page"));
    const cell = (x: number, y: number, wk: string, nk: string, c: string) => {
      rich(g, wk, x + 18, y + 6, 165, 34, { max: 28, colour: c, caps: g.upper });
      big(g, g.t[nk] ?? "", x + 14, y + 30, 170, 80, c);
    };
    cell(0, 243, "a", "na", k(g, "ink"));
    cell(198, 243, "b", "nb", k(g, "light"));
    cell(0, 357, "c", "nc", k(g, "light"));
    cell(198, 357, "d", "nd", k(g, "ink"));
    rect(g, 0, 470, W, 30, k(g, "accent"));
    rich(g, "foot", 0, 477, W, 20, { max: 16, colour: k(g, "light"), align: "center", caps: g.upper });
  },
  // 3 Film title
  "film-title": (g) => {
    fill(g, "dark");
    photoPoly(g, [[228, 0], [W, 0], [W, H], [165, H]], 165, 0, 235, H);
    poly(g, [[W, 318], [W, H], [160, H]], k(g, "accent"));
    rich(g, "head", 16, 24, 184, 285, { max: 46, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rich(g, "exh", 16, 318, 150, 12, { font: "body", max: 9, weight: 800, colour: k(g, "accent"), caps: true });
    rich(g, "examples", 16, 332, 170, 44, { font: "body", max: 8.5, weight: 400, colour: k(g, "light"), lh: 1.32 });
    rect(g, 16, 392, 160, 98, k(g, "accent"));
    poly(g, [[164, 392], [176, 392], [176, 404]], k(g, "dark"), { alpha: 0.25 });
    rich(g, "card", 26, 402, 142, 80, { max: 20, colour: k(g, "light"), hi: k(g, "light"), caps: g.upper });
    big(g, g.t.q ?? "Q:", 270, 400, 120, 82, k(g, "dark"));
  },
  // 4 £1,000 to spend on your face
  thousand: (g) => {
    fill(g, "dark");
    photoPoly(g, archPts(188, 0, 212, H), 188, 0, 212, H);
    poly(g, [[0, 368], [190, 368], [300, H], [0, H]], k(g, "accent"));
    rich(g, "head", 16, 18, 175, 335, { max: 50, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    const items = (g.t.list ?? "").split("\n").filter(Boolean);
    items.slice(0, 4).forEach((s, i) => {
      T2(g, s, 18, 376 + i * 21, 170, 18, 10, k(g, "dark"), "left", 500);
      rect(g, 18, 394 + i * 21, 168 - i * 4, 0.6, k(g, "dark"));
    });
    rect(g, 16, 466, 164, 26, k(g, "dark"));
    rich(g, "button", 16, 472, 164, 16, { font: "body", max: 10, weight: 800, colour: k(g, "light"), align: "center", caps: true });
  },
  // 5 Something you've grown to love about your face
  "grown-to-love": (g) => {
    fill(g, "page");
    rect(g, 237, 0, 163, 52, k(g, "accent"));
    photoPoly(g, [[260, 12], [W, 12], [W, H], [183, H], [183, 230]], 183, 12, 217, 488);
    rect(g, 0, 345, 237, 155, k(g, "accent"));
    rich(g, "head", 20, 38, 168, 170, { max: 34, colour: k(g, "ink"), caps: g.upper });
    rect(g, 20, 216, 80, 1.4, k(g, "accent"));
    rich(g, "bold", 20, 228, 150, 48, { font: "body", max: 11, weight: 800, colour: k(g, "ink"), lh: 1.2 });
    rich(g, "list", 20, 284, 160, 62, { font: "body", max: 9, weight: 500, colour: k(g, "ink"), lh: 1.3 });
    rich(g, "foot", 20, 362, 205, 125, { max: 24, colour: k(g, "light"), caps: g.upper });
  },
  // 6 One minute you're terrified of getting older
  terrified: (g) => {
    fill(g, "dark");
    circle(g, 330, 120, 190, "rgba(255,255,255,0.05)");
    photoPoly(g, [[150, 0], [W, 0], [W, H], [215, H]], 150, 0, 250, H);
    poly(g, [[0, H], [0, 424], [62, 408], [190, 312], [196, 400], [262, H]], k(g, "page"));
    rich(g, "head", 20, 22, 142, 275, { max: 25, colour: k(g, "light"), caps: g.upper, lh: 1.04 });
    rich(g, "body", 20, 306, 150, 80, { font: "body", max: 9, weight: 400, colour: k(g, "light"), lh: 1.4 });
    rich(g, "foot", 22, 434, 160, 55, { max: 20, colour: k(g, "accent"), caps: g.upper });
  },
  // 7 We spent the 90s trying to look older
  nineties: (g) => {
    fill(g, "page");
    photoPoly(g, [[238, 0], [W, 0], [W, H], [226, H], [184, 60]], 184, 0, 216, H);
    poly(g, [[184, 58], [200, 52], [240, 0], [226, 0]], k(g, "dark"), { alpha: 0.9 });
    brush(g, 250, 498, 400, 436, 26, k(g, "accent"), 3);
    brush(g, 300, 502, 400, 462, 18, k(g, "accent"), 8);
    rich(g, "mast", 16, 14, 90, 28, { font: "body", max: 8.5, weight: 800, colour: k(g, "ink"), caps: true, lh: 1.15 });
    rect(g, 16, 48, 46, 1.4, k(g, "ink"));
    rich(g, "head", 16, 60, 172, 190, { max: 46, colour: k(g, "ink"), caps: g.upper });
    rich(g, "pink", 16, 262, 175, 80, { max: 30, colour: k(g, "accent"), caps: g.upper });
    rect(g, 16, 368, 132, 76, k(g, "dark"));
    rich(g, "box", 26, 378, 114, 60, { font: "body", max: 10, weight: 700, colour: k(g, "light"), lh: 1.28 });
    rect(g, 16, 455, 172, 1, k(g, "ink"));
    rich(g, "foot", 16, 464, 172, 18, { max: 15, colour: k(g, "ink"), caps: g.upper });
  },
  // 8 Your face is asymmetrical because you're a mammal
  asymmetrical: (g) => {
    fill(g, "page");
    poly(g, [[180, 430], ...arcPts(180, 430, 135, Math.PI, Math.PI * 1.5, 40)], k(g, "accent"));
    photoRect(g, 180, 0, 220, 430);
    rect(g, 309, 8, 1.2, 412, "rgba(255,255,255,0.85)");
    rect(g, 0, 430, W, 70, k(g, "dark"));
    rich(g, "head", 16, 38, 160, 180, { max: 38, colour: k(g, "ink"), caps: g.upper });
    rect(g, 16, 232, 150, 0.8, "rgba(0,0,0,0.25)");
    rich(g, "body", 16, 244, 150, 100, { font: "body", max: 9, weight: 600, colour: k(g, "ink"), lh: 1.3 });
    rect(g, 20, 444, 2, 42, k(g, "accent"));
    rich(g, "foot", 32, 444, 352, 44, { max: 16, colour: k(g, "light"), caps: g.upper, lh: 1.05 });
  },
  // 9 You don't hate your face, you might hate the camera
  camera: (g) => {
    fill(g, "page");
    rect(g, 135, 0, 258, 397, k(g, "dark"));
    crop(g, 146, 0, 80, 112, 2.4, 0.5, 0.3);
    crop(g, 230, 0, 75, 112, 3.0, 0.5, 0.6);
    crop(g, 309, 0, 78, 112, 2.6, 0.9, 0.5);
    photoRect(g, 146, 126, 240, 258);
    rect(g, 0, 397, W, 103, k(g, "dark"));
    rich(g, "head", 16, 62, 116, 90, { max: 34, colour: k(g, "ink"), caps: g.upper });
    rich(g, "red", 16, 160, 116, 120, { max: 36, colour: k(g, "accent"), caps: g.upper });
    bracket(g, 12, 12, 1, 1, 12, k(g, "accent"));
    bracket(g, 12, 386, 1, -1, 12, k(g, "accent"));
    rect(g, 16, 416, 1, 66, k(g, "accent"));
    rich(g, "body", 26, 414, 150, 76, { font: "body", max: 8.5, weight: 400, colour: k(g, "light"), lh: 1.3 });
    rich(g, "foot", 182, 424, 200, 66, { max: 22, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
  },
  // 10 Your favourite influencer isn't your anatomy
  influencer: (g) => {
    fill(g, "page");
    photoRect(g, 195, 0, 205, H);
    poly(g, [[0, 360], [212, 346], [212, H], [0, H]], k(g, "soft"));
    torn(g, [[40, H + 6], [58, 462], [W + 6, 318], [W + 6, H + 6]], k(g, "page"), 5, 2.2);
    torn(g, [[52, H + 6], [66, 470], [W + 6, 330], [W + 6, H + 6]], k(g, "dark"), 9, 1.6);
    rich(g, "head", 20, 28, 175, 175, { max: 34, colour: k(g, "ink"), hi: k(g, "accent"), caps: g.upper });
    rich(g, "body", 20, 230, 172, 96, { font: "body", max: 9.5, weight: 700, colour: k(g, "ink"), caps: true, lh: 1.32 });
    rect(g, 20, 330, 108, 138, k(g, "light"));
    circle(g, 74, 378, 21, k(g, "dark"));
    circle(g, 54, 366, 9, k(g, "dark"));
    poly(g, [[34, 458], [38, 420], [70, 404], [112, 418], [118, 458]], k(g, "dark"));
    rect(g, 24, 326, 38, 12, "rgba(210,200,170,0.8)");
    rich(g, "big", 204, 402, 190, 62, { max: 30, colour: k(g, "light"), caps: g.upper });
    rich(g, "small", 204, 462, 190, 14, { font: "body", max: 9, weight: 700, colour: k(g, "light"), caps: true });
  },
  // 11 Some aesthetic results are supposed to be boring
  boring: (g) => {
    fill(g, "page");
    g.mono = true;
    photoRect(g, 135, 22, 240, 455);
    g.mono = false;
    poly(g, [[0, 368], [135, 368], [108, 477], [0, 477]], k(g, "accent"));
    rect(g, 0, 477, W, 23, k(g, "accent"));
    rich(g, "head", 20, 50, 125, 150, { max: 28, colour: k(g, "ink"), caps: g.upper, lh: 1.05 });
    rich(g, "body", 20, 228, 125, 100, { font: "body", max: 9, weight: 500, colour: k(g, "ink"), lh: 1.35 });
    rich(g, "foot", 20, 394, 105, 60, { max: 17, colour: k(g, "light"), caps: g.upper });
  },
  // 12 Gatecrasher / oestrogen
  gatecrasher: (g) => {
    fill(g, "dark");
    photoRect(g, 196, 0, 204, H);
    rect(g, 192, 0, 4, 430, k(g, "accent"));
    rich(g, "head", 14, 26, 178, 285, { max: 36, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    const { ctx } = g;
    ctx.save(); ctx.strokeStyle = k(g, "accent"); ctx.lineWidth = 1; ctx.strokeRect(14, 326, 98, 64); ctx.restore();
    rich(g, "box", 22, 334, 84, 50, { font: "body", max: 10, weight: 600, colour: k(g, "accent"), lh: 1.25 });
    torn(g, [[-6, 428], [60, 418], [196, 408], [198, H + 6], [-6, H + 6]], k(g, "page"), 6, 2.6);
    rich(g, "foot", 14, 432, 176, 58, { max: 18, colour: k(g, "ink"), hi: k(g, "accent"), caps: g.upper });
  },
  // 13 Heather shimmer / lip hydration
  heather: (g) => {
    fill(g, "page");
    photoPoly(g, [[224, 0], [W, 0], [W, 424], [200, 424]], 200, 0, 200, 424);
    poly(g, [[0, 0], [218, 0], [196, 424], [0, 424]], k(g, "dark"));
    poly(g, [[218, 0], [226, 0], [204, 424], [196, 424]], k(g, "accent"));
    rich(g, "head", 16, 22, 174, 300, { max: 33, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rich(g, "body", 16, 340, 170, 60, { font: "body", max: 8, weight: 600, colour: k(g, "accent"), caps: true, lh: 1.4 });
    brush(g, 236, 502, 400, 440, 38, k(g, "accent"), 4);
    brush(g, 262, 506, 400, 466, 22, k(g, "accent"), 12);
    rich(g, "foot", 16, 440, 200, 50, { max: 20, colour: k(g, "ink"), caps: g.upper });
  },
  // 14 25-year-old knees
  knees: (g) => {
    fill(g, "page");
    photoRect(g, 185, 0, 215, H);
    rect(g, 0, 0, 185, 365, k(g, "page"));
    poly(g, [[0, 365], [165, 365], [232, H], [0, H]], k(g, "accent"));
    rich(g, "head", 16, 22, 168, 86, { max: 21, colour: k(g, "ink"), caps: g.upper, lh: 1.08 });
    rich(g, "head2", 16, 106, 170, 44, { max: 21, colour: k(g, "accent"), caps: g.upper, lh: 1.08 });
    big(g, g.t.big ?? "KNEES.", 12, 150, 235, 108, k(g, "accent"));
    rect(g, 16, 312, 150, 0.8, k(g, "ink"));
    rich(g, "body", 16, 322, 160, 40, { font: "body", max: 10, weight: 700, colour: k(g, "ink"), lh: 1.3 });
    rich(g, "foot", 16, 384, 158, 104, { max: 20, colour: k(g, "light"), caps: g.upper });
  },
  // 15 Your mum wasn't boring, she was knackered
  mum: (g) => {
    fill(g, "page");
    circle(g, 215, 8, 76, k(g, "accent"));
    const pts: P[] = [[300, 0], [W, 0], [W, H], [186, H], [190, 120], [236, 70]];
    torn(g, pts, "rgba(0,0,0,0)", 4, 2.4);
    photoPoly(g, jag(pts, 2.4, 4, 9), 186, 0, 214, H);
    rect(g, 0, 393, 190, 107, k(g, "accent"));
    rich(g, "head", 20, 52, 160, 168, { max: 25, colour: k(g, "ink"), caps: g.upper, lh: 1.08 });
    rich(g, "red", 20, 228, 160, 62, { max: 26, colour: k(g, "accent"), caps: g.upper });
    rich(g, "body", 20, 298, 160, 84, { font: "body", max: 9, weight: 500, colour: k(g, "ink"), lh: 1.4 });
    rich(g, "foot", 20, 406, 160, 76, { max: 18, colour: k(g, "light"), caps: g.upper });
  },
  // 16 The problem isn't your face, 700 edited faces
  kodak: (g) => {
    fill(g, "page");
    rect(g, 143, 4, 254, 384, k(g, "dark"));
    T2(g, "KODAK 400TX", 152, 8, 90, 9, 6, k(g, "light"), "left", 700);
    photoRect(g, 154, 20, 232, 354);
    poly(g, [[266, 262], [W, 246], [W, H], [276, H]], k(g, "dark"));
    poly(g, [[322, 262], [W, 252], [W, 272], [326, 280]], k(g, "accent"), { alpha: 0.95 });
    [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].forEach(([c, r], i) => crop(g, 286 + c * 56, 284 + r * 70, 52, 64, 2.2, 0.5, 0.3 + (i % 3) * 0.1, { grey: true }));
    poly(g, [[222, 400], [240, 400], [292, H], [222, H]], k(g, "accent"));
    rich(g, "head", 16, 26, 124, 100, { max: 26, colour: k(g, "ink"), caps: g.upper });
    rich(g, "orange", 16, 138, 124, 190, { max: 30, colour: k(g, "accent"), caps: g.upper });
    torn(g, [[10, 342], [182, 340], [178, 404], [12, 406]], k(g, "dark"), 7, 1.8);
    rich(g, "box", 20, 350, 154, 48, { font: "body", max: 7.8, weight: 500, colour: k(g, "light"), lh: 1.3 });
    rich(g, "foot", 16, 420, 235, 56, { max: 17, colour: k(g, "ink"), caps: g.upper });
  },
  // 17 There is nothing brave about refusing aesthetics
  refuse: (g) => {
    fill(g, "dark");
    photoRect(g, 178, 0, 222, 422);
    rect(g, 0, 422, W, 78, k(g, "page"));
    poly(g, [[0, 422], [92, 422], [164, H], [0, H]], k(g, "accent"));
    rich(g, "head", 24, 48, 146, 258, { max: 30, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rect(g, 24, 316, 52, 1.2, k(g, "accent"));
    rich(g, "body", 24, 328, 150, 76, { font: "body", max: 9.5, weight: 600, colour: k(g, "light"), lh: 1.32 });
    rich(g, "foot", 208, 436, 180, 44, { max: 20, colour: k(g, "ink"), caps: g.upper });
    rect(g, 208, 480, 30, 1.4, k(g, "accent"));
    crosshair(g, 14, 18, 4, k(g, "light"));
    crosshair(g, 384, 470, 4, k(g, "ink"));
  },
  // 18 Biggest lie women are sold about getting older
  "biggest-lie": (g) => {
    fill(g, "dark");
    photoRect(g, 0, 0, 152, 422);
    big(g, g.t.mark ?? "?", 250, 28, 160, 330, k(g, "accent"));
    rich(g, "head", 166, 32, 130, 290, { max: 40, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    const items = (g.t.list ?? "").split("\n").filter(Boolean);
    items.slice(0, 4).forEach((s, i) => {
      rect(g, 168, 348 + i * 17, 2, 11, k(g, "accent"));
      T2(g, s.toUpperCase(), 176, 347 + i * 17, 220, 13, 8.3, k(g, "light"), "left", 700);
    });
    rect(g, 0, 422, W, 78, k(g, "accent"));
    rich(g, "foot", 0, 428, W, 64, { max: 58, colour: k(g, "dark"), align: "center", caps: g.upper });
  },
  // 19 Which 90s smell
  smell: (g) => {
    fill(g, "dark");
    photoPoly(g, [[192, 0], [372, 0], [372, H], [186, H]], 186, 0, 190, H);
    rect(g, 372, 0, 28, 300, "rgba(230,215,200,0.35)");
    poly(g, [[184, H], [194, 398], [300, 372], [W, 376], [W, H]], "rgba(200,170,230,0.55)");
    rect(g, 304, 282, 94, 118, k(g, "light"));
    crop(g, 311, 290, 80, 84, 2.0, 0.5, 0.5, { grey: true });
    rect(g, 342, 274, 28, 14, "rgba(215,200,170,0.85)");
    rich(g, "head", 20, 22, 168, 228, { max: 31, colour: k(g, "light"), caps: g.upper, lh: 1.02 });
    const items = (g.t.list ?? "").split("\n").filter(Boolean);
    let yy = 262;
    items.slice(0, 6).forEach((s, i) => {
      const two = s.length > 22;
      rt(g, s, 20, yy, 165, two ? 26 : 14, { font: "body", max: 10.5, weight: 600, colour: k(g, "light"), caps: true, lh: 1.15 });
      yy += two ? 32 : 22;
      if (i < items.length - 1) rect(g, 20, yy - 7, 160, 0.6, "rgba(255,255,255,0.45)");
    });
    rect(g, 20, 437, 158, 44, k(g, "soft"));
    rich(g, "box", 28, 444, 144, 32, { font: "body", max: 11, weight: 800, colour: k(g, "ink"), caps: true, lh: 1.18 });
    const { ctx } = g;
    ctx.save(); ctx.translate(250, 462); ctx.rotate(-0.12); rich(g, "cap", 0, 0, 120, 22, { max: 15, weight: 400, colour: k(g, "dark"), lh: 1 }); ctx.restore();
  },
  // 20 What song makes you abandon your handbag
  playlist: (g) => {
    fill(g, "dark");
    rect(g, 190, 0, 210, H, "#0a0a0f");
    photoRect(g, 206, 12, 186, 298);
    const { ctx } = g;
    ctx.save(); ctx.strokeStyle = k(g, "accent"); ctx.lineWidth = 1.2;
    ctx.strokeRect(205, 11, 188, 300); ctx.strokeRect(194, 318, 100, 168); ctx.strokeRect(300, 328, 96, 158); ctx.restore();
    crop(g, 196, 320, 96, 164, 2.4, 0.4, 0.5);
    crop(g, 302, 330, 92, 154, 2.8, 0.6, 0.8);
    rich(g, "head", 14, 38, 176, 210, { max: 27, colour: k(g, "light"), caps: g.upper });
    rich(g, "small", 14, 286, 130, 56, { font: "body", max: 10, weight: 600, colour: k(g, "accent"), lh: 1.4 });
    poly(g, [[0, 378], [164, 376], [160, H], [0, H]], k(g, "accent"));
    rich(g, "foot", 16, 396, 140, 92, { max: 22, colour: k(g, "light"), caps: g.upper });
  },
  // 21 Your face isn't suddenly ugly, your algorithm changed
  algorithm: (g) => {
    fill(g, "dark");
    rect(g, 184, 0, 216, H, "#111");
    crop(g, 180, 0, 100, 76, 2.4, 0.5, 0.3);
    crop(g, 286, 0, 114, 76, 3.0, 0.4, 0.4);
    photoRect(g, 192, 92, 190, 290);
    crop(g, 224, 388, 100, 112, 2.6, 0.5, 0.6);
    crop(g, 328, 380, 72, 120, 3.2, 0.7, 0.5);
    const { ctx } = g;
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.4; ctx.strokeRect(188, 88, 198, 298); ctx.restore();
    rich(g, "head", 18, 40, 160, 130, { max: 32, colour: k(g, "light"), caps: g.upper });
    rect(g, 18, 180, 162, 96, k(g, "accent"));
    rich(g, "lime", 26, 188, 148, 82, { max: 30, colour: k(g, "dark"), caps: g.upper });
    rich(g, "body", 28, 286, 150, 100, { font: "body", max: 9, weight: 400, colour: k(g, "light"), lh: 1.35 });
    torn(g, [[-6, 398], [100, 400], [206, 394], [210, H + 6], [-6, H + 6]], k(g, "page"), 3, 2.6);
    rich(g, "foot", 18, 414, 175, 76, { max: 19, colour: k(g, "ink"), caps: g.upper });
  },
  // 22 A 48-year-old woman looking 48
  "forty-eight": (g) => {
    fill(g, "page");
    photoRect(g, 132, 175, 268, 325);
    rich(g, "head", 16, 16, 345, 156, { max: 46, colour: k(g, "ink"), caps: g.upper, lh: 1.0 });
    rich(g, "body", 18, 204, 108, 138, { font: "body", max: 9.5, weight: 500, colour: k(g, "ink"), lh: 1.38 });
    rect(g, 0, 348, 132, 152, k(g, "accent"));
    rich(g, "foot", 16, 400, 108, 70, { max: 15, colour: k(g, "light"), caps: g.upper });
    T2(g, "03|", 366, 14, 24, 10, 6.5, k(g, "ink"), "left", 600);
  },
  // 23 Women get criticised for ageing
  criticised: (g) => {
    fill(g, "dark");
    photoRect(g, 208, 0, 192, H);
    rich(g, "head", 20, 24, 186, 292, { max: 30, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rect(g, 20, 328, 172, 0.8, "rgba(255,255,255,0.4)");
    rect(g, 0, 338, 28, 102, k(g, "accent"));
    rich(g, "body", 42, 342, 150, 100, { font: "body", max: 9.5, weight: 400, colour: k(g, "light"), hi: k(g, "light"), lh: 1.3 });
    rect(g, 20, 448, 172, 0.8, "rgba(255,255,255,0.4)");
    rect(g, 0, 452, 292, 34, k(g, "page"));
    rich(g, "foot", 0, 460, 292, 20, { max: 17, colour: k(g, "ink"), align: "center", caps: g.upper });
  },
  // 24 A good practitioner loses money saying NO
  no: (g) => {
    fill(g, "page");
    big(g, g.t.big ?? "NO.", 168, 8, 232, 235, k(g, "ink"));
    rich(g, "head", 14, 28, 152, 118, { max: 27, colour: k(g, "ink"), caps: g.upper, lh: 1.05 });
    rect(g, 14, 172, 138, 3, k(g, "accent"));
    photoPoly(g, [[236, 218], [W, 218], [W, H], [92, H]], 92, 218, 308, 282);
    rich(g, "body", 14, 206, 170, 150, { font: "body", max: 11, weight: 600, colour: k(g, "ink"), lh: 1.3 });
    rich(g, "foot", 14, 388, 140, 90, { max: 15, colour: k(g, "accent"), caps: g.upper });
  },
  // 25 If every consultation ends in treatment
  consultation: (g) => {
    fill(g, "dark");
    photoRect(g, 186, 0, 214, H);
    torn(g, [[168, -6], [194, -6], [194, H + 6], [168, H + 6]], k(g, "accent"), 2, 2.4);
    rich(g, "head", 16, 34, 148, 188, { max: 29, colour: k(g, "light"), caps: g.upper, lh: 1.02 });
    rect(g, 16, 228, 58, 1.4, k(g, "accent"));
    rich(g, "body", 16, 238, 150, 108, { font: "body", max: 9, weight: 400, colour: k(g, "light"), lh: 1.35 });
    torn(g, [[8, 352], [166, 348], [164, 496], [10, 498]], k(g, "accent"), 8, 2);
    rich(g, "foot", 24, 366, 136, 80, { max: 19, colour: k(g, "dark"), caps: g.upper });
    barcode(g, 24, 462, 128, 22, k(g, "dark"));
  },
  // 26 Plot twist: we got hotter
  hotter: (g) => {
    fill(g, "dark");
    photoPoly(g, [[194, 0], [W, 0], [W, 425], [150, 425]], 150, 0, 250, 425);
    poly(g, [[0, 0], [194, 0], [166, 236], [0, 236]], k(g, "page"));
    rich(g, "head", 14, 14, 168, 205, { max: 42, colour: k(g, "ink"), caps: g.upper, lh: 1.0 });
    rich(g, "small", 14, 252, 140, 36, { font: "body", max: 7.8, weight: 800, colour: k(g, "light"), caps: true, lh: 1.3 });
    rich(g, "big", 12, 284, 150, 46, { max: 40, colour: k(g, "accent"), caps: g.upper });
    rect(g, 14, 336, 50, 1.4, k(g, "soft"));
    rich(g, "body", 14, 348, 138, 70, { font: "body", max: 8.2, weight: 800, colour: k(g, "light"), caps: true, lh: 1.3 });
    rect(g, 0, 425, W, 75, k(g, "dark"));
    rect(g, 0, 425, 100, 75, k(g, "accent"));
    crop(g, 0, 425, 100, 75, 3.0, 0.5, 0.8, { grey: true });
    rect(g, 0, 425, 100, 75, "rgba(200,30,40,0.55)");
    rect(g, 365, 429, 35, 71, k(g, "soft"));
    rich(g, "band1", 110, 436, 250, 24, { max: 22, colour: k(g, "light"), caps: g.upper });
    rich(g, "band2", 110, 462, 250, 24, { max: 22, colour: k(g, "accent"), caps: g.upper });
  },
  // 27 Things that got hotter after 40
  "list-hotter": (g) => {
    fill(g, "dark");
    poly(g, [[300, 0], [W, 0], [W, 58]], k(g, "page"));
    photoPoly(g, [[140, 130], [236, 94], [W, 94], [W, 300], [364, 402], [140, 402]], 140, 94, 260, 308);
    poly(g, [[348, 402], [W, 334], [W, 432], [376, 432]], k(g, "soft"));
    poly(g, [[320, 392], [352, 378], [376, 432], [346, 436]], k(g, "soft"));
    rich(g, "head", 14, 8, 280, 120, { max: 42, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    poly(g, [[0, 128], [140, 128], [140, 402], [0, 402]], k(g, "page"));
    const items = (g.t.list ?? "").split("\n").filter(Boolean);
    let yy = 142;
    items.slice(0, 7).forEach((s) => {
      const two = s.length > 18;
      rect(g, 16, yy + (two ? 26 : 15), 14, 1.8, k(g, "accent"));
      rt(g, s, 16, yy, 118, two ? 24 : 13, { font: "body", max: 10.4, weight: 800, colour: k(g, "ink"), caps: true, lh: 1.18 });
      yy += two ? 36 : 28;
    });
    rich(g, "foot", 14, 410, 326, 82, { max: 24, colour: k(g, "soft"), caps: g.upper });
  },
  // 28 At 25 I wanted everyone to think I was hot
  at25: (g) => {
    fill(g, "page");
    photoRect(g, 148, 0, 252, 392);
    poly(g, [[0, 148], [190, 182], [190, 392], [0, 392]], k(g, "dark"));
    rect(g, 0, 0, 148, 148, k(g, "page"));
    rect(g, 6, 18, 3, 52, k(g, "dark"));
    rich(g, "head", 18, 18, 125, 100, { max: 17, colour: k(g, "ink"), caps: g.upper });
    rich(g, "red", 14, 204, 172, 170, { max: 40, colour: k(g, "accent"), caps: g.upper });
    rect(g, 18, 404, 22, 78, k(g, "soft"));
    rich(g, "body", 48, 410, 120, 74, { font: "body", max: 11.5, weight: 700, colour: k(g, "ink"), lh: 1.2 });
    rect(g, 176, 412, 1, 70, k(g, "ink"));
    rich(g, "foot", 190, 414, 200, 72, { max: 24, colour: k(g, "accent"), caps: g.upper });
  },
  // 29 Nobody warned us about this part of midlife
  "nobody-warned": (g) => {
    fill(g, "dark");
    photoPoly(g, [[252, 18], [W, 18], [W, 423], [150, 423]], 150, 18, 250, 405);
    poly(g, [[300, 0], [W, 0], [W, 20], [330, 20]], k(g, "page"));
    poly(g, [[0, 240], [212, 240], [166, 423], [0, 423]], k(g, "page"));
    rect(g, 0, 423, 360, 77, k(g, "accent"));
    poly(g, [[W, 315], [W, H], [334, H]], k(g, "soft"));
    rich(g, "head", 14, 14, 190, 150, { max: 40, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper });
    rect(g, 14, 196, 40, 1.6, k(g, "accent"));
    rich(g, "line", 14, 206, 190, 34, { font: "body", max: 13, weight: 700, colour: k(g, "light"), lh: 1.2 });
    const items = (g.t.list ?? "").split("\n").filter(Boolean);
    let yy = 254;
    items.slice(0, 4).forEach((s, i) => {
      const lines = i === 3 ? 4 : i === 2 ? 2 : 2;
      rect(g, 14, yy + 2, 2.4, lines * 11 - 3, k(g, "accent"));
      rt(g, s, 24, yy, 160, lines * 11, { font: "body", max: 10, weight: 600, colour: k(g, "ink"), lh: 1.2 });
      yy += lines * 11 + 11;
    });
  },
  // 30 We survived frosted lipstick
  "built-different": (g) => {
    fill(g, "page");
    photoPoly(g, [[196, 0], [W, 0], [W, H], [176, H]], 150, 0, 250, H);
    poly(g, [[0, 0], [196, 0], [176, 268], [0, 268]], k(g, "dark"));
    rect(g, 0, 288, 13, 164, k(g, "soft"));
    rect(g, 0, 455, 210, 45, k(g, "accent"));
    rich(g, "head", 10, 12, 164, 250, { max: 36, colour: k(g, "light"), hi: k(g, "accent"), caps: g.upper, lh: 0.98 });
    rich(g, "big", 30, 300, 150, 56, { max: 25, colour: k(g, "ink"), caps: g.upper });
    rich(g, "body", 30, 362, 152, 88, { font: "body", max: 9.5, weight: 600, colour: k(g, "ink"), lh: 1.28 });
    rich(g, "foot", 14, 466, 190, 24, { max: 19, colour: k(g, "light"), caps: g.upper });
  },
};
