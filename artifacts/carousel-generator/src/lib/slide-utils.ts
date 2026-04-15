export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;

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
];

export const CORNER_STYLES = [
  { label: "None", value: "none" },
  { label: "Triangle", value: "triangle" },
  { label: "Arc", value: "arc" },
  { label: "Double Line", value: "double-line" },
  { label: "Frame", value: "frame" },
];

export const LOGO_POSITIONS = [
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
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Lato:wght@400;700&family=Oswald:wght@400;600;700&family=Merriweather:wght@400;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;700&family=Poppins:wght@400;600;700&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Pacifico&family=Libre+Baskerville:wght@400;700&family=DM+Serif+Display&family=Abril+Fatface&family=Quicksand:wght@400;600;700&family=Nunito:wght@400;600;700&family=Crimson+Text:wght@400;600;700&family=Work+Sans:wght@400;600;700&family=Bitter:wght@400;600;700&family=Josefin+Sans:wght@400;600;700&family=Great+Vibes&display=swap";
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
  textPosition: string = "bottom-left"
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  const scale = Math.max(W / img.width, H / img.height);
  const x = (W - img.width * scale) / 2;
  const y = (H - img.height * scale) / 2;
  ctx.globalAlpha = isCoverSlide ? 1.0 : 0.5;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  ctx.globalAlpha = 1.0;

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
  const textAreaW = isLastSlide ? W - 120 : W - 80;
  const activeTextPos = isLastSlide ? "center-center" : textPosition;

  ctx.fillStyle = textColor;
  ctx.font = `${isLastSlide ? 700 : 600} ${ctaSize}px ${font}`;
  ctx.textBaseline = "top";

  const maxW = textAreaW;
  const lineH = Math.round(ctaSize * lineSpacing);
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);

  const totalH = lines.length * lineH;
  const pad = 40;
  let startX = pad, startY = pad;

  const [vPos, hPos] = activeTextPos.split("-");

  if (hPos === "left") { startX = pad; ctx.textAlign = "left"; }
  else if (hPos === "center") { startX = Math.round(W / 2); ctx.textAlign = "center"; }
  else if (hPos === "right") { startX = W - pad; ctx.textAlign = "right"; }

  if (vPos === "top") { startY = pad; }
  else if (vPos === "center") { startY = Math.round((H - totalH) / 2); }
  else if (vPos === "bottom") { startY = Math.round(H - totalH - pad); }

  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  ctx.fillStyle = overlayColor;
  let boxX = startX - 15;
  if (ctx.textAlign === "right") boxX = startX - maxLineWidth - 15;
  else if (ctx.textAlign === "center") boxX = startX - maxLineWidth / 2 - 15;
  ctx.fillRect(boxX, startY - 15, maxLineWidth + 30, totalH + 30);

  ctx.fillStyle = textColor;
  lines.forEach((line, i) => ctx.fillText(line, startX, startY + i * lineH));

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

  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxTextW = squareSize - 80;
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
    ctx.fillText(line, W / 2, textStartY + i * lineH);
  });

  ctx.fillStyle = textColor;
  ctx.globalAlpha = 0.7;
  ctx.font = `500 ${Math.round(fontSize * 0.5)}px ${font}`;
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
