// The tweet style card, drawn the same way the Tweet Maker tool draws it (copied so the live tool is untouched).
// Used by the Post Pack. 1080 x 1440 for a post.

export const TW = 1080;
export const TH = 1440;

export type TweetStats = { comments: number; likes: number; shares: number };
export type TweetCardInput = {
  name: string;
  handle: string;
  quote: string;
  stats: TweetStats;
  background: ImageBitmap | HTMLImageElement | null;
  profilePhoto: ImageBitmap | HTMLImageElement | null;
  logo?: HTMLImageElement | null;
  dx?: number;
  dy?: number;
};

function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(n);
}

// Draws a simple, recognisable comment-bubble / heart / retweet glyph so the
// stats row reads as an authentic tweet without pulling in an icon library
// inside canvas.
function drawCommentIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.3);
  ctx.arc(x, y - s * 0.05, s * 0.42, Math.PI * 0.85, Math.PI * 2.4);
  ctx.lineTo(x - s * 0.05, y + s * 0.42);
  ctx.lineTo(x - s * 0.22, y + s * 0.2);
  ctx.closePath();
  ctx.stroke();
}
function drawHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, filled: boolean) {
  const r = s * 0.28;
  ctx.beginPath();
  ctx.arc(x - r, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.arc(x + r, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.moveTo(x - r * 1.9, y - r * 0.1);
  ctx.lineTo(x, y + r * 1.7);
  ctx.lineTo(x + r * 1.9, y - r * 0.1);
  ctx.closePath();
  if (filled) ctx.fill();
  else ctx.stroke();
}
function drawRetweetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y - s * 0.15);
  ctx.lineTo(x - s * 0.4, y - s * 0.4);
  ctx.lineTo(x + s * 0.25, y - s * 0.4);
  ctx.moveTo(x + s * 0.1, y - s * 0.55);
  ctx.lineTo(x + s * 0.4, y - s * 0.4);
  ctx.lineTo(x + s * 0.1, y - s * 0.25);
  ctx.moveTo(x + s * 0.4, y + s * 0.15);
  ctx.lineTo(x + s * 0.4, y + s * 0.4);
  ctx.lineTo(x - s * 0.25, y + s * 0.4);
  ctx.moveTo(x - s * 0.1, y + s * 0.55);
  ctx.lineTo(x - s * 0.4, y + s * 0.4);
  ctx.lineTo(x - s * 0.1, y + s * 0.25);
  ctx.stroke();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}


