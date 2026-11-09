// Shared helpers for the Hook Bank, so every writing tool treats a chosen hook the same way.
// The hooks themselves live in the website's lib/hook-bank.ts. The website sends the picked hook text
// (with any [treatment] slot already filled in) and these helpers turn it into prompt rules.

export type PickedHook = { text: string; season: string; kind: "treatment" | "other" };

// Reads the hooks a tool sends as JSON: [{ text, season, kind }]. Anything malformed is dropped.
export function parsePickedHooks(raw: unknown, sanitise: (s: string) => string, max = 20): PickedHook[] {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    const out: PickedHook[] = [];
    for (const h of arr as Record<string, unknown>[]) {
      const text = sanitise(String(h?.text ?? "")).replace(/\s+/g, " ").trim().slice(0, 300);
      if (!text) continue;
      out.push({
        text,
        season: typeof h?.season === "string" ? h.season.slice(0, 20) : "",
        kind: h?.kind === "treatment" ? "treatment" : "other",
      });
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

// The voice for every slide that follows a chosen hook, the same one the Client Stylish pack uses.
export function followOnVoice(opts: { dental?: boolean; ryder?: boolean } = {}): string {
  return `Write the slides after the hook so they carry on from it like a friend chatting with one woman who has followed along for years: warm, professional with personality and a dry wit, never brochure like, never lecturing. Each slide picks up straight from the one before and pays off the hook. Use everyday things she will recognise (the diary, the school run, the supermarket, the telly). Never invent a story about a real person: no "a patient once told me", no "a client said", no made up moment from the clinic, no quotes from anyone. Share observations, opinions and shared everyday moments only. First person, UK spelling, no dashes, no negative parallelism, and every compliance rule and banned word still applies.${opts.dental ? " This is a dental practice: if a hook mentions aesthetics, injectors or a face clinic, change only those words to dentistry wording and keep the rest." : ""}${opts.ryder ? " The Ryder Clinic: keep her hook words exactly, but write the slides after it in the warm, sincere voice with no jokes." : ""}`;
}

// Splits a hook in two at its most natural pause, for tools whose cover has a small line above and a line below.
// The words are never changed, only divided. Pauses are tried in order, and the split nearest the middle wins.
export function splitHook(text: string): { first: string; second: string } {
  const t = text.replace(/\s+/g, " ").trim();
  const words = t.split(" ");
  if (words.length < 4) return { first: t, second: "" };
  const half = t.length / 2;
  const candidates: number[] = [];
  const add = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) candidates.push(m.index + m[0].length);
  };
  // After a full stop, colon, comma, question or exclamation mark.
  add(/[.:,?!;]\s+/g);
  // Before a joining word, when there is no punctuation to use.
  if (!candidates.length) add(/\s(?=(?:and|but|because|when|if|so|for|with|that|than)\s)/gi);
  const best = candidates
    .filter((i) => i > 8 && t.length - i > 8)
    .sort((a, b) => Math.abs(a - half) - Math.abs(b - half))[0];
  if (best !== undefined) return { first: t.slice(0, best).trim(), second: t.slice(best).trim() };
  const mid = Math.round(words.length / 2);
  return { first: words.slice(0, mid).join(" "), second: words.slice(mid).join(" ") };
}

// The last slide of every carousel. A treatment post asks her to comment the treatment name for more info,
// any other post gets one of these, picked at random so no two posts end the same way.
export const OTHER_CTAS = [
  "Save this for the days you forget",
  "Comment SEEN if you felt that",
  "Tell me your version in the comments",
  "Comment ME if you needed this today",
  "Which one are you? Tell me below",
  "Save this one for a rainy Tuesday",
  "Pop your answer in the comments, I read every one",
  "Comment YES if this is you",
  "Send this to the woman who runs your world",
  "Reply with your own and I will answer",
];

