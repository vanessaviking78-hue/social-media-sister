import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, Palette, Sparkles, Wand2, Copy, Check, MessageSquareText, Plus, ChevronLeft, ChevronRight, Type, PenTool, ArrowLeftRight, CloudUpload, ImagePlus, CalendarDays, BarChart3, ShieldCheck,
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
import { CANVAS_WIDTH, CANVAS_HEIGHT, FONT_OPTIONS, CORNER_STYLES, LOGO_POSITIONS, loadGoogleFonts, drawSlide, compressImage } from "@/lib/slide-utils";
import { usePresets, type ClientPreset, type PresetStyleFields } from "@/lib/use-presets";
import { useCaptions } from "@/lib/use-captions";
import PresetSelector from "@/components/preset-selector";

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
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [logoSize, setLogoSize] = useState(140);

  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [fontSize, setFontSize] = useState(52);
  const [textColor, setTextColor] = useState("#ffffff");
  const [lineSpacing, setLineSpacing] = useState(0.9);
  const [overlayColor, setOverlayColor] = useState("rgba(0,0,0,0.5)");
  const [pageColor, setPageColor] = useState("#000000");
  const [cornerStyle, setCornerStyle] = useState("none");
  const [cornerColor, setCornerColor] = useState("#d4af37");
  const [gradientColor, setGradientColor] = useState("#000000");
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [gradientStyle, setGradientStyle] = useState("solid");
  const [gradientPosition, setGradientPosition] = useState("left");
  const [textPosition, setTextPosition] = useState("bottom-left");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: string[] }>({ rows: [] });
  const [allCsvRows, setAllCsvRows] = useState<string[]>([]);
  const [contentMode, setContentMode] = useState<"csv" | "ai">("csv");
  const [aiIndustry, setAiIndustry] = useState("aesthetics");
  const [aiClientName, setAiClientName] = useState("");
  const [aiTone, setAiTone] = useState("warm & professional");
  const [aiTopics, setAiTopics] = useState("");
  const [aiPostCount, setAiPostCount] = useState(10);
  const [aiExtraInstructions, setAiExtraInstructions] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiGeneratedTexts, setAiGeneratedTexts] = useState<string[] | null>(null);

  const [captions, setCaptions] = useState<string[]>([]);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionProgress, setCaptionProgress] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [result, setResult] = useState<SingleResult | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [ccStatus, setCcStatus] = useState<{ configured: boolean } | null>(null);

  const { presets, loading: presetsLoading, savePreset, updatePreset, deletePreset, uploadLogo } = usePresets();
  const { saveCaption: saveCaptionToLib, bulkSave: bulkSaveCaptions, captions: libCaptions, fetchCaptions: refreshLibCaptions } = useCaptions();
  const [savedCaptionIndices, setSavedCaptionIndices] = useState<Set<number>>(new Set());
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [showBrowseLibrary, setShowBrowseLibrary] = useState(false);
  const [selectedLibCaptionIds, setSelectedLibCaptionIds] = useState<Set<number>>(new Set());

  const getCurrentStyles = (): PresetStyleFields => ({
    pageColor, overlayColor, fontFamily, fontSize, textColor, lineSpacing,
    cornerStyle, cornerColor, gradientEnabled, gradientStyle, gradientColor,
    gradientPosition, textPosition, logoPosition, logoSize,
  });

  const applyPreset = (preset: ClientPreset) => {
    setSelectedPresetId(preset.id);
    setPageColor(preset.pageColor);
    setOverlayColor(preset.overlayColor);
    setFontFamily(preset.fontFamily);
    setFontSize(preset.fontSize);
    setTextColor(preset.textColor);
    setLineSpacing(parseFloat(preset.lineSpacing));
    setCornerStyle(preset.cornerStyle);
    setCornerColor(preset.cornerColor);
    setGradientEnabled(preset.gradientEnabled);
    setGradientStyle(preset.gradientStyle);
    setGradientColor(preset.gradientColor);
    setGradientPosition(preset.gradientPosition);
    setTextPosition(preset.textPosition);
    setLogoPosition(preset.logoPosition);
    setLogoSize(preset.logoSize);
    setCurrentLogoUrl(preset.logoUrl || null);
    if (preset.logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLogoImg(img);
      img.src = preset.logoUrl;
    } else {
      setLogoImg(null);
      setLogoFile(null);
    }
  };
  const [ccPushing, setCcPushing] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const logoPreviewUrl = logoFile ? URL.createObjectURL(logoFile) : null;

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
    if (!csvFile && !allCsvRows.length) { toast.error("Please upload a CSV file"); return; }

    setIsGenerating(true);
    const toastId = toast.loading("Generating images...");

    try {
      const texts = allCsvRows;
      if (texts.length === 0) throw new Error("CSV has no data rows");

      const photoUrls = photos.map((f) => URL.createObjectURL(f));
      const postCount = photos.length;

      if (texts.length < postCount) {
        toast.warning(`Only ${texts.length} text(s) for ${postCount} photo(s) - extra photos will have no text overlay`);
      }

      const posts: SinglePost[] = photos.map((photo, i) => ({
        index: i + 1,
        text: texts[i] || "",
        imageUrl: photoUrls[i],
        imageName: photo.name,
      }));

      setResult({ posts, totalPosts: posts.length, sessionId: "local" });
      setCurrentStep(4);
      toast.success(`${posts.length} single image posts ready to download`, { id: toastId });
    } catch (e: any) {
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
    setAiGeneratedTexts(null);
    const toastId = toast.loading("AI is writing your content...");

    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/content/generate-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: aiClientName,
          industry: aiIndustry,
          tone: aiTone,
          topics: aiTopics,
          postCount: photos.length > 0 ? photos.length : aiPostCount,
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
              setAiGeneratedTexts(evt.texts);
              setAiProgress("");
              toast.success(`${evt.texts.length} single image texts generated!`, { id: toastId });
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

  const handleGenerateFromAi = async () => {
    if (!photos.length) { toast.error("Please upload at least one photo"); return; }
    if (!aiIndustry.trim()) { toast.error("Please enter an industry"); return; }
    if (!aiTopics.trim()) { toast.error("Please enter topics"); return; }

    setIsGenerating(true);

    try {
      let texts = aiGeneratedTexts;
      if (!texts?.length) {
        setAiGenerating(true);
        setAiProgress("Starting content generation...");
        const toastId = toast.loading("AI is writing your content...");

        const resp = await fetch(`${import.meta.env.BASE_URL}api/content/generate-single`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: aiClientName,
            industry: aiIndustry,
            tone: aiTone,
            topics: aiTopics,
            postCount: photos.length,
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
                texts = evt.texts;
                setAiGeneratedTexts(evt.texts);
                setAiProgress("");
                toast.success(`${evt.texts.length} texts generated - building images...`, { id: toastId });
              } else if (evt.type === "error") {
                toast.error(evt.message);
              }
            } catch {}
          }
        }
        setAiGenerating(false);
      }

      if (!texts?.length) throw new Error("No content was generated");

      const photoUrls = photos.map((f) => URL.createObjectURL(f));

      if (texts.length < photos.length) {
        toast.warning(`Only ${texts.length} text(s) generated for ${photos.length} photo(s) - extra photos will have no text overlay`);
      }

      const posts: SinglePost[] = photos.map((photo, i) => ({
        index: i + 1,
        text: texts[i] || "",
        imageUrl: photoUrls[i],
        imageName: photo.name,
      }));

      setResult({ posts, totalPosts: posts.length, sessionId: "local" });
      setCurrentStep(4);
      toast.success(`${posts.length} single image posts ready to download`);
    } catch (e: any) {
      toast.error("Error: " + (e?.message ?? "Unknown error"));
    } finally {
      setIsGenerating(false);
      setAiGenerating(false);
    }
  };

  const handleStartOver = () => {
    setPhotos([]); setCsvFile(null); setCsvPreview({ rows: [] }); setAllCsvRows([]);
    setCaptions([]); setResult(null); setAiGeneratedTexts(null); setAiProgress("");
    setSavedCaptionIndices(new Set()); setCurrentStep(1);
  };

  const downloadZip = async () => {
    if (!result?.posts.length) return;
    const id = toast.loading("Building ZIP...");
    try {
      await document.fonts.ready;
      const zip = new JSZip();
      for (const post of result.posts) {
        const res = await fetch(post.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, post.text, fontFamily, fontSize, false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, gradientColor, gradientEnabled, gradientStyle, gradientPosition, 1, 1, textPosition);
        URL.revokeObjectURL(img.src);
        const outBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (outBlob) {
          zip.file(`post-${String(post.index).padStart(2, "0")}.png`, outBlob);
        }
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
    const id = toast.loading("Rendering images...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string }[] = [];

      for (const post of result.posts) {
        const res = await fetch(post.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, post.text, fontFamily, fontSize, false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, gradientColor, gradientEnabled, gradientStyle, gradientPosition, 1, 1, textPosition);
        URL.revokeObjectURL(img.src);
        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `post-${String(post.index).padStart(2, "0")}.png`;
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
    const id = toast.loading("Rendering & pushing to Cloud Campaign...");
    try {
      await document.fonts.ready;
      const rendered: { name: string; base64: string }[] = [];

      for (const post of result.posts) {
        const res = await fetch(post.imageUrl);
        const blob = await res.blob();
        const img = new Image();
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = URL.createObjectURL(blob); });
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        drawSlide(ctx, img, post.text, fontFamily, fontSize, false, textColor, lineSpacing, overlayColor, logoImg, logoPosition, logoSize, pageColor, cornerStyle, cornerColor, gradientColor, gradientEnabled, gradientStyle, gradientPosition, 1, 1, textPosition);
        URL.revokeObjectURL(img.src);
        const dataUrl = canvas.toDataURL("image/png");
        rendered.push({ name: `post-${String(post.index).padStart(2, "0")}.png`, base64: dataUrl });
      }

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

  const generateCaptions = async () => {
    const texts = aiGeneratedTexts || (allCsvRows.length > 0 ? allCsvRows : null);
    if (!texts || texts.length === 0) return;
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
          industry: aiIndustry || "aesthetics",
          tone: aiTone,
          extraInstructions: aiExtraInstructions,
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

  return (
    <div className="min-h-[100dvh] w-full pb-32">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-sans text-3xl font-bold tracking-tight"><span className="text-white">Social Media Sister's</span>{" "}<span className="text-pink-400">CyberSuite</span></h1>
          <Badge variant="secondary" className="bg-accent text-xs">Single Image</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Carousel Mode
            </Button>
          </Link>
          <Link href="/before-after">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Before & After
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
            </>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 pb-32">
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
                    currentStep === step.num ? "text-primary" : currentStep > step.num ? "text-green-400" : "text-muted-foreground/40"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    currentStep === step.num ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : currentStep > step.num ? "bg-green-500/20 text-green-400 border-2 border-green-500/30" : "bg-accent/30 text-muted-foreground/40"
                  }`}>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <Label className="text-base font-semibold">Font</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue><span style={{ fontFamily }}>{selectedFontLabel}</span></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/30 bg-card/50 p-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Text Size</Label>
                    <span className="text-base font-semibold tabular-nums">{fontSize}px</span>
                  </div>
                  <Slider min={28} max={96} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} className="w-full" />
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
                          setContentMode("csv");
                          toast.success(`${selected.length} caption(s) loaded as post content`);
                        }}>
                          <Check className="w-4 h-4 mr-2" /> Use {selectedLibCaptionIds.size} Caption{selectedLibCaptionIds.size > 1 ? "s" : ""}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {contentMode === "csv" && (
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
              )}

              {contentMode === "ai" && (
                <>
                  <div className="space-y-6 rounded-2xl border border-border/30 bg-card/50 p-6">
                    <div className="flex items-center gap-3">
                      <Wand2 className="w-6 h-6 text-primary" />
                      <h3 className="text-xl font-semibold">Content Machine Brief</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Client Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input value={aiClientName} onChange={(e) => setAiClientName(e.target.value)} placeholder="e.g. Glow Aesthetics" className="h-12 text-base" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Industry</Label>
                        <Input value={aiIndustry} onChange={(e) => setAiIndustry(e.target.value)} placeholder="e.g. aesthetics, dental, wellness" className="h-12 text-base" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Tone of Voice</Label>
                        <Select value={aiTone} onValueChange={setAiTone}>
                          <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["warm & professional", "fun & casual", "luxury & exclusive", "educational & authoritative", "friendly & approachable"].map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Number of Posts</Label>
                        <div className="h-12 flex items-center px-4 rounded-md border border-border/30 bg-accent/20 text-base">
                          {photos.length > 0
                            ? <span>{photos.length} post{photos.length !== 1 ? "s" : ""} <span className="text-muted-foreground">(1 per photo)</span></span>
                            : <span className="text-muted-foreground">Upload photos first</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Topics</Label>
                      <Input value={aiTopics} onChange={(e) => setAiTopics(e.target.value)} placeholder="e.g. skin care tips, treatment benefits, client results" className="h-12 text-base" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Extra Instructions <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input value={aiExtraInstructions} onChange={(e) => setAiExtraInstructions(e.target.value)} placeholder="Any additional guidance for the AI" className="h-12 text-base" />
                    </div>

                    <Button
                      onClick={handleAiGenerate}
                      disabled={aiGenerating}
                      className="w-full py-6 text-lg font-bold"
                      size="lg"
                    >
                      {aiGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      {aiGenerating ? aiProgress || "Generating..." : "Generate Content"}
                    </Button>
                  </div>

                  {aiGeneratedTexts && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-lg">Generated Texts</h3>
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400">{aiGeneratedTexts.length} posts</Badge>
                      </div>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {aiGeneratedTexts.map((text, i) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-accent/20 p-4 flex gap-3">
                            <span className="text-primary font-mono text-sm font-bold mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <p className="text-base leading-relaxed text-muted-foreground">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setCurrentStep(2)} className="px-8 py-6 text-lg font-semibold" size="lg">
                      <ChevronLeft className="w-5 h-5 mr-2" /> Back
                    </Button>
                    <button
                      className="btn-shimmer px-10 py-6 rounded-2xl text-lg font-bold flex items-center gap-3"
                      onClick={handleGenerateFromAi}
                      disabled={isGenerating || aiGenerating}
                    >
                      {(isGenerating || aiGenerating) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      {(isGenerating || aiGenerating) ? "Generating..." : "Generate Posts"}
                    </button>
                  </div>
                </>
              )}
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
                              <p className="text-white text-xs font-medium line-clamp-3 bg-black/50 rounded-lg p-2">{post.text}</p>
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
                      <div className="flex gap-2">
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

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handleStartOver} className="px-8 py-6 text-lg font-semibold" size="lg">
                      <RefreshCcw className="w-5 h-5 mr-2" /> Start Over
                    </Button>
                    <div className="flex gap-3 flex-wrap justify-end">
                      <Button variant="outline" size="lg" onClick={downloadCsv} className="px-8 py-6 text-lg font-bold">
                        <FileText className="w-5 h-5 mr-2" />Download CSV
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
