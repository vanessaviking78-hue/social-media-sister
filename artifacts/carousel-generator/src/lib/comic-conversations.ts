// The 40 comic strip conversations for the Comic Strip tool (/comic).
//
// Six panels each. Panels 1 to 3 are page one, panels 4 to 6 are page two,
// and panel 6 always carries the punchline. Every one pokes fun at the safety
// side of aesthetics, with the clinician as the only sensible adult in the room.
//
// Compliance: no prescription-only product names, no "anti-wrinkle", no "safe",
// no promised results. People and places (Sharon, Debbie, Gavin) are fictional.
//
// To add or change a conversation, edit this file only. The page picks it up.

export type Expr = "neutral" | "smug" | "horrified" | "happy" | "angry";
export type Who = "I" | "P"; // I = injector (the clinician), P = patient

export interface ComicLine { who: Who; text: string }
export interface ComicPanel { inj: Expr; pat: Expr; lines: ComicLine[] }
export interface ComicConversation { id: string; title: string; panels: ComicPanel[] }

function line(s: string): ComicLine {
  const who = s.startsWith("I:") ? "I" : "P";
  return { who, text: s.slice(2).trim() };
}

function p(inj: Expr, pat: Expr, ...lines: string[]): ComicPanel {
  return { inj, pat, lines: lines.map(line) };
}

function c(id: string, title: string, panels: ComicPanel[]): ComicConversation {
  if (panels.length !== 6) throw new Error(`Comic ${id} must have exactly 6 panels`);
  return { id, title, panels };
}

