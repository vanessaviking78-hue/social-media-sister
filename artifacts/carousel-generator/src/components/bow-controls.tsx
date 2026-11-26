import { Gift } from "lucide-react";
import { ColourPicker } from "@/components/colour-picker";
import { RIBBON_IDS, RIBBON_LABELS, ribbonUrl, saveBowChoice, type BowChoice } from "@/lib/bows";

// The Bows switch that sits next to Sparkle on every tool: on or off, which ribbon, what colour, and where it sits on the post.
// brand lists the client's own colours as quick swatches, when the page knows them.
export function BowControls({ value, onChange, brand = [], showStyle = false }: { value: BowChoice; onChange: (c: BowChoice) => void; brand?: string[]; showStyle?: boolean }) {
  const set = (p: Partial<BowChoice>) => { const n = { ...value, ...p }; saveBowChoice(n); onChange(n); };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Gift className="w-4 h-4 text-pink-400" />
        <span className="text-sm font-semibold">Bows</span>
        <button type="button" aria-pressed={value.on} onClick={() => set({ on: !value.on })} className={`rounded border px-3 py-1 text-sm ${value.on ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{value.on ? "On" : "Off"}</button>
      </div>
      {(value.on || showStyle) && (
        <div className="space-y-2 rounded border border-white/10 p-2">
          <div className="flex gap-2 flex-wrap">
            {RIBBON_IDS.map((id) => (
              <button key={id} type="button" aria-label={`${RIBBON_LABELS[id]} bow`} title={RIBBON_LABELS[id]} onClick={() => set({ ribbon: id, dx: 0, dy: 0 })}
                className={`rounded border p-1 text-xs ${value.ribbon === id ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>
                <img src={ribbonUrl(id)} alt="" className="h-14 w-14 object-contain bg-white/90 rounded" />
                <span className="block mt-0.5 text-center">{RIBBON_LABELS[id]}</span>
              </button>
            ))}
          </div>
          <ColourPicker label="Ribbon colour" value={value.color} brand={brand} onChange={(v) => v && set({ color: v })} />
          {([["Size", "size", 0.6, 1.6, 0.05], ["Left and right", "dx", -0.5, 0.5, 0.01], ["Up and down", "dy", -0.5, 0.5, 0.01]] as const).map(([lab, key, mn, mx, st]) => (
            <label key={key} className="flex items-center gap-3 text-xs"><span className="w-28 shrink-0 text-white/60">{lab}</span>
              <input type="range" min={mn} max={mx} step={st} className="flex-1" value={value[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<BowChoice>)} /></label>
          ))}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.all} onChange={(e) => set({ all: e.target.checked })} />On every slide, not just the cover</label>
        </div>
      )}
    </div>
  );
}
