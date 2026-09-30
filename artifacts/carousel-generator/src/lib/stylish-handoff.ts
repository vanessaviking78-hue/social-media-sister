// Passes a finished Client Stylish pack (the 16 photos and the CSV) from the Client Stylish
// page into Stylish. Stored in a small IndexedDB store so it survives the page change and
// works if Stylish opens in a new tab.
export type StylishHandoff = { files: File[]; csv: string; csvName: string; clientName: string; location?: string; intent?: "reels" | "auto"; october?: boolean; spot?: string };
type StoredHandoff = {
  images: { name: string; type: string; blob: Blob }[];
  csv: string;
  csvName: string;
  clientName: string;
  location?: string;
  intent?: "reels" | "auto";
  october?: boolean;
  spot?: string;
};

const DB_NAME = "client-stylish-handoff";
const STORE = "handoff";
const KEY = "pending";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

// Waits for the write to land before returning, so Stylish never opens to an empty store.
export async function setStylishHandoff(h: StylishHandoff): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const stored: StoredHandoff = {
    images: h.files.map(f => ({ name: f.name, type: f.type, blob: f })),
    csv: h.csv,
    csvName: h.csvName,
    clientName: h.clientName,
    location: h.location,
    intent: h.intent,
    october: h.october,
    spot: h.spot,
  };
  return new Promise<boolean>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(stored, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

export async function takeStylishHandoff(): Promise<StylishHandoff | null> {
  const db = await openDb();
  if (!db) return null;
  const stored = await new Promise<StoredHandoff | null>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => { store.delete(KEY); resolve((req.result as StoredHandoff) ?? null); };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  if (!stored || !stored.images.length) return null;
  return {
    files: stored.images.map(i => new File([i.blob], i.name, { type: i.type })),
    csv: stored.csv,
    csvName: stored.csvName,
    clientName: stored.clientName,
    location: stored.location,
    intent: stored.intent,
    october: stored.october,
    spot: stored.spot,
  };
}
