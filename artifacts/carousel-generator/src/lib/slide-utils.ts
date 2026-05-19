import { CORNER_STYLES as CORNER_STYLE_VALUES } from "@workspace/db/schema";
import type { LogoPosition, CornerStyle } from "@workspace/db/schema";

export type { LogoPosition };

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export type AnimationType = 'ken-burns' | 'slide-in-text' | 'typewriter' | 'fade-overlay';

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.replace('#', '');
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return [r, g, b];
  }
  if (s.length === 6) {
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  return null;
}

function scaleOverlayAlpha(color: string, scale: number): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (m) {
    const a = parseFloat(m[4] ?? '1') * scale;
    return `rgba(${m[1]},${m[2]},${m[3]},${Math.min(1, a)})`;
  }
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1, scale)})`;
  }
  return color;
}

export const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Lato", value: "'Lato', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { label: "Anton", value: "'Anton', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Dancing Script", value: "'Dancing Script', cursive" },
  { label: "Pacifico", value: "'Pacifico', cursive" },
  { label: "Libre Baskerville", value: "'Libre Baskerville', serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', serif" },
  { label: "Abril Fatface", value: "'Abril Fatface', serif" },
  { label: "Quicksand", value: "'Quicksand', sans-serif" },
  { label: "Nunito", value: "'Nunito', sans-serif" },
  { label: "Crimson Text", value: "'Crimson Text', serif" },
  { label: "Work Sans", value: "'Work Sans', sans-serif" },
  { label: "Bitter", value: "'Bitter', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Josefin Sans", value: "'Josefin Sans', sans-serif" },
  { label: "Great Vibes", value: "'Great Vibes', cursive" },
  { label: "Cinzel", value: "'Cinzel', serif" },
  { label: "Bodoni Moda", value: "'Bodoni Moda', serif" },
  { label: "Barlow Condensed", value: "'Barlow Condensed', sans-serif" },
  { label: "EB Garamond", value: "'EB Garamond', serif" },
  { label: "Italiana", value: "'Italiana', serif" },
  { label: "Fjalla One", value: "'Fjalla One', sans-serif" },
  { label: "Tenor Sans", value: "'Tenor Sans', sans-serif" },
  { label: "Cormorant SC", value: "'Cormorant SC', serif" },
  { label: "Spectral", value: "'Spectral', serif" },
  { label: "Yeseva One", value: "'Yeseva One', serif" },
];

export const FONT_PAIRINGS: Record<string, string> = {
  "Inter, sans-serif":                    "'Playfair Display', serif",
  "'Playfair Display', serif":            "'Raleway', sans-serif",
  "'Montserrat', sans-serif":             "'Cormorant Garamond', serif",
  "'Lato', sans-serif":                   "'Merriweather', serif",
  "'Oswald', sans-serif":                 "'Libre Baskerville', serif",
  "'Merriweather', serif":                "'Lato', sans-serif",
  "'Raleway', sans-serif":                "'Cormorant Garamond', serif",
  "'Roboto', sans-serif":                 "'Playfair Display', serif",
  "'Cormorant Garamond', serif":          "'Montserrat', sans-serif",
  "'Anton', sans-serif":                  "'Work Sans', sans-serif",
  "'Poppins', sans-serif":               "'EB Garamond', serif",
  "'Bebas Neue', sans-serif":             "'Libre Baskerville', serif",
  "'Dancing Script', cursive":            "'Montserrat', sans-serif",
  "'Pacifico', cursive":                  "'Nunito', sans-serif",
  "'Libre Baskerville', serif":           "'Raleway', sans-serif",
  "'DM Serif Display', serif":            "Inter, sans-serif",
  "'Abril Fatface', serif":               "'Raleway', sans-serif",
  "'Quicksand', sans-serif":              "'Playfair Display', serif",
  "'Nunito', sans-serif":                 "'Crimson Text', serif",
  "'Crimson Text', serif":               "'Josefin Sans', sans-serif",
  "'Work Sans', sans-serif":              "'EB Garamond', serif",
  "'Bitter', serif":                      "Inter, sans-serif",
  "Georgia, serif":                       "'Raleway', sans-serif",
  "'Josefin Sans', sans-serif":           "'Crimson Text', serif",
  "'Great Vibes', cursive":               "'Montserrat', sans-serif",
  "'Cinzel', serif":                      "'Cormorant Garamond', serif",
  "'Bodoni Moda', serif":                 "'Tenor Sans', sans-serif",
  "'Barlow Condensed', sans-serif":       "'EB Garamond', serif",
  "'EB Garamond', serif":                 "'Barlow Condensed', sans-serif",
  "'Italiana', serif":                    "'Tenor Sans', sans-serif",
  "'Fjalla One', sans-serif":             "'Lato', sans-serif",
  "'Tenor Sans', sans-serif":             "'Spectral', serif",
  "'Cormorant SC', serif":                "'Raleway', sans-serif",
  "'Spectral', serif":                    "'Josefin Sans', sans-serif",
  "'Yeseva One', serif":                  "Inter, sans-serif",
};

const CORNER_STYLE_LABELS: Record<CornerStyle, string> = {
  none: "None",
  triangle: "Triangle",
  arc: "Arc",
  "double-line": "Double Line",
  frame: "Frame",
};

export const CORNER_STYLES: Array<{ label: string; value: CornerStyle }> =
  CORNER_STYLE_VALUES.map((value) => ({ label: CORNER_STYLE_LABELS[value], value }));

export const LOGO_POSITIONS: Array<{ label: string; value: LogoPosition }> = [
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
];

export function loadGoogleFonts() {
  if (typeof document !== "undefined") {
    const existing = document.querySelector('link[data-slide-fonts]');
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-slide-fonts", "true");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,700&family=Montserrat:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400;1,700&family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Oswald:wght@300;400;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Raleway:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=Roboto:ital,wght@0,300;0,400;0,700;1,400&family=Poppins:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Pacifico&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=Abril+Fatface&family=Quicksand:wght@300;400;600;700&family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Work+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Bitter:ital,wght@0,400;0,600;0,700;1,400&family=Josefin+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Great+Vibes&family=Cinzel:wght@400;600;700;900&family=Bodoni+Moda:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Italiana&family=Fjalla+One&family=Tenor+Sans&family=Cormorant+SC:wght@300;400;500;600;700&family=Spectral:ital,wght@0,300;0,400;0,600;0,700;1,400;1,700&family=Yeseva+One&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap";
    document.head.appendChild(link);
  }
}

function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  topY: number,
  radius: number,
  letterSpacing: number = 0
): void {
  const chars = [...text];
  if (chars.length === 0) return;
  const savedAlign = ctx.textAlign;
  const savedBaseline = ctx.textBaseline;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const charWidths = chars.map(ch => ctx.measureText(ch).width);
  const totalWidth = charWidths.reduce((s, w) => s + w, 0) + letterSpacing * Math.max(0, chars.length - 1);
  const halfAngle = totalWidth / (2 * radius);
  const arcCenterY = topY + radius;
  let θ = -halfAngle;
  for (let i = 0; i < chars.length; i++) {
    const midθ = θ + charWidths[i] / (2 * radius);
    ctx.save();
    ctx.translate(cx + radius * Math.sin(midθ), arcCenterY - radius * Math.cos(midθ));
    ctx.rotate(midθ);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    θ += charWidths[i] / radius + (i < chars.length - 1 ? letterSpacing / radius : 0);
  }
  ctx.textAlign = savedAlign;
  ctx.textBaseline = savedBaseline as CanvasTextBaseline;
}

export function drawSlide(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  text: string,
  font: string,
  size: number,
  isCoverSlide: boolean,
  textColor: string = "#ffffff",
  lineSpacing: number = 0.9,
  overlayColor: string = "rgba(0,0,0,0.5)",
  logoImg: HTMLImageElement | null = null,
  logoPosition: string = "top-right",
  logoSize: number = 140,
  pageColor: string = "#000000",
  cornerStyle: string = "none",
  cornerColor: string = "#d4af37",
  slidePosition: number = 1,
  totalSlidesInGroup: number = 5,
  textPosition: "top" | "center" | "bottom" = "bottom",
  showTextOverlay: boolean = true,
  subheadingFont: string = "",
  textAlign: string = "left",
  textBoxOutline: boolean = false,
  textBoxOutlineColor: string = "#ffffff",
  coverSubheading: string = "",
  coverLetterSpacing: number = 0,
  coverUppercase: boolean = false,
  coverDropCap: boolean = false,
  coverDropCapFont: string = "'Great Vibes', cursive",
  coverSplit: boolean = false,
  coverEyebrowFont: string = "",
  coverEyebrowColor: string = "#ffffff",
  coverEyebrowSizeRatio: number = 0.45,
  coverEyebrowItalic: boolean = false,
  coverEyebrowUppercase: boolean = false,
  coverEyebrowWeight: number = 400,
  coverEyebrowLetterSpacing: number = 2,
  coverHeadlineItalic: boolean = false,
  coverHeadlineWeight: number = 700,
  coverEyebrowArch: number = 0,
  animationType?: AnimationType,
  animationProgress?: number
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  const p = animationProgress !== undefined ? Math.min(1, Math.max(0, animationProgress)) : 1;
  const ep = easeOutQuad(p);

  const rawText = (isCoverSlide && coverUppercase) ? text.toUpperCase() : text;
  const displayText = (animationType === 'typewriter' && animationProgress !== undefined)
    ? rawText.slice(0, Math.max(1, Math.floor(p * rawText.length)))
    : rawText;

  const effectiveOverlayColor = (animationType === 'fade-overlay' && animationProgress !== undefined)
    ? scaleOverlayAlpha(overlayColor, ep)
    : overlayColor;

  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  if (img) {
    const scale = Math.max(W / img.width, H / img.height);
    const x = (W - img.width * scale) / 2;
    const y = (H - img.height * scale) / 2;

    if (animationType === 'ken-burns' && animationProgress !== undefined) {
      const zoom = 1.0 + 0.12 * ep;
      const panX = 25 * ep;
      const panY = 15 * ep;
      ctx.save();
      ctx.translate(W / 2 + panX, H / 2 + panY);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = isCoverSlide ? 1.0 : 0.5;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      ctx.globalAlpha = 1.0;
      ctx.restore();
    } else {
      ctx.globalAlpha = isCoverSlide ? 1.0 : 0.5;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      ctx.globalAlpha = 1.0;
    }
  }

  if (cornerStyle !== "none") {
    ctx.strokeStyle = cornerColor;
    ctx.fillStyle = cornerColor;
    const S = 180;

    if (cornerStyle === "triangle") {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W, H); ctx.lineTo(W - S, H); ctx.lineTo(W, H - S); ctx.closePath(); ctx.fill();
    } else if (cornerStyle === "arc") {
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, S, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W, H, S, Math.PI, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(W, 0, S, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, H, S, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
    } else if (cornerStyle === "double-line") {
      ctx.lineWidth = 4;
      const G = 12;
      [0, G].forEach((off) => {
        ctx.strokeRect(off + 30, off + 30, W - (off + 30) * 2, H - (off + 30) * 2);
      });
    } else if (cornerStyle === "frame") {
      ctx.lineWidth = 5;
      const L = 120;
      const M = 40;
      ctx.beginPath();
      ctx.moveTo(M, M + L); ctx.lineTo(M, M); ctx.lineTo(M + L, M);
      ctx.moveTo(W - M - L, M); ctx.lineTo(W - M, M); ctx.lineTo(W - M, M + L);
      ctx.moveTo(W - M, H - M - L); ctx.lineTo(W - M, H - M); ctx.lineTo(W - M - L, H - M);
      ctx.moveTo(M + L, H - M); ctx.lineTo(M, H - M); ctx.lineTo(M, H - M - L);
      ctx.stroke();
    }
  }

  const isLastSlide = totalSlidesInGroup > 1 && slidePosition === totalSlidesInGroup;
  const ctaSize = isLastSlide ? Math.round(size * 1.4) : size;
  const hPad = 2;
  const activeTextPos = isLastSlide ? "center" : textPosition;

  const activeFont = isCoverSlide ? font : (subheadingFont || font);

  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";

  const vPad = 20;
  const availTextH = H - vPad * 2;
  const maxW = W - hPad * 2;
  const hasCoverSubheading = isCoverSlide && !isLastSlide && !!coverSubheading?.trim();
  const isSplit = coverSplit && isCoverSlide && displayText.includes('|');

  // Auto-shrink font so all text fits vertically within the canvas
  let currentSize = ctaSize;
  let lines: string[] = [];
  let lineH = 0;
  let totalH = 0;
  let effectiveTotalH = 0;
  let subheadingLines: string[] = [];
  let subheadingSize = 0;
  let subheadingLineH = 0;
  let subheadingTotalH = 0;
  let subheadingGap = 0;
  let subheadingMaxW = 0;
  let combinedTotalH = 0;
  let eyebrowLines: string[] = [];
  let eyebrowLineH = 0;
  let eyebrowTotalH = 0;
  let eyebrowGap = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    const fWeight = isSplit ? coverHeadlineWeight : (isLastSlide ? 700 : 600);
    const fStyle = (isSplit && coverHeadlineItalic) ? 'italic' : 'normal';
    ctx.font = `${fStyle} ${fWeight} ${currentSize}px ${activeFont}`;
    (ctx as any).letterSpacing = (isCoverSlide && coverLetterSpacing) ? `${coverLetterSpacing}px` : "0px";
    lineH = Math.round(currentSize * lineSpacing);
    const wrapSrc = isSplit ? displayText.split('|').slice(1).join('|').trim() : displayText;
    const words = wrapSrc.split(" ");
    lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else { cur = test; }
    }
    if (cur) lines.push(cur);
    totalH = lines.length * lineH;

    eyebrowLines = []; eyebrowLineH = 0; eyebrowTotalH = 0; eyebrowGap = 0;
    if (isSplit) {
      const eyebrowRaw = displayText.split('|')[0].trim();
      const eyebrowText = coverEyebrowUppercase ? eyebrowRaw.toUpperCase() : eyebrowRaw;
      const eyebrowSize = Math.round(currentSize * coverEyebrowSizeRatio);
      eyebrowLineH = Math.round(eyebrowSize * lineSpacing);
      eyebrowGap = Math.round(currentSize * 0.18);
      const eyebrowFontStr = coverEyebrowFont || activeFont;
      const eyebrowStyle = coverEyebrowItalic ? 'italic' : 'normal';
      ctx.font = `${eyebrowStyle} ${coverEyebrowWeight} ${eyebrowSize}px ${eyebrowFontStr}`;
      (ctx as any).letterSpacing = `${coverEyebrowLetterSpacing}px`;
      eyebrowLines = [];
      let cur3 = "";
      for (const w of (eyebrowText || " ").split(' ')) {
        const test = cur3 ? cur3 + " " + w : w;
        if (ctx.measureText(test).width > maxW && cur3) { eyebrowLines.push(cur3); cur3 = w; }
        else { cur3 = test; }
      }
      if (cur3) eyebrowLines.push(cur3);
      eyebrowTotalH = eyebrowLines.length * eyebrowLineH + eyebrowGap;
      if (coverEyebrowArch > 0 && eyebrowLines.length > 0) {
        const archRadius = W * (4 - coverEyebrowArch * 3.5);
        const maxEyebrowW = Math.max(...eyebrowLines.map(l =>
          ctx.measureText(l).width + coverEyebrowLetterSpacing * Math.max(0, [...l].length - 1)
        ));
        const halfAng = maxEyebrowW / (2 * archRadius);
        eyebrowTotalH += Math.round(archRadius * (1 - Math.cos(halfAng)));
      }
      ctx.font = `${fStyle} ${fWeight} ${currentSize}px ${activeFont}`;
      (ctx as any).letterSpacing = (isCoverSlide && coverLetterSpacing) ? `${coverLetterSpacing}px` : "0px";
    }

    subheadingLines = [];
    subheadingSize = 0; subheadingLineH = 0; subheadingTotalH = 0;
    subheadingGap = 0; subheadingMaxW = 0;
    if (hasCoverSubheading) {
      subheadingSize = Math.round(currentSize * 0.65);
      subheadingLineH = Math.round(subheadingSize * lineSpacing);
      subheadingGap = Math.round(currentSize * 0.25);
      const subFontStr = subheadingFont || font;
      ctx.font = `500 ${subheadingSize}px ${subFontStr}`;
      const shWords = coverSubheading.trim().split(" ");
      let cur2 = "";
      for (const w of shWords) {
        const test = cur2 ? cur2 + " " + w : w;
        if (ctx.measureText(test).width > maxW && cur2) { subheadingLines.push(cur2); cur2 = w; }
        else { cur2 = test; }
      }
      if (cur2) subheadingLines.push(cur2);
      subheadingTotalH = subheadingLines.length * subheadingLineH;
      subheadingMaxW = subheadingLines.length > 0 ? Math.max(...subheadingLines.map((l) => ctx.measureText(l).width)) : 0;
      ctx.font = `${fStyle} ${fWeight} ${currentSize}px ${activeFont}`;
    }
    const dropCapBigH = (!isSplit && coverDropCap && isCoverSlide && lines.length > 0) ? Math.round(currentSize * 2.0) : 0;
    effectiveTotalH = dropCapBigH > 0 ? dropCapBigH + Math.max(0, lines.length - 1) * lineH : totalH;
    combinedTotalH = eyebrowTotalH + effectiveTotalH + (hasCoverSubheading ? subheadingGap + subheadingTotalH : 0);

    if (combinedTotalH <= availTextH || currentSize <= 10) break;
    currentSize = Math.max(10, Math.round(currentSize * 0.85));
  }

  let startX = hPad, startY = vPad;

  const vPos = activeTextPos;
  const activeAlign = isLastSlide ? "center" : textAlign;

  if (activeAlign === "center") { startX = Math.round(W / 2); ctx.textAlign = "center"; }
  else if (activeAlign === "right") { startX = W - hPad; ctx.textAlign = "right"; }
  else { startX = hPad; ctx.textAlign = "left"; }

  if (vPos === "top") { startY = vPad; }
  else if (vPos === "center") { startY = Math.round((H - combinedTotalH) / 2); }
  else { startY = Math.round(H - combinedTotalH - vPad); }

  const textSlideOffset = (animationType === 'slide-in-text' && animationProgress !== undefined)
    ? Math.round((1 - ep) * Math.round(H * 0.15))
    : 0;

  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const effectiveMaxLineWidth = Math.max(maxLineWidth, subheadingMaxW);

  if (textSlideOffset !== 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.translate(0, textSlideOffset);
  }

  if (showTextOverlay) {
    ctx.fillStyle = effectiveOverlayColor;
    ctx.fillRect(0, 0, W, H);
    if (textBoxOutline) {
      ctx.strokeStyle = textBoxOutlineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
    }
  }

  ctx.fillStyle = textColor;
  if (isSplit && eyebrowLines.length > 0) {
    // --- Eyebrow line ---
    const eyebrowSize = Math.round(currentSize * coverEyebrowSizeRatio);
    const eyebrowFontStr = coverEyebrowFont || activeFont;
    const eyebrowStyle = coverEyebrowItalic ? 'italic' : 'normal';
    ctx.font = `${eyebrowStyle} ${coverEyebrowWeight} ${eyebrowSize}px ${eyebrowFontStr}`;
    (ctx as any).letterSpacing = `${coverEyebrowLetterSpacing}px`;
    ctx.fillStyle = coverEyebrowColor || textColor;
    if (coverEyebrowArch > 0) {
      const archRadius = W * (4 - coverEyebrowArch * 3.5);
      eyebrowLines.forEach((line, i) => {
        drawArcText(ctx, line, W / 2, startY + i * eyebrowLineH, archRadius, coverEyebrowLetterSpacing);
      });
    } else {
      eyebrowLines.forEach((line, i) => ctx.fillText(line, startX, startY + i * eyebrowLineH));
    }
    // --- Headline ---
    const hlStyle = coverHeadlineItalic ? 'italic' : 'normal';
    ctx.font = `${hlStyle} ${coverHeadlineWeight} ${currentSize}px ${activeFont}`;
    (ctx as any).letterSpacing = coverLetterSpacing ? `${coverLetterSpacing}px` : '0px';
    ctx.fillStyle = textColor;
    const headlineY = startY + eyebrowTotalH;
    lines.forEach((line, i) => ctx.fillText(line, startX, headlineY + i * lineH));
  } else if (coverDropCap && isCoverSlide && lines.length > 0) {
    const bigSize = Math.round(currentSize * 2.0);
    const dropFont = coverDropCapFont || "'Great Vibes', cursive";
    const firstChar = lines[0][0] || "";
    const restOfFirst = lines[0].slice(1);
    const gap = Math.round(currentSize * 0.05);
    ctx.font = `400 ${bigSize}px ${dropFont}`;
    const bigCharW = ctx.measureText(firstChar).width;
    ctx.font = `600 ${currentSize}px ${activeFont}`;
    const restW = ctx.measureText(restOfFirst).width;
    const savedAlign = ctx.textAlign;
    ctx.textAlign = "left";
    let firstLineX = hPad;
    if (activeAlign === "center") firstLineX = Math.round(W / 2 - (bigCharW + gap + restW) / 2);
    else if (activeAlign === "right") firstLineX = Math.round(W - hPad - bigCharW - gap - restW);
    ctx.font = `400 ${bigSize}px ${dropFont}`;
    ctx.fillText(firstChar, firstLineX, startY);
    ctx.font = `600 ${currentSize}px ${activeFont}`;
    ctx.fillText(restOfFirst, firstLineX + bigCharW + gap, startY + bigSize - currentSize);
    ctx.textAlign = savedAlign;
    for (let i = 1; i < lines.length; i++) {
      ctx.fillText(lines[i], startX, startY + bigSize + (i - 1) * lineH);
    }
  } else {
    lines.forEach((line, i) => ctx.fillText(line, startX, startY + i * lineH));
  }

  if (hasCoverSubheading && subheadingLines.length > 0) {
    const subFontStr = subheadingFont || font;
    ctx.font = `500 ${subheadingSize}px ${subFontStr}`;
    const subStartY = startY + eyebrowTotalH + effectiveTotalH + subheadingGap;
    subheadingLines.forEach((line, i) => ctx.fillText(line, startX, subStartY + i * subheadingLineH));
  }

  if (textSlideOffset !== 0) {
    ctx.restore();
  }

  if (logoImg) {
    const margin = 40;
    const aspectRatio = logoImg.width / logoImg.height;
    const logoW = Math.round(logoSize * aspectRatio);
    const logoH = logoSize;
    let lx = margin, ly = margin;
    if (logoPosition === "top-right") { lx = W - logoW - margin; ly = margin; }
    else if (logoPosition === "bottom-left") { lx = margin; ly = H - logoH - margin; }
    else if (logoPosition === "bottom-right") { lx = W - logoW - margin; ly = H - logoH - margin; }
    ctx.drawImage(logoImg, lx, ly, logoW, logoH);
  }
}

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export const STORY_BACKGROUNDS = Array.from({ length: 19 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return { label: `Retro ${num}`, file: `retro-${num}.png` };
});

export function drawStory(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  questionText: string,
  font: string,
  fontSize: number,
  textColor: string = "#ffffff",
  overlayColor: string = "rgba(236,72,153,0.75)",
  footerText: string = "Type your answer in the comments",
  logoImg: HTMLImageElement | null = null,
  logoPosition: string = "top-right",
  logoSize: number = 120,
  bgOpacity: number = 0.7,
  subheadingFont: string = "",
  textAlign: string = "left",
  textBoxOutline: boolean = false,
  textBoxOutlineColor: string = "#ffffff"
) {
  const W = STORY_WIDTH;
  const H = STORY_HEIGHT;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const scale = Math.max(W / bgImg.width, H / bgImg.height);
  const bx = (W - bgImg.width * scale) / 2;
  const by = (H - bgImg.height * scale) / 2;
  ctx.globalAlpha = bgOpacity;
  ctx.drawImage(bgImg, bx, by, bgImg.width * scale, bgImg.height * scale);
  ctx.globalAlpha = 1.0;

  const squareSize = Math.round(W * 0.82);
  const sqX = Math.round((W - squareSize) / 2);
  const sqY = Math.round((H - squareSize) / 2) - 40;
  const radius = 24;

  ctx.fillStyle = overlayColor;
  ctx.beginPath();
  ctx.moveTo(sqX + radius, sqY);
  ctx.lineTo(sqX + squareSize - radius, sqY);
  ctx.arcTo(sqX + squareSize, sqY, sqX + squareSize, sqY + radius, radius);
  ctx.lineTo(sqX + squareSize, sqY + squareSize - radius);
  ctx.arcTo(sqX + squareSize, sqY + squareSize, sqX + squareSize - radius, sqY + squareSize, radius);
  ctx.lineTo(sqX + radius, sqY + squareSize);
  ctx.arcTo(sqX, sqY + squareSize, sqX, sqY + squareSize - radius, radius);
  ctx.lineTo(sqX, sqY + radius);
  ctx.arcTo(sqX, sqY, sqX + radius, sqY, radius);
  ctx.closePath();
  ctx.fill();

  if (textBoxOutline) {
    ctx.strokeStyle = textBoxOutlineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sqX + radius, sqY);
    ctx.lineTo(sqX + squareSize - radius, sqY);
    ctx.arcTo(sqX + squareSize, sqY, sqX + squareSize, sqY + radius, radius);
    ctx.lineTo(sqX + squareSize, sqY + squareSize - radius);
    ctx.arcTo(sqX + squareSize, sqY + squareSize, sqX + squareSize - radius, sqY + squareSize, radius);
    ctx.lineTo(sqX + radius, sqY + squareSize);
    ctx.arcTo(sqX, sqY + squareSize, sqX, sqY + squareSize - radius, radius);
    ctx.lineTo(sqX, sqY + radius);
    ctx.arcTo(sqX, sqY, sqX + radius, sqY, radius);
    ctx.closePath();
    ctx.stroke();
  }

  const pad = 40;
  const resolvedAlign = (textAlign === "left" || textAlign === "right") ? textAlign : "center";
  const textX = resolvedAlign === "left" ? sqX + pad : resolvedAlign === "right" ? sqX + squareSize - pad : W / 2;

  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px ${font}`;
  ctx.textAlign = resolvedAlign as CanvasTextAlign;
  ctx.textBaseline = "top";

  const maxTextW = squareSize - pad * 2;
  const lineH = Math.round(fontSize * 1.15);
  const words = questionText.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxTextW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const totalTextH = lines.length * lineH;
  const textStartY = sqY + Math.round((squareSize - totalTextH) / 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, textStartY + i * lineH);
  });

  ctx.fillStyle = textColor;
  ctx.globalAlpha = 0.7;
  ctx.font = `500 ${Math.round(fontSize * 0.5)}px ${subheadingFont || font}`;
  ctx.textAlign = "center";
  ctx.fillText(footerText, W / 2, sqY + squareSize + 50);
  ctx.globalAlpha = 1.0;

  if (logoImg) {
    const margin = 40;
    const aspectRatio = logoImg.width / logoImg.height;
    const logoW = Math.round(logoSize * aspectRatio);
    const logoH = logoSize;
    let lx = margin, ly = margin;
    if (logoPosition === "top-right") { lx = W - logoW - margin; ly = margin; }
    else if (logoPosition === "bottom-left") { lx = margin; ly = H - logoH - margin; }
    else if (logoPosition === "bottom-right") { lx = W - logoW - margin; ly = H - logoH - margin; }
    ctx.drawImage(logoImg, lx, ly, logoW, logoH);
  }
}

