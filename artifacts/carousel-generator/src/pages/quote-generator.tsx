import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadGoogleFonts } from "@/lib/slide-utils";

loadGoogleFonts();

const W = 1080;
const H = 1350;

const BG_SWATCHES = ["#E91976", "#111111", "#0F4C5C", "#F4A259", "#5B8E7D", "#8367C7", "#1B998B", "#2E2E2E"];

const FONTS = [
  { label: "Poppins (bold sans)", value: '"Poppins", sans-serif' },
  { label: "Montserrat", value: '"Montserrat", sans-serif' },
  { label: "Oswald (condensed)", value: '"Oswald", sans-serif' },
  { label: "Bebas Neue (tall caps)", value: '"Bebas Neue", sans-serif' },
  { label: "Playfair Display (serif)", value: '"Playfair Display", serif' },
  { label: "Cormorant Garamond (elegant)", value: '"Cormorant Garamond", serif' },
  { label: "DM Serif Display", value: '"DM Serif Display", serif' },
  { label: "Abril Fatface (bold serif)", value: '"Abril Fatface", serif' },
  { label: "Yeseva One", value: '"Yeseva One", serif' },
  { label: "Cinzel (classic caps)", value: '"Cinzel", serif' },
  { label: "Dancing Script (script)", value: '"Dancing Script", cursive' },
  { label: "Great Vibes (script)", value: '"Great Vibes", cursive' },
];

