import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, PenSquare, Trash2, Upload, X, Video, Link2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Post = { id: number; title: string; body: string; imageUrls: string[]; videoUrl: string | null; createdAt: string };
type Comment = { id: number; clientName: string; comment: string; createdAt: string };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/blog-posts`);
      const d = await r.json();
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked]);
    setPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const onVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
  };

  const publish = async () => {
    if (!title.trim() && !body.trim() && files.length === 0 && !videoFile) {
      toast.error("Add a title, some text, an image or a video first.");
      return;
    }
    setSaving(true);
    try {
      let imageUrls: string[] = [];
      if (files.length > 0) {
        const images = await Promise.all(files.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) })));
        const r = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images }),
        });
        if (!r.ok) throw new Error("Image upload failed");
        const d = await r.json();
        imageUrls = (d.results || []).map((x: any) => x.url).filter(Boolean);
      }
      let videoUrl: string | null = null;
      if (videoFile) {
        const form = new FormData();
        form.append("video", videoFile, videoFile.name);
        const r = await fetch(`https://workspaceapi-server-production-0f0d.up.railway.app/api/content/upload-video`, { method: "POST", body: form });
        if (!r.ok) throw new Error("Video upload failed");
        const d = await r.json();
        videoUrl = d.proxyUrl || d.url || null;
      }
      const r = await fetch(`${BASE}/api/blog-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, imageUrls, videoUrl }),
      });
      if (!r.ok) throw new Error("Failed to publish");
      setTitle(""); setBody(""); setFiles([]); setPreviews([]); setVideoFile(null); setVideoPreview(null);
      toast.success("Posted.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    await fetch(`${BASE}/api/blog-posts/${id}`, { method: "DELETE" });
    load();
  };

  const toggleComments = async (id: number) => {
    if (openComments === id) { setOpenComments(null); return; }
    setOpenComments(id);
    if (!comments[id]) {
      setCommentsLoading(id);
      try {
        const r = await fetch(`${BASE}/api/blog-posts/${id}/comments`);
        const d = await r.json();
        setComments((prev) => ({ ...prev, [id]: Array.isArray(d.comments) ? d.comments : [] }));
      } catch {
        setComments((prev) => ({ ...prev, [id]: [] }));
      } finally {
        setCommentsLoading(null);
      }
    }
  };

  const copyLink = (id: number) => {
    const url = `${window.location.origin}/rant/${id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied, ready to send to clients."),
      () => toast.error("Couldn't copy, here it is: " + url)
    );
  };

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Blog</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Goes out on the public blog and every client portal</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-4 rounded-2xl border border-border/50 p-4">
          <div className="flex items-center gap-2"><PenSquare className="w-4 h-4 text-pink-400" /><h2 className="font-semibold text-sm">New post</h2></div>
          <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is on your mind" className={inputCls} /></div>
          <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Text</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={inputCls + " resize-none"} /></div>
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Images (optional)</label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-zinc-800 h-24">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="w-full h-20 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 flex items-center justify-center cursor-pointer">
              <div className="text-center text-zinc-600"><Upload className="w-5 h-5 mx-auto mb-1" /><span className="text-xs">Add images</span></div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
            </label>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Video (optional)</label>
            {videoPreview ? (
              <div className="relative rounded-lg overflow-hidden border border-zinc-800 mb-2">
                <video src={videoPreview} controls className="w-full max-h-64 bg-black" />
                <button onClick={removeVideo} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
              </div>
            ) : (
              <label className="w-full h-20 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 flex items-center justify-center cursor-pointer">
                <div className="text-center text-zinc-600"><Video className="w-5 h-5 mx-auto mb-1" /><span className="text-xs">Add a video</span></div>
                <input type="file" accept="video/*" className="hidden" onChange={onVideo} />
              </label>
            )}
          </div>
          <button onClick={publish} disabled={saving} className="w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting...</> : "Post it"}
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Past posts</h2>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
          {!loading && posts.length === 0 && <p className="text-sm text-muted-foreground">Nothing posted yet.</p>}
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {p.title && <p className="font-semibold text-sm mb-1">{p.title}</p>}
                  {p.body && <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{p.body}</p>}
                  {p.videoUrl && (
                    <video src={p.videoUrl} controls className="w-full max-h-64 rounded-lg bg-black mb-2" />
                  )}
                  {p.imageUrls?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {p.imageUrls.map((url, i) => <img key={i} src={url} alt="" className="rounded-lg h-24 w-full object-cover" />)}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
                    <button onClick={() => copyLink(p.id)} className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300"><Link2 className="w-3 h-3" /> Copy client link</button>
                    <button onClick={() => toggleComments(p.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <MessageCircle className="w-3 h-3" /> Comments {openComments === p.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {openComments === p.id && (
                    <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
                      {commentsLoading === p.id && <p className="text-xs text-muted-foreground">Loading comments…</p>}
                      {commentsLoading !== p.id && (comments[p.id]?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
                      {comments[p.id]?.map((c) => (
                        <div key={c.id} className="text-xs bg-zinc-900/60 rounded-lg px-3 py-2">
                          <span className="font-semibold text-white">{c.clientName}</span>
                          <span className="text-muted-foreground"> · {timeAgo(c.createdAt)}</span>
                          <p className="text-muted-foreground mt-0.5">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(p.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
