// Empower layouts 16 to 30. All coordinates are in a 400 x 500 space.
import {
  W, H, arcPts, archPts, brush, card, circle, crop, Hd, k, photoCircle, photoPoly, photoRect, poly, rect, rows, split,
  sprockets, T, T2, torn, tx,
  type EG,
} from "./empower-kit";
import type { Layout } from "./empower-layouts-a";

const fill = (g: EG, key: "page" | "dark" | "accent" | "soft" | "ink" | "light") => rect(g, 0, 0, W, H, k(g, key));

export const LAYOUTS_B: Record<string, Layout> = {
  // 16
  afterparty: (g) => {
    fill(g, "dark");
    rect(g, 0, 0, W, 250, k(g, "soft"));
    Hd(g, "q1", 24, 28, 352, 90, { max: 32, colour: k(g, "dark") });
    Hd(g, "q2", 24, 130, 352, 90, { max: 32, colour: k(g, "dark") });
    photoCircle(g, 110, 340, 88);
    Hd(g, "word", 206, 300, 176, 80, { max: 44, colour: k(g, "accent") });
    T(g, "foot", 24, 450, 352, 36, { max: 15, colour: k(g, "light"), weight: 600, align: "center" });
  },
  // 17
  knees: (g) => {
    fill(g, "accent");
    Hd(g, "head", 24, 28, 352, 120, { max: 52, colour: k(g, "dark") });
    photoCircle(g, 200, 320, 130);
    circle(g, 330, 440, 44, k(g, "dark"));
    T(g, "tag", 288, 424, 84, 34, { max: 13, colour: k(g, "light"), weight: 800, align: "center" });
    T(g, "foot", 24, 462, 250, 28, { max: 14, colour: k(g, "dark"), weight: 700 });
  },
  // 18
  mum: (g) => {
    fill(g, "page");
    circle(g, 200, 300, 150, k(g, "accent"));
    photoCircle(g, 200, 300, 136);
    Hd(g, "head", 24, 24, 352, 110, { max: 36, colour: k(g, "ink"), align: "center" });
    T(g, "foot", 24, 458, 352, 30, { max: 16, colour: k(g, "accent"), weight: 800, align: "center" });
  },
  // 19
  kodak: (g) => {
    fill(g, "accent");
    rect(g, 24, 30, 352, 330, k(g, "dark"));
    sprockets(g, 24, 36, 352, true, k(g, "accent"), 6, 14);
    sprockets(g, 24, 346, 352, true, k(g, "accent"), 6, 14);
    photoRect(g, 40, 54, 320, 280);
    Hd(g, "head", 24, 378, 352, 60, { max: 28, colour: k(g, "dark") });
    T(g, "sub", 24, 442, 352, 44, { max: 18, colour: k(g, "dark"), weight: 800 });
  },
  // 20
  refuse: (g) => {
    fill(g, "dark");
    poly(g, [[0, 250], [W, 200], [W, H], [0, H]], k(g, "accent"));
    photoRect(g, 200, 40, 176, 220);
    Hd(g, "head", 24, 40, 170, 200, { max: 30, colour: k(g, "light") });
    T(g, "sub", 24, 290, 352, 110, { max: 20, colour: k(g, "dark"), weight: 700 });
    T(g, "foot", 24, 430, 352, 40, { max: 18, colour: k(g, "dark"), weight: 800 });
  },
  // 21
  "biggest-lie": (g) => {
    fill(g, "accent");
    Hd(g, "mark", 60, 40, 280, 330, { max: 330, colour: k(g, "dark"), align: "center" });
    Hd(g, "head", 24, 340, 352, 80, { max: 32, colour: k(g, "dark"), align: "center" });
    rect(g, 24, 436, 352, 46, k(g, "dark"));
    T(g, "close", 28, 446, 344, 28, { max: 22, colour: k(g, "accent"), weight: 800, align: "center" });
  },
  // 22
  confess: (g) => {
    fill(g, "accent");
    Hd(g, "head", 24, 28, 352, 140, { max: 36, colour: k(g, "light") });
    rect(g, 0, 190, W, 130, k(g, "dark"));
    sprockets(g, 0, 194, W, true, k(g, "accent"), 5, 11);
    sprockets(g, 0, 310, W, true, k(g, "accent"), 5, 11);
    for (let i = 0; i < 3; i++) crop(g, 14 + i * 126, 204, 118, 98, 2.2, 0.5, 0.22 + i * 0.03);
    // the real, draggable photo sits big underneath the strip
    photoRect(g, 100, 336, 200, 92);
    Hd(g, "close", 24, 446, 352, 44, { max: 34, colour: k(g, "dark"), align: "center" });
  },
  // 23
  smell: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 26, 352, 90, { max: 30, colour: k(g, "light") });
    card(g, 24, 134, 180, 190, k(g, "soft"));
    T(g, "box", 34, 146, 160, 166, { max: 17, colour: k(g, "ink"), weight: 700 });
    card(g, 218, 150, 158, 236, k(g, "light"));
    photoRect(g, 228, 160, 138, 170);
    T(g, "cap", 224, 340, 146, 38, { max: 15, colour: k(g, "ink"), weight: 700, align: "center", font: "hand" });
    T(g, "foot", 24, 414, 352, 70, { max: 18, colour: k(g, "accent"), weight: 800 });
  },
  // 24
  playlist: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 28, 352, 110, { max: 32, colour: k(g, "light") });
    rect(g, 24, 160, 352, 220, k(g, "accent"));
    sprockets(g, 24, 164, 352, true, k(g, "dark"), 6, 14);
    sprockets(g, 24, 370, 352, true, k(g, "dark"), 6, 14);
    photoRect(g, 40, 182, 320, 176);
    T(g, "foot", 24, 404, 352, 80, { max: 20, colour: k(g, "light"), weight: 700, align: "center" });
  },
  // 25
  algorithm: (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 28, 352, 130, { max: 34, colour: k(g, "light") });
    photoRect(g, 30, 180, 190, 240);
    const { ctx } = g;
    crop(g, 236, 196, 134, 100, 1.8, 0.5, 0.3);
    crop(g, 236, 306, 134, 114, 2.4, 0.4, 0.2);
    rect(g, 236, 292, 134, 4, k(g, "accent"));
    rect(g, 30, 424, 190, 6, k(g, "accent"));
    ctx.save(); ctx.restore();
    T(g, "foot", 24, 440, 352, 46, { max: 18, colour: k(g, "accent"), weight: 800 });
  },
  // 26
  hotter: (g) => {
    fill(g, "dark");
    T(g, "kicker", 24, 28, 352, 28, { max: 20, colour: k(g, "soft"), weight: 700 });
    Hd(g, "head", 24, 60, 352, 100, { max: 46, colour: k(g, "light") });
    Hd(g, "big", 24, 170, 352, 110, { max: 100, colour: k(g, "accent") });
    photoCircle(g, 300, 380, 82);
    T(g, "body", 24, 310, 200, 170, { max: 19, colour: k(g, "light"), weight: 600 });
  },
  // 27
  "list-hotter": (g) => {
    fill(g, "page");
    Hd(g, "head", 24, 26, 352, 90, { max: 34, colour: k(g, "ink") });
    rows(g, split(g, "list"), 24, 126, 220, 34, 17, k(g, "ink"), { bullet: k(g, "accent"), weight: 700 });
    photoRect(g, 262, 126, 114, 240);
    rect(g, 0, 400, W, 100, k(g, "dark"));
    T(g, "close", 24, 412, 352, 76, { max: 18, colour: k(g, "light"), weight: 700, align: "center" });
  },
  // 28
  at25: (g) => {
    fill(g, "page");
    rect(g, 0, 0, W, 250, k(g, "dark"));
    Hd(g, "top", 24, 30, 352, 150, { max: 32, colour: k(g, "light") });
    photoCircle(g, 200, 250, 70);
    Hd(g, "bottom", 24, 340, 352, 80, { max: 32, colour: k(g, "accent"), align: "center" });
    T(g, "body", 40, 424, 320, 60, { max: 15, colour: k(g, "ink"), weight: 600, align: "center" });
  },
  // 29
  "nobody-warned": (g) => {
    fill(g, "dark");
    Hd(g, "head", 24, 28, 352, 100, { max: 32, colour: k(g, "light") });
    rows(g, split(g, "list"), 24, 140, 206, 70, 17, k(g, "light"), { bullet: k(g, "accent"), weight: 600 });
    photoRect(g, 240, 140, 136, 220);
    rect(g, 24, 400, 352, 4, k(g, "accent"));
    T(g, "close", 24, 414, 352, 70, { max: 18, colour: k(g, "accent"), weight: 800 });
  },
  // 30
  "built-different": (g) => {
    fill(g, "page");
    rect(g, 0, 0, W, 90, k(g, "accent"));
    T(g, "head", 24, 14, 352, 64, { max: 17, colour: k(g, "light"), weight: 700, align: "center" });
    photoRect(g, 24, 110, 352, 230);
    Hd(g, "big", 24, 352, 352, 70, { max: 52, colour: k(g, "ink"), align: "center" });
    T(g, "body", 30, 424, 340, 64, { max: 14, colour: k(g, "ink"), weight: 600, align: "center" });
  },
};
