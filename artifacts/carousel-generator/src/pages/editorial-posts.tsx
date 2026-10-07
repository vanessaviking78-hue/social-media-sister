import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, RefreshCw, ImageIcon,
  RotateCcw, ChevronLeft, ChevronRight, MoveDiagonal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import { readFileAsText, stripSlideCsvTitleRow } from "@/lib/csv-format";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { ScheduleModal } from "@/components/schedule-modal";
import { Canvas as FabricCanvas, Textbox, Image as FabricImage } from "fabric";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;
const SLIDES_PER_POST = 3;
const LIST_MAX = 8;

// Layout editor canvases are displayed at DISPLAY_W and zoomed, but every
// object's left/top/width/fontSize is kept in real 1080×1440 design space —
// setZoom() only affects rendering, not the coordinate values Fabric reports.
const DISPLAY_W = 260;
const DISPLAY_H = Math.round((DISPLAY_W * H) / W);
const ZOOM = DISPLAY_W / W;

// ── CSV columns (positional, 15 total) ───────────────────────────────────────
// Slide1Text1, Slide1Text2, Slide1Text3, Slide2Title, Slide2Text,
// Slide2List1..8, Slide3Text, Slide3CTA
const TEMPLATE_HEADER = [
  "Slide 1 Text 1", "Slide 1 Text 2", "Slide 1 Text 3",
  "Slide 2 Title", "Slide 2 Text",
  "Slide 2 List 1", "Slide 2 List 2", "Slide 2 List 3", "Slide 2 List 4",
  "Slide 2 List 5", "Slide 2 List 6", "Slide 2 List 7", "Slide 2 List 8",
  "Slide 3 Text", "Slide 3 CTA",
];

type EditorialRow = {
  s1t1: string; s1t2: string; s1t3: string;
  s2title: string; s2text: string; s2list: string[];
  s3t1: string; s3cta: string;
};

type Phase = "upload" | "layout" | "preview";
type SlideFonts = { s1: string; s2: string; s3: string };
type SlideKey = "s1" | "s2" | "s3";

// ── Draggable / resizable text box layout ────────────────────────────────────
type BoxLayout = { left: number; top: number; width: number; fontSize: number };
type EditorialLayout = {
  s1: { t1: BoxLayout; t2: BoxLayout; t3: BoxLayout };
  s2: { title: BoxLayout; text: BoxLayout; list: BoxLayout };
  s3: { t1: BoxLayout; cta: BoxLayout };
};
type BoxMeta = { weight: string; style: "normal" | "italic"; align: "left" | "center" };

const SLIDE_BOX_IDS: Record<SlideKey, string[]> = {
  s1: ["t1", "t2", "t3"],
  s2: ["title", "text", "list"],
  s3: ["t1", "cta"],
};

const BOX_META: Record<SlideKey, Record<string, BoxMeta>> = {
  s1: {
    t1: { weight: "400", style: "normal", align: "center" },
    t2: { weight: "700", style: "italic", align: "center" },
    t3: { weight: "400", style: "normal", align: "center" },
  },
  s2: {
    title: { weight: "700", style: "normal", align: "center" },
    text: { weight: "400", style: "normal", align: "center" },
    list: { weight: "400", style: "normal", align: "left" },
  },
  s3: {
    t1: { weight: "400", style: "normal", align: "center" },
    cta: { weight: "700", style: "italic", align: "center" },
  },
};

const DEFAULT_LAYOUT: EditorialLayout = {
  s1: {
    t1: { left: 90, top: 470, width: 900, fontSize: 44 },
    t2: { left: 90, top: 550, width: 900, fontSize: 58 },
    t3: { left: 90, top: 660, width: 900, fontSize: 36 },
  },
  s2: {
    title: { left: 80, top: 170, width: 920, fontSize: 56 },
    text: { left: 80, top: 280, width: 920, fontSize: 40 },
    list: { left: 90, top: 420, width: 860, fontSize: 34 },
  },
  s3: {
    t1: { left: 90, top: 760, width: 900, fontSize: 46 },
    cta: { left: 90, top: 860, width: 900, fontSize: 60 },
  },
};

function cloneLayout(l: EditorialLayout): EditorialLayout {
  return JSON.parse(JSON.stringify(l));
}

function slideNumOf(key: SlideKey): 1 | 2 | 3 {
  return key === "s1" ? 1 : key === "s2" ? 2 : 3;
}

