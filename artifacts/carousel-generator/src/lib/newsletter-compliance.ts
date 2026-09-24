// Compliance + house style rules for the Newsletter Maker. The same file is
// used in two places: the browser (live flags on every edit, downloads locked
// while anything high or medium remains) and the server (every generated or
// rewritten line is scanned and cleaned before it reaches the page). Keep the
// two copies identical: artifacts/api-server/src/lib/newsletterCompliance.ts
// and artifacts/carousel-generator/src/lib/newsletter-compliance.ts

export type ComplianceFlag = {
  id: string;
  where: string; // human label, e.g. "Lead Story"
  field: string; // key used to apply a swap
  severity: "high" | "medium" | "style";
  matched: string;
  reason: string;
  swap?: string; // replacement text, when a straight swap makes sense
};

type Rule = {
  pattern: RegExp;
  severity: ComplianceFlag["severity"];
  reason: string;
  swap?: string | ((m: string) => string);
};

const keepCase = (replacement: string) => (m: string) =>
  m[0] === m[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;

const RULES: Rule[] = [
  // Prescription-only medicines (MHRA, CAP 12.12)
  {
    pattern: /\b(botox|baby botox|azzalure|bocouture|dysport|xeomin|letybo|relfydess|alluzience|daxxify|vistabel|jeuveau|nuceiva|botulinum|toxin|tox)\b/gi,
    severity: "high",
    reason: "Prescription-only medicine named. MHRA and CAP rule 12.12 say no.",
    swap: keepCase("injectable treatments"),
  },
  { pattern: /\banti[- ]?wrinkle\b/gi, severity: "high", reason: "Implies a treatment claim for a POM.", swap: keepCase("smoothing") },
  // Absolute or unprovable claims
  { pattern: /\b(pain[- ]?free|painless)\b/gi, severity: "high", reason: "Can't be substantiated.", swap: keepCase("comfortable") },
  { pattern: /\bguarantee(d|s)?\b/gi, severity: "high", reason: "No results can be guaranteed." },
  { pattern: /\bno downtime\b/gi, severity: "high", reason: "Absolute claim. Everyone heals differently.", swap: keepCase("little downtime for most people") },
  { pattern: /\brisk[- ]?free\b/gi, severity: "high", reason: "Every procedure carries some risk." },
  { pattern: /\b(safe|safely|safest|100% safe)\b/gi, severity: "high", reason: "\"Safe\" is an absolute claim the ASA won't accept." },
  { pattern: /\b(clinically|scientifically|medically) proven\b|\bproven to\b/gi, severity: "medium", reason: "Needs documentary evidence to back it up." },
  { pattern: /\bpermanent(ly)?\b/gi, severity: "medium", reason: "Implies a guaranteed long-term result." },
  { pattern: /\b(instant(ly)?|overnight|immediate) results?\b/gi, severity: "medium", reason: "Overclaims the outcome.", swap: keepCase("results") },
  { pattern: /\bresults (that )?last(s|ing)? (for )?(up to )?\d+/gi, severity: "medium", reason: "Duration claims vary person to person." },
  { pattern: /\b(miracle|magic (cream|results|wand|formula|fix))\b/gi, severity: "medium", reason: "Exaggerated efficacy language." },
  { pattern: /\b(the best|number one|no\. ?1|#1|the leading|leading (clinic|expert|practitioner|provider))\b/gi, severity: "medium", reason: "Superlative that needs proof." },
  { pattern: /\b(look|looking|appear)s? (\d+|five|ten|years) (years? )?younger\b/gi, severity: "medium", reason: "A specific result claim." },
  { pattern: /\b(wrinkle[- ]?free|line[- ]?free|erase(s|d)?|eliminate(s|d)?|banish(es|ed)?|get rid of (your )?(wrinkles|lines))\b/gi, severity: "medium", reason: "Promises to remove signs of ageing." },
  { pattern: /\b(turn(s|ing)? back (the )?(clock|time)|ageless|anti[- ]?ag(e)?ing|reverse(s)? ageing)\b/gi, severity: "medium", reason: "Implies stopping or reversing ageing." },
  { pattern: /\b(cure|cures|fix(es)? (your|it))\b/gi, severity: "medium", reason: "Medical claim." },
  { pattern: /\bbefore (and|&) after\b/gi, severity: "medium", reason: "Before and after claims need care, and never for POMs." },
  // Pressure selling
  { pattern: /\b(limited time|hurry|last chance|don'?t miss (out)?|ends (soon|tonight|today)|while stocks last|today only|act now|selling fast|limited (spaces|slots|availability)|spaces are limited)\b/gi, severity: "high", reason: "Urgency or pressure selling around medical treatment." },
  { pattern: /\bonly \d+ (left|spaces|slots|spots|appointments)\b/gi, severity: "high", reason: "Scarcity pressure." },
  { pattern: /\b(diary|diaries|appointments|spaces|slots|books) (is |are )?(filling|going|booking) (up )?(fast|quickly)?/gi, severity: "medium", reason: "Implied scarcity. Keep booking nudges pressure-free." },
  // House style
  { pattern: /[\u2014\u2013]/g, severity: "style", reason: "Dash spotted. House style says no.", swap: ", " },
  { pattern: /!(?=[^!]*!)/g, severity: "style", reason: "More than one exclamation mark.", swap: "" },
  // UK spelling
  { pattern: /\bcolor(s|ed|ful)?\b/gi, severity: "style", reason: "Americanism.", swap: (m) => m.replace(/olor/i, (x) => (x[0] === "O" ? "Olour" : "olour")) },
  { pattern: /\bfavorite(s)?\b/gi, severity: "style", reason: "Americanism.", swap: (m) => m.replace(/avorite/i, "avourite") },
  { pattern: /\bcenter(s|ed)?\b/gi, severity: "style", reason: "Americanism.", swap: (m) => m.replace(/enter/i, "entre") },
  { pattern: /\b(personaliz|customiz|organiz|realiz|recogniz|minimiz|maximiz|specializ|moisturiz|optimiz)(e|ed|es|ing|ation)\b/gi, severity: "style", reason: "Americanism.", swap: (m) => m.replace(/iz/i, "is") },
  { pattern: /\bmom(s)?\b/gi, severity: "style", reason: "Americanism.", swap: (m) => m.replace(/mom/i, (x) => (x[0] === "M" ? "Mum" : "mum")) },
  { pattern: /\bvacation\b/gi, severity: "style", reason: "Americanism.", swap: keepCase("holiday") },
  { pattern: /\bgotten\b/gi, severity: "style", reason: "Americanism.", swap: "got" },
  { pattern: /\bgame plan\b/gi, severity: "style", reason: "Americanism.", swap: "plan" },
  { pattern: /\bfall\b(?= (season|skin|is|has|always))/gi, severity: "style", reason: "Americanism for the season.", swap: keepCase("autumn") },
];

const OFFER_POM = /\b(injectable|injection|wrinkle|frown|forehead|crow'?s feet|toxin|botox|tox|brow lift|masseter|jaw slimming|bruxism|hyperhidrosis|gummy smile|lip flip)\b/i;
const OFFER_MONEY = /(%|£|\bfree\b|\boff\b|\bdiscount|\bsave\b|\bhalf price)/i;

export function scanText(text: string, where: string, field: string): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  if (!text) return flags;
  RULES.forEach((rule, ri) => {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text)) && n < 20) {
      n++;
      const swap = typeof rule.swap === "function" ? rule.swap(m[0]) : rule.swap;
      flags.push({
        id: `${field}-${ri}-${m.index}`,
        where,
        field,
        severity: rule.severity,
        matched: m[0],
        reason: rule.reason,
        swap,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return flags;
}

export function scanOffer(offer: string): ComplianceFlag[] {
  if (!offer.trim()) return [];
  if (OFFER_POM.test(offer) && OFFER_MONEY.test(offer)) {
    return [
      {
        id: "offer-pom",
        where: "Your offer",
        field: "offer",
        severity: "high",
        matched: offer.trim().slice(0, 60),
        reason: "Looks like a discount on a prescription-only treatment. Put the offer on a consultation, skincare or a non-POM service instead.",
      },
    ];
  }
  return [];
}

// Replace the first occurrence of `matched` in `text` with `swap`.
export function applySwap(text: string, matched: string, swap: string): string {
  const i = text.indexOf(matched);
  if (i < 0) return text;
  const before = text.slice(0, i).trimEnd();
  const startsSentence = before === "" || /[.!?]$/.test(before);
  if (!startsSentence && /^[A-Z][a-z]/.test(swap)) swap = swap[0].toLowerCase() + swap.slice(1);
  let out = text.slice(0, i) + swap + text.slice(i + matched.length);
  if (swap === ", ") out = out.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/, {2,}/g, ", ");
  return out;
}

// High and medium both stop the newsletter leaving the building.
export const isBlocking = (f: ComplianceFlag) => f.severity === "high" || f.severity === "medium";
