import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, Code2, Copy, Download, FileText, History, ImagePlus, Loader2, Mail, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import { buildNewsletterPdf, HERO_RATIO, parseHex, readableAccent, type NewsletterBrand, type NewsletterContent, type NewsletterSection } from "@/lib/newsletter-pdf";
import { circlePhoto, DEFAULT_THANKS, renderSignature } from "@/lib/newsletter-closing";
import { buildNewsletterHtml } from "@/lib/newsletter-html";
import { applySwap, isBlocking, scanOffer, scanText, type ComplianceFlag } from "@/lib/newsletter-compliance";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
}

const SLOT_META = [
  { slot: "lead", label: "The Lead Story", hint: "The main read, e.g. October skin prep" },
  { slot: "ask", label: "Ask the Clinician", hint: "A question patients ask, e.g. how long does filler last" },
  { slot: "myth", label: "Myth vs Truth", hint: "A myth to bust, e.g. lip filler always looks obvious" },
  { slot: "bts", label: "Behind the Scenes", hint: "Team news, new kit, the kettle drama" },
  { slot: "sell", label: "Something for You", hint: "The seasonal nudge, e.g. party season skin" },
];

function monthOptions() {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 4; i++) {
    out.push(d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

// Logo URLs are stored absolute (sometimes with the API host), so pull just
// the path and fetch it same-origin, then flatten to PNG for the PDF.
async function loadLogoAsPng(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    let src = url;
    try {
      const u = new URL(url, window.location.href);
      if (u.pathname.includes("/api/")) src = `${BASE}${u.pathname.slice(u.pathname.indexOf("/api/"))}`;
    } catch { /* keep as is */ }
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

function cropHero(img: HTMLImageElement, posY: number): string {
  const W = 1600, H = Math.round(1600 / HERO_RATIO);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (srcRatio > HERO_RATIO) {
    sw = img.naturalHeight * HERO_RATIO;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / HERO_RATIO;
    sy = (img.naturalHeight - sh) * (posY / 100);
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return c.toDataURL("image/jpeg", 0.86);
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// iPhone photos are HEIC, which Chrome can't open, and Macs sometimes hand
// them over with no file type at all. Convert those to JPEG in the browser
// (heic2any, loaded from jsDelivr on first use), and fall back to
// createImageBitmap for anything else <img> struggles with.
const HEIC2ANY_SRC = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
const isHeic = (f: File) => /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const looksLikeImage = (f: File) => f.type.startsWith("image/") || isHeic(f) || /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i.test(f.name);

async function loadHeic2any(): Promise<any> {
  const w = window as any;
  if (w.heic2any) return w.heic2any;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HEIC2ANY_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the iPhone photo converter"));
    document.head.appendChild(s);
  });
  return w.heic2any;
}

function imgFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable"));
    img.src = url;
  });
}

async function readImageFile(file: File): Promise<HTMLImageElement> {
  let blob: Blob = file;
  if (isHeic(file)) {
    const heic2any = await loadHeic2any();
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    blob = Array.isArray(out) ? out[0] : out;
  }
  try {
    return await imgFromUrl(URL.createObjectURL(blob));
  } catch {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    return await imgFromUrl(c.toDataURL("image/jpeg", 0.92));
  }
}

