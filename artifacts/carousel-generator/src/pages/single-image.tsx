import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, Palette, Sparkles, Copy, Check, MessageSquareText, Plus, ChevronLeft, ChevronRight, Type, PenTool, ArrowLeftRight, CloudUpload, ImagePlus, CalendarDays, CalendarClock, BarChart3, ShieldCheck, BookOpen, Film, ChevronDown, Play, Square, Music,
} from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VanessaChat from "@/components/vanessa-chat";
import { CANVAS_WIDTH, CANVAS_HEIGHT, VIDEO_WIDTH, VIDEO_HEIGHT, RENDER_SCALE, FONT_OPTIONS, FONT_PAIRINGS, CORNER_STYLES, LOGO_POSITIONS, loadGoogleFonts, drawSlide, drawHeroSlide, compressImage, recordSlideVideo, recordReelVideoMp4, type AnimationType } from "@/lib/slide-utils";
import { type ReelAnimType, type ElementAnimation, REEL_ANIM_LABELS, applyPhotoAnimation, applyTextAnimation } from "@/lib/animate-utils";
import { usePresets, type ClientPreset, type PresetStyleFields, type TextPosition, type TextAlign, type CornerStyle, isCornerStyle, normalizeTextPosition } from "@/lib/use-presets";
import { getBrandDefaults } from "@/lib/brand-defaults";
import type { LogoPosition } from "@workspace/db/schema";
import { useCaptions } from "@/lib/use-captions";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { MusicPickerModal, MusicTrackBadge, type MusicTrack } from "@/components/music-picker-modal";
import VoiceStyleSelector from "@/components/voice-style-selector";
import PresetSelector from "@/components/preset-selector";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { FontSwitcher } from "@/components/font-switcher";

loadGoogleFonts();

interface SinglePost {
  index: number;
  text: string;
  imageUrl: string;
  imageName: string;
}

interface SingleResult {
  posts: SinglePost[];
  totalPosts: number;
  sessionId: string;
}

