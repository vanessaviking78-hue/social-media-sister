import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, Loader2, ImagePlus, CalendarClock, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080, H = 1440;

// Load the fonts the templates use
(() => {
  if (typeof document === "undefined") return;
  if (document.getElementById("ba-fonts")) return;
  const l = document.createElement("link");
  l.id = "ba-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Playfair+Display:wght@500;700;900&family=Poppins:wght@400;600;800&family=Space+Mono:wght@400;700&family=Montserrat:wght@400;600;800&family=Oswald:wght@400;600;700&family=Bebas+Neue&family=Anton&family=DM+Serif+Display&display=swap";
  document.head.appendChild(l);
})();

type Tpl = "polaroid" | "split" | "editorial" | "minimal" | "framed";
const TEMPLATES: { id: Tpl; name: string }[] = [
  { id: "polaroid", name: "Polaroid" },
  { id: "split", name: "Split face" },
  { id: "editorial", name: "Editorial" },
  { id: "minimal", name: "Minimal" },
  { id: "framed", name: "Framed" },
];
const DEFAULTS: Record<Tpl, { bg: string; text: string; accent: string }> = {
  polaroid:  { bg: "#efe7d8", text: "#8a1f1f", accent: "#2b2b2b" },
  split:     { bg: "#ece7dc", text: "#1b1b1b", accent: "#6d4ad6" },
  editorial: { bg: "#3f5347", text: "#f2ede2", accent: "#e9e3d6" },
  minimal:   { bg: "#f0ede6", text: "#16324a", accent: "#16324a" },
  framed:    { bg: "#c9cfc9", text: "#f5f5f5", accent: "#242424" },
};

const FONTS = ["Poppins", "Montserrat", "Oswald", "Bebas Neue", "Anton", "Playfair Display", "DM Serif Display", "Dancing Script"];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r = 0) {
  ctx.save();
  if (r > 0) { rr(ctx, x, y, w, h, r); } else { ctx.beginPath(); ctx.rect(x, y, w, h); }
  ctx.clip();
  const ar = img.width / img.height, tr = w / h;
  let dw = w, dh = h, dx = x, dy = y;
  if (ar > tr) { dh = h; dw = h * ar; dx = x - (dw - w) / 2; }
  else { dw = w; dh = w / ar; dy = y - (dh - h) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const out: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.3);
  ctx.bezierCurveTo(cx, cy, cx - s, cy - s * 0.1, cx - s, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s, cy + s * 0.8, cx, cy + s, cx, cy + s * 1.25);
  ctx.bezierCurveTo(cx, cy + s, cx + s, cy + s * 0.8, cx + s, cy + s * 0.35);
  ctx.bezierCurveTo(cx + s, cy - s * 0.1, cx, cy, cx, cy + s * 0.3);
  ctx.stroke(); ctx.restore();
}

