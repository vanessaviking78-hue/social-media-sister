// CLARE CONNOLLY AESTHETICS, Wakefield: 6 sections of 6 posts each, the same layout as the Castle Clinic and NO 1 pages.
// One section per treatment she lists on her Instagram and in her Getting to know you answers (skin boosters, polynucleotides,
// skin peels, dermal fillers), plus "Keeping fit at 40" and "GLP1 volume loss" (consultation promotion only, nothing about what it is for).
// Her voice: honest, realistic, friendly and hard working. Natural, lifting and regenerative. She manages expectations and never
// recommends anything for the sake of it. No prices, no promises, no medicine names.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.

export type ClareSectionId = `t-${string}` | "boosters" | "poly" | "peels" | "filler" | "fit" | "glp1" | "about" | "safety" | "xmas" | "feral" | "blackfriday";

// word is the comment word on the last slide. Sections with no word close on a friendly engagement line.
export const CLARE_SECTIONS: { id: ClareSectionId; label: string; word: string }[] = [
  { id: "boosters", label: "Skin boosters", word: "BOOSTERS" },
  { id: "poly", label: "Polynucleotides", word: "POLY" },
  { id: "peels", label: "Skin peels", word: "PEELS" },
  { id: "fit", label: "Keeping fit at 40", word: "" },
  { id: "glp1", label: "GLP1 volume loss", word: "CONSULTATION" },
  { id: "about", label: "About me", word: "" },
  { id: "safety", label: "Safety", word: "" },
];

export type ClareSectionPost = { id: string; group: ClareSectionId; label: string; brief: string; word: string; xmas?: { c: string; p: string }; feral?: boolean; smx?: boolean; bf?: boolean; date?: string; slot?: number };

const WORD = new Map(CLARE_SECTIONS.map((s) => [s.id, s.word]));
const p = (id: string, group: ClareSectionId, label: string, brief: string): ClareSectionPost => ({ id, group, label, brief, word: WORD.get(group) || "" });

const NOTE = " Honest, realistic and friendly, in plain words, with a dry, warm touch of humour. Natural looking is the whole point. No promises, no results, no prices. A consultation always comes first and I only ever suggest what someone actually needs.";

const CONSULT = " ALL ABOUT BOOKING A CONSULTATION WITH ME. Never say what the consultation is for, never say what I would suggest or what it could do, never mention benefits, treatments, results, weight loss, volume loss, medicines or GLP-1. Only invite her to book a consultation. Warm, funny and friendly, in plain words. No promises, no prices.";