export function drawTweetCard(ctx: CanvasRenderingContext2D, d: TweetCardInput): void {
  const W = TW;
  const H = TH;
  const height = H;
  const isStory = false;
  const profilePhoto = d.profilePhoto;
  const row = { name: d.name, handle: d.handle, quote: d.quote, stats: d.stats, dx: d.dx ?? 0, dy: d.dy ?? 0 };
  ctx.fillStyle = "#dfe7e6";
  ctx.fillRect(0, 0, W, height);
  const bg = d.background;
  if (bg) {
    const bw = bg.width;
    const bh = bg.height;
    const ar = bw / bh;
    let dw = W, dh = height, dx = 0, dy = 0;
    if (ar > W / height) { dh = height; dw = height * ar; dx = (W - dw) / 2; }
    else { dw = W; dh = W / ar; dy = (height - dh) / 2; }
    ctx.drawImage(bg, dx, dy, dw, dh);
  }
  {
      if (row) {
        ctx.save();
        ctx.translate(row.dx || 0, row.dy || 0);
        // Card
        const cardX = W * 0.09;
        const cardW = W * 0.82;
        const cardH = H * 0.45;
        const cardY = isStory ? height / 2 - cardH / 2 - 40 : H * 0.235;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.18)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "rgba(237, 240, 240, 0.94)";
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.fill();
        ctx.restore();

        const pad = cardW * 0.07;
        let cy = cardY + pad + 14;

        // Avatar
        const avR = 34;
        const avX = cardX + pad + avR;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, cy + avR, avR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (profilePhoto) {
          const ar = profilePhoto.width / profilePhoto.height;
          const size = avR * 2;
          let dw = size, dh = size, dx = avX - avR, dy = cy;
          if (ar > 1) { dh = size; dw = size * ar; dx = avX - dw / 2; }
          else { dw = size; dh = size / ar; dy = cy - (dh - size) / 2; }
          ctx.drawImage(profilePhoto, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = "#c7cdcd";
          ctx.fillRect(avX - avR, cy, avR * 2, avR * 2);
        }
        ctx.restore();
        ctx.strokeStyle = "#3f9ee0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(avX, cy + avR, avR, 0, Math.PI * 2);
        ctx.stroke();

        const textX = avX + avR + 20;

        // Name + verified tick
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillStyle = "#0f1419";
        ctx.font = "700 30px Arial, Helvetica, sans-serif";
        const nameW = ctx.measureText(row.name || "name").width;
        ctx.fillText(row.name || "name", textX, cy + 32);

        const tickX = textX + nameW + 12;
        const tickY = cy + 22;
        ctx.fillStyle = "#1d9bf0";
        ctx.beginPath();
        ctx.arc(tickX, tickY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tickX - 5, tickY);
        ctx.lineTo(tickX - 1, tickY + 5);
        ctx.lineTo(tickX + 6, tickY - 6);
        ctx.stroke();

        // "..." top right
        ctx.fillStyle = "#536471";
        const dotsX = cardX + cardW - pad;
        const dotsY = cy + 12;
        [0, 12, 24].forEach((o) => {
          ctx.beginPath();
          ctx.arc(dotsX - 24 + o, dotsY, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });

        // Handle
        ctx.fillStyle = "#536471";
        ctx.font = "400 27px Arial, Helvetica, sans-serif";
        ctx.fillText(`@${row.handle || "clinicname"}`, textX, cy + 64);

        // Quote / body
        ctx.fillStyle = "#0f1419";
        ctx.font = "400 33px Arial, Helvetica, sans-serif";
        const quoteMaxW = cardW - pad * 2;
        const quoteLines = wrapText(ctx, row.quote || "Your quote from the CSV will appear here.", quoteMaxW);
        let qy = cy + 130;
        for (const line of quoteLines) {
          ctx.fillText(line, cardX + pad, qy);
          qy += 40;
        }

        // Divider
        const dividerY = cardY + cardH - 82;
        ctx.strokeStyle = "rgba(15,20,25,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cardX + pad, dividerY);
        ctx.lineTo(cardX + cardW - pad, dividerY);
        ctx.stroke();

        // Stats row
        const statsY = dividerY + 42;
        ctx.strokeStyle = "#536471";
        ctx.fillStyle = "#536471";
        ctx.lineWidth = 2.5;
        ctx.font = "400 26px Arial, Helvetica, sans-serif";
        ctx.textAlign = "left";

        drawCommentIcon(ctx, cardX + pad + 12, statsY, 26);
        ctx.fillText(formatCount(row.stats.comments), cardX + pad + 40, statsY + 8);

        const heartX = cardX + pad + 190;
        drawHeartIcon(ctx, heartX, statsY, 26, false);
        ctx.fillText(formatCount(row.stats.likes), heartX + 28, statsY + 8);

        const rtX = cardX + pad + 370;
        drawRetweetIcon(ctx, rtX, statsY, 26);
        ctx.fillText(formatCount(row.stats.shares), rtX + 28, statsY + 8);
        ctx.restore();
      }
  }
  if (d.logo && d.logo.naturalWidth > 0) {
    const margin = 40;
    const logoH = 120;
    const logoW = Math.round(logoH * (d.logo.width / d.logo.height));
    ctx.drawImage(d.logo, W - logoW - margin, margin, logoW, logoH);
  }
}
