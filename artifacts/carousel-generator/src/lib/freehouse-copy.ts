// Slide 2 (body) and slide 3 (closing line) for each Freehouse Socials hook in freehouse-hooks.ts (12 Nov 2026).
// Every Freehouse post is a 3 slide carousel: the hook on slide 1, three friendly sentences on slide 2, a strong and cheeky closing line on slide 3.
// Written as Vanessa, a social media strategist, talking to pubs and bars. No website is ever mentioned, so people comment or send a message instead.

export type FreehouseCopy = { body: string; cta: string };

export const FREEHOUSE_COPY: Record<string, FreehouseCopy> = {
  SA1: {
    body: "I have worked with over 500 businesses and spent 30 years behind a camera, so I know a good photo from a dodgy one. Every post I make for you uses your own real photos of your own pub, your own team and your own food.",
    cta: "Fancy a free sample? Comment FREEHOUSE and I will show you what your pub could look like.",
  },
  SA2: {
    body: "Those shiny computer made pictures have glasses that bend, froth that floats and sausages with a mind of their own. Your regulars can spot one from the other side of the bar. I use real photos of your actual pub, so people see what they will really get when they walk in.",
    cta: "Want real photos doing the talking? Comment FREEHOUSE and I will send you a free sample.",
  },
  SA3: {
    body: "People decide where to go on a Friday night by scrolling, and they decide fast. I build your page from your food, your team and your nights, three posts at a time, while you get on with pulling pints. It costs £49 a month and it never has a day off.",
    cta: "Want a free 5 day trial? Comment FREEHOUSE and I will get started.",
  },
  SB1: {
    body: "Your locals are the best content you have got. A photo of them laughing at the bar, with their blessing, says more about your pub than any poster. Real faces make people want to join in.",
    cta: "Send this to your “just the one” mate.",
  },
  SB2: {
    body: "Five minutes in a kitchen is a unit of time nobody has ever measured. A quick photo of the chef plating up the special tells hungry people the wait is worth it. Show the food and people forgive the clock.",
    cta: "Comment CHEF and tell me the longest five minutes you have ever waited.",
  },
  SB3: {
    body: "That team is the reason the quiz is fun. Post the teams, the silly names and the winners with their prize and next week's table fills itself. People book a night where they will be talked about.",
    cta: "Comment QUIZ and tell me the best team name you have ever seen.",
  },
  SB4: {
    body: "A specials board nobody can read does not sell a single plate. Photograph it, post it with the best dish and say what time it starts. Then everyone knows before they arrive.",
    cta: "Comment SPECIAL and I will show you how I would post your board.",
  },
  SB5: {
    body: "Nobody books karaoke night for the quality of the singing. They book it for the story they will tell on Monday. Film ten seconds of the dance floor going daft and you have sold next week's night.",
    cta: "Comment KARAOKE and tell me the song that always clears the room.",
  },
  SB6: {
    body: "It is also the quietest night of the week turned into a regular. Post the scores, the banter and the trophy and the dominoes crowd turns into a loyal crowd. Quiet nights need a reason, so give them one.",
    cta: "Comment DOMINOES and I will show you how I would fill your Monday.",
  },
  SB7: {
    body: "The roast is the busiest, loudest and most photographed meal your pub does all week. A steaming plate with the gravy mid pour sells the next table before they have sat down. Photograph it hot and post it before noon.",
    cta: "Comment ROAST and I will show you how I would post yours.",
  },
  SB8: {
    body: "Sport nights are a gift, because people book a seat and stay for three hours. Post the fixtures, the big screen and the atmosphere the week before and you will have the whole room by kick off.",
    cta: "Comment SPORT and tell me the match that fills your pub.",
  },
  SB9: {
    body: "A good deal with a plain name is the easiest post to write. Put the day in the hook, the dish in the photo and the time in the last line. People turn up on Thursday because you told them on Wednesday.",
    cta: "Comment CURRY and I will show you how I would post your Thursday.",
  },
  SB10: {
    body: "If you have a pub dog, a pub cat or a regular who is basically furniture, they are your star. People follow personalities, and four legs help. Give them a name, a photo and their own day of the week.",
    cta: "Comment DOG and tell me your pub dog's name.",
  },
  SM11: {
    body: "A great plate needs a great photo and it takes three minutes. Turn it towards a window, tilt the phone and take it before the gravy skins over. Hungry people book on the photo, so give them one worth booking.",
    cta: "Comment PLATE and I will show you how I would shoot yours.",
  },
  SM12: {
    body: "Your customers know what a pint looks like and a computer made one is easy to spot. Real photos feel warmer and they keep people coming back for the real thing. A real pint on your real bar beats a fake one every time.",
    cta: "Comment REAL and I will send you a free sample made from your own photos.",
  },
  SM13: {
    body: "Post the special on the morning it runs, with a photo and a time. People decide where to eat at lunchtime, so catch them before they decide. Last week's special is old news.",
    cta: "Comment BOARD and I will show you how I would post it.",
  },
  SM14: {
    body: "A good live music post has a name, a photo of the act and a start time. People will come for the band, but only if they know who is playing. Give the act a few lines and share it so they share it too.",
    cta: "Comment BAND and I will show you how I would announce yours.",
  },
  SM15: {
    body: "Two hundred years of history and a page that has gone quiet. Post something every few days, even if it is just the bar being set up before opening. A busy page says a busy pub.",
    cta: "Comment WAKEUP and I will show you how I would restart yours.",
  },
  SM16: {
    body: "A beer garden sells itself on the first sunny day. Take the photo when the light is soft, move the bins and post it with a date. Then people know where to go when the sun comes out.",
    cta: "Comment GARDEN and I will show you how I would shoot yours.",
  },
  SM17: {
    body: "A photo is the welcome. A fire lit, a table laid, a pint on the bar and a smile are all it takes. Show the warmth and people turn up for it.",
    cta: "Comment WELCOME and I will show you how I would post your night.",
  },
  SW18: {
    body: "You list what you want to post, you send me photos of your pub, your team and your food, and I build the posts with my own tools. You can download them yourself or leave it to me. It costs £49 a month.",
    cta: "Comment FREEHOUSE and I will send you a free 5 day trial.",
  },
  SW19: {
    body: "People go where people are having fun. A real laugh from a real person does more than a hundred stock photos. I take your own photos and make them look as good as the pub feels.",
    cta: "Comment LAUGH and send me the photo.",
  },
  SW20: {
    body: "A hook, a hot plate and a closing line that gets them to book. That is a whole Sunday roast post in three slides. I write it, design it and put your logo on it.",
    cta: "Comment ROAST and I will show you the three slides.",
  },
  SW21: {
    body: "A good quiz post has a date, a prize and a reason to bring friends. I write the hook and the closing line and you send me one photo from last week. Next week's tables fill up.",
    cta: "Comment QUIZ and I will make you a sample.",
  },
  SW22: {
    body: "People come back to a pub because of the people in it. A friendly post about a long standing regular says more than any advert. They will share it, their friends will see it and the circle grows.",
    cta: "Comment REGULAR and tell me about yours.",
  },
  SW23: {
    body: "The bar, the pumps, the food, the team, the dog and the corner with the best light. One afternoon of real photos is enough to build a whole month. Send me those and I do the rest.",
    cta: "Comment MONTH and I will send you my photo list.",
  },
  SW24: {
    body: "Photograph three dishes, tell me the story of one and I will turn it into a menu launch that makes people curious. A menu is only exciting if people have seen it before they sit down.",
    cta: "Comment MENU and I will show you how I would launch yours.",
  },
  SW25: {
    body: "Show the decorations, the tables and a price for a group. People plan their party with the first place that looks ready. Posting early puts you in the diary before anyone else.",
    cta: "Comment XMAS and I will write your Christmas posts.",
  },
  SW26: {
    body: "A name, a face and one daft fact is all it takes. People like knowing who is behind the bar before they get there. A friendly team post makes a stranger feel like a regular.",
    cta: "Comment TEAM and I will show you how I would introduce yours.",
  },
  SW27: {
    body: "Every pub has a quiet night. A good post gives it a reason to be busy: a deal, a game, a dish or a dog. It is free, it takes thirty seconds and it might be the best idea you have this month.",
    cta: "Comment your pub and your town and I will reply with an idea.",
  },
};
