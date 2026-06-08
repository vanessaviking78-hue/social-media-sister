import { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { ScheduleModal } from "@/components/schedule-modal";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SCALE = 2;

type SlideData = { text: string; isHero: boolean };
type Phase = "upload" | "preview";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
    else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function parseOverlayColor(color: string): string {
  if (color.startsWith("rgba") || color.startsWith("rgb")) return color;
  if (color.startsWith("#")) {
    const h = color.slice(1).padEnd(6, "0");
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},0.5)`;
  }
  return color;
}

function drawCornerDecoration(ctx: CanvasRenderingContext2D, style: string, color: string) {
  if (!style || style === "none") return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const S = 180;
  if (style === "triangle") {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(0, S); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W - S, H); ctx.lineTo(W, H - S); ctx.closePath(); ctx.fill();
  } else if (style === "arc") {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, S, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, H, S, Math.PI, 1.5 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W, 0, S, 0.5 * Math.PI, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, H, S, 1.5 * Math.PI, 2 * Math.PI); ctx.stroke();
  } else if (style === "double-line") {
    ctx.lineWidth = 4;
    [0, 12].forEach(off => { ctx.strokeRect(30 + off, 30 + off, W - 2 * (30 + off), H - 2 * (30 + off)); });
  } else if (style === "frame") {
    ctx.lineWidth = 5;
    const L = 120, M = 40;
    ctx.beginPath();
    ctx.moveTo(M, M + L); ctx.lineTo(M, M); ctx.lineTo(M + L, M);
    ctx.moveTo(W - M - L, M); ctx.lineTo(W - M, M); ctx.lineTo(W - M, M + L);
    ctx.moveTo(W - M, H - M - L); ctx.lineTo(W - M, H - M); ctx.lineTo(W - M - L, H - M);
    ctx.moveTo(M + L, H - M); ctx.lineTo(M, H - M); ctx.lineTo(M, H - M - L);
    ctx.stroke();
  }
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  position: string,
  size: number,
) {
  if (!position || position === "none") return;
  const PAD = 44;
  const asp = logoImg.naturalWidth / logoImg.naturalHeight;
  const lw = asp >= 1 ? size : size * asp;
  const lh = asp >= 1 ? size / asp : size;
  let x = 0, y = 0;
  if (position === "top-left")       { x = PAD;          y = PAD; }
  else if (position === "top-right") { x = W - lw - PAD; y = PAD; }
  else if (position === "bottom-left"){ x = PAD;          y = H - lh - PAD; }
  else                               { x = W - lw - PAD; y = H - lh - PAD; }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logoImg, x, y, lw, lh);
  ctx.globalAlpha = 1;
}

function renderSlide(
  slide: SlideData,
  preset: ClientPreset,
  logoImg: HTMLImageElement | null,
  scale = SCALE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = preset.pageColor || "#000000";
  ctx.fillRect(0, 0, W, H);

  const overlay = parseOverlayColor(preset.overlayColor || "rgba(0,0,0,0.5)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  drawCornerDecoration(ctx, preset.cornerStyle || "none", preset.cornerColor || "#d4af37");

  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle    = preset.textColor || "#ffffff";
  ctx.shadowColor  = "rgba(0,0,0,0.75)";
  ctx.shadowBlur   = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  if (slide.isHero) {
    const size  = 120;
    const lineH = Math.round(size * 1.15);
    ctx.font = `700 ${size}px 'Bebas Neue', sans-serif`;
    const lines    = wrapText(ctx, slide.text.toUpperCase(), W - 120);
    const totalH   = lines.length * lineH;
    let y = Math.round(H / 2 - totalH / 2);
    for (const line of lines) { ctx.fillText(line, W / 2, y); y += lineH; }
  } else {
    const size  = 52;
    const lineH = Math.round(size * 1.5);
    ctx.font = `400 ${size}px 'Prata', serif`;
    const lines    = wrapText(ctx, slide.text, W - 160);
    const totalH   = lines.length * lineH;
    let y = Math.round(H / 2 - totalH / 2);
    for (const line of lines) { ctx.fillText(line, W / 2, y); y += lineH; }
  }

  if (logoImg) {
    drawLogo(ctx, logoImg, preset.logoPosition || "bottom-right", preset.logoSize || 110);
  }

  return canvas.toDataURL("image/png");
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function uploadDataUrls(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 4;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((du, j) => ({ name: names[i + j], base64: du }));
    const res  = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

async function warmFonts() {
  await Promise.allSettled([
    document.fonts.load("700 120px 'Bebas Neue', sans-serif"),
    document.fonts.load("400 52px 'Prata', serif"),
  ]);
}

async function loadPresetLogo(preset: ClientPreset): Promise<HTMLImageElement | null> {
  if (!preset.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CsvSlideCarousel() {
  const { presets, loading: presetsLoading } = usePresets();
  const [phase, setPhase] = useState<Phase>("upload");

  const [csvFile,          setCsvFile]          = useState<File | null>(null);
  const [slides,           setSlides]           = useState<SlideData[]>([]);
  const [csvError,         setCsvError]         = useState<string | null>(null);
  const [csvDrag,          setCsvDrag]          = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  const [thumbs,           setThumbs]           = useState<string[]>([]);
  const [rendering,        setRendering]        = useState(false);
  const [exporting,        setExporting]        = useState(false);
  const [scheduling,       setScheduling]       = useState(false);
  const [showSchedule,     setShowSchedule]     = useState(false);
  const [scheduleUrls,     setScheduleUrls]     = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? null;

  // ── CSV parsing ───────────────────────────────────────────────────────────────

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;
        if (!rows.length) { setCsvError("CSV is empty"); return; }
        const dataRows = rows.slice(1); // skip header row
        if (!dataRows.length) { setCsvError("No data rows after the header"); return; }
        const parsed: SlideData[] = dataRows.flatMap(row => {
          const raw = (Array.isArray(row) ? row[0] : String(row)).trim();
          if (!raw) return [];
          return [{ text: raw.startsWith("|") ? raw.slice(1).trimStart() : raw, isHero: raw.startsWith("|") }];
        });
        if (!parsed.length) { setCsvError("No valid text rows found"); return; }
        setSlides(parsed);
        setCsvFile(file);
      },
      error: (err: Error) => setCsvError(err.message),
    });
  }, []);

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) parseCsv(file);
  };

  // ── Thumbnail rendering ───────────────────────────────────────────────────────

  const renderThumbs = useCallback(async (preset: ClientPreset, slideList: SlideData[]) => {
    setRendering(true);
    try {
      await warmFonts();
      const logoImg = await loadPresetLogo(preset);
      setThumbs(slideList.map(s => renderSlide(s, preset, logoImg, 1)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedPreset) { toast.error("Select a client preset first"); return; }
    if (!slides.length)  { toast.error("Upload a CSV first"); return; }
    await renderThumbs(selectedPreset, slides);
    setPhase("preview");
  };

  const handlePresetSwitch = async (id: number) => {
    setSelectedPresetId(id);
    const p = presets.find(x => x.id === id);
    if (p && slides.length) await renderThumbs(p, slides);
  };

  // ── Export helpers ────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!selectedPreset) return;
    setExporting(true);
    try {
      await warmFonts();
      const logoImg = await loadPresetLogo(selectedPreset);
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const png = renderSlide(slides[i], selectedPreset, logoImg, SCALE);
        const b64 = png.split(",")[1];
        const tag = slides[i].isHero ? "hero" : "slide";
        zip.file(`${String(i + 1).padStart(3, "0")}-${tag}.png`, b64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `csv-slides-${Date.now()}.zip`);
      toast.success("ZIP downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedPreset) return;
    setScheduling(true);
    try {
      await warmFonts();
      const logoImg = await loadPresetLogo(selectedPreset);
      const dataUrls = slides.map(s => renderSlide(s, selectedPreset, logoImg, SCALE));
      const names    = slides.map((s, i) =>
        `${String(i + 1).padStart(3, "0")}-${s.isHero ? "hero" : "slide"}.png`,
      );
      const toastId = toast.loading(`Uploading ${slides.length} image${slides.length !== 1 ? "s" : ""}…`);
      const urls = await uploadDataUrls(dataUrls, names);
      toast.dismiss(toastId);
      setScheduleUrls(urls);
      setShowSchedule(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScheduling(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">CSV Slide Carousel</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ── Upload phase ── */}
        {phase === "upload" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">CSV Slide Carousel</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                Upload a CSV — each row becomes one branded slide. Rows starting with{" "}
                <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">|</code>{" "}
                become large Bebas Neue hero headlines. Everything else is body text in Prata.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* CSV drop zone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">CSV File</Label>
                <div
                  onDrop={handleCsvDrop}
                  onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                  onDragLeave={() => setCsvDrag(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3",
                    "cursor-pointer transition-colors select-none",
                    csvDrag  ? "border-sky-500/60 bg-sky-500/5" :
                    csvFile  ? "border-sky-500/40 bg-sky-500/5" :
                               "border-border/40 hover:border-border/60",
                  ].join(" ")}
                >
                  {csvFile ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-sky-400" />
                      <p className="text-sm font-medium text-sky-400">{csvFile.name}</p>
                      <p className="text-xs text-muted-foreground">{slides.length} slide{slides.length !== 1 ? "s" : ""} — click to replace</p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Any header. First column used.<br />
                        Prefix a row with <code className="font-mono">|</code> for a hero headline.
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) parseCsv(f);
                    e.target.value = "";
                  }}
                />
                {csvError && <p className="text-xs text-destructive">{csvError}</p>}
              </div>

              {/* Preset selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Client Preset</Label>
                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => setSelectedPresetId(Number(v))}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40">
                    <SelectValue placeholder={presetsLoading ? "Loading…" : "Select a client"} />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreset && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0"
                      style={{ background: selectedPreset.pageColor }}
                    />
                    <span className="text-xs text-muted-foreground truncate">{selectedPreset.fontFamily}</span>
                    {selectedPreset.logoUrl && (
                      <span className="text-xs text-muted-foreground">· logo attached</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Background colour, overlay, text colour, corner style and logo all come from the preset.
                </p>
              </div>
            </div>

            {/* Slide list preview */}
            {slides.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {slides.length} slide{slides.length !== 1 ? "s" : ""} parsed
                </p>
                <div className="bg-muted/20 border border-border/30 rounded-xl divide-y divide-border/20 max-h-60 overflow-y-auto">
                  {slides.slice(0, 30).map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}</span>
                      {s.isHero ? (
                        <span className="text-[9px] font-semibold uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded px-1.5 py-0.5 shrink-0">
                          Hero
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold uppercase tracking-widest bg-muted/40 text-muted-foreground rounded px-1.5 py-0.5 shrink-0">
                          Body
                        </span>
                      )}
                      <span className="text-sm text-foreground/80 truncate">{s.text}</span>
                    </div>
                  ))}
                  {slides.length > 30 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      …and {slides.length - 30} more
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!slides.length || !selectedPreset || rendering}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {rendering
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering…</>
                : "Generate Slides"}
            </Button>
          </div>
        )}

        {/* ── Preview phase ── */}
        {phase === "preview" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold mb-1">Preview</h2>
                <p className="text-muted-foreground text-sm">
                  {slides.length} slide{slides.length !== 1 ? "s" : ""} · {selectedPreset?.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setPhase("upload")}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />Back
                </Button>

                <Select
                  value={selectedPresetId ? String(selectedPresetId) : ""}
                  onValueChange={v => handlePresetSwitch(Number(v))}
                  disabled={rendering}
                >
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/40 w-44">
                    <SelectValue placeholder="Switch preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedPreset && renderThumbs(selectedPreset, slides)}
                  disabled={rendering || !selectedPreset}
                >
                  {rendering
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><RefreshCw className="w-4 h-4 mr-1.5" />Re-render</>}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={exporting || rendering}
                >
                  {exporting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Download className="w-4 h-4 mr-1.5" />ZIP</>}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSchedule}
                  disabled={scheduling || rendering}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  {scheduling
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                </Button>
              </div>
            </div>

            {rendering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering thumbnails…
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {thumbs.map((thumb, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border/30">
                  <img
                    src={thumb}
                    alt={`Slide ${i + 1}`}
                    className="w-full object-cover"
                    style={{ aspectRatio: `${W}/${H}` }}
                    draggable={false}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                    <span className="text-[10px] text-white/70 font-medium">{i + 1}</span>
                    {slides[i]?.isHero && (
                      <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                        Hero
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showSchedule && selectedPreset && (
        <ScheduleModal
          presetId={selectedPreset.id}
          presetName={selectedPreset.name}
          postType="carousel"
          posts={[{
            title:     `CSV Slides · ${selectedPreset.name}`,
            caption:   "",
            imageUrls: scheduleUrls,
          }]}
          onClose={() => setShowSchedule(false)}
          onSaved={() => setShowSchedule(false)}
          presets={presets.map(p => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
