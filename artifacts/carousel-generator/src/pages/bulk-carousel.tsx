import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, FileText, Download, Loader2, CalendarClock,
  CheckCircle2, X, Edit2, GripVertical, Sparkles, Send, Music, Trash2,
} from "lucide-react";
import { SendForApprovalModal } from "@/components/send-for-approval-modal";
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
import { MusicPickerModal, type MusicTrack } from "@/components/music-picker-modal";
import ApprovedImagesPicker from "@/components/approved-images-picker";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;
const EDITOR_W = 360;
const EDITOR_SCALE = EDITOR_W / W;

const CSV_COLS = ["slide1_hook", "slide1_subtitle", "slide2_body", "slide3_body", "slide4_cta"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type CsvRow = {
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
};

type BlockId = "hook" | "subtitle" | "body2" | "body3" | "cta" | "logo" | "line";

type Block = {
  id: BlockId;
  text: string;
  x: number;       // 0-1 horizontal centre fraction
  y: number;       // 0-1 vertical centre fraction
  w?: number;      // width as fraction of W (defaults to BLOCK_STYLE[id].maxW / W)
  fontSize?: number; // canvas-pixel font size override (defaults to BLOCK_STYLE[id].size)
  thickness?: number; // line thickness in canvas px (line block only)
};

type CarouselItem = {
  id: string;
  rowNum: number;
  hook: string;
  blocks: Block[];
  coverImg: HTMLImageElement | null;
  bodyImg: HTMLImageElement | null;
  thumbs: string[]; // 4 data URLs
};

type ScheduleEntry = {
  date: string;
  time: string;
  platforms: ("instagram" | "facebook")[];
  presetId: number | null;
  caption: string;
};

type Phase = "upload" | "preview" | "schedule" | "done";

// ── Block config ──────────────────────────────────────────────────────────────

const SLIDE_BLOCK_IDS: Record<number, BlockId[]> = {
  1: ["hook", "subtitle"],
  2: ["body2"],
  3: ["body3"],
  4: ["cta"],
};

type BlockStyle = { font: string; size: number; lineH: number; maxW: number; label: string };

const BLOCK_STYLE: Record<BlockId, BlockStyle> = {
  hook:     { font: '"Bebas Neue"',  size: 108, lineH: 1.10, maxW: W - 120, label: "Hook"     },
  subtitle: { font: '"Poppins"',     size:  44, lineH: 1.40, maxW: W - 180, label: "Subtitle" },
  body2:    { font: '"Poppins"',     size:  50, lineH: 1.50, maxW: W - 160, label: "Body"     },
  body3:    { font: '"Poppins"',     size:  50, lineH: 1.50, maxW: W - 160, label: "Body"     },
  cta:      { font: '"Poppins"',     size:  76, lineH: 1.35, maxW: W - 140, label: "CTA"      },
  logo:     { font: '"Poppins"',     size:  44, lineH: 1.00, maxW: W,       label: "Logo"     },
  line:     { font: '"Poppins"',     size:  44, lineH: 1.00, maxW: W,       label: "Line"     },
};

const defaultBlock = (id: BlockId, text = ""): Block => {
  const pos: Record<BlockId, { x: number; y: number }> = {
    hook:     { x: 0.5,  y: 0.695 },
    subtitle: { x: 0.5,  y: 0.785 },
    body2:    { x: 0.5,  y: 0.80  },
    body3:    { x: 0.5,  y: 0.80  },
    cta:      { x: 0.5,  y: 0.88  },
    logo:     { x: 0.09, y: 0.07  },
    line:     { x: 0.5,  y: 0.90  },
  };
  const extra: Partial<Block> =
    id === "logo" ? { w: 0.10 } :
    id === "line" ? { w: 0.40, thickness: 3 } : {};
  return { id, text, ...pos[id], ...extra };
};

function makeBlocks(row: CsvRow): Block[] {
  return [
    defaultBlock("hook",     row.slide1_hook),
    defaultBlock("subtitle", row.slide1_subtitle),
    defaultBlock("body2",    row.slide2_body),
    defaultBlock("body3",    row.slide3_body),
    defaultBlock("cta",      row.slide4_cta),
    defaultBlock("logo"),
    
  ];
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex.startsWith("#") ? hex.slice(1) : hex).padEnd(6, "0");
  return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
}

function stripPipes(t: string): string {
  return t.replace(/\|([^|]+)\|/g, "$1");
}

/** Draw a single canvas line, rendering the hero word (between pipes) in heroColor.
 *  Matches on whole word tokens only (strips punctuation before comparing),
 *  so |YOU| never accidentally colours the YOU inside YOUR. */
function renderHookLine(
  ctx: CanvasRenderingContext2D,
  line: string,            // already uppercased, pipes stripped
  heroWord: string | null, // already uppercased, no punctuation
  cx: number,
  y: number,
  normalColor: string,
  heroColor: string,
) {
  if (!heroWord) {
    ctx.fillStyle = normalColor;
    ctx.fillText(line, cx, y);
    return;
  }
  // Split line into space tokens and find the one whose letters match heroWord exactly
  const tokens   = line.split(" ");
  const heroIdx  = tokens.findIndex(
    tok => tok.replace(/[^a-zA-Z]/g, "").toUpperCase() === heroWord.toUpperCase()
  );
  if (heroIdx === -1) {
    ctx.fillStyle = normalColor;
    ctx.fillText(line, cx, y);
    return;
  }
  // Reconstruct segments, preserving original spacing
  const beforeStr = heroIdx > 0 ? tokens.slice(0, heroIdx).join(" ") + " " : "";
  const heroStr   = tokens[heroIdx];
  const afterStr  = heroIdx < tokens.length - 1 ? " " + tokens.slice(heroIdx + 1).join(" ") : "";

  const totalW  = ctx.measureText(line).width;
  const startX  = cx - totalW / 2;
  const beforeW = ctx.measureText(beforeStr).width;
  const heroW   = ctx.measureText(heroStr).width;
  const saved   = ctx.textAlign as CanvasTextAlign;
  ctx.textAlign = "left";
  if (beforeStr) { ctx.fillStyle = normalColor; ctx.fillText(beforeStr, startX, y); }
  ctx.fillStyle = heroColor;
  ctx.fillText(heroStr, startX + beforeW, y);
  if (afterStr)  { ctx.fillStyle = normalColor; ctx.fillText(afterStr, startX + beforeW + heroW, y); }
  ctx.textAlign = saved;
}

