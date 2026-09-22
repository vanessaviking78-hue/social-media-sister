import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Grid3x3, Upload, Download, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

// Every clinic grid post is 1080 wide. Three of them side by side is the
// banner — this tool never produces anything else, so the sizes are fixed
// rather than configurable.
const TILE_W = 1080;
const TILE_H = 1440;
const TILE_COUNT = 3;
const BANNER_W = TILE_W * TILE_COUNT; // 3240
const BANNER_H = TILE_H; // 1440

type Tile = { dataUrl: string; label: string; postOrder: number };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Centre-crops whatever gets uploaded (square, portrait, ultra-wide, doesn't
// matter) to fill the 3240x1440 banner canvas exactly, the same maths as
// CSS "object-fit: cover" — nothing ever comes out squashed or letterboxed.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = BANNER_W / BANNER_H;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, BANNER_W, BANNER_H);
}

// Slices the composed banner into exactly 3 tiles, each a perfect
// 1080x1440. Instagram fills its grid newest-post-first, left to right, so
// posting left-to-right in upload order would land the banner backwards —
// the tiles carry their real posting order (right tile first, left last)
// rather than left-to-right, so following the numbers on screen is all it
// takes to get it right.
function cutTiles(img: HTMLImageElement): Tile[] {
  const canvas = document.createElement("canvas");
  canvas.width = BANNER_W;
  canvas.height = BANNER_H;
  const ctx = canvas.getContext("2d")!;
  drawCover(ctx, img);

  const positions = [
    { key: "left", label: "Left tile" },
    { key: "middle", label: "Middle tile" },
    { key: "right", label: "Right tile" },
  ];

  return positions.map((pos, i) => {
    const t = document.createElement("canvas");
    t.width = TILE_W;
    t.height = TILE_H;
    t.getContext("2d")!.drawImage(canvas, i * TILE_W, 0, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H);
    // Right tile posts 1st, middle 2nd, left 3rd (last) — reverse of visual
    // left-to-right order.
    const postOrder = TILE_COUNT - i;
    return { dataUrl: t.toDataURL("image/png"), label: pos.label, postOrder };
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function BannerTool() {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [working, setWorking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("That's not an image file"); return; }
    setWorking(true);
    try {
      const img = await loadImage(file);
      setSourceUrl(img.src);
      setTiles(cutTiles(img));
      toast.success("Cut into 3 tiles — right tile posts first.");
    } catch {
      toast.error("Couldn't read that image, try another file");
    } finally {
      setWorking(false);
    }
  }, []);

  function reset() {
    setSourceUrl(null);
    setTiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadAllZip() {
    if (!tiles.length) return;
    const zip = new JSZip();
    tiles.forEach((t) => {
      zip.file(`banner-post${t.postOrder}-${t.label.toLowerCase().replace(" ", "-")}.png`, t.dataUrl.split(",")[1], { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "banner-tiles.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const sortedForPosting = [...tiles].sort((a, b) => a.postOrder - b.postOrder);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Grid3x3 size={22} className="text-cyan-400" /> Banner Tool
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Upload one image and it cuts perfectly into 3 tiles at 1080 x 1440 each — post them in the order shown and the grid reads as one seamless banner.
            </p>
          </div>
        </div>

        {!sourceUrl ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={`block border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors ${
              dragOver ? "border-cyan-500 bg-cyan-500/5" : "border-zinc-800 hover:border-cyan-500/60"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
            <Upload className="mx-auto mb-3 text-zinc-600" size={32} />
            <p className="text-lg font-medium">{working ? "Cutting…" : "Drop an image here, or click to upload"}</p>
            <p className="text-sm text-zinc-500 mt-1">Any size or shape — it gets centred and cropped to fill the banner, no distortion.</p>
          </label>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-zinc-500">How it'll look on the grid</p>
              <button onClick={reset} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
                <X size={13} /> Start over
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden border border-zinc-800">
              {tiles.map((t) => (
                <img key={t.label} src={t.dataUrl} alt={t.label} className="w-full aspect-[3/4] object-cover" />
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Post in this order</p>
                <button
                  onClick={downloadAllZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  <Download size={13} /> Download all (ZIP)
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Instagram puts your newest post top-left, so to make the banner land left-to-right you post the <strong>right</strong> tile first and the <strong>left</strong> tile last.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {sortedForPosting.map((t, i) => (
                  <div key={t.label} className="flex items-center gap-3">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden w-32">
                      <img src={t.dataUrl} alt={t.label} className="w-full aspect-[3/4] object-cover" />
                      <div className="p-2 space-y-1.5">
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{t.postOrder}</span>
                          {t.label}
                        </p>
                        <button
                          onClick={() => downloadDataUrl(t.dataUrl, `banner-post${t.postOrder}-${t.label.toLowerCase().replace(" ", "-")}.png`)}
                          className="w-full flex items-center justify-center gap-1 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px]"
                      >
                        <Download size={11} /> Save
                      </button>
                    </div>
                  </div>
                  {i < sortedForPosting.length - 1 && <ArrowRight size={16} className="text-zinc-700 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
 );
}
