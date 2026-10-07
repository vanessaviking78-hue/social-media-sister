import { useState, useEffect, useRef } from "react";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import { MusicPickerModal, type MusicTrack } from "@/components/music-picker-modal";
import { renderSlideCanvas, makeBlocks, computeTuckedSubtitleY, SlideEditorModal, SCALE, LOCKED_LINE_SPACING, type CsvRow, type Block } from "@/pages/bulk-carousel";
import { FONT_OPTIONS } from "@/lib/slide-utils";
import JSZip from "jszip";
import Papa from "papaparse";
import { smartMapCsvHeaders, readFileAsText } from "@/lib/csv-format";
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
const EMPTY_ROW: CsvRow = { hook: "", cta: "" };
const DEFAULT_PRESET = { pageColor: "#000000", overlayColor: "rgba(0,0,0,0)", textColor: "#ffffff", cornerColor: "#ffffff", accentColor: "#ffffff" } as unknown as ClientPreset;

type Strip = { id: string; file: File; url: string; width: number; height: number; slides: number };
type Carousel = {
id: string; name: string; sourceFile: File;
raw: string[]; slideImgs: HTMLImageElement[]; slideUrls: string[];
row: CsvRow; blocks: Block[];
presetId: number | null; caption: string; date: string; time: string; track: MusicTrack | null;
assignedRow?: number;
  imageOpacity: number; imageZoom: number; imageShadow: boolean; textBg: boolean;
  textFont: string;
  textBgColor: string;
};
type PRow = CsvRow & { client: string; caption: string; date: string; time: string };

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
if (sub) sub.y = computeTuckedSubtitleY((row as any).slide1_hook ?? row.hook, (row as any).slide1_subtitle ?? "", hook, sub);
return blocks;
}

