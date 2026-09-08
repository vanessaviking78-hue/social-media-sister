import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
 ArrowLeft,
 Loader2,
 RotateCcw,
 Film,
 Wand2,
 Download,
 Trash2,
 Pencil,
 Check,
 X,
 UploadCloud,
 MessageSquareText,
 Copy,
 Move,
} from "lucide-react";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_ORIGIN = "https://workspaceapi-server-production-0f0d.up.railway.app";
function authHeaders(): Record<string, string> {
 const pw = localStorage.getItem("cybersuite-pw") || "";
 return { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
}
const CAPTION_STYLES = [
 { value: "1", label: "Northern Grit" },
 { value: "2", label: "Whimsical Storytelling" },
 { value: "3", label: "Dawn French" },
 { value: "4", label: "Professional with Personality" },
];
type TextLayoutSeg = { x: number; y: number; w: number; fontSize: number };
type TextLayout = { hook?: TextLayoutSeg; secondHook?: TextLayoutSeg; cta?: TextLayoutSeg };
type SegKey = "hook" | "secondHook" | "cta";
const DEFAULT_LAYOUT: Record<SegKey, TextLayoutSeg> = {
 hook: { x: 0.5, y: 0.12, w: 0.8, fontSize: 54 },
 secondHook: { x: 0.5, y: 0.5, w: 0.8, fontSize: 54 },
 cta: { x: 0.5, y: 0.88, w: 0.8, fontSize: 54 },
};
const SEGMENT_LABELS: Record<SegKey, string> = {
 hook: "Hook",
 secondHook: "2nd hook",
 cta: "CTA",
};
const SEGMENT_ORDER: SegKey[] = ["hook", "secondHook", "cta"];
function clamp(n: number, min: number, max: number): number {
 return Math.min(max, Math.max(min, n));
}
type Item = {
 id: number;
 batchId: string;
 videoUrl: string;
 text1: string;
 text2: string;
 text3: string;
 hook: string;
 secondHook: string;
 cta: string;
 caption: string | null;
 renderedVideoUrl: string | null;
 status: string;
 createdAt: string;
 textLayout: TextLayout | null;
};
const STATUS_LABEL: Record<string, string> = {
 assigned: "Ready to render",
 rendered: "Rendered",
};
type DragState = {
 itemId: number;
 key: SegKey;
 mode: "move" | "resize";
 startX: number;
 startY: number;
 orig: TextLayoutSeg;
};
export default function EngagingReels() {
 const [items, setItems] = useState<Item[]>([]);
 const [loading, setLoading] = useState(true);
 const [boxColor, setBoxColor] = useState("#ffffff");
 const [captionStyle, setCaptionStyle] = useState("1");
 const [busyId, setBusyId] = useState<number | null>(null);
 const [busyAction, setBusyAction] = useState<"render" | "caption" | "delete" | "save" | null>(null);
 const [editingId, setEditingId] = useState<number | null>(null);
 const [draft, setDraft] = useState({ hook: "", secondHook: "", cta: "" });
 const [positioningId, setPositioningId] = useState<number | null>(null);
 const [layouts, setLayouts] = useState<Record<number, TextLayout>>({});
 const containerRefs = useRef<Record<number, HTMLDivElement | null>>({});
 const dragStateRef = useRef<DragState | null>(null);
 const videosRef = useRef<HTMLInputElement>(null);
 const csvRef = useRef<HTMLInputElement>(null);
 const [videoCount, setVideoCount] = useState(0);
 const [csvName, setCsvName] = useState("");
 const [uploading, setUploading] = useState(false);
 const [uploadError, setUploadError] = useState("");
 const load = useCallback(async () => {
 setLoading(true);
 try {
 const r = await fetch(`${API_ORIGIN}/api/engaging-reels`, { headers: authHeaders() });
 const d = await r.json();
 setItems(Array.isArray(d.items) ? d.items : []);
 } catch {
 setItems([]);
 } finally {
 setLoading(false);
 }
 }, []);
 useEffect(() => {
 load();
 }, [load]);
 const upload = async () => {
 const videoFiles = videosRef.current?.files;
 const csvFile = csvRef.current?.files?.[0];
 if (!videoFiles?.length || !csvFile) return;
 setUploading(true);
 setUploadError("");
 try {
 const form = new FormData();
 Array.from(videoFiles).forEach((f) => form.append("videos", f));
 form.append("csv", csvFile);
 const pw = localStorage.getItem("cybersuite-pw") || "";
 const r = await fetch(`${API_ORIGIN}/api/engaging-reels/batches`, {
 method: "POST",
 headers: { "x-app-password": pw, Authorization: `Bearer ${pw}` },
 body: form,
 });
 const d = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(d?.error || "Upload failed");
 if (videosRef.current) videosRef.current.value = "";
 if (csvRef.current) csvRef.current.value = "";
 setVideoCount(0);
 setCsvName("");
 await load();
 } catch (e: any) {
 setUploadError(e?.message || "Upload failed");
 } finally {
 setUploading(false);
 }
 };
 const openEditor = (item: Item) => {
 setEditingId(item.id);
 setDraft({ hook: item.hook, secondHook: item.secondHook, cta: item.cta });
 };
 const cancelEditor = () => {
 setEditingId(null);
 setDraft({ hook: "", secondHook: "", cta: "" });
 };
 const saveEditor = async (id: number) => {
 setBusyId(id);
 setBusyAction("render");
 try {
 const r = await fetch(`${API_ORIGIN}/api/engaging-reels/${id}`, {
 method: "PATCH",
 headers: authHeaders(),
 body: JSON.stringify(draft),
 });
 if (!r.ok) throw new Error("Failed to save changes");
 setEditingId(null);
 await load();
 } catch (e: any) {
 alert(e?.message || "Failed to save changes");
 } finally {
 setBusyId(null);
 setBusyAction(null);
 }
 };
 const getSegConfig = useCallback(
 (item: Item, key: SegKey): TextLayoutSeg => {
 const custom = layouts[item.id]?.[key] || item.textLayout?.[key];
 return custom || DEFAULT_LAYOUT[key];
 },
 [layouts]
 );
 const onDragMove = useCallback((e: MouseEvent) => {
 const drag = dragStateRef.current;
 if (!drag) return;
 const container = containerRefs.current[drag.itemId];
 if (!container) return;
 const rect = container.getBoundingClientRect();
 const dxFrac = (e.clientX - drag.startX) / rect.width;
 const dyFrac = (e.clientY - drag.startY) / rect.height;
 setLayouts((prev) => {
 const base = prev[drag.itemId] || {};
 const seg: TextLayoutSeg = { ...drag.orig };
 if (drag.mode === "move") {
 seg.x = clamp(drag.orig.x + dxFrac, 0, 1);
 seg.y = clamp(drag.orig.y + dyFrac, 0, 1);
 } else {
 seg.w = clamp(drag.orig.w + dxFrac * 2, 0.15, 1);
 seg.fontSize = clamp(drag.orig.fontSize + dyFrac * 200, 20, 120);
 }
 return { ...prev, [drag.itemId]: { ...base, [drag.key]: seg } };
 });
 }, []);
 const onDragEnd = useCallback(() => {
 dragStateRef.current = null;
 window.removeEventListener("mousemove", onDragMove);
 window.removeEventListener("mouseup", onDragEnd);
 }, [onDragMove]);
 const startDrag = useCallback(
 (e: React.MouseEvent, item: Item, key: SegKey, mode: "move" | "resize") => {
 e.preventDefault();
 e.stopPropagation();
 const orig = getSegConfig(item, key);
 dragStateRef.current = { itemId: item.id, key, mode, startX: e.clientX, startY: e.clientY, orig };
 window.addEventListener("mousemove", onDragMove);
 window.addEventListener("mouseup", onDragEnd);
 },
 [getSegConfig, onDragMove, onDragEnd]
 );
 const savePositioning = async (id: number) => {
 const layout = layouts[id];
 setBusyId(id);
 setBusyAction("save");
 try {
 if (layout) {
 await fetch(`${API_ORIGIN}/api/engaging-reels/${id}`, {
 method: "PATCH",
 headers: authHeaders(),
 body: JSON.stringify({ textLayout: layout }),
 });
 await load();
 }
 } catch {
 // best effort
 } finally {
 setBusyId(null);
 setBusyAction(null);
 setPositioningId(null);
 }
 };
 const resetPositioning = (id: number) => {
 setLayouts((prev) => {
 const next = { ...prev };
 delete next[id];
 return next;
 });
 };
 const render = async (id: number) => {
 setBusyId(id);
 setBusyAction("render");
 try {
 const layout = layouts[id] || items.find((i) => i.id === id)?.textLayout || undefined;
 const r = await fetch(`${API_ORIGIN}/api/engaging-reels/${id}/render`, {
 method: "POST",
 headers: authHeaders(),
 body: JSON.stringify({ textLayout: layout, boxColor }),
 });
 if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Render failed");
 await load();
 } catch (e: any) {
 alert(e?.message || "Render failed");
 } finally {
 setBusyId(null);
 setBusyAction(null);
 }
 };
 const generateCaption = async (id: number) => {
 setBusyId(id);
 setBusyAction("caption");
 try {
 const r = await fetch(`${API_ORIGIN}/api/engaging-reels/${id}/caption`, {
 method: "POST",
 headers: authHeaders(),
 body: JSON.stringify({ tone: captionStyle }),
 });
 if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Caption generation failed");
 await load();
 } catch (e: any) {
 alert(e?.message || "Caption generation failed");
 } finally {
 setBusyId(null);
 setBusyAction(null);
 }
 };
 const copyCaption = (caption: string) => {
 navigator.clipboard?.writeText(caption).catch(() => {});
 };
 const remove = async (id: number) => {
 if (!confirm("Delete this reel? This can't be undone.")) return;
 setBusyId(id);
 setBusyAction("delete");
 try {
 await fetch(`${API_ORIGIN}/api/engaging-reels/${id}`, { method: "DELETE", headers: authHeaders() });
 await load();
 } finally {
 setBusyId(null);
 setBusyAction(null);
 }
 };

 return (
 <div className="min-h-screen">
 <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
 <Link href="/hub">
 <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
 </Link>
 <div className="flex-1">
 <h1 className="font-bold text-lg">Engaging Reels</h1>
 <p className="text-xs text-muted-foreground mt-0.5">
 {loading ? "Loading..." : `${items.length} reel${items.length === 1 ? "" : "s"}`}
 </p>
 </div>
 <button
 type="button"
 onClick={load}
 className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
 >
 {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
 Refresh
 </button>
 </header>
 <div className="max-w-3xl mx-auto px-6 py-8">
 <div className="rounded-2xl border border-border/50 p-4 mb-6 space-y-3">
 <div className="flex items-center gap-2">
 <UploadCloud className="w-4 h-4 text-pink-400" />
 <h2 className="font-semibold text-sm">Upload a batch</h2>
 </div>
 <p className="text-xs text-muted-foreground">
 Silent B-roll only, 6 to 10 seconds each — up to 20 clips at once, plus one CSV with a text1, text2, text3
 column and one row per clip, in the same order as the files you pick below. The AI works out which
 sentence is the hook, which is the second hook, and which is the CTA, then you render, edit or caption
 each one.
 </p>
 <div className="grid gap-2 sm:grid-cols-2">
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">Videos</label>
 <input
 ref={videosRef}
 type="file"
 accept="video/*"
 multiple
 onChange={(e) => setVideoCount(e.target.files?.length || 0)}
 className="text-xs text-gray-400 file:mr-2 file:rounded-full file:border-0 file:bg-pink-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-pink-700 hover:file:bg-pink-200"
 />
 {videoCount > 0 && <p className="text-[11px] text-muted-foreground mt-1">{videoCount} video{videoCount === 1 ? "" : "s"} selected</p>}
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">CSV (text1, text2, text3)</label>
 <input
 ref={csvRef}
 type="file"
 accept=".csv,text/csv"
 onChange={(e) => setCsvName(e.target.files?.[0]?.name || "")}
 className="text-xs text-gray-400 file:mr-2 file:rounded-full file:border-0 file:bg-pink-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-pink-700 hover:file:bg-pink-200"
 />
 {csvName && <p className="text-[11px] text-muted-foreground mt-1">{csvName}</p>}
 </div>
 </div>
 {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
 <button
 type="button"
 onClick={upload}
 disabled={!videoCount || !csvName || uploading}
 className="flex items-center gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
 Upload & assign hooks
 </button>
 </div>
 <div className="rounded-2xl border border-border/50 p-4 mb-6 flex flex-wrap items-end gap-4">
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">Text box colour</label>
 <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5">
 <input
 type="color"
 value={boxColor}
 onChange={(e) => setBoxColor(e.target.value)}
 className="w-8 h-8 rounded cursor-pointer bg-transparent"
 />
 <span className="text-xs text-muted-foreground font-mono">{boxColor}</span>
 </div>
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">Caption style</label>
 <select
 value={captionStyle}
 onChange={(e) => setCaptionStyle(e.target.value)}
 className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
 >
 {CAPTION_STYLES.map((s) => (
 <option key={s.value} value={s.value}>{s.label}</option>
 ))}
 </select>
 </div>
 <p className="text-xs text-muted-foreground flex-1 min-w-[160px]">
 Font is Inter, black text on a coloured box. Hook plays over the first third of the clip, second hook over
 the middle, CTA over the last third. Use "Position text" on each reel below to drag, resize and font-size
 each of the three lines.
 </p>
 </div>
 {loading && items.length === 0 && (
 <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
 <Loader2 className="w-4 h-4 animate-spin" /> Loading reels...
 </div>
 )}
 {!loading && items.length === 0 && (
 <p className="text-sm text-muted-foreground text-center py-16">
 No reels yet — upload some B-roll and a CSV above to get started.
 </p>
 )}
 <div className="space-y-4">
 {items.map((item) => {
 const isBusy = busyId === item.id;
 const isEditing = editingId === item.id;
 const isPositioning = positioningId === item.id;
 return (
 <div key={item.id} className="rounded-2xl border border-border/50 p-4 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Film className="w-4 h-4 text-pink-400" />
 <span className="text-xs text-muted-foreground">
 {new Date(item.createdAt).toLocaleDateString()}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
 {STATUS_LABEL[item.status] || item.status}
 </span>
 <button
 type="button"
 onClick={() => remove(item.id)}
 disabled={isBusy}
 className="text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
 title="Delete reel"
 >
 {isBusy && busyAction === "delete" ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </button>
 </div>
 </div>
 <div className="flex justify-center">
 <div
 className="relative inline-block"
 ref={(el) => {
 containerRefs.current[item.id] = el;
 }}
 >
 <video
 src={`${BASE}${item.videoUrl}`}
 controls={!isPositioning}
 className="block max-w-full max-h-80 rounded-xl bg-black"
 />
 {isPositioning &&
 SEGMENT_ORDER.map((key) => {
 const seg = getSegConfig(item, key);
 const previewFontSize = clamp(seg.fontSize * 0.32, 9, 34);
 return (
 <div
 key={key}
 onMouseDown={(e) => startDrag(e, item, key, "move")}
 className="absolute flex items-center justify-center text-center text-black font-bold border-2 border-pink-500 select-none cursor-move rounded-sm"
 style={{
 left: `${seg.x * 100}%`,
 top: `${seg.y * 100}%`,
 width: `${seg.w * 100}%`,
 minHeight: "22px",
 transform: "translate(-50%, -50%)",
 fontSize: `${previewFontSize}px`,
 fontFamily: "Inter, sans-serif",
 backgroundColor: `${boxColor}cc`,
 padding: "3px 4px",
 }}
 >
 {SEGMENT_LABELS[key]}
 <div
 onMouseDown={(e) => startDrag(e, item, key, "resize")}
 title="Drag to resize width and font size"
 className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-pink-600 rounded-sm cursor-se-resize"
 style={{ transform: "translate(50%, 50%)" }}
 />
 </div>
 );
 })}
 </div>
 </div>
 {isPositioning && (
 <div className="flex flex-wrap items-center gap-2 -mt-1">
 <p className="text-[11px] text-muted-foreground flex-1 min-w-[160px]">
 Drag a box to move it, drag its pink corner handle to resize the box and its text.
 </p>
 <button
 type="button"
 onClick={() => savePositioning(item.id)}
 disabled={isBusy}
 className="flex items-center gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 {isBusy && busyAction === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
 Save positions
 </button>
 <button
 type="button"
 onClick={() => resetPositioning(item.id)}
 className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 Reset to default
 </button>
 <button
 type="button"
 onClick={() => setPositioningId(null)}
 className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
 >
 <X className="w-3.5 h-3.5" />
 Done
 </button>
 </div>
 )}
 {!isEditing && (
 <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-1.5 text-xs">
 <p><span className="text-pink-400 font-semibold">Hook:</span> <span className="text-zinc-200">{item.hook}</span></p>
 <p><span className="text-pink-400 font-semibold">Second hook:</span> <span className="text-zinc-200">{item.secondHook}</span></p>
 <p><span className="text-pink-400 font-semibold">CTA:</span> <span className="text-zinc-200">{item.cta}</span></p>
 </div>
 )}
 {isEditing && (
 <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
 <input
 value={draft.hook}
 onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
 placeholder="Hook"
 className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
 />
 <input
 value={draft.secondHook}
 onChange={(e) => setDraft({ ...draft, secondHook: e.target.value })}
 placeholder="Second hook"
 className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
 />
 <input
 value={draft.cta}
 onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
 placeholder="CTA"
 className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
 />
 <div className="flex items-center gap-2 pt-1">
 <button
 type="button"
 onClick={() => saveEditor(item.id)}
 disabled={isBusy}
 className="flex items-center gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
 Save changes
 </button>
 <button
 type="button"
 onClick={cancelEditor}
 className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
 >
 <X className="w-3.5 h-3.5" />
 Cancel
 </button>
 </div>
 </div>
 )}
 {!isEditing && !isPositioning && (
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => openEditor(item)}
 disabled={isBusy}
 className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit text
 </button>
 <button
 type="button"
 onClick={() => setPositioningId(item.id)}
 disabled={isBusy}
 className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 <Move className="w-3.5 h-3.5" />
 Position text
 </button>
 <button
 type="button"
 onClick={() => render(item.id)}
 disabled={isBusy}
 className="flex items-center gap-2 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 {isBusy && busyAction === "render" ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <Wand2 className="w-3.5 h-3.5" />
 )}
 {item.status === "rendered" ? "Re-render" : "Render text on video"}
 </button>
 <button
 type="button"
 onClick={() => generateCaption(item.id)}
 disabled={isBusy}
 className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
 >
 {isBusy && busyAction === "caption" ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <MessageSquareText className="w-3.5 h-3.5" />
 )}
 {item.caption ? "Regenerate caption" : "Generate caption"}
 </button>
 </div>
 )}
 {item.caption && (
 <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
 <p className="text-sm text-zinc-200 whitespace-pre-wrap">{item.caption}</p>
 <button
 type="button"
 onClick={() => copyCaption(item.caption as string)}
 className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 transition-colors"
 >
 <Copy className="w-3.5 h-3.5" />
 Copy caption
 </button>
 </div>
 )}
 {item.status === "rendered" && item.renderedVideoUrl && (
 <div className="space-y-2 pt-1">
 <video
 src={`${BASE}${item.renderedVideoUrl}`}
 controls
 className="w-full max-h-80 rounded-xl bg-black"
 />
 <a
 href={`${BASE}${item.renderedVideoUrl}`}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors"
 >
 <Download className="w-3.5 h-3.5" />
 Download reel, ready to upload
 </a>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
}
