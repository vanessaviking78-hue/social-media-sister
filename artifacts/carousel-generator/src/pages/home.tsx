import React, { useState, useCallback, useRef, useEffect } from "react";
import { Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, Palette, Sparkles, Wand2, Copy, Check, MessageSquareText, Plus, ChevronLeft, ChevronRight, Camera, Type, PenTool } from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import type { CarouselResult, CarouselSlide } from "@workspace/api-client-react/src/generated/api.schemas";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VanessaChat from "@/components/vanessa-chat";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const FONT_OPTIONS = [
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

const CORNER_STYLES = [
  { label: "None", value: "none" },
  { label: "Triangle", value: "triangle" },
  { label: "Arc", value: "arc" },
  { label: "Double Line", value: "double-line" },
  { label: "Frame", value: "frame" },
];

const LOGO_POSITIONS = [
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
];

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Lato:wght@400;700&family=Oswald:wght@400;600;700&family=Merriweather:wght@400;700&family=Raleway:wght@400;600;700&family=Roboto:wght@400;700&family=Poppins:wght@400;600;700&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Pacifico&family=Libre+Baskerville:wght@400;700&family=DM+Serif+Display&family=Abril+Fatface&family=Quicksand:wght@400;600;700&family=Nunito:wght@400;600;700&family=Crimson+Text:wght@400;600;700&family=Work+Sans:wght@400;600;700&family=Bitter:wght@400;600;700&family=Josefin+Sans:wght@400;600;700&family=Great+Vibes&display=swap";
  document.head.appendChild(link);
}

