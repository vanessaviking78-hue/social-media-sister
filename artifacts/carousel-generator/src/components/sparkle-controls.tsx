import { Sparkles } from "lucide-react";
import { SPARKLE_AMOUNT_LABELS, SPARKLE_STYLE_LABELS, type SparkleAmount, type SparkleStyle } from "@/lib/sparkle";

// The two little pickers that sit next to the Sparkle buttons: which sparkle, and how much of it.
export function SparkleControls({ style, amount, onChange }: { style: SparkleStyle; amount: SparkleAmount; onChange: (c: { style: SparkleStyle; amount: SparkleAmount }) => void }) {
  const cls = "bg-white/5 border border-white/15 rounded p-1.5 text-sm";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Sparkles className="w-4 h-4 text-pink-400" />
      <select className={cls} value={style} aria-label="Sparkle style" onChange={(e) => onChange({ style: e.target.value as SparkleStyle, amount })}>
        {(Object.keys(SPARKLE_STYLE_LABELS) as SparkleStyle[]).map((s) => <option key={s} value={s} className="text-black">{SPARKLE_STYLE_LABELS[s]}</option>)}
      </select>
      <select className={cls} value={amount} aria-label="How much sparkle" onChange={(e) => onChange({ style, amount: e.target.value as SparkleAmount })}>
        {(Object.keys(SPARKLE_AMOUNT_LABELS) as SparkleAmount[]).map((a) => <option key={a} value={a} className="text-black">{SPARKLE_AMOUNT_LABELS[a]}</option>)}
      </select>
    </div>
  );
}