export default function QuoteGenerator() {
  const [quotes, setQuotes] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [bgColor, setBgColor] = useState("#E91976");
  const [textColor, setTextColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#ffffff");
  const [showAccent, setShowAccent] = useState(true);
  const [fontSize, setFontSize] = useState(78);
  const [font, setFont] = useState('"Poppins", sans-serif');
  const [subtitle, setSubtitle] = useState("");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const onCsv = (file: File) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = (res.data as string[][])
          .map((r) => (r[0] || "").trim())
          .filter((q) => q.length > 0 && q.toLowerCase() !== "quote" && q.toLowerCase() !== "quotes");
        setQuotes(rows);
        setIdx(0);
        if (!rows.length) toast.error("No quotes found in that CSV (put one quote per row)");
        else toast.success(`${rows.length} quote${rows.length !== 1 ? "s" : ""} loaded`);
      },
      error: () => toast.error("Could not read that CSV"),
    });
  };

  const loadBg = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const drawQuote = useCallback((ctx: CanvasRenderingContext2D, text: string) => {
    ctx.clearRect(0, 0, W, H);
    if (bgImage) {
      const ar = bgImage.width / bgImage.height;
      let dw = W, dh = H, dx = 0, dy = 0;
      if (ar > 1) { dh = H; dw = H * ar; dx = (W - dw) / 2; } else { dw = W; dh = W / ar; dy = (H - dh) / 2; }
      ctx.drawImage(bgImage, dx, dy, dw, dh);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    if (showAccent) {
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.9;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `900 ${Math.round(fontSize * 2.6)}px "Playfair Display", Georgia, serif`;
      ctx.fillText("“", W / 2, H * 0.26);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = textColor;
    ctx.font = `700 ${fontSize}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxW = W - 180;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const lineH = fontSize * 1.25;
    const totalH = lines.length * lineH;
    const centerOffset = showAccent ? H * 0.04 : 0;
    let y = H / 2 - totalH / 2 + lineH / 2 + centerOffset;
    for (const ln of lines) { ctx.fillText(ln, W / 2, y); y += lineH; }

    if (subtitle.trim()) {
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.font = `600 ${Math.round(fontSize * 0.42)}px ${font}`;
      const blockBottom = H / 2 + totalH / 2 + centerOffset;
      ctx.fillText(subtitle.trim(), W / 2, blockBottom + fontSize * 0.7);
      ctx.globalAlpha = 1;
    }
  }, [bgColor, textColor, accentColor, showAccent, fontSize, bgImage, font, subtitle]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const text = quotes[idx] || "Your quotes will appear here. Drop in a CSV with one quote per row to begin.";
    drawQuote(ctx, text);
    const t = setTimeout(() => drawQuote(ctx, text), 250);
    return () => clearTimeout(t);
  }, [quotes, idx, drawQuote]);

  const downloadOne = () => {
    const c = canvasRef.current;
    if (!c || !quotes.length) { toast.error("Load a CSV first"); return; }
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `quote-${idx + 1}.png`;
    a.click();
  };

  const downloadAll = async () => {
    if (!quotes.length) { toast.error("Load a CSV first"); return; }
    setRendering(true);
    try {
      const zip = new JSZip();
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const ctx = off.getContext("2d")!;
      for (let i = 0; i < quotes.length; i++) {
        drawQuote(ctx, quotes[i]);
        const blob = await new Promise<Blob | null>((r) => off.toBlob(r, "image/png"));
        if (blob) zip.file(`quote-${i + 1}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      saveAs(out, "quotes.zip");
      toast.success(`${quotes.length} quote${quotes.length !== 1 ? "s" : ""} downloaded`);
    } catch {
      toast.error("Download failed");
    } finally {
      setRendering(false);
    }
  };

  const ColourRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Quote Maker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Drop in a CSV of quotes, get bold bright quote cards.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Your quotes</h2>
            <p className="text-xs text-muted-foreground">A CSV with one quote per row. The first column is used.</p>
            <div
              onClick={() => csvRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onCsv(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{quotes.length ? `${quotes.length} quotes loaded — click to replace` : "Click or drop your CSV"}</p>
            </div>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onCsv(e.target.files[0]); e.target.value = ""; }} />
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-base">2. Background</h2>
            <div className="flex flex-wrap gap-2">
              {BG_SWATCHES.map((c) => (
                <button key={c} onClick={() => { setBgColor(c); setBgImage(null); }} className={`w-7 h-7 rounded-full border-2 ${bgColor === c && !bgImage ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground">Custom colour</Label>
              <input type="color" value={bgColor} onChange={(e) => { setBgColor(e.target.value); setBgImage(null); }} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
              <button onClick={() => bgRef.current?.click()} className="ml-auto inline-flex items-center gap-1.5 text-sm rounded-lg border border-border/40 px-3 py-1.5 hover:bg-muted/40">
                <ImageIcon className="w-4 h-4" /> {bgImage ? "Change photo" : "Use a photo"}
              </button>
              <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) loadBg(e.target.files[0]); e.target.value = ""; }} />
            </div>
            {bgImage && <button onClick={() => setBgImage(null)} className="text-xs text-muted-foreground hover:text-foreground">Remove photo, use colour</button>}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Colours and size</h2>
            <ColourRow label="Text colour" value={textColor} onChange={setTextColor} />
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm text-muted-foreground">Quote mark</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={showAccent} onChange={(e) => setShowAccent(e.target.checked)} className="cursor-pointer" />
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!showAccent} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5 disabled:opacity-40" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Text size</Label>
              <input type="range" min={44} max={120} step={2} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 cursor-pointer" />
              <span className="text-xs text-muted-foreground w-8">{fontSize}</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Font</Label>
              <select value={font} onChange={(e) => setFont(e.target.value)} className="flex-1 rounded-lg bg-muted/30 border border-border/30 text-sm px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50">
                {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-sm text-muted-foreground">Subtitle (optional, shown on every card)</Label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. your handle or a little tagline" className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
            <canvas ref={canvasRef} className="w-full block" style={{ aspectRatio: "1080 / 1350" }} />
          </div>
          {quotes.length > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="p-1.5 rounded-full border border-border/40 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs text-muted-foreground">{idx + 1} of {quotes.length}</span>
              <button onClick={() => setIdx((i) => Math.min(quotes.length - 1, i + 1))} disabled={idx >= quotes.length - 1} className="p-1.5 rounded-full border border-border/40 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadOne} disabled={!quotes.length} className="flex-1">
              <Download className="w-4 h-4 mr-1.5" /> This one
            </Button>
            <Button onClick={downloadAll} disabled={rendering || !quotes.length} className="flex-1">
              {rendering ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download all
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Portrait 1080 x 1350.</p>
        </div>
      </div>
    </div>
  );
}
