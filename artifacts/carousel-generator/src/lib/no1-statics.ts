// NO 1 BODY SCULPTING: static single image posts for her second page.
// 16 sections, 6 posts each, 96 in all. No prices, no promises, no medicines named.
// Treatment sections close on the comment word line. The last four close on a friendly question.

import { NO1_TREATMENTS } from "./no1-posts";

export type StaticGroup = { id: string; label: string; treatmentId?: string };

export type StaticPostType = {
  id: string;
  group: string;
  label: string;
  brief: string;
  word: string; // comment word for the closing line, or "" for a friendly closing question
};

const T = (id: string) => NO1_TREATMENTS.find((t) => t.id === id)!;

// The 12 treatment sections, in the order she gave them.
const TREATMENT_ORDER: { id: string; label?: string; fun: string }[] = [
  { id: "pad4", label: "4 paddle EMS (EMS HIEMT)", fun: "a funny, honest line about how many sit ups this replaces, kept kind and never promising a result" },
  { id: "rf", fun: "a funny line about warm skin treatments feeling like a very polite hot stone" },
  { id: "cav", fun: "a funny, dry line about how the treatment is the easy part and the water bottle is the hard part" },
  { id: "intimate", fun: "a warm, light line about how nobody talks about this and why a kind private chat is a good start. Never about any condition" },
  { id: "lymph", fun: "a funny line about legs that feel like they have been put on a lighter setting" },
  { id: "poly", fun: "a funny line about skin that has been on a very long week and deserves a proper drink" },
  { id: "lymphface", fun: "a funny line about waking up with a face that looks like it slept in a different postcode" },
  { id: "needle", fun: "a funny line about how skin texture is the one thing a filter cannot fully hide" },
  { id: "derma", fun: "a funny, dry line about makeup finally sitting properly and what the peach fuzz was hiding" },
  { id: "peel", fun: "a funny line about skin that has seen better months and needs a fresh start" },
  { id: "lips", fun: "a funny line about lips that have worked harder than anyone gives them credit for. About hydration only, never size or shape" },
  { id: "led", fun: "a funny line about lying down in a glowing light and calling it work" },
];

function treatmentPosts(id: string, name: string, fun: string): StaticPostType[] {
  const t = T(id);
  const base = `${name}. Facts you may use: ${t.about}.`;
  const mk = (n: number, label: string, brief: string): StaticPostType => ({
    id: `st-${id}-${n}`,
    group: `t-${id}`,
    label: `${name}: ${label}`,
    word: t.word,
    brief: `${base} ${brief}`,
  });
  return [
    mk(1, "what it is", "A friendly one image post explaining what it is in plain words, as if telling a friend over the phone. The hook names the treatment."),
    mk(2, "who it suits", "Who might be a good fit, said kindly, and why a proper consultation always comes first. Never promise a result."),
    mk(3, "what a session is like", "What a session is like, from walking in to walking out, so a nervous woman can picture it and relax."),
    mk(4, "the questions I get asked", "The questions I hear most often about it, answered honestly in one short line each, with no medical claims."),
    mk(5, "why a course", "Why this is usually done in a course rather than a one off, and why I am honest about what is realistic."),
    mk(6, "the light one", `A light, funny, affectionate post. The joke: ${fun}.`),
  ];
}

const treatmentGroups: StaticGroup[] = TREATMENT_ORDER.map((t) => ({ id: `t-${T(t.id).id}`, label: t.label ?? T(t.id).name, treatmentId: t.id }));
const treatmentTypes: StaticPostType[] = TREATMENT_ORDER.flatMap((t) => treatmentPosts(t.id, t.label ?? T(t.id).name, t.fun));

const v = (n: number, label: string, brief: string): StaticPostType => ({ id: `st-vol-${n}`, group: "volume", label, brief, word: "" });
const w = (n: number, label: string, brief: string): StaticPostType => ({ id: `st-wl-${n}`, group: "weightloss", label, brief, word: "" });
const m = (n: number, label: string, brief: string): StaticPostType => ({ id: `st-men-${n}`, group: "menopause", label, brief, word: "" });
const tw = (n: number, label: string, brief: string): StaticPostType => ({ id: `st-tw-${n}`, group: "tweets", label, brief, word: "" });

