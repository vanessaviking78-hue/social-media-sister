import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, Palette, Sparkles, Wand2, Copy, Check, MessageSquareText, Plus, ChevronLeft, ChevronRight, Type, PenTool, CloudUpload, ImagePlus, CalendarDays, BarChart3, ShieldCheck, BookOpen, Film, ChevronDown, Play, Square, Share2 } from "lucide-react";
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
import { CANVAS_WIDTH, CANVAS_HEIGHT, VIDEO_WIDTH, VIDEO_HEIGHT, FONT_OPTIONS, CORNER_STYLES, LOGO_POSITIONS, loadGoogleFonts, drawSlide, compressImage, recordSlideVideo, recordGroupVideo, type AnimationType } from "@/lib/slide-utils";
import { usePresets, type ClientPreset, type PresetStyleFields, type TextPosition, type TextAlign, type CornerStyle, isCornerStyle, normalizeTextPosition } from "@/lib/use-presets";
import type { LogoPosition } from "@workspace/db/schema";
import { useCaptions } from "@/lib/use-captions";
import PresetSelector from "@/components/preset-selector";
import ApprovedImagesPicker from "@/components/approved-images-picker";

loadGoogleFonts();

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [result, setResult] = useState<CarouselResult | null>(null);

  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const [fontSize, setFontSize] = useState(52);
  const [contentFontSize, setContentFontSize] = useState(44);
  const [fontFamily, setFontFamily] = useState("'Cinzel', serif");
  const [subheadingFont, setSubheadingFont] = useState("'Cinzel', serif");
  const [textColor, setTextColor] = useState("#ffffff");
  const [lineSpacing, setLineSpacing] = useState(0.9);
  const [coverLetterSpacing, setCoverLetterSpacing] = useState(0);
  const [coverUppercase, setCoverUppercase] = useState(false);
  const [coverDropCap, setCoverDropCap] = useState(false);
  const [coverDropCapFont, setCoverDropCapFont] = useState("'Great Vibes', cursive");
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.5)");
  const [pageColor, setPageColor] = useState("#000000");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("none");
  const [cornerColor, setCornerColor] = useState("#d4af37");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [textAlign, setTextAlign] = useState<TextAlign>("left");
  const [showTextOverlay, setShowTextOverlay] = useState(true);
  const [textBoxOutline, setTextBoxOutline] = useState(false);
  const [textBoxOutlineColor, setTextBoxOutlineColor] = useState("#ffffff");

  const [coverSubheading, setCoverSubheading] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
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


  const [captions, setCaptions] = useState<string[]>([]);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionProgress, setCaptionProgress] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [ccPushing, setCcPushing] = useState(false);
  const [ccStatus, setCcStatus] = useState<{ configured: boolean; hasWorkspaces: boolean } | null>(null);
  const [metaPushing, setMetaPushing] = useState(false);

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
  const [videoJoinGroup, setVideoJoinGroup] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState(4);
  const [videoPreviewPlaying, setVideoPreviewPlaying] = useState(false);
  const videoPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoPreviewRafRef = useRef<number | null>(null);

  const getCurrentStyles = (): PresetStyleFields => ({
    pageColor, overlayColor, fontFamily, subheadingFont, fontSize, contentFontSize, textColor, lineSpacing,
    cornerStyle, cornerColor, textPosition, textAlign, textBoxOutline, textBoxOutlineColor, logoPosition, logoSize,
    coverSubheading,
  });

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
    setCoverSubheading(preset.coverSubheading || "");
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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/status`)
      .then((r) => r.json())
      .then((d) => setCcStatus(d))
      .catch(() => setCcStatus(null));
  }, []);

  const pushToCloudCampaign = async () => {
    if (!result?.slides.length) return;
    setCcPushing(true);
    const id = toast.loading("Rendering slides for Cloud Campaign...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string; groupIndex: number; groupPosition: number }[] = [];
      for (const slide of result.slides) {
        const isCover = slide.groupPosition === 1;
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont);
        URL.revokeObjectURL(img.src);
        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `carousel-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`;
        rendered.push({ name: fileName, base64: dataUrl, groupIndex: slide.groupIndex, groupPosition: slide.groupPosition });
      }

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      toast.loading("Pushing to Cloud Campaign...", { id });
      const posts = [];
      for (let gi = 0; gi < result.totalCarousels; gi++) {
        const groupSlides = result.slides.filter((s: any) => s.groupIndex === gi + 1).sort((a: any, b: any) => a.groupPosition - b.groupPosition);
        const imageUrls = groupSlides.map((s: any) => {
          const fn = `carousel-${String(s.groupIndex).padStart(2, "0")}-slide-${String(s.groupPosition).padStart(2, "0")}.png`;
          return urlMap.get(fn) || "";
        }).filter(Boolean);
        posts.push({
          title: `Carousel ${gi + 1}`,
          caption: captions[gi] || "",
          imageUrls,
        });
      }

      const selectedPreset = presets.find((p) => p.id === selectedPresetId);
      if (!selectedPreset?.ccWorkspaceId) {
        toast.error("Please select a client preset with a linked Cloud Campaign workspace first.", { id });
        setCcPushing(false);
        return;
      }
      const pushBody: { posts: typeof posts; workspaceIds: string[]; postType: string } = { posts, workspaceIds: [selectedPreset.ccWorkspaceId], postType: "carousel" };
      const resp = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushBody),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Push failed");
      toast.success(`Pushed ${data.summary.succeeded} carousel(s) to Cloud Campaign!`, { id });
      if (data.summary.failed > 0) {
        toast.error(`${data.summary.failed} post(s) failed. Check the console for details.`);
        console.error("Cloud Campaign push failures:", data.results.filter((r: any) => r.status === "error"));
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Cloud Campaign push failed: " + (e?.message || "Unknown error"), { id });
    } finally {
      setCcPushing(false);
    }
  };

  const pushToMeta = async () => {
    if (!result?.slides.length) return;
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);
    if (!selectedPreset?.metaInstagramAccountId && !selectedPreset?.metaFacebookPageId) {
      toast.error("Please select a client preset with Meta (Instagram/Facebook) connected first. Add the connection in Client Presets.");
      return;
    }
    setMetaPushing(true);
    const id = toast.loading("Rendering slides for Instagram & Facebook...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string; groupIndex: number; groupPosition: number }[] = [];
      for (const slide of result.slides) {
        const isCover = slide.groupPosition === 1;
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont);
        URL.revokeObjectURL(img.src);
        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `meta-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`;
        rendered.push({ name: fileName, base64: dataUrl, groupIndex: slide.groupIndex, groupPosition: slide.groupPosition });
      }

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      toast.loading("Posting to Instagram & Facebook...", { id });
      const posts = [];
      for (let gi = 0; gi < result.totalCarousels; gi++) {
        const groupSlides = result.slides.filter((s: any) => s.groupIndex === gi + 1).sort((a: any, b: any) => a.groupPosition - b.groupPosition);
        const imageUrls = groupSlides.map((s: any) => {
          const fn = `meta-${String(s.groupIndex).padStart(2, "0")}-slide-${String(s.groupPosition).padStart(2, "0")}.png`;
          return urlMap.get(fn) || "";
        }).filter(Boolean);
        posts.push({ title: `Carousel ${gi + 1}`, caption: captions[gi] || "", imageUrls });
      }

      const resp = await fetch(`${import.meta.env.BASE_URL}api/meta/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts, presetId: selectedPreset!.id, postType: "carousel" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Push failed");
      const igResults = data.results.filter((r: any) => r.platform === "instagram");
      const fbResults = data.results.filter((r: any) => r.platform === "facebook");
      const igOk = igResults.filter((r: any) => r.status === "success").length;
      const fbOk = fbResults.filter((r: any) => r.status === "success").length;
      const parts = [];
      if (igOk) parts.push(`${igOk} to Instagram`);
      if (fbOk) parts.push(`${fbOk} to Facebook`);
      toast.success(`Posted ${parts.join(" & ")}!`, { id });
      if (data.summary.failed > 0) {
        toast.error(`${data.summary.failed} post(s) failed.`);
      }
    } catch (e: any) {
      toast.error("Meta push failed: " + (e?.message || "Unknown error"), { id });
    } finally {
      setMetaPushing(false);
    }
  };

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
    setAiGeneratedPosts(null); setAiProgress(""); setSavedCaptionIndices(new Set()); setCurrentStep(1);
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
        drawSlide(ctx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont);
        URL.revokeObjectURL(img.src);
        const outBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (outBlob) {
          zip.file(`carousel-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`, outBlob);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      fetch(`${import.meta.env.BASE_URL}api/analytics/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "downloaded", postType: "carousel", clientName: aiClientName || "", postCount: result.slides.length > 0 ? new Set(result.slides.map((s: any) => s.groupIndex)).size : 0 }) }).catch(() => {});
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
    if (!result?.slides.length) return;
    const id = toast.loading("Rendering slides...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string }[] = [];

      for (const slide of result.slides) {
        const isCover = slide.groupPosition === 1;
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont);
        URL.revokeObjectURL(img.src);
        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `carousel-${String(slide.groupIndex).padStart(2, "0")}-slide-${String(slide.groupPosition).padStart(2, "0")}.png`;
        rendered.push({ name: fileName, base64: dataUrl });
      }

      const urlMap = new Map<string, string>();
      const PARALLEL = 3;
      for (let i = 0; i < rendered.length; i += PARALLEL) {
        toast.loading(`Uploading images... ${i}/${rendered.length}`, { id });
        const batch = rendered.slice(i, i + PARALLEL);
        const urls = await Promise.all(batch.map((r) => uploadOneImage(r.name, r.base64)));
        batch.forEach((r, bi) => urlMap.set(r.name, urls[bi]));
      }

      const maxSlides = result.slidesPerCarousel || 5;
      const rows: string[][] = [];
      const header = ["Image", "Caption", "Title", "Approved"];
      for (let s = 2; s <= maxSlides; s++) header.push(`Image ${s}`);
      rows.push(header);
      for (let gi = 0; gi < result.totalCarousels; gi++) {
        const groupSlides = result.slides.filter((s: any) => s.groupIndex === gi + 1).sort((a: any, b: any) => a.groupPosition - b.groupPosition);
        const slideUrls = groupSlides.map((s: any) => {
          const fn = `carousel-${String(s.groupIndex).padStart(2, "0")}-slide-${String(s.groupPosition).padStart(2, "0")}.png`;
          return urlMap.get(fn) || fn;
        });
        const caption = captions[gi] || "";
        const row = [slideUrls[0] || "", caption, `Carousel ${gi + 1}`, "TRUE"];
        for (let s = 1; s < maxSlides; s++) row.push(slideUrls[s] || "");
        rows.push(row);
      }
      const csvString = Papa.unparse(rows);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvString], { type: "text/csv;charset=utf-8" });
      saveAs(blob, "carousel-posts.csv");
      fetch(`${import.meta.env.BASE_URL}api/analytics/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "downloaded", postType: "carousel", clientName: aiClientName || "", postCount: result.totalCarousels }) }).catch(() => {});
      toast.success("CSV downloaded with image links", { id });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed: " + (e?.message || "Unknown error"), { id });
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
    if (!result?.slides.length || !videoPreviewCanvasRef.current) return;
    stopPreview();
    const slide = result.slides[0];
    const isCover = slide.groupPosition === 1;
    try {
      const res = await fetch(slide.imageUrl);
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
          drawSlide(offCtx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont, videoAnimType, progress);
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
  }, [result, videoDurationSec, videoAnimType, fontFamily, fontSize, contentFontSize, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, stopPreview]);

  const downloadVideos = async () => {
    if (!result?.slides.length) return;
    setVideoExporting(true);
    const totalClips = videoJoinGroup ? result.totalCarousels : result.slides.length;
    const id = toast.loading(`Preparing ${totalClips} video${totalClips !== 1 ? 's' : ''}…`);
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

      if (videoJoinGroup) {
        for (let gi = 1; gi <= result.totalCarousels; gi++) {
          const groupSlides = result.slides.filter((s: any) => s.groupIndex === gi);
          toast.loading(`Rendering carousel ${gi} of ${result.totalCarousels} (${groupSlides.length} slides joined)…`, { id });
          const imgs: HTMLImageElement[] = [];
          for (const slide of groupSlides) {
            const res = await fetch(slide.imageUrl);
            const blob = await res.blob();
            const img = new Image();
            await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
            imgs.push(img);
          }
          const videoBlob = await recordGroupVideo(canvas, videoDurationSec * 1000, 300, groupSlides.length, (si, progress) => {
            const slide = groupSlides[si];
            const isCover = slide.groupPosition === 1;
            drawSlide(offCtx, imgs[si], slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont, videoAnimType, progress);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            ctx.drawImage(offscreen, 0, yOff);
          });
          imgs.forEach((img) => URL.revokeObjectURL(img.src));
          zip.file(`carousel-${String(gi).padStart(2, '0')}-group.webm`, videoBlob);
        }
      } else {
        for (let si = 0; si < result.slides.length; si++) {
          const slide = result.slides[si];
          toast.loading(`Rendering slide ${si + 1} of ${result.slides.length}…`, { id });
          const isCover = slide.groupPosition === 1;
          const res = await fetch(slide.imageUrl);
          const blob = await res.blob();
          const img = new Image();
          await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
          const videoBlob = await recordSlideVideo(canvas, (progress) => {
            drawSlide(offCtx, img, slide.text, fontFamily, isCover ? fontSize : contentFontSize, isCover, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, slide.groupPosition, result.slidesPerCarousel, textPosition, showTextOverlay, subheadingFont, textAlign, textBoxOutline, textBoxOutlineColor, coverSubheading, coverLetterSpacing, coverUppercase, coverDropCap, coverDropCapFont, videoAnimType, progress);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            ctx.drawImage(offscreen, 0, yOff);
          }, videoDurationSec * 1000);
          URL.revokeObjectURL(img.src);
          const fileName = `carousel-${String(slide.groupIndex).padStart(2, '0')}-slide-${String(slide.groupPosition).padStart(2, '0')}.webm`;
          zip.file(fileName, videoBlob);
        }
      }

      toast.loading('Zipping videos…', { id });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'carousel-videos.zip');
      toast.success(`${totalClips} video${totalClips !== 1 ? 's' : ''} downloaded!`, { id });
    } catch (e: any) {
      console.error(e);
      toast.error('Video export failed: ' + (e?.message || 'Unknown error'), { id });
    } finally {
      setVideoExporting(false);
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
  const selectedSubheadingFontLabel = FONT_OPTIONS.find((f) => f.value === subheadingFont)?.label ?? "Inter";
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
          <h1 className="font-sans text-3xl font-bold tracking-tight"><span className="text-white">Social Media Sister's</span>{" "}<span className="text-pink-400">CyberSuite</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/single-image">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ImagePlus className="w-4 h-4 mr-2" />
              Single Image
            </Button>
          </Link>
          <Link href="/stories">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Stories
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
              <Button size="sm" onClick={downloadZip} data-testid="button-download-zip">
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 pb-32">
        {/* Step Progress Bar */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              {[
                { num: 1, label: "Images", icon: ImageIcon },
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
                  <p className="text-lg text-muted-foreground">Upload your photos and add your logo.</p>
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

                <ApprovedImagesPicker
                  clientName={presets.find((p) => p.id === selectedPresetId)?.name || ""}
                  onAddImages={(files) => setPhotos((prev) => [...prev, ...files])}
                />

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Heading Font */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Heading Font</Label>
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

                  {/* Subheading Font */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Subheading Font</Label>
                    <Select value={subheadingFont} onValueChange={setSubheadingFont}>
                      <SelectTrigger className="h-12 text-base" data-testid="select-subheading-font">
                        <SelectValue><span style={{ fontFamily: subheadingFont }}>{selectedSubheadingFontLabel}</span></SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="pt-1 space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Cover Subheading Text</Label>
                      <Input
                        placeholder="e.g. Your tagline here"
                        value={coverSubheading}
                        onChange={(e) => setCoverSubheading(e.target.value)}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">Optional — shown only on the cover (first) slide, in the subheading font</p>
                    </div>
                  </div>

                  {/* Text Size */}
                  <div className="space-y-4 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Text Size</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cover slide</span>
                        <span className="text-sm font-semibold tabular-nums">{fontSize}px</span>
                      </div>
                      <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Content slides</span>
                        <span className="text-sm font-semibold tabular-nums">{contentFontSize}px</span>
                      </div>
                      <Slider min={28} max={96} step={2} value={[contentFontSize]} onValueChange={([v]) => setContentFontSize(v)} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cover slide letter spacing</span>
                        <span className="text-sm font-semibold tabular-nums">{coverLetterSpacing}px</span>
                      </div>
                      <Slider min={-5} max={20} step={0.5} value={[coverLetterSpacing]} onValueChange={([v]) => setCoverLetterSpacing(v)} className="w-full" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cover slide ALL CAPS</span>
                      <button
                        onClick={() => setCoverUppercase(!coverUppercase)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${coverUppercase ? "bg-pink-500" : "bg-gray-600"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${coverUppercase ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Large drop cap first letter</span>
                      <button
                        onClick={() => setCoverDropCap(!coverDropCap)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${coverDropCap ? "bg-pink-500" : "bg-gray-600"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${coverDropCap ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                    {coverDropCap && (
                      <div className="space-y-1.5">
                        <span className="text-sm text-muted-foreground">Drop cap font</span>
                        <select value={coverDropCapFont} onChange={(e) => setCoverDropCapFont(e.target.value)} className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm">
                          {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
                        </select>
                      </div>
                    )}
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
                    <p className="text-xs text-muted-foreground/60">Last slide always centre</p>
                  </div>

                  {/* Text Alignment */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <Label className="text-base font-semibold">Text Alignment</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([{ value: "left" as TextAlign, label: "Left" }, { value: "center" as TextAlign, label: "Centre" }, { value: "right" as TextAlign, label: "Right" }] as const).map((opt) => (
                        <button key={opt.value} onClick={() => setTextAlign(opt.value)}
                          className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${textAlign === opt.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {/* Live alignment preview */}
                    <div className="rounded-lg border border-border/40 bg-background/60 px-4 py-3 space-y-1.5">
                      {[70, 100, 55].map((w, i) => (
                        <div key={i} className={`flex ${textAlign === "left" ? "justify-start" : textAlign === "right" ? "justify-end" : "justify-center"}`}>
                          <div className="h-2 rounded-full bg-muted-foreground/30 transition-all duration-200" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                    </div>
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
                    {/* Live mini slide preview */}
                    <div
                      className="w-full rounded-xl overflow-hidden border border-border/40"
                      style={{
                        backgroundColor: pageColor,
                        aspectRatio: "1 / 1",
                        maxHeight: 160,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "12px 16px",
                      }}
                    >
                      <span
                        style={{
                          color: textColor,
                          fontFamily: fontFamily,
                          fontSize: 18,
                          fontWeight: 700,
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        Headline Text
                      </span>
                      <span
                        style={{
                          color: textColor,
                          fontFamily: subheadingFont,
                          fontSize: 12,
                          textAlign: "center",
                          opacity: 0.8,
                        }}
                      >
                        Body copy preview
                      </span>
                    </div>
                  </div>

                  {/* Text Overlay Toggle */}
                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Text Box</Label>
                      <button
                        onClick={() => setShowTextOverlay(!showTextOverlay)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${showTextOverlay ? "bg-pink-500" : "bg-gray-600"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${showTextOverlay ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{showTextOverlay ? "Coloured box behind text" : "Text only with drop shadow"}</p>
                  </div>

                  {/* Overlay Colour */}
                  {showTextOverlay && <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
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
                    {/* Live overlay colour preview */}
                    <div
                      className="w-full rounded-xl overflow-hidden border border-border/40"
                      style={{
                        background: pageColor,
                        aspectRatio: "2 / 1",
                        maxHeight: 100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: overlayColor,
                          padding: "8px 18px",
                          borderRadius: 8,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <span
                          style={{
                            color: textColor,
                            fontFamily: fontFamily,
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }}
                        >
                          Headline Text
                        </span>
                        <span
                          style={{
                            color: textColor,
                            fontFamily: subheadingFont,
                            fontSize: 10,
                            opacity: 0.85,
                          }}
                        >
                          Body copy preview
                        </span>
                      </div>
                    </div>
                  </div>}

                  {/* Text Box Outline */}
                  {showTextOverlay && <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
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
                      <>
                        <div className="flex gap-3">
                          <Input type="color" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="w-14 h-12 p-1 cursor-pointer" />
                          <Input type="text" value={textBoxOutlineColor} onChange={(e) => setTextBoxOutlineColor(e.target.value)} className="flex-1 h-12 text-base font-mono" placeholder="#ffffff" />
                        </div>
                        {/* Live outline colour preview */}
                        <div
                          className="w-full rounded-xl overflow-hidden border border-border/40"
                          style={{
                            background: pageColor,
                            aspectRatio: "2 / 1",
                            maxHeight: 100,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: overlayColor,
                              border: `2px solid ${textBoxOutlineColor}`,
                              padding: "8px 18px",
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <span
                              style={{
                                color: textColor,
                                fontFamily: fontFamily,
                                fontSize: 14,
                                fontWeight: 700,
                                lineHeight: 1.2,
                              }}
                            >
                              Headline Text
                            </span>
                            <span
                              style={{
                                color: textColor,
                                fontFamily: subheadingFont,
                                fontSize: 10,
                                opacity: 0.85,
                              }}
                            >
                              Body copy preview
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>}

                  {/* Corner Accent */}
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

                  {/* Logo controls */}
                  {logoFile && (
                    <>
                      <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                        <Label className="text-base font-semibold">Logo Position</Label>
                        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Logo position">
                          {LOGO_POSITIONS.map((p) => (
                            <button type="button" key={p.value} onClick={() => setLogoPosition(p.value)}
                              aria-pressed={logoPosition === p.value}
                              className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all ${logoPosition === p.value ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/60"}`}
                            >{p.label}</button>
                          ))}
                        </div>
                        {/* Live logo position preview */}
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
                        <p className="text-xs text-muted-foreground">Select captions to use as carousel post text. Each caption becomes one carousel post.</p>
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
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
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
                            </div>
                          );
                        })}
                        {selectedLibCaptionIds.size > 0 && (
                          <Button className="w-full" onClick={() => {
                            const selected = libCaptions.filter((lc) => selectedLibCaptionIds.has(lc.id));
                            const rows = selected.map((lc) => [lc.text]);
                            const csvContent = rows.map((r) => `"${r[0].replace(/"/g, '""')}"`).join("\n");
                            const blob = new Blob([csvContent], { type: "text/csv" });
                            const file = new File([blob], "library-captions.csv", { type: "text/csv" });
                            setCsvFile(file);
                            setAllCsvRows(rows);
                            setCsvPreview({ headers: ["Text"], rows: rows.slice(0, 5) });
                            setSelectedLibCaptionIds(new Set());
                            setShowBrowseLibrary(false);
                            setContentMode("csv");
                            toast.success(`${selected.length} caption(s) loaded as CSV content`);
                          }}>
                            <Check className="w-4 h-4 mr-2" /> Use {selectedLibCaptionIds.size} Caption{selectedLibCaptionIds.size > 1 ? "s" : ""}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

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
                      <div className="flex gap-3 flex-wrap justify-end">
                        <button className="btn-shimmer px-8 py-4 rounded-2xl text-lg font-bold flex items-center gap-3" onClick={downloadZip} data-testid="button-download-zip-bar">
                          <Download className="w-5 h-5" />Download ZIP
                        </button>
                        <Button variant="outline" size="lg" onClick={() => { setVideoExportOpen(true); setTimeout(() => document.getElementById('video-export-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className="px-8 py-4 text-lg font-bold border-purple-500/50 text-purple-300 hover:bg-purple-950/30" data-testid="button-export-video-bar">
                          <Film className="w-5 h-5 mr-2" />Export as Video
                        </Button>
                        <Button variant="outline" size="lg" onClick={downloadCsv} className="px-8 py-4 text-lg font-bold" data-testid="button-download-csv-bar">
                          <FileText className="w-5 h-5 mr-2" />Download CSV
                        </Button>
                        {ccStatus?.configured && (
                          <Button size="lg" onClick={pushToCloudCampaign} disabled={ccPushing} className="px-8 py-4 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-push-cc-bar">
                            {ccPushing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CloudUpload className="w-5 h-5 mr-2" />}
                            {ccPushing ? "Pushing..." : "Push to Cloud Campaign"}
                          </Button>
                        )}
                        {presets.find((p) => p.id === selectedPresetId)?.metaInstagramAccountId || presets.find((p) => p.id === selectedPresetId)?.metaFacebookPageId ? (
                          <Button size="lg" onClick={pushToMeta} disabled={metaPushing} className="px-8 py-4 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white" data-testid="button-push-meta-bar">
                            {metaPushing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Share2 className="w-5 h-5 mr-2" />}
                            {metaPushing ? "Posting..." : "Post to Instagram & Facebook"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* Video Export Panel */}
                    <div id="video-export-panel" className="rounded-2xl border border-purple-500/20 bg-purple-950/10 overflow-hidden">
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
                          <p className="text-xs text-gray-400 pt-4">Each slide becomes an animated clip. Downloads as a ZIP of <code>.webm</code> files, playable on all major platforms.</p>
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
                          {/* Duration slider */}
                          <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl px-4 py-3">
                            <span className="text-sm font-semibold text-white whitespace-nowrap">Clip duration</span>
                            <input
                              type="range" min={1} max={10} step={1} value={videoDurationSec}
                              onChange={(e) => { setVideoDurationSec(Number(e.target.value)); stopPreview(); }}
                              className="flex-1 accent-purple-500"
                            />
                            <span className="text-sm font-bold text-purple-300 w-8 text-right">{videoDurationSec}s</span>
                          </div>
                          {/* Animation preview */}
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
                              <p className="text-xs text-gray-500">Plays first slide at {videoDurationSec}s duration</p>
                            </div>
                            <canvas
                              ref={videoPreviewCanvasRef}
                              width={VIDEO_WIDTH}
                              height={VIDEO_HEIGHT}
                              style={{ width: '77px', height: '137px', borderRadius: '6px', flexShrink: 0 }}
                              className="border border-gray-700 bg-black"
                            />
                          </div>
                          <button
                            onClick={() => setVideoJoinGroup((v) => !v)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all w-full text-left ${videoJoinGroup ? "bg-purple-600/20 border-purple-500 text-purple-200" : "bg-gray-800/40 border-gray-700 text-gray-400"}`}
                          >
                            <span className={`w-10 h-6 rounded-full flex items-center transition-colors ${videoJoinGroup ? "bg-purple-600" : "bg-gray-600"}`}>
                              <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${videoJoinGroup ? "translate-x-4" : "translate-x-0"}`} />
                            </span>
                            <div>
                              <div className="text-white font-bold">Join slides per carousel into one clip</div>
                              <div className="text-xs font-normal text-gray-400">Slides are joined with a ~0.3s black flash. One file per carousel.</div>
                            </div>
                          </button>
                          <Button
                            onClick={downloadVideos}
                            disabled={videoExporting}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 font-bold"
                            size="lg"
                          >
                            {videoExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering videos…</> : <><Film className="w-4 h-4 mr-2" />Generate Videos ({videoJoinGroup ? `${result.totalCarousels} joined clip${result.totalCarousels !== 1 ? 's' : ''}` : `${result.slides.length} clip${result.slides.length !== 1 ? 's' : ''}`} × {videoDurationSec}s)</>}
                          </Button>
                        </div>
                      )}
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
                                    {logoPreviewUrl && (() => {
                                      const posStyle: React.CSSProperties = { position: "absolute" };
                                      if (logoPosition === "top-left") { posStyle.top = 4; posStyle.left = 4; }
                                      else if (logoPosition === "top-right") { posStyle.top = 4; posStyle.right = 4; }
                                      else if (logoPosition === "bottom-left") { posStyle.bottom = 24; posStyle.left = 4; }
                                      else { posStyle.bottom = 24; posStyle.right = 4; }
                                      return <img src={logoPreviewUrl} alt="Logo" style={{ ...posStyle, height: previewLogoH, maxWidth: 60, objectFit: "contain" }} />;
                                    })()}
                                    <div className={`absolute ${textPosition === "top" ? "top-4" : textPosition === "center" ? "top-1/2 -translate-y-1/2" : "bottom-4"} px-2 py-1.5 left-[1px] right-[1px]`} style={showTextOverlay ? { backgroundColor: overlayColor, outline: textBoxOutline ? `2px solid ${textBoxOutlineColor}` : undefined } : {}}>
                                      <p className={`font-semibold ${isCover ? "" : "line-clamp-4"}`} style={{ fontFamily: isCover ? fontFamily : subheadingFont, fontSize: Math.max(7, Math.round((isCover ? fontSize : contentFontSize) * 0.15)) + "px", color: textColor, lineHeight: lineSpacing, textAlign: textAlign === "center" ? "center" : textAlign === "right" ? "right" : "left", overflowWrap: "break-word", wordBreak: "break-word", ...(isCover && coverLetterSpacing ? { letterSpacing: (coverLetterSpacing * 0.15) + "px" } : {}), ...(isCover && coverUppercase ? { textTransform: "uppercase" } : {}), }}>{isCover && coverDropCap && slide.text ? (<><span style={{ fontFamily: coverDropCapFont, fontSize: Math.max(12, Math.round(fontSize * 0.15 * 2)) + "px", lineHeight: 1, display: "inline-block", marginRight: "1px" }}>{slide.text[0]}</span>{slide.text.slice(1)}</>) : slide.text}</p>
                                      {isCover && coverSubheading && (
                                        <p className="line-clamp-2 mt-0.5" style={{ fontFamily: subheadingFont, fontSize: Math.max(5, Math.round(fontSize * 0.15 * 0.65)) + "px", color: textColor, lineHeight: lineSpacing, textAlign: textAlign === "center" ? "center" : textAlign === "right" ? "right" : "left", overflowWrap: "break-word", wordBreak: "break-word", }}>{coverSubheading}</p>
                                      )}
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

                    {/* Step 4 Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={handleStartOver} className="px-8 py-6 text-lg font-semibold" size="lg">
                        <RefreshCcw className="w-5 h-5 mr-2" /> Start Over
                      </Button>
                      <div className="flex gap-3 flex-wrap justify-end">
                        <Button variant="outline" size="lg" onClick={downloadCsv} className="px-8 py-6 text-lg font-bold" data-testid="button-download-csv">
                          <FileText className="w-5 h-5 mr-2" />Download CSV
                        </Button>
                        <button className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3" onClick={downloadZip} data-testid="button-download-zip">
                          <Download className="w-5 h-5" />Download ZIP
                        </button>
                        {ccStatus?.configured && (
                          <Button size="lg" onClick={pushToCloudCampaign} disabled={ccPushing} className="px-10 py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-push-cc">
                            {ccPushing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CloudUpload className="w-5 h-5 mr-2" />}
                            {ccPushing ? "Pushing..." : "Push to Cloud Campaign"}
                          </Button>
                        )}
                        {presets.find((p) => p.id === selectedPresetId)?.metaInstagramAccountId || presets.find((p) => p.id === selectedPresetId)?.metaFacebookPageId ? (
                          <Button size="lg" onClick={pushToMeta} disabled={metaPushing} className="px-10 py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white" data-testid="button-push-meta">
                            {metaPushing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Share2 className="w-5 h-5 mr-2" />}
                            {metaPushing ? "Posting..." : "Post to Instagram & Facebook"}
                          </Button>
                        ) : null}
                      </div>
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
