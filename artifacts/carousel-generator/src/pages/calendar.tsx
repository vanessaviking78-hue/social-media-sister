import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  Layers, ChevronLeft, ChevronRight, Plus, X, Trash2, Pencil, CalendarDays, MessageSquareText,
  ImageIcon, GripVertical, Filter, BarChart3, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCalendar, type CalendarPost } from "@/lib/use-calendar";
import { CALENDAR_POST_STATUSES, CALENDAR_POST_TYPES } from "@workspace/db/schema";

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

  const { posts, allClients, loading, fetchPosts, fetchClients, createPost, updatePost, deletePost } = useCalendar();

  const dragPostId = useRef<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

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
    setFormClient("");
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
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(postId));
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
    const postId = dragPostId.current;
    if (!postId) return;
    dragPostId.current = null;
    try {
      await updatePost(postId, { date });
      toast.success("Post moved");
    } catch {
      toast.error("Failed to move post");
    }
  }, [updatePost]);

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
            <Link href="/" className="flex items-center gap-2">
              <img src="/sms-logo.png" alt="Social Media Sister" className="h-12 w-12 rounded-full object-cover" />
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Calendar</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-white transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-white transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-white transition">Stories</Link>
            <Link href="/reels" className="text-muted-foreground hover:text-white transition">Reels</Link>
            <Link href="/video-overlay" className="text-muted-foreground hover:text-white transition">Video Overlay</Link>
            <Link href="/presets" className="text-muted-foreground hover:text-white transition">Presets</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition">
              <MessageSquareText className="w-4 h-4" />Captions
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
            <h1 className="font-serif text-4xl font-semibold tracking-tight">Content Calendar</h1>
            <p className="text-muted-foreground mt-1">Plan and organise your content across clients.</p>
          </div>
        </div>

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
                {allClients.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
              const dayPosts = posts.filter((p) => p.date === day.date);
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
                    {(expandedDay === day.date ? dayPosts : dayPosts.slice(0, 3)).map((post) => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, post.id); }}
                        onClick={(e) => { e.stopPropagation(); openEdit(post); }}
                        className="group rounded px-1.5 py-1 text-[11px] leading-tight cursor-pointer hover:ring-1 hover:ring-white/20 transition-all"
                        style={{ backgroundColor: post.color + "22", borderLeft: `3px solid ${post.color}` }}
                      >
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                          {post.imageUrl && (
                            <img src={post.imageUrl} alt="" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
                          )}
                          <span className="truncate font-medium text-foreground/90">{post.title || post.clientName || getPostTypeBadge(post.postType)}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-4 mt-0.5">
                          <span className="text-[9px] px-1 py-px rounded bg-white/10 text-muted-foreground">{getPostTypeBadge(post.postType)}</span>
                          {post.clientName && <span className="text-[10px] text-muted-foreground truncate">{post.clientName}</span>}
                        </div>
                      </div>
                    ))}
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
