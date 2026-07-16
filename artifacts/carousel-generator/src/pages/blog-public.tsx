import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Post = { id: number; title: string; body: string; imageUrls: string[]; createdAt: string };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPublic() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/blog-posts`)
      .then((r) => r.json())
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 py-8 px-6 text-center">
        <h1 className="font-bold text-3xl">Social Media Sister</h1>
        <p className="text-sm text-muted-foreground mt-2">Thoughts, updates and the odd rant</p>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
        {!loading && posts.length === 0 && <p className="text-center text-sm text-muted-foreground">Nothing here yet, check back soon.</p>}
        {posts.map((p) => (
          <article key={p.id} className="border-b border-border/20 pb-10 last:border-0">
            {p.title && <h2 className="font-bold text-xl mb-2">{p.title}</h2>}
            <p className="text-xs text-muted-foreground mb-4">{formatDate(p.createdAt)}</p>
            {p.body && <p className="text-base leading-relaxed whitespace-pre-wrap mb-4">{p.body}</p>}
            {p.imageUrls?.length > 0 && (
              <div className={`grid gap-2 ${p.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {p.imageUrls.map((url, i) => <img key={i} src={url} alt="" className="rounded-xl w-full object-cover" />)}
              </div>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
