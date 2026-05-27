import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Layers, Image as ImageIcon, Film, BookOpen, Trash2, Calendar,
  Upload, X, CheckSquare, Square, CalendarDays, Clock, ChevronDown, Loader2,
  BarChart3, ShieldCheck, MessageSquareText, Play, Palette,
  Archive, AlertTriangle, CheckCircle2, ExternalLink, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { drawHeroSlide, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/slide-utils";

const BASE = import.meta.env.BASE_URL;

interface LibraryItem {
  id: number;
  clientName: string;
  postType: string;
  caption: string;
  mediaUrl: string | null;
  mediaUrls: string[] | null;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ClientPreset {
  id: number;
  name: string;
  defaultPostTime: string;
}

const POST_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  carousel: { label: "Carousel", icon: Layers, color: "text-pink-400" },
  reel: { label: "Reel", icon: Film, color: "text-purple-400" },
  single: { label: "Single", icon: ImageIcon, color: "text-blue-400" },
  story: { label: "Story", icon: BookOpen, color: "text-amber-400" },
};

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function HeroThumbnail({ item }: { item: LibraryItem }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const meta = item.metadata as Record<string, unknown> | null;
  const rawMediaUrl = item.mediaUrl || item.mediaUrls?.[0] || null;
  const alreadyCached = !!(item.thumbnailUrl && item.thumbnailUrl !== rawMediaUrl);

  useEffect(() => {
    if (!rawMediaUrl || meta?.textStyle !== "hero" || alreadyCached) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d")!;
      drawHeroSlide(
        ctx, img,
        (meta.heroLeadIn as string) || "",
        (meta.heroWord as string) || "",
        (meta.heroLeadInColor as string) || "#E91976",
        (meta.heroWordColor as string) || "#ffffff",
        (meta.heroWordFont as string) || "'Bebas Neue', sans-serif",
        ((meta.heroVerticalPosition as string) as "top" | "middle" | "bottom") || "bottom",
        typeof meta.heroSpacing === "number" ? meta.heroSpacing : 20,
        meta.heroUppercase !== false,
      );
      const jpeg = canvas.toDataURL("image/jpeg", 0.85);
      if (cancelled) return;
      setDataUrl(jpeg);
      try {
        const up = await fetch(`${BASE}api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name: `hero-thumb-${item.id}.jpg`, base64: jpeg }] }),
        });
        if (up.ok && !cancelled) {
          const upData = await up.json();
          const url = upData.results?.[0]?.url as string | undefined;
          if (url) {
            await fetch(`${BASE}api/library/${item.id}/thumbnail`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thumbnailUrl: url }),
            });
          }
        }
      } catch { /* non-fatal: thumbnail is still shown via dataUrl */ }
    };
    img.src = rawMediaUrl;
    return () => { cancelled = true; };
  }, [rawMediaUrl, alreadyCached, item.id, meta]);

  if (alreadyCached) return <img src={item.thumbnailUrl!} alt="" className="w-full h-full object-cover" />;
  if (dataUrl) return <img src={dataUrl} alt="" className="w-full h-full object-cover" />;
  if (rawMediaUrl) return <img src={rawMediaUrl} alt="" className="w-full h-full object-cover" />;
  return null;
}

export default function Library() {
  const [, navigate] = useLocation();
  const [presets, setPresets] = useState<ClientPreset[]>([]);
  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(tomorrow());
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [scheduling, setScheduling] = useState(false);

  const [activeTab, setActiveTab] = useState<"library" | "bulk-import">("library");
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ processed: number; total: number; currentFile: string } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<Record<string, number> | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkDropRef = useRef<HTMLDivElement>(null);

  const fetchPresets = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}api/presets`);
      const d = await r.json();
      setPresets((d.presets || []).map((p: ClientPreset) => ({ id: p.id, name: p.name, defaultPostTime: p.defaultPostTime || "18:00" })));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchItems = useCallback(async (name: string) => {
    if (!name) { setItems([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/library?clientName=${encodeURIComponent(name)}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch {
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);
  useEffect(() => {
    fetchItems(clientName);
    setSelectedIds(new Set());
  }, [clientName, fetchItems]);

  useEffect(() => {
    const preset = presets.find((p) => p.name === clientName);
    if (preset) setScheduleTime(preset.defaultPostTime || "18:00");
  }, [clientName, presets]);

  useEffect(() => {
    if (!bulkJobId) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}api/library/bulk-import-zip/jobs/${bulkJobId}`);
        if (!r.ok) return;
        const d = await r.json() as { status: string; progress: { processed: number; total: number; currentFile: string }; summary: Record<string, number>; errors: string[]; errorMessage?: string };
        setBulkProgress(d.progress);
        if (d.status === "done" || d.status === "error") {
          clearInterval(interval);
          setBulkUploading(false);
          if (d.status === "done") {
            setBulkSummary(d.summary);
            setBulkErrors(d.errors);
            if (clientName) await fetchItems(clientName);
          } else {
            toast.error(d.errorMessage || "Import failed");
          }
        }
      } catch { /* polling — ignore transient errors */ }
    }, 800);
    return () => clearInterval(interval);
  }, [bulkJobId, clientName, fetchItems]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async (id: number) => {
    if (deleteConfirmId !== id) { setDeleteConfirmId(id); return; }
    setDeleteConfirmId(null);
    try {
      const r = await fetch(`${BASE}api/library/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Delete failed");
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("Item removed");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Delete failed");
    }
  };

  async function uploadSingleFile(file: File, client: string): Promise<LibraryItem> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("clientName", client);
    const r = await fetch(`${BASE}api/library/upload-file`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Upload failed");
    const url: string = d.url;
    const isVideo = file.type.startsWith("video/");
    const ir = await fetch(`${BASE}api/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: client,
        postType: isVideo ? "reel" : "single",
        caption: "",
        mediaUrl: url,
        thumbnailUrl: url,
      }),
    });
    const id2 = await ir.json();
    if (!ir.ok) throw new Error(id2.error || "Create failed");
    return id2.item as LibraryItem;
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (!clientName) { toast.error("Select a client first"); return; }

    const fileList = Array.from(e.dataTransfer.files);
    if (fileList.length === 0) return;

    const csvFiles = fileList.filter((f) => f.name.endsWith(".csv"));
    const zipFiles = fileList.filter((f) => f.name.endsWith(".zip"));

    if (csvFiles.length === 1 && zipFiles.length === 1) {
      setUploading(true);
      setUploadProgress("Parsing CSV and extracting zip...");
      try {
        const fd = new FormData();
        fd.append("csv", csvFiles[0]);
        fd.append("zip", zipFiles[0]);
        fd.append("clientName", clientName);
        const r = await fetch(`${BASE}api/library/upload`, { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed");
        toast.success(`${d.count} post${d.count === 1 ? "" : "s"} added to the library`);
        if (d.warnings?.length) {
          toast.warning(
            `${d.warnings.length} row${d.warnings.length === 1 ? "" : "s"} had issues and ${d.warnings.length === 1 ? "was" : "were"} skipped`,
            { description: (d.warnings as string[]).join("\n"), duration: 10000 },
          );
        }
        await fetchItems(clientName);
      } catch (e: unknown) {
        toast.error((e as Error).message || "Upload failed");
      } finally {
        setUploading(false);
        setUploadProgress("");
      }
      return;
    }

    const mediaFiles = fileList.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (mediaFiles.length === 0) { toast.error("Drop image/video files, or a CSV + zip together"); return; }

    setUploading(true);
    const created: LibraryItem[] = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      setUploadProgress(`Uploading ${i + 1} of ${mediaFiles.length}...`);
      try {
        const item = await uploadSingleFile(mediaFiles[i], clientName);
        created.push(item);
      } catch (e: unknown) {
        toast.error(`Failed: ${mediaFiles[i].name} — ${(e as Error).message}`);
      }
    }
    setUploading(false);
    setUploadProgress("");
    if (created.length > 0) {
      setItems((prev) => [...prev, ...created]);
      toast.success(`${created.length} item${created.length === 1 ? "" : "s"} added`);
    }
  }

  async function handleAutoSchedule() {
    if (selectedIds.size === 0 || !clientName) return;
    setScheduling(true);
    try {
      const r = await fetch(`${BASE}api/library/auto-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: [...selectedIds],
          clientName,
          startDate: scheduleDate,
          postTime: scheduleTime,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Schedule failed");
      setShowScheduleModal(false);
      setSelectedIds(new Set());
      await fetchItems(clientName);
      toast.success(`${d.count} post${d.count === 1 ? "" : "s"} added to calendar: ${d.startDate}${d.count > 1 ? ` to ${d.endDate}` : ""}`);
      navigate("/calendar");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Schedule failed");
    } finally {
      setScheduling(false);
    }
  }

  async function handleBulkDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setBulkDragging(false);
    if (!clientName) { toast.error("Select a client first"); return; }
    const files = Array.from(e.dataTransfer.files);
    const zipFile = files.find((f) => f.name.toLowerCase().endsWith(".zip"));
    if (!zipFile) { toast.error("Drop a .zip file containing your CSVs and media"); return; }
    await startBulkImport(zipFile);
  }

  async function handleBulkFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!clientName) { toast.error("Select a client first"); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await startBulkImport(file);
  }

  async function startBulkImport(zipFile: File) {
    setBulkJobId(null);
    setBulkProgress(null);
    setBulkSummary(null);
    setBulkErrors([]);
    setBulkUploading(true);
    try {
      const fd = new FormData();
      fd.append("zip", zipFile);
      fd.append("clientName", clientName);
      const r = await fetch(`${BASE}api/library/bulk-import-zip`, { method: "POST", body: fd });
      const d = await r.json() as { jobId?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "Import failed to start");
      setBulkJobId(d.jobId ?? null);
    } catch (e: unknown) {
      setBulkUploading(false);
      toast.error((e as Error).message || "Import failed");
    }
  }

  const endPreview = selectedIds.size > 1 ? addDays(scheduleDate, selectedIds.size - 1) : scheduleDate;
  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border/20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-white/60" />
              <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Content Library</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/hub" className="text-muted-foreground hover:text-white transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-white transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-white transition">Stories</Link>
            <Link href="/reels" className="text-muted-foreground hover:text-white transition">Reels</Link>
            <Link href="/video-overlay" className="text-muted-foreground hover:text-white transition">Video Overlay</Link>
            <Link href="/presets" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><Palette className="w-4 h-4" />Presets</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><MessageSquareText className="w-4 h-4" />Captions</Link>
            <Link href="/calendar" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><CalendarDays className="w-4 h-4" />Calendar</Link>
            <Link href="/analytics" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><BarChart3 className="w-4 h-4" />Analytics</Link>
            <Link href="/approval" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><ShieldCheck className="w-4 h-4" />Approvals</Link>
            <Link href="/scheduler" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><Clock className="w-4 h-4" />Scheduler</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl font-semibold mb-2 tracking-tight">Content Library</h1>
            <p className="text-lg text-muted-foreground">Bulk-upload posts for a client, then schedule them all at once.</p>
          </div>
          <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1 mt-1">
            <button
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "library" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              <FolderOpen className="w-4 h-4" />
              Library
            </button>
            <button
              onClick={() => setActiveTab("bulk-import")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "bulk-import" ? "bg-pink-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Archive className="w-4 h-4" />
              Bulk Import
            </button>
          </div>
        </div>

        {activeTab === "bulk-import" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <div className="w-72">
                <Select value={clientName || "__none__"} onValueChange={(v) => setClientName(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="__none__" className="text-gray-400">Select a client...</SelectItem>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.name} className="text-white">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <a
                href={`${BASE}api/library/bulk-import-templates.zip`}
                download
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition-colors"
              >
                <Archive className="w-4 h-4" />
                Download template zip
              </a>
              <Link href="/bulk-import-templates" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition-colors">
                <ExternalLink className="w-4 h-4" />
                View CSV schemas
              </Link>
            </div>

            {!bulkUploading && !bulkSummary && (
              <div
                ref={bulkDropRef}
                onDragOver={(e) => { e.preventDefault(); setBulkDragging(true); }}
                onDragLeave={() => setBulkDragging(false)}
                onDrop={handleBulkDrop}
                className={`relative border-2 border-dashed rounded-2xl transition-all ${
                  bulkDragging ? "border-pink-500 bg-pink-950/20" : clientName ? "border-gray-700 hover:border-gray-600" : "border-gray-800 opacity-50"
                }`}
              >
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <Archive className="w-12 h-12 text-gray-600 mb-4" />
                  <p className="text-white font-medium text-lg mb-1">Drop your bulk import zip here</p>
                  <p className="text-gray-500 text-sm max-w-md mb-6">
                    One zip containing up to 6 CSV files plus all your media. The system detects post types from the CSV filenames — carousels.csv, singles.csv, about_mes.csv, seamless.csv, reels.csv, trial_reels.csv.
                  </p>
                  <label className={`cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${clientName ? "bg-pink-600 hover:bg-pink-700 text-white" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}>
                    <Upload className="w-4 h-4" />
                    {clientName ? "Choose zip file" : "Select a client first"}
                    <input
                      type="file"
                      accept=".zip"
                      disabled={!clientName}
                      className="hidden"
                      onChange={handleBulkFileSelect}
                    />
                  </label>
                </div>
              </div>
            )}

            {bulkUploading && (
              <div className="border border-gray-800 rounded-2xl p-10 text-center">
                <Loader2 className="w-10 h-10 text-pink-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-medium mb-1">
                  {bulkProgress
                    ? `Processing ${bulkProgress.processed} of ${bulkProgress.total} rows...`
                    : "Uploading zip..."}
                </p>
                {bulkProgress?.currentFile && (
                  <p className="text-gray-500 text-sm">Current file: {bulkProgress.currentFile}</p>
                )}
                {bulkProgress && bulkProgress.total > 0 && (
                  <div className="mt-4 bg-gray-800 rounded-full h-2 max-w-md mx-auto overflow-hidden">
                    <div
                      className="bg-pink-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((bulkProgress.processed / bulkProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {bulkSummary && !bulkUploading && (
              <div className="border border-gray-800 rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <h2 className="text-white font-semibold text-lg">Import complete</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(bulkSummary).filter(([, count]) => count > 0).map(([type, count]) => (
                    <div key={type} className="bg-gray-900 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-white mb-1">{count}</div>
                      <div className="text-xs text-gray-400 capitalize">{type.replace(/-/g, " ")}</div>
                    </div>
                  ))}
                  {Object.values(bulkSummary).every((c) => c === 0) && (
                    <div className="col-span-full text-gray-500 text-sm">No rows were imported. Check the CSV filenames inside your zip.</div>
                  )}
                </div>
                {bulkErrors.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium text-sm">{bulkErrors.length} row{bulkErrors.length === 1 ? "" : "s"} had issues and were skipped</span>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {bulkErrors.map((e, i) => (
                        <p key={i} className="text-amber-300/70 text-xs font-mono">{e}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setBulkSummary(null); setBulkJobId(null); setBulkProgress(null); setBulkErrors([]); }}
                    className="border-gray-700"
                  >
                    Import another zip
                  </Button>
                  <Button onClick={() => setActiveTab("library")} className="bg-pink-600 hover:bg-pink-700">
                    View library
                  </Button>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-600 space-y-1">
              <p>Expected monthly volume per client: 12 carousels, 4 about mes, 4 seamless carousels, 5 single images, 5 reels, 10 trial reels = 40 entries</p>
              <p>Media is matched by filename (case-insensitive). Missing files are skipped and logged. Trial reels are marked private until manually approved.</p>
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="w-72">
            <Select value={clientName || "__none__"} onValueChange={(v) => setClientName(v === "__none__" ? "" : v)}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="__none__" className="text-gray-400">Select a client...</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.name} className="text-white">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {clientName && items.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectedIds.size === items.length ? clearSelection : selectAll}
                className="text-gray-400 hover:text-white"
              >
                {selectedIds.size === items.length ? (
                  <><CheckSquare className="w-4 h-4 mr-1.5" />Deselect all</>
                ) : (
                  <><Square className="w-4 h-4 mr-1.5" />Select all</>
                )}
              </Button>
              {selectedCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowScheduleModal(true)}
                  className="bg-pink-600 hover:bg-pink-700"
                >
                  <Calendar className="w-4 h-4 mr-1.5" />
                  Auto-schedule {selectedCount} post{selectedCount !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}
        </div>

        {clientName && (
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl transition-all mb-8 ${
              isDragging ? "border-pink-500 bg-pink-950/20" : "border-gray-700 hover:border-gray-600"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              {uploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-pink-400 animate-spin mb-3" />
                  <p className="text-white font-medium">{uploadProgress || "Uploading..."}</p>
                  <p className="text-gray-500 text-sm mt-1">This may take a moment for large batches</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-500 mb-3" />
                  <p className="text-white font-medium mb-1">Drop files here</p>
                  <p className="text-gray-500 text-sm max-w-md">
                    Drop a <span className="text-gray-300">.csv + .zip</span> together to bulk import.
                    Or drop <span className="text-gray-300">image/video files</span> directly for single posts.
                  </p>
                  <div className="mt-4 text-xs text-gray-600">
                    CSV columns: <code className="text-gray-500">post_type, caption, media_filename, music_track</code><br />
                    Hero posts add: <code className="text-gray-500">text_style=hero, lead_in, hero_word, hero_color, leadin_color</code>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!clientName && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="w-12 h-12 text-gray-700 mb-4" />
            <p className="text-gray-400 text-lg font-medium mb-1">Select a client to get started</p>
            <p className="text-gray-600 text-sm">Your library cards will appear here once a client is chosen.</p>
          </div>
        )}

        {clientName && loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
          </div>
        )}

        {clientName && !loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-400 font-medium">No posts in the library yet</p>
            <p className="text-gray-600 text-sm mt-1">Drop a CSV + zip above to bulk import.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => {
              const meta = POST_TYPE_META[item.postType] || POST_TYPE_META.single;
              const Icon = meta.icon;
              const isSelected = selectedIds.has(item.id);
              const thumb = item.thumbnailUrl || item.mediaUrl || item.mediaUrls?.[0] || null;
              const isVideo = item.postType === "reel" || (thumb && (thumb.endsWith(".mp4") || thumb.endsWith(".mov")));
              const isDeleteConfirm = deleteConfirmId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => { if (deleteConfirmId && deleteConfirmId !== item.id) setDeleteConfirmId(null); toggleSelect(item.id); }}
                  className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all group ${
                    isSelected ? "border-pink-500 ring-2 ring-pink-500/40" : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="aspect-square bg-gray-900 relative">
                    {thumb ? (
                      isVideo ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                          <Play className="w-8 h-8 text-white/60" />
                        </div>
                      ) : (item.metadata as any)?.textStyle === "hero" ? (
                        <HeroThumbnail item={item} />
                      ) : (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon className={`w-8 h-8 ${meta.color} opacity-40`} />
                      </div>
                    )}

                    <div className={`absolute top-2 left-2 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? "bg-pink-500 border-pink-500" : "border-white/60 bg-black/40"}`}>
                        {isSelected && <X className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    {item.mediaUrls && item.mediaUrls.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        {item.mediaUrls.length}
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-gray-900">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium flex items-center gap-1 ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-600">{formatDate(item.createdAt)}</span>
                    </div>
                    {item.caption && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{item.caption}</p>
                    )}
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          isDeleteConfirm
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "text-gray-600 hover:text-red-400"
                        }`}
                      >
                        {isDeleteConfirm ? "Confirm?" : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </main>

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Auto-schedule daily</h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-xs text-gray-400 mb-1.5 block">Start date</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={tomorrow()}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1.5 block">Post time (daily)</Label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 leading-relaxed">
                Schedule <span className="text-white font-semibold">{selectedCount} post{selectedCount !== 1 ? "s" : ""}</span> for <span className="text-white font-semibold">{clientName}</span>, one per day starting <span className="text-white font-semibold">{scheduleDate}</span> at <span className="text-white font-semibold">{scheduleTime}</span>.
                {selectedCount > 1 && (
                  <> The last post lands on <span className="text-white font-semibold">{endPreview}</span>.</>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="ghost" onClick={() => setShowScheduleModal(false)} className="flex-1 text-gray-400">
                  Cancel
                </Button>
                <Button
                  onClick={handleAutoSchedule}
                  disabled={scheduling}
                  className="flex-1 bg-pink-600 hover:bg-pink-700"
                >
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                  Schedule {selectedCount} post{selectedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