export const COMIC_CONVERSATIONS: ComicConversation[] = [
  c("plunger", "The Plunger", [
    p("happy", "neutral", "I: Morning! What can I do for you today?"),
    p("neutral", "happy", "P: Lips. Massive ones. Like a toilet plunger."),
    p("neutral", "neutral", "I: That won’t suit your face shape, but we can enhance what you’ve got."),
    p("neutral", "smug", "P: The bloke at the car wash does them for a tenner."),
    p("smug", "neutral", "I: It’s not something I put my name to."),
    p("smug", "angry", "P: Fine. I’ll go to him.", "I: Off you pop, sweetheart. The kettle’s always on when you fancy doing it properly."),
  ]),
  c("foils", "The Foils", [
    p("neutral", "happy", "P: My hairdresser says she can do my forehead as well as my highlights."),
    p("horrified", "neutral", "I: Is she medically qualified?"),
    p("neutral", "happy", "P: She’s brilliant with foils."),
    p("neutral", "neutral", "I: Right. And her training?"),
    p("horrified", "happy", "P: A weekend course. And she’s very good at blow dries."),
    p("smug", "neutral", "I: Foils are for potatoes, pet, not foreheads. Sit yourself down and let’s do this properly."),
  ]),
  c("dr-google", "Dr Google", [
    p("neutral", "smug", "P: I’ve done my research."),
    p("neutral", "smug", "I: Wonderful. Where?"),
    p("neutral", "happy", "P: A Facebook group."),
    p("neutral", "happy", "I: Right. And who runs it?"),
    p("horrified", "happy", "P: Barbara. She did a course on a Sunday."),
    p("smug", "neutral", "I: Barbara did a Sunday course, I did years of them. Let’s give you the version that actually suits your face."),
  ]),
  c("tupperware", "The Tupperware", [
    p("neutral", "happy", "P: I bought my own filler online. Twelve quid. Can you pop it in?"),
    p("horrified", "happy", "I: Where did it come from?"),
    p("neutral", "happy", "P: A man called Dave. It arrived in a margarine tub."),
    p("horrified", "neutral", "I: Does it have a batch number?"),
    p("horrified", "happy", "P: It has a sticker of a unicorn."),
    p("smug", "neutral", "I: I’ll ask the unicorn to be your emergency contact. Meanwhile, let’s find something with a proper batch number."),
  ]),
  c("smurf", "The Smurf", [
    p("neutral", "horrified", "P: Bit embarrassing, but my lip’s gone a funny colour."),
    p("neutral", "horrified", "I: What colour?"),
    p("horrified", "neutral", "P: Blue. The lady on Facebook says it’s just bruising."),
    p("horrified", "neutral", "I: When did you have it done?"),
    p("horrified", "neutral", "P: This morning. She said to give it a day."),
    p("angry", "horrified", "I: Blue like that isn’t bruising, love. In the chair, before you start glowing in the dark."),
  ]),
  c("groupon", "The Voucher", [
    p("neutral", "happy", "P: I got a voucher. Three areas for forty quid."),
    p("neutral", "happy", "I: Lovely. Who’s doing it?"),
    p("horrified", "happy", "P: A lovely lad in a shed."),
    p("horrified", "neutral", "I: A shed?"),
    p("neutral", "happy", "P: A garden room. It has fairy lights."),
    p("smug", "neutral", "I: A shed with fairy lights sounds magical, but has it got insurance, or just good lighting?"),
  ]),
  c("candles", "Sharon's Kitchen", [
    p("neutral", "happy", "P: My mate Sharon does it at her kitchen table."),
    p("neutral", "happy", "I: Is Sharon a prescriber?"),
    p("horrified", "happy", "P: She sells candles."),
    p("neutral", "neutral", "I: Candles."),
    p("neutral", "happy", "P: Very good ones. Lavender."),
    p("smug", "neutral", "I: Lavender’s gorgeous on a pillow. Let’s leave your face to the people with the training."),
  ]),
  c("ring-light", "The Ring Light", [
    p("neutral", "happy", "P: I watched a video."),
    p("neutral", "happy", "I: Of what?"),
    p("neutral", "happy", "P: A woman doing her own lips in the car."),
    p("horrified", "neutral", "I: Is she trained?"),
    p("neutral", "smug", "P: She has a ring light."),
    p("smug", "neutral", "I: A ring light makes a lovely video, darling, but it isn’t a qualification. Let’s get you booked in properly."),
  ]),
  c("numbing", "Six Hours of Cling Film", [
    p("neutral", "happy", "P: I put numbing cream on before I came."),
    p("neutral", "happy", "I: Lovely. When?"),
    p("horrified", "happy", "P: Six hours ago. Cling film and everything."),
    p("horrified", "neutral", "I: Six hours."),
    p("neutral", "happy", "P: I can’t feel my face!"),
    p("smug", "neutral", "I: Six hours in cling film, bless you. Let’s wash that off and start you fresh."),
  ]),
  c("skip-consult", "The Lunch Break", [
    p("neutral", "neutral", "P: Can we skip the consultation? I’m on my lunch."),
    p("horrified", "neutral", "I: The consultation is the treatment."),
    p("neutral", "angry", "P: I’ve only got forty minutes."),
    p("neutral", "angry", "I: Then you’ve got forty minutes."),
    p("neutral", "neutral", "P: To have it done?"),
    p("smug", "horrified", "I: To fill in your medical form, love. Your sandwich isn’t the one having treatment, it can wait five minutes."),
  ]),
  c("carrier-bag", "The Carrier Bag", [
    p("neutral", "happy", "P: Nothing to declare. Healthy as a horse."),
    p("neutral", "happy", "I: Any medication?"),
    p("neutral", "neutral", "P: Just the odd tablet."),
    p("neutral", "neutral", "I: Which odd tablet?"),
    p("horrified", "neutral", "P: Just these. In here. Don’t look."),
    p("smug", "horrified", "I: That’s not an odd tablet, that’s the whole pharmacy. Let’s go through it together, properly."),
  ]),
  c("might-be", "Two Lines", [
    p("neutral", "neutral", "P: I might be pregnant."),
    p("neutral", "neutral", "I: Might?"),
    p("neutral", "happy", "P: Two lines on a stick this morning."),
    p("happy", "happy", "I: Congratulations! Then we’re not doing it today."),
    p("neutral", "horrified", "P: But I booked!"),
    p("smug", "happy", "I: Your lips can wait nine months, the baby can’t. Congratulations, and mind where you wave that stick."),
  ]),
  c("long-haul", "Wheels Up", [
    p("neutral", "happy", "P: Can you do my lips tonight? I fly to Turkey in the morning."),
    p("horrified", "happy", "I: How long is the flight?"),
    p("neutral", "happy", "P: Four hours."),
    p("neutral", "neutral", "I: And who’s looking after you when you land?"),
    p("neutral", "happy", "P: My sunhat."),
    p("smug", "neutral", "I: Your sunhat’s lovely, but it isn’t an aftercare team. Let’s get you sorted the week you’re home."),
  ]),
  c("wedding", "The Big Day", [
    p("neutral", "happy", "P: Wedding tomorrow. Whole face please."),
    p("horrified", "happy", "I: Tomorrow?"),
    p("neutral", "happy", "P: Yes!"),
    p("neutral", "neutral", "I: You could be bruised in every photograph."),
    p("neutral", "horrified", "P: Is that bad?"),
    p("smug", "horrified", "I: Only if you fancy wedding photos that look like a boxing match. Let’s pick you a kinder date."),
  ]),
  c("spin-class", "Spin Class", [
    p("neutral", "happy", "P: Can I go to spin class after?"),
    p("neutral", "neutral", "I: No."),
    p("neutral", "happy", "P: The sauna?"),
    p("neutral", "neutral", "I: No."),
    p("neutral", "smug", "P: A large glass of wine?"),
    p("smug", "horrified", "I: Go home, put your feet up like a Victorian lady, and close that tab with the twelve miracle hacks."),
  ]),
  c("tiktok", "TikTok Says", [
    p("neutral", "neutral", "P: Do I actually need aftercare?"),
    p("neutral", "neutral", "I: Yes."),
    p("neutral", "smug", "P: TikTok says you don’t."),
    p("neutral", "smug", "I: Does it."),
    p("neutral", "happy", "P: A woman with a lot of followers said so."),
    p("smug", "horrified", "I: She also told everyone to put a potato in their ear. Stick with my instructions, save the potato for chips."),
  ]),
  c("tenner", "A Tenner", [
    p("neutral", "happy", "P: Sandra does it for a tenner."),
    p("neutral", "happy", "I: What’s in the syringe?"),
    p("neutral", "happy", "P: Water, probably."),
    p("horrified", "neutral", "I: Probably water?"),
    p("neutral", "happy", "P: She said it’s fine."),
    p("smug", "horrified", "I: Then you’re paying a tenner to be gently drizzled on. Let’s find you something that actually works."),
  ]),
  c("face-roller", "Five Steves", [
    p("neutral", "happy", "P: I bought a face roller with tiny needles."),
    p("neutral", "happy", "I: From where?"),
    p("neutral", "happy", "P: A website that only takes gift cards."),
    p("horrified", "neutral", "I: That’s a red flag."),
    p("neutral", "smug", "P: It has five stars!"),
    p("smug", "horrified", "I: Five Steves and a robot left those reviews, love. Straight in the bin, and block Steve while you’re at it."),
  ]),
  c("consent", "The Napkin", [
    p("neutral", "neutral", "P: Do I have to sign all this?"),
    p("neutral", "neutral", "I: Yes."),
    p("neutral", "horrified", "P: It’s a lot of words."),
    p("neutral", "neutral", "I: It’s your face. Read the words. Ask me anything."),
    p("neutral", "smug", "P: The place down the road just took my card."),
    p("smug", "horrified", "I: Their consent form was a napkin and a wink, apparently. Mine has words, because the words matter."),
  ]),
  c("pickled-onions", "The Fridge", [
    p("neutral", "happy", "P: Can I see the product first?"),
    p("happy", "happy", "I: Of course. Here’s the box, the batch number and the expiry date."),
    p("neutral", "neutral", "P: The last place never showed me."),
    p("neutral", "neutral", "I: Where did they keep it?"),
    p("neutral", "happy", "P: In the fridge. Next to the pickled onions."),
    p("smug", "horrified", "I: That’s not a medical fridge, sweetheart, that’s a deli counter. Let’s keep you well away from the gherkins."),
  ]),
  c("party", "The Party", [
    p("neutral", "happy", "P: There’s a party on Friday. Wine, nibbles and a lady with needles."),
    p("horrified", "happy", "I: Wine and needles."),
    p("neutral", "happy", "P: There’s a cheese board!"),
    p("neutral", "neutral", "I: Who’s the lady?"),
    p("neutral", "happy", "P: Debbie. She’s lovely."),
    p("smug", "horrified", "I: That’s not a party, it’s a hostage situation with canapés. Sharps bin next to the sausage rolls, is it?"),
  ]),
  c("dm", "The DM", [
    p("neutral", "happy", "P: She messaged me on Instagram. Sixty percent off."),
    p("neutral", "happy", "I: Did she ask for your medical history?"),
    p("neutral", "neutral", "P: She asked for my bank details."),
    p("horrified", "neutral", "I: Your bank details."),
    p("neutral", "happy", "P: And a deposit in gift cards."),
    p("smug", "horrified", "I: She’s not a clinician, love, just a lovely filter and sticky fingers. Block her and keep that bank card close."),
  ]),
  c("kev", "Four Hundred Kevs", [
    p("neutral", "happy", "P: She’s got four hundred five star reviews."),
    p("neutral", "happy", "I: From real patients?"),
    p("neutral", "neutral", "P: All from people called Kev."),
    p("horrified", "neutral", "I: All of them."),
    p("neutral", "neutral", "P: Kev from Bolton. Kev from Leeds. Kevin."),
    p("smug", "horrified", "I: Kev’s had every treatment in Britain, apparently, and reviewed them all in the same handwriting. Busy man."),
  ]),
  c("nda", "The Wonky Lip", [
    p("neutral", "horrified", "P: Can you fix my lip? It’s a bit wonky."),
    p("neutral", "horrified", "I: Who did it?"),
    p("neutral", "horrified", "P: I can’t say."),
    p("neutral", "neutral", "I: Why not?"),
    p("neutral", "horrified", "P: I signed something."),
    p("horrified", "horrified", "I: You signed a secrecy agreement over a wonky lip. It’s a lip, love, not the nuclear codes. Let’s take a look."),
  ]),
  c("allergic", "Only Mondays", [
    p("neutral", "happy", "P: I’m not allergic to anything."),
    p("neutral", "neutral", "I: Nothing?"),
    p("neutral", "neutral", "P: Only penicillin, shellfish and latex."),
    p("horrified", "neutral", "I: That’s three things."),
    p("neutral", "smug", "P: And Mondays."),
    p("smug", "happy", "I: Mondays I can’t help with. Everything else I’d like in writing, in capitals, with a doctor’s note."),
  ]),
  c("gin", "The Gin", [
    p("neutral", "happy", "P: The last place said it wouldn’t hurt at all."),
    p("neutral", "happy", "I: Did she use numbing cream?"),
    p("neutral", "happy", "P: She used gin."),
    p("horrified", "happy", "I: Gin."),
    p("neutral", "happy", "P: Two large ones. I felt nothing."),
    p("smug", "horrified", "I: Gin is not an anaesthetic. It’s just confidence in a glass. Water for you, and a tonic for me."),
  ]),
  c("chair", "A Firm Chair", [
    p("neutral", "happy", "P: I’m not scared of needles."),
    p("neutral", "horrified", "I: You’re holding the chair."),
    p("neutral", "horrified", "P: It’s a very firm chair."),
    p("happy", "horrified", "I: Breathe in. Let’s pop your head down for a minute."),
    p("happy", "horrified", "P: I’m fine. I’m fine. I’m absolutely fine."),
    p("smug", "horrified", "I: Let go of the chair. Your knuckles have gone the colour of Wensleydale."),
  ]),
  c("souffle", "The Soufflé", [
    p("neutral", "neutral", "P: It feels a bit odd. I keep prodding it."),
    p("horrified", "neutral", "I: Hands off, please."),
    p("neutral", "happy", "P: Just a little poke."),
    p("neutral", "neutral", "I: Would you prod a soufflé?"),
    p("neutral", "neutral", "P: No."),
    p("smug", "horrified", "I: Hands in your pockets, please. It’s a face, not a stress ball."),
  ]),
  c("diy-syringe", "Do It Yourself", [
    p("neutral", "happy", "P: Can you just give me the syringe to take home?"),
    p("horrified", "happy", "I: No."),
    p("neutral", "smug", "P: I’ve watched loads of videos."),
    p("neutral", "neutral", "I: I’ve trained for years."),
    p("neutral", "neutral", "P: So?"),
    p("smug", "horrified", "I: I can’t even reach the itch on my own back. That’s why we have professionals. Sit down."),
  ]),
  c("gavin", "Gavin", [
    p("neutral", "horrified", "P: Can you undo it? A man called Gavin did it."),
    p("neutral", "horrified", "I: What did Gavin use?"),
    p("neutral", "horrified", "P: He said it was a secret blend."),
    p("horrified", "horrified", "I: A secret blend."),
    p("neutral", "neutral", "P: He was very confident."),
    p("smug", "horrified", "I: Gavin’s secret blend is a secret from Gavin. Sit down, we’ll find out properly."),
  ]),
  c("tour", "The Lump on Tour", [
    p("neutral", "horrified", "P: It’s moved."),
    p("neutral", "horrified", "I: Where to?"),
    p("neutral", "horrified", "P: It was on my cheek on Tuesday. Now it’s on my chin."),
    p("horrified", "horrified", "I: Has it been on the bus?"),
    p("neutral", "neutral", "P: I think it’s having a lovely time."),
    p("smug", "horrified", "I: Then it’s on tour. Let’s get it home before it starts selling merchandise."),
  ]),
  c("plum", "The Plum", [
    p("neutral", "happy", "P: Two bottles of wine last night. Tiny headache."),
    p("horrified", "happy", "I: And you’d like treatment today?"),
    p("neutral", "happy", "P: I’ve had a very big glass of water."),
    p("neutral", "neutral", "I: You could bruise like a plum."),
    p("neutral", "horrified", "P: A nice plum?"),
    p("smug", "horrified", "I: Come back when your liver’s forgiven you, love. Let’s not have you bruised like a fruit bowl."),
  ]),
  c("cold-sore", "It Has A Name", [
    p("neutral", "happy", "P: I’ve got a tiny cold sore."),
    p("neutral", "happy", "I: How tiny?"),
    p("neutral", "neutral", "P: Medium."),
    p("horrified", "neutral", "I: Medium."),
    p("neutral", "horrified", "P: It’s called Kevin."),
    p("smug", "horrified", "I: Rebook. Tell Kevin I said hello, and that his tenancy has been terminated."),
  ]),
  c("tomato", "The Tomato", [
    p("neutral", "happy", "P: I’m a tiny bit pink."),
    p("horrified", "happy", "I: You’re the colour of a tomato."),
    p("neutral", "happy", "P: I’ve just got back from the beach."),
    p("neutral", "neutral", "I: Which beach?"),
    p("neutral", "happy", "P: The whole of Spain."),
    p("smug", "horrified", "I: Come back when you’ve cooled down a bit, love. You’ve been cooked on both sides."),
  ]),
  c("extension", "The Kitchen Extension", [
    p("neutral", "happy", "P: Can we do everything today? Lips, cheeks, chin, jaw, nose."),
    p("horrified", "happy", "I: Everything?"),
    p("neutral", "happy", "P: I’ve got a coupon."),
    p("neutral", "neutral", "I: Are you going to a wedding or being rebuilt?"),
    p("neutral", "neutral", "P: Can’t I be both?"),
    p("smug", "horrified", "I: I treat faces, not kitchen extensions. One area today. Skylights are extra."),
  ]),
  c("fox", "Fox Eyes", [
    p("neutral", "happy", "P: I want fox eyes."),
    p("neutral", "happy", "I: Do you want to look surprised?"),
    p("neutral", "neutral", "P: What do you mean?"),
    p("neutral", "neutral", "I: Permanently."),
    p("horrified", "horrified", "P: Oh."),
    p("smug", "happy", "I: I don’t do faces that look like they’ve just seen the electric bill."),
  ]),
  c("subscription", "The Subscription", [
    p("neutral", "happy", "P: I did the course myself."),
    p("neutral", "happy", "I: How long was it?"),
    p("neutral", "happy", "P: A Saturday."),
    p("neutral", "neutral", "I: Which year?"),
    p("neutral", "smug", "P: Every year. It’s a subscription."),
    p("smug", "horrified", "I: A subscription to learn how not to hurt people. Lovely. Does it come with a free tote bag?"),
  ]),
  c("insurance", "Insurance", [
    p("neutral", "neutral", "P: Are you insured?"),
    p("happy", "neutral", "I: I am. Good question."),
    p("neutral", "smug", "P: The woman off Facebook says she doesn’t need it."),
    p("neutral", "neutral", "I: Doesn’t she."),
    p("neutral", "neutral", "P: She says nothing ever goes wrong."),
    p("smug", "horrified", "I: That’s not confidence, love, that’s a lawsuit waiting to happen. I’m properly insured, so let’s begin."),
  ]),
  c("kettle", "The Hotel Room", [
    p("neutral", "happy", "P: She’s doing them in a hotel room."),
    p("horrified", "happy", "I: Which hotel?"),
    p("neutral", "happy", "P: The Premier Inn. She brought a kettle."),
    p("neutral", "neutral", "I: A kettle."),
    p("neutral", "happy", "P: For the sterile bit."),
    p("smug", "horrified", "I: Lovely. Sterilised like a cup of tea. Does the aftercare come with a biscuit?"),
  ]),
  c("dartboard", "The Dartboard", [
    p("neutral", "happy", "P: She’s set up in the back room of the Dog and Duck."),
    p("neutral", "happy", "I: Is that a clean room?"),
    p("neutral", "happy", "P: There’s a dartboard."),
    p("horrified", "happy", "I: A dartboard."),
    p("neutral", "happy", "P: And a very comfy stool."),
    p("smug", "horrified", "I: I do hope she can tell the dartboard from your lips. Treble twenty is not the target."),
  ]),
];

export const COMIC_EXPRESSIONS: Expr[] = ["neutral", "smug", "horrified", "happy", "angry"];

// Words that must never appear in a bubble (the site's own caption rules ban them).
export const COMIC_BANNED = ["anti-wrinkle", "botox", "safe", "guarantee", "—", "–"];
