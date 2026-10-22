import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Gift, Loader2, Copy, ExternalLink, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const W = 1080;
const H = 1350;

// ---------- the 8 posts: which Studio image, which look ----------

type MixType = "half" | "standard";
type Plan = { id: string; look: "stylish" | "magazine"; zoom?: boolean; mixStyle?: string };

// Half scrubs, half normal clothes: 4 in black scrubs, 2 jeans and shirt, 2 black jumper.
const PLAN_HALF: Plan[] = [
  { id: "mx-01", look: "magazine" },
  { id: "mx-05", look: "stylish" },
  { id: "mx-02", look: "magazine" },
  { id: "mx-13", look: "stylish" },
  { id: "mx-03", look: "stylish" },
  { id: "mx-06", look: "magazine" },
  { id: "mx-04", look: "stylish" },
  { id: "mx-14", look: "magazine" },
];
// Standard mix: 2 from each of the four groups.
const PLAN_STANDARD: Plan[] = [
  { id: "mx-01", look: "magazine" },
  { id: "mx-05", look: "stylish" },
  { id: "mx-13", look: "magazine" },
  { id: "mx-09", look: "stylish", zoom: true, mixStyle: "luxe" },
  { id: "mx-02", look: "stylish" },
  { id: "mx-06", look: "magazine" },
  { id: "mx-14", look: "stylish" },
  { id: "mx-10", look: "magazine", mixStyle: "everyday" },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHIRT_IDS = ["mx-05", "mx-06", "mx-07", "mx-08"];

type PostDraft = {
  n: number;
  week: number;
  day: string;
  look: "stylish" | "magazine";
  headline: string;
  subtitle: string;
  caption: string;
  tags: string;
  zoom: boolean;
  photo: HTMLImageElement;
  preview: string;
};

type SavedSample = { slug: string; clinicName: string; createdAt: string };

// ---------- canvas helpers ----------

type Palette = { band: string; rule: string; ink: string; sub: string; accentHex: string; tile: string };

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
}
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load an image"));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

// Trim the empty margin around the logo, read its background and pick the clinic colours from it.
async function prepareLogo(file: File): Promise<{ logo: HTMLCanvasElement; palette: Palette }> {
  const img = await loadImage(await fileToDataUrl(file));
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const corner = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const cs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const transparent = cs.every((p) => p[3] < 40);
  const bg = transparent ? [255, 255, 255] : [0, 1, 2].map((k) => Math.round(cs.reduce((a, p) => a + p[k], 0) / 4));

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 40) continue;
      const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 60) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const mx = Math.max(data[i], data[i + 1], data[i + 2]);
        const mn = Math.min(data[i], data[i + 1], data[i + 2]);
        if (mx - mn > 28 && mx < 235) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }
  const padX = Math.round((maxX - minX) * 0.05) + 6;
  const padY = Math.round((maxY - minY) * 0.08) + 6;
  const x0 = Math.max(0, minX - padX), y0 = Math.max(0, minY - padY);
  const x1 = Math.min(w, maxX + padX), y1 = Math.min(h, maxY + padY);
  const logo = document.createElement("canvas");
  logo.width = x1 - x0;
  logo.height = y1 - y0;
  const lctx = logo.getContext("2d")!;
  lctx.fillStyle = rgb(bg);
  lctx.fillRect(0, 0, logo.width, logo.height);
  lctx.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);

  const accent = count > 40 ? [Math.round(r / count), Math.round(g / count), Math.round(b / count)] : [150, 120, 105];
  const accentDark = mix(accent, [0, 0, 0], 0.18);
  return {
    logo,
    palette: {
      band: rgb(mix(accent, [255, 255, 255], 0.84)),
      rule: rgb(accentDark),
      ink: rgb(mix(accent, [0, 0, 0], 0.84)),
      sub: rgb(mix(accent, [0, 0, 0], 0.66)),
      accentHex: hex(mix(accent, [0, 0, 0], 0.32)),
      tile: rgb(bg),
    },
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const SERIF = '"DM Serif Display", "Cormorant Garamond", Georgia, serif';
const SANS = '"Plus Jakarta Sans", "Poppins", system-ui, sans-serif';

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxw: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const t = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(t).width <= maxw) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, maxw: number, maxh: number, start: number, min: number, spacing: number) {
  let size = start;
  while (size >= min) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, text, maxw);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxw);
    if (fits && lines.length * size * spacing <= maxh) return { lines, size };
    size -= 2;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return { lines: wrapLines(ctx, text, maxw), size: min };
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, top: number, zoom: boolean) {
  if (zoom) {
    const sx = img.width * 0.279;
    const sy = img.height * 0.172;
    const sw = img.width * 0.72;
    const sh = (sw * H) / W;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return;
  }
  const availH = H - top;
  const scale = Math.max(W / img.width, availH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, W, availH);
  ctx.clip();
  ctx.drawImage(img, (W - dw) / 2, top, dw, dh);
  ctx.restore();
}

