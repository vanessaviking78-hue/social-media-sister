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
  return `Write the slides after the hook so they carry on from it like a friend chatting on the sofa with one woman who has followed along for years: warm, personable, a little daft, never professional or brochure like, never lecturing. Each slide picks up straight from the one before and pays off the hook. Use everyday things she will recognise (the kettle, the diary, the school run, the supermarket, the telly). Never invent a story about a real person: no "a patient once told me", no "a client said", no made up moment from the clinic, no quotes from anyone. Share observations, opinions and shared everyday moments only. First person, UK spelling, no dashes, no negative parallelism, and every compliance rule and banned word still applies.${opts.dental ? " This is a dental practice: if a hook mentions aesthetics, injectors or a face clinic, change only those words to dentistry wording and keep the rest." : ""}${opts.ryder ? " The Ryder Clinic: keep her hook words exactly, but write the slides after it in the warm, sincere voice with no jokes." : ""}`;
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
