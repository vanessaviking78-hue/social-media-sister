import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Layers, Loader2, Download, X, Sparkles, Wand2,
  BookOpen, ImagePlus, CalendarDays, BarChart3, ShieldCheck,
  MessageSquareText, PenTool, ChevronLeft, ChevronRight,
  CloudUpload, FileText, Plus, Palette, Check, Copy, Film, Play, Clock, CalendarClock, Music, Link2,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  FONT_OPTIONS, LOGO_POSITIONS, STORY_BACKGROUNDS,
  STORY_WIDTH, STORY_HEIGHT, RENDER_SCALE, drawStory, drawHeroSlide, loadGoogleFonts, recordReelVideoMp4,
} from "@/lib/slide-utils";
import { type ReelAnimType, REEL_ANIM_LABELS, applyPhotoAnimation } from "@/lib/animate-utils";
import { authHeaders } from "@/lib/use-approval";
import { usePresets, type ClientPreset, type PresetStyleFields, type TextAlign } from "@/lib/use-presets";
import { getBrandDefaults } from "@/lib/brand-defaults";
import type { LogoPosition } from "@workspace/db/schema";
import PresetSelector from "@/components/preset-selector";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";
import { FontSwitcher } from "@/components/font-switcher";

const BASE = import.meta.env.BASE_URL || "/";
const api = (p: string) => `${BASE}api${p}`;

// Canvas PNG exports are 5-8MB — too large for the 15MB server limit and slow to upload.
// Re-encode as JPEG (85% quality) before sending: typically reduces to 200-500KB.
function compressForUpload(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to compress image for upload"));
    img.src = dataUrl;
  });
}

// ─── Interactive sticker types ───────────────────────────────────────────────
interface PollSticker      { type: "poll";      question: string; optionA: string; optionB: string; }
interface QuestionSticker  { type: "question";  prompt: string; }
interface CountdownSticker { type: "countdown"; eventName: string; endDate: string; }
interface LinkSticker      { type: "link";      url: string; displayText: string; }
type StickerConfig = PollSticker | QuestionSticker | CountdownSticker | LinkSticker;

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function canvasRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateCanvas(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "\u2026").width > maxW) t = t.slice(0, -1);
  return t + "\u2026";
}

