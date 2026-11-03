import { useEffect, useState } from "react";

// cybersuite.com/10free/:slug : the private page a clinic gets once I have built their posts.

const PINK = "#ff1f8e";
const INK = "#111";
import { TENFREE_WHATSAPP } from "@/lib/tenfree-config";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Result = {
  clinicName: string; clinicianName: string; logoUrl: string; code: string; fact: string;
  posts: { n: number; kind: string; label: string; images: string[]; caption: string; tags: string }[];
  stories: { n: number; image: string; instruction?: string; poll: { question: string; a: string; b: string } }[];
  hooks: { hook: string; idea: string }[];
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.tp, .tp * { font-family:'League Spartan',sans-serif !important; font-weight:900 !important; box-sizing:border-box; }
.tp { background:#fff; color:${INK}; min-height:100vh; }
.tp-w { max-width:1000px; margin:0 auto; padding:0 24px; }
.tp-top { display:flex; justify-content:space-between; padding:28px 0; letter-spacing:.28em; font-size:12px; text-transform:uppercase; }
.tp-h1 { font-size:clamp(48px,10vw,110px); line-height:.9; text-transform:uppercase; margin:16px 0 18px; letter-spacing:-.02em; }
.tp-h1 span, .tp-pink { color:${PINK}; }
.tp-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; }
.tp-lede { font-size:clamp(18px,2.4vw,23px); line-height:1.3; max-width:640px; }
.tp-sec { padding-top:64px; }
.tp-sec h2 { font-size:clamp(30px,5vw,44px); text-transform:uppercase; line-height:1; margin:0 0 8px; border-top:3px solid ${INK}; padding-top:20px; }
.tp-sub { color:#666; font-size:16px; margin:0 0 24px; max-width:560px; line-height:1.35; }
.tp-tabs { display:flex; gap:0; margin-top:40px; border-bottom:3px solid ${INK}; }
.tp-tab { flex:1; background:#fff; color:${INK}; border:0; padding:22px 10px; font-size:clamp(16px,3.4vw,26px); letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
.tp-tab.on { background:${PINK}; color:#fff; }
.tp-post { padding:44px 0 36px; border-bottom:1px solid #e7e7e7; }
.tp-strip { display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:10px; }
.tp-strip img { height:min(78vh,820px); width:auto; max-width:92vw; flex:none; scroll-snap-align:start; display:block; box-shadow:0 18px 40px -22px rgba(0,0,0,.45); }
.tp-actions { margin-top:18px; }
.tp-cap { white-space:pre-wrap; font-size:15px; line-height:1.4; margin:10px 0 14px; }
.tp-btn { background:${PINK}; color:#fff; border:0; padding:12px 18px; font-size:13px; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; margin:0 8px 8px 0; text-decoration:none; display:inline-block; }
.tp-btn.k { background:${INK}; }
.tp-stories { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:34px; }
.tp-poll { font-size:14px; line-height:1.3; margin-top:8px; }
.tp-hook { display:grid; grid-template-columns:44px 1fr; gap:6px 12px; padding:14px 0; border-bottom:1px solid #eee; font-size:18px; line-height:1.25; }
.tp-hook small { grid-column:2; color:#777; font-size:14px; }
.tp-fact { background:${PINK}; color:#fff; padding:34px; font-size:clamp(20px,3vw,28px); line-height:1.25; }
.tp-code { border:3px dashed ${PINK}; padding:34px; text-align:center; }
.tp-code b { display:block; font-size:clamp(34px,7vw,64px); letter-spacing:.08em; color:${PINK}; margin:10px 0; }
.tp-foot { padding:60px 0; font-size:12px; letter-spacing:.24em; text-transform:uppercase; color:#999; }
`;

async function fileOf(url: string, name: string): Promise<Blob> {
  const r = await fetch(url);
  return r.blob();
}

export default function TenFreePublic({ slug }: { slug: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [missing, setMissing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [tab, setTab] = useState<"posts" | "stories" | "reels">("posts");

  useEffect(() => {
    document.title = "Your 10 free posts";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    fetch(`${BASE}/api/ten-free/page/${encodeURIComponent(slug)}`)
      .then(async (r) => (r.ok ? setData(await r.json()) : setMissing(true)))
      .catch(() => setMissing(true));
    return () => m.remove();
  }, [slug]);

  const save = async (url: string, name: string) => {
    const blob = await fileOf(url, name);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const dl = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  const slidesZip = async (p: Result["posts"][number]) => {
    if (p.images.length === 1) return save(p.images[0], `post-${p.n}.jpg`);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [i, u] of p.images.entries()) zip.file(`post-${p.n}-slide-${i + 1}.jpg`, await fileOf(u, ""));
    dl(await zip.generateAsync({ type: "blob" }), `post-${p.n}-slides.zip`);
  };
  const captionFile = (p: Result["posts"][number]) => dl(new Blob([`${p.caption}\n\n${p.tags}`], { type: "text/plain" }), `post-${p.n}-caption.txt`);
  const copy = (t: string) => navigator.clipboard.writeText(t).catch(() => undefined);

  const saveAll = async () => {
    if (!data) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of data.posts) {
        for (const [i, u] of p.images.entries()) zip.file(`posts/post-${p.n}-${i + 1}.jpg`, await fileOf(u, ""));
        zip.file(`posts/post-${p.n}-caption.txt`, `${p.caption}\n\n${p.tags}`);
      }
      for (const s of data.stories) {
        zip.file(`stories/story-${s.n}.jpg`, await fileOf(s.image, ""));
        zip.file(`stories/story-${s.n}-poll.txt`, `${s.poll.question}\n${s.poll.a} / ${s.poll.b}`);
      }
      zip.file("reel-hooks.txt", data.hooks.map((h, i) => `${i + 1}. ${h.hook}\n   Film: ${h.idea}`).join("\n\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "my-10-free-posts.zip";
      a.click();
    } finally {
      setZipping(false);
    }
  };

  if (missing) return <div className="tp"><style>{CSS}</style><div className="tp-w" style={{ padding: "120px 24px" }}><h1 className="tp-h1">Hmm.<br /><span>Not found.</span></h1><p className="tp-lede">That link does not look right. Please message me and I will send it again.</p></div></div>;
  if (!data) return <div className="tp"><style>{CSS}</style></div>;

  return (
    <div className="tp">
      <style>{CSS}</style>
      <div className="tp-w">
        <div className="tp-top"><span>Social Media Sister</span><span className="tp-pink">{data.clinicName}</span></div>
        <div className="tp-k">Made for {data.clinicianName}</div>
        <h1 className="tp-h1">Your <span>10 free</span> posts</h1>
        <p className="tp-lede">Ten posts, ten matching stories, ten reels to film and one little secret. Save the images, copy the captions and post whenever you like.</p>
        <p style={{ marginTop: 22 }}><button className="tp-btn k" disabled={zipping} onClick={saveAll}>{zipping ? "Packing it up..." : "Save everything in one go"}</button></p>

        <div className="tp-tabs">
          <button className={`tp-tab${tab === "posts" ? " on" : ""}`} onClick={() => setTab("posts")}>Posts</button>
          <button className={`tp-tab${tab === "stories" ? " on" : ""}`} onClick={() => setTab("stories")}>Stories</button>
          <button className={`tp-tab${tab === "reels" ? " on" : ""}`} onClick={() => setTab("reels")}>Reels</button>
        </div>

        {tab === "posts" && data.posts.map((p) => (
          <div className="tp-post" key={p.n}>
            <div className="tp-k" style={{ marginBottom: 14 }}>Post {p.n} · {p.label}</div>
            <div className="tp-strip">{p.images.map((u, i) => <img key={u} src={u} alt={`${p.label} ${i + 1}`} loading="lazy" />)}</div>
            <div className="tp-actions">
              <button className="tp-btn" onClick={() => slidesZip(p)}>{p.images.length > 1 ? "Download slides" : "Download image"}</button>
              <button className="tp-btn k" onClick={() => captionFile(p)}>Download caption</button>
              <button className="tp-btn k" onClick={() => copy(`${p.caption}\n\n${p.tags}`)}>Copy caption</button>
            </div>
            <div className="tp-cap">{p.caption}{p.tags ? `\n\n${p.tags}` : ""}</div>
          </div>
        ))}

        {tab === "stories" && (
          <div className="tp-sec" style={{ paddingTop: 36 }}>
            <p className="tp-sub">The same covers as your posts, sized for Instagram stories. Save one, add it to your story, then add the poll sticker underneath.</p>
            <div className="tp-stories">
              {data.stories.map((s) => (
                <div key={s.n}>
                  <img src={s.image} alt={`Story ${s.n}`} style={{ width: "100%", display: "block", boxShadow: "0 18px 40px -22px rgba(0,0,0,.45)" }} loading="lazy" />
                  <div className="tp-poll">
                    {s.instruction && <div style={{ marginBottom: 6 }}>{s.instruction}</div>}
                    <span className="tp-pink">Poll sticker:</span> {s.poll.question}<br />{s.poll.a} or {s.poll.b}
                  </div>
                  <button className="tp-btn k" style={{ marginTop: 10 }} onClick={() => save(s.image, `story-${s.n}.jpg`)}>Download story</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "reels" && (
          <div className="tp-sec" style={{ paddingTop: 36 }}>
            <p className="tp-sub">Ten hooks to film. Say the first line to camera. The idea underneath is what to film.</p>
            {data.hooks.map((h, i) => (
              <div className="tp-hook" key={i}><span className="tp-pink">{String(i + 1).padStart(2, "0")}</span><span>{h.hook}</span><small>{h.idea}</small></div>
            ))}
          </div>
        )}

        <div className="tp-sec">
          <h2>One tiny secret</h2>
          <div className="tp-fact">{data.fact}</div>
        </div>

        <div className="tp-sec">
          <h2>A little thank you</h2>
          <div className="tp-code">
            <div>3 months of social media for the price of 1</div>
            <b>{data.code}</b>
            <div style={{ fontSize: 15, color: "#666" }}>Message me and quote your code.</div>
            {TENFREE_WHATSAPP && <a className="tp-btn" style={{ marginTop: 16 }} href={`https://wa.me/${TENFREE_WHATSAPP}?text=${encodeURIComponent(`Hi Vanessa, my code is ${data.code}`)}`}>Message me on WhatsApp</a>}
          </div>
        </div>
        <div className="tp-foot">Social Media Sister</div>
      </div>
    </div>
  );
}
