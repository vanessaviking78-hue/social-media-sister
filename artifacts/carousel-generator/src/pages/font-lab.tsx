import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";
import {
  DEFAULT_TITLE_STYLE,
  SUITE_FONTS,
  drawGlyphTo,
  drawTitle,
  fontById,
  injectSuiteFontCss,
  layoutTitle,
  loadSuiteFont,
  clearClientStyle,
  clientSlug,
  hasClientStyle,
  readTitleStyle,
  saveTitleStyle,
  titleHeight,
  type LoadedFont,
  type SwapRate,
  type TitleStyle,
} from "@/lib/suite-fonts";

// FONT LAB. Pick a font, space it out, and choose the occasional curly letters.
// Whatever is saved here is what the Ryder titles use, drawn the same way, so what you see is what you get.

const SAMPLE = "Shilpa Mistry\nThe Ryder Clinic";
const RATES: { id: SwapRate; label: string; hint: string }[] = [
  { id: "off", label: "None", hint: "Plain letters only" },
  { id: "starts", label: "First letter of a word", hint: "Curly capitals and word starts" },
  { id: "some", label: "Occasional", hint: "Roughly one in three" },
  { id: "all", label: "Every one", hint: "Every letter you picked" },
];

function Glyph({ lf, name, active, onClick }: { lf: LoadedFont; name: string; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = lf.byName.get(name);
    if (c && g) drawGlyphTo(c, lf, g, "#ffffff");
  }, [lf, name]);
  return (
    <button
      onClick={onClick}
      title={name}
      className={`rounded-md border w-14 h-16 flex items-center justify-center ${active ? "border-emerald-400 bg-emerald-400/15" : "border-white/15 hover:border-white/40"}`}
    >
      <canvas ref={ref} width={112} height={128} style={{ width: 44, height: 50 }} />
    </button>
  );
}

