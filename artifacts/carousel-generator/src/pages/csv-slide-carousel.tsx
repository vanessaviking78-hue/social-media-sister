import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2, CalendarClock,
  CheckCircle2, X, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;

// These 5 columns are REQUIRED. image_filename and logo_filename are optional
// — when absent, the preset logo / no image is used instead.
const REQUIRED_CSV_COLS = [
  "slide1_hook", "slide1_subtitle", "slide2_body", "slide3_body", "slide4_cta",
] as const;

const CSV_COLS = [...REQUIRED_CSV_COLS, "image_filename", "logo_filename"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type CsvRow = {
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
  image_filename?: string;  // optional — falls back to no image
  logo_filename?: string;   // optional — falls back to preset logo
};

type BlockId = "hook" | "subtitle" | "body2" | "body3" | "cta";

type Block = {
  id: BlockId;
  text: string;
  x: number;
  y: number;
};

type CarouselItem = {
  id: string;
  rowNum: number;
  hook: string;
  imageFilename: string | undefined;
  logoFilename: string | undefined;
  blocks: Block[];
  image: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  thumbs: string[];
};

type ScheduleEntry = {
  date: string;
  time: string;
  platforms: ("instagram" | "facebook")[];
  presetId: number | null;
  caption: string;
};

type Phase = "upload" | "preview" | "schedule" | "done";

// ── Inline hero parsing ───────────────────────────────────────────────────────

/** Split "some |Word| text" into alternating normal/hero segments. */
function parseSegments(raw: string): Array<{ text: string; isHero: boolean }> {
  // split on |...|  — capturing group keeps the matched content
  const parts = raw.split(/\|([^|]+)\|/);
  return parts
    .map((p, i) => ({ text: p, isHero: i % 2 === 1 }))
    .filter(s => s.text.length > 0);
}

/** Strip all |pipe| markers for plain UI display. */
function displayText(raw: string) {
  return raw.replace(/\|([^|]*)\|/g, "$1");
}

/** Returns true if the string contains at least one |hero| marker. */
function hasHeroWords(raw: string) {
  return /\|[^|]+\|/.test(raw);
}

// ── Text rendering constants ───────────────────────────────────────────────────

// All normal text: Prata 56px.  Hero |words|: Bebas Neue 110px.
// (36/80 as specified, but scaled up so text is legible at social-media size
//  on the 1080×1440 canvas — 36px would render ~5px in the preview thumbnail.)
const NORMAL_SIZE = 56;
const NORMAL_FONT = "Prata";
const HERO_SIZE   = 110;
const HERO_FONT   = "Bebas Neue";

function normalFontStr() { return `${NORMAL_SIZE}px "${NORMAL_FONT}", serif`; }
function heroFontStr()   { return `${HERO_SIZE}px "${HERO_FONT}", sans-serif`; }

// ── Block config ──────────────────────────────────────────────────────────────

const SLIDE_BLOCK_IDS: Record<number, BlockId[]> = {
  1: ["hook", "subtitle"],
  2: ["body2"],
  3: ["body3"],
  4: ["cta"],
};

/** Max pixel width for text wrap, per block. */
function blockMaxW(id: BlockId): number {
  switch (id) {
    case "hook":     return W - 100;
    case "subtitle": return W - 180;
    case "body2":    return W - 140;
    case "body3":    return W - 140;
    case "cta":      return W - 140;
  }
}

const DEFAULT_POSITIONS: Record<BlockId, { x: number; y: number }> = {
  hook:     { x: 0.5, y: 0.42 },
  subtitle: { x: 0.5, y: 0.62 },
  body2:    { x: 0.5, y: 0.50 },
  body3:    { x: 0.5, y: 0.50 },
  cta:      { x: 0.5, y: 0.50 },
};

function makeBlocks(row: CsvRow): Block[] {
  return [
    { id: "hook",     text: row.slide1_hook,     ...DEFAULT_POSITIONS.hook     },
    { id: "subtitle", text: row.slide1_subtitle,  ...DEFAULT_POSITIONS.subtitle },
    { id: "body2",    text: row.slide2_body,      ...DEFAULT_POSITIONS.body2    },
    { id: "body3",    text: row.slide3_body,      ...DEFAULT_POSITIONS.body3    },
    { id: "cta",      text: row.slide4_cta,       ...DEFAULT_POSITIONS.cta      },
  ];
}

// ── Mixed-font canvas rendering ───────────────────────────────────────────────

/**
 * Renders `raw` onto `ctx` centred at (centerX, centerY) within maxW pixels.
 *
 * Words wrapped in |pipes| → Bebas Neue HERO_SIZE px, uppercased.
 * All other words          → Prata NORMAL_SIZE px.
 *
 * Words are placed left-to-right on each line; lines share a common
 * alphabetic baseline set at the bottom of the tallest word on that line.
 * Space width is always measured using the normal font for consistency.
 */
function renderMixedText(
  ctx: CanvasRenderingContext2D,
  raw: string,
  centerX: number,
  centerY: number,
  maxW: number,
  textColor: string,
) {
  if (!raw.trim()) return;
  const segs = parseSegments(raw);
  console.log("[renderMixedText] raw:", JSON.stringify(raw));
  console.log("[renderMixedText] segments:", segs.map(s => `${s.isHero ? "HERO" : "norm"}:"${s.text}"`).join(" | "));

  // ── 1. Measure space in normal font (used for all inter-word gaps) ─────────
  ctx.font = normalFontStr();
  const SPACE = ctx.measureText(" ").width;

  // ── 2. Build measured word list ────────────────────────────────────────────
  type MWord = { str: string; w: number; h: number; fnt: string };
  const mwords: MWord[] = [];

  for (const seg of segs) {
    const isHero = seg.isHero;
    const fnt = isHero ? heroFontStr() : normalFontStr();
    const h   = isHero ? HERO_SIZE : NORMAL_SIZE;
    ctx.font  = fnt;
    for (const word of seg.text.split(/\s+/).filter(Boolean)) {
      const str = isHero ? word.toUpperCase() : word;
      mwords.push({ str, w: ctx.measureText(str).width, h, fnt });
    }
  }

  if (!mwords.length) return;

  // ── 3. Wrap into lines ─────────────────────────────────────────────────────
  type Line = { words: MWord[]; lineW: number; lineH: number };
  const lines: Line[] = [];
  let cur: Line = { words: [], lineW: 0, lineH: 0 };

  for (const mw of mwords) {
    const needed = cur.words.length === 0 ? mw.w : cur.lineW + SPACE + mw.w;
    if (needed > maxW && cur.words.length > 0) {
      lines.push(cur);
      cur = { words: [mw], lineW: mw.w, lineH: mw.h };
    } else {
      if (cur.words.length > 0) cur.lineW += SPACE;
      cur.words.push(mw);
      cur.lineW += mw.w;
      cur.lineH = Math.max(cur.lineH, mw.h);
    }
  }
  if (cur.words.length) lines.push(cur);

  // ── 4. Compute total block height ──────────────────────────────────────────
  const LINE_GAP = 10;
  const totalH = lines.reduce((s, l) => s + l.lineH, 0) + (lines.length - 1) * LINE_GAP;

  // ── 5. Draw ────────────────────────────────────────────────────────────────
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let topY = centerY - totalH / 2;

  for (const line of lines) {
    const baseline = topY + line.lineH;   // alphabetic baseline at bottom of line height
    let x = centerX - line.lineW / 2;

    for (let i = 0; i < line.words.length; i++) {
      const mw = line.words[i];
      ctx.font = mw.fnt;
      ctx.fillText(mw.str, x, baseline);
      if (i < line.words.length - 1) x += mw.w + SPACE;
    }

    topY += line.lineH + LINE_GAP;
  }

  // Restore
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex.startsWith("#") ? hex.slice(1) : hex).padEnd(6, "0");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, alpha: number) {
  const s = Math.max(W / img.width, H / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  ctx.globalAlpha = 1;
}

// ── Slide renderer ────────────────────────────────────────────────────────────

function renderSlide(
  slideNum: 1 | 2 | 3 | 4,
  blocks: Block[],
  image: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  preset: ClientPreset,
  scale = SCALE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const pageColor    = preset.pageColor    || "#1a1a2e";
  const overlayColor = preset.overlayColor || "rgba(0,0,0,0.55)";
  const textColor    = preset.textColor    || "#ffffff";

  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  if (image) {
    if (slideNum === 1) {
      drawCover(ctx, image, 0.55);
      // Always use a dark overlay on slide 1 so white text stays readable
      // regardless of the preset's pageColor (which could be light/white).
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
    } else {
      drawCover(ctx, image, 1.0);
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, W, H);
    }
  }

  if (slideNum === 1) {
    const s1 = blocks.filter(b => (["hook", "subtitle"] as string[]).includes(b.id));
    console.log("[Slide1] blocks →", s1.map(b => ({ id: b.id, len: b.text?.length, preview: b.text?.slice(0, 60) })));
    console.log("[Slide1] textColor:", textColor, "hasImage:", !!image);
  }

  ctx.shadowColor   = "rgba(0,0,0,0.75)";
  ctx.shadowBlur    = 18;
  ctx.shadowOffsetY = 3;

  const activeIds = SLIDE_BLOCK_IDS[slideNum];
  for (const block of blocks.filter(b => activeIds.includes(b.id))) {
    if (!block.text.trim()) continue;
    renderMixedText(
      ctx,
      block.text,
      block.x * W,
      block.y * H,
      blockMaxW(block.id),
      textColor,
    );
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;

  if (logoImg) {
    const MAX = 110, PAD = 44;
    const asp = logoImg.width / logoImg.height;
    const lw = asp >= 1 ? MAX : MAX * asp;
    const lh = asp >= 1 ? MAX / asp : MAX;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logoImg, W - lw - PAD, H - lh - PAD, lw, lh);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL("image/png");
}

function renderAllThumbs(
  item: Pick<CarouselItem, "blocks" | "image" | "logo">,
  preset: ClientPreset,
): string[] {
  return ([1, 2, 3, 4] as const).map(n => renderSlide(n, item.blocks, item.image, item.logo, preset));
}

// ── Font loading ──────────────────────────────────────────────────────────────

async function ensureFonts(presetFont?: string) {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(`400 100px "${NORMAL_FONT}"`).catch(() => {}),
    document.fonts.load(`italic 400 100px "${NORMAL_FONT}"`).catch(() => {}),
    document.fonts.load(`400 100px "${HERO_FONT}"`).catch(() => {}),
    ...(presetFont ? [
      document.fonts.load(`400 100px ${presetFont}`).catch(() => {}),
      document.fonts.load(`700 100px ${presetFont}`).catch(() => {}),
    ] : []),
  ]);
}