// THE FRIENDLY CTA BANK for treatment posts. Each line has {WORD} (the treatment name, shouted) or {AREA} (the clinic's area) in it,
// and every post gets a different one, so the last slide reads warm and varied instead of the same line each time.
// It stays OFF until Vanessa has approved the lines: flip TREATMENT_CTA_BANK_LIVE to true and every tool that calls finalCta starts using it.
export const TREATMENT_CTA_BANK_LIVE = false;
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

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BANK_RES = TREATMENT_CTA_BANK.map((l) => new RegExp(`^${l.split(/\{WORD\}|\{AREA\}/).map(escapeRe).join(".+")}$`, "i"));

export function isFinalCta(line: string): boolean {
  const l = line.trim().replace(/[.!]+$/, "").toLowerCase();
  return /^comment .* for more info$/.test(l) || l === "tag a friend who will get it" || OTHER_CTAS.some((c) => c.toLowerCase() === l) || BANK_RES.some((re) => re.test(line.trim().replace(/[.!]+$/, "")));
}

/** One bank line for this treatment and area. `seed` (a post key) keeps each post's line steady; `shift` is the shuffle button. */
export function bankCta(treatment: string, area = "", seed = "", shift = 0): string {
  const word = treatment.replace(/\s+/g, " ").trim().slice(0, 60).toUpperCase();
  const town = area.split(",")[0].trim();
  const usable = TREATMENT_CTA_BANK.filter((l) => (l.includes("{AREA}") ? !!town : l.includes("{WORD}") ? !!word : true));
  let h = 0;
  for (const ch of `${seed}${treatment}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const line = usable[(h + shift) % usable.length];
  return line.replace("{WORD}", word).replace("{AREA}", town);
}

export function finalCta(treatment: unknown, area?: unknown, seed?: unknown): string {
  const t = String(treatment ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (t && TREATMENT_CTA_BANK_LIVE) return bankCta(t, String(area ?? ""), String(seed ?? ""));
  return t ? `Comment ${t.toUpperCase()} for more info` : OTHER_CTAS[Math.floor(Math.random() * OTHER_CTAS.length)];
}


// MATCHED CTA: the last slide and the very end of the caption carry one reply word call to action that fits the post.
// A treatment or section word wins; otherwise the writer supplies a one word topic (replyWord). Never a question.
const MATCHED_LINES = [
  "Comment {W} and I will send you the details",
  "Comment {W} and I will pop you a message with everything you need to know",
  "Comment {W} and I will tell you honestly whether it is for you",
  "Comment {W} and I will talk you through it",
  "Comment {W} if you would like me to tell you more",
  "Comment {W} and I will message you",
  "Comment {W} below and I will come and find you",
  "Comment {W} and I will point you in the right direction",
];

export function cleanWord(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 24).trim();
}

export function matchedCta(word: unknown, aiWord?: unknown, seed?: unknown): string {
  const w = cleanWord(word) || cleanWord(aiWord) || "INFO";
  let h = 0;
  for (const ch of `${seed ?? ""}${w}${Math.random() < 0 ? "" : ""}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const line = seed ? MATCHED_LINES[h % MATCHED_LINES.length] : MATCHED_LINES[Math.floor(Math.random() * MATCHED_LINES.length)];
  return line.replace("{W}", w);
}

/** Caption body with any old CTA line and any closing question removed, then the matched CTA added at the very end. */
export function withCta(caption: string, cta: string): string {
  const lines = caption.split("\n").map((l) => l.trim()).filter((l) => l && !isFinalCta(l) && !/^comment\s/i.test(l) && !/^drop me a dm/i.test(l));
  while (lines.length > 1 && /\?["')]*$/.test(lines[lines.length - 1])) lines.pop();
  return `${lines.join("\n")}\n\n${cta}`;
}

export const CAPTION_END_RULE = "It must NOT end on a question and must contain no call to action of its own: the call to action is added for you.";
export const REPLY_WORD_RULE = '"replyWord": ONE short word in capitals (3 to 12 letters, no spaces) naming what this post is about, for example SKIN, SLEEP, PEELS or CONSULT, so women can comment it.';
