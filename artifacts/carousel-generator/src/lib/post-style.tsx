import { BoxControls } from "@/components/box-controls";
import type { CoverBox } from "@/lib/cover-box";
import { DEFAULT_BOX } from "@/lib/cover-box";

// The four post styles every carousel tool offers, shown the same way everywhere.
//   Faded page: the colour sits over the whole photo at reduced opacity.
//   Gradient:   the colour fades up from the bottom (the original look).
//   Block strip: a solid strip across the bottom, only 15% of the tile tall.
//   Text box:   the hook sits in a coloured box low down on the post.
export type StyleId = "opacity" | "gradient" | "block" | "box";
export type StyleLook = { block?: boolean; box?: CoverBox; flat?: boolean };

export const BLOCK_PCT = 0.15; // the block strip takes this share of the tile height
export const BLOCK_TEXT_H = 118; // room for the cover words inside that strip, in pixels of a 1350 tall tile
export const FLAT_ALPHA = 0.55; // how strong the faded page colour is at 100% strength

export const STYLE_LABELS: Record<StyleId, string> = { opacity: "Faded page", gradient: "Gradient", block: "Block strip", box: "Text box" };
const ORDER: StyleId[] = ["opacity", "gradient", "block", "box"];
export const styleForNumber = (i: number): StyleLook => stylePatch(ORDER[i % ORDER.length], {}); // Make 40: faded, gradient, block, box, then round again

export const styleOf = (l: StyleLook): StyleId => (l.box ? "box" : l.block ? "block" : l.flat ? "opacity" : "gradient");
export const stylePatch = (id: StyleId, cur: StyleLook): StyleLook => ({ flat: id === "opacity", block: id === "block", box: id === "box" ? (cur.box ?? { ...DEFAULT_BOX }) : undefined });

export function StylePicker({ look, onPick }: { look: StyleLook; onPick: (p: StyleLook) => void }) {
  const cur = styleOf(look);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {ORDER.map((id) => (
          <button key={id} type="button" onClick={() => onPick(stylePatch(id, look))} className={`rounded border px-2 py-1 ${cur === id ? "border-emerald-400 bg-emerald-400/15" : "border-white/20 hover:border-white/50"}`}>{STYLE_LABELS[id]}</button>
        ))}
      </div>
      {cur === "box" && <BoxControls bare box={look.box} onChange={(b) => b && onPick({ box: b })} />}
    </div>
  );
}
