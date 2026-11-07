import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUITE_FONTS, injectSuiteFontCss } from "@/lib/suite-fonts";

const BASE = import.meta.env.BASE_URL;

// FONT LAB, the one link every client gets. They type their business name, see it in each font and pick the one that feels like them.
export default function FontLabForm() {
  const [business, setBusiness] = useState("");
  const [fontId, setFontId] = useState("");
  const [upper, setUpper] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { try { injectSuiteFontCss(); } catch { /* fonts still fall back */ } }, []);
  const shown = business.trim() || "Your Clinic Name";
  const ok = business.trim().length >= 2 && !!fontId;

  const send = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}api/fontlab-form`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName: business, fontId, upper }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error || "Could not save");
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save, please try again");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <Check className="w-12 h-12 mx-auto text-pink-500" />
          <h1 className="text-3xl font-black">Lovely choice</h1>
          <p>I have saved it and your posts will start using it. Thank you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-4xl font-black">Font Lab</h1>
        <p>Type your clinic name below, then tap the font you love most. It will be used on the titles of your posts.</p>
        <input className="w-full border-2 border-black rounded-lg p-3 text-lg" placeholder="Your clinic or business name" value={business} onChange={(e) => setBusiness(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Show it in capital letters</label>
        <div className="grid sm:grid-cols-2 gap-3">
          {SUITE_FONTS.map((f) => {
            const on = fontId === f.id;
            return (
              <button key={f.id} type="button" onClick={() => setFontId(f.id)} className={`text-left rounded-xl border-2 p-4 ${on ? "border-pink-500 bg-pink-50" : "border-black/20 hover:border-black"}`}>
                <div className="text-3xl leading-tight break-words" style={{ fontFamily: `"${f.family}", serif`, textTransform: upper ? "uppercase" : "none" }}>{shown}</div>
                <div className="text-xs mt-2 text-black/50 flex items-center gap-1">{f.name}{on && <Check className="w-4 h-4 text-pink-500" />}</div>
              </button>
            );
          })}
        </div>
        <button disabled={!ok || saving} onClick={() => void send()} className="w-full rounded-lg bg-pink-500 text-white font-black py-3 text-lg disabled:opacity-40 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-5 h-5 animate-spin" />} Save my font
        </button>
      </div>
    </div>
  );
}
