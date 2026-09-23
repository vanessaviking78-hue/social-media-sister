// jsPDF and the QR encoder load from jsDelivr on first use, the same way the
// Audit page loads its PDF tools, so the site bundle and lockfile stay as
// they are.
type jsPDF = any;
const JSPDF_SRC = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
const QR_SRC = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      const w = window as any;
      if ((src === JSPDF_SRC && w.jspdf) || (src === QR_SRC && w.qrcode)) return resolve();
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the PDF tools, check your connection and try again."));
    document.head.appendChild(s);
  });
}

async function loadPdfLibs(): Promise<{ JsPDF: any; qrcode: any }> {
  const w = (typeof window !== "undefined" ? window : globalThis) as any;
  if (!w.jspdf?.jsPDF) await loadScript(JSPDF_SRC);
  if (!w.qrcode) await loadScript(QR_SRC);
  if (!w.jspdf?.jsPDF || !w.qrcode) throw new Error("Couldn't load the PDF tools, try again in a moment.");
  return { JsPDF: w.jspdf.jsPDF, qrcode: w.qrcode };
}

// Draws the QR code as crisp vector squares rather than an image.
function drawQr(doc: jsPDF, qrcode: any, url: string, x: number, y: number, size: number) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) doc.rect(x + c * cell, y + r * cell, cell + 0.02, cell + 0.02, "F");
    }
  }
}

export type NewsletterSection = { slot: string; label: string; topic: string; heading: string; body: string };
export type NewsletterContent = {
  subjectLines: string[];
  previewTexts: string[];
  intro: string;
  sections: NewsletterSection[];
  ctaText: string;
  signOff: string; // shown as the P.S. under the closing card
  closingThanks?: string;
  closingName?: string;
};

export type NewsletterClosing = {
  thanks: string;
  photoDataUrl: string | null; // circle-cropped PNG
  signatureDataUrl: string | null; // name in Caveat, transparent PNG
};

export type NewsletterBrand = {
  clinicName: string;
  newsletterName: string;
  monthLabel: string;
  accent: string; // hex
  logoDataUrl: string | null; // PNG data URL
  heroDataUrl: string | null; // JPEG data URL, already cropped to HERO_RATIO
  bookingUrl: string;
  address: string;
  closing?: NewsletterClosing | null;
};

export const HERO_RATIO = 16 / 9;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
export function parseHex(hex: string | null | undefined, fallback = "#b76e79"): [number, number, number] {
  let h = (hex || "").trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) h = fallback;
  if (h.length === 4) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function isLight([r, g, b]: [number, number, number]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// A deeper version of the accent for text on white, so pale brand colours
// (blush, champagne, pale gold) still read as headings.
export function readableAccent(rgb: [number, number, number]): [number, number, number] {
  if (!isLight(rgb)) return rgb;
  return rgb.map((c) => Math.round(c * 0.55)) as [number, number, number];
}

function tint(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map((c) => Math.round(c + (255 - c) * amount)) as [number, number, number];
}

// jsPDF's built-in fonts are WinAnsi, which covers curly quotes and £ but not
// every character a model might produce, so tidy the odd ones.
function clean(s: string) {
  return (s || "")
    .replace(/[—–]/g, ", ")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ‘’“”•€]/g, "");
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // side margin
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 16;
const PT = 0.3528; // mm per point

type Font = { family: "helvetica" | "times"; style: "normal" | "bold" | "italic" | "bolditalic"; size: number; lh: number };

const F = {
  label: { family: "helvetica", style: "bold", size: 7.5, lh: 1.2 } as Font,
  h1: { family: "times", style: "bold", size: 20, lh: 1.15 } as Font,
  h2: { family: "times", style: "bold", size: 15, lh: 1.18 } as Font,
  body: { family: "helvetica", style: "normal", size: 10, lh: 1.45 } as Font,
  intro: { family: "times", style: "italic", size: 12.5, lh: 1.4 } as Font,
  small: { family: "helvetica", style: "normal", size: 7.5, lh: 1.35 } as Font,
};

function setFont(doc: jsPDF, f: Font) {
  doc.setFont(f.family, f.style);
  doc.setFontSize(f.size);
}
const lineH = (f: Font) => f.size * f.lh * PT;

