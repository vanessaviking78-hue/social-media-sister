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
import { usePresets } from "@/lib/use-presets";

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
  const [subs, setSubs] = useState<string[]>([]);
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoScale, setLogoScale] = useState(1.4);
  const [logoPos, setLogoPos] = useState({ x: W / 2, y: H - 150 });
  const [quoteScale, setQuoteScale] = useState(1);
  const [quoteOpenPos, setQuoteOpenPos] = useState({ x: W / 2, y: Math.round(H * 0.26) });
  const [quoteClosePos, setQuoteClosePos] = useState({ x: W / 2, y: Math.round(H * 0.8) });
  const draggingRef = useRef<null | "logo" | "qopen" | "qclose">(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const onCsv = (file: File) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = (res.data as string[][])
          .filter((r) => (r[0] || "").trim().length > 0 && (r[0] || "").trim().toLowerCase() !== "quote");
        setQuotes(rows.map((r) => (r[0] || "").trim()));
        setSubs(rows.map((r) => (r[1] || "").trim()));
        setIdx(0);
        if (!rows.length) toast.error("No quotes found (put the quote in column 1, who it's from in column 2)");
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

  const sameOrigin = (u: string) => { try { return window.location.origin + new URL(u).pathname; } catch { return u; } };
  useEffect(() => {
    const pp = presets.find((x) => x.name === clientName) as any;
    if (pp && pp.logoUrl) { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => setLogoImg(i); i.onerror = () => setLogoImg(null); i.src = sameOrigin(pp.logoUrl); }
    else setLogoImg(null);
  }, [clientName, presets]);

  const canvasXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  };
  const hitQuote = (x: number, y: number, pos: { x: number; y: number }) => {
    const qf = Math.round(fontSize * 2.6 * quoteScale); const qw = qf * 0.75, qh = qf * 0.9;
    return x >= pos.x - qw / 2 && x <= pos.x + qw / 2 && y >= pos.y - qh && y <= pos.y + qh * 0.25;
  };
  const onLogoDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e);
    if (logoImg) {
      const lh = 320 * logoScale, lw = lh * (logoImg.width / logoImg.height);
      if (x >= logoPos.x - lw / 2 && x <= logoPos.x + lw / 2 && y >= logoPos.y - lh / 2 && y <= logoPos.y + lh / 2) {
        draggingRef.current = "logo"; canvasRef.current?.setPointerCapture(e.pointerId); return;
      }
    }
    if (showAccent) {
      if (hitQuote(x, y, quoteOpenPos)) { draggingRef.current = "qopen"; canvasRef.current?.setPointerCapture(e.pointerId); return; }
      if (hitQuote(x, y, quoteClosePos)) { draggingRef.current = "qclose"; canvasRef.current?.setPointerCapture(e.pointerId); return; }
    }
  };
  const onLogoMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = draggingRef.current; if (!d) return;
    const pos = canvasXY(e);
    if (d === "logo") setLogoPos(pos); else if (d === "qopen") setQuoteOpenPos(pos); else if (d === "qclose") setQuoteClosePos(pos);
  };
  const onLogoUp = () => { draggingRef.current = null; };

  const drawQuote = useCallback((ctx: CanvasRenderingContext2D, text: string, subArg = "") => {
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
      const qf = Math.round(fontSize * 2.6 * quoteScale);
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.9;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `900 ${qf}px "Playfair Display", Georgia, serif`;
      ctx.fillText("\u201C", quoteOpenPos.x, quoteOpenPos.y);
      ctx.fillText("\u201D", quoteClosePos.x, quoteClosePos.y);
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

    const sub = (subArg && subArg.trim()) || subtitle.trim();
    if (sub) {
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.font = `600 ${Math.round(fontSize * 0.42)}px ${font}`;
      const blockBottom = H / 2 + totalH / 2 + centerOffset;
      ctx.fillText(sub, W / 2, blockBottom + fontSize * 0.7);
      ctx.globalAlpha = 1;
    }

    if (logoImg) {
      const lh = 320 * logoScale;
      const lw = lh * (logoImg.width / logoImg.height);
      ctx.globalAlpha = 1;
      ctx.drawImage(logoImg, logoPos.x - lw / 2, logoPos.y - lh / 2, lw, lh);
    }
  }, [bgColor, textColor, accentColor, showAccent, fontSize, bgImage, font, subtitle, logoImg, logoScale, logoPos, quoteScale, quoteOpenPos, quoteClosePos]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const text = quotes[idx] || "Your quotes will appear here. Drop in a CSV: column 1 the quote, column 2 who it is from.";
    drawQuote(ctx, text, subs[idx] || "");
    const t = setTimeout(() => drawQuote(ctx, text, subs[idx] || ""), 250);
    return () => clearTimeout(t);
  }, [quotes, subs, idx, drawQuote]);

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
        drawQuote(ctx, quotes[i], subs[i] || "");
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
            <p className="text-xs text-muted-foreground">A CSV with two columns: the quote, then who it is from.</p>
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
            {showAccent && (
              <div className="flex items-center gap-3 pt-1">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Quote mark size</Label>
                <input type="range" min={0.4} max={2.5} step={0.05} value={quoteScale} onChange={(e) => setQuoteScale(parseFloat(e.target.value))} className="flex-1 cursor-pointer" />
                <span className="text-xs text-muted-foreground">drag on preview</span>
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Font</Label>
              <select value={font} onChange={(e) => setFont(e.target.value)} className="flex-1 rounded-lg bg-muted/30 border border-border/30 text-sm px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50">
                {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-sm text-muted-foreground">Subtitle (optional, shown on every card)</Label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="fallback if a row has no name in column 2" className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Client logo</Label>
              <select value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">No logo</option>
                {presets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {logoImg && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Logo size</span>
                  <input type="range" min={0.3} max={6} step={0.1} value={logoScale} onChange={(e) => setLogoScale(parseFloat(e.target.value))} className="flex-1 cursor-pointer" />
                  <span className="text-xs text-muted-foreground">Drag it on the preview</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
            <canvas ref={canvasRef} onPointerDown={onLogoDown} onPointerMove={onLogoMove} onPointerUp={onLogoUp} className="w-full block" style={{ aspectRatio: "1080 / 1350", touchAction: "none", cursor: (logoImg || showAccent) ? "move" : "default" }} />
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
