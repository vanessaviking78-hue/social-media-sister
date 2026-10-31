import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Copy, ExternalLink, RefreshCw, Send, Download, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { buildPackPlan, PACK_PRICE, type PackSize } from "@/lib/pack-plan";
import { applyCopy, skeleton, treatmentIdsFor, type CopyResult, type CopySpec } from "@/lib/pack-build";
import { renderPackPost, renderPackSlide, type PackClient, type PackPost } from "@/lib/pack-engine";
import { DEFAULT_FOCUS } from "@/lib/month-engine";
import { brandPalette, loadImage, prepareLogo, textLogo, transparentLogo } from "@/lib/sample-post";
import type { PoolPhoto } from "@/lib/month-engine";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

type Draft = {
  id: string;
  status: string;
  clinicName: string;
  handle: string;
  area: string;
  logoUrl: string;
  slug: string;
  error: string;
  data?: {
    photos?: { url: string; source: string }[];
    pack?: {
      size: PackSize;
      month: string;
      role: string;
      mainHex: string;
      accentHex: string;
      treatments: string[];
      clinicianName?: string;
    };
  };
};

async function urlToFile(url: string, name: string): Promise<File> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the logo");
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type });
}

const BATCH = 4;
const hexOk = (h?: string) => !!h && /^#[0-9a-fA-F]{6}$/.test(h);

