import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { TEN_PLAN, pickTreatments, pickFact, monthNameUK, treatmentByName } from "@/lib/tenfree-content";
import { buildAssets, renderBespoke, renderStory, renderUniversalPost, type BespokeSpec } from "@/lib/tenfree-engine";
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
  logoUrl: string; photoUrl: string; notes: string; slug: string; code: string; createdAt: string;
};
type Poll = { question: string; a: string; b: string };
type Built = { n: number; kind: string; label: string; canvases: HTMLCanvasElement[]; story: HTMLCanvasElement; caption: string; tags: string; poll: Poll };

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

function Builder({ id }: { id: string }) {
  const [req, setReq] = useState<Req | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<Built[]>([]);
  const [hooks, setHooks] = useState<{ hook: string; idea: string }[]>([]);
  const [fact, setFact] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [waOn, setWaOn] = useState(false);
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    fetch(`${API}/ten-free/requests/${id}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => {
      setReq(j);
      if (j.slug) { setLink(siteLink(j.slug)); setCode(j.code || ""); }
    });
  }, [id]);

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

      setStatus("Choosing the three treatments...");
      const picks = pickTreatments(req.treatments, (tid) => (byT.get(tid)?.length ?? 0) >= 4, req.id);
      if (picks.length < 3) throw new Error("Not enough treatment photos in the Universal library");

      setStatus("Preparing the logo and fonts...");
      const logoBlob = req.logoUrl ? await fetch(req.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const photoBlob = req.photoUrl ? await fetch(req.photoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const assets = await buildAssets({ main: req.mainHex, accent: req.accentHex, clinicName: req.clinicName, handle: req.handle, whatsapp: waOn ? req.whatsapp : "", logoBlob, photoBlob });

      setStatus("Writing the personal posts...");
      const { posts: copy } = await post("/ten-free/copy", { clinic, answers: req.answers, kinds: ["about-me", "empower", "ageing", "seasonal", "men", "about-why"] });
      const byKind = new Map<string, any>(copy.map((c: any) => [c.kind, c]));

      setStatus("Writing the treatment posts...");
      const tcopy: any[] = [];
      for (const p of picks) {
        const r = await post("/universal/copy", { client: req.clinicName, area: req.area, treatment: p.treatment.name, headline: p.headline, brief: p.brief, intro: p.angle === 0, note: "" });
        tcopy.push(r);
      }

      setStatus("Writing the reel hooks and polls...");
      const extras = await post("/ten-free/extras", { clinic, answers: req.answers, treatmentPosts: picks.map((p) => p.treatment.name) });
      setHooks(extras.hooks);

      setStatus("Drawing the posts...");
      const out: Built[] = [];
      let ti = 0;
      for (const slot of TEN_PLAN) {
        let canvases: HTMLCanvasElement[];
        let caption = "";
        let tags = "";
        let poll: Poll = { question: "", a: "", b: "" };
        let label = slot.label;
        if (slot.kind === "treatment") {
          const p = picks[ti];
          const c = tcopy[ti];
          const urls = byT.get(p.treatment.id) ?? [];
          const photos = await Promise.all(urls.slice(0, 12).map((u) => loadBitmap(u).catch(() => null)));
          canvases = renderUniversalPost({ treatmentId: p.treatment.id, headline: p.headline, copy: { subtitle: c.subtitle, slides: c.slides, cta: c.cta }, photos: photos.filter((x): x is ImageBitmap => !!x), offset: ti * 2, angle: p.angle }, assets);
          caption = c.caption || "";
          tags = (c.hashtags || []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
          const ep = (extras.polls || []).find((x: any) => x.treatment === p.treatment.name) || (extras.polls || [])[ti];
          if (ep) poll = { question: ep.question, a: ep.a, b: ep.b };
          label = `${p.treatment.name} carousel`;
          ti++;
        } else {
          const w = byKind.get(slot.kind);
          const spec: BespokeSpec = { kind: slot.kind, carousel: slot.carousel, headline: w.headline, subtitle: w.subtitle, slides: w.slides, body: w.body, cta: "Tag a friend who will get it", month: monthNameUK() };
          canvases = renderBespoke(spec, assets, slot.n);
          caption = w.caption;
          tags = (w.hashtags || []).map((h: string) => `#${h}`).join(" ");
          poll = w.poll;
        }
        out.push({ n: slot.n, kind: slot.kind, label, canvases, story: renderStory(canvases[0], assets), caption, tags, poll });
      }
      setBuilt(out);
      setFact(pickFact(req.id));
      if (assets.logo) setLogoUrl(await upload(await canvasToPng(assets.logo), "logo.png").catch(() => ""));
      setStatus("Built. Have a look, then publish.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The build stopped");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!req || !built.length) return;
    setBusy(true);
    try {
      const posts = [];
      const stories = [];
      for (const [i, b] of built.entries()) {
        setStatus(`Saving images ${i + 1} of ${built.length}...`);
        const images: string[] = [];
        for (const [k, c] of b.canvases.entries()) images.push(await upload(await jpg(c), `post-${b.n}-${k + 1}.jpg`));
        posts.push({ n: b.n, kind: b.kind, label: b.label, images, caption: b.caption, tags: b.tags });
        stories.push({ n: b.n, image: await upload(await jpg(b.story), `story-${b.n}.jpg`), poll: b.poll });
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

  const thumbs = useMemo(() => built.map((b) => b.canvases[0].toDataURL("image/jpeg", 0.5)), [built]);
  if (!req) return <div className="p-6">Loading...</div>;
  const ticked = req.treatments.map((t) => treatmentByName(t)?.name || t).join(", ");
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <Link href="/10free-admin" className="text-sm underline">Back to requests</Link>
      <h1 className="text-2xl font-bold">{req.clinicName}</h1>
      <div className="text-sm space-y-1">
        <div>{req.clinicianName} · {req.email} · {req.area} · @{req.handle}</div>
        <div>{req.website} {req.whatsapp && `· WhatsApp ${req.whatsapp}`}</div>
        <div>Ticked: {ticked || "nothing"}</div>
        <div>Hobbies: {req.answers.hobbies} · Mum: {req.answers.mum} · Pets: {req.answers.pets}</div>
        <div>Why: {req.answers.why}</div>
        <div>Three words: {req.answers.threeWords} · Passion: {req.answers.passion}</div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={waOn} onChange={(e) => setWaOn(e.target.checked)} /> Show her WhatsApp number on the closing slides (off by default)</label>
      <div className="flex gap-3 items-center">
        <button disabled={busy} onClick={build} className="px-4 py-2 rounded bg-pink-500 text-white disabled:opacity-50">{built.length ? "Rebuild" : "Build the 9 posts"}</button>
        {built.length > 0 && <button disabled={busy} onClick={publish} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">Publish and get the link</button>}
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
      <div className="grid grid-cols-3 gap-3">
        {built.map((b, i) => (
          <div key={b.n} className="space-y-1">
            <img src={thumbs[i]} className="w-full rounded" />
            <div className="text-xs">{b.n}. {b.label} ({b.canvases.length} {b.canvases.length === 1 ? "image" : "slides"})</div>
            <div className="text-xs text-muted-foreground line-clamp-3">{b.caption}</div>
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