// How many slides a CSV row actually calls for: the hook always counts, any
// body column with real text in this row counts, and the CTA only counts
// when this row's last column isn't blank — matches the same rule Bulk
// Carousel Creator uses, so a strip gets cut into exactly as many pieces as
// the row needs rather than always assuming a fixed shape.
function desiredSlideCount(row: CsvRow): number {
return makeBlocks(row).filter((b) => /^(hook|body\d+|cta)$/.test(b.id)).length;
}
async function renderFromBlocks(raw: string[], imgs: HTMLImageElement[], blocks: Block[], preset: ClientPreset | null, imageOpacity = 1, imageZoom = 1, imageShadow = false, textBg = false, textFont = "", textBgColor = "#000000"): Promise<string[]> {
const hasText = blocks.some((b) => ((b as any).text || "").trim());
const p = preset || DEFAULT_PRESET; const accent = "#ffffff";
  // Seamless Carousels used to always render at full opacity with no legibility
  // box at all (Vanessa asked for that twice after it kept reverting). It's now
  // a genuine per-carousel opt-in instead of hardcoded either way: off by
  // default (same look as before), on uses the client's saved overlay colour.
  const hexToRgba = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const overlay = textBg ? (textBgColor ? hexToRgba(textBgColor, 0.55) : (p.overlayColor || "rgba(0,0,0,0.55)")) : "rgba(0,0,0,0)";
let logoImg: HTMLImageElement | null = null;
const logoUrl = (p as any)?.logoUrl;
if (logoUrl) { try { logoImg = await loadImgCors(logoUrl); } catch {} }
if (!hasText && !logoImg) return raw;
await document.fonts.ready;
const out: string[] = [];
for (let i = 0; i < raw.length; i++) {
const n = i + 1; const img = imgs[i] || null;
// Drop the decorative underline when there's no caption text at all (e.g.
// composites straight from Selfie to Carousels / Seamless Caro Builder before
// captions are written) — it was showing as a stray white line with nothing
// above it to underline. Logo only goes on slide 1, not repeated on every slide.
const blocksForRender = blocks
  .filter((b) => hasText || b.id !== "line")
  .map((b) => (b.id === "logo" ? { ...b, x: 0.17, y: 0.12, w: 0.26 } : b));
const logoForSlide = i === 0 ? logoImg : null;
// Was hardcoded to 1.2 here, which is why these slides always rendered with
// noticeably looser line spacing than the edit preview showed, and looser
// than the main Bulk Carousel Creator besides. Locked to the same 0.9 as
// everywhere else now.
        out.push(renderSlideCanvas(n, blocksForRender, n === 1 ? img : null, n === 1 ? null : img, logoForSlide, p, SCALE, false, LOCKED_LINE_SPACING, accent, overlay, imageOpacity, imageZoom, imageShadow, textFont || undefined));
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
function dateForPattern(days: (typeof WEEKDAY)[keyof typeof WEEKDAY][], i: number): string { const list = days.length ? days : [WEEKDAY.MON]; const day = list[i % list.length]; const week = Math.floor(i / list.length); const first = new Date(`${nextWeekday(day, POST_TIME)}T${POST_TIME}`); const d = new Date(first); d.setDate(d.getDate() + week * 7); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day2 = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day2}`; }
function seamlessDate(i: number): string { return dateForPattern([WEEKDAY.MON, WEEKDAY.FRI], i); }

// Quick reschedule presets, for bulk-assigning dates across a whole batch in one click.
const DAY_OPTIONS: { value: (typeof WEEKDAY)[keyof typeof WEEKDAY]; label: string }[] = [
{ value: WEEKDAY.MON, label: "Every Monday" },
{ value: WEEKDAY.TUE, label: "Every Tuesday" },
{ value: WEEKDAY.WED, label: "Every Wednesday" },
{ value: WEEKDAY.THU, label: "Every Thursday" },
{ value: WEEKDAY.FRI, label: "Every Friday" },
{ value: WEEKDAY.SAT, label: "Every Saturday" },
{ value: WEEKDAY.SUN, label: "Every Sunday" },
];

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
const imageStyleTickets = useRef<Record<string, number>>({});
const [phase, setPhase] = useState<"upload" | "preview">("upload");
const [busy, setBusy] = useState(false);
const [musicId, setMusicId] = useState<string | null>(null);
const [editId, setEditId] = useState<string | null>(null);
const [excluded, setExcluded] = useState<Set<string>>(new Set());
const [csvParsed, setCsvParsed] = useState<PRow[]>([]);
const [batchPresetId, setBatchPresetId] = useState<number | null>(null);
const [broadcastMode, setBroadcastMode] = useState(false);
const [broadcastPresetIds, setBroadcastPresetIds] = useState<Set<number>>(new Set());
const [genning, setGenning] = useState(false);
const [genId, setGenId] = useState<string | null>(null);
const [editLogo, setEditLogo] = useState<HTMLImageElement | null>(null);
const [customDay, setCustomDay] = useState<(typeof WEEKDAY)[keyof typeof WEEKDAY]>(WEEKDAY.TUE);
const isIn = (id: string) => !excluded.has(id);
const toggleIn = (id: string) => setExcluded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

// Picks up composites handed off from Seamless Caro Builder — the wide
// background+photo images are already sitting at URLs, so this just fetches
// them once as strips instead of making Vanessa download and re-upload them.
// Backward-compatible with the old single-object handoff shape as well as
// the newer array shape from the bulk Seamless Caro Builder.
useEffect(() => {
  const raw = sessionStorage.getItem("seamless-caro-handoff");
  if (!raw) return;
  sessionStorage.removeItem("seamless-caro-handoff");
  (async () => {
    try {
      const parsed = JSON.parse(raw);
      const items: { imageUrl: string; slideCount: number }[] = Array.isArray(parsed) ? parsed : [parsed];
      let failed = 0;
      const newStrips: Strip[] = [];
      for (const item of items) {
        try {
          const { imageUrl, slideCount } = item;
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const file = new File([blob], "seamless-caro.png", { type: blob.type || "image/png" });
          const img = await fileToImage(file);
          newStrips.push({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, file, url: img.src, width: img.naturalWidth, height: img.naturalHeight, slides: Math.max(2, Math.min(5, slideCount || 3)) });
        } catch {
          failed++;
        }
      }
      if (newStrips.length) setStrips((p) => [...p, ...newStrips]);
      if (newStrips.length && !failed) {
        toast.success(newStrips.length > 1 ? `Brought in ${newStrips.length} from Seamless Caro Builder — ready to cut.` : "Brought in from Seamless Caro Builder — ready to cut.");
      } else if (newStrips.length && failed) {
        toast.success(`Brought in ${newStrips.length}, ${failed} couldn't load — ready to cut the rest.`);
      } else {
        toast.error("Couldn't bring in the images from Seamless Caro Builder.");
      }
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
out.push({ id: `c-${Math.random().toString(36).slice(2, 7)}`, name: s.file.name.replace(/\.[^.]+$/, ""), sourceFile: s.file, raw, slideImgs, slideUrls, row: { ...EMPTY_ROW }, blocks, presetId: batchPresetId, caption: "", date: seamlessDate(idx), time: POST_TIME, track: null, imageOpacity: 1, imageZoom: 1, imageShadow: false, textBg: false, textFont: "", textBgColor: "#000000" });
idx++;
}
setCarousels(out); setPhase("preview");
} catch (e: any) { toast.error(e?.message || "Cutting failed"); } finally { setBusy(false); }
}

