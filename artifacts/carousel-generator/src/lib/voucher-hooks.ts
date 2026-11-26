// VOUCHERS: Vanessa's own 30 Christmas gift voucher hooks, in five groups (each group is a clickable tab on the page).
// Each one is a three story sequence: Story 1 is the hook, Story 2 the offer, Story 3 the reply word. The lines are used exactly as she wrote them.
// [Clinic name] is filled in with the client's own name on the page. The static post (1080 x 1440) uses Story 1 as its hook, and the stories tool uses all three.

export type VoucherRow = { id: string; group: string; n: number; s1: string; s2: string; s3: string };
export const VOUCHER_GROUPS: { id: string; label: string }[] = [
 {
  "id": "vg1",
  "label": "For the gift buyers"
 },
 {
  "id": "vg2",
  "label": "For the family group chat"
 },
 {
  "id": "vg3",
  "label": "For anyone one bad gift away from taking over"
 },
 {
  "id": "vg4",
  "label": "For the ones quietly shopping for themselves"
 },
 {
  "id": "vg5",
  "label": "For the last-minute shoppers"
 }
];
const DATA: { g: number; n: number; s1: string; s2: string; s3: string }[] = [
{
"g": 0,
"n": 1,
"s1": "She said “don’t get me anything”. That was a trap.",
"s2": "I’ve got a Christmas gift voucher she can spend on something she’s already had her eye on.",
"s3": "DM me GIFT and I’ll send you the voucher options before you take her literally."
},
{
"g": 0,
"n": 2,
"s1": "For the woman who buys herself everything, usually before you’ve wrapped it.",
"s2": "Give her something to look forward to in January. She can choose how to spend her clinic gift voucher.",
"s3": "DM me VOUCHER and I’ll send the details so you can beat her to it for once."
},
{
"g": 0,
"n": 3,
"s1": "She’s got enough candles to see her through a power cut.",
"s2": "I’ve got Christmas gift vouchers for anyone who’d quite like an hour on the clinic couch this winter.",
"s3": "DM me GIFT and I’ll send you the options. You can step away from the scented candle aisle."
},
{
"g": 0,
"n": 4,
"s1": "Before you panic-buy another scarf, have a word with me.",
"s2": "My Christmas gift vouchers let her choose something she’d actually like from the clinic.",
"s3": "DM me GIFT and I’ll send the details. One present sorted before you reach the till."
},
{
"g": 0,
"n": 5,
"s1": "She said “surprise me”. You’ve been staring at a pair of slippers for 20 minutes.",
"s2": "Surprise her with a clinic gift voucher. She can look forward to a visit and choose what she fancies.",
"s3": "DM me SURPRISE and I’ll send you the Christmas offer. You’re free to leave the slipper aisle."
},
{
"g": 0,
"n": 6,
"s1": "For the woman who puts everyone else on the list and forgets herself.",
"s2": "A clinic gift voucher gives her something of her own to look forward to once the house goes quiet.",
"s3": "DM me GIFT and I’ll send you the options so you can put her name on the list."
},
{
"g": 1,
"n": 7,
"s1": "My Christmas wishlist is one slide long. You’re welcome.",
"s2": "A gift voucher for [Clinic name], please. An hour to myself in January sounds lovely.",
"s3": "Screenshot this and send it to whoever asked. They can DM me GIFT for the details."
},
{
"g": 1,
"n": 8,
"s1": "Send this to the person who buys your presents at the petrol station.",
"s2": "Hello, you. I’ve got Christmas gift vouchers at the clinic. She’s sent you straight to the answer.",
"s3": "DM me GIFT and I’ll send you the options. You can still get her a Twirl for the stocking."
},
{
"g": 1,
"n": 9,
"s1": "If this lands in your family WhatsApp, someone’s done you a favour.",
"s2": "Here’s what she’s after. A Christmas gift voucher for [Clinic name] so she can pick something herself.",
"s3": "DM me VOUCHER and I’ll send the options before someone in the chat suggests a hamper."
},
{
"g": 1,
"n": 10,
"s1": "I could drop a subtle hint. Or I could send you this.",
"s2": "Here’s the extremely subtle hint. A Christmas gift voucher for [Clinic name] would go down very well.",
"s3": "Send this to your designated present buyer. Tell them to DM me GIFT and I’ll take it from there."
},
{
"g": 1,
"n": 11,
"s1": "My love language is you asking what I want and then actually getting it.",
"s2": "Since you asked, I’d love a Christmas gift voucher for [Clinic name]. I’ve already got something in mind.",
"s3": "Send this to the person who asked. They can DM me GIFT for the Christmas offer."
},
{
"g": 1,
"n": 12,
"s1": "If your other half needs a hint, here it is in massive letters.",
"s2": "A CHRISTMAS GIFT VOUCHER FOR [CLINIC NAME], PLEASE.",
"s3": "Forward this to them. They can DM me HINT and I’ll send the details."
},
{
"g": 2,
"n": 13,
"s1": "This is an intervention for anyone about to buy a bath bomb shaped like a sprout.",
"s2": "Put the sprout back. A Christmas gift voucher gives her something to look forward to after Boxing Day.",
"s3": "DM me GIFT and I’ll send you the options before you spot the matching soap."
},
{
"g": 2,
"n": 14,
"s1": "Put the novelty gin glass down. We can still save Christmas.",
"s2": "She’s got six of those. A clinic gift voucher lets her choose something she’s had her eye on.",
"s3": "DM me GIFT and I’ll send you the Christmas offer. Consider this your escape route from the gift aisle."
},
{
"g": 2,
"n": 15,
"s1": "If the gift comes with a plug and cleans the kitchen, have another think.",
"s2": "A clinic gift voucher is something she gets to enjoy all to herself. The kitchen can wait.",
"s3": "DM me GIFT for the voucher options and give her something she’ll be glad to unwrap."
},
{
"g": 2,
"n": 16,
"s1": "Remember the foot spa? Neither does she. It’s still in the loft.",
"s2": "This year, give her a clinic gift voucher. She can choose what she’d like and have a little date in the diary to look forward to.",
"s3": "DM me VOUCHER for the Christmas offer. The loft’s full anyway."
},
{
"g": 2,
"n": 17,
"s1": "We’ve all opened a present and said “Ooh, that’s handy.” Let’s aim higher.",
"s2": "I’ve got Christmas gift vouchers for the person who’d love a bit of time to herself after the December rush.",
"s3": "DM me GIFT and I’ll send the options. Aim for “Ooh, when can I book?”"
},
{
"g": 2,
"n": 18,
"s1": "For the person who got a torch last year. It’s your turn to have a nice Christmas.",
"s2": "Fancy an hour to yourself in the new year? My Christmas clinic vouchers give the family a very clear steer.",
"s3": "Send this to whoever bought the torch. They can DM me GIFT for the details."
},
{
"g": 3,
"n": 19,
"s1": "One for her. One for me. I’m calling it efficient.",
"s2": "My Christmas gift vouchers are available for both of you. Pick one for her and give yourself something to look forward to as well.",
"s3": "DM me TWO and I’ll send you the options so you can sort both in one go."
},
{
"g": 3,
"n": 20,
"s1": "Imagine opening a present you actually asked for. What a December that would be.",
"s2": "If a clinic gift voucher is what you’d love, you’ve got something concrete to put on the list.",
"s3": "DM me WISHLIST and I’ll send you the Christmas offer to forward straight on."
},
{
"g": 3,
"n": 21,
"s1": "I’ve reached the age where “an hour to myself” belongs on the Christmas list.",
"s2": "A clinic gift voucher gives you a reason to put that hour in the diary after Christmas.",
"s3": "DM me MY HOUR and I’ll send you the details to pass to whoever’s asking."
},
{
"g": 3,
"n": 22,
"s1": "If you’re buying it for yourself, I’ll still call it a Christmas present.",
"s2": "My Christmas voucher offer is for you too. Give yourself something lovely to look forward to when the decorations come down.",
"s3": "DM me FOR ME and I’ll send the options. You’re allowed to skip the wrapping."
},
{
"g": 3,
"n": 23,
"s1": "Buy yourself something lovely and act surprised on Christmas morning.",
"s2": "If you’ve been eyeing up something at the clinic, here’s your excuse to pop a Christmas voucher under the tree with your name on it.",
"s3": "DM me SURPRISE and I’ll send you the offer. Practise your “Oh, you shouldn’t have.”"
},
{
"g": 3,
"n": 24,
"s1": "The annual “shall we just buy our own presents?” conversation starts here.",
"s2": "If that’s the arrangement this year, my Christmas gift vouchers are available. You get to pick what you fancy and when you fancy it.",
"s3": "DM me FOR ME and I’ll send you the options. That’s one family negotiation done."
},
{
"g": 4,
"n": 25,
"s1": "Still got “Mum?” in your notes app? Come here.",
"s2": "For the mum who always says “I’m fine, love”, a clinic gift voucher gives her something to look forward to once she’s got the house back.",
"s3": "DM me MUM and I’ll send the options so you can finally tick her off the list."
},
{
"g": 4,
"n": 26,
"s1": "If your shopping list just says “something nice”, I can work with that.",
"s2": "How about a Christmas gift voucher for the clinic? You pick the voucher and she picks what she fancies.",
"s3": "DM me GIFT and I’ll send the Christmas offer. That’s “something nice” sorted."
},
{
"g": 4,
"n": 27,
"s1": "You’ve bought the pigs in blankets. You’ve forgotten your sister.",
"s2": "If she’s been talking about coming to the clinic, a Christmas gift voucher will make it look like you’ve been listening all year.",
"s3": "DM me SISTER and I’ll send you the voucher options before she asks how the shopping’s going."
},
{
"g": 4,
"n": 28,
"s1": "Christmas shopping update. You’ve bought yourself three things.",
"s2": "Right, who’s still on the list? A clinic gift voucher will suit the one who’d love a bit of time to herself after Christmas.",
"s3": "DM me GIFT for the options. Then you can get back to whatever you were buying yourself."
},
{
"g": 4,
"n": 29,
"s1": "You’ve got time to save Christmas. You’ve got less time to learn to knit.",
"s2": "I’ve got Christmas gift vouchers at the clinic. She can choose how to spend hers while you quietly put the wool away.",
"s3": "DM me GIFT and I’ll tell you how to get yours and when you can collect it."
},
{
"g": 4,
"n": 30,
"s1": "If your plan was “I’ll nip into town on Christmas Eve”, read the next slide.",
"s2": "A Christmas gift voucher for [Clinic name] could save you a lap of the shops and another argument with the parking machine.",
"s3": "DM me GIFT and I’ll send you the voucher options and the last available collection time."
}
];
export const VOUCHER_ROWS: VoucherRow[] = DATA.map((r) => ({ id: `vq${r.n}`, group: VOUCHER_GROUPS[r.g].id, n: r.n, s1: r.s1, s2: r.s2, s3: r.s3 }));
