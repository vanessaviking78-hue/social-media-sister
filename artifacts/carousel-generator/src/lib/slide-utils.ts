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
];

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
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Lato:wght@400;700&family=Oswald:wght@400;600;700&family=Merriweather:wght@400;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;700&family=Poppins:wght@400;600;700&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Pacifico&family=Libre+Baskerville:wght@400;700&family=DM+Serif+Display&family=Abril+Fatface&family=Quicksand:wght@400;600;700&family=Nunito:wght@400;600;700&family=Crimson+Text:wght@400;600;700&family=Work+Sans:wght@400;600;700&family=Bitter:wght@400;600;700&family=Josefin+Sans:wght@400;600;700&family=Great+Vibes&family=Cinzel:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }
}

export function drawSlide(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
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
  const textAreaW = isLastSlide ? W - 20 : (isCoverSlide ? W - 10 : W - 20);
  const activeTextPos = isLastSlide ? "center" : textPosition;

  const activeFont = isCoverSlide ? font : (subheadingFont || font);

  ctx.fillStyle = textColor;
  ctx.font = `${isLastSlide ? 700 : 600} ${ctaSize}px ${activeFont}`;
  ctx.textBaseline = "top";
  (ctx as any).letterSpacing = (isCoverSlide && coverLetterSpacing) ? `${coverLetterSpacing}px` : "0px";

  const maxW = textAreaW;
  const lineH = Math.round(ctaSize * lineSpacing);
  const words = displayText.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);

  const totalH = lines.length * lineH;

  // --- Cover subheading (only on cover slide, not the last-slide CTA) ---
  const hasCoverSubheading = isCoverSlide && !isLastSlide && !!coverSubheading?.trim();
  let subheadingLines: string[] = [];
  let subheadingSize = 0;
  let subheadingLineH = 0;
  let subheadingTotalH = 0;
  let subheadingGap = 0;
  let subheadingMaxW = 0;
  if (hasCoverSubheading) {
    subheadingSize = Math.round(ctaSize * 0.65);
    subheadingLineH = Math.round(subheadingSize * lineSpacing);
    subheadingGap = Math.round(ctaSize * 0.25);
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
    // Restore main heading font
    ctx.font = `${isLastSlide ? 700 : 600} ${ctaSize}px ${activeFont}`;
  }
  const combinedTotalH = totalH + (hasCoverSubheading ? subheadingGap + subheadingTotalH : 0);

  const pad = 40;
  let startX = pad, startY = pad;

  const vPos = activeTextPos;
  const activeAlign = isLastSlide ? "center" : textAlign;

  if (activeAlign === "center") { startX = Math.round(W / 2); ctx.textAlign = "center"; }
  else if (activeAlign === "right") { startX = W - pad; ctx.textAlign = "right"; }
  else { startX = pad; ctx.textAlign = "left"; }

  if (vPos === "top") { startY = pad; }
  else if (vPos === "center") { startY = Math.round((H - combinedTotalH) / 2); }
  else { startY = Math.round(H - combinedTotalH - pad); }

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
    let boxX = startX - 15;
    if (ctx.textAlign === "right") boxX = startX - effectiveMaxLineWidth - 15;
    else if (ctx.textAlign === "center") boxX = startX - effectiveMaxLineWidth / 2 - 15;
    ctx.fillRect(boxX, startY - 15, effectiveMaxLineWidth + 30, combinedTotalH + 30);
    if (textBoxOutline) {
      ctx.strokeStyle = textBoxOutlineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, startY - 15, effectiveMaxLineWidth + 30, combinedTotalH + 30);
    }
  }

  if (!showTextOverlay) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  ctx.fillStyle = textColor;
  lines.forEach((line, i) => ctx.fillText(line, startX, startY + i * lineH));

  if (hasCoverSubheading && subheadingLines.length > 0) {
    const subFontStr = subheadingFont || font;
    ctx.font = `500 ${subheadingSize}px ${subFontStr}`;
    const subStartY = startY + totalH + subheadingGap;
    subheadingLines.forEach((line, i) => ctx.fillText(line, startX, subStartY + i * subheadingLineH));
  }

  if (!showTextOverlay) {
    ctx.restore();
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
