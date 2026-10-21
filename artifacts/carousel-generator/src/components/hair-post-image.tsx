import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Images, Loader2, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1350;

// Hairdressers palette: deep plum ink, warm blush and copper.
const INK = "#1a1216";
const BLUSH = "#f6e9e4";
const COPPER = "#b8734a";

export type HairPostFields = {
  kind: "personal" | "facts" | "availability" | "beforeafter" | "tweet";
  hook: string;
  headline?: string;
  facts?: string[];
  beforeLabel?: string;
  afterLabel?: string;
  signOff?: string;
  replyWord: string;
};

type LibraryItem = { id: number; mediaUrl: string | null; mediaUrls: string[] | null; thumbnailUrl: string | null };

function resolve(src: string): string {
  return src.startsWith("/") ? `${BASE}${src}` : src;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => no(new Error("That photo would not load"));
    img.src = resolve(src);
  });
}

// Fills a box with the photo, cropped to fit and never filtered, so it stays exactly as it was taken.
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function lines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function drawLines(ctx: CanvasRenderingContext2D, ls: string[], x: number, y: number, lh: number): number {
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + ls.length * lh;
}

function frame(ctx: CanvasRenderingContext2D, colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
}

// The salon's logo when it has one, otherwise its name, centred near the foot of the picture.
function footer(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, name: string, ink: string) {
  if (logo) {
    const h = 120;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    ctx.drawImage(logo, W / 2 - w / 2, H - 70 - h, w, h);
  } else {
    ctx.fillStyle = ink;
    ctx.font = "600 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(name.toUpperCase(), W / 2, H - 90);
  }
}

function draw(
  cv: HTMLCanvasElement,
  p: HairPostFields,
  photoA: HTMLImageElement | null,
  photoB: HTMLImageElement | null,
  logo: HTMLImageElement | null,
  salon: string,
  availability: string,
) {
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if (p.kind === "personal") {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    if (photoA) cover(ctx, photoA, 0, 0, W, 1010);
    ctx.fillStyle = COPPER;
    ctx.fillRect(0, 1010, W, 6);
    ctx.fillStyle = BLUSH;
    ctx.font = "italic 50px Georgia";
    const ls = lines(ctx, p.hook, 900).slice(0, 4);
    drawLines(ctx, ls, W / 2, 1090, 62);
    ctx.fillStyle = COPPER;
    ctx.font = "600 26px Arial";
    ctx.fillText(salon.toUpperCase(), W / 2, H - 36);
    return;
  }

  if (p.kind === "facts") {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    frame(ctx, COPPER);
    ctx.fillStyle = COPPER;
    ctx.font = "600 28px Arial";
    ctx.fillText("HAIR FACTS", W / 2, 130);
    ctx.fillStyle = BLUSH;
    ctx.font = "bold 84px Georgia";
    let y = drawLines(ctx, lines(ctx, p.headline || "Did you know", 860).slice(0, 3), W / 2, 240, 98);
    ctx.fillStyle = COPPER;
    ctx.fillRect(W / 2 - 60, y - 40, 120, 4);
    y += 40;
    (p.facts ?? []).slice(0, 3).forEach((f, i) => {
      ctx.textAlign = "left";
      ctx.fillStyle = COPPER;
      ctx.font = "bold 64px Georgia";
      ctx.fillText(String(i + 1), 110, y + 8);
      ctx.fillStyle = BLUSH;
      ctx.font = "36px Georgia";
      y = drawLines(ctx, lines(ctx, f, 780).slice(0, 4), 190, y, 46) + 44;
    });
    ctx.textAlign = "center";
    footer(ctx, logo, salon, COPPER);
    return;
  }

  if (p.kind === "availability") {
    ctx.fillStyle = BLUSH;
    ctx.fillRect(0, 0, W, H);
    frame(ctx, COPPER);
    ctx.fillStyle = COPPER;
    ctx.font = "600 28px Arial";
    ctx.fillText("APPOINTMENTS AVAILABLE", W / 2, 130);
    ctx.fillStyle = INK;
    ctx.font = "bold 92px Georgia";
    let y = drawLines(ctx, lines(ctx, p.headline || "A few gaps this week", 860).slice(0, 3), W / 2, 260, 106);
    ctx.fillStyle = COPPER;
    ctx.fillRect(W / 2 - 60, y - 50, 120, 4);
    y += 30;
    const slots = availability
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    ctx.font = "40px Georgia";
    slots.forEach((s) => {
      ctx.fillStyle = COPPER;
      ctx.fillText("✦", W / 2 - ctx.measureText(s).width / 2 - 36, y);
      ctx.fillStyle = INK;
      ctx.fillText(s, W / 2, y);
      y += 66;
    });
    ctx.fillStyle = INK;
    ctx.font = "italic 36px Georgia";
    ctx.fillText(p.replyWord ? `Comment ${p.replyWord} and I'll send you the details` : "Message me and I'll send you the details", W / 2, H - 260);
    footer(ctx, logo, salon, INK);
    return;
  }

  // Before and after
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  frame(ctx, COPPER);
  const pw = 470;
  const ph = 640;
  const top = 250;
  const xs = [60, W - 60 - pw];
  [photoA, photoB].forEach((img, i) => {
    ctx.fillStyle = "#2a1d23";
    ctx.fillRect(xs[i], top, pw, ph);
    if (img) cover(ctx, img, xs[i], top, pw, ph);
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 3;
    ctx.strokeRect(xs[i], top, pw, ph);
  });
  ctx.fillStyle = COPPER;
  ctx.font = "600 36px Arial";
  ctx.fillText((p.beforeLabel || "Before").toUpperCase(), xs[0] + pw / 2, top - 36);
  ctx.fillText((p.afterLabel || "After").toUpperCase(), xs[1] + pw / 2, top - 36);
  ctx.fillStyle = BLUSH;
  ctx.font = "italic 50px Georgia";
  drawLines(ctx, lines(ctx, p.signOff || "", 900).slice(0, 2), W / 2, top + ph + 100, 62);
  footer(ctx, logo, salon, COPPER);
}

