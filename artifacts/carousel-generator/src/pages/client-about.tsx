import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { ColourPicker } from "@/components/colour-picker";
import { usePresets } from "@/lib/use-presets";
import { useForcedClient } from "@/lib/forced-client";
import {
  renderAboutPost, aboutDefaults, ABOUT_LAYOUTS, ABOUT_FONTS, ABOUT_DEFAULT_FONTS, aboutFontById,
  type AboutLayout, type AboutColours, type LogoPos,
} from "@/lib/about-designs";
import { isHexColour, metalOfValue } from "@/lib/metal-colours";

// ABOUT ME for a client page: five templates (cream editorial, peach vertical, pill notes, allow me to introduce, fact arrows)
// filled in with the client's own photo, logo, name, bio and facts. The facts come from the Getting to know you form.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const hexOk = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const lines = (t: string | undefined) => String(t ?? "").split(/\r?\n|;/).map((s) => s.replace(/^[\s\-•\d.)]+/, "").trim()).filter(Boolean);

type Override = Partial<Pick<AboutColours, "bg" | "head" | "text" | "box">>;

export default function ClientAbout({ adminControls = true }: { adminControls?: boolean }) {
  const forced = useForcedClient();
  const { presets } = usePresets();
  const preset = useMemo(() => (forced ? presets.find((p) => forced.pattern.test(p.name)) ?? null : null), [forced, presets]);
  const [layout, setLayout] = useState<AboutLayout>("cream");
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("ABOUT ME");
  const [bio, setBio] = useState("");
  const [factsText, setFactsText] = useState("");
  const [introText, setIntroText] = useState("");
  const [main, setMain] = useState("#d6006f");
  const [accent, setAccent] = useState("#111111");
  const [over, setOver] = useState<Override>({});
  const [fonts, setFonts] = useState<{ head?: string; body?: string }>({});
  const [logoPos, setLogoPos] = useState<LogoPos>("tr");
  const [showLogo, setShowLogo] = useState(true);
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [logo, setLogo] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // brand colours come through automatically from the client's saved preset, and can still be changed
  useEffect(() => {
    if (!preset) return;
    setName((n) => n || preset.name);
    setBio((b) => b || preset.brandNotes || "");
    if (hexOk(preset.accentColor || "")) setMain(preset.accentColor);
    if (hexOk(preset.pageColor || "")) setAccent(preset.pageColor);
    fetch(`${BASE}/api/client-profiles/${encodeURIComponent(preset.name)}`)
      .then((r) => r.json())
      .then((d: { profile?: { answers?: Record<string, string> } | null }) => {
        const a = d.profile?.answers ?? {};
        setFactsText((f) => f || lines(a.facts).join("\n"));
      })
      .catch(() => undefined);
  }, [preset?.id]);

  useEffect(() => {
    let live = true;
    if (!preset?.clientPhotoUrl || photo) return;
    fetch(preset.clientPhotoUrl, { mode: "cors" }).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bmp) => { if (live) setPhoto(bmp); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.clientPhotoUrl, photo]);

  useEffect(() => {
    let live = true;
    if (!preset?.logoUrl || logo) return;
    fetch(preset.logoUrl, { mode: "cors" }).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bmp) => { if (live) setLogo(bmp); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.logoUrl, logo]);

  const colours: AboutColours = useMemo(() => ({ main, accent, ...over }), [main, accent, over]);
  const facts = useMemo(() => lines(factsText), [factsText]);
  const def = aboutDefaults(layout, { main, accent });

  useEffect(() => {
    let live = true;
    if (!photo) { setPreview(""); return; }
    renderAboutPost({
      layout, photo, colours, cutout: null, bio, name, headline: headline.trim() || "ABOUT ME",
      logo: showLogo ? logo : null, logoPos, fonts, facts, intro: introText.trim(),
    })
      .then((cv) => { if (!live) return; canvasRef.current = cv; setPreview(cv.toDataURL("image/jpeg", 0.8)); })
      .catch(() => toast.error("The About me post would not draw"));
    return () => { live = false; };
  }, [layout, photo, logo, colours, bio, name, headline, fonts, facts, introText, logoPos, showLogo]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPhoto(await createImageBitmap(f)); } catch { toast.error("I could not read that photo"); }
  };
  const onLogo = async (f: File | undefined) => {
    if (!f) return;
    try { setLogo(await createImageBitmap(f)); } catch { toast.error("I could not read that logo"); }
  };
  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((b) => { if (b) saveAs(b, `about-me-${layout}.png`); }, "image/png");
  };

  const set = (k: keyof Override) => (v: string) => setOver((o) => ({ ...o, [k]: v }));
  const reset = (k: keyof Override) => () => setOver((o) => { const n = { ...o }; delete n[k]; return n; });
  // Change all: one pick colours the headline and the boxes together, and the writing flips to dark or white so it stays readable.
  const changeAll = (v: string) => {
    const base = isHexColour(v) ? v : metalOfValue(v)?.stops[1] ?? "#888888";
    const n = parseInt(base.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    setOver((o) => ({ ...o, head: v, box: v, text: layout === "pills" || layout === "cream" || layout === "peach" ? (lum > 0.55 ? "#1a1a1a" : "#ffffff") : o.text }));
  };
  const brand = [preset?.accentColor, preset?.pageColor].filter((c): c is string => !!c && hexOk(c));
  const usesBox = layout === "pills";
  const usesBg = layout === "cream" || layout === "peach";
  const needsFacts = ABOUT_LAYOUTS.find((l) => l.id === layout)?.needsFacts;
  const dflt = ABOUT_DEFAULT_FONTS[layout];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4 text-sm">
      <h1 className="text-xl font-semibold">About me</h1>
      <p className="text-white/60">Five About me designs. Add her photo and her words, pick a layout and download it. Brand colours and the logo come through on their own.{!preset && " (I cannot see her client preset yet.)"}</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ABOUT_LAYOUTS.map((l) => (
              <button key={l.id} type="button" onClick={() => setLayout(l.id)} className={`rounded-md border px-2 py-2 ${layout === l.id ? "border-pink-400 bg-pink-400/15" : "border-white/20 hover:border-white/50"}`}>{l.label}</button>
            ))}
          </div>
          <label className="space-y-1 block"><span className="text-white/60">Name</span><input className="w-full bg-white/5 rounded p-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="space-y-1 block"><span className="text-white/60">Heading</span><input className="w-full bg-white/5 rounded p-2" value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
          {(layout === "cream" || layout === "peach") && (
            <label className="space-y-1 block"><span className="text-white/60">Her words</span><textarea className="w-full bg-white/5 rounded p-2" rows={7} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
          )}
          {layout === "intro" && (
            <label className="space-y-1 block"><span className="text-white/60">The hello line</span><input className="w-full bg-white/5 rounded p-2" placeholder={`Hi! I'm ${name.split(" ")[0] || "..."} and this is me...`} value={introText} onChange={(e) => setIntroText(e.target.value)} /></label>
          )}
          {needsFacts && (
            <label className="space-y-1 block"><span className="text-white/60">Her facts, one per line (they come from Getting to know you)</span><textarea className="w-full bg-white/5 rounded p-2" rows={6} value={factsText} onChange={(e) => setFactsText(e.target.value)} /></label>
          )}

          <div className="rounded-lg bg-white text-black p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Colours</span>
              <button type="button" className="text-xs underline" onClick={() => { setOver({}); if (preset && hexOk(preset.accentColor || "")) setMain(preset.accentColor); if (preset && hexOk(preset.pageColor || "")) setAccent(preset.pageColor); }}>back to brand colours</button>
            </div>
            <ColourPicker label="Change all (headline and boxes)" value={over.head && over.head === over.box ? over.head : undefined} onChange={changeAll} brand={brand} />
            <ColourPicker label="Headline" value={over.head} placeholder={def.head} onChange={set("head")} onReset={reset("head")} brand={brand} />
            {usesBox && <ColourPicker label="Boxes" value={over.box} placeholder={def.box} onChange={set("box")} onReset={reset("box")} brand={brand} />}
            {usesBg && <ColourPicker label="Page" value={over.bg} placeholder={def.bg} onChange={set("bg")} onReset={reset("bg")} brand={brand} />}
            <ColourPicker label="Writing" value={over.text} placeholder={def.text} onChange={set("text")} onReset={reset("text")} brand={brand} />
            <div className="flex gap-6">
              <div className="space-y-1"><span className="font-medium">Main brand colour</span><div><input type="color" value={main} onChange={(e) => setMain(e.target.value)} className="h-7 w-12 cursor-pointer rounded border" /></div></div>
              <div className="space-y-1"><span className="font-medium">Second brand colour</span><div><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-12 cursor-pointer rounded border" /></div></div>
            </div>
          </div>

          {adminControls && (
            <div className="rounded-lg bg-white/5 p-3 space-y-2">
              <span className="font-semibold">Fonts (only I see this)</span>
              <label className="block space-y-1"><span className="text-white/60">Headline font</span>
                <select className="w-full bg-black/40 rounded p-2" value={fonts.head ?? dflt.head} onChange={(e) => setFonts((f) => ({ ...f, head: e.target.value }))}>
                  {["Google fonts", "Your fonts"].map((grp) => <optgroup key={grp} label={grp}>{ABOUT_FONTS.filter((f) => f.group === grp).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
                </select>
              </label>
              <label className="block space-y-1"><span className="text-white/60">Subtitle and writing font</span>
                <select className="w-full bg-black/40 rounded p-2" value={fonts.body ?? dflt.body} onChange={(e) => setFonts((f) => ({ ...f, body: e.target.value }))}>
                  {["Google fonts", "Your fonts"].map((grp) => <optgroup key={grp} label={grp}>{ABOUT_FONTS.filter((f) => f.group === grp).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
                </select>
              </label>
              <p className="text-xs text-white/40">Using {aboutFontById(fonts.head, dflt.head).label} and {aboutFontById(fonts.body, dflt.body).label}.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <input ref={logoRef} type="file" accept="image/png,image/*" className="hidden" onChange={(e) => { void onLogo(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-2" />{photo ? "Change photo" : "Add her photo"}</Button>
            <Button size="sm" variant="secondary" onClick={() => logoRef.current?.click()}><ImagePlus className="w-4 h-4 mr-2" />{logo ? "Change logo" : "Add logo"}</Button>
            <label className="flex items-center gap-1.5 text-white/70"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />Show logo</label>
            <select className="bg-black/40 rounded p-1.5 text-xs" value={logoPos} onChange={(e) => setLogoPos(e.target.value as LogoPos)}>
              <option value="tr">Top right</option><option value="tl">Top left</option><option value="br">Bottom right</option><option value="bl">Bottom left</option>
            </select>
            <Button size="sm" variant="secondary" disabled={!preview} onClick={download}><Download className="w-4 h-4 mr-2" />Download</Button>
          </div>
        </div>
        <div>{preview ? <img src={preview} alt="About me preview" className="w-full max-w-[460px] rounded-md border border-white/10" /> : <div className="rounded-md border border-white/10 p-10 text-center text-white/50">Add her photo to see the post</div>}</div>
      </div>
    </div>
  );
}
