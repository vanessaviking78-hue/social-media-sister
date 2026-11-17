// 16 POSTS: two sets of 16 hooks and captions, already written.
// SMS_SIXTEEN is Social Media Sister's own set (written as the social media manager). CLINIC_SIXTEEN is the clinic set (written as the clinician),
// shown on every clinic client page and every club member page. Hashtags for the clinic set are built from the area typed on the page.
// Images are added by hand. Slides 2 to 4 are left blank so the page can write them, or they can be typed in.

export type SixteenPost = { n: number; label: string; hook: string; caption: string; word: string; tags?: string[] };

const SMS_TAGS_A = ["#aestheticmarketing", "#aestheticnurse", "#injectorsofinstagram", "#aestheticsbusiness", "#clinicowner"];
const SMS_TAGS_B = ["#aestheticmarketing", "#aestheticsbusiness", "#aestheticclinicowner", "#clinicgrowth", "#aestheticnurse"];
const SMS_TAGS_C = ["#aestheticmarketing", "#asacompliance", "#capcode", "#aestheticnurse", "#aestheticsbusiness"];
const SMS_TAGS_D = ["#aestheticmarketing", "#adhdentrepreneur", "#socialmediamanager", "#aestheticsbusiness", "#clinicmarketing"];
const SMS_TAGS_E = ["#aestheticmarketing", "#aestheticclinic", "#aestheticnurse", "#clinicmarketing", "#socialmediaforclinics"];

