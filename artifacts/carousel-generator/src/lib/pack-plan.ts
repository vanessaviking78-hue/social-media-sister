// The Post Pack plan: which posts a paying clinic gets and which designs they are drawn from.
// Pure functions, no React and no drawing, so the same plan can be built on the server, in the review
// page and in a test.
//
// Designs are picked from the full banks (Unique, Treatments, Empower, LUX) using a seed made from the
// clinic's handle and the month, so two clinics ordering in the same month get different sets, and the
// same clinic gets a fresh set next month.

import { UNIQUE } from "./unique-designs";
import { TREATMENTS } from "./treatment-designs";
import { EMPOWER } from "./empower-designs";
import { LUX_COVERS } from "./lux-designs";

export type PackSize = 12 | 20 | 30;
export type PackKind = "treatment" | "tweet" | "portrait" | "unique" | "empower" | "lux";

export const PACK_PRICE: Record<PackSize, number> = { 12: 75, 20: 125, 30: 150 };

// How many of each kind a pack holds. The 12 is Vanessa's spec: 3 treatment, 2 tweet, 2 portrait and 5 from
// Unique, Empower and LUX. The 20 and 30 keep the same shape.
export const PACK_SPLIT: Record<PackSize, { treatment: number; tweet: number; portrait: number; templates: number }> = {
  12: { treatment: 3, tweet: 2, portrait: 2, templates: 5 },
  20: { treatment: 5, tweet: 3, portrait: 4, templates: 8 },
  30: { treatment: 7, tweet: 5, portrait: 6, templates: 12 },
};

export type PackItem = {
  n: number; // 1 to size, the order the posts appear in
  kind: PackKind;
  design: string; // design id for the template kinds, a variant number as text for tweet and portrait
};

// A small seeded random number generator (mulberry32), so a clinic and month always give the same plan.
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

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Takes k items from the shuffled bank, wrapping round if the bank is smaller than k.
function take<T>(list: T[], k: number, rand: () => number): T[] {
  const out: T[] = [];
  while (out.length < k) out.push(...shuffled(list, rand).slice(0, k - out.length));
  return out;
}

export const monthKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// How many designs each bank holds, so a test can check the banks are big enough to rotate.
export const BANK_SIZES = { treatment: TREATMENTS.length, unique: UNIQUE.length, empower: EMPOWER.length, lux: LUX_COVERS };

// treatmentIds: the treatment designs the clinic ticked. Treatment posts only use those, and if none are ticked they
// use the whole bank.
export function buildPackPlan(size: PackSize, handle: string, month: string = monthKey(), treatmentIds: string[] = []): PackItem[] {
  const split = PACK_SPLIT[size];
  const rand = rng(hashSeed(`${handle.trim().toLowerCase().replace(/^@/, "")}|${month}`));

  const ticked = TREATMENTS.map((d) => d.id).filter((id) => treatmentIds.includes(id));
  const treatments = take(ticked.length ? ticked : TREATMENTS.map((d) => d.id), split.treatment, rand);
  const tweets = take(Array.from({ length: 40 }, (_, i) => String(i)), split.tweet, rand);
  const portraits = take(Array.from({ length: 24 }, (_, i) => String(i)), split.portrait, rand);

  // The template posts are shared out between Unique, Empower and LUX as evenly as the count allows.
  const kinds: ("unique" | "empower" | "lux")[] = ["unique", "empower", "lux"];
  const templates: PackItem[] = [];
  const banks: Record<"unique" | "empower" | "lux", string[]> = {
    unique: take(UNIQUE.map((d) => d.id), split.templates, rand),
    empower: take(EMPOWER.map((d) => d.id), split.templates, rand),
    lux: take(Array.from({ length: LUX_COVERS }, (_, i) => String(i)), split.templates, rand),
  };
  const used = { unique: 0, empower: 0, lux: 0 };
  const offset = Math.floor(rand() * 3);
  for (let i = 0; i < split.templates; i++) {
    const kind = kinds[(i + offset) % 3];
    templates.push({ n: 0, kind, design: banks[kind][used[kind]++] });
  }

  // Interleave so no two posts of the same kind sit side by side where it can be avoided:
  // portrait, template, treatment, tweet, then round again.
  const queues: PackItem[][] = [
    portraits.map((design) => ({ n: 0, kind: "portrait" as const, design })),
    templates,
    treatments.map((design) => ({ n: 0, kind: "treatment" as const, design })),
    tweets.map((design) => ({ n: 0, kind: "tweet" as const, design })),
  ];
  const out: PackItem[] = [];
  while (out.length < size) {
    let added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
    if (!added) break;
  }
  return out.map((p, i) => ({ ...p, n: i + 1 }));
}