export async function recordGroupVideo(
  canvas: HTMLCanvasElement,
  slideDurationMs: number,
  blackFlashMs: number,
  slideCount: number,
  animateFn: (slideIndex: number, progress: number) => void,
  fps: number = 30
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || 'video/webm';

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(fps);
    } catch {
      reject(new Error('canvas.captureStream is not supported in this browser'));
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    const totalDurationMs = slideCount * slideDurationMs + Math.max(0, slideCount - 1) * blackFlashMs;
    const segmentDuration = slideDurationMs + blackFlashMs;
    const startTime = performance.now();
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    const tick = () => {
      const elapsed = Math.min(performance.now() - startTime, totalDurationMs);
      const segIdx = Math.min(slideCount - 1, Math.floor(elapsed / segmentDuration));
      const segElapsed = elapsed - segIdx * segmentDuration;

      if (segElapsed < slideDurationMs) {
        animateFn(segIdx, Math.min(1, segElapsed / slideDurationMs));
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
      }

      if (elapsed < totalDurationMs) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => { try { recorder.stop(); } catch {} }, 150);
      }
    };

    recorder.start(250);
    requestAnimationFrame(tick);
  });
}

export async function recordReelVideo(
  canvas: HTMLCanvasElement,
  slideDurationMs: number,
  fadeMs: number,
  slideCount: number,
  animateFn: (slideIndex: number) => void,
  fps: number = 30
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || 'video/webm';

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(fps);
    } catch {
      reject(new Error('canvas.captureStream is not supported in this browser'));
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    const totalDurationMs = slideCount * slideDurationMs;
    const startTime = performance.now();
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const fadeRatio = Math.min(0.4, fadeMs / slideDurationMs);

    const tick = () => {
      const elapsed = Math.min(performance.now() - startTime, totalDurationMs);
      const slideIndex = Math.min(slideCount - 1, Math.floor(elapsed / slideDurationMs));
      const slideElapsed = elapsed - slideIndex * slideDurationMs;
      const slideProgress = slideElapsed / slideDurationMs;

      animateFn(slideIndex);

      let fadeAlpha = 0;
      if (slideProgress < fadeRatio) {
        fadeAlpha = 1 - slideProgress / fadeRatio;
      } else if (slideProgress > 1 - fadeRatio) {
        fadeAlpha = (slideProgress - (1 - fadeRatio)) / fadeRatio;
      }

      if (fadeAlpha > 0) {
        ctx.globalAlpha = Math.min(1, fadeAlpha);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (elapsed < totalDurationMs) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => { try { recorder.stop(); } catch {} }, 150);
      }
    };

    recorder.start(250);
    requestAnimationFrame(tick);
  });
}

export async function recordSlideVideo(
  canvas: HTMLCanvasElement,
  animateFn: (progress: number) => void,
  durationMs: number = 4000,
  fps: number = 30
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || 'video/webm';

    let stream: MediaStream;
    try {
      stream = canvas.captureStream(fps);
    } catch {
      reject(new Error('canvas.captureStream is not supported in this browser'));
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    const startTime = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      animateFn(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => { try { recorder.stop(); } catch {} }, 150);
      }
    };

    recorder.start(250);
    requestAnimationFrame(tick);
  });
}

export async function compressImage(file: File, maxPx = 1080, quality = 0.72): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
