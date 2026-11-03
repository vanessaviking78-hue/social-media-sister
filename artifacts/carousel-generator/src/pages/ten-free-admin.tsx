import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { TEN_PLAN, pickTreatments, pickFact, monthNameUK } from "@/lib/tenfree-content";
import { buildAssets, renderStory, renderUniversalPost, loadPlayfair } from "@/lib/tenfree-engine";
import { hashSeed } from "@/lib/pack-plan";
import { pickReels } from "@/lib/tenfree-reels";
import { UNIQUE } from "@/lib/unique-designs";
import { applyCopy, skeleton, type CopyResult } from "@/lib/pack-build";
import { renderPackPost, renderPackSlide, packFonts, slidesOf, type PackClient, type PackPost } from "@/lib/pack-engine";
import { DEFAULT_FOCUS, type PoolPhoto } from "@/lib/month-engine";
import { brandPalette, loadImage, textLogo } from "@/lib/sample-post";
import { makeClearLogo } from "@/lib/logo-clear";
import { loadBitmap } from "@/pages/universal";
import { canvasToPng } from "@/lib/logo-clear";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

type Req = {
  id: string; email: string; status: string; clinicName: string; clinicianName: string; handle: string; area: string; website: string; whatsapp: string;
  mainHex: string; accentHex: string; treatments: string[]; answers: { hobbies: string; mum: string; pets: string; why: string; threeWords: string; passion: string };
  logoUrl: string; photoUrl: string; notes: string; slug: string; code: string; createdAt: string; aiUrls: string[]; aiStatus: string;
};
type Poll = { question: string; a: string; b: string };

const siteLink = (slug: string) => `${window.location.origin}${BASE}/10free/${slug}`;