export default function BeforeAfterMaker() {
  const { presets } = usePresets();
  const [tpl, setTpl] = useState<Tpl>("polaroid");
  const [before, setBefore] = useState<HTMLImageElement | null>(null);
  const [after, setAfter] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState("before & after");
  const [cap1, setCap1] = useState("");
  const [cap2, setCap2] = useState("");
  const [treatment, setTreatment] = useState("");
  const [backStory, setBackStory] = useState("");
  const [writeUp, setWriteUp] = useState("");
  const [details, setDetails] = useState("");
  const [bg, setBg] = useState(DEFAULTS.polaroid.bg);
  const [text, setText] = useState(DEFAULTS.polaroid.text);
  const [accent, setAccent] = useState(DEFAULTS.polaroid.accent);
  const [clientName, setClientName] = useState("");
  const [scheduleDate, setScheduleDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [subId, setSubId] = useState("");
  const [headingScale, setHeadingScale] = useState(1);
  const [bodyScale, setBodyScale] = useState(1);
  const [logoScale, setLogoScale] = useState(1);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoPos, setLogoPos] = useState("br");
  const [fontFamily, setFontFamily] = useState("Poppins");
  const [caption, setCaption] = useState("");
  const [genCap, setGenCap] = useState(false);

  useEffect(() => {
    const pw = localStorage.getItem("cybersuite-pw") || "";
    fetch(`${BASE}/api/submissions`, { headers: { "x-app-password": pw, "Authorization": "Bearer " + pw } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSubs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  const sameOrigin = (u: string) => { try { const p = new URL(u); return window.location.origin + p.pathname; } catch { return u; } };
  const loadUrl = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = sameOrigin(url); });
  const pullSub = async (id: string) => {
    setSubId(id);
    const sb = subs.find((x) => String(x.id) === id);
    if (!sb) return;
    try {
      const [b, a] = await Promise.all([loadUrl(sb.beforeUrl), loadUrl(sb.afterUrl)]);
      setBefore(b); setAfter(a);
      if (sb.clientName) setClientName(sb.clientName);
      if (sb.treatment) setTreatment(sb.treatment);
      if (sb.story) { setBackStory(sb.story); setWriteUp(sb.story); setDetails(sb.story); }
      toast.success("Loaded from submission");
    } catch { toast.error("Could not load those images"); }
  };

  useEffect(() => {
    const pp = presets.find((x) => x.name === clientName) as any;
    if (pp && pp.logoUrl) { loadUrl(pp.logoUrl).then(setLogoImg).catch(() => setLogoImg(null)); }
    else setLogoImg(null);
  }, [clientName, presets]);

const generateCaption = async () => {
    if (!backStory.trim() && !treatment.trim() && !writeUp.trim()) { toast.error("Add a back story first"); return; }
    setGenCap(true);
    try {
      const r = await fetch(`${BASE}/api/content/ba-caption`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatment, backStory: backStory || writeUp || details, clientName }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Failed"); }
      const { caption: cap } = await r.json() as { caption: string };
      setCaption(cap);
      toast.success("Caption written");
    } catch (e: any) { toast.error(e?.message || "Could not write a caption"); } finally { setGenCap(false); }
  };

  const chooseTpl = (id: Tpl) => { setTpl(id); const d = DEFAULTS[id]; setBg(d.bg); setText(d.text); setAccent(d.accent); };

  const loadFile = (which: "b" | "a") => (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    img.onload = () => (which === "b" ? setBefore(img) : setAfter(img));
    img.onerror = () => toast.error("Could not load that image");
    img.src = URL.createObjectURL(file);
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    const HS = headingScale, BS = bodyScale;
    const ph = (img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r = 0) => {
      if (img) cover(ctx, img, x, y, w, h, r);
      else { ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.08)"; if (r) rr(ctx, x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); ctx.restore(); }
    };

    if (tpl === "polaroid") {
      ctx.textAlign = "center";
      ctx.fillStyle = text;
      ctx.font = `700 ${150 * HS}px "Dancing Script", cursive`;
      ctx.fillText(title || "before & after", W / 2, 320);
      // two polaroids
      const drawPola = (img: HTMLImageElement | null, cx: number, cy: number, rot: number, cap: string) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
        const pw = 430, phh = 560;
        ctx.fillStyle = "#fbfbf7"; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
        ctx.fillRect(-pw / 2, -phh / 2, pw, phh);
        ctx.shadowColor = "transparent";
        ph(img, -pw / 2 + 26, -phh / 2 + 26, pw - 52, phh - 150);
        ctx.fillStyle = accent; ctx.font = `700 ${30 * BS}px "Space Mono", monospace`; ctx.textAlign = "center";
        ctx.fillText((cap || "").toUpperCase(), 0, phh / 2 - 40);
        ctx.restore();
      };
      drawPola(before, 300, 830, -5, cap1);
      drawPola(after, 790, 860, 4, cap2);
      heart(ctx, 980, 560, 34, accent); heart(ctx, 1015, 660, 30, accent);
      // write up tape
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.translate(W / 2, 1250); ctx.rotate(-1.5 * Math.PI / 180);
      ctx.fillRect(-330, -55, 660, 110); ctx.restore();
      ctx.fillStyle = accent; ctx.font = `400 ${40 * BS}px "Space Mono", monospace`; ctx.textAlign = "center";
      ctx.fillText(writeUp || "write up goes here", W / 2, 1263);
    }

    else if (tpl === "split") {
      ph(before, 0, 0, W / 2, H * 0.72);
      ph(after, W / 2, 0, W / 2, H * 0.72);
      ctx.fillStyle = accent; ctx.fillRect(W / 2 - 4, 0, 8, H * 0.72);
      // bottom panel
      ctx.fillStyle = bg; ctx.fillRect(0, H * 0.72, W, H * 0.28);
      ctx.fillStyle = text; ctx.textAlign = "left";
      ctx.font = `800 ${100 * HS}px "${fontFamily}", sans-serif`;
      ctx.fillText("BEFORE", 60, H * 0.72 + 150);
      ctx.fillText("AFTER", W / 2 + 60, H * 0.72 + 150);
      ctx.font = `400 ${34 * BS}px "${fontFamily}", sans-serif`;
      wrap(ctx, backStory || "back story goes here", W / 2 - 120).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 60, H * 0.72 + 240 + i * 44));
      wrap(ctx, writeUp || "write up goes here", W / 2 - 120).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, W / 2 + 60, H * 0.72 + 240 + i * 44));
    }

    else if (tpl === "editorial") {
      ctx.fillStyle = text; ctx.textAlign = "left";
      ctx.font = `700 ${170 * HS}px "Playfair Display", serif`;
      ctx.fillText("BEFORE", 40, 250);
      // diagonal banner
      ctx.save(); ctx.translate(W / 2, 420); ctx.rotate(-4 * Math.PI / 180);
      ctx.fillStyle = accent; ctx.fillRect(-W, -45, W * 2, 90);
      ctx.fillStyle = "#2b3a30"; ctx.font = `800 ${40 * BS}px "${fontFamily}", sans-serif`; ctx.textAlign = "center";
      ctx.fillText(treatment || "treatment name and clinician name", 0, 14);
      ctx.restore();
      // two photos
      const pw = 430, y0 = 560, phh = 720;
      ph(before, 90, y0, pw, phh); ph(after, W - 90 - pw, y0, pw, phh);
      const capBar = (cx: number, cap: string) => {
        ctx.fillStyle = accent; ctx.fillRect(cx, y0 + phh - 90, pw, 90);
        ctx.fillStyle = "#2b3a30"; ctx.font = `700 ${38 * BS}px "${fontFamily}", sans-serif`; ctx.textAlign = "center";
        ctx.fillText(cap || "", cx + pw / 2, y0 + phh - 34);
      };
      capBar(90, cap1); capBar(W - 90 - pw, cap2);
      ctx.fillStyle = text; ctx.font = `700 ${170 * HS}px "Playfair Display", serif`; ctx.textAlign = "right";
      ctx.fillText("AFTER", W - 40, H - 60);
    }

    else if (tpl === "minimal") {
      ctx.fillStyle = text; ctx.textAlign = "center";
      ctx.font = `800 ${46 * BS}px "${fontFamily}", sans-serif`;
      ctx.fillText((treatment || "treatment name"), W / 2, 90);
      ph(before, 560, 300, 440, 440, 46);
      ph(after, 560, 840, 440, 440, 46);
      ctx.textAlign = "left";
      ctx.font = `800 ${120 * HS}px "${fontFamily}", sans-serif`; ctx.fillStyle = text;
      ctx.fillText("before.", 100, 420);
      ctx.fillText("after.", 100, 960);
      ctx.font = `400 ${40 * BS}px "${fontFamily}", sans-serif`;
      wrap(ctx, backStory || "back story", 420).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 110, 500 + i * 50));
      wrap(ctx, details || "details", 420).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 110, 1040 + i * 50));
    }

    else if (tpl === "framed") {
      const drawFramed = (img: HTMLImageElement | null, cx: number, cy: number, rot: number) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
        const fw = 640, fh = 460;
        ctx.fillStyle = "#fdfdf7"; ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh); ctx.shadowColor = "transparent";
        ph(img, -fw / 2 + 22, -fh / 2 + 22, fw - 44, fh - 44);
        ctx.restore();
      };
      drawFramed(before, 560, 500, -1.5);
      drawFramed(after, 560, 1010, 1.5);
      const tab = (label: string, x: number, y: number) => {
        ctx.save(); ctx.fillStyle = accent; ctx.font = `800 italic ${44 * HS}px "${fontFamily}", sans-serif`;
        const tw = ctx.measureText(label).width + 60;
        ctx.fillRect(x, y, tw, 74);
        ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.fillText(label, x + 30, y + 52);
        ctx.restore();
      };
      tab("BEFORE", 90, 235);
      tab("AFTER", W - 340, H - 320);
      ctx.fillStyle = text; ctx.font = `800 italic ${46 * BS}px "${fontFamily}", sans-serif`; ctx.textAlign = "center";
      ctx.fillText((details || "DETAILS HERE").toUpperCase(), W / 2, H - 90);
    }
    if (logoImg && logoPos !== "none") {
      const lh = 120 * logoScale;
      const lw = lh * (logoImg.width / logoImg.height);
      const pad = 48;
      const x = logoPos.indexOf("r") >= 0 ? W - lw - pad : pad;
      const y = logoPos.indexOf("b") >= 0 ? H - lh - pad : pad;
      ctx.drawImage(logoImg, x, y, lw, lh);
    }
  }, [tpl, before, after, title, cap1, cap2, treatment, backStory, writeUp, details, bg, text, accent, logoImg, logoPos, logoScale, headingScale, bodyScale, fontFamily]);

  useEffect(() => {
    render();
    const t = setTimeout(render, 300);
    const f = (document as { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (f?.ready) f.ready.then(() => render()).catch(() => {});
    return () => clearTimeout(t);
  }, [render]);

  const download = () => {
    const c = canvasRef.current; if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `before-after-${Date.now()}.png`; a.click();
  };
  const upload = async (): Promise<string> => {
    const c = canvasRef.current!; const dataUrl = c.toDataURL("image/png");
    const up = await fetch(`${BASE}/api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: [{ name: `before-after-${Date.now()}.png`, base64: dataUrl }] }) });
    if (!up.ok) throw new Error("Image upload failed");
    const { results } = await up.json() as { results: { url: string }[] };
    const url = results[0]?.url; if (!url) throw new Error("No image URL returned"); return url;
  };
  const saveToLibrary = async () => {
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    if (!before || !after) { toast.error("Add both photos first"); return; }
    setSaving(true);
    try {
      const url = await upload();
      const lib = await fetch(`${BASE}/api/library`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName, postType: "single", caption: caption || writeUp || backStory || treatment, mediaUrl: url, metadata: { source: "before-after", template: tpl } }) });
      if (!lib.ok) throw new Error("Save failed");
      toast.success(`Saved to ${clientName}'s library`);
    } catch (e: any) { toast.error(e?.message || "Save failed"); } finally { setSaving(false); }
  };
  const schedule = async () => {
    if (!clientName.trim()) { toast.error("Pick a client first"); return; }
    if (!before || !after) { toast.error("Add both photos first"); return; }
    const preset = presets.find((p) => p.name === clientName);
    if (!preset) { toast.error("That client has no preset to post from"); return; }
    setScheduling(true);
    try {
      const url = await upload();
      const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId: preset.id, postType: "single-image", content: { imageUrls: [url], caption: caption || writeUp || backStory || treatment || "", title: "Before & After", platforms: ["instagram", "facebook"] }, scheduledAt: new Date(`${scheduleDate}T${scheduleTime}`).toISOString() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Schedule failed"); }
      toast.success(`Scheduled for ${scheduleDate} at ${scheduleTime}`);
    } catch (e: any) { toast.error(e?.message || "Schedule failed"); } finally { setScheduling(false); }
  };

  const field = "w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-pink-500/50";
  const showTitle = tpl === "polaroid";
  const showCaps = tpl === "polaroid" || tpl === "editorial";
  const showTreatment = tpl === "editorial" || tpl === "minimal";
  const showBack = tpl === "split" || tpl === "minimal";
  const showWrite = tpl === "polaroid" || tpl === "split";
  const showDetails = tpl === "minimal" || tpl === "framed";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/hub"><button className="text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button></Link>
          <h1 className="text-xl font-bold">Before &amp; After Maker</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => chooseTpl(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${tpl === t.id ? "bg-pink-600 border-pink-600" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"}`}>{t.name}</button>
              ))}
            </div>

            {subs.length > 0 && (
              <div>
                <label className="text-xs uppercase tracking-wide text-zinc-500">Pull from a submission</label>
                <select className={field} value={subId} onChange={(e) => pullSub(e.target.value)}>
                  <option value="">Choose a submitted before &amp; after</option>
                  {subs.map((sb) => <option key={sb.id} value={sb.id}>{sb.clientName}{sb.treatment ? " \u00b7 " + sb.treatment : ""} \u00b7 {new Date(sb.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {([["Before", beforeRef, before, loadFile("b")], ["After", afterRef, after, loadFile("a")]] as const).map(([lab, ref, img, onFile]) => (
                <div key={lab}>
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{lab}</label>
                  <button onClick={() => ref.current?.click()} className="mt-1 w-full h-28 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 flex items-center justify-center text-zinc-500 text-xs hover:border-pink-500/50 overflow-hidden">
                    {img ? <span className="text-emerald-400">Loaded ✓ (tap to change)</span> : <span className="flex flex-col items-center gap-1"><ImagePlus className="w-5 h-5" />Add {lab.toLowerCase()}</span>}
                  </button>
                  <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </div>
              ))}
            </div>

            {showTitle && <div><label className="text-xs uppercase tracking-wide text-zinc-500">Title</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></div>}
            {showTreatment && <div><label className="text-xs uppercase tracking-wide text-zinc-500">Treatment {tpl === "editorial" ? "& clinician" : "name"}</label><input className={field} value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder={tpl === "editorial" ? "treatment name and clinician name" : "treatment name"} /></div>}
            {showCaps && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500">Before caption</label><input className={field} value={cap1} onChange={(e) => setCap1(e.target.value)} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500">After caption</label><input className={field} value={cap2} onChange={(e) => setCap2(e.target.value)} /></div>
              </div>
            )}
            {showBack && <div><label className="text-xs uppercase tracking-wide text-zinc-500">Back story</label><textarea rows={2} className={field} value={backStory} onChange={(e) => setBackStory(e.target.value)} /></div>}
            {showWrite && <div><label className="text-xs uppercase tracking-wide text-zinc-500">Write up</label><textarea rows={2} className={field} value={writeUp} onChange={(e) => setWriteUp(e.target.value)} /></div>}
            {showDetails && <div><label className="text-xs uppercase tracking-wide text-zinc-500">Details</label><textarea rows={2} className={field} value={details} onChange={(e) => setDetails(e.target.value)} /></div>}

            <div className="flex items-center gap-4 flex-wrap">
              {([["Background", bg, setBg], ["Text", text, setText], ["Accent", accent, setAccent]] as const).map(([lab, val, set]) => (
                <div key={lab} className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">{lab}</label>
                  <input type="color" value={val} onChange={(e) => set(e.target.value)} className="h-8 w-12 rounded cursor-pointer border border-zinc-700 bg-transparent p-0.5" />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {([["Heading size", headingScale, setHeadingScale], ["Text size", bodyScale, setBodyScale], ["Logo size", logoScale, setLogoScale]] as const).map(([lab, val, set]) => (
                <div key={lab} className="flex items-center gap-3">
                  <label className="text-xs text-zinc-400 w-24">{lab}</label>
                  <input type="range" min={0.5} max={2} step={0.05} value={val} onChange={(e) => set(parseFloat(e.target.value))} className="flex-1" />
                  <span className="text-xs text-zinc-500 w-10">{Math.round(val * 100)}%</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-400 w-24">Logo position</label>
                <select value={logoPos} onChange={(e) => setLogoPos(e.target.value)} className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm outline-none">
                  <option value="none">Hidden</option>
                  <option value="tl">Top left</option>
                  <option value="tr">Top right</option>
                  <option value="bl">Bottom left</option>
                  <option value="br">Bottom right</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-400 w-24">Font</label>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm outline-none">
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase tracking-wide text-zinc-500">Caption (for the post)</label>
                <button onClick={generateCaption} disabled={genCap} className="text-xs text-pink-400 hover:text-pink-300 disabled:opacity-50">{genCap ? "Writing..." : "Generate from back story"}</button>
              </div>
              <textarea rows={4} className={field} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a storytelling caption, or generate one from the back story." />
            </div>

            <div className="border-t border-zinc-800 pt-4 space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-zinc-500">Client (for save / schedule)</label>
                <select className={field} value={clientName} onChange={(e) => setClientName(e.target.value)}>
                  <option value="">Select client</option>
                  {presets.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input type="date" className={field} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                <input type="time" className={field} value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={download} className="flex-1"><Download className="w-4 h-4 mr-2" />Download</Button>
                <Button variant="outline" onClick={saveToLibrary} disabled={saving} className="flex-1">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Library className="w-4 h-4 mr-2" />}Save to library</Button>
                <Button onClick={schedule} disabled={scheduling} className="flex-1 bg-pink-600 hover:bg-pink-700">{scheduling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}Schedule</Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 h-fit sticky top-6">
            <canvas ref={canvasRef} className="w-full block" style={{ aspectRatio: "3 / 4" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