function drawSlide(
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
  gradientColor: string = "#000000",
  gradientEnabled: boolean = true,
  gradientStyle: string = "solid",
  gradientPosition: string = "left",
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

  const isHoriz = ["left", "center", "right"].includes(gradientPosition);
  const stripW = Math.round(W * 0.35);
  const stripH = Math.round(H * 0.30);

  let gx = 0, gy = 0, gw = stripW, gh = H;
  if (isHoriz) {
    gw = stripW; gh = H;
    if (gradientPosition === "left") { gx = 0; }
    else if (gradientPosition === "center") { gx = Math.round((W - stripW) / 2); }
    else { gx = W - stripW; }
  } else {
    gw = W; gh = stripH;
    if (gradientPosition === "top") { gy = 0; }
    else if (gradientPosition === "middle") { gy = Math.round((H - stripH) / 2); }
    else { gy = H - stripH; }
  }

  if (gradientEnabled) {
    if (gradientStyle === "leopard") {
      const patCanvas = document.createElement("canvas");
      patCanvas.width = gw;
      patCanvas.height = gh;
      const pc = patCanvas.getContext("2d")!;

      pc.fillStyle = "#c8a44e";
      pc.fillRect(0, 0, gw, gh);

      const rng = (min: number, max: number) => min + Math.random() * (max - min);
      const spotCount = isHoriz ? 120 : 80;
      const spots: { x: number; y: number; rx: number; ry: number; angle: number }[] = [];
      for (let i = 0; i < spotCount; i++) {
        spots.push({
          x: rng(-20, gw + 20),
          y: rng(-20, gh + 20),
          rx: rng(18, 40),
          ry: rng(22, 50),
          angle: rng(0, Math.PI),
        });
      }
      for (const s of spots) {
        pc.save();
        pc.translate(s.x, s.y);
        pc.rotate(s.angle);
        pc.beginPath();
        pc.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2);
        pc.fillStyle = "#6b3a1f";
        pc.fill();
        pc.beginPath();
        pc.ellipse(0, 0, s.rx * 0.6, s.ry * 0.6, 0, 0, Math.PI * 2);
        pc.fillStyle = "#c8a44e";
        pc.fill();
        pc.restore();
      }
      for (let i = 0; i < 60; i++) {
        pc.save();
        pc.translate(rng(0, gw), rng(0, gh));
        pc.rotate(rng(0, Math.PI));
        pc.beginPath();
        pc.ellipse(0, 0, rng(4, 10), rng(4, 10), 0, 0, Math.PI * 2);
        pc.fillStyle = "#1a0f08";
        pc.fill();
        pc.restore();
      }

      let fadeGrad: CanvasGradient;
      if (isHoriz) {
        if (gradientPosition === "left") {
          fadeGrad = pc.createLinearGradient(0, 0, gw, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(0.7, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        } else if (gradientPosition === "right") {
          fadeGrad = pc.createLinearGradient(gw, 0, 0, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(0.7, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        } else {
          fadeGrad = pc.createLinearGradient(gw / 2, 0, 0, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
          pc.fillStyle = fadeGrad; pc.globalCompositeOperation = "destination-out"; pc.fillRect(0, 0, gw / 2, gh);
          fadeGrad = pc.createLinearGradient(gw / 2, 0, gw, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        }
      } else {
        if (gradientPosition === "top") {
          fadeGrad = pc.createLinearGradient(0, 0, 0, gh);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(0.7, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        } else if (gradientPosition === "bottom") {
          fadeGrad = pc.createLinearGradient(0, gh, 0, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(0.7, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        } else {
          fadeGrad = pc.createLinearGradient(0, gh / 2, 0, 0);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
          pc.fillStyle = fadeGrad; pc.globalCompositeOperation = "destination-out"; pc.fillRect(0, 0, gw, gh / 2);
          fadeGrad = pc.createLinearGradient(0, gh / 2, 0, gh);
          fadeGrad.addColorStop(0, "rgba(0,0,0,0)"); fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        }
      }
      pc.fillStyle = fadeGrad;
      pc.globalCompositeOperation = "destination-out";
      pc.fillRect(0, 0, gw, gh);

      ctx.globalAlpha = 0.85;
      ctx.drawImage(patCanvas, gx, gy);
      ctx.globalAlpha = 1.0;
    } else {
      const gr = parseInt(gradientColor.slice(1, 3), 16);
      const gg = parseInt(gradientColor.slice(3, 5), 16);
      const gb = parseInt(gradientColor.slice(5, 7), 16);
      let grad: CanvasGradient;
      if (isHoriz) {
        if (gradientPosition === "left") {
          grad = ctx.createLinearGradient(gx + gw, 0, gx, 0);
        } else if (gradientPosition === "right") {
          grad = ctx.createLinearGradient(gx, 0, gx + gw, 0);
        } else {
          grad = ctx.createLinearGradient(gx + gw / 2, 0, gx, 0);
          grad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
          grad.addColorStop(1, `rgba(${gr},${gg},${gb},0.85)`);
          ctx.fillStyle = grad;
          ctx.fillRect(gx, gy, gw / 2, gh);
          grad = ctx.createLinearGradient(gx + gw / 2, 0, gx + gw, 0);
        }
      } else {
        if (gradientPosition === "top") {
          grad = ctx.createLinearGradient(0, gy + gh, 0, gy);
        } else if (gradientPosition === "bottom") {
          grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
        } else {
          grad = ctx.createLinearGradient(0, gy + gh / 2, 0, gy);
          grad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
          grad.addColorStop(1, `rgba(${gr},${gg},${gb},0.85)`);
          ctx.fillStyle = grad;
          ctx.fillRect(gx, gy, gw, gh / 2);
          grad = ctx.createLinearGradient(0, gy + gh / 2, 0, gy + gh);
        }
      }
      grad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
      grad.addColorStop(1, `rgba(${gr},${gg},${gb},0.85)`);
      ctx.fillStyle = grad;
      if (gradientPosition === "center") {
        ctx.fillRect(gx + gw / 2, gy, gw / 2, gh);
      } else if (gradientPosition === "middle") {
        ctx.fillRect(gx, gy + gh / 2, gw, gh / 2);
      } else {
        ctx.fillRect(gx, gy, gw, gh);
      }
    }
  }

  const isLastSlide = slidePosition === totalSlidesInGroup;
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

async function compressImage(file: File, maxPx = 1080, quality = 0.72): Promise<File> {
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

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [result, setResult] = useState<CarouselResult | null>(null);

  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const [fontSize, setFontSize] = useState(52);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textColor, setTextColor] = useState("#ffffff");
  const [lineSpacing, setLineSpacing] = useState(0.9);
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.5)");
  const [pageColor, setPageColor] = useState("#000000");
  const [cornerStyle, setCornerStyle] = useState("none");
  const [cornerColor, setCornerColor] = useState("#d4af37");
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [gradientStyle, setGradientStyle] = useState("solid");
  const [gradientColor, setGradientColor] = useState("#000000");
  const [gradientPosition, setGradientPosition] = useState("left");
  const [textPosition, setTextPosition] = useState("bottom-left");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [logoSize, setLogoSize] = useState(140);

  const [isGenerating, setIsGenerating] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [contentMode, setContentMode] = useState<"csv" | "ai">("csv");
  const [aiClientName, setAiClientName] = useState("");
  const [aiIndustry, setAiIndustry] = useState("");
  const [aiTone, setAiTone] = useState("warm & professional");
  const [aiTopics, setAiTopics] = useState("");
  const [aiPostCount, setAiPostCount] = useState(30);
  const [aiExtraInstructions, setAiExtraInstructions] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiGeneratedPosts, setAiGeneratedPosts] = useState<string[][] | null>(null);

  const [allCsvRows, setAllCsvRows] = useState<string[][]>([]);

  const [clinicianPhoto, setClinicianPhoto] = useState<File | null>(null);
  const [clinicianPortraits, setClinicianPortraits] = useState<Array<{ style: string; image: string }>>([]);
  const [clinicianRecreating, setClinicianRecreating] = useState(false);

  const [captions, setCaptions] = useState<string[]>([]);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionProgress, setCaptionProgress] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!logoFile) { setLogoImg(null); setLogoPreviewUrl(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    const el = new Image();
    el.onload = () => setLogoImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const addPhotos = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const compressed = await Promise.all(images.map((f) => compressImage(f)));
    setPhotos((prev) => [...prev, ...compressed]);
  };

  const handlePhotosDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingPhotos(false);
    if (e.dataTransfer.files?.length) addPhotos(Array.from(e.dataTransfer.files));
  }, []);

  const handlePhotosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addPhotos(Array.from(e.target.files));
  }, []);

  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const processCsv = (file: File) => {
    setCsvFile(file);
    Papa.parse<string[]>(file, {
      header: false, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data as string[][];
        if (rows.length === 0) return;
        const first = rows[0]?.[0]?.toLowerCase() ?? "";
        const isHeader = /^(slide|hook|col|column|text|caption|header)\d*$/i.test(first);
        const headers = isHeader ? rows[0] : rows[0].map((_, i) => `Slide ${i + 1}`);
        const dataRows = isHeader ? rows.slice(1) : rows;
        setCsvPreview({ headers, rows: dataRows.slice(0, 3) });
        setAllCsvRows(dataRows);
      },
      error: (err: { message: string }) => toast.error("CSV parse error: " + err.message),
    });
  };

  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCsv(file);
  }, []);

  const handleCsvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processCsv(e.target.files[0]);
  }, []);

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setLogoFile(file);
  }, []);

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
  }, []);

  const handleGenerate = async () => {
    if (!photos.length) { toast.error("Please upload at least one photo"); return; }
    if (!csvFile) { toast.error("Please upload a CSV file"); return; }

    setIsGenerating(true);
    const toastId = toast.loading("Generating slides…");

    try {
      const csvText = await csvFile.text();
      const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true });
      let rows = parsed.data as string[][];
      if (rows.length === 0) throw new Error("CSV has no data rows");

      const first = rows[0]?.[0]?.toLowerCase() ?? "";
      if (/^(slide|hook|col|column|text|caption|header)\d*$/i.test(first)) rows = rows.slice(1);
      rows = rows.map((r) => r.filter((c) => c.trim())).filter((r) => r.length > 0);
      if (rows.length === 0) throw new Error("CSV has no data rows");

      const MAX_CAROUSELS = 60;
      const postRows = rows.slice(0, MAX_CAROUSELS);
      const slidesPerCarousel = postRows[0].length;

      const photoUrls = photos.map((f) => URL.createObjectURL(f));

      const slides: CarouselSlide[] = [];
      let idx = 1;
      for (let pi = 0; pi < postRows.length; pi++) {
        const photoUrl = photoUrls[pi % photoUrls.length];
        for (let si = 0; si < postRows[pi].length; si++) {
          slides.push({
            slideIndex: idx++,
            groupIndex: pi + 1,
            groupPosition: si + 1,
            text: postRows[pi][si],
            imageUrl: photoUrl,
            imageName: photos[pi % photos.length].name,
          });
        }
      }

      setResult({ slides, totalSlides: slides.length, slidesPerCarousel, totalCarousels: postRows.length, sessionId: "local" });
      setCurrentStep(4);
      toast.success(`${slides.length} slides generated — ready to download`, { id: toastId });
    } catch (e: any) {
      console.error("Generate error:", e);
      toast.error("Error: " + (e?.message ?? "Unknown error"), { id: toastId, duration: 15000 });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiIndustry.trim()) { toast.error("Please enter an industry"); return; }
    if (!aiTopics.trim()) { toast.error("Please enter at least one topic"); return; }
    setAiGenerating(true);
    setAiProgress("Starting content generation...");
    setAiGeneratedPosts(null);
    const toastId = toast.loading("AI is writing your content...");

    try {
      const resp = await fetch(`/api/content/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: aiClientName,
          industry: aiIndustry,
          tone: aiTone,
          topics: aiTopics,
          postCount: aiPostCount,
          slidesPerPost: 5,
          extraInstructions: aiExtraInstructions,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || "Generation failed");
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "progress") {
              setAiProgress(`Generated ${evt.generated} of ${evt.total} posts...`);
            } else if (evt.type === "complete") {
              setAiGeneratedPosts(evt.posts);
              setAiProgress("");
              toast.success(`${evt.postCount} carousel posts generated!`, { id: toastId });
            } else if (evt.type === "error") {
              toast.error(evt.message);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "Unknown error"), { id: toastId });
    } finally {
      setAiGenerating(false);
    }
  };

  const buildSlidesFromPosts = (posts: string[][]) => {
    const postRows = posts.slice(0, 60);
    const slidesPerCarousel = postRows[0].length;
    const photoUrls = photos.map((f) => URL.createObjectURL(f));

    const slides: CarouselSlide[] = [];
    let idx = 1;
    for (let pi = 0; pi < postRows.length; pi++) {
      const photoUrl = photoUrls[pi % photoUrls.length];
      for (let si = 0; si < postRows[pi].length; si++) {
        slides.push({
          slideIndex: idx++,
          groupIndex: pi + 1,
          groupPosition: si + 1,
          text: postRows[pi][si],
          imageUrl: photoUrl,
          imageName: photos[pi % photos.length].name,
        });
      }
    }
    return { slides, slidesPerCarousel, totalCarousels: postRows.length };
  };

  const handleGenerateFromAi = async () => {
    if (!photos.length) { toast.error("Please upload at least one photo"); return; }
    if (!aiIndustry.trim()) { toast.error("Please enter an industry in the Content Machine brief"); return; }
    if (!aiTopics.trim()) { toast.error("Please enter topics in the Content Machine brief"); return; }

    setIsGenerating(true);

    try {
      let posts = aiGeneratedPosts;
      if (!posts?.length) {
        setAiGenerating(true);
        setAiProgress("Starting content generation...");
        const toastId = toast.loading("AI is writing your content...");

        const resp = await fetch(`/api/content/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: aiClientName,
            industry: aiIndustry,
            tone: aiTone,
            topics: aiTopics,
            postCount: aiPostCount,
            slidesPerPost: 5,
            extraInstructions: aiExtraInstructions,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Server error" }));
          throw new Error(err.error || "Generation failed");
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No response stream");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "progress") {
                setAiProgress(`Generated ${evt.generated} of ${evt.total} posts...`);
              } else if (evt.type === "complete") {
                posts = evt.posts;
                setAiGeneratedPosts(evt.posts);
                setAiProgress("");
                toast.success(`${evt.postCount} posts generated — building slides...`, { id: toastId });
              } else if (evt.type === "error") {
                toast.error(evt.message);
              }
            } catch {}
          }
        }
        setAiGenerating(false);
      }

      if (!posts?.length) throw new Error("No content was generated");

      const buildToast = toast.loading("Building carousel slides...");
      const { slides, slidesPerCarousel, totalCarousels } = buildSlidesFromPosts(posts);
      setResult({ slides, totalSlides: slides.length, slidesPerCarousel, totalCarousels, sessionId: "local" });
      setCurrentStep(4);
      toast.success(`${slides.length} slides generated — ready to download`, { id: buildToast });
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "Unknown error"));
    } finally {
      setIsGenerating(false);
      setAiGenerating(false);
    }
  };

  const handleStartOver = () => {
    setPhotos([]); setCsvFile(null);
    setCsvPreview({ headers: [], rows: [] }); setAllCsvRows([]); setCaptions([]); setResult(null);
    setAiGeneratedPosts(null); setAiProgress(""); setCurrentStep(1);
  };

  const downloadZip = async () => {
    if (!result?.slides.length) return;
    const id = toast.loading("Building ZIP…");
    try {
      await document.fonts.ready;
      const zip = new JSZip();
      for (const slide of result.slides) {
        const isCover = slide.groupPosition === 1;
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, slide.text, fontFamily, fontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, gradientColor, gradientEnabled, gradientStyle, gradientPosition, slide.groupPosition, result.slidesPerCarousel, textPosition);
        URL.revokeObjectURL(img.src);
        const outBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (outBlob) {
          zip.file(`carousel-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`, outBlob);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      toast.success("Download started", { id });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP", { id });
    }
  };

  const recreatePortraits = async () => {
    if (!clinicianPhoto) {
      toast.error("Please select a photo first");
      return;
    }
    setClinicianRecreating(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const resp = await fetch(`${import.meta.env.BASE_URL}api/content/clinician-recreate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Server error ${resp.status}`);
        }
        const data = await resp.json();
        if (data.portraits) {
          setClinicianPortraits(data.portraits);
          toast.success("Portraits created successfully!");
        } else {
          throw new Error("No portraits generated");
        }
      };
      reader.readAsDataURL(clinicianPhoto);
    } catch (err: any) {
      toast.error(err.message || "Failed to recreate portraits");
    } finally {
      setClinicianRecreating(false);
    }
  };

  const addPortraitAsPhoto = async (url: string) => {
    try {
      let blob: Blob;
      if (url.startsWith("data:")) {
        const parts = url.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
        const raw = atob(parts[1]);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const resp = await fetch(url);
        blob = await resp.blob();
      }
      const file = new File([blob], `portrait-${Date.now()}.png`, { type: "image/png" });
      setPhotos(prev => [...prev, file]);
      toast.success("Portrait added to carousel");
    } catch {
      toast.error("Failed to add portrait");
    }
  };

  const generateCaptions = async () => {
    const posts = aiGeneratedPosts || (allCsvRows.length > 0 ? allCsvRows : null);
    if (!posts || posts.length === 0) return;
    setCaptionGenerating(true);
    setCaptionProgress("Starting caption generation...");
    setCaptions([]);
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/content/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts,
          clientName: aiClientName,
          industry: aiIndustry || "aesthetics",
          tone: aiTone,
          extraInstructions: aiExtraInstructions,
        }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              setCaptionProgress(`Generating captions... ${data.generated}/${data.total}`);
            } else if (data.type === "complete") {
              setCaptions(data.captions || []);
              setCaptionProgress("");
            } else if (data.type === "error") {
              setCaptionProgress(data.message || "Error generating captions");
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setCaptionProgress("Failed to generate captions");
    } finally {
      setCaptionGenerating(false);
    }
  };

  const copyCaption = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCaptions = () => {
    const all = captions.map((c, i) => `--- Carousel ${i + 1} ---\n${c}`).join("\n\n");
    navigator.clipboard.writeText(all);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const selectedFontLabel = FONT_OPTIONS.find((f) => f.value === fontFamily)?.label ?? "Inter";
  const previewLogoScale = 0.18;
  const previewLogoH = Math.round(logoSize * previewLogoScale);

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-sans text-xl font-bold tracking-tight">Social Media Sister</h1>
          <span className="text-[10px] text-muted-foreground/40 ml-2">v5</span>
        </div>
        {result && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleStartOver} className="text-muted-foreground border-muted-foreground/20 hover:text-foreground">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button size="sm" onClick={downloadZip} data-testid="button-download-zip">
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 pb-32">
        {/* Step Progress Bar */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              {[
                { num: 1, label: "Images", icon: Camera },
                { num: 2, label: "Font & Layout", icon: Type },
                { num: 3, label: "Content", icon: PenTool },
                { num: 4, label: "Generate", icon: Sparkles },
              ].map((step, i) => (
                <React.Fragment key={step.num}>
                  <button
                    onClick={() => setCurrentStep(step.num)}
                    className={`flex flex-col items-center gap-2 transition-all ${
                      currentStep === step.num
                        ? "text-primary"
                        : currentStep > step.num
                        ? "text-green-400"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                        currentStep === step.num
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                          : currentStep > step.num
                          ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                          : "bg-accent/30 text-muted-foreground/40"
                      }`}
                    >
                      {currentStep > step.num ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                    </div>
                    <span className="text-sm font-semibold">{step.num}. {step.label}</span>
                  </button>
                  {i < 3 && (
                    <div className={`flex-1 h-1 rounded-full mx-3 mt-[-20px] ${currentStep > step.num ? "bg-green-500/30" : "bg-accent/20"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-8">

            {/* ═══════ STEP 1: Images ═══════ */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 1: Your Images</h2>
                  <p className="text-lg text-muted-foreground">Upload your photos, use AI to recreate portraits, and add your logo.</p>
                </div>

                {/* Photos upload */}
                <div
                  data-testid="drop-zone-photos"
                  className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingPhotos ? "drop-zone-dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                  onDragLeave={() => setIsDraggingPhotos(false)}
                  onDrop={handlePhotosDrop}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <input ref={photoInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handlePhotosChange} data-testid="input-photos" />
                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-xl">Photos</p>
                    <p className="text-base text-muted-foreground mt-1">
                      {photos.length > 0 ? `${photos.length} selected — click to add more` : "Drag & drop or click to upload"}
                    </p>
                  </div>
                </div>

              {/* SAY CHEESE */}
              {clinicianPortraits.length === 0 ? (
                <div className="flex flex-col items-center gap-4">
                  {clinicianPhoto && (
                    <p className="text-lg text-muted-foreground">
                      Selected: <span className="text-foreground font-medium">{clinicianPhoto.name}</span>
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (clinicianPhoto) {
                        recreatePortraits();
                      } else {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) setClinicianPhoto(file);
                        };
                        input.click();
                      }
                    }}
                    disabled={clinicianRecreating}
                    className="w-full rounded-2xl bg-[#ff1493] hover:bg-[#ff1493]/90 disabled:opacity-50 text-white px-10 py-10 text-4xl font-black shadow-2xl shadow-pink-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-4"
                  >
                    {clinicianRecreating ? (
                      <><Loader2 className="w-10 h-10 animate-spin" />Creating 5 Styles...</>
                    ) : clinicianPhoto ? (
                      <><Sparkles className="w-10 h-10" />SAY CHEESE</>
                    ) : (
                      <><ImageIcon className="w-10 h-10" />SAY CHEESE</>
                    )}
                  </button>
                  <p className="text-base text-muted-foreground text-center">
                    {clinicianPhoto ? "Click to recreate in 5 professional portrait styles" : "Select a portrait photo to recreate in 5 professional styles"}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/30 bg-card/50 p-8 space-y-6">
                  <p className="text-2xl font-bold text-center">Your 5 Portrait Styles:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {clinicianPortraits.map((portrait, i) => (
                      <div key={i} className="rounded-xl border border-border/30 overflow-hidden bg-accent/5">
                        <img src={portrait.image} alt={portrait.style} className="w-full aspect-square object-cover" />
                        <div className="p-4 space-y-3">
                          <p className="font-semibold text-lg capitalize">
                            {portrait.style === "bailey" ? "David Bailey Style" : portrait.style === "closeup" ? "Close-up" : portrait.style === "patient" ? "Patient Consultation" : portrait.style === "editorial" ? "Editorial" : "Classic Portrait"}
                          </p>
                          <Button onClick={() => addPortraitAsPhoto(portrait.image)} className="w-full py-5 text-base font-semibold" size="lg">
                            <Plus className="w-5 h-5 mr-2" />Add to Carousel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => { setClinicianPortraits([]); setClinicianPhoto(null); }} className="w-full py-5 text-base font-semibold" size="lg">
                    <RefreshCcw className="w-5 h-5 mr-2" />Try Another Photo
                  </Button>
                </div>
              )}

              {/* Logo */}
              <div
                data-testid="drop-zone-logo"
                className={`drop-zone-idle rounded-2xl min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingLogo ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                onDragLeave={() => setIsDraggingLogo(false)}
                onDrop={handleLogoDrop}
                onClick={() => logoInputRef.current?.click()}
              >
                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} data-testid="input-logo" />
                {logoPreviewUrl ? (
                  <>
                    <div className="relative">
                      <img src={logoPreviewUrl} alt="Logo preview" className="h-12 max-w-[140px] object-contain" />
                      <button onClick={(e) => { e.stopPropagation(); setLogoFile(null); }} className="absolute -top-2 -right-2 p-0.5 bg-black/70 hover:bg-black/90 text-white rounded-full"><X className="w-3 h-3" /></button>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-[240px]">{logoFile?.name}</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary"><Layers className="w-7 h-7" /></div>
                    <div>
                      <p className="font-semibold text-lg">Logo <span className="text-muted-foreground font-normal">(optional)</span></p>
                      <p className="text-base text-muted-foreground mt-1">Drag & drop or click to upload</p>
                    </div>
                  </>
                )}
              </div>

              {/* Photo thumbnails */}
              {photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg">Selected Photos</h3>
                    <Badge variant="secondary" className="bg-accent text-sm">{photos.length}</Badge>
                  </div>
                  <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
                    {photos.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-accent cursor-pointer hover:shadow-[0_0_0_2px_hsl(var(--primary)/0.5),0_0_16px_hsl(var(--primary)/0.15)] transition-shadow duration-200">
                        <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <button onClick={(e) => { e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1 Navigation */}
              <div className="flex justify-end pt-4">
                <Button onClick={() => setCurrentStep(2)} className="px-8 py-6 text-lg font-semibold" size="lg">
                  Next: Font & Layout <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
              </div>
            )}

            {/* ═══════ STEP 2: Font & Layout ═══════ */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 2: Font & Layout</h2>
                  <p className="text-lg text-muted-foreground">Customise the look and feel of your carousel slides.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Font */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Font</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="h-12 text-base" data-testid="select-font">
                        <SelectValue><span style={{ fontFamily }}>{selectedFontLabel}</span></SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text Size */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Text Size</Label>
                      <span className="text-base font-semibold tabular-nums">{fontSize}px</span>
                    </div>
                    <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" />
                  </div>

                  {/* Text Colour */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Text Colour</Label>
                    <div className="flex gap-3">
                      <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" data-testid="input-text-color" />
                      <Input type="text" value={textColor.toUpperCase()} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#ffffff" />
                    </div>
                  </div>

                  {/* Text Position */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Text Position</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "top-left", label: "TL" }, { value: "top-center", label: "TC" }, { value: "top-right", label: "TR" },
                        { value: "center-left", label: "CL" }, { value: "center-center", label: "CC" }, { value: "center-right", label: "CR" },
                        { value: "bottom-left", label: "BL" }, { value: "bottom-center", label: "BC" }, { value: "bottom-right", label: "BR" },
                      ].map((opt) => (
                        <button key={opt.value} onClick={() => setTextPosition(opt.value)}
                          className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${textPosition === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                        >{opt.label}</button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground/60">Last slide always centre</p>
                  </div>

                  {/* Line Spacing */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Line Spacing</Label>
                      <span className="text-base font-semibold tabular-nums">{lineSpacing.toFixed(2)}</span>
                    </div>
                    <Slider min={0.7} max={2} step={0.05} value={[lineSpacing]} onValueChange={([v]) => setLineSpacing(v)} className="w-full" />
                  </div>

                  {/* Page Colour */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Page Colour</Label>
                    <div className="flex gap-3">
                      <Input type="color" value={pageColor} onChange={(e) => setPageColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                      <Input type="text" value={pageColor} onChange={(e) => setPageColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#000000" />
                    </div>
                  </div>

                  {/* Overlay Colour */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Overlay Colour</Label>
                    <div className="flex gap-3">
                      <Input
                        type="color"
                        value={(() => {
                          if (overlayColor.startsWith("#")) return overlayColor;
                          const m = overlayColor.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                          if (m) return "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
                          return "#000000";
                        })()}
                        onChange={(e) => {
                          const hex = e.target.value;
                          const a = overlayColor.includes(",") ? overlayColor.match(/[\d.]+\)$/)?.[0]?.slice(0, -1) || "0.5" : "0.5";
                          setOverlayColor(`rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`);
                        }}
                        className="w-14 h-12 p-1 cursor-pointer"
                      />
                      <Input type="text" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="rgba(0,0,0,0.5)" />
                    </div>
                  </div>

                  {/* Corner Accent */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Corner Accent</Label>
                    <Select value={cornerStyle} onValueChange={setCornerStyle}>
                      <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CORNER_STYLES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {cornerStyle !== "none" && (
                      <div className="flex gap-3">
                        <Input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                        <Input type="text" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#d4af37" />
                      </div>
                    )}
                  </div>

                  {/* Gradient */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6 md:col-span-2">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Gradient</Label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setGradientEnabled(!gradientEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${gradientEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${gradientEnabled ? "left-[26px]" : "left-0.5"}`} />
                      </button>
                      <span className="text-base text-muted-foreground">{gradientEnabled ? "On" : "Off"}</span>
                    </div>
                    {gradientEnabled && (
                      <div className="space-y-4 pt-2">
                        <div className="flex gap-3">
                          {[{ value: "solid", label: "Solid" }, { value: "leopard", label: "Leopard" }].map((opt) => (
                            <button key={opt.value} onClick={() => setGradientStyle(opt.value)}
                              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${gradientStyle === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                            >{opt.label}</button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" },
                            { value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }].map((opt) => (
                            <button key={opt.value} onClick={() => setGradientPosition(opt.value)}
                              className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${gradientPosition === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                            >{opt.label}</button>
                          ))}
                        </div>
                        {gradientStyle === "solid" && (
                          <div className="flex gap-3">
                            <Input type="color" value={gradientColor} onChange={(e) => setGradientColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                            <Input type="text" value={gradientColor} onChange={(e) => setGradientColor(e.target.value)} className="flex-1 h-12 text-base font-mono" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Logo controls */}
                  {logoFile && (
                    <>
                      <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                        <Label className="text-base font-semibold">Logo Position</Label>
                        <Select value={logoPosition} onValueChange={setLogoPosition}>
                          <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LOGO_POSITIONS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Logo Size</Label>
                          <span className="text-base font-semibold tabular-nums">{logoSize}px</span>
                        </div>
                        <Slider min={40} max={300} step={10} value={[logoSize]} onValueChange={([v]) => setLogoSize(v)} className="w-full" />
                      </div>
                    </>
                  )}
                </div>

                {/* Step 2 Navigation */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} className="px-8 py-6 text-lg font-semibold" size="lg">
                    <ChevronLeft className="w-5 h-5 mr-2" /> Back
                  </Button>
                  <Button onClick={() => setCurrentStep(3)} className="px-8 py-6 text-lg font-semibold" size="lg">
                    Next: Content <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════ STEP 3: Content ═══════ */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 3: Your Content</h2>
                  <p className="text-lg text-muted-foreground">Choose how to create the text for your carousel slides.</p>
                </div>

                {/* Mode toggle */}
                <div className="flex rounded-xl overflow-hidden border border-border/30">
                  <button onClick={() => setContentMode("csv")}
                    className={`flex-1 flex items-center justify-center gap-3 py-6 text-lg font-semibold rounded-xl transition-colors ${contentMode === "csv" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent text-muted-foreground"}`}
                  ><FileText className="w-6 h-6" />Upload CSV</button>
                  <button onClick={() => setContentMode("ai")}
                    className={`flex-1 flex items-center justify-center gap-3 py-6 text-lg font-semibold rounded-xl transition-colors ${contentMode === "ai" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent text-muted-foreground"}`}
                  ><Sparkles className="w-6 h-6" />Content Machine</button>
                </div>

                {/* CSV upload */}
                {contentMode === "csv" && (
                  <>
                    <div
                      data-testid="drop-zone-csv"
                      className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingCsv ? "drop-zone-dragging" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                      onDragLeave={() => setIsDraggingCsv(false)}
                      onDrop={handleCsvDrop}
                      onClick={() => csvInputRef.current?.click()}
                    >
                      <input ref={csvInputRef} type="file" className="hidden" accept=".csv,text/csv" onChange={handleCsvChange} data-testid="input-csv" />
                      <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary"><FileText className="w-7 h-7" /></div>
                      <div>
                        <p className="font-semibold text-lg">CSV File</p>
                        <p className="text-base text-muted-foreground mt-1 truncate max-w-[300px]">
                          {csvFile ? csvFile.name : "Drag & drop or click to upload"}
                        </p>
                      </div>
                    </div>

                    {csvPreview.rows.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-medium text-lg">CSV Preview</h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                          {csvPreview.rows.map((row, ri) => (
                            <div key={ri} className="rounded-xl border border-border/30 bg-accent/20 overflow-hidden">
                              <div className="px-4 py-2.5 bg-accent/30 flex items-center gap-2">
                                <span className="text-primary font-mono text-sm font-bold">{String(ri + 1).padStart(2, "0")}</span>
                                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Carousel {ri + 1}</span>
                              </div>
                              <div className="p-4 space-y-3">
                                {row.map((cell, ci) => (
                                  <div key={ci} className="flex gap-3">
                                    <span className={`text-sm font-semibold mt-0.5 flex-shrink-0 w-16 ${ci === 0 ? "text-primary" : "text-muted-foreground/60"}`}>
                                      {ci === 0 ? "Hook" : `Slide ${ci + 1}`}
                                    </span>
                                    <p className={`text-base leading-relaxed ${ci === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{cell}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground/70 italic">Showing first 3 rows - each row becomes one carousel</p>
                      </div>
                    )}
                  </>
                )}

                {/* AI Content Machine */}
                {contentMode === "ai" && (
                  <div className="rounded-2xl border border-border/30 bg-card/50 p-8 space-y-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Wand2 className="w-6 h-6 text-primary" />
                      <h3 className="font-semibold text-xl">Content Brief</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Client / Brand Name</Label>
                        <Input value={aiClientName} onChange={(e) => setAiClientName(e.target.value)} placeholder="e.g. Glow Aesthetics" className="h-12 text-base" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Industry *</Label>
                        <Input value={aiIndustry} onChange={(e) => setAiIndustry(e.target.value)} placeholder="e.g. Aesthetics clinic" className="h-12 text-base" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Tone of Voice</Label>
                      <Select value={aiTone} onValueChange={setAiTone}>
                        <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warm & professional">Warm & Professional</SelectItem>
                          <SelectItem value="bold & edgy">Bold & Edgy</SelectItem>
                          <SelectItem value="luxury & aspirational">Luxury & Aspirational</SelectItem>
                          <SelectItem value="friendly & casual">Friendly & Casual</SelectItem>
                          <SelectItem value="clinical & authoritative">Clinical & Authoritative</SelectItem>
                          <SelectItem value="playful & fun">Playful & Fun</SelectItem>
                          <SelectItem value="empathetic & caring">Empathetic & Caring</SelectItem>
                          <SelectItem value="minimalist & clean">Minimalist & Clean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Topics to Cover *</Label>
                      <textarea value={aiTopics} onChange={(e) => setAiTopics(e.target.value)}
                        placeholder="e.g. Botox benefits, skin care tips, client testimonials"
                        className="w-full min-h-[100px] rounded-lg border border-border bg-background px-4 py-3 text-base resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Number of Posts</Label>
                        <div className="flex items-center gap-3">
                          <Slider min={5} max={60} step={5} value={[aiPostCount]} onValueChange={([v]) => setAiPostCount(v)} className="flex-1" />
                          <span className="text-lg font-semibold tabular-nums w-10 text-right">{aiPostCount}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Extra Instructions</Label>
                        <Input value={aiExtraInstructions} onChange={(e) => setAiExtraInstructions(e.target.value)} placeholder="e.g. Always mention our clinic name" className="h-12 text-base" />
                      </div>
                    </div>

                    <button className="btn-shimmer w-full h-14 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleAiGenerate} disabled={aiGenerating}
                    >
                      {aiGenerating ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />{aiProgress || "Generating..."}</>
                      ) : (
                        <><Sparkles className="w-5 h-5" />Generate {aiPostCount} Posts with AI</>
                      )}
                    </button>

                    {aiGeneratedPosts && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-lg text-green-400">Content Ready</h4>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-400 text-base">{aiGeneratedPosts.length} posts</Badge>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                          {aiGeneratedPosts.slice(0, 8).map((row, ri) => (
                            <div key={ri} className="rounded-xl border border-border/30 bg-accent/20 overflow-hidden">
                              <div className="px-4 py-2.5 bg-accent/30 flex items-center gap-2">
                                <span className="text-primary font-mono text-sm font-bold">{String(ri + 1).padStart(2, "0")}</span>
                                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Carousel {ri + 1}</span>
                              </div>
                              <div className="p-4 space-y-3">
                                {row.map((cell, ci) => (
                                  <div key={ci} className="flex gap-3">
                                    <span className={`text-sm font-semibold mt-0.5 flex-shrink-0 w-16 ${ci === 0 ? "text-primary" : "text-muted-foreground/60"}`}>
                                      {ci === 0 ? "Hook" : ci === row.length - 1 ? "CTA" : `Slide ${ci + 1}`}
                                    </span>
                                    <p className={`text-base leading-relaxed ${ci === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{cell}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {aiGeneratedPosts.length > 8 && (
                            <p className="text-sm text-muted-foreground/70 italic text-center py-2">Showing first 8 of {aiGeneratedPosts.length} posts</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3 Navigation */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="px-8 py-6 text-lg font-semibold" size="lg">
                    <ChevronLeft className="w-5 h-5 mr-2" /> Back
                  </Button>
                  <button
                    className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (contentMode === "ai") {
                        handleGenerateFromAi();
                      } else {
                        handleGenerate();
                      }
                    }}
                    disabled={isGenerating || aiGenerating}
                    data-testid="button-generate"
                  >
                    {isGenerating || aiGenerating ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />{aiGenerating ? (aiProgress || "Writing content...") : "Generating..."}</>
                    ) : (
                      <>Generate Carousel Posts <ChevronRight className="w-5 h-5" /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ═══════ STEP 4: Results & Captions ═══════ */}
            {currentStep === 4 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {!result ? (
                  <>
                    <div>
                      <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 4: Generate</h2>
                      <p className="text-lg text-muted-foreground">Generate your carousel posts first, then create captions.</p>
                    </div>
                    <div className="text-center py-12">
                      <p className="text-xl text-muted-foreground mb-6">Complete Step 3 first to generate your carousels</p>
                      <Button variant="outline" onClick={() => setCurrentStep(3)} className="px-8 py-6 text-lg font-semibold" size="lg">
                        <ChevronLeft className="w-5 h-5 mr-2" /> Go to Step 3
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-serif text-4xl font-semibold mb-2 tracking-tight">Your Carousels are Ready</h2>
                        <p className="text-lg text-muted-foreground">
                          {result.totalCarousels} carousels &times; {result.slidesPerCarousel} slides at 1080 &times; 1350 px
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button className="btn-shimmer px-8 py-4 rounded-2xl text-lg font-bold flex items-center gap-3" onClick={downloadZip} data-testid="button-download-zip-bar">
                          <Download className="w-5 h-5" />Download ZIP
                        </button>
                      </div>
                    </div>

                    <div className="space-y-10">
                      {Array.from({ length: result.totalCarousels }, (_, gi) => {
                        const groupSlides = result.slides.filter((s: any) => s.groupIndex === gi + 1);
                        return (
                          <div key={gi} className="space-y-4">
                            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                              Carousel {String(gi + 1).padStart(2, "0")}
                            </p>
                            <div className="grid grid-cols-5 gap-4">
                              {groupSlides.map((slide: any) => {
                                const isCover = slide.groupPosition === 1;
                                return (
                                  <div key={slide.slideIndex} className="relative rounded-2xl overflow-hidden shadow-md hover:shadow-[0_0_24px_hsl(var(--primary)/0.15)] transition-shadow duration-300" style={{ aspectRatio: "4/5" }} data-testid={`slide-card-${slide.slideIndex}`}>
                                    <img src={slide.imageUrl} alt={`Carousel ${slide.groupIndex} slide ${slide.groupPosition}`} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: isCover ? 1 : 0.5 }} />
                                    {gradientEnabled && (() => {
                                      const posMap: Record<string, React.CSSProperties> = {
                                        left: { left: 0, top: 0, width: "35%", height: "100%" },
                                        center: { left: "32.5%", top: 0, width: "35%", height: "100%" },
                                        right: { right: 0, top: 0, width: "35%", height: "100%" },
                                        top: { left: 0, top: 0, width: "100%", height: "30%" },
                                        middle: { left: 0, top: "35%", width: "100%", height: "30%" },
                                        bottom: { left: 0, bottom: 0, width: "100%", height: "30%" },
                                      };
                                      const dirMap: Record<string, string> = { left: "to right", center: "to right", right: "to left", top: "to bottom", middle: "to bottom", bottom: "to top" };
                                      const style = posMap[gradientPosition] || posMap.left;
                                      const dir = dirMap[gradientPosition] || "to right";
                                      const baseColor = gradientStyle === "leopard" ? "#c8a44e" : gradientColor;
                                      return <div className="absolute" style={{ ...style, background: `linear-gradient(${dir}, ${baseColor}cc, transparent)`, position: "absolute" }} />;
                                    })()}
                                    {logoPreviewUrl && (() => {
                                      const posStyle: React.CSSProperties = { position: "absolute" };
                                      if (logoPosition === "top-left") { posStyle.top = 4; posStyle.left = 4; }
                                      else if (logoPosition === "top-right") { posStyle.top = 4; posStyle.right = 4; }
                                      else if (logoPosition === "bottom-left") { posStyle.bottom = 24; posStyle.left = 4; }
                                      else { posStyle.bottom = 24; posStyle.right = 4; }
                                      return <img src={logoPreviewUrl} alt="Logo" style={{ ...posStyle, height: previewLogoH, maxWidth: 60, objectFit: "contain" }} />;
                                    })()}
                                    <div className="absolute bottom-4 left-3 px-2 py-1.5 rounded-sm" style={{ backgroundColor: overlayColor }}>
                                      <p className="font-semibold line-clamp-4" style={{ fontFamily, fontSize: Math.max(7, Math.round(fontSize * 0.15)) + "px", color: textColor, lineHeight: lineSpacing }}>{slide.text}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Captions Section */}
                    <div className="space-y-6 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MessageSquareText className="w-6 h-6 text-primary" />
                          <h2 className="font-serif text-3xl font-semibold tracking-tight">Post Captions</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          {captions.length > 0 && (
                            <Button variant="outline" size="lg" onClick={copyAllCaptions} className="py-4 text-base">
                              {copiedIndex === -1 ? <><Check className="w-5 h-5 mr-2" />Copied!</> : <><Copy className="w-5 h-5 mr-2" />Copy All</>}
                            </Button>
                          )}
                          <Button size="lg" onClick={generateCaptions} disabled={captionGenerating} className="bg-primary text-primary-foreground py-4 text-base">
                            {captionGenerating ? (
                              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{captionProgress || "Generating..."}</>
                            ) : captions.length > 0 ? (
                              <><RefreshCcw className="w-5 h-5 mr-2" />Regenerate Captions</>
                            ) : (
                              <><Sparkles className="w-5 h-5 mr-2" />Generate Captions</>
                            )}
                          </Button>
                        </div>
                      </div>

                      {captions.length === 0 && !captionGenerating && (
                        <div className="rounded-xl border border-dashed border-border/40 bg-accent/10 p-8 text-center">
                          <MessageSquareText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-lg text-muted-foreground">Generate ready-to-post captions for each carousel, complete with hashtags and calls to action.</p>
                        </div>
                      )}

                      {captions.length > 0 && (
                        <div className="space-y-4">
                          {captions.map((caption, i) => (
                            <div key={i} className="rounded-xl border border-border/30 bg-accent/20 overflow-hidden group">
                              <div className="px-4 py-3 bg-accent/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-mono text-sm font-bold">{String(i + 1).padStart(2, "0")}</span>
                                  <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Carousel {i + 1} Caption</span>
                                </div>
                                <button onClick={() => copyCaption(caption, i)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                  {copiedIndex === i ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-4 h-4" /><span>Copy</span></>}
                                </button>
                              </div>
                              <div className="p-4">
                                <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">{caption}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 4 Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={handleStartOver} className="px-8 py-6 text-lg font-semibold" size="lg">
                        <RefreshCcw className="w-5 h-5 mr-2" /> Start Over
                      </Button>
                      <button className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3" onClick={downloadZip} data-testid="button-download-zip">
                        <Download className="w-5 h-5" />Download ZIP
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
      </main>

      <VanessaChat />
    </div>
  );
}
