import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { CoverPanel } from "@/components/cover-panel";
import { renderCoverPost, COVER_LAYOUTS, coverInfo, splitIntoLines, clientHeadFont, type CoverOptions, type CoverLayout } from "@/lib/cover-designs";
import { COVER_CONTRARIAN, COVER_SETS, COVER_SUBS_TREATMENT, COVER_BET, COVER_STOIC } from "@/lib/cover-banks";
import { SPLIT_HOOKS } from "@/lib/split-hooks";
import { fillTreatment, fillName, fillArea } from "@/lib/hook-bank";
import { usePresets } from "@/lib/use-presets";
import { useForcedClient } from "@/lib/forced-client";
import { U_TREATMENTS } from "@/lib/universal-treatments";

// NEW: the 23 new slide 1 cover templates on a client's own page, opened on that client's colours, photo and font.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const hexOk = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw };
};
const lines = (t: string | undefined) => String(t ?? "").split(/\r?\n|;/).map((s) => s.replace(/^[\s\-•\d.)]+/, "").trim()).filter(Boolean);

export default function NewCovers() {
  const forced = useForcedClient();
  const { presets } = usePresets();
  const preset = useMemo(() => (forced ? presets.find((p) => forced.pattern.test(p.name)) ?? null : null), [forced, presets]);
  const [own, setOwn] = useState<{ url: string; bmp: ImageBitmap }[]>([]);
  const [treatment, setTreatment] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [fontId, setFontId] = useState<string | undefined>();
  const [facts, setFacts] = useState<string[]>([]);
  const [value, setValue] = useState<CoverOptions | undefined>();
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [moveSel, setMoveSel] = useState("");
  const [showApproved, setShowApproved] = useState(false);
  const [approved, setApproved] = useState<{ id: number; url: string; thumb: string }[] | null>(null);
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadApproved = async () => {
    setShowApproved((v) => !v);
    if (approved) return;
    try {
      const want = (preset?.name || name || "").trim().toLowerCase();
      const out: { id: number; url: string; thumb: string }[] = [];
      const seen = new Set<string>();
      const add = (id: number, url: string) => { if (url && !seen.has(url)) { seen.add(url); out.push({ id, url, thumb: url }); } };
      // The Approvals tool: images the client has approved, matched on the client's preset or name.
      try {
        const r = await fetch(`${BASE}/api/approval/approved-images`, { credentials: "include", headers: authHeaders() });
        const d = (await r.json()) as { id: number; imageUrl: string; clientName: string; presetId: number | null }[];
        if (Array.isArray(d)) for (const im of d) {
          const cn = (im.clientName || "").trim().toLowerCase();
          if ((preset && im.presetId === preset.id) || (want && cn && (cn === want || cn.includes(want) || want.includes(cn)))) add(im.id, im.imageUrl);
        }
      } catch { /* try the other source */ }
      // Approval bundles sent through the library.
      try {
        const r = await fetch(`${BASE}/api/approval-bundles/approved-images?client=${encodeURIComponent(want)}`, { credentials: "include" });
        const d = (await r.json()) as { images?: { id: number; url: string }[] };
        for (const im of d.images ?? []) add(1_000_000 + im.id, im.url);
      } catch { /* fine */ }
      setApproved(out);
    } catch { setApproved([]); toast.error("I could not load the approved images."); }
  };
  const useApproved = async (img: { id: number; url: string }) => {
    try {
      const b = await (await fetch(img.url, { mode: "cors" })).blob();
      const bmp = await createImageBitmap(b);
      setOwn((o) => [...o, { url: URL.createObjectURL(b), bmp }]);
      setUsedIds((u) => [...u, img.id]);
    } catch { toast.error("I could not open that image."); }
  };
  const valRef = useRef<CoverOptions | undefined>(undefined);
  valRef.current = value;

  const brand: [string, string] = [hexOk(preset?.accentColor || "") ? preset!.accentColor : "#d6006f", hexOk(preset?.pageColor || "") ? preset!.pageColor : "#111111"];

  useEffect(() => {
    if (!preset) return;
    setName((n) => n || preset.name);
    fetch(`${BASE}/api/client-profiles/${encodeURIComponent(preset.name)}`).then((r) => r.json())
      .then((d: { profile?: { answers?: Record<string, string> } | null }) => { setFacts(lines(d.profile?.answers?.facts)); })
      .catch(() => undefined);
    fetch(`${BASE}/api/client-fonts`).then((r) => r.json())
      .then((d: { clients?: { clientName: string; typedName: string; fontId: string }[] }) => {
        const row = (d.clients ?? []).find((c) => forced?.pattern.test(c.clientName) || forced?.pattern.test(c.typedName));
        if (row?.fontId) setFontId(row.fontId);
      }).catch(() => undefined);
  }, [preset?.id]);

  useEffect(() => {
    let live = true;
    if (!preset?.clientPhotoUrl || own.length) return;
    fetch(preset.clientPhotoUrl, { mode: "cors" }).then((r) => r.blob()).then(async (b) => ({ url: URL.createObjectURL(b), bmp: await createImageBitmap(b) }))
      .then((p) => { if (live) setOwn((o) => (o.length ? o : [p])); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.clientPhotoUrl]);

  useEffect(() => {
    let live = true;
    if (!value) { setPreview(""); return; }
    renderCoverPost(value).then((cv) => { if (!live) return; cvRef.current = cv; setPreview(cv.toDataURL("image/jpeg", 0.95)); })
      .catch(() => toast.error("That cover would not draw. Try another photo."));
    return () => { live = false; };
  }, [value]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const add: { url: string; bmp: ImageBitmap }[] = [];
    for (const f of Array.from(files)) { try { add.push({ url: URL.createObjectURL(f), bmp: await createImageBitmap(f) }); } catch { toast.error(`I could not read ${f.name}`); } }
    setOwn((o) => [...o, ...add]);
  };

  const makeCutout = async (bmp: ImageBitmap): Promise<ImageBitmap | null> => {
    try {
      const blob = await new Promise<Blob | null>((res) => { const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d")!.drawImage(bmp, 0, 0); c.toBlob(res, "image/jpeg", 0.92); });
      if (!blob) return null;
      const fd = new FormData();
      fd.append("image", blob, "photo.jpg");
      const rr = await fetch(`${BASE}/api/ten-free/cutout`, { method: "POST", headers: authHeaders(), body: fd });
      return rr.ok ? await createImageBitmap(await rr.blob()) : null;
    } catch { return null; }
  };

  // The gallery: all 23 covers drawn at once on the photos and words above, so she can scroll down the list and pick.
  const [seed, setSeed] = useState(0);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [drawn, setDrawn] = useState(0);
  const optsRef = useRef<Map<CoverLayout, CoverOptions>>(new Map());
  const cutRef = useRef<Map<ImageBitmap, Promise<ImageBitmap | null>>>(new Map());
  const factsKey = facts.join("|");

  const starter = async (layout: CoverLayout): Promise<CoverOptions> => {
    const li = coverInfo(layout);
    const t = treatment.trim() || "lip filler";
    const fill = (x: string) => fillName(fillArea(fillTreatment(x, t), area.trim() || "your area"), name);
    const pick = <T,>(arr: T[], off = 0): T => arr[(seed + li.n + off) % arr.length];
    const photos = Array.from({ length: Math.max(1, li.photos) }, (_, i) => own[(li.n - 1 + i) % Math.max(1, own.length)]?.bmp).filter(Boolean) as ImageBitmap[];
    const n = li.needs.lines ?? 1;
    const hook = pick(SPLIT_HOOKS);
    const heading = n > 1 ? splitIntoLines(fill(`${hook[2]} ${hook[3]}`), n) : [fill(pick(COVER_CONTRARIAN))];
    const o: CoverOptions = {
      layout, photos, colours: { main: brand[0], accent: brand[1] }, lines: heading, sub: li.needs.sub ? fill(pick(COVER_SUBS_TREATMENT)) : "",
      body: li.needs.body ? fill(pick(COVER_BET)) : "", subs: [], name, fonts: { head: clientHeadFont(fontId), body: "playfair" }, move: {}, size: {}, views: [], deco: true, cutout: null,
    };
    if (li.needs.subs) {
      const max = Math.max(...li.needs.subs);
      o.subs = facts.length ? facts.slice(0, max) : Array.from({ length: max }, (_, i) => fill(pick(COVER_SUBS_TREATMENT, i * 3)));
    }
    if (li.needs.points) { const set = pick(COVER_SETS); o.lines = [fill(set.h)]; o.points = set.p.map((x) => ({ t: fill(x[0]), b: fill(x[1]) })); }
    if (li.needs.quote) { const q = pick(COVER_STOIC); o.lines = [q[0]]; o.body = q[1] ?? ""; }
    if (li.cutout && photos[0]) {
      if (!cutRef.current.has(photos[0])) cutRef.current.set(photos[0], makeCutout(photos[0]));
      o.cutout = await cutRef.current.get(photos[0])!;
    }
    return o;
  };

  useEffect(() => {
    if (value) return;
    let live = true;
    const timer = setTimeout(async () => {
      setDrawn(0);
      for (let i = 0; i < COVER_LAYOUTS.length; i++) {
        if (!live) return;
        const l = COVER_LAYOUTS[i];
        try {
          const o = await starter(l.id);
          optsRef.current.set(l.id, o);
          const cv = await renderCoverPost(o);
          const small = document.createElement("canvas"); small.width = 540; small.height = 675;
          small.getContext("2d")!.drawImage(cv, 0, 0, 540, 675);
          if (!live) return;
          setThumbs((t) => ({ ...t, [l.id]: small.toDataURL("image/jpeg", 0.7) }));
        } catch { /* one bad cover should not stop the rest */ }
        setDrawn(i + 1);
      }
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [value, own.length, treatment, area, name, fontId, brand[0], brand[1], factsKey, seed]);

  const edit = (l: CoverLayout) => { const o = optsRef.current.get(l); if (o) { setMoveSel(""); setValue(o); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const saveOne = async (l: CoverLayout) => { const o = optsRef.current.get(l); if (!o) return; const cv = await renderCoverPost(o); cv.toBlob((b) => { if (b) saveAs(b, `new-cover-${l}.png`); }, "image/png"); };

  // drag the selected piece on the preview
  const drag = useRef<{ x: number; y: number; w: number; h: number; base: [number, number]; key: string } | null>(null);
  const down = (e: React.PointerEvent<HTMLImageElement>) => {
    const v = valRef.current;
    if (!moveSel || !v) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, base: v.move?.[moveSel] ?? [0, 0], key: moveSel };
  };
  const move = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = drag.current; const v = valRef.current;
    if (!d || !v) return;
    setValue({ ...v, move: { ...(v.move ?? {}), [d.key]: [Math.round(d.base[0] + ((e.clientX - d.x) / d.w) * 1080), Math.round(d.base[1] + ((e.clientY - d.y) / d.h) * 1350)] } });
  };

  const download = () => { cvRef.current?.toBlob((b) => { if (b) saveAs(b, `new-cover-${value?.layout ?? "cover"}.png`); }, "image/png"); };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4 text-sm">
      <h1 className="text-xl font-semibold">NEW covers</h1>
      <p className="text-white/60">Add the clinician's photos and the treatment, and all 23 new slide 1 covers draw below. Scroll down the list, then tap Edit on any one to change the words, drag and size every piece. Brand colours, font and photo come through on their own.{!preset && " (I cannot see her saved look yet.)"}</p>
      <div className="grid grid-cols-3 gap-2 max-w-2xl">
        <label className="space-y-1"><span className="text-white/60">Treatment</span>
          <input list="nc-treatments" value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. lip filler" className="w-full rounded bg-white/10 px-2 py-1" />
          <datalist id="nc-treatments">{U_TREATMENTS.map((t) => <option key={t.id} value={t.name} />)}</datalist></label>
        <label className="space-y-1"><span className="text-white/60">Area</span><input value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded bg-white/10 px-2 py-1" /></label>
        <label className="space-y-1"><span className="text-white/60">Clinician</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded bg-white/10 px-2 py-1" /></label>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-1" />Add photos</Button>
          <Button size="sm" variant="outline" onClick={() => void loadApproved()}>{showApproved ? "Hide approved images" : "Approved images"}</Button>
          {!value && <Button size="sm" variant="outline" onClick={() => setSeed((x) => x + 1)}>Shuffle the words</Button>}
        </div>
        {showApproved && (
          <div className="rounded border border-white/20 p-2 space-y-1">
            <div className="text-white/60">{approved === null ? "Loading..." : approved.length ? "Tap an image to use it for the covers." : "No approved images for this client yet."}</div>
            <div className="flex gap-1.5 flex-wrap">
              {(approved ?? []).map((im) => (
                <button key={im.id} type="button" onClick={() => void useApproved(im)} className={`rounded overflow-hidden border-2 ${usedIds.includes(im.id) ? "border-pink-500" : "border-transparent"}`}>
                  <img src={im.thumb} alt="" loading="lazy" className="w-16 h-20 object-cover max-w-none shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
        <div className="flex gap-1 flex-wrap">{own.map((p, i) => <img key={i} src={p.url} alt="" className="w-12 h-16 object-cover rounded max-w-none shrink-0" />)}</div>
        {!own.length && <p className="text-white/50">Add at least one photo of the clinician to start. The photos are shared out down the list, so the more you add the more variety you see.</p>}
      </div>

      {!value && (
        <div className="space-y-3">
          <p className="text-white/60">{drawn < COVER_LAYOUTS.length ? `Drawing the covers... ${drawn} of ${COVER_LAYOUTS.length}` : "All 23 are ready. Tap Edit on the one you like."}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {COVER_LAYOUTS.map((l) => (
              <div key={l.id} className="space-y-1.5">
                {thumbs[l.id]
                  ? <img src={thumbs[l.id]} alt="" onClick={() => edit(l.id)} className="w-full h-auto rounded border cursor-pointer" />
                  : <div className="w-full aspect-[4/5] rounded border border-dashed flex items-center justify-center text-white/40">Drawing...</div>}
                <div className="font-semibold">{l.n}. {l.label}{l.statik ? " (static)" : ""}</div>
                <div className="flex gap-1.5">
                  <Button size="sm" disabled={!thumbs[l.id]} onClick={() => edit(l.id)}>Edit</Button>
                  <Button size="sm" variant="outline" disabled={!thumbs[l.id]} onClick={() => void saveOne(l.id)}><Download className="w-4 h-4 mr-1" />PNG</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {value && (
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          <div className="space-y-3 order-last md:order-none">
            <div className="text-black bg-white rounded p-2">
              <CoverPanel value={value} onChange={(nx) => setValue(nx ?? undefined)} busy={busy} makeCutout={async (b) => { setBusy(true); const r = await makeCutout(b); setBusy(false); return r; }}
                base={{ own, headline: "", name, treatment, area, brand, fontId, facts, offset: 0 }} moveSel={moveSel} setMoveSel={setMoveSel} />
            </div>
          </div>
          <div className="space-y-2 order-first md:order-none sticky top-0 z-20 self-start bg-black pb-2 pt-1 -mx-1 px-1">
            {preview ? (
              <>
                <img src={preview} alt="" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} className={`w-auto max-h-[46vh] md:max-h-[85vh] max-w-full mx-auto md:mx-0 rounded ${moveSel ? "cursor-grab touch-none" : ""}`} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />Download</Button>
                  <Button size="sm" variant="outline" onClick={() => { setMoveSel(""); setValue(undefined); }}>Back to all 23</Button>
                </div>
              </>
            ) : <div className="text-white/50 border border-dashed border-white/20 rounded p-10 text-center">Drawing...</div>}
          </div>
        </div>
      )}
    </div>
  );
}