const otherTypes: StaticPostType[] = [
  v(1, "Why volume loss happens", "Why the body and face lose volume as the years go on, in plain, kind words: muscle, skin, collagen and fat all change, and none of it is a failing. No claims, no fixes."),
  v(2, "Muscle is the part nobody mentions", "Muscle tone is a big part of how a body holds its shape, and it quietly changes in our forties and fifties. Reassuring and honest."),
  v(3, "Skin that has lost its bounce", "Skin loses some of its spring over the years. Normalise it warmly and say a proper chat about what might help is always the first step."),
  v(4, "Why clothes fit differently now", "The relatable moment when clothes sit differently than they used to, and why that is about shape and volume changing, never about worth."),
  v(5, "Volume loss after a big change", "Why volume can change after a big life change or a big shift in weight, and why being gentle with yourself is part of the plan."),
  v(6, "It is not your fault", "A kind, direct reminder that bodies change with time and hormones and life, and that asking for advice is sensible and never vain."),

  w(1, "What happens to skin along the way", "When weight changes, skin and muscle can change too. Honest, kind, no medicines named, no promises."),
  w(2, "Support, not pressure", "How I support women through a weight loss journey with kindness and no judgement, including looking after skin, muscle and how you feel."),
  w(3, "Protecting your muscle", "Why holding on to muscle matters when the scales go down, said simply, with no claims."),
  w(4, "Loose skin worries", "The worry many women quietly have about skin as weight changes, answered kindly, with a proper consultation first and no promises."),
  w(5, "Celebrating the small wins", "A warm post about small wins that never show on the scales, like energy, sleep and clothes that feel comfortable."),
  w(6, "Nobody is judging you here", "A reassuring post for a woman who is nervous to walk through the door, about being unjudged and welcome at any stage of any journey."),

  m(1, "Menopause meme: the thermostat", "A funny menopause joke about the thermostat and the duvet and who controls both. Warm and relatable, never medical."),
  m(2, "Menopause meme: the brain", "A funny menopause joke about walking into a room and forgetting why. Relatable and kind."),
  m(3, "Menopause meme: the wardrobe", "A funny joke about a wardrobe that no longer agrees with you. Relatable and kind about bodies."),
  m(4, "Menopause meme: sleep", "A funny joke about sleep, 3am and the ceiling. Warm, relatable, no medical advice."),
  m(5, "Menopause meme: patience", "A funny, dry joke about patience that used to be infinite and now has a limit. Warm and affectionate."),
  m(6, "Menopause meme: midlife confidence", "A warm joke that ends on a kind note about the confidence that arrives with midlife, even if the memory has left."),

  tw(1, "Weight loss tweet: the scales", "A short, blunt, shareable tweet about the scales not telling the whole story. One or two sentences, in the voice of a straight talking woman."),
  tw(2, "Weight loss tweet: the quiet part", "A short, blunt, shareable tweet about the parts of weight loss nobody posts about, like skin and muscle changing. Kind and honest."),
  tw(3, "Weight loss tweet: comments from others", "A short, blunt, shareable tweet about other people's comments on your body and how little they matter."),
  tw(4, "Weight loss tweet: maintenance", "A short, blunt, shareable tweet about how keeping a change going is harder than starting it, and that is normal."),
  tw(5, "Weight loss tweet: the mirror", "A short, blunt, shareable tweet about the mirror and how long it takes your head to catch up."),
  tw(6, "Weight loss tweet: be kind", "A short, blunt, shareable tweet reminding women to be kind to themselves on any day of any journey."),
];

// About Lizzie: built only from her own "Getting to know you" answers. Honest, down to earth, never about the money,
// friendly and trustworthy; glamorous, warm and loyal; very dry and playful; gym, her sons, her friends and Ralph the
// sausage dog; her clients' biggest worry is showing their bodies. Nothing else is invented.
const ab = (n: number, label: string, brief: string): StaticPostType => ({ id: `st-about-${n}`, group: "about", label, brief, word: "" });
const LIZZIE = "Use only these facts about me, from my own answers: I run No 1 Body Sculpting in Birmingham. I am honest, down to earth and never about the money, friendly and trustworthy. Friends would call me glamorous, warm and loyal. My humour is very dry and playful. Outside work I love the gym, my sons, my friends and Ralph, my sausage dog. My clients' biggest worry is showing their bodies. Invent nothing else: no ages, names, years, stories or numbers.";
const aboutTypes: StaticPostType[] = [
  ab(1, "About Lizzie: meet me", `A warm, plain introduction from me, the woman behind No 1 Body Sculpting in Birmingham, in two or three honest sentences. ${LIZZIE}`),
  ab(2, "About Lizzie: never about the money", `A post about how I run my clinic: honest, down to earth and never about the money. Never mention a price, an offer or a discount. ${LIZZIE}`),
  ab(3, "About Lizzie: Ralph the sausage dog", `A dry, playful post about Ralph, my sausage dog, and what he thinks of my job. Keep it light and affectionate. ${LIZZIE}`),
  ab(4, "About Lizzie: the gym, my boys and my girls", `A post about life outside the clinic: the gym, my sons and my friends. Never assume the reader has children. ${LIZZIE}`),
  ab(5, "About Lizzie: showing your body", `A kind, direct post about the worry I hear most from clients, showing their bodies, and how I make the room feel safe and unjudged. ${LIZZIE}`),
  ab(6, "About Lizzie: glamorous, warm and loyal", `A playful post about what it is like to be looked after by me: glamorous, warm and loyal, with my very dry humour. ${LIZZIE}`),
];

export const STATIC_GROUPS: StaticGroup[] = [
  ...treatmentGroups,
  { id: "volume", label: "Volume loss and why it happens" },
  { id: "weightloss", label: "Weight loss support" },
  { id: "menopause", label: "Menopause memes and jokes" },
  { id: "tweets", label: "Weight loss tweets" },
  { id: "about", label: "About Lizzie" },
];

export const STATIC_POST_TYPES: StaticPostType[] = [...treatmentTypes, ...otherTypes, ...aboutTypes];

export const STATIC_CLINIC = "NO 1 BODY SCULPTING";
