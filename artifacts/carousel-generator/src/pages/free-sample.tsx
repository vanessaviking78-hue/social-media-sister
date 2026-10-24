import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Gift, Loader2, Copy, ExternalLink, Trash2, Sparkles, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { usePresets } from "@/lib/use-presets";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const W = 1080;
const H = 1350;

type MixType = "half" | "standard";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

type DraftRow = { id: string; status: string; source: string; clinicName: string; handle: string; slug: string; error: string; createdAt: string };
type DraftFull = {
  id: string; status: string; source: string; clinicName: string; handle: string; area: string; logoUrl: string; slug: string; error: string;
  data: { photos?: { url: string; source: string }[]; posts?: Omit<PostDraft, "photo" | "preview">[] } | null;
};
type SavedSample = { slug: string; clinicName: string; createdAt: string };


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

const FALLBACK_PALETTE: Palette = {
  band: rgb(mix([150, 120, 105], [255, 255, 255], 0.84)),
  rule: rgb(mix([150, 120, 105], [0, 0, 0], 0.18)),
  ink: rgb(mix([150, 120, 105], [0, 0, 0], 0.84)),
  sub: rgb(mix([150, 120, 105], [0, 0, 0], 0.66)),
  accentHex: hex(mix([150, 120, 105], [0, 0, 0], 0.32)),
  tile: "rgb(255,252,251)",
};

// With no logo, the clinic name stands in for it so the posts still have a corner mark.
function textLogo(name: string): { logo: HTMLCanvasElement; palette: Palette } {
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 240;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(255,252,251)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#3a2a25";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 90;
  ctx.font = `400 ${size}px ${SERIF}`;
  while (ctx.measureText(name).width > 640 && size > 28) {
    size -= 4;
    ctx.font = `400 ${size}px ${SERIF}`;
  }
  ctx.fillText(name, 360, 120);
  return { logo: c, palette: FALLBACK_PALETTE };
}

async function urlToFile(url: string, name: string): Promise<File> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the logo");
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type });
}

const inputCls = "w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">{children}</span>;
}