export default function FontLabPage() {
  const { presets } = usePresets();
  const [client, setClient] = useState<string>(""); // "" means everyone
  const [style, setStyle] = useState<TitleStyle>(() => readTitleStyle());
  const pickClient = (slug: string) => {
    setClient(slug);
    setSaved(false);
    setStyle(readTitleStyle(slug || undefined));
  };
  const clientList = useMemo(() => [...presets].sort((a, b) => a.name.localeCompare(b.name)), [presets]);
  const [text, setText] = useState(SAMPLE);
  const [size, setSize] = useState(110);
  const [lf, setLf] = useState<LoadedFont | null>(null);
  const [saved, setSaved] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const [bg, setBg] = useState<"white" | "dark">("white");

  useEffect(() => {
    injectSuiteFontCss();
  }, []);

  useEffect(() => {
    let live = true;
    loadSuiteFont(style.fontId)
      .then((f) => live && setLf(f))
      .catch(() => toast.error("That font would not load"));
    return () => {
      live = false;
    };
  }, [style.fontId]);

  useEffect(() => {
    const c = preview.current;
    if (!c || !lf) return;
    const W = 1080;
    const layout = layoutTitle(lf, text, style, size, W - 120, 1.2);
    const H = Math.max(360, Math.round(titleHeight(layout) + 160));
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bg === "white" ? "#ffffff" : "#161616";
    ctx.fillRect(0, 0, W, H);
    drawTitle(ctx, lf, layout, style, 60, 80, "left", W - 120, bg === "white" ? "#1b1b1b" : "#ffffff");
  }, [lf, style, text, size, bg]);

  const patch = (p: Partial<TitleStyle>) => {
    setSaved(false);
    setStyle((s) => ({ ...s, ...p }));
  };

  // the letters in the sample that have curly alternatives in this font
  const letters = useMemo(() => {
    if (!lf) return [] as string[];
    const seen = new Set<string>();
    for (const ch of Array.from(text)) if (lf.data.chars[ch]) seen.add(ch);
    return Array.from(seen);
  }, [lf, text]);

  const allLetters = useMemo(() => (lf ? Object.keys(lf.data.chars).sort() : []), [lf]);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? allLetters : letters;

  const chooseSwap = (ch: string, glyphName: string | null) => {
    const swaps = { ...style.swaps };
    if (!glyphName || swaps[ch] === glyphName) delete swaps[ch];
    else swaps[ch] = glyphName;
    patch({ swaps, rate: style.rate === "off" && glyphName ? "some" : style.rate });
  };

  const save = () => {
    saveTitleStyle(style, client || undefined);
    setSaved(true);
    const who = client ? clientList.find((p) => clientSlug(p.name) === client)?.name || "this client" : "every client without their own look";
    toast.success(`Saved for ${who}.`);
  };

  const font = fontById(style.fontId);

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-3xl">Font Lab</h1>
            <p className="text-white/60 text-sm">Pick a font, space it out wide and choose the occasional curly letters. The preview is drawn the same way as the posts. Choose a client below to give them their own look.</p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 p-4 space-y-2">
          <h2 className="font-semibold">Who is this for?</h2>
          <select value={client} onChange={(e) => pickClient(e.target.value)} className="w-full md:w-96 bg-white/5 border border-white/15 rounded-md p-2">
            <option value="" className="text-black">Everyone (the default look)</option>
            {clientList.map((p) => (
              <option key={p.id} value={clientSlug(p.name)} className="text-black">{p.name}{hasClientStyle(clientSlug(p.name)) ? "  (has own look)" : ""}</option>
            ))}
          </select>
          <p className="text-white/50 text-xs">Each client can have their own title look. A client without one uses the "Everyone" look.</p>
          {client && hasClientStyle(client) && (
            <button className="text-xs underline text-white/60" onClick={() => { clearClientStyle(client); pickClient(client); toast.success("That client now uses the Everyone look"); }}>Remove this client's own look</button>
          )}
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-3">
          <h2 className="font-semibold">1. Choose a font</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {SUITE_FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => patch({ fontId: f.id, swaps: f.id === style.fontId ? style.swaps : {} })}
                className={`text-left rounded-lg border px-3 py-2 ${style.fontId === f.id ? "border-emerald-400 bg-emerald-400/10" : "border-white/15 hover:border-white/40"}`}
              >
                <div className="text-2xl leading-tight truncate" style={{ fontFamily: `"${f.family}", serif`, letterSpacing: "0.06em" }}>Shilpa Mistry</div>
                <div className="text-xs text-white/50">{f.name}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">2. Preview</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1 block">
              <span className="text-white/60">Type your own title</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-md bg-white/5 border border-white/15 p-2" />
            </label>
            <div className="space-y-3">
              <label className="text-sm block">
                <span className="text-white/60">Letter spacing: {style.tracking}</span>
                <input type="range" min={-20} max={400} step={5} value={style.tracking} onChange={(e) => patch({ tracking: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="text-sm block">
                <span className="text-white/60">Size: {size}</span>
                <input type="range" min={50} max={200} step={2} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
              </label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={style.upper} onChange={(e) => patch({ upper: e.target.checked })} /> Capitals</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={style.ligatures} onChange={(e) => patch({ ligatures: e.target.checked })} /> Joined letters (ligatures)</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={bg === "dark"} onChange={(e) => setBg(e.target.checked ? "dark" : "white")} /> Dark background</label>
              </div>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden border border-white/10">
            <canvas ref={preview} className="w-full block" />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="font-semibold">3. Curly and attached letters</h2>
          {lf && Object.keys(lf.data.chars).length === 0 ? (
            <p className="text-white/60 text-sm">{font.name} has no alternate letters. Try the joined letters tick box above, or pick another font.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-white/60">How often should they appear?</span>
                {RATES.map((r) => (
                  <button
                    key={r.id}
                    title={r.hint}
                    onClick={() => patch({ rate: r.id })}
                    className={`rounded-full border px-3 py-1 ${style.rate === r.id ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}
                  >
                    {r.label}
                  </button>
                ))}
                <label className="flex items-center gap-2 ml-auto text-white/60"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show every letter in this font</label>
              </div>
              <p className="text-white/50 text-xs">Tap an alternate to use it for that letter. Tap it again to switch it off. The plain letter is the first one in each row.</p>
              <div className="space-y-2">
                {lf && shown.length === 0 && <p className="text-white/50 text-sm">None of the letters in your title have alternates in this font. Tick "Show every letter" to see them all.</p>}
                {lf &&
                  shown.map((ch) => {
                    const base = lf.data.chars[ch];
                    const alts = lf.data.alts[base] || [];
                    return (
                      <div key={ch} className="flex flex-wrap items-center gap-2">
                        <div className="w-8 text-center text-white/60 text-lg">{ch}</div>
                        <Glyph lf={lf} name={base} active={!style.swaps[ch]} onClick={() => chooseSwap(ch, null)} />
                        {alts.map((a) => (
                          <Glyph key={a} lf={lf} name={a} active={style.swaps[ch] === a} onClick={() => chooseSwap(ch, a)} />
                        ))}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3 sticky bottom-4">
          <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-400 text-black">
            {saved ? <Check className="w-4 h-4 mr-2" /> : null}Save this look{client ? " for this client" : " for everyone"}
          </Button>
          <Button variant="outline" onClick={() => { setStyle({ ...DEFAULT_TITLE_STYLE }); setSaved(false); }}>Start again</Button>
          <span className="text-white/50 text-sm">{font.name}, spacing {style.tracking}</span>
        </div>
      </div>
    </div>
  );
}
