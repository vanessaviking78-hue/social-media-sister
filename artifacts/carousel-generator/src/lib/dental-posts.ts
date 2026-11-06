// CASTLE CLINIC and DR KATHRYN BELL: the preloaded post names for their own dental pages.
// Professional, warm and exact, in the dentist's own first person voice. No prices, no promises.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.

export type DentalGroup =
  | "root" | "invisalign" | "bonding" | "kids" | "importance" | "adhd" | "didyouknow" | "myths"
  | "electric" | "brushing" | "checkup" | "sensitive" | "glp1" | "hygiene" | "whitening" | "about" | "fit" | "safety";

export const DENTAL_GROUPS: { id: DentalGroup; label: string }[] = [
  { id: "root", label: "Root canal" },
  { id: "invisalign", label: "Invisalign" },
  { id: "bonding", label: "Composite bonding" },
  { id: "kids", label: "Children's oral health" },
  { id: "importance", label: "Why oral health matters" },
  { id: "adhd", label: "ADHD oral health" },
  { id: "didyouknow", label: "Did you know" },
  { id: "myths", label: "Mythbusting" },
  { id: "electric", label: "Electric vs manual" },
  { id: "brushing", label: "Toothbrushing tips" },
  { id: "checkup", label: "Check ups" },
  { id: "sensitive", label: "Sensitive teeth" },
  { id: "glp1", label: "GLP-1 medicines and your mouth" },
  { id: "hygiene", label: "Hygiene appointments" },
  { id: "whitening", label: "Teeth whitening" },
  { id: "about", label: "About us / about me" },
  { id: "fit", label: "Keeping fit at 40" },
  { id: "safety", label: "Safety" },
];

export type DentalPostType = {
  id: string;
  group: DentalGroup;
  label: string;
  brief: string;
  kind: "treatment" | "area"; // treatment posts close on the DM line, the rest use a rotating area line
};

// Groups that are about a treatment or an appointment close on the DM line.
const TREATMENT_GROUPS = new Set<DentalGroup>(["root", "invisalign", "bonding", "checkup", "hygiene", "whitening"]);

const p = (id: string, group: DentalGroup, label: string, brief: string): DentalPostType => ({ id, group, label, brief, kind: TREATMENT_GROUPS.has(group) ? "treatment" : "area" });

