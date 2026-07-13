import { useState, useEffect } from "react";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { MusicPickerModal, type MusicTrack } from "@/components/music-picker-modal";
import { renderSlideCanvas, makeBlocks, computeTuckedSubtitleY, SlideEditorModal, SCALE, type CsvRow, type Block } from "@/pages/bulk-carousel";
import JSZip from "jszip";
import Papa from "papaparse";
import { toast } from "sonner";

import { nextWeekday, WEEKDAY, POST_TIME, shortTagForBookedPost } from "@/lib/schedule";
import { useBookedDays } from "@/lib/use-booked-days";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Small reusable strip showing what's already booked in for a client over the next
// 14 days, so you can see the picture (including other tools) while you schedule
// this batch. Read-only display alongside the per-carousel date/time fields below.
function BookedDaysStrip({ presetId }: { presetId: number | null }) {
const { byDate } = useBookedDays(presetId, 14);
if (presetId === null) return null;
const nextDays = Array.from({ length: 14 }, (_, i) => {
const d = new Date();
d.setHours(0, 0, 0, 0);
d.setDate(d.getDate() + i);
return d;
});
const dateKey = (d: Date) => {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
};
return (
<div className="mb-6">
<p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">What's already booked (next 14 days)</p>
<div className="flex gap-1.5 overflow-x-auto pb-1">
{nextDays.map((d) => {
const key = dateKey(d);
const bookings = byDate[key] ?? [];
const booked = bookings.length > 0;
const tagText = bookings.map((b) => shortTagForBookedPost({ postType: "", content: { sourceTool: b.label } })).join("+");
return (
<div
key={key}
title={booked ? `Already booked: ${bookings.map((b) => `${b.label}${b.count > 1 ? ` x${b.count}` : ""}`).join(", ")}` : "Free — nothing scheduled yet"}
className={`flex flex-col items-center justify-center shrink-0 w-11 h-13 py-1 rounded-md border text-[11px] font-medium ${
booked ? "bg-card/60 border-border/50 text-muted-foreground" : "bg-card/30 border-emerald-600/40 text-emerald-400"
}`}
>
<span>{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
<span>{d.getDate()}</span>
{booked && <span className="text-[8px] leading-none mt-0.5">{tagText}</span>}
</div>
);
})}
</div>
</div>
);
}
const SLIDE_W = 1080, SLIDE_H = 1440;
const EMPTY_ROW: CsvRow = { slide1_hook: "", slide1_subtitle: "", slide2_body: "", slide3_body: "", slide4_cta: "" };
const DEFAULT_PRESET = { pageColor: "#000000", overlayColor: "rgba(0,0,0,0)", textColor: "#ffffff", cornerColor: "#ffffff", accentColor: "#ffffff" } as unknown as ClientPreset;

type Strip = { id: string; file: File; url: string; width: number; height: number; slides: number };
type Carousel = {
id: string; name: string;
raw: string[]; slideImgs: HTMLImageElement[]; slideUrls: string[];
row: CsvRow; blocks: Block[];
presetId: number | null; caption: string; date: string; time: string; track: MusicTrack | null;
assignedRow?: number;
};
type PRow = { slide1_hook: string; slide1_subtitle: string; slide2_body: string; slide3_body: string; slide4_cta: string; client: string; caption: string; date: string; time: string; };

function loadImg(src: string): Promise<HTMLImageElement> { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; }); }
function loadImgCors(src: string): Promise<HTMLImageElement> { return new Promise((r, j) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = j; i.src = src; }); }
function fileToImage(f: File): Promise<HTMLImageElement> { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(f); }); }
function cutStrip(img: HTMLImageElement, n: number): string[] {
const W = img.naturalWidth, H = img.naturalHeight, sw = W / n; const out: string[] = [];
for (let i = 0; i < n; i++) { const c = document.createElement("canvas"); c.width = SLIDE_W; c.height = SLIDE_H; c.getContext("2d")!.drawImage(img, i * sw, 0, sw, H, 0, 0, SLIDE_W, SLIDE_H); out.push(c.toDataURL("image/png")); }
return out;
}
function accentOf(p: ClientPreset | null): string { return (p as any)?.accentColor || (p as any)?.cornerColor || "#ffffff"; }
function blocksFromRow(row: CsvRow): Block[] {
const blocks = makeBlocks(row);
const sub = blocks.find((b) => b.id === "subtitle"); const hook = blocks.find((b) => b.id === "hook");
if (sub) sub.y = computeTuckedSubtitleY(row.slide1_hook, row.slide1_subtitle, hook, sub);
return blocks;
}
async function renderFromBlocks(raw: string[], imgs: HTMLImageElement[], blocks: Block[], preset: ClientPreset | null): Promise<string[]> {
const hasText = blocks.some((b) => ((b as any).text || "").trim());
const p = preset || DEFAULT_PRESET; const accent = "#ffffff"; const overlay = (p as any).overlayColor || "rgba(0,0,0,0)";
let logoImg: HTMLImageElement | null = null;
const logoUrl = (p as any)?.logoUrl;
if (logoUrl) { try { logoImg = await loadImgCors(logoUrl); } catch {} }
if (!hasText && !logoImg) return raw;
await document.fonts.ready;
const out: string[] = [];
for (let i = 0; i < raw.length; i++) {
if (i + 1 > 4) { out.push(raw[i]); continue; }
const n = (i + 1) as 1 | 2 | 3 | 4; const img = imgs[i] || null;
const blocksForRender = blocks.map((b) => (b.id === "logo" ? { ...b, x: 0.17, y: 0.12, w: 0.26 } : b));
out.push(renderSlideCanvas(n, blocksForRender, n === 1 ? img : null, n === 1 ? null : img, logoImg, p, SCALE, false, 1.2, accent, "#ffffff", overlay, 0));
}
return out;
}
async function compress(du: string, q = 0.85): Promise<string> {
return new Promise((res) => { const i = new Image(); i.onload = () => { const s = Math.min(1, 1080 / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s); c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q)); }; i.onerror = () => res(du); i.src = du; });
}
async function uploadDataUrls(dus: string[], names: string[]): Promise<string[]> {
const urls: string[] = [];
for (let i = 0; i < dus.length; i += 4) {
const images = await Promise.all(dus.slice(i, i + 4).map(async (du, j) => ({ name: names[i + j], base64: await compress(du) })));
const r = await fetch(`${BASE}/api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
if (!r.ok) throw new Error("Image upload failed");
const d = await r.json(); (d.results || []).forEach((x: { url: string }) => urls.push(x.url));
}
return urls;
}
function normDate(v: string) { const x = (v || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x; const m = x.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; } return x; }
function normTime(v: string) { const x = (v || "").trim(); const m = x.match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : x; }
function seamlessDate(i: number): string { const day = i % 2 === 0 ? WEEKDAY.MON : WEEKDAY.FRI; const week = Math.floor(i / 2); const first = new Date(`${nextWeekday(day, POST_TIME)}T${POST_TIME}`); const d = new Date(first); d.setDate(d.getDate() + week * 7); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day2 = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day2}`; }

// Builds a browser download from a Blob. The anchor is attached to the DOM
// before .click() and removed straight after — an unattached anchor's click()
// is a known no-op in some browsers, which is what was silently breaking the
// ZIP and CSV template downloads on this page. The object URL is revoked a
// beat later so the download has time to start first.
function triggerDownload(blob: Blob, filename: string) {
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SeamlessBulk() {
const { presets } = usePresets();
const [strips, setStrips] = useState<Strip[]>([]);
const [carousels, setCarousels] = useState<Carousel[]>([]);
const [phase, setPhase] = useState<"upload" | "preview">("upload");
const [busy, setBusy] = useState(false);
const [musicId, setMusicId] = useState<string | null>(null);
const [editId, setEditId] = useState<string | null>(null);
const [excluded, setExcluded] = useState<Set<string>>(new Set());
const [csvParsed, setCsvParsed] = useState<PRow[]>([]);
const [batchPresetId, setBatchPresetId] = useState<number | null>(null);
const [genning, setGenning] = useState(false);
const [genId, setGenId] = useState<string | null>(null);
const [editLogo, setEditLogo] = useState<HTMLImageElement | null>(null);
const isIn = (id: string) => !excluded.has(id);
const toggleIn = (id: string) => setExcluded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

// Picks up a composite handed off from Seamless Caro Builder — the wide
// background+photo image is already sitting at a URL, so this just fetches
// it once as a strip instead of making Vanessa download and re-upload it.
useEffect(() => {
  const raw = sessionStorage.getItem("seamless-caro-handoff");
  if (!raw) return;
  sessionStorage.removeItem("seamless-caro-handoff");
  (async () => {
    try {
      const { imageUrl, slideCount } = JSON.parse(raw) as { imageUrl: string; slideCount: number };
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "seamless-caro.png", { type: blob.type || "image/png" });
      const img = await fileToImage(file);
      setStrips((p) => [...p, { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, file, url: img.src, width: img.naturalWidth, height: img.naturalHeight, slides: Math.max(2, Math.min(5, slideCount || 3)) }]);
      toast.success("Brought in from Seamless Caro Builder — ready to cut.");
    } catch {
      toast.error("Couldn't bring in the image from Seamless Caro Builder.");
    }
  })();
}, []);

async function onFiles(list: FileList | null) {
if (!list) return; const added: Strip[] = [];
for (const file of Array.from(list)) { if (!file.type.startsWith("image/")) continue; const img = await fileToImage(file); const g = Math.max(2, Math.min(5, Math.round(img.naturalWidth / SLIDE_W))); added.push({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, file, url: img.src, width: img.naturalWidth, height: img.naturalHeight, slides: g }); }
setStrips((p) => [...p, ...added]);
}

async function cutAll() {
if (!strips.length) { toast.error("Add at least one strip."); return; }
setBusy(true);
try {
const out: Carousel[] = [];
const preset = presetFor(batchPresetId);
let idx = 0;
for (const s of strips) {
const img = await fileToImage(s.file); const raw = cutStrip(img, s.slides); const slideImgs = await Promise.all(raw.map(loadImg));
const blocks = blocksFromRow(EMPTY_ROW);
const slideUrls = await renderFromBlocks(raw, slideImgs, blocks, preset);
out.push({ id: `c-${Math.random().toString(36).slice(2, 7)}`, name: s.file.name.replace(/\.[^.]+$/, ""), raw, slideImgs, slideUrls, row: { ...EMPTY_ROW }, blocks, presetId: batchPresetId, caption: "", date: seamlessDate(idx), time: POST_TIME, track: null });
idx++;
}
setCarousels(out); setPhase("preview");
} catch (e: any) { toast.error(e?.message || "Cutting failed"); } finally { setBusy(false); }
}

function update(id: string, patch: Partial<Carousel>) { setCarousels((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
function removeCarousel(id: string) { setCarousels((p) => p.filter((c) => c.id !== id)); }
function presetFor(id: number | null) { return presets.find((p) => p.id === id) || null; }

function importCsv(file: File) {
Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res: any) => {
const rows = (res.data || []) as any[];
const key = (r: any, ...n: string[]) => { for (const k of Object.keys(r)) if (n.includes(k.trim().toLowerCase())) return r[k]; return ""; };
const parsed: PRow[] = rows.map((r) => ({
slide1_hook: String(key(r, "slide1_hook") ?? ""), slide1_subtitle: String(key(r, "slide1_subtitle") ?? ""),
slide2_body: String(key(r, "slide2_body") ?? ""), slide3_body: String(key(r, "slide3_body") ?? ""), slide4_cta: String(key(r, "slide4_cta") ?? ""),
client: String(key(r, "client", "clinic", "account") || "").trim(),
caption: String(key(r, "caption") || ""), date: key(r, "date") ? normDate(key(r, "date")) : "", time: key(r, "time") ? normTime(key(r, "time")) : "",
}));
setCsvParsed(parsed);
toast.success(`Loaded ${parsed.length} row(s). Pick a row for each carousel to marry them up.`);
}, error: () => toast.error("Could not read that CSV.") });
}

async function applyClientToAll(pid: number | null) {
setBatchPresetId(pid);
const preset = presetFor(pid);
setBusy(true);
try {
const updated = await Promise.all(carousels.map(async (c, i) => {
const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, preset);
return { ...c, presetId: pid, date: c.date || seamlessDate(i), slideUrls };
}));
setCarousels(updated);
if (pid) toast.success("Client applied to the whole batch, logo and all.");
} finally { setBusy(false); }
}

async function assignRow(id: string, idx: number) {
const c = carousels.find((x) => x.id === id); if (!c) return;
if (idx < 0) { update(id, { assignedRow: -1 }); return; }
const pr = csvParsed[idx]; if (!pr) return;
setBusy(true);
try {
const row: CsvRow = { slide1_hook: pr.slide1_hook, slide1_subtitle: pr.slide1_subtitle, slide2_body: pr.slide2_body, slide3_body: pr.slide3_body, slide4_cta: pr.slide4_cta };
const preset = pr.client ? (presets.find((p) => p.name.trim().toLowerCase() === pr.client.toLowerCase()) || null) : presetFor(c.presetId);
const blocks = blocksFromRow(row);
const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, blocks, preset);
update(id, { row, blocks, presetId: preset ? preset.id : c.presetId, caption: pr.caption || c.caption, date: pr.date || c.date, time: pr.time || c.time, slideUrls, assignedRow: idx });
} catch (e: any) { toast.error(e?.message || "Could not apply that row"); } finally { setBusy(false); }
}

async function fillInOrder() {
for (let i = 0; i < carousels.length && i < csvParsed.length; i++) { await assignRow(carousels[i].id, i); }
toast.success("Rows matched to carousels in order.");
}

async function genCaptionFor(c: Carousel): Promise<string | undefined> {
const res = await fetch(`${BASE}/api/carousel/generate-caption`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: c.row.slide1_hook, subtitle: c.row.slide1_subtitle, body2: c.row.slide2_body, body3: c.row.slide3_body, cta: c.row.slide4_cta }) });
if (!res.ok) return undefined;
const d = await res.json(); return d.caption as string;
}
async function generateOne(id: string) {
const c = carousels.find((x) => x.id === id); if (!c) return;
setGenId(id);
try { const cap = await genCaptionFor(c); if (cap) update(id, { caption: cap }); else toast.error("Caption failed"); } catch (e: any) { toast.error(e?.message || "Caption failed"); } finally { setGenId(null); }
}
async function generateCaptions() {
const list = carousels.filter((c) => isIn(c.id));
if (!list.length) { toast.error("No carousels selected."); return; }
setGenning(true); const tid = toast.loading("Writing captions…"); let ok = 0;
for (let i = 0; i < list.length; i++) { toast.loading(`Caption ${i + 1} / ${list.length}…`, { id: tid }); try { const cap = await genCaptionFor(list[i]); if (cap) { update(list[i].id, { caption: cap }); ok++; } } catch {} }
setGenning(false); toast.success(`Wrote ${ok} caption${ok !== 1 ? "s" : ""}.`, { id: tid });
}

