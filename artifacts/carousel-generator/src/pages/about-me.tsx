import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  Canvas as FabricCanvas,
  Textbox,
  Image as FabricImage,
  Group,
  Rect,
  loadSVGFromString,
  type FabricObject,
} from "fabric";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload, Download, Loader2, ChevronLeft, X, CalendarClock, Plus, Trash2, Type,
} from "lucide-react";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H_POST = 1440;
const CANVAS_H_STORY = 1920;
const DISPLAY_W = 330;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const FONTS = [
  { label: "DM Serif Display", value: "DM Serif Display" },
  { label: "Bebas Neue", value: "Bebas Neue" },
  { label: "Prata", value: "Prata" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type TextBlock = {
  id: string;
  text: string;
  fontFamily: string;
  fontColor: string;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
  fontSize: number;
  left?: number;
  top?: number;
  width?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
};

type DoodleState = {
  id: string;
  shapeId: string;
  color: string;
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
};

type LogoGeo = { left: number; top: number; scaleX: number; scaleY: number } | null;

type CanvasDraftState = {
  bgType?: "photo" | "colour";
  bgColour?: string;
  overlayOpacity?: number;
  photoUrl?: string;
  cutoutUrl?: string;
  logoUrl?: string | null;
  logoGeo?: LogoGeo;
  format?: "post" | "story";
  textBlocks?: TextBlock[];
  doodles?: DoodleState[];
  useOriginal?: boolean;
};

type DoodleShape = { id: string; label: string; svg: string };
type StickerLibraryItem = { id: number; name: string; url: string };
type StickerInstance = { id: string; libraryId: number; left?: number; top?: number; scaleX?: number; scaleY?: number; angle?: number };

// ── Doodle shapes ─────────────────────────────────────────────────────────────
const DOODLES: DoodleShape[] = [
  { id: "arrow", label: "Arrow",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M12,65 C14,35 48,15 82,38" fill="none" stroke="#9ca3af" stroke-width="3.5" stroke-linecap="round"/><path d="M68,24 L83,38 L70,52" fill="none" stroke="#9ca3af" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadFonts() {
  const id = "gf-about-me";
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Bebas+Neue&family=Prata&display=swap";
  document.head.appendChild(l);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity / 100})`;
}

async function ensureDurableUrl(url: string, base: string): Promise<string> {
  if (!url || !url.startsWith("blob:")) return url;
  try {
    const blob = await fetch(url).then(r => r.blob());
    const reader = new FileReader();
    const base64 = await new Promise<string>((res, rej) => {
      reader.onload = () => res((reader.result as string).split(",")[1] ?? "");
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const resp = await fetch(`${base}/api/content/upload-image`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name: `photo.${ext}`, base64 }] }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: resp.status === 413 ? "Images too large — try smaller files" : `Upload failed (${resp.status})` }));
      throw new Error(data.error ?? "Upload failed");
    }
    const data = await resp.json();
    return data.results?.[0]?.url ?? url;
  } catch { return url; }
}

const DEFAULT_BLOCK: TextBlock = {
  id: "default", text: "About Me", fontFamily: "DM Serif Display",
  fontColor: "#ffffff", bgEnabled: false, bgColor: "#000000", bgOpacity: 50, fontSize: 38,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AboutMePage() {
  // Photo
  const [photoUrl, setPhotoUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [bgRemoving, setBgRemoving] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  // Background
  const [bgType, setBgType] = useState<"photo" | "colour">("photo");
  const [bgColour, setBgColour] = useState("#12121a");
  const [overlayOpacity, setOverlayOpacity] = useState(40);

  // Format
  const [format, setFormat] = useState<"post" | "story">("post");

  // Text blocks
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([{ ...DEFAULT_BLOCK }]);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Doodles
  const [doodles, setDoodles] = useState<DoodleState[]>([]);

  // Stickers
  const [stickerLibrary, setStickerLibrary] = useState<StickerLibraryItem[]>([]);
  const [stickerInstances, setStickerInstances] = useState<StickerInstance[]>([]);
  const [stickerUploading, setStickerUploading] = useState(false);

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"text" | "logo" | "doodle" | "sticker" | null>(null);

  // Client + export
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [scheduleRendering, setScheduleRendering] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);

  // Refs
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const blockMapRef = useRef<Map<string, Textbox>>(new Map());
  const doodleMapRef = useRef<Map<string, Group>>(new Map());
  const stickerMapRef = useRef<Map<string, FabricImage>>(new Map());
  const logoObjRef = useRef<FabricImage | null>(null);
  const bgLayersRef = useRef<FabricObject[]>([]);
  const subjectObjRef = useRef<FabricImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef(false);
  const pendingLogoGeoRef = useRef<LogoGeo>(null);
  const pendingRestoreRef = useRef<CanvasDraftState | null>(null);
  const lastPresetIdRef = useRef<number | null>(null);

  const { presets, fetchPresets } = usePresets();
  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? null;

  const CH = format === "story" ? CANVAS_H_STORY : CANVAS_H_POST;
  const DISPLAY_H = Math.round(DISPLAY_W * CH / CANVAS_W);
  const EXPORT_MULT = CANVAS_W / DISPLAY_W;

  const subjectUrl = useOriginal || !cutoutUrl ? photoUrl : cutoutUrl;

  // ── Canvas init (re-runs on format change) ────────────────────────────────
  useEffect(() => {
    loadFonts();
    if (!canvasElRef.current) return;

    const canvas = new FabricCanvas(canvasElRef.current, {
      width: DISPLAY_W,
      height: DISPLAY_H,
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e) => {
      const obj = (e as any).selected?.[0];
      if (!obj) return;
      setSelectedId((obj as any).__amId ?? null);
      setSelectedType((obj as any).__amType ?? null);
    });
    canvas.on("selection:updated", (e) => {
      const obj = (e as any).selected?.[0];
      if (!obj) return;
      setSelectedId((obj as any).__amId ?? null);
      setSelectedType((obj as any).__amType ?? null);
    });
    canvas.on("selection:cleared", () => { setSelectedId(null); setSelectedType(null); });

    canvas.on("text:changed", (e) => {
      const tb = (e as any).target as Textbox;
      const id = (tb as any).__amId;
      if (id) setTextBlocks(prev => prev.map(b => b.id === id ? { ...b, text: tb.text ?? "" } : b));
    });

    canvas.on("object:modified", (e) => {
      isDirtyRef.current = true;
      const obj = (e as any).target;
      if (!obj) return;
      const id = (obj as any).__amId;
      const type = (obj as any).__amType;
      if (type === "text") {
        setTextBlocks(prev => prev.map(b => b.id === id
          ? { ...b, left: obj.left, top: obj.top, width: obj.width, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle }
          : b));
      }
      if (type === "doodle") {
        setDoodles(prev => prev.map(d => d.id === id
          ? { ...d, left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle }
          : d));
      }
      if (type === "sticker") {
        setStickerInstances(prev => prev.map(s => s.id === id
          ? { ...s, left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle }
          : s));
      }
    });

    // Re-render after web fonts load
    void document.fonts.ready.then(() => canvas.requestRenderAll());

    // Add default text block
    const defTb = new Textbox(DEFAULT_BLOCK.text, {
      left: 20, top: 24,
      width: DISPLAY_W - 40, fontSize: DEFAULT_BLOCK.fontSize,
      fontFamily: DEFAULT_BLOCK.fontFamily, fill: DEFAULT_BLOCK.fontColor,
      textAlign: "center", editable: true,
      originX: "left", originY: "top",
    });
    (defTb as any).__amId = "default";
    (defTb as any).__amType = "text";
    canvas.add(defTb);
    blockMapRef.current.set("default", defTb);
    canvas.renderAll();

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      blockMapRef.current.clear();
      doodleMapRef.current.clear();
      logoObjRef.current = null;
      bgLayersRef.current = [];
      subjectObjRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  // Reset state on format change
  useEffect(() => {
    setTextBlocks([{ ...DEFAULT_BLOCK }]);
    setDoodles([]);
    setSelectedId(null);
    setSelectedType(null);
  }, [format]);

  // ── Background update ─────────────────────────────────────────────────────
  const updateBackground = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove old bg/subject layers
    bgLayersRef.current.forEach(o => canvas.remove(o));
    bgLayersRef.current = [];
    if (subjectObjRef.current) {
      canvas.remove(subjectObjRef.current);
      subjectObjRef.current = null;
    }

    if (bgType === "photo" && photoUrl) {
      canvas.backgroundColor = "#000000";
      try {
        const elem = await loadImg(photoUrl);
        const scale = Math.max(DISPLAY_W / elem.width, DISPLAY_H / elem.height);
        const sw = elem.width * scale, sh = elem.height * scale;
        const bgImg = new FabricImage(elem, {
          left: (DISPLAY_W - sw) / 2, top: (DISPLAY_H - sh) / 2,
          scaleX: scale, scaleY: scale,
          selectable: false, evented: false,
          originX: "left", originY: "top",
        });
        canvas.add(bgImg);
        canvas.sendObjectToBack(bgImg);
        bgLayersRef.current.push(bgImg);

        const overlay = new Rect({
          left: 0, top: 0, width: DISPLAY_W, height: DISPLAY_H,
          fill: `rgba(0,0,0,${overlayOpacity / 100})`,
          selectable: false, evented: false,
          originX: "left", originY: "top",
        });
        canvas.add(overlay);
        canvas.moveObjectTo(overlay, 1);
        bgLayersRef.current.push(overlay);
      } catch {}
    } else {
      canvas.backgroundColor = bgType === "colour" ? bgColour : "#12121a";

      if (bgType === "colour" && subjectUrl) {
        try {
          const elem = await loadImg(subjectUrl);
          const maxH = DISPLAY_H * 0.52, maxW = DISPLAY_W * 0.75;
          const ar = elem.width / elem.height;
          let sw = maxH * ar, sh = maxH;
          if (sw > maxW) { sw = maxW; sh = sw / ar; }
          const subImg = new FabricImage(elem, {
            left: (DISPLAY_W - sw) / 2, top: DISPLAY_H * 0.04,
            scaleX: sw / elem.width, scaleY: sh / elem.height,
            selectable: true, evented: true,
            originX: "left", originY: "top",
          });
          (subImg as any).__amId = "subject";
          (subImg as any).__amType = "subject";
          canvas.add(subImg);
          canvas.sendObjectToBack(subImg);
          subjectObjRef.current = subImg;
        } catch {}
      }
    }

    canvas.renderAll();
  }, [bgType, bgColour, overlayOpacity, photoUrl, subjectUrl, DISPLAY_H]);

  useEffect(() => { void updateBackground(); }, [updateBackground]);

  // ── Text block helpers ────────────────────────────────────────────────────
  const syncTextBlockToFabric = useCallback((block: TextBlock) => {
    const canvas = fabricRef.current;
    const tb = blockMapRef.current.get(block.id);
    if (!canvas || !tb) return;
    tb.set({
      text: block.text,
      fontFamily: block.fontFamily,
      fill: block.fontColor,
      fontSize: block.fontSize,
      backgroundColor: block.bgEnabled ? hexToRgba(block.bgColor, block.bgOpacity) : "transparent",
    });
    canvas.renderAll();
  }, []);

  const updateBlockProp = useCallback(<K extends keyof TextBlock>(id: string, key: K, value: TextBlock[K]) => {
    setTextBlocks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, [key]: value } : b);
      const block = updated.find(b => b.id === id);
      if (block) setTimeout(() => syncTextBlockToFabric(block), 0);
      return updated;
    });
  }, [syncTextBlockToFabric]);

  const addTextBlock = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const id = uid();
    const block: TextBlock = {
      id, text: "New text", fontFamily: "DM Serif Display",
      fontColor: "#ffffff", bgEnabled: false, bgColor: "#000000", bgOpacity: 50, fontSize: 28,
    };
    setTextBlocks(prev => [...prev, block]);
    const tb = new Textbox("New text", {
      left: 20, top: DISPLAY_H / 2,
      width: DISPLAY_W - 40, fontSize: 28, fontFamily: "DM Serif Display",
      fill: "#ffffff", textAlign: "center", editable: true,
      originX: "left", originY: "top",
    });
    (tb as any).__amId = id;
    (tb as any).__amType = "text";
    canvas.add(tb);
    canvas.setActiveObject(tb);
    blockMapRef.current.set(id, tb);
    canvas.renderAll();
    setSelectedId(id); setSelectedType("text");
  }, [DISPLAY_H]);

  const removeTextBlock = useCallback((id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const tb = blockMapRef.current.get(id);
    if (tb) { canvas.remove(tb); blockMapRef.current.delete(id); }
    setTextBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(null); setSelectedType(null);
    canvas.renderAll();
  }, []);

  const selectTextBlock = useCallback((id: string) => {
    const canvas = fabricRef.current;
    const tb = blockMapRef.current.get(id);
    if (canvas && tb) { canvas.setActiveObject(tb); canvas.renderAll(); }
    setSelectedId(id); setSelectedType("text");
  }, []);

  // ── Logo ──────────────────────────────────────────────────────────────────
  const applyLogo = useCallback(async (url: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (logoObjRef.current) { canvas.remove(logoObjRef.current); logoObjRef.current = null; }
    try {
      const elem = await loadImg(url);
      const maxSz = DISPLAY_W * 0.18;
      const ar = elem.width / elem.height;
      const lw = ar >= 1 ? maxSz : maxSz * ar;
      const lh = ar >= 1 ? maxSz / ar : maxSz;
      const geo = pendingLogoGeoRef.current;
      pendingLogoGeoRef.current = null;
      const logo = new FabricImage(elem, {
        left: geo?.left ?? DISPLAY_W - lw - 10,
        top: geo?.top ?? DISPLAY_H - lh - 10,
        scaleX: geo?.scaleX ?? lw / elem.width,
        scaleY: geo?.scaleY ?? lh / elem.height,
        selectable: true, evented: true,
        originX: "left", originY: "top",
      });
      (logo as any).__amId = "logo";
      (logo as any).__amType = "logo";
      canvas.add(logo);
      logoObjRef.current = logo;
      canvas.renderAll();
    } catch {}
  }, [DISPLAY_H]);

  useEffect(() => { if (logoUrl) void applyLogo(logoUrl); }, [logoUrl, applyLogo]);

  // Auto-load logo when preset changes — always replace with new preset's logo
  useEffect(() => {
    if (selectedPresetId === lastPresetIdRef.current) return;
    lastPresetIdRef.current = selectedPresetId;
    if (selectedPreset?.logoUrl) {
      setLogoUrl(selectedPreset.logoUrl);
    }
  }, [selectedPresetId, selectedPreset?.logoUrl]);

  const removeLogo = useCallback(() => {
    const canvas = fabricRef.current;
    if (canvas && logoObjRef.current) { canvas.remove(logoObjRef.current); logoObjRef.current = null; canvas.renderAll(); }
    setLogoUrl(null);
  }, []);

  // ── Doodles ───────────────────────────────────────────────────────────────
  const addDoodle = useCallback(async (shape: DoodleShape) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const id = uid();
    const color = "#ffffff";
    setDoodles(prev => [...prev, { id, shapeId: shape.id, color }]);
    try {
      const { objects } = await loadSVGFromString(shape.svg);
      const valid = objects.filter((o): o is FabricObject => o !== null);
      valid.forEach(obj => obj.set({ stroke: color, fill: "transparent" }));
      const group = new Group(valid, {
        left: DISPLAY_W / 2 - 40, top: DISPLAY_H / 2 - 40,
        scaleX: 0.8, scaleY: 0.8,
        selectable: true, evented: true,
      });
      (group as any).__amId = id;
      (group as any).__amType = "doodle";
      canvas.add(group);
      canvas.setActiveObject(group);
      doodleMapRef.current.set(id, group);
      canvas.renderAll();
      setSelectedId(id); setSelectedType("doodle");
    } catch (e) { console.error("Doodle load failed", e); }
  }, [DISPLAY_H]);

  // Load sticker catalogue from the server on mount
  useEffect(() => {
    fetch(`${BASE}/api/stickers`)
      .then(r => r.json())
      .then(data => setStickerLibrary(data.stickers ?? []))
      .catch(() => {});
  }, []);

  const addStickerToCanvas = useCallback(async (item: StickerLibraryItem) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const id = uid();
    setStickerInstances(prev => [...prev, { id, libraryId: item.id }]);
    try {
      const img = await FabricImage.fromURL(item.url);
      const scale = Math.min(0.25, 160 / Math.max(img.width ?? 1, img.height ?? 1));
      img.set({
        left: DISPLAY_W / 2 - (img.width ?? 100) * scale / 2,
        top: DISPLAY_H / 2 - (img.height ?? 100) * scale / 2,
        scaleX: scale, scaleY: scale,
        selectable: true, evented: true,
        originX: "left", originY: "top",
      });
      (img as any).__amId = id;
      (img as any).__amType = "sticker";
      canvas.add(img);
      canvas.setActiveObject(img);
      stickerMapRef.current.set(id, img);
      canvas.renderAll();
      setSelectedId(id); setSelectedType("sticker");
    } catch (e) { console.error("Sticker load failed", e); }
  }, [DISPLAY_H]);

  const removeSticker = useCallback((id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = stickerMapRef.current.get(id);
    if (obj) { canvas.remove(obj); stickerMapRef.current.delete(id); canvas.renderAll(); }
    setStickerInstances(prev => prev.filter(s => s.id !== id));
    setSelectedId(null); setSelectedType(null);
  }, []);

  const selectSticker = useCallback((id: string) => {
    const canvas = fabricRef.current;
    const obj = stickerMapRef.current.get(id);
    if (canvas && obj) { canvas.setActiveObject(obj); canvas.renderAll(); }
    setSelectedId(id); setSelectedType("sticker");
  }, []);

  const removeStickerFromLibrary = useCallback(async (id: number) => {
    try {
      await fetch(`${BASE}/api/stickers/${id}`, { method: "DELETE" });
      setStickerLibrary(prev => prev.filter(s => s.id !== id));
    } catch { toast.error("Failed to remove sticker"); }
  }, []);

  const handleStickerUpload = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    setStickerUploading(true);
    try {
      for (const f of Array.from(files)) {
        const base64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });
        const resp = await fetch(`${BASE}/api/stickers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.name, base64 }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({ error: resp.status === 413 ? "Images too large — try smaller files" : `Upload failed (${resp.status})` }));
          throw new Error(data.error || "Upload failed");
        }
        const data = await resp.json();
        setStickerLibrary(prev => [...prev, data.sticker]);
      }
      toast.success("Sticker" + (files.length > 1 ? "s" : "") + " saved to catalogue");
    } catch (e: any) {
      toast.error("Sticker upload failed: " + e.message);
    } finally {
      setStickerUploading(false);
    }
  }, []);

  const removeDoodle = useCallback((id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const g = doodleMapRef.current.get(id);
    if (g) { canvas.remove(g); doodleMapRef.current.delete(id); canvas.renderAll(); }
    setDoodles(prev => prev.filter(d => d.id !== id));
    setSelectedId(null); setSelectedType(null);
  }, []);

  const updateDoodleColor = useCallback((id: string, color: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const g = doodleMapRef.current.get(id);
    if (g) { g.getObjects().forEach(o => o.set({ stroke: color })); canvas.renderAll(); }
    setDoodles(prev => prev.map(d => d.id === id ? { ...d, color } : d));
  }, []);

  const selectDoodle = useCallback((id: string) => {
    const canvas = fabricRef.current;
    const g = doodleMapRef.current.get(id);
    if (canvas && g) { canvas.setActiveObject(g); canvas.renderAll(); }
    setSelectedId(id); setSelectedType("doodle");
  }, []);

  // ── Photo ─────────────────────────────────────────────────────────────────
  const removeBackground = useCallback(async (file: File) => {
    setBgRemoving(true);
    try {
      const { removeBackground: removeBg } = await import("@imgly/background-removal");
      const blob = await removeBg(file, { model: "isnet", output: { format: "image/png", quality: 0.95 } });
      setCutoutUrl(URL.createObjectURL(blob));
      toast.success("Background removed");
    } catch { toast.error("Background removal failed — using original"); }
    finally { setBgRemoving(false); }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setPhotoUrl(URL.createObjectURL(file));
    setCutoutUrl(""); setUseOriginal(false);
    removeBackground(file);
  }, [removeBackground]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Logo upload ───────────────────────────────────────────────────────────
  const handleLogoUpload = useCallback(async (file: File) => {
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => { reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(file); });
      const resp = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: file.name, base64 }] }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Logo upload failed" }));
        throw new Error(data.error || "Logo upload failed");
      }
      const data = await resp.json();
      setLogoUrl(data.results?.[0]?.url ?? "");
      toast.success("Logo uploaded");
    } catch (e: any) { toast.error("Logo upload failed: " + e.message); }
    finally { setLogoUploading(false); }
  }, []);

  // ── Save / load draft ─────────────────────────────────────────────────────
  const restoreCanvasObjects = useCallback(async (state: CanvasDraftState) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Remove existing user objects (text, logo, doodle)
    const toRemove = canvas.getObjects().filter(o => {
      const t = (o as any).__amType;
      return t === "text" || t === "logo" || t === "doodle";
    });
    toRemove.forEach(o => canvas.remove(o));
    blockMapRef.current.clear();
    doodleMapRef.current.clear();
    logoObjRef.current = null;

    // Re-create text blocks with saved geometry
    for (const block of state.textBlocks ?? []) {
      const tb = new Textbox(block.text, {
        left: block.left ?? 20, top: block.top ?? 24,
        width: block.width ?? DISPLAY_W - 40,
        scaleX: block.scaleX ?? 1, scaleY: block.scaleY ?? 1,
        angle: block.angle ?? 0,
        fontSize: block.fontSize, fontFamily: block.fontFamily,
        fill: block.fontColor, textAlign: "center", editable: true,
        originX: "left", originY: "top",
      });
      if (block.bgEnabled) tb.set({ backgroundColor: hexToRgba(block.bgColor, block.bgOpacity) });
      (tb as any).__amId = block.id;
      (tb as any).__amType = "text";
      canvas.add(tb);
      blockMapRef.current.set(block.id, tb);
    }

    // Re-create doodles with saved geometry
    for (const doodle of state.doodles ?? []) {
      const shape = DOODLES.find(d => d.id === doodle.shapeId);
      if (!shape) continue;
      try {
        const { objects } = await loadSVGFromString(shape.svg);
        const valid = objects.filter((o): o is FabricObject => o !== null);
        valid.forEach(obj => obj.set({ stroke: doodle.color, fill: "transparent" }));
        const group = new Group(valid, {
          left: doodle.left ?? DISPLAY_W / 2 - 40,
          top: doodle.top ?? DISPLAY_H / 2 - 40,
          scaleX: doodle.scaleX ?? 0.8, scaleY: doodle.scaleY ?? 0.8,
          angle: doodle.angle ?? 0,
          selectable: true, evented: true,
          originX: "left", originY: "top",
        });
        (group as any).__amId = doodle.id;
        (group as any).__amType = "doodle";
        canvas.add(group);
        doodleMapRef.current.set(doodle.id, group);
      } catch {}
    }

    // Logo: set pending geo so applyLogo picks it up, then trigger via logoUrl
    if (state.logoUrl) {
      pendingLogoGeoRef.current = state.logoGeo ?? null;
      setLogoUrl(state.logoUrl);
    }

    canvas.requestRenderAll();
  }, [DISPLAY_H]);

  // Triggered after state has been committed from a draft load
  useEffect(() => {
    if (!pendingRestoreRef.current) return;
    const state = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    void restoreCanvasObjects(state);
  }, [restoreKey, restoreCanvasObjects]);

  const loadDraftForClient = useCallback(async (clientName: string) => {
    if (!clientName) return;
    try {
      const resp = await fetch(`${BASE}/api/about-me/canvas-draft?clientName=${encodeURIComponent(clientName)}`);
      if (!resp.ok) return;
      const { canvasConfig } = await resp.json() as { canvasConfig: CanvasDraftState };
      const state = canvasConfig;
      // Restore page state
      if (state.bgType) setBgType(state.bgType);
      if (state.bgColour) setBgColour(state.bgColour);
      if (state.overlayOpacity != null) setOverlayOpacity(state.overlayOpacity);
      if (state.photoUrl) setPhotoUrl(state.photoUrl);
      if (state.cutoutUrl) setCutoutUrl(state.cutoutUrl);
      if (state.format) setFormat(state.format);
      if (state.useOriginal != null) setUseOriginal(state.useOriginal);
      if (state.textBlocks) setTextBlocks(state.textBlocks);
      if (state.doodles) setDoodles(state.doodles);
      // Store full state for canvas restore (runs after state commit via restoreKey)
      pendingRestoreRef.current = state;
      setRestoreKey(k => k + 1);
    } catch {}
  }, []);

  // Auto-load draft when preset changes
  useEffect(() => {
    if (selectedPreset?.name) void loadDraftForClient(selectedPreset.name);
  }, [selectedPresetId]); // eslint-disable-line

  const saveDraft = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const clientName = selectedPreset?.name ?? "__default__";
    setSavingDraft(true);
    try {
      // Upload any blob: URLs to object storage to get durable URLs
      const durablePhotoUrl = await ensureDurableUrl(photoUrl, BASE);
      const durableCutoutUrl = await ensureDurableUrl(cutoutUrl, BASE);
      // Enrich text blocks and doodles with current Fabric geometry
      const enrichedBlocks = textBlocks.map(b => {
        const tb = blockMapRef.current.get(b.id);
        return tb ? { ...b, left: tb.left, top: tb.top, width: tb.width, scaleX: tb.scaleX, scaleY: tb.scaleY, angle: tb.angle } : b;
      });
      const enrichedDoodles = doodles.map(d => {
        const g = doodleMapRef.current.get(d.id);
        return g ? { ...d, left: g.left, top: g.top, scaleX: g.scaleX, scaleY: g.scaleY, angle: g.angle } : d;
      });
      const logoGeo: LogoGeo = logoObjRef.current
        ? { left: logoObjRef.current.left ?? 0, top: logoObjRef.current.top ?? 0, scaleX: logoObjRef.current.scaleX ?? 1, scaleY: logoObjRef.current.scaleY ?? 1 }
        : null;
      const canvasConfig: CanvasDraftState = {
        bgType, bgColour, overlayOpacity,
        photoUrl: durablePhotoUrl, cutoutUrl: durableCutoutUrl,
        logoUrl, logoGeo, format, textBlocks: enrichedBlocks,
        doodles: enrichedDoodles, useOriginal,
      };
      const resp = await fetch(`${BASE}/api/about-me/canvas-draft`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, canvasConfig }),
      });
      if (!resp.ok) throw new Error("Save failed");
      // Update local state with durable URLs so restores work without re-uploading
      if (durablePhotoUrl !== photoUrl) setPhotoUrl(durablePhotoUrl);
      if (durableCutoutUrl !== cutoutUrl) setCutoutUrl(durableCutoutUrl);
      isDirtyRef.current = false;
      toast.success("Layout saved");
    } catch (e: any) { toast.error("Failed to save: " + e.message); }
    finally { setSavingDraft(false); }
  }, [bgType, bgColour, overlayOpacity, photoUrl, cutoutUrl, logoUrl, format, textBlocks, doodles, useOriginal, selectedPreset?.name]);

  const saveLogoToPreset = useCallback(async () => {
    if (!selectedPresetId || !logoUrl) return;
    try {
      const resp = await fetch(`${BASE}/api/presets/${selectedPresetId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      if (!resp.ok) throw new Error("Update failed");
      await fetchPresets();
      toast.success("Logo saved to preset");
    } catch (e: any) { toast.error("Failed: " + e.message); }
  }, [selectedPresetId, logoUrl, fetchPresets]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: EXPORT_MULT });
      const a = document.createElement("a");
      a.href = dataUrl; a.download = "about-me.png"; a.click();
    } catch (e: any) { toast.error("Export failed: " + e.message); }
    finally { setExporting(false); }
  }, [EXPORT_MULT]);

  const uploadImage = useCallback(async (name: string, base64: string): Promise<string> => {
    const resp = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name, base64 }] }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: resp.status === 413 ? "Images too large — try smaller files" : `Upload failed (${resp.status})` }));
      throw new Error(data.error ?? "Upload failed");
    }
    const data = await resp.json();
    return data.results?.[0]?.url ?? "";
  }, []);

  const handleSchedule = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setScheduleRendering(true);
    const tid = toast.loading("Preparing image…");
    try {
      await document.fonts.ready;
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: EXPORT_MULT });
      const imageUrl = await uploadImage("about-me.png", dataUrl.split(",")[1]);
      toast.dismiss(tid);
      setSchedulePosts([{ title: "About Me", caption: "", imageUrls: [imageUrl] }]);
      setScheduleOpen(true);
    } catch (e: any) { toast.error("Failed: " + e.message, { id: tid }); }
    finally { setScheduleRendering(false); }
  }, [EXPORT_MULT, uploadImage]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedBlock = textBlocks.find(b => b.id === selectedId);
  const selectedDoodle = doodles.find(d => d.id === selectedId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/50 shrink-0">
        <Link href="/hub" className="text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-semibold tracking-widest uppercase text-white/80">About Me</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={saveDraft} disabled={savingDraft} size="sm" variant="outline"
            className="text-xs h-7 px-3 border-white/20 text-white/70 hover:text-white">
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save
          </Button>
          <Button onClick={handleDownload} disabled={exporting} size="sm"
            className="bg-pink-600 hover:bg-pink-500 text-white text-xs h-7 px-3">
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Download
          </Button>
          <Button onClick={handleSchedule} disabled={scheduleRendering} size="sm" variant="outline"
            className="text-xs h-7 px-3 border-white/20 text-white/70 hover:text-white">
            {scheduleRendering ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5 mr-1" />}
            Schedule
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col gap-0 border-r border-white/10 bg-black/30 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Contextual: selected text block */}
            {selectedType === "text" && selectedBlock && (
              <div className="space-y-3 p-3 border border-pink-500/30 bg-pink-500/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-pink-400">Selected Text Block</Label>
                  <button onClick={() => removeTextBlock(selectedBlock.id)}
                    className="text-white/30 hover:text-red-400 transition-colors p-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Font</span>
                  <select value={selectedBlock.fontFamily} onChange={e => updateBlockProp(selectedBlock.id, "fontFamily", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500/40 transition-colors">
                    {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Size</span>
                    <span className="text-[10px] font-mono text-white/30">{selectedBlock.fontSize}px</span>
                  </div>
                  <input type="range" min={12} max={80} step={2} value={selectedBlock.fontSize}
                    onChange={e => updateBlockProp(selectedBlock.id, "fontSize", Number(e.target.value))}
                    className="w-full accent-pink-500 h-1.5" />
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest shrink-0">Text colour</span>
                  <label className="relative w-7 h-7 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                    <input type="color" value={selectedBlock.fontColor} onChange={e => updateBlockProp(selectedBlock.id, "fontColor", e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    <span className="absolute inset-0 rounded-md" style={{ background: selectedBlock.fontColor }} />
                  </label>
                  <span className="text-xs font-mono text-white/30">{selectedBlock.fontColor}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Background box</span>
                    <button onClick={() => updateBlockProp(selectedBlock.id, "bgEnabled", !selectedBlock.bgEnabled)}
                      className={`relative w-9 h-5 rounded-full border transition-colors ${selectedBlock.bgEnabled ? "bg-pink-600 border-pink-500" : "bg-white/10 border-white/20"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${selectedBlock.bgEnabled ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  {selectedBlock.bgEnabled && (
                    <div className="space-y-2 pl-1">
                      <div className="flex items-center gap-2.5">
                        <label className="relative w-7 h-7 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                          <input type="color" value={selectedBlock.bgColor} onChange={e => updateBlockProp(selectedBlock.id, "bgColor", e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                          <span className="absolute inset-0 rounded-md" style={{ background: selectedBlock.bgColor }} />
                        </label>
                        <span className="text-xs font-mono text-white/30">{selectedBlock.bgColor}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">Opacity</span>
                          <span className="text-[10px] font-mono text-white/30">{selectedBlock.bgOpacity}%</span>
                        </div>
                        <input type="range" min={5} max={100} step={5} value={selectedBlock.bgOpacity}
                          onChange={e => updateBlockProp(selectedBlock.id, "bgOpacity", Number(e.target.value))}
                          className="w-full accent-pink-500 h-1.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contextual: selected doodle */}
            {selectedType === "doodle" && selectedDoodle && (
              <div className="space-y-3 p-3 border border-violet-500/30 bg-violet-500/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-violet-400">Selected Doodle</Label>
                  <button onClick={() => removeDoodle(selectedDoodle.id)} className="text-white/30 hover:text-red-400 transition-colors p-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest shrink-0">Stroke colour</span>
                  <label className="relative w-7 h-7 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                    <input type="color" value={selectedDoodle.color} onChange={e => updateDoodleColor(selectedDoodle.id, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    <span className="absolute inset-0 rounded-md" style={{ background: selectedDoodle.color }} />
                  </label>
                  <span className="text-xs font-mono text-white/30">{selectedDoodle.color}</span>
                </div>
                <p className="text-[10px] text-white/25">Drag to reposition. Resize with corner handles.</p>
              </div>
            )}

            {/* Photo */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Photo</Label>
              <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                onClick={() => !bgRemoving && fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/15 hover:border-pink-500/40 rounded-xl p-4 cursor-pointer transition-colors">
                {bgRemoving ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                    <span className="text-xs text-white/50">Removing background…</span>
                  </div>
                ) : (photoUrl || subjectUrl) ? (
                  <div className="flex items-center gap-3">
                    <img src={subjectUrl || photoUrl} className="h-14 object-contain rounded" alt="Preview" />
                    <div>
                      <p className="text-xs text-white/60">{cutoutUrl && !useOriginal ? "Background removed" : "Original photo"}</p>
                      <p className="text-[10px] text-white/30">Click to change</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-1.5">
                    <Upload className="w-6 h-6 text-white/30 mx-auto" />
                    <p className="text-xs text-white/40">Drag &amp; drop or click</p>
                    <p className="text-[10px] text-pink-400/60">Background removed automatically</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
              {cutoutUrl && (
                <button onClick={() => setUseOriginal(p => !p)}
                  className={`w-full py-1.5 text-[11px] rounded-lg border transition-colors ${useOriginal ? "border-white/15 text-white/35 bg-white/5" : "border-pink-500/40 text-pink-400 bg-pink-500/10"}`}>
                  {useOriginal ? "Showing: Original" : "Showing: Background removed"}
                </button>
              )}
            </div>

            {/* Background */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Background</Label>
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                {(["photo", "colour"] as const).map(t => (
                  <button key={t} onClick={() => setBgType(t)}
                    className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${bgType === t ? "bg-pink-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"}`}>
                    {t === "photo" ? "Full bleed photo" : "Brand colour"}
                  </button>
                ))}
              </div>
              {bgType === "photo" && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Overlay darkness</span>
                    <span className="text-[10px] font-mono text-white/30">{overlayOpacity}%</span>
                  </div>
                  <input type="range" min={0} max={80} step={5} value={overlayOpacity}
                    onChange={e => setOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-pink-500 h-1.5" />
                </div>
              )}
              {bgType === "colour" && (
                <>
                  <div className="flex items-center gap-2.5">
                    <label className="relative w-8 h-8 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                      <input type="color" value={bgColour} onChange={e => setBgColour(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      <span className="absolute inset-0 rounded-md" style={{ background: bgColour }} />
                    </label>
                    <span className="text-xs font-mono text-white/40">{bgColour.toUpperCase()}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {["#12121a","#0d1117","#1c1017","#101c17","#1a0f0a","#17171a","#0f0d1a"].map(c => (
                      <button key={c} onClick={() => setBgColour(c)} style={{ background: c }}
                        className="w-6 h-6 rounded-full border border-white/25 hover:scale-110 transition-transform" title={c} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Text Blocks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-widest text-white/40">Text Blocks</Label>
                <button onClick={addTextBlock} className="text-[10px] text-pink-400/70 hover:text-pink-400 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" />Add
                </button>
              </div>
              <p className="text-[10px] text-white/25">Click a block to select it. Double-click on canvas to edit text.</p>
              <div className="space-y-1">
                {textBlocks.map(b => (
                  <button key={b.id} onClick={() => selectTextBlock(b.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${selectedId === b.id ? "bg-pink-500/20 border border-pink-500/40" : "bg-white/5 border border-transparent hover:bg-white/10"}`}>
                    <Type className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span className="text-xs truncate text-white/80">{b.text || "(empty)"}</span>
                    <span className="ml-auto text-[10px] text-white/30 shrink-0">{b.fontFamily.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Logo</Label>
              {logoUrl ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 p-2 rounded-xl border border-white/10 bg-white/5">
                    <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60">Logo loaded</p>
                      <p className="text-[10px] text-white/30">Drag to reposition on canvas</p>
                    </div>
                    <button onClick={removeLogo} className="text-white/30 hover:text-red-400 transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedPresetId && logoUrl !== selectedPreset?.logoUrl && (
                    <button onClick={saveLogoToPreset}
                      className="w-full py-1 text-[10px] text-pink-400/70 hover:text-pink-400 border border-pink-500/20 hover:border-pink-500/40 rounded-lg transition-colors">
                      Save logo to preset
                    </button>
                  )}
                </div>
              ) : (
                <div onClick={() => logoInputRef.current?.click()}
                  className="border border-dashed border-white/15 hover:border-pink-500/40 rounded-xl p-4 cursor-pointer transition-colors text-center">
                  {logoUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-pink-400 mx-auto" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-white/30 mx-auto mb-1" />
                      <p className="text-[10px] text-white/40">Upload logo</p>
                      {selectedPreset?.logoUrl && <p className="text-[10px] text-pink-400/60 mt-0.5">Auto-loaded from preset</p>}
                    </>
                  )}
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
            </div>

            {/* Doodle Library */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Doodle Library</Label>
              <p className="text-[10px] text-white/25">Click to add. Drag to reposition, resize with handles.</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DOODLES.map(d => (
                  <button key={d.id} onClick={() => addDoodle(d)}
                    className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 active:scale-95 transition-all p-1.5">
                    {/* Inline SVG preview */}
                    <div className="w-9 h-9 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: d.svg.replace('<svg ', '<svg class="w-full h-full" ') }} />
                    <span className="text-[9px] text-white/30 leading-none">{d.label}</span>
                  </button>
                ))}
              </div>

              {/* Active doodles list */}
              {doodles.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">On canvas</p>
                  {doodles.map(d => (
                    <button key={d.id} onClick={() => selectDoodle(d.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${selectedId === d.id ? "bg-violet-500/20 border border-violet-500/40" : "bg-white/5 border border-transparent hover:bg-white/10"}`}>
                      <div className="w-5 h-5 rounded" style={{ background: d.color, border: "1px solid rgba(255,255,255,0.2)" }} />
                      <span className="text-xs text-white/70 capitalize">{d.shapeId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stickers */}
            <div className="space-y-2 border-t border-white/8 pt-4">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Stickers</Label>
              <p className="text-[10px] text-white/25">Upload PNG stickers from Canva. Click to add. Drag to reposition, resize with handles.</p>
              <button onClick={() => stickerInputRef.current?.click()} disabled={stickerUploading}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/20 hover:border-pink-500/50 hover:bg-pink-500/5 active:scale-95 transition-all text-[10px] text-white/40 hover:text-white/70 disabled:opacity-50 disabled:cursor-wait">
                {stickerUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {stickerUploading ? "Saving…" : "Upload Stickers"}
              </button>
              {stickerLibrary.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {stickerLibrary.map(item => (
                    <div key={item.id} className="relative group aspect-square">
                      <button onClick={() => addStickerToCanvas(item)}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 rounded-lg border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 active:scale-95 transition-all p-1.5 overflow-hidden">
                        <img src={item.url} alt={item.name} className="w-9 h-9 object-contain" />
                        <span className="text-[9px] text-white/30 leading-none truncate w-full text-center">{item.name}</span>
                      </button>
                      <button onClick={() => removeStickerFromLibrary(item.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {stickerInstances.length > 0 && (
                <div className="space-y-1 mt-1">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">On canvas</p>
                  {stickerInstances.map(s => {
                    const libItem = stickerLibrary.find(l => l.id === s.libraryId);
                    return (
                      <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${selectedId === s.id ? "bg-violet-500/20 border border-violet-500/40" : "bg-white/5 border border-transparent"}`}>
                        <button className="flex items-center gap-2 flex-1 min-w-0" onClick={() => selectSticker(s.id)}>
                          {libItem && <img src={libItem.url} alt={libItem.name} className="w-5 h-5 object-contain shrink-0" />}
                          <span className="text-xs text-white/70 truncate">{libItem?.name ?? "Sticker"}</span>
                        </button>
                        <button onClick={() => removeSticker(s.id)} className="text-white/20 hover:text-red-400 transition-colors p-0.5 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <input ref={stickerInputRef} type="file" accept="image/png,image/*" multiple className="hidden"
                onChange={e => { void handleStickerUpload(e.target.files); e.target.value = ""; }} />
            </div>

            {/* Format + Client */}
            <div className="space-y-3 border-t border-white/8 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-white/40">Format</Label>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(["post", "story"] as const).map(f => (
                    <button key={f} onClick={() => setFormat(f)}
                      className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${format === f ? "bg-pink-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"}`}>
                      {f === "post" ? "Post 4:5" : "Story 9:16"}
                    </button>
                  ))}
                </div>
              </div>
              {presets.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-white/40">Client</Label>
                  <select value={selectedPresetId ?? ""} onChange={e => setSelectedPresetId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500/50 transition-colors">
                    <option value="">No client</option>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {selectedPreset && (
                    <p className="text-[10px] text-white/30">Logo auto-loads from preset if available.</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* ── Canvas area ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex items-center justify-center bg-[#080808] overflow-auto p-8">
          <div className="flex flex-col items-center gap-3">
            <canvas ref={canvasElRef} className="rounded-xl shadow-2xl shadow-black/60" />
            <p className="text-[10px] text-white/20 uppercase tracking-widest">
              {format === "post" ? "1080 × 1440" : "1080 × 1920"} · Click to select · Double-click text to edit
            </p>
          </div>
        </main>

      </div>

      {scheduleOpen && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={selectedPreset?.name}
          postType="about-me"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}
