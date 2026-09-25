// Draws the five Magazine Post pages onto 1080 x 1440 canvases:
//   1. cover (the treatment name is the title)
//   2, 3, 4. fact pages
//   5. full photo page with "If this interests you, comment WORD"
// Shares its drawing helpers, photo frames and drag hit testing with Magazine Maker.

import {
  PAGE_W,
  PAGE_H,
  SERIF,
  SANS,
  CREAM,
  INK,
  onColour,
  newCanvas,
  drawCover,
  block,
  footer,
  beginDraw,
  setDrawPage,
  type MagazineBrand,
  type PhotoAdjust,
} from "@/lib/magazine-pages";

export type FactItem = { label: string; text: string };
export type FactPage = { kicker: string; headline: string; intro: string; facts: [FactItem, FactItem, FactItem] };

export type ListPage = { kicker: string; headline: string; intro: string; items: [string, string, string, string, string] };

export type MagazinePostCopy = {
  cover: { kicker: string; title: string; tagline: string };
  pages: [FactPage, ListPage, ListPage];
  cta: { lead: string; word: string; line: string };
  caption: string;
};

const emptyFact = (): FactItem => ({ label: "", text: "" });
const emptyPage = (): FactPage => ({ kicker: "", headline: "", intro: "", facts: [emptyFact(), emptyFact(), emptyFact()] });

const emptyList = (headline: string): ListPage => ({ kicker: "", headline, intro: "", items: ["", "", "", "", ""] });

export const EMPTY_POST_COPY: MagazinePostCopy = {
  cover: { kicker: "", title: "", tagline: "" },
  pages: [emptyPage(), emptyList("This is for you if..."), emptyList("Helps most with...")],
  cta: { lead: "If this interests you", word: "", line: "" },
  caption: "",
};

export const PAGE_NAMES = ["cover", "fun-facts", "this-is-for-you-if", "helps-most-with", "comment-page"];
export const MIN_PHOTOS = 5;
export const MAX_PHOTOS = 10;

// Who gets which photo. Photo 0 is the cover, the last photo is the full page ending.
// Everything in between is shared out across the three fact pages (and a cover inset if there are plenty).
export type PhotoPlan = { cover: number[]; pages: [number[], number[], number[]]; final: number };

export function planPhotos(count: number): PhotoPlan {
  const n = Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, count));
  const coverInset = n >= 7 ? 1 : 0;
  const cover = coverInset ? [0, 1] : [0];
  const start = 1 + coverInset;
  const middle: number[] = [];
  for (let i = start; i < n - 1; i++) middle.push(i);
  const per = Math.floor(middle.length / 3);
  const extra = middle.length % 3;
  const pages: number[][] = [[], [], []];
  let at = 0;
  for (let p = 0; p < 3; p++) {
    const take = per + (p < extra ? 1 : 0);
    pages[p] = middle.slice(at, at + take);
    at += take;
  }
  return { cover, pages: pages as PhotoPlan["pages"], final: n - 1 };
}

// The shape each photo slot needs. The cover, the cover inset and the last page are full height (V for vertical).
// Everything on the inside pages sits in a wide frame (H for horizontal).
export function photoShape(index: number, count: number): "H" | "V" {
  const plan = planPhotos(count);
  return index === plan.final || plan.cover.includes(index) ? "V" : "H";
}

// Where a photo lands, in words, for the labels under each thumbnail.
export function photoRole(index: number, count: number): string {
  const plan = planPhotos(count);
  if (plan.cover[0] === index) return "Cover";
  if (plan.cover[1] === index) return "Cover inset";
  for (let p = 0; p < 3; p++) if (plan.pages[p].includes(index)) return ["Fun facts", "This is for you if", "Helps most with"][p];
  if (plan.final === index) return "Last page";
  return "Not used";
}

