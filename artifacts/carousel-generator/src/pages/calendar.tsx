import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "wouter";
import {
  Layers, ChevronLeft, ChevronRight, Plus, X, Trash2, Pencil, CalendarDays, MessageSquareText,
  ImageIcon, GripVertical, Filter, BarChart3, ShieldCheck, BookOpen, Clock, PanelRightOpen, PanelRightClose,
  Music, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCalendar, type CalendarPost } from "@/lib/use-calendar";
import { CALENDAR_POST_STATUSES, CALENDAR_POST_TYPES } from "@workspace/db/schema";

interface LibraryItem {
  id: number;
  clientName: string;
  postType: string;
  caption: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

function libraryTypeToCalendarType(t: string): string {
  if (t === "carousel") return "carousel";
  if (t === "story") return "story";
  return "single-image";
}

const POST_TYPE_META: Record<typeof CALENDAR_POST_TYPES[number], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  carousel: { label: "Carousel", icon: Layers },
  "single-image": { label: "Single Image", icon: ImageIcon },
  story: { label: "Story", icon: CalendarDays },
};

const POST_TYPES = CALENDAR_POST_TYPES.map((value) => ({ value, ...POST_TYPE_META[value] }));

const STATUS_LABELS: Record<typeof CALENDAR_POST_STATUSES[number], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  posted: "Posted",
};

const STATUS_OPTIONS = CALENDAR_POST_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

