// A safety net for British spelling. The writing prompts already ask for British English, but a model can still slip a "realize" through,
// so every generated line is passed through this before it reaches the post.

const KEEP = /^(size[sd]?|sizing|prize[sd]?|prizing|seize[sd]?|seizing|resiz\w*|oversiz\w*|downsiz\w*|upsiz\w*|capsiz\w*|baize|assize|chizz\w*)$/i;

function keepCase(from: string, to: string): string {
  if (from === from.toUpperCase() && from.length > 1) return to.toUpperCase();
  if (from[0] === from[0].toUpperCase()) return to[0].toUpperCase() + to.slice(1);
  return to;
}

const WORDS: [RegExp, string][] = [
  [/\bcolor(s|ed|ful|less|ing)?\b/gi, "colour$1"],
  [/\bfavorite(s)?\b/gi, "favourite$1"],
  [/\bflavor(s|ed|ful)?\b/gi, "flavour$1"],
  [/\bhonor(s|ed|able)?\b/gi, "honour$1"],
  [/\bhumor(ous)?\b/gi, "humour$1"],
  [/\bneighbor(s|hood|hoods)?\b/gi, "neighbour$1"],
  [/\bbehavior(s|al)?\b/gi, "behaviour$1"],
  [/\bcenter(s|ed)?\b/gi, "centre$1"],
  [/\bfiber(s)?\b/gi, "fibre$1"],
  [/\btheater(s)?\b/gi, "theatre$1"],
  [/\bgray\b/gi, "grey"],
  [/\bmom(s)?\b/gi, "mum$1"],
  [/\bskeptic(al|s)?\b/gi, "sceptic$1"],
  [/\baging\b/gi, "ageing"],
  [/\bdefense\b/gi, "defence"],
  [/\boffense\b/gi, "offence"],
  [/\bcatalog(s)?\b/gi, "catalogue$1"],
  [/\bjewelry\b/gi, "jewellery"],
  [/\bpajamas\b/gi, "pyjamas"],
  [/\banalyze(s|d)?\b/gi, "analyse$1"],
  [/\banalyzing\b/gi, "analysing"],
  [/\bparalyze(s|d)?\b/gi, "paralyse$1"],
  [/\bcatalyze(s|d)?\b/gi, "catalyse$1"],
  [/\bsweater(s)?\b/gi, "jumper$1"],
  [/\bvacation(s)?\b/gi, "holiday$1"],
  [/\bapartment(s)?\b/gi, "flat$1"],
  [/\bcookie(s)?\b/gi, "biscuit$1"],
  [/\bwhile\b(?=\s+(?:i|you|we)\s+(?:were|was))/gi, "whilst"],
];

export function britishise(text: string): string {
  if (!text) return text;
  let out = text.replace(/\b([A-Za-z]{3,})(ization|izations|izing|ized|izes|ize)\b/gi, (m, stem: string, end: string) => {
    if (KEEP.test(m)) return m;
    const to: Record<string, string> = { ization: "isation", izations: "isations", izing: "ising", ized: "ised", izes: "ises", ize: "ise" };
    const r = to[end.toLowerCase()];
    return stem + (end === end.toUpperCase() ? r.toUpperCase() : r);
  });
  for (const [re, rep] of WORDS) out = out.replace(re, (m, ...g) => keepCase(m, rep.replace(/\$(\d)/g, (_x, n) => (typeof g[Number(n) - 1] === "string" ? g[Number(n) - 1] : ""))));
  return out;
}