function updateRow(id: string, field: keyof CsvRow, value: string) { setCarousels((p) => p.map((c) => (c.id === id ? { ...c, row: { ...c.row, [field]: value } } : c))); }
async function applyText(id: string) {
const c = carousels.find((x) => x.id === id); if (!c) return;
setBusy(true);
try { const blocks = blocksFromRow(c.row); const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, blocks, presetFor(c.presetId)); update(id, { blocks, slideUrls }); } finally { setBusy(false); }
}
async function changeClient(id: string, presetId: number | null) {
const c = carousels.find((x) => x.id === id); update(id, { presetId });
if (c) { const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, presetFor(presetId)); update(id, { presetId, slideUrls }); }
}
async function saveEdit(id: string, blocks: Block[]) {
const c = carousels.find((x) => x.id === id); if (!c) return;
setBusy(true);
try { const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, blocks, presetFor(c.presetId)); update(id, { blocks, slideUrls }); } finally { setBusy(false); setEditId(null); }
}
function downloadTemplate() {
const csv = "client,caption,date,time,slide1_hook,slide1_subtitle,slide2_body,slide3_body,slide4_cta\nTweaked By Helen,\"Your caption\",2026-07-10,10:00,YOUR HOOK,A supporting line,Body slide two,Body slide three,DM me to book\n";
triggerDownload(new Blob([csv], { type: "text/csv" }), "seamless-template.csv");
}
async function downloadZip() {
const selected = carousels.filter((c) => isIn(c.id));
if (!selected.length) { toast.error("Nothing selected. Tick at least one carousel first."); return; }
const tid = toast.loading("Building ZIP…");
try {
const zip = new JSZip();
selected.forEach((c, ci) => {
const fo = zip.folder(`${ci + 1}-${c.name}`.slice(0, 40))!;
c.slideUrls.forEach((du, si) => fo.file(`slide-${si + 1}.png`, du.split(",")[1], { base64: true }));
});
const blob = await zip.generateAsync({ type: "blob" });
triggerDownload(blob, "seamless-carousels.zip");
toast.success("ZIP downloaded.", { id: tid });
} catch (e: any) { toast.error(e?.message || "ZIP failed", { id: tid }); }
}
async function scheduleAll() {
const ready = carousels.filter((c) => isIn(c.id) && c.presetId && c.date && c.time);
if (!ready.length) { toast.error("Give at least one carousel a client, date and time."); return; }
setBusy(true); const tid = toast.loading("Uploading and scheduling…");
try {
for (let i = 0; i < ready.length; i++) {
const c = ready[i]; toast.loading(`Scheduling ${i + 1} / ${ready.length}…`, { id: tid });
const names = c.slideUrls.map((_, j) => `seamless-${i + 1}-slide${j + 1}.png`);
const imageUrls = await uploadDataUrls(c.slideUrls, names);
const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId: c.presetId, postType: "carousel", content: { imageUrls, caption: c.caption || "", title: (c.row.slide1_hook || c.name).slice(0, 80), platforms: ["instagram", "facebook"], musicTrack: c.track || undefined, sourceTool: "Seamless Carousels" }, scheduledAt: new Date(`${c.date}T${c.time}`).toISOString() }) });
if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(`${c.name}: ${err.error}`); }
}
toast.success(`${ready.length} seamless carousel${ready.length !== 1 ? "s" : ""} queued.`, { id: tid });
} catch (e: any) { toast.error(e?.message || "Scheduling failed", { id: tid }); } finally { setBusy(false); }
}