function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else { cur = t; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, alpha: number) {
  const s = Math.max(W / img.width, H / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  ctx.globalAlpha = 1;
}

function renderSlideCanvas(
  slideNum: 1|2|3|4,
  blocks: Block[],
  coverImg: HTMLImageElement | null,
  bodyImg: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  preset: ClientPreset,
  scale = SCALE,
  bgOnly = false,
  lineSpacing = 1.2,
  accentOverride?: string,
  subtitleOverride?: string,
  overlayOverride?: string,
  overlayAlpha?: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const pageColor = preset.pageColor || "#1a1a2e";
  const overlayColor = preset.overlayColor || "rgba(0,0,0,0.55)";
  const textColor = preset.textColor || "#ffffff";
  const accentColor = accentOverride ?? preset.cornerColor ?? "#d4af37";

  // Background fill
  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  // Image layer
  const img = slideNum === 1 ? coverImg : bodyImg;
  if (img) {
    if (slideNum === 1) {
      drawCover(ctx, img, 1.0);
    } else {
      drawCover(ctx, img, 1.0);
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Slide 1 gets a bottom gradient; slides 2-4 get nothing extra (overlay already applied above)
  if (slideNum === 1) {
    const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Optional user overlay tint, applied to every slide
  if (overlayAlpha && overlayAlpha > 0) {
    const [orr, ogg, obb] = hexToRgb(overlayOverride ?? "#000000");
    ctx.fillStyle = `rgba(${orr}, ${ogg}, ${obb}, ${overlayAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (!bgOnly) {
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor  = "rgba(0,0,0,0.75)";
    ctx.shadowBlur   = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    if (slideNum === 1) {
      // ── Slide 1 layout — positions driven by block.x / block.y ──────────────
      const hookBlock   = blocks.find(b => b.id === "hook");
      const subBlock    = blocks.find(b => b.id === "subtitle");
      const hookRaw     = hookBlock?.text ?? "";
      const subRaw      = subBlock?.text  ?? "";
      const HOOK_SIZE   = hookBlock?.fontSize ?? 108;
      const HOOK_LINE_H = Math.round(HOOK_SIZE * 1.10);
      const SUB_SIZE    = subBlock?.fontSize  ?? 44;
      const SUB_LINE_H  = Math.round(SUB_SIZE  * 1.40);
      const PAD_X       = 90;

      const hookCX = (hookBlock?.x ?? 0.5) * W;
      const hookCY = (hookBlock?.y ?? 0.695) * H;
      const subCX  = (subBlock?.x  ?? 0.5) * W;
      const subCY  = (subBlock?.y  ?? 0.785) * H;

      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";

      // Extract hero word (text wrapped in |pipes|) for accent-colour rendering
      const heroMatch = hookRaw.match(/\|([^|]+)\|/);
      const heroWord  = heroMatch ? heroMatch[1].toUpperCase() : null;

      // Measure wrapped lines (pipes stripped, uppercased)
      ctx.font = `700 ${HOOK_SIZE}px 'Bebas Neue', sans-serif`;
      const hookLines = hookRaw.trim()
        ? wrapCanvas(ctx, stripPipes(hookRaw).trim().toUpperCase(), W - PAD_X * 2)
        : [];

      ctx.font = `normal 400 ${SUB_SIZE}px 'Poppins', sans-serif`;
      const subLines = subRaw.trim()
        ? wrapCanvas(ctx, stripPipes(subRaw).trim(), W - PAD_X * 2)
        : [];

      // Hook — centred around hookCY; hero word in accent colour
      if (hookLines.length > 0) {
        const totalH = hookLines.length * HOOK_LINE_H;
        ctx.font = `700 ${HOOK_SIZE}px 'Bebas Neue', sans-serif`;
        let y = hookCY - totalH / 2 + HOOK_LINE_H / 2;
        for (const line of hookLines) {
          renderHookLine(ctx, line, heroWord, hookCX, y, "#ffffff", accentColor);
          y += HOOK_LINE_H;
        }
      }

      // Subtitle — centred around subCY, accent colour
      if (subLines.length > 0) {
        const totalH = subLines.length * SUB_LINE_H;
        ctx.font      = `normal 400 ${SUB_SIZE}px 'Poppins', sans-serif`;
        ctx.fillStyle = subtitleOverride ?? accentColor;
        let y = subCY - totalH / 2 + SUB_LINE_H / 2;
        for (const line of subLines) {
          ctx.fillText(stripPipes(line), subCX, y);
          y += SUB_LINE_H;
        }
      }

    } else {
      // ── Slides 2-4 unchanged ────────────────────────────────────────────────
      ctx.fillStyle = textColor;
      ctx.textBaseline = "middle";
      const activeIds = SLIDE_BLOCK_IDS[slideNum];
      for (const block of blocks.filter(b => activeIds.includes(b.id))) {
        if (!block.text.trim()) continue;
        const st = BLOCK_STYLE[block.id];
        const fontSize = block.fontSize ?? st.size;
        const maxW = block.w ? block.w * W : st.maxW;
        ctx.font = `${fontSize}px ${st.font}`;
        const lines = wrapCanvas(ctx, stripPipes(block.text), maxW);
        const totalH = lines.length * fontSize * st.lineH;
        const cx = block.x * W;
        let y = block.y * H - totalH / 2 + (fontSize * st.lineH) / 2;
        for (const line of lines) { ctx.fillText(stripPipes(line), cx, y); y += fontSize * st.lineH; }
      }
    }
  }

  // Decorative line + logo — positions/sizes driven by their blocks (movable & resizable).
  // Skipped in bgOnly mode so the editor overlay is the only draggable copy.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;

  if (!bgOnly) {
    const lineBlock = blocks.find(b => b.id === "line");
    if (lineBlock) {
      const lineLen = (lineBlock.w ?? 0.4) * W;
      const thick   = Math.max(1, lineBlock.thickness ?? 3);
      const lcx = (lineBlock.x ?? 0.5) * W;
      const lcy = (lineBlock.y ?? 0.9) * H;
      ctx.fillStyle = accentColor;
      ctx.fillRect(lcx - lineLen / 2, lcy - thick / 2, lineLen, thick);
    }

    if (logoImg) {
      const logoBlock = blocks.find(b => b.id === "logo");
      const targetW = (logoBlock?.w ?? 0.10) * W;
      const asp = (logoImg.width / logoImg.height) || 1;
      const lw = targetW;
      const lh = targetW / asp;
      const lcx = (logoBlock?.x ?? 0.09) * W;
      const lcy = (logoBlock?.y ?? 0.07) * H;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(logoImg, lcx - lw / 2, lcy - lh / 2, lw, lh);
      ctx.globalAlpha = 1;
    }
  }

  return canvas.toDataURL("image/png");
}

function renderAllThumbs(
  item: Pick<CarouselItem, "blocks" | "coverImg" | "bodyImg">,
  logoImg: HTMLImageElement | null,
  preset: ClientPreset,
  lineSpacing = 1.2,
  accentOverride?: string,
  subtitleOverride?: string,
  overlayOverride?: string,
  overlayAlpha?: number
): string[] {
  return ([1,2,3,4] as const).map(n =>
    renderSlideCanvas(n, item.blocks, item.coverImg, item.bodyImg, logoImg, preset, SCALE, false, lineSpacing, accentOverride, subtitleOverride, overlayOverride, overlayAlpha)
  );
}

// ── Upload helper ─────────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
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

function makeSampleCsv(): string {
  return [
    CSV_COLS.join(","),
    "Your headline hook here,A short supporting subtitle,Body copy for slide two goes here.,Body copy for slide three goes here.,Book your consultation today",
    "",
  ].join("\n");
}

// ── Slide editor modal ────────────────────────────────────────────────────────

type EditorProps = {
  item: CarouselItem;
  preset: ClientPreset;
  logoImg: HTMLImageElement | null;
  heroWordColor: string;
  subtitleColor: string;
  overlayColor: string;
  overlayAlpha: number;
  onSave: (blocks: Block[]) => void;
  onClose: () => void;
};

function SlideEditorModal({ item, preset, logoImg, heroWordColor, subtitleColor, overlayColor, overlayAlpha, onSave, onClose }: EditorProps) {
  const [activeSlide, setActiveSlide] = useState<1|2|3|4>(1);
  const [blocks, setBlocks] = useState<Block[]>(() => item.blocks.map(b => ({ ...b })));
  const [dragging, setDragging] = useState<{
    id: BlockId; startPx: number; startPy: number; startBx: number; startBy: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    id: BlockId; mode: "corner" | "x" | "y"; startDist: number;
    startW: number; startFontSize: number; startThickness: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<BlockId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgUrls = useMemo(() =>
    ([1,2,3,4] as const).map(n =>
      renderSlideCanvas(n, blocks, item.coverImg, item.bodyImg, logoImg, preset, 1, true, 1.2, undefined, undefined, overlayColor, overlayAlpha)
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [item.coverImg, item.bodyImg, logoImg, preset.pageColor, preset.overlayColor, overlayColor, overlayAlpha]
  );

  const activeBlockIds = SLIDE_BLOCK_IDS[activeSlide];
  const activeBlocks = blocks.filter(b => activeBlockIds.includes(b.id) || b.id === "logo" || b.id === "line");

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (dragging) {
      const dx = (e.clientX - dragging.startPx) / rect.width;
      const dy = (e.clientY - dragging.startPy) / rect.height;
      setBlocks(prev => prev.map(b =>
        b.id === dragging.id
          ? { ...b, x: Math.max(0.04, Math.min(0.96, dragging.startBx + dx)), y: Math.max(0.04, Math.min(0.96, dragging.startBy + dy)) }
          : b
      ));
    }

    if (resizing) {
      const block = blocks.find(b => b.id === resizing.id);
      if (!block) return;
      const bx = block.x * rect.width + rect.left;
      const by = block.y * rect.height + rect.top;
      const ddx = Math.abs(e.clientX - bx);
      const ddy = Math.abs(e.clientY - by);
      const dist =
        resizing.mode === "x" ? ddx :
        resizing.mode === "y" ? ddy :
        Math.sqrt(ddx * ddx + ddy * ddy);
      const scale = (dist || 1) / resizing.startDist;
      setBlocks(prev => prev.map(b => {
        if (b.id !== resizing.id) return b;
        if (b.id === "line") {
          if (resizing.mode === "y") {
            return { ...b, thickness: Math.round(Math.max(1, Math.min(40, resizing.startThickness * scale))) };
          }
          return { ...b, w: Math.max(0.05, Math.min(0.95, resizing.startW * scale)) };
        }
        if (b.id === "logo") {
          return { ...b, w: Math.max(0.04, Math.min(0.6, resizing.startW * scale)) };
        }
        if (resizing.mode === "x") {
          return { ...b, w: Math.max(0.1, Math.min(0.95, resizing.startW * scale)) };
        }
        if (resizing.mode === "y") {
          return { ...b, fontSize: Math.round(Math.max(8, Math.min(400, resizing.startFontSize * scale))) };
        }
        return { ...b,
          w: Math.max(0.1, Math.min(0.95, resizing.startW * scale)),
          fontSize: Math.round(Math.max(8, Math.min(400, resizing.startFontSize * scale))),
        };
      }));
    }
  };

  const handleBlockDown = (e: React.PointerEvent, block: Block) => {
    if (editingId === block.id) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ id: block.id, startPx: e.clientX, startPy: e.clientY, startBx: block.x, startBy: block.y });
  };

  const handleResizeDown = (e: React.PointerEvent, block: Block, mode: "corner" | "x" | "y") => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = containerRef.current!.getBoundingClientRect();
    const bx = block.x * rect.width + rect.left;
    const by = block.y * rect.height + rect.top;
    const ddx = Math.abs(e.clientX - bx);
    const ddy = Math.abs(e.clientY - by);
    const startDist =
      mode === "x" ? (ddx || 30) :
      mode === "y" ? (ddy || 30) :
      (Math.sqrt(ddx * ddx + ddy * ddy) || 50);
    setResizing({
      id: block.id,
      mode,
      startDist,
      startW: block.w ?? (BLOCK_STYLE[block.id].maxW / W),
      startFontSize: block.fontSize ?? BLOCK_STYLE[block.id].size,
      startThickness: block.thickness ?? 3,
    });
  };

  const handleTextChange = (id: BlockId, text: string) =>
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text } : b));

  const displayW = EDITOR_W;
  const displayH = Math.round(EDITOR_W * H / W);
  const tc = preset.textColor || "#ffffff";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-[420px] overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h3 className="font-semibold">Edit slides</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slide tabs */}
        <div className="flex border-b border-border/30">
          {([1,2,3,4] as const).map(n => (
            <button
              key={n}
              onClick={() => { setEditingId(null); setDragging(null); setResizing(null); setActiveSlide(n); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeSlide === n ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Slide {n}
            </button>
          ))}
        </div>

        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            <GripVertical className="w-3 h-3 inline mr-1 opacity-60" />
            Drag to move. Drag corners or sides to resize. Double-click text to edit. Logo and line are draggable too.
          </p>

          {/* Slide canvas area */}
          <div
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-lg select-none touch-none"
            style={{ width: displayW, height: displayH }}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={() => { setDragging(null); setResizing(null); }}
          >
            <img
              src={bgUrls[activeSlide - 1]}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
            />

            {activeBlocks.map(block => {
              const st = BLOCK_STYLE[block.id];
              const isText = block.id === "hook" || block.id === "subtitle" || block.id === "body2" || block.id === "body3" || block.id === "cta";
              const isLogo = block.id === "logo";
              const isLine = block.id === "line";
              const logoSrc = logoImg?.src ?? "";
              if (isLogo && !logoSrc) return null;
              const accent = preset.cornerColor || "#d4af37";
              const dispFontSize = Math.max(8, Math.round((block.fontSize ?? st.size) * EDITOR_SCALE));
              const blockW = block.w ?? (st.maxW / W);
              const blockDisplayW = Math.round(blockW * displayW);
              const lineThickPx = Math.max(1, Math.round((block.thickness ?? 3) * EDITOR_SCALE));
              const isEditing = editingId === block.id;
              const isDraggingThis = dragging?.id === block.id;
              const isResizingThis = resizing?.id === block.id;
              const isActive = isDraggingThis || isResizingThis;
              const HSIZE = 9;
              const handles = [
                { top: -HSIZE/2, left: -HSIZE/2, cursor: "nwse-resize", mode: "corner" as const },
                { top: -HSIZE/2, right: -HSIZE/2, cursor: "nesw-resize", mode: "corner" as const },
                { bottom: -HSIZE/2, left: -HSIZE/2, cursor: "nesw-resize", mode: "corner" as const },
                { bottom: -HSIZE/2, right: -HSIZE/2, cursor: "nwse-resize", mode: "corner" as const },
                { top: -HSIZE/2, left: "50%", marginLeft: -HSIZE/2, cursor: "ns-resize", mode: "y" as const },
                { bottom: -HSIZE/2, left: "50%", marginLeft: -HSIZE/2, cursor: "ns-resize", mode: "y" as const },
                { left: -HSIZE/2, top: "50%", marginTop: -HSIZE/2, cursor: "ew-resize", mode: "x" as const },
                { right: -HSIZE/2, top: "50%", marginTop: -HSIZE/2, cursor: "ew-resize", mode: "x" as const },
              ] as any[];
              return (
                <div
                  key={block.id}
                  style={{
                    position: "absolute",
                    left: `${block.x * 100}%`,
                    top: `${block.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: isLogo ? 14 : isLine ? 12 : 10,
                    width: blockDisplayW,
                    textAlign: "center",
                    cursor: isDraggingThis ? "grabbing" : isEditing ? "text" : "grab",
                    touchAction: "none",
                  }}
                  onPointerDown={e => !isEditing && handleBlockDown(e, block)}
                  onPointerUp={() => { setDragging(null); setResizing(null); }}
                  onDoubleClick={() => { if (isText) { setDragging(null); setResizing(null); setEditingId(block.id); } }}
                >
                  {!isEditing && (
                    <div className={`absolute -inset-1.5 rounded-md border transition-colors ${isActive ? "border-primary/80 bg-primary/10" : "border-white/20 hover:border-white/50"}`} />
                  )}

                  {!isEditing && handles.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        width: HSIZE,
                        height: HSIZE,
                        borderRadius: 2,
                        background: "#ffffff",
                        border: "1.5px solid rgba(0,0,0,0.5)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        zIndex: 20,
                        cursor: h.cursor,
                        top: h.top,
                        bottom: h.bottom,
                        left: h.left,
                        right: h.right,
                        marginLeft: h.marginLeft,
                        marginTop: h.marginTop,
                      }}
                      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); handleResizeDown(e, block, h.mode); }}
                    />
                  ))}

                  {isLogo ? (
                    <img src={logoSrc} draggable={false} style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }} />
                  ) : isLine ? (
                    <div style={{ width: "100%", height: lineThickPx, background: accent, borderRadius: 1 }} />
                  ) : isEditing ? (
                    <input
                      autoFocus
                      value={block.text}
                      onChange={e => handleTextChange(block.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                      className="bg-black/70 border border-white/40 rounded px-2 py-0.5 outline-none text-center relative z-20"
                      style={{
                        fontFamily: st.font.replace(/"/g, "'"),
                        fontSize: dispFontSize,
                        color: tc,
                        width: blockDisplayW,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontFamily: st.font.replace(/"/g, "'"),
                        fontSize: dispFontSize,
                        lineHeight: st.lineH,
                        color: block.id === "subtitle" ? subtitleColor : tc,
                        textShadow: "0 2px 12px rgba(0,0,0,0.95)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        display: "block",
                        position: "relative",
                        zIndex: 11,
                      }}
                    >
                      {block.id === "hook"
                        ? (() => {
                            const ac = heroWordColor;
                            return block.text.split(/(\|[^|]+\|)/).map((part, i) => {
                              const m = part.match(/^\|([^|]+)\|$/);
                              return m
                                ? <span key={i} style={{ color: ac }}>{m[1].toUpperCase()}</span>
                                : part.toUpperCase();
                            });
                          })()
                        : block.text}
                    </span>
                  )}

                  {!isEditing && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest text-white/40 whitespace-nowrap pointer-events-none">
                      {st.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border/30">
          <Button variant="outline" size="sm" onClick={onClose}>Discard</Button>
          <Button size="sm" onClick={() => { onSave(blocks); onClose(); }}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  label, hint, files, accept, multiple = true, active, color,
  onDragOver, onDragLeave, onDrop, onClick,
}: {
  label: string; hint: string; files: File[]; accept: string; multiple?: boolean;
  active: boolean; color: string;
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
        files.length ? `border-${color}-500/40 bg-${color}-500/5` :
        "border-border/40 hover:border-border/70"
      }`}
    >
      {files.length ? (
        <>
          <CheckCircle2 className={`w-7 h-7 text-${color}-400`} />
          <p className={`text-sm font-medium text-${color}-400`}>{files.length} file{files.length !== 1 ? "s" : ""} ready</p>
          <p className="text-xs text-muted-foreground">Click or drop to add more</p>
        </>
      ) : (
        <>
          <Upload className="w-7 h-7 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BulkCarousel() {
  const [phase, setPhase] = useState<Phase>("upload");

  // Upload state
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const csvState = csvFile ? { file: csvFile, error: csvError, rows: csvRows } : null;
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [bodyFiles, setBodyFiles] = useState<File[]>([]);
  const [csvDrag, setCsvDrag] = useState(false);
  const [coverDrag, setCoverDrag] = useState(false);
  const [bodyDrag, setBodyDrag] = useState(false);

  // Preview state
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [lineSpacing, setLineSpacing] = useState(1.2);
  const lineSpacingRef = useRef(1.2);
  const [heroWordColor, setHeroWordColor] = useState("#C4879A");
  const heroWordColorRef = useRef("#C4879A");
  const [subtitleColor, setSubtitleColor] = useState("#C4879A");
  const subtitleColorRef = useRef("#C4879A");
  const [overlayColor, setOverlayColor] = useState("#000000");
  const overlayColorRef = useRef("#000000");
  const [overlayAlpha, setOverlayAlpha] = useState(0);
  const overlayAlphaRef = useRef(0);
  useEffect(() => { lineSpacingRef.current = lineSpacing; }, [lineSpacing]);
  useEffect(() => { heroWordColorRef.current = heroWordColor; }, [heroWordColor]);
  useEffect(() => { subtitleColorRef.current = subtitleColor; }, [subtitleColor]);
  useEffect(() => { overlayColorRef.current = overlayColor; }, [overlayColor]);
  useEffect(() => { overlayAlphaRef.current = overlayAlpha; }, [overlayAlpha]);

  // Caption state
  const [captionMap, setCaptionMap] = useState<Record<string, string>>({});
  const [generatingCaptionId, setGeneratingCaptionId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState<{ current: number; total: number } | null>(null);

  // Schedule state
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [dragCtx, setDragCtx] = useState<{ list: "cover" | "body"; index: number } | null>(null);

  const csvInputRef  = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef  = useRef<HTMLInputElement>(null);

  const { presets } = usePresets();
  const selectedPreset = useMemo(() => presets.find(p => p.id === selectedPresetId) ?? null, [presets, selectedPresetId]);

  // ── CSV ──────────────────────────────────────────────────────────────────────

  const parseCsv = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split('\n')[0];
      const commas = (firstLine.match(/,/g) || []).length;
      const semis = (firstLine.match(/;/g) || []).length;
      const tabs = (firstLine.match(/\t/g) || []).length;
      const delim = tabs > commas && tabs > semis ? '\t' : semis > commas ? ';' : ',';
      Papa.parse(text, {
        header: true,
        delimiter: delim,
        skipEmptyLines: true,
        complete: (results) => {
          const required = ['slide1_hook','slide1_subtitle','slide2_body','slide3_body','slide4_cta'];
          const headers = (results.meta.fields || []).map((h: string) => h.trim());
          const missing = required.filter(col => !headers.includes(col));
          if (missing.length > 0) {
            setCsvError(`Missing columns: ${missing.join(', ')}`);
            return;
          }
          setCsvError(null);
          const rows = results.data as CsvRow[];
          setCsvRows(rows);
        },
        error: (err: Error) => setCsvError(err.message),
      });
    };
    reader.readAsText(file);
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault(); setCsvDrag(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith(".csv"));
    if (file) parseCsv(file); else toast.error("Drop a CSV file.");
  };

  // ── Image sets ───────────────────────────────────────────────────────────────

  const appendImages = (setter: React.Dispatch<React.SetStateAction<File[]>>, files: File[]) =>
    setter(prev => [...prev, ...files.filter(f => f.type.startsWith("image/"))]);

  const reorderFiles = (list: "cover" | "body", from: number, to: number) => {
    const setter = list === "cover" ? setCoverFiles : setBodyFiles;
    setter(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault(); setCoverDrag(false);
    appendImages(setCoverFiles, Array.from(e.dataTransfer.files));
  };
  const handleBodyDrop = (e: React.DragEvent) => {
    e.preventDefault(); setBodyDrag(false);
    appendImages(setBodyFiles, Array.from(e.dataTransfer.files));
  };

  // ── Generate ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!csvRows.length || !selectedPreset) return;
    setRendering(true);
    setRenderProgress(0);
    try {
      await document.fonts.ready;

      let logoImg: HTMLImageElement | null = null;
      if (selectedPreset.logoUrl) {
        try { logoImg = await loadImg(selectedPreset.logoUrl); } catch {}
      }
      logoImgRef.current = logoImg;

      const rendered: CarouselItem[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        let coverImg: HTMLImageElement | null = null;
        let bodyImg: HTMLImageElement | null = null;
        if (coverFiles[i]) try { coverImg = await loadImg(URL.createObjectURL(coverFiles[i])); } catch {}
        if (bodyFiles[i])  try { bodyImg  = await loadImg(URL.createObjectURL(bodyFiles[i]));  } catch {}

        const blocks = makeBlocks(row);
        const thumbs = renderAllThumbs({ blocks, coverImg, bodyImg }, logoImg, selectedPreset, lineSpacing, heroWordColor, subtitleColor, overlayColor, overlayAlpha);
        rendered.push({ id: `item-${i}`, rowNum: i + 1, hook: row.slide1_hook, blocks, coverImg, bodyImg, thumbs });
        setRenderProgress(Math.round(((i + 1) / csvRows.length) * 100));
      }

      setItems(rendered);
      setPhase("preview");
    } catch (e: any) {
      toast.error("Render failed: " + e.message);
    } finally {
      setRendering(false);
    }
  };

  // ── Edit save ────────────────────────────────────────────────────────────────

  const handleSaveEdit = (id: string, newBlocks: Block[]) => {
    if (!selectedPreset) return;
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const thumbs = renderAllThumbs({ blocks: newBlocks, coverImg: item.coverImg, bodyImg: item.bodyImg }, logoImgRef.current, selectedPreset, lineSpacingRef.current, heroWordColorRef.current, subtitleColorRef.current, overlayColorRef.current, overlayAlphaRef.current);
      return { ...item, blocks: newBlocks, thumbs };
    }));
  };

  // Live re-render slide 1 thumbnails when line spacing changes
  useEffect(() => {
    if (phase !== "preview" || !selectedPreset || !items.length) return;
    const id = setTimeout(() => {
      const ls = lineSpacingRef.current;
      setItems(prev => prev.map(item => {
        const thumb1 = renderSlideCanvas(1, item.blocks, item.coverImg, item.bodyImg, logoImgRef.current, selectedPreset!, SCALE, false, ls, heroWordColorRef.current, subtitleColorRef.current, overlayColorRef.current, overlayAlphaRef.current);
        return { ...item, thumbs: [thumb1, ...item.thumbs.slice(1)] };
      }));
    }, 180);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSpacing]);

  // Auto re-render all slides after any Vite HMR update
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => {
      if (phase !== "preview" || !selectedPreset || !items.length) return;
      const ls = lineSpacingRef.current;
      setItems(prev => prev.map(item => ({
        ...item,
        thumbs: renderAllThumbs(item, logoImgRef.current, selectedPreset!, ls, heroWordColorRef.current, subtitleColorRef.current, overlayColorRef.current, overlayAlphaRef.current),
      })));
    };
    import.meta.hot.on("vite:afterUpdate", handler);
    return () => { import.meta.hot!.off("vite:afterUpdate", handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, items, selectedPreset]);

  // ── Export ───────────────────────────────────────────────────────────────────

  const downloadSingle = async (item: CarouselItem) => {
    const tid = toast.loading("Building ZIP…");
    try {
      const zip = new JSZip();
      item.thumbs.forEach((du, i) => zip.file(`slide${i + 1}.png`, du.split(",")[1], { base64: true }));
      const blob = await zip.generateAsync({ type: "blob" });
      const label = item.hook.slice(0, 30).replace(/[^a-z0-9]/gi, "-") || `carousel-${item.rowNum}`;
      saveAs(blob, `${label}.zip`);
      toast.success("ZIP downloaded.", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "ZIP failed", { id: tid });
    }
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
      saveAs(blob, "bulk-carousels.zip");
      toast.success("Download started.", { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    }
  };

  // ── Caption generation ────────────────────────────────────────────────────────

  const generateCaption = async (item: CarouselItem) => {
    setGeneratingCaptionId(item.id);
    try {
      const res = await fetch(`${BASE}/api/carousel/generate-caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook:     item.blocks.find(b => b.id === "hook")?.text     ?? "",
          subtitle: item.blocks.find(b => b.id === "subtitle")?.text ?? "",
          body2:    item.blocks.find(b => b.id === "body2")?.text    ?? "",
          body3:    item.blocks.find(b => b.id === "body3")?.text    ?? "",
          cta:      item.blocks.find(b => b.id === "cta")?.text      ?? "",
        }),
      });
      if (!res.ok) throw new Error("Caption generation failed");
      const { caption } = await res.json() as { caption: string };
      setCaptionMap(prev => ({ ...prev, [item.id]: caption }));
    } catch (e: any) {
      toast.error(e.message || "Caption generation failed");
    } finally {
      setGeneratingCaptionId(null);
    }
  };

  const generateAllCaptions = async () => {
    setGeneratingAll(true);
    setGenerateAllProgress({ current: 0, total: items.length });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setGenerateAllProgress({ current: i + 1, total: items.length });
      try {
        const res = await fetch(`${BASE}/api/carousel/generate-caption`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hook:     item.blocks.find(b => b.id === "hook")?.text     ?? "",
            subtitle: item.blocks.find(b => b.id === "subtitle")?.text ?? "",
            body2:    item.blocks.find(b => b.id === "body2")?.text    ?? "",
            body3:    item.blocks.find(b => b.id === "body3")?.text    ?? "",
            cta:      item.blocks.find(b => b.id === "cta")?.text      ?? "",
          }),
        });
        if (res.ok) {
          const { caption } = await res.json() as { caption: string };
          setCaptionMap(prev => ({ ...prev, [item.id]: caption }));
        }
      } catch {
        // continue to next item on failure
      }
    }
    setGeneratingAll(false);
    setGenerateAllProgress(null);
    toast.success("All captions generated.");
  };

  // ── Schedule ─────────────────────────────────────────────────────────────────

  const goToSchedule = () => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    setScheduleEntries(items.map((item, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        time: "18:15",
        platforms: ["instagram"] as ("instagram" | "facebook")[],
        presetId: selectedPresetId,
        caption: captionMap[item.id] ?? "",
      };
    }));
    setPhase("schedule");
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    setCaptionMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (editingItemId === id) setEditingItemId(null);
    toast.success("Carousel removed");
  };

  const handleGetApprovalGroups = useCallback(async () => {
    return Promise.all(items.map(async (item, i) => {
      const names = item.thumbs.map((_, j) => `carousel-${i + 1}-slide${j + 1}.png`);
      const imageUrls = await uploadDataUrls(item.thumbs, names);
      return { imageUrls, caption: captionMap[item.id] ?? "" };
    }));
  }, [items, captionMap]);

  const updateEntry = <K extends keyof ScheduleEntry>(i: number, k: K, v: ScheduleEntry[K]) =>
    setScheduleEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const togglePlatform = (i: number, p: "instagram" | "facebook") =>
    setScheduleEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      const has = e.platforms.includes(p);
      if (has && e.platforms.length === 1) return e;
      return { ...e, platforms: has ? e.platforms.filter(x => x !== p) : [...e.platforms, p] };
    }));

  const handleScheduleAll = async () => {
    const bad = scheduleEntries.findIndex(e => !e.presetId);
    if (bad !== -1) { toast.error(`Row ${bad + 1}: select a client account.`); return; }
    setScheduling(true);
    const tid = toast.loading("Uploading and queueing...");
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = scheduleEntries[i];
        toast.loading(`Scheduling ${i + 1} / ${items.length}...`, { id: tid });
        const names = item.thumbs.map((_, j) => `carousel-${i + 1}-slide${j + 1}.png`);
        const imageUrls = await uploadDataUrls(item.thumbs, names);
        const res = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: entry.presetId,
            postType: "carousel",
            content: {
              imageUrls, caption: entry.caption || "",
              title: item.hook.slice(0, 80) || `Carousel ${item.rowNum}`,
              platforms: entry.platforms,
              musicTrack: musicTrack || undefined,
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
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setScheduling(false);
    }
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
          <Button onClick={() => { setCsvFile(null); setCsvError(null); setCsvRows([]); setCoverFiles([]); setBodyFiles([]); setItems([]); setSelectedPresetId(null); setPhase("upload"); }}>
            Start again
          </Button>
        </div>
      </div>
    );
  }

  // ── Schedule phase ────────────────────────────────────────────────────────────

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
          <p className="text-sm text-muted-foreground mb-6">
            Set a date, time and platform for each carousel. Client account defaults to your selected preset.
          </p>

          <div className="space-y-3">
            {items.map((item, i) => {
              const entry = scheduleEntries[i];
              if (!entry) return null;
              return (
                <div key={item.id} className="rounded-xl p-4 bg-card/40">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm">Row {item.rowNum}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{stripPipes(item.hook)}</p>
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
                          <SelectContent>
                            {presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                          </SelectContent>
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
                            <button
                              key={p}
                              onClick={() => togglePlatform(i, p)}
                              className={`flex-1 rounded text-xs font-medium border transition-colors ${
                                entry.platforms.includes(p)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "text-muted-foreground border-border/40 hover:border-border"
                              }`}
                            >
                              {p === "instagram" ? "IG" : "FB"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Caption (optional)</Label>
                      <Input
                        placeholder="Leave blank to fill in later..."
                        value={entry.caption}
                        onChange={e => updateEntry(i, "caption", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPhase("preview")} disabled={scheduling}>Back</Button>
            <Button onClick={handleScheduleAll} disabled={scheduling} className="min-w-40">
              {scheduling
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
                : `Schedule All (${items.length})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview phase ─────────────────────────────────────────────────────────────

  if (phase === "preview") {
    const editingItem = items.find(i => i.id === editingItemId);
    return (
      <div className="min-h-screen bg-background">
        {editingItem && selectedPreset && (
          <SlideEditorModal
            item={editingItem}
            preset={selectedPreset}
            logoImg={logoImgRef.current}
            heroWordColor={heroWordColor}
            subtitleColor={subtitleColor}
            overlayColor={overlayColor}
            overlayAlpha={overlayAlpha}
            onSave={blocks => handleSaveEdit(editingItem.id, blocks)}
            onClose={() => setEditingItemId(null)}
          />
        )}

        {showApprovalModal && (
          <SendForApprovalModal
            defaultClientName={selectedPreset?.name ?? ""}
            defaultBundleName={
              selectedPreset
                ? `${selectedPreset.name} — ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
                : ""
            }
            onGetImageGroups={handleGetApprovalGroups}
            onClose={() => setShowApprovalModal(false)}
          />
        )}

        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/30">
          <header className="px-6 py-4 flex items-center gap-3">
            <button onClick={() => setPhase("upload")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">Preview</h1>
            <span className="text-muted-foreground text-sm ml-1">{items.length} carousel{items.length !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Line spacing <span className="font-mono text-foreground/70 ml-1">{lineSpacing.toFixed(1)}</span>
              </Label>
              <input
                type="range"
                min={0.8}
                max={2.0}
                step={0.1}
                value={lineSpacing}
                onChange={e => setLineSpacing(Number(e.target.value))}
                className="w-28 accent-sky-500"
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="w-4 h-4 mr-2" />Download All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApprovalModal(true)}
                className="border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60"
              >
                <Send className="w-4 h-4 mr-2" />Send for Approval
              </Button>
              <Button size="sm" onClick={goToSchedule}>
                <CalendarClock className="w-4 h-4 mr-2" />Send to Scheduler
              </Button>
            </div>
          </header>

          <div className="px-6 py-3 border-t border-border/20 bg-primary/5 flex items-center gap-4">
            <Button
              size="default"
              onClick={generateAllCaptions}
              disabled={generatingAll}
              className="font-semibold"
            >
              {generatingAll
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating {generateAllProgress?.current} of {generateAllProgress?.total}…</>
                : <><Sparkles className="w-4 h-4 mr-2" />Generate All Captions</>}
            </Button>
            {!generatingAll && (
              <span className="text-xs text-muted-foreground">
                Generate AI captions for all {items.length} carousel{items.length !== 1 ? "s" : ""} at once.
              </span>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map(item => (
            <div key={item.id} className="rounded-xl overflow-hidden bg-card/40">
              <div className="flex gap-1 p-3 bg-black/20">
                {item.thumbs.map((du, si) => (
                  <img key={si} src={du} alt={`slide ${si + 1}`} className="flex-1 rounded object-cover" style={{ aspectRatio: "4/5" }} />
                ))}
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-muted-foreground">Row {item.rowNum}</p>
                  <p className="text-xs truncate mt-0.5">{item.hook}</p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingItemId(item.id)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadSingle(item)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />ZIP
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToSchedule}>
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5" />Schedule
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => generateCaption(item)}
                    disabled={generatingCaptionId === item.id}
                  >
                    {generatingCaptionId === item.id
                      ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    Caption
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { if (window.confirm("Delete this carousel from the batch? You can regenerate it from your CSV.")) removeItem(item.id); }}
                    className="text-red-300 border-red-500/40 hover:bg-red-950/30 hover:text-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                  </Button>
                </div>
              </div>
              {captionMap[item.id] && (
                <div className="px-4 pb-4">
                  <textarea
                    className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 resize-y min-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                    value={captionMap[item.id]}
                    onChange={e => setCaptionMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <button
                    className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { navigator.clipboard.writeText(captionMap[item.id]); toast.success("Copied to clipboard"); }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 flex justify-center">
          <Button
            size="lg"
            onClick={generateAllCaptions}
            disabled={generatingAll}
            className="font-semibold px-8"
          >
            {generatingAll
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating {generateAllProgress?.current} of {generateAllProgress?.total}…</>
              : <><Sparkles className="w-5 h-5 mr-2" />Generate All Captions</>}
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload phase ──────────────────────────────────────────────────────────────

  const canGenerate = csvRows.length > 0 && selectedPresetId !== null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Bulk Carousel Creator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">One CSV, two image sets, one master ZIP or direct to the scheduler.</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Step 1: Preset */}
        <section className="space-y-3">
          <h2 className="font-semibold text-base">1. Choose a client</h2>
          <p className="text-sm text-muted-foreground">Brand colours, fonts and logo all come from the saved preset.</p>
          <Select value={selectedPresetId?.toString() ?? ""} onValueChange={v => setSelectedPresetId(v ? parseInt(v) : null)}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select a client preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedPreset && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 max-w-sm">
              {selectedPreset.logoUrl && (
                <img src={selectedPreset.logoUrl} alt="logo" className="h-8 w-8 object-contain rounded" />
              )}
              <div className="flex gap-2 items-center">
                <div className="w-5 h-5 rounded" style={{ background: selectedPreset.pageColor || "#1a1a2e" }} />
                <div className="w-5 h-5 rounded border border-border/20" style={{ background: selectedPreset.textColor || "#fff" }} />
                <span className="text-xs text-muted-foreground ml-1">{selectedPreset.name}</span>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: CSV */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">2. Upload your CSV</h2>
            <button
              onClick={() => saveAs(new Blob([makeSampleCsv()], { type: "text/csv" }), "bulk-carousel-template.csv")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Download template
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Required columns: {CSV_COLS.join(", ")}. Each row becomes one carousel.</p>

          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Hero Word Colour</label>
              <input type="color" value={heroWordColor} onChange={e => setHeroWordColor(e.target.value)} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Subtitle Colour</label>
              <input type="color" value={subtitleColor} onChange={e => setSubtitleColor(e.target.value)} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Overlay (all slides)</label>
              <input type="color" value={overlayColor} onChange={e => setOverlayColor(e.target.value)} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
              <input type="range" min={0} max={0.8} step={0.05} value={overlayAlpha} onChange={e => setOverlayAlpha(parseFloat(e.target.value))} className="w-28 cursor-pointer" />
              <span className="text-xs text-muted-foreground w-10">{Math.round(overlayAlpha * 100)}%</span>
            </div>
          </div>

          <div
            onDrop={handleCsvDrop}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
            onDragLeave={() => setCsvDrag(false)}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              csvDrag ? "border-primary/60 bg-primary/5" :
              csvRows.length ? "border-emerald-500/40 bg-emerald-500/5" :
              "border-border/40 hover:border-border/70"
            }`}
          >
            {csvRows.length ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{csvRows.length} row{csvRows.length !== 1 ? "s" : ""} loaded</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop CSV here or click to browse</p>
              </>
            )}
          </div>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseCsv(e.target.files[0]); e.target.value = ""; }} />
          {csvState !== null && csvState.error !== null && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{csvState.error}</p>}
        </section>

        {/* Step 3: Images */}
        <section className="space-y-4">
          <h2 className="font-semibold text-base">3. Upload images</h2>
          <p className="text-sm text-muted-foreground">
            Images are matched to CSV rows by order. Upload {csvRows.length > 0 ? csvRows.length : "N"} of each to match your {csvRows.length > 0 ? csvRows.length : ""} row{csvRows.length !== 1 ? "s" : ""}.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cover / hero image (Slide 1)</Label>
              <p className="text-xs text-muted-foreground">The main photo shown on the hook slide.</p>
              <DropZone
                label="Drop cover images" hint="One per row, in order"
                files={coverFiles} accept="image/*" active={coverDrag} color="violet"
                onDragOver={() => setCoverDrag(true)} onDragLeave={() => setCoverDrag(false)}
                onDrop={handleCoverDrop} onClick={() => coverInputRef.current?.click()}
              />
              <input ref={coverInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) appendImages(setCoverFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              <ApprovedImagesPicker
                clientName={selectedPreset?.name}
                label="Use approved photos (covers)"
                onAddImages={files => appendImages(setCoverFiles, files)}
              />
              {coverFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <p className="w-full text-xs text-muted-foreground">Drag the chips to reorder. Image 1 goes with CSV row 1, image 2 with row 2, and so on.</p>
                  {coverFiles.map((f, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => setDragCtx({ list: "cover", index: i })}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (dragCtx?.list === "cover") reorderFiles("cover", dragCtx.index, i); setDragCtx(null); }}
                      className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setCoverFiles(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Body image (Slides 2, 3, 4)</Label>
              <p className="text-xs text-muted-foreground">Used behind the body and CTA slides.</p>
              <DropZone
                label="Drop body images" hint="One per row, in order"
                files={bodyFiles} accept="image/*" active={bodyDrag} color="indigo"
                onDragOver={() => setBodyDrag(true)} onDragLeave={() => setBodyDrag(false)}
                onDrop={handleBodyDrop} onClick={() => bodyInputRef.current?.click()}
              />
              <input ref={bodyInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) appendImages(setBodyFiles, Array.from(e.target.files)); e.target.value = ""; }} />
              <ApprovedImagesPicker
                clientName={selectedPreset?.name}
                label="Use approved photos (body)"
                onAddImages={files => appendImages(setBodyFiles, files)}
              />
              {bodyFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <p className="w-full text-xs text-muted-foreground">Drag the chips to reorder. Image 1 goes with CSV row 1, image 2 with row 2, and so on.</p>
                  {bodyFiles.map((f, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => setDragCtx({ list: "body", index: i })}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (dragCtx?.list === "body") reorderFiles("body", dragCtx.index, i); setDragCtx(null); }}
                      className="flex items-center gap-1 text-xs bg-muted/40 rounded-full px-2.5 py-1 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <span className="truncate max-w-28">{f.name}</span>
                      <button onClick={() => setBodyFiles(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {csvRows.length > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className={coverFiles.length >= csvRows.length ? "text-emerald-400" : "text-amber-400"}>
                Cover: {coverFiles.length}/{csvRows.length}
              </span>
              <span className={bodyFiles.length >= csvRows.length ? "text-emerald-400" : "text-amber-400"}>
                Body: {bodyFiles.length}/{csvRows.length}
              </span>
              {(coverFiles.length < csvRows.length || bodyFiles.length < csvRows.length) && (
                <span>Missing rows will render with a solid brand colour background.</span>
              )}
            </div>
          )}
        </section>

        {/* Step 3.5: Music (optional) */}
        <section className="space-y-2">
          <h2 className="font-semibold text-base">Add music (optional)</h2>
          <p className="text-sm text-muted-foreground">
            One track is attached to every carousel in this batch when it posts to Instagram.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setMusicPickerOpen(true)}
              className={musicTrack ? "border-green-500/40 text-green-300 hover:bg-green-950/30" : ""}
            >
              <Music className="w-4 h-4 mr-2" />
              {musicTrack ? musicTrack.name.slice(0, 30) : "Browse music"}
            </Button>
            {musicTrack && (
              <button
                onClick={() => setMusicTrack(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            )}
          </div>
          <MusicPickerModal
            open={musicPickerOpen}
            onClose={() => setMusicPickerOpen(false)}
            selectedTrack={musicTrack}
            onSelect={t => setMusicTrack(t)}
          />
        </section>

        {/* Step 4: Preview table */}
        {csvRows.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-base">4. Review rows</h2>
            <div className="rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2 font-medium">Hook</th>
                      <th className="text-left px-3 py-2 font-medium">Subtitle</th>
                      <th className="text-left px-3 py-2 font-medium">CTA</th>
                      <th className="text-center px-3 py-2 font-medium">Cover</th>
                      <th className="text-center px-3 py-2 font-medium">Body</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {csvRows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium max-w-[160px] truncate">{stripPipes(row.slide1_hook)}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.slide1_subtitle}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.slide4_cta}</td>
                        <td className="px-3 py-2 text-center">
                          {coverFiles[i]
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                            : <X className="w-3.5 h-3.5 text-amber-400/60 mx-auto" />}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {bodyFiles[i]
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                            : <X className="w-3.5 h-3.5 text-amber-400/60 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
