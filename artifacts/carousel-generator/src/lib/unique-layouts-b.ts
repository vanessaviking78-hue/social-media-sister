// Unique covers 13 to 23.
import { HU, bg, drawPhoto, paper, paperclip, polaroid, rand, rgba, shade, tape, textBox, type G } from "./xmas-designs";
import { hline } from "./halloween-designs";
import { barcode, faint, framedPhoto, pin, roundStamp, sheet, speckle, stampBox, stars, tallWrap as hstack, tx } from "./unique-kit";

type L = (g: G) => void;
const W = 1080, H = 1350;

const foot = (g: G, y: number, colour: string, o?: { x?: number; w?: number; align?: CanvasTextAlign; size?: number }) =>
  textBox(g, HU(g, tx(g, "footer")), o?.x ?? 60, y, o?.w ?? 960, 44, { font: "body", weight: 700, max: o?.size ?? 28, min: 13, colour, align: o?.align ?? "center", lh: 1.1 });

function ruled(g: G, x: number, y: number, w: number, colour: string, lw = 3) {
  g.ctx.save(); g.ctx.fillStyle = colour; g.ctx.fillRect(x, y, w, lw); g.ctx.restore();
}

function binderClip(g: G, x: number, y: number) {
  const { ctx } = g;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.lineTo(36, 46); ctx.lineTo(-36, 46); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#8a8a8a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-40, -34); ctx.lineTo(40, -34); ctx.lineTo(30, 0); ctx.stroke();
  ctx.restore();
}

