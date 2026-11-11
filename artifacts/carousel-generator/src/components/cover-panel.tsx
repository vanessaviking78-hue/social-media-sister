import { useMemo, useState } from "react";
import { ColourPicker } from "@/components/colour-picker";
import { COVER_LAYOUTS, COVER_FONTS, coverInfo, coverMovable, splitIntoLines, clientHeadFont, type CoverLayout, type CoverOptions } from "@/lib/cover-designs";
import { COVER_ABOUT_HEADINGS, COVER_CONTRARIAN, COVER_SETS, COVER_SUBS_TREATMENT, COVER_SUBS_ABOUT, COVER_BET, COVER_STOIC, COVER_XMAS } from "@/lib/cover-banks";
import { SPLIT_HOOKS } from "@/lib/split-hooks";
import { fillTreatment, fillName, fillArea } from "@/lib/hook-bank";

// The "New slide 1 cover" controls for a post: pick one of the 23 covers, fill the words from a bank, drag and size every piece, change fonts, colours and photos.
export type CoverBase = {
  own: { url: string; bmp: ImageBitmap }[];
  headline: string;
  name: string;
  treatment: string;
  area: string;
  brand: [string, string];
  fontId?: string;
  facts: string[];
  offset: number;
};
type Props = {
  value: CoverOptions | undefined;
  onChange: (next: CoverOptions | null) => void;
  base: CoverBase;
  makeCutout: (bmp: ImageBitmap) => Promise<ImageBitmap | null>;
  moveSel: string;
  setMoveSel: (k: string) => void;
  busy?: boolean;
};

const BANKS = [
  { id: "hooks", label: "Hooks, split in two" },
  { id: "contrarian", label: "Contrarian treatment headings" },
  { id: "about", label: "About me headings" },
  { id: "sets", label: "Three point treatment sets" },
  { id: "subT", label: "Treatment subtitles" },
  { id: "subA", label: "About me subtitles" },
  { id: "bet", label: "Bet you did not know notes" },
  { id: "stoic", label: "Stoic quotes for women" },
  { id: "xmas", label: "Christmas quotes" },
] as const;
type BankId = (typeof BANKS)[number]["id"];