function wrap(doc: jsPDF, text: string, f: Font, width: number): string[] {
  setFont(doc, f);
  return doc.splitTextToSize(clean(text), width) as string[];
}

function paragraphs(body: string) {
  return clean(body)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function measureParas(doc: jsPDF, body: string, f: Font, width: number) {
  const paras = paragraphs(body);
  let h = 0;
  paras.forEach((p, i) => {
    h += wrap(doc, p, f, width).length * lineH(f);
    if (i < paras.length - 1) h += lineH(f) * 0.55;
  });
  return h;
}

function drawParas(doc: jsPDF, body: string, f: Font, x: number, y: number, width: number, color: [number, number, number]) {
  const paras = paragraphs(body);
  doc.setTextColor(...color);
  paras.forEach((p, i) => {
    const lines = wrap(doc, p, f, width);
    lines.forEach((ln) => {
      doc.text(ln, x, y + f.size * PT * 0.8);
      y += lineH(f);
    });
    if (i < paras.length - 1) y += lineH(f) * 0.55;
  });
  return y;
}

type Block = { label: string; heading: string; body: string; headingFont?: Font };

function measureBlock(doc: jsPDF, b: Block, width: number) {
  const hf = b.headingFont ?? F.h2;
  return (
    lineH(F.label) + 2 +
    wrap(doc, b.heading, hf, width).length * lineH(hf) + 2.5 +
    measureParas(doc, b.body, F.body, width)
  );
}

function drawBlock(doc: jsPDF, b: Block, x: number, y: number, width: number, accent: [number, number, number], ink: [number, number, number]) {
  const hf = b.headingFont ?? F.h2;
  setFont(doc, F.label);
  doc.setTextColor(...accent);
  doc.setCharSpace(0.6);
  doc.text(clean(b.label).toUpperCase(), x, y + F.label.size * PT * 0.8);
  doc.setCharSpace(0);
  y += lineH(F.label) + 2;
  doc.setTextColor(...ink);
  wrap(doc, b.heading, hf, width).forEach((ln) => {
    setFont(doc, hf);
    doc.text(ln, x, y + hf.size * PT * 0.8);
    y += lineH(hf);
  });
  y += 2.5;
  return drawParas(doc, b.body, F.body, x, y, width, [70, 70, 70]);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
export async function buildNewsletterPdf(content: NewsletterContent, brand: NewsletterBrand): Promise<jsPDF> {
  const { JsPDF, qrcode } = await loadPdfLibs();
  const doc: jsPDF = new JsPDF({ unit: "mm", format: "a4", compress: true });
  const accentRaw = parseHex(brand.accent);
  const accent = readableAccent(accentRaw);
  const ink: [number, number, number] = [28, 28, 30];
  const byslot = (s: string) => content.sections.find((x) => x.slot === s);

  let y = 14;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 18;
    }
  };

  // Masthead ---------------------------------------------------------------
  if (brand.logoDataUrl) {
    try {
      const props = doc.getImageProperties(brand.logoDataUrl);
      const maxW = 56, maxH = 22;
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale, h = props.height * scale;
      doc.addImage(brand.logoDataUrl, "PNG", (PAGE_W - w) / 2, y, w, h, undefined, "FAST");
      y += h + 5;
    } catch {
      /* fall through to name only */
    }
  } else {
    setFont(doc, F.h1);
    doc.setTextColor(...ink);
    doc.text(clean(brand.clinicName), PAGE_W / 2, y + 6, { align: "center" });
    y += 11;
  }

  setFont(doc, { family: "times", style: "italic", size: 13, lh: 1.2 });
  doc.setTextColor(...accent);
  doc.text(clean(brand.newsletterName), PAGE_W / 2, y + 4, { align: "center" });
  y += 6.5;
  setFont(doc, F.label);
  doc.setTextColor(120, 120, 120);
  doc.setCharSpace(1.2);
  doc.text(clean(brand.monthLabel).toUpperCase(), PAGE_W / 2, y + 2.5, { align: "center" });
  doc.setCharSpace(0);
  y += 6;
  doc.setDrawColor(...accentRaw);
  doc.setLineWidth(0.5);
  doc.line(M, y, PAGE_W - M, y);
  y += 6;

  // Hero -------------------------------------------------------------------
  if (brand.heroDataUrl) {
    const h = CONTENT_W / HERO_RATIO;
    doc.addImage(brand.heroDataUrl, "JPEG", M, y, CONTENT_W, h, undefined, "MEDIUM");
    y += h + 7;
  }

  // Intro ------------------------------------------------------------------
  if (content.intro) {
    const lines = wrap(doc, content.intro, F.intro, CONTENT_W - 20);
    ensure(lines.length * lineH(F.intro));
    doc.setTextColor(60, 60, 60);
    lines.forEach((ln) => {
      setFont(doc, F.intro);
      doc.text(ln, PAGE_W / 2, y + F.intro.size * PT * 0.8, { align: "center" });
      y += lineH(F.intro);
    });
    y += 7;
  }

  // Lead story -------------------------------------------------------------
  const lead = byslot("lead");
  if (lead) {
    const b: Block = { label: lead.label, heading: lead.heading, body: lead.body, headingFont: F.h1 };
    const headH = lineH(F.label) + 2 + wrap(doc, b.heading, F.h1, CONTENT_W).length * lineH(F.h1) + 2.5 + lineH(F.body) * 3;
    ensure(headH);
    y = drawBlockFlowing(doc, b, M, y, CONTENT_W, accent, ink, () => { doc.addPage(); return 18; });
    y += 8;
  }

  // Two columns: Ask + Myth ------------------------------------------------
  const ask = byslot("ask");
  const myth = byslot("myth");
  if (ask || myth) {
    const gap = 8;
    const colW = (CONTENT_W - gap) / 2;
    const pad = 5;
    const left: Block | null = ask ? { label: ask.label, heading: ask.heading, body: ask.body } : null;
    const right: Block | null = myth ? { label: myth.label, heading: myth.heading, body: myth.body } : null;
    const hL = left ? measureBlock(doc, left, colW - pad * 2) : 0;
    const hR = right ? measureBlock(doc, right, colW - pad * 2) : 0;
    const boxH = Math.max(hL, hR) + pad * 2;
    ensure(boxH);
    const soft = tint(accentRaw, isLight(accentRaw) ? 0.5 : 0.88);
    doc.setFillColor(...soft);
    if (left) doc.roundedRect(M, y, colW, boxH, 3, 3, "F");
    if (right) doc.roundedRect(M + colW + gap, y, colW, boxH, 3, 3, "F");
    if (left) drawBlock(doc, left, M + pad, y + pad, colW - pad * 2, accent, ink);
    if (right) drawBlock(doc, right, M + colW + gap + pad, y + pad, colW - pad * 2, accent, ink);
    y += boxH + 8;
  }

  // Behind the scenes ------------------------------------------------------
  const bts = byslot("bts");
  if (bts) {
    const b: Block = { label: bts.label, heading: bts.heading, body: bts.body };
    ensure(Math.min(measureBlock(doc, b, CONTENT_W), 60));
    y = drawBlockFlowing(doc, b, M, y, CONTENT_W, accent, ink, () => { doc.addPage(); return 18; });
    y += 8;
  }

  // The soft sell box ------------------------------------------------------
  const sell = byslot("sell");
  if (sell) {
    const pad = 7;
    const qrSize = brand.bookingUrl ? 30 : 0;
    const textW = CONTENT_W - pad * 2 - (qrSize ? qrSize + 7 : 0);
    const b: Block = { label: sell.label, heading: sell.heading, body: sell.body };
    const textH = measureBlock(doc, b, textW);
    const btnH = brand.bookingUrl ? 11 : 0;
    const boxH = Math.max(textH + (btnH ? btnH + 6 : 0), qrSize + 10) + pad * 2;
    ensure(boxH);
    doc.setFillColor(...accentRaw);
    doc.roundedRect(M, y, CONTENT_W, boxH, 4, 4, "F");
    const onAccent: [number, number, number] = isLight(accentRaw) ? [28, 28, 30] : [255, 255, 255];
    const tx = M + pad;
    let ty = y + pad;
    // label + heading + body in contrasting colour
    setFont(doc, F.label);
    doc.setTextColor(...onAccent);
    doc.setCharSpace(0.6);
    doc.text(clean(b.label).toUpperCase(), tx, ty + F.label.size * PT * 0.8);
    doc.setCharSpace(0);
    ty += lineH(F.label) + 2;
    wrap(doc, b.heading, F.h2, textW).forEach((ln) => {
      setFont(doc, F.h2);
      doc.text(ln, tx, ty + F.h2.size * PT * 0.8);
      ty += lineH(F.h2);
    });
    ty += 2.5;
    ty = drawParas(doc, b.body, F.body, tx, ty, textW, onAccent);

    if (brand.bookingUrl) {
      ty += 6;
      const label = clean(content.ctaText || "Book your consultation");
      setFont(doc, { family: "helvetica", style: "bold", size: 10.5, lh: 1 });
      const bw = Math.min(doc.getTextWidth(label) + 16, textW);
      const btnFill: [number, number, number] = isLight(accentRaw) ? [28, 28, 30] : [255, 255, 255];
      const btnText: [number, number, number] = isLight(accentRaw) ? [255, 255, 255] : readableAccent(accentRaw);
      doc.setFillColor(...btnFill);
      doc.roundedRect(tx, ty, bw, btnH, btnH / 2, btnH / 2, "F");
      doc.setTextColor(...btnText);
      doc.text(label, tx + bw / 2, ty + btnH / 2 + 1.3, { align: "center" });
      doc.link(tx, ty, bw, btnH, { url: brand.bookingUrl });

      const qx = M + CONTENT_W - pad - qrSize;
      const qy = y + (boxH - qrSize - 6) / 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qx - 2, qy - 2, qrSize + 4, qrSize + 4, 2, 2, "F");
      drawQr(doc, qrcode, brand.bookingUrl, qx, qy, qrSize);
      doc.link(qx, qy, qrSize, qrSize, { url: brand.bookingUrl });
      setFont(doc, { family: "helvetica", style: "normal", size: 7, lh: 1 });
      doc.setTextColor(...onAccent);
      doc.text("Scan to book", qx + qrSize / 2, qy + qrSize + 4.5, { align: "center" });
    }
    y += boxH + 9;
  }

  // Closing card + P.S. ---------------------------------------------------
  const closing = brand.closing;
  if (closing && (closing.thanks || closing.photoDataUrl || closing.signatureDataUrl)) {
    const pad = 7;
    const photo = closing.photoDataUrl ? 34 : 0;
    const tx = M + pad + (photo ? photo + 8 : 0);
    const textW = CONTENT_W - (tx - M) - pad;
    const thanksF: Font = { family: "times", style: "italic", size: 16, lh: 1.25 };
    const thanksLines = closing.thanks ? wrap(doc, closing.thanks, thanksF, textW) : [];
    let sigW = 0, sigH = 0;
    if (closing.signatureDataUrl) {
      const p = doc.getImageProperties(closing.signatureDataUrl);
      sigH = 18;
      sigW = Math.min((p.width / p.height) * sigH, textW);
      sigH = sigW / (p.width / p.height);
    }
    const textH = thanksLines.length * lineH(thanksF) + 3 + lineH(F.body) + (sigH ? sigH : lineH(F.h2));
    const boxH = Math.max(textH, photo) + pad * 2;
    const ps = content.signOff?.trim();
    const psLines = ps ? wrap(doc, "P.S. " + ps.replace(/^p\.?s\.?\s*/i, ""), F.intro, CONTENT_W) : [];
    ensure(boxH + (psLines.length ? psLines.length * lineH(F.intro) + 6 : 0));

    doc.setFillColor(...tint(accentRaw, isLight(accentRaw) ? 0.6 : 0.92));
    doc.roundedRect(M, y, CONTENT_W, boxH, 4, 4, "F");
    if (closing.photoDataUrl) {
      const px = M + pad, py = y + (boxH - photo) / 2;
      doc.setFillColor(255, 255, 255);
      doc.circle(px + photo / 2, py + photo / 2, photo / 2 + 1.2, "F");
      doc.addImage(closing.photoDataUrl, "PNG", px, py, photo, photo, undefined, "MEDIUM");
    }
    let ty = y + (boxH - textH) / 2;
    doc.setTextColor(...ink);
    thanksLines.forEach((ln) => {
      setFont(doc, thanksF);
      doc.text(ln, tx, ty + thanksF.size * PT * 0.8);
      ty += lineH(thanksF);
    });
    ty += 3;
    setFont(doc, { family: "times", style: "italic", size: 11, lh: 1.3 });
    doc.setTextColor(90, 90, 90);
    doc.text("With love,", tx, ty + 11 * PT * 0.8);
    ty += lineH(F.body);
    if (closing.signatureDataUrl) {
      doc.addImage(closing.signatureDataUrl, "PNG", tx - 1.5, ty - 1, sigW, sigH, undefined, "FAST");
    } else {
      setFont(doc, F.h2);
      doc.setTextColor(...accent);
      doc.text(clean(brand.clinicName), tx, ty + F.h2.size * PT * 0.8);
    }
    y += boxH + 6;

    if (psLines.length) {
      doc.setTextColor(70, 70, 70);
      psLines.forEach((ln) => {
        setFont(doc, F.intro);
        doc.text(ln, M, y + F.intro.size * PT * 0.8);
        y += lineH(F.intro);
      });
      y += 4;
    }
  } else if (content.signOff) {
    // No closing card this issue: fall back to the plain sign off.
    const lines = wrap(doc, content.signOff, F.intro, CONTENT_W);
    ensure(lines.length * lineH(F.intro) + 8);
    doc.setTextColor(60, 60, 60);
    lines.forEach((ln) => {
      setFont(doc, F.intro);
      doc.text(ln, M, y + F.intro.size * PT * 0.8);
      y += lineH(F.intro);
    });
    setFont(doc, { family: "helvetica", style: "bold", size: 10, lh: 1.3 });
    doc.setTextColor(...accent);
    doc.text(clean(brand.clinicName), M, y + 4);
    y += 10;
  }

  // Footer on every page ---------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    setFont(doc, F.small);
    doc.setTextColor(140, 140, 140);
    const left = [brand.clinicName, brand.address].filter(Boolean).join("  |  ");
    doc.text(clean(left), M, PAGE_H - 8);
    if (pages > 1) doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
    if (p === pages) {
      doc.text(
        clean("You're receiving this because you're a patient of ours and asked to hear from us. Reply \"unsubscribe\" at any time and we'll take you off the list."),
        M,
        PAGE_H - 4.5,
        { maxWidth: CONTENT_W },
      );
    }
  }

  return doc;
}