// ── Demo canvas ───────────────────────────────────────────────────────────────

const DEMO_TEXT = "If you've been chasing |Hydration| through every serum";
const DEMO_W = 600;
const DEMO_H = 360;
const DEMO_SCALE = 2;

function drawDemo(canvas: HTMLCanvasElement) {
  canvas.width  = DEMO_W * DEMO_SCALE;
  canvas.height = DEMO_H * DEMO_SCALE;
  canvas.style.width  = `${DEMO_W}px`;
  canvas.style.height = `${DEMO_H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DEMO_SCALE, DEMO_SCALE);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, DEMO_W, DEMO_H);
  renderMixedText(ctx, DEMO_TEXT, DEMO_W / 2, DEMO_H / 2, DEMO_W - 40, "#f8fafc");
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function normName(name: string) { return name.trim().toLowerCase(); }

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((du, j) => ({ name: names[i + j], base64: du }));
    const res  = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

function makeSampleCsv(): string {
  // 5-column format — image_filename and logo_filename are optional extras
  // Use |word| syntax for hero (Bebas Neue) words in any column
  const headers = REQUIRED_CSV_COLS.join(",");
  const rows = [
    `"If you've been chasing |Hydration| through every serum","Most people are missing this one thing","Your skin barrier does more than you think.","Here's what to look for on the label.","Book a |skin| consultation today"`,
    `"|Collagen| starts declining at 25","The science is simpler than you think","Small |changes| add up fast.","Let's break it down slide by slide.","Start your skin plan |now|"`,
  ];
  return [headers, ...rows, ""].join("\n");
}

// ── Drop zone component ───────────────────────────────────────────────────────

function DropZone({
  label, fileCount, active, color,
  onDragOver, onDragLeave, onDrop, onClick,
}: {
  label: string; fileCount: number; active: boolean; color: string;
  onDragOver: () => void; onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void; onClick: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2.5 cursor-pointer transition-colors ${
        active ? "border-primary/60 bg-primary/5" :
        fileCount ? `border-${color}-500/40 bg-${color}-500/5` :
        "border-border/40 hover:border-border/70"
      }`}
    >
      {fileCount ? (
        <>
          <CheckCircle2 className={`w-7 h-7 text-${color}-400`} />
          <p className={`text-sm font-medium text-${color}-400`}>{fileCount} file{fileCount !== 1 ? "s" : ""} ready</p>
          <p className="text-xs text-muted-foreground">Click or drop to add more</p>
        </>
      ) : (
        <>
          <Upload className="w-7 h-7 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CsvSlideCarousel() {
  const [phase, setPhase] = useState<Phase>("upload");

  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [logoFiles,  setLogoFiles]  = useState<Map<string, File>>(new Map());
  const [csvDrag,   setCsvDrag]    = useState(false);
  const [imgDrag,   setImgDrag]    = useState(false);
  const [logoDrag,  setLogoDrag]   = useState(false);

  const [items,          setItems]          = useState<CarouselItem[]>([]);
  const [rendering,      setRendering]      = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduling,      setScheduling]      = useState(false);

  const csvInputRef  = useRef<HTMLInputElement>(null);
  const imgInputRef  = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const demoCanvasRef = useRef<HTMLCanvasElement>(null);

  const { presets } = usePresets();
  const selectedPreset = useMemo(
    () => presets.find(p => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  // ── Demo canvas — loads fonts then draws proof-of-concept render ─────────────

  useEffect(() => {
    ensureFonts().then(() => {
      if (demoCanvasRef.current) drawDemo(demoCanvasRef.current);
    });
  }, []);

  // ── CSV ───────────────────────────────────────────────────────────────────────

  const parseCsv = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: ",",          // force comma — prevents | being auto-detected as separator
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (result) => {
        if (!result.data.length) { setCsvError("CSV is empty."); return; }

        console.log("[CSV] detected delimiter:", result.meta.delimiter);
        console.log("[CSV] first raw row:", JSON.stringify(result.data[0]));

        // Only the 5 content columns are required; image/logo are optional
        const missing = REQUIRED_CSV_COLS.filter(k => !(k in result.data[0]));
        if (missing.length) {
          setCsvError(`Missing columns: ${missing.join(", ")}. Make sure the first row is a header row matching the template.`);
          return;
        }

        // Defensive: drop any row that looks like a header row leaked into data.
        // This catches BOM issues or PapaParse edge cases.
        const rows = (result.data as unknown as CsvRow[]).filter(row => {
          const hook = row.slide1_hook?.trim() ?? "";
          // If the hook field literally equals one of our column names, it's a header row
          return hook.length > 0 && !(REQUIRED_CSV_COLS as readonly string[]).includes(hook);
        });

        if (!rows.length) { setCsvError("No data rows found after the header."); return; }
        console.log(`[CSV] parsed ${rows.length} data rows. Row 1 hook: ${JSON.stringify(rows[0].slide1_hook)}`);
        setCsvError(null);
        setCsvRows(rows);
      },
      error: (e: Error) => setCsvError(e.message),
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault(); setCsvDrag(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith(".csv"));
    if (file) parseCsv(file); else toast.error("Drop a CSV file.");
  };

  // ── File maps ─────────────────────────────────────────────────────────────────

  const addFiles = (setter: React.Dispatch<React.SetStateAction<Map<string, File>>>, files: File[]) => {
    setter(prev => {
      const next = new Map(prev);
      for (const f of files.filter(f => f.type.startsWith("image/"))) next.set(normName(f.name), f);
      return next;
    });
  };

  const handleImgDrop  = (e: React.DragEvent) => { e.preventDefault(); setImgDrag(false);  addFiles(setImageFiles, Array.from(e.dataTransfer.files)); };
  const handleLogoDrop = (e: React.DragEvent) => { e.preventDefault(); setLogoDrag(false); addFiles(setLogoFiles,  Array.from(e.dataTransfer.files)); };

  // ── Generate ──────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!csvRows.length || !selectedPreset) return;
    setRendering(true);
    setRenderProgress(0);
    try {
      await ensureFonts(selectedPreset.fontFamily);
      const rendered: CarouselItem[] = [];

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];

        let image: HTMLImageElement | null = null;
        // image_filename is optional — if the column is absent we skip per-row images
        const imgFile = row.image_filename ? imageFiles.get(normName(row.image_filename)) : undefined;
        if (imgFile) { try { image = await loadImg(URL.createObjectURL(imgFile)); } catch {} }

        // Fall back to first uploaded image if no per-row image_filename column
        if (!image && imageFiles.size > 0 && !row.image_filename) {
          const firstImgFile = imageFiles.values().next().value;
          if (firstImgFile) { try { image = await loadImg(URL.createObjectURL(firstImgFile)); } catch {} }
        }

        let logo: HTMLImageElement | null = null;
        const logoFile = row.logo_filename ? logoFiles.get(normName(row.logo_filename)) : undefined;
        if (logoFile)                    { try { logo = await loadImg(URL.createObjectURL(logoFile)); } catch {} }
        else if (selectedPreset.logoUrl) { try { logo = await loadImg(selectedPreset.logoUrl);        } catch {} }

        const blocks = makeBlocks(row);
        const thumbs = renderAllThumbs({ blocks, image, logo }, selectedPreset);

        rendered.push({
          id: `item-${i}`,
          rowNum: i + 1,
          hook: row.slide1_hook,
          imageFilename: row.image_filename,
          logoFilename:  row.logo_filename,
          blocks,
          image,
          logo,
          thumbs,
        });
        setRenderProgress(Math.round(((i + 1) / csvRows.length) * 100));
      }

      setItems(rendered);
      setPhase("preview");
    } catch (e: unknown) {
      toast.error("Render failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRendering(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────────

  const downloadSingle = async (item: CarouselItem) => {
    const zip = new JSZip();
    item.thumbs.forEach((du, i) => zip.file(`slide${i + 1}.png`, du.split(",")[1], { base64: true }));
    const blob  = await zip.generateAsync({ type: "blob" });
    const label = displayText(item.hook).slice(0, 30).replace(/[^a-z0-9]/gi, "-") || `carousel-${item.rowNum}`;
    saveAs(blob, `${label}.zip`);
  };

  const downloadAll = async () => {
    const tid = toast.loading("Building ZIP...");
    try {
      const zip = new JSZip();
      items.forEach((item, i) => {
        const folder = zip.folder(`carousel-${i + 1}`) ?? zip;
        item.thumbs.forEach((du, j) => folder.file(`slide${j + 1}.png`, du.split(",")[1], { base64: true }));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "carousels.zip");
      toast.success("Download started.", { id: tid });
    } catch (e: unknown) { toast.error(String(e), { id: tid }); }
  };

  // ── Schedule ──────────────────────────────────────────────────────────────────

  const goToSchedule = () => {
    const today = new Date().toISOString().slice(0, 10);
    setScheduleEntries(items.map(() => ({
      date: today, time: "09:00", platforms: ["instagram"], presetId: selectedPresetId, caption: "",
    })));
    setPhase("schedule");
  };

  const updateEntry = <K extends keyof ScheduleEntry>(i: number, k: K, v: ScheduleEntry[K]) =>
    setScheduleEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const togglePlatform = (i: number, p: "instagram" | "facebook") =>
    setScheduleEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      const has = e.platforms.includes(p);
      if (has && e.platforms.length === 1) return e;
      return { ...e, platforms: has ? e.platforms.filter(x => x !== p) : [...e.platforms, p] };
    }));

  // ── Post directly to Instagram / Facebook ────────────────────────────────────

  const handlePostToMeta = async (platforms: ("instagram" | "facebook")[]) => {
    if (!selectedPresetId) { toast.error("Select a client preset before posting."); return; }
    const label = platforms.includes("instagram") && platforms.includes("facebook")
      ? "Instagram & Facebook"
      : platforms.includes("instagram") ? "Instagram" : "Facebook";
    const tid = toast.loading(`Uploading images for ${label}...`);
    try {
      const posts: { title: string; caption: string; imageUrls: string[] }[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        toast.loading(`Uploading carousel ${i + 1} / ${items.length}...`, { id: tid });
        const names = item.thumbs.map((_, j) => `carousel-${item.rowNum}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(item.thumbs, names);
        posts.push({
          title: displayText(item.hook).slice(0, 80) || `Carousel ${item.rowNum}`,
          caption: "",
          imageUrls,
        });
      }
      toast.loading(`Posting to ${label}...`, { id: tid });
      const res = await fetch(`${BASE}/api/meta/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts, presetId: selectedPresetId, postType: "carousel", platforms }),
      });
      const data = await res.json() as { summary?: { succeeded: number; failed: number }; error?: string };
      if (!res.ok) throw new Error(data.error || "Meta push failed");
      const succeeded = data.summary?.succeeded ?? 0;
      const failed    = data.summary?.failed ?? 0;
      toast.success(
        `Posted to ${label}: ${succeeded} succeeded${failed ? `, ${failed} failed` : ""}.`,
        { id: tid, duration: 6000 },
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e), { id: tid });
    }
  };

  const handleScheduleAll = async () => {
    const bad = scheduleEntries.findIndex(e => !e.presetId);
    if (bad !== -1) { toast.error(`Row ${bad + 1}: select a client account.`); return; }
    setScheduling(true);
    const tid = toast.loading("Uploading and queueing...");
    try {
      for (let i = 0; i < items.length; i++) {
        const item  = items[i];
        const entry = scheduleEntries[i];
        toast.loading(`Scheduling ${i + 1} / ${items.length}...`, { id: tid });
        const names     = item.thumbs.map((_, j) => `carousel-${i + 1}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(item.thumbs, names);
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: entry.presetId,
            postType: "carousel",
            content: {
              imageUrls, caption: entry.caption || "",
              title: displayText(item.hook).slice(0, 80) || `Carousel ${item.rowNum}`,
              platforms: entry.platforms,
            },
            scheduledAt: new Date(`${entry.date}T${entry.time}`).toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(`Row ${i + 1}: ${err.error}`);
        }
      }
      toast.success(`${items.length} carousels queued.`, { id: tid });
      setPhase("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e), { id: tid });
    } finally { setScheduling(false); }
  };

  const resetAll = () => {
    setCsvRows([]); setCsvError(null);
    setImageFiles(new Map()); setLogoFiles(new Map());
    setItems([]); setSelectedPresetId(null);
    setPhase("upload");
  };

  // ── Done ──────────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
        <CheckCircle2 className="w-14 h-14 text-emerald-400" />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">All queued</h2>
          <p className="text-muted-foreground">{items.length} carousel{items.length !== 1 ? "s" : ""} added to the scheduler.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild><Link href="/scheduler">View queue</Link></Button>
          <Button onClick={resetAll}>Start again</Button>
        </div>
      </div>
    );
  }

  // ── Schedule phase ─────────────────────────────────────────────────────────────

  if (phase === "schedule") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button onClick={() => setPhase("preview")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Schedule Carousels</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} posts</span>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-muted-foreground mb-6">Set a date, time and platform for each carousel.</p>
          <div className="space-y-3">
            {items.map((item, i) => {
              const entry = scheduleEntries[i];
              if (!entry) return null;
              return (
                <div key={item.id} className="border border-border/40 rounded-xl p-4 bg-card/40">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">Row {item.rowNum}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{displayText(item.hook)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {item.thumbs.map((du, si) => (
                          <img key={si} src={du} alt="" className="w-10 rounded" style={{ aspectRatio: "4/5", objectFit: "cover" }} />
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Client</Label>
                        <Select value={entry.presetId?.toString() ?? ""} onValueChange={v => updateEntry(i, "presetId", v ? parseInt(v) : null)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick client" /></SelectTrigger>
                          <SelectContent>{presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input type="date" value={entry.date} onChange={e => updateEntry(i, "date", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input type="time" value={entry.time} onChange={e => updateEntry(i, "time", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Platforms</Label>
                        <div className="flex gap-1.5 h-8">
                          {(["instagram", "facebook"] as const).map(p => (
                            <button key={p} onClick={() => togglePlatform(i, p)}
                              className={`flex-1 rounded text-xs font-medium border transition-colors ${entry.platforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border/40 hover:border-border"}`}>
                              {p === "instagram" ? "IG" : "FB"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
                      <Input placeholder="Leave blank to fill in later..." value={entry.caption}
                        onChange={e => updateEntry(i, "caption", e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPhase("preview")} disabled={scheduling}>Back</Button>
            <Button onClick={handleScheduleAll} disabled={scheduling} className="min-w-40">
              {scheduling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</> : `Schedule All (${items.length})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview phase ──────────────────────────────────────────────────────────────

  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button onClick={() => setPhase("upload")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Preview</h1>
          <span className="text-muted-foreground text-sm ml-1">{items.length} carousel{items.length !== 1 ? "s" : ""}</span>
          <div className="ml-auto flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <Download className="w-4 h-4 mr-2" />Download All
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePostToMeta(["instagram"])}>
              <Send className="w-4 h-4 mr-2" />Post to Instagram
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePostToMeta(["facebook"])}>
              <Send className="w-4 h-4 mr-2" />Post to Facebook
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePostToMeta(["instagram", "facebook"])}>
              <Send className="w-4 h-4 mr-2" />Post to Both
            </Button>
            <Button size="sm" onClick={goToSchedule}>
              <CalendarClock className="w-4 h-4 mr-2" />Schedule
            </Button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map(item => (
            <div key={item.id} className="border border-border/40 rounded-xl overflow-hidden bg-card/40">
              <div className="flex gap-1 p-3 bg-black/20">
                {item.thumbs.map((du, si) => (
                  <img key={si} src={du} alt={`slide ${si + 1}`} className="flex-1 rounded object-cover" style={{ aspectRatio: "4/5" }} />
                ))}
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-muted-foreground">Row {item.rowNum}</p>
                  <p className="text-xs truncate mt-0.5">{displayText(item.hook)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadSingle(item)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />ZIP
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Upload phase ───────────────────────────────────────────────────────────────

  const canGenerate = csvRows.length > 0 && selectedPresetId !== null;

  const rowStats = csvRows.map(row => ({
    ...row,
    hookDisplay: displayText(row.slide1_hook),
    hasHero:  hasHeroWords(row.slide1_hook) || hasHeroWords(row.slide1_subtitle)
           || hasHeroWords(row.slide2_body)  || hasHeroWords(row.slide3_body) || hasHeroWords(row.slide4_cta),
    hasImage: row.image_filename ? imageFiles.has(normName(row.image_filename)) : imageFiles.size > 0,
    hasLogo:  row.logo_filename  ? logoFiles.has(normName(row.logo_filename))   : logoFiles.size > 0,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">CSV Slide Carousel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">One CSV row per carousel. Images and logos matched by filename.</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Step 1 */}
        <section className="space-y-3">
          <h2 className="font-semibold text-base">1. Choose a client</h2>
          <p className="text-sm text-muted-foreground">Brand colours and fallback logo come from the preset. Per-row logos override it.</p>
          <Select value={selectedPresetId?.toString() ?? ""} onValueChange={v => setSelectedPresetId(v ? parseInt(v) : null)}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select a client preset..." /></SelectTrigger>
            <SelectContent>{presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {selectedPreset && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 max-w-sm">
              {selectedPreset.logoUrl && <img src={selectedPreset.logoUrl} alt="logo" className="h-8 w-8 object-contain rounded" />}
              <div className="flex gap-2 items-center">
                <div className="w-5 h-5 rounded" style={{ background: selectedPreset.pageColor || "#1a1a2e" }} />
                <div className="w-5 h-5 rounded border border-border/20" style={{ background: selectedPreset.textColor || "#fff" }} />
                <span className="text-xs text-muted-foreground ml-1">{selectedPreset.name}</span>
              </div>
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">2. Upload your CSV</h2>
            <button
              onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "csv-carousel-template.csv")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Download template
            </button>
          </div>

          {/* Pipe syntax explanation + live demo */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <p className="text-sm">
              Columns: <span className="font-mono text-xs bg-muted/60 px-1 rounded">{CSV_COLS.join(", ")}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Wrap any word in <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">|pipes|</code> to render it in{" "}
              <strong className="text-foreground">Bebas Neue 80px</strong>. Surrounding words render in{" "}
              <strong className="text-foreground">Prata 36px</strong>. Works in any column.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Live preview — fonts load in a moment:</p>
              <canvas
                ref={demoCanvasRef}
                className="rounded-lg w-full max-w-[600px] block"
                style={{ imageRendering: "auto" }}
              />
              <p className="text-xs text-muted-foreground/60 font-mono">
                If you've been chasing |Hydration| through every serum
              </p>
            </div>
          </div>

          <div
            onDrop={handleCsvDrop}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
            onDragLeave={() => setCsvDrag(false)}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-4 transition-colors ${
              csvDrag   ? "border-primary/60 bg-primary/5" :
              csvRows.length ? "border-emerald-500/40 bg-emerald-500/5" :
              "border-border/40"
            }`}
          >
            {csvRows.length ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{csvRows.length} row{csvRows.length !== 1 ? "s" : ""} loaded</p>
                <label htmlFor="csv-file-input" className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                  Replace file
                </label>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Drop a CSV here, or</p>
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Choose CSV file
                </label>
              </>
            )}
          </div>
          <input id="csv-file-input" ref={csvInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { if (e.target.files?.[0]) parseCsv(e.target.files[0]); e.target.value = ""; }} />
          {csvError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{csvError}</p>}
        </section>

        {/* Step 3 */}
        <section className="space-y-4">
          <h2 className="font-semibold text-base">3. Upload images &amp; logos</h2>
          <p className="text-sm text-muted-foreground">
            Files are matched by filename to <code className="bg-muted/40 px-1 rounded text-xs">image_filename</code> and{" "}
            <code className="bg-muted/40 px-1 rounded text-xs">logo_filename</code>. Case-insensitive.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Carousel images</Label>
              <DropZone
                label="Drop images" fileCount={imageFiles.size} active={imgDrag} color="violet"
                onDragOver={() => setImgDrag(true)} onDragLeave={() => setImgDrag(false)}
                onDrop={handleImgDrop} onClick={() => imgInputRef.current?.click()}
              />
              <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) addFiles(setImageFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              {imageFiles.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[...imageFiles.values()].map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1">
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setImageFiles(prev => { const n = new Map(prev); n.delete(normName(f.name)); return n; })} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Logo files</Label>
              <DropZone
                label="Drop logos" fileCount={logoFiles.size} active={logoDrag} color="indigo"
                onDragOver={() => setLogoDrag(true)} onDragLeave={() => setLogoDrag(false)}
                onDrop={handleLogoDrop} onClick={() => logoInputRef.current?.click()}
              />
              <input ref={logoInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) addFiles(setLogoFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              {logoFiles.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[...logoFiles.values()].map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1">
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setLogoFiles(prev => { const n = new Map(prev); n.delete(normName(f.name)); return n; })} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 4: Review */}
        {csvRows.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-base">4. Review rows</h2>
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 font-medium">Hook</th>
                      <th className="text-left px-3 py-2 font-medium">Subtitle</th>
                      <th className="text-left px-3 py-2 font-medium">CTA</th>
                      <th className="text-center px-3 py-2 font-medium">Image</th>
                      <th className="text-center px-3 py-2 font-medium">Logo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {rowStats.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 max-w-[160px]">
                          <span className="font-medium truncate block" title={row.slide1_hook}>{row.hookDisplay}</span>
                          {row.hasHero && <span className="text-[10px] text-amber-400/80 mt-0.5 block">has inline hero words</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{displayText(row.slide1_subtitle)}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{displayText(row.slide4_cta)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {row.hasImage ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-amber-400/60" />}
                            <span className="text-muted-foreground/60 text-[10px] truncate max-w-16">{row.image_filename}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {row.hasLogo ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-amber-400/60 text-[10px]">preset</span>}
                            <span className="text-muted-foreground/60 text-[10px] truncate max-w-16">{row.logo_filename}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {rowStats.some(r => !r.hasImage) && <p className="text-xs text-amber-400">Rows without a matched image render with a solid brand colour background.</p>}
            {rowStats.some(r => !r.hasLogo)  && <p className="text-xs text-muted-foreground">Rows without a matched logo fall back to the preset logo.</p>}
          </section>
        )}

        {/* Generate */}
        {canGenerate && (
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={rendering} size="lg" className="min-w-52">
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering... {renderProgress}%</>
                : `Generate ${csvRows.length} carousel${csvRows.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
        {!canGenerate && csvRows.length > 0 && !selectedPresetId && (
          <p className="text-sm text-amber-400 text-right">Select a client preset to continue.</p>
        )}
      </div>
    </div>
  );
}
