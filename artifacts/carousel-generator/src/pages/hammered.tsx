import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { HAMMERED_HOOKS, HAMMERED_HOOK_GROUPS, type HammeredHook } from "@/lib/hammered-hooks";
import { HAMMERED_COPY } from "@/lib/hammered-copy";
import { HAMMERED_FONTS } from "@/lib/tenfree-fonts";
import { injectSuiteFontCss } from "@/lib/suite-fonts";
import { usePresets } from "@/lib/use-presets";
import { POST_TIME } from "@/lib/schedule";
import { drawHammeredSlide, HAMMERED_YELLOW, type HammeredStyle, type SlideKind, type SlideLook } from "@/lib/hammered-render";

// cybersuite.com/hammeredposts : the Hammered tool, for the Hammered page and every Hammered client.
// One layout only: a full bleed photo with the writing on a gradient, in a text box or on a block.
// Every post is a 3 slide carousel: the hook, the body, then a strong and cheeky closing line.

const INK = "#111111";
const KINDS: SlideKind[] = ["hook", "body", "cta"];
const KIND_LABEL: Record<SlideKind, string> = { hook: "Slide 1: the hook", body: "Slide 2: the body", cta: "Slide 3: the closing line" };
const STYLE_LABEL: Record<HammeredStyle, string> = { gradient: "Gradient", box: "Text box", block: "Block" };
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const noDashes = (t: string) => (t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",");
const uid = () => Math.random().toString(36).slice(2, 10);

