import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { canvasToPng, logoLuma, makeClearLogo } from "@/lib/logo-clear";
import { OVER50_CAPTIONS, OVER50_CLOSERS, OVER50_PAGES, OVER50_PAY_URL, OVER50_PRICE } from "@/lib/over50-config";

// cybersuite.com/over50 : Women Over 50 bundle. 10 finished posts, the red swapped for the clinic colour,
// logo on, captions and hashtags ready. Black, hot pink and white, League Spartan 900.

const PINK = "#ff1f8e";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.o5 { background:#fff; color:#000; min-height:100vh; font-family:'League Spartan',sans-serif; font-weight:900; }
.o5 * { box-sizing:border-box; font-family:inherit; }
.o5-w { max-width: 980px; margin:0 auto; padding: 48px 20px 90px; }
.o5-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; }
.o5-h1 { font-size: clamp(40px,9vw,84px); line-height:.95; text-transform:uppercase; margin:10px 0 18px; }
.o5-h1 span { color:${PINK}; }
.o5-p { font-size: 19px; line-height:1.4; max-width: 640px; font-weight:700; color:#222; }
.o5-card { background:#fff; border:2px solid #000; padding: 24px; margin-top: 28px; }
.o5-g { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width:640px){ .o5-g { grid-template-columns: 1fr; } }
.o5-l { font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:#555; display:block; margin-bottom:6px; }
.o5-in { width:100%; background:#fff; border:2px solid #000; color:#000; padding:13px 14px; font-size:18px; font-weight:700; }
.o5-in:focus { outline:none; border-color:${PINK}; }
.o5-btn { background:${PINK}; color:#fff; border:0; padding:16px 26px; font-size:15px; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; text-decoration:none; display:inline-block; margin: 6px 10px 0 0; }
.o5-btn.alt { background:transparent; border:2px solid ${PINK}; color:#000; }
.o5-btn[disabled] { opacity:.4; cursor:default; }
.o5-posts { display:grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 14px; margin-top: 18px; }
.o5-posts canvas { width:100%; height:auto; display:block; }
.o5-cap { border-top:1px solid #ddd; padding: 16px 0; font-weight:600; font-size:16px; line-height:1.45; color:#222; white-space:pre-wrap; }
.o5-cap b { color:${PINK}; }
.o5-err { color:#c4004f; margin-top:12px; }
`;

type Pt = [number, number, number];
const hexToRgb = (h: string): Pt => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function accentFromLogo(c: HTMLCanvasElement): string | null {
  const t = document.createElement("canvas"); t.width = 64; t.height = 64;
  const x = t.getContext("2d", { willReadFrequently: true })!; x.drawImage(c, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data;
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    if (a < 200) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 40 || mx > 245 && mn > 225) continue;
    const k = `${r >> 5},${g >> 5},${b >> 5}`;
    const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
  }
  const top = [...bins.values()].sort((p, q) => q.n - p.n)[0];
  return top ? rgbToHex(top.r / top.n, top.g / top.n, top.b / top.n) : null;
}

const imgCache = new Map<number, Promise<HTMLImageElement>>();
function loadPage(i: number) {
  if (!imgCache.has(i)) imgCache.set(i, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `${BASE}/over50/p${i + 1}.jpg`; }));
  return imgCache.get(i)!;
}

function plate(g: CanvasRenderingContext2D, logo: HTMLCanvasElement, s: [number, number, number, number]) {
  const [x, y, w, h] = s;
  const dark = logoLuma(logo) > 0.72;
  g.fillStyle = dark ? "#111" : "#fff";
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
  const pad = 12, r = Math.min((w - pad * 2) / logo.width, (h - pad * 2) / logo.height);
  const lw = logo.width * r, lh = logo.height * r;
  g.drawImage(logo, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
}

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
  let size = Math.min(h * 0.55, 54);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  const words = text.toUpperCase().split(" ");
  for (; size > 16; size -= 2) {
    g.font = `900 ${size}px "League Spartan", sans-serif`;
    const lines: string[] = []; let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (g.measureText(t).width > w - 40 && cur) { lines.push(cur); cur = wd; } else cur = t; }
    lines.push(cur);
    if (lines.length * size * 1.1 <= h - 10) {
      const top = y + h / 2 - ((lines.length - 1) * size * 1.1) / 2;
      lines.forEach((ln, k) => g.fillText(ln, x + w / 2, top + k * size * 1.1));
      return;
    }
  }
}

async function renderPost(i: number, accent: string, logo: HTMLCanvasElement | null, clinic: string, locked: boolean): Promise<HTMLCanvasElement> {
  const img = await loadPage(i);
  const cfg = OVER50_PAGES[i];
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 1080, 1350);
  const data = g.getImageData(0, 0, 1080, 1350); const d = data.data;
  const A = hexToRgb(accent), R = cfg.ref;
  const refChroma = R[0] - (R[1] + R[2]) / 2;
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p], gg = d[p + 1], b = d[p + 2];
    const ch = r - (gg + b) / 2;
    if (ch < 18 || r < gg || r < b) continue;
    const a = Math.min(1, ch / refChroma);
    d[p] = Math.max(0, Math.min(255, r + a * (A[0] - R[0])));
    d[p + 1] = Math.max(0, Math.min(255, gg + a * (A[1] - R[1])));
    d[p + 2] = Math.max(0, Math.min(255, b + a * (A[2] - R[2])));
  }
  g.putImageData(data, 0, 0);
  if (cfg.box) { g.fillStyle = accent; g.fillRect(...cfg.box); }
  if (cfg.name && clinic.trim()) fitText(g, clinic.trim(), ...cfg.name);
  if (logo) plate(g, logo, cfg.slot);
  if (locked) {
    g.save(); g.translate(540, 675); g.rotate(-Math.PI / 6);
    g.font = '900 150px "League Spartan", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(255,255,255,0.35)"; g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 6;
    g.strokeText("PREVIEW", 0, 0); g.fillText("PREVIEW", 0, 0); g.restore();
  }
  return c;
}

const areaTag = (area: string) => area.replace(/[^a-z0-9 ]/gi, " ").split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
function buildCaptions(clinic: string, area: string): string[] {
  const a = areaTag(area) || "Local";
  const tags = `#${a} #${a}Beauty #${a}Aesthetics #${a}Women #${a}Over50`;
  const name = clinic.trim() || "my clinic";
  const place = area.trim() || "my area";
  return OVER50_CAPTIONS.map((t, i) => `${t.replace(/\{clinic\}/g, name).replace(/\{area\}/g, place)}\n\n${OVER50_CLOSERS[i]}\n\n${tags}`);
}

export default function Over50() {
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = qs.get("session_id") || "";
  const isTester = (() => { try { return !!localStorage.getItem("cybersuite-pw") && qs.get("paid") === "yes"; } catch { return false; } })();
  const [verified, setVerified] = useState(() => { try { return sessionStorage.getItem("o5-ok") === sessionId && !!sessionId; } catch { return false; } });
  useEffect(() => {
    if (!sessionId || verified) return;
    fetch(`${BASE}/api/over50/verify/${encodeURIComponent(sessionId)}`).then((r) => { if (r.ok) { setVerified(true); try { sessionStorage.setItem("o5-ok", sessionId); } catch { /* ignore */ } } }).catch(() => undefined);
  }, [sessionId, verified]);
  const paid = isTester || verified;
  const [clinic, setClinic] = useState("");
  const [area, setArea] = useState("");
  const [accent, setAccent] = useState("#c2185b");
  const [logo, setLogo] = useState<HTMLCanvasElement | null>(null);
  const [logoName, setLogoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [zipping, setZipping] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const run = useRef(0);

  useEffect(() => { document.title = "Women over 50 posts"; }, []);

  useEffect(() => {
    const me = ++run.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        await document.fonts.load('900 40px "League Spartan"');
        const cs: HTMLCanvasElement[] = [];
        for (let i = 0; i < 10; i++) { if (me !== run.current) return; cs.push(await renderPost(i, accent, logo, clinic, !paid)); }
        if (me === run.current && wrap.current) { wrap.current.replaceChildren(...cs); }
      } catch { setErr("Something went wrong drawing your posts. Please refresh."); }
      finally { if (me === run.current) setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [accent, logo, clinic, paid]);

  async function onLogo(f: File | undefined) {
    if (!f) return;
    setErr("");
    try {
      let file: Blob = f;
      if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) {
        const { default: heic2any } = await import("heic2any");
        const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.92 });
        file = Array.isArray(out) ? out[0] : out;
      }
      const clear = await makeClearLogo(file);
      setLogo(clear); setLogoName(f.name);
      const a = accentFromLogo(clear); if (a) setAccent(a);
    } catch { setErr("I could not read that logo. A PNG or JPG works best."); }
  }

  async function download() {
    setZipping(true);
    try {
      const zip = new JSZip();
      const cs = [...(wrap.current?.querySelectorAll("canvas") ?? [])] as HTMLCanvasElement[];
      for (let i = 0; i < cs.length; i++) zip.file(`over50-post-${String(i + 1).padStart(2, "0")}.png`, await canvasToPng(cs[i]));
      const caps = buildCaptions(clinic, area).map((c, i) => `POST ${i + 1}\n\n${c}`).join("\n\n------------------------------\n\n");
      zip.file("captions.txt", caps);
      saveAs(await zip.generateAsync({ type: "blob" }), `${(clinic || "my-clinic").replace(/[^a-z0-9]+/gi, "-")}-over50-posts.zip`);
    } finally { setZipping(false); }
  }

  const caps = buildCaptions(clinic, area);
  const ready = clinic.trim() && area.trim();

  return (
    <div className="o5"><style>{CSS}</style>
      <div className="o5-w">
        <div className="o5-k">Social Media Sister</div>
        <h1 className="o5-h1">Ten posts for your <span>over 50s</span></h1>
        <p className="o5-p">Bold, beautiful posts for the women who do not need permission. Add your logo and colour, check your captions and download the lot. {OVER50_PRICE} for all ten.</p>

        <div className="o5-card">
          <div className="o5-g">
            <label><span className="o5-l">Clinic name</span><input className="o5-in" value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="Your clinic" /></label>
            <label><span className="o5-l">Town or area (for your hashtags)</span><input className="o5-in" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Leeds" /></label>
            <label><span className="o5-l">Your logo</span><input className="o5-in" type="file" accept="image/*,.heic,.heif" onChange={(e) => onLogo(e.target.files?.[0])} />{logoName && <small style={{ color: "#555" }}>{logoName}, background removed</small>}</label>
            <label><span className="o5-l">Your accent colour</span><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 90, height: 50, background: "none", border: 0 }} /></label>
          </div>
          {err && <div className="o5-err">{err}</div>}
        </div>

        <div className="o5-posts" ref={wrap} />
        {busy && <p className="o5-p" style={{ marginTop: 14 }}>Drawing your posts...</p>}

        <div className="o5-card">
          {paid ? (
            <>
              <button className="o5-btn" disabled={!ready || zipping || busy} onClick={download}>{zipping ? "Packing..." : "Download my 10 posts"}</button>
              {!ready && <p className="o5-p" style={{ marginTop: 12 }}>Add your clinic name and area first so the captions and hashtags are yours.</p>}
            </>
          ) : OVER50_PAY_URL ? (
            <>
              <p className="o5-p">Happy with the look? {OVER50_PRICE} unlocks the clean posts, all ten captions and the download. Pay first, then come back to this page with your details.</p>
              <a className="o5-btn" href={OVER50_PAY_URL}>Unlock for {OVER50_PRICE}</a>
            </>
          ) : <p className="o5-p">Payment is being set up. Check back shortly.</p>}
        </div>

        <h2 className="o5-h1" style={{ fontSize: 34, marginTop: 44 }}>Your <span>captions</span></h2>
        {caps.map((c, i) => <div className="o5-cap" key={i}><b>Post {i + 1}</b>{"\n"}{c}</div>)}
      </div>
    </div>
  );
}
