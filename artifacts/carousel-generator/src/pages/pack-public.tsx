import { useEffect, useState } from "react";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type PackPostData = { n: number; kind: string; images: string[]; caption: string; tags: string };
type PackData = { slug: string; clinicName: string; logoUrl: string; accent: string; size: number; posts: PackPostData[] };

const KIND_LABEL: Record<string, string> = {
  treatment: "Treatment carousel",
  tweet: "Tweet",
  portrait: "Portrait",
  unique: "Carousel",
  empower: "Statement post",
  lux: "Carousel",
};

const CSS = `
.pp-root { --bg:#faf5f2; --card:#fffdfc; --ink:#2a1e1a; --muted:#6e5d56; --line:#ead9d0; --soft:#f6e6dc; --accent-ink:#ffffff;
  --display:"Instrument Serif", Georgia, serif; --body:"Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
  background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; min-height:100vh; box-sizing:border-box;
  padding:40px max(16px, env(safe-area-inset-right, 0px)) 56px max(16px, env(safe-area-inset-left, 0px)); }
@media (prefers-color-scheme: dark) {
  .pp-root { --bg:#181210; --card:#221915; --ink:#f6ebe6; --muted:#bba8a0; --line:#3d2f29; --soft:#2d211c; --accent-ink:#1d0f0a; color-scheme:dark; }
}
.pp-root * { box-sizing:border-box; }
.pp-wrap { max-width:1000px; margin:0 auto; display:flex; flex-direction:column; gap:36px; }
.pp-head { display:flex; flex-direction:column; gap:14px; }
.pp-from { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:700; }
.pp-h1 { font-family:var(--display); font-weight:400; font-size:clamp(38px,7vw,64px); line-height:1.02; margin:0; text-wrap:balance; }
.pp-lede { max-width:62ch; font-size:17px; margin:0; }
.pp-brand { width:240px; max-width:70%; height:auto; border-radius:14px; background:#fffcfb; align-self:flex-start; }
.pp-meta { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.pp-pill { border:1px solid var(--line); background:var(--card); padding:6px 12px; border-radius:999px; font-size:14px; color:var(--muted); }
.pp-btn { font:inherit; cursor:pointer; border:1.5px solid var(--ink); background:transparent; color:var(--ink); padding:10px 16px; border-radius:10px; font-weight:600; font-size:15px; min-height:44px; }
.pp-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
.pp-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.pp-status { min-height:22px; font-size:14px; color:var(--muted); }
.pp-post { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:16px; display:grid; grid-template-columns:minmax(0,360px) minmax(0,1fr); gap:24px; }
.pp-slides { display:flex; gap:10px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:6px; }
.pp-slides img { width:100%; flex:0 0 100%; height:auto; display:block; border-radius:10px; background:var(--soft); scroll-snap-align:start; }
.pp-count { font-size:13px; color:var(--muted); }
.pp-words { display:flex; flex-direction:column; gap:14px; min-width:0; }
.pp-day { font-family:var(--display); font-weight:400; font-size:26px; margin:0; }
.pp-caption { white-space:pre-wrap; margin:0; overflow-wrap:anywhere; }
.pp-tags { margin:0; color:var(--accent); font-weight:600; overflow-wrap:anywhere; font-size:15px; }
.pp-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:auto; }
.pp-foot { background:var(--soft); border-radius:18px; padding:24px; display:flex; flex-direction:column; gap:12px; }
.pp-foot h2 { font-family:var(--display); font-weight:400; font-size:30px; margin:0; }
.pp-foot p, .pp-foot li { max-width:68ch; margin:0; }
.pp-foot ol { margin:0; padding-left:22px; display:flex; flex-direction:column; gap:8px; }
.pp-sig { color:var(--muted); font-size:14px; }
@media (max-width:720px) { .pp-post { grid-template-columns:minmax(0,1fr); } .pp-actions .pp-btn { flex:1 1 140px; } }
`;

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function imageBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch failed");
  return r.blob();
}

