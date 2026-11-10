import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { CoverPanel } from "@/components/cover-panel";
import { renderCoverPost, type CoverOptions } from "@/lib/cover-designs";
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
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    renderCoverPost(value).then((cv) => { if (!live) return; cvRef.current = cv; setPreview(cv.toDataURL("image/jpeg", 0.8)); })
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
      <p className="text-white/60">Pick one of the 23 new slide 1 covers, fill the words from a bank, then drag and size every piece. Brand colours, font and photo come through on their own.{!preset && " (I cannot see her saved look yet.)"}</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1"><span className="text-white/60">Treatment</span>
              <input list="nc-treatments" value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. lip filler" className="w-full rounded bg-white/10 px-2 py-1" />
              <datalist id="nc-treatments">{U_TREATMENTS.map((t) => <option key={t.id} value={t.name} />)}</datalist></label>
            <label className="space-y-1"><span className="text-white/60">Area</span><input value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded bg-white/10 px-2 py-1" /></label>
            <label className="space-y-1"><span className="text-white/60">Clinician</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded bg-white/10 px-2 py-1" /></label>
          </div>
          <div className="space-y-1">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-1" />Add photos</Button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
            <div className="flex gap-1 flex-wrap">{own.map((p, i) => <img key={i} src={p.url} alt="" className="w-12 h-16 object-cover rounded" />)}</div>
            {!own.length && <p className="text-white/50">Add at least one photo of the clinician to start.</p>}
          </div>
          <div className="text-black bg-white rounded p-2">
            <CoverPanel value={value} onChange={(nx) => setValue(nx ?? undefined)} busy={busy} makeCutout={async (b) => { setBusy(true); const r = await makeCutout(b); setBusy(false); return r; }}
              base={{ own, headline: "", name, treatment, area, brand, fontId, facts, offset: 0 }} moveSel={moveSel} setMoveSel={setMoveSel} />
          </div>
        </div>
        <div className="space-y-2">
          {preview ? (
            <>
              <img src={preview} alt="" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} className={`w-full max-w-md rounded ${moveSel ? "cursor-grab touch-none" : ""}`} />
              <Button size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />Download</Button>
            </>
          ) : <div className="text-white/50 border border-dashed border-white/20 rounded p-10 text-center">Choose a cover on the left and it will show here.</div>}
        </div>
      </div>
    </div>
  );
}
