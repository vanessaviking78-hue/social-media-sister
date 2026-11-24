import { Sparkles } from "lucide-react";
import { SPARKLE_AMOUNT_LABELS, SPARKLE_STYLE_LABELS, type SparkleAmount, type SparkleChoice, type SparkleStyle } from "@/lib/sparkle";

// The little pickers that sit next to the Sparkle buttons: which sparkle, how much of it, and what colour.
// brand lists the client's own colours as quick swatches, when the page knows them.
export function SparkleControls({ style, amount, color, onChange, brand = [] }: { style: SparkleStyle; amount: SparkleAmount; color: string; onChange: (c: SparkleChoice) => void; brand?: string[] }) {
  const cls = "bg-white/5 border border-white/15 rounded p-1.5 text-sm";
  const swatches = Array.from(new Set(brand.filter((b) => /^#[0-9a-f]{6}$/i.test(b)).map((b) => b.toLowerCase())));
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Sparkles className="w-4 h-4 text-pink-400" />
      <select className={cls} value={style} aria-label="Sparkle style" onChange={(e) => onChange({ style: e.target.value as SparkleStyle, amount, color })}>
        {(Object.keys(SPARKLE_STYLE_LABELS) as SparkleStyle[]).map((s) => <option key={s} value={s} className="text-black">{SPARKLE_STYLE_LABELS[s]}</option>)}
      </select>
      <select className={cls} value={amount} aria-label="How much sparkle" onChange={(e) => onChange({ style, amount: e.target.value as SparkleAmount, color })}>
        {(Object.keys(SPARKLE_AMOUNT_LABELS) as SparkleAmount[]).map((a) => <option key={a} value={a} className="text-black">{SPARKLE_AMOUNT_LABELS[a]}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm" title="Pick any colour for the sparkle">
        <span className="text-white/70">Colour</span>
        <input type="color" aria-label="Sparkle colour" value={color || "#ffd978"} onChange={(e) => onChange({ style, amount, color: e.target.value.toLowerCase() })} className="h-8 w-10 rounded border border-white/20 bg-transparent cursor-pointer p-0.5" />
      </label>
      {swatches.map((b) => (
        <button key={b} type="button" aria-label={`Use ${b}`} title={`Client colour ${b}`} onClick={() => onChange({ style, amount, color: b })}
          className={`h-6 w-6 rounded-full border-2 ${color === b ? "border-white" : "border-white/30"}`} style={{ background: b }} />
      ))}
      {color && <button type="button" className="text-xs underline text-white/70" onClick={() => onChange({ style, amount, color: "" })}>Use the style's own colours</button>}
    </div>
  );
}
