// Remembers which Hook Bank hooks have already been used for each client, so the picker can cross them out.
// Stored in this browser only, one list per client name.

const key = (client: string) => `hook-bank-used:${client.trim().toLowerCase()}`;

export function getUsedHooks(client: string): string[] {
  if (!client.trim()) return [];
  try {
    const arr = JSON.parse(localStorage.getItem(key(client)) ?? "[]");
    return Array.isArray(arr) ? arr.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function markHooksUsed(client: string, codes: string[]): void {
  if (!client.trim() || !codes.length) return;
  try {
    const next = Array.from(new Set([...getUsedHooks(client), ...codes]));
    localStorage.setItem(key(client), JSON.stringify(next));
  } catch { /* storage can be blocked, the crossing out is a convenience only */ }
}

export function clearUsedHooks(client: string): void {
  try { localStorage.removeItem(key(client)); } catch { /* ignore */ }
}
