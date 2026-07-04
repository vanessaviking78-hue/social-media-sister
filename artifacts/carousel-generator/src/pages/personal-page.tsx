import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";
import { toast } from "sonner";

const SECTION_BANK = [
  "About me", "When you come to clinic", "My values", "Things that matter to me", "Treatments I offer",
  "Why I do this", "My promise to you", "The way I work", "What you'll never get from me", "How I got here",
  "What safety means to me", "The people I look after", "My non-negotiables", "Behind the results",
  "My honest take on trends", "Come as you are", "What lights me up outside clinic",
];
const DEFAULT_ON = ["About me", "When you come to clinic", "My values", "Treatments I offer"];
const FONTS = ["Bebas Neue", "Poppins", "Prata", "Playfair Display"];
const W = 1080;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((r, j) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = j; i.src = src; });
}
function fileToDataUrl(f: File): Promise<string> { return new Promise((r) => { const rd = new FileReader(); rd.onload = () => r(rd.result as string); rd.readAsDataURL(f); }); }
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height, tr = w / h; let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > tr) { sw = img.height * tr; sx = (img.width - sw) / 2; } else { sh = img.width / tr; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text || "").split(/\n/)) {
    if (!para.trim()) { out.push(""); continue; }
    const words = para.split(/\s+/); let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
  }
  return out;
}

