import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Post = { id: number; title: string; body: string; imageUrls: string[]; videoUrl: string | null; createdAt: string };
type Comment = { id: number; clientName: string; comment: string; createdAt: string };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function RantPublic({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/blog-posts/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`${BASE}/api/blog-posts/${id}/comments`).then((r) => (r.ok ? r.json() : { comments: [] })),
    ])
      .then(([postData, commentsData]) => {
        setPost(postData.post || null);
        setComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 py-8 px-6 text-center">
        <h1 className="font-bold text-3xl">The CyberSuite&trade;</h1>
        <p className="text-sm text-muted-foreground mt-2">Thoughts, updates and the odd rant</p>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
        {!loading && notFound && <p className="text-center text-sm text-muted-foreground">This one's not here any more.</p>}
        {!loading && post && (
          <article>
            {post.title && <h2 className="font-bold text-2xl mb-2">{post.title}</h2>}
            <p className="text-xs text-muted-foreground mb-4">{formatDate(post.createdAt)}</p>
            {post.videoUrl && (
              <video src={post.videoUrl} controls className="w-full rounded-xl bg-black mb-4" />
            )}
            {post.body && <p className="text-base leading-relaxed whitespace-pre-wrap mb-4">{post.body}</p>}
            {post.imageUrls?.length > 0 && (
              <div className={`grid gap-2 mb-4 ${post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {post.imageUrls.map((url, i) => <img key={i} src={url} alt="" className="rounded-xl w-full object-cover" />)}
              </div>
            )}

            <div className="border-t border-border/20 mt-8 pt-6">
              <h3 className="font-semibold text-sm mb-4">{comments.length} comment{comments.length === 1 ? "" : "s"}</h3>
              {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-muted/40 px-4 py-3">
                    <p className="text-sm font-semibold">{c.clientName}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