const COLORS = [
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6",
  "#a855f7", "#d946ef",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: fmt(d), day: d.getDate(), isCurrentMonth: false });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: fmt(new Date(year, month, d)), day: d, isCurrentMonth: true });
  }

  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startDow - lastDay.getDate() + 1);
    days.push({ date: fmt(d), day: d.getDate(), isCurrentMonth: false });
  }

  return days;
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filterClient, setFilterClient] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formPostType, setFormPostType] = useState("carousel");
  const [formTitle, setFormTitle] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [formColor, setFormColor] = useState("#ec4899");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const { posts, allClients, loading, fetchPosts, fetchClients, createPost, updatePost, deletePost } = useCalendar();

  // Music issues audit — upcoming scheduled posts where music is selected but the
  // post type doesn't support native audio attachment via the Meta API.
  const [musicIssues, setMusicIssues] = useState<{ id: number; clientName: string; postType: string; scheduledAt: string; musicTrack: { name: string; artist: string } }[]>([]);
  const [musicIssuesDismissed, setMusicIssuesDismissed] = useState(false);
  // Real scheduler queue (bulk / quote / before-after tools write here, not /api/calendar).
  const SCHED_OFFSET = 900000000;
  const [scheduledPosts, setScheduledPosts] = useState<CalendarPost[]>([]);

  useEffect(() => {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${BASE}/api/scheduler/posts?status=pending`)
      .then((r) => r.json())
      .then((data: { posts?: { id: number; clientName: string; postType: string; scheduledAt: string; content: { musicTrack?: { name: string; artist: string } | null; imageUrls?: string[] } }[] }) => {
        const issues = (data.posts || []).filter((p) => {
          if (!p.content?.musicTrack) return false;
          const pt = p.postType;
          if (pt === "reel" || pt === "story" || pt === "stories" || pt === "seamless") return false;
          if (pt === "carousel" && (p.content.imageUrls?.length ?? 0) > 1) return false;
          return true;
        }).map((p) => ({
          id: p.id,
          clientName: p.clientName,
          postType: p.postType,
          scheduledAt: p.scheduledAt,
          musicTrack: p.content.musicTrack!,
        }));
        setMusicIssues(issues);
        const sched: CalendarPost[] = (data.posts || []).map((p) => ({
          id: SCHED_OFFSET + p.id,
          date: (p.scheduledAt || "").slice(0, 10),
          clientName: p.clientName || "",
          postType: p.postType,
          title: "",
          caption: "",
          notes: "",
          status: "scheduled",
          color: "#22d3ee",
          imageUrl: p.content?.imageUrls?.[0] || null,
          createdAt: "",
          updatedAt: "",
        })).filter((p) => p.date);
        setScheduledPosts(sched);
      })
      .catch(() => { /* silent — non-critical audit */ });
  }, []);

  const dragPostId = useRef<number | null>(null);
  const dragLibraryItemId = useRef<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const fetchLibraryItems = useCallback(async (client?: string) => {
    setLibraryLoading(true);
    try {
      const params = client ? `?clientName=${encodeURIComponent(client)}` : "";
      const resp = await fetch(`${import.meta.env.BASE_URL}api/library${params}`);
      const data = await resp.json();
      setLibraryItems(data.items || []);
    } catch {
      /* ignore */
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showLibrary) fetchLibraryItems(filterClient || undefined);
  }, [showLibrary, filterClient, fetchLibraryItems]);

  const norm = (v: string) => (v || "").trim().toLowerCase();
  const scheduledForClient = useMemo(
    () => scheduledPosts.filter((p) => !filterClient || norm(p.clientName) === norm(filterClient)),
    [scheduledPosts, filterClient]
  );
  const clientOptions = useMemo(() => {
    const set = new Set<string>(allClients);
    scheduledPosts.forEach((p) => { if (p.clientName) set.add(p.clientName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allClients, scheduledPosts]);

  const days = getMonthDays(year, month);
  const fromDate = days[0].date;
  const toDate = days[days.length - 1].date;

  useEffect(() => {
    fetchClients(fromDate, toDate);
  }, [year, month, fetchClients, fromDate, toDate]);

  useEffect(() => {
    fetchPosts(fromDate, toDate, filterClient || undefined);
  }, [year, month, filterClient, fetchPosts, fromDate, toDate]);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const openCreate = (date: string) => {
    setEditingPost(null);
    setFormDate(date);
    setFormClient(filterClient || "");
    setFormPostType("carousel");
    setFormTitle("");
    setFormCaption("");
    setFormNotes("");
    setFormStatus("draft");
    setFormColor("#ec4899");
    setFormImageUrl("");
    setShowModal(true);
  };

  const openEdit = (post: CalendarPost) => {
    setEditingPost(post);
    setFormDate(post.date);
    setFormClient(post.clientName);
    setFormPostType(post.postType);
    setFormTitle(post.title);
    setFormCaption(post.caption);
    setFormNotes(post.notes);
    setFormStatus(post.status);
    setFormColor(post.color);
    setFormImageUrl(post.imageUrl || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formDate) { toast.error("Date is required"); return; }
    try {
      if (editingPost) {
        await updatePost(editingPost.id, {
          date: formDate, clientName: formClient, postType: formPostType,
          title: formTitle, caption: formCaption, notes: formNotes, status: formStatus, color: formColor,
          imageUrl: formImageUrl || null,
        });
        toast.success("Post updated");
      } else {
        await createPost({
          date: formDate, clientName: formClient, postType: formPostType,
          title: formTitle, caption: formCaption, notes: formNotes, status: formStatus, color: formColor,
          imageUrl: formImageUrl || null,
        });
        toast.success("Post created");
      }
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePost(id);
      toast.success("Post deleted");
      setDeleteConfirmId(null);
      if (editingPost?.id === id) setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
  };

  const handleDragStart = (e: React.DragEvent, postId: number) => {
    dragPostId.current = postId;
    dragLibraryItemId.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(postId));
  };

  const handleLibraryDragStart = (e: React.DragEvent, itemId: number) => {
    dragLibraryItemId.current = itemId;
    dragPostId.current = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", String(itemId));
  };

  const handleDragOver = useCallback((e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(null);

    if (dragLibraryItemId.current) {
      const libId = dragLibraryItemId.current;
      dragLibraryItemId.current = null;
      const item = libraryItems.find((i) => i.id === libId);
      if (!item) return;
      setEditingPost(null);
      setFormDate(date);
      setFormClient(item.clientName);
      setFormPostType(libraryTypeToCalendarType(item.postType));
      setFormTitle(item.caption?.slice(0, 60) || "");
      setFormCaption(item.caption || "");
      setFormNotes("");
      setFormStatus("draft");
      setFormColor("#ec4899");
      setFormImageUrl(item.thumbnailUrl || item.mediaUrl || "");
      setShowModal(true);
      return;
    }

    const postId = dragPostId.current;
    if (!postId) return;
    dragPostId.current = null;
    try {
      await updatePost(postId, { date });
      toast.success("Post moved");
    } catch {
      toast.error("Failed to move post");
    }
  }, [updatePost, libraryItems]);

  const todayStr = fmt(today);

  const getPostTypeBadge = (type: string) => {
    const t = POST_TYPES.find((pt) => pt.value === type);
    return t ? t.label : type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500/20 text-gray-400";
      case "scheduled": return "bg-blue-500/20 text-blue-400";
      case "posted": return "bg-green-500/20 text-green-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border/20">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="flex items-center gap-2">
              <img src="/sms-logo.png" alt="Social Media Sister" className="h-8 w-auto object-contain" />
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Calendar</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/hub" className="text-muted-foreground hover:text-white transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-white transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-white transition">Stories</Link>
            <Link href="/reels" className="text-muted-foreground hover:text-white transition">Reels</Link>
            <Link href="/video-overlay" className="text-muted-foreground hover:text-white transition">Video Overlay</Link>
            <Link href="/presets" className="text-muted-foreground hover:text-white transition">Presets</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition">
              <MessageSquareText className="w-4 h-4" />Captions
            </Link>
            <Link href="/library" className="flex items-center gap-1 text-muted-foreground hover:text-white transition">
              <BookOpen className="w-4 h-4" />Library
            </Link>
            <Link href="/analytics" className="flex items-center gap-1 text-muted-foreground hover:text-white transition">
              <BarChart3 className="w-4 h-4" />Analytics
            </Link>
            <Link href="/approval" className="flex items-center gap-1 text-muted-foreground hover:text-white transition">
              <ShieldCheck className="w-4 h-4" />Approvals
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-sans text-4xl font-semibold tracking-tight">Content Calendar</h1>
            <p className="text-muted-foreground mt-1">Plan and organise your content across clients.</p>
          </div>
        </div>

        {/* Music issues audit banner */}
        {musicIssues.length > 0 && !musicIssuesDismissed && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-1.5 text-amber-400 mt-0.5 shrink-0">
                  <Music className="w-4 h-4" />
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-400">
                    {musicIssues.length === 1 ? "1 scheduled post" : `${musicIssues.length} scheduled posts`} with music that won't attach automatically
                  </p>
                  <p className="text-xs text-amber-300/70 mt-0.5 mb-3">
                    Instagram's API doesn't support automatic music attachment for these post types. The music is saved as a note only. To use the track, add it manually in the Instagram app after publishing, or reschedule as a Reel.
                  </p>
                  <div className="space-y-1.5">
                    {musicIssues.map((issue) => (
                      <div key={issue.id} className="flex items-center gap-2 text-xs text-amber-200/80">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono capitalize">{issue.postType}</span>
                        <span className="font-medium">{issue.clientName}</span>
                        <span className="text-amber-300/50">·</span>
                        <span>{new Date(issue.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-amber-300/50">·</span>
                        <span className="italic">{issue.musicTrack.name} — {issue.musicTrack.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setMusicIssuesDismissed(true)} className="text-amber-400/60 hover:text-amber-400 transition-colors shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={prevMonth} className="h-10 w-10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[200px] text-center">{MONTH_NAMES[month]} {year}</h2>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-10 w-10">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="ml-2 text-muted-foreground">
              Today
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showLibrary ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowLibrary((v) => !v)}
              className="gap-2"
            >
              {showLibrary ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              Library
            </Button>
          </div>
        </div>

        <div className={`flex gap-4 ${showLibrary ? "items-start" : ""}`}>
        <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <div className="grid grid-cols-7 bg-accent/20">
            {DAYS.map((day) => (
              <div key={day} className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/20">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayPosts = [...posts, ...scheduledForClient].filter((p) => p.date === day.date);
              const isToday = day.date === todayStr;
              const isDragTarget = dragOverDate === day.date;
              return (
                <div
                  key={i}
                  className={`min-h-[120px] border-b border-r border-border/10 p-1.5 transition-colors ${
                    !day.isCurrentMonth ? "bg-background/30 opacity-40" : ""
                  } ${isDragTarget ? "bg-primary/10 ring-1 ring-primary/30 ring-inset" : ""}`}
                  onDragOver={(e) => handleDragOver(e, day.date)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day.date)}
                  onClick={() => day.isCurrentMonth && openCreate(day.date)}
                >
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-muted-foreground"}`}>
                      {day.day}
                    </span>
                    {day.isCurrentMonth && dayPosts.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{dayPosts.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {(expandedDay === day.date ? dayPosts : dayPosts.slice(0, 3)).map((post) => {
                      const isSched = post.id >= SCHED_OFFSET;
                      return (
                      <div
                        key={post.id}
                        draggable={!isSched}
                        onDragStart={(e) => { if (isSched) return; e.stopPropagation(); handleDragStart(e, post.id); }}
                        onClick={(e) => { e.stopPropagation(); if (!isSched) openEdit(post); }}
                        title={isSched ? "Already scheduled to go out" : undefined}
                        className={`group rounded px-1.5 py-1 text-[11px] leading-tight transition-all ${isSched ? "cursor-default opacity-95" : "cursor-pointer hover:ring-1 hover:ring-white/20"}`}
                        style={{ backgroundColor: post.color + "22", borderLeft: `3px solid ${post.color}` }}
                      >
                        <div className="flex items-center gap-1">
                          {!isSched && <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />}
                          {post.imageUrl && (
                            <img src={post.imageUrl} alt="" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
                          )}
                          <span className="truncate font-medium text-foreground/90">{post.title || post.clientName || getPostTypeBadge(post.postType)}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-4 mt-0.5">
                          <span className="text-[9px] px-1 py-px rounded bg-white/10 text-muted-foreground">{getPostTypeBadge(post.postType)}</span>
                          {isSched && <span className="text-[9px] px-1 py-px rounded bg-cyan-400/20 text-cyan-300">Scheduled</span>}
                          {post.clientName && <span className="text-[10px] text-muted-foreground truncate">{post.clientName}</span>}
                        </div>
                      </div>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      expandedDay === day.date ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                          className="text-[10px] text-pink-400 hover:text-pink-300 text-center w-full cursor-pointer"
                        >
                          Show less
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedDay(day.date); }}
                          className="text-[10px] text-pink-400 hover:text-pink-300 text-center w-full cursor-pointer"
                        >
                          +{dayPosts.length - 3} more
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
        )}
        </div>

        {showLibrary && (
          <div className="w-72 flex-shrink-0 rounded-xl border border-border/30 bg-card overflow-hidden sticky top-24 self-start">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-accent/10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-pink-400" />
                <span className="text-sm font-semibold">Content Library</span>
              </div>
              <span className="text-xs text-muted-foreground">{libraryItems.length} items</span>
            </div>
            <p className="text-xs text-muted-foreground px-4 py-2 border-b border-border/10">Drag an item onto a calendar day to schedule it.</p>
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] divide-y divide-border/10">
              {libraryLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : libraryItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No library items yet.</div>
              ) : (
                libraryItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleLibraryDragStart(e, item.id)}
                    className="flex gap-3 p-3 cursor-grab hover:bg-accent/20 transition-colors group"
                  >
                    {item.thumbnailUrl || item.mediaUrl ? (
                      <img
                        src={item.thumbnailUrl || item.mediaUrl || ""}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border/20"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-accent/30 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] px-1 py-px rounded bg-pink-500/20 text-pink-400 uppercase tracking-wide font-medium">
                          {item.postType}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{item.clientName}</span>
                      </div>
                      <p className="text-xs text-foreground/80 line-clamp-2 leading-snug">{item.caption || "No caption"}</p>
                    </div>
                    <GripVertical className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0 self-center transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border/20">
              <h3 className="text-xl font-semibold">{editingPost ? "Edit Post" : "New Post"}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Post Type</Label>
                  <Select value={formPostType} onValueChange={setFormPostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POST_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">Client Name</Label>
                <Input value={formClient} onChange={(e) => setFormClient(e.target.value)} placeholder="e.g. Skin Clinic London" />
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Post title or topic" />
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">Caption</Label>
                <Textarea value={formCaption} onChange={(e) => setFormCaption(e.target.value)} placeholder="Instagram caption..." rows={3} />
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Internal notes..." rows={2} />
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">Image / Thumbnail URL</Label>
                <Input value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://example.com/image.jpg (optional)" />
                {formImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={formImageUrl} alt="Preview" className="w-12 h-12 rounded object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-xs text-muted-foreground">Preview</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Colour</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFormColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${formColor === c ? "border-white scale-110" : "border-transparent hover:border-white/40"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-border/20">
              <div>
                {editingPost && (
                  deleteConfirmId === editingPost.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Delete?</span>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(editingPost.id)}>Yes</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>No</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => setDeleteConfirmId(editingPost.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  )
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editingPost ? "Update" : "Create"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
