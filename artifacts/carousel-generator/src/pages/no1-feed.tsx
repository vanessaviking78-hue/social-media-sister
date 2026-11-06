import { useEffect, useState } from "react";

// NO 1 BODY SCULPTING, a private preview of her Instagram grid. White, black and hot pink.
// Nothing here is posted. It only shows how the written posts will look side by side.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const PINK = "#e6007e";

type FeedPost = { id: string; label: string; image: string; caption: string; tags: string };

export default function No1Feed() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
    document.title = "Your feed preview";
    fetch(`${BASE}/api/no1/feed`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("The feed would not load"))))
      .then((d) => setPosts(d.posts ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "The feed would not load"));
  }, []);

  useEffect(() => {
    if (open === null || !posts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : Math.min(posts.length - 1, o + 1)));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : Math.max(0, o - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, posts]);

  const current = open !== null && posts ? posts[open] : null;

  return (
    <div style={{ background: "#ffffff", color: "#111111", minHeight: "100vh", fontFamily: "Montserrat, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 935, margin: "0 auto", padding: "32px 16px 56px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <img src={`${BASE}/no1-logo.png`} alt="" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "contain", background: "#fff", border: "1.5px solid #ddd", padding: 12 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>NO 1 BODY SCULPTING</h1>
            <p style={{ margin: "4px 0 0", color: "#555" }}>Birmingham</p>
          </div>
        </header>

        <p style={{ margin: "0 0 24px", padding: "12px 16px", border: `1.5px solid ${PINK}`, borderRadius: 12, color: "#111", fontSize: 15 }}>
          Hey Lizzie, my spirit animal. This is your feed preview, so you can see what is going out and when. To read a caption, just tap the image. This is a preview of how your grid could look. Nothing has been posted.
        </p>

        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        {!error && posts === null && <p style={{ color: "#555" }}>Loading your feed...</p>}
        {posts && posts.length === 0 && <p style={{ color: "#555" }}>There are no posts here yet. Check back soon.</p>}

        {posts && posts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 3 }}>
            {posts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setOpen(i)}
                aria-label={`Open post: ${p.label}`}
                style={{ padding: 0, border: 0, background: "#eee", cursor: "pointer", aspectRatio: "4 / 5", overflow: "hidden" }}
              >
                <img src={p.image} alt={p.label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {current && posts && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, zIndex: 50 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#111", borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "94vh", overflowY: "auto" }}>
            <img src={current.image} alt={current.label} style={{ width: "100%", display: "block", borderRadius: "16px 16px 0 0" }} />
            <div style={{ padding: 16 }}>
              <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.55 }}>{current.caption}</p>
              {current.tags && <p style={{ margin: "0 0 16px", color: PINK, fontWeight: 600, overflowWrap: "anywhere", fontSize: 14 }}>{current.tags}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button onClick={() => setOpen(Math.max(0, open - 1))} disabled={open === 0} style={btn(open === 0)}>Previous</button>
                <button onClick={() => setOpen(null)} style={{ ...btn(false), background: PINK, borderColor: PINK, color: "#fff" }}>Close</button>
                <button onClick={() => setOpen(Math.min(posts.length - 1, open + 1))} disabled={open === posts.length - 1} style={btn(open === posts.length - 1)}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function btn(disabled: boolean): React.CSSProperties {
  return { font: "inherit", fontWeight: 600, padding: "10px 16px", minHeight: 44, borderRadius: 10, border: "1.5px solid #111", background: "#fff", color: "#111", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 };
}
