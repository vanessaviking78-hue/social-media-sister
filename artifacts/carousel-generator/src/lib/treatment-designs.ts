// Treatments: ten "Possible side effects may include..." covers and the four full bleed photo
// slides that follow them. Everything draws straight onto a 1080 x 1350 canvas so the preview,
// the download and the scheduled image are always identical. No React in here.

import { DEFAULT_FOCUS, headWeightFor, mix, type Fill, type Focus, type Slot } from "./basic-covers";

export const W = 1080;
export const H = 1350;
export { DEFAULT_FOCUS };

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

export type TPalette = { navy: string; coral: string; lime: string; cream: string };
export const T_PALETTE: TPalette = { navy: "#16224f", coral: "#ff6a55", lime: "#c9f26b", cream: "#fbf4e6" };
export const T_PALETTE_LABELS: Record<keyof TPalette, string> = {
  navy: "Dark (text and panels)",
  coral: "Pop colour",
  lime: "Highlight",
  cream: "Light background",
};

// ---------------------------------------------------------------------------
// The ten treatments
// ---------------------------------------------------------------------------

export type TreatId =
  | "lip" | "cheek" | "chin" | "jaw" | "tear" | "temple" | "lower" | "lines" | "nose" | "profile";

export type TextKey = "title" | "head" | "b1" | "b2" | "b3" | "b4" | "callout" | "small";

export type FieldDef = { key: TextKey; label: string; rows: number };
export const FIELDS: FieldDef[] = [
  { key: "title", label: "Treatment name", rows: 1 },
  { key: "head", label: "Headline", rows: 2 },
  { key: "b1", label: "Side effect 1", rows: 2 },
  { key: "b2", label: "Side effect 2", rows: 2 },
  { key: "b3", label: "Side effect 3", rows: 2 },
  { key: "b4", label: "Side effect 4", rows: 2 },
  { key: "callout", label: "Extra note box (leave empty for none)", rows: 2 },
  { key: "small", label: "Small print", rows: 2 },
];

export type CalloutStyle = "none" | "warn" | "box";

export type TreatDef = {
  id: TreatId;
  name: string;
  idea: string;
  layout: 0 | 1 | 2;
  callout: CalloutStyle;
  defaults: Record<TextKey, string>;
};

const STD = "Playful post, not a promise of outcome. Results and suitability vary.";
const PLAY = `${STD} This is playful commentary about how someone may feel, not a medical side-effect claim or guaranteed outcome.`;
const HEAD = "Possible side effects may include...";

const d = (title: string, b: [string, string, string, string], small = STD, callout = "", head = HEAD): Record<TextKey, string> => ({
  title, head, b1: b[0], b2: b[1], b3: b[2], b4: b[3], callout, small,
});

