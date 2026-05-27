import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, ImagePlus, BookOpen, Film, Palette, MessageSquareText,
  CalendarDays, BarChart3, Loader2, Download, User, Grid, X, RotateCcw, Music,
} from "lucide-react";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";

// ─── Constants ─────────────────────────────────────────────────────────────────
const ALL_FONTS = [
  { label: "Allura", value: "Allura", cat: "Script" },
  { label: "Great Vibes", value: "Great Vibes", cat: "Script" },
  { label: "Pinyon Script", value: "Pinyon Script", cat: "Script" },
  { label: "Sacramento", value: "Sacramento", cat: "Script" },
  { label: "Dancing Script", value: "Dancing Script", cat: "Script" },
  { label: "Pacifico", value: "Pacifico", cat: "Script" },
  { label: "Alex Brush", value: "Alex Brush", cat: "Script" },
  { label: "Kaushan Script", value: "Kaushan Script", cat: "Script" },
  { label: "Playfair Display", value: "Playfair Display", cat: "Serif" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond", cat: "Serif" },
  { label: "Lora", value: "Lora", cat: "Serif" },
  { label: "Libre Baskerville", value: "Libre Baskerville", cat: "Serif" },
  { label: "Poppins", value: "Poppins", cat: "Sans" },
  { label: "Montserrat", value: "Montserrat", cat: "Sans" },
  { label: "Raleway", value: "Raleway", cat: "Sans" },
  { label: "Nunito", value: "Nunito", cat: "Sans" },
  { label: "Quicksand", value: "Quicksand", cat: "Sans" },
];

const ACCENT_PRESETS = [
  { label: "Hot pink", value: "#E91976" },
  { label: "Soft sage", value: "#7D9E7A" },
  { label: "Dusty blue", value: "#7BA7C7" },
  { label: "Peach", value: "#E8A87C" },
  { label: "Plum", value: "#6B4A7E" },
];

const STICKER_ROTATIONS = [-7, 5, -3, 8, -6, 4, -8, 6, -2, 7];
const MIXED_TOPPERS = ["rainbow", "heart", "star"] as const;

const SCATTERED_COORDS = [
  { x: 0.10, y: 0.14 }, { x: 0.84, y: 0.12 }, { x: 0.06, y: 0.36 },
  { x: 0.90, y: 0.34 }, { x: 0.16, y: 0.60 }, { x: 0.82, y: 0.62 },
  { x: 0.08, y: 0.80 }, { x: 0.88, y: 0.80 }, { x: 0.28, y: 0.08 }, { x: 0.70, y: 0.08 },
];

const DOODLE_SCATTER = [
  { x: 0.12, y: 0.22 }, { x: 0.82, y: 0.20 }, { x: 0.06, y: 0.68 },
  { x: 0.88, y: 0.70 }, { x: 0.22, y: 0.10 }, { x: 0.72, y: 0.10 },
];

const PW = 340; // preview width
const PH_PORT = 425;
const PH_STORY = 604;

// ─── Types ──────────────────────────────────────────────────────────────────────
type TopperType = "rainbow" | "heart" | "star" | "mirror" | "wine" | "lipstick" | "box-solid" | "circle-solid" | "heart-solid";
type Word = { id: string; text: string; x: number; y: number; topper?: TopperType };
type DoodleShape = "heart-outline" | "arrow" | "sparkle";
type DoodleEl = { id: string; shape: DoodleShape; x: number; y: number; size: number; rotation: number };
type LogoState = { dataUrl: string; storedUrl: string; ar: number; x: number; y: number; scale: number; rotation: number };

type DragOp =
  | { what: "word"; idx: number; sx: number; sy: number; ox: number; oy: number }
  | { what: "cutout"; sx: number; sy: number; ox: number; oy: number }
  | { what: "cutout-resize"; sx: number; sy: number; os: number; cx: number; cy: number; sd: number }
  | { what: "logo"; sx: number; sy: number; ox: number; oy: number }
  | { what: "logo-resize"; sx: number; sy: number; os: number; cx: number; cy: number; sd: number }
  | { what: "logo-rotate"; cx: number; cy: number; sa: number; or_: number }
  | { what: "doodle"; idx: number; sx: number; sy: number; ox: number; oy: number }
  | { what: "doodle-rotate"; idx: number; cx: number; cy: number; sa: number; or_: number }
  | { what: "doodle-resize"; idx: number; sx: number; sy: number; os: number; cx: number; cy: number; sd: number }
  | { what: "title"; sx: number; sy: number; ox: number; oy: number }
  | { what: "subtitle"; sx: number; sy: number; ox: number; oy: number };

// ─── SVG path helpers ───────────────────────────────────────────────────────────
function heartFilled(hx: number, hy: number, s: number) {
  return `M ${hx} ${hy + s * 0.28} C ${hx - s * 0.5} ${hy + s * 0.05} ${hx - s * 0.5} ${hy - s * 0.55} ${hx} ${hy - s * 0.28} C ${hx + s * 0.5} ${hy - s * 0.55} ${hx + s * 0.5} ${hy + s * 0.05} ${hx} ${hy + s * 0.28} Z`;
}
function heartOutline(cx: number, cy: number, s: number) {
  return `M ${cx + 0.05 * s},${cy + 0.65 * s} C ${cx - 0.55 * s},${cy + 0.18 * s} ${cx - 1.05 * s},${cy - 0.22 * s} ${cx - 0.98 * s},${cy - 0.72 * s} C ${cx - 0.92 * s},${cy - 1.12 * s} ${cx - 0.55 * s},${cy - 1.3 * s} ${cx - 0.28 * s},${cy - 1.18 * s} C ${cx - 0.08 * s},${cy - 1.08 * s} ${cx},${cy - 0.78 * s} ${cx},${cy - 0.78 * s} C ${cx},${cy - 0.78 * s} ${cx + 0.1 * s},${cy - 1.1 * s} ${cx + 0.32 * s},${cy - 1.2 * s} C ${cx + 0.62 * s},${cy - 1.35 * s} ${cx + 1.02 * s},${cy - 1.1 * s} ${cx + 0.98 * s},${cy - 0.68 * s} C ${cx + 0.95 * s},${cy - 0.2 * s} ${cx + 0.5 * s},${cy + 0.17 * s} ${cx + 0.05 * s},${cy + 0.65 * s} Z`;
}
function arrowCurly(cx: number, cy: number, s: number) {
  const x0 = cx - s * 0.88, y0 = cy + s * 0.08;
  const c1x = cx - s * 0.3, c1y = cy - s * 0.5;
  const c2x = cx + s * 0.15, c2y = cy - s * 0.6;
  const x3 = cx + s * 0.78, y3 = cy - s * 0.08;
  const ah1x = cx + s * 0.48, ah1y = cy - s * 0.55;
  const ah3x = cx + s * 0.58, ah3y = cy + s * 0.22;
  return `M ${x0},${y0} C ${c1x},${c1y} ${c2x},${c2y} ${x3},${y3} M ${ah1x},${ah1y} L ${x3},${y3} L ${ah3x},${ah3y}`;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
function angleDeg(cx: number, cy: number, px: number, py: number) {
  return Math.atan2(py - cy, px - cx) * (180 / Math.PI);
}
function loadGFont(family: string) {
  const id = `gf-${family.replace(/ /g, "-")}`;
  if (!document.getElementById(id)) {
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
    document.head.appendChild(l);
  }
}
function uid() { return Math.random().toString(36).slice(2, 9); }
function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
function darkenHex(hex: string, amount = 0.22): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
function starPath5(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI / 5) - Math.PI / 2;
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}
function effectiveTopper(w: Word, idx: number, def: string): TopperType {
  if (w.topper) return w.topper;
  if (def === "mixed") return MIXED_TOPPERS[idx % 3];
  return def as TopperType;
}
function wrapSvgText(text: string, maxW: number, fs: number, ls = 0): string[] {
  if (!text) return [];
  const cw = Math.max(1, fs * 0.58 + ls * 0.4);
  const maxChars = Math.max(1, Math.floor(maxW / cw));
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (test.length <= maxChars || !cur) { cur = test; }
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function renderRainbowTopper(cx: number, ty: number, size: number) {
  const r1 = size * 0.5, r2 = size * 0.33, r3 = size * 0.18, sw = size * 0.15;
  return (
    <>
      <path d={`M ${cx - r1},${ty} A ${r1},${r1} 0 0 1 ${cx + r1},${ty}`} fill="none" stroke="#E91976" strokeWidth={sw} strokeLinecap="round" />
      <path d={`M ${cx - r2},${ty} A ${r2},${r2} 0 0 1 ${cx + r2},${ty}`} fill="none" stroke="#7BA7C7" strokeWidth={sw} strokeLinecap="round" />
      <path d={`M ${cx - r3},${ty} A ${r3},${r3} 0 0 1 ${cx + r3},${ty}`} fill="none" stroke="#f8d97a" strokeWidth={sw} strokeLinecap="round" />
    </>
  );
}
function renderHeartTopper(cx: number, ty: number, size: number) {
  return <path d={heartFilled(cx, ty + size * 0.1, size * 0.55)} fill="#E91976" opacity={0.95} />;
}
function renderStarTopper(cx: number, ty: number, size: number, accent: string) {
  return <path d={starPath5(cx, ty, size * 0.52, size * 0.22)} fill="white" stroke={accent} strokeWidth={size * 0.12} />;
}
function renderMirrorTopper(cx: number, ty: number, size: number) {
  const r = size * 0.42;
  const cy_ = ty - r * 0.05;
  const handleW = r * 0.2, handleH = r * 0.55;
  const baseW = r * 0.7, baseH = r * 0.14;
  return (
    <>
      <rect x={cx - handleW / 2} y={cy_ + r * 0.85} width={handleW} height={handleH} rx={handleW * 0.3} fill="#b8860b" />
      <rect x={cx - baseW / 2} y={cy_ + r * 0.85 + handleH} width={baseW} height={baseH} rx={baseH * 0.3} fill="#b8860b" />
      <circle cx={cx} cy={cy_} r={r} fill="#f5c842" stroke="#b8860b" strokeWidth={r * 0.1} />
      <circle cx={cx} cy={cy_} r={r * 0.72} fill="#ddf0fa" opacity={0.7} />
      <ellipse cx={cx - r * 0.22} cy={cy_ - r * 0.28} rx={r * 0.12} ry={r * 0.18} fill="white" opacity={0.65} transform={`rotate(-25 ${cx - r * 0.22} ${cy_ - r * 0.28})`} />
    </>
  );
}
function renderWineGlassTopper(cx: number, ty: number, size: number) {
  const bW = size * 0.46, bBW = size * 0.16, bH = size * 0.48;
  const stemW = size * 0.05, stemH = size * 0.22;
  const baseW = size * 0.36, baseH = size * 0.09;
  const bowlTop = ty - size * 0.35;
  const bowlBot = bowlTop + bH;
  const stemBot = bowlBot + stemH;
  const wineTop = bowlTop + bH * 0.22;
  const wineTopW = bW - (bW - bBW) * 0.22;
  const bowl = `M ${cx - bW},${bowlTop} L ${cx + bW},${bowlTop} L ${cx + bBW},${bowlBot} L ${cx - bBW},${bowlBot} Z`;
  const wine = `M ${cx - wineTopW},${wineTop} L ${cx + wineTopW},${wineTop} L ${cx + bBW},${bowlBot} L ${cx - bBW},${bowlBot} Z`;
  return (
    <>
      <path d={wine} fill="#7B1C42" opacity={0.9} />
      <path d={bowl} fill="none" stroke="#aaa" strokeWidth={Math.max(0.8, size * 0.05)} />
      <rect x={cx - stemW} y={bowlBot} width={stemW * 2} height={stemH} fill="#aaa" />
      <rect x={cx - baseW} y={stemBot} width={baseW * 2} height={baseH} rx={baseH * 0.3} fill="#aaa" />
    </>
  );
}
function renderLipstickTopper(cx: number, ty: number, size: number) {
  const tw = size * 0.26, tubeH = size * 0.46, tipH = size * 0.3, caseH = size * 0.2;
  const baseY = ty + size * 0.22;
  const caseTop = baseY - caseH;
  const tubeTop = caseTop - tubeH;
  const tip = `M ${cx - tw / 2},${tubeTop} L ${cx - tw / 2},${tubeTop - tipH * 0.65} L ${cx + tw / 2},${tubeTop - tipH} L ${cx + tw / 2},${tubeTop} Z`;
  return (
    <>
      <rect x={cx - tw / 2} y={caseTop} width={tw} height={caseH} rx={tw * 0.15} fill="#888" />
      <rect x={cx - tw / 2} y={caseTop - tubeH * 0.07} width={tw} height={tubeH * 0.07} fill="#c0c0c0" />
      <rect x={cx - tw / 2} y={tubeTop} width={tw} height={tubeH} fill="#CC1155" />
      <path d={tip} fill="#E91976" />
      <line x1={cx - tw * 0.12} y1={tubeTop - tipH * 0.8} x2={cx - tw * 0.12} y2={tubeTop} stroke="white" strokeWidth={Math.max(0.5, size * 0.03)} opacity={0.55} strokeLinecap="round" />
    </>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────
export default function AboutMePage() {
  // Photo
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [cutoutDataUrl, setCutoutDataUrl] = useState("");
  const [cutoutAr, setCutoutAr] = useState(0.75);
  const [bgRemoving, setBgRemoving] = useState(false);

  // Text
  const [title, setTitle] = useState("About me");
  const [subtitle, setSubtitle] = useState("");
  const [titleFont, setTitleFont] = useState("Allura");
  const [accentColor, setAccentColor] = useState("#F5EEE3");
  const [stickerTopperDefault, setStickerTopperDefault] = useState<TopperType | "mixed">("mixed");

  // Per-element typography
  const [titleFontSize, setTitleFontSize] = useState(90);
  const [titleLetterSpacing, setTitleLetterSpacing] = useState(0);
  const [titleLineHeight, setTitleLineHeight] = useState(1.1);
  const [titleColor, setTitleColor] = useState("");
  const [subtitleColor, setSubtitleColor] = useState("");
  const [subtitleFontSize, setSubtitleFontSize] = useState(40);
  const [subtitleLetterSpacing, setSubtitleLetterSpacing] = useState(3);
  const [subtitleLineHeight, setSubtitleLineHeight] = useState(1.2);

  // Words
  const [words, setWords] = useState<Word[]>([
    { id: uid(), text: "Wife", ...SCATTERED_COORDS[0] },
    { id: uid(), text: "Mum", ...SCATTERED_COORDS[1] },
    { id: uid(), text: "Nurse", ...SCATTERED_COORDS[2] },
    { id: uid(), text: "Loyal", ...SCATTERED_COORDS[3] },
    { id: uid(), text: "Fun", ...SCATTERED_COORDS[4] },
  ]);

  // Sticker (word box) size
  const [stickerFontSize, setStickerFontSize] = useState(34);

  // Doodles
  const [doodles, setDoodles] = useState<DoodleEl[]>([]);
  const [doodleSize, setDoodleSize] = useState(22);

  // Cutout position
  const [cutoutX, setCutoutX] = useState(0.5);
  const [cutoutY, setCutoutY] = useState(0.55);
  const [cutoutScale, setCutoutScale] = useState(1.0);

  // Cutout effects
  const [glowEnabled, setGlowEnabled] = useState(false);
  const [glowColor, setGlowColor] = useState("#ffffff");
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowOpacity, setShadowOpacity] = useState(0.4);
  const [shadowBlur, setShadowBlur] = useState(12);
  const [shadowOffX, setShadowOffX] = useState(6);
  const [shadowOffY, setShadowOffY] = useState(8);

  // Logo
  const [logo, setLogo] = useState<LogoState | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Post type / output format
  const [postType, setPostType] = useState<"post" | "reel" | "trial-reel">("post");
  const aspectRatio = postType === "post" ? "1080x1350" : "1080x1920";

  // Text alignment
  const [titleAlign, setTitleAlign] = useState<"left" | "center" | "right">("center");
  const [subtitleAlign, setSubtitleAlign] = useState<"left" | "center" | "right">("center");

  // Text background panels
  const [titleBgEnabled, setTitleBgEnabled] = useState(false);
  const [titleBgColor, setTitleBgColor] = useState("#000000");
  const [titleBgOpacity, setTitleBgOpacity] = useState(50);
  const [titleBgRadius, setTitleBgRadius] = useState(12);
  const [titleBgPadding, setTitleBgPadding] = useState(16);
  const [subtitleBgEnabled, setSubtitleBgEnabled] = useState(false);
  const [subtitleBgColor, setSubtitleBgColor] = useState("#000000");
  const [subtitleBgOpacity, setSubtitleBgOpacity] = useState(50);
  const [subtitleBgRadius, setSubtitleBgRadius] = useState(12);
  const [subtitleBgPadding, setSubtitleBgPadding] = useState(16);

  // Draggable title/subtitle offsets (normalized, 0 = default position)
  const [titleOffX, setTitleOffX] = useState(0);
  const [titleOffY, setTitleOffY] = useState(0);
  const [subtitleOffX, setSubtitleOffX] = useState(0);
  const [subtitleOffY, setSubtitleOffY] = useState(0);

  // Title outline
  const [titleOutlineEnabled, setTitleOutlineEnabled] = useState(false);
  const [titleOutlineColor, setTitleOutlineColor] = useState("#ffffff");
  const [titleOutlineWidth, setTitleOutlineWidth] = useState(3);
  const [titleOutlineShadow, setTitleOutlineShadow] = useState(false);

  // Subtitle outline
  const [subtitleOutlineEnabled, setSubtitleOutlineEnabled] = useState(false);
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState("#ffffff");
  const [subtitleOutlineWidth, setSubtitleOutlineWidth] = useState(2);
  const [subtitleOutlineShadow, setSubtitleOutlineShadow] = useState(false);

  // "Preview at actual size" modal
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Caption generation
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState("");

  // Style
  const [blurAmount, setBlurAmount] = useState(25);
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  // Output
  const [saving, setSaving] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState("");
  const [postId, setPostId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [firstComment, setFirstComment] = useState("");
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [presets, setPresets] = useState<{ id: number; name: string }[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // Interaction
  const [drag, setDrag] = useState<DragOp | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(false);

  const PH = aspectRatio === "1080x1920" ? PH_STORY : PH_PORT;

  // Load fonts
  useEffect(() => { ALL_FONTS.forEach((f) => loadGFont(f.value)); }, []);
  useEffect(() => { loadGFont(titleFont); }, [titleFont]);

  // Load presets for scheduling
  useEffect(() => {
    const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${BASE_URL}/api/presets`).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d?.presets) ? d.presets : Array.isArray(d) ? d : [];
      setPresets(list.map((p: any) => ({ id: p.id, name: p.name })));
      if (list.length === 1) setSelectedPresetId(list[0].id);
    }).catch(() => {});
  }, []);

  // Track shift key for aspect-ratio break on resize
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, []);

  // Update cutout aspect ratio when photo changes
  useEffect(() => {
    const src = cutoutDataUrl || originalUrl;
    if (!src) return;
    const img = new Image();
    img.onload = () => setCutoutAr(img.naturalWidth / img.naturalHeight);
    img.src = src;
  }, [cutoutDataUrl, originalUrl]);

  // ─── Photo handling ────────────────────────────────────────────────────────
  const removeBackground = useCallback(async (file: File) => {
    setBgRemoving(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, { model: "isnet", output: { format: "image/png", quality: 0.95 } });
      setCutoutDataUrl(URL.createObjectURL(blob));
      toast.success("Background removed");
    } catch {
      toast.error("Background removal failed — photo used as-is");
    } finally {
      setBgRemoving(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setCutoutDataUrl("");
    setRenderedUrl("");
    setPostId(null);
    await removeBackground(file);
  }, [removeBackground]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFileSelect(file);
  }, [handleFileSelect]);

  // ─── Logo handling ─────────────────────────────────────────────────────────
  const handleLogoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setLogo({ dataUrl: url, storedUrl: "", ar: img.naturalWidth / img.naturalHeight, x: 0.84, y: 0.88, scale: 1.0, rotation: 0 });
    };
    img.src = url;
  };

  const uploadLogoToServer = async (dataUrl: string): Promise<string> => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const fd = new FormData();
    fd.append("logo", blob, "logo.png");
    const r = await fetch(`${import.meta.env.BASE_URL}api/about-me/upload-logo`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("Logo upload failed");
    const { logoUrl } = await r.json() as { logoUrl: string };
    return logoUrl;
  };

  // ─── Words ─────────────────────────────────────────────────────────────────
  const addWord = () => {
    if (words.length >= 10) return;
    const coord = SCATTERED_COORDS[words.length] ?? { x: 0.5, y: 0.5 };
    setWords((p) => [...p, { id: uid(), text: "", ...coord }]);
  };

  // ─── Doodles ───────────────────────────────────────────────────────────────
  const addDoodle = (shape: DoodleShape) => {
    const pos = DOODLE_SCATTER[doodles.length % DOODLE_SCATTER.length];
    setDoodles((p) => [...p, { id: uid(), shape, x: pos.x, y: pos.y, size: doodleSize, rotation: 0 }]);
  };

  // ─── SVG pointer helpers ───────────────────────────────────────────────────
  const svgPt = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * PW, y: (e.clientY - r.top) / r.height * PH };
  };

  const startDrag = (e: React.PointerEvent, op: DragOp) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag(op);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x: mx, y: my } = svgPt(e);

    if (drag.what === "word") {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setWords((p) => p.map((w, i) => i === drag.idx ? { ...w, x: clamp(drag.ox + dx / PW, 0.02, 0.98), y: clamp(drag.oy + dy / PH, 0.03, 0.97) } : w));
    } else if (drag.what === "cutout") {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setCutoutX(clamp(drag.ox + dx / PW, 0.05, 0.95));
      setCutoutY(clamp(drag.oy + dy / PH, 0.05, 0.95));
    } else if (drag.what === "cutout-resize") {
      const d = dist(drag.cx, drag.cy, mx, my);
      const newScale = clamp(drag.os * d / drag.sd, 0.2, 3.0);
      setCutoutScale(newScale);
    } else if (drag.what === "logo" && logo) {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setLogo((l) => l ? { ...l, x: clamp(drag.ox + dx / PW, 0.02, 0.98), y: clamp(drag.oy + dy / PH, 0.03, 0.97) } : l);
    } else if (drag.what === "logo-resize" && logo) {
      const d = dist(drag.cx, drag.cy, mx, my);
      setLogo((l) => l ? { ...l, scale: clamp(drag.os * d / drag.sd, 0.15, 5.0) } : l);
    } else if (drag.what === "logo-rotate" && logo) {
      const a = angleDeg(drag.cx, drag.cy, mx, my);
      setLogo((l) => l ? { ...l, rotation: Math.round(drag.or_ + (a - drag.sa)) } : l);
    } else if (drag.what === "doodle") {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setDoodles((p) => p.map((d, i) => i === drag.idx ? { ...d, x: clamp(drag.ox + dx / PW, 0.02, 0.98), y: clamp(drag.oy + dy / PH, 0.03, 0.97) } : d));
    } else if (drag.what === "doodle-resize") {
      const d = dist(drag.cx, drag.cy, mx, my);
      const newSize = clamp(drag.os * d / drag.sd, 8, 80);
      setDoodles((p) => p.map((dd, i) => i === drag.idx ? { ...dd, size: newSize } : dd));
    } else if (drag.what === "doodle-rotate") {
      const a = angleDeg(drag.cx, drag.cy, mx, my);
      setDoodles((p) => p.map((dd, i) => i === drag.idx ? { ...dd, rotation: Math.round(drag.or_ + (a - drag.sa)) } : dd));
    } else if (drag.what === "title") {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setTitleOffX(clamp(drag.ox + dx / PW, -0.85, 0.85));
      setTitleOffY(clamp(drag.oy + dy / PH, -0.1, 0.9));
    } else if (drag.what === "subtitle") {
      const dx = mx - drag.sx, dy = my - drag.sy;
      setSubtitleOffX(clamp(drag.ox + dx / PW, -0.85, 0.85));
      setSubtitleOffY(clamp(drag.oy + dy / PH, -0.1, 0.9));
    }
  };

  const onPointerUp = () => setDrag(null);

  // ─── Computed preview values ───────────────────────────────────────────────
  const photoSrc = cutoutDataUrl || originalUrl;
  const cutoutBaseH = PH * 0.54;
  const cutoutDispH = cutoutBaseH * cutoutScale;
  const cutoutDispW = Math.min(PW - 20, cutoutDispH * cutoutAr);
  const cutoutCx = cutoutX * PW;
  const cutoutCy = cutoutY * PH;
  const cutoutLeft = cutoutCx - cutoutDispW / 2;
  const cutoutTop = cutoutCy - cutoutDispH / 2;

  const logoBaseH = PH * 0.13;
  const logoDispH = logo ? logoBaseH * logo.scale : 0;
  const logoDispW = logo ? logoDispH * logo.ar : 0;
  const logoCx = logo ? logo.x * PW : 0;
  const logoCy = logo ? logo.y * PH : 0;
  const logoLeft = logoCx - logoDispW / 2;
  const logoTop = logoCy - logoDispH / 2;


  // ─── Resize / rotate handles for an element ───────────────────────────────
  const HRAD = 5;
  function cutoutHandles(cx: number, cy: number, hw: number, hh: number) {
    const corners = [
      { c: "tl", x: cx - hw / 2, y: cy - hh / 2 },
      { c: "tr", x: cx + hw / 2, y: cy - hh / 2 },
      { c: "bl", x: cx - hw / 2, y: cy + hh / 2 },
      { c: "br", x: cx + hw / 2, y: cy + hh / 2 },
    ];
    return corners.map(({ c, x, y }) => (
      <circle
        key={c}
        cx={x} cy={y} r={HRAD}
        fill="white" stroke="#E91976" strokeWidth={1.5}
        style={{ cursor: "nwse-resize" }}
        onPointerDown={(e) => {
          const sd = dist(cx, cy, svgPt(e).x, svgPt(e).y);
          startDrag(e, { what: "cutout-resize", sx: svgPt(e).x, sy: svgPt(e).y, os: cutoutScale, cx, cy, sd: Math.max(sd, 1) });
        }}
      />
    ));
  }

  function logoHandles() {
    if (!logo) return null;
    const corners = [
      { c: "tl", x: logoLeft, y: logoTop },
      { c: "tr", x: logoLeft + logoDispW, y: logoTop },
      { c: "bl", x: logoLeft, y: logoTop + logoDispH },
      { c: "br", x: logoLeft + logoDispW, y: logoTop + logoDispH },
    ];
    const rotHandleY = logoTop - 14;
    return (
      <g transform={`rotate(${logo.rotation} ${logoCx} ${logoCy})`}>
        {/* Rotate handle */}
        <line x1={logoCx} y1={logoTop - 2} x2={logoCx} y2={rotHandleY} stroke="white" strokeWidth={1} opacity={0.7} />
        <circle cx={logoCx} cy={rotHandleY} r={HRAD}
          fill="#7c3aed" stroke="white" strokeWidth={1.5}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => {
            const p = svgPt(e);
            startDrag(e, { what: "logo-rotate", cx: logoCx, cy: logoCy, sa: angleDeg(logoCx, logoCy, p.x, p.y), or_: logo.rotation });
          }}
        />
        {/* Corner resize handles */}
        {corners.map(({ c, x, y }) => (
          <circle key={c} cx={x} cy={y} r={HRAD}
            fill="white" stroke="#7c3aed" strokeWidth={1.5}
            style={{ cursor: "nwse-resize" }}
            onPointerDown={(e) => {
              const p = svgPt(e);
              const sd = dist(logoCx, logoCy, p.x, p.y);
              startDrag(e, { what: "logo-resize", sx: p.x, sy: p.y, os: logo.scale, cx: logoCx, cy: logoCy, sd: Math.max(sd, 1) });
            }}
          />
        ))}
      </g>
    );
  }

  // ─── Save / Render ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!originalFile) { toast.error("Please upload a photo first"); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("original", originalFile, originalFile.name);
      if (cutoutDataUrl) {
        const blob = await fetch(cutoutDataUrl).then((r) => r.blob());
        formData.append("cutout", blob, "cutout.png");
      }
      const uploadResp = await fetch(`${import.meta.env.BASE_URL}api/about-me/upload-photo`, { method: "POST", body: formData });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { originalUrl: storedOrig, cutoutUrl } = await uploadResp.json() as { originalUrl: string; cutoutUrl?: string };

      // Upload logo if new
      let logoUrl = logo?.storedUrl ?? "";
      if (logo && logo.dataUrl && !logo.storedUrl) {
        logoUrl = await uploadLogoToServer(logo.dataUrl);
        setLogo((l) => l ? { ...l, storedUrl: logoUrl } : l);
      }

      const apiWords = words.filter((w) => w.text.trim()).map((w) => ({
        id: w.id, text: w.text, x: w.x, y: w.y,
        ...(w.topper ? { topper: w.topper } : {}),
      }));

      const canvasConfig = {
        cutoutX, cutoutY, cutoutScale,
        glowEnabled, glowColor,
        shadowEnabled, shadowOpacity, shadowBlur, shadowOffsetX: shadowOffX, shadowOffsetY: shadowOffY,
        logoUrl,
        logoX: logo?.x ?? 0.84, logoY: logo?.y ?? 0.88, logoScale: logo?.scale ?? 1, logoRotation: logo?.rotation ?? 0,
        doodles,
        titleFontSize,
        titleLetterSpacing,
        titleLineHeight,
        ...(titleColor ? { titleColor } : {}),
        ...(subtitleColor ? { subtitleColor } : {}),
        subtitleFontSize,
        subtitleLetterSpacing,
        subtitleLineHeight,
        stickerTopperDefault,
        wordFontSize: stickerFontSize,
        titleAlign, subtitleAlign,
        titleBgEnabled, titleBgColor, titleBgOpacity, titleBgRadius, titleBgPadding,
        subtitleBgEnabled, subtitleBgColor, subtitleBgOpacity, subtitleBgRadius, subtitleBgPadding,
      };

      const body = {
        originalPhotoUrl: storedOrig, cutoutPhotoUrl: cutoutUrl ?? storedOrig,
        backgroundBlurAmount: blurAmount, backgroundOverlayOpacity: overlayOpacity,
        title, subtitle,
        words: apiWords, canvasConfig,
        accentColor, titleFont, aspectRatio, postType,
        musicTrack: musicTrack || null,
      };

      let id = postId;
      if (id) {
        await fetch(`${import.meta.env.BASE_URL}api/about-me/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const r = await fetch(`${import.meta.env.BASE_URL}api/about-me`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Save failed");
        const { id: newId } = await r.json() as { id: number };
        id = newId;
        setPostId(id);
      }

      toast.loading("Rendering image…");
      const rr = await fetch(`${import.meta.env.BASE_URL}api/about-me/${id}/render`, { method: "POST" });
      if (!rr.ok) throw new Error("Render failed");
      const { renderedUrl: url } = await rr.json() as { renderedUrl: string };
      setRenderedUrl(url);
      toast.dismiss();
      toast.success("About Me post ready");
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = () => {
    if (!renderedUrl) { toast.error("Generate your post first"); return; }
    setSchedulePosts([{ title: title || "About Me", caption: "", imageUrls: [renderedUrl], musicTrack: musicTrack || undefined, firstComment: firstComment || undefined }]);
    setScheduleOpen(true);
  };

  const handleGenerateCaption = async () => {
    setGeneratingCaption(true);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/about-me/generate-caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, words: words.filter((w) => w.text.trim()).map((w) => ({ text: w.text })) }),
      });
      if (!r.ok) throw new Error("Caption generation failed");
      const { caption } = await r.json() as { caption: string };
      setGeneratedCaption(caption);
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate caption");
    } finally {
      setGeneratingCaption(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] w-full pb-32">
      <MusicPickerModal open={musicPickerOpen} onClose={() => setMusicPickerOpen(false)} selectedTrack={musicTrack} onSelect={(t) => setMusicTrack(t)} />
      {scheduleOpen && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={presets.find((p) => p.id === selectedPresetId)?.name ?? ""}
          postType="about-me"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); toast.success("Scheduled"); }}
        />
      )}

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/hub"><Button variant="ghost" size="sm" className="text-muted-foreground">← Home</Button></Link>
          <Link href="/carousel"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-1" />Single</Button></Link>
          <Link href="/stories"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-1" />Stories</Button></Link>
          <Link href="/reels"><Button variant="ghost" size="sm" className="text-muted-foreground"><Film className="w-4 h-4 mr-1" />Reels</Button></Link>
          <Link href="/seamless-carousel"><Button variant="ghost" size="sm" className="text-muted-foreground"><Grid className="w-4 h-4 mr-1" />Seamless</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-1" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-1" />Captions</Button></Link>
          <Link href="/library"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-1" />Library</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-1" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-1" />Analytics</Button></Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className="mb-8">
          <h1 className="font-sans font-bold text-4xl tracking-tight mb-2 flex items-center gap-3">
            <User className="w-9 h-9 text-pink-400" /> About Me
          </h1>
          <p className="text-lg text-muted-foreground">Upload your photo, scatter your words, and drag everything exactly where you want it.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ═══ LEFT CONTROLS ═══ */}
          <div className="w-full lg:w-[40%] min-w-0 space-y-5">

            {/* Photo */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Your Photo</Label>
              <div ref={dropRef} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-pink-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-pink-500/60 transition-colors">
                {bgRemoving ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                    <p className="text-sm text-muted-foreground">Removing background — 15–30 seconds…</p>
                  </div>
                ) : photoSrc ? (
                  <div className="flex items-center gap-4">
                    <img src={photoSrc} alt="Preview" className="h-20 object-contain rounded-lg" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{cutoutDataUrl ? "Background removed" : "Original photo"}</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    <p className="text-xs text-pink-400">Background removed automatically</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Logo */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Logo</Label>
              {logo ? (
                <div className="flex items-center gap-3">
                  <img src={logo.dataUrl} alt="Logo" className="h-14 object-contain rounded bg-white/5 p-1" />
                  <div className="flex-1 text-sm text-muted-foreground">Drag it on the preview to reposition</div>
                  <Button variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <button onClick={() => logoFileRef.current?.click()}
                  className="w-full border border-dashed border-border/40 rounded-xl py-4 text-sm text-muted-foreground hover:border-pink-500/40 transition-colors flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> Upload logo (PNG with transparency)
                </button>
              )}
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
            </div>

            {/* Title + Subtitle + Font */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Title & Font</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About me" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subtitle (optional)</Label>
                  <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Wife. Mum. Nurse." className="h-10" />
                </div>
              </div>
              <Select value={titleFont} onValueChange={setTitleFont}>
                <SelectTrigger className="h-10">
                  <SelectValue><span style={{ fontFamily: `'${titleFont}', cursive, serif, sans-serif` }}>{titleFont}</span></SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {["Script", "Serif", "Sans"].map((cat) => (
                    <React.Fragment key={cat}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{cat}</div>
                      {ALL_FONTS.filter((f) => f.cat === cat).map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: `'${f.value}', cursive, serif, sans-serif` }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>

              {/* Title typography */}
              <div className="space-y-2 pt-1 border-t border-border/20">
                <Label className="text-xs font-medium text-muted-foreground">Title</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="color" value={titleColor || accentColor} onChange={(e) => setTitleColor(e.target.value)} className="w-9 h-7 p-0.5 cursor-pointer shrink-0" />
                  {titleColor && <button onClick={() => setTitleColor("")} className="text-xs text-muted-foreground hover:text-foreground">↺</button>}
                  {["#F5EEE3","#ffffff","#000000","#E91976","#ffd700"].map(c => (
                    <button key={c} onClick={() => setTitleColor(c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" title={c} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Size</Label><span className="text-xs font-mono text-muted-foreground">{titleFontSize}</span></div>
                    <input type="range" min={40} max={120} step={2} value={titleFontSize} onChange={(e) => setTitleFontSize(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Spacing</Label><span className="text-xs font-mono text-muted-foreground">{titleLetterSpacing}</span></div>
                    <input type="range" min={0} max={12} step={0.5} value={titleLetterSpacing} onChange={(e) => setTitleLetterSpacing(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Line height</Label><span className="text-xs font-mono text-muted-foreground">{titleLineHeight.toFixed(1)}</span></div>
                    <input type="range" min={0.7} max={2.5} step={0.05} value={titleLineHeight} onChange={(e) => setTitleLineHeight(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                  </div>
                </div>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} onClick={() => setTitleAlign(a)}
                      className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${titleAlign === a ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                      {a === "left" ? "← L" : a === "center" ? "⬤ C" : "R →"}
                    </button>
                  ))}
                </div>
                <div>
                  <button onClick={() => setTitleBgEnabled(p => !p)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${titleBgEnabled ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                    {titleBgEnabled ? "✓ Panel on" : "+ Text panel"}
                  </button>
                </div>
                {titleBgEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                    <div className="flex items-center gap-2 col-span-2">
                      <Input type="color" value={titleBgColor} onChange={(e) => setTitleBgColor(e.target.value)} className="w-8 h-7 p-0.5 cursor-pointer shrink-0" />
                      <Label className="text-xs text-muted-foreground">Panel colour</Label>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Opacity</Label><span className="text-xs font-mono">{titleBgOpacity}%</span></div>
                      <input type="range" min={0} max={100} step={5} value={titleBgOpacity} onChange={(e) => setTitleBgOpacity(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Radius</Label><span className="text-xs font-mono">{titleBgRadius}px</span></div>
                      <input type="range" min={0} max={30} step={1} value={titleBgRadius} onChange={(e) => setTitleBgRadius(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Padding</Label><span className="text-xs font-mono">{titleBgPadding}px</span></div>
                      <input type="range" min={4} max={32} step={2} value={titleBgPadding} onChange={(e) => setTitleBgPadding(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                  </div>
                )}
                {/* Title outline */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setTitleOutlineEnabled(p => !p)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${titleOutlineEnabled ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                    {titleOutlineEnabled ? "✓ Outline on" : "+ Outline text"}
                  </button>
                  {(titleOffX !== 0 || titleOffY !== 0) && (
                    <button onClick={() => { setTitleOffX(0); setTitleOffY(0); }}
                      className="px-2 py-0.5 rounded text-xs border border-border/40 text-muted-foreground hover:text-foreground">
                      ↺ Reset position
                    </button>
                  )}
                </div>
                {titleOutlineEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                    <div className="flex items-center gap-2 col-span-2 flex-wrap">
                      <Input type="color" value={titleOutlineColor} onChange={(e) => setTitleOutlineColor(e.target.value)} className="w-8 h-7 p-0.5 cursor-pointer shrink-0" />
                      <Label className="text-xs text-muted-foreground">Outline colour</Label>
                      {["#ffffff","#000000","#E91976","#ffd700"].map(c => (
                        <button key={c} onClick={() => setTitleOutlineColor(c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" />
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Thickness</Label><span className="text-xs font-mono">{titleOutlineWidth}px</span></div>
                      <input type="range" min={1} max={8} step={1} value={titleOutlineWidth} onChange={(e) => setTitleOutlineWidth(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                    <div className="flex items-end pb-1">
                      <button onClick={() => setTitleOutlineShadow(p => !p)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${titleOutlineShadow ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                        {titleOutlineShadow ? "✓ Shadow" : "+ Shadow"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitle typography */}
              {subtitle && (
                <div className="space-y-2 pt-1 border-t border-border/20">
                  <Label className="text-xs font-medium text-muted-foreground">Subtitle</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input type="color" value={subtitleColor || accentColor} onChange={(e) => setSubtitleColor(e.target.value)} className="w-9 h-7 p-0.5 cursor-pointer shrink-0" />
                    {subtitleColor && <button onClick={() => setSubtitleColor("")} className="text-xs text-muted-foreground hover:text-foreground">↺</button>}
                    {["#F5EEE3","#ffffff","#000000","#E91976","#ffd700"].map(c => (
                      <button key={c} onClick={() => setSubtitleColor(c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" title={c} />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Size</Label><span className="text-xs font-mono text-muted-foreground">{subtitleFontSize}</span></div>
                      <input type="range" min={20} max={70} step={2} value={subtitleFontSize} onChange={(e) => setSubtitleFontSize(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Spacing</Label><span className="text-xs font-mono text-muted-foreground">{subtitleLetterSpacing}</span></div>
                      <input type="range" min={0} max={12} step={0.5} value={subtitleLetterSpacing} onChange={(e) => setSubtitleLetterSpacing(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Line height</Label><span className="text-xs font-mono text-muted-foreground">{subtitleLineHeight.toFixed(1)}</span></div>
                      <input type="range" min={0.7} max={2.5} step={0.05} value={subtitleLineHeight} onChange={(e) => setSubtitleLineHeight(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} onClick={() => setSubtitleAlign(a)}
                        className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${subtitleAlign === a ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                        {a === "left" ? "← L" : a === "center" ? "⬤ C" : "R →"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <button onClick={() => setSubtitleBgEnabled(p => !p)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${subtitleBgEnabled ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                      {subtitleBgEnabled ? "✓ Panel on" : "+ Text panel"}
                    </button>
                  </div>
                  {subtitleBgEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                      <div className="flex items-center gap-2 col-span-2">
                        <Input type="color" value={subtitleBgColor} onChange={(e) => setSubtitleBgColor(e.target.value)} className="w-8 h-7 p-0.5 cursor-pointer shrink-0" />
                        <Label className="text-xs text-muted-foreground">Panel colour</Label>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Opacity</Label><span className="text-xs font-mono">{subtitleBgOpacity}%</span></div>
                        <input type="range" min={0} max={100} step={5} value={subtitleBgOpacity} onChange={(e) => setSubtitleBgOpacity(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Radius</Label><span className="text-xs font-mono">{subtitleBgRadius}px</span></div>
                        <input type="range" min={0} max={30} step={1} value={subtitleBgRadius} onChange={(e) => setSubtitleBgRadius(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                      </div>
                      <div className="space-y-0.5 col-span-2">
                        <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Padding</Label><span className="text-xs font-mono">{subtitleBgPadding}px</span></div>
                        <input type="range" min={4} max={32} step={2} value={subtitleBgPadding} onChange={(e) => setSubtitleBgPadding(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                      </div>
                    </div>
                  )}
                  {/* Subtitle outline */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setSubtitleOutlineEnabled(p => !p)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${subtitleOutlineEnabled ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                      {subtitleOutlineEnabled ? "✓ Outline on" : "+ Outline text"}
                    </button>
                    {(subtitleOffX !== 0 || subtitleOffY !== 0) && (
                      <button onClick={() => { setSubtitleOffX(0); setSubtitleOffY(0); }}
                        className="px-2 py-0.5 rounded text-xs border border-border/40 text-muted-foreground hover:text-foreground">
                        ↺ Reset position
                      </button>
                    )}
                  </div>
                  {subtitleOutlineEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                      <div className="flex items-center gap-2 col-span-2 flex-wrap">
                        <Input type="color" value={subtitleOutlineColor} onChange={(e) => setSubtitleOutlineColor(e.target.value)} className="w-8 h-7 p-0.5 cursor-pointer shrink-0" />
                        <Label className="text-xs text-muted-foreground">Outline colour</Label>
                        {["#ffffff","#000000","#E91976","#ffd700"].map(c => (
                          <button key={c} onClick={() => setSubtitleOutlineColor(c)} style={{ background: c }} className="w-5 h-5 rounded-full border border-white/30 shrink-0 hover:scale-110 transition-transform" />
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><Label className="text-xs text-muted-foreground">Thickness</Label><span className="text-xs font-mono">{subtitleOutlineWidth}px</span></div>
                        <input type="range" min={1} max={8} step={1} value={subtitleOutlineWidth} onChange={(e) => setSubtitleOutlineWidth(Number(e.target.value))} className="w-full accent-pink-500 h-1.5" />
                      </div>
                      <div className="flex items-end pb-1">
                        <button onClick={() => setSubtitleOutlineShadow(p => !p)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold border ${subtitleOutlineShadow ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground"}`}>
                          {subtitleOutlineShadow ? "✓ Shadow" : "+ Shadow"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Words / Stickers */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Sticker Labels ({words.length}/10)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag any sticker on the preview to reposition it</p>
                </div>
                {words.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addWord} className="text-pink-400 border-pink-500/30">+ Add</Button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Box size</Label>
                  <span className="text-xs font-semibold tabular-nums">{stickerFontSize}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    min={16} max={60} step={2}
                    value={[stickerFontSize]}
                    onValueChange={([v]) => setStickerFontSize(v)}
                    className="flex-1"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[{ label: "S", val: 20 }, { label: "M", val: 34 }, { label: "L", val: 52 }].map(({ label, val }) => (
                      <button key={label} onClick={() => setStickerFontSize(val)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-all ${stickerFontSize === val ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground hover:border-pink-500/40"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Default topper</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { val: "mixed", label: "Mixed" },
                    { val: "rainbow", label: "🌈" },
                    { val: "heart", label: "❤️" },
                    { val: "star", label: "⭐" },
                    { val: "mirror", label: "🪞 Mirror" },
                    { val: "wine", label: "🍷 Wine" },
                    { val: "lipstick", label: "💄 Lippie" },
                    { val: "box-solid", label: "▬ Box" },
                    { val: "circle-solid", label: "⬤ Circle" },
                    { val: "heart-solid", label: "♥ Heart" },
                  ] as const).map(({ val, label }) => (
                    <button key={val} onClick={() => setStickerTopperDefault(val as TopperType | "mixed")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${stickerTopperDefault === val ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground hover:border-pink-500/40"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {words.map((w, i) => (
                  <div key={w.id} className="flex gap-2 items-center">
                    <Input value={w.text} onChange={(e) => setWords((p) => p.map((ww, ii) => ii === i ? { ...ww, text: e.target.value } : ww))}
                      placeholder={`Word ${i + 1}`} className="flex-1 h-9" />
                    <select
                      value={w.topper ?? ""}
                      onChange={(e) => setWords((p) => p.map((ww, ii) => ii === i ? { ...ww, topper: e.target.value ? e.target.value as TopperType : undefined } : ww))}
                      className="h-9 rounded-md border border-border/40 bg-muted/40 text-xs px-2 text-muted-foreground shrink-0">
                      <option value="">Default</option>
                      <option value="rainbow">🌈 Rainbow</option>
                      <option value="heart">❤️ Heart</option>
                      <option value="star">⭐ Star</option>
                      <option value="mirror">🪞 Mirror</option>
                      <option value="wine">🍷 Wine glass</option>
                      <option value="lipstick">💄 Lipstick</option>
                      <option value="box-solid">▬ Box (solid)</option>
                      <option value="circle-solid">⬤ Circle (solid)</option>
                      <option value="heart-solid">♥ Heart (solid)</option>
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => setWords((p) => p.filter((_, ii) => ii !== i))} className="h-9 w-9 p-0 text-muted-foreground shrink-0"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Doodles */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Doodles</Label>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Default size</Label>
                <div className="flex gap-2">
                  {[{ label: "S", val: 14 }, { label: "M", val: 22 }, { label: "L", val: 34 }].map(({ label, val }) => (
                    <button key={label} onClick={() => setDoodleSize(val)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${doodleSize === val ? "bg-pink-500 text-white border-pink-500" : "border-border/40 text-muted-foreground hover:border-pink-500/40"}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addDoodle("heart-outline")}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 hover:border-pink-500/50 text-sm text-muted-foreground hover:text-foreground transition-all">
                  <svg viewBox="-1.1 -1.4 2.15 2.1" width="20" height="20">
                    <path d={heartOutline(0, 0, 1)} fill="none" stroke="currentColor" strokeWidth="0.12" strokeLinecap="round" />
                  </svg>
                  Heart
                </button>
                <button onClick={() => addDoodle("arrow")}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 hover:border-pink-500/50 text-sm text-muted-foreground hover:text-foreground transition-all">
                  <svg viewBox="-0.9 -0.7 1.7 0.35" width="28" height="14">
                    <path d={arrowCurly(0, 0, 1)} fill="none" stroke="currentColor" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Arrow
                </button>
                <button onClick={() => addDoodle("sparkle")}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 hover:border-pink-500/50 text-sm text-muted-foreground hover:text-foreground transition-all">
                  <span className="text-base leading-none">✦</span>
                  Sparkle
                </button>
              </div>
              {doodles.length > 0 && (
                <div className="space-y-1.5">
                  {doodles.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex-1">{d.shape} — {Math.round(d.x * 100)}%, {Math.round(d.y * 100)}%  rot:{d.rotation}°</span>
                      <Button variant="ghost" size="sm" onClick={() => setDoodles((p) => p.filter((_, ii) => ii !== i))} className="h-7 w-7 p-0"><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cutout effects */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Subject Effects</Label>

              {/* Glow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Glow behind subject</Label>
                  <button onClick={() => setGlowEnabled((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${glowEnabled ? "bg-pink-500" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${glowEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {glowEnabled && (
                  <div className="flex gap-3 items-center pl-2">
                    <Label className="text-xs text-muted-foreground">Colour</Label>
                    <Input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                    <span className="text-xs font-mono text-muted-foreground">{glowColor}</span>
                  </div>
                )}
              </div>

              {/* Shadow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Drop shadow</Label>
                  <button onClick={() => setShadowEnabled((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${shadowEnabled ? "bg-pink-500" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${shadowEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {shadowEnabled && (
                  <div className="grid grid-cols-3 gap-3 pl-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Opacity</Label>
                      <Slider min={0.05} max={0.9} step={0.05} value={[shadowOpacity]} onValueChange={([v]) => setShadowOpacity(v)} />
                      <span className="text-xs text-muted-foreground">{Math.round(shadowOpacity * 100)}%</span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Blur</Label>
                      <Slider min={2} max={30} step={1} value={[shadowBlur]} onValueChange={([v]) => setShadowBlur(v)} />
                      <span className="text-xs text-muted-foreground">{shadowBlur}px</span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Offset X</Label>
                      <Slider min={-20} max={20} step={1} value={[shadowOffX]} onValueChange={([v]) => setShadowOffX(v)} />
                      <span className="text-xs text-muted-foreground">{shadowOffX}px</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Style */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-5">
              <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Style</Label>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Accent colour — sticker outlines, toppers, sparkles</Label>
                <div className="flex gap-2 flex-wrap items-center">
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.value} onClick={() => setAccentColor(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${accentColor === p.value ? "border-pink-500 ring-1 ring-pink-500" : "border-border/40"}`}
                      style={{ backgroundColor: p.value, color: p.value === "#ffffff" || p.value === "#F5EEE3" ? "#333" : "#fff" }}>
                      {p.label}
                    </button>
                  ))}
                  <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Background blur</Label>
                    <span className="text-sm font-semibold">{blurAmount}px</span>
                  </div>
                  <Slider min={2} max={50} step={1} value={[blurAmount]} onValueChange={([v]) => setBlurAmount(v)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Tint overlay</Label>
                    <span className="text-sm font-semibold">{overlayOpacity}%</span>
                  </div>
                  <Slider min={0} max={50} step={1} value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Output type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "post", label: "Post (4:5)" },
                    { val: "reel", label: "Reel (9:16)" },
                    { val: "trial-reel", label: "Trial Reel" },
                  ] as const).map(({ val, label }) => (
                    <button key={val} onClick={() => setPostType(val)}
                      className={`px-2 py-3 rounded-xl text-xs font-semibold border transition-all ${postType === val ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {postType === "trial-reel" && <p className="text-xs text-muted-foreground/60">Saved as private — uses your trial reel flow.</p>}
              </div>
            </div>

            {/* Generate Caption */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-2xl text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Caption</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">AI-generated from your words, title, and brand voice</p>
                </div>
                <Button variant="outline" size="sm" disabled={generatingCaption} onClick={handleGenerateCaption}
                  className="text-pink-400 border-pink-500/30 shrink-0 gap-1.5">
                  {generatingCaption ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing…</> : "Generate Caption"}
                </Button>
              </div>
              <textarea
                value={generatedCaption}
                onChange={(e) => setGeneratedCaption(e.target.value)}
                rows={generatedCaption ? 5 : 2}
                placeholder="Click Generate Caption to write one with AI…"
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/50"
              />
            </div>

            <button onClick={handleSave} disabled={saving || !originalFile || bgRemoving}
              className="btn-shimmer w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50">
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Rendering…</> : "Generate & Save"}
            </button>

            {renderedUrl && (
              <>
              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    try {
                      const resp = await fetch(renderedUrl);
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "about-me.png"; a.click();
                      URL.revokeObjectURL(url);
                    } catch { window.open(renderedUrl, "_blank"); }
                  }}
                >
                  <Download className="w-4 h-4" /> Download PNG
                </Button>
                {presets.length > 1 && (
                  <Select value={selectedPresetId?.toString() ?? ""} onValueChange={(v) => setSelectedPresetId(Number(v))}>
                    <SelectTrigger className="flex-1 h-10 text-sm"><SelectValue placeholder="Select client preset" /></SelectTrigger>
                    <SelectContent>{presets.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button variant="outline" onClick={() => setMusicPickerOpen(true)} className={`flex-1 gap-2 ${musicTrack ? "border-green-500/40 text-green-300 hover:bg-green-950/30" : ""}`}>
                  <Music className="w-4 h-4" />{musicTrack ? musicTrack.name.slice(0, 18) : "Add music"}
                </Button>
                <Button variant="outline" onClick={handleSchedule} className="flex-1 gap-2">
                  <CalendarDays className="w-4 h-4" /> Schedule
                </Button>
              </div>
              <div className="mt-3">
                <label className="text-xs font-medium text-zinc-400 block mb-1">First comment (optional)</label>
                <textarea
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="Tap a heart if you've felt this way too"
                  rows={2}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <p className="text-xs text-zinc-600 mt-1">Posted 35 seconds after publishing to Instagram.</p>
              </div>
              </>
            )}
          </div>

          {/* ═══ RIGHT PREVIEW ═══ */}
          <div className="w-full lg:w-[58%] flex flex-col gap-2 lg:sticky top-24 self-start">
            <div className="flex items-center justify-between px-0.5">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Live Preview</p>
                <p className="text-xs text-muted-foreground">Drag title, photo, stickers, and doodles to reposition</p>
              </div>
              <button onClick={() => setShowFullPreview(true)}
                className="text-xs text-pink-400 border border-pink-500/30 px-2.5 py-1 rounded-lg hover:bg-pink-500/10 transition-colors flex items-center gap-1 shrink-0">
                ⤢ Actual size
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative select-none"
              style={{ width: "100%", aspectRatio: `${PW}/${PH}` }}>

              {/* Blurred background */}
              {originalUrl && (
                <img src={originalUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ filter: `blur(${blurAmount * 0.4}px)`, transform: "scale(1.1)" }} />
              )}
              {overlayOpacity > 0 && (
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: accentColor, opacity: overlayOpacity / 100 }} />
              )}

              {photoSrc ? (
                <svg ref={svgRef} className="absolute inset-0 w-full h-full"
                  viewBox={`0 0 ${PW} ${PH}`}
                  style={{ cursor: drag ? "grabbing" : "default" }}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}>

                  <defs>
                    {glowEnabled && (
                      <radialGradient id="pg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={glowColor} stopOpacity="0.65" />
                        <stop offset="55%" stopColor={glowColor} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
                      </radialGradient>
                    )}
                    {shadowEnabled && (
                      <filter id="csf" x="-60%" y="-60%" width="220%" height="220%">
                        <feDropShadow dx={shadowOffX * 0.35} dy={shadowOffY * 0.35} stdDeviation={shadowBlur * 0.25} floodColor="#000" floodOpacity={shadowOpacity} />
                      </filter>
                    )}
                  </defs>

                  {/* Glow behind cutout */}
                  {glowEnabled && (
                    <ellipse cx={cutoutCx} cy={cutoutCy} rx={cutoutDispW * 0.65} ry={cutoutDispH * 0.5} fill="url(#pg)" />
                  )}

                  {/* Cutout — draggable */}
                  <image href={photoSrc}
                    x={cutoutLeft} y={cutoutTop} width={cutoutDispW} height={cutoutDispH}
                    preserveAspectRatio="xMidYMid meet"
                    filter={shadowEnabled ? "url(#csf)" : undefined}
                    style={{ cursor: drag?.what === "cutout" ? "grabbing" : "grab" }}
                    onPointerDown={(e) => {
                      const p = svgPt(e);
                      startDrag(e, { what: "cutout", sx: p.x, sy: p.y, ox: cutoutX, oy: cutoutY });
                    }}
                  />

                  {/* Title — draggable, aligned, optional bg panel + outline */}
                  {(() => {
                    const maxW = PW * 0.82;
                    let fs = Math.round(titleFontSize * PW / 1080);
                    const tc = titleColor || accentColor;
                    let lines = wrapSvgText(title, maxW, fs, titleLetterSpacing);
                    if (lines.some(l => l.length * fs * 0.58 > maxW * 1.05)) {
                      fs = Math.round(fs * 0.88);
                      lines = wrapSvgText(title, maxW, fs, titleLetterSpacing);
                    }
                    const lineH = fs * titleLineHeight;
                    const baseX = titleAlign === "left" ? PW * 0.09 : titleAlign === "right" ? PW * 0.91 : PW / 2;
                    const baseY = fs + 10;
                    const xA = baseX + titleOffX * PW;
                    const topY = baseY + titleOffY * PH;
                    const anchor = titleAlign === "left" ? "start" : titleAlign === "right" ? "end" : "middle";
                    const scF = PW / 1080;
                    const pad = Math.round(titleBgPadding * scF);
                    const estimW = Math.max(...lines.map(l => l.length)) * fs * 0.58;
                    const bgW = Math.min(PW - 4, estimW + pad * 2);
                    const bgX = anchor === "middle" ? xA - bgW / 2 : anchor === "start" ? xA - pad : xA - bgW + pad;
                    const outW = titleOutlineEnabled ? titleOutlineWidth * scF : 0;
                    const textFilter = titleOutlineShadow ? "drop-shadow(0 2px 8px rgba(0,0,0,0.85))" : "drop-shadow(0 1px 3px rgba(0,0,0,0.4))";
                    return (
                      <g style={{ cursor: (titleOffX !== 0 || titleOffY !== 0) ? "grab" : "grab" }}
                        onPointerDown={(e) => {
                          const p = svgPt(e);
                          startDrag(e, { what: "title", sx: p.x, sy: p.y, ox: titleOffX, oy: titleOffY });
                        }}>
                        {titleBgEnabled && (
                          <rect x={bgX} y={topY - fs - pad} width={bgW} height={lines.length * lineH + pad * 2}
                            rx={Math.round(titleBgRadius * scF)} fill={titleBgColor} opacity={titleBgOpacity / 100} />
                        )}
                        {lines.map((line, li) => (
                          <text key={li} x={xA} y={topY + li * lineH}
                            fontFamily={`'${titleFont}', cursive, serif`} fontSize={fs} fill={tc}
                            textAnchor={anchor} letterSpacing={titleLetterSpacing}
                            {...(titleOutlineEnabled ? { stroke: titleOutlineColor, strokeWidth: outW, paintOrder: "stroke fill" } : {})}
                            style={{ filter: textFilter }}>
                            {line}
                          </text>
                        ))}
                      </g>
                    );
                  })()}
                  {/* Subtitle — draggable, aligned, optional bg panel + outline */}
                  {subtitle && (() => {
                    const maxW = PW * 0.82;
                    const titleFs = Math.round(titleFontSize * PW / 1080);
                    const titleLines = wrapSvgText(title, maxW, titleFs, titleLetterSpacing);
                    const titleTotalH = titleLines.length * titleFs * titleLineHeight;
                    const subFs = Math.round(subtitleFontSize * PW / 1080);
                    const sc_ = subtitleColor || accentColor;
                    const lines = wrapSvgText(subtitle.toUpperCase(), maxW, subFs, subtitleLetterSpacing);
                    const lineH = subFs * subtitleLineHeight;
                    const baseX = subtitleAlign === "left" ? PW * 0.09 : subtitleAlign === "right" ? PW * 0.91 : PW / 2;
                    const baseY = titleFs + 10 + titleTotalH + subFs + 4;
                    const xA = baseX + subtitleOffX * PW;
                    const topY = baseY + subtitleOffY * PH;
                    const anchor = subtitleAlign === "left" ? "start" : subtitleAlign === "right" ? "end" : "middle";
                    const scF = PW / 1080;
                    const pad = Math.round(subtitleBgPadding * scF);
                    const estimW = Math.max(...lines.map(l => l.length)) * subFs * 0.58;
                    const bgW = Math.min(PW - 4, estimW + pad * 2);
                    const bgX = anchor === "middle" ? xA - bgW / 2 : anchor === "start" ? xA - pad : xA - bgW + pad;
                    const outW = subtitleOutlineEnabled ? subtitleOutlineWidth * scF : 0;
                    const textFilter = subtitleOutlineShadow ? "drop-shadow(0 2px 8px rgba(0,0,0,0.85))" : undefined;
                    return (
                      <g style={{ cursor: "grab" }}
                        onPointerDown={(e) => {
                          const p = svgPt(e);
                          startDrag(e, { what: "subtitle", sx: p.x, sy: p.y, ox: subtitleOffX, oy: subtitleOffY });
                        }}>
                        {subtitleBgEnabled && (
                          <rect x={bgX} y={topY - subFs - pad} width={bgW} height={lines.length * lineH + pad * 2}
                            rx={Math.round(subtitleBgRadius * scF)} fill={subtitleBgColor} opacity={subtitleBgOpacity / 100} />
                        )}
                        {lines.map((line, li) => (
                          <text key={li} x={xA} y={topY + li * lineH}
                            fontFamily="Georgia, serif" fontSize={subFs} fill={sc_}
                            textAnchor={anchor} opacity={0.85} letterSpacing={subtitleLetterSpacing}
                            {...(subtitleOutlineEnabled ? { stroke: subtitleOutlineColor, strokeWidth: outW, paintOrder: "stroke fill" } : {})}
                            style={textFilter ? { filter: textFilter } : undefined}>
                            {line}
                          </text>
                        ))}
                      </g>
                    );
                  })()}

                  {/* Words — puffy sticker labels */}
                  {words.filter((w) => w.text).map((w, i) => {
                    const wx = w.x * PW, wy = w.y * PH;
                    const sc = PW / 1080;
                    const sizeRatio = stickerFontSize / 34;
                    const fontSize = Math.round(stickerFontSize * sc);
                    const padH = Math.round(28 * sc * sizeRatio);
                    const padV = Math.round(18 * sc * sizeRatio);
                    const sW = Math.max(60, w.text.length * Math.round(22 * sc * sizeRatio) + padH * 2);
                    const sH = fontSize + padV * 2;
                    const bR = Math.round(22 * sc * sizeRatio);
                    const sLeft = wx - sW / 2;
                    const sTop = wy - sH / 2;
                    const outerPad = Math.max(2, Math.round(5 * sc));
                    const outer = darkenHex(accentColor, 0.22);
                    const rot = STICKER_ROTATIONS[i % STICKER_ROTATIONS.length];
                    const topper = effectiveTopper(w, i, stickerTopperDefault);
                    const topperSize = sH * 0.7;
                    const topperY = sTop - topperSize * 0.15;
                    return (
                      <g key={w.id}
                        transform={`rotate(${rot} ${wx} ${wy})`}
                        style={{ cursor: "grab", filter: "drop-shadow(0 3px 7px rgba(0,0,0,0.28))" }}
                        onPointerDown={(e) => {
                          const p = svgPt(e);
                          startDrag(e, { what: "word", idx: i, sx: p.x, sy: p.y, ox: w.x, oy: w.y });
                        }}>
                        {(topper === "box-solid" || topper === "circle-solid" || topper === "heart-solid") ? (
                          <>
                            {topper === "box-solid" && <>
                              <rect x={sLeft - outerPad} y={sTop - outerPad} width={sW + outerPad * 2} height={sH + outerPad * 2} rx={bR + 2} ry={bR + 2} fill={outer} />
                              <rect x={sLeft} y={sTop} width={sW} height={sH} rx={bR - 1} ry={bR - 1} fill={accentColor} />
                            </>}
                            {topper === "circle-solid" && <ellipse cx={wx} cy={wy} rx={sW / 2 + outerPad} ry={sH / 2 + outerPad} fill={accentColor} />}
                            {topper === "heart-solid" && <path d={heartFilled(wx, wy + (sW + outerPad * 2) * 0.135, sW + outerPad * 2)} fill={accentColor} />}
                            <text x={wx} y={wy + fontSize * 0.36} fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize} fontWeight="800" fill="white" textAnchor="middle" letterSpacing={1} stroke="rgba(0,0,0,0.22)" strokeWidth={1.5} paintOrder="stroke">{w.text.toUpperCase()}</text>
                          </>
                        ) : (
                          <>
                            <rect x={sLeft - outerPad} y={sTop - outerPad} width={sW + outerPad * 2} height={sH + outerPad * 2} rx={bR + 2} ry={bR + 2} fill={outer} />
                            <rect x={sLeft - 1} y={sTop - 1} width={sW + 2} height={sH + 2} rx={bR} ry={bR} fill={accentColor} />
                            <rect x={sLeft} y={sTop} width={sW} height={sH} rx={bR - 1} ry={bR - 1} fill="white" />
                            <text x={wx} y={wy + fontSize * 0.36} fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize} fontWeight="800" fill="#1a1a1a" textAnchor="middle" letterSpacing={1}>{w.text.toUpperCase()}</text>
                            {topper === "rainbow" && renderRainbowTopper(wx, topperY, topperSize)}
                            {topper === "heart" && renderHeartTopper(wx, topperY, topperSize)}
                            {topper === "star" && renderStarTopper(wx, topperY, topperSize, accentColor)}
                            {topper === "mirror" && renderMirrorTopper(wx, topperY, topperSize)}
                            {topper === "wine" && renderWineGlassTopper(wx, topperY, topperSize)}
                            {topper === "lipstick" && renderLipstickTopper(wx, topperY, topperSize)}
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Doodles — draggable + resize + rotate */}
                  {doodles.map((d, i) => {
                    const dcx = d.x * PW, dcy = d.y * PH;
                    const s = d.size * 0.55;
                    const sw = Math.max(1, s * 0.1);
                    return (
                      <g key={d.id} transform={`rotate(${d.rotation} ${dcx} ${dcy})`}>
                        {/* Drag body */}
                        <g style={{ cursor: "grab" }}
                          onPointerDown={(e) => {
                            const p = svgPt(e);
                            startDrag(e, { what: "doodle", idx: i, sx: p.x, sy: p.y, ox: d.x, oy: d.y });
                          }}>
                          {d.shape === "heart-outline" && (
                            <path d={heartOutline(dcx, dcy, s)} fill="none" stroke={accentColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                          )}
                          {d.shape === "arrow" && (
                            <path d={arrowCurly(dcx, dcy, s)} fill="none" stroke={accentColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                          )}
                          {d.shape === "sparkle" && (
                            <text x={dcx} y={dcy} fontSize={s * 1.4} fill={accentColor} textAnchor="middle" dominantBaseline="middle" opacity={0.85}>✦</text>
                          )}
                        </g>
                        {/* Resize handle (bottom-right) */}
                        <circle cx={dcx + s * 1.05} cy={dcy + s * 0.65} r={4}
                          fill="white" stroke="#E91976" strokeWidth={1.2}
                          style={{ cursor: "nwse-resize" }}
                          onPointerDown={(e) => {
                            const p = svgPt(e);
                            const sd = dist(dcx, dcy, p.x, p.y);
                            startDrag(e, { what: "doodle-resize", idx: i, sx: p.x, sy: p.y, os: d.size, cx: dcx, cy: dcy, sd: Math.max(sd, 1) });
                          }}
                        />
                        {/* Rotate handle (top) */}
                        <circle cx={dcx} cy={dcy - s * 1.4} r={4}
                          fill="#7c3aed" stroke="white" strokeWidth={1.2}
                          style={{ cursor: "grab" }}
                          onPointerDown={(e) => {
                            const p = svgPt(e);
                            startDrag(e, { what: "doodle-rotate", idx: i, cx: dcx, cy: dcy, sa: angleDeg(dcx, dcy, p.x, p.y), or_: d.rotation });
                          }}
                        />
                      </g>
                    );
                  })}

                  {/* Logo — draggable + resize + rotate */}
                  {logo && (
                    <>
                      <image href={logo.dataUrl}
                        x={logoLeft} y={logoTop} width={logoDispW} height={logoDispH}
                        preserveAspectRatio="xMidYMid meet"
                        transform={`rotate(${logo.rotation} ${logoCx} ${logoCy})`}
                        style={{ cursor: "grab" }}
                        onPointerDown={(e) => {
                          const p = svgPt(e);
                          startDrag(e, { what: "logo", sx: p.x, sy: p.y, ox: logo.x, oy: logo.y });
                        }}
                      />
                      {logoHandles()}
                    </>
                  )}

                  {/* Sparkles */}
                  {[[0.07, 0.10, 12, 0.42], [0.88, 0.50, 9, 0.35], [0.15, 0.84, 8, 0.32]].map(([rx, ry, fs, op], i) => (
                    <text key={i} x={(rx as number) * PW} y={(ry as number) * PH} fontSize={fs} fill={accentColor} textAnchor="middle" opacity={op}>✦</text>
                  ))}

                  {/* Cutout handles — rendered last so they stay clickable above all content */}
                  {cutoutHandles(cutoutCx, cutoutCy, cutoutDispW, cutoutDispH)}
                  {(cutoutScale !== 1.0 || cutoutX !== 0.5 || cutoutY !== 0.55) && (
                    <g style={{ cursor: "pointer" }} onClick={() => { setCutoutScale(1.0); setCutoutX(0.5); setCutoutY(0.55); }}>
                      <rect x={PW - 28} y={4} width={24} height={18} rx={4} fill="black" fillOpacity={0.5} />
                      <text x={PW - 16} y={16} fontSize={9} fill="white" textAnchor="middle">reset</text>
                    </g>
                  )}
                </svg>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/20">
                  <User className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Upload a photo to begin</p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-1">
              {bgRemoving ? "Removing background…" : cutoutDataUrl ? "Background removed" : photoSrc ? "Original photo" : ""}
            </p>
          </div>
        </div>
      </main>

      {/* ═══ FULL SIZE PREVIEW MODAL ═══ */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 bg-black/92 flex items-start justify-center overflow-auto py-10 px-4"
          onClick={() => setShowFullPreview(false)}>
          <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <p className="text-white/50 text-sm">{aspectRatio === "1080x1920" ? "1080 × 1920" : "1080 × 1350"}</p>
              <button onClick={() => setShowFullPreview(false)}
                className="text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1 text-xs transition-colors">
                Close ✕
              </button>
            </div>
            {renderedUrl ? (
              <img src={renderedUrl}
                className="rounded-2xl shadow-2xl block"
                style={{ maxWidth: "min(1080px, calc(100vw - 32px))" }}
                alt="Full size preview" />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center space-y-4 max-w-sm">
                <p className="text-white/60 text-sm leading-relaxed">
                  Hit Generate &amp; Save first, then come back here to see your design at full 1080px resolution.
                </p>
                <button onClick={() => setShowFullPreview(false)}
                  className="text-pink-400 text-sm underline">
                  Close and generate
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
