import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Download, Sparkles, CalendarClock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import JSZip from "jszip";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { usePresets } from "@/lib/use-presets";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const STORY_H = 1920;

type Slide = {
  id: string;
  img: HTMLImageElement;
  /** Cover: the headline. Other slides: the words on the slide. Can be left empty. */
  text: string;
  /** Cover only. */
  sub: string;
  /** Where the photo sits inside the frame, 0 to 1 on each axis (0.5 is centred). */
  fx: number;
  fy: number;
};

type GradientDir = "bottom" | "top" | "both" | "full";
type TextPos = "top" | "middle" | "bottom";
type FontOpt = { label: string; value: string };

const uid = () => Math.random().toString(36).slice(2, 10);

// No em dashes or spaced en dashes in any caption.
const noDashes = (t: string) =>
  t.replace(/(\d)–(\d)/g, "$1-$2").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth) { out.push(line); line = words[i]; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export default function Slideshow() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const preset = presets.find((p) => p.name === clientName) ?? null;
  const [area, setArea] = useState("");
  useEffect(() => { setArea(preset?.seoArea?.trim() || ""); }, [preset?.id, preset?.seoArea]);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontFileRef = useRef<HTMLInputElement>(null);

  // Gradient
  const [gradientOn, setGradientOn] = useState(true);
  const [gradientColour, setGradientColour] = useState("#000000");
  const [gradientDir, setGradientDir] = useState<GradientDir>("bottom");
  const [gradientStrength, setGradientStrength] = useState(70);

  // Fonts and text
  const [customFonts, setCustomFonts] = useState<FontOpt[]>([]);
  const [coverFont, setCoverFont] = useState("'Playfair Display', serif");
  const [bodyFont, setBodyFont] = useState("'Montserrat', sans-serif");
  const [textColour, setTextColour] = useState("#ffffff");
  const [textPos, setTextPos] = useState<TextPos>("bottom");
  const [coverSize, setCoverSize] = useState(110);
  const [bodySize, setBodySize] = useState(64);
  const [fontsReady, setFontsReady] = useState(0);
  const fontOptions: FontOpt[] = [...customFonts, ...FONT_OPTIONS];

  // Caption
  const [brief, setBrief] = useState("");
  const [caption, setCaption] = useState("");
  const [captioning, setCaptioning] = useState(false);

  // Scheduling
  const [alsoStory, setAlsoStory] = useState(true);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[]>([]);
  const [scheduleStories, setScheduleStories] = useState<{ imageUrl: string; title: string }[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  useEffect(() => {
    loadGoogleFonts();
    // Make sure the web fonts have arrived before the first draw, then draw again.
    const fam = [coverFont, bodyFont];
    Promise.all(fam.map((f) => document.fonts.load(`700 40px ${f}`).catch(() => null))).then(() => setFontsReady((n) => n + 1));
  }, [coverFont, bodyFont]);

  const render = useCallback((canvas: HTMLCanvasElement, index: number, height = H) => {
    const s = slides[index];
    if (!s) return;
    canvas.width = W;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, height);

    // Photo, filled to the frame, positioned by where it has been dragged to.
    const scale = Math.max(W / s.img.naturalWidth, height / s.img.naturalHeight);
    const dw = s.img.naturalWidth * scale;
    const dh = s.img.naturalHeight * scale;
    ctx.drawImage(s.img, (W - dw) * s.fx, (height - dh) * s.fy, dw, dh);

    // Gradient on every page
    if (gradientOn) {
      const a = gradientStrength / 100;
      const mk = (y0: number, y1: number, from: number, to: number) => {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, hexToRgba(gradientColour, from));
        g.addColorStop(1, hexToRgba(gradientColour, to));
        ctx.fillStyle = g;
      };
      if (gradientDir === "bottom") { mk(height * 0.35, height, 0, a); ctx.fillRect(0, height * 0.35, W, height * 0.65); }
      else if (gradientDir === "top") { mk(0, height * 0.65, a, 0); ctx.fillRect(0, 0, W, height * 0.65); }
      else if (gradientDir === "both") {
        mk(0, height * 0.4, a, 0); ctx.fillRect(0, 0, W, height * 0.4);
        mk(height * 0.6, height, 0, a); ctx.fillRect(0, height * 0.6, W, height * 0.4);
      } else { ctx.fillStyle = hexToRgba(gradientColour, a * 0.6); ctx.fillRect(0, 0, W, height); }
    }

    // Words
    const isCover = index === 0;
    const font = isCover ? coverFont : bodyFont;
    const size = isCover ? coverSize : bodySize;
    const headline = s.text.trim();
    const sub = isCover ? s.sub.trim() : "";
    if (!headline && !sub) return;
    const pad = 90;
    const maxW = W - pad * 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColour;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 12;
    ctx.font = `${isCover ? 700 : 600} ${size}px ${font}`;
    const hLines = headline ? wrapLines(ctx, headline, maxW) : [];
    const hLead = size * 1.15;
    const subSize = Math.round(size * 0.42);
    ctx.font = `400 ${subSize}px ${bodyFont}`;
    const sLines = sub ? wrapLines(ctx, sub, maxW) : [];
    const sLead = subSize * 1.35;
    const blockH = hLines.length * hLead + (sLines.length ? 28 + sLines.length * sLead : 0);
    const startY = textPos === "top" ? 150 : textPos === "middle" ? (height - blockH) / 2 : height - blockH - 160;
    ctx.font = `${isCover ? 700 : 600} ${size}px ${font}`;
    hLines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * hLead));
    ctx.font = `400 ${subSize}px ${bodyFont}`;
    sLines.forEach((l, i) => ctx.fillText(l, W / 2, startY + hLines.length * hLead + 28 + i * sLead));
    ctx.shadowBlur = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, gradientOn, gradientColour, gradientDir, gradientStrength, coverFont, bodyFont, textColour, textPos, coverSize, bodySize, fontsReady]);

  useEffect(() => {
    if (canvasRef.current && slides[selected]) render(canvasRef.current, selected);
  }, [render, selected, slides]);

  // ---- Images ----
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    try {
      const loaded = await Promise.all(imgs.map(loadImageFromFile));
      setSlides((prev) => [...prev, ...loaded.map((img) => ({ id: uid(), img, text: "", sub: "", fx: 0.5, fy: 0.5 }))]);
      toast.success(`${loaded.length} photo${loaded.length !== 1 ? "s" : ""} added`);
    } catch { toast.error("One of those photos would not open"); }
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides((prev) => { const a = [...prev]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    setSelected(j);
  };
  const remove = (i: number) => {
    setSlides((prev) => prev.filter((_, k) => k !== i));
    setSelected((s) => Math.max(0, Math.min(s, slides.length - 2)));
  };
  const patchSlide = (i: number, p: Partial<Slide>) => setSlides((prev) => prev.map((s, k) => (k === i ? { ...s, ...p } : s)));

  // Drag the photo inside the frame
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = slides[selected];
    if (!s) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, fx: s.fx, fy: s.fy };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    const s = slides[selected];
    const canvas = canvasRef.current;
    if (!d || !s || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const k = W / rect.width;
    const scale = Math.max(W / s.img.naturalWidth, H / s.img.naturalHeight);
    const spareX = W - s.img.naturalWidth * scale;
    const spareY = H - s.img.naturalHeight * scale;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const fx = spareX < -1 ? clamp(d.fx + ((e.clientX - d.x) * k) / spareX) : d.fx;
    const fy = spareY < -1 ? clamp(d.fy + ((e.clientY - d.y) * k) / spareY) : d.fy;
    patchSlide(selected, { fx, fy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  // ---- Fonts ----
  const addCustomFont = async (file: File) => {
    try {
      const family = `Custom ${file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9 ]/gi, " ").trim() || "Font"}`;
      const face = new FontFace(family, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      const opt = { label: `${family} (yours)`, value: `'${family}', sans-serif` };
      setCustomFonts((prev) => [opt, ...prev]);
      setFontsReady((n) => n + 1);
      toast.success(`${family} is ready to pick`);
    } catch { toast.error("That font file would not load. Try a .ttf, .otf or .woff file"); }
  };

  // ---- Caption ----
  const generateCaption = async () => {
    if (!brief.trim()) { toast.error("Give me a short brief first"); return; }
    setCaptioning(true);
    try {
      const words = slides.map((s, i) => [s.text, i === 0 ? s.sub : ""].filter((t) => t.trim()).join(" - ")).filter(Boolean);
      const context =
        `An Instagram carousel of ${slides.length} photo slides. The brief from the person posting it: ${brief.trim()}\n` +
        (words.length ? `The words on the slides, in order: ${words.map((w, i) => `${i + 1}. ${w}`).join(" ")}\n` : "") +
        (clientName
          ? `Write the whole caption in the first person, as the clinician or clinic owner speaking directly to the reader. `
          : `Write the whole caption in the first person as a social media manager for the aesthetics industry, never as a clinician. `) +
        `Add something the slides do not already say. Use UK spelling. Never use em dashes or en dashes anywhere in the caption.`;
      const res = await fetch(`${BASE}/api/caption-generator/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: "1", context, clinicName: preset?.name, location: area.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.caption) throw new Error(data.error || "Caption generation failed");
      let out = noDashes(String(data.caption));
      const footnote = preset?.captionFootnote?.trim();
      if (footnote && !out.includes(footnote)) out += `\n\n${footnote}`;
      setCaption(out);
    } catch (e: any) {
      toast.error(e?.message || "Caption generation failed");
    } finally {
      setCaptioning(false);
    }
  };

  // ---- Export and schedule ----
  const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));

  const downloadAll = async () => {
    if (!slides.length) { toast.error("Upload some photos first"); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      const c = document.createElement("canvas");
      for (let i = 0; i < slides.length; i++) {
        render(c, i);
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, await toBlob(c));
      }
      render(c, 0, STORY_H);
      zip.file("story.png", await toBlob(c));
      if (caption.trim()) zip.file("caption.txt", caption);
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `slideshow-${Date.now()}.zip`;
      a.click();
    } catch (e: any) {
      toast.error(e?.message || "Could not build the zip");
    } finally {
      setDownloading(false);
    }
  };

  const uploadPng = async (dataUrl: string, name: string): Promise<string> => {
    let url = "";
    for (let attempt = 0; attempt < 3 && !url; attempt++) {
      try {
        const up = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name, base64: dataUrl }] }),
        });
        if (!up.ok) throw new Error("Image upload failed");
        const { results } = (await up.json()) as { results: { url: string }[] };
        url = results[0]?.url ?? "";
        if (!url) throw new Error("No image URL returned");
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return url;
  };

  // The next 6.15pm, as a local "YYYY-MM-DDTHH:mm" string, which is what the schedule screen expects.
  const nextEvening = () => {
    const p = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    d.setHours(18, 15, 0, 0);
    if (d.getTime() <= Date.now() + 5 * 60000) d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const prepareSchedule = async () => {
    if (!slides.length) { toast.error("Upload some photos first"); return; }
    if (!caption.trim()) { toast.error("Write or generate a caption first"); return; }
    setPreparing("Starting");
    try {
      const c = document.createElement("canvas");
      const urls: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        setPreparing(`Uploading slide ${i + 1} of ${slides.length}`);
        render(c, i);
        urls.push(await uploadPng(c.toDataURL("image/png"), `slideshow-${Date.now()}-${i + 1}.png`));
      }
      const title = `${slides[0].text.trim().slice(0, 60) || "Slideshow"} · ${clientName || "slideshow"}`;
      const stories: { imageUrl: string; title: string }[] = [];
      if (alsoStory) {
        setPreparing("Making the story");
        render(c, 0, STORY_H);
        stories.push({ imageUrl: await uploadPng(c.toDataURL("image/png"), `slideshow-${Date.now()}-story.png`), title });
      }
      setScheduleItems([{ title, caption: caption.trim(), imageUrls: urls }]);
      setScheduleStories(stories);
      setScheduleStart(nextEvening());
      setScheduleOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not get the slideshow ready to schedule");
    } finally {
      setPreparing(null);
    }
  };

  const cur = slides[selected];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-none">Slideshow</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Upload photos, add a gradient and your fonts, write the caption, schedule the post and the story.</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Client</h2>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a client (or leave empty for Social Media Sister)..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area for the hashtags and local search, for example Beeston, Nottingham" className="h-9 text-sm" />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Photos</h2>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-6 flex items-center gap-3 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{slides.length ? `${slides.length} photo${slides.length !== 1 ? "s" : ""} loaded. Click or drop to add more.` : "Click or drop your photos. The first one is the front page."}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <ApprovedImagesPicker clientName={clientName} mode="multi" skipBackgroundRemoval large label="Use approved photos" onAddImages={(files) => addFiles(files)} />
            {slides.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {slides.map((s, i) => (
                  <div key={s.id} className={`shrink-0 w-24 rounded-lg border p-1 space-y-1 ${i === selected ? "border-primary" : "border-border/40"}`}>
                    <button type="button" onClick={() => setSelected(i)} className="block w-full">
                      <img src={s.img.src} alt={`Slide ${i + 1}`} className="w-full aspect-[3/4] object-cover rounded" />
                    </button>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => move(i, -1)} aria-label="Move earlier"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-[11px] text-muted-foreground">{i === 0 ? "Front" : i + 1}</span>
                      <button type="button" onClick={() => move(i, 1)} aria-label="Move later"><ChevronRight className="w-4 h-4" /></button>
                      <button type="button" onClick={() => remove(i)} aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-base">3. Words</h2>
            {cur ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{selected === 0 ? "Front page: headline and subtitle." : `Slide ${selected + 1}: optional words on this page.`}</p>
                {selected === 0 ? (
                  <>
                    <Input value={cur.text} onChange={(e) => patchSlide(selected, { text: e.target.value })} placeholder="Headline" />
                    <Input value={cur.sub} onChange={(e) => patchSlide(selected, { sub: e.target.value })} placeholder="Subtitle" />
                  </>
                ) : (
                  <Textarea value={cur.text} onChange={(e) => patchSlide(selected, { text: e.target.value })} placeholder="Words for this slide, or leave empty for just the photo" rows={3} />
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground">Upload a photo first.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Front page font</label>
                <Select value={coverFont} onValueChange={setCoverFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">{fontOptions.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Other pages font</label>
                <Select value={bodyFont} onValueChange={setBodyFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">{fontOptions.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => fontFileRef.current?.click()}>Upload my own font</Button>
              <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) addCustomFont(e.target.files[0]); e.target.value = ""; }} />
              <label className="text-xs flex items-center gap-2">Text colour
                <input type="color" value={textColour} onChange={(e) => setTextColour(e.target.value)} className="h-8 w-10 rounded border border-border/40 bg-transparent" />
              </label>
              <Select value={textPos} onValueChange={(v) => setTextPos(v as TextPos)}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Words at top</SelectItem>
                  <SelectItem value="middle">Words in middle</SelectItem>
                  <SelectItem value="bottom">Words at bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs space-y-1 block">Front page size
                <input type="range" min={60} max={180} value={coverSize} onChange={(e) => setCoverSize(Number(e.target.value))} className="w-full" />
              </label>
              <label className="text-xs space-y-1 block">Other pages size
                <input type="range" min={36} max={120} value={bodySize} onChange={(e) => setBodySize(Number(e.target.value))} className="w-full" />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-base">4. Gradient</h2>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={gradientOn} onChange={(e) => setGradientOn(e.target.checked)} />
              Add a gradient on every page
            </label>
            {gradientOn && (
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-xs flex items-center gap-2">Colour
                  <input type="color" value={gradientColour} onChange={(e) => setGradientColour(e.target.value)} className="h-8 w-10 rounded border border-border/40 bg-transparent" />
                </label>
                <Select value={gradientDir} onValueChange={(v) => setGradientDir(v as GradientDir)}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom">From the bottom</SelectItem>
                    <SelectItem value="top">From the top</SelectItem>
                    <SelectItem value="both">Top and bottom</SelectItem>
                    <SelectItem value="full">Full wash</SelectItem>
                  </SelectContent>
                </Select>
                <label className="text-xs flex items-center gap-2">Strength
                  <input type="range" min={10} max={100} value={gradientStrength} onChange={(e) => setGradientStrength(Number(e.target.value))} />
                </label>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">5. Caption</h2>
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="A short brief, for example: new skin booster slots in November, I want it warm and a bit cheeky" />
            <Button type="button" variant="outline" onClick={generateCaption} disabled={captioning}>
              {captioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {caption ? "Rewrite caption" : "Generate caption"}
            </Button>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={9} placeholder="Your caption appears here, and you can edit it" />
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-base">6. Schedule</h2>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={alsoStory} onChange={(e) => setAlsoStory(e.target.checked)} />
              Also schedule the front page as a story (1080 x 1920)
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" onClick={prepareSchedule} disabled={!!preparing || !slides.length}>
                {preparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                {preparing ?? "Schedule"}
              </Button>
              <Button type="button" variant="outline" onClick={downloadAll} disabled={downloading || !slides.length}>
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Download slides, story and caption
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Nothing goes out until you confirm on the next screen.</p>
          </section>
        </div>

        <div className="lg:sticky lg:top-6 self-start space-y-2">
          <p className="text-xs text-muted-foreground">Preview, 1080 x 1440. Drag the photo to reposition it.</p>
          {cur ? (
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl border border-border/40 touch-none cursor-grab active:cursor-grabbing"
              style={{ aspectRatio: `${W} / ${H}` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ) : (
            <div className="w-full rounded-xl border border-dashed border-border/40 flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: `${W} / ${H}` }}>
              Your first photo shows here
            </div>
          )}
        </div>
      </div>

      {scheduleOpen && (
        <ScheduleModal
          presetId={preset?.id ?? null}
          presetName={preset?.name}
          postType={slides.length > 1 ? "carousel" : "single-image"}
          posts={scheduleItems}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          companionStories={scheduleStories.length ? scheduleStories : undefined}
          sourceTool="slideshow"
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { setScheduleOpen(false); toast.success("Scheduled. Go and put the kettle on."); }}
        />
      )}
    </div>
  );
}