// How many lines a block of text needs at the size it settles on, so we can sit it against the bottom of the page.
function measure(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: { maxW: number; maxLines: number; size: number; minSize: number; family: string; weight?: string; tracking?: number; lineHeight: number }
): { size: number; lines: number; height: number } {
  let size = o.size;
  let lines = 1;
  for (;;) {
    ctx.font = `${o.weight ?? "normal"} ${size}px ${o.family}`;
    (ctx as any).letterSpacing = o.tracking ? `${o.tracking}px` : "0px";
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let tooWide = false;
    lines = 0;
    for (const w of words) {
      if (ctx.measureText(w).width > o.maxW) tooWide = true;
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > o.maxW && line) {
        lines++;
        line = w;
      } else line = test;
    }
    if (line) lines++;
    if ((lines <= o.maxLines && !tooWide) || size <= o.minSize) break;
    size -= 2;
  }
  (ctx as any).letterSpacing = "0px";
  lines = Math.min(lines, o.maxLines);
  return { size, lines, height: lines * size * o.lineHeight };
}

// PAGE 1: cover. The treatment name is the title.
export function drawPostCover(brand: MagazineBrand, copy: MagazinePostCopy, photos: (CanvasImageSource | null)[], plan: PhotoPlan) {
  const [c, ctx] = newCanvas();
  drawCover(ctx, photos[plan.cover[0]] ?? null, 0, 0, PAGE_W, PAGE_H, plan.cover[0]);

  const top = ctx.createLinearGradient(0, 0, 0, 340);
  top.addColorStop(0, "rgba(0,0,0,0.6)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, PAGE_W, 340);
  const bottom = ctx.createLinearGradient(0, 600, 0, PAGE_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 600, PAGE_W, PAGE_H - 600);

  block(ctx, brand.clinicName || "Your clinic", {
    x: PAGE_W / 2,
    y: 70,
    maxW: PAGE_W - 140,
    maxLines: 1,
    size: 100,
    minSize: 48,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 4,
  });
  ctx.fillStyle = brand.accent;
  ctx.fillRect(PAGE_W / 2 - 60, 200, 120, 5);
  block(ctx, brand.issue, {
    x: PAGE_W / 2,
    y: 224,
    maxW: PAGE_W - 200,
    maxLines: 1,
    size: 26,
    minSize: 20,
    family: SANS,
    weight: "600",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 6,
  });

  if (plan.cover[1] !== undefined) {
    const insetW = 280;
    const insetH = 350;
    const ix = PAGE_W - 80 - insetW;
    const iy = 420;
    ctx.save();
    ctx.translate(ix + insetW / 2, iy + insetH / 2);
    ctx.rotate((3 * Math.PI) / 180);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-insetW / 2 - 6 + 10, -insetH / 2 - 6 + 14, insetW + 12, insetH + 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-insetW / 2 - 12, -insetH / 2 - 12, insetW + 24, insetH + 24);
    ctx.translate(-insetW / 2, -insetH / 2);
    drawCover(ctx, photos[plan.cover[1]] ?? null, 0, 0, insetW, insetH, plan.cover[1]);
    ctx.restore();
  }

  // Title sits against the bottom of the page whatever length it is.
  const title = (copy.cover.title || "Your treatment").toUpperCase();
  const tagline = copy.cover.tagline;
  const bottomY = PAGE_H - 90;
  const tm = measure(ctx, title, { maxW: PAGE_W - 160, maxLines: 3, size: 170, minSize: 70, family: SERIF, weight: "bold", lineHeight: 1.02 });
  const taglineH = tagline ? 90 : 0;
  const titleTop = bottomY - taglineH - tm.height;
  if (copy.cover.kicker) {
    block(ctx, copy.cover.kicker, {
      x: 80,
      y: titleTop - 70,
      maxW: PAGE_W - 160,
      maxLines: 1,
      size: 32,
      minSize: 22,
      family: SANS,
      weight: "700",
      colour: brand.accent,
      upper: true,
      tracking: 6,
    });
  }
  const ty = block(ctx, title, {
    x: 80,
    y: titleTop,
    maxW: PAGE_W - 160,
    maxLines: 3,
    size: 170,
    minSize: 70,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    lineHeight: 1.02,
  });
  if (tagline) {
    ctx.fillStyle = brand.accent;
    ctx.fillRect(80, ty + 22, 8, 40);
    block(ctx, tagline, {
      x: 108,
      y: ty + 20,
      maxW: PAGE_W - 188,
      maxLines: 2,
      size: 36,
      minSize: 24,
      family: SANS,
      weight: "600",
      colour: "#ffffff",
    });
  }
  return c;
}