export function CoverPanel({ value, onChange, base, makeCutout, moveSel, setMoveSel, busy }: Props) {
  const [bank, setBank] = useState<BankId>("hooks");
  const [q, setQ] = useState("");
  const info = value ? coverInfo(value.layout) : null;
  const fill = (t: string) => fillName(fillArea(fillTreatment(t, base.treatment), base.area), base.name);

  const start = async (layout: CoverLayout) => {
    const li = coverInfo(layout);
    const own = base.own;
    const photos = Array.from({ length: Math.max(1, li.photos) }, (_, i) => own[(base.offset + i) % Math.max(1, own.length)]?.bmp).filter(Boolean) as ImageBitmap[];
    const n = li.needs.lines ?? 1;
    const lines = n > 1 ? splitIntoLines(base.headline, n) : [base.headline];
    const next: CoverOptions = {
      layout, photos, colours: { main: base.brand[0], accent: base.brand[1] }, lines, sub: value?.sub ?? "", body: value?.body ?? "",
      subs: li.needs.subs ? (value?.subs?.length ? value.subs : base.facts.slice(0, Math.max(...li.needs.subs))) : value?.subs ?? [], points: value?.points, name: base.name,
      fonts: { head: clientHeadFont(base.fontId), body: "playfair" }, move: {}, size: {}, views: [], deco: true, cutout: null,
    };
    if (li.cutout && photos[0]) next.cutout = await makeCutout(photos[0]);
    onChange(next);
  };
  const set = (patch: Partial<CoverOptions>) => value && onChange({ ...value, ...patch });
  const setLines = (text: string, n: number, sub?: string) => set({ lines: n > 1 ? splitIntoLines(text, n) : [text], ...(sub != null ? { sub } : {}) });

  const items = useMemo((): { k: string; a: string; b?: string; tag?: string }[] => {
    const ql = q.trim().toLowerCase();
    const keep = (s: string) => !ql || s.toLowerCase().includes(ql);
    switch (bank) {
      case "hooks": return SPLIT_HOOKS.filter((h) => keep(h[2] + " " + h[3])).slice(0, 80).map((h, i) => ({ k: `${h[0]}${i}`, a: h[2], b: h[3], tag: h[1] }));
      case "contrarian": return COVER_CONTRARIAN.filter(keep).map((t, i) => ({ k: `c${i}`, a: t }));
      case "about": return COVER_ABOUT_HEADINGS.filter((h) => keep(h.join(" "))).map((h, i) => ({ k: `a${i}`, a: h.join(" / ") }));
      case "sets": return COVER_SETS.filter((s) => keep(s.h)).map((s, i) => ({ k: `s${i}`, a: s.h, b: s.p.map((x) => x[0]).join(" | ") }));
      case "subT": return COVER_SUBS_TREATMENT.filter(keep).map((t, i) => ({ k: `t${i}`, a: t }));
      case "subA": return COVER_SUBS_ABOUT.filter(keep).map((t, i) => ({ k: `u${i}`, a: t }));
      case "bet": return COVER_BET.filter(keep).map((t, i) => ({ k: `b${i}`, a: t }));
      case "stoic": return COVER_STOIC.filter((s) => keep(s.join(" "))).map((s, i) => ({ k: `o${i}`, a: s[0], b: s[1] }));
      default: return COVER_XMAS.filter(keep).map((t, i) => ({ k: `x${i}`, a: t }));
    }
  }, [bank, q]);

  const pick = (idx: number) => {
    if (!value || !info) return;
    const it = items[idx];
    const n = info.needs.lines ?? 1;
    if (bank === "hooks") { setLines(n > 1 ? fill(`${it.a} ${it.b}`) : fill(it.a), n, n > 1 ? value.sub : fill(it.b ?? "")); return; }
    if (bank === "contrarian") { setLines(fill(it.a), n); return; }
    if (bank === "about") {
      const h = COVER_ABOUT_HEADINGS[Number(it.k.slice(1))];
      set({ lines: n === 3 ? [h[0], h[1], h[2]] : splitIntoLines(h.join(" "), n) }); return;
    }
    if (bank === "sets") {
      const s = COVER_SETS[Number(it.k.slice(1))];
      set({ lines: [fill(s.h)], points: s.p.map((x) => ({ t: fill(x[0]), b: fill(x[1]) })) }); return;
    }
    if (bank === "subT" || bank === "subA") {
      const max = Math.max(...(info.needs.subs ?? [8]));
      const cur = (value.subs ?? []).filter((s) => s.trim());
      const t = fill(it.a);
      set({ subs: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, max) }); return;
    }
    if (bank === "bet") { set({ sub: fill(it.a) }); return; }
    if (bank === "stoic") {
      if (info.needs.body && info.needs.sub) { const two = splitIntoLines(it.a, 2); set({ lines: [two[0]], sub: two[1], body: it.b ?? "" }); }
      else set({ lines: [it.a], body: it.b ?? "" });
      return;
    }
    set({ body: it.a, lines: [it.a] });
  };

  const own = base.own;
  const photoSlots = value ? Math.max(1, coverInfo(value.layout).photos) : 1;
  const setPhoto = async (slot: number, bmp: ImageBitmap) => {
    if (!value) return;
    const photos = [...value.photos]; photos[slot] = bmp;
    const next: CoverOptions = { ...value, photos };
    if (info?.cutout && slot === 0) next.cutout = await makeCutout(bmp);
    onChange(next);
  };
  const setView = (slot: number, p: { z?: number; x?: number; y?: number }) => value && onChange({ ...value, views: Array.from({ length: photoSlots }, (_, i) => (i === slot ? { ...(value.views?.[i] ?? {}), ...p } : value.views?.[i] ?? {})) });
  const brand = base.brand as string[];
  const movables = value ? coverMovable(value.layout, value) : [];
  const sel = moveSel;
  const FontSelect = ({ k, label }: { k: "head" | "body"; label: string }) => (
    <label className="block space-y-1"><span>{label}</span>
      <select disabled={!value} className="w-full rounded border p-1.5 text-foreground bg-background" value={value?.fonts?.[k] ?? (k === "body" ? "playfair" : "gilda")} onChange={(e) => set({ fonts: { ...(value?.fonts ?? {}), [k]: e.target.value } })}>
        {["Google fonts", "Your fonts"].map((g) => <optgroup key={g} label={g}>{COVER_FONTS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
      </select></label>
  );

  return (
    <div className="space-y-2 text-xs text-muted-foreground rounded border-2 border-pink-500 p-2">
      <div className="flex items-center justify-between">
        <div className="font-extrabold uppercase tracking-wide text-foreground text-sm">New slide 1 cover {busy && <span className="text-pink-500">drawing...</span>}</div>
        {value && <button onClick={() => { setMoveSel(""); onChange(null); }} className="px-2 py-1 rounded border">Back to the normal cover</button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COVER_LAYOUTS.map((l) => (
          <button key={l.id} onClick={() => void start(l.id)} className={`px-2 py-1 rounded border text-left ${value?.layout === l.id ? "bg-pink-500 text-white border-pink-500" : ""}`}>{l.n}. {l.label}{l.statik ? " (static)" : ""}</button>
        ))}
      </div>
      {value && info && (
        <>
          <div className="space-y-1 rounded border p-2">
            <div className="font-semibold text-foreground">Words from a bank</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="rounded border p-1.5 text-foreground bg-background" value={bank} onChange={(e) => setBank(e.target.value as BankId)}>{BANKS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
              <input className="rounded border p-1.5 text-foreground" placeholder="Search the bank" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto divide-y rounded border text-foreground">
              {items.map((it, i) => (
                <button key={it.k} onClick={() => pick(i)} className="block w-full text-left px-2 py-1 hover:bg-pink-50"><span className="font-semibold">{fill(it.a)}</span>{it.b ? <span className="block text-muted-foreground">{fill(it.b)}</span> : null}</button>
              ))}
              {!items.length && <div className="p-2">Nothing matches.</div>}
            </div>
            {(bank === "subT" || bank === "subA") && <div>Tap lines to tick or untick them. Up to {Math.max(...(info.needs.subs ?? [8]))} for this cover.</div>}
          </div>

          <div className="space-y-1 rounded border p-2">
            <div className="font-semibold text-foreground">Or type the words</div>
            {info.needs.lines != null && Array.from({ length: info.needs.lines }, (_, i) => (
              <input key={i} className="w-full rounded border p-1.5 text-foreground" placeholder={`Heading ${info.needs.lines! > 1 ? `line ${i + 1}` : ""}`} value={value.lines[i] ?? ""} onChange={(e) => set({ lines: Array.from({ length: info.needs.lines! }, (_, j) => (j === i ? e.target.value : value.lines[j] ?? "")) })} />
            ))}
            {info.needs.sub && <input className="w-full rounded border p-1.5 text-foreground" placeholder="Subheading" value={value.sub ?? ""} onChange={(e) => set({ sub: e.target.value })} />}
            {(info.needs.body || info.needs.quote) && <textarea rows={3} className="w-full rounded border p-1.5 text-foreground" placeholder={info.needs.quote ? "Quote" : "Paragraph or hook text"} value={value.body ?? ""} onChange={(e) => set({ body: e.target.value })} />}
            {info.needs.subs && <textarea rows={4} className="w-full rounded border p-1.5 text-foreground" placeholder="Subtitles or pills, one per line" value={(value.subs ?? []).join("\n")} onChange={(e) => set({ subs: e.target.value.split("\n") })} />}
            {info.needs.name && <input className="w-full rounded border p-1.5 text-foreground" placeholder="Name" value={value.name ?? ""} onChange={(e) => set({ name: e.target.value })} />}
          </div>

          <div className="space-y-1 rounded border p-2">
            <div className="font-semibold text-foreground">Move and size the text and shapes</div>
            <div className="flex flex-wrap gap-1.5">
              {movables.map((m) => <button key={m.key} onClick={() => setMoveSel(sel === m.key ? "" : m.key)} className={`px-2 py-1 rounded border ${sel === m.key ? "bg-pink-500 text-white border-pink-500" : ""}`}>{m.label}</button>)}
              <button onClick={() => { setMoveSel(""); set({ move: {}, size: {} }); }} className="px-2 py-1 rounded border">Put everything back</button>
            </div>
            {sel ? (
              <label className="flex items-center gap-2"><span className="w-28 shrink-0">Size of {movables.find((m) => m.key === sel)?.label}</span>
                <input type="range" min={0.4} max={2.6} step={0.05} value={value.size?.[sel] ?? 1} onChange={(e) => set({ size: { ...(value.size ?? {}), [sel]: Number(e.target.value) } })} className="flex-1" /><span className="w-10">{Math.round((value.size?.[sel] ?? 1) * 100)}%</span></label>
            ) : <div>Tap a name, then drag on the picture to move it, and use the slider to change its size.</div>}
            {value.layout === "stack3" && <label className="flex items-center gap-2"><span className="w-28 shrink-0">Fade of line 2</span><input type="range" min={0.1} max={1} step={0.05} value={value.fade ?? 0.45} onChange={(e) => set({ fade: Number(e.target.value) })} className="flex-1" /></label>}
            {value.layout === "strip" && <label className="flex items-center gap-2"><span className="w-28 shrink-0">Background photo</span><input type="range" min={0} max={1} step={0.05} value={value.fade ?? 0.45} onChange={(e) => set({ fade: Number(e.target.value) })} className="flex-1" /></label>}
            {value.layout === "tape" && <label className="flex items-center gap-2"><span className="w-28 shrink-0">Blur</span><input type="range" min={0} max={60} step={2} value={value.blur ?? 26} onChange={(e) => set({ blur: Number(e.target.value) })} className="flex-1" /></label>}
            {info.deco && <label className="flex items-center gap-2"><input type="checkbox" checked={value.deco !== false} onChange={(e) => set({ deco: e.target.checked })} />{info.deco} on</label>}
            {value.layout === "notebook" && <label className="flex items-center gap-2"><input type="checkbox" checked={value.mono !== false} onChange={(e) => set({ mono: e.target.checked })} />Black and white photo</label>}
            {value.layout === "grid" && (
              <div><div className="mb-1">Tap a square to switch it between photo (P), colour (C) and text (T).</div>
                <div className="grid grid-cols-3 gap-1 w-40">
                  {(value.cells && value.cells.length === 9 ? value.cells : ["c", "p", "c", "t", "c", "p", "p", "c", "c"]).map((k, i, all) => (
                    <button key={i} onClick={() => { const order = ["p", "c", "t"]; const nx = order[(order.indexOf(k) + 1) % 3]; const arr = all.map((x, j) => (j === i ? nx : nx === "t" && x === "t" ? "c" : x)); set({ cells: arr }); }} className="h-10 rounded border font-bold text-foreground">{k.toUpperCase()}</button>
                  ))}</div></div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FontSelect k="head" label="Heading font" />
            <FontSelect k="body" label="Subheading font" />
          </div>
          <div className="bg-white text-black rounded-lg p-2 space-y-2">
            <ColourPicker label="Heading colour" value={value.colours.head} placeholder="template default" onChange={(v) => set({ colours: { ...value.colours, head: v } })} onReset={() => set({ colours: { ...value.colours, head: undefined } })} brand={brand} />
            <ColourPicker label="Text colour" value={value.colours.text} placeholder="template default" onChange={(v) => set({ colours: { ...value.colours, text: v } })} onReset={() => set({ colours: { ...value.colours, text: undefined } })} brand={brand} />
            <ColourPicker label="Background or page colour" value={value.colours.bg} placeholder="brand colour" onChange={(v) => set({ colours: { ...value.colours, bg: v } })} onReset={() => set({ colours: { ...value.colours, bg: undefined } })} brand={brand} />
            <ColourPicker label="Boxes, notes and shapes" value={value.colours.box} placeholder="template default" onChange={(v) => set({ colours: { ...value.colours, box: v } })} onReset={() => set({ colours: { ...value.colours, box: undefined } })} brand={brand} />
          </div>

          {info.photos > 0 && (
            <div className="space-y-1 rounded border p-2">
              <div className="font-semibold text-foreground">Photos ({info.photos === 1 ? "1" : `${info.photos}, one for each place`})</div>
              {Array.from({ length: photoSlots }, (_, slot) => (
                <div key={slot} className="space-y-1">
                  <div>Photo {slot + 1}</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {own.map((o) => <img key={o.url} src={o.url} onClick={() => void setPhoto(slot, o.bmp)} className={`h-14 rounded max-w-none shrink-0 cursor-pointer border-2 ${value.photos[slot] === o.bmp ? "border-pink-500" : "border-transparent"}`} />)}
                  </div>
                  <label className="flex items-center gap-2"><span className="w-12 shrink-0">Zoom</span><input type="range" min={1} max={3} step={0.05} value={value.views?.[slot]?.z ?? 1} onChange={(e) => setView(slot, { z: Number(e.target.value) })} className="flex-1" /></label>
                  <label className="flex items-center gap-2"><span className="w-12 shrink-0">Left, right</span><input type="range" min={-1} max={1} step={0.05} value={value.views?.[slot]?.x ?? 0} onChange={(e) => setView(slot, { x: Number(e.target.value) })} className="flex-1" /></label>
                  <label className="flex items-center gap-2"><span className="w-12 shrink-0">Up, down</span><input type="range" min={-1} max={1} step={0.05} value={value.views?.[slot]?.y ?? 0} onChange={(e) => setView(slot, { y: Number(e.target.value) })} className="flex-1" /></label>
                </div>
              ))}
              {info.cutout && <div>The clinician is cut out of photo 1 automatically. Pick another photo to cut out a different one.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
