// NO 1 BODY SCULPTING: the 44 carousel post types for her own page.
// Prices are left out on purpose. Black Friday bundles will be added when she has the details.

export type No1Group =
  | "reasons"
  | "skin"
  | "volume"
  | "weightloss"
  | "menopause"
  | "tweets"
  | "about"
  | "trust";

export type No1Treatment = {
  id: string;
  name: string;
  word: string; // the comment word on the last slide
  about: string; // safe, plain description the writer may use
};

export const NO1_TREATMENTS: No1Treatment[] = [
  { id: "ems", name: "EMS HIEMT", word: "EMS", about: "high intensity electromagnetic muscle stimulation, you lie down and the sessions are done on the body without needles" },
  { id: "rf", name: "Radiofrequency", word: "RADIOFREQUENCY", about: "a warming treatment used to support skin that feels firmer, done in a course of sessions" },
  { id: "cav", name: "Cavitation", word: "CAVITATION", about: "a non invasive body contouring treatment using ultrasound, usually part of a course" },
  { id: "pad4", name: "4 paddle EMS", word: "PADDLES", about: "an EMS session using four paddles, so more than one area can be treated in the same visit" },
  { id: "intimate", name: "Intimate wellness machine", word: "INTIMATE", about: "a seated comfort and confidence treatment for the intimate area. Never claim it treats bladder control or any condition. Keep it about comfort, confidence and a private, kind consultation" },
  { id: "lymph", name: "Body lymphatic drainage", word: "LYMPHATIC", about: "a gentle treatment that many clients find relaxing and that leaves legs and middles feeling lighter" },
  { id: "poly", name: "Polynucleotides", word: "POLY", about: "a skin quality treatment that supports skin that looks and feels more nourished. Do not describe the method" },
  { id: "lymphface", name: "Lymphatic facial", word: "FACIAL", about: "a gentle facial using drainage techniques, relaxing, a good one for tired and puffy looking faces" },
  { id: "needle", name: "Microneedling", word: "MICRONEEDLING", about: "a skin treatment used to support texture and tone, done in a course, with a proper consultation first" },
  { id: "derma", name: "Dermaplaning", word: "DERMAPLANING", about: "a gentle exfoliating treatment that leaves skin smooth and makeup sitting better" },
  { id: "peel", name: "Amiko chemical peel", word: "PEEL", about: "a skin peel from the Amiko range, chosen for the skin in front of me, always after a consultation" },
  { id: "lips", name: "Amiko lip skin boosters", word: "LIPS", about: "an Amiko lip skin treatment for dry, tired lips, about hydration and how the lips feel" },
  { id: "led", name: "LED red light", word: "RED LIGHT", about: "a relaxing light treatment, you lie back and it is over before you have finished the playlist" },
];

export type No1PostType = {
  id: string;
  group: No1Group;
  label: string;
  brief: string; // what the carousel is about, for the writer
  word: string; // comment word, or "" for the tag a friend close
  treatmentId?: string; // set for the "3 reasons" posts
};

export const NO1_GROUPS: { id: No1Group; label: string; note: string }[] = [
  { id: "reasons", label: "3 Reasons to Have", note: "One for each of her 13 treatments" },
  { id: "skin", label: "3 Things I Can Do For Your Skin", note: "Skin posts" },
  { id: "volume", label: "Volume loss and why it happens", note: "Muscle, skin and shape" },
  { id: "weightloss", label: "Weight loss journeys", note: "What happens to skin and muscle along the way" },
  { id: "menopause", label: "Menopause", note: "Memes, jokes and midlife body changes" },
  { id: "tweets", label: "Weight loss tweets", note: "Short, blunt and shareable" },
  { id: "about", label: "About her", note: "Ralph, the boys, the gym, why she does this" },
  { id: "trust", label: "Trust", note: "Consultation and what to ask any clinic" },
];