// "Dermal fillers" is no longer a section here: every filler has its own Fillers tab on the client page.
const ALL_SECTION_POSTS: ClareSectionPost[] = [
  // SKIN BOOSTERS
  p("sb1", "boosters", "What skin boosters actually are", "A clear, friendly explanation of skin boosters as a treatment for skin quality and hydration, so skin looks and feels fresher and more nourished. Do not describe the method, and do not claim any result." + NOTE),
  p("sb2", "boosters", "Skin that looks tired but you are not", "A relatable post for the woman in her 40s whose skin looks tired even though she has had a decent night, and a kind invitation to talk about skin quality." + NOTE),
  p("sb3", "boosters", "Skin quality and the school run", "A funny, relatable post about the skin we have after years of juggling work, family and everything else, and why hydration matters at this age. No claims." + NOTE),
  p("sb4", "boosters", "What I tell clients before they book", "How I manage expectations at a skin booster consultation: what it is for, what it is not for, and that I will say so honestly if it is not right for you." + NOTE),
  p("sb5", "boosters", "Looking after your skin around treatment", "General, friendly skin habits that help any skin: water, sun care, sleep and gentle products. Nothing medical, no product names." + NOTE),
  p("sb6", "boosters", "Is a skin booster right for you", "Why a consultation comes first, who it may suit and who it may not, said honestly and without pressure." + NOTE),

  // POLYNUCLEOTIDES
  p("pn1", "poly", "What polynucleotides are", "A simple, friendly introduction to polynucleotides as a regenerative skin quality treatment. Do not describe the method and do not claim any result." + NOTE),
  p("pn2", "poly", "Crepey skin and tired eyes", "A relatable post about crepey skin and tired looking eyes at this age, and a kind invitation to a chat about what would suit. No promises." + NOTE),
  p("pn3", "poly", "Regenerative, in plain English", "What regenerative means when I use the word, said simply and honestly, with no science lecture and no claims." + NOTE),
  p("pn4", "poly", "Natural looking, not done looking", "A post about my honest aim of looking like yourself, rested, rather than looking done. Warm and a little funny." + NOTE),
  p("pn5", "poly", "What to expect at your appointment", "A calm walk through the appointment in general terms: a proper chat, a look at your skin and how I look after you. Do not describe the method." + NOTE),
  p("pn6", "poly", "Why I do not recommend it to everyone", "An honest post on why I only suggest polynucleotides when they make sense for the person in front of me." + NOTE),

  // SKIN PEELS
  p("pe1", "peels", "What a skin peel is", "A friendly explanation of a skin peel, chosen for the skin in front of me and always after a consultation." + NOTE),
  p("pe2", "peels", "Peeling, but not like that", "A funny post easing the fear of the word peel: what to expect in general terms and how I look after you." + NOTE),
  p("pe3", "peels", "Choosing the right peel for your skin", "Why I choose a peel for your skin rather than one for everybody, said with honesty and warmth." + NOTE),
  p("pe4", "peels", "Sun care and peels", "Friendly, general sun care guidance around skin treatments, and why it matters all year round, even in Wakefield." + NOTE),
  p("pe5", "peels", "What your skin may do afterwards", "General, calm information on how skin can feel afterwards, and that I go through it all at your appointment. No promises." + NOTE),
  p("pe6", "peels", "Peel and a proper chat", "A warm invitation to a consultation to talk about what you would like from your skin. No offers, no prices." + NOTE),

  // DERMAL FILLERS
  p("df1", "filler", "What dermal fillers are", "A plain, honest explanation of dermal fillers as a treatment to restore support and softness, built up gradually and kept natural. Never use the words injectable, injection or jab." + NOTE),
  p("df2", "filler", "Lifting, not changing", "A post about the idea that a lifted, rested look is the aim, not a different face. Honest and a little funny." + NOTE),
  p("df3", "filler", "Fear of looking done", "A kind, honest post that speaks to the worry of looking done, and how I keep things natural and say no when something is not right." + NOTE),
  p("df4", "filler", "Why I do not do it all in one go", "Why I prefer to go gradually and look at the whole face, said simply and honestly. No promises." + NOTE),
  p("df5", "filler", "What a filler consultation is like", "A calm walk through a consultation: a proper conversation, a look at your face and honest advice, including when the answer is not yet." + NOTE),
  p("df6", "filler", "Questions I get asked about fillers", "A relaxed question and answer: how natural it can look, whether anyone will notice, how I decide what to suggest. Only general, truthful answers." + NOTE),

  // KEEPING FIT OVER 40
  p("ft1", "fit", "Keeping fit at 40, the honest version", "A real, friendly post about staying active in your 40s: finding something you will actually keep doing, rather than a punishing plan. Never give medical advice or numbers." + NOTE),
  p("ft2", "fit", "Strength matters more now", "A friendly post on why many women in perimenopause look to lift weights and keep muscle, said kindly and generally, nothing medical, no claims." + NOTE),
  p("ft3", "fit", "Gym, yoga, football or a walk", "A warm, funny post saying that the best way to move is the one you will actually turn up for. Use gym, yoga and football as examples that suit my life." + NOTE),
  p("ft4", "fit", "Fit, tired and still showing up", "A relatable post for the busy woman juggling work, kids and life who wants to look after herself, with a dry sense of humour about the tired days." + NOTE),
  p("ft5", "fit", "Feeding yourself properly", "A friendly, general post about eating well in your 40s, with food and cooking as something I enjoy. Nothing medical, no diets, no numbers." + NOTE),
  p("ft6", "fit", "Looking after yourself is not selfish", "A warm post giving women in their 40s permission to put themselves on the list. Kind, funny, no claims." + NOTE),

  // GLP1 VOLUME LOSS (consultation promotion only)
  p("gl1", "glp1", "Tried every diet going", "Speak to the woman who has tried every diet going, with humour and kindness, and invite her to book a consultation with me." + CONSULT),
  p("gl2", "glp1", "Your reflection and you", "A warm, relatable post about not quite recognising yourself in the mirror lately, and a gentle invitation to book a consultation with me." + CONSULT),
  p("gl3", "glp1", "The wardrobe that no longer fits", "A funny, relatable post about a wardrobe that no longer fits the way it used to, and a friendly invitation to book a consultation." + CONSULT),
  p("gl4", "glp1", "A chat with someone who listens", "A friendly post about what a consultation with me feels like as a conversation: unhurried, honest and judgement free. Do not say what it is about." + CONSULT),
  p("gl5", "glp1", "Nobody has to do this alone", "A kind, supportive post for a woman who has been going it alone, inviting her to book a consultation with me." + CONSULT),
  p("gl6", "glp1", "Book the consultation", "A warm, straightforward and funny nudge for the woman who keeps meaning to get in touch, inviting her to book a consultation with me." + CONSULT),
  p("ab1", "about", "Hello, I am here and this is me", "A warm, friendly introduction to me: who I am, what I do and what a new patient can expect from me, in plain words and with a light touch of humour. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("ab2", "about", "Why I do this work", "Why I do this work, said honestly and warmly: what I enjoy, what matters to me and how I like patients to feel when they leave. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("ab3", "about", "Things you might not know about me", "A light, funny post of general, harmless things about me and how I work, so people feel they know me before they ever walk in. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf1", "safety", "Safety first, what to check before you book anything", "A calm, clear post on what to check before booking any treatment anywhere: who is treating you, their training and insurance, a proper consultation first and no pressure on the day. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf2", "safety", "Why I always say no sometimes", "A warm, honest post on why a good practitioner will sometimes say not today or not this, and why that is a sign you are in safe hands. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf3", "safety", "Aftercare and what to do if you are worried", "A reassuring post on why aftercare matters and why you should always feel able to contact your practitioner if something does not feel right. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
];

export const CLARE_SECTION_POSTS: ClareSectionPost[] = ALL_SECTION_POSTS.filter((t) => t.group !== "filler");

// EVERY OTHER CLIENT: Make 40 follows the treatments they ticked on the treatments form. Skin boosters, polynucleotides and peels keep their hand written
// posts when ticked, every other ticked treatment gets six posts of its own, and Keeping fit, GLP1, About me and Safety stay for everyone.
import { U_TREATMENTS } from "./universal-treatments";
const CUSTOM_IDS: Record<string, string[]> = { boosters: ["skin-boosters", "profhilo"], poly: ["polynucleotides"], peels: ["chemical-peels"] };
const COVERED = new Set(Object.values(CUSTOM_IDS).flat());
const TREAT_ANGLES: { n: string; label: (t: string) => string; brief: (t: string, about: string) => string }[] = [
  { n: "1", label: (t) => `What ${t} actually is`, brief: (t, a) => `A clear, friendly explanation of ${t} in plain words. Background for the writer, never copied word for word: ${a}` },
  { n: "2", label: (t) => `Who ${t} may suit`, brief: (t) => `A warm, honest post on who ${t} may suit and who it may not, and why a consultation comes first.` },
  { n: "3", label: (t) => `What a ${t} consultation is like`, brief: (t) => `What a consultation about ${t} with me feels like: unhurried, honest, no pressure and a plan made around her. Never invent a story or client.` },
  { n: "4", label: (t) => `Questions I get asked about ${t}`, brief: (t) => `A friendly, funny post answering the sort of questions women ask me about ${t}, said honestly. No promises and no results.` },
  { n: "5", label: (t) => `Looking after your skin around ${t}`, brief: (t) => `General, friendly habits that help any skin around ${t}: water, sun care, sleep, gentle products. Nothing medical, no product names.` },
  { n: "6", label: (t) => `Is ${t} right for you`, brief: (t) => `Why a consultation comes first for ${t}, who it may suit and who it may not, said honestly and without pressure.` },
];
const TREAT_NOTE = " Honest, realistic and friendly, in plain words, with a dry, warm touch of humour. Natural looking is the whole point. No promises, no results, no prices. A consultation always comes first. Never invent a name, qualification, year, number, client or story.";
const TREAT_SECTIONS_ALL: { id: ClareSectionId; label: string; word: string; tid: string }[] = U_TREATMENTS.filter((u) => !COVERED.has(u.id)).map((u) => ({ id: `t-${u.id}` as ClareSectionId, label: u.name, word: u.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20), tid: u.id }));
const TREAT_POSTS_ALL: ClareSectionPost[] = TREAT_SECTIONS_ALL.flatMap((sec) => {
  const u = U_TREATMENTS.find((x) => x.id === sec.tid)!;
  const nm = (u.mid ?? u.name.toLowerCase());
  return TREAT_ANGLES.map((a) => ({ id: `tx-${sec.tid}-${a.n}`, group: sec.id, label: a.label(nm), word: sec.word, brief: a.brief(nm, u.about) + TREAT_NOTE }));
});
export const ALL_TREAT_POSTS = TREAT_POSTS_ALL;
const FOLLOW_CACHE = new Map<string, { sections: typeof CLARE_SECTIONS; posts: ClareSectionPost[] }>();
export function sectionsForTreatments(ids?: string[]): { sections: typeof CLARE_SECTIONS; posts: ClareSectionPost[] } {
  if (!ids?.length) return { sections: CLARE_SECTIONS, posts: CLARE_SECTION_POSTS };
  const key = [...ids].sort().join(",");
  const hit = FOLLOW_CACHE.get(key);
  if (hit) return hit;
  const has = (g: string) => (CUSTOM_IDS[g] ?? []).some((i) => ids.includes(i));
  const gen = TREAT_SECTIONS_ALL.filter((x) => ids.includes(x.tid));
  const sections: typeof CLARE_SECTIONS = [];
  for (const sec of CLARE_SECTIONS) {
    if (CUSTOM_IDS[sec.id] && !has(sec.id)) continue;
    if (sec.id === "fit") sections.push(...gen.map(({ id, label, word }) => ({ id, label, word })));
    sections.push(sec);
  }
  const order = new Map(sections.map((x, i) => [x.id, i]));
  const posts = [...CLARE_SECTION_POSTS, ...TREAT_POSTS_ALL].filter((x) => order.has(x.group)).sort((a, b) => (order.get(a.group)! - order.get(b.group)!));
  const out = { sections, posts };
  FOLLOW_CACHE.set(key, out);
  return out;
}

export const CLARE_SECTION_CLINIC = { name: "Clare Connolly Aesthetics", area: "Wakefield" } as const;

// XMAS: one carousel for each of the 32 hooks (8 weeks of 4). The cover hook is fixed to the version she picks, colloquial or professional.
import { XMAS_WEEKS } from "./xmas-weeks";
export const XMAS_SECTIONS: { id: ClareSectionId; label: string; word: string }[] = [{ id: "xmas", label: "Xmas", word: "" }];
export const XMAS_POSTS: ClareSectionPost[] = XMAS_WEEKS.flatMap((w) => w.hooks.map((h, i) => ({
  id: `xm-${h.id}`,
  group: "xmas" as const,
  label: `Week ${w.week}, ${i + 1}: ${w.title}`,
  word: "",
  xmas: { c: h.colloquial, p: h.professional },
  brief: `A Christmas carousel for week ${w.week} of my Christmas plan, "${w.title}". Theme: ${w.theme} The cover hook is already written and must stay exactly as given, so slides 2 to 4 carry on from it and keep to the theme. Warm, caring and funny where it suits, always from me to her, never selling hard, a consultation always comes first. No promises, no results, no prices, no offers, no medicine names, no website.`,
})));

// FERAL: Social Media Sister's own tab. 53 feral hooks, each a 5 slide carousel written as a social media strategist for the aesthetics industry, to clinic owners.
export const FERAL_SECTIONS: { id: ClareSectionId; label: string; word: string }[] = [{ id: "feral", label: "Feral", word: "SISTER" }];
const FERAL_HOOKS: string[] = ["I've been called an industry disruptor. I'm an anarchist, so thank you.", "My best mate left in February and it turned out to be the best gift anyone has ever given me.", "Thousands of pounds, 20 hour days and one very stubborn Yorkshire woman.", "I taught myself to code so I'd never have to rely on anyone again.", "47 clients. 6 lost along the way. 1 woman who says it like it is.", "This time next year they'll be a life coach or a sodding florist.", "I did two people's jobs at once with 40 plus clients. Here's what came out of it.", "You run the shop. I make the shop window look gorgeous.", "Every arrow I throw is made of love and honesty.", "Losing my best mate was the best thing that ever happened to my business. Yes, I said it.", "I taught myself to code at 2am so I'd never have to rely on another human being. Yorkshire stubbornness is a hell of a drug.", "February broke me, so I built a robot to do the jobs I hate. It has never once stabbed me in the back.", "\"I've made 3 million pounds selling this to clinics.\" Lovely. What did the clinics make?", "Your scrub pants are round your ankles and someone else is holding them.", "Somebody is about to sell you a £3,000 course. Sit down, I've got a few things to say first.", "Someone called me an industry disruptor and I took it as a compliment. I'm an anarchist, what did you expect?", "47 clients, 6 lost, thousands of pounds spent and zero apologies.", "I cause myself loads of work. It's still better than looking at my own work and thinking \"nah\".", "Auntie Vanessa has had enough, so pull up a chair.", "20 hour days, a brain that never switches off and a very patient husband. This is what it cost to build The Cyber Suite.", "Someone who has never run a clinic has just sold you a course on how to run a clinic. Sit down, love.", "Three million pounds in sales is a lovely number. Shame none of it went to the clinics.", "In 12 months your business coach will be selling candles. I'll still be here.", "\"Guru\" is a job title you can give yourself on a Tuesday afternoon.", "Your marketing guru hired a Lamborghini for the weekend and you've got a diary full of no shows.", "I've watched hard working clinic owners get fleeced by people with a ring light and no morals. I'm done watching.", "Funny how the people shouting about their millions never show you a clinic that made any.", "If your social media person has never read the CAP Code, you've got a ticking time bomb with a grid.", "Your £5k mastermind taught you to \"show up\". Brilliant. You were already here.", "I built my own software because humans let me down and software never asks for a pay rise.", "47 clients and a very short fuse for snake oil.", "Stop paying someone a fortune to post a sunset and call it strategy.", "Sod the guru. You need a mate with receipts.", "Your \"mentor\" has been in aesthetics for eleven minutes and charges by the hour.", "If your guru's only proof is a screenshot of their own bank balance, run.", "Nobody ever got rich selling clinics a course on how to get rich, except the person selling the course.", "I've seen more strategy in a sat nav than in some £2,000 content packages.", "Your social media person posts a quote on a beige background and calls it a content strategy. Bless them.", "Taking business advice from someone with a ring light and no clinic? Absolutely not.", "Hustle culture sold you a dream and a payment plan.", "The only thing getting a 10x return from that mastermind is the person running it.", "Somewhere, a \"growth expert\" is sweating because a clinic owner just asked for receipts.", "Your last agency vanished the minute you asked for results. Funny, that.", "Anyone promising you 10k followers by Friday has a dodgy bot farm and a lovely holiday booked.", "I've done 20 years in social media and I still check the CAP Code before I post. Your guru has never heard of it.", "Imagine charging £997 for a PDF that says \"post consistently\".", "Those \"secret formulas\" are on page one of Google. You've been robbed.", "Clinic owners are tired of being sold to by people who've never held a consultation form.", "I would rather lose a client than lie to one. Shocking, I know.", "Another funnel will help your clinic about as much as a chocolate teapot. A decent shop window and a straight talking mate will do far more.", "Your business coach has a six month waiting list and a six month old business.", "Every get rich quick course has the same ending. Someone else got rich.", "I'll tell you what's in the £3,000 course for free. A pep talk and a PDF."];
const FERAL_FACTS = "THE ONLY FACTS ABOUT ME I MAY USE, never inventing any other: I am Vanessa Wormald of Social Media Sister from Yorkshire, 20 years in social media and 7 in aesthetics. I have 47 clients and have lost 6 along the way. I looked after 40 plus clients while doing two people's jobs after my best mate left the business in February, which turned out to be the best gift anyone gave me. I taught myself to code and built The Cyber Suite software, which cost thousands of pounds and many 20 hour days, so I never have to rely on anyone again. I check the CAP Code before I post. My job is to make the clinic's shop window look so appealing that people want to step inside. I am an anarchist and proud to be called an industry disruptor. Never name or describe my former friend's faults, never name any person, company or course, never write a price, discount or any number that is not in these facts or in the hook.";
export const FERAL_POSTS: ClareSectionPost[] = FERAL_HOOKS.map((hook, i) => ({
  id: `fe-${i + 1}`,
  group: "feral" as const,
  label: `Feral ${i + 1}`,
  word: "SISTER",
  feral: true,
  xmas: { c: hook, p: hook },
  brief: `A feral carousel for aesthetic clinic owners. The cover hook is already written and must stay exactly as given. Slides 2 to 4 carry on from the hook in my feral voice, giving a sharp, honest point of view on what clinic owners get wrong, or get sold, about social media and marketing, and what I do differently. ${FERAL_FACTS}`,
}));

// XMAS on the Social Media Sister page: the same Xmas plan hooks (Colloquial or Professional on each post), written as me, the strategist, to clinic owners.
export const SMX_POSTS: ClareSectionPost[] = XMAS_WEEKS.flatMap((w) => w.hooks.map((h, i) => ({
  id: `sx-${h.id}`,
  group: "xmas" as const,
  label: `Week ${w.week}, ${i + 1}: ${w.title}`,
  word: "SISTER",
  feral: true,
  smx: true,
  xmas: { c: h.colloquial, p: h.professional },
  brief: `A Christmas carousel for aesthetic clinic owners, week ${w.week} "${w.title}" of my Christmas plan. Theme: ${w.theme} The cover hook is already written and must stay exactly as given. Slides 2 to 4 take the idea in the hook and turn it into a warm, funny, honest point about how a clinic should run its social media, content and patient connection this Christmas season, written by me as a social media strategist for the aesthetics industry. ${FERAL_FACTS}`,
})));

// BLACK FRIDAY: Social Media Sister's own countdown, 28 hooks over two weeks (Sat 14 Nov to Fri 27 Nov 2026), two posts a day. Each is a dated 5 slide feral carousel with its own reply word.
export const BF_SECTIONS: { id: ClareSectionId; label: string; word: string }[] = [{ id: "blackfriday", label: "Black Friday", word: "BLACK" }];
const BF_ROWS: { n: number; date: string; day: string; slot: number; hook: string; word: string }[] = [{"n": 1, "date": "2026-11-14", "day": "Sat 14 Nov", "slot": 0, "hook": "Black Friday is 13 days away and I’ve been quietly building something that will make half of this industry wince.", "word": "BLACK"}, {"n": 2, "date": "2026-11-14", "day": "Sat 14 Nov", "slot": 1, "hook": "I spent 2026 learning to code at 2am so I could undercut every guru in aesthetics. Watch me.", "word": "BLACK"}, {"n": 3, "date": "2026-11-15", "day": "Sun 15 Nov", "slot": 0, "hook": "47 clients, 6 lost, zero gurus. That’s the whole secret.", "word": "BLACK"}, {"n": 4, "date": "2026-11-15", "day": "Sun 15 Nov", "slot": 1, "hook": "Your last agency posted a sunset and sent an invoice. I’d like a word.", "word": "BLACK"}, {"n": 5, "date": "2026-11-16", "day": "Mon 16 Nov", "slot": 0, "hook": "I’ve never made a clinic a millionaire and I’ll never claim to. I make your shop window so gorgeous people come in. That’s the job.", "word": "BLACK"}, {"n": 6, "date": "2026-11-16", "day": "Mon 16 Nov", "slot": 1, "hook": "20 years in social media, 7 in aesthetics, and I still check the CAP Code before I post. Ask your last agency when they last opened it.", "word": "BLACK"}, {"n": 7, "date": "2026-11-17", "day": "Tue 17 Nov", "slot": 0, "hook": "Everyone selling you a £3,000 course has a PDF and a payment plan. I’ve got 47 clinics and receipts.", "word": "BLACK"}, {"n": 8, "date": "2026-11-17", "day": "Tue 17 Nov", "slot": 1, "hook": "I’m about to make expert social media affordable and it’s going to annoy some very expensive people.", "word": "BLACK"}, {"n": 9, "date": "2026-11-18", "day": "Wed 18 Nov", "slot": 0, "hook": "Time poor? I’ll post it for you. Got a spare hour? Download it and post it yourself. Either way you’re done with sunsets.", "word": "BLACK"}, {"n": 10, "date": "2026-11-18", "day": "Wed 18 Nov", "slot": 1, "hook": "I built a portal where you download the images, grab the captions and crack on. No faff, no waiting for me to reply at midnight.", "word": "BLACK"}, {"n": 11, "date": "2026-11-19", "day": "Thu 19 Nov", "slot": 0, "hook": "My best mate leaving was the best gift I ever got. It’s the reason Black Friday is going to be this good.", "word": "BLACK"}, {"n": 12, "date": "2026-11-19", "day": "Thu 19 Nov", "slot": 1, "hook": "I did two people’s jobs at once, rebuilt my whole business and I’m now cheaper than your coffee run. Go on, ask me how.", "word": "BLACK"}, {"n": 13, "date": "2026-11-20", "day": "Fri 20 Nov", "slot": 0, "hook": "One week to go. If you’ve been waiting for the right moment to sort your socials out, I’d say it’s loading.", "word": "BLACK"}, {"n": 14, "date": "2026-11-20", "day": "Fri 20 Nov", "slot": 1, "hook": "My phone is about to get busy. If you want a spot, get on the list before 27th.", "word": "BLACK"}, {"n": 15, "date": "2026-11-21", "day": "Sat 21 Nov", "slot": 0, "hook": "6 days. 12 months of full management for the price of 6. I’ll say it again slowly for the people at the back.", "word": "BLACK"}, {"n": 16, "date": "2026-11-21", "day": "Sat 21 Nov", "slot": 1, "hook": "Imagine a whole year of your socials sorted and only paying for half of it. Imagine.", "word": "BLACK"}, {"n": 17, "date": "2026-11-22", "day": "Sun 22 Nov", "slot": 0, "hook": "5 days. Five of my best downloads, one day only, a daft little price. I’m not telling you the price yet. Comment BLACK and I’ll tell you first.", "word": "BLACK"}, {"n": 18, "date": "2026-11-22", "day": "Sun 22 Nov", "slot": 1, "hook": "If you’ve been sitting on my free audit, now is the time. After Black Friday I’m back to charging for it.", "word": "BLACK"}, {"n": 19, "date": "2026-11-23", "day": "Mon 23 Nov", "slot": 0, "hook": "4 days. Yorkshire clinics, I’m coming to shoot your content for half price. Comment YORKSHIRE before someone else bags your date.", "word": "YORKSHIRE"}, {"n": 20, "date": "2026-11-23", "day": "Mon 23 Nov", "slot": 1, "hook": "Your clinic photos are older than your last relationship. Fix it.", "word": "YORKSHIRE"}, {"n": 21, "date": "2026-11-24", "day": "Tue 24 Nov", "slot": 0, "hook": "3 days. The AI Photo Studio gives you 20 images of you looking like you’ve slept 8 hours. For a Black Friday price.", "word": "BLACK"}, {"n": 22, "date": "2026-11-24", "day": "Tue 24 Nov", "slot": 1, "hook": "Women over 50, I made something just for you, and you’re going to love it. Comment OVER50.", "word": "OVER50"}, {"n": 23, "date": "2026-11-25", "day": "Wed 25 Nov", "slot": 0, "hook": "2 days. I don’t do discounts often. The last time I did one, it sold out and I got told off by my accountant.", "word": "SPACE"}, {"n": 24, "date": "2026-11-25", "day": "Wed 25 Nov", "slot": 1, "hook": "My development rate spaces are going quickly and I’m vetting every one personally. Comment SPACE if you want to be considered.", "word": "SPACE"}, {"n": 25, "date": "2026-11-26", "day": "Thu 26 Nov", "slot": 0, "hook": "Tomorrow. Alarm set, coffee made, offers loaded. If you’ve been following along, you’re ready.", "word": "BLACK"}, {"n": 26, "date": "2026-11-26", "day": "Thu 26 Nov", "slot": 1, "hook": "Last chance to be on the early list. After midnight I’m too busy selling.", "word": "BLACK"}, {"n": 27, "date": "2026-11-27", "day": "Fri 27 Nov", "slot": 0, "hook": "It’s live. 12 months for the price of 6, one day only, and a very smug woman from Yorkshire.", "word": "BLACK"}, {"n": 28, "date": "2026-11-27", "day": "Fri 27 Nov", "slot": 1, "hook": "Black Friday sells itself to the people who warmed up. You did. Go and collect.", "word": "BLACK"}];
const BF_FACTS = "THE CAMPAIGN FACTS, the only offers and details I may mention, never inventing any other: Black Friday is Friday 27 November 2026. On Black Friday only I am selling 12 months of full social media management for the price of 6, five of my best downloads at a daft one day only price (never state the price, tell people to comment BLACK and I will tell them first), Content Days where I shoot clinic content in Yorkshire at half price (comment YORKSHIRE), the AI Photo Studio with 20 images of the clinician at a Black Friday price, a bundle made just for women over 50 (comment OVER50), and development rate spaces that I vet personally (comment SPACE). My free audit goes back to being paid after Black Friday. There is a portal where clients download the images, grab the captions and post themselves, or I post for them. I have 47 clients, 20 years in social media and 7 in aesthetics, and I check the CAP Code before I post. Never write a price, a discount percentage or a number that is not in these facts.";
export const BF_POSTS: ClareSectionPost[] = BF_ROWS.map((r) => ({
  id: `bf-${r.n}`,
  group: "blackfriday" as const,
  label: `BF ${r.n}, ${r.day}`,
  word: r.word,
  feral: true,
  bf: true,
  date: r.date,
  slot: r.slot,
  xmas: { c: r.hook, p: r.hook },
  brief: `A Black Friday countdown carousel for aesthetic clinic owners, posting on ${r.day}. ${r.n <= 14 ? "Week one, the warm up: build curiosity, trust and a bit of mischief, no hard sell yet." : "Week two, the countdown: the offers are real now, so build urgency with humour and make the reply word the obvious next step."} The cover hook is already written and must stay exactly as given. Slides 2 to 4 carry on from the hook in my feral voice and lead to the reply word ${r.word}. ${BF_FACTS}`,
}));
