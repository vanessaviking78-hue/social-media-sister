// Unique covers 1 to 12.
import { HU, bg, drawPhoto, paper, paperclip, polaroid, rand, rgba, shade, tape, textBox, type G } from "./xmas-designs";
import { archPath, brush, hline, photoPaper } from "./halloween-designs";
import { barcode, faint, framedPhoto, pin, redact, roundStamp, sheet, speckle, stampBox, tallWrap as hstack, tx, up } from "./unique-kit";

type L = (g: G) => void;
const W = 1080, H = 1350;

const foot = (g: G, y: number, colour: string, o?: { x?: number; w?: number; align?: CanvasTextAlign; size?: number }) =>
  textBox(g, HU(g, tx(g, "footer")), o?.x ?? 60, y, o?.w ?? 960, 44, { font: "body", weight: 700, max: o?.size ?? 28, min: 13, colour, align: o?.align ?? "center", lh: 1.1 });

export const LAYOUTS_A: Record<string, L> = {
  // 1 ---------------------------------------------------------------------
  book(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = "#121212"; ctx.fillRect(0, 0, 125, H);
    ctx.fillStyle = c.tag;
    [34, 52, 70, 300, 318, 1180, 1198].forEach((y) => ctx.fillRect(14, y, 97, 3));
    ctx.strokeStyle = c.tag; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(62, 1250, 32, 0, Math.PI * 2); ctx.stroke();
    textBox(g, (tx(g, "clinic").trim()[0] ?? "N").toUpperCase(), 32, 1226, 60, 50, { font: "head", max: 40, min: 20, colour: c.tag, align: "center", lh: 1 });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = c.frame; ctx.fillRect(150, 40, 890, 1270);
    ctx.restore();
    ctx.strokeStyle = c.tag; ctx.lineWidth = 3; ctx.strokeRect(170, 60, 850, 1230);
    hstack(g, [{ text: tx(g, "h1"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }, { text: tx(g, "h2"), colour: c.ink }], 205, 110, 400, 700, 120, { lh: 0.98, minSx: 0.55 });
    ctx.fillStyle = c.tag; ctx.fillRect(205, 840, 400, 3);
    textBox(g, HU(g, tx(g, "sub")), 205, 880, 400, 190, { font: "script", max: 40, min: 20, colour: c.red, lh: 1.3, weight: 600 });
    ctx.fillStyle = c.tag; ctx.fillRect(205, 1110, 400, 3);
    textBox(g, tx(g, "name"), 205, 1135, 420, 60, { font: "script", max: 42, min: 18, colour: c.ink, weight: 700 });
    textBox(g, tx(g, "clinic"), 205, 1205, 420, 50, { font: "script", max: 32, min: 14, colour: c.red });
    const x = 640, y = 150, w = 360, h = 1050;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    archPath(ctx, x - 10, y - 10, w + 20, h + 20); ctx.fillStyle = c.tag; ctx.fill();
    ctx.restore();
    ctx.save();
    archPath(ctx, x, y, w, h); ctx.clip();
    ctx.translate(x + w / 2, y + h / 2); drawPhoto(g, w, h);
    ctx.restore();
    g.slots.push({ i: 0, x, y, w, h, rot: 0 });
  },

  // 2 ---------------------------------------------------------------------
  notice(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.lineWidth = 1.5; ctx.strokeRect(36, 36, W - 72, H - 72);
    // ref and date boxes
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, 200, 180); ctx.strokeRect(820, 60, 200, 180);
    textBox(g, "REF. NO.", 74, 76, 170, 30, { font: "body", max: 22, min: 12, weight: 800, colour: c.ink });
    textBox(g, tx(g, "ref"), 74, 120, 170, 100, { font: "script", max: 84, min: 30, colour: c.red });
    textBox(g, "NOTICE DATE", 834, 76, 170, 30, { font: "body", max: 22, min: 12, weight: 800, colour: c.ink });
    textBox(g, "OFFICIAL NOTICE", 280, 120, 520, 40, { font: "body", max: 34, min: 16, weight: 800, colour: c.ink, align: "center" });
    ctx.fillStyle = c.tag; ctx.fillRect(290, 180, 500, 2);
    hstack(g, [{ text: tx(g, "h1"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }, { text: tx(g, "h2"), colour: c.ink }], 80, 280, 920, 520, 150, { lh: 1.0, minSx: 0.6, align: "center" });
    // table
    const ty = 830;
    ctx.fillStyle = shade(c.green, 0.2); ctx.fillRect(80, ty, 640, 48);
    textBox(g, "PLEASE NOTE", 80, ty + 8, 640, 34, { font: "body", max: 28, min: 12, weight: 800, colour: c.light, align: "center" });
    [["01.", "n1"], ["02.", "n2"], ["03.", "n3"]].forEach(([n, k], i) => {
      const y = ty + 48 + i * 78;
      ctx.fillStyle = rgba(c.frame, 0.9); ctx.fillRect(80, y, 640, 78);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect(80, y, 640, 78);
      ctx.beginPath(); ctx.moveTo(180, y); ctx.lineTo(180, y + 78); ctx.stroke();
      textBox(g, n, 80, y + 18, 100, 44, { font: "script", max: 40, min: 16, colour: c.red, align: "center" });
      textBox(g, HU(g, tx(g, k)), 196, y + 8, 510, 62, { font: "body", max: 22, min: 12, weight: 700, colour: c.ink, lh: 1.2 });
    });
    roundStamp(g, 880, 985, 115, -14, c.red, tx(g, "stampB") || "FINAL", 44);
    // law box
    ctx.fillStyle = rgba(c.tag, 0.55); ctx.fillRect(80, 1140, 920, 112);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect(80, 1140, 920, 112);
    textBox(g, HU(g, tx(g, "law")), 100, 1156, 880, 40, { font: "body", max: 34, min: 14, weight: 800, colour: c.ink, align: "center" });
    textBox(g, HU(g, tx(g, "use")), 100, 1200, 880, 44, { font: "body", max: 36, min: 14, weight: 800, colour: c.red, align: "center" });
    ctx.fillStyle = c.ink; ctx.fillRect(60, 1268, 960, 2);
    foot(g, 1278, faint(g, 0.7), { size: 22 });
  },

  // 3 ---------------------------------------------------------------------
  crime(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.strokeStyle = "rgba(40,30,20,0.55)"; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16);
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 62, 72, 440, 200, 120, { lh: 0.95, minSx: 0.6 });
    textBox(g, HU(g, tx(g, "sub")), 62, 300, 440, 200, { font: "head", max: 56, min: 24, colour: c.ink, lh: 1.04 });
    // case file box
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(50, 520, 460, 310);
    ctx.beginPath(); ctx.moveTo(120, 520); ctx.lineTo(120, 830); ctx.stroke();
    ctx.save(); ctx.translate(86, 800); ctx.rotate(-Math.PI / 2);
    textBox(g, "CASE FILE", 0, -14, 280, 34, { font: "body", max: 24, min: 12, weight: 800, colour: c.ink });
    ctx.restore();
    textBox(g, "CASE FILE:", 140, 548, 340, 26, { font: "body", max: 22, min: 11, weight: 700, colour: c.ink });
    textBox(g, HU(g, tx(g, "case")), 140, 580, 340, 50, { font: "head", max: 42, min: 16, colour: c.green });
    ctx.fillStyle = c.ink; ctx.fillRect(130, 650, 360, 2);
    textBox(g, "EVIDENCE REVIEW:", 140, 676, 340, 26, { font: "body", max: 22, min: 11, weight: 700, colour: c.ink });
    textBox(g, HU(g, tx(g, "review")), 140, 708, 340, 90, { font: "head", max: 40, min: 16, colour: c.green, lh: 1.04 });
    // navy box
    ctx.fillStyle = c.green; ctx.fillRect(50, 860, 560, 260);
    textBox(g, HU(g, tx(g, "big")), 80, 884, 500, 214, { font: "head", max: 76, min: 24, colour: c.light, lh: 1.02 });
    redact(g, 640, 905, [300, 250, 320, 220], 26, 22);
    ctx.fillStyle = "#d4711f"; ctx.fillRect(900, 915, 50, 50);
    ctx.fillStyle = "#d4711f"; ctx.fillRect(690, 1040, 80, 80);
    textBox(g, "2", 690, 1050, 80, 60, { font: "head", max: 52, min: 20, colour: c.ink, align: "center" });
    // footer plate
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(50, 1205, 980, 100);
    foot(g, 1235, c.ink, { x: 90, w: 900, size: 34 });
    // evidence photo, tilted
    polaroid(g, 790, 480, 540, 740, 4, { pad: 18, bottom: 18 });
    // tag
    ctx.save(); ctx.translate(555, 105); ctx.rotate((-12 * Math.PI) / 180);
    ctx.fillStyle = "#e3a24a"; ctx.beginPath(); ctx.moveTo(-70, -60); ctx.lineTo(70, -60); ctx.lineTo(70, 80); ctx.lineTo(0, 110); ctx.lineTo(-70, 80); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(0, -42, 8, 0, Math.PI * 2); ctx.fill();
    textBox(g, HU(g, tx(g, "tag")), -62, -22, 124, 100, { font: "head", max: 34, min: 14, colour: c.ink, align: "center", lh: 1.02 });
    ctx.restore();
    roundStamp(g, 940, 230, 70, -12, shade(c.green, 0), "EVIDENCE", 20);
  },

  // 4 ---------------------------------------------------------------------
  recall(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = c.tag; ctx.fillRect(0, 0, W, 190);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 6; ctx.strokeRect(6, 6, W - 12, 178);
    // warning triangle
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.moveTo(98, 28); ctx.lineTo(176, 160); ctx.lineTo(20, 160); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.tag; ctx.fillRect(92, 70, 12, 50); ctx.fillRect(92, 130, 12, 12);
    hline(g, tx(g, "h1"), 200, 22, 820, 100, c.ink, { minSx: 0.55 });
    hline(g, tx(g, "h2"), 200, 112, 820, 66, c.ink, { minSx: 0.5 });
    // affected batches
    ctx.fillStyle = c.red; ctx.fillRect(14, 218, 450, 290);
    textBox(g, "AFFECTED BATCHES:", 36, 236, 410, 40, { font: "head", max: 36, min: 14, colour: c.light });
    textBox(g, HU(g, tx(g, "batch")), 36, 290, 410, 200, { font: "head", max: 58, min: 20, colour: c.light, lh: 1.04 });
    // rows
    [["REASON FOR RECALL:", "reason"], ["ACTION:", "action"], ["STATUS:", "status"]].forEach(([lab, k], i) => {
      const y = 520 + i * 110;
      ctx.fillStyle = rgba(c.frame, 0.9); ctx.fillRect(14, y, 450, 100);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(14, y, 450, 100);
      ctx.fillStyle = c.tag; ctx.fillRect(26, y + 18, 64, 64);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(58, y + 50, 14, 0, Math.PI * 2); ctx.stroke();
      textBox(g, lab, 104, y + 10, 350, 26, { font: "body", max: 20, min: 10, weight: 800, colour: c.ink });
      textBox(g, HU(g, tx(g, k)), 104, y + 38, 350, 58, { font: "head", max: 34, min: 14, colour: c.ink, lh: 1.02 });
    });
    // lined note
    ctx.fillStyle = rgba(c.frame, 0.9); ctx.fillRect(14, 855, 450, 220); ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(14, 855, 450, 220);
    ctx.strokeStyle = faint(g, 0.25); ctx.lineWidth = 2;
    for (let y = 895; y < 1030; y += 34) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(448, y); ctx.stroke(); }
    textBox(g, "THIS NOTICE IS FOR INFORMATIONAL PURPOSES ONLY.", 30, 1036, 420, 30, { font: "body", max: 17, min: 9, weight: 800, colour: c.red, align: "center" });
    // photo
    ctx.fillStyle = c.green; ctx.fillRect(480, 218, 586, 62);
    textBox(g, "CLINICIAN / TREATMENT PHOTO", 500, 232, 550, 36, { font: "body", max: 26, min: 12, weight: 700, colour: c.light });
    ctx.save(); ctx.beginPath(); ctx.rect(480, 280, 586, 590); ctx.clip(); ctx.translate(773, 575); drawPhoto(g, 586, 590); ctx.restore();
    g.slots.push({ i: 0, x: 480, y: 280, w: 586, h: 590, rot: 0 });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.strokeRect(480, 218, 586, 652);
    stampBox(g, 880, 790, 360, 130, -9, tx(g, "stamp"), c.red, 84, { alpha: 0.88 });
    // inspection notes
    ctx.fillStyle = rgba(c.frame, 0.9); ctx.fillRect(14, 1100, 1052, 160); ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(14, 1100, 1052, 160);
    ctx.fillStyle = c.tag; ctx.fillRect(14, 1100, 220, 160);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(124, 1180, 46, 0, Math.PI * 2); ctx.stroke();
    textBox(g, HU(g, tx(g, "notes")), 260, 1120, 780, 120, { font: "body", max: 30, min: 12, weight: 700, colour: c.ink });
    ctx.fillStyle = "#151515"; ctx.fillRect(0, 1280, W, 70);
    foot(g, 1298, c.tag, { size: 30 });
  },

  // 5 ---------------------------------------------------------------------
  divorce(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = shade(c.paper, -0.05); ctx.fillRect(0, 0, 70, H);
    for (let y = 60; y < H - 60; y += 96) { ctx.fillStyle = "#cfc7b5"; ctx.beginPath(); ctx.arc(34, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = c.red; ctx.beginPath(); ctx.moveTo(W - 260, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 200); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = faint(g, 0.5); ctx.lineWidth = 2; ctx.strokeRect(110, 60, 300, 70);
    textBox(g, "CASE NUMBER:", 120, 68, 280, 24, { font: "body", max: 16, min: 9, weight: 700, colour: faint(g, 0.8) });
    textBox(g, "IN THE COURT OF PERSONAL CARE", 270, 150, 540, 30, { font: "body", max: 18, min: 9, weight: 700, colour: faint(g, 0.8), align: "center" });
    textBox(g, HU(g, tx(g, "top")), 120, 190, 840, 120, { font: "script", max: 104, min: 34, colour: c.ink, align: "center", weight: 500 });
    hline(g, tx(g, "big"), 110, 290, 860, 200, c.red, { align: "center", minSx: 0.6 });
    const rows: [string, string][] = [["APPLICANT:", "appl"], ["RESPONDENT:", "resp"], ["GROUNDS:", "grounds"], ["STATUS:", "status"]];
    rows.forEach(([lab, k], i) => {
      const y = 520 + i * 115;
      ctx.fillStyle = c.green; ctx.beginPath(); ctx.arc(150, y + 40, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.light; ctx.beginPath(); ctx.arc(150, y + 32, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(134, y + 46, 32, 12);
      textBox(g, lab, 210, y, 320, 28, { font: "body", max: 22, min: 10, weight: 700, colour: faint(g, 0.8) });
      textBox(g, HU(g, tx(g, k)), 210, y + 28, 330, 82, { font: "head", max: 46, min: 16, colour: c.green, lh: 1.02 });
    });
    framedPhoto(g, 570, 500, 440, 480, 0, 8, c.frame);
    ctx.strokeStyle = c.green; ctx.lineWidth = 3; ctx.strokeRect(570, 500, 440, 480);
    // info box
    ctx.strokeStyle = c.red; ctx.lineWidth = 2; ctx.strokeRect(100, 1010, 880, 150);
    ctx.fillStyle = c.green; ctx.beginPath(); ctx.arc(190, 1085, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.light; ctx.fillRect(172, 1062, 36, 46);
    textBox(g, tx(g, "info"), 270, 1040, 680, 50, { font: "script", max: 30, min: 12, colour: c.red });
    textBox(g, HU(g, tx(g, "line")), 100, 1180, 560, 60, { font: "body", max: 20, min: 10, weight: 700, colour: faint(g, 0.8) });
    ctx.fillStyle = faint(g, 0.6); ctx.fillRect(100, 1248, 280, 2); ctx.fillRect(420, 1248, 200, 2);
    textBox(g, "APPLICANT SIGNATURE", 100, 1254, 280, 20, { font: "body", max: 14, min: 8, weight: 700, colour: faint(g, 0.7) });
    textBox(g, "DATE", 420, 1254, 200, 20, { font: "body", max: 14, min: 8, weight: 700, colour: faint(g, 0.7) });
    roundStamp(g, 900, 1235, 62, -12, c.red, "SELF-CARE APPROVED", 14);
    ctx.fillStyle = c.green; ctx.fillRect(70, 1292, W - 70, 58);
    foot(g, 1304, c.light, { x: 110, w: 900, size: 30 });
  },

  // 6 ---------------------------------------------------------------------
  news(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = c.red; ctx.fillRect(24, 24, 700, 120);
    hline(g, tx(g, "ex"), 40, 30, 670, 110, c.light, { minSx: 0.55 });
    ctx.fillStyle = "#121212"; ctx.fillRect(724, 24, 332, 120);
    textBox(g, HU(g, tx(g, "brk")), 740, 34, 300, 100, { font: "head", max: 44, min: 16, colour: c.light, align: "center", lh: 1.0 });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }], 28, 160, 1020, 270, 140, { lh: 0.98, minSx: 0.75 });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 6; ctx.strokeRect(34, 446, 740, 660);
    ctx.save(); ctx.beginPath(); ctx.rect(37, 449, 734, 654); ctx.clip(); ctx.translate(404, 776); drawPhoto(g, 734, 654); ctx.restore();
    g.slots.push({ i: 0, x: 37, y: 449, w: 734, h: 654, rot: 0 });
    ctx.fillStyle = c.green; ctx.fillRect(786, 450, 270, 62);
    textBox(g, HU(g, tx(g, "inside")), 790, 462, 262, 40, { font: "head", max: 34, min: 12, colour: c.light, align: "center" });
    ctx.fillStyle = rgba(c.frame, 0.95); ctx.fillRect(786, 512, 270, 330); ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.strokeRect(786, 512, 270, 330);
    textBox(g, HU(g, tx(g, "box1")), 796, 524, 250, 130, { font: "head", max: 34, min: 12, colour: c.ink, align: "center", lh: 1.0 });
    ctx.fillStyle = c.ink; ctx.fillRect(850, 680, 140, 150);
    ctx.fillStyle = c.frame; ctx.fillRect(862, 696, 116, 120);
    ctx.fillStyle = c.green; ctx.fillRect(900, 672, 40, 20);
    ctx.fillStyle = c.red; ctx.fillRect(786, 856, 270, 250);
    textBox(g, HU(g, tx(g, "box2")), 796, 880, 250, 140, { font: "head", max: 40, min: 14, colour: c.light, align: "center", lh: 1.0 });
    ctx.fillStyle = c.light; ctx.beginPath(); ctx.ellipse(920, 1055, 38, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(914, 1085, 12, 18);
    ctx.fillStyle = c.green; ctx.fillRect(34, 1116, 1022, 168);
    hstack(g, [{ text: tx(g, "bottom"), colour: c.light }, { text: tx(g, "hot2"), colour: "#ffd23a" }], 54, 1128, 960, 150, 74, { lh: 1.0, minSx: 0.7 });
    ctx.fillStyle = c.red; [1294, 1306, 1318].forEach((y) => { ctx.fillRect(34, y, 150, 4); ctx.fillRect(906, y, 150, 4); });
    foot(g, 1294, c.ink, { x: 200, w: 680, size: 28 });
  },

  // 7 ---------------------------------------------------------------------
  brief(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(80, 85, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.frame; ctx.fillRect(66, 70, 28, 30);
    textBox(g, HU(g, tx(g, "org")), 140, 52, 520, 44, { font: "head", max: 40, min: 14, colour: c.red });
    textBox(g, HU(g, tx(g, "sub")), 140, 98, 520, 30, { font: "body", max: 22, min: 10, weight: 700, colour: c.ink });
    ctx.fillStyle = c.ink; ctx.fillRect(700, 40, 3, 100);
    textBox(g, "MEETING REF.", 724, 50, 300, 26, { font: "body", max: 20, min: 10, weight: 700, colour: c.ink });
    textBox(g, HU(g, tx(g, "ref")), 724, 82, 320, 52, { font: "head", max: 44, min: 14, colour: c.red });
    ctx.fillStyle = c.ink; ctx.fillRect(40, 150, 1000, 3);
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 40, 175, 520, 340, 100, { lh: 1.0, minSx: 0.6 });
    ctx.fillStyle = shade(c.frame, -0.04); ctx.fillRect(40, 570, 520, 200); ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.strokeRect(40, 570, 520, 200);
    textBox(g, "THREAT LEVEL:", 60, 585, 480, 26, { font: "body", max: 22, min: 10, weight: 700, colour: c.red });
    textBox(g, HU(g, tx(g, "threat")), 60, 615, 480, 50, { font: "head", max: 40, min: 14, colour: c.red });
    ctx.fillStyle = faint(g, 0.4); ctx.fillRect(60, 676, 480, 2);
    textBox(g, "RESPONSE:", 60, 688, 480, 26, { font: "body", max: 22, min: 10, weight: 700, colour: c.red });
    textBox(g, HU(g, tx(g, "resp")), 60, 718, 480, 46, { font: "head", max: 40, min: 14, colour: c.red });
    framedPhoto(g, 566, 170, 480, 660, 0, 6, c.tag);
    ctx.fillStyle = c.tag; ctx.fillRect(566, 830, 480, 50);
    textBox(g, "CLINICIAN PHOTO", 566, 840, 480, 30, { font: "body", max: 24, min: 10, weight: 800, colour: c.ink, align: "center" });
    hstack(g, [{ text: tx(g, "big"), colour: c.ink }], 40, 810, 520, 210, 80, { lh: 1.0, minSx: 0.7 });
    stampBox(g, 800, 960, 300, 100, -6, tx(g, "filed"), c.red, 30, { alpha: 0.8 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(690, 1050, 360, 160);
    textBox(g, "AUTHORISED SIGN-OFF", 700, 1062, 340, 28, { font: "body", max: 20, min: 10, weight: 800, colour: c.red, align: "center" });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(740, 1170); ctx.bezierCurveTo(790, 1100, 820, 1190, 860, 1130); ctx.bezierCurveTo(900, 1090, 930, 1180, 990, 1140); ctx.stroke();
    textBox(g, "CHIEF ADVISER", 700, 1180, 340, 24, { font: "body", max: 18, min: 9, weight: 800, colour: c.ink, align: "center" });
    textBox(g, "EVIDENCE REF:  EV-46-LINE-001\nCLASSIFICATION:  SENSIBLE", 40, 1070, 560, 80, { font: "body", max: 20, min: 10, weight: 600, colour: c.ink, lh: 1.5 });
    ctx.fillStyle = c.ink; ctx.fillRect(40, 1240, 1000, 3);
    textBox(g, HU(g, tx(g, "footer")), 40, 1256, 1000, 30, { font: "body", max: 22, min: 10, weight: 800, colour: c.red });
    textBox(g, tx(g, "disc"), 40, 1296, 1000, 30, { font: "body", max: 18, min: 9, weight: 500, colour: faint(g, 0.8), align: "center" });
  },

  // 8 ---------------------------------------------------------------------
  planning(g) {
    const { ctx, c } = g;
    bg(g);
    ctx.fillStyle = c.ink; ctx.fillRect(40, 40, 1000, 2);
    textBox(g, HU(g, tx(g, "auth")), 50, 56, 480, 56, { font: "body", max: 20, min: 9, weight: 800, colour: c.ink, lh: 1.25 });
    textBox(g, "DECISION NOTICE\nREFERENCE NUMBER", 640, 54, 190, 56, { font: "body", max: 14, min: 8, weight: 700, colour: faint(g, 0.8), lh: 1.2 });
    textBox(g, HU(g, tx(g, "refno")), 750, 36, 300, 90, { font: "script", max: 78, min: 24, colour: c.red, align: "right" });
    ctx.fillStyle = c.ink; ctx.fillRect(40, 138, 1000, 3);
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }], 50, 170, 480, 350, 118, { lh: 1.0, minSx: 0.6 });
    ctx.fillStyle = c.ink; ctx.fillRect(50, 560, 480, 3);
    textBox(g, "APPLICATION", 50, 580, 300, 24, { font: "body", max: 18, min: 9, weight: 800, colour: c.ink });
    textBox(g, HU(g, tx(g, "app")), 50, 612, 480, 190, { font: "script", max: 42, min: 16, colour: c.ink, lh: 1.25, weight: 500 });
    textBox(g, "DATE", 50, 790, 200, 22, { font: "body", max: 16, min: 8, weight: 800, colour: c.ink });
    ctx.fillStyle = c.ink; ctx.fillRect(50, 828, 70, 2);
    framedPhoto(g, 560, 200, 470, 640, 0, 0, c.frame, { shadow: false });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 4;
    [[560, 200, 1, 1], [1030, 200, -1, 1], [560, 840, 1, -1], [1030, 840, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * 34); ctx.lineTo(x, y); ctx.lineTo(x + sx * 34, y); ctx.stroke(); });
    stampBox(g, 290, 905, 470, 150, -8, "REFUSED", c.red, 110, { alpha: 0.9 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(560, 880, 470, 160);
    textBox(g, "REASON:", 578, 892, 430, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.red });
    ctx.fillStyle = c.red; ctx.fillRect(578, 928, 430, 2);
    textBox(g, HU(g, tx(g, "reason")), 578, 942, 430, 90, { font: "head", max: 36, min: 14, colour: c.red, lh: 1.02 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(560, 1050, 470, 100);
    textBox(g, "APPEAL RIGHTS:", 578, 1060, 430, 28, { font: "body", max: 22, min: 10, weight: 800, colour: c.red });
    textBox(g, HU(g, tx(g, "appeal")), 578, 1092, 430, 50, { font: "head", max: 40, min: 14, colour: c.ink });
    textBox(g, "ADMINISTRATIVE OFFICER", 50, 1065, 380, 22, { font: "body", max: 16, min: 8, weight: 800, colour: c.ink });
    redact(g, 50, 1096, [300, 200, 280], 22, 12);
    roundStamp(g, 430, 1200, 70, -10, c.red, "LOCAL GOVERNANCE", 13);
    ctx.fillStyle = c.ink; ctx.fillRect(40, 1262, 1000, 3);
    textBox(g, HU(g, tx(g, "c1")), 50, 1286, 460, 40, { font: "head", max: 32, min: 12, colour: c.red, align: "center" });
    textBox(g, HU(g, tx(g, "c2")), 570, 1286, 460, 40, { font: "head", max: 32, min: 12, colour: c.red, align: "center" });
  },

  // 9 ---------------------------------------------------------------------
  missing(g) {
    const { ctx, c } = g;
    speckle(g, "#3b3a3a", 21, 3000, "rgba(0,0,0,", "rgba(255,255,255,");
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(60, 0, 960, H);
    ctx.fillStyle = "#2a2a29"; ctx.fillRect(60, 0, 30, H); ctx.fillRect(990, 0, 30, H);
    sheet(g, 134, 84, 800, 1040, c.frame, 0.6);
    ctx.save(); ctx.translate(534, 604); ctx.rotate((0.6 * Math.PI) / 180); ctx.translate(-534, -604);
    ctx.fillStyle = c.red; ctx.fillRect(190, 140, 640, 110);
    hline(g, tx(g, "band"), 190, 148, 640, 90, c.light, { minSx: 0.6 });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 190, 280, 640, 340, 100, { lh: 1.0, minSx: 0.6 });
    ctx.fillStyle = c.ink; ctx.fillRect(190, 650, 640, 5);
    const rows: [string, string][] = [["l1", "v1"], ["l2", "v2"], ["l3", "v3"]];
    rows.forEach(([a, b], i) => {
      const y = 680 + i * 130;
      textBox(g, tx(g, a), 190, y, 380, 30, { font: "body", max: 24, min: 10, weight: 800, colour: c.red });
      textBox(g, tx(g, b), 190, y + 32, 380, 70, { font: "body", max: 28, min: 12, weight: 700, colour: c.ink, lh: 1.15 });
      ctx.fillStyle = faint(g, 0.5); ctx.fillRect(190, y + 112, 340, 2);
    });
    ctx.restore();
    // the photo, black and white, taped
    const wasMono = g.mono; g.mono = true;
    polaroid(g, 700, 880, 300, 330, 3, { pad: 12, bottom: 12 });
    g.mono = wasMono;
    tape(g, 700, 722, 190, 44, 14, "kraft");
    // tear off tabs
    for (let i = 0; i < 6; i++) {
      const x = 150 + i * 130, y = 1124 + (i === 0 ? 20 : 0);
      ctx.save(); ctx.translate(x + 60, y + 100); ctx.rotate(((i === 0 ? -14 : (i % 2 ? 1 : -1) * 1.4) * Math.PI) / 180);
      ctx.fillStyle = c.frame; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 8; ctx.fillRect(-60, -100, 118, 200);
      ctx.shadowColor = "transparent";
      textBox(g, HU(g, tx(g, "tab")), -54, -60, 106, 90, { font: "head", max: 26, min: 10, colour: c.ink, align: "center", lh: 1.0 });
      ctx.restore();
    }
  },

  // 10 --------------------------------------------------------------------
  advisory(g) {
    const { ctx, c } = g;
    ctx.fillStyle = "#151515"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(26, 26, W - 52, H - 52); ctx.clip("evenodd");
    for (let k = -H; k < W + H; k += 40) { ctx.fillStyle = (k / 40) % 2 === 0 ? "#d6c7a1" : "#151515"; ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 20, 0); ctx.lineTo(k + 20 - H, H); ctx.lineTo(k - H, H); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(26, 26, W - 52, 130);
    ctx.strokeStyle = c.tag; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(108, 92, 40, 0, Math.PI * 2); ctx.stroke();
    textBox(g, HU(g, tx(g, "top")), 170, 52, 560, 50, { font: "body", max: 38, min: 14, weight: 700, colour: c.light });
    textBox(g, HU(g, tx(g, "ref")), 170, 104, 560, 36, { font: "body", max: 28, min: 12, weight: 600, colour: c.tag });
    ctx.fillStyle = c.frame; ctx.fillRect(26, 156, W - 52, H - 156 - 26);
    textBox(g, HU(g, tx(g, "warn")), 60, 178, 960, 130, { font: "script", max: 122, min: 40, colour: c.red, align: "center", weight: 500 });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }], 60, 310, 960, 190, 84, { lh: 1.0, minSx: 0.7, align: "center" });
    // side effects panel
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(50, 560, 490, 420);
    ctx.strokeStyle = c.red; ctx.lineWidth = 3; ctx.strokeRect(60, 570, 470, 400);
    textBox(g, HU(g, tx(g, "listh")), 75, 582, 440, 120, { font: "script", max: 30, min: 14, colour: c.red, align: "center", lh: 1.25, weight: 500 });
    ["i1", "i2", "i3"].forEach((k, i) => {
      const y = 718 + i * 82;
      ctx.strokeStyle = c.red; ctx.lineWidth = 2; ctx.strokeRect(78, y, 44, 44);
      textBox(g, String(i + 1), 78, y + 5, 44, 36, { font: "script", max: 26, min: 12, colour: c.red, align: "center" });
      textBox(g, HU(g, tx(g, k)), 140, y + 4, 380, 66, { font: "body", max: 28, min: 12, weight: 700, colour: c.light, lh: 1.1 });
      ctx.fillStyle = rgba(c.light, 0.2); ctx.fillRect(78, y + 62, 440, 2);
    });
    // photo
    ctx.strokeStyle = c.green; ctx.lineWidth = 3; ctx.strokeRect(552, 570, 478, 450);
    ctx.save(); ctx.beginPath(); ctx.rect(555, 573, 472, 400); ctx.clip(); ctx.translate(791, 773); drawPhoto(g, 472, 400); ctx.restore();
    g.slots.push({ i: 0, x: 555, y: 573, w: 472, h: 400, rot: 0 });
    ctx.fillStyle = c.red; ctx.fillRect(555, 973, 472, 47);
    textBox(g, HU(g, tx(g, "cap")), 560, 982, 462, 32, { font: "body", max: 22, min: 10, weight: 800, colour: c.light, align: "center" });
    // stamp and disclaimer
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.strokeRect(60, 1040, 310, 190);
    textBox(g, HU(g, tx(g, "cls")), 70, 1052, 290, 30, { font: "script", max: 24, min: 10, colour: c.red, align: "center" });
    textBox(g, HU(g, tx(g, "red")), 70, 1084, 290, 90, { font: "script", max: 84, min: 20, colour: c.red, align: "center", weight: 700 });
    textBox(g, HU(g, tx(g, "cls2")), 70, 1180, 290, 40, { font: "body", max: 16, min: 8, weight: 700, colour: c.red, align: "center" });
    roundStamp(g, 480, 1135, 78, -8, c.red, "UNSOLICITED OPINION", 13);
    ctx.fillStyle = shade(c.frame, -0.05); ctx.fillRect(590, 1040, 440, 190); ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect(590, 1040, 440, 190);
    textBox(g, "DISCLAIMER:", 604, 1050, 410, 24, { font: "body", max: 20, min: 9, weight: 800, colour: c.ink });
    textBox(g, tx(g, "disc"), 604, 1080, 412, 144, { font: "body", max: 22, min: 9, weight: 600, colour: c.ink, lh: 1.2 });
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(26, 1250, W - 52, 74);
    textBox(g, "CLINIC:", 60, 1258, 100, 24, { font: "body", max: 16, min: 8, weight: 700, colour: c.light });
    textBox(g, HU(g, tx(g, "clinic")), 60, 1280, 440, 40, { font: "script", max: 34, min: 12, colour: c.light });
    ctx.fillStyle = c.tag; ctx.fillRect(540, 1262, 2, 50);
    textBox(g, "CLINICIAN:", 580, 1258, 140, 24, { font: "body", max: 16, min: 8, weight: 700, colour: c.light });
    textBox(g, HU(g, tx(g, "clin")), 580, 1280, 430, 40, { font: "script", max: 34, min: 12, colour: c.light });
  },

  // 11 --------------------------------------------------------------------
  board(g) {
    const { ctx, c } = g;
    speckle(g, c.paper, 33, 5000, "rgba(70,40,15,", "rgba(255,225,170,");
    const str = (x1: number, y1: number, x2: number, y2: number) => { ctx.save(); ctx.strokeStyle = "#a82a22"; ctx.lineWidth = 4; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 40, x2, y2); ctx.stroke(); ctx.restore(); };
    // big note
    paper(g, [[34, 28], [740, 22], [736, 628], [38, 632]], [true, false, true, false], c.frame, { seed: 3, amp: 4 });
    hstack(g, [{ text: tx(g, "h"), colour: c.ink }, { text: tx(g, "hot"), colour: c.red }], 80, 70, 610, 520, 112, { lh: 0.98, minSx: 0.78 });
    // newspaper clipping
    ctx.save(); ctx.translate(900, 200); ctx.rotate((2 * Math.PI) / 180);
    ctx.fillStyle = "#e7dfc9"; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 14; ctx.fillRect(-150, -180, 300, 380);
    ctx.shadowColor = "transparent"; ctx.fillStyle = "#b7ac90"; ctx.fillRect(-135, -166, 270, 110);
    textBox(g, tx(g, "clip"), -135, -42, 270, 100, { font: "script", max: 28, min: 11, colour: c.ink, weight: 800, lh: 1.15 });
    ctx.fillStyle = "rgba(60,50,40,0.35)"; for (let y = 70; y < 190; y += 12) ctx.fillRect(-135, y, 270, 3);
    ctx.restore();
    // grey note
    sheet(g, 33, 750, 500, 215, "#d6d0c3", -1.5, { vignette: false });
    textBox(g, HU(g, tx(g, "note")), 60, 785, 450, 150, { font: "head", max: 52, min: 18, colour: c.ink, lh: 1.04 });
    // handwritten note
    sheet(g, 40, 985, 400, 270, "#efe3c9", 1.5, { vignette: false });
    textBox(g, tx(g, "pink"), 62, 1040, 350, 150, { font: "hand", max: 56, min: 20, colour: c.red, weight: 700, lh: 1.1 });
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(70, 1200); ctx.quadraticCurveTo(210, 1215, 400, 1195); ctx.stroke();
    roundStamp(g, 500, 1090, 100, -8, c.red, tx(g, "stamp") || "EVIDENCE", 30);
    polaroid(g, 810, 800, 470, 540, 1.5, { pad: 16, bottom: 16, tapeAt: "kraft" });
    pin(g, 740, 40, "#c92b2b"); pin(g, 640, 540, "#c92b2b"); pin(g, 640, 1010, "#c92b2b"); pin(g, 60, 960, "#2f6f4f"); pin(g, 440, 1250, "#2f6f4f");
    str(740, 40, 640, 540); str(640, 540, 640, 1010);
    sheet(g, 30, 1262, 650, 66, c.frame, 0, { vignette: false });
    foot(g, 1278, c.ink, { x: 40, w: 630, size: 26 });
  },

  // 12 --------------------------------------------------------------------
  psa(g) {
    const { ctx, c } = g;
    speckle(g, c.paper, 51, 3500, "rgba(70,50,20,", "rgba(255,240,205,");
    ctx.fillStyle = rgba(c.frame, 0.35); ctx.fillRect(40, 40, W - 80, H - 80);
    ctx.save(); ctx.translate(900, 130); ctx.rotate((8 * Math.PI) / 180);
    ctx.strokeStyle = c.green; ctx.lineWidth = 5; ctx.strokeRect(-110, -55, 220, 110);
    textBox(g, HU(g, tx(g, "tag")), -98, -42, 196, 86, { font: "head", max: 36, min: 12, colour: c.green, align: "center", lh: 1.0 });
    ctx.restore();
    hstack(g, [{ text: tx(g, "h1"), colour: c.ink }, { text: tx(g, "h2"), colour: c.ink }, { text: tx(g, "hot"), colour: c.green }, { text: tx(g, "h3"), colour: c.ink }], 80, 120, 700, 440, 110, { lh: 1.0, minSx: 0.75 });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(80, 600); ctx.quadraticCurveTo(300, 585, 520, 604); ctx.stroke();
    [["l1", c.ink], ["l2", c.ink], ["l3", c.red]].forEach(([k, col], i) => {
      const y = 650 + i * 150;
      textBox(g, tx(g, k as string), 80, y, 440, 130, { font: "body", max: 30, min: 12, weight: 700, colour: col as string, lh: 1.25 });
      if (i < 2) { ctx.fillStyle = faint(g, 0.35); ctx.fillRect(80, y + 128, 440, 3); }
    });
    ctx.save(); ctx.translate(770, 910); ctx.rotate((0.5 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = c.frame; ctx.fillRect(-215, -270, 430, 540);
    ctx.shadowColor = "transparent";
    ctx.save(); ctx.beginPath(); ctx.rect(-203, -258, 406, 516); ctx.clip(); drawPhoto(g, 406, 516); ctx.restore();
    ctx.restore();
    g.slots.push({ i: 0, x: 567, y: 652, w: 406, h: 516, rot: 0.5 });
    ctx.fillStyle = "#555"; ctx.fillRect(740, 626, 60, 40);
    paperclip(g, 770, 650, 0, "#8d8f94");
    ctx.strokeStyle = faint(g, 0.6); ctx.lineWidth = 3; ctx.strokeRect(40, 1240, 1000, 70);
    foot(g, 1260, faint(g, 0.8), { size: 26 });
  },
};
void paperclip; void photoPaper; void brush; void barcode; void rand; void tape;
