import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Download, ShieldCheck, RefreshCcw, FileSpreadsheet, Images, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import Papa from "papaparse";
import { readFileAsText, stripSlideCsvTitleRow } from "@/lib/csv-format";
import JSZip from "jszip";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;

type TweetRow = {
  name: string;
  handle: string;
  quote: string;
  bgUrl: string;
  stats: { comments: number; likes: number; shares: number };
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function randomStats() {
  return {
    comments: Math.floor(80 + Math.random() * 300),
    likes: Math.floor(4000 + Math.random() * 22000),
    shares: Math.floor(30 + Math.random() * 250),
  };
}

function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(n);
}

// Draws a simple, recognisable comment-bubble / heart / retweet glyph so the
// stats row reads as an authentic tweet without pulling in an icon library
// inside canvas.
function drawCommentIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.3);
  ctx.arc(x, y - s * 0.05, s * 0.42, Math.PI * 0.85, Math.PI * 2.4);
  ctx.lineTo(x - s * 0.05, y + s * 0.42);
  ctx.lineTo(x - s * 0.22, y + s * 0.2);
  ctx.closePath();
  ctx.stroke();
}
function drawHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, filled: boolean) {
  const r = s * 0.28;
  ctx.beginPath();
  ctx.arc(x - r, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.arc(x + r, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.moveTo(x - r * 1.9, y - r * 0.1);
  ctx.lineTo(x, y + r * 1.7);
  ctx.lineTo(x + r * 1.9, y - r * 0.1);
  ctx.closePath();
  if (filled) ctx.fill();
  else ctx.stroke();
}
function drawRetweetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y - s * 0.15);
  ctx.lineTo(x - s * 0.4, y - s * 0.4);
  ctx.lineTo(x + s * 0.25, y - s * 0.4);
  ctx.moveTo(x + s * 0.1, y - s * 0.55);
  ctx.lineTo(x + s * 0.4, y - s * 0.4);
  ctx.lineTo(x + s * 0.1, y - s * 0.25);
  ctx.moveTo(x + s * 0.4, y + s * 0.15);
  ctx.lineTo(x + s * 0.4, y + s * 0.4);
  ctx.lineTo(x - s * 0.25, y + s * 0.4);
  ctx.moveTo(x - s * 0.1, y + s * 0.55);
  ctx.lineTo(x - s * 0.4, y + s * 0.4);
  ctx.lineTo(x - s * 0.1, y + s * 0.25);
  ctx.stroke();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export default function TweetMaker() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [rows, setRows] = useState<TweetRow[]>([]);
  const [bgImages, setBgImages] = useState<HTMLImageElement[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [zipping, setZipping] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find((p) => p.name === clientName) ?? null;

  // Pull the clinic's own logo automatically from their preset, same convention
  // used across the other carousel tools, rather than asking Vanessa to upload it.
  useEffect(() => {
    if (selectedPreset?.logoUrl) {
      loadImg(selectedPreset.logoUrl).then(setLogoImg).catch(() => setLogoImg(null));
    } else {
      setLogoImg(null);
    }
  }, [selectedPreset?.logoUrl]);

  const loadProfilePhoto = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => setProfilePhoto(img);
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const parseCsv = (file: File) => {
    readFileAsText(file).then((raw) => {
    const normalized = stripSlideCsvTitleRow(raw, true);
    Papa.parse<string[]>(normalized, {
      skipEmptyLines: true,
      complete: (result) => {
        const dataRows = result.data.slice(1); // first row is the header
        if (!dataRows.length) { toast.error("No data rows found after the header"); return; }
        const parsed: TweetRow[] = dataRows
          .map((r) => {
            const cols = Array.isArray(r) ? r : [String(r)];
            return {
              name: (cols[0] ?? "").trim(),
              handle: (cols[1] ?? "").trim().replace(/^@/, ""),
              quote: (cols[2] ?? "").trim(),
              bgUrl: "",
              stats: randomStats(),
            };
          })
          .filter((r) => r.name || r.quote);
        if (!parsed.length) { toast.error("Couldn't find any usable rows in that CSV"); return; }
        setRows(parsed);
        setSelectedIndex(0);
        toast.success(`Loaded ${parsed.length} row${parsed.length !== 1 ? "s" : ""} from the CSV`);
      },
      error: (err: Error) => toast.error(err.message),
    });
    });
  };

  const loadBgFiles = async (files: File[]) => {
    const urls = files.map((f) => URL.createObjectURL(f));
    try {
      const imgs = await Promise.all(urls.map(loadImg));
      setBgImages(imgs);
      toast.success(`${imgs.length} background photo${imgs.length !== 1 ? "s" : ""} loaded`);
    } catch {
      toast.error("Some background photos couldn't be loaded");
    }
  };

  // Backgrounds are matched to rows in order; if there are fewer photos than
  // rows the last one repeats for whatever's left, same pattern as the other
  // bulk tools in the app.
  const bgForIndex = useCallback((i: number): HTMLImageElement | null => {
    if (!bgImages.length) return null;
    return bgImages[i] ?? bgImages[bgImages.length - 1];
  }, [bgImages]);

  const render = useCallback((canvas: HTMLCanvasElement | null, rowIndex: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    const row = rows[rowIndex];

    // Background
    const bg = bgForIndex(rowIndex);
    ctx.fillStyle = "#dfe7e6";
    ctx.fillRect(0, 0, W, H);
    if (bg) {
      const ar = bg.width / bg.height;
      let dw = W, dh = H, dx = 0, dy = 0;
      if (ar > W / H) { dh = H; dw = H * ar; dx = (W - dw) / 2; }
      else { dw = W; dh = W / ar; dy = (H - dh) / 2; }
      ctx.drawImage(bg, dx, dy, dw, dh);
    }

    if (row) {
      // Card
      const cardX = W * 0.09;
      const cardW = W * 0.82;
      const cardY = H * 0.235;
      const cardH = H * 0.45;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = "rgba(237, 240, 240, 0.94)";
      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
      ctx.fill();
      ctx.restore();

      const pad = cardW * 0.07;
      let cy = cardY + pad + 14;

      // Avatar
      const avR = 34;
      const avX = cardX + pad + avR;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX, cy + avR, avR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (profilePhoto) {
        const ar = profilePhoto.width / profilePhoto.height;
        const size = avR * 2;
        let dw = size, dh = size, dx = avX - avR, dy = cy;
        if (ar > 1) { dh = size; dw = size * ar; dx = avX - dw / 2; }
        else { dw = size; dh = size / ar; dy = cy - (dh - size) / 2; }
        ctx.drawImage(profilePhoto, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#c7cdcd";
        ctx.fillRect(avX - avR, cy, avR * 2, avR * 2);
      }
      ctx.restore();
      ctx.strokeStyle = "#3f9ee0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avX, cy + avR, avR, 0, Math.PI * 2);
      ctx.stroke();

      const textX = avX + avR + 20;

      // Name + verified tick
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f1419";
      ctx.font = "700 30px Arial, Helvetica, sans-serif";
      const nameW = ctx.measureText(row.name || "name").width;
      ctx.fillText(row.name || "name", textX, cy + 32);

      const tickX = textX + nameW + 12;
      const tickY = cy + 22;
      ctx.fillStyle = "#1d9bf0";
      ctx.beginPath();
      ctx.arc(tickX, tickY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tickX - 5, tickY);
      ctx.lineTo(tickX - 1, tickY + 5);
      ctx.lineTo(tickX + 6, tickY - 6);
      ctx.stroke();

      // "..." top right
      ctx.fillStyle = "#536471";
      const dotsX = cardX + cardW - pad;
      const dotsY = cy + 12;
      [0, 12, 24].forEach((o) => {
        ctx.beginPath();
        ctx.arc(dotsX - 24 + o, dotsY, 2.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Handle
      ctx.fillStyle = "#536471";
      ctx.font = "400 27px Arial, Helvetica, sans-serif";
      ctx.fillText(`@${row.handle || "clinicname"}`, textX, cy + 64);

      // Quote / body
      ctx.fillStyle = "#0f1419";
      ctx.font = "700 32px Arial, Helvetica, sans-serif";
      const quoteMaxW = cardW - pad * 2;
      const quoteLines = wrapText(ctx, (row.quote || "QUOTE THAT I WILL INCLUDE ON THE .CSV").toUpperCase(), quoteMaxW);
      let qy = cy + 130;
      for (const line of quoteLines) {
        ctx.fillText(line, cardX + pad, qy);
        qy += 40;
      }

      // Decorative upload badge (matches the reference template)
      const badgeY = qy + 30;
      const badgeX = cardX + cardW / 2;
      ctx.fillStyle = "#e0417a";
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(badgeX, badgeY + 8);
      ctx.lineTo(badgeX, badgeY - 8);
      ctx.moveTo(badgeX - 6, badgeY - 3);
      ctx.lineTo(badgeX, badgeY - 9);
      ctx.lineTo(badgeX + 6, badgeY - 3);
      ctx.stroke();

      // Divider
      const dividerY = cardY + cardH - 82;
      ctx.strokeStyle = "rgba(15,20,25,0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cardX + pad, dividerY);
      ctx.lineTo(cardX + cardW - pad, dividerY);
      ctx.stroke();

      // Stats row
      const statsY = dividerY + 42;
      ctx.strokeStyle = "#536471";
      ctx.fillStyle = "#536471";
      ctx.lineWidth = 2.5;
      ctx.font = "400 26px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";

      drawCommentIcon(ctx, cardX + pad + 12, statsY, 26);
      ctx.fillText(formatCount(row.stats.comments), cardX + pad + 40, statsY + 8);

      const heartX = cardX + pad + 190;
      drawHeartIcon(ctx, heartX, statsY, 26, false);
      ctx.fillText(formatCount(row.stats.likes), heartX + 28, statsY + 8);

      const rtX = cardX + pad + 370;
      drawRetweetIcon(ctx, rtX, statsY, 26);
      ctx.fillText(formatCount(row.stats.shares), rtX + 28, statsY + 8);
    }

    // Clinic logo, pulled from the preset, same placement convention as the
    // other carousel tools use.
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0 && selectedPreset) {
      const margin = 40;
      const logoSize = selectedPreset.logoSize || 120;
      const ar = logoImg.width / logoImg.height;
      const logoW = Math.round(logoSize * ar);
      const logoH = logoSize;
      let lx = W - logoW - margin, ly = margin;
      const pos = selectedPreset.logoPosition;
      if (pos === "bottom-left") { lx = margin; ly = H - logoH - margin; }
      else if (pos === "bottom-right") { lx = W - logoW - margin; ly = H - logoH - margin; }
      ctx.drawImage(logoImg, lx, ly, logoW, logoH);
    }
  }, [rows, bgForIndex, profilePhoto, logoImg, selectedPreset]);

  useEffect(() => {
    render(canvasRef.current, selectedIndex);
  }, [render, selectedIndex]);

  const shuffleStats = () => {
    setRows((prev) => prev.map((r, i) => (i === selectedIndex ? { ...r, stats: randomStats() } : r)));
  };

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `tweet-${(rows[selectedIndex]?.name || "graphic").replace(/\s+/g, "")}-${Date.now()}.png`;
    a.click();
  };

  const saveToLibrary = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const up = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: `tweet-${Date.now()}.png`, base64: dataUrl }] }),
      });
      if (!up.ok) throw new Error("Image upload failed");
      const { results } = await up.json() as { results: { url: string }[] };
      const url = results[0]?.url;
      if (!url) throw new Error("No image URL returned");
      const lib = await fetch(`${BASE}/api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, postType: "single", caption: rows[selectedIndex]?.quote || "", mediaUrl: url, metadata: { source: "tweet-maker" } }),
      });
      if (!lib.ok) throw new Error("Save failed");
      toast.success(`Saved to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadAll = async () => {
    if (!rows.length) { toast.error("Load a CSV first"); return; }
    setZipping(true);
    try {
      const zip = new JSZip();
      const offscreen = document.createElement("canvas");
      for (let i = 0; i < rows.length; i++) {
        render(offscreen, i);
        const blob = await canvasToBlob(offscreen);
        const safeName = (rows[i].name || `tweet-${i + 1}`).replace(/[^a-z0-9]/gi, "");
        zip.file(`${safeName || `tweet-${i + 1}`}.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `tweet-maker-batch-${Date.now()}.zip`;
      a.click();
      toast.success(`Zipped up ${rows.length} graphics`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't build the zip");
    } finally {
      setZipping(false);
    }
  };

  const saveAllToLibrary = async () => {
    if (!rows.length) { toast.error("Load a CSV first"); return; }
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    setSavingAll(true);
    try {
      const offscreen = document.createElement("canvas");
      let saved = 0;
      for (let i = 0; i < rows.length; i++) {
        render(offscreen, i);
        const dataUrl = offscreen.toDataURL("image/png");
        const up = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name: `tweet-${i}-${Date.now()}.png`, base64: dataUrl }] }),
        });
        if (!up.ok) continue;
        const { results } = await up.json() as { results: { url: string }[] };
        const url = results[0]?.url;
        if (!url) continue;
        const lib = await fetch(`${BASE}/api/library`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName, postType: "single", caption: rows[i].quote, mediaUrl: url, metadata: { source: "tweet-maker" } }),
        });
        if (lib.ok) saved++;
      }
      toast.success(`Saved ${saved} of ${rows.length} to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Batch save failed");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Tweet Maker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Authentic-looking tweet graphics, built from a CSV, one clinic's batch at a time.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Choose a client</h2>
            <p className="text-xs text-muted-foreground">Pulls their logo in automatically, no need to upload it.</p>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Profile photo</h2>
            <p className="text-xs text-muted-foreground">One photo, reused across the whole batch for this clinic.</p>
            <div
              onClick={() => profileFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadProfilePhoto(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{profilePhoto ? "Photo loaded. Click to change." : "Click or drop the profile photo"}</p>
            </div>
            <input ref={profileFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadProfilePhoto(e.target.files[0]); e.target.value = ""; }} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Upload the CSV</h2>
            <p className="text-xs text-muted-foreground">Columns, in order: name, clinic Instagram handle, quote. First row is treated as the header.</p>
            <div
              onClick={() => csvFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) parseCsv(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{rows.length ? `${rows.length} row${rows.length !== 1 ? "s" : ""} loaded. Click to replace.` : "Click or drop the CSV"}</p>
            </div>
            <input ref={csvFileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) parseCsv(e.target.files[0]); e.target.value = ""; }} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">4. Background photos</h2>
            <p className="text-xs text-muted-foreground">Upload one per row, in the same order as the CSV. Add fewer than rows and the last one repeats.</p>
            <div
              onClick={() => bgFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) loadBgFiles(Array.from(e.dataTransfer.files)); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <Images className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{bgImages.length ? `${bgImages.length} photo${bgImages.length !== 1 ? "s" : ""} loaded` : "Click or drop background photos"}</p>
            </div>
            <input ref={bgFileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) loadBgFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            {rows.length > 0 && bgImages.length > 0 && bgImages.length < rows.length && (
              <p className="text-[11px] text-amber-500">{bgImages.length} photo{bgImages.length !== 1 ? "s" : ""} for {rows.length} rows, the last photo repeats for the remaining {rows.length - bgImages.length}.</p>
            )}
          </section>

          {rows.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold text-base">5. Pick a row to preview</h2>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {rows.map((r, i) => (
                  <button key={i} onClick={() => setSelectedIndex(i)}
                    className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-colors ${selectedIndex === i ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"}`}>
                    <span className="font-medium">{r.name || "(no name)"}</span>
                    <span className="text-xs opacity-70"> @{r.handle || "handle"} — {r.quote.slice(0, 40)}{r.quote.length > 40 ? "…" : ""}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-border/30 bg-black/10 flex flex-col items-center justify-center gap-2 py-24" style={{ aspectRatio: "3 / 4" }}>
              <ImageOff className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Load a CSV to see a preview</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
              <canvas ref={canvasRef} className="w-full block" style={{ aspectRatio: "3 / 4" }} />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={shuffleStats} disabled={!rows.length} className="shrink-0">
              <RefreshCcw className="w-4 h-4 mr-1.5" /> Shuffle stats
            </Button>
            <Button variant="outline" onClick={download} disabled={!rows.length} className="flex-1">
              <Download className="w-4 h-4 mr-1.5" /> Download this one
            </Button>
            <Button onClick={saveToLibrary} disabled={saving || !rows.length} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save to library
            </Button>
          </div>
          <div className="rounded-xl border border-border/30 p-3 space-y-2">
            <p className="text-xs font-medium">Whole batch</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadAll} disabled={zipping || !rows.length} className="flex-1">
                {zipping ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download all as ZIP
              </Button>
              <Button onClick={saveAllToLibrary} disabled={savingAll || !rows.length} className="flex-1">
                {savingAll ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save all to library
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">Portrait 1080 x 1440, ready for the grid.</p>
        </div>
      </div>
    </div>
  );
}
