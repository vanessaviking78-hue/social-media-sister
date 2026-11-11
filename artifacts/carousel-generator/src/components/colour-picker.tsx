import { useState } from "react";
import { METAL_FINISHES, isHexColour, metalCss, metalOfValue } from "@/lib/metal-colours";

// A colour picker that works with one click. Swatches are real buttons, so nothing hides behind the browser's eyedropper:
// the clinic's own brand colours come first, then a tidy palette, then the metallic finishes (silver, gold, rose gold, blue and more).
// Colours are plain hex or "metal:id". A hex box and the browser picker are there for anything else.

const PALETTE = ["#ffffff", "#f5efe6", "#f2d6d0", "#f4a6c0", "#d6006f", "#b3001b", "#e8744f", "#f6d35b", "#9cc9a0", "#2f6f5e", "#8fb8e8", "#2b4c9b", "#6a3fa0", "#1a1a1a"];
const MAIN_METALS = ["silver", "gold", "rosegold", "blue"];

type Props = {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  /** The clinic's own colours, shown first. */
  brand?: string[];
  /** Shown when the value is empty, so she can see what the template is using. */
  placeholder?: string;
  allowMetal?: boolean;
  onReset?: () => void;
};

export function swatchStyle(v: string | undefined): React.CSSProperties {
  const m = metalOfValue(v);
  if (m) return { background: metalCss(m) };
  return { background: isHexColour(v) ? v : "transparent" };
}

export function ColourPicker({ label, value, onChange, brand = [], placeholder, allowMetal = true, onReset }: Props) {
  const [hex, setHex] = useState("");
  const cur = value || placeholder || "";
  const dedupBrand = brand.filter((b, i) => isHexColour(b) && brand.findIndex((x) => x.toLowerCase() === b.toLowerCase()) === i);
  const Swatch = ({ v, title, small }: { v: string; title: string; small?: boolean }) => {
    const on = (value || "").toLowerCase() === v.toLowerCase();
    return (
      <button
        type="button"
        title={title}
        aria-label={`${label}: ${title}`}
        onClick={() => onChange(v)}
        className={`keep-colour shrink-0 rounded-md border ${small ? "h-5 w-5" : "h-6 w-6"} ${on ? "border-pink-500 ring-2 ring-pink-500/50" : "border-black/20 hover:border-black/60"}`}
        style={swatchStyle(v)}
      />
    );
  };
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-block border border-current rounded px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide">{label}</span>
        <span className="inline-block h-5 w-5 rounded border border-black/30" title="Colour now" style={swatchStyle(cur)} />
        {dedupBrand.map((b) => <Swatch key={b} v={b} title={`Brand ${b}`} small />)}
        <button type="button" className="text-[11px] underline opacity-70 hover:opacity-100" onClick={() => setOpen((o) => !o)}>{open ? "Less" : "More colours"}</button>
        {onReset && value ? <button type="button" className="text-[11px] underline opacity-70 hover:opacity-100" onClick={onReset}>use the template colour</button> : null}
      </div>
      {open ? (
        <div className="space-y-1 rounded border border-black/10 p-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            {PALETTE.map((p) => <Swatch key={p} v={p} title={p} small />)}
          </div>
          {allowMetal ? (
            <div className="flex items-center gap-1 flex-wrap">
              {METAL_FINISHES.map((m) => <Swatch key={m.id} v={`metal:${m.id}`} title={m.name} small />)}
            </div>
          ) : null}
      <div className="flex items-center gap-2">
        <input
          className="w-24 rounded border border-black/20 bg-transparent px-2 py-1 text-xs"
          placeholder="#d6006f"
          value={hex}
          onChange={(e) => { const v = e.target.value.trim(); setHex(v); const h = v.startsWith("#") ? v : `#${v}`; if (isHexColour(h)) onChange(h.toLowerCase()); }}
        />
        <label className="flex items-center gap-1 text-xs opacity-80">
          <input type="color" value={isHexColour(value) ? value : isHexColour(placeholder) ? placeholder : "#d6006f"} onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }} className="h-6 w-8 cursor-pointer rounded border border-black/20 bg-transparent p-0" />
          any colour
        </label>
      </div>
        </div>
      ) : null}
    </div>
  );
}