const editing = carousels.find((c) => c.id === editId) || null;
useEffect(() => {
let alive = true; setEditLogo(null);
const url = editing ? (presetFor(editing.presetId) as any)?.logoUrl : null;
if (url) loadImgCors(url).then((im) => { if (alive) setEditLogo(im); }).catch(() => {});
return () => { alive = false; };
}, [editId]);

return (
<div className="min-h-[100dvh] w-full bg-background text-foreground">
<header className="border-b border-border/40 px-6 py-5">
<h1 className="text-2xl font-bold">Seamless Carousels</h1>
<p className="text-sm text-muted-foreground mt-1">Drop wide strips, cut into 2 to 5 slides, drop your usual CSV to lay text over the top, drag it about, and schedule the lot.</p>
</header>

{editing && (
<SlideEditorModal
item={{ blocks: editing.blocks, coverImg: null, bodyImg: null }}
preset={presetFor(editing.presetId) || DEFAULT_PRESET}
logoImg={editLogo}
heroWordColor="#ffffff"
subtitleColor="#ffffff"
overlayColor={(presetFor(editing.presetId) as any)?.overlayColor || "rgba(0,0,0,0)"}
overlayAlpha={0}
slideBackgrounds={editing.slideImgs}
onSave={(blocks) => saveEdit(editing.id, blocks)}
onClose={() => setEditId(null)}
/>
)}

<main className="max-w-5xl mx-auto px-6 py-8">
{phase === "upload" && (
<div className="space-y-6">
<label className="block border-2 border-dashed border-border/50 rounded-2xl p-10 text-center cursor-pointer hover:border-pink-500/60 transition-colors">
<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
<p className="text-lg font-medium">Drop your wide strips here</p>
<p className="text-sm text-muted-foreground mt-1">One strip per carousel. e.g. 4320 x 1440 for 4 slides.</p>
</label>
{strips.length > 0 && (
<div className="space-y-3">
{strips.map((s) => (
<div key={s.id} className="flex items-center gap-4 rounded-xl border border-border/40 p-3">
<img src={s.url} alt="" className="h-16 w-40 object-cover rounded-md bg-black/30" />
<div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.file.name}</p><p className="text-xs text-muted-foreground">{s.width} x {s.height} px</p></div>
<label className="text-sm flex items-center gap-2">Slides
<select value={s.slides} onChange={(e) => setStrips((p) => p.map((x) => x.id === s.id ? { ...x, slides: Number(e.target.value) } : x))} className="bg-white/5 border border-border/50 rounded-md px-2 py-1">{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
</label>
<button onClick={() => setStrips((p) => p.filter((x) => x.id !== s.id))} className="text-muted-foreground hover:text-foreground px-2">✕</button>
</div>
))}
<div className="w-full flex items-center gap-2">
<label className="text-sm text-muted-foreground shrink-0">Client for this whole upload</label>
<select value={batchPresetId ?? ""} onChange={(e) => setBatchPresetId(e.target.value ? Number(e.target.value) : null)} className="flex-1 bg-white/5 border border-pink-500/40 rounded-md px-3 py-2 text-sm"><option value="">Select a client…</option>{presets.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}</select>
</div>
<button onClick={cutAll} disabled={busy} className="px-6 py-3 rounded-full bg-pink-500 text-white font-semibold disabled:opacity-40 hover:bg-pink-400 transition-colors">{busy ? "Cutting…" : `Cut ${strips.length} strip${strips.length !== 1 ? "s" : ""} into slides`}</button>
</div>
)}
</div>
)}

{phase === "preview" && (
<div className="space-y-6">
<div className="flex items-center justify-between flex-wrap gap-3">
<button onClick={() => setPhase("upload")} className="text-sm text-muted-foreground hover:text-foreground">← Back to strips</button>
<div className="flex gap-3 flex-wrap items-center">
<select value={batchPresetId ?? ""} onChange={(e) => applyClientToAll(e.target.value ? Number(e.target.value) : null)} className="bg-white/5 border border-pink-500/40 rounded-lg px-3 py-2 text-sm"><option value="">Client for all…</option>{presets.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}</select>
<button onClick={downloadTemplate} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">CSV template</button>
<label className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm cursor-pointer">Load CSV rows<input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.currentTarget.value = ""; }} /></label>
{csvParsed.length > 0 && <button onClick={fillInOrder} disabled={busy} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Match in order</button>}
<button onClick={() => setExcluded(new Set())} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Select all</button>
<button onClick={() => setExcluded(new Set(carousels.map((c) => c.id)))} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Clear</button>
<button onClick={generateCaptions} disabled={genning} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm disabled:opacity-40">{genning ? "Writing…" : "Generate captions"}</button>
<button onClick={downloadZip} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Download selected (ZIP)</button>
<button onClick={scheduleAll} disabled={busy} className="px-5 py-2 rounded-lg bg-pink-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-pink-400">{busy ? "Working…" : `Schedule selected (${carousels.filter((c) => isIn(c.id)).length})`}</button>
</div>
</div>
<BookedDaysStrip presetId={batchPresetId} />
{carousels.map((c) => (
<div key={c.id} className={`rounded-2xl border p-4 space-y-4 transition-opacity ${isIn(c.id) ? "border-pink-500/40" : "border-border/40 opacity-50"}`}>
<label className="flex items-center gap-2 text-sm cursor-pointer select-none">
<input type="checkbox" checked={isIn(c.id)} onChange={() => toggleIn(c.id)} className="w-4 h-4 accent-pink-500" />
<span className="font-semibold">{c.name}</span>
<span className="text-xs text-muted-foreground">{isIn(c.id) ? "included" : "excluded"}</span>
</label>
{csvParsed.length > 0 && (
<div className="flex items-center gap-2">
<label className="text-xs uppercase tracking-widest text-muted-foreground shrink-0">CSV row</label>
<select value={c.assignedRow ?? -1} onChange={(e) => assignRow(c.id, Number(e.target.value))} className="flex-1 bg-white/5 border border-pink-500/40 rounded-md px-3 py-2 text-sm">
<option value={-1}>None (type it in manually)</option>
{csvParsed.map((pr, idx) => <option key={idx} value={idx}>{idx + 1}. {(pr.slide1_hook || "(no hook)").slice(0, 44)}{pr.client ? ` — ${pr.client}` : ""}</option>)}
</select>
</div>
)}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
{c.slideUrls.map((du, si) => (
<div key={si} className="relative">
<img src={du} alt={`slide ${si + 1}`} className="w-full rounded-lg object-cover border border-white/10" style={{ aspectRatio: "3/4" }} />
<span className="absolute top-1.5 left-1.5 text-[10px] bg-black/60 text-white/80 rounded px-1.5 py-0.5">Slide {si + 1}</span>
</div>
))}
</div>
<div className="flex flex-wrap gap-2">
<button onClick={() => setEditId(c.id)} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold">Edit slides (drag text)</button>
</div>
<div className="rounded-xl bg-white/[0.03] border border-border/40 p-3 space-y-2">
<p className="text-xs uppercase tracking-widest text-muted-foreground">Text on the slides</p>
<div className="grid sm:grid-cols-2 gap-2">
<input value={c.row.slide1_hook} onChange={(e) => updateRow(c.id, "slide1_hook", e.target.value)} placeholder="Slide 1 hook" className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
<input value={c.row.slide1_subtitle} onChange={(e) => updateRow(c.id, "slide1_subtitle", e.target.value)} placeholder="Slide 1 subtitle" className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
<input value={c.row.slide2_body} onChange={(e) => updateRow(c.id, "slide2_body", e.target.value)} placeholder="Slide 2 text" className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
<input value={c.row.slide3_body} onChange={(e) => updateRow(c.id, "slide3_body", e.target.value)} placeholder="Slide 3 text" className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm" />
<input value={c.row.slide4_cta} onChange={(e) => updateRow(c.id, "slide4_cta", e.target.value)} placeholder="Slide 4 text / CTA" className="bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm sm:col-span-2" />
</div>
<button onClick={() => applyText(c.id)} disabled={busy} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40">Update slides</button>
</div>
<div className="grid sm:grid-cols-2 gap-3">
<div><label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Client</label>
<select value={c.presetId ?? ""} onChange={(e) => changeClient(c.id, e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2"><option value="">Select a client…</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
</div>
<div className="grid grid-cols-2 gap-2">
<div><label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Date</label><input type="date" value={c.date} onChange={(e) => update(c.id, { date: e.target.value })} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" /></div>
<div><label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Time</label><input type="time" value={c.time} onChange={(e) => update(c.id, { time: e.target.value })} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" /></div>
</div>
<div className="sm:col-span-2"><div className="flex items-center justify-between mb-1"><label className="block text-xs uppercase tracking-widest text-muted-foreground">Caption</label><button onClick={() => generateOne(c.id)} disabled={genId === c.id} className="text-xs text-pink-300 hover:text-pink-200 disabled:opacity-40">{genId === c.id ? "Writing…" : "✨ Generate"}</button></div><textarea value={c.caption} onChange={(e) => update(c.id, { caption: e.target.value })} rows={2} className="w-full bg-white/5 border border-border/50 rounded-md px-3 py-2" placeholder="Caption…" /></div>
</div>
<div className="flex items-center gap-3 flex-wrap">
<button onClick={() => setMusicId(c.id)} className={`px-3 py-1.5 rounded-lg border text-sm ${c.track ? "border-green-500/50 text-green-300" : "border-border/50 hover:border-pink-500/60"}`}>🎵 {c.track ? c.track.name.slice(0, 24) : "Add music"}</button>
<button onClick={() => removeCarousel(c.id)} className="text-sm text-red-300 hover:text-red-200 ml-auto">Delete this carousel</button>
</div>
</div>
))}
</div>
)}
</main>

<MusicPickerModal open={musicId !== null} onClose={() => setMusicId(null)} selectedTrack={musicId ? (carousels.find((c) => c.id === musicId)?.track ?? null) : null} onSelect={(t) => { if (musicId) update(musicId, { track: t }); setMusicId(null); }} />
</div>
);
}
