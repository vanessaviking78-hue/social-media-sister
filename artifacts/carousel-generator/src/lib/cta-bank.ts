// The friendly closing lines for treatment posts, for the Shuffle button. The same bank lives on the server (api-server/src/lib/hookBank.ts),
// where TREATMENT_CTA_BANK_LIVE decides whether new posts pick from it automatically. Keep the two lists the same.
export const TREATMENT_CTA_BANK = [
  "Comment {WORD} and I will pop you a message with everything you need to know",
  "If you are in {AREA} and want to see a caring practitioner, come and say hello in my DMs",
  "Comment {WORD} below and I will tell you honestly whether it could suit you",
  "Thinking about it? Drop {WORD} in the comments and we will have a proper chat",
  "Curious but not sure where to start? Comment {WORD} and I will talk you through it",
  "Near {AREA} and fancy a friendly, no judgement chat? Message me and we will find a time",
  "Pop {WORD} in the comments and I will send you the details, nice and simple",
  "Based in {AREA}? I would love to meet you. Send me a message and we will take it from there",
  "Got a question you are too shy to ask? Comment {WORD} and ask me anything",
  "Comment {WORD} if you would like a gentle, honest chat about whether this is for you",
  "Wondering if you would be a good fit? Message me and I will tell you straight",
  "Looking for a kind, careful practitioner in {AREA}? Say hello in my DMs",
  "Comment {WORD} and we will talk it through together, at your pace",
  "If this has been on your mind for a while, message me when you are ready and we will start with a chat",
];

/** Picks a different line from the bank each time it is called for the same current line. */
export function nextBankCta(treatment: string, area: string, current: string): string {
  const word = treatment.replace(/\s+/g, " ").trim().toUpperCase();
  const town = area.split(",")[0].trim();
  const fill = (l: string) => l.replace("{WORD}", word).replace("{AREA}", town);
  const usable = TREATMENT_CTA_BANK.filter((l) => (l.includes("{AREA}") ? !!town : l.includes("{WORD}") ? !!word : true)).map(fill);
  const others = usable.filter((l) => l !== current.trim());
  return others[Math.floor(Math.random() * others.length)] ?? usable[0] ?? current;
}
