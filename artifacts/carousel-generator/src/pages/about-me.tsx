import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download, Loader2, ChevronLeft, X, CalendarClock } from "lucide-react";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";

// ── Dimensions ────────────────────────────────────────────────────────────────
const CW = 1080;
const CH_POST = 1350;
const CH_STORY = 1920;
const PW = 330;
const PH_POST = 413;
const PH_STORY = 587;
const FONT_FAMILY = "'DM Serif Display', Georgia, serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadDMSerifDisplay() {
  const id = "gf-dm-serif";
  if (!document.getElementById(id)) {
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap";
    document.head.appendChild(l);
  }
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

function coverCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ia = img.naturalWidth / img.naturalHeight;
  const da = dw / dh;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ia > da) { sw = sh * da; sx = (img.naturalWidth - sw) / 2; }
  else { sh = sw / da; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AboutMePage() {
  // Photo
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [cutoutImg, setCutoutImg] = useState<HTMLImageElement | null>(null);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  // Background
  const [bgType, setBgType] = useState<"photo" | "colour">("photo");
  const [bgColour, setBgColour] = useState("#12121a");
  const [overlayOpacity, setOverlayOpacity] = useState(40);

  // Words
  const [words, setWords] = useState(["Wife", "Mum", "Nurse", "Loyal", "Fun"]);
  const [wordLayout, setWordLayout] = useState<"list" | "grid">("list");
  const [wordFontSize, setWordFontSize] = useState(72);
  const [wordSpacing, setWordSpacing] = useState(2.2);

  // Border
  const [borderEnabled, setBorderEnabled] = useState(false);

  // Format
  const [format, setFormat] = useState<"post" | "story">("post");

  // Export / schedule
  const [exporting, setExporting] = useState(false);
  const [scheduleRendering, setScheduleRendering] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePosts, setSchedulePosts] = useState<SchedulePostPayload[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);

  const { presets } = usePresets();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const CH = format === "story" ? CH_STORY : CH_POST;
  const PH = format === "story" ? PH_STORY : PH_POST;
  const displayImg = useOriginal || !cutoutImg ? photoImg : cutoutImg;
  const displayUrl = useOriginal || !cutoutUrl ? photoUrl : cutoutUrl;

  useEffect(() => {
    loadDMSerifDisplay();
    document.fonts.ready.then(() => setFontLoaded(true));
  }, []);

  // ── Photo handling ────────────────────────────────────────────────────────
  const removeBackground = useCallback(async (file: File) => {
    setBgRemoving(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, {
        model: "isnet",
        output: { format: "image/png", quality: 0.95 },
      });
      const url = URL.createObjectURL(blob);
      setCutoutUrl(url);
      setCutoutImg(await loadImg(url));
      toast.success("Background removed");
    } catch {
      toast.error("Background removal failed — using original");
    } finally {
      setBgRemoving(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setPhotoImg(await loadImg(url));
      setCutoutUrl("");
      setCutoutImg(null);
      setUseOriginal(false);
      removeBackground(file);
    },
    [removeBackground],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ── Core draw function ────────────────────────────────────────────────────
  const drawToCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const W = canvas.width;
      const H = canvas.height;
      const scale = W / CW;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      // Background
      if (bgType === "photo" && photoImg) {
        coverCrop(ctx, photoImg, 0, 0, W, H);
        ctx.fillStyle = `rgba(0,0,0,${overlayOpacity / 100})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = bgColour;
        ctx.fillRect(0, 0, W, H);
        // Practitioner photo centred in upper portion (colour mode)
        if (displayImg) {
          const photoH = H * 0.52;
          const imgAr = displayImg.naturalWidth / displayImg.naturalHeight;
          const photoW = Math.min(W * 0.78, photoH * imgAr);
          const px = (W - photoW) / 2;
          const py = H * 0.05;
          ctx.drawImage(displayImg, px, py, photoW, photoH);
        }
      }

      // Words
      const wordList = words.filter((w) => w.trim());
      if (wordList.length > 0) {
        const fs = Math.round(wordFontSize * scale);
        ctx.font = `400 ${fs}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const lineH = fs * wordSpacing;

        // Vertical start position
        let startY: number;
        const rows = wordLayout === "grid" ? Math.ceil(wordList.length / 2) : wordList.length;
        const blockH = rows * lineH;
        const pad = Math.round(40 * scale);

        if (bgType === "photo") {
          // Push words into lower half when a photo is loaded as background,
          // but use the full canvas when no photo is present.
          const zoneTop = photoImg ? H * 0.50 : H * 0.10;
          const zoneH = H - zoneTop - pad;
          startY = zoneTop + Math.max(0, (zoneH - blockH) / 2) + fs;
        } else {
          const zoneTop = displayImg ? H * 0.63 : H * 0.10;
          const zoneH = H - zoneTop - pad;
          startY = zoneTop + Math.max(0, (zoneH - blockH) / 2) + fs;
        }

        if (wordLayout === "list") {
          wordList.forEach((word, i) => {
            ctx.fillText(word, W / 2, startY + i * lineH);
          });
        } else {
          const colX: [number, number] = [W * 0.28, W * 0.72];
          wordList.forEach((word, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            ctx.fillText(word, colX[col], startY + row * lineH);
          });
        }
      }

      // Border
      if (borderEnabled) {
        const inset = Math.round(20 * scale);
        ctx.strokeStyle = "rgba(255,255,255,0.72)";
        ctx.lineWidth = Math.max(1, Math.round(2 * scale));
        ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
      }
    },
    [
      bgType, photoImg, bgColour, overlayOpacity, displayImg,
      words, wordLayout, wordFontSize, wordSpacing, borderEnabled, fontLoaded,
    ],
  );

  // Re-draw preview on every state change
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = PW;
    canvas.height = PH;
    drawToCanvas(canvas);
  }, [drawToCanvas, PH]);

  // ── Upload helper ────────────────────────────────────────────────────────
  const uploadImage = async (name: string, base64: string): Promise<string> => {
    const resp = await fetch(`${import.meta.env.BASE_URL}api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ name, base64 }] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? "Upload failed");
    return data.results?.[0]?.url ?? "";
  };

  const buildExportCanvas = useCallback(async () => {
    await document.fonts.load(`400 ${wordFontSize}px ${FONT_FAMILY}`);
    const canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    drawToCanvas(canvas);
    return canvas;
  }, [drawToCanvas, CH, wordFontSize]);

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setExporting(true);
    try {
      const canvas = await buildExportCanvas();
      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), "image/png", 0.95),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "about-me.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Export failed: " + (e?.message ?? ""));
    } finally {
      setExporting(false);
    }
  }, [buildExportCanvas]);

  // ── Schedule ─────────────────────────────────────────────────────────────
  const handleSchedule = useCallback(async () => {
    setScheduleRendering(true);
    const toastId = toast.loading("Preparing image…");
    try {
      const canvas = await buildExportCanvas();
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      const imageUrl = await uploadImage("about-me.png", base64);
      toast.dismiss(toastId);
      setSchedulePosts([{ title: "About Me", caption: "", imageUrls: [imageUrl] }]);
      setScheduleOpen(true);
    } catch (e: any) {
      toast.error("Failed: " + (e?.message ?? ""), { id: toastId });
    } finally {
      setScheduleRendering(false);
    }
  }, [buildExportCanvas]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/50 shrink-0">
        <Link href="/hub" className="text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-semibold tracking-widest uppercase text-white/80">
          About Me
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left rail ──────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col gap-5 px-4 py-5 border-r border-white/10 bg-black/30 overflow-y-auto">

          {/* Photo */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Photo</Label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !bgRemoving && fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-pink-500/40 rounded-xl p-4 cursor-pointer transition-colors"
            >
              {bgRemoving ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                  <span className="text-xs text-white/50">Removing background…</span>
                </div>
              ) : displayUrl ? (
                <div className="flex items-center gap-3">
                  <img src={displayUrl} className="h-14 object-contain rounded" alt="Preview" />
                  <div className="text-left">
                    <p className="text-xs text-white/60">
                      {cutoutUrl && !useOriginal ? "Background removed" : "Original photo"}
                    </p>
                    <p className="text-[10px] text-white/30">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center space-y-1.5">
                  <Upload className="w-6 h-6 text-white/30 mx-auto" />
                  <p className="text-xs text-white/40">Drag & drop or click</p>
                  <p className="text-[10px] text-pink-400/60">Background removed automatically</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
            {cutoutUrl && (
              <button
                onClick={() => setUseOriginal((p) => !p)}
                className={`w-full py-1.5 text-[11px] rounded-lg border transition-colors ${
                  useOriginal
                    ? "border-white/15 text-white/35 bg-white/5"
                    : "border-pink-500/40 text-pink-400 bg-pink-500/10"
                }`}
              >
                {useOriginal ? "Showing: Original" : "Showing: Background removed"}
              </button>
            )}
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Background</Label>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["photo", "colour"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBgType(t)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${
                    bgType === t
                      ? "bg-pink-600 text-white"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  {t === "photo" ? "Full bleed photo" : "Brand colour"}
                </button>
              ))}
            </div>

            {bgType === "photo" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest">
                    Overlay darkness
                  </span>
                  <span className="text-[10px] font-mono text-white/30">{overlayOpacity}%</span>
                </div>
                <input
                  type="range" min={0} max={80} step={5} value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-pink-500 h-1.5"
                />
              </div>
            )}

            {bgType === "colour" && (
              <>
                <div className="flex items-center gap-2.5">
                  <label className="relative w-8 h-8 rounded-md overflow-hidden cursor-pointer border border-white/20 shrink-0">
                    <input
                      type="color" value={bgColour}
                      onChange={(e) => setBgColour(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <span className="absolute inset-0 rounded-md" style={{ background: bgColour }} />
                  </label>
                  <span className="text-xs font-mono text-white/40">{bgColour.toUpperCase()}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["#12121a","#0d1117","#1c1017","#101c17","#1a0f0a","#17171a","#0f0d1a"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColour(c)}
                      style={{ background: c }}
                      className="w-6 h-6 rounded-full border border-white/25 hover:scale-110 transition-transform"
                      title={c}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Words */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Words</Label>
              <button
                onClick={() => setWords((p) => [...p, ""])}
                disabled={words.length >= 12}
                className="text-[10px] text-pink-400/70 hover:text-pink-400 transition-colors disabled:opacity-30"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1.5">
              {words.map((word, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={word}
                    onChange={(e) =>
                      setWords((p) => p.map((w, j) => (j === i ? e.target.value : w)))
                    }
                    placeholder={`Word ${i + 1}…`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/40 transition-colors"
                  />
                  <button
                    onClick={() => setWords((p) => p.filter((_, j) => j !== i))}
                    className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Layout</Label>
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                {(["list", "grid"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setWordLayout(l)}
                    className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${
                      wordLayout === l
                        ? "bg-pink-600 text-white"
                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {l === "list" ? "One per line" : "2 columns"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Font size</span>
                <span className="text-[10px] font-mono text-white/30">{wordFontSize}px</span>
              </div>
              <input
                type="range" min={36} max={130} step={2} value={wordFontSize}
                onChange={(e) => setWordFontSize(Number(e.target.value))}
                className="w-full accent-pink-500 h-1.5"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">
                  Word spacing
                </span>
                <span className="text-[10px] font-mono text-white/30">{wordSpacing.toFixed(1)}×</span>
              </div>
              <input
                type="range" min={1.2} max={4.0} step={0.1} value={wordSpacing}
                onChange={(e) => setWordSpacing(Number(e.target.value))}
                className="w-full accent-pink-500 h-1.5"
              />
            </div>
          </div>

          {/* Border */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Border</Label>
            <button
              onClick={() => setBorderEnabled((p) => !p)}
              className={`w-full py-1.5 text-[11px] rounded-lg border transition-colors ${
                borderEnabled
                  ? "border-white/40 text-white/70 bg-white/8"
                  : "border-white/10 text-white/30 bg-white/3"
              }`}
            >
              {borderEnabled ? "2px white border, inset 20px" : "No border"}
            </button>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-white/40">Format</Label>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(["post", "story"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-wide font-medium transition-colors ${
                    format === f
                      ? "bg-pink-600 text-white"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  {f === "post" ? "Post 4:5" : "Story 9:16"}
                </button>
              ))}
            </div>
          </div>

          {/* Client */}
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-white/40">Client</Label>
              <select
                value={selectedPresetId ?? ""}
                onChange={(e) =>
                  setSelectedPresetId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500/50 transition-colors"
              >
                <option value="">No client</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-white/8 pt-4 space-y-2.5">
            <Button
              onClick={handleDownload}
              disabled={exporting}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-medium h-8"
              size="sm"
            >
              {exporting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Exporting…</>
              ) : (
                <><Download className="w-3.5 h-3.5 mr-1.5" />Download PNG</>
              )}
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={scheduleRendering}
              className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white/80 hover:text-white text-xs font-medium h-8 border border-white/10"
              size="sm"
            >
              {scheduleRendering ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Preparing…</>
              ) : (
                <><CalendarClock className="w-3.5 h-3.5 mr-1.5" />Schedule</>
              )}
            </Button>
          </div>

        </aside>

        {/* ── Canvas preview ──────────────────────────────────────────────── */}
        <main className="flex-1 flex items-center justify-center bg-[#080808] overflow-auto p-8">
          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={previewRef}
              className="rounded-xl shadow-2xl shadow-black/60"
              style={{ width: PW, height: PH }}
            />
            <p className="text-[10px] text-white/20 uppercase tracking-widest">
              {format === "post" ? "1080 × 1350" : "1080 × 1920"} · DM Serif Display
            </p>
          </div>
        </main>

      </div>

      {scheduleOpen && (
        <ScheduleModal
          presetId={selectedPresetId}
          presetName={presets.find((p) => p.id === selectedPresetId)?.name}
          postType="about-me"
          posts={schedulePosts}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}