async function readImageWithToast(file: File): Promise<HTMLImageElement | null> {
  if (!looksLikeImage(file)) { toast.error("That doesn't look like a photo. JPG, PNG or iPhone (HEIC) photos all work."); return null; }
  const slow = isHeic(file);
  const id = slow ? toast.loading("Converting your iPhone photo…") : undefined;
  try {
    const img = await readImageFile(file);
    if (id !== undefined) toast.dismiss(id);
    return img;
  } catch {
    if (id !== undefined) toast.dismiss(id);
    toast.error("Couldn't read that photo. Try saving it as a JPG and uploading again.");
    return null;
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Issue = { id: number; month_label: string; topics: string[]; content: NewsletterContent; created_at: string };

function AutoText({ value, onChange, className, rows = 2, placeholder }: { value: string; onChange: (v: string) => void; className?: string; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-pink-500/60 rounded-md px-2 py-1 -mx-2 ${className ?? ""}`}
    />
  );
}

export default function NewsletterMaker() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<number | "">("");
  const months = useMemo(monthOptions, []);
  const [monthLabel, setMonthLabel] = useState(months[1]);
  const [topics, setTopics] = useState<string[]>(["", "", "", "", ""]);
  const [offer, setOffer] = useState("");
  const [linkOverride, setLinkOverride] = useState("");

  const [heroImg, setHeroImg] = useState<HTMLImageElement | null>(null);
  const [heroPos, setHeroPos] = useState(50);
  const [heroHostedUrl, setHeroHostedUrl] = useState<string | null>(null);
  const heroInput = useRef<HTMLInputElement>(null);

  // Closing card: clinician photo (uploaded each issue), thank-you line and
  // the name that gets written in Caveat.
  const [clinicianImg, setClinicianImg] = useState<HTMLImageElement | null>(null);
  const [thanksLine, setThanksLine] = useState(DEFAULT_THANKS);
  const [signName, setSignName] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [hostedClosing, setHostedClosing] = useState<{ photo: string | null; sig: string | null; key: string } | null>(null);
  const clinicianInput = useRef<HTMLInputElement>(null);

  const [logoPng, setLogoPng] = useState<string | null>(null);
  const [content, setContent] = useState<NewsletterContent | null>(null);
  const [issueId, setIssueId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regenSlot, setRegenSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [subjectIdx, setSubjectIdx] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [history, setHistory] = useState<Issue[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const preset = presets.find((p) => p.id === presetId);
  const bookingUrl = (linkOverride.trim() || preset?.bookingLink || "").trim();
  const heroDataUrl = useMemo(() => (heroImg ? cropHero(heroImg, heroPos) : null), [heroImg, heroPos]);
  const clinicianPhoto = useMemo(() => (clinicianImg ? circlePhoto(clinicianImg) : null), [clinicianImg]);
  const inkHex = useMemo(() => {
    const [r, g, b] = readableAccent(parseHex(preset?.accentColor));
    return `rgb(${r}, ${g}, ${b})`;
  }, [preset?.accentColor]);

  // Redraw the handwritten name whenever it changes
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      renderSignature(signName, inkHex).then((u) => { if (live) setSignatureUrl(u); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [signName, inkHex]);

  // Remember the last name each clinic signed off with
  useEffect(() => {
    const last = history.find((h) => h.content?.closingName)?.content;
    if (last?.closingName && !signName) setSignName(last.closingName);
    if (last?.closingThanks && thanksLine === DEFAULT_THANKS) setThanksLine(last.closingThanks);
  }, [history]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clinic change: logo + past issues
  useEffect(() => {
    setLogoPng(null);
    setHistory([]);
    setSignName("");
    setThanksLine(DEFAULT_THANKS);
    setClinicianImg(null);
    if (!preset) return;
    loadLogoAsPng(preset.logoUrl).then(setLogoPng);
    fetch(`${BASE}/api/newsletter/history/${preset.id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setHistory(d.issues ?? []))
      .catch(() => {});
  }, [preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const brand: NewsletterBrand | null = preset
    ? {
        clinicName: preset.name,
        newsletterName: preset.newsletterName?.trim() || "Catch Up from the Clinic",
        monthLabel,
        accent: preset.accentColor,
        logoDataUrl: logoPng,
        heroDataUrl,
        bookingUrl,
        address: preset.clinicAddress?.trim() || "",
        closing: { thanks: thanksLine.trim(), photoDataUrl: clinicianPhoto, signatureDataUrl: signatureUrl },
      }
    : null;

  // Live PDF preview, rebuilt shortly after any change
  useEffect(() => {
    if (!content || !brand) { setPdfUrl(null); return; }
    const t = setTimeout(async () => {
      setBuilding(true);
      try {
        const doc = await buildNewsletterPdf(content, brand);
        const url = URL.createObjectURL(doc.output("blob"));
        setPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      } catch (e) {
        console.error(e);
      } finally {
        setBuilding(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [content, brand?.clinicName, brand?.newsletterName, brand?.monthLabel, brand?.accent, logoPng, heroDataUrl, bookingUrl, brand?.address, thanksLine, clinicianPhoto, signatureUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave edits
  useEffect(() => {
    if (!content || !issueId) return;
    const t = setTimeout(() => {
      fetch(`${BASE}/api/newsletter/${issueId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ content: { ...content, closingThanks: thanksLine, closingName: signName }, monthLabel }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [content, issueId, monthLabel, thanksLine, signName]);

  const flags: ComplianceFlag[] = useMemo(() => {
    const out: ComplianceFlag[] = [...scanOffer(offer)];
    if (!content) return out;
    out.push(...scanText(content.intro, "Intro", "intro"));
    content.sections.forEach((s, i) => {
      out.push(...scanText(s.heading, `${s.label} heading`, `s${i}.heading`));
      out.push(...scanText(s.body, s.label, `s${i}.body`));
    });
    out.push(...scanText(content.ctaText, "Button", "ctaText"));
    out.push(...scanText(content.signOff, "P.S.", "signOff"));
    out.push(...scanText(thanksLine, "Thank-you line", "thanks"));
    content.subjectLines.forEach((t, i) => out.push(...scanText(t, `Subject line ${i + 1}`, `subj${i}`)));
    content.previewTexts.forEach((t, i) => out.push(...scanText(t, `Preview text ${i + 1}`, `prev${i}`)));
    return out;
  }, [content, offer]);
  const blocking = flags.filter(isBlocking).length;

  function getField(c: NewsletterContent, field: string): string {
    if (field === "intro" || field === "ctaText" || field === "signOff") return c[field];
    if (field.startsWith("subj")) return c.subjectLines[+field.slice(4)] ?? "";
    if (field.startsWith("prev")) return c.previewTexts[+field.slice(4)] ?? "";
    const [si, key] = field.slice(1).split(".");
    return (c.sections[+si] as any)[key];
  }
  function setField(c: NewsletterContent, field: string, v: string): NewsletterContent {
    if (field === "intro" || field === "ctaText" || field === "signOff") return { ...c, [field]: v };
    if (field.startsWith("subj")) { const a = [...c.subjectLines]; a[+field.slice(4)] = v; return { ...c, subjectLines: a }; }
    if (field.startsWith("prev")) { const a = [...c.previewTexts]; a[+field.slice(4)] = v; return { ...c, previewTexts: a }; }
    const [si, key] = field.slice(1).split(".");
    const sections = c.sections.map((s, i) => (i === +si ? { ...s, [key]: v } : s));
    return { ...c, sections };
  }
  function fixFlag(f: ComplianceFlag) {
    if (!f.swap) return;
    if (f.field === "offer") return;
    if (f.field === "thanks") { setThanksLine((t) => applySwap(t, f.matched, f.swap!)); return; }
    setContent((c) => (c ? setField(c, f.field, applySwap(getField(c, f.field), f.matched, f.swap!)) : c));
  }
  function fixAll() {
    setContent((c) => {
      if (!c) return c;
      let next = c;
      flags.filter((f) => f.swap && f.field !== "offer" && f.field !== "thanks").forEach((f) => {
        next = setField(next, f.field, applySwap(getField(next, f.field), f.matched, f.swap!));
      });
      return next;
    });
  }
  const updateSection = (i: number, patch: Partial<NewsletterSection>) =>
    setContent((c) => (c ? { ...c, sections: c.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : c));

  const handleHero = useCallback(async (file?: File | null) => {
    if (!file) return;
    const img = await readImageWithToast(file);
    if (img) { setHeroImg(img); setHeroPos(50); setHeroHostedUrl(null); }
  }, []);

  const handleClinician = useCallback(async (file?: File | null) => {
    if (!file) return;
    const img = await readImageWithToast(file);
    if (img) setClinicianImg(img);
  }, []);

  async function generate() {
    if (!preset) { toast.error("Pick a clinic first"); return; }
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/newsletter/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ presetId: preset.id, topics, monthLabel, offer }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      setContent(d.content);
      setIssueId(d.id ?? null);
      setSubjectIdx(0);
      setPreviewIdx(0);
      setHistory((h) => [{ id: d.id, month_label: d.monthLabel, topics, content: d.content, created_at: new Date().toISOString() }, ...h]);
      toast.success(complianceMessage(d.compliance, "Newsletter written and compliance checked."));
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(i: number) {
    if (!preset || !content) return;
    const s = content.sections[i];
    setRegenSlot(s.slot);
    try {
      const r = await fetch(`${BASE}/api/newsletter/regenerate-section`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          presetId: preset.id,
          slot: s.slot,
          topic: s.topic,
          monthLabel,
          offer,
          note: notes[s.slot] || "",
          otherHeadings: content.sections.filter((_, j) => j !== i).map((x) => x.heading),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Rewrite failed");
      updateSection(i, { heading: d.heading, body: d.body });
      if (d.compliance?.rewritten || d.compliance?.autoFixed) toast.success(complianceMessage(d.compliance, "Rewritten and compliance checked."));
      if (d.ctaText) setContent((c) => (c ? { ...c, ctaText: d.ctaText } : c));
      setNotes((n) => ({ ...n, [s.slot]: "" }));
    } catch (e: any) {
      toast.error(e?.message || "Rewrite failed");
    } finally {
      setRegenSlot(null);
    }
  }

  function loadIssue(issue: Issue) {
    setContent(issue.content);
    setIssueId(issue.id);
    setMonthLabel(issue.month_label);
    setTopics(issue.content.sections?.map((s) => s.topic ?? "") ?? issue.topics);
    if (issue.content.closingName) setSignName(issue.content.closingName);
    if (issue.content.closingThanks) setThanksLine(issue.content.closingThanks);
    setShowHistory(false);
    toast.success(`Loaded ${issue.month_label}. Pop the photos back in if you need them.`);
  }

  async function deleteIssue(id: number) {
    await fetch(`${BASE}/api/newsletter/${id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
    setHistory((h) => h.filter((x) => x.id !== id));
    if (issueId === id) setIssueId(null);
  }

  function confirmDespiteFlags() {
    if (blocking === 0) return true;
    toast.error(`${blocking} compliance flag${blocking > 1 ? "s" : ""} still showing (red or amber). Sort ${blocking > 1 ? "them" : "it"} before this goes to the client.`);
    return false;
  }

  async function downloadPdf() {
    if (!content || !brand || !confirmDespiteFlags()) return;
    if (!brand.bookingUrl) toast.message("No booking link set, so the button and QR code are left off.");
    const doc = await buildNewsletterPdf(content, brand);
    doc.save(`${slug(brand.clinicName)}-newsletter-${slug(monthLabel)}.pdf`);
  }

  async function downloadHtml() {
    if (!content || !brand || !preset || !confirmDespiteFlags()) return;
    let heroUrl = heroHostedUrl;
    if (heroDataUrl && !heroUrl) {
      try {
        const r = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ images: [{ name: `newsletter-hero-${Date.now()}.jpg`, base64: heroDataUrl }] }),
        });
        const d = await r.json();
        heroUrl = d.results?.[0]?.url ?? null;
        setHeroHostedUrl(heroUrl);
      } catch {
        toast.error("Couldn't host the hero image, the email version will go without it");
      }
    }
    const host = async (dataUrl: string | null, name: string) => {
      if (!dataUrl) return null;
      try {
        const r = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ images: [{ name: `${name}-${Date.now()}.png`, base64: dataUrl }] }),
        });
        const d = await r.json();
        return (d.results?.[0]?.url as string) ?? null;
      } catch {
        return null;
      }
    };
    const key = `${clinicianPhoto?.length ?? 0}|${signatureUrl?.length ?? 0}|${signName}`;
    let hosted = hostedClosing;
    if (!hosted || hosted.key !== key) {
      hosted = { photo: await host(clinicianPhoto, "newsletter-clinician"), sig: await host(signatureUrl, "newsletter-signature"), key };
      setHostedClosing(hosted);
    }
    const html = buildNewsletterHtml(
      content,
      {
        ...brand,
        logoUrl: preset.logoUrl,
        heroUrl,
        closing: { thanks: thanksLine.trim(), name: signName.trim(), photoUrl: hosted.photo, signatureUrl: hosted.sig },
      },
      content.subjectLines[subjectIdx] ?? "",
      content.previewTexts[previewIdx] ?? "",
    );
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    download(url, `${slug(brand.clinicName)}-newsletter-${slug(monthLabel)}-email.html`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  function complianceMessage(c: { rewritten?: number; autoFixed?: number; remaining?: unknown[] } | undefined, base: string) {
    if (!c) return base;
    const fixed = (c.rewritten ?? 0) + (c.autoFixed ?? 0);
    const left = c.remaining?.length ?? 0;
    return `${base}${fixed ? ` ${fixed} line${fixed > 1 ? "s" : ""} reworded to keep it compliant.` : " Nothing needed changing."}${left ? ` ${left} still need${left > 1 ? "" : "s"} your eye.` : ""}`;
  }

  const sevStyle = (s: ComplianceFlag["severity"]) =>
    s === "high" ? "border-red-500/40 bg-red-500/10 text-red-300" : s === "medium" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-zinc-700 bg-zinc-800/60 text-zinc-300";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors mt-1"><ArrowLeft size={20} /></button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Mail size={22} className="text-rose-400" /> Newsletter Maker</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Pick the clinic, give it five topics and a photo, and it writes the patient newsletter in the clinic's voice. Download the PDF for the client, plus an email version they can paste into Mailchimp.</p>
          </div>
          {preset && history.length > 0 && (
            <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
              <History size={14} /> Past issues ({history.length})
            </button>
          )}
        </div>

        {showHistory && (
          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <button onClick={() => loadIssue(h)} className="flex-1 text-left hover:text-rose-300">
                  <span className="font-semibold">{h.month_label}</span>
                  <span className="text-zinc-500"> · {(h.topics || []).filter(Boolean).join(", ") || "surprise topics"}</span>
                </button>
                <span className="text-xs text-zinc-600">{new Date(h.created_at).toLocaleDateString("en-GB")}</span>
                <button onClick={() => deleteIssue(h.id)} className="text-zinc-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* Left: inputs */}
          <div className="space-y-5">
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Clinic</label>
                <select
                  value={presetId}
                  onChange={(e) => { setPresetId(e.target.value ? Number(e.target.value) : ""); setContent(null); setIssueId(null); }}
                  className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Choose a clinic…</option>
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {preset && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <span className="w-3 h-3 rounded-full border border-zinc-700" style={{ background: preset.accentColor }} />
                    {preset.logoUrl ? "Logo ready" : "No logo on profile"} ·{" "}
                    {preset.bookingLink ? "Booking link set" : <Link href="/presets" className="text-amber-300 underline">No booking link yet, add it</Link>}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Issue</label>
                <select value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm">
                  {[...new Set([monthLabel, ...months])].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <label className="text-xs uppercase tracking-widest text-zinc-500">Hero image</label>
              {!heroImg ? (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleHero(e.dataTransfer.files?.[0]); }}
                  className="block border-2 border-dashed border-zinc-800 hover:border-rose-500/60 rounded-xl p-6 text-center cursor-pointer"
                >
                  <input ref={heroInput} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { handleHero(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                  <ImagePlus className="mx-auto mb-2 text-zinc-600" size={26} />
                  <p className="text-sm">Drop this month's photo here</p>
                  <p className="text-xs text-zinc-500 mt-1">Landscape works best. No before and afters, no vials or syringes.</p>
                </label>
              ) : (
                <div className="space-y-2">
                  <img src={heroDataUrl!} alt="Hero" className="w-full rounded-lg border border-zinc-800" />
                  {heroImg.naturalWidth / heroImg.naturalHeight < HERO_RATIO && (
                    <div>
                      <p className="text-xs text-zinc-500">Slide to choose which part of the photo shows</p>
                      <input type="range" min={0} max={100} value={heroPos} onChange={(e) => setHeroPos(+e.target.value)} className="w-full accent-rose-500" />
                    </div>
                  )}
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => heroInput.current?.click()} className="text-rose-300 hover:text-rose-200 flex items-center gap-1"><Upload size={12} /> Replace</button>
                    <button onClick={() => { setHeroImg(null); setHeroHostedUrl(null); }} className="text-zinc-400 hover:text-white flex items-center gap-1"><X size={12} /> Remove</button>
                    <input ref={heroInput} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { handleHero(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                  </div>
                </div>
              )}
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-zinc-500">Five things to talk about</label>
                <span className="text-[11px] text-zinc-600">Leave any blank and it'll pick a seasonal one</span>
              </div>
              {SLOT_META.map((m, i) => (
                <div key={m.slot}>
                  <p className="text-xs text-zinc-300 mb-1"><span className="text-rose-400 font-semibold">{i + 1}.</span> {m.label}</p>
                  <input
                    value={topics[i]}
                    onChange={(e) => setTopics((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={m.hint}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600"
                  />
                </div>
              ))}
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Offer (optional)</label>
                <textarea
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  rows={2}
                  placeholder="e.g. Complimentary skin consultation with any facial booked in November"
                  className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600 resize-none"
                />
                <p className="text-[11px] text-zinc-600 mt-1">Woven quietly into section 5. Never on a prescription-only treatment.</p>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Link for this issue (optional)</label>
                <input
                  value={linkOverride}
                  onChange={(e) => setLinkOverride(e.target.value)}
                  placeholder={preset?.bookingLink || "Overrides the booking link just for this one"}
                  className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600"
                />
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <label className="text-xs uppercase tracking-widest text-zinc-500">Closing card</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => clinicianInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleClinician(e.dataTransfer.files?.[0]); }}
                  className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-700 hover:border-rose-500/60 overflow-hidden shrink-0 flex items-center justify-center"
                  title="Upload the clinician's photo"
                >
                  {clinicianPhoto ? <img src={clinicianPhoto} alt="Clinician" className="w-full h-full object-cover" /> : <ImagePlus size={20} className="text-zinc-600" />}
                </button>
                <input ref={clinicianInput} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { handleClinician(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="Signs off as, e.g. Mary"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600"
                  />
                  {signatureUrl && (
                    <div className="bg-white rounded-lg px-3 py-1 flex items-center gap-2">
                      <span className="text-[11px] italic text-zinc-500">With love,</span>
                      <img src={signatureUrl} alt="Signature preview" className="h-8 w-auto" />
                    </div>
                  )}
                </div>
              </div>
              {clinicianImg && (
                <button onClick={() => setClinicianImg(null)} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><X size={12} /> Remove photo</button>
              )}
              <input
                value={thanksLine}
                onChange={(e) => setThanksLine(e.target.value)}
                placeholder={DEFAULT_THANKS}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600"
              />
              <p className="text-[11px] text-zinc-600">Upload the clinician's photo each issue. The name is written in Caveat handwriting, and the AI's closing line becomes a P.S. underneath.</p>
            </section>

            <button
              onClick={generate}
              disabled={!preset || generating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 font-semibold"
            >
              {generating ? <><Loader2 size={16} className="animate-spin" /> Writing it…</> : <><Sparkles size={16} /> {content ? "Write a fresh version" : "Write the newsletter"}</>}
            </button>
          </div>

          {/* Right: editor + preview */}
          <div className="space-y-5 min-w-0">
            {!content ? (
              <div className="h-full min-h-[400px] border border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-center p-10">
                <div>
                  <FileText className="mx-auto text-zinc-700 mb-3" size={36} />
                  <p className="text-zinc-400">Your newsletter lands here.</p>
                  <p className="text-zinc-600 text-sm mt-1">Every section is editable, and you can rewrite any one without redoing the lot.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Compliance */}
                <section className={`rounded-xl border p-4 ${blocking ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {blocking ? <AlertTriangle size={16} className="text-red-400" /> : <ShieldCheck size={16} className="text-emerald-400" />}
                      {flags.length === 0 ? "Compliance check: all clear" : `${flags.length} thing${flags.length > 1 ? "s" : ""} to look at${blocking ? `, ${blocking} must be fixed` : ""}`}
                    </p>
                    {flags.some((f) => f.swap && f.field !== "offer") && (
                      <button onClick={fixAll} className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-1.5">Apply all swaps</button>
                    )}
                  </div>
                  {flags.length > 0 && (
                    <div className="mt-3 space-y-1.5 max-h-56 overflow-auto pr-1">
                      {flags.map((f) => (
                        <div key={f.id} className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-2 ${sevStyle(f.severity)}`}>
                          <span className="font-semibold shrink-0">{f.where}</span>
                          <span className="shrink-0">"{f.matched}"</span>
                          <span className="text-zinc-400 flex-1 min-w-0 truncate">{f.reason}</span>
                          {f.swap && f.field !== "offer" && (
                            <button onClick={() => fixFlag(f)} className="shrink-0 underline hover:no-underline">→ {f.swap.trim() || "remove"}</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Subject + preview */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid md:grid-cols-2 gap-5">
                  {[
                    { title: "Subject line", list: content.subjectLines, idx: subjectIdx, set: setSubjectIdx, key: "subj" },
                    { title: "Preview text", list: content.previewTexts, idx: previewIdx, set: setPreviewIdx, key: "prev" },
                  ].map((g) => (
                    <div key={g.key}>
                      <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{g.title}</p>
                      <div className="space-y-1.5">
                        {g.list.map((t, i) => (
                          <div key={i} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${g.idx === i ? "border-rose-500/60 bg-rose-500/5" : "border-zinc-800"}`}>
                            <button onClick={() => g.set(i)} className={`mt-1.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${g.idx === i ? "bg-rose-500 border-rose-500" : "border-zinc-600"}`}>
                              {g.idx === i && <Check size={10} />}
                            </button>
                            <AutoText value={t} rows={1} onChange={(v) => setContent((c) => (c ? setField(c, `${g.key}${i}`, v) : c))} className="text-sm" />
                            <button onClick={() => copy(t)} className="mt-1 text-zinc-500 hover:text-white shrink-0"><Copy size={13} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                {/* Editable copy */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Hello</p>
                    <AutoText value={content.intro} onChange={(v) => setContent((c) => (c ? { ...c, intro: v } : c))} className="text-[15px] italic text-zinc-200" />
                  </div>
                  {content.sections.map((s, i) => (
                    <div key={s.slot} className="border-t border-zinc-800 pt-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-widest text-rose-400 font-semibold">{i + 1}. {s.label}</span>
                        <span className="text-xs text-zinc-600 truncate flex-1">{s.topic}</span>
                      </div>
                      <AutoText value={s.heading} rows={1} onChange={(v) => updateSection(i, { heading: v })} className="text-lg font-serif font-bold text-white" />
                      <AutoText value={s.body} rows={4} onChange={(v) => updateSection(i, { body: v })} className="text-sm leading-relaxed text-zinc-300 mt-1" />
                      {s.slot === "sell" && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-zinc-500 shrink-0">Button says</span>
                          <input value={content.ctaText} onChange={(e) => setContent((c) => (c ? { ...c, ctaText: e.target.value } : c))} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm" />
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={notes[s.slot] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [s.slot]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") regenerate(i); }}
                          placeholder="Optional steer, e.g. funnier, mention the new nurse"
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs placeholder:text-zinc-600"
                        />
                        <button
                          onClick={() => regenerate(i)}
                          disabled={regenSlot !== null}
                          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          <RefreshCw size={12} className={regenSlot === s.slot ? "animate-spin" : ""} /> Rewrite
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-zinc-800 pt-5">
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">P.S. (under the closing card)</p>
                    <AutoText value={content.signOff} rows={1} onChange={(v) => setContent((c) => (c ? { ...c, signOff: v } : c))} className="text-sm italic text-zinc-300" />
                  </div>
                </section>

                {/* Downloads + preview */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={downloadPdf} title={blocking ? "Fix the compliance flags first" : undefined} className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold ${blocking ? "opacity-40" : ""}`}>
                      <Download size={15} /> Download PDF
                    </button>
                    <button onClick={downloadHtml} title={blocking ? "Fix the compliance flags first" : undefined} className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm ${blocking ? "opacity-40" : ""}`}>
                      <Code2 size={15} /> Email version (HTML)
                    </button>
                    {building && <span className="text-xs text-zinc-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Updating preview</span>}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    The PDF is for approval and for printing at reception, the button and QR code both go to{" "}
                    {bookingUrl ? <span className="text-zinc-300">{bookingUrl}</span> : <span className="text-amber-300">no booking link yet</span>}. The HTML is for the clinic's email platform, its unsubscribe link uses Mailchimp's *|UNSUB|* tag.
                  </p>
                  {pdfUrl && <iframe title="Newsletter preview" src={pdfUrl + "#toolbar=0&view=FitH"} className="w-full h-[900px] rounded-lg border border-zinc-800 bg-white" />}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
