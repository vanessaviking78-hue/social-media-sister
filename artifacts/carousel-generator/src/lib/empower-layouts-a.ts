// Empower layouts 1 to 15. All coordinates are in a 400 x 500 space.
import {
  W, H, arcPts, archPts, brush, card, circle, crop, dashed, Hd, k, photoCircle, photoPoly, photoRect, poly, rect, rows, split,
  sprockets, T, T2, tone, torn, tx, zigPts, jag, upright,
  type EG, type P,
} from "./empower-kit";

export type Layout = (g: EG) => void;
const fill = (g: EG, key: "page" | "dark" | "accent" | "soft" | "ink" | "light") => rect(g, 0, 0, W, H, k(g, key));

export const LAYOUTS_A: Record<string, Layout> = {
  // 1
  "group-project": (g) => {
    fill(g, "page");
    photoPoly(g, [[150, 0], [W, 0], [W, 390], [60, 390]], 60, 0, 340, 390);
    poly(g, [[0, 0], [215, 0], [120, 390], [0, 390]], k(g, "dark"));
    rect(g, 0, 390, W, 5, k(g, "accent"));
    Hd(g, "head", 16, 40, 118, 300, { max: 40, colour: k(g, "light") });
    T(g, "sub", 24, 408, 352, 70, { max: 20, colour: k(g, "ink"), weight: 700 });
  },
  // 2
  "whats-gone": (g) => {
    fill(g, "page");
    Hd(g, "head", 24, 26, 352, 70, { max: 34, colour: k(g, "ink") });
    const cells: ["dark" | "accent" | "soft", string, string][] = [["dark", "a", "light"], ["accent", "b", "light"], ["soft", "c", "ink"], ["dark", "d", "light"]];
    cells.forEach(([bgk, key, fg], i) => {
      const x = 24 + (i % 2) * 176, y = 108 + Math.floor(i / 2) * 156;
      const sw = i === 1 || i === 2;
      rect(g, x, y, 176, 156, k(g, sw ? (i === 1 ? "accent" : "soft") : "dark"));
      T2(g, `0${i + 1}.`, x + 14, y + 12, 60, 20, 16, k(g, fg as "light" | "ink"), "left", 700);
      Hd(g, key, x + 12, y + 70, 152, 70, { max: 34, colour: k(g, fg as "light" | "ink") });
    });
    rect(g, 0, 440, W, 60, k(g, "accent"));
    T(g, "foot", 24, 454, 352, 36, { max: 24, colour: k(g, "light"), weight: 800, align: "center" });
  },
  // 3
  "film-title": (g) => {
    fill(g, "dark");
    poly(g, [[W, 0], [W, 230], [250, 0]], k(g, "accent"));
    Hd(g, "head", 24, 36, 290, 170, { max: 34, colour: k(g, "light") });
    photoRect(g, 24, 250, 170, 220);
    const { ctx } = g;
    ctx.save(); ctx.translate(290, 360); ctx.rotate(-0.05);
    card(g, -86, -92, 172, 184, k(g, "soft"));
    poly(g, [[-86, -92], [-40, -92], [-86, -46]], k(g, "accent"));
    T2(g, "Q:", -82, -88, 30, 20, 13, k(g, "light"), "left", 800);
    ctx.restore();
    // note text sits on the card (drawn upright for easy fitting)
    T(g, "note", 218, 290, 144, 120, { max: 17, colour: k(g, "ink"), weight: 700, align: "center" });
    T(g, "foot", 210, 464, 170, 28, { max: 12, colour: k(g, "light"), align: "center" });
  },
  // 4
  thousand: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 26, 352, 100, { max: 40, colour: k(g, "accent") });
    photoPoly(g, archPts(24, 140, 170, 320), 24, 140, 170, 320);
    rows(g, split(g, "list"), 212, 150, 170, 38, 17, k(g, "light"), { bullet: k(g, "accent"), weight: 700 });
    rect(g, 212, 400, 170, 50, k(g, "accent"));
    T(g, "button", 216, 412, 162, 30, { max: 17, colour: k(g, "dark"), weight: 800, align: "center" });
  },
  // 5
  receipt: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 26, 352, 90, { max: 30, colour: k(g, "light") });
    photoRect(g, 24, 134, 150, 200);
    const pts = zigPts(196, 124, 180, 340, 14);
    poly(g, pts, k(g, "light"), { shadow: true });
    T2(g, tx(g, "rtitle"), 206, 138, 160, 24, 16, k(g, "ink"), "center", 800);
    dashed(g, 208, 168, 364, 168, k(g, "ink"), 0.8);
    rows(g, split(g, "items"), 208, 178, 156, 30, 13, k(g, "ink"), { weight: 600 });
    dashed(g, 208, 392, 364, 392, k(g, "ink"), 0.8);
    T(g, "total", 206, 402, 160, 48, { max: 20, colour: k(g, "accent"), weight: 800, align: "center" });
    T(g, "foot", 24, 366, 160, 90, { max: 14, colour: k(g, "soft"), weight: 600 });
  },
  // 6
  "grown-to-love": (g) => {
    fill(g, "page");
    circle(g, 270, 330, 170, k(g, "accent"));
    photoCircle(g, 258, 318, 128);
    Hd(g, "head", 24, 28, 340, 130, { max: 38, colour: k(g, "ink") });
    rect(g, 24, 430, 130, 34, k(g, "dark"));
    T(g, "tag", 28, 436, 122, 22, { max: 14, colour: k(g, "light"), weight: 700, align: "center" });
  },
  // 7
  terrified: (g) => {
    fill(g, "page");
    T(g, "head", 30, 24, 340, 70, { max: 22, colour: k(g, "ink"), weight: 700, align: "center" });
    circle(g, 200, 235, 124, k(g, "dark"));
    photoCircle(g, 200, 235, 112);
    poly(g, [[0, 430], [90, 380], [W, 420], [W, H], [0, H]], k(g, "soft"));
    Hd(g, "close", 24, 410, 352, 80, { max: 38, colour: k(g, "accent"), align: "center" });
  },
  // 8
  nineties: (g) => {
    fill(g, "page");
    rect(g, 0, 0, W, 38, k(g, "dark"));
    T(g, "mast", 14, 10, 372, 20, { max: 13, colour: k(g, "light"), weight: 700, align: "center" });
    photoRect(g, 22, 56, 356, 380);
    rect(g, 22, 56, 356, 380, "rgba(0,0,0,0.0)");
    rect(g, 22, 330, 356, 106, "rgba(0,0,0,0.38)");
    Hd(g, "head", 36, 338, 330, 90, { max: 34, colour: k(g, "light") });
    T(g, "line1", 22, 446, 356, 22, { max: 14, colour: k(g, "accent"), weight: 800, align: "center" });
    T(g, "line2", 22, 470, 356, 22, { max: 12, colour: k(g, "ink"), weight: 600, align: "center" });
  },
  // 9
  asymmetrical: (g) => {
    fill(g, "page");
    poly(g, [[0, 0], ...arcPts(0, 0, 260, 0, Math.PI / 2)], k(g, "accent"));
    photoRect(g, 100, 110, 200, 280);
    dashed(g, 200, 60, 200, 450, k(g, "dark"), 1.2, [5, 4]);
    Hd(g, "head", 20, 18, 190, 90, { max: 22, colour: k(g, "light") });
    T(g, "left", 24, 400, 160, 30, { max: 14, colour: k(g, "ink"), weight: 700, align: "center" });
    T(g, "right", 216, 400, 160, 30, { max: 14, colour: k(g, "ink"), weight: 700, align: "center" });
    T(g, "foot", 24, 450, 352, 36, { max: 16, colour: k(g, "dark"), weight: 800, align: "center" });
  },
  // 10
  camera: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 30, 352, 120, { max: 32, colour: k(g, "light") });
    rect(g, 0, 175, W, 160, k(g, "ink"));
    sprockets(g, 0, 180, W, true, k(g, "dark"));
    sprockets(g, 0, 322, W, true, k(g, "dark"));
    const cs: [number, number, number, number][] = [[1.0, 0.5, 0.3, 0], [1.5, 0.2, 0.2, 0], [1.2, 0.8, 0.4, 0]];
    cs.forEach(([z, fx, fy], i) => crop(g, 16 + i * 126, 192, 118, 126, z, fx, fy));
    T(g, "foot", 24, 366, 352, 100, { max: 22, colour: k(g, "accent"), weight: 700, align: "center" });
  },
  // 11
  influencer: (g) => {
    fill(g, "accent");
    Hd(g, "head", 24, 28, 352, 100, { max: 32, colour: k(g, "dark") });
    card(g, 24, 150, 164, 230, k(g, "light"));
    circle(g, 106, 250, 38, tone(g, "soft", 0.0));
    poly(g, [[44, 380], [44, 330], [106, 296], [168, 330], [168, 380]], k(g, "soft"));
    photoRect(g, 212, 150, 164, 230);
    T(g, "labelA", 24, 388, 164, 24, { max: 14, colour: k(g, "dark"), weight: 800, align: "center" });
    T(g, "labelB", 212, 388, 164, 24, { max: 14, colour: k(g, "dark"), weight: 800, align: "center" });
    torn(g, [[220, H + 6], [W + 6, H + 6], [W + 6, 420], [300, 436]], k(g, "dark"), 7);
    T(g, "foot", 24, 430, 250, 54, { max: 15, colour: k(g, "dark"), weight: 700 });
  },
  // 12
  boring: (g) => {
    fill(g, "page");
    g.mono = true;
    photoRect(g, 0, 0, W, 340);
    g.mono = false;
    torn(g, [[-6, 318], [W + 6, 304], [W + 6, H + 6], [-6, H + 6]], k(g, "accent"), 12, 2.6);
    Hd(g, "head", 24, 336, 352, 100, { max: 34, colour: k(g, "light") });
    T(g, "sub", 24, 442, 352, 44, { max: 15, colour: k(g, "light"), weight: 600 });
  },
  // 13
  gatecrasher: (g) => {
    fill(g, "dark");
    photoRect(g, 214, 40, 160, 210);
    Hd(g, "word1", 20, 60, 190, 60, { max: 40, colour: k(g, "light") });
    torn(g, [[-6, 270], [W + 6, 252], [W + 6, 372], [-6, 388]], k(g, "accent"), 3, 2.8);
    Hd(g, "word2", 22, 286, 356, 80, { max: 66, colour: k(g, "dark") });
    T(g, "body", 24, 400, 352, 60, { max: 17, colour: k(g, "light"), weight: 600 });
    T(g, "foot", 24, 466, 352, 24, { max: 13, colour: k(g, "accent"), weight: 800 });
  },
  // 14
  heather: (g) => {
    fill(g, "page");
    brush(g, 10, 74, 390, 62, 84, k(g, "accent"), 5);
    Hd(g, "head", 24, 40, 352, 70, { max: 44, colour: k(g, "light") });
    T(g, "sub", 28, 128, 344, 32, { max: 20, colour: k(g, "ink"), weight: 700, align: "center" });
    photoPoly(g, archPts(70, 176, 260, 270), 70, 176, 260, 270);
    T(g, "foot", 24, 456, 352, 30, { max: 14, colour: k(g, "dark"), weight: 700, align: "center" });
  },
  // 15
  commas: (g) => {
    fill(g, "page");
    Hd(g, "head", 24, 28, 352, 100, { max: 38, colour: k(g, "ink") });
    rect(g, 0, 150, W, 124, k(g, "accent"));
    sprockets(g, 0, 154, W, true, k(g, "light"), 4, 9);
    sprockets(g, 0, 266, W, true, k(g, "light"), 4, 9);
    for (let i = 0; i < 5; i++) {
      crop(g, 12 + i * 77, 166, 71, 90, 2.4, 0.5, 0.2 + i * 0.02);
      T2(g, `97/0${i + 1}`, 12 + i * 77, 258, 71, 10, 7, k(g, "light"), "center", 700);
    }
    T(g, "body", 24, 300, 352, 120, { max: 20, colour: k(g, "ink"), weight: 600 });
    T(g, "foot", 24, 440, 352, 40, { max: 20, colour: k(g, "accent"), weight: 800 });
  },
};