export const LAYOUTS_B: Record<string, L> = {
  // 13 --------------------------------------------------------------------
  wanted(g) {
    const { ctx, c } = g;
    speckle(g, c.paper, 61, 3500, "rgba(60,40,15,", "rgba(255,240,205,");
    ctx.fillStyle = "rgba(40,30,20,0.35)"; ctx.fillRect(0, 0, 40, H); ctx.fillRect(W - 40, 0, 40, H);
    hline(g, tx(g, "big"), 90, 20, 900, 250, c.ink, { align: "center", minSx: 0.6 });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 90, 275, 900, 200, 84, { lh: 1.0, minSx: 0.8, align: "center" });
    ctx.strokeStyle = c.red; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(300, 478); ctx.quadraticCurveTo(540, 466, 780, 482); ctx.stroke();
    textBox(g, tx(g, "sub"), 120, 505, 840, 40, { font: "body", max: 30, min: 12, weight: 700, colour: shade(c.green, 0), align: "center" });
    ctx.fillStyle = "#151515"; ctx.fillRect(136, 556, 810, 440);
    ctx.save(); ctx.beginPath(); ctx.rect(150, 570, 782, 412); ctx.clip(); ctx.translate(541, 776); drawPhoto(g, 782, 412); ctx.restore();
    g.slots.push({ i: 0, x: 150, y: 570, w: 782, h: 412, rot: 0 });
    stampBox(g, 810, 960, 340, 120, -7, tx(g, "stamp"), c.red, 84, { alpha: 0.9 });
    textBox(g, HU(g, tx(g, "evid")), 80, 1040, 300, 34, { font: "body", max: 26, min: 12, weight: 800, colour: c.ink });
    ctx.fillStyle = c.ink; ctx.fillRect(420, 1030, 4, 140);
    textBox(g, HU(g, tx(g, "hot")), 450, 1030, 540, 50, { font: "head", max: 46, min: 16, colour: c.red });
    textBox(g, HU(g, tx(g, "rest")), 450, 1086, 540, 90, { font: "head", max: 46, min: 16, colour: c.ink, lh: 1.04 });
    ruled(g, 90, 1232, 900, faint(g, 0.5), 2);
    foot(g, 1254, faint(g, 0.8), { size: 24 });
  },

  // 14 --------------------------------------------------------------------
  chat(g) {
    const { ctx, c } = g;
    speckle(g, c.paper, 71, 1500, "rgba(0,0,0,", "rgba(255,255,255,");
    pin(g, 60, 48, "#2d6f5b", 30); pin(g, 1010, 60, "#9fb7d6", 32);
    sheet(g, 134, 28, 871, 1255, c.frame, 0.7, { vignette: false });
    ctx.save(); ctx.translate(570, 650); ctx.rotate((0.7 * Math.PI) / 180); ctx.translate(-570, -650);
    textBox(g, HU(g, tx(g, "top")), 230, 95, 500, 30, { font: "body", max: 22, min: 10, weight: 600, colour: faint(g, 0.7) });
    ruled(g, 230, 130, 560, faint(g, 0.5), 2);
    textBox(g, HU(g, tx(g, "recv")), 800, 170, 190, 60, { font: "body", max: 20, min: 9, weight: 600, colour: faint(g, 0.7), align: "right", lh: 1.3 });
    const bub = (x: number, y: number, w: number, h: number, who: string, msg: string, tail: "bl" | "bl2") => {
      ctx.save(); ctx.fillStyle = c.frame; ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 40, y + h); ctx.lineTo(x + 20, y + h + 40); ctx.lineTo(x + 110, y + h); ctx.fillStyle = c.frame; ctx.fill();
      ctx.restore();
      textBox(g, HU(g, who), x + 30, y + 18, w - 60, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.ink });
      textBox(g, HU(g, msg), x + 30, y + 56, w - 60, h - 76, { font: "head", max: 52, min: 18, colour: c.ink, lh: 1.04 });
      void tail;
    };
    bub(230, 300, 400, 280, tx(g, "who1"), tx(g, "m1"), "bl");
    bub(250, 660, 400, 290, tx(g, "who2"), tx(g, "m2"), "bl2");
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(210, 320); ctx.bezierCurveTo(180, 400, 180, 520, 215, 600); ctx.stroke();
    textBox(g, tx(g, "side"), 140, 640, 120, 100, { font: "hand", max: 34, min: 14, colour: c.red, lh: 1.0 });
    ctx.restore();
    polaroid(g, 850, 640, 300, 500, 5, { pad: 16, bottom: 56, tapeAt: "kraft" });
    stampBox(g, 540, 1050, 590, 175, -3, tx(g, "stamp"), c.red, 64, { alpha: 0.85 });
    ruled(g, 220, 1228, 640, faint(g, 0.4), 2);
    foot(g, 1240, faint(g, 0.75), { x: 220, w: 640, align: "left", size: 22 });
  },

  // 15 --------------------------------------------------------------------
  triage(g) {
    const { ctx, c } = g;
    speckle(g, shade(c.paper, 0.08), 81, 3000, "rgba(90,60,20,", "rgba(255,245,215,");
    ctx.fillStyle = "rgba(120,80,30,0.18)"; ctx.fillRect(0, 0, W, 6);
    [250, 1100].forEach((y) => { ctx.fillStyle = "#4a3b24"; ctx.beginPath(); ctx.arc(52, y, 20, 0, Math.PI * 2); ctx.fill(); });
    paperclip(g, 90, 80, -8, "#8a8d93");
    textBox(g, HU(g, tx(g, "dept")), 150, 120, 520, 80, { font: "body", max: 28, min: 12, weight: 800, colour: c.green, lh: 1.2 });
    ctx.fillStyle = c.green; ctx.fillRect(110, 208, 560, 40);
    textBox(g, HU(g, tx(g, "file")), 120, 214, 540, 30, { font: "body", max: 22, min: 10, weight: 700, colour: c.light });
    stampBox(g, 840, 140, 350, 120, 3, tx(g, "stamp"), c.red, 96, { alpha: 0.92 });
    textBox(g, HU(g, tx(g, "comp")), 110, 270, 400, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.green });
    hstack(g, [{ text: tx(g, "q"), colour: c.ink }], 110, 305, 440, 350, 96, { lh: 1.0, minSx: 0.8 });
    sheet(g, 576, 262, 440, 560, c.frame, 0, { vignette: false });
    framedPhoto(g, 592, 278, 408, 528, 0, 0, c.frame, { shadow: false });
    paperclip(g, 830, 262, 6, "#8a8d93");
    textBox(g, HU(g, tx(g, "cat")), 110, 690, 420, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.green });
    textBox(g, HU(g, tx(g, "catv")), 110, 722, 460, 70, { font: "head", max: 56, min: 18, colour: c.red });
    ctx.strokeStyle = c.green; ctx.lineWidth = 3; ctx.strokeRect(100, 830, 880, 270);
    textBox(g, HU(g, tx(g, "note")), 118, 842, 300, 26, { font: "body", max: 20, min: 9, weight: 800, colour: c.green });
    textBox(g, tx(g, "rev"), 590, 838, 220, 50, { font: "hand", max: 44, min: 14, colour: "#2b4aa8", weight: 700 });
    ctx.strokeStyle = "#2b4aa8"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(850, 880); ctx.lineTo(880, 915); ctx.lineTo(940, 845); ctx.stroke();
    ctx.strokeStyle = c.green; ctx.lineWidth = 2; ctx.strokeRect(840, 840, 110, 100);
    ["n1", "n2", "n3", "n4"].forEach((k, i) => {
      const y = 878 + i * 54;
      textBox(g, HU(g, tx(g, k)), 130, y, 820, 48, { font: "head", max: 36, min: 14, colour: c.ink });
      ruled(g, 118, y + 44, 850, c.green, 2);
    });
    stampBox(g, 760, 1215, 440, 130, -4, tx(g, "disch"), c.red, 44, { alpha: 0.9 });
    textBox(g, HU(g, tx(g, "footer")), 110, 1190, 380, 30, { font: "body", max: 20, min: 9, weight: 700, colour: faint(g, 0.8) });
  },

  // 16 --------------------------------------------------------------------
  skincare(g) {
    const { ctx, c } = g;
    speckle(g, "#a79a82", 91, 1800, "rgba(0,0,0,", "rgba(255,255,255,");
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = c.paper; ctx.beginPath(); ctx.roundRect(20, 20, W - 40, H - 40, 40); ctx.fill(); ctx.restore();
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 70, 70, 940, 470, 126, { lh: 1.0, minSx: 0.8 });
    ctx.fillStyle = "#f7f3e8"; ctx.fillRect(70, 572, 940, 420);
    ctx.save(); ctx.beginPath(); ctx.rect(76, 578, 928, 408); ctx.clip(); ctx.translate(540, 782); drawPhoto(g, 928, 408); ctx.restore();
    g.slots.push({ i: 0, x: 76, y: 578, w: 928, h: 408, rot: 0 });
    ctx.strokeStyle = "#111"; ctx.lineWidth = 6; ctx.strokeRect(70, 572, 940, 420);
    // price tag
    ctx.save(); ctx.translate(800, 700); ctx.rotate((-4 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.fillStyle = c.red; ctx.beginPath(); ctx.roundRect(-250, -130, 500, 90, 26); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = c.frame; ctx.beginPath(); ctx.roundRect(-250, -70, 500, 230, 26); ctx.fill();
    textBox(g, HU(g, tx(g, "tag1")), -230, -118, 460, 60, { font: "head", max: 40, min: 14, colour: c.light, align: "center", lh: 1.0 });
    textBox(g, HU(g, tx(g, "tag2")), -225, -52, 450, 200, { font: "head", max: 64, min: 18, colour: c.red, align: "center", lh: 1.02 });
    ctx.restore();
    ctx.fillStyle = "#f4efe2"; ctx.fillRect(70, 1015, 800, 90); ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.strokeRect(70, 1015, 800, 90);
    textBox(g, tx(g, "bar"), 90, 1030, 770, 60, { font: "body", max: 32, min: 12, weight: 600, colour: c.ink });
    stampBox(g, 930, 1062, 130, 110, 4, tx(g, "fc"), c.red, 30, { alpha: 0.9 });
    barcode(g, 70, 1150, 300, 90, "#151515", 12);
    ctx.fillStyle = "#c8c0ad"; ctx.beginPath(); ctx.moveTo(650, 1250); ctx.lineTo(1010, 1230); ctx.lineTo(1010, 1330); ctx.lineTo(650, 1330); ctx.closePath(); ctx.fill();
    foot(g, 1265, c.ink, { x: 70, w: 560, align: "left", size: 24 });
  },

  // 17 --------------------------------------------------------------------
  rumour(g) {
    const { ctx, c } = g;
    speckle(g, c.paper, 101, 5000, "rgba(70,40,15,", "rgba(255,225,170,");
    paper(g, [[33, 28], [655, 20], [650, 810], [40, 800]], [true, false, true, false], c.frame, { seed: 5, amp: 4 });
    hstack(g, [{ text: tx(g, "h1"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }, { text: tx(g, "h2"), colour: c.ink }], 80, 70, 540, 640, 150, { lh: 1.0, minSx: 0.8 });
    ruled(g, 80, 740, 470, c.ink, 6);
    sheet(g, 660, 78, 390, 200, "#d9ceb4", 1.5, { vignette: false });
    textBox(g, HU(g, tx(g, "src")), 684, 100, 345, 160, { font: "hand", max: 40, min: 14, colour: c.ink, weight: 700, lh: 1.1 });
    sheet(g, 600, 330, 446, 700, c.frame, 2, { vignette: false });
    framedPhoto(g, 626, 360, 394, 630, 2, 0, c.frame, { shadow: false });
    binderClip(g, 700, 330);
    tape(g, 1000, 360, 160, 46, 40, "kraft");
    paper(g, [[33, 795], [475, 810], [470, 1100], [30, 1090]], [true, true, true, true], "#e7dcc3", { seed: 9, amp: 5 });
    stampBox(g, 252, 948, 380, 250, -3, HU(g, tx(g, "fc")) + "\n" + tx(g, "fct"), c.red, 40, { alpha: 0.85 });
    ctx.save(); ctx.translate(790, 1074); ctx.rotate((-1 * Math.PI) / 180);
    ctx.fillStyle = "#1c1c1c"; ctx.fillRect(-260, -48, 520, 96);
    textBox(g, tx(g, "strip"), -240, -34, 480, 70, { font: "hand", max: 40, min: 14, colour: "#f2eee2", align: "center", lh: 1.0 });
    ctx.restore();
    paper(g, [[40, 1190], [1040, 1180], [1040, 1300], [40, 1308]], [true, true, true, true], c.tag, { seed: 11, amp: 4 });
    foot(g, 1224, c.ink, { size: 36 });
    pin(g, 60, 1150, "#2d6f4f"); pin(g, 1020, 1190, "#2d6f4f");
  },

  // 18 --------------------------------------------------------------------
  onestar(g) {
    const { ctx, c } = g;
    speckle(g, "#c9c8c4", 111, 1500, "rgba(0,0,0,", "rgba(255,255,255,");
    sheet(g, 26, 22, 1030, 1306, "#e8e6e0", -1, { vignette: false });
    sheet(g, 20, 14, 1040, 1316, c.frame, 0.4, { vignette: false });
    ctx.fillStyle = "#222"; ctx.fillRect(60, 60, 60, 8);
    hline(g, tx(g, "h"), 80, 100, 900, 250, "#171717", { minSx: 0.6 });
    ruled(g, 80, 392, 920, faint(g, 0.4), 3);
    textBox(g, HU(g, tx(g, "date")), 760, 410, 240, 26, { font: "body", max: 20, min: 9, weight: 800, colour: faint(g, 0.7) });
    stars(g, 80, 430, 5, 1, 50, "#171717");
    hstack(g, [{ text: tx(g, "quote"), colour: "#171717" }], 80, 510, 780, 220, 62, { lh: 1.1, minSx: 0.85 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(300, 706, 290, 38, -0.02, 0.2, Math.PI * 2 + 0.1); ctx.stroke();
    textBox(g, HU(g, tx(g, "resp")), 80, 770, 520, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.red });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(90, 815, 540, 270);
    textBox(g, tx(g, "rt"), 112, 830, 500, 240, { font: "hand", max: 62, min: 20, colour: c.red, weight: 700, lh: 1.08 });
    polaroid(g, 850, 860, 380, 440, 3, { pad: 16, bottom: 60 });
    paperclip(g, 920, 640, 12, "#8a8d93");
    textBox(g, tx(g, "small"), 80, 1135, 500, 36, { font: "hand", max: 30, min: 12, colour: faint(g, 0.8) });
    ruled(g, 80, 1230, 920, faint(g, 0.4), 2);
    foot(g, 1250, "#171717", { x: 80, w: 920, align: "left", size: 26 });
  },

  // 19 --------------------------------------------------------------------
  form(g) {
    const { ctx, c } = g;
    speckle(g, shade(c.paper, 0.06), 121, 3500, "rgba(90,60,20,", "rgba(255,245,215,");
    [200, 1100].forEach((y) => { ctx.fillStyle = "#3f3220"; ctx.beginPath(); ctx.arc(30, y, 14, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(70, 40, 940, 1270);
    textBox(g, HU(g, tx(g, "dept1")), 100, 60, 470, 70, { font: "body", max: 22, min: 9, weight: 800, colour: c.ink, lh: 1.25 });
    textBox(g, "REFERENCE NO.", 600, 60, 340, 24, { font: "body", max: 18, min: 8, weight: 800, colour: c.ink });
    ctx.strokeRect(590, 50, 410, 70);
    ctx.beginPath(); ctx.arc(480, 175, 36, 0, Math.PI * 2); ctx.stroke();
    textBox(g, HU(g, tx(g, "dept2")), 240, 215, 480, 60, { font: "body", max: 16, min: 8, weight: 700, colour: c.ink, align: "center", lh: 1.2 });
    ctx.fillStyle = c.ink; ctx.fillRect(100, 280, 880, 3);
    stampBox(g, 850, 190, 230, 90, -5, tx(g, "recv"), "#2b4aa8", 26, { alpha: 0.85 });
    textBox(g, HU(g, tx(g, "myth")), 100, 305, 540, 90, { font: "head", max: 84, min: 28, colour: c.ink });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 100, 400, 540, 290, 82, { lh: 1.0, minSx: 0.8 });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(670, 290, 330, 440);
    textBox(g, "APPLICANT IMAGE", 676, 298, 318, 22, { font: "body", max: 16, min: 8, weight: 800, colour: c.ink, align: "center" });
    ctx.save(); ctx.beginPath(); ctx.rect(678, 326, 314, 396); ctx.clip(); ctx.translate(835, 524); drawPhoto(g, 314, 396); ctx.restore();
    g.slots.push({ i: 0, x: 678, y: 326, w: 314, h: 396, rot: 0 });
    ctx.fillStyle = rgba(c.frame, 0.7); ctx.fillRect(100, 740, 900, 62); ctx.fillRect(100, 802, 900, 62);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect(100, 740, 900, 124); ctx.beginPath(); ctx.moveTo(100, 802); ctx.lineTo(1000, 802); ctx.moveTo(300, 740); ctx.lineTo(300, 864); ctx.stroke();
    textBox(g, tx(g, "app"), 116, 756, 180, 36, { font: "script", max: 28, min: 12, colour: c.ink });
    textBox(g, HU(g, tx(g, "appv")), 320, 756, 660, 36, { font: "script", max: 30, min: 12, colour: c.ink });
    textBox(g, tx(g, "elig"), 116, 818, 180, 36, { font: "script", max: 28, min: 12, colour: c.ink });
    textBox(g, HU(g, tx(g, "eligv")), 320, 818, 660, 36, { font: "script", max: 30, min: 12, colour: c.ink });
    textBox(g, tx(g, "officer"), 100, 880, 340, 26, { font: "body", max: 20, min: 9, weight: 700, colour: faint(g, 0.8) });
    textBox(g, tx(g, "sign"), 120, 915, 320, 70, { font: "hand", max: 58, min: 18, colour: "#2b3a67", weight: 700 });
    ruled(g, 100, 990, 330, faint(g, 0.6), 2);
    textBox(g, tx(g, "dec"), 480, 880, 220, 26, { font: "body", max: 20, min: 9, weight: 700, colour: faint(g, 0.8) });
    stampBox(g, 740, 985, 480, 190, -6, tx(g, "stamp"), c.red, 60, { alpha: 0.9 });
    roundStamp(g, 180, 1085, 70, -8, "#2b4aa8", "ASSESSMENT COMPLETED", 13);
    textBox(g, tx(g, "notes"), 330, 1090, 300, 24, { font: "body", max: 18, min: 8, weight: 700, colour: faint(g, 0.8) });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(700, 1130); ctx.lineTo(724, 1160); ctx.lineTo(768, 1096); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeRect(100, 1175, 880, 100);
    textBox(g, tx(g, "nt"), 120, 1190, 840, 76, { font: "body", max: 28, min: 11, weight: 600, colour: c.ink, align: "center", lh: 1.2 });
    foot(g, 1288, c.ink, { size: 20 });
  },

  // 20 --------------------------------------------------------------------
  penalty(g) {
    const { ctx, c } = g;
    ctx.fillStyle = "#b9b7b2"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip(); drawPhoto(g, W, H); ctx.restore();
    g.slots.push({ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 });
    ctx.fillStyle = "rgba(240,240,240,0.14)"; ctx.fillRect(0, 0, W, H);
    sheet(g, 33, 218, 1014, 940, c.frame, 0, { vignette: false });
    ctx.fillStyle = c.tag; ctx.fillRect(33, 218, 1014, 360);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 5; ctx.strokeRect(70, 255, 940, 860);
    hstack(g, [{ text: tx(g, "h"), colour: "#111" }], 100, 275, 880, 290, 200, { lh: 0.95, minSx: 0.85, align: "center" });
    textBox(g, HU(g, tx(g, "off")), 100, 610, 700, 50, { font: "head", max: 46, min: 14, colour: c.red });
    textBox(g, HU(g, tx(g, "offv")), 100, 665, 880, 110, { font: "body", max: 32, min: 12, weight: 800, colour: "#111", lh: 1.2 });
    ruled(g, 100, 790, 880, "#111", 3);
    textBox(g, HU(g, tx(g, "fine")), 100, 810, 400, 50, { font: "head", max: 46, min: 14, colour: c.red });
    textBox(g, HU(g, tx(g, "finev")), 100, 860, 600, 90, { font: "head", max: 84, min: 20, colour: "#111" });
    ruled(g, 100, 975, 880, "#111", 3);
    textBox(g, HU(g, tx(g, "red")), 100, 995, 620, 110, { font: "head", max: 46, min: 14, colour: c.red, lh: 1.06 });
    ctx.save(); ctx.translate(880, 870); ctx.rotate((-10 * Math.PI) / 180);
    ctx.strokeStyle = "#2b4aa8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 100, 80, 0, 0, Math.PI * 2); ctx.stroke();
    textBox(g, tx(g, "hand"), -80, -44, 160, 90, { font: "hand", max: 40, min: 14, colour: "#2b4aa8", align: "center", weight: 700, lh: 1.0 });
    ctx.restore();
    tape(g, 540, 218, 320, 70, 0, "kraft"); tape(g, 540, 1158, 280, 70, 0, "kraft");
  },

  // 21 --------------------------------------------------------------------
  door(g) {
    const { ctx, c } = g;
    speckle(g, "#dcdcd8", 131, 900, "rgba(0,0,0,", "rgba(255,255,255,");
    ctx.fillStyle = "rgba(0,0,0,0.07)"; ctx.fillRect(W - 30, 0, 30, H);
    sheet(g, 70, 61, 770, 1210, c.frame, -0.4, { vignette: false });
    ctx.save(); ctx.translate(455, 666); ctx.rotate((-0.4 * Math.PI) / 180); ctx.translate(-455, -666);
    hline(g, tx(g, "h"), 110, 90, 700, 130, "#111", { minSx: 0.6 });
    hstack(g, [{ text: tx(g, "h2"), colour: "#111" }], 110, 235, 700, 200, 70, { lh: 1.0, minSx: 0.8 });
    ruled(g, 110, 470, 700, "#111", 4);
    ["p1", "p2", "p3"].forEach((k, i) => textBox(g, HU(g, tx(g, k)), 110, 500 + i * 70, 700, 56, { font: "head", max: 46, min: 16, colour: "#111" }));
    ruled(g, 110, 725, 700, "#111", 4);
    textBox(g, tx(g, "note"), 110, 760, 700, 150, { font: "body", max: 40, min: 14, weight: 700, colour: "#111", lh: 1.25 });
    textBox(g, tx(g, "hand"), 110, 960, 640, 150, { font: "hand", max: 50, min: 18, colour: c.red, lh: 1.1 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(115, 1070); ctx.quadraticCurveTo(400, 1085, 700, 1064); ctx.stroke();
    ctx.restore();
    tape(g, 455, 70, 200, 50, -2, "kraft"); tape(g, 455, 1262, 200, 50, 0, "kraft");
    tape(g, 70, 70, 120, 44, -35, "kraft"); tape(g, 840, 70, 120, 44, 35, "kraft");
    polaroid(g, 920, 690, 300, 440, 2, { pad: 14, bottom: 60, tapeAt: "kraft" });
    textBox(g, tx(g, "cap"), 790, 880, 260, 40, { font: "hand", max: 30, min: 12, colour: "#111", align: "center", weight: 700 });
    ctx.fillStyle = "#9d9d9a"; ctx.beginPath(); ctx.roundRect(940, 1100, 60, 200, 10); ctx.fill();
    ctx.fillStyle = "#6c6c69"; ctx.beginPath(); ctx.arc(970, 1140, 20, 0, Math.PI * 2); ctx.fill();
  },

  // 22 --------------------------------------------------------------------
  redflags(g) {
    const { ctx, c } = g;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(310, 600); ctx.rotate((-0.8 * Math.PI) / 180); ctx.translate(-310, -600);
    paper(g, [[22, 40], [630, 30], [640, 1130], [30, 1150]], [true, false, true, true], "#f4f0e6", { seed: 5, amp: 6, fringe: "#e6e0d0" });
    ctx.restore();
    ctx.save(); ctx.translate(310, 600); ctx.rotate((-0.8 * Math.PI) / 180); ctx.translate(-310, -600);
    hline(g, "RED", 60, 70, 210, 120, c.red);
    hline(g, "FLAGS.", 300, 70, 310, 120, "#111");
    ctx.strokeStyle = c.red; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(60, 218); ctx.quadraticCurveTo(300, 206, 560, 222); ctx.stroke();
    ["l1", "l2", "l3", "l4", "l5", "l6"].forEach((k, i) => {
      const y = 250 + i * 122;
      ctx.strokeStyle = "#333"; ctx.lineWidth = 3; ctx.strokeRect(70, y + 28, 52, 52);
      ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(96, y + 54, 33, 0, Math.PI * 2); ctx.stroke();
      textBox(g, HU(g, tx(g, k)), 150, y + 18, 440, 84, { font: "head", max: 40, min: 14, colour: "#111", lh: 1.02 });
      ruled(g, 60, y + 112, 560, faint(g, 0.25), 2);
    });
    ctx.restore();
    // photo
    sheet(g, 600, 300, 420, 640, "#f1ede2", 3, { vignette: false });
    framedPhoto(g, 620, 320, 380, 600, 3, 0, "#f1ede2", { shadow: false });
    paperclip(g, 860, 296, 8, "#9a9da3");
    ctx.save(); ctx.translate(790, 1000); ctx.rotate((-2 * Math.PI) / 180);
    ctx.fillStyle = "#e8f23a"; ctx.fillRect(-190, -48, 380, 96);
    textBox(g, HU(g, tx(g, "hi")), -176, -38, 352, 76, { font: "head", max: 36, min: 14, colour: "#111", align: "center", lh: 1.02 });
    ctx.restore();
    textBox(g, tx(g, "leave"), 60, 1150, 760, 60, { font: "hand", max: 54, min: 18, colour: c.red, weight: 700 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(840, 1180); ctx.lineTo(980, 1180); ctx.moveTo(955, 1160); ctx.lineTo(982, 1180); ctx.lineTo(955, 1200); ctx.stroke();
    roundStamp(g, 970, 1250, 66, -8, c.red, tx(g, "score") || "8/10", 38);
    ctx.fillStyle = c.tag; ctx.fillRect(230, 1240, 560, 70);
    foot(g, 1258, "#111", { x: 240, w: 540, size: 28 });
  },

  // 23 --------------------------------------------------------------------
  nosaid(g) {
    const { ctx, c } = g;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = rgba(c.light, 0.3); ctx.lineWidth = 6; ctx.strokeRect(10, 10, W - 20, H - 20);
    textBox(g, HU(g, tx(g, "small")), 50, 40, 300, 44, { font: "head", max: 40, min: 14, colour: c.red });
    ruled(g, 130, 62, 200, c.red, 3);
    hstack(g, [{ text: tx(g, "red"), colour: c.red }], 50, 100, 430, 250, 120, { lh: 0.98, minSx: 0.75 });
    hline(g, tx(g, "big"), 50, 320, 430, 330, c.light, { minSx: 0.6 });
    ctx.fillStyle = "#101010"; ctx.fillRect(488, 28, 558, 806);
    ctx.save(); ctx.beginPath(); ctx.rect(494, 34, 546, 794); ctx.clip(); ctx.translate(767, 431); drawPhoto(g, 546, 794); ctx.restore();
    g.slots.push({ i: 0, x: 494, y: 34, w: 546, h: 794, rot: 0 });
    ruled(g, 40, 860, 1000, rgba(c.light, 0.4), 2);
    // a plain mask badge
    ctx.fillStyle = c.red; ctx.beginPath(); ctx.ellipse(130, 960, 74, 84, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; [[100, 940], [160, 940]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); });
    [[130, 990], [110, 1010], [150, 1010], [130, 1030]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = rgba(c.light, 0.4); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(240, 870); ctx.lineTo(240, 1040); ctx.stroke();
    textBox(g, HU(g, tx(g, "body")), 270, 880, 770, 150, { font: "body", max: 32, min: 12, weight: 700, colour: c.light, lh: 1.3 });
    ruled(g, 40, 1060, 1000, rgba(c.light, 0.4), 2);
    textBox(g, HU(g, tx(g, "scary")), 50, 1080, 980, 110, { font: "head", max: 44, min: 14, colour: c.red, lh: 1.06 });
    stampBox(g, 290, 1250, 470, 120, -3, tx(g, "stamp"), c.red, 40, { alpha: 0.95 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.strokeRect(570, 1196, 470, 120);
    textBox(g, HU(g, tx(g, "clinic")), 590, 1214, 430, 84, { font: "head", max: 66, min: 18, colour: c.light, align: "center" });
  },
};
void bg; void paper; void rand; void shade;
