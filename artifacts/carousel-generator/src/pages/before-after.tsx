import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Image as ImageIcon,
  Loader2,
  Download,
  RefreshCcw,
  Layers,
  X,
  Palette,
  Sparkles,
  Check,
  Copy,
  Plus,
  ChevronLeft,
  ChevronRight,
  Type,
  ArrowLeftRight,
  ArrowUpDown,
  Tag,
  Trash2,
  FileText,
  ImagePlus,
  BookOpen,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePresets, type ClientPreset, type PresetStyleFields } from "@/lib/use-presets";
import { useCaptions } from "@/lib/use-captions";
import PresetSelector from "@/components/preset-selector";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Lato", value: "'Lato', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', serif" },
  { label: "Quicksand", value: "'Quicksand', sans-serif" },
  { label: "Nunito", value: "'Nunito', sans-serif" },
  { label: "Work Sans", value: "'Work Sans', sans-serif" },
];

const TREATMENT_PRESETS = [
  "Lip Filler",
  "Skin Rejuvenation",
  "Dermal Fillers",
  "Chemical Peel",
  "Microneedling",
  "Laser Treatment",
  "Facial Aesthetics",
  "Body Contouring",
  "Teeth Whitening",
  "Hair Restoration",
];

interface PhotoPair {
  id: string;
  beforeFile: File;
  afterFile: File;
  beforeUrl: string;
  afterUrl: string;
  treatmentType: string;
  area: string;
  notes: string;
}

interface GeneratedContent {
  caption: string;
  beforeLabel: string;
  afterLabel: string;
  hookText: string;
  treatmentType: string;
}

type LayoutMode = "side-by-side" | "stacked";

function drawBeforeAfterSlide(
  ctx: CanvasRenderingContext2D,
  beforeImg: HTMLImageElement,
  afterImg: HTMLImageElement,
  layout: LayoutMode,
  font: string,
  fontSize: number,
  textColor: string,
  overlayColor: string,
  accentColor: string,
  beforeLabel: string,
  afterLabel: string,
  logoImg: HTMLImageElement | null,
  logoPosition: string,
  logoSize: number,
  pageColor: string
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  if (layout === "side-by-side") {
    const halfW = Math.floor(W / 2) - 4;
    const gap = 8;

    drawImageCover(ctx, beforeImg, 0, 0, halfW, H);
    drawImageCover(ctx, afterImg, halfW + gap, 0, halfW, H);

    ctx.fillStyle = accentColor;
    ctx.fillRect(halfW, 0, gap, H);

    const labelH = 80;
    const labelY = H - labelH - 40;
    ctx.fillStyle = overlayColor;
    ctx.fillRect(20, labelY, halfW - 40, labelH);
    ctx.fillRect(halfW + gap + 20, labelY, halfW - 40, labelH);

    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(fontSize * 0.7)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(beforeLabel, Math.floor(halfW / 2), labelY + labelH / 2);
    ctx.fillText(afterLabel, halfW + gap + Math.floor(halfW / 2), labelY + labelH / 2);
  } else {
    const halfH = Math.floor(H / 2) - 4;
    const gap = 8;

    drawImageCover(ctx, beforeImg, 0, 0, W, halfH);
    drawImageCover(ctx, afterImg, 0, halfH + gap, W, halfH);

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, halfH, W, gap);

    const labelH = 70;
    ctx.fillStyle = overlayColor;
    ctx.fillRect(30, halfH - labelH - 20, 300, labelH);
    ctx.fillRect(30, H - labelH - 20, 300, labelH);

    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(fontSize * 0.7)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(beforeLabel, 180, halfH - labelH / 2 - 20);
    ctx.fillText(afterLabel, 180, H - labelH / 2 - 20);
  }

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

