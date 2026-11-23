// XMAS FEELS: Vanessa's 40 warm, emotive Christmas lines as single image posts for every client.
// The line on the picture is her own wording from COVER_XMAS, used exactly as written. The caption for each one is written here, in the clinic's
// first person voice, kind and a little funny, no selling, ending on a question. The 5 hashtags are built from the client's area on the page.
import { COVER_XMAS } from "./cover-banks";

export type XmasFeelsRow = { id: string; line: string; caption: string };

const CAPTIONS: string[] = [
  "I have stood in a shop with a basket that felt too light and a bank balance that felt lighter still, so I know this feeling well. Your children keep a quiet tally of the times you sat on the floor and joined in, and that tally is enormous. What is your favourite Christmas memory from when you were small?",
  "A message takes ten seconds to send and can change the whole shape of someone's day. Think of the person who has gone quiet lately and let them know you have noticed. Who are you going to message today?",
  "If you are wrapping at midnight with the sellotape stuck to your sleeve, I am cheering you on from here. The children will find the magic in the morning and never know how many times you hunted for the scissors. What time did you finish wrapping last year?",
  "Some of us have the matching pyjamas and the perfectly timed turkey. The rest of us have a dog in the tinsel and a row about the telly, and honestly that sounds like more fun. What does your real Christmas look like in one sentence?",
  "Christmas has a way of bringing missing people right to the front of our minds. If you know someone carrying that this year, a gentle word or a long hug can go a very long way. Who is on your mind today?",
  "I once served a dinner so burnt that the smoke alarm joined in the singing, and we still laugh about it years later. Nobody remembers the food. They remember the giggling. What is the worst thing you have ever burnt on Christmas Day?",
  "Ask a grown up about their childhood Christmases and the stories are full of giggles, sleepy cuddles and pyjamas. Hardly anyone mentions the paper. What is the memory you hope your family keeps?",
  "I am sending a big hug to anyone looking at a place at the table that is no longer filled. You can laugh and cry in the same minute, and both are allowed. Who would you set a place for if you could?",
  "You booked the delivery slot, remembered the cousin's allergy and hid every present in a different cupboard. Please let somebody else take over for one hour this week, and sit down while they do it. What is the one job you are handing over?",
  "Pick up the phone and ring someone who would love to hear your voice. It takes five minutes and it might turn out to be the best part of their week. Who are you ringing first?",
  "I have decorated a tree in the dark with one working set of lights and a great deal of optimism. It looked wonderful, because everybody standing around it was laughing. How long did your tree stay upright last year?",
  "Joy and heaviness can sit side by side at this time of year, and you do not have to pick one for the photos. Take the day at whatever pace you need. How are you really feeling about December this year?",
  "If you are smiling through a hard month, I want you to know I notice how much strength that takes. You are doing far better than you think, and I am proud of you. What is one small thing that has made you smile this week?",
  "A held door, a kind message, a treat left on a neighbour's step, it all adds up. Kindness at Christmas has a lovely way of sticking around until January and beyond. What is the kindest thing someone has done for you this year?",
  "Tell someone today, before the busy day arrives and the moment slips past. It only takes a sentence, and it can stay with them for years. Who needs to hear it from you?",
  "Every gift bought with love on a tight budget carries the same weight as the grand ones, and often more. The person opening it can feel the thought behind it. What is the best gift you have ever been given that cost very little?",
  "A card on the doormat can be the only post someone sees all week. It takes two minutes and a stamp. Who lives on your street that might love to find one?",
  "Cosy beats perfect every single time. Switch the lights on, find the good blanket and let the tidying wait until after Boxing Day. What is your favourite cosy thing about Christmas?",
  "Your best friend would happily swap the gift with the bow for a proper catch up on the sofa and your full attention. That hour is worth more than anything in the shops. Which friend are you booking some time with?",
  "To everyone who is tired, stretched thin and still making it all work, you are the reason Christmas happens in your house. Please look after yourself too. What is one thing you are doing for you this week?",
  "The elf can stay in the box and nobody will think any less of you. Your sanity is worth far more than a daily staged scene on the bookcase. Are you team elf or team early night?",
  "The sprouts will be forgotten by Boxing Day. The person who made the whole table roar with laughter will be remembered for years. Who is the funniest person at your Christmas table?",
  "I have had a good cry in a supermarket car park, surrounded by trolleys and a dozen tubs of Quality Street. It happens to the strongest people I know, so please be kind to yourself. What helps you reset when everything feels like a lot?",
  "Families can be a lot, and Christmas squeezes everybody into one room all at once. It is perfectly fine to step outside, take a walk and breathe. Where is your favourite place to escape for five minutes?",
  "A gift wrapped in yesterday's newspaper and handed over with a story means more than something rushed with a ribbon. People treasure the effort. What is the most thoughtful homemade gift you have been given?",
  "You do not have the job title of Christmas events manager, so go on and hand somebody the list. Sharing the load is a gift to yourself. What is the first job you are handing out?",
  "A neighbour who always seems to be on their own would probably love an invite, even for an hour. A few kind words and a mince pie can change someone's whole week. Who could you invite round this year?",
  "Put the phone in a drawer for one hour and watch their faces as they open things. That hour is the present they will remember. How do you switch off from your phone when it matters?",
  "No is a complete sentence, and December is a very good month to practise it. Your energy is precious, so spend it on the people who fill you up. What is the first thing you are saying no to?",
  "Some of us will light a candle for someone special this year. I am lighting one for you too, and for everyone who needs a little extra light. Who are you lighting yours for?",
  "The wonkiest gingerbread house on the street is always the one that gets photographed. Leaning walls and icing everywhere make the best memories. Have you ever built one, and how did it turn out?",
  "A letter telling someone exactly why you are proud of them is worth more than anything in the shops. Keep it handwritten and heartfelt, and watch what happens. Who are you writing to first?",
  "The friend who says she is fine is sometimes holding up the whole house. A quick message asking how she really is could be the best gift she gets this year. Who are you checking in on?",
  "No prizes are handed out for the best tree, and the only critic in my house is the cat. Enjoy yours exactly as it is. Who judges your tree at home?",
  "A childhood full of cuddles, bedtime stories and being listened to outweighs every toy that ends up in a charity bag. You have already given them the big things. What is a cuddle moment you treasure from your own childhood?",
  "Someone out there has been hoping you would get in touch first. Go on and send the message, because you may be the bright spot in their day. Who is it going to?",
  "I fully support anyone who gets into the chocolate coins early. Christmas is long and joy deserves a head start. Which chocolate do you sneak first?",
  "If you are doing Christmas on your own this year, you are remembered and you matter. A little routine, a film you love and a message to a friend can make the day feel gentler. What is the one thing you are looking forward to?",
  "Take the photo, then put the phone down. Join the dancing in the kitchen and sing far too loudly. What is the song everyone in your family ends up singing at Christmas?",
  "However the day unfolds, you gave it your all, and your all is plenty. Give yourself a pat on the back when the dust settles. What are you proudest of from this year?",
];

export const XMASFEELS_ROWS: XmasFeelsRow[] = COVER_XMAS.map((line, i) => ({ id: `xf${i + 1}`, line, caption: CAPTIONS[i] ?? "" }));