type Props = {
  post: HairPostFields;
  salon: string;
  logoUrl: string | null;
  availability: string;
  caption: string;
  onSchedule: (canvas: HTMLCanvasElement) => Promise<void>;
};

// The picture for one post: pick or upload the photos, see it drawn, then download it or schedule it.
export default function HairPostImage({ post, salon, logoUrl, availability, caption, onSchedule }: Props) {
  const needsPhotos = post.kind === "personal" ? 1 : post.kind === "beforeafter" ? 2 : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoA, setPhotoA] = useState<HTMLImageElement | null>(null);
  const [photoB, setPhotoB] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [library, setLibrary] = useState<LibraryItem[] | null>(null);
  const [pickFor, setPickFor] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!logoUrl) {
      setLogo(null);
      return;
    }
    loadImg(logoUrl).then(setLogo).catch(() => setLogo(null));
  }, [logoUrl]);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, post, photoA, photoB, logo, salon, availability);
  }, [post, photoA, photoB, logo, salon, availability]);

  const openLibrary = useCallback(
    async (slot: "A" | "B") => {
      setPickFor(slot);
      if (library) return;
      try {
        const r = await fetch(`${BASE}/api/library?clientName=${encodeURIComponent(salon)}`);
        const data = await r.json();
        const items: LibraryItem[] = (data.items ?? []).filter((it: LibraryItem) => {
          const u = (it.mediaUrl ?? it.mediaUrls?.[0] ?? "").toLowerCase();
          return u && !/\.(mp4|mov|m4v|avi)(\?|$)/.test(u);
        });
        setLibrary(items);
      } catch {
        toast.error("Could not load the library");
        setLibrary([]);
      }
    },
    [library, salon],
  );

  async function choose(slot: "A" | "B", src: string) {
    try {
      const img = await loadImg(src);
      (slot === "A" ? setPhotoA : setPhotoB)(img);
      setPickFor(null);
    } catch (e: any) {
      toast.error(e?.message || "That photo would not load");
    }
  }

  function upload(slot: "A" | "B", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    const url = URL.createObjectURL(file);
    loadImg(url)
      .then((img) => (slot === "A" ? setPhotoA(img) : setPhotoB(img)))
      .catch(() => toast.error("That photo would not load"));
  }

  const ready = photoA !== null && (needsPhotos < 2 || photoB !== null);

  function download() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/jpeg", 0.92);
    a.download = `${salon.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${post.kind}.jpg`;
    a.click();
  }

  async function schedule() {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      await onSchedule(canvasRef.current);
    } finally {
      setBusy(false);
    }
  }

  const slots: ("A" | "B")[] = needsPhotos === 2 ? ["A", "B"] : needsPhotos === 1 ? ["A"] : [];
  const slotName = (s: "A" | "B") => (needsPhotos === 2 ? (s === "A" ? "Before photo" : "After photo") : "Photo");
  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50";

  return (
    <div className="rounded-xl border border-border/30 p-4 space-y-3">
      <h3 className="text-sm font-semibold">The picture</h3>

      {slots.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {slots.map((s) => (
            <div key={s} className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{slotName(s)}{(s === "A" ? photoA : photoB) ? " added" : ""}</div>
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => openLibrary(s)}>
                  <Images className="w-3.5 h-3.5" /> From library
                </button>
                <label className={`${btn} cursor-pointer`}>
                  <ImagePlus className="w-3.5 h-3.5" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(s, e.target.files?.[0])} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {pickFor && (
        <div className="rounded-lg border border-zinc-700 p-3 space-y-2">
          <div className="flex items-center">
            <span className="text-sm font-medium">Pick from {salon}'s library</span>
            <button type="button" onClick={() => setPickFor(null)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {library === null ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : library.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos in this client's library yet. Upload one instead.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {library.map((it) => {
                const full = it.mediaUrl ?? it.mediaUrls?.[0] ?? "";
                return (
                  <button key={it.id} type="button" onClick={() => choose(pickFor, full)} className="aspect-[4/5] overflow-hidden rounded-md border border-zinc-700 hover:border-amber-400">
                    <img src={resolve(it.thumbnailUrl || full)} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="w-full max-w-sm rounded-lg border border-zinc-700" style={{ aspectRatio: `${W} / ${H}` }} />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={download} disabled={!ready && needsPhotos > 0}>
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        <button
          type="button"
          onClick={schedule}
          disabled={busy || (!ready && needsPhotos > 0) || !caption.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-black px-3 py-1.5 text-sm font-medium hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />} Schedule
        </button>
        {!ready && needsPhotos > 0 && <span className="text-xs text-muted-foreground self-center">Add {needsPhotos === 2 ? "both photos" : "a photo"} first</span>}
      </div>
    </div>
  );
}
