export interface PageForMatch {
  id: string;
  name: string;
  accessToken: string;
  instagramAccountId: string | null;
}

export interface PresetForMatch {
  id: number;
  name: string;
}

export interface MatchedPage extends PageForMatch {
  suggestedPresetId: number | null;
  matchScore: number;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(the|clinic|aesthetics|aesthetic|cosmetic|beauty|skin|ltd|limited)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  let intersectionCount = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2);
    const count = bigrams.get(bigram) ?? 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersectionCount++;
    }
  }
  return (2 * intersectionCount) / (a.length + b.length - 2);
}

function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return diceCoefficient(na, nb);
}

export function matchPagesToPresets(
  pages: PageForMatch[],
  presets: PresetForMatch[]
): MatchedPage[] {
  return pages.map((page) => {
    let bestPreset: PresetForMatch | null = null;
    let bestScore = 0;
    for (const preset of presets) {
      const score = similarity(page.name, preset.name);
      if (score > bestScore) {
        bestScore = score;
        bestPreset = preset;
      }
    }
    return {
      ...page,
      suggestedPresetId: bestScore >= 0.7 ? (bestPreset?.id ?? null) : null,
      matchScore: bestScore,
    };
  });
}
