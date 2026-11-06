// THE RYDER CLINIC: the preloaded post names for her own page. A high brow, doctor led clinic,
// so every brief is calm, sincere and exact. No jokes, no prices, no prescription talk.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.

export type RyderGroup = "consult" | "doctor" | "skin" | "trust" | "season" | "fit";

export const RYDER_GROUPS: { id: RyderGroup; label: string }[] = [
  { id: "consult", label: "Your consultation" },
  { id: "doctor", label: "The doctor" },
  { id: "skin", label: "Skin health" },
  { id: "trust", label: "Trust and safety" },
  { id: "season", label: "Seasonal" },
  { id: "fit", label: "Keeping fit at 40" },
];

export type RyderPostType = {
  id: string;
  group: RyderGroup;
  label: string;
  brief: string;
  word: string; // no longer used for the last slide, kept so old posts still load
  kind: "treatment" | "area"; // treatment posts close on the DM line, the rest use a rotating area line
};

// Posts about a treatment, a consultation or booking in. They close on the DM line.
const TREATMENT_IDS = new Set(["c1", "c2", "c3", "c4", "c5", "c6", "t3", "t5", "x1", "x3", "x4", "x5"]);

const p = (id: string, group: RyderGroup, label: string, brief: string, word = ""): RyderPostType => ({ id, group, label, brief, word, kind: TREATMENT_IDS.has(id) ? "treatment" : "area" });

export const RYDER_POST_TYPES: RyderPostType[] = [
  p("c1", "consult", "What happens at a first consultation", "A calm, reassuring walk through a first consultation with a doctor: time to talk, a proper medical history, honest advice, and no decision required on the day.", "CONSULTATION"),
  p("c2", "consult", "Questions to ask before any treatment", "The questions any woman should feel able to ask before any treatment: who is treating me, what are their qualifications, what are the options, what happens if I change my mind.", "CONSULTATION"),
  p("c3", "consult", "Why we never rush a decision", "Why a considered decision is always better than a rushed one, and why a good clinic gives you time and never pressure.", "CONSULTATION"),
  p("c4", "consult", "Who will be looking after you", "The reassurance of knowing exactly who is treating you, their medical training, and that the doctor who consults with you is the doctor who cares for you.", "CONSULTATION"),
  p("c5", "consult", "What to bring to your consultation", "Gentle practical guidance: a list of questions, anything about your health the doctor should know, and the photos or notes that help you describe what you would like.", "CONSULTATION"),
  p("c6", "consult", "A second opinion is always welcome", "Why taking a second opinion is sensible, never an insult, and how a confident clinic welcomes it.", "CONSULTATION"),
  p("d1", "doctor", "Meet your doctor", "An introduction to the doctor behind the clinic in her own warm, measured words: her training, how she works and what a patient can expect from her. Use only general truthful statements, no invented stories or numbers."),
  p("d2", "doctor", "Why I chose medicine", "A reflective, sincere piece on why a doctor chooses medicine and what that care for people means in an aesthetic setting. General and truthful, nothing invented."),
  p("d3", "doctor", "What a medical background changes", "How a medical background shapes the way a doctor assesses, advises and cares: looking at the whole person, health history first, appearance second."),
  p("d4", "doctor", "How I decide what is right for you", "How a doctor decides what is appropriate: listening first, examining carefully, and being honest when the answer is to do less or to do nothing."),
  p("d5", "doctor", "What I will always tell you honestly", "A promise of honesty: what is realistic, what is not suitable and what needs time. Warm and plain spoken."),
  p("s1", "skin", "Caring for your skin through winter", "Calm, practical winter skin care in everyday language: gentle cleansing, protecting the skin barrier, moisturising and why sun protection still matters."),
  p("s2", "skin", "Why sun protection matters every month", "Why daily sun protection is the single most useful habit for skin, in every season, explained kindly and clearly."),
  p("s3", "skin", "Your skin in your forties and fifties", "A reassuring, honest look at how skin changes through midlife, normalising it and encouraging a considered conversation, never a quick fix."),
  p("s4", "skin", "Sleep and your skin", "How rest, hydration and routine show up in the skin, a gentle reminder that the foundations matter most."),
  p("s5", "skin", "What a good skin routine looks like", "A short, sensible routine and why simple, consistent habits beat a shelf full of products."),
  p("s6", "skin", "Why less is often more", "The case for restraint: why a thoughtful, minimal approach usually looks best and why a doctor will sometimes advise doing less."),
  p("t1", "trust", "The standards we hold ourselves to", "The standards a doctor led clinic holds: hygiene, record keeping, informed consent and following professional guidance. General and truthful, no claims of awards or numbers."),
  p("t2", "trust", "Why medical oversight matters", "Why it matters that a qualified doctor oversees your care, and what that means for you in practical terms."),
  p("t3", "trust", "Knowing when the answer is not a treatment", "Why a good doctor will sometimes say a treatment is not right for you, and why that honesty is a sign of a safe clinic."),
  p("t4", "trust", "Choosing a practitioner you can trust", "Gentle guidance on what to look for in a practitioner: qualifications, a proper consultation, clear information and no pressure.", "CONSULTATION"),
  p("t5", "trust", "What good aftercare looks like", "What a patient should expect after any treatment: clear written advice, a way to reach the clinic and a follow up when needed."),
  p("t6", "trust", "Your questions, answered honestly", "An open invitation to ask anything, with reassurance that no question is silly and every question gets a straight answer.", "CONSULTATION"),
  p("x1", "season", "A gift voucher for someone who deserves a pause", "A gracious, understated gift voucher post: the gift of a considered consultation and time with a doctor, for someone who gives a great deal to others.", "VOUCHER"),
  p("x2", "season", "Looking after yourself this Christmas", "A tender, sincere reminder to look after yourself during a busy Christmas, with rest and small kindnesses to yourself."),
  p("x3", "season", "Planning ahead for the party season", "Why planning ahead matters if there is an event in the diary, and why an early conversation leaves time for everything to be done calmly.", "CONSULTATION"),
  p("x4", "season", "Our last appointments before Christmas", "A courteous note that the diary is closing for Christmas and that a few appointments remain for those who would like to begin the new year looked after.", "CONSULTATION"),
  p("x5", "season", "A calm start to the new year", "A quiet, hopeful new year post about beginning the year with a considered plan and a conversation, rather than resolutions.", "CONSULTATION"),
  p("fit1", "fit", "Keeping fit at 40, the honest version", "A real, friendly post about keeping fit at 40: finding something you will actually keep doing rather than a punishing plan. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit2", "fit", "Keeping fit at 40, strength and energy", "A warm post about why so many women at 40 enjoy strength work and moving daily, said generally and kindly, nothing medical. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit3", "fit", "Keeping fit at 40, showing up on tired days", "A relatable post for the busy woman at 40 who wants to look after herself, with a dry sense of humour about the tired days. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
];

export const RYDER_CLINIC = "The Ryder Clinic";
