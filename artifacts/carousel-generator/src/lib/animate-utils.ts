export type ReelAnimType =
  | "none"
  | "fade-in"
  | "pop-in"
  | "slide-left"
  | "slide-right"
  | "slide-top"
  | "slide-bottom"
  | "typewriter"
  | "photo-zoom"
  | "photo-drift"
  | "gentle-drift"
  | "outline-glow"
  | "sparkle-twinkle"
  | "heart-pulse";

export interface ElementAnimation {
  type: ReelAnimType;
  startAt: number;
  repeat: boolean;
}

export const REEL_ANIM_LABELS: Record<ReelAnimType, { label: string; desc: string }> = {
  "none":           { label: "None",            desc: "Static — no motion" },
  "fade-in":        { label: "Fade In",          desc: "Fades from invisible to full opacity" },
  "pop-in":         { label: "Pop In",           desc: "Scales from 0 with bounce ease" },
  "slide-left":     { label: "Slide from Left",  desc: "Enters from the left with fade" },
  "slide-right":    { label: "Slide from Right", desc: "Enters from the right with fade" },
  "slide-top":      { label: "Slide from Top",   desc: "Enters from the top with fade" },
  "slide-bottom":   { label: "Slide from Bottom",desc: "Enters from the bottom with fade" },
  "typewriter":     { label: "Typewriter",        desc: "Letters appear one by one" },
  "photo-zoom":     { label: "Photo Zoom",        desc: "Subtle 3% Ken Burns zoom over 5 s" },
  "photo-drift":    { label: "Photo Drift",       desc: "Slow Ken Burns pan across photo" },
  "gentle-drift":   { label: "Gentle Drift",      desc: "Slow circular float — for overlays" },
  "outline-glow":   { label: "Outline Glow",      desc: "Pulsing bright border — for stickers" },
  "sparkle-twinkle":{ label: "Sparkle Twinkle",   desc: "Rotation + scale pulse loop" },
  "heart-pulse":    { label: "Heart Pulse",        desc: "Scale 100 → 120 → 100 loop" },
};

const REEL_DURATION_S = 5;
const ANIM_ENTRY_DURATION = 0.7;

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function bounce(t: number) {
  if (t < 0.6) return (1 / 0.36) * t * t;
  if (t < 0.85) { const f = t - 0.725; return (1 / 0.0506) * f * f + 0.75; }
  const f = t - 0.925; return (1 / 0.0194) * f * f + 0.9375;
}

function localT(globalT: number, startAt: number, repeat: boolean, duration: number = ANIM_ENTRY_DURATION): number {
  const offset = globalT * REEL_DURATION_S - startAt;
  if (offset < 0) return 0;
  if (repeat) return (offset % REEL_DURATION_S) / REEL_DURATION_S;
  return Math.min(1, offset / duration);
}

export function applyPhotoAnimation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  anim: ElementAnimation,
  globalT: number,
  W: number,
  H: number,
) {
  const t = globalT;
  ctx.save();

  if (anim.type === "photo-zoom") {
    const scale = 1 + 0.03 * easeInOut(t);
    const tx = (W - W * scale) / 2;
    const ty = (H - H * scale) / 2;
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
  } else if (anim.type === "photo-drift") {
    const maxX = W * 0.04;
    const maxY = H * 0.03;
    const dx = Math.sin(t * Math.PI) * maxX;
    const dy = (easeInOut(t) - 0.5) * maxY;
    ctx.translate(dx, dy);
    const scale = 1.05;
    const ox = (W - W * scale) / 2;
    const oy = (H - H * scale) / 2;
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
  }

  const ar = img.naturalWidth / img.naturalHeight;
  const canvasAr = W / H;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ar > canvasAr) { sw = Math.round(img.naturalHeight * canvasAr); sx = Math.round((img.naturalWidth - sw) / 2); }
  else { sh = Math.round(img.naturalWidth / canvasAr); sy = Math.round((img.naturalHeight - sh) / 2); }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  ctx.restore();
}