export default function SingleImage() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
  const [logoSize, setLogoSize] = useState(140);

  useEffect(() => {
    const bd = getBrandDefaults();
    if (bd.logoDataUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLogoImg(img);
      img.src = bd.logoDataUrl;
    }
  }, []);

  const [fontFamily, setFontFamily] = useState(() => getBrandDefaults().fontFamily);
  const [subheadingFont, setSubheadingFont] = useState(() => getBrandDefaults().subheadingFont);
  const [fontSize, setFontSize] = useState(52);
  const [contentFontSize, setContentFontSize] = useState(44);
  const [textColor, setTextColor] = useState(() => getBrandDefaults().secondaryColor);
  const [lineSpacing, setLineSpacing] = useState(0.9);
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.5)");
  const [pageColor, setPageColor] = useState(() => getBrandDefaults().primaryColor);
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("none");
  const [cornerColor, setCornerColor] = useState("#d4af37");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [textAlign, setTextAlign] = useState<TextAlign>("left");
  const [textBoxOutline, setTextBoxOutline] = useState(false);
  const [textBoxOutlineColor, setTextBoxOutlineColor] = useState("#ffffff");

  const [textStyle, setTextStyle] = useState<"standard" | "hero">("standard");
  const [heroLeadIn, setHeroLeadIn] = useState("");
  const [heroWord, setHeroWord] = useState("");
  const [heroLeadInColor, setHeroLeadInColor] = useState("#E91976");
  const [heroWordColor, setHeroWordColor] = useState("#ffffff");
  const [heroWordFont, setHeroWordFont] = useState("'Bebas Neue', sans-serif");
  const [heroVerticalPosition, setHeroVerticalPosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [heroSpacing, setHeroSpacing] = useState(20);
  const [heroUppercase, setHeroUppercase] = useState(true);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: string[] }>({ rows: [] });
  const [allCsvRows, setAllCsvRows] = useState<string[]>([]);
  const [aiClientName, setAiClientName] = useState("");

  const [captions, setCaptions] = useState<string[]>([]);
  const [voiceStyle, setVoiceStyle] = useState("northern-grit");
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionProgress, setCaptionProgress] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [result, setResult] = useState<SingleResult | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  type ToolId = "templates" | "photos" | "text" | "shapes" | "stickers" | "layers";
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const toggleTool = (id: ToolId) => setActiveTool((prev) => (prev === id ? null : id));
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [ccStatus, setCcStatus] = useState<{ configured: boolean } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrack | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [firstComment, setFirstComment] = useState("");
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [scheduleRendering, setScheduleRendering] = useState(false);

  const { presets, loading: presetsLoading, savePreset, updatePreset, deletePreset, uploadLogo } = usePresets();
  const { saveCaption: saveCaptionToLib, bulkSave: bulkSaveCaptions, captions: libCaptions, fetchCaptions: refreshLibCaptions } = useCaptions();
  const [savedCaptionIndices, setSavedCaptionIndices] = useState<Set<number>>(new Set());
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [showBrowseLibrary, setShowBrowseLibrary] = useState(false);
  const [selectedLibCaptionIds, setSelectedLibCaptionIds] = useState<Set<number>>(new Set());

  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [videoAnimType, setVideoAnimType] = useState<AnimationType>('ken-burns');
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState(4);
  const [videoPreviewPlaying, setVideoPreviewPlaying] = useState(false);
  const videoPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoPreviewRafRef = useRef<number | null>(null);

  const [animateOpen, setAnimateOpen] = useState(false);
  const [animatePhotoAnim, setAnimatePhotoAnim] = useState<ElementAnimation>({ type: "photo-zoom", startAt: 0, repeat: true });
  const [animateTextAnim, setAnimateTextAnim] = useState<ElementAnimation>({ type: "fade-in", startAt: 0.3, repeat: false });
  const [animateRendering, setAnimateRendering] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(0);
  const [animatePreviewPlaying, setAnimatePreviewPlaying] = useState(false);
  const animatePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animatePreviewRafRef = useRef<number | null>(null);
  const [animateClientName, setAnimateClientName] = useState("");

  const [designPreviewDataUrl, setDesignPreviewDataUrl] = useState<string | null>(null);
  const designBgImgRef = useRef<HTMLImageElement | null>(null);

  const getCurrentStyles = (): PresetStyleFields => ({
    pageColor, overlayColor, fontFamily, subheadingFont, fontSize, contentFontSize, textColor, lineSpacing,
    cornerStyle, cornerColor, textPosition, textAlign, textBoxOutline, textBoxOutlineColor, logoPosition, logoSize,
  });

  const renderPostToCanvas = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement, post: SinglePost) => {
    if (textStyle === "hero") {
      drawHeroSlide(
        ctx, img,
        heroLeadIn, heroWord,
        heroLeadInColor, heroWordColor, heroWordFont,
        heroVerticalPosition, heroSpacing, heroUppercase,
        overlayColor, logoImg, logoPosition, logoSize,
        pageColor, cornerStyle, cornerColor,
      );
    } else {
      drawSlide(
        ctx, img, post.text, fontFamily, post.index === 1 ? fontSize : contentFontSize,
        false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize,
        pageColor, cornerStyle, cornerColor, 1, 1, textPosition, true, subheadingFont,
        textAlign, textBoxOutline, textBoxOutlineColor, "",
      );
    }
  }, [textStyle, heroLeadIn, heroWord, heroLeadInColor, heroWordColor, heroWordFont,
    heroVerticalPosition, heroSpacing, heroUppercase,
    fontFamily, fontSize, contentFontSize, textColor, lineSpacing, overlayColor,
    logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor,
    textPosition, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor]);

  const applyPreset = (preset: ClientPreset) => {
    setSelectedPresetId(preset.id);
    setPageColor(preset.pageColor);
    setOverlayColor(preset.overlayColor);
    setFontFamily(preset.fontFamily);
    setSubheadingFont(preset.subheadingFont || preset.fontFamily);
    setFontSize(preset.fontSize);
    setContentFontSize(preset.contentFontSize ?? 44);
    setTextColor(preset.textColor);
    setLineSpacing(parseFloat(preset.lineSpacing));
    setCornerStyle(preset.cornerStyle);
    setCornerColor(preset.cornerColor);
    setTextPosition(normalizeTextPosition(preset.textPosition));
    setTextAlign(preset.textAlign || "left");
    setTextBoxOutline(preset.textBoxOutline ?? false);
    setTextBoxOutlineColor(preset.textBoxOutlineColor || "#ffffff");
    setLogoPosition(preset.logoPosition);
    setLogoSize(preset.logoSize);
    setCurrentLogoUrl(preset.logoUrl || null);
    setVoiceStyle(preset.voiceStyle || "northern-grit");
    if (preset.logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLogoImg(img);
      img.src = preset.logoUrl;
    } else {
      setLogoImg(null);
      setLogoFile(null);
    }
    setFirstComment(preset.defaultFirstCommentSingle || "");
  };
  const [ccPushing, setCcPushing] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const logoPreviewUrl = logoFile ? URL.createObjectURL(logoFile) : null;

  useEffect(() => {
    const paired = FONT_PAIRINGS[fontFamily];
    if (paired) setSubheadingFont(paired);
  }, [fontFamily]);

  useEffect(() => {
    if (!logoFile) { setLogoImg(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(logoFile);
    img.onload = () => { setLogoImg(img); URL.revokeObjectURL(url); };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [logoFile]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/status`)
      .then((r) => r.json())
      .then(setCcStatus)
      .catch(() => {});
  }, []);

  const renderDesignPreview = useCallback(async () => {
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      const sampleText = allCsvRows[0] || "Sample text overlay";

      let bgImg = designBgImgRef.current;
      if (!bgImg) {
        const placeholder = document.createElement("canvas");
        placeholder.width = CANVAS_WIDTH;
        placeholder.height = CANVAS_HEIGHT;
        const pCtx = placeholder.getContext("2d")!;
        pCtx.fillStyle = "#1a1a2e";
        pCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        bgImg = await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = placeholder.toDataURL();
        });
      }

      if (textStyle === "hero") {
        drawHeroSlide(
          ctx, bgImg,
          heroLeadIn || "LEAD-IN TEXT",
          heroWord || "HERO",
          heroLeadInColor, heroWordColor, heroWordFont,
          heroVerticalPosition, heroSpacing, heroUppercase,
          overlayColor, logoImg, logoPosition, logoSize,
          pageColor, cornerStyle, cornerColor,
        );
      } else {
        drawSlide(
          ctx,
          bgImg,
          sampleText,
          fontFamily,
          fontSize,
          false,
          textColor,
          lineSpacing,
          overlayColor,
          logoImg,
          logoPosition,
          logoSize,
          pageColor,
          cornerStyle,
          cornerColor,
          1,
          1,
          textPosition,
          true,
          subheadingFont,
          textAlign,
          textBoxOutline,
          textBoxOutlineColor,
          "",
        );
      }
      setDesignPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("Design preview render error", e);
    }
  }, [
    textStyle, heroLeadIn, heroWord, heroLeadInColor, heroWordColor, heroWordFont,
    heroVerticalPosition, heroSpacing, heroUppercase,
    fontFamily, subheadingFont, fontSize, textColor, lineSpacing,
    overlayColor, pageColor, cornerStyle, cornerColor, textPosition, textAlign,
    textBoxOutline, textBoxOutlineColor, logoImg, logoPosition, logoSize,
    allCsvRows,
  ]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const timer = setTimeout(renderDesignPreview, 100);
    return () => clearTimeout(timer);
  }, [currentStep, renderDesignPreview]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const url = photos[0] ? URL.createObjectURL(photos[0]) : null;
    if (!url) { designBgImgRef.current = null; renderDesignPreview(); return; }
    const img = new Image();
    img.onload = () => {
      designBgImgRef.current = img;
      URL.revokeObjectURL(url);
      renderDesignPreview();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [photos[0], currentStep]);

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
        const isHeader = /^(text|caption|title|hook|slide|content|post|message)\d*$/i.test(first);
        const dataRows = isHeader ? rows.slice(1) : rows;
        const texts = dataRows.map((r) => r[0]?.trim()).filter(Boolean);
        setCsvPreview({ rows: texts.slice(0, 5) });
        setAllCsvRows(texts);
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
    if (textStyle === "standard" && !csvFile && !allCsvRows.length) {
      toast.error("Please upload a CSV file or switch to Hero Headline style in Step 2"); return;
    }

    setIsGenerating(true);
    const toastId = toast.loading("Generating images...");

    try {
      await document.fonts.ready;
      const texts = allCsvRows;
      if (textStyle === "standard" && texts.length === 0) throw new Error("CSV has no data rows");

      const postCount = photos.length;

      if (textStyle === "standard" && texts.length < postCount) {
        toast.warning(`Only ${texts.length} text(s) for ${postCount} photo(s) - extra photos will have no text overlay`);
      }

      const posts: SinglePost[] = [];
      for (let i = 0; i < photos.length; i++) {
        toast.loading(`Rendering image ${i + 1} of ${photos.length}…`, { id: toastId });
        const post: SinglePost = {
          index: i + 1,
          text: textStyle === "standard" ? (texts[i] || "") : "",
          imageUrl: URL.createObjectURL(photos[i]),
          imageName: photos[i].name,
        };
        const blob = await fetch(post.imageUrl).then((r) => r.blob());
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH * RENDER_SCALE; canvas.height = CANVAS_HEIGHT * RENDER_SCALE;
        const exportCtx = canvas.getContext("2d")!;
        exportCtx.scale(RENDER_SCALE, RENDER_SCALE);
        renderPostToCanvas(exportCtx, img, post);
        URL.revokeObjectURL(img.src);
        post.imageUrl = canvas.toDataURL("image/png");
        posts.push(post);
      }

      setResult({ posts, totalPosts: posts.length, sessionId: "local" });
      setCurrentStep(4);
      toast.success(`${posts.length} single image post${posts.length !== 1 ? "s" : ""} ready`, { id: toastId });
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "Unknown error"), { id: toastId, duration: 15000 });
    } finally {
      setIsGenerating(false);
    }
  };


  const handleStartOver = () => {
    setPhotos([]); setCsvFile(null); setCsvPreview({ rows: [] }); setAllCsvRows([]);
    setCaptions([]); setResult(null);
    setSavedCaptionIndices(new Set()); setCurrentStep(1);
  };

  const downloadZip = async () => {
    if (!result?.posts.length) return;
    const id = toast.loading("Building ZIP...");
    try {
      const zip = new JSZip();
      for (const post of result.posts) {
        const res = await fetch(post.imageUrl);
        const outBlob = await res.blob();
        zip.file(`post-${String(post.index).padStart(2, "0")}.png`, outBlob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "single-image-posts.zip");
      fetch(`${import.meta.env.BASE_URL}api/analytics/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "downloaded", postType: "single-image", clientName: aiClientName || "", postCount: result.posts.length }) }).catch(() => {});
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
    if (!result?.posts.length) return;
    const id = toast.loading("Uploading images...");
    try {
      const rendered: { name: string; base64: string }[] = result.posts.map((post) => ({
        name: `post-${String(post.index).padStart(2, "0")}.png`,
        base64: post.imageUrl,
      }));

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      const rows: string[][] = [["Image", "Caption", "Title", "Approved"]];
      for (const post of result.posts) {
        const fn = `post-${String(post.index).padStart(2, "0")}.png`;
        const url = urlMap.get(fn) || fn;
        const caption = captions[post.index - 1] || "";
        rows.push([url, caption, `Post ${post.index}`, "TRUE"]);
      }

      const csvString = Papa.unparse(rows);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvString], { type: "text/csv;charset=utf-8" });
      saveAs(blob, "single-image-posts.csv");
      fetch(`${import.meta.env.BASE_URL}api/analytics/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "downloaded", postType: "single-image", clientName: aiClientName || "", postCount: result.posts.length }) }).catch(() => {});
      toast.success("CSV downloaded with image links", { id });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed: " + (e?.message || "Unknown error"), { id });
    }
  };

  const pushToCloudCampaign = async () => {
    if (!result?.posts.length) return;
    setCcPushing(true);
    const id = toast.loading("Pushing to Cloud Campaign...");
    try {
      const rendered: { name: string; base64: string }[] = result.posts.map((post) => ({
        name: `post-${String(post.index).padStart(2, "0")}.png`,
        base64: post.imageUrl,
      }));

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      const ccPosts = result.posts.map((post) => {
        const fn = `post-${String(post.index).padStart(2, "0")}.png`;
        return {
          title: `Post ${post.index}`,
          caption: captions[post.index - 1] || "",
          imageUrls: [urlMap.get(fn) || ""],
        };
      });

      toast.loading("Pushing to Cloud Campaign...", { id });
      const selectedPreset = presets.find((p) => p.id === selectedPresetId);
      const pushBody: { posts: typeof ccPosts; workspaceIds?: string[]; postType: string } = { posts: ccPosts, postType: "single-image" };
      if (selectedPreset?.ccWorkspaceId) pushBody.workspaceIds = [selectedPreset.ccWorkspaceId];
      const resp = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushBody),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Push failed");
      toast.success(`Pushed ${data.summary.succeeded} post(s) to Cloud Campaign!`, { id });
      if (data.summary.failed > 0) {
        toast.error(`${data.summary.failed} post(s) failed.`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Cloud Campaign push failed: " + (e?.message || "Unknown error"), { id });
    } finally {
      setCcPushing(false);
    }
  };

  const scheduleImages = async () => {
    if (!result?.posts.length) return;
    if (!selectedPresetId) { toast.error("Select a client preset first"); return; }
    setScheduleRendering(true);
    const id = toast.loading("Preparing images for scheduling...");
    try {
      const rendered: { name: string; base64: string }[] = result.posts.map((post) => ({
        name: `sched-post-${String(post.index).padStart(2, "0")}.png`,
        base64: post.imageUrl,
      }));
      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }
      toast.dismiss(id);
      const posts: SchedulePostPayload[] = result.posts.map((post, i) => ({
        title: `Post ${post.index}`,
        caption: captions[i] || "",
        imageUrls: [urlMap.get(`sched-post-${String(post.index).padStart(2, "0")}.png`) || ""].filter(Boolean),
        musicTrack: musicTrack || undefined,
        firstComment: firstComment || undefined,
      }));
      setSchedulePosts(posts);
      setScheduleOpen(true);
    } catch (e: any) {
      toast.error("Failed to prepare: " + (e?.message || ""), { id });
    } finally {
      setScheduleRendering(false);
    }
  };

  const ANIM_OPTIONS: { value: AnimationType; label: string; desc: string }[] = [
    { value: 'ken-burns', label: 'Ken Burns', desc: 'Photo slowly zooms in' },
    { value: 'slide-in-text', label: 'Slide-in', desc: 'Text glides up from below' },
    { value: 'typewriter', label: 'Typewriter', desc: 'Text reveals char by char' },
    { value: 'fade-overlay', label: 'Fade Overlay', desc: 'Overlay fades in with text' },
  ];

  const stopPreview = useCallback(() => {
    if (videoPreviewRafRef.current !== null) {
      cancelAnimationFrame(videoPreviewRafRef.current);
      videoPreviewRafRef.current = null;
    }
    setVideoPreviewPlaying(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const playPreview = useCallback(async () => {
    if (!result?.posts.length || !videoPreviewCanvasRef.current) return;
    stopPreview();
    const post = result.posts[0];
    try {
      const res = await fetch(post.imageUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onerror = () => URL.revokeObjectURL(objUrl);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const canvas = videoPreviewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const offscreen = document.createElement('canvas');
        offscreen.width = CANVAS_WIDTH;
        offscreen.height = CANVAS_HEIGHT;
        const offCtx = offscreen.getContext('2d')!;
        const yOff = Math.round((VIDEO_HEIGHT - CANVAS_HEIGHT) / 2);
        const durationMs = videoDurationSec * 1000;
        const startTime = performance.now();
        setVideoPreviewPlaying(true);
        const tick = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          drawSlide(offCtx, img, post.text, fontFamily, post.index === 1 ? fontSize : contentFontSize, false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, 1, 1, textPosition, true, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, "", 0, false, false, "'Great Vibes', cursive", false, "", "#ffffff", 0.45, false, false, 400, 2, false, 700, 0, videoAnimType, progress);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          ctx.drawImage(offscreen, 0, yOff);
          if (progress < 1) {
            videoPreviewRafRef.current = requestAnimationFrame(tick);
          } else {
            videoPreviewRafRef.current = null;
            setVideoPreviewPlaying(false);
          }
        };
        videoPreviewRafRef.current = requestAnimationFrame(tick);
      };
      img.src = objUrl;
    } catch (e) {
      console.error('Preview failed', e);
      setVideoPreviewPlaying(false);
    }
  }, [result, videoDurationSec, videoAnimType, fontFamily, fontSize, contentFontSize, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, textPosition, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, stopPreview]);

  const downloadVideos = async () => {
    if (!result?.posts.length) return;
    setVideoExporting(true);
    const id = toast.loading(`Preparing ${result.posts.length} videos…`);
    try {
      await document.fonts.ready;
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      const offscreen = document.createElement('canvas');
      offscreen.width = CANVAS_WIDTH;
      offscreen.height = CANVAS_HEIGHT;
      const offCtx = offscreen.getContext('2d')!;
      const yOff = Math.round((VIDEO_HEIGHT - CANVAS_HEIGHT) / 2);

      for (let si = 0; si < result.posts.length; si++) {
        const post = result.posts[si];
        toast.loading(`Rendering slide ${si + 1} of ${result.posts.length}…`, { id });
        const res = await fetch(post.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });

        const videoBlob = await recordSlideVideo(canvas, (progress) => {
          drawSlide(offCtx, img, post.text, fontFamily, post.index === 1 ? fontSize : contentFontSize, false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, 1, 1, textPosition, true, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, "", 0, false, false, "'Great Vibes', cursive", false, "", "#ffffff", 0.45, false, false, 400, 2, false, 700, 0, videoAnimType, progress);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          ctx.drawImage(offscreen, 0, yOff);
        }, videoDurationSec * 1000);

        URL.revokeObjectURL(img.src);
        zip.file(`post-${String(post.index).padStart(2, '0')}.webm`, videoBlob);
      }

      toast.loading('Zipping videos…', { id });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'single-image-videos.zip');
      toast.success(`${result.posts.length} videos downloaded!`, { id });
    } catch (e: any) {
      console.error(e);
      toast.error('Video export failed: ' + (e?.message || 'Unknown error'), { id });
    } finally {
      setVideoExporting(false);
    }
  };

  const stopAnimatePreview = () => {
    if (animatePreviewRafRef.current !== null) {
      cancelAnimationFrame(animatePreviewRafRef.current);
      animatePreviewRafRef.current = null;
    }
    setAnimatePreviewPlaying(false);
  };

  useEffect(() => () => stopAnimatePreview(), []);

  const playAnimatePreview = async () => {
    if (!result?.posts.length || !animatePreviewCanvasRef.current) return;
    stopAnimatePreview();
    const post = result.posts[0];
    try {
      const res = await fetch(post.imageUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onerror = () => URL.revokeObjectURL(objUrl);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const canvas = animatePreviewCanvasRef.current;
        if (!canvas) return;
        const W = CANVAS_WIDTH;
        const H = CANVAS_HEIGHT;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        const DURATION_MS = 5000;
        const startTime = performance.now();
        setAnimatePreviewPlaying(true);
        const tick = () => {
          const elapsed = (performance.now() - startTime) % DURATION_MS;
          const t = elapsed / DURATION_MS;
          ctx.clearRect(0, 0, W, H);
          ctx.save();
          if (animatePhotoAnim.type === "none") {
            const ar = img.naturalWidth / img.naturalHeight;
            const canvasAr = W / H;
            let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
            if (ar > canvasAr) { sw = Math.round(sh * canvasAr); sx = Math.round((img.naturalWidth - sw) / 2); }
            else { sh = Math.round(sw / canvasAr); sy = Math.round((img.naturalHeight - sh) / 2); }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
          } else {
            applyPhotoAnimation(ctx, img, animatePhotoAnim, t, W, H);
          }
          ctx.restore();
          const overlayColor2 = overlayColor || "rgba(0,0,0,0.4)";
          ctx.fillStyle = overlayColor2;
          ctx.fillRect(0, 0, W, H);
          if (animateTextAnim.type !== "none") {
            const text = post.text || (textStyle === "hero" ? [heroLeadIn, heroWord].filter(Boolean).join(" ") : "");
            if (text) {
              applyTextAnimation(ctx, text, animateTextAnim, t, W, H, textColor, fontFamily, fontSize, textPosition as "top" | "center" | "bottom");
            }
          }
          animatePreviewRafRef.current = requestAnimationFrame(tick);
        };
        animatePreviewRafRef.current = requestAnimationFrame(tick);
      };
      img.src = objUrl;
    } catch {
      setAnimatePreviewPlaying(false);
    }
  };

  const saveAsReel = async () => {
    if (!result?.posts.length) return;
    const clientName = animateClientName || aiClientName || "Unknown";
    setAnimateRendering(true);
    setAnimateProgress(0);
    const toastId = toast.loading("Rendering reel…");
    try {
      await document.fonts.ready;
      const W = CANVAS_WIDTH;
      const H = CANVAS_HEIGHT;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;

      const post = result.posts[0];
      const res = await fetch(post.imageUrl);
      const blob = await res.blob();
      const img = new Image();
      await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("img load failed")); img.src = URL.createObjectURL(blob); });

      const DURATION_MS = 5000;
      const FPS = 30;

      const animateFn = (_slideIndex: number, progress: number) => {
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (animatePhotoAnim.type === "none") {
          const ar = img.naturalWidth / img.naturalHeight;
          const canvasAr = W / H;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (ar > canvasAr) { sw = Math.round(sh * canvasAr); sx = Math.round((img.naturalWidth - sw) / 2); }
          else { sh = Math.round(sw / canvasAr); sy = Math.round((img.naturalHeight - sh) / 2); }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        } else {
          applyPhotoAnimation(ctx, img, animatePhotoAnim, progress, W, H);
        }
        ctx.restore();
        ctx.fillStyle = overlayColor || "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, W, H);
        if (animateTextAnim.type !== "none") {
          const text = post.text || (textStyle === "hero" ? [heroLeadIn, heroWord].filter(Boolean).join(" ") : "");
          if (text) {
            const ctx2 = canvas.getContext("2d")!;
            applyTextAnimation(ctx2, text, animateTextAnim, progress, W, H, textColor, fontFamily, fontSize, textPosition as "top" | "center" | "bottom");
          }
        }
      };

      toast.loading("Encoding MP4… (this takes ~15 seconds)", { id: toastId });
      const mp4Blob = await recordReelVideoMp4(
        canvas,
        DURATION_MS,
        0,
        1,
        animateFn,
        FPS,
        (pct) => setAnimateProgress(pct),
      );

      toast.loading("Uploading reel…", { id: toastId });
      const formData = new FormData();
      formData.append("video", mp4Blob, "animated-reel.mp4");
      const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { proxyUrl } = await uploadRes.json() as { url: string; proxyUrl: string };

      toast.loading("Saving to library…", { id: toastId });
      const caption = captions[0] || "";
      await fetch(`${import.meta.env.BASE_URL}api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          postType: "reel",
          caption,
          mediaUrl: proxyUrl,
          metadata: {
            source: "single-image-animate",
            photoAnim: animatePhotoAnim.type,
            textAnim: animateTextAnim.type,
            durationSec: 5,
          },
        }),
      });

      toast.success("Reel saved to library! Ready to publish.", { id: toastId });
    } catch (e: any) {
      toast.error("Reel rendering failed: " + (e?.message || "Unknown error"), { id: toastId });
    } finally {
      setAnimateRendering(false);
      setAnimateProgress(0);
    }
  };

  const generateCaptions = async () => {
    // In hero mode with no CSV, generate one caption per photo using hero text as context
    let texts: string[];
    if (allCsvRows.length > 0) {
      texts = allCsvRows;
    } else if (textStyle === "hero" && photos.length > 0) {
      const heroContext = [heroLeadIn, heroWord].filter(Boolean).join(" ") || "professional photo";
      texts = photos.map(() => heroContext);
    } else {
      return;
    }
    setCaptionGenerating(true);
    setCaptionProgress("Starting caption generation...");
    setCaptions([]);
    try {
      const posts = texts.map((t) => [t]);
      const resp = await fetch(`${import.meta.env.BASE_URL}api/content/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts,
          clientName: aiClientName,
          industry: "aesthetics",
          voiceStyle,
          extraInstructions: "",
          postType: "single-image",
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
              const raw = data.captions || [];
              const selectedPreset = presets.find((p) => p.id === selectedPresetId);
              const footnote = selectedPreset?.captionFootnote?.trim();
              setCaptions(footnote ? raw.map((c: string) => c + "\n\n" + footnote) : raw);
              setCaptionProgress("");
            } else if (data.type === "error") {
              setCaptionProgress(data.message || "Error generating captions");
            }
          } catch {}
        }
      }
    } catch {
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
    const all = captions.map((c, i) => `--- Post ${i + 1} ---\n${c}`).join("\n\n");
    navigator.clipboard.writeText(all);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const selectedFontLabel = FONT_OPTIONS.find((f) => f.value === fontFamily)?.label ?? "Inter";
  const selectedSubheadingFontLabel = FONT_OPTIONS.find((f) => f.value === subheadingFont)?.label ?? "Inter";

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
          <Badge variant="secondary" className="bg-accent text-xs">Single Image</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Carousel Mode
            </Button>
          </Link>
          <Link href="/stories">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Stories
            </Button>
          </Link>
          <Link href="/reels">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Film className="w-4 h-4 mr-2" />
              Reels
            </Button>
          </Link>
          <Link href="/video-overlay">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Play className="w-4 h-4 mr-2" />
              Video Overlay
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
              <MessageSquareText className="w-4 h-4 mr-2" />
              Captions
            </Button>
          </Link>
          <Link href="/library">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Library
            </Button>
          </Link>
          <Link href="/calendar">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </Link>
          <Link href="/analytics">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <Link href="/approval">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Approvals
            </Button>
          </Link>
          {result && (
            <>
              <Button variant="outline" size="sm" onClick={handleStartOver} className="text-muted-foreground border-muted-foreground/20 hover:text-foreground">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
              <Button size="sm" onClick={downloadZip}>
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </Button>
              {ccStatus?.configured && (
                <Button size="sm" onClick={pushToCloudCampaign} disabled={ccPushing} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {ccPushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                  {ccPushing ? "Pushing..." : "Push to CC"}
                </Button>
              )}
              {selectedPresetId && (
                <Button size="sm" onClick={scheduleImages} disabled={scheduleRendering} variant="outline" className="border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                  {scheduleRendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                  {scheduleRendering ? "Preparing..." : "Schedule"}
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── Body: Rail | Panel | Editing area | Live preview ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Rail (60px) ── */}
        <div style={{ width: 60, minWidth: 60 }} className="flex flex-col items-center py-3 gap-0.5 bg-[#0f0f0f] border-r border-zinc-800/60 shrink-0 z-10">
          {(
            [
              {
                id: "templates" as ToolId,
                label: "Templates",
                icon: (active: boolean) => (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ),
              },
              {
                id: "photos" as ToolId,
                label: "Photos",
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
                label: "Shapes",
                icon: (active: boolean) => (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><polyline points="12 8 14.5 13 17 13 15 15.5 15.8 18 12 16.5 8.2 18 9 15.5 7 13 9.5 13 12 8" />
                  </svg>
                ),
              },
              {
                id: "stickers" as ToolId,
                label: "Stickers",
                icon: (active: boolean) => (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1 2 3.5 2 3.5-2 3.5-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" /><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
                  </svg>
                ),
              },
              {
                id: "layers" as ToolId,
                label: "Layers",
                icon: (active: boolean) => (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                  </svg>
                ),
              },
            ] as const
          ).map(({ id, label, icon }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => toggleTool(id)}
                className="flex flex-col items-center gap-1 py-3 px-1 w-full transition-colors relative group"
                style={{ backgroundColor: isActive ? "rgba(233,25,118,0.09)" : undefined }}
              >
                {isActive && (
                  <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#E91976]" />
                )}
                {icon(isActive)}
                <span className="text-[9px] font-semibold tracking-wide uppercase" style={{ color: isActive ? "#E91976" : "#52525b" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Slide-out Panel (260px) ── */}
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
                <span className="text-sm font-semibold text-white capitalize">{activeTool}</span>
                <button
                  onClick={() => setActiveTool(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-700/60 transition-colors"
                >
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeTool === "templates" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Brand presets</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">Your saved brand presets appear in Step 2. Pick one to snap all fonts, colours, and corner styles into place.</p>
                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-4 text-center">
                      <p className="text-xs text-zinc-500">Go to Step 2 → scroll to Presets</p>
                    </div>
                  </div>
                )}
                {activeTool === "photos" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Uploaded photos</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">Each photo you upload becomes one post. Drag to reorder.</p>
                    {photos.length > 0 ? (
                      <div className="space-y-2">
                        {photos.slice(0, 6).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 rounded bg-zinc-800/50 border border-zinc-700/30 px-2 py-1.5">
                            <img src={URL.createObjectURL(p)} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                            <span className="text-xs text-zinc-300 truncate">{p.name}</span>
                          </div>
                        ))}
                        {photos.length > 6 && (
                          <p className="text-xs text-zinc-500 text-center">+{photos.length - 6} more</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-6 text-center">
                        <p className="text-xs text-zinc-500">No photos yet — go to Step 1</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTool === "text" && (
                  <div className="space-y-4">
                    <FontSwitcher
                      headingFont={fontFamily}
                      onHeadingChange={setFontFamily}
                      onBodyChange={setSubheadingFont}
                    />
                    <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Current heading</p>
                      <p className="text-xs text-zinc-300 font-medium truncate">{selectedFontLabel}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-1">Current body</p>
                      <p className="text-xs text-zinc-300 font-medium truncate">{selectedSubheadingFontLabel}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-1">Font size</p>
                      <p className="text-xs text-zinc-300 font-medium">{fontSize}px — set in Step 2</p>
                    </div>
                  </div>
                )}
                {activeTool === "shapes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Corners & overlay</p>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-600">Corner style</p>
                      <p className="text-xs text-zinc-300 font-medium capitalize">{cornerStyle}</p>
                      <p className="text-xs text-zinc-600 pt-1">Overlay colour</p>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border border-zinc-600" style={{ backgroundColor: overlayColor }} />
                        <p className="text-xs text-zinc-300 font-mono">{overlayColor}</p>
                      </div>
                      <p className="text-xs text-zinc-600 pt-1">Overlay opacity</p>
                      <p className="text-xs text-zinc-300 font-medium">{overlayOpacity}%</p>
                    </div>
                  </div>
                )}
                {activeTool === "stickers" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Hero text</p>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-600">Lead-in word</p>
                      <p className="text-xs text-zinc-300 font-medium">{leadIn || "(not set)"}</p>
                      <p className="text-xs text-zinc-600 pt-1">Hero word</p>
                      <p className="text-xs text-zinc-300 font-medium">{heroWord || "(not set)"}</p>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed pt-1">Set these in Step 2 — they appear as the main overlay text on every post.</p>
                  </div>
                )}
                {activeTool === "layers" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Progress</p>
                    <div className="space-y-1.5">
                      {[
                        { num: 1, label: "Images", done: photos.length > 0 },
                        { num: 2, label: "Font & Layout", done: currentStep > 2 },
                        { num: 3, label: "Content", done: currentStep > 3 },
                        { num: 4, label: "Generate", done: !!result },
                      ].map(({ num, label, done }) => (
                        <button
                          key={num}
                          onClick={() => setCurrentStep(num)}
                          className="w-full flex items-center gap-2 rounded bg-zinc-800/50 border border-zinc-700/30 px-3 py-1.5 hover:bg-zinc-700/50 transition-colors"
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-500/20 border border-green-500/40" : num === currentStep ? "bg-pink-500/20 border border-pink-500/40" : "border border-zinc-600"}`}>
                            {done && <Check className="w-2.5 h-2.5 text-green-400" />}
                            {!done && num === currentStep && <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />}
                          </div>
                          <span className="text-xs text-zinc-300">{num}. {label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Editing area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Compact step-tab strip */}
          <div className="h-12 border-b border-border/30 bg-background/80 backdrop-blur flex items-center px-4 gap-1 shrink-0 overflow-x-auto">
            {[
              { num: 1, label: "Images", icon: ImageIcon },
              { num: 2, label: "Font & Layout", icon: Type },
              { num: 3, label: "Content", icon: PenTool },
              { num: 4, label: "Generate", icon: Sparkles },
            ].map((step, i) => {
              const isActive = currentStep === step.num;
              const isDone = currentStep > step.num;
              return (
                <React.Fragment key={step.num}>
                  <button
                    onClick={() => setCurrentStep(step.num)}
                    className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "text-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : <step.icon className="w-3 h-3" />}
                    {step.num}. {step.label}
                  </button>
                  {i < 3 && <span className="text-zinc-700 text-xs shrink-0">›</span>}
                </React.Fragment>
              );
            })}
            {result && (
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <button onClick={handleStartOver} className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors">
                  <RefreshCcw className="w-3 h-3" /> Start over
                </button>
                <button onClick={downloadZip} className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#E91976] text-white text-xs font-bold hover:bg-pink-600 transition-colors">
                  <Download className="w-3 h-3" /> Download ZIP
                </button>
              </div>
            )}
          </div>

          {/* Scrollable step content */}
          <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 pb-32">
          <div className="flex flex-col gap-8">
          {currentStep === 1 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 1: Your Images</h2>
                <p className="text-lg text-muted-foreground">Upload your photos and add your logo. Each photo becomes one post.</p>
              </div>

              <div
                className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingPhotos ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                onDragLeave={() => setIsDraggingPhotos(false)}
                onDrop={handlePhotosDrop}
                onClick={() => photoInputRef.current?.click()}
              >
                <input ref={photoInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handlePhotosChange} />
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-semibold text-xl">Photos</p>
                  <p className="text-base text-muted-foreground mt-1">
                    {photos.length > 0 ? `${photos.length} selected - click to add more` : "Drag & drop or click to upload"}
                  </p>
                </div>
              </div>

              <ApprovedImagesPicker
                clientName={presets.find((p) => p.id === selectedPresetId)?.name || ""}
                onAddImages={(files) => setPhotos((prev) => [...prev, ...files])}
              />

              <div
                className={`drop-zone-idle rounded-2xl min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingLogo ? "drop-zone-dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                onDragLeave={() => setIsDraggingLogo(false)}
                onDrop={handleLogoDrop}
                onClick={() => logoInputRef.current?.click()}
              >
                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
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

              <div className="flex justify-end pt-4">
                <Button onClick={() => setCurrentStep(2)} className="px-8 py-6 text-lg font-semibold" size="lg">
                  Next: Font & Layout <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 2: Font & Layout</h2>
                <p className="text-lg text-muted-foreground">Customise the look and feel of your single image posts.</p>
              </div>

              <div className="rounded-2xl border border-pink-500/20 bg-card/50 p-6">
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

              <div className="space-y-4 rounded-2xl border border-border/30 bg-card/50 p-6">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Type className="w-4 h-4" /> Text Style
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["standard", "hero"] as const).map((s) => (
                    <button key={s} onClick={() => setTextStyle(s)}
                      className={`px-4 py-4 rounded-xl text-sm font-semibold transition-all border ${textStyle === s ? "bg-primary text-primary-foreground border-primary" : "bg-accent/40 text-muted-foreground border-border/30 hover:bg-accent/60"}`}
                    >{s === "standard" ? "Standard" : "Hero Headline"}</button>
                  ))}
                </div>

                {textStyle === "hero" && (
                  <div className="space-y-5 pt-3 border-t border-border/20">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Lead-in line</Label>
                      <Input
                        value={heroLeadIn}
                        onChange={(e) => setHeroLeadIn(e.target.value)}
                        placeholder="YOUR LEAD-IN TEXT"
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Hero word</Label>
                      <Input
                        value={heroWord}
                        onChange={(e) => setHeroWord(e.target.value)}
                        placeholder="IMPACT"
                        className="h-14 text-xl font-bold"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Uppercase</Label>
                      <button onClick={() => setHeroUppercase(!heroUppercase)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${heroUppercase ? "bg-pink-500" : "bg-gray-600"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${heroUppercase ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Lead-in colour</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={heroLeadInColor} onChange={(e) => setHeroLeadInColor(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                          <Input type="text" value={heroLeadInColor.toUpperCase()} onChange={(e) => setHeroLeadInColor(e.target.value)} className="flex-1 h-10 text-sm font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Hero word colour</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={heroWordColor} onChange={(e) => setHeroWordColor(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                          <Input type="text" value={heroWordColor.toUpperCase()} onChange={(e) => setHeroWordColor(e.target.value)} className="flex-1 h-10 text-sm font-mono" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Font</Label>
                      <Select value={heroWordFont} onValueChange={setHeroWordFont}>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue><span style={{ fontFamily: heroWordFont }}>{FONT_OPTIONS.find((f) => f.value === heroWordFont)?.label ?? "Font"}</span></SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80 overflow-y-auto">
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Text position</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["top", "middle", "bottom"] as const).map((pos) => (
                          <button key={pos} onClick={() => setHeroVerticalPosition(pos)}
                            className={`px-3 py-3 rounded-lg text-sm font-semibold capitalize transition-all ${heroVerticalPosition === pos ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                          >{pos.charAt(0).toUpperCase() + pos.slice(1)}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">Spacing between lines</Label>
                        <span className="text-sm font-semibold tabular-nums">{heroSpacing}px</span>
                      </div>
                      <Slider min={0} max={80} step={4} value={[heroSpacing]} onValueChange={([v]) => setHeroSpacing(v)} className="w-full" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold">Font</Label>
                  <Select value={subheadingFont} onValueChange={(v) => { setSubheadingFont(v); setFontFamily(v); }}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue><span style={{ fontFamily: subheadingFont }}>{selectedSubheadingFontLabel}</span></SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-80 overflow-y-auto">
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Text Size</Label>
                    <span className="text-base font-semibold tabular-nums">{fontSize}px</span>
                  </div>
                  <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => { setFontSize(v); setContentFontSize(v); }} className="w-full" />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Text Colour</Label>
                  <div className="flex gap-3">
                    <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                    <Input type="text" value={textColor.toUpperCase()} onChange={(e) => setTextColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#ffffff" />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold">Text Position</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "top" as TextPosition, label: "Top" },
                      { value: "center" as TextPosition, label: "Centre" },
                      { value: "bottom" as TextPosition, label: "Bottom" },
                    ] as const).map((opt) => (
                      <button key={opt.value} onClick={() => setTextPosition(opt.value)}
                        className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${textPosition === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold">Text Alignment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([{ value: "left" as TextAlign, label: "Left" }, { value: "center" as TextAlign, label: "Centre" }, { value: "right" as TextAlign, label: "Right" }] as const).map((opt) => (
                      <button key={opt.value} onClick={() => setTextAlign(opt.value)}
                        className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${textAlign === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Line Spacing</Label>
                    <span className="text-base font-semibold tabular-nums">{lineSpacing.toFixed(2)}</span>
                  </div>
                  <Slider min={0.7} max={2} step={0.05} value={[lineSpacing]} onValueChange={([v]) => setLineSpacing(v)} className="w-full" />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Page Colour</Label>
                  <div className="flex gap-3">
                    <Input type="color" value={pageColor} onChange={(e) => setPageColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                    <Input type="text" value={pageColor} onChange={(e) => setPageColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#000000" />
                  </div>
                </div>

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

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Text Box Outline</Label>
                    <button
                      onClick={() => setTextBoxOutline(!textBoxOutline)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${textBoxOutline ? "bg-pink-500" : "bg-gray-600"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${textBoxOutline ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                  {textBoxOutline && (
                    <div className="flex gap-3">
                      <Input type="color" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                      <Input type="text" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#ffffff" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Corner Accent</Label>
                  <Select value={cornerStyle} onValueChange={(v) => { if (isCornerStyle(v)) setCornerStyle(v); }}>
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

                {logoFile && (
                  <>
                    <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                      <Label className="text-base font-semibold">Logo Position</Label>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Logo position">
                        {LOGO_POSITIONS.map((p) => (
                          <button
                            type="button"
                            key={p.value}
                            onClick={() => setLogoPosition(p.value as LogoPosition)}
                            aria-pressed={logoPosition === p.value}
                            className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${
                              logoPosition === p.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="rounded-lg border border-border/40 bg-background/60 p-3" style={{ aspectRatio: "4/5", position: "relative" }}>
                        <div
                          className="absolute w-6 h-4 rounded-sm bg-primary/70 transition-all duration-200"
                          style={{
                            top: logoPosition.startsWith("top") ? 8 : undefined,
                            bottom: logoPosition.startsWith("bottom") ? 8 : undefined,
                            left: logoPosition.endsWith("left") ? 8 : undefined,
                            right: logoPosition.endsWith("right") ? 8 : undefined,
                          }}
                        />
                      </div>
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

          {currentStep === 3 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 3: Your Content</h2>
                <p className="text-lg text-muted-foreground">Add the text for each single image post. One line per post.</p>
              </div>

              {textStyle === "hero" && (
                <div className="rounded-2xl bg-primary/10 border border-primary/20 p-5">
                  <p className="text-sm font-semibold text-primary mb-1">Hero Headline mode is on</p>
                  <p className="text-sm text-muted-foreground">Your lead-in and hero word are set in Step 2 and apply to your image. Use the AI tool below to generate an Instagram caption for Step 4, or skip straight to generating.</p>
                </div>
              )}

              <Button variant="outline" size="lg" onClick={() => { refreshLibCaptions(); setShowBrowseLibrary(!showBrowseLibrary); }} className="w-full py-5 text-base">
                <MessageSquareText className="w-5 h-5 mr-2" />
                {showBrowseLibrary ? "Hide Caption Library" : "Browse Caption Library"}
              </Button>

              {showBrowseLibrary && (
                <div className="rounded-xl border border-border/30 bg-accent/5 p-5 space-y-4 max-h-[400px] overflow-y-auto">
                  {libCaptions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No saved captions yet. Save captions from Step 4 to build your library.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Select captions to use as overlay text for your single image posts.</p>
                      {libCaptions.map((lc) => {
                        const isSelected = selectedLibCaptionIds.has(lc.id);
                        return (
                          <div key={lc.id} className={`rounded-lg border p-4 transition-colors cursor-pointer ${isSelected ? "border-primary bg-primary/10" : "border-border/20 bg-accent/10 hover:border-primary/30"}`}
                            onClick={() => {
                              setSelectedLibCaptionIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(lc.id)) next.delete(lc.id); else next.add(lc.id);
                                return next;
                              });
                            }}>
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{lc.text}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{lc.category}</span>
                                  {lc.clientName && <span className="text-xs text-muted-foreground bg-accent/40 px-2 py-0.5 rounded-full">{lc.clientName}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {selectedLibCaptionIds.size > 0 && (
                        <Button className="w-full" onClick={() => {
                          const selected = libCaptions.filter((lc) => selectedLibCaptionIds.has(lc.id));
                          const texts = selected.map((lc) => lc.text);
                          setAllCsvRows(texts);
                          setCsvPreview({ rows: texts.slice(0, 5) });
                          const csvContent = texts.map((t) => `"${t.replace(/"/g, '""')}"`).join("\n");
                          const blob = new Blob([csvContent], { type: "text/csv" });
                          setCsvFile(new File([blob], "library-captions.csv", { type: "text/csv" }));
                          setSelectedLibCaptionIds(new Set());
                          setShowBrowseLibrary(false);
                          toast.success(`${selected.length} caption(s) loaded as post content`);
                        }}>
                          <Check className="w-4 h-4 mr-2" /> Use {selectedLibCaptionIds.size} Caption{selectedLibCaptionIds.size > 1 ? "s" : ""}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              <>
                  <div
                    className={`drop-zone-idle rounded-2xl min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer gap-3 px-8 ${isDraggingCsv ? "drop-zone-dragging" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                    onDragLeave={() => setIsDraggingCsv(false)}
                    onDrop={handleCsvDrop}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <input ref={csvInputRef} type="file" className="hidden" accept=".csv,text/csv" onChange={handleCsvChange} />
                    <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary"><FileText className="w-7 h-7" /></div>
                    <div>
                      <p className="font-semibold text-lg">CSV File</p>
                      <p className="text-base text-muted-foreground mt-1 truncate max-w-[300px]">
                        {csvFile ? csvFile.name : "Drag & drop or click to upload"}
                      </p>
                      <p className="text-sm text-muted-foreground/60 mt-2">One text per row - first column only</p>
                    </div>
                  </div>

                  {csvPreview.rows.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-lg">CSV Preview</h3>
                      <div className="space-y-3">
                        {csvPreview.rows.map((text, i) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-accent/20 p-4 flex gap-3">
                            <span className="text-primary font-mono text-sm font-bold mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <p className="text-base leading-relaxed text-muted-foreground">{text}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground/70 italic">Showing first {csvPreview.rows.length} rows - {allCsvRows.length} total posts</p>
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setCurrentStep(2)} className="px-8 py-6 text-lg font-semibold" size="lg">
                      <ChevronLeft className="w-5 h-5 mr-2" /> Back
                    </Button>
                    <button
                      className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      {isGenerating ? "Generating..." : "Generate Posts"}
                    </button>
                  </div>
                </>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 4: Your Posts</h2>
                <p className="text-lg text-muted-foreground">
                  {result ? `${result.totalPosts} single image posts ready` : "Generate your posts to see them here."}
                </p>
              </div>

              {result && (
                <>
                  <div className="space-y-6">
                    <h3 className="font-medium text-lg">Post Preview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {result.posts.slice(0, 12).map((post) => (
                        <div key={post.index} className="space-y-2">
                          <div className="aspect-[4/5] rounded-xl overflow-hidden bg-accent/20 border border-border/30 relative">
                            <img src={post.imageUrl} alt={`Post ${post.index}`} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-end p-3">
                              {(post.text || (textStyle === "hero" && (heroLeadIn || heroWord))) && (
                                <p className="text-white text-xs font-medium line-clamp-3 bg-black/50 rounded-lg p-2" style={{ fontFamily: subheadingFont }}>
                                  {post.text || [heroLeadIn, heroWord].filter(Boolean).join(" ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">Post {post.index}</p>
                        </div>
                      ))}
                    </div>
                    {result.totalPosts > 12 && (
                      <p className="text-sm text-muted-foreground/70 italic text-center">Showing 12 of {result.totalPosts} posts</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-lg flex items-center gap-2">
                        <MessageSquareText className="w-5 h-5" />
                        Captions
                      </h3>
                      <div className="flex gap-2 items-center">
                        <VoiceStyleSelector value={voiceStyle} onChange={setVoiceStyle} size="sm" />
                        {captions.length > 1 && (
                          <Button variant="outline" size="sm" onClick={copyAllCaptions}>
                            {copiedIndex === -1 ? <><Check className="w-4 h-4 mr-1 text-green-400" /> Copied All</> : <><Copy className="w-4 h-4 mr-1" /> Copy All</>}
                          </Button>
                        )}
                        <Button
                          onClick={generateCaptions}
                          disabled={captionGenerating}
                          size="sm"
                          variant="outline"
                        >
                          {captionGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          {captionGenerating ? captionProgress || "Generating..." : "Generate Captions"}
                        </Button>
                      </div>
                    </div>

                    {captions.length === 0 && !captionGenerating && (
                      <div className="rounded-xl border border-dashed border-border/40 bg-accent/10 p-8 text-center">
                        <MessageSquareText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-lg text-muted-foreground">Generate ready-to-post captions for each image, complete with hashtags and calls to action.</p>
                      </div>
                    )}

                    {captions.length > 0 && (
                      <div className="space-y-4">
                        {captions.map((caption, i) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-accent/20 overflow-hidden group">
                            <div className="px-4 py-3 bg-accent/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-primary font-mono text-sm font-bold">{String(i + 1).padStart(2, "0")}</span>
                                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Post {i + 1} Caption</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await saveCaptionToLib(caption, "General", aiClientName || "");
                                      setSavedCaptionIndices((prev) => new Set(prev).add(i));
                                      toast.success("Caption saved to library");
                                    } catch { toast.error("Failed to save caption"); }
                                  }}
                                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                                  disabled={savedCaptionIndices.has(i)}
                                >
                                  {savedCaptionIndices.has(i) ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Saved</span></> : <><Plus className="w-4 h-4" /><span>Save</span></>}
                                </button>
                                <button onClick={() => copyCaption(caption, i)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                  {copiedIndex === i ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-4 h-4" /><span>Copy</span></>}
                                </button>
                              </div>
                            </div>
                            <div className="p-4">
                              <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">{caption}</p>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const unsaved = captions.filter((_, i) => !savedCaptionIndices.has(i));
                              if (unsaved.length === 0) { toast.info("All captions already saved"); return; }
                              await bulkSaveCaptions(unsaved.map((text) => ({ text, category: "General", clientName: aiClientName || "" })));
                              setSavedCaptionIndices(new Set(captions.map((_, i) => i)));
                              toast.success(`${unsaved.length} caption(s) saved to library`);
                            } catch { toast.error("Failed to save captions"); }
                          }}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Save All Captions to Library
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Animate & Save as Reel Panel */}
                  <div id="si-animate-panel" className="rounded-2xl border border-pink-500/30 bg-pink-950/10 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pink-950/20 transition-colors"
                      onClick={() => setAnimateOpen((v) => !v)}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-pink-400" />
                        <span className="font-semibold text-white">Animate &amp; Save as Reel</span>
                        <span className="text-xs text-pink-400/70 ml-1">5-second MP4 loop · IG Reels algorithm</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-pink-400 transition-transform ${animateOpen ? "rotate-180" : ""}`} />
                    </button>
                    {animateOpen && (
                      <div className="px-5 pb-5 space-y-5 border-t border-pink-500/20">
                        <p className="text-xs text-gray-400 pt-4">Turns your first image into a 5-second MP4 reel. IG rewards video content with 3-5x more reach than static posts.</p>

                        {/* Client name */}
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-gray-400 whitespace-nowrap">Save to client</label>
                          <Input
                            value={animateClientName || aiClientName}
                            onChange={(e) => setAnimateClientName(e.target.value)}
                            placeholder="Client name (for library)"
                            className="flex-1 bg-gray-800/60 border-gray-700 text-white text-sm h-9"
                          />
                        </div>

                        {/* Photo animation */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Photo animation</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {(["none", "photo-zoom", "photo-drift"] as ReelAnimType[]).map((type) => (
                              <button
                                key={type}
                                onClick={() => setAnimatePhotoAnim((a) => ({ ...a, type }))}
                                className={`px-3 py-2 rounded-xl text-sm text-left transition-all border ${animatePhotoAnim.type === type ? "bg-pink-600 border-pink-500 text-white" : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-pink-500/50"}`}
                              >
                                <div className="font-bold text-xs mb-0.5">{REEL_ANIM_LABELS[type].label}</div>
                                <div className={`text-xs font-normal ${animatePhotoAnim.type === type ? "text-pink-200" : "text-gray-500"}`}>{REEL_ANIM_LABELS[type].desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text animation */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Text animation</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {(["none", "fade-in", "pop-in", "slide-left", "slide-right", "slide-bottom", "typewriter", "gentle-drift", "outline-glow"] as ReelAnimType[]).map((type) => (
                              <button
                                key={type}
                                onClick={() => setAnimateTextAnim((a) => ({ ...a, type }))}
                                className={`px-3 py-2 rounded-xl text-sm text-left transition-all border ${animateTextAnim.type === type ? "bg-pink-600 border-pink-500 text-white" : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-pink-500/50"}`}
                              >
                                <div className="font-bold text-xs mb-0.5">{REEL_ANIM_LABELS[type].label}</div>
                                <div className={`text-xs font-normal ${animateTextAnim.type === type ? "text-pink-200" : "text-gray-500"}`}>{REEL_ANIM_LABELS[type].desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text start-at */}
                        {animateTextAnim.type !== "none" && (
                          <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl px-4 py-3">
                            <span className="text-sm font-semibold text-white whitespace-nowrap">Text starts at</span>
                            <input
                              type="range" min={0} max={3} step={0.1} value={animateTextAnim.startAt}
                              onChange={(e) => setAnimateTextAnim((a) => ({ ...a, startAt: parseFloat(e.target.value) }))}
                              className="flex-1 accent-pink-500"
                            />
                            <span className="text-sm font-bold text-pink-300 w-10 text-right">{animateTextAnim.startAt.toFixed(1)}s</span>
                          </div>
                        )}

                        {/* Live preview */}
                        <div className="flex gap-4 items-start">
                          <div className="flex flex-col gap-2 flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={animatePreviewPlaying ? stopAnimatePreview : playAnimatePreview}
                              disabled={animateRendering || !result?.posts.length}
                              className="border-pink-500/50 text-pink-300 hover:bg-pink-950/40 whitespace-nowrap"
                            >
                              {animatePreviewPlaying ? <><Square className="w-3 h-3 mr-1.5 fill-current" />Stop Preview</> : <><Play className="w-3 h-3 mr-1.5 fill-current" />Preview (loops 5 s)</>}
                            </Button>
                            <p className="text-xs text-gray-500">Previews first image. Loops every 5 seconds.</p>
                          </div>
                          <canvas
                            ref={animatePreviewCanvasRef}
                            style={{ width: '77px', height: '96px', borderRadius: '6px', flexShrink: 0, border: '1px solid #374151', background: '#000' }}
                          />
                        </div>

                        {/* Progress bar */}
                        {animateRendering && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Encoding MP4…</span>
                              <span>{Math.round(animateProgress * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div className="bg-pink-500 h-2 rounded-full transition-all" style={{ width: `${animateProgress * 100}%` }} />
                            </div>
                            <p className="text-xs text-gray-500">This takes about 15 seconds. Keep this tab open.</p>
                          </div>
                        )}

                        <Button
                          onClick={saveAsReel}
                          disabled={animateRendering || !result?.posts.length}
                          className="w-full bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 font-bold"
                          size="lg"
                        >
                          {animateRendering
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering reel… {Math.round(animateProgress * 100)}%</>
                            : <><Sparkles className="w-4 h-4 mr-2" />Save as Reel</>}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Video Export Panel (legacy WebM zip) */}
                  <div id="si-video-export-panel" className="rounded-2xl border border-purple-500/20 bg-purple-950/10 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-purple-950/20 transition-colors"
                      onClick={() => setVideoExportOpen((v) => !v)}
                    >
                      <div className="flex items-center gap-2">
                        <Film className="w-5 h-5 text-purple-400" />
                        <span className="font-semibold text-white">Export as Video (.webm)</span>
                        <span className="text-xs text-purple-400/70 ml-1">Ken Burns · Slide-in · Typewriter · Fade</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-purple-400 transition-transform ${videoExportOpen ? "rotate-180" : ""}`} />
                    </button>
                    {videoExportOpen && (
                      <div className="px-5 pb-5 space-y-4 border-t border-purple-500/20">
                        <p className="text-xs text-gray-400 pt-4">Each image becomes an animated clip. Downloads as a ZIP of <code>.webm</code> files, playable on all major platforms.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {ANIM_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setVideoAnimType(opt.value); stopPreview(); }}
                              className={`px-3 py-3 rounded-xl text-sm font-semibold text-left transition-all border ${videoAnimType === opt.value ? "bg-purple-600 border-purple-500 text-white" : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-purple-500/50"}`}
                            >
                              <div className="font-bold mb-0.5">{opt.label}</div>
                              <div className={`text-xs font-normal ${videoAnimType === opt.value ? "text-purple-200" : "text-gray-500"}`}>{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl px-4 py-3">
                          <span className="text-sm font-semibold text-white whitespace-nowrap">Clip duration</span>
                          <input
                            type="range" min={1} max={10} step={1} value={videoDurationSec}
                            onChange={(e) => { setVideoDurationSec(Number(e.target.value)); stopPreview(); }}
                            className="flex-1 accent-purple-500"
                          />
                          <span className="text-sm font-bold text-purple-300 w-8 text-right">{videoDurationSec}s</span>
                        </div>
                        <div className="flex gap-4 items-start">
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={videoPreviewPlaying ? stopPreview : playPreview}
                              disabled={videoExporting}
                              className="border-purple-500/50 text-purple-300 hover:bg-purple-950/40 whitespace-nowrap"
                            >
                              {videoPreviewPlaying ? <><Square className="w-3 h-3 mr-1.5 fill-current" />Stop</> : <><Play className="w-3 h-3 mr-1.5 fill-current" />Preview Animation</>}
                            </Button>
                            <p className="text-xs text-gray-500">Plays first image at {videoDurationSec}s duration</p>
                          </div>
                          <canvas
                            ref={videoPreviewCanvasRef}
                            width={VIDEO_WIDTH}
                            height={VIDEO_HEIGHT}
                            style={{ width: '77px', height: '137px', borderRadius: '6px', flexShrink: 0 }}
                            className="border border-gray-700 bg-black"
                          />
                        </div>
                        <Button
                          onClick={downloadVideos}
                          disabled={videoExporting}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 font-bold"
                          size="lg"
                        >
                          {videoExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering videos…</> : <><Film className="w-4 h-4 mr-2" />Generate Videos ({result?.posts.length ?? 0} clip{(result?.posts.length ?? 0) !== 1 ? 's' : ''} × {videoDurationSec}s)</>}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* First Comment */}
                  <div className="mt-4">
                    <label className="text-sm font-medium text-zinc-400 block mb-1.5">First comment (optional)</label>
                    <textarea
                      value={firstComment}
                      onChange={(e) => setFirstComment(e.target.value)}
                      placeholder="Save this one for later 💗"
                      rows={2}
                      className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                    <p className="text-xs text-zinc-600 mt-1">Posted as a comment 35 seconds after your post goes live on Instagram.</p>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleStartOver} className="px-8 py-6 text-lg font-semibold" size="lg">
                      <RefreshCcw className="w-5 h-5 mr-2" /> Start Over
                    </Button>
                    <div className="flex gap-3 flex-wrap justify-end">
                      <Button variant="outline" size="lg" onClick={() => setMusicPickerOpen(true)} className={`px-8 py-6 text-lg font-bold ${musicTrack ? "border-green-500/40 text-green-300 hover:bg-green-950/30" : ""}`}>
                        <Music className="w-5 h-5 mr-2" />{musicTrack ? musicTrack.name.slice(0, 22) : "Add music"}
                      </Button>
                      <Button variant="outline" size="lg" onClick={downloadCsv} className="px-8 py-6 text-lg font-bold">
                        <FileText className="w-5 h-5 mr-2" />Download CSV
                      </Button>
                      <Button variant="outline" size="lg" onClick={() => { setVideoExportOpen(true); setTimeout(() => document.getElementById('si-video-export-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className="px-8 py-6 text-lg font-bold border-purple-500/50 text-purple-300 hover:bg-purple-950/30">
                        <Film className="w-5 h-5 mr-2" />Export as Video
                      </Button>
                      <button className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3" onClick={downloadZip}>
                        <Download className="w-5 h-5" />Download ZIP
                      </button>
                      {ccStatus?.configured && (
                        <Button size="lg" onClick={pushToCloudCampaign} disabled={ccPushing} className="px-10 py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white">
                          {ccPushing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CloudUpload className="w-5 h-5 mr-2" />}
                          {ccPushing ? "Pushing..." : "Push to Cloud Campaign"}
                        </Button>
                      )}
                      {selectedPresetId && (
                        <Button size="lg" onClick={scheduleImages} disabled={scheduleRendering} variant="outline" className="px-10 py-6 text-lg font-bold border-pink-500/40 text-pink-300 hover:bg-pink-950/30">
                          {scheduleRendering ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CalendarClock className="w-5 h-5 mr-2" />}
                          {scheduleRendering ? "Preparing..." : "Schedule"}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </div>{/* closes max-w-3xl */}
        </div>{/* closes flex-1 overflow-y-auto */}
        </div>{/* closes editing area */}

        {/* ── Right preview column ── */}
        <div className="hidden lg:flex flex-col shrink-0 border-l border-zinc-800/60 bg-background/50" style={{ width: 288 }}>
          <div className="px-4 py-3 border-b border-border/30 shrink-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Live Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col items-center p-4 gap-3">
            {(currentStep >= 2 && designPreviewDataUrl) ? (
              <img
                src={designPreviewDataUrl}
                alt="Live preview"
                className="w-full rounded-xl shadow-lg object-contain"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              />
            ) : currentStep >= 2 ? (
              <div
                className="w-full rounded-xl bg-accent/20 flex items-center justify-center"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              >
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <div className="w-full rounded-xl border border-border/20 bg-accent/10 flex items-center justify-center" style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}>
                <p className="text-xs text-muted-foreground/50 text-center px-4">Preview loads from Step 2</p>
              </div>
            )}
          </div>
        </div>
      </div>{/* closes body flex */}

      <MusicPickerModal open={musicPickerOpen} onClose={() => setMusicPickerOpen(false)} selectedTrack={musicTrack} onSelect={(t) => setMusicTrack(t)} />
      {scheduleOpen && selectedPresetId && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={presets.find((p) => p.id === selectedPresetId)?.name}
          postType="single-image"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      <VanessaChat />
    </div>
  );
}
