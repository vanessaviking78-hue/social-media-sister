import React, { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, XCircle, RefreshCw, Layers, Film, FileImage } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PostContent = { imageUrls?: string[]; videoUrl?: string; caption: string; title: string };

type ScheduledPost = {
  id: number;
  presetId: number;
  clientName: string;
  postType: string;
  content: PostContent;
  scheduledAt: string;
  status: "pending" | "processing" | "published" | "failed" | "cancelled";
  metaStatus: "pending" | "success" | "failed" | "skipped";
  metaResult: { igPostId?: string; fbPostId?: string; error?: string } | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusPill(post: ScheduledPost) {
  if (post.status === "published") {
    const igOk = post.metaResult?.igPostId;
    const fbOk = post.metaResult?.fbPostId;
    const parts: string[] = [];
    if (igOk) parts.push("IG posted");
    if (fbOk) parts.push("FB posted");
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-emerald-900/40 text-emerald-300 border-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> {parts.length > 0 ? parts.join(" · ") : "Posted"}
      </span>
    );
  }
  if (post.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-900/40 text-red-300 border-red-700" title={post.metaResult?.error || ""}>
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  if (post.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-yellow-900/40 text-yellow-300 border-yellow-700">
        <RefreshCw className="w-3 h-3 animate-spin" /> Posting now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-blue-900/40 text-blue-300 border-blue-700">
      <Clock className="w-3 h-3" /> Queued
    </span>
  );
}

export default function Today() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
        status: "pending,processing,published,failed",
      });
      const r = await fetch(`${BASE}/api/scheduler/posts?${params.toString()}`);
      const d = await r.json().catch(() => ({ posts: [] }));
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const byClient = new Map<string, ScheduledPost[]>();
  for (const p of posts) {
    const arr = byClient.get(p.clientName) || [];
    arr.push(p);
    byClient.set(p.clientName, arr);
  }
  const clients = Array.from(byClient.keys()).sort((a, b) => a.localeCompare(b));
  for (const c of clients) {
    byClient.get(c)!.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/hub"><button className="text-zinc-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></button></Link>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-pink-400" />
            <h1 className="text-xl font-bold">Today</h1>
            <span className="ml-2 text-xs text-zinc-500">{todayLabel}</span>
          </div>
          <button onClick={load} className="ml-auto p-2 text-zinc-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && posts.length === 0 ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-zinc-600" /></div>
        ) : clients.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-500">Nothing scheduled to go out today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {clients.map((clientName) => {
              const clientPosts = byClient.get(clientName)!;
              return (
                <div key={clientName} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                    <span className="font-semibold text-sm">{clientName}</span>
                    <span className="text-xs text-zinc-500">{clientPosts.length} post{clientPosts.length !== 1 ? "s" : ""} today</span>
                  </div>
                  <div className="divide-y divide-zinc-900">
                    {clientPosts.map((post) => {
                      const thumb = post.content.imageUrls?.[0];
                      return (
                        <div key={post.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" />
                            ) : post.postType === "reel" ? (
                              <Film className="w-5 h-5 text-zinc-600" />
                            ) : (
                              <FileImage className="w-5 h-5 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium text-white">{fmtTime(post.scheduledAt)}</span>
                              <span className="capitalize">{post.postType}</span>
                              {post.postType === "carousel" ? <Layers className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                            </div>
                            <p className="text-sm text-white truncate mt-0.5">{post.content.title || "Untitled"}</p>
                            <p className="text-xs text-zinc-500 truncate">{post.content.caption}</p>
                          </div>
                          <div className="shrink-0">{statusPill(post)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
