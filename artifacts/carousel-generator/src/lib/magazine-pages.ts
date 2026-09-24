// Draws the four magazine pages (cover, page 2, page 3, call to action) onto
// 1080 x 1440 canvases, ready to download or drop into the Magazine Flip tool.
// Photos come in as canvases already cropped to 1080 x 1440 by coverToCanvas,
// so every drawing helper here just crops them again to whatever box it needs.

export const PAGE_W = 1080;
export const PAGE_H = 1440;

export type MagazineCopy = {
  cover: { headline: string; lines: [string, string, string] };
  page2: { kicker: string; headline: string; intro: string; body: string };
  page3: [
    { kicker: string; headline: string; body: string },
    { kicker: string; headline: string; body: string },
  ];
  cta: { headline: string; body: string };
};

export type MagazineBrand = {
  clinicName: string;
  colour: string; // main brand colour
  accent: string; // highlight colour
  ctaButton: string; // words on the button, e.g. Book a consultation
  contact: string; // website, phone or handle
  issue: string; // e.g. September 2026
};

export const EMPTY_COPY: MagazineCopy = {
  cover: { headline: "", lines: ["", "", ""] },
  page2: { kicker: "", headline: "", intro: "", body: "" },
  page3: [
    { kicker: "", headline: "", body: "" },
    { kicker: "", headline: "", body: "" },
  ],
  cta: { headline: "", body: "" },
};

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const CREAM = "#f6f0e6";
const INK = "#1d1a1a";

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// White text on dark colours, near black on light ones.
function onColour(hex: string): string {
  return luminance(hex) > 0.42 ? INK : "#ffffff";
}

function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = PAGE_W;
  c.height = PAGE_H;
  return [c, c.getContext("2d")!];
}

// How a photo sits inside its frame. zoom 1 fills the frame, panX/panY run from -1 to 1.
export type PhotoAdjust = { zoom: number; panX: number; panY: number };
export const DEFAULT_ADJUST: PhotoAdjust = { zoom: 1, panX: 0, panY: 0 };

// Where each photo frame landed on each page, so the tool can tell which photo you are dragging.
export type PhotoHit = {
  page: number;
  slot: number;
  inv: DOMMatrix;
  w: number;
  h: number;
  x: number;
  y: number;
  slackX: number;
  slackY: number;
};
let hits: PhotoHit[] = [];
let curPage = 0;
let slotBase = 0;
let adjusts: (PhotoAdjust | undefined)[] = [];
export function getPhotoHits(): PhotoHit[] {
  return hits;
}

// Draws src into the box (x, y, w, h) like object-fit: cover, with optional zoom and pan.
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource | null,
  x: number,
  y: number,
  w: number,
  h: number,
  local = 0
) {
  const slot = slotBase + local;
  const adj = adjusts[slot] ?? DEFAULT_ADJUST;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (src) {
    const sw = (src as HTMLCanvasElement).width;
    const sh = (src as HTMLCanvasElement).height;
    const scale = Math.max(w / sw, h / sh) * Math.max(1, adj.zoom);
    const dw = sw * scale;
    const dh = sh * scale;
    const slackX = Math.max(0, dw - w);
    const slackY = Math.max(0, dh - h);
    const px = Math.max(-1, Math.min(1, adj.panX));
    const py = Math.max(-1, Math.min(1, adj.panY));
    ctx.drawImage(src, x + (w - dw) / 2 + (px * slackX) / 2, y + (h - dh) / 2 + (py * slackY) / 2, dw, dh);
    hits.push({ page: curPage, slot, inv: ctx.getTransform().inverse(), w, h, x, y, slackX, slackY });
  } else {
    ctx.fillStyle = "#cfc6b8";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9b9284";
    ctx.font = `28px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("Add a photo", x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Shrinks the font until the text fits in maxLines, then draws it from y down.
// Returns the y just below the last line.
function block(
  ctx: CanvasRenderingContext2D,
  text: string,
  o: {
    x: number;
    y: number;
    maxW: number;
    maxLines: number;
    size: number;
    minSize: number;
    family: string;
    weight?: string;
    colour: string;
    lineHeight?: number;
    align?: CanvasTextAlign;
    upper?: boolean;
    tracking?: number;
  }
): number {
  const t = o.upper ? text.toUpperCase() : text;
  if (!t) return o.y;
  let size = o.size;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${o.weight ?? "normal"} ${size}px ${o.family}`;
    (ctx as any).letterSpacing = o.tracking ? `${o.tracking}px` : "0px";
    lines = wrap(ctx, t, o.maxW);
    if (lines.length <= o.maxLines || size <= o.minSize) break;
    size -= 2;
  }
  const lh = size * (o.lineHeight ?? 1.18);
  ctx.fillStyle = o.colour;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  let y = o.y + size;
  for (const l of lines.slice(0, o.maxLines)) {
    ctx.fillText(l, o.x, y);
    y += lh;
  }
  (ctx as any).letterSpacing = "0px";
  return y - lh + size * 0.25;
}

