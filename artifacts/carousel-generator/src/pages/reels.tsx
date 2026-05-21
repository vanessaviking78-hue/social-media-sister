import React, { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Layers, Plus, Trash2, Download, Play, Square, Upload, Loader2,
  ImagePlus, BookOpen, Palette, MessageSquareText, CalendarDays,
  BarChart3, ShieldCheck, Film, Image as ImageIcon,
  Music, Search, X, Send, FileText, Sparkles, ChevronDown, Check,
  ExternalLink, AlertCircle, CheckCircle2, KeyRound, ChevronUp, Settings,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  VIDEO_WIDTH, VIDEO_HEIGHT, FONT_OPTIONS, loadGoogleFonts,
  drawSlide, recordReelVideo, recordReelVideoMp4, drawTypewriterSlide, drawTypewriterOnVideo,
} from "@/lib/slide-utils";
import Papa from "papaparse";
import JSZip from "jszip";
import type { LogoPosition } from "@workspace/db/schema";
import { saveAs } from "file-saver";

loadGoogleFonts();

type ReelSlide = {
  id: string;
  mode: "cover" | "typewriter" | "image-typewriter";
  text: string;
  imageFile: File | null;
  imageElement: HTMLImageElement | null;
  videoFile: File | null;
  videoElement: HTMLVideoElement | null;
  imageOffsetY: number;
};

const PREVIEW_SCALE = 0.25;
const PREVIEW_W = Math.round(VIDEO_WIDTH * PREVIEW_SCALE);
const PREVIEW_H = Math.round(VIDEO_HEIGHT * PREVIEW_SCALE);