// Draws a block that may run across a page break, splitting between lines.
function drawBlockFlowing(
  doc: jsPDF,
  b: Block,
  x: number,
  y: number,
  width: number,
  accent: [number, number, number],
  ink: [number, number, number],
  newPage: () => number,
) {
  const hf = b.headingFont ?? F.h2;
  setFont(doc, F.label);
  doc.setTextColor(...accent);
  doc.setCharSpace(0.6);
  doc.text(clean(b.label).toUpperCase(), x, y + F.label.size * PT * 0.8);
  doc.setCharSpace(0);
  y += lineH(F.label) + 2;
  doc.setTextColor(...ink);
  wrap(doc, b.heading, hf, width).forEach((ln) => {
    setFont(doc, hf);
    doc.text(ln, x, y + hf.size * PT * 0.8);
    y += lineH(hf);
  });
  y += 2.5;
  const paras = paragraphs(b.body);
  paras.forEach((p, i) => {
    const lines = wrap(doc, p, F.body, width);
    lines.forEach((ln) => {
      if (y + lineH(F.body) > BOTTOM) y = newPage();
      setFont(doc, F.body);
      doc.setTextColor(70, 70, 70);
      doc.text(ln, x, y + F.body.size * PT * 0.8);
      y += lineH(F.body);
    });
    if (i < paras.length - 1) y += lineH(F.body) * 0.55;
  });
  return y;
}