function drawCoverSlide(
  ctx: CanvasRenderingContext2D,
  beforeImg: HTMLImageElement,
  afterImg: HTMLImageElement,
  font: string,
  fontSize: number,
  textColor: string,
  overlayColor: string,
  accentColor: string,
  hookText: string,
  treatmentType: string,
  logoImg: HTMLImageElement | null,
  logoPosition: string,
  logoSize: number,
  pageColor: string
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  ctx.fillStyle = pageColor;
  ctx.fillRect(0, 0, W, H);

  drawImageCover(ctx, afterImg, 0, 0, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = accentColor;
  ctx.fillRect(W / 2 - 60, H / 2 - 160, 120, 6);

  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxW = W - 120;
  const lineH = Math.round(fontSize * 1.1);
  const words = hookText.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const totalH = lines.length * lineH;
  const startY = H / 2 - totalH / 2 - 80;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * lineH);
  });

  ctx.font = `600 ${Math.round(fontSize * 0.45)}px ${font}`;
  ctx.fillStyle = accentColor;
  ctx.fillText(treatmentType.toUpperCase(), W / 2, startY + totalH + 40);

  ctx.fillStyle = accentColor;
  ctx.fillRect(W / 2 - 60, startY + totalH + 70, 120, 6);

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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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
        (blob) =>
          resolve(
            blob
              ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
              : file
          ),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function BeforeAfter() {
  const [pairs, setPairs] = useState<PhotoPair[]>([]);
  const [pendingBefore, setPendingBefore] = useState<{ file: File; url: string } | null>(null);

  const [fontSize, setFontSize] = useState(52);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.6)");
  const [accentColor, setAccentColor] = useState("#d4af37");
  const [pageColor, setPageColor] = useState("#000000");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("side-by-side");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [logoSize, setLogoSize] = useState(140);

  const [aiClientName, setAiClientName] = useState("");
  const [aiIndustry, setAiIndustry] = useState("Aesthetics clinic");
  const [aiTone, setAiTone] = useState("warm & professional");
  const [aiExtraInstructions, setAiExtraInstructions] = useState("");

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState("");

  const [currentStep, setCurrentStep] = useState(1);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [previewPairIndex, setPreviewPairIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const { presets, loading: presetsLoading, savePreset, updatePreset, deletePreset, uploadLogo } = usePresets();
  const { saveCaption: saveCaptionToLib } = useCaptions();
  const [savedCaptionIndices, setSavedCaptionIndices] = useState<Set<number>>(new Set());
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  const getCurrentStyles = (): PresetStyleFields => ({
    pageColor, overlayColor, fontFamily, fontSize, textColor,
    lineSpacing: 0.9, cornerStyle: "none", cornerColor: accentColor,
    gradientEnabled: false, gradientStyle: "solid", gradientColor: "#000000",
    gradientPosition: "left", textPosition: "bottom-left",
    logoPosition, logoSize, accentColor,
  });

  const applyPreset = (preset: ClientPreset) => {
    setSelectedPresetId(preset.id);
    setPageColor(preset.pageColor);
    setOverlayColor(preset.overlayColor);
    setFontFamily(preset.fontFamily);
    setFontSize(preset.fontSize);
    setTextColor(preset.textColor);
    if (preset.accentColor) setAccentColor(preset.accentColor);
    setLogoPosition(preset.logoPosition);
    setLogoSize(preset.logoSize);
    setCurrentLogoUrl(preset.logoUrl || null);
    if (preset.logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { setLogoImg(img); setLogoPreviewUrl(preset.logoUrl); };
      img.src = preset.logoUrl;
    } else {
      setLogoImg(null);
      setLogoPreviewUrl(null);
      setLogoFile(null);
    }
  };

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewSlideType, setPreviewSlideType] = useState<"cover" | "comparison">("comparison");

  useEffect(() => {
    if (!logoFile) {
      setLogoImg(null);
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    const el = new Image();
    el.onload = () => setLogoImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (pairs.length === 0 || currentStep !== 4) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    const pair = pairs[previewPairIndex % pairs.length];
    const content = generatedContent[previewPairIndex];

    Promise.all([loadImage(pair.beforeUrl), loadImage(pair.afterUrl)]).then(
      ([beforeImg, afterImg]) => {
        if (previewSlideType === "cover") {
          drawCoverSlide(
            ctx,
            beforeImg,
            afterImg,
            fontFamily,
            fontSize,
            textColor,
            overlayColor,
            accentColor,
            content?.hookText || pair.treatmentType,
            content?.treatmentType || pair.treatmentType,
            logoImg,
            logoPosition,
            logoSize,
            pageColor
          );
        } else {
          drawBeforeAfterSlide(
            ctx,
            beforeImg,
            afterImg,
            layoutMode,
            fontFamily,
            fontSize,
            textColor,
            overlayColor,
            accentColor,
            content?.beforeLabel || "Before",
            content?.afterLabel || "After",
            logoImg,
            logoPosition,
            logoSize,
            pageColor
          );
        }
      }
    );
  }, [
    pairs,
    previewPairIndex,
    previewSlideType,
    currentStep,
    fontFamily,
    fontSize,
    textColor,
    overlayColor,
    accentColor,
    pageColor,
    layoutMode,
    logoImg,
    logoPosition,
    logoSize,
    generatedContent,
  ]);

  const addBeforePhoto = async (file: File) => {
    const compressed = await compressImage(file);
    const url = URL.createObjectURL(compressed);
    setPendingBefore({ file: compressed, url });
  };

  const addAfterPhoto = async (file: File) => {
    if (!pendingBefore) {
      toast.error("Please select a 'Before' photo first");
      return;
    }
    const compressed = await compressImage(file);
    const url = URL.createObjectURL(compressed);
    const newPair: PhotoPair = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      beforeFile: pendingBefore.file,
      afterFile: compressed,
      beforeUrl: pendingBefore.url,
      afterUrl: url,
      treatmentType: "",
      area: "",
      notes: "",
    };
    setPairs((prev) => [...prev, newPair]);
    setPendingBefore(null);
  };

  const removePair = (id: string) => {
    setPairs((prev) => {
      const pair = prev.find((p) => p.id === id);
      if (pair) {
        URL.revokeObjectURL(pair.beforeUrl);
        URL.revokeObjectURL(pair.afterUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const updatePair = (id: string, field: keyof PhotoPair, value: string) => {
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) setLogoFile(file);
  }, []);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
    },
    []
  );

  const handleBulkDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i += 2) {
      if (i + 1 < files.length) {
        const before = await compressImage(files[i]);
        const after = await compressImage(files[i + 1]);
        const newPair: PhotoPair = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          beforeFile: before,
          afterFile: after,
          beforeUrl: URL.createObjectURL(before),
          afterUrl: URL.createObjectURL(after),
          treatmentType: "",
          area: "",
          notes: "",
        };
        setPairs((prev) => [...prev, newPair]);
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (pairs.length === 0) {
      toast.error("Please add at least one before/after pair");
      return;
    }

    const missingTreatment = pairs.some((p) => !p.treatmentType.trim());
    if (missingTreatment) {
      toast.error("Please add a treatment type for each pair");
      return;
    }

    if (pairs.length > 30) {
      toast.error("Maximum 30 treatment pairs allowed");
      return;
    }

    setIsGenerating(true);
    setGeneratingProgress("Starting AI content generation...");
    const toastId = toast.loading("Generating before/after content...");

    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/content/before-after-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatments: pairs.map((p) => ({
            treatmentType: p.treatmentType,
            area: p.area,
            notes: p.notes,
          })),
          clientName: aiClientName,
          industry: aiIndustry,
          tone: aiTone,
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
      let generationFailed = false;

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
              setGeneratingProgress(
                `Generated ${evt.generated} of ${evt.total} captions...`
              );
            } else if (evt.type === "complete") {
              const results = evt.results || [];
              setGeneratedContent(results);
              setGeneratingProgress("");
              if (results.length === 0) {
                toast.error("AI failed to generate any content. Please try again.", { id: toastId });
                generationFailed = true;
              } else if (results.length < pairs.length) {
                toast.warning(`Only ${results.length} of ${pairs.length} captions were generated. Some may be missing.`, { id: toastId });
              } else {
                toast.success("Content generated successfully!", { id: toastId });
              }
            } else if (evt.type === "error") {
              toast.error(evt.message);
            }
          } catch {}
        }
      }

      if (!generationFailed) {
        setCurrentStep(4);
      }
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "Unknown error"), { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadZip = async () => {
    if (pairs.length === 0) return;
    const id = toast.loading("Building ZIP...");
    try {
      await document.fonts.ready;
      const zip = new JSZip();

      for (let pi = 0; pi < pairs.length; pi++) {
        const pair = pairs[pi];
        const content = generatedContent[pi];
        const prefix = `pair-${String(pi + 1).padStart(2, "0")}`;

        const [beforeImg, afterImg] = await Promise.all([
          loadImage(pair.beforeUrl),
          loadImage(pair.afterUrl),
        ]);

        const coverCanvas = document.createElement("canvas");
        coverCanvas.width = CANVAS_WIDTH;
        coverCanvas.height = CANVAS_HEIGHT;
        drawCoverSlide(
          coverCanvas.getContext("2d")!,
          beforeImg,
          afterImg,
          fontFamily,
          fontSize,
          textColor,
          overlayColor,
          accentColor,
          content?.hookText || pair.treatmentType,
          content?.treatmentType || pair.treatmentType,
          logoImg,
          logoPosition,
          logoSize,
          pageColor
        );
        const coverBlob = await new Promise<Blob | null>((r) =>
          coverCanvas.toBlob(r, "image/png")
        );
        if (coverBlob) zip.file(`${prefix}-01-cover.png`, coverBlob);

        const compCanvas = document.createElement("canvas");
        compCanvas.width = CANVAS_WIDTH;
        compCanvas.height = CANVAS_HEIGHT;
        drawBeforeAfterSlide(
          compCanvas.getContext("2d")!,
          beforeImg,
          afterImg,
          "side-by-side",
          fontFamily,
          fontSize,
          textColor,
          overlayColor,
          accentColor,
          content?.beforeLabel || "Before",
          content?.afterLabel || "After",
          logoImg,
          logoPosition,
          logoSize,
          pageColor
        );
        const compBlob = await new Promise<Blob | null>((r) =>
          compCanvas.toBlob(r, "image/png")
        );
        if (compBlob) zip.file(`${prefix}-02-side-by-side.png`, compBlob);

        const stackCanvas = document.createElement("canvas");
        stackCanvas.width = CANVAS_WIDTH;
        stackCanvas.height = CANVAS_HEIGHT;
        drawBeforeAfterSlide(
          stackCanvas.getContext("2d")!,
          beforeImg,
          afterImg,
          "stacked",
          fontFamily,
          fontSize,
          textColor,
          overlayColor,
          accentColor,
          content?.beforeLabel || "Before",
          content?.afterLabel || "After",
          logoImg,
          logoPosition,
          logoSize,
          pageColor
        );
        const stackBlob = await new Promise<Blob | null>((r) =>
          stackCanvas.toBlob(r, "image/png")
        );
        if (stackBlob) zip.file(`${prefix}-03-stacked.png`, stackBlob);

        if (content?.caption) {
          zip.file(`${prefix}-caption.txt`, content.caption);
        }
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      saveAs(zipContent, "before-after-posts.zip");
      toast.success("Download started", { id });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP", { id });
    }
  };

  const uploadOneImage = async (name: string, base64: string): Promise<string> => {
    const resp = await fetch(`${import.meta.env.BASE_URL}api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name, base64 }] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Upload failed");
    return data.results?.[0]?.url || "";
  };

  const downloadCsv = async () => {
    if (pairs.length === 0) return;
    const id = toast.loading("Rendering slides...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string }[] = [];

      for (let pi = 0; pi < pairs.length; pi++) {
        const pair = pairs[pi];
        const content = generatedContent[pi];
        const prefix = `pair-${String(pi + 1).padStart(2, "0")}`;

        const [beforeImg, afterImg] = await Promise.all([
          loadImage(pair.beforeUrl),
          loadImage(pair.afterUrl),
        ]);

        const coverCanvas = document.createElement("canvas");
        coverCanvas.width = CANVAS_WIDTH; coverCanvas.height = CANVAS_HEIGHT;
        drawCoverSlide(coverCanvas.getContext("2d")!, beforeImg, afterImg, fontFamily, fontSize, textColor, overlayColor, accentColor, content?.hookText || pair.treatmentType, content?.treatmentType || pair.treatmentType, logoImg, logoPosition, logoSize, pageColor);
        rendered.push({ name: `${prefix}-01-cover.png`, base64: coverCanvas.toDataURL("image/png") });

        const sideCanvas = document.createElement("canvas");
        sideCanvas.width = CANVAS_WIDTH; sideCanvas.height = CANVAS_HEIGHT;
        drawBeforeAfterSlide(sideCanvas.getContext("2d")!, beforeImg, afterImg, "side-by-side", fontFamily, fontSize, textColor, overlayColor, accentColor, content?.beforeLabel || "Before", content?.afterLabel || "After", logoImg, logoPosition, logoSize, pageColor);
        rendered.push({ name: `${prefix}-02-side-by-side.png`, base64: sideCanvas.toDataURL("image/png") });

        const stackCanvas = document.createElement("canvas");
        stackCanvas.width = CANVAS_WIDTH; stackCanvas.height = CANVAS_HEIGHT;
        drawBeforeAfterSlide(stackCanvas.getContext("2d")!, beforeImg, afterImg, "stacked", fontFamily, fontSize, textColor, overlayColor, accentColor, content?.beforeLabel || "Before", content?.afterLabel || "After", logoImg, logoPosition, logoSize, pageColor);
        rendered.push({ name: `${prefix}-03-stacked.png`, base64: stackCanvas.toDataURL("image/png") });
      }

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      const rows: string[][] = [];
      rows.push(["Treatment", "Caption", "Cover URL", "Side-by-Side URL", "Stacked URL"]);
      for (let pi = 0; pi < pairs.length; pi++) {
        const pair = pairs[pi];
        const content = generatedContent[pi];
        const prefix = `pair-${String(pi + 1).padStart(2, "0")}`;
        rows.push([
          content?.treatmentType || pair.treatmentType,
          content?.caption || "",
          urlMap.get(`${prefix}-01-cover.png`) || "",
          urlMap.get(`${prefix}-02-side-by-side.png`) || "",
          urlMap.get(`${prefix}-03-stacked.png`) || "",
        ]);
      }
      const csvString = Papa.unparse(rows);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvString], { type: "text/csv;charset=utf-8" });
      saveAs(blob, "before-after-posts.csv");
      toast.success("CSV downloaded with image links", { id });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed: " + (e?.message || "Unknown error"), { id });
    }
  };

  const handleStartOver = () => {
    pairs.forEach((p) => {
      URL.revokeObjectURL(p.beforeUrl);
      URL.revokeObjectURL(p.afterUrl);
    });
    setPairs([]);
    setPendingBefore(null);
    setGeneratedContent([]);
    setSavedCaptionIndices(new Set());
    setCurrentStep(1);
    setPreviewPairIndex(0);
  };

  const copyCaption = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const selectedFontLabel =
    FONT_OPTIONS.find((f) => f.value === fontFamily)?.label ?? "Inter";

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-sans text-xl font-bold tracking-tight">Social Media Sister</h1>
          <Badge variant="secondary" className="bg-accent text-xs">Before & After</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Carousel Mode
            </Button>
          </Link>
          <Link href="/single-image">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ImagePlus className="w-4 h-4 mr-2" />
              Single Image
            </Button>
          </Link>
          <Link href="/presets">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Palette className="w-4 h-4 mr-2" />
              Presets
            </Button>
          </Link>
          <Link href="/captions">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Captions
            </Button>
          </Link>
          {currentStep === 4 && (
            <>
              <Button variant="outline" size="sm" onClick={handleStartOver}>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCsv} data-testid="button-download-csv-ba">
                <FileText className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button size="sm" onClick={downloadZip} data-testid="button-download-zip-ba">
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 pb-32">
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            {[
              { num: 1, label: "Photos", icon: ImageIcon },
              { num: 2, label: "Style", icon: Palette },
              { num: 3, label: "Generate", icon: Sparkles },
              { num: 4, label: "Preview", icon: Download },
            ].map((step, i) => (
              <React.Fragment key={step.num}>
                <button
                  onClick={() => {
                    if (step.num <= currentStep || (step.num === currentStep + 1)) {
                      setCurrentStep(step.num);
                    }
                  }}
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
                    {currentStep > step.num ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-sm font-semibold">
                    {step.num}. {step.label}
                  </span>
                </button>
                {i < 3 && (
                  <div
                    className={`flex-1 h-1 rounded-full mx-3 mt-[-20px] ${
                      currentStep > step.num ? "bg-green-500/30" : "bg-accent/20"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {currentStep === 1 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">
                  Step 1: Before & After Photos
                </h2>
                <p className="text-lg text-muted-foreground">
                  Upload paired before and after photos for each treatment.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-6 ${
                    pendingBefore ? "border-green-500/50 bg-green-500/5" : ""
                  }`}
                  onClick={() => beforeInputRef.current?.click()}
                >
                  <input
                    ref={beforeInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      if (e.target.files?.[0]) await addBeforePhoto(e.target.files[0]);
                      e.target.value = "";
                    }}
                    data-testid="input-before-photo"
                  />
                  {pendingBefore ? (
                    <>
                      <img
                        src={pendingBefore.url}
                        alt="Before preview"
                        className="w-20 h-20 object-cover rounded-xl"
                      />
                      <p className="text-sm text-green-400 font-semibold">
                        Before photo selected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Now select the 'After' photo
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Before Photo</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Click to select
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div
                  className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-6 ${
                    !pendingBefore ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => {
                    if (pendingBefore) afterInputRef.current?.click();
                  }}
                >
                  <input
                    ref={afterInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      if (e.target.files?.[0]) await addAfterPhoto(e.target.files[0]);
                      e.target.value = "";
                    }}
                    data-testid="input-after-photo"
                  />
                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary">
                    <Plus className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">After Photo</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pendingBefore
                        ? "Click to select"
                        : "Select 'Before' first"}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`drop-zone-idle rounded-2xl min-h-[100px] flex flex-col items-center justify-center text-center cursor-pointer gap-2 px-8 ${
                  isDragging ? "drop-zone-dragging" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleBulkDrop}
              >
                <p className="text-sm text-muted-foreground">
                  Or drag & drop multiple images (pairs will be created in order: 1st=before, 2nd=after, etc.)
                </p>
              </div>

              {pairs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg">Photo Pairs</h3>
                    <Badge variant="secondary" className="bg-accent text-sm">
                      {pairs.length}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {pairs.map((pair, i) => (
                      <div
                        key={pair.id}
                        className="rounded-2xl border border-border/30 bg-card/50 p-5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex gap-3 flex-shrink-0">
                            <div className="relative">
                              <img
                                src={pair.beforeUrl}
                                alt="Before"
                                className="w-24 h-24 object-cover rounded-xl"
                              />
                              <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-semibold">
                                BEFORE
                              </span>
                            </div>
                            <div className="relative">
                              <img
                                src={pair.afterUrl}
                                alt="After"
                                className="w-24 h-24 object-cover rounded-xl"
                              />
                              <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-semibold">
                                AFTER
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-muted-foreground" />
                              <Select
                                value={TREATMENT_PRESETS.includes(pair.treatmentType) ? pair.treatmentType : (pair.treatmentType ? "__custom__" : "")}
                                onValueChange={(v) => {
                                  if (v === "__custom__") {
                                    updatePair(pair.id, "treatmentType", " ");
                                  } else {
                                    updatePair(pair.id, "treatmentType", v);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-10 text-sm flex-1">
                                  <SelectValue placeholder="Select treatment type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {TREATMENT_PRESETS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__custom__">Custom...</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {!TREATMENT_PRESETS.includes(pair.treatmentType) && pair.treatmentType && (
                              <Input
                                placeholder="Enter custom treatment type..."
                                value={pair.treatmentType.trim()}
                                onChange={(e) =>
                                  updatePair(pair.id, "treatmentType", e.target.value || " ")
                                }
                                className="h-10 text-sm"
                                autoFocus
                              />
                            )}
                            <Input
                              placeholder="Area (e.g. lips, forehead) - optional"
                              value={pair.area}
                              onChange={(e) =>
                                updatePair(pair.id, "area", e.target.value)
                              }
                              className="h-10 text-sm"
                            />
                            <Input
                              placeholder="Notes (e.g. after 3 sessions) - optional"
                              value={pair.notes}
                              onChange={(e) =>
                                updatePair(pair.id, "notes", e.target.value)
                              }
                              className="h-10 text-sm"
                            />
                          </div>
                          <button
                            onClick={() => removePair(pair.id)}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                data-testid="drop-zone-logo-ba"
                className={`drop-zone-idle rounded-2xl min-h-[120px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${
                  isDraggingLogo ? "drop-zone-dragging" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingLogo(true);
                }}
                onDragLeave={() => setIsDraggingLogo(false)}
                onDrop={handleLogoDrop}
                onClick={() => logoInputRef.current?.click()}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {logoPreviewUrl ? (
                  <>
                    <div className="relative">
                      <img
                        src={logoPreviewUrl}
                        alt="Logo preview"
                        className="h-12 max-w-[140px] object-contain"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogoFile(null);
                        }}
                        className="absolute -top-2 -right-2 p-0.5 bg-black/70 hover:bg-black/90 text-white rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-[240px]">
                      {logoFile?.name}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary">
                      <Layers className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        Logo{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </p>
                      <p className="text-base text-muted-foreground mt-1">
                        Drag & drop or click to upload
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-6 text-lg font-semibold"
                  size="lg"
                  disabled={pairs.length === 0}
                >
                  Next: Style <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">
                  Step 2: Style & Layout
                </h2>
                <p className="text-lg text-muted-foreground">
                  Customise the look of your before & after slides.
                </p>
              </div>

              <div className="rounded-2xl border border-pink-500/20 bg-card/50 p-6">
                <PresetSelector
                  presets={presets}
                  loading={presetsLoading}
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={applyPreset}
                  onSavePreset={async (name, styles, ccWs, logoUrl) => { await savePreset(name, styles, ccWs, logoUrl); }}
                  onUpdatePreset={async (id, name, styles, ccWs, logoUrl) => { await updatePreset(id, name, styles, ccWs, logoUrl); }}
                  onDeletePreset={async (id) => { await deletePreset(id); if (selectedPresetId === id) setSelectedPresetId(null); }}
                  getCurrentStyles={getCurrentStyles}
                  logoFile={logoFile}
                  uploadLogo={uploadLogo}
                  currentLogoUrl={currentLogoUrl}
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                <Label className="text-base font-semibold">Comparison Layout</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLayoutMode("side-by-side")}
                    className={`flex flex-col items-center gap-3 p-6 rounded-xl transition-all ${
                      layoutMode === "side-by-side"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/40 text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    <ArrowLeftRight className="w-8 h-8" />
                    <span className="font-semibold">Side by Side</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode("stacked")}
                    className={`flex flex-col items-center gap-3 p-6 rounded-xl transition-all ${
                      layoutMode === "stacked"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/40 text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    <ArrowUpDown className="w-8 h-8" />
                    <span className="font-semibold">Stacked</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold">Font</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue>
                        <span style={{ fontFamily }}>{selectedFontLabel}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: f.value }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Text Size</Label>
                    <span className="text-base font-semibold tabular-nums">
                      {fontSize}px
                    </span>
                  </div>
                  <Slider
                    min={28}
                    max={96}
                    step={2}
                    value={[fontSize]}
                    onValueChange={([v]) => setFontSize(v)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Text Colour
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={textColor.toUpperCase()}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="flex-1 h-12 text-base font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Accent Colour
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={accentColor.toUpperCase()}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 h-12 text-base font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Page Colour
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={pageColor}
                      onChange={(e) => setPageColor(e.target.value)}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={pageColor.toUpperCase()}
                      onChange={(e) => setPageColor(e.target.value)}
                      className="flex-1 h-12 text-base font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Overlay Colour
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      type="color"
                      value={(() => {
                        if (overlayColor.startsWith("#")) return overlayColor;
                        const m = overlayColor.match(
                          /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
                        );
                        if (m)
                          return (
                            "#" +
                            [m[1], m[2], m[3]]
                              .map((v) =>
                                Number(v).toString(16).padStart(2, "0")
                              )
                              .join("")
                          );
                        return "#000000";
                      })()}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setOverlayColor(
                          `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 0.6)`
                        );
                      }}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={overlayColor}
                      onChange={(e) => setOverlayColor(e.target.value)}
                      className="flex-1 h-12 text-base font-mono"
                    />
                  </div>
                </div>

                {logoFile && (
                  <>
                    <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                      <Label className="text-base font-semibold">Logo Position</Label>
                      <Select value={logoPosition} onValueChange={setLogoPosition}>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            { label: "Top Left", value: "top-left" },
                            { label: "Top Right", value: "top-right" },
                            { label: "Bottom Left", value: "bottom-left" },
                            { label: "Bottom Right", value: "bottom-right" },
                          ].map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Logo Size</Label>
                        <span className="text-base font-semibold tabular-nums">
                          {logoSize}px
                        </span>
                      </div>
                      <Slider
                        min={40}
                        max={300}
                        step={10}
                        value={[logoSize]}
                        onValueChange={([v]) => setLogoSize(v)}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="px-8 py-6 text-lg font-semibold"
                  size="lg"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="px-8 py-6 text-lg font-semibold"
                  size="lg"
                >
                  Next: Generate <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">
                  Step 3: AI Content Generation
                </h2>
                <p className="text-lg text-muted-foreground">
                  AI will write compliance-aware captions for your before & after
                  posts.
                </p>
              </div>

              <div className="rounded-2xl border border-border/30 bg-card/50 p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Client / Brand Name
                    </Label>
                    <Input
                      value={aiClientName}
                      onChange={(e) => setAiClientName(e.target.value)}
                      placeholder="e.g. Glow Aesthetics"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Industry
                    </Label>
                    <Input
                      value={aiIndustry}
                      onChange={(e) => setAiIndustry(e.target.value)}
                      placeholder="e.g. Aesthetics clinic"
                      className="h-12 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Tone of Voice
                  </Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warm & professional">
                        Warm & Professional
                      </SelectItem>
                      <SelectItem value="bold & edgy">Bold & Edgy</SelectItem>
                      <SelectItem value="luxury & aspirational">
                        Luxury & Aspirational
                      </SelectItem>
                      <SelectItem value="friendly & casual">
                        Friendly & Casual
                      </SelectItem>
                      <SelectItem value="clinical & authoritative">
                        Clinical & Authoritative
                      </SelectItem>
                      <SelectItem value="empathetic & caring">
                        Empathetic & Caring
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Extra Instructions
                  </Label>
                  <Input
                    value={aiExtraInstructions}
                    onChange={(e) => setAiExtraInstructions(e.target.value)}
                    placeholder="e.g. Always mention our clinic name"
                    className="h-12 text-base"
                  />
                </div>

                <div className="rounded-xl bg-accent/20 p-4 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    Treatments to generate content for:
                  </p>
                  {pairs.map((pair, i) => (
                    <div key={pair.id} className="flex items-center gap-2 text-sm">
                      <span className="text-primary font-mono font-bold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {pair.treatmentType}
                        {pair.area ? ` (${pair.area})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-6 text-lg font-semibold"
                  size="lg"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <button
                  className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  data-testid="button-generate-ba"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {generatingProgress || "Generating..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Content
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">
                  Step 4: Preview & Download
                </h2>
                <p className="text-lg text-muted-foreground">
                  Preview your before & after slides and download everything as
                  a ZIP.
                </p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setPreviewSlideType("cover")}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      previewSlideType === "cover"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/40 text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    Cover Slide
                  </button>
                  <button
                    onClick={() => setPreviewSlideType("comparison")}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      previewSlideType === "comparison"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/40 text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    Comparison Slide
                  </button>
                </div>

                <div className="relative w-full max-w-md mx-auto">
                  <canvas
                    ref={previewCanvasRef}
                    className="w-full rounded-2xl shadow-2xl"
                    style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
                  />
                  {pairs.length > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPreviewPairIndex(
                            (prev) => (prev - 1 + pairs.length) % pairs.length
                          )
                        }
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground font-semibold">
                        Pair {previewPairIndex + 1} of {pairs.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPreviewPairIndex(
                            (prev) => (prev + 1) % pairs.length
                          )
                        }
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {generatedContent.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-lg">AI Captions</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const all = generatedContent
                          .map(
                            (c, i) =>
                              `--- ${pairs[i]?.treatmentType || `Pair ${i + 1}`} ---\n${c.caption}`
                          )
                          .join("\n\n");
                        navigator.clipboard.writeText(all);
                        setCopiedIndex(-1);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                    >
                      {copiedIndex === -1 ? (
                        <>
                          <Check className="w-4 h-4 mr-1" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" /> Copy All
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {generatedContent.map((content, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border/30 bg-accent/20 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-accent/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-mono text-sm font-bold">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-sm text-muted-foreground font-medium">
                              {content.treatmentType || pairs[i]?.treatmentType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await saveCaptionToLib(content.caption, "Before & After", aiClientName || "");
                                  setSavedCaptionIndices((prev) => new Set(prev).add(i));
                                  toast.success("Caption saved to library");
                                } catch { toast.error("Failed to save caption"); }
                              }}
                              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                              disabled={savedCaptionIndices.has(i)}
                            >
                              {savedCaptionIndices.has(i) ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => copyCaption(content.caption, i)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedIndex === i ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <textarea
                            className="w-full min-h-[120px] bg-transparent text-sm text-muted-foreground leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary/30 rounded p-2"
                            value={content.caption}
                            onChange={(e) => {
                              setGeneratedContent((prev) =>
                                prev.map((c, idx) =>
                                  idx === i
                                    ? { ...c, caption: e.target.value }
                                    : c
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="px-8 py-6 text-lg font-semibold"
                  size="lg"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadCsv}
                    className="px-8 py-6 text-lg font-bold"
                    size="lg"
                    data-testid="button-download-csv-ba-main"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Download CSV
                  </Button>
                  <Button
                    onClick={downloadZip}
                    className="px-10 py-6 text-lg font-semibold"
                    size="lg"
                    data-testid="button-download-ba-main"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download ZIP
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