export const SMS_SIXTEEN: SixteenPost[] = [
  { n: 1, label: "3 checks before a post goes live", word: "SAFE", tags: SMS_TAGS_A, hook: "3 things I check before any clinic post goes live",
    caption: "After seven years in aesthetics I have a little routine before anything gets scheduled. It takes about ninety seconds and it has saved more than one clinic from an awkward email.\n\nI have put the three checks in the slides. Save them, you will thank me at 9pm on a Sunday.\n\nWhich of the three do you already do?\n\nComment SAFE and I will send you my full checklist." },
  { n: 2, label: "ADHD brain, 47 clients", word: "SYSTEM", tags: SMS_TAGS_D, hook: "I have ADHD and I look after 47 clinics' content. Here is how.",
    caption: "My brain has forty tabs open and somehow the posts still go out on time. That is because I built systems that do the remembering for me.\n\nI am no good at keeping things in my head, so I made tools that keep them for me. Every clinic I work with gets the benefit.\n\nWhat is the one job you wish just did itself?\n\nComment SYSTEM and I will tell you how I do it." },
  { n: 3, label: "Monday with the posts done", word: "MONDAY", tags: SMS_TAGS_E, hook: "Your Monday morning, but with the posts already done",
    caption: "Picture Monday. Inbox calm, diary full and your next four weeks of content already written in your voice and scheduled.\n\nThat is what my clients wake up to. I plan it, write it, check it against the CAP Code and schedule it. You get on with the actual treating.\n\nWhat would you do with an extra five hours a week?\n\nComment MONDAY and I will show you how it works." },
  { n: 4, label: "What changes when posting is consistent", word: "DIARY", tags: SMS_TAGS_B, hook: "What changes when a clinic posts like a human, every week",
    caption: "I never promise numbers because every clinic is different. What I can show you is what shifts when the posting becomes consistent and sounds like the person behind the chair.\n\nThe slides walk through the three changes I make first with every clinic.\n\nWhat is the one thing you have been putting off posting about?\n\nComment DIARY and I will send you the full breakdown." },
  { n: 5, label: "Your bio", word: "BIO", tags: SMS_TAGS_C, hook: "Your clinic bio is working harder than your last post",
    caption: "I look at a lot of bios. The most common issue is a claim in the very first line that the ASA would raise an eyebrow at.\n\nThe fix takes two minutes and your bio can still sound like you. I rewrite them all the time.\n\nWhat does your bio say right now? Read it out loud and tell me if you would book with you.\n\nComment BIO and I will check yours." },
  { n: 6, label: "The day my best mate left", word: "SUITE", tags: SMS_TAGS_D, hook: "The day my best mate left and I built a whole software",
    caption: "In February my best mate left the business. It rocked me, and then I got to work.\n\nThat is how The Cyber Suite was born. I made it so I would never have to rely on one person again, and now my clients get the same steady hand every single week.\n\nWhat is something that fell apart for you and led somewhere better?\n\nComment SUITE if you want to know what I built." },
  { n: 7, label: "12 months done for you", word: "YEAR", tags: SMS_TAGS_E, hook: "What 12 months of done for you socials looks like",
    caption: "A whole year, mapped out. Posts, stories, reels and the strategy that holds them together.\n\nI wanted it to be easy to say yes to, so I wrote it out slide by slide.\n\nWhich month feels the hardest for you to show up?\n\nComment YEAR and I will send you the details." },
  { n: 8, label: "Likes versus consultations", word: "ENQUIRY", tags: SMS_TAGS_B, hook: "Likes are lovely. Consultations pay the rent.",
    caption: "I have watched clinics get thousands of likes and an empty diary. I have also watched tiny accounts book out.\n\nThe difference is usually who you are talking to and what you ask them to do next. I look at that first, every time.\n\nWhen did you last check how many enquiries came from your posts?\n\nComment ENQUIRY and I will show you how I track it." },
  { n: 9, label: "Words the ASA circles", word: "WORDS", tags: SMS_TAGS_C, hook: "Words the ASA loves to circle in red",
    caption: "I am going to run through five phrases I see clinics use all the time that need a rethink. You will probably recognise at least two.\n\nI will give you a friendly swap for each one so your posts keep their personality.\n\nWhich of these have you used?\n\nComment WORDS and I will send you the full swap list." },
  { n: 10, label: "My brain at 2am", word: "BANK", tags: SMS_TAGS_D, hook: "My brain at 2am versus your content calendar",
    caption: "At 2am my brain has the best ideas of my whole day. The trick I learned is catching them before they vanish.\n\nThat is why I keep a content bank for every client. Nothing gets lost and everything gets used.\n\nWhat time of day do your best ideas turn up?\n\nComment BANK and I will tell you how I set one up." },
  { n: 11, label: "Your first 30 days written free", word: "SAMPLE", tags: SMS_TAGS_E, hook: "I will write you a taste of your own voice. You tell me if I got you right.",
    caption: "I think the best way to show you what I do is to do it. Send me your clinic and I will write you a sample in your own voice.\n\nIf it sounds like you, we talk. If it does not, you have a free sample and no hard feelings.\n\nWould you rather see it or hear about it?\n\nComment SAMPLE and I will get started." },
  { n: 12, label: "4 posts that work", word: "POSTS", tags: SMS_TAGS_B, hook: "4 post styles that fill a clinic diary",
    caption: "These are the four styles I come back to again and again when I plan a clinic's month. They are simple and they are honest.\n\nEach one asks a single easy question at the end, which is what gets people talking.\n\nWhich style do you think would suit your clinic?\n\nComment POSTS and I will send you the templates." },
  { n: 13, label: "Compliance trampoline", word: "CALM", tags: SMS_TAGS_C, hook: "Compliance is a trampoline",
    caption: "The rules give you a clear space to play in. Once you know where the edges are, you can bounce about with confidence.\n\nI check every client post so you can post with a calm head.\n\nWhere do you feel the most nervous when you post?\n\nComment CALM and I will tell you how I do it." },
  { n: 14, label: "Building site and clinics", word: "CRAFT", tags: SMS_TAGS_D, hook: "I have worked on a building site and with over 400 clinics. Same energy.",
    caption: "Both places run on people who are brilliant at their craft and shy about telling anyone. That is where I come in.\n\nMy time on a building site taught me how to get things done, and I use it every day.\n\nWhat is the craft you want people to see?\n\nComment CRAFT and I will tell you how I can help." },
  { n: 15, label: "The post you already wrote", word: "IDEAS", tags: SMS_TAGS_E, hook: "The cheapest marketing is the story you already have",
    caption: "You have a drawer full of lovely stories, patient questions and daily wins. They are content waiting to happen.\n\nI turn them into a month of posts that sound like you and sell for you without a hard sell.\n\nWhat is the question patients ask you the most?\n\nComment IDEAS and I will turn it into a post for you." },
  { n: 16, label: "Friday five minute check", word: "FRIDAY", tags: SMS_TAGS_B, hook: "The 5 minute Friday check that keeps your account healthy",
    caption: "Five minutes, three checks, and you will know exactly what is working next week.\n\nI do this for every client every Friday and it takes the guesswork out completely.\n\nWhat is the first number you would look at?\n\nComment FRIDAY and I will send you the checklist." },
];