function drawLogoTile(ctx: CanvasRenderingContext2D, logo: HTMLCanvasElement, palette: Palette, xRight: number, yTop: number, tileH: number): number {
  const pad = 10;
  const lh = tileH - 2 * pad;
  const lw = Math.round((lh * logo.width) / logo.height);
  const tw = lw + 2 * pad;
  ctx.save();
  roundRect(ctx, xRight - tw, yTop, tw, tileH, 14);
  ctx.fillStyle = palette.tile;
  ctx.fill();
  ctx.clip();
  ctx.drawImage(logo, xRight - tw + pad, yTop + pad, lw, lh);
  ctx.restore();
  return tw;
}

function renderPost(post: Pick<PostDraft, "look" | "headline" | "subtitle" | "zoom" | "photo">, logo: HTMLCanvasElement, palette: Palette, mastheadArea: string): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  const headline = post.headline.trim();
  const subtitle = post.subtitle.trim();

  if (post.look === "stylish") {
    drawPhoto(ctx, post.photo, 0, post.zoom);
    const bandH = 400;
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, H - bandH, W, bandH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, H - bandH, W, 6);
    const pad = 70;
    const maxw = W - 2 * pad;
    const hl = fitText(ctx, headline, SERIF, "400", maxw, 210, 140, 70, 1.08);
    let y = H - bandH + 44;
    ctx.fillStyle = palette.ink;
    ctx.font = `400 ${hl.size}px ${SERIF}`;
    for (const line of hl.lines) {
      ctx.fillText(line, pad, y + hl.size * 0.82);
      y += Math.round(hl.size * 1.08);
    }
    const sl = fitText(ctx, subtitle, SANS, "600", maxw, 120, 46, 30, 1.25);
    y += 14;
    ctx.fillStyle = palette.sub;
    ctx.font = `600 ${sl.size}px ${SANS}`;
    for (const line of sl.lines) {
      ctx.fillText(line, pad, y + sl.size * 0.85);
      y += Math.round(sl.size * 1.25);
    }
    drawLogoTile(ctx, logo, palette, W - 40, 40, 190);
  } else {
    const stripH = 170;
    drawPhoto(ctx, post.photo, stripH, post.zoom);
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, 0, W, stripH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, stripH, W, 4);
    const tw = drawLogoTile(ctx, logo, palette, W - 30, 10, stripH - 20);
    const mastText = `THE ${mastheadArea.toUpperCase()} EDIT`;
    const mastMax = W - tw - 30 - 50 - 30;
    let ms = 40;
    ctx.font = `400 ${ms}px ${SERIF}`;
    while (ctx.measureText(mastText).width > mastMax && ms > 20) {
      ms -= 2;
      ctx.font = `400 ${ms}px ${SERIF}`;
    }
    ctx.fillStyle = palette.ink;
    ctx.fillText(mastText, 50, stripH / 2 + ms * 0.32);

    const cardW = 880;
    const inner = cardW - 100;
    const hl = fitText(ctx, headline, SERIF, "400", inner, 260, 120, 60, 1.08);
    const sl = fitText(ctx, subtitle, SANS, "500", inner, 100, 38, 26, 1.25);
    const cardH = 44 + Math.round(hl.lines.length * hl.size * 1.08) + 24 + Math.round(sl.lines.length * sl.size * 1.25) + 44;
    const y0 = H - cardH - 70;
    ctx.fillStyle = palette.band;
    ctx.fillRect(0, y0, cardW, cardH);
    ctx.fillStyle = palette.rule;
    ctx.fillRect(0, y0, 12, cardH);
    let y = y0 + 44;
    ctx.fillStyle = palette.ink;
    ctx.font = `400 ${hl.size}px ${SERIF}`;
    for (const line of hl.lines) {
      ctx.fillText(line, 56, y + hl.size * 0.82);
      y += Math.round(hl.size * 1.08);
    }
    ctx.fillStyle = palette.rule;
    ctx.fillRect(56, y + 6, 90, 3);
    y += 24;
    ctx.fillStyle = palette.sub;
    ctx.font = `500 ${sl.size}px ${SANS}`;
    for (const line of sl.lines) {
      ctx.fillText(line, 56, y + sl.size * 0.85);
      y += Math.round(sl.size * 1.25);
    }
  }
  return c.toDataURL("image/jpeg", 0.92);
}