function footer(ctx: CanvasRenderingContext2D, brand: MagazineBrand, page: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.6;
  ctx.font = `600 22px ${SANS}`;
  (ctx as any).letterSpacing = "3px";
  ctx.textAlign = "left";
  ctx.fillText(brand.clinicName.toUpperCase(), 80, PAGE_H - 60);
  ctx.textAlign = "right";
  ctx.fillText(String(page), PAGE_W - 80, PAGE_H - 60);
  (ctx as any).letterSpacing = "0px";
  ctx.globalAlpha = 1;
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, bg: string, fg: string) {
  ctx.font = `700 40px ${SANS}`;
  const w = Math.min(880, ctx.measureText(text).width + 120);
  const h = 104;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 2);
  ctx.textBaseline = "alphabetic";
}

// PAGE 1: the cover.
export function drawCoverPage(brand: MagazineBrand, copy: MagazineCopy, photos: (CanvasImageSource | null)[]) {
  const [c, ctx] = newCanvas();
  drawCover(ctx, photos[0], 0, 0, PAGE_W, PAGE_H);

  // darken the top for the masthead and the bottom for the cover lines
  const top = ctx.createLinearGradient(0, 0, 0, 380);
  top.addColorStop(0, "rgba(0,0,0,0.62)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, PAGE_W, 380);
  const bottom = ctx.createLinearGradient(0, 700, 0, PAGE_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 700, PAGE_W, PAGE_H - 700);

  // masthead
  block(ctx, brand.clinicName || "Your clinic", {
    x: PAGE_W / 2,
    y: 70,
    maxW: PAGE_W - 140,
    maxLines: 1,
    size: 118,
    minSize: 56,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 4,
  });
  ctx.fillStyle = brand.accent;
  ctx.fillRect(PAGE_W / 2 - 60, 232, 120, 5);
  block(ctx, brand.issue, {
    x: PAGE_W / 2,
    y: 256,
    maxW: PAGE_W - 200,
    maxLines: 1,
    size: 28,
    minSize: 20,
    family: SANS,
    weight: "600",
    colour: "#ffffff",
    align: "center",
    upper: true,
    tracking: 6,
  });

  // second photo, tucked in on the right like a cover inset
  const insetW = 300;
  const insetH = 380;
  const ix = PAGE_W - 80 - insetW;
  const iy = 560;
  ctx.save();
  ctx.translate(ix + insetW / 2, iy + insetH / 2);
  ctx.rotate((3 * Math.PI) / 180);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-insetW / 2 - 6 + 10, -insetH / 2 - 6 + 14, insetW + 12, insetH + 12);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-insetW / 2 - 12, -insetH / 2 - 12, insetW + 24, insetH + 24);
  ctx.translate(-insetW / 2, -insetH / 2);
  drawCover(ctx, photos[1], 0, 0, insetW, insetH, 1);
  ctx.restore();

  // big headline and the three cover lines
  const hy = block(ctx, copy.cover.headline || "Your headline goes here", {
    x: 80,
    y: 960,
    maxW: PAGE_W - 160,
    maxLines: 3,
    size: 96,
    minSize: 58,
    family: SERIF,
    weight: "bold",
    colour: "#ffffff",
    lineHeight: 1.08,
  });
  let ly = Math.max(hy + 26, 1180);
  for (const line of copy.cover.lines) {
    if (!line) continue;
    ctx.fillStyle = brand.accent;
    ctx.fillRect(80, ly + 6, 8, 34);
    block(ctx, line, {
      x: 108,
      y: ly,
      maxW: PAGE_W - 188,
      maxLines: 1,
      size: 36,
      minSize: 24,
      family: SANS,
      weight: "600",
      colour: "#ffffff",
    });
    ly += 62;
  }
  return c;
}