export default function PersonalPage() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string>("");
  const [font, setFont] = useState("Bebas Neue");
  const [active, setActive] = useState<string[]>([...DEFAULT_ON]);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [headings, setHeadings] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const preset = presets.find((p) => p.id === presetId) || null;
  const accent = (preset as any)?.accentColor || (preset as any)?.cornerColor || "#c4879a";
  const clientName = preset?.name || "";

  useEffect(() => {
    const id = "pp-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Poppins:ital,wght@0,400;0,600;1,400&family=Prata&family=Playfair+Display:ital,wght@0,500;1,500&display=swap";
      document.head.appendChild(l);
    }
  }, []);
  useEffect(() => { setLogoUrl((preset as any)?.logoUrl || ""); }, [presetId]);

  function toggle(s: string) { setActive((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s])); }

  async function onPhoto(f: File | null) { if (!f) return; setPhoto(await fileToDataUrl(f)); }

  async function build() {
    if (!photo) { toast.error("Add a photo first."); return; }
    if (!active.length) { toast.error("Pick at least one section."); return; }
    setBusy(true);
    const tid = toast.loading("Building your page…");
    try {
      await document.fonts.load(`400 80px "${font}"`); await document.fonts.load("400 30px 'Poppins'"); await document.fonts.load("italic 40px 'Playfair Display'"); await document.fonts.ready;
      const img = await loadImg(photo);
      const logo = logoUrl ? await loadImg(logoUrl).catch(() => null) : null;
      const pad = 90, heroH = 720, colW = W - pad * 2;
      const measure = document.createElement("canvas").getContext("2d")!;
      // pre-measure sections to get total height
      const sections = active.map((s) => {
        measure.font = "30px 'Poppins'";
        const lines = wrapLines(measure, bodies[s] || "", colW);
        return { heading: (headings[s] ?? s), lines };
      });
      let y = heroH + 70;
      for (const sec of sections) { y += 62 + sec.lines.length * 42 + 46; }
      y += 40 + 60 + 90 + 90; // signoff block + bottom pad
      const H = Math.max(1350, Math.round(y));

      const c = canvasRef.current || document.createElement("canvas");
      c.width = W; c.height = H; const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#faf7f4"; ctx.fillRect(0, 0, W, H);
      // hero photo
      drawCover(ctx, img, 0, 0, W, heroH);
      const g = ctx.createLinearGradient(0, heroH - 260, 0, heroH); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g; ctx.fillRect(0, heroH - 260, W, 260);
      // name on hero
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.font = `72px "${font}"`;
      ctx.fillText(clientName || "About me", pad, heroH - 56);
      // logo top-left
      if (logo) { const lw = 150, asp = (logo.width / logo.height) || 1; ctx.drawImage(logo, pad, 50, lw, lw / asp); }

      // sections
      y = heroH + 80; ctx.textAlign = "left";
      for (const sec of sections) {
        ctx.fillStyle = accent; ctx.font = `48px "${font}"`;
        ctx.fillText(sec.heading, pad, y); y += 58;
        ctx.fillStyle = "#33302e"; ctx.font = "30px 'Poppins'";
        for (const ln of sec.lines) { ctx.fillText(ln, pad, y); y += 42; }
        // divider
        y += 20; ctx.strokeStyle = accent + "55"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); y += 44;
      }
      // signoff
      y += 20; ctx.textAlign = "center";
      ctx.fillStyle = "#7a7168"; ctx.font = "italic 40px 'Playfair Display'"; ctx.fillText("With love,", W / 2, y); y += 66;
      ctx.fillStyle = accent; ctx.font = `64px "${font}"`; ctx.fillText(clientName || "Your name", W / 2, y);

      setResult(c.toDataURL("image/png"));
      toast.success("Page ready.", { id: tid });
    } catch (e: any) { toast.error(e?.message || "Build failed", { id: tid }); } finally { setBusy(false); }
  }

  function download() { if (!result) return; const a = document.createElement("a"); a.href = result; a.download = `${(clientName || "personal").replace(/\s+/g, "-").toLowerCase()}-page.png`; a.click(); }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <Link href="/hub"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
        <div><h1 className="font-semibold text-lg">Personal Page</h1><p className="text-xs text-muted-foreground mt-0.5">A stand-alone "about me" post. Photo up top, your chosen sections, signed with love.</p></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">
              <option value="">Select a client…</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Photo</label>
            <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border/50 hover:border-pink-500/60 text-sm cursor-pointer w-fit">
              <Upload className="w-4 h-4" /> {photo ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0] || null); e.currentTarget.value = ""; }} />
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Font</label>
            <div className="flex flex-wrap gap-2">{FONTS.map((f) => <button key={f} onClick={() => setFont(f)} className={`px-3 py-1.5 rounded-lg border text-sm ${font === f ? "border-pink-500 text-pink-300" : "border-border/50 hover:border-pink-500/60"}`}>{f}</button>)}</div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Sections (tick to include, then write)</label>
            <div className="space-y-2">
              {SECTION_BANK.map((s) => (
                <div key={s} className="rounded-lg border border-border/40 p-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={active.includes(s)} onChange={() => toggle(s)} className="w-4 h-4 accent-pink-500" />
                    <span className="font-semibold">{s}</span>
                  </label>
                  {active.includes(s) && (
                    <div className="mt-2 space-y-2">
                      <input value={headings[s] ?? s} onChange={(e) => setHeadings((p) => ({ ...p, [s]: e.target.value }))} placeholder="Heading" className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm font-semibold" />
                      <textarea value={bodies[s] || ""} onChange={(e) => setBodies((p) => ({ ...p, [s]: e.target.value }))} rows={3} placeholder={`Write your "${s}"…`} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={build} disabled={busy} className="bg-pink-600 hover:bg-pink-700">{busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}Build page</Button>
            {result && <Button variant="outline" onClick={download}><Download className="w-4 h-4 mr-1.5" />Download</Button>}
          </div>
        </div>

        <div className="lg:sticky lg:top-8 h-fit">
          <canvas ref={canvasRef} className="hidden" />
          {result ? <img src={result} alt="Personal page" className="w-full rounded-2xl border border-white/10" /> : <div className="aspect-[3/4] rounded-2xl border border-dashed border-border/40 flex items-center justify-center text-sm text-muted-foreground">Your page preview appears here</div>}
        </div>
      </div>
    </div>
  );
}