export const DENTAL_POST_TYPES: DentalPostType[] = [
  // ROOT CANAL
  p("r1", "root", "What a root canal actually is", "A calm, clear explanation of what a root canal treatment is: the inside of the tooth, why the nerve and pulp can become infected or inflamed, and that the aim is to save the natural tooth. Reassuring, no drama."),
  p("r2", "root", "Signs a tooth may need root canal treatment", "The general signs that mean a tooth should be looked at: lingering pain with hot or cold, pain on biting, swelling, a darkened tooth, a spot on the gum. Say only a dentist can tell, and that anyone with these signs should be seen promptly."),
  p("r3", "root", "What happens during a root canal", "A gentle, step by step walk through the appointment in plain language: numbing the area, cleaning the inside of the tooth, sealing it, and then a restoration to protect it. Never say it is painless, say it is done with local anaesthetic and your comfort comes first."),
  p("r4", "root", "Why saving your own tooth matters", "Why keeping a natural tooth where it can be saved is usually worthwhile: chewing, the bite, neighbouring teeth, and the bone. General and truthful, no promises about outcomes."),
  p("r5", "root", "Root canal fears, answered kindly", "Gently addressing the fear many people carry about root canal treatment. Acknowledge it warmly, explain how modern care and local anaesthetic are used, and invite nervous patients to talk it through first."),
  p("r6", "root", "Looking after a tooth after root canal treatment", "General aftercare after root canal treatment: take care when eating until the numbness wears off, follow the dentist's advice, keep brushing and cleaning as normal, return for the final restoration, and get in touch if anything feels wrong."),

  // INVISALIGN
  p("i1", "invisalign", "How Invisalign works", "A friendly explanation of clear aligner treatment: a series of custom made, removable aligners that move the teeth gradually, with a dentist planning each stage. No promises about results or timings."),
  p("i2", "invisalign", "Is Invisalign right for you", "Why not everyone is suitable for clear aligners and why a proper assessment comes first. Mention a check of gum and tooth health before starting. Honest and unpressured."),
  p("i3", "invisalign", "Living with clear aligners", "What day to day life with aligners is like in general terms: wearing them as advised, taking them out to eat and drink, cleaning them and brushing before putting them back in."),
  p("i4", "invisalign", "Why retainers matter after straightening", "Why teeth can move back after treatment and why wearing retainers as advised is part of looking after the result. Kind, practical and without claims."),
  p("i5", "invisalign", "Straightening teeth is about more than looks", "How well aligned teeth can be easier to clean and how a comfortable bite matters, alongside the confidence of a smile you like. Careful not to overclaim health benefits."),
  p("i6", "invisalign", "Thinking about straightening your teeth", "A warm invitation for someone who has quietly wondered about straightening their teeth for years. Normalise it, say it is never too late and that a conversation costs nothing but time. Do not mention prices."),

  // COMPOSITE BONDING
  p("b1", "bonding", "What composite bonding is", "A clear explanation of composite bonding: tooth coloured material shaped and set onto the tooth to improve the shape, size or small chips, often with little or no removal of tooth. Say suitability is assessed first."),
  p("b2", "bonding", "What happens at a bonding appointment", "A calm walk through a bonding appointment: a conversation about what you would like, preparing the tooth, shaping the material, setting it with a light and polishing. General, no promises."),
  p("b3", "bonding", "Is bonding right for your smile", "Who bonding may suit and who it may not, such as someone with significant crowding or gum problems. Honest and balanced, with a dentist's assessment first."),
  p("b4", "bonding", "Caring for your bonding", "Practical, general care for bonded teeth: good brushing and cleaning, regular hygiene visits, being careful with very hard foods, pens and nails, and telling your dentist if anything chips. Say it can need maintenance over time."),
  p("b5", "bonding", "Bonding or veneers", "A fair and simple comparison of the two ideas without declaring a winner: how they differ in general terms and why a dentist helps you choose. Never criticise either option."),
  p("b6", "bonding", "A small change to a smile", "Why a subtle change can feel significant, written warmly. Focus on feeling comfortable in your own smile and a natural look, with no promises."),

  // CHILDREN'S ORAL HEALTH TIPS
  p("k1", "kids", "When to bring your child to the dentist", "General guidance that children are welcome from a very young age, that early visits are about getting used to the dentist, and that NHS and local advice applies. No invented rules."),
  p("k2", "kids", "Brushing your child's teeth", "Practical tips for brushing little teeth: starting as soon as the first tooth appears, a smear or small pea of the right strength of fluoride toothpaste as advised, helping until they are older, twice a day including last thing at night."),
  p("k3", "kids", "Sugar, snacks and little teeth", "Gentle guidance on how often rather than how much sugar matters, water and milk as drinks between meals, and keeping sweet treats to mealtimes. Kind, not preachy."),
  p("k4", "kids", "Helping a nervous child at the dentist", "Warm tips for parents: stay calm, avoid words like hurt, let the dentist explain, and make the first visit short and friendly. Reassuring for both parent and child."),
  p("k5", "kids", "Dummies, thumbs and teeth", "General, kind information about dummies and thumb sucking and how they can affect developing teeth if they go on for a long time, with encouragement to ask the dentist for advice. Never shame a parent."),
  p("k6", "kids", "Making toothbrushing fun", "Light, practical ideas to make brushing a happy habit: a favourite song, a sticker chart, brushing together, letting them choose their toothbrush. Gentle and charming."),

  // THE IMPORTANCE OF ORAL HEALTH
  p("o1", "importance", "Your mouth is part of your whole body", "How oral health is connected with general health in general terms, for example that gum disease and some general health conditions can be linked. Careful, truthful and not alarming, with no statistics."),
  p("o2", "importance", "Why bleeding gums should not be ignored", "Why gums that bleed when you brush are a sign to look after them better and to be checked, not a reason to stop brushing. Calm and practical."),
  p("o3", "importance", "Prevention is kinder than repair", "The case for looking after teeth little and often so treatment stays small. Warm and encouraging, never guilt."),
  p("o4", "importance", "What your smile says about how you feel", "A sincere piece on how comfortable teeth let you eat, speak, laugh and be photographed without thinking about it. Emotional and gentle, no claims."),
  p("o5", "importance", "Looking after your mouth in midlife", "Reassuring information for women in midlife: hormonal changes can affect gums and the mouth, so regular check ups matter. General and truthful."),
  p("o6", "importance", "The small habits that protect your teeth", "A short, kind list of the foundations: brushing twice a day, cleaning between teeth, less frequent sugar, regular check ups. Simple and encouraging."),

  // ADHD ORAL HEALTH FUN FACTS
  p("a1", "adhd", "Brushing teeth with ADHD", "A warm, understanding post about why daily routines like brushing can be harder with ADHD, and that this is common and nothing to be ashamed of. Offer kind, practical ideas. Light and curious in tone, never clinical or condescending."),
  p("a2", "adhd", "Tricks that make brushing stick", "Practical ideas people with ADHD can use: linking brushing to something you already do, keeping the toothbrush somewhere visible, a timer or music, and an electric brush with a built in timer. Friendly and encouraging."),
  p("a3", "adhd", "Dry mouth and some medicines", "That some medicines, including some used for ADHD, can cause a dry mouth, and why a dry mouth matters for teeth. Suggest sipping water, sugar free gum and mentioning medicines to your dentist. Never advise anyone to change or stop a medicine, tell them to speak to their prescriber."),
  p("a4", "adhd", "Teeth grinding and stress", "General information that teeth grinding and clenching are common, can be linked with stress, and can wear teeth over time. Suggest speaking to the dentist about protecting teeth. Do not link it to any one condition as a fact."),
  p("a5", "adhd", "Snacking, sugar and a busy brain", "A kind post about grazing and sugary drinks and how frequent sugar matters more than the amount. Suggest easy swaps and keeping water nearby. Light and understanding."),
  p("a6", "adhd", "A dentist who gets it", "An inviting post for patients who find appointments hard because of forgetfulness, sensory sensitivity or anxiety. Say they can tell the team what helps, ask for breaks and have things explained clearly. Warm and welcoming."),

  // DID YOU KNOW DENTIST FACTS
  p("f1", "didyouknow", "Did you know: enamel", "A fun, well established fact about tooth enamel being the hardest substance in the body and that it cannot grow back, so protecting it matters. Curious and light, nothing invented."),
  p("f2", "didyouknow", "Did you know: saliva", "A fun, well established fact about how saliva helps wash away food, neutralise acids and protect teeth. Curious and charming."),
  p("f3", "didyouknow", "Did you know: your teeth are unique", "A fun, well established fact that no two sets of teeth are exactly the same, and why that is part of why a personal plan matters."),
  p("f4", "didyouknow", "Did you know: plaque", "A fun, well established fact that plaque is a soft film of bacteria that builds up all day and, left alone, hardens into tartar that only a professional can remove. Simple and clear."),
  p("f5", "didyouknow", "Did you know: your toothbrush", "A fun, well established fact on replacing the toothbrush or brush head about every three months or sooner when the bristles fray, and why worn bristles clean less well."),
  p("f6", "didyouknow", "Did you know: the mouth is busy", "A fun, well established fact that the mouth is home to a great many bacteria, most of them harmless, and that cleaning keeps the balance healthy. Light and friendly."),

  // MYTHBUSTING
  p("m1", "myths", "Myth: brushing harder cleans better", "Gently busting the myth that scrubbing hard cleans better. Explain that firm pressure can wear enamel and irritate gums and that a gentle, thorough technique works best."),
  p("m2", "myths", "Myth: sugar is the only cause of decay", "Gently busting the myth. Explain that how often sugar and acid reach the teeth matters, along with plaque left on teeth and not cleaning well. Kind and clear."),
  p("m3", "myths", "Myth: if it does not hurt, it is fine", "Gently busting the myth that no pain means no problem. Explain that decay and gum disease can be quiet in the early stages, which is why check ups matter."),
  p("m4", "myths", "Myth: bleeding gums mean stop brushing", "Gently busting the myth. Explain that bleeding usually shows inflamed gums that need better cleaning, and that a dentist should check if it continues."),
  p("m5", "myths", "Myth: natural remedies replace toothpaste", "Gently busting the myth that charcoal, oil pulling or home remedies can replace fluoride toothpaste. Be fair and kind, and say fluoride toothpaste is the proven basic."),
  p("m6", "myths", "Myth: baby teeth do not matter", "Gently busting the myth. Explain that baby teeth hold space for adult teeth and help children eat and speak, so looking after them matters."),

  // ELECTRIC TOOTHBRUSH VS NORMAL
  p("e1", "electric", "Electric or manual toothbrush", "A fair, balanced look at both: either can clean well when used properly, and many people find an electric brush easier to use well. Never declare one a winner for everyone."),
  p("e2", "electric", "Who benefits most from an electric toothbrush", "General groups who often find electric brushes helpful: people with limited dexterity, braces or aligners, busy mornings and anyone who forgets to brush for long enough. Warm and practical."),
  p("e3", "electric", "How to use an electric toothbrush properly", "Simple technique: let the brush do the work, guide it slowly tooth by tooth, hold it at a gentle angle to the gum line, do not scrub, and keep to the timer."),
  p("e4", "electric", "Choosing a manual toothbrush well", "How to choose a manual brush: a small head, soft bristles, a comfortable grip, and replacing it often. Encouraging for anyone who prefers manual."),
  p("e5", "electric", "The brush is only half the job", "That any toothbrush misses the spaces between teeth, so interdental brushes or floss matter too. Kind and practical."),
  p("e6", "electric", "Is your toothbrush due a change", "A gentle reminder to check the bristles or brush head. Explain the general guidance of every three months and why it matters. Light and friendly."),

  // TOOTHBRUSHING TIPS
  p("t1", "brushing", "How long should you really brush", "The general guidance of two minutes, twice a day, with ideas for making two minutes feel easy. Warm and encouraging."),
  p("t2", "brushing", "The best time to brush", "General guidance on brushing last thing at night and at one other time, and why last thing at night matters. Mention that after acidic food or drink it can be kinder to wait before brushing."),
  p("t3", "brushing", "Spit, do not rinse", "The general guidance to spit out toothpaste after brushing rather than rinsing with lots of water, so the fluoride keeps working. Simple, surprising and friendly."),
  p("t4", "brushing", "Do not forget the spaces in between", "Why cleaning between teeth with interdental brushes or floss matters, in kind practical terms, and that a dentist or hygienist can show the right size."),
  p("t5", "brushing", "A gentle technique that works", "A simple technique: a small circular or short gentle motion at the gum line, angle the bristles, take your time over every surface. No scrubbing."),
  p("t6", "brushing", "Choosing a fluoride toothpaste", "Why fluoride toothpaste is the proven basic, that the amount of fluoride matters, and that a dentist can recommend what suits you. Never name a brand."),

  // HOW OFTEN DO I NEED A CHECK UP
  p("c1", "checkup", "How often do you need a check up", "That the right interval is different for everyone and is decided by your dentist based on your mouth, rather than a fixed six months for all. Reassuring and clear, no invented numbers."),
  p("c2", "checkup", "What happens at a dental check up", "A relaxed walk through a check up: a chat about your health and any concerns, a careful look at teeth, gums and soft tissues, and advice tailored to you. Gentle and welcoming."),
  p("c3", "checkup", "Why we check more than your teeth", "That a check up includes the gums, tongue, cheeks, jaw and a mouth cancer screen, and why catching things early matters. Calm, never alarming."),
  p("c4", "checkup", "It has been a while, and that is okay", "A warm, no judgement post for anyone who has not been to the dentist in a long time. Say they will be welcomed and never told off, and that the first step is simply a conversation."),
  p("c5", "checkup", "Nervous about the dentist", "A kind post for nervous patients: tell the team, agree a signal to pause, ask questions, take things at your own pace. Reassuring and human."),
  p("c6", "checkup", "What to tell your dentist", "The helpful things to share at an appointment: medicines you take, changes in health, worries about your teeth, and anything you have noticed. Friendly and practical."),

  // SENSITIVE TEETH INFO
  p("s1", "sensitive", "Why teeth become sensitive", "A calm explanation of common causes: worn enamel, receding gums, exposed root surfaces, decay and grinding. Say a dentist can find the cause."),
  p("s2", "sensitive", "Everyday habits that can wear enamel", "General habits that can contribute to sensitivity: frequent acidic food and drink, brushing too hard and grinding teeth. Kind, not preachy."),
  p("s3", "sensitive", "Toothpaste for sensitive teeth", "Gentle general guidance that toothpastes made for sensitivity exist and take consistent use over time to help. Never promise results and never name a brand. Suggest a dentist check if it persists."),
  p("s4", "sensitive", "When sensitivity needs a dentist", "When to get sensitivity checked: if it is sharp, lingers, wakes you at night, affects one tooth or comes with swelling. Reassuring and clear."),
  p("s5", "sensitive", "Hot, cold and sweet", "Why hot, cold or sweet food can sting and what it can mean in general terms, with a friendly invitation to ask. Light touch."),
  p("s6", "sensitive", "Being gentle with sensitive teeth", "Practical comfort tips: a soft brush, gentle technique, lukewarm water and not dismissing it. Warm and kind."),

  // EFFECTS OF GLP-1 MEDS ON THE MOUTH
  p("g1", "glp1", "GLP-1 medicines and your mouth", "A calm introduction for patients taking GLP-1 medicines for weight loss or diabetes: these medicines can have effects that matter for oral health, so it helps to tell your dentist. Use the general term only, never a brand name, never any dose or advice about taking or stopping them."),
  p("g2", "glp1", "Dry mouth and why it matters", "Why a dry mouth can occur with some medicines, including some patients on GLP-1 medicines, and why saliva protects teeth. Suggest sipping water, sugar free gum and regular check ups. Speak to the prescriber about medicines, never advise changes."),
  p("g3", "glp1", "Sickness, acid and your teeth", "If someone is sick or has acid reflux, stomach acid can affect enamel. Advise rinsing the mouth with plain water and waiting before brushing. Mention that some people on GLP-1 medicines experience nausea, and to speak to their prescriber about it."),
  p("g4", "glp1", "Eating less and eating differently", "How changes in appetite and eating patterns can change what teeth are exposed to, for example grazing or sipping sweet drinks. Share kind, general tips for protecting teeth."),
  p("g5", "glp1", "Tell your dentist what you take", "Why sharing your full medicines list at every appointment helps your dentist look after you, in warm and welcoming terms. Never judge or advise on the medicine itself."),
  p("g6", "glp1", "Looking after your mouth on your health journey", "A supportive post for anyone working on their health, including those on weight loss medicines: keeping up with brushing, cleaning between teeth and regular check ups. Warm and non judgemental. Use the general term GLP-1 medicines only."),

  // DENTAL HYGIENE APPOINTMENTS
  p("h1", "hygiene", "What a hygiene appointment involves", "A relaxed explanation of a hygiene appointment: a thorough clean to remove plaque and tartar, polishing, and advice on keeping your mouth healthy at home. Warm and welcoming."),
  p("h2", "hygiene", "Why a hygienist matters", "Why a hygienist is a valued part of the team: they are experts in preventing gum disease and helping you clean well at home. Kind and clear."),
  p("h3", "hygiene", "Does a hygiene appointment hurt", "An honest, gentle answer: most people find it comfortable, some areas can feel tender, especially if gums are inflamed, and the team can adjust things for comfort. Never say it is painless."),
  p("h4", "hygiene", "Tartar, plaque and why brushing alone is not enough", "That tartar is hardened plaque that brushing cannot remove, which is why professional cleaning matters. Simple and non scolding."),
  p("h5", "hygiene", "Stained teeth and professional cleaning", "That a professional clean can remove surface stains from things like tea, coffee and red wine, and that it differs from whitening. No promises."),
  p("h6", "hygiene", "How often to see the hygienist", "That the right gap between hygiene visits varies from person to person and is advised by your dentist or hygienist. No fixed numbers."),

  // TEETH WHITENING DOS AND DON'TS
  p("w1", "whitening", "Teeth whitening: the dos", "A friendly list of dos: have a dental check first, choose a registered dental professional, follow the advice you are given, and keep up good cleaning. Mention that teeth whitening should be done by a registered dental professional."),
  p("w2", "whitening", "Teeth whitening: the don'ts", "A kind list of don'ts: do not use unregulated kits, do not whiten if you have untreated decay or gum problems, do not overdo it, do not expect restorations to change colour. Never name a brand."),
  p("w3", "whitening", "Why whitening should be done by a professional", "That in the UK, whitening is a dental treatment that should be carried out by a registered dental professional, and why that matters for safety. Calm and non scaremongering."),
  p("w4", "whitening", "Will whitening make my teeth sensitive", "An honest answer: some people notice temporary sensitivity, which is why assessment and advice come first. Reassuring and balanced, no promises."),
  p("w5", "whitening", "Living with whitened teeth", "General aftercare: be mindful of heavily staining food and drink for a short time, keep up cleaning, and keep regular hygiene visits. Do not claim how long results last."),
  p("w6", "whitening", "Whitening myths", "Gently busting myths: charcoal, lemon juice and baking soda are not a safe route to whiter teeth, and whitening cannot change fillings, crowns or veneers. Kind and clear."),

  // ABOUT US / ABOUT ME
  p("u1", "about", "Meet the clinic", "A warm introduction to the practice in the dentist's own words: who we are, how we care for patients and what it feels like to visit. Use only general, truthful statements. Never invent a number, an award, a year or a team member's name."),
  p("u2", "about", "Why I became a dentist", "A reflective, sincere piece on why someone chooses dentistry and caring for people's smiles. Keep it general and truthful, with nothing invented."),
  p("u3", "about", "What I love about my work", "What a dentist loves about looking after patients: the trust, the relief on a nervous face, helping someone feel at ease. Warm and specific in feeling, general in fact."),
  p("u4", "about", "What it feels like to walk through our door", "A gentle description of a welcoming visit: being greeted kindly, never rushed, and having time to ask questions. General and truthful."),
  p("u5", "about", "How I look after nervous patients", "How the team and I make nervous patients feel safe: listening first, explaining everything, going at your pace and agreeing a pause signal. Warm and reassuring."),
  p("u6", "about", "Things I will always be honest about", "A promise of honest, unpressured dentistry: what you need, what can wait and what is simply not right for you. Calm and plain spoken."),
  p("fit1", "fit", "Keeping fit at 40, the honest version", "A real, friendly post about keeping fit at 40: finding something you will actually keep doing rather than a punishing plan. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit2", "fit", "Keeping fit at 40, strength and energy", "A warm post about why so many women at 40 enjoy strength work and moving daily, said generally and kindly, nothing medical. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit3", "fit", "Keeping fit at 40, showing up on tired days", "A relatable post for the busy woman at 40 who wants to look after herself, with a dry sense of humour about the tired days. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("sf1", "safety", "Safety first, what to check before you book anything", "A calm, clear post on what to check before booking any treatment anywhere: who is treating you, their training and insurance, a proper consultation first and no pressure on the day. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf2", "safety", "Why I always say no sometimes", "A warm, honest post on why a good practitioner will sometimes say not today or not this, and why that is a sign you are in safe hands. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf3", "safety", "Aftercare and what to do if you are worried", "A reassuring post on why aftercare matters and why you should always feel able to contact your practitioner if something does not feel right. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
];

export const DENTAL_CLINICS = {
  castle: { name: "Castle Clinic", area: "Beeston" },
  kathryn: { name: "Dr Kathryn Bell", area: "Chippenham" },
} as const;