// Photo block on a fact page. One photo fills the width, two sit side by side, three make a big one and two small.
function photoBlock(ctx: CanvasRenderingContext2D, photos: (CanvasImageSource | null)[], idx: number[], y: number, h: number) {
  const x0 = 80;
  const w = PAGE_W - 160;
  const gap = 20;
  if (idx.length <= 1) {
    drawCover(ctx, photos[idx[0]] ?? null, x0, y, w, h, idx[0] ?? 0);
  } else if (idx.length === 2) {
    const cw = (w - gap) / 2;
    drawCover(ctx, photos[idx[0]] ?? null, x0, y, cw, h, idx[0]);
    drawCover(ctx, photos[idx[1]] ?? null, x0 + cw + gap, y, cw, h, idx[1]);
  } else {
    const bigW = Math.round(w * 0.58);
    const sw = w - bigW - gap;
    const sh = (h - gap) / 2;
    drawCover(ctx, photos[idx[0]] ?? null, x0, y, bigW, h, idx[0]);
    drawCover(ctx, photos[idx[1]] ?? null, x0 + bigW + gap, y, sw, sh, idx[1]);
    drawCover(ctx, photos[idx[2]] ?? null, x0 + bigW + gap, y + sh + gap, sw, sh, idx[2]);
  }
}

// Kicker, headline and intro shared by the three inside pages. Returns the y just below them.
function insideHeader(ctx: CanvasRenderingContext2D, brand: MagazineBrand, page: { kicker: string; headline: string; intro: string }): number {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  ctx.fillStyle = brand.colour;
  ctx.fillRect(80, 90, 70, 8);
  block(ctx, page.kicker, {
    x: 80,
    y: 116,
    maxW: 700,
    maxLines: 1,
    size: 26,
    minSize: 20,
    family: SANS,
    weight: "700",
    colour: brand.colour,
    upper: true,
    tracking: 5,
  });
  const hy = block(ctx, page.headline || "Your headline goes here", {
    x: 80,
    y: 160,
    maxW: PAGE_W - 160,
    maxLines: 2,
    size: 78,
    minSize: 46,
    family: SERIF,
    weight: "bold",
    colour: INK,
    lineHeight: 1.06,
  });
  const iy = block(ctx, page.intro, {
    x: 80,
    y: hy + 18,
    maxW: PAGE_W - 200,
    maxLines: 2,
    size: 31,
    minSize: 24,
    family: SERIF,
    weight: "bold",
    colour: brand.colour,
    lineHeight: 1.3,
  });

  return iy;
}

