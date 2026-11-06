// XMAS: eight weeks of hooks, four a week. Each hook has a colloquial and a professional version, and the page lets her click between them.
export type XmasHook = { id: string; colloquial: string; professional: string };
export type XmasWeek = { week: number; title: string; theme: string; hooks: XmasHook[] };

const h = (id: string, colloquial: string, professional: string): XmasHook => ({ id, colloquial, professional });

export const XMAS_WEEKS: XmasWeek[] = [
  { week: 1, title: "Nostalgic Christmas", theme: "Nostalgia and the Christmases we grew up with.", hooks: [
    h("x1a", "Remember when Christmas decorations came out of a box that hadn't been opened since 1987?", "The Christmas traditions we grew up with still hold a special place in our memories."),
    h("x1b", "If you grew up in the 80s, Christmas was an entirely different affair.", "How our relationship with Christmas, family and self-care changes as we grow older."),
    h("x1c", "Who remembers when getting ready for Christmas meant a new outfit and a fresh perm?", "Personal style evolves with age. Confidence doesn't have an expiry date."),
    h("x1d", "At what age did Christmas become more about everyone else than you?", "The festive season is a wonderful reminder to make space for yourself, too."),
  ] },
  { week: 2, title: "The woman behind Christmas", theme: "Emotional connection, motherhood and putting yourself back on the list.", hooks: [
    h("x2a", "You've bought everyone's presents. Have you remembered yourself?", "The importance of making time for your own wellbeing during the festive season."),
    h("x2b", "Mum deserves more than a box of chocolates and a rushed cup of tea.", "The women who care for everyone else deserve time and attention for themselves."),
    h("x2c", "Who else is running Christmas like a military operation?", "The demands of the festive season can leave little room for personal care."),
    h("x2d", "Your Christmas list has 27 people on it. When did you last put your own name down?", "Self-care is not an indulgence. It is an important part of looking after yourself."),
  ] },
  { week: 3, title: "Local Christmas conversations", theme: "Community, regional identity and local engagement.", hooks: [
    h("x3a", "Right, [TOWN], where are we going for the best Christmas coffee?", "Supporting local businesses is part of what makes our community special."),
    h("x3b", "Only people from [TOWN] will understand this Christmas tradition.", "Every community has its own festive traditions. What makes yours special?"),
    h("x3c", "The great [TOWN] Christmas shopping debate. Where is actually worth visiting?", "Discovering the independent businesses and festive experiences on our doorstep."),
    h("x3d", "If you've lived in [TOWN] for 20 years, you'll remember Christmas when...", "Looking back at how our local community has changed over the years."),
  ] },
  { week: 4, title: "Ageing and confidence", theme: "Gen X, 40+, 50+ and changing perceptions of ageing.", hooks: [
    h("x4a", "Remember when we thought 50 was old? Who was responsible for that nonsense?", "Turning 50 can bring a different perspective on confidence, identity and personal priorities."),
    h("x4b", "We're not getting old. We're becoming increasingly difficult to impress.", "Confidence can grow with age, experience and a stronger understanding of ourselves."),
    h("x4c", "Who decided women should become invisible after 50?", "Women deserve to feel visible, valued and confident at every stage of life."),
    h("x4d", "Your 40s and 50s are not the closing chapters. They're getting interesting.", "Ageing is a natural process, and every stage deserves thoughtful, individualised care."),
  ] },
  { week: 5, title: "Christmas party season", theme: "Skin confidence, preparation and realistic expectations.", hooks: [
    h("x5a", "The Christmas party is approaching. Have you found the outfit yet?", "Preparing for the festive season can include thinking about your personal skin goals."),
    h("x5b", "Your bathroom lighting has some explaining to do.", "Understanding how lighting, environment and skin texture influence what we see in the mirror."),
    h("x5c", "December is not the month to start experimenting with everything you've seen online.", "Why professional advice and appropriate treatment planning matter when considering aesthetic procedures."),
    h("x5d", "You can keep the Christmas sparkle. Leave the unrealistic expectations behind.", "A considered approach to skin health and aesthetic treatments prioritises suitability and realistic expectations."),
  ] },
  { week: 6, title: "The gift of looking after yourself", theme: "Self-worth, self-investment and personal choice.", hooks: [
    h("x6a", "Santa, I've been very good. I'd like some time to myself, please.", "Making time for yourself is a valuable investment in your overall wellbeing."),
    h("x6b", "When did buying yourself something nice become an act of rebellion?", "There is value in recognising your own needs and making space for personal care."),
    h("x6c", "You don't need permission from anyone to look after yourself.", "Personal care decisions should reflect your own preferences, priorities and circumstances."),
    h("x6d", "The best present might be finally making that appointment you've been thinking about.", "A professional consultation can be a useful first step in understanding your options."),
  ] },
  { week: 7, title: "Christmas week", theme: "Warmth, humour, connection and gratitude.", hooks: [
    h("x7a", "To the women holding Christmas together with Sellotape and sheer determination. We salute you.", "This Christmas, we celebrate the women who bring families and communities together."),
    h("x7b", "If nobody eats the sprouts, we are not discussing it. Merry Christmas!", "Wishing our patients and local community a wonderful Christmas filled with happiness and meaningful moments."),
    h("x7c", "Remember, you are allowed to sit down before the washing-up is finished.", "A gentle reminder to make time for rest and the people who matter most."),
    h("x7d", "Your face has survived another year of family photographs. That's commitment.", "Thank you for trusting us with your skincare and aesthetic journeys throughout the year."),
  ] },
  { week: 8, title: "New Year, new priorities", theme: "Reflection, confidence and future planning.", hooks: [
    h("x8a", "New year. Same face. Better boundaries.", "A new year offers an opportunity to reflect on personal priorities and wellbeing."),
    h("x8b", "This year, we're not making promises to become a completely different person.", "Your personal goals should be realistic, considered and entirely your own."),
    h("x8c", "January is for fresh starts, not punishing yourself for enjoying December.", "Begin the year with a balanced approach to skin health and personal wellbeing."),
    h("x8d", "What would you do for yourself this year if you stopped putting it off?", "Consider what matters to you and how a personalised approach to skincare may support your goals."),
  ] },
];