// PAGE 2: one topic, two photos.
export function drawPageTwo(brand: MagazineBrand, copy: MagazineCopy, photos: (CanvasImageSource | null)[]) {
  const [c, ctx] = newCanvas();
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  ctx.fillStyle = brand.colour;
  ctx.fillRect(80, 96, 70, 8);
  block(ctx, copy.page2.kicker, {
    x: 80,
    y: 124,
    maxW: 600,
    maxLines: 1,
    size: 28,
    minSize: 20,
    family: SANS,
    weight: "700",
    colour: brand.colour,
    upper: true,
    tracking: 5,
  });
  const hy = block(ctx, copy.page2.headline || "Your headline goes here", {
    x: 80,
    y: 176,
    maxW: PAGE_W - 160,
    maxLines: 3,
    size: 84,
    minSize: 50,
    family: SERIF,
    weight: "bold",
    colour: INK,
    lineHeight: 1.08,
  });

  const py = Math.max(hy + 30, 440);
  const ph = 470;
  drawCover(ctx, photos[0], 80, py, PAGE_W - 160, ph);

  // second photo overlapping the corner of the first
  const sw = 360;
  const sh = 300;
  const sx = PAGE_W - 80 - sw + 20;
  const sy = py + ph - 90;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(sx - 10 + 8, sy - 10 + 12, sw + 20, sh + 20);
  ctx.fillStyle = CREAM;
  ctx.fillRect(sx - 10, sy - 10, sw + 20, sh + 20);
  drawCover(ctx, photos[1], sx, sy, sw, sh, 1);

  const ty = py + ph + 40;
  const introEnd = block(ctx, copy.page2.intro, {
    x: 80,
    y: ty,
    maxW: 560,
    maxLines: 4,
    size: 32,
    minSize: 24,
    family: SERIF,
    weight: "bold",
    colour: brand.colour,
    lineHeight: 1.3,
  });
  block(ctx, copy.page2.body, {
    x: 80,
    y: introEnd + 16,
    maxW: 560,
    maxLines: 9,
    size: 27,
    minSize: 20,
    family: SANS,
    colour: INK,
    lineHeight: 1.45,
  });

  footer(ctx, brand, 2, INK);
  return c;
}

