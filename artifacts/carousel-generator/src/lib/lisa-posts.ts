// DR LISA ACADEMY: the preloaded post names for her own page. Dr Lisa trains people in aesthetics, so every
// post is about training with her. No promises of earnings, no qualification claims, no invented delegates.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.

export type LisaGroup = "train" | "career" | "choose" | "support" | "season" | "fit";

export const LISA_GROUPS: { id: LisaGroup; label: string }[] = [
  { id: "train", label: "Training with me" },
  { id: "career", label: "A career in aesthetics" },
  { id: "choose", label: "Choosing a course" },
  { id: "support", label: "Support and community" },
  { id: "season", label: "Seasonal" },
  { id: "fit", label: "Keeping fit at 40" },
];

export type LisaPostType = {
  id: string;
  group: LisaGroup;
  label: string;
  brief: string;
  word: string; // kept so old posts still load
  kind: "treatment" | "area"; // enquiry posts close on the DM line, the rest use a rotating area line
};

// Posts that invite someone to train with her. They close on the DM line.
const ENQUIRY_IDS = new Set(["t1", "t2", "t5", "t6", "c3", "c4", "x3", "x4"]);

const p = (id: string, group: LisaGroup, label: string, brief: string, word = ""): LisaPostType => ({ id, group, label, brief, word, kind: ENQUIRY_IDS.has(id) ? "treatment" : "area" });

export const LISA_POST_TYPES: LisaPostType[] = [
  p("t1", "train", "What happens when you train with me", "A day in my training room: small groups, hands on, nobody left at the back, and what it feels like when it clicks."),
  p("t2", "train", "Nervous about your first day of training", "What I say to every nervous woman: imposter syndrome is normal, everyone starts somewhere and I will look after you."),
  p("t3", "train", "From nervous to hands on", "The journey over a training day, what changes between the morning and the afternoon. No invented delegates or stories."),
  p("t4", "train", "Why I still love training people", "The moment I see it click for someone, and why teaching is my favourite part of what I do."),
  p("t5", "train", "Meet your trainer", "Who I am, what I love about teaching and one small honest detail about me. Never an invented story or number of years."),
  p("t6", "train", "Thinking about training with me", "An honest invitation: what to ask me, how to find out if it is right for you, no pressure at all."),
  p("a1", "career", "Why aesthetics is a great career choice", "My honest reasons for loving this career: the variety, the people, building something of your own. No promises about money."),
  p("a2", "career", "The empowerment of working in aesthetics", "What learning a skill and using it does for confidence and sense of self, and the women I have watched grow."),
  p("a3", "career", "The benefits of training in aesthetics", "What you gain from proper training: skills, confidence, community and a new direction."),
  p("a4", "career", "Learning something new at 35, 40, 50 and beyond", "It is never too late to change direction, and what life experience brings to the training room."),
  p("a5", "career", "Being your own boss", "The independence of building your own practice and fitting work around family and the school run. No promises about earnings."),
  p("a6", "career", "A career that fits your life", "Flexible hours, work that can fit around family, and why so many women choose aesthetics. No promises."),
  p("c1", "choose", "Choosing a trainer who has been doing this a long time", "Why experience in the room matters, what a trainer who has seen it all can teach that a textbook cannot, and questions to ask before choosing."),
  p("c2", "choose", "What good training looks like", "How to tell a trainer who will look after you from one who will not: safety and consent as real skills, small groups, support afterwards."),
  p("c3", "choose", "What to look for before you choose a course", "A friendly checklist of questions every woman should ask any trainer, including me."),
  p("c4", "choose", "The questions I get asked most about training", "Am I too old, do I need a medical background, will I be good at it. Answered honestly and kindly."),
  p("c5", "choose", "Doing it properly", "Why safety, consent and standards matter and how I teach them so they feel natural, not scary."),
  p("c6", "choose", "Confidence is the real skill", "Technique can be taught, confidence is built, and how my training builds it step by step."),
  p("s1", "support", "The support you get after the course ends", "Why I stay in touch, the questions that arrive at 9pm and never being left on your own."),
  p("s2", "support", "The friendships and community in aesthetics", "The women you meet in the training room, the group chats and the support of people who get it."),
  p("s3", "support", "Why I teach in small groups", "Why small groups mean more hands on time, more questions answered and nobody hiding at the back."),
  p("s4", "support", "Imposter syndrome in aesthetics", "How common it is, what it feels like and how I help every trainee get past it, kindly and honestly."),
  p("x1", "season", "Looking after yourself this Christmas", "A warm reminder to look after yourself during a busy Christmas, especially if you are thinking about a new direction."),
  p("x2", "season", "A new skill for a new year", "Why January is a good time to think about a new direction, without resolutions or pressure."),
  p("x3", "season", "Thinking about training in the new year", "An honest, relaxed invitation to start the conversation now so the new year starts with a plan. No offers, no urgency."),
  p("x4", "season", "A gift for the woman who wants a new career", "A gentle, thoughtful post about the gift of a new skill, and how to start a conversation with me. No prices."),
  p("x5", "season", "What I am grateful for this year", "A sincere, warm reflection on the women I have trained and what teaching has given me. No invented names, stories or numbers."),
  p("fit1", "fit", "Keeping fit at 40, the honest version", "A real, friendly post about keeping fit at 40: finding something you will actually keep doing rather than a punishing plan. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit2", "fit", "Keeping fit at 40, strength and energy", "A warm post about why so many women at 40 enjoy strength work and moving daily, said generally and kindly, nothing medical. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit3", "fit", "Keeping fit at 40, showing up on tired days", "A relatable post for the busy woman at 40 who wants to look after herself, with a dry sense of humour about the tired days. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
];

export const LISA_ACADEMY = "Dr Lisa Academy";
