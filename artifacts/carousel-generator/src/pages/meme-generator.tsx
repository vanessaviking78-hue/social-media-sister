import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Download, ShieldCheck, CalendarClock, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { usePresets } from "@/lib/use-presets";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";
import { FONTS_CHANGED_EVENT, type SharedFontOption } from "@/lib/shared-fonts";
import { PREMADE_MEMES, type PremadeMeme } from "@/lib/premade-memes";

loadGoogleFonts();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1350;
const BEDROSS = "'Bedross', sans-serif";
const TEXT_COLOUR = "#ffffff";
const AUDIENCES = ["All", "Menopause", "Mums of toddlers", "Mums of teens", "Busy mums", "ADHD", "Graceful", "Disgraceful"];

const loadLogo = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo load failed"));
    img.src = src;
  });

const noDashes = (t: string) =>
  t.replace(/(\d)–(\d)/g, "$1-$2").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");

// Three different angles so the three caption options never read the same.
const CAPTION_ANGLES = [
  "Open with a short, specific, relatable moment from my own week, then land the joke from the graphic.",
  "Say the thing she thinks but never says out loud, validate her, and make her want to tag the friend who is exactly like this.",
  "Keep it very short and cheeky, a few lines at most, and finish with a fun reply word she can comment.",
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Next Saturday at 9am or the next Sunday at 7pm, never in the past.
function nextSlot(day: 6 | 0, hour: number): { date: string; time: string } {
  const now = new Date();
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  let add = (day - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= now.getTime()) add = 7;
  d.setDate(d.getDate() + add);
  return { date: toDateInput(d), time: `${pad2(hour)}:00` };
}

export default function MemeGenerator() {
  const { presets } = usePresets();
  const [clientName, setClientName] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [premadeId, setPremadeId] = useState<number | null>(null);
  const [audience, setAudience] = useState("All");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [logoScale, setLogoScale] = useState(1);
  const [selected, setSelected] = useState("");
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [fontSize, setFontSize] = useState(76);
  const [fontValue, setFontValue] = useState(BEDROSS);
  const [caps, setCaps] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [captions, setCaptions] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [captioning, setCaptioning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateInput(d); });
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [scheduling, setScheduling] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fonts uploaded in Stylish or any other tool are shared, so refresh the list when they change.
  useEffect(() => {
    const bump = () => setFontTick((n) => n + 1);
    window.addEventListener(FONTS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(FONTS_CHANGED_EVENT, bump);
  }, []);

  const fontOptions = FONT_OPTIONS as SharedFontOption[];
  const yourFonts = fontOptions.filter((f) => f.custom);
  const stockFonts = fontOptions.filter((f) => !f.custom);
  void fontTick;

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => { setPhoto(img); setPremadeId(null); };
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const pickPremade = (m: PremadeMeme) => {
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setPremadeId(m.id);
      setSelected(m.text);
      setPosition(m.pos);
      setFontSize(m.size);
      setFontValue(BEDROSS);
      setCaps(false);
      setCaptions([]);
      setCaption("");
    };
    img.onerror = () => toast.error("Could not load that meme");
    img.src = `${BASE}/${m.file}`;
  };

  // The chosen client's transparent logo goes in the top right corner.
  useEffect(() => {
    const preset = presets.find((p) => p.name === clientName);
    if (!preset?.logoUrl) { setLogo(null); return; }
    let live = true;
    loadLogo(preset.logoUrl).then((img) => { if (live) setLogo(img); }).catch(() => { if (live) setLogo(null); });
    return () => { live = false; };
  }, [clientName, presets]);

  const writeCaptions = async () => {
    const quote = selected.trim();
    if (!quote) { toast.error("Pick a quote first"); return; }
    setCaptioning(true);
    try {
      const preset = presets.find((p) => p.name === clientName);
      const voice = preset
        ? "Write it as the clinic owner speaking in the first person to her followers, never as a social media manager. "
        : "Write it as a social media manager for the aesthetics industry speaking directly to the reader, never as a clinician. ";
      const results = await Promise.all(CAPTION_ANGLES.map(async (angle) => {
        const res = await fetch(`${BASE}/api/caption-generator/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tone: "1",
            clinicName: preset?.name,
            context:
              `An Instagram single image post. The image is a meme graphic that says: "${quote}"\n` +
              `Write a caption that adds something the graphic does not already say and never repeats it word for word. ` +
              voice +
              `${angle} ` +
              `Make it a general lifestyle post with no treatment talk, no medical claims and no promises about results. ` +
              `Use UK spelling, never use em dashes or en dashes. ` +
              `The strong call to action asks the reader to tag someone who is just like this, or to comment the reply word.`,
          }),
        });
        const data = await res.json().catch(() => ({})) as { caption?: string; error?: string };
        if (!res.ok || !data.caption) throw new Error(data.error || "Caption failed");
        let text = noDashes(data.caption);
        const footnote = preset?.captionFootnote?.trim();
        if (footnote && !text.includes(footnote)) text += `\n\n${footnote}`;
        return text;
      }));
      setCaptions(results);
      setCaption(results[0] ?? "");
    } catch (e: any) {
      toast.error(e?.message || "Could not write captions");
    } finally {
      setCaptioning(false);
    }
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, W, H);
    if (photo) {
      const ar = photo.width / photo.height;
      let dw = W, dh = H, dx = 0, dy = 0;
      if (ar > W / H) { dh = H; dw = H * ar; dx = (W - dw) / 2; }
      else { dw = W; dh = W / ar; dy = (H - dh) / 2; }
      ctx.drawImage(photo, dx, dy, dw, dh);
    }
    const drawLogoTopRight = () => {
      if (!logo) return;
      const maxW = 260 * logoScale, maxH = 110 * logoScale, m = 40;
      const sc = Math.min(maxW / logo.width, maxH / logo.height);
      const w = logo.width * sc, h = logo.height * sc;
      // Straight onto the photo with nothing behind it, so a transparent PNG stays transparent.
      ctx.drawImage(logo, W - m - w, m, w, h);
    };
    const fontWeight = fontValue === BEDROSS ? 400 : 700;
    const raw = selected.trim();
    if (!raw) { drawLogoTopRight(); return; }
    const text = caps ? raw.toUpperCase() : raw;
    const light = true;

    // A soft shade behind the words so they read on any photo.
    const shadeTop = position === "top" ? 0 : H * 0.4;
    const shadeH = H * 0.6;
    const g = ctx.createLinearGradient(0, shadeTop, 0, shadeTop + shadeH);
    const c = light ? "0,0,0" : "255,255,255";
    if (position === "top") { g.addColorStop(0, `rgba(${c},0.6)`); g.addColorStop(1, `rgba(${c},0)`); }
    else { g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},0.65)`); }
    ctx.fillStyle = g;
    ctx.fillRect(0, shadeTop, W, shadeH);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `${fontWeight} ${fontSize}px ${fontValue}`;
    const maxW = W - 140;
    const wrapped: string[] = [];
    let cur = "";
    for (const w of text.split(/\s+/)) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width > maxW && cur) { wrapped.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) wrapped.push(cur);
    const lineH = fontSize * 1.18;
    const totalH = wrapped.length * lineH;
    const logoBottom = logo ? 40 + Math.min((260 * logoScale) / logo.width, (110 * logoScale) / logo.height) * logo.height + 24 : 0;
    const top = position === "top" ? Math.max(90, logoBottom) : H - totalH - 90;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, fontSize / 10);
    ctx.strokeStyle = light ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.85)";
    ctx.fillStyle = TEXT_COLOUR;
    let y = top;
    for (const ln of wrapped) {
      ctx.strokeText(ln, W / 2, y);
      ctx.fillText(ln, W / 2, y);
      y += lineH;
    }
    drawLogoTopRight();
  }, [photo, selected, fontSize, fontValue, caps, position, logo, logoScale]);

  useEffect(() => {
    render();
    let live = true;
    const f = (document as { fonts?: { load?: (s: string) => Promise<unknown> } }).fonts;
    if (f?.load) f.load(`${fontValue === BEDROSS ? 400 : 700} 64px ${fontValue}`).then(() => { if (live) render(); }).catch(() => {});
    const t = setTimeout(render, 300);
    return () => { live = false; clearTimeout(t); };
  }, [render, fontValue, fontTick]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `meme-${Date.now()}.png`;
    a.click();
  };

  const uploadCanvas = async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Nothing to upload");
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
    return url;
  };

  const saveToLibrary = async () => {
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    if (!selected.trim()) { toast.error("Pick a quote first"); return; }
    setSaving(true);
    try {
      const url = await uploadCanvas();
      const lib = await fetch(`${BASE}/api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, postType: "single", caption: caption || selected, mediaUrl: url, metadata: { source: "meme", premadeId } }),
      });
      if (!lib.ok) throw new Error("Save failed");
      toast.success(`Saved to ${clientName}'s library`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const scheduleMeme = async () => {
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    if (!selected.trim()) { toast.error("Pick a quote first"); return; }
    if (!caption.trim()) { toast.error("Write or pick a caption first"); return; }
    const preset = presets.find((p) => p.name === clientName);
    if (!preset) { toast.error("That client has no preset to post from"); return; }
    setScheduling(true);
    try {
      const url = await uploadCanvas();
      const r = await fetch(`${BASE}/api/scheduler/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: preset.id,
          postType: "single-image",
          content: { imageUrls: [url], caption, title: "Meme", platforms: ["instagram"] },
          scheduledAt: new Date(`${scheduleDate}T${scheduleTime}`).toISOString(),
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Schedule failed"); }
      toast.success(`Scheduled for ${scheduleDate} at ${scheduleTime}`);
    } catch (e: any) {
      toast.error(e?.message || "Schedule failed");
    } finally {
      setScheduling(false);
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
          <p className="text-xs text-muted-foreground mt-0.5">Pick a premade meme, choose the client, write the caption, schedule it.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. Choose a client <span className="text-xs font-normal text-muted-foreground">(optional, needed to save or schedule)</span></h2>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. Pick a premade meme <span className="text-xs font-normal text-muted-foreground">({PREMADE_MEMES.length} ready to go)</span></h2>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCES.map((a) => (
                <button key={a} onClick={() => setAudience(a)}
                  className={`text-xs rounded-full px-2.5 py-1 transition-colors ${audience === a ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}>{a}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {PREMADE_MEMES.filter((m) => audience === "All" || m.audience === audience).map((m) => (
                <button key={m.id} onClick={() => pickPremade(m)} title={m.text}
                  className={`relative rounded-lg overflow-hidden border-2 ${premadeId === m.id ? "border-primary" : "border-transparent hover:border-border/60"}`}>
                  <img src={`${BASE}/${m.file}`} alt={m.text} loading="lazy" className="w-full aspect-[4/5] object-cover block" />
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. Or use your own photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }}
              className="border-2 border-dashed border-border/40 hover:border-border/70 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors"
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

          <section className="space-y-3">
            <h2 className="font-semibold text-base">4. Style it</h2>
            <Label className="text-xs text-muted-foreground">Quote (edit freely)</Label>
            <textarea value={selected} onChange={(e) => setSelected(e.target.value)} rows={2}
              className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Font (the same list as Stylish, including your uploaded fonts)</Label>
              <select value={fontValue} onChange={(e) => setFontValue(e.target.value)}
                className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2" style={{ fontFamily: fontValue }}>
                {yourFonts.length > 0 && (
                  <optgroup label="Your fonts">
                    {yourFonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </optgroup>
                )}
                <optgroup label="Library fonts">
                  {stockFonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant={caps ? "default" : "outline"} size="sm" onClick={() => setCaps((v) => !v)}>CAPS</Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <input type="range" min={36} max={120} step={2} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 cursor-pointer" />
            </div>
            {logo && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Logo size</Label>
                <input type="range" min={0.5} max={2} step={0.05} value={logoScale} onChange={(e) => setLogoScale(parseFloat(e.target.value))} className="flex-1 cursor-pointer" />
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">5. Caption</h2>
            <Button variant="outline" onClick={writeCaptions} disabled={captioning || !selected.trim()} className="w-full">
              {captioning ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PenLine className="w-4 h-4 mr-1.5" />}
              {captions.length ? "Write me three different ones" : "Write me three caption options"}
            </Button>
            {captions.length > 0 && (
              <div className="space-y-1.5">
                {captions.map((c, i) => (
                  <button key={i} onClick={() => setCaption(c)}
                    className={`w-full text-left text-xs whitespace-pre-line rounded-lg px-3 py-2 border transition-colors ${caption === c ? "border-primary/60 bg-primary/5 text-foreground" : "border-border/30 text-muted-foreground hover:text-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <Label className="text-xs text-muted-foreground">Chosen caption (edit freely)</Label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6}
              className="w-full rounded-lg bg-muted/30 border border-border/30 text-sm px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </section>
        </div>

        <div className="space-y-3 lg:sticky lg:top-6 self-start">
          <div className="rounded-xl overflow-hidden border border-border/30 bg-black/20">
            <canvas ref={canvasRef} className="w-full block" style={{ aspectRatio: "1080 / 1350" }} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={download} disabled={!selected.trim()} className="flex-1">
              <Download className="w-4 h-4 mr-1.5" /> Download
            </Button>
            <Button onClick={saveToLibrary} disabled={saving || !selected.trim()} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />} Save to library
            </Button>
          </div>
          <div className="rounded-xl border border-border/30 p-3 space-y-2">
            <p className="text-xs font-medium">Schedule to post</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { const s = nextSlot(6, 9); setScheduleDate(s.date); setScheduleTime(s.time); }}>Saturday 9am</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { const s = nextSlot(0, 19); setScheduleDate(s.date); setScheduleTime(s.time); }}>Sunday 7pm</Button>
            </div>
            <div className="flex gap-2">
              <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="flex-1" />
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-28" />
            </div>
            <Button onClick={scheduleMeme} disabled={scheduling || !selected.trim()} className="w-full">
              {scheduling ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />} Schedule to post
            </Button>
            <p className="text-[11px] text-muted-foreground">Posts to Instagram for the chosen client at the chosen time, with the caption above.</p>
          </div>
          <p className="text-xs text-muted-foreground text-center">Portrait 1080 x 1350, ready for the grid.</p>
        </div>
      </div>
    </div>
  );
}
