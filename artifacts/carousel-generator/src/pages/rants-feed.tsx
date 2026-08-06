import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type BlogPost = {
  id: number;
  title?: string;
  body?: string;
  videoUrl?: string;
  imageUrls?: string[];
};

type BlogComment = {
  id: number;
  clientName: string;
  comment: string;
};

export default function RantsFeed() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<number, BlogComment[]>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [names, setNames] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE}api/blog-posts`)
      .then((r) => r.json())
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const loadComments = (postId: number) => {
    fetch(`${BASE}api/blog-posts/${postId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments((prev) => ({ ...prev, [postId]: Array.isArray(d.comments) ? d.comments : [] })))
      .catch(() => {});
  };

  const submitComment = async (postId: number) => {
    const text = (drafts[postId] || "").trim();
    if (!text) return;
    setBusy(postId);
    try {
      const r = await fetch(`${BASE}api/blog-posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text, clientName: names[postId] || "" }),
      });
      if (r.ok) {
        setDrafts((prev) => ({ ...prev, [postId]: "" }));
        loadComments(postId);
      }
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Vanessa's Rants</h1>
          <p className="text-sm text-zinc-400 mt-1">Whatever I've got to say, it's all here. No login needed, just have a look.</p>
        </div>
        {loading && <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
        {!loading && posts.length === 0 && <p className="text-sm text-zinc-400">Nothing here yet, check back soon.</p>}
        {posts.map((p) => {
          if (!(p.id in comments)) loadComments(p.id);
          const postComments = comments[p.id] || [];
          return (
            <div key={p.id} className="rounded-2xl border border-zinc-800 p-4">
              {p.title && <p className="font-semibold text-sm mb-1">{p.title}</p>}
              {p.body && <p className="text-sm text-zinc-400 mb-2 whitespace-pre-wrap">{p.body}</p>}
              {p.videoUrl && <video src={p.videoUrl} controls className="rounded-lg w-full mb-2 bg-black" />}
              {p.imageUrls && p.imageUrls.length > 0 && (
                <div className={`grid gap-2 ${p.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {p.imageUrls.map((url, i) => <img key={i} src={url} alt="" className="rounded-lg w-full object-cover" />)}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                {postComments.map((c) => (
                  <div key={c.id} className="text-xs bg-zinc-900/60 rounded-lg px-3 py-2">
                    <span className="font-semibold text-white">{c.clientName}</span>
                    <p className="text-zinc-400 mt-0.5">{c.comment}</p>
                  </div>
                ))}
                <input
                  value={names[p.id] || ""}
                  onChange={(e) => setNames((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="Your name"
                  className="w-full rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white outline-none focus:border-pink-600 mb-2"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={drafts[p.id] || ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Leave a comment..."
                    className="flex-1 rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white outline-none focus:border-pink-600"
                  />
                  <button
                    onClick={() => submitComment(p.id)}
                    disabled={busy === p.id || !(drafts[p.id] || "").trim()}
                    className="text-xs font-semibold text-pink-400 hover:text-pink-300 disabled:opacity-40 px-2"
                  >
                    {busy === p.id ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