export default function PackReview() {
  const draftId = useMemo(() => new URLSearchParams(window.location.search).get("draft") || "", []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [posts, setPosts] = useState<PackPost[]>([]);
  const [previews, setPreviews] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const clientRef = useRef<PackClient | null>(null);
  const [runKey, setRunKey] = useState(0);
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [every, setEvery] = useState(2);
  const [postTime, setPostTime] = useState("18:15");
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    if (!draftId) {
      setStatus("No pack chosen.");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const r = await fetch(`${API}/free-samples/drafts/${draftId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("Could not find that pack");
        const d = (await r.json()) as Draft;
        if (cancelled) return;
        setDraft(d);
        if (d.slug) setLink(`${window.location.origin}${BASE}/pack/${d.slug}`);
        if (d.status === "failed") {
          setStatus(d.error || "The Studio images did not finish.");
          return;
        }
        if (!d.data?.pack || !d.data.photos?.length) {
          setStatus("The Studio images are still being made. This page updates itself.");
          timer = setTimeout(() => setRunKey((k) => k + 1), 8000);
          return;
        }
        await build(d, () => cancelled);
      } catch (e: unknown) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, runKey]);

  const build = async (d: Draft, stop: () => boolean) => {
    const pack = d.data!.pack!;
    setStatus("Getting the logo and photos ready...");
    let prepared: { logo: HTMLCanvasElement; palette: ReturnType<typeof textLogo>["palette"] };
    try {
      prepared = d.logoUrl ? await prepareLogo(await urlToFile(d.logoUrl, "logo.png")) : textLogo(d.clinicName);
    } catch {
      prepared = textLogo(d.clinicName);
    }
    const main = hexOk(pack.mainHex) ? pack.mainHex : "#1f3a5f";
    const accent = hexOk(pack.accentHex) ? pack.accentHex : "#c9a27a";
    // The logo always goes on with no background box, straight onto the photo or the colour.
    const clearLogo = transparentLogo(prepared.logo);
    const palette = { ...brandPalette(main, prepared.palette), tile: "rgba(0,0,0,0)" };

    const pool: PoolPhoto[] = [];
    for (const [i, ph] of (d.data!.photos ?? []).entries()) {
      try {
        const r = await fetch(`${API}/free-samples/source-image?url=${encodeURIComponent(ph.url)}`);
        if (!r.ok) continue;
        const blob = await r.blob();
        const file = new File([blob], `pool-${i}.jpg`, { type: blob.type || "image/jpeg" });
        pool.push({ id: `${d.id}-${i}`, file, url: URL.createObjectURL(blob) });
      } catch { /* skip a photo that will not load */ }
    }
    if (stop()) return;
    if (pool.length === 0) {
      setStatus("None of the Studio photos would load.");
      return;
    }

    const logoImg = await loadImage(clearLogo.toDataURL("image/png")).catch(() => null);
    const owner = pack.clinicianName || "";
    const client: PackClient = {
      businessName: d.clinicName,
      ownerName: owner,
      role: pack.role,
      area: d.area,
      audience: "women over 35",
      brandNotes: "",
      footnote: "",
      fill: { owner, clinic: d.clinicName, area: d.area.split(",")[0].trim(), role: pack.role },
      headFont: "'Instrument Serif', serif",
      bodyFont: "'Montserrat', sans-serif",
      brand: { main, accent },
      logo: logoImg,
      pool,
      handle: d.handle,
      portraitLogo: clearLogo,
      portraitPalette: palette,
    };
    clientRef.current = client;

    const plan = buildPackPlan(pack.size, d.handle, pack.month, treatmentIdsFor(pack.treatments ?? []));
    const cursor = { at: 0 };
    const built = plan.map((item) => skeleton(item, cursor, pool.length));
    let current: PackPost[] = built.map((b) => b.post);
    const specs: CopySpec[] = built.map((b) => b.spec);

    // Write the words in small batches so one slow reply never loses the lot.
    const results: PackPost[] = [...current];
    let tagsA = "";
    let tagsB = "";
    for (let i = 0; i < specs.length; i += BATCH) {
      if (stop()) return;
      setStatus(`Writing the words and captions... ${Math.min(i + BATCH, specs.length)} of ${specs.length}`);
      const chunk = specs.slice(i, i + BATCH);
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          const r = await fetch(`${API}/post-packs/copy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clinic: { name: d.clinicName, owner, role: pack.role, area: d.area, treatments: pack.treatments ?? [] },
              items: chunk.map((s) => ({ n: s.n, kind: s.kind, idea: s.idea, fields: s.fields, current: s.current, photoSlides: s.photoSlides })),
            }),
          });
          const j = (await r.json()) as { items?: CopyResult[]; tagsA?: string; tagsB?: string; error?: string };
          if (!r.ok || !j.items) throw new Error(j.error || "The caption writer did not answer");
          if (!tagsA && j.tagsA) tagsA = j.tagsA;
          if (!tagsB && j.tagsB) tagsB = j.tagsB;
          for (const res of j.items) {
            const idx = results.findIndex((p) => p.n === res.n);
            if (idx >= 0) results[idx] = applyCopy(results[idx], res, (res.n % 2 === 0 ? tagsB || tagsA : tagsA || tagsB));
          }
          ok = true;
        } catch (e: unknown) {
          if (attempt === 1) toast.error(e instanceof Error ? e.message : "A batch of captions failed");
        }
      }
      setPosts([...results]);
    }
    // Make sure every post carries the same two hashtag lines in rotation.
    const final = results.map((p) => (p.hashtags ? p : { ...p, hashtags: p.n % 2 === 0 ? tagsB || tagsA : tagsA || tagsB }));
    if (stop()) return;
    setPosts(final);

    setStatus("Drawing the posts...");
    const out: Record<number, string[]> = {};
    for (const p of final) {
      if (stop()) return;
      try {
        const cvs = await renderPackPost(p, client, 0.4);
        out[p.n] = cvs.map((c) => c.toDataURL("image/jpeg", 0.8));
      } catch {
        out[p.n] = [];
      }
      setPreviews({ ...out });
    }
    setStatus("");
    current = final;
  };

  // Dragging a photo moves it inside its box. The drag is turned into a new focus point for that slide and
  // just that slide is drawn again.
  const dragRef = useRef<{ n: number; i: number; x: number; y: number; start: [number, number]; w: number; h: number } | null>(null);
  const redrawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postsRef = useRef<PackPost[]>([]);
  postsRef.current = posts;

  const startFocus = (p: PackPost, i: number): [number, number] =>
    (p.focus?.[`f${i}`] as [number, number] | undefined) ?? (p.kind === "portrait" ? [0.5, 0] : (DEFAULT_FOCUS as [number, number]));

  const redrawSlide = (n: number, i: number) => {
    if (redrawTimer.current) clearTimeout(redrawTimer.current);
    redrawTimer.current = setTimeout(async () => {
      const client = clientRef.current;
      const post = postsRef.current.find((p) => p.n === n);
      if (!client || !post) return;
      const cv = document.createElement("canvas");
      await renderPackSlide(post, i, client, cv, 0.4);
      setPreviews((pv) => {
        const list = [...(pv[n] ?? [])];
        list[i] = cv.toDataURL("image/jpeg", 0.8);
        return { ...pv, [n]: list };
      });
    }, 60);
  };

  const onDown = (e: React.PointerEvent<HTMLImageElement>, p: PackPost, i: number) => {
    if (p.kind === "tweet") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = (e.target as HTMLElement).getBoundingClientRect();
    dragRef.current = { n: p.n, i, x: e.clientX, y: e.clientY, start: startFocus(p, i), w: r.width, h: r.height };
  };
  const onMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const fx = Math.max(0, Math.min(1, d.start[0] - (e.clientX - d.x) / d.w));
    const fy = Math.max(0, Math.min(1, d.start[1] - (e.clientY - d.y) / d.h));
    setPosts((ps) => ps.map((p) => (p.n === d.n ? { ...p, focus: { ...(p.focus ?? {}), [`f${d.i}`]: [fx, fy] as [number, number] } } : p)));
    postsRef.current = postsRef.current.map((p) => (p.n === d.n ? { ...p, focus: { ...(p.focus ?? {}), [`f${d.i}`]: [fx, fy] as [number, number] } } : p));
    redrawSlide(d.n, d.i);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const setCaption = (n: number, caption: string) => setPosts((ps) => ps.map((p) => (p.n === n ? { ...p, caption } : p)));
  const setTags = (n: number, hashtags: string) => setPosts((ps) => ps.map((p) => (p.n === n ? { ...p, hashtags } : p)));

  const uploadBlob = async (blob: Blob, name: string) => {
    const fd = new FormData();
    fd.append("image", blob, name);
    const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
    const d = (await r.json()) as { url?: string; error?: string };
    if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
    return d.url;
  };

  const publish = async () => {
    const client = clientRef.current;
    if (!draft || !client || posts.length === 0) return;
    setBusy(true);
    try {
      const out: { n: number; kind: string; images: string[]; caption: string; tags: string }[] = [];
      for (const [i, p] of posts.entries()) {
        setStatus(`Saving the finished posts... ${i + 1} of ${posts.length}`);
        const cvs = await renderPackPost(p, client, 1);
        const images: string[] = [];
        for (const [k, c] of cvs.entries()) {
          const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not save a slide"))), "image/jpeg", 0.92));
          images.push(await uploadBlob(blob, `pack-${p.n}-${k + 1}.jpg`));
        }
        out.push({ n: p.n, kind: p.kind, images, caption: p.caption, tags: p.hashtags });
      }
      const r = await fetch(`${API}/post-packs/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: draft.clinicName,
          draftId: draft.id,
          size: draft.data?.pack?.size,
          logoUrl: draft.logoUrl,
          accent: draft.data?.pack?.accentHex,
          posts: out,
        }),
      });
      const j = (await r.json()) as { slug?: string; error?: string };
      if (!r.ok || !j.slug) throw new Error(j.error || "Publishing failed");
      const url = `${window.location.origin}${BASE}/pack/${j.slug}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Published. The link is copied.");
      } catch {
        toast.success("Published.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> =>
    new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not save a slide"))), type, q));

  const download = async () => {
    const client = clientRef.current;
    if (!draft || !client || posts.length === 0) return;
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const lines: string[] = [];
      for (const [i, p] of posts.entries()) {
        setStatus(`Packing the posts... ${i + 1} of ${posts.length}`);
        const cvs = await renderPackPost(p, client, 1);
        for (const [k, c] of cvs.entries()) zip.file(`Post ${p.n}${cvs.length > 1 ? ` slide ${k + 1}` : ""}.jpg`, await toBlob(c));
        lines.push(`POST ${p.n}\n\n${p.caption}\n\n${p.hashtags}`);
      }
      zip.file("Captions.txt", lines.join("\n\n----------\n\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${draft.clinicName} Post Pack.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Downloaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  const scheduleAll = async () => {
    const client = clientRef.current;
    if (!draft || !client || posts.length === 0) return;
    if (!presetId) {
      toast.error("Choose which client to schedule this for");
      return;
    }
    setBusy(true);
    let done = 0;
    try {
      for (const [i, p] of posts.entries()) {
        setStatus(`Scheduling ${i + 1} of ${posts.length}`);
        const cvs = await renderPackPost(p, client, 1);
        const urls: string[] = [];
        for (const [k, c] of cvs.entries()) urls.push(await uploadBlob(await toBlob(c), `pack-${p.n}-${k + 1}.jpg`));
        const when = new Date(`${startDate}T${postTime}:00`);
        when.setDate(when.getDate() + i * every);
        const r = await fetch(`${API}/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: urls.length > 1 ? "carousel" : "single-image",
            content: {
              caption: `${p.caption.trim()}\n\n${p.hashtags}`.trim(),
              title: `Post ${p.n} · ${draft.clinicName}`,
              platforms: ["instagram"],
              imageUrls: urls,
              sourceTool: "post-pack",
            },
            scheduledAt: when.toISOString(),
            isTrial: false,
            notes: "",
            presetId: Number(presetId),
          }),
        });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({ error: "Failed" }))) as { error?: string };
          throw new Error(err.error || "Failed to schedule a post");
        }
        done++;
      }
      toast.success(`${done} posts scheduled.`);
      setShowSchedule(false);
    } catch (e: unknown) {
      toast.error(`${done} scheduled, then it stopped: ${e instanceof Error ? e.message : "failed"}`);
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  const retry = async () => {
    await fetch(`${API}/post-packs/drafts/${draftId}/retry`, { method: "POST" });
    setStatus("Making the Studio images again...");
    setTimeout(() => setRunKey((k) => k + 1), 6000);
  };

  const pack = draft?.data?.pack;

  return (
    <div className="min-h-screen bg-[#faf6f2] text-[#2b2320]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#7a625a] mb-4">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-3xl mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
          {draft ? `${draft.clinicName} post pack` : "Post pack"}
        </h1>
        {pack && (
          <p className="text-sm text-[#7a625a] mb-4">
            {pack.size} posts for {pack.month}, £{PACK_PRICE[pack.size]}. {pack.role}. {draft?.handle}. {draft?.area}.
          </p>
        )}

        {status && (
          <div className="flex items-center gap-2 text-sm bg-white border border-[#eaded6] rounded-lg p-3 mb-4">
            {draft?.status !== "failed" && <Loader2 size={16} className="animate-spin" />}
            <span>{status}</span>
            {draft?.status === "failed" && (
              <button onClick={retry} className="ml-auto inline-flex items-center gap-1 text-sm underline">
                <RefreshCw size={14} /> Try again
              </button>
            )}
          </div>
        )}

        {link && (
          <div className="flex items-center gap-2 bg-white border border-[#eaded6] rounded-lg p-3 mb-4 text-sm">
            <span className="truncate">{link}</span>
            <button onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Copied"))} className="ml-auto" aria-label="Copy link"><Copy size={16} /></button>
            <a href={link} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink size={16} /></a>
          </div>
        )}

        {posts.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 mb-2">
              <button
                onClick={publish}
                disabled={busy || !!status}
                className="inline-flex items-center gap-2 bg-[#2b2320] text-white rounded-full px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Create the clinic's link
              </button>
              <button
                onClick={download}
                disabled={busy || !!status}
                className="inline-flex items-center gap-2 border border-[#2b2320] rounded-full px-5 py-2.5 text-sm disabled:opacity-50"
              >
                <Download size={16} /> Download the lot
              </button>
              <button
                onClick={() => setShowSchedule((v) => !v)}
                disabled={busy || !!status}
                className="inline-flex items-center gap-2 border border-[#2b2320] rounded-full px-5 py-2.5 text-sm disabled:opacity-50"
              >
                <CalendarClock size={16} /> Schedule
              </button>
            </div>
            {showSchedule && (
              <div className="bg-white border border-[#eaded6] rounded-lg p-4 mb-4 grid gap-3 sm:grid-cols-4 text-sm">
                <label className="sm:col-span-4">Schedule for which client
                  <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="block w-full border border-[#eaded6] rounded-md p-2 mt-1">
                    <option value="">Choose a client</option>
                    {presets.map((pr) => <option key={pr.id} value={String(pr.id)}>{pr.name}</option>)}
                  </select>
                </label>
                <label>First post on
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full border border-[#eaded6] rounded-md p-2 mt-1" />
                </label>
                <label>At
                  <input type="time" value={postTime} onChange={(e) => setPostTime(e.target.value)} className="block w-full border border-[#eaded6] rounded-md p-2 mt-1" />
                </label>
                <label>One post every
                  <select value={every} onChange={(e) => setEvery(Number(e.target.value))} className="block w-full border border-[#eaded6] rounded-md p-2 mt-1">
                    {[1, 2, 3, 7].map((n) => <option key={n} value={n}>{n === 1 ? "day" : `${n} days`}</option>)}
                  </select>
                </label>
                <button onClick={scheduleAll} disabled={busy} className="self-end bg-[#2b2320] text-white rounded-md px-4 py-2.5 disabled:opacity-50">Schedule all {posts.length}</button>
              </div>
            )}
            <p className="text-xs text-[#7a625a] mb-4">The link button saves the pack and makes the page the clinic opens. Drag any photo to move it inside its box.</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <div key={p.n} className="bg-white border border-[#eaded6] rounded-xl p-3">
                  <div className="text-xs uppercase tracking-wide text-[#a48c82] mb-2">Post {p.n}, {p.kind}</div>
                  <div className="flex gap-2 overflow-x-auto mb-3">
                    {(previews[p.n] ?? []).length === 0 ? (
                      <div className="h-48 w-full grid place-items-center text-xs text-[#a48c82]">Drawing...</div>
                    ) : (
                      previews[p.n].map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          draggable={false}
                          onPointerDown={(e) => onDown(e, p, i)}
                          onPointerMove={onMove}
                          onPointerUp={onUp}
                          className={`h-64 rounded-md shrink-0 ${p.kind === "tweet" ? "" : "cursor-grab touch-none"}`}
                        />
                      ))
                    )}
                  </div>
                  <textarea
                    value={p.caption}
                    onChange={(e) => setCaption(p.n, e.target.value)}
                    rows={7}
                    className="w-full text-sm border border-[#eaded6] rounded-md p-2 mb-2"
                  />
                  <input
                    value={p.hashtags}
                    onChange={(e) => setTags(p.n, e.target.value)}
                    className="w-full text-xs border border-[#eaded6] rounded-md p-2"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