const reasons: No1PostType[] = NO1_TREATMENTS.map((t) => ({
  id: `reasons-${t.id}`,
  group: "reasons" as const,
  label: `3 Reasons to Have ${t.name}`,
  treatmentId: t.id,
  word: t.word,
  brief: `Three honest, specific reasons a woman might choose ${t.name}. Facts you may use: ${t.about}. Slide 1 is a hook that names the treatment. Slides 2 to 4 are one reason each.`,
}));

const skin = (id: string, label: string, brief: string): No1PostType => ({ id: `skin-${id}`, group: "skin", label, word: "SKIN", brief });
const vol = (id: string, label: string, brief: string): No1PostType => ({ id: `vol-${id}`, group: "volume", label, word: "VOLUME", brief });
const wl = (id: string, label: string, brief: string, word = "JOURNEY"): No1PostType => ({ id: `wl-${id}`, group: "weightloss", label, word, brief });
const men = (id: string, label: string, brief: string, word = ""): No1PostType => ({ id: `men-${id}`, group: "menopause", label, word, brief });
const tw = (id: string, label: string, brief: string): No1PostType => ({ id: `tw-${id}`, group: "tweets", label, word: "", brief });
const ab = (id: string, label: string, brief: string): No1PostType => ({ id: `about-${id}`, group: "about", label, word: "", brief });
const tr = (id: string, label: string, brief: string): No1PostType => ({ id: `trust-${id}`, group: "trust", label, word: "", brief });

