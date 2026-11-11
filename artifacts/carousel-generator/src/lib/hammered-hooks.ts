// The Hammered Hook Bank: Vanessa's 30 slide 1 hooks for the construction freebies and tools (11 Nov 2026).
// Kept apart from the clinic Hook Bank (hook-bank.ts) so none of these show up in the clinic tools.
// To add a hook, add a line to HAMMERED_HOOKS. The group says what the hook is for.

export type HammeredHookGroup = "About me" | "Site banter" | "Their marketing" | "What Hammered can do";
export type HammeredHook = { code: string; group: HammeredHookGroup; text: string };

export const HAMMERED_HOOK_GROUPS: { group: HammeredHookGroup; label: string }[] = [
  { group: "About me", label: "The first three posts: who Vanessa is and what she does" },
  { group: "Site banter", label: "Site banter people will send to the work group" },
  { group: "Their marketing", label: "Take the piss out of their marketing" },
  { group: "What Hammered can do", label: "Show what Hammered can do" },
];

export const HAMMERED_HOOKS: HammeredHook[] = [
  // The first three posts: who I am and what I do
  { code: "HA2", group: "About me", text: "Yes, I have actually worked on a building site." },
  { code: "HA1", group: "About me", text: "Hello, I’m Vanessa and I make tradespeople look as good as their work." },
  { code: "HA3", group: "About me", text: "Your work is brilliant. Your Facebook page is still just foundations." },

  // Site banter people will send to the work group
  { code: "HB1", group: "Site banter", text: "Every site has a bloke who says “while we’re here” and costs everyone another Saturday." },
  { code: "HB2", group: "Site banter", text: "Which trade says “I’ll be out of your way in five” with the least respect for the concept of time?" },
  { code: "HB3", group: "Site banter", text: "“Small snagging list.” Lovely. Why’s it got chapters?" },
  { code: "HB4", group: "Site banter", text: "Your apprentice knows how to edit a reel. Unfortunately, it’s a montage of you losing your tape measure." },
  { code: "HB5", group: "Site banter", text: "Every work group has one man who replies “sorted” and leaves the rest of you to investigate." },
  { code: "HB6", group: "Site banter", text: "Nothing unites a site faster than someone saying the skip’s full when it clearly has another three doors in it." },
  { code: "HB7", group: "Site banter", text: "You can tell who’s in charge on site by who gets asked where the kettle is." },
  { code: "HB8", group: "Site banter", text: "Tell me the most expensive sentence on site. I’ll start with “I thought you’d ordered it.”" },
  { code: "HB9", group: "Site banter", text: "Name a more optimistic man than the one who puts “quick job” in the diary for Friday afternoon." },
  { code: "HB10", group: "Site banter", text: "You’re allowed one honest sign on your van. What are we printing?" },

  // Take the piss out of their marketing
  { code: "HM11", group: "Their marketing", text: "You’ve built a £70k extension. Why’s the only photo of it taken through a wet windscreen?" },
  { code: "HM12", group: "Their marketing", text: "Breaking news. Local builder posts a finished job before the customer’s Christmas tree goes up." },
  { code: "HM13", group: "Their marketing", text: "Site Court is now in session. The defendant filmed the entire kitchen with his thumb over the lens." },
  { code: "HM14", group: "Their marketing", text: "Your website says “family-run since 1987”. Your last project photo looks like it was taken at the opening." },
  { code: "HM15", group: "Their marketing", text: "“Inbox for details.” Dave, she’s trying to find a roofer in Leeds. Why have you made it an escape room?" },
  { code: "HM16", group: "Their marketing", text: "Your Instagram bio says “all work undertaken”. Are we talking loft conversions or can you pick my mum up from bingo?" },
  { code: "HM17", group: "Their marketing", text: "Today’s missing persons appeal is for the “after” photo. Last seen on a phone that’s since fallen down a drain." },
  // The original ended its caption line with a thumbs up emoji, dropped here because captions never carry emojis.
  { code: "HM18", group: "Their marketing", text: "Three months on site. Two skips. One structural engineer. Caption reads “Another one done”." },
  { code: "HM19", group: "Their marketing", text: "Your portfolio’s in a WhatsApp chat called “Lads”. How’s a woman in Wakefield supposed to find it?" },
  { code: "HM20", group: "Their marketing", text: "You keep posting “busy week”. The woman with £20k for a new kitchen still has no idea you fit kitchens." },

  // Show what Hammered can do
  { code: "HW21", group: "What Hammered can do", text: "Give me six clips from your last job. I’ll show you the post hiding between the van dashboard and the accidental selfie." },
  { code: "HW22", group: "What Hammered can do", text: "I’d open your next roofing reel with the bit you found under the tiles. Show me why the customer called you." },
  { code: "HW23", group: "What Hammered can do", text: "You want more extensions and fewer calls about hanging a door? Let’s have a look at what you’ve posted this month." },
  { code: "HW24", group: "What Hammered can do", text: "Show me the bit you’ll plaster over tomorrow. That’s the bit I want your next customer to see." },
  { code: "HW25", group: "What Hammered can do", text: "I’d turn your next handover into three posts. Here’s what I’d film before you give the keys back." },
  { code: "HW26", group: "What Hammered can do", text: "Your best sales pitch might be the voice note where you explain why you’ve priced the job that way." },
  { code: "HW27", group: "What Hammered can do", text: "This reel took one walk from the front door to the back wall. Here’s where I’d stop and what I’d say." },
  { code: "HW28", group: "What Hammered can do", text: "If your whole team goes mute when the camera comes out, give me the footage and tell me what happened while you’re making a brew." },
  { code: "HW29", group: "What Hammered can do", text: "Show me the job you’d happily do ten more times. That’s what I’d put at the top of your page." },
  { code: "HW30", group: "What Hammered can do", text: "Send me your trade and your town. I’ll give you a post idea for the kind of job you actually want to quote." },
];
