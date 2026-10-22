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
  { code: "NM1", day: "Monday", season: "", text: "Quick poll: who else has [treatment] saved on their phone, never booked, and now it feels like a pet? Say hi." },
  { code: "NM2", day: "Monday", season: "", text: "Ask me anything about [treatment]. I have a hot drink and a good mood. Go." },
  { code: "NM3", day: "Monday", season: "", text: "[Treatment]: what I wish someone had told me before I got curious. Swipe, then tell me which one surprised you." },
  { code: "NM4", day: "Monday", season: "", text: "Think you know [treatment]? Swipe for the bits nobody mentions, then give yourself a score out of ten." },
  { code: "NM5", day: "Monday", season: "", text: "Finish this sentence: 'I would try [treatment] if only ______.' I read every single answer." },
  { code: "NM6", day: "Monday", season: "", text: "[Treatment] myths I am retiring today, right next to the Tamagotchi. Which one did you believe?" },
  { code: "NM7", day: "Monday", season: "", text: "Three things to ask before you book [treatment] anywhere. Number two always gets a lot of nods." },
  { code: "NM8", day: "Monday", season: "", text: "[Treatment] for the woman who has read every review and still has one more tab open." },
  { code: "NM9", day: "Monday", season: "", text: "I am answering your [treatment] questions in public, because someone else is wondering too. Drop yours below." },
  { code: "NM10", day: "Monday", season: "", text: "Nobody has ever asked a silly question about [treatment]. Prove me wrong in the comments." },
  { code: "NM11", day: "Monday", season: "", text: "Things people whisper about [treatment] in the coffee shop queue. Swipe, then tell me what you have heard." },
  { code: "NM12", day: "Monday", season: "", text: "[Treatment], explained like we are sharing a plate of biscuits. Pull up a chair." },
  { code: "NM13", day: "Monday", season: "Christmas", text: "Dear Santa, all I want is a calm, no pressure chat about [treatment] and a parking space. Which is harder to find?" },
  { code: "NM14", day: "Monday", season: "Christmas", text: "Party season is coming. If [treatment] has been on your mind, pop the kettle on and come for a chat first." },
  { code: "NW1", day: "Wednesday", season: "", text: "Name the first song you taped off the radio and I will guess your age. With love." },
  { code: "NW2", day: "Wednesday", season: "", text: "School lunchbox time: a Dairylea Lunchable, a Penguin or a Capri-Sun stabbed far too hard? Pick your side." },
  { code: "NW3", day: "Wednesday", season: "", text: "Hands up if you have ever rewound a VHS with a pencil. Pencil gang, assemble." },
  { code: "NW4", day: "Wednesday", season: "", text: "To phone your best mate you had to say 'Hello, is Sarah there please?' to her mum. Whose mum was the scariest?" },
  { code: "NW5", day: "Wednesday", season: "", text: "Tell me you are a 90s kid without saying a year. I will start: a scrunchie on every wrist." },
  { code: "NW6", day: "Wednesday", season: "", text: "Who else had a Tamagotchi that died during maths? Rest in peace, little guy." },
  { code: "NW7", day: "Wednesday", season: "", text: "Rate your 90s bedroom: glow stars on the ceiling, a boy band poster or a lava lamp? Comment your combo." },
  { code: "NW8", day: "Wednesday", season: "", text: "School disco, 1995. Where were you: dancing, holding up the wall or guarding the tuck shop?" },
  { code: "NW9", day: "Wednesday", season: "", text: "Before Pinterest we had the Argos catalogue and a biro. What did you circle?" },
  { code: "NW10", day: "Wednesday", season: "", text: "Type your first ever email address in the comments. I dare you. Extra points for numbers and underscores." },
  { code: "NW11", day: "Wednesday", season: "", text: "Pick one: dial-up internet or a Nokia that survived a flight down the stairs." },
  { code: "NW12", day: "Wednesday", season: "", text: "Name something you owned in the 90s that would now be a vintage find. Butterfly clips, I am looking at you." },
  { code: "NW13", day: "Wednesday", season: "Halloween", text: "Halloween as a kid: a bin bag costume, face paint from the corner shop and a torch for the walk home. What was yours?" },
  { code: "NW14", day: "Wednesday", season: "Bonfire", text: "Bonfire Night: a sparkler, a pair of mittens and a grown-up shouting 'stand back'. Who was your sparkler boss?" },
  { code: "NW15", day: "Wednesday", season: "Christmas", text: "The Christmas Radio Times, a highlighter and a plan for the telly. Which film did you circle first?" },
  { code: "NW16", day: "Wednesday", season: "Christmas", text: "Christmas morning, 6am: tinsel everywhere and one grown-up begging for five more minutes. Which one were you?" },
  { code: "NF1", day: "Friday", season: "", text: "Things in my handbag that have no business being there: three receipts, a hair tie and a mystery sweet. Show me yours." },
  { code: "NF2", day: "Friday", season: "", text: "Things you can say to me that will never shock me. Go on, try." },
  { code: "NF3", day: "Friday", season: "", text: "Things my future self will thank me for: water, a quiet Sunday and fewer 'quick' favours. What is on your list?" },
  { code: "NF4", day: "Friday", season: "", text: "Things that only make sense at 40: loving a sensible bedtime and a really good lamp." },
  { code: "NF5", day: "Friday", season: "", text: "Things I will definitely start on Monday. Comment your top three and we will fail together." },
  { code: "NF6", day: "Friday", season: "", text: "Things every woman should be allowed to say without a lecture: 'I would rather just stay in tonight.'" },
  { code: "NF7", day: "Friday", season: "", text: "Things in my skincare drawer that I bought on a whim and am too polite to throw away." },
  { code: "NF8", day: "Friday", season: "", text: "Things that deserve a round of applause: remembering a password first time, a parking space outside the shop and you." },
  { code: "NF9", day: "Friday", season: "", text: "Things I would tell my younger self about confidence, sunscreen and group chats." },
  { code: "NF10", day: "Friday", season: "", text: "Things I used to worry about that now make me laugh. What would you add?" },
  { code: "NF11", day: "Friday", season: "", text: "Things on the 2am agenda: the school form, that cringe from 2009 and whether the iron is off." },
  { code: "NF12", day: "Friday", season: "", text: "Things you are allowed to do without asking anyone: say no, wear the comfy shoes and book the thing for you." },
  { code: "NF13", day: "Friday", season: "Christmas", text: "Things on my Christmas list: a hot cup of tea, a sit down and nobody asking where the Sellotape is." },
  { code: "NF14", day: "Friday", season: "Christmas", text: "Things nobody warned you about at Christmas: you are also the person who knows where the Sellotape lives." },
  { code: "NS1", day: "Sunday", season: "", text: "To the woman who has said 'I'm fine' forty times today: send me one word for how you really are." },
  { code: "NS2", day: "Sunday", season: "", text: "To the woman who made everyone a cuppa and forgot her own: go and put the kettle on. Tag a friend who needs the same nudge." },
  { code: "NS3", day: "Sunday", season: "", text: "To the woman who cried at an advert this week: me too. Which one got you?" },
  { code: "NS4", day: "Sunday", season: "", text: "To the woman who is doing her best and thinks it is never enough: it is. Tag someone who needs to hear that today." },
  { code: "NS5", day: "Sunday", season: "", text: "To the woman holding the whole family's diary in her head: tell me one thing that is just yours." },
  { code: "NS6", day: "Sunday", season: "", text: "To the woman who compliments everyone else and rolls her eyes at the mirror: say one kind thing to her today." },
  { code: "NS7", day: "Sunday", season: "", text: "To the woman who keeps going when nobody is clapping: I am clapping. Tell me what you are proud of this week." },
  { code: "NS8", day: "Sunday", season: "", text: "To the woman reading this in the car, the loo or the pantry: I see you. Drop a heart." },
  { code: "NS9", day: "Sunday", season: "", text: "To the woman saving the good candle for a special occasion: today counts. Light it. Which scent?" },
  { code: "NS10", day: "Sunday", season: "", text: "To the woman who feels a bit behind: you are right on time. Tag the friend who makes you feel that way." },
  { code: "NS11", day: "Sunday", season: "", text: "To the woman who needs a hug and a biscuit, in that order: here are both. What is your biscuit?" },
  { code: "NS12", day: "Sunday", season: "", text: "To the woman who has held it together all week: it is Sunday. Hang the cape on the chair and have a sit." },
  { code: "NS13", day: "Sunday", season: "Christmas", text: "To the woman who runs Christmas like a small airport: who is making you a cuppa this year? Tag them." },
  { code: "NS14", day: "Sunday", season: "Christmas", text: "To the woman who buys, wraps and hides every present: you deserve one with your name on it." },
  { code: "NA1", day: "Any day", season: "", text: "Quick poll: how many tabs do you have open right now? Be honest. I will wait." },
  { code: "NA2", day: "Any day", season: "", text: "Pick one for life: no more queues or no more alarm clocks." },
  { code: "NA3", day: "Any day", season: "", text: "Finish this sentence: 'I am at my happiest when...'" },
  { code: "NA4", day: "Any day", season: "", text: "POV: you said 'I will just pop in for one thing' and left with a basket, a candle and a plan." },
  { code: "NA5", day: "Any day", season: "", text: "Which are you: the full routine, one cleanser or whatever is in the hotel bathroom? No judgement, lots of curiosity." },
  { code: "NA6", day: "Any day", season: "", text: "Me: 'I am having an early night.' Also me at 11.47pm: watching a video about lighthouses. What is your late night rabbit hole?" },
  { code: "NA7", day: "Any day", season: "", text: "What is the one thing in your house that is definitely broken and you refuse to replace? Tell me everything." },
  { code: "NA8", day: "Any day", season: "", text: "Name a compliment you still remember from years ago. It lives rent free, doesn't it?" },
  { code: "NA9", day: "Any day", season: "", text: "Hands up if you have bought a lovely notebook and never written in it." },
  { code: "NA10", day: "Any day", season: "", text: "Rate your week out of ten, then rate your tea. I suspect the tea wins." },
  { code: "NA11", day: "Any day", season: "", text: "Tell me one small thing that made you smile today. I collect them." },
  { code: "NA12", day: "Any day", season: "", text: "Which is harder: finding the end of the Sellotape or finding the telly remote?" },
  { code: "NA13", day: "Any day", season: "", text: "What is the thing you do for yourself that nobody knows about? Tell me. I won't tell." },
  { code: "NA14", day: "Any day", season: "", text: "If your week was a biscuit, which biscuit would it be?" },
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
