import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Download, ShieldCheck, RefreshCcw, FileSpreadsheet, Images, ImageOff, CalendarClock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import Papa from "papaparse";
import { readFileAsText, stripSlideCsvTitleRow } from "@/lib/csv-format";
import JSZip from "jszip";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const STORY_H = 1920;

type TweetRow = {
  name: string;
  handle: string;
  quote: string;
  bgUrl: string;
  stats: { comments: number; likes: number; shares: number };
  /** Where the card has been dragged to, in canvas pixels away from its default spot. */
  dx: number;
  dy: number;
  /** The Instagram caption for this tweet, written on the caption step and editable. */
  caption: string;
};

const CONFETTI_COLOURS = ["#ec4899", "#f59e0b", "#a855f7", "#22c55e", "#3b82f6", "#facc15", "#f43f5e"];
const CONFETTI = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 6 + ((i * 7) % 9),
  dur: 2.8 + ((i * 13) % 20) / 10,
  delay: ((i * 11) % 30) / 10,
  colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
}));

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Remote images must be requested with CORS or they taint the canvas and block export.
    if (!src.startsWith("blob:") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function randomStats() {
  return {
    comments: Math.floor(80 + Math.random() * 300),
    likes: Math.floor(4000 + Math.random() * 22000),
    shares: Math.floor(30 + Math.random() * 250),
  };
}

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

type SlotKey = "sun7pm" | "sat9am" | "both";
const SLOT_LABEL: Record<SlotKey, string> = { sun7pm: "Sunday 7pm", sat9am: "Saturday 9am", both: "Both, twice a week" };

// The first slot for the chosen option, as a local "YYYY-MM-DDTHH:mm" string, which is the
// format the schedule screen expects. Always in the future, never today if the time has gone.
// "both" starts on whichever of Saturday 9am or Sunday 7pm comes round first.
function nextSlotLocal(slot: SlotKey): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const next = (day: number, hh: number): Date => {
    const d = new Date();
    d.setHours(hh, 0, 0, 0);
    let add = (day - d.getDay() + 7) % 7;
    if (add === 0 && d.getTime() <= Date.now() + 5 * 60000) add = 7;
    d.setDate(d.getDate() + add);
    return d;
  };
  const sat = next(6, 9);
  const sun = next(0, 19);
  const d = slot === "sat9am" ? sat : slot === "sun7pm" ? sun : (sat.getTime() <= sun.getTime() ? sat : sun);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

// The different asks the captions rotate through. Each one is a tag or a share, phrased so it
// feels like a friend nudging a friend rather than a robot asking for engagement.
const CTA_ASKS = [
  "tag the friend who would say this exact thing",
  "send this to the one person who will relate the most",
  "share it with someone who needs a laugh today",
  "tag your partner in crime, the one who has lived through this with you",
  "tag the group chat legend who is always the first to understand",
  "share it to your story and tag whoever sprang to mind",
  "tag a woman who is doing all of this and still looks incredible",
  "send it to the friend who always gets it, and tell them why you thought of them",
];

// No em dashes or spaced en dashes in any caption.
const noDashes = (t: string) =>
  t.replace(/(\d)–(\d)/g, "$1-$2").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");

export default function TweetMaker() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [rows, setRows] = useState<TweetRow[]>([]);
  const [bgImages, setBgImages] = useState<HTMLImageElement[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [slot, setSlot] = useState<SlotKey>("sun7pm");
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<{ count: number; client: string } | null>(null);
  const [scheduleStart, setScheduleStart] = useState<string | undefined>(undefined);
  const [scheduledSlot, setScheduledSlot] = useState<SlotKey>("sun7pm");
  const [scheduleStories, setScheduleStories] = useState<{ imageUrl: string; title: string }[] | undefined>(undefined);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find((p) => p.name === clientName) ?? null;

  // Pull the clinic's own logo automatically from their preset, same convention
  // used across the other carousel tools, rather than asking Vanessa to upload it.
  useEffect(() => {
    if (selectedPreset?.logoUrl) {
      loadImg(selectedPreset.logoUrl).then(setLogoImg).catch(() => setLogoImg(null));
    } else {
      setLogoImg(null);
    }
  }, [selectedPreset?.logoUrl]);

  const loadProfilePhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => setProfilePhoto(img);
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const parseCsv = (file: File) => {
    readFileAsText(file).then((raw) => {
    const normalized = stripSlideCsvTitleRow(raw, true);
    Papa.parse<string[]>(normalized, {
      skipEmptyLines: true,
      complete: (result) => {
        const dataRows = result.data.slice(1); // first row is the header
        if (!dataRows.length) { toast.error("No data rows found after the header"); return; }
        const parsed: TweetRow[] = dataRows
          .map((r) => {
            const cols = Array.isArray(r) ? r : [String(r)];
            return {
              name: (cols[0] ?? "").trim(),
              handle: (cols[1] ?? "").trim().replace(/^@/, ""),
              quote: (cols[2] ?? "").trim(),
              bgUrl: "",
              stats: randomStats(),
              dx: 0,
              dy: 0,
              caption: "",
            };
          })
          .filter((r) => r.name || r.quote);
        if (!parsed.length) { toast.error("Couldn't find any usable rows in that CSV"); return; }
        setRows(parsed);
        setSelectedIndex(0);
        toast.success(`Loaded ${parsed.length} row${parsed.length !== 1 ? "s" : ""} from the CSV`);
      },
      error: (err: Error) => toast.error(err.message),
    });
    });
  };

  const loadBgFiles = async (files: File[]) => {
    const urls = files.map((f) => URL.createObjectURL(f));
    try {
      const imgs = await Promise.all(urls.map(loadImg));
      setBgImages(imgs);
      toast.success(`${imgs.length} background photo${imgs.length !== 1 ? "s" : ""} loaded`);
    } catch {
      toast.error("Some background photos couldn't be loaded");
    }
  };

  // Backgrounds are matched to rows in order; if there are fewer photos than
  // rows the last one repeats for whatever's left, same pattern as the other
  // bulk tools in the app.
  const bgForIndex = useCallback((i: number): HTMLImageElement | null => {
    if (!bgImages.length) return null;
    return bgImages[i] ?? bgImages[bgImages.length - 1];
  }, [bgImages]);

  // `height` is 1440 for the grid post and 1920 for a story. The card stays the same size and the
  // photo simply fills the taller frame, so the story looks like the post, not a stretched copy.
  const render = useCallback((canvas: HTMLCanvasElement | null, rowIndex: number, height: number = H) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const isStory = height !== H;
    canvas.width = W;
    canvas.height = height;
    const row = rows[rowIndex];

    // Background
    const bg = bgForIndex(rowIndex);
    ctx.fillStyle = "#dfe7e6";
    ctx.fillRect(0, 0, W, height);
    if (bg) {
      const ar = bg.width / bg.height;
      let dw = W, dh = height, dx = 0, dy = 0;
      if (ar > W / height) { dh = height; dw = height * ar; dx = (W - dw) / 2; }
      else { dw = W; dh = W / ar; dy = (height - dh) / 2; }
      ctx.drawImage(bg, dx, dy, dw, dh);
    }

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

    // Clinic logo, pulled from the preset, same placement convention as the
    // other carousel tools use.
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0 && selectedPreset) {
      const margin = 40;
      // Stories keep the logo clear of the Instagram buttons at the top and the reply bar at the bottom.
      const vMargin = isStory ? 220 : margin;
      const logoSize = selectedPreset.logoSize || 120;
      const ar = logoImg.width / logoImg.height;
      const logoW = Math.round(logoSize * ar);
      const logoH = logoSize;
      let lx = W - logoW - margin, ly = vMargin;
      const pos = selectedPreset.logoPosition;
      if (pos === "bottom-left") { lx = margin; ly = height - logoH - vMargin; }
      else if (pos === "bottom-right") { lx = W - logoW - margin; ly = height - logoH - vMargin; }
      ctx.drawImage(logoImg, lx, ly, logoW, logoH);
    }
  }, [rows, bgForIndex, profilePhoto, logoImg, selectedPreset]);

  useEffect(() => {
    render(canvasRef.current, selectedIndex);
  }, [render, selectedIndex]);

  const shuffleStats = () => {
    setRows((prev) => prev.map((r, i) => (i === selectedIndex ? { ...r, stats: randomStats() } : r)));
  };

  // ---- Dragging the tweet card on the preview ----
  // The card sits at a fixed default spot. Dragging it changes this tweet's offset, which the
  // renderer applies to the post and to its story, so what you see is what gets posted.
  const CARD = { x: W * 0.09, w: W * 0.82, y: H * 0.235, h: H * 0.45 };
  const dragRef = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const scale = W / r.width;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  };
  const overCard = (pt: { x: number; y: number }, row: TweetRow) =>
    pt.x >= CARD.x + row.dx && pt.x <= CARD.x + row.dx + CARD.w && pt.y >= CARD.y + row.dy && pt.y <= CARD.y + row.dy + CARD.h;
  const onCardPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const row = rows[selectedIndex];
    if (!row) return;
    const pt = canvasPoint(e);
    if (!overCard(pt, row)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
    dragRef.current = { startX: pt.x, startY: pt.y, baseDx: row.dx, baseDy: row.dy };
  };
  const onCardPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = canvasPoint(e);
    const d = dragRef.current;
    if (!d) {
      const row = rows[selectedIndex];
      e.currentTarget.style.cursor = row && overCard(pt, row) ? "grab" : "default";
      return;
    }
    const dx = clamp(d.baseDx + pt.x - d.startX, -CARD.x, W - CARD.x - CARD.w);
    const dy = clamp(d.baseDy + pt.y - d.startY, -CARD.y, H - CARD.y - CARD.h);
    setRows((prev) => prev.map((r, i) => (i === selectedIndex ? { ...r, dx, dy } : r)));
  };
  const onCardPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    e.currentTarget.style.cursor = "grab";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const resetPosition = () => setRows((prev) => prev.map((r, i) => (i === selectedIndex ? { ...r, dx: 0, dy: 0 } : r)));
  const applyPositionToAll = () => {
    const src = rows[selectedIndex];
    if (!src) return;
    setRows((prev) => prev.map((r) => ({ ...r, dx: src.dx, dy: src.dy })));
    toast.success("Card position copied to every tweet");
  };

  // ---- Captions, written before anything is scheduled ----
  const [captioning, setCaptioning] = useState<string | null>(null);
  const captionFor = async (quote: string, askIndex: number): Promise<string> => {
    if (!selectedPreset) throw new Error("Pick a client first");
    // A different way of asking for the tag or the share on each tweet, so a run of posts never repeats itself.
    const ask = CTA_ASKS[((askIndex % CTA_ASKS.length) + CTA_ASKS.length) % CTA_ASKS.length];
    const res = await fetch(`${BASE}/api/caption-generator/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tone: "1",
        clinicName: selectedPreset.name,
        context:
          `An Instagram single image post. The image is a tweet style graphic that says: "${quote}"\n` +
          `Write a short, warm, funny caption that adds something the graphic does not already say. ` +
          `Write it as the social media manager for an aesthetics clinic speaking directly to the reader, never as a clinician. ` +
          `Make no medical claims and no promises about results. ` +
          `Use UK spelling, no hashtags, and never use em dashes or en dashes. ` +
          `The caption needs one strong, friendly call to action that gets the reader to tag or share, worded in your own natural way along these lines: ${ask}. ` +
          `Make that call to action the heart of the caption, not an afterthought, and do not copy the wording above word for word. ` +
          `Finish the whole caption with one question that relates to the post.`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.caption) throw new Error(data.error || "Caption generation failed");
    let caption = noDashes(String(data.caption));
    const footnote = selectedPreset.captionFootnote?.trim();
    if (footnote && !caption.includes(footnote)) caption += `\n\n${footnote}`;
    return caption;
  };
  const setCaption = (index: number, caption: string) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, caption } : r)));
  // Fills in every tweet that has no caption yet, so anything already written or edited is left alone.
  const generateAllCaptions = async () => {
    if (!selectedPreset) { toast.error("Pick a client first so the captions are written in their name"); return; }
    const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.caption.trim());
    if (!todo.length) { toast.success("Every tweet already has a caption"); return; }
    let done = 0;
    let failed = 0;
    for (const { r, i } of todo) {
      setCaptioning(`Writing caption ${done + failed + 1} of ${todo.length}`);
      try { setCaption(i, await captionFor(r.quote, i)); done++; } catch { failed++; }
    }
    setCaptioning(null);
    if (failed) toast.error(`${failed} caption${failed !== 1 ? "s" : ""} did not come through. Press Generate captions again to retry them.`);
    else toast.success(`${done} caption${done !== 1 ? "s" : ""} written. Have a read, you can edit any of them.`);
  };
  const rewriteCaption = async () => {
    const row = rows[selectedIndex];
    if (!row) return;
    setCaptioning("Rewriting");
    try { setCaption(selectedIndex, await captionFor(row.quote, selectedIndex + 1 + Math.floor(Math.random() * CTA_ASKS.length))); }
    catch (e: any) { toast.error(e?.message || "Could not rewrite that caption"); }
    finally { setCaptioning(null); }
  };
  const captionsReady = rows.filter((r) => r.caption.trim()).length;
  const allCaptioned = rows.length > 0 && captionsReady === rows.length;

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `tweet-${(rows[selectedIndex]?.name || "graphic").replace(/\s+/g, "")}-${Date.now()}.png`;
    a.click();
  };

  const saveToLibrary = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const up = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: `tweet-${Date.now()}.png`, base64: dataUrl }] }),
      });
      if (!up.ok) throw new Error("Image upload failed");
      const { results } = await up.json() as { results: { url: string }[] };
      const url = results[0]?.url;
      if (!url) throw new Error("No image URL returned");
      const lib = await fetch(`${BASE}/api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, postType: "single", caption: rows[selectedIndex]?.quote || "", mediaUrl: url, metadata: { source: "tweet-maker" } }),
      });
      if (!lib.ok) throw new Error("Save failed");
      toast.success(`Saved to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadAll = async () => {
    if (!rows.length) { toast.error("Load a CSV first"); return; }
    setZipping(true);
    try {
      const zip = new JSZip();
      const offscreen = document.createElement("canvas");
      for (let i = 0; i < rows.length; i++) {
        render(offscreen, i);
        const blob = await canvasToBlob(offscreen);
        const safeName = (rows[i].name || `tweet-${i + 1}`).replace(/[^a-z0-9]/gi, "");
        zip.file(`${safeName || `tweet-${i + 1}`}.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `tweet-maker-batch-${Date.now()}.zip`;
      a.click();
      toast.success(`Zipped up ${rows.length} graphics`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't build the zip");
    } finally {
      setZipping(false);
    }
  };

  const saveAllToLibrary = async () => {
    if (!rows.length) { toast.error("Load a CSV first"); return; }
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    setSavingAll(true);
    try {
      const offscreen = document.createElement("canvas");
      let saved = 0;
      for (let i = 0; i < rows.length; i++) {
        render(offscreen, i);
        const dataUrl = offscreen.toDataURL("image/png");
        const up = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name: `tweet-${i}-${Date.now()}.png`, base64: dataUrl }] }),
        });
        if (!up.ok) continue;
        const { results } = await up.json() as { results: { url: string }[] };
        const url = results[0]?.url;
        if (!url) continue;
        const lib = await fetch(`${BASE}/api/library`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName, postType: "single", caption: rows[i].quote, mediaUrl: url, metadata: { source: "tweet-maker" } }),
        });
        if (lib.ok) saved++;
      }
      toast.success(`Saved ${saved} of ${rows.length} to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Batch save failed");
    } finally {
      setSavingAll(false);
    }
  };

  // Renders every tweet, uploads it, writes a caption for it, then opens the schedule screen with
  // the first post on the chosen slot and one post a week on that same slot after it. Nothing is
  // booked until the person confirms on that screen.
  const scheduleBatch = async () => {
    if (!rows.length) { toast.error("Load a CSV first"); return; }
    if (!selectedPreset) { toast.error("Pick a client first so I know whose page to schedule to"); return; }
    const missing = rows.findIndex((r) => !r.caption.trim());
    if (missing !== -1) { toast.error(`Tweet ${missing + 1} needs a caption first. Press Generate captions above.`); return; }
    setScheduling("Starting");
    try {
      const offscreen = document.createElement("canvas");
      const items: SchedulePostPayload[] = [];
      const stories: { imageUrl: string; title: string }[] = [];
      // Uploads one image, trying up to three times so a wobbly connection does not lose the batch.
      const uploadPng = async (dataUrl: string, name: string): Promise<string> => {
        let url = "";
        for (let attempt = 0; attempt < 3 && !url; attempt++) {
          try {
            const up = await fetch(`${BASE}/api/content/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ images: [{ name, base64: dataUrl }] }),
            });
            if (!up.ok) throw new Error("Image upload failed");
            const { results } = await up.json() as { results: { url: string }[] };
            url = results[0]?.url ?? "";
            if (!url) throw new Error("No image URL returned");
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
        return url;
      };
      for (let i = 0; i < rows.length; i++) {
        setScheduling(`Uploading tweet ${i + 1} of ${rows.length}`);
        render(offscreen, i);
        const url = await uploadPng(offscreen.toDataURL("image/png"), `tweet-${i + 1}-${Date.now()}.png`);
        // The same tweet as a story, 1080 x 1920, so every post also goes out as a story.
        setScheduling(`Making story ${i + 1} of ${rows.length}`);
        render(offscreen, i, STORY_H);
        const storyUrl = await uploadPng(offscreen.toDataURL("image/png"), `tweet-${i + 1}-story-${Date.now()}.png`);
        const title = `${rows[i].quote.slice(0, 60)} · ${selectedPreset.name}`;
        items.push({ title, caption: rows[i].caption.trim(), imageUrls: [url] });
        stories.push({ imageUrl: storyUrl, title });
      }
      setScheduleStories(stories);
      setScheduleStart(nextSlotLocal(slot));
      setScheduledSlot(slot);
      setScheduleItems(items);
      setScheduleOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not get the batch ready to schedule");
    } finally {
      setScheduling(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Tweet Maker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Authentic-looking tweet graphics, built from a CSV, one clinic's batch at a time.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Choose a client</h2>
            <p className="text-xs text-muted-foreground">Pulls their logo in automatically, no need to upload it.</p>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Profile photo</h2>
            <p className="text-xs text-muted-foreground">One photo, reused across the whole batch for this clinic.</p>
            <div
              onClick={() => profileFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadProfilePhoto(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{profilePhoto ? "Photo loaded. Click to change." : "Click or drop the profile photo"}</p>
            </div>
            <input ref={profileFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadProfilePhoto(e.target.files[0]); e.target.value = ""; }} />
            <ApprovedImagesPicker
              clientName={clientName}
              mode="single"
              skipBackgroundRemoval
              large
              label="Use an approved photo as the profile photo"
              onAddImages={(files) => { if (files[0]) loadProfilePhoto(files[0]); }}
            />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Upload the CSV</h2>
            <p className="text-xs text-muted-foreground">Columns, in order: name, clinic Instagram handle, quote. First row is treated as the header.</p>
            <div
              onClick={() => csvFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) parseCsv(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{rows.length ? `${rows.length} row${rows.length !== 1 ? "s" : ""} loaded. Click to replace.` : "Click or drop the CSV"}</p>
            </div>
            <input ref={csvFileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) parseCsv(e.target.files[0]); e.target.value = ""; }} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">4. Background photos</h2>
            <p className="text-xs text-muted-foreground">Upload one per row, in the same order as the CSV. Add fewer than rows and the last one repeats.</p>
            <div
              onClick={() => bgFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) loadBgFiles(Array.from(e.dataTransfer.files)); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <Images className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{bgImages.length ? `${bgImages.length} photo${bgImages.length !== 1 ? "s" : ""} loaded` : "Click or drop background photos"}</p>
            </div>
            <input ref={bgFileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) loadBgFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <ApprovedImagesPicker
              clientName={clientName}
              mode="multi"
              skipBackgroundRemoval
              large
              label="Use approved photos as the backgrounds"
              onAddImages={(files) => { if (files.length) loadBgFiles(files); }}
            />
            {rows.length > 0 && bgImages.length > 0 && bgImages.length < rows.length && (
              <p className="text-[11px] text-amber-500">{bgImages.length} photo{bgImages.length !== 1 ? "s" : ""} for {rows.length} rows, the last photo repeats for the remaining {rows.length - bgImages.length}.</p>
            )}
          </section>

          {rows.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-base">5. Pick a row to preview</h2>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {rows.map((r, i) => (
                  <button key={i} onClick={() => setSelectedIndex(i)}
                    className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-colors ${selectedIndex === i ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"}`}>
                    <span className="font-medium">{r.name || "(no name)"}</span>
                    <span className="text-xs opacity-70"> @{r.handle || "handle"} — {r.quote.slice(0, 40)}{r.quote.length > 40 ? "…" : ""}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-border/30 bg-black/10 flex flex-col items-center justify-center gap-2 py-24" style={{ aspectRatio: "3 / 4" }}>
              <ImageOff className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Load a CSV to see a preview</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
              <canvas
                ref={canvasRef}
                className="w-full block"
                style={{ aspectRatio: "3 / 4", touchAction: "none", cursor: "grab" }}
                onPointerDown={onCardPointerDown}
                onPointerMove={onCardPointerMove}
                onPointerUp={onCardPointerUp}
                onPointerCancel={onCardPointerUp}
              />
            </div>
          )}
          {rows.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">Drag the tweet to move it. The story follows the same spot.</p>
              <div className="flex gap-3 shrink-0">
                <button type="button" onClick={resetPosition} className="text-[11px] text-muted-foreground underline hover:text-foreground">Reset</button>
                <button type="button" onClick={applyPositionToAll} className="text-[11px] text-muted-foreground underline hover:text-foreground">Use this position for all</button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={shuffleStats} disabled={!rows.length} className="shrink-0">
              <RefreshCcw className="w-4 h-4 mr-1.5" /> Shuffle stats
            </Button>
            <Button variant="outline" onClick={download} disabled={!rows.length} className="flex-1">
              <Download className="w-4 h-4 mr-1.5" /> Download this one
            </Button>
            <Button onClick={saveToLibrary} disabled={saving || !rows.length} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save to library
            </Button>
          </div>
          <div className="rounded-xl border border-border/30 p-3 space-y-2">
            <p className="text-xs font-medium">Whole batch</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadAll} disabled={zipping || !rows.length} className="flex-1">
                {zipping ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download all as ZIP
              </Button>
              <Button onClick={saveAllToLibrary} disabled={savingAll || !rows.length} className="flex-1">
                {savingAll ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save all to library
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Captions</p>
              <p className="text-[11px] text-muted-foreground">{captionsReady} of {rows.length} ready</p>
            </div>
            <Button onClick={generateAllCaptions} disabled={!!captioning || !rows.length || !selectedPreset} className="w-full">
              {captioning ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{captioning}</> : <><Sparkles className="w-4 h-4 mr-1.5" />Generate captions</>}
            </Button>
            <p className="text-[11px] text-muted-foreground">Each caption asks readers to tag or share, worded differently every time, and ends with a question.</p>
            {!selectedPreset && rows.length > 0 && (
              <p className="text-[11px] text-amber-500">Pick a client in step 1 so the captions are written in their name.</p>
            )}
            {rows[selectedIndex] && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">Caption for the tweet you are previewing. Edit it however you like.</p>
                <Textarea
                  value={rows[selectedIndex].caption}
                  onChange={(e) => setCaption(selectedIndex, e.target.value)}
                  placeholder="Press Generate captions, or write your own here."
                  rows={6}
                  className="text-sm"
                />
                <button type="button" onClick={rewriteCaption} disabled={!!captioning || !selectedPreset} className="text-[11px] text-muted-foreground underline hover:text-foreground disabled:opacity-50">
                  Rewrite this one
                </button>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border/30 p-3 space-y-2">
            <p className="text-xs font-medium">Schedule to {clientName ? `${clientName}'s` : "the client's"} page</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SLOT_LABEL) as SlotKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSlot(k)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${slot === k ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"}`}
                >
                  {SLOT_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {slot === "both"
                ? "Two a week, alternating Saturday 9am and Sunday 7pm, starting with whichever comes first."
                : `First tweet goes out on the next ${SLOT_LABEL[slot]}, then one each week at the same time.`}{" "}
              Every tweet also goes out as a story at 7am that day. You confirm the dates on the next screen before anything is booked.
            </p>
            {rows.length > 0 && !allCaptioned && (
              <p className="text-[11px] text-amber-500">Generate the captions above first. Scheduling opens once every tweet has one.</p>
            )}
            <div className="flex gap-2">
              <Button onClick={scheduleBatch} disabled={!!scheduling || !allCaptioned} className="flex-1">
                {scheduling ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{scheduling}</> : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule the batch</>}
              </Button>
              {scheduleItems && !scheduleOpen && (
                <Button variant="outline" onClick={() => setScheduleOpen(true)} className="shrink-0">
                  Reopen ({scheduleItems.length} ready)
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Portrait 1080 x 1440, ready for the grid.</p>
        </div>
      </div>
      {scheduleOpen && scheduleItems && selectedPreset && (
        <ScheduleModal
          presetId={selectedPreset.id}
          presetName={selectedPreset.name}
          postType="single-image"
          posts={scheduleItems}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          initialGapMinutes={10080}
          keepClockTime
          weekendSlots={scheduledSlot === "both"}
          companionStories={scheduleStories}
          sourceTool="tweet-maker"
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setCelebrate({ count: scheduleItems.length, client: selectedPreset.name });
            setScheduleItems(null);
            setScheduleOpen(false);
          }}
          presets={presets.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
      {celebrate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setCelebrate(null)}
        >
          <style>{`
            @keyframes tm-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; } }
            @keyframes tm-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
            @keyframes tm-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
          `}</style>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="pointer-events-none fixed top-0 block"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 1.6,
                background: c.colour,
                borderRadius: 2,
                animation: `tm-fall ${c.dur}s linear ${c.delay}s infinite`,
              }}
            />
          ))}
          <div
            className="relative max-w-md w-full rounded-3xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-amber-400 p-1 shadow-2xl"
            style={{ animation: "tm-pop 0.6s ease-out both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-[22px] bg-background px-8 py-10 text-center space-y-4">
              <div className="text-6xl" style={{ animation: "tm-pulse 1.4s ease-in-out infinite" }}>🎉</div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Done and dusted</p>
              <h2 className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 to-amber-500 bg-clip-text text-transparent">
                {celebrate.count} scheduled!
              </h2>
              <p className="text-base">
                {celebrate.client} is sorted. {celebrate.count} tweet{celebrate.count !== 1 ? "s" : ""} and {celebrate.count} stor{celebrate.count !== 1 ? "ies" : "y"} lined up and waiting.
              </p>
              <p className="text-sm text-muted-foreground">Go and put the kettle on. You earned it.</p>
              <Button onClick={() => setCelebrate(null)} className="w-full">Brilliant, thank you</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