// CLINIC SET. Written in the clinician's own voice. The hashtag tails are made from the area on the page: area + aesthetics, beauty, mums, skincare, clinic.
export const CLINIC_SIXTEEN: SixteenPost[] = [
  { n: 1, label: "5 questions to ask before any treatment", word: "SAFE", hook: "5 questions to ask before any treatment",
    caption: "I would rather you ask me twenty questions than book with someone you do not feel sure about. A good practitioner will welcome every one.\n\nI have popped my favourite five in the slides.\n\nWhich question would you add?\n\nComment SAFE and I will send you my consultation checklist." },
  { n: 2, label: "Before you walk through my door", word: "MORNING", hook: "What I get up to before you walk through my door",
    caption: "My mornings are part ritual and part organised chaos. I top up the room, put the music on and make sure everything is ready for you.\n\nBy the time you arrive, the room is calm and so am I.\n\nWhat do you do to feel ready for your day?\n\nComment MORNING and I will share my full routine." },
  { n: 3, label: "Skin boosters explained", word: "BOOSTER", hook: "Skin boosters, explained without the jargon",
    caption: "Think of them as a long drink of water for your skin. They give the surface a fresher, more hydrated look over a few weeks.\n\nI tailor every session to your skin and your lifestyle.\n\nWhat does your skin feel like by 3pm?\n\nComment BOOSTER and I will send you the details." },
  { n: 4, label: "The skin story behind every face", word: "SKIN", hook: "Every face has a skin story, and I ask for yours first",
    caption: "Sleep, sun, stress and the products you use all leave their mark. I start every consultation by asking about yours.\n\nIt is how I make sure the plan fits you and nobody else.\n\nWhat is the one thing your skin has told you lately?\n\nComment SKIN and I will send you my skin story questions." },
  { n: 5, label: "Why I say no sometimes", word: "HONEST", hook: "Why I say no to some treatments",
    caption: "If I do not think a treatment will give you what you want, I will tell you straight. That is part of being safe.\n\nI would rather lose a booking than send you home with something that does not suit you.\n\nHave you ever been told no by a practitioner?\n\nComment HONEST and I will tell you more about how I work." },
  { n: 6, label: "What patients say when they sit down", word: "MIRROR", hook: "What I hear when you first sit down",
    caption: "The first thing I usually hear is \"I look so tired.\" Followed closely by \"Do not make me look weird.\"\n\nMy answer is always the same: we take it slowly and you still look like you.\n\nWhat is the first thing you say in the mirror?\n\nComment MIRROR and I will send you my consultation guide." },
  { n: 7, label: "Microneedling in the room", word: "MICRONEEDLING", hook: "Microneedling: what happens in the room",
    caption: "It sounds dramatic and it is a calm, well planned session. I have walked through it slide by slide so there are no surprises.\n\nI will always talk you through what to expect before we begin.\n\nWhat is your biggest worry about it?\n\nComment MICRONEEDLING and I will answer it for you." },
  { n: 8, label: "3 skincare basics", word: "BASICS", hook: "The three skincare products worth your money",
    caption: "A cleanser, an SPF and something suited to your skin that we choose together. Everything else is a bonus.\n\nI would rather you spend on the basics and save the rest for something you will actually use.\n\nWhich of the three are you missing?\n\nComment BASICS and I will send you my shortlist." },
  { n: 9, label: "How to spot a practitioner you trust", word: "TRUST", hook: "How to spot a practitioner you can trust",
    caption: "Look for someone who asks about your health before your wishlist. They should be happy to talk about their training, their insurance and how they keep you safe.\n\nIf you ever feel hurried, take a step back. I mean that kindly.\n\nWhat made you feel safe at your last appointment?\n\nComment TRUST and I will send you the checklist." },
  { n: 10, label: "A clinic that feels welcoming", word: "PLAYLIST", hook: "A clinic should feel like somewhere you want to be",
    caption: "I like my clinic to feel warm, relaxed and a little bit fun. The right music, the right lighting and a proper chat make all the difference.\n\nYou are always welcome to take a moment before we start.\n\nWhat song would be on your playlist?\n\nComment PLAYLIST and I will add it to mine." },
  { n: 11, label: "Polynucleotides in 30 seconds", word: "POLY", hook: "Polynucleotides in 30 seconds",
    caption: "They are a skin conditioning treatment that supports texture and hydration, and they are popular around the delicate under eye area.\n\nI love them for people who want to look fresh without a big change.\n\nWhat area of your face feels the most tired?\n\nComment POLY and I will send you more." },
  { n: 12, label: "Skin in your 30s, 40s and 50s", word: "DECADE", hook: "What your skin needs in your 30s, 40s and 50s",
    caption: "Your skin changes with you and your routine can change too. I have put together a simple guide for each decade.\n\nSave it, share it with a friend and see which one you are in.\n\nWhich decade are you in right now?\n\nComment DECADE and I will send you the full guide." },
  { n: 13, label: "A consultation is a chat", word: "CONSULT", hook: "A consultation is a chat, and you can always say no",
    caption: "Come in, ask every question and leave without booking if you want to. I would rather you felt at ease.\n\nMost people tell me it was far more relaxed than they expected.\n\nWhat would make a consultation easier for you?\n\nComment CONSULT and I will send you the details." },
  { n: 14, label: "Looking after yourself", word: "WISH", hook: "Looking after yourself is not selfish",
    caption: "So many of the women I meet put everyone else first and themselves somewhere near the bottom of the list.\n\nTaking care of yourself makes everything else easier, and I love being a small part of that.\n\nWhat is one thing you could do for yourself this week?\n\nComment WISH and I will share more." },
  { n: 15, label: "Chemical peels, calmly", word: "PEEL", hook: "Chemical peels without the scary photos",
    caption: "A good peel is planned, tailored and chosen for your skin. I will always tell you what to expect before we start and what to do afterwards.\n\nIt is a calm treatment when it is done properly.\n\nWhat is your skin bugbear at the moment?\n\nComment PEEL and I will send you the details." },
  { n: 16, label: "The 4 week skin plan", word: "PLAN", hook: "The 4 week skin plan I give every new patient",
    caption: "Four weeks, small habits and a clear idea of what your skin needs. It is the plan I wish every one of us had been given years ago.\n\nI have laid it out slide by slide so you can start today.\n\nWhich week will you find hardest?\n\nComment PLAN and I will send you the printable version." },
];

// Area hashtags for the clinic set: the area typed on the page, then beauty and mums themes. Exactly five.
export const clinicTags = (area: string): string[] => {
  const a = area.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["aesthetics", "beauty", "mums", "skincare", "clinic"].map((t) => `#${a}${t}`);
};