// PAGE 2: fun facts. A headline, a friendly intro, photos and three numbered facts.
export function drawFactPage(brand: MagazineBrand, page: FactPage, n: number, photos: (CanvasImageSource | null)[], idx: number[]) {
  const [c, ctx] = newCanvas();
  const iy = insideHeader(ctx, brand, page);

  const py = Math.max(iy + 32, 430);
  const ph = 380;
  photoBlock(ctx, photos, idx, py, ph);
  ctx.fillStyle = brand.colour;
  ctx.fillRect(80, py + ph - 14, 70, 14);

  let fy = py + ph + 50;
  const numFg = onColour(brand.colour);
  page.facts.forEach((f, i) => {
    ctx.fillStyle = brand.colour;
    ctx.beginPath();
    ctx.arc(80 + 28, fy + 30, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = numFg;
    ctx.font = `700 30px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 80 + 28, fy + 32);
    ctx.textBaseline = "alphabetic";
    const ly = block(ctx, f.label, {
      x: 160,
      y: fy,
      maxW: PAGE_W - 240,
      maxLines: 1,
      size: 24,
      minSize: 18,
      family: SANS,
      weight: "700",
      colour: brand.colour,
      upper: true,
      tracking: 3,
    });
    block(ctx, f.text, {
      x: 160,
      y: ly + 8,
      maxW: PAGE_W - 240,
      maxLines: 3,
      size: 29,
      minSize: 21,
      family: SANS,
      colour: INK,
      lineHeight: 1.36,
    });
    fy += 132;
  });

  footer(ctx, brand, n, INK);
  return c;
}

// PAGES 3 and 4: "This is for you if..." and "Helps most with...". Photos, then five ticked lines.
export function drawListPage(brand: MagazineBrand, page: ListPage, n: number, photos: (CanvasImageSource | null)[], idx: number[]) {
  const [c, ctx] = newCanvas();
  const iy = insideHeader(ctx, brand, page);

  const py = Math.max(iy + 30, 420);
  const ph = 320;
  photoBlock(ctx, photos, idx, py, ph);
  ctx.fillStyle = brand.colour;
  ctx.fillRect(80, py + ph - 14, 70, 14);

  const numFg = onColour(brand.colour);
  let ly = py + ph + 46;
  for (const item of page.items) {
    ctx.fillStyle = brand.colour;
    ctx.beginPath();
    ctx.arc(80 + 26, ly + 30, 26, 0, Math.PI * 2);
    ctx.fill();
    // a tick
    ctx.strokeStyle = numFg;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(80 + 15, ly + 30);
    ctx.lineTo(80 + 23, ly + 39);
    ctx.lineTo(80 + 38, ly + 21);
    ctx.stroke();
    block(ctx, item, {
      x: 158,
      y: ly + 2,
      maxW: PAGE_W - 240,
      maxLines: 2,
      size: 33,
      minSize: 22,
      family: SANS,
      weight: "600",
      colour: INK,
      lineHeight: 1.28,
    });
    ly += 96;
  }

  footer(ctx, brand, n, INK);
  return c;
}

// Turns "www.clinic.co.uk/book" into a full link a phone camera will open.
export function normaliseQrUrl(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return `https://${t}`;
  return "";
}

// White card with a QR code of the booking link and "SCAN TO BOOK" under it.
// Uses the qrcode-generator script the page loads from jsDelivr; if it isn't
// there yet the page simply redraws once it arrives.
function drawQrCard(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number, accent: string): boolean {
  const qrcode = (globalThis as any).qrcode;
  if (!url || typeof qrcode !== "function") return false;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const pad = 14;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 18);
  ctx.fill();
  ctx.restore();
  const inner = size - pad * 2;
  const cell = inner / n;
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + pad + c * cell), Math.floor(y + pad + r * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x, y + size + 12, size, 40, 20);
  ctx.fill();
  ctx.fillStyle = onColour(accent);
  ctx.font = `700 19px ${SANS}`;
  (ctx as any).letterSpacing = "4px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SCAN TO BOOK", x + size / 2 + 2, y + size + 33);
  ctx.textBaseline = "alphabetic";
  (ctx as any).letterSpacing = "0px";
  return true;
}

