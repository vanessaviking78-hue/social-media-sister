// 42 premade memes: clean photo (1080x1350) plus the line that sits on it. Photos live in public/memes.
export type PremadeMeme = { id: number; file: string; text: string; audience: string; format: string; pos: "top" | "bottom"; size: number };
export const PREMADE_MEMES: PremadeMeme[] = [
  {
    "id": 1,
    "file": "memes/01.jpg",
    "text": "Me when someone says “act your age.” I am. I am acting 19 with a better handbag and zero patience.",
    "audience": "Disgraceful",
    "format": "Me when",
    "pos": "top",
    "size": 64
  },
  {
    "id": 2,
    "file": "memes/02.jpg",
    "text": "My face when someone says “I could never have filler” and then asks me for the name of my clinic in the car park.",
    "audience": "Disgraceful",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 3,
    "file": "memes/03.jpg",
    "text": "Overheard in the clinic: “I’ve told my husband it’s the new moisturiser.”",
    "audience": "Graceful",
    "format": "Overheard in the clinic",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 4,
    "file": "memes/04.jpg",
    "text": "Me when someone says “isn’t that outfit a bit young for you?” Thank you. I look incredible.",
    "audience": "Disgraceful",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 5,
    "file": "memes/05.jpg",
    "text": "Expectation: a calm facial and a little nap. Reality: I am telling a stranger with a warm towel on my face about my entire week.",
    "audience": "Busy mums",
    "format": "Expectation vs reality (left)",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 6,
    "file": "memes/06.jpg",
    "text": "Me: I am going to bed at 9. Also me at 11.48pm: researching eyebrow lamination.",
    "audience": "Busy mums",
    "format": "Me: / Also me:",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 7,
    "file": "memes/07.jpg",
    "text": "Expectation: a glow up before the school reunion. Reality: 40 minutes of peace and a sandwich, and honestly it was the best bit.",
    "audience": "Graceful",
    "format": "Expectation vs reality",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 8,
    "file": "memes/08.jpg",
    "text": "POV: you have ten minutes in the treatment chair and nobody needs you for anything. Heaven.",
    "audience": "Busy mums",
    "format": "POV",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 9,
    "file": "memes/09.jpg",
    "text": "POV: you have found the one cool spot in the house and nobody is getting near it.",
    "audience": "Menopause",
    "format": "POV",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 10,
    "file": "memes/10.jpg",
    "text": "Tell me you’re perimenopausal without telling me: there is a fan in my handbag and I am daring you to comment.",
    "audience": "Menopause",
    "format": "Tell me you're ___",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 11,
    "file": "memes/11.jpg",
    "text": "Me: I am not hot. Also me: standing in the fridge door with a fan pointed at my face.",
    "audience": "Menopause",
    "format": "Me: / Also me:",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 12,
    "file": "memes/12.jpg",
    "text": "Do you pull this face when someone says “it’s only a little bit warm in here”?",
    "audience": "Menopause",
    "format": "Do you pull this face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 13,
    "file": "memes/13.jpg",
    "text": "Nobody: Me at 3am: sitting in front of a fan with my eyes closed, negotiating with my own body temperature.",
    "audience": "Menopause",
    "format": "Nobody: / Me at 3am:",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 14,
    "file": "memes/14.jpg",
    "text": "Nobody: Me at 3am: googling “is it normal to forget the word for fridge”.",
    "audience": "Menopause",
    "format": "Nobody: / Me at 3am:",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 15,
    "file": "memes/15.jpg",
    "text": "Me when someone says “quick call?” at 2pm, right in the middle of a hot flush.",
    "audience": "Menopause",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 16,
    "file": "memes/16.jpg",
    "text": "Do you pull this face when someone says “my teen tells me everything”? Mine says “fine” and “nothing”. That is the full vocabulary.",
    "audience": "Mums of teens",
    "format": "Do you pull this face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 17,
    "file": "memes/17.jpg",
    "text": "Me when someone says “enjoy it, they grow up so fast.” Fast? The bedtime routine takes three hours.",
    "audience": "Mums of toddlers",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 18,
    "file": "memes/18.jpg",
    "text": "Me when someone says “you look so well rested.” Concealer, my love. Concealer.",
    "audience": "Busy mums",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 19,
    "file": "memes/19.jpg",
    "text": "Me when someone says “are you having something done?” Yes. A lovely time, and I have not told you where.",
    "audience": "Disgraceful",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 20,
    "file": "memes/20.jpg",
    "text": "My face when someone says “you should really make time for yourself.” With what time, Janet?",
    "audience": "Busy mums",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 21,
    "file": "memes/21.jpg",
    "text": "Me when someone says “treat yourself” and the treat is a hot cup of tea. Hot. All the way through.",
    "audience": "Busy mums",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 22,
    "file": "memes/22.jpg",
    "text": "Me to the next person who says “have you tried just getting a good night’s sleep?”",
    "audience": "Menopause",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 23,
    "file": "memes/23.jpg",
    "text": "Said no woman over 40 ever: “I do not need a lie down.”",
    "audience": "Graceful",
    "format": "Said no woman over 40 ever",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 24,
    "file": "memes/24.jpg",
    "text": "Me when someone says “it’s only a quick favour.” I now run the school summer fair.",
    "audience": "Busy mums",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 25,
    "file": "memes/25.jpg",
    "text": "Expectation: a productive Monday. Reality: this, by 9.40am.",
    "audience": "Busy mums",
    "format": "Expectation vs reality (right)",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 26,
    "file": "memes/26.jpg",
    "text": "My face when someone says “did you get my email?” I have 4,000 unread and a dentist letter from 2022.",
    "audience": "ADHD",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 27,
    "file": "memes/27.jpg",
    "text": "My face when my teen says “you’re so embarrassing” and I have literally only said hello to their friend.",
    "audience": "Mums of teens",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 28,
    "file": "memes/28.jpg",
    "text": "Me when someone says “you’ve got a booking next Thursday” and I thought it was this Thursday, which was yesterday.",
    "audience": "ADHD",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 29,
    "file": "memes/29.jpg",
    "text": "Me when the school WhatsApp says “non uniform day tomorrow, bring £2 and a bottle for the tombola.”",
    "audience": "Busy mums",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 30,
    "file": "memes/30.jpg",
    "text": "Me when someone says “why don’t you just focus?” Mate, I came in for scissors and I have reorganised the whole spice rack.",
    "audience": "ADHD",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 31,
    "file": "memes/31.jpg",
    "text": "My face when someone says “just make a list.” I have 14 lists and no idea where any of them are.",
    "audience": "ADHD",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 32,
    "file": "memes/32.jpg",
    "text": "Tell me you’re a mum of toddlers without telling me: the smile is drawn on and the snacks in my handbag are real.",
    "audience": "Mums of toddlers",
    "format": "Tell me you're ___",
    "pos": "top",
    "size": 64
  },
  {
    "id": 33,
    "file": "memes/33.jpg",
    "text": "Me when someone says “mummy” for the 47th time in one minute.",
    "audience": "Mums of toddlers",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 34,
    "file": "memes/34.jpg",
    "text": "My face when someone says “so what are the teenage years like?” Loud. Slammed doors. Fridge empty by Tuesday.",
    "audience": "Mums of teens",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 35,
    "file": "memes/35.jpg",
    "text": "My face when someone says “brain fog is just an excuse” and I have walked into the kitchen for the fourth time with no idea why.",
    "audience": "Menopause",
    "format": "My face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 36,
    "file": "memes/36.jpg",
    "text": "Do you pull this face when someone says “I just drink lots of water and sleep eight hours”? I love you, Sandra, but you are fibbing.",
    "audience": "Graceful",
    "format": "Do you pull this face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 37,
    "file": "memes/37.jpg",
    "text": "Me when my teen says “what’s for tea?” ten minutes after I have finished clearing up.",
    "audience": "Mums of teens",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 38,
    "file": "memes/38.jpg",
    "text": "Do you pull this face when someone says “you don’t look your age”? Which age though, Susan?",
    "audience": "Graceful",
    "format": "Do you pull this face when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 39,
    "file": "memes/39.jpg",
    "text": "Overheard in the clinic: “Don’t make me look different, make me look like I’ve had a week in Spain.”",
    "audience": "Graceful",
    "format": "Overheard in the clinic",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 40,
    "file": "memes/40.jpg",
    "text": "Nobody: Me at 3am: replaying the woman who said I looked tired in 2019 and thinking up better answers.",
    "audience": "Graceful",
    "format": "Nobody: / Me at 3am:",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 41,
    "file": "memes/41.jpg",
    "text": "Me when someone says “forty is the new thirty.” Then why does my knee make that noise?",
    "audience": "Graceful",
    "format": "Me when",
    "pos": "bottom",
    "size": 76
  },
  {
    "id": 42,
    "file": "memes/42.jpg",
    "text": "Said no woman over 40 ever: “Yes please, put the music up louder in this restaurant.”",
    "audience": "Disgraceful",
    "format": "Said no woman over 40 ever",
    "pos": "bottom",
    "size": 76
  }
];
