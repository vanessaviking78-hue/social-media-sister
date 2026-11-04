// Turns a pack plan into posts ready to be written and drawn. No React, no drawing.

import { TREAT_BY_ID, ALL_TREATMENTS as TREATMENTS } from "./treatment-designs";
import { UNIQUE_BY_ID, type UniId } from "./unique-designs";
import { EMPOWER_BY_ID } from "./empower-designs";
import { LUX_SLIDE_DEFS } from "./lux-designs";
import type { PackItem } from "./pack-plan";
import { pickHook, splitHook } from "./hooks";
import { PHOTOS_NEEDED, SLIDES, type PackPost } from "./pack-engine";

export type CopySpec = {
  n: number;
  kind: PackPost["kind"];
  idea: string;
  fields: { key: string; label: string }[];
  current: Record<string, string>;
  photoSlides: number;
};

export type CopyResult = { n: number; text: Record<string, string>; slides: string[]; cta: string; caption: string };

const blank = (item: PackItem, photos: (number | null)[]): PackPost => ({
  n: item.n, kind: item.kind, design: item.design, text: {}, slides: [], cta: "", headline: "", subtitle: "", quote: "",
  look: item.n % 2 === 0 ? "magazine" : "stylish", caption: "", hashtags: "", photos,
});

// The clinic's ticked treatments, as design ids. The tick list uses the design names.
export const treatmentIdsFor = (names: string[]): string[] => TREATMENTS.filter((t) => names.includes(t.name)).map((t) => t.id);

// A skeleton post with its photos picked from the pool, plus what the writer needs to know about it.
// A field is only rewritten if it holds real wording: lines with {owner} style tokens, and the disclaimer
// and heading lines on treatment posts, are always kept exactly as designed.
export function skeleton(item: PackItem, cursor: { at: number; hooks?: Set<number> }, poolLen: number, noHook = false): { post: PackPost; spec: CopySpec } {
  const take = (k: number) => Array.from({ length: k }, (_, i) => (poolLen ? (cursor.at + i) % poolLen : null));
  const photos = take(PHOTOS_NEEDED[item.kind]);
  cursor.at += PHOTOS_NEEDED[item.kind];
  const post = blank(item, photos);
  let idea = "";
  let fields: { key: string; label: string }[] = [];
  let defaults: Record<string, string> = {};
  let fixed: string[] = [];
  const hooks = (cursor.hooks ??= new Set<number>());

  if (item.kind === "treatment") {
    const d = TREAT_BY_ID[item.design as keyof typeof TREAT_BY_ID];
    idea = d.idea;
    defaults = { ...d.defaults };
    fields = (["b1", "b2", "b3", "b4"] as const).map((k) => ({ key: k, label: `Side effect ${k.slice(1)}` }));
  } else if (item.kind === "unique") {
    const d = UNIQUE_BY_ID[item.design as UniId];
    idea = d.idea;
    defaults = { ...d.defaults };
    fields = d.fields.map((f) => ({ key: f.key, label: f.label }));
    // The wanted poster's title and stamp are always the word Wanted, never a synonym.
    if (item.design === "wanted") fixed = ["big", "stamp"];
  } else if (item.kind === "empower") {
    const d = EMPOWER_BY_ID[item.design];
    idea = d.idea;
    defaults = { ...d.defaults };
    fields = d.fields.map((f) => ({ key: f.key, label: f.label }));
    // Single image designs lead with one of my hook lines. The giant NO design and any worded preset keep their own words.
    if (!noHook && item.design !== "no" && "head" in defaults) {
      const hook = pickHook(hooks);
      defaults.head = hook;
      fixed = ["head"];
      idea = `${idea}. The headline on the image is my hook line, kept exactly: "${hook}". Write the other fields so they follow on from that headline in the same shape as the current wording, and the caption carries the idea on`;
    }
  } else if (item.kind === "lux") {
    const cover = Number(item.design) || 0;
    const def = LUX_SLIDE_DEFS[cover];
    idea = "a premium looking carousel about midlife confidence and looking after yourself";
    defaults = Object.fromEntries(def.fields.map(([key, , value]) => [key, value]));
    fields = def.fields.map(([key, label]) => ({ key, label }));
  } else if (item.kind === "portrait") {
    idea = "a photo post of me with a big hook headline and a subtitle that finishes the thought";
    fields = [{ key: "headline", label: "Headline" }, { key: "subtitle", label: "Subtitle" }];
    const hook = pickHook(hooks);
    defaults = { ...splitHook(hook) };
    fixed = ["headline", "subtitle"];
    idea = `a photo post of me whose words on the image are my hook line: "${hook}". The caption carries that idea on`;
  } else {
    idea = "a tweet style graphic";
    fields = [{ key: "quote", label: "The tweet" }];
    const hook = pickHook(hooks);
    defaults = { quote: hook };
    fixed = ["quote"];
    idea = `a tweet style graphic whose words on the image are my hook line: "${hook}". The caption carries that idea on`;
  }

  post.text = defaults;
  const writable = fields.filter((f) => !fixed.includes(f.key) && !/\{[a-z]+\}/i.test(defaults[f.key] ?? ""));
  const photoSlides = Math.max(0, SLIDES[item.kind] - 1);
  const spec: CopySpec = { n: item.n, kind: item.kind, idea, fields: writable, current: defaults, photoSlides };
  return { post, spec };
}

// Puts the written words into a post.
export function applyCopy(post: PackPost, r: CopyResult, tags: string): PackPost {
  const text = { ...post.text, ...Object.fromEntries(Object.entries(r.text ?? {}).filter(([, v]) => String(v).trim())) };
  const out: PackPost = { ...post, text, slides: r.slides ?? [], cta: r.cta ?? "", caption: r.caption ?? "", hashtags: tags };
  if (post.kind === "portrait") {
    out.headline = text.headline ?? "";
    out.subtitle = text.subtitle ?? "";
  }
  if (post.kind === "tweet") out.quote = text.quote ?? "";
  return out;
}
