// The Smashed Socials Hook Bank: slide 1 hooks for the pub and bar posts (12 Nov 2026), copied from the Hammered set up.
// Kept apart from the clinic Hook Bank (hook-bank.ts) and the Hammered hooks so none of these show up in other tools.
// To add a hook, add a line to SMASHED_HOOKS. The group says what the hook is for.

export type SmashedHookGroup = "About me" | "Pub banter" | "Their marketing" | "What Smashed Socials can do";
export type SmashedHook = { code: string; group: SmashedHookGroup; text: string };

export const SMASHED_HOOK_GROUPS: { group: SmashedHookGroup; label: string }[] = [
  { group: "About me", label: "The first three posts: who Vanessa is and what she does" },
  { group: "Pub banter", label: "Pub banter people will send to the group chat" },
  { group: "Their marketing", label: "Gently take the mick out of their marketing" },
  { group: "What Smashed Socials can do", label: "Show what Smashed Socials can do" },
];

export const SMASHED_HOOKS: SmashedHook[] = [
  { code: "SA1", group: "About me", text: "Hello, I’m Vanessa and I make pubs look as good as the pint you pull." },
  { code: "SA2", group: "About me", text: "Yes, I know the pint on your poster was made by a robot. Everybody winces." },
  { code: "SA3", group: "About me", text: "Your pub is brilliant. Your Facebook page is still last year’s Christmas menu." },
  { code: "SB1", group: "Pub banter", text: "Every pub has a regular who says “just the one” and is still there when the lights go up." },
  { code: "SB2", group: "Pub banter", text: "Name a more confident sentence than “the chef will be back in five minutes.”" },
  { code: "SB3", group: "Pub banter", text: "Every quiz night has one team that argues with the answer sheet and takes it personally." },
  { code: "SB4", group: "Pub banter", text: "The specials board says “ask staff”. The staff say “ask the chef”. The chef has gone home." },
  { code: "SB5", group: "Pub banter", text: "Karaoke night has two kinds of people: the ones who say no and the ones on their third song." },
  { code: "SB6", group: "Pub banter", text: "Dominoes Monday is the only sport where a grown man can sulk for forty minutes over a double six." },
  { code: "SB7", group: "Pub banter", text: "Every Sunday roast has someone who orders the beef, eyes the neighbour’s lamb and regrets everything." },
  { code: "SB8", group: "Pub banter", text: "Nothing frightens a landlord like “can you put the other match on?” in the middle of the big match." },
  { code: "SB9", group: "Pub banter", text: "Free curry Thursday has done more for community spirit than any council leaflet." },
  { code: "SB10", group: "Pub banter", text: "The pub dog gets more likes than the pub. Use that." },
  { code: "SM11", group: "Their marketing", text: "Your Sunday roast looks incredible. Why is the only photo of it taken under a strip light?" },
  { code: "SM12", group: "Their marketing", text: "Your poster pint has a glass the wrong shape and a head that defies gravity." },
  { code: "SM13", group: "Their marketing", text: "Your specials board is chalked beautifully. Your Facebook page announced it last Tuesday." },
  { code: "SM14", group: "Their marketing", text: "“Live music Saturday.” Who? Where? What time? Should I bring earplugs or a dancing partner?" },
  { code: "SM15", group: "Their marketing", text: "Your pub has stood in the village since 1820. Your last post is from the bank holiday before last." },
  { code: "SM16", group: "Their marketing", text: "You have a gorgeous beer garden and one photo of it, taken in November, with the bins in shot." },
  { code: "SM17", group: "Their marketing", text: "Posting “see you tonight” with no picture is like opening the door and hiding behind it." },
  { code: "SW18", group: "What Smashed Socials can do", text: "Tell me what’s on each day and I’ll turn it into a week of posts. Dominoes Monday and free curry Thursday welcome." },
  { code: "SW19", group: "What Smashed Socials can do", text: "Send me a photo of your landlady laughing and I’ll show you your best performing post." },
  { code: "SW20", group: "What Smashed Socials can do", text: "I would open your Sunday roast post with the gravy pour. People eat with their eyes." },
  { code: "SW21", group: "What Smashed Socials can do", text: "Your quiz night deserves a post that makes people book a table before they have finished scrolling." },
  { code: "SW22", group: "What Smashed Socials can do", text: "Show me your regulars, with their permission, and I’ll show you why people come back." },
  { code: "SW23", group: "What Smashed Socials can do", text: "I would turn one afternoon in your pub into a month of posts. Here is what I would photograph." },
  { code: "SW24", group: "What Smashed Socials can do", text: "Your new menu deserves better than a screenshot of a Word document." },
  { code: "SW25", group: "What Smashed Socials can do", text: "Christmas party bookings go to the pub that posts first. Here is the post I would put up." },
  { code: "SW26", group: "What Smashed Socials can do", text: "Your team is your best advert. Let me show you how I would introduce them." },
  { code: "SW27", group: "What Smashed Socials can do", text: "Tell me your pub’s name and your town and I will give you a post idea for your next quiet Tuesday." },
];