export const TREATMENTS: TreatDef[] = [
  {
    id: "lip", name: "Lip Filler", idea: "lip filler, the funny things that happen afterwards", layout: 0, callout: "none",
    defaults: d("Lip Filler", [
      "suddenly owning 14 lip liners",
      "smiling in photos without thinking about it",
      "discovering your 'good side' has competition",
      "becoming strangely interested in lip balm",
    ], `${STD} Confidence is not promised and outcomes vary.`),
  },
  {
    id: "cheek", name: "Cheek Filler", idea: "cheek filler, light, angles and balance", layout: 1, callout: "none",
    defaults: d("Cheek Filler", [
      "turning your face towards the light on purpose",
      "rediscovering the three-quarter angle",
      "saying 'oh, I see what you mean about balance'",
      "taking one photo and actually keeping it",
    ], PLAY),
  },
  {
    id: "chin", name: "Chin Filler", idea: "chin filler, profile and proportion", layout: 2, callout: "none",
    defaults: d("Chin Filler", [
      "an unexpected appreciation for your side profile",
      "checking photographs from angles you previously avoided",
      "resisting the urge to inspect your profile in every shop window",
      "understanding why proportion matters",
    ]),
  },
  {
    id: "jaw", name: "Jawline Filler", idea: "jawline filler, definition and still looking like you", layout: 0, callout: "none",
    defaults: d("Jawline Filler", [
      "suddenly volunteering for side-on photographs",
      "developing strong opinions about lighting",
      "catching your reflection and doing a tiny double take",
      "saying 'I wanted definition, not a different face'",
    ], PLAY),
  },
  {
    id: "tear", name: "Tear Trough Filler", idea: "tear trough filler, tired eyes and honest consultation", layout: 1, callout: "box",
    defaults: d("Tear Trough Filler", [
      "people asking whether you've been sleeping better",
      "replying 'yes' despite knowing full well you watched Netflix until midnight",
      "using less concealer, if that was your goal",
      "explaining for the 400th time that this treatment is not suitable for everyone",
    ], STD, "Consultation and suitability assessment are essential."),
  },
  {
    id: "temple", name: "Temple Filler", idea: "temple filler, whole face assessment and perspective", layout: 2, callout: "none",
    defaults: d("Temple Filler", [
      "finally understanding what 'whole-face assessment' means",
      "realising the area you never thought about can affect overall balance",
      "becoming deeply suspicious of treatment plans based only on Instagram trends",
      "appreciating subtlety",
    ], `${STD} This is playful commentary about perspective and consultation, not a medical side-effect claim or guaranteed outcome.`),
  },
  {
    id: "lower", name: "Lower-Face Filler", idea: "lower face filler, support, balance and restraint", layout: 0, callout: "none",
    defaults: d("Lower-Face Filler", [
      "learning that the lower face deserves a consultation too",
      "becoming less obsessed with treating one isolated line",
      "appreciating support, balance and restraint",
      "discovering 'less' can involve considerably more thought",
    ]),
  },
  {
    id: "lines", name: "Nose-to-Mouth Lines", idea: "nose to mouth lines, why a proper consultation looks at the whole face", layout: 1, callout: "none",
    defaults: d("About those nose-to-mouth lines...", [
      "discovering we might not treat the line itself",
      "hearing the words 'let's look at the whole face'",
      "being mildly shocked that anatomy is more complicated than TikTok",
      "leaving with a plan instead of a syringe shopping list",
    ], STD, "", "Possible side effects of a proper consultation may include..."),
  },
  {
    id: "nose", name: "Nose Filler", idea: "nose filler, a higher risk area that deserves serious assessment", layout: 2, callout: "warn",
    defaults: d("Nose Filler", [
      "becoming extremely interested in profile photographs",
      "learning that 'non-surgical' does NOT mean 'no risk'",
      "asking far better questions about practitioner experience and emergency preparedness",
      "understanding why this treatment needs serious assessment",
    ], STD, "This is a higher-risk filler area and requires an appropriately trained practitioner and careful consultation."),
  },
  {
    id: "profile", name: "Profile Balancing", idea: "profile balancing, proportion over volume, still looking like you", layout: 0, callout: "box",
    defaults: d("Profile Balancing", [
      "no longer pointing at one tiny feature in the mirror",
      "understanding proportion over volume",
      "choosing a plan instead of collecting treatments",
      "looking like yourself being the entire point",
    ], "Playful post, not a promise of outcome; suitability, risks and results vary.", "Side effect most wanted: still looking like you."),
  },
];

export const TREAT_BY_ID: Record<TreatId, TreatDef> = Object.fromEntries(TREATMENTS.map((t) => [t.id, t])) as Record<TreatId, TreatDef>;