function List() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const r = await fetch(`${API}/ten-free/requests`, { headers: authHeaders() });
    const j = await r.json().catch(() => ({}));
    setRows(j.requests ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const patch = async (id: string, status: string) => {
    await fetch(`${API}/ten-free/requests/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this request for good?")) return;
    await fetch(`${API}/ten-free/requests/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  };
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">10 free posts: requests</h1>
      <p className="text-sm text-muted-foreground">Public form: {window.location.origin}{BASE}/10freeposts</p>
      {loading && <p>Loading...</p>}
      {!loading && rows.length === 0 && <p>No requests yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-semibold">{r.clinicName} <span className="text-xs uppercase text-pink-500">{r.status}</span></div>
            <div className="text-sm text-muted-foreground">{r.clinicianName} · {r.email} · {r.area}</div>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/10free-admin?id=${r.id}`} className="px-3 py-1 rounded bg-pink-500 text-white">{r.status === "published" ? "Open" : "Build"}</Link>
            {r.status === "new" && <button className="px-3 py-1 rounded border" onClick={() => patch(r.id, "declined")}>Decline</button>}
            {r.status === "declined" && <button className="px-3 py-1 rounded border" onClick={() => patch(r.id, "new")}>Reopen</button>}
            <button className="px-3 py-1 rounded border" onClick={() => del(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Item = {
  n: number; label: string; source: "universal" | "pack"; carousel: boolean;
  post?: PackPost; uni?: HTMLCanvasElement[]; caption: string; tags: string; previews: string[];
  poll: Poll & { instruction: string };
};

const HEAD_FONTS = [
  { id: "instrument", label: "Instrument Serif", css: "'Instrument Serif', serif" },
  { id: "playfair", label: "Playfair Display", css: "'Playfair Display', serif" },
  { id: "spartan", label: "League Spartan", css: "'League Spartan', sans-serif" },
] as const;
const BODY_CSS = "'Playfair Display', serif";

function Builder({ id }: { id: string }) {
  const [headChoice, setHeadChoice] = useState<(typeof HEAD_FONTS)[number]["id"]>("instrument");
  const [req, setReq] = useState<Req | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [hooks, setHooks] = useState<{ hook: string; script: string; onScreen: string }[]>([]);
  const [fact, setFact] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const clientRef = useRef<PackClient | null>(null);
  const assetsRef = useRef<Awaited<ReturnType<typeof buildAssets>> | null>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  // Subtitles and every page after the first use Playfair Display on all the posts. The headline font is the picker.
  useEffect(() => {
    const def = { head: packFonts.head, body: packFonts.body };
    packFonts.body = BODY_CSS;
    return () => {
      packFonts.head = def.head;
      packFonts.body = def.body;
    };
  }, []);
  useEffect(() => {
    const f = HEAD_FONTS.find((x) => x.id === headChoice)!;
    packFonts.head = f.css;
    packFonts.body = BODY_CSS;
    (async () => {
      await loadPlayfair();
      await Promise.all([400, 700, 900].map((w) => document.fonts.load(`${w} 40px ${f.css}`).catch(() => [])));
      const client = clientRef.current;
      if (!client) return;
      for (const it of itemsRef.current) {
        if (!it.post) continue;
        const cvs = await renderPackPost(it.post, client, 0.4);
        patchItem(it.n, { previews: cvs.map((c) => c.toDataURL("image/jpeg", 0.8)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headChoice]);

  const loadReq = useCallback(() => {
    fetch(`${API}/ten-free/requests/${id}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => {
      setReq(j);
      if (j.slug) { setLink(siteLink(j.slug)); setCode(j.code || ""); }
    });
  }, [id]);
  useEffect(() => { loadReq(); }, [loadReq]);
  useEffect(() => {
    if (req?.aiStatus !== "working") return;
    const t = setInterval(loadReq, 10000);
    return () => clearInterval(t);
  }, [req?.aiStatus, loadReq]);

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something failed");
    return j;
  };
  const upload = async (blob: Blob, name: string) => {
    const fd = new FormData();
    fd.append("image", blob, name);
    const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
    return d.url as string;
  };
  const jpg = (c: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not save an image"))), "image/jpeg", 0.92));
  const patchItem = (n: number, p: Partial<Item>) => {
    itemsRef.current = itemsRef.current.map((x) => (x.n === n ? { ...x, ...p } : x));
    setItems(itemsRef.current);
  };

  const build = async () => {
    if (!req) return;
    setBusy(true);
    setLink("");
    try {
      setStatus("Reading the website...");
      let siteNotes = "";
      if (req.website) siteNotes = (await post("/ten-free/site-notes", { url: req.website }).catch(() => ({ notes: "" }))).notes || "";
      const clinic = { name: req.clinicName, owner: req.clinicianName, area: req.area, treatments: req.treatments, siteNotes, month: monthNameUK() };

      setStatus("Getting the photo library...");
      const lib = (await (await fetch(`${API}/universal/images`)).json()).images as { treatmentId: string; url: string }[];
      const byT = new Map<string, string[]>();
      lib.forEach((i) => byT.set(i.treatmentId, [...(byT.get(i.treatmentId) ?? []), i.url]));
      const picks = pickTreatments(req.treatments, (tid) => (byT.get(tid)?.length ?? 0) >= 1, req.id);
      if (picks.length < 3) throw new Error("None of the treatments she ticked have photos in the Universal library");
      const distinct = new Set(picks.map((p) => p.treatment.id)).size;
      if (distinct < 3) toast.message(`Only ${distinct} of the treatments she ticked have photos in the Universal library, so some posts reuse a treatment at a different angle.`);

      setStatus("Preparing the logo, fonts and photos...");
      const logoBlob = req.logoUrl ? await fetch(req.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const photoBlob = req.photoUrl ? await fetch(req.photoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const assets = await buildAssets({ main: req.mainHex, accent: req.accentHex, clinicName: req.clinicName, handle: req.handle, whatsapp: "", logoBlob, photoBlob });
      assetsRef.current = assets;

      // The pool for the pack templates: her three Studio portraits, then the photo she sent.
      const pool: PoolPhoto[] = [];
      const sources = [...(req.aiUrls ?? []), ...(req.photoUrl ? [req.photoUrl] : [])];
      for (const [i, u] of sources.entries()) {
        try {
          const r = await fetch(`${API}/free-samples/source-image?url=${encodeURIComponent(u)}`);
          if (!r.ok) continue;
          const blob = await r.blob();
          pool.push({ id: `${req.id}-${i}`, file: new File([blob], `pool-${i}.jpg`, { type: blob.type || "image/jpeg" }), url: URL.createObjectURL(blob) });
        } catch { /* skip */ }
      }
      // A colour that shows up on both the dark blocks and the light pages of the templates (a near black accent would vanish).
      const lumOf = (h: string) => { const v = parseInt(h.slice(1), 16); const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f((v >> 16) & 255) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255); };
      const mixTo = (h: string, to: number, t: number) => { const v = parseInt(h.slice(1), 16); const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x + (to - x) * t)); return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join(""); };
      let accent = req.accentHex;
      for (let i = 0; i < 20 && lumOf(accent) < 0.16; i++) accent = mixTo(accent, 255, 0.15);
      for (let i = 0; i < 20 && lumOf(accent) > 0.5; i++) accent = mixTo(accent, 0, 0.15);
      if (Math.abs(lumOf(accent) - lumOf(req.mainHex)) < 0.1) accent = lumOf(req.mainHex) > 0.3 ? mixTo(req.mainHex, 0, 0.45) : mixTo(req.mainHex, 255, 0.55);
      const clear = logoBlob ? await makeClearLogo(logoBlob).catch(() => null) : null;
      const base = textLogo(req.clinicName);
      const logoCanvas = clear || base.logo;
      const logoImg = await loadImage(logoCanvas.toDataURL("image/png")).catch(() => null);
      const owner = req.clinicianName;
      const client: PackClient = {
        businessName: req.clinicName, ownerName: owner, role: "Aesthetic practitioner", area: req.area, audience: "women over 35", brandNotes: "", footnote: "",
        fill: { owner, clinic: req.clinicName, area: req.area.split(",")[0].trim(), role: "Aesthetic practitioner" },
        headFont: "'Instrument Serif', serif", bodyFont: "'Montserrat', sans-serif",
        brand: { main: req.mainHex, accent }, logo: logoImg, pool, handle: req.handle,
        portraitLogo: logoCanvas, portraitPalette: { ...brandPalette(req.mainHex, base.palette), tile: "rgba(0,0,0,0)" },
      };
      clientRef.current = client;

      const dm = `If you are from ${req.area.split(",")[0].trim()} and want a safe caring practitioner meet me in the DMs`;
      packFonts.body = BODY_CSS;

      // The personal posts, from the pack templates.
      const uniqueIds = UNIQUE.filter((u) => u.photo).map((u) => u.id);
      const packSlots = TEN_PLAN.filter((s) => s.source === "pack") as Extract<(typeof TEN_PLAN)[number], { source: "pack" }>[];
      const cursor = { at: 0 };
      const built = packSlots.map((s) => {
        const design = s.design === "auto" ? uniqueIds[hashSeed(req.id) % uniqueIds.length] : s.design;
        const sk = skeleton({ n: s.n, kind: s.kind, design }, cursor, pool.length);
        const facts = `About me (the only facts you may use): hobbies ${req.answers.hobbies}; mum: ${req.answers.mum}; pets: ${req.answers.pets}; why I got into aesthetics: ${req.answers.why}; three words: ${req.answers.threeWords}; passion: ${req.answers.passion}; area: ${req.area}; month: ${monthNameUK()}. ${siteNotes ? "My clinic offers things in line with: " + siteNotes.slice(0, 600) : ""}`;
        sk.spec.idea = `${s.idea}. ${facts}`;
        return { slot: s, post: sk.post, spec: sk.spec };
      });
      const results: PackPost[] = built.map((b) => b.post);
      let tagsA = "", tagsB = "";
      for (let i = 0; i < built.length; i += 4) {
        setStatus(`Writing the posts... ${Math.min(i + 4, built.length)} of ${built.length}`);
        const chunk = built.slice(i, i + 4);
        const j = await post("/post-packs/copy", { clinic: { name: req.clinicName, owner, role: "Aesthetic practitioner", area: req.area, treatments: req.treatments }, items: chunk.map((b) => ({ n: b.spec.n, kind: b.spec.kind, idea: b.spec.idea, fields: b.spec.fields, current: b.spec.current, photoSlides: b.spec.photoSlides })) });
        if (!tagsA && j.tagsA) tagsA = j.tagsA;
        if (!tagsB && j.tagsB) tagsB = j.tagsB;
        for (const r of j.items as CopyResult[]) {
          const idx = results.findIndex((p) => p.n === r.n);
          if (idx >= 0) results[idx] = applyCopy(results[idx], r, r.n % 2 === 0 ? tagsB || tagsA : tagsA || tagsB);
        }
      }
      const finalPack = results.map((p) => {
        const preset = built.find((b) => b.post.n === p.n)?.slot.preset;
        const withPreset = { ...(preset ? { ...p, text: { ...p.text, ...preset } } : p), cta: slidesOf(p) > 1 ? dm : p.cta };
        return withPreset.hashtags ? withPreset : { ...withPreset, hashtags: tagsA || tagsB };
      });

      setStatus("Writing the treatment posts...");
      const tcopy: any[] = [];
      for (const p of picks) {
        tcopy.push(await post("/universal/copy", { client: req.clinicName, area: req.area, treatment: p.treatment.name, headline: p.headline, brief: p.brief, intro: p.angle === 0, note: "" }));
      }

      setStatus("Drawing the posts...");
      const out: Item[] = [];
      let ti = 0;
      for (const slot of TEN_PLAN) {
        if (slot.source === "universal") {
          const p = picks[ti];
          const c = tcopy[ti];
          const urls = byT.get(p.treatment.id) ?? [];
          const photos = await Promise.all(urls.slice(0, 12).map((u) => loadBitmap(u).catch(() => null)));
          const canvases = renderUniversalPost({ treatmentId: p.treatment.id, headline: p.headline, copy: { subtitle: c.subtitle, slides: c.slides, cta: dm }, photos: photos.filter((x): x is ImageBitmap => !!x), offset: ti * 2, angle: p.angle }, assets);
          out.push({ n: slot.n, label: `${p.treatment.name} carousel`, source: "universal", carousel: true, uni: canvases, caption: c.caption || "", tags: (c.hashtags || []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "), previews: canvases.map((cv) => cv.toDataURL("image/jpeg", 0.6)), poll: { question: "", a: "", b: "", instruction: "" } });
          ti++;
        } else {
          const pp = finalPack.find((x) => x.n === slot.n)!;
          const cvs = await renderPackPost(pp, client, 0.4);
          out.push({ n: slot.n, label: slot.label, source: "pack", carousel: slot.carousel, post: pp, caption: pp.caption, tags: pp.hashtags, previews: cvs.map((c) => c.toDataURL("image/jpeg", 0.8)), poll: { question: "", a: "", b: "", instruction: "" } });
        }
      }

      setStatus("Picking the 10 reels and writing the story polls...");
      const extras = await post("/ten-free/extras", { clinic, answers: req.answers, posts: out.map((o) => ({ n: o.n, label: o.label })) });
      setHooks(pickReels(10));
      for (const o of out) {
        const pl = (extras.polls || []).find((x: any) => x.n === o.n);
        if (pl) o.poll = { question: pl.question, a: pl.a, b: pl.b, instruction: pl.instruction || "" };
      }
      itemsRef.current = out;
      setItems(out);
      setFact(pickFact(req.id));
      if (assets.logo) setLogoUrl(await upload(await canvasToPng(assets.logo), "logo.png").catch(() => ""));
      setStatus("Built. Drag any photo to move it in its frame, then publish.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The build stopped");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  // Dragging a photo moves it inside its frame (pack posts only).
  const dragRef = useRef<{ n: number; i: number; x: number; y: number; start: [number, number]; w: number; h: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startFocus = (p: PackPost, i: number): [number, number] => (p.focus?.[`f${i}`] as [number, number] | undefined) ?? (p.kind === "portrait" ? [0.5, 0] : (DEFAULT_FOCUS as [number, number]));
  const redraw = (n: number, i: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const client = clientRef.current;
      const it = itemsRef.current.find((x) => x.n === n);
      if (!client || !it?.post) return;
      const cv = document.createElement("canvas");
      await renderPackSlide(it.post, i, client, cv, 0.4);
      const list = [...it.previews];
      list[i] = cv.toDataURL("image/jpeg", 0.8);
      patchItem(n, { previews: list });
    }, 60);
  };
  const onDown = (e: React.PointerEvent<HTMLImageElement>, it: Item, i: number) => {
    if (!it.post || it.post.kind === "tweet") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = (e.target as HTMLElement).getBoundingClientRect();
    dragRef.current = { n: it.n, i, x: e.clientX, y: e.clientY, start: startFocus(it.post, i), w: r.width, h: r.height };
  };
  const onMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const fx = Math.max(0, Math.min(1, d.start[0] - (e.clientX - d.x) / d.w));
    const fy = Math.max(0, Math.min(1, d.start[1] - (e.clientY - d.y) / d.h));
    const it = itemsRef.current.find((x) => x.n === d.n);
    if (!it?.post) return;
    patchItem(d.n, { post: { ...it.post, focus: { ...(it.post.focus ?? {}), [`f${d.i}`]: [fx, fy] as [number, number] } } });
    redraw(d.n, d.i);
  };

  const publish = async () => {
    const client = clientRef.current;
    const assets = assetsRef.current;
    if (!req || !client || !assets || !itemsRef.current.length) return;
    setBusy(true);
    try {
      const posts = [];
      const stories = [];
      for (const [i, it] of itemsRef.current.entries()) {
        setStatus(`Saving images ${i + 1} of ${itemsRef.current.length}...`);
        const cvs = it.post ? await renderPackPost(it.post, client, 1) : it.uni!;
        const images: string[] = [];
        for (const [k, c] of cvs.entries()) images.push(await upload(await jpg(c), `post-${it.n}-${k + 1}.jpg`));
        posts.push({ n: it.n, kind: it.source, label: it.label, images, caption: it.caption, tags: it.tags });
        stories.push({ n: it.n, image: await upload(await jpg(renderStory(cvs[0], assets)), `story-${it.n}.jpg`), instruction: it.poll.instruction, poll: { question: it.poll.question, a: it.poll.a, b: it.poll.b } });
      }
      const j = await post("/ten-free/publish", { id: req.id, posts, stories, hooks, fact, logoUrl });
      setLink(siteLink(j.slug));
      setCode(j.code);
      setStatus("Published. Send her the link.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  };

  if (!req) return <div className="p-6">Loading...</div>;
  const ticked = req.treatments.join(", ");
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <Link href="/10free-admin" className="text-sm underline">Back to requests</Link>
      <h1 className="text-2xl font-bold">{req.clinicName}</h1>
      <div className="text-sm space-y-1">
        <div>{req.clinicianName} · {req.email} · {req.area} · @{req.handle}</div>
        <div>{req.website} {req.whatsapp && `· WhatsApp ${req.whatsapp}`}</div>
        <div>Ticked: {ticked || "nothing"}</div>
        <div>Hobbies: {req.answers.hobbies} · Mum: {req.answers.mum} · Pets: {req.answers.pets}</div>
        <div>Why: {req.answers.why}</div>
        <div>Three words: {req.answers.threeWords} · Passion: {req.answers.passion}</div>
        <div className="font-semibold">Studio portraits: {req.photoUrl ? (req.aiStatus === "ready" ? `${req.aiUrls.length} ready` : req.aiStatus === "failed" ? "failed" : "still being made") : "no photo sent"}
          {req.photoUrl && req.aiStatus !== "working" && <button className="ml-3 underline" onClick={async () => { await post(`/ten-free/requests/${req.id}/studio`, {}); loadReq(); }}>{req.aiStatus === "ready" ? "Make again" : "Try again"}</button>}
        </div>
        {req.aiUrls.length > 0 && <div className="flex gap-2">{req.aiUrls.map((u) => <img key={u} src={u} className="h-24 rounded" />)}</div>}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm font-semibold">Headline font for every post:</span>
        {HEAD_FONTS.map((f) => (
          <button key={f.id} onClick={() => setHeadChoice(f.id)} className={`px-3 py-1.5 rounded border text-sm ${headChoice === f.id ? "bg-pink-500 text-white border-pink-500" : ""}`} style={{ fontFamily: f.css }}>{f.label}</button>
        ))}
        <span className="text-xs text-muted-foreground">Subtitles and later pages are Playfair Display. The three treatment carousels keep the Blue Mirage headline.</span>
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        <button disabled={busy || req.aiStatus === "working"} onClick={build} className="px-4 py-2 rounded bg-pink-500 text-white disabled:opacity-50">{items.length ? "Rebuild" : "Build the 10 posts"}</button>
        {items.length > 0 && <button disabled={busy} onClick={publish} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">Publish and get the link</button>}
        <span className="text-sm">{status}</span>
      </div>
      {link && (
        <div className="border rounded p-4 space-y-2">
          <div className="text-sm">Private link for {req.clinicianName}:</div>
          <div className="font-mono text-sm break-all">{link}</div>
          <div className="text-sm">Discount code: <b>{code}</b></div>
          <button className="px-3 py-1 border rounded text-sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy link</button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.n} className="border rounded-xl p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Post {it.n} · {it.label}</div>
            <div className="flex gap-2 overflow-x-auto">
              {it.previews.map((src, i) => (
                <img key={i} src={src} draggable={false} onPointerDown={(e) => onDown(e, it, i)} onPointerMove={onMove} onPointerUp={() => { dragRef.current = null; }}
                  className={`h-80 rounded shrink-0 ${it.post && it.post.kind !== "tweet" ? "cursor-grab touch-none" : ""}`} />
              ))}
            </div>
            <textarea value={it.caption} onChange={(e) => patchItem(it.n, { caption: e.target.value })} rows={6} className="w-full text-sm border rounded p-2" />
            <input value={it.tags} onChange={(e) => patchItem(it.n, { tags: e.target.value })} className="w-full text-xs border rounded p-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TenFreeAdmin() {
  const id = new URLSearchParams(window.location.search).get("id");
  return id ? <Builder id={id} /> : <List />;
}
