import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Sparkles, Loader2, Download, ShieldCheck, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { usePresets } from "@/lib/use-presets";
import { loadGoogleFonts } from "@/lib/slide-utils";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1080;

const SUGGESTED = [
  "brain fog", "lost reading glasses", "the 9pm sofa coma",
  "getting ready vs 20 years ago", "a cup of tea gone cold", "knees forecasting the weather",
];

export default function MemeGenerator() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [topic, setTopic] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [generating, setGenerating] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [fontSize, setFontSize] = useState(60);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const genLines = async () => {
    if (!topic.trim()) { toast.error("Type a topic first"); return; }
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/meme/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Failed"); }
      const { lines: out } = await r.json() as { lines: string[] };
      setLines(out);
      if (out[0]) setSelected(out[0]);
    } catch (e: any) {
      toast.error(e?.message || "Could not write lines");
    } finally {
      setGenerating(false);
    }
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, W, H);
    if (photo) {
      const ar = photo.width / photo.height;
      let dw = W, dh = H, dx = 0, dy = 0;
      if (ar > 1) { dh = H; dw = H * ar; dx = (W - dw) / 2; }
      else { dw = W; dh = W / ar; dy = (H - dh) / 2; }
      ctx.drawImage(photo, dx, dy, dw, dh);
    }
    const text = selected.trim();
    if (text) {
      ctx.textAlign = "center";
      ctx.font = `700 ${fontSize}px "Poppins", "Arial Black", sans-serif`;
      const maxW = W - 120;
      const words = text.split(/\s+/);
      const wrapped: string[] = [];
      let cur = "";
      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(t).width > maxW && cur) { wrapped.push(cur); cur = w; }
        else cur = t;
      }
      if (cur) wrapped.push(cur);
      const lineH = fontSize * 1.2;
      const totalH = wrapped.length * lineH;
      const pad = 36;
      const blockTop = position === "bottom" ? H - totalH - 80 : 60;
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(0, blockTop - pad / 2, W, totalH + pad);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = Math.max(4, fontSize / 9);
      ctx.lineJoin = "round";
      ctx.textBaseline = "top";
      let y = blockTop;
      for (const ln of wrapped) {
        ctx.strokeText(ln, W / 2, y);
        ctx.fillText(ln, W / 2, y);
        y += lineH;
      }
    }
  }, [photo, selected, fontSize, position]);

  useEffect(() => {
    render();
    const t = setTimeout(render, 250);
    return () => clearTimeout(t);
  }, [render]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `meme-${Date.now()}.png`;
    a.click();
  };

  const saveToLibrary = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    if (!photo) { toast.error("Add a photo first"); return; }
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const up = await fetch(`${BASE}/api/content/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ name: `meme-${Date.now()}.png`, base64: dataUrl }] }),
      });
      if (!up.ok) throw new Error("Image upload failed");
      const { results } = await up.json() as { results: { url: string }[] };
      const url = results[0]?.url;
      if (!url) throw new Error("No image URL returned");
      const lib = await fetch(`${BASE}/api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, postType: "single", caption: selected, mediaUrl: url, metadata: { source: "meme", topic } }),
      });
      if (!lib.ok) throw new Error("Save failed");
      toast.success(`Saved to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Meme Maker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Kind, funny memes for women over 40. Your photo, your voice, never a wrinkle in sight.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Choose a client</h2>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Add a photo</h2>
            <p className="text-xs text-muted-foreground">A relatable scene or object works best. The cold cup of tea, the cluttered handbag, the stairs.</p>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{photo ? "Photo loaded. Click to change." : "Click or drop a photo"}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ""; }} />
            <ApprovedImagesPicker
              clientName={clientName || undefined}
              label="Use an approved photo"
              mode="single"
              onAddImages={(files) => { if (files[0]) loadFile(files[0]); }}
            />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Write the funny bit</h2>
            <div className="flex gap-2">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A topic, e.g. brain fog, school run, lost glasses"
                onKeyDown={(e) => { if (e.key === "Enter") genLines(); }} />
              <Button onClick={genLines} disabled={generating} className="shrink-0">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="ml-1.5">Write lines</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => setTopic(s)} className="text-xs rounded-full px-2.5 py-1 bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">{s}</button>
              ))}
            </div>
            {lines.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {lines.map((l, i) => (
                  <button key={i} onClick={() => setSelected(l)}
                    className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-colors ${selected === l ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"}`}>
                    {l}
                  </button>
                ))}
                <button onClick={genLines} disabled={generating} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
                  <RefreshCcw className="w-3 h-3" /> Write me some more
                </button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">4. Tweak it</h2>
            <Label className="text-xs text-muted-foreground">Caption (edit freely)</Label>
            <textarea value={selected} onChange={(e) => setSelected(e.target.value)} rows={2}
              className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Text</Label>
                <Button variant={position === "top" ? "default" : "outline"} size="sm" onClick={() => setPosition("top")}>Top</Button>
                <Button variant={position === "bottom" ? "default" : "outline"} size="sm" onClick={() => setPosition("bottom")}>Bottom</Button>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Label className="text-xs text-muted-foreground">Size</Label>
                <input type="range" min={36} max={96} step={2} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 cursor-pointer" />
              </div>
            </div>
          </section>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
            <canvas ref={canvasRef} className="w-full block" style={{ aspectRatio: "1 / 1" }} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={download} disabled={!photo} className="flex-1">
              <Download className="w-4 h-4 mr-1.5" /> Download
            </Button>
            <Button onClick={saveToLibrary} disabled={saving || !photo} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save to library
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Square format, ready for the grid.</p>
        </div>
      </div>
    </div>
  );
}
