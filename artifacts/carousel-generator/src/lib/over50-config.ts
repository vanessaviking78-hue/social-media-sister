// Women Over 50 bundle: /over50. Fill OVER50_PAY_URL with the Stripe Payment Link for the £24 bundle.
// Set the link's after payment page to https://www.thecybersuite.com/over50?paid=yes
export const OVER50_PAY_URL = "";
export const OVER50_PRICE = "£24";

// Per page: the red used in the design (so it can be swapped), and where the logo goes.
export const OVER50_PAGES: { ref: [number, number, number]; slot: [number, number, number, number]; box?: [number, number, number, number]; name?: [number, number, number, number] }[] = [
  { ref: [236, 52, 47], slot: [780, 1220, 260, 90] },
  { ref: [217, 12, 12], slot: [780, 1220, 260, 90], name: [58, 1098, 337, 74] },
  { ref: [237, 49, 32], slot: [780, 1220, 260, 90] },
  { ref: [228, 60, 53], slot: [780, 1220, 260, 90] },
  { ref: [219, 48, 23], slot: [780, 1220, 260, 90] },
  { ref: [214, 44, 30], slot: [780, 1220, 260, 90] },
  { ref: [240, 45, 46], slot: [780, 1220, 260, 90] },
  { ref: [200, 31, 26], slot: [853, 1259, 216, 80], box: [843, 1249, 236, 100] },
  { ref: [211, 46, 38], slot: [780, 1220, 260, 90] },
  { ref: [218, 35, 27], slot: [730, 1210, 260, 90], name: [1, 1140, 413, 210] },
];

// Ten captions in the clinic's own voice. {clinic} and {area} are filled in. Each ends on a question, then one closing line, then five area hashtags.
export const OVER50_CAPTIONS = [
  "Every week women over 50 walk into {clinic} having been told, in a hundred small ways, to quieten down. Then they sit down and tell me about their business, their grandchildren and the ten mile walk they did on Sunday. Overlooked? I have never met one who deserved it. When did you last feel properly noticed?",
  "Permission slips are for school trips. If you have spent years asking everyone else whether you are allowed to rest, to spend, to say no, consider this your sign to stop asking. I will wait while you put the guilt down. What would you do this week if nobody needed to approve it?",
  "People pleasing is a very tiring hobby and the pay is dreadful. Main character energy starts with one small no, said kindly and without a long explanation. I am cheering on every woman in {area} who has tried it. What was the last thing you said yes to when you wanted to say no?",
  "Faces were built to move, crease and tell stories. You owe nobody a younger version of yourself, and I will never push you towards one. Your face, your rules and my full attention at {clinic}. What do you love most about the face you have now?",
  "Fifty is an excellent age to start things. A business, a pottery class, a sea swim, a second act. I have watched women in {area} do all four before lunch. What are you starting next?",
  "Hotter is a state of mind, and it tends to arrive around the time you stop apologising for taking up space. I have seen it happen mid sentence in my chair. Which room do you walk into like you own it?",
  "Her story is still being written and the best chapters may be ahead. I would put money on the one with the holiday abroad and the very good shoes. Which chapter are you in right now?",
  "Looking 30 was lovely for about a fortnight. I would not swap the confidence I have now to get it back. The goal at {clinic} is to look like you on a very good day. What do you like about yourself now that you could not say at 30?",
  "The best thing about 50? Knowing what you want, knowing what you will put up with and dressing accordingly. I would add that you finally know which shoes hurt before you buy them. What is the best thing about this age for you?",
  "Grey hair, red lip and zero apologies. If you have been saving that lipstick for a special occasion, this is the occasion. I am cheering for you from {area}. What shade are you wearing this weekend?",
];

export const OVER50_CLOSERS = [
  "Save this for the days you forget",
  "Comment SEEN if you felt that",
  "Tell me your version in the comments",
  "Comment ME if you needed this today",
  "Which one are you? Tell me below",
  "Save this one for a rainy Tuesday",
  "Pop your answer in the comments, I read every one",
  "Comment YES if this is you",
  "Send this to the woman who runs your world",
  "Reply with your own and I will answer",
];