export const NO1_POST_TYPES: No1PostType[] = [
  ...reasons,

  skin("dull", "3 Things I Can Do For Dull Skin", "Three things I can do for dull skin, chosen from dermaplaning, the Amiko peel, microneedling, polynucleotides and LED red light. Say what each is for in plain words."),
  skin("winter", "3 Things I Can Do For Tired Winter Skin", "Three things I can do for tired, winter skin, from the lymphatic facial, polynucleotides, LED red light, dermaplaning and Amiko lip skin boosters."),
  skin("texture", "3 Things I Can Do For Rough Texture", "Three things I can do for rough, uneven skin texture, from microneedling, the Amiko peel and dermaplaning."),
  skin("lips", "3 Things I Can Do For Dry Lips", "Three things I can do for dry, tired lips with the Amiko lip skin boosters, framed as hydration and how lips feel. Never about size or shape."),
  skin("party", "3 Things I Can Do For Party Ready Skin", "Three things I can do before a party season event: dermaplaning for smooth makeup, a lymphatic facial for puffiness, LED red light. Say how far ahead to book."),
  skin("40s", "3 Things I Can Do For Skin In Your 40s", "Three things I can do for skin in your 40s and 50s, with humour: polynucleotides, microneedling, the Amiko peel. Keep it honest about what skin treatments can and cannot do."),

  vol("muscle", "Why Muscle Goes Quiet", "Why muscle tone quietly reduces from our 30s and 40s, said simply and with humour, then how EMS HIEMT supports muscle tone. No promises."),
  vol("skin", "Why Skin Loses Its Bounce", "Why skin loses bounce as we age, said simply and kindly, then what radiofrequency and the skin treatments can support."),
  vol("middle", "The Midlife Middle", "The midlife middle: why our shape changes in our 40s and 50s, said with humour, and how EMS and cavitation fit into a plan. No weight loss promises."),
  vol("bum", "Where Did My Bum Go", "A funny take on losing shape in the bum and legs with age, and how the 4 paddle EMS can support tone. Dry and playful, not mean to anyone's body."),
  vol("fast", "Why It Happens Faster In Your 40s And 50s", "Why changes in muscle and skin seem to speed up in our 40s and 50s, said in plain words with no scare tactics, and how a consultation helps decide what is sensible."),
  vol("plan", "What I Can Do About It", "A calm overview of what I can offer for volume loss in body and skin: EMS HIEMT, the 4 paddle EMS, radiofrequency and cavitation. Consultation first, results vary."),

  wl("skin", "What Happens To Your Skin Along The Way", "When weight changes, skin can feel looser. Explain this kindly, then how radiofrequency and the skin treatments can support skin that feels firmer. Never name any medication or drug."),
  wl("muscle", "What Happens To Your Muscle", "When weight comes down, muscle tone can go with it. Explain kindly, then how EMS supports muscle tone. Never name any medication or drug."),
  wl("face", "The Face Nobody Warns You About", "Weight changes can leave the face looking tired or thinner than expected. Kind, funny, honest. Mention the lymphatic facial, polynucleotides and LED red light as options. Never name any medication or drug."),
  wl("ask", "What To Ask At Your Consultation", "A list of questions to bring to a consultation about body and skin support during a weight loss journey. No medication names. Close on booking a chat with me.", "CHAT"),
  wl("support", "How I Support You", "How I support women on a weight loss journey with body and skin treatments, warmly and without judgement. Never name any medication or drug.", "SUPPORT"),

  men("memes1", "Menopause Memes, Set One", "Four short, relatable menopause jokes in a dry, playful voice, for a woman in her 40s or 50s. Slide 1 is the best joke. Example flavour: jeans that fit on Monday and formed a union by Thursday. No swearing."),
  men("memes2", "Menopause Memes, Set Two", "Four more short menopause jokes about sleep, hot flushes, the memory and the midlife middle. Dry and playful. No swearing."),
  men("body", "What Your Body Is Doing And Why", "A warm, plain explanation of the body changes many women notice in midlife: shape, muscle, skin and energy. Not medical advice. Close by suggesting a chat with me about the options I offer. Never mention hormone treatment or any prescription."),
  men("comfort", "Comfort And Confidence", "A kind, private post about comfort and confidence in the intimate area, about the intimate wellness machine and a calm, private consultation. Never claim it treats bladder control or any condition.", "INTIMATE"),
  men("bloat", "Bloating And Lymphatic Drainage", "Midlife bloating and heavy legs, said with humour, and how body lymphatic drainage can leave you feeling lighter. No promises.", "LYMPHATIC"),

  tw("one", "Weight Loss Tweets, Set One", "Four short, blunt, funny tweet style lines about the downsides of losing weight that nobody mentions: loose skin, losing muscle, the tired face. Slide 1 is the best line."),
  tw("two", "Weight Loss Tweets, Set Two", "Four more short tweet style lines about the things people notice after losing weight, like clothes fitting differently and the mirror needing a conversation."),
  tw("out", "Things Nobody Says Out Loud", "Four short lines about the things nobody says out loud about changing body shape, warm and honest, nothing mean about bodies."),

  ab("ralph", "Meet Ralph", "A funny post introducing Ralph, her sausage dog. Short, warm, a little daft. Tie it lightly to being comfortable in your own skin."),
  ab("gym", "Gym, Sons And Me", "A warm post about her life outside the clinic: the gym, her sons and her friends. Real, down to earth and honest about not being about the money."),
  ab("why", "Why I Do This", "Why she does this work: honesty, kindness and making women feel comfortable showing their bodies. Glamorous, warm, loyal, straight talking."),
  ab("day", "What A Day In My Clinic Looks Like", "A light, funny walk through a day in her clinic, in general terms only. No invented clients, names or stories."),

  tr("consult", "What Happens At A Consultation", "What really happens at a consultation with me: a proper chat, time to ask questions, no pressure, no judgement about showing your body, and honesty if it is not for you."),
  tr("ask", "Questions To Ask Any Clinic Before You Book", "Questions any woman should ask any clinic before booking: training, how they handle the unexpected, how long the consultation is, what the aftercare is."),
];

export const NO1_CLINIC = "NO 1 BODY SCULPTING";
export const NO1_AREA = "Birmingham";
export const NO1_COLOURS = { ink: "#2f2f2f", grey: "#8a8a8a", soft: "#f3f3f1", white: "#ffffff" };
