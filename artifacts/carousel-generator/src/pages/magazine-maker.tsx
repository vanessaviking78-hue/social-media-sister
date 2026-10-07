import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, Sparkles, X, Loader2, Move } from "lucide-react";
import { toast } from "sonner";
import { MagazineIcon } from "@/components/magazine-icon";
import { coverToCanvas, loadImageFromFile } from "@/lib/advent-door";
import {
  EMPTY_COPY,
  drawAllPages,
  getPhotoHits,
  DEFAULT_ADJUST,
  PAGE_W,
  PAGE_H,
  type PhotoAdjust,
  type MagazineBrand,
  type MagazineCopy,
} from "@/lib/magazine-pages";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Photo = { canvas: HTMLCanvasElement; thumb: string; name: string };

const STYLES = [
  { key: "1", label: "Northern grit", hint: "Straight talking, warm, dry" },
  { key: "2", label: "Springsteen storyteller", hint: "Little scenes, big heart, whimsical" },
  { key: "3", label: "Dawn French", hint: "Funny and blunt" },
  { key: "4", label: "Professional with personality", hint: "Polished, still very you" },
  { key: "5", label: "Feral and sarcastic", hint: "Savage, cheeky, affable underneath" },
];

const PHOTO_LABELS = [
  "Cover main photo",
  "Cover small photo",
  "Page 2 big photo",
  "Page 2 small photo",
  "Page 3 first feature",
  "Page 3 second feature",
];

const PAGE_NAMES = ["front-cover", "page-2", "page-3", "call-to-action"];

