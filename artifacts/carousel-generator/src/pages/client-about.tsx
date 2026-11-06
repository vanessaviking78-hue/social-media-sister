import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { usePresets } from "@/lib/use-presets";
import { useForcedClient } from "@/lib/forced-client";
import { renderAboutPost, type AboutLayout } from "@/lib/about-designs";

// ABOUT ME for a client page: the two About me templates from the free tools, filled in with the client's own photo, name and bio.
const hexOk = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export default function ClientAbout() {
  const forced = useForcedClient();
  const { presets } = usePresets();
  const preset = useMemo(() => (forced ? presets.find((p) => forced.pattern.test(p.name)) ?? null : null), [forced, presets]);
  const [layout, setLayout] = useState<AboutLayout>("cream");
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("ABOUT ME");
  const [bio, setBio] = useState("");
  const [main, setMain] = useState("#d6006f");
  const [accent, setAccent] = useState("#111111");
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preset) return;
    setName((n) => n || preset.name);
    setBio((b) => b || preset.brandNotes || "");
    if (hexOk(preset.accentColor || "")) setMain(preset.accentColor);
  }, [preset?.id]);

  useEffect(() => {
    let live = true;
    if (!preset?.clientPhotoUrl || photo) return;
    fetch(preset.clientPhotoUrl, { mode: "cors" }).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bmp) => { if (live) setPhoto(bmp); }).catch(() => undefined);
    return () => { live = false; };
  }, [preset?.clientPhotoUrl, photo]);

  useEffect(() => {
    let live = true;
    if (!photo) { setPreview(""); return; }
    renderAboutPost({ layout, photo, colours: { main, accent }, cutout: null, bio, name, headline: headline.trim() || "ABOUT ME" })
      .then((cv) => { if (!live) return; canvasRef.current = cv; setPreview(cv.toDataURL("image/jpeg", 0.8)); })
      .catch(() => toast.error("The About me post would not draw"));
    return () => { live = false; };
  }, [layout, photo, main, accent, bio, name, headline]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPhoto(await createImageBitmap(f)); } catch { toast.error("I could not read that photo"); }
  };
  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((b) => { if (b) saveAs(b, `about-me-${layout}.png`); }, "image/png");
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4 text-sm">
      <h1 className="text-xl font-semibold">About me</h1>
      <p className="text-white/60">The two About me designs from the free tools. Add her photo and her words, pick a layout and download it.{!preset && " (I cannot see her client preset yet.)"}</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            {([["cream", "Cream editorial"], ["peach", "Peach vertical"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setLayout(v)} className={`flex-1 rounded-md border px-2 py-2 ${layout === v ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{label}</button>
            ))}
          </div>
          <label className="space-y-1 block"><span className="text-white/60">Name</span><input className="w-full bg-white/5 rounded p-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="space-y-1 block"><span className="text-white/60">Heading</span><input className="w-full bg-white/5 rounded p-2" value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
          <label className="space-y-1 block"><span className="text-white/60">Her words</span><textarea className="w-full bg-white/5 rounded p-2" rows={7} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">Main <input type="color" value={main} onChange={(e) => setMain(e.target.value)} className="h-7 w-12 cursor-pointer rounded border" /></label>
            <label className="flex items-center gap-2">Accent <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-12 cursor-pointer rounded border" /></label>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><ImagePlus className="w-4 h-4 mr-2" />{photo ? "Change photo" : "Add her photo"}</Button>
            <Button size="sm" variant="secondary" disabled={!preview} onClick={download}><Download className="w-4 h-4 mr-2" />Download</Button>
          </div>
        </div>
        <div>{preview ? <img src={preview} alt="About me preview" className="w-full max-w-[460px] rounded-md border border-white/10" /> : <div className="rounded-md border border-white/10 p-10 text-center text-white/50">Add her photo to see the post</div>}</div>
      </div>
    </div>
  );
}
