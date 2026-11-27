import { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// cybersuite.com/voucher-collect/<slug> : the private page a clinic opens to download its finished voucher posts and stories with the captions.
const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
type Item = { n: number; kind: string; label: string; images: string[]; caption: string; tags: string };

export default function VoucherCollect({ slug }: { slug: string }) {
  const [data, setData] = useState<{ clinicName: string; items: Item[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${BASE}/api/voucher-collect/${encodeURIComponent(slug)}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("This link was not found. Please check it with Vanessa.");
      setData(j);
    }).catch((e) => setErr(e instanceof Error ? e.message : "Something went wrong"));
  }, [slug]);

  const text = (it: Item) => [it.caption, it.tags].filter(Boolean).join("\n\n");
  const grab = async (u: string) => (await fetch(u)).blob();
  const zipOne = async (it: Item) => {
    const z = new JSZip();
    for (let i = 0; i < it.images.length; i++) z.file(`${it.kind}-${it.n}-${i + 1}.png`, await grab(it.images[i]));
    if (text(it)) z.file("caption.txt", text(it));
    saveAs(await z.generateAsync({ type: "blob" }), `${it.kind}-${it.n}.zip`);
  };
  const zipAll = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const z = new JSZip();
      for (const it of data.items) {
        const dir = z.folder(`${it.kind}-${it.n}`)!;
        for (let i = 0; i < it.images.length; i++) dir.file(`${i + 1}.png`, await grab(it.images[i]));
        if (text(it)) dir.file("caption.txt", text(it));
      }
      saveAs(await z.generateAsync({ type: "blob" }), `${data.clinicName.replace(/[^a-z0-9]+/gi, "-")}-vouchers.zip`);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: ".2em", color: PINK, fontWeight: 700 }}>YOUR GIFT VOUCHER POSTS</div>
        <h1 style={{ fontSize: 34, margin: "6px 0 4px", fontWeight: 800 }}>{data ? data.clinicName : "Collect your vouchers"}</h1>
        {err && <p style={{ color: "#c00", fontWeight: 700 }}>{err}</p>}
        {!data && !err && <p>Loading...</p>}
        {data && (
          <>
            <p style={{ margin: "0 0 16px" }}>Download your posts and stories below. The words for each caption are underneath, ready to copy.</p>
            <button onClick={zipAll} disabled={busy} style={{ background: PINK, color: "#fff", border: 0, padding: "12px 20px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" }}>{busy ? "Getting them ready..." : "Download everything"}</button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20, marginTop: 24 }}>
              {data.items.map((it) => (
                <div key={`${it.kind}-${it.n}`} style={{ border: "2px solid #000", padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: PINK, textTransform: "uppercase" }}>{it.kind === "story" ? "Story sequence" : "Post"} {it.n}</div>
                  <div style={{ display: "flex", gap: 6, margin: "8px 0", overflowX: "auto" }}>
                    {it.images.map((u, i) => <img key={i} src={u} alt="" style={{ height: 220, width: "auto", border: "1px solid #ddd" }} />)}
                  </div>
                  {text(it) && <textarea readOnly value={text(it)} rows={5} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", fontSize: 13, padding: 8, border: "1px solid #000" }} />}
                  <button onClick={() => void zipOne(it)} style={{ marginTop: 8, background: "#000", color: "#fff", border: 0, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>Download these</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