export function fillTreat(text: string, v: Fill): string {
  return (text ?? "")
    .replace(/\{owner\}/gi, v.owner || "[first name]")
    .replace(/\{clinic\}/gi, v.clinic || "[business name]")
    .replace(/\{area\}/gi, v.area || "[area]")
    .replace(/\{role\}/gi, v.role || "Owner")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text ?? "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function fit(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, maxW: number, maxH: number, max: number, min: number, lh: number) {
  let s = max;
  let lines: string[] = [];
  for (; s >= min; s -= 2) {
    ctx.font = font(s);
    lines = wrap(ctx, text, maxW);
    if (lines.length * s * lh <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW + 1)) break;
  }
  s = Math.max(s, min);
  ctx.font = font(s);
  lines = wrap(ctx, text, maxW);
  return { size: s, lines, lh: Math.round(s * lh) };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lh: number, align: CanvasTextAlign = "left"): number {
  ctx.textAlign = align;
  for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
  return y;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPhotoIn(ctx: CanvasRenderingContext2D, bmp: ImageBitmap | null, x: number, y: number, w: number, h: number, focus: Focus, tint: string, label: string, font: string) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (bmp) {
    const s = Math.max(w / bmp.width, h / bmp.height);
    const dw = bmp.width * s, dh = bmp.height * s;
    ctx.drawImage(bmp, x - (dw - w) * focus[0], y - (dh - h) * focus[1], dw, dh);
  } else {
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = `600 34px ${font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textBaseline = "top";
  }
  ctx.restore();
}

function logoAt(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, side: "left" | "right", y: number, maxW: number, maxH: number) {
  if (!logo) return;
  const s = Math.min(maxW / logo.width, maxH / logo.height);
  const w = logo.width * s, h = logo.height * s;
  ctx.drawImage(logo, side === "right" ? W - 50 - w : 50, y, w, h);
}

// ---------------------------------------------------------------------------
// The cover
// ---------------------------------------------------------------------------

export type CoverInput = {
  treat: TreatId;
  layout: 0 | 1 | 2;
  text: Record<TextKey, string>; // already filled
  pal: TPalette;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  logo: HTMLImageElement | null;
};

export function drawCover(ctx: CanvasRenderingContext2D, d: CoverInput): Slot[] {
  const { pal, text: t } = d;
  const dark = d.layout === 2;
  const bg = dark ? pal.navy : pal.cream;
  const ink = dark ? pal.cream : pal.navy;
  const headCol = dark ? pal.lime : pal.navy;
  const hw = headWeightFor(d.headFont);
  const U = (s: string) => (d.upper ? s.toUpperCase() : s);
  const slots: Slot[] = [];
  const callStyle = TREAT_BY_ID[d.treat].callout;
  const hasCall = !!t.callout.trim();

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --- bottom stack: small print, then the note box above it, measured first so the bullets know their room
  const smallSize = 20, smallLh = 27;
  ctx.font = `500 ${smallSize}px ${d.bodyFont}`;
  const smallLines = t.small.trim() ? wrap(ctx, t.small.trim(), 900) : [];
  const smallH = smallLines.length * smallLh;
  const smallY = H - 36 - smallH;

  let callH = 0, callFont = 0, callLines: string[] = [];
  if (hasCall) {
    const warn = callStyle === "warn";
    callFont = warn ? 27 : 32;
    ctx.font = `700 ${callFont}px ${d.bodyFont}`;
    callLines = wrap(ctx, t.callout.trim(), warn ? 790 : 840);
    callH = Math.max(76, callLines.length * Math.round(callFont * 1.28) + 40);
  }
  const callY = smallY - 18 - callH;
  const bottomLimit = hasCall ? callY - 22 : smallY - 22;

  // --- top area by layout
  let bulletsTop: number;
  const headSize = (maxW: number, maxH: number) =>
    fit(ctx, U(t.head), (s) => `${hw} ${s}px ${d.headFont}`, maxW, maxH, 92, 40, 1.04);

  const pill = (x: number, y: number, fill: string, col: string, maxW = 520, align: "left" | "right" = "left") => {
    ctx.font = `${hw} 40px ${d.headFont}`;
    const label = U(t.title);
    let size = 40;
    while (size > 24 && ctx.measureText(label).width > maxW - 56) { size -= 2; ctx.font = `${hw} ${size}px ${d.headFont}`; }
    const w = Math.ceil(ctx.measureText(label).width) + 56, h = size + 34;
    const px = align === "left" ? x : x - w;
    ctx.fillStyle = fill;
    rrect(ctx, px, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textAlign = "left";
    ctx.fillText(label, px + 28, y + 17 + (hw === 400 ? 2 : 0));
    return h;
  };

  if (d.layout === 0 || d.layout === 1) {
    const photoLeft = d.layout === 1;
    const px = photoLeft ? 70 : 640, py = 150, pw = 370, ph = 500;
    const textX = photoLeft ? 500 : 60;
    const textW = photoLeft ? 520 : 500;
    // lime block behind the photo
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate((photoLeft ? 4 : -4) * Math.PI / 180);
    ctx.fillStyle = pal.lime;
    rrect(ctx, -pw / 2 - 14, -ph / 2 - 6, pw, ph, 26);
    ctx.fill();
    ctx.restore();
    // the photo, tilted
    const rot = photoLeft ? -3 : 3;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    rrect(ctx, -pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 20, 26);
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); rrect(ctx, -pw / 2, -ph / 2, pw, ph, 18); ctx.clip();
    drawPhotoIn(ctx, d.photo, -pw / 2, -ph / 2, pw, ph, d.focus, mix(pal.cream, pal.navy, 0.15), "Your image here", d.bodyFont);
    ctx.restore();
    slots.push({ i: 0, x: px, y: py, w: pw, h: ph, rot });

    pill(textX, 62, pal.navy, pal.cream, photoLeft ? W - 40 - textX : 520);
    const hd = headSize(textW, 400);
    ctx.fillStyle = headCol;
    ctx.font = `${hw} ${hd.size}px ${d.headFont}`;
    const endY = drawLines(ctx, hd.lines, textX, 168, hd.lh);
    // a coral squiggle under the headline
    ctx.strokeStyle = pal.coral; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    const sy = Math.min(endY + 18, py + ph - 20);
    ctx.moveTo(textX, sy);
    for (let k = 0; k < 6; k++) ctx.quadraticCurveTo(textX + 22 + k * 44, sy - 14 * (k % 2 ? -1 : 1), textX + 44 + k * 44, sy);
    ctx.stroke();
    bulletsTop = py + ph + 60;
    logoAt(ctx, d.logo, photoLeft ? "right" : "right", 36, 200, 60);
  } else {
    pill(60, 56, pal.coral, pal.navy);
    // wide photo band
    const px = 60, py = 160, pw = 960, ph = hasCall ? 290 : 410;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = pal.cream;
    rrect(ctx, px - 8, py - 8, pw + 16, ph + 16, 34);
    ctx.fill();
    ctx.restore();
    ctx.save();
    rrect(ctx, px, py, pw, ph, 26);
    ctx.clip();
    drawPhotoIn(ctx, d.photo, px, py, pw, ph, d.focus, mix(pal.navy, pal.cream, 0.25), "Your image here", d.bodyFont);
    ctx.restore();
    slots.push({ i: 0, x: px, y: py, w: pw, h: ph, rot: 0 });
    const hd = headSize(960, 150);
    ctx.fillStyle = headCol;
    ctx.font = `${hw} ${hd.size}px ${d.headFont}`;
    const hy = py + ph + 40;
    const endY = drawLines(ctx, hd.lines, 60, hy, hd.lh);
    // sparkles
    ctx.fillStyle = pal.coral;
    for (const [sx, sy2, r] of [[1000, py + 34, 18], [1040, py + 78, 10]] as const) {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, rr = k % 2 ? r * 0.35 : r; ctx.lineTo(sx + Math.cos(a) * rr, sy2 + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    bulletsTop = endY + 26;
    logoAt(ctx, d.logo, "right", 40, 220, 66);
  }

  // --- the four side effects
  const items = [t.b1, t.b2, t.b3, t.b4].map((s) => s.trim());
  const avail = Math.max(240, bottomLimit - bulletsTop);
  const rowH = avail / 4;
  const textLeft = 150;
  const textMax = W - textLeft - 60;
  const sizes: number[] = [];
  let common = 40;
  // one font size for all four so they look like a set
  for (; common >= 24; common -= 2) {
    ctx.font = `600 ${common}px ${d.bodyFont}`;
    const ok = items.every((it) => wrap(ctx, it, textMax).length * common * 1.18 <= rowH - 14);
    if (ok) break;
  }
  common = Math.max(common, 24);
  for (let i = 0; i < 4; i++) sizes.push(common);
  items.forEach((it, i) => {
    const cy = bulletsTop + rowH * i + rowH / 2;
    ctx.fillStyle = i % 2 ? pal.lime : pal.coral;
    ctx.beginPath(); ctx.arc(98, cy, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.navy;
    ctx.font = `${hw} 34px ${d.headFont}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 98, cy + (hw === 400 ? 2 : 0));
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.fillStyle = ink;
    ctx.font = `600 ${sizes[i]}px ${d.bodyFont}`;
    const lines = wrap(ctx, it, textMax);
    const lh = Math.round(sizes[i] * 1.18);
    drawLines(ctx, lines, textLeft, cy - (lines.length * lh) / 2, lh);
    if (i < 3) {
      ctx.strokeStyle = dark ? "rgba(251,244,230,0.22)" : "rgba(22,34,79,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(70, cy + rowH / 2); ctx.lineTo(W - 70, cy + rowH / 2); ctx.stroke();
    }
  });

  // --- the note box
  if (hasCall) {
    const warn = callStyle === "warn";
    const bx = 60, bw = W - 120;
    ctx.fillStyle = warn ? "#c8102e" : pal.lime;
    rrect(ctx, bx, callY, bw, callH, 22);
    ctx.fill();
    if (!warn) { ctx.strokeStyle = pal.navy; ctx.lineWidth = 3; rrect(ctx, bx, callY, bw, callH, 22); ctx.stroke(); }
    const lh = Math.round(callFont * 1.28);
    let tx = bx + 36;
    if (warn) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(bx + 58, callY + callH / 2, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c8102e";
      ctx.font = `700 34px ${d.bodyFont}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("!", bx + 58, callY + callH / 2 + 2);
      ctx.textBaseline = "top";
      tx = bx + 104;
    }
    ctx.fillStyle = warn ? "#ffffff" : pal.navy;
    ctx.font = `700 ${callFont}px ${d.bodyFont}`;
    drawLines(ctx, callLines, tx, callY + (callH - callLines.length * lh) / 2, lh);
  }

  // --- small print
  if (smallLines.length) {
    ctx.fillStyle = dark ? "rgba(251,244,230,0.72)" : "rgba(22,34,79,0.7)";
    ctx.font = `500 ${smallSize}px ${d.bodyFont}`;
    drawLines(ctx, smallLines, 60, smallY, smallLh);
  }
  ctx.restore();
  return slots;
}

// ---------------------------------------------------------------------------
// Slides 2 to 5: a full bleed approved photo with the words over it
// ---------------------------------------------------------------------------

export type PhotoSlideInput = {
  text: string;
  cta?: string;
  small?: string;
  pal: TPalette;
  bodyFont: string;
  headFont: string;
  photo: ImageBitmap | null;
  focus: Focus;
  scrim: number;
  logo: HTMLImageElement | null;
  arrow: boolean;
};

export function drawPhotoSlide(ctx: CanvasRenderingContext2D, d: PhotoSlideInput): Slot[] {
  const slots: Slot[] = [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }];
  ctx.save();
  ctx.textBaseline = "top";
  ctx.fillStyle = d.pal.navy;
  ctx.fillRect(0, 0, W, H);
  if (d.photo) {
    const s = Math.max(W / d.photo.width, H / d.photo.height);
    const dw = d.photo.width * s, dh = d.photo.height * s;
    ctx.drawImage(d.photo, -(dw - W) * d.focus[0], -(dh - H) * d.focus[1], dw, dh);
  } else {
    ctx.fillStyle = mix(d.pal.navy, d.pal.cream, 0.18);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = mix(d.pal.navy, d.pal.cream, 0.6);
    ctx.font = `600 40px ${d.bodyFont}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Choose a photo", W / 2, H / 2);
    ctx.textBaseline = "top";
  }
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(80, d.scrim)) / 100})`;
  ctx.fillRect(0, 0, W, H);
  const gr = ctx.createLinearGradient(0, H * 0.3, 0, H);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, H * 0.3, W, H * 0.7);

  const hasCta = !!d.cta?.trim();
  const body = fit(ctx, d.text, (s) => `600 ${s}px ${d.bodyFont}`, 860, hasCta ? 500 : 620, 66, 32, 1.3);
  const bodyH = body.lines.length * body.lh;

  let pillW = 0, pillH = 0, ctaLines: string[] = [];
  const ctaSize = 38, ctaLh = 48;
  if (hasCta) {
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    ctaLines = wrap(ctx, d.cta!.trim(), 720);
    pillW = Math.min(840, Math.max(...ctaLines.map((l) => ctx.measureText(l).width)) + 90);
    pillH = ctaLines.length * ctaLh + 56;
  }
  const gap = hasCta ? 56 : 0;
  const total = bodyH + gap + pillH;
  let y = Math.round(H * 0.56 - total / 2);

  ctx.shadowColor = "rgba(0,0,0,0.42)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${body.size}px ${d.bodyFont}`;
  y = drawLines(ctx, body.lines, W / 2, y, body.lh, "center");
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  if (hasCta) {
    y += gap;
    const px = (W - pillW) / 2;
    ctx.fillStyle = d.pal.lime;
    rrect(ctx, px, y, pillW, pillH, 40);
    ctx.fill();
    ctx.fillStyle = d.pal.navy;
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    drawLines(ctx, ctaLines, W / 2, y + 28, ctaLh, "center");
  }

  if (d.small?.trim()) {
    ctx.font = `500 20px ${d.bodyFont}`;
    const sl = wrap(ctx, d.small.trim(), 900);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
    drawLines(ctx, sl, W / 2, H - 40 - sl.length * 27, 27, "center");
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }

  if (d.arrow) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const ay = H - 96;
    ctx.beginPath(); ctx.moveTo(W - 168, ay); ctx.lineTo(W - 88, ay); ctx.moveTo(W - 104, ay - 13); ctx.lineTo(W - 88, ay); ctx.lineTo(W - 104, ay + 13); ctx.stroke();
  }
  if (d.logo) {
    const s = Math.min(240 / d.logo.width, 80 / d.logo.height);
    ctx.drawImage(d.logo, W - 50 - d.logo.width * s, 40, d.logo.width * s, d.logo.height * s);
  }
  ctx.restore();
  return slots;
}
