// STATIC - quotes: Vanessa's hand painted style quote boards as single image posts for every client.
// The line on the picture is her own wording, used exactly as written. The background is a plain colour (or a metallic) with nothing else behind it,
// and the writing colour is picked on the page. The caption for each one is written here in the clinic's first person voice, kind and a little funny,
// no selling, ending on a question. The 5 hashtags are built from the client's area on the page.

export type StaticQuoteRow = { id: string; line: string; caption: string };

const LINES: string[] = [
  "How silly of me to wait for permission to take up space.",
  "Dear younger me, the fringe was a mistake but the courage was spot on.",
  "Plot twist: I actually like myself now.",
  "Note to self: you were exhausted and you still showed up.",
  "Nobody is coming to rescue me, so I booked myself in.",
  "My face has been through everything and it still turns up for me.",
  "I am arriving right on time as the finished version.",
  "Today I am choosing me, and the good moisturiser.",
  "I stopped apologising for my age, my opinions and my laugh lines.",
  "Treating myself like someone I love turned out to be the whole secret.",
];

const CAPTIONS: string[] = [
  "I spent years waiting for somebody to tell me it was fine to take up room. Nobody ever turned up with the memo. The women I look after say the same thing, usually halfway through a sentence that starts with sorry. So here is your memo, signed by me. Sit in the good chair, have the opinion, book the appointment. You are allowed. What would you do this week if you had already been given permission?",
  "I have photographic evidence of my own fringe and I have forgiven it. What I will never regret is the courage that came with it, the go on then that got me out of the door in a very questionable outfit. Younger you was winging it with a great deal of bravery and she deserves a proper thank you. What would you say to the girl in your old photos?",
  "Somewhere between the school run, the career and a few decades of coping, I started enjoying my own company. Nobody warned me it could happen. It arrived quietly, like a good cardigan. If you are not quite there yet, stick with it, because it is worth the wait. When did you realise you actually liked yourself?",
  "I know the days when you were running on fumes and still packed the lunches, answered the emails and smiled in the meeting. Nobody clapped. I would like to, loudly, from here. On a day like that, simply getting through it counts as a result and resting is allowed. What is one thing you got through recently that deserves a round of applause?",
  "Waiting for someone to notice you need looking after is a very long game, and I have lost it plenty of times. Eventually I started booking my own treats, my own days off and my own appointments. Nobody is galloping in on a white horse, so you may as well pick up the diary yourself. What have you booked for yourself this month?",
  "Think of everything your face has done for you. It has cried at adverts, laughed until it hurt, squinted at birthday cards without your glasses and kept turning up every morning regardless. It deserves some looking after. I love a consultation that starts with what you like about yourself, because there is always something. What is your favourite thing about your face?",
  "I used to worry I had missed my moment. Then I noticed I had been collecting experience the whole time, and that is exactly what makes a woman worth listening to. You turned up with the stories, the humour and the sensible boots, and the timing is perfect. What are you glad you waited for?",
  "I have decided that choosing myself can start small. A lie in, a proper lunch away from my desk and the moisturiser that costs a bit more and feels like a hug. Tiny acts add up much faster than you would expect. What is your smallest daily bit of self care that makes the biggest difference?",
  "I spent decades apologising for things like my age, my laugh lines and my loud opinions. Then I got tired. It turns out the people worth keeping were never keeping score. Every line on my face came from somewhere good and I wear them like a CV. What are you done apologising for?",
  "Talk to yourself the way you talk to your best friend, and book in the things you would happily book in for her. It sounds far too easy and it works. Have a go today and see how it feels. What would you say to your best friend if she were standing in your shoes right now?",
];

export const STATICQUOTES_ROWS: StaticQuoteRow[] = LINES.map((line, i) => ({ id: `sq${i + 1}`, line, caption: CAPTIONS[i] ?? "" }));
