import { U_TREATMENTS, U_BY_ID, postTypesFor, type UTreatment } from "./universal-treatments";
import { hashSeed } from "./pack-plan";

// 10 FREE POSTS: the plan, the treatment picker and the little extras. Pure functions, no drawing.

export type TenKind = "treatment" | "about-me" | "empower" | "ageing" | "seasonal" | "men" | "about-why";

export type TenSlot = { n: number; kind: TenKind; label: string; carousel: boolean };

// The order the nine sit in on the feed, so no two of the same kind are neighbours and carousels and single images alternate.
export const TEN_PLAN: TenSlot[] = [
  { n: 1, kind: "treatment", label: "Treatment carousel", carousel: true },
  { n: 2, kind: "about-me", label: "About me carousel", carousel: true },
  { n: 3, kind: "empower", label: "Empowering post", carousel: false },
  { n: 4, kind: "treatment", label: "Treatment carousel", carousel: true },
  { n: 5, kind: "ageing", label: "Your face, your rules carousel", carousel: true },
  { n: 6, kind: "seasonal", label: "Seasonal post", carousel: false },
  { n: 7, kind: "treatment", label: "Treatment carousel", carousel: true },
  { n: 8, kind: "men", label: "Men and aesthetics post", carousel: false },
  { n: 9, kind: "about-why", label: "Why I do this post", carousel: false },
];

export const TEN_COPY_KINDS: TenKind[] = ["about-me", "empower", "ageing", "seasonal", "men", "about-why"];

// Treatments that make a more interesting post than the obvious ones. They get picked first when a clinic ticks them.
const INTERESTING = new Set([
  "sculptra", "exosomes", "polynucleotide-eyes", "japanese-head-spa", "rf-microneedling", "hifu", "prf", "tear-trough-filler",
  "carbon-laser", "reiki", "biostimulators", "temple-filler", "hand-filler", "profhilo", "dermaplaning", "led", "ipl", "prp-hair", "nose-filler",
]);
// The ones every clinic posts about, picked last.
const OBVIOUS = new Set(["dermal-fillers", "skin-tightening", "medical-facial", "microdermabrasion", "lip-filler", "skin-boosters", "chemical-peels"]);
// Polynucleotides and the eye version count as one choice, so they never take two of the three places.
const SAME_FAMILY = (a: string, b: string) => a.startsWith("polynucleotide") && b.startsWith("polynucleotide");

// The angle each of the three treatment posts takes (an index into the six posts of a treatment): the introduction, "3 things", "who it is for".
const ANGLES = [0, 2, 3];

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
export function pickTreatments(ticked: string[], hasPhotos: (id: string) => boolean, seedText: string): TreatmentPick[] {
  const rand = rng(hashSeed(seedText));
  const byName = new Map(U_TREATMENTS.map((t) => [t.name.toLowerCase(), t]));
  let pool = ticked.map((n) => byName.get(n.toLowerCase())).filter((t): t is UTreatment => !!t && hasPhotos(t.id));
  // Nothing ticked (or nothing with photos): fall back to every treatment that has photos, wellbeing aside.
  if (pool.length < 3) {
    const more = U_TREATMENTS.filter((t) => t.group !== "wellbeing" && hasPhotos(t.id) && !pool.includes(t));
    pool = [...pool, ...more];
  }
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
  return chosen.map((treatment, i) => {
    const angle = ANGLES[i] ?? 0;
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
