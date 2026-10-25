// The men's carousels. Each set is a finished eight slide design whose images live in public/mens/<id>/slide-1.png to slide-8.png,
// kept exactly as designed, including the photos of the man. To add another set, drop its eight PNGs in a new folder and add it here.

export type MensSet = {
  id: string;
  name: string;
  folder: string; // under public/mens
  slides: number;
  topic: string;
  intro: string; // how the caption writer should frame the post
  summary: string; // what the slides say, used so the caption adds something new
};

export const MENS_SETS: MensSet[] = [
  {
    id: "stigma",
    name: "Men have faces too",
    folder: "stigma",
    slides: 8,
    topic: "men's aesthetics without the stigma, a stigma breaking carousel",
    intro: "a men's post, an eight slide carousel for the men's section. It is warm, funny and straight talking, it makes men feel they are allowed to ask questions, and it is just as shareable by the women who tag their husbands, brothers and dads",
    summary: [
      "1. Men have faces too. Controversial, apparently. Men book haircuts, go to the dentist, train, buy skincare. A conversation about your face or skin is not a dramatic personality change. You're allowed to care how you look.",
      "2. 'I don't want anyone to know I've had anything done.' Good. They don't need a press release. For many men the goal is to look like themselves, perhaps fresher or less bothered. A good consultation starts with what YOU notice. Subtle is a perfectly valid brief.",
      "3. What men say in consultations: I just look knackered. This bit annoys me in photos. I don't want to look different. My wife booked this. What they actually mean: can we talk through my options without making a massive thing of it? Yes, that's what the consultation is for.",
      "4. Skin doesn't know you're a bloke. It still has sun exposure, changes with age. Skincare is not a women's department. Suitability and choices are individual.",
      "5. You wouldn't say 'just let it grow naturally' to every man at the barber. Haircut, beard, grey hair, skincare, aesthetic treatment: all a choice. Grooming didn't become a moral issue because it reached your face.",
      "6. He doesn't want to look different, he just doesn't want to look like he's done three night shifts and fought a badger. Men's goals can be ordinary: skin quality, looking less tired, understanding what's available. Ageing isn't the problem. Choice is the point.",
      "7. Men will spend £600 on a tool they'll use twice but say skincare is a bit much. Seven-in-one drill bit set, another almost identical jacket, mysterious cable drawer, professional skin consultation: 'Dunno, seems excessive.' Sir, we need to talk. Tag him at your own risk.",
      "8. Men's aesthetics without the nonsense. You do not have to hate your face, tell everybody, want dramatic change or choose treatment at all. You ARE allowed to ask what your options are. Your face. Your choice. Same rules for everyone. Consultation-led, individual suitability, realistic expectations.",
    ].join("\n"),
  },
  {
    id: "hotter",
    name: "Plot twist: we got hotter",
    folder: "hotter",
    slides: 5,
    topic: "midlife confidence for women over 40, Plot twist: we got hotter",
    intro: "a midlife confidence post, a five slide carousel for women over 40. It celebrates confidence, humour and owning who you are, it makes women laugh and tag their friends, and it quietly shows my clinic is a safe, judgement free place. It never says any treatment makes anyone hotter or younger, never promises a result and never suggests ageing needs fixing",
    summary: [
      "1. Plot twist: we got hotter. Not younger, not smoother, not quieter. HOTTER. Turns out knowing who you are does something extraordinary to a woman. The face changed. The energy upgraded.",
      "2. Things that got hotter after 40: my standards, my clothes, my boundaries, my opinions, my ability to leave early, my taste in music, my refusal to explain myself. We thought the best bit was supposed to be over. Absolutely hilarious.",
      "3. At 25 I wanted everyone to think I was hot. Now I only need me to know. That is a completely different kind of attractive. Approval was exhausting anyway.",
      "4. Nobody warned us about this part of midlife: the part where you stop auditioning. No longer dressing for strangers, shrinking an opinion, saying yes because it's easier. Finally becoming the woman younger you would have been slightly intimidated by. She's a bit of a weapon, actually.",
      "5. We survived frosted lipstick, sun-in and eyebrows we personally destroyed. Of course we're hot. We had no filters, no ring lights, no retakes, just disposable cameras, questionable lighting and unreasonable confidence. Built different.",
    ].join("\n"),
  },
];
