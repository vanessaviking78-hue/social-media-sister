import { useEffect, useState } from "react";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type SamplePost = { n: number; week: number; day: string; imageUrl: string; caption: string; tags: string };
type SampleData = {
  slug: string;
  clinicName: string;
  logoUrl: string;
  accent: string;
  posts: SamplePost[];
};

const CSS = `
.sp-root { --bg:#faf5f2; --card:#fffdfc; --ink:#2a1e1a; --muted:#6e5d56; --line:#ead9d0; --soft:#f6e6dc; --accent-ink:#ffffff;
  --display:"DM Serif Display", Georgia, serif; --body:"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; min-height:100vh; box-sizing:border-box;
  padding:40px max(16px, env(safe-area-inset-right, 0px)) 56px max(16px, env(safe-area-inset-left, 0px)); }
@media (prefers-color-scheme: dark) {
  .sp-root { --bg:#181210; --card:#221915; --ink:#f6ebe6; --muted:#bba8a0; --line:#3d2f29; --soft:#2d211c; --accent-ink:#1d0f0a; color-scheme:dark; }
}
.sp-root * { box-sizing:border-box; }
.sp-wrap { max-width:980px; margin:0 auto; display:flex; flex-direction:column; gap:40px; }
.sp-head { display:flex; flex-direction:column; gap:14px; }
.sp-from { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:700; }
.sp-h1 { font-family:var(--display); font-weight:400; font-size:clamp(34px,6vw,56px); line-height:1.05; margin:0; text-wrap:balance; }
.sp-lede { max-width:62ch; font-size:18px; margin:0; }
.sp-brand { width:260px; max-width:70%; height:auto; border-radius:14px; background:#fffcfb; align-self:flex-start; }
.sp-meta { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.sp-pill { border:1px solid var(--line); background:var(--card); padding:6px 12px; border-radius:999px; font-size:14px; color:var(--muted); }
.sp-btn { font:inherit; cursor:pointer; border:1.5px solid var(--ink); background:transparent; color:var(--ink); padding:10px 16px; border-radius:10px; font-weight:700; font-size:15px; min-height:44px; }
.sp-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
.sp-btn:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.sp-status { min-height:22px; font-size:14px; color:var(--muted); }
.sp-week { display:flex; flex-direction:column; gap:20px; }
.sp-week h2 { font-family:var(--display); font-weight:400; font-size:28px; margin:0; display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
.sp-week h2 small { font-family:var(--body); font-size:14px; font-weight:500; color:var(--muted); }
.sp-post { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:16px; display:grid; grid-template-columns:minmax(0,340px) minmax(0,1fr); gap:24px; }
.sp-post img { width:100%; height:auto; aspect-ratio:4/5; display:block; border-radius:10px; background:var(--soft); }
.sp-words { display:flex; flex-direction:column; gap:14px; min-width:0; }
.sp-day { font-family:var(--display); font-weight:400; font-size:22px; margin:0; }
.sp-caption { white-space:pre-wrap; margin:0; overflow-wrap:anywhere; }
.sp-tags { margin:0; color:var(--accent); font-weight:600; overflow-wrap:anywhere; font-size:15px; }
.sp-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:auto; }
.sp-foot { background:var(--soft); border-radius:18px; padding:24px; display:flex; flex-direction:column; gap:12px; }
.sp-foot h2 { font-family:var(--display); font-weight:400; font-size:26px; margin:0; }
.sp-foot p, .sp-foot li { max-width:68ch; margin:0; }
.sp-foot ol { margin:0; padding-left:22px; display:flex; flex-direction:column; gap:8px; }
.sp-sig { color:var(--muted); font-size:14px; }
@media (max-width:720px) { .sp-post { grid-template-columns:minmax(0,1fr); } .sp-actions .sp-btn { flex:1 1 140px; } }
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

export default function SamplePublic({ slug }: { slug: string }) {
  const [data, setData] = useState<SampleData | null>(null);
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
    fetch(`${BASE}/api/free-samples/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<SampleData>;
      })
      .then((d) => {
        setData(d);
        document.title = `${d.clinicName} Sample Posts`;
      })
      .catch(() => setError("We could not find this sample. Please check the link you were sent."));
  }, [slug]);

  const fileName = (p: SamplePost) => `${data?.clinicName ?? "Sample"} Sample ${p.n}.jpg`;
  const fullText = (p: SamplePost) => `${p.caption}\n\n${p.tags}`;
  const setCard = (n: number, msg: string) => setCardStatus((s) => ({ ...s, [n]: msg }));

  const saveOne = async (p: SamplePost) => {
    try {
      saveBlob(await imageBlob(p.imageUrl), fileName(p));
      setCard(p.n, "Saved.");
    } catch {
      setCard(p.n, "That did not save. Press and hold the image, or right click it, to save it instead.");
    }
  };

  const copyOne = async (p: SamplePost) => {
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
      for (const p of data.posts) zip.file(fileName(p), await imageBlob(p.imageUrl));
      saveBlob(await zip.generateAsync({ type: "blob" }), `${data.clinicName} Sample Posts.zip`);
      setTop("Saved.");
    } catch {
      setTop("That did not save. Try saving the images one at a time.");
    }
  };

  const saveCaptions = () => {
    if (!data) return;
    const text = data.posts.map((p) => `WEEK ${p.week}, ${p.day.toUpperCase()}\n\n${fullText(p)}`).join("\n\n----------\n\n");
    saveBlob(new Blob([text], { type: "text/plain" }), `${data.clinicName} Sample Captions.txt`);
    setTop("Saved.");
  };

  if (error) {
    return (
      <div className="sp-root">
        <style>{CSS}</style>
        <div className="sp-wrap">
          <p className="sp-lede">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="sp-root">
        <style>{CSS}</style>
        <div className="sp-wrap">
          <p className="sp-lede">Loading your sample...</p>
        </div>
      </div>
    );
  }

  const accent = /^#[0-9a-fA-F]{6}$/.test(data.accent) ? data.accent : "#9a5a49";

  return (
    <div className="sp-root" style={{ ["--accent" as string]: accent }}>
      <style>{CSS}</style>
      <div className="sp-wrap">
        <header className="sp-head">
          <span className="sp-from">A free sample from Social Media Sister</span>
          {data.logoUrl ? <img className="sp-brand" src={data.logoUrl} alt={`${data.clinicName} logo`} /> : null}
          <h1 className="sp-h1">{data.clinicName}</h1>
          <p className="sp-lede">
            Hello from Vanessa. I made these from one photo and your logo, so you can see how your page could look. Eight posts across two weeks, one each for Monday, Wednesday, Friday and Sunday, with the captions and hashtags already written.
          </p>
          <div className="sp-meta">
            <span className="sp-pill">8 posts</span>
            <span className="sp-pill">2 weeks</span>
            <button className="sp-btn primary" type="button" onClick={saveAll}>Save all 8 images</button>
            <button className="sp-btn" type="button" onClick={saveCaptions}>Save all captions</button>
          </div>
          <div className="sp-status" role="status" aria-live="polite">{top}</div>
        </header>

        {[1, 2].map((w) => (
          <section className="sp-week" key={w}>
            <h2>
              Week {w}
              <small>Monday, Wednesday, Friday, Sunday</small>
            </h2>
            {data.posts
              .filter((p) => p.week === w)
              .map((p) => (
                <article className="sp-post" key={p.n}>
                  <img src={p.imageUrl} alt={`Week ${w} ${p.day} post for ${data.clinicName}`} width={1080} height={1350} />
                  <div className="sp-words">
                    <h3 className="sp-day">{p.day}</h3>
                    <p className="sp-caption">{p.caption}</p>
                    <p className="sp-tags">{p.tags}</p>
                    <div className="sp-actions">
                      <button className="sp-btn primary" type="button" onClick={() => saveOne(p)}>Save image</button>
                      <button className="sp-btn" type="button" onClick={() => copyOne(p)}>Copy caption and hashtags</button>
                    </div>
                    <div className="sp-status" role="status" aria-live="polite">{cardStatus[p.n] ?? ""}</div>
                  </div>
                </article>
              ))}
          </section>
        ))}

        <footer className="sp-foot">
          <h2>Before you post</h2>
          <ol>
            <li>Save each image to your phone or computer.</li>
            <li>Open Instagram or Facebook on your side and upload the image.</li>
            <li>Paste in the caption and hashtags, and change anything you like.</li>
            <li>Read it through to check it suits your clinic, then post or schedule it yourself.</li>
            <li>Every caption ends with a question, so stay close to your comments and reply to everyone who joins in.</li>
          </ol>
          <p>These are a sample of my work, so nothing is posted for you. If you would like more like this, send me a message at Social Media Sister and we will have a chat.</p>
          <p className="sp-sig">Vanessa Wormald, Social Media Sister</p>
        </footer>
      </div>
    </div>
  );
}