function update(id: string, patch: Partial<Carousel>) { setCarousels((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
function removeCarousel(id: string) { setCarousels((p) => p.filter((c) => c.id !== id)); }
function presetFor(id: number | null) { return presets.find((p) => p.id === id) || null; }

// Bulk-reassign dates across every included carousel in one go, alternating through
// `days` in order (e.g. Mon, Wed, Mon, Wed...), for a quicker bulk scheduling pass.
function applyDatePattern(days: (typeof WEEKDAY)[keyof typeof WEEKDAY][], label: string) {
if (!carousels.length) { toast.error("Nothing to reschedule yet."); return; }
let idx = 0;
setCarousels((prev) => prev.map((c) => {
if (!isIn(c.id)) return c;
const date = dateForPattern(days, idx);
idx++;
return { ...c, date };
}));
toast.success(`Dates set to ${label} across the selected carousels.`);
}

function importCsv(file: File) {
readFileAsText(file).then((raw) => {
const mapped = smartMapCsvHeaders(raw);
Papa.parse(mapped, { header: true, skipEmptyLines: true, complete: (res: any) => {
const rows = (res.data || []) as any[];
const headers = (res.meta.fields || []).map((h: string) => h.trim());
if (!headers.includes("hook") || !headers.includes("cta")) {
toast.error("Could not find a hook column and a call-to-action column in this CSV.");
return;
}
const key = (r: any, ...n: string[]) => { for (const k of Object.keys(r)) if (n.includes(k.trim().toLowerCase())) return r[k]; return ""; };
const parsed: PRow[] = rows.map((r) => {
const row: PRow = { hook: String(r.hook ?? ""), cta: String(r.cta ?? "") };
Object.keys(r).forEach((k) => { if (/^body\d+$/.test(k)) row[k] = String(r[k] ?? ""); });
row.client = String(key(r, "client", "clinic", "account") || "").trim();
row.caption = String(key(r, "caption") || "");
row.date = key(r, "date") ? normDate(key(r, "date")) : "";
row.time = key(r, "time") ? normTime(key(r, "time")) : "";
return row;
});
setCsvParsed(parsed);
toast.success(`Loaded ${parsed.length} row(s). Pick a row for each carousel to marry them up.`);
}, error: () => toast.error("Could not read that CSV.") });
});
}

async function applyClientToAll(pid: number | null) {
setBatchPresetId(pid);
const preset = presetFor(pid);
setBusy(true);
try {
const updated = await Promise.all(carousels.map(async (c, i) => {
        const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, preset, c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor);
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
const row: CsvRow = pr;
const preset = pr.client ? (presets.find((p) => p.name.trim().toLowerCase() === (pr.client as string).toLowerCase()) || null) : presetFor(c.presetId);
const blocks = blocksFromRow(row);
// The CSV row's own slide count now drives how many pieces the source strip
// gets cut into, so a shorter row (blank trailing columns) gives a shorter
// carousel instead of always assuming a fixed shape.
const desired = Math.max(2, Math.min(12, desiredSlideCount(row)));
const img = await fileToImage(c.sourceFile);
const raw = cutStrip(img, desired);
const slideImgs = await Promise.all(raw.map(loadImg));
const slideUrls = await renderFromBlocks(raw, slideImgs, blocks, preset, c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor);
update(id, { row, blocks, raw, slideImgs, presetId: preset ? preset.id : c.presetId, caption: (pr.caption as string) || c.caption, date: (pr.date as string) || c.date, time: (pr.time as string) || c.time, slideUrls, assignedRow: idx });
} catch (e: any) { toast.error(e?.message || "Could not apply that row"); } finally { setBusy(false); }
}
  
async function fillInOrder() {
for (let i = 0; i < carousels.length && i < csvParsed.length; i++) { await assignRow(carousels[i].id, i); }
toast.success("Rows matched to carousels in order.");
}

async function genCaptionFor(c: Carousel): Promise<string | undefined> {
const bodyText = c.blocks.filter((b) => /^body\d+$/.test(b.id)).map((b) => (b as any).text || "").filter(Boolean).join(" ");
const res = await fetch(`${BASE}/api/carousel/generate-caption`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: c.row.hook ?? (c.row as any).slide1_hook, subtitle: (c.row as any).slide1_subtitle ?? "", body2: bodyText, body3: "", cta: c.row.cta ?? (c.row as any).slide4_cta }) });
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

function updateBlockText(id: string, blockId: string, value: string) { setCarousels((p) => p.map((c) => (c.id === id ? { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? { ...b, text: value } : b)) } : c))); }
async function applyImageStyle(id: string, patch: Partial<Pick<Carousel, "imageOpacity" | "imageZoom" | "imageShadow" | "textBg" | "textFont" | "textBgColor">>) {
  const c = carousels.find((x) => x.id === id); if (!c) return;
  const next = { ...c, ...patch };
  update(id, patch);
  // Dragging a slider fires this on every tick, and each call awaits a network
  // logo fetch + font load before it can render. Those can resolve out of
  // order, so without this ticket guard a stale render from an earlier drag
  // position could land after a newer one and freeze the preview on the
  // wrong opacity/zoom/shadow — exactly the "preview doesn't update" bug.
  const ticket = (imageStyleTickets.current[id] || 0) + 1;
  imageStyleTickets.current[id] = ticket;
  const slideUrls = await renderFromBlocks(next.raw, next.slideImgs, next.blocks, presetFor(next.presetId), next.imageOpacity, next.imageZoom, next.imageShadow, next.textBg, next.textFont, next.textBgColor);
  if (imageStyleTickets.current[id] !== ticket) return;
  update(id, { slideUrls });
}
async function applyText(id: string) {
const c = carousels.find((x) => x.id === id); if (!c) return;
setBusy(true);
try { const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, presetFor(c.presetId), c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor); update(id, { slideUrls }); } finally { setBusy(false); }
}
async function changeClient(id: string, presetId: number | null) {
const c = carousels.find((x) => x.id === id); update(id, { presetId });
if (c) { const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, presetFor(presetId), c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor); update(id, { presetId, slideUrls }); }
}
async function saveEdit(id: string, blocks: Block[]) {
const c = carousels.find((x) => x.id === id); if (!c) return;
setBusy(true);
try { const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, blocks, presetFor(c.presetId), c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor); update(id, { blocks, slideUrls }); } finally { setBusy(false); setEditId(null); }
}
function downloadTemplate() {
const csv = "client,caption,date,time,hook,body1,body2,body3,cta\nTweaked By Helen,\"Your caption\",2026-07-10,10:00,YOUR HOOK,Body slide one,Body slide two,Body slide three,DM me to book\n";
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
if (broadcastMode) {
const targetIds = Array.from(broadcastPresetIds);
if (!targetIds.length) { toast.error("Tick at least one client to broadcast to."); return; }
const ready = carousels.filter((c) => isIn(c.id) && c.date && c.time);
if (!ready.length) { toast.error("Give at least one carousel a date and time."); return; }
setBusy(true); const tid = toast.loading("Uploading and scheduling...");
let sent = 0;
try {
for (let i = 0; i < ready.length; i++) {
const c = ready[i]; toast.loading(`Scheduling ${i + 1} / ${ready.length}...`, { id: tid });
for (const targetId of targetIds) {
const targetPreset = presetFor(targetId);
const slideUrls = await renderFromBlocks(c.raw, c.slideImgs, c.blocks, targetPreset, c.imageOpacity, c.imageZoom, c.imageShadow, c.textBg, c.textFont, c.textBgColor);
const names = slideUrls.map((_, j) => `seamless-${i + 1}-slide${j + 1}.png`);
const imageUrls = await uploadDataUrls(slideUrls, names);
const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId: targetId, postType: "carousel", content: { imageUrls, caption: c.caption || "", title: ((c.row.hook as string) || c.name).slice(0, 80), platforms: ["instagram", "facebook"], musicTrack: c.track || undefined, sourceTool: "Seamless Carousels" }, scheduledAt: new Date(`${c.date}T${c.time}`).toISOString() }) });
if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(`${c.name}: ${err.error}`); }
sent++;
}
}
toast.success(`${sent} post${sent !== 1 ? "s" : ""} queued across ${targetIds.length} client${targetIds.length !== 1 ? "s" : ""}.`, { id: tid });
} catch (e: any) { toast.error(e.message || "Scheduling failed", { id: tid }); } finally { setBusy(false); }
return;
}
const ready = carousels.filter((c) => isIn(c.id) && c.presetId && c.date && c.time);
if (!ready.length) { toast.error("Give at least one carousel a client, date and time."); return; }
setBusy(true); const tid = toast.loading("Uploading and scheduling...");
try {
for (let i = 0; i < ready.length; i++) {
const c = ready[i]; toast.loading(`Scheduling ${i + 1} / ${ready.length}...`, { id: tid });
const names = c.slideUrls.map((_, j) => `seamless-${i + 1}-slide${j + 1}.png`);
const imageUrls = await uploadDataUrls(c.slideUrls, names);
const r = await fetch(`${BASE}/api/scheduler/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId: c.presetId, postType: "carousel", content: { imageUrls, caption: c.caption || "", title: ((c.row.hook as string) || c.name).slice(0, 80), platforms: ["instagram", "facebook"], musicTrack: c.track || undefined, sourceTool: "Seamless Carousels" }, scheduledAt: new Date(`${c.date}T${c.time}`).toISOString() }) });
if (!r.ok) { const err = await r.json().catch(() => ({ error: "Failed" })); throw new Error(`${c.name}: ${err.error}`); }
}
toast.success(`${ready.length} seamless carousel${ready.length !== 1 ? "s" : ""} queued.`, { id: tid });
} catch (e: any) { toast.error(e.message || "Scheduling failed", { id: tid }); } finally { setBusy(false); }
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
<button onClick={() => { setBroadcastMode((v) => !v); setBroadcastPresetIds(new Set()); }} className={`px-4 py-2 rounded-lg border text-sm font-medium ${broadcastMode ? "bg-pink-600/20 border-pink-500/60 text-pink-300" : "border-border/50 hover:border-pink-500/60"}`}>{broadcastMode ? "Broadcast: On" : "Broadcast to multiple clients"}</button>
<button onClick={downloadTemplate} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">CSV template</button>
<label className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm cursor-pointer">Load CSV rows<input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.currentTarget.value = ""; }} /></label>
{csvParsed.length > 0 && <button onClick={fillInOrder} disabled={busy} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Match in order</button>}
<button onClick={() => setExcluded(new Set())} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Select all</button>
<button onClick={() => setExcluded(new Set(carousels.map((c) => c.id)))} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Clear</button>
<button onClick={generateCaptions} disabled={genning} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm disabled:opacity-40">{genning ? "Writing…" : "Generate captions"}</button>
<button onClick={downloadZip} className="px-4 py-2 rounded-lg border border-border/50 hover:border-pink-500/60 text-sm">Download selected (ZIP)</button>
<button onClick={scheduleAll} disabled={busy} className="px-5 py-2 rounded-lg bg-pink-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-pink-400">{busy ? "Working..." : broadcastMode ? `Broadcast to ${broadcastPresetIds.size} client${broadcastPresetIds.size !== 1 ? "s" : ""}` : `Schedule selected (${carousels.filter((c) => isIn(c.id)).length})`}</button>
</div>
</div>
{broadcastMode && (
<div className="border border-pink-500/40 rounded-xl bg-white/[0.03] p-4 space-y-2 mb-4">
<div className="flex items-center justify-between">
<p className="text-sm font-semibold">Broadcast to multiple clients</p>
<div className="flex gap-3">
<button onClick={() => setBroadcastPresetIds(new Set(presets.map((p) => p.id)))} className="text-xs text-pink-400 hover:text-pink-300">Select all</button>
<button onClick={() => setBroadcastPresetIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
</div>
</div>
<p className="text-xs text-muted-foreground">{broadcastPresetIds.size} of {presets.length} selected. Every included carousel below is sent to each ticked client, on its own date.</p>
<div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5">
{presets.map((p) => (
<label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer">
<input type="checkbox" checked={broadcastPresetIds.has(p.id)} onChange={() => setBroadcastPresetIds((prev) => { const next = new Set(prev); next.has(p.id) ? next.delete(p.id) : next.add(p.id); return next; })} className="w-3.5 h-3.5 accent-pink-500" />
<span className="text-xs truncate">{p.name}</span>
</label>
))}
</div>
</div>
)}
<div className="flex items-center gap-2 flex-wrap bg-white/[0.03] border border-border/40 rounded-xl px-3 py-2.5">
<span className="text-xs uppercase tracking-widest text-muted-foreground mr-1">Quick reschedule</span>
<button onClick={() => applyDatePattern([WEEKDAY.MON, WEEKDAY.WED], "Monday & Wednesday")} className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-pink-500/60 text-xs">Monday & Wednesday</button>
<button onClick={() => applyDatePattern([WEEKDAY.WED, WEEKDAY.SUN], "Wednesday & Sunday")} className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-pink-500/60 text-xs">Wednesday & Sunday</button>
<span className="text-xs text-muted-foreground">or</span>
<select value={customDay} onChange={(e) => setCustomDay(Number(e.target.value) as (typeof WEEKDAY)[keyof typeof WEEKDAY])} className="bg-white/5 border border-border/50 rounded-md px-2 py-1.5 text-xs">
{DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
</select>
<button onClick={() => applyDatePattern([customDay], DAY_OPTIONS.find((d) => d.value === customDay)?.label || "that day")} className="px-3 py-1.5 rounded-lg border border-border/50 hover:border-pink-500/60 text-xs">Apply</button>
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
{csvParsed.map((pr, idx) => <option key={idx} value={idx}>{idx + 1}. {((pr.hook as string) || "(no hook)").slice(0, 44)}{pr.client ? ` — ${pr.client}` : ""}</option>)}
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
  <div className="rounded-xl bg-white/[0.03] border border-border/40 p-3 space-y-3">
  <p className="text-xs uppercase tracking-widest text-muted-foreground">Image style</p>
  <div className="grid sm:grid-cols-2 gap-3">
  <div>
  <div className="flex items-center justify-between mb-1"><label className="text-xs text-muted-foreground">Opacity</label><span className="text-xs text-muted-foreground">{Math.round(c.imageOpacity * 100)}%</span></div>
  <input type="range" min={0.2} max={1} step={0.05} value={c.imageOpacity} onChange={(e) => applyImageStyle(c.id, { imageOpacity: Number(e.target.value) })} className="w-full accent-pink-500" />
  </div>
  <div>
  <div className="flex items-center justify-between mb-1"><label className="text-xs text-muted-foreground">Zoom</label><span className="text-xs text-muted-foreground">{Math.round(c.imageZoom * 100)}%</span></div>
  <input type="range" min={1} max={2.5} step={0.05} value={c.imageZoom} onChange={(e) => applyImageStyle(c.id, { imageZoom: Number(e.target.value) })} className="w-full accent-pink-500" />
  </div>
  </div>
  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
  <input type="checkbox" checked={c.imageShadow} onChange={(e) => applyImageStyle(c.id, { imageShadow: e.target.checked })} className="w-4 h-4 accent-pink-500" />
  Drop shadow behind photo
  </label>
  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
  <input type="checkbox" checked={c.textBg} onChange={(e) => applyImageStyle(c.id, { textBg: e.target.checked })} className="w-4 h-4 accent-pink-500" />
  Coloured box behind text
  </label>
              {c.textBg && (
                <input type="color" value={c.textBgColor} onChange={(e) => applyImageStyle(c.id, { textBgColor: e.target.value })} className="h-8 w-14 rounded cursor-pointer border border-border/40 bg-transparent p-0.5" />
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Font</label>
                <select value={c.textFont} onChange={(e) => applyImageStyle(c.id, { textFont: e.target.value })} className="h-8 rounded border border-border/40 bg-background px-2 text-sm">
                  <option value="">Preset default</option>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
  </div>
<div className="rounded-xl bg-white/[0.03] border border-border/40 p-3 space-y-2">
<p className="text-xs uppercase tracking-widest text-muted-foreground">Text on the slides</p>
<div className="grid sm:grid-cols-2 gap-2">
{c.blocks.filter((b) => b.id === "hook" || /^body\d+$/.test(b.id) || b.id === "cta").map((b, i, arr) => (
<input key={b.id} value={(b as any).text || ""} onChange={(e) => updateBlockText(c.id, b.id, e.target.value)} placeholder={b.id === "hook" ? "Hook (slide 1)" : b.id === "cta" ? "Call to action (last slide)" : `Slide text ${i + 1}`} className={`bg-white/5 border border-border/50 rounded-md px-3 py-2 text-sm ${i === arr.length - 1 && arr.length % 2 === 1 ? "sm:col-span-2" : ""}`} />
))}
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