function drawInteractiveSticker(
  ctx: CanvasRenderingContext2D,
  config: StickerConfig,
  cx: number,
  cy: number,
) {
  ctx.save();
  const shadow = () => { ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 5; };
  const noShadow = () => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

  if (config.type === "poll") {
    const W = 640, H = 248;
    const x = cx - W / 2, y = cy - H / 2;
    shadow();
    canvasRoundRect(ctx, x, y, W, H, 28);
    ctx.fillStyle = "rgba(255,255,255,0.97)"; ctx.fill();
    noShadow();
    ctx.fillStyle = "#999"; ctx.font = "600 22px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("POLL", cx, y + 44);
    ctx.fillStyle = "#111"; ctx.font = "bold 36px 'Inter',Arial,sans-serif";
    ctx.fillText(truncateCanvas(ctx, config.question || "Which do you prefer?", W - 64), cx, y + 94);
    const btnY = y + 118, btnH = 82, btnW = (W - 72) / 2;
    const aX = x + 20, bX = x + 20 + btnW + 32;
    canvasRoundRect(ctx, aX, btnY, btnW, btnH, 18);
    ctx.fillStyle = "rgba(233,25,118,0.10)"; ctx.fill();
    ctx.strokeStyle = "rgba(233,25,118,0.70)"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#E91976"; ctx.font = "bold 30px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(truncateCanvas(ctx, config.optionA || "A", btnW - 28), aX + btnW / 2, btnY + 50);
    canvasRoundRect(ctx, bX, btnY, btnW, btnH, 18);
    ctx.fillStyle = "rgba(139,92,246,0.10)"; ctx.fill();
    ctx.strokeStyle = "rgba(139,92,246,0.70)"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7c3aed";
    ctx.fillText(truncateCanvas(ctx, config.optionB || "B", btnW - 28), bX + btnW / 2, btnY + 50);

  } else if (config.type === "question") {
    const W = 620, H = 216;
    const x = cx - W / 2, y = cy - H / 2;
    shadow();
    canvasRoundRect(ctx, x, y, W, H, 28);
    ctx.fillStyle = "rgba(255,243,196,0.97)"; ctx.fill();
    noShadow();
    ctx.fillStyle = "#b45309"; ctx.font = "600 23px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("ASK ME A QUESTION", cx, y + 48);
    ctx.fillStyle = "#78350f"; ctx.font = "bold 38px 'Inter',Arial,sans-serif";
    ctx.fillText(truncateCanvas(ctx, config.prompt || "Ask me anything", W - 64), cx, y + 108);
    canvasRoundRect(ctx, x + 24, y + 132, W - 48, 52, 14);
    ctx.fillStyle = "rgba(251,191,36,0.28)"; ctx.fill();
    ctx.fillStyle = "rgba(161,115,30,0.55)"; ctx.font = "italic 24px 'Inter',Arial,sans-serif";
    ctx.fillText("Type something\u2026", cx, y + 165);

  } else if (config.type === "countdown") {
    const W = 640, H = 248;
    const x = cx - W / 2, y = cy - H / 2;
    shadow();
    canvasRoundRect(ctx, x, y, W, H, 28);
    ctx.fillStyle = "rgba(10,10,20,0.96)"; ctx.fill();
    noShadow();
    ctx.strokeStyle = "#E91976"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 32, y + 3); ctx.lineTo(x + W - 32, y + 3); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "600 28px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(truncateCanvas(ctx, config.eventName || "COUNTDOWN", W - 64), cx, y + 56);
    const diff = Math.max(0, new Date(config.endDate).getTime() - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const parts = [
      { v: String(d).padStart(2, "0"), l: "DAYS" },
      { v: String(h).padStart(2, "0"), l: "HRS" },
      { v: String(m).padStart(2, "0"), l: "MIN" },
      { v: String(s).padStart(2, "0"), l: "SEC" },
    ];
    const colW = W / 4;
    parts.forEach((p, i) => {
      const colCx = x + colW * i + colW / 2;
      ctx.fillStyle = "#E91976"; ctx.font = "900 68px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.v, colCx, y + 160);
      ctx.fillStyle = "rgba(255,255,255,0.40)"; ctx.font = "600 18px 'Inter',Arial,sans-serif";
      ctx.fillText(p.l, colCx, y + 190);
    });
    for (let i = 1; i < 4; i++) {
      const sx = x + colW * i;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(sx, y + 136, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, y + 162, 5, 0, Math.PI * 2); ctx.fill();
    }

  } else if (config.type === "link") {
    const label = config.displayText || config.url || "Visit Link";
    ctx.font = "bold 32px 'Inter',Arial,sans-serif";
    const W = Math.max(300, Math.min(580, ctx.measureText(label).width + 130));
    const H = 96;
    const x = cx - W / 2, y = cy - H / 2;
    shadow();
    canvasRoundRect(ctx, x, y, W, H, H / 2);
    ctx.fillStyle = "rgba(255,255,255,0.97)"; ctx.fill();
    noShadow();
    const ix = x + 42, iy = cy;
    ctx.strokeStyle = "#555"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(ix - 9, iy, 13, 9, -0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ix + 9, iy, 13, 9, -0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 32px 'Inter',Arial,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(truncateCanvas(ctx, label, W - 110), cx + 20, cy + 12);
  }

  ctx.restore();
}

const OVERLAY_BASE_COLORS = [
  { label: "Pink", r: 236, g: 72, b: 153 },
  { label: "Purple", r: 139, g: 92, b: 246 },
  { label: "Blue", r: 59, g: 130, b: 246 },
  { label: "Teal", r: 20, g: 184, b: 166 },
  { label: "Rose", r: 244, g: 63, b: 94 },
  { label: "Amber", r: 245, g: 158, b: 11 },
  { label: "Emerald", r: 16, g: 185, b: 129 },
  { label: "Black", r: 0, g: 0, b: 0 },
  { label: "White", r: 255, g: 255, b: 255 },
];

function makeOverlayRgba(color: { r: number; g: number; b: number }, opacity: number) {
  return `rgba(${color.r},${color.g},${color.b},${opacity.toFixed(2)})`;
}

type Step = "content" | "design" | "generate";

export default function Stories() {
  const [step, setStep] = useState<Step>("content");
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedBgs, setSelectedBgs] = useState<Set<string>>(new Set([STORY_BACKGROUNDS[0].file]));
  const [font, setFont] = useState(() => getBrandDefaults().fontFamily);
  const [subheadingFont, setSubheadingFont] = useState(() => getBrandDefaults().subheadingFont);
  const [fontSize, setFontSize] = useState(54);
  const [contentFontSize, setContentFontSize] = useState(44);
  const [textColor, setTextColor] = useState(() => getBrandDefaults().secondaryColor);
  const [overlayBaseColor, setOverlayBaseColor] = useState(OVERLAY_BASE_COLORS[0]);
  const [overlayOpacity, setOverlayOpacity] = useState(0.75);
  const [footerText, setFooterText] = useState("Type your answer in the comments");
  const [bgOpacity, setBgOpacity] = useState(0.7);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState(() => getBrandDefaults().logoDataUrl ?? "");
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
  const [logoSize, setLogoSize] = useState(120);
  const [textAlign, setTextAlign] = useState<TextAlign>("left");
  const [textBoxOutline, setTextBoxOutline] = useState(false);
  const [textBoxOutlineColor, setTextBoxOutlineColor] = useState("#ffffff");

  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("aesthetics");
  const [tone, setTone] = useState("warm & professional");
  const [topics, setTopics] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const [csvText, setCsvText] = useState("");
  const [manualQuestion, setManualQuestion] = useState("");

  const [previews, setPreviews] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [scheduleRendering, setScheduleRendering] = useState(false);
  const [animPhotoType, setAnimPhotoType] = useState<ReelAnimType>("photo-zoom");

  const [heroEnabled, setHeroEnabled] = useState(false);
  const [heroLeadIn, setHeroLeadIn] = useState("");
  const [heroWord, setHeroWord] = useState("");
  const [heroLeadInColor, setHeroLeadInColor] = useState("#E91976");
  const [heroWordColor, setHeroWordColor] = useState("#ffffff");
  const [heroWordFont, setHeroWordFont] = useState("'Bebas Neue', sans-serif");
  const [heroVerticalPosition, setHeroVerticalPosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [heroSpacing, setHeroSpacing] = useState(20);
  const [heroUppercase, setHeroUppercase] = useState(true);
  const [animRendering, setAnimRendering] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);

  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [ccWorkspaces, setCcWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedCcWorkspace, setSelectedCcWorkspace] = useState<string>("");

  type ToolId = "templates" | "photos" | "text" | "shapes" | "stickers" | "interactive" | "layers";
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const toggleTool = (id: ToolId) => setActiveTool((prev) => (prev === id ? null : id));

  const [stickerConfig, setStickerConfig] = useState<StickerConfig | null>(null);
  const [stickerPos, setStickerPos] = useState({ x: 0.5, y: 0.65 });
  const [isDraggingSticker, setIsDraggingSticker] = useState(false);
  const stickerPosRef = useRef({ x: 0.5, y: 0.65 });
  stickerPosRef.current = stickerPos;
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgCache = useRef<Record<string, HTMLImageElement>>({});
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const { presets, loading: presetsLoading, savePreset, updatePreset, deletePreset, uploadLogo } = usePresets();

  useEffect(() => { loadGoogleFonts(); }, []);

  useEffect(() => {
    fetch(api("/cloud-campaign/workspaces"), { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.workspaces) setCcWorkspaces(d.workspaces); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoUrl(url);
      const img = new Image();
      img.onload = () => { logoImgRef.current = img; };
      img.src = url;
      return () => URL.revokeObjectURL(url);
    } else {
      logoImgRef.current = null;
      setLogoUrl("");
      return undefined;
    }
  }, [logoFile]);

  const applyPreset = useCallback((preset: ClientPreset) => {
    setSelectedPresetId(preset.id);
    setFont(preset.fontFamily);
    setSubheadingFont(preset.subheadingFont || preset.fontFamily);
    setFontSize(preset.fontSize);
    setContentFontSize(preset.contentFontSize ?? 44);
    setTextColor(preset.textColor);
    setLogoPosition(preset.logoPosition);
    setLogoSize(preset.logoSize);
    if (preset.overlayColor) {
      const match = preset.overlayColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 0.75;
        const found = OVERLAY_BASE_COLORS.find((c) => c.r === r && c.g === g && c.b === b);
        if (found) setOverlayBaseColor(found);
        else setOverlayBaseColor({ label: "Custom", r, g, b });
        setOverlayOpacity(a);
      }
    }
    if (preset.logoUrl) {
      setCurrentLogoUrl(preset.logoUrl);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { logoImgRef.current = img; setLogoUrl(preset.logoUrl!); };
      img.src = preset.logoUrl;
    } else {
      setCurrentLogoUrl(null);
      setLogoUrl("");
      logoImgRef.current = null;
    }
    if (preset.ccWorkspaceId) {
      setSelectedCcWorkspace(preset.ccWorkspaceId);
    }
    setTextAlign(preset.textAlign || "left");
    setTextBoxOutline(preset.textBoxOutline ?? false);
    setTextBoxOutlineColor(preset.textBoxOutlineColor || "#ffffff");
    toast.success(`Loaded preset: ${preset.name}`);
  }, []);

  const getCurrentStyles = useCallback((): PresetStyleFields => ({
    pageColor: "#000000",
    overlayColor: makeOverlayRgba(overlayBaseColor, overlayOpacity),
    fontFamily: font,
    subheadingFont,
    fontSize,
    contentFontSize,
    textColor,
    lineSpacing: 1.15,
    cornerStyle: "none",
    cornerColor: "#d4af37",
    textPosition: "center",
    textAlign,
    textBoxOutline,
    textBoxOutlineColor,
    logoPosition,
    logoSize,
  }), [overlayBaseColor, overlayOpacity, font, subheadingFont, fontSize, contentFontSize, textColor, textAlign, textBoxOutline, textBoxOutlineColor, logoPosition, logoSize]);

  const loadBgImg = useCallback((file: string): Promise<HTMLImageElement> => {
    if (bgImgCache.current[file]) return Promise.resolve(bgImgCache.current[file]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { bgImgCache.current[file] = img; resolve(img); };
      img.onerror = reject;
      img.src = `${BASE}story-backgrounds/${file}`;
    });
  }, []);

  const toggleBg = useCallback((file: string) => {
    setSelectedBgs((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        if (next.size > 1) next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  const selectAllBgs = useCallback(() => {
    setSelectedBgs(new Set(STORY_BACKGROUNDS.map((b) => b.file)));
  }, []);

  const selectOneBg = useCallback((file: string) => {
    setSelectedBgs(new Set([file]));
  }, []);

  const generateAI = useCallback(async () => {
    if (!topics.trim()) { toast.error("Enter at least one topic"); return; }
    if (questionCount < 1) { toast.error("Question count must be at least 1"); return; }
    setGenerating(true);
    setProgress("Starting...");
    try {
      const storyPreset = presets.find((p) => p.id === selectedPresetId);
      const res = await fetch(api("/content/generate-story-questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          clientName, industry, tone,
          topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
          questionCount, extraInstructions,
          targetAudience: storyPreset?.targetAudience || undefined,
          contentPillars: storyPreset?.contentPillars || undefined,
          brandNotes: storyPreset?.brandNotes || undefined,
          voiceStyle: storyPreset?.voiceStyle || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `AI generation failed (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") setProgress(`Generating ${data.generated}/${data.total}...`);
            if (data.type === "complete" && data.questions) {
              setQuestions((prev) => [...prev, ...data.questions]);
              toast.success(`${data.questions.length} questions generated`);
            }
            if (data.type === "error") toast.error(data.message);
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [clientName, industry, tone, topics, questionCount, extraInstructions]);

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (results) => {
        const parsed = results.data.flat().filter((v: any) => typeof v === "string" && v.trim());
        setQuestions((prev) => [...prev, ...parsed as string[]]);
        toast.success(`${parsed.length} questions imported from CSV`);
      },
    });
    e.target.value = "";
  }, []);

  const handleCsvPaste = useCallback(() => {
    if (!csvText.trim()) return;
    const results = Papa.parse(csvText);
    const parsed = results.data.flat().filter((v: any) => typeof v === "string" && v.trim());
    setQuestions((prev) => [...prev, ...parsed as string[]]);
    toast.success(`${parsed.length} questions added`);
    setCsvText("");
  }, [csvText]);

  const addManual = useCallback(() => {
    if (!manualQuestion.trim()) return;
    const lines = manualQuestion.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setQuestions((prev) => [...prev, ...lines]);
    setManualQuestion("");
    toast.success(`${lines.length} question${lines.length > 1 ? "s" : ""} added`);
  }, [manualQuestion]);

  const removeQuestion = useCallback((idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const overlayColor = makeOverlayRgba(overlayBaseColor, overlayOpacity);
  const bgFilesKey = Array.from(selectedBgs).sort().join(",");
  const bgFiles = React.useMemo(() => Array.from(selectedBgs), [bgFilesKey]);

  const renderPreviews = useCallback(async () => {
    if (questions.length === 0) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = STORY_WIDTH * RENDER_SCALE;
      canvas.height = STORY_HEIGHT * RENDER_SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(RENDER_SCALE, RENDER_SCALE);
      const bgImgs = await Promise.all(bgFiles.map((f) => loadBgImg(f)));
      const shuffled = [...bgImgs];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      const urls: string[] = [];

      if (heroEnabled && (heroLeadIn.trim() || heroWord.trim())) {
        const heroBg = shuffled[0] ?? null;
        drawHeroSlide(ctx, heroBg, heroLeadIn, heroWord, heroLeadInColor, heroWordColor, heroWordFont, heroVerticalPosition, heroSpacing, heroUppercase, overlayColor, logoImgRef.current, logoPosition, logoSize, "#000000", "none", "#000000", { canvasW: STORY_WIDTH, canvasH: STORY_HEIGHT });
        urls.push(canvas.toDataURL("image/png"));
      }

      for (let i = 0; i < questions.length; i++) {
        const bgImg = shuffled[i % shuffled.length];
        const frameFontSize = i === 0 ? fontSize : contentFontSize;
        drawStory(ctx, bgImg, questions[i], font, frameFontSize, textColor, overlayColor, footerText, logoImgRef.current, logoPosition, logoSize, bgOpacity, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor);
        if (stickerConfig) {
          const cx = stickerPosRef.current.x * STORY_WIDTH;
          const cy = stickerPosRef.current.y * STORY_HEIGHT;
          drawInteractiveSticker(ctx, stickerConfig, cx, cy);
        }
        urls.push(canvas.toDataURL("image/png"));
      }
      setPreviews(urls);
      setPreviewIdx(0);
    } catch (err: any) {
      toast.error("Failed to render previews. Check your background image.");
    }
  }, [questions, bgFiles, font, subheadingFont, fontSize, contentFontSize, textColor, overlayColor, footerText, logoPosition, logoSize, bgOpacity, loadBgImg, textAlign, textBoxOutline, textBoxOutlineColor, heroEnabled, heroLeadIn, heroWord, heroLeadInColor, heroWordColor, heroWordFont, heroVerticalPosition, heroSpacing, heroUppercase, stickerConfig]);

  useEffect(() => {
    if (step === "design" && questions.length > 0) {
      const timer = setTimeout(renderPreviews, 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, renderPreviews, questions.length]);

  useEffect(() => {
    if (step === "generate" && questions.length > 0) {
      renderPreviews();
    }
  }, [step]);

  const saveStoryAsReel = async () => {
    if (!previews.length) { toast.error("Generate stories first"); return; }
    setAnimRendering(true); setAnimProgress(0);
    const toastId = toast.loading("Rendering reel…");
    try {
      const W = STORY_WIDTH; const H = STORY_HEIGHT;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const dataUrl = previews[previewIdx] ?? previews[0];
      const img = new Image();
      await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("img load failed")); img.src = dataUrl; });
      const animateFn = (_si: number, progress: number) => {
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        applyPhotoAnimation(ctx, img, { type: animPhotoType, startAt: 0, repeat: true }, progress, W, H);
        ctx.restore();
      };
      toast.loading("Encoding MP4… (~15 seconds)", { id: toastId });
      const mp4Blob = await recordReelVideoMp4(canvas, 5000, 0, 1, animateFn, 30, (pct) => setAnimProgress(pct));
      toast.loading("Uploading reel…", { id: toastId });
      const fd = new FormData();
      fd.append("video", mp4Blob, "story-reel.mp4");
      const uploadRes = await fetch(api("/content/upload-video"), { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { proxyUrl } = await uploadRes.json() as { proxyUrl: string; url: string };
      await fetch(api("/library"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, postType: "reel", caption: questions[previewIdx] || "", mediaUrl: proxyUrl, metadata: { source: "story-animate", photoAnim: animPhotoType } }),
      });
      toast.success("Reel saved to library!", { id: toastId });
    } catch (e: any) {
      toast.error("Rendering failed: " + (e?.message || "Unknown error"), { id: toastId });
    } finally { setAnimRendering(false); setAnimProgress(0); }
  };

  const downloadZip = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to download"); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("stories")!;
      for (let i = 0; i < previews.length; i++) {
        const data = previews[i].split(",")[1];
        folder.file(`story-${String(i + 1).padStart(2, "0")}.png`, data, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `stories-${clientName || "export"}-${Date.now()}.zip`);
      toast.success("ZIP downloaded");
      try {
        await fetch(api("/analytics/log"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "downloaded", postType: "story", clientName, postCount: previews.length }),
        });
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [previews, clientName]);

  const pushToCC = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to push"); return; }
    if (!selectedCcWorkspace) { toast.error("Please select a Cloud Campaign workspace first"); return; }
    setPushing(true);
    try {
      const allUploadResults: { name: string; url: string }[] = [];
      const batchSize = 5;
      const compressedPreviews = await Promise.all(previews.map(compressForUpload));
      for (let i = 0; i < compressedPreviews.length; i += batchSize) {
        const batch = compressedPreviews.slice(i, i + batchSize);
        const uploadRes = await fetch(api("/content/upload-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            images: batch.map((p, j) => ({ name: `story-${i + j + 1}.jpg`, base64: p })),
          }),
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { results } = await uploadRes.json();
        allUploadResults.push(...results);
      }

      const posts = previews.map((_, i) => ({
        title: `Story: ${questions[i]?.slice(0, 50) || `Story ${i + 1}`}`,
        caption: questions[i] || "",
        imageUrls: [allUploadResults[i]?.url].filter(Boolean),
      }));

      const pushRes = await fetch(api("/cloud-campaign/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ posts, workspaceIds: [selectedCcWorkspace], postType: "story" }),
      });
      if (!pushRes.ok) throw new Error("Push failed");
      const pushData = await pushRes.json();
      const wsName = ccWorkspaces.find((w) => w.id === selectedCcWorkspace)?.name || "selected workspace";
      toast.success(`Pushed ${pushData.summary?.succeeded || 0} stories to ${wsName}`);
    } catch (err: any) {
      toast.error(err.message || "Push failed");
    } finally {
      setPushing(false);
    }
  }, [previews, questions, selectedCcWorkspace, ccWorkspaces]);

  const pushToIG = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to push"); return; }
    if (!selectedPresetId) { toast.error("Please select a preset first"); return; }
    setPushing(true);
    const toastId = toast.loading(`Uploading ${previews.length} stor${previews.length === 1 ? "y" : "ies"}…`);
    try {
      const allUrls: string[] = [];
      const batchSize = 5;
      const compressedPreviews = await Promise.all(previews.map(compressForUpload));
      for (let i = 0; i < compressedPreviews.length; i += batchSize) {
        const batch = compressedPreviews.slice(i, i + batchSize);
        const uploadRes = await fetch(api("/content/upload-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            images: batch.map((p, j) => ({ name: `ig-story-${i + j + 1}.jpg`, base64: p })),
          }),
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { results } = await uploadRes.json() as { results: { url: string }[] };
        allUrls.push(...results.map((r) => r.url));
      }
      toast.loading(`Posting to Instagram Stories…`, { id: toastId });
      const pushRes = await fetch(api("/meta/push-story"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ presetId: selectedPresetId, imageUrls: allUrls, clientName }),
      });
      const pushData = await pushRes.json() as { summary?: { succeeded: number; failed: number }; error?: string };
      if (!pushRes.ok) throw new Error(pushData.error || "Push failed");
      const { succeeded = 0, failed = 0 } = pushData.summary ?? {};
      if (succeeded > 0 && failed === 0) {
        toast.success(`${succeeded} stor${succeeded === 1 ? "y" : "ies"} posted to Instagram!`, { id: toastId });
      } else if (succeeded > 0) {
        toast.warning(`${succeeded} posted, ${failed} failed`, { id: toastId });
      } else {
        toast.error("All stories failed to post", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Push to Instagram failed", { id: toastId });
    } finally {
      setPushing(false);
    }
  }, [previews, selectedPresetId, clientName]);

  const scheduleStories = useCallback(async () => {
    if (previews.length === 0) { toast.error("No stories to schedule"); return; }
    if (!selectedPresetId) { toast.error("Select a client preset first"); return; }
    setScheduleRendering(true);
    const id = toast.loading("Uploading stories for scheduling...");
    try {
      const allUploadResults: { name: string; url: string }[] = [];
      const batchSize = 5;
      const compressedPreviews = await Promise.all(previews.map(compressForUpload));
      for (let i = 0; i < compressedPreviews.length; i += batchSize) {
        const batch = compressedPreviews.slice(i, i + batchSize);
        const uploadRes = await fetch(api("/content/upload-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ images: batch.map((p, j) => ({ name: `story-sched-${i + j + 1}.jpg`, base64: p })) }),
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { results } = await uploadRes.json();
        allUploadResults.push(...results);
      }
      toast.dismiss(id);
      const posts: SchedulePostPayload[] = previews.map((_, i) => ({
        title: `Story: ${questions[i]?.slice(0, 50) || `Story ${i + 1}`}`,
        caption: questions[i] || "",
        imageUrls: [allUploadResults[i]?.url].filter(Boolean),
        musicTrack: musicTrack || undefined,
      }));
      setSchedulePosts(posts);
      setScheduleOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id });
    } finally {
      setScheduleRendering(false);
    }
  }, [previews, questions, selectedPresetId]);

  const exportCsv = useCallback(() => {
    if (questions.length === 0) return;
    const csv = Papa.unparse(questions.map((q) => [q]));
    const blob = new Blob([csv], { type: "text/csv" });
    saveAs(blob, `story-questions-${Date.now()}.csv`);
    toast.success("CSV exported");
  }, [questions]);

  const railTools = [
    {
      id: "templates" as ToolId,
      label: "Presets",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "photos" as ToolId,
      label: "Backgrounds",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      id: "text" as ToolId,
      label: "Text",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
    },
    {
      id: "shapes" as ToolId,
      label: "Overlay",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><polyline points="12 8 14.5 13 17 13 15 15.5 15.8 18 12 16.5 8.2 18 9 15.5 7 13 9.5 13 12 8" />
        </svg>
      ),
    },
    {
      id: "stickers" as ToolId,
      label: "Hero",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1 2 3.5 2 3.5-2 3.5-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" /><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
        </svg>
      ),
    },
    {
      id: "interactive" as ToolId,
      label: "Stickers",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="5" height="14" rx="1.5" fill={active ? "#E91976" : "white"} opacity={active ? 1 : 0.45}/>
          <rect x="10" y="2" width="5" height="18" rx="1.5" fill={active ? "#E91976" : "white"}/>
          <rect x="17" y="9" width="5" height="11" rx="1.5" fill={active ? "#E91976" : "white"} opacity={active ? 1 : 0.65}/>
          <line x1="2" y1="21" x2="22" y2="21" stroke={active ? "#E91976" : "#52525b"} strokeWidth="1.5"/>
        </svg>
      ),
    },
    {
      id: "layers" as ToolId,
      label: "Progress",
      icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-3 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/sms-logo.png" alt="Social Media Sister" className="h-10 w-10 rounded-full object-cover" />
          <Badge variant="secondary" className="bg-pink-500/15 text-pink-400 border border-pink-500/20 text-xs">Stories</Badge>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Link href="/hub"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><Layers className="w-3.5 h-3.5 mr-1.5" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><ImagePlus className="w-3.5 h-3.5 mr-1.5" />Single Image</Button></Link>
          <Link href="/reels"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><Film className="w-3.5 h-3.5 mr-1.5" />Reels</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><Palette className="w-3.5 h-3.5 mr-1.5" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><MessageSquareText className="w-3.5 h-3.5 mr-1.5" />Captions</Button></Link>
          <Link href="/library"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Library</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><CalendarDays className="w-3.5 h-3.5 mr-1.5" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground h-8 text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analytics</Button></Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left Rail (60px) */}
        <div style={{ width: 60, minWidth: 60 }} className="flex flex-col items-center py-3 gap-0.5 bg-[#0f0f0f] border-r border-zinc-800/60 shrink-0 z-10">
          {railTools.map(({ id, label, icon }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => toggleTool(id)}
                className="flex flex-col items-center gap-1 py-3 px-1 w-full transition-colors relative group"
                style={{ backgroundColor: isActive ? "rgba(233,25,118,0.09)" : undefined }}
              >
                {isActive && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#E91976]" />}
                {icon(isActive)}
                <span className="text-[9px] font-semibold tracking-wide uppercase" style={{ color: isActive ? "#E91976" : "#52525b" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slide-out Panel (260px) */}
        <div
          style={{
            width: activeTool ? 260 : 0,
            minWidth: activeTool ? 260 : 0,
            transition: "width 180ms cubic-bezier(0.4,0,0.2,1), min-width 180ms cubic-bezier(0.4,0,0.2,1)",
          }}
          className="bg-[#161616] border-r border-zinc-800/60 flex flex-col shrink-0 overflow-hidden z-10"
        >
          {activeTool && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
                <span className="text-sm font-semibold text-white capitalize">
                  {activeTool === "templates" ? "Presets" : activeTool === "photos" ? "Backgrounds" : activeTool === "shapes" ? "Overlay" : activeTool === "stickers" ? "Hero Slide" : activeTool === "interactive" ? "Interactive Sticker" : activeTool === "layers" ? "Progress" : "Text"}
                </span>
                <button onClick={() => setActiveTool(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-700/60 transition-colors">
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">

                {/* Presets */}
                {activeTool === "templates" && (
                  <div className="space-y-3">
                    <PresetSelector
                      presets={presets}
                      loading={presetsLoading}
                      selectedPresetId={selectedPresetId}
                      onSelectPreset={applyPreset}
                      onSavePreset={async (name, styles, ccWs, logoUrl, footnote) => { await savePreset(name, styles, ccWs, logoUrl, footnote); }}
                      onUpdatePreset={async (id, name, styles, ccWs, logoUrl, footnote) => { await updatePreset(id, name, styles, ccWs, logoUrl, footnote); }}
                      onDeletePreset={async (id) => { await deletePreset(id); if (selectedPresetId === id) setSelectedPresetId(null); }}
                      getCurrentStyles={getCurrentStyles}
                      logoFile={logoFile}
                      uploadLogo={uploadLogo}
                      currentLogoUrl={currentLogoUrl}
                    />
                  </div>
                )}

                {/* Backgrounds */}
                {activeTool === "photos" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{selectedBgs.size} selected</p>
                      <button onClick={selectAllBgs} className="text-xs text-pink-400 hover:text-pink-300 transition-colors">Use All</button>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">Click to toggle. Double-click to use only that one. Multiple backgrounds rotate across stories.</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STORY_BACKGROUNDS.map((bg) => {
                        const isSelected = selectedBgs.has(bg.file);
                        return (
                          <button
                            key={bg.file}
                            onClick={() => toggleBg(bg.file)}
                            onDoubleClick={() => selectOneBg(bg.file)}
                            className={`relative aspect-[9/16] rounded-md overflow-hidden border transition-all ${isSelected ? "border-pink-500 ring-1 ring-pink-500/40" : "border-zinc-700/50 opacity-50 hover:opacity-80"}`}
                          >
                            <img src={`${BASE}story-backgrounds/${bg.file}`} alt={bg.label} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-400">Background opacity</p>
                        <span className="text-xs text-zinc-300 font-semibold tabular-nums">{Math.round(bgOpacity * 100)}%</span>
                      </div>
                      <Slider value={[bgOpacity * 100]} onValueChange={(v) => setBgOpacity(v[0] / 100)} min={20} max={100} step={5} />
                    </div>
                  </div>
                )}

                {/* Text */}
                {activeTool === "text" && (
                  <div className="space-y-4">
                    <FontSwitcher
                      headingFont={font}
                      onHeadingChange={setFont}
                      onBodyChange={setSubheadingFont}
                    />
                    <div className="border-t border-zinc-800/60 pt-3 space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Heading font</p>
                      <Select value={font} onValueChange={setFont}>
                        <SelectTrigger className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Subheading font</p>
                      <Select value={subheadingFont} onValueChange={setSubheadingFont}>
                        <SelectTrigger className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">First frame size</p>
                        <span className="text-xs text-zinc-300 font-semibold tabular-nums">{fontSize}px</span>
                      </div>
                      <Slider value={[fontSize]} onValueChange={(v) => setFontSize(v[0])} min={28} max={80} step={2} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Remaining frames</p>
                        <span className="text-xs text-zinc-300 font-semibold tabular-nums">{contentFontSize}px</span>
                      </div>
                      <Slider value={[contentFontSize]} onValueChange={(v) => setContentFontSize(v[0])} min={28} max={80} step={2} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Text colour</p>
                      <div className="flex gap-2">
                        <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-zinc-700/50 bg-transparent" />
                        <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-7 text-xs font-mono bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Alignment</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(["left", "center", "right"] as const).map((a) => (
                          <button key={a} onClick={() => setTextAlign(a)}
                            className={`py-1.5 rounded text-xs font-semibold capitalize transition-all ${textAlign === a ? "bg-[#E91976] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                            {a === "center" ? "Centre" : a.charAt(0).toUpperCase() + a.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Box outline</p>
                        <button onClick={() => setTextBoxOutline((v) => !v)}
                          className={`relative w-9 h-4.5 rounded-full transition-colors ${textBoxOutline ? "bg-pink-500" : "bg-zinc-600"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${textBoxOutline ? "translate-x-4" : ""}`} />
                        </button>
                      </div>
                      {textBoxOutline && (
                        <div className="flex gap-2 mt-1">
                          <input type="color" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-zinc-700/50 bg-transparent" />
                          <Input value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="flex-1 h-7 text-xs font-mono bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                )}

                {/* Overlay */}
                {activeTool === "shapes" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Overlay colour</p>
                      <div className="flex flex-wrap gap-1.5">
                        {OVERLAY_BASE_COLORS.map((c) => (
                          <button
                            key={c.label}
                            onClick={() => setOverlayBaseColor(c)}
                            title={c.label}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${overlayBaseColor.label === c.label ? "border-white scale-110" : "border-transparent hover:border-white/40"}`}
                            style={{ background: `rgb(${c.r},${c.g},${c.b})` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Overlay opacity</p>
                        <span className="text-xs text-zinc-300 font-semibold tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <Slider value={[overlayOpacity * 100]} onValueChange={(v) => setOverlayOpacity(v[0] / 100)} min={20} max={100} step={5} />
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Footer text</p>
                      <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" placeholder="Type your answer in the comments" />
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Logo (optional)</p>
                      <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-400" />
                      {logoUrl && (
                        <div className="space-y-2 pt-1">
                          <img src={logoUrl} alt="Logo" className="h-8 object-contain rounded" />
                          <div className="grid grid-cols-2 gap-1">
                            {LOGO_POSITIONS.map((p) => (
                              <button key={p.value} onClick={() => setLogoPosition(p.value)}
                                className={`py-1 rounded text-[10px] font-semibold transition-all ${logoPosition === p.value ? "bg-[#E91976] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-zinc-500">Logo size</p>
                            <span className="text-[10px] text-zinc-300 tabular-nums">{logoSize}px</span>
                          </div>
                          <Slider value={[logoSize]} onValueChange={(v) => setLogoSize(v[0])} min={40} max={200} step={10} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Hero Slide */}
                {activeTool === "stickers" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Hero title slide</p>
                      <button onClick={() => setHeroEnabled((v) => !v)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${heroEnabled ? "bg-pink-500" : "bg-zinc-600"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${heroEnabled ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">Prepends a bold impact slide to the start of your story set.</p>
                    {heroEnabled && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Lead-in text</p>
                          <Input value={heroLeadIn} onChange={(e) => setHeroLeadIn(e.target.value)} placeholder="This week I'm talking about" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Hero word</p>
                          <Input value={heroWord} onChange={(e) => setHeroWord(e.target.value)} placeholder="BOTOX" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Hero font</p>
                          <Select value={heroWordFont} onValueChange={setHeroWordFont}>
                            <SelectTrigger className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-60">{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1.5 flex-1">
                            <p className="text-[10px] text-zinc-500">Lead-in</p>
                            <input type="color" value={heroLeadInColor} onChange={(e) => setHeroLeadInColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-zinc-700/50 bg-transparent" />
                          </div>
                          <div className="flex items-center gap-1.5 flex-1">
                            <p className="text-[10px] text-zinc-500">Word</p>
                            <input type="color" value={heroWordColor} onChange={(e) => setHeroWordColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-zinc-700/50 bg-transparent" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Position</p>
                          <div className="grid grid-cols-3 gap-1">
                            {(["top", "middle", "bottom"] as const).map((pos) => (
                              <button key={pos} onClick={() => setHeroVerticalPosition(pos)}
                                className={`py-1 rounded text-[10px] font-semibold capitalize transition-all ${heroVerticalPosition === pos ? "bg-[#E91976] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                                {pos}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Spacing</p>
                            <span className="text-[10px] text-zinc-300 tabular-nums">{heroSpacing}px</span>
                          </div>
                          <Slider value={[heroSpacing]} onValueChange={([v]) => setHeroSpacing(v)} min={0} max={80} step={4} />
                        </div>
                        <button onClick={() => setHeroUppercase((v) => !v)}
                          className={`w-full py-1.5 rounded text-xs font-semibold transition-all ${heroUppercase ? "bg-[#E91976] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                          ALL CAPS
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Sticker */}
                {activeTool === "interactive" && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Choose a sticker type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { type: "poll" as const, label: "Poll", icon: <BarChart3 className="w-4 h-4" />, desc: "Two options" },
                        { type: "question" as const, label: "Question", icon: <MessageSquareText className="w-4 h-4" />, desc: "Open prompt" },
                        { type: "countdown" as const, label: "Countdown", icon: <Clock className="w-4 h-4" />, desc: "Event timer" },
                        { type: "link" as const, label: "Link", icon: <Link2 className="w-4 h-4" />, desc: "URL or CTA" },
                      ]).map(({ type, label, icon, desc }) => {
                        const isActive = stickerConfig?.type === type;
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              if (isActive) { setStickerConfig(null); return; }
                              if (type === "poll") setStickerConfig({ type: "poll", question: "Which do you prefer?", optionA: "Option A", optionB: "Option B" });
                              else if (type === "question") setStickerConfig({ type: "question", prompt: "Ask me anything" });
                              else if (type === "countdown") {
                                const d = new Date(); d.setDate(d.getDate() + 7);
                                setStickerConfig({ type: "countdown", eventName: "Coming soon", endDate: d.toISOString().slice(0, 16) });
                              }
                              else setStickerConfig({ type: "link", url: "https://", displayText: "Learn more" });
                            }}
                            className={`rounded-xl border text-left p-2.5 transition-all ${isActive ? "border-pink-500/60 bg-pink-500/15" : "border-zinc-700/40 bg-zinc-800/50 hover:bg-zinc-700/50"}`}
                          >
                            <div className={`mb-1 ${isActive ? "text-pink-400" : "text-zinc-400"}`}>{icon}</div>
                            <p className="text-xs font-semibold text-zinc-200">{label}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {stickerConfig?.type === "poll" && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Question</p>
                          <Input value={stickerConfig.question} onChange={(e) => setStickerConfig({ ...stickerConfig, question: e.target.value })} placeholder="Which do you prefer?" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Option A</p>
                            <Input value={stickerConfig.optionA} onChange={(e) => setStickerConfig({ ...stickerConfig, optionA: e.target.value })} placeholder="Option A" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Option B</p>
                            <Input value={stickerConfig.optionB} onChange={(e) => setStickerConfig({ ...stickerConfig, optionB: e.target.value })} placeholder="Option B" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                          </div>
                        </div>
                      </div>
                    )}

                    {stickerConfig?.type === "question" && (
                      <div className="space-y-1 pt-2 border-t border-zinc-800/60">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Prompt text</p>
                        <Input value={stickerConfig.prompt} onChange={(e) => setStickerConfig({ ...stickerConfig, prompt: e.target.value })} placeholder="Ask me anything" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                      </div>
                    )}

                    {stickerConfig?.type === "countdown" && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Event name</p>
                          <Input value={stickerConfig.eventName} onChange={(e) => setStickerConfig({ ...stickerConfig, eventName: e.target.value })} placeholder="Coming soon" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">End date &amp; time</p>
                          <Input type="datetime-local" value={stickerConfig.endDate} onChange={(e) => setStickerConfig({ ...stickerConfig, endDate: e.target.value })} className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                      </div>
                    )}

                    {stickerConfig?.type === "link" && (
                      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">URL</p>
                          <Input value={stickerConfig.url} onChange={(e) => setStickerConfig({ ...stickerConfig, url: e.target.value })} placeholder="https://example.com" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Display text</p>
                          <Input value={stickerConfig.displayText} onChange={(e) => setStickerConfig({ ...stickerConfig, displayText: e.target.value })} placeholder="Learn more" className="h-8 text-xs bg-zinc-800/60 border-zinc-700/50 text-zinc-200" />
                        </div>
                      </div>
                    )}

                    {stickerConfig && (
                      <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                        <p className="text-[10px] text-zinc-500 leading-relaxed">Drag the sticker in the right preview to position it, then click Refresh to re-bake.</p>
                        <button
                          onClick={() => setStickerConfig(null)}
                          className="w-full py-1.5 rounded text-xs font-semibold text-red-400 hover:bg-red-900/20 transition-colors border border-red-900/30"
                        >
                          Remove sticker
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress */}
                {activeTool === "layers" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Progress</p>
                    <div className="space-y-1.5">
                      {([
                        { key: "content" as Step, num: 1, label: "Content", done: questions.length > 0 },
                        { key: "design" as Step, num: 2, label: "Design", done: step === "generate" },
                        { key: "generate" as Step, num: 3, label: "Generate", done: previews.length > 0 },
                      ]).map(({ key, num, label, done }) => (
                        <button
                          key={key}
                          onClick={() => {
                            if (key !== "content" && questions.length === 0) { toast.error("Add some questions first"); return; }
                            setStep(key);
                          }}
                          className="w-full flex items-center gap-2 rounded bg-zinc-800/50 border border-zinc-700/30 px-3 py-1.5 hover:bg-zinc-700/50 transition-colors"
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-500/20 border border-green-500/40" : step === key ? "bg-pink-500/20 border border-pink-500/40" : "border border-zinc-600"}`}>
                            {done && <Check className="w-2.5 h-2.5 text-green-400" />}
                            {!done && step === key && <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />}
                          </div>
                          <span className="text-xs text-zinc-300">{num}. {label}</span>
                          {key === "content" && questions.length > 0 && (
                            <span className="ml-auto text-[10px] text-zinc-500 tabular-nums">{questions.length}q</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {questions.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/60">
                        <p className="text-xs text-zinc-500">{questions.length} question{questions.length !== 1 ? "s" : ""} ready</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </div>

        {/* Editing area + right preview */}
        <div className="flex-1 flex min-h-0">

          {/* Editing area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Compact step-tab strip */}
            <div className="h-12 border-b border-border/30 bg-background/80 backdrop-blur flex items-center px-4 gap-1 shrink-0 overflow-x-auto">
              {([
                { key: "content" as Step, num: 1, label: "Content", icon: Sparkles },
                { key: "design" as Step, num: 2, label: "Design", icon: Palette },
                { key: "generate" as Step, num: 3, label: "Generate", icon: Download },
              ]).map((s, i) => {
                const isActive = step === s.key;
                const isDone = (s.key === "content" && (step === "design" || step === "generate")) ||
                               (s.key === "design" && step === "generate");
                return (
                  <React.Fragment key={s.key}>
                    <button
                      onClick={() => {
                        if (s.key !== "content" && questions.length === 0) { toast.error("Add some questions first"); return; }
                        setStep(s.key);
                      }}
                      className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                        isActive ? "bg-pink-500 text-white" : isDone ? "bg-green-500/15 text-green-400 border border-green-500/30" : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                      {s.num}. {s.label}
                    </button>
                    {i < 2 && <span className="text-zinc-700 text-xs shrink-0">›</span>}
                  </React.Fragment>
                );
              })}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
                {step === "design" && (
                  <button onClick={renderPreviews} className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors">
                    <Sparkles className="w-3 h-3" /> Refresh
                  </button>
                )}
                {previews.length > 0 && (
                  <button onClick={downloadZip} disabled={downloading} className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#E91976] text-white text-xs font-bold hover:bg-pink-600 transition-colors disabled:opacity-60">
                    {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Download ZIP
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable step content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-6 py-8 pb-32 flex flex-col gap-8">

                {/* Step 1: Content */}
                {step === "content" && (
                  <>
                    <div>
                      <h2 className="font-sans text-3xl font-semibold mb-2 tracking-tight">Step 1: Your Questions</h2>
                      <p className="text-base text-muted-foreground">Add engagement questions via AI, CSV, or by hand. Each question becomes one story frame.</p>
                    </div>

                    <div className="rounded-2xl border border-pink-500/20 bg-card/50 p-6 space-y-4">
                      <h3 className="text-base font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-400" />AI Question Generator</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm mb-1.5 block">Client Name</Label>
                          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Skin Clinic London" />
                        </div>
                        <div>
                          <Label className="text-sm mb-1.5 block">Industry</Label>
                          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm mb-1.5 block">Tone</Label>
                          <Input value={tone} onChange={(e) => setTone(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-sm mb-1.5 block">Number of Questions</Label>
                          <Input type="number" min={1} max={60} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Topics (comma-separated)</Label>
                        <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="skincare, treatments, wellness tips" />
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Extra Instructions (optional)</Label>
                        <Textarea value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} rows={2} placeholder="Any specific style or requirements..." />
                      </div>
                      <Button onClick={generateAI} disabled={generating} className="w-full">
                        {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Questions</>}
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-3">
                      <h3 className="text-base font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-purple-400" />Import from CSV</h3>
                      <Input type="file" accept=".csv" onChange={handleCsvUpload} />
                      <div className="text-xs text-muted-foreground text-center">or paste CSV text below</div>
                      <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={3} placeholder={"Question 1\nQuestion 2\nQuestion 3"} />
                      <Button variant="outline" onClick={handleCsvPaste} disabled={!csvText.trim()} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />Import Pasted Questions
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-3">
                      <h3 className="text-base font-semibold flex items-center gap-2"><PenTool className="w-4 h-4 text-cyan-400" />Add Manually</h3>
                      <Textarea value={manualQuestion} onChange={(e) => setManualQuestion(e.target.value)} placeholder="Type one question per line..." rows={4} />
                      <Button onClick={addManual} disabled={!manualQuestion.trim()} className="w-full" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />Add Questions
                      </Button>
                    </div>

                    {questions.length > 0 && (
                      <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold">Questions ({questions.length})</h3>
                          <Button variant="ghost" size="sm" className="text-red-400 text-xs" onClick={() => setQuestions([])}>Clear All</Button>
                        </div>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                          {questions.map((q, i) => (
                            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 border border-border/20 group">
                              <span className="text-xs text-muted-foreground w-5 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                              <span className="text-sm flex-1">{q}</span>
                              <button onClick={() => removeQuestion(i)} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300 shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pt-2">
                          <Button onClick={() => { setStep("design"); renderPreviews(); }} className="px-8 py-5 text-base font-semibold" size="lg">
                            Next: Design <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Step 2: Design */}
                {step === "design" && (
                  <>
                    <div>
                      <h2 className="font-sans text-3xl font-semibold mb-2 tracking-tight">Step 2: Design</h2>
                      <p className="text-base text-muted-foreground">Customise your stories using the tools in the left rail. Changes update the live preview on the right.</p>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick access</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {(["templates","photos","text","shapes","stickers","interactive"] as ToolId[]).map((id) => {
                          const meta: Record<ToolId, { label: string; desc: string }> = {
                            templates: { label: "Brand Presets", desc: "Load saved brand styles" },
                            photos: { label: "Backgrounds", desc: "Pick story backgrounds" },
                            text: { label: "Text & Fonts", desc: "Fonts, sizes, colours" },
                            shapes: { label: "Overlay", desc: "Colour, opacity, footer" },
                            stickers: { label: "Hero Slide", desc: "Bold intro slide" },
                            interactive: { label: "Interactive Sticker", desc: "Poll, question, countdown, link" },
                            layers: { label: "Progress", desc: "" },
                          };
                          const { label, desc } = meta[id];
                          const isActive = activeTool === id;
                          return (
                            <button key={id} onClick={() => toggleTool(id)}
                              className={`rounded-xl border text-left p-3 transition-all ${isActive ? "border-pink-500/50 bg-pink-500/10" : id === "interactive" ? "border-pink-500/20 bg-pink-950/20 hover:border-pink-500/40" : "border-border/30 bg-background/50 hover:border-border/60"}`}>
                              <p className="text-sm font-semibold">{label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Sticker inline card */}
                    <div className="rounded-2xl border border-pink-500/30 bg-pink-950/10 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-pink-300 uppercase tracking-wider flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="6" width="5" height="14" rx="1.5" fill="#f9a8d4" opacity="0.6"/>
                            <rect x="10" y="2" width="5" height="18" rx="1.5" fill="#f9a8d4"/>
                            <rect x="17" y="9" width="5" height="11" rx="1.5" fill="#f9a8d4" opacity="0.8"/>
                          </svg>
                          Interactive Sticker
                        </h3>
                        {stickerConfig && (
                          <button onClick={() => setStickerConfig(null)} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors">Remove</button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">Add a sticker that bakes into every exported story frame. Drag to reposition in the right preview.</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["poll","question","countdown","link"] as const).map((t) => {
                          const labels = { poll: "Poll", question: "Question Box", countdown: "Countdown", link: "Link" };
                          const isActive = stickerConfig?.type === t;
                          return (
                            <button key={t} onClick={() => {
                              if (isActive) { setStickerConfig(null); return; }
                              if (t === "poll") setStickerConfig({ type: "poll", question: "Which do you prefer?", optionA: "This", optionB: "That" });
                              else if (t === "question") setStickerConfig({ type: "question", prompt: "Ask me anything" });
                              else if (t === "countdown") setStickerConfig({ type: "countdown", eventName: "Coming soon", endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16) });
                              else setStickerConfig({ type: "link", url: "", displayText: "" });
                            }}
                            className={`rounded-xl border py-2 px-3 text-xs font-semibold transition-all text-left ${isActive ? "border-pink-500 bg-pink-500/20 text-pink-300" : "border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600"}`}>
                              {labels[t]}
                            </button>
                          );
                        })}
                      </div>

                      {stickerConfig?.type === "poll" && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Question</p>
                            <input value={stickerConfig.question} onChange={(e) => setStickerConfig({ ...stickerConfig, question: e.target.value })} placeholder="Which do you prefer?" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Option A</p>
                              <input value={stickerConfig.optionA} onChange={(e) => setStickerConfig({ ...stickerConfig, optionA: e.target.value })} placeholder="Option A" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Option B</p>
                              <input value={stickerConfig.optionB} onChange={(e) => setStickerConfig({ ...stickerConfig, optionB: e.target.value })} placeholder="Option B" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                            </div>
                          </div>
                        </div>
                      )}

                      {stickerConfig?.type === "question" && (
                        <div className="pt-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Prompt text</p>
                          <input value={stickerConfig.prompt} onChange={(e) => setStickerConfig({ ...stickerConfig, prompt: e.target.value })} placeholder="Ask me anything" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                        </div>
                      )}

                      {stickerConfig?.type === "countdown" && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Event name</p>
                            <input value={stickerConfig.eventName} onChange={(e) => setStickerConfig({ ...stickerConfig, eventName: e.target.value })} placeholder="Coming soon" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">End date &amp; time</p>
                            <input type="datetime-local" value={stickerConfig.endDate} onChange={(e) => setStickerConfig({ ...stickerConfig, endDate: e.target.value })} className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                          </div>
                        </div>
                      )}

                      {stickerConfig?.type === "link" && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">URL</p>
                            <input value={stickerConfig.url} onChange={(e) => setStickerConfig({ ...stickerConfig, url: e.target.value })} placeholder="https://example.com" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Display text</p>
                            <input value={stickerConfig.displayText} onChange={(e) => setStickerConfig({ ...stickerConfig, displayText: e.target.value })} placeholder="Learn more" className="w-full h-8 rounded-lg border border-zinc-700/50 bg-zinc-800/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500/50" />
                          </div>
                        </div>
                      )}

                      {stickerConfig && (
                        <button onClick={renderPreviews} className="w-full rounded-xl border border-pink-500/30 bg-pink-500/10 py-2 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 transition-colors flex items-center justify-center gap-1.5">
                          <Sparkles className="w-3 h-3" /> Apply to Preview
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setStep("content")} className="px-8 py-5 text-base font-semibold" size="lg">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button onClick={() => { renderPreviews(); setStep("generate"); }} className="px-8 py-5 text-base font-semibold" size="lg">
                        Next: Generate <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: Generate */}
                {step === "generate" && (
                  <>
                    <div>
                      <h2 className="font-sans text-3xl font-semibold mb-2 tracking-tight">Step 3: Export</h2>
                      <p className="text-base text-muted-foreground">
                        {previews.length > 0 ? `${previews.length} stor${previews.length === 1 ? "y" : "ies"} ready.` : "Rendering your stories…"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-card/50 p-5 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={exportCsv}>
                        <FileText className="w-3.5 h-3.5 mr-1.5" />Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setMusicPickerOpen(true)} className={musicTrack ? "border-green-500/40 text-green-300 hover:bg-green-950/30" : ""}>
                        <Music className="w-3.5 h-3.5 mr-1.5" />{musicTrack ? musicTrack.name.slice(0, 18) : "Add music"}
                      </Button>
                      <Select value={animPhotoType} onValueChange={(v) => setAnimPhotoType(v as ReelAnimType)}>
                        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(REEL_ANIM_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={saveStoryAsReel} disabled={animRendering || previews.length === 0} variant="outline" className="border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                        {animRendering ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{Math.round(animProgress * 100)}%</> : <><Film className="w-3.5 h-3.5 mr-1.5" />Animate as Reel</>}
                      </Button>
                      {ccWorkspaces.length > 0 && (
                        <Select value={selectedCcWorkspace || "__none__"} onValueChange={(v) => setSelectedCcWorkspace(v === "__none__" ? "" : v)}>
                          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-muted-foreground">Select workspace</SelectItem>
                            {ccWorkspaces.map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="sm" onClick={pushToCC} disabled={pushing || previews.length === 0 || !selectedCcWorkspace} variant="secondary">
                        {pushing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 mr-1.5" />}
                        Push to CC
                      </Button>
                      {selectedPresetId && (
                        <>
                          <Button size="sm" onClick={pushToIG} disabled={pushing || previews.length === 0} variant="outline" className="border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                            {pushing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 mr-1.5" />}
                            Push to IG Story
                          </Button>
                          <Button size="sm" onClick={scheduleStories} disabled={scheduleRendering || previews.length === 0} variant="outline" className="border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                            {scheduleRendering ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5 mr-1.5" />}
                            {scheduleRendering ? "Preparing..." : "Schedule"}
                          </Button>
                        </>
                      )}
                    </div>

                    {previews.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {previews.map((p, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-border/30 bg-card">
                            <img src={p} alt={`Story ${i + 1}`} className="w-full aspect-[9/16] object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                              <p className="text-[10px] text-white/80 line-clamp-2">{questions[i]}</p>
                            </div>
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full tabular-nums">{i + 1}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-muted-foreground">
                        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                        <p>Rendering previews…</p>
                      </div>
                    )}

                    <div className="flex justify-start pt-2">
                      <Button variant="outline" onClick={() => setStep("design")} className="px-6 py-4 text-sm font-semibold">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Design
                      </Button>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>

          {/* Right sticky story preview */}
          <div className="w-[200px] shrink-0 border-l border-zinc-800/60 bg-[#0f0f0f] flex flex-col items-center justify-start py-5 px-3 gap-3 overflow-y-auto">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600 self-start">Preview</p>
            {previews.length > 0 ? (
              <>
                <div
                  ref={previewContainerRef}
                  className="relative w-full select-none"
                  style={{ aspectRatio: "9/16", cursor: isDraggingSticker ? "grabbing" : "default" }}
                  onPointerMove={(e) => {
                    if (!isDraggingSticker) return;
                    const rect = previewContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setStickerPos({
                      x: Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width)),
                      y: Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height)),
                    });
                  }}
                  onPointerUp={() => {
                    if (isDraggingSticker) { setIsDraggingSticker(false); renderPreviews(); }
                  }}
                  onPointerLeave={() => {
                    if (isDraggingSticker) { setIsDraggingSticker(false); renderPreviews(); }
                  }}
                >
                  <img
                    src={previews[previewIdx]}
                    alt={`Story ${previewIdx + 1}`}
                    className="w-full h-full rounded-lg object-cover shadow-xl"
                    draggable={false}
                  />
                  {stickerConfig && (
                    <div
                      className="absolute z-10 touch-none"
                      style={{
                        left: `${stickerPos.x * 100}%`,
                        top: `${stickerPos.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        cursor: isDraggingSticker ? "grabbing" : "grab",
                        opacity: isDraggingSticker ? 0.85 : 1,
                        filter: isDraggingSticker ? "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" : undefined,
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsDraggingSticker(true);
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    >
                      {stickerConfig.type === "poll" && (
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ width: 136 }}>
                          <div className="px-2.5 pt-2 pb-1">
                            <p className="text-center text-[7px] text-gray-400 font-semibold uppercase tracking-wider">POLL</p>
                            <p className="text-center text-[10px] font-bold text-gray-800 leading-tight mt-0.5 line-clamp-2">{stickerConfig.question}</p>
                          </div>
                          <div className="flex gap-1 px-2 pb-2">
                            <div className="flex-1 rounded-xl bg-pink-50 border border-pink-300 py-1 text-center text-[8px] font-bold text-pink-600 truncate px-1">{stickerConfig.optionA || "A"}</div>
                            <div className="flex-1 rounded-xl bg-purple-50 border border-purple-300 py-1 text-center text-[8px] font-bold text-purple-600 truncate px-1">{stickerConfig.optionB || "B"}</div>
                          </div>
                        </div>
                      )}
                      {stickerConfig.type === "question" && (
                        <div className="rounded-2xl shadow-xl overflow-hidden" style={{ width: 132, background: "#fffbdc" }}>
                          <div className="px-2.5 py-2">
                            <p className="text-[7px] text-amber-500 font-semibold uppercase tracking-wider">ASK ME A QUESTION</p>
                            <p className="text-[10px] font-bold text-amber-900 mt-0.5 line-clamp-2">{stickerConfig.prompt}</p>
                            <div className="mt-1.5 h-3 rounded-full bg-amber-200/60" />
                          </div>
                        </div>
                      )}
                      {stickerConfig.type === "countdown" && (() => {
                        const diff = Math.max(0, new Date(stickerConfig.endDate).getTime() - Date.now());
                        const parts = [
                          { v: String(Math.floor(diff / 86400000)).padStart(2, "0"), l: "D" },
                          { v: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"), l: "H" },
                          { v: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"), l: "M" },
                          { v: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"), l: "S" },
                        ];
                        return (
                          <div className="rounded-2xl shadow-xl text-center" style={{ width: 136, background: "rgba(10,10,20,0.95)", borderTop: "3px solid #E91976" }}>
                            <p className="text-[9px] font-semibold text-white pt-2 px-2 truncate">{stickerConfig.eventName}</p>
                            <div className="flex justify-center gap-1.5 px-2 py-2">
                              {parts.map((p) => (
                                <div key={p.l} className="flex flex-col items-center">
                                  <span className="text-[14px] font-black text-[#E91976] tabular-nums leading-none">{p.v}</span>
                                  <span className="text-[7px] text-zinc-500">{p.l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {stickerConfig.type === "link" && (
                        <div className="bg-white rounded-full shadow-xl flex items-center gap-1.5 px-3 py-1.5" style={{ maxWidth: 136 }}>
                          <Link2 className="w-3 h-3 text-gray-500 shrink-0" />
                          <span className="text-[9px] font-semibold text-gray-700 truncate">{stickerConfig.displayText || stickerConfig.url || "Link"}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-3 py-1 z-20">
                    <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))} disabled={previewIdx === 0} className="text-white disabled:opacity-30 transition-opacity">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-white font-medium tabular-nums">{previewIdx + 1}/{previews.length}</span>
                    <button onClick={() => setPreviewIdx(Math.min(previews.length - 1, previewIdx + 1))} disabled={previewIdx >= previews.length - 1} className="text-white disabled:opacity-30 transition-opacity">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {questions[previewIdx] && (
                  <p className="text-[10px] text-zinc-500 text-center leading-relaxed line-clamp-3">{questions[previewIdx]}</p>
                )}
                <button onClick={renderPreviews} className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1 mt-1">
                  <Sparkles className="w-3 h-3" /> Refresh
                </button>
              </>
            ) : (
              <div className="w-full flex flex-col items-center justify-center" style={{ aspectRatio: "9/16" }}>
                <div className="w-full h-full rounded-lg border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-2 text-zinc-700">
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p className="text-[9px] text-center px-2">Add questions and move to Design to preview</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <canvas ref={canvasRef} width={STORY_WIDTH} height={STORY_HEIGHT} className="hidden" />
      <MusicPickerModal open={musicPickerOpen} onClose={() => setMusicPickerOpen(false)} selectedTrack={musicTrack} onSelect={(t) => setMusicTrack(t)} />
      {scheduleOpen && selectedPresetId && (
        <ScheduleModal
          presetId={selectedPresetId}
          postType="story"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}