function monthYear() {
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function PhotoSlot({
  label,
  n,
  photo,
  onFile,
  onClear,
}: {
  label: string;
  n: number;
  photo: Photo | null;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return photo ? (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
      <img src={photo.thumb} alt={label} className="w-full aspect-[3/4] object-cover" />
      <button
        onClick={onClear}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-zinc-200 hover:text-white"
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
      <p className="absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] text-zinc-300 bg-black/60 truncate">
        {n}. {label}
      </p>
    </div>
  ) : (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer.files?.[0]);
      }}
      className="flex flex-col items-center justify-center aspect-[3/4] border-2 border-dashed border-zinc-800 hover:border-fuchsia-500/60 rounded-xl p-2 text-center cursor-pointer transition-colors"
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <Upload className="mb-1.5 text-zinc-600" size={18} />
      <p className="text-[11px] font-medium text-zinc-300">
        {n}. {label}
      </p>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const cls =
    "w-full rounded-lg bg-zinc-900 border border-zinc-800 focus:border-fuchsia-500 outline-none px-3 py-2 text-sm text-white placeholder:text-zinc-600";
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

export default function MagazineMaker() {
  const [clinicName, setClinicName] = useState("");
  const [colour, setColour] = useState("#4a1942");
  const [accent, setAccent] = useState("#f0b8a4");
  const [ctaButton, setCtaButton] = useState("Book a consultation");
  const [contact, setContact] = useState("");
  const [style, setStyle] = useState("1");
  const [topics, setTopics] = useState(["", "", ""]);
  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null, null, null, null, null]);
  const [copy, setCopy] = useState<MagazineCopy>(EMPTY_COPY);
  const [writing, setWriting] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);
  const pagesRef = useRef<HTMLCanvasElement[]>([]);
  const [adjusts, setAdjusts] = useState<PhotoAdjust[]>(() => Array.from({ length: 6 }, () => ({ ...DEFAULT_ADJUST })));
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ slot: number; x: number; y: number; inv: DOMMatrix; slackX: number; slackY: number } | null>(null);
  const adjustsRef = useRef(adjusts);
  adjustsRef.current = adjusts;

  function updateAdjust(slot: number, fn: (a: PhotoAdjust) => PhotoAdjust) {
    setAdjusts((prev) => {
      const next = [...prev];
      next[slot] = fn(prev[slot]);
      return next;
    });
  }

  const brand: MagazineBrand = {
    clinicName: clinicName.trim() || "Your clinic",
    colour,
    accent,
    ctaButton: ctaButton.trim(),
    contact: contact.trim(),
    issue: monthYear(),
  };

  const loadPhoto = useCallback(async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      const canvas = coverToCanvas(img);
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = { canvas, thumb: canvas.toDataURL("image/jpeg", 0.6), name: file.name };
        return next;
      });
      setAdjusts((prev) => {
        const next = [...prev];
        next[index] = { ...DEFAULT_ADJUST };
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read that image, try another file");
    }
  }, []);

  // Redraw the four pages a moment after anything changes.
  useEffect(() => {
    const id = setTimeout(() => {
      const pages = drawAllPages(
        brand,
        copy,
        photos.map((p) => p?.canvas ?? null),
        adjusts
      );
      pagesRef.current = pages;
      const big = bigRef.current;
      if (big && pages[activePage]) {
        const bctx = big.getContext("2d")!;
        bctx.clearRect(0, 0, big.width, big.height);
        bctx.drawImage(pages[activePage], 0, 0, big.width, big.height);
      }
      pages.forEach((page, i) => {
        const target = canvasRefs.current[i];
        if (!target) return;
        const ctx = target.getContext("2d")!;
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(page, 0, 0, target.width, target.height);
      });
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicName, colour, accent, ctaButton, contact, copy, photos, adjusts, activePage]);

  // Find the photo under the pointer on the big page and return it with page coordinates.
  function hitAt(e: { clientX: number; clientY: number }) {
    const big = bigRef.current;
    if (!big) return null;
    const r = big.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * PAGE_W;
    const py = ((e.clientY - r.top) / r.height) * PAGE_H;
    const list = getPhotoHits().filter((h) => h.page === activePage);
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      const lp = h.inv.transformPoint(new DOMPoint(px, py));
      if (lp.x >= h.x && lp.x <= h.x + h.w && lp.y >= h.y && lp.y <= h.y + h.h) return { h, px, py };
    }
    return null;
  }

  function onBigDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const hit = hitAt(e);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(hit.h.slot);
    dragRef.current = { slot: hit.h.slot, x: hit.px, y: hit.py, inv: hit.h.inv, slackX: hit.h.slackX, slackY: hit.h.slackY };
  }

  function onBigMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const big = bigRef.current;
    const d = dragRef.current;
    if (!big) return;
    if (!d) {
      big.style.cursor = hitAt(e) ? "grab" : "default";
      return;
    }
    big.style.cursor = "grabbing";
    const r = big.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * PAGE_W;
    const py = ((e.clientY - r.top) / r.height) * PAGE_H;
    const dx = px - d.x;
    const dy = py - d.y;
    // move the drag into the frame's own (possibly tilted) space
    const ldx = d.inv.a * dx + d.inv.c * dy;
    const ldy = d.inv.b * dx + d.inv.d * dy;
    d.x = px;
    d.y = py;
    updateAdjust(d.slot, (a) => ({
      ...a,
      panX: d.slackX > 0 ? Math.max(-1, Math.min(1, a.panX + ldx / (d.slackX / 2))) : 0,
      panY: d.slackY > 0 ? Math.max(-1, Math.min(1, a.panY + ldy / (d.slackY / 2))) : 0,
    }));
  }

  function onBigUp() {
    dragRef.current = null;
    if (bigRef.current) bigRef.current.style.cursor = "grab";
  }

  // Scroll wheel zooms the photo under the pointer. It needs a non passive listener to stop the page scrolling.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const hit = hitAt(e);
    if (!hit) return;
    e.preventDefault();
    setSelected(hit.h.slot);
    updateAdjust(hit.h.slot, (a) => ({ ...a, zoom: Math.max(1, Math.min(4, a.zoom * (1 - e.deltaY * 0.0015))) }));
  };
  useEffect(() => {
    const el = bigRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  async function writeCopy() {
    if (topics.some((t) => !t.trim())) {
      toast.error("Add all 3 topics first");
      return;
    }
    setWriting(true);
    try {
      const r = await fetch(`${BASE}/api/magazine-maker/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: clinicName.trim(), topics, style, cta: ctaButton.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "The copy would not write, try again");
      setCopy(data as MagazineCopy);
      toast.success("Written. Have a read and change anything you like");
    } catch (e: any) {
      toast.error(e?.message || "The copy would not write, try again");
    } finally {
      setWriting(false);
    }
  }

  async function downloadAll() {
    const pages = pagesRef.current;
    if (pages.length < 4) return;
    const slug = (clinicName.trim() || "magazine").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (let i = 0; i < pages.length; i++) {
      const blob: Blob | null = await new Promise((res) => pages[i].toBlob(res, "image/png"));
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${i + 1}-${PAGE_NAMES[i]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await new Promise((r) => setTimeout(r, 350));
    }
    toast.success("4 pages downloaded. Add them in order on the Magazine Flip page");
  }

  const setCover = (patch: Partial<MagazineCopy["cover"]>) => setCopy((c) => ({ ...c, cover: { ...c.cover, ...patch } }));
  const setP2 = (patch: Partial<MagazineCopy["page2"]>) => setCopy((c) => ({ ...c, page2: { ...c.page2, ...patch } }));
  const setP3 = (i: 0 | 1, patch: Partial<MagazineCopy["page3"][0]>) =>
    setCopy((c) => {
      const p3 = [...c.page3] as MagazineCopy["page3"];
      p3[i] = { ...p3[i], ...patch };
      return { ...c, page3: p3 };
    });
  const setCta = (patch: Partial<MagazineCopy["cta"]>) => setCopy((c) => ({ ...c, cta: { ...c.cta, ...patch } }));
  const setLine = (i: number, v: string) =>
    setCopy((c) => {
      const lines = [...c.cover.lines] as MagazineCopy["cover"]["lines"];
      lines[i] = v;
      return { ...c, cover: { ...c.cover, lines } };
    });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors" aria-label="Back to the hub">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MagazineIcon className="w-6 h-6 text-fuchsia-400" /> Magazine Maker
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Add 6 photos and 3 topics, pick a voice, and I write and lay out the 4 pages. Download them and pop them into Magazine Flip.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-8 items-start">
          {/* LEFT: the inputs */}
          <div className="space-y-7">
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">1. The clinic</p>
              <Field label="Clinic name" value={clinicName} onChange={setClinicName} placeholder="e.g. Aspyre Aesthetics" />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Brand colour</span>
                  <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="w-full h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer" />
                </label>
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Highlight colour</span>
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full h-10 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Button says" value={ctaButton} onChange={setCtaButton} placeholder="Book a consultation" />
                <Field label="Website, phone or handle" value={contact} onChange={setContact} placeholder="www.yourclinic.co.uk" />
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">2. Six photos</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PHOTO_LABELS.map((label, i) => (
                  <PhotoSlot
                    key={label}
                    label={label}
                    n={i + 1}
                    photo={photos[i]}
                    onFile={(f) => loadPhoto(i, f)}
                    onClear={() =>
                      setPhotos((prev) => {
                        const next = [...prev];
                        next[i] = null;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">3. Three topics</p>
              {topics.map((t, i) => (
                <Field
                  key={i}
                  label={i === 0 ? "Topic 1 (page 2 feature)" : i === 1 ? "Topic 2 (page 3, top)" : "Topic 3 (page 3, bottom)"}
                  value={t}
                  onChange={(v) => setTopics((prev) => prev.map((x, j) => (j === i ? v : x)))}
                  placeholder={i === 0 ? "e.g. skin boosters for tired skin" : i === 1 ? "e.g. what happens at a first consultation" : "e.g. why I say no to some treatments"}
                />
              ))}
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500">4. How should it sound</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStyle(s.key)}
                    aria-pressed={style === s.key}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      style === s.key ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-zinc-800 bg-zinc-900 hover:border-fuchsia-500/50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{s.label}</span>
                    <span className="block text-xs text-zinc-500 mt-0.5">{s.hint}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={writeCopy}
                disabled={writing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {writing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Writing your pages
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> {copy.cover.headline ? "Write it again" : "Write my pages"}
                  </>
                )}
              </button>
            </section>
          </div>

          {/* RIGHT: preview and editable copy */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <Move size={12} /> Move and resize your photos
              </p>
              <div className="flex gap-1.5 mb-2">
                {["Cover", "Page 2", "Page 3"].map((t, i) => (
                  <button
                    key={t}
                    onClick={() => {
                      setActivePage(i);
                      setSelected(null);
                    }}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      activePage === i
                        ? "bg-fuchsia-600 border-fuchsia-500 text-white"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <canvas
                ref={bigRef}
                width={540}
                height={720}
                onPointerDown={onBigDown}
                onPointerMove={onBigMove}
                onPointerUp={onBigUp}
                onPointerCancel={onBigUp}
                style={{ touchAction: "none" }}
                className="w-full max-w-sm aspect-[3/4] rounded-lg border border-zinc-800 bg-zinc-900"
                aria-label="Large page preview. Drag a photo to move it, scroll to zoom."
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Drag a photo to slide it about inside its frame. Scroll over it, or use the slider, to zoom in.
              </p>
              {selected !== null && photos[selected] && (
                <div className="mt-2 flex items-center gap-3 max-w-sm">
                  <span className="text-[11px] text-zinc-400 shrink-0">{PHOTO_LABELS[selected]}</span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.01}
                    value={adjusts[selected].zoom}
                    onChange={(e) => updateAdjust(selected, (a) => ({ ...a, zoom: Number(e.target.value) }))}
                    className="flex-1 accent-fuchsia-500"
                    aria-label="Zoom"
                  />
                  <button
                    onClick={() => updateAdjust(selected, () => ({ ...DEFAULT_ADJUST }))}
                    className="text-[11px] text-fuchsia-400 underline shrink-0"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Your 4 pages</p>
              <div className="grid grid-cols-4 gap-2">
                {PAGE_NAMES.map((name, i) => (
                  <canvas
                    key={name}
                    ref={(el) => {
                      canvasRefs.current[i] = el;
                    }}
                    width={432}
                    height={576}
                    className="w-full aspect-[3/4] rounded-md border border-zinc-800 bg-zinc-900"
                    aria-label={name}
                  />
                ))}
              </div>
              <button
                onClick={downloadAll}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 hover:text-white text-sm font-semibold"
              >
                <Download size={15} /> Download all 4 pages (PNG)
              </button>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                They download in order, 1 to 4. Your browser may ask to allow several downloads, say yes. Then add them in that order on the{" "}
                <Link href="/magazine" className="text-fuchsia-400 underline">
                  Magazine Flip
                </Link>{" "}
                page.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Change any words you like</p>
              <Field label="Cover headline" value={copy.cover.headline} onChange={(v) => setCover({ headline: v })} />
              {[0, 1, 2].map((i) => (
                <Field key={i} label={`Cover line ${i + 1}`} value={copy.cover.lines[i]} onChange={(v) => setLine(i, v)} />
              ))}
              <div className="h-px bg-zinc-800" />
              <Field label="Page 2 small heading" value={copy.page2.kicker} onChange={(v) => setP2({ kicker: v })} />
              <Field label="Page 2 headline" value={copy.page2.headline} onChange={(v) => setP2({ headline: v })} />
              <Field label="Page 2 intro" value={copy.page2.intro} onChange={(v) => setP2({ intro: v })} rows={2} />
              <Field label="Page 2 text" value={copy.page2.body} onChange={(v) => setP2({ body: v })} rows={4} />
              <div className="h-px bg-zinc-800" />
              {([0, 1] as const).map((i) => (
                <div key={i} className="space-y-3">
                  <Field label={`Page 3 feature ${i + 1} small heading`} value={copy.page3[i].kicker} onChange={(v) => setP3(i, { kicker: v })} />
                  <Field label={`Page 3 feature ${i + 1} headline`} value={copy.page3[i].headline} onChange={(v) => setP3(i, { headline: v })} />
                  <Field label={`Page 3 feature ${i + 1} text`} value={copy.page3[i].body} onChange={(v) => setP3(i, { body: v })} rows={3} />
                </div>
              ))}
              <div className="h-px bg-zinc-800" />
              <Field label="Call to action headline" value={copy.cta.headline} onChange={(v) => setCta({ headline: v })} />
              <Field label="Call to action text" value={copy.cta.body} onChange={(v) => setCta({ body: v })} rows={3} />
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          Your photos stay in your browser. Only the clinic name and the three topics are sent off to write the words.
        </p>
      </div>
    </div>
  );
}
