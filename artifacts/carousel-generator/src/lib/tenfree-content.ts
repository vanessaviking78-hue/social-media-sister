import { U_TREATMENTS, U_BY_ID, postTypesFor, type UTreatment } from "./universal-treatments";
import { hashSeed, type PackKind } from "./pack-plan";

// 10 FREE POSTS: the plan, the treatment picker and the little extras. Pure functions, no drawing.

export type TenSlot =
  | { n: number; label: string; carousel: boolean; source: "universal" }
  | { n: number; label: string; carousel: boolean; source: "pack"; kind: PackKind; design: string; idea: string; preset?: Record<string, string> }
  // An about me poster drawn from one of her two About me templates (cream or peach) with the clinic's own photo and bio.
  | { n: number; label: string; carousel: boolean; source: "about"; kind: "about-me" | "about-love"; layout: "cream" | "peach" }
  // A hook she picked from the bank as the cover of a Universal layout carousel.
  | { n: number; label: string; carousel: boolean; source: "hook" };

// The order the ten sit in on the feed. Treatments are Universal carousels. Everything else is drawn from the same templates as the paid post packs.
// The idea is handed to the writer along with her answers from the form. A preset is wording Vanessa wrote herself, which is kept exactly.
export const TEN_PLAN: TenSlot[] = [
  { n: 1, label: "Treatment carousel", carousel: true, source: "universal" },
  { n: 2, label: "About the injector", carousel: true, source: "pack", kind: "lux", design: "0",
    idea: "a carousel that introduces me as a person, built from the real things I told you about myself (hobbies, pets, being a mum or not, my area, my passion), funny and warm so a stranger feels she already knows me" },
  { n: 3, label: "Treatment carousel", carousel: true, source: "universal" },
  { n: 4, label: "Your turn", carousel: false, source: "pack", kind: "empower", design: "refuse",
    idea: "a post for the woman who puts everyone else first, telling her it is her turn now",
    preset: { head: "For the woman who puts everyone else first.", body: "The lifts. The lists. The everyone's-feelings.\nThe 'I'm fine, honestly'.", foot: "It's your turn." } },
  { n: 5, label: "Why I love what I do", carousel: true, source: "pack", kind: "lux", design: "3",
    idea: "a carousel about how much I love making people feel good about themselves, why I got into aesthetics (use only what I told you), the moments I love most in my clinic" },
  { n: 6, label: "Treatment carousel", carousel: true, source: "universal" },
  { n: 7, label: "This month", carousel: false, source: "pack", kind: "portrait", design: "0",
    idea: "a photo post for the current month in the UK, tying the real mood of the season to how a woman over 35 might want to feel, with a big hook headline and a subtitle that finishes the thought. Never an offer or a deadline" },
  { n: 8, label: "Safety", carousel: false, source: "pack", kind: "empower", design: "no",
    idea: "a post about safety and doing things properly: a good practitioner says no, assesses first, and never rushes a decision. Friendly and funny, no claims" },
  { n: 9, label: "Unique post", carousel: true, source: "pack", kind: "unique", design: "auto",
    idea: "a funny, shareable post that no other clinic is posting, in my voice" },
  { n: 10, label: "Relatable", carousel: false, source: "pack", kind: "empower", design: "relatable",
    idea: "a nostalgic, funny, relatable post for women over 35" },
];

// PREMIUM FREEBIES: three Universal treatment carousels, two about me carousels and five hook posts whose words are hooks Vanessa picks from the bank.
// The hook posts are photo posts with the hook as the headline. Everything is drawn from the same designs her paying clients get.
export const PREMIUM_PLAN: TenSlot[] = [
  { n: 1, label: "Treatment carousel", carousel: true, source: "universal" },
  { n: 2, label: "About me", carousel: false, source: "about", kind: "about-me", layout: "cream" },
  { n: 3, label: "Treatment carousel", carousel: true, source: "universal" },
  { n: 4, label: "About me: why I love it", carousel: false, source: "about", kind: "about-love", layout: "peach" },
  { n: 5, label: "Treatment carousel", carousel: true, source: "universal" },
  ...[6, 7, 8, 9, 10].map((n): TenSlot => ({ n, label: "Hook carousel", carousel: true, source: "hook" })),
];

// Treatments that make a more interesting post than the obvious ones. They get picked first when a clinic ticks them.
const INTERESTING = new Set([
  "sculptra", "exosomes", "japanese-head-spa", "hifu", "prf", "tear-trough-filler",
  "carbon-laser", "reiki", "biostimulators", "temple-filler", "hand-filler", "profhilo", "dermaplaning", "led", "ipl", "prp-hair", "nose-filler",
]);
// The ones every clinic posts about, picked last.
const OBVIOUS = new Set(["skin-tightening", "medical-facial", "microdermabrasion", "lip-filler", "skin-boosters", "chemical-peels"]);
// Polynucleotides and the eye version count as one choice, so they never take two of the three places.
const SAME_FAMILY = (a: string, b: string) => a.startsWith("polynucleotide") && b.startsWith("polynucleotide");

// The angle each of the three treatment posts takes (an index into the six posts of a treatment): the introduction, "3 things", "who it is for".
// Rotated by request number so consecutive clinics do not all get the same three posts.
const ANGLE_ORDER = [0, 2, 3, 1, 4, 5];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TreatmentPick = { treatment: UTreatment; angle: number; headline: string; brief: string };

