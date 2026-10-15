import { FONT_OPTIONS, ALL_FONTS } from "@/lib/slide-utils";

// One shared home for every uploaded or bought font (Envato and "Your fonts").
// The font files live in this browser's "stylish-fonts" database, the same one Stylish
// has always used, so fonts already uploaded in Stylish appear everywhere straight away.
// On start up, and whenever a font is added or removed, they are registered with the
// browser and written into the shared FONT_OPTIONS and ALL_FONTS lists that every tool
// reads, so a font uploaded in any tool shows up in all of them.

export type SharedFontOption = { label: string; value: string; group?: string; custom?: boolean };

const DB_NAME = "stylish-fonts";
const STORE = "fonts";
export const FONTS_CHANGED_EVENT = "shared-fonts-changed";

type FontInfo = { family: string; compact: string; weight: number; italic: boolean };

export function parseFontFile(fileName: string): FontInfo {
  let base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();
  const italic = /italic|oblique/.test(lower);
  const weights: [RegExp, number][] = [
    [/extra[-_ ]?black|ultra/, 950], [/black|heavy/, 900], [/extra[-_ ]?bold|ultra[-_ ]?bold/, 800],
    [/semi[-_ ]?bold|demi/, 600], [/bold/, 700], [/medium/, 500], [/extra[-_ ]?light|ultra[-_ ]?light/, 200],
    [/thin|hairline/, 100], [/light/, 300],
  ];
  let weight = 400;
  for (const [re, w] of weights) if (re.test(lower)) { weight = Math.min(w, 900); break; }
  base = base.replace(/([-_ ]?(extra|ultra|semi|demi)?[-_ ]?(black|heavy|bold|medium|light|thin|hairline|regular|italic|oblique|book|roman))+$/i, "");
  const spaced = base.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim() || "My font";
  return { family: spaced, compact: spaced.replace(/\s+/g, ""), weight, italic };
}

export function envatoGroup(fam: string): string {
  const n = fam.toLowerCase().replace(/[^a-z]/g, "");
  if (/annyra|syora|avoraty|ragitras|brylliant/.test(n)) return "Envato fonts: headings";
  if (/geonnix|enchantedlove|justsans/.test(n)) return "Envato fonts: subtitles";
  return "";
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function dbAll(): Promise<{ name: string; data: ArrayBuffer }[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const out: { name: string; data: ArrayBuffer }[] = [];
      const cur = db.transaction(STORE).objectStore(STORE).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push({ name: String(c.key), data: c.value as ArrayBuffer }); c.continue(); } else resolve(out);
      };
      cur.onerror = () => resolve(out);
    } catch { resolve([]); }
  });
}

const faces = new Map<string, FontFace[]>();

async function registerFace(fileName: string, data: ArrayBuffer): Promise<string | null> {
  try {
    for (const old of faces.get(fileName) ?? []) document.fonts.delete(old);
    faces.delete(fileName);
    const info = parseFontFile(fileName);
    const made: FontFace[] = [];
    for (const fam of new Set([info.family, info.compact])) {
      const face = new FontFace(fam, data.slice(0), { weight: String(info.weight), style: info.italic ? "italic" : "normal" });
      await face.load();
      document.fonts.add(face);
      made.push(face);
    }
    faces.set(fileName, made);
    return info.family;
  } catch {
    return null;
  }
}

// Rebuild the shared lists from whatever fonts are saved, in place, so every tool that
// imported FONT_OPTIONS or ALL_FONTS sees the change.
function writeIntoLists(families: string[]) {
  for (let i = FONT_OPTIONS.length - 1; i >= 0; i--) if ((FONT_OPTIONS[i] as SharedFontOption).custom) FONT_OPTIONS.splice(i, 1);
  for (let i = ALL_FONTS.length - 1; i >= 0; i--) if ((ALL_FONTS[i] as { custom?: boolean }).custom) ALL_FONTS.splice(i, 1);
  const rows = families
    .map(fam => {
      const group = envatoGroup(fam);
      return { fam, group, label: group ? fam : `${fam} (yours)` };
    })
    .sort((a, b) => (a.group ? 0 : 1) - (b.group ? 0 : 1) || a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  FONT_OPTIONS.unshift(...rows.map(r => ({ label: r.label, value: `'${r.fam}', sans-serif`, group: r.group || "Your fonts", custom: true } as SharedFontOption)));
  ALL_FONTS.unshift(...rows.map(r => ({ label: r.label, value: r.fam, cat: r.group ? "Envato" : "Yours", custom: true } as { label: string; value: string; cat: string })));
}

let running: Promise<void> | null = null;

// Read every saved font, register it, and refresh the shared lists. Safe to call again
// at any time, for example after a font is uploaded or removed.
export function syncSharedFonts(): Promise<void> {
  const run = async () => {
    const saved = await dbAll();
    const families: string[] = [];
    const keep = new Set(saved.map(s => s.name));
    for (const name of [...faces.keys()]) {
      if (!keep.has(name)) { for (const f of faces.get(name) ?? []) document.fonts.delete(f); faces.delete(name); }
    }
    for (const f of saved) {
      const fam = await registerFace(f.name, f.data);
      if (fam && !families.includes(fam)) families.push(fam);
    }
    writeIntoLists(families);
    try { window.dispatchEvent(new Event(FONTS_CHANGED_EVENT)); } catch { /* ignore */ }
  };
  running = (running ?? Promise.resolve()).then(run, run);
  return running;
}

// Called once before the app draws, but never holds the app up for long.
export async function initSharedFonts(maxWaitMs = 1500): Promise<void> {
  await Promise.race([syncSharedFonts(), new Promise<void>(r => setTimeout(r, maxWaitMs))]);
}

// Save font files into the shared database (the same one Stylish uses), then register them,
// so a font added in any tool appears in every tool. Returns the family names that were added.
export async function addSharedFonts(files: File[]): Promise<string[]> {
  const db = await openDb();
  const added: string[] = [];
  for (const f of files) {
    if (!/\.(otf|ttf|woff2?)$/i.test(f.name)) continue;
    const data = await f.arrayBuffer();
    const fam = await registerFace(f.name, data);
    if (!fam) continue;
    added.push(fam);
    if (db) { try { db.transaction(STORE, "readwrite").objectStore(STORE).put(data, f.name); } catch { /* usable this visit only */ } }
  }
  if (added.length) await syncSharedFonts();
  return added;
}
