import { useState } from "react";
import { usePresets } from "@/lib/use-presets";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080, H = 1350;
const FONTS = ["Bebas Neue", "Poppins", "Prata", "Playfair Display"];
const DEFAULT_CALLOUTS = ["Medically Trained", "Confidential", "Won't try to sell you things you don't need", "Patient over Profit", "Laidback and friendly", "Bespoke Treatment plans"];

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, zoom = 1) {
  const s = Math.max(W / img.width, H / img.height) * zoom; const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, accent: string, blur: number) {
  ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = blur; ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y); ctx.fillText(text, x, y);
  ctx.restore();
}

async function fileToDataUrl(file: File): Promise<string> { return new Promise((r) => { const rd = new FileReader(); rd.onload = () => r(rd.result as string); rd.readAsDataURL(file); }); }

export default function AboutMeStudio() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | null>(null);
  const [origUrl, setOrigUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [title, setTitle] = useState("When you come to my clinic...");
  const [callouts, setCallouts] = useState<string[]>([...DEFAULT_CALLOUTS]);
  const [teaser, setTeaser] = useState("And most importantly... you'll feel safe putting your face in my hands");
  const [font, setFont] = useState("Bebas Neue");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const preset = presets.find((p) => p.id === presetId) || null;
  const accent = (preset as any)?.accentColor || "#ec4899";
  const logoUrl = (preset as any)?.logoUrl || "";

  async function onPhoto(file: File | null) {
    if (!file) return;
    setBusy(true);
    const tid = toast.loading("Uploading and removing background…");
    try {
      const base64 = await fileToDataUrl(file);
      const up = await fetch(`${BASE}/api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: [{ name: "aboutme.jpg", base64 }] }) });
      const ud = await up.json(); const url = ud?.results?.[0]?.url;
      if (!url) throw new Error("Upload failed");
      setOrigUrl(url);
      const rb = await fetch(`${BASE}/api/about-me/remove-bg`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: url }) });
      const rd = await rb.json();
      if (!rb.ok || !rd.url) throw new Error(rd.error || "Background removal failed");
      setCutoutUrl(rd.url);
      toast.success("Photo ready.", { id: tid });
    } catch (e: any) { toast.error(e?.message || "Something went wrong", { id: tid }); } finally { setBusy(false); }
  }

  async function generate() {
    if (!origUrl || !cutoutUrl) { toast.error("Add a photo first."); return; }
    setBusy(true);
    const tid = toast.loading("Building your About Me…");
    try {
      await (document as any).fonts.ready;
      const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d")!;
      const orig = await loadImg(origUrl);
      ctx.filter = "blur(26px) brightness(0.92)"; drawCover(ctx, orig, 1.2); ctx.filter = "none";
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, 0, W, H);
      // cut-out subject
      const cut = await loadImg(cutoutUrl);
      const ch = H * 0.82, cw = cut.width * (ch / cut.height);
      ctx.drawImage(cut, (W - cw) / 2, H - ch, cw, ch);
      // title
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `${Math.round(H * 0.05)}px '${font}'`;
      glowText(ctx, title, W / 2, H * 0.09, accent, 22);
      // callouts, 3 each side
      const coSize = Math.round(H * 0.028); ctx.font = `${coSize}px '${font}'`;
      const ys = [0.30, 0.47, 0.63]; const maxW = W * 0.34;
      callouts.slice(0, 6).forEach((txt, i) => {
        if (!txt.trim()) return;
        const side = i < 3 ? "left" : "right"; ctx.textAlign = side as CanvasTextAlign;
        const x = side === "left" ? W * 0.03 : W * 0.97;
        const lines = wrapLines(ctx, txt, maxW); const lh = coSize * 1.15;
        let y = ys[i % 3] * H - ((lines.length - 1) * lh) / 2;
        for (const ln of lines) { glowText(ctx, ln, x, y, accent, 12); y += lh; }
      });
      // teaser
      ctx.textAlign = "center"; ctx.font = `${Math.round(H * 0.028)}px 'Prata', serif`;
      const tLines = wrapLines(ctx, teaser, W * 0.8); let ty = H * 0.92 - ((tLines.length - 1) * H * 0.032) / 2;
      for (const ln of tLines) { glowText(ctx, ln, W / 2, ty, accent, 14); ty += H * 0.032; }
      // logo top-left
      if (logoUrl) { try { const lg = await loadImg(logoUrl); const lw = W * 0.16, lh = lg.height * (lw / lg.width); ctx.drawImage(lg, W * 0.05, H * 0.035, lw, lh); } catch {} }
      setResult(c.toDataURL("image/png"));
      toast.success("Done.", { id: tid });
    } catch (e: any) { toast.error(e?.message || "Render failed — the photo host may block editing", { id: tid }); } finally { setBusy(false); }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a"); a.href = result; a.download = "about-me.png"; a.click();
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold">About Me Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a photo, it cuts you out over a blurred version of the same shot and lays your title, phrases and teaser over the top.</p>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client (logo + accent colour)</label>
            <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">
              <option value="">Select a client…</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Photo</label>
            <label className="block border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-pink-500/60">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0] || null); e.currentTarget.value = ""; }} />
              <p className="text-sm">{cutoutUrl ? "Photo ready — change it" : "Drop a photo of you"}</p>
            </label>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Font</label>
            <select value={font} onChange={(e) => setFont(e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2">{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Six phrases</label>
            <div className="grid grid-cols-2 gap-2">
              {callouts.map((co, i) => (
                <input key={i} value={co} onChange={(e) => setCallouts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" placeholder={`Phrase ${i + 1}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">"And most importantly..." line</label>
            <input value={teaser} onChange={(e) => setTeaser(e.target.value)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" />
          </div>
          <div className="flex gap-3">
            <button onClick={generate} disabled={busy || !cutoutUrl} className="px-6 py-3 rounded-full bg-pink-500 text-white font-semibold disabled:opacity-40 hover:bg-pink-400">{busy ? "Working…" : "Generate"}</button>
            {result && <button onClick={download} className="px-5 py-3 rounded-full border border-border/50 hover:border-pink-500/60">Download</button>}
          </div>
        </div>
        <div className="flex items-start justify-center">
          {result
            ? <img src={result} alt="About Me" className="w-full max-w-sm rounded-2xl border border-white/10" />
            : <div className="w-full max-w-sm aspect-[4/5] rounded-2xl border border-dashed border-border/50 flex items-center justify-center text-muted-foreground text-sm">Your About Me preview appears here</div>}
        </div>
      </main>
    </div>
  );
}
