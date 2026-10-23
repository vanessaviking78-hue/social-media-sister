// The Hook Bank: slide 1 hooks chosen by Vanessa, with the dates each seasonal hook can be posted.
// To add a hook, add a line to HOOKS. To move a season, change SEASON_WINDOWS.

export type HookDay = "Monday" | "Wednesday" | "Friday" | "Sunday" | "Any day";
export type HookSeason = "" | "Halloween" | "Bonfire" | "Christmas";
export type Hook = { code: string; day: HookDay; season: HookSeason; text: string };

// Which of the pack's 20 rows each kind of hook fills, in order. The treatment hooks take the
// three treatments in turn, then the first treatment again, matching how the pack is written.
export const HOOK_DAYS: { day: HookDay; label: string; rows: number[]; max: number }[] = [
  { day: "Monday", label: "Monday, treatment posts", rows: [1, 6, 11, 16], max: 4 },
  { day: "Wednesday", label: "Wednesday, nostalgic and funny", rows: [2, 7, 12, 17], max: 4 },
  { day: "Friday", label: "Friday, things that and breaking news", rows: [3, 8, 13, 18], max: 4 },
  { day: "Sunday", label: "Sunday, shareable and emotional", rows: [4, 9, 14, 19], max: 4 },
  { day: "Any day", label: "Any day, heard and humour", rows: [10, 15, 5, 20], max: 4 },
];
const TREATMENT_FOR_SLOT = [0, 1, 2, 0];

// The dates each season can be posted, as [month, day]. A hook outside its window is hidden for that pack.
export const SEASON_WINDOWS: Record<Exclude<HookSeason, "">, { from: [number, number]; to: [number, number]; label: string }> = {
  Halloween: { from: [10, 31], to: [10, 31], label: "Halloween" },
  Bonfire: { from: [11, 4], to: [11, 4], label: "Bonfire Night" },
  Christmas: { from: [11, 1], to: [12, 25], label: "Christmas" },
};