export function applyTextAnimation(
  ctx: CanvasRenderingContext2D,
  text: string,
  anim: ElementAnimation,
  globalT: number,
  W: number,
  H: number,
  textColor: string,
  fontFamily: string,
  fontSize: number,
  textPosition: "top" | "center" | "bottom",
) {
  if (anim.type === "none") return;

  const lt = localT(globalT, anim.startAt, anim.repeat);
  if (lt <= 0 && anim.type !== "typewriter") return;

  const pad = Math.round(H * 0.06);
  const maxW = W * 0.82;

  ctx.save();
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);

  const lineH = Math.round(fontSize * 1.15);
  const totalH = lines.length * lineH;

  let baseY: number;
  if (textPosition === "top") baseY = pad + fontSize;
  else if (textPosition === "bottom") baseY = H - pad - totalH + fontSize;
  else baseY = Math.round((H - totalH) / 2) + fontSize;

  const cx = W / 2;

  if (anim.type === "typewriter") {
    const duration = Math.max(0.5, Math.min(1.5, text.length * 0.04));
    const rawLt = localT(globalT, anim.startAt, anim.repeat, duration);
    const fullText = rawLt >= 1 ? text : text.slice(0, Math.floor(rawLt * text.length));
    const displayText = rawLt < 1 ? fullText + "▍" : fullText;

    const twWords = displayText.split(/\s+/).filter(Boolean);
    const twLines: string[] = [];
    let twCur = "";
    for (const word of twWords) {
      const test = twCur ? twCur + " " + word : word;
      if (ctx.measureText(test).width > maxW && twCur) { twLines.push(twCur); twCur = word; }
      else twCur = test;
    }
    if (twCur) twLines.push(twCur);

    ctx.fillStyle = textColor;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    twLines.forEach((l, i) => ctx.fillText(l, cx, baseY + i * lineH));
    ctx.restore();
    return;
  }

  ctx.globalAlpha = Math.min(1, easeOut(lt));

  if (anim.type === "fade-in") {
  } else if (anim.type === "pop-in") {
    const scale = 0.4 + 0.6 * bounce(lt);
    ctx.translate(cx, baseY + totalH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(baseY + totalH / 2));
  } else if (anim.type === "slide-left") {
    const slideAmt = W * 0.4 * (1 - easeOut(lt));
    ctx.translate(-slideAmt, 0);
  } else if (anim.type === "slide-right") {
    const slideAmt = W * 0.4 * (1 - easeOut(lt));
    ctx.translate(slideAmt, 0);
  } else if (anim.type === "slide-top") {
    const slideAmt = H * 0.3 * (1 - easeOut(lt));
    ctx.translate(0, -slideAmt);
  } else if (anim.type === "slide-bottom") {
    const slideAmt = H * 0.3 * (1 - easeOut(lt));
    ctx.translate(0, slideAmt);
  } else if (anim.type === "gentle-drift") {
    const phase = (globalT * Math.PI * 2);
    ctx.translate(Math.sin(phase) * 8, Math.cos(phase * 0.7) * 6);
    ctx.globalAlpha = 1;
  } else if (anim.type === "outline-glow") {
    const pulse = 0.5 + 0.5 * Math.sin(globalT * Math.PI * 4);
    ctx.shadowColor = `rgba(255,200,50,${0.5 + pulse * 0.5})`;
    ctx.shadowBlur = 12 + pulse * 16;
    ctx.globalAlpha = 1;
  } else if (anim.type === "sparkle-twinkle") {
    const angle = Math.sin(globalT * Math.PI * 3) * 0.15;
    const scale = 1 + 0.12 * Math.abs(Math.sin(globalT * Math.PI * 4));
    ctx.translate(cx, baseY + totalH / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(baseY + totalH / 2));
    ctx.globalAlpha = 1;
  } else if (anim.type === "heart-pulse") {
    const scale = 1 + 0.2 * Math.abs(Math.sin(globalT * Math.PI * 2.5));
    ctx.translate(cx, baseY + totalH / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(baseY + totalH / 2));
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = textColor;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  lines.forEach((l, i) => ctx.fillText(l, cx, baseY + i * lineH));
  ctx.restore();
}