// PAGE 5: one big photo and "If this interests you, comment WORD".
export function drawCommentPage(brand: MagazineBrand & { qrUrl?: string }, copy: MagazineCopy2, photos: (CanvasImageSource | null)[], slot: number) {
  const [c, ctx] = newCanvas();
  drawCover(ctx, photos[slot] ?? null, 0, 0, PAGE_W, PAGE_H, slot);

  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, "rgba(0,0,0,0.5)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, PAGE_W, 260);
  const bottom = ctx.createLinearGradient(0, 640, 0, PAGE_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(0.55, "rgba(0,0,0,0.72)");
  bottom.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 640, PAGE_W, PAGE_H - 640);

  // With a booking link the QR card takes the top-right corner and the clinic
  // name moves to the left so the two never collide.
  const qrSize = 200;
  const hasQr = drawQrCard(ctx, normaliseQrUrl(brand.qrUrl), PAGE_W - 70 - qrSize, 60, qrSize, brand.accent);
  block(ctx, brand.clinicName.toUpperCase(), {
    x: hasQr ? 80 : PAGE_W / 2,
    y: 80,
    maxW: hasQr ? PAGE_W - 80 - qrSize - 130 : PAGE_W - 200,
    maxLines: 1,
    size: 30,
    minSize: 20,
    family: SANS,
    weight: "700",
    colour: "#ffffff",
    align: hasQr ? "left" : "center",
    tracking: 8,
  });

  const word = (copy.word || "YOURWORD").toUpperCase();
  const lead = copy.lead || "If this interests you";

  // Measure from the bottom so the block always sits in the lower third.
  const leadM = measure(ctx, lead, { maxW: PAGE_W - 160, maxLines: 2, size: 92, minSize: 54, family: SERIF, weight: "bold", lineHeight: 1.06 });
  const lineM = copy.line ? measure(ctx, copy.line, { maxW: PAGE_W - 240, maxLines: 2, size: 32, minSize: 22, family: SANS, weight: "600", lineHeight: 1.4 }) : { height: 0 };
  const pillH = 150;
  const footerY = PAGE_H - 70;
  const lineTop = footerY - 60 - lineM.height;
  const pillCy = lineTop - 40 - pillH / 2;
  const commentY = pillCy - pillH / 2 - 70;
  const leadTop = commentY - 50 - leadM.height;

  block(ctx, lead, {
    x: PAGE_W / 2,
    y: leadTop,
    maxW: PAGE_W - 160,
    maxLines: 2,
    size: 92,
    minSize: 54,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    align: "center",
    lineHeight: 1.06,
  });
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px ${SANS}`;
  (ctx as any).letterSpacing = "10px";
  ctx.textAlign = "center";
  ctx.fillText("COMMENT", PAGE_W / 2 + 5, commentY + 30);
  (ctx as any).letterSpacing = "0px";

  // the reply word in a big pill
  let size = 100;
  ctx.font = `800 ${size}px ${SANS}`;
  (ctx as any).letterSpacing = "6px";
  while (ctx.measureText(word).width > 700 && size > 52) {
    size -= 4;
    ctx.font = `800 ${size}px ${SANS}`;
  }
  const pw = Math.min(PAGE_W - 160, ctx.measureText(word).width + 140);
  ctx.fillStyle = brand.accent;
  ctx.beginPath();
  ctx.roundRect(PAGE_W / 2 - pw / 2, pillCy - pillH / 2, pw, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = onColour(brand.accent);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, PAGE_W / 2 + 3, pillCy + 4);
  ctx.textBaseline = "alphabetic";
  (ctx as any).letterSpacing = "0px";

  if (copy.line) {
    block(ctx, copy.line, {
      x: PAGE_W / 2,
      y: lineTop,
      maxW: PAGE_W - 240,
      maxLines: 2,
      size: 32,
      minSize: 22,
      family: SANS,
      weight: "600",
      colour: "#ffffff",
      align: "center",
      lineHeight: 1.4,
    });
  }
  if (brand.contact) {
    block(ctx, brand.contact, {
      x: PAGE_W / 2,
      y: footerY - 28,
      maxW: PAGE_W - 200,
      maxLines: 1,
      size: 26,
      minSize: 18,
      family: SANS,
      weight: "600",
      colour: "#ffffff",
      align: "center",
      tracking: 2,
    });
  }
  return c;
}

type MagazineCopy2 = MagazinePostCopy["cta"];

export function drawAllPostPages(
  brand: MagazineBrand & { qrUrl?: string },
  copy: MagazinePostCopy,
  photos: (CanvasImageSource | null)[],
  photoAdjusts: (PhotoAdjust | undefined)[] = []
): HTMLCanvasElement[] {
  beginDraw(photoAdjusts);
  const plan = planPhotos(photos.length);
  setDrawPage(0, 0);
  const p1 = drawPostCover(brand, copy, photos, plan);
  setDrawPage(1, 0);
  const facts = [drawFactPage(brand, copy.pages[0], 2, photos, plan.pages[0])];
  setDrawPage(2, 0);
  facts.push(drawListPage(brand, copy.pages[1], 3, photos, plan.pages[1]));
  setDrawPage(3, 0);
  facts.push(drawListPage(brand, copy.pages[2], 4, photos, plan.pages[2]));
  setDrawPage(4, 0);
  const p5 = drawCommentPage(brand, copy.cta, photos, plan.final);
  return [p1, ...facts, p5];
}