export const HOOKS: Hook[] = [
  { code: "NM1", day: "Monday", season: "", text: "Quick poll: who else has [treatment] saved on their phone, never booked, and now it feels like a pet? Say hi." },
  { code: "NM2", day: "Monday", season: "", text: "Ask me anything about [treatment]. I have a hot drink and a good mood. Go." },
  { code: "NM3", day: "Monday", season: "", text: "[Treatment]: what I wish someone had told me before I got curious. Swipe, then tell me which one surprised you." },
  { code: "NM4", day: "Monday", season: "", text: "Think you know [treatment]? Swipe for the bits nobody mentions, then give yourself a score out of ten." },
  { code: "NM5", day: "Monday", season: "", text: "Finish this sentence: 'I would try [treatment] if only ______.' I read every single answer." },
  { code: "NM6", day: "Monday", season: "", text: "[Treatment] myths I am retiring today, right next to the Tamagotchi. Which one did you believe?" },
  { code: "NM7", day: "Monday", season: "", text: "Three things to ask before you book [treatment] anywhere. Number two always gets a lot of nods." },
  { code: "NM8", day: "Monday", season: "", text: "[Treatment] for the woman who has read every review and still has one more tab open." },
  { code: "NM9", day: "Monday", season: "", text: "I am answering your [treatment] questions in public, because someone else is wondering too. Drop yours below." },
  { code: "NM10", day: "Monday", season: "", text: "Nobody has ever asked a silly question about [treatment]. Prove me wrong in the comments." },
  { code: "NM11", day: "Monday", season: "", text: "Things people whisper about [treatment] in the coffee shop queue. Swipe, then tell me what you have heard." },
  { code: "NM12", day: "Monday", season: "", text: "[Treatment], explained like we are sharing a plate of biscuits. Pull up a chair." },
  { code: "NM13", day: "Monday", season: "Christmas", text: "Dear Santa, all I want is a calm, no pressure chat about [treatment] and a parking space. Which is harder to find?" },
  { code: "NM14", day: "Monday", season: "Christmas", text: "Party season is coming. If [treatment] has been on your mind, pop the kettle on and come for a chat first." },
  { code: "NW1", day: "Wednesday", season: "", text: "Name the first song you taped off the radio and I will guess your age. With love." },
  { code: "NW2", day: "Wednesday", season: "", text: "School lunchbox time: a Dairylea Lunchable, a Penguin or a Capri-Sun stabbed far too hard? Pick your side." },
  { code: "NW3", day: "Wednesday", season: "", text: "Hands up if you have ever rewound a VHS with a pencil. Pencil gang, assemble." },
  { code: "NW4", day: "Wednesday", season: "", text: "To phone your best mate you had to say 'Hello, is Sarah there please?' to her mum. Whose mum was the scariest?" },
  { code: "NW5", day: "Wednesday", season: "", text: "Tell me you are a 90s kid without saying a year. I will start: a scrunchie on every wrist." },
  { code: "NW6", day: "Wednesday", season: "", text: "Who else had a Tamagotchi that died during maths? Rest in peace, little guy." },
  { code: "NW7", day: "Wednesday", season: "", text: "Rate your 90s bedroom: glow stars on the ceiling, a boy band poster or a lava lamp? Comment your combo." },
  { code: "NW8", day: "Wednesday", season: "", text: "School disco, 1995. Where were you: dancing, holding up the wall or guarding the tuck shop?" },
  { code: "NW9", day: "Wednesday", season: "", text: "Before Pinterest we had the Argos catalogue and a biro. What did you circle?" },
  { code: "NW10", day: "Wednesday", season: "", text: "Type your first ever email address in the comments. I dare you. Extra points for numbers and underscores." },
  { code: "NW11", day: "Wednesday", season: "", text: "Pick one: dial-up internet or a Nokia that survived a flight down the stairs." },
  { code: "NW12", day: "Wednesday", season: "", text: "Name something you owned in the 90s that would now be a vintage find. Butterfly clips, I am looking at you." },
  { code: "NW13", day: "Wednesday", season: "Halloween", text: "Halloween as a kid: a bin bag costume, face paint from the corner shop and a torch for the walk home. What was yours?" },
  { code: "NW14", day: "Wednesday", season: "Bonfire", text: "Bonfire Night: a sparkler, a pair of mittens and a grown-up shouting 'stand back'. Who was your sparkler boss?" },
  { code: "NW15", day: "Wednesday", season: "Christmas", text: "The Christmas Radio Times, a highlighter and a plan for the telly. Which film did you circle first?" },
  { code: "NW16", day: "Wednesday", season: "Christmas", text: "Christmas morning, 6am: tinsel everywhere and one grown-up begging for five more minutes. Which one were you?" },
  { code: "NW17", day: "Wednesday", season: "", text: "One minute you're at Gatecrasher. Next minute you're discussing oestrogen." },
  { code: "NW18", day: "Wednesday", season: "", text: "One minute you're drinking Bacardi Breezers. Next minute alcohol ruins your entire weekend." },
  { code: "NW19", day: "Wednesday", season: "", text: "One minute you're at Creamfields. Next minute you're excited about a new mattress." },
  { code: "NW20", day: "Wednesday", season: "", text: "One minute you're dancing until 6am. Next minute you're awake at 3am for absolutely no reason." },
  { code: "NW21", day: "Wednesday", season: "", text: "One minute you're wearing Miss Sixty jeans. Next minute you're Googling \"why am I suddenly bloated?\"" },
  { code: "NW22", day: "Wednesday", season: "", text: "One minute you're buying Impulse O2. Next minute you're buying magnesium." },
  { code: "NW23", day: "Wednesday", season: "", text: "One minute you're putting Sun-In in your hair. Next minute you're paying £40 for heat protection." },
  { code: "NW24", day: "Wednesday", season: "", text: "One minute you're using baby oil to tan. Next minute you're emotionally attached to SPF 50." },
  { code: "NW25", day: "Wednesday", season: "", text: "One minute you're at The Hacienda. Next minute you're comparing vitamin D results." },
  { code: "NW26", day: "Wednesday", season: "", text: "One minute you're queuing for a nightclub. Next minute you're furious there's nowhere to sit." },
  { code: "NW27", day: "Wednesday", season: "", text: "One minute you're getting home at 7am. Next minute staying out past 10 requires a recovery strategy." },
  { code: "NW28", day: "Wednesday", season: "", text: "One minute you're asking \"Where's the afterparty?\" Next minute you're asking \"What time are we eating?\"" },
  { code: "NW29", day: "Wednesday", season: "", text: "One minute you're dancing on a podium. Next minute you've got a favourite orthopaedic pillow." },
  { code: "NW30", day: "Wednesday", season: "", text: "One minute you're wearing a Wonderbra. Next minute you're removing your bra at 6:14pm." },
  { code: "NW31", day: "Wednesday", season: "", text: "One minute you've got 97 eyebrow hairs. Next minute you've named every remaining one." },
  { code: "NW32", day: "Wednesday", season: "", text: "One minute you're shaving your eyebrows off. Next minute you're paying someone to put them back." },
  { code: "NW33", day: "Wednesday", season: "", text: "One minute you're wearing Heather Shimmer. Next minute you're researching lip hydration." },
  { code: "NW34", day: "Wednesday", season: "", text: "One minute you're using Dream Matte Mousse. Next minute the word \"matte\" feels like a threat." },
  { code: "NW35", day: "Wednesday", season: "", text: "One minute you're powdering away every hint of shine. Next minute you'd sell a kidney for \"dewy\"." },
  { code: "NW36", day: "Wednesday", season: "", text: "One minute you're trying to look older to get served. Next minute nobody asks for ID and frankly it's getting personal." },
  { code: "NW37", day: "Wednesday", season: "", text: "One minute you're borrowing your mum's Oil of Olay. Next minute you're the mum with the expensive skincare." },
  { code: "NW38", day: "Wednesday", season: "", text: "One minute skincare is soap. Next minute you're discussing peptides over lunch." },
  { code: "NW39", day: "Wednesday", season: "", text: "One minute you're scrubbing your face with apricot kernels. Next minute you're worried a flannel might compromise your barrier." },
  { code: "NW40", day: "Wednesday", season: "", text: "One minute you're putting toothpaste on spots. Next minute you've got a dermatologist on speed dial." },
  { code: "NW41", day: "Wednesday", season: "", text: "One minute you're watching Friends because they're grown-ups. Next minute you realise you're older than all of them." },
  { code: "NW42", day: "Wednesday", season: "", text: "One minute you're watching Sex and the City thinking 35 is ancient. Next minute 35 looks practically prenatal." },
  { code: "NW43", day: "Wednesday", season: "", text: "One minute you're watching Bridget Jones panic about turning 30. Next minute you want to shake her." },
  { code: "NW44", day: "Wednesday", season: "", text: "One minute you're watching Absolutely Fabulous. Next minute you're identifying with Edina." },
  { code: "NW45", day: "Wednesday", season: "", text: "One minute you're recording the Top 40 onto cassette. Next minute the supermarket music is all your songs." },
  { code: "NW46", day: "Wednesday", season: "", text: "One minute your parents hate your music. Next minute Led Zeppelin is playing in Marks & Spencer." },
  { code: "NW47", day: "Wednesday", season: "", text: "One minute you're making a mixtape for someone you fancy. Next minute you've got separate playlists for cleaning." },
  { code: "NW48", day: "Wednesday", season: "", text: "One minute you're ringing a landline hoping their dad doesn't answer. Next minute you're ignoring 14 WhatsApps." },
  { code: "NW49", day: "Wednesday", season: "", text: "One minute you're waiting three days for holiday photographs. Next minute you're deleting 47 selfies because your neck looked weird." },
  { code: "NW50", day: "Wednesday", season: "", text: "One minute you've got 24 photographs of your entire holiday. Next minute you've taken 24 photographs before breakfast." },
  { code: "NW51", day: "Wednesday", season: "", text: "One minute the camera flash makes everyone look terrible and nobody cares. Next minute FaceTune has created an international incident." },
  { code: "NW52", day: "Wednesday", season: "", text: "One minute you have a jawline without knowing you have a jawline. Next minute you're looking for it in old photographs." },
  { code: "NW53", day: "Wednesday", season: "", text: "One minute your neck is simply where your head lives. Next minute it has become a separate department." },
  { code: "NW54", day: "Wednesday", season: "", text: "One minute you sleep funny and carry on. Next minute the pillow crease stays until lunch." },
  { code: "NW55", day: "Wednesday", season: "", text: "One minute a hangover lasts until noon. Next minute you've written off Thursday through Sunday." },
  { code: "NW56", day: "Wednesday", season: "", text: "One minute you're drinking Hooch because it's basically lemonade. Next minute half a glass of Sauvignon ruins your sleep score." },
  { code: "NW57", day: "Wednesday", season: "", text: "One minute you're drinking Reef through a straw. Next minute you're talking about cortisol." },
  { code: "NW58", day: "Wednesday", season: "", text: "One minute you're ordering a Snakebite. Next minute you're ordering sparkling water because you've \"got an early start\"." },
  { code: "NW59", day: "Wednesday", season: "", text: "One minute you're eating cheesy chips at 2am. Next minute a tomato after 8pm feels reckless." },
  { code: "NW60", day: "Wednesday", season: "", text: "One minute you're eating cereal for dinner. Next minute you're tracking fibre." },
  { code: "NW61", day: "Wednesday", season: "", text: "One minute your knees are just knees. Next minute they're providing weather forecasts." },
  { code: "NW62", day: "Wednesday", season: "", text: "One minute you're sleeping on someone's floor after a night out. Next minute a hotel without Egyptian cotton feels hostile." },
  { code: "NW63", day: "Wednesday", season: "", text: "One minute you're sharing a Travelodge room with six mates. Next minute you need a suite because your husband breathes." },
  { code: "NW64", day: "Wednesday", season: "", text: "One minute you're sleeping anywhere. Next minute the wrong pillow can destroy NATO." },
  { code: "NW65", day: "Wednesday", season: "", text: "One minute you're dancing in six-inch heels. Next minute you're assessing restaurants based on chair quality." },
  { code: "NW66", day: "Wednesday", season: "", text: "One minute your shoes are designed exclusively to hurt you. Next minute you're delighted Skechers exist." },
  { code: "NW67", day: "Wednesday", season: "", text: "One minute you're freezing outside a club in a tiny top. Next minute you're taking a cardigan in July \"just in case\"." },
  { code: "NW68", day: "Wednesday", season: "", text: "One minute you're refusing to wear a coat because it'll ruin the outfit. Next minute the coat IS the outfit." },
  { code: "NW69", day: "Wednesday", season: "", text: "One minute you're spending your wages in Topshop. Next minute you're genuinely excited about storage solutions." },
  { code: "NW70", day: "Wednesday", season: "", text: "One minute you're buying a going-out top every Saturday. Next minute you've found trousers with an elasticated waist and told six women." },
  { code: "NW71", day: "Wednesday", season: "", text: "One minute you're wearing low-rise jeans. Next minute you'd like to know who authorised them." },
  { code: "NW72", day: "Wednesday", season: "", text: "One minute your thong is six inches above your jeans. Next minute high-waisted underwear feels like civilisation." },
  { code: "NW73", day: "Wednesday", season: "", text: "One minute your biggest concern is whether he'll ring. Next minute it's whether your fixed-rate mortgage expires this year." },
  { code: "NW74", day: "Wednesday", season: "", text: "One minute £20 lasts all weekend. Next minute £20 apparently buys three things in Tesco." },
  { code: "NW75", day: "Wednesday", season: "", text: "One minute you're skint because you've been clubbing. Next minute you're skint because you've been to the garden centre." },
  { code: "NW76", day: "Wednesday", season: "", text: "One minute IKEA feels like adulthood. Next minute you're furious someone has moved the Billy bookcases." },
  { code: "NW77", day: "Wednesday", season: "", text: "One minute you're saying \"I'll never be like my mother.\" Next minute you're saving gift bags." },
  { code: "NW78", day: "Wednesday", season: "", text: "One minute you're mocking your dad for falling asleep watching television. Next minute it's 8:37pm and you've missed the ending." },
  { code: "NW79", day: "Wednesday", season: "", text: "One minute you're rolling your eyes because Mum brought a cardigan. Next minute you've brought two." },
  { code: "NW80", day: "Wednesday", season: "", text: "One minute you're swapping fake IDs. Next minute you're swapping optician recommendations." },
  { code: "NW81", day: "Wednesday", season: "", text: "One minute your group chat is arranging Ibiza. Next minute someone has found an excellent magnesium spray." },
  { code: "NW82", day: "Wednesday", season: "", text: "One minute you're discussing who's fit. Next minute you're discussing whose husband snores." },
  { code: "NW83", day: "Wednesday", season: "", text: "One minute you're sneaking out of your parents' house. Next minute you're waiting up for your own children." },
  { code: "NW84", day: "Wednesday", season: "", text: "One minute you're the chaos. Next minute you're telling everyone else to be careful." },
  { code: "NW85", day: "Wednesday", season: "", text: "One minute you ARE the irresponsible friend. Next minute you've got plasters, paracetamol and tissues in your handbag." },
  { code: "NW86", day: "Wednesday", season: "", text: "One minute adulthood seems miles away. Next minute you're somebody's emergency contact." },
  { code: "NW87", day: "Wednesday", season: "", text: "One minute ageing is something that happens to other women. Next minute you're holding your phone six inches further away." },
  { code: "NW88", day: "Wednesday", season: "", text: "One minute you're terrified of getting older. Next minute you realise you quite like the woman who turned up." },
  { code: "NW89", day: "Wednesday", season: "", text: "One minute you're trying desperately to fit in. Next minute you genuinely couldn't give a toss." },
  { code: "NW90", day: "Wednesday", season: "", text: "One minute you're at Gatecrasher thinking the night will never end. Next minute you're 50 wondering how the bloody hell it went so quickly." },
  { code: "NW91", day: "Wednesday", season: "", text: "One minute you're hiding purchases from your mum. Next minute you're hiding purchases from your husband. Growth." },
  { code: "NW92", day: "Wednesday", season: "", text: "One minute you're dancing on a speaker. Next minute you need both hands to get off the floor." },
  { code: "NW93", day: "Wednesday", season: "", text: "One minute you're getting home as your dad leaves for work. Next minute 9:30pm feels unnecessarily late." },
  { code: "NW94", day: "Wednesday", season: "", text: "One minute you're trying to get served underage. Next minute you'd like somebody, anybody, to ask for ID." },
  { code: "NW95", day: "Wednesday", season: "", text: "One minute you're 25 thinking 50 is ancient. Next minute you're 50 thinking 25-year-olds look about twelve." },
  { code: "NW96", day: "Wednesday", season: "", text: "One minute you're wearing a belt as a skirt. Next minute you bend over and make a noise." },
  { code: "NW97", day: "Wednesday", season: "", text: "One minute you're drinking warm vodka from a plastic cup. Next minute the restaurant's wine list \"isn't great\"." },
  { code: "NW98", day: "Wednesday", season: "", text: "One minute you're snogging someone called Daz behind Yates's. Next minute you're discussing your pension forecast." },
  { code: "NW99", day: "Wednesday", season: "", text: "GEN X ALERT: If you owned Heather Shimmer, report immediately for SPF." },
  { code: "NW100", day: "Wednesday", season: "", text: "GEN X ALERT: Sun-In survivors may be entitled to compensation." },
  { code: "NW101", day: "Wednesday", season: "", text: "GEN X ALERT: Apricot scrub victims, you're among friends here." },
  { code: "NW102", day: "Wednesday", season: "", text: "GEN X ALERT: We used baby oil in direct sunlight. We have no right to be shocked." },
  { code: "NW103", day: "Wednesday", season: "", text: "GEN X ALERT: We survived crimpers. We can survive crow's feet." },
  { code: "NW104", day: "Wednesday", season: "", text: "GEN X ALERT: If you remember Dream Matte Mousse, sit down carefully." },
  { code: "NW105", day: "Wednesday", season: "", text: "GEN X ALERT: We spent 1998 removing every eyebrow hair and now pay to put them back." },
  { code: "NW106", day: "Wednesday", season: "", text: "GEN X ALERT: We once considered SPF 8 responsible behaviour." },
  { code: "NW107", day: "Wednesday", season: "", text: "GEN X ALERT: We put lemon juice in our hair deliberately." },
  { code: "NW108", day: "Wednesday", season: "", text: "GEN X ALERT: Remember foil reflectors? Your dermatologist does." },
  { code: "NW109", day: "Wednesday", season: "", text: "GEN X ALERT: If you owned a Body Shop White Musk gift set, book an eye test." },
  { code: "NW110", day: "Wednesday", season: "", text: "GEN X ALERT: We survived blue mascara. Ageing cannot frighten us." },
  { code: "NW111", day: "Wednesday", season: "", text: "We survived Body Shop Dewberry. We'll survive crow's feet." },
  { code: "NW112", day: "Wednesday", season: "", text: "Our mothers had Oil of Olay. We have a direct debit." },
  { code: "NW113", day: "Wednesday", season: "", text: "Imagine surviving the 90s only to be bullied by your own neck." },
  { code: "NW114", day: "Wednesday", season: "Christmas", text: "Dear Santa, I would like a day with no school run and a decent night's sleep." },
  { code: "NW115", day: "Wednesday", season: "Christmas", text: "Mince pies are fine. Your skin will survive. I promise." },
  { code: "NW116", day: "Wednesday", season: "", text: "GEN X ALERT: Your eyebrows may never recover." },
  { code: "NF1", day: "Friday", season: "", text: "Things in my handbag that have no business being there: three receipts, a hair tie and a mystery sweet. Show me yours." },
  { code: "NF2", day: "Friday", season: "", text: "Things you can say to me that will never shock me. Go on, try." },
  { code: "NF3", day: "Friday", season: "", text: "Things my future self will thank me for: water, a quiet Sunday and fewer 'quick' favours. What is on your list?" },
  { code: "NF4", day: "Friday", season: "", text: "Things that only make sense at 40: loving a sensible bedtime and a really good lamp." },
  { code: "NF5", day: "Friday", season: "", text: "Things I will definitely start on Monday. Comment your top three and we will fail together." },
  { code: "NF6", day: "Friday", season: "", text: "Things every woman should be allowed to say without a lecture: 'I would rather just stay in tonight.'" },
  { code: "NF7", day: "Friday", season: "", text: "Things in my skincare drawer that I bought on a whim and am too polite to throw away." },
  { code: "NF8", day: "Friday", season: "", text: "Things that deserve a round of applause: remembering a password first time, a parking space outside the shop and you." },
  { code: "NF9", day: "Friday", season: "", text: "Things I would tell my younger self about confidence, sunscreen and group chats." },
  { code: "NF10", day: "Friday", season: "", text: "Things I used to worry about that now make me laugh. What would you add?" },
  { code: "NF11", day: "Friday", season: "", text: "Things on the 2am agenda: the school form, that cringe from 2009 and whether the iron is off." },
  { code: "NF12", day: "Friday", season: "", text: "Things you are allowed to do without asking anyone: say no, wear the comfy shoes and book the thing for you." },
  { code: "NF13", day: "Friday", season: "Christmas", text: "Things on my Christmas list: a hot cup of tea, a sit down and nobody asking where the Sellotape is." },
  { code: "NF14", day: "Friday", season: "Christmas", text: "Things nobody warned you about at Christmas: you are also the person who knows where the Sellotape lives." },
  { code: "NF15", day: "Friday", season: "", text: "Things I've nodded politely at during consultations" },
  { code: "NF16", day: "Friday", season: "", text: "Things I've heard immediately before saying \"absolutely not\"" },
  { code: "NF17", day: "Friday", season: "", text: "Things that should never follow the words \"I saw this on TikTok\"" },
  { code: "NF18", day: "Friday", season: "", text: "Things I've pretended not to hear while wearing gloves" },
  { code: "NF19", day: "Friday", season: "", text: "Things women apologise for in my clinic" },
  { code: "NF20", day: "Friday", season: "", text: "Things women whisper during consultations" },
  { code: "NF21", day: "Friday", season: "", text: "Things patients think but don't say" },
  { code: "NF22", day: "Friday", season: "", text: "Things practitioners think but definitely shouldn't say" },
  { code: "NF23", day: "Friday", season: "", text: "Things I will never promise you" },
  { code: "NF24", day: "Friday", season: "", text: "Things you should NEVER hear in a consultation" },
  { code: "NF25", day: "Friday", season: "", text: "Things I can tell before you even sit down" },
  { code: "NF26", day: "Friday", season: "", text: "Things nobody warns you about turning 40" },
  { code: "NF27", day: "Friday", season: "", text: "Things nobody warns you about turning 50" },
  { code: "NF28", day: "Friday", season: "", text: "Things nobody warns you about perimenopause and your face" },
  { code: "NF29", day: "Friday", season: "", text: "Things I believed about ageing at 25" },
  { code: "NF30", day: "Friday", season: "", text: "Things I refuse to feel guilty about as I age" },
  { code: "NF31", day: "Friday", season: "", text: "Things I refuse to start hating about myself at 50" },
  { code: "NF32", day: "Friday", season: "", text: "Things women were told were ugly for absolutely no reason" },
  { code: "NF33", day: "Friday", season: "", text: "Things Gen X women were never taught about skin" },
  { code: "NF34", day: "Friday", season: "", text: "Things we put on our faces in the 90s and somehow survived" },
  { code: "NF35", day: "Friday", season: "", text: "Things our mothers did to their faces that would get TikTok removed" },
  { code: "NF36", day: "Friday", season: "", text: "Things menopause has stolen and frankly needs to return" },
  { code: "NF37", day: "Friday", season: "", text: "Things I wish TikTok would stop teaching women" },
  { code: "NF38", day: "Friday", season: "", text: "Things I would ban if I became aesthetics dictator for 24 hours" },
  { code: "NF39", day: "Friday", season: "", text: "Things I'd tell you if the consultation room had no CCTV" },
  { code: "NF40", day: "Friday", season: "", text: "Things your practitioner discusses in the car afterwards" },
  { code: "NF41", day: "Friday", season: "", text: "Things that make practitioners stare into the middle distance" },
  { code: "NF42", day: "Friday", season: "", text: "Things patients show me on Instagram that make my eye twitch" },
  { code: "NF43", day: "Friday", season: "", text: "Things I could say in clinic but enjoy being employed" },
  { code: "NF44", day: "Friday", season: "", text: "Things I'd rather do than recreate your favourite influencer's face" },
  { code: "NF45", day: "Friday", season: "", text: "Things men secretly ask me about" },
  { code: "NF46", day: "Friday", season: "", text: "Things I judge as a practitioner" },
  { code: "NF47", day: "Friday", season: "", text: "Things I am refusing to turn into a problem: smile lines, looking 48 at 48 and a face that moves." },
  { code: "NF48", day: "Friday", season: "", text: "Things I'd fix before your face: your sleep, your algorithm, your magnifying mirror and your belief that 47 should resemble 27." },
  { code: "NF49", day: "Friday", season: "", text: "Things I could sell you today but won't" },
  { code: "NF50", day: "Friday", season: "", text: "Things that happen after 40: the stairs have opinions, your knees have a voice and your skin has a diary." },
  { code: "NF51", day: "Friday", season: "", text: "Things that belong in 2016" },
  { code: "NF52", day: "Friday", season: "", text: "I have seen things in this clinic that would make a nun blush." },
  { code: "NF53", day: "Friday", season: "", text: "BREAKING: Local woman discovers she has pores. Investigation ongoing." },
  { code: "NF54", day: "Friday", season: "", text: "BREAKING: 47-year-old woman looks 47. Family said to be coping well." },
  { code: "NF55", day: "Friday", season: "", text: "BREAKING: Forehead moves when woman raises eyebrows. Experts baffled." },
  { code: "NF56", day: "Friday", season: "", text: "BREAKING: Gravity continues operating without regulatory approval." },
  { code: "NF57", day: "Friday", season: "", text: "BREAKING: Woman survives seeing herself on accidental front camera." },
  { code: "NF58", day: "Friday", season: "", text: "BREAKING: Local mum hasn't drunk water since Tuesday. Blames collagen." },
  { code: "NF59", day: "Friday", season: "", text: "BREAKING: Woman buys seventh serum. First six unavailable for comment." },
  { code: "NF60", day: "Friday", season: "", text: "BREAKING: Magnifying mirror arrested following disturbance in bathroom." },
  { code: "NF61", day: "Friday", season: "", text: "BREAKING: Instagram filter accused of crimes against normal faces." },
  { code: "NF62", day: "Friday", season: "", text: "BREAKING: Woman smiles. Lines appear. Nation stunned." },
  { code: "NF63", day: "Friday", season: "", text: "BREAKING: Woman spends £247 on skincare. Still requires sleep." },
  { code: "NF64", day: "Friday", season: "", text: "BREAKING: Husband says \"I can't see anything wrong.\" Situation escalates." },
  { code: "NF65", day: "Friday", season: "", text: "BREAKING: Woman turns camera around accidentally. Emergency services notified." },
  { code: "NF66", day: "Friday", season: "", text: "BREAKING: Clinic confirms nobody needs to look 24 forever." },
  { code: "NF67", day: "Friday", season: "", text: "BREAKING: Bathroom lighting charged with malicious wounding." },
  { code: "NF68", day: "Friday", season: "", text: "BREAKING: Woman, 49, bends down without making noise. Scientists demand further testing." },
  { code: "NF69", day: "Friday", season: "", text: "BREAKING: Local woman sleeps eight uninterrupted hours. Neighbours describe her as \"unrecognisable\"." },
  { code: "NF70", day: "Friday", season: "", text: "BREAKING: Woman drinks two glasses of wine and remains functional next morning. Vatican investigating." },
  { code: "NF71", day: "Friday", season: "", text: "BREAKING: 47-year-old opens front camera accidentally. Phone recovered from garden." },
  { code: "NF72", day: "Friday", season: "", text: "BREAKING: Husband says \"you don't need anything doing\". Wife confirms this was not the question." },
  { code: "NF73", day: "Friday", season: "", text: "BREAKING: Woman asks partner if he notices anything different. Search party deployed." },
  { code: "NF74", day: "Friday", season: "", text: "BREAKING: Local woman discovers 10x mirror. Funeral Thursday." },
  { code: "NF75", day: "Friday", season: "", text: "BREAKING: Menopause denies involvement despite overwhelming evidence." },
  { code: "NF76", day: "Friday", season: "", text: "BREAKING: Collagen leaves family home without forwarding address." },
  { code: "NF77", day: "Friday", season: "", text: "BREAKING: 50-year-old wears bikini without asking internet permission. Nation survives." },
  { code: "NF78", day: "Friday", season: "", text: "AESTHETICS COURT: Instagram charged with making normal women think they look strange." },
  { code: "NF79", day: "Friday", season: "", text: "AESTHETICS COURT: Defendant admits requesting \"natural but snatched\"." },
  { code: "NF80", day: "Friday", season: "", text: "AESTHETICS COURT: Prosecution asks why defendant owns 11 serums but drinks no water." },
  { code: "NF81", day: "Friday", season: "", text: "AESTHETICS COURT: Magnifying mirror receives 25 years without parole." },
  { code: "NF82", day: "Friday", season: "", text: "AESTHETICS COURT: Overhead lighting convicted on all counts." },
  { code: "NF83", day: "Friday", season: "", text: "AESTHETICS COURT: Woman accused of diagnosing herself after watching three Reels." },
  { code: "NF84", day: "Friday", season: "", text: "AESTHETICS COURT: Menopause facing 47 separate charges." },
  { code: "NF85", day: "Friday", season: "", text: "AESTHETICS COURT: Gravity refuses to apologise." },
  { code: "NF86", day: "Friday", season: "", text: "AESTHETICS COURT: Ageing found NOT GUILTY. Society ordered to calm down." },
  { code: "NF87", day: "Friday", season: "", text: "AESTHETICS COURT: SPF found innocent on all counts." },
  { code: "NF88", day: "Friday", season: "", text: "AESTHETICS COURT: Defendant claims \"my friend said it was fine.\"" },
  { code: "NF89", day: "Friday", season: "", text: "AESTHETICS COURT: Woman sues menopause for damages." },
  { code: "NF90", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Woman caught examining pores at 14x magnification." },
  { code: "NF91", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Repeat offender slept in make-up." },
  { code: "NF92", day: "Friday", season: "", text: "CLINIC CRIME REPORT: SPF found unopened. Suspect claims \"I work indoors.\"" },
  { code: "NF93", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Suspect purchased skincare because bottle was pretty." },
  { code: "NF94", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Woman used daughter's skincare. Daughter seeking damages." },
  { code: "NF95", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Face wipe discovered beneath pillow." },
  { code: "NF96", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Woman arrived saying \"I've been Googling.\" Practitioner requests backup." },
  { code: "NF97", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Fake tan applied at 11:47pm before 6am flight." },
  { code: "NF98", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Seven active ingredients found fighting in one bathroom cabinet." },
  { code: "NF99", day: "Friday", season: "", text: "CLINIC CRIME REPORT: Ring light charged with creating unrealistic expectations." },
  { code: "NF100", day: "Friday", season: "", text: "CLINIC CRIME REPORT: SPF abandoned during 28-degree heatwave." },
  { code: "NF101", day: "Friday", season: "", text: "Search history of a 47-year-old woman: \"Best serum for neck.\" \"Is 9pm too early for bed?\" \"Hotels Ibiza quiet.\" \"Where did my eyebrows go?\"" },
  { code: "NF102", day: "Friday", season: "", text: "Google searches we will never admit to: \"Why does my face look old only in car mirrors?\" \"Can menopause move your eyebrows?\" \"Can you divorce gravity?\"" },
  { code: "NF103", day: "Friday", season: "", text: "Patient: \"I want natural.\" Translation: \"If Brenda from accounts notices, somebody has overdone it.\"" },
  { code: "NF104", day: "Friday", season: "", text: "Patient: \"I just want a consultation.\" Meaning: \"I've researched this for eleven months and already know your dog's name.\"" },
  { code: "NF105", day: "Friday", season: "", text: "Your 25-year-old self reviews you: \"Wait. We own a business? We stopped caring what men think? And we can afford good skincare?\"" },
  { code: "NF106", day: "Friday", season: "", text: "Voicemail from your future self: \"Hi. It's you at 62. Wear the bloody SPF. Also, dump Gary.\"" },
  { code: "NF107", day: "Friday", season: "", text: "My face's out of office: \"Jawline unavailable until further notice. For urgent enquiries contact cheekbones.\"" },
  { code: "NF108", day: "Friday", season: "", text: "Midlife patch notes: \"Woman 4.9 update installed: confidence upgraded, patience removed, ability to detect nonsense increased 84%.\"" },
  { code: "NF109", day: "Friday", season: "", text: "Face MOT: \"Jawline: advisory. Skin: passed. Lips: no work required. Magnifying mirror: immediate failure.\"" },
  { code: "NF110", day: "Friday", season: "", text: "Ofsted for your skincare: \"Retinol: Outstanding. SPF attendance: Requires Improvement. Face wipes: Special Measures.\"" },
  { code: "NF111", day: "Friday", season: "", text: "Official statement: a woman may simultaneously love herself and fancy having something done." },
  { code: "NF112", day: "Friday", season: "", text: "Official guidance: looking tired is not compulsory." },
  { code: "NF113", day: "Friday", season: "", text: "Policy update: women over 40 no longer required to explain why they want treatment." },
  { code: "NF114", day: "Friday", season: "", text: "BREAKING: Parliament votes overwhelmingly to abolish magnifying mirrors." },
  { code: "NF115", day: "Friday", season: "", text: "OBITUARY: COLLAGEN. Beloved collagen left us gradually sometime after our 30th birthday. No flowers. SPF donations welcome." },
  { code: "NF116", day: "Friday", season: "", text: "RIGHTMOVE LISTING: YOUR FACE. Charming period property. Some natural settling. Excellent bone structure. Previous owner has made questionable decisions." },
  { code: "NF117", day: "Friday", season: "", text: "TRIPADVISOR REVIEW FROM YOUR SKIN: 1 star. \"Owner dehydrated me, took me to Ibiza and expected miracles from a £6 serum.\"" },
  { code: "NF118", day: "Friday", season: "", text: "TINDER PROFILE: YOUR JAWLINE. Recently single. Looking for definition. No time wasters." },
  { code: "NF119", day: "Friday", season: "", text: "RANSOM NOTE FROM MENOPAUSE: WE HAVE YOUR OESTROGEN. DO NOT CONTACT THE AUTHORITIES." },
  { code: "NF120", day: "Friday", season: "", text: "BBC BREAKING NEWS: Woman, 48, discovers nobody actually expects her to look 28." },
  { code: "NF121", day: "Friday", season: "", text: "THE COLLAGEN WEATHER FORECAST: High pressure across the forehead with significant dehydration moving in overnight." },
  { code: "NF122", day: "Friday", season: "", text: "THE AESTHETICS SHIPPING FORECAST: Wrinkles moderate. Cheeks fair. Jawline visibility poor." },
  { code: "NF123", day: "Friday", season: "", text: "MISSING PERSON: Last seen 1998. Answers to the name My Metabolism." },
  { code: "NF124", day: "Friday", season: "", text: "DEAR DEIRDRE: \"My face and I have grown apart.\"" },
  { code: "NF125", day: "Friday", season: "", text: "A MESSAGE FROM YOUR NECK: \"We need to talk.\"" },
  { code: "NF126", day: "Friday", season: "", text: "HMRC INVESTIGATION: We are investigating where approximately 40% of your collagen has gone." },
  { code: "NF127", day: "Friday", season: "", text: "JOB VACANCY: Wanted, collagen. Previous experience preferred. Must be prepared to work past 40." },
  { code: "NF128", day: "Friday", season: "", text: "LINKEDIN ANNOUNCEMENT: Delighted to announce my pores have accepted a new position as Managing Director of My Entire Face." },
  { code: "NF129", day: "Friday", season: "", text: "ESTATE AGENT OPEN HOUSE: Original features. Mature character. Absolutely no intention of being converted into a new build." },
  { code: "NF130", day: "Friday", season: "", text: "THE MENOPAUSE TIMES, today's headline: Woman enters room. Reason remains unknown." },
  { code: "NF131", day: "Friday", season: "", text: "CLINIC HR INCIDENT #047: Employee repeatedly described herself as \"past it\". Formal warning issued." },
  { code: "NF132", day: "Friday", season: "", text: "DRAGONS' DEN: YOUR SKINCARE ROUTINE. \"So you want £200 for another serum despite having seven unopened at home?\"" },
  { code: "NF133", day: "Friday", season: "", text: "CRIMEWATCH: Police would like to speak to this woman regarding an incident involving baby oil and the summer of 1996." },
  { code: "NF134", day: "Friday", season: "", text: "A LETTER FROM 25-YEAR-OLD YOU: \"Why are you spending £40 on SPF?\" Sit down, sweetheart." },
  { code: "NF135", day: "Friday", season: "", text: "THE GREAT BRITISH FACE OFF, technical challenge: survive December central heating without becoming a Ryvita." },
  { code: "NF136", day: "Friday", season: "", text: "UNSOLVED MYSTERIES: Who keeps buying skincare and then refusing to use it consistently?" },
  { code: "NF137", day: "Friday", season: "", text: "AESTHETIC COURT. Charge: zooming into a perfectly normal photograph until finding something to hate." },
  { code: "NF138", day: "Friday", season: "", text: "BREAKING: MIRROR ARRESTED. Charged with causing unnecessary distress under fluorescent bathroom lighting." },
  { code: "NF139", day: "Friday", season: "", text: "FACEBOOK MARKETPLACE: FOR SALE, magnifying mirror. £0. Ruined enough lives." },
  { code: "NF140", day: "Friday", season: "", text: "THE GUARDIAN OF AGEING, opinion: perhaps women over 50 don't actually owe society youth." },
  { code: "NF141", day: "Friday", season: "", text: "THE SUN EXCLUSIVE: MY SHOCK FACE AT 47. Woman discovers she has a 47-year-old face." },
  { code: "NF142", day: "Friday", season: "", text: "NETFLIX TRUE CRIME: The Serum Swindler. She promised overnight results. The nation believed her." },
  { code: "NF143", day: "Friday", season: "", text: "COME DINE WITH ME, SKINCARE EDITION: \"You've served retinol with absolutely no SPF. I'm giving you a three.\"" },
  { code: "NF144", day: "Friday", season: "", text: "THE TRAITORS, BATHROOM CABINET EDITION: One of these products is doing absolutely nothing." },
  { code: "NF145", day: "Friday", season: "", text: "BLIND DATE, AESTHETICS EDITION: Contestant number one promises to make you look 20 years younger. Immediate red flag." },
  { code: "NF146", day: "Friday", season: "", text: "GEN X SURVIVAL CERTIFICATE: This certifies that __________ survived Sun-In, Rimmel Heather Shimmer and tanning without SPF." },
  { code: "NF147", day: "Friday", season: "", text: "PUBLIC INFORMATION FILM: Women over 40 are reminded they are legally permitted to fancy themselves." },
  { code: "NF148", day: "Friday", season: "", text: "EMERGENCY ALERT: Your front camera has opened unexpectedly. Remain calm." },
  { code: "NF149", day: "Friday", season: "", text: "ROYAL PROCLAMATION: Henceforth, all women shall stop referring to perfectly normal skin texture as \"awful\"." },
  { code: "NF150", day: "Friday", season: "", text: "THE FACE OLYMPICS, event one: looking into the car mirror without criticising yourself." },
  { code: "NF151", day: "Friday", season: "", text: "POINTS OF VIEW: \"Dear BBC, I recently saw a 52-year-old woman on television who appeared to be 52. Please explain.\"" },
  { code: "NF152", day: "Friday", season: "", text: "WATCHDOG INVESTIGATES: £97 miracle cream fails to reverse 27 years of ageing. Nation stunned." },
  { code: "NF153", day: "Friday", season: "", text: "AUTOTRADER, FACE EDITION: 1978 model. Excellent runner. Some cosmetic wear. One careful owner. Absolutely not available for trade-in." },
  { code: "NF154", day: "Friday", season: "", text: "REJECTION LETTER FROM YOUR CLINIC: \"Dear Applicant, thank you for applying to become 25 again. Unfortunately...\"" },
  { code: "NF155", day: "Friday", season: "", text: "OUT OF OFFICE, OESTROGEN: \"I am currently unavailable and will respond whenever I bloody well feel like it.\"" },
  { code: "NF156", day: "Friday", season: "", text: "GOOGLE REVIEW FROM YOUR FOREHEAD: \"Owner keeps blaming me for expressing emotions. Toxic workplace.\"" },
  { code: "NF157", day: "Friday", season: "", text: "THE SKINCARE CONFESSIONAL: \"Forgive me, practitioner, for I have sinned. It has been 11 days since I cleansed properly.\"" },
  { code: "NF158", day: "Friday", season: "", text: "CLINIC UNPOPULAR OPINIONS DEPARTMENT: Not every line needs treating." },
  { code: "NF159", day: "Friday", season: "", text: "POV: YOUR FACE HIRES A SOLICITOR. \"My client strongly denies allegations that she has 'let herself go'.\"" },
  { code: "NF160", day: "Friday", season: "", text: "THE 10 O'CLOCK NEWS, our top story tonight: woman has treatment and continues looking exactly like herself." },
  { code: "NF161", day: "Friday", season: "", text: "NATIONAL EMERGENCY TEST: This is a test of the UK Front Camera Warning System. Do not look down." },
  { code: "NF162", day: "Friday", season: "", text: "REWARD OF £10,000 for information leading to the discovery of the woman who actually drinks two litres of water every day." },
  { code: "NF163", day: "Friday", season: "", text: "A MESSAGE FROM THE MINISTRY OF AGEING DISGRACEFULLY: Growing older is compulsory. Becoming beige is not." },
  { code: "NF164", day: "Friday", season: "", text: "BREAKING NEWS FROM THE CLINIC CAR PARK: Patient has spent 14 minutes taking selfies because the treatment-room lighting is better than her house." },
  { code: "NS1", day: "Sunday", season: "", text: "To the woman who has said 'I'm fine' forty times today: send me one word for how you really are." },
  { code: "NS2", day: "Sunday", season: "", text: "To the woman who made everyone a cuppa and forgot her own: go and put the kettle on. Tag a friend who needs the same nudge." },
  { code: "NS3", day: "Sunday", season: "", text: "To the woman who cried at an advert this week: me too. Which one got you?" },
  { code: "NS4", day: "Sunday", season: "", text: "To the woman who is doing her best and thinks it is never enough: it is. Tag someone who needs to hear that today." },
  { code: "NS5", day: "Sunday", season: "", text: "To the woman holding the whole family's diary in her head: tell me one thing that is just yours." },
  { code: "NS6", day: "Sunday", season: "", text: "To the woman who compliments everyone else and rolls her eyes at the mirror: say one kind thing to her today." },
  { code: "NS7", day: "Sunday", season: "", text: "To the woman who keeps going when nobody is clapping: I am clapping. Tell me what you are proud of this week." },
  { code: "NS8", day: "Sunday", season: "", text: "To the woman reading this in the car, the loo or the pantry: I see you. Drop a heart." },
  { code: "NS9", day: "Sunday", season: "", text: "To the woman saving the good candle for a special occasion: today counts. Light it. Which scent?" },
  { code: "NS10", day: "Sunday", season: "", text: "To the woman who feels a bit behind: you are right on time. Tag the friend who makes you feel that way." },
  { code: "NS11", day: "Sunday", season: "", text: "To the woman who needs a hug and a biscuit, in that order: here are both. What is your biscuit?" },
  { code: "NS12", day: "Sunday", season: "", text: "To the woman who has held it together all week: it is Sunday. Hang the cape on the chair and have a sit." },
  { code: "NS13", day: "Sunday", season: "Christmas", text: "To the woman who runs Christmas like a small airport: who is making you a cuppa this year? Tag them." },
  { code: "NS14", day: "Sunday", season: "Christmas", text: "To the woman who buys, wraps and hides every present: you deserve one with your name on it." },
  { code: "NA1", day: "Any day", season: "", text: "Quick poll: how many tabs do you have open right now? Be honest. I will wait." },
  { code: "NA2", day: "Any day", season: "", text: "Pick one for life: no more queues or no more alarm clocks." },
  { code: "NA3", day: "Any day", season: "", text: "Finish this sentence: 'I am at my happiest when...'" },
  { code: "NA4", day: "Any day", season: "", text: "POV: you said 'I will just pop in for one thing' and left with a basket, a candle and a plan." },
  { code: "NA5", day: "Any day", season: "", text: "Which are you: the full routine, one cleanser or whatever is in the hotel bathroom? No judgement, lots of curiosity." },
  { code: "NA6", day: "Any day", season: "", text: "Me: 'I am having an early night.' Also me at 11.47pm: watching a video about lighthouses. What is your late night rabbit hole?" },
  { code: "NA7", day: "Any day", season: "", text: "What is the one thing in your house that is definitely broken and you refuse to replace? Tell me everything." },
  { code: "NA8", day: "Any day", season: "", text: "Name a compliment you still remember from years ago. It lives rent free, doesn't it?" },
  { code: "NA9", day: "Any day", season: "", text: "Hands up if you have bought a lovely notebook and never written in it." },
  { code: "NA10", day: "Any day", season: "", text: "Rate your week out of ten, then rate your tea. I suspect the tea wins." },
  { code: "NA11", day: "Any day", season: "", text: "Tell me one small thing that made you smile today. I collect them." },
  { code: "NA12", day: "Any day", season: "", text: "Which is harder: finding the end of the Sellotape or finding the telly remote?" },
  { code: "NA13", day: "Any day", season: "", text: "What is the thing you do for yourself that nobody knows about? Tell me. I won't tell." },
  { code: "NA14", day: "Any day", season: "", text: "If your week was a biscuit, which biscuit would it be?" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PACK_DAYS = 28;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// The next twelve Mondays, starting with today if it is a Monday. Each is the start of a four week pack.
export function packStarts(today: Date = new Date(), count = 12): Date[] {
  const t = startOfDay(today);
  const sinceMonday = (t.getDay() + 6) % 7;
  const first = addDays(t, sinceMonday === 0 ? 0 : 7 - sinceMonday);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

export type HookTiming = { ok: boolean; from?: Date; to?: Date };

// Whether a hook can be posted in a four week pack starting on packStart, and the dates it should go out between.
export function hookTiming(h: Hook, packStart: Date, packDays = PACK_DAYS): HookTiming {
  if (!h.season) return { ok: true };
  const w = SEASON_WINDOWS[h.season];
  const packEnd = addDays(packStart, packDays - 1);
  for (const y of [packStart.getFullYear() - 1, packStart.getFullYear(), packStart.getFullYear() + 1]) {
    const from = new Date(y, w.from[0] - 1, w.from[1]);
    const to = new Date(y, w.to[0] - 1, w.to[1]);
    const a = from > packStart ? from : packStart;
    const b = to < packEnd ? to : packEnd;
    if (a <= b) return { ok: true, from: a, to: b };
  }
  return { ok: false };
}

export function seasonRange(season: Exclude<HookSeason, "">): string {
  const w = SEASON_WINDOWS[season];
  return `${w.from[1]} ${MONTHS[w.from[0] - 1]} to ${w.to[1]} ${MONTHS[w.to[0] - 1]}`;
}

// Drops the treatment name into a hook's [treatment] slot.
export function fillTreatment(text: string, treatment: string): string {
  const t = treatment.trim();
  if (!t) return text;
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return text.replace(/\[Treatment\]/g, cap).replace(/\[treatment\]/g, t);
}

export type RequestHook = { row: number; code: string; text: string; season: HookSeason };

// Turns the picked hook codes into the row each one fills, with the treatment slot filled in.
// Hooks go to the rows of their kind in the order they were picked.
export function hooksForRequest(picked: string[], treatments: string[]): RequestHook[] {
  const out: RequestHook[] = [];
  for (const d of HOOK_DAYS) {
    const chosen = picked.map(code => HOOKS.find(h => h.code === code)).filter((h): h is Hook => !!h && h.day === d.day).slice(0, d.rows.length);
    chosen.forEach((h, k) => {
      const text = d.day === "Monday" ? fillTreatment(h.text, treatments[TREATMENT_FOR_SLOT[k]] ?? "") : h.text;
      out.push({ row: d.rows[k], code: h.code, text, season: h.season });
    });
  }
  return out.sort((a, b) => a.row - b.row);
}

export type PickedHookPayload = { text: string; season: string; kind: "treatment" | "other" };

// The hooks a writing tool sends to the server, in the order picked, with the treatment slot filled in.
// "treatment" hooks are the Monday ones, the others can go on any post.
export function pickedHookPayload(picked: string[], treatment: string | string[] = ""): PickedHookPayload[] {
  const out: PickedHookPayload[] = [];
  const list = (Array.isArray(treatment) ? treatment : [treatment]).map(t => t.trim()).filter(Boolean);
  let n = 0;
  for (const code of picked) {
    const h = HOOKS.find(x => x.code === code);
    if (!h) continue;
    const kind = h.day === "Monday" || /\[treatment\]/i.test(h.text) ? "treatment" : "other";
    out.push({ text: kind === "treatment" ? fillTreatment(h.text, list.length ? list[n++ % list.length] : "") : h.text, season: h.season ?? "", kind });
  }
  return out;
}
