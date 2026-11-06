// CLARE CONNOLLY AESTHETICS, Wakefield: 6 sections of 6 posts each, the same layout as the Castle Clinic and NO 1 pages.
// One section per treatment she lists on her Instagram and in her Getting to know you answers (skin boosters, polynucleotides,
// skin peels, dermal fillers), plus "Keeping fit at 40" and "GLP1 volume loss" (consultation promotion only, nothing about what it is for).
// Her voice: honest, realistic, friendly and hard working. Natural, lifting and regenerative. She manages expectations and never
// recommends anything for the sake of it. No prices, no promises, no medicine names.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.

export type ClareSectionId = "boosters" | "poly" | "peels" | "filler" | "fit" | "glp1" | "about" | "safety";

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

export type ClareSectionPost = { id: string; group: ClareSectionId; label: string; brief: string; word: string };

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

export const CLARE_SECTION_CLINIC = { name: "Clare Connolly Aesthetics", area: "Wakefield" } as const;
