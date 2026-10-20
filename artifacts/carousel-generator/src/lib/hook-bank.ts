// The Hook Bank: slide 1 hooks chosen by Vanessa, with the dates each seasonal hook can be posted.
// To add a hook, add a line to HOOKS. To move a season, change SEASON_WINDOWS.

export type HookDay = "Monday" | "Wednesday" | "Friday" | "Sunday" | "Any day";
export type HookSeason = "" | "Halloween" | "Bonfire" | "Christmas";
export type Hook = { code: string; day: HookDay; season: HookSeason; text: string };

// Which of the pack's 20 rows each kind of hook fills, in order. The treatment hooks take the
// three treatments in turn, then the first treatment again, matching how the pack is written.
export const HOOK_DAYS: { day: HookDay; label: string; rows: number[]; max: number }[] = [
  { day: "Monday", label: "Monday, treatment posts", rows: [1, 6, 11, 16], max: 4 },
  { day: "Wednesday", label: "Wednesday, nostalgic and funny", rows: [2, 7, 12, 17], max: 4 },
  { day: "Friday", label: "Friday, things that", rows: [3, 8, 13, 18], max: 4 },
  { day: "Sunday", label: "Sunday, shareable and emotional", rows: [4, 9, 14, 19], max: 4 },
  { day: "Any day", label: "Any day, heard and humour", rows: [10, 15, 5, 20], max: 4 },
];
const TREATMENT_FOR_SLOT = [0, 1, 2, 0];

// The dates each season can be posted, as [month, day]. A hook outside its window is hidden for that pack.
export const SEASON_WINDOWS: Record<Exclude<HookSeason, "">, { from: [number, number]; to: [number, number]; label: string }> = {
  Halloween: { from: [10, 31], to: [10, 31], label: "Halloween" },
  Bonfire: { from: [11, 4], to: [11, 4], label: "Bonfire Night" },
  Christmas: { from: [11, 1], to: [12, 25], label: "Christmas" },
};

