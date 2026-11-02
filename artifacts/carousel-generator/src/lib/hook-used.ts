// Remembers which Hook Bank hooks have already been used for each client, so the grid can cross them out.
// The list is kept in the database (the shared tick store) so it follows you from device to device.
// A copy is kept in this browser too, so the grid appears instantly and still works if the server is slow.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const norm = (client: string) => client.trim().toLowerCase();
const localKey = (client: string) => `hook-bank-used:${norm(client)}`;
const storeId = (client: string) => `hooks-used:${norm(client).replace(/[\/\\]/g, "-")}`;

function headers(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, "Authorization": `Bearer ${pw}` };
}

function readLocal(client: string): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(localKey(client)) ?? "[]");
    return Array.isArray(arr) ? arr.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(client: string, codes: string[]): void {
  try { localStorage.setItem(localKey(client), JSON.stringify(Array.from(new Set(codes)))); } catch { /* storage can be blocked, the crossing out is a convenience only */ }
}

async function patchServer(client: string, codes: string[], value: boolean): Promise<void> {
  if (!codes.length) return;
  try {
    await fetch(`${BASE}/api/content-ticklist/${encodeURIComponent(storeId(client))}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ keys: codes, value }),
    });
  } catch { /* the browser copy still holds it, it will be sent next time */ }
}

// What this browser already knows. Instant, used for first paint.
export function getUsedHooks(client: string): string[] {
  if (!client.trim()) return [];
  return readLocal(client);
}

// The full list from the database. Anything only this browser knew about (crossed out before the list moved
// to the database) is sent up, so nothing already crossed out is lost.
export async function syncUsedHooks(client: string): Promise<string[]> {
  if (!client.trim()) return [];
  const local = readLocal(client);
  try {
    const res = await fetch(`${BASE}/api/content-ticklist/${encodeURIComponent(storeId(client))}`, { headers: headers() });
    if (!res.ok) return local;
    const json = (await res.json()) as { state?: Record<string, boolean> };
    const server = Object.keys(json.state ?? {});
    const missing = local.filter((c) => !server.includes(c));
    if (missing.length) void patchServer(client, missing, true);
    const merged = Array.from(new Set([...server, ...local]));
    writeLocal(client, merged);
    return merged;
  } catch {
    return local;
  }
}

export function markHooksUsed(client: string, codes: string[]): void {
  if (!client.trim() || !codes.length) return;
  writeLocal(client, [...readLocal(client), ...codes]);
  void patchServer(client, codes, true);
}

// Cross out or put back one hook by hand, for the ones posted somewhere else.
export function setHookUsed(client: string, code: string, used: boolean): string[] {
  if (!client.trim()) return [];
  const next = used ? [...readLocal(client), code] : readLocal(client).filter((c) => c !== code);
  writeLocal(client, next);
  void patchServer(client, [code], used);
  return Array.from(new Set(next));
}

export async function clearUsedHooks(client: string): Promise<void> {
  if (!client.trim()) return;
  const old = new Set(readLocal(client));
  try { localStorage.removeItem(localKey(client)); } catch { /* ignore */ }
  try {
    const res = await fetch(`${BASE}/api/content-ticklist/${encodeURIComponent(storeId(client))}`, { headers: headers() });
    if (res.ok) {
      const json = (await res.json()) as { state?: Record<string, boolean> };
      Object.keys(json.state ?? {}).forEach((c) => old.add(c));
    }
  } catch { /* fall back to what this browser knew */ }
  await patchServer(client, Array.from(old), false);
}