export default function Reels() {
  const [slides, setSlides] = useState<ReelSlide[]>([
    { id: crypto.randomUUID(), mode: "cover", text: "", imageFile: null, imageElement: null, videoFile: null, videoElement: null, imageOffsetY: 0 },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);

  const [fontFamily, setFontFamily] = useState("'Playfair Display', serif");
  const [fontSize, setFontSize] = useState(90);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlayOpacity, setOverlayOpacity] = useState(40);
  const [pageColor, setPageColor] = useState("#0d0d0d");
  const [lineSpacing, setLineSpacing] = useState(1.3);
  const [textPosition, setTextPosition] = useState<"top" | "center" | "bottom">("center");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
  const [logoSize, setLogoSize] = useState(80);

  const [coverSplit, setCoverSplit] = useState(false);
  const [coverEyebrowFont, setCoverEyebrowFont] = useState("Inter, sans-serif");
  const [coverEyebrowColor, setCoverEyebrowColor] = useState("#ff69b4");
  const [coverEyebrowSizeRatio, setCoverEyebrowSizeRatio] = useState(0.38);
  const [coverEyebrowItalic, setCoverEyebrowItalic] = useState(false);
  const [coverEyebrowUppercase, setCoverEyebrowUppercase] = useState(true);
  const [coverEyebrowWeight, setCoverEyebrowWeight] = useState(700);
  const [coverEyebrowLetterSpacing, setCoverEyebrowLetterSpacing] = useState(4);
  const [coverHeadlineItalic, setCoverHeadlineItalic] = useState(false);
  const [coverHeadlineWeight, setCoverHeadlineWeight] = useState(700);
  const [coverEyebrowArch, setCoverEyebrowArch] = useState(0.4);

  const [mainFontWeight, setMainFontWeight] = useState(400);
  const [letterSpacing, setLetterSpacing] = useState(0);

  const [slideDurationSec, setSlideDurationSec] = useState(3);
  const [fadeDurationMs, setFadeDurationMs] = useState(400);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const [musicQuery, setMusicQuery] = useState("");
  const [musicGenre, setMusicGenre] = useState("all");
  const [musicTracks, setMusicTracks] = useState<Array<{ id: number; title: string; duration: number; artist: string; previewUrl: string }>>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{ id: number; title: string; duration: number; artist: string; previewUrl: string } | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [ccWorkspaces, setCcWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [ccWorkspaceId, setCcWorkspaceId] = useState("");
  const [ccCaption, setCcCaption] = useState("");
  const [ccPushing, setCcPushing] = useState(false);
  const [ccPushProgress, setCcPushProgress] = useState("");
  const [ccLoading, setCcLoading] = useState(true);
  const [wsNamesOpen, setWsNamesOpen] = useState(false);
  const [wsLabelsDraft, setWsLabelsDraft] = useState<Record<string, string>>({});
  const [wsLabelsSaving, setWsLabelsSaving] = useState(false);

  const [igPresets, setIgPresets] = useState<Array<{ id: number; name: string; metaPageAccessToken?: string | null; metaFacebookPageId?: string | null; metaInstagramAccountId?: string | null }>>([]);
  const [igPresetId, setIgPresetId] = useState("");
  const [igCaption, setIgCaption] = useState("");
  const [igPushing, setIgPushing] = useState(false);
  const [igPushProgress, setIgPushProgress] = useState("");
  const [igLoading, setIgLoading] = useState(true);
  const [igSetupOpen, setIgSetupOpen] = useState(false);
  const [igSetupToken, setIgSetupToken] = useState("");
  const [igSetupPageId, setIgSetupPageId] = useState("");
  const [igSetupIgId, setIgSetupIgId] = useState("");
  const [igSetupSaving, setIgSetupSaving] = useState(false);
  const [igSetupTesting, setIgSetupTesting] = useState(false);
  const [igSetupTestResult, setIgSetupTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);

  const [typewriterBgColor, setTypewriterBgColor] = useState("#0d0d0d");
  const [typewriterFill, setTypewriterFill] = useState(0.7);

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [bulkMode, setBulkMode] = useState<"single" | "bulk">("single");
  const [bulkRows, setBulkRows] = useState<string[][]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: "" });
  const [bulkZipBlob, setBulkZipBlob] = useState<Blob | null>(null);
  const [bulkIgPresetId, setBulkIgPresetId] = useState("");
  const [bulkPushing, setBulkPushing] = useState(false);
  const [bulkPushProgress, setBulkPushProgress] = useState({ current: 0, total: 0, label: "" });
  const [bulkMedia, setBulkMedia] = useState<File[]>([]);
  const [bulkReelBlobs, setBulkReelBlobs] = useState<Blob[]>([]);
  const [bulkCcWorkspaceId, setBulkCcWorkspaceId] = useState("");
  const [bulkCcCaption, setBulkCcCaption] = useState("");
  const [bulkCcPushing, setBulkCcPushing] = useState(false);
  const [bulkCcPushProgress, setBulkCcPushProgress] = useState({ current: 0, total: 0, label: "" });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiIndustry, setAiIndustry] = useState("");
  const [aiTopics, setAiTopics] = useState("");
  const [aiTone, setAiTone] = useState("conversational");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSlideCount, setAiSlideCount] = useState(5);

  const [reelStep, setReelStep] = useState(1);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const overlayColor = `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})`;

  function drawCurrentSlide(idx: number, progress: number = 1) {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const slide = slides[idx] ?? slides[0];
    if (slide.mode === "typewriter") {
      drawTypewriterSlide(
        ctx, slide.text, progress,
        typewriterBgColor, textColor,
        fontFamily, fontSize, lineSpacing,
        logoImg, logoPosition, logoSize,
        typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT,
      );
    } else if (slide.mode === "image-typewriter") {
      const mediaBg = (slide.videoElement ?? slide.imageElement) as HTMLImageElement | null;
      drawSlide(
        ctx, mediaBg, "",
        fontFamily, fontSize, true,
        textColor, lineSpacing, overlayColor,
        logoImg, logoPosition, logoSize,
        pageColor, "none", "#ffffff",
        1, 1, textPosition, false, fontFamily, textAlign,
        false, "#ffffff", "", letterSpacing, false,
        false, "'Great Vibes', cursive",
        coverSplit, coverEyebrowFont, coverEyebrowColor,
        coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
        coverEyebrowWeight, coverEyebrowLetterSpacing,
        coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
        undefined, undefined,
        { imageOffsetY: slide.imageOffsetY, canvasW: VIDEO_WIDTH, canvasH: VIDEO_HEIGHT }
      );
      drawTypewriterOnVideo(ctx, slide.text, progress, textColor, fontFamily, fontSize, lineSpacing, textPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
    } else {
      const mediaBg = (slide.videoElement ?? slide.imageElement) as HTMLImageElement | null;
      drawSlide(
        ctx, mediaBg, slide.text,
        fontFamily, fontSize, true,
        textColor, lineSpacing, overlayColor,
        logoImg, logoPosition, logoSize,
        pageColor, "none", "#ffffff",
        1, 1, textPosition, true, fontFamily, textAlign,
        false, "#ffffff", "", letterSpacing, false,
        false, "'Great Vibes', cursive",
        coverSplit, coverEyebrowFont, coverEyebrowColor,
        coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
        coverEyebrowWeight, coverEyebrowLetterSpacing,
        coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
        undefined, undefined,
        { imageOffsetY: slide.imageOffsetY, canvasW: VIDEO_WIDTH, canvasH: VIDEO_HEIGHT }
      );
    }
  }

  const drawCurrentSlideRef = useRef(drawCurrentSlide);
  drawCurrentSlideRef.current = drawCurrentSlide;

  useEffect(() => {
    if (isPlaying) return;
    drawCurrentSlide(activeIdx, 1);
  }, [
    slides, activeIdx, isPlaying, reelStep,
    fontFamily, fontSize, textColor, overlayOpacity, pageColor,
    lineSpacing, textPosition, textAlign,
    logoImg, logoPosition, logoSize,
    mainFontWeight, letterSpacing,
    coverSplit, coverEyebrowFont, coverEyebrowColor, coverEyebrowSizeRatio,
    coverEyebrowItalic, coverEyebrowUppercase, coverEyebrowWeight,
    coverEyebrowLetterSpacing, coverHeadlineItalic, coverHeadlineWeight, coverEyebrowArch,
    typewriterBgColor, typewriterFill,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      slides.forEach((s) => {
        if (s.videoElement) { s.videoElement.pause(); s.videoElement.currentTime = 0; }
      });
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    slides.forEach((s) => s.videoElement?.play().catch(() => {}));
    const msPerSlide = slideDurationSec * 1000;
    const total = slides.length * msPerSlide;
    const startTime = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= total) {
        setIsPlaying(false);
        setPreviewIdx(0);
        return;
      }
      const idx = Math.min(slides.length - 1, Math.floor(elapsed / msPerSlide));
      const slideProgress = (elapsed - idx * msPerSlide) / msPerSlide;
      setPreviewIdx(idx);
      drawCurrentSlideRef.current(idx, slideProgress);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, slides.length, slideDurationSec]);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspaces`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspace-labels`).then((r) => r.json()),
    ]).then(([wsData, labelsData]) => {
      if (Array.isArray(wsData.workspaces)) setCcWorkspaces(wsData.workspaces);
      if (Array.isArray(labelsData)) {
        const draft: Record<string, string> = {};
        labelsData.forEach((l: { workspaceId: string; label: string }) => { draft[l.workspaceId] = l.label; });
        setWsLabelsDraft(draft);
      }
    }).catch(() => {}).finally(() => setCcLoading(false));
  }, []);

  const handleSaveWsLabels = async () => {
    setWsLabelsSaving(true);
    try {
      const entries = Object.entries(wsLabelsDraft).map(([workspaceId, label]) => ({ workspaceId, label }));
      const r = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspace-labels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });
      if (!r.ok) throw new Error("Save failed");
      const wsData = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspaces`).then((r2) => r2.json());
      if (Array.isArray(wsData.workspaces)) setCcWorkspaces(wsData.workspaces);
      setWsNamesOpen(false);
      toast.success("Workspace names saved!");
    } catch {
      toast.error("Failed to save workspace names");
    } finally {
      setWsLabelsSaving(false);
    }
  };

  const reloadIgPresets = () => {
    return fetch(`${import.meta.env.BASE_URL}api/presets`)
      .then((r) => r.json())
      .then((d) => {
        const list: any[] = Array.isArray(d) ? d : (d?.presets ?? []);
        setIgPresets(list.map((p) => ({
          id: p.id,
          name: p.name,
          metaPageAccessToken: p.metaPageAccessToken,
          metaFacebookPageId: p.metaFacebookPageId,
          metaInstagramAccountId: p.metaInstagramAccountId,
        })));
      });
  };

  useEffect(() => {
    reloadIgPresets().catch(() => {}).finally(() => setIgLoading(false));
  }, []);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const bulkCsvRef = useRef<HTMLInputElement>(null);
  const bulkMediaInputRef = useRef<HTMLInputElement>(null);
  const bulkMediaElementsRef = useRef<Array<HTMLImageElement | HTMLVideoElement | null>>([]);

  const toggleSlideMode = (idx: number, mode: "cover" | "typewriter" | "image-typewriter") => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, mode } : s)));
  };

  const handleCsvImport = (file: File) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (res) => {
        let rows = res.data as string[][];
        if (rows.length === 0) { toast.error("CSV is empty"); return; }
        const first = rows[0]?.[0]?.toLowerCase() ?? "";
        if (/^(slide|text|caption|hook|col|column|header)\d*$/i.test(first)) rows = rows.slice(1);
        rows = rows.filter((r) => r[0]?.trim());
        if (rows.length === 0) { toast.error("No slide text found in CSV"); return; }
        const MAX = 10;
        const capped = rows.slice(0, MAX);
        const newSlides = capped.map((r) => {
          const text = r[0]?.trim() ?? "";
          const rawMode = r[1]?.trim().toLowerCase();
          const mode: ReelSlide["mode"] =
            rawMode === "cover" ? "cover"
            : rawMode === "image-typewriter" ? "image-typewriter"
            : "typewriter";
          return { id: crypto.randomUUID(), mode, text, imageFile: null, imageElement: null, videoFile: null, videoElement: null, imageOffsetY: 0 } satisfies ReelSlide;
        });
        setSlides(newSlides);
        setActiveIdx(0);
        setIsPlaying(false);
        if (rows.length > MAX) {
          toast.success(`Loaded ${MAX} slides (${rows.length - MAX} rows skipped — 10-slide max)`);
        } else {
          toast.success(`Loaded ${newSlides.length} slide${newSlides.length !== 1 ? "s" : ""} from CSV`);
        }
      },
      error: (err: { message: string }) => toast.error("CSV parse error: " + err.message),
    });
  };

  const handleAIGenerate = async () => {
    if (!aiIndustry.trim()) { toast.error("Enter an industry first"); return; }
    if (!aiTopics.trim()) { toast.error("Enter at least one topic"); return; }
    setAiGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/content/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: aiIndustry,
          tone: aiTone,
          topics: aiTopics,
          postCount: 1,
          slidesPerPost: aiSlideCount,
          extraInstructions: "Each slide will appear as a frame in a short-form video reel. Keep each slide to 1–2 short punchy sentences. No hashtags.",
        }),
      });
      if (!resp.ok) {
        let errMsg = `Request failed (${resp.status})`;
        try { const j = await resp.json(); if (j?.error) errMsg = j.error; } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      if (!resp.body) throw new Error("No response body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      let receivedComplete = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(part.slice(6));
            if (msg.type === "error") {
              toast.error(msg.message || "AI generation failed");
              receivedComplete = true;
              done = true;
              break;
            }
            if (msg.type === "complete" && Array.isArray(msg.posts) && Array.isArray(msg.posts[0])) {
              const texts: string[] = msg.posts[0];
              setSlides(texts.map((text) => ({
                id: crypto.randomUUID(),
                mode: "typewriter" as const,
                text,
                imageFile: null,
                imageElement: null,
                videoFile: null,
                videoElement: null,
                imageOffsetY: 0,
              })));
              setActiveIdx(0);
              toast.success(`Generated ${texts.length} slides!`);
              receivedComplete = true;
            }
          } catch { /* skip unparseable */ }
        }
      }
      if (!receivedComplete) {
        toast.error("AI generation ended without a response — please try again");
      }
    } catch (e: any) {
      toast.error(e?.message || "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleBulkCsvImport = (file: File) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (res) => {
        let rows = res.data as string[][];
        if (rows.length === 0) { toast.error("CSV is empty"); return; }
        const first = rows[0]?.[0]?.toLowerCase() ?? "";
        if (/^(reel|slide|text|caption|hook|col|column|header)\d*$/i.test(first)) rows = rows.slice(1);
        rows = rows.map((r) => r.filter((c) => c.trim())).filter((r) => r.length > 0);
        if (rows.length === 0) { toast.error("No data found in CSV"); return; }
        const MAX = 30;
        const capped = rows.slice(0, MAX);
        setBulkRows(capped);
        setBulkZipBlob(null);
        setBulkReelBlobs([]);
        if (rows.length > MAX) {
          toast.success(`Loaded ${MAX} reels (${rows.length - MAX} rows skipped — 30-reel max)`);
        } else {
          toast.success(`Loaded ${capped.length} reel${capped.length !== 1 ? "s" : ""} from CSV`);
        }
      },
      error: (err: { message: string }) => toast.error("CSV parse error: " + err.message),
    });
  };

  const handleBulkMediaUpload = (files: FileList) => {
    const MAX = 20;
    const accepted = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, MAX);
    if (accepted.length === 0) { toast.error("No supported image or video files found"); return; }
    setBulkMedia(accepted);
    setBulkZipBlob(null);
    setBulkReelBlobs([]);
    bulkMediaElementsRef.current = new Array(accepted.length).fill(null);
    accepted.forEach((file, i) => {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("video/")) {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = "auto";
        vid.src = url;
        vid.onloadeddata = () => { bulkMediaElementsRef.current[i] = vid; };
      } else {
        const img = new Image();
        img.onload = () => { bulkMediaElementsRef.current[i] = img; URL.revokeObjectURL(url); };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      }
    });
    toast.success(`${accepted.length} media file${accepted.length !== 1 ? "s" : ""} loaded`);
  };

  const handleBulkGenerate = async () => {
    if (bulkRows.length === 0) { toast.error("Upload a CSV first"); return; }
    setBulkGenerating(true);
    setBulkZipBlob(null);
    setBulkReelBlobs([]);
    const hasMedia = bulkMedia.length > 0;
    const pairCount = hasMedia ? Math.min(bulkMedia.length, bulkRows.length) : bulkRows.length;
    const zip = new JSZip();
    const canvas = exportCanvasRef.current!;
    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const blobs: Blob[] = [];
    try {
      for (let i = 0; i < pairCount; i++) {
        const texts = bulkRows[i];
        const mediaEl = hasMedia ? bulkMediaElementsRef.current[i] : null;
        const isVideo = hasMedia && (bulkMedia[i]?.type.startsWith("video/") ?? false);
        setBulkProgress({ current: i + 1, total: pairCount, label: `Encoding reel ${i + 1} of ${pairCount}…` });
        if (mediaEl && isVideo) {
          const vid = mediaEl as HTMLVideoElement;
          vid.currentTime = 0;
          await vid.play().catch(() => {});
        }
        const animateFn = (slideIndex: number, slideProgress: number) => {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          if (mediaEl) {
            if (isVideo) {
              const vid = mediaEl as HTMLVideoElement;
              if (vid.readyState >= 2) {
                const scale = Math.max(VIDEO_WIDTH / vid.videoWidth, VIDEO_HEIGHT / vid.videoHeight);
                const dw = vid.videoWidth * scale;
                const dh = vid.videoHeight * scale;
                ctx.drawImage(vid, (VIDEO_WIDTH - dw) / 2, (VIDEO_HEIGHT - dh) / 2, dw, dh);
              }
            } else {
              const img = mediaEl as HTMLImageElement;
              const scale = Math.max(VIDEO_WIDTH / img.naturalWidth, VIDEO_HEIGHT / img.naturalHeight);
              const dw = img.naturalWidth * scale;
              const dh = img.naturalHeight * scale;
              ctx.drawImage(img, (VIDEO_WIDTH - dw) / 2, (VIDEO_HEIGHT - dh) / 2, dw, dh);
            }
            drawTypewriterOnVideo(ctx, texts[slideIndex] ?? "", slideProgress, textColor, fontFamily, fontSize, lineSpacing, textPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
          } else {
            drawTypewriterSlide(ctx, texts[slideIndex] ?? "", slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
          }
        };
        let blob: Blob;
        try {
          blob = await recordReelVideoMp4(canvas, slideDurationSec * 1000, fadeDurationMs, texts.length, animateFn, 30);
        } catch {
          blob = await recordReelVideo(canvas, slideDurationSec * 1000, fadeDurationMs, texts.length, animateFn, 30);
        }
        if (mediaEl && isVideo) { (mediaEl as HTMLVideoElement).pause(); }
        blobs.push(blob);
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        zip.file(`reel-${String(i + 1).padStart(2, "0")}.${ext}`, blob);
      }
      setBulkProgress({ current: pairCount, total: pairCount, label: "Packaging ZIP…" });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      setBulkZipBlob(zipBlob);
      setBulkReelBlobs(blobs);
      toast.success(`${pairCount} reels ready — click Download!`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk generation failed");
    } finally {
      setBulkGenerating(false);
      setBulkProgress({ current: 0, total: 0, label: "" });
    }
  };

  const handleBulkPushToIG = async (trial: boolean) => {
    if (!bulkIgPresetId) { toast.error("Select a client preset first"); return; }
    if (bulkRows.length === 0) { toast.error("Upload a CSV first"); return; }
    setBulkPushing(true);
    setBulkPushProgress({ current: 0, total: bulkRows.length, label: "Starting…" });
    const canvas = exportCanvasRef.current!;
    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    let successCount = 0;
    try {
      for (let i = 0; i < bulkRows.length; i++) {
        const texts = bulkRows[i];
        const reelNum = `${i + 1}/${bulkRows.length}`;
        setBulkPushProgress({ current: i + 1, total: bulkRows.length, label: `Reel ${reelNum}: Encoding…` });
        const animateFn = (slideIndex: number, slideProgress: number) => {
          drawTypewriterSlide(ctx, texts[slideIndex] ?? "", slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        };
        let blob: Blob;
        try {
          blob = await recordReelVideoMp4(canvas, slideDurationSec * 1000, fadeDurationMs, texts.length, animateFn, 30);
        } catch {
          blob = await recordReelVideo(canvas, slideDurationSec * 1000, fadeDurationMs, texts.length, animateFn, 30);
        }
        setBulkPushProgress({ current: i + 1, total: bulkRows.length, label: `Reel ${reelNum}: Uploading…` });
        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("video", blob, `reel-${String(i + 1).padStart(2, "0")}.${ext}`);
        const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
        if (!uploadRes.ok) throw new Error(`Reel ${i + 1}: video upload failed`);
        const { url } = await uploadRes.json();
        setBulkPushProgress({ current: i + 1, total: bulkRows.length, label: `Reel ${reelNum}: Posting…` });
        const pushRes = await fetch(`${import.meta.env.BASE_URL}api/meta/push-reel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrl: url, caption: "", presetId: Number(bulkIgPresetId), trial, graduationStrategy: "MANUAL" }),
        });
        const pushData = await pushRes.json();
        if (!pushRes.ok) throw new Error(`Reel ${i + 1}: ${pushData.error || "push failed"}`);
        successCount++;
      }
      toast.success(`${successCount} trial reel${successCount !== 1 ? "s" : ""} posted! Open Instagram to review.`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk push failed");
    } finally {
      setBulkPushing(false);
      setBulkPushProgress({ current: 0, total: 0, label: "" });
    }
  };

  const handleBulkCcPush = async () => {
    if (!bulkCcWorkspaceId) { toast.error("Select a Cloud Campaign workspace first"); return; }
    if (bulkReelBlobs.length === 0) { toast.error("Generate reels first"); return; }
    setBulkCcPushing(true);
    setBulkCcPushProgress({ current: 0, total: bulkReelBlobs.length, label: "Starting…" });
    let successCount = 0;
    try {
      for (let i = 0; i < bulkReelBlobs.length; i++) {
        const blob = bulkReelBlobs[i];
        const reelNum = `${i + 1}/${bulkReelBlobs.length}`;
        setBulkCcPushProgress({ current: i + 1, total: bulkReelBlobs.length, label: `Reel ${reelNum}: Uploading…` });
        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("video", blob, `reel-${String(i + 1).padStart(2, "0")}.${ext}`);
        const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
        if (!uploadRes.ok) throw new Error(`Reel ${i + 1}: video upload failed`);
        const { url } = await uploadRes.json();
        setBulkCcPushProgress({ current: i + 1, total: bulkReelBlobs.length, label: `Reel ${reelNum}: Pushing to CC…` });
        const pushRes = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posts: [{ title: `Reel ${i + 1} – ${new Date().toLocaleDateString()}`, caption: bulkCcCaption, videoUrl: url }],
            workspaceIds: [bulkCcWorkspaceId],
            postType: "reel",
          }),
        });
        const pushData = await pushRes.json().catch(() => ({}));
        if (!pushRes.ok) {
          throw new Error(`Reel ${i + 1}: ${(pushData as any)?.error || "CC push failed"}`);
        }
        if ((pushData as any)?.summary?.failed > 0 && (pushData as any)?.summary?.succeeded === 0) {
          const firstErr = (pushData as any).results?.find((r: any) => r.status === "error")?.error;
          throw new Error(`Reel ${i + 1}: ${firstErr || "CC push failed"}`);
        }
        successCount++;
      }
      toast.success(`${successCount} reel${successCount !== 1 ? "s" : ""} pushed to Cloud Campaign!`);
      setBulkCcCaption("");
    } catch (e: any) {
      toast.error(e?.message || "Bulk CC push failed");
    } finally {
      setBulkCcPushing(false);
      setBulkCcPushProgress({ current: 0, total: 0, label: "" });
    }
  };

  const addSlide = () => {
    if (slides.length >= 10) return;
    const newSlide = { id: crypto.randomUUID(), mode: "typewriter" as const, text: "", imageFile: null, imageElement: null, videoFile: null, videoElement: null, imageOffsetY: 0 };
    setSlides((prev) => [...prev, newSlide]);
    setActiveIdx(slides.length);
  };

  const removeSlide = (idx: number) => {
    if (slides.length === 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.min(prev, slides.length - 2));
  };

  const updateText = (idx: number, text: string) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, text } : s)));
  };

  const updateImageOffset = (idx: number, offsetY: number) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, imageOffsetY: offsetY } : s)));
  };

  const handleSlideMedia = (idx: number, file: File) => {
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.src = url;
      vid.onloadeddata = () => {
        vid.currentTime = 0;
        setSlides((prev) => prev.map((s, i) =>
          i === idx ? { ...s, videoFile: file, videoElement: vid, imageFile: null, imageElement: null } : s
        ));
      };
    } else {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setSlides((prev) => prev.map((s, i) =>
          i === idx ? { ...s, imageFile: file, imageElement: img, videoFile: null, videoElement: null } : s
        ));
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }
  };

  const handleLogoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setLogoFile(file); setLogoImg(img); };
    img.src = url;
  };

  const handleExport = async () => {
    const hasContent = slides.some((s) => s.text.trim() || s.imageElement || s.videoElement);
    if (!hasContent) { toast.error("Add some text or media first"); return; }
    setExporting(true);
    setExportProgress("Setting up…");
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      setExportProgress("Recording…");
      if (selectedTrack?.previewUrl) setExportProgress("Fetching audio…");
      const blob = await recordReelVideo(canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, (slideIndex, slideProgress) => {
        const slide = slides[slideIndex];
        const mediaBg = (slide.videoElement ?? slide.imageElement) as HTMLImageElement | null;
        if (slide.mode === "typewriter") {
          drawTypewriterSlide(ctx, slide.text, slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else if (slide.mode === "image-typewriter") {
          drawSlide(
            ctx, mediaBg, "",
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, false, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
          drawTypewriterOnVideo(ctx, slide.text, slideProgress, textColor, fontFamily, fontSize, lineSpacing, textPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else {
          drawSlide(
            ctx, mediaBg, slide.text,
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, true, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
        }
      }, 30, selectedTrack?.previewUrl);
      setExportProgress("Saving…");
      saveAs(blob, `reel-${Date.now()}.webm`);
      toast.success(selectedTrack ? `Exported with "${selectedTrack.title}"!` : "Reel exported!");
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const fetchMusic = async (genreOverride?: string) => {
    setMusicLoading(true);
    setMusicTracks([]);
    try {
      const genre = genreOverride ?? musicGenre;
      const params = new URLSearchParams();
      if (musicQuery.trim()) params.set("q", musicQuery.trim());
      if (genre && genre !== "all") params.set("genre", genre);
      const res = await fetch(`${import.meta.env.BASE_URL}api/music/search?${params}`);
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setMusicTracks(data.tracks || []);
      if ((data.tracks || []).length === 0) toast.info("No tracks found — try a different genre or keyword");
    } catch {
      toast.error("Music search failed");
    } finally {
      setMusicLoading(false);
    }
  };

  const handlePushToCC = async () => {
    if (!ccWorkspaceId) { toast.error("Select a Cloud Campaign workspace first"); return; }
    const hasContent = slides.some((s) => s.text.trim() || s.imageElement || s.videoElement);
    if (!hasContent) { toast.error("Add some content to your slides first"); return; }
    setCcPushing(true);
    setCcPushProgress("Setting up…");
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      const animateFn = (slideIndex: number, slideProgress: number = 1) => {
        const slide = slides[slideIndex];
        const mediaBg = (slide.videoElement ?? slide.imageElement) as HTMLImageElement | null;
        if (slide.mode === "typewriter") {
          drawTypewriterSlide(ctx, slide.text, slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else if (slide.mode === "image-typewriter") {
          drawSlide(
            ctx, mediaBg, "",
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, false, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
          drawTypewriterOnVideo(ctx, slide.text, slideProgress, textColor, fontFamily, fontSize, lineSpacing, textPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else {
          drawSlide(
            ctx, mediaBg, slide.text,
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, true, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
        }
      };
      let audioArrayBuffer: ArrayBuffer | undefined;
      if (selectedTrack?.previewUrl) {
        setCcPushProgress("Fetching audio…");
        try {
          const r = await fetch(selectedTrack.previewUrl);
          audioArrayBuffer = await r.arrayBuffer();
        } catch { /* skip audio on error */ }
      }
      setCcPushProgress("Encoding MP4…");
      let videoBlob: Blob;
      try {
        videoBlob = await recordReelVideoMp4(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          (pct) => setCcPushProgress(`Encoding ${Math.round(pct * 100)}%…`),
          audioArrayBuffer,
        );
      } catch {
        setCcPushProgress("Encoding WebM…");
        videoBlob = await recordReelVideo(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          selectedTrack?.previewUrl,
        );
      }
      setCcPushProgress("Uploading video…");
      const form = new FormData();
      const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
      form.append("video", videoBlob, `reel-${Date.now()}.${ext}`);
      const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      const { url } = await uploadRes.json();
      setCcPushProgress("Pushing to Cloud Campaign…");
      const pushRes = await fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: [{ title: `Reel – ${new Date().toLocaleDateString()}`, caption: ccCaption, videoUrl: url }],
          workspaceIds: [ccWorkspaceId],
          postType: "reel",
        }),
      });
      if (!pushRes.ok) throw new Error("Cloud Campaign push failed");
      const pushData = await pushRes.json();
      if (pushData?.summary?.failed > 0 && pushData?.summary?.succeeded === 0) {
        const firstErr = pushData.results?.find((r: any) => r.status === "error")?.error;
        throw new Error(firstErr || "Cloud Campaign push failed");
      }
      toast.success("Reel pushed to Cloud Campaign!");
      setCcCaption("");
    } catch (e: any) {
      toast.error(e?.message || "Push failed");
    } finally {
      setCcPushing(false);
      setCcPushProgress("");
    }
  };

  const handlePushToIG = async (trial: boolean) => {
    if (!igPresetId) { toast.error("Select a client preset first"); return; }
    const hasContent = slides.some((s) => s.text.trim() || s.imageElement || s.videoElement);
    if (!hasContent) { toast.error("Add some content to your slides first"); return; }
    setIgPushing(true);
    setIgPushProgress("Setting up…");
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      const animateFn = (slideIndex: number, slideProgress: number = 1) => {
        const slide = slides[slideIndex];
        const mediaBg = (slide.videoElement ?? slide.imageElement) as HTMLImageElement | null;
        if (slide.mode === "typewriter") {
          drawTypewriterSlide(ctx, slide.text, slideProgress, typewriterBgColor, textColor, fontFamily, fontSize, lineSpacing, logoImg, logoPosition, logoSize, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else if (slide.mode === "image-typewriter") {
          drawSlide(
            ctx, mediaBg, "",
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, false, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
          drawTypewriterOnVideo(ctx, slide.text, slideProgress, textColor, fontFamily, fontSize, lineSpacing, textPosition, typewriterFill, VIDEO_WIDTH, VIDEO_HEIGHT);
        } else {
          drawSlide(
            ctx, mediaBg, slide.text,
            fontFamily, fontSize, true,
            textColor, lineSpacing, overlayColor,
            logoImg, logoPosition, logoSize,
            pageColor, "none", "#ffffff",
            1, 1, textPosition, true, fontFamily, textAlign,
            false, "#ffffff", "", letterSpacing, false,
            false, "'Great Vibes', cursive",
            coverSplit, coverEyebrowFont, coverEyebrowColor,
            coverEyebrowSizeRatio, coverEyebrowItalic, coverEyebrowUppercase,
            coverEyebrowWeight, coverEyebrowLetterSpacing,
            coverHeadlineItalic, coverSplit ? coverHeadlineWeight : mainFontWeight, coverEyebrowArch,
          );
        }
      };
      let audioArrayBuffer: ArrayBuffer | undefined;
      if (selectedTrack?.previewUrl) {
        setIgPushProgress("Fetching audio…");
        try {
          const r = await fetch(selectedTrack.previewUrl);
          audioArrayBuffer = await r.arrayBuffer();
        } catch { /* skip audio on error */ }
      }
      let videoBlob: Blob;
      try {
        setIgPushProgress("Encoding MP4…");
        videoBlob = await recordReelVideoMp4(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          (pct) => setIgPushProgress(`Encoding ${Math.round(pct * 100)}%…`),
          audioArrayBuffer,
        );
      } catch {
        setIgPushProgress("Encoding WebM…");
        videoBlob = await recordReelVideo(
          canvas, slideDurationSec * 1000, fadeDurationMs, slides.length, animateFn, 30,
          selectedTrack?.previewUrl,
        );
      }
      setIgPushProgress("Uploading video…");
      const form = new FormData();
      const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
      form.append("video", videoBlob, `reel-${Date.now()}.${ext}`);
      const uploadRes = await fetch(`${import.meta.env.BASE_URL}api/content/upload-video`, { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      const { url } = await uploadRes.json();
      setIgPushProgress(trial ? "Posting Trial Reel… (may take up to 2 min)" : "Posting Reel…");
      const pushRes = await fetch(`${import.meta.env.BASE_URL}api/meta/push-reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url, caption: igCaption, presetId: Number(igPresetId), trial, graduationStrategy: "MANUAL" }),
      });
      const pushData = await pushRes.json();
      if (!pushRes.ok) throw new Error(pushData.error || "Push failed");
      toast.success(trial
        ? "Trial Reel posted! Open your Instagram app to review it before graduating."
        : "Reel posted to Instagram!");
      setIgCaption("");
    } catch (e: any) {
      toast.error(e?.message || "Push failed");
    } finally {
      setIgPushing(false);
      setIgPushProgress("");
    }
  };

  const handleSaveIgCreds = async () => {
    if (!igPresetId) return;
    if (!igSetupToken.trim() || !igSetupPageId.trim() || !igSetupIgId.trim()) {
      toast.error("Please fill in all three fields");
      return;
    }
    setIgSetupSaving(true);
    setIgSetupTestResult(null);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/presets/${igPresetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaPageAccessToken: igSetupToken.trim(),
          metaFacebookPageId: igSetupPageId.trim(),
          metaInstagramAccountId: igSetupIgId.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      await reloadIgPresets();
      const testR = await fetch(`${import.meta.env.BASE_URL}api/meta/test-connection?presetId=${igPresetId}`);
      const testData = await testR.json();
      if (testR.ok) {
        setIgSetupTestResult({ ok: true, name: testData.name });
        toast.success(`Connected! Posting as ${testData.name}`);
        setTimeout(() => setIgSetupOpen(false), 1500);
      } else {
        setIgSetupTestResult({ ok: false, error: testData.error });
        toast.error("Saved but connection test failed — check your credentials");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save credentials");
    } finally {
      setIgSetupSaving(false);
    }
  };

  const bulkPairCount = bulkMedia.length > 0
    ? Math.min(bulkMedia.length, bulkRows.length)
    : bulkRows.length;

  const displayIdx = isPlaying ? previewIdx : activeIdx;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h1 className="font-sans text-2xl font-bold tracking-tight">
            <span className="text-white">The</span>{" "}
            <span className="text-pink-400">CyberSuite™</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-wrap">
          <Link href="/"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImagePlus className="w-4 h-4 mr-2" />Carousel</Button></Link>
          <Link href="/single-image"><Button variant="ghost" size="sm" className="text-muted-foreground"><ImageIcon className="w-4 h-4 mr-2" />Single Image</Button></Link>
          <Link href="/stories"><Button variant="ghost" size="sm" className="text-muted-foreground"><BookOpen className="w-4 h-4 mr-2" />Stories</Button></Link>
          <Button variant="ghost" size="sm" className="text-pink-400 bg-pink-400/10 pointer-events-none"><Film className="w-4 h-4 mr-2" />Reels</Button>
          <Link href="/video-overlay"><Button variant="ghost" size="sm" className="text-muted-foreground"><Play className="w-4 h-4 mr-2" />Video Overlay</Button></Link>
          <Link href="/presets"><Button variant="ghost" size="sm" className="text-muted-foreground"><Palette className="w-4 h-4 mr-2" />Presets</Button></Link>
          <Link href="/captions"><Button variant="ghost" size="sm" className="text-muted-foreground"><MessageSquareText className="w-4 h-4 mr-2" />Captions</Button></Link>
          <Link href="/calendar"><Button variant="ghost" size="sm" className="text-muted-foreground"><CalendarDays className="w-4 h-4 mr-2" />Calendar</Button></Link>
          <Link href="/analytics"><Button variant="ghost" size="sm" className="text-muted-foreground"><BarChart3 className="w-4 h-4 mr-2" />Analytics</Button></Link>
          <Link href="/approval"><Button variant="ghost" size="sm" className="text-muted-foreground"><ShieldCheck className="w-4 h-4 mr-2" />Approvals</Button></Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-6 mt-8 pb-32">

        {/* Step progress bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            {[
              { num: 1, label: "Slides", icon: Layers },
              { num: 2, label: "Style", icon: Palette },
              { num: 3, label: "Music", icon: Music },
              { num: 4, label: "Export & Post", icon: Download },
            ].map((step, i) => (
              <React.Fragment key={step.num}>
                <button
                  onClick={() => setReelStep(step.num)}
                  className={`flex flex-col items-center gap-2 transition-all ${
                    reelStep === step.num ? "text-pink-400" : reelStep > step.num ? "text-green-400" : "text-white/25"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold transition-all ${
                    reelStep === step.num
                      ? "bg-pink-600 text-white shadow-lg shadow-pink-500/30"
                      : reelStep > step.num
                      ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                      : "bg-white/5 text-white/25"
                  }`}>
                    {reelStep > step.num ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                  </div>
                  <span className="text-sm font-semibold">{step.num}. {step.label}</span>
                </button>
                {i < 3 && (
                  <div className={`flex-1 h-1 rounded-full mx-3 mt-[-20px] ${reelStep > step.num ? "bg-green-500/30" : "bg-white/10"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-8">

          {/* ═══════ STEP 1: SLIDES ═══════ */}
          {reelStep === 1 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 1: Your Slides</h2>
                <p className="text-lg text-white/50">Build your reel slide by slide, or upload a batch CSV.</p>
              </div>

              {/* Single / Bulk toggle */}
              <div className="flex gap-1 bg-white/5 rounded-xl p-1.5">
                <button onClick={() => setBulkMode("single")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${bulkMode === "single" ? "bg-pink-600 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Single Reel
                </button>
                <button onClick={() => setBulkMode("bulk")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${bulkMode === "bulk" ? "bg-pink-600 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Bulk Reels (CSV)
                </button>
              </div>

              {/* ── Single mode ── */}
              {bulkMode === "single" && (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white/70">Slides ({slides.length} / 10)</h3>
                      <div className="flex items-center gap-2">
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => { if (e.target.files?.[0]) { handleCsvImport(e.target.files[0]); e.target.value = ""; } }}
                        />
                        <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}
                          className="border-white/20 text-white/60 hover:text-white h-8 px-3 text-xs">
                          <FileText className="w-3.5 h-3.5 mr-1.5" />Import CSV
                        </Button>
                        <Button size="sm" onClick={addSlide} disabled={slides.length >= 10}
                          className="bg-pink-600 hover:bg-pink-500 text-white h-8 px-3 text-xs">
                          <Plus className="w-3.5 h-3.5 mr-1.5" />Add Slide
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {slides.map((slide, idx) => (
                        <div
                          key={slide.id}
                          onClick={() => { setActiveIdx(idx); setIsPlaying(false); }}
                          className={`rounded-xl border p-4 cursor-pointer transition-all space-y-3 ${
                            activeIdx === idx ? "border-pink-500 bg-pink-500/10" : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white/60">Slide {idx + 1}</span>
                            <div className="flex items-center gap-1.5">
                              {([
                                { m: "cover" as const, label: "Img", title: "Image + static text" },
                                { m: "typewriter" as const, label: "Aa", title: "Text only (typewriter)" },
                                { m: "image-typewriter" as const, label: "Img+Aa", title: "Image + typewriter text" },
                              ]).map(({ m, label, title }) => (
                                <button
                                  key={m}
                                  onClick={(e) => { e.stopPropagation(); toggleSlideMode(idx, m); }}
                                  title={title}
                                  className={`text-[10px] px-2 py-1 rounded transition-colors ${slide.mode === m ? "bg-pink-600/80 text-white" : "text-white/30 border border-white/15 hover:border-white/30"}`}
                                >
                                  {label}
                                </button>
                              ))}
                              {slides.length > 1 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeSlide(idx); }}
                                  className="text-white/25 hover:text-red-400 transition-colors ml-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea
                            value={slide.text}
                            onChange={(e) => updateText(idx, e.target.value)}
                            placeholder={slide.mode === "cover" && coverSplit ? "Eyebrow|Headline" : "Slide text…"}
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none border border-white/10 rounded-lg p-2.5 focus:border-pink-500/50"
                          />
                          {(slide.mode === "cover" || slide.mode === "image-typewriter") && (
                            <div className="space-y-2">
                              <label className={`flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors ${
                                (slide.imageFile || slide.videoFile)
                                  ? "text-white/50 hover:text-white/70 border border-white/10"
                                  : "border border-dashed border-white/20 hover:border-pink-500/60 text-white/40 hover:text-white/70 justify-center"
                              }`}>
                                <Upload className="w-4 h-4 shrink-0" />
                                {slide.videoFile
                                  ? (slide.videoFile.name.length > 26 ? slide.videoFile.name.slice(0, 26) + "…" : slide.videoFile.name)
                                  : slide.imageFile
                                  ? (slide.imageFile.name.length > 26 ? slide.imageFile.name.slice(0, 26) + "…" : slide.imageFile.name)
                                  : slide.mode === "image-typewriter" ? "Upload photo or video (required)" : "Upload photo or video (optional)"}
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlideMedia(idx, f); }}
                                />
                              </label>
                              {slide.mode === "image-typewriter" && !slide.imageElement && !slide.videoElement && (
                                <p className="text-xs text-amber-400/70 italic text-center">Upload a photo or video, add text, then press ▶ Preview</p>
                              )}
                              {slide.imageElement && (
                                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-between text-xs text-white/25">
                                    <span>▲ Top</span>
                                    <span className="text-white/40">Image position</span>
                                    <span>Bottom ▼</span>
                                  </div>
                                  <Slider
                                    min={0} max={100} step={1}
                                    value={[Math.round((slide.imageOffsetY + 1) * 50)]}
                                    onValueChange={([v]) => updateImageOffset(idx, parseFloat(((v / 50) - 1).toFixed(3)))}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {slide.mode === "typewriter" && (
                            <p className="text-xs text-white/30 italic">Press ▶ Preview in Step 4 to see the typewriter animation</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Content Machine */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                    <button onClick={() => setAiOpen((p) => !p)} className="flex items-center gap-3 w-full text-left">
                      <Sparkles className="w-5 h-5 text-pink-400" />
                      <span className="text-base font-semibold text-white/80 flex-1">AI Content Machine</span>
                      <ChevronDown className={`w-5 h-5 text-white/30 transition-transform ${aiOpen ? "rotate-180" : ""}`} />
                    </button>
                    {aiOpen && (
                      <div className="space-y-3 pt-1">
                        <input
                          value={aiIndustry}
                          onChange={(e) => setAiIndustry(e.target.value)}
                          placeholder="Industry (e.g. Aesthetics clinic)"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/50"
                        />
                        <Select value={aiTone} onValueChange={setAiTone}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["conversational", "professional", "playful", "inspirational", "educational"].map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <textarea
                          value={aiTopics}
                          onChange={(e) => setAiTopics(e.target.value)}
                          placeholder="Topics or hooks to cover…"
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/50 resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/50 shrink-0">Slides: {aiSlideCount}</span>
                          <Slider min={2} max={10} step={1} value={[aiSlideCount]} onValueChange={([v]) => setAiSlideCount(v)} className="flex-1" />
                        </div>
                        <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-5 text-sm">
                          {aiGenerating
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                            : <><Sparkles className="w-4 h-4 mr-2" />Generate {aiSlideCount} Slides</>}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Bulk mode ── */}
              {bulkMode === "bulk" && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                  <p className="text-sm text-white/40 leading-relaxed">
                    Upload media files (images or videos) and a CSV where each row is one reel and each column is one slide's text. Pairs are matched in order. Style from Step 2 applies to all reels.
                  </p>

                  {/* Upload row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input ref={bulkCsvRef} type="file" accept=".csv,text/csv" className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) { handleBulkCsvImport(e.target.files[0]); e.target.value = ""; } }} />
                      <Button variant="outline" onClick={() => bulkCsvRef.current?.click()}
                        className={`w-full border-white/20 hover:text-white py-5 text-sm flex flex-col gap-1 h-auto ${bulkRows.length > 0 ? "border-green-500/40 text-green-400" : "text-white/60"}`}>
                        <FileText className="w-5 h-5" />
                        {bulkRows.length > 0 ? `CSV: ${bulkRows.length} rows` : "Upload CSV"}
                      </Button>
                    </div>
                    <div>
                      <input ref={bulkMediaInputRef} type="file" multiple
                        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,image/*,video/*"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.length) { handleBulkMediaUpload(e.target.files); e.target.value = ""; } }} />
                      <Button variant="outline" onClick={() => bulkMediaInputRef.current?.click()}
                        className={`w-full border-white/20 hover:text-white py-5 text-sm flex flex-col gap-1 h-auto ${bulkMedia.length > 0 ? "border-green-500/40 text-green-400" : "text-white/60"}`}>
                        <Upload className="w-5 h-5" />
                        {bulkMedia.length > 0 ? `Media: ${bulkMedia.length} file${bulkMedia.length !== 1 ? "s" : ""}` : "Upload Media (optional)"}
                      </Button>
                    </div>
                  </div>

                  {/* Matched pairs table */}
                  {bulkRows.length > 0 && (
                    <div className="space-y-2">
                      {bulkMedia.length > 0 && bulkMedia.length !== bulkRows.length && (
                        <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 text-xs">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{bulkMedia.length} media files, {bulkRows.length} CSV rows — will process {Math.min(bulkMedia.length, bulkRows.length)} pairs</span>
                        </div>
                      )}
                      <div className="bg-white/5 rounded-xl overflow-hidden">
                        <div className={`grid text-xs font-semibold text-white/40 px-3 py-2 border-b border-white/10 gap-2 ${bulkMedia.length > 0 ? "grid-cols-[1.5rem_1fr_1fr]" : "grid-cols-[1.5rem_1fr]"}`}>
                          <span>#</span>
                          {bulkMedia.length > 0 && <span>Media</span>}
                          <span>CSV text (slide 1)</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                          {Array.from({ length: Math.max(bulkRows.length, bulkMedia.length) }, (_, i) => {
                            const paired = i < bulkRows.length && (bulkMedia.length === 0 || i < bulkMedia.length);
                            return (
                              <div key={i} className={`grid gap-2 px-3 py-2 text-xs items-center ${bulkMedia.length > 0 ? "grid-cols-[1.5rem_1fr_1fr]" : "grid-cols-[1.5rem_1fr]"} ${!paired ? "opacity-30" : ""}`}>
                                <span className="text-white/30">{i + 1}</span>
                                {bulkMedia.length > 0 && (
                                  <span className="truncate text-white/60 flex items-center gap-1 min-w-0">
                                    {i < bulkMedia.length
                                      ? bulkMedia[i].type.startsWith("video/")
                                        ? <><Film className="w-3 h-3 shrink-0 text-purple-400" /><span className="truncate">{bulkMedia[i].name.length > 18 ? bulkMedia[i].name.slice(0, 18) + "…" : bulkMedia[i].name}</span></>
                                        : <><ImageIcon className="w-3 h-3 shrink-0 text-blue-400" /><span className="truncate">{bulkMedia[i].name.length > 18 ? bulkMedia[i].name.slice(0, 18) + "…" : bulkMedia[i].name}</span></>
                                      : <span className="text-white/20">—</span>}
                                  </span>
                                )}
                                <span className="truncate text-white/50">
                                  {i < bulkRows.length
                                    ? (bulkRows[i][0] ?? "").slice(0, 40) || <span className="text-white/20 italic">empty</span>
                                    : <span className="text-white/20">—</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-white/25 text-center">
                        {bulkPairCount} reel{bulkPairCount !== 1 ? "s" : ""} will be generated
                        {bulkMedia.length > 0 ? " with media backgrounds" : " (text-only)"}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleBulkGenerate}
                    disabled={bulkGenerating || bulkPushing || bulkRows.length === 0}
                    className="w-full bg-pink-600 hover:bg-pink-500 text-white py-5 text-sm"
                  >
                    {bulkGenerating
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{bulkProgress.label}</>
                      : <><Download className="w-4 h-4 mr-2" />Generate ZIP{bulkPairCount > 0 ? ` (${bulkPairCount} reels)` : ""}</>}
                  </Button>

                  {bulkGenerating && bulkProgress.total > 0 && (
                    <div className="space-y-1.5">
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full transition-all duration-500"
                          style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                      </div>
                      <p className="text-sm text-white/40 text-center">{bulkProgress.current} / {bulkProgress.total}</p>
                    </div>
                  )}

                  {bulkZipBlob && (
                    <Button onClick={() => saveAs(bulkZipBlob!, `bulk-reels-${Date.now()}.zip`)}
                      className="w-full bg-green-700 hover:bg-green-600 text-white py-5 text-sm">
                      <Download className="w-4 h-4 mr-2" />Download ZIP ({bulkReelBlobs.length} reels)
                    </Button>
                  )}

                  {/* Cloud Campaign bulk push */}
                  {bulkReelBlobs.length > 0 && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <p className="text-sm font-semibold text-white/60 flex items-center gap-2">
                        <Send className="w-4 h-4" />Push to Cloud Campaign
                      </p>
                      {ccLoading ? (
                        <p className="text-sm text-white/30">Loading workspaces…</p>
                      ) : ccWorkspaces.length === 0 ? (
                        <p className="text-sm text-white/30">No Cloud Campaign workspaces configured.</p>
                      ) : (
                        <>
                          <Select value={bulkCcWorkspaceId} onValueChange={setBulkCcWorkspaceId}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm">
                              <SelectValue placeholder="Select workspace…" />
                            </SelectTrigger>
                            <SelectContent>
                              {ccWorkspaces.map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <textarea
                            value={bulkCcCaption}
                            onChange={(e) => setBulkCcCaption(e.target.value)}
                            placeholder="Caption for all reels (optional)…"
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/50 resize-none"
                          />
                          <Button
                            onClick={handleBulkCcPush}
                            disabled={bulkCcPushing || !bulkCcWorkspaceId}
                            className="w-full bg-purple-700 hover:bg-purple-600 text-white py-5 text-sm"
                          >
                            {bulkCcPushing
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{bulkCcPushProgress.label}</>
                              : <><Send className="w-4 h-4 mr-2" />Push {bulkReelBlobs.length} Reel{bulkReelBlobs.length !== 1 ? "s" : ""} to CC</>}
                          </Button>
                          {bulkCcPushing && bulkCcPushProgress.total > 0 && (
                            <div className="space-y-1.5">
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${(bulkCcPushProgress.current / bulkCcPushProgress.total) * 100}%` }} />
                              </div>
                              <p className="text-sm text-white/40 text-center">{bulkCcPushProgress.current} / {bulkCcPushProgress.total}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Instagram bulk push */}
                  {igPresets.length > 0 && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <p className="text-sm font-semibold text-white/60 flex items-center gap-2"><Film className="w-4 h-4" />Push to Instagram</p>
                      <Select value={bulkIgPresetId} onValueChange={setBulkIgPresetId}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm"><SelectValue placeholder="Select client…" /></SelectTrigger>
                        <SelectContent>
                          {igPresets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button onClick={() => handleBulkPushToIG(true)} disabled={bulkPushing || bulkGenerating || bulkRows.length === 0 || !bulkIgPresetId}
                          className="flex-1 bg-pink-700 hover:bg-pink-600 text-white py-5 text-sm">
                          {bulkPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Trial"}
                        </Button>
                        <Button onClick={() => handleBulkPushToIG(false)} disabled={bulkPushing || bulkGenerating || bulkRows.length === 0 || !bulkIgPresetId}
                          className="flex-1 border border-pink-700/60 text-pink-300 bg-transparent hover:bg-pink-700/20 py-5 text-sm">
                          {bulkPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Live"}
                        </Button>
                      </div>
                      {bulkPushing && bulkPushProgress.total > 0 && (
                        <div className="space-y-1.5">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${(bulkPushProgress.current / bulkPushProgress.total) * 100}%` }} />
                          </div>
                          <p className="text-sm text-white/40 text-center">{bulkPushProgress.current} / {bulkPushProgress.total}</p>
                        </div>
                      )}
                      <p className="text-xs text-white/20 text-center">Posts as private drafts — graduate each in Instagram when ready</p>
                    </div>
                  )}
                  <p className="text-xs text-white/20 text-center">Max 20 media + 30 CSV rows · 10 slides each</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setReelStep(2)} className="px-8 py-6 text-lg font-semibold bg-pink-600 hover:bg-pink-500">
                  Next: Style <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══════ STEP 2: STYLE ═══════ */}
          {reelStep === 2 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 2: Style</h2>
                <p className="text-lg text-white/50">Customise the look of your reel slides.</p>
              </div>

              {/* Live preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative" style={{ width: PREVIEW_W, height: PREVIEW_H }}>
                  <canvas
                    ref={previewCanvasRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    style={{ width: PREVIEW_W, height: PREVIEW_H, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "block" }}
                  />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {slides.map((_, i) => (
                      <button key={i} onClick={() => setActiveIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${activeIdx === i ? "bg-pink-400" : "bg-white/25 hover:bg-white/50"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/30">Click a dot to preview a different slide</p>
              </div>

              {/* Font & Text */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <h3 className="text-base font-semibold text-white/70">Font & Text</h3>
                <div className="space-y-2">
                  <Label className="text-sm text-white/50">Font family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white/80 h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Font size</Label>
                    <span className="text-sm font-semibold text-white">{fontSize}px</span>
                  </div>
                  <Slider min={30} max={180} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-white/50 flex-1">Text colour</Label>
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Line spacing</Label>
                    <span className="text-sm font-semibold text-white">{lineSpacing.toFixed(1)}</span>
                  </div>
                  <Slider min={0.8} max={2.2} step={0.1} value={[lineSpacing]} onValueChange={([v]) => setLineSpacing(v)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Font weight</Label>
                    <span className="text-sm font-semibold text-white">{mainFontWeight}</span>
                  </div>
                  <Slider min={100} max={900} step={100} value={[mainFontWeight]} onValueChange={([v]) => setMainFontWeight(v)} />
                  <div className="flex justify-between text-xs text-white/25 px-0.5">
                    <span>Thin</span><span>Regular</span><span>Bold</span><span>Black</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Letter spacing</Label>
                    <span className="text-sm font-semibold text-white">{letterSpacing}px</span>
                  </div>
                  <Slider min={0} max={24} step={1} value={[letterSpacing]} onValueChange={([v]) => setLetterSpacing(v)} />
                </div>
              </div>

              {/* Layout */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <h3 className="text-base font-semibold text-white/70">Layout</h3>
                <div className="space-y-2">
                  <Label className="text-sm text-white/50">Text position</Label>
                  <div className="flex gap-2">
                    {(["top", "center", "bottom"] as const).map((p) => (
                      <button key={p} onClick={() => setTextPosition(p)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${textPosition === p ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-white/50">Text alignment</Label>
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} onClick={() => setTextAlign(a)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${textAlign === a ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Background & Overlay */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <h3 className="text-base font-semibold text-white/70">Background & Overlay</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Overlay darkness</Label>
                    <span className="text-sm font-semibold text-white">{overlayOpacity}%</span>
                  </div>
                  <Slider min={0} max={90} step={5} value={[overlayOpacity]} onValueChange={([v]) => setOverlayOpacity(v)} />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-white/50 flex-1">Background colour (no-photo slides)</Label>
                  <input type="color" value={pageColor} onChange={(e) => setPageColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer" />
                </div>
              </div>

              {/* Split text mode */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white/70">Split Text Mode</h3>
                  <button onClick={() => setCoverSplit((p) => !p)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${coverSplit ? "bg-pink-600" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${coverSplit ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {coverSplit ? (
                  <div className="space-y-4">
                    <p className="text-sm text-white/40">Type "Eyebrow|Headline" in your slide text</p>
                    <div className="space-y-2">
                      <Label className="text-sm text-white/50">Eyebrow font</Label>
                      <Select value={coverEyebrowFont} onValueChange={setCoverEyebrowFont}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white/80 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm text-white/50 flex-1">Eyebrow colour</Label>
                      <input type="color" value={coverEyebrowColor} onChange={(e) => setCoverEyebrowColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm text-white/50">Eyebrow size</Label>
                        <span className="text-sm font-semibold text-white">{coverEyebrowSizeRatio.toFixed(2)}×</span>
                      </div>
                      <Slider min={0.2} max={0.7} step={0.01} value={[coverEyebrowSizeRatio]} onValueChange={([v]) => setCoverEyebrowSizeRatio(v)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm text-white/50">Letter spacing</Label>
                        <span className="text-sm font-semibold text-white">{coverEyebrowLetterSpacing}px</span>
                      </div>
                      <Slider min={0} max={20} step={1} value={[coverEyebrowLetterSpacing]} onValueChange={([v]) => setCoverEyebrowLetterSpacing(v)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm text-white/50">Arch</Label>
                        <span className="text-sm font-semibold text-white">{Math.round(coverEyebrowArch * 100)}%</span>
                      </div>
                      <Slider min={0} max={1} step={0.05} value={[coverEyebrowArch]} onValueChange={([v]) => setCoverEyebrowArch(v)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setCoverEyebrowItalic((p) => !p)}
                        className={`flex-1 py-2.5 rounded-lg text-sm italic transition-colors ${coverEyebrowItalic ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                        Italic
                      </button>
                      <button onClick={() => setCoverEyebrowUppercase((p) => !p)}
                        className={`flex-1 py-2.5 rounded-lg text-sm transition-colors ${coverEyebrowUppercase ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                        ALL CAPS
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-white/50">Headline weight</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[300, 400, 600, 700, 900].map((w) => (
                          <button key={w} onClick={() => setCoverHeadlineWeight(w)}
                            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${coverHeadlineWeight === w ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setCoverHeadlineItalic((p) => !p)}
                      className={`w-full py-2.5 rounded-lg text-sm italic transition-colors ${coverHeadlineItalic ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                      Headline Italic
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-white/30">Enable to split slide text into an eyebrow label + headline</p>
                )}
              </div>

              {/* Logo */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h3 className="text-base font-semibold text-white/70">Logo</h3>
                <label className="flex items-center gap-3 cursor-pointer text-sm text-white/50 hover:text-white/70 border border-white/10 hover:border-white/20 rounded-xl p-3 transition-colors">
                  <Upload className="w-4 h-4 shrink-0" />
                  {logoFile ? (logoFile.name.length > 30 ? logoFile.name.slice(0, 30) + "…" : logoFile.name) : "Upload logo (optional)"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                </label>
                {logoImg && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm text-white/50">Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((p) => (
                          <button key={p} onClick={() => setLogoPosition(p)}
                            className={`py-2.5 rounded-lg text-sm capitalize transition-colors ${logoPosition === p ? "bg-pink-600 text-white" : "border border-white/15 text-white/40 hover:border-white/30"}`}>
                            {p.replace("-", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm text-white/50">Size</Label>
                        <span className="text-sm font-semibold text-white">{logoSize}px</span>
                      </div>
                      <Slider min={40} max={200} step={10} value={[logoSize]} onValueChange={([v]) => setLogoSize(v)} />
                    </div>
                  </>
                )}
              </div>

              {/* Text-only slides */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h3 className="text-base font-semibold text-white/70">Text-Only Slides (Aa)</h3>
                <p className="text-sm text-white/30">Settings for typewriter-style slides with no photo</p>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-white/50 flex-1">Background colour</Label>
                  <input type="color" value={typewriterBgColor} onChange={(e) => setTypewriterBgColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Reveal speed</Label>
                    <span className="text-sm font-semibold text-white">{Math.round(typewriterFill * 100)}% of slide</span>
                  </div>
                  <Slider min={25} max={95} step={5} value={[Math.round(typewriterFill * 100)]} onValueChange={([v]) => setTypewriterFill(v / 100)} />
                  <p className="text-xs text-white/25">Lower = text appears faster</p>
                </div>
              </div>

              {/* Timing */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h3 className="text-base font-semibold text-white/70">Timing</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Slide duration</Label>
                    <span className="text-sm font-semibold text-white">{slideDurationSec}s</span>
                  </div>
                  <Slider min={2} max={8} step={1} value={[slideDurationSec]} onValueChange={([v]) => setSlideDurationSec(v)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-white/50">Fade duration</Label>
                    <span className="text-sm font-semibold text-white">{fadeDurationMs}ms</span>
                  </div>
                  <Slider min={100} max={800} step={50} value={[fadeDurationMs]} onValueChange={([v]) => setFadeDurationMs(v)} />
                </div>
                <p className="text-sm text-white/30 text-center">Total reel length: {(slides.length * slideDurationSec).toFixed(0)}s</p>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setReelStep(1)}
                  className="px-8 py-6 text-lg font-semibold border-white/20 text-white/60 hover:text-white bg-transparent">
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <Button onClick={() => setReelStep(3)} className="px-8 py-6 text-lg font-semibold bg-pink-600 hover:bg-pink-500">
                  Next: Music <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══════ STEP 3: MUSIC ═══════ */}
          {reelStep === 3 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 3: Music</h2>
                <p className="text-lg text-white/50">Add a backing track to your reel (optional).</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                {selectedTrack && (
                  <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-300 truncate">{selectedTrack.title}</p>
                      <p className="text-sm text-white/40 truncate">{selectedTrack.artist}</p>
                    </div>
                    <button onClick={() => setSelectedTrack(null)} className="text-white/30 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={musicQuery}
                    onChange={(e) => setMusicQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchMusic()}
                    placeholder="Search tracks… (press Enter)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/50"
                  />
                  <Button onClick={() => fetchMusic()} disabled={musicLoading}
                    className="bg-pink-600 hover:bg-pink-500 text-white px-4">
                    {musicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                <Select value={musicGenre} onValueChange={(v) => { setMusicGenre(v); fetchMusic(v); }}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm"><SelectValue placeholder="All genres" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genres</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="jazz">Jazz</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                    <SelectItem value="r-b-soul">R&amp;B / Soul</SelectItem>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                  </SelectContent>
                </Select>
                {musicTracks.length > 0 && (
                  <div className="space-y-1 border border-white/10 rounded-xl p-2 bg-black/20 max-h-80 overflow-y-auto">
                    {musicTracks.map((track) => {
                      const isSelected = selectedTrack?.id === track.id;
                      const isPreviewing = previewingTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (isSelected) { setSelectedTrack(null); }
                            else {
                              setSelectedTrack(track);
                              if (audioPreviewRef.current) { audioPreviewRef.current.pause(); setPreviewingTrackId(null); }
                            }
                          }}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-green-500/20 ring-1 ring-green-500/50" : "hover:bg-white/5"}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPreviewing) { audioPreviewRef.current?.pause(); setPreviewingTrackId(null); }
                              else {
                                if (audioPreviewRef.current) audioPreviewRef.current.pause();
                                audioPreviewRef.current = new Audio(track.previewUrl);
                                audioPreviewRef.current.play();
                                setPreviewingTrackId(track.id);
                                audioPreviewRef.current.onended = () => setPreviewingTrackId(null);
                              }
                            }}
                            className={`shrink-0 p-1.5 rounded-lg transition-colors ${isPreviewing ? "text-pink-400 bg-pink-500/10" : "text-white/40 hover:text-pink-400"}`}
                          >
                            {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${isSelected ? "text-green-300 font-semibold" : "text-white"}`}>{track.title}</p>
                            <p className="text-xs text-white/40 truncate">{track.artist} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</p>
                          </div>
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-green-500 text-white" : "bg-white/10 text-white/50"}`}>
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setReelStep(2)}
                  className="px-8 py-6 text-lg font-semibold border-white/20 text-white/60 hover:text-white bg-transparent">
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <Button onClick={() => setReelStep(4)} className="px-8 py-6 text-lg font-semibold bg-pink-600 hover:bg-pink-500">
                  Next: Export &amp; Post <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══════ STEP 4: EXPORT & POST ═══════ */}
          {reelStep === 4 && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="font-serif text-4xl font-semibold mb-3 tracking-tight">Step 4: Export &amp; Post</h2>
                <p className="text-lg text-white/50">Preview your reel, export, and publish.</p>
              </div>

              {/* Preview + export */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
                <h3 className="text-base font-semibold text-white/70">Preview</h3>
                <div className="flex justify-center">
                  <div className="relative" style={{ width: PREVIEW_W, height: PREVIEW_H }}>
                    <canvas
                      ref={previewCanvasRef}
                      width={VIDEO_WIDTH}
                      height={VIDEO_HEIGHT}
                      style={{ width: PREVIEW_W, height: PREVIEW_H, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "block" }}
                    />
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                      {slides.map((_, i) => (
                        <button key={i} onClick={() => { setActiveIdx(i); setIsPlaying(false); }}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${displayIdx === i ? "bg-pink-400" : "bg-white/25 hover:bg-white/50"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-white/30 text-center">
                  9:16 · 1080×1920 · {(slides.length * slideDurationSec).toFixed(0)}s
                  {selectedTrack ? ` · 🎵 ${selectedTrack.title}` : ""}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => { setIsPlaying((p) => !p); setPreviewIdx(0); }}
                    className="border-white/20 text-white/70 hover:text-white px-6 py-5 text-base">
                    {isPlaying ? <><Square className="w-4 h-4 mr-2" />Stop</> : <><Play className="w-4 h-4 mr-2" />Preview</>}
                  </Button>
                  <Button onClick={handleExport} disabled={exporting}
                    className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-5 text-base">
                    {exporting
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{exportProgress}</>
                      : <><Download className="w-4 h-4 mr-2" />Export Reel</>}
                  </Button>
                </div>
              </div>

              {/* Cloud Campaign */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white/70 flex items-center gap-2">
                    <Send className="w-4 h-4" />Push to Cloud Campaign
                  </h3>
                  <button onClick={() => setWsNamesOpen((o) => !o)} title="Name workspaces"
                    className="text-white/30 hover:text-white/60 transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                {wsNamesOpen && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">Name your workspaces</p>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {ccWorkspaces.map((ws) => (
                        <div key={ws.id} className="flex items-center gap-2">
                          <span className="text-xs text-white/20 font-mono shrink-0 w-20 truncate" title={ws.id}>{ws.id.slice(0, 8)}…</span>
                          <input
                            type="text"
                            value={wsLabelsDraft[ws.id] ?? ""}
                            onChange={(e) => setWsLabelsDraft((d) => ({ ...d, [ws.id]: e.target.value }))}
                            placeholder="Enter name…"
                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-400/50"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setWsNamesOpen(false)}
                        className="flex-1 border-white/20 text-white/50 bg-transparent hover:bg-white/5">Cancel</Button>
                      <Button size="sm" onClick={handleSaveWsLabels} disabled={wsLabelsSaving}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
                        {wsLabelsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Names"}
                      </Button>
                    </div>
                  </div>
                )}
                {ccLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/30 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading workspaces…
                  </div>
                ) : ccWorkspaces.length === 0 ? (
                  <p className="text-sm text-white/30 italic">No Cloud Campaign workspaces configured.</p>
                ) : (
                  <>
                    <Select value={ccWorkspaceId} onValueChange={setCcWorkspaceId}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm"><SelectValue placeholder="Select workspace…" /></SelectTrigger>
                      <SelectContent>{ccWorkspaces.map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <textarea
                      value={ccCaption}
                      onChange={(e) => setCcCaption(e.target.value)}
                      placeholder="Caption (optional)…"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 resize-none"
                    />
                    <Button onClick={handlePushToCC} disabled={ccPushing || !ccWorkspaceId}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 text-sm">
                      {ccPushing
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{ccPushProgress}</>
                        : <><Send className="w-4 h-4 mr-2" />Push Reel as MP4</>}
                    </Button>
                    <p className="text-sm text-white/20 text-center">Encodes MP4 → uploads → posts as video</p>
                  </>
                )}
              </div>

              {/* Instagram */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
                <h3 className="text-base font-semibold text-white/70 flex items-center gap-2">
                  <Film className="w-4 h-4" />Post to Instagram
                </h3>
                {igLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/30 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading clients…
                  </div>
                ) : igPresets.length === 0 ? (
                  <p className="text-sm text-white/30 italic">No client presets found. Add one in the Presets page.</p>
                ) : (
                  <>
                    <Select value={igPresetId} onValueChange={setIgPresetId}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white/60 h-10 text-sm"><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>{igPresets.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <textarea
                      value={igCaption}
                      onChange={(e) => setIgCaption(e.target.value)}
                      placeholder="Caption (optional)…"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/50 resize-none"
                    />
                    <div className="flex gap-3">
                      <Button onClick={() => handlePushToIG(false)} disabled={igPushing || !igPresetId}
                        className="flex-1 bg-pink-700 hover:bg-pink-600 text-white py-5 text-sm">
                        {igPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Film className="w-4 h-4 mr-2" />Post Reel</>}
                      </Button>
                      <Button onClick={() => handlePushToIG(true)} disabled={igPushing || !igPresetId}
                        className="flex-1 border border-pink-700/60 text-pink-300 bg-transparent hover:bg-pink-700/20 py-5 text-sm">
                        {igPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Trial Reel"}
                      </Button>
                    </div>
                    {igPushing && <p className="text-sm text-white/40 text-center">{igPushProgress}</p>}
                    <p className="text-xs text-white/20 text-center">Trial = private test · graduate in Instagram when ready</p>
                  </>
                )}
              </div>

              <div className="flex justify-start pt-4">
                <Button variant="outline" onClick={() => setReelStep(3)}
                  className="px-8 py-6 text-lg font-semibold border-white/20 text-white/60 hover:text-white bg-transparent">
                  <ChevronLeft className="w-5 h-5 mr-2" /> Back
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>

      <canvas ref={exportCanvasRef} className="hidden" />

    </div>
  );
}