type Photo = { id: string; name: string; url: string; bmp: ImageBitmap };
type Override = Partial<Pick<SlideLook, "style" | "colour" | "textColour" | "upper" | "textScale" | "boxY" | "headFamily">>;
type Post = {
  id: string;
  code: string;
  label: string;
  texts: [string, string, string];
  photo: (number | null)[]; // null means pick for me
  zoom: number[];
  panX: number[];
  panY: number[];
  override: Override;
  caption: string;
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');
.hm { background:#fff; color:${INK}; min-height:100vh; font-family:'Montserrat',sans-serif; }
.hm h1::after { background:${HAMMERED_YELLOW} !important; }
.hm * { box-sizing:border-box; }
.hm h1, .hm h2 { font-weight:800; text-transform:uppercase; letter-spacing:-.01em; margin:0; }
.hm-wrap { max-width:1280px; margin:0 auto; padding:28px 22px 80px; }
.hm-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding-bottom:18px; border-bottom:3px solid ${INK}; margin-bottom:22px; }
.hm-tag { background:${HAMMERED_YELLOW}; color:${INK}; padding:3px 10px; font-weight:800; font-size:12px; letter-spacing:.25em; text-transform:uppercase; display:inline-block; }
.hm-grid { display:grid; grid-template-columns:340px 1fr; gap:26px; align-items:start; }
@media (max-width:900px){ .hm-grid { grid-template-columns:1fr; } }
.hm-side { position:sticky; top:12px; display:flex; flex-direction:column; gap:18px; max-height:calc(100vh - 24px); overflow:auto; padding-right:6px; }
@media (max-width:900px){ .hm-side { position:static; max-height:none; } }
.hm-box { border:2px solid ${INK}; padding:14px; }
.hm-box h3 { font-size:12px; letter-spacing:.2em; text-transform:uppercase; font-weight:800; margin:0 0 10px; background:${HAMMERED_YELLOW}; display:inline-block; padding:2px 8px; }
.hm label.l { display:block; font-size:11px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; margin:10px 0 4px; }
.hm input[type=text], .hm input[type=datetime-local], .hm textarea, .hm select { width:100%; border:2px solid ${INK}; padding:8px 10px; font:inherit; font-size:14px; background:#fff; color:${INK}; border-radius:0; }
.hm textarea { resize:vertical; line-height:1.35; }
.hm button.b { border:2px solid ${INK}; background:#fff; color:${INK}; padding:7px 12px; font:inherit; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
.hm button.b:hover { background:#fffbe0; }
.hm button.b.on { background:${HAMMERED_YELLOW}; }
.hm button.b.go { background:${HAMMERED_YELLOW}; box-shadow:4px 4px 0 ${INK}; }
.hm button.b:disabled { opacity:.4; cursor:default; }
.hm-row { display:flex; gap:6px; flex-wrap:wrap; }
.hm-hook { display:flex; gap:8px; align-items:flex-start; padding:8px 0; border-bottom:1px solid #e5e5e5; font-size:13px; line-height:1.3; }
.hm-hook.used { opacity:.4; text-decoration:line-through; }
.hm-card { border:2px solid ${INK}; padding:14px; margin-bottom:22px; }
.hm-prev { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.hm-prev canvas { width:100%; height:auto; display:block; border:1px solid #ccc; }
.hm-sw { width:34px; height:30px; border:2px solid ${INK}; padding:0; cursor:pointer; background:none; }
.hm input[type=range] { width:100%; accent-color:${INK}; }
.hm-small { font-size:11px; color:#666; }
`;

function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
}

export default function HammeredPage() {
  const [clientName, setClientName] = useState("Hammered");
  const [handle, setHandle] = useState("");
  const [logo, setLogo] = useState<ImageBitmap | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [look, setLook] = useState<Omit<SlideLook, "bodyFamily">>({ style: "gradient", colour: "#000000", textColour: "hivis", headFamily: "SuiteAnton", upper: false, textScale: 1, boxY: 1 });
  const [fontId, setFontId] = useState("anton");
  const [posts, setPosts] = useState<Post[]>([]);
  const [group, setGroup] = useState(HAMMERED_HOOK_GROUPS[0].group);
  const [fontTick, setFontTick] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { injectSuiteFontCss(); }, []);
  // The signed in site flips every colour to build its white theme, which turns yellow lime and brown. Hammered is drawn in true colours, so switch the flip off here (same switch the hub uses).
  useEffect(() => {
    document.documentElement.classList.add("cs-hub");
    return () => document.documentElement.classList.remove("cs-hub");
  }, []);

  // Fonts must be ready before the canvas draws with them, so load the picked one and redraw when it lands.
  useEffect(() => {
    const fams = new Set<string>([look.headFamily, ...posts.map((p) => p.override.headFamily).filter(Boolean) as string[]]);
    let live = true;
    Promise.all([...[...fams].map((f) => document.fonts.load(`40px "${f}"`)), document.fonts.load('600 40px "Montserrat"')])
      .catch(() => undefined)
      .then(() => live && setFontTick((n) => n + 1));
    return () => { live = false; };
  }, [look.headFamily, posts]);

  const usedCodes = useMemo(() => new Set(posts.map((p) => p.code)), [posts]);

  const addPosts = useCallback((hooks: HammeredHook[]) => {
    setPosts((cur) => {
      const have = new Set(cur.map((p) => p.code));
      const fresh = hooks.filter((h) => !have.has(h.code)).map<Post>((h) => {
        const c = HAMMERED_COPY[h.code] ?? { body: "", cta: "" };
        return { id: uid(), code: h.code, label: h.code, texts: [h.text, c.body, c.cta], photo: [null, null, null], zoom: [1, 1, 1], panX: [0, 0, 0], panY: [0, 0, 0], override: {}, caption: "" };
      });
      return [...cur, ...fresh];
    });
  }, []);

  const addBlank = () => setPosts((cur) => [...cur, { id: uid(), code: `X${cur.length + 1}`, label: "My own", texts: ["", "", ""], photo: [null, null, null], zoom: [1, 1, 1], panX: [0, 0, 0], panY: [0, 0, 0], override: {}, caption: "" }]);
  const patch = (id: string, fn: (p: Post) => Post) => setPosts((cur) => cur.map((p) => (p.id === id ? fn(p) : p)));

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    const added: Photo[] = [];
    for (const f of Array.from(files)) {
      try { added.push({ id: uid(), name: f.name, url: URL.createObjectURL(f), bmp: await loadBitmap(f) }); } catch { toast.error(`I could not read ${f.name}`); }
    }
    setPhotos((cur) => [...cur, ...added]);
    if (photoRef.current) photoRef.current.value = "";
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    try { setLogo(await loadBitmap(file)); } catch { toast.error("I could not read that logo. A PNG with a see through background is best."); }
  }

  const lookFor = (p: Post): SlideLook => ({ ...look, ...p.override, bodyFamily: "Montserrat" });

  /** The photo for a slide: the one she picked, or one chosen for her in turn so the posts do not all match. */
  const photoFor = (p: Post, i: number, order: number) => {
    if (!photos.length) return { bmp: null, zoom: p.zoom[i], panX: p.panX[i], panY: p.panY[i] };
    const idx = p.photo[i] ?? (order * 3 + i) % photos.length;
    return { bmp: photos[idx % photos.length]?.bmp ?? null, zoom: p.zoom[i], panX: p.panX[i], panY: p.panY[i] };
  };

  const paint = useCallback((canvas: HTMLCanvasElement, p: Post, i: number, order: number) => {
    drawHammeredSlide(canvas, KINDS[i], p.texts[i], photoFor(p, i, order), lookFor(p), logo, handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, look, logo, handle, fontTick]);

  async function downloadPosts(list: Post[], zipName: string) {
    if (!list.length) return;
    const zip = new JSZip();
    for (const p of list) {
      const order = posts.indexOf(p);
      for (let i = 0; i < 3; i++) {
        const c = document.createElement("canvas");
        paint(c, p, i, order);
        const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b as Blob), "image/png"));
        zip.file(`hammered-${p.code}-slide${i + 1}.png`, blob);
      }
      if (p.caption.trim()) zip.file(`hammered-${p.code}-caption.txt`, p.caption);
    }
    saveAs(await zip.generateAsync({ type: "blob" }), `${zipName}.zip`);
  }

  // The Hammered client preset is the page the posts go out on.
  const { presets } = usePresets();
  const hammeredPreset = presets.find((x) => /hammered/i.test(x.name));

  /** Draws the three slides, uploads them and queues the post for the Hammered page at the time she picked. */
  async function scheduleToHammered(p: Post, whenLocal: string): Promise<void> {
    if (!hammeredPreset) throw new Error("I cannot find the Hammered client. Add a client called Hammered first.");
    if (!photos.length) throw new Error("Add your photos first so the slides are not blank.");
    if (!p.caption.trim()) throw new Error("Press Write it first so the post has a caption.");
    const when = new Date(whenLocal);
    if (!whenLocal || isNaN(when.getTime())) throw new Error("Pick a date and time first.");
    if (when.getTime() < Date.now() + 60_000) throw new Error("Pick a time in the future.");
    const order = posts.indexOf(p);
    const images: { name: string; base64: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const c = document.createElement("canvas");
      paint(c, p, i, order);
      images.push({ name: `hammered-${p.code}-${Date.now()}-slide${i + 1}.jpg`, base64: c.toDataURL("image/jpeg", 0.9) });
    }
    const up = await fetch(`${BASE}/api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    if (!up.ok) throw new Error("The slides did not upload. Try again.");
    const upData = await up.json().catch(() => ({}));
    const imageUrls: string[] = (upData.results || []).map((x: { url: string }) => x.url);
    if (imageUrls.length !== 3) throw new Error("The slides did not upload. Try again.");
    const r = await fetch(`${BASE}/api/scheduler/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presetId: hammeredPreset.id,
        postType: "carousel",
        content: { imageUrls, caption: p.caption, title: p.texts[0].slice(0, 80), platforms: ["instagram", "facebook"], sourceTool: "Hammered" },
        scheduledAt: when.toISOString(),
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Scheduling failed" }));
      throw new Error(err.error || "Scheduling failed");
    }
  }

  const groupHooks = HAMMERED_HOOKS.filter((h) => h.group === group);

  return (
    <div className="hm">
      <style>{CSS}</style>
      <div className="hm-wrap">
        <div className="hm-bar">
          <div>
            <span className="hm-tag">Hammered</span>
            <h1 style={{ fontSize: 34, marginTop: 8 }}>Make a 3 slide post</h1>
            <div className="hm-small">Hook, body, then a closing line that gets them to act. One photo layout, three ways to dress it.</div>
          </div>
          <div className="hm-row">
            <Link href="/hammered"><button className="b">Back to Hammered</button></Link>
            <button className="b go" disabled={!posts.length} onClick={() => downloadPosts(posts, `hammered-${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "posts"}`)}>Download all {posts.length ? `(${posts.length})` : ""}</button>
          </div>
        </div>

        <div className="hm-grid">
          <div className="hm-side">
            <div className="hm-box">
              <h3>Who is it for</h3>
              <label className="l">Name</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <label className="l">Instagram handle (shows on the last slide)</label>
              <input type="text" placeholder="hammered" value={handle} onChange={(e) => setHandle(e.target.value)} />
              <label className="l">Logo (a see through PNG works best)</label>
              <div className="hm-row">
                <button className="b" onClick={() => logoRef.current?.click()}>{logo ? "Change logo" : "Add logo"}</button>
                {logo && <button className="b" onClick={() => setLogo(null)}>Remove</button>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
            </div>

            <div className="hm-box">
              <h3>Photos</h3>
              <div className="hm-small" style={{ marginBottom: 8 }}>Full bleed photos. Add a pile and I spread them across the posts, or pick one for any slide.</div>
              <button className="b" onClick={() => photoRef.current?.click()}>Add photos</button>
              <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
              {photos.length > 0 && (
                <div className="hm-row" style={{ marginTop: 10 }}>
                  {photos.map((p, i) => (
                    <div key={p.id} style={{ position: "relative" }}>
                      <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", border: `2px solid ${INK}` }} />
                      <span style={{ position: "absolute", left: 2, bottom: 2, background: HAMMERED_YELLOW, fontSize: 10, fontWeight: 800, padding: "0 4px" }}>{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hm-box">
              <h3>Look for every post</h3>
              <StyleControls look={look} onChange={(o) => setLook((l) => ({ ...l, ...o }))} />
              <label className="l">Headline font</label>
              <select value={fontId} onChange={(e) => { const f = HAMMERED_FONTS.find((x) => x.id === e.target.value)!; setFontId(f.id); setLook((l) => ({ ...l, headFamily: f.family })); }}>
                {HAMMERED_FONTS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <div style={{ fontFamily: `"${look.headFamily}", sans-serif`, fontSize: 28, marginTop: 8, lineHeight: 1.1 }}>Quote by Friday</div>
            </div>

            <div className="hm-box">
              <h3>The hooks</h3>
              <div className="hm-row" style={{ marginBottom: 8 }}>
                {HAMMERED_HOOK_GROUPS.map((g) => (
                  <button key={g.group} className={`b ${group === g.group ? "on" : ""}`} onClick={() => setGroup(g.group)}>{g.group}</button>
                ))}
              </div>
              <button className="b go" onClick={() => addPosts(groupHooks)}>Make all {groupHooks.length} in this group</button>
              {groupHooks.map((h) => (
                <div key={h.code} className={`hm-hook ${usedCodes.has(h.code) ? "used" : ""}`}>
                  <button className="b" disabled={usedCodes.has(h.code)} onClick={() => addPosts([h])}>Add</button>
                  <span>{h.text}</span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}><button className="b" onClick={addBlank}>Start a blank post</button></div>
            </div>
          </div>

          <div>
            {!posts.length && (
              <div className="hm-box" style={{ padding: 30 }}>
                <h2 style={{ fontSize: 24 }}>Pick a hook to start</h2>
                <p style={{ marginTop: 10, lineHeight: 1.5 }}>Choose a hook on the left and I build the three slides: the hook, a body of three friendly sentences and a cheeky closing line. Every word can be changed.</p>
              </div>
            )}
            {posts.map((p, order) => (
              <PostCard
                key={p.id}
                post={p}
                order={order}
                photos={photos}
                look={lookFor(p)}
                paint={paint}
                tick={fontTick}
                handle={handle}
                onSchedule={(when) => scheduleToHammered(p, when)}
                onPatch={(fn) => patch(p.id, fn)}
                onRemove={() => setPosts((cur) => cur.filter((x) => x.id !== p.id))}
                onDownload={() => downloadPosts([p], `hammered-${p.code}`)}
                onApplyAll={() => setPosts((cur) => cur.map((x) => ({ ...x, override: { ...x.override, ...p.override } })))}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleControls({ look, onChange }: { look: Omit<SlideLook, "bodyFamily"> | SlideLook; onChange: (o: Override) => void }) {
  // warm construction yellows first so bright yellow never drifts to lemon
  const swatches = ["#000000", HAMMERED_YELLOW, "#ffc400", "#ffb000", "#ffffff", "#1d3557", "#c1121f"];
  return (
    <div>
      <label className="l">Layout</label>
      <div className="hm-row">
        {(Object.keys(STYLE_LABEL) as HammeredStyle[]).map((s) => (
          <button key={s} className={`b ${look.style === s ? "on" : ""}`} onClick={() => onChange({ style: s, colour: s === "gradient" ? "#000000" : HAMMERED_YELLOW })}>{STYLE_LABEL[s]}</button>
        ))}
      </div>
      <label className="l">{look.style === "gradient" ? "Gradient colour" : look.style === "box" ? "Box colour" : "Block colour"}</label>
      <div className="hm-row" style={{ alignItems: "center" }}>
        {swatches.map((c) => <button key={c} className="hm-sw" aria-label={c} style={{ background: c, outline: look.colour === c ? `3px solid ${HAMMERED_YELLOW}` : "none" }} onClick={() => onChange({ colour: c })} />)}
        <input type="color" className="hm-sw" value={look.colour} onChange={(e) => onChange({ colour: e.target.value })} aria-label="Pick any colour" />
      </div>
      <label className="l">Writing colour</label>
      <div className="hm-row">
        {(["hivis", "auto", "white", "black"] as const).map((t) => <button key={t} className={`b ${look.textColour === t ? "on" : ""}`} onClick={() => onChange({ textColour: t })}>{t === "hivis" ? "hi-vis yellow" : t}</button>)}
        <button className={`b ${look.upper ? "on" : ""}`} onClick={() => onChange({ upper: !look.upper })}>CAPITALS</button>
      </div>
      <label className="l">Text size {Math.round(look.textScale * 100)}%</label>
      <input type="range" min={60} max={150} value={Math.round(look.textScale * 100)} onChange={(e) => onChange({ textScale: Number(e.target.value) / 100 })} />
      {look.style === "box" && (
        <>
          <label className="l">Box position</label>
          <input type="range" min={0} max={100} value={Math.round(look.boxY * 100)} onChange={(e) => onChange({ boxY: Number(e.target.value) / 100 })} />
        </>
      )}
    </div>
  );
}

function PostCard(props: {
  post: Post; order: number; photos: Photo[]; look: SlideLook; tick: number; handle: string; onSchedule: (whenLocal: string) => Promise<void>;
  paint: (c: HTMLCanvasElement, p: Post, i: number, order: number) => void;
  onPatch: (fn: (p: Post) => Post) => void; onRemove: () => void; onDownload: () => void; onApplyAll: () => void;
}) {
  const { post, order, photos, look, paint, tick, onPatch } = props;
  const refs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const [slide, setSlide] = useState(0);
  const [showLook, setShowLook] = useState(false);
  const [writing, setWriting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  // Next posting slot at the usual time: tomorrow at 19:45 unless she picks another.
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${POST_TIME}`;
  });
  const scheduleIt = async () => {
    setScheduling(true);
    try {
      await props.onSchedule(when);
      const label = new Date(when).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      setScheduledFor(label);
      toast.success(`Scheduled to Hammered for ${label}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scheduling failed. Try again.");
    } finally {
      setScheduling(false);
    }
  };

  const writeIt = async () => {
    if (!post.texts[0].trim()) { toast.error("Add the hook first so I know what the post is about"); return; }
    setWriting(true);
    try {
      const res = await fetch(`${BASE}/api/hammered-captions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: post.texts[0], body: post.texts[1], cta: post.texts[2], handle: props.handle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.caption) throw new Error(data.error || "The caption did not come through");
      onPatch((p) => ({ ...p, caption: noDashes(String(data.caption)) }));
      toast.success("Caption written. Have a read, you can change any of it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The caption did not come through. Press Write it again.");
    } finally {
      setWriting(false);
    }
  };

  useEffect(() => {
    refs.forEach((r, i) => r.current && paint(r.current, post, i, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, order, photos, look, tick, paint]);

  const setText = (i: number, v: string) => onPatch((p) => { const t = [...p.texts] as [string, string, string]; t[i] = noDashes(v); return { ...p, texts: t }; });
  const setArr = (key: "zoom" | "panX" | "panY", i: number, v: number) => onPatch((p) => { const a = [...p[key]]; a[i] = v; return { ...p, [key]: a }; });
  const setPhoto = (i: number, v: number | null) => onPatch((p) => { const a = [...p.photo]; a[i] = v; return { ...p, photo: a }; });

  return (
    <div className="hm-card">
      <div className="hm-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="hm-tag">{post.code}</span>
        <div className="hm-row">
          <button className="b" onClick={() => setShowLook((s) => !s)}>{showLook ? "Hide look" : "Change look"}</button>
          <button className="b go" onClick={props.onDownload}>Download 3 slides</button>
          <button className="b" onClick={props.onRemove}>Delete</button>
        </div>
      </div>

      <div className="hm-prev">{refs.map((r, i) => <canvas key={i} ref={r} onClick={() => setSlide(i)} style={{ outline: slide === i ? `3px solid ${HAMMERED_YELLOW}` : "none", cursor: "pointer" }} />)}</div>

      {showLook && (
        <div className="hm-box" style={{ marginTop: 12 }}>
          <StyleControls look={look} onChange={(o) => onPatch((p) => ({ ...p, override: { ...p.override, ...o } }))} />
          <div className="hm-row" style={{ marginTop: 10 }}>
            <button className="b" onClick={() => onPatch((p) => ({ ...p, override: {} }))}>Back to the page look</button>
            <button className="b" onClick={props.onApplyAll}>Use this look on every post</button>
          </div>
        </div>
      )}

      <div className="hm-row" style={{ margin: "14px 0 6px" }}>
        {KINDS.map((k, i) => <button key={k} className={`b ${slide === i ? "on" : ""}`} onClick={() => setSlide(i)}>{KIND_LABEL[k]}</button>)}
      </div>
      <textarea rows={slide === 1 ? 5 : 3} value={post.texts[slide]} onChange={(e) => setText(slide, e.target.value)} />

      <div className="hm-box" style={{ marginTop: 14 }}>
        <div className="hm-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Caption</h3>
          <div className="hm-row">
            <button className="b go" disabled={writing} onClick={writeIt}>{writing ? "Writing..." : post.caption ? "Rewrite it" : "Write it"}</button>
            <button className="b" disabled={!post.caption.trim()} onClick={() => { navigator.clipboard.writeText(post.caption).then(() => toast.success("Caption copied"), () => toast.error("I could not copy that")); }}>Copy</button>
          </div>
        </div>
        <textarea rows={7} value={post.caption} onChange={(e) => onPatch((p) => ({ ...p, caption: noDashes(e.target.value) }))} placeholder="Press Write it, or write your own here." />
        <div className="hm-row" style={{ marginTop: 10, alignItems: "center" }}>
          <input type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); setScheduledFor(""); }} style={{ width: "auto" }} aria-label="When to post" />
          <button className="b go" disabled={scheduling} onClick={scheduleIt}>{scheduling ? "Scheduling..." : "Schedule to Hammered"}</button>
        </div>
        {scheduledFor && <div className="hm-small" style={{ marginTop: 6 }}>Scheduled for {scheduledFor}. Change the time and press again to add another.</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
        <div>
          <label className="l">Photo</label>
          <select value={post.photo[slide] ?? "auto"} onChange={(e) => setPhoto(slide, e.target.value === "auto" ? null : Number(e.target.value))}>
            <option value="auto">Pick for me</option>
            {photos.map((p, i) => <option key={p.id} value={i}>Photo {i + 1}</option>)}
          </select>
        </div>
        <div><label className="l">Zoom</label><input type="range" min={100} max={250} value={Math.round(post.zoom[slide] * 100)} onChange={(e) => setArr("zoom", slide, Number(e.target.value) / 100)} /></div>
        <div><label className="l">Left and right</label><input type="range" min={-100} max={100} value={Math.round(post.panX[slide] * 100)} onChange={(e) => setArr("panX", slide, Number(e.target.value) / 100)} /></div>
        <div><label className="l">Up and down</label><input type="range" min={-100} max={100} value={Math.round(post.panY[slide] * 100)} onChange={(e) => setArr("panY", slide, Number(e.target.value) / 100)} /></div>
      </div>
    </div>
  );
}