export const HOOKS: Hook[] = [
  { code: "M1", day: "Monday", season: "", text: "To anyone who has been quietly looking up [treatment] and closing the tab." },
  { code: "M3", day: "Monday", season: "", text: "Three questions I would ask before booking [treatment] anywhere, including here." },
  { code: "M4", day: "Monday", season: "", text: "[Treatment], explained by someone who won't rush you into a decision." },
  { code: "M5", day: "Monday", season: "", text: "Everything you wanted to ask about [treatment] but didn't want to say out loud." },
  { code: "M7", day: "Monday", season: "Christmas", text: "Dear Santa, I would like a calm, unrushed chat about [treatment] before the party season starts." },
  { code: "M8", day: "Monday", season: "", text: "[Treatment] myths I would happily retire along with shoulder pads." },
  { code: "W2", day: "Wednesday", season: "", text: "You know you were a 90s girl if your first foundation was two shades too orange and you swore it was your colour." },
  { code: "W4", day: "Wednesday", season: "", text: "We used to circle things in the Argos catalogue like it was a vision board. Honestly, same energy, more tabs." },
  { code: "W5", day: "Wednesday", season: "Halloween", text: "Halloween in the 90s: a bin bag, a rubber mask that smelt like a tyre and a toffee apple that took out a filling. Peak childhood." },
  { code: "W6", day: "Wednesday", season: "Bonfire", text: "Bonfire Night as a kid meant a sparkler, a jacket potato and full permission to write your name in the air. When did we stop doing that?" },
  { code: "W7", day: "Wednesday", season: "Christmas", text: "Remember when a Pick 'n' Mix bag from Woolworths was your entire personality at Christmas?" },
  { code: "W8", day: "Wednesday", season: "", text: "You know you grew up in the 90s if you took a Tamagotchi's life more seriously than your GCSEs." },
  { code: "F1", day: "Friday", season: "", text: "Things I hate about the aesthetics industry and will never join in with." },
  { code: "F2", day: "Friday", season: "", text: "Things nobody warns you about at 40 (reading glasses in restaurants, anyone?)." },
  { code: "F3", day: "Friday", season: "", text: "Things I will never say in a consultation." },
  { code: "F4", day: "Friday", season: "", text: "Things in your bathroom cabinet that have outlived two relationships and a house move." },
  { code: "F7", day: "Friday", season: "Christmas", text: "Things on my Christmas list: sleep, a quiet kitchen and nobody asking when the turkey will be ready." },
  { code: "F8", day: "Friday", season: "", text: "Things I believe about getting older that the adverts never mention." },
  { code: "S1", day: "Sunday", season: "", text: "To the woman who has looked after everyone since Friday: who is looking after you?" },
  { code: "S2", day: "Sunday", season: "", text: "To the woman who runs everyone else's diary, dinner and feelings, then sits in the car park for eleven quiet minutes. This one is for you." },
  { code: "S3", day: "Sunday", season: "", text: "Somewhere there is a nineteen year old who thought 40 was ancient. She would be so proud you still turn up." },
  { code: "S4", day: "Sunday", season: "", text: "To the woman holding a washing basket and saying \"I'm fine.\" Hello, you." },
  { code: "S7", day: "Sunday", season: "Christmas", text: "To the woman who organises the entire Christmas and never gets to sit down for it: you count too." },
  { code: "S8", day: "Sunday", season: "", text: "To the woman who feels behind in life: you are exactly where a very busy woman would be." },
  { code: "M9", day: "Monday", season: "", text: "A gentle guide to [treatment] for the woman who reads every review twice." },
  { code: "M10", day: "Monday", season: "", text: "[Treatment] questions that feel silly and are actually brilliant. Ask all of them." },
  { code: "M13", day: "Monday", season: "Christmas", text: "Christmas is busy for everyone. Here is a calm chat about [treatment] for whenever you get a quiet ten minutes." },
  { code: "M14", day: "Monday", season: "", text: "How I would explain [treatment] to someone who has never set foot in a clinic." },
  { code: "M15", day: "Monday", season: "", text: "The honest questions about [treatment] you have typed into Google at midnight." },
  { code: "W13", day: "Wednesday", season: "Christmas", text: "Remember when the Christmas Radio Times arrived and you highlighted the telly like it was a military operation?" },
  { code: "W15", day: "Wednesday", season: "", text: "You know you are over 35 if you have ever asked \"what's this song?\" about a song that is currently number one." },
  { code: "W16", day: "Wednesday", season: "", text: "Friday night at Blockbuster: two hours choosing a film, five minutes watching it and a £4 late fee. Wild times." },
  { code: "F9", day: "Friday", season: "", text: "Things I would never recommend to a friend, so I will never recommend them to you." },
  { code: "F10", day: "Friday", season: "", text: "Things every woman over 35 deserves to hear in a consultation." },
  { code: "F13", day: "Friday", season: "Christmas", text: "Things at Christmas that nobody tells you are your job: the wrapping paper, the batteries and remembering everyone's allergies." },
  { code: "F14", day: "Friday", season: "", text: "Things I wish the beauty aisle would stop promising." },
  { code: "F15", day: "Friday", season: "", text: "Things you and your skin have in common: you both need a good night's sleep, a drink of water and fewer opinions from strangers." },
  { code: "F16", day: "Friday", season: "", text: "Things I will never pretend about in this clinic: what is possible, what is realistic and what you actually need." },
  { code: "S9", day: "Sunday", season: "", text: "To the woman who says \"I'll do it myself\" and does, every single time. You are allowed to be helped." },
  { code: "S13", day: "Sunday", season: "Christmas", text: "To the woman who finds the perfect present for everyone and gets a bath set in return. You are worth the thoughtful gift too." },
  { code: "S15", day: "Sunday", season: "", text: "To the woman who has been saying \"next month\" about looking after herself since 2019." },
  { code: "A3", day: "Any day", season: "", text: "Anyone else's entire skincare routine in 2003 was Clearasil, a flannel and hope?" },
  { code: "A4", day: "Any day", season: "", text: "If you have ever said \"I just want to look like me on a good day\", this one is for you." },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PACK_DAYS = 28;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// The next twelve Mondays, starting with today if it is a Monday. Each is the start of a four week pack.
export function packStarts(today: Date = new Date(), count = 12): Date[] {
  const t = startOfDay(today);
  const sinceMonday = (t.getDay() + 6) % 7;
  const first = addDays(t, sinceMonday === 0 ? 0 : 7 - sinceMonday);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

export type HookTiming = { ok: boolean; from?: Date; to?: Date };

// Whether a hook can be posted in a four week pack starting on packStart, and the dates it should go out between.
export function hookTiming(h: Hook, packStart: Date, packDays = PACK_DAYS): HookTiming {
  if (!h.season) return { ok: true };
  const w = SEASON_WINDOWS[h.season];
  const packEnd = addDays(packStart, packDays - 1);
  for (const y of [packStart.getFullYear() - 1, packStart.getFullYear(), packStart.getFullYear() + 1]) {
    const from = new Date(y, w.from[0] - 1, w.from[1]);
    const to = new Date(y, w.to[0] - 1, w.to[1]);
    const a = from > packStart ? from : packStart;
    const b = to < packEnd ? to : packEnd;
    if (a <= b) return { ok: true, from: a, to: b };
  }
  return { ok: false };
}

export function seasonRange(season: Exclude<HookSeason, "">): string {
  const w = SEASON_WINDOWS[season];
  return `${w.from[1]} ${MONTHS[w.from[0] - 1]} to ${w.to[1]} ${MONTHS[w.to[0] - 1]}`;
}

// Drops the treatment name into a hook's [treatment] slot.
export function fillTreatment(text: string, treatment: string): string {
  const t = treatment.trim();
  if (!t) return text;
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return text.replace(/\[Treatment\]/g, cap).replace(/\[treatment\]/g, t);
}

export type RequestHook = { row: number; code: string; text: string; season: HookSeason };

// Turns the picked hook codes into the row each one fills, with the treatment slot filled in.
// Hooks go to the rows of their kind in the order they were picked.
export function hooksForRequest(picked: string[], treatments: string[]): RequestHook[] {
  const out: RequestHook[] = [];
  for (const d of HOOK_DAYS) {
    const chosen = picked.map(code => HOOKS.find(h => h.code === code)).filter((h): h is Hook => !!h && h.day === d.day).slice(0, d.rows.length);
    chosen.forEach((h, k) => {
      const text = d.day === "Monday" ? fillTreatment(h.text, treatments[TREATMENT_FOR_SLOT[k]] ?? "") : h.text;
      out.push({ row: d.rows[k], code: h.code, text, season: h.season });
    });
  }
  return out.sort((a, b) => a.row - b.row);
}

export type PickedHookPayload = { text: string; season: string; kind: "treatment" | "other" };

// The hooks a writing tool sends to the server, in the order picked, with the treatment slot filled in.
// "treatment" hooks are the Monday ones, the others can go on any post.
export function pickedHookPayload(picked: string[], treatment: string | string[] = ""): PickedHookPayload[] {
  const out: PickedHookPayload[] = [];
  const list = (Array.isArray(treatment) ? treatment : [treatment]).map(t => t.trim()).filter(Boolean);
  let n = 0;
  for (const code of picked) {
    const h = HOOKS.find(x => x.code === code);
    if (!h) continue;
    const kind = h.day === "Monday" || /\[treatment\]/i.test(h.text) ? "treatment" : "other";
    out.push({ text: kind === "treatment" ? fillTreatment(h.text, list.length ? list[n++ % list.length] : "") : h.text, season: h.season ?? "", kind });
  }
  return out;
}
