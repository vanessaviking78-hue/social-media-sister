// Passes finished cover slides from Stylish to Magazine Flip, which opens in its own tab so
// Stylish stays open behind it - the ticked posts and the Schedule button are still right there
// when you come back. The handoff itself travels as a few blobs in a small IndexedDB store
// (shared by every tab on the site), not in memory, since a new tab starts with a blank slate.
export type FlipHandoff = { canvases: HTMLCanvasElement[]; clientName: string; caption?: string; location?: string; title?: string };
type StoredHandoff = { blobs: Blob[]; clientName: string; caption?: string; location?: string; title?: string };

const DB_NAME = "stylish-flip-handoff";
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

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => c.toBlob(b => resolve(b), "image/jpeg", 0.85));
}

// Waits for the write to actually land before returning, so a tab opened right after this call
// won't race it and find nothing there yet.
export async function setFlipHandoff(h: FlipHandoff): Promise<void> {
  const blobs = (await Promise.all(h.canvases.map(canvasToBlob))).filter((b): b is Blob => !!b);
  if (!blobs.length) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ blobs, clientName: h.clientName, caption: h.caption, location: h.location, title: h.title } as StoredHandoff, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

// Turns the stored blobs back into ready-to-draw images, keyed by object URL so the caller can
// revoke them once it's done loading.
export async function takeFlipHandoff(): Promise<{ images: HTMLImageElement[]; clientName: string; caption?: string; location?: string; title?: string } | null> {
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
  if (!stored || !stored.blobs.length) return null;
  const images = await Promise.all(stored.blobs.map(blob => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  })));
  return { images, clientName: stored.clientName, caption: stored.caption, location: stored.location, title: stored.title };
}
