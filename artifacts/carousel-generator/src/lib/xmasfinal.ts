// XMAS FINAL: eight hand picked Christmas posts as single image posts for every client (vouchers, party prep, clinic humour, thank you, January diary).
// The line on the picture is her own wording, used exactly as written. The caption for each one is written in the clinic's first person voice, kind and a little funny,
// and ends on a question. The 5 hashtags are built from the client's area on the page, the same as XMAS FEELS.
import type { XmasFeelsRow } from "./xmasfeels";

const ROWS: { line: string; caption: string }[] = [
  {
    line: "Dear Santa, I've been good. Mostly. Please send vouchers.",
    caption: "I wrote my letter to Santa early this year and every line of it is about gift vouchers. If you have been very good, which I suspect you have, you can write yours too. Treat someone who deserves it, or drop a heavy hint and let somebody treat you. Vouchers are lovely to give, lovely to receive and need no wrapping skills whatsoever. Comment VOUCHER and I will send you the details. Who is on your nice list this year?",
  },
  {
    line: "Husbands, this is your hint. Leave it where she will see it.",
    caption: "Husbands, partners and brave sons, consider yourselves officially hinted at. If she has said she doesn't need anything this year, please translate that as surprise me with something lovely. A gift voucher takes five minutes to sort and saves you a frantic dash round the shops on Christmas Eve. Screenshot this post, leave it somewhere she will see it and look very innocent. Comment VOUCHER and I will do the rest. Who is dropping hints in your house?",
  },
  {
    line: "Mum has everything. Mum does not have a facial.",
    caption: "Every year we ask mum what she wants and every year she says nothing, and then we buy another candle. This year, give her an hour where nobody asks her for a single thing. A voucher gives her a calm room, a comfy bed and a very good reason to put her phone down. She will say it is too much and then book the first appointment going. Comment VOUCHER for ideas at every budget. How many candles does your mum own?",
  },
  {
    line: "Voucher in a box. Wrapping skills not included.",
    caption: "I tried to wrap a voucher this morning and ended up with more sellotape on me than on the box. Luckily the gift inside does all the talking, so all you need to do is add a bow and take the credit. Christmas arrives sooner than we think, so please do not leave it until the last minute and end up wrapping in the car park. Comment VOUCHER and I will get yours sorted. Be honest, how good are you at wrapping?",
  },
  {
    line: "Your work do is in three weeks. Your skin has a plan.",
    caption: "Party season has a way of arriving all at once. The work do, the school get together, the family gathering and a New Year's Eve you promised yourself you would enjoy. Booking in a few weeks ahead gives us time to look after your skin properly, with no panic on the day. Pick your date, work backwards and let me help with the rest. Comment PARTY and I will help you plan. Which event are you most looking forward to?",
  },
  {
    line: "Things I have said in the clinic this December.",
    caption: "Yes, you can book in between the nativity and the supermarket shop. No, I will not judge the gravy granules in your handbag. Yes, you can bring your whole list and have a good moan about the Secret Santa drama. I say all of this with love, because December is a madhouse and my treatment room is where you get to breathe out. You are always welcome here. What is the funniest thing you have said to someone this month?",
  },
  {
    line: "This year you trusted me with your faces. Properly humbling.",
    caption: "I have had the honour of looking after so many of you this year, through nerves, big occasions, quiet days and a lot of laughing. Thank you for trusting me with your skin and for telling me what is really going on in your lives. You make coming to work a joy. I hope Christmas is gentle with you, whatever it looks like in your house. What is the nicest thing that has happened to you this year?",
  },
  {
    line: "My January diary is filling up faster than a Christmas stocking.",
    caption: "The new year rush starts before the last mince pie has been eaten. If you would like a January slot, now is the time to put your name down, and you can still enjoy every bit of Christmas first. Booking early means you choose the day and time that suit you, which is a lovely thing to have sorted before the turkey goes in. Comment DIARY and I will send over the dates I have left. What is the first thing you are planning for yourself in January?",
  },
];

export const XMASFINAL_ROWS: XmasFeelsRow[] = ROWS.map((r, i) => ({ id: `xfin${i + 1}`, line: r.line, caption: r.caption }));
