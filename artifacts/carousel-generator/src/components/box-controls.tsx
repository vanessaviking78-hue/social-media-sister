import { ColourPicker } from "@/components/colour-picker";
import { DEFAULT_BOX, type CoverBox } from "@/lib/cover-box";

// The text box cover controls shared by every client tool: switch it on, pick the box and text colours (metallic too), then place and size it.
export function BoxControls({ box, onChange, label = "Text box on the cover" }: { box?: CoverBox; onChange: (b: CoverBox | undefined) => void; label?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white/60">{label}</span>
        <button type="button" onClick={() => onChange(box ? undefined : { ...DEFAULT_BOX })} className={`rounded border px-2 py-1 ${box ? "border-emerald-400 bg-emerald-400/10" : "border-white/20"}`}>{box ? "On" : "Off"}</button>
      </div>
      {box && (
        <div className="space-y-2 rounded border border-white/10 p-2">
          <p className="text-white/50 text-xs">The whole photo shows with the hook in a coloured box. The slides after the cover keep the gradient.</p>
          <ColourPicker label="Box colour" value={box.fill} onChange={(v) => v && onChange({ ...box, fill: v })} />
          <ColourPicker label="Box text colour" value={box.text} placeholder="Automatic" onChange={(v) => onChange({ ...box, text: v || undefined })} onReset={() => onChange({ ...box, text: undefined })} />
          {([["Left and right", "x", 0.1, 0.9, 0.01], ["Up and down", "y", 0.08, 0.92, 0.01], ["Box width", "w", 460, 980, 20]] as const).map(([lab, key, mn, mx, st]) => (
            <label key={key} className="flex items-center gap-3 text-xs"><span className="w-28 shrink-0 text-white/60">{lab}</span>
              <input type="range" min={mn} max={mx} step={st} className="flex-1" value={(box as Record<string, number | string | undefined>)[key] as number ?? (key === "w" ? 780 : 0.5)} onChange={(e) => onChange({ ...box, [key]: Number(e.target.value) })} /></label>
          ))}
        </div>
      )}
    </div>
  );
}
