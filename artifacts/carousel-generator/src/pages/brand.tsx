import { useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, X, Palette } from "lucide-react";
import { FontSwitcher } from "@/components/font-switcher";
import { getBrandDefaults, setBrandDefaults, clearBrandDefaults, compressLogoToDataUrl } from "@/lib/brand-defaults";

export default function Brand() {
  const bd = getBrandDefaults();
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(bd.logoDataUrl);
  const [primaryColor, setPrimaryColor] = useState(bd.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(bd.secondaryColor);
  const [fontFamily, setFontFamily] = useState(bd.fontFamily);
  const [subheadingFont, setSubheadingFont] = useState(bd.subheadingFont);
  const [logoError, setLogoError] = useState("");
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = async (file: File) => {
    setLogoError("");
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file (PNG, SVG, JPEG).");
      return;
    }
    try {
      const dataUrl = await compressLogoToDataUrl(file, 400);
      setLogoDataUrl(dataUrl);
    } catch {
      setLogoError("Could not load that image. Try a different file.");
    }
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  };

  const handleSave = () => {
    setBrandDefaults({ logoDataUrl, primaryColor, secondaryColor, fontFamily, subheadingFont });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    clearBrandDefaults();
    const factory = getBrandDefaults();
    setLogoDataUrl(factory.logoDataUrl);
    setPrimaryColor(factory.primaryColor);
    setSecondaryColor(factory.secondaryColor);
    setFontFamily(factory.fontFamily);
    setSubheadingFont(factory.subheadingFont);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="h-4 w-px bg-zinc-700" />
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#E91976]" />
          <span className="text-sm font-medium">Brand Settings</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Your brand defaults</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Set your logo, colours, and font once. Every generator opens with these applied.
            You can still override them per session by selecting a client preset.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Logo</h2>
          {logoDataUrl ? (
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <img src={logoDataUrl} alt="Brand logo" className="max-w-full max-h-full object-contain p-2" />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="text-xs text-zinc-300 hover:text-white underline underline-offset-2 transition-colors text-left"
                >
                  Replace logo
                </button>
                <button
                  onClick={() => setLogoDataUrl(null)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleLogoDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => logoInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl px-6 py-8 text-center cursor-pointer transition-colors group"
            >
              <Upload className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Drop your logo here, or click to browse
              </p>
              <p className="text-xs text-zinc-600 mt-1">PNG, SVG or JPEG. Max 400px wide after compression.</p>
            </div>
          )}
          {logoError && <p className="text-xs text-red-400">{logoError}</p>}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Brand Colours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Slide background</label>
              <p className="text-xs text-zinc-600">Used as the page colour in generators</p>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-600 bg-zinc-800 cursor-pointer p-0.5"
                />
                <span className="text-xs font-mono text-zinc-400 uppercase">{primaryColor}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Text colour</label>
              <p className="text-xs text-zinc-600">Used for text overlays on slides</p>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-600 bg-zinc-800 cursor-pointer p-0.5"
                />
                <span className="text-xs font-mono text-zinc-400 uppercase">{secondaryColor}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 overflow-hidden">
            <div
              className="h-20 flex items-center justify-center px-6 gap-4 transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <span
                className="text-2xl font-normal leading-tight"
                style={{ fontFamily, color: secondaryColor }}
              >
                Your Brand
              </span>
              <span
                className="text-base"
                style={{ fontFamily: subheadingFont, color: secondaryColor, opacity: 0.7 }}
              >
                Social Media Sister
              </span>
            </div>
            <p className="text-[10px] text-zinc-600 text-center py-1.5 bg-zinc-900">Preview</p>
          </div>
        </section>

        <section>
          <FontSwitcher
            headingFont={fontFamily}
            onHeadingChange={setFontFamily}
            onBodyChange={setSubheadingFont}
          />
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-[#E91976] hover:bg-[#c7155f] text-white"
            }`}
          >
            {saved ? "Saved" : "Save brand settings"}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-all"
          >
            Reset
          </button>
        </div>

        <p className="text-xs text-zinc-600 text-center -mt-6">
          Applies to Carousel, Single Image, Stories, and Photo Carousel generators.
        </p>
      </div>
    </div>
  );
}