const STATUS_TEXT: Record<string, string> = {
  submitted: "Waiting to start",
  working: "Being made",
  ready: "Ready for you",
  failed: "Did not finish",
  published: "Link made",
  sent: "Sent to a client",
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 60 / 24)} d ago`;
}

export default function FreeSample() {
  // ----- create form -----
  const [clinicName, setClinicName] = useState("");
  const [handle, setHandle] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [area, setArea] = useState("");
  const [credentials, setCredentials] = useState("");
  const [treatments, setTreatments] = useState("");
  const [mixType, setMixType] = useState<MixType>("half");
  const [shirt, setShirt] = useState("white");
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [photoMode, setPhotoMode] = useState<"studio" | "approved">("studio");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [approvedFiles, setApprovedFiles] = useState<File[]>([]);
  const [approvedClient, setApprovedClient] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ----- lists -----
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [saved, setSaved] = useState<SavedSample[]>([]);

  // ----- review -----
  const [openId, setOpenId] = useState<string>(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("draft") ?? "" : ""));
  const [review, setReview] = useState<DraftFull | null>(null);
  const [posts, setPosts] = useState<PostDraft[]>([]);
  const [reviewStatus, setReviewStatus] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [link, setLink] = useState("");
  const [bankPreset, setBankPreset] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const logoRef = useRef<{ logo: HTMLCanvasElement; palette: Palette } | null>(null);
  const { presets } = usePresets();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.thecybersuite.com";

  const loadLists = useCallback(() => {
    fetch(`${API}/free-samples/drafts`)
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d: { drafts?: DraftRow[] }) => setDrafts(d.drafts ?? []))
      .catch(() => {});
    fetch(`${API}/free-samples`)
      .then((r) => (r.ok ? r.json() : { samples: [] }))
      .then((d: { samples?: SavedSample[] }) => setSaved(d.samples ?? []))
      .catch(() => {});
  }, []);
  useEffect(loadLists, [loadLists]);

  // Keep the list fresh while anything is still being made.
  const anyBusy = drafts.some((d) => d.status === "submitted" || d.status === "working");
  useEffect(() => {
    if (!anyBusy) return;
    const t = setInterval(loadLists, 8000);
    return () => clearInterval(t);
  }, [anyBusy, loadLists]);

  const setUrlDraft = (id: string) => {
    const url = id ? `${window.location.pathname}?draft=${id}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  const open = (id: string) => {
    setOpenId(id);
    setUrlDraft(id);
  };
  const close = () => {
    setOpenId("");
    setReview(null);
    setPosts([]);
    setLink("");
    setUrlDraft("");
    loadLists();
  };

  // Load a draft and draw its 8 posts.
  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    setReview(null);
    setPosts([]);
    setLink("");
    setReviewStatus("Loading...");
    (async () => {
      try {
        const r = await fetch(`${API}/free-samples/drafts/${openId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("Could not find that sample");
        const d = (await r.json()) as DraftFull;
        if (cancelled) return;
        setReview(d);
        if (d.slug) setLink(`${origin}/sample/${d.slug}`);
        if (!(d.data?.posts && d.data?.photos && d.data.posts.length === 8)) {
          setReviewStatus(d.status === "failed" ? d.error || "It did not finish." : "Still being made. This page updates itself.");
          return;
        }
        setReviewStatus("Drawing the posts...");
        await Promise.all([
          document.fonts.load(`400 80px ${SERIF}`),
          document.fonts.load(`600 40px ${SANS}`),
          document.fonts.load(`500 40px ${SANS}`),
        ]).catch(() => {});
        let prepared: { logo: HTMLCanvasElement; palette: Palette };
        try {
          prepared = d.logoUrl ? await prepareLogo(await urlToFile(d.logoUrl, "logo.png")) : textLogo(d.clinicName);
        } catch {
          prepared = textLogo(d.clinicName);
        }
        logoRef.current = prepared;
        const masthead = d.area.split(",")[0].trim();
        const out: PostDraft[] = [];
        for (let i = 0; i < 8; i++) {
          const p = d.data.posts[i];
          const photo = await loadImage(`${API}/free-samples/source-image?url=${encodeURIComponent(d.data.photos[i].url)}`);
          const base = { ...p, photo };
          out.push({ ...base, preview: renderPost(base, prepared.logo, prepared.palette, masthead) });
        }
        if (cancelled) return;
        setPosts(out);
        setReviewStatus("");
      } catch (e: unknown) {
        if (!cancelled) setReviewStatus(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, loadKey]);

  const create = async () => {
    if (!clinicName.trim() || !area.trim()) {
      toast.error("Add the clinic name and the area first");
      return;
    }
    if (photoMode === "studio" && !photoFile) {
      toast.error("Add the clinician photo first");
      return;
    }
    if (photoMode === "approved" && approvedFiles.length === 0) {
      toast.error("Choose at least one approved photo");
      return;
    }
    if (photoMode === "approved" && approvedFiles.length < 8 && !photoFile) {
      toast.error("You chose fewer than 8 approved photos. Add the clinician photo and the Studio will make the rest.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (photoFile) fd.append("photo", photoFile);
      if (logoFile) fd.append("logo", logoFile);
      if (photoMode === "approved") approvedFiles.slice(0, 8).forEach((f, i) => fd.append(`a${i}`, f));
      fd.append(
        "meta",
        JSON.stringify({ clinicName: clinicName.trim(), handle: handle.trim(), clinicianName, area: area.trim(), credentials, treatments, mixType, shirt, month }),
      );
      const r = await fetch(`${API}/free-samples/requests`, { method: "POST", body: fd });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!r.ok || !d.id) throw new Error(d.error || "Could not start the sample");
      toast.success("Started. I will email you when it is ready, it takes a few minutes.");
      setClinicName("");
      setHandle("");
      setClinicianName("");
      setArea("");
      setCredentials("");
      setTreatments("");
      setPhotoFile(null);
      setLogoFile(null);
      setApprovedFiles([]);
      loadLists();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (n: number, patch: Partial<PostDraft>) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.n !== n) return p;
        const next = { ...p, ...patch };
        if (("headline" in patch || "subtitle" in patch) && logoRef.current && review) {
          next.preview = renderPost(next, logoRef.current.logo, logoRef.current.palette, review.area.split(",")[0].trim());
        }
        return next;
      }),
    );
  };

  const saveEdits = async (silent = false) => {
    if (!review) return;
    const r = await fetch(`${API}/free-samples/drafts/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: posts.map((p) => ({ n: p.n, headline: p.headline, subtitle: p.subtitle, caption: p.caption, tags: p.tags })) }),
    });
    if (!r.ok) throw new Error("Could not save your changes");
    if (!silent) toast.success("Saved");
  };

  const uploadBlob = async (blob: Blob, name: string) => {
    const fd = new FormData();
    fd.append("image", blob, name);
    const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
    const d = (await r.json()) as { url?: string; error?: string };
    if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
    return d.url;
  };

  const uploadPosts = async () => {
    const urls: string[] = [];
    for (const p of posts) urls.push(await uploadBlob(dataUrlToBlob(p.preview), `post-${p.n}.jpg`));
    return urls;
  };

  const publish = async () => {
    if (!review || posts.length !== 8 || !logoRef.current) return;
    setBusyAction("publish");
    try {
      await saveEdits(true);
      const urls = await uploadPosts();
      const out = posts.map((p, i) => ({ n: p.n, week: p.week, day: p.day, imageUrl: urls[i], caption: p.caption, tags: p.tags }));
      const r = await fetch(`${API}/free-samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: review.clinicName, logoUrl: review.logoUrl, accent: logoRef.current.palette.accentHex, draftId: review.id, posts: out }),
      });
      const d = (await r.json()) as { slug?: string; error?: string };
      if (!r.ok || !d.slug) throw new Error(d.error || "Publishing failed");
      const url = `${origin}/sample/${d.slug}`;
      setLink(url);
      loadLists();
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Published. The link is copied.");
      } catch {
        toast.success("Published.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setBusyAction("");
    }
  };

  const sendToBank = async () => {
    if (!review || posts.length !== 8) return;
    if (!bankPreset) {
      toast.error("Choose a client first");
      return;
    }
    setBusyAction("bank");
    try {
      await saveEdits(true);
      const urls = await uploadPosts();
      const r = await fetch(`${API}/free-samples/send-to-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: Number(bankPreset),
          draftId: review.id,
          posts: posts.map((p, i) => ({ n: p.n, headline: p.headline, imageUrl: urls[i], caption: p.caption, tags: p.tags })),
        }),
      });
      const d = (await r.json()) as { clientName?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "Could not send to the Client Bank");
      toast.success(`8 posts are in ${d.clientName ?? "the client"}'s Client Bank as drafts, with no dates.`);
      loadLists();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not send to the Client Bank");
    } finally {
      setBusyAction("");
    }
  };

  const retry = async (id: string) => {
    await fetch(`${API}/free-samples/drafts/${id}/retry`, { method: "POST" });
    toast.success("Trying again");
    loadLists();
    if (openId === id) {
      setReview((r) => (r ? { ...r, status: "submitted", error: "" } : r));
      setReviewStatus("Still being made. This page updates itself.");
    }
  };

  const removeDraft = async (id: string) => {
    if (!window.confirm("Delete this sample?")) return;
    await fetch(`${API}/free-samples/drafts/${id}`, { method: "DELETE" });
    if (openId === id) close();
    else loadLists();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy, select it by hand");
    }
  };

  const removeSample = async (slug: string) => {
    if (!window.confirm("Delete this sample page? The link will stop working.")) return;
    await fetch(`${API}/free-samples/${encodeURIComponent(slug)}`, { method: "DELETE" });
    loadLists();
  };

  // Poll the open draft until it is built.
  useEffect(() => {
    if (!openId || !review || !(review.status === "submitted" || review.status === "working")) return;
    const t = setInterval(async () => {
      const r = await fetch(`${API}/free-samples/drafts/${openId}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const d = (await r.json()) as DraftFull;
      if (d.status !== review.status) {
        setReview(d);
        setLoadKey((k) => k + 1);
      }
    }, 6000);
    return () => clearInterval(t);
  }, [openId, review]);

  const publicIntake = `${origin}/getmysample`;

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Gift className="w-5 h-5 text-rose-400" />
        <h1 className="font-bold text-lg">Free Sample</h1>
        <span className="text-sm text-muted-foreground">8 posts, captions and hashtags for a clinic</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {openId ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={close} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Back to all samples
              </button>
              {review && <h2 className="font-semibold text-lg">{review.clinicName}{review.handle ? ` (@${review.handle})` : ""}</h2>}
              {review && <span className="text-sm text-muted-foreground">{STATUS_TEXT[review.status] ?? review.status}</span>}
            </div>

            {reviewStatus && (
              <p className="text-sm text-muted-foreground flex items-center gap-2" role="status" aria-live="polite">
                {(review?.status === "working" || review?.status === "submitted" || reviewStatus === "Drawing the posts..." || reviewStatus === "Loading...") && <Loader2 className="w-4 h-4 animate-spin" />}
                {reviewStatus}
              </p>
            )}
            {review?.status === "failed" && (
              <button type="button" onClick={() => retry(review.id)} className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            )}

            {posts.length === 8 && (
              <>
                <div className="rounded-2xl border border-border/30 p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={publish}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5"
                    >
                      {busyAction === "publish" && <Loader2 className="w-4 h-4 animate-spin" />}
                      {busyAction === "publish" ? "Publishing..." : "Publish and get the link"}
                    </button>
                    <button type="button" onClick={() => saveEdits().catch((e: Error) => toast.error(e.message))} disabled={!!busyAction} className="rounded-lg border border-border/50 px-4 py-2.5 text-sm font-semibold hover:bg-muted/40 disabled:opacity-60">
                      Save my edits
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
                  <div className="flex flex-wrap items-end gap-3 border-t border-border/30 pt-4">
                    <label className="block min-w-[220px]">
                      <Label>Or send to a client's Client Bank</Label>
                      <select className={inputCls} value={bankPreset} onChange={(e) => setBankPreset(e.target.value)}>
                        <option value="">Choose a client...</option>
                        {presets.map((p) => (
                          <option key={p.id} value={String(p.id)}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={sendToBank}
                      disabled={!!busyAction}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5"
                    >
                      {busyAction === "bank" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {busyAction === "bank" ? "Sending..." : "Send to Client Bank"}
                    </button>
                    <span className="text-xs text-muted-foreground">They arrive as drafts with no dates, so you can place them yourself.</span>
                  </div>
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
              </>
            )}
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-border/30 p-5 space-y-2">
              <h2 className="font-semibold">Link to give to clinics</h2>
              <p className="text-sm text-muted-foreground">They add their clinic name, Instagram handle, town and photo. It builds in the background and I email you when it is ready to check.</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono break-all">{publicIntake}</span>
                <button type="button" onClick={() => copy(publicIntake)} className="inline-flex items-center gap-1 text-rose-400 hover:underline">
                  <Copy className="w-4 h-4" /> Copy link
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border/30 p-5 space-y-4">
              <h2 className="font-semibold">Make one yourself</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <label className="block">
                  <Label>Clinic name</Label>
                  <input className={inputCls} value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="L's Aesthetics" />
                </label>
                <label className="block">
                  <Label>Instagram handle (optional)</Label>
                  <input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="ls_aesthetics" />
                </label>
                <label className="block">
                  <Label>Area</Label>
                  <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Milton Keynes" />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <label className="block">
                  <Label>Clinician first name (optional)</Label>
                  <input className={inputCls} value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} placeholder="Lena" />
                </label>
                <label className="block">
                  <Label>Qualifications and background (optional)</Label>
                  <input className={inputCls} value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="Registered Nurse, fully insured" />
                </label>
                <label className="block">
                  <Label>Treatments, up to 3 (optional)</Label>
                  <input className={inputCls} value={treatments} onChange={(e) => setTreatments(e.target.value)} placeholder="Leave empty for treatment neutral posts" />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
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
                {mixType === "standard" && (
                  <label className="block">
                    <Label>Month for the seasonal photos</Label>
                    <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
                      {MONTHS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-border/30 p-4 space-y-3">
                <Label>Photos</Label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={photoMode === "studio"} onChange={() => setPhotoMode("studio")} /> Make new images in the Studio
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={photoMode === "approved"} onChange={() => setPhotoMode("approved")} /> Use approved photos
                  </label>
                </div>
                {photoMode === "approved" && (
                  <div className="space-y-2">
                    <label className="block sm:w-1/2">
                      <Label>Client the approved photos belong to</Label>
                      <input className={inputCls} value={approvedClient} onChange={(e) => setApprovedClient(e.target.value)} placeholder="Type the client name" />
                    </label>
                    <ApprovedImagesPicker
                      clientName={approvedClient}
                      mode="multi"
                      skipBackgroundRemoval
                      large
                      label="Choose approved photos"
                      onAddImages={(files) => setApprovedFiles((prev) => [...prev, ...files].slice(0, 8))}
                    />
                    <p className="text-xs text-muted-foreground">
                      {approvedFiles.length} of 8 chosen. They fill the first posts in order. If you choose fewer than 8, the Studio makes the rest from the clinician photo below.
                      {approvedFiles.length > 0 && (
                        <button type="button" onClick={() => setApprovedFiles([])} className="ml-2 text-rose-400 hover:underline">Clear</button>
                      )}
                    </p>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <Label>{photoMode === "studio" ? "Clinician photo" : "Clinician photo (only needed if fewer than 8 approved)"}</Label>
                    <input type="file" accept="image/*" className={inputCls} onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <label className="block">
                    <Label>Logo (optional)</Label>
                    <input type="file" accept="image/*" className={inputCls} onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={create}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {submitting ? "Starting..." : "Create the sample"}
              </button>
            </section>

            <section className="rounded-2xl border border-border/30 p-5 space-y-3">
              <h2 className="font-semibold">Your samples</h2>
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet. Samples you start, and requests from the link, show up here.</p>
              ) : (
                <ul className="space-y-2">
                  {drafts.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-medium">{d.clinicName}</span>
                      {d.handle && <span className="text-muted-foreground">@{d.handle}</span>}
                      <span className="rounded-full border border-border/40 px-2 py-0.5 text-xs">{d.source === "intake" ? "From the link" : "Made by me"}</span>
                      <span className={d.status === "ready" ? "text-emerald-400 font-semibold" : d.status === "failed" ? "text-red-400" : "text-muted-foreground"}>
                        {STATUS_TEXT[d.status] ?? d.status}
                      </span>
                      <span className="text-muted-foreground">{timeAgo(d.createdAt)}</span>
                      {(d.status === "working" || d.status === "submitted") && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      <button type="button" onClick={() => open(d.id)} className="text-rose-400 hover:underline">Open</button>
                      {d.status === "failed" && (
                        <button type="button" onClick={() => retry(d.id)} className="inline-flex items-center gap-1 text-rose-400 hover:underline">
                          <RefreshCw className="w-4 h-4" /> Try again
                        </button>
                      )}
                      <button type="button" onClick={() => removeDraft(d.id)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {saved.length > 0 && (
              <section className="rounded-2xl border border-border/30 p-5 space-y-3">
                <h2 className="font-semibold">Links already made</h2>
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
                      <button type="button" onClick={() => removeSample(s.slug)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
