// Spreads broadcast posts out over time by client name, so a "send to all clients"
// action doesn't fire a burst of Meta API calls in the same second and trip
// Facebook's rate limiting (the "reduce the amount of data you're asking for" error).
// Buckets are alphabetical on the client's first letter, non-overlapping.
export function nameBucketOffsetMinutes(name: string): number {
  const letter = (name || "").trim().charAt(0).toUpperCase();
  if (!letter) return 0;
  if (letter <= "F") return 11;
  if (letter <= "M") return 18;
  if (letter <= "S") return 21;
  return 45;
}