function dataUrlToBlob(url: string): Blob {
  const [head, body] = url.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const inputCls = "w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">{children}</span>;
}

type Card = { scenarioId: string; status: string; outputImageUrl?: string; failureReason?: string };

export default function FreeSample() {
  const [clinicName, setClinicName] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [area, setArea] = useState("");
  const [credentials, setCredentials] = useState("");
  const [treatments, setTreatments] = useState("");
  const [replyWord, setReplyWord] = useState("");
  const [mixType, setMixType] = useState<MixType>("half");
  const [shirt, setShirt] = useState("white");
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [posts, setPosts] = useState<PostDraft[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [link, setLink] = useState("");
  const [saved, setSaved] = useState<SavedSample[]>([]);
  const logoRef = useRef<{ logo: HTMLCanvasElement; palette: Palette } | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const loadSaved = () => {
    fetch(`${API}/free-samples`)
      .then((r) => (r.ok ? r.json() : { samples: [] }))
      .then((d: { samples?: SavedSample[] }) => setSaved(d.samples ?? []))
      .catch(() => {});
  };
  useEffect(loadSaved, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.thecybersuite.com";

  const create = async () => {
    if (!clinicName.trim() || !area.trim()) {
      toast.error("Add the clinic name and the area first");
      return;
    }
    if (!photoFile || !logoFile) {
      toast.error("Add the photo and the logo first");
      return;
    }
    setBusy(true);
    setPosts([]);
    setLink("");
    try {
      setStatus("Reading the logo...");
      const prepared = await prepareLogo(logoFile);
      logoRef.current = prepared;
      await Promise.all([
        document.fonts.load(`400 80px ${SERIF}`),
        document.fonts.load(`600 40px ${SANS}`),
        document.fonts.load(`500 40px ${SANS}`),
      ]).catch(() => {});

      setStatus("Uploading the photo...");
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("clientName", clinicName.trim());
      const up = await fetch(`${API}/ai-portrait/source`, { method: "POST", body: fd });
      const source = (await up.json()) as { id?: number; error?: string };
      if (!up.ok || !source.id) throw new Error(source.error || "Photo upload failed");

      setStatus("Writing the 8 captions while the photos are made...");
      const captionsPromise = fetch(`${API}/free-samples/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          clinicianName,
          area,
          credentials: `${credentials}${credentials.trim() ? ". " : ""}Current month: ${month}.`,
          treatments,
          replyWord,
        }),
      }).then(async (r) => {
        const d = (await r.json()) as { posts?: { n: number; week: number; day: string; headline: string; subtitle: string; caption: string; tags: string }[]; error?: string };
        if (!r.ok || !d.posts) throw new Error(d.error || "Caption writing failed");
        return d.posts;
      });
      captionsPromise.catch(() => {});

      const plan = mixType === "half" ? PLAN_HALF : PLAN_STANDARD;
      const ids = Array.from(new Set(plan.map((p) => p.id)));
      const scenarioFor = (id: string) => {
        const p = plan.find((x) => x.id === id)!;
        const promptVars: Record<string, string> = {};
        if (p.mixStyle) {
          promptVars.month = month;
          promptVars.mixStyle = p.mixStyle;
        }
        if (SHIRT_IDS.includes(id) && shirt.trim()) promptVars.outfit = shirt.trim();
        return { id, aspectRatio: "3:4", ...(Object.keys(promptVars).length ? { promptVars } : {}) };
      };

      const results = new Map<string, string>();
      let pending = ids;
      for (let round = 0; round < 3 && pending.length > 0; round++) {
        setStatus(round === 0 ? "Making the 8 photos in the Portrait Studio. This takes a few minutes..." : "Redoing the photos that did not come out...");
        const gen = await fetch(`${API}/ai-portrait/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourcePhotoId: source.id, clientName: clinicName.trim(), scenarios: pending.map(scenarioFor) }),
        });
        const job = (await gen.json()) as { jobId?: string; error?: string };
        if (!gen.ok || !job.jobId) throw new Error(job.error || "The Studio would not start");
        const started = Date.now();
        for (;;) {
          await sleep(3000);
          if (Date.now() - started > 12 * 60 * 1000) throw new Error("The Studio took too long, please try again");
          const st = await fetch(`${API}/ai-portrait/jobs/${job.jobId}/status`);
          if (!st.ok) continue;
          const { cards } = (await st.json()) as { cards: Card[] };
          const done = cards.filter((c) => c.status === "success" || c.status === "failed").length;
          setStatus(`Making the photos in the Portrait Studio: ${results.size + cards.filter((c) => c.status === "success").length} of ${ids.length} ready...`);
          if (done >= cards.length) {
            for (const c of cards) if (c.status === "success" && c.outputImageUrl) results.set(c.scenarioId, c.outputImageUrl);
            break;
          }
        }
        pending = ids.filter((id) => !results.has(id));
      }
      if (pending.length > 0) throw new Error(`${pending.length} photo${pending.length > 1 ? "s" : ""} would not generate. Please press Create again.`);

      setStatus("Designing the 8 posts...");
      const written = await captionsPromise;
      const drafts: PostDraft[] = [];
      for (let i = 0; i < 8; i++) {
        const p = plan[i];
        const w = written[i];
        const photo = await loadImage(`${API}/free-samples/source-image?url=${encodeURIComponent(results.get(p.id)!)}`);
        const base = { n: i + 1, week: i < 4 ? 1 : 2, day: w.day, look: p.look, headline: w.headline, subtitle: w.subtitle, caption: w.caption, tags: w.tags, zoom: !!p.zoom, photo };
        drafts.push({ ...base, preview: renderPost(base, prepared.logo, prepared.palette, area.split(",")[0].trim()) });
      }
      setPosts(drafts);
      setStatus("Done. Have a look, edit anything you like, then publish.");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const update = (n: number, patch: Partial<PostDraft>) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.n !== n) return p;
        const next = { ...p, ...patch };
        if (("headline" in patch || "subtitle" in patch) && logoRef.current) {
          next.preview = renderPost(next, logoRef.current.logo, logoRef.current.palette, area.split(",")[0].trim());
        }
        return next;
      }),
    );
  };

  const publish = async () => {
    if (!logoRef.current || !logoFile || posts.length !== 8) return;
    setPublishing(true);
    try {
      const upload = async (blob: Blob, name: string) => {
        const fd = new FormData();
        fd.append("image", blob, name);
        const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
        const d = (await r.json()) as { url?: string; error?: string };
        if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
        return d.url;
      };
      const logoUrl = await upload(logoFile, logoFile.name || "logo.png");
      const out: { n: number; week: number; day: string; imageUrl: string; caption: string; tags: string }[] = [];
      for (const p of posts) {
        const imageUrl = await upload(dataUrlToBlob(p.preview), `post-${p.n}.jpg`);
        out.push({ n: p.n, week: p.week, day: p.day, imageUrl, caption: p.caption, tags: p.tags });
      }
      const word = /Comment ([A-Z]{3,})/.exec(posts.map((p) => p.caption).join("\n"))?.[1] ?? replyWord;
      const r = await fetch(`${API}/free-samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: clinicName.trim(), logoUrl, accent: logoRef.current.palette.accentHex, replyWord: word, posts: out }),
      });
      const d = (await r.json()) as { slug?: string; error?: string };
      if (!r.ok || !d.slug) throw new Error(d.error || "Publishing failed");
      const url = `${origin}/sample/${d.slug}`;
      setLink(url);
      loadSaved();
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Published. The link is copied.");
      } catch {
        toast.success("Published.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setPublishing(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy, select it by hand");
    }
  };

  const remove = async (slug: string) => {
    if (!window.confirm("Delete this sample page? The link will stop working.")) return;
    await fetch(`${API}/free-samples/${encodeURIComponent(slug)}`, { method: "DELETE" });
    loadSaved();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Gift className="w-5 h-5 text-rose-400" />
        <h1 className="font-bold text-lg">Free Sample</h1>
        <span className="text-sm text-muted-foreground">8 posts, captions and hashtags for a clinic, on a link they can use</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="rounded-2xl border border-border/30 p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <Label>Clinic name</Label>
              <input className={inputCls} value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="L's Aesthetics" />
            </label>
            <label className="block">
              <Label>Clinician first name</Label>
              <input className={inputCls} value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} placeholder="Lena" />
            </label>
            <label className="block">
              <Label>Area</Label>
              <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Milton Keynes" />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <Label>Qualifications and background (optional)</Label>
              <input className={inputCls} value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="Registered Nurse, Emergency Medicine, fully insured" />
            </label>
            <label className="block">
              <Label>Treatments, up to 3 (optional, never prescription only)</Label>
              <input className={inputCls} value={treatments} onChange={(e) => setTreatments(e.target.value)} placeholder="Leave empty for treatment neutral posts" />
            </label>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <Label>Reply word (optional)</Label>
              <input className={inputCls} value={replyWord} onChange={(e) => setReplyWord(e.target.value)} placeholder="LENA" />
            </label>
            <label className="block">
              <Label>Photo mix</Label>
              <select className={inputCls} value={mixType} onChange={(e) => setMixType(e.target.value as MixType)}>
                <option value="half">Half scrubs, half normal clothes</option>
                <option value="standard">Standard mix (2 from each of the 4 groups)</option>
              </select>
            </label>
            <label className="block">
              <Label>Shirt colour (jeans and shirt photos)</Label>
              <input className={inputCls} value={shirt} onChange={(e) => setShirt(e.target.value)} placeholder="white" />
            </label>
          </div>
          {mixType === "standard" && (
            <label className="block sm:w-1/3">
              <Label>Month for the seasonal photos</Label>
              <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <Label>Clinician photo</Label>
              <input type="file" accept="image/*" className={inputCls} onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="block">
              <Label>Logo</Label>
              <input type="file" accept="image/*" className={inputCls} onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? "Working on it..." : "Create the sample"}
            </button>
            <span className="text-sm text-muted-foreground" role="status" aria-live="polite">{status}</span>
          </div>
        </section>

        {posts.length > 0 && (
          <section ref={resultsRef} className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={publish}
                disabled={publishing}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5"
              >
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {publishing ? "Publishing..." : "Publish and get the link"}
              </button>
              {link && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm">
                  <span className="font-mono break-all">{link}</span>
                  <button type="button" onClick={() => copy(link)} className="inline-flex items-center gap-1 text-emerald-400 hover:underline">
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:underline">
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                </div>
              )}
            </div>
            {posts.map((p) => (
              <article key={p.n} className="grid md:grid-cols-[300px_1fr] gap-5 rounded-2xl border border-border/30 p-4">
                <img src={p.preview} alt={`Week ${p.week} ${p.day}`} className="w-full rounded-lg" style={{ aspectRatio: "4 / 5" }} />
                <div className="space-y-3 min-w-0">
                  <h3 className="font-semibold">Week {p.week}, {p.day}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <Label>Headline</Label>
                      <input className={inputCls} value={p.headline} onChange={(e) => update(p.n, { headline: e.target.value })} />
                    </label>
                    <label className="block">
                      <Label>Subtitle</Label>
                      <input className={inputCls} value={p.subtitle} onChange={(e) => update(p.n, { subtitle: e.target.value })} />
                    </label>
                  </div>
                  <label className="block">
                    <Label>Caption</Label>
                    <textarea className={`${inputCls} min-h-[220px]`} value={p.caption} onChange={(e) => update(p.n, { caption: e.target.value })} />
                  </label>
                  <label className="block">
                    <Label>Hashtags</Label>
                    <input className={inputCls} value={p.tags} onChange={(e) => update(p.n, { tags: e.target.value })} />
                  </label>
                </div>
              </article>
            ))}
          </section>
        )}

        {saved.length > 0 && (
          <section className="rounded-2xl border border-border/30 p-5 space-y-3">
            <h2 className="font-semibold">Samples already made</h2>
            <ul className="space-y-2">
              {saved.map((s) => (
                <li key={s.slug} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{s.clinicName}</span>
                  <span className="font-mono text-muted-foreground break-all">{origin}/sample/{s.slug}</span>
                  <button type="button" onClick={() => copy(`${origin}/sample/${s.slug}`)} className="inline-flex items-center gap-1 text-rose-400 hover:underline">
                    <Copy className="w-4 h-4" /> Copy link
                  </button>
                  <a href={`/sample/${s.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-400 hover:underline">
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                  <button type="button" onClick={() => remove(s.slug)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