// PAGE 3: two smaller features, one photo each.
export function drawPageThree(brand: MagazineBrand, copy: MagazineCopy, photos: (CanvasImageSource | null)[]) {
  const [c, ctx] = newCanvas();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  const rows = [
    { y: 90, photoLeft: true, item: copy.page3[0], photo: photos[0], li: 0 },
    { y: 750, photoLeft: false, item: copy.page3[1], photo: photos[1], li: 1 },
  ];
  const rowH = 590;
  const photoW = 420;
  const gap = 50;
  const textW = PAGE_W - 160 - photoW - gap;

  ctx.fillStyle = brand.accent;
  ctx.fillRect(80, 712, PAGE_W - 160, 3);

  for (const r of rows) {
    const photoX = r.photoLeft ? 80 : PAGE_W - 80 - photoW;
    const textX = r.photoLeft ? 80 + photoW + gap : 80;
    drawCover(ctx, r.photo, photoX, r.y, photoW, rowH, r.li);
    // colour block behind the corner of the photo
    ctx.fillStyle = brand.colour;
    ctx.fillRect(r.photoLeft ? photoX : photoX + photoW - 70, r.y + rowH - 16, 70, 16);

    block(ctx, r.item.kicker, {
      x: textX,
      y: r.y + 20,
      maxW: textW,
      maxLines: 1,
      size: 24,
      minSize: 18,
      family: SANS,
      weight: "700",
      colour: brand.colour,
      upper: true,
      tracking: 4,
    });
    const hy = block(ctx, r.item.headline || "Your headline", {
      x: textX,
      y: r.y + 66,
      maxW: textW,
      maxLines: 4,
      size: 60,
      minSize: 36,
      family: SERIF,
      weight: "bold",
      colour: INK,
      lineHeight: 1.1,
    });
    block(ctx, r.item.body, {
      x: textX,
      y: hy + 24,
      maxW: textW,
      maxLines: 10,
      size: 31,
      minSize: 20,
      family: SANS,
      colour: INK,
      lineHeight: 1.45,
    });
  }

  footer(ctx, brand, 3, INK);
  return c;
}

// PAGE 4: the call to action.
export function drawCtaPage(brand: MagazineBrand, copy: MagazineCopy) {
  const [c, ctx] = newCanvas();
  const fg = onColour(brand.colour);
  ctx.fillStyle = brand.colour;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // soft ring in the accent colour for a bit of life
  ctx.strokeStyle = brand.accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PAGE_W - 40, 60, 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PAGE_W - 40, 60, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  block(ctx, brand.clinicName.toUpperCase(), {
    x: PAGE_W / 2,
    y: 150,
    maxW: PAGE_W - 200,
    maxLines: 1,
    size: 30,
    minSize: 20,
    family: SANS,
    weight: "700",
    colour: fg,
    align: "center",
    tracking: 8,
  });
  ctx.fillStyle = brand.accent;
  ctx.fillRect(PAGE_W / 2 - 50, 214, 100, 5);

  const hy = block(ctx, copy.cta.headline || "Your call to action headline", {
    x: PAGE_W / 2,
    y: 330,
    maxW: PAGE_W - 220,
    maxLines: 4,
    size: 96,
    minSize: 56,
    family: SERIF,
    weight: "bold",
    colour: fg,
    align: "center",
    lineHeight: 1.1,
  });
  const by = block(ctx, copy.cta.body, {
    x: PAGE_W / 2,
    y: hy + 50,
    maxW: PAGE_W - 260,
    maxLines: 5,
    size: 38,
    minSize: 26,
    family: SANS,
    colour: fg,
    align: "center",
    lineHeight: 1.45,
  });

  const btnY = Math.max(by + 120, 1020);
  pill(ctx, brand.ctaButton || "Book a consultation", PAGE_W / 2, btnY, brand.accent, onColour(brand.accent));
  if (brand.contact) {
    block(ctx, brand.contact, {
      x: PAGE_W / 2,
      y: btnY + 100,
      maxW: PAGE_W - 200,
      maxLines: 1,
      size: 34,
      minSize: 22,
      family: SANS,
      weight: "600",
      colour: fg,
      align: "center",
    });
  }
  return c;
}

export function drawAllPages(
  brand: MagazineBrand,
  copy: MagazineCopy,
  photos: (CanvasImageSource | null)[],
  photoAdjusts: (PhotoAdjust | undefined)[] = []
): HTMLCanvasElement[] {
  hits = [];
  adjusts = photoAdjusts;
  curPage = 0;
  slotBase = 0;
  const p1 = drawCoverPage(brand, copy, [photos[0], photos[1]]);
  curPage = 1;
  slotBase = 2;
  const p2 = drawPageTwo(brand, copy, [photos[2], photos[3]]);
  curPage = 2;
  slotBase = 4;
  const p3 = drawPageThree(brand, copy, [photos[4], photos[5]]);
  curPage = 3;
  const p4 = drawCtaPage(brand, copy);
  return [p1, p2, p3, p4];
}