export default function PackPublic({ slug }: { slug: string }) {
  const [data, setData] = useState<PackData | null>(null);
  const [error, setError] = useState("");
  const [top, setTop] = useState("");
  const [cardStatus, setCardStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex,nofollow";
    if (!document.getElementById("pp-fonts")) {
      const l = document.createElement("link");
      l.id = "pp-fonts";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Montserrat:wght@400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
    fetch(`${BASE}/api/free-samples/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<PackData>;
      })
      .then((d) => {
        setData(d);
        document.title = `${d.clinicName} Post Pack`;
      })
      .catch(() => setError("I could not find this pack. Please check the link I sent you."));
  }, [slug]);

  const base = (p: PackPostData) => `${data?.clinicName ?? "Pack"} Post ${p.n}`;
  const fullText = (p: PackPostData) => `${p.caption}\n\n${p.tags}`;
  const setCard = (n: number, msg: string) => setCardStatus((s) => ({ ...s, [n]: msg }));

  const saveOne = async (p: PackPostData) => {
    try {
      for (const [i, u] of p.images.entries()) {
        saveBlob(await imageBlob(u), p.images.length > 1 ? `${base(p)} slide ${i + 1}.jpg` : `${base(p)}.jpg`);
      }
      setCard(p.n, p.images.length > 1 ? "Saved. Post the slides in order." : "Saved.");
    } catch {
      setCard(p.n, "That did not save. Press and hold the image, or right click it, to save it instead.");
    }
  };

  const copyOne = async (p: PackPostData) => {
    try {
      await navigator.clipboard.writeText(fullText(p));
      setCard(p.n, "Copied. Now paste it into your post.");
    } catch {
      setCard(p.n, "Your browser blocked copying. Select the caption and copy it by hand.");
    }
  };

  const saveAll = async () => {
    if (!data) return;
    try {
      setTop("Packing the images...");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of data.posts) {
        for (const [i, u] of p.images.entries()) zip.file(p.images.length > 1 ? `${base(p)} slide ${i + 1}.jpg` : `${base(p)}.jpg`, await imageBlob(u));
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), `${data.clinicName} Post Pack.zip`);
      setTop("Saved.");
    } catch {
      setTop("That did not save. Try saving the posts one at a time.");
    }
  };

  const saveCaptions = () => {
    if (!data) return;
    const text = data.posts.map((p) => `POST ${p.n}\n\n${fullText(p)}`).join("\n\n----------\n\n");
    saveBlob(new Blob([text], { type: "text/plain" }), `${data.clinicName} Captions.txt`);
    setTop("Saved.");
  };

  if (error || !data) {
    return (
      <div className="pp-root">
        <style>{CSS}</style>
        <div className="pp-wrap">
          <p className="pp-lede">{error || "Loading your posts..."}</p>
        </div>
      </div>
    );
  }

  const accent = /^#[0-9a-fA-F]{6}$/.test(data.accent) ? data.accent : "#9a5a49";

  return (
    <div className="pp-root" style={{ ["--accent" as string]: accent }}>
      <style>{CSS}</style>
      <div className="pp-wrap">
        <header className="pp-head">
          <span className="pp-from">Your posts from Social Media Sister</span>
          {data.logoUrl ? <img className="pp-brand" src={data.logoUrl} alt={`${data.clinicName} logo`} /> : null}
          <h1 className="pp-h1">{data.clinicName}</h1>
          <p className="pp-lede">
            Hello from Vanessa. Your {data.posts.length} posts are below, each one in your colours with its caption and hashtags written and ready. Some are single images and some are carousels, so swipe along to see every slide.
          </p>
          <div className="pp-meta">
            <span className="pp-pill">{data.posts.length} posts</span>
            <button className="pp-btn primary" type="button" onClick={saveAll}>Save all images</button>
            <button className="pp-btn" type="button" onClick={saveCaptions}>Save all captions</button>
          </div>
          <div className="pp-status" role="status" aria-live="polite">{top}</div>
        </header>

        {data.posts.map((p) => (
          <article className="pp-post" key={p.n}>
            <div>
              <div className="pp-slides">
                {p.images.map((u, i) => (
                  <img key={u} src={u} alt={`Post ${p.n}${p.images.length > 1 ? `, slide ${i + 1}` : ""} for ${data.clinicName}`} />
                ))}
              </div>
              {p.images.length > 1 ? <span className="pp-count">{p.images.length} slides, swipe along</span> : null}
            </div>
            <div className="pp-words">
              <h3 className="pp-day">Post {p.n} <span className="pp-count">{KIND_LABEL[p.kind] ?? ""}</span></h3>
              <p className="pp-caption">{p.caption}</p>
              <p className="pp-tags">{p.tags}</p>
              <div className="pp-actions">
                <button className="pp-btn primary" type="button" onClick={() => saveOne(p)}>{p.images.length > 1 ? "Save slides" : "Save image"}</button>
                <button className="pp-btn" type="button" onClick={() => copyOne(p)}>Copy caption and hashtags</button>
              </div>
              <div className="pp-status" role="status" aria-live="polite">{cardStatus[p.n] ?? ""}</div>
            </div>
          </article>
        ))}

        <footer className="pp-foot">
          <h2>Before you post</h2>
          <ol>
            <li>Save each image to your phone or computer.</li>
            <li>Open Instagram or Facebook and upload the image, or the slides in order.</li>
            <li>Paste in the caption and hashtags, and change anything you like so it sounds like you.</li>
            <li>Read it through to check it suits your clinic, then post or schedule it yourself.</li>
            <li>Every caption ends with a question, so stay close to your comments and reply to everyone who joins in.</li>
          </ol>
          <p>If you would like me to take the whole thing off your plate each month, send me a message and we will have a lovely chat about it.</p>
          <p className="pp-sig">Vanessa Wormald, Social Media Sister</p>
        </footer>
      </div>
    </div>
  );
}