/**
 * Chooses the three treatments. ticked: the names the clinic ticked (the form uses the Universal names).
 * hasPhotos: whether the Universal library holds photos for that treatment, because a post with no photos would be bare.
 * Spreads the three across different groups where it can, prefers the interesting ones, and never takes only polynucleotides.
 */
export function pickTreatments(ticked: string[], hasPhotos: (id: string) => boolean, seedText: string, seq = 0): TreatmentPick[] {
  const rand = rng(hashSeed(seedText));
  const byName = new Map(U_TREATMENTS.map((t) => [t.name.toLowerCase(), t]));
  // Only treatments she actually ticked. If fewer than three have photos, the same treatment is used again with a different angle.
  const pool = ticked.map((n) => byName.get(n.toLowerCase())).filter((t): t is UTreatment => !!t && hasPhotos(t.id));
  if (!pool.length) return [];
  const score = (t: UTreatment) => (INTERESTING.has(t.id) ? 2 : OBVIOUS.has(t.id) ? 0 : 1) + rand();
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  const chosen: UTreatment[] = [];
  // First pass: a different group each time. Second pass: anything left.
  for (const pass of [0, 1]) {
    for (const t of ranked) {
      if (chosen.length === 3) break;
      if (chosen.includes(t)) continue;
      if (chosen.some((c) => SAME_FAMILY(c.id, t.id))) continue;
      if (pass === 0 && chosen.some((c) => c.group === t.group)) continue;
      chosen.push(t);
    }
  }
  while (chosen.length < 3) chosen.push(ranked[chosen.length % ranked.length]);
  return chosen.map((treatment, i) => {
    const angle = ANGLE_ORDER[(seq + i * 2) % ANGLE_ORDER.length];
    const type = postTypesFor(treatment)[angle];
    return { treatment, angle, headline: type.headline, brief: type.brief };
  });
}

export const treatmentByName = (name: string): UTreatment | undefined => U_TREATMENTS.find((t) => t.name.toLowerCase() === name.toLowerCase());
export { U_BY_ID };

// Tiny consumer psychology facts, one goes at the end of every pack. Tendencies, never statistics.
export const PSYCH_FACTS: string[] = [
  "Many women over 35 take their time over a decision and quietly check you out first. Seeing your face and hearing your voice often is what turns a stranger into someone she trusts enough to book with.",
  "A tiny honest wobble makes an expert more likeable, not less. The post where you admit you cannot parallel park can do more for you than the one listing your qualifications.",
  "We remember how an experience ended far more than how it began. A warm last five minutes at the end of an appointment is worth more than a flawless first five.",
  "A small yes makes a bigger yes easier. Every poll she taps, comment she leaves and post she saves is a tiny step towards booking with you.",
  "We remember what feels like it is about us. Lines that start with 'you know when' tend to beat lines that start with 'we offer'.",
  "Give something useful for free first and people feel a gentle pull to give something back, even if it is only a comment, a follow or a conversation.",
  "A lot of women over 35 are the person everyone else leans on, so a post that says 'this one is for you' tends to land harder than one that says 'treat yourself'.",
  "People trust people more than they trust brands. A real face and a real voice in the first second of a reel usually do more work than a logo.",
  "A short story about a real moment sticks far longer than a list of benefits, because our brains treat a story as something that happened to us.",
  "Too many choices can freeze us. Show her fewer, clearer options and make the next step small and obvious, and saying yes gets much easier.",
];

export const pickFact = (seedText: string): string => PSYCH_FACTS[hashSeed(seedText) % PSYCH_FACTS.length];

export const monthNameUK = (d = new Date()): string => d.toLocaleString("en-GB", { month: "long", timeZone: "Europe/London" });

// The relatable posts. Each clinic gets one of these, chosen from its request, so the free packs are not all the same.
// Gatecrasher keeps the wording written for it. The others use their own template wording as the starting point.
export const RELATABLE_IDS = ["gatecrasher", "heather", "knees", "mum", "nineties", "terrified", "smell", "playlist", "at25", "built-different", "hotter", "list-hotter", "nobody-warned", "whats-gone", "thousand", "film-title"];
// The youngest age band a relatable design suits, because many lean on 90s memories, being 25 once, or being over 40.
// Bands: Under 30, 30 to 37, 38 to 44, 45 to 54, 55 or over.
const AGE_RANK: Record<string, number> = { "Under 30": 0, "30 to 37": 1, "38 to 44": 2, "45 to 54": 3, "55 or over": 4 };
const RELATABLE_MIN: Record<string, number> = {
  gatecrasher: 2, heather: 2, knees: 2, nineties: 2, smell: 2, at25: 2, "built-different": 2, "list-hotter": 2, hotter: 2, "nobody-warned": 2, mum: 0,
};
export function relatableFor(age: string | undefined, isMum: boolean): string[] {
  const rank = age && age in AGE_RANK ? AGE_RANK[age] : 4;
  const ok = RELATABLE_IDS.filter((id) => rank >= (RELATABLE_MIN[id] ?? 0) && (id !== "mum" || isMum));
  return ok.length ? ok : ["playlist", "film-title", "thousand"];
}
export const GATECRASHER_PRESET = { head: "One minute you're at *Gatecrasher.* Next minute you're in *comfy slippers* reading a novel." };