function getBoxText(slideKey: SlideKey, id: string, row: EditorialRow): string {
  if (slideKey === "s1") {
    if (id === "t1") return row.s1t1;
    if (id === "t2") return row.s1t2;
    return row.s1t3;
  }
  if (slideKey === "s2") {
    if (id === "title") return row.s2title;
    if (id === "text") return row.s2text;
    return row.s2list.filter(t => t.trim().length > 0).map(t => `✦ ${t}`).join("\n");
  }
  if (id === "t1") return row.s3t1;
  return row.s3cta;
}

function getFontForSlide(fonts: SlideFonts, slideKey: SlideKey): string {
  return slideKey === "s1" ? fonts.s1 : slideKey === "s2" ? fonts.s2 : fonts.s3;
}

function makeSampleCsv(): string {
  return [
    TEMPLATE_HEADER.join(","),
    [
      "New in clinic", "Skin that glows from within", "",
      "Why this treatment works", "Collagen stimulation starts from the first session.",
      "Boosts hydration", "Smooths fine lines", "Improves tone", "Minimal downtime",
      "Results build over weeks", "Safe for all skin types", "Quick 30 minute session", "",
      "Ready to feel confident in your skin?", "Book your consultation today",
    ].join(","),
    "",
  ].join("\n");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function parseOverlayColor(color: string): string {
  if (color.startsWith("rgba") || color.startsWith("rgb")) return color;
  if (color.startsWith("#")) {
    const h = color.slice(1).padEnd(6, "0");
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},0.5)`;
  }
  return color;
}

function drawCornerDecoration(ctx: CanvasRenderingContext2D, style: string, color: string) {
  if (!style || style === "none") return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const S = 180;
  if (style === "triangle") {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W - S, H); ctx.lineTo(W, H - S); ctx.closePath(); ctx.fill();
  } else if (style === "arc") {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, S, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, H, S, Math.PI, 1.5 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, 0, S, 0.5 * Math.PI, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, H, S, 1.5 * Math.PI, 2 * Math.PI); ctx.stroke();
  } else if (style === "double-line") {
    ctx.lineWidth = 4;
    [0, 12].forEach(off => { ctx.strokeRect(30 + off, 30 + off, W - 2 * (30 + off), H - 2 * (30 + off)); });
  } else if (style === "frame") {
    ctx.lineWidth = 5;
    const L = 120, M = 40;
    ctx.beginPath();
    ctx.moveTo(M, M + L); ctx.lineTo(M, M); ctx.lineTo(M + L, M);
    ctx.moveTo(W - M - L, M); ctx.lineTo(W - M, M); ctx.lineTo(W - M, M + L);
    ctx.moveTo(W - M, H - M - L); ctx.lineTo(W - M, H - M); ctx.lineTo(W - M - L, H - M);
    ctx.moveTo(M + L, H - M); ctx.lineTo(M, H - M); ctx.lineTo(M, H - M - L);
    ctx.stroke();
  }
}

function drawLogo(ctx: CanvasRenderingContext2D, logoImg: HTMLImageElement, position: string, size: number) {
  if (!position || position === "none") return;
  const PAD_L = 44;
  const asp = logoImg.naturalWidth / logoImg.naturalHeight;
  const lw = asp >= 1 ? size : size * asp;
  const lh = asp >= 1 ? size / asp : size;
  let x = 0, y = 0;
  if (position === "top-left")        { x = PAD_L;          y = PAD_L; }
  else if (position === "top-right")  { x = W - lw - PAD_L; y = PAD_L; }
  else if (position === "bottom-left"){ x = PAD_L;          y = H - lh - PAD_L; }
  else                                { x = W - lw - PAD_L; y = H - lh - PAD_L; }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logoImg, x, y, lw, lh);
  ctx.globalAlpha = 1;
}

function drawBg(ctx: CanvasRenderingContext2D, preset: ClientPreset, bgImg: HTMLImageElement | null) {
  ctx.fillStyle = preset.pageColor || "#000000";
  ctx.fillRect(0, 0, W, H);
  if (bgImg) {
    const s = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const dw = bgImg.naturalWidth * s;
    const dh = bgImg.naturalHeight * s;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(bgImg, dx, dy, dw, dh);
  }
  const overlay = parseOverlayColor(preset.overlayColor || "rgba(0,0,0,0.45)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);
}

// Background + corner + logo are identical across all 3 slides — composited once.
function buildBackgroundComposite(
  preset: ClientPreset,
  bgImg: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  scale = 1,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  drawBg(ctx, preset, bgImg);
  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");
  if (logoImg) drawLogo(ctx, logoImg, preset.logoPosition || "top-left", preset.logoSize || 110);
  return canvas.toDataURL("image/png");
}

function drawTextBox(ctx: CanvasRenderingContext2D, text: string, box: BoxLayout, font: string, meta: BoxMeta) {
  if (!text) return;
  ctx.font = `${meta.style} ${meta.weight} ${box.fontSize}px ${font}`;
  ctx.textAlign = meta.align;
  const lines = wrapText(ctx, text, box.width);
  const lineH = Math.round(box.fontSize * 1.25);
  const x = meta.align === "center" ? box.left + box.width / 2 : box.left;
  let y = box.top;
  for (const line of lines) { ctx.fillText(line, x, y); y += lineH; }
}

function drawListBox(ctx: CanvasRenderingContext2D, items: string[], box: BoxLayout, font: string) {
  const validItems = items.filter(t => t.trim().length > 0);
  if (!validItems.length) return;
  ctx.font = `400 ${box.fontSize}px ${font}`;
  ctx.textAlign = "left";
  const lineH = Math.round(box.fontSize * 1.3);
  const bulletIndent = Math.round(box.fontSize * 1.5);
  let y = box.top;
  for (const item of validItems) {
    const lines = wrapText(ctx, item, box.width - bulletIndent);
    ctx.fillText("✦", box.left, y);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], box.left + bulletIndent, y + i * lineH);
    }
    y += lines.length * lineH + Math.round(box.fontSize * 0.35);
  }
}

function renderSlide(
  slideNum: 1 | 2 | 3,
  row: EditorialRow,
  preset: ClientPreset,
  fonts: SlideFonts,
  textColor: string,
  logoImg: HTMLImageElement | null,
  bgImg: HTMLImageElement | null,
  layout: EditorialLayout,
  scale = SCALE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  drawBg(ctx, preset, bgImg);
  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");

  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = textColor;

  if (slideNum === 1) {
    const font = fonts.s1;
    drawTextBox(ctx, row.s1t1, layout.s1.t1, font, BOX_META.s1.t1);
    drawTextBox(ctx, row.s1t2, layout.s1.t2, font, BOX_META.s1.t2);
    drawTextBox(ctx, row.s1t3, layout.s1.t3, font, BOX_META.s1.t3);
  }
  if (slideNum === 2) {
    const font = fonts.s2;
    drawTextBox(ctx, row.s2title, layout.s2.title, font, BOX_META.s2.title);
    drawTextBox(ctx, row.s2text, layout.s2.text, font, BOX_META.s2.text);
    drawListBox(ctx, row.s2list, layout.s2.list, font);
  }
  if (slideNum === 3) {
    const font = fonts.s3;
    drawTextBox(ctx, row.s3t1, layout.s3.t1, font, BOX_META.s3.t1);
    drawTextBox(ctx, row.s3cta, layout.s3.cta, font, BOX_META.s3.cta);
  }

  if (logoImg) drawLogo(ctx, logoImg, preset.logoPosition || "top-left", preset.logoSize || 110);

  return canvas.toDataURL("image/png");
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function compressDataUrl(dataUrl: string, maxPx = 1080, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = await Promise.all(
      dataUrls.slice(i, i + BATCH).map(async (du, j) => ({ name: names[i + j], base64: await compressDataUrl(du) }))
    );
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.status === 413 ? "Images too large — try smaller files" : `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

async function warmFonts(fonts: SlideFonts) {
  const unique = Array.from(new Set([fonts.s1, fonts.s2, fonts.s3]));
  await Promise.allSettled(
    unique.flatMap(f => [
      document.fonts.load(`400 40px ${f}`),
      document.fonts.load(`700 italic 56px ${f}`),
    ])
  );
}

async function loadPresetLogo(preset: ClientPreset): Promise<HTMLImageElement | null> {
  if (!preset.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|avif)$/i;
function naturalFileCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export default function EditorialPosts() {
  const { presets, loading: presetsLoading } = usePresets();
  const [phase, setPhase] = useState<Phase>("upload");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<EditorialRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvDrag, setCsvDrag] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoDrag, setPhotoDrag] = useState(false);
  const [photoImgs, setPhotoImgs] = useState<HTMLImageElement[]>([]);

  const [fonts, setFonts] = useState<SlideFonts>({
    s1: "'Bebas Neue', sans-serif",
    s2: "'Poppins', sans-serif",
    s3: "'Bebas Neue', sans-serif",
  });
  const [textColor, setTextColor] = useState("#ffffff");

  // Draggable / resizable text layout — shared across the whole batch.
  const [layout, setLayout] = useState<EditorialLayout>(() => cloneLayout(DEFAULT_LAYOUT));
  const [previewRowIdx, setPreviewRowIdx] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);

  const [thumbs, setThumbs] = useState<string[][]>([]); // per row: 3 data URLs
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleUrls, setScheduleUrls] = useState<string[][]>([]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const s1CanvasRef = useRef<HTMLCanvasElement>(null);
  const s2CanvasRef = useRef<HTMLCanvasElement>(null);
  const s3CanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRefs = useRef<Record<1 | 2 | 3, FabricCanvas | null>>({ 1: null, 2: null, 3: null });
  const boxRefs = useRef<Record<SlideKey, Record<string, Textbox>>>({ s1: {}, s2: {}, s3: {} });
  const bgObjRefs = useRef<Record<1 | 2 | 3, FabricImage | null>>({ 1: null, 2: null, 3: null });

  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? null;

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    readFileAsText(file).then((raw) => {
      const normalized = stripSlideCsvTitleRow(raw, true);
      Papa.parse<string[]>(normalized, {
        skipEmptyLines: true,
        complete: (result) => {
          const allRows = result.data;
          if (!allRows.length) { setCsvError("CSV is empty"); return; }
          const dataRows = allRows.slice(1); // skip header row
          if (!dataRows.length) { setCsvError("No data rows after the header"); return; }
          const parsed: EditorialRow[] = dataRows
            .map(r => (Array.isArray(r) ? r : [String(r)]).map(c => String(c ?? "").trim()))
            .filter(cols => cols.some(c => c.length > 0))
            .map(cols => ({
              s1t1: cols[0] ?? "", s1t2: cols[1] ?? "", s1t3: cols[2] ?? "",
              s2title: cols[3] ?? "", s2text: cols[4] ?? "",
              s2list: [cols[5], cols[6], cols[7], cols[8], cols[9], cols[10], cols[11], cols[12]].map(c => c ?? ""),
              s3t1: cols[13] ?? "", s3cta: cols[14] ?? "",
            }));
          if (!parsed.length) { setCsvError("No valid rows found"); return; }
          setRows(parsed);
          setCsvFile(file);
          setPreviewRowIdx(0);
        },
        error: (err: Error) => setCsvError(err.message),
      });
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) parseCsv(file);
  };

  const handlePhotos = useCallback((incoming: File[]) => {
    setPhotoUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
    const sorted = [...incoming].sort((a, b) => naturalFileCompare(a.name, b.name));
    setPhotoFiles(sorted);
    setPhotoUrls(sorted.map(f => URL.createObjectURL(f)));
  }, []);

  const loadPhotoImgs = useCallback(async (): Promise<HTMLImageElement[]> => {
    if (!photoUrls.length) return [];
    const results = await Promise.allSettled(photoUrls.map(u => loadImg(u)));
    return results.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
  }, [photoUrls]);

  const renderThumbs = useCallback(async (preset: ClientPreset, rowList: EditorialRow[], photoImgList: HTMLImageElement[]) => {
    setRendering(true);
    try {
      await warmFonts(fonts);
      const logoImg = await loadPresetLogo(preset);
      const out = rowList.map((row, i) => {
        const img = photoImgList[i] ?? photoImgList[photoImgList.length - 1] ?? null;
        return [1, 2, 3].map(n => renderSlide(n as 1 | 2 | 3, row, preset, fonts, textColor, logoImg, img, layout, 1));
      });
      setThumbs(out);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }, [fonts, textColor, layout]);

  // ── Upload → Layout ──────────────────────────────────────────────────────
  const handleContinueToLayout = async () => {
    if (!selectedPreset) { toast.error("Select a client preset first"); return; }
    if (!rows.length) { toast.error("Upload a CSV first"); return; }
    if (!photoFiles.length) { toast.error("Upload your photos first"); return; }
    const imgs = await loadPhotoImgs();
    setPhotoImgs(imgs);
    setPreviewRowIdx(0);
    setPhase("layout");
  };

  // ── Layout phase: init the 3 Fabric canvases once per phase entry ───────
  useEffect(() => {
    if (phase !== "layout") return;
    if (!s1CanvasRef.current || !s2CanvasRef.current || !s3CanvasRef.current) return;

    void warmFonts(fonts);

    const canvases: Record<1 | 2 | 3, FabricCanvas> = {
      1: new FabricCanvas(s1CanvasRef.current, { width: DISPLAY_W, height: DISPLAY_H, selection: false, preserveObjectStacking: true }),
      2: new FabricCanvas(s2CanvasRef.current, { width: DISPLAY_W, height: DISPLAY_H, selection: false, preserveObjectStacking: true }),
      3: new FabricCanvas(s3CanvasRef.current, { width: DISPLAY_W, height: DISPLAY_H, selection: false, preserveObjectStacking: true }),
    };
    (Object.values(canvases) as FabricCanvas[]).forEach(c => c.setZoom(ZOOM));
    fabricRefs.current = canvases;
    boxRefs.current = { s1: {}, s2: {}, s3: {} };

    const row = rows[previewRowIdx] ?? rows[0];
    (["s1", "s2", "s3"] as SlideKey[]).forEach(slideKey => {
      const canvas = canvases[slideNumOf(slideKey)];
      const font = getFontForSlide(fonts, slideKey);
      SLIDE_BOX_IDS[slideKey].forEach(id => {
        const box = (layout[slideKey] as Record<string, BoxLayout>)[id];
        const meta = BOX_META[slideKey][id];
        const text = row ? getBoxText(slideKey, id, row) : "";
        const tb = new Textbox(text || "(no text in this column)", {
          left: box.left, top: box.top, width: box.width, fontSize: box.fontSize,
          fontFamily: font, fill: textColor,
          fontWeight: meta.weight, fontStyle: meta.style, textAlign: meta.align,
          editable: false, hasControls: true, lockRotation: true,
          originX: "left", originY: "top", splitByGrapheme: false,
        });
        tb.setControlVisible("mtr", false);
        (tb as unknown as { __boxId: string }).__boxId = id;
        canvas.add(tb);
        boxRefs.current[slideKey][id] = tb;
      });

      canvas.on("object:modified", (e) => {
        const obj = e.target as Textbox | undefined;
        if (!obj) return;
        const boxId = (obj as unknown as { __boxId?: string }).__boxId;
        if (!boxId) return;
        const newWidth = Math.max(80, Math.round((obj.width ?? 100) * (obj.scaleX ?? 1)));
        const newFontSize = Math.max(12, Math.round((obj.fontSize ?? 30) * (obj.scaleY ?? 1)));
        obj.set({ width: newWidth, fontSize: newFontSize, scaleX: 1, scaleY: 1 });
        obj.setCoords();
        const newLeft = Math.round(obj.left ?? 0);
        const newTop = Math.round(obj.top ?? 0);
        setLayout(prev => ({
          ...prev,
          [slideKey]: {
            ...prev[slideKey],
            [boxId]: { left: newLeft, top: newTop, width: newWidth, fontSize: newFontSize },
          },
        }));
        canvas.requestRenderAll();
      });

      void document.fonts.ready.then(() => canvas.requestRenderAll());
      canvas.renderAll();
    });

    setLayoutReady(true);

    return () => {
      (Object.values(canvases) as FabricCanvas[]).forEach(c => c.dispose());
      fabricRefs.current = { 1: null, 2: null, 3: null };
      boxRefs.current = { s1: {}, s2: {}, s3: {} };
      bgObjRefs.current = { 1: null, 2: null, 3: null };
      setLayoutReady(false);
    };
    // Canvases are (re)built only when the layout phase is (re)entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Layout phase: composite background swaps with preset / previewed photo ──
  useEffect(() => {
    if (phase !== "layout" || !layoutReady || !selectedPreset) return;
    let cancelled = false;
    (async () => {
      const img = photoImgs[previewRowIdx] ?? photoImgs[photoImgs.length - 1] ?? null;
      const logoImg = await loadPresetLogo(selectedPreset);
      if (cancelled) return;
      const bgDataUrl = buildBackgroundComposite(selectedPreset, img, logoImg, 1);
      const elem = await loadImg(bgDataUrl);
      if (cancelled) return;
      ([1, 2, 3] as const).forEach(n => {
        const canvas = fabricRefs.current[n];
        if (!canvas) return;
        const prev = bgObjRefs.current[n];
        if (prev) canvas.remove(prev);
        const bgImg = new FabricImage(elem, {
          left: 0, top: 0, selectable: false, evented: false, originX: "left", originY: "top",
        });
        canvas.add(bgImg);
        canvas.sendObjectToBack(bgImg);
        bgObjRefs.current[n] = bgImg;
        canvas.requestRenderAll();
      });
    })();
    return () => { cancelled = true; };
  }, [phase, layoutReady, selectedPreset, photoImgs, previewRowIdx]);

  // ── Layout phase: text content / font / colour sync (position untouched) ──
  useEffect(() => {
    if (phase !== "layout" || !layoutReady) return;
    const row = rows[previewRowIdx] ?? rows[0];
    if (!row) return;
    (["s1", "s2", "s3"] as SlideKey[]).forEach(slideKey => {
      const canvas = fabricRefs.current[slideNumOf(slideKey)];
      const font = getFontForSlide(fonts, slideKey);
      SLIDE_BOX_IDS[slideKey].forEach(id => {
        const tb = boxRefs.current[slideKey]?.[id];
        if (!tb) return;
        const text = getBoxText(slideKey, id, row);
        tb.set({ text: text || "(no text in this column)", fontFamily: font, fill: textColor });
      });
      canvas?.requestRenderAll();
    });
  }, [phase, layoutReady, rows, previewRowIdx, fonts, textColor]);

  const handleResetLayout = () => {
    setLayout(cloneLayout(DEFAULT_LAYOUT));
    const row = rows[previewRowIdx] ?? rows[0];
    (["s1", "s2", "s3"] as SlideKey[]).forEach(slideKey => {
      const canvas = fabricRefs.current[slideNumOf(slideKey)];
      SLIDE_BOX_IDS[slideKey].forEach(id => {
        const tb = boxRefs.current[slideKey]?.[id];
        const box = (DEFAULT_LAYOUT[slideKey] as Record<string, BoxLayout>)[id];
        if (!tb) return;
        tb.set({ left: box.left, top: box.top, width: box.width, fontSize: box.fontSize, scaleX: 1, scaleY: 1 });
        tb.setCoords();
        if (row) tb.set({ text: getBoxText(slideKey, id, row) || "(no text in this column)" });
      });
      canvas?.requestRenderAll();
    });
    toast.success("Layout reset to default");
  };

  // ── Layout → Generate (renders the whole batch, then shows preview) ─────
  const handleGenerate = async () => {
    if (!selectedPreset) return;
    await renderThumbs(selectedPreset, rows, photoImgs);
    setPhase("preview");
  };

  const handleReRender = async () => {
    if (!selectedPreset) return;
    const imgs = photoImgs.length ? photoImgs : await loadPhotoImgs();
    await renderThumbs(selectedPreset, rows, imgs);
  };

  const handlePresetSwitch = async (id: number) => {
    setSelectedPresetId(id);
    const p = presets.find(x => x.id === id);
    if (p && rows.length && phase === "preview") {
      const imgs = photoImgs.length ? photoImgs : await loadPhotoImgs();
      await renderThumbs(p, rows, imgs);
    }
  };

  const handleDownload = async () => {
    if (!selectedPreset) return;
    setExporting(true);
    try {
      await warmFonts(fonts);
      const [logoImg, imgs] = await Promise.all([loadPresetLogo(selectedPreset), photoImgs.length ? Promise.resolve(photoImgs) : loadPhotoImgs()]);
      const zip = new JSZip();
      rows.forEach((row, ri) => {
        const folder = `post-${String(ri + 1).padStart(2, "0")}`;
        const img = imgs[ri] ?? imgs[imgs.length - 1] ?? null;
        [1, 2, 3].forEach((n) => {
          const png = renderSlide(n as 1 | 2 | 3, row, selectedPreset, fonts, textColor, logoImg, img, layout, SCALE);
          const b64 = png.split(",")[1];
          zip.file(`${folder}/slide-${n}.png`, b64, { base64: true });
        });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `editorial-posts-${Date.now()}.zip`);
      toast.success(`${rows.length} post${rows.length !== 1 ? "s" : ""} downloaded`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedPreset) return;
    setScheduling(true);
    try {
      await warmFonts(fonts);
      const [logoImg, imgs] = await Promise.all([loadPresetLogo(selectedPreset), photoImgs.length ? Promise.resolve(photoImgs) : loadPhotoImgs()]);
      const toastId = toast.loading(`Uploading ${rows.length * SLIDES_PER_POST} image${rows.length !== 1 ? "s" : ""}…`);
      const grouped: string[][] = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const img = imgs[ri] ?? imgs[imgs.length - 1] ?? null;
        const dataUrls = [1, 2, 3].map(n => renderSlide(n as 1 | 2 | 3, rows[ri], selectedPreset, fonts, textColor, logoImg, img, layout, SCALE));
        const names = [1, 2, 3].map(n => `${String(ri + 1).padStart(3, "0")}-slide-${n}.png`);
        const urls = await uploadDataUrls(dataUrls, names);
        grouped.push(urls);
      }
      toast.dismiss(toastId);
      setScheduleUrls(grouped);
      setShowSchedule(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">Editorial Posts</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {phase === "upload" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Editorial Posts</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                Each row in your CSV becomes one 3-slide carousel, using the same photo across all three slides.
                Slide 1 is your opener (3 text lines), Slide 2 is a title, intro text and up to 8 list points, Slide 3 is a closing line and your call to action.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Photos <span className="text-muted-foreground font-normal">(one per row, matched by filename order — e.g. 12 photos for 12 rows)</span>
                </Label>
                <div
                  onDrop={e => {
                    e.preventDefault(); setPhotoDrag(false);
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || IMAGE_EXT_RE.test(f.name));
                    if (files.length) handlePhotos(files);
                  }}
                  onDragOver={e => { e.preventDefault(); setPhotoDrag(true); }}
                  onDragLeave={() => setPhotoDrag(false)}
                  onClick={() => photoInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    photoDrag ? "border-amber-500/60 bg-amber-500/5" :
                    photoFiles.length ? "border-amber-500/40 bg-amber-500/5" :
                                   "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {photoFiles.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-amber-400 shrink-0" />
                      <p className="text-sm font-medium text-amber-400">
                        {photoFiles.length} photo{photoFiles.length !== 1 ? "s" : ""} loaded
                      </p>
                      <div className="w-full max-h-28 overflow-y-auto space-y-0.5 text-left">
                        {photoFiles.map((f, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground truncate px-1">
                            <span className="text-amber-500/70 font-mono mr-1">{String(i + 1).padStart(2, "0")}.</span>
                            {f.name}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Click to replace all</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop photos here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Photo 1 → row 1, photo 2 → row 2, and so on.<br />
                        Fewer photos than rows? The last photo repeats.
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) handlePhotos(files);
                    e.target.value = "";
                  }}
                />
                {photoFiles.length > 0 && rows.length > 0 && photoFiles.length < rows.length && (
                  <p className="text-xs text-amber-500/80">
                    {photoFiles.length} photo{photoFiles.length !== 1 ? "s" : ""} for {rows.length} rows — last photo repeats for the remaining {rows.length - photoFiles.length}.
                  </p>
                )}
                {photoFiles.length > 0 && rows.length > 0 && photoFiles.length === rows.length && (
                  <p className="text-xs text-green-500/80">Perfect — {photoFiles.length} photos matched to {rows.length} rows.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">CSV File</Label>
                <div
                  onDrop={handleCsvDrop}
                  onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                  onDragLeave={() => setCsvDrag(false)}
                  onClick={() => csvInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    csvDrag  ? "border-sky-500/60 bg-sky-500/5" :
                    csvFile  ? "border-sky-500/40 bg-sky-500/5" :
                               "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {csvFile ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-sky-400" />
                      <p className="text-sm font-medium text-sky-400">{csvFile.name}</p>
                      <p className="text-xs text-muted-foreground">{rows.length} row{rows.length !== 1 ? "s" : ""} — click to replace</p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">15 columns — see template</p>
                    </>
                  )}
                </div>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) parseCsv(f);
                    e.target.value = "";
                  }}
                />
                {csvError && <p className="text-xs text-destructive">{csvError}</p>}
                <button
                  onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "editorial-posts-template.csv")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />Download template
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Client Preset</Label>
                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => setSelectedPresetId(Number(v))}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40">
                    <SelectValue placeholder={presetsLoading ? "Loading…" : "Select a client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreset && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <div className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0" style={{ background: selectedPreset.pageColor }} />
                    {selectedPreset.logoUrl && <span className="text-xs text-muted-foreground">logo attached</span>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Background, overlay, corners and logo come from the preset. Fonts and text colour are set below.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Fonts &amp; Colour</Label>
                <div className="space-y-2 bg-muted/20 border border-border/30 rounded-xl p-3">
                  {([
                    ["s1", "Slide 1 font"],
                    ["s2", "Slide 2 font"],
                    ["s3", "Slide 3 font"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="text-xs text-muted-foreground whitespace-nowrap w-24">{label}</label>
                      <select
                        value={fonts[key]}
                        onChange={e => setFonts(f => ({ ...f, [key]: e.target.value }))}
                        className="h-8 flex-1 rounded border border-border/40 bg-background px-2 text-sm"
                      >
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap w-24">Text colour</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={e => setTextColor(e.target.value)}
                      className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleContinueToLayout}
              disabled={!rows.length || !photoFiles.length || !selectedPreset || rendering}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</>
                : "Continue to Layout"}
            </Button>
          </div>
        )}

        {phase === "layout" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-1">Position your text</h2>
                <p className="text-muted-foreground text-sm max-w-xl leading-relaxed flex items-center gap-1.5">
                  <MoveDiagonal className="w-3.5 h-3.5 shrink-0" />
                  Drag a box to move it, drag its corner to resize. This layout applies to all {rows.length} posts in the batch.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPhase("upload")}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />Back
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetLayout}>
                  <RotateCcw className="w-4 h-4 mr-1.5" />Reset Layout
                </Button>
                <Button size="sm" onClick={handleGenerate} disabled={rendering} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {rendering
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Rendering…</>
                    : "Generate Posts"}
                </Button>
              </div>
            </div>

            {rows.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPreviewRowIdx(i => Math.max(0, i - 1))}
                  disabled={previewRowIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-32 text-center">
                  Previewing post {previewRowIdx + 1} of {rows.length}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPreviewRowIdx(i => Math.min(rows.length - 1, i + 1))}
                  disabled={previewRowIdx === rows.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground pl-2">
                  Positions apply to every post — only the preview content changes here.
                </span>
              </div>
            )}

            <div className="flex gap-6 overflow-x-auto pb-2">
              {(["Slide 1", "Slide 2", "Slide 3"] as const).map((label, i) => (
                <div key={label} className="space-y-2 shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <div
                    className="rounded-lg overflow-hidden border border-border/30 bg-black"
                    style={{ width: DISPLAY_W, height: DISPLAY_H }}
                  >
                    <canvas
                      ref={i === 0 ? s1CanvasRef : i === 1 ? s2CanvasRef : s3CanvasRef}
                      width={DISPLAY_W}
                      height={DISPLAY_H}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-1">Preview</h2>
                <p className="text-muted-foreground text-sm">
                  {rows.length} post{rows.length !== 1 ? "s" : ""} · {rows.length * SLIDES_PER_POST} slides · {selectedPreset?.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setPhase("layout")}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />Edit Layout
                </Button>

                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => handlePresetSwitch(Number(v))}
                  disabled={rendering}
                >
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/40 w-44">
                    <SelectValue placeholder="Switch preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="sm" onClick={handleReRender} disabled={rendering || !selectedPreset} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {rendering
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Rendering…</>
                    : <><RefreshCw className="w-4 h-4 mr-1.5" />Re-render</>}
                </Button>

                <Button variant="outline" size="sm" onClick={handleDownload} disabled={exporting || rendering}>
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1.5" />ZIP</>}
                </Button>

                <Button size="sm" onClick={handleSchedule} disabled={scheduling || rendering} className="bg-pink-600 hover:bg-pink-700 text-white">
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                </Button>
              </div>
            </div>

            {rendering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering thumbnails…
              </div>
            )}

            <div className="space-y-8">
              {rows.map((row, ri) => (
                <div key={ri} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Post {ri + 1} of {rows.length}
                    </span>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {[0, 1, 2].map(si => {
                      const thumb = thumbs[ri]?.[si];
                      return (
                        <div key={si} className="relative rounded-lg overflow-hidden border border-border/30 shrink-0" style={{ width: 120 }}>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={`Post ${ri + 1}, slide ${si + 1}`}
                              className="w-full object-cover"
                              style={{ aspectRatio: `${W}/${H}` }}
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full bg-muted/30 flex items-center justify-center" style={{ aspectRatio: `${W}/${H}` }}>
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                            <span className="text-[10px] text-white/70 font-medium">{si + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showSchedule && selectedPreset && (
        <ScheduleModal
          presetId={selectedPreset.id}
          presetName={selectedPreset.name}
          postType="carousel"
          posts={scheduleUrls.map((urls, i) => ({
            title: `Post ${i + 1} of ${scheduleUrls.length} · ${selectedPreset.name}`,
            caption: "",
            imageUrls: urls,
          }))}
          onClose={() => setShowSchedule(false)}
          onSaved={() => setShowSchedule(false)}
          presets={presets.map(p => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
